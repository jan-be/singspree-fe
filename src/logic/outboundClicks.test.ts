import { describe, expect, test } from 'vitest';
import { outboundOf } from './outboundClicks';

describe('outboundOf', () => {
  const home = new URL('https://singspree.com/');

  test('a link to another site: host and path without the query, the spot and the page', () => {
    expect(outboundOf('https://www.producthunt.com/products/singspree?ref=x#c', 'ph-banner', home))
      .toEqual({ host: 'www.producthunt.com', path: '/products/singspree', place: 'ph-banner', page: 'home' });
    expect(outboundOf('https://www.instagram.com/singspree.app/', undefined, new URL('https://singspree.com/party/ABCD?x=1')))
      .toEqual({ host: 'www.instagram.com', path: '/singspree.app/', page: 'party' });
  });

  test('links that stay here, or are no web page, count nothing', () => {
    expect(outboundOf('/settings', undefined, home)).toBeNull();
    expect(outboundOf('https://singspree.com/u/Ann', 'footer', home)).toBeNull();
    expect(outboundOf('mailto:hi@singspree.com', 'footer', home)).toBeNull();
    expect(outboundOf('#top', undefined, home)).toBeNull();
    expect(outboundOf(null, undefined, home)).toBeNull();
  });
});
