/**
 * The lyrics band as a way through the song, the way a music app's lyrics
 * view is one: the host (or a co-host) scrolls the list away from the line
 * sung now, clicks or taps a line, and the song goes there. A while after the
 * last scroll the list goes back to the line sung now by itself.
 */

import type { LyricElement } from './LyricsParser';

/** A second before a line's first note, as for a song opened at a spot (startAt.ts): the singer gets the whole line */
export const LINE_LEAD_SECONDS = 1;

/** Quiet time after a scroll before the list goes back to the line sung now (ms) */
export const BROWSE_IDLE_MS = 4000;

/** How long a picked line waits for the song to get there (a co-host's seek is the host page's to do) before the list follows the song again (ms) */
export const PICK_WAIT_MS = 3000;

/** A finger let go faster than this (px/ms) sends the list on by itself */
export const FLING_MIN_SPEED = 0.25;

/** What the flung list keeps of its speed per ms: iOS's usual scroll deceleration */
export const FLING_DECAY = 0.998;

/** What lineSeekTime reads of a line: its opening break, then its notes */
type SeekLine = readonly Pick<LyricElement, 'isBreak' | 'start' | 'length'>[];

/**
 * Where the song goes for line `i` of `lines` (the lines one sings, as the
 * band lists them), in video seconds: a second before the line's first note,
 * but not into the line before it. The band counts a line as the one sung
 * from the end of the line before it on (LyricsParser: a silent tick points
 * at the next note), so the line picked is lit at once, and between two lines
 * that follow closely the singer still gets that line's start. `bpm` as
 * LyricsParser has it (x4, ticks a minute), `gapMs` the gap in use.
 * Null for a line without notes or a chart without a tempo.
 */
export function lineSeekTime(lines: readonly SeekLine[], i: number, bpm: number, gapMs: number): number | null {
  const line = lines[i];
  if (!line || !(bpm > 0)) return null;
  const seconds = (tick: number) => (Number(gapMs) || 0) / 1000 + (tick * 60) / bpm;
  const first = line.find(el => !el.isBreak);
  if (!first) return null;
  const start = seconds(first.start);
  let target = start - LINE_LEAD_SECONDS;
  const before = i > 0 ? lines[i - 1].filter(el => !el.isBreak) : [];
  const last = before[before.length - 1];
  if (last) {
    // (a moment after its last note: a tick on, the band has the next line)
    const end = seconds(last.start + last.length) + 0.05;
    target = Math.max(target, Math.min(end, start));
  }
  return Math.max(0, target);
}

/**
 * How fast a finger moved at the end of a drag (px/ms), from its last moves
 * (`t` ms, `y` px; oldest first): over the last 100 ms of them, 0 when it
 * stood still for more than 60 ms before it was let go at `now`.
 */
export function releaseSpeed(moves: readonly { t: number; y: number }[], now: number): number {
  const end = moves[moves.length - 1];
  if (!end || now - end.t > 60) return 0;
  let from = end;
  for (let k = moves.length - 2; k >= 0 && end.t - moves[k].t <= 100; k--) from = moves[k];
  const dt = end.t - from.t;
  return dt > 0 ? (end.y - from.y) / dt : 0;
}
