import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Avatar from './Avatar';
import { btn, StatTile, Section, Badge, Thumb, Hint, Loading, panel, list, useAgo, useName, type AdminActions } from './AdminParts';
import { formatDuration } from '../logic/duration';
import { formatTime } from '../logic/songRegions';
import { deviceLabel } from '../logic/deviceLabel';
import { getAdminPlays, adminCloseParty } from '../logic/authApi';
import type { AdminOverview, AdminParty, AdminPlay } from '../logic/authApi';

/**
 * /admin's first tab: today's and this week's numbers, the parties running
 * right now (the page reads them every few seconds) and the songs sung last.
 */

const PAGE = 20;

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
            {!party.hostConnected && <Badge tone="red">{party.hostAway ? t('admin.parties.hostAway') : t('admin.parties.hostGone')}</Badge>}
          </div>
          <div className="text-xs text-white/55 truncate mt-0.5">{t('admin.parties.host', { username: name(party.owner) })} · {ago(party.createdAt)}</div>
        </div>
        <button type="button" disabled={busy} onClick={() => onClose(party)} className={btn.danger}>{t('admin.parties.close')}</button>
      </div>
      {song
        ? (
          <Link to={`/sing/${song.songId}`} className="flex items-center gap-3 rounded-xl -mx-2 px-2 py-1.5 no-underline hover:bg-white/[0.05] transition-colors">
            <Thumb videoId={song.videoId} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white truncate">{song.title}</div>
              <div className="text-xs text-white/55 truncate">{song.artist} · {song.isPlaying ? t('admin.parties.playing') : t('admin.parties.paused')}{song.startedAt ? ` · ${ago(song.startedAt)}` : ''}</div>
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

/**
 * One song_play: who sang what, where, for how long, and what it left
 * behind. A name in cyan belongs to an account; a guest's is grey with a
 * tag, since a guest can never leave a score.
 */
const PlayRow = ({ play }: { play: AdminPlay }) => {
  const { t } = useTranslation();
  const ago = useAgo();
  const name = useName();
  const device = deviceLabel(play.userAgent, play.os);
  return (
    // Phones: who sang and when go under the song, so the title keeps its room
    <Link to={`/sing/${play.songId}`} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 px-3 sm:px-4 py-2.5 no-underline hover:bg-white/[0.04] transition-colors">
      <Thumb videoId={play.videoId} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{play.title ?? play.songId}</div>
        <div className="text-xs text-white/55 truncate">{play.artist}{device ? <span className="text-white/35"> · {device}</span> : null}</div>
      </div>
      <div className="w-full sm:w-auto pl-[4.25rem] sm:pl-0 sm:text-right sm:flex-shrink-0 min-w-0">
        <div className="text-sm truncate sm:max-w-[14rem]">
          {play.nickname
            ? <span className={play.userId ? 'font-medium text-neon-cyan' : 'text-white/85'}>{name(play.nickname)}</span>
            : <span className="text-white/45">{t('admin.plays.guest')}</span>}
          {play.score != null && <span className="font-medium tabular-nums text-amber-300 ml-2">{play.score.toLocaleString()}</span>}
          {play.score == null && play.nickname && (
            <span className="text-xs text-white/35 ml-2">{play.userId ? t('admin.plays.noScore') : t('admin.plays.guest')}</span>
          )}
        </div>
        <div className="text-xs text-white/45">
          <span className={`tabular-nums ${play.seconds != null ? 'text-white/75' : 'text-white/35'}`}>{play.seconds != null ? formatTime(play.seconds) : '–:––'}</span>
          {play.ping != null ? ` · ${t('admin.ping', { ms: play.ping })}` : ''}
          {play.partyId ? ` · ${t('admin.plays.inParty', { partyId: play.partyId })}` : ''} · {ago(play.at)}
        </div>
      </div>
    </Link>
  );
};

/** `overview`: what the page read last (null until the first answer); `reload` reads it again. */
const AdminOverviewTab = ({ overview, reload, actions }: { overview: AdminOverview | null; reload: () => Promise<void>; actions: AdminActions }) => {
  const { t, i18n } = useTranslation();
  const { busy, run, say, fail } = actions;
  const [plays, setPlays] = useState<{ rows: AdminPlay[]; hasMore: boolean } | null>(null); // { rows, hasMore }

  useEffect(() => {
    getAdminPlays(0, PAGE).then(p => setPlays({ rows: p.data, hasMore: p.hasMore })).catch(fail);
  }, [fail]);

  // (the "more" button is under a loaded list: it passes it)
  const morePlays = (loaded: { rows: AdminPlay[] }) => run(async () => {
    const p = await getAdminPlays(loaded.rows.length, PAGE);
    setPlays(s => s && { rows: [...s.rows, ...p.data], hasMore: p.hasMore });
  });

  const closeParty = (party: AdminParty) => {
    if (!window.confirm(t('admin.parties.closeConfirm', { partyId: party.partyId }))) return;
    run(async () => {
      await adminCloseParty(party.partyId);
      say(t('admin.parties.closed', { partyId: party.partyId }));
      await reload();
    });
  };

  const loading = <Loading>{t('sections.loading')}</Loading>;

  return (
    <>
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

      <Section title={t('admin.parties.title')} aside={overview && <span className="text-xs text-white/40">{t('admin.parties.count', { count: overview.parties.length })}</span>}>
        {!overview
          ? loading
          : overview.parties.length === 0
            ? <p className="text-sm text-white/45">{t('admin.parties.none')}</p>
            : <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{overview.parties.map(p => <PartyCard key={p.partyId} party={p} busy={busy} onClose={closeParty} />)}</div>}
      </Section>

      <Section title={t('admin.plays.title')}>
        <Hint>{t('admin.plays.hint')}</Hint>
        {!plays
          ? loading
          : plays.rows.length === 0
            ? <p className="text-sm text-white/45">{t('admin.plays.none')}</p>
            : <div className={list}>{plays.rows.map(p => <PlayRow key={p.id} play={p} />)}</div>}
        {plays?.hasMore && <button type="button" disabled={busy} onClick={() => morePlays(plays)} className={`${btn.quiet} mt-3`}>{t('admin.showMore')}</button>}
      </Section>
    </>
  );
};

export default AdminOverviewTab;
