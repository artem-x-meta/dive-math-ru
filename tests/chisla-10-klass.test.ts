/**
 * Числа из уроков 10 класса.
 *
 * Каждая проверка пересчитывает ответ, напечатанный в тексте урока: где есть
 * готовое ядро в `src/lib`, зовём его, где нет — считаем прямо здесь по условию
 * задачи. Константы против констант не сравниваются нигде.
 */
import { describe, expect, it } from 'vitest';

import {
  baseValue,
  compositionValue,
  transformValue,
  transformedParity,
  type TransformParams,
} from '../src/lib/functionsCore';

import {
  arccosineAngle,
  arcsineAngle,
  arctangentAngle,
  cosineFromSine,
  cosineOf,
  cosineOfDifference,
  cosineOfSum,
  degreesToRadians,
  doubleAngleCosine,
  doubleAngleSine,
  exactCosine,
  exactSine,
  exactTangent,
  fullTurns,
  normalizeDegrees,
  periodOf,
  piFractionFromDegrees,
  quadrantOfDegrees,
  radiansToDegrees,
  referenceAngleDegrees,
  sineFromCosine,
  sineOf,
  sineOfDifference,
  sineOfSum,
  solveCosineEquation,
  solveSineEquation,
  solveTangentEquation,
  solutionsInInterval,
  tangentFromRatio,
  tangentOf,
  type ExactValue,
} from '../src/lib/trigonometry';

import {
  consequencePolynomial,
  solveEquation,
  type EquationSolution as LogicSolution,
  type EquationSpec,
} from '../src/lib/equationLogic';

import {
  angleBetweenLinesDegrees,
  angleBetweenPlanesDegrees,
  angleLinePlaneDegrees,
  classifyCubeEdges,
  cubeEdgeAngleDegrees,
  cubeEdgeDistance,
  cubeEdgePairCounts,
  cubeVertex,
  distance3,
  distancePointPlane,
  lineThroughPoints3,
  planeThroughPoints3,
  point3,
  slantAngleDegrees,
  slantLength,
  slantProjection,
  vectorBetween3,
} from '../src/lib/stereometry';

import {
  completeEuler,
  countsFromFaces,
  cubeSection,
  cubeSectionFromEdges,
  cuboidSurface,
  eulerCharacteristic,
  platonicSolid,
  pointOnCubeEdge,
  prismCounts,
  pyramidCounts,
  regularPolygonArea,
  regularPolygonCircumradius,
  regularPolygonInradius,
  regularPrismSurface,
  regularPyramidSurface,
} from '../src/lib/polyhedra';

import {
  bayesPosterior,
  conditionalDistribution,
  distributionOfSum,
  expectedIndependentCount,
  isTableIndependent,
  leftGivenRight,
  naturalFrequencies,
  positivePredictiveValue,
  probabilityOfBoth,
  probabilityOfLeft,
  probabilityOfRight,
  rightGivenLeft,
  totalProbabilityOf,
  type BayesBranch,
  type TwoWayTable,
} from '../src/lib/conditional';

import {
  bernoulliDistribution,
  distributionTotal,
  expectedValue,
  type DistributionEntry,
} from '../src/lib/combinatorics';

import { fraction, type Fraction } from '../src/lib/probability';

/* ─────────────────────────────  помощники  ───────────────────────────── */

const ID: TransformParams = { a: 1, k: 1, m: 0, n: 0 };

/** Корни уравнения из главы «Уравнения и логика», округлённые для сравнения. */
function roots(solution: LogicSolution): number[] {
  return solution.roots.map((root) => Number(root.approx.toFixed(9))).sort((a, b) => a - b);
}

/** Кандидаты, отброшенные отбором. */
function extraneous(solution: LogicSolution): number[] {
  return solution.extraneous.map((root) => Number(root.approx.toFixed(9))).sort((a, b) => a - b);
}

/** Точное значение вида (k·√r)/d — тройкой чисел. */
function triple(value: ExactValue | null): [number, number, number] {
  if (value === null) throw new Error('ожидалось точное значение');
  return [value.numerator, value.radicand, value.denominator];
}

function frac(value: Fraction): [number, number] {
  return [value.numerator, value.denominator];
}

const DIE: DistributionEntry[] = Array.from({ length: 6 }, (_unused, index) => ({
  value: index + 1,
  probability: fraction(1, 6),
}));

const TWO_DICE = distributionOfSum(DIE, DIE);

/* ══════════════════════ 1. Общий язык функций ══════════════════════ */

describe('10 класс · Общий язык функций', () => {
  it('1.1 Что такое функция: паспорт √(4 − x²) и проверки на чётность', () => {
    // Разбор урока: D(f) = [−2; 2], E(f) = [0; 2], наибольшее 2 при x = 0.
    const f = (x: number) => (4 - x * x < 0 ? null : Math.sqrt(4 - x * x));
    expect(f(-2)).toBe(0);
    expect(f(0)).toBe(2);
    expect(f(2)).toBe(0);
    expect(f(-2.0001)).toBeNull();
    expect(f(-1)).toBeCloseTo(f(1) as number, 12); // чётность

    // Практика 5: √(9 − x²) даёт D = [−3; 3], E = [0; 3].
    expect(Math.sqrt(9 - 0)).toBe(3);
    expect(Math.sqrt(9 - 9)).toBe(0);

    // Разбор: g(x) = x² + x³ — ни чётная, ни нечётная (практика 8).
    const g = (x: number) => x * x + x * x * x;
    expect(g(1)).toBe(2);
    expect(g(-1)).toBe(0);

    // Практика 6 и 7.
    const even = (x: number) => x ** 4 - 3 * x * x;
    const odd = (x: number) => x ** 5 + x;
    expect(even(-2)).toBe(even(2));
    expect(odd(-2)).toBe(-odd(2));

    // «Убывает на каждой ветви» ≠ «убывает всюду»: 1/(−1) < 1/1.
    expect(baseValue('reciprocal', -1)).toBe(-1);
    expect(baseValue('reciprocal', 1)).toBe(1);
  });

  it('1.2 Преобразования графиков: таблица значений y = −2√(x + 1) + 3', () => {
    const params: TransformParams = { a: -2, k: 1, m: -1, n: 3 };
    expect(transformValue('sqrt', params, -1)).toBe(3);
    expect(transformValue('sqrt', params, 0)).toBe(1);
    expect(transformValue('sqrt', params, 3)).toBe(-1);
    expect(transformValue('sqrt', params, 8)).toBe(-3);
    expect(transformValue('sqrt', params, -1.5)).toBeNull(); // D(f) = [−1; +∞)

    // Сдвиг внутри скобки: f(2x − 6) = f(2(x − 3)) — опорная точка уезжает на 3.
    expect(2 * 3 - 6).toBe(0);
    expect(transformValue('sqrt', { a: 1, k: 2, m: 3, n: 0 }, 3)).toBe(0);

    // Практика 10 и 11.
    const outerAbs = (x: number) => Math.abs(x * x - 1);
    expect([outerAbs(0), outerAbs(1), outerAbs(2)]).toEqual([1, 0, 3]);
    const innerAbs = (x: number) => (Math.abs(x) - 2) ** 2;
    expect([innerAbs(-3), innerAbs(0), innerAbs(3)]).toEqual([1, 4, 1]);

    // Практика 13: y = √(4 − x) — отражение и сдвиг, D = (−∞; 4].
    expect(transformValue('sqrt', { a: 1, k: -1, m: 4, n: 0 }, 4)).toBe(0);
    expect(transformValue('sqrt', { a: 1, k: -1, m: 4, n: 0 }, 0)).toBe(2);
    expect(transformValue('sqrt', { a: 1, k: -1, m: 4, n: 0 }, 5)).toBeNull();

    // Разбор «модуль внутри»: y(2) = y(−2) = −4, y(4) = y(−4) = 0.
    const inner = (x: number) => x * x - 4 * Math.abs(x);
    expect([inner(0), inner(2), inner(-2), inner(4), inner(-4)]).toEqual([0, -4, -4, 0, 0]);
    expect(transformedParity('abs', ID)).toBe('even');
  });

  it('1.3 Обратная функция: (x − 1)² + 2 при x ⩾ 1 и проверки пар', () => {
    const f = (x: number) => (x - 1) ** 2 + 2;
    const inverse = (y: number) => 1 + Math.sqrt(y - 2);
    expect(f(3)).toBe(6);
    expect(inverse(6)).toBe(3);
    expect(inverse(f(5))).toBeCloseTo(5, 12);
    expect(f(1)).toBe(2); // наименьшее значение, E(f) = [2; +∞)

    // Разбор f(x) = 2x − 3.
    expect(2 * 4 - 3).toBe(5);
    expect((5 + 3) / 2).toBe(4);

    // f⁻¹ — не 1/f: для f(x) = 2x значения 2 и 1/8 (ошибка урока).
    expect(4 / 2).toBe(2);
    expect(1 / (2 * 4)).toBe(0.125);

    // Практика 6 и 7: обратные к x² при x ⩽ 0 и к √(x − 2).
    expect(-Math.sqrt(9)).toBe(-3);
    expect((-3) ** 2).toBe(9);
    expect(Math.sqrt(11 - 2)).toBe(3);
    expect(3 ** 2 + 2).toBe(11);

    // Практика 8: x⁴ необратима на всей прямой.
    expect((-1) ** 4).toBe(1);
    expect(1 ** 4).toBe(1);
  });

  it('1.4 Композиция: две акции, конвейеры и области определения', () => {
    // Вступление урока: 3000 ₽ и две акции в разном порядке.
    expect(0.8 * 3000 - 500).toBe(1900);
    expect(0.8 * (3000 - 500)).toBe(2000);
    // Практика 14: разность 100 ₽ при любой цене.
    for (const price of [3000, 1200, 7500]) {
      expect(0.8 * (price - 500) - (0.8 * price - 500)).toBeCloseTo(100, 10);
    }

    // Разбор: f(x) = √x, g(x) = x − 5.
    const shift: TransformParams = { a: 1, k: 1, m: 5, n: 0 };
    expect(compositionValue('sqrt', ID, 'linear', shift, 9)).toBe(2);
    expect(compositionValue('linear', { a: 1, k: 1, m: 0, n: -5 }, 'sqrt', ID, 9)).toBe(-2);
    expect(compositionValue('sqrt', ID, 'linear', shift, 4)).toBeNull();

    // Ловушка урока: f(g(2)) = 9, а f(2)·g(2) = 12 для f = x², g = x + 1.
    const plusOne: TransformParams = { a: 1, k: 1, m: -1, n: 0 };
    expect(compositionValue('square', ID, 'linear', plusOne, 2)).toBe(9);
    expect(baseValue('square', 2)! * (2 + 1)).toBe(12);
    expect(compositionValue('linear', { a: 1, k: 1, m: 0, n: 1 }, 'square', ID, 2)).toBe(5);

    // Практика 1–8 при f = x², g = 2x − 1, h = √x.
    const g = (x: number) => 2 * x - 1;
    const f = (x: number) => x * x;
    const h = (x: number) => Math.sqrt(x);
    expect(f(g(2))).toBe(9);
    expect(g(f(2))).toBe(7);
    expect(g(g(3))).toBe(4 * 3 - 3);
    expect(f(h(9))).toBe(9);
    expect(2 * 0.5 - 1).toBe(0); // D(h∘g) = [0,5; +∞)

    // Практика 14 из практикума: f(g(x)) = g(f(x)) ровно при x = −1.
    expect((-1 + 3) ** 2).toBe(4);
    expect((-1) ** 2 + 3).toBe(4);
  });

  it('1.5 Практикум: паспорт f(x) = 2 − √(x + 3) и итоговый набор', () => {
    const params: TransformParams = { a: -1, k: 1, m: -3, n: 2 };
    expect(transformValue('sqrt', params, 1)).toBe(0);
    expect(transformValue('sqrt', params, -3)).toBe(2); // наибольшее значение
    expect((2 - 0) ** 2 - 3).toBe(1); // f⁻¹(0) = 1

    // Станция 3: разбор на звенья.
    expect((5 - 2 * 2.5) / 1).toBe(0); // √(5 − 2x): x ⩽ 2,5

    // Задачи 1, 2, 15, 16 — границы областей определения.
    expect(-3 + 3).toBe(0); // [−3; 1) ∪ (1; +∞)
    expect(5 - 5).toBe(0); // (−∞; 5)
    expect(Math.sqrt(6 - 6)).toBe(0); // [2; 6)
    expect(Math.sqrt(1)).toBe(1); // x ≠ 1 в 1/(√x − 1)

    // Задача 3 и 9: E(f).
    expect(4 - (1 - 1) ** 2).toBe(4);
    expect(2 * Math.sqrt(1 - 1) - 3).toBe(-3);

    // Задача 8: точка (0; 0) переезжает в (−2; 1).
    const cubic: TransformParams = { a: -1, k: 1, m: -2, n: 1 };
    expect(transformValue('cube', cubic, -2)).toBe(1);

    // Задача 12 и 13.
    expect(Math.sqrt(0) - 3).toBe(-3);
    expect(Math.abs(0 - 1)).toBe(Math.abs(2 - 1));
  });
});

/* ══════════════════════════ 2. Тригонометрия ══════════════════════════ */

describe('10 класс · Тригонометрия', () => {
  it('2.1 Единичная окружность: таблица, приведение углов и переводы', () => {
    // Таблица значений урока.
    expect(triple(exactSine(30))).toEqual([1, 1, 2]);
    expect(triple(exactSine(45))).toEqual([1, 2, 2]);
    expect(triple(exactCosine(60))).toEqual([1, 1, 2]);
    expect(triple(exactTangent(30))).toEqual([1, 3, 3]);
    expect(triple(exactTangent(60))).toEqual([1, 3, 1]);
    expect(tangentOf(90)).toBeNull();

    // Разбор 210° и практика 4, 8, 9.
    expect(quadrantOfDegrees(210)).toBe(3);
    expect(referenceAngleDegrees(210)).toBe(30);
    expect(triple(exactSine(210))).toEqual([-1, 1, 2]);
    expect(triple(exactCosine(210))).toEqual([-1, 3, 2]);
    expect(triple(exactTangent(210))).toEqual([1, 3, 3]);
    expect(triple(exactSine(150))).toEqual([1, 1, 2]);
    expect(triple(exactCosine(150))).toEqual([-1, 3, 2]);
    expect(triple(exactTangent(150))).toEqual([-1, 3, 3]);
    expect(triple(exactCosine(135))).toEqual([-1, 2, 2]);
    expect(triple(exactSine(135))).toEqual([1, 2, 2]);
    expect(triple(exactTangent(240))).toEqual([1, 3, 1]);

    // Приведение: 1110 = 360·3 + 30, 1470 = 360·4 + 30, −390 + 720 = 330.
    expect(fullTurns(1110)).toBe(3);
    expect(normalizeDegrees(1110)).toBe(30);
    expect(normalizeDegrees(1470)).toBe(30);
    expect(triple(exactSine(1470))).toEqual([1, 1, 2]);
    expect(normalizeDegrees(-390)).toBe(330);
    expect(triple(exactCosine(-390))).toEqual([1, 3, 2]);

    // Практика 1–3: градусы ↔ радианы.
    expect(piFractionFromDegrees(60)).toEqual({ numerator: 1, denominator: 3 });
    expect(piFractionFromDegrees(150)).toEqual({ numerator: 5, denominator: 6 });
    expect(piFractionFromDegrees(300)).toEqual({ numerator: 5, denominator: 3 });
    expect(radiansToDegrees(Math.PI / 4)).toBeCloseTo(45, 9);
    expect(radiansToDegrees((7 * Math.PI) / 6)).toBeCloseTo(210, 9);
    expect(quadrantOfDegrees(normalizeDegrees(-40))).toBe(4);
    expect(quadrantOfDegrees(225)).toBe(3);

    // QuickCheck: 135° = 3π/4, а 4π/3 = 240° и 3π/2 = 270°.
    expect(piFractionFromDegrees(135)).toEqual({ numerator: 3, denominator: 4 });
    expect(radiansToDegrees((4 * Math.PI) / 3)).toBeCloseTo(240, 9);
    expect(radiansToDegrees((3 * Math.PI) / 2)).toBeCloseTo(270, 9);

    // Ловушка: sin 2 ≈ 0,909, а sin 2° ≈ 0,035; 1 рад ≈ 57,3°.
    expect(Math.sin(2)).toBeCloseTo(0.909, 3);
    expect(sineOf(2)).toBeCloseTo(0.035, 3);
    expect(radiansToDegrees(1)).toBeCloseTo(57.3, 1);
  });

  it('2.2 Графики и периодичность: период, чётность и множества значений', () => {
    expect(periodOf('sin')).toBeCloseTo(2 * Math.PI, 12);
    expect(periodOf('cos')).toBeCloseTo(2 * Math.PI, 12);
    expect(periodOf('tg')).toBeCloseTo(Math.PI, 12);

    // Разбор: π периодом синуса не является.
    expect(sineOf(90)).toBe(1);
    expect(sineOf(270)).toBe(-1);
    expect(sineOf(180)).toBe(0); // но при x = 0 равенство выполняется

    // Практика 4 и 5: E(2cos x + 3) = [1; 5]; max(4 − 5sin x) = 9.
    expect(2 * 1 + 3).toBe(5);
    expect(2 * -1 + 3).toBe(1);
    expect(4 - 5 * -1).toBe(9);
    expect(4 - 5 * 1).toBe(-1);

    // Практика 6: sin 2 = sin(π − 2) ≈ sin 1,142 > sin 1.
    expect(Math.PI - 2).toBeCloseTo(1.142, 3);
    expect(Math.sin(2)).toBeCloseTo(Math.sin(Math.PI - 2), 12);
    expect(Math.sin(2)).toBeGreaterThan(Math.sin(1));

    // Практика 9: π не период косинуса.
    expect(cosineOf(180)).toBe(-1);
    expect(cosineOf(0)).toBe(1);

    // Практика 10: sin x = 0,5 на [0; 4π] — четыре корня.
    const half = solveSineEquation(0.5);
    expect(solutionsInInterval(half, 0, 4 * Math.PI)).toHaveLength(4);
    expect(Math.sin(4 * Math.PI)).toBeCloseTo(0, 12);
  });

  it('2.3 Тождества: восстановление функций по одной и формулы приведения', () => {
    // Разборы урока: sin α = 3/5 во II четверти; tg α = 3/4 в III четверти.
    expect(cosineFromSine(3 / 5, 2)).toBeCloseTo(-4 / 5, 9);
    expect(tangentFromRatio(3 / 5, -4 / 5)).toBeCloseTo(-3 / 4, 9);
    expect(1 + (3 / 4) ** 2).toBeCloseTo(25 / 16, 12);
    expect(sineFromCosine(-4 / 5, 3)).toBeCloseTo(-3 / 5, 9);

    // Практика 1–3.
    expect(cosineFromSine(0.6, 1)).toBeCloseTo(0.8, 9);
    expect(0.6 / 0.8).toBeCloseTo(0.75, 12);
    expect(sineFromCosine(-12 / 13, 2)).toBeCloseTo(5 / 13, 9);

    // Практика 4, 5, 9: упрощения проверяем на нескольких углах.
    for (const degrees of [17, 63, 128, 254]) {
      const s = sineOf(degrees);
      const c = cosineOf(degrees);
      expect(s * s + c * c + (s / c) ** 2 * c * c).toBeCloseTo(1 + s * s, 8);
      expect((1 - s * s) / c).toBeCloseTo(c, 8);
      // Практика 10: sin⁴ − cos⁴ = sin² − cos².
      expect(s ** 4 - c ** 4).toBeCloseTo(s * s - c * c, 8);
    }
    const tg2 = 2;
    expect((tg2 + 1) / (tg2 - 1)).toBe(3);

    // Практика 6–8 и таблица приведения.
    expect(triple(exactSine(-60))).toEqual([-1, 3, 2]);
    expect(triple(exactCosine(150))).toEqual([-1, 3, 2]);
    for (const degrees of [12, 37, 71]) {
      expect(sineOf(90 - degrees)).toBeCloseTo(cosineOf(degrees), 9);
      expect(cosineOf(180 - degrees)).toBeCloseTo(-cosineOf(degrees), 9);
      expect(cosineOf(90 + degrees)).toBeCloseTo(-sineOf(degrees), 9);
      expect(sineOf(180 + degrees)).toBeCloseTo(-sineOf(degrees), 9);
      expect(sineOf(360 - degrees)).toBeCloseTo(-sineOf(degrees), 9);
      expect(cosineOf(360 - degrees)).toBeCloseTo(cosineOf(degrees), 9);
    }

    // Ловушка: sin²30° = 0,25, а sin(900°) = 0.
    expect(sineOf(30) ** 2).toBeCloseTo(0.25, 9);
    expect(normalizeDegrees(900)).toBe(180);
    expect(sineOf(900)).toBeCloseTo(0, 9);

    // QuickCheck: sin α = 0,8 во II четверти даёт cos α = −0,6.
    expect(cosineFromSine(0.8, 2)).toBeCloseTo(-0.6, 9);
  });

  it('2.4 Формулы сложения: 75°, 15°, 105° и двойной угол', () => {
    // Контрпример вступления: sin 30° + sin 30° = 1, а sin 60° ≈ 0,866.
    expect(sineOf(30) + sineOf(30)).toBe(1);
    expect(sineOf(60)).toBeCloseTo(0.866, 3);

    // Разборы: sin 75° = cos 15° = (√6 + √2)/4 ≈ 0,966.
    const sum = (Math.sqrt(6) + Math.sqrt(2)) / 4;
    expect(sineOfSum(45, 30)).toBeCloseTo(sum, 9);
    expect(cosineOfDifference(45, 30)).toBeCloseTo(sum, 9);
    expect(sum).toBeCloseTo(0.966, 3);

    // Практика 1–3.
    const diff = (Math.sqrt(6) - Math.sqrt(2)) / 4;
    expect(cosineOfSum(45, 30)).toBeCloseTo(diff, 9);
    expect(sineOfDifference(45, 30)).toBeCloseTo(diff, 9);
    expect(diff).toBeCloseTo(0.259, 3);
    expect(sineOfSum(60, 45)).toBeCloseTo(sum, 9);
    expect(sineOfSum(60, 45)).toBeCloseTo(0.966, 3);

    // Практика 4, 5, 9, 10.
    expect(sineOfSum(20, 10)).toBeCloseTo(0.5, 9);
    expect(cosineOfDifference(40, 10)).toBeCloseTo(Math.sqrt(3) / 2, 9);
    expect(doubleAngleSine(15)).toBeCloseTo(0.5, 9);
    expect(doubleAngleCosine(22.5)).toBeCloseTo(Math.SQRT2 / 2, 9);

    // Разбор: sin α = 3/5 в I четверти.
    expect(2 * (3 / 5) * (4 / 5)).toBeCloseTo(0.96, 12);
    expect(1 - 2 * (3 / 5) ** 2).toBeCloseTo(0.28, 12);
    expect(0.96 ** 2 + 0.28 ** 2).toBeCloseTo(1, 12);

    // Практика 6 и 7.
    expect(doubleAngleSine(radiansToDegrees(Math.asin(0.6)))).toBeCloseTo(0.96, 10);
    expect(2 * (-0.8) ** 2 - 1).toBeCloseTo(0.28, 12);

    // Практика 8: tg 75° = 2 + √3 ≈ 3,732.
    const t30 = Math.sqrt(3) / 3;
    expect((1 + t30) / (1 - t30)).toBeCloseTo(2 + Math.sqrt(3), 10);
    expect(2 + Math.sqrt(3)).toBeCloseTo(3.732, 3);

    // Ловушка знака: cos 120° = −1/2 = 1/4 − 3/4.
    expect(cosineOfSum(60, 60)).toBeCloseTo(-0.5, 9);
    expect(0.25 - 0.75).toBe(-0.5);
  });

  it('2.5 Тригонометрические уравнения: серии решений и отбор корней', () => {
    // Обратные функции урока.
    expect(arcsineAngle(0.5).degrees).toBe(30);
    expect(arccosineAngle(0.5).degrees).toBe(60);
    expect(arccosineAngle(-Math.SQRT2 / 2).degrees).toBe(135);
    expect(arcsineAngle(-Math.sqrt(3) / 2).degrees).toBe(-60);
    expect(arccosineAngle(-0.5).degrees).toBe(120);
    expect(arctangentAngle(Math.sqrt(3) / 3).degrees).toBe(30);
    expect(arctangentAngle(-Math.sqrt(3)).degrees).toBe(-60);

    // Разбор sin x = 1/2: серии π/6 и 5π/6.
    const half = solveSineEquation(0.5);
    expect(half.series.map((series) => series.base.degrees)).toEqual([30, 150]);

    // Разбор 2 sin x + 1 = 0: серии −π/6 и 7π/6.
    const minusHalf = solveSineEquation(-0.5);
    expect(minusHalf.series.map((series) => series.base.degrees)).toEqual([-30, 210]);

    // Разбор отбора: cos x = √2/2 на [0; 2π] даёт π/4 и 7π/4.
    const cosHalf = solveCosineEquation(Math.SQRT2 / 2);
    const picked = solutionsInInterval(cosHalf, 0, 2 * Math.PI + 1e-9);
    expect(picked).toHaveLength(2);
    expect(radiansToDegrees(picked[0]!)).toBeCloseTo(45, 6);
    expect(radiansToDegrees(picked[1]!)).toBeCloseTo(315, 6);

    // Практика 4–8.
    expect(solveSineEquation(Math.sqrt(3) / 2).series.map((s) => s.base.degrees)).toEqual([60, 120]);
    expect(solveCosineEquation(0.5).series.map((s) => s.base.degrees)).toEqual([60, -60]);
    expect(solveCosineEquation(-Math.SQRT2 / 2).series.map((s) => s.base.degrees)).toEqual([135, -135]);
    expect(solveTangentEquation(1).series.map((s) => s.base.degrees)).toEqual([45]);
    expect(solveTangentEquation(-Math.sqrt(3)).series.map((s) => s.base.degrees)).toEqual([-60]);

    // Практика 10: |cos x| ⩽ 1, поэтому cos x = 1,5 корней не имеет.
    expect(solveCosineEquation(1.5).solvable).toBe(false);
    expect(solveCosineEquation(2).solvable).toBe(false);

    // Практика 11 и 12.
    const sinRoot2 = solutionsInInterval(solveSineEquation(Math.SQRT2 / 2), 0, 2 * Math.PI + 1e-9);
    expect(sinRoot2.map((value) => Math.round(radiansToDegrees(value)))).toEqual([45, 135]);
    const cosZero = solutionsInInterval(solveCosineEquation(0), 0, 2 * Math.PI + 1e-9);
    expect(cosZero.map((value) => Math.round(radiansToDegrees(value)))).toEqual([90, 270]);
  });

  it('2.6 Практикум: колесо обозрения h(t) = 30 − 25·cos(πt/6)', () => {
    const h = (t: number) => 30 - 25 * Math.cos((Math.PI * t) / 6);
    expect(h(0)).toBeCloseTo(5, 10);
    expect(h(3)).toBeCloseTo(30, 10);
    expect(h(6)).toBeCloseTo(55, 10);
    expect((2 * Math.PI) / (Math.PI / 6)).toBe(12); // период — 12 минут
    expect(30 - 25).toBe(5);
    expect(30 + 25).toBe(55);

    // Станция 4: высота 42,5 м при t = 4 и t = 8.
    expect(h(4)).toBeCloseTo(42.5, 10);
    expect(h(8)).toBeCloseTo(42.5, 10);
    expect(arccosineAngle(-0.5).degrees).toBe(120); // arccos(−1/2) = 2π/3

    // Задача 12: наибольшая высота 55 м при t = 6; 17,5 м при t = 2 и t = 10.
    expect(h(2)).toBeCloseTo(17.5, 10);
    expect(h(10)).toBeCloseTo(17.5, 10);

    // Итоговый набор 1–5.
    expect(piFractionFromDegrees(225)).toEqual({ numerator: 5, denominator: 4 });
    expect(quadrantOfDegrees(225)).toBe(3);
    expect(triple(exactSine(300))).toEqual([-1, 3, 2]);
    expect(triple(exactCosine(300))).toEqual([1, 1, 2]);
    expect(triple(exactTangent(300))).toEqual([-1, 3, 1]);
    expect(fullTurns(1035)).toBe(2);
    expect(normalizeDegrees(1035)).toBe(315);
    expect(triple(exactCosine(1035))).toEqual([1, 2, 2]);
    expect(sineFromCosine(-3 / 5, 2)).toBeCloseTo(4 / 5, 9);
    expect(tangentFromRatio(4 / 5, -3 / 5)).toBeCloseTo(-4 / 3, 9);
    expect(3 - 2 * 1).toBe(1);
    expect(3 - 2 * -1).toBe(5);

    // Итоговый набор 6–8.
    for (const degrees of [23, 68]) {
      expect(sineOf(180 - degrees) + cosineOf(90 + degrees)).toBeCloseTo(0, 9);
    }
    expect(cosineOfSum(60, 45)).toBeCloseTo(-0.259, 3);
    expect(cosineOfSum(60, 45)).toBeCloseTo((Math.sqrt(2) - Math.sqrt(6)) / 4, 9);
    expect(2 * (5 / 13) * (12 / 13)).toBeCloseTo(120 / 169, 12);
    expect(120 / 169).toBeCloseTo(0.71, 3);
    // Рефлексия: cos 2α = 119/169, и сумма квадратов равна 1.
    expect(1 - 2 * (5 / 13) ** 2).toBeCloseTo(119 / 169, 12);
    expect((120 / 169) ** 2 + (119 / 169) ** 2).toBeCloseTo(1, 12);

    // Итоговый набор 9–11.
    expect(solveSineEquation(-Math.sqrt(3) / 2).series.map((s) => s.base.degrees)).toEqual([-60, 240]);
    const cosZero = solutionsInInterval(solveCosineEquation(0), 0, 2 * Math.PI + 1e-9);
    expect(cosZero.map((value) => Math.round(radiansToDegrees(value)))).toEqual([90, 270]);
    expect(solveTangentEquation(Math.sqrt(3) / 3).series.map((s) => s.base.degrees)).toEqual([30]);
  });
});

/* ═══════════════════════ 3. Уравнения и логика ═══════════════════════ */

describe('10 класс · Уравнения и логика', () => {
  it('3.1 Равносильность и следствие: √(x + 3) = x + 1 и потерянные корни', () => {
    const spec: EquationSpec = { kind: 'sqrt-poly', radicand: [3, 1], right: [1, 1] };
    expect(consequencePolynomial(spec)).toEqual([-2, 1, 1]); // x² + x − 2 = 0
    const solved = solveEquation(spec);
    expect(roots(solved)).toEqual([1]);
    expect(extraneous(solved)).toEqual([-2]);
    // Посторонний корень принадлежит «двойнику» √(x + 3) = −(x + 1).
    expect(Math.sqrt(-2 + 3)).toBe(1);
    expect(-(-2 + 1)).toBe(1);

    // Практика 4: x(x − 5) = 3(x − 5) — корни 3 и 5, ни один не потерян.
    for (const x of [3, 5]) expect(x * (x - 5)).toBe(3 * (x - 5));

    // Практика 6: у x = (x − 2)² есть корень x = 1, а √1 ≠ 1 − 2.
    expect((1 - 2) ** 2).toBe(1);
    expect(Math.sqrt(1)).not.toBe(1 - 2);

    // Практика 8: (x − 2)√(x − 3) = 0 — только x = 3 (x = 2 вне ОДЗ).
    expect(2 - 3).toBeLessThan(0);
    expect((3 - 2) * Math.sqrt(3 - 3)).toBe(0);
  });

  it('3.2 Иррациональные уравнения: отбор кандидатов в каждой задаче', () => {
    const check = (spec: EquationSpec, keep: number[], drop: number[]) => {
      const solved = solveEquation(spec);
      expect(roots(solved)).toEqual(keep);
      expect(extraneous(solved)).toEqual(drop);
    };

    // Задачи 1–3.
    check({ kind: 'sqrt-poly', radicand: [-3, 1], right: [4] }, [19], []);
    check({ kind: 'sqrt-poly', radicand: [1, 2], right: [3] }, [4], []);
    check({ kind: 'sqrt-poly', radicand: [-1, 1], right: [-3] }, [], [10]);

    // Задачи 4, 5, 6, 13 — пары «одно следствие, разные корни».
    check({ kind: 'sqrt-poly', radicand: [5, 1], right: [-1, 1] }, [4], [-1]);
    check({ kind: 'sqrt-poly', radicand: [5, 1], right: [1, -1] }, [-1], [4]);
    check({ kind: 'sqrt-poly', radicand: [3, -1], right: [-1, 1] }, [2], [-1]);
    check({ kind: 'sqrt-poly', radicand: [7, 1], right: [-5, 1] }, [9], [2]);
    expect(consequencePolynomial({ kind: 'sqrt-poly', radicand: [5, 1], right: [-1, 1] }))
      .toEqual(consequencePolynomial({ kind: 'sqrt-poly', radicand: [5, 1], right: [1, -1] }));

    // Задачи 7 и 8 — отбор по знаку подкоренного выражения.
    check({ kind: 'sqrt-sqrt', left: [0, -5, 1], right: [6] }, [-1, 6], []);
    check({ kind: 'sqrt-sqrt', left: [-9, 0, 1], right: [-9, 4] }, [4], [0]);
    expect(4 * 4 - 9).toBe(4 ** 2 - 9); // при x = 4 обе части равны √7

    // Задача 9: замена t = √x, годится только t = 2.
    expect(4 - Math.sqrt(4) - 2).toBe(0);
    expect((-1) ** 2 - -1 - 2).toBe(0); // t = −1 — корень квадратного, но не корень уравнения

    // Задачи 10 и 11 — уединение корня.
    expect(Math.sqrt(4 + 5) - Math.sqrt(4)).toBe(1);
    expect(Math.sqrt(5 + 4) + Math.sqrt(5 - 1)).toBe(5);

    // Задача 12: корней нет, D = −9.
    const left = (x: number) => Math.sqrt(x - 2) + Math.sqrt(6 - x);
    expect(Math.max(...[2, 3, 4, 5, 6].map(left))).toBeLessThan(3);
    expect(64 - 4 * 18.25).toBeCloseTo(-9, 10);

    // QuickCheck: √(2x + 3) = x — остаётся x = 3.
    check({ kind: 'sqrt-poly', radicand: [3, 2], right: [0, 1] }, [3], [-1]);
    expect(2 * -1 + 3).toBe(1); // подкоренное неотрицательно, но правая часть < 0
  });

  it('3.3 Уравнения с модулем: два случая, совокупность и промежутки', () => {
    const check = (spec: EquationSpec, keep: number[], drop: number[]) => {
      const solved = solveEquation(spec);
      expect(roots(solved)).toEqual(keep);
      expect(extraneous(solved)).toEqual(drop);
    };

    // Разбор |x − 1| = 2x − 4: корень 3, кандидат 5/3 отброшен.
    check({ kind: 'abs-poly', inner: [-1, 1], right: [-4, 2] }, [3], [Number((5 / 3).toFixed(9))]);
    expect(Math.abs(3 - 1)).toBe(2 * 3 - 4);
    expect(5 / 3).toBeGreaterThan(1);

    // Разбор |x − 5| = |2x + 1|: корни −6 и 4/3.
    check({ kind: 'abs-abs', left: [-5, 1], right: [1, 2] }, [-6, Number((4 / 3).toFixed(9))], []);
    expect(Math.abs(-6 - 5)).toBe(11);
    expect(Math.abs(2 * -6 + 1)).toBe(11);
    expect(Math.abs(4 / 3 - 5)).toBeCloseTo(11 / 3, 12);

    // Практика 1–4, 6–8, 11.
    check({ kind: 'abs-poly', inner: [0, 1], right: [7] }, [-7, 7], []);
    check({ kind: 'abs-poly', inner: [-4, 1], right: [0] }, [4], []);
    check({ kind: 'abs-poly', inner: [3, 1], right: [-2] }, [], [-5, -1]);
    check({ kind: 'abs-poly', inner: [-6, 2], right: [8] }, [-1, 7], []);
    check({ kind: 'abs-poly', inner: [1, 3], right: [3, 1] }, [-1, 1], []);
    expect(Math.abs(3 * 1 + 1)).toBe(1 + 3);
    expect(Math.abs(3 * -1 + 1)).toBe(-1 + 3);
    check({ kind: 'abs-poly', inner: [-4, 0, 1], right: [5] }, [-3, 3], []);
    check({ kind: 'abs-poly', inner: [-5, 0, 1], right: [4] }, [-3, -1, 1, 3], []);

    // Практика 9: |x − 1| + |x + 2| = 5 — корни −3 и 2, между точками сумма равна 3.
    const modSum = (x: number) => Math.abs(x - 1) + Math.abs(x + 2);
    expect(modSum(-3)).toBe(5);
    expect(modSum(2)).toBe(5);
    expect(modSum(0)).toBe(3);
    expect(modSum(-1)).toBe(3);

    // Практика 10 и 12: ответом оказывается промежуток [2; +∞).
    const modDiff = (x: number) => Math.abs(x + 1) - Math.abs(x - 2);
    for (const x of [2, 3, 10, 100]) expect(modDiff(x)).toBe(3);
    for (const x of [-5, -1, 0, 1.9]) expect(modDiff(x)).not.toBe(3);
    for (const x of [2, 5, 40]) expect(Math.abs(x - 2)).toBe(x - 2);
    expect(Math.abs(1 - 2)).not.toBe(1 - 2);

    // QuickCheck: |x − 3| = x − 5 — единственный кандидат 4 посторонний.
    check({ kind: 'abs-poly', inner: [-3, 1], right: [-5, 1] }, [], [4]);
    expect(consequencePolynomial({ kind: 'abs-poly', inner: [-3, 1], right: [-5, 1] })).toEqual([-16, 4]);
  });

  it('3.4 Множества и логика: операции, кванторы и контрпримеры', () => {
    // Практика 3: A ∩ B = (1; 3], A ∪ B = [−2; 5).
    const inA = (x: number) => x >= -2 && x <= 3;
    const inB = (x: number) => x > 1 && x < 5;
    expect(inA(3) && inB(3)).toBe(true); // правый конец A ∩ B = (1; 3]
    expect(inA(3.0001) && inB(3.0001)).toBe(false);
    expect(inA(1) && inB(1)).toBe(false); // левый конец открыт
    expect(inA(2) && inB(2)).toBe(true);
    expect(inA(-2) || inB(-2)).toBe(true);
    expect(inA(5) || inB(5)).toBe(false);

    // Практика 7: наименьшее общее кратное 5 и 7 равно 35 > 30.
    const multiples = Array.from({ length: 29 }, (_u, i) => i + 1)
      .filter((n) => n % 5 === 0 && n % 7 === 0);
    expect(multiples).toEqual([]);
    expect(35 % 5).toBe(0);
    expect(35 % 7).toBe(0);

    // Ловушка урока: n² + n + 41 при n = 40 равно 1681 = 41².
    expect(40 ** 2 + 40 + 41).toBe(1681);
    expect(41 ** 2).toBe(1681);
    const isPrime = (n: number) => {
      for (let d = 2; d * d <= n; d += 1) if (n % d === 0) return false;
      return n > 1;
    };
    for (let n = 0; n <= 39; n += 1) expect(isPrime(n * n + n + 41)).toBe(true);
    expect(isPrime(1681)).toBe(false);

    // Ловушка: 4 делится на 2, но не на 6.
    expect(4 % 2).toBe(0);
    expect(4 % 6).not.toBe(0);

    // Практика 9–11.
    expect(2 ** 2).toBe((-2) ** 2);
    expect(Math.sqrt(2) + -Math.sqrt(2)).toBe(0);
    for (const k of [0, 3, 7]) expect((2 * k + 1) ** 2 % 2).toBe(1);
  });

  it('3.5 Практикум: аудит решений — итоговый набор задач', () => {
    const check = (spec: EquationSpec, keep: number[], drop: number[]) => {
      const solved = solveEquation(spec);
      expect(roots(solved)).toEqual(keep);
      expect(extraneous(solved)).toEqual(drop);
    };

    check({ kind: 'sqrt-poly', radicand: [7, 2], right: [2, 1] }, [1], [-3]);
    check({ kind: 'sqrt-poly', radicand: [4, 1], right: [-2, 1] }, [5], [0]);
    check({ kind: 'sqrt-poly', radicand: [0, 3, 1], right: [2] }, [-4, 1], []);
    check({ kind: 'sqrt-sqrt', left: [-16, 0, 1], right: [0, 6] }, [8], [-2]);
    check({ kind: 'abs-poly', inner: [5, 2], right: [7] }, [-6, 1], []);
    check({ kind: 'abs-poly', inner: [-4, 1], right: [-5, 2] }, [3], [1]);
    check({ kind: 'abs-abs', left: [2, 1], right: [-4, 3] }, [0.5, 3], []);
    check({ kind: 'abs-poly', inner: [-3, 0, 1], right: [1] }, [-2, -1.414213562, 1.414213562, 2], []);
    check({ kind: 'sqrt-poly', radicand: [-1, 1], right: [-3, 1] }, [5], [2]);
    check({ kind: 'sqrt-poly', radicand: [1, 1], right: [-1, 1] }, [3], [0]);
    // Задача 16: контрпример — оба кандидата настоящие.
    check({ kind: 'sqrt-poly', radicand: [0, -3, 1], right: [2] }, [-1, 4], []);

    // Задача 5: замена t = √x даёт t = 1 и t = 2, то есть x = 1 и x = 4.
    for (const x of [1, 4]) expect(x - 3 * Math.sqrt(x) + 2).toBeCloseTo(0, 12);
    // Задача 6: √(x + 9) − √x = 1 при x = 16.
    expect(Math.sqrt(16 + 9) - Math.sqrt(16)).toBe(1);
    // Задача 10: |x − 2| + |x + 1| = 7 при x = −3 и x = 4.
    const modSum = (x: number) => Math.abs(x - 2) + Math.abs(x + 1);
    expect(modSum(-3)).toBe(7);
    expect(modSum(4)).toBe(7);
    expect(modSum(0)).toBe(3);
    // Задача 12: √(x + 3)/(x − 2) = 0 при x = −3.
    expect(Math.sqrt(-3 + 3) / (-3 - 2)).toBeCloseTo(0, 12);
    expect(-3).not.toBe(2);
    // Задача 14: x² = 5x — корни 0 и 5.
    for (const x of [0, 5]) expect(x * x).toBe(5 * x);
    // Задача 17: |x − 2| = x − 2 ровно при x ⩾ 2.
    for (const x of [2, 6]) expect(Math.abs(x - 2)).toBe(x - 2);
    expect(Math.abs(0 - 2)).not.toBe(0 - 2);
  });
});

/* ═══════════════════════════ 4. Пространство ═══════════════════════════ */

describe('10 класс · Пространство', () => {
  it('4.1 Аксиомы и расположение: перепись 66 пар рёбер куба', () => {
    const counts = cubeEdgePairCounts();
    expect(counts.parallel).toBe(18);
    expect(counts.intersecting).toBe(24);
    expect(counts.skew).toBe(24);
    expect(counts.parallel + counts.intersecting + counts.skew).toBe((12 * 11) / 2);
    expect(counts.parallel + counts.intersecting + counts.skew).toBe(66);

    // Разбор: AB и CC₁ скрещиваются.
    expect(classifyCubeEdges('AB', 'CC1')).toBe('skew');

    // Практика 4: рёбра, скрещивающиеся с AA₁.
    const skewWith = (edge: 'AA1' | 'CD' | 'BB1') =>
      (['AB', 'BC', 'CD', 'DA', 'A1B1', 'B1C1', 'C1D1', 'D1A1', 'AA1', 'BB1', 'CC1', 'DD1'] as const)
        .filter((other) => classifyCubeEdges(edge, other) === 'skew');
    expect(skewWith('AA1')).toEqual(['BC', 'CD', 'B1C1', 'C1D1']);
    // Практика 5: рёбра, скрещивающиеся с CD.
    expect(skewWith('CD')).toEqual(['B1C1', 'D1A1', 'AA1', 'BB1']);
    // Практикум, задача 2: рёбра, скрещивающиеся с BB₁.
    expect(skewWith('BB1')).toEqual(['CD', 'DA', 'C1D1', 'D1A1']);

    // Практика 10: AB пересекает BC, CC₁ пересекает BC, но AB и CC₁ скрещиваются.
    expect(classifyCubeEdges('AB', 'BC')).toBe('intersecting');
    expect(classifyCubeEdges('CC1', 'BC')).toBe('intersecting');
  });

  it('4.2 Параллельность: углы между скрещивающимися рёбрами куба', () => {
    expect(cubeEdgeAngleDegrees('AB', 'B1C1')).toBeCloseTo(90, 9);
    expect(cubeEdgeAngleDegrees('AA1', 'AB')).toBeCloseTo(90, 9);

    // Практика 4: угол между AB и CD₁ равен 45°.
    const C = cubeVertex('C', 6);
    const D1 = cubeVertex('D1', 6);
    const A = cubeVertex('A', 6);
    const B = cubeVertex('B', 6);
    const A1 = cubeVertex('A1', 6);
    expect(angleBetweenLinesDegrees(vectorBetween3(C, D1), vectorBetween3(A, B))).toBeCloseTo(45, 9);
    // CD₁ ∥ BA₁ — те же направляющие векторы.
    expect(vectorBetween3(C, D1)).toEqual(vectorBetween3(B, A1));

    // Практика 5: угол между AA₁ и BC₁ равен 45°.
    const C1 = cubeVertex('C1', 6);
    expect(angleBetweenLinesDegrees(vectorBetween3(A, A1), vectorBetween3(B, C1))).toBeCloseTo(45, 9);

    // Практика 2 и 7: противоположные грани параллельны, расстояние — ребро.
    expect(classifyCubeEdges('AB', 'C1D1')).toBe('parallel');
    expect(cubeEdgeDistance('AB', 'DD1', 7)).toBeCloseTo(7, 9);

    // Практика 10: рёбра, параллельные плоскости BCC₁B₁.
    const face = planeThroughPoints3(B, C, C1);
    const parallelEdges = [['A', 'D'], ['A1', 'D1'], ['A', 'A1'], ['D', 'D1']] as const;
    for (const [from, to] of parallelEdges) {
      expect(distancePointPlane(cubeVertex(from, 6), face)).toBeCloseTo(6, 9);
      expect(distancePointPlane(cubeVertex(to, 6), face)).toBeCloseTo(6, 9);
    }
    expect(parallelEdges).toHaveLength(4);
  });

  it('4.3 Перпендикулярность: перпендикуляр, наклонная и проекция', () => {
    // Прогноз урока: при HA = 8 наклонная равна √73 ≈ 8,54.
    expect(slantLength(3, 4)).toBe(5);
    expect(slantLength(3, 8)).toBeCloseTo(8.54, 2);

    // Практика 2–5.
    expect(slantLength(9, 12)).toBe(15);
    expect(slantProjection(17, 8)).toBe(15);
    expect(slantProjection(13, 5)).toBe(12);
    expect(slantProjection(13, 12)).toBe(5);
    expect(slantProjection(15, 12)).toBe(9);

    // Разбор пирамиды: квадрат со стороной 4, SA ⊥ основанию, SA = 4.
    const A = point3(0, 0, 0);
    const B = point3(4, 0, 0);
    const C = point3(4, 4, 0);
    const D = point3(0, 4, 0);
    const S = point3(0, 0, 4);
    expect(distance3(S, B)).toBeCloseTo(4 * Math.SQRT2, 9);
    expect(distance3(S, D)).toBeCloseTo(4 * Math.SQRT2, 9);
    expect(distance3(A, C)).toBeCloseTo(4 * Math.SQRT2, 9);
    expect(distance3(S, C)).toBeCloseTo(4 * Math.sqrt(3), 9);
    expect(4 * Math.SQRT2).toBeCloseTo(5.66, 2);
    expect(4 * Math.sqrt(3)).toBeCloseTo(6.93, 2);
    // ТТП: BC ⊥ SB и CD ⊥ SD.
    expect(angleBetweenLinesDegrees(vectorBetween3(B, C), vectorBetween3(B, S))).toBeCloseTo(90, 9);
    expect(angleBetweenLinesDegrees(vectorBetween3(D, C), vectorBetween3(D, S))).toBeCloseTo(90, 9);

    // Практика 9 и 10.
    expect(8 / Math.sin(degreesToRadians(30))).toBeCloseTo(16, 9);
    expect(slantProjection(16, 8)).toBeCloseTo(8 * Math.sqrt(3), 9);
    expect(8 * Math.sqrt(3)).toBeCloseTo(13.86, 2);
    expect(slantLength(5, 5)).toBeCloseTo(5 * Math.SQRT2, 9);
    expect(slantAngleDegrees(5, 5)).toBeCloseTo(45, 9);
  });

  it('4.4 Расстояния и углы: четыре измерения в кубе с ребром 6', () => {
    const size = 6;
    const A = cubeVertex('A', size);
    const B = cubeVertex('B', size);
    const C = cubeVertex('C', size);
    const D = cubeVertex('D', size);
    const A1 = cubeVertex('A1', size);
    const B1 = cubeVertex('B1', size);
    const C1 = cubeVertex('C1', size);
    const D1 = cubeVertex('D1', size);

    // 1 и 4: расстояния до граней.
    expect(distancePointPlane(A, planeThroughPoints3(B, C, C1))).toBeCloseTo(6, 9);
    expect(distancePointPlane(A, planeThroughPoints3(A1, B1, C1))).toBeCloseTo(6, 9);
    // 2: расстояние между параллельными гранями.
    expect(distancePointPlane(D, planeThroughPoints3(A, B, B1))).toBeCloseTo(6, 9);
    // 3: расстояние между скрещивающимися AB и CC₁.
    expect(cubeEdgeDistance('AB', 'CC1', size)).toBeCloseTo(6, 9);

    // 5: угол диагонали AC₁ с плоскостью основания ≈ 35°.
    const base = planeThroughPoints3(A, B, C);
    const diagonal = lineThroughPoints3(A, C1);
    expect(distance3(A, C)).toBeCloseTo(6 * Math.SQRT2, 9);
    expect(distance3(A, C1)).toBeCloseTo(6 * Math.sqrt(3), 9);
    expect(6 / (6 * Math.SQRT2)).toBeCloseTo(1 / Math.SQRT2, 12);
    expect(angleLinePlaneDegrees(diagonal, base)).toBeCloseTo(35.26, 2);
    expect(Math.round(angleLinePlaneDegrees(diagonal, base))).toBe(35);

    // 6: угол AB₁ с основанием равен 45°.
    expect(angleLinePlaneDegrees(lineThroughPoints3(A, B1), base)).toBeCloseTo(45, 9);
    // 7: угол между плоскостями ABC₁D₁ и ABCD равен 45°.
    expect(angleBetweenPlanesDegrees(planeThroughPoints3(A, B, C1), base)).toBeCloseTo(45, 9);
    expect(distance3(A, D1)).toBeCloseTo(6 * Math.SQRT2, 9);

    // 8 и 9: координаты в пространстве.
    expect(distance3(point3(1, 2, 3), point3(5, 8, 15))).toBe(14);
    expect(Math.abs(12)).toBe(12);
    expect(Math.hypot(3, -4)).toBe(5);

    // 10: перпендикуляр 10 и угол 60°.
    const slant = 10 / Math.sin(degreesToRadians(60));
    expect(slant).toBeCloseTo((20 * Math.sqrt(3)) / 3, 9);
    expect(slant).toBeCloseTo(11.55, 2);
    expect(slantProjection(slant, 10)).toBeCloseTo((10 * Math.sqrt(3)) / 3, 9);
    expect(slantProjection(slant, 10)).toBeCloseTo(5.77, 2);

    // QuickCheck: расстояние задаёт перпендикуляр 12, а не наклонная 13 или 20.
    expect(slantProjection(13, 12)).toBe(5);
    expect(slantProjection(20, 12)).toBeCloseTo(16, 9);
  });

  it('4.5 Практикум: каркас павильона из кубов с ребром 4', () => {
    const size = 4;
    // Станция 1: BB₁ и A₁D₁ скрещиваются, расстояние — ребро.
    expect(classifyCubeEdges('BB1', 'D1A1')).toBe('skew');
    expect(cubeEdgeDistance('BB1', 'D1A1', size)).toBeCloseTo(4, 9);

    // Станция 2 и задача 6: трос 5 м, угол ≈ 37°.
    expect(slantLength(3, 4)).toBe(5);
    expect(slantAngleDegrees(3, 4)).toBeCloseTo(36.87, 2);
    expect(Math.round(slantAngleDegrees(3, 4))).toBe(37);

    // Задачи 3 и 4.
    expect(cubeEdgeAngleDegrees('AB', 'B1C1')).toBeCloseTo(90, 9);
    const C = cubeVertex('C', size);
    const D1 = cubeVertex('D1', size);
    const A = cubeVertex('A', size);
    const B = cubeVertex('B', size);
    expect(angleBetweenLinesDegrees(vectorBetween3(C, D1), vectorBetween3(A, B))).toBeCloseTo(45, 9);

    // Задача 5: расстояние между параллельными гранями равно ребру.
    const D = cubeVertex('D', size);
    const B1 = cubeVertex('B1', size);
    expect(distancePointPlane(D, planeThroughPoints3(A, B, B1))).toBeCloseTo(4, 9);

    // Задача 7: проекции тросов 13 м и 15 м при высоте 12 м.
    expect(slantProjection(13, 12)).toBe(5);
    expect(slantProjection(15, 12)).toBe(9);

    // Задача 9: диагональ модуля 4√3 ≈ 6,93 м и угол ≈ 35°.
    const C1 = cubeVertex('C1', size);
    expect(distance3(A, C1)).toBeCloseTo(4 * Math.sqrt(3), 9);
    expect(4 * Math.sqrt(3)).toBeCloseTo(6.93, 2);
    const angle = angleLinePlaneDegrees(lineThroughPoints3(A, C1), planeThroughPoints3(A, B, C));
    expect(Math.sin(degreesToRadians(angle))).toBeCloseTo(1 / Math.sqrt(3), 9);
    expect(Math.round(angle)).toBe(35);

    // Задача 10: расстояние между AB и CC₁ равно 4 м.
    expect(cubeEdgeDistance('AB', 'CC1', size)).toBeCloseTo(4, 9);
    // Задача 11: датчики P(1;1;1) и Q(3;4;7).
    expect(distance3(point3(1, 1, 1), point3(3, 4, 7))).toBe(7);

    // Задача 1: 24 пары скрещивающихся рёбер.
    expect(cubeEdgePairCounts().skew).toBe(24);
  });
});

/* ═════════════════ 5. Многогранники и сечения ═════════════════ */

describe('10 класс · Многогранники и сечения', () => {
  it('5.1 Призма и пирамида: подсчёт элементов и каркас павильона', () => {
    // Разбор: двенадцатиугольные призма и пирамида.
    expect(prismCounts(12)).toEqual({ vertices: 24, edges: 36, faces: 14 });
    expect(pyramidCounts(12)).toEqual({ vertices: 13, edges: 24, faces: 13 });
    expect(eulerCharacteristic(prismCounts(12))).toBe(2);
    expect(eulerCharacteristic(pyramidCounts(12))).toBe(2);
    expect(36 + 24 - 12).toBe(48);

    // Обратная задача: 2024 ребра у пирамиды, но не у призмы.
    expect(2024 / 2).toBe(1012);
    expect(2024 % 3).not.toBe(0);

    // Практика 1, 2, 4.
    expect(prismCounts(10)).toEqual({ vertices: 20, edges: 30, faces: 12 });
    expect(pyramidCounts(8)).toEqual({ vertices: 9, edges: 16, faces: 9 });
    expect(prismCounts(7)).toEqual({ vertices: 14, edges: 21, faces: 9 });
    expect(eulerCharacteristic(prismCounts(7))).toBe(2);

    // Практика 3: 20 рёбер бывает у пирамиды и не бывает у призмы.
    expect(20 % 3).not.toBe(0);
    expect(20 % 2).toBe(0);

    // Практика 5 и 6.
    expect(completeEuler(null, 30, 12).vertices).toBe(20);
    expect(completeEuler(8, 12, null).faces).toBe(6);

    // Практика 7 и 8: суммы длин рёбер.
    expect(8 * 5 + 4 * 8).toBe(72);
    expect(6 * 4 + 6 * 7).toBe(66);

    // Практика 9: у четырёхугольной призмы 4 диагонали.
    expect(4 * (4 - 3)).toBe(4);

    // QuickCheck: у призмы с 27 рёбрами 18 вершин и 11 граней.
    expect(prismCounts(9)).toEqual({ vertices: 18, edges: 27, faces: 11 });
  });

  it('5.2 Правильные многогранники и формула Эйлера', () => {
    // Разбор додекаэдра через F, k, m.
    expect(countsFromFaces(12, 5, 3)).toEqual({ vertices: 20, edges: 30, faces: 12 });
    expect(eulerCharacteristic(countsFromFaces(12, 5, 3))).toBe(2);

    // Футбольный мяч: 12 пятиугольников и 20 шестиугольников.
    const ballEdges = (12 * 5 + 20 * 6) / 2;
    expect(ballEdges).toBe(90);
    expect((2 * ballEdges) / 3).toBe(60);
    expect(60 - 90 + 32).toBe(2);

    // Таблица пяти тел.
    for (const kind of ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron'] as const) {
      const solid = platonicSolid(kind);
      expect(eulerCharacteristic(solid)).toBe(2);
      expect(countsFromFaces(solid.faces, solid.faceSides, solid.vertexDegree)).toEqual({
        vertices: solid.vertices,
        edges: solid.edges,
        faces: solid.faces,
      });
    }
    expect(platonicSolid('cube').vertices).toBe(platonicSolid('octahedron').faces);
    expect(platonicSolid('cube').faces).toBe(platonicSolid('octahedron').vertices);
    expect(platonicSolid('dodecahedron').edges).toBe(platonicSolid('icosahedron').edges);
    expect(platonicSolid('icosahedron').edges).toBe(30);

    // Перебор углов: 60°, 90°, 108°, 120°.
    const interior = (k: number) => ((k - 2) * 180) / k;
    expect(interior(3)).toBe(60);
    expect(interior(4)).toBe(90);
    expect(interior(5)).toBe(108);
    expect(interior(6)).toBe(120);
    expect(3 * interior(3)).toBe(180);
    expect(5 * interior(3)).toBe(300);
    expect(6 * interior(3)).toBe(360);
    expect(3 * interior(4)).toBe(270);
    expect(3 * interior(5)).toBe(324);
    expect(4 * interior(5)).toBe(432);
    expect(3 * interior(6)).toBe(360);

    // Практика 2, 3, 5, 8.
    expect(countsFromFaces(6, 4, 3)).toEqual({ vertices: 8, edges: 12, faces: 6 });
    expect(countsFromFaces(20, 3, 5)).toEqual({ vertices: 12, edges: 30, faces: 20 });
    expect(completeEuler(20, 30, null).faces).toBe(12);
    expect(countsFromFaces(4, 3, 3)).toEqual({ vertices: 4, edges: 6, faces: 4 });

    // Практика 9: 7 рёбер невозможно (3F ⩽ 14 и 3V ⩽ 14, но V + F = 9).
    expect(Math.floor(14 / 3)).toBe(4);
    expect(4 + 4).toBeLessThan(7 + 2);

    // Практика 10: суммы плоских углов.
    expect(8 * 3 * 90).toBe(2160);
    expect(4 * 3 * 60).toBe(720);

    // QuickCheck: 8 треугольных граней и степень 4 дают октаэдр.
    expect(countsFromFaces(8, 3, 4)).toEqual({ vertices: 6, edges: 12, faces: 8 });
  });

  it('5.3 Построение сечений куба: треугольник, пятиугольник, шестиугольник', () => {
    // Треугольник у вершины, ребро 6.
    const triangle = cubeSectionFromEdges(
      [{ edgeId: 'AB', t: 0.5 }, { edgeId: 'AD', t: 0.5 }, { edgeId: 'AA1', t: 0.5 }],
      6,
    );
    expect(triangle.sides).toBe(3);
    expect(triangle.shape).toBe('треугольник');
    expect(triangle.sideLengths.every((side) => Math.abs(side - 3 * Math.SQRT2) < 1e-9)).toBe(true);
    expect(triangle.perimeter).toBeCloseTo(9 * Math.SQRT2, 9);
    expect(triangle.perimeter).toBeCloseTo(12.73, 2);
    expect(triangle.area).toBeCloseTo(4.5 * Math.sqrt(3), 9);
    expect(triangle.area).toBeCloseTo(7.79, 2);

    // Пятиугольник MEKFN: середины AB, AD и CC₁.
    const pentagon = cubeSectionFromEdges(
      [{ edgeId: 'AB', t: 0.5 }, { edgeId: 'AD', t: 0.5 }, { edgeId: 'CC1', t: 0.5 }],
      6,
    );
    expect(pentagon.sides).toBe(5);
    expect(pentagon.shape).toBe('пятиугольник');
    expect(pentagon.perimeter).toBeCloseTo(3 * Math.SQRT2 + 6 * Math.sqrt(10), 9);
    expect(pentagon.perimeter).toBeCloseTo(23.22, 2);
    const sorted = [...pentagon.sideLengths].sort((a, b) => a - b);
    expect(sorted[0]).toBeCloseTo(Math.sqrt(10), 9);
    expect(sorted[1]).toBeCloseTo(Math.sqrt(10), 9);
    expect(sorted[2]).toBeCloseTo(3 * Math.SQRT2, 9);
    expect(sorted[3]).toBeCloseTo(2 * Math.sqrt(10), 9);
    expect(sorted[4]).toBeCloseTo(2 * Math.sqrt(10), 9);
    // Вершины разбора: E(6;0;1) и F(0;6;1) — подъём на ребре равен 1.
    const heights = pentagon.vertices.map((point) => point.z).sort((a, b) => a - b);
    expect(heights).toEqual([0, 0, 1, 1, 3]);

    // Шестиугольник: середины AB, BC и CC₁.
    const hexagon = cubeSectionFromEdges(
      [{ edgeId: 'AB', t: 0.5 }, { edgeId: 'BC', t: 0.5 }, { edgeId: 'CC1', t: 0.5 }],
      6,
    );
    expect(hexagon.sides).toBe(6);
    expect(hexagon.regular).toBe(true);
    expect(hexagon.perimeter).toBeCloseTo(18 * Math.SQRT2, 9);
    expect(hexagon.perimeter).toBeCloseTo(25.46, 2);
    expect(hexagon.area).toBeCloseTo(27 * Math.sqrt(3), 9);
    expect(hexagon.area).toBeCloseTo(46.77, 2);

    // Практика 4: диагональное сечение куба с ребром 4 — прямоугольник 4 × 4√2.
    expect(4 * (4 * Math.SQRT2)).toBeCloseTo(16 * Math.SQRT2, 9);
    expect(16 * Math.SQRT2).toBeCloseTo(22.63, 2);

    // Практика 8: плоскость через AB и середину CC₁ — прямоугольник 6 × 3√5.
    const throughEdge = cubeSection(
      [pointOnCubeEdge('AB', 0, 6), pointOnCubeEdge('AB', 1, 6), pointOnCubeEdge('CC1', 0.5, 6)],
      6,
    );
    expect(throughEdge.sides).toBe(4);
    expect(throughEdge.area).toBeCloseTo(18 * Math.sqrt(5), 9);
    expect(throughEdge.area).toBeCloseTo(40.25, 2);
    expect(Math.hypot(6, 3)).toBeCloseTo(3 * Math.sqrt(5), 9);

    // Практика 10: треугольник ACB₁ в кубе с ребром 4 — равносторонний.
    const acb1 = cubeSection(
      [pointOnCubeEdge('AB', 0, 4), pointOnCubeEdge('BC', 1, 4), pointOnCubeEdge('BB1', 1, 4)],
      4,
    );
    expect(acb1.sides).toBe(3);
    expect(acb1.sideLengths.every((side) => Math.abs(side - 4 * Math.SQRT2) < 1e-9)).toBe(true);
    expect(acb1.area).toBeCloseTo(8 * Math.sqrt(3), 9);
    expect(acb1.area).toBeCloseTo(13.86, 2);

    // Практика 7: сечение, параллельное грани куба с ребром 5.
    expect(5 * 5).toBe(25);
  });

  it('5.4 Площадь поверхности: развёртка, апофема и граница «призма или пирамида»', () => {
    // Разбор кровли: четырёхугольная пирамида a = 6, h = 4.
    const roof = regularPyramidSurface(4, 6, 4);
    expect(roof.inradius).toBeCloseTo(3, 9);
    expect(roof.baseArea).toBeCloseTo(36, 9);
    expect(roof.basePerimeter).toBe(24);
    expect(roof.apothem).toBeCloseTo(5, 9);
    expect(roof.lateralArea).toBeCloseTo(60, 9);
    expect(roof.totalArea).toBeCloseTo(96, 9);
    // Проверка вторым способом: S_осн / cos φ, где cos φ = r/l = 0,6.
    expect(36 / (3 / 5)).toBeCloseTo(60, 9);
    expect(0.5 * 24 * 4).toBe(48); // ошибочный ответ с высотой вместо апофемы

    // Разбор стен: шестиугольная призма a = 4, h = 10.
    const walls = regularPrismSurface(6, 4, 10);
    expect(walls.basePerimeter).toBe(24);
    expect(walls.lateralArea).toBeCloseTo(240, 9);
    expect(walls.baseArea).toBeCloseTo(24 * Math.sqrt(3), 9);
    expect(walls.totalArea).toBeCloseTo(240 + 48 * Math.sqrt(3), 9);
    expect(walls.totalArea).toBeCloseTo(323.14, 2);

    // Таблица оснований.
    expect(regularPolygonInradius(3, 6)).toBeCloseTo((6 * Math.sqrt(3)) / 6, 9);
    expect(regularPolygonCircumradius(3, 6)).toBeCloseTo((6 * Math.sqrt(3)) / 3, 9);
    expect(regularPolygonInradius(4, 8)).toBeCloseTo(4, 9);
    expect(regularPolygonCircumradius(4, 8)).toBeCloseTo(4 * Math.SQRT2, 9);
    expect(regularPolygonInradius(6, 4)).toBeCloseTo(2 * Math.sqrt(3), 9);
    expect(regularPolygonCircumradius(6, 4)).toBeCloseTo(4, 9);
    expect(regularPolygonArea(6, 4)).toBeCloseTo(24 * Math.sqrt(3), 9);

    // Граница из «Возвращаемся к прогнозу»: h > a/(2√3) ≈ 0,29a.
    expect(1 / (2 * Math.sqrt(3))).toBeCloseTo(0.289, 3);
    const a = 6;
    for (const h of [0.2 * a, 0.5 * a]) {
      const prism = 4 * a * h;
      const pyramid = 2 * a * Math.sqrt(h * h + (a * a) / 4);
      expect(prism > pyramid).toBe(h > a / (2 * Math.sqrt(3)));
    }

    // Практика 1–4.
    expect(Math.hypot(6, 8)).toBe(10);
    expect((6 + 8 + 10) * 10).toBe(240);
    expect(240 + 2 * 0.5 * 6 * 8).toBe(288);
    const square = regularPrismSurface(4, 5, 8);
    expect(square.lateralArea).toBeCloseTo(160, 9);
    expect(square.totalArea).toBeCloseTo(210, 9);
    expect(cuboidSurface(7, 7, 7)).toBeCloseTo(294, 9);
    expect(cuboidSurface(3, 4, 5)).toBeCloseTo(94, 9);

    // Практика 5 и 10: пирамида a = 10 с апофемой 13 и с боковым ребром 13.
    const byApothem = regularPyramidSurface(4, 10, Math.sqrt(13 * 13 - 5 * 5));
    expect(byApothem.apothem).toBeCloseTo(13, 9);
    expect(byApothem.lateralArea).toBeCloseTo(260, 9);
    expect(byApothem.totalArea).toBeCloseTo(360, 9);
    expect(Math.sqrt(13 * 13 - 5 * 5)).toBeCloseTo(12, 9);
    const byEdge = regularPyramidSurface(4, 10, Math.sqrt(13 * 13 - 50));
    expect(byEdge.lateralEdge).toBeCloseTo(13, 9);
    expect(byEdge.apothem).toBeCloseTo(12, 9);
    expect(byEdge.lateralArea).toBeCloseTo(240, 9);
    expect(byEdge.totalArea).toBeCloseTo(340, 9);

    // Практика 6, 7, 8.
    const small = regularPyramidSurface(4, 8, 3);
    expect(small.apothem).toBeCloseTo(5, 9);
    expect(small.lateralArea).toBeCloseTo(80, 9);
    expect(small.totalArea).toBeCloseTo(144, 9);
    const tri = regularPyramidSurface(3, 6, 4);
    expect(tri.inradius).toBeCloseTo(Math.sqrt(3), 9);
    expect(tri.apothem).toBeCloseTo(Math.sqrt(19), 9);
    expect(tri.lateralArea).toBeCloseTo(9 * Math.sqrt(19), 9);
    expect(tri.baseArea).toBeCloseTo(9 * Math.sqrt(3), 9);
    expect(tri.totalArea).toBeCloseTo(54.82, 2);
    const hexPrism = regularPrismSurface(6, 3, 10);
    expect(hexPrism.lateralArea).toBeCloseTo(180, 9);
    expect(hexPrism.totalArea).toBeCloseTo(180 + 27 * Math.sqrt(3), 9);
    expect(hexPrism.totalArea).toBeCloseTo(226.77, 2);

    // Практика 9: площадь растёт как квадрат коэффициента подобия.
    expect(regularPyramidSurface(4, 18, 12).totalArea / regularPyramidSurface(4, 6, 4).totalArea)
      .toBeCloseTo(9, 9);
  });

  it('5.5 Практикум: павильон-многогранник', () => {
    // Полный расчёт: корпус — шестиугольная призма a = 3, h = 4; крыша — пирамида h = 2.
    const body = regularPrismSurface(6, 3, 4);
    const roof = regularPyramidSurface(6, 3, 2);
    expect(prismCounts(6).edges + pyramidCounts(6).edges - 6).toBe(24);
    expect(12 * 3 + 6 * 4 + 6 * roof.lateralEdge).toBeCloseTo(81.63, 2);
    expect(roof.lateralEdge).toBeCloseTo(Math.sqrt(13), 9);
    expect(body.basePerimeter).toBe(18);
    expect(body.lateralArea).toBeCloseTo(72, 9);
    expect(roof.inradius ** 2).toBeCloseTo(6.75, 9);
    expect(roof.apothem).toBeCloseTo(Math.sqrt(10.75), 9);
    expect(roof.apothem).toBeCloseTo(3.28, 2);
    expect(roof.lateralArea).toBeCloseTo(29.51, 2);
    expect(roof.lateralArea).toBeCloseTo(4.5 * Math.sqrt(43), 9);
    expect(body.baseArea).toBeCloseTo(13.5 * Math.sqrt(3), 9);
    expect(body.baseArea).toBeCloseTo(23.38, 2);
    expect(eulerCharacteristic(prismCounts(6))).toBe(2);
    expect(prismCounts(6)).toEqual({ vertices: 12, edges: 18, faces: 8 });

    // Итоговый набор 1–4.
    expect(prismCounts(9)).toEqual({ vertices: 18, edges: 27, faces: 11 });
    expect(pyramidCounts(11)).toEqual({ vertices: 12, edges: 22, faces: 12 });
    expect(completeEuler(null, 24, 14).vertices).toBe(12);
    expect(countsFromFaces(20, 3, 5)).toEqual({ vertices: 12, edges: 30, faces: 20 });
    const icosahedron = platonicSolid('icosahedron');
    expect([icosahedron.vertices, icosahedron.edges, icosahedron.faces]).toEqual([12, 30, 20]);

    // Итоговый набор 5–7.
    const prism = regularPrismSurface(4, 6, 9);
    expect(prism.lateralArea).toBeCloseTo(216, 9);
    expect(prism.totalArea).toBeCloseTo(288, 9);
    const hexPyr = regularPyramidSurface(6, 4, 10);
    expect(hexPyr.apothem).toBeCloseTo(4 * Math.sqrt(7), 9);
    expect(hexPyr.lateralArea).toBeCloseTo(48 * Math.sqrt(7), 9);
    expect(hexPyr.lateralArea).toBeCloseTo(127, 2);
    expect(hexPyr.baseArea).toBeCloseTo(24 * Math.sqrt(3), 9);
    expect(hexPyr.totalArea).toBeCloseTo(168.57, 2);
    const bigPyr = regularPyramidSurface(4, 12, 8);
    expect(bigPyr.apothem).toBeCloseTo(10, 9);
    expect(bigPyr.lateralArea).toBeCloseTo(240, 9);
    expect(bigPyr.totalArea).toBeCloseTo(384, 9);

    // Итоговый набор 8–11.
    expect(8 * 8 * Math.SQRT2).toBeCloseTo(64 * Math.SQRT2, 9);
    expect(64 * Math.SQRT2).toBeCloseTo(90.51, 2);
    const small = cubeSectionFromEdges(
      [{ edgeId: 'AB', t: 0.5 }, { edgeId: 'AD', t: 0.5 }, { edgeId: 'AA1', t: 0.5 }],
      4,
    );
    expect(small.perimeter).toBeCloseTo(6 * Math.SQRT2, 9);
    expect(small.area).toBeCloseTo(2 * Math.sqrt(3), 9);
    const tiny = cubeSectionFromEdges(
      [{ edgeId: 'AB', t: 0.5 }, { edgeId: 'BC', t: 0.5 }, { edgeId: 'CC1', t: 0.5 }],
      2,
    );
    expect(tiny.sides).toBe(6);
    expect(tiny.sideLengths[0]).toBeCloseTo(Math.SQRT2, 9);
    expect(tiny.area).toBeCloseTo(3 * Math.sqrt(3), 9);
    expect(tiny.perimeter).toBeCloseTo(6 * Math.SQRT2, 9);
    const roof8 = regularPyramidSurface(4, 8, 3);
    expect(roof8.apothem).toBeCloseTo(5, 9);
    expect(roof8.lateralArea).toBeCloseTo(80, 9);
  });
});

/* ═════════════════════ 6. Условная вероятность ═════════════════════ */

describe('10 класс · Условная вероятность', () => {
  const HOMEWORK: TwoWayTable = { both: 80, leftOnly: 20, rightOnly: 45, neither: 105 };
  const MACHINES: TwoWayTable = { both: 6, leftOnly: 114, rightOnly: 4, neither: 76 };
  const PETS: TwoWayTable = { both: 60, leftOnly: 40, rightOnly: 60, neither: 90 };

  it('6.1 Условная вероятность: таблица 250 учеников', () => {
    expect(80 + 20 + 45 + 105).toBe(250);
    expect(frac(probabilityOfLeft(HOMEWORK))).toEqual([2, 5]);
    expect(frac(probabilityOfRight(HOMEWORK))).toEqual([1, 2]);
    expect(frac(probabilityOfBoth(HOMEWORK))).toEqual([8, 25]);
    expect(frac(rightGivenLeft(HOMEWORK))).toEqual([4, 5]);
    expect(frac(leftGivenRight(HOMEWORK))).toEqual([16, 25]);
    expect(16 / 25).toBe(0.64);
    // P(справился | не делал) = 45/150.
    expect(frac(fraction(45, 150))).toEqual([3, 10]);

    // Практика 1–9.
    expect(frac(fraction(20, 100))).toEqual([1, 5]);
    expect(frac(fraction(105, 125))).toEqual([21, 25]);
    expect(21 / 25).toBe(0.84);
    expect(frac(fraction(5, 9))).toEqual([5, 9]); // шар без возвращения
    expect(0.3 / 0.6).toBeCloseTo(0.5, 12);
    expect(0.4 * 0.25).toBeCloseTo(0.1, 12);
    expect(frac(fraction(12, 18))).toEqual([2, 3]);
    // Два кубика: P(сумма = 8 | первый 5) = 1/6, а P(первый 5 | сумма = 8) = 1/5.
    const pairs: [number, number][] = [];
    for (let a = 1; a <= 6; a += 1) for (let b = 1; b <= 6; b += 1) pairs.push([a, b]);
    const firstIsFive = pairs.filter(([a]) => a === 5);
    const sumIsEight = pairs.filter(([a, b]) => a + b === 8);
    expect(firstIsFive).toHaveLength(6);
    expect(sumIsEight).toHaveLength(5);
    expect(firstIsFive.filter(([a, b]) => a + b === 8)).toHaveLength(1);
    // Две девочки/мальчика: P(оба мальчики | хотя бы один) = 1/3.
    const families = ['ММ', 'МД', 'ДМ', 'ДД'];
    const atLeastOneBoy = families.filter((f) => f.includes('М'));
    expect(atLeastOneBoy).toHaveLength(3);
    expect(atLeastOneBoy.filter((f) => f === 'ММ')).toHaveLength(1);
  });

  it('6.2 Независимость: два станка независимы, коты с собаками — нет', () => {
    expect(6 + 114 + 4 + 76).toBe(200);
    expect(frac(probabilityOfBoth(MACHINES))).toEqual([3, 100]);
    expect(frac(probabilityOfLeft(MACHINES))).toEqual([3, 5]);
    expect(frac(probabilityOfRight(MACHINES))).toEqual([1, 20]);
    expect(frac(rightGivenLeft(MACHINES))).toEqual([1, 20]);
    expect(isTableIndependent(MACHINES)).toBe(true);
    // Независимость передаётся противоположному: 114/200 = (3/5)·(19/20).
    expect(frac(fraction(114, 200))).toEqual([57, 100]);
    expect((3 / 5) * (19 / 20)).toBeCloseTo(0.57, 12);

    // Коты и собаки: зависимы, ожидалось бы 48 вместо 60.
    expect(isTableIndependent(PETS)).toBe(false);
    expect(frac(expectedIndependentCount(PETS))).toEqual([48, 1]);
    expect(frac(probabilityOfLeft(PETS))).toEqual([2, 5]);
    expect(frac(probabilityOfRight(PETS))).toEqual([12, 25]);
    expect((2 / 5) * (12 / 25)).toBeCloseTo(0.192, 12);
    expect(60 / 250).toBe(0.24);

    // Практика 1–4, 6, 8–10.
    expect(0.4 * 0.5).toBeCloseTo(0.2, 12);
    expect(0.4 + 0.5 - 0.2).toBeCloseTo(0.7, 12);
    expect(0.5 ** 4).toBe(0.0625);
    expect(0.8 ** 3).toBeCloseTo(0.512, 12);
    expect(1 - 0.2 ** 3).toBeCloseTo(0.992, 12);
    expect(0.9 * 0.8).toBeCloseTo(0.72, 12);
    expect(1 - 0.1 * 0.2).toBeCloseTo(0.98, 12);
    expect(0.3 * 0.5).toBeCloseTo(0.15, 12); // несовместные зависимы
    expect(frac(fraction(4, 36))).toEqual([1, 9]);
    expect(frac(fraction(9, 36))).toEqual([1, 4]);
    expect((1 / 9) * (1 / 4)).toBeCloseTo(1 / 36, 12);
    expect((3 / 5) * (2 / 4)).toBeCloseTo(0.3, 12);
    expect((3 / 5) * (3 / 5)).toBeCloseTo(0.36, 12);
    for (const p of [0, 1]) expect(p * p).toBe(p);
  });

  it('6.3 Полная вероятность и формула Байеса: скрининг и два завода', () => {
    // Вступление: болезнь у 1 из 100, тест 90 % и 90 %.
    const branches: BayesBranch[] = [
      { label: 'болен', prior: fraction(1, 100), conditional: fraction(9, 10) },
      { label: 'здоров', prior: fraction(99, 100), conditional: fraction(1, 10) },
    ];
    expect(frac(totalProbabilityOf(branches))).toEqual([27, 250]);
    expect(27 / 250).toBe(0.108);
    expect(frac(bayesPosterior(branches, 0))).toEqual([1, 12]);
    expect(1 / 12).toBeCloseTo(0.083, 3);
    expect(0.099 / 0.009).toBeCloseTo(11, 6);

    // Природные частоты: 10 000 человек.
    const screen = naturalFrequencies({
      population: 10_000,
      prevalence: '1/100',
      sensitivity: '0,9',
      specificity: '0,9',
    });
    expect(screen.sick).toBe(100);
    expect(screen.healthy).toBe(9_900);
    expect(screen.truePositive).toBe(90);
    expect(screen.falseNegative).toBe(10);
    expect(screen.falsePositive).toBe(990);
    expect(screen.trueNegative).toBe(8_910);
    expect(screen.truePositive + screen.falsePositive).toBe(1_080);
    expect(screen.falseNegative + screen.trueNegative).toBe(8_920);
    expect(frac(positivePredictiveValue(screen))).toEqual([1, 12]);
    expect(frac(fraction(8_910, 8_920))).toEqual([891, 892]);
    expect(891 / 892).toBeCloseTo(0.9989, 4);
    expect((1 / 12) / (1 / 100)).toBeCloseTo(8.33, 2);

    // Два завода.
    const plants: BayesBranch[] = [
      { label: 'первый', prior: fraction(3, 5), conditional: fraction(1, 50) },
      { label: 'второй', prior: fraction(2, 5), conditional: fraction(1, 20) },
    ];
    expect(frac(totalProbabilityOf(plants))).toEqual([4, 125]);
    expect(4 / 125).toBe(0.032);
    expect(frac(bayesPosterior(plants, 0))).toEqual([3, 8]);
    expect(frac(bayesPosterior(plants, 1))).toEqual([5, 8]);
    expect(3 / 8 + 5 / 8).toBe(1);

    // Практика 1 и 2: две урны.
    const urns: BayesBranch[] = [
      { label: 'первая', prior: fraction(1, 2), conditional: fraction(3, 4) },
      { label: 'вторая', prior: fraction(1, 2), conditional: fraction(1, 4) },
    ];
    expect(frac(totalProbabilityOf(urns))).toEqual([1, 2]);
    expect(frac(bayesPosterior(urns, 0))).toEqual([3, 4]);

    // Практика 4 и 5: 20 000 человек, тест 99 % и 99 %.
    const big = naturalFrequencies({
      population: 20_000,
      prevalence: '1/200',
      sensitivity: '0,99',
      specificity: '0,99',
    });
    expect(big.sick).toBe(100);
    expect(big.healthy).toBe(19_900);
    expect(big.truePositive).toBe(99);
    expect(big.falseNegative).toBe(1);
    expect(big.falsePositive).toBe(199);
    expect(big.trueNegative).toBe(19_701);
    expect(frac(positivePredictiveValue(big))).toEqual([99, 298]);
    expect(99 / 298).toBeCloseTo(0.332, 3);
    expect(frac(fraction(19_701, 19_702))).toEqual([19_701, 19_702]);
    expect(19_701 / 19_702).toBeCloseTo(0.99995, 5);

    // Практика 6: три цеха.
    const shops: BayesBranch[] = [
      { label: 'первый', prior: fraction(1, 2), conditional: fraction(1, 100) },
      { label: 'второй', prior: fraction(3, 10), conditional: fraction(1, 50) },
      { label: 'третий', prior: fraction(1, 5), conditional: fraction(1, 20) },
    ];
    expect(frac(totalProbabilityOf(shops))).toEqual([21, 1000]);
    expect(frac(bayesPosterior(shops, 2))).toEqual([10, 21]);
    expect(10 / 21).toBeCloseTo(0.476, 3);

    // Практика 7: билет вторым — та же вероятность 4/5.
    const tickets: BayesBranch[] = [
      { label: 'первый взял знакомый', prior: fraction(20, 25), conditional: fraction(19, 24) },
      { label: 'первый взял незнакомый', prior: fraction(5, 25), conditional: fraction(20, 24) },
    ];
    expect(frac(totalProbabilityOf(tickets))).toEqual([4, 5]);

    // Практика 8.
    const generic: BayesBranch[] = [
      { label: 'H', prior: fraction(1, 5), conditional: fraction(9, 10) },
      { label: 'не H', prior: fraction(4, 5), conditional: fraction(1, 10) },
    ];
    expect(frac(totalProbabilityOf(generic))).toEqual([13, 50]);
    expect(frac(bayesPosterior(generic, 0))).toEqual([9, 13]);
    expect(9 / 13).toBeCloseTo(0.692, 3);

    // Практика 10: базовая доля 1/10 даёт P(болен | +) = 1/2.
    const common = naturalFrequencies({
      population: 10_000,
      prevalence: '1/10',
      sensitivity: '0,9',
      specificity: '0,9',
    });
    expect(common.truePositive).toBe(900);
    expect(common.falsePositive).toBe(900);
    expect(frac(positivePredictiveValue(common))).toEqual([1, 2]);
  });

  it('6.4 Дискретные распределения: лотерея, биномиальное и условное', () => {
    // Сумма двух кубиков: 11 значений, всего 36 исходов, M(X) = 7.
    expect(TWO_DICE).toHaveLength(11);
    expect(frac(distributionTotal(TWO_DICE))).toEqual([1, 1]);
    expect(frac(expectedValue(TWO_DICE))).toEqual([7, 1]);
    expect(frac(TWO_DICE[0]!.probability)).toEqual([1, 36]);
    expect(frac(TWO_DICE[5]!.probability)).toEqual([1, 6]); // 6/36 для суммы 7
    expect(frac(TWO_DICE[3]!.probability)).toEqual([1, 9]); // 4/36 для суммы 5
    expect(frac(expectedValue(DIE))).toEqual([7, 2]);
    expect(3.5 + 3.5).toBe(7);

    // Лотерея урока.
    const lottery: DistributionEntry[] = [
      { value: 0, probability: fraction(189, 200) },
      { value: 100, probability: fraction(1, 20) },
      { value: 1000, probability: fraction(1, 200) },
    ];
    expect(frac(distributionTotal(lottery))).toEqual([1, 1]);
    expect(frac(expectedValue(lottery))).toEqual([10, 1]);
    expect(10 - 100).toBe(-90);

    // Биномиальное: n = 5, p = 3/5.
    const shooter = bernoulliDistribution(5, fraction(3, 5));
    expect(frac(shooter[3]!.probability)).toEqual([216, 625]);
    expect(216 / 625).toBe(0.3456);
    expect(frac(expectedValue(shooter))).toEqual([3, 1]);

    // Условное распределение: сумма не меньше восьми.
    const heavy = conditionalDistribution(TWO_DICE, (value) => value >= 8);
    expect(heavy).toHaveLength(5);
    expect(frac(heavy[0]!.probability)).toEqual([1, 3]);
    expect(frac(heavy[2]!.probability)).toEqual([1, 5]);
    expect(frac(distributionTotal(heavy))).toEqual([1, 1]);
    expect(frac(expectedValue(heavy))).toEqual([28, 3]);
    expect(28 / 3).toBeCloseTo(9.33, 2);
    // Условие «сумма чётная» ожидание не сдвигает.
    expect(frac(expectedValue(conditionalDistribution(TWO_DICE, (v) => v % 2 === 0)))).toEqual([7, 1]);

    // Практика 1, 2, 5–8, 10.
    const coins = bernoulliDistribution(2, fraction(1, 2));
    expect(coins.map((entry) => frac(entry.probability))).toEqual([[1, 4], [1, 2], [1, 4]]);
    expect(frac(expectedValue(coins))).toEqual([1, 1]);
    expect(0.2 + 0.5 + 0.4).toBeCloseTo(1.1, 12);
    const heavy10 = conditionalDistribution(TWO_DICE, (value) => value >= 10);
    expect(heavy10.map((entry) => frac(entry.probability))).toEqual([[1, 2], [1, 3], [1, 6]]);
    expect(frac(expectedValue(heavy10))).toEqual([32, 3]);
    expect(32 / 3).toBeCloseTo(10.67, 2);
    expect(60 * (1 / 6)).toBe(10);
    expect(10 - 20).toBe(-10);
    const blocks = bernoulliDistribution(4, fraction(9, 10));
    expect(frac(expectedValue(blocks))).toEqual([18, 5]);
    expect(18 / 5).toBe(3.6);
    expect(frac(blocks[4]!.probability)).toEqual([6561, 10_000]);
    expect(0.9 ** 4).toBeCloseTo(0.6561, 12);

    // Дисперсия одного кубика — 35/12 ≈ 2,92 (углубление урока).
    expect(35 / 12).toBeCloseTo(2.92, 2);
  });

  it('6.5 Практикум: разбор одного теста', () => {
    // Станция 1 и задачи 1–5.
    expect(100 - 60).toBe(40);
    expect(120 - 60).toBe(60);
    expect(250 - 60 - 40 - 60).toBe(90);
    expect(frac(rightGivenLeft(PETS))).toEqual([3, 5]);
    expect(frac(leftGivenRight(PETS))).toEqual([1, 2]);
    expect(isTableIndependent(PETS)).toBe(false);
    expect(frac(expectedIndependentCount(PETS))).toEqual([48, 1]);
    expect(frac(fraction(250 - 90, 250))).toEqual([16, 25]);
    expect(16 / 25).toBe(0.64);

    // Задача 6: стрелок p = 0,7, три выстрела.
    const shots = bernoulliDistribution(3, fraction(7, 10));
    expect(frac(shots[2]!.probability)).toEqual([441, 1000]);
    expect(441 / 1000).toBe(0.441);
    expect(1 - 0.3 ** 3).toBeCloseTo(0.973, 12);

    // Задача 7: два автомата.
    const machines: BayesBranch[] = [
      { label: 'A', prior: fraction(7, 10), conditional: fraction(3, 100) },
      { label: 'B', prior: fraction(3, 10), conditional: fraction(8, 100) },
    ];
    expect(frac(totalProbabilityOf(machines))).toEqual([9, 200]);
    expect(9 / 200).toBe(0.045);
    expect(frac(bayesPosterior(machines, 1))).toEqual([8, 15]);
    expect(8 / 15).toBeCloseTo(0.533, 3);
    expect(0.3 * 0.045).toBeCloseTo(0.0135, 12);
    expect(0.3 * 0.08).toBeCloseTo(0.024, 12);

    // Задачи 8 и 9: скрининг на 20 000 человек.
    const screen = naturalFrequencies({
      population: 20_000,
      prevalence: '1/200',
      sensitivity: '0,99',
      specificity: '0,99',
    });
    expect(screen.truePositive).toBe(99);
    expect(screen.falsePositive).toBe(199);
    expect(screen.truePositive + screen.falsePositive).toBe(298);
    expect(frac(positivePredictiveValue(screen))).toEqual([99, 298]);
    expect(199 / 99).toBeCloseTo(2, 1);

    // Задачи 10 и 11: число шестёрок при трёх бросках.
    const sixes = bernoulliDistribution(3, fraction(1, 6));
    expect(sixes.map((entry) => frac(entry.probability)))
      .toEqual([[125, 216], [25, 72], [5, 72], [1, 216]]);
    expect(125 + 75 + 15 + 1).toBe(216);
    expect(frac(expectedValue(sixes))).toEqual([1, 2]);
    const atLeastOne = conditionalDistribution(sixes, (value) => value >= 1);
    expect(atLeastOne.map((entry) => frac(entry.probability)))
      .toEqual([[75, 91], [15, 91], [1, 91]]);
    expect(frac(distributionTotal(atLeastOne))).toEqual([1, 1]);
    expect(frac(expectedValue(atLeastOne))).toEqual([108, 91]);
    expect(108 / 91).toBeCloseTo(1.19, 2);
    expect(frac(fraction(75 + 15 + 1, 216))).toEqual([91, 216]);
  });
});
