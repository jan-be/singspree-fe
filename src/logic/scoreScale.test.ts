import { describe, it, expect } from 'vitest';
import { completionText, starFill, starsFor, toNextStar } from './scoreScale';

describe('scoreScale', () => {
  it('stars and the points to the next one', () => {
    expect([0, 1499, 1500, 2999, 3000, 4500, 7499, 7500, 10000].map(starsFor)).toEqual([0, 0, 1, 1, 2, 3, 4, 5, 5]);
    expect(toNextStar(5500)).toBe(500);
    expect(toNextStar(8000)).toBe(0);
  });

  it('each star fills between the threshold before it and its own', () => {
    expect([0, 1, 2, 3, 4].map(i => starFill(0, i))).toEqual([0, 0, 0, 0, 0]);
    expect([0, 1, 2, 3, 4].map(i => starFill(3750, i))).toEqual([1, 1, 0.5, 0, 0]);
    expect(starFill(750, 0)).toBe(0.5);
    expect([0, 1, 2, 3, 4].map(i => starFill(10000, i))).toEqual([1, 1, 1, 1, 1]);
    expect(starFill(-5, 0)).toBe(0);
  });

  it('a partial play\'s completion reads as the language writes a percentage, rounded down', () => {
    expect(completionText(0.62, 'en')).toBe('62%');
    expect(completionText(0.58, 'en')).toBe('58%');
    expect(completionText(0.899, 'en')).toBe('89%');
    expect(completionText(0.62, 'de')).toBe('62 %');
    expect(completionText(0.62, 'tr')).toBe('%62');
    expect(completionText(0.62, 'not a language!')).toBe('62%');
  });
});
