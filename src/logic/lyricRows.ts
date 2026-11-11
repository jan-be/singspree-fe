/**
 * The lyrics band: how many lines it shows, and where its lines go.
 *
 * The band lists a part's lines the way a music app's lyrics view does. The
 * line sung now keeps its place, and at every new line the whole list moves
 * up by one. How tall the band is belongs to the viewer: they drag its upper
 * edge, a line at a time, and this browser keeps the number.
 */

/** The line sung and the one after it: what the band showed before it could be dragged. */
export const DEFAULT_LYRIC_ROWS = 2;
export const MIN_LYRIC_ROWS = 1;
export const MAX_LYRIC_ROWS = 12;

/**
 * A screen held upright and no wider than a tablet: its lines are short, so
 * a lyric line often breaks in two, and it has height to spare. The band is a
 * row taller there, for the next line to fit under a current one of two rows.
 * (Lyrics.module.css has the same rule: the band's height is the CSS's.)
 */
const UPRIGHT = '(max-width: 820px) and (orientation: portrait)';

/** The rows the band has on this screen until the viewer picks a number. */
export const usualLyricRows = (): number => {
  try { return window.matchMedia(UPRIGHT).matches ? DEFAULT_LYRIC_ROWS + 1 : DEFAULT_LYRIC_ROWS; } catch { return DEFAULT_LYRIC_ROWS; }
};

const KEY = 'singspree_lyric_rows';

/** A whole number of lines the band can have (the default for what is no number). */
export const clampLyricRows = (rows: number): number =>
  Number.isFinite(rows) ? Math.max(MIN_LYRIC_ROWS, Math.min(MAX_LYRIC_ROWS, Math.round(rows))) : DEFAULT_LYRIC_ROWS;

/** The rows the viewer picked on this browser, null for none: the screen's usual number then. */
export const loadLyricRows = (): number | null => {
  try {
    const stored = localStorage.getItem(KEY);
    return stored !== null && Number.isFinite(Number(stored)) ? clampLyricRows(Number(stored)) : null;
  } catch { return null; }
};
export const storeLyricRows = (rows: number | null) => {
  try {
    if (rows === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(rows));
  } catch { /* the band still holds for this page */ }
};

/**
 * The lines a band `height` px tall has room for, `chrome` px of it being no
 * line (its padding) and a line `rowHeight` px: fewer than asked for where
 * the stage ran out of room.
 */
export const lyricRowsShown = (height: number, chrome: number, rowHeight: number): number =>
  clampLyricRows(Math.floor((height - chrome + 1) / rowHeight));

/** Of `whole` lines in view, how many are lines already sung, above the one sung now. */
export const sungRowsAbove = (whole: number): number => Math.floor(whole / 4);

/**
 * Where the list goes: moved by `shift` px, its lines `first` to `last` in
 * view. `long`: the current line does not fit, and is read through row by
 * row, `cut` px of it above the view by now.
 */
export interface LyricPlacement {
  shift: number;
  first: number;
  last: number;
  long: boolean;
  cut: number;
}

/**
 * Places a list of `count` lines for the line `current`, in a view `view` px
 * tall where a line of one row is `rowHeight` px. `top(i)` and `height(i)`
 * are line i's place in the list (a long line on a narrow screen has several
 * rows).
 *
 * The current line stands at the top, under a line or more already sung once
 * the view has four rows; what the view has beyond whole rows is shared above
 * and below. Only whole lines are in view, so none is cut off at an edge: the
 * others are told apart here (`first`, `last`) and faded out by the band.
 * The current line always counts as in view. One with more rows than fit is
 * moved up as the song gets through it: by `into`, how far down in the line
 * the row sung now is, but no further than to its last row.
 */
export function placeLyricLines(
  count: number,
  current: number,
  top: (i: number) => number,
  height: (i: number) => number,
  view: number,
  rowHeight: number,
  into = 0,
): LyricPlacement {
  const row = rowHeight > 0 ? rowHeight : 0; // (not measured: the current line on top, as in a band of one)
  const whole = row ? Math.max(1, Math.floor((view + 1) / row)) : 1;
  const spare = row ? Math.max(0, view - whole * row) : 0;
  const place = spare / 2 + sungRowsAbove(whole) * row;
  const below = place + height(current) - view;
  const long = below > 1;
  // (whole pixels: text between two of them is drawn soft)
  const shift = Math.round(place - (long ? Math.max(0, Math.min(into, below)) : 0) - top(current));
  let first = current;
  while (first > 0 && top(first - 1) + shift >= -1) first--;
  let last = current;
  while (last < count - 1 && top(last + 1) + height(last + 1) + shift <= view + 1) last++;
  return { shift, first, last, long, cut: Math.max(0, -(top(current) + shift)) };
}
