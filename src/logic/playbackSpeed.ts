// playbackSpeed.ts — the song's speed (the speed slider in the party's
// settings menu) and the rates a joiner's video plays at to keep up with it.
//
// YouTube's player takes any rate from 0.25 to 2 in steps of 0.05 and plays
// one in between at the step below (0.9375 played at 0.9), keeping the pitch.
// The slider offers half to one and a half times; every rate here is a step.

export const SPEED_MIN = 0.5;
export const SPEED_MAX = 1.5;
export const SPEED_STEP = 0.05;
/** What YouTube's player plays at all */
const RATE_MIN = 0.25;
const RATE_MAX = 2;

/** `x` on the 0.05 steps (0.85, not 0.8500000000000001) */
const onStep = (x: number) => Math.round(x / SPEED_STEP) / (1 / SPEED_STEP);

/** A speed the slider can stand at: on a step, between SPEED_MIN and SPEED_MAX (anything else: 1). */
export function clampSpeed(x: number): number {
  if (!Number.isFinite(x)) return 1;
  return onStep(Math.min(SPEED_MAX, Math.max(SPEED_MIN, x)));
}

/**
 * The rate a joiner's video plays at to close `drift` (its time − the host's,
 * s) at the song's speed `base`: a quarter faster or slower, at least a step,
 * as the player plays it.
 */
export function catchUpRate(base: number, drift: number): number {
  const clamp = (x: number) => Math.min(RATE_MAX, Math.max(RATE_MIN, x));
  if (drift < -0.02) return clamp(Math.max(onStep(base * 1.25), onStep(base) + SPEED_STEP));
  if (drift > 0.02) return clamp(Math.min(onStep(base * 0.75), onStep(base) - SPEED_STEP));
  return clamp(onStep(base));
}

/** "0.85×", "1×", "1.5×" */
export const speedLabel = (x: number) => `${Number(x.toFixed(2))}×`;
