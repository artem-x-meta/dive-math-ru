import { describe, expect, it } from 'vitest';
import {
  divideWithRemainder,
  divisors,
  factorPairs,
  gcd,
  isPrime,
  lcm,
  primeFactorization,
} from '../src/lib/numberTheory';

describe('number theory', () => {
  it('lists positive divisors in increasing order', () => {
    expect(divisors(1)).toEqual([1]);
    expect(divisors(36)).toEqual([1, 2, 3, 4, 6, 9, 12, 18, 36]);
    expect(divisors(97)).toEqual([1, 97]);
  });

  it('builds each factor pair exactly once', () => {
    expect(factorPairs(1)).toEqual([[1, 1]]);
    expect(factorPairs(36)).toEqual([
      [1, 36],
      [2, 18],
      [3, 12],
      [4, 9],
      [6, 6],
    ]);
  });

  it('divides with a non-negative remainder smaller than the divisor magnitude', () => {
    expect(divideWithRemainder(17, 5)).toEqual({ quotient: 3, remainder: 2 });
    expect(divideWithRemainder(20, 5)).toEqual({ quotient: 4, remainder: 0 });
    expect(divideWithRemainder(-17, 5)).toEqual({ quotient: -4, remainder: 3 });
    expect(divideWithRemainder(17, -5)).toEqual({ quotient: -3, remainder: 2 });
  });

  it('recognizes prime and composite numbers exactly', () => {
    expect(isPrime(-7)).toBe(false);
    expect(isPrime(0)).toBe(false);
    expect(isPrime(1)).toBe(false);
    expect(isPrime(2)).toBe(true);
    expect(isPrime(97)).toBe(true);
    expect(isPrime(91)).toBe(false);
    expect(isPrime(2_147_483_647)).toBe(true);
  });

  it('decomposes natural numbers into ordered prime factors', () => {
    expect(primeFactorization(1)).toEqual([]);
    expect(primeFactorization(84)).toEqual([2, 2, 3, 7]);
    expect(primeFactorization(360)).toEqual([2, 2, 2, 3, 3, 5]);
    expect(primeFactorization(97)).toEqual([97]);
  });

  it('calculates non-negative gcd and lcm values', () => {
    expect(gcd(84, 126)).toBe(42);
    expect(gcd(-18, 24)).toBe(6);
    expect(gcd(0, 0)).toBe(0);
    expect(lcm(12, 8)).toBe(24);
    expect(lcm(-7, 10)).toBe(70);
    expect(lcm(0, 5)).toBe(0);
  });

  it('rejects values outside each operation domain', () => {
    expect(() => divisors(0)).toThrow('положительным');
    expect(() => factorPairs(-12)).toThrow('положительным');
    expect(() => primeFactorization(1.5)).toThrow('безопасным целым');
    expect(() => divideWithRemainder(12, 0)).toThrow('нулю');
    expect(() => isPrime(Number.NaN)).toThrow('безопасным целым');
    expect(() => gcd(Number.MAX_SAFE_INTEGER + 1, 2)).toThrow('безопасным целым');
  });

  it('detects an lcm that cannot be represented exactly', () => {
    expect(() => lcm(Number.MAX_SAFE_INTEGER, 2)).toThrow('диапазон');
  });
});
