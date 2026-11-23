/**
 * An account's level from its XP, mirrored from the backend
 * (singspree-be/src/level.ts): every finished song earns 10 XP and 2 per
 * star, each level costs 10 XP more than the one before (level 2 at 10 XP,
 * 5 at 100, 10 at 450). The backend sends the XP; the level is worked out here.
 */
export const XP_STEP = 10;

/** Total XP that reaches `level` (1 at 0). */
export const xpToReach = (level: number) => (XP_STEP / 2) * level * (level - 1);

/** The level `xp` reaches, 1 and up. */
export function levelFor(xp: number): number {
  if (!(xp > 0)) return 1; // (NaN too)
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * xp) / XP_STEP)) / 2));
  // (the square root lands a hair low or high on some exact steps)
  while (xpToReach(level + 1) <= xp) level++;
  while (level > 1 && xpToReach(level) > xp) level--;
  return level;
}

/** Where `xp` stands: its level, the share of the way to the next (0–1) and the XP still missing. */
export function levelProgress(xp: number): { level: number; share: number; toNext: number } {
  const level = levelFor(xp);
  const from = xpToReach(level), to = xpToReach(level + 1);
  const have = Math.max(from, Number.isFinite(xp) ? xp : 0);
  return { level, share: (have - from) / (to - from), toNext: to - have };
}
