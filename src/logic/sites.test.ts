import { afterEach, describe, expect, it, vi } from 'vitest';
import { PARTY_CODE_CHARS, SITES_TIMEOUT_MS, SITE_SLOTS, apiFor, apiWhenKnown, homeAtOf, homeBound, loadSites, nearestSite, partyApi, recordingUrl, rememberHomePass, setSites, siteApi, siteOfParty, socketUrl, stemUrls, type Site } from './sites';

const THREE: Site[] = [{ name: 'home', number: 1 }, { name: 'ohio', number: 2 }, { name: 'asia', number: 3 }];
/** A code as the site with this number makes them: the first character from its group */
const codeOf = (number: number) => `${[...PARTY_CODE_CHARS].find((_, i) => i % SITE_SLOTS === number - 1)}XYZ`;
const answering = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response);

afterEach(() => setSites(null));

describe('loadSites', () => {
  it('lists the sites the backend names, asking once', async () => {
    const fetcher = answering({ success: true, data: { site: 'ohio', sites: THREE } });
    expect(await loadSites(fetcher)).toEqual(THREE);
    expect(await loadSites(fetcher)).toEqual(THREE);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/api/sites', expect.objectContaining({ signal: expect.anything() }));
  });

  it('a request that hangs does not hold the page: after a few seconds it goes on as where there is one site', async () => {
    vi.useFakeTimers();
    try {
      // (answers only when it is given up on, as a browser's fetch does)
      const hanging = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('gave up', 'AbortError')));
      })) as unknown as typeof fetch;
      const listed = loadSites(hanging);
      let settled = false;
      void listed.then(() => { settled = true; });
      await vi.advanceTimersByTimeAsync(SITES_TIMEOUT_MS - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      expect(await listed).toEqual([]);
      expect(partyApi('ABCD')).toBe('/api');
      expect(await apiWhenKnown('/chart-jobs/access')).toBe('/api');
    } finally {
      vi.useRealTimers();
    }
  });

  it('one site, an older backend, a failed request: no sites, and the page works as before', async () => {
    for (const fetcher of [
      answering({ success: true, data: { site: null, sites: [] } }),
      answering({ success: true, data: { site: 'home', sites: [THREE[0]] } }), // one listed: nothing to choose between
      answering({ error: 'not found' }, false),
      answering('<html>'),
      vi.fn(async () => { throw new Error('offline'); }),
    ]) {
      setSites(null);
      expect(await loadSites(fetcher as typeof fetch)).toEqual([]);
      expect(partyApi('ABCD')).toBe('/api');
    }
  });

  it('leaves out what is no site', async () => {
    const fetcher = answering({ data: { sites: [...THREE, { name: '../x', number: 4 }, { name: 'mars' }, null] } });
    expect(await loadSites(fetcher)).toEqual(THREE);
  });
});

describe('a party\'s site, by its code', () => {
  it('the site whose group the first character is in', () => {
    for (const site of THREE) expect(siteOfParty(codeOf(site.number), THREE)).toBe(site.name);
    expect(siteOfParty(codeOf(2).toLowerCase(), THREE)).toBe('ohio'); // as typed
  });

  it('no site: one site only, a code of a site not listed, no code', () => {
    expect(siteOfParty(codeOf(2), [])).toBeNull();
    expect(siteOfParty(codeOf(5), THREE)).toBeNull();
    for (const code of [undefined, null, '', '0ABC']) expect(siteOfParty(code, THREE)).toBeNull();
  });

  it('where its pages ask', () => {
    setSites(THREE);
    expect(partyApi(codeOf(3))).toBe('/api/s/asia');
    expect(partyApi(codeOf(1))).toBe('/api/s/home');
    expect(partyApi(undefined)).toBe('/api');
    expect(siteApi(null)).toBe('/api');
    expect(siteApi('ohio')).toBe('/api/s/ohio');
  });

  it('its socket', () => {
    expect(socketUrl('/api/s/asia', { protocol: 'https:', host: 'singspree.com' })).toBe('wss://singspree.com/api/s/asia/ws');
    expect(socketUrl('/api', { protocol: 'http:', host: 'localhost:3001' })).toBe('ws://localhost:3001/api/ws');
  });
});

describe('the home site: the one with the recordings and the chart generator', () => {
  const three: Site[] = [{ name: 'home', number: 1 }, { name: 'ohio', number: 2 }, { name: 'asia', number: 3 }];
  const answer = (data: unknown) => vi.fn(async () => new Response(JSON.stringify({ success: true, data }))) as unknown as typeof fetch;

  it('what only it answers is asked there, everything else at plain /api', async () => {
    await loadSites(answer({ site: 'asia', sites: three, home: 'home' }));
    for (const path of ['/recordings', '/takes/abc/audio?v=2', '/takes/abc/clip', '/me/takes', '/me/takes/abc', '/parties/CLEC/recap/takes/abc/audio',
      '/chart-jobs', '/chart-jobs/access', '/chart-jobs/12', '/chart-jobs/youtube?q=x', '/admin/chart-jobs?status=all', '/admin/users']) {
      expect(homeBound(path), path).toBe(true);
      expect(apiFor(path), path).toBe('/api/s/home');
      expect(await apiWhenKnown(path), path).toBe('/api/s/home');
    }
    for (const path of ['/songs/abc', '/songs/browse?limit=1', '/parties', '/parties/CLEC/recap', '/me', '/me/scores', '/auth/me', '/sites', '/takesx', '/administrator']) {
      expect(homeBound(path), path).toBe(false);
      expect(apiFor(path), path).toBe('/api');
    }
  });

  it('no home site named (every site has its own disk), a name that is no listed site, or one site: everything at plain /api', async () => {
    await loadSites(answer({ site: 'asia', sites: three }));
    expect(apiFor('/chart-jobs/access')).toBe('/api');
    setSites(null);
    await loadSites(answer({ site: 'asia', sites: three, home: 'mars' }));
    expect(apiFor('/takes/abc/audio')).toBe('/api');
    setSites(null);
    await loadSites(answer({ site: null, sites: [], home: null }));
    expect(await apiWhenKnown('/recordings')).toBe('/api');
  });

  it('a request made as the page loads waits for the list; without a page asking for the list it does not ask by itself', async () => {
    expect(await apiWhenKnown('/chart-jobs/access')).toBe('/api'); // (nothing loaded, nothing loading: as before)
    let done: (r: Response) => void = () => {};
    const slow = vi.fn(() => new Promise<Response>((resolve) => { done = resolve; })) as unknown as typeof fetch;
    const listed = loadSites(slow);
    const asked = apiWhenKnown('/chart-jobs/access');
    done(new Response(JSON.stringify({ success: true, data: { sites: three, home: 'home' } })));
    await listed;
    expect(await asked).toBe('/api/s/home');
  });

  it('a take goes there with the pass its song\'s chart came with; without a home site, to the party\'s own', async () => {
    setSites(three, 'home');
    rememberHomePass('song1', homeAtOf({ site: 'home', pass: 'mm0abc.Zm9v' }, three));
    rememberHomePass('song2', homeAtOf({ site: 'home' }, three)); // (no pass: nothing to keep)
    expect(await recordingUrl('CLEC', 'song1')).toBe('/api/s/home/recordings?pass=mm0abc.Zm9v');
    expect(await recordingUrl('CLEC', 'song2')).toBe('/api/s/home/recordings');
    expect(await recordingUrl('CLEC', null)).toBe('/api/s/home/recordings');
    setSites(three);
    expect(await recordingUrl('CLEC', 'song1')).toBe('/api/s/asia/recordings');
    setSites([]);
    expect(await recordingUrl('ABCD', 'song1')).toBe('/api/recordings');
  });
});

describe('stems at one site only', () => {
  const three: Site[] = [{ name: 'home', number: 1 }, { name: 'ohio', number: 2 }, { name: 'asia', number: 3 }];
  // (C is the third character: a code of site number 3)
  const asiaParty = 'CLEC';

  it('a chart that names the site and carries a pass: asked there, with the pass', () => {
    const at = homeAtOf({ site: 'home', pass: 'mm0abc.Zm9v_-' }, three);
    expect(at).toEqual({ site: 'home', pass: 'mm0abc.Zm9v_-' });
    expect(stemUrls(asiaParty, 'song1', { at, sites: three })).toEqual({
      karaoke: '/api/s/home/songs/song1/karaoke?pass=mm0abc.Zm9v_-',
      vocals: '/api/s/home/songs/song1/vocals?pass=mm0abc.Zm9v_-',
    });
    expect(stemUrls(asiaParty, 'song1', { at, caf: true, sites: three }).karaoke).toBe('/api/s/home/songs/song1/karaoke?format=caf&pass=mm0abc.Zm9v_-');
  });

  it('no word about another site: at the party\'s own, as before', () => {
    expect(siteOfParty(asiaParty, three)).toBe('asia');
    for (const answer of [undefined, null, {}, 'home', { site: 7 }, { pass: 'x' }]) expect(homeAtOf(answer, three)).toBeNull();
    expect(stemUrls(asiaParty, 'song1', { sites: three })).toEqual({ karaoke: '/api/s/asia/songs/song1/karaoke', vocals: '/api/s/asia/songs/song1/vocals' });
    expect(stemUrls(asiaParty, 'song1', { caf: true, sites: three }).vocals).toBe('/api/s/asia/songs/song1/vocals?format=caf');
    expect(stemUrls('ABCD', 'song1', { sites: [] }).karaoke).toBe('/api/songs/song1/karaoke'); // one site
  });

  it('a site that is not listed is not asked; what does not look like a pass is not sent', () => {
    expect(homeAtOf({ site: 'mars', pass: 'abc.def' }, three)).toBeNull();
    expect(homeAtOf({ site: '../evil', pass: 'abc.def' }, three)).toBeNull();
    expect(homeAtOf({ site: 'home' }, three)).toEqual({ site: 'home' });
    expect(homeAtOf({ site: 'home', pass: 'a b&c=d' }, three)).toEqual({ site: 'home' });
    expect(homeAtOf({ site: 'home', pass: 5 }, three)).toEqual({ site: 'home' });
    expect(stemUrls(asiaParty, 'song1', { at: { site: 'home' }, sites: three }).karaoke).toBe('/api/s/home/songs/song1/karaoke');
  });
});

describe('nearestSite', () => {
  const pinging = (ms: Record<string, number[] | 'down'>) => vi.fn(async (site: string) => {
    const times = ms[site];
    if (times === 'down' || !times?.length) throw new Error('no answer');
    return times.shift()!;
  });

  it('the site with the best time, the first (slow) try of each not counting against it', async () => {
    const ping = pinging({ home: [420, 190, 200], ohio: [300, 31, 35], asia: [500, 240, 250] });
    expect(await nearestSite({ sites: THREE, ping })).toBe('ohio');
    expect(ping).toHaveBeenCalledTimes(9);
  });

  it('a site that fails a try is out', async () => {
    expect(await nearestSite({ sites: THREE, ping: pinging({ home: [200, 190, 195], ohio: [30], asia: 'down' }) })).toBe('home');
  });

  it('none answers, or there is one site: no choice is made', async () => {
    expect(await nearestSite({ sites: THREE, ping: pinging({ home: 'down', ohio: 'down', asia: 'down' }) })).toBeNull();
    const ping = pinging({});
    expect(await nearestSite({ sites: [], ping })).toBeNull();
    expect(await nearestSite({ sites: [THREE[0]!], ping })).toBeNull();
    expect(ping).not.toHaveBeenCalled();
  });

  it('asks for the list when it has none', async () => {
    setSites(THREE);
    expect(await nearestSite({ ping: pinging({ home: [9, 9, 9], ohio: [5, 5, 5], asia: [7, 7, 7] }) })).toBe('ohio');
  });
});
