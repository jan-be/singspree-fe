import { describe, test, expect } from 'vitest';
import { zoneStore, AMAZON_COM } from './amazonStore';

const host = (zone: string) => new URL(zoneStore(zone).href).host;

describe('zoneStore', () => {
  test('Global Earning countries and the amazon.de ones get the affiliate link, for Amazon to redirect', () => {
    const zones = [
      'Europe/Berlin', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Luxembourg',
      'America/New_York', 'America/Los_Angeles', 'Pacific/Honolulu', 'America/Indianapolis', 'America/Toronto', 'America/Vancouver',
      'Europe/London', 'Europe/Paris', 'Europe/Rome', 'Europe/Madrid', 'Atlantic/Canary',
      'Europe/Amsterdam', 'Europe/Warsaw', 'Europe/Stockholm',
    ];
    for (const zone of zones) {
      const store = zoneStore(zone);
      expect(store.tagged, zone).toBe(true);
      expect(new URL(store.href).host).toBe('www.amazon.de');
      expect(new URL(store.href).searchParams.get('tag')).toBe('ch02c-21');
    }
  });

  test('countries outside it get their own store, without the tag', () => {
    const cases: [string, string][] = [
      ['Europe/Dublin', 'www.amazon.co.uk'], ['Europe/Jersey', 'www.amazon.co.uk'],
      ['Europe/Brussels', 'www.amazon.fr'], ['Indian/Reunion', 'www.amazon.fr'], ['Europe/San_Marino', 'www.amazon.it'],
      ['Asia/Tokyo', 'www.amazon.co.jp'], ['Asia/Calcutta', 'www.amazon.in'], ['America/Sao_Paulo', 'www.amazon.com.br'],
      ['America/Mexico_City', 'www.amazon.com.mx'], ['Australia/Sydney', 'www.amazon.com.au'], ['Pacific/Auckland', 'www.amazon.com.au'],
    ];
    for (const [zone, expected] of cases) {
      expect(host(zone), zone).toBe(expected);
      expect(zoneStore(zone).tagged).toBe(false);
      expect(zoneStore(zone).href).toMatch(/\/dp\/B0HQXFQP12$/);
    }
  });

  test('everywhere else gets the plain amazon.com page', () => {
    for (const zone of ['Asia/Manila', 'Africa/Lagos', 'America/Puerto_Rico', '', 'UTC']) {
      expect(zoneStore(zone)).toEqual(AMAZON_COM);
    }
  });
});
