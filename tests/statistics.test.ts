import { describe, expect, it } from 'vitest';
import {
  createLcg,
  frequencyTable,
  groupIntoIntervals,
  mean,
  median,
  range,
  relativeFrequency,
  roundTo,
  runningRelativeFrequencies,
  simulateEquallyLikelyTrials,
  simulateSuccessSeries,
} from '../src/lib/statistics';

describe('measures of center and spread', () => {
  it('computes the arithmetic mean exactly, including decimal data', () => {
    expect(mean([4, 5, 3, 4, 4])).toBe(4);
    expect(mean([30, 32, 33, 34, 35, 36, 38, 40, 42, 40])).toBe(36);
    expect(mean([0.1, 0.2])).toBe(0.15);
    expect(mean([1.1, 2.3, 3.2])).toBe(2.2);
    expect(mean([7])).toBe(7);
    expect(mean([-2, 2])).toBe(0);
  });

  it('computes the median for odd and even sample sizes', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 100])).toBe(2.5);
    expect(median([12, 14, 15, 15, 16, 18])).toBe(15);
    expect(median([0.3, 0.1])).toBe(0.2);
    expect(median([9])).toBe(9);
  });

  it('does not shift the median when an outlier grows', () => {
    const base = [30, 32, 33, 34, 35, 36, 38, 40, 42];
    expect(median([...base, 40])).toBe(35.5);
    expect(median([...base, 300])).toBe(35.5);
    expect(mean([...base, 40])).toBe(36);
    expect(mean([...base, 300])).toBe(62);
  });

  it('computes the range without binary noise', () => {
    expect(range([12, 14, 15, 15, 16, 18])).toBe(6);
    expect(range([1.1, 0.2])).toBe(0.9);
    expect(range([5, 5, 5])).toBe(0);
  });

  it('rejects empty samples and non-finite values', () => {
    expect(() => mean([])).toThrow('хотя бы один');
    expect(() => median([])).toThrow('хотя бы один');
    expect(() => range([])).toThrow('хотя бы один');
    expect(() => mean([1, Number.NaN])).toThrow('конечным числом');
    expect(() => range([Infinity])).toThrow('конечным числом');
  });
});

describe('rounding helper', () => {
  it('rounds half away from zero at school precision', () => {
    expect(roundTo(2.345, 2)).toBe(2.35);
    expect(roundTo(0.4817, 2)).toBe(0.48);
    expect(roundTo(35.5, 0)).toBe(36);
    expect(roundTo(-1.25, 1)).toBe(-1.3);
  });

  it('rejects unsupported digit counts', () => {
    expect(() => roundTo(1, -1)).toThrow('от 0 до 12');
    expect(() => roundTo(1, 0.5)).toThrow('от 0 до 12');
  });
});

describe('frequency tables', () => {
  it('counts absolute and relative frequencies in ascending order', () => {
    expect(frequencyTable([4, 3, 5, 4, 4, 3, 5, 4])).toEqual([
      { value: 3, count: 2, relativeFrequency: 0.25 },
      { value: 4, count: 4, relativeFrequency: 0.5 },
      { value: 5, count: 2, relativeFrequency: 0.25 },
    ]);
  });

  it('keeps the relative frequencies summing to one', () => {
    const rows = frequencyTable([1, 2, 2, 3, 3, 3, 4, 4, 4, 4]);
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(10);
    expect(rows.reduce((sum, row) => sum + row.relativeFrequency, 0)).toBeCloseTo(1, 12);
  });
});

describe('grouping into intervals', () => {
  it('builds half-open intervals and closes the last one on the right', () => {
    expect(groupIntoIntervals([150, 152, 158, 160, 164, 170], 10, 150)).toEqual([
      { from: 150, to: 160, count: 3, relativeFrequency: 0.5 },
      { from: 160, to: 170, count: 3, relativeFrequency: 0.5 },
    ]);
    expect(groupIntoIntervals([150, 159, 160, 169, 171], 10, 150).map((row) => row.count)).toEqual([2, 2, 1]);
  });

  it('keeps empty intervals inside the span and aligns the default start', () => {
    const rows = groupIntoIntervals([12, 14, 37], 10);
    expect(rows.map((row) => [row.from, row.to, row.count])).toEqual([
      [10, 20, 2],
      [20, 30, 0],
      [30, 40, 1],
    ]);
  });

  it('validates width and start', () => {
    expect(() => groupIntoIntervals([1, 2], 0)).toThrow('положительной');
    expect(() => groupIntoIntervals([1, 2], -5)).toThrow('положительной');
    expect(() => groupIntoIntervals([1, 2], 10, 5)).toThrow('не больше наименьшего');
  });
});

describe('deterministic random experiments', () => {
  it('produces the documented sequence for a fixed seed', () => {
    const next = createLcg(1);
    const modulus = 2 ** 32;
    expect(next()).toBe(1015568748 / modulus);
    expect(next()).toBe(1586005467 / modulus);
    expect(next()).toBe(2165703038 / modulus);
  });

  it('stays inside [0; 1) and repeats exactly for the same seed', () => {
    const first = createLcg(42);
    const second = createLcg(42);
    for (let index = 0; index < 200; index += 1) {
      const value = first();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(second()).toBe(value);
    }
  });

  it('rejects invalid seeds', () => {
    expect(() => createLcg(-1)).toThrow('целым неотрицательным');
    expect(() => createLcg(1.5)).toThrow('целым неотрицательным');
  });

  it('simulates reproducible die and coin series', () => {
    expect(simulateEquallyLikelyTrials(7, 12, 6)).toEqual([2, 6, 4, 6, 1, 6, 3, 1, 1, 6, 6, 4]);
    expect(simulateEquallyLikelyTrials(2026, 10, 2)).toEqual([1, 1, 1, 2, 2, 1, 2, 2, 1, 2]);
    expect(simulateEquallyLikelyTrials(7, 0, 6)).toEqual([]);
  });

  it('keeps every outcome inside the declared set', () => {
    const rolls = simulateEquallyLikelyTrials(123, 600, 6);
    expect(rolls).toHaveLength(600);
    expect(rolls.every((roll) => Number.isInteger(roll) && roll >= 1 && roll <= 6)).toBe(true);
  });

  it('simulates a reproducible success series with a given probability', () => {
    expect(simulateSuccessSeries(5, 8, 0.6)).toEqual([true, false, true, false, false, true, true, true]);
    expect(() => simulateSuccessSeries(5, 8, 0)).toThrow('строго между');
    expect(() => simulateSuccessSeries(5, 8, 1)).toThrow('строго между');
  });

  it('validates the trial count', () => {
    expect(() => simulateEquallyLikelyTrials(1, -1, 6)).toThrow('Число опытов');
    expect(() => simulateEquallyLikelyTrials(1, 100_001, 6)).toThrow('Число опытов');
    expect(() => simulateEquallyLikelyTrials(1, 10, 1)).toThrow('от 2 до 1000');
  });
});

describe('relative frequency and its stabilisation', () => {
  it('computes the share of successes', () => {
    expect(relativeFrequency(482, 1000)).toBe(0.482);
    expect(relativeFrequency(0, 4)).toBe(0);
    expect(() => relativeFrequency(5, 4)).toThrow('не может превышать');
    expect(() => relativeFrequency(1, 0)).toThrow('положительным');
  });

  it('tracks the running relative frequency after each trial', () => {
    expect(runningRelativeFrequencies([true, false, true, true])).toEqual([1, 0.5, 2 / 3, 0.75]);
    expect(runningRelativeFrequencies([])).toEqual([]);
  });

  it('ends at the overall relative frequency of the series', () => {
    const series = simulateSuccessSeries(9, 500, 0.6);
    const running = runningRelativeFrequencies(series);
    const successes = series.filter(Boolean).length;
    expect(running.at(-1)).toBe(relativeFrequency(successes, 500));
  });

  it('matches the documented long coin series', () => {
    const coin = simulateEquallyLikelyTrials(11, 1000, 2);
    const heads = coin.filter((outcome) => outcome === 1).length;
    expect(heads).toBe(482);
    expect(relativeFrequency(heads, 1000)).toBe(0.482);
  });
});
