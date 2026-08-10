/**
 * Ядро главы «Интеграл» (11 класс).
 *
 * Все функции главы — многочлены. Они хранятся так же, как в `polynomials.ts`:
 * массив коэффициентов по возрастанию степени, индекс равен степени члена.
 * Например, [ 4, 0, -1 ] — это 4 − x².
 *
 * Первообразные и определённые интегралы считаются в точной рациональной
 * арифметике (`exactRational.ts`), поэтому ответ вида 1/3 остаётся дробью
 * 1/3, а не 0,3333333333333333. Суммы Римана считаются в числах с плавающей
 * точкой: они и без того приближённые, а нужны быстро и много раз.
 */

import {
  MAX_POLYNOMIAL_LENGTH,
  evaluatePolynomial,
  formatExponent,
  formatPolynomial,
  normalizePolynomial,
  subtractPolynomials,
  type Polynomial,
} from './polynomials';
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
  type ExactRational,
} from './exactRational';

const MINUS = '−';
const EXACT_ZERO = parseExact(0);

/** Пределы интегрирования по модулю не больше этого числа. */
export const MAX_INTEGRATION_BOUND = 100;

/** Максимальное число прямоугольников в сумме Римана. */
export const MAX_RIEMANN_PARTS = 1000;

/** Способ выбора точки, по которой берётся высота прямоугольника. */
export type RiemannRule = 'left' | 'right' | 'middle';

export const RIEMANN_RULES: readonly RiemannRule[] = ['left', 'right', 'middle'];

export const RIEMANN_RULE_LABELS: Record<RiemannRule, string> = {
  left: 'по левому краю',
  right: 'по правому краю',
  middle: 'по середине',
};

/** Один прямоугольник ступенчатой фигуры. */
export interface RiemannRectangle {
  /** Номер прямоугольника, считая от нижнего предела. */
  index: number;
  /** Левая граница частичного отрезка. */
  from: number;
  /** Правая граница частичного отрезка. */
  to: number;
  /** Точка, в которой измерена высота. */
  sample: number;
  /** Значение функции в этой точке; может быть отрицательным. */
  height: number;
  /** Площадь со знаком: height · width. */
  area: number;
}

/** Полный отчёт об одном приближении: сумма, точное значение и погрешность. */
export interface RiemannSummary {
  rule: RiemannRule;
  parts: number;
  width: number;
  sum: number;
  exact: number;
  /** Модуль разности между суммой и точным значением. */
  error: number;
  rectangles: RiemannRectangle[];
}

/** Строка таблицы сходимости: сколько частей — такая сумма и такая погрешность. */
export interface ConvergenceRow {
  parts: number;
  width: number;
  sum: number;
  error: number;
}

export interface CurvePoint {
  x: number;
  y: number;
}

/** Кусок фигуры между двумя графиками между соседними точками пересечения. */
export interface AreaPiece {
  from: number;
  to: number;
  /** Какой из двух графиков идёт сверху на этом куске. */
  upper: 'first' | 'second';
  /** Площадь куска — всегда неотрицательное число. */
  area: number;
}

export interface AreaBetweenResult {
  /** Точки пересечения строго внутри отрезка. */
  intersections: number[];
  pieces: AreaPiece[];
  /** Площадь фигуры: сумма модулей кусков. */
  area: number;
  /** Интеграл разности со знаком: он меньше площади, если графики пересекаются. */
  signed: number;
}

/** Шаг накопления: сколько добавилось за промежуток и сколько накопилось всего. */
export interface AccumulationStep {
  from: number;
  to: number;
  added: number;
  total: number;
}

/** Готовая функция для лабораторий главы. */
export interface IntegralFunctionPreset {
  readonly id: string;
  readonly title: string;
  readonly formula: string;
  readonly coefficients: Polynomial;
}

export const INTEGRAL_FUNCTIONS: readonly IntegralFunctionPreset[] = [
  { id: 'zero', title: 'Ось абсцисс', formula: '0', coefficients: [] },
  { id: 'constant', title: 'Постоянная', formula: '2', coefficients: [2] },
  { id: 'linear', title: 'Линейная', formula: '2x + 1', coefficients: [1, 2] },
  { id: 'line-shift', title: 'Наклонная прямая', formula: 'x + 2', coefficients: [2, 1] },
  { id: 'square', title: 'Парабола', formula: 'x²', coefficients: [0, 0, 1] },
  { id: 'dome', title: 'Купол', formula: '4 − x²', coefficients: [4, 0, -1] },
  { id: 'valley', title: 'Сдвинутая парабола', formula: 'x² − 2x + 3', coefficients: [3, -2, 1] },
  { id: 'cubic', title: 'Кубическая', formula: 'x³', coefficients: [0, 0, 0, 1] },
];

export function getIntegralFunction(id: string): IntegralFunctionPreset {
  const preset = INTEGRAL_FUNCTIONS.find((item) => item.id === id);
  if (!preset) throw new RangeError(`Неизвестная функция: ${id}`);
  return preset;
}

function assertBound(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} должен быть конечным числом`);
  }
  if (Math.abs(value) > MAX_INTEGRATION_BOUND) {
    throw new RangeError(`${label} по модулю не может превышать ${MAX_INTEGRATION_BOUND}`);
  }
}

function assertOrderedInterval(from: number, to: number): void {
  assertBound(from, 'Нижний предел');
  assertBound(to, 'Верхний предел');
  if (!(from < to)) {
    throw new RangeError('Нижний предел интегрирования должен быть строго меньше верхнего');
  }
}

function assertParts(parts: number): void {
  if (!Number.isInteger(parts) || parts < 1 || parts > MAX_RIEMANN_PARTS) {
    throw new RangeError(`Число частей должно быть целым от 1 до ${MAX_RIEMANN_PARTS}`);
  }
}

function assertRule(rule: RiemannRule): void {
  if (!RIEMANN_RULES.includes(rule)) {
    throw new RangeError(`Неизвестное правило выбора точки: ${String(rule)}`);
  }
}

/** Убирает мусор порядка 1e-15, который остаётся после деления пополам. */
function snap(value: number): number {
  const rounded = Math.round(value * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Первообразная многочлена с нулевой постоянной: коэффициент при xⁿ делится
 * на n + 1 и переезжает на одну степень выше. Свободный член равен нулю.
 */
export function antiderivativeExact(coefficients: Polynomial): readonly ExactRational[] {
  const normalized = normalizePolynomial(coefficients, 'Подынтегральная функция');
  if (normalized.length + 1 > MAX_POLYNOMIAL_LENGTH) {
    throw new RangeError(`Первообразная выходит за поддерживаемую степень ${MAX_POLYNOMIAL_LENGTH - 1}`);
  }

  const result: ExactRational[] = [EXACT_ZERO];
  normalized.forEach((coefficient, degree) => {
    result.push(divideExact(parseExact(coefficient), degree + 1));
  });
  return result;
}

/** Переводит точные коэффициенты в обычные числа — для графиков и оценок. */
export function exactPolynomialToNumbers(coefficients: readonly ExactRational[]): Polynomial {
  return normalizePolynomial(coefficients.map((value) => toExactNumber(value)), 'Первообразная');
}

/** Производная многочлена с точными коэффициентами. */
export function differentiateExact(coefficients: readonly ExactRational[]): readonly ExactRational[] {
  return coefficients.slice(1).map((coefficient, index) => multiplyExact(coefficient, index + 1));
}

/**
 * Проверка первообразной дифференцированием: F′ должна совпасть с f.
 * Именно эту проверку в уроке делает читатель вручную.
 */
export function verifyAntiderivative(coefficients: Polynomial): boolean {
  const original = normalizePolynomial(coefficients, 'Подынтегральная функция');
  const restored = differentiateExact(antiderivativeExact(original));
  if (restored.length !== original.length) return false;
  return restored.every((value, degree) => compareExact(value, parseExact(original[degree] ?? 0)) === 0);
}

function monomialWithFraction(magnitude: ExactRational, degree: number, variable: string): string {
  const power = degree === 0 ? '' : degree === 1 ? variable : `${variable}${formatExponent(degree)}`;
  const numerator = magnitude.numerator.toString();
  const head = degree === 0 ? numerator : numerator === '1' ? power : `${numerator}${power}`;
  return magnitude.denominator === 1n ? head : `${head}/${magnitude.denominator.toString()}`;
}

/** Записывает первообразную с нулевой постоянной: [0, 0, 1] → «x³/3». */
export function antiderivativeText(coefficients: Polynomial, variable = 'x'): string {
  const exact = antiderivativeExact(coefficients);
  const parts: string[] = [];

  for (let degree = exact.length - 1; degree >= 0; degree -= 1) {
    const value = exact[degree]!;
    if (value.numerator === 0n) continue;
    const negative = value.numerator < 0n;
    const magnitude: ExactRational = {
      numerator: negative ? -value.numerator : value.numerator,
      denominator: value.denominator,
    };
    const body = monomialWithFraction(magnitude, degree, variable);
    parts.push(parts.length === 0 ? (negative ? `${MINUS}${body}` : body) : `${negative ? MINUS : '+'} ${body}`);
  }

  return parts.length === 0 ? '0' : parts.join(' ');
}

/** Записывает всё семейство первообразных: «x³/3 + C». */
export function antiderivativeFamilyText(coefficients: Polynomial, variable = 'x', constantName = 'C'): string {
  const body = antiderivativeText(coefficients, variable);
  return body === '0' ? constantName : `${body} + ${constantName}`;
}

/** Значение многочлена с точными коэффициентами по схеме Горнера. */
export function evaluateExactPolynomial(coefficients: readonly ExactRational[], x: ExactInput): ExactRational {
  const point = parseExact(x);
  let value: ExactRational = EXACT_ZERO;
  for (let degree = coefficients.length - 1; degree >= 0; degree -= 1) {
    value = addExact(multiplyExact(value, point), coefficients[degree] ?? EXACT_ZERO);
  }
  return value;
}

/** Точное значение определённого интеграла: F(b) − F(a). */
export function definiteIntegralExact(coefficients: Polynomial, from: number, to: number): ExactRational {
  assertBound(from, 'Нижний предел');
  assertBound(to, 'Верхний предел');
  const antiderivative = antiderivativeExact(coefficients);
  return subtractExact(
    evaluateExactPolynomial(antiderivative, to),
    evaluateExactPolynomial(antiderivative, from),
  );
}

/** То же значение обычным числом. */
export function definiteIntegral(coefficients: Polynomial, from: number, to: number): number {
  return toExactNumber(definiteIntegralExact(coefficients, from, to));
}

/** Готовая выкладка по формуле Ньютона–Лейбница — по одной строке на шаг. */
export interface NewtonLeibnizReport {
  /** Подынтегральная функция. */
  integrand: string;
  /** Первообразная с нулевой постоянной. */
  antiderivative: string;
  /** Значение первообразной в верхнем пределе. */
  upperValue: string;
  /** Значение первообразной в нижнем пределе. */
  lowerValue: string;
  /** Точный ответ: F(b) − F(a). */
  result: string;
  /** Тот же ответ обычным числом. */
  resultNumber: number;
}

/**
 * Собирает выкладку «нашли F, подставили b, подставили a, вычли».
 * Постоянная C в ответе не участвует: при вычитании она сокращается.
 */
export function newtonLeibnizReport(
  coefficients: Polynomial,
  from: number,
  to: number,
  variable = 'x',
): NewtonLeibnizReport {
  assertBound(from, 'Нижний предел');
  assertBound(to, 'Верхний предел');
  const antiderivative = antiderivativeExact(coefficients);
  const upper = evaluateExactPolynomial(antiderivative, to);
  const lower = evaluateExactPolynomial(antiderivative, from);
  const difference = subtractExact(upper, lower);

  return {
    integrand: formatPolynomial(coefficients, variable),
    antiderivative: antiderivativeText(coefficients, variable),
    upperValue: formatExactRussian(upper),
    lowerValue: formatExactRussian(lower),
    result: formatExactRussian(difference),
    resultNumber: toExactNumber(difference),
  };
}

/**
 * Постоянная C, при которой график первообразной проходит через точку (x₀; y₀):
 * из условия F(x₀) + C = y₀ получаем C = y₀ − F(x₀).
 */
export function constantThroughPoint(coefficients: Polynomial, x0: number, y0: number): ExactRational {
  assertBound(x0, 'Абсцисса точки');
  assertBound(y0, 'Ордината точки');
  const value = evaluateExactPolynomial(antiderivativeExact(coefficients), x0);
  return subtractExact(parseExact(y0), value);
}

function samplePoint(from: number, to: number, rule: RiemannRule): number {
  if (rule === 'left') return from;
  if (rule === 'right') return to;
  return (from + to) / 2;
}

/** Прямоугольники ступенчатой фигуры: одинаковая ширина, высота по выбранной точке. */
export function riemannRectangles(
  coefficients: Polynomial,
  from: number,
  to: number,
  parts: number,
  rule: RiemannRule,
): RiemannRectangle[] {
  assertOrderedInterval(from, to);
  assertParts(parts);
  assertRule(rule);

  const width = (to - from) / parts;
  return Array.from({ length: parts }, (_, index) => {
    const left = from + index * width;
    const right = index === parts - 1 ? to : from + (index + 1) * width;
    const sample = samplePoint(left, right, rule);
    const height = evaluatePolynomial(coefficients, sample);
    return { index, from: left, to: right, sample, height, area: height * (right - left) };
  });
}

/** Сумма Римана: сумма площадей прямоугольников со знаком. */
export function riemannSum(
  coefficients: Polynomial,
  from: number,
  to: number,
  parts: number,
  rule: RiemannRule,
): number {
  return riemannRectangles(coefficients, from, to, parts, rule)
    .reduce((total, rectangle) => total + rectangle.area, 0);
}

/** Приближение вместе с точным значением и погрешностью. */
export function riemannSummary(
  coefficients: Polynomial,
  from: number,
  to: number,
  parts: number,
  rule: RiemannRule,
): RiemannSummary {
  const rectangles = riemannRectangles(coefficients, from, to, parts, rule);
  const sum = rectangles.reduce((total, rectangle) => total + rectangle.area, 0);
  const exact = definiteIntegral(coefficients, from, to);
  return {
    rule,
    parts,
    width: (to - from) / parts,
    sum,
    exact,
    error: Math.abs(sum - exact),
    rectangles,
  };
}

/** Таблица сходимости: как убывает погрешность при сгущении разбиения. */
export function riemannConvergence(
  coefficients: Polynomial,
  from: number,
  to: number,
  partsList: readonly number[],
  rule: RiemannRule,
): ConvergenceRow[] {
  const exact = definiteIntegral(coefficients, from, to);
  return partsList.map((parts) => {
    const sum = riemannSum(coefficients, from, to, parts, rule);
    return { parts, width: (to - from) / parts, sum, error: Math.abs(sum - exact) };
  });
}

function bisectRoot(coefficients: Polynomial, left: number, right: number): number {
  let low = left;
  let high = right;
  let lowValue = evaluatePolynomial(coefficients, low);

  for (let step = 0; step < 80; step += 1) {
    const middle = (low + high) / 2;
    const value = evaluatePolynomial(coefficients, middle);
    if (value === 0) return middle;
    if (Math.sign(value) === Math.sign(lowValue)) {
      low = middle;
      lowValue = value;
    } else {
      high = middle;
    }
  }

  return (low + high) / 2;
}

function rootsInInterval(coefficients: Polynomial, from: number, to: number): number[] {
  const normalized = normalizePolynomial(coefficients, 'Разность функций');
  const degree = normalized.length - 1;
  const found: number[] = [];

  if (degree <= 0) {
    // Нулевой многочлен: графики совпадают, отдельных точек пересечения нет.
    return [];
  }

  if (degree === 1) {
    found.push(-(normalized[0] ?? 0) / (normalized[1] ?? 1));
  } else if (degree === 2) {
    const c0 = normalized[0] ?? 0;
    const c1 = normalized[1] ?? 0;
    const c2 = normalized[2] ?? 1;
    const discriminant = c1 * c1 - 4 * c2 * c0;
    if (discriminant === 0) {
      found.push(-c1 / (2 * c2));
    } else if (discriminant > 0) {
      const root = Math.sqrt(discriminant);
      found.push((-c1 - root) / (2 * c2), (-c1 + root) / (2 * c2));
    }
  } else {
    // Для старших степеней ищем перемены знака на мелкой сетке и уточняем делением пополам.
    const steps = 2000;
    const width = (to - from) / steps;
    let previousX = from;
    let previousValue = evaluatePolynomial(normalized, from);
    if (previousValue === 0) found.push(from);

    for (let index = 1; index <= steps; index += 1) {
      const x = index === steps ? to : from + index * width;
      const value = evaluatePolynomial(normalized, x);
      if (value === 0) {
        found.push(x);
      } else if (previousValue !== 0 && Math.sign(value) !== Math.sign(previousValue)) {
        found.push(bisectRoot(normalized, previousX, x));
      }
      previousX = x;
      previousValue = value;
    }
  }

  const inside = found
    .map(snap)
    .filter((root) => root >= from && root <= to)
    .sort((left, right) => left - right);

  return inside.filter((root, index) => index === 0 || Math.abs(root - (inside[index - 1] ?? root)) > 1e-9);
}

/** Точки пересечения двух графиков на отрезке [from; to], включая его концы. */
export function crossingPoints(
  first: Polynomial,
  second: Polynomial,
  from: number,
  to: number,
): number[] {
  assertOrderedInterval(from, to);
  return rootsInInterval(subtractPolynomials(first, second), from, to);
}

/**
 * Площадь фигуры между двумя графиками. Отрезок делится точками пересечения,
 * на каждом куске берётся модуль интеграла разности — поэтому взаимное
 * уничтожение частей невозможно.
 */
export function areaBetween(
  first: Polynomial,
  second: Polynomial,
  from: number,
  to: number,
): AreaBetweenResult {
  assertOrderedInterval(from, to);
  const difference = subtractPolynomials(first, second);
  const intersections = rootsInInterval(difference, from, to)
    .filter((root) => root > from + 1e-9 && root < to - 1e-9);
  const knots = [from, ...intersections, to];
  const pieces: AreaPiece[] = [];

  for (let index = 0; index < knots.length - 1; index += 1) {
    const left = knots[index]!;
    const right = knots[index + 1]!;
    const signed = definiteIntegral(difference, left, right);
    pieces.push({
      from: left,
      to: right,
      upper: signed >= 0 ? 'first' : 'second',
      area: Math.abs(signed),
    });
  }

  return {
    intersections,
    pieces,
    area: pieces.reduce((total, piece) => total + piece.area, 0),
    signed: definiteIntegral(difference, from, to),
  };
}

/** Накопление величины по её скорости изменения: ∫ от a до x. */
export function accumulated(rate: Polynomial, from: number, x: number): number {
  return definiteIntegral(rate, from, x);
}

/** Пошаговое накопление: сколько добавилось за каждый промежуток и сколько стало всего. */
export function accumulationSteps(
  rate: Polynomial,
  from: number,
  to: number,
  parts: number,
): AccumulationStep[] {
  assertOrderedInterval(from, to);
  assertParts(parts);

  const width = (to - from) / parts;
  const steps: AccumulationStep[] = [];
  let total = 0;

  for (let index = 0; index < parts; index += 1) {
    const left = from + index * width;
    const right = index === parts - 1 ? to : from + (index + 1) * width;
    const added = definiteIntegral(rate, left, right);
    total += added;
    steps.push({ from: left, to: right, added, total });
  }

  return steps;
}

/** Точки графика для честного рисунка: равномерная сетка по x. */
export function samplePolynomial(
  coefficients: Polynomial,
  from: number,
  to: number,
  count = 121,
): CurvePoint[] {
  assertOrderedInterval(from, to);
  if (!Number.isInteger(count) || count < 2 || count > 5000) {
    throw new RangeError('Число точек должно быть целым от 2 до 5000');
  }

  return Array.from({ length: count }, (_, index) => {
    const x = index === count - 1 ? to : from + ((to - from) * index) / (count - 1);
    return { x, y: evaluatePolynomial(coefficients, x) };
  });
}

/** Наибольшее и наименьшее значения многочлена на отрезке — по мелкой сетке. */
export function curveExtremes(
  coefficients: Polynomial,
  from: number,
  to: number,
  count = 401,
): { min: number; max: number } {
  const points = samplePolynomial(coefficients, from, to, count);
  return points.reduce(
    (bounds, point) => ({ min: Math.min(bounds.min, point.y), max: Math.max(bounds.max, point.y) }),
    { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
  );
}

/** Русская запись числа: запятая вместо точки и не больше `digits` знаков. */
export function numberText(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Number(value.toFixed(digits));
  const text = String(Object.is(rounded, -0) ? 0 : rounded);
  return text.replace('-', MINUS).replace('.', ',');
}

/** Точное значение словами: «1/3» или «4,5». */
export function exactText(value: ExactRational): string {
  return formatExactRussian(value);
}

/** Подпись функции: «f(x) = x²». */
export function functionText(coefficients: Polynomial, name = 'f', variable = 'x'): string {
  return `${name}(${variable}) = ${formatPolynomial(coefficients, variable)}`;
}
