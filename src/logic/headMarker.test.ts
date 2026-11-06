import { describe, it, expect, beforeEach, vi } from 'vitest';
import { headMode, headStrength, TIP_FADE_SEC } from './headMarker';

describe('headStrength', () => {
  const sung = (t: number) => ({ videoTime: t, freq: 220 });
  const silent = (t: number) => ({ videoTime: t, freq: 0 });

  it('is full for a voice at its usual distance', () => {
    expect(headStrength([sung(10)], 10.2, 0.2)).toBe(1);
    expect(headStrength([sung(10)], 10.1, 0.2)).toBe(1);
  });

  it('is gone with no notes, and at once when silence comes in', () => {
    expect(headStrength([], 10, 0.2)).toBe(0);
    expect(headStrength([sung(9.9), silent(9.93), silent(9.96)], 10.1, 0.2)).toBe(0);
  });

  it('does not blink at one silent window', () => {
    expect(headStrength([sung(9.9), silent(9.93)], 10.12, 0.2)).toBe(1);
  });

  it('fades when the notes stop coming', () => {
    expect(headStrength([sung(10)], 10.2 + TIP_FADE_SEC / 2, 0.2)).toBeCloseTo(0.5);
    expect(headStrength([sung(10)], 11, 0.2)).toBe(0);
  });
});

describe('headMode', () => {
  const stored = new Map<string, string>();
  const at = (search: string) => {
    vi.stubGlobal('window', { location: { search } });
    return headMode();
  };

  beforeEach(() => {
    stored.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => stored.get(k) ?? null,
      setItem: (k: string, v: string) => { stored.set(k, v); },
      removeItem: (k: string) => { stored.delete(k); },
    });
  });

  it('is off unless told', () => {
    expect(at('')).toBe(0);
    expect(at('?x=1')).toBe(0);
  });

  it('remembers what the address said, as a join changes the address', () => {
    expect(at('?head=2')).toBe(2);
    expect(at('')).toBe(2);
    expect(at('?head=1')).toBe(1);
  });

  it('turns off with anything else', () => {
    at('?head=1');
    expect(at('?head=0')).toBe(0);
    expect(at('')).toBe(0);
  });
});
