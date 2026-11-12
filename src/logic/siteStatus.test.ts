import { describe, expect, it } from 'vitest';
import { formatBytes, hasProblem, isSinging, median, pagesState, partyNumbers, shortBuild } from './siteStatus';
import type { AdminParty, AdminSiteStatus, SiteProblem, SiteReport } from './authApi';
import en from '../i18n/locales/en.json';
import de from '../i18n/locales/de.json';

const NOW = Date.parse('2026-11-12T18:00:00Z');

const party = (over: Partial<AdminParty> = {}): AdminParty => ({
  partyId: 'KDM7', owner: 'Ray', createdAt: NOW - 600_000, hostConnected: true, hostAway: false, currentSong: null, queueLength: 0, players: [], ...over,
});
const song = (over: Partial<NonNullable<AdminParty['currentSong']>> = {}): AdminParty['currentSong'] => ({ songId: 's1', title: 'Gravity', artist: 'Nico Vega', videoId: 'v1', isPlaying: true, ...over });
const player = (username: string, connected: boolean, latencyMs: number) => ({ username, connected, score: 0, signedIn: false, latencyMs });

const site = (name: string, pages: SiteReport['pages'], over: Partial<AdminSiteStatus> = {}): AdminSiteStatus => ({
  name, number: 1, here: name === 'home', home: name === 'home', codes: 'AJS2', firstAt: NOW - 86_400_000, reportedAt: NOW - 10_000, quiet: false,
  report: {
    revision: 'a2f91e20', frontend: 'ddc27de0', startedAt: NOW - 3_600_000, home: name === 'home', parties: 0, playing: 0, players: 0, sockets: 0,
    memory: { rss: 1, free: 1, total: 2 }, disk: null, pages, stems: 0, db: null,
  },
  ...over,
});

describe('bytes as people read them', () => {
  it('in steps of 1024, one decimal below ten of a unit', () => {
    expect(formatBytes(0)).toBe('0 byte');
    expect(formatBytes(900)).toBe('900 byte');
    expect(formatBytes(2048)).toBe('2 kB');
    expect(formatBytes(432 * 1024 ** 2)).toBe('432 MB');
    expect(formatBytes(3.24 * 1024 ** 3)).toBe('3.2 GB');
    expect(formatBytes(57.6 * 1024 ** 3)).toBe('58 GB');
    // no thousands separator: German's would make a terabyte disk read as one gigabyte
    expect(formatBytes(1007 * 1024 ** 3, 'de').replace(/\s/g, ' ')).toBe('1007 GB');
    // (German puts a no-break space before the unit)
    expect(formatBytes(3.24 * 1024 ** 3, 'de').replace(/\s/g, ' ')).toBe('3,2 GB');
  });
  it('nothing for what is no number', () => {
    expect(formatBytes(null)).toBe('0 byte');
    expect(formatBytes(undefined)).toBe('0 byte');
    expect(formatBytes(-5)).toBe('0 byte');
  });
});

describe('parties in numbers', () => {
  it('the middle one of some numbers', () => {
    expect(median([])).toBeNull();
    expect(median([7])).toBe(7);
    expect(median([9, 1, 5])).toBe(5);
    expect(median([4, 1, 10, 2])).toBe(3);
  });

  it('a party is singing while its song runs: not paused, not on the score screen', () => {
    expect(isSinging(party())).toBe(false);
    expect(isSinging(party({ currentSong: song() }))).toBe(true);
    expect(isSinging(party({ currentSong: song({ isPlaying: false }) }))).toBe(false);
    expect(isSinging(party({ currentSong: song({ ended: true }) }))).toBe(false);
  });

  it('how many, how many are singing, the singers connected, and the middle one of their pings', () => {
    const parties = [
      party({ currentSong: song(), players: [player('Ray', true, 4), player('Mia', true, 9), player('Lee', false, 300)] }),
      party({ partyId: 'KXYZ', players: [player('Zed', true, 0), player('Ann', true, 20)] }), // Zed: not measured yet
    ];
    expect(partyNumbers(parties)).toEqual({ parties: 2, singing: 1, singers: 4, ping: 9 });
    expect(partyNumbers([])).toEqual({ parties: 0, singing: 0, singers: 0, ping: null });
  });
});

describe('a site\'s builds and pages', () => {
  it('a commit by its first eight characters', () => {
    expect(shortBuild('a2f91e20aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe('a2f91e20');
    expect(shortBuild(null)).toBeNull();
    expect(shortBuild('')).toBeNull();
  });

  it('the copy of the crawler pages against the home site\'s', () => {
    const written = { hash: 'h2', at: NOW - 3 * 3_600_000, copiedAt: null };
    const home = site('home', written);
    expect(pagesState(home, home, NOW)).toBe('written');
    expect(pagesState(site('ohio', { hash: 'h2', at: written.at, copiedAt: NOW - 600_000 }), home, NOW)).toBe('same');
    // other pages than the home site's, which are older than a fetch takes: behind
    expect(pagesState(site('ohio', { hash: 'h1', at: 1, copiedAt: NOW - 600_000 }), home, NOW)).toBe('behind');
    // the home site just wrote new ones: the copy cannot be here yet
    const fresh = site('home', { hash: 'h3', at: NOW - 5 * 60_000, copiedAt: null });
    expect(pagesState(site('ohio', { hash: 'h2', at: written.at, copiedAt: NOW - 600_000 }), fresh, NOW)).toBe('arriving');
    expect(pagesState(site('ohio', null), home, NOW)).toBe('none');
    expect(pagesState(site('ohio', { hash: null, at: null, copiedAt: null }), home, NOW)).toBe('none');
    // nothing to hold it against: no home site, one that is quiet, or one without pages
    const copy = site('ohio', { hash: 'h1', at: 1, copiedAt: NOW });
    expect(pagesState(copy, undefined, NOW)).toBe('unknown');
    expect(pagesState(copy, site('home', written, { quiet: true }), NOW)).toBe('unknown');
    expect(pagesState(copy, site('home', null), NOW)).toBe('unknown');
  });

  it('whether something wants a look at one part of one site', () => {
    const problems: SiteProblem[] = [{ site: 'ohio', kind: 'backend', detail: 'ffff0000' }, { site: 'asia', kind: 'disk', detail: '900' }];
    expect(hasProblem(problems, 'ohio', 'backend')).toBe(true);
    expect(hasProblem(problems, 'ohio', 'frontend', 'disk')).toBe(false);
    expect(hasProblem(problems, 'asia', 'backend', 'disk')).toBe(true);
    expect(hasProblem([], 'ohio', 'backend')).toBe(false);
  });
});

describe('the words of the Sites tab', () => {
  const KINDS: SiteProblem['kind'][] = ['quiet', 'never', 'backend', 'frontend', 'link', 'stale', 'setAside', 'pages', 'disk'];
  const STATES = ['written', 'same', 'arriving', 'behind', 'none', 'unknown'];
  /** Every key below `value`, dotted */
  const keys = (value: unknown, prefix = ''): string[] => (value && typeof value === 'object'
    ? Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
    : [prefix]);

  it('are there in both of the console\'s languages, for every kind of problem and every state of the pages', () => {
    for (const words of [en, de]) {
      expect(Object.keys(words.admin.sites.problems).sort()).toEqual([...KINDS].sort());
      expect(Object.keys(words.admin.sites.pagesState).sort()).toEqual([...STATES].sort());
      expect(words.admin.tabs.sites).toBeTruthy();
    }
    expect(keys(de.admin.sites).sort()).toEqual(keys(en.admin.sites).sort());
    expect(keys(de.admin.stats).sort()).toEqual(keys(en.admin.stats).sort());
  });
});
