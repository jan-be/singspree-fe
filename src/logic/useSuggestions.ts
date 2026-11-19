import { useEffect, useState } from 'react';
import { apiUrl } from '../GlobalConsts';
import { historySongIds } from './partyHistory';
import { writeVoiceWindow } from './voiceWindow';
import type { BrowseSong, SongFilters } from './songFilters';

/**
 * Songs that fit a list being made (a playlist, a party's queue): POST
 * /similar (backend similarSongs.ts: the songs Last.fm finds similar to
 * the list's first songs, matched against the catalogue),
 * narrowed by the song filters. An empty list asks with the songs this
 * browser sang lately instead ("For you").
 *
 * The same request within a minute is answered from here: the queue's
 * picker and the score screen's tiles ask for the same party (PartyPage).
 */

export type SuggestedSong = BrowseSong;

/** The backend's most (routes/similar.ts MAX_LIMIT is 40) */
const LIMIT = 24;
/** The list's songs sent at most: the first ones are the ones asked about */
const MAX_LIST = 100;
/** This browser's songs that stand in for an empty list */
const HISTORY_SEEDS = 10;
const KEEP_MS = 60_000;
const KEEP_MAX = 30;

const cache = new Map<string, { at: number; songs: Promise<SuggestedSong[]> }>();

/** The tag filters as /songs/browse reads them (the text and the order are not for suggestions) */
const tagFilters = (f: Pick<SongFilters, 'duet' | 'language' | 'voice'> | null | undefined) =>
  f && (f.duet || f.language || f.voice)
    ? { duet: f.duet, language: f.language, voice: f.voice ? writeVoiceWindow(f.voice) : null }
    : null;

export function fetchSuggestions(list: string[], filters?: Pick<SongFilters, 'duet' | 'language' | 'voice'> | null): Promise<SuggestedSong[]> {
  const given = [...new Set(list.filter(Boolean))].slice(0, MAX_LIST);
  const body = JSON.stringify({
    list: given.length ? given : historySongIds().slice(0, HISTORY_SEEDS),
    limit: LIMIT,
    filters: tagFilters(filters),
  });
  const kept = cache.get(body);
  if (kept && Date.now() - kept.at < KEEP_MS) return kept.songs;
  const songs = fetch(`${apiUrl}/similar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    .then(r => r.json())
    .then(j => (Array.isArray(j.data) ? j.data as SuggestedSong[] : []))
    .catch(() => { cache.delete(body); return []; });
  cache.delete(body);
  cache.set(body, { at: Date.now(), songs });
  if (cache.size > KEEP_MAX) cache.delete(cache.keys().next().value!);
  return songs;
}

/**
 * The suggestions for `list` (most telling first: a playlist's newest songs,
 * a party's song on and its queue), null until the first answer. A new
 * list keeps the songs shown until its own arrive (no empty flash after each
 * add); `loading` says they are on their way.
 */
export function useSuggestions(list: string[] | null, filters?: Pick<SongFilters, 'duet' | 'language' | 'voice'> | null) {
  const key = list ? JSON.stringify([list, tagFilters(filters)]) : null;
  const [shown, setShown] = useState<{ key: string; songs: SuggestedSong[] } | null>(null);
  useEffect(() => {
    if (!list || !key) return undefined;
    let gone = false;
    fetchSuggestions(list, filters).then(songs => { if (!gone) setShown({ key, songs }); });
    return () => { gone = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { songs: shown?.songs ?? null, loading: Boolean(key) && shown?.key !== key };
}
