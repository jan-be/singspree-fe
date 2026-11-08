import { describe, it, expect } from 'vitest';
import { layerScale, screenRatio } from './canvasScale';

describe('layerScale', () => {
  it('is the device pixel ratio where the canvas fits', () => {
    expect(layerScale({ dpr: 2.625, cssWidth: 412, cssHeight: 200, maxSize: 4096 })).toBe(2.625); // a phone
    expect(layerScale({ dpr: 1, cssWidth: 1248, cssHeight: 200, maxSize: 16384 })).toBe(1); // a desktop
  });

  it('keeps the canvas within the GPU texture limit', () => {
    // the Fire TV stick: ratio 4, 1248 CSS px, limit 4096 — 4992 px were never shown
    const scale = layerScale({ dpr: 4, cssWidth: 1248, cssHeight: 200, maxSize: 4096 });
    expect(Math.round(1248 * scale)).toBeLessThanOrEqual(4096);
    expect(Math.round(1248 * scale)).toBeGreaterThan(4090);
  });

  it('follows the governor cap, but never below one pixel per CSS pixel', () => {
    expect(layerScale({ dpr: 4, cssWidth: 1248, cssHeight: 200, maxSize: 4096, cap: 1.5 })).toBe(1.5);
    expect(layerScale({ dpr: 2.625, cssWidth: 412, cssHeight: 200, maxSize: 4096, cap: 2 })).toBe(2);
    expect(layerScale({ dpr: 3, cssWidth: 412, cssHeight: 200, maxSize: 4096, cap: 0.5 })).toBe(1);
    expect(layerScale({ dpr: 1, cssWidth: 1248, cssHeight: 200, maxSize: 4096, cap: 1.5 })).toBe(1); // never up
  });
});

describe('screenRatio', () => {
  // a fake screen whose CSS resolution is `res` while it says `dpr`
  const screen = (dpr: number, res: number) => ({
    devicePixelRatio: dpr,
    matchMedia: (q: string) => ({ matches: res >= Number(/min-resolution: ([\d.]+)dppx/.exec(q)![1]) }),
  });

  it('is devicePixelRatio where the resolution agrees', () => {
    expect(screenRatio(screen(2.625, 2.625))).toBe(2.625); // a phone
    expect(screenRatio(screen(1, 1))).toBe(1);
  });

  it("is the resolution's where devicePixelRatio says far more (a 4K Fire TV's WebView)", () => {
    expect(screenRatio(screen(4, 2))).toBe(2);
    expect(screenRatio(screen(4, 1.5))).toBe(1.5);
  });

  it('keeps devicePixelRatio for a small difference, and without media queries', () => {
    expect(screenRatio(screen(1.1, 1))).toBe(1.1); // a desktop page zoom
    expect(screenRatio({ devicePixelRatio: 3 })).toBe(3);
  });
});
