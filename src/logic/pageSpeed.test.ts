import { describe, expect, test } from 'vitest';
import { createPageSpeed } from './pageSpeed';

/** `seconds` of frames at `fps`, from `t`; returns where it ended */
const run = (speed: ReturnType<typeof createPageSpeed>, t: number, fps: number, seconds: number) => {
  const end = t + seconds * 1000;
  for (let now = t; now < end; now += 1000 / fps) speed.frame(now);
  return end;
};

describe('createPageSpeed', () => {
  test('a page that keeps up says nothing', () => {
    const changes: boolean[] = [];
    const speed = createPageSpeed(s => changes.push(s));
    run(speed, 0, 60, 30);
    expect(changes).toEqual([]);
    expect(speed.slow).toBe(false);
  });

  test('a real stick at 40 frames a second is fine with the messages', () => {
    const changes: boolean[] = [];
    run(createPageSpeed(s => changes.push(s)), 0, 40, 30);
    expect(changes).toEqual([]);
  });

  test('three seconds under 30 frames: it asks for the flush, once', () => {
    const changes: boolean[] = [];
    const speed = createPageSpeed(s => changes.push(s));
    const t = run(speed, 0, 60, 5);
    run(speed, t, 15, 20);
    expect(changes).toEqual([true]);
    expect(speed.slow).toBe(true);
  });

  test('a hiccup of two seconds does not count', () => {
    const changes: boolean[] = [];
    const speed = createPageSpeed(s => changes.push(s));
    let t = 0;
    for (let i = 0; i < 5; i++) {
      t = run(speed, t, 60, 4);
      t = run(speed, t, 15, 2);
    }
    expect(changes).toEqual([]);
  });

  test('back at 40 frames for five seconds it asks for the notes again, not before', () => {
    const changes: boolean[] = [];
    const speed = createPageSpeed(s => changes.push(s));
    let t = run(speed, 0, 15, 6);
    t = run(speed, t, 35, 20); // in between: stays as it is, or it would flip back and forth
    expect(changes).toEqual([true]);
    t = run(speed, t, 60, 3);
    expect(speed.slow).toBe(true);
    run(speed, t, 60, 4);
    expect(changes).toEqual([true, false]);
  });

  test('a song that stood still is no frame rate', () => {
    const changes: boolean[] = [];
    const speed = createPageSpeed(s => changes.push(s));
    for (let t = 0; t < 60_000; t += 5_000) speed.frame(t);
    expect(changes).toEqual([]);
  });
});
