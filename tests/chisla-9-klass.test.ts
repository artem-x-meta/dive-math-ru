import { describe, expect, it } from 'vitest';
import {
  discriminant,
  evaluateQuadratic,
  monicFromRoots,
  solveQuadratic,
  vertex,
} from '../src/lib/quadratics';
import {
  axisOfSymmetry,
  formatSolutionSet,
  solveQuadraticInequality,
  toVertexForm,
  valueTable,
} from '../src/lib/parabola';
import {
  formatRootList,
  solveCurveSystem,
  solvePolynomialEquation,
  solveRationalEquation,
  type CurveSpec,
  type RealRoot,
} from '../src/lib/systems';
import { toExactNumber } from '../src/lib/exactRational';
import {
  arithmeticFromTwoTerms,
  arithmeticIndexOf,
  arithmeticProgression,
  arithmeticSum,
  arithmeticTerm,
  arithmeticTerms,
  chainedPercentFactor,
  compoundAmount,
  geometricProgression,
  geometricSum,
  geometricTerm,
  geometricTerms,
  growthFactor,
  periodsToReach,
  simpleAmount,
} from '../src/lib/sequences';
import {
  arrangements,
  bernoulliDistribution,
  bernoulliProbability,
  combinations,
  distributionTotal,
  expectedValue,
  factorial,
  finiteExperimentDistribution,
  pascalRow,
  pascalRowSum,
  permutations,
  probabilityAtLeast,
  probabilityOfValue,
  productRule,
  sumRule,
} from '../src/lib/combinatorics';
import { fraction, fractionToNumber, type Fraction } from '../src/lib/probability';

/* ------------------------------------------------------------------ */
/* Мелкие помощники: числа из уроков сравниваем с пересчитанными        */
/* ------------------------------------------------------------------ */

/** Корни квадратного уравнения по возрастанию — как числа. */
const quadRoots = (a: number, b: number, c: number): number[] =>
  solveQuadratic(a, b, c).roots.map((root) => root.approx);

/** Список действительных корней целого уравнения по возрастанию. */
const polyRoots = (coefficients: number[]): number[] =>
  solvePolynomialEquation(coefficients).roots.map((root) => root.approx);

const rootNumbers = (roots: readonly RealRoot[]): number[] => roots.map((root) => root.approx);

/** Пары решений системы двух линий в виде [[x, y], …]. */
const systemPairs = (first: CurveSpec, second: CurveSpec): number[][] =>
  solveCurveSystem(first, second).points.map((point) => [point.x.approx, point.y.approx]);

const num = (value: ReturnType<typeof arithmeticTerm>): number => toExactNumber(value);
const numbers = (values: ReturnType<typeof arithmeticTerms>): number[] => values.map(toExactNumber);

/** Дробь как несократимая пара [числитель, знаменатель]. */
const frac = (value: Fraction): number[] => [value.numerator, value.denominator];

const round = (value: number, digits: number): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/* ================================================================== */
describe('глава 1 «Уравнения и системы»', () => {
  it('урок 1.1: рациональные уравнения и посторонние корни', () => {
    // Разбор: x³ − 2x² − x + 2 = 0 → −1, 1, 2.
    expect(polyRoots([2, -1, -2, 1])).toEqual([-1, 1, 2]);
    // Разбор: биквадратное x⁴ − 13x² + 36 = 0 через t = x².
    expect(quadRoots(1, -13, 36)).toEqual([4, 9]);
    expect(polyRoots([36, 0, -13, 0, 1])).toEqual([-3, -2, 2, 3]);
    // x⁴ + 3x² − 4 = 0: t = 1 и t = −4, значит корней всего два.
    expect(quadRoots(1, 3, -4)).toEqual([-4, 1]);
    expect(polyRoots([-4, 0, 3, 0, 1])).toEqual([-1, 1]);

    // Бассейн: 1/x + 1/(x+3) = 1/2 сводится к x² − x − 6 = 0.
    const pool = solveRationalEquation({
      left: [
        { numerator: [1], denominator: [0, 1] },
        { numerator: [1], denominator: [3, 1] },
      ],
      right: [{ numerator: [1], denominator: [2] }],
    });
    expect(rootNumbers(pool.restrictions)).toEqual([-3, 0]);
    expect(rootNumbers(pool.roots)).toEqual([-2, 3]);
    expect(pool.extraneous).toHaveLength(0);
    // Первая труба 3 часа, вторая 6: 1/3 + 1/6 = 1/2.
    expect(1 / 3 + 1 / 6).toBeCloseTo(0.5, 12);

    // 1/(x−2) + 1/(x+2) = 4/(x²−4): единственный кандидат x = 2 запрещён.
    const empty = solveRationalEquation({
      left: [
        { numerator: [1], denominator: [-2, 1] },
        { numerator: [1], denominator: [2, 1] },
      ],
      right: [{ numerator: [4], denominator: [-4, 0, 1] }],
    });
    expect(rootNumbers(empty.candidates)).toEqual([2]);
    expect(empty.roots).toHaveLength(0);
    expect(rootNumbers(empty.extraneous)).toEqual([2]);

    // QuickCheck и задача 10: (x²−9)/(x−3) = 6 → корней нет.
    const hole = solveRationalEquation({
      left: [{ numerator: [-9, 0, 1], denominator: [-3, 1] }],
      right: [{ numerator: [6], denominator: [1] }],
    });
    expect(rootNumbers(hole.candidates)).toEqual([3]);
    expect(hole.roots).toHaveLength(0);
    // Разбор варианта «x = −3»: (9 − 9)/(−6) = 0, а справа 6.
    expect(Math.abs((9 - 9) / -6)).toBe(0);

    // Практика 1–5.
    expect(polyRoots([0, -4, 0, 1])).toEqual([-2, 0, 2]);
    expect(polyRoots([-9, -9, 1, 1])).toEqual([-3, -1, 3]);
    expect(polyRoots([3, -1, -3, 1])).toEqual([-1, 1, 3]);
    expect(quadRoots(1, -5, 4)).toEqual([1, 4]);
    expect(polyRoots([4, 0, -5, 0, 1])).toEqual([-2, -1, 1, 2]);

    // Практика 6, 7, 9, 11.
    const cancel = solveRationalEquation({
      left: [{ numerator: [-16, 0, 1], denominator: [4, 1] }],
      right: [{ numerator: [0], denominator: [1] }],
    });
    expect(rootNumbers(cancel.candidates)).toEqual([-4, 4]);
    expect(rootNumbers(cancel.roots)).toEqual([4]);

    const sixes = solveRationalEquation({
      left: [
        { numerator: [6], denominator: [0, 1] },
        { numerator: [-6], denominator: [1, 1] },
      ],
      right: [{ numerator: [1], denominator: [1] }],
    });
    expect(rootNumbers(sixes.roots)).toEqual([-3, 2]);

    const ninth = solveRationalEquation({
      left: [
        { numerator: [0, 1], denominator: [1, 1] },
        { numerator: [2], denominator: [-1, 1] },
      ],
      right: [{ numerator: [2], denominator: [-1, 0, 1] }],
    });
    expect(rootNumbers(ninth.candidates)).toEqual([-1, 0]);
    expect(rootNumbers(ninth.roots)).toEqual([0]);

    const noRoots = solveRationalEquation({
      left: [{ numerator: [2, 1], denominator: [-1, 1] }],
      right: [{ numerator: [4, 1], denominator: [1, 1] }],
    });
    expect(noRoots.roots).toHaveLength(0);
    expect(noRoots.identity).toBe(false);

    // Практика 12: трубы за 6 часов, разница 5 часов → 10 и 15.
    expect(quadRoots(1, -7, -30)).toEqual([-3, 10]);
    expect(discriminant(1, -7, -30)).toBe(169);
    expect(1 / 10 + 1 / 15).toBeCloseTo(1 / 6, 12);
  });

  it('урок 1.2: пары, линии и целые точки окружности', () => {
    // Карта памяти: 2x + 4y = 32.
    for (const [x, y] of [[16, 0], [0, 8], [6, 5]]) {
      expect(2 * x! + 4 * y!).toBe(32);
    }

    // Целые точки окружности x² + y² = 25 — ровно двенадцать.
    const lattice: number[][] = [];
    for (let x = -5; x <= 5; x += 1) {
      for (let y = -5; y <= 5; y += 1) {
        if (x * x + y * y === 25) lattice.push([x, y]);
      }
    }
    expect(lattice).toHaveLength(12);
    for (const pair of [[5, 0], [4, 3], [3, 4], [0, 5], [-3, 4], [-4, 3],
      [-5, 0], [-4, -3], [-3, -4], [0, -5], [3, -4], [4, -3]]) {
      expect(lattice).toContainEqual(pair);
    }
    expect(round(Math.sqrt(24), 1)).toBe(4.9);

    // Ловушка урока: (3;−4) лежит на прямой y = x − 7, а (−4;3) — нет.
    expect(3 - 7).toBe(-4);
    expect(-4 - 7).not.toBe(3);

    // QuickCheck xy = −8.
    expect(-2 * 4).toBe(-8);
    expect(2 * 4).not.toBe(-8);
    expect(0 * -8).not.toBe(-8);

    // Практика 1–3, 5–7, 11, 12.
    expect(2 * 2 + 3).toBe(7);
    expect((-1) ** 2 + 4).toBe(5);
    expect(3 ** 2 + (-4) ** 2).toBe(25);
    expect((-4) ** 2 + 3 ** 2).toBe(25);
    expect(5 ** 2 + 1 ** 2).not.toBe(25);
    expect(12 / -2).toBe(-6);
    for (const [x, y] of [[0, 3], [6, 0], [2, 2]]) expect(-0.5 * x! + 3).toBe(y);
    for (const [x, y] of [[1, -8], [2, -4], [4, -2], [-1, 8]]) expect(x! * y!).toBe(-8);
    expect(quadRoots(1, 0, -4)).toEqual([-2, 2]); // a² − 2 = 2
    expect(quadRoots(1, 0, -16)).toEqual([-4, 4]); // 9 + b² = 25
  });

  it('урок 1.3: нелинейные системы подстановкой', () => {
    // Участок: x + y = 14, xy = 48 → стороны 6 и 8.
    expect(monicFromRoots(6, 8)).toEqual({ p: -14, q: 48 });
    expect(quadRoots(1, -14, 48)).toEqual([6, 8]);
    expect(discriminant(1, -14, 48)).toBe(4);

    const parabola: CurveSpec = { kind: 'parabola', a: 1, b: 0, c: 0 };
    expect(systemPairs(parabola, { kind: 'line', k: 1, b: 2 })).toEqual([[-1, 1], [2, 4]]);
    expect(systemPairs({ kind: 'circle', r: 5 }, { kind: 'line', k: 1, b: 1 }))
      .toEqual([[-4, -3], [3, 4]]);

    // Три прямые и одна парабола: две точки, касание, пусто.
    expect(discriminant(1, -1, -2)).toBe(9);
    expect(systemPairs(parabola, { kind: 'line', k: 2, b: -1 })).toEqual([[1, 1]]);
    expect(discriminant(1, -2, 1)).toBe(0);
    expect(systemPairs(parabola, { kind: 'line', k: -1, b: -1 })).toEqual([]);
    expect(discriminant(1, 1, 1)).toBe(-3);

    // Гипербола y = 6/x и прямая y = x + 1.
    expect(systemPairs({ kind: 'hyperbola', k: 6 }, { kind: 'line', k: 1, b: 1 }))
      .toEqual([[-3, -2], [2, 3]]);

    // QuickCheck: x² − 6x + 9 = 0 — одно решение.
    expect(discriminant(1, -6, 9)).toBe(0);
    expect(quadRoots(1, -6, 9)).toEqual([3]);

    // Практика 2, 5, 6, 8, 10, 11, 12.
    expect(systemPairs(parabola, { kind: 'line', k: 0, b: 4 })).toEqual([[-2, 4], [2, 4]]);
    expect(quadRoots(1, -5, 6)).toEqual([2, 3]); // x + y = 5, xy = 6
    expect(quadRoots(1, 1, -6)).toEqual([-3, 2]); // x − y = 1, xy = 6 → y² + y − 6 = 0
    expect(systemPairs({ kind: 'circle', r: Math.sqrt(10) }, { kind: 'line', k: 3, b: 0 })
      .map((pair) => pair.map((value) => round(value, 12)))).toEqual([[-1, -3], [1, 3]]);
    expect(quadRoots(1, -6, 8)).toEqual([2, 4]); // x + y = 6, x² + y² = 20
    // Касание y = x + b и y = x²: уравнение x² − x − b = 0 при D = 1 + 4b = 0,
    // то есть b = −1/4. После умножения на 4: 4x² − 4x + 1 = 0.
    expect(1 + 4 * -0.25).toBe(0);
    expect(discriminant(4, -4, 1)).toBe(0);
    expect(systemPairs({ kind: 'parabola', a: 1, b: 0, c: 0 }, { kind: 'line', k: 1, b: -0.25 }))
      .toEqual([[0.5, 0.25]]);
    expect(systemPairs(parabola, { kind: 'line', k: 1, b: 6 })).toEqual([[-2, 4], [3, 9]]);
    expect(discriminant(1, -1, -6)).toBe(25);
  });

  it('урок 1.4: текстовые задачи', () => {
    // Катер: 36/(v+3) + 36/(v−3) = 5.
    const boat = solveRationalEquation({
      left: [
        { numerator: [36], denominator: [3, 1] },
        { numerator: [36], denominator: [-3, 1] },
      ],
      right: [{ numerator: [5], denominator: [1] }],
    });
    expect(rootNumbers(boat.roots)).toEqual([-0.6, 15]);
    expect(discriminant(5, -72, -45)).toBe(6084);
    expect(Math.sqrt(6084)).toBe(78);
    expect(36 / 18 + 36 / 12).toBe(5);

    // Прямоугольник: периметр 34, площадь 60 → 5 и 12.
    expect(quadRoots(1, -17, 60)).toEqual([5, 12]);
    expect(discriminant(1, -17, 60)).toBe(49);
    expect(2 * (5 + 12)).toBe(34);

    // Перевёртыш: a + b = 11, a − b = 3 → 74 и 47.
    expect(74 - 47).toBe(27);
    expect(7 + 4).toBe(11);

    // Практика 1–8, 11, 12.
    expect(quadRoots(1, -15, 56)).toEqual([7, 8]);
    expect(quadRoots(1, -13, 40)).toEqual([5, 8]);
    // Задача 3: диагональ 10 и периметр 28 дают xy = (196 − 100)/2 = 48.
    expect((14 ** 2 - 100) / 2).toBe(48);
    expect(quadRoots(1, -14, 48)).toEqual([6, 8]);
    expect(quadRoots(1, 2, -48)).toEqual([-8, 6]); // разность 2, произведение 48
    const river = solveRationalEquation({
      left: [
        { numerator: [30], denominator: [2, 1] },
        { numerator: [30], denominator: [-2, 1] },
      ],
      right: [{ numerator: [8], denominator: [1] }],
    });
    expect(rootNumbers(river.roots)).toEqual([-0.5, 8]);
    expect(30 / 10 + 30 / 6).toBe(8);
    expect(quadRoots(1, -7, -30)).toEqual([-3, 10]); // 10 и 15 часов
    expect(quadRoots(3, -10, 3).map((value) => round(value, 12))).toEqual([round(1 / 3, 12), 3]);
    expect(quadRoots(1, 1, -12)).toEqual([-4, 3]); // 12/v − 12/(v+1) = 1
    // Задача 9: 3t + 2r = 210 и 2t + 3r = 215.
    expect(3 * 40 + 2 * 45).toBe(210);
    expect(2 * 40 + 3 * 45).toBe(215);
    // Задача 11: xy = 24 и (x+2)(y−1) = 24 → y² − y − 12 = 0.
    expect(quadRoots(1, -1, -12)).toEqual([-3, 4]);
    expect((4 + 2) * 4).toBe(24);
    expect(8 * 3).toBe(24);
    // Задача 12: 300/v − 300/(v+10) = 1.
    expect(quadRoots(1, 10, -3000)).toEqual([-60, 50]);
    expect(discriminant(1, 10, -3000)).toBe(12100);
    expect(300 / 50 - 300 / 60).toBe(1);
  });

  it('урок 1.5: практикум главы', () => {
    // Станция 2: окружность радиуса 5 при x = 3, 5 и 6.
    expect(quadRoots(1, 0, -16)).toEqual([-4, 4]);
    expect(25 - 5 ** 2).toBe(0);
    expect(25 - 6 ** 2).toBeLessThan(0);

    // Станция 4: поезд, 240/v − 240/(v+20) = 1.
    const train = solveRationalEquation({
      left: [
        { numerator: [240], denominator: [0, 1] },
        { numerator: [-240], denominator: [20, 1] },
      ],
      right: [{ numerator: [1], denominator: [1] }],
    });
    expect(rootNumbers(train.roots)).toEqual([-80, 60]);
    expect(discriminant(1, 20, -4800)).toBe(19600);
    expect(240 / 60 - 240 / 80).toBe(1);

    // Итоговый набор 1–4, 6–14.
    expect(polyRoots([0, -16, 0, 1])).toEqual([-4, 0, 4]);
    expect(quadRoots(1, -10, 9)).toEqual([1, 9]);
    expect(polyRoots([9, 0, -10, 0, 1])).toEqual([-3, -1, 1, 3]);
    const proportion = solveRationalEquation({
      left: [{ numerator: [2], denominator: [-3, 1] }],
      right: [{ numerator: [5], denominator: [3, 1] }],
    });
    expect(rootNumbers(proportion.roots)).toEqual([7]);
    const trap = solveRationalEquation({
      left: [{ numerator: [0, 1], denominator: [-4, 1] }],
      right: [{ numerator: [4], denominator: [-4, 1] }],
    });
    expect(rootNumbers(trap.candidates)).toEqual([4]);
    expect(trap.roots).toHaveLength(0);
    expect(-4 * -3).toBe(12); // xy = 12 при x = −4
    expect(systemPairs({ kind: 'parabola', a: 1, b: 0, c: 0 }, { kind: 'line', k: 3, b: 4 }))
      .toEqual([[-1, 1], [4, 16]]);
    expect(systemPairs({ kind: 'circle', r: 5 }, { kind: 'line', k: -1, b: 7 }))
      .toEqual([[3, 4], [4, 3]]);
    expect(quadRoots(1, -7, 12)).toEqual([3, 4]);
    // Касание y = kx − 4 и y = x²: k² − 16 = 0.
    expect(discriminant(1, -4, 4)).toBe(0);
    expect(discriminant(1, 4, 4)).toBe(0);
    expect(systemPairs({ kind: 'hyperbola', k: 6 }, { kind: 'line', k: -1, b: 0 })).toEqual([]);
    expect(quadRoots(1, -11, 24)).toEqual([3, 8]);
    expect(discriminant(1, -11, 24)).toBe(25);
    expect(quadRoots(1, -9, 20)).toEqual([4, 5]); // цифры 45 и 54
    expect(4 + 5).toBe(9);
    expect(4 * 5).toBe(20);
  });
});

/* ================================================================== */
describe('глава 2 «Квадратичная функция»', () => {
  it('урок 2.1: парабола и её нули', () => {
    // Полёт мяча h = 20t − 5t².
    expect(evaluateQuadratic(-5, 20, 0, 1)).toBe(15);
    expect(evaluateQuadratic(-5, 20, 0, 3)).toBe(15);
    expect(quadRoots(-5, 20, 0)).toEqual([0, 4]);
    expect(axisOfSymmetry(-5, 20, 0)).toEqual({ numerator: 2, denominator: 1 });

    // Разбор: таблица значений y = x² − 4x + 3.
    expect(discriminant(1, -4, 3)).toBe(4);
    expect(quadRoots(1, -4, 3)).toEqual([1, 3]);
    expect(valueTable(1, -4, 3, [0, 1, 2, 3, 4]).map((point) => point.y)).toEqual([3, 0, -1, 0, 3]);

    // Практика 1, 3–7, 10.
    expect(evaluateQuadratic(1, 3, -4, 0)).toBe(-4); // (x−1)(x+4) = x² + 3x − 4
    expect(evaluateQuadratic(-1, 3, -5, 0)).toBe(-5);
    expect(valueTable(1, -2, -3, [-2, -1, 0, 1, 2, 3, 4]).map((point) => point.y))
      .toEqual([5, 0, -3, -4, -3, 0, 5]);
    expect(discriminant(1, -2, -3)).toBe(16);
    expect(quadRoots(1, -2, -3)).toEqual([-1, 3]);
    expect(discriminant(1, -6, 9)).toBe(0);
    expect(quadRoots(1, -6, 9)).toEqual([3]);
    expect(discriminant(2, -3, 5)).toBe(-31);
    expect(quadRoots(2, -3, 5)).toEqual([]);
    expect(evaluateQuadratic(1, 0, 5, 0)).toBe(5);
    // Ловушка: a > 0, но y(0) = −4 < 0.
    expect(evaluateQuadratic(1, 0, -4, 0)).toBe(-4);
  });

  it('урок 2.2: преобразования графика', () => {
    // Разбор: y = −2(x+1)² + 3 = −2x² − 4x + 1.
    const shifted = toVertexForm(-2, -4, 1);
    expect(shifted.leading).toBe(-2);
    expect(shifted.m).toEqual({ numerator: -1, denominator: 1 });
    expect(shifted.n).toEqual({ numerator: 3, denominator: 1 });
    expect(evaluateQuadratic(-2, -4, 1, 0)).toBe(1);
    expect(-2 * (0 + 1) ** 2 + 3).toBe(1);

    // Обратный переход: x² − 6x + 5 = (x − 3)² − 4.
    const back = toVertexForm(1, -6, 5);
    expect(back.m).toEqual({ numerator: 3, denominator: 1 });
    expect(back.n).toEqual({ numerator: -4, denominator: 1 });
    expect(evaluateQuadratic(1, -6, 5, 3)).toBe(-4);

    // QuickCheck: y = (x + 4)² − 1 — вершина (−4; −1).
    const quick = toVertexForm(1, 8, 15);
    expect([quick.m.numerator, quick.n.numerator]).toEqual([-4, -1]);

    // Практика 1–9.
    expect(toVertexForm(1, -10, 27).m).toEqual({ numerator: 5, denominator: 1 });
    expect(toVertexForm(1, -10, 27).n).toEqual({ numerator: 2, denominator: 1 });
    expect(toVertexForm(1, 6, 8).m).toEqual({ numerator: -3, denominator: 1 });
    expect(toVertexForm(1, 6, 8).n).toEqual({ numerator: -1, denominator: 1 });
    expect(toVertexForm(-1, 4, -4).m).toEqual({ numerator: 2, denominator: 1 });
    expect(toVertexForm(-1, 4, -4).n).toEqual({ numerator: 0, denominator: 1 });
    expect(toVertexForm(3, 0, 4).m).toEqual({ numerator: 0, denominator: 1 });
    expect(toVertexForm(3, 0, 4).n).toEqual({ numerator: 4, denominator: 1 });
    expect(toVertexForm(2, -4, -3).m).toEqual({ numerator: 1, denominator: 1 });
    expect(toVertexForm(2, -4, -3).n).toEqual({ numerator: -5, denominator: 1 });
    // Раскрытие скобок: (x−4)² + 1 и −2(x+3)² − 4.
    expect(valueTable(1, -8, 17, [0, 4]).map((point) => point.y)).toEqual([17, 1]);
    expect(valueTable(-2, -12, -22, [0, -3]).map((point) => point.y)).toEqual([-22, -4]);
    // Сдвиг на 6 вправо и 2 вниз: y = (x − 6)² − 2 = x² − 12x + 34.
    expect(toVertexForm(1, -12, 34).m).toEqual({ numerator: 6, denominator: 1 });
    expect(toVertexForm(1, -12, 34).n).toEqual({ numerator: -2, denominator: 1 });
    // Задача 9: y = (x−1)² − 4 = x² − 2x − 3.
    expect(valueTable(1, -2, -3, [-1, 0, 1, 2, 3]).map((point) => point.y))
      .toEqual([0, -3, -4, -3, 0]);
    // Задача 10: a·(0−2)² + 1 = 5.
    expect((5 - 1) / (0 - 2) ** 2).toBe(1);
  });

  it('урок 2.3: вершина и свойства', () => {
    // Разбор: y = 2x² − 12x + 10.
    expect(vertex(2, -12, 10)).toEqual({
      x: { numerator: 3, denominator: 1 },
      y: { numerator: -8, denominator: 1 },
    });
    expect(evaluateQuadratic(2, -12, 10, 3)).toBe(-8);
    expect(discriminant(2, -12, 10)).toBe(64);
    expect(quadRoots(2, -12, 10)).toEqual([1, 5]);
    expect((1 + 5) / 2).toBe(3);

    // Загон: S = 20x − x², максимум 100 при x = 10; площадь 120 недостижима.
    expect(vertex(-1, 20, 0)).toEqual({
      x: { numerator: 10, denominator: 1 },
      y: { numerator: 100, denominator: 1 },
    });
    expect(evaluateQuadratic(-1, 20, 0, 10)).toBe(100);
    expect(discriminant(1, -20, 120)).toBe(-80);

    // QuickCheck: вершина y = x² − 8x + 3.
    expect(vertex(1, -8, 3)).toEqual({
      x: { numerator: 4, denominator: 1 },
      y: { numerator: -13, denominator: 1 },
    });
    expect(evaluateQuadratic(1, -8, 3, -4)).toBe(51); // разбор неверного варианта

    // Практика 1–3, 6, 8–10.
    expect(vertex(1, -6, 5)).toEqual({
      x: { numerator: 3, denominator: 1 },
      y: { numerator: -4, denominator: 1 },
    });
    expect(vertex(-1, 4, -1)).toEqual({
      x: { numerator: 2, denominator: 1 },
      y: { numerator: 3, denominator: 1 },
    });
    expect(vertex(2, 8, 1)).toEqual({
      x: { numerator: -2, denominator: 1 },
      y: { numerator: -7, denominator: 1 },
    });
    expect(evaluateQuadratic(2, 8, 1, -2)).toBe(-7);
    expect(vertex(3, -6, 7)).toEqual({
      x: { numerator: 1, denominator: 1 },
      y: { numerator: 4, denominator: 1 },
    });
    expect(discriminant(1, -6, 5)).toBe(16);
    expect(quadRoots(1, -6, 5)).toEqual([1, 5]);
    expect(discriminant(1, -6, 10)).toBe(-4);
    expect(quadRoots(1, -6, 10)).toEqual([]);
    expect(axisOfSymmetry(1, -4, 3)).toEqual({ numerator: 2, denominator: 1 }); // b = −4 при x = 2
  });

  it('урок 2.4: квадратные неравенства', () => {
    expect(formatSolutionSet(solveQuadraticInequality(1, -4, 3, 'lt'))).toBe('(1; 3)');
    expect(evaluateQuadratic(1, -4, 3, 2)).toBe(-1);
    expect(evaluateQuadratic(1, -4, 3, 0)).toBe(3);

    // −x² + 2x + 8 ⩾ 0 равносильно x² − 2x − 8 ⩽ 0.
    expect(discriminant(1, -2, -8)).toBe(36);
    expect(quadRoots(1, -2, -8)).toEqual([-2, 4]);
    expect(formatSolutionSet(solveQuadraticInequality(-1, 2, 8, 'ge'))).toBe('[−2; 4]');
    expect(formatSolutionSet(solveQuadraticInequality(1, -2, -8, 'le'))).toBe('[−2; 4]');

    // Четыре случая для (x − 3)².
    expect(formatSolutionSet(solveQuadraticInequality(1, -6, 9, 'gt'))).toBe('(−∞; 3) ∪ (3; +∞)');
    expect(formatSolutionSet(solveQuadraticInequality(1, -6, 9, 'ge'))).toBe('(−∞; +∞)');
    expect(formatSolutionSet(solveQuadraticInequality(1, -6, 9, 'lt'))).toBe('∅');
    expect(formatSolutionSet(solveQuadraticInequality(1, -6, 9, 'le'))).toBe('[3; 3]');
    expect(discriminant(1, 1, 1)).toBe(-3);
    expect(formatSolutionSet(solveQuadraticInequality(1, 1, 1, 'gt'))).toBe('(−∞; +∞)');
    expect(formatSolutionSet(solveQuadraticInequality(1, 1, 1, 'lt'))).toBe('∅');

    // Мяч выше 15 м: 20t − 5t² > 15 → 1 < t < 3, то есть ровно 2 секунды.
    expect(formatSolutionSet(solveQuadraticInequality(-5, 20, -15, 'gt'))).toBe('(1; 3)');
    expect(3 - 1).toBe(2);

    // QuickCheck: x² − 9 > 0.
    expect(formatSolutionSet(solveQuadraticInequality(1, 0, -9, 'gt'))).toBe('(−∞; −3) ∪ (3; +∞)');
    expect(evaluateQuadratic(1, 0, -9, 0)).toBe(-9);

    // Практика 1–8, 10.
    expect(discriminant(1, -5, 4)).toBe(9);
    expect(formatSolutionSet(solveQuadraticInequality(1, -5, 4, 'gt'))).toBe('(−∞; 1) ∪ (4; +∞)');
    expect(formatSolutionSet(solveQuadraticInequality(1, -5, 4, 'le'))).toBe('[1; 4]');
    expect(formatSolutionSet(solveQuadraticInequality(1, 0, -16, 'lt'))).toBe('(−4; 4)');
    expect(discriminant(1, 2, -15)).toBe(64);
    expect(formatSolutionSet(solveQuadraticInequality(1, 2, -15, 'ge'))).toBe('(−∞; −5] ∪ [3; +∞)');
    expect(formatSolutionSet(solveQuadraticInequality(-1, 6, -5, 'gt'))).toBe('(1; 5)');
    expect(formatSolutionSet(solveQuadraticInequality(1, -4, 4, 'gt'))).toBe('(−∞; 2) ∪ (2; +∞)');
    expect(discriminant(1, 1, 3)).toBe(-11);
    expect(formatSolutionSet(solveQuadraticInequality(1, 1, 3, 'gt'))).toBe('(−∞; +∞)');
    expect(discriminant(2, -7, 3)).toBe(25);
    expect(quadRoots(2, -7, 3)).toEqual([0.5, 3]);
    expect(formatSolutionSet(solveQuadraticInequality(2, -7, 3, 'lt'))).toBe('(0,5; 3)');
    expect(formatSolutionSet(solveQuadraticInequality(1, -2, -8, 'lt'))).toBe('(−2; 4)');
  });

  it('урок 2.5: практикум — тоннель, киоск и допуск', () => {
    // Свод h = 4 − x².
    expect(evaluateQuadratic(-1, 0, 4, 0)).toBe(4);
    expect(quadRoots(-1, 0, 4)).toEqual([-2, 2]);
    expect(quadRoots(-1, 0, 1)).toEqual([-1, 1]); // высота 3 м
    expect(evaluateQuadratic(-1, 0, 4, 1)).toBe(3);

    // Киоск: P = (x − 50)(200 − x) = −x² + 250x − 10 000.
    for (const x of [50, 100, 125, 150, 200]) {
      expect(evaluateQuadratic(-1, 250, -10000, x)).toBe((x - 50) * (200 - x));
    }
    expect(vertex(-1, 250, -10000)).toEqual({
      x: { numerator: 125, denominator: 1 },
      y: { numerator: 5625, denominator: 1 },
    });
    expect((125 - 50) * (200 - 125)).toBe(5625);

    // Итоговый набор 1–7, 10–12.
    expect(vertex(-3, 12, -7)).toEqual({
      x: { numerator: 2, denominator: 1 },
      y: { numerator: 5, denominator: 1 },
    });
    expect(evaluateQuadratic(-3, 12, -7, 2)).toBe(5);
    const tunnelForm = toVertexForm(1, -10, 21);
    expect([tunnelForm.m.numerator, tunnelForm.n.numerator]).toEqual([5, -4]);
    expect(discriminant(1, -10, 21)).toBe(16);
    expect(quadRoots(1, -10, 21)).toEqual([3, 7]);
    expect((3 + 7) / 2).toBe(5);
    expect(formatSolutionSet(solveQuadraticInequality(1, -10, 21, 'gt')))
      .toBe('(−∞; 3) ∪ (7; +∞)');
    expect(formatSolutionSet(solveQuadraticInequality(-2, 8, 0, 'ge'))).toBe('[0; 4]');
    // Допуск: −x² + 250x − 10 000 ⩾ 5000 → x² − 250x + 15 000 ⩽ 0.
    expect(discriminant(1, -250, 15000)).toBe(2500);
    expect(quadRoots(1, -250, 15000)).toEqual([100, 150]);
    expect(formatSolutionSet(solveQuadraticInequality(-1, 250, -15000, 'ge'))).toBe('[100; 150]');
    expect(evaluateQuadratic(-1, 250, -10000, 100)).toBe(5000);
    expect(discriminant(1, -4, 4)).toBe(0);
    expect(discriminant(1, -4, 5)).toBe(-4);
  });
});

/* ================================================================== */
describe('глава 3 «Последовательности»', () => {
  it('урок 3.1: числовые последовательности', () => {
    const square = (n: number) => n * n - n + 2;
    expect([1, 2, 3, 4, 5].map(square)).toEqual([2, 4, 8, 14, 22]);
    expect([1, 2, 3, 4, 5].map((n) => 2 ** n)).toEqual([2, 4, 8, 16, 32]);

    // Рекуррентная формула a₁ = 5, aₙ₊₁ = 2aₙ − 3.
    const recur = [5];
    while (recur.length < 5) recur.push(2 * recur[recur.length - 1]! - 3);
    expect(recur).toEqual([5, 7, 11, 19, 35]);
    expect(recur.slice(1).map((value, index) => value - recur[index]!)).toEqual([2, 4, 8, 16]);

    // aₙ = 3n − 1: число 41 — четырнадцатый член, 40 членом не является.
    const linear = arithmeticProgression(2, 3);
    expect(arithmeticIndexOf(linear, 41)).toBe(14);
    expect(arithmeticIndexOf(linear, 40)).toBeNull();
    expect(num(arithmeticTerm(linear, 100))).toBe(299);

    // Практика 1–6, 9–12.
    expect([1, 5, 10].map((n) => 3 * n - 1)).toEqual([2, 14, 29]);
    expect([1, 2, 3, 4].map((n) => n * n + 1)).toEqual([2, 5, 10, 17]);
    expect([1, 3, 9].map((n) => n / (n + 1))).toEqual([1 / 2, 3 / 4, 9 / 10]);
    expect([1, 2, 3, 4, 5].map((n) => (-1) ** n * n)).toEqual([-1, 2, -3, 4, -5]);
    const tripled = [2];
    while (tripled.length < 4) tripled.push(3 * tripled[tripled.length - 1]! + 1);
    expect(tripled).toEqual([2, 7, 22, 67]);
    expect(numbers(arithmeticTerms(arithmeticProgression(100, -7), 5))).toEqual([100, 93, 86, 79, 72]);
    expect([1, 2, 3].map((n) => 3 * n - 2)).toEqual([1, 4, 7]);
    expect([1, 4].map((n) => 2 ** n)).toEqual([2, 16]);
    expect([2 ** 5, square(5)]).toEqual([32, 22]);
    const fib = [1, 1];
    while (fib.length < 6) fib.push(fib[fib.length - 1]! + fib[fib.length - 2]!);
    expect(fib).toEqual([1, 1, 2, 3, 5, 8]);
    // Задача 12: разность соседей равна 1/((n+1)(n+2)) — всегда положительна.
    for (const n of [1, 2, 3, 10]) {
      expect((n + 1) / (n + 2) - n / (n + 1)).toBeCloseTo(1 / ((n + 1) * (n + 2)), 12);
    }
    // Прогноз урока: 5 + 7·99 = 698.
    expect(num(arithmeticTerm(arithmeticProgression(5, 7), 100))).toBe(698);
  });

  it('урок 3.2: арифметическая прогрессия', () => {
    // Зал: a₁ = 12, d = 2.
    const hall = arithmeticProgression(12, 2);
    expect(num(arithmeticTerm(hall, 15))).toBe(40);
    expect(num(arithmeticSum(hall, 15))).toBe(390);
    // QuickCheck: неверный вариант 12 + 2·15 = 42.
    expect(12 + 2 * 15).toBe(42);

    // Разборы: a₁ = 7, d = 4; восстановление по a₃ = 10 и a₇ = 26.
    const seven = arithmeticProgression(7, 4);
    expect(num(arithmeticTerm(seven, 20))).toBe(83);
    expect(num(arithmeticSum(seven, 20))).toBe(900);
    const restored = arithmeticFromTwoTerms(3, 10, 7, 26);
    expect([num(restored.first), num(restored.difference)]).toEqual([2, 4]);
    expect(num(arithmeticTerm(restored, 7))).toBe(26);

    // Прогрессия 5, 12, 19, …: aₙ = 7n − 2.
    const sevens = arithmeticProgression(5, 7);
    expect(arithmeticIndexOf(sevens, 96)).toBe(14);
    expect(arithmeticIndexOf(sevens, 2024)).toBeNull();
    expect(7 * 289).toBe(2023);

    // Прогрессия 6, 10, 14, …: Sₙ = 2n² + 4n = 240 при n = 10.
    const fours = arithmeticProgression(6, 4);
    expect(num(arithmeticSum(fours, 10))).toBe(240);
    expect(quadRoots(1, 2, -120)).toEqual([-12, 10]);
    expect(discriminant(1, 2, -120)).toBe(484);

    // Практика 1–6, 8, 11, 12.
    const first = arithmeticProgression(4, 6);
    expect([num(arithmeticTerm(first, 10)), num(arithmeticSum(first, 10))]).toEqual([58, 310]);
    expect(num(arithmeticTerm(arithmeticProgression(-8, 3), 15))).toBe(34);
    const down = arithmeticProgression(30, -4);
    expect([num(arithmeticTerm(down, 9)), num(arithmeticSum(down, 9))]).toEqual([-2, 126]);
    expect(num(arithmeticSum(arithmeticProgression(1, 1), 100))).toBe(5050);
    const odd = arithmeticProgression(1, 2);
    expect(arithmeticIndexOf(odd, 99)).toBe(50);
    expect(num(arithmeticSum(odd, 50))).toBe(2500);
    expect(50 ** 2).toBe(2500);
    const sevensTwoDigit = arithmeticProgression(14, 7);
    expect(arithmeticIndexOf(sevensTwoDigit, 98)).toBe(13);
    expect(num(arithmeticSum(sevensTwoDigit, 13))).toBe(728);
    // Вставка трёх чисел между 5 и 45.
    const inserted = arithmeticFromTwoTerms(1, 5, 5, 45);
    expect(num(inserted.difference)).toBe(10);
    expect(numbers(arithmeticTerms(inserted, 5))).toEqual([5, 15, 25, 35, 45]);
    // Задача 12: Sₙ = n² + 3n.
    const partial = (n: number) => n * n + 3 * n;
    expect(partial(1)).toBe(4);
    expect(partial(5) - partial(4)).toBe(12);
    for (const n of [1, 2, 3, 5]) expect(partial(n) - partial(n - 1)).toBe(2 * n + 2);
  });

  it('урок 3.3: геометрическая прогрессия', () => {
    // Шахматная доска: S₆₄ = 2⁶⁴ − 1.
    const chess = geometricProgression(1, 2);
    expect(num(geometricSum(chess, 64))).toBe(Number(2n ** 64n - 1n));
    expect((2n ** 64n - 1n).toString()).toBe('18446744073709551615');

    // Разборы: b₁ = 3, q = 2; b₁ = 64, q = 1/2; восстановление по b₂ и b₅.
    const doubling = geometricProgression(3, 2);
    expect(num(geometricTerm(doubling, 8))).toBe(384);
    expect(num(geometricSum(doubling, 8))).toBe(765);
    expect(numbers(geometricTerms(doubling, 8))).toEqual([3, 6, 12, 24, 48, 96, 192, 384]);
    const halving = geometricProgression(64, '1/2');
    expect(num(geometricTerm(halving, 6))).toBe(2);
    expect(num(geometricSum(halving, 6))).toBe(126);
    expect(48 / 6).toBe(8); // q³ = 8, значит q = 2
    expect(2 ** 3).toBe(8);
    // Число 96 — шестой член прогрессии 3, 6, 12, …
    expect(numbers(geometricTerms(doubling, 6))[5]).toBe(96);

    // QuickCheck: 3·2⁸ = 768 — это уже b₉.
    expect(num(geometricTerm(doubling, 9))).toBe(768);

    // Практика 1–12.
    const threes = geometricProgression(2, 3);
    expect([num(geometricTerm(threes, 6)), num(geometricSum(threes, 6))]).toEqual([486, 728]);
    expect(num(geometricTerm(geometricProgression(5, -2), 4))).toBe(-40);
    const alternating = geometricProgression(1, -3);
    expect(numbers(geometricTerms(alternating, 5))).toEqual([1, -3, 9, -27, 81]);
    expect(num(geometricSum(alternating, 5))).toBe(61);
    const thirds = geometricProgression(81, '1/3');
    expect(num(geometricTerm(thirds, 5))).toBe(1);
    expect(num(geometricSum(thirds, 5))).toBe(121);
    expect(num(geometricSum(geometricProgression(1, 2), 10))).toBe(1023);
    expect(2 ** 10 - 1).toBe(1023);
    // Вставка двух чисел между 2 и 54.
    expect(54 / 2).toBe(27);
    expect(numbers(geometricTerms(geometricProgression(2, 3), 4))).toEqual([2, 6, 18, 54]);
    expect(num(geometricTerm(geometricProgression(1024, '1/2'), 10))).toBe(2);
    expect(num(compoundAmount(25000, 10, 3))).toBe(33275);
    expect(num(geometricSum(geometricProgression(3, 2), 3))).toBe(21);
    expect(0.1 * 2 ** 10).toBe(102.4);
    expect(0.1 * 2 ** 20 / 1000).toBeGreaterThan(100); // двадцать сложений — больше ста метров
  });

  it('урок 3.4: сложный процент', () => {
    // Два вклада: 40 000 ₽ под 8 % на 3 года.
    expect(num(growthFactor(8))).toBe(1.08);
    expect(num(compoundAmount(40000, 8, 3))).toBe(50388.48);
    expect(num(simpleAmount(40000, 8, 3))).toBe(49600);
    expect(round(num(compoundAmount(40000, 8, 3)) - num(simpleAmount(40000, 8, 3)), 2)).toBe(788.48);
    expect(1.08 ** 3).toBeCloseTo(1.259712, 12);

    // Цепочки процентов.
    expect(num(chainedPercentFactor([-20, -30]))).toBe(0.56);
    expect(1000 * 0.8).toBe(800);
    expect(800 * 0.7).toBe(560);
    expect(num(chainedPercentFactor([20, -20]))).toBe(0.96);
    expect(num(chainedPercentFactor([-20, 25]))).toBe(1);

    // Удвоение вклада.
    expect(periodsToReach(15, 2)).toBe(5);
    expect(round(1.15 ** 2, 6)).toBe(1.3225);
    expect(round(1.15 ** 5, 3)).toBe(2.011);
    expect(periodsToReach(20, 2)).toBe(4);
    expect(round(1.2 ** 4, 4)).toBe(2.0736);
    expect(periodsToReach(7, 2)).toBe(11);
    expect(round(1.07 ** 10, 3)).toBe(1.967);
    expect(round(1.07 ** 11, 3)).toBe(2.105);

    // QuickCheck: 1,1 · 1,1 = 1,21.
    expect(num(chainedPercentFactor([10, 10]))).toBe(1.21);

    // Практика 1–12.
    expect(num(compoundAmount(2500, 12, 1))).toBe(2800);
    expect(num(compoundAmount(2500, -12, 1))).toBe(2200);
    expect(num(compoundAmount(30000, 6, 2))).toBe(33708);
    expect(num(simpleAmount(30000, 6, 2))).toBe(33600);
    expect(num(compoundAmount(30000, 6, 2)) - num(simpleAmount(30000, 6, 2))).toBe(108);
    expect(num(chainedPercentFactor([25, -25]))).toBe(0.9375);
    expect(round((1 - 0.9375) * 100, 4)).toBe(6.25);
    expect(round(num(compoundAmount(20000, 3, 4)), 4)).toBe(22510.1762);
    expect(round(num(compoundAmount(20000, 3, 4)), 0)).toBe(22510);
    expect(num(compoundAmount(500000, -15, 3))).toBe(307062.5);
    expect(round(0.85 ** 3, 6)).toBe(0.614125);
    expect(round(1.2 ** 3, 3)).toBe(1.728);
    expect(round(0.9 ** 3, 3)).toBe(0.729);
    expect(round((1 - 0.9 ** 3) * 100, 1)).toBe(27.1);
    expect(round(1 / 0.8, 2)).toBe(1.25);
  });

  it('урок 3.5: практикум — распознать правило', () => {
    // Пример без шаблона: a₁ = 2, aₙ₊₁ = 2aₙ + 3.
    const mixed = [2];
    while (mixed.length < 6) mixed.push(2 * mixed[mixed.length - 1]! + 3);
    expect(mixed).toEqual([2, 7, 17, 37, 77, 157]);
    expect(mixed.slice(1).map((value, index) => value - mixed[index]!)).toEqual([5, 10, 20, 40, 80]);
    expect(round(7 / 2, 2)).toBe(3.5);
    expect(round(17 / 7, 2)).toBe(2.43);
    expect(round(37 / 17, 2)).toBe(2.18);

    // Тренировочный план: a₁ = 15, d = 5.
    const plan = arithmeticProgression(15, 5);
    expect(num(arithmeticTerm(plan, 20))).toBe(110);
    expect(num(arithmeticSum(plan, 20))).toBe(1250);
    expect([Math.floor(1250 / 60), 1250 % 60]).toEqual([20, 50]);

    // QuickCheck: 200, 240, 288, 345,6 — знаменатель 1,2.
    const spread = numbers(geometricTerms(geometricProgression(200, '1.2'), 4));
    expect(spread).toEqual([200, 240, 288, 345.6]);

    // Итоговый набор 1–12, 14.
    expect([1, 10].map((n) => 5 * n - 3)).toEqual([2, 47]);
    expect(num(arithmeticSum(arithmeticProgression(2, 5), 10))).toBe(245);
    expect([1, 2].map((n) => 3 * 4 ** n)).toEqual([12, 48]);
    expect((3 * 4 ** 2) / (3 * 4 ** 1)).toBe(4);
    expect(num(arithmeticTerm(plan, 20))).toBe(110);
    expect(num(geometricTerm(geometricProgression(2, 3), 6))).toBe(486);
    const threeDigit = arithmeticProgression(108, 9);
    expect(arithmeticIndexOf(threeDigit, 999)).toBe(100);
    expect(num(arithmeticSum(threeDigit, 100))).toBe(55350);
    expect(num(geometricSum(geometricProgression(1, 3), 9))).toBe(9841);
    expect(3 ** 9).toBe(19683);
    expect(round(num(compoundAmount(50000, 9, 4)), 4)).toBe(70579.0805);
    expect(round(num(compoundAmount(50000, 9, 4)), 2)).toBe(70579.08);
    expect(num(chainedPercentFactor([5, 5, -10]))).toBe(0.99225);
    expect(num(compoundAmount(4000, 0, 0)) * 0.99225).toBe(3969);
    const track = arithmeticFromTwoTerms(5, 17, 12, 45);
    expect([num(track.first), num(track.difference)]).toEqual([1, 4]);
    expect(num(arithmeticSum(track, 12))).toBe(276);
    // S₃ = 26 при b₁ = 2: q = 3 или q = −4.
    expect(quadRoots(1, 1, -12)).toEqual([-4, 3]);
    expect(num(geometricSum(geometricProgression(2, 3), 3))).toBe(26);
    expect(num(geometricSum(geometricProgression(2, -4), 3))).toBe(26);
    expect([2 ** 4, 4 * 4 - 4 + 2]).toEqual([16, 14]);
    expect(arithmeticIndexOf(arithmeticProgression(5, 7), 2024)).toBeNull();
    expect(num(chainedPercentFactor([-50, -50]))).toBe(0.25);
  });
});

/* ================================================================== */
describe('глава 6 «Комбинаторика»', () => {
  it('урок 6.1: правила суммы и произведения', () => {
    expect(productRule([3, 2, 2])).toBe(12);
    // Из A в C: 3·4 через B плюс 2 прямых рейса.
    expect(sumRule([productRule([3, 4]), 2])).toBe(14);
    // Трёхзначные числа: без повторов и всего.
    expect(productRule([9, 9, 8])).toBe(648);
    expect(productRule([9, 10, 10])).toBe(900);
    expect(900 - 648).toBe(252);
    // QuickCheck: 6 книг по физике и 9 по биологии.
    expect(productRule([6, 9])).toBe(54);
    expect(sumRule([6, 9])).toBe(15);

    // Практика 1–11.
    expect(sumRule([5, 4])).toBe(9);
    expect(productRule([5, 4])).toBe(20);
    expect(productRule([10, 10, 10, 10])).toBe(10000);
    expect(productRule([10, 9, 8, 7])).toBe(5040);
    expect(Number(arrangements(10, 4))).toBe(5040);
    expect(productRule([9, 10])).toBe(90);
    expect(productRule([9, 10, 5])).toBe(450);
    expect(productRule([12, 12, 10, 10, 10])).toBe(144000);
    expect(sumRule([12, 15])).toBe(27);
    expect(productRule([12, 15])).toBe(180);
    expect(productRule([9, 10, 10, 1])).toBe(900);
    expect(900 - productRule([8, 9, 9])).toBe(252);
  });

  it('урок 6.2: перестановки и размещения', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => Number(factorial(n)))).toEqual([1, 1, 2, 6, 24, 120, 720]);
    expect(Number(factorial(10))).toBe(3628800);
    expect(Number(factorial(20) / factorial(18))).toBe(19 * 20);
    expect(Number(factorial(8) / factorial(6))).toBe(56);

    // Забег восьмерых: полный протокол и пьедестал.
    expect(Number(permutations(8))).toBe(40320);
    expect(Number(arrangements(8, 3))).toBe(336);
    expect(40320 / 336).toBe(120);
    expect(Number(factorial(5))).toBe(120);

    // Слово КНИГА.
    expect(Number(permutations(5))).toBe(120);
    expect(Number(permutations(4))).toBe(24);
    expect(Number(arrangements(5, 3))).toBe(60);
    expect(Number(arrangements(5, 5)) / Number(arrangements(5, 3))).toBe(2);

    // Склейка соседей: 4!·2! = 48 из 120 рассадок.
    expect(Number(permutations(4)) * Number(permutations(2))).toBe(48);
    expect(48 / 120).toBe(2 / 5);
    expect(4 / Number(combinations(5, 2))).toBe(2 / 5);

    // Практика 2, 3, 6–8, 11, 12.
    expect(Number(factorial(10) / factorial(8))).toBe(90);
    for (const n of [1, 5, 9]) expect(Number(factorial(n + 1) / factorial(n))).toBe(n + 1);
    expect(Number(permutations(6))).toBe(720);
    expect(Number(permutations(4))).toBe(24);
    expect(Number(arrangements(10, 3))).toBe(720);
    expect(Number(arrangements(15, 3))).toBe(2730);
    // Aₙ² = 42 → n = 7.
    expect(quadRoots(1, -1, -42)).toEqual([-6, 7]);
    expect(Number(arrangements(7, 2))).toBe(42);
    expect(Number(factorial(100) / factorial(98))).toBe(9900);
  });

  it('урок 6.3: сочетания и треугольник Паскаля', () => {
    expect(Number(combinations(15, 3))).toBe(455);
    expect(Number(arrangements(15, 3)) / Number(factorial(3))).toBe(455);
    expect(Number(combinations(10, 3))).toBe(120);
    expect(Number(combinations(20, 18))).toBe(190);
    expect(combinations(20, 18)).toBe(combinations(20, 2));

    // Треугольник Паскаля: строки 0–4 и проверка правила для C₆².
    expect([0, 1, 2, 3, 4].map((n) => pascalRow(n).map(Number)))
      .toEqual([[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1]]);
    expect(Number(combinations(6, 2))).toBe(15);
    expect(combinations(6, 2)).toBe(combinations(6, 4));
    expect(Number(combinations(5, 1) + combinations(5, 2))).toBe(15);
    expect(Number(pascalRowSum(6))).toBe(64);

    // Команда из двух групп и лотерея «5 из 36».
    expect(Number(combinations(12, 2))).toBe(66);
    expect(Number(combinations(15, 2))).toBe(105);
    expect(66 * 105).toBe(6930);
    expect(Number(combinations(36, 5))).toBe(376992);
    expect(round(1 / 376992, 7)).toBe(0.0000027);
    expect(376992 / 365).toBeGreaterThan(1000);

    // QuickCheck: жюри из троих — 120, а не 720.
    expect(Number(combinations(10, 3))).toBe(120);
    expect(Number(arrangements(10, 3))).toBe(720);

    // Практика 1–13.
    expect(Number(combinations(7, 2))).toBe(21);
    expect(Number(combinations(9, 9))).toBe(1);
    expect(Number(combinations(12, 1))).toBe(12);
    expect(pascalRow(5).map(Number)).toEqual([1, 5, 10, 10, 5, 1]);
    expect(Number(pascalRowSum(5))).toBe(32);
    expect(Number(arrangements(15, 3))).toBe(2730);
    expect(Number(combinations(10, 2)) - 10).toBe(35); // диагонали десятиугольника
    expect(Number(combinations(12, 2))).toBe(66);
    expect(Number(pascalRowSum(8))).toBe(256);
    expect(Number(combinations(8, 3))).toBe(56);
    // Cₙ² = 28 → n = 8.
    expect(quadRoots(1, -1, -56)).toEqual([-7, 8]);
    expect(Number(combinations(8, 2))).toBe(28);
    expect(Number(combinations(7, 3))).toBe(35);
    expect(Number(combinations(6, 2) + combinations(6, 3))).toBe(35);
    expect(Number(combinations(6, 2))).toBe(15);
    expect(Number(combinations(6, 3))).toBe(20);
    // Хотя бы один отличник: 210 − 35 = 175.
    expect(Number(combinations(10, 4))).toBe(210);
    expect(Number(combinations(7, 4))).toBe(35);
    expect(210 - 35).toBe(175);
  });

  it('урок 6.4: схема Бернулли', () => {
    const p = fraction(3, 5);
    expect(frac(bernoulliProbability(5, 3, p))).toEqual([216, 625]);
    expect(round(fractionToNumber(bernoulliProbability(5, 3, p)), 4)).toBe(0.3456);
    expect(Number(combinations(5, 3))).toBe(10);

    // Таблица распределения в долях 3125.
    const shooter = bernoulliDistribution(5, p);
    expect(shooter.map((entry) => (entry.probability.numerator * 3125) / entry.probability.denominator))
      .toEqual([32, 240, 720, 1080, 810, 243]);
    expect(32 + 240 + 720 + 1080 + 810 + 243).toBe(3125);
    expect(frac(distributionTotal(shooter))).toEqual([1, 1]);
    expect(frac(expectedValue(shooter))).toEqual([3, 1]);
    expect(pascalRow(5).map(Number)).toEqual([1, 5, 10, 10, 5, 1]);
    // Ловушка: один путь даёт 108/3125, а не весь ответ.
    expect(frac(bernoulliProbability(5, 3, p))).toEqual([216, 625]);
    expect((216 * 5) / 625).toBe(1080 / 625);

    // Четыре броска кубика.
    const six = fraction(1, 6);
    expect(frac(bernoulliProbability(4, 1, six))).toEqual([125, 324]);
    expect(round(fractionToNumber(bernoulliProbability(4, 1, six)), 3)).toBe(0.386);
    expect(frac(bernoulliProbability(4, 0, six))).toEqual([625, 1296]);
    expect(round(fractionToNumber(bernoulliProbability(4, 0, six)), 3)).toBe(0.482);
    const atLeastOneSix = probabilityAtLeast(bernoulliDistribution(4, six), 1);
    expect(frac(atLeastOneSix)).toEqual([671, 1296]);
    expect(round(fractionToNumber(atLeastOneSix), 3)).toBe(0.518);
    expect(frac(expectedValue(bernoulliDistribution(4, six)))).toEqual([2, 3]);

    // QuickCheck и практика 1–11.
    const coin = fraction(1, 2);
    expect(frac(bernoulliProbability(6, 4, coin))).toEqual([15, 64]);
    expect(round(fractionToNumber(bernoulliProbability(6, 4, coin)), 3)).toBe(0.234);
    const atLeastOneHead = probabilityAtLeast(bernoulliDistribution(6, coin), 1);
    expect(frac(atLeastOneHead)).toEqual([63, 64]);
    expect(round(fractionToNumber(atLeastOneHead), 3)).toBe(0.984);
    expect(frac(bernoulliProbability(5, 0, p))).toEqual([32, 3125]);
    const guess = fraction(1, 4);
    expect(frac(bernoulliProbability(5, 2, guess))).toEqual([135, 512]);
    expect(round(fractionToNumber(bernoulliProbability(5, 2, guess)), 3)).toBe(0.264);
    expect(frac(bernoulliProbability(5, 0, guess))).toEqual([243, 1024]);
    expect(round(fractionToNumber(bernoulliProbability(5, 0, guess)), 3)).toBe(0.237);
    const atLeastOneRight = probabilityAtLeast(bernoulliDistribution(5, guess), 1);
    expect(frac(atLeastOneRight)).toEqual([781, 1024]);
    expect(round(fractionToNumber(atLeastOneRight), 3)).toBe(0.763);
    expect(frac(bernoulliProbability(3, 2, fraction(9, 10)))).toEqual([243, 1000]);
    const threeCoins = bernoulliDistribution(3, coin);
    expect(threeCoins.map((entry) => frac(entry.probability)))
      .toEqual([[1, 8], [3, 8], [3, 8], [1, 8]]);
    expect(frac(distributionTotal(threeCoins))).toEqual([1, 1]);
    expect(frac(expectedValue(bernoulliDistribution(10, fraction(1, 5))))).toEqual([2, 1]);
    expect(frac(expectedValue(bernoulliDistribution(10, guess)))).toEqual([5, 2]);
  });

  it('урок 6.5: практикум — турнир, лотерея и серия испытаний', () => {
    // Станция 1: составы команд, три пути к 126.
    expect(Number(combinations(9, 4))).toBe(126);
    expect(Number(combinations(9, 5))).toBe(126);
    expect(Number(combinations(8, 3) + combinations(8, 4))).toBe(126);
    expect(Number(combinations(8, 3))).toBe(56);
    expect(Number(combinations(8, 4))).toBe(70);
    expect(126 * 4).toBe(504);

    // Станция 2: пять бросков, p = 1/3.
    expect(frac(bernoulliProbability(5, 2, fraction(1, 3)))).toEqual([80, 243]);
    expect(round(fractionToNumber(bernoulliProbability(5, 2, fraction(1, 3))), 2)).toBe(0.33);

    // QuickCheck: призёры с местами — размещения.
    expect(Number(arrangements(20, 3))).toBe(6840);

    // Итоговый набор 1–14.
    expect(productRule([4, 3, 2])).toBe(24);
    expect(Number(arrangements(9, 4))).toBe(3024);
    expect(Number(permutations(7))).toBe(5040);
    expect(Number(combinations(20, 3))).toBe(1140);
    expect(6840 / 1140).toBe(6);
    expect(Number(factorial(3))).toBe(6);
    expect(Number(combinations(12, 2)) - 12).toBe(54); // диагонали двенадцатиугольника
    expect(Number(combinations(10, 3))).toBe(120);
    expect(Number(combinations(14, 2))).toBe(91);
    expect(120 * 91).toBe(10920);
    expect(pascalRow(7).map(Number)).toEqual([1, 7, 21, 35, 35, 21, 7, 1]);
    expect(Number(pascalRowSum(7))).toBe(128);
    const coin = fraction(1, 2);
    expect(frac(bernoulliProbability(7, 5, coin))).toEqual([21, 128]);
    expect(round(fractionToNumber(bernoulliProbability(7, 5, coin)), 3)).toBe(0.164);
    const shooter = fraction(3, 4);
    expect(frac(bernoulliProbability(4, 3, shooter))).toEqual([27, 64]);
    expect(round(fractionToNumber(bernoulliProbability(4, 3, shooter)), 3)).toBe(0.422);
    const atLeastOneHit = probabilityAtLeast(bernoulliDistribution(4, shooter), 1);
    expect(frac(atLeastOneHit)).toEqual([255, 256]);
    expect(round(fractionToNumber(atLeastOneHit), 3)).toBe(0.996);
    // Задача 11: три монеты.
    const heads = bernoulliDistribution(3, coin);
    expect(frac(expectedValue(heads))).toEqual([3, 2]);
    expect(frac(probabilityAtLeast(heads, 2))).toEqual([1, 2]);
    // Задача 12: сумма очков двух кубиков.
    const dice = finiteExperimentDistribution('twoDiceSum');
    expect(frac(probabilityOfValue(dice, 7))).toEqual([1, 6]);
    expect(frac(probabilityAtLeast(dice, 10))).toEqual([1, 6]);
    expect(frac(expectedValue(dice))).toEqual([7, 1]);
    expect(dice.map((entry) => entry.value)).toHaveLength(11);
    // Задача 13: ровно четыре угаданных номера из пяти.
    expect(Number(combinations(5, 4) * combinations(31, 1))).toBe(155);
    expect(round(155 / 376992, 5)).toBe(0.00041);
  });
});

/* ================================================================== */
describe('входная диагностика глав 9 класса', () => {
  it('проверяет числа из index.mdx четырёх алгебраических глав', () => {
    // Уравнения и системы.
    expect(quadRoots(1, 0, -9)).toEqual([-3, 3]);
    expect(discriminant(1, -5, 6)).toBe(1);
    expect(quadRoots(1, -5, 6)).toEqual([2, 3]);
    expect(polyRoots([-7, 6, 1])).toEqual([-7, 1]); // (x−1)(x+7) = x² + 6x − 7
    expect(3 + 2).toBe(5);
    expect(polyRoots([0, -1, 0, 1])).toEqual([-1, 0, 1]);
    // Система x + y = 7, x − y = 1.
    expect([(7 + 1) / 2, (7 - 1) / 2]).toEqual([4, 3]);

    // Квадратичная функция.
    expect(discriminant(1, 1, 1)).toBe(-3);
    expect(valueTable(1, -6, 9, [0]).map((point) => point.y)).toEqual([9]); // (x−3)²
    expect(evaluateQuadratic(1, -4, 3, 0)).toBe(3);
    expect(evaluateQuadratic(1, -4, 3, 4)).toBe(3);
    expect(vertex(1, -4, 3)).toEqual({
      x: { numerator: 2, denominator: 1 },
      y: { numerator: -1, denominator: 1 },
    });

    // Последовательности.
    expect(4500 * 0.2).toBe(900);
    expect(num(compoundAmount(800, 15, 1))).toBe(920);
    expect(2 ** 10).toBe(1024);
    expect(0.5 ** 5).toBe(0.03125);
    expect(arithmeticIndexOf(arithmeticProgression(5, 7), 54)).toBe(8);
    expect(num(arithmeticSum(arithmeticProgression(1, 1), 10))).toBe(55);
    expect(num(growthFactor(-20))).toBe(0.8);
    expect(3 * 2 ** 4).toBe(48);

    // Комбинаторика.
    expect(productRule([3, 3])).toBe(9);
    expect(Number(combinations(5, 2))).toBe(10);
    expect(frac(fraction(4, 12))).toEqual([1, 3]);
    expect(round((2 / 3) ** 3, 12)).toBe(round(8 / 27, 12));
    expect(frac(fraction(36 - 25, 36))).toEqual([11, 36]);
    expect(productRule([6, 6])).toBe(36);
    expect(frac(fraction(12, 30))).toEqual([2, 5]);
    expect(frac(fraction(3, 5))).toEqual([3, 5]);
  });
});

/* ================================================================== */
describe('сводка по формулам, на которые опираются ответы главы', () => {
  it('формула корней и вершины согласованы между уроками', () => {
    // Ось симметрии всегда лежит посередине между нулями.
    for (const [a, b, c] of [[1, -4, 3], [2, -12, 10], [1, -10, 21], [1, -6, 5]]) {
      const roots = quadRoots(a!, b!, c!);
      expect(roots).toHaveLength(2);
      const axis = axisOfSymmetry(a!, b!, c!);
      expect((roots[0]! + roots[1]!) / 2).toBeCloseTo(axis.numerator / axis.denominator, 12);
    }
    // Формат ответа неравенства и его корни согласованы.
    const solution = solveQuadraticInequality(1, -4, 3, 'lt');
    expect(solution.roots.map((root) => root.approx)).toEqual([1, 3]);
    expect(formatRootList(solveCurveSystem(
      { kind: 'parabola', a: 1, b: 0, c: 0 },
      { kind: 'line', k: 1, b: 2 },
    ).points.map((point) => point.x))).toBe('−1; 2');
  });
});
