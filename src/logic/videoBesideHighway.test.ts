import { describe, it, expect } from 'vitest';
import { videoShift } from './videoBesideHighway';

describe('videoShift', () => {
  it('moves the video up so its middle is level with the highway on an upright phone', () => {
    // 390x844: the video is 219 tall, its middle at 422
    expect(videoShift(390, 844, 365)).toBe(-57);
    expect(videoShift(390, 844, 319)).toBe(-103);
  });

  it('never moves the video down, nor off the top of the screen', () => {
    expect(videoShift(390, 844, 500)).toBe(0);
    // (844 - 219.4) / 2 = 312 of black above the video at most
    expect(videoShift(390, 844, 40)).toBe(-312);
  });

  it('leaves the video where it is in landscape and on a square screen', () => {
    expect(videoShift(844, 390, 100)).toBe(0);
    expect(videoShift(1280, 800, 200)).toBe(0); // 16:10, some letterbox, still landscape
    expect(videoShift(900, 900, 200)).toBe(0);
  });
});
