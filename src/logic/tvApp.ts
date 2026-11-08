/**
 * The Fire TV app: singspree.com in a WebView (Amazon WebView on Fire TV) that adds
 * "SingSpreeTV/<version>" to the user agent. There the page leaves out what the app cannot do
 * or Amazon's store does not allow: links to Google Play and the App Store, Google sign-in
 * (Google refuses sign-ins from a WebView), the fullscreen button (the app is full screen).
 * In a party the remote's Home button pauses the song (the app hides the page; Amazon tests
 * that a TV app stops its sound when left), and its play/pause, rewind and fast-forward
 * buttons work the song (PartyPage).
 */
export const inTvApp = (ua: string = globalThis.navigator?.userAgent ?? '') => /\bSingSpreeTV\//.test(ua);

/** Seconds a remote's rewind / fast-forward button moves the song, by its key name */
export const MEDIA_SEEK_STEP: Partial<Record<string, number>> = { MediaRewind: -10, MediaFastForward: 10 };
