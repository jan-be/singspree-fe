import { describe, expect, it } from 'vitest';
import { songEndAt, upNextDue, UP_NEXT_SECONDS } from './upNext';

describe('songEndAt', () => {
  it('is the video length without skipped stretches, 0 while unknown', () => {
    expect(songEndAt(200, [])).toBe(200);
    expect(songEndAt(0, [])).toBe(0);
    expect(songEndAt(NaN, [])).toBe(0);
  });

  it('ends where an outro that runs to the end starts', () => {
    expect(songEndAt(200, [{ start: 180, end: 200 }])).toBe(180);
    expect(songEndAt(200, [{ start: 180, end: 199.5 }])).toBe(180); // SponsorBlock's end a hair short of the video's
  });

  it('ignores stretches that do not reach the end', () => {
    expect(songEndAt(200, [{ start: 0, end: 12 }, { start: 150, end: 170 }])).toBe(200);
  });

  it('takes skipped stretches that follow each other to the end together', () => {
    expect(songEndAt(200, [{ start: 185, end: 200 }, { start: 170, end: 185 }])).toBe(170);
  });
});

describe('upNextDue', () => {
  it('shows the last seconds only', () => {
    expect(upNextDue(200 - UP_NEXT_SECONDS - 1, 200)).toBe(false);
    expect(upNextDue(200 - UP_NEXT_SECONDS, 200)).toBe(true);
    expect(upNextDue(199, 200)).toBe(true);
  });

  it('not before the song has started, nor while its end is unknown or near the start', () => {
    expect(upNextDue(0, 10)).toBe(false);
    expect(upNextDue(5, 0)).toBe(false);
    expect(upNextDue(5, UP_NEXT_SECONDS)).toBe(false);
  });
});
