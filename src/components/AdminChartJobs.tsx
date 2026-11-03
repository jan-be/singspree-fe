import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ChartJobProgress from './ChartJobProgress';
import { Badge, FilterButtons, Hint, Loading, Notice, Section, StatTile, Thumb, btn, list as listClass, panel } from './AdminParts';
import { timeAgo } from '../logic/timeAgo';
import { formatDuration } from '../logic/duration';
import { formatTime } from '../logic/songRegions';
import { forgetChartAccess } from '../logic/chartJobs';
import { ACCESS_LEVELS, JOB_FILTERS, ROUTES, STATUS_TONE, busyReason, errorKey, gigabytes, jobTimes, qaReason, whyKey } from '../logic/chartJobAdmin';
import { adminSetChartAccess, adminSetChartRoute, getAdminChartAccess, getAdminChartGenerators, getAdminChartJobs } from '../logic/authApi';
import { errorMessage } from '../pages/AuthPage';
import type { AdminChartJob, ChartAccessState, ChartJobLimits, ChartJobStats, GeneratorState } from '../logic/authApi';
import type { ChartAccessLevel, ChartRoute, JobFilter } from '../logic/chartJobAdmin';

/** A job as the list holds it: with when this copy came (ChartJobProgress moves on from there) */
type ListedJob = AdminChartJob & { receivedAt: number };

/**
 * /admin's AI karaoke charts (backend chartJobs.ts, GET /admin/chart-jobs):
 * the switch for who may have them made, the numbers, and every job with who
 * asked, how far it got and what became of it.
 *
 * active: the overview's count of unfinished jobs, which AdminPage polls every
 * few seconds anyway. While it is above zero the list follows the running
 * jobs every REFRESH_MS (their progress and times move); when it changes (a
 * job asked for, one finished) the list is read again. An idle list costs no
 * requests at all.
 */

const REFRESH_MS = 5000;
const GENERATORS_MS = 10_000; // the PC's load, while the tab is visible
const PAGE = 20;
const MAX_ROWS = 100; // the backend's page limit: a refresh reads the rows on screen again, up to this many
const UNFINISHED = new Set(['queued', 'downloading', 'generating']);

const useAgo = () => {
  const { i18n } = useTranslation();
  return (d: string) => timeAgo(d, { lang: i18n.language });
};

/** The QA gate's verdicts in their colours; another one in white */
const VERDICT_TONE: Record<string, string> = { publish: 'text-emerald-300', beta: 'text-amber-300', hold: 'text-red-300' };

const compact = (n: number, lang: string) => {
  try { return new Intl.NumberFormat(lang, { notation: 'compact' }).format(n); } catch { return String(n); }
};

// The level switched on: off in a soft red, the two "on" levels in the sign's gradient
const LEVEL_TONE: Record<ChartAccessLevel, string> = {
  off: 'bg-red-500/20 text-red-200',
  admins: 'fill-hot',
  everyone: 'fill-hot',
};

/** Off / Admins only / Everyone signed in, with who switched it last (or what applies while nobody has) */
const AccessSwitch = ({ state, limits, busy, onSwitch }: {
  state: ChartAccessState; limits: ChartJobLimits | undefined; busy: boolean; onSwitch: (level: ChartAccessLevel) => void;
}) => {
  const { t } = useTranslation();
  const ago = useAgo();
  const level = (l: ChartAccessLevel) =>t(`admin.chartJobs.access.levels.${l}`);
  return (
    <div className={`${panel} p-4 space-y-2`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="pop-label">{t('admin.chartJobs.access.title')}</div>
        <div role="radiogroup" aria-label={t('admin.chartJobs.access.title')} className="flex flex-wrap max-w-full gap-0.5 rounded-[21px] bg-white/[0.06] border border-white/10 p-1">
          {ACCESS_LEVELS.map(l => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={state.access === l}
              disabled={busy}
              onClick={() => onSwitch(l)}
              className={`h-8 px-3 sm:px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                state.access === l ? LEVEL_TONE[l] : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            >
              {level(l)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-white/80">{t(`admin.chartJobs.access.explain.${state.access}`, { perUser: limits?.userDaily ?? '?', daily: limits?.daily ?? '?' })}</p>
      <p className="text-xs text-white/45">
        {state.stored
          ? t('admin.chartJobs.access.setBy', { level: level(state.stored.access), name: state.stored.updatedBy ?? t('admin.chartJobs.deletedAccount'), time: ago(state.stored.updatedAt) })
          : t(`admin.chartJobs.access.fallback.${state.fallback.from}`, { level: level(state.fallback.access) })}
      </p>
      {!state.generator && <p className="text-xs text-amber-300">{t('admin.chartJobs.access.noGenerator')}</p>}
    </div>
  );
};

/** A GPU's name without the maker's words ("NVIDIA GeForce RTX 4060" -> "RTX 4060") */
const shortGpu = (name: string | null | undefined) => (name ?? '').replace(/^NVIDIA\s+/i, '').replace(/^(GeForce|Tesla)\s+/i, '').replace(/\s+Blackwell.*$/i, '');

const money = (dollars: number, lang: string) => dollars.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Where songs are made (backend chartGenerators.ts): the switch (PC first,
 * then Modal / PC only / Modal only), the PC now — free, busy and why, or
 * unreachable — with what it measures, this month's songs per generator with
 * Modal's estimated cost, and where a song asked for now would go.
 */
const GeneratorPanel = ({ state, month, busy, onSwitch }: {
  state: GeneratorState; month: ChartJobStats['month'] | undefined; busy: boolean; onSwitch: (route: ChartRoute) => void;
}) => {
  const { t, i18n } = useTranslation();
  const ago = useAgo();
  const lang = i18n.language;
  const routeName = (r: ChartRoute) => t(`admin.chartJobs.generators.routes.${r}`);
  const pc = state.pc;
  const load = pc?.load;
  const pcState = !state.configured.pc ? 'none' : !pc?.reachable ? 'offline' : pc.reasons.length ? 'busy' : 'free';
  const tone = { free: 'green', busy: 'yellow', offline: 'red', none: 'gray' } as const;
  const facts = load ? [
    load.gpu?.util != null && t('admin.chartJobs.generators.load.gpu', { util: Math.round(load.gpu.util) }),
    load.gpu && t('admin.chartJobs.generators.load.gpuMem', { used: gigabytes(load.gpu.mem_used_mb, lang), total: gigabytes(load.gpu.mem_total_mb, lang), others: gigabytes(load.gpu.others_mb, lang) }),
    load.host?.cpu != null && t('admin.chartJobs.generators.load.cpu', { cpu: Math.round(load.host.cpu) }),
    load.host?.mem_avail_mb != null && t('admin.chartJobs.generators.load.ram', { free: gigabytes(load.host.mem_avail_mb, lang) }),
  ].filter(Boolean) : [];
  const next = state.next;
  return (
    <div className={`${panel} p-4 space-y-2 mt-3`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="pop-label">{t('admin.chartJobs.generators.title')}</div>
        <div role="radiogroup" aria-label={t('admin.chartJobs.generators.title')} className="flex flex-wrap max-w-full gap-0.5 rounded-[21px] bg-white/[0.06] border border-white/10 p-1">
          {ROUTES.map(r => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={state.route === r}
              disabled={busy}
              onClick={() => onSwitch(r)}
              className={`h-8 px-3 sm:px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                state.route === r ? 'fill-hot' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            >
              {routeName(r)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-white/80">{t(`admin.chartJobs.generators.explain.${state.route}`, { gpu: state.limits.gpuUtil, cpu: state.limits.cpu })}</p>

      <div className="rounded-xl bg-white/[0.04] px-3 py-2.5 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-white">{t('admin.chartJobs.generators.pc')}</span>
          <Badge tone={tone[pcState]}>{t(`admin.chartJobs.generators.state.${pcState}`)}</Badge>
          {pc && pc.ours > 0 && <span className="text-xs text-white/55">{t('admin.chartJobs.generators.load.ours', { count: pc.ours })}</span>}
        </div>
        {!state.configured.pc && <p className="text-xs text-white/55">{t('admin.chartJobs.generators.notSetUp.pc')}</p>}
        {pc && pc.reasons.length > 0 && (
          <ul className="space-y-0.5 pl-4 list-disc marker:text-white/25 text-xs text-amber-200/90">
            {pc.reasons.map((r, i) => { const w = busyReason(r, lang); return <li key={i}>{t(`admin.chartJobs.generators.busy.${w.key}`, w.values)}</li>; })}
          </ul>
        )}
        {pc && !pc.reachable && pc.error && <p className="text-xs text-white/40 break-words">{pc.error}</p>}
        {facts.length > 0 && <p className="text-xs text-white/55">{facts.join(' · ')}</p>}
        {load && !load.host && <p className="text-xs text-white/40">{t('admin.chartJobs.generators.load.noHost')}</p>}
      </div>

      <div className="rounded-xl bg-white/[0.04] px-3 py-2.5 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-white">{t('admin.chartJobs.generators.modal')}</span>
        <Badge tone={state.configured.modal ? 'cyan' : 'gray'}>{t(`admin.chartJobs.generators.state.${state.configured.modal ? 'ready' : 'none'}`)}</Badge>
        {!state.configured.modal && <span className="text-xs text-white/55">{t('admin.chartJobs.generators.notSetUp.modal')}</span>}
      </div>

      {month && (
        <p className="text-sm text-white/80">
          {t('admin.chartJobs.generators.month', {
            pc: t('admin.chartJobs.generators.songs', { count: month.pc.jobs }),
            modal: t('admin.chartJobs.generators.songs', { count: month.modal.jobs }),
            cost: money(month.modal.cost, lang),
          })}
        </p>
      )}
      {next && (
        <p className="text-xs text-white/55">
          {t('admin.chartJobs.generators.next', { where: t(`admin.chartJobs.generators.nextWhere.${next.gen ?? 'wait'}`) })}
          {whyKey(next.why) ? ` (${t(`admin.chartJobs.generators.why.${whyKey(next.why)}`)})` : ''}
        </p>
      )}
      <p className="text-xs text-white/45">
        {state.stored
          ? t('admin.chartJobs.generators.setBy', { route: routeName(state.stored.route), name: state.stored.updatedBy ?? t('admin.chartJobs.deletedAccount'), time: ago(state.stored.updatedAt) })
          : t(`admin.chartJobs.generators.fallback.${state.fallback.from}`, { route: routeName(state.fallback.route) })}
      </p>
    </div>
  );
};

/** Who or what asked for a job: the account (a link), a deleted one, or the catalogue's batch */
const Origin = ({ job }: { job: AdminChartJob }) => {
  const { t } = useTranslation();
  if (job.username) {
    return <Link to={`/u/${encodeURIComponent(job.username)}`} className="font-medium text-neon-cyan hover:text-neon-cyan hover:underline underline-offset-2">{job.username}</Link>;
  }
  if (job.origin === 'batch' || job.origin === 'batch_pc') return <span className="text-white/70">{t(`admin.chartJobs.origin.${job.origin}`)}</span>;
  return <span>{t('admin.chartJobs.deletedAccount')}</span>;
};

/** Where a job ran, in words: "on Modal (L4) · ≈ $0.03 · the PC was busy: GPU 88 %"; null before it was sent */
const useWhereWords = () => {
  const { t, i18n } = useTranslation();
  return (job: AdminChartJob) => {
    if (!job.generator) return null;
    const gen = job.gen;
    const gpu = shortGpu(gen?.gpu);
    const parts = [t(`admin.chartJobs.generators.where.${job.generator}`) + (gpu ? ` (${gpu})` : '')];
    if (gen?.cost != null) parts.push(t('admin.chartJobs.generators.cost', { cost: money(gen.cost, i18n.language) }));
    const why = whyKey(gen?.why);
    // why it went there when that is news: not for a free PC or the only generator
    if (why && !['pc_free', 'only_pc', 'only_modal'].includes(why)) {
      const first = gen?.reasons[0];
      const detail = first && first.code !== 'offline' ? `: ${t(`admin.chartJobs.generators.busyShort.${first.code}`, busyReason(first, i18n.language).values)}` : '';
      parts.push(t(`admin.chartJobs.generators.why.${why}`) + detail);
    }
    if (gen?.retried) {
      parts.push(t('admin.chartJobs.generators.retried', { gen: t(`admin.chartJobs.generators.${gen.retried.gen}`),
        error: t(`admin.chartJobs.errors.${errorKey(gen.retried.code)}`, { duration: '?', max: '?' }) }));
    }
    return parts.join(' · ');
  };
};

/** What became of a job: the QA gate's verdict with its reasons, or why it failed, in words */
const Outcome = ({ job, limits }: { job: AdminChartJob; limits: ChartJobLimits | undefined }) => {
  const { t } = useTranslation();
  if (job.status === 'failed') {
    return (
      <p className="text-sm text-red-300">
        {t(`admin.chartJobs.errors.${errorKey(job.error)}`, {
          duration: job.durationS ? formatTime(job.durationS) : '?', max: limits?.maxSeconds ? formatTime(limits.maxSeconds) : '?',
        })}
      </p>
    );
  }
  const qa = job.qa;
  if (!qa?.decision) return null;
  const tone = VERDICT_TONE[qa.decision] ?? 'text-white/75';
  const reasons = (qa.reasons ?? []).map(qaReason);
  return (
    <div className="text-sm">
      <span className={tone}>{t(`admin.chartJobs.verdict.${qa.decision}`, { defaultValue: qa.decision })}</span>
      {qa.predicted != null && <span className="text-white/45"> · {t('admin.chartJobs.predicted', { score: Number(qa.predicted).toFixed(2) })}</span>}
      {reasons.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 pl-4 list-disc marker:text-white/25 text-xs text-white/60">
          {reasons.map((r, i) => <li key={i}>{r.key ? t(`admin.chartJobs.reasons.${r.key}`, r.values) : r.text}</li>)}
        </ul>
      )}
    </div>
  );
};

/**
 * One job: the video (opens the song once there is one, else the video on
 * YouTube), its state, live progress while it runs, the outcome, who asked,
 * and how long it waited for a slot and then took.
 */
const JobRow = ({ job, limits }: { job: ListedJob; limits: ChartJobLimits | undefined }) => {
  const { t, i18n } = useTranslation();
  const ago = useAgo();
  const whereWords = useWhereWords();
  const dur = (s: number | null) => formatDuration(s, i18n.language);
  const times = jobTimes(job);
  const where = whereWords(job);
  const running = job.status === 'downloading' || job.status === 'generating';
  const timeWords = job.status === 'queued'
    ? [t('admin.chartJobs.times.waiting', { time: dur(times.waited) })]
    : [
      times.waited != null && t('admin.chartJobs.times.waited', { time: dur(times.waited) }),
      times.took != null && t(running ? 'admin.chartJobs.times.running' : 'admin.chartJobs.times.took', { time: dur(times.took) }),
      times.took == null && times.total != null && t('admin.chartJobs.times.total', { time: dur(times.total) }),
    ].filter(Boolean);
  const facts = [job.artist, job.durationS ? formatTime(job.durationS) : null,
    job.viewCount ? t('admin.chartJobs.views', { views: compact(job.viewCount, i18n.language) }) : null].filter(Boolean);

  const head = (
    <>
      <Thumb videoId={job.videoId} />
      <div className="min-w-0">
        <div className="text-sm font-medium text-white truncate">{job.title ?? job.videoId}</div>
        <div className="text-xs text-white/55 truncate">{facts.length ? facts.join(' · ') : t('admin.chartJobs.nameUnknown')}</div>
      </div>
    </>
  );
  const linkClass = 'flex items-center gap-3 min-w-0 rounded-xl -m-1.5 p-1.5 no-underline hover:bg-white/[0.05] transition-colors';
  const songThere = job.status === 'done' && job.songId && job.songExists;

  return (
    <li className="px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        {songThere
          ? <Link to={`/sing/${job.songId}`} title={t('admin.chartJobs.openSong')} className={linkClass}>{head}</Link>
          : <a href={`https://www.youtube.com/watch?v=${job.videoId}`} target="_blank" rel="noreferrer" title={t('admin.chartJobs.openVideo')} className={linkClass}>{head}</a>}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge tone={STATUS_TONE[job.status]}>{t(`admin.chartJobs.status.${job.status}`, { defaultValue: job.status })}</Badge>
          {job.songId && <span className="text-xs tabular-nums text-white/55 whitespace-nowrap">{t('admin.chartJobs.plays', { count: job.plays })}</span>}
        </div>
      </div>
      {/* (an admin copy's `at` may be null, which ChartJob does not allow; ChartJobProgress does not read it) */}
      {UNFINISHED.has(job.status) && <ChartJobProgress job={job} />}
      <Outcome job={job} limits={limits} />
      <div className="text-xs text-white/45">
        <Origin job={job} />
        {' · '}{ago(job.createdAt)}
        {timeWords.length ? ` · ${timeWords.join(' · ')}` : ''}
        {job.status === 'done' && !job.songExists ? ` · ${t('admin.chartJobs.songGone')}` : ''}
      </div>
      {where && <div className="text-xs text-white/45">{where}</div>}
    </li>
  );
};

const AdminChartJobs = ({ active }: { active: number | undefined }) => {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<JobFilter>('all');
  const [list, setList] = useState<{ rows: ListedJob[]; hasMore: boolean; counts: Record<JobFilter, number>; stats: ChartJobStats } | null>(null); // { rows, hasMore, counts, stats }
  const [access, setAccess] = useState<ChartAccessState | null>(null);
  const [gens, setGens] = useState<GeneratorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const shown = useRef(PAGE); // rows on screen, so a refresh keeps "show more"

  const load = useCallback(async (f: JobFilter, count: number) => {
    const p = await getAdminChartJobs(f, 0, Math.min(MAX_ROWS, Math.max(PAGE, count)));
    if (f !== filterRef.current) return; // another filter was picked meanwhile
    const receivedAt = Date.now(); // ChartJobProgress moves the bars on from here between refreshes
    setList({ rows: p.data.map(j => ({ ...j, receivedAt })), hasMore: p.hasMore, counts: p.counts, stats: p.stats });
    shown.current = Math.max(PAGE, p.data.length);
  }, []);
  const refresh = useCallback(() => load(filterRef.current, shown.current).catch(e => setErr(errorMessage(t, e))), [load, t]);

  useEffect(() => {
    setList(null);
    shown.current = PAGE;
    load(filter, PAGE).catch(e => setErr(errorMessage(t, e)));
  }, [filter, load, t]);

  useEffect(() => {
    getAdminChartAccess().then(setAccess).catch(e => setErr(errorMessage(t, e)));
  }, [t]);

  // where songs go: the PC's load moves, so it is read again while the tab is in view
  useEffect(() => {
    const read = () => getAdminChartGenerators().then(setGens).catch(e => setErr(errorMessage(t, e)));
    read();
    const id = setInterval(() => { if (document.visibilityState === 'visible') read(); }, GENERATORS_MS);
    return () => clearInterval(id);
  }, [t]);

  // A job asked for or finished since the last read: the overview counts the unfinished ones differently
  const unfinished = list ? list.stats.running + list.stats.queued : null;
  useEffect(() => {
    if (active == null || unfinished == null || active === unfinished) return;
    refresh();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const following = Math.max(active ?? 0, unfinished ?? 0) > 0;
  useEffect(() => {
    if (!following) return undefined;
    const id = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [following, refresh]);

  // (the "more" button is under a loaded list: it passes it)
  const more = async (loaded: { rows: ListedJob[] }) => {
    setBusy(true); setErr(null);
    try {
      const p = await getAdminChartJobs(filter, loaded.rows.length, PAGE);
      const receivedAt = Date.now();
      shown.current = loaded.rows.length + p.data.length;
      setList(s => s && { ...s, rows: [...s.rows, ...p.data.map(j => ({ ...j, receivedAt }))], hasMore: p.hasMore, counts: p.counts, stats: p.stats });
    } catch (e) { setErr(errorMessage(t, e)); } finally { setBusy(false); }
  };

  const limits = list?.stats.limits;
  const switchTo = async (level: ChartAccessLevel) => {
    if (!access || level === access.access) return;
    const levelName = t(`admin.chartJobs.access.levels.${level}`);
    if (level === 'everyone' && !window.confirm(t('admin.chartJobs.access.confirmEveryone', { perUser: limits?.userDaily ?? '?', daily: limits?.daily ?? '?' }))) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      setAccess(await adminSetChartAccess(level));
      forgetChartAccess(); // this tab's search bar and party queue ask again
      setMsg(t('admin.chartJobs.access.switched', { level: levelName }));
    } catch (e) { setErr(errorMessage(t, e)); } finally { setBusy(false); }
  };

  const switchRoute = async (route: ChartRoute) => {
    if (!gens || route === gens.route) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      setGens(await adminSetChartRoute(route));
      setMsg(t('admin.chartJobs.generators.switched', { route: t(`admin.chartJobs.generators.routes.${route}`) }));
    } catch (e) { setErr(errorMessage(t, e)); } finally { setBusy(false); }
  };

  const s = list?.stats;
  const loading = <Loading>{t('sections.loading')}</Loading>;

  return (
    <Section title={t('admin.chartJobs.title')}>
      <Hint>{t('admin.chartJobs.hint')}</Hint>
      {msg && <Notice className="mb-3">{msg}</Notice>}
      {err && <Notice tone="error" className="mb-3">{err}</Notice>}

      {access && <AccessSwitch state={access} limits={limits} busy={busy} onSwitch={switchTo} />}
      {gens && <GeneratorPanel state={gens} month={s?.month} busy={busy} onSwitch={switchRoute} />}

      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3">
          <StatTile label={t('admin.chartJobs.stats.day')} value={`${s.dayCounted} / ${s.limits.daily}`} accent={s.dayCounted >= s.limits.daily ? 'text-red-400' : undefined} warn={s.dayCounted >= s.limits.daily} />
          <StatTile
            label={s.queued > 0 ? t('admin.chartJobs.stats.runningQueued', { count: s.queued }) : t('admin.chartJobs.stats.running')}
            value={`${s.running} / ${s.limits.maxActive}`}
            accent="text-neon-cyan"
          />
          <StatTile label={t('admin.chartJobs.stats.median')} value={s.medianReadyS == null ? '–' : formatDuration(s.medianReadyS, i18n.language)} small />
          <StatTile label={t('admin.chartJobs.stats.songs')} value={s.songs} accent="text-hot" />
          <StatTile label={t('admin.chartJobs.stats.done')} value={s.doneWeek} accent="text-neon-green" />
          <StatTile label={t('admin.chartJobs.stats.rejected')} value={s.rejectedWeek} accent="text-amber-300" />
          <StatTile label={t('admin.chartJobs.stats.failed')} value={s.failedWeek} accent="text-red-400" />
          <StatTile label={t('admin.chartJobs.stats.plays')} value={s.playsWeek} />
        </div>
      )}

      <div className="mt-5 mb-3">
        <FilterButtons options={JOB_FILTERS} value={filter} onChange={setFilter} label={f => t(`admin.chartJobs.filter.${f}`)} counts={list?.counts} />
      </div>
      {!list
        ? loading
        : (
          <ul className={listClass}>
            {list.rows.length === 0 && <li className="px-4 py-3 text-sm text-white/45">{t('admin.chartJobs.none')}</li>}
            {list.rows.map(j => <JobRow key={j.id} job={j} limits={limits} />)}
          </ul>
        )}
      {list?.hasMore && <button type="button" disabled={busy} onClick={() => more(list)} className={`${btn.quiet} mt-3`}>{t('admin.showMore')}</button>}
    </Section>
  );
};

export default AdminChartJobs;
