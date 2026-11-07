import { feedbackCounts } from './feedbackPrompt';
import { standalone } from './installPrompt';
import { songPrompt } from './songPrompt';

/**
 * When to suggest the Android app's closed test (AppTestPrompt.tsx): by the
 * rules of logic/songPrompt.ts, for now in the place of the feedback question
 * on Android. Having answered or closed that one says nothing about this one,
 * so this has a record of its own, going by the songs counted for that one.
 */
export const {
  ask, moveOn, engage, markAnswered, closePrompt,
  usePrompt: useAppTestPrompt, reset: _resetAppTestPrompt,
} = songPrompt('singspree_app_test', () => feedbackCounts().songs);

/** Android that is no use for the test: TVs and Fire tablets, which have no Google Play or no one's own phone behind them */
const TV_OR_FIRE = /\bTV\b|Silk|AFT[A-Z]|GoogleTV|SmartTV|SMART-TV|BRAVIA|Chromecast|CrKey/i;

/** Launched from the Android app: the first page's referrer, which stays for a single-page app */
const inAndroidApp = () => typeof document !== 'undefined' && document.referrer.startsWith('android-app://');

/** Whether this browser gets the suggestion: an Android phone or tablet, and not in the app, whose users are testers already */
export function suggestsAppTest() {
  const ua = globalThis.navigator?.userAgent ?? '';
  return /Android/.test(ua) && !TV_OR_FIRE.test(ua) && !standalone() && !inAndroidApp();
}
