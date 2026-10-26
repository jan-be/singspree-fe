import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { candidateKind, createVoiceLink, pairSummary, routeOf, tuneOpusAnswer, OPUS_PARAMS } from './voiceLink';
import type { VoicePeer, VoiceReport, VoiceSignal } from './voiceLink';

const ANSWER = [
  'v=0', 'o=- 1 2 IN IP4 127.0.0.1', 's=-', 't=0 0',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111 63 9', 'c=IN IP4 0.0.0.0',
  'a=rtpmap:111 opus/48000/2', 'a=fmtp:111 minptime=10;useinbandfec=1', 'a=rtpmap:63 red/48000/2', 'a=rtpmap:9 G722/8000',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0', '',
].join('\r\n');

describe('tuneOpusAnswer', () => {
  test("sets the Opus parameters on the answer's fmtp line and asks for 10 ms packets in the audio section only", () => {
    const out = tuneOpusAnswer(ANSWER).split('\r\n');
    const fmtp = out.find(l => l.startsWith('a=fmtp:111 '));
    expect(fmtp).toBeDefined();
    const params = Object.fromEntries(fmtp!.slice('a=fmtp:111 '.length).split(';').map(p => p.split('=')));
    expect(params).toEqual(OPUS_PARAMS);
    expect(out.filter(l => l === 'a=ptime:10')).toHaveLength(1);
    expect(out.indexOf('a=ptime:10')).toBeLessThan(out.findIndex(l => l.startsWith('m=application')));
    expect(out.at(-1)).toBe(''); // still ends in a line break
    expect(out.filter(l => l.startsWith('a=rtpmap'))).toHaveLength(3);
  });

  test('adds an fmtp line where there was none, replaces a ptime, and leaves an SDP without Opus alone', () => {
    const noFmtp = ANSWER.replace('a=fmtp:111 minptime=10;useinbandfec=1\r\n', 'a=ptime:20\r\n');
    const out = tuneOpusAnswer(noFmtp);
    expect(out).toContain('a=fmtp:111 minptime=10;useinbandfec=1;usedtx=0;stereo=0;sprop-stereo=0;maxaveragebitrate=64000');
    expect(out).toContain('a=ptime:10');
    expect(out).not.toContain('a=ptime:20');
    const pcmu = 'v=0\nm=audio 9 RTP/AVP 0\na=rtpmap:0 PCMU/8000\n';
    expect(tuneOpusAnswer(pcmu)).toBe(pcmu);
  });
});

describe('routeOf', () => {
  const report = (entries: Record<string, Record<string, unknown>>) => {
    const map = new Map(Object.entries(entries));
    return { get: (id: string) => map.get(id), forEach: (fn: (v: Record<string, unknown>) => void) => map.forEach(v => fn(v)) } as unknown as RTCStatsReport;
  };
  test('the selected pair: relay wins over the rest, and its round trip', () => {
    expect(routeOf(report({
      t: { type: 'transport', selectedCandidatePairId: 'p' },
      p: { type: 'candidate-pair', localCandidateId: 'l', remoteCandidateId: 'r', currentRoundTripTime: 0.012 },
      l: { type: 'local-candidate', candidateType: 'host' },
      r: { type: 'remote-candidate', candidateType: 'relay' },
    }))).toEqual({ route: 'relay', rttMs: 12 });
    expect(routeOf(report({
      p: { type: 'candidate-pair', nominated: true, state: 'succeeded', localCandidateId: 'l', remoteCandidateId: 'r' },
      l: { type: 'local-candidate', candidateType: 'host' },
      r: { type: 'remote-candidate', candidateType: 'host' },
    }))).toEqual({ route: 'host', rttMs: null });
    expect(routeOf(report({}))).toEqual({ route: null, rttMs: null });
  });
});

/** A stand-in RTCPeerConnection: what the link did to it, and the test playing the network */
class FakePeer {
  connectionState: RTCPeerConnectionState = 'new';
  remoteDescription: RTCSessionDescription | null = null;
  onicecandidate: VoicePeer['onicecandidate'] = null;
  onconnectionstatechange: VoicePeer['onconnectionstatechange'] = null;
  closed = false;
  sent: (MediaStreamTrack | null)[] = [];
  candidates: (RTCIceCandidateInit | undefined)[] = [];
  transceiverInit: RTCRtpTransceiverInit | undefined;
  addTransceiver(_kind: string, init?: RTCRtpTransceiverInit) {
    this.transceiverInit = init;
    const sent = this.sent;
    return { sender: { replaceTrack: async (t: MediaStreamTrack | null) => { sent.push(t); } }, setCodecPreferences: () => {} } as unknown as RTCRtpTransceiver;
  }
  async createOffer() { return { type: 'offer', sdp: 'offer-sdp' } as RTCSessionDescriptionInit; }
  async setLocalDescription() {}
  async setRemoteDescription(d: RTCSessionDescriptionInit) { this.remoteDescription = d as RTCSessionDescription; }
  async addIceCandidate(c?: RTCIceCandidateInit) { this.candidates.push(c); }
  close() { this.closed = true; this.connectionState = 'closed'; }
  async getStats() { return new Map() as unknown as RTCStatsReport; }
  state(s: RTCPeerConnectionState) { this.connectionState = s; this.onconnectionstatechange?.(); }
}

/** A stand-in track: clones that know whether they were stopped */
const fakeTrack = () => {
  const clones: { enabled: boolean; stopped: boolean; stop(): void }[] = [];
  const track = {
    clones,
    clone() { const c = { enabled: true, stopped: false, stop() { this.stopped = true; } }; clones.push(c); return c; },
  };
  return track as unknown as MediaStreamTrack & { clones: typeof clones };
};

describe('createVoiceLink', () => {
  let peers: FakePeer[];
  let signals: VoiceSignal[];
  let up: boolean;
  const make = () => createVoiceLink({
    send: s => { signals.push(s); return up; },
    iceServers: () => [{ urls: ['stun:example.org:3478'] }],
    peer: () => { const p = new FakePeer(); peers.push(p); return p as unknown as VoicePeer; },
  });
  const flush = () => new Promise(r => setTimeout(r, 0));
  beforeEach(() => { peers = []; signals = []; up = true; vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => vi.useRealTimers());

  test('connects once wanted and a microphone is there, sending a copy that follows play and pause', async () => {
    const link = make();
    const track = fakeTrack();
    link.setTrack(track);
    expect(peers).toHaveLength(0);
    link.setWanted(true);
    await flush();
    expect(peers).toHaveLength(1);
    expect(link.state.phase).toBe('connecting');
    expect(peers[0].transceiverInit?.direction).toBe('sendonly');
    expect(peers[0].sent[0]).toBe(track.clones[0]);
    expect(track.clones[0].enabled).toBe(false); // nothing plays yet
    link.setActive(true);
    expect(track.clones[0].enabled).toBe(true);
    const offer = signals.find(s => s.description);
    expect(offer?.description).toEqual({ type: 'offer', sdp: 'offer-sdp' });

    // the host's candidate before its answer waits; then the answer, and the connection
    link.handleSignal({ link: offer!.link, candidate: { candidate: 'c1' } });
    expect(peers[0].candidates).toEqual([]);
    link.handleSignal({ link: offer!.link, description: { type: 'answer', sdp: 'answer-sdp' } });
    await flush();
    expect(peers[0].candidates).toEqual([{ candidate: 'c1' }]);
    link.handleSignal({ link: 'someone-else', candidate: { candidate: 'c2' } });
    expect(peers[0].candidates).toHaveLength(1);
    peers[0].state('connected');
    expect(link.state.phase).toBe('on');

    // the microphone closes (standby): the connection stays, the copy is stopped
    link.setTrack(null);
    expect(track.clones[0].stopped).toBe(true);
    expect(peers[0].sent.at(-1)).toBe(null);
    expect(peers[0].closed).toBe(false);
    // not wanted: a bye, and down
    link.setWanted(false);
    expect(signals.at(-1)).toEqual({ link: offer!.link, bye: true });
    expect(peers[0].closed).toBe(true);
    expect(link.state.phase).toBe('off');
  });

  test('a failed connection is tried again later, a bye from the host page after a while, and at once when it is back', async () => {
    const link = make();
    link.setTrack(fakeTrack());
    link.setWanted(true);
    await flush();
    peers[0].state('failed');
    expect(signals.at(-1)?.bye).toBe(true);
    await flush(); // (closed once its stats are read for the report)
    expect(peers[0].closed).toBe(true);
    await vi.advanceTimersByTimeAsync(2_100);
    expect(peers).toHaveLength(2);
    peers[1].state('failed');
    expect(link.state.phase).toBe('failed'); // twice in a row: the mic panel says so
    await vi.advanceTimersByTimeAsync(5_100);
    expect(peers).toHaveLength(3);

    const offer = signals.filter(s => s.description).at(-1)!;
    link.handleSignal({ link: offer.link, bye: true });
    expect(peers[2].closed).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(peers).toHaveLength(3);
    link.hostBack();
    await flush();
    expect(peers).toHaveLength(4);
  });

  test('no answer from the host page in 10 s ends the try; close() stops the copy for good', async () => {
    const link = make();
    const track = fakeTrack();
    link.setTrack(track);
    link.setWanted(true);
    await flush();
    await vi.advanceTimersByTimeAsync(10_100);
    expect(peers[0].closed).toBe(true);
    expect(link.state.reason).toBe('no_answer');
    link.close();
    expect(track.clones.every(c => c.stopped)).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(peers).toHaveLength(1);
  });

  test('each try is reported: no answer, or answered and no way through after ICE had its time; with the candidate kinds', async () => {
    const reports: VoiceReport[] = [];
    const link = createVoiceLink({
      send: s => { signals.push(s); return true; },
      iceServers: () => [],
      report: r => reports.push(r),
      peer: () => { const p = new FakePeer(); peers.push(p); return p as unknown as VoicePeer; },
    });
    const local = (c: string) => ({ candidate: c, toJSON: () => ({ candidate: c, sdpMid: '0', sdpMLineIndex: 0 }) }) as unknown as RTCIceCandidate;
    link.setTrack(fakeTrack());
    link.setWanted(true);
    await flush();
    peers[0].onicecandidate?.({ candidate: local('candidate:1 1 udp 2122260223 192.168.1.5 50000 typ host generation 0') });
    peers[0].onicecandidate?.({ candidate: local('candidate:2 1 udp 1686052607 203.0.113.9 50000 typ srflx raddr 192.168.1.5 rport 50000') });
    await vi.advanceTimersByTimeAsync(10_100);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ side: 'singer', result: 'no_answer', answered: false, local: { 'host/udp/v4': 1, 'srflx/udp/v4': 1 }, remote: {} });
    expect(link.state).toMatchObject({ phase: 'connecting', reason: 'no_answer' });

    await vi.advanceTimersByTimeAsync(2_100); // the next try
    expect(peers).toHaveLength(2);
    const offer = signals.filter(s => s.description).at(-1)!;
    link.handleSignal({ link: offer.link, description: { type: 'answer', sdp: 'answer' } });
    link.handleSignal({ link: offer.link, candidate: { candidate: 'candidate:3 1 udp 2122260223 4b1c2d3e-aaaa.local 61000 typ host generation 0', sdpMid: '0' } });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(reports).toHaveLength(1); // answered: ICE gets longer than the answer did
    await vi.advanceTimersByTimeAsync(5_100);
    expect(reports[1]).toMatchObject({ result: 'no_path', answered: true, remote: { 'host/udp/mdns': 1 } });
    expect(reports[1].states).toMatch(/^new@0 answered@\d+$/);
    expect(link.state).toMatchObject({ phase: 'failed', reason: 'no_path' });
    link.close();
  });
});

describe('candidateKind and pairSummary', () => {
  test('a candidate as type/protocol/family, the address only as its family', () => {
    expect(candidateKind('candidate:1 1 udp 2122260223 192.168.1.5 50000 typ host generation 0')).toBe('host/udp/v4');
    expect(candidateKind('a=candidate:1 1 TCP 1518280447 2a02:810d::1 9 typ host tcptype active')).toBe('host/tcp/v6');
    expect(candidateKind('candidate:1 1 udp 2122260223 0d8a1f2e-0000-4c1b.local 50000 typ host')).toBe('host/udp/mdns');
    expect(candidateKind('candidate:9 1 udp 41885439 198.51.100.4 3478 typ relay raddr 0.0.0.0 rport 0')).toBe('relay/udp/v4');
    expect(candidateKind('')).toBe(null);
    expect(candidateKind(undefined)).toBe(null);
  });
  test('the pairs by state, and the checks each way', () => {
    const stats = new Map(Object.entries({
      a: { type: 'candidate-pair', state: 'failed', requestsSent: 9, responsesReceived: 0, requestsReceived: 0, responsesSent: 0 },
      b: { type: 'candidate-pair', state: 'in-progress', requestsSent: 3, responsesReceived: 0, requestsReceived: 2, responsesSent: 2 },
      c: { type: 'candidate-pair', state: 'frozen' },
      t: { type: 'transport' },
    })) as unknown as RTCStatsReport;
    expect(pairSummary(stats)).toEqual({ total: 3, succeeded: 0, failed: 1, inProgress: 1, waiting: 1, requestsSent: 12, responsesReceived: 0, requestsReceived: 2, responsesSent: 2 });
  });
});
