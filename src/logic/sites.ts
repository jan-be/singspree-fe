/**
 * More than one site (home, ohio, asia): a party lives at one of them, and a
 * singer's notes reach the screen through that site. So a host's page makes
 * its party at the site that answers it fastest (nearestSite), and every page
 * in a party talks to the party's site: its API paths and its socket carry
 * the site's name (/api/s/<site>/..., partyApi). The party's code says which
 * site that is (siteOfParty; backend sites.ts makes the codes that way).
 *
 * Everything that is not a party's own traffic keeps asking plain /api, which
 * the edge sends to the nearest site.
 *
 * GET /api/sites lists the sites. Where there is one site it lists none (and
 * an older backend does not know the route): then nothing here adds a prefix
 * and every page works as before.
 *
 * One site may be the home site: the only one with the stems and the
 * recordings on its disk, and the one that makes the charts (GET /api/sites
 * names it). Then:
 * - A chart from another site says so (homeAtOf), with this browser's pass
 *   for that song. The page fetches the song's stems at the home site with it
 *   (stemUrls) and sends its take of the song there (recordingUrl).
 * - What only the home site answers (homeBound: recordings, chart requests,
 *   the admin pages) is asked there (apiFor), whichever site is nearest.
 * These are files and requests, not a singer's notes: how far that site is
 * costs a moment, not on screen.
 */
import { useEffect, useState } from 'react';
import { apiUrl } from '../GlobalConsts';

export interface Site {
  name: string;
  number: number;
}

/** As the backend's sites.ts: a code's characters, and the groups its first character falls into */
export const PARTY_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SITE_SLOTS = 8;

let known: Site[] = [];
let home: string | null = null;
let loading: Promise<Site[]> | null = null;
let settled = false;

/**
 * How long the list of sites may take. A party page waits for it before it opens its socket, so a request that
 * hangs must not hold the page: after this the page goes on as where there is one site.
 */
export const SITES_TIMEOUT_MS = 4000;

/** A signal that gives up after `ms`, and the way to call that off (AbortSignal.timeout is missing in browsers from before 2022, which still come) */
function givingUpAfter(ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

/** The sites, asked once per page load; none where there is one site or the list cannot be had (in time) */
export function loadSites(fetcher: typeof fetch = fetch): Promise<Site[]> {
  let named: string | null = null; // the home site, as this answer names it
  loading ??= (async () => {
    const wait = givingUpAfter(SITES_TIMEOUT_MS);
    try {
      const response = await fetcher(`${apiUrl}/sites`, { signal: wait.signal });
      if (!response.ok) return [];
      const data: { sites?: unknown; home?: unknown } | undefined = (await response.json())?.data;
      const sites = data?.sites;
      if (!Array.isArray(sites)) return [];
      // (more than one, or there is nothing to choose between)
      const listed = sites.filter((s): s is Site => typeof s?.name === 'string' && /^[a-z][a-z0-9-]{0,15}$/.test(s.name) && Number.isInteger(s?.number));
      if (listed.length < 2) return [];
      named = listed.some(s => s.name === data?.home) ? String(data?.home) : null;
      return listed;
    } catch {
      return [];
    } finally {
      wait.done();
    }
  })().then((sites) => { known = sites; home = sites.length ? named : null; settled = true; return sites; });
  return loading;
}

/**
 * Whether the list of sites is in. A party page waits for it before it opens
 * its socket: the socket's address depends on it, and a page that asked the
 * wrong site would be told its party is not there.
 */
export function useSitesReady(): boolean {
  const [ready, setReady] = useState(settled);
  useEffect(() => {
    if (ready) return;
    let gone = false;
    loadSites().then(() => { if (!gone) setReady(true); });
    return () => { gone = true; };
  }, [ready]);
  return ready;
}

/** For tests: the list as if it had been loaded (null: not loaded yet), and the home site among them */
export function setSites(sites: Site[] | null, homeSite: string | null = null): void {
  known = sites ?? [];
  home = sites ? homeSite : null;
  loading = sites ? Promise.resolve(sites) : null;
  settled = sites !== null;
}

/**
 * What only the home site answers: a recording is saved, mixed, cut into a video and deleted where the recordings
 * are, and a chart is asked for where the generator is (the backend's sites.ts has the same list, and a site asked
 * for one of these by mistake says so). The admin pages go there too: their switches are flipped at the home site.
 */
const HOME_BOUND = [
  /^\/recordings(?:[/?]|$)/,
  /^\/takes\//,
  /^\/me\/takes(?:[/?]|$)/,
  /^\/parties\/[^/]+\/recap\/takes\//,
  /^\/chart-jobs(?:[/?]|$)/,
  /^\/admin\//,
];

/** Whether an API path (as after /api) is one of those */
export const homeBound = (path: string): boolean => HOME_BOUND.some(pattern => pattern.test(path));

/** Where an API path is asked: at the home site for what only it answers, plain /api for everything else (and where there is no home site) */
export const apiFor = (path: string): string => (home && homeBound(path) ? siteApi(home) : apiUrl);

/**
 * The same for a request made as the page loads: it waits for the list of sites where the answer depends on it.
 * (For the list being asked for, as index.tsx does at the start; it does not ask by itself.)
 */
export async function apiWhenKnown(path: string): Promise<string> {
  if (loading && homeBound(path)) await loading;
  return apiFor(path);
}

/** The site a party lives at, by its code; null where there is one site, or for a code of no listed site */
export function siteOfParty(partyId: string | null | undefined, sites: Site[] = known): string | null {
  const first = partyId?.[0]?.toUpperCase();
  const i = first ? PARTY_CODE_CHARS.indexOf(first) : -1;
  if (i < 0) return null;
  return sites.find(s => s.number - 1 === i % SITE_SLOTS)?.name ?? null;
}

/** Where to ask a site: /api/s/<site>; plain /api without one */
export const siteApi = (site: string | null | undefined): string => (site ? `${apiUrl}/s/${site}` : apiUrl);

/** Where a page in this party asks what is the party's own (its socket, its charts and stems, its recordings) */
export const partyApi = (partyId: string | null | undefined, sites: Site[] = known): string => siteApi(siteOfParty(partyId, sites));

/** Where a song's stems and recordings are when not at the party's site: the home site, and this browser's pass for the song there (backend stemPass.ts) */
export interface HomeAt {
  site: string;
  pass?: string;
}

/** What a chart's answer says about that (its `home`): null unless it names a listed site; a pass only if it looks like one */
export function homeAtOf(answer: unknown, sites: Site[] = known): HomeAt | null {
  const at = answer as { site?: unknown; pass?: unknown } | null | undefined;
  const site = at?.site;
  if (typeof site !== 'string' || !sites.some(s => s.name === site)) return null;
  return { site, ...(typeof at?.pass === 'string' && /^[\w.-]{1,120}$/.test(at.pass) ? { pass: at.pass } : {}) };
}

/**
 * A song's two stems: at the party's site, or at the site that has them (`at`), with the pass. caf: ask for
 * Apple's container (the server answers with the Ogg file where it has none).
 */
export function stemUrls(partyId: string | null | undefined, songId: string, { at = null, caf = false, sites = known }: { at?: HomeAt | null; caf?: boolean; sites?: Site[] } = {}): { karaoke: string; vocals: string } {
  const base = at ? siteApi(at.site) : partyApi(partyId, sites);
  const query = [caf ? 'format=caf' : '', at?.pass ? `pass=${encodeURIComponent(at.pass)}` : ''].filter(Boolean).join('&');
  const url = (stem: string) => `${base}/songs/${songId}/${stem}${query ? `?${query}` : ''}`;
  return { karaoke: url('karaoke'), vocals: url('vocals') };
}

// This browser's passes at the home site, by song: a take is sent when its song is over, and the page may be on the
// next one by then
const passes = new Map<string, string>();
const PASSES_KEPT = 50;

/** Keep a chart's pass for its song (what homeAtOf read) */
export function rememberHomePass(songId: string, at: HomeAt | null): void {
  if (!at?.pass) return;
  passes.delete(songId);
  passes.set(songId, at.pass);
  const oldest = passes.keys().next();
  if (passes.size > PASSES_KEPT && !oldest.done) passes.delete(oldest.value);
}

/**
 * Where a take of a song is sent: the home site, with the pass the song's chart came with (that site does not know
 * the party), or where there is no home site, the party's own (the one that knows this browser sang the song).
 */
export async function recordingUrl(partyId: string | null | undefined, songId: string | null | undefined): Promise<string> {
  if (loading) await loading;
  if (!home) return `${partyApi(partyId)}/recordings`;
  const pass = songId ? passes.get(songId) : undefined;
  return `${siteApi(home)}/recordings${pass ? `?pass=${encodeURIComponent(pass)}` : ''}`;
}

/** The socket's address under an API path: same origin as the page (ws for http, wss for https); '' where there is no page (tests) */
export const socketUrl = (api: string = apiUrl, loc: Pick<Location, 'protocol' | 'host'> | undefined = typeof window !== 'undefined' ? window.location : undefined): string =>
  (loc ? `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}${api}/ws` : '');

/** How long one site may take to answer a ping before it is out of the running */
export const PING_TIMEOUT_MS = 2500;

/** One ping of a site in ms; rejects when it does not answer (in time) */
export type Ping = (site: string) => Promise<number>;

const pingSite: Ping = async (site) => {
  const started = performance.now();
  const wait = givingUpAfter(PING_TIMEOUT_MS);
  try {
    const response = await fetch(`${siteApi(site)}/ping`, { cache: 'no-store', signal: wait.signal });
    if (!response.ok) throw new Error(`ping ${response.status}`);
    return performance.now() - started;
  } finally {
    wait.done();
  }
};

/**
 * The site that answers this page fastest: each is pinged `tries` times (all
 * sites at once, one site's pings one after another; the first one also pays
 * for the connection), and a site's best time counts. A site that fails a
 * ping is out. null: there is one site, or none answered (the party is then
 * made under plain /api, wherever the edge sends it).
 */
export async function nearestSite({ sites, ping = pingSite, tries = 3 }: { sites?: Site[]; ping?: Ping; tries?: number } = {}): Promise<string | null> {
  const all = sites ?? await loadSites();
  if (all.length < 2) return null;
  const times = await Promise.all(all.map(async (site) => {
    let best = Infinity;
    try {
      for (let i = 0; i < tries; i++) best = Math.min(best, await ping(site.name));
    } catch {
      return Infinity;
    }
    return best;
  }));
  const fastest = Math.min(...times);
  return Number.isFinite(fastest) ? all[times.indexOf(fastest)]!.name : null;
}
