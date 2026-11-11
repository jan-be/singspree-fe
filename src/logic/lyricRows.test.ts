import { describe, it, expect } from 'vitest';
import { clampLyricRows, lyricRowsShown, placeLyricLines, sungRowsAbove, DEFAULT_LYRIC_ROWS, MAX_LYRIC_ROWS } from './lyricRows';

/** A list of lines with these heights, one under the other */
const list = (heights: number[]) => {
  const tops: number[] = [];
  heights.reduce((y, h, i) => { tops[i] = y; return y + h; }, 0);
  return { count: heights.length, top: (i: number) => tops[i], height: (i: number) => heights[i] };
};
const placeAll = (heights: number[], current: number, view: number, row = 50, into = 0) => {
  const l = list(heights);
  return placeLyricLines(l.count, current, l.top, l.height, view, row, into);
};
/** (where the list goes and which lines show; `long` and `cut` have their own tests) */
const place = (heights: number[], current: number, view: number, row = 50) => {
  const { shift, first, last } = placeAll(heights, current, view, row);
  return { shift, first, last };
};
const even = (n: number) => Array<number>(n).fill(50);

describe('clampLyricRows', () => {
  it('keeps the band to whole lines, between one and the most there are', () => {
    expect(clampLyricRows(2.4)).toBe(2);
    expect(clampLyricRows(2.6)).toBe(3);
    expect(clampLyricRows(0)).toBe(1);
    expect(clampLyricRows(-3)).toBe(1);
    expect(clampLyricRows(99)).toBe(MAX_LYRIC_ROWS);
  });

  it('falls back to the default for what is no number (a stored value gone wrong)', () => {
    expect(clampLyricRows(NaN)).toBe(DEFAULT_LYRIC_ROWS);
    expect(clampLyricRows(Number('tall'))).toBe(DEFAULT_LYRIC_ROWS);
  });
});

describe('lyricRowsShown', () => {
  it('counts the lines a band has room for beside its padding', () => {
    expect(lyricRowsShown(124, 24, 50)).toBe(2);
    expect(lyricRowsShown(170, 24, 50)).toBe(2); // a stage that ran out of room part-way through the third
    expect(lyricRowsShown(173.4, 24, 50)).toBe(3); // (a pixel short of it still counts)
    expect(lyricRowsShown(30, 24, 50)).toBe(1);
  });
});

describe('placeLyricLines', () => {
  it('shows the current line and the next in a band of two, the current one on top', () => {
    expect(place(even(10), 0, 100)).toEqual({ shift: 0, first: 0, last: 1 });
    expect(place(even(10), 4, 100)).toEqual({ shift: -200, first: 4, last: 5 });
  });

  it('moves the list up by one line for every new line', () => {
    const a = place(even(10), 3, 150), b = place(even(10), 4, 150);
    expect(b.shift - a.shift).toBe(-50);
    expect([b.first, b.last]).toEqual([a.first + 1, a.last + 1]);
  });

  it('shows only the current line in a band of one', () => {
    expect(place(even(10), 4, 50)).toEqual({ shift: -200, first: 4, last: 4 });
  });

  it('keeps a sung line above the current one from four rows on, two from eight', () => {
    expect(sungRowsAbove(3)).toBe(0);
    expect(place(even(20), 6, 150)).toEqual({ shift: -300, first: 6, last: 8 });
    expect(place(even(20), 6, 200)).toEqual({ shift: -250, first: 5, last: 8 });
    expect(place(even(20), 6, 400)).toEqual({ shift: -200, first: 4, last: 11 });
  });

  it('stops at the chart\'s first and last line', () => {
    expect(place(even(3), 0, 200)).toEqual({ shift: 50, first: 0, last: 2 });
    expect(place(even(3), 2, 200)).toEqual({ shift: -50, first: 1, last: 2 });
  });

  it('shares what is left beside whole rows above and below', () => {
    expect(place(even(10), 2, 130)).toEqual({ shift: -85, first: 2, last: 3 });
  });

  it('leaves out a line that does not fit whole, as after a current line of two rows', () => {
    // the current line wraps: the next one would be cut off at the lower edge
    expect(place([50, 50, 100, 50, 50], 2, 100)).toEqual({ shift: -100, first: 2, last: 2 });
    expect(place([50, 50, 100, 50, 50], 2, 150)).toEqual({ shift: -100, first: 2, last: 3 });
    // a sung line of two rows does not fit in the one row above
    expect(place([50, 100, 50, 50, 50, 50], 2, 200)).toEqual({ shift: -100, first: 2, last: 4 });
  });

  it('keeps the current line in view in a band too low for it', () => {
    expect(place([50, 150, 50], 1, 50)).toEqual({ shift: -50, first: 1, last: 1 });
  });

  it('reads through a current line with more rows than fit, as far as the row sung and no further than its last', () => {
    // three rows in a band of two: the first two, then the last two
    expect(placeAll([50, 150, 50], 1, 100, 50, 0)).toEqual({ shift: -50, first: 1, last: 1, long: true, cut: 0 });
    expect(placeAll([50, 150, 50], 1, 100, 50, 50)).toEqual({ shift: -100, first: 1, last: 1, long: true, cut: 50 });
    expect(placeAll([50, 150, 50], 1, 100, 50, 100)).toEqual({ shift: -100, first: 1, last: 1, long: true, cut: 50 });
    // under a sung line (a band of four rows, a current line of five): that one gives way too
    expect(placeAll([50, 250, 50], 1, 200, 50, 0)).toMatchObject({ shift: 0, first: 0, long: true, cut: 0 });
    expect(placeAll([50, 250, 50], 1, 200, 50, 100)).toMatchObject({ shift: -100, first: 1, long: true, cut: 50 });
  });

  it('leaves a line that fits where it is, wherever the song is in it', () => {
    expect(placeAll([50, 100, 50], 1, 100, 50, 50)).toEqual({ shift: -50, first: 1, last: 1, long: false, cut: 0 });
  });

  it('holds with a row height that could not be measured', () => {
    expect(place(even(4), 1, 100, NaN)).toEqual({ shift: -50, first: 1, last: 2 });
  });
});
