/**
 * A try-out behind a flag, off for everyone: the voice shown at the cursor.
 *
 * A singer's line ends a good way behind the cursor: their delay is taken off
 * the notes on purpose (PartyPage), and the notes take their time to get here.
 * The newest pitch is known all the same, so a small mark at the cursor can
 * sit at its height at once, and the line follows it in. Pixels only: no note
 * moves, nothing is judged differently. Whether it feels faster, and whether
 * it looks right, is still to be seen.
 *
 * `?head=1` turns the mark on for this browser (stored, as `?highway=` is: a
 * join changes the page's address), `?head=2` adds the line's tip, the last
 * pitch held from the line's end to the cursor and fading out with the note's
 * age, and `?head=0` (or anything else) turns it off again.
 */

const FLAG_KEY = 'singspree_head';

/** What is drawn: nothing, the mark at the cursor, or the mark and the line's tip. */
export type HeadMode = 0 | 1 | 2;

/** How long the tip stays with no newer note: it fades out over this. */
export const TIP_FADE_SEC = 0.25;

const isHeadMode = (v: string | null) => v === '1' || v === '2';

/** What this browser was told (`?head=`, stored), else off. */
export function headMode(): HeadMode {
  try {
    const v = new URLSearchParams(window.location.search).get('head');
    if (isHeadMode(v)) localStorage.setItem(FLAG_KEY, v as string);
    else if (v !== null) localStorage.removeItem(FLAG_KEY);
    const stored = localStorage.getItem(FLAG_KEY);
    return stored === '1' ? 1 : stored === '2' ? 2 : 0;
  } catch {
    return 0; // no storage: off
  }
}

/** What headTip reads of a note. */
export interface HeadNote {
  videoTime: number;
  freq: number;
}

/**
 * How strong the head of a singer's voice is right now, 0 to 1, from their
 * notes (oldest first): silence comes in as notes too (freq 0), so the newest
 * one says at once whether they still sing, and one silent window between two
 * sung ones does not blink it off. Then it fades with how far the newest note
 * lies behind `lag` seconds, the usual distance (a stream that stalled).
 */
export function headStrength(notes: readonly HeadNote[], now: number, lag: number): number {
  const n = notes.length;
  if (n === 0) return 0;
  if (!(notes[n - 1].freq > 0) && !(n > 1 && notes[n - 2].freq > 0)) return 0;
  const age = now - notes[n - 1].videoTime - lag;
  return Math.max(0, Math.min(1, 1 - age / TIP_FADE_SEC));
}
