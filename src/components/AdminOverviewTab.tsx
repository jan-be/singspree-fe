import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AiBadge from './AiBadge';
import Avatar from './Avatar';
import DifficultyTag from './DifficultyTag';
import { DropdownChevron } from './Dropdown';
import { btn, StatTile, Section, Badge, Notice, Thumb, Hint, Loading, FilterButtons, countryFlag, countryLabel, panel, list, useAgo, useName, type AdminActions } from './AdminParts';
import { SiteProblemLines } from './AdminSites';
import { partyNumbers } from '../logic/siteStatus';
import { formatDuration } from '../logic/duration';
import { formatTime } from '../logic/songRegions';
import { deviceLabel } from '../logic/deviceLabel';
import { DIFFICULTIES } from '../logic/difficulty';
import { appendPlays, refreshPlays, type LoadedPlays } from '../logic/adminPlays';
import { getAdminPlays, adminCloseParty } from '../logic/authApi';
import type { AdminOverview, AdminParty, AdminPlay, AdminPlayFilter } from '../logic/authApi';

/**
 * /admin's first tab: today's and this week's numbers, the parties running
 * right now (the page reads them every few seconds), each site's share of
 * them where there are several, and the songs sung last.
 */

const PAGE = 20;

/** What the list is narrowed to, with what its chips say */
interface PlayScope {
  party?: string;
  song?: { id: string; title: string };
  singer?: { id: string; name: string };
}

/** The list as read, and the filter it was read with */
type Plays = LoadedPlays<AdminPlay> & { filter: AdminPlayFilter };

/** One running party: code, host, what is playing, who is in. */
const PartyCard = ({ party, busy, onClose }: { party: AdminParty; busy: boolean; onClose: (party: AdminParty) => void }) => {
  const { t } = useTranslation();
  const ago = useAgo();
  const name = useName();
  const song = party.currentSong;
  const online = party.players.filter(p => p.connected).length;
  return (
    <div className={`${panel} p-4 space-y-3 min-w-0`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/join/${party.partyId}`} className="font-mono text-xl font-semibold text-neon-cyan hover:text-neon-cyan tracking-[0.2em] hover:underline underline-offset-4">{party.partyId}</Link>
            {party.site && <Badge tone="cyan">{party.site}</Badge>}
            {!party.hostConnected && <Badge tone="red">{party.hostAway ? t('admin.parties.hostAway') : t('admin.parties.hostGone')}</Badge>}
          </div>
          <div className="text-xs text-white/55 truncate mt-0.5">
            {t('admin.parties.host', { username: name(party.owner) })} · {ago(party.createdAt)}
            {/* another site's party is shown as that site last saved it */}
            {party.asOf ? ` · ${t('admin.parties.asOf', { ago: ago(party.asOf) })}` : ''}
          </div>
        </div>
        <button type="button" disabled={busy} onClick={() => onClose(party)} className={btn.danger}>{t('admin.parties.close')}</button>
      </div>
      {song
        ? (
          <Link to={`/sing/${song.songId}`} className="flex items-center gap-3 rounded-xl -mx-2 px-2 py-1.5 no-underline hover:bg-white/[0.05] transition-colors">
            <Thumb videoId={song.videoId} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white truncate">{song.title}</div>
              <div className="text-xs text-white/55 truncate">{song.artist} · {t(song.ended ? 'admin.parties.ended' : song.isPlaying ? 'admin.parties.playing' : 'admin.parties.paused')}{song.startedAt ? ` · ${ago(song.startedAt)}` : ''}</div>
            </div>
          </Link>
        )
        : <div className="text-sm text-white/45">{t('admin.parties.idle')}</div>}
      <div className="flex flex-wrap gap-1.5">
        {party.players.map(p => (
          <span
            key={p.username}
            title={p.signedIn ? t('admin.parties.signedIn') : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${p.connected ? 'bg-white/[0.08] text-white/90' : 'bg-white/[0.04] text-white/45'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${p.connected ? 'bg-neon-green' : 'bg-white/25'}`} aria-hidden="true" />
            {p.avatar && <Avatar username={p.username} src={p.avatar} size={16} />}
            {name(p.username)}{p.signedIn ? ' ✓' : ''}
            {p.score > 0 && <span className="font-medium tabular-nums text-neon-cyan">{p.score.toLocaleString()}</span>}
            {p.connected && p.latencyMs > 0 && <span className="tabular-nums text-white/40">{p.latencyMs} ms</span>}
          </span>
        ))}
      </div>
      <div className="text-xs text-white/45">{t('admin.parties.players', { count: online })} · {t('admin.parties.queue', { count: party.queueLength })}</div>
    </div>
  );
};

/** A count with its share of `of` next to it (no share of nothing). */
const Share = ({ n = 0, of = 0 }: { n?: number; of?: number }) => {
  const { i18n } = useTranslation();
  return (
    <>
      {n}
      {of > 0 && <span className="ml-1.5 text-sm font-normal text-white/45">{new Intl.NumberFormat(i18n.language, { style: 'percent' }).format(n / of)}</span>}
    </>
  );
};

/** A score's stars, the ones it did not reach dimmed. */
const Stars = ({ n }: { n: number }) => {
  const { t } = useTranslation();
  const label = t('feedback.stars', { n });
  return (
    <span role="img" aria-label={label} title={label} className="flex-shrink-0 text-[11px] leading-none text-amber-300">
      {'★'.repeat(n)}<span className="text-white/15">{'★'.repeat(5 - n)}</span>
    </span>
  );
};

/**
 * What an open row shows of a play: what it made at each level, the rest of
 * what is known about it, and what can be done from it.
 */
const PlayDetails = ({ play, scope, running, onNarrow }: { play: AdminPlay; scope: PlayScope; running: boolean; onNarrow: (next: PlayScope) => void }) => {
  const { t, i18n } = useTranslation();
  const levels = DIFFICULTIES.flatMap(level => {
    const score = play.levels?.[level];
    return score == null ? [] : [{ level, score }];
  });
  const facts = [
    !play.partial && play.completion != null && play.completion < 1 ? t('admin.plays.stopped', { percent: Math.round(play.completion * 100) }) : null,
    play.sungSeconds != null ? t('admin.plays.onMic', { time: formatTime(play.sungSeconds) }) : null,
    play.part != null ? t('admin.plays.duetPart', { part: play.part }) : null,
    play.pingMax != null ? t('admin.plays.worstPing', { ms: play.pingMax }) : null,
    play.country ? countryLabel(play.country, i18n.language) : null,
    new Date(play.at).toLocaleString(i18n.language),
  ].filter(Boolean);
  return (
    <div className="px-3 sm:px-4 sm:pl-[5.25rem] pt-1 pb-3.5 space-y-3">
      {/* Old plays only know the level they were sung at, which the row says already */}
      {levels.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-xs text-white/45">{t('admin.plays.atEachLevel')}</span>
          {levels.map(({ level, score }) => (
            <span key={level} className="inline-flex items-center gap-1.5 text-xs tabular-nums">
              <DifficultyTag level={level} />
              <span className={level === play.difficulty ? 'font-medium text-amber-300' : 'text-white/70'}>{score.toLocaleString()}</span>
            </span>
          ))}
        </div>
      )}
      <div className="text-xs text-white/55">{facts.join(' · ')}</div>
      <div className="flex flex-wrap gap-1.5">
        <Link to={`/sing/${play.songId}`} className={btn.quiet}>{t('admin.chartJobs.openSong')}</Link>
        {play.videoId && <a href={`https://www.youtube.com/watch?v=${play.videoId}`} target="_blank" rel="noreferrer" className={btn.quiet}>YouTube</a>}
        {play.userId != null && play.nickname && (
          <>
            <Link to={`/u/${encodeURIComponent(play.nickname)}`} className={btn.quiet}>{t('admin.plays.profile')}</Link>
            <Link to={`/admin/accounts?q=${encodeURIComponent(play.nickname)}`} className={btn.quiet}>{t('admin.plays.account')}</Link>
          </>
        )}
        {running && <Link to={`/join/${play.partyId}`} className={btn.quiet}>{t('admin.plays.joinParty')}</Link>}
        {play.partyId && !scope.party && <button type="button" onClick={() => onNarrow({ party: play.partyId ?? undefined })} className={btn.quiet}>{t('admin.plays.onlyParty')}</button>}
        {play.nickname && !scope.singer && <button type="button" onClick={() => onNarrow({ singer: { id: play.id, name: play.nickname ?? '' } })} className={btn.quiet}>{t('admin.plays.onlySinger')}</button>}
        {!scope.song && <button type="button" onClick={() => onNarrow({ song: { id: play.songId, title: play.title ?? play.songId } })} className={btn.quiet}>{t('admin.plays.onlySong')}</button>}
      </div>
    </div>
  );
};

/**
 * One song_play: who sang what, where, for how long, and what it left
 * behind; a tap opens the rest of it (PlayDetails). A name in cyan belongs to
 * an account.
 */
const PlayRow = ({ play, open, onToggle, scope, running, onNarrow }: {
  play: AdminPlay;
  open: boolean;
  onToggle: () => void;
  scope: PlayScope;
  running: boolean;
  onNarrow: (next: PlayScope) => void;
}) => {
  const { t } = useTranslation();
  const ago = useAgo();
  const name = useName();
  const device = deviceLabel(play.userAgent, play.os);
  return (
    <div className={open ? 'bg-white/[0.03]' : undefined}>
      {/* Phones: who sang and when go under the song, so the title keeps its room */}
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 px-3 sm:px-4 py-2.5 text-left hover:bg-white/[0.04] transition-colors"
      >
        <span className="relative flex-shrink-0">
          <Thumb videoId={play.videoId} />
          {play.generated && <AiBadge />}
        </span>
        <span className="block flex-1 min-w-0">
          <span className="block text-sm font-medium text-white truncate">{play.title ?? play.songId}</span>
          <span className="block text-xs text-white/55 truncate">
            {play.artist}
            {device ? <span className="text-white/35"> · {device}</span> : null}
            {play.country ? <span className="text-white/35"> · {countryFlag(play.country)}</span> : null}
          </span>
        </span>
        <span className="order-1 sm:order-none block w-full sm:w-auto pl-[4.25rem] sm:pl-0 sm:text-right sm:flex-shrink-0 min-w-0">
          <span className="flex items-center sm:justify-end gap-2 text-sm min-w-0">
            <span className="truncate min-w-0 sm:max-w-[10rem]">
              {play.nickname
                ? <span className={play.userId ? 'font-medium text-neon-cyan' : 'text-white/85'}>{name(play.nickname)}</span>
                : <span className="text-white/45">{t('admin.plays.guest')}</span>}
            </span>
            {play.score != null && (
              <>
                {play.partial
                  ? <Badge tone="yellow">{t('admin.plays.stopped', { percent: Math.round((play.completion ?? 0) * 100) })}</Badge>
                  : <Stars n={play.stars ?? 0} />}
                <span className="font-medium tabular-nums text-amber-300">{play.score.toLocaleString()}</span>
                <DifficultyTag level={play.difficulty} />
              </>
            )}
            {play.score == null && play.nickname && (
              <span className="text-xs text-white/35 whitespace-nowrap">{play.userId ? t('admin.plays.noScore') : t('admin.plays.guest')}</span>
            )}
          </span>
          <span className="block text-xs text-white/45 truncate">
            <span className={`tabular-nums ${play.seconds != null ? 'text-white/75' : 'text-white/35'}`}>{play.seconds != null ? formatTime(play.seconds) : '–:––'}</span>
            {play.ping != null ? ` · ${t('admin.ping', { ms: play.ping })}` : ''}
            {play.partyId ? ` · ${t('admin.plays.inParty', { partyId: play.partyId })}` : ''}{play.site ? ` (${play.site})` : ''} · {ago(play.at)}
          </span>
        </span>
        <DropdownChevron open={open} />
      </button>
      {open && <PlayDetails play={play} scope={scope} running={running} onNarrow={onNarrow} />}
    </div>
  );
};

/** What the list is narrowed to, as chips: a tap takes it away again. */
const ScopeChip = ({ onClear, children }: { onClear: () => void; children: React.ReactNode }) => {
  const { t } = useTranslation();
  return (
    <button type="button" aria-pressed="true" title={t('admin.plays.clearFilter')} onClick={onClear} className="chip h-8 px-3 text-[13px] max-w-full">
      <span className="truncate">{children}</span>
      <span aria-hidden="true">✕</span>
    </button>
  );
};

/** `overview`: what the page read last (null until the first answer); `reload` reads it again. */
const AdminOverviewTab = ({ overview, reload, actions }: { overview: AdminOverview | null; reload: () => Promise<void>; actions: AdminActions }) => {
  const { t, i18n } = useTranslation();
  const name = useName();
  const ago = useAgo();
  const { busy, run, say, fail } = actions;
  const [scope, setScope] = useState<PlayScope>({});
  const [scored, setScored] = useState(false);
  const [plays, setPlays] = useState<Plays | null>(null);
  const [openPlay, setOpenPlay] = useState<string | null>(null); // the row showing its details
  const listTop = useRef<HTMLDivElement>(null);

  const filter = useMemo<AdminPlayFilter>(() => ({ party: scope.party, song: scope.song?.id, singer: scope.singer?.id, scored }), [scope, scored]);
  const shown = plays?.filter === filter ? plays : null; // (a list read with the last filter is no answer to this one)

  // Read again whenever the page's counts move, so new plays and scores turn up while it is open
  const playsNow = overview?.playsDay;
  const scoresNow = overview?.scoresDay;
  useEffect(() => {
    let stale = false;
    getAdminPlays(0, PAGE, filter).then(p => {
      if (stale) return;
      const page = { rows: p.data, hasMore: p.hasMore };
      setPlays(s => ({ filter, ...(s?.filter === filter ? refreshPlays(s, page) : page) }));
    }).catch(fail);
    return () => { stale = true; };
  }, [filter, playsNow, scoresNow, fail]);

  // (the "more" button is under a loaded list: it passes it)
  const morePlays = (loaded: Plays) => run(async () => {
    const p = await getAdminPlays(loaded.rows.length, PAGE, loaded.filter);
    setPlays(s => (s?.filter === loaded.filter ? { filter: s.filter, ...appendPlays(s, { rows: p.data, hasMore: p.hasMore }) } : s));
  });

  // The row a button sat on may be far down a list about to shrink: back to the list's top
  const narrow = (next: PlayScope) => {
    setScope(s => ({ ...s, ...next }));
    setOpenPlay(null);
    listTop.current?.scrollIntoView({ block: 'nearest' });
  };
  const widen = (what: keyof PlayScope) => setScope(s => ({ ...s, [what]: undefined }));

  const runningParties = useMemo(() => new Set(overview?.parties.map(p => p.partyId)), [overview?.parties]);

  const closeParty = (party: AdminParty) => {
    if (!window.confirm(t('admin.parties.closeConfirm', { partyId: party.partyId }))) return;
    run(async () => {
      await adminCloseParty(party.partyId);
      say(t('admin.parties.closed', { partyId: party.partyId }));
      await reload();
    });
  };

  const loading = <Loading>{t('sections.loading')}</Loading>;
  const now = useMemo(() => partyNumbers(overview?.parties ?? []), [overview?.parties]);
  /** A small word after a tile's number */
  const aside = (text: string) => <span className="ml-1.5 text-sm font-normal text-white/45">{text}</span>;

  return (
    <>
      {overview?.siteProblems && overview.siteProblems.length > 0 && (
        <Notice tone="error" className="mb-4">
          <SiteProblemLines problems={overview.siteProblems} />
          <Link to="/admin/sites" className="mt-1 inline-block text-red-100 underline underline-offset-2 hover:text-white">{t('admin.sites.open')}</Link>
        </Notice>
      )}
      {!overview
        ? loading
        : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
            <StatTile label={t('admin.stats.partiesRunning')} value={overview.partiesRunning} accent="text-neon-cyan" />
            <StatTile label={t('admin.stats.playersOnline')} value={overview.playersOnline} accent="text-neon-green" />
            <StatTile label={t('admin.stats.playsDay')} value={overview.playsDay ?? 0} />
            <StatTile label={t('admin.stats.playsWeek')} value={overview.playsWeek ?? 0} />
            <StatTile label={t('admin.stats.sungDay')} value={formatDuration(overview.secondsDay, i18n.language)} small />
            <StatTile label={t('admin.stats.sungWeek')} value={formatDuration(overview.secondsWeek, i18n.language)} small />
            <StatTile label={t('admin.stats.usersTotal')} value={overview.usersTotal ?? 0} accent="text-hot" />
            <StatTile label={t('admin.stats.usersDay')} value={overview.usersDay ?? 0} />
            <StatTile label={t('admin.stats.usersWeek')} value={overview.usersWeek ?? 0} />
            <StatTile label={t('admin.stats.scoresDay')} value={overview.scoresDay ?? 0} accent="text-amber-300" />
          </div>
        )}
      {overview && (
        // The host's stem sliders: how often a party turns the singer or the band down
        <div className="mt-2 sm:mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          <StatTile label={t('admin.stats.stemPlaysWeek')} value={overview.stemPlaysWeek ?? 0} />
          <StatTile label={t('admin.stats.slidersMovedWeek')} value={<Share n={overview.slidersMovedWeek} of={overview.stemPlaysWeek} />} accent="text-neon-purple" />
          <StatTile label={t('admin.stats.vocalsDownWeek')} value={<Share n={overview.vocalsDownWeek} of={overview.stemPlaysWeek} />} />
          <Hint className="col-span-2 self-center">{t('admin.stats.slidersHint')}</Hint>
        </div>
      )}

      {overview && (
        // Right now: who is in the middle of a song (a restart would cut it off), the singers' ping, and each site's share
        <div className="mt-2 sm:mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          <StatTile label={t('admin.stats.singingNow')} value={now.singing} accent={now.singing > 0 ? 'text-neon-green' : undefined} />
          <StatTile
            label={t('admin.stats.pingDay')}
            value={overview.pingDay == null ? '–' : <>{overview.pingDay} ms{overview.pingWeek != null && aside(t('admin.stats.pingWeek', { ms: overview.pingWeek }))}</>}
          />
          {overview.sites?.map((s) => {
            const there = partyNumbers(overview.parties.filter(p => p.site === s.name));
            return (
              <StatTile
                key={s.name}
                label={t('admin.stats.site', { site: s.name })}
                accent={s.silent ? 'text-red-400' : 'text-neon-cyan'}
                warn={s.silent}
                value={s.silent
                  ? '?'
                  : <>{there.parties}{aside(t('admin.stats.siteNow', { count: there.singers }) + (there.ping !== null ? ` · ${there.ping} ms` : ''))}</>}
              />
            );
          })}
        </div>
      )}

      <Section
        title={t('admin.parties.title')}
        aside={overview && (
          <span className="text-xs text-white/40">
            {t('admin.parties.count', { count: overview.parties.length })}
            {overview.sites && ` (${overview.sites.map(s => `${s.name} ${s.silent ? '?' : s.parties}`).join(' · ')})`}
          </span>
        )}
      >
        {overview?.sites?.filter(s => s.silent).map(s => (
          <Notice key={s.name} tone="error" className="mb-3">
            {s.asOf ? t('admin.parties.siteSilent', { site: s.name, ago: ago(s.asOf) }) : t('admin.parties.siteNever', { site: s.name })}
          </Notice>
        ))}
        {!overview
          ? loading
          : overview.parties.length === 0
            ? <p className="text-sm text-white/45">{t('admin.parties.none')}</p>
            : <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{overview.parties.map(p => <PartyCard key={p.partyId} party={p} busy={busy} onClose={closeParty} />)}</div>}
      </Section>

      <Section
        title={t('admin.plays.title')}
        aside={(
          <FilterButtons
            options={['all', 'scored'] as const}
            value={scored ? 'scored' : 'all'}
            onChange={option => setScored(option === 'scored')}
            label={option => (option === 'scored' ? t('admin.plays.filterScored') : t('admin.chartJobs.filter.all'))}
          />
        )}
      >
        <Hint>{t('admin.plays.hint')}</Hint>
        <div ref={listTop} className="scroll-mt-20" />
        {(scope.party || scope.singer || scope.song) && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {scope.party && <ScopeChip onClear={() => widen('party')}>{t('admin.plays.inParty', { partyId: scope.party })}</ScopeChip>}
            {scope.singer && <ScopeChip onClear={() => widen('singer')}>{name(scope.singer.name)}</ScopeChip>}
            {scope.song && <ScopeChip onClear={() => widen('song')}>{scope.song.title}</ScopeChip>}
          </div>
        )}
        {!shown
          ? loading
          : shown.rows.length === 0
            ? <p className="text-sm text-white/45">{t(scored || scope.party || scope.singer || scope.song ? 'admin.plays.noneHere' : 'admin.plays.none')}</p>
            : (
              <div className={list}>
                {shown.rows.map(p => (
                  <PlayRow
                    key={p.id}
                    play={p}
                    open={openPlay === p.id}
                    onToggle={() => setOpenPlay(id => (id === p.id ? null : p.id))}
                    scope={scope}
                    running={p.partyId != null && runningParties.has(p.partyId)}
                    onNarrow={narrow}
                  />
                ))}
              </div>
            )}
        {shown?.hasMore && <button type="button" disabled={busy} onClick={() => morePlays(shown)} className={`${btn.quiet} mt-3`}>{t('admin.showMore')}</button>}
      </Section>
    </>
  );
};

export default AdminOverviewTab;
