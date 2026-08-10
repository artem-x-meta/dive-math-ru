/**
 * Числа, напечатанные в уроках 11 класса.
 *
 * Каждый `it` соответствует одному уроку, а каждая проверка пересчитывает
 * ответ ядром из `src/lib` (или прямой формулой там, где ядра нет) и сравнивает
 * с числом, которое стоит в тексте урока. Константы с константами здесь не
 * сравниваются: слева всегда вычисление, справа — то, что читает ученик.
 *
 * Главы «Интеграл», «Тела вращения» и «Векторы в пространстве» уже покрыты
 * блоками «числа из главы» в tests/integrals.test.ts, tests/revolution.test.ts
 * и tests/vectors3d.test.ts, поэтому здесь для них проверено только то,
 * чего там нет.
 */

import { describe, expect, it } from 'vitest';

import {
  addExponents,
  exactLog,
  exponentText,
  expValue,
  firstPermanentLead,
  formatExact,
  growthValue,
  intersectIntervals,
  intervalText,
  logValue,
  multiplyExponents,
  rationalPowerExact,
  rationalPowerValue,
  solveExponentialEquation,
  solveExponentialInequality,
  solveLogEquation,
  solveLogInequality,
  subtractExponents,
  type GrowthModel,
  type RationalExponent,
} from '../src/lib/explog';
import { divideExact } from '../src/lib/exactRational';

import {
  chainRuleParts,
  criticalPoints,
  derivativeAt,
  differentiate,
  extremaOnSegment,
  lineText,
  monotonicityIntervals,
  polynomialRoots,
  productRuleParts,
  quotientRuleParts,
  secantSlope,
  tangentLine,
  valueAt,
  type Polynomial,
} from '../src/lib/derivatives';

import {
  areaBetween,
  crossingPoints,
  definiteIntegral,
  riemannSum,
} from '../src/lib/integrals';

import {
  coneMetrics,
  cylinderMetrics,
  formatExactPi,
  type Measure,
} from '../src/lib/revolution';

import {
  areCoplanar3,
  distanceBetweenPlaneEquations,
  distanceToPlaneEquation,
  dot3,
  formatPlaneEquation,
  length3,
  planeEquation,
  planeEquationThroughPoints,
  planeNormal,
  point3,
  vec3,
} from '../src/lib/vectors3d';

import {
  chebyshevBound,
  correlationCoefficient,
  diceSumDistribution,
  fairPrice,
  gameDistribution,
  marginOfError,
  netExpectation,
  normalBandProbability,
  normalCdf,
  requiredSampleSize,
  simulateSampleShares,
  standardDeviation,
  standardError,
  standardScore,
  varianceThroughSquares,
  withinSigmaProbability,
  type GameOutcome,
} from '../src/lib/stochastics';
import { expectedValue } from '../src/lib/combinatorics';
import { distributionVariance } from '../src/lib/conditional';
import { fraction, fractionToNumber } from '../src/lib/probability';

/** Точное значение a^(p/q) русской записью — как в ответах уроков. */
const power = (base: Parameters<typeof rationalPowerExact>[0], p: number, q: number): string =>
  formatExact(rationalPowerExact(base, p, q)!);

/** Показатель дробью: {numerator, denominator}. */
const exp = (numerator: number, denominator: number): RationalExponent => ({ numerator, denominator });

/** Округление до заданного числа знаков — для сверки с «≈» в тексте. */
const round = (value: number, digits: number): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const degrees = (radians: number): number => (radians * 180) / Math.PI;

/** Точная запись величины с π: «48π», «12π» — или ошибка, если точной формы нет. */
const exactText = (measure: Measure): string => {
  if (measure.exact === null) throw new Error('Ожидалась точная форма');
  return formatExactPi(measure.exact);
};

// ─────────────────────────── 1. Экспонента и логарифм ────────────────────────

describe('11 класс · «Экспонента и логарифм»', () => {
  it('урок 1.1: степень с рациональным показателем', () => {
    // Разбор «Четыре значения в уме».
    expect(power(8, 2, 3)).toBe('4');
    expect(power(16, 3, 4)).toBe('8');
    expect(power(27, -2, 3)).toBe('1/9');
    expect(power('0.25', 1, 2)).toBe('0,5');

    // Разбор «Упрощение выражения»: (a^(1/2)·a^(1/3))^6 = a^5, проверка при a = 64.
    expect(exponentText(multiplyExponents(addExponents(exp(1, 2), exp(1, 3)), exp(6, 1)))).toBe('5');
    expect(power(64, 1, 2)).toBe('8');
    expect(power(64, 1, 3)).toBe('4');
    expect(rationalPowerValue(64, 1, 2) * rationalPowerValue(64, 1, 3)).toBeCloseTo(32, 10);
    expect(32 ** 6).toBe(2 ** 30);
    expect(power(64, 5, 1)).toBe(String(2 ** 30));

    // QuickCheck: 32^(2/5) = 4, а 64 — это 32^(6/5).
    expect(power(32, 2, 5)).toBe('4');
    expect(power(32, 6, 5)).toBe('64');

    // Ошибка урока: 9^(1/2) = 3, а не 4,5.
    expect(power(9, 1, 2)).toBe('3');
    expect(4.5 ** 2).toBe(20.25);

    // Практика 1–14.
    expect(power(4, 1, 2)).toBe('2');
    expect(power(125, 1, 3)).toBe('5');
    expect(power(81, 3, 4)).toBe('27');
    expect(power(32, 2, 5)).toBe('4');
    // Ядро печатает конечные дроби десятичной записью; в уроке те же числа стоят как 1/4.
    expect(power(16, -1, 2)).toBe('0,25');
    expect(power(8, -2, 3)).toBe('0,25');
    expect(rationalPowerValue(16, -1, 2)).toBeCloseTo(1 / 4, 12);
    expect(rationalPowerValue(8, -2, 3)).toBeCloseTo(1 / 4, 12);
    expect(power(divideExact(1, 9), -1, 2)).toBe('3');
    expect(power('0.008', 1, 3)).toBe('0,2');
    expect(exponentText(addExponents(exp(1, 2), exp(1, 2)))).toBe('1');
    expect(power(5, 1, 1)).toBe('5');
    expect(exponentText(subtractExponents(exp(3, 4), exp(1, 4)))).toBe('1/2');
    expect(exponentText(multiplyExponents(exp(2, 3), exp(3, 2)))).toBe('1');
    expect(power(2, 1, 1)).toBe('2');
    expect(exponentText(multiplyExponents(exp(3, 4), exp(8, 3)))).toBe('2');
    expect(exponentText(addExponents(exp(1, 3), exp(1, 6)))).toBe('1/2');

    // Практика 15: 2^(1/2) > 2^(1/3), потому что шестые степени 8 и 4.
    expect(rationalPowerValue(2, 1, 2)).toBeGreaterThan(rationalPowerValue(2, 1, 3));
    expect(power(2, 6, 2)).toBe('8');
    expect(power(2, 6, 3)).toBe('4');

    // Практика 16: отрицательное основание запрещено.
    expect(() => rationalPowerExact(-4, 1, 2)).toThrow('положительного основания');
  });

  it('урок 1.2: показательная функция', () => {
    // Вступление: лист 0,1 мм, сложенный 42 раза, — около 440 000 км.
    const foldedKm = (0.1 * 2 ** 42) / 1e6;
    expect(Math.round(foldedKm / 10_000) * 10_000).toBe(440_000);

    // Лаборатория: обгон 2^x над x² навсегда начинается с x = 5.
    const model: GrowthModel = { base: 2, degree: 2, slope: 10, maxX: 12 };
    expect(firstPermanentLead(model)).toBe(5);

    // Разбор «Вклад под сложный процент»: 5000 · 1,08^10 ≈ 10 795 ₽.
    expect(1.08 ** 2).toBeCloseTo(1.1664, 12);
    expect(round(1.08 ** 4, 5)).toBe(1.36049);
    expect(round(1.08 ** 8, 5)).toBe(1.85093);
    expect(round(1.08 ** 10, 5)).toBe(2.15892);
    expect(Math.round(5000 * 1.08 ** 10)).toBe(10_795);

    // Разбор «Распад»: 40 г, период 8 суток, через 24 суток осталось 5 г.
    expect(24 / 8).toBe(3);
    expect(40 * expValue(0.5, 3)).toBe(5);

    // Практика 4–6: сравнения по монотонности.
    expect(expValue(2, 3.1)).toBeLessThan(expValue(2, 3.5));
    expect(expValue(1 / 3, -2)).toBeGreaterThan(expValue(1 / 3, -1));
    expect(expValue(1 / 3, -2)).toBeCloseTo(9, 10);
    expect(expValue(1 / 3, -1)).toBeCloseTo(3, 10);
    expect(expValue(5, 0)).toBeGreaterThan(expValue(5, -0.2));

    // Практика 8: 2^x = 1 даёт единственный корень x = 0.
    expect(solveExponentialEquation(2, 1).exact).toEqual({ numerator: 0, denominator: 1 });

    // Практика 9–11, 14.
    expect(500 * expValue(2, 6)).toBe(32_000);
    expect(round(1.06 ** 2, 5)).toBe(1.1236);
    expect(round(1.06 ** 4, 5)).toBe(1.26248);
    expect(round(1.06 ** 5, 5)).toBe(1.33823);
    expect(round(20_000 * 1.06 ** 5, 2)).toBe(26_764.51);
    expect(64 * expValue(0.5, 15 / 5)).toBe(8);
    expect(0.85 ** 3).toBeCloseTo(0.614125, 12);
    expect(round(0.85 ** 3 * 100, 1)).toBe(61.4);

    // Практика 12: 2^x > x² при целых x от 1 до 5 — только x = 1 и x = 5.
    const winners = [1, 2, 3, 4, 5].filter(
      (x) => growthValue(model, 'exponential', x) > growthValue(model, 'power', x),
    );
    expect(winners).toEqual([1, 5]);

    // Ошибка урока: 2^10 = 1024 против 10² = 100, 2^20 против 20².
    expect(growthValue(model, 'exponential', 10)).toBe(1024);
    expect(growthValue(model, 'power', 10)).toBe(100);
    expect(growthValue(model, 'exponential', 20)).toBe(1_048_576);
    expect(growthValue(model, 'power', 20)).toBe(400);
    expect(growthValue(model, 'exponential', 3)).toBeLessThan(3 ** 2);
  });

  it('урок 1.3: логарифм', () => {
    // Разбор «Пять логарифмов в уме».
    expect(exactLog(2, 32)).toEqual({ numerator: 5, denominator: 1 });
    expect(exactLog(3, divideExact(1, 9))).toEqual({ numerator: -2, denominator: 1 });
    expect(exactLog(divideExact(1, 2), 8)).toEqual({ numerator: -3, denominator: 1 });
    expect(exactLog(9, 27)).toEqual({ numerator: 3, denominator: 2 });
    expect(exactLog(5, 1)).toEqual({ numerator: 0, denominator: 1 });
    expect(rationalPowerValue(9, 3, 2)).toBe(27);

    // Разбор «Свойства в действии».
    expect(exactLog(6, 2 * 18)).toEqual({ numerator: 2, denominator: 1 });
    expect(exactLog(2, 40 / 5)).toEqual({ numerator: 3, denominator: 1 });
    expect(exactLog(5, 9 * (25 / 9))).toEqual({ numerator: 2, denominator: 1 });
    expect(logValue(2, 3) * logValue(3, 8)).toBeCloseTo(logValue(2, 8), 12);
    expect(logValue(2, 8)).toBe(3);
    expect(4 ** logValue(2, 3)).toBeCloseTo(9, 10);

    // QuickCheck: log₄ 8 = 1,5, а не 2 и не 0,5.
    expect(exactLog(4, 8)).toEqual({ numerator: 3, denominator: 2 });
    expect(logValue(4, 8)).toBeCloseTo(1.5, 12);
    expect(logValue(4, 16)).toBeCloseTo(2, 12);
    expect(logValue(4, 0.5 * 8)).not.toBeCloseTo(0.5, 3);

    // Ошибка урока: log₂(4 + 4) = 3, а log₂4 + log₂4 = 4.
    expect(logValue(2, 4 + 4)).toBe(3);
    expect(logValue(2, 4) + logValue(2, 4)).toBe(4);
    expect(logValue(2, 8) / logValue(2, 4)).toBeCloseTo(1.5, 12);
    expect(logValue(4, 8)).toBeCloseTo(logValue(2, 8) / logValue(2, 4), 12);

    // Практика 1–15.
    expect(exactLog(2, 64)).toEqual({ numerator: 6, denominator: 1 });
    expect(exactLog(3, 81)).toEqual({ numerator: 4, denominator: 1 });
    expect(exactLog(5, divideExact(1, 25))).toEqual({ numerator: -2, denominator: 1 });
    expect(exactLog(divideExact(1, 3), 9)).toEqual({ numerator: -2, denominator: 1 });
    expect(exactLog(10, 1000)).toEqual({ numerator: 3, denominator: 1 });
    expect(exactLog(10, '0.01')).toEqual({ numerator: -2, denominator: 1 });
    expect(exactLog(4, 8)).toEqual({ numerator: 3, denominator: 2 });
    expect(exactLog(8, 4)).toEqual({ numerator: 2, denominator: 3 });
    expect(exactLog(7, 1)).toEqual({ numerator: 0, denominator: 1 });
    expect(3 ** logValue(3, 11)).toBeCloseTo(11, 10);
    expect(exactLog(2, 5 * 6.4)).toEqual({ numerator: 5, denominator: 1 });
    expect(exactLog(12, 144 / 12)).toEqual({ numerator: 1, denominator: 1 });
    expect(exactLog(3, Math.sqrt(3))).toBeNull(); // √3 не рационально, но значение — 1/2
    expect(logValue(3, Math.sqrt(3))).toBeCloseTo(0.5, 12);
    expect(2 * logValue(6, 3) + 2 * logValue(6, 2)).toBeCloseTo(2, 12);
    expect(logValue(2, 3) * logValue(3, 16)).toBeCloseTo(4, 12);
  });

  it('урок 1.4: логарифмическая функция', () => {
    // Вступление: магнитуда, децибелы, pH.
    expect(round(10 ** 1.5, 0)).toBe(32);
    expect(10 ** ((80 - 40) / 10)).toBe(10_000);
    expect(10 ** (5 - 3)).toBe(100);

    // Разбор «Сравнение и оценка»: 6 < log₂100 < 7 и предел роста до 1024.
    expect(2 ** 6).toBe(64);
    expect(2 ** 7).toBe(128);
    expect(Math.floor(logValue(2, 100))).toBe(6);
    expect(2 ** 10).toBe(1024);
    expect(logValue(2, 3)).toBeGreaterThan(1);
    expect(logValue(3, 2)).toBeLessThan(1);

    // Разбор «Децибелы»: +20 дБ — это рост интенсивности в 100 раз.
    expect(10 ** (20 / 10)).toBe(100);

    // Ошибка урока: логарифм не обязан быть положительным.
    expect(logValue(2, 8)).toBe(3);
    expect(logValue(2, 1)).toBe(0);
    expect(logValue(2, 0.5)).toBe(-1);
    expect(logValue(2, 0.125)).toBe(-3);

    // Практика 5–9: сравнения и оценки между целыми.
    expect(logValue(4, 9)).toBeLessThan(logValue(4, 11));
    expect(logValue(0.3, 2)).toBeGreaterThan(logValue(0.3, 5));
    expect(logValue(7, 1)).toBeGreaterThan(logValue(7, 0.5));
    expect(3 ** 3).toBeLessThan(50);
    expect(50).toBeLessThan(3 ** 4);
    expect(Math.floor(logValue(3, 50))).toBe(3);
    expect(10 ** 3).toBeLessThan(2026);
    expect(2026).toBeLessThan(10 ** 4);
    expect(Math.floor(logValue(10, 2026))).toBe(3);

    // Практика 14–16.
    expect(10 * logValue(10, 1000)).toBe(30);
    expect(-logValue(10, 1e-5)).toBe(5);
    expect(power(8, 1, 3)).toBe('2'); // a³ = 8 ⟹ a = 2
  });

  it('урок 1.5: уравнения и неравенства', () => {
    // Разбор «Приведение к одному основанию».
    expect(exactLog(2, 8)!.numerator - 1).toBe(2); // 2^(x+1) = 8 ⟹ x = 2
    expect((exactLog(3, divideExact(1, 27))!.numerator + 1) / 2).toBe(-1); // 3^(2x−1) = 1/27
    expect(-exactLog(4, 64)!.numerator).toBe(-3); // (1/4)^x = 64

    // Разбор «Когда общего основания нет»: t = lg2 / lg1,08 ≈ 9,01.
    expect(round(0.30103 / 0.03342, 2)).toBe(9.01);
    expect(round(logValue(1.08, 2), 2)).toBe(9.01);
    expect(round(1.08 ** 9, 3)).toBe(1.999);
    expect(round(1.08 ** 10, 3)).toBe(2.159);

    // Разбор «Замена переменной»: 4^x − 5·2^x + 4 = 0.
    const swap = polynomialRoots([4, -5, 1]).map((root) => root.x);
    expect(swap).toEqual([1, 4]);
    expect(swap.map((t) => logValue(2, t))).toEqual([0, 2]);
    expect(4 ** 0 - 5 * 2 ** 0 + 4).toBe(0);
    expect(4 ** 2 - 5 * 2 ** 2 + 4).toBe(0);

    // Разборы логарифмических уравнений.
    expect(solveLogEquation(2, 1, -3, 4).x).toBe(19); // log₂(x − 3) = 4
    expect(polynomialRoots([-3, -2, 1]).map((r) => r.x)).toEqual([-1, 3]); // x² − 3 = 2x
    expect(3 ** 2 - 3).toBe(6);
    expect(2 * 3).toBe(6);

    // Разбор «Три неравенства» и QuickCheck.
    expect(intervalText(solveExponentialInequality(0.5, 8, '>'))).toBe('(−∞; −3)');
    expect(expValue(0.5, -4)).toBe(16);
    expect(expValue(0.5, -2)).toBe(4);
    expect(intervalText(solveLogInequality(2, 1, -3, 4, '<'))).toBe('(3; 19)');
    expect(intervalText(intersectIntervals(
      solveExponentialInequality(2, 8, '>'),
      solveExponentialInequality(2, 32, '<'),
    ))).toBe('(3; 5)');
    expect(intervalText(solveExponentialInequality(1 / 3, 9, '>'))).toBe('(−∞; −2)');

    // Ошибки урока: перевёрнутый знак и потерянное ОДЗ.
    expect(intervalText(solveLogInequality(0.5, 1, 0, 1, '>'))).toBe('(0; 0,5)');
    expect(logValue(0.5, 4)).toBe(-2);
    expect(polynomialRoots([-12, -1, 1]).map((r) => r.x)).toEqual([-3, 4]);

    // Практика 1–17.
    expect(solveExponentialEquation(2, 32).exact).toEqual({ numerator: 5, denominator: 1 });
    expect(exactLog(3, 9)!.numerator + 1).toBe(3);
    expect(exactLog(5, divideExact(1, 125))!.numerator / 2).toBe(-1.5);
    expect(-exactLog(4, 64)!.numerator).toBe(-3);
    expect(solveExponentialEquation(7, 0).solvable).toBe(false);
    const swap9 = polynomialRoots([3, -4, 1]).map((root) => root.x);
    expect(swap9).toEqual([1, 3]);
    expect(swap9.map((t) => logValue(3, t))).toEqual([0, 1]);
    expect(9 ** 1 - 4 * 3 ** 1 + 3).toBe(0);
    expect(solveLogEquation(3, 1, 0, 4).x).toBe(81);
    expect(solveLogEquation(5, 2, 1, 2).x).toBe(12);
    expect((-7 + 1) / (1 - 3)).toBe(3); // x − 1 = 3x − 7
    expect(intervalText(solveExponentialInequality(2, 16, '>'))).toBe('(4; +∞)');
    expect(intervalText(solveExponentialInequality(0.2, 0.04, '>='))).toBe('(−∞; 2]');
    expect(intervalText(solveExponentialInequality(3, 1 / 9, '<'))).toBe('(−∞; −2)');
    expect(intervalText(solveLogInequality(2, 1, 0, 3, '>'))).toBe('(8; +∞)');
    expect(intervalText(solveLogInequality(1 / 3, 1, 0, -2, '>='))).toBe('(0; 9]');
    expect(intervalText(solveLogInequality(5, 1, -2, 1, '<='))).toBe('(2; 7]');

    // Практика 18: 1,08^t ⩾ 2 — десять полных лет.
    expect(Math.ceil(logValue(1.08, 2))).toBe(10);
  });

  it('урок 1.6: практикум главы', () => {
    // Станция 1: при x = 3 степенная впереди, при x = 16 — уже нет.
    const model: GrowthModel = { base: 2, degree: 3, slope: 20, maxX: 16 };
    expect(growthValue(model, 'exponential', 3)).toBe(8);
    expect(growthValue(model, 'power', 3)).toBe(27);
    expect(growthValue(model, 'power', 3) / growthValue(model, 'exponential', 3)).toBeGreaterThan(3);
    expect(growthValue(model, 'exponential', 16)).toBe(65_536);
    expect(growthValue(model, 'power', 16)).toBe(4096);

    // Станция 2: точка (−1; 1/3) на y = 3^x и её пара (1/3; −1) на y = log₃x.
    expect(expValue(3, -1)).toBeCloseTo(1 / 3, 12);
    expect(logValue(3, 1 / 3)).toBeCloseTo(-1, 12);
    expect((-1 + 1 / 3) / 2).toBeCloseTo(-1 / 3, 12);
    expect((1 / 3 - 1) / 2).toBeCloseTo(-1 / 3, 12);

    // Итоговый набор 1–7.
    expect(power(27, 4, 3)).toBe('81');
    expect(power(16, -3, 4)).toBe('0,125'); // ядро печатает конечную дробь, в уроке — 1/8
    expect(rationalPowerValue(16, -3, 4)).toBeCloseTo(1 / 8, 12);
    expect(exponentText(addExponents(multiplyExponents(exp(1, 3), exp(9, 2)), exp(-1, 2)))).toBe('1');
    expect(exactLog(2, 96 / 3)).toEqual({ numerator: 5, denominator: 1 });
    expect(exactLog(6, 4 * 9)).toEqual({ numerator: 2, denominator: 1 });
    expect(4 ** logValue(2, 3)).toBeCloseTo(9, 10);
    expect(2 ** 9).toBeLessThan(1000);
    expect(1000).toBeLessThan(2 ** 10);
    expect(Math.floor(logValue(2, 1000))).toBe(9);

    // Итоговый набор 8–12.
    expect((exactLog(5, 25)!.numerator + 1) / 2).toBe(1.5);
    const swap = polynomialRoots([8, -6, 1]).map((root) => root.x);
    expect(swap).toEqual([2, 4]);
    expect(swap.map((t) => logValue(2, t))).toEqual([1, 2]);
    expect(4 ** 2 - 6 * 2 ** 2 + 8).toBe(0);
    expect(solveLogEquation(3, 2, -5, 2).x).toBe(7);
    expect(intervalText(solveExponentialInequality(0.5, 1 / 8, '<='))).toBe('[3; +∞)');
    expect(intervalText(solveLogInequality(0.5, 1, -1, -2, '>'))).toBe('(1; 5)');

    // Итоговый набор 13: 30 000 · 1,07^t > 45 000.
    expect(round(0.17609 / 0.02938, 2)).toBe(5.99);
    expect(Math.ceil(logValue(1.07, 1.5))).toBe(6);
    expect(round(1.07 ** 6, 4)).toBe(1.5007);
    expect(Math.round(30_000 * 1.07 ** 6)).toBe(45_022);
    expect(round(1.07 ** 5, 4)).toBe(1.4026);
    expect(Math.round(30_000 * 1.07 ** 5)).toBe(42_077);

    // Итоговый набор 14–18.
    expect(logValue(0.5, 0.25) * 5730).toBe(11_460);
    expect(10 * logValue(10, 1000)).toBe(30);
    expect(-logValue(10, 1e-5) - -logValue(10, 1e-3)).toBe(2);
    expect(6 / 2).toBe(3); // 6 − 2x > 0 ⟹ x < 3
    expect(logValue(0.7, 3)).toBeLessThan(0);
  });
});

// ───────────────────────────── 2. Производная ────────────────────────────────

describe('11 класс · «Производная»', () => {
  const FALL: Polynomial = [0, 0, 5]; // s = 5t²
  const THROW: Polynomial = [0, 20, -5]; // h = 20t − 5t²
  const SQUARE: Polynomial = [0, 0, 1];
  const CUBIC: Polynomial = [0, -3, 0, 1]; // x³ − 3x

  it('урок 2.1: касательная и мгновенная скорость', () => {
    // Разбор: разностное отношение 20 + 5h и предел 20 м/с.
    for (const h of [1, 0.1, 0.001]) {
      expect(secantSlope(FALL, 2, h)).toBeCloseTo(20 + 5 * h, 10);
    }
    expect(secantSlope(FALL, 2, 1)).toBe(25);
    expect(secantSlope(FALL, 2, 0.1)).toBeCloseTo(20.5, 10);
    expect(secantSlope(FALL, 2, 0.001)).toBeCloseTo(20.005, 10);
    expect(derivativeAt(FALL, 2)).toBe(20);

    // Производная x² — это 2x.
    expect(differentiate(SQUARE)).toEqual([0, 2]);
    expect(derivativeAt(SQUARE, 3)).toBe(6);
    expect(derivativeAt(SQUARE, 0)).toBe(0);
    expect(derivativeAt(SQUARE, -1.5)).toBe(-3);
    expect(differentiate([0, 0, 0, 1])).toEqual([0, 0, 3]);

    // Касательная к y = x² в точке x₀ = 3.
    expect(valueAt(SQUARE, 3)).toBe(9);
    expect(lineText(tangentLine(SQUARE, 3))).toBe('y = 6x − 9');
    expect(polynomialRoots([9, -6, 1]).map((r) => r.x)).toEqual([3]); // двойной корень

    // Практика 1: средние скорости на [0;2], [0;1] и [1;2].
    expect((valueAt(FALL, 2) - valueAt(FALL, 0)) / 2).toBe(10);
    expect((valueAt(FALL, 1) - valueAt(FALL, 0)) / 1).toBe(5);
    expect((valueAt(FALL, 2) - valueAt(FALL, 1)) / 1).toBe(15);

    // Практика 2–5.
    expect(derivativeAt(SQUARE, -1)).toBe(-2);
    expect(derivativeAt(SQUARE, 0)).toBe(0);
    expect(derivativeAt([0, 0, 0, 1], 1)).toBe(3);
    expect(differentiate([5])).toEqual([]);
    expect(differentiate([0, 1])).toEqual([1]);
    expect(differentiate([-7, 4])).toEqual([4]);

    // Практика 6: касательная к y = x² в точке 2.
    expect(valueAt(SQUARE, 2)).toBe(4);
    expect(derivativeAt(SQUARE, 2)).toBe(4);
    expect(lineText(tangentLine(SQUARE, 2))).toBe('y = 4x − 4');

    // Практика 7–9.
    expect(polynomialRoots([-30, 10]).map((r) => r.x)).toEqual([3]);
    expect(valueAt(FALL, 3)).toBe(45);
    expect(secantSlope(THROW, 1, 0.1)).toBeCloseTo(10 - 5 * 0.1, 10);
    expect(derivativeAt(THROW, 1)).toBe(10);
    expect(polynomialRoots(differentiate(THROW)).map((r) => r.x)).toEqual([2]);
    expect(valueAt(THROW, 2)).toBe(20);

    // Практика 10: прямая y = 2 касается y = x³ − 3x в −1 и пересекает в 2.
    expect(valueAt(CUBIC, -1)).toBe(2);
    expect(derivativeAt(CUBIC, -1)).toBe(0);
    expect(polynomialRoots([-2, -3, 0, 1]).map((r) => r.x)).toEqual([-1, 2]);

    // Практика 11.
    expect(polynomialRoots([-10, 2]).map((r) => r.x)).toEqual([5]);
    expect(valueAt(SQUARE, 5)).toBe(25);
  });

  it('урок 2.2: правила дифференцирования', () => {
    // Произведение (2x + 1)(x² − 3).
    const product = productRuleParts([1, 2], [-3, 0, 1]);
    expect(product.byRule).toEqual([-6, 2, 6]);
    expect(product.direct).toEqual(product.byRule);
    expect(product.du).toEqual([2]);
    expect(product.dv).toEqual([0, 2]);

    // Частное (x + 1)/(x − 2).
    const quotient = quotientRuleParts([1, 1], [-2, 1]);
    expect(quotient.numerator).toEqual([-3]);
    expect(quotient.denominator).toEqual([4, -4, 1]);

    // Композиция (3x + 1)² = 9x² + 6x + 1.
    const chain = chainRuleParts(SQUARE, [1, 3]);
    expect(chain.composed).toEqual([1, 6, 9]);
    expect(chain.byRule).toEqual([6, 18]);
    expect(chain.direct).toEqual(chain.byRule);

    // Ошибка урока: (2x)² = 4x² даёт 8x и цепным правилом, и напрямую.
    expect(chainRuleParts(SQUARE, [0, 2]).direct).toEqual([0, 8]);
    expect(chainRuleParts(SQUARE, [0, 2]).byRule).toEqual([0, 8]);

    // Практика 1–2, 6–9, 12–15.
    expect(differentiate([0, 0, 0, 0, 0, 0, 0, 1])).toEqual([0, 0, 0, 0, 0, 0, 7]);
    expect(differentiate([7, 0, -2, 0, 3])).toEqual([0, -4, 0, 12]);
    const six = productRuleParts([1, 0, 1], [-3, 1]);
    expect(six.byRule).toEqual([1, -6, 3]);
    expect(six.direct).toEqual(six.byRule);
    expect(quotientRuleParts([0, 1], [1, 1]).numerator).toEqual([1]);
    expect(quotientRuleParts([-5, 2], [3, 1]).numerator).toEqual([11]);
    expect(differentiate([-1024, 3840, -5760, 4320, -1620, 243])) // (3x − 4)⁵
      .toEqual([3840, -11_520, 12_960, -6480, 1215]); // 15(3x − 4)⁴
    expect(chainRuleParts([0, 0, 0, 1], [1, 0, 1]).byRule).toEqual([0, 6, 0, 12, 0, 6]);
    expect(derivativeAt([0, 5, -4, 1], 1)).toBe(0);
    expect(valueAt(CUBIC, 2)).toBe(2);
    expect(derivativeAt(CUBIC, 2)).toBe(9);
    expect(lineText(tangentLine(CUBIC, 2))).toBe('y = 9x − 16');
    const uv = productRuleParts([0, 0, 1], [0, 0, 0, 1]);
    expect(uv.byRule).toEqual([0, 0, 0, 0, 5]);
    expect(uv.byRule).not.toEqual([0, 0, 0, 6]); // u'·v' = 6x³ — другая функция
  });

  it('урок 2.3: исследование функции', () => {
    // Разбор y = x³ − 3x.
    const cubic = criticalPoints(CUBIC);
    expect(cubic.map((p) => [p.x, p.y, p.kind])).toEqual([
      [-1, 2, 'maximum'],
      [1, -2, 'minimum'],
    ]);
    expect(differentiate(CUBIC)).toEqual([-3, 0, 3]);
    expect(derivativeAt(CUBIC, -2)).toBe(9);
    expect(derivativeAt(CUBIC, 0)).toBe(-3);
    expect(derivativeAt(CUBIC, 2)).toBe(9);
    expect(monotonicityIntervals(CUBIC).map((i) => i.kind)).toEqual([
      'increasing', 'decreasing', 'increasing',
    ]);

    // Разбор y = x⁴ − 2x².
    const quartic: Polynomial = [0, 0, -2, 0, 1];
    expect(criticalPoints(quartic).map((p) => [p.x, p.y, p.kind])).toEqual([
      [-1, -1, 'minimum'],
      [0, 0, 'maximum'],
      [1, -1, 'minimum'],
    ]);
    expect(derivativeAt(quartic, -2)).toBe(-24);
    expect(derivativeAt(quartic, -0.5)).toBeCloseTo(1.5, 12);
    expect(derivativeAt(quartic, 0.5)).toBeCloseTo(-1.5, 12);
    expect(derivativeAt(quartic, 2)).toBe(24);
    expect(valueAt(quartic, 2)).toBe(8); // локальный максимум 0 не глобальный

    // Практика 1–9.
    expect(criticalPoints([5, -6, 1]).map((p) => [p.x, p.y, p.kind])).toEqual([[3, -4, 'minimum']]);
    expect(criticalPoints([-3, 4, -1]).map((p) => [p.x, p.y, p.kind])).toEqual([[2, 1, 'maximum']]);
    expect(criticalPoints([0, 0, -3, 1]).map((p) => [p.x, p.y, p.kind])).toEqual([
      [0, 0, 'maximum'],
      [2, -4, 'minimum'],
    ]);
    expect(criticalPoints([0, 3, 0, 1])).toEqual([]); // y' = 3x² + 3 > 0
    expect(criticalPoints([0, 12, -9, 2]).map((p) => [p.x, p.y, p.kind])).toEqual([
      [1, 5, 'maximum'],
      [2, 4, 'minimum'],
    ]);
    expect(criticalPoints([0, -4, 0, 0, 1]).map((p) => [p.x, p.y, p.kind])).toEqual([[1, -3, 'minimum']]);
    // y = x/(x² + 1): производная (1 − x²)/(x² + 1)².
    expect(quotientRuleParts([0, 1], [1, 0, 1]).numerator).toEqual([1, 0, -1]);
    expect(0 / 1).toBe(0);
    expect(-1 / ((-1) ** 2 + 1)).toBe(-0.5);
    expect(1 / (1 ** 2 + 1)).toBe(0.5);
    expect(criticalPoints([0, -12, 0, 1]).map((p) => [p.x, p.y, p.kind])).toEqual([
      [-2, 16, 'maximum'],
      [2, -16, 'minimum'],
    ]);

    // Практика 10–11: x²(x − 4) и сравнение x³ с x⁴.
    expect(polynomialRoots([0, 0, -4, 1]).map((r) => r.x)).toEqual([0, 4]);
    expect(criticalPoints([0, 0, 0, 0, 1]).map((p) => [p.x, p.kind])).toEqual([[0, 'minimum']]);
    expect(criticalPoints([0, 0, 0, 1]).map((p) => [p.x, p.kind])).toEqual([[0, 'none']]);
  });

  it('урок 2.4: задачи оптимизации', () => {
    // Разбор y = x³ − 3x на [−2; 3].
    const segment = extremaOnSegment(CUBIC, -2, 3);
    expect(segment.candidates.map((c) => [c.x, c.y])).toEqual([
      [-2, -2], [-1, 2], [1, -2], [3, 18],
    ]);
    expect(segment.maximum.y).toBe(18);
    expect(segment.maximum.x).toBe(3);
    expect(segment.minimum.y).toBe(-2);

    // Коробка из листа 12 × 12: V = x(12 − 2x)² = 4x³ − 48x² + 144x.
    const box: Polynomial = [0, 144, -48, 4];
    expect(valueAt(box, 2)).toBe(2 * 8 ** 2);
    expect(differentiate(box)).toEqual([144, -96, 12]);
    expect(polynomialRoots(differentiate(box)).map((r) => r.x)).toEqual([2, 6]);
    const boxExtrema = extremaOnSegment(box, 0, 6);
    expect(boxExtrema.maximum).toMatchObject({ x: 2, y: 128 });
    expect(valueAt(box, 0)).toBe(0);
    expect(valueAt(box, 6)).toBe(0);

    // Забор длиной 60 м: S = 60x − 2x².
    const fence: Polynomial = [0, 60, -2];
    expect(criticalPoints(fence).map((p) => [p.x, p.y, p.kind])).toEqual([[15, 450, 'maximum']]);
    expect(60 - 2 * 15).toBe(30);

    // Цена и выручка: R = 200p − 2p².
    const revenue: Polynomial = [0, 200, -2];
    expect(criticalPoints(revenue).map((p) => [p.x, p.y])).toEqual([[50, 5000]]);
    expect(200 - 2 * 50).toBe(100);

    // QuickCheck и практика 3: y = x³ − 12x на [0; 3].
    const twelve = extremaOnSegment([0, -12, 0, 1], 0, 3);
    expect(twelve.candidates.map((c) => [c.x, c.y])).toEqual([[0, 0], [2, -16], [3, -9]]);
    expect(twelve.minimum.y).toBe(-16);
    expect(twelve.maximum.y).toBe(0);

    // Практика 2, 5–13.
    const parabola = extremaOnSegment([7, -4, 1], 0, 3);
    expect(parabola.candidates.map((c) => [c.x, c.y])).toEqual([[0, 7], [2, 3], [3, 4]]);
    // y = x + 4/x на [1; 4]: минимум 4 при x = 2, на концах по 5.
    const hyperbola = (x: number) => x + 4 / x;
    expect([1, 2, 4].map(hyperbola)).toEqual([5, 4, 5]);
    expect(criticalPoints([0, 24, -1]).map((p) => [p.x, p.y])).toEqual([[12, 144]]);
    const sumOfPair = (x: number) => x + 36 / x;
    expect(sumOfPair(6)).toBe(12);
    expect(criticalPoints([0, 18, -1]).map((p) => [p.x, p.y])).toEqual([[9, 81]]);
    expect(criticalPoints([0, 80, -2]).map((p) => [p.x, p.y])).toEqual([[20, 800]]);
    expect(80 - 2 * 20).toBe(40);
    const box18: Polynomial = [0, 324, -72, 4];
    expect(polynomialRoots(differentiate(box18)).map((r) => r.x)).toEqual([3, 9]);
    expect(valueAt(box18, 3)).toBe(432);
    expect(18 - 2 * 3).toBe(12);
    const perimeter = (x: number) => 2 * (x + 64 / x);
    expect(perimeter(8)).toBe(32);
    const motion: Polynomial = [0, 9, -6, 1];
    const motionExtrema = extremaOnSegment(motion, 0, 4);
    expect(motionExtrema.candidates.map((c) => [c.x, c.y])).toEqual([
      [0, 0], [1, 4], [3, 0], [4, 4],
    ]);
    expect(criticalPoints([0, 300, -3]).map((p) => [p.x, p.y])).toEqual([[50, 7500]]);
    expect(300 - 3 * 50).toBe(150);

    // Практика 13: ближайшая к A(0; 1,5) точка параболы y = x².
    const distanceSquared: Polynomial = [2.25, 0, -2, 0, 1];
    expect(polynomialRoots(differentiate(distanceSquared)).map((r) => r.x)).toEqual([-1, 0, 1]);
    expect(valueAt(distanceSquared, 0)).toBeCloseTo(2.25, 12);
    expect(valueAt(distanceSquared, 1)).toBeCloseTo(1.25, 12);
    expect(valueAt(distanceSquared, -1)).toBeCloseTo(1.25, 12);
    expect(round(Math.sqrt(1.25), 2)).toBe(1.12);
  });

  it('урок 2.5: практикум главы', () => {
    // Станция 1: h = 20t − 5t², скорость при t = 1.
    expect(differentiate(THROW)).toEqual([20, -10]);
    expect(derivativeAt(THROW, 1)).toBe(10);

    // Станция 2: техника.
    expect(differentiate([-9, 1, 0, -4, 0, 3])).toEqual([1, 0, -12, 0, 15]);
    expect(quotientRuleParts([-2, 1], [2, 1]).numerator).toEqual([4]);
    expect(quotientRuleParts([-2, 1], [2, 1]).denominator).toEqual([4, 4, 1]);

    // Станция 3: три стационарные точки у x⁴ − 2x².
    expect(criticalPoints([0, 0, -2, 0, 1]).map((p) => p.kind)).toEqual([
      'minimum', 'maximum', 'minimum',
    ]);
    expect(valueAt([0, 0, -2, 0, 1], 2)).toBe(8);

    // Разбор y = 2x³ − 3x² − 12x + 5.
    const full: Polynomial = [5, -12, -3, 2];
    expect(differentiate(full)).toEqual([-12, -6, 6]);
    expect(criticalPoints(full).map((p) => [p.x, p.y, p.kind])).toEqual([
      [-1, 12, 'maximum'],
      [2, -15, 'minimum'],
    ]);
    expect(valueAt(full, 0)).toBe(5);
    expect(derivativeAt(full, 0)).toBe(-12);
    expect(lineText(tangentLine(full, 0))).toBe('y = −12x + 5');

    // QuickCheck: y = 12x − x³ на [0; 3].
    const hill = extremaOnSegment([0, 12, 0, -1], 0, 3);
    expect(hill.candidates.map((c) => [c.x, c.y])).toEqual([[0, 0], [2, 16], [3, 9]]);
    expect(hill.maximum.y).toBe(16);
    expect(hill.minimum.y).toBe(0);

    // Итоговый набор 1–9.
    expect(secantSlope([0, -3, 1], 2, 0.5)).toBeCloseTo(1.5, 12); // h + 1 при h = 0,5
    expect(derivativeAt([0, -3, 1], 2)).toBe(1);
    expect(differentiate([-7, 2, -5, 4])).toEqual([2, -10, 12]);
    const three = productRuleParts([-1, 1], [2, 0, 1]);
    expect(three.byRule).toEqual([2, -2, 3]);
    expect(three.direct).toEqual(three.byRule);
    expect(quotientRuleParts([3, 2], [-1, 1]).numerator).toEqual([-5]);
    expect(valueAt([0, 0, 1], 4)).toBe(16); // √4 = 2 проверяем отдельно
    expect(Math.sqrt(4)).toBe(2);
    expect(1 / (2 * Math.sqrt(4))).toBe(0.25);
    expect(lineText({ slope: 0.25, intercept: 1 })).toBe('y = 0,25x + 1');
    expect(polynomialRoots(differentiate([0, 0, -3, 1])).map((r) => r.x)).toEqual([0, 2]);
    expect(valueAt([0, 0, -3, 1], 2)).toBe(-4);
    const path: Polynomial = [0, 12, -9, 2];
    expect(differentiate(path)).toEqual([12, -18, 6]);
    expect(polynomialRoots(differentiate(path)).map((r) => r.x)).toEqual([1, 2]);
    expect(valueAt(differentiate(differentiate(path)), 1)).toBe(-6);

    // Итоговый набор 10–14.
    expect(criticalPoints([0, 9, -6, 1]).map((p) => [p.x, p.y, p.kind])).toEqual([
      [1, 4, 'maximum'],
      [3, 0, 'minimum'],
    ]);
    const quartic = extremaOnSegment([0, 0, -2, 0, 1], -2, 2);
    expect(quartic.candidates.map((c) => [c.x, c.y])).toEqual([
      [-2, 8], [-1, -1], [0, 0], [1, -1], [2, 8],
    ]);
    expect(quartic.maximum.y).toBe(8);
    expect(quartic.minimum.y).toBe(-1);
    expect(criticalPoints([0, 20, -1]).map((p) => [p.x, p.y])).toEqual([[10, 100]]);
    // Бак объёмом 32 дм³: S = x² + 128/x.
    const material = (x: number) => x * x + 128 / x;
    expect(material(4)).toBe(48);
    expect(32 / 4 ** 2).toBe(2);

    // Итоговый набор 15–18.
    expect(polynomialRoots([16, -24, 9, -1]).map((r) => r.x)).toEqual([1, 4]); // (x − 1)(x − 4)²
    // Касание y = 3x + a и y = x² + x.
    expect(polynomialRoots([-2, 2]).map((r) => r.x)).toEqual([1]); // 2x + 1 = 3
    expect(valueAt([0, 1, 1], 1)).toBe(2);
    expect(2 - 3 * 1).toBe(-1);
    expect(polynomialRoots([1, -2, 1]).map((r) => r.x)).toEqual([1]);
    expect(criticalPoints([0, 0, 0, 1]).map((p) => p.kind)).toEqual(['none']);
    expect(derivativeAt([0, 0, 1], 2)).toBe(4); // 2x = 4 ⟹ x = 2
    expect(valueAt([0, 0, 1], 2)).toBe(4);
    expect(polynomialRoots([4, -4, 1]).map((r) => r.x)).toEqual([2]);
  });
});

// ─────────────────────────────── 3. Интеграл ─────────────────────────────────

describe('11 класс · «Интеграл» (дополнение к tests/integrals.test.ts)', () => {
  it('урок 3.2: формула левой суммы и середины на параболе', () => {
    // Правая сумма отличается заменой n − 1 на n + 1: (n + 1)(2n + 1)/(6n²).
    for (const parts of [2, 4, 10, 100]) {
      const expected = ((parts + 1) * (2 * parts + 1)) / (6 * parts * parts);
      expect(riemannSum([0, 0, 1], 0, 1, parts, 'right')).toBeCloseTo(expected, 12);
      // Вилка сужается ровно как ширина одного прямоугольника.
      expect(
        riemannSum([0, 0, 1], 0, 1, parts, 'right') - riemannSum([0, 0, 1], 0, 1, parts, 'left'),
      ).toBeCloseTo(1 / parts, 12);
    }
    expect(riemannSum([0, 0, 1], 0, 1, 2, 'left')).toBeCloseTo(0.125, 12);
    expect(riemannSum([0, 0, 1], 0, 1, 2, 'right')).toBeCloseTo(0.625, 12);
    expect(riemannSum([0, 0, 1], 0, 1, 2, 'middle')).toBeCloseTo(0.3125, 12);
    expect(round(1 / 3 - 0.3125, 4)).toBe(0.0208);
    expect(round(1 / 3 - riemannSum([0, 0, 1], 0, 1, 100, 'left'), 5)).toBe(0.00498);

    // Практика 3: y = x на [0; 2] — середина точна.
    expect(riemannSum([0, 1], 0, 2, 4, 'left')).toBeCloseTo(1.5, 12);
    expect(riemannSum([0, 1], 0, 2, 4, 'right')).toBeCloseTo(2.5, 12);
    expect(riemannSum([0, 1], 0, 2, 4, 'middle')).toBeCloseTo(2, 12);

    // Практика 5: y = 4 − x² на [−2; 2] по серединам даёт 11 при точных 32/3.
    expect(riemannSum([4, 0, -1], -2, 2, 4, 'middle')).toBeCloseTo(11, 12);
    expect(definiteIntegral([4, 0, -1], -2, 2)).toBeCloseTo(32 / 3, 12);
    expect(11 - 32 / 3).toBeCloseTo(1 / 3, 12);
  });

  it('уроки 3.3 и 3.5: арка, отдельные интегралы и путь против перемещения', () => {
    // Разбор «Парабола и прямая»: y = x² и y = x + 2.
    expect(crossingPoints([2, 1], [0, 0, 1], -5, 5)).toEqual([-1, 2]);
    expect(areaBetween([2, 1], [0, 0, 1], -1, 2).area).toBeCloseTo(4.5, 10);
    // Наибольшая высота разности достигается при x = 0,5 и равна 2,25.
    expect(valueAt([2, 1, -1], 0.5)).toBeCloseTo(2.25, 12);

    // Практикум, станция 3: арка между y = 4 − x² и y = 2x + 1.
    expect(crossingPoints([4, 0, -1], [1, 2], -6, 6)).toEqual([-3, 1]);
    expect(areaBetween([4, 0, -1], [1, 2], -3, 1).area).toBeCloseTo(32 / 3, 10);
    expect(round(32 / 3, 1)).toBe(10.7);
    expect(valueAt([3, -2, -1], -1)).toBe(4); // наибольшая высота разности

    // Практикум, станция 2: левая сумма для x³ на [0; 2] занижена почти вдвое.
    expect(riemannSum([0, 0, 0, 1], 0, 2, 4, 'left')).toBeCloseTo(2.25, 12);
    expect(definiteIntegral([0, 0, 0, 1], 0, 2)).toBeCloseTo(4, 12);
    expect(4 - 2.25).toBeCloseTo(1.75, 12);

    // Практика урока 3.3 и практикума: отдельные интегралы.
    expect(definiteIntegral([0, 0, 1], 0, 3)).toBeCloseTo(9, 12);
    expect(definiteIntegral([0, 0, 0, 1], 1, 2)).toBeCloseTo(3.75, 12);
    expect(definiteIntegral([1, 2], 0, 1)).toBeCloseTo(2, 12);
    expect(definiteIntegral([0, 0, 1], -1, 1)).toBeCloseTo(2 / 3, 12);
    expect(definiteIntegral([0, 0, 1], 3, 0)).toBeCloseTo(-9, 12);
    expect(definiteIntegral([0, 0, 1], 0, 2) + definiteIntegral([0, 0, 1], 2, 3)).toBeCloseTo(9, 12);
    expect(definiteIntegral([0, 2, 3], 0, 2)).toBeCloseTo(12, 12);
    expect(definiteIntegral([0, 0, 1], -1, 2)).toBeCloseTo(3, 12);
    expect(areaBetween([], [-4, 0, 1], -2, 2).area).toBeCloseTo(32 / 3, 10);
    expect(definiteIntegral([0, 1], 0, 4)).toBeCloseTo(8, 12); // b²/2 = 8 при b = 4
    expect(definiteIntegral([0, 0, 1], 0, 3)).toBeCloseTo(9, 12); // b³/3 = 9 при b = 3

    // Практикум, задача 14: v = t − 3 на [0; 5].
    expect(definiteIntegral([-3, 1], 0, 5)).toBeCloseTo(-2.5, 12);
    expect(definiteIntegral([-3, 1], 0, 3)).toBeCloseTo(-4.5, 12);
    expect(definiteIntegral([-3, 1], 3, 5)).toBeCloseTo(2, 12);
    expect(areaBetween([-3, 1], [], 0, 5).area).toBeCloseTo(6.5, 10);

    // Урок 3.4: работа, энергия, заряд, объём и среднее значение.
    expect(definiteIntegral([0, 200], 0, 0.1)).toBeCloseTo(1, 12);
    expect(definiteIntegral([0, 0, 3], 0, 2)).toBeCloseTo(8, 12);
    expect(definiteIntegral([3, -0.5], 0, 6)).toBeCloseTo(9, 12);
    expect(definiteIntegral([100, 20], 0, 10)).toBeCloseTo(2000, 12);
    expect(definiteIntegral([0, 4], 0, 5)).toBeCloseTo(50, 12);
    expect(definiteIntegral([0, 0.5], 0, 4)).toBeCloseTo(4, 12);
    expect(definiteIntegral([0, 50], 0, 0.4)).toBeCloseTo(4, 12);
    expect(definiteIntegral([10, -2], 0, 5)).toBeCloseTo(25, 12);
    expect(definiteIntegral([0, 0, 3], 0, 2) / 2).toBeCloseTo(4, 12);
    expect(definiteIntegral([0, 0, 1], 0, 3) / 3).toBeCloseTo(3, 12);
    expect(valueAt([0, 0, 1], 1.5)).toBeCloseTo(2.25, 12); // не равно среднему
    // Практика 13 урока 3.4: 3t − 0,25t² = 8 при t = 4 и t = 8.
    expect(polynomialRoots([32, -12, 1]).map((r) => r.x)).toEqual([4, 8]);
  });
});

// ─────────────────────────── 4. Тела вращения ────────────────────────────────

describe('11 класс · «Тела вращения» (дополнение к tests/revolution.test.ts)', () => {
  it('уроки 4.1–4.2: обратные задачи по развёртке и боковой поверхности', () => {
    // Урок 4.1, практика 4: S_бок = 48π при h = 6 отвечает радиусу 4.
    expect(exactText(cylinderMetrics(4, 6).lateralArea)).toBe('48π');
    // Практика 5: развёртка 12π × 5 — это r = 6, h = 5.
    expect(exactText(cylinderMetrics(6, 5).net.rectangleWidth)).toBe('12π');
    expect(cylinderMetrics(6, 5).net.rectangleHeight).toBe(5);
    // Практика 8: увеличение всех размеров втрое умножает поверхность на 9.
    expect(cylinderMetrics(9, 21).totalArea.value / cylinderMetrics(3, 7).totalArea.value)
      .toBeCloseTo(9, 10);

    // Урок 4.2, практика 3: сектор 120° радиуса 9 даёт r = 3 и S_бок = 27π.
    const fromSector = coneMetrics(3, Math.sqrt(81 - 9));
    expect(fromSector.net.sectorAngleDegrees.value).toBeCloseTo(120, 10);
    expect(fromSector.lateralArea.value).toBeCloseTo(27 * Math.PI, 10);
    // Практика 8: удвоение размеров учетверяет полную поверхность.
    expect(coneMetrics(6, 8).totalArea.value / coneMetrics(3, 4).totalArea.value)
      .toBeCloseTo(4, 10);
  });
});

// ───────────────────── 5. Векторы в пространстве ─────────────────────────────

describe('11 класс · «Векторы в пространстве» (дополнение к tests/vectors3d.test.ts)', () => {
  it('урок 5.1: координаты, расстояния и середины', () => {
    // Разбор: A(−1; 2; 4) и B(3; −2; 6).
    const ab = vec3(3 - -1, -2 - 2, 6 - 4);
    expect(length3(ab)).toBe(6);
    const middle = point3((-1 + 3) / 2, (2 + -2) / 2, (4 + 6) / 2);
    expect(middle).toEqual({ x: 1, y: 0, z: 5 });
    expect(length3(vec3(middle.x - -1, middle.y - 2, middle.z - 4))).toBe(3);

    // Куб с ребром 6: диагональ грани и диагональ куба, отрезок AM.
    expect(length3(vec3(6, 6, 0))).toBeCloseTo(6 * Math.SQRT2, 10);
    expect(round(6 * Math.SQRT2, 2)).toBe(8.49);
    expect(length3(vec3(6, 6, 6))).toBeCloseTo(6 * Math.sqrt(3), 10);
    expect(round(6 * Math.sqrt(3), 2)).toBe(10.39);
    expect(length3(vec3(6, 3, 6))).toBe(9);

    // Ребра 2, 3, 6 дают диагональ ровно 7.
    expect(length3(vec3(2, 3, 6))).toBe(7);
    expect(length3(vec3(3, 4, 12))).toBe(13);
    expect(length3(vec3(1, 1, 1))).toBeCloseTo(Math.sqrt(3), 12);

    // Практика 1–2: точка M(3; −4; 12).
    expect(Math.abs(-4)).toBe(4);
    expect(length3(vec3(3, -4, 12))).toBe(13);
    expect(length3(vec3(3, -4, 0))).toBe(5);

    // Практика 3, 5, 10–12.
    expect(length3(vec3(6 - 2, 3 - -1, -1 - 3))).toBeCloseTo(4 * Math.sqrt(3), 12);
    expect(point3((2 + 6) / 2, (-1 + 3) / 2, (3 + -1) / 2)).toEqual({ x: 4, y: 1, z: 1 });
    expect(length3(vec3(4, 4, 4))).toBeCloseTo(4 * Math.sqrt(3), 12);
    expect(length3(vec3(4, 3, 12))).toBe(13);
    const sides = [
      length3(vec3(0 - 1, 2 - 0, 0 - 0)),
      length3(vec3(0 - 1, 0 - 0, 2 - 0)),
      length3(vec3(0 - 0, 0 - 2, 2 - 0)),
    ];
    expect(sides).toEqual([Math.sqrt(5), Math.sqrt(5), 2 * Math.SQRT2]);
    expect(round(sides[0]! + sides[1]! + sides[2]!, 2)).toBe(7.3);
    const equilateral = [
      length3(vec3(3 - 1, 2 - 2, 1 - 3)),
      length3(vec3(1 - 3, 4 - 2, 1 - 1)),
      length3(vec3(1 - 1, 4 - 2, 1 - 3)),
    ];
    expect(equilateral.every((side) => Math.abs(side - 2 * Math.SQRT2) < 1e-12)).toBe(true);
    expect(round(2 * Math.SQRT2, 2)).toBe(2.83);

    // Практика 7–8: равноудалённые точки на осях.
    const onOx = 2;
    expect((onOx - 1) ** 2 + 4 + 9).toBe(14);
    expect((onOx - 5) ** 2 + 4 + 1).toBe(14);
    const onOz = 2.5;
    expect(4 + 1 + onOz ** 2).toBeCloseTo(9 + (onOz - 4) ** 2, 12);
  });

  it('урок 5.2: действия с векторами, коллинеарность и компланарность', () => {
    const a = vec3(1, -2, 2);
    const b = vec3(3, 0, -4);
    expect(length3(a)).toBe(3);
    expect(length3(b)).toBe(5);
    const sum = vec3(a.x + b.x, a.y + b.y, a.z + b.z);
    expect(sum).toEqual({ x: 4, y: -2, z: -2 });
    expect(length3(sum)).toBeCloseTo(2 * Math.sqrt(6), 12);
    expect(round(2 * Math.sqrt(6), 2)).toBe(4.9);
    const combo = vec3(2 * a.x - b.x, 2 * a.y - b.y, 2 * a.z - b.z);
    expect(combo).toEqual({ x: -1, y: -4, z: 8 });
    expect(length3(combo)).toBe(9);

    // Практика 1–3.
    expect(vec3(4 - 1, 2 - -2, -5 - 0)).toEqual({ x: 3, y: 4, z: -5 });
    expect(length3(vec3(3, 4, -5))).toBeCloseTo(5 * Math.SQRT2, 12);
    expect(round(5 * Math.SQRT2, 2)).toBe(7.07);
    expect(vec3(a.x - b.x, a.y - b.y, a.z - b.z)).toEqual({ x: -2, y: -2, z: 6 });
    expect(vec3(3 * a.x, 3 * a.y, 3 * a.z)).toEqual({ x: 3, y: -6, z: 6 });

    // Практика 4: коллинеарность (2; m; −6) и (−1; 3; 3) при m = −6.
    const k = -1 / 2;
    expect(k * -6).toBe(3);
    expect(3 / k).toBe(-6);

    // Практика 5: компланарность (2; 1; −4) = 2·(1; 2; −1) − (0; 3; 2).
    expect(areCoplanar3(vec3(1, 2, -1), vec3(0, 3, 2), vec3(2, 1, -4))).toBe(true);
    expect(vec3(2 * 1 - 0, 2 * 2 - 3, 2 * -1 - 2)).toEqual({ x: 2, y: 1, z: -4 });

    // Практика 6: единичный вектор, сонаправленный с (2; −1; 2).
    const unitSource = vec3(2, -1, 2);
    expect(length3(unitSource)).toBe(3);
    expect([unitSource.x / 3, unitSource.y / 3, unitSource.z / 3]).toEqual([2 / 3, -1 / 3, 2 / 3]);

    // Практика 7: параллелограмм ABCD.
    const bc = vec3(4 - 3, 2 - 2, 5 - 2);
    expect(bc).toEqual({ x: 1, y: 0, z: 3 });
    const d = point3(1 + bc.x, 0 + bc.y, 2 + bc.z);
    expect(d).toEqual({ x: 2, y: 0, z: 5 });
    expect(vec3(4 - d.x, 2 - d.y, 5 - d.z)).toEqual({ x: 2, y: 2, z: 0 });

    // Практика 8–11: разложения в единичном кубе.
    expect(vec3(0 - 1, 1 - 0, 0 - 1)).toEqual({ x: -1, y: 1, z: -1 }); // B₁D
    expect(vec3(0.5 - 1, 0 - 1, 0 - 1)).toEqual({ x: -0.5, y: -1, z: -1 }); // C₁M
    expect(vec3(1 - 0, 0.5 - 0, 0.5 - 0)).toEqual({ x: 1, y: 0.5, z: 0.5 }); // AK
    expect(vec3(1 - 0.5, 0.5 - 0, 0.5 - 0)).toEqual({ x: 0.5, y: 0.5, z: 0.5 }); // MK
  });

  it('урок 5.4: практика с уравнением плоскости', () => {
    // Практика 2–4.
    expect(distanceToPlaneEquation(point3(0, 0, 0), planeEquation(2, -1, 2, 3))).toBeCloseTo(1, 12);
    expect(distanceToPlaneEquation(point3(1, 1, 1), planeEquation(2, -1, 2, -6))).toBeCloseTo(1, 12);
    expect(distanceBetweenPlaneEquations(planeEquation(2, -1, 2, -6), planeEquation(2, -1, 2, 3)))
      .toBeCloseTo(3, 12);

    // Практика 5: плоскость через (1;0;0), (0;2;0), (0;0;3).
    const cut = planeEquationThroughPoints(point3(1, 0, 0), point3(0, 2, 0), point3(0, 0, 3));
    expect(formatPlaneEquation(cut)).toBe('6x + 3y + 2z − 6 = 0');
    expect(length3(planeNormal(cut))).toBe(7);
    expect(round(distanceToPlaneEquation(point3(0, 0, 0), cut), 2)).toBe(0.86);

    // Практика 6: угол с плоскостью Oxy.
    expect(round(degrees(Math.acos(2 / 3)), 1)).toBe(48.2);

    // Практика 7–10: куб с ребром 6 и плоскость A₁BD.
    const wedge = planeEquationThroughPoints(point3(0, 0, 6), point3(6, 0, 0), point3(0, 6, 0));
    expect(formatPlaneEquation(wedge)).toBe('x + y + z − 6 = 0');
    const toA = distanceToPlaneEquation(point3(0, 0, 0), wedge);
    const toC1 = distanceToPlaneEquation(point3(6, 6, 6), wedge);
    expect(toA).toBeCloseTo(2 * Math.sqrt(3), 12);
    expect(round(toA, 2)).toBe(3.46);
    expect(toC1).toBeCloseTo(4 * Math.sqrt(3), 12);
    expect(round(toC1, 2)).toBe(6.93);
    expect(toA + toC1).toBeCloseTo(length3(vec3(6, 6, 6)), 10);
    expect(round(degrees(Math.acos(1 / Math.sqrt(3))), 1)).toBe(54.7);
    expect(round(degrees(Math.asin(1 / Math.sqrt(3))), 1)).toBe(35.3);

    // Практика 11: расстояние между AB и A₁C₁ равно ребру.
    expect(distanceToPlaneEquation(point3(0, 0, 0), planeEquation(0, 0, 1, -6))).toBe(6);

    // Практика 12: плоскость ACC₁A₁ и расстояние от B.
    const diagonalPlane = planeEquationThroughPoints(point3(0, 0, 0), point3(6, 6, 0), point3(0, 0, 6));
    expect(formatPlaneEquation(diagonalPlane)).toBe('x − y = 0');
    expect(distanceToPlaneEquation(point3(6, 0, 0), diagonalPlane)).toBeCloseTo(3 * Math.SQRT2, 12);
    expect(round(3 * Math.SQRT2, 2)).toBe(4.24);

    // Урок 5.3, практика 1–8 и 11–12 (кубу ребро 1).
    expect(dot3(vec3(2, -1, 3), vec3(1, 4, 2))).toBe(4);
    expect(round(length3(vec3(2, -1, 3)), 2)).toBe(3.74);
    expect(round(length3(vec3(1, 4, 2)), 2)).toBe(4.58);
    expect(round(degrees(Math.acos(4 / Math.sqrt(294))), 1)).toBe(76.5);
    expect(dot3(vec3(2, 2, -1), vec3(3, -1, 4))).toBe(0);
    expect(dot3(vec3(2, 2, -1), vec3(3, -1, 4))).toBe(0);
    expect(dot3(vec3(1, 1, 0), vec3(0, 1, 1))).toBe(1);
    expect(round(degrees(Math.acos(1 / Math.sqrt(3))), 1)).toBe(54.7);
    expect(2 * 3 * Math.cos((120 * Math.PI) / 180)).toBeCloseTo(-3, 12);
    expect(Math.sqrt(4 + 9 + 2 * -3)).toBeCloseTo(Math.sqrt(7), 12);
    expect(round(Math.sqrt(7), 2)).toBe(2.65);
    expect(dot3(vec3(1, 0, 1), vec3(-1, 0, 1))).toBe(0); // AB₁ ⟂ CD₁
    expect(dot3(vec3(1, 0, -1), vec3(0, 1, -1))).toBe(1); // A₁B и B₁C дают 60°
  });
});

// ─────────────────── 6. Статистическое мышление ──────────────────────────────

describe('11 класс · «Статистическое мышление»', () => {
  /** Аттракцион: кубик, по 10 ₽ за очко. */
  const CUBE_GAME: GameOutcome[] = [10, 20, 30, 40, 50, 60].map((payoff) => ({
    label: `${payoff} ₽`,
    payoff,
    probability: fraction(1, 6),
  }));

  /** Джекпот: один билет из ста приносит 3500 ₽. */
  const JACKPOT: GameOutcome[] = [
    { label: 'пусто', payoff: 0, probability: fraction(99, 100) },
    { label: 'приз', payoff: 3500, probability: fraction(1, 100) },
  ];

  /** Надёжный конверт: 30 ₽ или 40 ₽ поровну. */
  const ENVELOPE: GameOutcome[] = [
    { label: '30 ₽', payoff: 30, probability: fraction(1, 2) },
    { label: '40 ₽', payoff: 40, probability: fraction(1, 2) },
  ];

  it('урок 6.1: математическое ожидание и справедливая цена', () => {
    const cube = gameDistribution(CUBE_GAME);
    expect(fractionToNumber(fairPrice(cube))).toBe(35);
    expect(fractionToNumber(netExpectation(cube, 40))).toBe(-5);
    expect(200 * fractionToNumber(netExpectation(cube, 40))).toBe(-1000);
    expect(fractionToNumber(netExpectation(cube, 35))).toBe(0);

    // Страховой полис на велосипед: 20 000 ₽ с вероятностью 1/50.
    const policy = gameDistribution([
      { label: 'цел', payoff: 0, probability: fraction(49, 50) },
      { label: 'пропал', payoff: 20_000, probability: fraction(1, 50) },
    ]);
    expect(fractionToNumber(fairPrice(policy))).toBe(400);
    expect(fractionToNumber(netExpectation(policy, 700))).toBe(-300);
    expect(10_000 * 700).toBe(7_000_000);
    expect(10_000 * fractionToNumber(fairPrice(policy))).toBe(4_000_000);
    expect(10_000 * 700 - 10_000 * fractionToNumber(fairPrice(policy))).toBe(3_000_000);

    // QuickCheck и практика 5: лотерея из 500 билетов.
    expect((20_000 + 4 * 5000) / 500).toBe(80);

    // Практика 1, 7, 9–11.
    const simple = gameDistribution([
      { label: '0', payoff: 0, probability: fraction(1, 2) },
      { label: '1', payoff: 1, probability: fraction(3, 10) },
      { label: '2', payoff: 2, probability: fraction(1, 5) },
    ]);
    expect(fractionToNumber(expectedValue(simple))).toBeCloseTo(0.7, 12);
    expect(2 * 3.5 + 5).toBe(12);
    expect(fractionToNumber(expectedValue(diceSumDistribution(2)))).toBe(7);
    expect(20 * 0.3).toBeCloseTo(6, 12);
    const jackpot = gameDistribution(JACKPOT);
    expect(fractionToNumber(fairPrice(jackpot))).toBe(35);
    expect(fractionToNumber(netExpectation(jackpot, 50))).toBe(-15);
    expect(100 * -15).toBe(-1500);
    expect(100 * 50 - 3500).toBe(1500);
    const balanced = gameDistribution([
      { label: '−2', payoff: -2, probability: fraction(3, 4) },
      { label: '6', payoff: 6, probability: fraction(1, 4) },
    ]);
    expect(fractionToNumber(fairPrice(balanced))).toBe(0);

    // Практика 6: доля чистой цены риска в полисе за 700 ₽.
    expect(fractionToNumber(fraction(400, 700))).toBeCloseTo(4 / 7, 12);
    expect(round((400 / 700) * 100, 0)).toBe(57);

    // Три игры с одним ожиданием.
    expect(fractionToNumber(fairPrice(gameDistribution(ENVELOPE)))).toBe(35);
  });

  it('урок 6.2: дисперсия и стандартное отклонение', () => {
    const envelope = gameDistribution(ENVELOPE);
    const cube = gameDistribution(CUBE_GAME);
    const jackpot = gameDistribution(JACKPOT);

    expect(fractionToNumber(distributionVariance(envelope))).toBe(25);
    expect(standardDeviation(envelope)).toBe(5);

    expect(distributionVariance(cube)).toEqual({ numerator: 875, denominator: 3 });
    expect(varianceThroughSquares(cube)).toEqual(distributionVariance(cube));
    expect(round(fractionToNumber(distributionVariance(cube)), 2)).toBe(291.67);
    expect(round(standardDeviation(cube), 2)).toBe(17.08);
    // Проверка квадратами из разбора: M(X²) = 4550/3.
    expect((100 + 400 + 900 + 1600 + 2500 + 3600) / 6).toBeCloseTo(4550 / 3, 12);
    expect(4550 / 3 - 35 ** 2).toBeCloseTo(875 / 3, 12);

    expect(fractionToNumber(distributionVariance(jackpot))).toBe(121_275);
    expect(0.99 * 1225).toBeCloseTo(1212.75, 12);
    expect(0.01 * 3465 ** 2).toBeCloseTo(120_062.25, 10);
    expect(round(standardDeviation(jackpot), 2)).toBe(348.25);

    // Отношение сигм примерно 1 : 3,4 : 70.
    expect(round(standardDeviation(cube) / standardDeviation(envelope), 1)).toBe(3.4);
    expect(Math.round(standardDeviation(jackpot) / standardDeviation(envelope) / 10) * 10).toBe(70);

    // QuickCheck: D(3X + 10) = 9·D(X).
    expect(9 * 4).toBe(36);
    expect(Math.sqrt(36)).toBe(6);
    // Ошибка урока: складываются дисперсии, а не сигмы.
    expect(round(Math.sqrt(9 + 9), 2)).toBe(4.24);

    // Практика 2–3, 6–10.
    const bernoulli = gameDistribution([
      { label: '0', payoff: 0, probability: fraction(9, 10) },
      { label: '100', payoff: 100, probability: fraction(1, 10) },
    ]);
    expect(fractionToNumber(expectedValue(bernoulli))).toBe(10);
    expect(fractionToNumber(distributionVariance(bernoulli))).toBe(900);
    expect(fractionToNumber(varianceThroughSquares(bernoulli))).toBe(900);
    expect(standardDeviation(bernoulli)).toBe(30);

    const die = diceSumDistribution(1);
    expect(distributionVariance(die)).toEqual({ numerator: 35, denominator: 12 });
    expect(round(fractionToNumber(distributionVariance(die)), 2)).toBe(2.92);
    expect(round(standardDeviation(die), 2)).toBe(1.71);

    expect(9 * fractionToNumber(distributionVariance(cube))).toBe(2625);
    expect(round(Math.sqrt(2625), 2)).toBe(51.23);
    expect(3 * 35).toBe(105);
    expect(35 + 100).toBe(135);

    const twoDice = diceSumDistribution(2);
    expect(distributionVariance(twoDice)).toEqual({ numerator: 35, denominator: 6 });
    expect(round(fractionToNumber(distributionVariance(twoDice)), 2)).toBe(5.83);
    expect(round(standardDeviation(twoDice), 2)).toBe(2.42);

    // Сумма ста бросков: D = 100·35/12, σ растёт в 10 раз.
    expect(100 * fractionToNumber(distributionVariance(die))).toBeCloseTo(875 / 3, 10);
    expect(round(Math.sqrt(100 * fractionToNumber(distributionVariance(die))), 2)).toBe(17.08);
    expect(round(standardDeviation(die) / Math.sqrt(100), 2)).toBe(0.17);

    // Монета: M = 50, D = npq = 25, σ = 5, полоса ±3σ — от 35 до 65.
    expect(100 * 0.5).toBe(50);
    expect(100 * 0.5 * 0.5).toBe(25);
    expect(Math.sqrt(25)).toBe(5);
    expect([50 - 3 * 5, 50 + 3 * 5]).toEqual([35, 65]);

    // Практика 11: пятый день — это 4σ у первого поставщика и 1σ у второго.
    expect(standardScore(5, 3, 0.5)).toBe(4);
    expect(standardScore(5, 3, 2)).toBe(1);
  });

  it('урок 6.3: нормальная модель и правило трёх сигм', () => {
    // Правило 68 — 95 — 99,7.
    expect(round(normalBandProbability(1), 4)).toBe(0.6827);
    expect(round(normalBandProbability(2), 4)).toBe(0.9545);
    expect(round(normalBandProbability(3), 4)).toBe(0.9973);
    expect(round((1 - normalBandProbability(3)) * 100, 2)).toBe(0.27);
    expect(Math.round(1 / (1 - normalBandProbability(3)))).toBe(370);
    expect(round((1 - normalBandProbability(2)) * 100, 2)).toBe(4.55);
    expect(Math.round(1 / (1 - normalBandProbability(2)))).toBe(22);
    expect(Math.round(2 / (1 - normalBandProbability(2)))).toBe(44);

    // Сумма четырёх кубиков: M = 14, D = 35/3, σ ≈ 3,42.
    const four = diceSumDistribution(4);
    expect(fractionToNumber(expectedValue(four))).toBe(14);
    expect(distributionVariance(four)).toEqual({ numerator: 35, denominator: 3 });
    expect(round(standardDeviation(four), 2)).toBe(3.42);
    const sigma = standardDeviation(four);
    expect(round(14 - sigma, 2)).toBe(10.58);
    expect(round(14 + sigma, 2)).toBe(17.42);
    expect(round(14 - 2 * sigma, 2)).toBe(7.17);
    expect(round(14 + 2 * sigma, 2)).toBe(20.83);
    expect(round(14 - 3 * sigma, 2)).toBe(3.75);
    expect(round(14 + 3 * sigma, 2)).toBe(24.25);

    // Точные вероятности полос: 221/324, 613/648 и 1.
    expect(withinSigmaProbability(four, 1)).toEqual({ numerator: 221, denominator: 324 });
    expect(round(fractionToNumber(withinSigmaProbability(four, 1)), 4)).toBe(0.6821);
    expect(withinSigmaProbability(four, 2)).toEqual({ numerator: 613, denominator: 648 });
    expect(round(fractionToNumber(withinSigmaProbability(four, 2)), 4)).toBe(0.946);
    expect(fractionToNumber(withinSigmaProbability(four, 3))).toBe(1);

    // Рост юношей: μ = 176, σ = 6.
    expect([176 - 6, 176 + 6]).toEqual([170, 182]);
    expect(176 + 2 * 6).toBe(188);
    expect(round((1 - normalBandProbability(2)) / 2 * 100, 1)).toBe(2.3);
    expect([176 - 3 * 6, 176 + 3 * 6]).toEqual([158, 194]);
    expect(standardScore(185, 176, 6)).toBe(1.5);
    expect(round(normalCdf(1.5, 0, 1) * 100, 2)).toBe(93.32);
    expect(round((1 - normalCdf(1.5, 0, 1)) * 100, 1)).toBe(6.7);
    expect(Math.round(1 / (1 - normalCdf(1.5, 0, 1)))).toBe(15);

    // QuickCheck: пачки тяжелее 508 г при μ = 500, σ = 4.
    expect(standardScore(508, 500, 4)).toBe(2);

    // Джекпот против правила трёх сигм.
    const jackpot = gameDistribution(JACKPOT);
    expect(fractionToNumber(withinSigmaProbability(jackpot, 1))).toBe(0.99);
    expect(round(standardScore(3500, 35, 348.25), 2)).toBe(9.95);

    // Неравенство Чебышёва.
    expect(chebyshevBound(2)).toBe(0.75);
    expect(round(chebyshevBound(3), 4)).toBe(0.8889);
    expect(chebyshevBound(4)).toBe(0.9375);

    // Практика 1–7, 9, 12.
    expect([100 - 15, 100 + 15]).toEqual([85, 115]);
    expect([100 - 30, 100 + 30]).toEqual([70, 130]);
    expect([100 - 45, 100 + 45]).toEqual([55, 145]);
    expect(standardScore(130, 100, 15)).toBe(2);
    // 34,13 % слева от центра до 85 плюс 47,72 % справа до 130 — вместе 81,85 %.
    const leftHalf = round((normalBandProbability(1) / 2) * 100, 2);
    const rightHalf = round((normalBandProbability(2) / 2) * 100, 2);
    expect(leftHalf).toBe(34.13);
    expect(rightHalf).toBe(47.72);
    expect(round(leftHalf + rightHalf, 2)).toBe(81.85);
    expect(standardScore(118, 100, 15)).toBeCloseTo(1.2, 12);
    expect(standardScore(79, 100, 15)).toBeCloseTo(-1.4, 12);
    expect(standardScore(1080, 1000, 40)).toBe(2);
    expect(standardScore(880, 1000, 40)).toBe(-3);
    expect(Math.round(10_000 * (1 - normalBandProbability(3)) / 2)).toBe(13);
    expect(standardScore(85, 70, 10)).toBe(1.5);
    expect(standardScore(62, 50, 8)).toBe(1.5);
    expect(85 - 62).toBe(23);
    // У одного кубика в полосу ±σ попадает 2/3, а в полосу ±2σ — всё.
    expect(withinSigmaProbability(die1(), 1)).toEqual({ numerator: 2, denominator: 3 });
    expect(fractionToNumber(withinSigmaProbability(die1(), 2))).toBe(1);
    expect([500 - 3 * 4, 500 + 3 * 4]).toEqual([488, 512]);
    expect(Math.abs(standardScore(493, 500, 4))).toBeLessThan(2);
  });

  it('урок 6.4: выборка, ошибка и честные выводы', () => {
    // Таблица двадцати опросов воспроизводима: seed 2025, n = 100, p = 0,6.
    const shares = simulateSampleShares(2025, 20, 100, 0.6).map((share) => Math.round(share * 100));
    expect(shares).toEqual([
      66, 56, 63, 55, 55, 57, 63, 67, 63, 64,
      54, 57, 53, 59, 58, 57, 62, 60, 60, 54,
    ]);
    expect(Math.min(...shares)).toBe(53);
    expect(Math.max(...shares)).toBe(67);
    expect(shares.reduce((sum, value) => sum + value, 0) / shares.length).toBeCloseTo(59.15, 12);
    // Ровно 60 % выпало в двух опросах из двадцати.
    expect(shares.filter((value) => value === 60)).toHaveLength(2);

    // Ожидание в маленькой выборке: 12 · 3/5 = 7,2.
    expect(12 * 0.6).toBeCloseTo(7.2, 12);

    // Заголовок «54 % из 1600».
    expect(round(standardError(0.54, 1600), 4)).toBe(0.0125);
    expect(0.54 * 0.46).toBeCloseTo(0.2484, 12);
    expect(round(marginOfError(0.54, 1600), 3)).toBe(0.025);
    expect(round(0.54 * 100 - marginOfError(0.54, 1600) * 100, 1)).toBe(51.5);
    expect(round(0.54 * 100 + marginOfError(0.54, 1600) * 100, 1)).toBe(56.5);
    expect(round(standardError(0.54, 400), 4)).toBe(0.0249);
    expect(round(marginOfError(0.54, 400) * 100, 0)).toBe(5);
    expect(round(0.54 * 100 - marginOfError(0.54, 400) * 100, 0)).toBe(49);
    expect(round(0.54 * 100 + marginOfError(0.54, 400) * 100, 0)).toBe(59);

    // Правило Δ ≈ 1/√n и обратная задача.
    expect(requiredSampleSize(0.05)).toBe(400);
    expect(requiredSampleSize(0.03)).toBe(1112);
    expect(round(1 / 0.03 ** 2, 1)).toBe(1111.1);
    expect(requiredSampleSize(0.02)).toBe(2500);
    expect(requiredSampleSize(0.01)).toBe(10_000);
    expect(round(1 / Math.sqrt(1600) * 100, 1)).toBe(2.5);

    // Практика 1, 6–7, 11.
    expect(standardError(0.5, 2500)).toBeCloseTo(0.01, 12);
    expect(marginOfError(0.5, 2500)).toBeCloseTo(0.02, 12);
    expect(round(standardError(0.4, 900), 4)).toBe(0.0163);
    expect(round(marginOfError(0.4, 900) * 100, 1)).toBe(3.3);
    expect(round(0.4 * 100 - marginOfError(0.4, 900) * 100, 1)).toBe(36.7);
    expect(round(0.4 * 100 + marginOfError(0.4, 900) * 100, 1)).toBe(43.3);
    expect(round(marginOfError(0.92, 5000), 4)).toBe(0.0077);
    expect(round(0.51 * 100 - marginOfError(0.51, 1600) * 100, 1)).toBe(48.5);
    expect(round(0.51 * 100 + marginOfError(0.51, 1600) * 100, 1)).toBe(53.5);

    // Корреляция мороженого и происшествий на воде.
    const icecream = [18, 24, 31, 45, 58, 66, 71];
    const accidents = [3, 5, 4, 9, 11, 10, 14];
    expect(round(correlationCoefficient(icecream, accidents), 2)).toBe(0.95);
  });

  it('урок 6.5: практикум главы', () => {
    // Станция 1: ремонт 12 000 ₽ с вероятностью 1/20.
    const phone = gameDistribution([
      { label: 'цел', payoff: 0, probability: fraction(19, 20) },
      { label: 'разбит', payoff: 12_000, probability: fraction(1, 20) },
    ]);
    expect(fractionToNumber(fairPrice(phone))).toBe(600);
    expect(12_000 ** 2 * 0.05).toBe(7_200_000);
    expect(fractionToNumber(varianceThroughSquares(phone))).toBe(6_840_000);
    expect(fractionToNumber(distributionVariance(phone))).toBe(6_840_000);
    expect(0.95 * 600 ** 2 + 0.05 * 11_400 ** 2).toBeCloseTo(6_840_000, 6);
    expect(Math.round(standardDeviation(phone))).toBe(2615);
    expect(fractionToNumber(netExpectation(phone, 1100))).toBe(-500);

    // Станция 2: портфель из 10 000 полисов.
    const single = standardDeviation(phone);
    expect(round(single / 600, 2)).toBe(4.36);
    expect(Math.round(single * Math.sqrt(10_000))).toBe(261_534);
    expect(round(2615 * 100 / 6_000_000, 4)).toBe(0.0436);
    expect(Math.sqrt(10_000)).toBe(100);

    // Итоговый набор 3–4.
    expect(10_000 * 1100).toBe(11_000_000);
    expect(10_000 * fractionToNumber(fairPrice(phone))).toBe(6_000_000);
    expect(10_000 * 1100 - 10_000 * 600).toBe(5_000_000);
    expect(10_000 * fractionToNumber(distributionVariance(phone))).toBe(68_400_000_000);
    expect(3 * 2615 * 100).toBe(784_500);
    expect(6_000_000 + 784_500).toBe(6_784_500);
    expect(6_784_500).toBeLessThan(11_000_000);

    // Итоговый набор 5–8.
    expect(standardScore(5, 3, 0.5)).toBe(4);
    expect(standardScore(5, 3, 2)).toBe(1);
    expect([500 - 3 * 4, 500 + 3 * 4]).toEqual([488, 512]);
    expect(standardScore(492, 500, 4)).toBe(-2);
    expect(round((1 - normalBandProbability(2)) / 2 * 100, 1)).toBe(2.3);
    expect(Math.round(5000 * (1 - normalBandProbability(3)))).toBe(13);

    // Итоговый набор 9 и 11.
    expect(round(standardError(0.46, 1600), 4)).toBe(0.0125);
    expect(0.46 * 0.54).toBeCloseTo(0.2484, 12);
    expect(round(marginOfError(0.46, 1600) * 100, 1)).toBe(2.5);
    expect(round(0.46 * 100 - marginOfError(0.46, 1600) * 100, 1)).toBe(43.5);
    expect(round(0.46 * 100 + marginOfError(0.46, 1600) * 100, 1)).toBe(48.5);
    expect(requiredSampleSize(0.015)).toBe(4445);
    expect(round(1 / 0.015 ** 2, 1)).toBe(4444.4);
    expect(round(4445 / 1600, 1)).toBe(2.8);
  });
});

/** Одна честная кость — распределение пересчитывается, а не хранится. */
function die1() {
  return diceSumDistribution(1);
}
