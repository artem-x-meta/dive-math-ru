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
import {
  addExact,
  divideExact,
  formatExactRussian,
  multiplyExact,
  parseExact,
  subtractExact,
  toExactNumber,
} from '../src/lib/exactRational';
import { compareFractions } from '../src/lib/fractions';
import { normalizeQuantityRatio, normalizeRatio, solveProportion } from '../src/lib/ratios';
import {
  absoluteValue,
  addSigned,
  compareSigned,
  divideSigned,
  multiplySigned,
  quadrantOf,
  reflectPoint,
  subtractSigned,
} from '../src/lib/signedNumbers';
import { equivalentLinearExpressions, evaluateExpression, parseExpression } from '../src/lib/algebra';
import { evaluateFormulaPreset } from '../src/lib/formulas';
import {
  approximatePiMultiple,
  circleMeasures,
  classifyAngle,
  convertMetricValue,
  cuboidMetrics,
  inspectQuadrilateral,
  orthogonalPerimeter,
  polygonArea,
  rectangleMetrics,
} from '../src/lib/geometry';
import {
  canFormTriangle,
  parallelogramFourthVertex,
  parallelogramLayout,
  segmentMidpoint,
  triangleInequality,
} from '../src/lib/planimetry';
import {
  arithmeticMean,
  axisScale,
  cartesianProduct,
  countVariants,
  missingValueForMean,
  pairCount,
  pieSectors,
  reduceFraction,
  sectorAngle,
  sumValues,
  unorderedPairs,
} from '../src/lib/dataStats';

/** Сумма цифр десятичной записи натурального числа. */
function digitSum(value: number): number {
  return String(value)
    .split('')
    .reduce((total, digit) => total + Number(digit), 0);
}

/** Значение выражения из урока при заданных значениях букв. */
function evaluate(source: string, environment: Record<string, number | string> = {}): number {
  return toExactNumber(evaluateExpression(parseExpression(source), environment));
}

/** Точная сумма/разность дробей урока, записанная по-русски. */
function exactSum(...terms: (number | string)[]): string {
  return formatExactRussian(terms.reduce<ReturnType<typeof parseExact>>(
    (total, term) => addExact(total, term),
    parseExact(0),
  ));
}

/** p% от величины A, посчитанные точно. */
function percentOf(percent: number | string, amount: number | string): number {
  return toExactNumber(multiplyExact(amount, divideExact(percent, 100)));
}

/** Основание, если известны часть и процент. */
function baseFromPercent(part: number | string, percent: number | string): number {
  return toExactNumber(divideExact(part, divideExact(percent, 100)));
}

describe('глава 1 «У чисел есть устройство»', () => {
  it('вход в главу: диагностика', () => {
    expect(divideWithRemainder(24, 7)).toEqual({ quotient: 3, remainder: 3 });
    expect(factorPairs(18)).toEqual([[1, 18], [2, 9], [3, 6]]);
    expect(divideWithRemainder(53, 8)).toEqual({ quotient: 6, remainder: 5 });
    expect(digitSum(4716)).toBe(18);
    expect(4716 % 3).toBe(0);
    expect(4716 % 9).toBe(0);
    expect(gcd(12, 18)).toBe(6);
    expect(lcm(6, 8)).toBe(24);
  });

  it('урок 1.1: делители и кратные', () => {
    expect(factorPairs(24)).toEqual([[1, 24], [2, 12], [3, 8], [4, 6]]);
    expect(divisors(24)).toEqual([1, 2, 3, 4, 6, 8, 12, 24]);
    expect(factorPairs(36)).toEqual([[1, 36], [2, 18], [3, 12], [4, 9], [6, 6]]);
    expect(divisors(36)).toEqual([1, 2, 3, 4, 6, 9, 12, 18, 36]);
    // Практика 1–8.
    expect(divisors(28)).toEqual([1, 2, 4, 7, 14, 28]);
    expect([1, 2, 3, 4, 5, 6].map((k) => 9 * k)).toEqual([9, 18, 27, 36, 45, 54]);
    expect(divideWithRemainder(132, 6)).toEqual({ quotient: 22, remainder: 0 });
    expect(divideWithRemainder(145, 6)).toEqual({ quotient: 24, remainder: 1 });
    expect(factorPairs(30)).toEqual([[1, 30], [2, 15], [3, 10], [5, 6]]);
    expect(divisors(48)).toEqual([1, 2, 3, 4, 6, 8, 12, 16, 24, 48]);
    const commonMultiples = [];
    for (let value = 21; value < 30; value += 1) {
      if (value % 4 === 0 && value % 6 === 0) commonMultiples.push(value);
    }
    expect(commonMultiples).toEqual([24]);
    expect(divisors(25)).toEqual([1, 5, 25]);
    // QuickCheck: 7 делит 42, а 42 кратно 7.
    expect(42 % 7).toBe(0);
  });

  it('урок 1.2: деление с остатком', () => {
    expect(divideWithRemainder(53, 8)).toEqual({ quotient: 6, remainder: 5 });
    expect(8 * 6 + 5).toBe(53);
    // Числа от 20 до 50 с остатком 4 при делении на 6.
    const withRemainderFour = [];
    for (let value = 20; value <= 50; value += 1) {
      if (divideWithRemainder(value, 6).remainder === 4) withRemainderFour.push(value);
    }
    expect(withRemainderFour).toEqual([22, 28, 34, 40, 46]);
    // QuickCheck: правильная запись 68 = 7·9 + 5.
    expect(divideWithRemainder(68, 7)).toEqual({ quotient: 9, remainder: 5 });
    // Практика 1–8.
    expect(divideWithRemainder(67, 9)).toEqual({ quotient: 7, remainder: 4 });
    expect(divideWithRemainder(125, 12)).toEqual({ quotient: 10, remainder: 5 });
    expect(divideWithRemainder(83, 12)).toEqual({ quotient: 6, remainder: 11 });
    expect(divideWithRemainder(83, 12).quotient + 1).toBe(7);
    expect(divideWithRemainder(101, 7)).toEqual({ quotient: 14, remainder: 3 });
    expect(divideWithRemainder(100, 7)).toEqual({ quotient: 14, remainder: 2 });
    // n = 8k + 7, значит n + 3 даёт остаток 2.
    for (const k of [0, 1, 5, 12]) {
      expect(divideWithRemainder(8 * k + 7 + 3, 8).remainder).toBe(2);
    }
  });

  it('урок 1.3: признаки делимости', () => {
    expect(digitSum(472)).toBe(13);
    expect(digitSum(4716)).toBe(18);
    // Разбор 47□: чётная цифра и сумма 11 + d, кратная 3.
    const suitable = [];
    for (let digit = 0; digit <= 9; digit += 1) {
      if ((470 + digit) % 2 === 0 && (470 + digit) % 3 === 0) suitable.push(digit);
    }
    expect(suitable).toEqual([4]);
    expect(474 % 6).toBe(0);
    // QuickCheck 49□ на 3 и на 5.
    expect(digitSum(490)).toBe(13);
    expect(digitSum(495)).toBe(18);
    expect(495 % 3).toBe(0);
    expect(495 % 5).toBe(0);
    // Практика 1–9.
    expect(digitSum(5733)).toBe(18);
    expect([2, 5, 10].every((divisor) => 5733 % divisor !== 0)).toBe(true);
    expect([3, 9].every((divisor) => 5733 % divisor === 0)).toBe(true);
    expect(digitSum(12_450)).toBe(12);
    expect([2, 3, 5, 10].every((divisor) => 12_450 % divisor === 0)).toBe(true);
    expect(12_450 % 9).not.toBe(0);
    expect(621 % 9).toBe(0);
    expect(digitSum(621)).toBe(9);
    let smallestFourDigit = 1000;
    while (smallestFourDigit % 9 !== 0 || smallestFourDigit % 10 !== 0) smallestFourDigit += 1;
    expect(smallestFourDigit).toBe(1080);
    const fromDigits = [245, 425];
    expect(fromDigits.every((value) => value % 5 === 0)).toBe(true);
    expect(fromDigits.map(digitSum)).toEqual([11, 11]);
    expect(fromDigits.every((value) => value % 3 !== 0)).toBe(true);
    const digitsForSixty = [];
    for (let digit = 0; digit <= 9; digit += 1) {
      if ((7302 + digit * 10) % 6 === 0) digitsForSixty.push(digit);
    }
    expect(digitsForSixty).toEqual([0, 3, 6, 9]);
  });

  it('урок 1.4: простые числа и разложение на множители', () => {
    expect(isPrime(97)).toBe(true);
    expect(divideWithRemainder(97, 7)).toEqual({ quotient: 13, remainder: 6 });
    expect(digitSum(97)).toBe(16);
    expect(primeFactorization(84)).toEqual([2, 2, 3, 7]);
    expect(primeFactorization(756)).toEqual([2, 2, 3, 3, 3, 7]);
    expect(4 * 27 * 7).toBe(756);
    expect(primeFactorization(60)).toEqual([2, 2, 3, 5]);
    // Практика 1–10.
    expect([2, 17, 29].every(isPrime)).toBe(true);
    expect([1, 9, 21].some(isPrime)).toBe(false);
    const primesBelowThirty = [];
    for (let value = 2; value < 30; value += 1) if (isPrime(value)) primesBelowThirty.push(value);
    expect(primesBelowThirty).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
    expect(isPrime(91)).toBe(false);
    expect(primeFactorization(91)).toEqual([7, 13]);
    expect(primeFactorization(210)).toEqual([2, 3, 5, 7]);
    expect(2 ** 3 * 3 ** 2 * 5).toBe(360);
    expect(primeFactorization(72)).toEqual([2, 2, 2, 3, 3]);
    expect(primeFactorization(221)).toEqual([13, 17]);
    // QuickCheck: 51 составное, 53 простое.
    expect(isPrime(51)).toBe(false);
    expect(primeFactorization(51)).toEqual([3, 17]);
    expect(isPrime(53)).toBe(true);
  });

  it('урок 1.5: наибольший общий делитель', () => {
    expect(primeFactorization(84)).toEqual([2, 2, 3, 7]);
    expect(primeFactorization(126)).toEqual([2, 3, 3, 7]);
    expect(gcd(84, 126)).toBe(42);
    expect(84 / 42).toBe(2);
    expect(126 / 42).toBe(3);
    expect(divisors(18).filter((value) => 24 % value === 0)).toEqual([1, 2, 3, 6]);
    expect(gcd(18, 24)).toBe(6);
    expect(gcd(168, 252)).toBe(84);
    expect(168 / 84).toBe(2);
    expect(252 / 84).toBe(3);
    expect(formatExactRussian(divideExact(84, 126))).toBe('2/3');
    // Алгоритм Евклида для 252 и 180.
    expect(divideWithRemainder(252, 180)).toEqual({ quotient: 1, remainder: 72 });
    expect(divideWithRemainder(180, 72)).toEqual({ quotient: 2, remainder: 36 });
    expect(divideWithRemainder(72, 36)).toEqual({ quotient: 2, remainder: 0 });
    expect(gcd(252, 180)).toBe(36);
    // Практика 2–8 и QuickCheck.
    expect(gcd(30, 45)).toBe(15);
    expect(gcd(32, 48)).toBe(16);
    expect(gcd(72, 90)).toBe(18);
    expect(gcd(96, 144)).toBe(48);
    expect([96 / 48, 144 / 48]).toEqual([2, 3]);
    expect(gcd(120, 168)).toBe(24);
    expect([120 / 24, 168 / 24]).toEqual([5, 7]);
    expect(gcd(150, 210)).toBe(30);
    expect(formatExactRussian(divideExact(150, 210))).toBe('5/7');
    expect(gcd(14, 25)).toBe(1);
    expect(gcd(48, 60)).toBe(12);
    expect(lcm(48, 60)).toBe(240);
  });

  it('урок 1.6: наименьшее общее кратное', () => {
    expect(lcm(6, 8)).toBe(24);
    expect(lcm(12, 18)).toBe(36);
    expect(lcm(24, 90)).toBe(360);
    expect([360 / 24, 360 / 90]).toEqual([15, 4]);
    expect(gcd(12, 18) * lcm(12, 18)).toBe(12 * 18);
    expect((12 * 18) / gcd(12, 18)).toBe(36);
    expect(lcm(4, 6)).toBe(12);
    expect(exactSum('1/4', '1/6')).toBe('5/12');
    // Практика 1–10.
    expect(lcm(8, 12)).toBe(24);
    expect(lcm(7, 10)).toBe(70);
    expect(lcm(18, 24)).toBe(72);
    expect(lcm(45, 60)).toBe(180);
    expect(lcm(15, 20)).toBe(60);
    expect(gcd(18, 24)).toBe(6);
    expect(240 / 4).toBe(60);
    // QuickCheck: автобусы через 36 минут, а произведение 216 не наименьшее.
    expect(12 * 18).toBe(216);
    expect(216 % 36).toBe(0);
  });

  it('урок 1.7: практикум «Карта чисел»', () => {
    expect(gcd(84, 126)).toBe(42);
    expect(lcm(12, 18)).toBe(36);
    // Станция 1.
    expect(divisors(40)).toEqual([1, 2, 4, 5, 8, 10, 20, 40]);
    expect([1, 2, 3, 4, 5].map((k) => 14 * k)).toEqual([14, 28, 42, 56, 70]);
    expect(divideWithRemainder(157, 12)).toEqual({ quotient: 13, remainder: 1 });
    expect(digitSum(73_530)).toBe(18);
    expect([2, 3, 5, 9, 10].every((divisor) => 73_530 % divisor === 0)).toBe(true);
    expect(primeFactorization(180)).toEqual([2, 2, 3, 3, 5]);
    expect(gcd(48, 72)).toBe(24);
    expect(lcm(48, 72)).toBe(144);
    expect(24 * 144).toBe(48 * 72);
    expect(24 * 144).toBe(3456);
    // Станция 2.
    expect(divideWithRemainder(95, 8)).toEqual({ quotient: 11, remainder: 7 });
    expect(gcd(54, 72)).toBe(18);
    expect((54 / 18) * (72 / 18)).toBe(12);
    expect(lcm(16, 24)).toBe(48);
    const digitsFor51a6 = [];
    for (let digit = 0; digit <= 9; digit += 1) {
      if ((5106 + digit * 10) % 6 === 0) digitsFor51a6.push(digit);
    }
    expect(digitsFor51a6).toEqual([0, 3, 6, 9]);
    expect(2 ** 3 * 3 ** 2 * 5).toBe(360);
    expect(primeFactorization(360).filter((prime) => prime === 2)).toHaveLength(3);
    expect(lcm(lcm(12, 15), 18)).toBe(180);
    // Станция 3.
    expect(primeFactorization(12)).toEqual([2, 2, 3]);
    expect(primeFactorization(18)).toEqual([2, 3, 3]);
    expect(lcm(3, 6)).toBe(6);
    let smallest = 100;
    while (divideWithRemainder(smallest, 7).remainder !== 2 || smallest % 3 !== 0) smallest += 1;
    expect(smallest).toBe(114);
    expect(gcd(8, 12)).toBe(4);
    expect(lcm(8, 12)).toBe(24);
    // Финальная самопроверка.
    expect(gcd(24, 36)).toBe(12);
    expect(lcm(24, 36)).toBe(72);
    expect(12 * 72).toBe(24 * 36);
    expect(12 * 72).toBe(864);
  });
});

describe('глава 2 «Дроби без страха»', () => {
  it('вход в главу: 5/4 и половина целого', () => {
    expect(formatExactRussian(parseExact('5/4'))).toBe('1,25');
    expect(compareFractions({ numerator: 3, denominator: 8 }, { numerator: 5, denominator: 8 })).toBe(-1);
    expect(compareFractions({ numerator: 3, denominator: 6 }, { numerator: 1, denominator: 2 })).toBe(0);
  });

  it('урок 2.1: сравнение дробей', () => {
    // 3/4 = 6/8 > 5/8.
    expect(compareFractions({ numerator: 3, denominator: 4 }, { numerator: 5, denominator: 8 })).toBe(1);
    expect(compareFractions({ numerator: 7, denominator: 12 }, { numerator: 5, denominator: 8 })).toBe(-1);
    expect(toExactNumber(multiplyExact('7/12', 24))).toBe(14);
    expect(toExactNumber(multiplyExact('5/8', 24))).toBe(15);
    expect(toExactNumber(multiplyExact('7/12', 48))).toBe(28);
    expect(toExactNumber(multiplyExact('5/8', 48))).toBe(30);
    // Крест-накрест для 11/15 и 8/11.
    expect(11 * 11).toBe(121);
    expect(8 * 15).toBe(120);
    expect(compareFractions({ numerator: 11, denominator: 15 }, { numerator: 8, denominator: 11 })).toBe(1);
    // QuickCheck 3/5 и 5/8.
    expect([3 * 8, 5 * 5]).toEqual([24, 25]);
    expect(compareFractions({ numerator: 3, denominator: 5 }, { numerator: 5, denominator: 8 })).toBe(-1);
    // Ориентиры: 13/25 > 1/2 > 7/15.
    expect(compareFractions({ numerator: 13, denominator: 25 }, { numerator: 1, denominator: 2 })).toBe(1);
    expect(compareFractions({ numerator: 7, denominator: 15 }, { numerator: 1, denominator: 2 })).toBe(-1);
    // Практика 1–8.
    expect([['2/3', 8], ['3/4', 9], ['5/6', 10]].map(([value]) => toExactNumber(multiplyExact(value as string, 12))))
      .toEqual([8, 9, 10]);
    expect(toExactNumber(multiplyExact('3/7', 14))).toBe(6);
    expect(toExactNumber(multiplyExact('4/7', 14))).toBe(8);
    expect(formatExactRussian(parseExact('7/14'))).toBe('0,5');
    expect(compareFractions({ numerator: 9, denominator: 20 }, { numerator: 1, denominator: 2 })).toBe(-1);
    expect([17 * 24, 18 * 23]).toEqual([408, 414]);
    expect(compareFractions({ numerator: 17, denominator: 23 }, { numerator: 18, denominator: 24 })).toBe(-1);
    expect([999 * 1001, 1000 * 1000]).toEqual([999_999, 1_000_000]);
    expect(compareFractions({ numerator: 999, denominator: 1000 }, { numerator: 1000, denominator: 1001 })).toBe(-1);
    const between = [];
    for (let n = 1; n < 16; n += 1) {
      if (n / 16 > 3 / 8 && n / 16 < 1 / 2) between.push(n);
    }
    expect(between).toEqual([7]);
    for (const n of [1, 2, 5, 40]) {
      expect(n * (n + 2)).toBe((n + 1) ** 2 - 1);
    }
  });

  it('урок 2.2: сложение дробей', () => {
    expect(exactSum('2/3', '1/4')).toBe('11/12');
    expect(toExactNumber(multiplyExact('2/3', 12))).toBe(8);
    expect(toExactNumber(multiplyExact('1/4', 12))).toBe(3);
    expect(exactSum('3/11', '5/11')).toBe('8/11');
    expect(lcm(6, 15)).toBe(30);
    expect([30 / 6, 30 / 15]).toEqual([5, 2]);
    expect(formatExactRussian(addExact('5/6', '7/15'))).toBe('1,3');
    expect(formatExactRussian(parseExact('39/30'))).toBe('1,3');
    // QuickCheck 2/9 + 1/6.
    expect(exactSum('2/9', '1/6')).toBe('7/18');
    expect(formatExactRussian(subtractExact('7/8', '5/12'))).toBe('11/24');
    expect(formatExactRussian(addExact('1/4', '5/12'))).toBe('2/3');
    expect(lcm(12, 8)).toBe(24);
    expect(lcm(7, 10)).toBe(70);
    // Практика 1–8.
    expect(lcm(12, 18)).toBe(36);
    expect(exactSum('7/12', '5/18')).toBe('31/36');
    expect(lcm(15, 20)).toBe(60);
    expect(formatExactRussian(subtractExact('11/15', '7/20'))).toBe('23/60');
    expect(formatExactRussian(addExact('13/6', '17/12'))).toBe('43/12');
    expect(toExactNumber(subtractExact('43/12', 3))).toBeCloseTo(7 / 12, 12);
    expect(formatExactRussian(subtractExact(3, '7/10'))).toBe('2,3');
    expect(exactSum('3/8', '5/12')).toBe('19/24');
    expect(formatExactRussian(subtractExact(1, '19/24'))).toBe('5/24');
    expect(compareFractions({ numerator: 5, denominator: 24 }, { numerator: 1, denominator: 4 })).toBe(-1);
    expect(formatExactRussian(subtractExact('5/2', '3/4'))).toBe('1,75');
    expect(exactSum('2/5', '1/3')).toBe('11/15');
    expect(exactSum('1/3', '1/6')).toBe('0,5');
  });

  it('урок 2.3: практикум по дробям', () => {
    // Разбор: 17/18 против 23/25 через дополнения до единицы.
    expect(formatExactRussian(subtractExact(1, '17/18'))).toBe('1/18');
    expect(subtractExact(1, '23/25')).toEqual(parseExact('2/25'));
    expect([1 * 25, 2 * 18]).toEqual([25, 36]);
    expect(compareFractions({ numerator: 17, denominator: 18 }, { numerator: 23, denominator: 25 })).toBe(1);
    // Смешанный набор 1–8.
    expect([11 * 20, 13 * 16]).toEqual([220, 208]);
    expect(compareFractions({ numerator: 11, denominator: 16 }, { numerator: 13, denominator: 20 })).toBe(1);
    expect(toExactNumber(multiplyExact('11/16', 80))).toBe(55);
    expect(toExactNumber(multiplyExact('13/20', 80))).toBe(52);
    expect(['5/6', '3/4', '11/15', '7/10'].map((value) => toExactNumber(multiplyExact(value, 60))))
      .toEqual([50, 45, 44, 42]);
    expect(formatExactRussian(subtractExact(addExact('7/18', '5/12'), '1/9'))).toBe('25/36');
    expect(formatExactRussian(subtractExact('6/7', '5/14'))).toBe('0,5');
    expect(addExact('3/8', '2/5')).toEqual(parseExact('31/40'));
    expect(subtractExact(1, '31/40')).toEqual(parseExact('9/40'));
    expect(formatExactRussian(subtractExact(addExact('9/2', '7/4'), '5/6'))).toBe('65/12');
    expect(toExactNumber(subtractExact('65/12', 5))).toBeCloseTo(5 / 12, 12);
    expect(toExactNumber(multiplyExact('5/8', 24))).toBe(15);
    expect(toExactNumber(multiplyExact('2/3', 24))).toBe(16);
    expect(exactSum('1/2', '1/3')).toBe('5/6');
    // Задача на перенос между сосудами.
    expect(formatExactRussian(subtractExact('3/5', '1/10'))).toBe('0,5');
    expect(exactSum('7/12', '1/10')).toBe('41/60');
    expect(compareFractions({ numerator: 41, denominator: 60 }, { numerator: 1, denominator: 1 })).toBe(-1);
    // Контрольные десятичные приближения из «Быстрой проверки порядка».
    expect(toExactNumber(parseExact('3/4'))).toBe(0.75);
    expect(11 / 15).toBeCloseTo(0.733, 3);
    expect(toExactNumber(parseExact('7/10'))).toBe(0.7);
  });
});

describe('глава 3 «Отношения меняют масштаб»', () => {
  it('вход в главу: диагностика', () => {
    expect(normalizeRatio(6, 9)).toEqual({ first: 2, second: 3 });
    expect(600 / 4).toBe(150);
    expect(normalizeRatio(3, 5)).toEqual(normalizeRatio(12, 20));
    expect(4 * 200).toBe(800);
    expect(formatExactRussian(parseExact('25/100'))).toBe('0,25');
    expect(percentOf(10, 800)).toBe(80);
    expect(800 + percentOf(10, 800)).toBe(880);
  });

  it('урок 3.1: смысл отношения', () => {
    expect(normalizeRatio(6, 9)).toEqual({ first: 2, second: 3 });
    expect(normalizeRatio(6, 15)).toEqual({ first: 2, second: 5 });
    expect(normalizeRatio(9, 15)).toEqual({ first: 3, second: 5 });
    expect(normalizeRatio(12, 18)).toEqual({ first: 2, second: 3 });
    expect(normalizeRatio(12, 30)).toEqual({ first: 2, second: 5 });
    expect(normalizeQuantityRatio({ value: 2, unit: 'm' }, { value: 50, unit: 'cm' }))
      .toEqual({ first: 4, second: 1 });
    expect(180 / 3).toBe(60);
    // QuickCheck: 30 см к 1,2 м.
    expect(normalizeQuantityRatio({ value: 30, unit: 'cm' }, { value: 1.2, unit: 'm' }))
      .toEqual({ first: 1, second: 4 });
    expect(normalizeRatio(18, 30)).toEqual({ first: 3, second: 5 });
    expect(3 + 5).toBe(8);
    // Практика 1–9.
    expect(normalizeRatio(15, 25)).toEqual({ first: 3, second: 5 });
    expect(normalizeRatio(42, 56)).toEqual({ first: 3, second: 4 });
    expect(normalizeRatio(8, 12)).toEqual({ first: 2, second: 3 });
    expect(normalizeRatio(8, 20)).toEqual({ first: 2, second: 5 });
    expect(normalizeRatio(20, 12)).toEqual({ first: 5, second: 3 });
    expect(normalizeRatio(300, 180)).toEqual({ first: 5, second: 3 });
    expect(normalizeRatio(45, 120)).toEqual({ first: 3, second: 8 });
    expect(normalizeRatio(1500, 600)).toEqual({ first: 5, second: 2 });
    expect(18 / 3).toBe(6);
    expect(formatExactRussian(divideExact(1, 4 + 1))).toBe('0,2');
  });

  it('урок 3.2: равные отношения и пропорции', () => {
    // Краска: 2 : 3 = 8 : 12, белого нужно 12 мерок.
    expect(solveProportion(2, 3, 8, null).value).toEqual({ numerator: 12, denominator: 1 });
    expect(normalizeRatio(8, 12)).toEqual({ first: 2, second: 3 });
    expect(solveProportion(4, 7, null, 21).value).toEqual({ numerator: 12, denominator: 1 });
    expect([4 * 21, 7 * 12]).toEqual([84, 84]);
    expect(formatExactRussian(divideExact(9, 15))).toBe('0,6');
    expect(percentOf(60, 25)).toBe(15);
    expect(toExactNumber(multiplyExact('0.6', 25))).toBe(15);
    // QuickCheck 5 : 8 = 15 : x.
    expect(solveProportion(5, 8, 15, null).value).toEqual({ numerator: 24, denominator: 1 });
    // Практика 1–9.
    expect(solveProportion(3, 4, 12, null).value).toEqual({ numerator: 16, denominator: 1 });
    expect(solveProportion(7, 9, null, 27).value).toEqual({ numerator: 21, denominator: 1 });
    expect(normalizeRatio(18, 24)).toEqual({ first: 3, second: 4 });
    expect(normalizeRatio(14, 21)).toEqual(normalizeRatio(8, 12));
    expect([14 * 12, 21 * 8]).toEqual([168, 168]);
    expect(900 / 6).toBe(150);
    expect(150 * 10).toBe(1500);
    expect(240 / 20).toBe(12);
    expect(12 * 35).toBe(420);
    expect(30 / 5).toBe(6);
    expect(2 * 6).toBe(12);
    expect(520 / 8).toBe(65);
    expect(65 * 13).toBe(845);
    expect(solveProportion(2, 5, null, 20).value).toEqual({ numerator: 8, denominator: 1 });
    expect([3 ** 2, 6 ** 2]).toEqual([9, 36]);
  });

  it('урок 3.3: прямая пропорциональность', () => {
    const cost = (mass: number) => toExactNumber(multiplyExact(180, mass));
    expect([0, 0.5, 1, 2, 3].map(cost)).toEqual([0, 90, 180, 360, 540]);
    expect([[2, 14], [5, 35], [8, 56]].map(([x, y]) => y / x)).toEqual([7, 7, 7]);
    expect(7 * 12).toBe(84);
    // Практика 1–9.
    expect(520 / 4).toBe(130);
    expect(210 / 3).toBe(70);
    expect(toExactNumber(divideExact('1.2', 8))).toBe(0.15);
    expect([0, 2, 6, 10].map((x) => toExactNumber(multiplyExact('2.5', x)))).toEqual([0, 5, 15, 25]);
    expect([[1, 4], [3, 12], [5, 20]].map(([x, y]) => y / x)).toEqual([4, 4, 4]);
    expect([[1, 5], [2, 8], [4, 14]].map(([x, y]) => y / x)).toEqual([5, 4, 3.5]);
    for (const [x, y] of [[1, 5], [2, 8], [4, 14]]) {
      expect(evaluate('3 * x + 2', { x })).toBe(y);
    }
    expect(10 / 4).toBe(2.5);
    expect(toExactNumber(multiplyExact('2.5', 7))).toBe(17.5);
    expect(36 / 3).toBe(12);
    expect(toExactNumber(multiplyExact(12, '7.5'))).toBe(90);
  });

  it('урок 3.4: масштаб', () => {
    expect(normalizeQuantityRatio({ value: 6, unit: 'cm' }, { value: 6, unit: 'm' }))
      .toEqual({ first: 1, second: 100 });
    expect(toExactNumber(multiplyExact('3.6', 50_000))).toBe(180_000);
    expect(convertMetricValue(180_000, 'cm', 'm', 1)).toBe(1800);
    expect(convertMetricValue(180_000, 'cm', 'km', 1)).toBe(1.8);
    expect(convertMetricValue(7.5, 'm', 'cm', 1)).toBe(750);
    expect(750 / 50).toBe(15);
    // QuickCheck 1 : 20 000 и 3,5 см.
    expect(toExactNumber(multiplyExact('3.5', 20_000))).toBe(70_000);
    expect(convertMetricValue(70_000, 'cm', 'm', 1)).toBe(700);
    expect(convertMetricValue(70_000, 'cm', 'km', 1)).toBe(0.7);
    expect(4 * 10).toBe(40);
    // Масштаб длины против масштаба площади.
    expect(rectangleMetrics(20, 20).area).toBe(400);
    expect(rectangleMetrics(2, 2).area).toBe(4);
    // Практика 1–10.
    expect(toExactNumber(multiplyExact('8.5', 100))).toBe(850);
    expect(convertMetricValue(850, 'cm', 'm', 1)).toBe(8.5);
    expect(6 * 25_000).toBe(150_000);
    expect(convertMetricValue(150_000, 'cm', 'km', 1)).toBe(1.5);
    expect(toExactNumber(multiplyExact('4.2', 2_000_000))).toBe(8_400_000);
    expect(convertMetricValue(8_400_000, 'cm', 'km', 1)).toBe(84);
    expect(convertMetricValue(12, 'km', 'cm', 1)).toBe(1_200_000);
    expect(1_200_000 / 200_000).toBe(6);
    expect(convertMetricValue(1.8, 'm', 'cm', 1)).toBe(180);
    expect(180 / 20).toBe(9);
    expect(7 * 5).toBe(35);
    expect([8 * 50, 6 * 50]).toEqual([400, 300]);
    expect(rectangleMetrics(4, 3).area).toBe(12);
    expect(4 * 100_000).toBe(400_000);
    expect(400_000 / 8).toBe(50_000);
    expect(4 ** 2).toBe(16);
    expect(convertMetricValue(2, 'km', 'cm', 1)).toBe(200_000);
  });

  it('урок 3.5: процент — доля из ста', () => {
    expect(formatExactRussian(parseExact('37/100'))).toBe('0,37');
    expect([8, 75, 125].map((p) => toExactNumber(divideExact(p, 100)))).toEqual([0.08, 0.75, 1.25]);
    expect([0.4, 1.07].map((value) => toExactNumber(multiplyExact(value, 100)))).toEqual([40, 107]);
    // Разбор: 35% от 240 тремя путями.
    expect(240 / 100).toBe(2.4);
    expect(toExactNumber(multiplyExact('2.4', 35))).toBe(84);
    expect(percentOf(35, 240)).toBe(84);
    expect(percentOf(30, 240) + percentOf(5, 240)).toBe(84);
    // QuickCheck 15% от 320.
    expect(percentOf(15, 320)).toBe(48);
    expect(percentOf(10, 320) + percentOf(5, 320)).toBe(48);
    expect([percentOf(50, 200), percentOf(50, 80)]).toEqual([100, 40]);
    expect([percentOf(80, 20), percentOf(60, 40)]).toEqual([16, 24]);
    expect(formatExactRussian(divideExact(12, 30))).toBe('0,4');
    // Практика 1–10.
    expect(formatExactRussian(parseExact('35/100'))).toBe('0,35');
    expect(reduceFraction(35, 100)).toEqual({ numerator: 7, denominator: 20 });
    expect(reduceFraction(120, 100)).toEqual({ numerator: 6, denominator: 5 });
    expect([0.09, 0.625, 1.4].map((value) => toExactNumber(multiplyExact(value, 100)))).toEqual([9, 62.5, 140]);
    expect(['1/4', '3/5', '7/8'].map((value) => toExactNumber(multiplyExact(value, 100)))).toEqual([25, 60, 87.5]);
    expect(percentOf(12, 450)).toBe(54);
    expect(percentOf('2.5', 800)).toBe(20);
    expect(percentOf(18, 600)).toBe(108);
    expect(percentOf(75, 28)).toBe(21);
    expect(28 - percentOf(75, 28)).toBe(7);
    expect([percentOf(70, 30), percentOf(60, 40)]).toEqual([21, 24]);
    expect(toExactNumber(multiplyExact(divideExact(18, 48), 100))).toBe(37.5);
    expect(toExactNumber(divideExact(10, 8))).toBe(1.25);
  });

  it('урок 3.6: процентные задачи и изменения', () => {
    expect(baseFromPercent(72, 18)).toBe(400);
    expect(percentOf(18, 400)).toBe(72);
    expect(toExactNumber(multiplyExact(divideExact(68, 80), 100))).toBe(85);
    expect(baseFromPercent(2400, 80)).toBe(3000);
    expect(2400 + percentOf(20, 2400)).toBe(2880);
    // QuickCheck и последовательные коэффициенты.
    expect(toExactNumber(multiplyExact(multiplyExact(1000, '0.8'), '1.2'))).toBe(960);
    expect(toExactNumber(multiplyExact('0.8', '1.2'))).toBe(0.96);
    expect(toExactNumber(multiplyExact(divideExact(50 - 40, 40), 100))).toBe(25);
    // Практика 1–10.
    expect(baseFromPercent(24, 60)).toBe(40);
    expect(toExactNumber(multiplyExact(divideExact(190, 250), 100))).toBe(76);
    expect(baseFromPercent(26, 65)).toBe(40);
    expect(toExactNumber(divideExact(230, '1.15'))).toBe(200);
    expect(toExactNumber(multiplyExact(1800, '1.12'))).toBe(2016);
    expect(toExactNumber(multiplyExact(64, '0.925'))).toBe(59.2);
    expect(toExactNumber(multiplyExact(multiplyExact(5000, '1.1'), '1.2'))).toBe(6600);
    expect(toExactNumber(multiplyExact('1.1', '1.2'))).toBe(1.32);
    expect(toExactNumber(multiplyExact(multiplyExact(2000, '1.25'), '0.8'))).toBe(2000);
    expect(toExactNumber(multiplyExact(divideExact(6, 30), 100))).toBe(20);
    expect([percentOf(50, 200), percentOf(50, 800)]).toEqual([100, 400]);
  });

  it('урок 3.7: практикум «Фестиваль пропорций»', () => {
    // Разбор проекта.
    expect(2 + 5).toBe(7);
    expect(21 / 7).toBe(3);
    expect([2 * 3, 5 * 3]).toEqual([6, 15]);
    expect(21 * 4).toBe(84);
    expect(percentOf(35, 240)).toBe(84);
    // Станция 1.
    expect(normalizeRatio(18, 12)).toEqual({ first: 3, second: 2 });
    expect(normalizeRatio(18, 30)).toEqual({ first: 3, second: 5 });
    expect(toExactNumber(multiplyExact(divideExact(18, 30), 100))).toBe(60);
    expect(solveProportion(7, 9, null, 36).value).toEqual({ numerator: 28, denominator: 1 });
    expect(520 / 8).toBe(65);
    expect(65 * 15).toBe(975);
    expect(convertMetricValue(12, 'm', 'cm', 1) / 200).toBe(6);
    expect(convertMetricValue(8, 'm', 'cm', 1) / 200).toBe(4);
    expect(toExactNumber(divideExact(540, '1.2'))).toBe(450);
    // Станция 2.
    expect(135 / 3).toBe(45);
    expect(210 / 5).toBe(42);
    expect(toExactNumber(multiplyExact('7.5', 40_000))).toBe(300_000);
    expect(convertMetricValue(300_000, 'cm', 'km', 1)).toBe(3);
    expect(baseFromPercent(1360, 85)).toBe(1600);
    expect(40 / (5 + 3)).toBe(5);
    expect([5 * 5, 3 * 5]).toEqual([25, 15]);
    expect(percentOf(80, 25) + percentOf(60, 15)).toBe(29);
    expect(toExactNumber(multiplyExact(divideExact(29, 40), 100))).toBe(72.5);
    expect(toExactNumber(multiplyExact(multiplyExact(500, '1.2'), '0.8'))).toBe(480);
    expect(toExactNumber(multiplyExact(divideExact(500 - 480, 500), 100))).toBe(4);
    // Станция 3.
    expect(normalizeRatio(2, 2 + 7)).toEqual({ first: 2, second: 9 });
    expect([[1, 5], [2, 8], [4, 14]].map(([x, y]) => y / x)).toEqual([5, 4, 3.5]);
    expect(rectangleMetrics(3, 3).area).toBe(9);
    expect(3 * 100).toBe(300);
    expect(rectangleMetrics(3, 3).area).toBe(9);
    expect(52 - 40).toBe(12);
    expect(toExactNumber(multiplyExact(divideExact(12, 40), 100))).toBe(30);
    // Финальная самопроверка: доля A равна 2/5, а не 2/3.
    expect(normalizeRatio(2, 2 + 3)).toEqual({ first: 2, second: 5 });
    expect(100 - 25).toBe(75);
    expect(100 ** 2).toBe(10_000);
  });
});

describe('глава 4 «Ниже нуля: числа с направлением»', () => {
  it('вход в главу: диагностика', () => {
    expect(compareSigned(-2, 3)).toBe(-1);
    expect(addSigned(-6, 4)).toBe(-2);
    expect(addSigned(-2, -3)).toBe(-5);
    expect(absoluteValue(subtractSigned(-3, 2))).toBe(5);
    expect(quadrantOf(-2, 3)).toBe(2);
  });

  it('урок 4.1: координатная прямая', () => {
    expect(formatExactRussian(parseExact('-1.75'))).toBe('−1,75');
    expect(compareSigned(-2, -1.75)).toBe(-1);
    expect(compareSigned(-1.75, -1)).toBe(-1);
    // QuickCheck: −3,2 лежит между −4 и −3.
    expect(compareSigned(-4, -3.2)).toBe(-1);
    expect(compareSigned(-3.2, -3)).toBe(-1);
    expect(-(-6)).toBe(6);
    expect(addSigned(-4, 7)).toBe(3);
    // Практика 1–10.
    expect([-3, -0.5, 0, 2.5].every((value, index, list) => index === 0 || compareSigned(list[index - 1], value) === -1))
      .toBe(true);
    expect(-6.2).toBe(-1 * 6.2);
    expect(-(-0.75)).toBe(0.75);
    expect(-9 * -1).toBe(9);
    expect(compareSigned(-3, -2.7)).toBe(-1);
    expect(compareSigned(-2.7, -2)).toBe(-1);
    expect(addSigned(2.5, -4)).toBe(-1.5);
    expect(addSigned(-18, 23)).toBe(5);
    expect(-(-2.3)).toBe(2.3);
  });

  it('урок 4.2: модуль и сравнение', () => {
    expect(absoluteValue(-4.5)).toBe(4.5);
    expect(absoluteValue(4.5)).toBe(4.5);
    expect(absoluteValue(0)).toBe(0);
    expect(compareSigned(-1.5, -3.5)).toBe(1);
    expect(compareSigned(-2.8, -2.35)).toBe(-1);
    // QuickCheck: −5/6 < −3/4.
    expect(compareSigned(-5 / 6, -3 / 4)).toBe(-1);
    expect(absoluteValue(subtractSigned(-1.2, 3.5))).toBe(4.7);
    expect(absoluteValue(subtractSigned(-1.2, -3.5))).toBe(2.3);
    // Практика 1–10.
    expect(absoluteValue(-8)).toBe(8);
    expect(absoluteValue(3.6)).toBe(3.6);
    expect(absoluteValue(-7 / 5)).toBe(1.4);
    expect([4.2, -4.2].map(absoluteValue)).toEqual([4.2, 4.2]);
    expect([-3.1, -2, -0.75, 0.2].every((value, index, list) => index === 0 || compareSigned(list[index - 1], value) === -1))
      .toBe(true);
    expect(compareSigned(-5 / 6, -0.8)).toBe(-1);
    expect(absoluteValue(subtractSigned(-2.5, 4))).toBe(6.5);
    expect(absoluteValue(subtractSigned(-1.2, -4.7))).toBe(3.5);
    expect([addSigned(2, -3), addSigned(2, 3)]).toEqual([-1, 5]);
  });

  it('урок 4.3: сложение чисел со знаком', () => {
    expect(addSigned(-6, 4)).toBe(-2);
    expect(addSigned(-6, -4)).toBe(-10);
    expect(addSigned(4, 7)).toBe(11);
    expect(addSigned(-4, -7)).toBe(-11);
    expect(addSigned(-2.5, -1.2)).toBe(-3.7);
    expect(addSigned(-5, 2)).toBe(-3);
    expect(addSigned(-2, 5)).toBe(3);
    expect(addSigned(-2.4, 3.1)).toBe(0.7);
    expect(formatExactRussian(addExact('-5/6', '1/3'))).toBe('−0,5');
    // QuickCheck −3,5 + 1,2.
    expect(addSigned(-3.5, 1.2)).toBe(-2.3);
    expect(addSigned(-7, 10)).toBe(3);
    expect(addSigned(10, -7)).toBe(3);
    // Практика 1–10.
    expect(addSigned(-7, -5)).toBe(-12);
    expect(addSigned(9, -14)).toBe(-5);
    expect(addSigned(-6, 11)).toBe(5);
    expect(addSigned(-1.25, -0.75)).toBe(-2);
    expect(addSigned(-8.5, 12)).toBe(3.5);
    expect(addSigned(-450, 300)).toBe(-150);
    expect(subtractSigned(5, -3)).toBe(8);
    expect(addSigned(addSigned(-2.7, 0), 2.7)).toBe(0);
  });

  it('урок 4.4: вычитание чисел со знаком', () => {
    expect(subtractSigned(-2, -7)).toBe(5);
    expect(subtractSigned(-2, -5)).toBe(3);
    expect(subtractSigned(6, -2)).toBe(8);
    expect(subtractSigned(-4, 3)).toBe(-7);
    expect(subtractSigned(-3, -8)).toBe(5);
    expect(subtractSigned(-1.5, -2.25)).toBe(0.75);
    expect(formatExactRussian(subtractExact('2/3', '-1/6'))).toBe('5/6');
    // QuickCheck −4 − (−6).
    expect(subtractSigned(-4, -6)).toBe(2);
    expect(subtractSigned(5, -2)).toBe(7);
    expect(subtractSigned(-2, 5)).toBe(-7);
    expect(absoluteValue(subtractSigned(5, -2))).toBe(absoluteValue(subtractSigned(-2, 5)));
    // Практика 1–10.
    expect(subtractSigned(7, 12)).toBe(-5);
    expect(subtractSigned(-3, 8)).toBe(-11);
    expect(subtractSigned(5, -4)).toBe(9);
    expect(subtractSigned(-6, -2)).toBe(-4);
    expect(subtractSigned(-1.2, -3.7)).toBe(2.5);
    expect(formatExactRussian(subtractExact('-3/4', '1/2'))).toBe('−1,25');
    expect(subtractSigned(-2.5, -8.5)).toBe(6);
    expect(subtractSigned(4, -3)).toBe(7);
    expect(subtractSigned(1, 2)).toBe(-1);
    expect(subtractSigned(-1, -2)).toBe(1);
  });

  it('урок 4.5: умножение и деление', () => {
    expect([3, 2, 1, 0].map((factor) => multiplySigned(factor, -2))).toEqual([-6, -4, -2, 0]);
    expect(multiplySigned(-1, -2)).toBe(2);
    expect(multiplySigned(-2, -2)).toBe(4);
    expect(multiplySigned(-1.5, 4)).toBe(-6);
    expect(toExactNumber(multiplyExact('-3/5', -10))).toBe(6);
    expect(divideSigned(-12, 4)).toBe(-3);
    expect(divideSigned(-12, -3)).toBe(4);
    expect(formatExactRussian(divideExact('5/6', '-5/12'))).toBe('−2');
    expect(formatExactRussian(multiplyExact(-2, '-5/12'))).toBe('5/6');
    // QuickCheck (−2,5)·(−4).
    expect(multiplySigned(-2.5, -4)).toBe(10);
    expect(addSigned(-4, -3)).toBe(-7);
    // Практика 1–12.
    expect(multiplySigned(-7, 3)).toBe(-21);
    expect(multiplySigned(-6, -5)).toBe(30);
    expect(multiplySigned(0, -19)).toBe(0);
    expect(multiplySigned(-2.4, 1.5)).toBe(-3.6);
    expect(formatExactRussian(multiplyExact('-3/4', '-8/9'))).toBe('2/3');
    expect(divideSigned(-42, 7)).toBe(-6);
    expect(divideSigned(-48, -6)).toBe(8);
    expect(divideSigned(3.5, -0.5)).toBe(-7);
    expect(formatExactRussian(divideExact('-5/6', '5/12'))).toBe('−2');
    expect(divideSigned(28, -4)).toBe(-7);
    expect(multiplySigned(-1.5, 6)).toBe(-9);
    expect(multiplySigned(multiplySigned(-2, -3), 5)).toBe(30);
  });

  it('урок 4.6: координатная плоскость', () => {
    // Маршрут из (−3;2).
    expect(quadrantOf(2, 3)).toBe(1);
    expect(quadrantOf(-2, 3)).toBe(2);
    expect(quadrantOf(-2, -3)).toBe(3);
    expect(quadrantOf(2, -3)).toBe(4);
    expect(quadrantOf(0, -4)).toBeNull();
    expect(quadrantOf(0.75, -2.5)).toBe(4);
    expect(reflectPoint({ x: -3, y: 2 }, 'y')).toEqual({ x: 3, y: 2 });
    expect(reflectPoint({ x: -3, y: 2 }, 'x')).toEqual({ x: -3, y: -2 });
    expect(reflectPoint({ x: -3, y: 2 }, 'origin')).toEqual({ x: 3, y: -2 });
    expect(absoluteValue(subtractSigned(-2, 4))).toBe(6);
    expect(absoluteValue(subtractSigned(-1, 2.5))).toBe(3.5);
    // Практика 1–10.
    expect([addSigned(-3, 5), addSigned(2, -4)]).toEqual([2, -2]);
    expect(reflectPoint({ x: -2, y: 3 }, 'y')).toEqual({ x: 2, y: 3 });
    expect(reflectPoint({ x: -2, y: 3 }, 'x')).toEqual({ x: -2, y: -3 });
    expect(reflectPoint({ x: -2, y: 3 }, 'origin')).toEqual({ x: 2, y: -3 });
    expect(absoluteValue(subtractSigned(-4, 2.5))).toBe(6.5);
    // Прямоугольник (−2;−1), (3;−1), (3;2), (−2;2).
    expect(polygonArea([{ x: -2, y: -1 }, { x: 3, y: -1 }, { x: 3, y: 2 }, { x: -2, y: 2 }]))
      .toEqual(parseExact(15));
    expect(rectangleMetrics(5, 3)).toEqual({ perimeter: 16, area: 15 });
    expect(quadrantOf(-1, 4)).toBe(2);
    expect(quadrantOf(4, -1)).toBe(4);
  });

  it('урок 4.7: практикум «Полярная станция»', () => {
    // Тренировочный маршрут.
    expect(addSigned(addSigned(-4, 7), -3.5)).toBe(-0.5);
    expect(addSigned(addSigned(-2, 5), -4.5)).toBe(-1.5);
    // QuickCheck: с 2 на −5.
    expect(subtractSigned(-5, 2)).toBe(-7);
    expect(absoluteValue(subtractSigned(-5, 2))).toBe(7);
    // Разбор смены.
    expect(addSigned(-12.5, 7.8)).toBe(-4.7);
    expect(addSigned(-4.7, -3.6)).toBe(-8.3);
    expect(subtractSigned(-8.3, -12.5)).toBe(4.2);
    expect(subtractSigned(7.8, 3.6)).toBe(4.2);
    // Станция 1.
    expect([-3, -2.5, -0.75, 0, 0.5].every((value, index, list) => index === 0 || compareSigned(list[index - 1], value) === -1))
      .toBe(true);
    expect(absoluteValue(-4.2)).toBe(4.2);
    expect([subtractSigned(-1, 2.5), addSigned(-1, 2.5)]).toEqual([-3.5, 1.5]);
    expect(subtractSigned(-1.9, -6.8)).toBe(4.9);
    // Станция 2.
    expect(addSigned(-12.5, 8.75)).toBe(-3.75);
    expect(subtractSigned(-3, 4.5)).toBe(-7.5);
    expect(multiplySigned(-1.25, 8)).toBe(-10);
    expect(divideSigned(-18, -2.25)).toBe(8);
    expect(multiplySigned(8, -2.25)).toBe(-18);
    // Станция 3.
    expect([addSigned(-4, 6), subtractSigned(1, 3.5)]).toEqual([2, -2.5]);
    expect(quadrantOf(2, -2.5)).toBe(4);
    expect(reflectPoint({ x: -2.5, y: 3 }, 'y')).toEqual({ x: 2.5, y: 3 });
    expect(reflectPoint({ x: -2.5, y: 3 }, 'origin')).toEqual({ x: 2.5, y: -3 });
    expect(absoluteValue(subtractSigned(-3.5, 4))).toBe(7.5);
    expect(multiplySigned(1.5, 4)).toBe(6);
    expect(addSigned(addSigned(-9, 6), -5.5)).toBe(-8.5);
    expect(subtractSigned(-8.5, -9)).toBe(0.5);
  });
});

describe('глава 5 «Буквы, выражения и формулы»', () => {
  it('вход в главу: диагностика', () => {
    expect(evaluate('2 * a + 1', { a: 3 })).toBe(7);
    expect(evaluate('3 * (x + 2)', { x: 4 })).toBe(18);
    expect(evaluate('3 * x + 6', { x: 4 })).toBe(18);
    expect(evaluate('5 + 2 * 7')).toBe(19);
  });

  it('урок 5.1: буква как число', () => {
    expect(evaluate('-a', { a: -4 })).toBe(4);
    expect(evaluate('a + 6', { a: -2 })).toBe(4);
    expect(evaluate('4 * a', { a: -2 })).toBe(-8);
    expect(evaluate('-a', { a: -2 })).toBe(2);
    expect([2, 10, -5].map((a) => evaluate('a + 3', { a }))).toEqual([5, 13, -2]);
    // QuickCheck: −a + 2 при a = −3.
    expect(evaluate('-a + 2', { a: -3 })).toBe(5);
    // Практика 4–11.
    expect(evaluate('a + 9', { a: 4 })).toBe(13);
    expect(evaluate('6 * m', { m: -1.5 })).toBe(-9);
    expect([evaluate('-c', { c: 8 }), evaluate('-c', { c: -8 })]).toEqual([-8, 8]);
    expect(evaluate('2 * p - 1', { p: 3 })).toBe(5);
    expect(evaluate('-k', { k: 0 })).toBe(0);
    expect(evaluate('-t', { t: 4 })).toBe(-4);
    expect(evaluate('5 * q + 6', { q: 3 })).toBe(21);
    expect([0, 2, -5].map((r) => evaluate('r + 4', { r }))).toEqual([4, 6, -1]);
  });

  it('урок 5.2: выражение как план действий', () => {
    expect(evaluate('2 * (x + 3) - 5', { x: -1 })).toBe(-1);
    expect(evaluate('2 * (x + 3) - 5', { x: 4 })).toBe(9);
    expect(evaluate('2 * x + 3 - 5', { x: 4 })).toBe(6);
    // QuickCheck 3(x + 4) − 1 при x = −2.
    expect(evaluate('3 * (x + 4) - 1', { x: -2 })).toBe(5);
    // Практика 5–11.
    expect(evaluate('3 * (b - 2) + 4', { b: 5 })).toBe(13);
    expect(evaluate('2 * (x + 3) - 5', { x: -4 })).toBe(-7);
    expect(evaluate('(n + 8) / 2', { n: -2 })).toBe(3);
    expect([evaluate('3 * (x + 1)', { x: 2 }), evaluate('3 * x + 1', { x: 2 })]).toEqual([9, 7]);
    expect(evaluate('5 * k + 80', { k: 100 })).toBe(580);
    expect(evaluate('2 * (a + 4)', { a: 3 })).toBe(14);
    expect([evaluate('x + 2', { x: 0 }), evaluate('3 * x + 2', { x: 0 })]).toEqual([2, 2]);
    expect([evaluate('x + 2', { x: 1 }), evaluate('3 * x + 2', { x: 1 })]).toEqual([3, 5]);
  });

  it('урок 5.3: подстановка и таблица значений', () => {
    expect([-2, -1, 0, 1, 2, 3].map((x) => evaluate('3 * x - 2', { x })))
      .toEqual([-8, -5, -2, 1, 4, 7]);
    expect(evaluate('2 * a - 3 * b', { a: -1.5, b: 2 })).toBe(-9);
    expect(evaluate('12 / (n - 1)', { n: 3 })).toBe(6);
    expect(() => evaluate('12 / (n - 1)', { n: 1 })).toThrow();
    // QuickCheck 2x − 3 при x = −1.
    expect(evaluate('2 * x - 3', { x: -1 })).toBe(-5);
    expect(evaluate('5 - x', { x: -2 })).toBe(7);
    // Практика 1–12.
    expect(evaluate('4 * x + 1', { x: 2 })).toBe(9);
    expect(evaluate('4 * x + 1', { x: -2 })).toBe(-7);
    expect(evaluate('5 - a', { a: -3 })).toBe(8);
    expect(evaluate('x * x - 1', { x: -4 })).toBe(15);
    expect(evaluate('2 * p + q', { p: 1.5, q: -2 })).toBe(1);
    expect([-2, -1, 0, 1, 2].map((x) => evaluate('2 * x - 3', { x }))).toEqual([-7, -5, -3, -1, 1]);
    expect(evaluate('5 * (x + 1) + 4', { x: 0 }) - evaluate('5 * x + 4', { x: 0 })).toBe(5);
    expect(evaluate('18 / (m + 2)', { m: 1 })).toBe(6);
    expect(() => evaluate('7 / (k - 4)', { k: 4 })).toThrow();
    expect(evaluate('-2 * x', { x: 3 })).toBe(-6);
    expect([-2, -1, 0, 1, 2].map((a) => evaluate('a * a', { a }))).toEqual([4, 1, 0, 1, 4]);
  });

  it('урок 5.4: распределительное свойство', () => {
    expect(equivalentLinearExpressions('3 * (x + 2)', '3 * x + 6')).toBe(true);
    expect(equivalentLinearExpressions('-2 * (x + 5)', '-2 * x - 10')).toBe(true);
    expect([evaluate('-2 * (x + 5)', { x: 3 }), evaluate('-2 * x - 10', { x: 3 })]).toEqual([-16, -16]);
    expect(equivalentLinearExpressions('-3 * (x - 2)', '-3 * x + 6')).toBe(true);
    expect(equivalentLinearExpressions('8 * x + 12', '4 * (2 * x + 3)')).toBe(true);
    expect(17 * 6 + 3 * 6).toBe(120);
    expect((17 + 3) * 6).toBe(120);
    expect(equivalentLinearExpressions('5 * (x + 2)', '5 * x + 2')).toBe(false);
    // Практика 1–12.
    expect(equivalentLinearExpressions('4 * (x + 3)', '4 * x + 12')).toBe(true);
    expect(equivalentLinearExpressions('5 * (a - 2)', '5 * a - 10')).toBe(true);
    expect(equivalentLinearExpressions('-2 * (y + 6)', '-2 * y - 12')).toBe(true);
    expect(equivalentLinearExpressions('-4 * (m - 3)', '-4 * m + 12')).toBe(true);
    expect(equivalentLinearExpressions('7 * (p + 5)', '7 * p + 35')).toBe(true);
    expect(equivalentLinearExpressions('6 * x + 18', '6 * (x + 3)')).toBe(true);
    expect(equivalentLinearExpressions('15 * a - 10', '5 * (3 * a - 2)')).toBe(true);
    expect(38 * 7 + 62 * 7).toBe(700);
    expect([evaluate('3 * (x - 4)', { x: -2 }), evaluate('3 * x - 12', { x: -2 })]).toEqual([-18, -18]);
    expect(equivalentLinearExpressions('-5 * (a + 2)', '-5 * a - 10')).toBe(true);
    expect(equivalentLinearExpressions('-5 * (a + 2)', '-5 * a + 10')).toBe(false);
    expect(equivalentLinearExpressions('2 * (x + 5)', '2 * x + 5')).toBe(false);
  });

  it('урок 5.5: подобные слагаемые', () => {
    expect(equivalentLinearExpressions('3 * x + 5 * x', '8 * x')).toBe(true);
    expect(equivalentLinearExpressions('3 * x - 2 * y - 5 * x + 4 + 7 * y - 1', '-2 * x + 5 * y + 3')).toBe(true);
    expect(evaluate('3 * x - 2 * y - 5 * x + 4 + 7 * y - 1', { x: 2, y: -1 })).toBe(-6);
    expect(evaluate('-2 * x + 5 * y + 3', { x: 2, y: -1 })).toBe(-6);
    expect(equivalentLinearExpressions('6 * a - 4 + 3 * a + 9', '9 * a + 5')).toBe(true);
    expect([evaluate('6 * a - 4 + 3 * a + 9', { a: -2 }), evaluate('9 * a + 5', { a: -2 })]).toEqual([-13, -13]);
    // QuickCheck 4a − 7 − 2a + 3.
    expect(equivalentLinearExpressions('4 * a - 7 - 2 * a + 3', '2 * a - 4')).toBe(true);
    expect(evaluate('3 * x + 4 * y', { x: 2, y: 10 })).toBe(46);
    expect([evaluate('7 * x', { x: 2 }), evaluate('7 * y', { y: 10 })]).toEqual([14, 70]);
    expect([evaluate('x', { x: 3 }), evaluate('x * x', { x: 3 })]).toEqual([3, 9]);
    expect(equivalentLinearExpressions('2 * (x + 3) + 5 * x', '7 * x + 6')).toBe(true);
    // Практика 3–12.
    expect(equivalentLinearExpressions('8 * x + 3 * x', '11 * x')).toBe(true);
    expect(equivalentLinearExpressions('7 * y - 10 * y', '-3 * y')).toBe(true);
    expect(equivalentLinearExpressions('4 * a + 6 - 2 * a + 5', '2 * a + 11')).toBe(true);
    expect(equivalentLinearExpressions('3 * x - 2 * y + 5 * x + 7 * y', '8 * x + 5 * y')).toBe(true);
    expect(equivalentLinearExpressions('-m + 4 * m - 3', '3 * m - 3')).toBe(true);
    expect(equivalentLinearExpressions('2 * (p + 4) + 3 * p', '5 * p + 8')).toBe(true);
    expect([evaluate('5 * x + 2', { x: 1 }), evaluate('7 * x', { x: 1 })]).toEqual([7, 7]);
    expect([evaluate('5 * x + 2', { x: 2 }), evaluate('7 * x', { x: 2 })]).toEqual([12, 14]);
    expect([evaluate('6 * a - 2 * a + 5', { a: -3 }), evaluate('4 * a + 5', { a: -3 })]).toEqual([-7, -7]);
    expect(equivalentLinearExpressions('5 * x - 3 * x + 4', '2 * x + 4')).toBe(true);
    expect(equivalentLinearExpressions('3 * a + 2 + a + 5 + 2 * a', '6 * a + 7')).toBe(true);
  });

  it('урок 5.6: формулы и модели', () => {
    expect(toExactNumber(evaluateFormulaPreset('taxi', { f: 150, r: 35, x: 8 }))).toBe(430);
    expect([0, 1, 3, 5, 8].map((x) => toExactNumber(evaluateFormulaPreset('taxi', { f: 150, r: 35, x }))))
      .toEqual([150, 185, 255, 325, 430]);
    expect(toExactNumber(evaluateFormulaPreset('perimeter', { a: 4.5, b: 2 }))).toBe(13);
    expect(rectangleMetrics(4.5, 2).perimeter).toBe(13);
    expect(toExactNumber(evaluateFormulaPreset('taxi', { f: 150, r: 35, x: 0 }))).toBe(150);
    // QuickCheck: 250 + 40m.
    expect(evaluate('250 + 40 * m', { m: 3 })).toBe(370);
    expect(evaluate('120 + q * n', { q: 28, n: 6 })).toBe(288);
    // Практика 1–9.
    expect(toExactNumber(evaluateFormulaPreset('taxi', { f: 150, r: 35, x: 6 }))).toBe(360);
    expect(evaluate('300 + 120 * h', { h: 2.5 })).toBe(600);
    expect([1, 2, 4].map((a) => toExactNumber(evaluateFormulaPreset('perimeter', { a, b: 3 })))).toEqual([8, 10, 14]);
    expect([0, 20].map((c) => evaluate('1.8 * c + 32', { c }))).toEqual([32, 68]);
    expect([evaluate('5 * x', { x: 0 }), evaluate('40 + 5 * x', { x: 0 })]).toEqual([0, 40]);
    expect(evaluate('50 + 8 * n', { n: 12 })).toBe(146);
    expect(evaluate('45 * n + 20', { n: 1 })).toBe(65);
    expect(evaluate('45 * n + 20', { n: 2 })).toBe(110);
    expect(evaluate('65 * n', { n: 2 })).toBe(130);
  });

  it('урок 5.7: практикум «Модель экспедиции»', () => {
    expect(toExactNumber(evaluateFormulaPreset('expedition-cost', { n: 12 }))).toBe(4680);
    expect(5400 - 4680).toBe(720);
    expect(720 / 240).toBe(3);
    expect(toExactNumber(evaluateFormulaPreset('expedition-cost', { n: 15 }))).toBe(5400);
    expect(toExactNumber(evaluateFormulaPreset('expedition-cost', { n: 16 }))).toBe(5640);
    // Станция 2.
    expect(toExactNumber(evaluateFormulaPreset('expedition-cost', { n: 18 }))).toBe(6120);
    expect([-2, 0, 3].map((x) => evaluate('4 * x - 1', { x }))).toEqual([-9, -1, 11]);
    expect(equivalentLinearExpressions('3 * (n + 4) + 2 * n', '5 * n + 12')).toBe(true);
    expect(equivalentLinearExpressions('120 * a + 80 + 30 * a - 25', '150 * a + 55')).toBe(true);
    // Станция 3.
    expect([4, 8, 12].map((n) => evaluate('1200 + 300 * n', { n }))).toEqual([2400, 3600, 4800]);
    expect([4, 8, 12].map((n) => evaluate('2400 + 200 * n', { n }))).toEqual([3200, 4000, 4800]);
    expect(4200 - 1200).toBe(3000);
    expect(3000 / 300).toBe(10);
    expect(evaluate('1200 + 300 * n', { n: 10 })).toBe(4200);
    expect(evaluate('60 * (t / 60)', { t: 45 })).toBe(45);
    expect(equivalentLinearExpressions('200 * n + 2 * 250', '200 * n + 500')).toBe(true);
  });
});

describe('глава 6 «Фигуры, меры и пространство»', () => {
  it('вход в главу: диагностика', () => {
    expect(classifyAngle(120)).toBe('obtuse');
    expect(circleMeasures(5).diameter).toBe(10);
    expect(reflectPoint({ x: 2, y: -3 }, 'origin')).toEqual({ x: -2, y: 3 });
    expect(cuboidMetrics(4, 3, 2).volume).toBe(24);
    expect(rectangleMetrics(4, 4).area).toBe(16);
    expect(cuboidMetrics(4, 4, 4).volume).toBe(64);
  });

  it('урок 6.1: прямые и расстояния', () => {
    // Маршрут робота: 5 вправо, 3 вверх, 2 влево.
    expect(5 + 3 + 2).toBe(10);
    expect([addSigned(0, 5 - 2), addSigned(0, 3)]).toEqual([3, 3]);
    // Практика 5–8.
    expect(absoluteValue(5)).toBe(5);
    expect(absoluteValue(subtractSigned(4, -2))).toBe(6);
    expect(5 + 3 + 2 + 1).toBe(11);
    expect([addSigned(5, -2), addSigned(3, -1)]).toEqual([3, 2]);
    expect(absoluteValue(subtractSigned(4, -2)) + absoluteValue(subtractSigned(-3, 1))).toBe(10);
  });

  it('урок 6.2: углы и транспортир', () => {
    expect(classifyAngle(17)).toBe('acute');
    expect(classifyAngle(90)).toBe('right');
    expect(classifyAngle(146)).toBe('obtuse');
    expect(classifyAngle(180)).toBe('straight');
    expect(classifyAngle(125)).toBe('obtuse');
    expect(180 - 125).toBe(55);
    // Практика 4–8.
    expect(180 - 40).toBe(140);
    expect(180 - 48).toBe(132);
    expect(90 - 35).toBe(55);
    expect(2 * 30).toBe(60);
    expect(sectorAngle(2, 12)).toBe(60);
  });

  it('урок 6.3: треугольники и четырёхугольники', () => {
    // Контрпример: диагонали (0;0)–(3;2) и (4;0)–(0;2) не равны.
    const diagonalOne = (3 - 0) ** 2 + (2 - 0) ** 2;
    const diagonalTwo = (0 - 4) ** 2 + (2 - 0) ** 2;
    expect(diagonalOne).toBe(13);
    expect(diagonalTwo).toBe(20);
    expect(diagonalOne).not.toBe(diagonalTwo);
    expect([25, 65, 90].map(classifyAngle)).toEqual(['acute', 'acute', 'right']);
    expect([30, 35, 115].map(classifyAngle)).toEqual(['acute', 'acute', 'obtuse']);
    expect([40, 60, 80].every((angle) => classifyAngle(angle) === 'acute')).toBe(true);
    expect(40 + 60 + 80).toBe(180);
    expect(25 + 65 + 90).toBe(180);
    expect(30 + 35 + 115).toBe(180);
    // Неравенство треугольника: набор 2, 3 и 10 см и зазор 5 см на чертеже.
    expect(triangleInequality(2, 3, 10).shorterSum).toBe(5);
    expect(triangleInequality(2, 3, 10).longest).toBe(10);
    expect(canFormTriangle(2, 3, 10)).toBe(false);
    expect(10 - 2 - 3).toBe(5);
    // Таблица проверок: 5+5=10>8; 6+7=13>12; 4+5=9=9; 2+3=5<10.
    expect(triangleInequality(5, 5, 8)).toMatchObject({ shorterSum: 10, longest: 8, possible: true });
    expect(triangleInequality(6, 7, 12)).toMatchObject({ shorterSum: 13, longest: 12, possible: true });
    expect(triangleInequality(4, 5, 9)).toMatchObject({ shorterSum: 9, longest: 9, degenerate: true });
    // QuickCheck: треугольник складывается только из 5, 6 и 9 см.
    expect([canFormTriangle(4, 5, 9), canFormTriangle(5, 6, 9), canFormTriangle(2, 3, 10)])
      .toEqual([false, true, false]);
    expect(5 + 6).toBe(11);
    // Чертёж параллелограмма: A(0;0), B(6;0), C(9;4), D(3;4).
    const parallelogram = [
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 9, y: 4 }, { x: 3, y: 4 },
    ] as const;
    expect(parallelogramFourthVertex(parallelogram[0], parallelogram[1], parallelogram[2]))
      .toEqual(parallelogram[3]);
    const parallelogramFacts = inspectQuadrilateral(parallelogram);
    expect(parallelogramFacts.parallelPairs).toBe(2);
    expect(parallelogramFacts.rightAngles).toBe(0);
    expect(parallelogramFacts.diagonalsBisectEachOther).toBe(true);
    expect(parallelogramFacts.equalDiagonals).toBe(false);
    // Противоположные стороны 6 см и 5 см; диагонали пересекаются в (4,5; 2).
    expect(Math.hypot(6 - 0, 0 - 0)).toBe(6);
    expect(Math.hypot(9 - 3, 4 - 4)).toBe(6);
    expect(Math.hypot(3 - 0, 4 - 0)).toBe(5);
    expect(Math.hypot(9 - 6, 4 - 0)).toBe(5);
    expect(segmentMidpoint(parallelogram[0], parallelogram[2])).toEqual({ x: 4.5, y: 2 });
    expect(segmentMidpoint(parallelogram[1], parallelogram[3])).toEqual({ x: 4.5, y: 2 });
    // Практика 12–13.
    expect([canFormTriangle(2, 3, 10), canFormTriangle(5, 5, 8), canFormTriangle(4, 5, 9)])
      .toEqual([false, true, false]);
    expect(parallelogramLayout(7, 4, 65).sides).toEqual([7, 4, 7, 4]);
    expect(parallelogramLayout(7, 4, 65).perimeter).toBe(22);
    expect(2 * (7 + 4)).toBe(22);
  });

  it('урок 6.4: периметр и площадь', () => {
    // Разбор: из 6×4 вырезали 2×1.
    expect(rectangleMetrics(6, 4).area - rectangleMetrics(2, 1).area).toBe(22);
    const lShapeSmall = [
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 0, y: 4 },
    ];
    expect(polygonArea(lShapeSmall)).toEqual(parseExact(22));
    expect(orthogonalPerimeter(lShapeSmall)).toEqual(parseExact(20));
    expect(rectangleMetrics(6, 4).perimeter).toBe(20);
    expect(convertMetricValue(1, 'm', 'cm', 2)).toBe(10_000);
    // QuickCheck: 3 м × 200 см.
    expect(convertMetricValue(200, 'cm', 'm', 1)).toBe(2);
    expect(rectangleMetrics(3, 2).area).toBe(6);
    // Практика 1–10.
    expect(rectangleMetrics(8, 3)).toEqual({ perimeter: 22, area: 24 });
    expect(rectangleMetrics(5, 5)).toEqual({ perimeter: 20, area: 25 });
    expect(rectangleMetrics(2, 0.5)).toEqual({ perimeter: 5, area: 1 });
    expect(rectangleMetrics(6, 3)).toEqual({ perimeter: 18, area: 18 });
    expect(rectangleMetrics(1, 12).perimeter).toBe(26);
    expect(rectangleMetrics(3, 4).perimeter).toBe(14);
    expect(convertMetricValue(25_000, 'cm', 'm', 2)).toBe(2.5);
    expect([17, 17 + 6 / 2, 17 + 6]).toEqual([17, 20, 23]);
    expect(rectangleMetrics(6, 4).area / rectangleMetrics(0.5, 0.5).area).toBe(96);
    expect(rectangleMetrics(6, 8).perimeter / rectangleMetrics(3, 4).perimeter).toBe(2);
    expect(rectangleMetrics(6, 8).area / rectangleMetrics(3, 4).area).toBe(4);
  });

  it('урок 6.5: окружность и круг', () => {
    const flowerbed = circleMeasures(3);
    expect(flowerbed.circumferencePiCoefficient).toBe(6);
    expect(flowerbed.areaPiCoefficient).toBe(9);
    expect(approximatePiMultiple(6, '3.14')).toBe(18.84);
    expect(approximatePiMultiple(9, '3.14')).toBe(28.26);
    // QuickCheck: диаметр 10 см.
    expect(circleMeasures(5).circumferencePiCoefficient).toBe(10);
    expect(approximatePiMultiple(10, '3.14')).toBe(31.4);
    // Практика 2–11.
    expect(circleMeasures(4).diameter).toBe(8);
    expect(15 / 2).toBe(7.5);
    expect(toExactNumber(divideExact('31.5', 10))).toBe(3.15);
    expect(approximatePiMultiple(0.7, '3.14')).toBe(2.198);
    const tabletop = circleMeasures(0.6);
    expect(tabletop.areaPiCoefficient).toBe(0.36);
    expect(approximatePiMultiple(0.36, '3.14')).toBe(1.1304);
    expect(circleMeasures(6).circumferencePiCoefficient / circleMeasures(3).circumferencePiCoefficient).toBe(2);
    expect(circleMeasures(6).areaPiCoefficient / circleMeasures(3).areaPiCoefficient).toBe(4);
    const bigCircle = circleMeasures(7);
    expect(approximatePiMultiple(bigCircle.circumferencePiCoefficient, '22/7')).toBe(44);
    expect(approximatePiMultiple(bigCircle.areaPiCoefficient, '22/7')).toBe(154);
    expect(circleMeasures(3.5).diameter).toBe(7);
  });

  it('урок 6.6: симметрия', () => {
    // Центр O(1;−1) — середина отрезка A(−2;4)A′.
    expect({ x: addSigned(1, 1 - -2), y: addSigned(-1, -1 - 4) }).toEqual({ x: 4, y: -6 });
    // QuickCheck A(−3;2) относительно начала координат.
    expect(reflectPoint({ x: -3, y: 2 }, 'origin')).toEqual({ x: 3, y: -2 });
    // Практика 1–7.
    expect(reflectPoint({ x: 2, y: -3 }, 'y')).toEqual({ x: -2, y: -3 });
    expect(reflectPoint({ x: 2, y: -3 }, 'x')).toEqual({ x: 2, y: 3 });
    expect(reflectPoint({ x: 2, y: -3 }, 'origin')).toEqual({ x: -2, y: 3 });
    expect({ x: (-3 + 5) / 2, y: (1 + -3) / 2 }).toEqual({ x: 1, y: -1 });
    expect([{ x: -4, y: -1 }, { x: -2, y: 3 }, { x: 1, y: 2 }].map((point) => reflectPoint(point, 'y')))
      .toEqual([{ x: 4, y: -1 }, { x: 2, y: 3 }, { x: -1, y: 2 }]);
  });

  it('урок 6.7: тела, развёртки и объём', () => {
    expect(cuboidMetrics(5, 3, 2).volume).toBe(30);
    expect(convertMetricValue(1, 'dm', 'cm', 3)).toBe(1000);
    // Практика 8–12.
    expect(cuboidMetrics(5, 4, 3).volume).toBe(60);
    expect(cuboidMetrics(2.5, 2.5, 2.5).volume).toBe(15.625);
    expect(convertMetricValue(3, 'dm', 'cm', 3)).toBe(3000);
    expect(3 * 4 * 2).toBe(24);
    expect(cuboidMetrics(6, 6, 6).volume / cuboidMetrics(3, 3, 3).volume).toBe(8);
  });

  it('урок 6.8: практикум «Выставочный павильон»', () => {
    // Станция 1 и задача 3.
    expect(6 + 4 + 2).toBe(12);
    expect([addSigned(0, 6 - 2), addSigned(0, 4)]).toEqual([4, 4]);
    // Зал: 10×8 без углового выреза 3×2.
    const hall = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 7, y: 6 }, { x: 7, y: 8 }, { x: 0, y: 8 },
    ];
    expect(polygonArea(hall)).toEqual(parseExact(74));
    expect(rectangleMetrics(10, 8).area - rectangleMetrics(3, 2).area).toBe(74);
    expect(orthogonalPerimeter(hall)).toEqual(parseExact(36));
    expect(rectangleMetrics(10, 8).perimeter).toBe(36);
    expect(toExactNumber(subtractExact(36, '1.2'))).toBe(34.8);
    // Эмблема диаметром 1,2 м.
    const emblem = circleMeasures(0.6);
    expect(emblem.diameter).toBe(1.2);
    expect(approximatePiMultiple(emblem.circumferencePiCoefficient, '3.14')).toBe(3.768);
    expect(approximatePiMultiple(emblem.areaPiCoefficient, '3.14')).toBe(1.1304);
    // Логотип: отражение относительно оси y.
    expect([{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 2, y: 4 }].map((point) => reflectPoint(point, 'y')))
      .toEqual([{ x: -1, y: 1 }, { x: -3, y: 1 }, { x: -2, y: 4 }]);
    // Коробка и подиум.
    expect(cuboidMetrics(1.2, 0.5, 0.4).volume).toBe(0.24);
    expect(convertMetricValue(0.24, 'm', 'dm', 3)).toBe(240);
    expect(4 * 3 * 2).toBe(24);
    expect(cuboidMetrics(4, 3, 2).volume).toBe(24);
  });
});

describe('глава 7 «Данные и перебор»', () => {
  it('вход в главу: диагностика', () => {
    expect(sectorAngle(1, 4)).toBe(90);
    expect(reduceFraction(90, 360)).toEqual({ numerator: 1, denominator: 4 });
    expect(toExactNumber(multiplyExact('1/4', 100))).toBe(25);
    expect(arithmeticMean([4, 10])).toBe(7);
    expect(35 / 5).toBe(7);
    expect(countVariants([3, 2])).toBe(6);
    expect(pairCount(3)).toBe(3);
  });

  it('урок 7.1: таблицы и столбчатые диаграммы', () => {
    const frequencies = [9, 6, 5, 3, 2];
    expect(sumValues(frequencies)).toBe(25);
    // Цена деления по подписям 0, 20, 40, 60 и четырём промежуткам.
    expect((20 - 0) / 4).toBe(5);
    expect(7 * 5).toBe(35);
    // QuickCheck: цена деления 4, третья чёрточка.
    expect(3 * 4).toBe(12);
    // Практика 1–9.
    expect(sumValues([12, 15, 11, 14, 13])).toBe(65);
    expect(15 - 11).toBe(4);
    expect(3 * 5).toBe(15);
    expect(20 + 10 / 2).toBe(25);
    expect(25 - sumValues([9, 6, 5, 3])).toBe(2);
    expect(Math.max(...frequencies)).toBe(9);
    expect(Math.min(...frequencies)).toBe(2);
    expect(9 / 2).toBe(4.5);
    const answers = ['да', 'нет', 'да', 'да', 'иногда', 'нет', 'да', 'иногда', 'да', 'да', 'нет', 'иногда'];
    const counts = ['да', 'нет', 'иногда'].map((key) => answers.filter((answer) => answer === key).length);
    expect(counts).toEqual([6, 3, 3]);
    expect(sumValues(counts)).toBe(12);
    expect(axisScale(37, 5)).toEqual({ axisMax: 40, step: 10 });
  });

  it('урок 7.2: круговые диаграммы', () => {
    const day = [9, 7, 4, 2, 2];
    expect(sumValues(day)).toBe(24);
    expect(reduceFraction(9, 24)).toEqual({ numerator: 3, denominator: 8 });
    expect(sectorAngle(9, 24)).toBe(135);
    expect(360 / 24).toBe(15);
    expect(pieSectors(day).map((sector) => sector.angle)).toEqual([135, 105, 60, 30, 30]);
    expect(sumValues(pieSectors(day).map((sector) => sector.angle))).toBe(360);
    expect(toExactNumber(multiplyExact('3/8', 100))).toBe(37.5);
    // Ловушка: 30% от 20 и 20% от 100.
    expect([percentOf(30, 20), percentOf(20, 100)]).toEqual([6, 20]);
    // Практика 1–9.
    expect(sectorAngle(9, 24)).toBe(135);
    expect(percentOf(25, 360)).toBe(90);
    expect(sectorAngle(1, 6)).toBe(60);
    expect(100 / 6).toBeCloseTo(16.7, 1);
    expect(reduceFraction(72, 360)).toEqual({ numerator: 1, denominator: 5 });
    expect(toExactNumber(multiplyExact('1/5', 100))).toBe(20);
    expect(reduceFraction(80, 200)).toEqual({ numerator: 2, denominator: 5 });
    expect(sectorAngle(80, 200)).toBe(144);
    expect(toExactNumber(multiplyExact('2/5', 100))).toBe(40);
    expect(360 - sumValues([120, 90, 60, 45])).toBe(45);
    expect(40 - sumValues([10, 14, 6])).toBe(10);
    expect(sectorAngle(10, 40)).toBe(90);
  });

  it('урок 7.3: среднее арифметическое', () => {
    const week = [12, 15, 11, 14, 13];
    expect(sumValues(week)).toBe(65);
    expect(arithmeticMean(week)).toBe(13);
    expect(arithmeticMean(week)).toBeGreaterThanOrEqual(Math.min(...week));
    expect(arithmeticMean(week)).toBeLessThanOrEqual(Math.max(...week));
    const marks = [3, 4, 4, 5];
    expect(sumValues(marks)).toBe(16);
    expect(arithmeticMean(marks)).toBe(4);
    expect(arithmeticMean([...marks, 5])).toBe(4.2);
    expect(missingValueForMean(marks, 4)).toBe(4);
    expect(arithmeticMean([...marks, 4])).toBe(4);
    // QuickCheck: сумма пяти чисел со средним 8.
    expect(8 * 5).toBe(40);
    expect(arithmeticMean([5, 0, 4, 3])).toBe(3);
    // Практика 2–10.
    expect(arithmeticMean([7, 10])).toBe(8.5);
    expect(arithmeticMean([2, 3, 3, 8])).toBe(4);
    expect(arithmeticMean([4, 5, 4, 3, 5, 3])).toBe(4);
    expect(arithmeticMean([12, 8, 15, 9])).toBe(11);
    expect(6 * 5).toBe(30);
    expect(7 * 4 - sumValues([5, 8, 9])).toBe(6);
    expect(arithmeticMean([5, 8, 9, 6])).toBe(7);
    expect(missingValueForMean(marks, 4.5)).toBe(6.5);
    expect(arithmeticMean([10, 12, 14])).toBe(12);
    expect(arithmeticMean([10, 12, 14, 40])).toBe(19);
  });

  it('урок 7.4: перебор вариантов', () => {
    expect(countVariants([3, 2])).toBe(6);
    expect(cartesianProduct([['чай', 'какао', 'сок'], ['с сыром', 'с джемом']])).toHaveLength(6);
    expect(countVariants([3, 2, 2])).toBe(12);
    // Двузначные числа из цифр 1, 2, 3.
    const digits = [1, 2, 3];
    const withoutRepeats = cartesianProduct([digits, digits])
      .filter(([first, second]) => first !== second)
      .map(([first, second]) => first * 10 + second);
    expect(withoutRepeats).toEqual([12, 13, 21, 23, 31, 32]);
    const withRepeats = cartesianProduct([digits, digits]).map(([first, second]) => first * 10 + second);
    expect(withRepeats).toEqual([11, 12, 13, 21, 22, 23, 31, 32, 33]);
    expect(pairCount(5)).toBe(10);
    expect(unorderedPairs(['Астра', 'Барс', 'Вихрь', 'Гроза', 'Дельта'])).toHaveLength(10);
    expect(pairCount(6)).toBe(15);
    // Практика 1–9.
    expect(countVariants([3, 4])).toBe(12);
    expect(countVariants([2, 3, 2])).toBe(12);
    const zeroOneTwo = cartesianProduct([[0, 1, 2], [0, 1, 2]])
      .filter(([first, second]) => first !== second && first !== 0)
      .map(([first, second]) => first * 10 + second);
    expect(zeroOneTwo).toEqual([10, 12, 20, 21]);
    expect(countVariants([10, 10, 10])).toBe(1000);
    expect(countVariants([3, 4])).toBe(12);
  });

  it('урок 7.5: практикум «Школьный фестиваль»', () => {
    const visitors = [40, 55, 45, 60, 50];
    expect(sumValues(visitors)).toBe(250);
    expect(arithmeticMean(visitors)).toBe(50);
    expect(visitors.map((value) => value - arithmeticMean(visitors))).toEqual([-10, 5, -5, 10, 0]);
    expect(sumValues(visitors.map((value) => value - arithmeticMean(visitors)))).toBe(0);
    expect(axisScale(60, 5)).toEqual({ axisMax: 60, step: 20 });
    // Бюджет.
    const budget = [12, 9, 6, 3];
    expect(sumValues(budget)).toBe(30);
    expect(360 / 30).toBe(12);
    const sectors = pieSectors(budget);
    expect(sectors.map((sector) => sector.angle)).toEqual([144, 108, 72, 36]);
    expect(sumValues(sectors.map((sector) => sector.angle))).toBe(360);
    expect(sectors.map((sector) => sector.percent)).toEqual([40, 30, 20, 10]);
    expect(sectors.map((sector) => sector.fraction)).toEqual([
      { numerator: 2, denominator: 5 },
      { numerator: 3, denominator: 10 },
      { numerator: 1, denominator: 5 },
      { numerator: 1, denominator: 10 },
    ]);
    expect(sumValues(sectors.map((sector) => sector.percent))).toBe(100);
    // Бейджи и турнир.
    expect(countVariants([3, 2, 2])).toBe(12);
    expect(cartesianProduct([['жёлтый', 'синий'], ['круг', 'квадрат']])).toEqual([
      ['жёлтый', 'круг'],
      ['жёлтый', 'квадрат'],
      ['синий', 'круг'],
      ['синий', 'квадрат'],
    ]);
    expect(pairCount(6)).toBe(15);
    expect(15 * 20 + 14 * 5).toBe(370);
    expect([Math.floor(370 / 60), 370 % 60]).toEqual([6, 10]);
    expect(Math.max(...visitors) - Math.min(...visitors)).toBe(20);
  });
});
