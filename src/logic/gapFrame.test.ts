import { describe, it, expect } from 'vitest';
import { carryGap, clampGap, MIN_GAP_MS } from './gapFrame';

describe('carryGap', () => {
  it('keeps the distance from the base when the base changes', () => {
    // The solo chart plays at 22010 (1670 + a 20.34 s video offset), dragged 300 ms later;
    // the duet twin's own base is 5000: it gets the same 300 ms on top
    expect(carryGap(22310, 22010, 5000)).toBe(5300);
    expect(carryGap(5300, 5000, 22010)).toBe(22310);
  });

  it('is the identity when both charts share a base', () => {
    expect(carryGap(1500, 1260, 1260)).toBe(1500);
  });

  it('falls back to the new base without a usable gap or old base, and keeps the gap without a new base', () => {
    expect(carryGap(NaN, 1000, 2000)).toBe(2000);
    expect(carryGap(1500, undefined, 2000)).toBe(2000);
    // @ts-expect-error a base the API sent as null
    expect(carryGap(1500, 1000, null)).toBe(1500);
  });
});

describe('clampGap', () => {
  it('lets a gap go below 0 (the video starts after the first beat of the chart)', () => {
    expect(clampGap(-9100)).toBe(-9100);
    expect(clampGap(0)).toBe(0);
    expect(clampGap(16130)).toBe(16130);
  });

  it('stops at ten minutes before the video', () => {
    expect(clampGap(MIN_GAP_MS - 1)).toBe(MIN_GAP_MS);
    expect(clampGap(-Infinity)).toBe(MIN_GAP_MS);
  });
});
