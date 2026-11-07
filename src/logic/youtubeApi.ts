import { apiUrl } from '../GlobalConsts';

/**
 * YouTube's player API, without YouTube's cookies.
 *
 * react-youtube (youtube-player) gets the API from https://www.youtube.com/iframe_api, and that one request is where
 * a visitor's YouTube cookies come from: the player itself is on youtube-nocookie.com and sets none. It asks only when
 * the API is not in the page yet, so VideoPlayer waits for this first: the same file from our own server (backend
 * youtubeLoader.ts), which then fetches the real script as ever.
 *
 * No answer from us, or none in time: the library goes to YouTube itself, as it always did. A video with its cookies
 * beats a black stage.
 */
const WAIT_MS = 4000;

/** Whether the API is in the page */
export const youTubeApiThere = () => typeof window.YT?.Player === 'function';

let loading: Promise<void> | null = null;

/** Resolves when the API is in the page, or when it is time to let the library get it. Once per page. */
export function loadYouTubeApi(waitMs = WAIT_MS): Promise<void> {
  if (youTubeApiThere()) return Promise.resolve();
  loading ??= new Promise<void>(resolve => {
    const before = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { before?.(); resolve(); };
    const script = document.createElement('script');
    script.src = `${apiUrl}/yt-api.js`;
    script.async = true;
    script.onerror = () => resolve();
    document.head.appendChild(script);
    setTimeout(resolve, waitMs);
  });
  return loading;
}

/** For tests: forget the load */
export const resetYouTubeApi = () => { loading = null; };
