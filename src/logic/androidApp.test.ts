import { describe, test, expect, beforeEach, vi } from 'vitest';
import { inAndroidApp } from './androidApp';

// vitest runs in node: stand-ins for the browser
const items = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => items.get(k) ?? null,
  setItem: (k: string, v: unknown) => { items.set(k, String(v)); },
});
const opened = (referrer: string) => vi.stubGlobal('document', { referrer });

describe('inAndroidApp', () => {
  beforeEach(() => items.clear());

  test('opened by the app', () => {
    opened('android-app://com.singspree.app/');
    expect(inAndroidApp()).toBe(true);
    opened('android-app://com.singspree.app');
    expect(inAndroidApp()).toBe(true);
  });

  test('not a link opened from another Android app, nor the browser', () => {
    for (const referrer of ['android-app://com.whatsapp/', 'android-app://com.google.android.gm/', 'android-app://com.singspree.app.debug/', 'https://www.google.com/', '']) {
      opened(referrer);
      expect(inAndroidApp()).toBe(false);
    }
  });

  test('still the app after a full page load in it, whose referrer is our own page', () => {
    opened('android-app://com.singspree.app/');
    inAndroidApp();
    opened('https://singspree.com/');
    expect(inAndroidApp()).toBe(true);
  });

  test('a fresh window without the referrer is not', () => {
    opened('https://singspree.com/');
    expect(inAndroidApp()).toBe(false);
  });
});
