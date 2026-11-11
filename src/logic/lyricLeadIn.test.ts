import { describe, it, expect } from 'vitest';
import { leadIn, leadProgress, LEAD_SECONDS } from './lyricLeadIn';
import type { LyricLine, LyricElement } from './LyricsParser';

const note = (start: number, length: number): LyricElement => ({ isBreak: false, isSpecial: false, isRap: false, isFreestyle: false, start, length, tone: 0, syllable: 'la ' });
const lineBreak = (start: number): LyricElement => ({ isBreak: true, start, length: 0, tone: 0, syllable: '', isSpecial: false });
/** A line: its break, then notes at these [start, length] */
const line = (breakAt: number, ...notes: [number, number][]): LyricLine => [lineBreak(breakAt), ...notes.map(([s, l]) => note(s, l))];

const TPS = 10; // ticks a second

describe('leadIn', () => {
  it('sets off two seconds before a line that comes after a long pause, and arrives at its first note', () => {
    const lines = [line(0, [0, 10], [10, 10]), line(60, [100, 5])];
    expect(leadIn(lines, 1, TPS)).toEqual({ from: 100 - LEAD_SECONDS * TPS, to: 100, first: 1 });
  });

  it('takes the whole pause when that is shorter', () => {
    const lines = [line(0, [0, 10]), line(15, [25, 5])]; // 1.5 s after the last note's end
    expect(leadIn(lines, 1, TPS)).toEqual({ from: 10, to: 25, first: 1 });
  });

  it('leaves a line that follows closely without one', () => {
    const lines = [line(0, [0, 10]), line(12, [15, 5]), line(20, [20, 5])];
    expect(leadIn(lines, 1, TPS)).toBeNull(); // half a second
    expect(leadIn(lines, 2, TPS)).toBeNull(); // none at all
  });

  it('measures the pause from the end of the last note, not from the line break', () => {
    // the break comes right after the last note, the first note 3 s later
    const lines = [line(0, [0, 10]), line(11, [40, 5])];
    expect(leadIn(lines, 1, TPS)).toEqual({ from: 20, to: 40, first: 1 });
    // a long last note that ends just before the next line
    expect(leadIn([line(0, [0, 38]), line(39, [40, 5])], 1, TPS)).toBeNull();
  });

  it('gives the first line one too, from before tick 0 if its first note is at the start', () => {
    expect(leadIn([line(0, [0, 10])], 0, TPS)).toEqual({ from: -20, to: 0, first: 1 });
    expect(leadIn([line(0, [300, 10])], 0, TPS)).toEqual({ from: 280, to: 300, first: 1 });
  });

  it('has none without a line, a note or a tempo', () => {
    expect(leadIn([], 0, TPS)).toBeNull();
    expect(leadIn([[lineBreak(0)]], 0, TPS)).toBeNull();
    expect(leadIn([line(0, [50, 5])], 0, 0)).toBeNull();
    expect(leadIn([line(0, [50, 5])], 0, NaN)).toBeNull();
  });
});

describe('leadProgress', () => {
  it('runs from 0 to 1 between setting off and arriving, and stays there', () => {
    const lead = { from: 80, to: 100, first: 1 };
    expect(leadProgress(lead, 0)).toBe(0);
    expect(leadProgress(lead, 80)).toBe(0);
    expect(leadProgress(lead, 90)).toBe(0.5);
    expect(leadProgress(lead, 100)).toBe(1);
    expect(leadProgress(lead, 130)).toBe(1);
  });

  it('counts the intro\'s negative ticks', () => {
    expect(leadProgress({ from: -20, to: 0, first: 1 }, -5)).toBe(0.75);
  });
});
