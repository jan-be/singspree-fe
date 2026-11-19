/**
 * Playlists: named lists of songs a host keeps for the parties to come (one
 * night for low voices, one for high ones), for the power users: the home
 * page's Playlists button shows them on a desktop only (PlaylistsButton).
 * A party's queue becomes one from the queue's header (SavePlaylistButton);
 * a list starts a party the way Start again does: its first song opens, the
 * rest wait for the party's queue (partyHistory.ts savePendingQueue).
 *
 * In localStorage, this browser only. A list travels as a link: the plan
 * link of partyPlan.ts with the list's name (?again=id.id…&list=Name), which
 * the home page offers to start or to keep (SingAgainCard).
 *
 * Every read and write is wrapped: without storage (private mode, blocked
 * site data) there are no playlists and saving one does nothing.
 */
import { useSyncExternalStore } from 'react';
import { songOf, type HistorySong, type HistorySongInput } from './partyHistory';
import { planUrl } from './partyPlan';

const KEY = 'singspree_playlists';
/** What the open views hear when a list changes in this window (another window's change comes as 'storage') */
const CHANGED = 'singspree-playlists';
export const MAX_PLAYLISTS = 50;
export const MAX_PLAYLIST_SONGS = 100;
export const MAX_NAME = 60;

export interface Playlist {
  id: string;
  name: string;
  songs: HistorySong[];
  createdAt: number;
  updatedAt: number;
}

const EMPTY: Playlist[] = [];
let cached: { raw: string | null; lists: Playlist[] } = { raw: null, lists: EMPTY };

function read(): Playlist[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { return EMPTY; }
  // the same text, the same array: what useSyncExternalStore needs to see nothing changed
  if (raw === cached.raw) return cached.lists;
  let lists: Playlist[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) as { lists?: Playlist[] } | null : null;
    lists = Array.isArray(parsed?.lists)
      ? parsed.lists.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.songs))
      : EMPTY;
  } catch { /* not ours any more: none */ }
  cached = { raw, lists };
  return lists;
}

function write(lists: Playlist[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, lists: lists.slice(0, MAX_PLAYLISTS) }));
  } catch { return; /* full or blocked: not kept */ }
  try { window.dispatchEvent(new Event(CHANGED)); } catch { /* no window (tests without one) */ }
}

/** A name as a list keeps it: one line, trimmed, not too long; `fallback` for an empty one */
export function cleanName(name: unknown, fallback = ''): string {
  const s = String(name ?? '').replace(/\s+/g, ' ').trim();
  return [...(s || fallback)].slice(0, MAX_NAME).join('');
}

/** Songs as a list keeps them: each once, in order, as many as fit */
function cleanSongs(songs: readonly HistorySongInput[]): HistorySong[] {
  const seen = new Set<string>();
  const out: HistorySong[] = [];
  for (const input of songs) {
    const s = songOf(input);
    if (!s || seen.has(s.songId)) continue;
    seen.add(s.songId);
    out.push(s);
    if (out.length >= MAX_PLAYLIST_SONGS) break;
  }
  return out;
}

const newId = () => {
  try { return crypto.randomUUID().slice(0, 8); } catch { return Math.random().toString(36).slice(2, 10); }
};

/** The lists, the one changed last first */
export const loadPlaylists = (): Playlist[] => read();

/** The lists, kept current while they change (here or in another window) */
export function usePlaylists(): Playlist[] {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CHANGED, onChange);
      window.addEventListener('storage', onChange);
      return () => { window.removeEventListener(CHANGED, onChange); window.removeEventListener('storage', onChange); };
    },
    read,
    () => EMPTY,
  );
}

/** A new list, first; null when there is no room for another (MAX_PLAYLISTS) or nothing could be kept */
export function createPlaylist(name: string, songs: readonly HistorySongInput[], now = Date.now()): Playlist | null {
  const lists = read();
  if (lists.length >= MAX_PLAYLISTS) return null;
  const list: Playlist = { id: newId(), name: cleanName(name, 'Playlist'), songs: cleanSongs(songs), createdAt: now, updatedAt: now };
  write([list, ...lists]);
  return read().some(p => p.id === list.id) ? list : null;
}

function change(id: string, fn: (p: Playlist) => Playlist, now: number) {
  const lists = read();
  const i = lists.findIndex(p => p.id === id);
  if (i < 0) return;
  const next = [...lists];
  const [changed] = next.splice(i, 1);
  write([{ ...fn(changed), updatedAt: now }, ...next]);
}

export function renamePlaylist(id: string, name: string, now = Date.now()) {
  const clean = cleanName(name);
  if (clean) change(id, p => ({ ...p, name: clean }), now);
}

/** Its songs, as they are now (reordered, some gone, some added) */
export function setPlaylistSongs(id: string, songs: readonly HistorySongInput[], now = Date.now()) {
  change(id, p => ({ ...p, songs: cleanSongs(songs) }), now);
}

/** A copy named `name`, first; null when there is no room */
export function duplicatePlaylist(id: string, name: string, now = Date.now()): Playlist | null {
  const original = read().find(p => p.id === id);
  return original ? createPlaylist(name, original.songs, now) : null;
}

/** Gone; returns it with where it was, so an undo can put it back (restorePlaylist) */
export function deletePlaylist(id: string): { playlist: Playlist; index: number } | null {
  const lists = read();
  const index = lists.findIndex(p => p.id === id);
  if (index < 0) return null;
  write(lists.filter(p => p.id !== id));
  return { playlist: lists[index], index };
}

export function restorePlaylist({ playlist, index }: { playlist: Playlist; index: number }) {
  const lists = read().filter(p => p.id !== playlist.id);
  write([...lists.slice(0, index), playlist, ...lists.slice(index)]);
}

/** A list with its songs in a new order: the songs in random order (`random` for tests) */
export function shuffled<T>(songs: readonly T[], random = Math.random): T[] {
  const out = [...songs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The link that hands a list to someone: its songs and its name (SingAgainCard reads it) */
export function playlistUrl(origin: string, list: Pick<Playlist, 'name' | 'songs'>): string {
  const name = cleanName(list.name);
  return `${planUrl(origin, list.songs)}${name ? `&list=${encodeURIComponent(name)}` : ''}`;
}
