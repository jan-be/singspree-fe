/**
 * What /admin's Sites tab and the overview's site tiles work out from what
 * the backend says of the sites (routes/admin.ts, siteStatus.ts): each
 * site's parties in numbers, whether its copy of the crawler pages is the
 * home site's, and bytes as people read them.
 */
import type { AdminParty, AdminSiteStatus, SiteProblem } from './authApi';

/** How long the other sites take to fetch the home site's crawler pages (the backend's PAGES_BEHIND_MS) */
const PAGES_BEHIND_MS = 45 * 60_000;

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;

/**
 * "412 MB", "3.2 GB", "1007 GB": in steps of 1024, as the machines count; one decimal below ten of a unit, and no
 * thousands separator (German's "1.007 GB" reads as one gigabyte)
 */
export function formatBytes(bytes: number | null | undefined, lang = 'en'): string {
  let value = Math.max(0, Number(bytes) || 0);
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) { value /= 1024; unit++; }
  const digits = unit > 0 && value < 10 ? 1 : 0;
  try {
    return new Intl.NumberFormat(lang, { style: 'unit', unit: UNITS[unit], unitDisplay: 'short', maximumFractionDigits: digits, useGrouping: false }).format(value);
  } catch {
    return `${value.toFixed(digits)} ${['B', 'kB', 'MB', 'GB', 'TB'][unit]}`;
  }
}

/** The middle one of some numbers (of two in the middle, their mean); null of none */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** A party with a song running: not paused, not on its score screen */
export const isSinging = (party: Pick<AdminParty, 'currentSong'>): boolean => Boolean(party.currentSong?.isPlaying && !party.currentSong.ended);

/** Some parties in numbers: how many, how many are singing, the singers connected and the middle one of their pings */
export function partyNumbers(parties: AdminParty[]) {
  const connected = parties.flatMap(p => p.players.filter(pl => pl.connected));
  const ping = median(connected.map(pl => pl.latencyMs).filter(ms => ms > 0));
  return { parties: parties.length, singing: parties.filter(isSinging).length, singers: connected.length, ping: ping === null ? null : Math.round(ping) };
}

/** A commit as the tab shows it: its first eight characters; null stays null (an image that does not say) */
export const shortBuild = (revision: string | null | undefined): string | null => (revision ? revision.slice(0, 8) : null);

/**
 * A site's copy of the crawler pages against the home site's:
 * 'written' (this is the home site, which writes them), 'same', 'arriving' (the home site wrote new ones less than a
 * fetch ago), 'behind', 'none' (no pages there), 'unknown' (the home site says nothing to compare with).
 */
export type PagesState = 'written' | 'same' | 'arriving' | 'behind' | 'none' | 'unknown';
export function pagesState(site: AdminSiteStatus, home: AdminSiteStatus | undefined, now: number): PagesState {
  const pages = site.report?.pages;
  if (!pages?.hash) return 'none';
  if (site.home) return 'written';
  const theirs = home?.report?.pages;
  if (!theirs?.hash || home?.quiet) return 'unknown';
  if (pages.hash === theirs.hash) return 'same';
  return theirs.at !== null && now - theirs.at <= PAGES_BEHIND_MS ? 'arriving' : 'behind';
}

/** Whether something wants a look at this site's build of `part` */
export const hasProblem = (problems: SiteProblem[], site: string, ...kinds: SiteProblem['kind'][]): boolean =>
  problems.some(p => p.site === site && kinds.includes(p.kind));
