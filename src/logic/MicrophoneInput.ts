import { createNoiseGate } from "./MicSharedFuns";
import pitchFinderWorkletUrl from "./PitchFinderWorklet.ts?worker&url";
import PitchWorkerMinimalUrl from "./PitchWorkerMinimal.ts?worker";
import PitchWorkerGpuUrl from "./PitchWorkerGpu.ts?worker";
import MicCaptureWorker from "./MicCaptureWorker.ts?worker";
import { UserAudioRecorder } from "./AudioRecorder";
import type { RecordingCapture } from "./AudioRecorder";
import { WINDOW_SAMPLES, HOP_SAMPLES, SHORT_WINDOW_SAMPLES } from "./pitchModel";
import { createInferenceScheduler } from "./inferenceScheduler";
import { createLevelCalibration } from "./levelCalibration";
import { createFrameAgeMeter, createLagWatch, createMicCapture } from "./micChunker";
import { PROVISIONAL, createProvisionalTracker } from "./provisionalPitch";
import type { CaptureOutput, DisplayChunk, FrameAge, MicCapture, MicCaptureMessage, MicCaptureRequest, MicCaptureWorkerOptions, MicChunk, MicLevel, PitchWorkletOptions, PitchWorkletRequest } from "./micChunker";
import type { PitchDetectRequest, PitchWorkerRequest, PitchWorkerResponse } from "./pitchModel";

/** One capture path's handle (openMicCapture): its chunks go to setOnChunk's callback */
export interface MicCaptureHandle {
  /** how the samples are read: a MediaStreamTrackProcessor, or the AudioWorklet */
  kind: 'trackProcessor' | 'worklet';
  nativeSampleRate: number;
  setOnChunk(fn: ((chunk: CaptureOutput) => void) | null): void;
  /** how old the frames are when read, as it stands (createFrameAgeMeter) */
  frameAge(): FrameAge | null;
  setActive(active: boolean): void;
  stop(): void;
}

/** What the pitch pipeline hands on for every window (setOnProcessing), gated ones included */
export interface ProcessedPitch {
  /** raw Hz, 0 = no pitch */
  freq: number;
  volume: number;
  /** a hissed consonant in the window's newest 30 ms (fricative.ts) */
  fric: 0 | 1;
  /** where the window ends on the capture clock (s) */
  pos?: number;
  /** the model's first and last frame of the window, whatever the voicing said (singingGate.ts); not on gated windows */
  hzFirst?: number;
  hzLast?: number;
}

/** setOnProcessing's callback */
export type PitchCallback = (msg: { data: ProcessedPitch }) => void;
/** setOnProvisional's callback: a pitch for the highway alone (provisionalPitch.ts), Hz */
export type ProvisionalCallback = (freq: number) => void;
/** setOnAudio's callback: every hop of 16 kHz audio (a copy) with its capture position */
export type MicAudioCallback = (samples: Float32Array<ArrayBuffer>, pos: number) => void;

/** Why joining failed, for the mic panel (micErrorKind) */
export type MicErrorKind = 'denied' | 'noDevice' | 'failed';

/** What initMicInput is doing: opening the microphone, or loading the pitch detector */
export type MicPhase = 'starting' | 'loading';

/** The pipeline's debug stats (the debug panel, the mic panel's meter) */
export interface MicStats {
  provider: string;          // 'wasm-min' | 'webgpu'
  active: boolean;           // false while the song is paused (pipeline idle)
  totalChunks: number;
  chunksPerSec: number;
  totalNotes: number;        // non-zero frequencies detected
  notesPerSec: number;
  gatedChunks: number;
  droppedChunks: number;     // skipped because the worker was still busy (a slow device)
  displayWindows: number;    // windows the provisional pitch ran on (provisionalPitch.ts)
  provisionals: number;      // ...and the pitches it gave the highway
  inputGain: number;         // the level calibration's boost of the model's input
  lastFreq: number;
  lastVolume: number;
  inferMs: number;           // mean inference time over the last second
  inferMsMax: number;        // slowest inference in the last second
  inferErrors: number;
  /** the noise gate's floor, from the first chunk on */
  noiseFloor?: number;
  _secChunks: number;
  _secNotes: number;
  _secInferSum: number;
  _secInferN: number;
  _secInferMax: number;
}

/** A fresh pipeline's stats, nothing counted yet */
export const createMicStats = (provider: string): MicStats => ({
  provider,          // 'wasm-min' | 'webgpu'
  active: true,      // false while the song is paused (pipeline idle)
  totalChunks: 0,
  chunksPerSec: 0,
  totalNotes: 0,     // non-zero frequencies detected
  notesPerSec: 0,
  gatedChunks: 0,
  droppedChunks: 0,  // skipped because the worker was still busy (a slow device)
  displayWindows: 0, // windows the provisional pitch ran on (provisionalPitch.ts)
  provisionals: 0,   // ...and the pitches it gave the highway
  inputGain: 1,      // the level calibration's boost of the model's input
  lastFreq: 0,
  lastVolume: 0,
  inferMs: 0,        // mean inference time over the last second
  inferMsMax: 0,     // slowest inference in the last second
  inferErrors: 0,
  _secChunks: 0,
  _secNotes: 0,
  _secInferSum: 0,
  _secInferN: 0,
  _secInferMax: 0,
});

/** The running microphone (initMicInput) */
export interface MicInput {
  setOnProcessing(fn: PitchCallback | null): void;
  setOnProvisional(fn: ProvisionalCallback | null): void;
  setOnAudio(fn: MicAudioCallback | null): void;
  /** song playing → full pipeline; paused → the capture idles (level only) and the recording pauses */
  setActive(value: boolean): void;
  stats: MicStats;
  recorder: UserAudioRecorder;
  /** the microphone's track, raw (the voices on the speakers send a copy: voiceLink.ts, voiceMixer.ts) */
  track: MediaStreamTrack;
  /** s: how much newer the sound in a window is than the singing delay counts on, to take off that delay (pitchModel.ts) */
  delayLead: number;
  stopMicInput(): void;
}

/** A window for the pitch worker, as the scheduler holds it */
type PitchJob = Omit<PitchDetectRequest, 'type'>;

const TARGET_SAMPLE_RATE = 16000; // swift-f0 model's native rate
const HOP_SECONDS = HOP_SAMPLES / TARGET_SAMPLE_RATE;
// The chunk clock jumps this far on a resume, so nothing from before a pause
// counts as "just now" for the voicing tracker (see createVoicingTracker)
const PAUSE_CLOCK_JUMP_S = 10;
const IDLE_LEVELS_PER_SEC = 10;   // input level updates while the song is paused
const SAME_POS_S = 0.002;         // a display chunk this near a chunk's end comes out of the same frame

/**
 * On iOS/Android, opening a mic MediaStream and connecting it to an AudioContext
 * causes the OS to switch to the "communication" audio category (call mode).
 * This routes audio to the earpiece, reduces volume, and degrades all audio
 * output quality — including the YouTube player running in another element.
 *
 * Workaround: use MediaStreamTrackProcessor (where available) to read mic
 * samples WITHOUT an AudioContext. The raw PCM frames are sent to a Worker
 * for pitch detection. No AudioContext = no call mode switch.
 *
 * Fallback (desktop / older browsers): use AudioContext + AudioWorklet as before.
 *
 * Both capture paths have an idle mode for a paused song (setActive(false)):
 * no resampling, no chunks and therefore no pitch inference, only a coarse
 * input level a few times a second for the microphone panel's meter.
 */

// Feature-detect MediaStreamTrackProcessor (Chrome 94+, Edge 94+, not Safari yet)
const hasTrackProcessor = typeof globalThis.MediaStreamTrackProcessor === 'function';

/**
 * Read the track processor's frames on the main thread, a microtask chain, into
 * `capture` (createMicCapture). Returns a function that stops reading.
 */
function readOnMainThread(readable: ReadableStream<AudioData>, capture: MicCapture, age: ReturnType<typeof createFrameAgeMeter>): () => void {
  const reader = readable.getReader();
  let running = true;
  (async () => {
    while (running) {
      const { value: frame, done } = await reader.read();
      if (done || !running) { frame?.close(); break; }

      // Extract float32 samples from the AudioData frame
      const channelData = new Float32Array(frame.numberOfFrames);
      frame.copyTo(channelData, { planeIndex: 0 });
      age.push(frame.timestamp, 1000 * frame.numberOfFrames / frame.sampleRate, performance.now());
      frame.close();
      capture.push(channelData, channelData.length);
    }
  })();
  return () => {
    running = false;
    reader.cancel().catch(() => {});
  };
}

/** Display chunks a capture path is to make (createChunker), none without */
type DisplayOptions = Pick<MicCaptureWorkerOptions, 'displaySamples' | 'displayHopSamples'>;

async function initViaTrackProcessor(stream: MediaStream, display: DisplayOptions = {}): Promise<MicCaptureHandle> {
  const track = stream.getAudioTracks()[0];
  const nativeSampleRate = track.getSettings().sampleRate || 48000;
  // We accumulate and downsample in JS since we don't have a worklet (the
  // same chunks as PitchFinderWorklet.ts, see micChunker.ts)
  const options: MicCaptureWorkerOptions = {
    nativeRate: nativeSampleRate,
    targetRate: TARGET_SAMPLE_RATE,
    windowSamples: WINDOW_SAMPLES,
    hopSamples: HOP_SAMPLES,
    ...display,
    levelsPerSec: IDLE_LEVELS_PER_SEC,
  };

  let onChunk: ((chunk: CaptureOutput) => void) | null = null; // callback: ({audio, volume, fric, pos}) => void
  let frameAge: FrameAge | null = null;
  let active = true;
  let stopped = false;

  // Read in a worker where the stream can be transferred there
  // (MicCaptureWorker.ts): the ~100 frames a second then never touch the main
  // thread, only the ~33 chunks do. `gen` counts setActive calls; the worker
  // tags what it sends with the latest it has seen, and anything older is
  // dropped, so no chunk arrives after a pause (as with the main-thread loop).
  let worker: Worker | null = null;
  let gen = 0;
  let heard = false; // the worker has sent something

  // ...else on the main thread
  let mainCapture: MicCapture | null = null;
  let stopReading: (() => void) | null = null;
  const mainAge = createFrameAgeMeter();
  const readHere = (readable: ReadableStream<AudioData>) => {
    mainCapture = createMicCapture({
      ...options,
      onChunk: chunk => { if (onChunk) onChunk(chunk); },
      onDisplay: chunk => { if (onChunk) onChunk(Object.assign(chunk, { display: 1 as const })); },
      onLevel: volume => { if (onChunk) onChunk({ volume }); },
    });
    mainCapture.setActive(active);
    stopReading = readOnMainThread(readable, mainCapture, mainAge);
  };
  // A worker that cannot read at all hands over before it sent anything
  const takeOver = () => {
    worker?.terminate();
    worker = null;
    if (!stopped && !heard) readHere(new MediaStreamTrackProcessor({ track }).readable);
  };

  const processor = new MediaStreamTrackProcessor({ track });
  try {
    worker = new MicCaptureWorker();
    worker.onmessage = ({ data }: MessageEvent<MicCaptureMessage>) => {
      if (data.type === 'failed') { takeOver(); return; }
      if (data.type === 'frameAge') { frameAge = data.age; return; }
      heard = true;
      if (data.gen === gen && onChunk) onChunk(data);
    };
    worker.onerror = takeOver;
    worker.postMessage({ type: 'start', readable: processor.readable, options } satisfies MicCaptureRequest, [processor.readable]);
  } catch {
    // no transferable streams: the stream is still ours
    worker?.terminate();
    worker = null;
    readHere(processor.readable);
  }

  return {
    kind: 'trackProcessor',
    nativeSampleRate,
    setOnChunk: fn => { onChunk = fn; },
    frameAge: () => frameAge ?? mainAge.read(),
    setActive: (value) => {
      if (value === active) return;
      active = value;
      if (worker) worker.postMessage({ type: 'active', active: value, gen: ++gen } satisfies MicCaptureRequest);
      else mainCapture?.setActive(value);
    },
    stop: () => {
      stopped = true;
      worker?.terminate();
      worker = null;
      stopReading?.();
      track.stop();
    },
  };
}

/** The AudioWorklet path's context, started ahead of the microphone (fastPitchFlag.ts). resume() never settles without a user gesture: it gets a moment, no more. */
async function startContextEarly(): Promise<AudioContext | null> {
  try {
    const context = new AudioContext({ latencyHint: 'interactive' });
    await Promise.race([context.resume(), new Promise(resolve => setTimeout(resolve, 150))]);
    return context;
  } catch { return null; }
}

async function initViaAudioWorklet(stream: MediaStream, display: DisplayOptions = {}, started: AudioContext | null = null): Promise<MicCaptureHandle> {
  // Desktop fallback — AudioContext won't cause call-mode issues on desktop
  const context = started ?? new AudioContext({ latencyHint: 'interactive' });
  // (a context started early may stand 'interrupted' now that capture took the audio session)
  if (context.state !== 'running' && started) await Promise.race([context.resume(), new Promise(resolve => setTimeout(resolve, 500))]);
  else if (context.state === 'suspended') await context.resume();
  const source = context.createMediaStreamSource(stream);

  await context.audioWorklet.addModule(pitchFinderWorkletUrl);
  const workletNode = new AudioWorkletNode(context, 'pitch-finder-worklet', {
    processorOptions: {
      nativeSampleRate: context.sampleRate,
      targetSampleRate: TARGET_SAMPLE_RATE,
      ...display,
    } satisfies PitchWorkletOptions,
  });

  source.connect(workletNode);
  // Do NOT connect to destination — worklet sends data via postMessage

  let onChunk: ((chunk: CaptureOutput) => void) | null = null;
  workletNode.port.onmessage = ({ data }: MessageEvent<CaptureOutput>) => {
    if (onChunk) onChunk(data);
  };

  return {
    kind: 'worklet',
    nativeSampleRate: context.sampleRate,
    setOnChunk: fn => { onChunk = fn; },
    frameAge: () => null, // an AudioWorklet's frames carry no capture time
    setActive: active => workletNode.port.postMessage({ type: 'active', active } satisfies PitchWorkletRequest),
    stop: () => {
      workletNode.port.onmessage = null;
      stream.getTracks().forEach(t => t.stop());
      source.disconnect();
      workletNode.disconnect();
      if (context.state !== 'closed') context.close();
    },
  };
}

/**
 * The microphone's audio without the pitch detector, for the entry page's
 * listen button (logic/songListener.ts): the same two capture paths, so a
 * phone is not switched to call mode either. Chunks of 960 samples at 16 kHz,
 * each 480 newer than the last ({ audio, volume, pos }).
 */
export const openMicCapture = (stream: MediaStream): Promise<MicCaptureHandle> => (hasTrackProcessor ? initViaTrackProcessor(stream) : initViaAudioWorklet(stream));

/** Start a pitch worker and wait for its model to load. Resolves { worker, provider }. */
const startPitchWorker = (WorkerCtor: new () => Worker, modelPath: string, samples?: number) => new Promise<{ worker: Worker, provider: string }>((resolve, reject) => {
  const worker = new WorkerCtor();
  worker.onmessage = ({ data }: MessageEvent<PitchWorkerResponse>) => {
    if (data.type !== 'init') return;
    if (data.status === 'ok') resolve({ worker, provider: data.provider || 'wasm' });
    else { worker.terminate(); reject(new Error(data.error)); }
  };
  worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message || 'pitch worker failed to load')); };
  worker.postMessage({ type: 'init', modelUrl: new URL(modelPath, window.location.origin).href, samples } satisfies PitchWorkerRequest);
});

/**
 * Why joining failed, for the mic panel: 'denied' (the browser or the user
 * refused access), 'noDevice' (none, or the remembered one is gone) or 'failed'.
 */
export const micErrorKind = (e: unknown): MicErrorKind => {
  switch (typeof e === 'object' && e !== null && 'name' in e ? e.name : undefined) {
    case 'NotAllowedError': case 'SecurityError': case 'PermissionDeniedError': return 'denied';
    case 'NotFoundError': case 'OverconstrainedError': case 'DevicesNotFoundError': return 'noDevice';
    default: return 'failed';
  }
};

/**
 * @param [options]
 *   deviceId: a specific input device (from enumerateDevices), default otherwise
 *   gpu: try the WebGPU pitch worker first (opt-in, see pitchGpuFlag.ts); WASM if it cannot start
 *   provisional: the highway's earlier pitch (opt-in, see fastPitchFlag.ts)
 *   earlyContext: start the AudioWorklet path's AudioContext before the microphone (opt-in, see fastPitchFlag.ts)
 *   shortWindow: the scored windows hold SHORT_WINDOW_SAMPLES (opt-in, see fastPitchFlag.ts); not on the WebGPU worker, whose model has 960
 *   onPhase: 'starting' while the browser opens the microphone (and may ask
 *     for permission), 'loading' while the pitch detector loads, which the
 *     first time means downloading ~1 MB (runtime and model, compressed)
 */
export const initMicInput = async ({ deviceId, gpu = false, provisional = false, earlyContext = false, shortWindow = false, onPhase }: { deviceId?: string, gpu?: boolean, provisional?: boolean, earlyContext?: boolean, shortWindow?: boolean, onPhase?: (phase: MicPhase) => void } = {}): Promise<MicInput> => {
  onPhase?.('starting');
  const earlyAudioContext = earlyContext && !hasTrackProcessor ? await startContextEarly() : null;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  }).catch((e: unknown) => {
    earlyAudioContext?.close();
    throw e;
  });

  // --- ONNX Worker setup ---
  onPhase?.('loading');
  let onnxWorker: Worker | null = null;
  let provider = 'wasm-min';
  if (gpu) {
    try {
      ({ worker: onnxWorker, provider } = await startPitchWorker(PitchWorkerGpuUrl, '/model-gpu.onnx'));
    } catch (e) {
      console.warn('[pitch] WebGPU worker unavailable, using WASM:', (e as Error).message);
    }
  }
  if (!onnxWorker) {
    try {
      // Our minimal ONNX Runtime (tools/ort-minimal): single-threaded, so it
      // starts on old Safari too, where the stock runtimes needed a fallback
      ({ worker: onnxWorker, provider } = await startPitchWorker(PitchWorkerMinimalUrl, '/model.ort', shortWindow ? SHORT_WINDOW_SAMPLES : undefined));
    } catch (e) {
      stream.getTracks().forEach(t => t.stop()); // no detector: let go of the microphone
      earlyAudioContext?.close();
      throw e;
    }
  }

  // The provisional pitch has a worker of its own: an inference of its in the
  // way would hold up a scored window, and a note's stamp is the moment its
  // pitch comes back. A device short of cores pays in its own speed, watched
  // below (maxInferMs). No such worker: no provisional pitch, nothing else changes.
  let displayWorker: Worker | null = null;
  if (provisional) {
    try {
      ({ worker: displayWorker } = await startPitchWorker(PitchWorkerMinimalUrl, '/model.ort'));
    } catch (e) {
      console.warn('[pitch] no provisional pitch:', (e as Error).message);
    }
  }

  const scoredSamples = shortWindow && provider !== 'webgpu' ? SHORT_WINDOW_SAMPLES : WINDOW_SAMPLES;

  // Callback that the consumer sets via setOnProcessing
  let processingCallback: PitchCallback | null = null;
  // ...and via setOnProvisional
  let provisionalCallback: ProvisionalCallback | null = null;
  // ...and via setOnAudio: every hop of 16 kHz audio with its capture position
  let audioCallback: MicAudioCallback | null = null;

  // --- Debug stats ---
  const stats = createMicStats(provider);
  const statsInterval = setInterval(() => {
    stats.chunksPerSec = stats._secChunks;
    stats.notesPerSec = stats._secNotes;
    stats.inferMs = stats._secInferN ? stats._secInferSum / stats._secInferN : 0;
    stats.inferMsMax = stats._secInferMax;
    stats._secChunks = 0;
    stats._secNotes = 0;
    stats._secInferSum = 0;
    stats._secInferN = 0;
    stats._secInferMax = 0;
  }, 1000);

  // One inference at a time, the newest window next: a device slower than
  // real time skips windows instead of falling ever further behind
  const scheduler = createInferenceScheduler(({ audio, volume, t, fric, pos }: PitchJob) => {
    onnxWorker.postMessage({ type: 'detect', audio, volume, t, fric, pos } satisfies PitchWorkerRequest, [audio.buffer]);
  });

  // A quiet mic's voice is boosted toward a common level before the model
  // (the gate and the level shown stay on the raw input)
  const calibration = createLevelCalibration({ stepSeconds: HOP_SECONDS });

  const fast = createProvisionalTracker();
  let displayBusy = false; // one window at a time and none waits: the next will be newer
  const tellProvisional = (rawHz: number, rawConf: number, pos: number) => {
    const freq = fast.pick(rawHz, rawConf, pos);
    if (!freq) return;
    stats.provisionals++;
    provisionalCallback?.(freq);
  };
  if (displayWorker) displayWorker.onmessage = ({ data }: MessageEvent<PitchWorkerResponse>) => {
    if (data.type !== 'detect') return;
    displayBusy = false;
    if (data.rawHz !== undefined && data.rawConf !== undefined && data.pos !== undefined) tellProvisional(data.rawHz, data.rawConf, data.pos);
  };

  // Handle ONNX worker results
  onnxWorker.onmessage = ({ data }: MessageEvent<PitchWorkerResponse>) => {
    if (data.type === 'detect') {
      scheduler.done();
      stats.droppedChunks = scheduler.dropped;
      // A scored window is a provisional one too, at no cost: the model has
      // answered, whatever the tracker made of it
      if (displayWorker && data.pos !== undefined) {
        fast.scored(data.pitchHz, data.pos);
        if (!data.pitchHz && data.rawHz !== undefined && data.rawConf !== undefined) tellProvisional(data.rawHz, data.rawConf, data.pos);
      }
      calibration.update({ volume: data.volume, pitchHz: data.rawHz, confidence: data.rawConf });
      stats.inputGain = calibration.gain();
      const freq = data.pitchHz; // raw Hz (0 = no pitch detected)
      stats.lastFreq = freq;
      if (freq > 0) {
        stats.totalNotes++;
        stats._secNotes++;
      }
      if (data.ms != null) {
        stats._secInferSum += data.ms;
        stats._secInferN++;
        if (data.ms > stats._secInferMax) stats._secInferMax = data.ms;
      }
      if (data.error) stats.inferErrors++;
      if (processingCallback) {
        // hzFirst/hzLast: the model's first and last frame of the window, whatever the voicing said (singingGate.ts)
        processingCallback({ data: { freq, volume: data.volume, fric: data.fric ? 1 : 0, pos: data.pos, hzFirst: data.firstHz ?? 0, hzLast: data.rawHz ?? 0 } });
      }
    }
  };

  // --- Audio capture ---
  // Use MediaStreamTrackProcessor on mobile to avoid AudioContext call-mode.
  // Fall back to AudioWorklet on desktop / older browsers.
  const display: DisplayOptions = displayWorker ? { displaySamples: PROVISIONAL.samples, displayHopSamples: PROVISIONAL.hopSamples } : {};
  const capture = hasTrackProcessor
    ? await initViaTrackProcessor(stream, display)
    : await initViaAudioWorklet(stream, display, earlyAudioContext);

  // Where the capture is in its audio (seconds taken in while active), for
  // the recording to place each pitch in what it recorded: the newest
  // chunk's end, plus the time since it arrived while running
  let lastPos = 0, lastPosAt: number | null = null, captureActive = true;
  const capturePosition = () =>
    lastPosAt === null || !captureActive ? lastPos : lastPos + (performance.now() - lastPosAt) / 1000;

  const track = stream.getAudioTracks()[0];
  const captureFacts: RecordingCapture = {
    path: capture.kind,                          // how the samples are read (MicrophoneInput.ts)
    pitch: provider,                             // which pitch worker ran: 'wasm-min' | 'webgpu' (older recordings: 'wasm', 'wasm-1.18')
    sampleRate: capture.nativeSampleRate,
    inputLatency: track?.getSettings?.().latency ?? null, // the browser's own estimate, where it gives one
    windowSeconds: scoredSamples / TARGET_SAMPLE_RATE,
    hopSeconds: HOP_SECONDS,
  };
  const recorder = new UserAudioRecorder(stream, {
    position: capturePosition,
    capture: captureFacts,
  });
  // How late the sound really reaches us on this device, for later: both
  // measures as they stand, a recording uploads what is here when it ends
  const lagWatch = createLagWatch();
  const captureAge = () => {
    captureFacts.lagGrowthMs = lagWatch.grown();
    captureFacts.frameAge = capture.frameAge() ?? undefined;
    const trackStats = track?.stats;
    if (trackStats) captureFacts.trackLatency = { last: trackStats.latency, average: trackStats.averageLatency, min: trackStats.minimumLatency, max: trackStats.maximumLatency };
  };

  const ageInterval = setInterval(captureAge, 5000);

  const noiseGate = createNoiseGate({ stepSeconds: HOP_SECONDS });
  // Audio time of each chunk, advancing one hop per chunk (gated ones too):
  // the voicing tracker's clock. Chunks can arrive in bursts, so wall-clock
  // time would not do.
  let chunkClock = 0;
  // fric: the chunk's newest 30 ms held a hissed consonant (fricative.ts). It
  // rides along with the pitch; a gated chunk keeps it too, since a quiet "s"
  // is mostly above what the 16 kHz level measures.
  const onDisplayChunk = ({ audio, volume, pos }: DisplayChunk) => {
    const between = pos - lastPos > SAME_POS_S;
    if (!displayWorker || displayBusy || !fast.wanted(pos, stats.inferMs, between) || noiseGate.wouldGate(volume)) return;
    const gain = calibration.gain(); // the same input the scored stream's model sees
    if (gain !== 1) for (let i = 0; i < audio.length; i++) audio[i] *= gain;
    displayBusy = true;
    stats.displayWindows++;
    displayWorker.postMessage({ type: 'detect', audio, volume, pos, display: 1 } satisfies PitchWorkerRequest, [audio.buffer]);
  };

  capture.setOnChunk((chunk: CaptureOutput) => {
    if ('display' in chunk) { onDisplayChunk(chunk); return; }
    const { audio, volume, fric = 0, pos }: Partial<MicChunk> & MicLevel = chunk;
    stats.lastVolume = volume;
    if (!audio) return; // song paused: only the level for the mic panel's meter
    if (pos !== undefined) { lastPos = pos; lastPosAt = performance.now(); lagWatch.push(lastPosAt, pos); }
    // The newest hop, quiet ones included (they are mostly the speakers): for
    // measuring how late the music reaches this mic (bleedController.ts)
    if (audioCallback && pos !== undefined) audioCallback(audio.slice(audio.length - HOP_SAMPLES), pos);

    stats.totalChunks++;
    stats._secChunks++;
    stats.noiseFloor = noiseGate.getNoiseFloor();
    chunkClock += HOP_SECONDS;

    if (noiseGate.shouldGate(volume)) {
      stats.gatedChunks++;
      if (processingCallback) {
        processingCallback({ data: { freq: 0, volume, fric, pos } });
      }
      return;
    }

    const gain = calibration.gain();
    if (gain !== 1) for (let i = 0; i < audio.length; i++) audio[i] *= gain;
    scheduler.submit({ audio, volume, t: chunkClock, fric, pos });
  });

  // Song playing → full pipeline; song paused → capture idles (level only),
  // no inference, and the recording pauses with it.
  let active = true;
  const setActive = (value: boolean) => {
    const next = !!value;
    if (next === active) return;
    active = next;
    stats.active = next;
    if (next) chunkClock += PAUSE_CLOCK_JUMP_S;
    else scheduler.clear();
    fast.reset();
    lagWatch.restart();
    // the capture position stands still while paused, like the recording
    lastPos = capturePosition();
    lastPosAt = null;
    captureActive = next;
    capture.setActive(next);
    recorder.setPaused(!next);
  };

  return {
    setOnProcessing: (fn: PitchCallback | null) => { processingCallback = fn; },
    setOnProvisional: (fn: ProvisionalCallback | null) => { provisionalCallback = fn; },
    setOnAudio: (fn: MicAudioCallback | null) => { audioCallback = fn; },
    setActive,
    stats,
    recorder,
    track,
    delayLead: (WINDOW_SAMPLES - scoredSamples) / TARGET_SAMPLE_RATE,
    stopMicInput: () => {
      processingCallback = null;
      provisionalCallback = null;
      audioCallback = null;
      clearInterval(statsInterval);
      clearInterval(ageInterval);
      captureAge();
      capture.stop();
      onnxWorker.terminate();
      displayWorker?.terminate();
      recorder.stopAndUpload();
    },
  };
};
