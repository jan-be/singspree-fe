import { describe, test, expect } from 'vitest';
import { onStage, ownSeatName } from './seatName';

const seat = (username: string, connected = true) => ({ username, connected });

describe('onStage', () => {
  test('a name someone sings under now, whatever its case; not a seat that is away', () => {
    const players = [seat('Ann'), seat('Bob', false)];
    expect(onStage('ann ', players)).toBe(true);
    expect(onStage('Bob', players)).toBe(false);
    expect(onStage('Cat', players)).toBe(false);
    expect(onStage('Ann')).toBe(false);
  });
});

describe('ownSeatName', () => {
  test('the second device of an account sits under the name with a 2', () => {
    expect(ownSeatName('Ann', [seat('Ann')])).toBe('Ann 2');
    expect(ownSeatName('Ann')).toBe('Ann 2');
  });

  test('a third device takes the next number nobody sings under', () => {
    expect(ownSeatName('Ann', [seat('Ann'), seat('ann 2'), seat('Ann 3')])).toBe('Ann 4');
  });

  test('a numbered seat that is away is tried: it may be this device\'s own from a moment ago', () => {
    expect(ownSeatName('Ann', [seat('Ann'), seat('Ann 2', false)])).toBe('Ann 2');
  });

  test('refused by the server, the numbers up to that one are not tried again', () => {
    expect(ownSeatName('Ann', [seat('Ann', false)], 'Ann')).toBe('Ann 2');
    expect(ownSeatName('Ann', [seat('Ann'), seat('Ann 2', false)], 'Ann 2')).toBe('Ann 3');
    expect(ownSeatName('Ann', [seat('Ann'), seat('Ann 2', false), seat('Ann 3'), seat('Ann 4')], 'ann 2')).toBe('Ann 5');
  });

  test('someone else\'s numbered name does not count', () => {
    expect(ownSeatName('Ann', [seat('Ann')], 'Bob 7')).toBe('Ann 2');
  });
});
