import { describe, expect, test } from 'vitest';
import { createLoopEstimator, gainAt, loopCurve, loopPeak, LMAX, RATE, REF_LEN, WINDOW } from './voiceLoop';

/** Repeatable noise in -1..1 (a linear congruential generator) */
const noise = (n: number, seed: number) => {
  const out = new Float32Array(n);
  let s = seed >>> 0;
  for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; out[i] = s / 2 ** 31 - 1; }
  return out;
};

/**
 * One window as the guard worklet hands it over: the music (`r`, REF_LEN samples
 * from LAG_MAX_S before the stream's window) and the stream (`x`): the music
 * `lagS` later at `gain`, plus a singer louder than it (uncorrelated).
 */
const window = (music: Float32Array, start: number, lagS: number, gain: number, singer: Float32Array) => {
  const r = music.subarray(start, start + REF_LEN);
  const x = new Float32Array(WINDOW);
  const d = Math.round(lagS * RATE);
  for (let t = 0; t < WINDOW; t++) x[t] = gain * r[t + LMAX - d] + singer[start + t];
  return { x, r };
};

describe('voiceLoop', () => {
  test('the curve peaks at the lag the music comes back with, and the gain there is the coupling', () => {
    const music = noise(REF_LEN, 1);
    const { x, r } = window(music, 0, 0.18, 0.1, new Float32Array(REF_LEN));
    const { lag, z } = loopPeak(loopCurve(x, r));
    expect(lag).toBeCloseTo(0.18, 3);
    expect(z).toBeGreaterThan(20);
    const g = gainAt(x, r, Math.round(lag * RATE));
    expect(g.num / g.den).toBeCloseTo(0.1, 3);
  });

  test('summed over windows it finds a quiet loop under a loud singer, and skips windows without music', () => {
    const n = REF_LEN + 10 * 3 * RATE;
    const music = noise(n, 7);
    const singer = noise(n, 99).map(v => v * 0.5); // the singer 14 dB over the speakers coming back
    const est = createLoopEstimator();
    for (let k = 0; k < 8; k++) {
      const { x, r } = window(music, k * 3 * RATE, 0.31, 0.1, singer);
      est.push(x, r);
    }
    const e = est.estimate!;
    expect(e.confident).toBe(true);
    expect(e.lag).toBeCloseTo(0.31, 2);
    expect(e.coupling).toBeGreaterThan(0.08);
    expect(e.coupling).toBeLessThan(0.12);
    expect(e.windows).toBe(8);
    est.push(new Float32Array(WINDOW), new Float32Array(REF_LEN));
    expect(est.estimate!.windows).toBe(8);
  });

  test('a stream with no music in it is not trusted: noise, or a held, tonal voice', () => {
    const est = createLoopEstimator();
    const music = noise(REF_LEN, 3);
    const e = est.push(noise(WINDOW, 4), music);
    expect(e?.confident).toBe(false);
    // a sung line (a fundamental and harmonics with vibrato) and nothing of the speakers, window after window
    const voice = createLoopEstimator();
    for (let k = 0; k < 10; k++) {
      const x = new Float32Array(WINDOW);
      for (let t = 0; t < WINDOW; t++) {
        const s = (k * WINDOW + t) / RATE;
        const ph = 2 * Math.PI * (262 * s - (262 * 0.02 / (2 * Math.PI * 5.5)) * Math.cos(2 * Math.PI * 5.5 * s));
        x[t] = 0.3 * (Math.sin(ph) + 0.6 * Math.sin(2 * ph) + 0.36 * Math.sin(3 * ph));
      }
      expect(voice.push(x, noise(REF_LEN, 50 + k))?.confident).toBe(false);
    }
  });
});
