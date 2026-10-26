/**
 * The singers' voices on the host's speakers: the host page's side.
 *
 * Each singer's phone sends its microphone over WebRTC (voiceLink.ts); this
 * page answers, and plays every stream through the party's speakers, in the
 * same AudioContext as the stems. Microphones on this page itself (the host's
 * own, the "more microphones" ones) go in directly, without a network.
 *
 * One singer's way to the speakers:
 *
 *   stream → high-pass 120 Hz → low-pass 9 kHz → guard (VoiceGuardWorklet.ts: gate, automatic
 *   level under a ceiling) → duck (a howl turns it down) → their level → limiter → the singers'
 *   level × the page's volume → speakers (and the echo effect, when on)
 *
 * Keeping it from howling (voiceGuard.ts): the guard worklet also hands over
 * the stream and the music around it, and VoiceLoopWorker.ts measures from
 * them how late the voice comes out (the lag, shown to the host) and how loud
 * the speakers come back in that microphone (the coupling). The ceiling of a
 * singer's level follows from the coupling (feedbackCap); a stream that rings
 * anyway (createHowlDetector, ten times a second) is turned down at once and
 * its ceiling lowered for the rest of the party. Without stems there is no
 * music to measure with, and the ceiling stays a careful guess.
 *
 * Chrome plays a remote WebRTC stream into Web Audio only while the stream is
 * also attached to a media element: each gets a muted <audio>.
 */
import { routeOf, tuneOpusAnswer } from './voiceLink';
import { createHowlDetector, dbToGain, feedbackCap, gainToDb, HOWL_MEMORY_S } from './voiceGuard';
import guardWorkletUrl from './VoiceGuardWorklet.ts?worker&url';
import VoiceLoopWorker from './VoiceLoopWorker.ts?worker';
import type { VoiceSignal } from './voiceLink';
import type { VoiceGuardMessage, VoiceGuardRequest } from './voiceGuard';
import type { VoiceLoopRequest, VoiceLoopResponse } from './voiceLoop';

/** One voice on the speakers, as the host's volume panel and the debug panel show it */
export interface VoiceSingerView {
  name: string;
  /** remote: a phone over WebRTC; local: a microphone of this page */
  kind: 'remote' | 'local';
  phase: 'connecting' | 'on';
  /** their level, 0..1 (the host's slider) */
  level: number;
  /** the stream's level (RMS) */
  rms: number;
  /** singing now (the gate is open) */
  open: boolean;
  /** the automatic level, dB */
  gainDb: number;
  /** the ceiling holds their level down */
  capped: boolean;
  /** how late their voice comes out of the speakers, ms (measured; null until it is) */
  lagMs: number | null;
  /** how loud the speakers come back in their microphone, dB */
  couplingDb: number | null;
  /** howls in the last two minutes (each lowers their ceiling meanwhile) */
  howls: number;
  /** turned down after a howl, right now */
  ducked: boolean;
  route: string | null;
  /** the jitter buffer's delay, ms */
  jitterMs: number | null;
  lossPct: number | null;
  /** packets a second: 100 with the 10 ms packets asked for, 50 with Opus's usual 20 ms */
  packetsPerSec: number | null;
}

/** The parts of an RTCPeerConnection the mixer uses (a fake one in tests) */
export type MixerPeer = Pick<RTCPeerConnection,
  'setRemoteDescription' | 'createAnswer' | 'setLocalDescription' | 'addIceCandidate' | 'close' | 'getStats' | 'connectionState' | 'remoteDescription'> & {
  onicecandidate: ((e: { candidate: RTCIceCandidate | null }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  ontrack: ((e: { track: MediaStreamTrack; streams: readonly MediaStream[]; receiver: RTCRtpReceiver }) => void) | null;
};

export interface VoiceMixerOptions {
  /** sends a signal to a singer's page (rtc:signal with `to`); false while the party socket is down */
  send: (to: string, signal: VoiceSignal) => boolean;
  iceServers: () => RTCIceServer[];
  /** the singers or their states changed */
  onChange?: () => void;
  log?: (line: string) => void;
  /** for tests */
  peer?: (config: RTCConfiguration) => MixerPeer;
  /** for tests: a media element to keep a remote stream flowing (Chrome) */
  holdStream?: (stream: MediaStream) => () => void;
}

/** The host page's voices (createVoiceMixer) */
export interface VoiceMixer {
  /** the page's AudioContext, and the music it plays (a node with the stems' mix; null without stems) */
  attach(ctx: AudioContext, music: AudioNode | null): void;
  /** the party has voices on; off ends every connection and takes the local microphones off */
  setEnabled(on: boolean): void;
  readonly enabled: boolean;
  /** the singers' level (0..1) and the page's volume (0..1) */
  setLevels(singers: number, master: number): void;
  setSingerLevel(name: string, level: number): void;
  setEcho(on: boolean): void;
  /** a microphone of this page on the speakers (null: off) */
  setLocal(name: string, track: MediaStreamTrack | null): void;
  /** an rtc:signal from a singer's page */
  handleSignal(from: string, signal: VoiceSignal): void;
  /** the singer left the party */
  drop(name: string): void;
  singers(): VoiceSingerView[];
  close(): void;
}

const HP_HZ = 120;
const LP_HZ = 9000;
const DUCK = dbToGain(-12);
const DUCK_S = 3;
const ECHO_S = 0.17;
const ECHO_FEEDBACK = 0.35;
const ECHO_WET = 0.3;
const TICK_MS = 100;
const STATS_MS = 2000;
const FFT = 4096;

/** What the mixer keeps per singer */
interface Singer {
  name: string;
  kind: 'remote' | 'local';
  /** the singer page's id of the connection (remote) */
  link: string | null;
  pc: MixerPeer | null;
  pending: RTCIceCandidateInit[];
  stream: MediaStream | null;
  /** a local microphone: the page's track, and the copy played (stopped when it goes) */
  from: MediaStreamTrack | null;
  copy: MediaStreamTrack | null;
  release: (() => void) | null;
  chain: Chain | null;
  connected: boolean;
  level: number;
  rms: number;
  open: boolean;
  gain: number;
  cap: number;
  lag: number | null;
  coupling: number | null;
  /** when it rang (performance.now()), the last HOWL_MEMORY_S */
  howlTimes: number[];
  duckUntil: number;
  route: string | null;
  jitterMs: number | null;
  lossPct: number | null;
  packetsPerSec: number | null;
  lastInbound: { at: number; emitted: number; delay: number; received: number; lost: number } | null;
  measureId: string;
  detector: ReturnType<typeof createHowlDetector>;
}

/** One singer's nodes in the page's context */
interface Chain {
  ctx: AudioContext;
  source: MediaStreamAudioSourceNode;
  hp: BiquadFilterNode;
  lp: BiquadFilterNode;
  guard: AudioWorkletNode | null;
  duck: GainNode;
  gain: GainNode;
  limiter: DynamicsCompressorNode;
  analyser: AnalyserNode;
  spectrum: Float32Array<ArrayBuffer>;
}

/** Chrome: a remote stream reaches Web Audio only while a media element plays it too (muted here) */
const holdWithElement = (stream: MediaStream) => {
  const el = new Audio();
  el.muted = true;
  el.srcObject = stream;
  el.play().catch(() => {});
  return () => { el.pause(); el.srcObject = null; };
};

let ids = 0;

export function createVoiceMixer({ send, iceServers, onChange = () => {}, log = () => {}, peer = config => new RTCPeerConnection(config) as MixerPeer, holdStream = holdWithElement }: VoiceMixerOptions): VoiceMixer {
  const singers = new Map<string, Singer>();
  let enabled = false;
  let ctx: AudioContext | null = null;
  let music: AudioNode | null = null;
  let bus: GainNode | null = null;
  let wet: GainNode | null = null;
  let echoNodes: AudioNode[] = [];
  let workletReady: Promise<boolean> | null = null;
  let hasWorklet = false;
  let singersLevel = 0.8, master = 1, echo = false;
  let loopWorker: Worker | null = null;
  let tick: ReturnType<typeof setInterval> | null = null;
  let statsTick: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const changed = () => onChange();
  const onAir = () => [...singers.values()].filter(s => s.chain).length;

  // ── the bus: the singers' level × the page's volume, plus the echo effect ──
  const buildBus = (c: AudioContext) => {
    bus = c.createGain();
    bus.gain.value = singersLevel * master;
    bus.connect(c.destination);
    const delay = c.createDelay(1);
    delay.delayTime.value = ECHO_S;
    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3000;
    const fb = c.createGain();
    fb.gain.value = ECHO_FEEDBACK;
    wet = c.createGain();
    wet.gain.value = echo ? ECHO_WET : 0;
    bus.connect(delay);
    delay.connect(tone);
    tone.connect(fb);
    fb.connect(delay);
    tone.connect(wet);
    wet.connect(c.destination);
    echoNodes = [delay, tone, fb, wet];
  };
  const dropBus = () => {
    for (const n of [bus, ...echoNodes]) { try { n?.disconnect(); } catch { /* */ } }
    bus = wet = null;
    echoNodes = [];
  };

  const loadWorklet = (c: AudioContext) => {
    if (!c.audioWorklet) return Promise.resolve(false);
    return c.audioWorklet.addModule(guardWorkletUrl).then(() => true, (e: unknown) => {
      log(`voices: guard worklet unavailable (${e instanceof Error ? e.message : e}): no gate, no automatic level`);
      return false;
    });
  };

  const worker = () => {
    if (loopWorker) return loopWorker;
    try {
      loopWorker = new VoiceLoopWorker();
      loopWorker.onmessage = ({ data }: MessageEvent<VoiceLoopResponse>) => {
        const s = [...singers.values()].find(x => x.measureId === data.id);
        if (!s || !data.confident) return;
        const first = s.lag === null;
        s.lag = data.lag;
        s.coupling = data.coupling;
        guardSay(s, { type: 'coupling', value: data.coupling });
        applyCaps();
        if (first) log(`voices: ${s.name} comes out ${Math.round(data.lag * 1000)} ms late, the speakers come back at ${gainToDb(data.coupling).toFixed(1)} dB (z=${data.z.toFixed(1)})`);
        changed();
      };
    } catch { loopWorker = null; }
    return loopWorker;
  };

  const guardSay = (s: Singer, msg: VoiceGuardRequest) => s.chain?.guard?.port.postMessage(msg);

  // ── one singer's chain ──
  const buildChain = (s: Singer) => {
    if (!ctx || !bus || !s.stream || s.chain || !enabled) return;
    const c = ctx;
    let source: MediaStreamAudioSourceNode;
    try { source = c.createMediaStreamSource(s.stream); } catch (e) { log(`voices: ${s.name}'s stream cannot be played (${e instanceof Error ? e.message : e})`); return; }
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = HP_HZ;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = LP_HZ;
    let guard: AudioWorkletNode | null = null;
    if (hasWorklet) {
      try {
        guard = new AudioWorkletNode(c, 'voice-guard', { numberOfInputs: 2, numberOfOutputs: 1, outputChannelCount: [1] });
      } catch { guard = null; }
    }
    const duck = c.createGain();
    const gain = c.createGain();
    gain.gain.value = s.level;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    const analyser = c.createAnalyser();
    analyser.fftSize = FFT;
    analyser.smoothingTimeConstant = 0;
    source.connect(hp);
    hp.connect(lp);
    lp.connect(analyser);
    if (guard) {
      lp.connect(guard, 0, 0);
      if (music) music.connect(guard, 0, 1);
      guard.connect(duck);
      guard.port.onmessage = ({ data }: MessageEvent<VoiceGuardMessage>) => {
        if (data.type === 'level') { s.rms = data.rms; s.open = data.open; s.gain = data.gain; }
        else if (data.type === 'window') worker()?.postMessage({ type: 'window', id: s.measureId, x: data.x, r: data.r } satisfies VoiceLoopRequest, [data.x.buffer, data.r.buffer]);
      };
      guard.port.postMessage({ type: 'measure', on: !!music } satisfies VoiceGuardRequest);
      guard.port.postMessage({ type: 'coupling', value: s.coupling } satisfies VoiceGuardRequest);
    } else {
      lp.connect(duck);
    }
    duck.connect(gain);
    gain.connect(limiter);
    limiter.connect(bus);
    s.chain = { ctx: c, source, hp, lp, guard, duck, gain, limiter, analyser, spectrum: new Float32Array(analyser.frequencyBinCount) };
    applyCaps();
    startTicks();
    log(`voices: ${s.name} on the speakers (${s.kind}${guard ? '' : ', no guard'})`);
    changed();
  };
  const dropChain = (s: Singer) => {
    const ch = s.chain;
    if (!ch) return;
    s.chain = null;
    if (ch.guard) ch.guard.port.onmessage = null;
    for (const n of [ch.source, ch.hp, ch.lp, ch.guard, ch.duck, ch.gain, ch.limiter, ch.analyser]) { try { n?.disconnect(); } catch { /* */ } }
    if (music && ch.guard) { try { music.disconnect(ch.guard); } catch { /* */ } }
    applyCaps();
  };

  // Every singer's ceiling: their loop's share of the safe gain, over what the sliders already give
  function applyCaps() {
    const n = onAir();
    for (const s of singers.values()) {
      const total = feedbackCap({ coupling: s.coupling, singers: n, echo, howls: s.howlTimes.length });
      const sliders = Math.max(1e-3, s.level * singersLevel * master);
      s.cap = total / sliders;
      const ch = s.chain;
      if (!ch) continue;
      if (ch.guard) guardSay(s, { type: 'cap', gain: s.cap });
      // without the worklet nothing levels automatically: the duck stage keeps it under the ceiling
      const duck = (performance.now() < s.duckUntil ? DUCK : 1) * (ch.guard ? 1 : Math.min(1, s.cap));
      ch.duck.gain.setTargetAtTime(duck, ch.ctx.currentTime, 0.02);
    }
  }

  // ── ten times a second: howls; every 2 s: the connections' stats ──
  const startTicks = () => {
    if (!tick) tick = setInterval(watch, TICK_MS);
    if (!statsTick) statsTick = setInterval(readStats, STATS_MS);
  };
  const stopTicks = () => {
    if (tick) clearInterval(tick);
    if (statsTick) clearInterval(statsTick);
    tick = statsTick = null;
  };
  function watch() {
    const now = performance.now();
    let any = false;
    for (const s of singers.values()) {
      const ch = s.chain;
      if (!ch) continue;
      any = true;
      if (!ch.guard) {
        // no worklet to report the level: the analyser's
        const buf = new Float32Array(ch.analyser.fftSize);
        ch.analyser.getFloatTimeDomainData(buf);
        let p = 0;
        for (let i = 0; i < buf.length; i++) p += buf[i] * buf[i];
        s.rms = Math.sqrt(p / buf.length);
      }
      ch.analyser.getFloatFrequencyData(ch.spectrum);
      const reading = s.detector.push(ch.spectrum, ch.ctx.sampleRate / FFT);
      // a howl long ago no longer holds the ceiling down
      const kept = s.howlTimes.filter(at => now - at < HOWL_MEMORY_S * 1000);
      if (kept.length !== s.howlTimes.length) { s.howlTimes = kept; applyCaps(); changed(); }
      if (reading.howl) {
        s.howlTimes.push(now);
        s.duckUntil = now + DUCK_S * 1000;
        log(`voices: ${s.name} rang at ${Math.round(reading.freq)} Hz: turned down, ceiling now ${gainToDb(feedbackCap({ coupling: s.coupling, singers: onAir(), echo, howls: s.howlTimes.length })).toFixed(1)} dB`);
        applyCaps();
        changed();
      } else if (s.duckUntil && now >= s.duckUntil) {
        s.duckUntil = 0;
        applyCaps();
        changed();
      }
    }
    if (!any) stopTicks();
  }
  function readStats() {
    for (const s of singers.values()) {
      const pc = s.pc;
      if (!pc || !s.connected) continue;
      pc.getStats().then(stats => {
        if (s.pc !== pc) return;
        Object.assign(s, routeOf(stats));
        stats.forEach((r: Record<string, unknown>) => {
          if (r.type !== 'inbound-rtp' || r.kind !== 'audio') return;
          const now = {
            at: performance.now(),
            emitted: Number(r.jitterBufferEmittedCount ?? 0), delay: Number(r.jitterBufferDelay ?? 0),
            received: Number(r.packetsReceived ?? 0), lost: Number(r.packetsLost ?? 0),
          };
          const was = s.lastInbound;
          if (was && now.emitted > was.emitted) s.jitterMs = Math.round(((now.delay - was.delay) / (now.emitted - was.emitted)) * 1000);
          if (was && now.received + now.lost > was.received + was.lost) {
            s.lossPct = Math.round(((now.lost - was.lost) / (now.received + now.lost - was.received - was.lost)) * 1000) / 10;
          }
          if (was && now.at > was.at) s.packetsPerSec = Math.round((now.received - was.received) / ((now.at - was.at) / 1000));
          s.lastInbound = now;
        });
      }).catch(() => {});
    }
  }

  // ── singers ──
  const singer = (name: string, kind: Singer['kind']): Singer => {
    let s = singers.get(name);
    if (s && s.kind !== kind) { remove(s, true); s = undefined; }
    if (!s) {
      s = {
        name, kind, link: null, pc: null, pending: [], stream: null, from: null, copy: null, release: null, chain: null, connected: false,
        level: 1, rms: 0, open: false, gain: 1, cap: 1, lag: null, coupling: null, howlTimes: [], duckUntil: 0,
        route: kind === 'local' ? 'local' : null, jitterMs: null, lossPct: null, packetsPerSec: null, lastInbound: null,
        measureId: `v${++ids}`, detector: createHowlDetector({ stepS: TICK_MS / 1000 }),
      };
      singers.set(name, s);
    }
    return s;
  };
  const endConnection = (s: Singer, bye: boolean) => {
    if (s.pc) {
      s.pc.onicecandidate = null;
      s.pc.onconnectionstatechange = null;
      s.pc.ontrack = null;
      try { s.pc.close(); } catch { /* */ }
    }
    if (bye && s.link) send(s.name, { link: s.link, bye: true });
    s.pc = null;
    s.link = null;
    s.pending = [];
    s.connected = false;
    s.lastInbound = null;
  };
  const setStream = (s: Singer, stream: MediaStream | null) => {
    dropChain(s);
    s.release?.();
    s.release = null;
    s.stream = stream;
    if (stream && s.kind === 'remote') s.release = holdStream(stream);
    // a new stream is a new loop: measure it afresh (the howls it had stay)
    loopWorker?.postMessage({ type: 'reset', id: s.measureId } satisfies VoiceLoopRequest);
    s.measureId = `v${++ids}`;
    s.lag = null;
    s.coupling = null;
    if (stream) buildChain(s);
  };
  const remove = (s: Singer, bye: boolean) => {
    endConnection(s, bye);
    setStream(s, null);
    s.copy?.stop();
    s.copy = null;
    singers.delete(s.name);
    applyCaps();
    changed();
  };

  const answer = async (s: Singer, from: string, signal: VoiceSignal & { description: NonNullable<VoiceSignal['description']> }) => {
    endConnection(s, false);
    setStream(s, null);
    const link = signal.link;
    s.link = link;
    let pc: MixerPeer;
    try { pc = peer({ iceServers: iceServers(), bundlePolicy: 'max-bundle' }); } catch (e) {
      log(`voices: no RTCPeerConnection (${e instanceof Error ? e.message : e})`);
      send(from, { link, bye: true });
      return;
    }
    s.pc = pc;
    pc.onicecandidate = ({ candidate }) => { if (s.pc === pc) send(from, { link, candidate: candidate ? candidate.toJSON() : null }); };
    pc.ontrack = ({ track, streams, receiver }) => {
      if (s.pc !== pc) return;
      // as little buffering as the network allows: the voice is late enough
      const r = receiver as RTCRtpReceiver & { jitterBufferTarget?: number | null; playoutDelayHint?: number | null };
      try { r.jitterBufferTarget = 0; } catch { /* */ }
      try { r.playoutDelayHint = 0; } catch { /* */ }
      setStream(s, streams[0] ?? new MediaStream([track]));
    };
    pc.onconnectionstatechange = () => {
      if (s.pc !== pc) return;
      const st = pc.connectionState;
      const was = s.connected;
      s.connected = st === 'connected';
      if (st === 'failed' || st === 'closed') {
        log(`voices: ${s.name}'s connection ${st}`);
        remove(s, false); // their page tries again
        return;
      }
      if (was !== s.connected) changed();
    };
    try {
      await pc.setRemoteDescription(signal.description);
      if (s.pc !== pc) return;
      for (const c of s.pending.splice(0)) pc.addIceCandidate(c).catch(() => {});
      const desc = await pc.createAnswer();
      if (s.pc !== pc) return;
      const tuned = { type: 'answer' as const, sdp: tuneOpusAnswer(desc.sdp ?? '') };
      await pc.setLocalDescription(tuned);
      if (s.pc !== pc) return;
      send(from, { link, description: tuned });
      changed();
    } catch (e) {
      if (s.pc !== pc) return;
      log(`voices: ${from}'s offer failed (${e instanceof Error ? e.message : e})`);
      send(from, { link, bye: true });
      remove(s, false);
    }
  };

  return {
    attach(next, nextMusic) {
      if (closed) return;
      if (next !== ctx) {
        for (const s of singers.values()) dropChain(s);
        dropBus();
        ctx = next;
        hasWorklet = false;
        buildBus(next);
        const c = next;
        workletReady = loadWorklet(c);
        workletReady.then(ok => {
          if (ctx !== c || !ok) return;
          hasWorklet = true;
          // the chains made meanwhile get their guard
          for (const s of singers.values()) { dropChain(s); buildChain(s); }
        });
      }
      if (nextMusic !== music) {
        for (const s of singers.values()) {
          const g = s.chain?.guard;
          if (!g) continue;
          if (music) { try { music.disconnect(g); } catch { /* */ } }
          if (nextMusic) nextMusic.connect(g, 0, 1);
          g.port.postMessage({ type: 'measure', on: !!nextMusic } satisfies VoiceGuardRequest);
        }
        music = nextMusic;
      }
      for (const s of singers.values()) buildChain(s);
    },
    setEnabled(on) {
      if (on === enabled) return;
      enabled = on;
      if (!on) for (const s of [...singers.values()]) remove(s, true);
      changed();
    },
    get enabled() { return enabled; },
    setLevels(level, volume) {
      singersLevel = level;
      master = volume;
      if (bus && ctx) bus.gain.setTargetAtTime(singersLevel * master, ctx.currentTime, 0.02);
      applyCaps();
    },
    setSingerLevel(name, level) {
      const s = singers.get(name);
      if (!s) return;
      s.level = level;
      if (s.chain) s.chain.gain.gain.setTargetAtTime(level, s.chain.ctx.currentTime, 0.02);
      applyCaps();
      changed();
    },
    setEcho(on) {
      echo = on;
      if (wet && ctx) wet.gain.setTargetAtTime(on ? ECHO_WET : 0, ctx.currentTime, 0.05);
      applyCaps();
    },
    setLocal(name, track) {
      const s = singers.get(name);
      if (!track || !enabled) {
        if (s?.kind === 'local') remove(s, false);
        return;
      }
      if (s?.kind === 'local' && s.from === track) return;
      const local = singer(name, 'local');
      local.copy?.stop();
      local.copy = track.clone();
      local.from = track;
      local.connected = true;
      setStream(local, new MediaStream([local.copy]));
      changed();
    },
    handleSignal(from, signal) {
      if (closed) return;
      const s = singers.get(from);
      if (signal.description?.type === 'offer') {
        if (!enabled) { send(from, { link: signal.link, bye: true }); return; }
        answer(singer(from, 'remote'), from, signal as VoiceSignal & { description: NonNullable<VoiceSignal['description']> });
        return;
      }
      if (!s || s.link !== signal.link) return; // an older connection's
      if (signal.bye) { remove(s, false); return; }
      if (signal.candidate !== undefined && s.pc) {
        if (signal.candidate === null) { if (s.pc.remoteDescription) s.pc.addIceCandidate().catch(() => {}); return; }
        if (s.pc.remoteDescription) s.pc.addIceCandidate(signal.candidate).catch(() => {});
        else s.pending.push(signal.candidate);
      }
    },
    drop(name) {
      const s = singers.get(name);
      if (s) remove(s, s.kind === 'remote');
    },
    singers() {
      const now = performance.now();
      return [...singers.values()].map(s => ({
        name: s.name, kind: s.kind, phase: s.chain ? 'on' : 'connecting', level: s.level,
        rms: s.rms, open: s.open, gainDb: gainToDb(s.gain), capped: s.gain >= s.cap * 0.98,
        lagMs: s.lag === null ? null : Math.round(s.lag * 1000),
        couplingDb: s.coupling === null || s.coupling <= 0 ? null : Math.round(gainToDb(s.coupling) * 10) / 10,
        howls: s.howlTimes.length, ducked: now < s.duckUntil, route: s.route, jitterMs: s.jitterMs, lossPct: s.lossPct, packetsPerSec: s.packetsPerSec,
      }));
    },
    close() {
      for (const s of [...singers.values()]) remove(s, true);
      closed = true;
      stopTicks();
      dropBus();
      loopWorker?.terminate();
      loopWorker = null;
    },
  };
}
