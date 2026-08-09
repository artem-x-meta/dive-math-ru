import { describe, expect, it } from 'vitest';
import {
  approximate,
  arithmeticFromTwoTerms,
  arithmeticIndexOf,
  arithmeticProgression,
  arithmeticSum,
  arithmeticTerm,
  arithmeticTerms,
  chainedPercentFactor,
  classifySequence,
  compareGrowth,
  compoundAmount,
  exactPower,
  formatExactValue,
  formatFixed,
  geometricProgression,
  geometricSum,
  geometricTerm,
  geometricTerms,
  growthFactor,
  periodsToReach,
  recurrence,
  recurrenceTerms,
  axisBound,
  axisTicks,
  roundExact,
  simpleAmount,
  totalPercentChange,
} from '../src/lib/sequences';

const text = (value: Parameters<typeof formatExactValue>[0]) => formatExactValue(value);
const list = (values: readonly Parameters<typeof formatExactValue>[0][]) => values.map(text);

describe('exact powers', () => {
  it('raises rational bases to integer exponents', () => {
    expect(text(exactPower(2, 10))).toBe('1024');
    expect(text(exactPower('1/2', 6))).toBe('0,015625');
    expect(text(exactPower(-3, 3))).toBe('−27');
    expect(text(exactPower(-3, 4))).toBe('81');
    expect(text(exactPower(7, 0))).toBe('1');
  });

  it('keeps repeated percent factors exact', () => {
    // 1,07^3 = 1,225043 без потери разрядов, в отличие от двоичной дроби.
    expect(text(exactPower('1.07', 3))).toBe('1,225043');
    expect(text(exactPower('1.1', 3))).toBe('1,331');
  });

  it('supports negative exponents and rejects impossible ones', () => {
    expect(text(exactPower(2, -3))).toBe('0,125');
    expect(() => exactPower(0, 0)).toThrow('0^0');
    expect(() => exactPower(0, -2)).toThrow('отрицательную степень');
    expect(() => exactPower(2, 1.5)).toThrow('целым числом');
    expect(() => exactPower(2, 10_000)).toThrow('Показатель степени');
  });
});

describe('recurrent rules', () => {
  it('builds terms of x(n+1) = m·x(n) + c', () => {
    expect(list(recurrenceTerms(recurrence(5, 2, -1), 4))).toEqual(['5', '9', '17', '33']);
    expect(list(recurrenceTerms(recurrence(-2, 1, 5), 5))).toEqual(['−2', '3', '8', '13', '18']);
    expect(list(recurrenceTerms(recurrence(3, 2, 0), 5))).toEqual(['3', '6', '12', '24', '48']);
  });

  it('validates the number of terms', () => {
    expect(() => recurrenceTerms(recurrence(1, 1, 1), 0)).toThrow('положительным');
    expect(() => recurrenceTerms(recurrence(1, 1, 1), 1_000)).toThrow('не может превышать');
  });
});

describe('arithmetic progression', () => {
  const progression = arithmeticProgression(7, 4);

  it('finds the n-th term and the sum of the first n terms', () => {
    expect(text(arithmeticTerm(progression, 1))).toBe('7');
    expect(text(arithmeticTerm(progression, 20))).toBe('83');
    expect(text(arithmeticSum(progression, 20))).toBe('900');
    expect(list(arithmeticTerms(arithmeticProgression(-4, 3), 5))).toEqual(['−4', '−1', '2', '5', '8']);
  });

  it('handles decreasing and fractional progressions exactly', () => {
    expect(text(arithmeticTerm(arithmeticProgression(12, -5), 10))).toBe('−33');
    expect(text(arithmeticSum(arithmeticProgression(6, -2), 12))).toBe('−60');
    expect(text(arithmeticSum(arithmeticProgression('0.1', '0.1'), 10))).toBe('5,5');
    expect(text(arithmeticSum(arithmeticProgression(1, 2), 30))).toBe('900');
  });

  it('decides whether a number belongs to the progression', () => {
    const line = arithmeticProgression(5, 7);
    expect(arithmeticIndexOf(line, 12)).toBe(2);
    expect(arithmeticIndexOf(line, 2_024)).toBeNull();
    expect(arithmeticIndexOf(arithmeticProgression(100, -7), 44)).toBe(9);
    expect(arithmeticIndexOf(arithmeticProgression(5, 0), 5)).toBe(1);
    expect(arithmeticIndexOf(arithmeticProgression(5, 0), 6)).toBeNull();
    expect(arithmeticIndexOf(line, -2)).toBeNull();
  });

  it('restores the progression from two known terms', () => {
    const restored = arithmeticFromTwoTerms(3, 10, 7, 26);
    expect(text(restored.difference)).toBe('4');
    expect(text(restored.first)).toBe('2');
    expect(text(arithmeticTerm(restored, 7))).toBe('26');

    const inserted = arithmeticFromTwoTerms(1, 5, 5, 45);
    expect(list(arithmeticTerms(inserted, 5))).toEqual(['5', '15', '25', '35', '45']);
  });

  it('rejects impossible indices', () => {
    expect(() => arithmeticTerm(progression, 0)).toThrow('нумеруется с единицы');
    expect(() => arithmeticTerm(progression, 2.5)).toThrow('целым числом');
    expect(() => arithmeticFromTwoTerms(4, 1, 4, 2)).toThrow('разными номерами');
  });
});

describe('geometric progression', () => {
  it('finds the n-th term and the sum of the first n terms', () => {
    const doubling = geometricProgression(3, 2);
    expect(text(geometricTerm(doubling, 8))).toBe('384');
    expect(text(geometricSum(doubling, 8))).toBe('765');

    const halving = geometricProgression(64, '1/2');
    expect(text(geometricTerm(halving, 6))).toBe('2');
    expect(text(geometricSum(halving, 6))).toBe('126');
  });

  it('keeps alternating signs and fractional ratios exact', () => {
    expect(text(geometricTerm(geometricProgression(5, -2), 4))).toBe('−40');
    expect(list(geometricTerms(geometricProgression(1, -3), 5))).toEqual(['1', '−3', '9', '−27', '81']);
    expect(text(geometricSum(geometricProgression(1, -3), 5))).toBe('61');
    expect(text(geometricSum(geometricProgression(1, '1/3'), 4))).toBe('40/27');
  });

  it('uses n·b1 when the ratio equals one', () => {
    expect(text(geometricSum(geometricProgression(7, 1), 5))).toBe('35');
  });

  it('reproduces the chessboard legend without rounding', () => {
    expect(text(geometricSum(geometricProgression(1, 2), 64))).toBe('18446744073709551615');
  });

  it('rejects a zero first term or a zero ratio', () => {
    expect(() => geometricProgression(0, 2)).toThrow('Первый член');
    expect(() => geometricProgression(2, 0)).toThrow('Знаменатель');
  });
});

describe('sequence classification', () => {
  it('recognizes arithmetic and geometric samples', () => {
    const arithmetic = classifySequence([5, 8, 11, 14]);
    expect(arithmetic.isArithmetic).toBe(true);
    expect(text(arithmetic.difference!)).toBe('3');
    expect(arithmetic.isGeometric).toBe(false);

    const geometric = classifySequence([3, 6, 12, 24]);
    expect(geometric.isGeometric).toBe(true);
    expect(text(geometric.ratio!)).toBe('2');
    expect(geometric.isArithmetic).toBe(false);
  });

  it('marks a constant non-zero sequence as both kinds', () => {
    const constant = classifySequence([4, 4, 4, 4]);
    expect(constant.isArithmetic).toBe(true);
    expect(text(constant.difference!)).toBe('0');
    expect(constant.isGeometric).toBe(true);
    expect(text(constant.ratio!)).toBe('1');
  });

  it('rejects the shortcut «первые члены задают закон»', () => {
    // 2, 4, 8 продолжается и как 2^n, и как n² − n + 2.
    const trap = classifySequence([2, 4, 8, 14]);
    expect(trap.isArithmetic).toBe(false);
    expect(trap.isGeometric).toBe(false);
    expect(trap.ratio).toBeNull();
  });

  it('needs at least three terms', () => {
    expect(() => classifySequence([1, 2])).toThrow('трёх членов');
  });
});

describe('percent growth', () => {
  it('builds the one-step factor', () => {
    expect(text(growthFactor(8))).toBe('1,08');
    expect(text(growthFactor(-10))).toBe('0,9');
    expect(text(growthFactor(0))).toBe('1');
    expect(() => growthFactor(-150)).toThrow('100 %');
  });

  it('separates simple and compound interest', () => {
    expect(text(compoundAmount(40_000, 8, 3))).toBe('50388,48');
    expect(text(simpleAmount(40_000, 8, 3))).toBe('49600');
    expect(text(compoundAmount(25_000, 10, 3))).toBe('33275');
    expect(text(simpleAmount(25_000, 10, 3))).toBe('32500');
    expect(text(compoundAmount(30_000, -15, 2))).toBe('21675');
    expect(text(compoundAmount(1_234, 5, 0))).toBe('1234');
  });

  it('shows that percents of different periods do not add up', () => {
    expect(text(totalPercentChange(10, 2))).toBe('21');
    expect(text(chainedPercentFactor([20, -20]))).toBe('0,96');
    expect(text(chainedPercentFactor([-20, -30]))).toBe('0,56');
    expect(text(totalPercentChange(-10, 3))).toBe('−27,1');
  });

  it('counts the periods needed to reach a target factor', () => {
    expect(periodsToReach(15, 2)).toBe(5);
    expect(periodsToReach(100, 8)).toBe(3);
    expect(periodsToReach(7, 2)).toBe(11);
    expect(periodsToReach(5, 1)).toBe(0);
    expect(() => periodsToReach(0, 2)).toThrow('недостижима');
  });
});

describe('linear against exponential growth', () => {
  const comparison = compareGrowth({ start: 40_000, ratePercent: 8, periods: 3 });

  it('puts both models on one grid of steps', () => {
    expect(comparison.points).toHaveLength(4);
    expect(text(comparison.points[0]!.linear)).toBe('40000');
    expect(text(comparison.points[0]!.exponential)).toBe('40000');
    expect(text(comparison.points[1]!.linear)).toBe('43200');
    expect(text(comparison.points[1]!.exponential)).toBe('43200');
    expect(text(comparison.points[3]!.linear)).toBe('49600');
    expect(text(comparison.points[3]!.exponential)).toBe('50388,48');
    expect(text(comparison.step)).toBe('3200');
    expect(text(comparison.factor)).toBe('1,08');
  });

  it('reports the first step where the exponential model wins', () => {
    expect(comparison.crossoverIndex).toBe(2);
    expect(text(comparison.maxValue)).toBe('50388,48');
    expect(text(comparison.minValue)).toBe('40000');
  });

  it('accepts an independent linear step', () => {
    const race = compareGrowth({ start: 500, ratePercent: 100, periods: 13, step: 500 });
    expect(text(race.points[12]!.linear)).toBe('6500');
    expect(text(race.points[12]!.exponential)).toBe('2048000');
    // 500·2^n обгоняет 500 + 500n уже на втором шаге: 2000 > 1500.
    expect(race.crossoverIndex).toBe(2);
    expect(text(race.points[2]!.exponential)).toBe('2000');
    expect(text(race.points[2]!.linear)).toBe('1500');
  });

  it('never reports a crossover when the exponent stays behind', () => {
    const flat = compareGrowth({ start: 100, ratePercent: 0, periods: 5, step: 10 });
    expect(flat.crossoverIndex).toBeNull();
    expect(text(flat.points[5]!.exponential)).toBe('100');
    expect(text(flat.points[5]!.linear)).toBe('150');
  });

  it('validates the number of steps', () => {
    expect(() => compareGrowth({ start: 1, ratePercent: 1, periods: 0 })).toThrow('от 1 до');
    expect(() => compareGrowth({ start: 1, ratePercent: 1, periods: 2.5 })).toThrow('целым числом');
  });
});

describe('rounding and formatting', () => {
  it('rounds halves away from zero', () => {
    expect(text(roundExact('2.5', 0))).toBe('3');
    expect(text(roundExact('-2.5', 0))).toBe('−3');
    expect(text(roundExact('1.005', 2))).toBe('1,01');
    expect(text(roundExact('1/3', 4))).toBe('0,3333');
  });

  it('writes money with a fixed number of decimals', () => {
    expect(formatFixed(compoundAmount(40_000, 8, 3), 2)).toBe('50388,48');
    expect(formatFixed(50_000, 2)).toBe('50000,00');
    expect(formatFixed('0.5', 0)).toBe('1');
    expect(formatFixed('-1.234', 1)).toBe('−1,2');
    expect(formatFixed('1/3', 3)).toBe('0,333');
    expect(() => formatFixed(1, 99)).toThrow('от 0 до');
  });

  it('rounds the axis up to a readable bound', () => {
    expect(text(axisBound(83))).toBe('100');
    expect(text(axisBound(100))).toBe('100');
    expect(text(axisBound(101))).toBe('200');
    expect(text(axisBound(50_388.48))).toBe('100000');
    expect(text(axisBound('0.3'))).toBe('0,5');
    expect(text(axisBound(0))).toBe('1');
    expect(text(axisBound(-5))).toBe('1');
    expect(text(axisBound(2_100))).toBe('2500');
  });

  it('splits the axis into equal exact steps', () => {
    expect(list(axisTicks(100, 4))).toEqual(['0', '25', '50', '75', '100']);
    expect(list(axisTicks(1, 3))).toEqual(['0', '1/3', '2/3', '1']);
    expect(list(axisTicks(axisBound(50_388.48), 5))).toEqual(['0', '20000', '40000', '60000', '80000', '100000']);
    expect(() => axisTicks(10, 0)).toThrow('от 1 до 20');
    expect(() => axisTicks(10, 2.5)).toThrow('целым числом');
  });

  it('approximates only where a picture needs a float', () => {
    expect(approximate('1/4')).toBe(0.25);
    expect(approximate(geometricTerm(geometricProgression(2, 2), 10))).toBe(1_024);
  });
});
