/**
 * The difficulty levels, mirrored from the backend (singspree-be/src/scoring.ts):
 * how far from a note a sung pitch may be, in semitones. Every singer picks
 * theirs in the microphone panel and this browser keeps it. The server counts
 * them all for everyone, so the level only says which score is theirs, and
 * the highway judges each singer's notes by their own level.
 */
export const DIFFICULTIES = ['veryEasy', 'easy', 'medium', 'hard', 'veryHard'] as const;
export type Difficulty = typeof DIFFICULTIES[number];
export const TOLERANCE: Record<Difficulty, number> = { veryEasy: 3, easy: 2, medium: 1.5, hard: 1, veryHard: 0.5 };
export const DEFAULT_DIFFICULTY: Difficulty = 'easy';

const KEY = 'singspree_difficulty';

const isDifficulty = (d: unknown): d is Difficulty => DIFFICULTIES.some(level => level === d);

export const loadDifficulty = (): Difficulty => {
  try {
    const stored = localStorage.getItem(KEY);
    return isDifficulty(stored) ? stored : DEFAULT_DIFFICULTY;
  } catch { return DEFAULT_DIFFICULTY; }
};
export const storeDifficulty = (level: Difficulty) => {
  try { localStorage.setItem(KEY, level); } catch { /* the slider still holds for this page */ }
};
