/**
 * Playlists: named lists of songs a host keeps for the parties to come (one
 * night for low voices, one for high ones), for the power users: the home
 * page's Playlists button shows them on a desktop only (PlaylistsButton).
 * A party's queue becomes one from the queue's header (SavePlaylistButton);
 * a list starts a party the way Start again does: its first song opens, the
 * rest wait for the party's queue (partyHistory.ts savePendingQueue).
 *
 * Signed in, the lists are the account's (backend routes/playlists.ts): read
 * when the account signs in and when the tab comes back, every change sent a
 * moment after it is made (one request per list, its latest state, so a drag
 * or a name typed is one write). A guest's lists are in localStorage, this
 * browser only, and move into the account when they sign in (each leaves
 * localStorage once the account has it). The list's id is made here, so
 * moving in, saving again and an undo are the same write.
 *
 * A list travels as a link: the plan link of partyPlan.ts with the list's
 * name (?again=id.id…&list=Name), which the home page offers to start or to
 * keep (SingAgainCard).
 *
 * Every read and write is wrapped: without storage (private mode, blocked
 * site data) a guest has no playlists and saving one does nothing.
 */
import { useSyncExternalStore } from 'react';
import { apiUrl } from '../GlobalConsts';
import { songOf, type HistorySong, type HistorySongInput } from './partyHistory';
import { planUrl } from './partyPlan';

const KEY = 'singspree_playlists';
/** What the open views hear when a list changes in this window (another window's change comes as 'storage') */
const CHANGED = 'singspree-playlists';
export const MAX_PLAYLISTS = 50;
export const MAX_PLAYLIST_SONGS = 100;
export const MAX_NAME = 60;
/** How long a change waits for the next one before it is sent (a drag, a name being typed) */
const SEND_AFTER_MS = 800;
/** A change the server did not take (offline, busy) is sent again after this */
const RETRY_MS = 10_000;
/** The account's lists are read again when the tab comes back, at most this often */
const REREAD_MS = 30_000;

export interface Playlist {
  id: string;
  name: string;
  songs: HistorySong[];
  createdAt: number;
  updatedAt: number;
}

const EMPTY: Playlist[] = [];
let cached: { raw: string | null; lists: Playlist[] } = { raw: null, lists: EMPTY };

/** This browser's lists (a guest's, and those not moved into the account yet) */
function readLocal(): Playlist[] {
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

const notify = () => { try { window.dispatchEvent(new Event(CHANGED)); } catch { /* no window (tests without one) */ } };

function writeLocal(lists: Playlist[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, lists: lists.slice(0, MAX_PLAYLISTS) }));
  } catch { return; /* full or blocked: not kept */ }
  notify();
}

// ── The account's lists ────────────────────────────────────────────────────

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Set when this tab's change reached the account: the browser's other tabs read the lists again (a storage event) */
const SYNC_KEY = 'singspree_playlists_changed';
/** The account a code link this browser did not ask for signed in to (authApi.ts): this browser's lists stay here */
const HOLD_KEY = 'singspree_playlists_hold';
/** A change that keeps failing is tried less and less often, at least this often */
const RETRY_MAX_MS = 5 * 60_000;
/** A read that crossed a change of this tab's is made again this long after */
const REREAD_SOON_MS = 2000;

interface Account {
  userId: number;
  /** null until the server first answered: until then the views show this browser's lists */
  lists: Playlist[] | null;
  /** what is still to be sent, per list: its latest state, or null for a delete */
  pending: Map<string, Playlist | null>;
  /** what is being sent right now (a read meanwhile may not have it yet) */
  inFlight: Map<string, Playlist | null>;
  /** this browser's lists on their way into the account: each leaves localStorage once the server has it */
  moving: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
  readTimer: ReturnType<typeof setTimeout> | null;
  sending: Promise<void> | null;
  /** counts the batches sent and done: a read that saw it change may have missed one */
  writes: number;
  retryMs: number;
  readAt: number;
  fetch: Fetch;
}

let account: Account | null = null;
/** Takes the account's document and window listeners off again */
let detach: (() => void) | null = null;

/** The lists the views show: the account's once read, else this browser's */
function read(): Playlist[] {
  return account?.lists ?? readLocal();
}

/** The lists after a change: sent to the account (only the lists that changed) or kept in this browser */
function write(lists: Playlist[]) {
  const acc = account;
  if (!acc?.lists) return writeLocal(lists);
  const next = lists.slice(0, MAX_PLAYLISTS);
  const before = new Map(acc.lists.map(p => [p.id, p]));
  for (const p of next) if (before.get(p.id) !== p) acc.pending.set(p.id, p);
  const kept = new Set(next.map(p => p.id));
  for (const id of before.keys()) if (!kept.has(id)) acc.pending.set(id, null);
  acc.lists = next;
  sendSoon(acc, SEND_AFTER_MS);
  notify();
}

const byChange = (a: Playlist, b: Playlist) => b.updatedAt - a.updatedAt;

/** What the server has, with what is still on its way there on top (what waits over what is being sent) */
function withPending(server: Playlist[], acc: Account): Playlist[] {
  const ahead = new Map([...acc.inFlight, ...acc.pending]);
  const lists = server.filter(p => !ahead.has(p.id));
  for (const p of ahead.values()) if (p) lists.push(p);
  return lists.sort(byChange).slice(0, MAX_PLAYLISTS);
}

function sendSoon(acc: Account, ms: number) {
  if (acc.timer) clearTimeout(acc.timer);
  acc.timer = setTimeout(() => { acc.timer = null; void send(acc); }, ms);
}

function readSoon(acc: Account, ms: number) {
  if (acc.readTimer) clearTimeout(acc.readTimer);
  acc.readTimer = setTimeout(() => { acc.readTimer = null; if (account === acc) void readAccount(acc); }, ms);
}

/** A list that moved in is in the account now: it leaves this browser */
function moved(acc: Account, id: string) {
  if (acc.moving.delete(id)) writeLocal(readLocal().filter(p => p.id !== id));
}

/** One list's change to the server; false when it did not get through and is to be tried again */
async function sendOne(acc: Account, [id, list]: [string, Playlist | null], keepalive: boolean): Promise<boolean> {
  const done = () => { if (acc.inFlight.get(id) === list) acc.inFlight.delete(id); };
  if (account !== acc) { done(); return true; } // signed out (or in as someone else): not with that cookie
  const url = `${apiUrl}/me/playlists/${encodeURIComponent(id)}`;
  let status = 0;
  try {
    const r = list
      ? await acc.fetch(url, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, keepalive,
        body: JSON.stringify({ name: list.name, songs: list.songs, createdAt: list.createdAt, updatedAt: list.updatedAt }),
      })
      : await acc.fetch(url, { method: 'DELETE', keepalive });
    status = r.status;
  } catch { /* offline */ }
  done();
  if (account !== acc) return true;
  if (status >= 200 && status < 300) {
    moved(acc, id);
    try { localStorage.setItem(SYNC_KEY, String(Date.now())); } catch { /* the other tabs read again when shown */ }
    return true;
  }
  if (status === 409 && list && acc.lists) {
    // no room for another list in the account: it is not there (one moving in stays in this browser)
    acc.lists = acc.lists.filter(p => p.id !== id);
    acc.moving.delete(id);
    notify();
    return true;
  }
  if (status === 400 || status === 401 || status === 403 || status === 413) { acc.moving.delete(id); return true; } // will not get through
  if (!acc.pending.has(id)) acc.pending.set(id, list); // (a newer change of it goes instead)
  return false;
}

/**
 * Every change still to be sent, one request per list, one after the other (the account's limit is counted per
 * request: several at once could pass it); all at once when the page is going (only what is started gets out).
 * What did not get through is tried again, less often each time.
 */
function send(acc: Account, { keepalive = false } = {}): Promise<void> {
  if (acc.sending) return acc.sending.then(() => (account === acc && acc.pending.size ? send(acc, { keepalive }) : undefined));
  if (!acc.pending.size || account !== acc) return Promise.resolve();
  const batch = [...acc.pending];
  acc.pending.clear();
  for (const [id, list] of batch) acc.inFlight.set(id, list);
  acc.writes++;
  const run = async () => {
    let failed = false;
    if (keepalive) failed = (await Promise.all(batch.map(e => sendOne(acc, e, true)))).includes(false);
    else for (const e of batch) if (!(await sendOne(acc, e, false))) failed = true;
    if (account !== acc) return;
    if (failed) {
      sendSoon(acc, acc.retryMs);
      acc.retryMs = Math.min(acc.retryMs * 2, RETRY_MAX_MS);
    } else acc.retryMs = RETRY_MS;
  };
  acc.sending = run().finally(() => { acc.writes++; acc.sending = null; });
  return acc.sending;
}

/** Whether this browser's lists stay out of this account (signed in by a code link it did not ask for) */
function held(acc: Account): boolean {
  try { return localStorage.getItem(HOLD_KEY) === String(acc.userId); } catch { return false; }
}

/** The account's lists from the server; the first time, this browser's lists move in */
async function readAccount(acc: Account) {
  if (acc.readTimer) { clearTimeout(acc.readTimer); acc.readTimer = null; }
  acc.readAt = Date.now();
  const writes = acc.writes;
  let server: Playlist[] | null = null;
  let signedOut = false;
  try {
    const r = await acc.fetch(`${apiUrl}/me/playlists`);
    signedOut = r.status === 401;
    const body = r.ok ? await r.json() as { data?: { playlists?: Playlist[] } } | null : null;
    if (body) server = Array.isArray(body.data?.playlists) ? body.data.playlists : [];
  } catch { /* offline: the views keep what they show */ }
  if (account !== acc) return;
  if (!server) {
    // never read yet: try again in a while (the views show this browser's lists meanwhile)
    if (acc.lists === null && !signedOut) readSoon(acc, RETRY_MS);
    return;
  }
  // a change of this tab's went out while this was read: the answer may be from before it (and would bring an older
  // list back), so it is read again once the changes are through
  if (acc.lists !== null && (acc.writes !== writes || acc.sending)) { readSoon(acc, REREAD_SOON_MS); return; }
  if (acc.lists === null && !held(acc)) {
    const there = new Map(server.map(p => [p.id, p]));
    for (const local of readLocal()) {
      const theirs = there.get(local.id);
      // the same id: it moved in before (the page went before it was taken out here); this copy only if it is newer
      if (theirs && theirs.updatedAt >= local.updatedAt) { writeLocal(readLocal().filter(p => p.id !== local.id)); continue; }
      acc.pending.set(local.id, local);
      acc.moving.add(local.id);
    }
  }
  acc.lists = withPending(server, acc);
  notify();
  if (acc.pending.size) sendSoon(acc, 0);
}

/**
 * Signed in as `userId`, or out (null): AuthProvider tells whenever the account changes. Signed in, the lists are
 * the account's; signed out, this browser's.
 */
export function setPlaylistsAccount(userId: number | null, fetchImpl?: Fetch) {
  if ((account?.userId ?? null) === userId) return;
  const before = account;
  if (before?.timer) clearTimeout(before.timer);
  if (before?.readTimer) clearTimeout(before.readTimer);
  detach?.();
  detach = null;
  if (before && userId === null) { try { localStorage.removeItem(HOLD_KEY); } catch { /* nothing held */ } }
  account = userId === null ? null : {
    userId, lists: null, pending: new Map(), inFlight: new Map(), moving: new Set(), timer: null, readTimer: null,
    sending: null, writes: 0, retryMs: RETRY_MS, readAt: 0, fetch: fetchImpl ?? ((url, init) => fetch(url, init)),
  };
  notify();
  const acc = account;
  if (!acc) return;
  void readAccount(acc);
  if (typeof document === 'undefined') return;
  const onVisible = () => {
    if (document.visibilityState === 'hidden') { void send(acc, { keepalive: true }); return; } // leaving: what is left goes now
    if (Date.now() - acc.readAt >= REREAD_MS) void readAccount(acc); // back: another device may have changed them
  };
  // another tab of this browser changed them: read them now (an edit here would otherwise send an older list)
  const onStorage = (e: StorageEvent) => { if (e.key === SYNC_KEY && account === acc) void readAccount(acc); };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('storage', onStorage);
  detach = () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * A sign-in by a code link this browser did not ask for (authApi.ts verifyEmailCode, as with the guest's scores):
 * this browser's lists do not move into that account (someone else's link must not take them). Until signed out.
 */
export function holdGuestPlaylists(userId: number) {
  try { localStorage.setItem(HOLD_KEY, String(userId)); } catch { /* nothing to hold them with: they stay anyway */ }
}

/** Before signing out: what is still to be sent goes now, while the account's cookie is there */
export async function flushPlaylists(): Promise<void> {
  const acc = account;
  if (!acc) return;
  if (acc.timer) { clearTimeout(acc.timer); acc.timer = null; }
  // (what is under way, then what came meanwhile; a few rounds at most: offline it would never end)
  for (let round = 0; round < 3 && account === acc && (acc.sending || acc.pending.size); round++) await send(acc);
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
