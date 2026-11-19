import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  createPlaylist, loadPlaylists, renamePlaylist, setPlaylistSongs, duplicatePlaylist, deletePlaylist, restorePlaylist,
  shuffled, playlistUrl, cleanName, MAX_PLAYLISTS, MAX_PLAYLIST_SONGS, MAX_NAME,
} from './playlists';
import { parseAgain } from './partyPlan';

// vitest runs in node: a storage stand-in, and a window that hears the changes
const items = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => items.get(k) ?? null,
  setItem: (k: string, v: unknown) => { items.set(k, String(v)); },
  removeItem: (k: string) => { items.delete(k); },
});
const heard: string[] = [];
vi.stubGlobal('window', { dispatchEvent: (e: Event) => { heard.push(e.type); return true; } });

const song = (id: string) => ({ songId: id, artist: `Artist ${id}`, title: `Title ${id}`, videoId: `v${id}`, extra: 'dropped' });
const T = Date.parse('2026-11-18T19:00:00Z');

beforeEach(() => { items.clear(); heard.length = 0; });

describe('playlists', () => {
  test('a new list keeps its songs once each, in order, without what a list does not need, and is first', () => {
    const a = createPlaylist('  Low   voices ', [song('a'), song('b'), song('a'), { songId: null }], T);
    const b = createPlaylist('High voices', [song('c')], T + 1);
    expect(a?.name).toBe('Low voices');
    expect(a?.songs).toEqual([
      { songId: 'a', artist: 'Artist a', title: 'Title a', videoId: 'va' },
      { songId: 'b', artist: 'Artist b', title: 'Title b', videoId: 'vb' },
    ]);
    expect(loadPlaylists().map(p => p.id)).toEqual([b!.id, a!.id]);
    expect(heard).toEqual(['singspree-playlists', 'singspree-playlists']);
  });

  test('renamed, reordered, copied: the list changed last goes first', () => {
    const a = createPlaylist('A', [song('1'), song('2')], T)!;
    const b = createPlaylist('B', [], T + 1)!;
    renamePlaylist(a.id, 'Ladies night', T + 2);
    setPlaylistSongs(a.id, [song('2'), song('1'), song('3')], T + 3);
    renamePlaylist(b.id, '   ', T + 4);  // an empty name is no name: kept as it was
    const lists = loadPlaylists();
    expect(lists.map(p => [p.name, p.songs.map(s => s.songId), p.updatedAt])).toEqual([
      ['Ladies night', ['2', '1', '3'], T + 3],
      ['B', [], T + 1],
    ]);
    const copy = duplicatePlaylist(a.id, 'Ladies night (copy)', T + 5)!;
    expect(copy.id).not.toBe(a.id);
    expect(loadPlaylists()[0]).toMatchObject({ name: 'Ladies night (copy)', songs: lists[0].songs });
  });

  test('a deleted list can be put back where it was', () => {
    const a = createPlaylist('A', [], T)!;
    const b = createPlaylist('B', [], T)!;
    const c = createPlaylist('C', [], T)!;
    const gone = deletePlaylist(b.id)!;
    expect(loadPlaylists().map(p => p.id)).toEqual([c.id, a.id]);
    restorePlaylist(gone);
    expect(loadPlaylists().map(p => p.id)).toEqual([c.id, b.id, a.id]);
    expect(deletePlaylist('nope')).toBeNull();
  });

  test('so many lists, so many songs, so long a name', () => {
    for (let i = 0; i < MAX_PLAYLISTS; i++) expect(createPlaylist(`L${i}`, [], T)).not.toBeNull();
    expect(createPlaylist('one more', [], T)).toBeNull();
    items.clear();
    const big = createPlaylist('x'.repeat(200), Array.from({ length: 150 }, (_, i) => song(`s${i}`)), T)!;
    expect(big.songs).toHaveLength(MAX_PLAYLIST_SONGS);
    expect(big.name).toHaveLength(MAX_NAME);
    expect(cleanName('', 'Fallback')).toBe('Fallback');
  });

  test('storage that is not ours or not there: no lists, nothing thrown', () => {
    items.set('singspree_playlists', '{not json');
    expect(loadPlaylists()).toEqual([]);
    items.set('singspree_playlists', JSON.stringify({ lists: [{ id: 'x' }, null, { id: 'ok', name: 'Ok', songs: [] }] }));
    expect(loadPlaylists().map(p => p.id)).toEqual(['ok']);
  });

  test('shuffled keeps every song; the link carries the songs and the name', () => {
    const songs = ['a', 'b', 'c', 'd'];
    expect(shuffled(songs, () => 0)).toEqual(['b', 'c', 'd', 'a']);
    expect([...shuffled(songs)].sort()).toEqual(songs);
    const url = playlistUrl('https://singspree.com', { name: 'Männer & Bässe', songs: [song('aB3dE5fG7hJ'), song('zz-Y_9q')] });
    expect(url).toBe('https://singspree.com/?again=aB3dE5fG7hJ.zz-Y_9q&list=M%C3%A4nner%20%26%20B%C3%A4sse');
    const params = new URL(url).searchParams;
    expect(parseAgain(params.get('again'))).toEqual(['aB3dE5fG7hJ', 'zz-Y_9q']);
    expect(params.get('list')).toBe('Männer & Bässe');
  });
});
