import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadYouTubeApi, resetYouTubeApi, youTubeApiThere } from './youtubeApi';

interface FakeScript { src?: string; onerror?: () => void }

describe('loadYouTubeApi', () => {
  let scripts: FakeScript[];
  beforeEach(() => {
    scripts = [];
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', { createElement: (): FakeScript => ({}), head: { appendChild: (s: FakeScript) => { scripts.push(s); } } });
  });
  afterEach(() => {
    resetYouTubeApi();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('asks our server, never YouTube, and once however often it is called', () => {
    void loadYouTubeApi();
    void loadYouTubeApi();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe('/api/yt-api.js');
  });

  test('done when the API says so, and whoever waited before still hears it', async () => {
    const before = vi.fn();
    window.onYouTubeIframeAPIReady = before;
    const done = loadYouTubeApi();
    window.YT = { Player: function Player() {} };
    window.onYouTubeIframeAPIReady?.();
    await done;
    expect(before).toHaveBeenCalledOnce();
    expect(youTubeApiThere()).toBe(true);
  });

  test('nothing to load when the API is there', async () => {
    window.YT = { Player: function Player() {} };
    await loadYouTubeApi();
    expect(scripts).toHaveLength(0);
  });

  test('our script failing lets the library go to YouTube at once', async () => {
    const done = loadYouTubeApi();
    scripts[0].onerror?.();
    await done;
    expect(youTubeApiThere()).toBe(false);
  });

  test('no answer at all: not for ever', async () => {
    vi.useFakeTimers();
    const done = loadYouTubeApi(4000);
    await vi.advanceTimersByTimeAsync(4000);
    await done;
    expect(youTubeApiThere()).toBe(false);
  });
});
