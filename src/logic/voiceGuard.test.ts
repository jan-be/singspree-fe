import { describe, expect, test } from 'vitest';
import { createHowlDetector, dbToGain, feedbackCap, gainToDb, GUESSED_COUPLING } from './voiceGuard';

describe('feedbackCap', () => {
  test('6 dB under where the loop would ring, shared by the voices on, less with the echo and after each howl', () => {
    expect(gainToDb(feedbackCap({ coupling: 0.1, singers: 1, echo: false, howls: 0 }))).toBeCloseTo(20 - 6, 1);
    expect(gainToDb(feedbackCap({ coupling: 0.1, singers: 2, echo: false, howls: 0 }))).toBeCloseTo(20 - 6 - 6, 1);
    expect(gainToDb(feedbackCap({ coupling: 0.1, singers: 1, echo: true, howls: 1 }))).toBeCloseTo(20 - 6 - 3 - 3, 1);
    expect(feedbackCap({ coupling: null, singers: 1, echo: false, howls: 0 })).toBeCloseTo(0.5 / GUESSED_COUPLING);
  });
  test('within −12…+24 dB whatever was measured', () => {
    expect(feedbackCap({ coupling: 1e-6, singers: 1, echo: false, howls: 0 })).toBeCloseTo(dbToGain(24));
    expect(feedbackCap({ coupling: 10, singers: 8, echo: true, howls: 9 })).toBeCloseTo(dbToGain(-12));
  });
});

const BINS = 2048;
const BIN_HZ = 48000 / 4096;
/** A spectrum in dB: a floor, and peaks at [hz, dB], each a main lobe over a few bins (a parabola in dB, as a window gives) */
const spectrum = (peaks: [number, number][], floor = -110) => {
  const s = new Float32Array(BINS).fill(floor);
  for (const [hz, db] of peaks) {
    const at = hz / BIN_HZ;
    for (let i = Math.floor(at) - 3; i <= Math.ceil(at) + 3; i++) s[i] = Math.max(s[i], db - 12 * (i - at) ** 2);
  }
  return s;
};

describe('createHowlDetector', () => {
  test('a tone at a pitch that does not move is a howl after 1.2 s, steady or growing; its frequency to a fraction of a bin', () => {
    const steady = createHowlDetector();
    const reads = Array.from({ length: 20 }, () => steady.push(spectrum([[1003.7, -30]]), BIN_HZ));
    expect(reads.findIndex(r => r.howl)).toBe(11); // the 12th spectrum: 1.2 s
    expect(reads[11].freq).toBeCloseTo(1003.7, 0);

    const growing = createHowlDetector();
    const grew = Array.from({ length: 14 }, (_, i) => growing.push(spectrum([[2400, -48 + 2 * i]]), BIN_HZ).howl);
    expect(grew.indexOf(true)).toBe(11);
  });

  test('a voice is not one: vibrato, a straight note that wanders a little, note onsets, a crescendo', () => {
    const det = createHowlDetector();
    const sing = (f0: number, db: number) => det.push(spectrum([[f0, db], [2 * f0, db - 3], [3 * f0, db - 6], [4 * f0, db - 10]]), BIN_HZ).howl;
    // ±2 % vibrato at ~1.4 Hz (10 spectra a second), held for 6 s
    for (let i = 0; i < 60; i++) expect(sing(330 * (1 + 0.02 * Math.sin(i * 0.9)), -30)).toBe(false);
    // a straight tone wandering by under a percent, getting louder
    let f = 262;
    for (let i = 0; i < 60; i++) { f *= 1 + 0.004 * Math.sin(i * 0.37) * Math.cos(i * 1.3); expect(sing(f, -40 + i * 0.3)).toBe(false); }
    // lines: 1.8 s notes from silence, 0.7 s breaths
    for (let n = 0; n < 6; n++) {
      for (let i = 0; i < 18; i++) expect(sing([220, 247, 262][n % 3] * (1 + 0.02 * Math.sin(i * 0.9)), i < 1 ? -60 : -25)).toBe(false);
      for (let i = 0; i < 7; i++) expect(det.push(spectrum([]), BIN_HZ).howl).toBe(false);
    }
  });

  test('quiet peaks are not howls, and a ring is reported once a hold', () => {
    const quiet = createHowlDetector();
    for (let i = 0; i < 30; i++) expect(quiet.push(spectrum([[1000, -60]]), BIN_HZ).howl).toBe(false);
    const ring = createHowlDetector();
    const howls = Array.from({ length: 20 }, () => ring.push(spectrum([[1000, -20]]), BIN_HZ).howl).filter(Boolean);
    expect(howls).toHaveLength(1);
  });
});
