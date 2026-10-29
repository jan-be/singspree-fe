import { describe, it, expect } from 'vitest';
import { isCandidate, pick, type Box, type Direction } from './spatialNav';

// The geometry alone (the tests run without a DOM): boxes as on the entry page at a TV's 1280x720
const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, right: left + width, bottom: top + height });
const named = (boxes: Record<string, Box>) => Object.entries(boxes).map(([name, b]) => ({ name, box: b }));
const go = (from: Box, dir: Direction, boxes: Record<string, Box>, accept?: (i: { name: string }) => boolean) =>
  pick(from, dir, named(boxes), accept)?.name ?? null;

// Three columns of song cards, two rows
const grid = {
  a1: box(144, 349, 317, 227), b1: box(481, 349, 317, 227), c1: box(819, 349, 317, 227),
  a2: box(144, 608, 317, 227), b2: box(481, 608, 317, 227), c2: box(819, 608, 317, 227),
};

describe('isCandidate', () => {
  it('takes what lies that way, also when it overlaps the start', () => {
    expect(isCandidate(grid.a1, grid.a2, 'down')).toBe(true);
    expect(isCandidate(grid.a2, grid.a1, 'down')).toBe(false);
    // a box reaching further down that the start overlaps
    expect(isCandidate(box(0, 0, 100, 50), box(0, 20, 100, 60), 'down')).toBe(true);
  });

  it('does not take a box that encloses the start', () => {
    expect(isCandidate(box(10, 10, 20, 20), box(0, 0, 100, 100), 'down')).toBe(false);
    expect(isCandidate(box(10, 10, 20, 20), box(0, 0, 100, 100), 'right')).toBe(false);
  });
});

describe('pick', () => {
  it('moves through a grid by rows and columns', () => {
    const { a1, b1, ...rest } = grid;
    expect(go(a1, 'right', { b1, ...rest })).toBe('b1');
    expect(go(b1, 'down', { a1, ...rest })).toBe('b2');
    expect(go(b1, 'left', { a1, ...rest })).toBe('a1');
    expect(go(b1, 'up', { a1, ...rest })).toBe(null);
  });

  it('keeps to the row: a card in line beats a nearer one beside it', () => {
    // right from a1: b1 (in line) rather than a box just to the right but a row lower
    const below = box(470, 580, 40, 30);
    expect(go(grid.a1, 'right', { b1: grid.b1, below })).toBe('b1');
  });

  it('goes to the first of a row of chips from the wide search box, not the middle one', () => {
    const search = box(144, 502, 992, 56);
    const chips = { duets: box(144, 574, 90, 36), english: box(242, 574, 124, 36), more: box(373, 574, 158, 36), sort: box(989, 574, 147, 36) };
    expect(go(search, 'down', chips)).toBe('duets');
  });

  it('goes to the chip in line from a card below the chips', () => {
    const chips = { duets: box(144, 574, 90, 36), more: box(373, 574, 158, 36), sort: box(989, 574, 147, 36) };
    expect(go(box(819, 640, 317, 227), 'up', chips)).toBe('sort');
  });

  it('skips what the caller does not accept (covered, hidden) for the next best', () => {
    const { a1, ...rest } = grid;
    expect(go(a1, 'down', rest, i => i.name !== 'a2')).toBe('b2');
  });

  it('finds nothing where nothing lies that way', () => {
    expect(go(grid.a1, 'left', { b1: grid.b1, a2: grid.a2 })).toBe(null);
  });
});
