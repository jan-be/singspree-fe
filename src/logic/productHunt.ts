import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { claimChartBonus, type ChartQuota } from './chartJobs';
import { inTvApp } from './tvApp';

/**
 * SingSpree's launch on Product Hunt (Nov 14 2026). The home page's banner
 * (components/ProductHuntBanner.tsx) asks visitors to stop by there, and as a
 * thank-you whoever clicks gets more AI charts a day for a month (backend
 * chartJobs.ts, chart_bonuses: once per account). Nobody can see what they do
 * there, so the click is enough. Product Hunt's rules forbid rewards for
 * upvotes, so the banner never asks for one.
 *
 * A visitor who is signed out is remembered in this browser and gets the bonus
 * once they sign in (useClaimRememberedBonus, on the home and settings pages).
 */

export const PRODUCT_HUNT_URL = 'https://www.producthunt.com/products/singspree';
/** The banner shows until then: the launch day and the week after it (Product Hunt's days are Pacific time) */
export const PRODUCT_HUNT_UNTIL = Date.parse('2026-11-22T08:00:00Z');
/** What the bonus gives (the backend's CHARTGEN_BONUS_DAILY), for the banner's words */
export const BONUS_DAILY = 10;

const KEY = 'singspree_product_hunt';
/** closed: ✕ on the banner; pending: clicked while signed out; claimed: the account has it */
type State = 'closed' | 'pending' | 'claimed';

const read = (): State | null => {
  try { return localStorage.getItem(KEY) as State | null; } catch { return null; }
};
export const remember = (state: State) => {
  try { localStorage.setItem(KEY, state); } catch { /* blocked: the banner comes back */ }
};

/** Whether the banner shows on this visit: while the launch runs, not on a TV, until it was clicked or closed */
export const bannerDue = (now = Date.now()) => now < PRODUCT_HUNT_UNTIL && !inTvApp() && read() === null;
/** Whether the settings page offers it: while the launch runs, not on a TV */
export const offerDue = (now = Date.now()) => now < PRODUCT_HUNT_UNTIL && !inTvApp();

/** The bonus for the signed-in account -> its quota; remembered for a later try when that fails */
export async function claimBonus(): Promise<ChartQuota> {
  try {
    const quota = await claimChartBonus();
    remember('claimed');
    return quota;
  } catch (e) {
    remember('pending');
    throw e;
  }
}

/** A click from before signing in: the bonus for the account once someone is signed in here (onClaimed: its quota) */
export function useClaimRememberedBonus(onClaimed?: (quota: ChartQuota) => void) {
  const { user } = useAuth();
  const signedIn = Boolean(user);
  useEffect(() => {
    if (!signedIn || read() !== 'pending') return;
    let on = true;
    claimBonus().then(q => { if (on) onClaimed?.(q); }).catch(() => {});
    return () => { on = false; };
  }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps
}
