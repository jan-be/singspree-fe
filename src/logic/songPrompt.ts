import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';

/**
 * When a small card may put a question to someone. The feedback question
 * (feedbackPrompt.ts) and the Android test's suggestion (appTestPrompt.ts)
 * are two of these, each with a record of its own.
 *
 * Not before this browser has been through SONGS_BEFORE_ASKING songs to the
 * end, as the party's host or singing in it (party:song_ended with its name
 * on the board; a skipped song has no end), so whoever is asked knows the app
 * by then. And only where the card is in nobody's way: on the party page
 * between songs (the score screen), and on the home page. A card nobody is
 * writing on goes away as the next song starts and may come back
 * SONGS_BETWEEN_ASKS songs later (on the home page: on a visit hours later),
 * MAX_SHOWN times in all; its ✕ or an answer ends it for good.
 *
 * Counted in localStorage: without storage nothing is counted and nobody is
 * asked.
 */

export const SONGS_BEFORE_ASKING = 3;
export const SONGS_BETWEEN_ASKS = 3;
export const MAX_SHOWN = 3;
/** The home page asks again only this long after the card was last shown */
const HOME_GAP_MS = 6 * 3600 * 1000;

/** What this browser keeps */
export interface SongPromptRecord {
  /** songs it was through to the end, as host or singer */
  songs: number;
  /** parties those were in, and the last one's code */
  parties: number;
  lastParty: string | null;
  /** how often the card was shown, when last and after how many songs */
  shown: number;
  shownAt: number | null;
  shownAtSongs: number | null;
  /** answered, or dismissed (its ✕ before that): never again */
  done: 'answered' | 'dismissed' | null;
}

/** Where the card is asked from */
export type PromptPlace = 'party' | 'home';

/** What the card shows: open or not, and where it was opened */
export interface SongPromptState { open: boolean; where: PromptPlace | null }

const EMPTY: SongPromptRecord = { songs: 0, parties: 0, lastParty: null, shown: 0, shownAt: null, shownAtSongs: null, done: null };

/** Between a card at the bottom of a phone's screen and what the score screen shows above it, and under the card */
const CARD_MARGIN_PX = 16;

/**
 * The room a card at the bottom needs, for the score screen on phones to
 * leave free (--song-card-room, PartyPage), as the card grows from a line to
 * a form: so it covers no button in any state. Goes on the card's element.
 */
export function useCardRoom(open: boolean) {
  const card = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = card.current;
    if (!element) return undefined;
    const root = document.documentElement;
    const measure = () => root.style.setProperty('--song-card-room', `${element.offsetHeight + CARD_MARGIN_PX}px`);
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => { observer?.disconnect(); root.style.removeProperty('--song-card-room'); };
  }, [open]);
  return card;
}

/**
 * One question's card: its record under `key` in localStorage. `songsFrom`:
 * it goes by a song count another question's card keeps, instead of its own.
 */
export function songPrompt(key: string, songsFrom?: () => number) {
  function read(): SongPromptRecord | null {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) as Partial<SongPromptRecord> | null : null;
      const record = { ...EMPTY, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
      return songsFrom ? { ...record, songs: songsFrom() } : record;
    } catch { return null; } // no storage: nothing is counted
  }

  function write(record: SongPromptRecord) {
    try { localStorage.setItem(key, JSON.stringify(record)); } catch { /* full or blocked: not kept */ }
  }

  let state: SongPromptState = { open: false, where: null };
  /** someone is writing on the card: it stays when the next song starts, otherwise it would cover the lyrics on a phone */
  let engaged = false;
  const listeners = new Set<() => void>();

  function set(next: SongPromptState) {
    state = next;
    for (const l of listeners) l();
  }

  /** A song ran to its end with this browser in it as host or singer (the party page, at party:song_ended). */
  function noteSongFinished(partyId: string | null) {
    const r = read();
    if (!r) return; // an answered card goes on counting: others may go by the count
    r.songs++;
    if (partyId && partyId !== r.lastParty) { r.parties++; r.lastParty = partyId; }
    write(r);
  }

  /** Whether the card may open at `where` now */
  function mayAsk(where: PromptPlace, r: SongPromptRecord | null = read(), now = Date.now()): boolean {
    if (!r || r.done || r.songs < SONGS_BEFORE_ASKING || r.shown >= MAX_SHOWN) return false;
    if (!r.shown) return true;
    return where === 'party'
      ? r.songs - (r.shownAtSongs ?? 0) >= SONGS_BETWEEN_ASKS
      : now - (r.shownAt ?? 0) >= HOME_GAP_MS;
  }

  /** Open the card at `where` if it may open now; true when it did. */
  function ask(where: PromptPlace, now = Date.now()): boolean {
    if (state.open) return true;
    const r = read();
    if (!r || !mayAsk(where, r, now)) return false;
    write({ ...r, shown: r.shown + 1, shownAt: now, shownAtSongs: r.songs });
    engaged = false;
    set({ open: true, where });
    return true;
  }

  /**
   * The moment has passed (the next song starts): a card nobody touched goes.
   * `force`: the page is left, the card goes along even when touched.
   */
  function moveOn(force = false) {
    if (state.open && (force || !engaged)) set({ open: false, where: null });
  }

  /** Someone is writing on the card: it stays until answered or closed. */
  function engage() { engaged = true; }

  /** Answered: never asked again (an open card stays until it is closed). */
  function markAnswered() {
    const r = read();
    if (r && r.done !== 'answered') write({ ...r, done: 'answered' });
  }

  /** Its ✕ (or the thanks fading out): closed, and unless answered, dismissed for good. */
  function closePrompt() {
    const r = read();
    if (r && !r.done) write({ ...r, done: 'dismissed' });
    engaged = false;
    set({ open: false, where: null });
  }

  /** What goes along with an answer: how far this browser had come, and how often it had been asked */
  function counts() {
    const r = read() ?? EMPTY;
    return { songs: r.songs, parties: r.parties, shown: r.shown };
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  const getSnapshot = () => state;

  /** { open, where }, re-rendering the caller on every change */
  function usePrompt(): SongPromptState {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  /** For tests: start over */
  function reset() {
    state = { open: false, where: null };
    engaged = false;
    try { localStorage.removeItem(key); } catch { /* none */ }
  }

  return { noteSongFinished, mayAsk, ask, moveOn, engage, markAnswered, closePrompt, counts, usePrompt, reset };
}
