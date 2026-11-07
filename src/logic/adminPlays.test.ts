import { describe, it, expect } from 'vitest';
import { appendPlays, refreshPlays } from './adminPlays';

const row = (id: string, score: number | null = null) => ({ id, score });
const ids = (rows: { id: string }[]) => rows.map(r => r.id);

describe('refreshPlays', () => {
  it('puts new plays on top and keeps the rows below the first page', () => {
    const loaded = { rows: [row('3'), row('2'), row('1')], hasMore: true };
    const next = refreshPlays(loaded, { rows: [row('4'), row('3')], hasMore: true });
    expect(ids(next.rows)).toEqual(['4', '3', '2', '1']);
    expect(next.hasMore).toBe(true);
  });

  it('takes a row read again as it is now: a song ended, so a score came', () => {
    const next = refreshPlays({ rows: [row('2'), row('1')], hasMore: false }, { rows: [row('2', 6200), row('1')], hasMore: false });
    expect(next.rows[0].score).toBe(6200);
  });

  it('keeps a list that had everything complete', () => {
    const next = refreshPlays({ rows: [row('2'), row('1')], hasMore: false }, { rows: [row('3'), row('2')], hasMore: true });
    expect(ids(next.rows)).toEqual(['3', '2', '1']);
    expect(next.hasMore).toBe(false);
  });

  it('starts over when the first page no longer reaches the list', () => {
    const page = { rows: [row('9'), row('8')], hasMore: true };
    expect(refreshPlays({ rows: [row('2'), row('1')], hasMore: true }, page)).toBe(page);
  });
});

describe('appendPlays', () => {
  it('leaves out what new plays pushed onto the next page', () => {
    const next = appendPlays({ rows: [row('4'), row('3')], hasMore: true }, { rows: [row('3'), row('2')], hasMore: false });
    expect(ids(next.rows)).toEqual(['4', '3', '2']);
    expect(next.hasMore).toBe(false);
  });
});
