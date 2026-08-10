/**
 * Числа из уроков 7 класса.
 *
 * Тест пиннит значения, напечатанные прямо в MDX: ответы разделов «Практика»,
 * выкладки <WorkedExample> и варианты <QuickCheck>. Каждое число здесь
 * пересчитывается ядром из src/lib, а не сравнивается константа с константой.
 *
 * Блок describe — глава, it — урок.
 */
import { describe, expect, it } from 'vitest';

import {
  addExact,
  compareExact,
  divideExact,
  formatExactRussian,
  multiplyExact,
  parseExact,
  subtractExact,
  toExactNumber,
  type ExactInput,
} from '../src/lib/exactRational';
import {
  applyPowerRule,
  decimalExpansion,
  formatDecimalExpansion,
  isTerminatingDecimal,
  powerExact,
  powerSign,
  roundExact,
  roundingError,
  terminatingCheck,
  toStandardForm,
} from '../src/lib/powers';
import {
  addPolynomials,
  evaluatePolynomial,
  expandDifferenceOfSquares,
  expandDifferenceSquare,
  expandSumSquare,
  factorOutCommonMonomial,
  multiplyPolynomials,
  polynomialDegree,
  subtractPolynomials,
  type Polynomial,
} from '../src/lib/polynomials';
import {
  evaluateLinear,
  intersectLines,
  lineThroughPoints,
  linearEquation,
  linearExpression,
  solveLinearEquation,
  solveSystem,
  twoVariableEquation,
  xIntercept,
} from '../src/lib/linear';
import {
  adjacentAngle,
  convexPolygonAngleSum,
  crossingAngles,
  exteriorAngle,
  exteriorAngleFromRemote,
  isoscelesApexAngle,
  isoscelesBaseAngle,
  parallelogramLayout,
  polygonFanCut,
  polygonVerticesFromAngleSum,
  regularPolygonAngle,
  segmentMidpoint,
  thirdTriangleAngle,
  transversalPairAngle,
  verticalAngle,
} from '../src/lib/planimetry';
import {
  frequencyTable,
  groupIntoIntervals,
  mean,
  median,
  range,
  relativeFrequency,
  roundTo,
  sampleSummary,
} from '../src/lib/statistics';

/** Точное значение как число: удобно для сравнения с напечатанным ответом. */
const value = (input: ExactInput): number => toExactNumber(parseExact(input));

/** Единственный корень линейного уравнения; иначе тест падает. */
function root(left: [ExactInput, ExactInput], right: [ExactInput, ExactInput]): number {
  const solution = solveLinearEquation(
    linearEquation(linearExpression(left[0], left[1]), linearExpression(right[0], right[1])),
  );
  expect(solution.kind).toBe('unique');
  if (solution.kind !== 'unique') throw new Error('нет единственного корня');
  return value(solution.value);
}

/** Единственное решение системы ax + by = c; иначе тест падает. */
function systemPair(
  first: readonly [ExactInput, ExactInput, ExactInput],
  second: readonly [ExactInput, ExactInput, ExactInput],
): readonly [number, number] {
  const solution = solveSystem(
    twoVariableEquation(first[0], first[1], first[2]),
    twoVariableEquation(second[0], second[1], second[2]),
  );
  expect(solution.kind).toBe('unique');
  if (solution.kind !== 'unique') throw new Error('нет единственного решения');
  return [value(solution.x), value(solution.y)];
}

// ─────────────────── Глава 1. Рациональные числа и степени ───────────────────

describe('7 класс · Рациональные числа и степени: числа из уроков главы', () => {
  it('1.1 Точные вычисления и периодические дроби', () => {
    // Вступление: 0,33 + 0,17 = 0,50 — округление до сложения совпало случайно.
    expect(value(roundExact({ numerator: 1n, denominator: 3n }, 2))).toBeCloseTo(0.33, 12);
    expect(value(roundExact({ numerator: 1n, denominator: 6n }, 2))).toBeCloseTo(0.17, 12);

    // Разобранный пример: 7/8 = 0,875 конечна, 5/12 = 0,41(6) периодична.
    expect(terminatingCheck({ numerator: 7n, denominator: 8n })).toMatchObject({
      twos: 3,
      fives: 0,
      otherFactor: 1,
      terminating: true,
    });
    expect(formatDecimalExpansion(decimalExpansion({ numerator: 7n, denominator: 8n }))).toBe('0,875');
    expect(terminatingCheck({ numerator: 5n, denominator: 12n }).otherFactor).toBe(3);
    expect(formatDecimalExpansion(decimalExpansion({ numerator: 5n, denominator: 12n }))).toBe('0,41(6)');
    // 6/15 сокращается до 2/5 — запись конечна.
    expect(formatDecimalExpansion(decimalExpansion({ numerator: 6n, denominator: 15n }))).toBe('0,4');

    // QuickCheck: конечна только 7/40; пояснения к 7/15 и 7/6.
    expect(isTerminatingDecimal({ numerator: 7n, denominator: 15n })).toBe(false);
    expect(isTerminatingDecimal({ numerator: 7n, denominator: 40n })).toBe(true);
    expect(isTerminatingDecimal({ numerator: 7n, denominator: 6n })).toBe(false);
    expect(formatDecimalExpansion(decimalExpansion({ numerator: 7n, denominator: 15n }))).toBe('0,4(6)');
    expect(formatDecimalExpansion(decimalExpansion({ numerator: 7n, denominator: 40n }))).toBe('0,175');
    expect(formatDecimalExpansion(decimalExpansion({ numerator: 7n, denominator: 6n }))).toBe('1,1(6)');

    // Практика 1: 0,875; 0,15; 0,36.
    expect(value({ numerator: 3n, denominator: 20n })).toBe(0.15);
    expect(value({ numerator: 9n, denominator: 25n })).toBe(0.36);
    // Практика 2: конечны 5/16 и 11/50, периодичны 4/15 и 7/12.
    expect([16, 50].map((d) => isTerminatingDecimal({ numerator: 1n, denominator: BigInt(d) }))).toEqual([true, true]);
    expect([15, 12].map((d) => isTerminatingDecimal({ numerator: 1n, denominator: BigInt(d) }))).toEqual([false, false]);
    // Практика 3: 0,1(6); 0,(45); 0,2(3).
    expect(formatDecimalExpansion(decimalExpansion({ numerator: 1n, denominator: 6n }))).toBe('0,1(6)');
    expect(formatDecimalExpansion(decimalExpansion({ numerator: 5n, denominator: 11n }))).toBe('0,(45)');
    expect(formatDecimalExpansion(decimalExpansion({ numerator: 7n, denominator: 30n }))).toBe('0,2(3)');
    // Практика 4: 2/3 + 1/6 − 1/2 = 1/3.
    const p4 = subtractExact(
      addExact({ numerator: 2n, denominator: 3n }, { numerator: 1n, denominator: 6n }),
      { numerator: 1n, denominator: 2n },
    );
    expect(formatExactRussian(p4)).toBe('1/3');
    // Практика 5: 3/4 · 8/9 : 2/3 = 1.
    const p5 = divideExact(
      multiplyExact({ numerator: 3n, denominator: 4n }, { numerator: 8n, denominator: 9n }),
      { numerator: 2n, denominator: 3n },
    );
    expect(formatExactRussian(p5)).toBe('1');
    // Практика 6: 0,4 + 1/5 + 3/10 = 9/10 = 0,9.
    const p6 = addExact(addExact('0,4', { numerator: 1n, denominator: 5n }), { numerator: 3n, denominator: 10n });
    expect(value(p6)).toBe(0.9);
    // Практика 7: 5/7 > 0,71.
    expect(compareExact({ numerator: 5n, denominator: 7n }, '0,71')).toBe(1);
    // Практика 8: 5/12 ≈ 0,42, расхождение 1/300.
    expect(value(roundExact({ numerator: 5n, denominator: 12n }, 2))).toBeCloseTo(0.42, 12);
    expect(formatExactRussian(roundingError({ numerator: 5n, denominator: 12n }, 2))).toBe('1/300');
    // Практика 9: 7 · 0,14 = 0,98, расхождение 0,02.
    expect(value(multiplyExact(7, roundExact({ numerator: 1n, denominator: 7n }, 2)))).toBeCloseTo(0.98, 12);
    // Практика 10: 3 · 0,(3) = 1.
    expect(formatExactRussian(multiplyExact(3, { numerator: 1n, denominator: 3n }))).toBe('1');
  });

  it('1.2 Степень с натуральным показателем', () => {
    // Таблица «прибавляем 2n против умножаем 2ⁿ».
    const hours = [1, 5, 10, 20, 24];
    expect(hours.map((n) => 2 * n)).toEqual([2, 10, 20, 40, 48]);
    expect(hours.map((n) => value(powerExact(2, n)))).toEqual([2, 32, 1024, 1_048_576, 16_777_216]);

    // Разобранный пример: пять коротких вычислений.
    expect(value(powerExact(-3, 2))).toBe(9);
    expect(-value(powerExact(3, 2))).toBe(-9);
    expect(value(powerExact(-2, 3))).toBe(-8);
    expect(formatExactRussian(powerExact({ numerator: 2n, denominator: 3n }, 3))).toBe('8/27');
    expect(value(powerExact('0,1', 4))).toBe(0.0001);

    // QuickCheck: −5² = −25, а (−5)² = 25.
    expect(-value(powerExact(5, 2))).toBe(-25);
    expect(value(powerExact(-5, 2))).toBe(25);

    // Практика 2–4.
    expect([powerExact(3, 4), powerExact(2, 6), powerExact(10, 5), powerExact(1, 9)].map(value)).toEqual([
      81, 64, 100_000, 1,
    ]);
    expect([powerExact(-2, 4), powerExact(-2, 5)].map(value)).toEqual([16, -32]);
    expect(-value(powerExact(2, 4))).toBe(-16);
    expect(value(powerExact('0,2', 3))).toBe(0.008);
    expect(formatExactRussian(powerExact({ numerator: 1n, denominator: 2n }, 5))).toBe('0,03125');
    expect(powerExact({ numerator: 1n, denominator: 2n }, 5)).toMatchObject({ numerator: 1n, denominator: 32n });
    expect(value(powerExact({ numerator: 2n, denominator: 5n }, 2))).toBe(0.16);
    // Практика 5: знаки степеней с отрицательным основанием.
    expect(powerSign(-7, 11).sign).toBe(-1);
    expect(powerSign(-7, 12).sign).toBe(1);
    // Практика 6: 5 · 2³ = 40, (5 · 2)³ = 1000.
    expect(5 * value(powerExact(2, 3))).toBe(40);
    expect(value(powerExact(10, 3))).toBe(1000);
    // Практика 7: 2ⁿ = 64 при n = 6.
    expect(value(powerExact(2, 6))).toBe(64);
    // Практика 8: 4 часа по 20 минут — 12 делений, 2¹² = 4096.
    expect((4 * 60) / 20).toBe(12);
    expect(value(powerExact(2, 12))).toBe(4096);
    // Практика 9–10.
    expect(value(powerExact(2, 10))).toBe(1024);
    expect(value(powerExact(10, 2))).toBe(100);
    expect(value(powerExact(3, 2)) + value(powerExact(4, 2))).toBe(25);
    expect(value(powerExact(7, 2))).toBe(49);
  });

  it('1.3 Свойства степеней', () => {
    // Вступление: 2⁵ · 2⁷ — двенадцать одинаковых множителей.
    expect(applyPowerRule('product', 5, 7)).toMatchObject({ resultExponent: 12, factorCount: 12 });
    // Разобранный пример: пять упрощений.
    expect(applyPowerRule('product', 4, 5).resultExponent).toBe(9);
    expect(applyPowerRule('quotient', 8, 6).resultExponent).toBe(2);
    expect(value(powerExact(7, 2))).toBe(49);
    expect(applyPowerRule('power-of-power', 3, 4).resultExponent).toBe(12);
    expect(value(powerExact(2, 12))).toBe(4096);
    // 4³ · 4² : 4⁴ = 4 и прямая проверка 64 · 16 : 256 = 4.
    expect(applyPowerRule('quotient', applyPowerRule('product', 3, 2).resultExponent, 4).resultExponent).toBe(1);
    expect((value(powerExact(4, 3)) * value(powerExact(4, 2))) / value(powerExact(4, 4))).toBe(4);
    // Ошибка: 2³ + 2⁴ = 24, а не 2⁷ = 128.
    expect(value(powerExact(2, 3)) + value(powerExact(2, 4))).toBe(24);
    expect(value(powerExact(2, 7))).toBe(128);
    // Ошибка: 3² · 3³ = 3⁵ = 243, а 9⁵ = 59 049.
    expect(value(powerExact(3, applyPowerRule('product', 2, 3).resultExponent))).toBe(243);
    expect(value(powerExact(9, 5))).toBe(59_049);
    // Степень произведения: (2 · 5)³ = 1000 = 8 · 125.
    expect(value(powerExact(10, 3))).toBe(1000);
    expect(value(powerExact(2, 3)) * value(powerExact(5, 3))).toBe(1000);
    // Практика 1, 3, 4, 7, 8, 9.
    expect(value(powerExact(2, applyPowerRule('product', 5, 3).resultExponent))).toBe(256);
    expect(value(powerExact(3, applyPowerRule('quotient', 10, 7).resultExponent))).toBe(27);
    expect(value(powerExact(5, applyPowerRule('power-of-power', 2, 3).resultExponent))).toBe(15_625);
    expect(applyPowerRule('quotient', 5, 5).resultExponent).toBe(0);
    expect(value(powerExact(6, 0))).toBe(1);
    expect(applyPowerRule('product', 10, 10).resultExponent).toBe(20);
    // Практика 5: (x⁴)² · x³ = x¹¹.
    expect(applyPowerRule('product', applyPowerRule('power-of-power', 4, 2).resultExponent, 3).resultExponent).toBe(11);
  });

  it('1.4 Стандартный вид числа', () => {
    // Вступление и определение.
    expect(toStandardForm(149_600_000)).toMatchObject({ exponent: 8 });
    expect(value(toStandardForm(149_600_000).mantissa)).toBe(1.496);
    expect(toStandardForm(52_000)).toMatchObject({ exponent: 4 });
    expect(value(toStandardForm(52_000).mantissa)).toBe(5.2);
    // Сравнение по порядку: 8,1 · 10⁷ < 3,4 · 10⁹.
    expect(toStandardForm(81_000_000).exponent).toBeLessThan(toStandardForm(3_400_000_000).exponent);
    // Разобранный пример: три произведения и нормализация.
    expect(toStandardForm(3e5 * 2e4)).toMatchObject({ exponent: 9 });
    expect(value(toStandardForm(3e5 * 2e4).mantissa)).toBe(6);
    expect(toStandardForm(8e8 / 2e3)).toMatchObject({ exponent: 5 });
    expect(value(toStandardForm(8e8 / 2e3).mantissa)).toBe(4);
    expect(toStandardForm(4e3 * 5e6)).toMatchObject({ exponent: 10 });
    expect(value(toStandardForm(4e3 * 5e6).mantissa)).toBe(2);
    // Практика 1–2.
    expect([4500, 92_000, 7_000_000].map((n) => toStandardForm(n).exponent)).toEqual([3, 4, 6]);
    expect([4500, 92_000, 7_000_000].map((n) => value(toStandardForm(n).mantissa))).toEqual([4.5, 9.2, 7]);
    expect(3.2e5).toBe(320_000);
    expect(6e3).toBe(6000);
    expect(1.08e6).toBe(1_080_000);
    // Практика 4: 2,5 · 10⁴ км = 2,5 · 10⁷ м.
    expect(toStandardForm(2.5e4 * 1000)).toMatchObject({ exponent: 7 });
    expect(value(toStandardForm(2.5e4 * 1000).mantissa)).toBe(2.5);
    // Практика 5–7.
    expect(2e6 * 4e3).toBe(8e9);
    expect(toStandardForm(5e4 * 6e5)).toMatchObject({ exponent: 10 });
    expect(value(toStandardForm(5e4 * 6e5).mantissa)).toBe(3);
    expect(8e8 / 2e3).toBe(4e5);
    // Практика 8: свет за минуту — 1,8 · 10⁷ км.
    expect(toStandardForm(3e5 * 60)).toMatchObject({ exponent: 7 });
    expect(value(toStandardForm(3e5 * 60).mantissa)).toBe(1.8);
    // Практика 10: 8,1 · 10⁹ = 8 100 000 000, порядок 9.
    expect(toStandardForm(8_100_000_000)).toMatchObject({ exponent: 9 });
    expect(value(toStandardForm(8_100_000_000).mantissa)).toBe(8.1);
  });

  it('1.5 Практикум: числа, которые не помещаются в строку', () => {
    // Станция 1: 11/24 = 0,458(3) ≈ 0,46, расхождение 1/600 < 0,002.
    const eleventh = { numerator: 11n, denominator: 24n } as const;
    expect(formatDecimalExpansion(decimalExpansion(eleventh))).toBe('0,458(3)');
    expect(terminatingCheck(eleventh)).toMatchObject({ twos: 3, fives: 0, otherFactor: 3 });
    expect(value(roundExact(eleventh, 2))).toBeCloseTo(0.46, 12);
    expect(formatExactRussian(roundingError(eleventh, 2))).toBe('1/600');
    expect(value(roundingError(eleventh, 2))).toBeLessThan(0.002);
    // Станция 2: (3²)³ : 3⁴ = 3² = 9, прямой счёт 729 : 81 = 9.
    const station2 = applyPowerRule('quotient', applyPowerRule('power-of-power', 2, 3).resultExponent, 4);
    expect(station2.resultExponent).toBe(2);
    expect(value(powerExact(3, station2.resultExponent))).toBe(9);
    expect(value(powerExact(3, 6)) / value(powerExact(3, 4))).toBe(9);
    // Станция 3 и ответ 9: радиус Земли 6 380 000 м = 6,38 · 10⁶ м.
    expect(toStandardForm(6_380_000)).toMatchObject({ exponent: 6 });
    expect(value(toStandardForm(6_380_000).mantissa)).toBe(6.38);
    // QuickCheck: 1,496 · 10⁸ км против 1,28 · 10⁴ км — примерно в 10 000 раз.
    expect(toStandardForm(1.496e8).exponent - toStandardForm(1.28e4).exponent).toBe(4);
    expect(1.496e8 / 1.28e4).toBeGreaterThan(10_000);
    // Ответ 1: 7/16 = 0,4375 = 4375/10 000.
    expect(formatDecimalExpansion(decimalExpansion({ numerator: 7n, denominator: 16n }))).toBe('0,4375');
    expect(formatExactRussian(parseExact({ numerator: 4375n, denominator: 10_000n }))).toBe('0,4375');
    // Ответ 2: 4/11 = 0,(36).
    expect(formatDecimalExpansion(decimalExpansion({ numerator: 4n, denominator: 11n }))).toBe('0,(36)');
    // Ответ 3–4: 5/6 − 3/8 = 11/24.
    const difference = subtractExact({ numerator: 5n, denominator: 6n }, { numerator: 3n, denominator: 8n });
    expect(formatExactRussian(difference)).toBe('11/24');
    // Ответы 5–6.
    expect(value(powerExact(-2, 6))).toBe(64);
    expect(-value(powerExact(2, 6))).toBe(-64);
    expect(formatExactRussian(powerExact({ numerator: 1n, denominator: 3n }, 4))).toBe('1/81');
    // Ответ 7: a⁵ · a³ : a⁶ = a².
    expect(applyPowerRule('quotient', applyPowerRule('product', 5, 3).resultExponent, 6).resultExponent).toBe(2);
    // Ответ 10: (2,5 · 10⁵)(4 · 10³) = 10⁹ = 1 · 10⁹.
    expect(toStandardForm(2.5e5 * 4e3)).toMatchObject({ exponent: 9 });
    expect(value(toStandardForm(2.5e5 * 4e3).mantissa)).toBe(1);
    // Ответ 11: 2¹⁵ = 32 768 больше 10⁴ = 10 000.
    expect(value(powerExact(2, 15))).toBe(32_768);
    expect(value(powerExact(10, 4))).toBe(10_000);
    // Ответ 12: 5 часов по полчаса — 10 делений, 2¹⁰ = 1024.
    expect(5 / 0.5).toBe(10);
    expect(value(powerExact(2, 10))).toBe(1024);
  });

  it('Вход в главу: входная диагностика', () => {
    expect(parseExact({ numerator: 18n, denominator: 24n })).toMatchObject({ numerator: 3n, denominator: 4n });
    expect(
      formatExactRussian(addExact({ numerator: 2n, denominator: 3n }, { numerator: 1n, denominator: 6n })),
    ).toBe('5/6');
    expect(formatExactRussian(parseExact('0,25'))).toBe('0,25');
    expect(formatExactRussian(parseExact({ numerator: 25n, denominator: 100n }))).toBe('0,25');
    expect(-5 + 8).toBe(3);
    expect(-4 * -3).toBe(12);
    expect(value(powerExact(2, 2)) * 3 * 5).toBe(60); // 60 = 2² · 3 · 5
    expect(compareExact({ numerator: 5n, denominator: 7n }, '0,7')).toBe(1);
    expect(value(powerExact(10, 4))).toBe(10_000);
  });
});

// ─────────────────────── Глава 2. Алгебраический язык ────────────────────────

describe('7 класс · Алгебраический язык: числа из уроков главы', () => {
  it('2.1 Тождества и тождественные преобразования', () => {
    // Вступление: 3(x + 2) и 3x + 6 при x = 4 и x = 10.
    const left: Polynomial = [6, 3];
    expect(evaluatePolynomial(left, 4)).toBe(18);
    expect(evaluatePolynomial(left, 10)).toBe(36);
    // Опровержение: x² = 2x расходится при x = 3.
    expect(evaluatePolynomial([0, 0, 1], 3)).toBe(9);
    expect(evaluatePolynomial([0, 2], 3)).toBe(6);
    // Скобка с минусом: a − (b − c) при a = 10, b = 4, c = 1.
    expect(10 - (4 - 1)).toBe(7);
    expect(10 - 4 + 1).toBe(7);
    // QuickCheck: 2(x + 4) при x = 1 равно 10.
    expect(evaluatePolynomial([8, 2], 1)).toBe(10);
    // Практика 3–6, 8, 10 — тождества как равенство многочленов.
    expect(addPolynomials(multiplyPolynomials([3], [-4, 1]), [12])).toEqual([0, 3]);
    expect(subtractPolynomials(multiplyPolynomials([2], [3, 1]), [6, 1])).toEqual([0, 1]);
    expect(subtractPolynomials([0, 7], [-5, 3])).toEqual([5, 4]);
    expect(addPolynomials(multiplyPolynomials([-1], [-7, 2]), [0, 4])).toEqual([7, 2]);
    expect(subtractPolynomials(multiplyPolynomials([4], [2, 1]), [0, 3])).toEqual([8, 1]);
    expect(multiplyPolynomials([3], [3, 2])).toEqual([9, 6]);
    // Практика 9: (1 + 1)² = 4, а 1² + 1² = 2.
    expect(expandSumSquare(1, 1).total).toBe(4);
    expect(expandSumSquare(1, 1).firstSquare + expandSumSquare(1, 1).secondSquare).toBe(2);
  });

  it('2.2 Одночлены и многочлены', () => {
    // Приведение подобных: 3a − 5b − a + 4b + 6 − 2 = 2a − b + 4 при a = 3, b = −2.
    const before = 3 * 3 - 5 * -2 - 3 + 4 * -2 + 6 - 2;
    const after = 2 * 3 - -2 + 4;
    expect(before).toBe(12);
    expect(after).toBe(12);
    // 4x² − 3x + 7 − x² + 5x = 3x² + 2x + 7; при x = 2 обе записи дают 23.
    const collected = addPolynomials([7, -3, 4], [0, 5, -1]);
    expect(collected).toEqual([7, 2, 3]);
    expect(polynomialDegree(collected)).toBe(2);
    expect(evaluatePolynomial(collected, 2)).toBe(23);
    // Разобранный пример: (3x² − 5x + 2) − (x² − 5x − 4) = 2x² + 6, проверка при x = 1.
    const worked = subtractPolynomials([2, -5, 3], [-4, -5, 1]);
    expect(worked).toEqual([6, 0, 2]);
    expect(evaluatePolynomial(worked, 1)).toBe(8);
    // Ошибка: (5a − 3) − (2a − 7) = 3a + 4, проверка при a = 1.
    const signs = subtractPolynomials([-3, 5], [-7, 2]);
    expect(signs).toEqual([4, 3]);
    expect(evaluatePolynomial(signs, 1)).toBe(7);
    // Практика 5–6, 8–10.
    expect(addPolynomials([-1, 3, 2], [4, -5, 1])).toEqual([3, -2, 3]);
    expect(subtractPolynomials([6, -2, 5], [-1, 3, 2])).toEqual([7, -5, 3]);
    expect(subtractPolynomials([-4, 3], [-4, 1])).toEqual([0, 2]);
    expect(addPolynomials(addPolynomials([2, 1], [-1, 2]), [5, 1])).toEqual([6, 4]);
    expect(subtractPolynomials([1, 5], [-3, 2])).toEqual([4, 3]);
    expect(addPolynomials([4, 3], [-3, 2])).toEqual([1, 5]);
  });

  it('2.3 Умножение многочленов', () => {
    // (x + 3)(x − 5) = x² − 2x − 15.
    expect(multiplyPolynomials([3, 1], [-5, 1])).toEqual([-15, -2, 1]);
    // 3x(2x − 5) = 6x² − 15x и −2a(a² − 3a + 4) = −2a³ + 6a² − 8a.
    expect(multiplyPolynomials([0, 3], [-5, 2])).toEqual([0, -15, 6]);
    expect(multiplyPolynomials([0, -2], [4, -3, 1])).toEqual([0, -8, 6, -2]);
    // Разобранный пример: (2x − 3)(x + 4) = 2x² + 5x − 12, проверка при x = 1.
    const worked = multiplyPolynomials([-3, 2], [4, 1]);
    expect(worked).toEqual([-12, 5, 2]);
    expect(evaluatePolynomial(worked, 1)).toBe(-5);
    // «По столбикам» нельзя: (a + b)(c + d) = 21, а ac + bd = 11.
    expect((1 + 2) * (3 + 4)).toBe(21);
    expect(1 * 3 + 2 * 4).toBe(11);
    expect(1 * 3 + 1 * 4 + 2 * 3 + 2 * 4).toBe(21);
    // QuickCheck: (a + b + c)(x + y) даёт 3 · 2 = 6 произведений.
    expect(3 * 2).toBe(6);
    // Практика 3–10.
    expect(multiplyPolynomials([4, 1], [6, 1])).toEqual([24, 10, 1]);
    expect(multiplyPolynomials([-3, 1], [-7, 1])).toEqual([21, -10, 1]);
    expect(multiplyPolynomials([1, 2], [-4, 3])).toEqual([-4, -5, 6]);
    expect(multiplyPolynomials([-5, 1], [5, 1])).toEqual([-25, 0, 1]);
    expect(multiplyPolynomials([2, 1], [4, -2, 1])).toEqual([8, 0, 0, 1]);
    expect(subtractPolynomials(multiplyPolynomials([3, 1], [-1, 1]), [0, 2, 1])).toEqual([-3]);
    expect(multiplyPolynomials([3, 1], [5, 1])).toEqual([15, 8, 1]);
    expect(subtractPolynomials(multiplyPolynomials([1, 1], [1, 1]), [0, 0, 1])).toEqual([1, 2]);
  });

  it('2.4 Формулы сокращённого умножения', () => {
    // Устный счёт: 51² = 2601, прирост площади 101 дм².
    expect(expandSumSquare(50, 1)).toMatchObject({ firstSquare: 2500, doubleProduct: 100, secondSquare: 1, total: 2601 });
    expect(2601 - 2500).toBe(101);
    expect(expandDifferenceSquare(50, 1).total).toBe(2401);
    expect(expandDifferenceOfSquares(50, 1).product).toBe(2499);
    expect(expandSumSquare(100, 2).total).toBe(10_404);
    // Разобранный пример: (3x + 4)² и (2a − 5b)² с проверкой при a = b = 1.
    expect(multiplyPolynomials([4, 3], [4, 3])).toEqual([16, 24, 9]);
    expect(expandDifferenceSquare(2, 5)).toMatchObject({ firstSquare: 4, doubleProduct: -20, secondSquare: 25, total: 9 });
    // Ошибка: (3 + 4)² = 49, а 9 + 16 = 25, разница 2 · 3 · 4 = 24.
    expect(expandSumSquare(3, 4).total).toBe(49);
    expect(expandSumSquare(3, 4).doubleProduct).toBe(24);
    // QuickCheck: (x + 5)² = x² + 10x + 25; при x = 1 слева 36, а x² + 25 даёт 26.
    expect(multiplyPolynomials([5, 1], [5, 1])).toEqual([25, 10, 1]);
    expect(evaluatePolynomial([25, 10, 1], 1)).toBe(36);
    expect(evaluatePolynomial([25, 0, 1], 1)).toBe(26);
    // Практика 1–10.
    expect(multiplyPolynomials([3, 1], [3, 1])).toEqual([9, 6, 1]);
    expect(multiplyPolynomials([-6, 1], [-6, 1])).toEqual([36, -12, 1]);
    expect(multiplyPolynomials([1, 2], [1, 2])).toEqual([1, 4, 4]);
    expect(multiplyPolynomials([-7, 1], [7, 1])).toEqual([-49, 0, 1]);
    expect(expandSumSquare(40, 1).total).toBe(1681);
    expect(expandDifferenceSquare(100, 2).total).toBe(9604);
    expect(expandDifferenceOfSquares(60, 3).product).toBe(3591);
    expect(subtractPolynomials(multiplyPolynomials([4, 1], [4, 1]), multiplyPolynomials([-4, 1], [-4, 1]))).toEqual([0, 16]);
    expect(evaluatePolynomial([0, 16], 1)).toBe(16);
  });

  it('2.5 Разложение на множители', () => {
    // Вступление: 73² − 27² = 4600 двумя способами.
    expect(expandDifferenceOfSquares(73, 27)).toMatchObject({
      sum: 100,
      difference: 46,
      product: 4600,
      squareDifference: 4600,
    });
    expect(value(powerExact(73, 2)) - value(powerExact(27, 2))).toBe(4600);
    // 6x² + 9x = 3x(2x + 3).
    expect(factorOutCommonMonomial([0, 9, 6])).toEqual({ factor: { coefficient: 3, degree: 1 }, quotient: [3, 2] });
    // Ошибка: 5x² + 5x = 5x(x + 1), единица в скобках не теряется.
    expect(factorOutCommonMonomial([0, 5, 5])).toEqual({ factor: { coefficient: 5, degree: 1 }, quotient: [1, 1] });
    // Группировка: x³ − 2x² + 5x − 10 = (x − 2)(x² + 5).
    expect(multiplyPolynomials([-2, 1], [5, 0, 1])).toEqual([-10, 5, -2, 1]);
    // Разобранный пример: 5a³ − 20a = 5a(a − 2)(a + 2), проверка при a = 3.
    expect(factorOutCommonMonomial([0, -20, 0, 5])).toEqual({ factor: { coefficient: 5, degree: 1 }, quotient: [-4, 0, 1] });
    expect(multiplyPolynomials([-2, 1], [2, 1])).toEqual([-4, 0, 1]);
    expect(evaluatePolynomial([0, -20, 0, 5], 3)).toBe(75);
    expect(5 * 3 * (3 - 2) * (3 + 2)).toBe(75);
    // QuickCheck: 4x² − 4x = 4x(x − 1).
    expect(factorOutCommonMonomial([0, -4, 4])).toEqual({ factor: { coefficient: 4, degree: 1 }, quotient: [-1, 1] });
    // Практика 2–4, 5–6, 7–9.
    expect(factorOutCommonMonomial([0, -9, 6])).toEqual({ factor: { coefficient: 3, degree: 1 }, quotient: [-3, 2] });
    expect(factorOutCommonMonomial([0, 0, 1, 1])).toEqual({ factor: { coefficient: 1, degree: 2 }, quotient: [1, 1] });
    expect(multiplyPolynomials([-9, 1], [9, 1])).toEqual([-81, 0, 1]);
    expect(multiplyPolynomials([7, 1], [7, 1])).toEqual([49, 14, 1]);
    expect(expandDifferenceOfSquares(2, 5).squareDifference).toBe(-21); // (2a)² − (5b)² при a = b = 1
  });

  it('2.6 Практикум: смета спортивной площадки', () => {
    // Станция 1: P = 4x + 10, S = x² + 5x + 4; при x = 6 стороны 10 и 7.
    const perimeter = multiplyPolynomials([2], addPolynomials([4, 1], [1, 1]));
    const area = multiplyPolynomials([4, 1], [1, 1]);
    expect(perimeter).toEqual([10, 4]);
    expect(area).toEqual([4, 5, 1]);
    expect(evaluatePolynomial(perimeter, 6)).toBe(34);
    expect(evaluatePolynomial(area, 6)).toBe(70);
    expect(2 * (10 + 7)).toBe(34);
    expect(10 * 7).toBe(70);
    // Станция 2: (a + 3)(a − 3) = a² − 9, периметр 4a не изменился.
    expect(multiplyPolynomials([3, 1], [-3, 1])).toEqual([-9, 0, 1]);
    expect(multiplyPolynomials([2], addPolynomials([3, 1], [-3, 1]))).toEqual([0, 4]);
    // Станция 3: 47 · 53 = 2491.
    expect(expandDifferenceOfSquares(50, 3)).toMatchObject({ sum: 53, difference: 47, product: 2491 });
    // QuickCheck: 2x² − 8 = 2(x − 2)(x + 2), и (2x − 4)(x + 2) даёт то же значение.
    expect(factorOutCommonMonomial([-8, 0, 2])).toEqual({ factor: { coefficient: 2, degree: 0 }, quotient: [-4, 0, 1] });
    expect(multiplyPolynomials([-4, 2], [2, 1])).toEqual([-8, 0, 2]);
    // Ответы 1, 3–7.
    expect(addPolynomials([2, -5, 3], [-9, 7, -1])).toEqual([-7, 2, 2]);
    expect(subtractPolynomials([1, -3, 4], [-6, 2, 1])).toEqual([7, -5, 3]);
    expect(multiplyPolynomials([0, -3], [5, -1, 2])).toEqual([0, -15, 3, -6]);
    expect(multiplyPolynomials([-6, 1], [2, 1])).toEqual([-12, -4, 1]);
    expect(multiplyPolynomials([2, 3], [2, 3])).toEqual([4, 12, 9]);
    expect(expandDifferenceOfSquares(5, 4).squareDifference).toBe(9); // 25p² − 16q² при p = q = 1
    // Ответы 8–9: 52² = 2704 и 47 · 53 = 2491.
    expect(expandSumSquare(50, 2)).toMatchObject({ firstSquare: 2500, doubleProduct: 200, secondSquare: 4, total: 2704 });
    // Ответы 10–14.
    expect(factorOutCommonMonomial([0, 0, -18, 12])).toEqual({ factor: { coefficient: 6, degree: 2 }, quotient: [-3, 2] });
    expect(multiplyPolynomials([-3, 1], [2, 1])).toEqual([-6, -1, 1]); // (b − 3)(a + 2) при a = b: сверка структуры
    expect(multiplyPolynomials([-5, 3], [-5, 3])).toEqual([25, -30, 9]);
    expect(subtractPolynomials(expandedSquareAsPolynomial(1), expandedSquareAsPolynomial(-1))).toEqual([0, 4]);
    // (n + 4)² − (n − 4)² = 16n.
    expect(subtractPolynomials(multiplyPolynomials([4, 1], [4, 1]), multiplyPolynomials([-4, 1], [-4, 1]))).toEqual([0, 16]);
    expect(evaluatePolynomial([0, 16], 7) % 16).toBe(0);
  });
});

/** (a ± b)² как многочлен от a при b = ±1 — вспомогательная запись для задачи 13. */
function expandedSquareAsPolynomial(sign: 1 | -1): Polynomial {
  return multiplyPolynomials([sign, 1], [sign, 1]);
}

// ───────────────────────── Глава 3. Линейные модели ──────────────────────────

describe('7 класс · Линейные модели: числа из уроков главы', () => {
  it('3.1 Линейные уравнения', () => {
    // Таблица стоимости 50 + 8t.
    const cost = linearExpression(8, 50);
    expect([0, 5, 10, 15, 20, 25].map((t) => value(evaluateLinear(cost, t)))).toEqual([50, 90, 130, 170, 210, 250]);
    // 50 + 8t = 210 даёт t = 20; при 420 ₽ получилось бы 46,25.
    expect(root([8, 50], [0, 210])).toBe(20);
    expect(root([8, 50], [0, 420])).toBe(46.25);
    // Разобранные примеры: 3x + 4 = x − 2, 5(x + 2) = 3x + 4, x/3 + 2 = 5.
    expect(root([3, 4], [1, -2])).toBe(-3);
    expect(root([5, 10], [3, 4])).toBe(-3);
    expect(root([{ numerator: 1n, denominator: 3n }, 2], [0, 5])).toBe(9);
    // QuickCheck: 6x − 1 = 2x + 11 равносильно 4x = 12, x = 3.
    expect(root([6, -1], [2, 11])).toBe(3);
    expect(root([4, 0], [0, 12])).toBe(3);
    // Практика 1–3, 5–7, 10, 12.
    expect(root([4, 0], [0, 20])).toBe(5);
    expect(root([1, 7], [0, 3])).toBe(-4);
    expect(root([3, -5], [0, 16])).toBe(7);
    expect(root([2, -6], [0, 10])).toBe(8);
    expect(root([-2, 7], [0, 1])).toBe(3);
    expect(root([0.5, 1], [0, 4])).toBe(6);
    expect(root([8, 50], [0, 186])).toBe(17);
    // Практика 8–9: тождество и «корней нет».
    expect(solveLinearEquation(linearEquation(linearExpression(4, 4), linearExpression(4, 4))).kind).toBe('identity');
    expect(solveLinearEquation(linearEquation(linearExpression(3, 5), linearExpression(3, -1))).kind).toBe('none');
    // Практика 11: x = 2 — корень уравнения 3x − 1 = 2x + 1.
    expect(root([3, -1], [2, 1])).toBe(2);
  });

  it('3.2 Текстовые задачи через уравнение', () => {
    // Такси: 150 + 35x = 430 даёт x = 8.
    expect(root([35, 150], [0, 430])).toBe(8);
    // Карандаши: x + 3x = 48.
    expect(root([4, 0], [0, 48])).toBe(12);
    expect(3 * 12).toBe(36);
    // Догонялки: 60(t + 2) = 90t даёт t = 4, пути по 360 км.
    expect(root([60, 120], [90, 0])).toBe(4);
    expect(60 * 6).toBe(360);
    expect(90 * 4).toBe(360);
    // Периметр 46, длина на 5 больше ширины.
    expect(root([4, 10], [0, 46])).toBe(9);
    expect(2 * (9 + 14)).toBe(46);
    // QuickCheck: x + 1,5x = 30 даёт 12 девочек и 18 мальчиков.
    expect(root([2.5, 0], [0, 30])).toBe(12);
    expect(1.5 * 12).toBe(18);
    // Практика 1–2, 4–6, 8–10, 12.
    expect(root([5, -8], [0, 37])).toBe(9);
    expect(root([2, 12], [0, 60])).toBe(24);
    expect(root([2, 15], [0, 65])).toBe(25);
    expect(root([4, 0], [3, 60])).toBe(60);
    expect(4 * 60).toBe(240);
    expect(3 * 80).toBe(240);
    expect(root([3, 70], [0, 340])).toBe(90);
    expect(root([12, 12], [36, 0])).toBe(0.5);
    expect(12 * 1.5).toBe(18);
    expect(36 * 0.5).toBe(18);
    expect(root([{ numerator: 2n, denominator: 3n }, 0], [0, 40])).toBe(60);
    expect(root([3, 3], [0, 87])).toBe(28);
    expect(28 + 29 + 30).toBe(87);
    expect(root([2, 4], [0, 25])).toBe(10.5); // условие противоречиво: ученик не бывает дробным
    // Площадь прямоугольника из задачи 3.
    expect(9 * 14).toBe(126);
  });

  it('3.3 Линейная функция', () => {
    // График y = −2x + 4: точки (0; 4), (2; 0), контрольная (1; 2).
    const falling = linearExpression(-2, 4);
    expect([0, 2, 1].map((x) => value(evaluateLinear(falling, x)))).toEqual([4, 0, 2]);
    // Нуль функции y = 4x − 5.
    const rising = linearExpression(4, -5);
    expect(value(xIntercept(rising)!)).toBe(1.25);
    expect(value(evaluateLinear(rising, 0))).toBe(-5);
    // QuickCheck и практика 10: прямая через (0; 3) и (2; 7) — это y = 2x + 3.
    const through = lineThroughPoints(0, 3, 2, 7)!;
    expect(value(through.slope)).toBe(2);
    expect(value(through.intercept)).toBe(3);
    // Ошибка: y = 5x − 10 при x = 1 ниже, чем y = x + 1.
    expect(value(evaluateLinear(linearExpression(5, -10), 1))).toBe(-5);
    expect(value(evaluateLinear(linearExpression(1, 1), 1))).toBe(2);
    // Практика 1, 3–4, 7–8, 11–12.
    expect(value(evaluateLinear(rising, 3))).toBe(7);
    expect(value(evaluateLinear(linearExpression(3, -5), 2))).toBe(1);
    expect(value(evaluateLinear(linearExpression(-2, 1), -1))).toBe(3);
    const seventh = linearExpression(3, -6);
    expect(value(evaluateLinear(seventh, 0))).toBe(-6);
    expect(value(xIntercept(seventh)!)).toBe(2);
    const eighth = linearExpression(1, 2);
    expect(value(xIntercept(eighth)!)).toBe(-2);
    expect(value(evaluateLinear(eighth, 1))).toBe(3);
    expect(root([2, 1], [0, 5])).toBe(2); // k · 2 + 1 = 5
    const meeting = intersectLines(linearExpression(2, -1), linearExpression(-1, 5));
    expect(meeting.kind).toBe('point');
    if (meeting.kind === 'point') {
      expect([value(meeting.x), value(meeting.y)]).toEqual([2, 3]);
    }
  });

  it('3.4 Системы двух уравнений', () => {
    // Лаборатория: 2x + 3y = 12 и x − y = 1 пересекаются в (3; 2).
    expect(systemPair([2, 3, 12], [1, -1, 1])).toEqual([3, 2]);
    // Буфет: 3p + 2s = 210 и 2p + 4s = 260 — пирожок 40 ₽, сок 45 ₽.
    expect(systemPair([3, 2, 210], [2, 4, 260])).toEqual([40, 45]);
    // Пример со сложением: 3x + 2y = 8 и −3x + 5y = 13 дают y = 3, x = 2/3.
    const thirds = solveSystem(twoVariableEquation(3, 2, 8), twoVariableEquation(-3, 5, 13));
    expect(thirds.kind).toBe('unique');
    if (thirds.kind === 'unique') {
      expect(value(thirds.y)).toBe(3);
      expect(formatExactRussian(thirds.x)).toBe('2/3');
    }
    // Три случая: параллельные и совпавшие прямые.
    expect(solveSystem(twoVariableEquation(1, 1, 4), twoVariableEquation(2, 2, 10)).kind).toBe('none');
    expect(solveSystem(twoVariableEquation(1, 1, 4), twoVariableEquation(2, 2, 8)).kind).toBe('infinite');
    // Практика 1–5, 8–11.
    expect(systemPair([1, 1, 3], [1, -1, 1])).toEqual([2, 1]);
    expect(systemPair([1, -1, 1], [2, 3, 12])).toEqual([3, 2]);
    expect(systemPair([1, 1, 7], [1, -1, 3])).toEqual([5, 2]);
    expect(systemPair([2, 1, 8], [1, -1, 1])).toEqual([3, 2]);
    expect(systemPair([3, 2, 16], [5, -2, 16])).toEqual([4, 2]);
    expect(systemPair([2, 3, 210], [1, 2, 130])).toEqual([30, 50]);
    expect(systemPair([2, -1, 1], [1, 1, 5])).toEqual([2, 3]);
    expect(systemPair([1, 1, 25], [1, -1, 7])).toEqual([16, 9]);
    expect(systemPair([2, 3, 1500], [3, 2, 1750])).toEqual([450, 200]);
    // Практика 12: 3x − y = 2 и 6x − 2y = 5 несовместны.
    expect(solveSystem(twoVariableEquation(3, -1, 2), twoVariableEquation(6, -2, 5)).kind).toBe('none');
  });

  it('3.5 Практикум: школьный фестиваль', () => {
    // Станция 1: 1800 + 240n = 4200 даёт n = 10; бюджет 4300 ₽ дал бы 10,4.
    expect(root([240, 1800], [0, 4200])).toBe(10);
    expect(1800 + 240 * 10).toBe(4200);
    expect(root([240, 1800], [0, 4300])).toBeCloseTo(10.4166, 3);
    expect(4300 - (1800 + 240 * 10)).toBe(100);
    // Станция 2: 300 + 20n = 50n даёт n = 10 и цену 500 ₽.
    expect(root([20, 300], [50, 0])).toBe(10);
    expect(value(evaluateLinear(linearExpression(20, 300), 10))).toBe(500);
    expect(value(evaluateLinear(linearExpression(50, 0), 10))).toBe(500);
    expect(value(evaluateLinear(linearExpression(20, 300), 25))).toBe(800);
    expect(value(evaluateLinear(linearExpression(50, 0), 25))).toBe(1250);
    // Станция 3 (лаборатория): x + y = 5 и 3x − y = 3.
    expect(systemPair([1, 1, 5], [3, -1, 3])).toEqual([2, 3]);
    // QuickCheck: 2 взрослых + 3 детских = 1500, 3 + 2 = 1750 — пара (450; 200).
    expect(systemPair([2, 3, 1500], [3, 2, 1750])).toEqual([450, 200]);
    // Ответы 2–4, 6–12.
    expect(root([20, 300], [0, 1100])).toBe(40);
    expect(1250 - 800).toBe(450);
    expect(value(evaluateLinear(linearExpression(50, 0), 0))).toBe(0);
    expect(value(xIntercept(linearExpression(0.5, -3))!)).toBe(6);
    const line = lineThroughPoints(0, -1, 3, 5)!;
    expect([value(line.slope), value(line.intercept)]).toEqual([2, -1]);
    expect(value(evaluateLinear(line, 3))).toBe(5);
    expect(root([3, 0], [0, 342])).toBe(114);
    expect(2 * 114).toBe(228);
    expect(systemPair([4, 5, 3300], [2, 3, 1800])).toEqual([450, 300]);
    expect(4 * 450 + 5 * 300).toBe(3300);
    expect(systemPair([5, 3, 460], [2, 3, 265])).toEqual([65, 45]);
    expect(5 * 65 + 3 * 45).toBe(460);
    expect(solveSystem(twoVariableEquation(2, 1, 5), twoVariableEquation(4, 2, 9)).kind).toBe('none');
  });

  it('Вход в главу: входная диагностика', () => {
    expect(value(evaluateLinear(linearExpression(3, -5), 4))).toBe(7);
    expect(root([2, 0], [0, 14])).toBe(7);
    expect(multiplyPolynomials([2], [3, 1])).toEqual([6, 2]);
    expect(addPolynomials([-2, 5], [0, 3])).toEqual([-2, 8]);
    expect(320 / 4).toBe(80);
    expect(value(evaluateLinear(linearExpression(60, 0), 1))).toBe(60);
  });
});

// ──────────────────────── Глава 4. Язык доказательства ───────────────────────

describe('7 класс · Язык доказательства: числа из уроков главы', () => {
  it('4.1 Определения, аксиомы и первые теоремы', () => {
    // Разобранный пример: угол 118° и его соседи.
    expect(crossingAngles(118)).toEqual([118, 62, 118, 62]);
    expect(crossingAngles(118).reduce((sum, angle) => sum + angle, 0)).toBe(360);
    // Разность смежных углов 40°: 110° и 70°.
    expect(root([2, -40], [0, 180])).toBe(110);
    expect(adjacentAngle(110)).toBe(70);
    // QuickCheck: при угле 35° остальные — 145°, 35°, 145°.
    expect(crossingAngles(35)).toEqual([35, 145, 35, 145]);
    // Практика 1–7.
    expect(adjacentAngle(47)).toBe(133);
    expect(root([2, 0], [0, 180])).toBe(90);
    expect(root([5, 0], [0, 180])).toBe(36);
    expect(adjacentAngle(36)).toBe(144);
    expect(root([2, -26], [0, 180])).toBe(103);
    expect(adjacentAngle(103)).toBe(77);
    expect(crossingAngles(74)).toEqual([74, 106, 74, 106]);
    expect(360 - 250).toBe(110);
    expect(adjacentAngle(110)).toBe(70);
    expect(70 + 110 + 70).toBe(250);
    expect(100 / 2).toBe(50);
    expect(adjacentAngle(50)).toBe(130);
    // Практика 10: биссектрисы смежных углов перпендикулярны.
    expect(180 / 2).toBe(90);
  });

  it('4.2 Признаки равенства треугольников', () => {
    // Лаборатория: сторона 6 и углы 50° и 70° задают третий угол 60°.
    expect(thirdTriangleAngle(50, 70)).toBe(60);
    // Ловушка «три угла»: равносторонние треугольники любого размера дают по 60°.
    expect(isoscelesBaseAngle(60)).toBe(60);
    expect(thirdTriangleAngle(60, 60)).toBe(60);
    // Ловушка «две стороны и угол не между ними»: при AB = 6 и ∠A = 30°
    // расстояние от B до второго луча равно 3, поэтому отрезок 4 даёт два решения.
    expect(6 * Math.sin((30 * Math.PI) / 180)).toBeCloseTo(3, 12);
    expect(4).toBeGreaterThan(3);
    expect(4).toBeLessThan(6);
    // Практика 6: у равных треугольников соответственные элементы равны.
    expect(verticalAngle(40)).toBe(40);
    // Практика 9: прямой угол между катетами — признак I.
    expect(thirdTriangleAngle(90, 45)).toBe(45);
  });

  it('4.3 Равнобедренный треугольник', () => {
    // Чертёж урока: угол при вершине 80°, углы при основании по 50°.
    expect(isoscelesBaseAngle(80)).toBe(50);
    expect(isoscelesApexAngle(50)).toBe(80);
    // Теорема 4: равные смежные углы при основании дают по 90°.
    expect(adjacentAngle(90)).toBe(90);
    // Разобранный пример: периметр 50, основание на 4 меньше боковой.
    expect(root([3, -4], [0, 50])).toBe(18);
    expect(18 - 4).toBe(14);
    expect(18 + 18 + 14).toBe(50);
    // Лаборатория: угол при вершине 40° даёт углы при основании по 70°.
    expect(isoscelesBaseAngle(40)).toBe(70);
    // Практика 2–6, 9–10.
    expect(8 + 8 + 5).toBe(21);
    expect(root([2, 10], [0, 34])).toBe(12);
    expect(root([1, 30], [0, 40])).toBe(10);
    expect(root([3, 2], [0, 29])).toBe(9);
    expect(9 + 9 + 11).toBe(29);
    expect(21 / 3).toBe(7);
    expect(2 * 6).toBe(12);
    expect(isoscelesBaseAngle(80)).toBe(50);
  });

  it('4.4 Параллельные прямые', () => {
    // Разобранный пример: угол 52° даёт четыре по 52° и четыре по 128°.
    expect(transversalPairAngle('corresponding', 52)).toBe(52);
    expect(transversalPairAngle('alternate', 52)).toBe(52);
    expect(transversalPairAngle('co-interior', 52)).toBe(128);
    expect(crossingAngles(52).reduce((sum, angle) => sum + angle, 0)).toBe(360);
    // Односторонние в отношении 4 : 5 — это 80° и 100°.
    expect(root([9, 0], [0, 180])).toBe(20);
    expect([4 * 20, 5 * 20]).toEqual([80, 100]);
    expect(transversalPairAngle('co-interior', 80)).toBe(100);
    // QuickCheck: односторонний с углом 70° равен 110°.
    expect(transversalPairAngle('co-interior', 70)).toBe(110);
    // Практика 4–7, 9.
    expect(transversalPairAngle('co-interior', 70)).toBe(110);
    expect(transversalPairAngle('alternate', 43)).toBe(43);
    expect(transversalPairAngle('co-interior', 43)).toBe(137);
    expect(root([2, 30], [0, 180])).toBe(75);
    expect(adjacentAngle(75)).toBe(105);
    expect(transversalPairAngle('corresponding', 90)).toBe(90);
    // Практика 10: равные односторонние углы возможны только при 90°.
    expect(transversalPairAngle('co-interior', 90)).toBe(90);
    // Параллелограмм ABCD чертежа и разобранного примера: AB = 9, BC = 5, ∠A = 58°.
    const parallelogram = parallelogramLayout(9, 5, 58);
    expect(parallelogram.angles).toEqual([58, 122, 58, 122]);
    expect(parallelogram.sides).toEqual([9, 5, 9, 5]);
    expect(parallelogram.perimeter).toBe(28);
    expect(transversalPairAngle('co-interior', 58)).toBe(122);
    expect(58 + 122 + 58 + 122).toBe(360);
    expect(180 + 180).toBe(360);
    expect(2 * (9 + 5)).toBe(28);
    // Диагональ AC делит параллелограмм пополам: диагонали пересекаются в общей середине.
    expect(parallelogram.centre.x).toBeCloseTo(segmentMidpoint(parallelogram.b, parallelogram.d).x, 12);
    expect(parallelogram.centre.y).toBeCloseTo(segmentMidpoint(parallelogram.b, parallelogram.d).y, 12);
    // Практика 11–12.
    expect(adjacentAngle(58)).toBe(122);
    expect(root([2, 3], [0, 17])).toBe(7);
    expect(7 + 3).toBe(10);
    expect(2 * (7 + 10)).toBe(34);
    expect(parallelogramLayout(10, 7, 72).perimeter).toBe(34);
  });

  it('4.5 Сумма углов треугольника', () => {
    // Чертёж доказательства: углы 55°, 45° и 80°.
    expect(thirdTriangleAngle(55, 45)).toBe(80);
    // Следствия 2–4.
    expect(thirdTriangleAngle(90, 28)).toBe(62);
    expect(isoscelesBaseAngle(60)).toBe(60);
    expect(isoscelesBaseAngle(96)).toBe(42);
    // Углы в отношении 2 : 3 : 4.
    expect(root([9, 0], [0, 180])).toBe(20);
    expect([2 * 20, 3 * 20, 4 * 20]).toEqual([40, 60, 80]);
    // Внешний угол 130° при ∠A = 55°: ∠B = 75°, ∠C = 50°.
    expect(130 - 55).toBe(75);
    expect(adjacentAngle(130)).toBe(50);
    expect(55 + 75 + 50).toBe(180);
    // QuickCheck: углы 65° и 80° дают внешний 145° при третьей вершине 35°.
    expect(exteriorAngleFromRemote(65, 80)).toBe(145);
    expect(thirdTriangleAngle(65, 80)).toBe(35);
    expect(exteriorAngle(35)).toBe(145);
    // Практика 1, 5–6, 8–10.
    expect(thirdTriangleAngle(35, 75)).toBe(70);
    expect(isoscelesApexAngle(37)).toBe(106);
    expect(adjacentAngle(115)).toBe(65);
    expect(adjacentAngle(180 - 100)).toBe(100);
    expect(convexPolygonAngleSum(4)).toBe(360);
    expect(3 * 180 - 180).toBe(360);
    // Раздел «От треугольника к любому многоугольнику»: разрезание шестиугольника
    // на чертеже — 3 диагонали и 4 треугольника, сумма углов 720°.
    expect(polygonFanCut(6)).toEqual({ vertices: 6, diagonals: 3, triangles: 4, angleSum: 720 });
    // Таблица проверки: n = 3, 4, 5, 6, 8, 12.
    const table = [3, 4, 5, 6, 8, 12];
    expect(table.map((n) => polygonFanCut(n).diagonals)).toEqual([0, 1, 2, 3, 5, 9]);
    expect(table.map((n) => polygonFanCut(n).triangles)).toEqual([1, 2, 3, 4, 6, 10]);
    expect(table.map(convexPolygonAngleSum)).toEqual([180, 360, 540, 720, 1080, 1800]);
    // Угол правильного многоугольника: шестиугольник 120°, квадрат 90°, треугольник 60°.
    expect(regularPolygonAngle(6)).toBe(120);
    expect(regularPolygonAngle(4)).toBe(90);
    expect(regularPolygonAngle(3)).toBe(60);
    // Типичная ошибка: у четырёхугольника не 4 · 180° = 720°, а 2 · 180° = 360°.
    expect(4 * 180).toBe(720);
    expect(convexPolygonAngleSum(4)).toBe(360);
    // Практика 11: сумма углов восьмиугольника 1080°, угол правильного — 135°.
    expect(convexPolygonAngleSum(8)).toBe(1080);
    expect(regularPolygonAngle(8)).toBe(135);
    expect(regularPolygonAngle(8)).toBeLessThan(180);
    // Практика 12: сумма 1440° бывает у десятиугольника.
    expect(polygonVerticesFromAngleSum(1440)).toBe(10);
    expect(convexPolygonAngleSum(10)).toBe(1440);
  });

  it('4.6 Практикум: собираем доказательство', () => {
    // Станции 1–3: чертежи считаются, а не рисуются.
    expect(crossingAngles(57)).toEqual([57, 123, 57, 123]);
    expect(transversalPairAngle('alternate', 72)).toBe(72);
    expect(transversalPairAngle('co-interior', 72)).toBe(108);
    expect(thirdTriangleAngle(55, 65)).toBe(60);
    expect(exteriorAngleFromRemote(55, 65)).toBe(120);
    // Разобранный пример: внешний угол 130° при вершине C равнобедренного треугольника.
    expect(adjacentAngle(130)).toBe(50);
    expect(isoscelesBaseAngle(50)).toBe(65);
    expect(65 + 65 + 50).toBe(180);
    expect(exteriorAngleFromRemote(65, 65)).toBe(130);
    // Ответы 1–3, 5–9, 11.
    expect(root([2, 54], [0, 180])).toBe(63); // x + (x + 54°) = 180°
    expect(adjacentAngle(63)).toBe(117);
    expect(root([6, 0], [0, 180])).toBe(30);
    expect(crossingAngles(30)).toEqual([30, 150, 30, 150]);
    expect(root([3, 0], [0, 180])).toBe(60);
    expect(transversalPairAngle('co-interior', 60)).toBe(120);
    expect(root([4, 0], [0, 100])).toBe(25); // ∠A + ∠B = 100°, ∠A = 3∠B
    expect(3 * 25).toBe(75);
    expect(75 + 25 + 80).toBe(180);
    expect(adjacentAngle(108)).toBe(72);
    expect(108 - 47).toBe(61);
    expect(72 + 47 + 61).toBe(180);
    expect(root([2, 16], [0, 46])).toBe(15);
    expect(root([1, 26], [0, 34])).toBe(8);
    expect(isoscelesBaseAngle(44)).toBe(68);
    // Задача 11: ∠A = 60°, биссектриса даёт ∠BAD = 30°, ∠ADB = 100°.
    expect(thirdTriangleAngle(50, 70)).toBe(60);
    expect(60 / 2).toBe(30);
    expect(thirdTriangleAngle(50, 30)).toBe(100);
    expect(exteriorAngleFromRemote(70, 30)).toBe(100);
  });
});

// ─────────────────────── Глава 5. Данные и случайность ───────────────────────

const CLUB_TIMES = [30, 32, 33, 34, 35, 36, 38, 40, 42] as const;
const SHOTS = [2, 3, 1, 4, 2, 3, 0, 2, 5, 3, 1, 2, 4, 3, 2, 1, 3, 5, 4, 3] as const;
const HEIGHTS = [
  157, 142, 163, 151, 168, 155, 149, 162, 158, 145, 171, 153, 159, 165, 148, 156, 174, 161, 152, 167,
] as const;
const MARKS = [4, 3, 5, 4, 4, 3, 5, 4, 2, 3, 4, 5, 3, 4, 4, 3, 5, 2, 4, 3, 5, 4, 3, 4, 5] as const;
const GIFT_NINE = [200, 250, 250, 300, 300, 350, 400, 450, 500] as const;

describe('7 класс · Данные и случайность: числа из уроков главы', () => {
  it('5.1 Среднее и медиана', () => {
    // Вариант A: десятый результат 40 с.
    const variantA = [...CLUB_TIMES, 40];
    expect(variantA.reduce((sum, item) => sum + item, 0)).toBe(360);
    expect(sampleSummary(variantA)).toMatchObject({ mean: 36, median: 35.5, range: 12 });
    // Вариант B: десятый результат 300 с.
    const variantB = [...CLUB_TIMES, 300];
    expect(variantB.reduce((sum, item) => sum + item, 0)).toBe(620);
    expect(sampleSummary(variantB)).toMatchObject({ mean: 62, median: 35.5, range: 270 });
    // Девять из десяти собирают быстрее 43 секунд.
    expect(variantB.filter((item) => item < 43)).toHaveLength(9);
    // QuickCheck: 4, 5, 6, 7, 100 → 4, 5, 6, 7, 1000.
    expect(mean([4, 5, 6, 7, 100])).toBeCloseTo(24.4, 12);
    expect(mean([4, 5, 6, 7, 1000])).toBeCloseTo(204.4, 12);
    expect(median([4, 5, 6, 7, 100])).toBe(6);
    expect(median([4, 5, 6, 7, 1000])).toBe(6);
    // Ошибка: медиана ряда 7, 2, 9 равна 7, а не 5,5.
    expect(median([7, 2, 9])).toBe(7);
    expect(mean([2, 9])).toBe(5.5);
    // Практика 1–3, 6–11.
    expect(sampleSummary([4, 7, 2, 9, 3])).toMatchObject({ mean: 5, median: 4, range: 7 });
    expect(sampleSummary([12, 14, 15, 15, 16, 18])).toMatchObject({ mean: 15, median: 15, range: 6 });
    expect(sampleSummary([3, 5, 5, 7, 30])).toMatchObject({ mean: 10, median: 5 });
    expect([3, 5, 5, 7, 30].filter((item) => item < 8)).toHaveLength(4);
    expect(8 * 7).toBe(56);
    expect(mean([7, 7, 7, 7, 12])).toBe(8);
    expect(mean([...Array(5).fill(160), ...Array(5).fill(155)])).toBe(157.5);
    expect(median([8, 9, 9, 11, 12, 13])).toBe(10);
    expect(sampleSummary([1, 2, 4, 5, 18])).toMatchObject({ mean: 6, median: 4 });
    expect(range([5, 5, 5, 5])).toBe(0);
  });

  it('5.2 Частоты и диаграммы', () => {
    // Таблица частот отметок: 2, 7, 10, 6 из 25.
    const marks = frequencyTable([...MARKS]);
    expect(marks.map((row) => row.count)).toEqual([2, 7, 10, 6]);
    expect(marks.map((row) => roundTo(row.relativeFrequency, 4))).toEqual([0.08, 0.28, 0.4, 0.24]);
    expect(marks.reduce((sum, row) => sum + row.count, 0)).toBe(25);
    expect(roundTo(marks.reduce((sum, row) => sum + row.relativeFrequency, 0), 6)).toBe(1);
    expect(sampleSummary([...MARKS])).toMatchObject({ mean: 3.8, median: 4, range: 3 });
    // Группировка роста по 10 см от 140.
    const groups = groupIntoIntervals([...HEIGHTS], 10, 140);
    expect(groups.map((row) => [row.from, row.to, row.count])).toEqual([
      [140, 150, 4],
      [150, 160, 8],
      [160, 170, 6],
      [170, 180, 2],
    ]);
    expect(groups.map((row) => roundTo(row.relativeFrequency, 4))).toEqual([0.2, 0.4, 0.3, 0.1]);
    expect(groups.reduce((sum, row) => sum + row.count, 0)).toBe(20);
    // Характеристики роста: 157,8; 157,5; 32.
    expect([...HEIGHTS].reduce((sum, item) => sum + item, 0)).toBe(3156);
    expect(sampleSummary([...HEIGHTS])).toMatchObject({ mean: 157.8, median: 157.5, range: 32 });
    // QuickCheck и практика 9: 6 : 25 = 0,24 больше, чем 7 : 35 = 0,2.
    expect(relativeFrequency(6, 25)).toBe(0.24);
    expect(relativeFrequency(7, 35)).toBeCloseTo(0.2, 12);
    expect(roundTo(0.24 / 0.2, 6)).toBe(1.2);
    // Ошибка: доля четвёрок равна 10 : 25 = 0,4.
    expect(relativeFrequency(10, 25)).toBe(0.4);
    // Практика 3–4: ряд попаданий.
    const shots = frequencyTable([...SHOTS]);
    expect(shots.map((row) => row.count)).toEqual([1, 3, 5, 6, 3, 2]);
    expect(shots.map((row) => roundTo(row.relativeFrequency, 4))).toEqual([0.05, 0.15, 0.25, 0.3, 0.15, 0.1]);
    expect(sampleSummary([...SHOTS])).toMatchObject({ mean: 2.65, median: 3, range: 5 });
    // Практика 6–8, 10.
    expect(0.35 * 200).toBeCloseTo(70, 12);
    expect(roundTo(1 - 0.95, 4)).toBe(0.05);
    expect(0.05 * 200).toBeCloseTo(10, 12);
    expect(roundTo(0.28 * 360, 4)).toBe(100.8);
    expect(groupIntoIntervals([...HEIGHTS], 5, 140)).toHaveLength(7);
  });

  it('5.3 Случайный опыт', () => {
    // Таблица устойчивости частоты (серия № 11).
    const coin = [
      [10, 7, 0.7],
      [20, 13, 0.65],
      [50, 28, 0.56],
      [100, 56, 0.56],
      [200, 108, 0.54],
      [500, 248, 0.496],
      [1000, 482, 0.482],
    ] as const;
    for (const [n, m, expected] of coin) {
      expect(roundTo(relativeFrequency(m, n), 6)).toBe(expected);
    }
    // Число орлов отклоняется всё сильнее: на 2 при n = 10 и на 18 при n = 1000.
    expect(Math.abs(7 - 10 / 2)).toBe(2);
    expect(Math.abs(482 - 1000 / 2)).toBe(18);
    // Кубик: первые 12 бросков серии № 7 дали пять шестёрок.
    const dozen = [2, 6, 4, 6, 1, 6, 3, 1, 1, 6, 6, 4];
    expect(dozen.filter((item) => item === 6)).toHaveLength(5);
    expect(roundTo(relativeFrequency(5, 12), 3)).toBe(0.417);
    expect(roundTo(0.417 / roundTo(1 / 6, 3), 1)).toBe(2.5);
    // Кубик: 600 бросков, шесть частот.
    const faces = [104, 99, 106, 87, 95, 109];
    expect(faces.reduce((sum, item) => sum + item, 0)).toBe(600);
    expect(faces.map((item) => roundTo(relativeFrequency(item, 600), 3))).toEqual([
      0.173, 0.165, 0.177, 0.145, 0.158, 0.182,
    ]);
    expect(roundTo(Math.abs(relativeFrequency(109, 600) - 1 / 6), 3)).toBe(0.015);
    // Чётная грань: 99 + 87 + 109 = 295, доля ≈ 0,492.
    expect(faces[1]! + faces[3]! + faces[5]!).toBe(295);
    expect(roundTo(relativeFrequency(295, 600), 3)).toBe(0.492);
    // Кнопка (серия № 3): частота успокаивается около 0,7.
    const pin = [
      [10, 6, 0.6],
      [20, 13, 0.65],
      [50, 37, 0.74],
      [100, 71, 0.71],
      [200, 138, 0.69],
    ] as const;
    for (const [n, m, expected] of pin) {
      expect(roundTo(relativeFrequency(m, n), 6)).toBe(expected);
    }
    // Ошибка «монета отыграется»: 5 + 498 из 1000 — это около 0,503.
    expect(Math.round(995 / 2)).toBe(498);
    expect(roundTo(relativeFrequency(5 + 498, 1000), 3)).toBe(0.503);
    // Практика 2, 5, 9–10.
    expect(roundTo(Math.abs(relativeFrequency(482, 1000) - 0.5), 4)).toBe(0.018);
    expect(0.35 * 400).toBeCloseTo(140, 12);
    expect(relativeFrequency(3, 12)).toBe(0.25);
    expect(0.25 * 200).toBe(50);
  });

  it('5.4 Практикум: отчёт по данным', () => {
    // Станция 1 и ответы 1–2: девять взносов дают 3000 ₽.
    expect([...GIFT_NINE].reduce((sum, item) => sum + item, 0)).toBe(3000);
    const usual = [...GIFT_NINE, 400];
    expect(sampleSummary(usual)).toMatchObject({ mean: 340, median: 325, range: 300 });
    const outlier = [...GIFT_NINE, 5000];
    expect(sampleSummary(outlier)).toMatchObject({ mean: 800, median: 325, range: 4800 });
    // Восемь взносов из десяти меньше 500 ₽ (а строго меньше 450 — только семь).
    expect(outlier.filter((item) => item < 500)).toHaveLength(8);
    expect(outlier.filter((item) => item < 450)).toHaveLength(7);
    // Ответ 3: таблица частот попаданий, самая многочисленная группа — три попадания.
    const shots = frequencyTable([...SHOTS]);
    expect(shots.map((row) => row.count)).toEqual([1, 3, 5, 6, 3, 2]);
    const top = shots.reduce((best, row) => (row.count > best.count ? row : best), shots[0]!);
    expect(top).toMatchObject({ value: 3, count: 6 });
    expect(roundTo(top.relativeFrequency, 4)).toBe(0.3);
    // Ответ 4: среднее 2,65, медиана 3, размах 5.
    expect(sampleSummary([...SHOTS])).toMatchObject({ mean: 2.65, median: 3, range: 5 });
    // Ответ 5: интервалы ширины 2 от нуля.
    const grouped = groupIntoIntervals([...SHOTS], 2, 0);
    expect(grouped.map((row) => [row.from, row.to, row.count])).toEqual([
      [0, 2, 4],
      [2, 4, 11],
      [4, 6, 5],
    ]);
    expect(grouped.map((row) => roundTo(row.relativeFrequency, 4))).toEqual([0.2, 0.55, 0.25]);
    expect(roundTo(grouped.reduce((sum, row) => sum + row.relativeFrequency, 0), 6)).toBe(1);
    // Ответы 6–11.
    expect(relativeFrequency(8, 25)).toBe(0.32);
    expect(roundTo(relativeFrequency(9, 30), 4)).toBe(0.3);
    expect(roundTo(0.55 * 360, 4)).toBe(198);
    expect(roundTo(relativeFrequency(138, 200), 4)).toBe(0.69);
    expect(0.69 * 1000).toBeCloseTo(690, 12);
    expect(roundTo(relativeFrequency(28, 50), 4)).toBe(0.56);
    expect(Math.abs(28 - 50 / 2)).toBe(3);
    expect(relativeFrequency(1, 5)).toBe(0.2);
  });

  it('Вход в главу: входная диагностика', () => {
    expect(mean([4, 6, 8])).toBe(6);
    expect([7, 2, 9, 4].slice().sort((a, b) => a - b)).toEqual([2, 4, 7, 9]);
    expect(median([3, 5, 11])).toBe(5);
    expect(range([4, 19])).toBe(15);
    expect(relativeFrequency(5, 20)).toBe(0.25);
    expect(roundTo(0.4 * 100, 4)).toBe(40);
  });
});
