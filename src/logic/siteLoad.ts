/**
 * The Sites tab's lines of people in a song at once (the backend's
 * siteLoad.ts counts them): a colour per site, the numbers beside the lines,
 * the top of the scale, where the marks of the time axis go, and the same
 * numbers as a table; for the hours of the day, how an hour reads.
 */
import type { SiteLoad } from './authApi';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * A site's line colour, by its number: blue, orange, aqua first. A fixed order (the colour stays with the site
 * whatever else is shown), stepped for a dark surface and checked against the violet panel (#221c42) for
 * colour-blind separation between every pair of the first three, and for contrast.
 */
const SITE_COLOURS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
/** (a ninth site gets no made-up hue: grey) */
export const siteColour = (number: number): string => SITE_COLOURS[Math.round(number) - 1] ?? '#8f8aa8';

/** The middle of bucket `i`, in time: the running (last) bucket's middle is that of what has passed of it */
export const bucketMiddle = (load: Pick<SiteLoad, 'from' | 'bucketMs' | 'lastMs'>, i: number, count: number): number =>
  load.from + i * load.bucketMs + (i === count - 1 ? load.lastMs : load.bucketMs) / 2;

/** A line in two numbers: its average over the whole window (by time: the running bucket counts for what has passed of it) and its highest point */
export function loadSummary(players: number[], bucketMs: number, lastMs: number): { average: number; peak: number; peakIndex: number | null } {
  let sum = 0;
  let time = 0;
  let peak = 0;
  let peakIndex: number | null = null;
  players.forEach((v, i) => {
    const length = i === players.length - 1 ? lastMs : bucketMs;
    sum += v * length;
    time += length;
    if (v > peak) { peak = v; peakIndex = i; }
  });
  return { average: time > 0 ? sum / time : 0, peak, peakIndex };
}

/** All sites together, per bucket (or hour of the day) */
export const loadTotals = (load: Pick<SiteLoad, 'sites'>): number[] =>
  (load.sites[0]?.players ?? []).map((_, i) => load.sites.reduce((n, s) => n + (s.players[i] ?? 0), 0));

/**
 * The top of the scale for a highest value: the next of 0.5, 1, 2, 3, 4, 5, 6, 8, then the same times ten and so on
 * (1 where nobody sang). Every one halves to a number that reads well beside the middle gridline.
 */
export function niceTop(max: number): number {
  if (!(max > 0)) return 1;
  if (max <= 0.5) return 0.5;
  for (let unit = 1; ; unit *= 10) {
    for (const m of [1, 2, 3, 4, 5, 6, 8]) if (unit * m >= max) return unit * m;
  }
}

/** "0.58", "5.4", "12": people as an average reads; two decimals below one, one below ten */
export function formatPeople(value: number, lang = 'en'): string {
  if (!(value >= 0.005)) return new Intl.NumberFormat(lang).format(0); // (less than shows in two decimals: nobody)
  const digits = value >= 9.95 ? 0 : value >= 0.995 ? 1 : 2;
  return new Intl.NumberFormat(lang, { maximumFractionDigits: digits, minimumFractionDigits: digits === 2 ? 2 : 0 }).format(value);
}

/**
 * "21:00" (or "09:00 PM", as the language writes it): an hour of the day, 0 to 24, as it reads on a clock. Not by
 * this browser's own clock: the hours come in the time zone they were asked for, which may be UTC.
 */
export const hourTime = (hour: number, lang = 'en'): string =>
  new Date(Date.UTC(2000, 0, 1, hour)).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/** The hour of the day it is now in a time zone (0 to 23); this browser's own where the zone is none */
export function hourIn(zone: string, now = Date.now()): number {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: zone }).format(now)) % 24;
  } catch {
    return new Date(now).getHours();
  }
}

/** A mark on the time axis: when, and whether it is a day's start (else an hour of the day) */
export interface TimeMark { at: number; day: boolean }

/**
 * The marks of the time axis between `from` and `to`, in the reader's own time: for a window of up to a day and a
 * half every six hours (midnight a day's start), for longer ones midnights, as many days apart as it takes to keep
 * to `most` marks, counted back from the last midnight.
 */
export function timeMarks(from: number, to: number, most = 8): TimeMark[] {
  const marks: TimeMark[] = [];
  if (to - from <= 1.5 * DAY) {
    const first = new Date(from);
    first.setMinutes(0, 0, 0);
    for (let t = first.getTime(); t <= to; t += HOUR) {
      const hour = new Date(t).getHours();
      if (t >= from && hour % 6 === 0) marks.push({ at: t, day: hour === 0 });
    }
    return marks;
  }
  const last = new Date(to);
  last.setHours(0, 0, 0, 0);
  const step = Math.max(1, Math.ceil((to - from) / DAY / most));
  for (const d = last; d.getTime() >= from; d.setDate(d.getDate() - step)) marks.unshift({ at: d.getTime(), day: true });
  return marks;
}

/** A row of the table: a stretch of time (a day, or an hour for a short window) and each site's average over it */
export interface LoadRow { from: number; hour: boolean; players: number[] }

/**
 * The lines as a table: per day in the reader's own time (per hour for a window of up to a day and a half) each
 * site's average, by time. Newest first.
 */
export function loadRows(load: SiteLoad): LoadRow[] {
  const count = load.sites[0]?.players.length ?? 0;
  const hourly = count * load.bucketMs <= 1.5 * DAY;
  const rows = new Map<number, { time: number; sums: number[] }>();
  for (let i = 0; i < count; i++) {
    const start = new Date(bucketMiddle(load, i, count));
    if (hourly) start.setMinutes(0, 0, 0); else start.setHours(0, 0, 0, 0);
    const length = i === count - 1 ? load.lastMs : load.bucketMs;
    const row = rows.get(start.getTime()) ?? { time: 0, sums: load.sites.map(() => 0) };
    row.time += length;
    load.sites.forEach((s, k) => { row.sums[k] += (s.players[i] ?? 0) * length; });
    rows.set(start.getTime(), row);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([from, row]) => ({ from, hour: hourly, players: row.sums.map(sum => (row.time > 0 ? sum / row.time : 0)) }));
}
