import { describe, it, expect } from 'vitest';
import { createFramePacer, LEAD_MS, MAX_COST_MS, MAX_LEAD_SHARE, MISS_LIMIT, REST_FRAMES, SECOND_CHANCES, type FramePacer } from './framePacer';

// A clock and timers that move only when the test says so
function fakeClock() {
  let t = 0;
  let next = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    now: () => t,
    setTimer: (run: () => void, ms: number) => { const id = next++; timers.set(id, { at: t + ms, run }); return id; },
    clearTimer: (id: number) => { timers.delete(id); },
    /** Time goes on to `at`; timers fire on the way, at their moment. */
    to(at: number) {
      for (;;) {
        const due = [...timers.entries()].filter(([, x]) => x.at <= at).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        t = Math.max(t, due[1].at);
        due[1].run();
      }
      t = at;
    },
    /** Time goes on with no timer getting to run: a page stuck in a long task. */
    stuckTo(at: number) { t = at; },
    pending: () => timers.size,
  };
}

const FRAME = 16;
const beat = (n: number, from = 0, ms = FRAME) => Array.from({ length: n }, (_, i) => from + i * ms);
function play(pacer: FramePacer, clock: ReturnType<typeof fakeClock>, frames: number[], late = true) {
  for (const at of frames) {
    clock.to(at);
    pacer.frame(at, late);
  }
}

describe('createFramePacer', () => {
  it('paints at once until the rate is known', () => {
    const clock = fakeClock();
    let paints = 0;
    const pacer = createFramePacer(() => { paints++; }, clock);
    play(pacer, clock, beat(2));
    expect(paints).toBe(2);
    expect(clock.pending()).toBe(0);
  });

  it('paints a steady frame the lead before the next one, the cursor gone along', () => {
    const clock = fakeClock();
    const paintedAt: number[] = [];
    const aheads: number[] = [];
    const pacer = createFramePacer(() => { paintedAt.push(clock.now()); aheads.push(pacer.ahead); }, clock);
    play(pacer, clock, beat(5));
    expect(clock.pending()).toBe(1);
    clock.to(5 * FRAME);
    expect(paintedAt[paintedAt.length - 1]).toBe(5 * FRAME - LEAD_MS);
    expect(aheads[aheads.length - 1]).toBe(FRAME - LEAD_MS);
    expect(pacer.ahead).toBe(0); // only while it paints
  });

  it('gives every animation frame one paint, in order', () => {
    const clock = fakeClock();
    let paints = 0;
    const pacer = createFramePacer(() => { paints++; }, clock);
    play(pacer, clock, beat(60));
    clock.to(1000);
    expect(paints).toBe(60);
  });

  it('paints what still waits when the next frame comes first (a late timer, a busy page)', () => {
    const clock = fakeClock();
    let paints = 0;
    const aheads: number[] = [];
    const pacer = createFramePacer(() => { paints++; aheads.push(pacer.ahead); }, clock);
    play(pacer, clock, beat(4));
    const before = paints;
    clock.stuckTo(4 * FRAME);
    pacer.frame(4 * FRAME, true);
    expect(paints).toBe(before + 1);
    expect(aheads[aheads.length - 1]).toBe(0);
    expect(clock.pending()).toBe(1); // the new frame waits for its own moment
  });

  it('paints at once when told not to wait, and what waited goes first', () => {
    const clock = fakeClock();
    let paints = 0;
    const pacer = createFramePacer(() => { paints++; }, clock);
    play(pacer, clock, beat(4));
    const before = paints;
    clock.stuckTo(4 * FRAME);
    pacer.frame(4 * FRAME, false);
    expect(paints).toBe(before + 2);
    expect(clock.pending()).toBe(0);
  });

  it('paints at once after a frame off the rate, and waits again once it is steady', () => {
    const clock = fakeClock();
    let paints = 0;
    const pacer = createFramePacer(() => { paints++; }, clock);
    play(pacer, clock, beat(4));
    clock.to(1000);
    const before = paints;
    pacer.frame(1000, true); // a long gap
    expect(paints).toBe(before + 1);
    expect(clock.pending()).toBe(0);
    play(pacer, clock, [1000 + FRAME]);
    expect(clock.pending()).toBe(1);
  });

  it('takes on a new rate after a few frames', () => {
    const clock = fakeClock();
    const pacer = createFramePacer(() => {}, clock);
    play(pacer, clock, beat(6));
    expect(pacer.frameMs).toBeCloseTo(FRAME);
    play(pacer, clock, beat(8, 6 * FRAME, 8));
    expect(pacer.frameMs).toBeCloseTo(8);
  });

  it('does not wait where the lead would be most of the frame', () => {
    const clock = fakeClock();
    let paints = 0;
    const pacer = createFramePacer(() => { paints++; }, clock);
    play(pacer, clock, beat(5, 0, (LEAD_MS / MAX_LEAD_SHARE) - 0.5));
    expect(paints).toBe(5);
    expect(clock.pending()).toBe(0);
  });

  it('builds a slow picture earlier, by what it takes', () => {
    const clock = fakeClock();
    const paintedAt: number[] = [];
    const pacer = createFramePacer(() => { paintedAt.push(clock.now()); clock.stuckTo(clock.now() + 1.5); }, clock);
    play(pacer, clock, beat(60));
    clock.to(60 * FRAME);
    expect(paintedAt[paintedAt.length - 1]).toBeCloseTo(60 * FRAME - LEAD_MS - 1.5);
  });

  it('is not put off by one slow picture', () => {
    const clock = fakeClock();
    let ms = 0;
    const pacer = createFramePacer(() => { clock.stuckTo(clock.now() + ms); ms = 0; }, clock);
    play(pacer, clock, beat(10));
    ms = 10;
    clock.to(10 * FRAME);
    play(pacer, clock, beat(3, 10 * FRAME));
    expect(clock.pending()).toBe(1);
  });

  it('stops waiting when the picture takes long, and starts again when it no longer does', () => {
    const clock = fakeClock();
    let ms = MAX_COST_MS + 0.5;
    const pacer = createFramePacer(() => { clock.stuckTo(clock.now() + ms); }, clock);
    play(pacer, clock, beat(30));
    expect(clock.pending()).toBe(0);
    ms = 0;
    play(pacer, clock, beat(30, 30 * FRAME));
    expect(clock.pending()).toBe(1);
  });

  it('does not wait when the frame ran so late that its moment has passed', () => {
    const clock = fakeClock();
    let paints = 0;
    const pacer = createFramePacer(() => { paints++; }, clock);
    play(pacer, clock, beat(4));
    clock.to(4 * FRAME);
    const before = paints;
    clock.stuckTo(5 * FRAME - LEAD_MS - 0.5); // the main thread got to this frame only now
    pacer.frame(4 * FRAME, true);
    expect(paints).toBeGreaterThan(before);
    expect(clock.pending()).toBe(0);
  });

  // Frames from `n` on the beat, every one's paint reported as drawn `late` ms after the signal it was for (or in time)
  function drawnFrames(pacer: FramePacer, clock: ReturnType<typeof fakeClock>, n: number, count: number, late: number) {
    for (let i = n; i < n + count; i++) {
      clock.to(i * FRAME);
      pacer.frame(i * FRAME, true);
      clock.to(i * FRAME + FRAME - 0.5);
      pacer.drawn((i + 1) * FRAME + late);
    }
    return n + count;
  }

  it('forgives the odd paint that misses the signal', () => {
    const clock = fakeClock();
    const pacer = createFramePacer(() => {}, clock);
    let n = drawnFrames(pacer, clock, 0, 10, -1);
    for (let i = 0; i < 10; i++) {
      n = drawnFrames(pacer, clock, n, 1, 1);
      n = drawnFrames(pacer, clock, n, 39, -1);
    }
    clock.to(n * FRAME);
    pacer.frame(n * FRAME, true);
    expect(clock.pending()).toBe(1);
  });

  it('goes back to the animation frame when paints keep missing the signal, and tries again after a rest', () => {
    const clock = fakeClock();
    const pacer = createFramePacer(() => {}, clock);
    let n = drawnFrames(pacer, clock, 0, 10, -1);
    n = drawnFrames(pacer, clock, n, MISS_LIMIT, 1);
    const from = n;
    for (;; n++) {
      clock.to(n * FRAME);
      pacer.frame(n * FRAME, true);
      if (clock.pending() === 1) break;
    }
    expect(n - from).toBe(REST_FRAMES - 1);
  });

  it('counts timers that came too late as misses too', () => {
    const clock = fakeClock();
    const pacer = createFramePacer(() => {}, clock);
    play(pacer, clock, beat(4));
    for (let n = 4; n < 4 + MISS_LIMIT; n++) {
      clock.stuckTo(n * FRAME);
      pacer.frame(n * FRAME, true);
    }
    expect(clock.pending()).toBe(0);
  });

  it('rests twice as long when the next try goes no better, and starts over after a good stretch', () => {
    const clock = fakeClock();
    const pacer = createFramePacer(() => {}, clock);
    const framesToWaitAgain = (from: number) => {
      for (let n = from; ; n++) {
        clock.to(n * FRAME);
        pacer.frame(n * FRAME, true);
        if (clock.pending() === 1) return n;
        expect(n - from).toBeLessThan(10000);
      }
    };
    let n = drawnFrames(pacer, clock, 0, 10, -1);
    n = drawnFrames(pacer, clock, n, MISS_LIMIT, 1);
    n = framesToWaitAgain(n);
    expect(n).toBeGreaterThanOrEqual(10 + MISS_LIMIT + REST_FRAMES - 1);
    clock.to(n * FRAME + FRAME - 0.5);
    pacer.drawn((n + 1) * FRAME + 1); // the try misses at once
    n = drawnFrames(pacer, clock, n + 1, SECOND_CHANCES - 1, 1);
    const again = framesToWaitAgain(n);
    expect(again - n).toBeGreaterThanOrEqual(2 * REST_FRAMES - 1);
    clock.to(again * FRAME + FRAME - 0.5);
    pacer.drawn((again + 1) * FRAME - 1);
    n = drawnFrames(pacer, clock, again + 1, 200, -1); // a good stretch pays it all off
    n = drawnFrames(pacer, clock, n, MISS_LIMIT, 1);
    const third = framesToWaitAgain(n);
    expect(third - n).toBeLessThanOrEqual(REST_FRAMES + 1);
  });

  it('says what share of its paints came at their moment', () => {
    const clock = fakeClock();
    const pacer = createFramePacer(() => {}, clock);
    play(pacer, clock, beat(12));
    clock.to(12 * FRAME);
    expect(pacer.takeLateShare()).toBeCloseTo(10 / 12); // the first two frames set the rate
    expect(pacer.takeLateShare()).toBe(0);
  });

  it('forgets what waits when told to', () => {
    const clock = fakeClock();
    let paints = 0;
    const pacer = createFramePacer(() => { paints++; }, clock);
    play(pacer, clock, beat(4));
    const before = paints;
    pacer.cancel();
    clock.to(1000);
    expect(paints).toBe(before);
  });
});
