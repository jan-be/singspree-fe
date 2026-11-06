/**
 * A short way for a singer's notes to the big screen.
 *
 * A note goes phone → server → host's page: twice the way to the server, which
 * at home in Germany is 50 ms and from abroad far more, even when the phone and
 * the screen stand in one room. So the host's page opens a WebRTC data channel
 * to each singer it shows, unordered and without retransmits, and the phone
 * sends every note a second time down it. The page draws whichever comes first
 * and drops the other (placeNote, MicInputToTick.ts).
 *
 * For the drawing only. The socket keeps carrying every note: the server scores
 * those, everyone else's screen shows those, and a note lost on the short way
 * still arrives by the long one. So a link that never comes up, or that fails
 * in the middle of a song, changes nothing anyone can see: there is no state of
 * it in the interface, no prompt (a data channel needs no permission) and no
 * second try while a song is going wrong.
 *
 * Who talks to whom:
 *
 *   - The host's page is the only peer, and it starts: it offers a link to a
 *     singer when that singer's notes come in over the socket. Past the lanes
 *     only the shown singers' notes do (laneDisplay.ts on the server), so a
 *     crowd costs no more than its lanes (MAX_LINKS). A phone needs no setting
 *     and does nothing until asked.
 *   - The setup goes through rtc:signal like the voices' (voiceLink.ts). Its
 *     link ids begin with NOTE_LINK, so nothing about it is new to the server,
 *     which relays it only in a party that allows voices. That also decides the
 *     relay: TURN credentials are the server's to give (rtc:ice), this takes
 *     what it was given. Without TURN a house whose devices cannot reach each
 *     other simply stays on the socket.
 *   - A link ends when no notes have come in for a while (IDLE_MS: the song is
 *     over or stopped), with the party, or when the singer leaves.
 *
 * What a page learns of the other: only private addresses and relay addresses
 * cross (privateCandidate). A singer's page does not ask for this, so it must
 * not tell the host's page where it is.
 *
 * Each link reports (rtc:report, the `voice_link` events, link ids beginning
 * with NOTE_LINK) when it opens: how, and how long that took; and when it ends:
 * how many notes came down it first, how many were lost on it, and by how much
 * it beat the socket. That is what tells whether this earns its keep.
 *
 * Off unless the host's page asks: ?directnotes in its address (noteLinkWanted).
 */
import { countKind, newNotes, noteState, notePeak, pairSummary, routeOf, watchPairs } from './voiceLink';
import { randomId } from './sessionId';
import type { HitNote } from './MicInputToTick';
import type { TryNotes, VoiceReport, VoiceSignal } from './voiceLink';

/** A note link's id begins with this: everything else on rtc:signal is a voice's */
export const NOTE_LINK = 'n_';
export const isNoteLink = (link: string) => link.startsWith(NOTE_LINK);

/** How many singers at a time: the lanes (laneDisplay.ts on the server) */
export const MAX_LINKS = 8;

const KEY = 'singspree_direct_notes';

/**
 * Whether this tab tries the short way: ?directnotes turns it on for the tab
 * (it survives moving on to the next song), ?directnotes=0 off again.
 */
export function noteLinkWanted(search: string = globalThis.location?.search ?? ''): boolean {
  try {
    const asked = new URLSearchParams(search).get('directnotes');
    if (asked !== null) sessionStorage.setItem(KEY, asked === '0' ? '0' : '1');
    return sessionStorage.getItem(KEY) === '1';
  } catch { return false; }
}

/**
 * Whether a candidate may cross to the other page: private addresses (the
 * same room) and relays, never a public one. A public address says where
 * someone is, a srflx candidate and a phone's IPv6 host candidate both.
 */
export function privateCandidate(candidate: string | undefined): boolean {
  const f = (candidate ?? '').replace(/^a=/, '').trim().split(/\s+/);
  const typ = f[f.indexOf('typ') + 1];
  if (typ === 'relay') return true;
  if (typ !== 'host') return false;
  const address = (f[4] ?? '').toLowerCase();
  return address.endsWith('.local')
    || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(address)
    || /^(f[cd]|fe[89ab])[0-9a-f]{0,2}:/.test(address);
}

/** A note on the channel: [freq f32 LE][videoTime f32 LE], the same floats the socket carries, so the two can be matched */
export const NOTE_BYTES = 8;

/** The parts of an RTCPeerConnection these use (a fake one in tests) */
export type NotePeer = Pick<RTCPeerConnection,
  'createDataChannel' | 'createOffer' | 'createAnswer' | 'setLocalDescription' | 'setRemoteDescription' | 'addIceCandidate' | 'close' | 'getStats'
  | 'connectionState' | 'remoteDescription'> & {
  onicecandidate: ((e: { candidate: RTCIceCandidate | null }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  ondatachannel: ((e: { channel: RTCDataChannel }) => void) | null;
};

/** How a link did, for its report: what came down it, and what the socket did meanwhile */
export interface NoteCounts {
  /** notes this link brought first */
  first: number;
  /** notes the socket brought first (they came down the link later) */
  socketFirst: number;
  /** notes the socket brought while the link was open and had not: all but `socketFirst` of them were lost on it */
  socketOnly: number;
  /** how long before the socket the link brought a note: how many in each of LEAD_MS's bins */
  lead: number[];
  /** the singer's page: notes sent, and turned away because the channel was backing up */
  sent?: number;
  dropped?: number;
}

/** The upper ends of the `lead` bins, ms (the last bin is the rest) */
export const LEAD_MS = [5, 10, 20, 40, 80, 160, 320];

export type NoteReport = VoiceReport & { singer?: string; notes?: NoteCounts };

interface LinkOptions {
  /** the STUN/TURN servers the party server named (rtc:ice) */
  iceServers: () => RTCIceServer[];
  /** through the TURN relay only (?voicerelay) */
  relayOnly?: boolean;
  log?: (line: string) => void;
  report?: (report: NoteReport) => void;
  /** for tests */
  peer?: (config: RTCConfiguration) => NotePeer;
}

const makePeer = (config: RTCConfiguration) => new RTCPeerConnection(config) as unknown as NotePeer;

// How long a singer's page may take to answer, and then ICE to find a way. Short: while a link is coming up nothing
// waits for it, and past these the notes are better off on the socket for the rest of the song.
const ANSWER_TIMEOUT_MS = 6_000;
const CONNECT_TIMEOUT_MS = 15_000;
const DISCONNECTED_MS = 4_000;     // 'disconnected' often comes back by itself (a Wi-Fi hiccup)
const IDLE_MS = 20_000;            // nobody sang for this long: the song is over or stopped
const SWEEP_MS = 5_000;
const OFFER_GAP_MS = 300;          // one at a time: rtc:signal allows a burst of 60, and a link's setup takes about ten
const FAILS_ALLOWED = 3;           // a singer's links that failed before this page stops trying them
const RETRY_AFTER_MS = 60_000;     // ...and the wait after each
const MAX_NOTES_PER_S = 200;       // a phone sends 33; more than this is no phone, and it goes straight to the host's main thread
const MAX_BUFFERED = 2_048;        // the singer's page: a channel that backs up has nothing left to win

/** A route read late is better than one read at the start, unless it is gone by then */
const withoutNulls = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null)) as Partial<T>;

const emptyCounts = (): NoteCounts => ({ first: 0, socketFirst: 0, socketOnly: 0, lead: LEAD_MS.map(() => 0).concat(0) });

/** The host's page: one link per singer shown */
export interface NoteReceiver {
  /** the party allows it (voices on): off ends every link */
  setEnabled(on: boolean): void;
  /**
   * A singer's note came over the socket: the first one starts a link. `there`
   * is the same note if the link had brought it already (placeNote).
   */
  socketNote(name: string, there: HitNote | null): void;
  handleSignal(from: string, signal: VoiceSignal): void;
  /** the singer left the party */
  drop(name: string): void;
  /** the singer's account was renamed (player:renamed) */
  rename(from: string, to: string): void;
  /** for the ?debug panel */
  debugLines(): string[];
  close(): void;
}

interface Link {
  name: string;
  id: string;
  pc: NotePeer;
  channel: RTCDataChannel;
  open: boolean;
  pending: RTCIceCandidateInit[];
  notes: TryNotes;
  counts: NoteCounts;
  /** when the socket last brought this singer's note */
  seenAt: number;
  watch: ReturnType<typeof setTimeout> | null;
  stopPairs: (() => void) | null;
  route: string | null;
  rttMs: number | null;
  /** the rate limit's count and the second it is for */
  burst: number;
  burstAt: number;
}

export function createNoteReceiver({ send, onNote, iceServers, relayOnly = false, log = () => {}, report = () => {}, peer = makePeer }: LinkOptions & {
  /** sends a signal to a singer's page (rtc:signal); false while the party socket is down */
  send: (to: string, signal: VoiceSignal) => boolean;
  /** a note came down a link: into the live store. Returns whether it was there already (the socket was first) */
  onNote: (name: string, freq: number, videoTime: number) => boolean;
}): NoteReceiver {
  const links = new Map<string, Link>();
  /** singers whose links failed: how often, and not again before when */
  const backoff = new Map<string, { fails: number; notBefore: number }>();
  const waiting: string[] = [];
  let enabled = false;
  let offerAt = -Infinity;
  let pump: ReturnType<typeof setTimeout> | null = null;
  let sweep: ReturnType<typeof setInterval> | null = null;

  const reportOf = (link: Link, result: VoiceReport['result']) => ({
    link: link.id, side: 'host' as const, result, ms: Math.round(performance.now() - link.notes.t0), answered: link.notes.answered,
    local: link.notes.local, remote: link.notes.remote, states: link.notes.states.join(' '), peak: link.notes.peak, singer: link.name, route: link.route, rttMs: link.rttMs,
  });

  const finish = (link: Link, how: VoiceReport['result'] | null, bye: boolean) => {
    if (links.get(link.name) !== link) return;
    links.delete(link.name);
    if (link.watch) clearTimeout(link.watch);
    link.stopPairs?.();
    link.pc.onicecandidate = null;
    link.pc.onconnectionstatechange = null;
    link.channel.onmessage = null;
    link.channel.onopen = null;
    link.channel.onclose = null;
    if (bye) send(link.name, { link: link.id, bye: true });
    if (how !== 'connected') {
      const b = backoff.get(link.name) ?? { fails: 0, notBefore: 0 };
      b.fails++;
      b.notBefore = performance.now() + RETRY_AFTER_MS * b.fails;
      backoff.set(link.name, b);
    }
    const close = () => { try { link.pc.close(); } catch { /* already */ } };
    const base = { ...reportOf(link, how ?? 'connected'), notes: link.counts };
    link.pc.getStats().then(stats => report({ ...base, pairs: pairSummary(stats), ...withoutNulls(routeOf(stats)) }), () => report({ ...base, pairs: null })).finally(close);
    log(`${link.name}: ended (${how ?? 'connected'}) first=${link.counts.first} socketFirst=${link.counts.socketFirst} socketOnly=${link.counts.socketOnly}`);
    if (!links.size && sweep) { clearInterval(sweep); sweep = null; }
  };

  const start = (name: string) => {
    const id = NOTE_LINK + randomId();
    const notes = newNotes();
    let pc: NotePeer, channel: RTCDataChannel;
    try {
      pc = peer({ iceServers: iceServers(), bundlePolicy: 'max-bundle', ...(relayOnly ? { iceTransportPolicy: 'relay' as const } : {}) });
      channel = pc.createDataChannel('notes', { ordered: false, maxRetransmits: 0 });
    } catch (e) {
      // no WebRTC on this browser at all: nothing to try, ever
      log(`no data channel here (${e instanceof Error ? e.message : e})`);
      enabled = false;
      return;
    }
    channel.binaryType = 'arraybuffer';
    const link: Link = { name, id, pc, channel, open: false, pending: [], notes, counts: emptyCounts(), seenAt: performance.now(), watch: null, stopPairs: null, route: null, rttMs: null, burst: 0, burstAt: 0 };
    links.set(name, link);
    noteState(notes, 'new');
    const gone = () => links.get(link.name) !== link;

    channel.onopen = () => {
      if (gone()) return;
      link.open = true;
      backoff.delete(link.name);
      if (link.watch) { clearTimeout(link.watch); link.watch = null; }
      link.stopPairs?.();
      link.stopPairs = null;
      noteState(notes, 'open');
      log(`${link.name}: open`);
      pc.getStats().then(stats => {
        Object.assign(link, routeOf(stats));
        notePeak(notes, pairSummary(stats));
        report({ ...reportOf(link, 'connected'), pairs: pairSummary(stats) });
      }, () => {});
    };
    channel.onclose = () => { if (!gone()) finish(link, link.open ? 'connected' : 'no_path', false); };
    channel.onmessage = ({ data }: MessageEvent) => {
      if (!(data instanceof ArrayBuffer) || data.byteLength !== NOTE_BYTES) return;
      const now = performance.now();
      if (now - link.burstAt > 1000) { link.burstAt = now; link.burst = 0; }
      if (++link.burst > MAX_NOTES_PER_S) {
        finish(link, 'connected', true);
        backoff.set(link.name, { fails: FAILS_ALLOWED, notBefore: 0 }); // not for this page again
        return;
      }
      const v = new DataView(data);
      const freq = v.getFloat32(0, true), videoTime = v.getFloat32(4, true);
      if (!(freq >= 0 && freq < 20_000) || !Number.isFinite(videoTime)) return;
      if (onNote(link.name, freq, videoTime)) link.counts.socketFirst++;
      else link.counts.first++;
    };
    pc.onicecandidate = ({ candidate }) => {
      if (gone()) return;
      if (candidate && !privateCandidate(candidate.candidate)) return;
      if (candidate) countKind(notes.local, candidate.candidate);
      send(link.name, { link: id, candidate: candidate ? candidate.toJSON() : null });
    };
    pc.onconnectionstatechange = () => {
      if (gone()) return;
      const s = pc.connectionState;
      noteState(notes, s);
      if (s === 'failed') finish(link, link.open ? 'connected' : 'no_path', true);
      else if (s === 'disconnected') {
        if (link.watch) clearTimeout(link.watch);
        link.watch = setTimeout(() => { if (!gone() && pc.connectionState !== 'connected') finish(link, link.open ? 'connected' : 'no_path', true); }, DISCONNECTED_MS);
      }
    };
    link.watch = setTimeout(() => { if (!gone() && !notes.answered) finish(link, 'no_answer', true); }, ANSWER_TIMEOUT_MS);
    sweep ??= setInterval(() => {
      const now = performance.now();
      for (const l of [...links.values()]) if (now - l.seenAt > IDLE_MS) finish(l, l.open ? 'connected' : 'no_path', true);
    }, SWEEP_MS);
    pc.createOffer()
      .then(offer => {
        if (gone()) return undefined;
        return pc.setLocalDescription(offer).then(() => {
          if (!gone() && !send(link.name, { link: id, description: { type: 'offer', sdp: offer.sdp ?? '' } })) finish(link, 'no_answer', false);
        });
      })
      .catch(e => { log(`${link.name}: offer failed (${e instanceof Error ? e.message : e})`); finish(link, 'no_path', false); });
  };

  const next = () => {
    pump = null;
    while (enabled && waiting.length) {
      const wait = offerAt + OFFER_GAP_MS - performance.now();
      if (wait > 0) { pump = setTimeout(next, wait); return; }
      const name = waiting.shift() as string;
      if (links.has(name)) continue;
      // Full: the lanes moved on, and the singer whose notes stopped coming longest ago makes room
      if (links.size >= MAX_LINKS) {
        const quietest = [...links.values()].sort((a, b) => a.seenAt - b.seenAt)[0];
        if (performance.now() - quietest.seenAt < 5_000) continue;
        finish(quietest, 'connected', true);
      }
      offerAt = performance.now();
      start(name);
    }
  };

  return {
    setEnabled(on) {
      if (on === enabled) return;
      enabled = on;
      if (on) return;
      waiting.length = 0;
      for (const l of [...links.values()]) finish(l, 'connected', true);
    },
    socketNote(name, there) {
      const link = links.get(name);
      if (link) {
        link.seenAt = performance.now();
        if (!link.open) return;
        if (there?.at === undefined) { if (!there) link.counts.socketOnly++; return; }
        const lead = link.seenAt - there.at;
        const bin = LEAD_MS.findIndex(ms => lead < ms);
        link.counts.lead[bin < 0 ? LEAD_MS.length : bin]++;
        return;
      }
      if (!enabled || waiting.includes(name)) return;
      const b = backoff.get(name);
      if (b && (b.fails >= FAILS_ALLOWED || performance.now() < b.notBefore)) return;
      waiting.push(name);
      if (!pump) next();
    },
    handleSignal(from, signal) {
      const link = links.get(from);
      if (!link || link.id !== signal.link) return; // an older link's
      if (signal.bye) { finish(link, link.open ? 'connected' : link.notes.answered ? 'no_path' : 'no_answer', false); return; }
      if (signal.description?.type === 'answer') {
        link.notes.answered = true;
        noteState(link.notes, 'answered');
        if (link.watch) clearTimeout(link.watch);
        link.watch = setTimeout(() => { if (links.get(from) === link && !link.open) finish(link, 'no_path', true); }, CONNECT_TIMEOUT_MS);
        link.stopPairs = watchPairs(link.pc, link.notes);
        link.pc.setRemoteDescription(signal.description)
          .then(() => {
            const queued = link.pending;
            link.pending = [];
            for (const c of queued) link.pc.addIceCandidate(c).catch(() => {});
          })
          .catch(() => { if (links.get(from) === link) finish(link, 'no_path', true); });
      } else if (signal.candidate) {
        countKind(link.notes.remote, signal.candidate.candidate);
        if (link.pc.remoteDescription) link.pc.addIceCandidate(signal.candidate).catch(() => {});
        else link.pending.push(signal.candidate);
      }
    },
    drop(name) {
      const link = links.get(name);
      if (link) finish(link, link.open ? 'connected' : null, false);
      backoff.delete(name);
    },
    rename(from, to) {
      const link = links.get(from);
      if (link) { links.delete(from); link.name = to; links.set(to, link); }
    },
    debugLines() {
      return [...links.values()].map(l => `notes ${l.name}: ${l.open ? 'open' : 'connecting'}${l.route ? ` ${l.route}` : ''}${l.rttMs !== null ? ` rtt=${l.rttMs}ms` : ''} first=${l.counts.first} socketFirst=${l.counts.socketFirst} socketOnly=${l.counts.socketOnly}`);
    },
    close() {
      enabled = false;
      waiting.length = 0;
      if (pump) { clearTimeout(pump); pump = null; }
      for (const l of [...links.values()]) finish(l, 'connected', true);
      backoff.clear();
    },
  };
}

/** A singer's page: answers the host's page, then sends each note down the channel as well */
export interface NoteSender {
  /** a note, when there is a way: nothing at all happens when there is none */
  note(freq: number, videoTime: number): void;
  handleSignal(signal: VoiceSignal): void;
  /** the host's page is gone (a reload, a lost connection): what it had went with it */
  hostGone(): void;
  close(): void;
}

export function createNoteSender({ send, iceServers, relayOnly = false, log = () => {}, report = () => {}, peer = makePeer }: LinkOptions & {
  /** sends a signal to the host's page (rtc:signal); false while the party socket is down */
  send: (signal: VoiceSignal) => boolean;
}): NoteSender {
  let pc: NotePeer | null = null;
  let channel: RTCDataChannel | null = null;
  let id: string | null = null;
  let notes: TryNotes = newNotes();
  let pending: RTCIceCandidateInit[] = [];
  let watch: ReturnType<typeof setTimeout> | null = null;
  let sent = 0, dropped = 0;
  // the one buffer every note goes out of: 33 a second, on the main thread, while the singer sings
  const buffer = new ArrayBuffer(NOTE_BYTES);
  const view = new DataView(buffer);

  const stop = (bye: boolean, why: 'no_path' | null) => {
    if (watch) clearTimeout(watch);
    watch = null;
    const conn = pc, link = id, tried = notes;
    if (!conn || !link) return;
    if (bye) send({ link, bye: true });
    conn.onicecandidate = null;
    conn.onconnectionstatechange = null;
    conn.ondatachannel = null;
    pc = null;
    channel = null;
    id = null;
    pending = [];
    const close = () => { try { conn.close(); } catch { /* already */ } };
    const base = { link, side: 'singer' as const, result: why ?? 'connected' as const, ms: Math.round(performance.now() - tried.t0), answered: true,
      local: tried.local, remote: tried.remote, states: tried.states.join(' '), peak: tried.peak, notes: { ...emptyCounts(), sent, dropped } };
    conn.getStats().then(stats => report({ ...base, pairs: pairSummary(stats), ...routeOf(stats) }), () => report({ ...base, pairs: null })).finally(close);
  };

  const start = (signal: VoiceSignal) => {
    stop(true, null);
    let conn: NotePeer;
    try {
      conn = peer({ iceServers: iceServers(), bundlePolicy: 'max-bundle', ...(relayOnly ? { iceTransportPolicy: 'relay' as const } : {}) });
    } catch (e) {
      log(`no RTCPeerConnection (${e instanceof Error ? e.message : e})`);
      send({ link: signal.link, bye: true });
      return;
    }
    const link = signal.link;
    pc = conn;
    id = link;
    notes = newNotes();
    sent = dropped = 0;
    const tried = notes;
    noteState(tried, 'new');
    conn.ondatachannel = ({ channel: c }) => {
      if (pc !== conn) return;
      channel = c;
      c.onopen = () => {
        noteState(tried, 'open');
        log('notes: open');
      };
    };
    conn.onicecandidate = ({ candidate }) => {
      if (pc !== conn) return;
      if (candidate && !privateCandidate(candidate.candidate)) return;
      if (candidate) countKind(tried.local, candidate.candidate);
      send({ link, candidate: candidate ? candidate.toJSON() : null });
    };
    conn.onconnectionstatechange = () => {
      if (pc !== conn) return;
      const s = conn.connectionState;
      noteState(tried, s);
      if (s === 'connected') {
        if (watch) { clearTimeout(watch); watch = null; }
      } else if (s === 'failed' || s === 'closed') {
        stop(false, tried.states.some(x => x.startsWith('connected@')) ? null : 'no_path');
      } else if (s === 'disconnected') {
        if (watch) clearTimeout(watch);
        watch = setTimeout(() => { if (pc === conn && conn.connectionState !== 'connected') stop(false, null); }, DISCONNECTED_MS);
      }
    };
    watch = setTimeout(() => { if (pc === conn && conn.connectionState !== 'connected') stop(true, 'no_path'); }, CONNECT_TIMEOUT_MS);
    conn.setRemoteDescription(signal.description as RTCSessionDescriptionInit)
      .then(() => {
        const queued = pending;
        pending = [];
        for (const c of queued) conn.addIceCandidate(c).catch(() => {});
        return conn.createAnswer();
      })
      .then(answer => {
        if (pc !== conn) return undefined;
        return conn.setLocalDescription(answer).then(() => {
          if (pc === conn) send({ link, description: { type: 'answer', sdp: answer.sdp ?? '' } });
        });
      })
      .catch(e => {
        log(`notes: answer failed (${e instanceof Error ? e.message : e})`);
        if (pc === conn) stop(true, 'no_path');
      });
  };

  return {
    note(freq, videoTime) {
      if (channel?.readyState !== 'open') return;
      if (channel.bufferedAmount > MAX_BUFFERED) { dropped++; return; }
      view.setFloat32(0, freq, true);
      view.setFloat32(4, videoTime, true);
      try {
        channel.send(buffer);
        sent++;
      } catch { /* closing: the socket has this note */ }
    },
    handleSignal(signal) {
      if (signal.description?.type === 'offer') { start(signal); return; }
      if (signal.link !== id || !pc) return; // an older link's
      if (signal.bye) { stop(false, null); return; }
      if (signal.candidate) {
        countKind(notes.remote, signal.candidate.candidate);
        if (pc.remoteDescription) pc.addIceCandidate(signal.candidate).catch(() => {});
        else pending.push(signal.candidate);
      }
    },
    hostGone() { stop(false, null); },
    close() { stop(true, null); },
  };
}
