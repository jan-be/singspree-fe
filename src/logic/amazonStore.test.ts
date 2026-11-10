import { describe, test, expect } from 'vitest';
import { zoneStore, AMAZON_COM } from './amazonStore';

const host = (zone: string) => new URL(zoneStore(zone).href).host;

describe('zoneStore', () => {
  test('Germany, Austria and Switzerland get the affiliate link on amazon.de', () => {
    for (const zone of ['Europe/Berlin', 'Europe/Vienna', 'Europe/Zurich']) {
      const store = zoneStore(zone);
      expect(store.tagged).toBe(true);
      expect(new URL(store.href).host).toBe('www.amazon.de');
      expect(new URL(store.href).searchParams.get('tag')).toBe('ch02c-21');
    }
  });

  test('other countries get their own store, without the tag', () => {
    const cases: [string, string][] = [
      ['Europe/London', 'www.amazon.co.uk'], ['Europe/Dublin', 'www.amazon.co.uk'],
      ['Europe/Paris', 'www.amazon.fr'], ['Europe/Rome', 'www.amazon.it'], ['Atlantic/Canary', 'www.amazon.es'],
      ['Asia/Tokyo', 'www.amazon.co.jp'], ['Asia/Calcutta', 'www.amazon.in'], ['America/Sao_Paulo', 'www.amazon.com.br'],
      ['America/Toronto', 'www.amazon.ca'], ['America/Mexico_City', 'www.amazon.com.mx'],
      ['Australia/Sydney', 'www.amazon.com.au'], ['Pacific/Auckland', 'www.amazon.com.au'],
    ];
    for (const [zone, expected] of cases) {
      expect(host(zone)).toBe(expected);
      expect(zoneStore(zone).tagged).toBe(false);
      expect(zoneStore(zone).href).toMatch(/\/dp\/B0HQXFQP12$/);
    }
  });

  test('the US and everywhere else get amazon.com', () => {
    for (const zone of ['America/New_York', 'America/Los_Angeles', 'Asia/Manila', 'Africa/Lagos', '', 'UTC']) {
      expect(zoneStore(zone)).toEqual(AMAZON_COM);
    }
  });
});
