import { describe, test, expect, beforeEach, vi } from 'vitest';
import { suggestsAppTest, ask, moveOn, markAnswered, closePrompt, _resetAppTestPrompt } from './appTestPrompt';
import { noteSongFinished, ask as askFeedback, closePrompt as closeFeedback, markAnswered as answerFeedback, _resetFeedbackPrompt } from './feedbackPrompt';
import { MAX_SHOWN, SONGS_BEFORE_ASKING, SONGS_BETWEEN_ASKS } from './songPrompt';

// vitest runs in node: stand-ins for the browser
const items = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => items.get(k) ?? null,
  setItem: (k: string, v: unknown) => { items.set(k, String(v)); },
  removeItem: (k: string) => { items.delete(k); },
});

const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 Chrome/101.0 Safari/537.36';
const SAMSUNG_BROWSER = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36';
const FIRE_TV = 'Mozilla/5.0 (Linux; Android 9; AFTKA Build/PS7633) AppleWebKit/537.36 Silk/131.0 like Chrome/131.0 Safari/537.36';
const FIRE_TABLET = 'Mozilla/5.0 (Linux; Android 11; KFTUWI) AppleWebKit/537.36 Silk/120.0 like Chrome/120.0 Safari/537.36';
const ANDROID_TV = 'Mozilla/5.0 (Linux; Android 12; SHIELD Android TV) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const BRAVIA = 'Mozilla/5.0 (Linux; Android 10; BRAVIA 4K UR3) AppleWebKit/537.36 Chrome/110.0 Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15';

/** The browser it runs in; `standalone`: as an installed app */
const device = (userAgent: string, { referrer = '', standalone = false } = {}) => {
  vi.stubGlobal('navigator', { userAgent });
  vi.stubGlobal('document', { referrer });
  vi.stubGlobal('window', { navigator: {}, matchMedia: () => ({ matches: standalone }) });
};

/** `n` songs through to the end, counted as the party page counts them */
const sing = (n: number) => { for (let i = 0; i < n; i++) noteSongFinished('P1'); };

describe('suggestsAppTest', () => {
  test.each([ANDROID_PHONE, ANDROID_TABLET, SAMSUNG_BROWSER])('on Android phones and tablets: %s', (ua) => {
    device(ua);
    expect(suggestsAppTest()).toBe(true);
  });

  test.each([WINDOWS, MAC, IPHONE])('nowhere else: %s', (ua) => {
    device(ua);
    expect(suggestsAppTest()).toBe(false);
  });

  test.each([FIRE_TV, FIRE_TABLET, ANDROID_TV, BRAVIA])('not on TVs and Fire tablets, which run Android too: %s', (ua) => {
    device(ua);
    expect(suggestsAppTest()).toBe(false);
  });

  test('not in the app already', () => {
    device(ANDROID_PHONE, { referrer: 'android-app://com.singspree.app/' });
    expect(suggestsAppTest()).toBe(false);
    device(ANDROID_PHONE, { standalone: true });
    expect(suggestsAppTest()).toBe(false);
    device(ANDROID_PHONE, { referrer: 'https://www.google.com/' });
    expect(suggestsAppTest()).toBe(true);
  });
});

describe('appTestPrompt', () => {
  beforeEach(() => {
    moveOn(true);
    _resetAppTestPrompt(); _resetFeedbackPrompt(); items.clear();
  });

  test('asks after a few songs, counted once', () => {
    sing(SONGS_BEFORE_ASKING - 1);
    expect(ask('party')).toBe(false);
    sing(1);
    expect(ask('party')).toBe(true);
    moveOn(true);
    expect(ask('party')).toBe(false); // just shown
    sing(SONGS_BETWEEN_ASKS);
    expect(ask('party')).toBe(true);
  });

  test('having closed or answered the feedback question ends nothing here, and songs go on counting', () => {
    sing(SONGS_BEFORE_ASKING);
    askFeedback('party');
    closeFeedback();
    expect(ask('party')).toBe(true);
    moveOn(true);
    sing(SONGS_BETWEEN_ASKS);
    expect(ask('party')).toBe(true);
    moveOn(true);

    _resetAppTestPrompt(); _resetFeedbackPrompt(); items.clear();
    sing(SONGS_BEFORE_ASKING);
    askFeedback('party');
    answerFeedback();
    closeFeedback();
    expect(ask('party')).toBe(true);
  });

  test('an address given ends it, and so does the ✕', () => {
    sing(SONGS_BEFORE_ASKING);
    expect(ask('party')).toBe(true);
    markAnswered();
    closePrompt();
    sing(SONGS_BETWEEN_ASKS * MAX_SHOWN);
    expect(ask('party')).toBe(false);

    _resetAppTestPrompt(); _resetFeedbackPrompt(); items.clear();
    sing(SONGS_BEFORE_ASKING);
    expect(ask('party')).toBe(true);
    closePrompt();
    sing(SONGS_BETWEEN_ASKS);
    expect(ask('party')).toBe(false);
  });

  test('an address given on /android, without the card, ends it too', () => {
    markAnswered();
    sing(SONGS_BEFORE_ASKING);
    expect(ask('party')).toBe(false);
  });

  test('being asked here leaves the feedback question as it was', () => {
    sing(SONGS_BEFORE_ASKING);
    ask('party');
    closePrompt();
    expect(JSON.parse(items.get('singspree_feedback') ?? '{}')).toMatchObject({ songs: SONGS_BEFORE_ASKING, shown: 0, done: null });
  });
});
