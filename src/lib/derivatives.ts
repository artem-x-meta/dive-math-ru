/**
 * Вычислительное ядро главы «Производная» (11 класс).
 *
 * Четыре независимые части:
 *   1) точное дифференцирование многочленов и правила (сумма, произведение,
 *      частное, композиция) — всё в коэффициентах, без приближений;
 *   2) разностное отношение: таблица секущих, которая численно стягивается
 *      к точному значению производной, и уравнение касательной;
 *   3) исследование функции: корни производной, знак на промежутках,
 *      экстремумы и наибольшее/наименьшее значение на отрезке;
 *   4) данные лабораторий: наборы функций с честными окнами рисунка.
 *
 * Многочлен хранится так же, как в главе «Алгебраический язык»: массив
 * коэффициентов по возрастанию степени (src/lib/polynomials.ts). Поэтому
 * дифференцирование многочлена здесь — точная операция над целыми числами,
 * а приближение появляется только там, где корень действительно иррационален.
 */

import {
  addPolynomials,
  evaluatePolynomial,
  formatPolynomial,
  multiplyPolynomials,
  normalizePolynomial,
  scalePolynomial,
  type Polynomial,
} from './polynomials';
import {
  formatApproximate,
  normalizeRational,
  solveQuadratic,
  type Rational,
} from './quadratics';
import { sampleSegments, type Box, type Point } from './functionsCore';

export type { Polynomial } from './polynomials';
export type { Rational } from './quadratics';
export type { Box, Point } from './functionsCore';
export { evaluatePolynomial, formatPolynomial } from './polynomials';

/** Порог, ниже которого число считается нулём при численных проверках. */
const EPSILON = 1e-9;

/** Знак значения: −1, 0 или 1. */
export type Sign = -1 | 0 | 1;

/** Прямая y = kx + b. */
export interface Line {
  readonly slope: number;
  readonly intercept: number;
}

// ────────────────────────── Числа и вспомогательное ──────────────────────────

/** Русская запись числа: десятичная запятая и типографский минус. */
export function formatValue(value: number, digits = 3): string {
  return formatApproximate(value, digits);
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  const rounded = Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} должно быть конечным числом`);
  }
}

/** Проверяет, что все коэффициенты — безопасные целые числа. */
function integerCoefficients(coefficients: Polynomial): boolean {
  return coefficients.every((coefficient) => Number.isSafeInteger(coefficient));
}

/**
 * Допуск, с которым значение многочлена в точке считается нулём.
 * Он растёт вместе с масштабом самих слагаемых, поэтому одинаково работает
 * и для x² − 1, и для 4x³ − 48x² + 144x.
 */
function zeroTolerance(coefficients: Polynomial, x: number): number {
  const scale = coefficients.reduce(
    (sum, coefficient, degree) => sum + Math.abs(coefficient) * Math.abs(x) ** degree,
    0,
  );
  return Math.max(EPSILON, scale * 1e-11);
}

// ───────────────────────── Точная производная многочлена ─────────────────────

/**
 * Производная многочлена: член aₖxᵏ переходит в k·aₖxᵏ⁻¹.
 * У многочлена степени 0 (и у нулевого) производная — нулевой многочлен.
 */
export function differentiate(coefficients: Polynomial): Polynomial {
  const polynomial = normalizePolynomial(coefficients, 'Многочлен');
  if (polynomial.length <= 1) return [];
  const derivative = polynomial
    .slice(1)
    .map((coefficient, index) => coefficient * (index + 1));
  return normalizePolynomial(derivative, 'Производная');
}

/** Производная порядка n: differentiate, применённая n раз. */
export function differentiateTimes(coefficients: Polynomial, times: number): Polynomial {
  if (!Number.isInteger(times) || times < 0 || times > 12) {
    throw new RangeError('Порядок производной должен быть целым числом от 0 до 12');
  }
  let current = normalizePolynomial(coefficients, 'Многочлен');
  for (let step = 0; step < times; step += 1) current = differentiate(current);
  return current;
}

/** Подстановка многочлена в многочлен: (p ∘ q)(x) = p(q(x)) по схеме Горнера. */
export function composePolynomials(outer: Polynomial, inner: Polynomial): Polynomial {
  const p = normalizePolynomial(outer, 'Внешний многочлен');
  const q = normalizePolynomial(inner, 'Внутренний многочлен');
  let result: Polynomial = [];
  for (let degree = p.length - 1; degree >= 0; degree -= 1) {
    result = addPolynomials(multiplyPolynomials(result, q), [p[degree] ?? 0]);
  }
  return result;
}

/** Значение многочлена в точке. */
export function valueAt(coefficients: Polynomial, x: number): number {
  return evaluatePolynomial(coefficients, x);
}

/** Значение производной в точке. */
export function derivativeAt(coefficients: Polynomial, x: number): number {
  return evaluatePolynomial(differentiate(coefficients), x);
}

/** Знак значения многочлена в точке с допуском на ошибку округления. */
export function signAt(coefficients: Polynomial, x: number): Sign {
  const value = evaluatePolynomial(coefficients, x);
  if (Math.abs(value) <= zeroTolerance(coefficients, x)) return 0;
  return value > 0 ? 1 : -1;
}

// ──────────────────────────── Правила и их проверка ──────────────────────────

/** Разбор произведения по правилу (uv)' = u'v + uv'. */
export interface ProductRuleParts {
  readonly u: Polynomial;
  readonly v: Polynomial;
  readonly du: Polynomial;
  readonly dv: Polynomial;
  /** u'v — первое слагаемое правила. */
  readonly duTimesV: Polynomial;
  /** uv' — второе слагаемое правила. */
  readonly uTimesDv: Polynomial;
  /** Ответ по правилу произведения. */
  readonly byRule: Polynomial;
  /** Ответ прямым раскрытием скобок и дифференцированием. */
  readonly direct: Polynomial;
}

export function productRuleParts(u: Polynomial, v: Polynomial): ProductRuleParts {
  const first = normalizePolynomial(u, 'Первый множитель');
  const second = normalizePolynomial(v, 'Второй множитель');
  const du = differentiate(first);
  const dv = differentiate(second);
  const duTimesV = multiplyPolynomials(du, second);
  const uTimesDv = multiplyPolynomials(first, dv);
  return {
    u: first,
    v: second,
    du,
    dv,
    duTimesV,
    uTimesDv,
    byRule: addPolynomials(duTimesV, uTimesDv),
    direct: differentiate(multiplyPolynomials(first, second)),
  };
}

/** Разбор частного: (u/v)' = (u'v − uv') / v². */
export interface QuotientRuleParts {
  readonly u: Polynomial;
  readonly v: Polynomial;
  readonly du: Polynomial;
  readonly dv: Polynomial;
  /** Числитель ответа: u'v − uv'. */
  readonly numerator: Polynomial;
  /** Знаменатель ответа: v². */
  readonly denominator: Polynomial;
}

export function quotientRuleParts(u: Polynomial, v: Polynomial): QuotientRuleParts {
  const first = normalizePolynomial(u, 'Числитель');
  const second = normalizePolynomial(v, 'Знаменатель');
  if (second.length === 0) {
    throw new RangeError('Знаменатель дроби не может быть нулевым многочленом');
  }
  const du = differentiate(first);
  const dv = differentiate(second);
  return {
    u: first,
    v: second,
    du,
    dv,
    numerator: addPolynomials(
      multiplyPolynomials(du, second),
      scalePolynomial(multiplyPolynomials(first, dv), -1),
    ),
    denominator: multiplyPolynomials(second, second),
  };
}

/** Значение дроби u(x)/v(x); null — знаменатель обратился в ноль. */
export function rationalValue(u: Polynomial, v: Polynomial, x: number): number | null {
  const denominator = evaluatePolynomial(v, x);
  if (denominator === 0) return null;
  return evaluatePolynomial(u, x) / denominator;
}

/** Значение производной дроби по правилу частного; null — знаменатель нулевой. */
export function rationalDerivativeValue(u: Polynomial, v: Polynomial, x: number): number | null {
  const parts = quotientRuleParts(u, v);
  const denominator = evaluatePolynomial(parts.denominator, x);
  if (denominator === 0) return null;
  return evaluatePolynomial(parts.numerator, x) / denominator;
}

/** Разбор композиции: (f(g(x)))' = f'(g(x)) · g'(x). */
export interface ChainRuleParts {
  readonly outer: Polynomial;
  readonly inner: Polynomial;
  readonly dOuter: Polynomial;
  readonly dInner: Polynomial;
  /** f(g(x)) в развёрнутом виде. */
  readonly composed: Polynomial;
  /** Ответ по правилу цепочки. */
  readonly byRule: Polynomial;
  /** Ответ прямым дифференцированием развёрнутой записи. */
  readonly direct: Polynomial;
}

export function chainRuleParts(outer: Polynomial, inner: Polynomial): ChainRuleParts {
  const f = normalizePolynomial(outer, 'Внешний многочлен');
  const g = normalizePolynomial(inner, 'Внутренний многочлен');
  const dOuter = differentiate(f);
  const dInner = differentiate(g);
  const composed = composePolynomials(f, g);
  return {
    outer: f,
    inner: g,
    dOuter,
    dInner,
    composed,
    byRule: multiplyPolynomials(composePolynomials(dOuter, g), dInner),
    direct: differentiate(composed),
  };
}

// ───────────────────── Разностное отношение и касательная ────────────────────

/** Одна строка таблицы секущих. */
export interface SecantRow {
  /** Шаг по аргументу. */
  readonly h: number;
  /** Правый конец отрезка: x₀ + h. */
  readonly xEnd: number;
  readonly yStart: number;
  readonly yEnd: number;
  /** Приращение функции Δy = f(x₀ + h) − f(x₀). */
  readonly deltaY: number;
  /** Разностное отношение Δy/h — угловой коэффициент секущей. */
  readonly slope: number;
  /** Насколько секущая отличается от касательной. */
  readonly gap: number;
}

/** Стандартный набор уменьшающихся шагов для таблицы. */
export const SHRINKING_STEPS: readonly number[] = Object.freeze([1, 0.5, 0.25, 0.1, 0.01, 0.001]);

/** Шаги с обеих сторон: видно, что предел один и тот же слева и справа. */
export const TWO_SIDED_STEPS: readonly number[] = Object.freeze([
  -1, -0.5, -0.25, -0.1, -0.05, 0.05, 0.1, 0.25, 0.5, 1,
]);

/** Угловой коэффициент секущей через точки x₀ и x₀ + h. */
export function secantSlope(coefficients: Polynomial, x0: number, h: number): number {
  assertFinite(x0, 'Точка x₀');
  assertFinite(h, 'Шаг h');
  if (h === 0) {
    throw new RangeError('Шаг h не может быть равен нулю: на ноль делить нельзя');
  }
  const start = evaluatePolynomial(coefficients, x0);
  const end = evaluatePolynomial(coefficients, x0 + h);
  return (end - start) / h;
}

/** Таблица секущих: для каждого шага — приращения, наклон и отклонение от предела. */
export function secantRows(
  coefficients: Polynomial,
  x0: number,
  steps: readonly number[] = SHRINKING_STEPS,
): readonly SecantRow[] {
  const exact = derivativeAt(coefficients, x0);
  const yStart = evaluatePolynomial(coefficients, x0);
  return steps.map((h) => {
    const slope = secantSlope(coefficients, x0, h);
    const yEnd = evaluatePolynomial(coefficients, x0 + h);
    return {
      h,
      xEnd: x0 + h,
      yStart,
      yEnd,
      deltaY: yEnd - yStart,
      slope,
      gap: slope - exact,
    };
  });
}

/** Прямая, проходящая через две точки графика (секущая). */
export function secantLine(coefficients: Polynomial, x0: number, h: number): Line {
  const slope = secantSlope(coefficients, x0, h);
  const yStart = evaluatePolynomial(coefficients, x0);
  return { slope, intercept: yStart - slope * x0 };
}

/** Касательная в точке x₀: y = f(x₀) + f'(x₀)(x − x₀). */
export function tangentLine(coefficients: Polynomial, x0: number): Line {
  assertFinite(x0, 'Точка касания');
  const slope = derivativeAt(coefficients, x0);
  const y0 = evaluatePolynomial(coefficients, x0);
  return { slope, intercept: y0 - slope * x0 };
}

/** Значение прямой в точке. */
export function lineValue(line: Line, x: number): number {
  return line.slope * x + line.intercept;
}

/** Запись прямой в виде y = kx + b с русской типографикой. */
export function lineText(line: Line, variable = 'x'): string {
  const body = formatPolynomial(
    [roundTo(line.intercept, 6), roundTo(line.slope, 6)],
    variable,
  );
  return `y = ${body}`;
}

// ──────────────── Корни многочлена: точные там, где это возможно ─────────────

export interface PolynomialRoot {
  readonly x: number;
  /** Несократимая дробь, если корень рационален, иначе null. */
  readonly exact: Rational | null;
}

/** Пытается узнать в числе дробь со знаменателем не больше 12. */
function recognizeRational(value: number): Rational | null {
  for (let denominator = 1; denominator <= 12; denominator += 1) {
    const numerator = Math.round(value * denominator);
    if (!Number.isSafeInteger(numerator)) return null;
    if (Math.abs(value - numerator / denominator) <= 1e-9) {
      return normalizeRational(numerator, denominator);
    }
  }
  return null;
}

/** Оценка сверху для модуля корня (граница Коши). */
function rootBound(coefficients: Polynomial): number {
  const leading = coefficients[coefficients.length - 1] ?? 1;
  const ratios = coefficients
    .slice(0, -1)
    .map((coefficient) => Math.abs(coefficient / leading));
  return 1 + Math.max(0, ...ratios);
}

/** Половинное деление на отрезке, где значения многочлена имеют разные знаки. */
function bisect(coefficients: Polynomial, left: number, right: number): number {
  let low = left;
  let high = right;
  let valueLow = evaluatePolynomial(coefficients, low);
  for (let step = 0; step < 200; step += 1) {
    const middle = (low + high) / 2;
    if (middle === low || middle === high) break;
    const valueMiddle = evaluatePolynomial(coefficients, middle);
    if (valueMiddle === 0) return middle;
    if (valueLow * valueMiddle < 0) {
      high = middle;
    } else {
      low = middle;
      valueLow = valueMiddle;
    }
  }
  return (low + high) / 2;
}

function toRoot(x: number): PolynomialRoot {
  const exact = recognizeRational(x);
  return exact === null ? { x, exact: null } : { x: exact.numerator / exact.denominator, exact };
}

/**
 * Все действительные корни многочлена по возрастанию.
 *
 * Степени 1 и 2 решаются формулами и дают точные дроби. Для степени 3 и выше
 * отрезок разбивается корнями производной: на каждом куске многочлен монотонен,
 * поэтому корень там не больше одного и он находится делением пополам.
 * Кратные корни ловятся отдельной проверкой в самих точках разбиения.
 */
export function polynomialRoots(coefficients: Polynomial): readonly PolynomialRoot[] {
  const polynomial = normalizePolynomial(coefficients, 'Многочлен');
  if (polynomial.length === 0) {
    throw new RangeError('У нулевого многочлена корнем является любое число');
  }

  const degree = polynomial.length - 1;
  if (degree === 0) return [];

  if (degree === 1) {
    const x = -(polynomial[0] ?? 0) / (polynomial[1] ?? 1);
    return [toRoot(x)];
  }

  if (degree === 2 && integerCoefficients(polynomial)) {
    const solution = solveQuadratic(polynomial[2] ?? 1, polynomial[1] ?? 0, polynomial[0] ?? 0);
    return solution.roots.map((root) => (root.exact === null
      ? { x: root.approx, exact: null }
      : { x: root.exact.numerator / root.exact.denominator, exact: root.exact }));
  }

  const bound = rootBound(polynomial);
  const inner = polynomialRoots(differentiate(polynomial))
    .map((root) => root.x)
    .filter((x) => Math.abs(x) < bound);
  const breakpoints = [-bound, ...inner, bound].sort((left, right) => left - right);

  const found: number[] = [];
  const push = (x: number) => {
    if (!found.some((existing) => Math.abs(existing - x) <= 1e-7)) found.push(x);
  };
  const isZero = (x: number) => Math.abs(evaluatePolynomial(polynomial, x)) <= zeroTolerance(polynomial, x);

  for (const point of breakpoints) {
    if (isZero(point)) push(point);
  }
  for (let index = 1; index < breakpoints.length; index += 1) {
    const left = breakpoints[index - 1]!;
    const right = breakpoints[index]!;
    if (isZero(left) || isZero(right)) continue;
    const valueLeft = evaluatePolynomial(polynomial, left);
    const valueRight = evaluatePolynomial(polynomial, right);
    if (valueLeft * valueRight < 0) push(bisect(polynomial, left, right));
  }

  return found.sort((left, right) => left - right).map(toRoot);
}

// ───────────────────── Исследование функции по производной ───────────────────

export type ExtremumKind = 'maximum' | 'minimum' | 'none';

/** Стационарная точка: там, где производная обращается в ноль. */
export interface CriticalPoint {
  readonly x: number;
  readonly exact: Rational | null;
  /** Значение самой функции в этой точке. */
  readonly y: number;
  readonly signBefore: Sign;
  readonly signAfter: Sign;
  readonly kind: ExtremumKind;
}

/** Пробный сдвиг влево и вправо от корня — половина расстояния до соседа. */
function probeStep(roots: readonly number[], index: number): number {
  const current = roots[index]!;
  const left = index > 0 ? (current - roots[index - 1]!) / 2 : 1;
  const right = index < roots.length - 1 ? (roots[index + 1]! - current) / 2 : 1;
  return Math.max(1e-4, Math.min(0.5, left, right));
}

/**
 * Стационарные точки функции и их характер.
 * Знак производной проверяется слева и справа от каждого корня;
 * смена «плюс на минус» — максимум, «минус на плюс» — минимум,
 * отсутствие смены знака — точка без экстремума (как x = 0 у y = x³).
 */
export function criticalPoints(coefficients: Polynomial): readonly CriticalPoint[] {
  const polynomial = normalizePolynomial(coefficients, 'Функция');
  const derivative = differentiate(polynomial);
  if (derivative.length === 0) return [];

  const roots = polynomialRoots(derivative);
  const positions = roots.map((root) => root.x);

  return roots.map((root, index) => {
    const step = probeStep(positions, index);
    const signBefore = signAt(derivative, root.x - step);
    const signAfter = signAt(derivative, root.x + step);
    const kind: ExtremumKind = signBefore > 0 && signAfter < 0
      ? 'maximum'
      : signBefore < 0 && signAfter > 0
        ? 'minimum'
        : 'none';
    return {
      x: root.x,
      exact: root.exact,
      y: evaluatePolynomial(polynomial, root.x),
      signBefore,
      signAfter,
      kind,
    };
  });
}

export type MonotonicityKind = 'increasing' | 'decreasing' | 'constant';

/** Промежуток монотонности; null у границы означает бесконечность. */
export interface MonotonicityInterval {
  readonly from: number | null;
  readonly to: number | null;
  readonly kind: MonotonicityKind;
}

/**
 * Промежутки возрастания и убывания. Соседние куски с одинаковым знаком
 * производной склеиваются: у y = x³ ответ — один промежуток, а не два.
 */
export function monotonicityIntervals(coefficients: Polynomial): readonly MonotonicityInterval[] {
  const polynomial = normalizePolynomial(coefficients, 'Функция');
  const derivative = differentiate(polynomial);
  if (derivative.length === 0) {
    return [{ from: null, to: null, kind: 'constant' }];
  }

  const positions = polynomialRoots(derivative).map((root) => root.x);
  const bounds: (number | null)[] = [null, ...positions, null];
  const raw: MonotonicityInterval[] = [];

  for (let index = 1; index < bounds.length; index += 1) {
    const from = bounds[index - 1] ?? null;
    const to = bounds[index] ?? null;
    const probe = from === null && to === null
      ? 0
      : from === null
        ? to! - 1
        : to === null
          ? from + 1
          : (from + to) / 2;
    const sign = signAt(derivative, probe);
    raw.push({ from, to, kind: sign > 0 ? 'increasing' : sign < 0 ? 'decreasing' : 'constant' });
  }

  const merged: MonotonicityInterval[] = [];
  for (const interval of raw) {
    const last = merged[merged.length - 1];
    if (last && last.kind === interval.kind) {
      merged[merged.length - 1] = { from: last.from, to: interval.to, kind: interval.kind };
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

/** Текст промежутка: «(−∞; −1]», «[1; +∞)», «[−1; 1]». */
export function intervalText(interval: MonotonicityInterval): string {
  const left = interval.from === null ? '(−∞' : `[${formatValue(interval.from)}`;
  const right = interval.to === null ? '+∞)' : `${formatValue(interval.to)}]`;
  return `${left}; ${right}`;
}

export function monotonicityText(kind: MonotonicityKind): string {
  if (kind === 'increasing') return 'возрастает';
  if (kind === 'decreasing') return 'убывает';
  return 'постоянна';
}

export function extremumText(kind: ExtremumKind): string {
  if (kind === 'maximum') return 'точка максимума';
  if (kind === 'minimum') return 'точка минимума';
  return 'экстремума нет';
}

// ──────────────────── Наибольшее и наименьшее на отрезке ─────────────────────

export type CandidateSource = 'endpoint' | 'critical';

export interface SegmentCandidate {
  readonly x: number;
  readonly y: number;
  readonly source: CandidateSource;
}

export interface SegmentExtrema {
  readonly from: number;
  readonly to: number;
  /** Все кандидаты по возрастанию x: концы отрезка и стационарные точки внутри. */
  readonly candidates: readonly SegmentCandidate[];
  readonly minimum: SegmentCandidate;
  readonly maximum: SegmentCandidate;
}

/**
 * Наибольшее и наименьшее значения непрерывной функции на отрезке.
 * Сравниваются только концы отрезка и стационарные точки внутри него —
 * это и есть школьный алгоритм, а не перебор всех точек.
 */
export function extremaOnSegment(
  coefficients: Polynomial,
  from: number,
  to: number,
): SegmentExtrema {
  assertFinite(from, 'Левый конец отрезка');
  assertFinite(to, 'Правый конец отрезка');
  if (!(from < to)) {
    throw new RangeError('Правый конец отрезка должен быть больше левого');
  }
  const polynomial = normalizePolynomial(coefficients, 'Функция');
  const derivative = differentiate(polynomial);
  const stationary = derivative.length === 0
    ? []
    : polynomialRoots(derivative)
        .map((root) => root.x)
        .filter((x) => x > from + EPSILON && x < to - EPSILON);

  const candidates: SegmentCandidate[] = [
    { x: from, y: evaluatePolynomial(polynomial, from), source: 'endpoint' },
    ...stationary.map((x) => ({
      x,
      y: evaluatePolynomial(polynomial, x),
      source: 'critical' as CandidateSource,
    })),
    { x: to, y: evaluatePolynomial(polynomial, to), source: 'endpoint' },
  ].sort((left, right) => left.x - right.x);

  let minimum = candidates[0]!;
  let maximum = candidates[0]!;
  for (const candidate of candidates) {
    if (candidate.y < minimum.y - EPSILON) minimum = candidate;
    if (candidate.y > maximum.y + EPSILON) maximum = candidate;
  }

  return { from, to, candidates, minimum, maximum };
}

// ────────────────────────── Рисунки: ломаные графика ─────────────────────────

/** Ломаные графика многочлена внутри окна рисунка. */
export function polynomialSegments(
  coefficients: Polynomial,
  box: Box,
  samples = 321,
): readonly Point[][] {
  const polynomial = normalizePolynomial(coefficients, 'Функция');
  return sampleSegments((x) => evaluatePolynomial(polynomial, x), box, samples);
}

/** Ломаные прямой внутри окна рисунка — та же честная обрезка по границам. */
export function lineSegments(line: Line, box: Box, samples = 64): readonly Point[][] {
  return sampleSegments((x) => lineValue(line, x), box, samples);
}

// ──────────────────── Таблица производных основных функций ───────────────────

export interface DerivativeFact {
  readonly id: string;
  /** Запись функции для таблицы. */
  readonly functionText: string;
  readonly derivativeText: string;
  /** Где формула работает. */
  readonly domainText: string;
  readonly value: (x: number) => number;
  readonly derivative: (x: number) => number;
  /** Точки, в которых формулу можно честно проверить численно. */
  readonly probes: readonly number[];
}

export const DERIVATIVE_FACTS: readonly DerivativeFact[] = Object.freeze([
  {
    id: 'const',
    functionText: 'y = 7',
    derivativeText: "y' = 0",
    domainText: 'любое x',
    value: () => 7,
    derivative: () => 0,
    probes: [-2, 0, 1.5, 4],
  },
  {
    id: 'linear',
    functionText: 'y = x',
    derivativeText: "y' = 1",
    domainText: 'любое x',
    value: (x) => x,
    derivative: () => 1,
    probes: [-3, 0, 2.5],
  },
  {
    id: 'square',
    functionText: 'y = x²',
    derivativeText: "y' = 2x",
    domainText: 'любое x',
    value: (x) => x * x,
    derivative: (x) => 2 * x,
    probes: [-2, 0, 1, 3],
  },
  {
    id: 'cube',
    functionText: 'y = x³',
    derivativeText: "y' = 3x²",
    domainText: 'любое x',
    value: (x) => x ** 3,
    derivative: (x) => 3 * x * x,
    probes: [-2, 0.5, 2],
  },
  {
    id: 'sqrt',
    functionText: 'y = √x',
    derivativeText: "y' = 1 / (2√x)",
    domainText: 'x > 0',
    value: (x) => Math.sqrt(x),
    derivative: (x) => 1 / (2 * Math.sqrt(x)),
    probes: [0.25, 1, 4, 9],
  },
  {
    id: 'reciprocal',
    functionText: 'y = 1/x',
    derivativeText: "y' = −1/x²",
    domainText: 'x ≠ 0',
    value: (x) => 1 / x,
    derivative: (x) => -1 / (x * x),
    probes: [-2, -0.5, 0.5, 3],
  },
  {
    id: 'sin',
    functionText: 'y = sin x',
    derivativeText: "y' = cos x",
    domainText: 'любое x',
    value: (x) => Math.sin(x),
    derivative: (x) => Math.cos(x),
    probes: [-1, 0, 0.5, 2],
  },
  {
    id: 'cos',
    functionText: 'y = cos x',
    derivativeText: "y' = −sin x",
    domainText: 'любое x',
    value: (x) => Math.cos(x),
    derivative: (x) => -Math.sin(x),
    probes: [-1, 0, 0.5, 2],
  },
  {
    id: 'exp',
    functionText: 'y = eˣ',
    derivativeText: "y' = eˣ",
    domainText: 'любое x',
    value: (x) => Math.exp(x),
    derivative: (x) => Math.exp(x),
    probes: [-1, 0, 1],
  },
  {
    id: 'ln',
    functionText: 'y = ln x',
    derivativeText: "y' = 1/x",
    domainText: 'x > 0',
    value: (x) => Math.log(x),
    derivative: (x) => 1 / x,
    probes: [0.5, 1, 3],
  },
]);

/**
 * Численная производная центральной разностью. Нужна только для проверок:
 * она приближает, а не заменяет формулу.
 */
export function numericDerivative(
  value: (x: number) => number,
  x: number,
  h = 1e-5,
): number {
  assertFinite(x, 'Точка');
  if (!(h > 0)) throw new RangeError('Шаг численной производной должен быть положительным');
  return (value(x + h) - value(x - h)) / (2 * h);
}

// ───────────────────────────── Наборы лабораторий ────────────────────────────

export type SecantPresetId = 'fall' | 'throw' | 'square' | 'cubic';

export interface SecantPreset {
  readonly id: SecantPresetId;
  readonly title: string;
  readonly variable: string;
  readonly coefficients: Polynomial;
  readonly box: Box;
  readonly xLabel: string;
  readonly yLabel: string;
  readonly slopeLabel: string;
  readonly story: string;
  readonly anchors: readonly number[];
  readonly defaultAnchor: number;
}

export const SECANT_PRESETS: readonly SecantPreset[] = Object.freeze([
  {
    id: 'fall',
    title: 'Падение s = 5t²',
    variable: 't',
    coefficients: [0, 0, 5],
    box: { xMin: 0, xMax: 3.2, yMin: -12, yMax: 55 },
    xLabel: 't, с',
    yLabel: 's, м',
    slopeLabel: 'скорость, м/с',
    story: 'Камень падает без начальной скорости: за t секунд он пролетает s = 5t² метров.',
    anchors: [0.5, 1, 1.5, 2],
    defaultAnchor: 2,
  },
  {
    id: 'throw',
    title: 'Бросок h = 20t − 5t²',
    variable: 't',
    coefficients: [0, 20, -5],
    box: { xMin: 0, xMax: 4.2, yMin: -12, yMax: 26 },
    xLabel: 't, с',
    yLabel: 'h, м',
    slopeLabel: 'скорость, м/с',
    story: 'Мяч брошен вверх со скоростью 20 м/с: высота меняется по закону h = 20t − 5t².',
    anchors: [0.5, 1, 1.5, 2, 2.5, 3],
    defaultAnchor: 1,
  },
  {
    id: 'square',
    title: 'y = x²',
    variable: 'x',
    coefficients: [0, 0, 1],
    box: { xMin: -4, xMax: 4, yMin: -6, yMax: 14 },
    xLabel: 'x',
    yLabel: 'y',
    slopeLabel: 'наклон касательной',
    story: 'Парабола — самый удобный полигон: наклон касательной здесь легко посчитать вручную.',
    anchors: [-2, -1, 0, 1, 2, 3],
    defaultAnchor: 1,
  },
  {
    id: 'cubic',
    title: 'y = x³ − 3x',
    variable: 'x',
    coefficients: [0, -3, 0, 1],
    box: { xMin: -3, xMax: 3, yMin: -8, yMax: 8 },
    xLabel: 'x',
    yLabel: 'y',
    slopeLabel: 'наклон касательной',
    story: 'У этой кривой наклон касательной меняет знак дважды — есть где ошибиться в прогнозе.',
    anchors: [-2, -1.5, -1, 0, 1, 1.5, 2],
    defaultAnchor: -1,
  },
]);

export function getSecantPreset(id: SecantPresetId): SecantPreset {
  const preset = SECANT_PRESETS.find((item) => item.id === id);
  if (!preset) throw new RangeError(`Неизвестный набор секущей: ${String(id)}`);
  return preset;
}

/** Шаги, при которых вторая точка секущей не выходит за окно рисунка. */
export function availableSteps(
  preset: SecantPreset,
  x0: number,
  steps: readonly number[] = TWO_SIDED_STEPS,
): readonly number[] {
  return steps.filter((h) => {
    const x = x0 + h;
    return h !== 0 && x >= preset.box.xMin && x <= preset.box.xMax;
  });
}

export type ProfilePresetId =
  | 'cubic'
  | 'quartic'
  | 'monotone'
  | 'parabola'
  | 'box-volume'
  | 'fence';

export interface ProfilePreset {
  readonly id: ProfilePresetId;
  readonly title: string;
  readonly variable: string;
  readonly coefficients: Polynomial;
  /** Окно для графика функции. */
  readonly box: Box;
  /** Окно для графика производной; ось x у обоих окон общая. */
  readonly derivativeBox: Box;
  readonly story: string;
  /** Отрезок прикладной задачи, если он есть. */
  readonly segment: { readonly from: number; readonly to: number } | null;
  readonly segmentNote: string | null;
}

export const PROFILE_PRESETS: readonly ProfilePreset[] = Object.freeze([
  {
    id: 'cubic',
    title: 'y = x³ − 3x',
    variable: 'x',
    coefficients: [0, -3, 0, 1],
    box: { xMin: -3, xMax: 3, yMin: -6, yMax: 6 },
    derivativeBox: { xMin: -3, xMax: 3, yMin: -6, yMax: 26 },
    story: 'Классический случай: две стационарные точки, максимум левее минимума.',
    segment: null,
    segmentNote: null,
  },
  {
    id: 'parabola',
    title: 'y = −x² + 4x − 3',
    variable: 'x',
    coefficients: [-3, 4, -1],
    box: { xMin: -1, xMax: 5, yMin: -9, yMax: 3 },
    derivativeBox: { xMin: -1, xMax: 5, yMin: -8, yMax: 8 },
    story: 'Производная линейна, поэтому знак меняется ровно один раз.',
    segment: null,
    segmentNote: null,
  },
  {
    id: 'monotone',
    title: 'y = x³ + 3x',
    variable: 'x',
    coefficients: [0, 3, 0, 1],
    box: { xMin: -2.5, xMax: 2.5, yMin: -26, yMax: 26 },
    derivativeBox: { xMin: -2.5, xMax: 2.5, yMin: -4, yMax: 24 },
    story: 'Производная всюду положительна: стационарных точек нет вообще.',
    segment: null,
    segmentNote: null,
  },
  {
    id: 'quartic',
    title: 'y = x⁴ − 2x²',
    variable: 'x',
    coefficients: [0, 0, -2, 0, 1],
    box: { xMin: -2.2, xMax: 2.2, yMin: -2.5, yMax: 4 },
    derivativeBox: { xMin: -2.2, xMax: 2.2, yMin: -12, yMax: 12 },
    story: 'Три стационарные точки: два минимума и локальный максимум между ними.',
    segment: null,
    segmentNote: null,
  },
  {
    id: 'box-volume',
    title: 'V = x(12 − 2x)²',
    variable: 'x',
    coefficients: [0, 144, -48, 4],
    box: { xMin: 0, xMax: 6.2, yMin: -10, yMax: 145 },
    derivativeBox: { xMin: 0, xMax: 6.2, yMin: -80, yMax: 160 },
    story: 'Из квадратного листа 12 × 12 вырезают по углам квадратики со стороной x и загибают борта.',
    segment: { from: 0, to: 6 },
    segmentNote: 'Сторона выреза не может быть отрицательной, а при x = 6 дно исчезает.',
  },
  {
    id: 'fence',
    title: 'S = 60x − 2x²',
    variable: 'x',
    coefficients: [0, 60, -2],
    box: { xMin: 0, xMax: 31, yMin: -20, yMax: 520 },
    derivativeBox: { xMin: 0, xMax: 31, yMin: -70, yMax: 70 },
    story: 'Забор длиной 60 м огораживает прямоугольник у стены: сторон всего три.',
    segment: { from: 0, to: 30 },
    segmentNote: 'При x = 0 и x = 30 прямоугольник вырождается в отрезок.',
  },
]);

export function getProfilePreset(id: ProfilePresetId): ProfilePreset {
  const preset = PROFILE_PRESETS.find((item) => item.id === id);
  if (!preset) throw new RangeError(`Неизвестный набор исследования: ${String(id)}`);
  return preset;
}
