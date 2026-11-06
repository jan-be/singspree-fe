import { describe, it, expect, assert } from 'vitest';
import { HostClock, Leg, songTimeAhead, WINDOW, SLEW, PINGS } from './hostClock';

// A deterministic stand-in for Math.random
function rng(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

const EVERY = 0.35; // the host's rhythm: 333 ms on a 60 Hz frame loop

/** The host plays from `from` at wall `w0` for `n` messages, each reaching us `way(i)` s after it was sent, in order as TCP keeps them. */
function play(c: HostClock, n: number, way: (i: number) => number, { from = 0, w0 = 100 } = {}) {
  let arrived = -Infinity;
  for (let i = 0; i < n; i++) {
    const sent = w0 + i * EVERY;
    arrived = Math.max(arrived, sent + way(i));
    c.report(from + i * EVERY, true, arrived);
  }
  return w0 + n * EVERY;
}

describe('HostClock', () => {
  it('knows nothing before a message', () => {
    const c = new HostClock();
    expect(c.timeAt(5)).toBe(null);
    expect(c.mode).toBe('unknown');
  });

  it('runs on from a message', () => {
    const c = new HostClock();
    c.report(10, true, 100);
    expect(c.timeAt(100.5)).toBeCloseTo(10.5, 6);
    expect(c.timeAt(103)).toBeCloseTo(13, 6);
  });

  it('keeps the best message of the window: late ones change nothing', () => {
    const c = new HostClock();
    c.report(10, true, 100.02);
    c.report(10.35, true, 100.5); // 130 ms later than the first
    c.report(10.7, true, 100.72);
    expect(c.timeAt(101)).toBeCloseTo(10 + 0.98, 6);
  });

  it('rises at once with a better message', () => {
    const c = new HostClock();
    c.report(10, true, 100.2);
    c.report(10.35, true, 100.37);
    expect(c.timeAt(101)).toBeCloseTo(10.35 + 0.63, 6);
  });

  it('holds still against a jittery way where the last message wins by 100 ms and more', () => {
    const random = rng(99);
    const way = () => (random() < 0.15 ? 0.03 + random() * 0.25 : 0.03 + random() * 0.01);
    const c = new HostClock();
    let worst = 0, naive = 0, last = 0, lastAt = 0, prev = -Infinity;
    for (let i = 0; i < 2000; i++) {
      const sent = 100 + i * EVERY;
      const at = Math.max(prev, sent + way());
      prev = at;
      c.report(i * EVERY, true, at);
      last = i * EVERY; lastAt = at;
      if (i < 20) continue;
      const now = at + 0.1;
      const t = c.timeAt(now);
      assert(t !== null);
      worst = Math.max(worst, Math.abs(now - 100 - t - 0.03));
      naive = Math.max(naive, Math.abs(now - 100 - (last + now - lastAt) - 0.03));
    }
    expect(worst).toBeLessThan(0.012);
    expect(naive).toBeGreaterThan(0.15);
  });

  it('is not moved by a burst: a second of nothing, then everything at once', () => {
    const c = new HostClock();
    const way = (i: number) => (i >= 40 && i < 43 ? 1.1 - (i - 40) * EVERY : 0.03);
    play(c, 60, way);
    const now = 100 + 60 * EVERY;
    expect(c.timeAt(now)).toBeCloseTo(now - 100 - 0.03, 3);
    expect(c.epoch).toBe(1);
  });

  it('never steps back while the song plays on, whatever the way does', () => {
    const random = rng(7);
    const c = new HostClock();
    let last = -Infinity, prev = -Infinity, steps = 0;
    for (let i = 0; i < 4000; i++) {
      const sent = 100 + i * EVERY;
      // now and then the way gets longer for a while, and shorter again
      const slow = Math.floor(i / 300) % 3 === 1 ? 0.12 : 0;
      const at = Math.max(prev, sent + 0.03 + slow + random() * random() * 0.3);
      prev = at;
      const before = c.timeAt(at);
      c.report(i * EVERY, true, at);
      const after = c.timeAt(at) as number;
      if (before !== null && after < before) steps++;
      if (after < last) steps++;
      last = after;
    }
    expect(steps).toBe(0);
  });

  it('comes down to a longer way only once the window has nothing better, and gently', () => {
    const c = new HostClock();
    const end = play(c, 200, (i) => (i < 100 ? 0.03 : 0.13));
    const inWindow = 100 + 100 * EVERY + WINDOW / 2;
    expect(inWindow).toBeLessThan(end);
    const d = new HostClock();
    play(d, Math.floor((inWindow - 100) / EVERY), (i) => (i < 100 ? 0.03 : 0.13));
    expect(d.timeAt(inWindow) as number).toBeCloseTo(inWindow - 100 - 0.03, 3); // still the old best
    const lateEnough = 100 + 100 * EVERY + WINDOW + 0.1 / SLEW + 1;
    const e = new HostClock();
    play(e, Math.ceil((lateEnough - 100) / EVERY), (i) => (i < 100 ? 0.03 : 0.13));
    expect(e.timeAt(lateEnough) as number).toBeCloseTo(lateEnough - 100 - 0.13, 2);
  });

  it('follows a skew of the clocks within a few ms', () => {
    const c = new HostClock();
    const SKEW = 80e-6; // more than the field's recordings show
    for (let i = 0; i < 1000; i++) c.report((100 + i * EVERY) * (1 + SKEW) - 100, true, 100 + i * EVERY + 0.03);
    const now = 100 + 1000 * EVERY;
    expect(Math.abs((c.timeAt(now) as number) - (now * (1 + SKEW) - 100 - 0.03))).toBeLessThan(0.0035);
  });

  it('follows a seek back at once, and a late message is not one', () => {
    const c = new HostClock();
    play(c, 30, () => 0.03);
    c.report(5, true, 120);
    expect(c.timeAt(120.1)).toBeCloseTo(5.1, 6);
    expect(c.mode).toBe('playing');
    expect(c.epoch).toBe(2);
    const d = new HostClock();
    play(d, 30, () => 0.03);
    d.report(30 * EVERY, true, 100 + 30 * EVERY + 1.5); // the next one, 1.5 s late
    expect(d.epoch).toBe(1);
    expect(d.timeAt(112)).toBeCloseTo(12 - 0.03, 3);
  });

  it('follows a seek forward at once', () => {
    const c = new HostClock();
    play(c, 30, () => 0.03);
    c.report(80, true, 110.6);
    expect(c.timeAt(111)).toBeCloseTo(80.4, 6);
  });

  it('after a seek the window of the place before it is gone: nothing holds the new line up', () => {
    const c = new HostClock();
    play(c, 30, () => 0.03);
    c.report(8, true, 110.6); // back by a little more than the rule's edge
    c.report(8.35, true, 110.95);
    expect(c.timeAt(111)).toBeCloseTo(8.4, 6);
  });

  it('follows a small seek back at once too', () => {
    const c = new HostClock();
    play(c, 30, () => 0.03);
    const time = 29 * EVERY - 0.2; // 0.55 s behind where it would be
    c.report(time, true, 110.53);
    expect(c.timeAt(110.53)).toBeCloseTo(time, 6);
  });

  it('comes down gently when the host\'s clock corrects itself a little', () => {
    const c = new HostClock();
    play(c, 30, () => 0.03);
    const at = 100 + 30 * EVERY + 0.03;
    const time = 30 * EVERY - 0.1; // 100 ms behind the line: it moved 250 ms in a rhythm of 350
    c.report(time, true, at);
    expect(c.mode).toBe('playing');
    const a = c.timeAt(at) as number, b = c.timeAt(at + 0.1) as number;
    expect(a).toBeCloseTo(time + 0.1, 3); // not yet
    expect(b).toBeGreaterThan(a);
    expect((c.timeAt(at + 1.2) as number) - (time + 1.2)).toBeCloseTo(0, 3); // done in a second
  });

  it('starts over after a silence: a reloaded host is not a late one', () => {
    const c = new HostClock();
    play(c, 30, () => 0.03);
    // 8 s of nothing, and it goes on 1.5 s behind where the party was
    const at = 100 + 30 * EVERY + 8;
    const time = 30 * EVERY + 8 - 1.5;
    c.report(time, true, at);
    expect(c.timeAt(at)).toBeCloseTo(time, 6);
    c.report(time + EVERY, true, at + EVERY);
    expect(c.timeAt(at + 1)).toBeCloseTo(time + 1, 6);
  });

  it('takes a hidden host\'s one message a second as the song playing on', () => {
    const c = new HostClock();
    for (let i = 0; i < 60; i++) c.report(i, true, 100 + i + (i % 7 === 0 ? 0.03 : 0.15));
    expect(c.epoch).toBe(1);
    expect(c.timeAt(160)).toBeCloseTo(59.97, 6);
  });

  it('stands still when the host\'s time does, whatever the message says, and goes on when it moves', () => {
    const c = new HostClock();
    play(c, 30, () => 0.03);
    const stuck = 29 * EVERY;
    c.report(stuck, true, 110.9);
    expect(c.mode).toBe('stopped');
    expect(c.timeAt(115)).toBe(stuck);
    c.report(stuck, true, 111.25);
    expect(c.timeAt(115)).toBe(stuck);
    c.report(stuck + 0.3, true, 111.6);
    expect(c.mode).toBe('playing');
    expect(c.timeAt(112.6)).toBeCloseTo(stuck + 1.3, 6);
  });

  it('stops at a pause and goes on from the message that says it plays', () => {
    const c = new HostClock();
    play(c, 30, () => 0.03);
    c.report(10.2, false, 111);
    expect(c.timeAt(120)).toBe(10.2);
    c.report(10.2, false, 121);
    c.report(10.2, true, 121.4); // the first message after the play
    c.report(10.5, true, 121.75);
    expect(c.timeAt(122.75)).toBeCloseTo(11.5, 6);
  });

  it('forgets the last song', () => {
    const c = new HostClock();
    play(c, 30, () => 0.03, { from: 200 });
    c.reset();
    expect(c.timeAt(111)).toBe(null);
    c.report(0.2, true, 112);
    expect(c.timeAt(113)).toBeCloseTo(1.2, 6);
    expect(c.epoch).toBe(1);
  });

  it('survives a frozen tab: what was queued comes in a burst, and the clock runs on', () => {
    const c = new HostClock();
    play(c, 30, () => 0.03);
    // half a window frozen: every message of it handled at once on waking, then the rhythm again
    const queued = Math.round(WINDOW / 2 / EVERY);
    const wake = 100 + (30 + queued) * EVERY;
    for (let i = 30; i < 30 + queued; i++) c.report(i * EVERY, true, wake);
    const next = wake + 0.2;
    c.report((30 + queued) * EVERY + 0.1, true, next);
    expect(c.timeAt(next)).toBeCloseTo(next - 100 - 0.03, 2);
    expect(c.epoch).toBe(1);
  });

  it('survives a tab frozen for longer than the window', () => {
    const c = new HostClock();
    play(c, 30, () => 0.03);
    const wake = 100 + 30 * EVERY + WINDOW + 20;
    const n = Math.floor((wake - 100) / EVERY);
    const before = c.timeAt(wake) as number;
    for (let i = 30; i < n; i++) c.report(i * EVERY, true, wake);
    expect(c.timeAt(wake) as number).toBeCloseTo(before, 1); // not dragged to the first queued message
    const next = wake + 0.3;
    c.report(n * EVERY + 0.3, true, next);
    expect(Math.abs((c.timeAt(next) as number) - (next - 100 - 0.03))).toBeLessThan(0.06);
  });

  it('stops when the host goes, and takes up whatever a reloaded host says', () => {
    const c = new HostClock();
    play(c, 30, () => 0.03);
    c.halt(112);
    expect(c.mode).toBe('stopped');
    const at = c.timeAt(120) as number;
    expect(at).toBeCloseTo(12 - 0.03, 3);
    c.report(at - 2, false, 130); // back, its player still starting where the party was
    expect(c.timeAt(130)).toBe(at - 2);
    c.report(at - 2 + 0.3, true, 131);
    expect(c.timeAt(131.5)).toBeCloseTo(at - 2 + 0.8, 6);
  });

  it('does not mistake one message for a stall after a time that did not move for lack of a message', () => {
    const c = new HostClock();
    c.report(10, true, 100);
    expect(c.mode).toBe('playing');
    c.report(10.0001, true, 100.35);
    expect(c.mode).toBe('stopped');
    c.report(10.35, true, 100.7);
    expect(c.mode).toBe('playing');
  });

  it('adds the way from the server to the time', () => {
    const c = new HostClock({ leg: 0.08 });
    c.report(10, true, 100);
    expect(c.timeAt(100)).toBeCloseTo(10.08, 6);
    c.report(10.35, true, 100.35);
    expect(c.timeAt(100.35)).toBeCloseTo(10.43, 6);
  });

  it('takes a shorter way in gently and a longer one at once', () => {
    const c = new HostClock({ leg: 0.08 });
    c.report(10, true, 100);
    c.leg = 0.05;
    c.report(10.35, true, 100.35);
    expect(c.timeAt(100.35)).toBeCloseTo(10.43, 6);
    expect(c.timeAt(100.35 + 0.03 / SLEW)).toBeCloseTo(10.4 + 0.03 / SLEW, 6);
    c.leg = 0.1;
    c.report(10.7, true, 100.7);
    expect(c.timeAt(100.7)).toBeCloseTo(10.8, 6);
  });
});

describe('Leg', () => {
  it('is nothing before a ping', () => {
    expect(new Leg().seconds).toBe(0);
  });

  it('is the shortest of the last pings', () => {
    const leg = new Leg();
    for (const ms of [90, 40, 300, 60]) leg.ack(ms);
    expect(leg.seconds).toBeCloseTo(0.04, 6);
    for (let i = 0; i < PINGS; i++) leg.ack(70);
    expect(leg.seconds).toBeCloseTo(0.07, 6);
  });

  it('takes nothing that is not a number of ms', () => {
    const leg = new Leg();
    for (const ms of [undefined, null, NaN, -5, '30']) leg.ack(ms);
    expect(leg.seconds).toBe(0);
  });
});

describe('songTimeAhead', () => {
  it('sends a playing song\'s time as of the server, a stopped one\'s as it is', () => {
    const leg = new Leg();
    leg.ack(50);
    expect(songTimeAhead(10, true, leg)).toBeCloseTo(10.05, 6);
    expect(songTimeAhead(10, false, leg)).toBe(10);
  });
});
