import { describe, test, expect } from 'vitest';
import { inTvApp, MEDIA_SEEK_STEP } from './tvApp';

// Amazon WebView on a Fire TV Stick 4K Max, as the app reports it (its own token at the end)
const FIRE_TV_APP = 'Mozilla/5.0 (Linux; Android 9; AFTKA Build/PS7633; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.7204.244 Mobile Safari/537.36 SingSpreeTV/1.0.0';
const SILK_ON_FIRE_TV = 'Mozilla/5.0 (Linux; Android 9; AFTKA Build/PS7633) AppleWebKit/537.36 Silk/138.0 like Chrome/138.0 Safari/537.36';
const PHONE_APP = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36';

describe('inTvApp', () => {
  test('the TV app says so in its user agent', () => {
    expect(inTvApp(FIRE_TV_APP)).toBe(true);
  });

  test('a TV browser or the phone app is not it', () => {
    expect(inTvApp(SILK_ON_FIRE_TV)).toBe(false);
    expect(inTvApp(PHONE_APP)).toBe(false);
    expect(inTvApp('')).toBe(false);
    expect(inTvApp('NotSingSpreeTV/1.0')).toBe(false);
  });

  test("the remote's rewind and fast-forward move ten seconds", () => {
    expect(MEDIA_SEEK_STEP.MediaRewind).toBe(-10);
    expect(MEDIA_SEEK_STEP.MediaFastForward).toBe(10);
    expect(MEDIA_SEEK_STEP.MediaPlayPause).toBeUndefined();
  });
});
