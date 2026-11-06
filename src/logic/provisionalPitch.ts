// provisionalPitch.ts — an earlier pitch for the highway alone.
//
// The scored stream (MicrophoneInput.ts: a 60 ms window every 30 ms through the
// voicing tracker) shows a sung note about 45 ms after its sound starts. Next
// to it this path looks at the newest samples between two scored windows, so
// the line's head can show up to 30 ms sooner. What it finds is only drawn: it
// is never judged, sent or recorded, and the first note of the scored stream
// takes its place. It has a worker of its own, so the scored windows run on
// the same clock as without it.
//
// Instruments in the mic reach the confidence a voice has at its start, so a
// window only counts at `entry` while the scored stream shows someone singing.
// With nobody singing it takes `entryAlone`, which an instrument seldom reaches:
// measured on instrumentals, 4-7 pitches a minute that no note confirms instead
// of 38-54, for 1 ms of the 16 gained on real singing.
//
// A device runs these windows only while the line waits for a note, about one
// extra inference for every two scored ones. A fast one runs them all the time:
// the head then moves every 10 ms and shows a change of pitch sooner. Measured
// on real singing the head agrees with the next scored window 99.3 % of the
// time, and is more than a semitone off it 0.1 %.
//
// Off unless asked for (fastPitchFlag.ts).

import { CONFIDENCE_THRESHOLD, HOP_SAMPLES, MIN_PITCH_HZ, MAX_PITCH_HZ } from './pitchModel';

export const PROVISIONAL = {
  // 768 samples, not the scored stream's 960, and no dearer: the model pads
  // 384 zeros at each end and reads 1024 samples every 256, so both make 3
  // frames, and the newest frame is centred 8 ms behind the newest sample here
  // against 20 ms there. Over real sung note starts that shows as the same
  // confidence 12 ms sooner.
  samples: 768,
  hopSamples: 160,  // a window every 10 ms, the mic's frames on most devices
  entry: CONFIDENCE_THRESHOLD,
  entryAlone: 0.95,  // ...with less than sungS of accepted windows in the last sungWindowS
  sungS: 1,
  sungWindowS: 3,
  // A note was accepted this recently (s): the scored stream carries the line,
  // so a slower device saves the windows between
  recentS: 0.06,
  // Unconfirmed for this long (ms) a provisional pitch goes: it was not a note
  expireMs: 90,
  // Scored inferences this slow (ms): the device needs its time for those
  maxInferMs: 20,
  // Scored inferences this fast (ms): every window between them is affordable
  carryMaxInferMs: 4,
};

const WINDOW_S = HOP_SAMPLES / 16000; // what one accepted window counts for

/** One stream's provisional decision (createProvisionalTracker); t on a clock that runs with the audio, in s */
export interface ProvisionalTracker {
  /** The scored stream's answer for a window: the pitch it accepted (0 = none). */
  scored(hz: number, t: number): void;
  /**
   * Is a window worth its inference, at this device's scored inference time
   * (ms, 0: not known yet)? `between`: it ends between two scored windows. One
   * that ends with a scored window only helps while the line waits for a note.
   */
  wanted(t: number, inferMs: number, between: boolean): boolean;
  /** A window's newest frame → the pitch to draw (Hz), or 0. */
  pick(hz: number, confidence: number, t: number): number;
  /** Start over (the song paused). */
  reset(): void;
}

/** @param [options] any of PROVISIONAL's knobs */
export function createProvisionalTracker(options: Partial<typeof PROVISIONAL> = {}): ProvisionalTracker {
  const P = { ...PROVISIONAL, ...options };
  let lastScored = -Infinity;
  const accepted: number[] = []; // when the scored stream took a window, oldest first, within sungWindowS
  const enough = Math.ceil(P.sungS / WINDOW_S);
  const singing = (t: number) => {
    while (accepted.length && t - accepted[0] > P.sungWindowS) accepted.shift();
    return accepted.length >= enough;
  };
  return {
    scored(hz, t) {
      if (!(hz > 0)) return;
      lastScored = t;
      accepted.push(t);
      singing(t); // (keeps the list short)
    },
    wanted(t, inferMs, between) {
      if (inferMs > P.maxInferMs) return false;
      return (between && inferMs > 0 && inferMs <= P.carryMaxInferMs) || t - lastScored > P.recentS;
    },
    pick(hz, confidence, t) {
      return confidence >= (singing(t) ? P.entry : P.entryAlone) && hz >= MIN_PITCH_HZ && hz <= MAX_PITCH_HZ ? hz : 0;
    },
    reset() {
      lastScored = -Infinity;
      accepted.length = 0;
    },
  };
}

/** A provisional pitch as the highway draws it: like a note, plus when it came */
export interface ProvisionalNote {
  videoTime: number;
  freq: number;
  /** performance.now() when it came */
  at: number;
}

/** The local singer's provisional pitches, oldest first */
export interface ProvisionalLine {
  username: string;
  notes: ProvisionalNote[];
}

/** A note of the scored stream with a pitch came: what it covers is no longer provisional. */
export function confirmProvisional(line: ProvisionalLine | null, videoTime: number): void {
  if (!line) return;
  const { notes } = line;
  let n = 0;
  while (n < notes.length && notes[n].videoTime <= videoTime) n++;
  if (n) notes.splice(0, n);
}

/** Take out what waited too long for a note (see expireMs). */
export function expireProvisional(line: ProvisionalLine, now: number, expireMs = PROVISIONAL.expireMs): void {
  const { notes } = line;
  let n = 0;
  while (n < notes.length && now - notes[n].at > expireMs) n++;
  if (n) notes.splice(0, n);
}
