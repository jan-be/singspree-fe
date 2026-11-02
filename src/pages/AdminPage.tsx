import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WrapperPage from './WrapperPage';
import NotFoundPage from './NotFoundPage';
import AdminOverviewTab from '../components/AdminOverviewTab';
import AdminTrends from '../components/AdminTrends';
import AdminVisitors from '../components/AdminVisitors';
import AdminInbox from '../components/AdminInbox';
import AdminChartJobs from '../components/AdminChartJobs';
import AdminAccounts from '../components/AdminAccounts';
import { Notice, type AdminActions } from '../components/AdminParts';
import { useAuth } from '../logic/AuthContext';
import { getAdminOverview } from '../logic/authApi';
import { errorMessage } from './AuthPage';
import type { AdminOverview } from '../logic/authApi';

/**
 * /admin, for accounts with the admin flag (backend routes/admin.ts), in tabs
 * with an address each (/admin, /admin/trends, …): the overview with the
 * parties running right now, the trends, the visitors, the inbox of reports
 * and feedback, the AI charts and the accounts. A tab reads its numbers when
 * it is opened; the overview is read every few seconds on every tab, for the
 * counts on the tabs. Everyone else gets the 404 page, so the URL gives
 * nothing away.
 */

const REFRESH_MS = 5000; // parties come and go; the numbers ride along

/** The tabs in their order; each but the first has its name as its address below /admin */
const TABS = ['overview', 'trends', 'visitors', 'inbox', 'charts', 'accounts'] as const;
type Tab = typeof TABS[number];
const tabPath = (tab: Tab) => (tab === 'overview' ? '/admin' : `/admin/${tab}`);
/** The tab an address names (none: the overview); null when it names none we have */
const tabOf = (slug: string | undefined): Tab | null => {
  if (slug == null) return 'overview';
  return slug !== 'overview' && (TABS as readonly string[]).includes(slug) ? slug as Tab : null;
};

/** A count on a tab: what waits there; `urgent` when it waits for an admin to settle it */
type TabCount = { n: number; urgent?: boolean };

/**
 * The tabs under the heading: links, so each has its address and Back goes
 * back a tab. On a phone the row scrolls sideways, with the open tab in view.
 */
const TabBar = ({ current, counts }: { current: Tab; counts: Partial<Record<Tab, TabCount>> }) => {
  const { t } = useTranslation();
  const row = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = row.current;
    const on = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !on || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2;
  }, [current]);
  return (
    <nav aria-label={t('admin.title')} className="mt-6">
      {/* the hairline is the row's inset shadow, so the open tab's line lies on it */}
      <div ref={row} className="relative flex gap-1 overflow-x-auto [scrollbar-width:none] shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)]">
        {TABS.map(tab => {
          const on = tab === current;
          const count = counts[tab];
          return (
            <Link
              key={tab}
              to={tabPath(tab)}
              aria-current={on ? 'page' : undefined}
              className={`relative flex-shrink-0 inline-flex items-center gap-2 h-11 px-3 text-sm font-medium whitespace-nowrap no-underline transition-colors ${on ? 'text-white hover:text-white' : 'text-white/55 hover:text-white'}`}
            >
              {t(`admin.tabs.${tab}`)}
              {count && (
                <span
                  title={t(`admin.tabs.counts.${tab}`, { count: count.n })}
                  className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-semibold tabular-nums ${count.urgent ? 'fill-hot' : 'bg-white/10 text-white/70'}`}
                >
                  <span aria-hidden="true">{count.n}</span>
                  <span className="sr-only">{t(`admin.tabs.counts.${tab}`, { count: count.n })}</span>
                </span>
              )}
              {on && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, var(--hot-from), var(--hot-to))' }} aria-hidden="true" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

/** `myId`: the signed-in admin's account (its row in Accounts has no buttons) */
const AdminConsole = ({ myId, tab }: { myId: number; tab: Tab }) => {
  const { t, i18n } = useTranslation();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const fail = useCallback((e: unknown) => setErr(errorMessage(t, e)), [t]);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await getAdminOverview());
      setUpdatedAt(Date.now());
    } catch (e) { fail(e); }
  }, [fail]);

  useEffect(() => {
    loadOverview();
    const id = setInterval(() => { if (document.visibilityState === 'visible') loadOverview(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [loadOverview]);

  // What one tab's button did is no news on the next
  useEffect(() => { setMsg(null); setErr(null); }, [tab]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null); setMsg(null);
    try { await fn(); } catch (e) { fail(e); } finally { setBusy(false); }
  }, [fail]);
  const actions: AdminActions = useMemo(() => ({ busy, run, say: setMsg, fail }), [busy, run, fail]);

  const waiting = overview ? overview.reportsOpen + overview.avatarReportsOpen : 0;
  const counts: Partial<Record<Tab, TabCount>> = {
    overview: overview?.partiesRunning ? { n: overview.partiesRunning } : undefined,
    inbox: waiting ? { n: waiting, urgent: true } : undefined,
    charts: overview?.chartJobsActive ? { n: overview.chartJobsActive } : undefined,
  };

  return (
    <WrapperPage>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em] text-white">{t('admin.title')}</h1>
          <p className="mt-1 text-[15px] text-white/60">{t('admin.subtitle')}</p>
        </div>
        {tab === 'overview' && updatedAt && <div className="text-xs text-white/40 tabular-nums">{t('admin.updated', { time: new Date(updatedAt).toLocaleTimeString(i18n.language) })}</div>}
      </div>

      <TabBar current={tab} counts={counts} />

      {msg && <Notice className="mt-5">{msg}</Notice>}
      {err && <Notice tone="error" className="mt-5">{err}</Notice>}

      {/* (a tab's first section sits under the tabs, not a section's distance away) */}
      <div className="mt-8 [&>:first-child]:mt-0">
        {tab === 'overview' && <AdminOverviewTab overview={overview} reload={loadOverview} actions={actions} />}
        {tab === 'trends' && <AdminTrends />}
        {tab === 'visitors' && <AdminVisitors onError={fail} />}
        {tab === 'inbox' && <AdminInbox openReports={overview?.reportsOpen} openAvatarReports={overview?.avatarReportsOpen} actions={actions} />}
        {tab === 'charts' && <AdminChartJobs active={overview?.chartJobsActive} />}
        {tab === 'accounts' && <AdminAccounts myId={myId} actions={actions} />}
      </div>
    </WrapperPage>
  );
};

const AdminPage = () => {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const tab = tabOf(useParams().tab);
  useEffect(() => {
    document.title = tab && tab !== 'overview' ? `${t(`admin.tabs.${tab}`)} · Admin | SingSpree` : 'Admin | SingSpree';
  }, [tab, t]);
  if (loading) return <WrapperPage><div className="text-white/40 text-sm text-center py-20 animate-pulse">{t('sections.loading')}</div></WrapperPage>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  if (!user.isAdmin) return <NotFoundPage />;
  if (!tab) return <Navigate to="/admin" replace />;
  return <AdminConsole myId={user.id} tab={tab} />;
};

export default AdminPage;
