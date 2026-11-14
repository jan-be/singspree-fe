import { trackEvent } from './track';

/**
 * Clicks on links that leave the site, counted for the admin page's "Links
 * out" (backend routes/events.ts outbound_click, GET /admin/outbound): the
 * Product Hunt card, the footer's accounts (Instagram, TikTok, GitHub), the
 * store pages, and any other link to another site, with no code at the link.
 *
 * One listener on the document sees every click on an `<a href>`, the middle
 * button's too (auxclick). Sent: the host and path (no query, no fragment),
 * the spot the link sits in (the nearest `data-out` attribute, e.g.
 * "ph-banner", "footer") and the page's first path segment ("home",
 * "settings", "party": never a party code or a name). An "open in new tab"
 * from the context menu is not a click and is not counted.
 */

/**
 * What outbound_click carries for a click on a link to `href` (as written in the page) in the spot `place` (its
 * nearest data-out) while on `pageUrl`, or null for a link that stays here or is no web page
 */
export function outboundOf(href: string | null, place: string | undefined, pageUrl: URL) {
  if (!href) return null;
  let to: URL;
  try { to = new URL(href, pageUrl); } catch { return null; }
  if ((to.protocol !== 'https:' && to.protocol !== 'http:') || to.host === pageUrl.host) return null;
  const page = pageUrl.pathname.split('/')[1]?.toLowerCase() || 'home';
  return {
    host: to.hostname,
    path: to.pathname,
    ...(place ? { place } : {}),
    ...(/^[a-z0-9-]{1,32}$/.test(page) ? { page } : {}),
  };
}

let watching = false;

/** Counts every click on a link out from now on (index.tsx, once) */
export function watchOutboundClicks() {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  const onClick = (e: MouseEvent) => {
    if (e.type === 'auxclick' && e.button !== 1) return; // the middle button opens a tab; the right one only a menu
    const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
    if (!link) return;
    const out = outboundOf(link.getAttribute('href'), link.closest<HTMLElement>('[data-out]')?.dataset.out, new URL(window.location.href));
    if (out) trackEvent('outbound_click', out);
  };
  // capture: seen even where a handler stops the click from going further
  document.addEventListener('click', onClick, true);
  document.addEventListener('auxclick', onClick, true);
}
