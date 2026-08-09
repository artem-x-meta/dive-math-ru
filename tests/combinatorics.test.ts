import { describe, expect, it } from 'vitest';
import {
  DIGIT_GROUP_SEPARATOR,
  MAX_BERNOULLI_TRIALS,
  approximateProbability,
  arrangements,
  bernoulliDistribution,
  bernoulliProbability,
  combinations,
  countToNumber,
  distributionOfEqualOutcomes,
  distributionTotal,
  expectedValue,
  factorial,
  finiteExperimentDistribution,
  finiteExperimentValues,
  formatCount,
  mostLikelyValues,
  pascalParents,
  pascalRow,
  pascalRowSum,
  pascalTriangle,
  permutations,
  probabilityAtLeast,
  probabilityAtMost,
  probabilityOfValue,
  productRule,
  sumRule,
} from '../src/lib/combinatorics';
import { fraction } from '../src/lib/probability';

describe('counting rules', () => {
  it('adds disjoint sets and multiplies independent steps', () => {
    expect(sumRule([4, 3])).toBe(7);
    expect(sumRule([5])).toBe(5);
    expect(productRule([3, 4])).toBe(12);
    expect(productRule([10, 10, 10])).toBe(1000);
    expect(productRule([2, 3, 2])).toBe(12);
  });

  it('treats an empty set of options as zero, not as an error', () => {
    expect(sumRule([4, 0])).toBe(4);
    expect(productRule([4, 0])).toBe(0);
  });

  it('rejects empty and invalid inputs', () => {
    expect(() => sumRule([])).toThrow('хотя бы один');
    expect(() => productRule([])).toThrow('хотя бы один');
    expect(() => productRule([3, -1])).toThrow('целым неотрицательным');
    expect(() => sumRule([2.5, 1])).toThrow('целым неотрицательным');
  });
});

describe('factorial and permutations', () => {
  it('follows the school definition, including 0! = 1', () => {
    expect(factorial(0)).toBe(1n);
    expect(factorial(1)).toBe(1n);
    expect(factorial(5)).toBe(120n);
    expect(factorial(10)).toBe(3_628_800n);
    expect(permutations(6)).toBe(720n);
  });

  it('stays exact beyond the double precision limit', () => {
    // 20! = 2432902008176640000 — последняя цифра уже теряется в double.
    expect(factorial(20)).toBe(2_432_902_008_176_640_000n);
    expect(factorial(25).toString()).toBe('15511210043330985984000000');
    expect(factorial(21)).toBe(factorial(20) * 21n);
  });

  it('satisfies the recurrence n! = n · (n − 1)!', () => {
    for (let n = 1; n <= 30; n += 1) {
      expect(factorial(n)).toBe(BigInt(n) * factorial(n - 1));
    }
  });

  it('rejects negative and oversized arguments', () => {
    expect(() => factorial(-1)).toThrow('целым неотрицательным');
    expect(() => factorial(1.5)).toThrow('целым неотрицательным');
    expect(() => factorial(101)).toThrow('не должно превышать');
  });
});

describe('arrangements', () => {
  it('counts ordered selections', () => {
    expect(arrangements(5, 2)).toBe(20n);
    expect(arrangements(10, 3)).toBe(720n);
    expect(arrangements(7, 1)).toBe(7n);
    expect(arrangements(6, 0)).toBe(1n);
  });

  it('coincides with n! when all objects are placed', () => {
    for (let n = 0; n <= 12; n += 1) {
      expect(arrangements(n, n)).toBe(factorial(n));
    }
  });

  it('matches the quotient of factorials', () => {
    for (let n = 0; n <= 12; n += 1) {
      for (let k = 0; k <= n; k += 1) {
        expect(arrangements(n, k)).toBe(factorial(n) / factorial(n - k));
      }
    }
  });

  it('gives zero when there are more places than objects', () => {
    expect(arrangements(3, 5)).toBe(0n);
  });
});

describe('combinations', () => {
  it('counts unordered selections', () => {
    expect(combinations(5, 2)).toBe(10n);
    expect(combinations(6, 3)).toBe(20n);
    expect(combinations(36, 5)).toBe(376_992n);
    expect(combinations(49, 6)).toBe(13_983_816n);
  });

  it('keeps the border values C(n,0) = C(n,n) = 1', () => {
    for (let n = 0; n <= 20; n += 1) {
      expect(combinations(n, 0)).toBe(1n);
      expect(combinations(n, n)).toBe(1n);
      expect(combinations(n, 1)).toBe(BigInt(n));
    }
  });

  it('is symmetric: C(n,k) = C(n, n−k)', () => {
    for (let n = 0; n <= 30; n += 1) {
      for (let k = 0; k <= n; k += 1) {
        expect(combinations(n, k)).toBe(combinations(n, n - k));
      }
    }
  });

  it('matches the factorial formula n! / (k!(n−k)!)', () => {
    for (let n = 0; n <= 15; n += 1) {
      for (let k = 0; k <= n; k += 1) {
        expect(combinations(n, k)).toBe(factorial(n) / (factorial(k) * factorial(n - k)));
      }
    }
  });

  it('relates arrangements and combinations by k!', () => {
    for (let n = 0; n <= 12; n += 1) {
      for (let k = 0; k <= n; k += 1) {
        expect(arrangements(n, k)).toBe(combinations(n, k) * factorial(k));
      }
    }
  });

  it('gives zero for a selection larger than the set', () => {
    expect(combinations(4, 7)).toBe(0n);
  });
});

describe('Pascal triangle', () => {
  it('reproduces the first rows', () => {
    expect(pascalRow(0)).toEqual([1n]);
    expect(pascalRow(1)).toEqual([1n, 1n]);
    expect(pascalRow(4)).toEqual([1n, 4n, 6n, 4n, 1n]);
    expect(pascalRow(6)).toEqual([1n, 6n, 15n, 20n, 15n, 6n, 1n]);
  });

  it('agrees with the combinations formula in every cell', () => {
    for (let n = 0; n <= 25; n += 1) {
      const row = pascalRow(n);
      expect(row).toHaveLength(n + 1);
      row.forEach((value, k) => expect(value).toBe(combinations(n, k)));
    }
  });

  it('builds a triangle whose rows are the separate rows', () => {
    const triangle = pascalTriangle(8);
    expect(triangle).toHaveLength(9);
    triangle.forEach((row, index) => expect(row).toEqual(pascalRow(index)));
  });

  it('sums each row to a power of two', () => {
    for (let n = 0; n <= 20; n += 1) {
      expect(pascalRowSum(n)).toBe(2n ** BigInt(n));
    }
  });

  it('adds the two cells above to get the cell below', () => {
    for (let n = 1; n <= 20; n += 1) {
      for (let k = 0; k <= n; k += 1) {
        const parents = pascalParents(n, k);
        expect(parents.sum).toBe(combinations(n, k));
        expect(parents.left).toBe(k === 0 ? 0n : combinations(n - 1, k - 1));
        expect(parents.right).toBe(k === n ? 0n : combinations(n - 1, k));
      }
    }
  });

  it('has no cells above the apex', () => {
    expect(() => pascalParents(0, 0)).toThrow('вершины');
    expect(() => pascalParents(3, 5)).toThrow('не может превышать');
  });
});

describe('formatting large counts', () => {
  it('groups digits by three', () => {
    const space = DIGIT_GROUP_SEPARATOR;
    expect(formatCount(1n)).toBe('1');
    expect(formatCount(999n)).toBe('999');
    expect(formatCount(1000n)).toBe(`1${space}000`);
    expect(formatCount(factorial(10))).toBe(`3${space}628${space}800`);
    expect(formatCount(factorial(20))).toBe(
      `2${space}432${space}902${space}008${space}176${space}640${space}000`,
    );
  });

  it('converts safe counts to numbers and refuses unsafe ones', () => {
    expect(countToNumber(combinations(10, 5))).toBe(252);
    expect(() => countToNumber(factorial(30))).toThrow('безопасных целых');
  });
});

describe('Bernoulli formula', () => {
  const half = fraction(1, 2);

  it('matches hand computations for a fair coin', () => {
    expect(bernoulliProbability(3, 0, half)).toEqual({ numerator: 1, denominator: 8 });
    expect(bernoulliProbability(3, 1, half)).toEqual({ numerator: 3, denominator: 8 });
    expect(bernoulliProbability(3, 2, half)).toEqual({ numerator: 3, denominator: 8 });
    expect(bernoulliProbability(3, 3, half)).toEqual({ numerator: 1, denominator: 8 });
  });

  it('matches hand computations for an unfair trial', () => {
    // 5 выстрелов, p = 3/5: P(3) = 10 · 27/125 · 4/25 = 1080/3125 = 216/625.
    expect(bernoulliProbability(5, 3, fraction(3, 5))).toEqual({ numerator: 216, denominator: 625 });
    // 4 броска кубика, «шестёрка» — успех: P(1) = 4 · 1/6 · 125/216 = 500/1296 = 125/324.
    expect(bernoulliProbability(4, 1, fraction(1, 6))).toEqual({ numerator: 125, denominator: 324 });
    // Ни одного успеха — это просто q^n.
    expect(bernoulliProbability(4, 0, fraction(1, 6))).toEqual({ numerator: 625, denominator: 1296 });
  });

  it('gives probability zero for more successes than trials', () => {
    expect(bernoulliProbability(3, 4, half)).toEqual({ numerator: 0, denominator: 1 });
  });

  it('handles the degenerate probabilities 0 and 1', () => {
    expect(bernoulliProbability(4, 0, fraction(0, 1))).toEqual({ numerator: 1, denominator: 1 });
    expect(bernoulliProbability(4, 4, fraction(1, 1))).toEqual({ numerator: 1, denominator: 1 });
    expect(bernoulliProbability(4, 2, fraction(1, 1))).toEqual({ numerator: 0, denominator: 1 });
  });

  it('rejects impossible parameters', () => {
    expect(() => bernoulliProbability(0, 0, half)).toThrow('от 1 до');
    expect(() => bernoulliProbability(MAX_BERNOULLI_TRIALS + 1, 1, half)).toThrow('от 1 до');
    expect(() => bernoulliProbability(3, 1, fraction(3, 2))).toThrow('между 0 и 1');
    expect(() => bernoulliProbability(3, -1, half)).toThrow('целым неотрицательным');
  });
});

describe('distribution of the number of successes', () => {
  it('lists every possible number of successes', () => {
    const distribution = bernoulliDistribution(4, fraction(1, 2));
    expect(distribution.map((entry) => entry.value)).toEqual([0, 1, 2, 3, 4]);
    // Дроби хранятся несократимыми: 4/16 записана как 1/4, а 6/16 — как 3/8.
    expect(distribution.map((entry) => entry.probability)).toEqual([
      { numerator: 1, denominator: 16 },
      { numerator: 1, denominator: 4 },
      { numerator: 3, denominator: 8 },
      { numerator: 1, denominator: 4 },
      { numerator: 1, denominator: 16 },
    ]);
    // Приведённые к общему знаменателю 16 числители — это строка треугольника Паскаля.
    expect(distribution.map((entry) => (entry.probability.numerator * 16) / entry.probability.denominator))
      .toEqual([1, 4, 6, 4, 1]);
  });

  it('always sums to exactly 1', () => {
    const probabilities = [fraction(1, 2), fraction(1, 3), fraction(2, 5), fraction(3, 4), fraction(1, 6), fraction(9, 10)];
    for (const p of probabilities) {
      for (let trials = 1; trials <= 10; trials += 1) {
        expect(distributionTotal(bernoulliDistribution(trials, p))).toEqual({ numerator: 1, denominator: 1 });
      }
    }
  });

  it('stays exact at the largest supported number of trials', () => {
    const distribution = bernoulliDistribution(MAX_BERNOULLI_TRIALS, fraction(1, 2));
    expect(distribution).toHaveLength(MAX_BERNOULLI_TRIALS + 1);
    expect(distributionTotal(distribution)).toEqual({ numerator: 1, denominator: 1 });
  });

  it('has expected value n·p', () => {
    for (let trials = 1; trials <= 8; trials += 1) {
      expect(expectedValue(bernoulliDistribution(trials, fraction(1, 4)))).toEqual(fraction(trials, 4));
      expect(expectedValue(bernoulliDistribution(trials, fraction(2, 3)))).toEqual(fraction(2 * trials, 3));
    }
  });

  it('finds the most likely number of successes', () => {
    expect(mostLikelyValues(bernoulliDistribution(4, fraction(1, 2)))).toEqual([2]);
    expect(mostLikelyValues(bernoulliDistribution(5, fraction(1, 2)))).toEqual([2, 3]);
    expect(mostLikelyValues(bernoulliDistribution(6, fraction(1, 6)))).toEqual([1]);
  });

  it('answers cumulative questions', () => {
    const distribution = bernoulliDistribution(3, fraction(1, 2));
    expect(probabilityOfValue(distribution, 2)).toEqual({ numerator: 3, denominator: 8 });
    expect(probabilityAtLeast(distribution, 1)).toEqual({ numerator: 7, denominator: 8 });
    expect(probabilityAtMost(distribution, 1)).toEqual({ numerator: 1, denominator: 2 });
    expect(probabilityOfValue(distribution, 9)).toEqual({ numerator: 0, denominator: 1 });
  });
});

describe('random variable from equally likely outcomes', () => {
  it('collects equal values and keeps the order', () => {
    // Сумма очков на двух монетах: 0, 1, 1, 2 — четыре равновозможных исхода.
    expect(distributionOfEqualOutcomes([0, 1, 1, 2])).toEqual([
      { value: 0, probability: { numerator: 1, denominator: 4 } },
      { value: 1, probability: { numerator: 1, denominator: 2 } },
      { value: 2, probability: { numerator: 1, denominator: 4 } },
    ]);
  });

  it('describes the sum of two dice', () => {
    const sums: number[] = [];
    for (let first = 1; first <= 6; first += 1) {
      for (let second = 1; second <= 6; second += 1) sums.push(first + second);
    }
    const distribution = distributionOfEqualOutcomes(sums);

    expect(distribution).toHaveLength(11);
    expect(distribution[0]).toEqual({ value: 2, probability: { numerator: 1, denominator: 36 } });
    expect(probabilityOfValue(distribution, 7)).toEqual({ numerator: 1, denominator: 6 });
    expect(distributionTotal(distribution)).toEqual({ numerator: 1, denominator: 1 });
    expect(expectedValue(distribution)).toEqual({ numerator: 7, denominator: 1 });
    expect(mostLikelyValues(distribution)).toEqual([7]);
  });

  it('rejects an empty experiment and non-integer values', () => {
    expect(() => distributionOfEqualOutcomes([])).toThrow('хотя бы один');
    expect(() => distributionOfEqualOutcomes([1, 2.5])).toThrow('целым числом');
  });

  it('refuses to average an incomplete distribution', () => {
    expect(() => expectedValue([{ value: 1, probability: fraction(1, 3) }])).toThrow('должна равняться 1');
  });
});

describe('finite experiments with equally likely outcomes', () => {
  it('enumerates every outcome exactly once', () => {
    expect(finiteExperimentValues('twoDiceSum')).toHaveLength(36);
    expect(finiteExperimentValues('twoDiceMax')).toHaveLength(36);
    expect(finiteExperimentValues('twoDiceGap')).toHaveLength(36);
    expect(finiteExperimentValues('threeCoinsHeads')).toHaveLength(8);
    expect(finiteExperimentValues('threeCoinsHeads').slice().sort()).toEqual([0, 1, 1, 1, 2, 2, 2, 3]);
  });

  it('gives complete distributions', () => {
    for (const kind of ['twoDiceSum', 'twoDiceMax', 'twoDiceGap', 'threeCoinsHeads'] as const) {
      expect(distributionTotal(finiteExperimentDistribution(kind))).toEqual({ numerator: 1, denominator: 1 });
    }
  });

  it('reproduces the known table for the sum of two dice', () => {
    const distribution = finiteExperimentDistribution('twoDiceSum');
    expect(distribution.map((entry) => entry.value)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // Числа пар 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1 — восстанавливаем их из вероятностей.
    expect(distribution.map((entry) => (entry.probability.numerator * 36) / entry.probability.denominator))
      .toEqual([1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]);
    expect(expectedValue(distribution)).toEqual({ numerator: 7, denominator: 1 });
    expect(mostLikelyValues(distribution)).toEqual([7]);
  });

  it('counts pairs correctly for the maximum and the gap of two dice', () => {
    const maximum = finiteExperimentDistribution('twoDiceMax');
    // Наибольшее равно k ровно в 2k − 1 паре: 1, 3, 5, 7, 9, 11.
    expect(maximum.map((entry) => (entry.probability.numerator * 36) / entry.probability.denominator))
      .toEqual([1, 3, 5, 7, 9, 11]);
    expect(expectedValue(maximum)).toEqual({ numerator: 161, denominator: 36 });

    const gap = finiteExperimentDistribution('twoDiceGap');
    expect(gap.map((entry) => (entry.probability.numerator * 36) / entry.probability.denominator))
      .toEqual([6, 10, 8, 6, 4, 2]);
    expect(expectedValue(gap)).toEqual({ numerator: 35, denominator: 18 });
    expect(mostLikelyValues(gap)).toEqual([1]);
  });

  it('agrees with the Bernoulli scheme for three fair coins', () => {
    const coins = finiteExperimentDistribution('threeCoinsHeads');
    expect(coins).toEqual(bernoulliDistribution(3, fraction(1, 2)));
    expect(expectedValue(coins)).toEqual({ numerator: 3, denominator: 2 });
  });

  it('rejects an unknown experiment', () => {
    // @ts-expect-error — проверяем защиту от значения, которого нет в типе.
    expect(() => finiteExperimentValues('lottery')).toThrow('Неизвестный опыт');
    // @ts-expect-error — то же самое для таблицы распределения.
    expect(() => finiteExperimentDistribution('lottery')).toThrow('Неизвестный опыт');
  });
});

describe('decimal preview of an exact probability', () => {
  it('rounds to the requested number of digits', () => {
    expect(approximateProbability(fraction(1, 8))).toBe(0.125);
    expect(approximateProbability(fraction(1, 3), 3)).toBe(0.333);
    expect(approximateProbability(fraction(2, 3), 2)).toBe(0.67);
    expect(approximateProbability(fraction(1, 1), 0)).toBe(1);
  });

  it('rejects an impossible precision', () => {
    expect(() => approximateProbability(fraction(1, 3), -1)).toThrow('от 0 до 12');
  });
});
