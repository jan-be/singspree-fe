import { describe, expect, test } from 'vitest';
import { levelFor, levelProgress, xpToReach } from './level';

describe('level', () => {
  test('each level costs 10 XP more than the one before', () => {
    expect([1, 2, 3, 4, 5, 10, 20].map(xpToReach)).toEqual([0, 10, 30, 60, 100, 450, 1900]);
  });

  test('a level is reached on its step exactly, not a point before', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(10)).toBe(2);
    for (let level = 2; level <= 500; level++) {
      expect(levelFor(xpToReach(level))).toBe(level);
      expect(levelFor(xpToReach(level) - 1)).toBe(level - 1);
    }
  });

  test('no XP, or nonsense, is level 1 at its start', () => {
    expect(levelFor(-3)).toBe(1);
    expect(levelFor(Number.NaN)).toBe(1);
    expect(levelProgress(Number.NaN)).toEqual({ level: 1, share: 0, toNext: 10 });
  });

  test('the way to the next level', () => {
    expect(levelProgress(0)).toEqual({ level: 1, share: 0, toNext: 10 });
    expect(levelProgress(45)).toEqual({ level: 3, share: 0.5, toNext: 15 }); // 30 → 60
    expect(levelProgress(1384)).toEqual({ level: 17, share: (1384 - 1360) / 170, toNext: 146 });
  });
});
