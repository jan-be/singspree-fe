import { useSyncExternalStore } from 'react';

/**
 * When to ask "How do you like SingSpree?" (FeedbackPrompt.tsx).
 *
 * Not before this browser has been through SONGS_BEFORE_ASKING songs to the
 * end, as the party's host or singing in it (party:song_ended with its name
 * on the board; a skipped song has no end), so the answer comes from someone
 * who knows the app by then. And only where the card is in nobody's way: on
 * the party page between songs (the score screen), and on the home page. A
 * card nobody touched goes away as the next song starts and may come back
 * SONGS_BETWEEN_ASKS songs later (on the home page: on a visit hours later),
 * MAX_SHOWN times in all; its ✕ or an answer ends it for good.
 *
 * Counted in localStorage: without storage nothing is counted and nobody is
 * asked.
 */

const KEY = 'singspree_feedback';
export const SONGS_BEFORE_ASKING = 3;
export const SONGS_BETWEEN_ASKS = 3;
export const MAX_SHOWN = 3;
/** The home page asks again only this long after the card was last shown */
const HOME_GAP_MS = 6 * 3600 * 1000;

/** What this browser keeps */
export interface FeedbackRecord {
  /** songs it was through to the end, as host or singer */
  songs: number;
  /** parties those were in, and the last one's code */
  parties: number;
  lastParty: string | null;
  /** how often the card was shown, when last and after how many songs */
  shown: number;
  shownAt: number | null;
  shownAtSongs: number | null;
  /** answered (stars sent) or dismissed (its ✕ before that): never again */
  done: 'answered' | 'dismissed' | null;
}

/** Where the card is asked from */
export type FeedbackPlace = 'party' | 'home';

/** What the card shows: open or not, and where it was opened */
export interface FeedbackPromptState { open: boolean; where: FeedbackPlace | null }

const EMPTY: FeedbackRecord = { songs: 0, parties: 0, lastParty: null, shown: 0, shownAt: null, shownAtSongs: null, done: null };

function read(): FeedbackRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<FeedbackRecord> | null : null;
    return { ...EMPTY, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch { return null; } // no storage: nothing is counted
}

function write(record: FeedbackRecord) {
  try { localStorage.setItem(KEY, JSON.stringify(record)); } catch { /* full or blocked: not kept */ }
}

let state: FeedbackPromptState = { open: false, where: null };
/** the card was touched (a star, a letter): it stays when the next song starts */
let engaged = false;
const listeners = new Set<() => void>();

function set(next: FeedbackPromptState) {
  state = next;
  for (const l of listeners) l();
}

/** A song ran to its end with this browser in it as host or singer (the party page, at party:song_ended). */
export function noteSongFinished(partyId: string | null) {
  const r = read();
  if (!r || r.done) return;
  r.songs++;
  if (partyId && partyId !== r.lastParty) { r.parties++; r.lastParty = partyId; }
  write(r);
}

/** Whether the card may open at `where` now */
export function mayAsk(where: FeedbackPlace, r: FeedbackRecord | null = read(), now = Date.now()): boolean {
  if (!r || r.done || r.songs < SONGS_BEFORE_ASKING || r.shown >= MAX_SHOWN) return false;
  if (!r.shown) return true;
  return where === 'party'
    ? r.songs - (r.shownAtSongs ?? 0) >= SONGS_BETWEEN_ASKS
    : now - (r.shownAt ?? 0) >= HOME_GAP_MS;
}

/** Open the card at `where` if it may open now; true when it did. */
export function ask(where: FeedbackPlace, now = Date.now()): boolean {
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
export function moveOn(force = false) {
  if (state.open && (force || !engaged)) set({ open: false, where: null });
}

/** The card was touched: it stays until answered or closed. */
export function engage() { engaged = true; }

/** Stars were sent: never asked again (the card stays open for a comment). */
export function markAnswered() {
  const r = read();
  if (r && r.done !== 'answered') write({ ...r, done: 'answered' });
}

/** Its ✕ (or the thanks fading out): closed, and unless answered, dismissed for good. */
export function closePrompt() {
  const r = read();
  if (r && !r.done) write({ ...r, done: 'dismissed' });
  engaged = false;
  set({ open: false, where: null });
}

/** What goes along with an answer: how far this browser had come, and how often it had been asked */
export function feedbackCounts() {
  const r = read() ?? EMPTY;
  return { songs: r.songs, parties: r.parties, shown: r.shown };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const getSnapshot = () => state;

/** { open, where }, re-rendering the caller on every change */
export function useFeedbackPrompt(): FeedbackPromptState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** For tests: start over */
export function _resetFeedbackPrompt() {
  state = { open: false, where: null };
  engaged = false;
  try { localStorage.removeItem(KEY); } catch { /* none */ }
}
