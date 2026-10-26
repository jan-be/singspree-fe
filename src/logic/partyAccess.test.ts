import { describe, it, expect, vi } from 'vitest';
import { createPartyAccess, fetchInParty, makeParty, PARTY_WAIT_MS } from './partyAccess';

describe('createPartyAccess', () => {
  it('waits until the page is in its party', async () => {
    const access = createPartyAccess();
    const waiting = access.wait(1000);
    access.open();
    expect(await waiting).toBe(true);
    expect(await access.wait(1000)).toBe(true);
    expect(access.ready).toBe(true);
  });

  it('waits as long as a slow connection takes to make the party (20 s seen, 2026-10-24)', async () => {
    vi.useFakeTimers();
    try {
      const access = createPartyAccess();
      let answered: boolean | null = null;
      access.wait().then(v => { answered = v; });
      await vi.advanceTimersByTimeAsync(20_000);
      expect(answered).toBe(null);
      access.open();
      await vi.advanceTimersByTimeAsync(0);
      expect(answered).toBe(true);
      expect(PARTY_WAIT_MS).toBeGreaterThanOrEqual(20_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops waiting at once when the page could not make its party, until it is in one after all', async () => {
    const access = createPartyAccess();
    const waiting = access.wait(60_000);
    access.fail();
    expect(await waiting).toBe(false);
    expect(await access.wait(60_000)).toBe(false);
    access.open();
    expect(await access.wait(60_000)).toBe(true);
    access.fail(); // in it: nothing to give up
    expect(await access.wait(60_000)).toBe(true);
  });

  it('gives up after the timeout (the request goes anyway, and is retried on a 403)', async () => {
    vi.useFakeTimers();
    try {
      const access = createPartyAccess();
      const waiting = access.wait(500);
      vi.advanceTimersByTime(501);
      expect(await waiting).toBe(false);
      access.open(); // a late open does not trip over the waiter that gave up
      expect(access.ready).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('fetchInParty', () => {
  const answers = (...statuses: number[]) => {
    const calls: string[] = [];
    return { calls, fetchImpl: async (u: string) => { calls.push(u); return new Response(null, { status: statuses[Math.min(calls.length - 1, statuses.length - 1)] }); } };
  };
  const sleep = async () => {};

  it('tries again while the server says the page is not in the party yet', async () => {
    const f = answers(403, 403, 200);
    const r = await fetchInParty('/api/songs/s1', { fetchImpl: f.fetchImpl, sleep });
    expect(r.status).toBe(200);
    expect(f.calls).toHaveLength(3);
  });

  it('stops after `tries`, and does not retry anything but a 403', async () => {
    const refused = answers(403);
    expect((await fetchInParty('/x', { tries: 4, fetchImpl: refused.fetchImpl, sleep })).status).toBe(403);
    expect(refused.calls).toHaveLength(4);
    const missing = answers(404);
    expect((await fetchInParty('/x', { fetchImpl: missing.fetchImpl, sleep })).status).toBe(404);
    expect(missing.calls).toHaveLength(1);
  });
});

describe('makeParty', () => {
  const sleeps: number[] = [];
  const sleep = async (ms: number) => { sleeps.push(ms); };

  it('tries again when the request is lost or answered without a party, waiting longer each time', async () => {
    sleeps.length = 0;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let n = 0;
    const id = await makeParty(async () => {
      n++;
      if (n === 1) throw new TypeError('Failed to fetch');
      return n === 2 ? null : 'ABCD';
    }, { sleep });
    expect(id).toBe('ABCD');
    expect(n).toBe(3);
    expect(sleeps).toEqual([1500, 3000]);
    errors.mockRestore();
  });

  it('null after `tries`, or once the page went away', async () => {
    let n = 0;
    expect(await makeParty(async () => { n++; return null; }, { tries: 3, sleep })).toBe(null);
    expect(n).toBe(3);
    let stopped = false;
    n = 0;
    expect(await makeParty(async () => { n++; stopped = true; return null; }, { sleep, stopped: () => stopped })).toBe(null);
    expect(n).toBe(1);
  });
});
