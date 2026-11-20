import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { apiUrl } from "../GlobalConsts";
import { useSongNames } from "../logic/useSongNames";
import { useChartOffer } from "../logic/useChartOffer";
import { useSongPages } from "../logic/useSongPages";
import { useSuggestions } from "../logic/useSuggestions";
import { filtersToQuery, NO_FILTERS, type BrowseSong, type SongFilters } from "../logic/songFilters";
import SearchBar, { type FoundSong, type SearchBarHandle } from "./SearchBar";
import SongFilterBar from "./SongFilterBar";
import SongThumb from "./SongThumb";
import { ChartHint } from "./ChartOfferCard";

/** A song a picker hands on: from its list, a pasted link, the AI hint, a chart made here */
export type PickedSong = FoundSong & { title: string; artist: string };

/** Where a pick came from: a typed search (its list, a pasted link, the mic), or the suggestions */
export type PickSource = 'search' | 'youtube-url' | 'listen' | 'suggestion';

const PAGE_SIZE = 20;
/** Rows held for the suggestions until the first ones arrive */
const PLACEHOLDER_ROWS = 4;

export interface SongPickerProps {
  onPick: (song: PickedSong, source: PickSource) => void;
  /** the list's songs: a green tick instead of the plus, and not added again */
  picked?: Set<string>;
  /** what the tick means (its tooltip, for screen readers) */
  pickedLabel: string;
  /** the plus's */
  addLabel: string;
  /** nothing more can be added (a full playlist) */
  full?: boolean;
  /** the list's songs, most telling first: with nothing typed, the songs that fit them (useSuggestions); an empty
   * list gets "For you" */
  suggestFrom?: string[];
  /** the suggestions' heading while the list has songs */
  suggestionsLabel: string;
  /** the analytics' search session (logic/track.ts), none for null */
  searchScope?: string | null;
  placeholder?: string;
  /** the AI charts: hand a started one on (onJob), say why none can start now (blocked), or none at all (allowed: false) */
  chart?: { onJob?: (jobId: number, videoTitle: string) => void; handedText?: string; blocked?: string | null; allowed?: boolean };
  /** "Sign in" opens in a new tab (the party's queue: the party stays) */
  signInNewTab?: boolean;
  /** a line under the box (the queue's: why a song was refused) */
  notice?: ReactNode;
}

/** The tick of a song in the list */
const InListMark = ({ label }: { label: string }) => (
  <span title={label} className="w-7 h-7 rounded-full bg-neon-green/15 text-neon-green flex items-center justify-center flex-shrink-0">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
    <span className="sr-only">{label}</span>
  </span>
);

/**
 * Adding songs to a list, as on Spotify: the queue's "add a song"
 * (QueueAddSong) and a playlist's (PlaylistsButton).
 *
 * With nothing typed it shows the songs that fit the list so far
 * (suggestFrom, useSuggestions), and after each add the ones that fit the
 * list now; then the rest of the catalogue in the recommended order. Typed,
 * it is the entry page's search: the same box (SearchBar: a pasted YouTube
 * link, the AI chart for a video no song is), the same results
 * (useSongPages) and, when they are poor, the same hint to find it on
 * YouTube and make it (ChartHint). The filters (SongFilterBar: duets,
 * languages, the voice slider) narrow both; their state is the picker's own,
 * so the entry page's address stays as it is.
 *
 * A search stays after a pick, so the next song of the same artist is one
 * click more; a song in the list has a green tick (picked).
 *
 * The songs are always right under the box, in the page's own scroll (no
 * box of their own): the list being made goes above the picker, never
 * between the box and its songs.
 */
const SongPicker = ({ onPick, picked, pickedLabel, addLabel, full = false, suggestFrom, suggestionsLabel, searchScope = null, placeholder, chart = {}, signInNewTab = false, notice }: SongPickerProps) => {
  const { t } = useTranslation();
  const namesOf = useSongNames();
  const offerKind = useChartOffer();
  const [filters, setFilters] = useState<SongFilters>(NO_FILTERS);
  const [linkActive, setLinkActive] = useState(false);
  const barRef = useRef<SearchBarHandle>(null);
  const update = useCallback((patch: Partial<SongFilters>) => setFilters(f => ({ ...f, ...patch })), []);

  const searching = Boolean(filters.q);
  const query = useMemo(() => filtersToQuery(filters), [filters]);
  const { songs: found, match, loading, loadedOnce, sentinelRef } = useSongPages(query, { pageSize: PAGE_SIZE, searchScope });
  const suggested = useSuggestions(searching ? null : (suggestFrom ?? []), filters);

  // picks the list has not shown yet (the party's queue comes back from the server): ticked already, so a second
  // click does not add the song twice; the list's next state has them, or not
  const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => setSent(new Set()), [picked]);
  const isIn = (songId: string) => Boolean(picked?.has(songId) || sent.has(songId));

  const pick = (song: FoundSong | BrowseSong, source: PickSource) => {
    if (full || isIn(song.songId)) return;
    onPick({ ...song, title: song.title ?? '', artist: song.artist ?? '' }, source);
    setSent(prev => new Set(prev).add(song.songId));
  };
  // a song the AI hint found on YouTube that is one here already: its card, then the pick
  const pickById = async (songId: string) => {
    try {
      const j = await (await fetch(`${apiUrl}/song-cards?ids=${encodeURIComponent(songId)}`)).json();
      if (j.data?.[0]) pick(j.data[0], 'search');
    } catch { /* no card: nothing picked */ }
  };

  // Typed: what the search found. Else the suggestions (once they are here: the list does not jump when they
  // arrive), then the catalogue
  let rows: BrowseSong[] = [];
  if (searching) rows = found;
  else if (suggested.songs) {
    const shown = new Set(suggested.songs.map(s => s.songId));
    rows = [...suggested.songs, ...found.filter(s => !shown.has(s.songId))];
  }
  const heading = searching ? null
    : suggested.songs?.length ? (suggestFrom?.length ? suggestionsLabel : t('forYou.title'))
      : t('sections.recommended');
  const busy = searching ? loading : suggested.loading;

  const showHint = searching && (filters.q?.length ?? 0) >= 3 && !linkActive
    && (match === 'weak' || match === 'none') && (offerKind === 'offer' || offerKind === 'signIn') && chart.allowed !== false;

  const search = (
    <div className="space-y-2">
      <SearchBar
        ref={barRef}
        size="compact"
        canListen={false}
        value={filters.q ?? ''}
        onChange={q => update({ q: q || null })}
        onLinkActive={setLinkActive}
        onSong={(song, source) => pick(song, source)}
        onChartJob={chart.onJob}
        chartHandedText={chart.handedText}
        chartBlocked={chart.blocked}
        signInNewTab={signInNewTab}
        charts={chart.allowed !== false}
        doneLabel={addLabel}
        searchScope={searchScope}
        placeholder={placeholder}
      />
      <SongFilterBar filters={filters} onChange={update} size="compact" />
      {showHint && (
        <ChartHint
          query={filters.q!}
          offerKind={offerKind}
          onMake={(videoId, title) => barRef.current?.makeChart(videoId, title)}
          onSong={pickById}
          songLabel={addLabel}
          signInNewTab={signInNewTab}
          compact
        />
      )}
    </div>
  );

  let list: ReactNode = null;
  if (searching && loadedOnce && !found.length && !loading) {
    list = <p className="px-1 py-2 text-xs text-white/45">{t('sections.noSongs')}</p>;
  } else if (!searching && !suggested.songs) {
    // (the rows the suggestions will take, so they do not push in from nothing)
    list = (
      <ul aria-hidden="true" className="space-y-0.5 animate-pulse">
        {Array.from({ length: PLACEHOLDER_ROWS }, (_, i) => (
          <li key={i} className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="block w-12 aspect-video rounded-md bg-white/[0.07]" />
            <span className="flex-1 space-y-1.5">
              <span className="block h-2.5 w-2/3 rounded bg-white/[0.07]" />
              <span className="block h-2 w-1/3 rounded bg-white/[0.05]" />
            </span>
          </li>
        ))}
      </ul>
    );
  } else if (rows.length) {
    list = (
      <div>
        {heading && <h4 className="px-1 mb-1 text-xs font-semibold text-white/70">{heading}</h4>}
        <ul className={`space-y-0.5 transition-opacity ${busy ? 'opacity-70' : ''}`} aria-label={heading ?? t('queue.results')}>
          {rows.map(song => {
            const names = namesOf(song);
            const inList = isIn(song.songId);
            return (
              <li key={song.songId}>
                <button
                  type="button"
                  onClick={() => pick(song, searching ? 'search' : 'suggestion')}
                  disabled={inList || full}
                  className="group w-full flex items-center gap-2.5 text-left px-2 py-1.5 rounded-xl hover:bg-white/[0.07] disabled:hover:bg-transparent disabled:cursor-default transition-colors cursor-pointer"
                >
                  <SongThumb videoId={song.videoId} generated={song.generated} beta={song.beta} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-white truncate" lang={names.lang}>{names.title}</span>
                    <span className="block text-xs text-white/50 truncate" lang={names.lang}>{names.artist}</span>
                  </span>
                  {inList ? <InListMark label={pickedLabel} /> : (
                    <span aria-hidden="true" title={addLabel} className="w-7 h-7 rounded-full bg-white/[0.08] text-white flex items-center justify-center text-base leading-none group-hover:bg-[#ff5cd6] group-disabled:opacity-40 transition-colors flex-shrink-0">+</span>
                  )}
                </button>
              </li>
            );
          })}
          <li aria-hidden="true"><div ref={sentinelRef} className="h-1" /></li>
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {search}
      {notice}
      {list}
    </div>
  );
};

export default SongPicker;
