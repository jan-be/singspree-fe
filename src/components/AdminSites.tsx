import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Section, Hint, Loading, Notice, Badge, FilterButtons, countryLabel, panel, list, useAgo } from './AdminParts';
import { formatDuration } from '../logic/duration';
import { formatBytes, hasProblem, pagesState, shortBuild } from '../logic/siteStatus';
import { getAdminSites } from '../logic/authApi';
import { apiUrl } from '../GlobalConsts';
import type { AdminSites as SitesData, AdminSiteStatus, SiteProblem, SiteUsage } from '../logic/authApi';

/**
 * /admin's Sites tab: the sites SingSpree runs at, side by side, as each one
 * last said itself (it reports every half minute: the backend's
 * siteStatus.ts), what wants a look, and what the sites are for: where
 * people sang since parties live at the site nearest their host, and the
 * ping they got there, per site and per country against the ping from when
 * there was one site.
 */

const REFRESH_MS = 15_000; // (a site reports every 30 s)
/** Bytes on their way between two databases are worth a word from here on: below it is what is always in flight */
const BACKLOG_BYTES = 1024 ** 2;

/** What wants a look, a line each; the overview shows them too */
export const SiteProblemLines = ({ problems }: { problems: SiteProblem[] }) => {
  const { t } = useTranslation();
  return (
    <ul className="space-y-0.5">
      {problems.map(p => <li key={`${p.site}:${p.kind}:${p.detail ?? ''}`}>{t(`admin.sites.problems.${p.kind}`, { site: p.site, detail: p.detail ?? '' })}</li>)}
    </ul>
  );
};

/** A fact of a site: its name left, what it is right; `warn` turns it red */
const Fact = ({ label, warn, children }: { label: string; warn?: boolean; children?: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5">
    <dt className="text-xs text-white/50 flex-shrink-0">{label}</dt>
    <dd className={`text-sm text-right min-w-0 break-words tabular-nums ${warn ? 'text-red-300' : 'text-white/85'}`}>{children}</dd>
  </div>
);

/** A build: the commit's first characters; "?" for an image that does not say */
const Build = ({ revision }: { revision: string | null | undefined }) => <span className="font-mono">{shortBuild(revision) ?? '?'}</span>;

/** One site: whether it runs, what it runs, what it carries, and how its database follows the others */
const SiteCard = ({ site, home, problems, now }: { site: AdminSiteStatus; home: AdminSiteStatus | undefined; problems: SiteProblem[]; now: number }) => {
  const { t, i18n } = useTranslation();
  const ago = useAgo();
  const bytes = (n: number) => formatBytes(n, i18n.language);
  const r = site.report;
  const bad = (...kinds: SiteProblem['kind'][]) => hasProblem(problems, site.name, ...kinds);
  const pages = pagesState(site, home, now);
  const db = r?.db;
  return (
    <div className={`${panel} p-4 min-w-0`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${site.quiet ? 'bg-red-400' : 'bg-neon-green'}`} aria-hidden="true" />
        <h3 className="text-lg font-semibold tracking-[-0.01em] text-white">{site.name}</h3>
        {site.home && <Badge tone="magenta">{t('admin.sites.homeSite')}</Badge>}
        {site.quiet && <Badge tone="red">{t('admin.sites.quiet')}</Badge>}
      </div>
      <div className={`mt-1 text-xs ${site.quiet ? 'text-red-300' : 'text-white/50'}`}>
        {site.reportedAt === null
          ? t('admin.sites.never')
          : site.quiet
            ? t('admin.sites.lastReport', { ago: ago(site.reportedAt) })
            : r ? t('admin.sites.runningSince', { ago: ago(r.startedAt) }) : null}
      </div>
      {r && (
        <dl className="mt-3 divide-y divide-white/[0.07]">
          <Fact label={t('admin.sites.parties')}>
            {t('admin.sites.partiesNow', { parties: r.parties, singing: r.playing, singers: r.players })}
          </Fact>
          <Fact label={t('admin.sites.codes')}><span className="font-mono tracking-[0.2em]">{[...site.codes].join(' ')}</span></Fact>
          <Fact label={t('admin.sites.backend')} warn={bad('backend')}><Build revision={r.revision} /></Fact>
          <Fact label={t('admin.sites.frontend')} warn={bad('frontend')}><Build revision={r.frontend} /></Fact>
          <Fact label={t('admin.sites.memory')}>
            {t('admin.sites.memoryLine', { backend: bytes(r.memory.rss), free: bytes(r.memory.free), total: bytes(r.memory.total) })}
          </Fact>
          {r.disk && <Fact label={t('admin.sites.disk')} warn={bad('disk')}>{t('admin.sites.freeOf', { free: bytes(r.disk.free), total: bytes(r.disk.total) })}</Fact>}
          <Fact label={t('admin.sites.pages')} warn={pages === 'behind' || pages === 'none'}>
            {t(`admin.sites.pagesState.${pages}`, { ago: ago(r.pages?.at ?? now), copied: ago(r.pages?.copiedAt ?? now) })}
          </Fact>
          <Fact label={t('admin.sites.stems')}>{r.stems.toLocaleString(i18n.language)}</Fact>
          {db && (
            <>
              <Fact label={t('admin.sites.database')}>
                Postgres {db.version}{db.spock ? ` · Spock ${db.spock}` : ''} · {bytes(db.sizeBytes)}
              </Fact>
              {db.links.map((link) => {
                const got = db.received.find(x => x.from === link.from);
                const fine = link.status === 'replicating' && !problems.some(p => p.site === site.name && (p.kind === 'link' || p.kind === 'stale') && p.detail === link.from);
                return (
                  <Fact key={link.from} label={t('admin.sites.copiesFrom', { site: link.from })} warn={!fine}>
                    {link.status === 'replicating' ? t('admin.sites.copying') : link.status}
                    {got?.lastChangeAt ? ` · ${t('admin.sites.lastChange', { ago: ago(got.lastChangeAt) })}` : ''}
                    {got && got.behindBytes >= BACKLOG_BYTES ? ` · ${t('admin.sites.behind', { size: bytes(got.behindBytes) })}` : ''}
                  </Fact>
                );
              })}
              {db.kept.some(k => k.bytes >= BACKLOG_BYTES) && (
                <Fact label={t('admin.sites.kept')} warn>{db.kept.filter(k => k.bytes >= BACKLOG_BYTES).map(k => `${k.to} ${bytes(k.bytes)}`).join(' · ')}</Fact>
              )}
              <Fact label={t('admin.sites.setAside')} warn={db.setAside > 0}>{db.setAside}</Fact>
              <Fact label={t('admin.sites.conflicts')}>
                {db.conflicts}{db.lastConflictAt ? ` · ${t('admin.sites.lastOne', { ago: ago(db.lastConflictAt) })}` : ''}
              </Fact>
            </>
          )}
        </dl>
      )}
      {!site.quiet && site.reportedAt !== null && <div className="mt-2 text-[11px] text-white/35">{t('admin.sites.reported', { ago: ago(site.reportedAt) })}</div>}
    </div>
  );
};

const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white/45 whitespace-nowrap';
const td = 'px-3 py-2 text-sm text-white/85 tabular-nums whitespace-nowrap';

/** A ping, coloured by how it feels on the highway: green up to 30 ms, amber up to 80, red beyond */
const Ping = ({ ms }: { ms: number | null }) => (ms === null
  ? <span className="text-white/30">–</span>
  : <span className={ms <= 30 ? 'text-emerald-300' : ms <= 80 ? 'text-amber-300' : 'text-red-300'}>{ms} ms</span>);

/** Parties, songs, singers, song time and ping per site */
const UsageTable = ({ rows }: { rows: SiteUsage[] }) => {
  const { t, i18n } = useTranslation();
  return (
    <div className={`${list} overflow-x-auto`}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {(['site', 'parties', 'plays', 'singers', 'time', 'ping', 'pingP90'] as const).map(c => <th key={c} scope="col" className={`${th} ${c === 'site' ? '' : 'text-right'}`}>{t(`admin.sites.usage.${c}`)}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.07]">
          {rows.map(s => (
            <tr key={s.site}>
              <th scope="row" className={`${td} text-left font-medium`}><Badge tone="cyan">{s.site}</Badge></th>
              <td className={`${td} text-right`}>{s.parties}</td>
              <td className={`${td} text-right`}>{s.plays}</td>
              <td className={`${td} text-right`}>{s.singers}</td>
              <td className={`${td} text-right`}>{formatDuration(s.seconds, i18n.language)}</td>
              <td className={`${td} text-right`} title={t('admin.sites.usage.measured', { count: s.measured })}><Ping ms={s.ping} /></td>
              <td className={`${td} text-right`}><Ping ms={s.pingP90} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AdminSites = ({ onError }: { onError: (e: unknown) => void }) => {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState(7);
  // undefined: not read yet; null: this installation is one site
  const [data, setData] = useState<SitesData | null | undefined>(undefined);
  const [nearest, setNearest] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => getAdminSites(days).then((d) => { if (active) setData(d); }).catch(onError);
    load();
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    return () => { active = false; clearInterval(id); };
  }, [days, onError]);

  // Which site answers this browser's pages and plain requests: the nearest, as the edge sees it (GET /sites has no
  // party in it, so the router sends it there; the console's own requests always go to the home site)
  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/sites`).then(r => r.json()).then((j: { data?: { site?: string | null } }) => { if (active) setNearest(j.data?.site ?? null); }).catch(() => {});
    return () => { active = false; };
  }, []);

  if (data === undefined) return <Loading>{t('sections.loading')}</Loading>;
  if (data === null) return <p className="text-sm text-white/45">{t('admin.sites.oneSite')}</p>;

  const home = data.sites.find(s => s.home);
  const date = (ms: number) => new Date(ms).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
  const cut = data.since !== null && data.from === data.since; // the window reaches back past the day the sites came

  return (
    <>
      {data.problems.length > 0
        ? <Notice tone="error"><SiteProblemLines problems={data.problems} /></Notice>
        : <Notice>{t('admin.sites.allFine', { count: data.sites.length })}</Notice>}
      {nearest && <p className="mt-3 text-[13px] text-white/50">{t('admin.sites.nearest', { site: nearest })}</p>}

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {data.sites.map(s => <SiteCard key={s.name} site={s} home={home} problems={data.problems} now={data.now} />)}
      </div>

      <Section
        title={t('admin.sites.usage.title')}
        aside={<FilterButtons options={[1, 7, 30]} value={days} onChange={setDays} label={d => t('admin.origins.days', { count: d })} />}
      >
        <Hint>{t('admin.sites.usage.hint')}{cut && data.since !== null ? ` ${t('admin.sites.usage.since', { date: date(data.since) })}` : ''}</Hint>
        {data.since === null
          ? <p className="text-sm text-white/45">{t('admin.sites.usage.notYet')}</p>
          : <UsageTable rows={data.usage.bySite} />}
      </Section>

      {data.since !== null && (
        <Section title={t('admin.sites.countries.title')}>
          <Hint>{t('admin.sites.countries.hint', { days: data.beforeDays })}</Hint>
          {data.usage.byCountry.length === 0
            ? <p className="text-sm text-white/45">{t('admin.sites.countries.none')}</p>
            : (
              <div className={`${list} overflow-x-auto`}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {/* (w-0: as narrow as their words, so what came since has the room) */}
                      <th scope="col" className={`${th} w-0`}>{t('admin.sites.countries.country')}</th>
                      <th scope="col" className={`${th} w-0 text-right`}>{t('admin.sites.countries.before')}</th>
                      <th scope="col" className={th}>{t('admin.sites.countries.since')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.07]">
                    {data.usage.byCountry.map(c => (
                      <tr key={c.country}>
                        <th scope="row" className={`${td} text-left font-normal`}>{countryLabel(c.country, i18n.language)}</th>
                        <td className={`${td} text-right`} title={c.before ? t('admin.sites.usage.measured', { count: c.before.measured }) : undefined}>
                          <Ping ms={c.before?.ping ?? null} />
                        </td>
                        <td className={`${td} whitespace-normal`}>
                          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            {c.since.length === 0 && <span className="text-white/30">–</span>}
                            {c.since.map(s => (
                              <span key={s.site ?? ''} className="inline-flex items-center gap-1.5" title={t('admin.sites.usage.measured', { count: s.measured })}>
                                <Badge tone={s.site ? 'cyan' : 'gray'}>{s.site ?? '?'}</Badge>
                                <Ping ms={s.ping} />
                                <span className="text-xs text-white/40">{t('admin.parties.count', { count: s.parties })}</span>
                              </span>
                            ))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Section>
      )}
    </>
  );
};

export default AdminSites;
