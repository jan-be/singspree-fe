import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AWAKE_GRACE_MS, keepScreenAwake, wantAwake } from './screenAwake';

describe('wantAwake', () => {
  it('while a song plays, and for the grace after it stops', () => {
    expect(wantAwake({ playing: true, idleMs: 0 })).toBe(true);
    expect(wantAwake({ playing: false, idleMs: AWAKE_GRACE_MS - 1 })).toBe(true);
    expect(wantAwake({ playing: false, idleMs: AWAKE_GRACE_MS })).toBe(false);
    expect(wantAwake({ playing: false, idleMs: Infinity })).toBe(false); // nothing played yet
  });
});

describe('keepScreenAwake', () => {
  let visibility: DocumentVisibilityState;
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = 'visible';
    vi.stubGlobal('document', { get visibilityState() { return visibility; }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const fakeLock = () => {
    const released: number[] = [];
    let n = 0;
    const lock = {
      request: vi.fn(async () => {
        const id = ++n;
        return { release: async () => { released.push(id); }, addEventListener: () => {} };
      }),
    };
    return { lock, released };
  };

  it('asks for the lock once a song plays and lets go after the grace', async () => {
    const { lock, released } = fakeLock();
    let playing = false;
    const stop = keepScreenAwake(() => playing, { wakeLock: lock });
    expect(lock.request).not.toHaveBeenCalled(); // nothing played yet
    playing = true;
    await vi.advanceTimersByTimeAsync(2000);
    expect(lock.request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(lock.request).toHaveBeenCalledTimes(1); // held, not asked again
    playing = false;
    await vi.advanceTimersByTimeAsync(AWAKE_GRACE_MS - 4000);
    expect(released).toEqual([]);
    await vi.advanceTimersByTimeAsync(6000);
    expect(released).toEqual([1]);
    stop();
  });

  it('never asks in a hidden tab, and gives up the lock when stopped', async () => {
    const { lock, released } = fakeLock();
    visibility = 'hidden';
    const stop = keepScreenAwake(() => true, { wakeLock: lock });
    await vi.advanceTimersByTimeAsync(4000);
    expect(lock.request).not.toHaveBeenCalled();
    visibility = 'visible';
    await vi.advanceTimersByTimeAsync(2000);
    expect(lock.request).toHaveBeenCalledTimes(1);
    stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(released).toEqual([1]);
  });

  it('does nothing without the API', () => {
    expect(() => keepScreenAwake(() => true, {})()).not.toThrow();
  });
});
