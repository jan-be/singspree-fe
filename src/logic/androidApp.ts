/**
 * The Android app from Google Play (com.singspree.app): singspree.com in Chrome as a Trusted Web
 * Activity, so the user agent is Chrome's own. What tells it apart is the referrer Chrome gives the
 * page the app opens, android-app://com.singspree.app/. The page notes it in sessionStorage as it
 * starts (index.tsx), for later route changes and full page loads in the same app window. In it the
 * page leaves out the Google Play and App Store icons (SocialLinks), which only lead to pages about
 * getting the apps, as in the Fire TV app (logic/tvApp.ts), and the Android test card (appTestPrompt).
 */
import { inTvApp } from './tvApp';

const KEY = 'singspree_android_app';

/** The app's own referrer; a link opened from another Android app gets that app's name there */
const APP_REFERRER = /^android-app:\/\/com\.singspree\.app(\/|$)/;

export function inAndroidApp(): boolean {
  if (typeof document === 'undefined') return false;
  if (APP_REFERRER.test(document.referrer ?? '')) {
    try { globalThis.sessionStorage?.setItem(KEY, '1'); } catch { /* storage off: the referrer still holds */ }
    return true;
  }
  try { return globalThis.sessionStorage?.getItem(KEY) === '1'; } catch { return false; }
}

/** In one of our apps, Fire TV or Google Play: no website footer there, its links are in the top bar's menu (AppMenu) */
export const inOurApp = (): boolean => inTvApp() || inAndroidApp();
