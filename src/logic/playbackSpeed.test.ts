import { describe, it, expect } from 'vitest';
import { clampSpeed, catchUpRate, speedLabel, SPEED_MIN, SPEED_MAX } from './playbackSpeed';

describe('clampSpeed', () => {
  it('keeps the slider on its steps and in its range', () => {
    expect(clampSpeed(0.85)).toBe(0.85);
    expect(clampSpeed(0.05 * 17)).toBe(0.85);
    expect(clampSpeed(0.87)).toBe(0.85);
    expect(clampSpeed(0.1)).toBe(SPEED_MIN);
    expect(clampSpeed(3)).toBe(SPEED_MAX);
    expect(clampSpeed(NaN)).toBe(1);
  });
});

describe('catchUpRate', () => {
  it('at normal speed: a quarter faster or slower, as before', () => {
    expect(catchUpRate(1, -0.1)).toBe(1.25);
    expect(catchUpRate(1, 0.1)).toBe(0.75);
    expect(catchUpRate(1, 0.01)).toBe(1);
  });

  it("at another speed: around it, on the player's steps, never the speed itself", () => {
    expect(catchUpRate(0.85, -0.1)).toBe(1.05);  // 1.0625, which the player plays at 1.05
    expect(catchUpRate(0.85, 0.1)).toBe(0.65);   // 0.6375
    expect(catchUpRate(0.85, 0)).toBe(0.85);
    expect(catchUpRate(0.5, 0.1)).toBe(0.4);
    expect(catchUpRate(1.5, -0.1)).toBe(1.9);
  });
});

describe('speedLabel', () => {
  it('reads as people write it', () => {
    expect(speedLabel(1)).toBe('1×');
    expect(speedLabel(0.85)).toBe('0.85×');
    expect(speedLabel(1.5)).toBe('1.5×');
  });
});
