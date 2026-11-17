// pitchModel.ts — what both pitch workers share about swift-f0's output.
//
// The WASM worker runs swift-f0 0.3.0 (upstream's second network, September
// 2026) as tools/ort-minimal/make_model.py wraps it into public/model.onnx:
// MODEL_SAMPLES in, three frames out (16 ms apart, newest last), confidence on
// the first network's scale, which everything below was tuned on. The opt-in
// WebGPU worker still runs the first network (0.1.x) on WINDOW_SAMPLES.

export const WINDOW_SAMPLES = 960; // 60 ms at 16 kHz, the window MicrophoneInput's capture cuts
// A new window every 30 ms. How often the voice is sampled does not change the
// score (each note counts for the time since the previous one), so this is the
// cheapest rate that keeps scores steady: half the model calls of the 15 ms it
// used to be. PitchFinderWorklet.ts keeps its own copy of the constant.
export const HOP_SAMPLES = 480;
// What the WASM worker's model reads: each window with the 320 samples before
// it (80 ms). The second network judges a frame from the frames around it and
// wants that much past; the model itself appends the newest 512 samples once
// more, backwards, as the future it would like (make_model.py).
export const MODEL_SAMPLES = 1280;
const PAST_SAMPLES = MODEL_SAMPLES - WINDOW_SAMPLES;
// Its newest frame is centred 16 ms behind the newest sample; the first
// network's, which the singing delays were set on, 20 ms. So every pitch is
// 4 ms newer, and a note is stamped 4 ms less back (MicInput.delayLead).
export const MODEL_DELAY_LEAD = 0.004;
// How the pitch moves within a window, for the singing gate (singingGate.ts: its "pwithin", the model's first
// frame against its last, 32 ms apart): the second network's pitch wavers about twice as much from frame to
// frame as the first's did (0.40 semitones between two frames it is sure of, against 0.18), and the gate's
// weights were fitted on the first's. Read as it came, real singers were held back as talkers three times as
// often (11 % of their windows instead of 3 %, on 109 real takes). The step between the two frames is scaled
// by this, in semitones, before the gate reads it: singers are held 5.5 % of the time and earn within 1 % of
// what they earn with the gate off; a voice that talks through a song (other songs' rap vocals over the
// speakers' sound, 32 made-up recordings: there is no recorded party talk to test on) is held 73 and 83 % of
// the time against the first network's 57 and 63 %, and earns no more than it did (582 and 240 of 10,000
// against 607 and 240). Unscaled it earned less (354 and 7), at the singers' cost.
export const STEADY_SCALE = 0.75;

// The voicing threshold (on the first network's scale, which make_model.py maps the second's onto) and the range
export const CONFIDENCE_THRESHOLD = 0.85;
export const MIN_PITCH_HZ = 46.875;
export const MAX_PITCH_HZ = 2093.75;

/** swift-f0's per-frame output for one window (pitch in Hz or confidence 0…1), last = newest. */
export type PitchFrames = ArrayLike<number>;

/** A window for a pitch worker (MicrophoneInput → PitchWorkerMinimal.ts / PitchWorkerGpu.ts) */
export interface PitchDetectRequest {
  type: 'detect';
  /** WINDOW_SAMPLES at 16 kHz (transferred) */
  audio: Float32Array<ArrayBuffer>;
  volume: number;
  /** the chunk clock (s); the worker's own clock when missing */
  t?: number;
  /** the consonant flag (fricative.ts) and the capture position, passed through */
  fric?: number;
  pos?: number;
  /** a display window (provisionalPitch.ts): the model's answer only, it goes past the voicing tracker */
  display?: 1;
}

/** Messages to a pitch worker: load the model, then one window at a time */
export type PitchWorkerRequest = { type: 'init', modelUrl: string } | PitchDetectRequest;

/** A pitch worker's answer to one window */
export interface PitchDetectResult {
  type: 'detect';
  /** the pitch the voicing tracker accepts, Hz (0 = none) */
  pitchHz: number;
  /** the model's own last frame (pitch, confidence), whatever the voicing said (levelCalibration.ts) */
  rawHz?: number;
  rawConf?: number;
  /** its first frame: how the pitch moves within the window (singingGate.ts) */
  firstHz?: number;
  volume: number;
  fric?: number;
  pos?: number;
  /** the inference's time */
  ms: number;
  /** the inference failed (pitchHz 0) */
  error?: string;
}

/** A pitch worker's messages */
export type PitchWorkerResponse =
  | { type: 'init', status: 'ok', provider: string }
  | { type: 'init', status: 'error', error: string }
  | PitchDetectResult;

/**
 * The pitch of the most recent frame (swift-f0 returns one per STFT frame,
 * hop 256 at 16 kHz ≈ 16 ms), or 0 unless the model is confident and the
 * value is in the singing range. Every window on its own; the workers use
 * createVoicingTracker, which also looks at the windows before.
 */
export function pickPitch(pitchHz: PitchFrames = [], confidence: PitchFrames = []): number {
  const n = pitchHz.length;
  if (!n) return 0;
  const p = pitchHz[n - 1];
  return confidence[n - 1] >= CONFIDENCE_THRESHOLD && p >= MIN_PITCH_HZ && p <= MAX_PITCH_HZ ? p : 0;
}

export const VOICING = {
  hi: CONFIDENCE_THRESHOLD, // a window starts a pitch at this confidence, as pickPitch
  strict: 0.95,  // …but below this it must continue one (the previous window or its own earlier frame)
  continueSt: 1, // semitones for that continuation
  continueS: 0.035, // s: how old the previous accepted window may be
  anchor: 0.98,  // a window this confident anchors a hold
  holdS: 0.3,    // s: the hold after the last anchor
  holdSt: 2,     // semitones from the anchor pitch while holding (octave-folded, like the score)
  holdMin: 0.2,  // confidence still accepted while holding; below it the model's pitch is noise
  bridgeS: 0.07, // s: a window below `hi` needs an accepted window this recently: it may bridge a
                 // miss or two but never start a note (a consonant or breath drawn as the note's
                 // start, early; lone low-confidence windows drawn as dots)
  phraseS: 2,    // s: the phrase window (0 turns the phrase rule off)
  phraseAnchorS: 0.6, // s of anchor windows within phraseS that make a phrase
  phraseMin: 0.5, // confidence accepted inside a phrase
  spanCapS: 0.05, // s: an anchor counts for the time since the previous window, at most this
};

/** The voicing rules' knobs (VOICING); createVoicingTracker takes any of them as overrides. */
export type VoicingOptions = Partial<typeof VOICING>;

/** One pitch stream's voicing decision (createVoicingTracker). */
export interface VoicingTracker {
  /** swift-f0's frames for one window (last = newest) → Hz, or 0 for no pitch. */
  pick(pitchHz: PitchFrames, confidence: PitchFrames, t: number): number;
}

/** The scored stream's model input, window by window (createModelWindows) */
export interface ModelWindows {
  /** A window (WINDOW_SAMPLES, each HOP_SAMPLES newer than the last) → MODEL_SAMPLES: the samples before it, then it. A new array. */
  next(window: Float32Array): Float32Array<ArrayBuffer>;
  /** A window that is not judged (the noise gate's): its samples are still the past of the next. */
  skip(window: Float32Array): void;
  /** The stream broke off (a pause): silence before the next window, as before the first. */
  reset(): void;
}

/**
 * Puts the PAST_SAMPLES before each window in front of it, out of the window
 * before (its samples [HOP - PAST, HOP)), so the model gets MODEL_SAMPLES of
 * continuous sound without the capture cutting longer windows.
 */
export function createModelWindows(): ModelWindows {
  let past: Float32Array | null = null;
  const keep = (window: Float32Array) => { past = window.slice(HOP_SAMPLES - PAST_SAMPLES, HOP_SAMPLES); };
  return {
    next(window) {
      const out = new Float32Array(MODEL_SAMPLES);
      if (past) out.set(past);
      out.set(window.subarray(window.length - WINDOW_SAMPLES), PAST_SAMPLES);
      keep(window);
      return out;
    },
    skip: keep,
    reset() { past = null; },
  };
}

const semitones = (hz: number) => 12 * Math.log2(hz / 440);
const inRange = (p: number) => p >= MIN_PITCH_HZ && p <= MAX_PITCH_HZ;

/**
 * The voicing decision for a stream of windows, replacing pickPitch.
 *
 * swift-f0 judges every window alone, and a sung phrase loses each
 * window where the model wavers below 0.85: fast rap and soft or breathy
 * singing most of all. The tracker keeps listening for a moment after a window
 * it is sure of, and asks borderline windows to continue something, which is
 * what separates a voice from instruments:
 *   1. entry  confidence ≥ 0.85, but a window below 0.95 must continue the
 *             previous accepted window (≤ 35 ms, ≤ 1 semitone) or agree with
 *             its own second-to-last frame (≥ 0.85, ≤ 1 semitone). Lone
 *             borderline hits are mostly instruments.
 *   2. hold   for 0.3 s after an anchor (confidence ≥ 0.98): confidence ≥ 0.2
 *             within 2 semitones of the anchor's pitch, octave-folded.
 *   3. phrase with ≥ 0.6 s of anchors in the last 2 s: confidence ≥ 0.5.
 * Rules 2 and 3 only continue a note: a window below 0.85 needs an accepted
 * window within the last 70 ms, so they bridge a miss or two but never start
 * a note on a consonant or a breath (which drew notes starting early) or
 * stand alone (drawn as dots).
 * It only looks at this and earlier windows and always reports this window's
 * own last-frame pitch, so notes keep their time. Measured on real recordings
 * with the level calibration: singers 6/6 better on a held-out set (+279 on
 * average), note starts as early as before, no more false pitches on music
 * without a voice than pickPitch.
 *
 * `t` is the window's time in seconds on a clock that runs with the audio
 * (MicrophoneInput's chunk clock), not performance.now(): windows reach the
 * worker in bursts.
 */
export function createVoicingTracker(options: VoicingOptions = {}): VoicingTracker {
  const P = { ...VOICING, ...options };
  let anchorT = -Infinity, anchorSt = 0; // last anchor window
  let lastT = -Infinity, lastSt = 0;     // last accepted window
  let prevT: number | null = null;       // previous window seen
  let anchors: [number, number][] = [];  // [t, span] of anchors within phraseS, oldest first
  let head = 0;
  let anchorSum = 0;

  return {
    /** swift-f0's frames for one window (last = newest) → Hz, or 0 for no pitch. */
    pick(pitchHz, confidence, t) {
      const n = pitchHz.length;
      if (!n) return 0;
      const span = prevT === null ? P.spanCapS : Math.min(t - prevT, P.spanCapS);
      prevT = t;
      if (P.phraseS) {
        while (head < anchors.length && t - anchors[head][0] > P.phraseS) anchorSum -= anchors[head++][1];
        if (head > 512) { anchors = anchors.slice(head); head = 0; }
      }
      const p = pitchHz[n - 1];
      const c = confidence[n - 1];
      if (!inRange(p)) return 0;
      const st = semitones(p);

      let ok = false;
      if (c >= P.hi) { // 1. entry
        ok = true;
        if (c < P.strict) {
          ok = t - lastT <= P.continueS + 1e-9 && Math.abs(st - lastSt) <= P.continueSt;
          if (!ok && n >= 2) {
            const p1 = pitchHz[n - 2];
            ok = confidence[n - 2] >= P.hi && inRange(p1) && Math.abs(semitones(p1) - st) <= P.continueSt;
          }
        }
      }
      const bridges = c >= P.hi || t - lastT <= P.bridgeS + 1e-9; // unsure windows only continue a note
      if (!ok && bridges && c >= P.holdMin && t - anchorT <= P.holdS + 1e-9) { // 2. hold
        let d = st - anchorSt;
        d -= Math.round(d / 12) * 12;
        ok = Math.abs(d) <= P.holdSt;
      }
      if (!ok && bridges && P.phraseS && c >= P.phraseMin && anchorSum >= P.phraseAnchorS - 1e-9) ok = true; // 3. phrase
      if (!ok) return 0;

      lastT = t;
      lastSt = st;
      if (c >= P.anchor) {
        anchorT = t;
        anchorSt = st;
        if (P.phraseS) { anchors.push([t, span]); anchorSum += span; }
      }
      return p;
    },
  };
}
