/**
 * A singer's voice on the host's speakers: the singer's side.
 *
 * The microphone this page sings into (a copy of its track, raw: no echo
 * cancellation, noise suppression or auto gain, as the pitch detector takes
 * it) goes straight to the host's page over WebRTC, which plays it through the
 * party's speakers (voiceMixer.ts). Peer to peer, mostly inside one room's
 * Wi-Fi: the party server only carries the setup (rtc:signal), and only while
 * the party has voices on (the host's or a co-host's switch).
 *
 * The connection only sends, and this side always makes the offer, so the two
 * never collide. It stays up while the singer wants their voice on the
 * speakers and the party has voices on; the microphone closing (micStandby.ts)
 * takes the track off it without ending it, so the next song is on the
 * speakers at once. A paused song sends silence (the copy is disabled).
 *
 * Phone browsers: getUserMedia's echo cancellation would not help here (it
 * only removes what the phone itself plays, not the host's speakers), so the
 * host page keeps feedback in check instead (voiceMixer.ts).
 */
import { randomId } from './sessionId';

/** A voice connection's setup, as the pages exchange it through the party server (rtc:signal) */
export interface VoiceSignal {
  /** the singer page's id for this connection: a reconnect is a new one, and anything for an old one is dropped */
  link: string;
  description?: { type: 'offer' | 'answer'; sdp: string };
  /** null: no more candidates */
  candidate?: RTCIceCandidateInit | null;
  /** that side closed it */
  bye?: true;
}

/** off: not wanted (or no microphone yet); connecting; on: the host page hears this microphone; failed: it could not be reached (tries again) */
export type VoiceLinkPhase = 'off' | 'connecting' | 'on' | 'failed';

/** Why the last try failed: the host's page never answered, or it did and no network path was found */
export type VoiceFailure = 'no_answer' | 'no_path';

/** What the mic panel shows of the connection */
export interface VoiceLinkState {
  phase: VoiceLinkPhase;
  /** how the audio goes: 'host' (the same network), 'srflx' / 'prflx' (through a router), 'relay' (TURN) */
  route: string | null;
  /** the network's round trip, ms */
  rttMs: number | null;
  /** why the last try failed (null: it did not) */
  reason: VoiceFailure | null;
}

/**
 * How one try went, for the server's event log (rtc:report → `voice_link`
 * events): no addresses, only what kinds of candidates each side had, how
 * ICE went and whether its checks got through. `side`: who reports it.
 */
export interface VoiceReport {
  link: string;
  side: 'singer' | 'host';
  result: 'connected' | VoiceFailure;
  /** ms from the start of the try */
  ms: number;
  /** the singer's page got the host page's answer */
  answered: boolean;
  /** candidate kinds, `type/protocol/family` (family v4, v6 or mdns) → how many */
  local: Record<string, number>;
  remote: Record<string, number>;
  /** ICE's states with the ms they began, `checking@812 connected@1030` */
  states: string;
  /** the candidate pairs at the end: how many in each state, and the connectivity checks each way */
  pairs: PairSummary | null;
  /** the most each of those counts reached while ICE ran (Chrome deletes pairs that never answer before the end) */
  peak?: PairSummary | null;
  route?: string | null;
  rttMs?: number | null;
}

/** The candidate pairs of a connection's stats (pairSummary) */
export interface PairSummary {
  total: number;
  succeeded: number;
  failed: number;
  inProgress: number;
  waiting: number;
  requestsSent: number;
  responsesReceived: number;
  requestsReceived: number;
  responsesSent: number;
}

/** The parts of an RTCPeerConnection the link uses (a fake one in tests) */
export type VoicePeer = Pick<RTCPeerConnection,
  'addTransceiver' | 'createOffer' | 'setLocalDescription' | 'setRemoteDescription' | 'addIceCandidate' | 'close' | 'getStats'
  | 'connectionState' | 'remoteDescription'> & Partial<Pick<RTCPeerConnection, 'iceConnectionState'>> & {
  onicecandidate: ((e: { candidate: RTCIceCandidate | null }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  oniceconnectionstatechange?: (() => void) | null;
};

export interface VoiceLinkOptions {
  /** sends a signal to the host's page (rtc:signal); false while the party socket is down */
  send: (signal: VoiceSignal) => boolean;
  /** the STUN/TURN servers the party server named (rtc:ice) */
  iceServers: () => RTCIceServer[];
  /** through the TURN relay only (?voicerelay, for trying the relay out) */
  relayOnly?: boolean;
  onState?: (state: VoiceLinkState) => void;
  log?: (line: string) => void;
  /** how each try went (connected, or why not), for the server's log */
  report?: (report: VoiceReport) => void;
  /** for tests */
  peer?: (config: RTCConfiguration) => VoicePeer;
}

/** The singer's side of the voice connection (createVoiceLink) */
export interface VoiceLink {
  readonly state: VoiceLinkState;
  /** the singer wants their voice on the speakers and the party has voices on */
  setWanted(on: boolean): void;
  /** this page's microphone (a copy is sent); null: the microphone closed */
  setTrack(track: MediaStreamTrack | null): void;
  /** a song playing: its sound; paused: silence */
  setActive(on: boolean): void;
  /** the host's page is back (a reload, a reconnect): it has no connection, so a new one now */
  hostBack(): void;
  /** an rtc:signal from the host's page */
  handleSignal(signal: VoiceSignal): void;
  /** for good: the host's page hears the end */
  close(): void;
}

/** Opus in 10 ms packets, mono, with in-band error correction: the encoder the host's answer asks this side for (tuneOpusAnswer) */
export const OPUS_PARAMS: Record<string, string> = {
  minptime: '10', useinbandfec: '1', usedtx: '0', stereo: '0', 'sprop-stereo': '0', maxaveragebitrate: '64000',
};
export const PTIME_MS = 10;

/**
 * An answer's SDP with Opus set up for live singing: in Opus the receiver's
 * fmtp line says what it wants the sender to encode (mono, 64 kb/s, no
 * silence suppression, which clips the start of a sung line), and a=ptime
 * asks for 10 ms packets instead of 20 (10 ms less on the way to the
 * speaker). The other codecs and lines stay as they are.
 */
export function tuneOpusAnswer(sdp: string): string {
  const eol = sdp.includes('\r\n') ? '\r\n' : '\n';
  const lines = sdp.split(eol);
  const pt = lines.map(l => /^a=rtpmap:(\d+) opus\/48000/i.exec(l)?.[1]).find(Boolean);
  if (!pt) return sdp;
  const out: string[] = [];
  let inAudio = false, sawFmtp = false, sawPtime = false;
  const finishAudio = () => {
    if (!inAudio) return;
    if (!sawFmtp) out.push(`a=fmtp:${pt} ${Object.entries(OPUS_PARAMS).map(([k, v]) => `${k}=${v}`).join(';')}`);
    if (!sawPtime) out.push(`a=ptime:${PTIME_MS}`);
  };
  for (const line of lines) {
    if (line.startsWith('m=')) {
      finishAudio();
      inAudio = line.startsWith('m=audio');
      sawFmtp = false;
      sawPtime = false;
    }
    if (inAudio && line.startsWith(`a=fmtp:${pt} `)) {
      const params = new Map(line.slice(`a=fmtp:${pt} `.length).split(';').map(p => p.trim()).filter(Boolean).map(p => {
        const i = p.indexOf('=');
        return (i < 0 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)]) as [string, string];
      }));
      for (const [k, v] of Object.entries(OPUS_PARAMS)) params.set(k, v);
      out.push(`a=fmtp:${pt} ${[...params].map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join(';')}`);
      sawFmtp = true;
      continue;
    }
    if (inAudio && line.startsWith('a=ptime:')) {
      out.push(`a=ptime:${PTIME_MS}`);
      sawPtime = true;
      continue;
    }
    if (line === '' && inAudio) { finishAudio(); inAudio = false; } // the trailing empty line
    out.push(line);
  }
  finishAudio();
  return out.join(eol);
}

/**
 * A candidate's kind, `type/protocol/family`: host, srflx, prflx or relay;
 * udp or tcp; v4, v6, or mdns for an address hidden behind a .local name.
 * Null for an end-of-candidates or anything unreadable.
 */
export function candidateKind(candidate: string | undefined): string | null {
  const f = (candidate ?? '').replace(/^a=/, '').trim().split(/\s+/);
  const typ = f.indexOf('typ');
  if (f.length < 8 || typ < 0 || !f[typ + 1]) return null;
  const address = f[4];
  const family = address.endsWith('.local') ? 'mdns' : address.includes(':') ? 'v6' : 'v4';
  return `${f[typ + 1]}/${f[2].toLowerCase()}/${family}`;
}

/** Counts a candidate's kind into `into` */
export const countKind = (into: Record<string, number>, candidate: string | undefined) => {
  const kind = candidateKind(candidate);
  if (kind) into[kind] = (into[kind] ?? 0) + 1;
};

/** The candidate pairs in a connection's stats: their states and the checks each way */
export function pairSummary(stats: RTCStatsReport): PairSummary {
  const p: PairSummary = { total: 0, succeeded: 0, failed: 0, inProgress: 0, waiting: 0, requestsSent: 0, responsesReceived: 0, requestsReceived: 0, responsesSent: 0 };
  stats.forEach((s: Record<string, unknown>) => {
    if (s.type !== 'candidate-pair') return;
    p.total++;
    if (s.state === 'succeeded') p.succeeded++;
    else if (s.state === 'failed') p.failed++;
    else if (s.state === 'in-progress') p.inProgress++;
    else p.waiting++;
    p.requestsSent += Number(s.requestsSent ?? 0);
    p.responsesReceived += Number(s.responsesReceived ?? 0);
    p.requestsReceived += Number(s.requestsReceived ?? 0);
    p.responsesSent += Number(s.responsesSent ?? 0);
  });
  return p;
}

/** One try's notes for its report (VoiceReport) */
export interface TryNotes {
  t0: number;
  answered: boolean;
  local: Record<string, number>;
  remote: Record<string, number>;
  states: string[];
  /** the highest pair counts seen while it ran (watchPairs) */
  peak: PairSummary | null;
}
export const newNotes = (): TryNotes => ({ t0: performance.now(), answered: false, local: {}, remote: {}, states: [], peak: null });

/** Keeps the highest of each pair count in `notes.peak` */
export const notePeak = (notes: TryNotes, now: PairSummary) => {
  const p = notes.peak;
  notes.peak = p ? Object.fromEntries(Object.entries(now).map(([k, v]) => [k, Math.max(v, p[k as keyof PairSummary])])) as unknown as PairSummary : now;
};

/** Reads a connection's pairs every 2 s while it is not connected, into the try's peak; returns the stop */
export function watchPairs(conn: Pick<RTCPeerConnection, 'getStats'>, notes: TryNotes): () => void {
  const id = setInterval(() => { conn.getStats().then(stats => notePeak(notes, pairSummary(stats)), () => {}); }, 2000);
  return () => clearInterval(id);
}
export const noteState = (notes: TryNotes, state: string) => { notes.states.push(`${state}@${Math.round(performance.now() - notes.t0)}`); };

/** How a connection's audio goes, and its round trip, from its stats: the selected candidate pair */
export function routeOf(stats: RTCStatsReport): { route: string | null; rttMs: number | null } {
  let pair: Record<string, unknown> | undefined;
  stats.forEach((s: Record<string, unknown>) => {
    if (s.type === 'transport' && typeof s.selectedCandidatePairId === 'string') pair = stats.get(s.selectedCandidatePairId);
  });
  if (!pair) stats.forEach((s: Record<string, unknown>) => { if (!pair && s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded') pair = s; });
  if (!pair) return { route: null, rttMs: null };
  const local = stats.get(String(pair.localCandidateId)) as { candidateType?: string } | undefined;
  const remote = stats.get(String(pair.remoteCandidateId)) as { candidateType?: string } | undefined;
  const types = [local?.candidateType, remote?.candidateType];
  const route = types.includes('relay') ? 'relay' : types.includes('srflx') ? 'srflx' : types.includes('prflx') ? 'prflx' : local?.candidateType ?? null;
  const rtt = typeof pair.currentRoundTripTime === 'number' ? Math.round(pair.currentRoundTripTime * 1000) : null;
  return { route, rttMs: rtt };
}

// How long the host's page may take to answer, and then ICE to find a way (Chrome gives up after ~30 s of
// unanswered checks itself), and the waits before trying again after it failed (then the last one each time)
const ANSWER_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 35_000;
const DISCONNECTED_MS = 6_000;     // 'disconnected' often comes back by itself (a Wi-Fi hiccup)
const RETRY_MS = [2_000, 5_000, 15_000, 30_000, 60_000];
const BYE_RETRY_MS = 30_000;       // the host's page said no (it was busy, reloading): try again after this

/**
 * The singer's side of one microphone's voice connection to the host's page.
 */
export function createVoiceLink({ send, iceServers, relayOnly = false, onState = () => {}, log = () => {}, report = () => {}, peer = config => new RTCPeerConnection(config) as VoicePeer }: VoiceLinkOptions): VoiceLink {
  let wanted = false;
  let active = false;
  let track: MediaStreamTrack | null = null;   // the page's microphone
  let copy: MediaStreamTrack | null = null;    // what is sent: a clone, stopped by this link (it keeps the microphone in use)
  let pc: VoicePeer | null = null;
  let sender: RTCRtpSender | null = null;
  let link: string | null = null;
  let pending: RTCIceCandidateInit[] = [];     // candidates that came before the answer
  let failures = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let watchTimer: ReturnType<typeof setTimeout> | null = null;
  let stopPairs: (() => void) | null = null;
  let closed = false;
  let notes = newNotes();
  let state: VoiceLinkState = { phase: 'off', route: null, rttMs: null, reason: null };

  const set = (patch: Partial<VoiceLinkState>) => {
    const next = { ...state, ...patch };
    if (next.phase === state.phase && next.route === state.route && next.rttMs === state.rttMs && next.reason === state.reason) return;
    state = next;
    onState(state);
  };
  const clearTimers = () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (watchTimer) clearTimeout(watchTimer);
    retryTimer = watchTimer = null;
    stopPairs?.();
    stopPairs = null;
  };

  // (`close` false: the caller still reads its stats, and closes it after)
  const teardown = (bye: boolean, close = true) => {
    clearTimers();
    if (link && bye) send({ link, bye: true });
    if (pc) {
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      if (close) { try { pc.close(); } catch { /* already */ } }
    }
    pc = null;
    sender = null;
    link = null;
    pending = [];
  };

  const retryLater = (ms: number) => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { retryTimer = null; update(); }, ms);
  };
  // The try's report: its notes and, where the connection is still there, its candidate pairs
  const sendReport = (conn: VoicePeer | null, id: string, result: VoiceReport['result'], tried: TryNotes) => {
    const base = { link: id, side: 'singer' as const, result, ms: Math.round(performance.now() - tried.t0), answered: tried.answered, local: tried.local, remote: tried.remote, states: tried.states.join(' '), peak: tried.peak };
    if (!conn) { report({ ...base, pairs: null }); return Promise.resolve(); }
    return conn.getStats().then(stats => report({ ...base, pairs: pairSummary(stats) }), () => report({ ...base, pairs: null }));
  };
  const fail = (why: string, reason: VoiceFailure) => {
    log(`voice: ${why}`);
    const conn = pc, id = link, tried = notes;
    teardown(true, false);
    const close = () => { try { conn?.close(); } catch { /* already */ } };
    if (id) sendReport(conn, id, reason, tried).finally(close);
    else close();
    failures++;
    set({ phase: failures >= 2 ? 'failed' : 'connecting', route: null, rttMs: null, reason });
    retryLater(RETRY_MS[Math.min(failures, RETRY_MS.length) - 1]);
  };

  const readRoute = (id: string, tried: TryNotes) => {
    const conn = pc;
    conn?.getStats().then(stats => {
      const route = routeOf(stats);
      if (pc === conn && state.phase === 'on') set(route);
      report({ link: id, side: 'singer', result: 'connected', ms: Math.round(performance.now() - tried.t0), answered: tried.answered,
        local: tried.local, remote: tried.remote, states: tried.states.join(' '), pairs: pairSummary(stats), peak: tried.peak, ...route });
    }).catch(() => {});
  };

  const start = async () => {
    const id = randomId();
    link = id;
    const tried = notes = newNotes();
    let conn: VoicePeer;
    try {
      conn = peer({ iceServers: iceServers(), bundlePolicy: 'max-bundle', ...(relayOnly ? { iceTransportPolicy: 'relay' as const } : {}) });
    } catch (e) {
      // no WebRTC on this browser at all: nothing to try again
      log(`voice: no RTCPeerConnection (${e instanceof Error ? e.message : e})`);
      link = null;
      set({ phase: 'failed', reason: 'no_path' });
      return;
    }
    pc = conn;
    set({ phase: 'connecting', route: null, rttMs: null });
    noteState(tried, 'new');
    const tx = conn.addTransceiver('audio', { direction: 'sendonly', sendEncodings: [{ maxBitrate: 64_000, priority: 'high', networkPriority: 'high' }] });
    sender = tx.sender;
    // Opus only: anything else on offer would only be a worse choice for the host to make
    try {
      const codecs = RTCRtpReceiver.getCapabilities?.('audio')?.codecs.filter(c => /opus/i.test(c.mimeType));
      if (codecs?.length) tx.setCodecPreferences(codecs);
    } catch { /* older browsers: their default is Opus anyway */ }
    if (copy) await sender.replaceTrack(copy).catch(() => {});
    conn.onicecandidate = ({ candidate }) => {
      if (link !== id) return;
      if (candidate) countKind(tried.local, candidate.candidate);
      send({ link: id, candidate: candidate ? candidate.toJSON() : null });
    };
    conn.oniceconnectionstatechange = () => { if (pc === conn && conn.iceConnectionState) noteState(tried, conn.iceConnectionState); };
    conn.onconnectionstatechange = () => {
      if (pc !== conn) return;
      const s = conn.connectionState;
      if (s === 'connected') {
        failures = 0;
        if (watchTimer) { clearTimeout(watchTimer); watchTimer = null; }
        stopPairs?.();
        stopPairs = null;
        set({ phase: 'on', reason: null });
        readRoute(id, tried);
        log('voice: on the speakers');
      } else if (s === 'failed') {
        fail(`no way through to the host page (${tried.states.join(' ')})`, 'no_path');
      } else if (s === 'disconnected') {
        if (watchTimer) clearTimeout(watchTimer);
        watchTimer = setTimeout(() => { if (pc === conn && conn.connectionState !== 'connected') fail('connection lost', 'no_path'); }, DISCONNECTED_MS);
      }
    };
    // no answer at all: the host's page does not take it (gone, or a page without voices)
    watchTimer = setTimeout(() => { if (pc === conn && !tried.answered) fail('the host page does not answer', 'no_answer'); }, ANSWER_TIMEOUT_MS);
    try {
      const offer = await conn.createOffer();
      if (pc !== conn) return;
      await conn.setLocalDescription(offer);
      if (pc !== conn) return;
      if (!send({ link: id, description: { type: 'offer', sdp: offer.sdp ?? '' } })) fail('the party connection is down', 'no_answer');
    } catch (e) {
      if (pc === conn) fail(`offer failed (${e instanceof Error ? e.message : e})`, 'no_path');
    }
  };

  // Up while wanted, once there is a microphone to send (and down while not wanted)
  function update() {
    if (closed) return;
    if (!wanted) {
      if (pc) teardown(true);
      clearTimers();
      failures = 0;
      set({ phase: 'off', route: null, rttMs: null, reason: null });
      return;
    }
    if (pc || retryTimer) return;
    if (!copy) { set({ phase: 'off' }); return; }
    start();
  }

  return {
    get state() { return state; },
    setWanted(on) {
      if (on === wanted) return;
      wanted = on;
      update();
    },
    setTrack(next) {
      if (next === track) return;
      track = next;
      copy?.stop();
      copy = next ? next.clone() : null;
      if (copy) copy.enabled = active;
      sender?.replaceTrack(copy).catch(() => {});
      update();
    },
    setActive(on) {
      active = on;
      if (copy) copy.enabled = on;
    },
    hostBack() {
      if (!wanted || closed) return;
      teardown(false); // the host's page that had it is gone
      failures = 0;
      update();
    },
    handleSignal(signal) {
      if (!pc || signal.link !== link) return; // an older connection's
      const conn = pc;
      if (signal.bye) {
        log('voice: the host page ended it');
        teardown(false);
        set({ phase: 'connecting', route: null, rttMs: null, reason: null });
        retryLater(BYE_RETRY_MS);
        return;
      }
      if (signal.description?.type === 'answer') {
        notes.answered = true;
        noteState(notes, 'answered');
        log('voice: the host page answered');
        // now ICE has its time to find a way (it says 'failed' itself when there is none)
        if (watchTimer) clearTimeout(watchTimer);
        const tried = notes;
        watchTimer = setTimeout(() => { if (pc === conn && conn.connectionState !== 'connected') fail(`no way through in time (${tried.states.join(' ')})`, 'no_path'); }, CONNECT_TIMEOUT_MS);
        stopPairs?.();
        stopPairs = watchPairs(conn, tried);
        conn.setRemoteDescription(signal.description)
          .then(() => {
            const queued = pending;
            pending = [];
            for (const c of queued) conn.addIceCandidate(c).catch(() => {});
          })
          .catch(e => { if (pc === conn) fail(`answer refused (${e instanceof Error ? e.message : e})`, 'no_path'); });
      } else if (signal.candidate !== undefined) {
        if (signal.candidate === null) { if (conn.remoteDescription) conn.addIceCandidate().catch(() => {}); return; }
        countKind(notes.remote, signal.candidate.candidate);
        if (conn.remoteDescription) conn.addIceCandidate(signal.candidate).catch(() => {});
        else pending.push(signal.candidate);
      }
    },
    close() {
      wanted = false;
      update();
      closed = true;
      copy?.stop();
      copy = null;
      track = null;
    },
  };
}
