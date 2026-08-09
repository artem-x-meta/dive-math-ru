import { describe, expect, it } from 'vitest';
import { addFractions, compareFractions, gcd, lcm, simplify } from '../src/lib/fractions';

describe('fraction arithmetic', () => {
  it('finds greatest common divisors with positive and negative inputs', () => {
    expect(gcd(84, 126)).toBe(42);
    expect(gcd(-18, 24)).toBe(6);
  });

  it('finds least common multiples', () => {
    expect(lcm(12, 8)).toBe(24);
    expect(lcm(7, 10)).toBe(70);
    expect(lcm(0, 5)).toBe(0);
  });

  it('simplifies fractions and normalizes the denominator sign', () => {
    expect(simplify({ numerator: 39, denominator: 30 })).toEqual({ numerator: 13, denominator: 10 });
    expect(simplify({ numerator: 3, denominator: -9 })).toEqual({ numerator: -1, denominator: 3 });
    expect(simplify({ numerator: 0, denominator: -9 })).toEqual({ numerator: 0, denominator: 1 });
  });

  it('compares equivalent and non-equivalent fractions exactly', () => {
    expect(compareFractions({ numerator: 3, denominator: 4 }, { numerator: 5, denominator: 8 })).toBe(1);
    expect(compareFractions({ numerator: 3, denominator: 8 }, { numerator: 6, denominator: 16 })).toBe(0);
    expect(compareFractions({ numerator: 999, denominator: 1000 }, { numerator: 1000, denominator: 1001 })).toBe(-1);
    expect(compareFractions({ numerator: 1, denominator: -2 }, { numerator: 1, denominator: 3 })).toBe(-1);
    expect(compareFractions(
      { numerator: 102334155, denominator: 165580141 },
      { numerator: 165580141, denominator: 267914296 },
    )).toBe(-1);
  });

  it('adds and simplifies fractions', () => {
    expect(addFractions({ numerator: 2, denominator: 3 }, { numerator: 1, denominator: 4 })).toEqual({ numerator: 11, denominator: 12 });
    expect(addFractions({ numerator: 5, denominator: 6 }, { numerator: 7, denominator: 15 })).toEqual({ numerator: 13, denominator: 10 });
  });

  it('rejects a zero denominator', () => {
    expect(() => simplify({ numerator: 1, denominator: 0 })).toThrow('Знаменатель');
    expect(() => compareFractions({ numerator: 1, denominator: 0 }, { numerator: 1, denominator: 2 })).toThrow('Знаменатель');
  });

  it('rejects non-integer and unsafe arithmetic inputs', () => {
    expect(() => gcd(1, Number.NaN)).toThrow('безопасным целым');
    expect(() => gcd(1.5, 2)).toThrow('безопасным целым');
    expect(() => simplify({ numerator: 0.5, denominator: 2 })).toThrow('безопасным целым');
    expect(() => lcm(Number.MAX_SAFE_INTEGER, 2)).toThrow('диапазон');
  });
});
