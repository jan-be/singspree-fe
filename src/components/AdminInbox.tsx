import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Avatar from './Avatar';
import AdminAppSignups from './AdminAppSignups';
import AdminFeedback from './AdminFeedback';
import { btn, Section, Badge, Thumb, Hint, Loading, FilterButtons, list, useAgo, useName, type AdminActions } from './AdminParts';
import { formatTime } from '../logic/songRegions';
import { deviceLabel } from '../logic/deviceLabel';
import { getAdminReports, adminReviewReport, getAdminAvatarReports, adminReviewAvatarReport, adminRemoveAvatar } from '../logic/authApi';
import type { AdminAvatarReport, AdminSongReport, AvatarReportStatus, SongReportStatus } from '../logic/authApi';

/**
 * /admin's inbox: what people sent the admins. Song reports and reported
 * profile pictures, each settled with a button here, the addresses left for
 * the Android and iOS apps (AdminAppSignups.tsx) and the answers to "How do you
 * like SingSpree?" (AdminFeedback.tsx).
 */

/** A list of reports as the tab holds it: the rows so far, and the count per status */
type ReportsState<R, S extends string> = { rows: R[]; hasMore: boolean; counts: Record<S, number>; status: S };

const PAGE = 20;

/**
 * One song report (backend songReports.ts): the song (opens it, where Fix
 * timing is), what is wrong, the reporter's note and what their device knew
 * then, and the buttons to settle it.
 */
const ReportRow = ({ report: r, busy, onReview }: { report: AdminSongReport; busy: boolean; onReview: (r: AdminSongReport, status: SongReportStatus) => void }) => {
  const { t } = useTranslation();
  const ago = useAgo();
  const name = useName();
  const c: Partial<NonNullable<AdminSongReport['context']>> = r.context ?? {};
  const facts = [
    c.videoTime != null ? t('admin.reports.at', { time: formatTime(c.videoTime) }) : null,
    c.gap != null ? t('admin.reports.gap', { ms: Math.round(c.gap) }) : null,
    c.delayMs != null ? t(c.delaySource === 'bleed' ? 'admin.reports.delayMeasured' : 'admin.reports.delayFixed', { ms: c.delayMs }) : null,
    c.isHost != null ? (c.isHost ? t('admin.reports.host') : t('admin.reports.joiner')) : null,
    r.userAgent ? deviceLabel(r.userAgent, r.os) : null,
  ].filter(Boolean);
  return (
    <li className="px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link to={`/sing/${r.songId}`} className="flex items-center gap-3 min-w-0 rounded-xl -m-1.5 p-1.5 no-underline hover:bg-white/[0.05] transition-colors">
          <Thumb videoId={r.videoId} />
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">{r.title ?? r.songId}</div>
            <div className="text-xs text-white/55 truncate">
              {r.artist}{r.openForSong > 1 && r.status === 'open' ? <span className="text-amber-300"> · {t('admin.reports.openForSong', { count: r.openForSong })}</span> : null}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-2 flex-shrink-0">
          {r.status === 'open'
            ? (
              <>
                <button type="button" disabled={busy} onClick={() => onReview(r, 'resolved')} className={btn.primary}>{t('admin.reports.resolve')}</button>
                <button type="button" disabled={busy} onClick={() => onReview(r, 'dismissed')} className={btn.quiet}>{t('admin.reports.dismiss')}</button>
              </>
            )
            : <button type="button" disabled={busy} onClick={() => onReview(r, 'open')} className={btn.quiet}>{t('admin.reports.reopen')}</button>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {r.kinds.map(k => <Badge key={k} tone={k === 'timing' ? 'magenta' : k === 'unavailable' ? 'red' : 'yellow'}>{t(`report.kinds.${k}`)}</Badge>)}
      </div>
      {r.comment && <p className="text-sm text-white/85 whitespace-pre-line break-words">{r.comment}</p>}
      <div className="text-xs text-white/45">
        {r.username
          ? <Link to={`/u/${encodeURIComponent(r.username)}`} className="font-medium text-neon-cyan hover:text-neon-cyan hover:underline underline-offset-4">{r.username}</Link>
          : <span>{r.nickname ? name(r.nickname) : t('admin.plays.guest')}</span>}
        {r.partyId ? ` · ${t('admin.plays.inParty', { partyId: r.partyId })}` : ''} · {ago(r.updatedAt ?? r.createdAt)}
        {facts.length ? ` · ${facts.join(' · ')}` : ''}
      </div>
      {r.status !== 'open' && (
        <div className="text-xs text-white/45">
          {t(`admin.reports.was.${r.status}`, { name: r.reviewedBy ?? '?', time: r.reviewedAt ? ago(r.reviewedAt) : '' })}
          {r.adminNote ? ` — ${r.adminNote}` : ''}
        </div>
      )}
    </li>
  );
};

/**
 * One reported profile picture (backend avatarReports.ts): the picture as it
 * is now, large enough to judge, whose it is, who reported it where, and
 * Remove picture (the admin removal: it settles every open report on that
 * account) or Dismiss.
 */
const AvatarReportRow = ({ report: r, busy, onRemove, onReview }: {
  report: AdminAvatarReport; busy: boolean; onRemove: (r: AdminAvatarReport) => void; onReview: (r: AdminAvatarReport, status: 'dismissed' | 'open') => void;
}) => {
  const { t } = useTranslation();
  const ago = useAgo();
  const where = r.place === 'party'
    ? t('admin.avatarReports.inParty', { partyId: r.partyId ?? '?' })
    : r.place === 'profile' ? t('admin.avatarReports.onProfile') : null;
  const by = r.reporter ?? (r.nickname ? `${r.nickname} (${t('admin.plays.guest')})` : t('admin.plays.guest'));
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-4 py-3" data-testid="avatar-report">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar username={r.username} src={r.avatar} size={64} />
        <div className="min-w-0">
          <Link to={`/u/${encodeURIComponent(r.username)}`} className="text-white hover:text-white hover:underline decoration-white/30 underline-offset-4 font-semibold truncate">{r.username}</Link>
          {r.openForUser > 1 && r.status === 'open' && <span className="text-xs text-amber-300"> · {t('admin.avatarReports.openForUser', { count: r.openForUser })}</span>}
          <div className="text-xs text-white/55">
            {t('admin.avatarReports.by', { name: by })}{where ? ` · ${where}` : ''} · {ago(r.createdAt)}
          </div>
          {!r.stillCurrent && <div className="text-xs text-white/45">{r.avatar ? t('admin.avatarReports.replaced') : t('admin.avatarReports.gone')}</div>}
          {r.status !== 'open' && <div className="text-xs text-white/45">{t(`admin.avatarReports.was.${r.status}`, { name: r.reviewedBy ?? '?', time: r.reviewedAt ? ago(r.reviewedAt) : '' })}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {r.status === 'open' ? (
          <>
            {r.avatar && <button type="button" disabled={busy} onClick={() => onRemove(r)} className={btn.danger}>{t('admin.users.removeAvatar')}</button>}
            <button type="button" disabled={busy} onClick={() => onReview(r, 'dismissed')} className={btn.quiet}>{t('admin.avatarReports.dismiss')}</button>
          </>
        ) : r.status === 'dismissed' && <button type="button" disabled={busy} onClick={() => onReview(r, 'open')} className={btn.quiet}>{t('admin.avatarReports.reopen')}</button>}
      </div>
    </li>
  );
};

/**
 * `openReports` / `openAvatarReports`: the overview's counts of open ones,
 * which the page reads every few seconds; when one differs from the list's,
 * that list is read again, so new reports show up by themselves.
 */
const AdminInbox = ({ openReports, openAvatarReports, waitingTesters, iosSignups, actions }: {
  openReports: number | undefined; openAvatarReports: number | undefined; waitingTesters: number | undefined; iosSignups: number | undefined; actions: AdminActions;
}) => {
  const { t } = useTranslation();
  const { busy, run, say, fail } = actions;

  // Song reports: the open ones by default
  const [reportStatus, setReportStatus] = useState<SongReportStatus>('open');
  const [reports, setReports] = useState<ReportsState<AdminSongReport, SongReportStatus> | null>(null); // { rows, hasMore, counts }
  const loadReports = useCallback((status: SongReportStatus) => getAdminReports(status, 0, PAGE)
    .then(p => setReports({ rows: p.data, hasMore: p.hasMore, counts: p.counts, status }))
    .catch(fail), [fail]);
  useEffect(() => { setReports(null); loadReports(reportStatus); }, [reportStatus, loadReports]);
  useEffect(() => {
    if (openReports == null || !reports || reports.counts?.open === openReports) return;
    loadReports(reportStatus);
  }, [openReports]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reported profile pictures, the same way
  const [avatarReportStatus, setAvatarReportStatus] = useState<AvatarReportStatus>('open');
  const [avatarReports, setAvatarReports] = useState<ReportsState<AdminAvatarReport, AvatarReportStatus> | null>(null); // { rows, hasMore, counts }
  const loadAvatarReports = useCallback((status: AvatarReportStatus) => getAdminAvatarReports(status, 0, PAGE)
    .then(p => setAvatarReports({ rows: p.data, hasMore: p.hasMore, counts: p.counts, status }))
    .catch(fail), [fail]);
  useEffect(() => { setAvatarReports(null); loadAvatarReports(avatarReportStatus); }, [avatarReportStatus, loadAvatarReports]);
  useEffect(() => {
    if (openAvatarReports == null || !avatarReports || avatarReports.counts?.open === openAvatarReports) return;
    loadAvatarReports(avatarReportStatus);
  }, [openAvatarReports]); // eslint-disable-line react-hooks/exhaustive-deps

  // (the "more" buttons are under a loaded list: they pass it)
  const moreReports = (loaded: ReportsState<AdminSongReport, SongReportStatus>) => run(async () => {
    const p = await getAdminReports(reportStatus, loaded.rows.length, PAGE);
    setReports(s => s && { ...s, rows: [...s.rows, ...p.data], hasMore: p.hasMore, counts: p.counts });
  });
  const reviewReport = (r: AdminSongReport, status: SongReportStatus) => run(async () => {
    await adminReviewReport(r.id, status);
    say(t(`admin.reports.marked.${status}`, { title: r.title ?? r.songId }));
    await loadReports(reportStatus);
  });

  const moreAvatarReports = (loaded: ReportsState<AdminAvatarReport, AvatarReportStatus>) => run(async () => {
    const p = await getAdminAvatarReports(avatarReportStatus, loaded.rows.length, PAGE);
    setAvatarReports(s => s && { ...s, rows: [...s.rows, ...p.data], hasMore: p.hasMore, counts: p.counts });
  });
  const reviewAvatarReport = (r: AdminAvatarReport, status: 'dismissed' | 'open') => run(async () => {
    await adminReviewAvatarReport(r.id, status);
    say(t(`admin.avatarReports.marked.${status}`, { username: r.username }));
    await loadAvatarReports(avatarReportStatus);
  });
  const removeReportedAvatar = (r: AdminAvatarReport) => {
    if (!window.confirm(t('admin.users.removeAvatarConfirm', { username: r.username }))) return;
    run(async () => {
      await adminRemoveAvatar(r.userId);
      say(t('admin.users.avatarRemoved', { username: r.username }));
      await loadAvatarReports(avatarReportStatus);
    });
  };

  const loading = <Loading>{t('sections.loading')}</Loading>;

  return (
    <>
      <Section
        title={t('admin.reports.title')}
        aside={(
          <FilterButtons
            options={['open', 'resolved', 'dismissed']}
            value={reportStatus}
            onChange={setReportStatus}
            label={s => t(`admin.reports.status.${s}`)}
            counts={reports?.counts}
          />
        )}
      >
        <Hint>{t('admin.reports.hint')}</Hint>
        {!reports
          ? loading
          : (
            <ul className={list}>
              {reports.rows.length === 0 && <li className="px-4 py-3 text-sm text-white/45">{t('admin.reports.none')}</li>}
              {reports.rows.map(r => <ReportRow key={r.id} report={r} busy={busy} onReview={reviewReport} />)}
            </ul>
          )}
        {reports?.hasMore && <button type="button" disabled={busy} onClick={() => moreReports(reports)} className={`${btn.quiet} mt-3`}>{t('admin.showMore')}</button>}
      </Section>

      <Section
        title={t('admin.avatarReports.title')}
        aside={(
          <FilterButtons
            options={['open', 'removed', 'dismissed']}
            value={avatarReportStatus}
            onChange={setAvatarReportStatus}
            label={s => t(`admin.avatarReports.status.${s}`)}
            counts={avatarReports?.counts}
          />
        )}
      >
        <Hint>{t('admin.avatarReports.hint')}</Hint>
        {!avatarReports
          ? loading
          : (
            <ul className={list}>
              {avatarReports.rows.length === 0 && <li className="px-4 py-3 text-sm text-white/45">{t('admin.reports.none')}</li>}
              {avatarReports.rows.map(r => <AvatarReportRow key={r.id} report={r} busy={busy} onRemove={removeReportedAvatar} onReview={reviewAvatarReport} />)}
            </ul>
          )}
        {avatarReports?.hasMore && <button type="button" disabled={busy} onClick={() => moreAvatarReports(avatarReports)} className={`${btn.quiet} mt-3`}>{t('admin.showMore')}</button>}
      </Section>

      <AdminAppSignups platform="android" count={waitingTesters} actions={actions} />

      <AdminAppSignups platform="ios" count={iosSignups} actions={actions} />

      <AdminFeedback onError={fail} />
    </>
  );
};

export default AdminInbox;
