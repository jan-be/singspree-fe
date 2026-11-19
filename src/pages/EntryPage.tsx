import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSongNames } from "../logic/useSongNames";
import JoinPartyButton from "../components/JoinPartyButton";
import PlaylistsButton from "../components/PlaylistsButton";
import SearchBar from "../components/SearchBar";
import PartyRecap from "../components/PartyRecap";
import LanguageSwitcher from "../components/LanguageSwitcher";
import SocialLinks from "../components/SocialLinks";
import { DuetIcon } from "../components/Icons";
import SongFilterBar from "../components/SongFilterBar";
import { readFilters, writeFilters, filtersToQuery, hasTagFilters, listContext, type BrowseSong, type ListContext, type SongFilters } from "../logic/songFilters";
import { useSongPages } from "../logic/useSongPages";
import WrapperPage from "./WrapperPage";
import Wordmark from "../components/Wordmark";
import { apiUrl } from "../GlobalConsts";
import { loadPartySession, clearPartySession } from "../logic/partySession";
import { useAuth } from "../logic/AuthContext";
import StarRating from "../components/StarRating";
import AiBadge from "../components/AiBadge";
import { trackPick, currentSearch, endSearch } from "../logic/track";
import { probeYouTube, inMainlandChinaTimeZone } from "../logic/youtubeReachable";
import { useChartOffer } from "../logic/useChartOffer";
import { inOurApp } from "../logic/androidApp";
import { ChartHint } from "../components/ChartOfferCard";
import SingAgainCard from "../components/SingAgainCard";
import FeedbackPrompt from "../components/FeedbackPrompt";
import ForYouRow from "../components/ForYouRow";
import SeasonRow from "../components/SeasonRow";
import { useSeason } from "../seasons/seasons";
import type { SearchBarHandle } from "../components/SearchBar";
import type { PartyRecapInfo } from "../components/PartyRecap";

// ── HeroWall ───────────────────────────────────────────────────────────
// The wall the neon sign hangs on, as in the app icon: brick courses across
// the width, up to a full HD screen's (wider ones keep the wall around the
// sign, not bricks out to their far edges), lit by the sign itself (pink from
// the S, cyan from "Spree") and fading into the page at the edges, the sides
// to nothing. Static SVG, painted once (no blur, no animation, no CSS mask).
// The light's colours are index.css's --wall-*, which a season changes; its
// decorations hang in front of the bricks.
const HeroWall = ({ decor: Decor }: { decor?: React.ComponentType }) => (
  <div className="absolute -top-10 bottom-0 left-1/2 -translate-x-1/2 w-screen max-w-[1920px] -z-10 pointer-events-none" aria-hidden="true">
  <svg
    className="block w-full h-full"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <radialGradient id="hero-wall-base" cx="50%" cy="32%" r="64%">
        <stop offset="0" style={{ stopColor: 'var(--wall-base)' }} stopOpacity="0.95" />
        <stop offset="0.55" style={{ stopColor: 'var(--wall-mid)' }} stopOpacity="0.6" />
        <stop offset="1" style={{ stopColor: 'var(--wall-edge)' }} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="hero-wall-pink" cx="37%" cy="30%" r="36%">
        <stop offset="0" style={{ stopColor: 'var(--wall-left)' }} stopOpacity="0.42" />
        <stop offset="1" style={{ stopColor: 'var(--wall-left)' }} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="hero-wall-cyan" cx="64%" cy="30%" r="36%">
        <stop offset="0" style={{ stopColor: 'var(--wall-right)', stopOpacity: 'var(--wall-right-strength)' }} />
        <stop offset="1" style={{ stopColor: 'var(--wall-right)' }} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="hero-wall-fade" cx="50%" cy="36%" r="64%">
        <stop offset="0" stopColor="#fff" />
        <stop offset="0.55" stopColor="#fff" stopOpacity="0.7" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="hero-wall-sides">
        <stop offset="0" stopColor="#000" />
        <stop offset="0.14" stopColor="#000" stopOpacity="0" />
        <stop offset="0.86" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" />
      </linearGradient>
      <mask id="hero-wall-mask">
        <rect width="100%" height="100%" fill="url(#hero-wall-fade)" />
        <rect width="100%" height="100%" fill="url(#hero-wall-sides)" />
      </mask>
      <pattern id="hero-wall-bricks" width="88" height="44" patternUnits="userSpaceOnUse" x="50%">
        <path d="M0 1H88M0 23H88M22 1V23M66 23V45" stroke="#0d0a24" strokeWidth="2.5" strokeOpacity="0.75" fill="none" />
      </pattern>
    </defs>
    <g mask="url(#hero-wall-mask)">
      <rect width="100%" height="100%" fill="url(#hero-wall-base)" />
      <rect width="100%" height="100%" fill="url(#hero-wall-pink)" />
      <rect width="100%" height="100%" fill="url(#hero-wall-cyan)" />
      <rect width="100%" height="100%" fill="url(#hero-wall-bricks)" />
    </g>
  </svg>
  {/* (a season's decorations load on their own, after the page: nothing in their place until then) */}
  {Decor && <div className="absolute inset-0 overflow-hidden"><Suspense fallback={null}><Decor /></Suspense></div>}
  </div>
);

// ── SongCard ───────────────────────────────────────────────────────────
const SongCard = ({ song, position, context }: { song: BrowseSong; position: number; context: ListContext }) => {
  const { best } = useAuth();
  const names = useSongNames()(song);
  const mine = best[song.songId]; // the signed-in user's best score on this song
  // A pick, with how the grid was showing it (a search, or browsing with sort and tags), for the admin page
  const picked = () => {
    const search = context?.q ? currentSearch('entry') : null;
    trackPick(context?.q ? 'search' : 'browse', {
      songId: song.songId, position,
      ...(context?.q ? { q: context.q } : {}), ...(search ? { searchId: search.id } : {}),
      sort: context?.sort, ...(context?.tags?.length ? { tags: context.tags } : {}), ...(context?.language ? { language: context.language } : {}),
    });
    if (search) endSearch('entry');
  };
  return (
    <Link
      to={`/sing/${song.songId}`}
      onClick={picked}
      className="group block rounded-2xl no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
    >
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.1] transition-shadow duration-300 group-hover:shadow-[0_18px_40px_-16px_rgba(var(--hot-glow),0.5)] group-hover:ring-white/20 group-focus-visible:shadow-[0_18px_40px_-16px_rgba(var(--hot-glow),0.5)]">
        {song.videoId ? (
          <img
            src={`https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`}
            alt={`${names.artist} - ${names.title}`}
            className="w-full h-full object-cover scale-[1.01] group-hover:scale-[1.05] group-focus-visible:scale-[1.05] transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
          </div>
        )}
        {/* the thumbnail's own edge, drawn over the picture */}
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none" />
        {song.generated && <AiBadge look="pill" beta={song.beta} />}
        {song.isDuet && (
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <span className="h-6 px-1.5 rounded-full bg-black/65 text-white flex items-center" title="Duet">
              <DuetIcon size={12} strokeWidth={2.2} />
            </span>
          </div>
        )}
        {mine && (
          <div className="absolute bottom-2 left-2 h-6 px-2 rounded-full bg-black/70 flex items-center gap-1.5" title={mine.score.toLocaleString()}>
            <StarRating stars={mine.stars} size={11} />
            <span className="text-[11px] font-mono font-medium text-white/90 tabular-nums">{mine.score.toLocaleString()}</span>
          </div>
        )}
      </div>
      <div className="pt-2.5 px-0.5" lang={names.lang} title={names.roman}>
        <div className="text-white font-semibold text-[15px] leading-snug tracking-[-0.01em] truncate">{names.title}</div>
        <div className="text-white/50 text-[13px] leading-snug truncate">{names.artist}</div>
      </div>
    </Link>
  );
};

// One column on phones, two on tablets, three on desktop
const GRID = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-6 sm:gap-y-8';

const SongCardSkeleton = () => (
  <div aria-hidden="true">
    <div className="aspect-video rounded-2xl bg-white/[0.05] animate-pulse" />
    <div className="mt-3 h-3.5 w-3/4 rounded-full bg-white/[0.06] animate-pulse" />
    <div className="mt-2 h-3 w-1/2 rounded-full bg-white/[0.04] animate-pulse" />
  </div>
);

// ── InfiniteScrollGrid ─────────────────────────────────────────────────
// The songs of /songs/browse as cards, a page at a time (logic/useSongPages.ts).
// `hint`: shown above the cards when the search found nothing that answers
// it well (the first page's `match`: 'weak', or no songs at all).
const PAGE_SIZE = 30;

const InfiniteScrollGrid = ({ query, emptyMessage, hint = null }: { query: string; emptyMessage?: string; hint?: React.ReactNode }) => {
  const { songs, match, loading, loadedOnce, sentinelRef } = useSongPages(query, { pageSize: PAGE_SIZE, searchScope: 'entry' });
  const { t } = useTranslation();
  // What the grid is showing, for the pick events
  const context = useMemo(() => listContext(query), [query]);

  if (!loadedOnce) {
    // The grid's shape while the first page loads
    return (
      <div className={GRID} aria-busy="true" aria-label={t('sections.loadingSongs')}>
        {Array.from({ length: 6 }, (_, i) => <SongCardSkeleton key={i} />)}
      </div>
    );
  }

  const showHint = hint && (match === 'weak' || match === 'none');

  if (songs.length === 0 && !loading) {
    return (
      <>
        {showHint && hint}
        <div className="text-white/45 text-center py-12">{emptyMessage ?? t('sections.noSongs')}</div>
      </>
    );
  }

  return (
    <>
      {showHint && hint}
      <div className={`${GRID} transition-opacity duration-200 ${loading && songs.length > 0 ? 'opacity-60' : ''}`}>
        {songs.map((song, i) => <SongCard key={song.songId} song={song} position={i} context={context} />)}
      </div>
      {/* Sentinel for triggering next page load */}
      <div ref={sentinelRef} className="h-1" />
      {loading && (
        <div className="text-white/40 text-sm text-center py-6 animate-pulse">{t('sections.loading')}</div>
      )}
    </>
  );
};

// ── EntryPage ──────────────────────────────────────────────────────────
const EntryPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Our apps have no footer: a TV remote's arrows never got past the endless
  // songs to it, and an app keeps such links in a menu (AppMenu, in the top bar)
  const [inApp] = useState(inOurApp);
  // A joiner who comes back to the menu has left the party: choosing a song
  // here starts their own. A host keeps the party (the joiners wait), sees it
  // here with the code and who is connected, and just picks the next song.
  const [hostParty, setHostParty] = useState<{ partyId: string; username: string; connected: number | null } | null>(() => {
    const s = loadPartySession();
    if (s && !s.isHost) { clearPartySession(); return null; }
    return s ? { partyId: s.partyId, username: s.username, connected: null } : null;
  });
  useEffect(() => {
    if (!hostParty?.partyId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`${apiUrl}/parties/${hostParty.partyId}`);
        if (cancelled) return;
        if (r.status === 404) { clearPartySession(); setHostParty(null); return; } // closed meanwhile
        const j = await r.json();
        const players = j?.data?.players ?? [];
        const connected = players.filter((p: { connected: boolean; username: string }) => p.connected && p.username !== j.data.owner).length;
        setHostParty(h => (h && h.connected !== connected ? { ...h, connected } : h));
      } catch { /* keep the last count */ }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [hostParty?.partyId]);
  // (its button is on the party's line: it passes the party)
  const endHostParty = async (p: { partyId: string; username: string }) => {
    setHostParty(null);
    clearPartySession();
    try {
      await fetch(`${apiUrl}/parties/${p.partyId}/close`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: p.username }),
      });
    } catch { /* the sweep closes it eventually */ }
  };
  // Why the party page sent us here (the host ended the party / stayed gone)
  const location = useLocation();
  const [partyNotice, setPartyNotice] = useState(location.state?.partyNotice ?? null);
  // A joiner's night there, when the party sent one home (PartyRecap): { partyId, reason }
  const [partyRecap, setPartyRecap] = useState<PartyRecapInfo | null>(location.state?.partyRecap ?? null);
  useEffect(() => {
    if (location.state?.partyNotice) navigate(location.pathname + location.search, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [searchParams, setSearchParams] = useSearchParams();
  // Halloween and the like (src/seasons): its decorations on the wall, its songs above the grid
  const season = useSeason();

  const filters = readFilters(searchParams);
  const query = filtersToQuery(filters);
  const hasFilters = hasTagFilters(filters);
  const updateFilters = (patch: Partial<SongFilters>) =>
    setSearchParams(writeFilters(searchParams, { ...filters, ...patch }), { replace: true });

  // Nothing found answers the search well: say that a song can be made from
  // its YouTube link, to whoever the backend's switch offers it (after a few
  // letters, and not while the box is busy with a pasted link of its own)
  const offerKind = useChartOffer();
  const [linkActive, setLinkActive] = useState(false);
  const searchBarRef = useRef<SearchBarHandle>(null);   // the hint's "make it" starts the chart in the search bar's card
  const chartHint = filters.q && filters.q.length >= 3 && !linkActive && (offerKind === 'offer' || offerKind === 'signIn')
    ? <ChartHint query={filters.q} offerKind={offerKind} onMake={(videoId, title) => searchBarRef.current?.makeChart(videoId, title)} />
    : null;

  // The search band is pinned once the spot it started in has scrolled away
  const pinSentinelRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const el = pinSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([entry]) => setPinned(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Mainland China blocks YouTube, so no song would start there: visitors on
  // its clock are told before they pick one (if YouTube is out of reach)
  const [youtubeBlocked, setYoutubeBlocked] = useState(false);
  useEffect(() => {
    if (!inMainlandChinaTimeZone()) return undefined;
    let gone = false;
    probeYouTube().then(ok => { if (!gone) setYoutubeBlocked(!ok); });
    return () => { gone = true; };
  }, []);

  return (
    <>
    {/* (Join Party takes the bar's free room and keeps right in it: Playlists goes after it, to stay beside it) */}
    <WrapperPage hideFooter navActions={<><JoinPartyButton /><PlaylistsButton /></>}>

      {/* Hero: the neon sign on its brick wall, like the icon */}
      <div className="text-center pt-10 pb-12 sm:pt-14 sm:pb-16 relative isolate">
        <HeroWall decor={season?.Decor} />

        <div className="relative flex items-center justify-center mb-6">
          <h1 className="m-0 leading-none">
            <Wordmark height={104} className="max-w-full h-auto md:h-[140px] md:w-auto" />
          </h1>
        </div>
        <p className="text-[1.3rem] sm:text-2xl leading-snug font-medium tracking-[-0.015em] text-white/90 max-w-xl mx-auto text-balance relative">
          {t('hero.tagline')}
        </p>

        {/* The host's party is still on while they pick the next song — worth
            mentioning only while somebody is actually in it */}
        {hostParty && (hostParty.connected ?? 0) >= 1 && ( // (not counted yet: none)
          <div className="relative mt-6 max-w-md mx-auto rounded-2xl bg-panel border border-white/10 pl-4 pr-2.5 py-3 flex items-center justify-between gap-4">
            <div className="text-left min-w-0">
              <div className="text-white text-sm font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-neon-green flex-shrink-0" aria-hidden="true" />
                {t('party.stillOn', { code: hostParty.partyId })}
                <span className="text-white/50 font-normal">· {t('party.connectedCount', { count: hostParty.connected })}</span>
              </div>
              <div className="text-white/50 text-xs mt-0.5">{t('party.pickNextHint')}</div>
            </div>
            <button
              type="button"
              onClick={() => endHostParty(hostParty)}
              className="btn btn-sm btn-ghost hover:text-red-300 hover:bg-red-500/10 flex-shrink-0"
            >
              {t('party.endParty')}
            </button>
          </div>
        )}

        {/* Why the party page sent us here: a joiner's night there, or a line */}
        {partyRecap ? (
          <PartyRecap recap={partyRecap} onClose={() => { setPartyRecap(null); setPartyNotice(null); }} />
        ) : partyNotice && (
          <div className="relative mt-6 max-w-md mx-auto rounded-2xl bg-panel border border-white/10 pl-4 pr-2 py-2.5 flex items-center justify-between gap-4 text-sm text-white/80">
            <span className="text-left">{partyNotice === 'account_deleted' ? t('profile.deletionScheduled') : partyNotice === 'ended' ? t('party.endedNotice') : partyNotice === 'removed' ? t('party.removedNotice') : t('party.hostLeftNotice')}</span>
            <button type="button" onClick={() => setPartyNotice(null)} className="btn-icon w-8 h-8 text-white/50" aria-label="close">✕</button>
          </div>
        )}

        {/* Rarely: a planned party's link, the last party's unsung songs, after a long one the home screen (not while it is still on) */}
        {!hostParty && <SingAgainCard justEnded={partyNotice === 'ended'} />}

        {youtubeBlocked && (
          <div role="status" className="relative mt-6 max-w-md mx-auto rounded-2xl bg-panel border border-white/10 px-4 py-3 text-sm text-white/80 text-pretty">
            {t('party.youtubeBlocked')}
          </div>
        )}
      </div>

      {/* Search and filters stay at the top while the grid scrolls under them.
          A band across the whole width, tinted only once it is pinned (the
          sentinel above it has left the screen). */}
      <div ref={pinSentinelRef} aria-hidden="true" />
      <div className={`sticky top-0 z-30 mx-[calc(50%-50vw)] px-[calc(50vw-50%)] pt-3 pb-3 mb-4 transition-[background-color,border-color,box-shadow] duration-200 border-b ${
        pinned ? "bg-ink/85 backdrop-blur-md border-white/[0.08] shadow-[0_12px_30px_-18px_rgba(0,0,0,0.8)]" : "border-transparent"
      }`}>
      {/* Search — drives the grid below via the q filter */}
      <div className="mb-3 sm:mb-4">
        <SearchBar ref={searchBarRef} value={filters.q ?? ''} onChange={(q) => updateFilters({ q: q || null })} onLinkActive={setLinkActive} />
      </div>

      {/* Filter pills (combinable tags) + sort (SongFilterBar: the same in the queue and a playlist) */}
      <SongFilterBar filters={filters} onChange={updateFilters} />
      </div>

      {/* Song grid — search results or the browse list, same component */}
      <section className="mb-6 pb-12">
        {/* The season's songs first, then what goes with the songs this browser or account sang, on the plain grid only */}
        {!filters.q && !hasFilters && season && <SeasonRow key={season.id} season={season} />}
        {!filters.q && !hasFilters && <ForYouRow />}
        <InfiniteScrollGrid
          query={query}
          emptyMessage={filters.q ? t('search.noResults', { query: filters.q }) : undefined}
          hint={chartHint}
        />
      </section>

    </WrapperPage>

    {/* "How do you like SingSpree?", for someone who has sung a few songs (logic/songPrompt.ts) */}
    <FeedbackPrompt where="home" />

    {/* Fixed footer: compliance links, SingSpree elsewhere, the language switcher. From sm on, in one line where it
        fits (a phone-sized screen has it in the side menu: SideMenu) */}
    {!inApp && <div data-out="home-bar" className="hidden sm:block fixed bottom-0 left-0 right-0 z-40 bg-ink/80 backdrop-blur-md border-t border-white/[0.06]">
      <div className="flex flex-wrap justify-center items-center gap-x-4 sm:gap-x-6 gap-y-0 px-4 py-1 text-xs sm:text-[13px]">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/privacy-policy" className="text-white/45 hover:text-white transition-colors">
            {t('footer.privacyPolicy')}
          </Link>
          <Link to="/tos" className="text-white/45 hover:text-white transition-colors">
            {t('footer.termsOfService')}
          </Link>
          <Link to="/contact" className="text-white/45 hover:text-white transition-colors">
            {t('footer.contact')}
          </Link>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <SocialLinks size={15} />
          <span className="w-px h-3.5 bg-white/15" aria-hidden="true" />
          <LanguageSwitcher />
        </div>
      </div>
    </div>}
    </>
  );
};

export default EntryPage;
