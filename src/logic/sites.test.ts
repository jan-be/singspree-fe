import { beforeEach, describe, expect, it } from 'vitest';
import { forgetHomePasses, homePassOf, partyUrl, recordingUrl, rememberHomePass, socketUrl, stemUrls } from './sites';

beforeEach(() => forgetHomePasses());

describe('a request that is a party\'s own names the party', () => {
  it('as ?party=<code>, after whatever the address has', () => {
    expect(partyUrl('/api/songs/song1', 'C8KD')).toBe('/api/songs/song1?party=C8KD');
    expect(partyUrl('/api/songs/song1?x=1', 'C8KD')).toBe('/api/songs/song1?x=1&party=C8KD');
  });
  it('and stays as it is without a party, or with what is no code', () => {
    for (const party of [null, undefined, '', 'TOOLONG', 'a/b?', 'AB D']) expect(partyUrl('/api/songs/song1', party)).toBe('/api/songs/song1');
  });
  it('the socket: same origin as the page, the party named', () => {
    expect(socketUrl('C8KD', { protocol: 'https:', host: 'singspree.com' })).toBe('wss://singspree.com/api/ws?party=C8KD');
    expect(socketUrl('ABCD', { protocol: 'http:', host: 'localhost:3001' })).toBe('ws://localhost:3001/api/ws?party=ABCD');
    expect(socketUrl(null, { protocol: 'https:', host: 'singspree.com' })).toBe('wss://singspree.com/api/ws');
    expect(socketUrl('C8KD', undefined)).toBe(''); // no page (a test)
  });
});

describe('a chart from a site without the stems carries a pass', () => {
  it('read from its `home`, only if it looks like one', () => {
    expect(homePassOf({ site: 'home', pass: 'mm0abc.Zm9v_-' })).toBe('mm0abc.Zm9v_-');
    for (const answer of [undefined, null, {}, 'home', { site: 'home' }, { pass: 7 }, { pass: '' }, { pass: 'a b&c=d' }, { pass: 'x'.repeat(121) }]) expect(homePassOf(answer)).toBeNull();
  });
  it('shown when the stems are fetched; the address names no site and no party', () => {
    expect(stemUrls('song1', { pass: 'mm0abc.Zm9v_-' })).toEqual({
      karaoke: '/api/songs/song1/karaoke?pass=mm0abc.Zm9v_-',
      vocals: '/api/songs/song1/vocals?pass=mm0abc.Zm9v_-',
    });
    expect(stemUrls('song1', { pass: 'mm0abc.Zm9v_-', caf: true }).karaoke).toBe('/api/songs/song1/karaoke?format=caf&pass=mm0abc.Zm9v_-');
  });
  it('without one the stems are asked for as ever', () => {
    expect(stemUrls('song1')).toEqual({ karaoke: '/api/songs/song1/karaoke', vocals: '/api/songs/song1/vocals' });
    expect(stemUrls('song1', { caf: true, pass: null }).vocals).toBe('/api/songs/song1/vocals?format=caf');
  });
  it('and kept for the take of that song, which is sent when the page may be on the next one', () => {
    rememberHomePass('song1', homePassOf({ site: 'home', pass: 'mm0abc.Zm9v' }));
    rememberHomePass('song2', homePassOf({ site: 'home' })); // (no pass: nothing to keep)
    expect(recordingUrl('song1')).toBe('/api/recordings?pass=mm0abc.Zm9v');
    expect(recordingUrl('song2')).toBe('/api/recordings');
    expect(recordingUrl(null)).toBe('/api/recordings');
  });
  it('only the newest fifty songs\' passes are kept', () => {
    for (let i = 0; i < 60; i++) rememberHomePass(`song${i}`, `pass${i}`);
    expect(recordingUrl('song0')).toBe('/api/recordings');
    expect(recordingUrl('song59')).toBe('/api/recordings?pass=pass59');
  });
});
