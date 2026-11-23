import { describe, it, expect } from 'vitest';
import { lineSeekTime, releaseSpeed, LINE_LEAD_SECONDS } from './lyricSeek';

const note = (start: number, length: number) => ({ isBreak: false as const, start, length });
const brk = (start: number) => ({ isBreak: true as const, start, length: 0 });
// 240 "bpm" (x4): 4 ticks a second; gap 2 s
const BPM = 240, GAP = 2000;

describe('lineSeekTime', () => {
  it('goes a second before the first note of a line after a pause', () => {
    const lines = [[brk(0), note(0, 4), note(4, 4)], [brk(10), note(40, 4)]];
    // line 1 starts at 2 + 40/4 = 12 s; line 0 ends at 2 + 8/4 = 4 s
    expect(lineSeekTime(lines, 1, BPM, GAP)).toBeCloseTo(12 - LINE_LEAD_SECONDS);
  });

  it('does not go back into the line before, so the line picked is the one lit', () => {
    // line 0 ends at 2 + 38/4 = 11.5 s, line 1 starts at 12 s
    const lines = [[brk(0), note(30, 8)], [brk(38), note(40, 4)]];
    expect(lineSeekTime(lines, 1, BPM, GAP)).toBeCloseTo(11.55);
  });

  it('starts at the first note of a line that follows on at once', () => {
    const lines = [[brk(0), note(30, 10)], [brk(40), note(40, 4)]];
    expect(lineSeekTime(lines, 1, BPM, GAP)).toBeCloseTo(12);
  });

  it('never goes before the video starts', () => {
    expect(lineSeekTime([[brk(0), note(0, 4)]], 0, BPM, 500)).toBe(0);
    expect(lineSeekTime([[brk(0), note(8, 4)]], 0, BPM, 0)).toBeCloseTo(1);
  });

  it('has nothing for a line without notes, no line, or no tempo', () => {
    expect(lineSeekTime([[brk(0)]], 0, BPM, GAP)).toBeNull();
    expect(lineSeekTime([[brk(0), note(0, 4)]], 3, BPM, GAP)).toBeNull();
    expect(lineSeekTime([[brk(0), note(0, 4)]], 0, 0, GAP)).toBeNull();
  });

  it('takes the gap in use (a timing correction moves the line)', () => {
    const lines = [[brk(0), note(40, 4)]];
    expect(lineSeekTime(lines, 0, BPM, 2500)).toBeCloseTo(11.5);
  });
});

describe('releaseSpeed', () => {
  it('is the speed over the last 100 ms of moves', () => {
    const moves = [{ t: 0, y: 0 }, { t: 50, y: 10 }, { t: 100, y: 60 }, { t: 150, y: 110 }, { t: 200, y: 160 }];
    expect(releaseSpeed(moves, 205)).toBeCloseTo(1);
  });

  it('is nothing for a finger that stood still before it was let go', () => {
    expect(releaseSpeed([{ t: 0, y: 0 }, { t: 16, y: 20 }], 200)).toBe(0);
  });

  it('is nothing for a single move or none', () => {
    expect(releaseSpeed([{ t: 0, y: 0 }], 10)).toBe(0);
    expect(releaseSpeed([], 10)).toBe(0);
  });
});
