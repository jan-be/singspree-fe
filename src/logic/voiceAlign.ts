/**
 * voiceAlign.ts — how late a singer's notes are, measured from the singing itself.
 *
 * The bleed (bleedDelay.ts) times the music in the microphone, a good guess at
 * how late the singer is wherever the mic hears the speakers, which is about
 * half the plays. The singing says it directly: every pitch window is judged
 * against the chart at a row of delays, the way the server would judge it, and
 * the delay that earns the most is this singer's, whatever made them late: the
 * playback, the room, headphones, the chart, their own habit. Only windows from
 * before the note in hand count, so a line is never judged by itself.
 *
 * Replayed on 2,118 real plays from 595 parties (latency-1106/delay-eval), held
 * out by party: +190 points at Easy over the bleed with its fixed delay, +230
 * over the best fixed delay, in every device class and at every level; the
 * worst loss falls from 3,300 points to about 300. Nobody following the chart
 * (the singing moved 20 s, random pitch, one hummed pitch) gains about 40. The
 * bleed still gives the delay until the singing has spoken. The numbers hardly
 * move for any of the constants below, nor for the delay it starts from.
 */

import { createDelayPolicy } from './bleedDelay';
import type { DelayEstimate, DelayPolicy, DelaySource } from './bleedDelay';
import type { LyricLine, LyricRef } from './LyricsParser';

export const ALIGN_MIN = -0.1;     // s: the delays tried, every 20 ms
export const ALIGN_STEP = 0.02;
export const ALIGN_COUNT = 26;     // -100 ms .. 400 ms
const TOLERANCE = 2;               // semitones: in tune, at every level (a level is the singer's, the delay is the same)
const LOOK_S = 0.5;                // s of song between looks at the tallies
const TAU_S = 60;                  // s of song for what was earned to fade: the delay can move during a song
const FADE = Math.exp(-LOOK_S / TAU_S);
const FULL_SAY = 8;                // windows in tune a delay is ahead by when it has the whole say (a quarter of a second)

/** The part a voice sings: what it reads of a chart (LyricData, or P2's TimedLyrics) */
export interface AlignChart {
  bpm: number;
  /** ms */
  gap: number;
  lyricRefs: readonly (LyricRef | undefined)[];
  lyricLines?: readonly LyricLine[];
}

/** The tallies of one voice against one part (createVoiceAligner) */
export interface VoiceAligner {
  /** One pitch window: its stamp, no delay taken off (s), its pitch (Hz, 0 = none). True: time to look at delay(). */
  push(chart: AlignChart | undefined, stamp: number, freq: number): boolean;
  /** The delay the singing points to (s), starting from `prior`, what it would be without the singing. */
  delay(prior: number): number;
}

export function createVoiceAligner(): VoiceAligner {
  const fresh = new Float64Array(ALIGN_COUNT);  // windows in tune since the last look, per delay
  const earned = new Float64Array(ALIGN_COUNT); // what each delay has earned, fading
  let key: AlignChart['lyricRefs'] | null = null;
  let nextLook = -Infinity;

  const nearest = (d: number) => Math.max(0, Math.min(ALIGN_COUNT - 1, Math.round((d - ALIGN_MIN) / ALIGN_STEP)));

  return {
    push(chart, stamp, freq) {
      if (!chart?.lyricRefs) return false;
      if (key !== chart.lyricRefs) {        // another song or part: what was earned belonged to the one before
        key = chart.lyricRefs;
        fresh.fill(0); earned.fill(0);
        nextLook = -Infinity;
      }
      if (freq > 0) {
        const tps = chart.bpm / 60, gap = chart.gap / 1000;
        const semitone = 12 * Math.log2(freq / 440) + 33;
        for (let i = 0; i < ALIGN_COUNT; i++) {
          const tick = Math.floor(tps * (stamp - (ALIGN_MIN + i * ALIGN_STEP) - gap));
          const ref = tick >= 0 ? chart.lyricRefs[tick] : undefined;
          if (!ref || ref.isSilent) continue;
          const note = chart.lyricLines?.[ref.lineIndex]?.[ref.syllableIndex];
          if (!note || note.isBreak || note.isFreestyle) continue;
          const off = note.tone - semitone;
          if (note.isRap || Math.abs(off - 12 * Math.round(off / 12)) <= TOLERANCE) fresh[i] += note.isSpecial ? 2 : 1;
        }
      }
      if (stamp < nextLook && stamp > nextLook - 2 * LOOK_S) return false; // (further back: a rewind, look now)
      nextLook = stamp + LOOK_S;
      for (let i = 0; i < ALIGN_COUNT; i++) { earned[i] = earned[i] * FADE + fresh[i]; fresh[i] = 0; }
      return true;
    },
    delay(prior) {
      // the best delay, each with its neighbours: a peak is a few steps wide
      let best = 0, top = -1;
      for (let i = 0; i < ALIGN_COUNT; i++) {
        const a = earned[Math.max(0, i - 1)], c = earned[Math.min(ALIGN_COUNT - 1, i + 1)];
        const v = (a + earned[i] + c) / 3;
        if (v > top) { top = v; best = i; }
      }
      const ahead = earned[best] - earned[nearest(prior)];
      if (ahead <= 0) return prior;
      return prior + Math.min(1, ahead / FULL_SAY) * (ALIGN_MIN + best * ALIGN_STEP - prior);
    },
  };
}

/** What to take off a singer's notes (createSingerDelay) */
export interface SingerDelay extends DelayPolicy {
  /** A pitch window of this singer: their part, its stamp (no delay taken off), its pitch. */
  pushNote(chart: AlignChart | undefined, stamp: number, freq: number): void;
}

/**
 * The delay for one singer and one song: the fixed one, the bleed's as soon as
 * that is sure (createDelayPolicy), and the singing's as soon as it speaks. It
 * has the last word: the bleed's later estimates only move where it starts from.
 */
export function createSingerDelay({ fallback }: { fallback: number }): SingerDelay {
  const policy = createDelayPolicy({ fallback });
  const aligner = createVoiceAligner();
  let prior = fallback, source: DelaySource = 'fixed', voiced = false;
  return {
    update(estimate: DelayEstimate) {
      if (estimate.confident) { prior = estimate.delay; source = 'bleed'; }
      policy.update(voiced ? { ...estimate, confident: false } : estimate);
    },
    pushNote(chart, stamp, freq) {
      if (!aligner.push(chart, stamp, freq)) return;
      const delay = aligner.delay(prior);
      voiced = delay !== prior;
      policy.update({ confident: true, delay, source: voiced ? 'voice' : source });
    },
    next: () => policy.next(),
    state: () => policy.state(),
  };
}
