import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPage, type BrowseSong } from './songFilters';
import { trackSearch } from './track';

/**
 * The songs a /songs/browse query finds, a page at a time (the entry page's
 * grid, the pickers' lists: SongPicker). When `query` changes its first page
 * is fetched and swapped in when it arrives — the songs shown stay meanwhile,
 * so search-as-you-type does not flash an empty list on every keystroke — and
 * the next page comes when `sentinelRef`'s element scrolls into view.
 *
 * `match`: how well the first page answers a typed search ('weak' or 'none':
 * the AI hint is worth offering), null without one. `searchScope`: the
 * analytics' search session a typed search is reported to (logic/track.ts),
 * none for null. `enabled`: false fetches nothing.
 */
export function useSongPages(query: string, { pageSize = 30, searchScope = null, enabled = true }: { pageSize?: number; searchScope?: string | null; enabled?: boolean } = {}) {
  const [songs, setSongs] = useState<BrowseSong[]>([]);
  const [match, setMatch] = useState<string | null>(null); // of the songs shown
  const [loading, setLoading] = useState(enabled);
  const [hasMore, setHasMore] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const offsetRef = useRef(0);
  const queryRef = useRef(query);
  const inFlightRef = useRef<string | null>(null); // token of the request in flight, if any
  // (a callback ref: a sentinel that mounts after the songs came, as a picker's list does, is watched too)
  const [sentinel, sentinelRef] = useState<HTMLDivElement | null>(null);

  const load = useCallback(async (q: string, offset: number, replace: boolean) => {
    const token = `${q}@${offset}`;
    inFlightRef.current = token;
    setLoading(true);
    try {
      const result = await fetchPage(q, offset, pageSize);
      if (q !== queryRef.current) return; // a newer query took over
      if (offset === 0) {
        const typed = new URLSearchParams(q).get('q');
        const matched = typed ? (result.songs.length ? result.match : 'none') : null;
        setMatch(matched);
        if (typed && searchScope) trackSearch(searchScope, { q: typed, results: result.songs.length, hasMore: result.hasMore, match: matched ?? undefined });
      }
      setSongs(prev => {
        if (replace) return result.songs;
        const existing = new Set(prev.map(s => s.songId));
        return [...prev, ...result.songs.filter(s => !existing.has(s.songId))];
      });
      setHasMore(result.hasMore);
      offsetRef.current = offset + result.songs.length;
    } catch (e) {
      if (q !== queryRef.current) return;
      console.error('[songs] fetch error', e);
      if (replace) setSongs([]);
      setHasMore(false);
    } finally {
      if (inFlightRef.current === token) {
        inFlightRef.current = null;
        setLoading(false);
        setLoadedOnce(true);
      }
    }
  }, [pageSize, searchScope]);

  // New query → its first page
  useEffect(() => {
    queryRef.current = enabled ? query : '';
    offsetRef.current = 0;
    if (!enabled) {
      setSongs([]);
      setMatch(null);
      setHasMore(false);
      setLoading(false);
      return;
    }
    setHasMore(true);
    load(query, 0, true);
  }, [query, load, enabled]);

  // Sentinel scrolled into view → next page (also inside a scrolling panel: its clipping counts)
  useEffect(() => {
    const el = sentinel;
    if (!el || !enabled) return undefined;
    const view = el.ownerDocument.defaultView ?? window;
    const obs = new view.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !inFlightRef.current) load(queryRef.current, offsetRef.current, false);
      },
      { rootMargin: '400px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, load, songs.length, enabled, sentinel]);

  return { songs, match, loading, hasMore, loadedOnce, sentinelRef };
}
