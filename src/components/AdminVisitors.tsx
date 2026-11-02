import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AdminShares from './AdminShares';
import { Section, Hint, Loading, FilterButtons, card, cardLabel, countryLabel } from './AdminParts';
import { sourceRows as buildSourceRows } from '../logic/originRows';
import { deviceRows } from '../logic/deviceRows';
import { getAdminOrigins, getAdminDevices, getAdminDiscovery } from '../logic/authApi';
import type { AdminDevices, AdminDiscovery, AdminOrigins } from '../logic/authApi';
import type { OriginRow } from '../logic/originRows';

/**
 * /admin's visitors: where they come from, what they sing on and how they
 * find their songs, all three over the days picked at the first, and the
 * share links (AdminShares.tsx, with days of its own).
 */

const WAYS = ['search', 'browse', 'youtube-url', 'queue-search', 'queue-similar', 'auto-similar', 'sing-again', 'for-you', 'season'];

/**
 * A ranked list with a bar per row, the bar being the share of the first
 * number; `labels` name the two numbers. A row may carry a `hint` (shown on
 * hover), `own` (one of our own links: a magenta bar) and `inferred` (worked
 * out rather than recorded: in italics).
 */
const OriginList = ({ rows, empty, labels }: { rows: OriginRow[]; empty: string; labels?: [string, string] }) => {
  const { t } = useTranslation();
  const [unitA, unitB] = labels ?? [t('admin.origins.sessions'), t('admin.origins.plays')];
  if (rows.length === 0) return <p className="text-sm text-white/45">{empty}</p>;
  const max = Math.max(1, ...rows.map(r => r.sessions));
  return (
    <ul className="space-y-1">
      {rows.map(r => (
        <li key={r.key} className="relative rounded-lg overflow-hidden px-2.5 py-1.5">
          <div className={`absolute inset-y-0 left-0 rounded-lg ${r.own ? 'bg-hot/20' : 'bg-violet-300/[0.13]'}`} style={{ width: `${(r.sessions / max) * 100}%` }} aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-3 text-sm" title={r.hint}>
            <span className={`truncate min-w-0 ${r.inferred ? 'text-white/55 italic' : 'text-white/90'}`}>{r.label}</span>
            <span className="text-xs text-white/70 flex-shrink-0 tabular-nums whitespace-nowrap">
              {r.sessions} <span className="text-white/40">{unitA}</span> · {r.plays} <span className="text-white/40">{unitB}</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
};

const AdminVisitors = ({ onError }: { onError: (e: unknown) => void }) => {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState(30);

  const [origins, setOrigins] = useState<AdminOrigins | null>(null); // { days, referrers, arrivals, direct, countries }
  useEffect(() => {
    let active = true;
    setOrigins(null);
    getAdminOrigins(days).then(o => { if (active) setOrigins(o); }).catch(onError);
    return () => { active = false; };
  }, [days, onError]);
  const sourceRows = buildSourceRows(origins, t); // sites, our own links (QR code, party and invite links) and direct visits
  const countryRows = origins ? origins.countries.map(c => ({ key: c.country, label: countryLabel(c.country, i18n.language), sessions: c.sessions, plays: c.plays })) : [];

  const [devices, setDevices] = useState<AdminDevices | null>(null); // { os, browsers, devices }
  useEffect(() => {
    let active = true;
    setDevices(null);
    getAdminDevices(days).then(d => { if (active) setDevices(d); }).catch(onError);
    return () => { active = false; };
  }, [days, onError]);

  const [discovery, setDiscovery] = useState<AdminDiscovery | null>(null); // { picks, searches, topMissed, topAsked, youtube }
  useEffect(() => {
    let active = true;
    setDiscovery(null);
    getAdminDiscovery(days).then(d => { if (active) setDiscovery(d); }).catch(onError);
    return () => { active = false; };
  }, [days, onError]);
  const pickRows = discovery
    ? discovery.picks.map(p => ({ key: p.source, label: WAYS.includes(p.source) ? t(`admin.discovery.ways.${p.source}`) : p.source, sessions: p.picks, plays: p.browsers }))
    : [];
  const youtube: Record<string, number> = discovery ? Object.fromEntries(discovery.youtube.map(y => [y.match, y.lookups])) : {};
  const youtubeTotal = Object.values(youtube).reduce((a, b) => a + b, 0);

  const loading = <Loading>{t('sections.loading')}</Loading>;
  const sameDays = <span className="text-xs text-white/40">{t('admin.origins.days', { count: days })}</span>;

  return (
    <>
      <Section
        title={t('admin.origins.title')}
        aside={(
          <FilterButtons
            options={[7, 30, 365]}
            value={days}
            onChange={setDays}
            label={d => t('admin.origins.days', { count: d })}
          />
        )}
      >
        <Hint>{t('admin.origins.hint')}</Hint>
        {!origins
          ? loading
          : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className={card}>
                <div className={cardLabel}>{t('admin.origins.sources')}</div>
                <OriginList rows={sourceRows} empty={t('admin.origins.none')} />
              </div>
              <div className={card}>
                <div className={cardLabel}>{t('admin.origins.countries')}</div>
                <OriginList rows={countryRows} empty={t('admin.origins.noCountries')} />
              </div>
            </div>
          )}
      </Section>

      <Section title={t('admin.devices.title')} aside={sameDays}>
        <Hint>{t('admin.devices.hint')}</Hint>
        {!devices
          ? loading
          : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(['os', 'versions', 'browsers', 'devices'] as const).map(kind => (
                <div key={kind} className={card}>
                  <div className={cardLabel}>{t(`admin.devices.${kind}`)}</div>
                  <OriginList rows={deviceRows(kind === 'versions' ? devices[kind]?.slice(0, 20) : devices[kind], kind, t)} empty={t('admin.origins.none')} />
                </div>
              ))}
            </div>
          )}
      </Section>

      <Section title={t('admin.discovery.title')} aside={sameDays}>
        <Hint>{t('admin.discovery.hint')}</Hint>
        {!discovery
          ? loading
          : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className={card}>
                <div className={cardLabel}>{t('admin.discovery.picks')}</div>
                <OriginList rows={pickRows} empty={t('admin.discovery.noPicks')} labels={[t('admin.discovery.picksUnit'), t('admin.discovery.browsersUnit')]} />
              </div>
              <div className={`${card} space-y-5`}>
                <div>
                  <div className={cardLabel}>{t('admin.discovery.searches')}</div>
                  {Object.keys(discovery.searches).length === 0 && <p className="text-sm text-white/45">{t('admin.discovery.noSearches')}</p>}
                  <div className="space-y-1">
                    {(['entry', 'queue', 'youtube'] as const).map(s => {
                      const b = discovery.searches[s];
                      if (!b) return null;
                      return (
                        <div key={s} className="text-sm text-white/65">
                          <span className="font-medium text-white">{t(`admin.discovery.sources.${s}`)}</span>
                          {': '}
                          {t('admin.discovery.searchLine', { sessions: b.sessions, hits: b.hits, pct: b.sessions ? Math.round((100 * b.hits) / b.sessions) : 0, empty: b.empty })}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className={cardLabel}>{t('admin.discovery.missed')}</div>
                  {discovery.topMissed.length === 0
                    ? <p className="text-sm text-white/45">{t('admin.discovery.noMissed')}</p>
                    : (
                      <ul className="text-sm divide-y divide-white/[0.07]">
                        {discovery.topMissed.map(m => (
                          <li key={m.q} className="flex justify-between gap-3 py-1.5 first:pt-0"><span className="text-white/85 truncate">{m.q}</span><span className="tabular-nums text-white/45 flex-shrink-0">{m.count}</span></li>
                        ))}
                      </ul>
                    )}
                </div>
                <div className="text-sm text-white/65 pt-3 border-t border-white/[0.07]">
                  {youtubeTotal === 0
                    ? <span className="text-white/45">{t('admin.discovery.noYoutube')}</span>
                    : t('admin.discovery.youtube', { lookups: youtubeTotal, exact: youtube.exact ?? 0, title: youtube.title ?? 0, none: youtube.none ?? 0 })}
                </div>
              </div>
            </div>
          )}
      </Section>

      <AdminShares onError={onError} />
    </>
  );
};

export default AdminVisitors;
