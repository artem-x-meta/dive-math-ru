import { describe, expect, it } from 'vitest';
import {
  addFractions,
  classicalProbability,
  compareFractions,
  complementProbability,
  decimalToFraction,
  deviationsFromMean,
  enumerateOutcomes,
  eventProbability,
  formatFraction,
  fraction,
  fractionToNumber,
  isProbability,
  meanOf,
  multiplyFractions,
  pathProbability,
  populationVariance,
  rangeOf,
  subtractFractions,
  totalProbability,
  type TreeNode,
} from '../src/lib/probability';

/** Урна: 2 красных и 3 синих шара, два извлечения без возвращения. */
function twoDrawsWithoutReplacement(): TreeNode {
  return {
    edges: [
      {
        label: 'красный',
        probability: fraction(2, 5),
        child: {
          edges: [
            { label: 'красный', probability: fraction(1, 4), child: {} },
            { label: 'синий', probability: fraction(3, 4), child: {} },
          ],
        },
      },
      {
        label: 'синий',
        probability: fraction(3, 5),
        child: {
          edges: [
            { label: 'красный', probability: fraction(2, 4), child: {} },
            { label: 'синий', probability: fraction(2, 4), child: {} },
          ],
        },
      },
    ],
  };
}

describe('exact fractions', () => {
  it('normalizes fractions and keeps the sign in the numerator', () => {
    expect(fraction(6, 8)).toEqual({ numerator: 3, denominator: 4 });
    expect(fraction(3, -6)).toEqual({ numerator: -1, denominator: 2 });
    expect(fraction(0, -7)).toEqual({ numerator: 0, denominator: 1 });
  });

  it('rejects zero denominators and unsafe inputs', () => {
    expect(() => fraction(1, 0)).toThrow('не может быть равен нулю');
    expect(() => fraction(1.5, 2)).toThrow('безопасным целым');
  });

  it('adds, subtracts, multiplies and compares exactly', () => {
    expect(addFractions(fraction(1, 6), fraction(1, 3))).toEqual({ numerator: 1, denominator: 2 });
    expect(subtractFractions(fraction(1, 2), fraction(3, 4))).toEqual({ numerator: -1, denominator: 4 });
    expect(multiplyFractions(fraction(2, 5), fraction(1, 4))).toEqual({ numerator: 1, denominator: 10 });
    expect(compareFractions(fraction(2, 3), fraction(3, 5))).toBe(1);
    expect(compareFractions(fraction(1, 3), fraction(2, 6))).toBe(0);
  });

  it('converts terminating decimals exactly', () => {
    expect(decimalToFraction(0.1)).toEqual({ numerator: 1, denominator: 10 });
    expect(decimalToFraction(-2.25)).toEqual({ numerator: -9, denominator: 4 });
    expect(fractionToNumber(fraction(3, 8))).toBe(0.375);
  });

  it('formats fractions for display', () => {
    expect(formatFraction(fraction(3, 8))).toBe('3/8');
    expect(formatFraction(fraction(4, 2))).toBe('2');
    expect(formatFraction(fraction(-1, 4))).toBe('−1/4');
  });
});

describe('classical probability', () => {
  it('builds P(A) = m/n as a reduced fraction', () => {
    expect(classicalProbability(3, 6)).toEqual({ numerator: 1, denominator: 2 });
    expect(classicalProbability(0, 6)).toEqual({ numerator: 0, denominator: 1 });
    expect(classicalProbability(6, 6)).toEqual({ numerator: 1, denominator: 1 });
  });

  it('rejects impossible outcome counts', () => {
    expect(() => classicalProbability(7, 6)).toThrow('от 0 до числа всех исходов');
    expect(() => classicalProbability(-1, 6)).toThrow('от 0 до числа всех исходов');
    expect(() => classicalProbability(1, 0)).toThrow('положительным');
  });

  it('recognizes valid probabilities and complements them', () => {
    expect(isProbability(fraction(3, 4))).toBe(true);
    expect(isProbability(fraction(5, 4))).toBe(false);
    expect(isProbability(fraction(-1, 4))).toBe(false);
    expect(complementProbability(fraction(2, 7))).toEqual({ numerator: 5, denominator: 7 });
    expect(() => complementProbability(fraction(9, 7))).toThrow('между 0 и 1');
  });
});

describe('probability tree', () => {
  it('multiplies probabilities along a path', () => {
    expect(pathProbability([fraction(1, 2), fraction(1, 2)])).toEqual({ numerator: 1, denominator: 4 });
    expect(pathProbability([fraction(2, 5), fraction(1, 4)])).toEqual({ numerator: 1, denominator: 10 });
    expect(() => pathProbability([])).toThrow('хотя бы один шаг');
    expect(() => pathProbability([fraction(3, 2)])).toThrow('между 0 и 1');
  });

  it('enumerates all root-to-leaf outcomes of the urn experiment', () => {
    const outcomes = enumerateOutcomes(twoDrawsWithoutReplacement());
    expect(outcomes).toEqual([
      { steps: ['красный', 'красный'], probability: { numerator: 1, denominator: 10 } },
      { steps: ['красный', 'синий'], probability: { numerator: 3, denominator: 10 } },
      { steps: ['синий', 'красный'], probability: { numerator: 3, denominator: 10 } },
      { steps: ['синий', 'синий'], probability: { numerator: 3, denominator: 10 } },
    ]);
  });

  it('checks that leaf probabilities of a complete tree sum to 1', () => {
    const outcomes = enumerateOutcomes(twoDrawsWithoutReplacement());
    expect(totalProbability(outcomes)).toEqual({ numerator: 1, denominator: 1 });
  });

  it('adds favorable leaves to get an event probability', () => {
    const outcomes = enumerateOutcomes(twoDrawsWithoutReplacement());
    const differentColors = eventProbability(
      outcomes,
      (outcome) => outcome.steps[0] !== outcome.steps[1],
    );
    expect(differentColors).toEqual({ numerator: 3, denominator: 5 });
    const atLeastOneRed = eventProbability(
      outcomes,
      (outcome) => outcome.steps.includes('красный'),
    );
    expect(atLeastOneRed).toEqual({ numerator: 7, denominator: 10 });
  });

  it('rejects a branch whose probabilities do not sum to 1', () => {
    const broken: TreeNode = {
      edges: [
        { label: 'орёл', probability: fraction(1, 2), child: {} },
        { label: 'решка', probability: fraction(1, 3), child: {} },
      ],
    };
    expect(() => enumerateOutcomes(broken)).toThrow('должна равняться 1');
    expect(() => enumerateOutcomes({})).toThrow('хотя бы один шаг испытания');
  });
});

describe('data spread', () => {
  it('computes the range of a data set', () => {
    expect(rangeOf([7, 3, 9, 4])).toEqual({ numerator: 6, denominator: 1 });
    expect(rangeOf([2.5, 1.5, 2])).toEqual({ numerator: 1, denominator: 1 });
    expect(() => rangeOf([])).toThrow('хотя бы один элемент');
  });

  it('computes the exact mean and zero-sum deviations', () => {
    expect(meanOf([3, 4, 5, 4, 4])).toEqual({ numerator: 4, denominator: 1 });
    expect(meanOf([1, 2])).toEqual({ numerator: 3, denominator: 2 });

    const deviations = deviationsFromMean([3, 4, 5, 4, 4]);
    expect(deviations).toEqual([
      { numerator: -1, denominator: 1 },
      { numerator: 0, denominator: 1 },
      { numerator: 1, denominator: 1 },
      { numerator: 0, denominator: 1 },
      { numerator: 0, denominator: 1 },
    ]);
    const sum = deviations.reduce((left, right) => addFractions(left, right), fraction(0, 1));
    expect(sum).toEqual({ numerator: 0, denominator: 1 });
  });

  it('computes the population variance as an exact fraction', () => {
    expect(populationVariance([3, 4, 5, 4, 4])).toEqual({ numerator: 2, denominator: 5 });
    // Две серии с одинаковым средним 7, но разным рассеиванием.
    expect(populationVariance([7, 7, 7, 7])).toEqual({ numerator: 0, denominator: 1 });
    expect(populationVariance([5, 9, 6, 8])).toEqual({ numerator: 5, denominator: 2 });
    // Десятичные данные тоже считаются точно.
    expect(populationVariance([1.5, 2.5])).toEqual({ numerator: 1, denominator: 4 });
  });

  it('keeps the mean between the smallest and the largest value', () => {
    const mean = meanOf([2, 10, 6]);
    expect(compareFractions(mean, fraction(2, 1))).toBe(1);
    expect(compareFractions(mean, fraction(10, 1))).toBe(-1);
  });
});
