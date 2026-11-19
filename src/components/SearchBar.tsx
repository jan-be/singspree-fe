import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiUrl } from "../GlobalConsts";
import { useNavigate } from "react-router-dom";
import { trackPick, searchSession, endSearch } from "../logic/track";
import { startChartJob, startErrorKey } from "../logic/chartJobs";
import { thrownField } from "../logic/authApi";
import { forget, setFocusedChartJob, trackChartJob, useTrackedChartJobs } from "../logic/chartJobTracker";
import { useChartOffer } from "../logic/useChartOffer";
import { extractYouTubeVideoId } from "../logic/youtubeLink";
import { ChartLookup, ChartOffer, ChartMaking, type VideoOffer } from "./ChartOfferCard";
import ListenPanel, { type ListenResult, type ListenState } from "./ListenPanel";
import { listen } from "../logic/songListener";
import { inTvApp } from "../logic/tvApp";
import type { SongNamesSource } from "../logic/lyricsScripts";

const DEBOUNCE_MS = 200;

/** The search bar's ref: the chart hint's "make it" starts the chart in the bar's card */
export interface SearchBarHandle {
  makeChart(videoId: string, videoTitle: string): void;
}

/** A song the box found: a pasted link that is one, the chart it made, the song it heard in the room */
export interface FoundSong extends SongNamesSource {
  songId: string;
  videoId?: string | null;
  generated?: boolean;
  beta?: boolean;
}

export interface SearchBarProps {
  value?: string;
  onChange?: (q: string) => void;
  onLinkActive?: (active: boolean) => void;
  /**
   * What happens to a song the box found (`startAt`: seconds into it, a song heard in the room); the default opens
   * it (the entry page). A picker adds it, and the box empties for the next one.
   */
  onSong?: (song: FoundSong, source: 'youtube-url' | 'listen', startAt?: number) => void;
  /** A chart started: hand it on (the party queue takes it as a waiting entry) instead of following it here */
  onChartJob?: (jobId: number, videoTitle: string) => void;
  /** said once a chart was handed on */
  chartHandedText?: string;
  /** why no chart can be started now (the party's limit): the offer says it in place of its button */
  chartBlocked?: string | null;
  /** whether charts can be made here at all (a party that allows none) */
  charts?: boolean;
  /** the done chart's button (the default: "Sing now") */
  doneLabel?: string;
  /** the analytics' search session the box's searches belong to (logic/track.ts); null for none */
  searchScope?: string | null;
  /** 'page': the entry page's big box; 'compact': a picker's (the queue, a playlist) */
  size?: 'page' | 'compact';
  /** the microphone button that listens for the song playing in the room */
  canListen?: boolean;
  placeholder?: string;
}

/** Why starting a chart failed (logic/chartJobs.ts): a refused karaoke version names the original song */
interface ChartStartError {
  code?: string;
  data?: { query?: string } | null;
}

/** The original song a refused karaoke version names, if that is why starting its chart failed */
const karaokeOriginal = (e: unknown) => {
  const err = e as ChartStartError; // what startChartJob throws: an ApiError, the refusal riding along as `data`
  return err.code === 'karaoke' ? err.data?.query : undefined;
};

/**
 * The song search's box, wherever songs are looked for: the entry page, and
 * the pickers of the queue and a playlist (SongPicker). It does not render
 * results itself: typing updates the caller's `q` (debounced) and the list
 * below shows the matches. Pasting a YouTube URL takes its song straight away
 * (onSong: the entry page opens it, a picker adds it), or searches for the
 * video's title. When no song is that video, a chart can be made for it
 * (logic/chartJobs.ts; who is offered it is the backend's switch,
 * useChartOffer): the box shows its progress — or hands it on (onChartJob:
 * the party queue keeps it as a waiting entry) — and as the user moves on the
 * chart pill on every page takes over (chartJobTracker.ts, ChartJobPill).
 *
 * The microphone button in the box listens for the song playing in the room
 * (logic/songListener.ts, ListenPanel): the microphone is open only while it
 * listens, and a found song opens at the spot that was playing.
 *
 * onLinkActive: called with whether the box is busy with a pasted link
 * (looking it up, its offer, its chart) or a listen, when that changes.
 */
const SearchBar = forwardRef<SearchBarHandle, SearchBarProps>(({
  value = '', onChange, onLinkActive, onSong, onChartJob, chartHandedText, chartBlocked = null, charts = true, doneLabel,
  searchScope = 'entry', size = 'page', canListen: listenWanted = true, placeholder,
}, ref) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [text, setText] = useState(value);
  const offerKind = useChartOffer();
  const [status, setStatus] = useState<{ kind: 'loading' | 'info' | 'error'; message: string } | null>(null);
  const [looking, setLooking] = useState(false); // a pasted link is being looked up
  const [offer, setOffer] = useState<VideoOffer | null>(null);   // { videoId, videoTitle, kind: 'none' | 'title' }: a chart can be made
  const [starting, setStarting] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null); // why starting the chart failed
  const [jobId, setJobId] = useState<number | null>(null);   // the chart this bar started (followed by the tracker)
  const { entries } = useTrackedChartJobs();
  const tracked = jobId ? entries.find(e => e.id === jobId) : null;
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastPushedRef = useRef(value);
  const [listenState, setListenState] = useState<ListenState | null>(null); // ListenPanel's state
  const listenRef = useRef<ReturnType<typeof listen> | null>(null);
  const meterRef = useRef<(level: number) => void>(null);
  const [canListen] = useState(() => listenWanted && !inTvApp()); // the Fire TV app grants no microphone
  const compact = size === 'compact';

  const startSession = () => { if (searchScope) { endSearch(searchScope); searchSession(searchScope, 'youtube'); } };
  const endSession = () => { if (searchScope) endSearch(searchScope); };

  // Follow external changes to `q` (back button, "clear filters") without
  // clobbering what the user is typing right now.
  useEffect(() => {
    if (value !== lastPushedRef.current) {
      lastPushedRef.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => () => {
    clearTimeout(timerRef.current); // (null clears nothing: types/browser.d.ts)
    if (abortRef.current) abortRef.current.abort();
    listenRef.current?.stop(); // leaving the page closes the microphone
  }, []);

  const push = (q: string) => {
    const trimmed = q.trim();
    if (trimmed === lastPushedRef.current) return;
    lastPushedRef.current = trimmed;
    onChange?.(trimmed);
  };

  /** Back to an empty box: what it showed goes, the search ends */
  const resetBox = () => {
    clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    endSession();
    setText('');
    setStatus(null);
    setOffer(null);
    setOfferError(null);
    setLooking(false);
    setJobId(null);
    push('');
  };

  // A song found: the caller's (a picker adds it, and the box is ready for the next), or open it
  const found = (song: FoundSong, source: 'youtube-url' | 'listen', startAt = 0) => {
    if (onSong) {
      onSong(song, source, startAt);
      resetBox();
      return;
    }
    trackPick(source, { songId: song.songId });
    navigate(startAt > 0 ? `/sing/${song.songId}?t=${startAt}` : `/sing/${song.songId}`);
  };

  // ── Listening for the song in the room ──
  const startListening = () => {
    listenRef.current?.stop();
    setListenState({ phase: 'starting', heard: 0 });
    const l = listen({
      onOpen: () => setListenState(s => (s?.phase === 'starting' ? { ...s, phase: 'listening' } : s)),
      onLevel: v => meterRef.current?.(v),
      onHeard: heard => setListenState(s => (s?.phase === 'listening' ? { ...s, heard } : s)),
    });
    listenRef.current = l;
    l.done.then(r => {
      if (listenRef.current !== l) return;
      listenRef.current = null;
      if (r.status === 'stopped') { setListenState(null); return; }
      if (r.status === 'found' && r.results?.length) { setListenState({ phase: 'found', results: r.results }); return; }
      if (r.status === 'error') { setListenState({ phase: 'error', error: r.error }); return; }
      setListenState({ phase: 'none' });
    });
  };
  const stopListening = () => {
    const l = listenRef.current;
    if (!l) { setListenState(null); return; }
    setListenState(s => (s && 'heard' in s ? { ...s, phase: 'looking' } : s)); // (listening: starting or listening)
    l.stop();
  };
  const closeListening = () => { listenRef.current?.stop(); listenRef.current = null; setListenState(null); };
  const openFound = (result: ListenResult, fromHere: boolean) => {
    closeListening();
    found(result, 'listen', fromHere ? Math.max(0, Math.round(result.offset * 10) / 10) : 0);
  };
  const listening = listenState && ['starting', 'listening', 'looking'].includes(listenState.phase);

  // While this bar shows the chart, the pill leaves it out; leaving the page
  // (or starting another search) hands it to the pill
  useEffect(() => {
    if (!jobId) return undefined;
    setFocusedChartJob(jobId);
    return () => setFocusedChartJob(null);
  }, [jobId]);
  useEffect(() => { if (jobId && !tracked) setJobId(null); }, [jobId, tracked]); // dismissed in the pill

  const lookupVideo = async (videoId: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setLooking(true);
    try {
      const resp = await fetch(`${apiUrl}/songs/by-video/${videoId}`, { signal: controller.signal });
      const json = await resp.json();
      if (controller.signal.aborted) return;
      setLooking(false);

      if (json.success && json.data && json.matchType === 'exact') {
        found(json.data, 'youtube-url');
        return;
      }
      if (json.karaoke && json.searchQuery) {
        // a karaoke version (no singer to chart): the box looks for the original song instead
        searchOriginal(json.searchQuery, json.videoTitle);
        return;
      }
      if (json.success && json.searchQuery) {
        // Title-based matches: search for the video's title so the user can pick
        startSession(); // the list's search event says the link started it
        setText(json.searchQuery);
        push(json.searchQuery);
        setStatus({ kind: 'info', message: t('search.matchesFor', { title: json.videoTitle }) });
        setOffer({ videoId, videoTitle: json.videoTitle, kind: 'title' });
        return;
      }
      if (json.videoTitle) {
        // the card says it: the video, "not on singspree yet", and the button where offered
        setOffer({ videoId, videoTitle: json.videoTitle, kind: 'none' });
        return;
      }
      setStatus({ kind: 'error', message: json.error ?? t('search.videoNotFound') });
    } catch (e) {
      if (thrownField(e, 'name') !== 'AbortError') { setLooking(false); setStatus({ kind: 'error', message: t('search.lookupFailed') }); }
    }
  };

  // A karaoke version was pasted (or refused): the box searches for the original song, and says why
  const searchOriginal = (query: string, videoTitle: string) => {
    startSession();
    setOffer(null);
    setText(query);
    push(query);
    setStatus({ kind: 'info', message: t('search.karaoke', { title: videoTitle || query }) });
  };

  // Make a chart for a video: start (or join) the job; the tracker follows it from here on, or the caller takes it
  const generateFor = async ({ videoId, videoTitle }: { videoId: string; videoTitle: string }) => {
    setStarting(true);
    setOfferError(null);
    try {
      const started = await startChartJob(videoId);
      if (started.songId) { found({ videoId, ...started.song, songId: started.songId }, 'youtube-url'); return; }
      if (!started.job) throw new Error('POST /chart-jobs answered neither a song nor a job');
      if (onChartJob) {
        onChartJob(started.job.id, videoTitle);
        resetBox();
        if (chartHandedText) setStatus({ kind: 'info', message: chartHandedText });
        return;
      }
      trackChartJob(started.job, { videoTitle });
      setJobId(started.job.id);
      setOffer(null);
      setStatus(null);
    } catch (e) {
      const original = karaokeOriginal(e);
      if (original) { searchOriginal(original, videoTitle); return; }
      setOfferError(t(`search.generate.${startErrorKey(e)}`));
    } finally {
      setStarting(false);
    }
  };

  // The hint found the video on YouTube: make it right here, as if its link had been pasted
  useImperativeHandle(ref, () => ({
    makeChart(videoId: string, videoTitle: string) {
      clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
      setStatus(null);
      setLooking(false);
      setJobId(null);
      setOffer({ videoId, videoTitle, kind: 'none' });
      inputRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      generateFor({ videoId, videoTitle });
    },
  }));

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setText(next);
    setStatus(null);
    setOffer(null);
    setOfferError(null);
    setLooking(false);
    setJobId(null);
    clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (!next.trim()) endSession(); // an emptied box ends the search session; the next letter starts one

    const videoId = extractYouTubeVideoId(next);
    if (videoId) {
      lookupVideo(videoId);
      return;
    }
    timerRef.current = setTimeout(() => push(next), DEBOUNCE_MS);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      clearTimeout(timerRef.current);
      push(text);
    } else if (event.key === 'Escape') {
      clearSearch();
    }
  };

  const clearSearch = () => {
    resetBox();
    inputRef.current?.focus();
  };

  // A pasted link has the box's own card: the page's hint to paste one would be noise
  const linkActive = looking || Boolean(offer) || Boolean(tracked) || Boolean(listenState);
  useEffect(() => { onLinkActive?.(linkActive); }, [linkActive, onLinkActive]);

  const statusColor = { loading: 'text-white/55', info: 'text-white/55', error: 'text-red-400' };
  const job = tracked?.job ? { ...tracked.job, receivedAt: tracked.receivedAt } : null;
  const shownOfferKind = charts ? offerKind : null;
  const icon = compact ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div>
      <div className="relative">
        <div className={`absolute ${compact ? 'left-3' : 'left-4'} top-1/2 -translate-y-1/2 text-white/40 pointer-events-none`}>
          <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="search"
          placeholder={placeholder ?? t('search.placeholder')}
          aria-label={placeholder ?? t('search.placeholder')}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={`field ${compact ? 'h-10 rounded-xl pl-9 text-sm' : 'h-12 sm:h-14 rounded-2xl pl-12 text-base sm:text-[17px]'} ${canListen ? (text ? 'pr-[5.5rem]' : 'pr-14') : (text ? 'pr-12' : 'pr-4')} [&::-webkit-search-cancel-button]:hidden`}
        />
        {text && (
          <button
            type="button"
            onClick={clearSearch}
            className={`btn-icon absolute ${canListen ? 'right-12' : (compact ? 'right-1' : 'right-2')} top-1/2 -translate-y-1/2 ${compact ? 'w-8 h-8' : 'w-9 h-9'} text-white/50`}
            title={t('search.clear')}
            aria-label={t('search.clear')}
          >
            <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        {/* Listen for the song playing in the room */}
        {canListen && <button
          type="button"
          onClick={listening ? stopListening : startListening}
          className={`btn-icon absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 ${listening ? 'text-white bg-gradient-to-br from-[#ff4fd8] to-[#8b5cf6]' : 'text-white/70'}`}
          title={listening ? t('listen.stop') : t('listen.button')}
          aria-label={listening ? t('listen.stop') : t('listen.button')}
          aria-pressed={Boolean(listening)}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="22" />
          </svg>
        </button>}
      </div>

      {canListen && (
        <ListenPanel
          state={listenState}
          meter={meterRef}
          onStop={stopListening}
          onRetry={startListening}
          onClose={closeListening}
          onOpen={openFound}
        />
      )}

      {/* YouTube URL lookup: the card's shape while it is looked up, then a word on what was found */}
      {looking && <ChartLookup compact={compact} />}
      {status && (
        <div className={`mt-2 px-1 ${compact ? 'text-xs' : 'text-sm'} ${statusColor[status.kind]} ${status.kind === 'loading' ? 'animate-pulse' : ''}`}>
          {status.message}
        </div>
      )}
      {/* A video no song is: the card, with the chart offered as the backend's switch says
          (admins while it is tested); for a title that found other songs, only where it can be made */}
      {offer && !tracked && (offer.kind === 'none' || shownOfferKind === 'offer' || shownOfferKind === 'signIn') && (
        <ChartOffer offer={offer} offerKind={shownOfferKind} onGenerate={() => generateFor(offer)} starting={starting} error={offerError} blocked={chartBlocked} compact={compact} />
      )}

      {/* The chart being made: progress here; the pill follows the user once they move on */}
      {tracked && (
        <ChartMaking
          tracked={tracked}
          job={job}
          doneLabel={doneLabel}
          compact={compact}
          onSingNow={() => {
            forget(tracked.id);
            setJobId(null);
            if (job?.songId) found({ songId: job.songId, title: job.title ?? tracked.videoTitle ?? '', artist: job.artist ?? '', videoId: tracked.videoId, generated: true }, 'youtube-url');
          }}
          onDismiss={() => { forget(tracked.id); setJobId(null); }}
        />
      )}
    </div>
  );
});

export default SearchBar;
