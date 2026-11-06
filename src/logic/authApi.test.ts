import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startEmailCode, verifyEmailCode } from './authApi';

describe('a sign-in code and what this browser sang as a guest', () => {
  const store = new Map<string, string>();
  const verifyBodies: { guestId?: string }[] = [];

  beforeEach(() => {
    store.clear();
    verifyBodies.length = 0;
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    });
    vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
      if (String(url).endsWith('/auth/email/verify')) verifyBodies.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('goes with a code this browser asked for, in the same tab or the mail link in a new one', async () => {
    await startEmailCode('Anna@example.com', 'en');
    await verifyEmailCode('anna@example.com', '123456');
    expect(verifyBodies[0].guestId).toBeTruthy();
  });

  it('stays here with a code that came by a link: the code may be someone else\'s', async () => {
    await verifyEmailCode('attacker@example.com', '123456');
    expect('guestId' in verifyBodies[0]).toBe(false);
  });

  it('stays here with a link for another address than the one asked for', async () => {
    await startEmailCode('anna@example.com', 'en');
    await verifyEmailCode('attacker@example.com', '123456');
    expect('guestId' in verifyBodies[0]).toBe(false);
  });

  it('stays here once the code asked for has run out', async () => {
    vi.useFakeTimers();
    await startEmailCode('anna@example.com', 'en');
    vi.advanceTimersByTime(11 * 60 * 1000);
    await verifyEmailCode('anna@example.com', '123456');
    expect('guestId' in verifyBodies[0]).toBe(false);
  });

  it('goes where storage is off, within the page that asked', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('off'); }, setItem: () => { throw new Error('off'); } });
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {} });
    await startEmailCode('anna@example.com', 'en');
    await verifyEmailCode('anna@example.com', '123456');
    expect(verifyBodies[0].guestId).toBeTruthy();
  });
});
