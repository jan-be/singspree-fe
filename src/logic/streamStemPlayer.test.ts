import { describe, it, expect, vi, beforeEach, afterEach, assert, type Mock } from 'vitest';
import { StreamingStemPlayer } from './streamStemPlayer';
import type { StemGains } from './stemPlayer';

interface FakeAudio {
  crossOrigin: string | null;
  preload: '' | 'none' | 'metadata' | 'auto';
  paused: boolean;
  currentTime: number;
  duration: number;
  error: { code: number } | null;
  seeking: boolean;
  readyState: number;
  src: string;
  refuse?: boolean;
  addEventListener(type: string, fn: () => void, options?: { once?: boolean }): void;
  emit(type: string): void;
  play: Mock<() => Promise<void>>;
  pause: Mock<() => void>;
  removeAttribute(name: string): void;
  load(): void;
}
interface FakeGain {
  connect(): void;
  disconnect(): void;
  gain: { value: number; cancelScheduledValues(): void; setValueAtTime(v: number): void; linearRampToValueAtTime(v: number): void };
}

// A stand-in <audio>: events by name, play() that can be refused, seeks that report back
function fakeElement() {
  const listeners: Record<string, { fn: () => void; once: boolean }[]> = {};
  const el: FakeAudio = {
    crossOrigin: null, preload: '', paused: true, currentTime: 0, duration: NaN, error: null, seeking: false, readyState: 4, src: '',
    addEventListener(type, fn, options) { (listeners[type] ??= []).push({ fn, once: !!options?.once }); },
    emit(type) { const all = listeners[type] ?? []; listeners[type] = all.filter((l) => !l.once); all.forEach((l) => l.fn()); },
    play: vi.fn(() => { el.paused = false; return el.refuse ? (el.paused = true, Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }))) : Promise.resolve(); }),
    pause: vi.fn(() => { el.paused = true; }),
    removeAttribute(name) { if (name === 'src') el.src = ''; },
    load() {},
  };
  return el;
}
// (stands in for the page's AudioContext)
function fakeContext() {
  return {
    currentTime: 0,
    createGain() {
      const g: FakeGain = {
        connect() {}, disconnect() {},
        gain: { value: 1, cancelScheduledValues() {}, setValueAtTime(v) { g.gain.value = v; }, linearRampToValueAtTime(v) { g.gain.value = v; } },
      };
      return g;
    },
    createMediaElementSource(el: unknown) { return { el, connect() {}, disconnect() {} }; },
  };
}
const gains: StemGains = { karaoke: { connect() {} }, vocals: { connect() {} } };

async function loaded(clockValue: { t: number | null } = { t: null }) {
  const els: FakeAudio[] = [];
  const player = new StreamingStemPlayer(fakeContext(), gains, {
    createElement: () => { const e = fakeElement(); els.push(e); return e; },
    clock: () => clockValue.t,
  });
  Object.assign(player.leads, { start: 0, seek: 0 }); // shared by every player: a known starting point
  const onLost = vi.fn<(why: string) => void>();
  const p = player.load({ karaoke: '/k', vocals: '/v' }, { onLost });
  els.forEach((e) => { e.duration = 165; e.emit('canplay'); });
  await p;
  return { player, k: els[0], v: els[1], clock: clockValue, onLost };
}
/** A player loading, on a page shown or not, and what its load came to so far */
function loading(page = { shown: true }) {
  const els: FakeAudio[] = [];
  const player = new StreamingStemPlayer(fakeContext(), gains, {
    createElement: () => { const e = fakeElement(); els.push(e); return e; },
    visible: () => page.shown,
  });
  const outcome: { error?: Error; done?: boolean } = {};
  player.load({ karaoke: '/k', vocals: '/v' }).then(() => { outcome.done = true; }, (e: Error) => { outcome.error = e; });
  return { player, k: els[0], v: els[1], page, outcome };
}
/** Lets the load's promise settle after a timer moved it */
const settled = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
const audible = (player: StreamingStemPlayer) => {
  const { fades } = player;
  assert(fades, 'not loaded');
  return fades.karaoke.gain.value === 1 && fades.vocals.gain.value === 1;
};

describe('StreamingStemPlayer', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] }); });
  afterEach(() => { vi.useRealTimers(); });

  it('is loaded once both elements can play, and decodes nothing ahead', async () => {
    const els: FakeAudio[] = [];
    const player = new StreamingStemPlayer(fakeContext(), gains, { createElement: () => { const e = fakeElement(); els.push(e); return e; } });
    const p = player.load({ karaoke: '/k', vocals: '/v' });
    expect(els.map((e) => e.src)).toEqual(['/k', '/v']);
    els[0].emit('canplay');
    expect(player.loaded).toBe(false);
    els[1].emit('canplay');
    await p;
    expect(player.loaded).toBe(true);
    expect(player.decodedBytes).toBe(0);
  });

  it('fails when an element cannot play its file, naming the stem', async () => {
    const els: FakeAudio[] = [];
    const player = new StreamingStemPlayer(fakeContext(), gains, { createElement: () => { const e = fakeElement(); els.push(e); return e; } });
    const p = player.load({ karaoke: '/k', vocals: '/v' });
    els[1].error = { code: 4 };
    els[1].emit('error');
    await expect(p).rejects.toThrow('vocals: cannot play (media error 4)');
  });

  it('starts faded out and fades in once heard on the clock', async () => {
    const { player, k, v, clock } = await loaded();
    clock.t = 42;
    player.play(42);
    expect(k.currentTime).toBe(42);
    expect(v.currentTime).toBe(42);
    expect(player.playing).toBe(true);
    expect(player.waiting).toBe(true); // nothing for the page's sync to chase
    expect(audible(player)).toBe(false);
    vi.advanceTimersByTime(300);
    expect(audible(player)).toBe(false); // not heard yet
    k.emit('playing');
    k.currentTime = 42.3; clock.t = 42.32; // heard, 20 ms off
    vi.advanceTimersByTime(100);
    expect(audible(player)).toBe(true);
    expect(player.waiting).toBe(false);
  });

  it('moves again quietly while it is off, and learns how far ahead to aim', async () => {
    const { player, k, clock } = await loaded();
    clock.t = 10;
    player.play(10);
    k.emit('playing');
    clock.t = 10.4; k.currentTime = 10.1; // came out 0.3 s behind
    vi.advanceTimersByTime(100);
    expect(audible(player)).toBe(false); // still hidden
    expect(player.leads.start).toBeCloseTo(0.21, 6); // 70 % of the 0.3 s
    expect(k.currentTime).toBeCloseTo(10.4, 6); // moved to the clock (+ the seek lead, 0 so far)
    k.emit('seeked');
    clock.t = 10.6; k.currentTime = 10.57;
    vi.advanceTimersByTime(100);
    expect(audible(player)).toBe(true);
    // the next start aims ahead by what it learned
    player.pause();
    clock.t = 20;
    player.play(20);
    expect(k.currentTime).toBeCloseTo(20.21, 6);
  });

  it('fades in after two seconds even if it never sits on the clock', async () => {
    const { player, k, clock } = await loaded();
    clock.t = 0;
    player.play(0);
    vi.advanceTimersByTime(2100);
    expect(audible(player)).toBe(true);
    expect(k.paused).toBe(false);
  });

  it('reads as paused when the browser refuses to play without a tap', async () => {
    const { player, k, v } = await loaded();
    k.refuse = v.refuse = true;
    player.play(0);
    await Promise.resolve();
    expect(player.playing).toBe(false); // the silence watchdog offers "tap for sound"
    k.refuse = v.refuse = false;
    player.play(0); // inside the tap
    expect(player.playing).toBe(true);
  });

  it('jumps both while playing, hidden until they are heard there', async () => {
    const { player, k, v, clock } = await loaded();
    clock.t = 10;
    player.play(10);
    k.emit('playing');
    vi.advanceTimersByTime(100);
    expect(audible(player)).toBe(true);
    player.seek(80);
    expect(k.currentTime).toBe(80);
    expect(v.currentTime).toBe(80);
    expect(audible(player)).toBe(false);
    k.emit('seeked');
    clock.t = 80.02; k.currentTime = 80.01;
    vi.advanceTimersByTime(100);
    expect(audible(player)).toBe(true);
  });

  it('puts the vocals back on the instrumental after a stall parted them', async () => {
    const { player, k, v, clock } = await loaded();
    clock.t = 0;
    player.play(0);
    k.emit('playing');
    vi.advanceTimersByTime(100); // heard: audible
    k.currentTime = 30; v.currentTime = 30.02;
    expect(player.realign()).toBe(false); // within tolerance
    v.currentTime = 29.5; // the vocals waited for data
    expect(player.realign()).toBe(true);
    expect(v.currentTime).toBeCloseTo(30 + player.leads.seek, 6);
    expect(k.currentTime).toBe(30); // the instrumental is not touched
    v.currentTime = 29.5;
    expect(player.realign()).toBe(false); // not again before that move is heard
  });

  it('gives up on a stem that gets no data for six seconds (its site does not answer)', async () => {
    const { k, outcome } = loading();
    vi.advanceTimersByTime(5500);
    await settled();
    expect(outcome).toEqual({}); // still waiting
    k.emit('canplay'); // the instrumental came; the vocals did not
    vi.advanceTimersByTime(600);
    await settled();
    expect(outcome.error?.message).toBe('vocals: no data for 6 s');
  });

  it('keeps waiting for a slow stem while its data comes in', async () => {
    const { k, v, outcome } = loading();
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(4000);
      k.emit('progress'); v.emit('progress');
    }
    await settled();
    expect(outcome).toEqual({}); // 16 s, never 6 s without data
    k.emit('canplay'); v.emit('canplay');
    await settled();
    expect(outcome.done).toBe(true);
  });

  it('does not count the time the page is hidden (its media may not load until shown)', async () => {
    const { page, outcome } = loading({ shown: false });
    vi.advanceTimersByTime(20000);
    await settled();
    expect(outcome).toEqual({});
    page.shown = true;
    vi.advanceTimersByTime(6000);
    await settled();
    expect(outcome.error?.message).toBe('karaoke: no data for 6 s');
  });

  it('still gives up at 30 s on a stem that gets data but never becomes ready', async () => {
    const { k, v, outcome } = loading();
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(5000);
      k.emit('progress'); v.emit('progress');
    }
    await settled();
    expect(outcome.error?.message).toBe('karaoke: not ready after 30 s');
  });

  it('is lost when the playing stems run out of data for six seconds', async () => {
    const { player, k, v, clock, onLost } = await loaded();
    clock.t = 0;
    player.play(0);
    k.emit('playing');
    vi.advanceTimersByTime(100);
    v.readyState = 2; // a stall that passes
    vi.advanceTimersByTime(4000);
    v.readyState = 4;
    vi.advanceTimersByTime(1000);
    expect(onLost).not.toHaveBeenCalled();
    k.readyState = 2; // its site went away
    vi.advanceTimersByTime(5500);
    expect(onLost).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(onLost).toHaveBeenCalledWith('out of data for 6 s');
    vi.advanceTimersByTime(10000);
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('is not lost for data a paused stem lacks, nor for one late look of a hidden page', async () => {
    const { player, k, v, clock, onLost } = await loaded();
    clock.t = 0;
    player.play(0);
    player.pause(); // the video stalled, or the host paused
    k.readyState = v.readyState = 1;
    vi.advanceTimersByTime(20000);
    expect(onLost).not.toHaveBeenCalled();
    // playing again, and the page's timers run late: a look 30 s after the last counts for one second
    k.readyState = v.readyState = 4;
    player.play(0);
    vi.advanceTimersByTime(500);
    k.readyState = 2;
    const now = performance.now.bind(performance);
    const late = vi.spyOn(performance, 'now').mockImplementation(() => now() + 30000);
    vi.advanceTimersByTime(500);
    late.mockRestore();
    expect(onLost).not.toHaveBeenCalled();
  });

  it('is lost on a media error after load, once', async () => {
    const { player, v, onLost } = await loaded();
    player.play(0);
    v.error = { code: 2 }; // the network failed mid-file
    v.emit('error');
    v.emit('error');
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(onLost).toHaveBeenCalledWith('vocals: media error 2');
  });

  it('loses nothing once disposed', async () => {
    const { player, k, onLost } = await loaded();
    player.play(0);
    player.dispose();
    k.paused = false; k.readyState = 1;
    k.error = { code: 4 };
    k.emit('error');
    vi.advanceTimersByTime(10000);
    expect(onLost).not.toHaveBeenCalled();
  });

  it('lets go of both files when disposed', async () => {
    const { player, k, v } = await loaded();
    player.play(0);
    player.dispose();
    expect(k.src).toBe('');
    expect(v.src).toBe('');
    expect(player.loaded).toBe(false);
  });
});
