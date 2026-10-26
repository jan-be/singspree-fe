import { describe, expect, test } from 'vitest';
import { createVoiceMixer } from './voiceMixer';
import { canMixLocally } from './usePartyVoices';
import type { MixerPeer } from './voiceMixer';
import type { VoiceSignal } from './voiceLink';

/** A stand-in RTCPeerConnection on the answering side */
class FakePeer {
  connectionState: RTCPeerConnectionState = 'new';
  remoteDescription: RTCSessionDescriptionInit | null = null;
  local: RTCSessionDescriptionInit | null = null;
  onicecandidate: MixerPeer['onicecandidate'] = null;
  onconnectionstatechange: MixerPeer['onconnectionstatechange'] = null;
  ontrack: MixerPeer['ontrack'] = null;
  closed = false;
  candidates: (RTCIceCandidateInit | undefined)[] = [];
  async setRemoteDescription(d: RTCSessionDescriptionInit) { this.remoteDescription = d; }
  async createAnswer() { return { type: 'answer', sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10\r\n' } as RTCSessionDescriptionInit; }
  async setLocalDescription(d: RTCSessionDescriptionInit) { this.local = d; }
  async addIceCandidate(c?: RTCIceCandidateInit) { this.candidates.push(c); }
  close() { this.closed = true; }
  async getStats() { return new Map() as unknown as RTCStatsReport; }
  state(s: RTCPeerConnectionState) { this.connectionState = s; this.onconnectionstatechange?.(); }
}

const flush = () => new Promise(r => setTimeout(r, 0));

const setup = () => {
  const peers: FakePeer[] = [];
  const sent: { to: string; signal: VoiceSignal }[] = [];
  const held: MediaStream[] = [];
  const mixer = createVoiceMixer({
    send: (to, signal) => { sent.push({ to, signal }); return true; },
    iceServers: () => [],
    peer: () => { const p = new FakePeer(); peers.push(p); return p as unknown as MixerPeer; },
    holdStream: stream => { held.push(stream); return () => { held.splice(held.indexOf(stream), 1); }; },
  });
  return { mixer, peers, sent, held };
};
const OFFER: VoiceSignal = { link: 'l1', description: { type: 'offer', sdp: 'offer' } };

describe('createVoiceMixer: connections', () => {
  test('while voices are off an offer gets a bye; on, an answer tuned for singing', async () => {
    const { mixer, peers, sent } = setup();
    mixer.handleSignal('Ann', OFFER);
    expect(sent).toEqual([{ to: 'Ann', signal: { link: 'l1', bye: true } }]);
    expect(peers).toHaveLength(0);

    mixer.setEnabled(true);
    mixer.handleSignal('Ann', OFFER);
    await flush();
    expect(peers).toHaveLength(1);
    expect(peers[0].remoteDescription).toEqual(OFFER.description);
    const answer = sent.at(-1)!;
    expect(answer.to).toBe('Ann');
    expect(answer.signal.description?.type).toBe('answer');
    expect(answer.signal.description?.sdp).toContain('a=ptime:10');
    expect(answer.signal.description?.sdp).toContain('usedtx=0');
    expect(peers[0].local).toEqual(answer.signal.description);
    expect(mixer.singers().map(s => [s.name, s.kind, s.phase])).toEqual([['Ann', 'remote', 'connecting']]);
  });

  test("candidates of the connection on now are added (an old one's dropped), a bye or a new offer replaces it, and the stream is kept flowing", async () => {
    const { mixer, peers, sent, held } = setup();
    mixer.setEnabled(true);
    mixer.handleSignal('Ann', OFFER);
    await flush();
    mixer.handleSignal('Ann', { link: 'l1', candidate: { candidate: 'c1' } });
    mixer.handleSignal('Ann', { link: 'old', candidate: { candidate: 'c0' } });
    expect(peers[0].candidates).toEqual([{ candidate: 'c1' }]);

    const stream = { id: 's' } as MediaStream;
    peers[0].ontrack?.({ track: {} as MediaStreamTrack, streams: [stream], receiver: {} as RTCRtpReceiver });
    expect(held).toEqual([stream]);

    mixer.handleSignal('Ann', { link: 'l2', description: { type: 'offer', sdp: 'again' } }); // a reconnect
    await flush();
    expect(peers[0].closed).toBe(true);
    expect(held).toEqual([]);
    expect(peers).toHaveLength(2);
    mixer.handleSignal('Ann', { link: 'l1', bye: true }); // the old one's bye: nothing
    expect(peers[1].closed).toBe(false);
    mixer.handleSignal('Ann', { link: 'l2', bye: true });
    expect(peers[1].closed).toBe(true);
    expect(mixer.singers()).toEqual([]);
    expect(sent.filter(s => s.signal.bye)).toEqual([]); // their side ended it: nothing to tell
  });

  test('someone leaving, a failed connection and voices off each end it; the host page says bye where the singer does not know yet', async () => {
    const { mixer, peers, sent } = setup();
    mixer.setEnabled(true);
    mixer.handleSignal('Ann', OFFER);
    mixer.handleSignal('Bob', { link: 'b1', description: { type: 'offer', sdp: 'o' } });
    mixer.handleSignal('Cy', { link: 'c1', description: { type: 'offer', sdp: 'o' } });
    await flush();
    mixer.drop('Ann');
    expect(sent.at(-1)).toEqual({ to: 'Ann', signal: { link: 'l1', bye: true } });
    peers[1].state('failed');
    expect(peers[1].closed).toBe(true);
    expect(mixer.singers().map(s => s.name)).toEqual(['Cy']);
    mixer.setEnabled(false);
    expect(sent.at(-1)).toEqual({ to: 'Cy', signal: { link: 'c1', bye: true } });
    expect(peers.every(p => p.closed)).toBe(true);
  });
});

describe('canMixLocally', () => {
  test('a computer: yes; a phone or tablet (call mode): no', () => {
    expect(canMixLocally({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0' })).toBe(true);
    expect(canMixLocally({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 })).toBe(true);
    expect(canMixLocally({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' })).toBe(false);
    expect(canMixLocally({ userAgent: 'Mozilla/5.0 (Linux; Android 9; AFTKA)' })).toBe(false);
    expect(canMixLocally({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe(false);
    expect(canMixLocally({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 })).toBe(false);
  });
});
