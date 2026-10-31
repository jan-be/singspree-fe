import { describe, expect, test } from "vitest";
import { seasonAt, seasonEnd, type Season } from "./seasons";
import { halloween } from "./halloween";

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('Halloween', () => {
  test('on in the last week of October, all night long', () => {
    expect(seasonAt(at(2026, 10, 31, 21, 30), [halloween])?.id).toBe('halloween');
    expect(seasonAt(at(2026, 10, 24), [halloween])?.id).toBe('halloween');
    expect(seasonAt(at(2026, 11, 1, 4, 59), [halloween])?.id).toBe('halloween');
  });

  test('over on the morning of 1 November, back next year', () => {
    expect(seasonAt(at(2026, 11, 1, 5, 0), [halloween])).toBeNull();
    expect(seasonAt(at(2026, 10, 23, 23, 59), [halloween])).toBeNull();
    expect(seasonAt(at(2027, 3, 1), [halloween])).toBeNull();
    expect(seasonAt(at(2027, 10, 30), [halloween])?.id).toBe('halloween');
  });

  test('ends at 05:00 on 1 November, local time', () => {
    expect(seasonEnd(halloween, at(2026, 10, 31, 22))).toEqual(at(2026, 11, 1, 5));
  });

  test('has songs for its row, each once', () => {
    expect(halloween.songs.length).toBeGreaterThanOrEqual(12);
    expect(new Set(halloween.songs).size).toBe(halloween.songs.length);
  });
});

describe('a season across New Year', () => {
  const winter: Season = { id: 'winter', from: '12-20', until: '01-02', songs: [] };

  test('on from December into January', () => {
    expect(seasonAt(at(2026, 12, 24), [winter])?.id).toBe('winter');
    expect(seasonAt(at(2027, 1, 1, 23), [winter])?.id).toBe('winter');
    expect(seasonEnd(winter, at(2026, 12, 31))).toEqual(at(2027, 1, 2));
    expect(seasonEnd(winter, at(2027, 1, 1))).toEqual(at(2027, 1, 2));
  });

  test('off before and after', () => {
    expect(seasonAt(at(2026, 12, 19, 23), [winter])).toBeNull();
    expect(seasonAt(at(2027, 1, 2), [winter])).toBeNull();
  });
});
