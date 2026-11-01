import { useSyncExternalStore } from "react";
import type React from "react";
import "./seasons.css";
import { visitorPlace, type Place } from "./place";
import { newYear } from "./newYear";
import { valentines } from "./valentines";
import { piDay } from "./piDay";
import { stPatricks } from "./stPatricks";
import { easter } from "./easter";
import { musicDay } from "./musicDay";
import { canadaDay } from "./canadaDay";
import { independenceDay } from "./independenceDay";
import { bastilleDay } from "./bastilleDay";
import { pirateDay } from "./pirateDay";
import { germanUnityDay } from "./germanUnityDay";
import { halloween } from "./halloween";
import { winter } from "./winter";
import { christmas } from "./christmas";

/**
 * Seasonal looks. For a few days around a holiday the whole site wears its
 * colours (html[data-season="<id>"], the season's own CSS file), the entry
 * page opens with its songs (SeasonRow) and the hero wall gets its
 * decorations. The dates are read on the visitor's own clock, so every time
 * zone gets the whole day, and a season ends by itself: no deploy needed,
 * and it comes back on the same dates next year. A season can be for one
 * country only (the Fourth of July) or one half of the world (winter), by the
 * visitor's time zone (place.ts).
 *
 * A new season: a file like halloween.tsx (its dates, songs and the CSS it
 * imports: index.css's tokens and seasons.css's --sign-*), its decorations in
 * one like halloweenDecor.tsx (a chunk of its own, loaded only while the
 * season is on), its entry in SEASONS, and season.<id>.title and .explain in
 * the locales.
 *
 * ?season=<id> shows one out of its dates in this tab (to check one before it
 * starts), ?season=off shows none, ?season=auto goes back to the calendar.
 */
export interface Season {
  /** html[data-season], the locales' season.<id>.*, the pick events' `season` */
  id: string;
  /**
   * When it starts: 'MM-DD' (from midnight) or 'MM-DDTHH:mm', or Easter Sunday
   * and the days from it for the holidays that move with it: 'easter', 'easter+2T05:00'
   */
  from: string;
  /** when it is over (not included), written the same way; one before `from` is in the next year */
  until: string;
  /** only for visitors in these countries (ISO 3166 codes, place.ts), like ['US'] for the Fourth of July */
  countries?: string[];
  /** only in this half of the world, for a season of the weather (winter in December: the north) */
  hemisphere?: 'north' | 'south';
  /** the entry page's row, best first (song ids of the catalogue) */
  songs: string[];
  /** drawn on the entry page's hero wall, behind the sign: lazy(() => import("./halloweenDecor")) */
  Decor?: React.ComponentType;
}

/**
 * In the year's order. Where two are on at once, the one that started last
 * shows (Christmas in the middle of winter); of two that start together, the
 * first one here.
 */
export const SEASONS: Season[] = [
  newYear, valentines, piDay, stPatricks, easter, musicDay, canadaDay, independenceDay, bastilleDay, pirateDay,
  germanUnityDay, halloween, winter, christmas,
];

const PREVIEW_KEY = 'singspree_season';

/** Western Easter Sunday of `year` (the Gregorian computus: Meeus, Jones and Butcher), month 1–12 */
export function easterSunday(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const l = (32 + 2 * e + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return { month: Math.floor(n / 31), day: (n % 31) + 1 };
}

/** That day of `year` on the local clock: 'MM-DD', 'easter' or 'easter±N', any with 'THH:mm' */
function localDate(year: number, when: string) {
  const m = /^(?:(\d\d)-(\d\d)|easter([+-]\d+)?)(?:T(\d\d):(\d\d))?$/.exec(when);
  if (!m) throw new Error(`Bad season date ${when}`);
  const hour = Number(m[4] ?? 0), minute = Number(m[5] ?? 0);
  if (m[1] !== undefined) return new Date(year, Number(m[1]) - 1, Number(m[2]), hour, minute);
  const easter = easterSunday(year);
  return new Date(year, easter.month - 1, easter.day + Number(m[3] ?? 0), hour, minute); // (Date carries the days over into the next month)
}

/** The season's run that starts in `year`: [start, end) */
export function seasonRun(season: Season, year: number): [Date, Date] {
  const start = localDate(year, season.from);
  let end = localDate(year, season.until);
  if (end <= start) end = localDate(year + 1, season.until);
  return [start, end];
}

/** The run of this season that `now` is in, or null when it is not on */
function currentRun(season: Season, now: Date): [Date, Date] | null {
  // This year's run, and last year's for one that crosses New Year
  for (const year of [now.getFullYear() - 1, now.getFullYear()]) {
    const run = seasonRun(season, year);
    if (now >= run[0] && now < run[1]) return run;
  }
  return null;
}

/** When this season's current run ends, or null when it is not on at `now` */
export function seasonEnd(season: Season, now: Date): Date | null {
  return currentRun(season, now)?.[1] ?? null;
}

/** This visitor's place (place.ts) */
const here = visitorPlace();

/** Whether a season is for visitors at `place`: its country, its half of the world */
function isFor(season: Season, place: Place) {
  if (season.countries && !(place.country && season.countries.includes(place.country))) return false;
  if (season.hemisphere && season.hemisphere !== (place.south ? 'south' : 'north')) return false;
  return true;
}

/** The next moment after `now` when a season starts or ends, which may change the one on the page */
export function nextChange(now: Date, seasons: Season[] = SEASONS, place: Place = here): Date | null {
  let next: Date | null = null;
  for (const season of seasons) {
    if (!isFor(season, place)) continue;
    for (const year of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) {
      for (const t of seasonRun(season, year)) if (t > now && (!next || t < next)) next = t;
    }
  }
  return next;
}

/** The season on at `now` by the calendar for visitors at `place`, if any: of two on at once, the later started */
export function seasonAt(now: Date, seasons: Season[] = SEASONS, place: Place = here): Season | null {
  let on: Season | null = null, since = 0;
  for (const season of seasons) {
    const run = isFor(season, place) ? currentRun(season, now) : null;
    if (run && (!on || run[0].getTime() > since)) [on, since] = [season, run[0].getTime()];
  }
  return on;
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
let changeTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Puts the season of the moment on the page (html[data-season]) and changes
 * it when a season ends or starts: a page left open, like a party's host
 * screen, goes from Christmas to New Year's Eve and back to the usual look
 * on its own. Once at start (index.tsx).
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
  clearTimeout(changeTimer);
  const change = preview ? null : nextChange(now);
  // (a timer holds at most 2^31 − 1 ms, about 24 days; a longer one checks again then)
  if (change) changeTimer = setTimeout(() => applySeason(), Math.min(change.getTime() - now.getTime() + 1000, 2 ** 31 - 1));
}

/** The season on the page now, for the components that show it */
export function useSeason(): Season | null {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => current,
  );
}
