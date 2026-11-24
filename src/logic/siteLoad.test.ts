import { describe, it, expect } from 'vitest';
import { bucketMiddle, formatPeople, hourIn, hourTime, loadRows, loadSummary, loadTotals, niceTop, siteColour, timeMarks } from './siteLoad';
import type { SiteLoad } from './authApi';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('siteColour', () => {
  it('stays with the site by its number, and a ninth site gets grey, not a made-up hue', () => {
    expect(siteColour(1)).toBe('#3987e5');
    expect(siteColour(2)).toBe('#d95926');
    expect(siteColour(3)).toBe('#199e70');
    expect(siteColour(9)).toBe('#8f8aa8');
    expect(siteColour(0)).toBe('#8f8aa8');
  });
});

describe('loadSummary', () => {
  it('averages by time: the running stretch counts for what has passed of it', () => {
    // three whole hours at 1, 3, 0 and a quarter of an hour at 4
    const s = loadSummary([1, 3, 0, 4], HOUR, HOUR / 4);
    expect(s.average).toBeCloseTo((1 + 3 + 0 + 4 * 0.25) / 3.25, 6);
    expect(s.peak).toBe(4);
    expect(s.peakIndex).toBe(3);
  });

  it('is nothing for a site nobody sang at', () => {
    expect(loadSummary([0, 0], HOUR, HOUR)).toEqual({ average: 0, peak: 0, peakIndex: null });
    expect(loadSummary([], HOUR, HOUR)).toEqual({ average: 0, peak: 0, peakIndex: null });
  });
});

describe('niceTop', () => {
  it('is the next step above the highest value, close enough that the lines use the height', () => {
    expect(niceTop(0)).toBe(1);
    expect(niceTop(0.3)).toBe(0.5);
    expect(niceTop(0.57)).toBe(1);
    expect(niceTop(1.6)).toBe(2);
    expect(niceTop(2.8)).toBe(3);
    expect(niceTop(5.35)).toBe(6);
    expect(niceTop(7.2)).toBe(8);
    expect(niceTop(8.1)).toBe(10);
    expect(niceTop(27)).toBe(30);
    expect(niceTop(130)).toBe(200);
  });
});

describe('formatPeople', () => {
  it('two decimals below one, one below ten, none from ten on', () => {
    expect(formatPeople(0.584)).toBe('0.58');
    expect(formatPeople(0.2)).toBe('0.20');
    expect(formatPeople(5.35)).toBe('5.4');
    expect(formatPeople(3)).toBe('3');
    expect(formatPeople(12.4)).toBe('12');
    expect(formatPeople(0.58, 'de')).toBe('0,58');
  });

  it('says 0 for nobody, and for less than two decimals show', () => {
    expect(formatPeople(0)).toBe('0');
    expect(formatPeople(0.002)).toBe('0');
    expect(formatPeople(0.997)).toBe('1');
    expect(formatPeople(9.96)).toBe('10');
  });
});

describe('the lines in time', () => {
  const from = new Date(2026, 10, 10, 13, 0).getTime(); // 10 Nov, 13:00 in the reader's own time
  const load: SiteLoad = {
    from, bucketMs: HOUR, lastMs: HOUR / 3,
    sites: [{ site: 'home', players: [1, 2, 3] }, { site: 'ohio', players: [0, 0.5, 6] }],
  };

  it('a stretch stands at its middle, the running one at the middle of what has passed', () => {
    expect(bucketMiddle(load, 0, 3)).toBe(from + HOUR / 2);
    expect(bucketMiddle(load, 2, 3)).toBe(from + 2 * HOUR + HOUR / 6);
  });

  it('all sites together, per stretch', () => {
    expect(loadTotals(load)).toEqual([1, 2.5, 9]);
  });

  it('marks every six hours of a short window, midnight as a day', () => {
    const marks = timeMarks(from, from + DAY);
    expect(marks.map(m => [new Date(m.at).getHours(), m.day])).toEqual([[18, false], [0, true], [6, false], [12, false]]);
  });

  it('marks midnights of a long window, as many days apart as it takes to stay within the number wanted', () => {
    const week = timeMarks(from, from + 7 * DAY);
    expect(week).toHaveLength(7);
    expect(week.every(m => m.day && new Date(m.at).getHours() === 0)).toBe(true);
    expect(new Date(week[6].at).getDate()).toBe(17);
    const quarter = timeMarks(from, from + 90 * DAY, 8);
    expect(quarter.length).toBeLessThanOrEqual(8);
    expect(quarter.length).toBeGreaterThanOrEqual(7);
    const gaps = quarter.slice(1).map((m, i) => Math.round((m.at - quarter[i].at) / DAY));
    expect(new Set(gaps)).toEqual(new Set([12]));
  });

  it('as a table: per hour for a short window, newest first', () => {
    const rows = loadRows(load);
    expect(rows.map(r => [new Date(r.from).getHours(), r.hour])).toEqual([[15, true], [14, true], [13, true]]);
    expect(rows[0].players).toEqual([3, 6]);
    expect(rows[2].players).toEqual([1, 0]);
  });

  it('as a table: per day for a long window, each day averaged by time', () => {
    // 40 stretches of an hour from 13:00 on: 11 on the first day, 24 on the second, 5 on the third (the last one a third old)
    const long: SiteLoad = { from, bucketMs: HOUR, lastMs: HOUR / 3, sites: [{ site: 'home', players: Array.from({ length: 40 }, (_, i) => (i < 11 ? 1 : i < 35 ? 2 : 4)) }] };
    const rows = loadRows(long);
    expect(rows.map(r => [new Date(r.from).getDate(), r.hour])).toEqual([[12, false], [11, false], [10, false]]);
    expect(rows.map(r => r.players[0])).toEqual([4, 2, 1]);
  });
});

describe('the hours of the day', () => {
  it('reads an hour as a clock does, by the hour given and not by the zone of this browser', () => {
    expect(hourTime(0, 'de')).toBe('00:00');
    expect(hourTime(21, 'de')).toBe('21:00');
    expect(hourTime(24, 'de')).toBe('00:00');
    expect(hourTime(21, 'en-US')).toBe('09:00 PM');
  });

  it('knows the hour it is in a zone', () => {
    const at = Date.UTC(2026, 10, 24, 23, 30);
    expect(hourIn('UTC', at)).toBe(23);
    expect(hourIn('Europe/Berlin', at)).toBe(0);
    expect(hourIn('America/New_York', at)).toBe(18);
    expect(hourIn('Asia/Singapore', at)).toBe(7);
    expect(hourIn('Mars/Olympus_Mons', at)).toBe(new Date(at).getHours());
  });

  it('adds up the sites per hour', () => {
    expect(loadTotals({ sites: [{ site: 'home', players: [1, 0.5] }, { site: 'ohio', players: [0, 2] }] })).toEqual([1, 2.5]);
  });
});
