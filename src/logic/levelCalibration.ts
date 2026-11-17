// levelCalibration.ts — makes a quiet microphone count like a loud one.
//
// swift-f0 has no input normalisation: the same voice at a tenth of the level
// gets markedly less confident pitches, and the voice level of real phones
// differs thirty-fold (a phone held far away, a quiet singer, a low-gain
// mic). This tracks the level of windows the model is very sure are a voice
// and boosts the model's input toward a common voice level:
//   - slowly (a median in log units that moves a little per sure window), so
//     pauses and music between lines do not pull it around;
//   - only upwards (turning loud mics down cost them points);
//   - from windows with confidence ≥ 0.95 only, which instruments reach half
//     as often as a voice.
// Measured on real recordings together with the voicing tracker: held-out
// singers +317 on average instead of +183 with the tracker alone, with a
// little more quiet speaker music let through on quiet phones (+1 point).
// The gate and the volume the app shows stay on the raw level.
//
// The second pitch network (swift-f0 0.3) is sure of far less at a low level
// than the first was: at a tenth of the level it keeps 63 % of its pitches,
// the first kept all. A quiet microphone then never gave the sure windows
// that would have turned it up (an iPhone at a voice level of 0.004 stayed at
// 1.4× where it needed 30×, and lost four pitches in five). So the loudest
// sound of the last seconds is brought to the voice level at once, sure or
// not, and the sure windows take it from there. On 109 real takes with the
// second network: right pitches 86 → 90 % of all sung windows, on iPhones
// 74 → 85 %, and no take loses more than 11 points against the first network
// (it was 76). What it costs: a microphone nobody sings into has the room
// brought up to the voice level too. On 18 real recordings of such
// microphones that earned 180 points on average instead of 148 without it
// (the first network: 24); most earn nothing either way.

import { MIN_PITCH_HZ, MAX_PITCH_HZ } from './pitchModel';

export const VOICE_TARGET = 0.15;   // window RMS a voice is boosted toward
const STEP_PER_15MS = 0.005;        // log units per sure window at a 15 ms step (±0.0025 around the median)
export const UPDATE_CONFIDENCE = 0.95;
export const MAX_GAIN = 30;         // never more than +29.5 dB
const LOUDEST_SECONDS = 15;         // s of windows for "the loudest sound lately": how fast it fades

/** A window's answer as the calibration reads it: its raw level and the model's own last frame (none when the inference failed) */
export interface LevelSample {
  volume: number;
  pitchHz: number | undefined;
  confidence: number | undefined;
}

/** The input boost toward a common voice level (createLevelCalibration) */
export interface LevelCalibration {
  /** The factor for the next window's samples (1 … MAX_GAIN). */
  gain(): number;
  /** The raw level the boost takes for the singer's voice: what gain() brings to VOICE_TARGET. */
  voiceLevel(): number;
  /**
   * A window's answer: its raw level and the model's own last frame
   * (before the voicing tracker). Only sure voice windows move the tracked
   * level; every window may be the loudest lately.
   */
  update(sample: LevelSample): void;
}

/**
 * @param {{ stepSeconds?: number }} [options] time between windows; the step is
 *   scaled so the calibration adapts at the same speed per second
 */
export function createLevelCalibration({ stepSeconds = 0.015 }: { stepSeconds?: number } = {}): LevelCalibration {
  const step = STEP_PER_15MS * (stepSeconds / 0.015);
  const fade = Math.exp(-stepSeconds / LOUDEST_SECONDS);
  let voiceLog = Math.log(VOICE_TARGET); // log of the tracked voice level: starts at gain 1
  let loudest = 0;                       // the loudest window lately (raw level), fading

  /** The factor for the next window's samples (1 … MAX_GAIN). */
  const gain = () => {
    const fromLoudest = loudest > 0 ? VOICE_TARGET / loudest : 1;
    return Math.min(MAX_GAIN, Math.max(1, VOICE_TARGET / Math.exp(voiceLog), fromLoudest));
  };

  return {
    gain,
    voiceLevel: () => VOICE_TARGET / gain(),
    /**
     * A window's answer: its raw level and the model's own last frame
     * (before the voicing tracker). Only sure voice windows move the tracked
     * level; every window may be the loudest lately.
     */
    update({ volume, pitchHz, confidence }: LevelSample) {
      if (volume > 0) loudest = Math.max(volume, loudest * fade);
      if (confidence === undefined || pitchHz === undefined) return; // the inference failed: no update
      if (!(volume > 0) || !(confidence >= UPDATE_CONFIDENCE) || !(pitchHz >= MIN_PITCH_HZ && pitchHz <= MAX_PITCH_HZ)) return;
      voiceLog += step * (0.5 - (Math.log(volume) < voiceLog ? 1 : 0));
    },
  };
}
