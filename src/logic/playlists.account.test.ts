import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createPlaylist, loadPlaylists, renamePlaylist, setPlaylistSongs, deletePlaylist, restorePlaylist,
  setPlaylistsAccount, flushPlaylists, holdGuestPlaylists, type Playlist,
} from './playlists';

// vitest runs in node: a storage stand-in, and a window that hears the changes
const items = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => items.get(k) ?? null,
  setItem: (k: string, v: unknown) => { items.set(k, String(v)); },
  removeItem: (k: string) => { items.delete(k); },
});
vi.stubGlobal('window', { dispatchEvent: () => true });

const song = (id: string) => ({ songId: id, artist: `Artist ${id}`, title: `Title ${id}`, videoId: `v${id}` });
const T = Date.parse('2026-11-20T19:00:00Z');
const local = () => (JSON.parse(items.get('singspree_playlists') ?? '{"lists":[]}') as { lists: Playlist[] }).lists;

/** The backend's routes over a list in memory, as routes/playlists.ts answers; `down` makes every request fail */
function fakeServer(start: Playlist[] = []) {
  const lists = new Map(start.map(p => [p.id, p]));
  const sent: string[] = [];
  const state = { down: false, full: false };
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (state.down) throw new TypeError('Failed to fetch');
    const id = decodeURIComponent(url.split('/me/playlists')[1]?.slice(1) ?? '');
    sent.push(`${method} ${id}`.trim());
    if (method === 'GET') {
      const all = [...lists.values()].sort((a, b) => b.updatedAt - a.updatedAt);
      return new Response(JSON.stringify({ success: true, data: { playlists: all } }), { status: 200 });
    }
    if (method === 'DELETE') { lists.delete(id); return new Response(null, { status: 204 }); }
    if (state.full && !lists.has(id)) return new Response(JSON.stringify({ success: false, code: 'too_many' }), { status: 409 });
    const body = JSON.parse(String(init?.body)) as Omit<Playlist, 'id'>;
    const playlist = { id, name: body.name, songs: body.songs, createdAt: lists.get(id)?.createdAt ?? body.createdAt, updatedAt: body.updatedAt };
    lists.set(id, playlist);
    return new Response(JSON.stringify({ success: true, data: { playlist } }), { status: 200 });
  });
  return { lists, sent, state, fetch };
}

/** Lets the server's answers (promises) and the timers that follow them run */
async function settle(ms = 1000) {
  for (let i = 0; i < 5; i++) { await vi.advanceTimersByTimeAsync(ms); }
}

beforeEach(() => { items.clear(); vi.useFakeTimers(); setPlaylistsAccount(null); });
afterEach(() => { setPlaylistsAccount(null); vi.useRealTimers(); });

describe('playlists of a signed-in account', () => {
  test("signed in, the views show the account's lists; signed out, this browser's again", async () => {
    const server = fakeServer([{ id: 'acc-1', name: 'From the account', songs: [song('a')], createdAt: T, updatedAt: T }]);
    createPlaylist('A guest list', [song('g')], T - 1000);
    setPlaylistsAccount(7, server.fetch);
    expect(loadPlaylists().map(p => p.name)).toEqual(['A guest list']); // until the server answered
    await settle();
    expect(loadPlaylists().map(p => p.name).sort()).toEqual(['A guest list', 'From the account']);
    setPlaylistsAccount(null);
    expect(loadPlaylists()).toEqual([]); // the guest list moved into the account
  });

  test("a guest's lists move in with their id and times, and leave this browser once the account has them", async () => {
    const server = fakeServer();
    const mine = createPlaylist('Low voices', [song('a'), song('b')], T)!;
    setPlaylistsAccount(7, server.fetch);
    await settle();
    expect(server.sent).toEqual(['GET', `PUT ${mine.id}`]);
    expect(server.lists.get(mine.id)).toEqual(mine);
    expect(local()).toEqual([]);
  });

  test('a guest list the account already has (it moved in before) is not sent again, unless this copy is newer', async () => {
    const old = createPlaylist('Moved before', [song('a')], T)!;
    const newer = createPlaylist('Changed here since', [song('b')], T + 5000)!;
    const server = fakeServer([
      { ...old, name: 'Changed on the phone', updatedAt: T + 1000 },
      { ...newer, name: 'Older there', updatedAt: T + 1000 },
    ]);
    setPlaylistsAccount(7, server.fetch);
    await settle();
    expect(server.sent).toEqual(['GET', `PUT ${newer.id}`]);
    expect([...server.lists.values()].map(p => p.name).sort()).toEqual(['Changed here since', 'Changed on the phone']);
    expect(local()).toEqual([]);
  });

  test("signed in by someone else's code link, this browser's lists stay here and out of that account", async () => {
    const server = fakeServer();
    const mine = createPlaylist('Mine', [song('a')], T)!;
    holdGuestPlaylists(7);
    setPlaylistsAccount(7, server.fetch);
    await settle();
    expect(server.sent).toEqual(['GET']);
    expect(loadPlaylists()).toEqual([]);
    setPlaylistsAccount(null);
    expect(loadPlaylists().map(p => p.id)).toEqual([mine.id]);
    setPlaylistsAccount(8, server.fetch); // signed in again (the hold went with the sign-out): now they move
    await settle();
    expect(server.lists.has(mine.id)).toBe(true);
  });

  test('changes go one at a time (the account counts its lists per request)', async () => {
    const server = fakeServer();
    let open = 0, most = 0;
    const slow = vi.fn(async (url: string, init?: RequestInit) => {
      open++; most = Math.max(most, open);
      await new Promise(r => setTimeout(r, 50));
      try { return await server.fetch(url, init); } finally { open--; }
    });
    for (let i = 0; i < 5; i++) createPlaylist(`Guest ${i}`, [], T + i);
    setPlaylistsAccount(7, slow);
    await settle();
    expect(server.lists.size).toBe(5);
    expect(most).toBe(1);
  });

  test('signing out waits for a change that is under way, and what came meanwhile', async () => {
    const server = fakeServer();
    const slow = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') await new Promise(r => setTimeout(r, 500));
      return server.fetch(url, init);
    });
    setPlaylistsAccount(7, slow);
    await settle();
    const a = createPlaylist('A', [], T)!;
    await vi.advanceTimersByTimeAsync(900); // A is on its way
    const b = createPlaylist('B', [], T + 1)!; // B waits for its moment
    const flushed = flushPlaylists();
    await vi.advanceTimersByTimeAsync(2000);
    await flushed;
    expect(server.lists.has(a.id) && server.lists.has(b.id)).toBe(true);
  });

  test('a change is sent a moment later, once per list however often it changed', async () => {
    const server = fakeServer();
    setPlaylistsAccount(7, server.fetch);
    await settle();
    const list = createPlaylist('Night', [], T)!;
    for (const name of ['N', 'Ni', 'Nig', 'Nigh', 'Night two']) renamePlaylist(list.id, name, T + 1);
    setPlaylistSongs(list.id, [song('a'), song('b')], T + 2);
    expect(server.sent).toEqual(['GET']);
    await settle();
    expect(server.sent).toEqual(['GET', `PUT ${list.id}`]);
    expect(server.lists.get(list.id)).toMatchObject({ name: 'Night two', songs: [song('a'), song('b')], updatedAt: T + 2 });
    expect(local()).toEqual([]); // nothing in this browser
  });

  test('a delete goes to the account, and its undo puts it back', async () => {
    const server = fakeServer([{ id: 'acc-1', name: 'Keep me', songs: [song('a')], createdAt: T, updatedAt: T }]);
    setPlaylistsAccount(7, server.fetch);
    await settle();
    const gone = deletePlaylist('acc-1')!;
    await settle();
    expect(server.lists.has('acc-1')).toBe(false);
    restorePlaylist(gone);
    await settle();
    expect(server.lists.get('acc-1')?.name).toBe('Keep me');
    expect(server.sent).toEqual(['GET', 'DELETE acc-1', 'PUT acc-1']);
  });

  test('offline, a change waits and goes when the server answers again', async () => {
    const server = fakeServer();
    setPlaylistsAccount(7, server.fetch);
    await settle();
    server.state.down = true;
    const list = createPlaylist('Offline', [song('a')], T)!;
    await settle();
    expect(server.lists.size).toBe(0);
    server.state.down = false;
    await settle(10_000);
    expect(server.lists.get(list.id)?.name).toBe('Offline');
  });

  test('a new list the account has no room for is taken off again', async () => {
    const server = fakeServer();
    setPlaylistsAccount(7, server.fetch);
    await settle();
    server.state.full = true;
    createPlaylist('One too many', [], T);
    expect(loadPlaylists()).toHaveLength(1);
    await settle();
    expect(loadPlaylists()).toEqual([]);
  });

  test("offline at sign-in, the account's lists are read again a while later, and the guest's move in then", async () => {
    const server = fakeServer([{ id: 'acc-1', name: 'From the account', songs: [], createdAt: T, updatedAt: T }]);
    const mine = createPlaylist('Guest', [], T - 1)!;
    server.state.down = true;
    setPlaylistsAccount(7, server.fetch);
    await settle();
    expect(loadPlaylists().map(p => p.name)).toEqual(['Guest']); // this browser's, meanwhile
    server.state.down = false;
    await settle(10_000);
    expect(loadPlaylists().map(p => p.name).sort()).toEqual(['From the account', 'Guest']);
    expect(server.lists.has(mine.id)).toBe(true);
    expect(local()).toEqual([]);
  });

  test('signing out sends what is left first', async () => {
    const server = fakeServer();
    setPlaylistsAccount(7, server.fetch);
    await settle();
    const list = createPlaylist('Last minute', [], T)!;
    await flushPlaylists();
    expect(server.lists.has(list.id)).toBe(true);
  });
});
