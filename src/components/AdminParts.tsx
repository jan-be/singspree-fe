import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import { timeAgo } from '../logic/timeAgo';
import { localizedHostNames, hostLabel } from '../logic/hostNames';

/**
 * The admin console's building blocks (tiles, sections, badges, thumbnails,
 * buttons), shared by AdminPage.tsx and its tabs (AdminOverviewTab.tsx,
 * AdminInbox.tsx, AdminChartJobs.tsx, …), so all of /admin looks alike.
 */

/**
 * What a tab gets from the page for its buttons: `run` does an action with
 * every button disabled meanwhile (`busy`) and its error shown at the top of
 * the page, `say` puts what it did there, `fail` an error from loading.
 */
export interface AdminActions {
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  say: (msg: string) => void;
  fail: (e: unknown) => void;
}

export const useAgo = () => {
  const { i18n: inst } = useTranslation();
  return (d: string | number) => timeAgo(d, { lang: inst.language });
};

const HOST_NAMES = localizedHostNames(i18n.options?.resources ?? i18n.store?.data); // "Gastgeber", "ホスト", …

/** A player's name, with "(host)" after a default host name in another language. */
export const useName = () => {
  const { t } = useTranslation();
  return (name: string) => hostLabel(name, HOST_NAMES, t('admin.host'));
};

export const btn = {
  primary: 'btn btn-sm btn-primary',
  quiet: 'btn btn-sm btn-ghost',
  danger: 'btn btn-sm btn-stop',
};

/** A panel on the stage: the cards, lists and tiles of /admin */
export const panel = 'rounded-2xl bg-panel border border-white/10';

/** A list in one panel, rows parted by hairlines */
export const list = `${panel} divide-y divide-white/[0.07] overflow-hidden`;

/** A small panel of its own inside a section, with an uppercase label */
export const card = `${panel} p-4 min-w-0`;
export const cardLabel = 'pop-label mb-3';

/** Loading line, as the front page's */
export const Loading = ({ children }: { children?: React.ReactNode }) => <div className="text-white/40 text-sm text-center py-6 animate-pulse">{children}</div>;

/** A soft note under a heading: green when something worked, red when it did not */
export const Notice = ({ tone = 'ok', className = '', children }: { tone?: 'ok' | 'error'; className?: string; children?: React.ReactNode }) => (
  <div
    role={tone === 'ok' ? 'status' : 'alert'}
    className={`rounded-xl border px-3.5 py-2 text-sm ${tone === 'ok' ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-200' : 'bg-red-500/10 border-red-400/25 text-red-200'} ${className}`}
  >
    {children}
  </div>
);

/**
 * A number with its name. `accent` (a text colour class) lights the small dot
 * before the name; `warn` turns the number itself red (a limit reached).
 */
export const StatTile = ({ label, value, accent, small, warn }: { label: string; value: React.ReactNode; accent?: string; small?: boolean; warn?: boolean }) => (
  <div className={`${panel} px-4 py-3 min-w-0`}>
    <div className="flex items-center gap-1.5 text-xs text-white/55 min-w-0">
      {accent && <span className={`w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 ${accent}`} aria-hidden="true" />}
      <span className="truncate" title={label}>{label}</span>
    </div>
    <div className={`${small ? 'text-lg mt-1.5' : 'text-2xl mt-1'} font-semibold tabular-nums tracking-[-0.02em] leading-tight ${warn ? 'text-red-300' : 'text-white'}`}>{value}</div>
  </div>
);

export const Section = ({ title, children, aside }: { title: React.ReactNode; children?: React.ReactNode; aside?: React.ReactNode }) => (
  <section className="mt-12">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
      <h2 className="text-xl font-semibold tracking-[-0.015em] text-white">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
);

/** A section's explanation under its heading */
export const Hint = ({ className = 'mb-4', children }: { className?: string; children?: React.ReactNode }) => (
  <p className={`text-[13px] leading-relaxed text-white/50 max-w-3xl ${className}`}>{children}</p>
);

const TONES = {
  gray: 'bg-white/10 text-white/65',
  cyan: 'bg-cyan-400/15 text-cyan-200',
  green: 'bg-emerald-400/15 text-emerald-300',
  magenta: 'bg-hot/15 text-pink-300',
  yellow: 'bg-amber-400/15 text-amber-300',
  red: 'bg-red-500/15 text-red-300',
};
/** A badge's colour */
export type BadgeTone = keyof typeof TONES;
export const Badge = ({ tone = 'gray', children }: { tone?: BadgeTone; children?: React.ReactNode }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider leading-tight whitespace-nowrap ${TONES[tone] ?? TONES.gray}`}>{children}</span>
);

export const Thumb = ({ videoId }: { videoId: string | null }) => (videoId
  ? <img src={`https://i.ytimg.com/vi/${videoId}/default.jpg`} alt="" className="w-14 h-10 rounded-lg object-cover flex-shrink-0 bg-white/[0.06] ring-1 ring-inset ring-white/10" loading="lazy" />
  : <div className="w-14 h-10 rounded-lg bg-white/[0.06] flex-shrink-0" />);

/** Filter chips in a row (a section's status filter), each with its count when known */
export const FilterButtons = <T extends string | number>({ options, value, onChange, label, counts }: {
  options: T[];
  value: T;
  onChange: (option: T) => void;
  label: (option: T) => string;
  counts?: Partial<Record<T, number>> | null;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map(o => (
      <button
        key={o}
        type="button"
        aria-pressed={value === o}
        onClick={() => onChange(o)}
        className="chip h-8 px-3 text-[13px]"
      >
        {label(o)}{counts ? ` (${counts[o] ?? 0})` : ''}
      </button>
    ))}
  </div>
);

/** Flag and name for a two-letter country code; Cloudflare's XX (unknown) and T1 (Tor) stay as they are. */
export const countryLabel = (code: string, lang: string) => {
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX' || code === 'T1') return code;
  const flag = String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
  let name = code;
  try { name = new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code; } catch { /* not a region the browser knows */ }
  return `${flag} ${name}`;
};
