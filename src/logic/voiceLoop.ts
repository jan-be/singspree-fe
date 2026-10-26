/**
 * voiceLoop.ts — how late a singer's voice comes out of the host's speakers,
 * and how much of the speakers comes back into their microphone (the host's
 * side of the voices on the speakers, voiceMixer.ts).
 *
 * The host's page plays the music and receives each singer's microphone. The
 * microphone hears the speakers too, so the music the page played turns up in
 * the singer's stream again, after the whole round: the page's output, the
 * TV or speaker, the room, the phone's microphone, the network, the jitter
 * buffer. That round is the lag a voice has against the music it was sung to
 * (the same way out, so the voice comes out of the speakers this late), and
 * how loud the music comes back is how much of a voice would come back too:
 * the loop's gain, which must stay well below 1 or the speakers howl.
 *
 * Both come from a whitened cross-correlation (GCC-PHAT, as bleedDelay.ts) of
 * the singer's stream with the music the page played, over 6 s windows at
 * 8 kHz (band-passed to 300–3400 Hz by the guard worklet), summed with the
 * earlier windows (older ones fading): the peak is the lag, and the
 * least-squares gain of the stream on the music at that lag is the coupling.
 * The singer's own voice is in the stream as well; it does not correlate with
 * the music, so it only makes the curve noisier while they sing.
 *
 * Pure functions plus one estimator; VoiceLoopWorker.ts runs them off the
 * main thread.
 */
import { fft, RATE } from './bleedDelay';

export { RATE };
export const WINDOW_S = 6;       // s of the singer's stream per correlation
export const LAG_MAX_S = 1.2;    // s: the longest round looked for (a Bluetooth speaker alone is 0.5 s)
export const STEP_S = 3;         // s between windows
export const Z_MIN = 6;          // how far the peak must stand out to be trusted (as bleedDelay.ts)
/**
 * Music coming back quieter than this (−50 dB) is no loop: a peak then is
 * chance (a held sung note correlates with something now and then, whitened),
 * not the speakers. A phone in the room hears them at −10 to −35 dB.
 */
export const COUPLING_MIN = 10 ** (-50 / 20);
const LAG_MIN_S = 0.005;         // a round is never shorter than this; a peak at 0 is a page feeding itself
const EDGE = 0.01;               // s: a peak this close to the search's end does not count
const FADE = 0.6;                // each new window weighs this much more than everything before
const AGREE_S = 0.015;           // a window's own peak this close to the sum's agrees with it
const AGREE = [3, 5] as const;   // 3 of the last 5 windows must agree: a real loop is there every time, a chance peak is not
const SMOOTH = Math.round(RATE / 1000);   // 1 ms box on the summed curve
const EXCLUDE = Math.round(0.01 * RATE);  // ±10 ms around the peak are not "the rest"

export const WINDOW = WINDOW_S * RATE;                // 48,000 samples of the stream
export const LMAX = Math.round(LAG_MAX_S * RATE);     // 9,600 lags
export const REF_LEN = WINDOW + LMAX;                 // the music around a window: LAG_MAX_S before it
const N = 1 << Math.ceil(Math.log2(REF_LEN));         // 65,536: no wrap-around for the lags searched

/**
 * Whitened cross-correlation of a stream window with the music around it.
 * x: WINDOW samples of the singer's stream; r: the music the page played
 * from LAG_MAX_S before x's first sample to x's last (REF_LEN samples), on
 * the same clock. Returns c[d], d = 0..LMAX: the correlation at a lag of d
 * samples (the stream d / RATE seconds behind the music).
 */
export function loopCurve(x: Float32Array, r: Float32Array): Float64Array {
  const re = new Float64Array(N), im = new Float64Array(N);
  re.set(x.subarray(0, Math.min(x.length, WINDOW)));
  im.set(r.subarray(0, Math.min(r.length, N)));
  fft(re, im);                                   // both real signals in one transform
  const gr = new Float64Array(N), gi = new Float64Array(N);
  for (let k = 1; k < N / 2; k++) {
    const m = N - k;
    const xr = (re[k] + re[m]) / 2, xi = (im[k] - im[m]) / 2;
    const yr = (im[k] + im[m]) / 2, yi = -(re[k] - re[m]) / 2;
    const cr = xr * yr + xi * yi, ci = xr * yi - xi * yr;   // conj(X) * Y, whitened
    const mag = Math.hypot(cr, ci);
    if (mag < 1e-20) continue;
    gr[k] = cr / mag; gi[k] = ci / mag;
    gr[m] = gr[k]; gi[m] = -gi[k];
  }
  fft(gr, gi, true);
  // gr[k] = sum_t x[t] r[t + k]; x[t] lines up with r[t + LMAX] at no lag, so lag d is k = LMAX - d
  const c = new Float64Array(LMAX + 1);
  for (let d = 0; d <= LMAX; d++) c[d] = gr[LMAX - d];
  return c;
}

/** Where a summed curve peaks (lag, s) and how far the peak stands out of the rest (robust z) */
export function loopPeak(acc: Float64Array): { lag: number; z: number } {
  const n = acc.length;
  const sm = new Float64Array(n);
  let run = 0;
  const half = SMOOTH >> 1;
  for (let i = 0; i < n + half; i++) {
    if (i < n) run += acc[i];
    if (i - SMOOTH >= 0) run -= acc[i - SMOOTH];
    const c = i - half;
    if (c >= 0 && c < n) sm[c] = run / SMOOTH;
  }
  const lo = Math.round(LAG_MIN_S * RATE);
  let k = lo;
  for (let i = lo; i < n; i++) if (sm[i] > sm[k]) k = i;
  let top = k;
  for (let i = Math.max(lo, k - SMOOTH); i <= Math.min(n - 1, k + SMOOTH); i++) if (acc[i] > acc[top]) top = i;
  const rest = new Float64Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) if (i < k - EXCLUDE || i > k + EXCLUDE) rest[m++] = sm[i];
  const sorted = rest.subarray(0, m).sort();
  const med = sorted[m >> 1];
  const dev = sorted.map(v => Math.abs(v - med)).sort();
  const mad = 1.4826 * dev[m >> 1] + 1e-12;
  return { lag: top / RATE, z: (sm[k] - med) / mad };
}

/**
 * The least-squares gain of the stream on the music at a lag of d samples:
 * how loud the music comes back (x ≈ g · r delayed by d). The parts of x that
 * are not the music (the singer, the room) average out.
 */
export function gainAt(x: Float32Array, r: Float32Array, d: number): { num: number; den: number } {
  let num = 0, den = 0;
  const off = LMAX - d;
  const n = Math.min(x.length, r.length - off);
  for (let t = 0; t < n; t++) {
    const m = r[t + off];
    num += x[t] * m;
    den += m * m;
  }
  return { num, den };
}

/** The loop as measured so far (createLoopEstimator) */
export interface LoopEstimate {
  /** s from the music leaving the page to it coming back in the stream; a voice comes out this late */
  lag: number;
  z: number;
  /** how loud the music comes back (linear): the loop's gain at a voice gain of 1 */
  coupling: number;
  /** windows correlated */
  windows: number;
  /**
   * trusted: the peak stands out (z >= Z_MIN, away from the search's end),
   * most recent windows find it on their own (AGREE), and the music comes back
   * at all (COUPLING_MIN)
   */
  confident: boolean;
}

/** One singer's running measurement (createLoopEstimator) */
export interface LoopEstimator {
  /** a stream window and the music around it (loopCurve); the music silent (a pause) is skipped */
  push(x: Float32Array, r: Float32Array): LoopEstimate | null;
  readonly estimate: LoopEstimate | null;
}

/**
 * One singer's measurement: the windows' curves summed (older ones fading),
 * and the coupling from the windows whose own peak agrees with the sum's.
 */
export function createLoopEstimator(): LoopEstimator {
  let acc: Float64Array | null = null;
  let windows = 0;
  let num = 0, den = 0;
  const owns: number[] = [];   // the last windows' own peaks (s)
  let estimate: LoopEstimate | null = null;
  return {
    get estimate() { return estimate; },
    push(x, r) {
      let energy = 0;
      for (let i = 0; i < r.length; i++) energy += r[i] * r[i];
      if (energy / r.length < 1e-8) return estimate; // nothing played: nothing to hear back
      const curve = loopCurve(x, r);
      if (!acc) acc = curve;
      else for (let i = 0; i < acc.length; i++) acc[i] = acc[i] * (1 - FADE) + curve[i];
      windows++;
      const { lag, z } = loopPeak(acc);
      const own = loopPeak(curve).lag;
      owns.push(own);
      if (owns.length > AGREE[1]) owns.shift();
      const agree = owns.filter(o => Math.abs(o - lag) <= AGREE_S).length;
      const standsOut = z >= Z_MIN && lag < LAG_MAX_S - EDGE;
      // this window's gain counts where it hears the same round
      if (standsOut && Math.abs(own - lag) <= AGREE_S) {
        const g = gainAt(x, r, Math.round(lag * RATE));
        num = num * (1 - FADE) + g.num;
        den = den * (1 - FADE) + g.den;
      }
      const coupling = den > 0 ? Math.max(0, num / den) : estimate?.coupling ?? 0;
      estimate = { lag, z, coupling, windows, confident: standsOut && agree >= AGREE[0] && den > 0 && coupling >= COUPLING_MIN };
      return estimate;
    },
  };
}

/** Messages to VoiceLoopWorker.ts: id names the singer's connection */
export type VoiceLoopRequest =
  | { type: 'window'; id: string; x: Float32Array; r: Float32Array }
  | { type: 'reset'; id: string };

/** VoiceLoopWorker.ts's answer to each window */
export type VoiceLoopResponse = { type: 'loop'; id: string } & LoopEstimate;
