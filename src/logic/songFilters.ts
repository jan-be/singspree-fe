/**
 * The song search's state, wherever songs are looked for: the entry page's
 * grid, the queue's "add a song" and a playlist's (SongFilterBar, SongPicker,
 * useSongPages). The search text `q`, the ranking `sort` (ignored while
 * searching: results are relevance-ranked) and the tag filters, which combine.
 * The entry page keeps it in its address (?q=love&duet=1&language=German&
 * voice=-63), so it survives reloads and can be shared; the pickers keep it
 * to themselves. Either way it reaches the backend as the same query string
 * (GET /songs/browse, backend songBrowser.ts).
 */
import { apiUrl } from '../GlobalConsts';
import { readVoiceWindow, writeVoiceWindow, type VoiceWindow } from './voiceWindow';
import type { SongNamesSource } from './lyricsScripts';

/** A song of /songs/browse as the lists show it */
export interface BrowseSong extends SongNamesSource {
  songId: string;
  title: string;
  artist: string;
  videoId?: string | null;
  generated?: boolean;
  beta?: boolean;
  isDuet?: boolean;
}

/** The browse list's orders (backend songBrowser), 'recommended' when none is named */
export type Sort = 'recommended' | 'popular' | 'new';
export const SORTS: Sort[] = ['recommended', 'popular', 'new'];
export const readSort = (v: string | null): Sort => SORTS.find(s => s === v) ?? 'recommended';

export interface SongFilters {
  q: string | null;
  sort: Sort;
  duet: boolean;
  language: string | null;
  /** how high the songs are sung (logic/voiceWindow.ts) */
  voice: VoiceWindow | null;
}

export const NO_FILTERS: SongFilters = { q: null, sort: 'recommended', duet: false, language: null, voice: null };

/** Whether a tag filter is on (not the text, not the order) */
export const hasTagFilters = (f: SongFilters) => f.duet || Boolean(f.language) || Boolean(f.voice);

export const readFilters = (params: URLSearchParams): SongFilters => ({
  q: (params.get('q') || '').trim() || null,
  sort: readSort(params.get('sort')),
  duet: params.get('duet') === '1',
  language: params.get('language') || null,
  voice: readVoiceWindow(params.get('voice')),
});

export const writeFilters = (params: URLSearchParams, filters: SongFilters) => {
  const next = new URLSearchParams(params);
  // 'stems': the Instrumental filter, gone since nearly every song has stems; old links lose it here
  for (const key of ['q', 'sort', 'duet', 'stems', 'language', 'voice']) next.delete(key);
  if (filters.q) next.set('q', filters.q);
  if (filters.sort !== 'recommended') next.set('sort', filters.sort);
  if (filters.duet) next.set('duet', '1');
  if (filters.language) next.set('language', filters.language);
  if (filters.voice) next.set('voice', writeVoiceWindow(filters.voice));
  return next;
};

/** Query string for /songs/browse (sort is meaningless while searching) */
export const filtersToQuery = (filters: SongFilters) =>
  writeFilters(new URLSearchParams(), filters.q ? { ...filters, sort: 'recommended' } : filters).toString();

/** What a list is showing, for the pick events (backend routes/events.ts) */
export interface ListContext {
  q: string | null;
  sort: Sort;
  tags: string[];
  language: string | null;
}

export function listContext(query: string): ListContext {
  const p = new URLSearchParams(query);
  return {
    q: p.get('q') || null,
    sort: readSort(p.get('sort')),
    tags: [p.get('duet') === '1' && 'duet', p.get('language') && 'language', p.get('voice') && 'voice'].filter((tag): tag is string => Boolean(tag)),
    language: p.get('language') || null,
  };
}

/** One page of /songs/browse; match: how well the first page answers a search ('weak' when nothing answers it well) */
export async function fetchPage(query: string, offset: number, limit: number): Promise<{ songs: BrowseSong[]; hasMore: boolean; match: string | null }> {
  const params = new URLSearchParams(query);
  params.set('offset', String(offset));
  params.set('limit', String(limit));
  const r = await fetch(`${apiUrl}/songs/browse?${params}`);
  const j = await r.json();
  return { songs: j.data || [], hasMore: j.hasMore ?? false, match: j.match ?? null };
}

/** A catalogue language with its number of songs (GET /songs/languages) */
export interface CatalogueLanguage {
  name: string;
  count: number;
}

let languages: Promise<CatalogueLanguage[]> | null = null;
/** The catalogue's languages, asked for once */
export const loadLanguages = () => (languages ??= fetch(`${apiUrl}/songs/languages`)
  .then(r => r.json())
  .then(j => (j.data || []) as CatalogueLanguage[])
  .catch(() => { languages = null; return []; }));

/** i18n locale code → USDB language name (the user's own language gets its own pill) */
export const LOCALE_TO_LANGUAGE: Record<string, string> = {
  en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian',
  ja: 'Japanese', pl: 'Polish', nl: 'Dutch', pt: 'Portuguese', zh: 'Mandarin',
  ko: 'Korean', hu: 'Hungarian', sv: 'Swedish', fi: 'Finnish', da: 'Danish',
  ru: 'Russian', tr: 'Turkish', cs: 'Czech', no: 'Norwegian', hr: 'Croatian',
  sl: 'Slovenian', hi: 'Hindi', ar: 'Arabic', id: 'Indonesian', th: 'Thai', tl: 'Tagalog', vi: 'Vietnamese',
};
