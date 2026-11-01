import { describe, expect, test } from "vitest";
import { SEASONS, easterSunday, nextChange, seasonAt, seasonEnd, seasonRun, type Season } from "./seasons";
import { halloween } from "./halloween";
import { zonePlace } from "./place";

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const DE = zonePlace('Europe/Berlin'), US = zonePlace('America/New_York'), SYDNEY = zonePlace('Australia/Sydney'), NOWHERE = zonePlace('UTC');

describe('Halloween', () => {
  test('on in the last week of October, all night long', () => {
    expect(seasonAt(at(2026, 10, 31, 21, 30), [halloween])?.id).toBe('halloween');
    expect(seasonAt(at(2026, 10, 24), [halloween])?.id).toBe('halloween');
    expect(seasonAt(at(2026, 11, 1, 12), [halloween])?.id).toBe('halloween');
    expect(seasonAt(at(2026, 11, 2, 4, 59), [halloween])?.id).toBe('halloween');
  });

  test('over on the morning of 2 November, back next year', () => {
    expect(seasonAt(at(2026, 11, 2, 5, 0), [halloween])).toBeNull();
    expect(seasonAt(at(2026, 10, 23, 23, 59), [halloween])).toBeNull();
    expect(seasonAt(at(2027, 3, 1), [halloween])).toBeNull();
    expect(seasonAt(at(2027, 10, 30), [halloween])?.id).toBe('halloween');
  });

  test('ends at 05:00 on 2 November, local time', () => {
    expect(seasonEnd(halloween, at(2026, 10, 31, 22))).toEqual(at(2026, 11, 2, 5));
  });

});

describe('every season', () => {
  test('has an id the pick events take, once', () => {
    for (const season of SEASONS) expect(season.id).toMatch(/^[a-z0-9-]{1,32}$/); // (backend events.ts)
    expect(new Set(SEASONS.map(s => s.id)).size).toBe(SEASONS.length);
  });

  test('has songs for its row, each once', () => {
    for (const season of SEASONS) {
      expect(season.songs.length, season.id).toBeGreaterThanOrEqual(12);
      expect(season.songs.length, season.id).toBeLessThanOrEqual(48); // (backend CARDS_MAX)
      expect(new Set(season.songs).size, season.id).toBe(season.songs.length);
    }
  });

  test('has its title and explanation in every language', () => {
    const locales = import.meta.glob<{ season: Record<string, { title?: string; explain?: string }> }>('../i18n/locales/*.json', { eager: true, import: 'default' });
    expect(Object.keys(locales).length).toBe(21);
    for (const [file, strings] of Object.entries(locales)) {
      for (const season of SEASONS) {
        expect(strings.season?.[season.id]?.title?.trim(), `${file} ${season.id}`).toBeTruthy();
        expect(strings.season?.[season.id]?.explain?.trim(), `${file} ${season.id}`).toBeTruthy();
      }
    }
  });

  test('lasts between a day and six weeks, every year', () => {
    for (const season of SEASONS) {
      for (let year = 2026; year <= 2060; year++) {
        const [start, end] = seasonRun(season, year);
        const days = (end.getTime() - start.getTime()) / 86400e3;
        expect(days, `${season.id} ${year}`).toBeGreaterThanOrEqual(1);
        expect(days, `${season.id} ${year}`).toBeLessThanOrEqual(42);
      }
    }
  });
});

describe('Easter', () => {
  test('Sunday by the Gregorian computus', () => {
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 });
    expect(easterSunday(2028)).toEqual({ month: 4, day: 16 });
    expect(easterSunday(2038)).toEqual({ month: 4, day: 25 }); // the latest it gets
    expect(easterSunday(2285)).toEqual({ month: 3, day: 22 }); // the earliest
  });

  test('Easter Sunday to the night of Easter Monday, moving with Easter', () => {
    expect(seasonAt(at(2027, 3, 27, 23, 59), SEASONS, DE)).toBeNull();
    expect(seasonAt(at(2027, 3, 28), SEASONS, DE)?.id).toBe('easter');
    expect(seasonAt(at(2027, 3, 30, 4, 59), SEASONS, DE)?.id).toBe('easter');
    expect(seasonAt(at(2027, 3, 30, 5, 0), SEASONS, DE)).toBeNull();
    expect(seasonAt(at(2028, 4, 17, 20), SEASONS, DE)?.id).toBe('easter');
    expect(seasonAt(at(2028, 4, 15), SEASONS, DE)).toBeNull();
  });
});

describe('the days themselves', () => {
  test("New Year's Eve, Valentine's, Pi Day and St. Patrick's: the day and the night after", () => {
    for (const [id, month, day] of [['new-year', 12, 31], ['valentines', 2, 14], ['pi-day', 3, 14], ['st-patricks', 3, 17]] as const) {
      const season = SEASONS.find(s => s.id === id)!;
      expect(seasonAt(at(2027, month, day), [season], DE)?.id, id).toBe(id);
      expect(seasonAt(at(2027, month, day, 23, 59), [season], DE)?.id, id).toBe(id);
      expect(seasonAt(at(2027, month, day - 1, 23, 59), [season], DE), id).toBeNull();
      const after = at(2027, month, day + 1, 5); // (Date carries 32 December over into January)
      expect(seasonAt(new Date(after.getTime() - 60e3), [season], DE)?.id, id).toBe(id);
      expect(seasonAt(after, [season], DE), id).toBeNull();
    }
  });
});

describe('from one season to the next', () => {
  test("winter all December, Christmas in the middle of it, New Year's Eve at the end", () => {
    expect(seasonAt(at(2026, 11, 30, 23), SEASONS, DE)).toBeNull();
    expect(seasonAt(at(2026, 12, 1), SEASONS, DE)?.id).toBe('winter');
    expect(seasonAt(at(2026, 12, 23, 23, 59), SEASONS, DE)?.id).toBe('winter');
    expect(seasonAt(at(2026, 12, 24), SEASONS, DE)?.id).toBe('christmas');
    expect(seasonAt(at(2026, 12, 27, 4, 59), SEASONS, DE)?.id).toBe('christmas');
    expect(seasonAt(at(2026, 12, 27, 5, 0), SEASONS, DE)?.id).toBe('winter');
    expect(seasonAt(at(2026, 12, 31), SEASONS, DE)?.id).toBe('new-year');
    expect(seasonAt(at(2027, 1, 1, 4, 59), SEASONS, DE)?.id).toBe('new-year');
    expect(seasonAt(at(2027, 1, 1, 5, 0), SEASONS, DE)).toBeNull();
  });

  test('the next change is the next start or end of any season there', () => {
    expect(nextChange(at(2026, 11, 3), SEASONS, DE)).toEqual(at(2026, 12, 1));
    expect(nextChange(at(2026, 12, 20), SEASONS, DE)).toEqual(at(2026, 12, 24));
    expect(nextChange(at(2026, 12, 24), SEASONS, DE)).toEqual(at(2026, 12, 27, 5));
    expect(nextChange(at(2026, 12, 27, 5), SEASONS, DE)).toEqual(at(2026, 12, 31));
    expect(nextChange(at(2026, 12, 31), SEASONS, DE)).toEqual(at(2027, 1, 1, 5));
    expect(nextChange(at(2027, 1, 1, 5), SEASONS, DE)).toEqual(at(2027, 2, 14));
    // the Fourth of July is only for the US, 1 July for Canada
    expect(nextChange(at(2027, 6, 22, 5), SEASONS, US)).toEqual(at(2027, 7, 4));
    expect(nextChange(at(2027, 6, 22, 5), SEASONS, DE)).toEqual(at(2027, 9, 19));
  });
});

describe("a country's own days", () => {
  test('only where the visitor is', () => {
    expect(seasonAt(at(2027, 7, 4, 20), SEASONS, US)?.id).toBe('independence-day');
    expect(seasonAt(at(2027, 7, 4, 20), SEASONS, DE)).toBeNull();
    expect(seasonAt(at(2027, 7, 4, 20), SEASONS, NOWHERE)).toBeNull();
    expect(seasonAt(at(2027, 10, 3, 20), SEASONS, DE)?.id).toBe('german-unity-day');
    expect(seasonAt(at(2027, 10, 3, 20), SEASONS, US)).toBeNull();
    expect(seasonAt(at(2027, 7, 14, 20), SEASONS, zonePlace('Europe/Paris'))?.id).toBe('bastille-day');
    expect(seasonAt(at(2027, 7, 1, 20), SEASONS, zonePlace('America/Toronto'))?.id).toBe('canada-day');
  });

  test('read from the time zone, in either spelling', () => {
    expect(zonePlace('America/Indianapolis').country).toBe('US'); // (Chrome)
    expect(zonePlace('America/Indiana/Indianapolis').country).toBe('US'); // (Firefox)
    expect(zonePlace('Pacific/Honolulu').country).toBe('US');
    expect(zonePlace('America/Vancouver').country).toBe('CA');
    expect(zonePlace('Europe/Berlin').country).toBe('DE');
    expect(zonePlace('Europe/Vienna').country).toBeNull();
    expect(zonePlace('UTC').country).toBeNull();
  });
});

describe('winter', () => {
  test('not in the southern half of the world, where December is summer', () => {
    expect(seasonAt(at(2026, 12, 10), SEASONS, SYDNEY)).toBeNull();
    expect(seasonAt(at(2026, 12, 25), SEASONS, SYDNEY)?.id).toBe('christmas');
    expect(seasonAt(at(2026, 12, 10), SEASONS, NOWHERE)?.id).toBe('winter');
  });

  test('the south by its time zones', () => {
    for (const zone of ['Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Buenos_Aires', 'America/Santiago', 'Africa/Johannesburg']) {
      expect(zonePlace(zone).south, zone).toBe(true);
    }
    for (const zone of ['Europe/Berlin', 'America/New_York', 'Asia/Tokyo', 'Asia/Taipei', 'America/Bogota', 'UTC']) {
      expect(zonePlace(zone).south, zone).toBe(false);
    }
  });
});

describe('a season across New Year', () => {
  const winter: Season = { id: 'winter', from: '12-20', until: '01-02', songs: [] };

  test('on from December into January', () => {
    expect(seasonAt(at(2026, 12, 24), [winter])?.id).toBe('winter');
    expect(seasonAt(at(2027, 1, 1, 23), [winter])?.id).toBe('winter');
    expect(seasonEnd(winter, at(2026, 12, 31))).toEqual(at(2027, 1, 2));
    expect(seasonEnd(winter, at(2027, 1, 1))).toEqual(at(2027, 1, 2));
  });

  test('off before and after', () => {
    expect(seasonAt(at(2026, 12, 19, 23), [winter])).toBeNull();
    expect(seasonAt(at(2027, 1, 2), [winter])).toBeNull();
  });
});
