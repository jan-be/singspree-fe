/**
 * More than one site (home, ohio, asia) behind the one name. Every site has
 * the same routes, and the app asks plain /api/... wherever it is. Which site
 * answers is the edge router's business (the infra repository's
 * edge/router.js): the nearest one, except for what only one site can answer.
 *
 * - A party lives at the site that made it, the one nearest its host, and a
 *   singer's notes reach the screen through that site. A request that is a
 *   party's own therefore says which party: its code is in the path
 *   (/parties/<code>/...), or the request carries ?party=<code> (partyUrl: the
 *   socket, a song's chart). The router reads the site off the code.
 * - The stems, the recordings, chart requests and the admin pages are the
 *   home site's. The router knows those paths; nothing here does.
 *
 * Where there is one site (and in development) ?party= means nothing to
 * anyone, and everything works as it always did.
 *
 * A chart that comes from a site without the stems carries this browser's
 * pass for the song at the site that has them (its `home`: backend
 * stemPass.ts). The page shows the pass when it fetches the song's stems
 * (stemUrls) and sends its take of the song (recordingUrl).
 */
import { apiUrl } from '../GlobalConsts';

/** A URL with the party it belongs to named (?party=<code>), for the edge router; as it is without a party */
export function partyUrl(url: string, partyId: string | null | undefined): string {
  if (!partyId || !/^[A-Za-z0-9]{4}$/.test(partyId)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}party=${partyId}`;
}

/** This browser's pass for a song at the site with the stems: what a chart's answer says in its `home`; null without one (or what does not look like one) */
export function homePassOf(answer: unknown): string | null {
  const pass = (answer as { pass?: unknown } | null | undefined)?.pass;
  return typeof pass === 'string' && /^[\w.-]{1,120}$/.test(pass) ? pass : null;
}

/**
 * A song's two stems, with the pass if its chart came with one. caf: ask for Apple's container (the server answers
 * with the Ogg file where it has none). No party is named: the browser keeps a stem for a day under its address,
 * and the same song in tonight's second party is the same file.
 */
export function stemUrls(songId: string, { pass = null, caf = false }: { pass?: string | null; caf?: boolean } = {}): { karaoke: string; vocals: string } {
  const query = [caf ? 'format=caf' : '', pass ? `pass=${encodeURIComponent(pass)}` : ''].filter(Boolean).join('&');
  const url = (stem: string) => `${apiUrl}/songs/${songId}/${stem}${query ? `?${query}` : ''}`;
  return { karaoke: url('karaoke'), vocals: url('vocals') };
}

// This browser's passes, by song: a take is sent when its song is over, and the page may be on the next one by then
const passes = new Map<string, string>();
const PASSES_KEPT = 50;

/** Keep a chart's pass for its song (what homePassOf read) */
export function rememberHomePass(songId: string, pass: string | null): void {
  if (!pass) return;
  passes.delete(songId);
  passes.set(songId, pass);
  const oldest = passes.keys().next();
  if (passes.size > PASSES_KEPT && !oldest.done) passes.delete(oldest.value);
}

/** For tests: forget the passes */
export function forgetHomePasses(): void {
  passes.clear();
}

/** Where a take of a song is sent, with the pass the song's chart came with (the site with the recordings does not know a party that lives elsewhere) */
export function recordingUrl(songId: string | null | undefined): string {
  const pass = songId ? passes.get(songId) : undefined;
  return `${apiUrl}/recordings${pass ? `?pass=${encodeURIComponent(pass)}` : ''}`;
}

/** A party's socket: same origin as the page (ws for http, wss for https), the party named; '' where there is no page (tests) */
export const socketUrl = (partyId?: string | null, loc: Pick<Location, 'protocol' | 'host'> | undefined = typeof window !== 'undefined' ? window.location : undefined): string =>
  (loc ? partyUrl(`${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}${apiUrl}/ws`, partyId) : '');
