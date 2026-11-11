/**
 * The lead-in to a lyric line: a small mark left of the line that sets off
 * before the line's first note and reaches its first letter as that note
 * starts, where the sweep through the syllables takes over. It tells the
 * singer when to come in after a pause, the way the cursor on the highway
 * does, but where they are reading.
 *
 * Only after a pause: lines sung one right after the other need no cue, and
 * a mark before every one of them would be noise.
 */
import type { LyricLine } from './LyricsParser';

/** How long before a line's first note its mark sets off, at most (a shorter pause: the whole pause). */
export const LEAD_SECONDS = 2;
/** A pause shorter than this before a line has no mark. */
export const LEAD_MIN_PAUSE_SECONDS = 1;

/** A line's lead-in, in ticks: the mark sets off at `from` and arrives at `to`, the first note's start. */
export interface LeadIn {
  from: number;
  to: number;
  /** the line's first note (its index in the line): the mark stands before it */
  first: number;
}

const firstNote = (line: LyricLine) => line.findIndex(el => !el.isBreak);

/**
 * The lead-in of line `index` of `lines` (lines with notes only), or null for
 * a line that follows the one before closely. `ticksPerSecond` is the chart's
 * (LyricsParser's bpm / 60). The first line counts as after a pause of any
 * length: its lead-in may start before tick 0, in the song's intro.
 */
export function leadIn(lines: readonly LyricLine[], index: number, ticksPerSecond: number): LeadIn | null {
  const line = lines[index];
  if (!line || !(ticksPerSecond > 0)) return null;
  const first = firstNote(line);
  if (first < 0) return null;
  const to = line[first].start;
  let sungUntil = -Infinity; // the end of the last note before this line
  for (let i = index - 1; i >= 0 && sungUntil === -Infinity; i--) {
    for (const el of lines[i]) if (!el.isBreak) sungUntil = Math.max(sungUntil, el.start + el.length);
  }
  const pause = (to - sungUntil) / ticksPerSecond;
  if (pause < LEAD_MIN_PAUSE_SECONDS) return null;
  return { from: to - Math.min(pause, LEAD_SECONDS) * ticksPerSecond, to, first };
}

/** How far the mark has come at `tick` (the raw one, negative in the intro): 0 not set off yet, 1 arrived. */
export const leadProgress = (lead: LeadIn, tick: number): number =>
  Math.max(0, Math.min(1, (tick - lead.from) / (lead.to - lead.from)));
