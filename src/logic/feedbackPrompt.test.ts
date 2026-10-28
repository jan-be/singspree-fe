import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  noteSongFinished, mayAsk, ask, moveOn, engage, markAnswered, closePrompt, feedbackCounts, _resetFeedbackPrompt,
  SONGS_BEFORE_ASKING, SONGS_BETWEEN_ASKS, MAX_SHOWN,
} from './feedbackPrompt';

// vitest runs in node: a minimal storage stand-in
const items = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => items.get(k) ?? null,
  setItem: (k: string, v: unknown) => { items.set(k, String(v)); },
  removeItem: (k: string) => { items.delete(k); },
});

/** `n` songs through to the end in party P1 */
const sing = (n: number, partyId = 'P1') => { for (let i = 0; i < n; i++) noteSongFinished(partyId); };
/** Whether the card is open (ask answers true while it is) */
const isOpen = () => ask('party', Date.now()) && (moveOn(), true);

describe('feedbackPrompt', () => {
  beforeEach(() => { _resetFeedbackPrompt(); items.clear(); });

  test('asks only after a few songs, on the party page and the home page', () => {
    sing(SONGS_BEFORE_ASKING - 1);
    expect(mayAsk('party')).toBe(false);
    expect(mayAsk('home')).toBe(false);
    expect(ask('party')).toBe(false);
    sing(1);
    expect(mayAsk('party')).toBe(true);
    expect(mayAsk('home')).toBe(true);
    expect(ask('party')).toBe(true);
    expect(feedbackCounts()).toEqual({ songs: SONGS_BEFORE_ASKING, parties: 1, shown: 1 });
  });

  test('an untouched card goes as the next song starts and comes back a few songs later', () => {
    sing(SONGS_BEFORE_ASKING);
    expect(ask('party')).toBe(true);
    moveOn();
    sing(SONGS_BETWEEN_ASKS - 1);
    expect(ask('party')).toBe(false);
    sing(1);
    expect(ask('party')).toBe(true);
    expect(feedbackCounts().shown).toBe(2);
  });

  test('a touched card stays when the next song starts, not when the page is left', () => {
    sing(SONGS_BEFORE_ASKING);
    ask('party');
    engage();
    moveOn();
    expect(isOpen()).toBe(true);
    expect(feedbackCounts().shown).toBe(1); // still the same card, not asked again
    engage();
    moveOn(true);
    expect(ask('party')).toBe(false); // gone; the next chance is a few songs later
  });

  test(`gives up after ${MAX_SHOWN} times`, () => {
    sing(SONGS_BEFORE_ASKING);
    for (let i = 0; i < MAX_SHOWN; i++) {
      expect(ask('party')).toBe(true);
      moveOn();
      sing(SONGS_BETWEEN_ASKS);
    }
    expect(ask('party')).toBe(false);
    expect(mayAsk('home', undefined, Date.now() + 7 * 24 * 3600 * 1000)).toBe(false);
  });

  test('the home page asks again only hours after the last time', () => {
    sing(SONGS_BEFORE_ASKING);
    const t0 = Date.parse('2026-10-28T20:00:00Z');
    expect(ask('home', t0)).toBe(true);
    moveOn();
    expect(ask('home', t0 + 3600_000)).toBe(false);
    expect(ask('home', t0 + 7 * 3600_000)).toBe(true);
  });

  test('its ✕ or an answer ends it for good', () => {
    sing(SONGS_BEFORE_ASKING);
    ask('party');
    closePrompt();
    sing(10);
    expect(mayAsk('party')).toBe(false);

    _resetFeedbackPrompt(); items.clear();
    sing(SONGS_BEFORE_ASKING);
    ask('party');
    markAnswered();
    closePrompt();
    sing(10);
    expect(mayAsk('party')).toBe(false);
    expect(JSON.parse(items.get('singspree_feedback') ?? '{}').done).toBe('answered');
  });

  test('counts the parties the songs were in', () => {
    sing(2, 'P1');
    sing(1, 'P2');
    sing(1, 'P2');
    expect(feedbackCounts()).toMatchObject({ songs: 4, parties: 2 });
  });

  test('without storage nobody is asked', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} });
    try {
      sing(10);
      expect(ask('party')).toBe(false);
    } finally {
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => items.get(k) ?? null,
        setItem: (k: string, v: unknown) => { items.set(k, String(v)); },
        removeItem: (k: string) => { items.delete(k); },
      });
    }
  });
});
