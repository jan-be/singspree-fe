import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DIFFICULTY, TOLERANCE, loadDifficulty, storeDifficulty } from './difficulty';

describe('difficulty', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, String(v)) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts at easy', () => {
    expect(DEFAULT_DIFFICULTY).toBe('easy');
    expect(loadDifficulty()).toBe('easy');
    expect(TOLERANCE).toEqual({ veryEasy: 3, easy: 2, medium: 1.5, hard: 1, veryHard: 0.5 });
  });

  it('keeps the level picked', () => {
    storeDifficulty('hard');
    expect(loadDifficulty()).toBe('hard');
  });

  it('reads anything else as the default', () => {
    localStorage.setItem('singspree_difficulty', 'nightmare');
    expect(loadDifficulty()).toBe('easy');
  });

  it('works without storage: the default, and nothing thrown', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(loadDifficulty()).toBe('easy');
    expect(() => storeDifficulty('hard')).not.toThrow();
  });
});
