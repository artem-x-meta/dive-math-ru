import { describe, expect, it } from 'vitest';
import {
  addFractions,
  areDisjointSets,
  buildIndependentTree,
  buildUrnTree,
  classicalProbability,
  complementOfSet,
  countLabel,
  differenceOfSets,
  intersectionOfSets,
  isPrimeNumber,
  layoutTree,
  outcomeSet,
  partitionByEvents,
  probabilityOfSet,
  selectOutcomes,
  unionOfSets,
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

  it('separates two samples with equal mean but different spread', () => {
    // Урок 6.4: одинаковое среднее 8, отклонения второго ряда вдвое больше.
    expect(meanOf([6, 7, 8, 9, 10])).toEqual({ numerator: 8, denominator: 1 });
    expect(meanOf([4, 6, 8, 10, 12])).toEqual({ numerator: 8, denominator: 1 });
    expect(rangeOf([6, 7, 8, 9, 10])).toEqual({ numerator: 4, denominator: 1 });
    expect(rangeOf([4, 6, 8, 10, 12])).toEqual({ numerator: 8, denominator: 1 });
    expect(populationVariance([6, 7, 8, 9, 10])).toEqual({ numerator: 2, denominator: 1 });
    expect(populationVariance([4, 6, 8, 10, 12])).toEqual({ numerator: 8, denominator: 1 });
  });

  it('separates two samples with equal mean and equal range', () => {
    // Урок 6.4: размах не различает эти ряды, а дисперсия различает.
    expect(rangeOf([5, 8, 8, 8, 11])).toEqual({ numerator: 6, denominator: 1 });
    expect(rangeOf([5, 5, 8, 11, 11])).toEqual({ numerator: 6, denominator: 1 });
    expect(populationVariance([5, 8, 8, 8, 11])).toEqual({ numerator: 18, denominator: 5 });
    expect(populationVariance([5, 5, 8, 11, 11])).toEqual({ numerator: 36, denominator: 5 });
  });
});

describe('events as sets of outcomes', () => {
  const universe = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  it('normalizes a list of outcomes into a set', () => {
    expect(outcomeSet([3, 1, 3, 2])).toEqual([1, 2, 3]);
    expect(outcomeSet([])).toEqual([]);
    expect(() => outcomeSet([1.5])).toThrow('целым числом');
  });

  it('selects standard events of the twelve-card experiment', () => {
    expect(selectOutcomes(universe, 'even')).toEqual([2, 4, 6, 8, 10, 12]);
    expect(selectOutcomes(universe, 'odd')).toEqual([1, 3, 5, 7, 9, 11]);
    expect(selectOutcomes(universe, 'multipleOfThree')).toEqual([3, 6, 9, 12]);
    expect(selectOutcomes(universe, 'prime')).toEqual([2, 3, 5, 7, 11]);
    expect(selectOutcomes(universe, 'greaterThanSix')).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it('knows which numbers are prime', () => {
    expect([0, 1, 4, 9, 12].map(isPrimeNumber)).toEqual([false, false, false, false, false]);
    expect([2, 3, 5, 7, 11, 13].map(isPrimeNumber)).toEqual([true, true, true, true, true, true]);
  });

  it('combines events with union, intersection, difference and complement', () => {
    const even = selectOutcomes(universe, 'even');
    const byThree = selectOutcomes(universe, 'multipleOfThree');
    expect(unionOfSets(even, byThree)).toEqual([2, 3, 4, 6, 8, 9, 10, 12]);
    expect(intersectionOfSets(even, byThree)).toEqual([6, 12]);
    expect(differenceOfSets(even, byThree)).toEqual([2, 4, 8, 10]);
    expect(complementOfSet(universe, even)).toEqual([1, 3, 5, 7, 9, 11]);
    expect(() => complementOfSet(universe, [13])).toThrow('не входит в список исходов');
  });

  it('recognizes disjoint events', () => {
    expect(areDisjointSets([2, 4], [1, 3])).toBe(true);
    expect(areDisjointSets([2, 4], [4, 5])).toBe(false);
  });

  it('splits the experiment into the four regions of an Euler diagram', () => {
    const partition = partitionByEvents(
      universe,
      selectOutcomes(universe, 'even'),
      selectOutcomes(universe, 'multipleOfThree'),
    );
    expect(partition).toEqual({
      onlyLeft: [2, 4, 8, 10],
      both: [6, 12],
      onlyRight: [3, 9],
      neither: [1, 5, 7, 11],
    });
    const sizes = [
      partition.onlyLeft.length,
      partition.both.length,
      partition.onlyRight.length,
      partition.neither.length,
    ];
    expect(sizes.reduce((left, right) => left + right, 0)).toBe(universe.length);
  });

  it('computes classical probabilities of events and checks the addition rule', () => {
    const even = selectOutcomes(universe, 'even');
    const byThree = selectOutcomes(universe, 'multipleOfThree');
    expect(probabilityOfSet(even, universe)).toEqual({ numerator: 1, denominator: 2 });
    expect(probabilityOfSet(byThree, universe)).toEqual({ numerator: 1, denominator: 3 });
    expect(probabilityOfSet(unionOfSets(even, byThree), universe)).toEqual({ numerator: 2, denominator: 3 });
    expect(probabilityOfSet(complementOfSet(universe, even), universe)).toEqual({ numerator: 1, denominator: 2 });

    // P(A ∪ B) = P(A) + P(B) − P(A ∩ B)
    const inclusionExclusion = subtractFractions(
      addFractions(probabilityOfSet(even, universe), probabilityOfSet(byThree, universe)),
      probabilityOfSet(intersectionOfSets(even, byThree), universe),
    );
    expect(inclusionExclusion).toEqual({ numerator: 2, denominator: 3 });
    expect(probabilityOfSet([], universe)).toEqual({ numerator: 0, denominator: 1 });
    expect(probabilityOfSet(universe, universe)).toEqual({ numerator: 1, denominator: 1 });
  });
});

describe('building experiment trees', () => {
  const urn = [
    { label: 'красный', count: 2 },
    { label: 'синий', count: 3 },
  ];

  it('builds the урна tree without replacement', () => {
    const outcomes = enumerateOutcomes(buildUrnTree(urn, 2, false));
    expect(outcomes).toEqual([
      { steps: ['красный', 'красный'], probability: { numerator: 1, denominator: 10 } },
      { steps: ['красный', 'синий'], probability: { numerator: 3, denominator: 10 } },
      { steps: ['синий', 'красный'], probability: { numerator: 3, denominator: 10 } },
      { steps: ['синий', 'синий'], probability: { numerator: 3, denominator: 10 } },
    ]);
    expect(totalProbability(outcomes)).toEqual({ numerator: 1, denominator: 1 });
  });

  it('builds the урна tree with replacement', () => {
    const outcomes = enumerateOutcomes(buildUrnTree(urn, 2, true));
    expect(outcomes.map((outcome) => formatFraction(outcome.probability))).toEqual([
      '4/25',
      '6/25',
      '6/25',
      '9/25',
    ]);
    expect(totalProbability(outcomes)).toEqual({ numerator: 1, denominator: 1 });
  });

  it('drops a colour that has run out and keeps the tree complete', () => {
    const outcomes = enumerateOutcomes(
      buildUrnTree([{ label: 'красный', count: 1 }, { label: 'синий', count: 2 }], 2, false),
    );
    expect(outcomes.map((outcome) => outcome.steps.join('+'))).toEqual([
      'красный+синий',
      'синий+красный',
      'синий+синий',
    ]);
    expect(totalProbability(outcomes)).toEqual({ numerator: 1, denominator: 1 });
  });

  it('rejects impossible урна settings', () => {
    expect(() => buildUrnTree(urn, 6, true)).toThrow('от 1 до 4');
    expect(() => buildUrnTree([{ label: 'красный', count: 1 }, { label: 'синий', count: 2 }], 4, false))
      .toThrow('больше шаров, чем лежит');
    expect(() => buildUrnTree([{ label: 'красный', count: 0 }, { label: 'синий', count: 0 }], 1, true))
      .toThrow('хотя бы один шар');
    expect(() => buildUrnTree([{ label: 'красный', count: 2 }], 1, true)).toThrow('от 2 до 4 разных цветов');
  });

  it('builds a tree of independent steps and counts labels along a path', () => {
    const guessing = buildIndependentTree([
      [
        { label: 'верно', probability: fraction(1, 4) },
        { label: 'неверно', probability: fraction(3, 4) },
      ],
      [
        { label: 'верно', probability: fraction(1, 4) },
        { label: 'неверно', probability: fraction(3, 4) },
      ],
    ]);
    const outcomes = enumerateOutcomes(guessing);
    expect(outcomes.map((outcome) => formatFraction(outcome.probability))).toEqual([
      '1/16',
      '3/16',
      '3/16',
      '9/16',
    ]);
    expect(eventProbability(outcomes, (outcome) => countLabel(outcome, 'верно') >= 1)).toEqual({
      numerator: 7,
      denominator: 16,
    });
    expect(eventProbability(outcomes, (outcome) => countLabel(outcome, 'верно') === 1)).toEqual({
      numerator: 3,
      denominator: 8,
    });
    expect(() => buildIndependentTree([])).toThrow('от 1 до 4 шагов');
  });
});

describe('tree layout', () => {
  const outcomes = layoutTree(buildUrnTree([
    { label: 'К', count: 2 },
    { label: 'С', count: 3 },
  ], 2, false));

  it('puts leaves into consecutive rows and parents exactly between them', () => {
    expect(outcomes).toHaveLength(7);
    const leaves = outcomes.filter((node) => node.isLeaf);
    expect(leaves.map((node) => node.row)).toEqual([0, 1, 2, 3]);
    expect(leaves.map((node) => node.depth)).toEqual([2, 2, 2, 2]);

    const root = outcomes[0]!;
    expect(root.parent).toBeNull();
    expect(root.row).toBe(1.5);
    expect(root.pathProbability).toEqual({ numerator: 1, denominator: 1 });

    const firstBranch = outcomes[1]!;
    expect(firstBranch.parent).toBe(0);
    expect(firstBranch.row).toBe(0.5);
    expect(firstBranch.edgeProbability).toEqual({ numerator: 2, denominator: 5 });
  });

  it('multiplies probabilities along every path', () => {
    const leaves = outcomes.filter((node) => node.isLeaf);
    expect(leaves.map((node) => `${node.steps.join('')} = ${formatFraction(node.pathProbability)}`)).toEqual([
      'КК = 1/10',
      'КС = 3/10',
      'СК = 3/10',
      'СС = 3/10',
    ]);
  });
});
