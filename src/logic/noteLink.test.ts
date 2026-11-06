import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createNoteReceiver, createNoteSender, isNoteLink, LEAD_MS, MAX_LINKS, NOTE_BYTES, NOTE_LINK, noteLinkWanted, privateCandidate } from './noteLink';
import { applyDirectNote, applyRemoteNotes, placeNote } from './MicInputToTick';
import type { HitNotesByPlayer, RemoteNote } from './MicInputToTick';
import type { NotePeer, NoteReport } from './noteLink';
import type { VoiceSignal } from './voiceLink';

type FakeChannel = {
  binaryType: string; readyState: string; bufferedAmount: number; sent: ArrayBuffer[];
  onopen: (() => void) | null; onclose: (() => void) | null; onmessage: ((e: { data: unknown }) => void) | null;
  send(d: ArrayBuffer): void;
};
const fakeChannel = (): FakeChannel => ({
  binaryType: '', readyState: 'connecting', bufferedAmount: 0, sent: [], onopen: null, onclose: null, onmessage: null,
  send(d) { this.sent.push(d.slice(0)); },
});

/** A fake peer connection: what the links call, and the page's side of it */
function fakePeer() {
  const channel = fakeChannel();
  const peer = {
    channel,
    options: null as RTCDataChannelInit | null,
    closed: false,
    added: [] as unknown[],
    connectionState: 'new',
    remoteDescription: null as unknown,
    onicecandidate: null as NotePeer['onicecandidate'],
    onconnectionstatechange: null as NotePeer['onconnectionstatechange'],
    ondatachannel: null as NotePeer['ondatachannel'],
    createDataChannel(_label: string, options: RTCDataChannelInit) { peer.options = options; return channel; },
    createOffer: async () => ({ type: 'offer', sdp: 'OFFER' }),
    createAnswer: async () => ({ type: 'answer', sdp: 'ANSWER' }),
    setLocalDescription: async () => {},
    setRemoteDescription: async (d: unknown) => { peer.remoteDescription = d; },
    addIceCandidate: async (c: unknown) => { peer.added.push(c); },
    getStats: async () => new Map(),
    close() { peer.closed = true; },
    state(s: string) { peer.connectionState = s; peer.onconnectionstatechange?.(); },
    open() { channel.readyState = 'open'; channel.onopen?.(); },
  };
  return peer;
}
type Peer = ReturnType<typeof fakePeer>;

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const note = (freq: number, t: number) => {
  const b = new ArrayBuffer(NOTE_BYTES);
  const v = new DataView(b);
  v.setFloat32(0, freq, true);
  v.setFloat32(4, t, true);
  return b;
};

const stored = new Map<string, string>();
vi.stubGlobal('sessionStorage', { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => stored.set(k, v) });

beforeEach(() => { vi.useFakeTimers(); stored.clear(); });
afterEach(() => { vi.useRealTimers(); });

describe('noteLinkWanted', () => {
  test('off unless asked, it holds for the tab, ?directnotes=0 ends it', () => {
    expect(noteLinkWanted('')).toBe(false);
    expect(noteLinkWanted('?directnotes')).toBe(true);
    expect(noteLinkWanted('')).toBe(true);
    expect(noteLinkWanted('?directnotes=0')).toBe(false);
    expect(noteLinkWanted('')).toBe(false);
  });
});

describe('privateCandidate', () => {
  const c = (address: string, typ = 'host') => `candidate:1 1 udp 2122260223 ${address} 50000 typ ${typ} generation 0`;
  test('what stays in the room, and the relay, crosses', () => {
    for (const a of ['192.168.1.20', '10.0.0.7', '172.16.5.1', '172.31.0.1', '169.254.3.4', 'fd12:3456::1', 'fe80::1', 'abcd-1234.local']) expect(privateCandidate(c(a))).toBe(true);
    expect(privateCandidate(c('104.16.1.1', 'relay'))).toBe(true);
  });
  test("a public address does not: it says where someone is", () => {
    for (const a of ['85.1.2.3', '172.32.0.1', '2a02:8109:1234::5', '100.64.0.1']) expect(privateCandidate(c(a))).toBe(false);
    expect(privateCandidate(c('85.1.2.3', 'srflx'))).toBe(false);
    expect(privateCandidate(c('192.168.1.20', 'srflx'))).toBe(false);
    expect(privateCandidate(c('192.168.1.20', 'prflx'))).toBe(false);
    expect(privateCandidate(undefined)).toBe(false);
  });
});

describe('createNoteReceiver', () => {
  const setup = (over: Partial<Parameters<typeof createNoteReceiver>[0]> = {}) => {
    const peers: Peer[] = [];
    const signals: { to: string; signal: VoiceSignal }[] = [];
    const reports: NoteReport[] = [];
    const got: [string, number, number][] = [];
    let socketFirst = false;
    const receiver = createNoteReceiver({
      send: (to, signal) => { signals.push({ to, signal }); return true; },
      onNote: (n, f, t) => { got.push([n, f, t]); return socketFirst; },
      iceServers: () => [],
      report: r => reports.push(r),
      peer: () => { const p = fakePeer(); peers.push(p); return p as unknown as NotePeer; },
      ...over,
    });
    receiver.setEnabled(true);
    return { receiver, peers, signals, reports, got, socketIsFirst: (v: boolean) => { socketFirst = v; } };
  };
  /** The singer answers the link's offer, and it opens */
  const connect = async (s: ReturnType<typeof setup>, i = s.peers.length - 1) => {
    await flush();
    const offer = s.signals.filter(x => x.signal.description?.type === 'offer')[i];
    s.receiver.handleSignal(offer.to, { link: offer.signal.link, description: { type: 'answer', sdp: 'A' } });
    await flush();
    s.peers[i].state('connected');
    s.peers[i].open();
    return offer.signal.link;
  };

  test('off: nothing is ever tried', async () => {
    const s = setup();
    s.receiver.setEnabled(false);
    s.receiver.socketNote('Ann', null);
    await flush();
    expect(s.peers).toHaveLength(0);
    expect(s.signals).toHaveLength(0);
  });

  test("a singer's first socket note starts one link: unordered, no retransmits, an id of its own kind", async () => {
    const s = setup();
    s.receiver.socketNote('Ann', null);
    s.receiver.socketNote('Ann', null);
    await flush();
    expect(s.peers).toHaveLength(1);
    expect(s.peers[0].options).toEqual({ ordered: false, maxRetransmits: 0 });
    const [offer] = s.signals;
    expect(offer.to).toBe('Ann');
    expect(isNoteLink(offer.signal.link)).toBe(true);
    expect(offer.signal.link.startsWith(NOTE_LINK)).toBe(true);
    expect(offer.signal.description).toEqual({ type: 'offer', sdp: 'OFFER' });
  });

  test('only private candidates go to the singer', async () => {
    const s = setup();
    s.receiver.socketNote('Ann', null);
    await flush();
    s.signals.length = 0;
    const cand = (candidate: string) => ({ candidate: { candidate, toJSON: () => ({ candidate }) } as unknown as RTCIceCandidate });
    s.peers[0].onicecandidate?.(cand('candidate:1 1 udp 1 85.1.2.3 5 typ srflx raddr 0.0.0.0 rport 0'));
    s.peers[0].onicecandidate?.(cand('candidate:1 1 udp 1 192.168.1.2 5 typ host'));
    expect(s.signals.map(x => x.signal.candidate?.candidate)).toEqual(['candidate:1 1 udp 1 192.168.1.2 5 typ host']);
  });

  test('notes down the channel reach the store, and each counts for who was first', async () => {
    const s = setup();
    s.receiver.socketNote('Ann', null);
    await connect(s);
    s.peers[0].channel.onmessage?.({ data: note(440, 12.25) });
    expect(s.got).toEqual([['Ann', 440, 12.25]]);
    s.socketIsFirst(true);
    s.peers[0].channel.onmessage?.({ data: note(441, 12.5) });
    // what is no note does not reach it
    s.peers[0].channel.onmessage?.({ data: new ArrayBuffer(3) });
    s.peers[0].channel.onmessage?.({ data: 'hello' });
    s.peers[0].channel.onmessage?.({ data: note(-1, 1) });
    s.peers[0].channel.onmessage?.({ data: note(1e9, 1) });
    expect(s.got).toHaveLength(2);
    // the socket's copies: lead into its bin, a note the link never brought counts apart
    s.receiver.socketNote('Ann', { videoTime: 12.25, freq: 440, at: performance.now() - 30 });
    s.receiver.socketNote('Ann', null);
    s.receiver.close();
    await flush();
    expect(s.reports[0]).toMatchObject({ side: 'host', result: 'connected', singer: 'Ann', answered: true }); // when it opened
    expect(s.reports[0].notes).toBeUndefined();
    const r = s.reports.at(-1)!;
    expect(r).toMatchObject({ side: 'host', result: 'connected', singer: 'Ann', notes: { first: 1, socketFirst: 1, socketOnly: 1 } });
    expect(r.notes?.lead).toHaveLength(LEAD_MS.length + 1);
    expect(r.notes?.lead[LEAD_MS.findIndex(ms => 30 < ms)]).toBe(1);
  });

  test('no answer: reported, closed, tried again only later, and in the end not at all', async () => {
    const s = setup();
    for (let round = 1; round <= 3; round++) {
      s.receiver.socketNote('Ann', null);
      await vi.advanceTimersByTimeAsync(400);
      expect(s.peers).toHaveLength(round);
      await vi.advanceTimersByTimeAsync(6_000);
      expect(s.peers[round - 1].closed).toBe(true);
      expect(s.reports.at(-1)).toMatchObject({ result: 'no_answer', answered: false });
      s.receiver.socketNote('Ann', null);
      await vi.advanceTimersByTimeAsync(400);
      expect(s.peers).toHaveLength(round); // not right away
      await vi.advanceTimersByTimeAsync(60_000 * round + 1);
    }
    s.receiver.socketNote('Ann', null);
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.peers).toHaveLength(3);
  });

  test('a page without WebRTC stays on the socket, without a word', async () => {
    const s = setup({ peer: () => { throw new Error('no WebRTC'); } });
    s.receiver.socketNote('Ann', null);
    s.receiver.socketNote('Bob', null);
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.signals).toHaveLength(0);
  });

  test('ICE that finds no way ends the link', async () => {
    const s = setup();
    s.receiver.socketNote('Ann', null);
    await flush();
    const offer = s.signals[0];
    s.receiver.handleSignal('Ann', { link: offer.signal.link, description: { type: 'answer', sdp: 'A' } });
    await vi.advanceTimersByTimeAsync(15_001);
    expect(s.peers[0].closed).toBe(true);
    expect(s.reports.at(-1)).toMatchObject({ result: 'no_path', answered: true });
    expect(s.signals.at(-1)?.signal.bye).toBe(true);
  });

  test("the singer's page giving up first says the same: it answered, and no way was found", async () => {
    const s = setup();
    s.receiver.socketNote('Ann', null);
    await flush();
    const { link } = s.signals[0].signal;
    s.receiver.handleSignal('Ann', { link, description: { type: 'answer', sdp: 'A' } });
    await flush();
    s.receiver.handleSignal('Ann', { link, bye: true });
    await flush();
    expect(s.reports.at(-1)).toMatchObject({ result: 'no_path', answered: true });
  });

  test('goes with the song: no notes for a while end the links, the next song starts anew', async () => {
    const s = setup();
    s.receiver.socketNote('Ann', null);
    await connect(s);
    await vi.advanceTimersByTimeAsync(26_000);
    expect(s.peers[0].closed).toBe(true);
    expect(s.signals.at(-1)?.signal.bye).toBe(true);
    s.receiver.socketNote('Ann', null);
    await vi.advanceTimersByTimeAsync(400);
    expect(s.peers).toHaveLength(2);
  });

  test('at most the lanes, one offer at a time; a quiet one makes room for the next', async () => {
    const s = setup();
    const names = Array.from({ length: MAX_LINKS + 1 }, (_, i) => `S${i}`);
    for (const n of names) s.receiver.socketNote(n, null);
    await vi.advanceTimersByTimeAsync(0);
    expect(s.peers).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(300 * MAX_LINKS);
    expect(s.peers).toHaveLength(MAX_LINKS);
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.peers).toHaveLength(MAX_LINKS); // S8 waits: everyone on screen sings
    for (const n of names.slice(1, MAX_LINKS)) s.receiver.socketNote(n, null);
    await vi.advanceTimersByTimeAsync(5_000);
    for (const n of names.slice(1, MAX_LINKS)) s.receiver.socketNote(n, null);
    s.receiver.socketNote('S8', null);
    await vi.advanceTimersByTimeAsync(400);
    expect(s.peers).toHaveLength(MAX_LINKS + 1);
    expect(s.peers[0].closed).toBe(true);
  });

  test('a flood is no phone: the link goes', async () => {
    const s = setup();
    s.receiver.socketNote('Ann', null);
    await connect(s);
    for (let i = 0; i < 400; i++) s.peers[0].channel.onmessage?.({ data: note(440, i) });
    expect(s.got.length).toBeLessThanOrEqual(200);
    expect(s.peers[0].closed).toBe(false); // (closes once its report is read)
    await flush();
    expect(s.peers[0].closed).toBe(true);
  });

  test('a rename follows the singer; leaving ends the link; the party turning voices off ends them all', async () => {
    const s = setup();
    s.receiver.socketNote('Ann', null);
    await connect(s);
    s.receiver.rename('Ann', 'Anna');
    s.peers[0].channel.onmessage?.({ data: note(440, 1) });
    expect(s.got[0][0]).toBe('Anna');
    s.receiver.drop('Anna');
    await flush();
    expect(s.peers[0].closed).toBe(true);
    s.receiver.socketNote('Bob', null);
    await vi.advanceTimersByTimeAsync(400);
    await connect(s, 1);
    s.receiver.setEnabled(false);
    await flush();
    expect(s.peers[1].closed).toBe(true);
    s.receiver.socketNote('Cid', null);
    await vi.advanceTimersByTimeAsync(400);
    expect(s.peers).toHaveLength(2);
  });

  test("an older link's signal is ignored", async () => {
    const s = setup();
    s.receiver.socketNote('Ann', null);
    await flush();
    s.receiver.handleSignal('Ann', { link: 'n_other', description: { type: 'answer', sdp: 'A' } });
    await flush();
    expect(s.peers[0].remoteDescription).toBeNull();
  });
});

describe('createNoteSender', () => {
  const setup = () => {
    const peers: Peer[] = [];
    const signals: VoiceSignal[] = [];
    const reports: NoteReport[] = [];
    const sender = createNoteSender({
      send: signal => { signals.push(signal); return true; },
      iceServers: () => [],
      report: r => reports.push(r),
      peer: () => { const p = fakePeer(); peers.push(p); return p as unknown as NotePeer; },
    });
    return { sender, peers, signals, reports };
  };
  const offer = (link = 'n_1'): VoiceSignal => ({ link, description: { type: 'offer', sdp: 'O' } });
  const open = async (s: ReturnType<typeof setup>) => {
    s.sender.handleSignal(offer());
    await flush();
    const p = s.peers.at(-1)!;
    p.state('connected');
    p.ondatachannel?.({ channel: p.channel as unknown as RTCDataChannel });
    p.open();
    return p;
  };

  test('does nothing at all until the host page asks: a note goes nowhere, no connection exists', () => {
    const s = setup();
    s.sender.note(440, 1);
    expect(s.peers).toHaveLength(0);
    expect(s.signals).toHaveLength(0);
  });

  test('answers an offer, then sends each note in eight bytes, the socket\'s floats', async () => {
    const s = setup();
    const p = await open(s);
    expect(s.signals[0]).toEqual({ link: 'n_1', description: { type: 'answer', sdp: 'ANSWER' } });
    s.sender.note(440.5, 12.25);
    expect(p.channel.sent).toHaveLength(1);
    const v = new DataView(p.channel.sent[0]);
    expect(p.channel.sent[0].byteLength).toBe(NOTE_BYTES);
    expect(v.getFloat32(0, true)).toBe(440.5);
    expect(v.getFloat32(4, true)).toBe(12.25);
  });

  test('a channel that backs up is left alone, and one not open yet', async () => {
    const s = setup();
    s.sender.handleSignal(offer());
    await flush();
    const p = s.peers[0];
    p.ondatachannel?.({ channel: p.channel as unknown as RTCDataChannel });
    s.sender.note(440, 1);
    expect(p.channel.sent).toHaveLength(0);
    p.open();
    p.channel.bufferedAmount = 100_000;
    s.sender.note(440, 2);
    expect(p.channel.sent).toHaveLength(0);
  });

  test('the host page ends it or goes away: closed, and notes go nowhere again', async () => {
    const s = setup();
    const p = await open(s);
    s.sender.handleSignal({ link: 'n_1', bye: true });
    await flush();
    expect(p.closed).toBe(true);
    s.sender.note(440, 1);
    expect(p.channel.sent).toHaveLength(0);
    const q = await open(s);
    s.sender.hostGone();
    await flush();
    expect(q.closed).toBe(true);
  });

  test('a new offer replaces the old link (the host page was reloaded)', async () => {
    const s = setup();
    const p = await open(s);
    s.sender.handleSignal(offer('n_2'));
    await flush();
    expect(p.closed).toBe(true);
    expect(s.peers).toHaveLength(2);
  });

  test('no way through: reported, closed, silent otherwise', async () => {
    const s = setup();
    s.sender.handleSignal(offer());
    await flush();
    await vi.advanceTimersByTimeAsync(15_001);
    expect(s.peers[0].closed).toBe(true);
    expect(s.reports.at(-1)).toMatchObject({ side: 'singer', result: 'no_path' });
  });

  test('a failed connection after it was up ends it without a word to the host page', async () => {
    const s = setup();
    const p = await open(s);
    s.signals.length = 0;
    p.state('failed');
    await flush();
    expect(p.closed).toBe(true);
    expect(s.signals).toHaveLength(0);
  });
});

describe('two ways to one store', () => {
  const ws = (videoTime: number, freq = 440): RemoteNote => ({ username: 'Ann', videoTime, freq });
  const times = (live: HitNotesByPlayer) => live.Ann.notes.map(n => n.videoTime);

  test('whichever comes first is kept, the other dropped: never twice', () => {
    const live: HitNotesByPlayer = Object.create(null);
    expect(applyDirectNote(live, 'Ann', 440, 1, 100)).toBe(false);
    const seen: unknown[] = [];
    applyRemoteNotes(live, [ws(1)], (_, there) => seen.push(there));
    expect(times(live)).toEqual([1]);
    expect(seen[0]).toMatchObject({ videoTime: 1, at: 100 });
    // the socket first
    applyRemoteNotes(live, [ws(2)]);
    expect(applyDirectNote(live, 'Ann', 440, 2, 200)).toBe(true);
    expect(times(live)).toEqual([1, 2]);
  });

  test('a note the link lost comes by the socket after newer ones, and goes in its place', () => {
    const live: HitNotesByPlayer = Object.create(null);
    for (const t of [1, 2, 4, 5]) applyDirectNote(live, 'Ann', 440, t, t);
    const seen: unknown[] = [];
    applyRemoteNotes(live, [ws(1), ws(2), ws(3), ws(4), ws(5)], (_, there) => seen.push(there));
    expect(times(live)).toEqual([1, 2, 3, 4, 5]);
    expect(seen[2]).toBeNull();
  });

  test('unordered on the link: the highway still reads them in order', () => {
    const live: HitNotesByPlayer = Object.create(null);
    for (const t of [1, 3, 2, 5, 4]) applyDirectNote(live, 'Ann', 440, t, t);
    expect(times(live)).toEqual([1, 2, 3, 4, 5]);
  });

  test('a rewind goes on the end as ever, too far back to look for', () => {
    const live: HitNotesByPlayer = Object.create(null);
    for (let t = 0; t < 100; t++) applyDirectNote(live, 'Ann', 440, 20 + t * 0.03, t);
    const before = live.Ann.notes.length;
    expect(applyDirectNote(live, 'Ann', 440, 5, 1)).toBe(false);
    expect(live.Ann.notes).toHaveLength(before + 1);
    expect(live.Ann.notes.at(-1)?.videoTime).toBe(5);
  });

  test('a singer without a link is pushed as before, whatever the time', () => {
    const live: HitNotesByPlayer = Object.create(null);
    applyRemoteNotes(live, [ws(2), ws(1), ws(1)]);
    expect(times(live)).toEqual([2, 1, 1]);
    expect(live.Ann.direct).toBe(false);
  });

  test('placeNote from an empty list', () => {
    const live: HitNotesByPlayer = Object.create(null);
    applyRemoteNotes(live, []);
    applyDirectNote(live, 'Ann', 0, 1, 1);
    expect(placeNote(live.Ann, { videoTime: 1, freq: 0 })).toMatchObject({ videoTime: 1 });
  });
});
