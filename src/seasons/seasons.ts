import { useSyncExternalStore } from "react";
import type React from "react";
import { halloween } from "./halloween";

/**
 * Seasonal looks. For a few days around a holiday the whole site wears its
 * colours (html[data-season="<id>"], the season's own CSS file), the entry
 * page opens with its songs (SeasonRow) and the hero wall gets its
 * decorations. The dates are read on the visitor's own clock, so every time
 * zone gets the whole day, and a season ends by itself: no deploy needed,
 * and it comes back on the same dates next year.
 *
 * A new season: a file like halloween.tsx (its dates, songs, decorations
 * and the CSS it imports), its entry in SEASONS, and season.<id>.title and
 * .explain in the locales.
 *
 * ?season=<id> shows one out of its dates in this tab (to check one before it
 * starts), ?season=off shows none, ?season=auto goes back to the calendar.
 */
export interface Season {
  /** html[data-season], the locales' season.<id>.*, the pick events' `season` */
  id: string;
  /** the first day, 'MM-DD', from midnight */
  from: string;
  /** when it is over, 'MM-DD' or 'MM-DDTHH:mm' (not included); one before `from` is in the next year */
  until: string;
  /** the entry page's row, best first (song ids of the catalogue) */
  songs: string[];
  /** drawn on the entry page's hero wall, behind the sign */
  Decor?: React.ComponentType;
}

export const SEASONS: Season[] = [halloween];

const PREVIEW_KEY = 'singspree_season';

/** That month-day ('MM-DD' or 'MM-DDTHH:mm') of `year` on the local clock */
function localDate(year: number, monthDay: string) {
  const m = /^(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?$/.exec(monthDay);
  if (!m) throw new Error(`Bad season date ${monthDay}`);
  return new Date(year, Number(m[1]) - 1, Number(m[2]), Number(m[3] ?? 0), Number(m[4] ?? 0));
}

/** When this season's current run ends, or null when it is not on at `now` */
export function seasonEnd(season: Season, now: Date): Date | null {
  // This year's run, and last year's for one that crosses New Year
  for (const year of [now.getFullYear() - 1, now.getFullYear()]) {
    const start = localDate(year, season.from);
    let end = localDate(year, season.until);
    if (end <= start) end = localDate(year + 1, season.until);
    if (now >= start && now < end) return end;
  }
  return null;
}

/** The season on at `now` by the calendar, if any */
export function seasonAt(now: Date, seasons: Season[] = SEASONS): Season | null {
  return seasons.find(s => seasonEnd(s, now)) ?? null;
}

/** ?season= on this tab's address: kept for the tab, so it survives moving between pages */
function previewChoice(): string | null {
  try {
    const asked = new URLSearchParams(window.location.search).get('season');
    if (asked === 'auto') sessionStorage.removeItem(PREVIEW_KEY);
    else if (asked) sessionStorage.setItem(PREVIEW_KEY, asked);
    return sessionStorage.getItem(PREVIEW_KEY);
  } catch {
    return null;
  }
}

let current: Season | null = null;
const listeners = new Set<() => void>();
let endTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Puts the season of the moment on the page (html[data-season]) and takes it
 * off when it ends: a page left open past the end, like a party's host
 * screen, goes back to the usual look then. Once at start (index.tsx).
 */
export function applySeason(now = new Date()) {
  const preview = previewChoice();
  const next = preview === 'off' ? null : SEASONS.find(s => s.id === preview) ?? seasonAt(now);
  const root = document.documentElement;
  if (next) root.dataset.season = next.id;
  else delete root.dataset.season;
  if (next !== current) {
    current = next;
    listeners.forEach(l => l());
  }
  clearTimeout(endTimer);
  const end = next && !preview ? seasonEnd(next, now) : null;
  // (a timer holds at most 2^31 − 1 ms, about 24 days; a longer one checks again then)
  if (end) endTimer = setTimeout(() => applySeason(), Math.min(end.getTime() - now.getTime() + 1000, 2 ** 31 - 1));
}

/** The season on the page now, for the components that show it */
export function useSeason(): Season | null {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => current,
  );
}
