import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StarRating from './StarRating';
import { getAdminFeedback, type AdminFeedback as Answer, type FeedbackFilter, type FeedbackGroup, type FeedbackSummary } from '../logic/authApi';
import { timeAgo } from '../logic/timeAgo';
import { deviceLabel } from '../logic/deviceLabel';
import { DEVICE_KINDS } from '../logic/deviceRows';
import { FilterButtons, Hint, Loading, Section, StatTile, btn, countryLabel, list, panel } from './AdminParts';

/**
 * The admin page's feedback (backend feedback.ts, GET /admin/feedback): how
 * people answered "How do you like SingSpree?" (FeedbackPrompt.tsx) in a
 * window — the average, how the stars spread, the average per role, device,
 * language and songs sung before — and the answers themselves, newest first,
 * filtered by stars or to those with a comment.
 */
const DAYS = [30, 365, 0];
const FILTERS: FeedbackFilter[] = ['all', 'comments', '5', '4', '3', '2', '1'];
const PAGE = 20;

type Loaded = { rows: Answer[]; hasMore: boolean };

const card = `${panel} p-4 min-w-0`;
const cardLabel = 'pop-label mb-3';

/** A language code's name in the page's language ("de" → "Deutsch") */
const languageName = (code: string, lang: string) => {
  try { return new Intl.DisplayNames([lang], { type: 'language' }).of(code) ?? code; } catch { return code; }
};

/** Rows of a group with their count and average stars, the bar being the share of the biggest group */
const GroupList = ({ title, groups, label }: { title: string; groups: FeedbackGroup[]; label: (key: string) => string }) => {
  const { t, i18n } = useTranslation();
  if (!groups.length) return null;
  const max = Math.max(1, ...groups.map(g => g.count));
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-white/55 mb-1.5">{title}</div>
      <ul className="space-y-1">
        {groups.map(g => (
          <li key={g.key} className="relative rounded-lg overflow-hidden px-2.5 py-1">
            <div className="absolute inset-y-0 left-0 rounded-lg bg-violet-300/[0.13]" style={{ width: `${(g.count / max) * 100}%` }} aria-hidden="true" />
            <div className="relative flex items-center justify-between gap-3 text-sm">
              <span className="truncate min-w-0 text-white/90">{label(g.key)}</span>
              <span className="text-xs text-white/70 flex-shrink-0 tabular-nums whitespace-nowrap">
                {t('admin.feedback.groupLine', { count: g.count, average: g.average.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** One answer: the stars, the words, and who answered where */
const AnswerRow = ({ answer: a }: { answer: Answer }) => {
  const { t, i18n } = useTranslation();
  const c = a.context ?? {};
  const facts = [
    c.songs != null ? t('admin.feedback.songs', { count: c.songs }) : null,
    c.host != null ? t(`admin.feedback.role.${c.host ? 'host' : 'joiner'}`) : null,
    a.userAgent ? deviceLabel(a.userAgent, a.os) : null,
    c.lang ? languageName(c.lang, i18n.language) : null,
    a.country ? countryLabel(a.country, i18n.language) : null,
    c.page === 'home' ? t('admin.feedback.home') : null,
    (c.shown ?? 0) > 1 ? t('admin.feedback.askedTimes', { count: c.shown }) : null,
  ].filter(Boolean);
  return (
    <li className="px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <StarRating stars={a.rating} size={15} label={t('feedback.stars', { n: a.rating })} />
        <span className="text-xs text-white/40 whitespace-nowrap">{timeAgo(a.createdAt, { lang: i18n.language })}</span>
      </div>
      {a.comment
        ? <p className="text-sm text-white/85 whitespace-pre-line break-words">{a.comment}</p>
        : <p className="text-xs text-white/35 italic">{t('admin.feedback.noComment')}</p>}
      <div className="text-xs text-white/45">
        {a.username
          ? <Link to={`/u/${encodeURIComponent(a.username)}`} className="font-medium text-neon-cyan hover:text-neon-cyan hover:underline underline-offset-4">{a.username}</Link>
          : <span>{a.nickname ?? t('admin.plays.guest')}</span>}
        {a.partyId ? ` · ${t('admin.plays.inParty', { partyId: a.partyId })}` : ''}
        {facts.length ? ` · ${facts.join(' · ')}` : ''}
      </div>
    </li>
  );
};

const AdminFeedback = ({ onError = () => {} }: { onError?: (e: unknown) => void }) => {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState(0);
  const [filter, setFilter] = useState<FeedbackFilter>('all');
  const [data, setData] = useState<Loaded | null>(null);
  const [s, setSummary] = useState<FeedbackSummary | null>(null); // (kept while another filter of the list loads)
  const [busy, setBusy] = useState(false);

  useEffect(() => { setSummary(null); }, [days]);
  useEffect(() => {
    let active = true;
    setData(null);
    getAdminFeedback(days, filter, 0, PAGE)
      .then(p => { if (active) { setData({ rows: p.data, hasMore: p.hasMore }); setSummary(p.summary); } })
      .catch(e => { if (active) onError(e); });
    return () => { active = false; };
  }, [days, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const more = async (loaded: Loaded) => {
    setBusy(true);
    try {
      const p = await getAdminFeedback(days, filter, loaded.rows.length, PAGE);
      setData(d => d && { ...d, rows: [...d.rows, ...p.data], hasMore: p.hasMore });
    } catch (e) { onError(e); } finally { setBusy(false); }
  };

  const fmt = (n: number, digits = 0) => n.toLocaleString(i18n.language, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const counts: Partial<Record<FeedbackFilter, number>> | null = s
    ? { all: s.count, comments: s.withComment, ...Object.fromEntries(s.distribution.map((n, i) => [String(i + 1), n])) }
    : null;
  const maxStars = Math.max(1, ...(s?.distribution ?? []));
  const device = (key: string) => (DEVICE_KINDS.includes(key) ? t(`admin.devices.kind.${key}`) : key === 'unknown' ? t('admin.devices.notRecorded') : t('admin.devices.other'));

  return (
    <Section
      title={t('admin.feedback.title')}
      aside={<FilterButtons options={DAYS} value={days} onChange={setDays} label={d => (d ? t('admin.origins.days', { count: d }) : t('admin.feedback.allTime'))} />}
    >
      <Hint>{t('admin.feedback.hint')}</Hint>
      {!s ? <Loading>{t('sections.loading')}</Loading> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <StatTile label={t('admin.feedback.answers')} value={fmt(s.count)} accent="text-hot" />
            <StatTile label={t('admin.feedback.average')} value={s.average == null ? '–' : `${fmt(s.average, 2)} ★`} accent="text-amber-300" />
            <StatTile label={t('admin.feedback.positive')} value={s.count ? `${fmt((100 * (s.distribution[3] + s.distribution[4])) / s.count)} %` : '–'} />
            <StatTile label={t('admin.feedback.withComment')} value={fmt(s.withComment)} />
          </div>

          {s.count > 0 && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 mt-3">
              <div className={card}>
                <div className={cardLabel}>{t('admin.feedback.spread')}</div>
                <ul className="space-y-1" data-feedback-spread="">
                  {[5, 4, 3, 2, 1].map(n => {
                    const count = s.distribution[n - 1];
                    return (
                      <li key={n} className="flex items-center gap-3 text-sm" title={`${t('feedback.stars', { n })}: ${fmt(count)}`}>
                        <span className="w-9 flex-shrink-0 text-white/80 tabular-nums">{n} ★</span>
                        <span className="relative flex-1 h-5 rounded-md bg-white/[0.04] overflow-hidden" aria-hidden="true">
                          <span className="absolute inset-y-0 left-0 rounded-md bg-amber-300/60" style={{ width: `${(count / maxStars) * 100}%` }} />
                        </span>
                        <span className="w-20 flex-shrink-0 text-right text-xs text-white/70 tabular-nums whitespace-nowrap">
                          {fmt(count)} <span className="text-white/40">· {fmt((100 * count) / s.count)} %</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className={`${card} grid grid-cols-1 sm:grid-cols-2 gap-4`}>
                <GroupList title={t('admin.feedback.byRole')} groups={s.byRole} label={k => t(`admin.feedback.role.${k}`)} />
                <GroupList title={t('admin.feedback.byDevice')} groups={s.byDevice} label={device} />
                <GroupList title={t('admin.feedback.byLanguage')} groups={s.byLanguage} label={k => languageName(k, i18n.language)} />
                <GroupList title={t('admin.feedback.bySongs')} groups={s.bySongs} label={k => t('admin.feedback.band', { band: k })} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-6 mb-3">
        <FilterButtons
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          label={f => (f === 'all' || f === 'comments' ? t(`admin.feedback.filter.${f}`) : t('admin.feedback.filter.stars', { n: f }))}
          counts={counts}
        />
      </div>
      {s && !data && <Loading>{t('sections.loading')}</Loading>}
      {data && (
        <ul className={list}>
          {data.rows.length === 0 && <li className="px-4 py-3 text-sm text-white/45">{t('admin.feedback.none')}</li>}
          {data.rows.map(a => <AnswerRow key={a.id} answer={a} />)}
        </ul>
      )}
      {data?.hasMore && <button type="button" disabled={busy} onClick={() => more(data)} className={`${btn.quiet} mt-3`}>{t('admin.showMore')}</button>}
    </Section>
  );
};

export default AdminFeedback;
