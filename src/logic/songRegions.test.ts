import { describe, it, expect } from 'vitest';
import { songRegions, frameSeconds, formatTime, timelineSegments } from './songRegions';
import { getTickData } from './LyricsParser';
import type { TimedLyrics } from './LyricsParser';

type El = { isBreak: boolean, start: number, length: number };
const brk = (start: number) => ({ isBreak: true, start, length: 0 });
const note = (start: number, length: number) => ({ isBreak: false, start, length, tone: 0 });
// bpm 120 → 2 ticks per second; gap 1000 ms
const data = (lines: El[][], p2?: El[][]) => ({ bpm: 120, gap: 1000, lyricLines: lines, ...(p2 ? { p2: { lyricLines: p2 } } : {}) });

describe('songRegions', () => {
  it('turns lyric lines into sung regions in seconds of video time', () => {
    const regions = songRegions(data([[brk(0)], [brk(0), note(0, 2), note(2, 2)], [brk(4), note(20, 4)]]));
    expect(regions).toEqual([
      { start: 1, end: 3, player: 1 },     // ticks 0–4 → 1 s + 0..2 s
      { start: 11, end: 13, player: 1 },   // ticks 20–24
    ]);
  });

  it('merges lines that follow each other closely', () => {
    const regions = songRegions(data([[brk(0), note(0, 2)], [brk(2), note(3, 2)], [brk(5), note(10, 2)]]));
    expect(regions).toEqual([{ start: 1, end: 3.5, player: 1 }, { start: 6, end: 7, player: 1 }]);
  });

  it('adds the second singer with its own colour tag, sorted by time', () => {
    const regions = songRegions(data([[brk(0), note(0, 2)]], [[brk(0), note(1, 2)], [brk(0), note(10, 2)]]));
    expect(regions).toEqual([
      { start: 1, end: 2, player: 1 },
      { start: 1.5, end: 2.5, player: 2 },
      { start: 6, end: 7, player: 2 },
    ]);
  });

  it('moves with the gap in use, without touching the lyrics', () => {
    const ld = data([[brk(0), note(0, 2)], [brk(2), note(20, 4)]]);
    expect(songRegions(ld, 2500)).toEqual([{ start: 2.5, end: 3.5, player: 1 }, { start: 12.5, end: 14.5, player: 1 }]);
    expect(ld.gap).toBe(1000);
    expect(songRegions(ld, undefined)).toEqual(songRegions(ld)); // none given: the lyrics' own
  });

  it('is empty without data', () => {
    expect(songRegions(null)).toEqual([]);
    expect(songRegions({})).toEqual([]);
  });
});

describe('timelineSegments', () => {
  it('keeps one singer\'s regions as they are', () => {
    expect(timelineSegments([{ start: 1, end: 3, player: 1 }, { start: 5, end: 6, player: 1 }])).toEqual([
      { start: 1, end: 3, who: 1 }, { start: 5, end: 6, who: 1 },
    ]);
  });

  it('gives the stretch where both sing a segment of its own', () => {
    expect(timelineSegments([
      { start: 1, end: 4, player: 1 },
      { start: 3, end: 6, player: 2 },
      { start: 8, end: 9, player: 2 },
    ])).toEqual([
      { start: 1, end: 3, who: 1 },
      { start: 3, end: 4, who: 3 },
      { start: 4, end: 6, who: 2 },
      { start: 8, end: 9, who: 2 },
    ]);
  });

  it('handles one singer\'s region inside the other\'s, and regions that touch', () => {
    expect(timelineSegments([
      { start: 0, end: 10, player: 1 },
      { start: 2, end: 4, player: 2 },
      { start: 10, end: 12, player: 2 },
    ])).toEqual([
      { start: 0, end: 2, who: 1 },
      { start: 2, end: 4, who: 3 },
      { start: 4, end: 10, who: 1 },
      { start: 10, end: 12, who: 2 },
    ]);
  });

  it('is empty without regions', () => {
    expect(timelineSegments([])).toEqual([]);
  });
});

describe('frameSeconds / formatTime', () => {
  it('converts the frame tick into seconds when the frame has no time of its own', () => {
    expect(frameSeconds({ lyricData: { bpm: 120, gap: 1000 }, tickFloat: 4 })).toBe(3);
    expect(frameSeconds({})).toBe(0);
  });
  it('is the video time of the frame, also before the song\'s gap and past the last note', () => {
    // tick 0 is 20 s in: until then the frame's tick stands at 0, and read
    // from it the timeline's playhead stood at 0:20 through the whole intro
    const ld: TimedLyrics = {
      bpm: 120, gap: 20000, defaultGap: 20000, lyricRefs: [],
      lyricLines: [[{ isBreak: false, isSpecial: false, isRap: false, isFreestyle: false, start: 0, length: 4, tone: 0, syllable: 'la' }]],
    };
    for (const t of [0, 0.4, 5, 19.99, 20, 31.25, 225]) expect(frameSeconds(getTickData(ld, t))).toBe(t);
    expect(frameSeconds({ lyricData: ld, tickFloat: 0, videoTime: 5 })).toBe(5);
  });
  it('formats m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.7)).toBe('1:05');
    expect(formatTime(-3)).toBe('0:00');
  });
});
