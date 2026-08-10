/**
 * Числа из уроков 8 класса.
 *
 * Каждый блок describe — глава, каждый it — урок. Проверки пересчитывают ответы
 * вычислительным ядром из src/lib, а не сравнивают константу с константой.
 */
import { describe, expect, it } from 'vitest';

import {
  addRadicals,
  bracketSquareRoot,
  compareRadicals,
  estimateSquareRoot,
  formatRadical,
  integerSquareRoot,
  isPerfectSquare,
  makeRadical,
  multiplyRadicals,
  radicalToSquareRoot,
  rationalizeDenominator,
  simplifyRadical,
  squareRootOfSquare,
} from '../src/lib/roots';

import {
  combinationRestrictions,
  evaluateCombination,
  evaluateFraction,
  restrictedValues,
  solveFractionEqualsZero,
  type FractionCombination,
  type FractionExpression,
  type Polynomial,
} from '../src/lib/algebraicFractions';

import { formatExactRussian, toExactNumber, type ExactRational } from '../src/lib/exactRational';

import {
  discriminant,
  formatRational,
  monicFromRoots,
  solveQuadratic,
  vietaProduct,
  vietaSum,
} from '../src/lib/quadratics';

import {
  closedInterval,
  curveValue,
  estimateDifference,
  estimateProduct,
  estimateQuotient,
  estimateScaled,
  estimateSum,
  formatIntervalText,
  formatSetText,
  greaterThanSet,
  halfOpenInterval,
  intersectAll,
  lessThanSet,
  linearInequality,
  openInterval,
  solveInequalitySystem,
  solveLinearInequality,
} from '../src/lib/inequalities';
import { linearExpression } from '../src/lib/linear';

import {
  angleBetweenTangents,
  areaFactor,
  chordIntersectionSegment,
  cosineDegrees,
  hypotenuseLength,
  inscribedAngleFromCentral,
  isRightTriangle,
  legLength,
  legsFromHypotenuseAndAngle,
  lineCirclePosition,
  rightTriangleFromLegs,
  similarityFactor,
  sineDegrees,
  tangentDegrees,
  tangentSegmentLength,
  thalesRatio,
  thalesSegment,
  triangleAreaByHeight,
} from '../src/lib/similarity';

import {
  buildUrnTree,
  classicalProbability,
  complementProbability,
  enumerateOutcomes,
  eventProbability,
  formatFraction,
  fraction,
  intersectionOfSets,
  meanOf,
  populationVariance,
  probabilityOfSet,
  rangeOf,
  selectOutcomes,
  totalProbability,
  unionOfSets,
  buildIndependentTree,
} from '../src/lib/probability';

/* ────────────────────────────── вспомогательное ────────────────────────────── */

const CARDS = Array.from({ length: 12 }, (_, index) => index + 1);

/** Список запрещённых значений в человекочитаемом виде. */
const restrictionList = (values: readonly ExactRational[]): string[] => values.map(formatExactRussian);

/** Одна дробь как выражение. */
const frac = (numerator: Polynomial, denominator: Polynomial): FractionExpression => ({
  numerator,
  denominator,
});

/**
 * Проверяет, что запись `combination` совпадает с обещанным в уроке ответом
 * (дробью numerator/denominator) во всех перечисленных допустимых точках.
 */
const agreesAt = (
  combination: FractionCombination,
  answer: FractionExpression,
  points: readonly number[],
): void => {
  for (const point of points) {
    const left = evaluateCombination(combination, point);
    const right = evaluateFraction(answer.numerator, answer.denominator, point);
    expect(left.defined, `запись определена при x = ${point}`).toBe(true);
    expect(right.defined, `ответ определён при x = ${point}`).toBe(true);
    expect(formatExactRussian(left.value!)).toBe(formatExactRussian(right.value!));
  }
};

/** Число пар на двух кубиках, дающих заданную сумму. */
const pairsWithSum = (sum: number): number => {
  let count = 0;
  for (let red = 1; red <= 6; red += 1) {
    for (let blue = 1; blue <= 6; blue += 1) {
      if (red + blue === sum) count += 1;
    }
  }
  return count;
};

/* ══════════════════════════ 1. Действительные числа ══════════════════════════ */

describe('8 класс, глава 1 «Действительные числа»', () => {
  it('урок 1.1: значения корня, тождества и уравнение x² = a', () => {
    expect(integerSquareRoot(64)).toBe(8);
    expect(integerSquareRoot(121)).toBe(11);
    expect(integerSquareRoot(400)).toBe(20);
    expect(integerSquareRoot(169)).toBe(13);
    // Десятичные и дробные примеры разбора: 0,7² = 0,49; 1,2² = 1,44; 1,5² = 2,25.
    expect(estimateSquareRoot('0.49', 1).lower).toBe('0.7');
    expect(estimateSquareRoot('0.49', 1).exact).toBe(true);
    expect(estimateSquareRoot('1.44', 1).lower).toBe('1.2');
    expect(estimateSquareRoot('2.25', 1).lower).toBe('1.5');
    // √(−7)² = 7 и (√7)² = 7 — один ответ, два разных пути.
    expect(squareRootOfSquare(-7)).toBe(7);
    expect(squareRootOfSquare(-6)).toBe(6);
    // Задача 9: сторона 1,5 м, периметр 6 м.
    expect(4 * 1.5).toBe(6);
    // Задача 10: √81 = 9 > 8,5.
    expect(integerSquareRoot(81)).toBe(9);
    // Задача 7: x² = 5 — корень иррационален, точных квадратов нет.
    expect(isPerfectSquare(5)).toBe(false);
  });

  it('урок 1.2: приближения √2 и зажим √30 между целыми', () => {
    const twoHundredths = estimateSquareRoot('2', 2);
    expect(twoHundredths.lower).toBe('1.41');
    expect(twoHundredths.upper).toBe('1.42');
    expect(twoHundredths.lowerSquare).toBe('1.9881');
    expect(twoHundredths.upperSquare).toBe('2.0164');
    expect(estimateSquareRoot('2', 3).lowerSquare).toBe('1.999396');
    // Задача 3: (7/5)² = 1,96 ≠ 2.
    expect((7 / 5) ** 2).toBeCloseTo(1.96, 12);
    // Задача 8: 5 < √30 < 6.
    expect(bracketSquareRoot(30)).toEqual({ lower: 5, upper: 6, exact: false });
    // Задача 1: рационален √25 и √0,04, иррационален √26.
    expect(isPerfectSquare(25)).toBe(true);
    expect(isPerfectSquare(26)).toBe(false);
    expect(estimateSquareRoot('0.04', 1)).toMatchObject({ lower: '0.2', exact: true });
    // Задачи 6–7: √2·√8 = 4, √2·√18 = 6.
    expect(integerSquareRoot(2 * 8)).toBe(4);
    expect(integerSquareRoot(2 * 18)).toBe(6);
  });

  it('урок 1.3: зажим корня по разрядам и сравнение через квадраты', () => {
    expect(bracketSquareRoot(50)).toEqual({ lower: 7, upper: 8, exact: false });
    const fifty = estimateSquareRoot('50', 2);
    expect([fifty.lower, fifty.upper]).toEqual(['7.07', '7.08']);
    expect([fifty.lowerSquare, fifty.upperSquare]).toEqual(['49.9849', '50.1264']);
    expect(estimateSquareRoot('50', 1)).toMatchObject({ lower: '7.0', upperSquare: '50.41' });

    // Задача 1: зажимы для 11, 44, 95.
    expect(bracketSquareRoot(11)).toMatchObject({ lower: 3, upper: 4 });
    expect(bracketSquareRoot(44)).toMatchObject({ lower: 6, upper: 7 });
    expect(bracketSquareRoot(95)).toMatchObject({ lower: 9, upper: 10 });
    // Задача 2: √20 ≈ 4,4 с недостатком.
    expect(estimateSquareRoot('20', 1)).toMatchObject({
      lower: '4.4',
      upper: '4.5',
      lowerSquare: '19.36',
      upperSquare: '20.25',
    });
    // Задачи 3–5: сравнения через квадраты.
    expect(3.2 ** 2).toBeCloseTo(10.24, 12);
    expect(7 ** 2).toBeGreaterThan(48);
    expect(radicalToSquareRoot(makeRadical(2, 5))).toBe(20);
    expect(4.5 ** 2).toBeCloseTo(20.25, 12);
    // Задача 6: сторона квадрата площадью 200.
    expect(estimateSquareRoot('200', 1)).toMatchObject({
      lower: '14.1',
      upper: '14.2',
      lowerSquare: '198.81',
      upperSquare: '201.64',
    });
    // Задача 8: целая часть √150 равна 12.
    expect(integerSquareRoot(150)).toBe(12);
    // Задача 9: периметр площадки площадью 56 м² лежит между 29,92 и 29,96 м.
    const fiftySix = estimateSquareRoot('56', 2);
    expect([fiftySix.lower, fiftySix.upper]).toEqual(['7.48', '7.49']);
    expect([fiftySix.lowerSquare, fiftySix.upperSquare]).toEqual(['55.9504', '56.1001']);
    expect(4 * Number(fiftySix.lower)).toBeCloseTo(29.92, 12);
    expect(4 * Number(fiftySix.upper)).toBeCloseTo(29.96, 12);
    expect(4 * Number(fiftySix.upper)).toBeLessThan(30);
    // Задача 10: 6 < √40 < 7.
    expect(bracketSquareRoot(40)).toMatchObject({ lower: 6, upper: 7 });
  });

  it('урок 1.4: вынесение множителя, подобные радикалы и рационализация', () => {
    expect(formatRadical(simplifyRadical(72))).toBe('6√2');
    // Задача 1.
    expect(formatRadical(simplifyRadical(18))).toBe('3√2');
    expect(formatRadical(simplifyRadical(48))).toBe('4√3');
    expect(formatRadical(simplifyRadical(75))).toBe('5√3');
    expect(formatRadical(simplifyRadical(200))).toBe('10√2');
    // Задача 2: внесение множителя.
    expect(radicalToSquareRoot(makeRadical(2, 7))).toBe(28);
    expect(radicalToSquareRoot(makeRadical(5, 2))).toBe(50);
    expect(radicalToSquareRoot(makeRadical(3, 10))).toBe(90);
    // Задача 3: произведения корней.
    expect(formatRadical(multiplyRadicals(simplifyRadical(2), simplifyRadical(8)))).toBe('4');
    expect(formatRadical(multiplyRadicals(simplifyRadical(3), simplifyRadical(27)))).toBe('9');
    expect(formatRadical(multiplyRadicals(simplifyRadical(5), simplifyRadical(20)))).toBe('10');
    // Задача 4: частные корней.
    expect(integerSquareRoot(72 / 2)).toBe(6);
    expect(integerSquareRoot(98 / 2)).toBe(7);
    // Задачи 5–6: подобные радикалы.
    expect(addRadicals(makeRadical(3, 5), makeRadical(1, 5))).toEqual(makeRadical(4, 5));
    expect(formatRadical(addRadicals(makeRadical(4, 5), makeRadical(-1, 5))!)).toBe('3√5');
    expect(formatRadical(addRadicals(simplifyRadical(8), simplifyRadical(50))!)).toBe('7√2');
    // Задача 9: (√5 + 2)² = 9 + 4√5.
    expect(5 + 4).toBe(9);
    expect(formatRadical(makeRadical(2 * 2, 5))).toBe('4√5');
    // Задача 10: рационализация знаменателя.
    expect(rationalizeDenominator(1, 5)).toEqual({ numerator: 1, denominator: 5, radicand: 5 });
    expect(rationalizeDenominator(10, 2)).toEqual({ numerator: 5, denominator: 1, radicand: 2 });
    expect(rationalizeDenominator(6, 3)).toEqual({ numerator: 2, denominator: 1, radicand: 3 });
    // Задача 11: √1,44·100 = 12 двумя способами.
    expect(integerSquareRoot(144)).toBe(12);
    expect(1.2 * 10).toBeCloseTo(12, 12);
    // Задача 12: 3√2 < 2√5.
    expect(compareRadicals(makeRadical(3, 2), makeRadical(2, 5))).toBe(-1);
    expect(radicalToSquareRoot(makeRadical(3, 2))).toBe(18);
    expect(radicalToSquareRoot(makeRadical(2, 5))).toBe(20);
  });

  it('урок 1.5 (практикум): площадка, ограда и мозаика', () => {
    // Станция 1: √45 = 3√5, проверка внесением.
    expect(formatRadical(simplifyRadical(45))).toBe('3√5');
    expect(radicalToSquareRoot(makeRadical(3, 5))).toBe(45);
    // Станция 2: 6,70 < √45 < 6,71, периметр от 26,80 до 26,84 м.
    const fortyFive = estimateSquareRoot('45', 2);
    expect([fortyFive.lower, fortyFive.upper]).toEqual(['6.70', '6.71']);
    expect([fortyFive.lowerSquare, fortyFive.upperSquare]).toEqual(['44.8900', '45.0241']);
    expect(4 * Number(fortyFive.lower)).toBeCloseTo(26.8, 12);
    expect(4 * Number(fortyFive.upper)).toBeCloseTo(26.84, 12);
    expect(4 * Number(fortyFive.upper)).toBeLessThan(26.9);
    // Станция 3: 14√2 = √392 < 20 < √450 = 15√2 — ровно 14 плиток.
    expect(radicalToSquareRoot(makeRadical(14, 2))).toBe(392);
    expect(radicalToSquareRoot(makeRadical(15, 2))).toBe(450);
    expect(392).toBeLessThan(400);
    expect(450).toBeGreaterThan(400);
    // Задача 4: сторона плитки √2 ≈ 1,41 с недостатком.
    expect(estimateSquareRoot('2', 2)).toMatchObject({
      lower: '1.41',
      lowerSquare: '1.9881',
      upperSquare: '2.0164',
    });
    // Задачи 6–9.
    expect(integerSquareRoot(8 * 18)).toBe(12);
    expect(formatRadical(addRadicals(makeRadical(2, 12), makeRadical(-1, 27))!)).toBe('√3');
    expect(radicalToSquareRoot(makeRadical(2, 3)) / 1).toBe(12);
    expect(formatRadical(simplifyRadical(20))).toBe('2√5');
    // Задача 10: 9,9² = 98,01 < 99.
    expect(9.9 ** 2).toBeCloseTo(98.01, 12);
    // Задача 11: √50·√2 = 10 — число рациональное.
    expect(integerSquareRoot(50 * 2)).toBe(10);
    // Задача 12: 5,5² = 30,25 > 30, ковёр не помещается.
    expect(5.5 ** 2).toBeCloseTo(30.25, 12);
  });
});

/* ══════════════════════════ 2. Алгебраические дроби ══════════════════════════ */

describe('8 класс, глава 2 «Алгебраические дроби»', () => {
  it('урок 2.1: допустимые значения по знаменателю', () => {
    // Разбор: (2x + 1)/(x² − 4) определена при x ≠ ±2.
    expect(restrictionList(restrictedValues([-4, 0, 1]))).toEqual(['−2', '2']);
    expect(formatExactRussian(evaluateFraction([1, 2], [-4, 0, 1], 3).value!)).toBe('1,4');
    // Практика 1–7.
    expect(restrictionList(restrictedValues([-7, 1]))).toEqual(['7']);
    expect(restrictionList(restrictedValues([8, 2]))).toEqual(['−4']);
    expect(restrictionList(restrictedValues([-25, 0, 1]))).toEqual(['−5', '5']);
    expect(restrictedValues([9, 0, 1])).toEqual([]);
    expect(restrictionList(restrictedValues([0, 3]))).toEqual(['0']);
    expect(restrictionList(restrictedValues([0, -1, 1]))).toEqual(['0', '1']);
    // Задача 7: (x − 1)(x + 3) = x² + 2x − 3.
    expect(restrictionList(restrictedValues([-3, 2, 1]))).toEqual(['−3', '1']);
    // Задача 8: (x² − 1)/(x + 4) при x = 2 равно 0,5.
    expect(formatExactRussian(evaluateFraction([-1, 0, 1], [4, 1], 2).value!)).toBe('0,5');
    // Задача 9: (x − 6)/(x + 2) = 0 при x = 6.
    expect(restrictionList(solveFractionEqualsZero([-6, 1], [2, 1]).roots)).toEqual(['6']);
  });

  it('урок 2.2: сокращение сохраняет запреты исходного знаменателя', () => {
    // Разбор: (x² − 9)/(x² − 6x + 9) = (x + 3)/(x − 3) при x ≠ 3.
    expect(restrictionList(restrictedValues([9, -6, 1]))).toEqual(['3']);
    agreesAt(
      { operation: 'single', left: frac([-9, 0, 1], [9, -6, 1]) },
      frac([3, 1], [-3, 1]),
      [0, 1, 5, -4],
    );
    expect(formatExactRussian(evaluateFraction([-9, 0, 1], [9, -6, 1], 5).value!)).toBe('4');

    // Практика 2: (5x + 15)/(x + 3) = 5 при x ≠ −3.
    expect(restrictionList(restrictedValues([3, 1]))).toEqual(['−3']);
    agreesAt({ operation: 'single', left: frac([15, 5], [3, 1]) }, frac([5], [1]), [0, 1, 2, -1]);
    // Практика 3: (x² − 16)/(x − 4) = x + 4 при x ≠ 4.
    expect(restrictionList(restrictedValues([-4, 1]))).toEqual(['4']);
    agreesAt({ operation: 'single', left: frac([-16, 0, 1], [-4, 1]) }, frac([4, 1], [1]), [0, 1, -4, 5]);
    // Практика 5: (x² + 4x + 4)/(x + 2) = x + 2 при x ≠ −2.
    expect(restrictionList(restrictedValues([2, 1]))).toEqual(['−2']);
    agreesAt({ operation: 'single', left: frac([4, 4, 1], [2, 1]) }, frac([2, 1], [1]), [0, 3, -5]);
    // Практика 6: (2 − x)/(x − 2) = −1 при x ≠ 2.
    expect(restrictionList(restrictedValues([-2, 1]))).toEqual(['2']);
    agreesAt({ operation: 'single', left: frac([2, -1], [-2, 1]) }, frac([-1], [1]), [0, 1, 5]);
    // Практика 7: (x² − 5x)/(x² − 25) = x/(x + 5) при x ≠ ±5.
    expect(restrictionList(restrictedValues([-25, 0, 1]))).toEqual(['−5', '5']);
    agreesAt({ operation: 'single', left: frac([0, -5, 1], [-25, 0, 1]) }, frac([0, 1], [5, 1]), [0, 1, 4]);
    // Практика 8: (x + 4)/(x + 8) = 1/2 только при x = 0.
    expect(formatExactRussian(evaluateFraction([4, 1], [8, 1], 0).value!)).toBe('0,5');
    expect(formatExactRussian(evaluateFraction([4, 1], [8, 1], 1).value!)).not.toBe('0,5');
    // Практика 9: (4x² − 9)/(2x + 3) = 2x − 3 при x ≠ −1,5.
    expect(restrictionList(restrictedValues([3, 2]))).toEqual(['−1,5']);
    agreesAt({ operation: 'single', left: frac([-9, 0, 4], [3, 2]) }, frac([-3, 2], [1]), [0, 1, 2]);
  });

  it('урок 2.3: сложение и вычитание — ответ и запреты', () => {
    // Ошибка урока: (2x + 1)/x − (x − 4)/x = (x + 5)/x, при x = 1 значение 6.
    const difference: FractionCombination = {
      operation: 'difference',
      left: frac([1, 2], [0, 1]),
      right: frac([-4, 1], [0, 1]),
    };
    agreesAt(difference, frac([5, 1], [0, 1]), [1, 2, -3]);
    expect(formatExactRussian(evaluateCombination(difference, 1).value!)).toBe('6');
    expect(restrictionList(combinationRestrictions(difference))).toEqual(['0']);

    // Разбор: 2/(x − 3) − 1/(x + 3) = (x + 9)/(x² − 9) при x ≠ ±3; при x = 0 обе части равны −1.
    const worked: FractionCombination = {
      operation: 'difference',
      left: frac([2], [-3, 1]),
      right: frac([1], [3, 1]),
    };
    agreesAt(worked, frac([9, 1], [-9, 0, 1]), [0, 1, 2, 4]);
    expect(formatExactRussian(evaluateCombination(worked, 0).value!)).toBe('−1');
    expect(restrictionList(combinationRestrictions(worked))).toEqual(['−3', '3']);

    // Практика 1: 3x/(x + 2) + 6/(x + 2) = 3 при x ≠ −2.
    const first: FractionCombination = {
      operation: 'sum',
      left: frac([0, 3], [2, 1]),
      right: frac([6], [2, 1]),
    };
    agreesAt(first, frac([3], [1]), [0, 1, -5]);
    expect(restrictionList(combinationRestrictions(first))).toEqual(['−2']);
    // Практика 6: 1/(x − 3) + 1/(x + 3) = 2x/(x² − 9) при x ≠ ±3.
    const sixth: FractionCombination = {
      operation: 'sum',
      left: frac([1], [-3, 1]),
      right: frac([1], [3, 1]),
    };
    agreesAt(sixth, frac([0, 2], [-9, 0, 1]), [0, 1, 2, 5]);
    expect(restrictionList(combinationRestrictions(sixth))).toEqual(['−3', '3']);
    // Практика 7: 5/(2x) − 3/x² = (5x − 6)/(2x²) при x ≠ 0.
    const seventh: FractionCombination = {
      operation: 'difference',
      left: frac([5], [0, 2]),
      right: frac([3], [0, 0, 1]),
    };
    agreesAt(seventh, frac([-6, 5], [0, 0, 2]), [1, 2, -1]);
    expect(restrictionList(combinationRestrictions(seventh))).toEqual(['0']);
    // Практика 9: 1/(x − 2) − 1/(2 − x) = 2/(x − 2) при x ≠ 2.
    const ninth: FractionCombination = {
      operation: 'difference',
      left: frac([1], [-2, 1]),
      right: frac([1], [2, -1]),
    };
    agreesAt(ninth, frac([2], [-2, 1]), [0, 1, 3]);
    expect(restrictionList(combinationRestrictions(ninth))).toEqual(['2']);
    // Практика 10: x/(x² − 4) + 1/(x + 2) = (2x − 2)/(x² − 4) при x ≠ ±2.
    const tenth: FractionCombination = {
      operation: 'sum',
      left: frac([0, 1], [-4, 0, 1]),
      right: frac([1], [2, 1]),
    };
    agreesAt(tenth, frac([-2, 2], [-4, 0, 1]), [0, 1, 3, -3]);
    expect(restrictionList(combinationRestrictions(tenth))).toEqual(['−2', '2']);
  });

  it('урок 2.4: умножение и деление — три источника запретов', () => {
    // Вступление: x/(x + 2) · (x² − 4)/x² = (x − 2)/x при x ≠ 0 и x ≠ −2.
    const intro: FractionCombination = {
      operation: 'product',
      left: frac([0, 1], [2, 1]),
      right: frac([-4, 0, 1], [0, 0, 1]),
    };
    agreesAt(intro, frac([-2, 1], [0, 1]), [1, 3, -1]);
    expect(restrictionList(combinationRestrictions(intro))).toEqual(['−2', '0']);

    // Разбор: (x² − 4)/(3x) · 6x/(x + 2) = 2x − 4 при x ≠ 0 и x ≠ −2; при x = 1 равно −2.
    const worked: FractionCombination = {
      operation: 'product',
      left: frac([-4, 0, 1], [0, 3]),
      right: frac([0, 6], [2, 1]),
    };
    agreesAt(worked, frac([-4, 2], [1]), [1, 3, -1]);
    expect(formatExactRussian(evaluateCombination(worked, 1).value!)).toBe('−2');
    expect(restrictionList(combinationRestrictions(worked))).toEqual(['−2', '0']);

    // Практика 3: (x² − 9)/(2x) · 4x/(x + 3) = 2x − 6 при x ≠ 0 и x ≠ −3.
    const third: FractionCombination = {
      operation: 'product',
      left: frac([-9, 0, 1], [0, 2]),
      right: frac([0, 4], [3, 1]),
    };
    agreesAt(third, frac([-6, 2], [1]), [1, 2, -1]);
    expect(restrictionList(combinationRestrictions(third))).toEqual(['−3', '0']);

    // Практика 6: x/(x − 1) : x²/(x² − 1) = (x + 1)/x при x ≠ 0, x ≠ 1, x ≠ −1.
    const sixth: FractionCombination = {
      operation: 'quotient',
      left: frac([0, 1], [-1, 1]),
      right: frac([0, 0, 1], [-1, 0, 1]),
    };
    agreesAt(sixth, frac([1, 1], [0, 1]), [2, 3, -2]);
    expect(restrictionList(combinationRestrictions(sixth))).toEqual(['−1', '0', '1']);

    // Практика 7: (x² − 4)/(x + 5) : (x − 2)/(x + 5) = x + 2 при x ≠ −5 и x ≠ 2.
    const seventh: FractionCombination = {
      operation: 'quotient',
      left: frac([-4, 0, 1], [5, 1]),
      right: frac([-2, 1], [5, 1]),
    };
    agreesAt(seventh, frac([2, 1], [1]), [0, 1, 3]);
    expect(restrictionList(combinationRestrictions(seventh))).toEqual(['−5', '2']);

    // Практика 10: x/(x − 4) : (x + 1)/x имеет смысл при x ≠ 4, x ≠ 0, x ≠ −1.
    const tenth: FractionCombination = {
      operation: 'quotient',
      left: frac([0, 1], [-4, 1]),
      right: frac([1, 1], [0, 1]),
    };
    expect(restrictionList(combinationRestrictions(tenth))).toEqual(['−1', '0', '4']);
  });

  it('урок 2.5: корни рациональных уравнений и посторонние значения', () => {
    // Разбор: (x² − 4)/(x − 2) = 0 — корень только −2.
    const worked = solveFractionEqualsZero([-4, 0, 1], [-2, 1]);
    expect(restrictionList(worked.roots)).toEqual(['−2']);
    expect(restrictionList(worked.excluded)).toEqual(['2']);

    // Практика 1–5, 10.
    expect(restrictionList(solveFractionEqualsZero([-5, 1], [2, 1]).roots)).toEqual(['5']);
    expect(restrictionList(solveFractionEqualsZero([12, 3], [0, 1]).roots)).toEqual(['−4']);
    const third = solveFractionEqualsZero([-9, 0, 1], [-3, 1]);
    expect(restrictionList(third.roots)).toEqual(['−3']);
    expect(restrictionList(third.excluded)).toEqual(['3']);
    expect(restrictionList(solveFractionEqualsZero([7, 1], [1, 0, 1]).roots)).toEqual(['−7']);
    const fifth = solveFractionEqualsZero([-1, 1], [-1, 0, 1]);
    expect(fifth.roots).toEqual([]);
    expect(restrictionList(fifth.excluded)).toEqual(['1']);
    // Задача 10: x² − 5x + 6 = (x − 2)(x − 3), корень только 2.
    const tenth = solveFractionEqualsZero([6, -5, 1], [-3, 1]);
    expect(restrictionList(tenth.roots)).toEqual(['2']);
    expect(restrictionList(tenth.excluded)).toEqual(['3']);

    // Задача 7: 2/(x − 1) = 3/(x + 4) сводится к x = 11 и обе части равны 0,2.
    expect(formatExactRussian(evaluateFraction([2], [-1, 1], 11).value!)).toBe('0,2');
    expect(formatExactRussian(evaluateFraction([3], [4, 1], 11).value!)).toBe('0,2');
    // Задача 8: (x + 1)/(x − 3) = 2 при x = 7.
    expect(formatExactRussian(evaluateFraction([1, 1], [-3, 1], 7).value!)).toBe('2');
    // Задача 9: 1/x + 1/2 = 3/4 при x = 4.
    expect(1 / 4 + 1 / 2).toBeCloseTo(0.75, 12);
  });

  it('урок 2.6 (практикум): паспорт алгебраической дроби', () => {
    // Задача 1.
    expect(restrictionList(restrictedValues([-9, 0, 1]))).toEqual(['−3', '3']);
    // Задача 2: (x² − 36)/(x + 6) = x − 6 при x ≠ −6.
    agreesAt({ operation: 'single', left: frac([-36, 0, 1], [6, 1]) }, frac([-6, 1], [1]), [0, 1, 6]);
    expect(restrictionList(restrictedValues([6, 1]))).toEqual(['−6']);
    // Задача 3: (4a + 8)/(a² − 4) = 4/(a − 2) при a ≠ ±2.
    agreesAt({ operation: 'single', left: frac([8, 4], [-4, 0, 1]) }, frac([4], [-2, 1]), [0, 1, 3]);
    expect(restrictionList(restrictedValues([-4, 0, 1]))).toEqual(['−2', '2']);
    // Задача 4: 3/x + 2/(x + 1) = (5x + 3)/(x² + x) при x ≠ 0, x ≠ −1; при x = 1 значение 4.
    const fourth: FractionCombination = {
      operation: 'sum',
      left: frac([3], [0, 1]),
      right: frac([2], [1, 1]),
    };
    agreesAt(fourth, frac([3, 5], [0, 1, 1]), [1, 2, -2]);
    expect(formatExactRussian(evaluateCombination(fourth, 1).value!)).toBe('4');
    expect(restrictionList(combinationRestrictions(fourth))).toEqual(['−1', '0']);
    // Задача 6: (x² − 1)/(3x) · 9x/(x − 1) = 3x + 3 при x ≠ 0 и x ≠ 1.
    const sixth: FractionCombination = {
      operation: 'product',
      left: frac([-1, 0, 1], [0, 3]),
      right: frac([0, 9], [-1, 1]),
    };
    agreesAt(sixth, frac([3, 3], [1]), [2, 3, -1]);
    expect(restrictionList(combinationRestrictions(sixth))).toEqual(['0', '1']);
    // Задача 9: (x² − 16)/(x − 4) = 0 — корень только −4.
    const ninth = solveFractionEqualsZero([-16, 0, 1], [-4, 1]);
    expect(restrictionList(ninth.roots)).toEqual(['−4']);
    expect(restrictionList(ninth.excluded)).toEqual(['4']);
    // Задача 10: 5/(x + 1) = 2/(x − 2) при x = 4, обе части равны 1.
    expect(formatExactRussian(evaluateFraction([5], [1, 1], 4).value!)).toBe('1');
    expect(formatExactRussian(evaluateFraction([2], [-2, 1], 4).value!)).toBe('1');
    // Задача 11: (x² − 2x)/(x² − 4) = x/(x + 2), при x = 4 равно 2/3.
    agreesAt({ operation: 'single', left: frac([0, -2, 1], [-4, 0, 1]) }, frac([0, 1], [2, 1]), [0, 1, 4]);
    expect(formatExactRussian(evaluateFraction([0, -2, 1], [-4, 0, 1], 4).value!)).toBe('2/3');
    // Задача 12: (x + 2)/(x + 6) = 1/3 только при x = 0.
    expect(formatExactRussian(evaluateFraction([2, 1], [6, 1], 0).value!)).toBe('1/3');
    expect(formatExactRussian(evaluateFraction([2, 1], [6, 1], 1).value!)).not.toBe('1/3');
  });
});

/* ═══════════════════════════ 3. Квадратные уравнения ═══════════════════════════ */

describe('8 класс, глава 3 «Квадратные уравнения»', () => {
  /** Корни в виде читаемых строк. */
  const rootsOf = (a: number, b: number, c: number): string[] =>
    solveQuadratic(a, b, c).roots.map((root) => (root.exact ? formatRational(root.exact) : `≈${root.approx.toFixed(2)}`));

  it('урок 3.1: неполные уравнения', () => {
    // Мяч: −5t² + 20t = 0 даёт t = 0 и t = 4.
    expect(rootsOf(-5, 20, 0)).toEqual(['0', '4']);
    expect(20 * 4 - 5 * 16).toBe(0);
    // Практика 1–8, 11.
    expect(rootsOf(1, 0, -49)).toEqual(['−7', '7']);
    expect(rootsOf(4, 0, -36)).toEqual(['−3', '3']);
    expect(solveQuadratic(1, 0, 9).rootCount).toBe(0);
    expect(rootsOf(3, 0, 0)).toEqual(['0']);
    expect(rootsOf(1, -7, 0)).toEqual(['0', '7']);
    expect(rootsOf(5, 15, 0)).toEqual(['−3', '0']);
    expect(rootsOf(2, -8, 0)).toEqual(['0', '4']);
    expect(rootsOf(9, 0, -4)).toEqual(['−2/3', '2/3']);
    expect(rootsOf(-1, 0, 16)).toEqual(['−4', '4']);
    // Задача 9: (x + 2)² = 9 ⇔ x² + 4x − 5 = 0.
    expect(rootsOf(1, 4, -5)).toEqual(['−5', '1']);
    // Задача 10: (x − 5)² = 0.
    expect(rootsOf(1, -10, 25)).toEqual(['5']);
    // Мостик: (x − 3)² = 16 ⇔ x² − 6x − 7 = 0.
    expect(rootsOf(1, -6, -7)).toEqual(['−1', '7']);
    // Задача 12: x² = 0,25, сторона 0,5 м.
    expect(0.5 ** 2).toBeCloseTo(0.25, 12);
    expect(rootsOf(2, 0, -50)).toEqual(['−5', '5']);
  });

  it('урок 3.2: дискриминант и формула корней', () => {
    // Разбор: 2x² − 7x + 3 = 0, D = 25.
    expect(discriminant(2, -7, 3)).toBe(25);
    expect(rootsOf(2, -7, 3)).toEqual(['0,5', '3']);
    // 9x² − 12x + 4 = 0, D = 0, корень 2/3.
    expect(discriminant(9, -12, 4)).toBe(0);
    expect(rootsOf(9, -12, 4)).toEqual(['2/3']);
    // x² + x + 3 = 0, D = −11.
    expect(discriminant(1, 1, 3)).toBe(-11);
    expect(solveQuadratic(1, 1, 3).rootCount).toBe(0);
    // x² − 6x + 7 = 0, D = 8, корни 3 ± √2 ≈ 4,41 и 1,59.
    expect(discriminant(1, -6, 7)).toBe(8);
    expect(rootsOf(1, -6, 7)).toEqual(['≈1.59', '≈4.41']);
    // Практика 1–10.
    expect([discriminant(1, -5, 6), ...rootsOf(1, -5, 6)]).toEqual([1, '2', '3']);
    expect([discriminant(1, 4, 4), ...rootsOf(1, 4, 4)]).toEqual([0, '−2']);
    expect(discriminant(1, 2, 5)).toBe(-16);
    expect([discriminant(2, -5, 2), ...rootsOf(2, -5, 2)]).toEqual([9, '0,5', '2']);
    expect([discriminant(3, -10, 8), ...rootsOf(3, -10, 8)]).toEqual([4, '4/3', '2']);
    expect([discriminant(1, -3, 2), ...rootsOf(1, -3, 2)]).toEqual([1, '1', '2']);
    expect([discriminant(4, -4, 1), ...rootsOf(4, -4, 1)]).toEqual([0, '0,5']);
    expect([discriminant(1, -2, -1), ...rootsOf(1, -2, -1)]).toEqual([8, '≈-0.41', '≈2.41']);
    expect(discriminant(5, 2, 3)).toBe(-56);
    expect([discriminant(1, -8, 15), ...rootsOf(1, -8, 15)]).toEqual([4, '3', '5']);
    // Задача 11: x² − 6x + c = 0 имеет один корень при c = 9.
    expect(discriminant(1, -6, 9)).toBe(0);
    // Задача 12: x² + bx + 9 = 0 — при b = ±6.
    expect(discriminant(1, 6, 9)).toBe(0);
    expect(discriminant(1, -6, 9)).toBe(0);
    // QuickCheck: 3x² − 4x + 2 = 0, D = −8.
    expect(discriminant(3, -4, 2)).toBe(-8);
  });

  it('урок 3.3: теорема Виета', () => {
    // Вступление: x² − 13x + 40 = 0, корни 8 и 5.
    expect(rootsOf(1, -13, 40)).toEqual(['5', '8']);
    expect(formatRational(vietaSum(1, -13, 40))).toBe('13');
    expect(formatRational(vietaProduct(1, -13, 40))).toBe('40');
    // Практика 1–6.
    expect(rootsOf(1, -7, 12)).toEqual(['3', '4']);
    expect(rootsOf(1, 1, -6)).toEqual(['−3', '2']);
    expect(rootsOf(1, -2, -15)).toEqual(['−3', '5']);
    expect(rootsOf(1, 8, 15)).toEqual(['−5', '−3']);
    expect(rootsOf(1, -11, 30)).toEqual(['5', '6']);
    expect(rootsOf(1, 4, -21)).toEqual(['−7', '3']);
    // Задача 7: 2x² − 9x + 4 = 0 — сумма 4,5, произведение 2, корни 4 и 0,5.
    expect(formatRational(vietaSum(2, -9, 4))).toBe('4,5');
    expect(formatRational(vietaProduct(2, -9, 4))).toBe('2');
    expect(rootsOf(2, -9, 4)).toEqual(['0,5', '4']);
    // Задача 8: уравнение с корнями 2 и −9.
    expect(monicFromRoots(2, -9)).toEqual({ p: 7, q: -18 });
    expect(rootsOf(1, 7, -18)).toEqual(['−9', '2']);
    // Задача 9: x² + px − 24 = 0 с корнем 3 — второй корень −8, p = 5.
    expect(monicFromRoots(3, -8)).toEqual({ p: 5, q: -24 });
    expect(rootsOf(1, 5, -24)).toEqual(['−8', '3']);
    // Задача 10: x² − x − 12 = (x − 4)(x + 3).
    expect(rootsOf(1, -1, -12)).toEqual(['−3', '4']);
    expect(monicFromRoots(4, -3)).toEqual({ p: -1, q: -12 });
    // Задачи 11–12.
    expect(discriminant(1, -4, 5)).toBe(-4);
    expect(discriminant(1, -4, 2)).toBe(8);
    expect(formatRational(vietaSum(1, -4, 2))).toBe('4');
    expect(formatRational(vietaProduct(1, -4, 2))).toBe('2');
    // Разложение 2x² − 5x + 2 = (x − 2)(2x − 1).
    expect(rootsOf(2, -5, 2)).toEqual(['0,5', '2']);
    // Разборы: x² + 5x − 14 и 3x² − 8x + 4.
    expect(rootsOf(1, 5, -14)).toEqual(['−7', '2']);
    expect(rootsOf(3, -8, 4)).toEqual(['2/3', '2']);
    expect(formatRational(vietaSum(3, -8, 4))).toBe('8/3');
    expect(formatRational(vietaProduct(3, -8, 4))).toBe('4/3');
  });

  it('урок 3.4: текстовые задачи с квадратной моделью', () => {
    // Газон: полупериметр 13, площадь 40 — стороны 8 и 5.
    expect(rootsOf(1, -13, 40)).toEqual(['5', '8']);
    expect(2 * (8 + 5)).toBe(26);
    expect(8 * 5).toBe(40);
    // Прямоугольник: длина на 5 больше ширины, площадь 84.
    expect(discriminant(1, 5, -84)).toBe(361);
    expect(rootsOf(1, 5, -84)).toEqual(['−12', '7']);
    expect(7 * 12).toBe(84);
    // Мяч на высоте 15 м: t² − 4t + 3 = 0.
    expect(rootsOf(1, -4, 3)).toEqual(['1', '3']);
    expect(20 * 1 - 5 * 1 ** 2).toBe(15);
    expect(20 * 3 - 5 * 3 ** 2).toBe(15);
    // Эксперимент: полупериметр 7, площадь 12 — корни 3 и 4; при 13 корней нет.
    expect(rootsOf(1, -7, 12)).toEqual(['3', '4']);
    expect(discriminant(1, -7, 13)).toBeLessThan(0);
    expect(3.5 ** 2).toBeCloseTo(12.25, 12);
    // Практика 1–12.
    expect([discriminant(1, -17, 60), ...rootsOf(1, -17, 60)]).toEqual([49, '5', '12']);
    expect([discriminant(1, 3, -54), ...rootsOf(1, 3, -54)]).toEqual([225, '−9', '6']);
    expect([discriminant(1, 1, -210), ...rootsOf(1, 1, -210)]).toEqual([841, '−15', '14']);
    expect(14 * 15).toBe(210);
    expect([discriminant(1, 1, -156), ...rootsOf(1, 1, -156)]).toEqual([625, '−13', '12']);
    expect(12 ** 2 + 13 ** 2).toBe(313);
    expect(rootsOf(1, -5, 6)).toEqual(['2', '3']);
    expect(25 * 2 - 5 * 4).toBe(30);
    expect(25 * 3 - 5 * 9).toBe(30);
    expect(rootsOf(-5, 25, 0)).toEqual(['0', '5']);
    expect([discriminant(1, -1, -12), ...rootsOf(1, -1, -12)]).toEqual([49, '−3', '4']);
    expect([discriminant(1, 7, -60), ...rootsOf(1, 7, -60)]).toEqual([289, '−12', '5']);
    expect(7 * 10).toBe(70);
    // Задача 9: рамка вокруг фотографии 12 × 16, площадь рамки 165.
    expect(discriminant(4, 56, -165)).toBe(5776);
    expect(integerSquareRoot(5776)).toBe(76);
    expect(rootsOf(4, 56, -165)).toEqual(['−16,5', '2,5']);
    expect((12 + 5) * (16 + 5) - 12 * 16).toBe(165);
    expect([discriminant(1, 1, -42), ...rootsOf(1, 1, -42)]).toEqual([169, '−7', '6']);
    expect(discriminant(1, -10, 30)).toBe(-20);
    // Задача 12: наибольшая площадь при периметре 20 см равна 25 см².
    expect(discriminant(1, -10, 25)).toBe(0);
    expect(discriminant(1, -10, 26)).toBeLessThan(0);
  });

  it('урок 3.5 (практикум): выбор способа решения', () => {
    // Станция 1.
    expect(rootsOf(3, 0, -27)).toEqual(['−3', '3']);
    expect(rootsOf(1, 5, 0)).toEqual(['−5', '0']);
    expect(solveQuadratic(1, 0, 4).rootCount).toBe(0);
    expect(rootsOf(7, 0, 0)).toEqual(['0']);
    // Станция 4: турнир, n² − n − 90 = 0.
    expect(discriminant(1, -1, -90)).toBe(361);
    expect(rootsOf(1, -1, -90)).toEqual(['−9', '10']);
    expect((10 * 9) / 2).toBe(45);
    // Итоговый набор 1–14.
    expect(rootsOf(1, 0, -36)).toEqual(['−6', '6']);
    expect(rootsOf(1, 7, 0)).toEqual(['−7', '0']);
    expect(rootsOf(1, -8, -9)).toEqual(['−1', '9']); // (x − 4)² = 25
    expect(rootsOf(1, -9, 20)).toEqual(['4', '5']);
    expect(rootsOf(1, 6, 8)).toEqual(['−4', '−2']);
    expect([discriminant(2, -7, 6), ...rootsOf(2, -7, 6)]).toEqual([1, '1,5', '2']);
    expect([discriminant(1, -4, -1), ...rootsOf(1, -4, -1)]).toEqual([20, '≈-0.24', '≈4.24']);
    expect(discriminant(3, 1, 5)).toBe(-59);
    expect([discriminant(4, -12, 9), ...rootsOf(4, -12, 9)]).toEqual([0, '1,5']);
    expect(rootsOf(1, 2, -15)).toEqual(['−5', '3']);
    expect(discriminant(1, -10, 25)).toBe(0);
    expect(monicFromRoots(2, 3)).toEqual({ p: -5, q: 6 });
    expect([discriminant(1, -11, 24), ...rootsOf(1, -11, 24)]).toEqual([25, '3', '8']);
    expect([discriminant(1, 2, -168), ...rootsOf(1, 2, -168)]).toEqual([676, '−14', '12']);
    expect(12 * 14).toBe(168);
    // Рефлексия: при площади 35 см² дискриминант отрицателен.
    expect(discriminant(1, -11, 35)).toBe(-19);
    // QuickCheck: x² + 9x = 0, D = 81, корни 0 и −9.
    expect(discriminant(1, 9, 0)).toBe(81);
    expect(rootsOf(1, 9, 0)).toEqual(['−9', '0']);
  });
});

/* ═══════════════════════════ 4. Функции и неравенства ═══════════════════════════ */

describe('8 класс, глава 4 «Функции и неравенства»', () => {
  /** Решение неравенства a·x + b ⋛ c·x + d в виде текста промежутка. */
  const solveText = (
    leftSlope: number,
    leftConst: number,
    relation: 'lt' | 'le' | 'gt' | 'ge',
    rightSlope: number,
    rightConst: number,
  ): string =>
    formatSetText(
      solveLinearInequality(
        linearInequality(linearExpression(leftSlope, leftConst), relation, linearExpression(rightSlope, rightConst)),
      ),
    );

  it('урок 4.1: галерея графиков', () => {
    expect(curveValue('inverse', 12, -4)).toBe(-3);
    expect(curveValue('inverse', 12, 3)).toBe(4);
    expect(curveValue('square', 1, -7)).toBe(49);
    expect(curveValue('sqrt', 1, 25)).toBe(5);
    expect(curveValue('sqrt', 1, 2.25)).toBe(1.5);
    expect(curveValue('abs', 1, -3.5)).toBe(3.5);
    expect(curveValue('sqrt', 1, -1)).toBeNull();
    expect(curveValue('inverse', 5, 0)).toBeNull();
    // Разбор: гипербола y = 6/x проходит через (1;6), (2;3), (3;2), (6;1).
    for (const [x, y] of [[1, 6], [2, 3], [3, 2], [6, 1], [-1, -6], [-6, -1]] as const) {
      expect(curveValue('inverse', 6, x)).toBe(y);
      expect(x * y).toBe(6);
    }
    // Разбор: x² и |x| совпадают только при x = 0 и x = 1.
    expect(curveValue('square', 1, 0.5)).toBe(0.25);
    expect(curveValue('abs', 1, 0.5)).toBe(0.5);
    expect(curveValue('square', 1, 2)).toBe(4);
    expect(curveValue('abs', 1, 2)).toBe(2);
    expect(curveValue('square', 1, 3)).toBe(9);
    // Задача 9: график y = k/x проходит через (2; −6), значит k = −12.
    expect(curveValue('inverse', -12, 2)).toBe(-6);
  });

  it('урок 4.2: числовые промежутки и пересечения', () => {
    expect(formatIntervalText(halfOpenInterval(-2, 5, true))).toBe('[−2; 5)');
    expect(formatIntervalText(lessThanSet(7, true))).toBe('(−∞; 7]');
    expect(formatIntervalText(greaterThanSet(0, true))).toBe('[0; +∞)');
    // Разбор: [−2; 5) ∩ (1; 8] = (1; 5).
    expect(formatSetText(intersectAll([halfOpenInterval(-2, 5, true), halfOpenInterval(1, 8, false)]))).toBe('(1; 5)');
    // Практика 7–10.
    expect(formatSetText(intersectAll([closedInterval(-4, 2), closedInterval(0, 7)]))).toBe('[0; 2]');
    expect(formatSetText(intersectAll([lessThanSet(5, false), greaterThanSet(5, false)]))).toBe('∅');
    expect(formatSetText(intersectAll([closedInterval(1, 6), halfOpenInterval(6, 9, false)]))).toBe('∅');
    expect(formatSetText(intersectAll([lessThanSet(3, true), greaterThanSet(3, true)]))).toBe('[3; 3]');
    // Задача 12: длина отрезка [−4; 2,5] равна 6,5.
    expect(2.5 - -4).toBeCloseTo(6.5, 12);
    // Задача 6: целые числа промежутка (−2; 3).
    const integersInside = [-2, -1, 0, 1, 2, 3].filter((value) => value > -2 && value < 3);
    expect(integersInside).toEqual([-1, 0, 1, 2]);
  });

  it('урок 4.3: свойства неравенств и оценка величин', () => {
    // Разбор: 2 ⩽ a ⩽ 3, 5 ⩽ b ⩽ 7.
    const a = closedInterval(2, 3);
    const b = closedInterval(5, 7);
    expect(formatIntervalText(estimateSum(a, b))).toBe('[7; 10]');
    expect(formatIntervalText(estimateDifference(a, b))).toBe('[−5; −2]');
    expect(formatIntervalText(estimateProduct(a, b))).toBe('[10; 21]');
    expect(formatIntervalText(estimateQuotient(a, b))).toBe('[2/7; 0,6]');
    // Разбор: стороны 3,5–3,6 и 2,1–2,2.
    const side = closedInterval('3.5', '3.6');
    const other = closedInterval('2.1', '2.2');
    expect(formatIntervalText(estimateSum(side, other))).toBe('[5,6; 5,8]');
    expect(formatIntervalText(estimateScaled(estimateSum(side, other), 2))).toBe('[11,2; 11,6]');
    expect(formatIntervalText(estimateProduct(side, other))).toBe('[7,35; 7,92]');
    expect(7.92 - 7.35).toBeCloseTo(0.57, 12);
    // Практика 3–5: оценки для 3 < x < 8.
    const x = openInterval(3, 8);
    expect(formatIntervalText(estimateScaled(x, 2))).toBe('(6; 16)');
    expect(formatIntervalText(estimateScaled(x, -1))).toBe('(−8; −3)');
    expect(formatIntervalText(estimateSum(x, closedInterval(-5, -5)))).toBe('(−2; 3)');
    // Практика 6–9: 1 ⩽ a ⩽ 4, 2 ⩽ b ⩽ 5.
    const p = closedInterval(1, 4);
    const q = closedInterval(2, 5);
    expect(formatIntervalText(estimateSum(p, q))).toBe('[3; 9]');
    expect(formatIntervalText(estimateDifference(p, q))).toBe('[−4; 2]');
    expect(formatIntervalText(estimateProduct(p, q))).toBe('[2; 20]');
    expect(formatIntervalText(estimateQuotient(p, q))).toBe('[0,2; 2]');
    // Практика 10: стороны 4,2–4,3 и 2,5–2,6.
    const first = closedInterval('4.2', '4.3');
    const second = closedInterval('2.5', '2.6');
    expect(formatIntervalText(estimateScaled(estimateSum(first, second), 2))).toBe('[13,4; 13,8]');
    expect(formatIntervalText(estimateProduct(first, second))).toBe('[10,5; 11,18]');
    // Практика 11: контрпример a = −3, b = 1.
    expect((-3) ** 2).toBeGreaterThan(1 ** 2);
  });

  it('урок 4.4: линейные неравенства', () => {
    expect(solveText(3, -5, 'lt', 0, 7)).toBe('(−∞; 4)');
    expect(solveText(0, 5, 'ge', 2, 11)).toBe('(−∞; −3]');
    expect(solveText(4, 1, 'gt', 4, -3)).toBe('(−∞; +∞)');
    expect(solveText(2, 3, 'le', 2, 1)).toBe('∅');
    // Практика 1–11.
    expect(solveText(2, 0, 'lt', 0, 10)).toBe('(−∞; 5)');
    expect(solveText(1, 4, 'ge', 0, 1)).toBe('[−3; +∞)');
    expect(solveText(-4, 0, 'gt', 0, 20)).toBe('(−∞; −5)');
    expect(solveText(6, 1, 'le', 4, 9)).toBe('(−∞; 4]');
    expect(solveText(3, -6, 'gt', 1, 4)).toBe('(5; +∞)');
    expect(solveText(0.5, -0.5, 'le', 0, 3)).toBe('(−∞; 7]');
    expect(solveText(7, 2, 'gt', 7, -5)).toBe('(−∞; +∞)');
    expect(solveText(5, 3, 'lt', 5, -2)).toBe('∅');
    expect(solveText(3, 4, 'gt', 0, 1)).toBe('(−1; +∞)');
    // Задача 12: 300 + 40x ⩽ 1000 — не больше 17 занятий.
    expect(solveText(40, 300, 'le', 0, 1000)).toBe('(−∞; 17,5]');
    expect(300 + 40 * 17).toBe(980);
    expect(300 + 40 * 18).toBe(1020);
    // QuickCheck: −3x > 12 ⇔ x < −4.
    expect(solveText(-3, 0, 'gt', 0, 12)).toBe('(−∞; −4)');
  });

  it('урок 4.5: системы неравенств', () => {
    const system = (...items: Parameters<typeof linearInequality>[]): string =>
      formatSetText(solveInequalitySystem(items.map((item) => linearInequality(...item))));

    expect(
      system(
        [linearExpression(2, -1), 'gt', linearExpression(0, 5)],
        [linearExpression(3, 0), 'le', linearExpression(0, 21)],
      ),
    ).toBe('(3; 7]');
    expect(
      system(
        [linearExpression(0, 5), 'lt', linearExpression(1, 1)],
        [linearExpression(2, 0), 'le', linearExpression(0, 6)],
      ),
    ).toBe('∅');
    // Двойное неравенство −3 ⩽ 2x + 1 < 7.
    expect(
      system(
        [linearExpression(2, 1), 'ge', linearExpression(0, -3)],
        [linearExpression(2, 1), 'lt', linearExpression(0, 7)],
      ),
    ).toBe('[−2; 3)');
    // Практика 1–4.
    expect(
      system(
        [linearExpression(1, 0), 'gt', linearExpression(0, 2)],
        [linearExpression(1, 0), 'lt', linearExpression(0, 9)],
      ),
    ).toBe('(2; 9)');
    expect(
      system(
        [linearExpression(1, 0), 'ge', linearExpression(0, -3)],
        [linearExpression(1, 0), 'le', linearExpression(0, 0)],
      ),
    ).toBe('[−3; 0]');
    expect(
      system(
        [linearExpression(1, 0), 'gt', linearExpression(0, 5)],
        [linearExpression(1, 0), 'le', linearExpression(0, 5)],
      ),
    ).toBe('∅');
    expect(
      system(
        [linearExpression(1, 0), 'ge', linearExpression(0, 4)],
        [linearExpression(1, 0), 'le', linearExpression(0, 4)],
      ),
    ).toBe('[4; 4]');
    // Практика 6–7.
    expect(
      system(
        [linearExpression(1, 3), 'le', linearExpression(0, 8)],
        [linearExpression(-1, 4), 'lt', linearExpression(0, 6)],
      ),
    ).toBe('(−2; 5]');
    expect(
      system(
        [linearExpression(3, 0), 'gt', linearExpression(0, -6)],
        [linearExpression(2, 1), 'le', linearExpression(0, 9)],
      ),
    ).toBe('(−2; 4]');
    // Практика 10: 1 < 4 − x ⩽ 5 ⇔ [−1; 3).
    expect(
      system(
        [linearExpression(-1, 4), 'gt', linearExpression(0, 1)],
        [linearExpression(-1, 4), 'le', linearExpression(0, 5)],
      ),
    ).toBe('[−1; 3)');
    // Практика 11: целые решения x > −2,5 и x ⩽ 3 — их шесть.
    const integers = [-3, -2, -1, 0, 1, 2, 3, 4].filter((value) => value > -2.5 && value <= 3);
    expect(integers).toEqual([-2, -1, 0, 1, 2, 3]);
    // Практика 12: целые длины от 15 до 60 включительно.
    expect(60 - 15 + 1).toBe(46);
  });

  it('урок 4.6 (практикум): технические условия', () => {
    // Задача 1: t = 60/x.
    expect(curveValue('inverse', 60, 24)).toBe(2.5);
    expect(curveValue('inverse', 60, 40)).toBe(1.5);
    expect(40 / 24).toBeCloseTo(2.5 / 1.5, 12);
    // Задача 2: точки (1;3), (2;12), (−2;12) лежат на y = 3x².
    expect(curveValue('square', 3, 1)).toBe(3);
    expect(curveValue('square', 3, 2)).toBe(12);
    expect(curveValue('square', 3, -2)).toBe(12);
    // Задача 4: отрезок [18; 25]. Задача 5: [18; 25] ∩ (20; 30) = (20; 25].
    expect(formatIntervalText(closedInterval(18, 25))).toBe('[18; 25]');
    expect(formatSetText(intersectAll([closedInterval(18, 25), openInterval(20, 30)]))).toBe('(20; 25]');
    // Задача 3: область определения y = √x.
    expect(formatIntervalText(greaterThanSet(0, true))).toBe('[0; +∞)');
    // Задача 6: оценка периметра и площади грядки.
    const a = closedInterval('4.8', '5.0');
    const b = closedInterval('2.0', '2.1');
    expect(formatIntervalText(estimateScaled(estimateSum(a, b), 2))).toBe('[13,6; 14,2]');
    expect(formatIntervalText(estimateProduct(a, b))).toBe('[9,6; 10,5]');
    // Задачи 7–9.
    expect(solveText(-3, 7, 'le', 0, 1)).toBe('[2; +∞)');
    expect(solveText(2, 6, 'gt', 5, -3)).toBe('(−∞; 3)');
    expect(
      formatSetText(
        solveInequalitySystem([
          linearInequality(linearExpression(4, -3), 'ge', linearExpression(0, 5)),
          linearInequality(linearExpression(-1, 2), 'gt', linearExpression(0, -4)),
        ]),
      ),
    ).toBe('[2; 6)');
    // Задача 10: четыре целых решения.
    expect([1, 2, 3, 4, 5, 6].filter((value) => value >= 2 && value < 6)).toEqual([2, 3, 4, 5]);
    // Задача 11: 250 + 90x ⩽ 1000 — восемь целых часов.
    expect(solveText(90, 250, 'le', 0, 1000)).toBe('(−∞; 25/3]');
    expect(250 + 90 * 8).toBe(970);
    expect(250 + 90 * 9).toBe(1060);
    // Задача 12: подстановки 0 и 3 в 2(x + 3) > 5x − 3.
    expect(2 * (0 + 3) > 5 * 0 - 3).toBe(true);
    expect(2 * (3 + 3) > 5 * 3 - 3).toBe(false);
  });
});

/* ═══════════════════════════ 5. Подобие и окружность ═══════════════════════════ */

describe('8 класс, глава 5 «Подобие и окружность»', () => {
  it('урок 5.1: подобие треугольников', () => {
    // Практика 1: коэффициент 3.
    expect(similarityFactor({ a: 4, b: 5, c: 6 }, { a: 12, b: 15, c: 18 })).toBe(3);
    // Практика 2: треугольники 6-9-12 и 8-12-16 подобны с k = 4/3.
    expect(similarityFactor({ a: 6, b: 9, c: 12 }, { a: 8, b: 12, c: 16 })).toBeCloseTo(4 / 3, 12);
    // Практика 3: AM = 4, MB = 6, AN = 6 ⇒ NC = 9.
    expect(thalesSegment(4, 6, 6)).toBe(9);
    // Практика 4: AM : AB = 3 : 12, MN = 5.
    expect(thalesRatio(3, 9)).toBe(0.25);
    expect(20 * thalesRatio(3, 9)).toBe(5);
    // Практика 5: периметр растёт в k раз.
    expect(24 * 1.5).toBe(36);
    // Практика 6: площади 18 и 50 ⇒ k = 5/3.
    expect(areaFactor(5 / 3) * 18).toBeCloseTo(50, 10);
    // Практика 7: площадь растёт в 16 раз.
    expect(areaFactor(4)).toBe(16);
    expect(areaFactor(3)).toBe(9);
    // Практика 8 и разбор: дерево 12 м.
    expect((1.8 / 1.2) * 8).toBeCloseTo(12, 12);
    expect(1.8 * (8 / 1.2)).toBeCloseTo(12, 12);
    // Практика 9: третьи углы 65° и 40°.
    expect(180 - 40 - 75).toBe(65);
    expect(180 - 75 - 65).toBe(40);
    // Разбор: CH² = 9 · 16 ⇒ CH = 12, гипотенуза 25.
    expect(integerSquareRoot(9 * 16)).toBe(12);
    expect(9 + 16).toBe(25);
  });

  it('урок 5.2: теорема Пифагора', () => {
    expect(hypotenuseLength(3, 4)).toBe(5);
    expect(legLength(5, 3)).toBe(4);
    // Практика 1–11.
    expect(hypotenuseLength(9, 12)).toBe(15);
    expect(hypotenuseLength(5, 7) ** 2).toBeCloseTo(74, 8);
    expect(hypotenuseLength(5, 7)).toBeCloseTo(8.6, 1);
    expect(8.6 ** 2).toBeCloseTo(73.96, 12);
    expect(legLength(26, 10)).toBe(24);
    expect(hypotenuseLength(6, 8)).toBe(10);
    expect(legLength(13, 5)).toBe(12);
    expect(triangleAreaByHeight(10, 12)).toBe(60);
    expect(isRightTriangle(12, 16, 20)).toBe(true);
    expect(isRightTriangle(6, 7, 9)).toBe(false);
    expect(legLength(5, 3)).toBe(4);
    expect(hypotenuseLength(6, 6)).toBeCloseTo(8.49, 2);
    expect(formatRadical(simplifyRadical(72))).toBe('6√2');
    expect(legLength(8, 4)).toBeCloseTo(6.93, 2);
    expect(formatRadical(simplifyRadical(48))).toBe('4√3');
    expect(triangleAreaByHeight(8, legLength(8, 4))).toBeCloseTo(27.71, 2);
    expect(hypotenuseLength(5 - 1, 5 - 2)).toBe(5);
    // Пифагоровы тройки из урока.
    for (const [a, b, c] of [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [6, 8, 10], [9, 12, 15]] as const) {
      expect(isRightTriangle(a, b, c)).toBe(true);
    }
  });

  it('урок 5.3: тригонометрия острого угла', () => {
    // Табличные значения.
    expect(sineDegrees(30)).toBeCloseTo(0.5, 10);
    expect(cosineDegrees(60)).toBeCloseTo(0.5, 10);
    expect(tangentDegrees(45)).toBeCloseTo(1, 10);
    expect(sineDegrees(45)).toBeCloseTo(Math.SQRT2 / 2, 10);
    expect(cosineDegrees(30)).toBeCloseTo(Math.sqrt(3) / 2, 10);
    expect(tangentDegrees(60)).toBeCloseTo(Math.sqrt(3), 10);
    // Разбор: пандус длиной 12 м под углом 30°.
    const ramp = legsFromHypotenuseAndAngle(12, 30);
    expect(ramp.opposite).toBeCloseTo(6, 8);
    expect(ramp.adjacent).toBeCloseTo(6 * Math.sqrt(3), 6);
    expect(ramp.adjacent).toBeCloseTo(10.39, 2);
    expect(ramp.opposite ** 2 + ramp.adjacent ** 2).toBeCloseTo(144, 6);
    // Разбор: sin α = 0,6 ⇒ cos α = 0,8, tg α = 0,75.
    const triangle = rightTriangleFromLegs(6, 8);
    expect(triangle).toMatchObject({ hypotenuse: 10, sine: 0.6, cosine: 0.8, tangent: 0.75 });
    // Практика 3–4, 7, 9–10.
    expect(12 * sineDegrees(30)).toBeCloseTo(6, 8);
    expect(5 / cosineDegrees(60)).toBeCloseTo(10, 8);
    expect(0.5 / 6).toBeCloseTo(0.083, 3);
    expect(4 * sineDegrees(60)).toBeCloseTo(3.46, 2);
    expect(5 / cosineDegrees(45)).toBeCloseTo(7.07, 2);
    expect(15 * 0.839).toBeCloseTo(12.585, 10);
  });

  it('урок 5.4: окружность и касательные', () => {
    // Взаимное расположение прямой и окружности.
    expect(lineCirclePosition(9, 5)).toBe('secant');
    expect(lineCirclePosition(9, 9)).toBe('tangent');
    expect(lineCirclePosition(9, 12)).toBe('external');
    expect(lineCirclePosition(5, 3)).toBe('secant');
    expect(lineCirclePosition(7, 7)).toBe('tangent');
    expect(lineCirclePosition(4, 6)).toBe('external');
    expect(lineCirclePosition(5, 5)).toBe('tangent');
    // Разбор: PA = 8, угол между касательными ≈ 73,7°.
    expect(tangentSegmentLength(6, 10)).toBe(8);
    expect(angleBetweenTangents(6, 10) / 2).toBeCloseTo(36.9, 1);
    expect(angleBetweenTangents(6, 10)).toBeCloseTo(73.7, 1);
    // Разбор: радиус 13, расстояние 5 ⇒ хорда 24.
    expect(2 * legLength(13, 5)).toBe(24);
    // Практика 4–5, 7–10.
    expect(tangentSegmentLength(5, 13)).toBe(12);
    expect(hypotenuseLength(24, 7)).toBe(25);
    expect(5 / sineDegrees(30)).toBeCloseTo(10, 8);
    expect(legLength(10, 8)).toBe(6);
    expect(2 * legLength(13, 5)).toBe(24);
    expect(2 * Math.PI * 35).toBeCloseTo(219.9, 0);
    expect(2 * 3.14 * 35).toBeCloseTo(219.8, 10);
    // Практика 11: внешнее касание двух окружностей.
    expect(3 + 5).toBe(8);
  });

  it('урок 5.5: вписанные углы', () => {
    expect(inscribedAngleFromCentral(100)).toBe(50);
    expect(inscribedAngleFromCentral(80)).toBe(40);
    expect(inscribedAngleFromCentral(120)).toBe(60);
    expect(inscribedAngleFromCentral(180)).toBe(90);
    // Практика 2: вписанный 35° ⇒ дуга и центральный угол 70°.
    expect(35 * 2).toBe(70);
    // Практика 5: углы треугольника 35°, 90°, 55°.
    expect(180 - 90 - 35).toBe(55);
    expect(35 * 2 + 55 * 2 + 180).toBe(360);
    // Практика 7 и разбор: AE·EB = CE·ED.
    expect(chordIntersectionSegment(4, 6, 3)).toBe(8);
    expect(3 + 8).toBe(11);
    expect(4 + 6).toBe(10);
    // Практика 8: диаметр по катетам 6 и 8.
    expect(hypotenuseLength(6, 8)).toBe(10);
    // Практика 9: вписанный четырёхугольник.
    expect(180 - 70).toBe(110);
    // Практика 10: дуги 100° и 260°, вершина на большей ⇒ 50°.
    expect(100 + 260).toBe(360);
    expect(inscribedAngleFromCentral(100)).toBe(50);
    expect(inscribedAngleFromCentral(260)).toBe(130);
  });

  it('урок 5.6 (практикум): измеряем недоступное', () => {
    // Станция 1: башня 48 м.
    expect((30 / 2.5) * 4).toBe(48);
    expect(30 * (4 / 2.5)).toBe(48);
    // Станция 2: BC = 45 м, ошибочный ход даёт 30 м.
    expect(15 / thalesRatio(12, 24)).toBe(45);
    expect(15 * (24 / 12)).toBe(30);
    // Станция 3: диагональ участка 9 × 12.
    expect(hypotenuseLength(9, 12)).toBe(15);
    expect(hypotenuseLength(8, 6)).toBe(10);
    expect(hypotenuseLength(5, 7)).toBeCloseTo(Math.sqrt(74), 8);
    // Станция 5 и задача 14: радиус по хорде 48 и высоте дуги 8.
    const radius = (24 ** 2 + 8 ** 2) / (2 * 8);
    expect(radius).toBe(40);
    expect(legLength(radius, radius - 8)).toBe(24);
    // Итоговый набор.
    expect(16 * 2.5).toBe(40);
    expect(areaFactor(4 / 3) * 27).toBeCloseTo(48, 10);
    expect(thalesSegment(6, 9, 8)).toBe(12);
    expect(hypotenuseLength(20, 21)).toBe(29);
    expect(legLength(41, 9)).toBe(40);
    expect(7 / cosineDegrees(60)).toBeCloseTo(14, 8);
    expect(7 * tangentDegrees(60)).toBeCloseTo(12.12, 2);
    // Задача 8: cos α = 0,28 ⇒ sin α = 0,96, tg α = 24/7.
    expect(Math.sqrt(1 - 0.28 ** 2)).toBeCloseTo(0.96, 10);
    expect(0.96 / 0.28).toBeCloseTo(24 / 7, 10);
    expect(24 / 7).toBeCloseTo(3.43, 2);
    expect(legLength(17, 15)).toBe(8);
    expect(hypotenuseLength(15, 8)).toBe(17);
    expect(hypotenuseLength(5, 12)).toBe(13);
    expect(chordIntersectionSegment(5, 8, 4)).toBe(10);
    expect(4 + 10).toBe(14);
    expect(28 * 2).toBe(56);
    expect(inscribedAngleFromCentral(56)).toBe(28);
  });
});

/* ═══════════════════════════ 6. Вероятностные деревья ═══════════════════════════ */

describe('8 класс, глава 6 «Вероятностные деревья»', () => {
  it('урок 6.1: события как множества исходов', () => {
    const even = selectOutcomes(CARDS, 'even');
    const byThree = selectOutcomes(CARDS, 'multipleOfThree');
    expect(even).toEqual([2, 4, 6, 8, 10, 12]);
    expect(byThree).toEqual([3, 6, 9, 12]);
    expect(intersectionOfSets(even, byThree)).toEqual([6, 12]);
    expect(unionOfSets(even, byThree)).toHaveLength(8);
    expect(even.length + byThree.length - intersectionOfSets(even, byThree).length).toBe(8);
    // Разбор про кубик: A = {2;4;6}, B = {4;5;6}.
    const dieEven = selectOutcomes([1, 2, 3, 4, 5, 6], 'even');
    const bigger = [4, 5, 6];
    expect(unionOfSets(dieEven, bigger)).toEqual([2, 4, 5, 6]);
    expect(intersectionOfSets(dieEven, bigger)).toEqual([4, 6]);
    expect(dieEven.length + bigger.length - 2).toBe(4);
    // Практика 4: делится на 4 и больше 8.
    const byFour = CARDS.filter((value) => value % 4 === 0);
    const overEight = CARDS.filter((value) => value > 8);
    expect(byFour).toEqual([4, 8, 12]);
    expect(overEight).toEqual([9, 10, 11, 12]);
    expect(unionOfSets(byFour, overEight)).toEqual([4, 8, 9, 10, 11, 12]);
    expect(intersectionOfSets(byFour, overEight)).toEqual([12]);
    expect(3 + 4 - 1).toBe(6);
    // Практика 9 и 11.
    expect(5 + 4 - 2).toBe(7);
    expect(12 - 7).toBe(5);
    expect(7 + 5 - 12).toBe(0);
  });

  it('урок 6.2: классическая вероятность', () => {
    const even = selectOutcomes(CARDS, 'even');
    const byThree = selectOutcomes(CARDS, 'multipleOfThree');
    expect(formatFraction(probabilityOfSet(unionOfSets(even, byThree), CARDS))).toBe('2/3');
    expect(formatFraction(probabilityOfSet(even, CARDS))).toBe('1/2');
    expect(formatFraction(probabilityOfSet(byThree, CARDS))).toBe('1/3');
    expect(formatFraction(probabilityOfSet(intersectionOfSets(even, byThree), CARDS))).toBe('1/6');
    // Таблица сумм двух кубиков из урока.
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(pairsWithSum)).toEqual([1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]);
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].reduce((sum, value) => sum + pairsWithSum(value), 0)).toBe(36);
    expect(formatFraction(classicalProbability(pairsWithSum(8), 36))).toBe('5/36');
    expect(formatFraction(classicalProbability(pairsWithSum(10) + pairsWithSum(11) + pairsWithSum(12), 36))).toBe('1/6');
    expect(formatFraction(classicalProbability(36 - 25, 36))).toBe('11/36');
    expect(11 / 36).toBeCloseTo(0.31, 2);
    // Практика 1–3, 5, 8–11.
    expect(formatFraction(classicalProbability(1, 6))).toBe('1/6');
    expect(formatFraction(classicalProbability(3, 6))).toBe('1/2');
    expect(formatFraction(classicalProbability(2, 6))).toBe('1/3');
    expect(formatFraction(classicalProbability(5, 12))).toBe('5/12');
    expect(formatFraction(classicalProbability(5, 12 + 0))).toBe('5/12');
    expect(selectOutcomes(CARDS, 'prime')).toEqual([2, 3, 5, 7, 11]);
    expect(formatFraction(classicalProbability(pairsWithSum(7), 36))).toBe('1/6');
    expect(formatFraction(classicalProbability(6, 36))).toBe('1/6');
    expect(formatFraction(classicalProbability(pairsWithSum(11) + pairsWithSum(12), 36))).toBe('1/12');
    expect(formatFraction(classicalProbability(6, 40))).toBe('3/20');
    expect(6 / 40).toBeCloseTo(0.15, 12);
    // Практика 4: 5 красных и 7 синих.
    expect(formatFraction(classicalProbability(5, 12))).toBe('5/12');
    expect(formatFraction(complementProbability(classicalProbability(5, 12)))).toBe('7/12');
    // Практика 6: делится на 3 или больше 8.
    const overEight = CARDS.filter((value) => value > 8);
    expect(formatFraction(probabilityOfSet(unionOfSets(byThree, overEight), CARDS))).toBe('1/2');
    // Практика 7.
    expect(formatFraction(complementProbability(fraction(3, 8)))).toBe('5/8');
  });

  it('урок 6.3: дерево испытаний', () => {
    // Разбор: 2 красных и 3 синих, два шара без возвращения.
    const urn = enumerateOutcomes(
      buildUrnTree([{ label: 'К', count: 2 }, { label: 'С', count: 3 }], 2, false),
    );
    expect(formatFraction(totalProbability(urn))).toBe('1');
    const path = (first: string, second: string) =>
      formatFraction(eventProbability(urn, (o) => o.steps[0] === first && o.steps[1] === second));
    expect(path('К', 'К')).toBe('1/10');
    expect(path('К', 'С')).toBe('3/10');
    expect(path('С', 'К')).toBe('3/10');
    expect(path('С', 'С')).toBe('3/10');
    expect(formatFraction(eventProbability(urn, (o) => o.steps[0] !== o.steps[1]))).toBe('3/5');
    expect(formatFraction(eventProbability(urn, (o) => o.steps.includes('К')))).toBe('7/10');
    // С возвращением: P(КК) = 4/25.
    const urnBack = enumerateOutcomes(
      buildUrnTree([{ label: 'К', count: 2 }, { label: 'С', count: 3 }], 2, true),
    );
    expect(formatFraction(eventProbability(urnBack, (o) => o.steps.every((s) => s === 'К')))).toBe('4/25');

    // Тест наугад: два вопроса по 4 варианта.
    const quiz = enumerateOutcomes(
      buildIndependentTree([
        [{ label: 'В', probability: fraction(1, 4) }, { label: 'Н', probability: fraction(3, 4) }],
        [{ label: 'В', probability: fraction(1, 4) }, { label: 'Н', probability: fraction(3, 4) }],
      ]),
    );
    expect(formatFraction(totalProbability(quiz))).toBe('1');
    expect(formatFraction(eventProbability(quiz, (o) => o.steps.every((s) => s === 'В')))).toBe('1/16');
    expect(formatFraction(eventProbability(quiz, (o) => o.steps.filter((s) => s === 'В').length === 1))).toBe('3/8');
    expect(formatFraction(eventProbability(quiz, (o) => o.steps.includes('В')))).toBe('7/16');

    // Практика 3: три броска монеты.
    const coin = enumerateOutcomes(
      buildIndependentTree(
        Array.from({ length: 3 }, () => [
          { label: 'О', probability: fraction(1, 2) },
          { label: 'Р', probability: fraction(1, 2) },
        ]),
      ),
    );
    expect(formatFraction(eventProbability(coin, (o) => o.steps.every((s) => s === 'О')))).toBe('1/8');
    expect(formatFraction(eventProbability(coin, (o) => o.steps.includes('О')))).toBe('7/8');
    expect(formatFraction(eventProbability(coin, (o) => o.steps.filter((s) => s === 'О').length === 2))).toBe('3/8');

    // Практика 4: 3 белых и 2 чёрных без возвращения.
    const bag = enumerateOutcomes(
      buildUrnTree([{ label: 'Б', count: 3 }, { label: 'Ч', count: 2 }], 2, false),
    );
    expect(formatFraction(eventProbability(bag, (o) => o.steps.every((s) => s === 'Б')))).toBe('3/10');
    expect(formatFraction(eventProbability(bag, (o) => o.steps.every((s) => s === 'Ч')))).toBe('1/10');
    expect(formatFraction(eventProbability(bag, (o) => o.steps[0] !== o.steps[1]))).toBe('3/5');
    expect(formatFraction(totalProbability(bag))).toBe('1');
    // Практика 5: то же с возвращением.
    const bagBack = enumerateOutcomes(
      buildUrnTree([{ label: 'Б', count: 3 }, { label: 'Ч', count: 2 }], 2, true),
    );
    expect(formatFraction(eventProbability(bagBack, (o) => o.steps.every((s) => s === 'Б')))).toBe('9/25');

    // Практика 6: стрелок с вероятностью 3/5, два выстрела.
    const shots = enumerateOutcomes(
      buildIndependentTree(
        Array.from({ length: 2 }, () => [
          { label: 'П', probability: fraction(3, 5) },
          { label: 'М', probability: fraction(2, 5) },
        ]),
      ),
    );
    expect(formatFraction(eventProbability(shots, (o) => o.steps.every((s) => s === 'П')))).toBe('9/25');
    expect(formatFraction(eventProbability(shots, (o) => o.steps.every((s) => s === 'М')))).toBe('4/25');
    expect(formatFraction(eventProbability(shots, (o) => o.steps.filter((s) => s === 'П').length === 1))).toBe('12/25');
    expect(formatFraction(totalProbability(shots))).toBe('1');
    // Практика 7: прибор из двух блоков.
    expect(formatFraction(fraction(9 * 9, 100))).toBe('81/100');
    // Практика 8: одна конфета с орехом из четырёх, берут две.
    const sweets = enumerateOutcomes(
      buildUrnTree([{ label: 'орех', count: 1 }, { label: 'без', count: 3 }], 2, false),
    );
    expect(formatFraction(eventProbability(sweets, (o) => o.steps.includes('орех')))).toBe('1/2');
    // Практика 9: три синих подряд из мешка 2 К и 3 С.
    const three = enumerateOutcomes(
      buildUrnTree([{ label: 'К', count: 2 }, { label: 'С', count: 3 }], 3, false),
    );
    expect(formatFraction(eventProbability(three, (o) => o.steps.every((s) => s === 'С')))).toBe('1/10');
  });

  it('урок 6.4: рассеивание данных', () => {
    const anton = [6, 7, 8, 9, 10];
    const boris = [4, 6, 8, 10, 12];
    expect(formatFraction(meanOf(anton))).toBe('8');
    expect(formatFraction(meanOf(boris))).toBe('8');
    expect(formatFraction(rangeOf(anton))).toBe('4');
    expect(formatFraction(rangeOf(boris))).toBe('8');
    expect(formatFraction(populationVariance(anton))).toBe('2');
    expect(formatFraction(populationVariance(boris))).toBe('8');
    // Вера и Галя: одинаковый размах, разная дисперсия.
    const vera = [5, 8, 8, 8, 11];
    const galya = [5, 5, 8, 11, 11];
    expect(formatFraction(rangeOf(vera))).toBe(formatFraction(rangeOf(galya)));
    expect(formatFraction(rangeOf(vera))).toBe('6');
    expect(formatFraction(populationVariance(vera))).toBe('18/5');
    expect(formatFraction(populationVariance(galya))).toBe('36/5');
    // Практика 1–3, 6, 8, 10.
    expect(formatFraction(rangeOf([12, 7, 15, 9, 11]))).toBe('8');
    expect(formatFraction(meanOf([3, 5, 4, 8]))).toBe('5');
    expect(formatFraction(populationVariance([3, 5, 4, 8]))).toBe('7/2');
    expect(formatFraction(populationVariance([7, 7, 7, 7, 7]))).toBe('0');
    expect(formatFraction(rangeOf([7, 7, 7, 7, 7]))).toBe('0');
    // Сдвиг не меняет разброс, растяжение вдвое учетверяет дисперсию.
    const shifted = anton.map((value) => value + 3);
    expect(formatFraction(meanOf(shifted))).toBe('11');
    expect(formatFraction(rangeOf(shifted))).toBe('4');
    expect(formatFraction(populationVariance(shifted))).toBe('2');
    const scaled = anton.map((value) => value * 2);
    expect(scaled).toEqual([12, 14, 16, 18, 20]);
    expect(formatFraction(meanOf(scaled))).toBe('16');
    expect(formatFraction(rangeOf(scaled))).toBe('8');
    expect(formatFraction(populationVariance(scaled))).toBe('8');
    expect(formatFraction(populationVariance([2, 2, 5, 5]))).toBe('9/4');
    expect(toExactNumber({ numerator: 9n, denominator: 4n })).toBe(2.25);
  });

  it('урок 6.5 (практикум): разбор случайного опыта', () => {
    // Станция 1: простое или больше 6.
    const prime = selectOutcomes(CARDS, 'prime');
    const overSix = selectOutcomes(CARDS, 'greaterThanSix');
    expect(prime).toEqual([2, 3, 5, 7, 11]);
    expect(overSix).toEqual([7, 8, 9, 10, 11, 12]);
    expect(intersectionOfSets(prime, overSix)).toEqual([7, 11]);
    expect(unionOfSets(prime, overSix)).toHaveLength(9);
    expect(formatFraction(probabilityOfSet(unionOfSets(prime, overSix), CARDS))).toBe('3/4');
    expect(formatFraction(complementProbability(probabilityOfSet(prime, CARDS)))).toBe('7/12');
    // Станция 2: крупный приз за сумму 11 и больше, мелкий — за 7.
    expect(formatFraction(classicalProbability(pairsWithSum(11) + pairsWithSum(12), 36))).toBe('1/12');
    expect(formatFraction(classicalProbability(pairsWithSum(7), 36))).toBe('1/6');
    // Задача 4: сумма 5.
    expect(formatFraction(classicalProbability(pairsWithSum(5), 36))).toBe('1/9');
    // Задача 5: произведение чётно — через противоположное событие.
    let oddPairs = 0;
    for (let red = 1; red <= 6; red += 1) {
      for (let blue = 1; blue <= 6; blue += 1) {
        if ((red * blue) % 2 === 1) oddPairs += 1;
      }
    }
    expect(oddPairs).toBe(9);
    expect(formatFraction(complementProbability(classicalProbability(oddPairs, 36)))).toBe('3/4');
    // Задачи 6–7: мешок 3 красных и 2 синих.
    const urn = enumerateOutcomes(
      buildUrnTree([{ label: 'К', count: 3 }, { label: 'С', count: 2 }], 2, false),
    );
    expect(formatFraction(eventProbability(urn, (o) => o.steps.every((s) => s === 'К')))).toBe('3/10');
    expect(formatFraction(eventProbability(urn, (o) => o.steps.includes('С')))).toBe('7/10');
    const urnBack = enumerateOutcomes(
      buildUrnTree([{ label: 'К', count: 3 }, { label: 'С', count: 2 }], 2, true),
    );
    expect(formatFraction(eventProbability(urnBack, (o) => o.steps.every((s) => s === 'К')))).toBe('9/25');
    expect(9 / 25).toBeGreaterThan(3 / 10);
    // Задача 8: ровно два орла из трёх бросков.
    const coin = enumerateOutcomes(
      buildIndependentTree(
        Array.from({ length: 3 }, () => [
          { label: 'О', probability: fraction(1, 2) },
          { label: 'Р', probability: fraction(1, 2) },
        ]),
      ),
    );
    expect(formatFraction(eventProbability(coin, (o) => o.steps.filter((s) => s === 'О').length === 2))).toBe('3/8');
    // Задача 9: хотя бы одно попадание при P = 2/5.
    const shots = enumerateOutcomes(
      buildIndependentTree(
        Array.from({ length: 2 }, () => [
          { label: 'П', probability: fraction(2, 5) },
          { label: 'М', probability: fraction(3, 5) },
        ]),
      ),
    );
    expect(formatFraction(eventProbability(shots, (o) => o.steps.every((s) => s === 'М')))).toBe('9/25');
    expect(formatFraction(eventProbability(shots, (o) => o.steps.includes('П')))).toBe('16/25');
    // Задача 10: ряд 4, 4, 7, 9.
    expect(formatFraction(meanOf([4, 4, 7, 9]))).toBe('6');
    expect(formatFraction(rangeOf([4, 4, 7, 9]))).toBe('5');
    expect(formatFraction(populationVariance([4, 4, 7, 9]))).toBe('9/2');
    // Станция 4 и задача 11: Дима стабильнее Егора более чем вчетверо.
    const dima = [7, 7, 8, 9, 9];
    const egor = [5, 7, 8, 10, 10];
    expect(formatFraction(meanOf(dima))).toBe('8');
    expect(formatFraction(meanOf(egor))).toBe('8');
    expect(formatFraction(rangeOf(dima))).toBe('2');
    expect(formatFraction(rangeOf(egor))).toBe('5');
    expect(formatFraction(populationVariance(dima))).toBe('4/5');
    expect(formatFraction(populationVariance(egor))).toBe('18/5');
    expect(3.6 / 0.8).toBeGreaterThan(4);
  });
});
