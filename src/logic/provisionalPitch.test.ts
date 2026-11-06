import { describe, it, expect } from 'vitest';
import { PROVISIONAL, confirmProvisional, createProvisionalTracker, expireProvisional } from './provisionalPitch';
import type { ProvisionalLine } from './provisionalPitch';

const line = (...times: number[]): ProvisionalLine => ({ username: 'a', notes: times.map(videoTime => ({ videoTime, freq: 220, at: videoTime * 1000 })) });

describe('createProvisionalTracker', () => {
  const SLOW = PROVISIONAL.carryMaxInferMs + 1; // a device that only looks for note starts

  /** A tracker that has just heard someone sing for a while, up to t = 10 */
  const afterSinging = () => {
    const p = createProvisionalTracker();
    for (let t = 8.5; t <= 10; t += 0.03) p.scored(220, t);
    return p;
  };

  it('takes a window the model is fairly sure of while someone sings', () => {
    const p = afterSinging();
    expect(p.pick(220, PROVISIONAL.entry, 10.1)).toBe(220);
    expect(p.pick(220, PROVISIONAL.entry - 0.01, 10.1)).toBe(0);
  });

  it('asks more with nobody singing: instruments reach that much at a note of theirs', () => {
    const p = createProvisionalTracker();
    expect(p.pick(220, PROVISIONAL.entryAlone - 0.01, 1)).toBe(0);
    expect(p.pick(220, PROVISIONAL.entryAlone, 1)).toBe(220);
  });

  it('counts someone as singing for as long as enough of the last seconds were sung', () => {
    const p = afterSinging();
    const conf = PROVISIONAL.entryAlone - 0.01;
    expect(p.pick(220, conf, 10 + PROVISIONAL.sungWindowS - 1.6)).toBe(220);
    expect(p.pick(220, conf, 10 + PROVISIONAL.sungWindowS)).toBe(0);
  });

  it('a few stray windows do not make anyone a singer', () => {
    const p = createProvisionalTracker();
    for (let t = 1; t < 1.3; t += 0.03) p.scored(220, t);
    expect(p.pick(220, PROVISIONAL.entry, 1.4)).toBe(0);
  });

  it('leaves pitches outside the singing range alone', () => {
    const p = createProvisionalTracker();
    expect(p.pick(30, 0.99, 1)).toBe(0);
    expect(p.pick(3000, 0.99, 1)).toBe(0);
  });

  it('saves a slower device the windows while the scored stream carries the line', () => {
    const p = createProvisionalTracker();
    p.scored(220, 1);
    expect(p.wanted(1 + PROVISIONAL.recentS - 0.001, SLOW, true)).toBe(false);
    expect(p.wanted(1 + PROVISIONAL.recentS + 0.001, SLOW, true)).toBe(true);
  });

  it('runs a fast device all the time, but for the windows that end with a scored one', () => {
    const p = createProvisionalTracker();
    p.scored(220, 1);
    expect(p.wanted(1.01, PROVISIONAL.carryMaxInferMs, true)).toBe(true);
    expect(p.wanted(1.03, PROVISIONAL.carryMaxInferMs, false)).toBe(false);
  });

  it('runs a window that ends with a scored one while the line waits for a note', () => {
    const p = createProvisionalTracker();
    expect(p.wanted(1, SLOW, false)).toBe(true);
  });

  it('counts a device as slower until its speed is known', () => {
    const p = createProvisionalTracker();
    p.scored(220, 1);
    expect(p.wanted(1.01, 0, true)).toBe(false);
  });

  it('leaves a device alone that needs its time for the scored windows', () => {
    const p = createProvisionalTracker();
    expect(p.wanted(1, PROVISIONAL.maxInferMs + 1, true)).toBe(false);
  });

  it('does not count a window the scored stream had no pitch for', () => {
    const p = createProvisionalTracker();
    p.scored(0, 1);
    expect(p.wanted(1.01, SLOW, true)).toBe(true);
  });

  it('forgets the scored stream when told to start over', () => {
    const p = afterSinging();
    p.reset();
    expect(p.wanted(10.01, SLOW, true)).toBe(true);
    expect(p.pick(220, PROVISIONAL.entry, 10.01)).toBe(0);
  });
});

describe('a provisional line', () => {
  it('gives way to the notes that cover it, oldest first', () => {
    const l = line(1, 1.01, 1.02);
    confirmProvisional(l, 1.01);
    expect(l.notes.map(n => n.videoTime)).toEqual([1.02]);
  });

  it('is left alone without a line', () => {
    expect(() => confirmProvisional(null, 1)).not.toThrow();
  });

  it('goes when no note came in time', () => {
    const l = line(1, 1.05);
    expireProvisional(l, 1000 + PROVISIONAL.expireMs + 1);
    expect(l.notes.map(n => n.videoTime)).toEqual([1.05]);
    expireProvisional(l, 1050 + PROVISIONAL.expireMs + 1);
    expect(l.notes).toEqual([]);
  });
});
