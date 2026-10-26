/**
 * voiceGuard.ts — keeping the singers' voices on the host's speakers from
 * howling (voiceMixer.ts): how loud a voice may be made, and noticing when
 * one rings anyway.
 *
 * Every microphone in the room hears the speakers. Whatever of a voice comes
 * back into its own microphone is sent again, a round later (~0.1–0.3 s on a
 * phone over Wi-Fi). Below a loop gain of 1 that is a fading echo; at 1 or
 * above it builds up into a howl within a few rounds. So:
 *
 *   - feedbackCap: the loudest a voice may be made, from its measured
 *     coupling (voiceLoop.ts: how loud the music comes back in its stream),
 *     with 6 dB to spare, shared by the singers on at once (each one's loop
 *     adds up), 3 dB less with the echo effect on, and 3 dB less again for
 *     every howl it had in the last two minutes. Before anything is measured
 *     a careful guess.
 *   - createHowlDetector: a ringing tone in a stream (one peak holding most
 *     of the energy, at a pitch that does not move at all, for over a
 *     second); the mixer then turns that singer down at once and lowers their
 *     ceiling for a while.
 */

/** dB ↔ linear gain */
export const dbToGain = (db: number) => 10 ** (db / 20);
export const gainToDb = (gain: number) => 20 * Math.log10(Math.max(gain, 1e-9));

/** The coupling assumed before one is measured: a phone near the mouth, a speaker a few metres away (−14 dB) */
export const GUESSED_COUPLING = 0.2;
const MARGIN = 0.5;                  // −6 dB below where it would ring
const ECHO_PENALTY = dbToGain(-3);   // the echo effect sends each voice round again
const HOWL_PENALTY = dbToGain(-3);   // per howl the singer had lately
/** How long a howl keeps a singer's ceiling lower (a false alarm, a phone put down near the speaker, is forgiven) */
export const HOWL_MEMORY_S = 120;
const CAP_MIN = dbToGain(-12);
const CAP_MAX = dbToGain(24);

/**
 * The loudest gain (linear) a singer's voice may have on its way from their
 * stream to the speakers, all stages together (the auto level, their level,
 * the singers' level, the page's volume).
 *   coupling: how loud the speakers come back in their stream (voiceLoop.ts), null before it is measured
 *   singers: how many voices are on the speakers now
 *   echo: the echo effect is on
 *   howls: how often this singer rang lately (the mixer counts the last HOWL_MEMORY_S)
 */
export function feedbackCap({ coupling, singers, echo, howls }: { coupling: number | null; singers: number; echo: boolean; howls: number }): number {
  const c = coupling != null && coupling > 0 ? coupling : GUESSED_COUPLING;
  let cap = MARGIN / (c * Math.max(1, singers));
  if (echo) cap *= ECHO_PENALTY;
  cap *= HOWL_PENALTY ** howls;
  return Math.min(CAP_MAX, Math.max(CAP_MIN, cap));
}

/** What the detector says after a spectrum */
export interface HowlReading {
  howl: boolean;
  /** Hz of the strongest peak (the ringing tone when howl) */
  freq: number;
  /** how much of the energy that peak holds (0..1) */
  tonality: number;
}

/** createHowlDetector's thresholds */
const F_LO = 150, F_HI = 6000;   // Hz: where rooms ring (and voices are)
const PEAK_BINS = 2;             // the peak's energy: its bin and this many either side
const TONAL = 0.6;               // the peak holds this much of the energy: one tone, not a voice's harmonics
const SAME_TONE = 0.015;         // the next spectrum's peak within 1.5 % is the same tone
const STILL = 0.003;             // a howl's pitch holds within 0.3 % (a voice drifts, and has vibrato)
const HOLD_S = 1.2;              // ...for this long
const FLOOR_DB = -50;            // quieter peaks are not a howl, whatever their shape

/**
 * A howl in a stream, from its spectra (an AnalyserNode's
 * getFloatFrequencyData, dB per bin) every `stepS` seconds: one peak holding
 * most of the energy, at a pitch that does not move (within STILL, its place
 * between bins from a parabola through the top three) for HOLD_S. A loop that
 * rings sits on one frequency, as still as a test tone; a voice, however
 * steady it sounds, wanders by more than that and has vibrato, and spreads
 * its energy over its harmonics. A note's onset or a crescendo is no howl.
 */
export function createHowlDetector({ stepS = 0.1 }: { stepS?: number } = {}) {
  const track: number[] = [];   // the held tone's frequencies, newest last
  const holdSteps = Math.round(HOLD_S / stepS);
  const reset = () => { track.length = 0; };
  return {
    push(spectrum: Float32Array, binHz: number): HowlReading {
      const lo = Math.max(1, Math.floor(F_LO / binHz)), hi = Math.min(spectrum.length - 2, Math.ceil(F_HI / binHz));
      let k = lo;
      for (let i = lo; i <= hi; i++) if (spectrum[i] > spectrum[k]) k = i;
      let total = 0, peak = 0;
      for (let i = lo; i <= hi; i++) {
        const p = 10 ** (spectrum[i] / 10);
        total += p;
        if (Math.abs(i - k) <= PEAK_BINS) peak += p;
      }
      const tonality = total > 0 ? peak / total : 0;
      // the peak's place between bins: the top of a parabola through it and its neighbours
      const a = spectrum[k - 1], b = spectrum[k], c = spectrum[k + 1];
      const den = a - 2 * b + c;
      const offset = Number.isFinite(den) && den < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / den)) : 0;
      const freq = (k + offset) * binHz;
      if (spectrum[k] < FLOOR_DB || tonality < TONAL) { reset(); return { howl: false, freq, tonality }; }
      const held = track.at(-1);
      if (held !== undefined && Math.abs(freq - held) > held * SAME_TONE) reset();
      track.push(freq);
      if (track.length > holdSteps) track.shift();
      if (track.length < holdSteps) return { howl: false, freq, tonality };
      const mean = track.reduce((s, f) => s + f, 0) / track.length;
      const sd = Math.sqrt(track.reduce((s, f) => s + (f - mean) ** 2, 0) / track.length);
      const howl = sd <= mean * STILL;
      if (howl) reset(); // one report per ring
      return { howl, freq, tonality };
    },
  };
}

/** Messages to the guard worklet (VoiceGuardWorklet.ts) */
export type VoiceGuardRequest =
  | { type: 'cap'; gain: number }                  // the automatic level's ceiling (linear)
  | { type: 'coupling'; value: number | null }      // how loud the music comes back (voiceLoop.ts): the gate opens above that
  | { type: 'measure'; on: boolean };               // send windows for measuring the loop

/** What the guard worklet reports */
export type VoiceGuardMessage =
  | { type: 'level'; rms: number; open: boolean; gain: number }
  | { type: 'window'; x: Float32Array; r: Float32Array };
