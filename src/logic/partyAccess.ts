/**
 * The server serves a song's chart and stems only to the browsers in a party
 * that sings it (singspree-be contentGate.ts: a cookie, joined to the party by
 * the page's socket). So this page asks for a chart once it is in its party:
 * the host's page once it made the party, a joiner's once its socket joined.
 * A request that comes too early anyway (a slow socket, a first visit whose
 * cookie arrived with the handshake) is refused with 403 and tried again.
 */

/** Whether the page is in its party yet (createPartyAccess) */
export interface PartyAccess {
  readonly ready: boolean;
  open(): void;
  fail(): void;
  wait(timeoutMs?: number): Promise<boolean>;
}

/**
 * How long a chart waits for the page's party at most. Long: on a slow
 * connection the host's party came 8 to 20 s after the page asked who is
 * signed in (2026-10-20..25), and a chart asked for before it is refused.
 * A page that cannot make its party says so (fail) and does not wait.
 */
export const PARTY_WAIT_MS = 30_000;

/** fetchInParty's tries, and what tests replace */
export interface FetchInPartyOptions {
  tries?: number;
  delayMs?: number;
  fetchImpl?: (url: string) => Promise<Response>;
  sleep?: (ms: number) => Promise<unknown>;
}

/**
 * open() once the page is in its party; wait(ms) resolves true then, or false
 * after ms. fail(): the page will not get a party (its own could not be made):
 * waits end now, false, until it opens after all.
 */
export function createPartyAccess(): PartyAccess {
  let ready = false;
  let failed = false;
  const waiters: ((v: boolean) => void)[] = [];
  return {
    get ready() { return ready; },
    open() {
      if (ready) return;
      ready = true;
      for (const done of waiters.splice(0)) done(true);
    },
    fail() {
      if (ready) return;
      failed = true;
      for (const done of waiters.splice(0)) done(false);
    },
    wait(timeoutMs = PARTY_WAIT_MS) {
      if (ready) return Promise.resolve(true);
      if (failed) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        const done = (v: boolean) => { clearTimeout(timer); resolve(v); };
        const timer = setTimeout(() => {
          const i = waiters.indexOf(done);
          if (i >= 0) waiters.splice(i, 1);
          resolve(false);
        }, timeoutMs);
        waiters.push(done);
      });
    },
  };
}

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** makeParty's tries, and what tests replace; stopped(): the page went away */
export interface MakePartyOptions {
  tries?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<unknown>;
  stopped?: () => boolean;
}

/**
 * The host page's party: create() (POST /parties, its code or null) until it
 * gives a code, `tries` times, waiting longer each time: a request lost on a
 * poor connection left the page without a party, and its chart was refused.
 * null when it never did, or the page went away.
 */
export async function makeParty(create: () => Promise<string | null>, { tries = 3, delayMs = 1500, sleep = pause, stopped = () => false }: MakePartyOptions = {}): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    if (i) await sleep(delayMs * i);
    if (stopped()) return null;
    try {
      const id = await create();
      if (id) return id;
    } catch (e) {
      console.error("Failed to auto-create party", e);
    }
  }
  return null;
}

/** fetch(url), tried again while the server refuses it for want of a party (403): the page may be joining just now */
export async function fetchInParty(url: string, { tries = 4, delayMs = 800, fetchImpl = (u) => fetch(u), sleep = pause }: FetchInPartyOptions = {}): Promise<Response> {
  for (let i = 0; ; i++) {
    const resp = await fetchImpl(url);
    if (resp.status !== 403 || i >= tries - 1) return resp;
    await sleep(delayMs * (i + 1));
  }
}
