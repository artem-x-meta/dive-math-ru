/**
 * Вычислительное ядро главы «Уравнения и системы» (9 класс).
 *
 * Три сюжета главы:
 *   1. целое и дробно-рациональное уравнение с одной переменной;
 *   2. уравнение с двумя переменными и его график;
 *   3. система двух уравнений, в том числе нелинейная.
 *
 * Всё, что можно посчитать точно, считается точно: рациональные корни —
 * обыкновенными дробями, иррациональные — честной парой «точного значения нет
 * + десятичное приближение». Числа с плавающей точкой появляются только там,
 * где нужны координаты рисунка.
 */

import {
  addExact,
  compareExact,
  divideExact,
  formatExactRussian,
  isExactZero,
  multiplyExact,
  negateExact,
  parseExact,
  subtractExact,
  toExactNumber,
  type ExactInput,
  type ExactRational,
} from './exactRational';
import { degreeOf, formatPolynomial, trimPolynomial, type Polynomial } from './algebraicFractions';
import { clipLineToBox } from './linear';

const ZERO = parseExact(0);
const ONE = parseExact(1);

/** Наибольшая степень многочлена, которую разбирает ядро главы. */
const MAX_DEGREE = 8;
/** Ограничение перебора делителей в теореме о рациональных корнях. */
const DIVISOR_LIMIT = 1_000_000n;
/** Допуск для сравнения приближённых значений (только для иррациональных корней). */
const EPSILON = 1e-9;

// ───────────────────────────── Точные вспомогательные числа ─────────────────

function absBig(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcdBig(left: bigint, right: bigint): bigint {
  let a = absBig(left);
  let b = absBig(right);
  while (b !== 0n) {
    const rest = a % b;
    a = b;
    b = rest;
  }
  return a;
}

function lcmBig(left: bigint, right: bigint): bigint {
  if (left === 0n || right === 0n) return 0n;
  return absBig(left / gcdBig(left, right) * right);
}

function isqrtBig(value: bigint): bigint | null {
  if (value < 0n) return null;
  if (value < 2n) return value;
  let estimate = value;
  let next = (estimate + 1n) / 2n;
  while (next < estimate) {
    estimate = next;
    next = (estimate + value / estimate) / 2n;
  }
  return estimate * estimate === value ? estimate : null;
}

/**
 * Точный квадратный корень рационального числа: существует, только если
 * и числитель, и знаменатель несократимой дроби — точные квадраты.
 */
export function exactSquareRoot(value: ExactInput): ExactRational | null {
  const exact = parseExact(value);
  if (exact.numerator < 0n) return null;
  const numerator = isqrtBig(exact.numerator);
  const denominator = isqrtBig(exact.denominator);
  if (numerator === null || denominator === null) return null;
  return parseExact({ numerator, denominator });
}

function divisorsOf(value: bigint): bigint[] {
  const target = absBig(value);
  if (target === 0n || target > DIVISOR_LIMIT) return [];
  const found: bigint[] = [];
  for (let divisor = 1n; divisor * divisor <= target; divisor += 1n) {
    if (target % divisor !== 0n) continue;
    found.push(divisor);
    const partner = target / divisor;
    if (partner !== divisor) found.push(partner);
  }
  return found.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

// ───────────────────────────── Корни: точные и приближённые ─────────────────

/** Действительный корень: точная дробь, если она есть, и числовое значение. */
export interface RealRoot {
  readonly exact: ExactRational | null;
  readonly approx: number;
}

function exactRoot(value: ExactRational): RealRoot {
  return Object.freeze({ exact: value, approx: toExactNumber(value) });
}

function approximateRoot(value: number): RealRoot {
  return Object.freeze({ exact: null, approx: value });
}

function sameRoot(left: RealRoot, right: RealRoot): boolean {
  if (left.exact !== null && right.exact !== null) return compareExact(left.exact, right.exact) === 0;
  if (left.exact === null && right.exact === null) return Math.abs(left.approx - right.approx) < EPSILON;
  return false;
}

/** Убирает повторы и упорядочивает корни по возрастанию. */
export function normalizeRoots(roots: readonly RealRoot[]): RealRoot[] {
  const sorted = [...roots].sort((left, right) => left.approx - right.approx);
  return sorted.filter((root, index) => index === 0 || !sameRoot(root, sorted[index - 1]!));
}

/** Есть ли корень в списке (точное сравнение там, где оно возможно). */
export function containsRoot(list: readonly RealRoot[], root: RealRoot): boolean {
  return list.some((candidate) => sameRoot(candidate, root));
}

// ───────────────────────────── Многочлены с точными коэффициентами ──────────

/** Коэффициенты по возрастанию степеней: [c0, c1, c2] — это c0 + c1x + c2x². */
type ExactPoly = readonly ExactRational[];

function exactPolyFrom(coefficients: readonly ExactInput[]): ExactRational[] {
  return coefficients.map((coefficient) => parseExact(coefficient));
}

function trimExact(poly: ExactPoly): ExactRational[] {
  let last = poly.length - 1;
  while (last > 0 && isExactZero(poly[last]!)) last -= 1;
  return poly.slice(0, last + 1) as ExactRational[];
}

function degreeExact(poly: ExactPoly): number {
  for (let index = poly.length - 1; index >= 0; index -= 1) {
    if (!isExactZero(poly[index]!)) return index;
  }
  return -1;
}

function addExactPoly(left: ExactPoly, right: ExactPoly): ExactRational[] {
  const length = Math.max(left.length, right.length, 1);
  const sum: ExactRational[] = [];
  for (let index = 0; index < length; index += 1) {
    sum.push(addExact(left[index] ?? ZERO, right[index] ?? ZERO));
  }
  return trimExact(sum);
}

function subtractExactPoly(left: ExactPoly, right: ExactPoly): ExactRational[] {
  const length = Math.max(left.length, right.length, 1);
  const difference: ExactRational[] = [];
  for (let index = 0; index < length; index += 1) {
    difference.push(subtractExact(left[index] ?? ZERO, right[index] ?? ZERO));
  }
  return trimExact(difference);
}

function multiplyExactPoly(left: ExactPoly, right: ExactPoly): ExactRational[] {
  if (degreeExact(left) === -1 || degreeExact(right) === -1) return [ZERO];
  const product: ExactRational[] = new Array(left.length + right.length - 1).fill(ZERO);
  for (let i = 0; i < left.length; i += 1) {
    if (isExactZero(left[i]!)) continue;
    for (let j = 0; j < right.length; j += 1) {
      product[i + j] = addExact(product[i + j]!, multiplyExact(left[i]!, right[j]!));
    }
  }
  return trimExact(product);
}

function scaleExactPoly(poly: ExactPoly, factor: ExactRational): ExactRational[] {
  return trimExact(poly.map((coefficient) => multiplyExact(coefficient, factor)));
}

function evaluateExactPoly(poly: ExactPoly, x: ExactInput): ExactRational {
  const point = parseExact(x);
  let accumulator = ZERO;
  for (let index = poly.length - 1; index >= 0; index -= 1) {
    accumulator = addExact(multiplyExact(accumulator, point), poly[index]!);
  }
  return accumulator;
}

function evaluateNumeric(poly: ExactPoly, x: number): number {
  let accumulator = 0;
  for (let index = poly.length - 1; index >= 0; index -= 1) {
    accumulator = accumulator * x + toExactNumber(poly[index]!);
  }
  return accumulator;
}

/** Деление многочленов с остатком (в поле рациональных чисел). */
function divideExactPoly(dividend: ExactPoly, divisor: ExactPoly): { quotient: ExactRational[]; remainder: ExactRational[] } {
  const divisorDegree = degreeExact(divisor);
  if (divisorDegree === -1) throw new RangeError('Делить многочлен на нулевой многочлен нельзя');

  let remainder = trimExact(dividend);
  const quotient: ExactRational[] = new Array(Math.max(degreeExact(remainder) - divisorDegree + 1, 1)).fill(ZERO);
  const leading = divisor[divisorDegree]!;

  for (;;) {
    const remainderDegree = degreeExact(remainder);
    if (remainderDegree === -1 || remainderDegree < divisorDegree) break;
    const shift = remainderDegree - divisorDegree;
    const factor = divideExact(remainder[remainderDegree]!, leading);
    quotient[shift] = addExact(quotient[shift] ?? ZERO, factor);
    const subtracted: ExactRational[] = new Array(shift).fill(ZERO);
    for (const coefficient of divisor) subtracted.push(multiplyExact(coefficient, factor));
    remainder = subtractExactPoly(remainder, subtracted);
  }

  return { quotient: trimExact(quotient), remainder };
}

/** Наибольший общий делитель многочленов; результат приведён (старший коэффициент 1). */
function gcdExactPoly(left: ExactPoly, right: ExactPoly): ExactRational[] {
  let a = trimExact(left);
  let b = trimExact(right);
  if (degreeExact(a) === -1) return monicExactPoly(b);
  if (degreeExact(b) === -1) return monicExactPoly(a);

  let guard = 0;
  while (degreeExact(b) !== -1) {
    if (guard > 64) break;
    guard += 1;
    const { remainder } = divideExactPoly(a, b);
    a = b;
    b = remainder;
  }
  return monicExactPoly(a);
}

function monicExactPoly(poly: ExactPoly): ExactRational[] {
  const degree = degreeExact(poly);
  if (degree === -1) return [ZERO];
  return scaleExactPoly(poly, divideExact(ONE, poly[degree]!));
}

/** Наименьшее общее кратное многочленов (приведённое). */
function lcmExactPoly(left: ExactPoly, right: ExactPoly): ExactRational[] {
  const product = multiplyExactPoly(left, right);
  const divisor = gcdExactPoly(left, right);
  if (degreeExact(divisor) === -1) return monicExactPoly(product);
  return monicExactPoly(divideExactPoly(product, divisor).quotient);
}

function contentScale(polys: readonly ExactPoly[]): ExactRational {
  let denominator = 1n;
  for (const poly of polys) {
    for (const coefficient of poly) denominator = lcmBig(denominator, coefficient.denominator);
  }
  let numerator = 0n;
  for (const poly of polys) {
    for (const coefficient of poly) {
      const scaled = coefficient.numerator * (denominator / coefficient.denominator);
      numerator = gcdBig(numerator, scaled);
    }
  }
  if (numerator === 0n) numerator = 1n;
  return parseExact({ numerator: denominator, denominator: numerator });
}

function toSafeInteger(value: ExactRational, label: string): number {
  if (value.denominator !== 1n) throw new RangeError(`${label} должен быть целым числом`);
  const result = Number(value.numerator);
  if (!Number.isSafeInteger(result)) throw new RangeError(`${label} выходит за диапазон безопасных целых чисел`);
  return result;
}

/** Переводит точный многочлен в целочисленный, сокращая общий множитель. */
function toIntegerPolynomial(poly: ExactPoly, positiveLeading = false): number[] {
  const trimmed = trimExact(poly);
  if (degreeExact(trimmed) === -1) return [0];
  let scale = contentScale([trimmed]);
  if (positiveLeading && compareExact(trimmed[degreeExact(trimmed)]!, ZERO) < 0) {
    scale = negateExact(scale);
  }
  return scaleExactPoly(trimmed, scale).map((coefficient, index) => toSafeInteger(coefficient, `Коэффициент №${index}`));
}

// ───────────────────────────── Квадратное уравнение ─────────────────────────

export interface QuadraticOutcome {
  /** 'all' — верно при любом x; 'none' — корней нет. */
  readonly kind: 'none' | 'one' | 'two' | 'all';
  readonly roots: readonly RealRoot[];
  /** Дискриминант; для линейного случая (a = 0) равен null. */
  readonly discriminant: ExactRational | null;
  /** true, если старший коэффициент оказался нулевым и уравнение не квадратное. */
  readonly degenerate: boolean;
}

/**
 * Решает ax² + bx + c = 0 точно. Случай a = 0 обрабатывается честно:
 * уравнение становится линейным, и это отмечено флагом degenerate.
 */
export function solveQuadraticExact(a: ExactInput, b: ExactInput, c: ExactInput): QuadraticOutcome {
  const leading = parseExact(a);
  const middle = parseExact(b);
  const free = parseExact(c);

  if (isExactZero(leading)) {
    if (isExactZero(middle)) {
      return Object.freeze({
        kind: isExactZero(free) ? ('all' as const) : ('none' as const),
        roots: Object.freeze([]),
        discriminant: null,
        degenerate: true,
      });
    }
    const root = divideExact(negateExact(free), middle);
    return Object.freeze({
      kind: 'one' as const,
      roots: Object.freeze([exactRoot(root)]),
      discriminant: null,
      degenerate: true,
    });
  }

  const discriminant = subtractExact(
    multiplyExact(middle, middle),
    multiplyExact(parseExact(4), multiplyExact(leading, free)),
  );

  if (compareExact(discriminant, ZERO) < 0) {
    return Object.freeze({ kind: 'none' as const, roots: Object.freeze([]), discriminant, degenerate: false });
  }

  const doubled = multiplyExact(parseExact(2), leading);
  if (isExactZero(discriminant)) {
    const root = divideExact(negateExact(middle), doubled);
    return Object.freeze({
      kind: 'one' as const,
      roots: Object.freeze([exactRoot(root)]),
      discriminant,
      degenerate: false,
    });
  }

  const squareRoot = exactSquareRoot(discriminant);
  if (squareRoot !== null) {
    const first = divideExact(subtractExact(negateExact(middle), squareRoot), doubled);
    const second = divideExact(addExact(negateExact(middle), squareRoot), doubled);
    return Object.freeze({
      kind: 'two' as const,
      roots: Object.freeze(normalizeRoots([exactRoot(first), exactRoot(second)])),
      discriminant,
      degenerate: false,
    });
  }

  const numericD = Math.sqrt(toExactNumber(discriminant));
  const numericB = toExactNumber(middle);
  const numericDoubled = toExactNumber(doubled);
  return Object.freeze({
    kind: 'two' as const,
    roots: Object.freeze(normalizeRoots([
      approximateRoot((-numericB - numericD) / numericDoubled),
      approximateRoot((-numericB + numericD) / numericDoubled),
    ])),
    discriminant,
    degenerate: false,
  });
}

// ───────────────────────────── Целое уравнение P(x) = 0 ─────────────────────

export interface PolynomialSolution {
  /** Найденные действительные корни по возрастанию. */
  readonly roots: readonly RealRoot[];
  /** true, если найдены ВСЕ действительные корни уравнения. */
  readonly complete: boolean;
  /** true, если многочлен нулевой: равенство верно при любом x. */
  readonly identity: boolean;
}

function rationalRootCandidates(poly: ExactPoly): ExactRational[] {
  const integers = toIntegerPolynomial(poly);
  const degree = integers.length - 1;
  const free = BigInt(integers[0]!);
  const leading = BigInt(integers[degree]!);
  if (free === 0n) return [];

  const numerators = divisorsOf(free);
  const denominators = divisorsOf(leading);
  if (numerators.length === 0 || denominators.length === 0) return [];

  const candidates: ExactRational[] = [];
  for (const p of numerators) {
    for (const q of denominators) {
      candidates.push(parseExact({ numerator: p, denominator: q }));
      candidates.push(parseExact({ numerator: -p, denominator: q }));
    }
  }
  return candidates;
}

function deflate(poly: ExactPoly, root: ExactRational): ExactRational[] {
  const degree = degreeExact(poly);
  const quotient: ExactRational[] = new Array(degree).fill(ZERO);
  quotient[degree - 1] = poly[degree]!;
  for (let index = degree - 1; index >= 1; index -= 1) {
    quotient[index - 1] = addExact(poly[index]!, multiplyExact(root, quotient[index]!));
  }
  return trimExact(quotient);
}

/**
 * Решает целое уравнение P(x) = 0 с целыми коэффициентами.
 *
 * Рациональные корни ищутся по теореме о рациональных корнях с понижением
 * степени, остаток степени не выше двух разбирается через дискриминант.
 * Если после этого остаётся многочлен степени 3 и выше без рациональных
 * корней, флаг complete становится false: ядро честно сообщает, что нашло
 * не все корни, а не делает вид, что их больше нет.
 */
export function solvePolynomialEquation(polynomial: Polynomial): PolynomialSolution {
  const trimmed = trimPolynomial(polynomial);
  const degree = degreeOf(trimmed);
  if (degree > MAX_DEGREE) {
    throw new RangeError(`Ядро главы разбирает многочлены степени не выше ${MAX_DEGREE}`);
  }
  if (degree === -1) {
    return Object.freeze({ roots: Object.freeze([]), complete: true, identity: true });
  }

  let working: ExactRational[] = exactPolyFrom(trimmed);
  const roots: RealRoot[] = [];

  // Множитель x: сразу даёт корень 0 и понижает степень.
  let hasZeroRoot = false;
  while (working.length > 1 && isExactZero(working[0]!)) {
    hasZeroRoot = true;
    working = working.slice(1);
  }
  if (hasZeroRoot) roots.push(exactRoot(ZERO));

  const candidates = rationalRootCandidates(working);
  let complete = true;

  for (;;) {
    const currentDegree = degreeExact(working);
    if (currentDegree <= 2) {
      const outcome = solveQuadraticExact(working[2] ?? ZERO, working[1] ?? ZERO, working[0] ?? ZERO);
      roots.push(...outcome.roots);
      break;
    }
    const found = candidates.find((candidate) => isExactZero(evaluateExactPoly(working, candidate)));
    if (found === undefined) {
      complete = false;
      break;
    }
    roots.push(exactRoot(found));
    working = deflate(working, found);
  }

  return Object.freeze({ roots: Object.freeze(normalizeRoots(roots)), complete, identity: false });
}

/**
 * Разбор биквадратного уравнения ax⁴ + bx² + c = 0 через замену t = x².
 * Возвращает уравнение для t и корни исходного уравнения.
 */
export interface BiquadraticPlan {
  readonly substitution: QuadraticOutcome;
  /** Значения t, годные для обратной замены (t ≥ 0). */
  readonly usableT: readonly RealRoot[];
  readonly roots: readonly RealRoot[];
}

export function biquadraticPlan(a: ExactInput, b: ExactInput, c: ExactInput): BiquadraticPlan {
  const substitution = solveQuadraticExact(a, b, c);
  const usable: RealRoot[] = [];
  const roots: RealRoot[] = [];

  for (const t of substitution.roots) {
    if (t.exact !== null) {
      if (compareExact(t.exact, ZERO) < 0) continue;
      usable.push(t);
      const root = exactSquareRoot(t.exact);
      if (root !== null) {
        roots.push(exactRoot(root));
        if (!isExactZero(root)) roots.push(exactRoot(negateExact(root)));
      } else {
        const value = Math.sqrt(toExactNumber(t.exact));
        roots.push(approximateRoot(value));
        if (value !== 0) roots.push(approximateRoot(-value));
      }
      continue;
    }
    if (t.approx < 0) continue;
    usable.push(t);
    const value = Math.sqrt(t.approx);
    roots.push(approximateRoot(value));
    if (value !== 0) roots.push(approximateRoot(-value));
  }

  return Object.freeze({
    substitution,
    usableT: Object.freeze(usable),
    roots: Object.freeze(normalizeRoots(roots)),
  });
}

// ───────────────────────── Дробно-рациональное уравнение ────────────────────

/** Одно слагаемое уравнения: числитель и знаменатель — многочлены. */
export interface RationalTerm {
  readonly numerator: Polynomial;
  readonly denominator: Polynomial;
}

/** Уравнение «сумма слагаемых слева = сумма слагаемых справа». */
export interface RationalEquation {
  readonly left: readonly RationalTerm[];
  readonly right: readonly RationalTerm[];
}

export interface RationalEquationSolution {
  /** Запрещённые значения переменной: нули знаменателей исходной записи. */
  readonly restrictions: readonly RealRoot[];
  /** Общий знаменатель, на который умножают обе части (целочисленный). */
  readonly commonDenominator: Polynomial;
  /** Левая часть после умножения на общий знаменатель. */
  readonly leftNumerator: Polynomial;
  /** Правая часть после умножения на общий знаменатель. */
  readonly rightNumerator: Polynomial;
  /** Приведённое целое уравнение: этот многочлен приравнивают к нулю. */
  readonly cleared: Polynomial;
  /** Все корни целого уравнения — кандидаты в корни исходного. */
  readonly candidates: readonly RealRoot[];
  /** Кандидаты, прошедшие проверку на допустимость. */
  readonly roots: readonly RealRoot[];
  /** Кандидаты, запрещённые знаменателем: посторонние корни. */
  readonly extraneous: readonly RealRoot[];
  /** true, если целое уравнение обратилось в тождество 0 = 0. */
  readonly identity: boolean;
  /** true, если найдены все действительные корни целого уравнения. */
  readonly complete: boolean;
}

function termDenominators(equation: RationalEquation): ExactRational[][] {
  return [...equation.left, ...equation.right].map((term) => {
    const denominator = trimExact(exactPolyFrom(trimPolynomial(term.denominator)));
    if (degreeExact(denominator) === -1) {
      throw new RangeError('Знаменатель слагаемого не может быть нулевым многочленом');
    }
    return denominator;
  });
}

function sideNumerator(terms: readonly RationalTerm[], common: ExactPoly): ExactRational[] {
  let total: ExactRational[] = [ZERO];
  for (const term of terms) {
    const denominator = trimExact(exactPolyFrom(trimPolynomial(term.denominator)));
    const multiplier = divideExactPoly(common, denominator);
    total = addExactPoly(total, multiplyExactPoly(exactPolyFrom(trimPolynomial(term.numerator)), multiplier.quotient));
  }
  return total;
}

function denominatorIsZeroAt(denominator: ExactPoly, root: RealRoot): boolean {
  if (root.exact !== null) return isExactZero(evaluateExactPoly(denominator, root.exact));
  return Math.abs(evaluateNumeric(denominator, root.approx)) < EPSILON;
}

/**
 * Решает дробно-рациональное уравнение по школьному алгоритму:
 * общий знаменатель → целое уравнение → корни → проверка на допустимость.
 */
export function solveRationalEquation(equation: RationalEquation): RationalEquationSolution {
  const denominators = termDenominators(equation);

  let common: ExactRational[] = [ONE];
  for (const denominator of denominators) common = lcmExactPoly(common, denominator);

  const leftExact = sideNumerator(equation.left, common);
  const rightExact = sideNumerator(equation.right, common);
  const differenceExact = subtractExactPoly(leftExact, rightExact);

  const scale = contentScale([common, leftExact, rightExact]);
  const commonDenominator = toIntegerPolynomial(scaleExactPoly(common, scale));
  const leftNumerator = toIntegerPolynomial(scaleExactPoly(leftExact, scale));
  const rightNumerator = toIntegerPolynomial(scaleExactPoly(rightExact, scale));
  const cleared = toIntegerPolynomial(differenceExact, true);

  const restrictions = normalizeRoots(
    denominators
      .filter((denominator) => degreeExact(denominator) >= 1)
      .flatMap((denominator) => solvePolynomialEquation(toIntegerPolynomial(denominator)).roots),
  );

  const solution = solvePolynomialEquation(cleared);
  const roots: RealRoot[] = [];
  const extraneous: RealRoot[] = [];
  for (const candidate of solution.roots) {
    const forbidden = denominators.some((denominator) => denominatorIsZeroAt(denominator, candidate));
    (forbidden ? extraneous : roots).push(candidate);
  }

  return Object.freeze({
    restrictions: Object.freeze(restrictions),
    commonDenominator: Object.freeze(commonDenominator),
    leftNumerator: Object.freeze(leftNumerator),
    rightNumerator: Object.freeze(rightNumerator),
    cleared: Object.freeze(cleared),
    candidates: solution.roots,
    roots: Object.freeze(roots),
    extraneous: Object.freeze(extraneous),
    identity: solution.identity,
    complete: solution.complete,
  });
}

// ───────────────────────── Уравнение с двумя переменными ────────────────────

export type CurveKind = 'line' | 'parabola' | 'hyperbola' | 'circle';

export interface LineCurve {
  readonly kind: 'line';
  /** y = kx + b */
  readonly k: number;
  readonly b: number;
}

export interface ParabolaCurve {
  readonly kind: 'parabola';
  /** y = ax² + bx + c, a ≠ 0 */
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

export interface HyperbolaCurve {
  readonly kind: 'hyperbola';
  /** y = k/x, k ≠ 0 */
  readonly k: number;
}

export interface CircleCurve {
  readonly kind: 'circle';
  /** x² + y² = r², r > 0 */
  readonly r: number;
}

export type CurveSpec = LineCurve | ParabolaCurve | HyperbolaCurve | CircleCurve;

function assertCurve(spec: CurveSpec): void {
  const numbers = spec.kind === 'line'
    ? [spec.k, spec.b]
    : spec.kind === 'parabola'
      ? [spec.a, spec.b, spec.c]
      : spec.kind === 'hyperbola'
        ? [spec.k]
        : [spec.r];
  for (const value of numbers) {
    if (!Number.isFinite(value)) throw new TypeError('Коэффициенты линии должны быть конечными числами');
  }
  if (spec.kind === 'parabola' && spec.a === 0) throw new RangeError('У параболы старший коэффициент не равен нулю');
  if (spec.kind === 'hyperbola' && spec.k === 0) throw new RangeError('У гиперболы коэффициент k не равен нулю');
  if (spec.kind === 'circle' && !(spec.r > 0)) throw new RangeError('Радиус окружности должен быть положительным');
}

function numberText(value: number): string {
  return formatExactRussian(parseExact(value));
}

function signedTail(value: number, body: string): string {
  const magnitude = Math.abs(value);
  const sign = value < 0 ? '−' : '+';
  const shown = body === '' ? numberText(magnitude) : magnitude === 1 ? body : `${numberText(magnitude)}${body}`;
  return ` ${sign} ${shown}`;
}

function leadingTerm(value: number, body: string): string {
  if (body === '') return numberText(value);
  if (value === 1) return body;
  if (value === -1) return `−${body}`;
  return `${numberText(value)}${body}`;
}

/** Запись уравнения линии обычным текстом — для подписей лаборатории. */
export function curveText(spec: CurveSpec): string {
  assertCurve(spec);
  switch (spec.kind) {
    case 'line': {
      if (spec.k === 0) return `y = ${numberText(spec.b)}`;
      return `y = ${leadingTerm(spec.k, 'x')}${spec.b === 0 ? '' : signedTail(spec.b, '')}`;
    }
    case 'parabola': {
      const head = `y = ${leadingTerm(spec.a, 'x²')}`;
      const middle = spec.b === 0 ? '' : signedTail(spec.b, 'x');
      const tail = spec.c === 0 ? '' : signedTail(spec.c, '');
      return `${head}${middle}${tail}`;
    }
    case 'hyperbola':
      return `y = ${numberText(spec.k)}/x`;
    default:
      return `x² + y² = ${numberText(spec.r * spec.r)}`;
  }
}

/** Название линии: что именно нарисовано. */
export function curveShape(spec: CurveSpec): string {
  assertCurve(spec);
  switch (spec.kind) {
    case 'line':
      return 'прямая';
    case 'parabola':
      return 'парабола';
    case 'hyperbola':
      return 'гипербола из двух ветвей';
    default:
      return `окружность с центром в начале координат и радиусом ${numberText(spec.r)}`;
  }
}

/** Является ли линия графиком функции y = f(x). */
export function isFunctionCurve(spec: CurveSpec): boolean {
  assertCurve(spec);
  return spec.kind !== 'circle';
}

/** Значение y по x, если линия — график функции; иначе null. */
export function curveValue(spec: CurveSpec, x: number): number | null {
  assertCurve(spec);
  if (!Number.isFinite(x)) return null;
  switch (spec.kind) {
    case 'line':
      return spec.k * x + spec.b;
    case 'parabola':
      return (spec.a * x + spec.b) * x + spec.c;
    case 'hyperbola':
      return x === 0 ? null : spec.k / x;
    default:
      return null;
  }
}

/** Точная проверка: обращает ли пара (x; y) уравнение в верное равенство. */
export function satisfiesCurve(spec: CurveSpec, x: ExactInput, y: ExactInput): boolean {
  assertCurve(spec);
  const px = parseExact(x);
  const py = parseExact(y);
  switch (spec.kind) {
    case 'line':
      return compareExact(py, addExact(multiplyExact(parseExact(spec.k), px), parseExact(spec.b))) === 0;
    case 'parabola': {
      const value = addExact(
        multiplyExact(addExact(multiplyExact(parseExact(spec.a), px), parseExact(spec.b)), px),
        parseExact(spec.c),
      );
      return compareExact(py, value) === 0;
    }
    case 'hyperbola':
      if (isExactZero(px)) return false;
      return compareExact(multiplyExact(px, py), parseExact(spec.k)) === 0;
    default:
      return compareExact(
        addExact(multiplyExact(px, px), multiplyExact(py, py)),
        multiplyExact(parseExact(spec.r), parseExact(spec.r)),
      ) === 0;
  }
}

// ───────────────────────── Система двух уравнений ───────────────────────────

export interface CurvePoint {
  readonly x: RealRoot;
  readonly y: RealRoot;
}

export interface CurveSystemSolution {
  /**
   * 'points' — конечный список общих точек (возможно пустой);
   * 'infinite' — линии совпадают;
   * 'unsupported' — такая пара линий выходит за рамки ядра главы.
   */
  readonly kind: 'points' | 'infinite' | 'unsupported';
  readonly points: readonly CurvePoint[];
  /** Коэффициенты уравнения ax² + bx + c = 0, к которому свелась система. */
  readonly reduced: { readonly a: ExactRational; readonly b: ExactRational; readonly c: ExactRational } | null;
  readonly discriminant: ExactRational | null;
}

function curveAsFraction(spec: CurveSpec): { numerator: ExactRational[]; denominator: ExactRational[] } | null {
  switch (spec.kind) {
    case 'line':
      return { numerator: exactPolyFrom([spec.b, spec.k]), denominator: [ONE] };
    case 'parabola':
      return { numerator: exactPolyFrom([spec.c, spec.b, spec.a]), denominator: [ONE] };
    case 'hyperbola':
      return { numerator: exactPolyFrom([spec.k]), denominator: [ZERO, ONE] };
    default:
      return null;
  }
}

function exactCurveValue(spec: CurveSpec, x: ExactRational): ExactRational | null {
  switch (spec.kind) {
    case 'line':
      return addExact(multiplyExact(parseExact(spec.k), x), parseExact(spec.b));
    case 'parabola':
      return addExact(
        multiplyExact(addExact(multiplyExact(parseExact(spec.a), x), parseExact(spec.b)), x),
        parseExact(spec.c),
      );
    case 'hyperbola':
      return isExactZero(x) ? null : divideExact(parseExact(spec.k), x);
    default:
      return null;
  }
}

function yProvider(first: CurveSpec, second: CurveSpec): CurveSpec | null {
  for (const kind of ['line', 'parabola', 'hyperbola'] as const) {
    if (first.kind === kind) return first;
    if (second.kind === kind) return second;
  }
  return null;
}

function pointFromX(spec: CurveSpec, x: RealRoot): CurvePoint | null {
  if (x.exact !== null) {
    const y = exactCurveValue(spec, x.exact);
    if (y === null) return null;
    return Object.freeze({ x, y: exactRoot(y) });
  }
  const y = curveValue(spec, x.approx);
  if (y === null || !Number.isFinite(y)) return null;
  return Object.freeze({ x, y: approximateRoot(y) });
}

/**
 * Решает систему двух уравнений с двумя переменными.
 *
 * Поддержаны пары, которые сводятся к квадратному уравнению: прямая и прямая,
 * прямая или парабола с параболой, гипербола с прямой, окружность с прямой.
 * Для остальных пар возвращается kind = 'unsupported' — ядро не притворяется,
 * что умеет больше, чем умеет.
 */
export function solveCurveSystem(first: CurveSpec, second: CurveSpec): CurveSystemSolution {
  assertCurve(first);
  assertCurve(second);

  const empty = Object.freeze({
    kind: 'unsupported' as const,
    points: Object.freeze([]),
    reduced: null,
    discriminant: null,
  });

  const circles = [first, second].filter((spec) => spec.kind === 'circle');
  if (circles.length === 2) {
    const [left, right] = circles as [CircleCurve, CircleCurve];
    return Object.freeze({
      kind: left.r === right.r ? ('infinite' as const) : ('points' as const),
      points: Object.freeze([]),
      reduced: null,
      discriminant: null,
    });
  }

  let poly: ExactRational[];
  let forbidden: ExactRational[] = [ONE];

  if (circles.length === 1) {
    const circle = circles[0] as CircleCurve;
    const other = first.kind === 'circle' ? second : first;
    if (other.kind !== 'line') return empty;
    const k = parseExact(other.k);
    const b = parseExact(other.b);
    const r = parseExact(circle.r);
    poly = trimExact([
      subtractExact(multiplyExact(b, b), multiplyExact(r, r)),
      multiplyExact(parseExact(2), multiplyExact(k, b)),
      addExact(ONE, multiplyExact(k, k)),
    ]);
  } else {
    const left = curveAsFraction(first);
    const right = curveAsFraction(second);
    if (left === null || right === null) return empty;
    poly = subtractExactPoly(
      multiplyExactPoly(left.numerator, right.denominator),
      multiplyExactPoly(right.numerator, left.denominator),
    );
    forbidden = multiplyExactPoly(left.denominator, right.denominator);
  }

  const degree = degreeExact(poly);
  if (degree > 2) return empty;
  if (degree === -1) {
    return Object.freeze({
      kind: 'infinite' as const,
      points: Object.freeze([]),
      reduced: null,
      discriminant: null,
    });
  }

  const outcome = solveQuadraticExact(poly[2] ?? ZERO, poly[1] ?? ZERO, poly[0] ?? ZERO);
  const provider = yProvider(first, second);
  const points: CurvePoint[] = [];

  if (provider !== null && outcome.kind !== 'all') {
    for (const root of outcome.roots) {
      const blocked = root.exact !== null
        ? isExactZero(evaluateExactPoly(forbidden, root.exact))
        : Math.abs(evaluateNumeric(forbidden, root.approx)) < EPSILON;
      if (blocked) continue;
      const point = pointFromX(provider, root);
      if (point !== null) points.push(point);
    }
  }

  return Object.freeze({
    kind: outcome.kind === 'all' ? ('infinite' as const) : ('points' as const),
    points: Object.freeze(points),
    reduced: Object.freeze({
      a: poly[2] ?? ZERO,
      b: poly[1] ?? ZERO,
      c: poly[0] ?? ZERO,
    }),
    discriminant: outcome.discriminant,
  });
}

// ───────────────────────── Геометрия рисунка ────────────────────────────────

export interface PlotSegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** Отсечение отрезка по квадрату [−extent; extent]² алгоритмом Лианга — Барски. */
function clipSegment(x1: number, y1: number, x2: number, y2: number, extent: number): PlotSegment | null {
  if (![x1, y1, x2, y2].every((value) => Number.isFinite(value))) return null;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 + extent, extent - x1, y1 + extent, extent - y1];
  let t0 = 0;
  let t1 = 1;

  for (let index = 0; index < 4; index += 1) {
    const pi = p[index]!;
    const qi = q[index]!;
    if (pi === 0) {
      if (qi < 0) return null;
      continue;
    }
    const ratio = qi / pi;
    if (pi < 0) {
      if (ratio > t1) return null;
      if (ratio > t0) t0 = ratio;
    } else {
      if (ratio < t0) return null;
      if (ratio < t1) t1 = ratio;
    }
  }

  return Object.freeze({
    x1: x1 + t0 * dx,
    y1: y1 + t0 * dy,
    x2: x1 + t1 * dx,
    y2: y1 + t1 * dy,
  });
}

function clipPolyline(points: readonly { x: number; y: number }[], extent: number): PlotSegment[] {
  const segments: PlotSegment[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const clipped = clipSegment(from.x, from.y, to.x, to.y, extent);
    if (clipped !== null) segments.push(clipped);
  }
  return segments;
}

function sampleFunction(spec: CurveSpec, from: number, to: number, samples: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index < samples; index += 1) {
    const x = from + ((to - from) * index) / (samples - 1);
    const y = curveValue(spec, x);
    if (y === null || !Number.isFinite(y)) continue;
    points.push({ x, y });
  }
  return points;
}

/**
 * Отрезки ломаной, приближающей линию внутри окна [−extent; extent]².
 * Все координаты вычислены по формуле линии, поэтому рисунок честный.
 */
export function curveSegments(spec: CurveSpec, extent: number, samples = 241): PlotSegment[] {
  assertCurve(spec);
  if (!(extent > 0) || !Number.isFinite(extent)) throw new RangeError('Полуразмер окна должен быть положительным числом');
  if (!Number.isInteger(samples) || samples < 8 || samples > 2001) {
    throw new RangeError('Число узлов должно быть целым от 8 до 2001');
  }

  if (spec.kind === 'line') {
    const segment = clipLineToBox(spec.k, spec.b, extent);
    return segment === null ? [] : [Object.freeze({ x1: segment.x1, y1: segment.y1, x2: segment.x2, y2: segment.y2 })];
  }

  if (spec.kind === 'parabola') {
    return clipPolyline(sampleFunction(spec, -extent, extent, samples), extent);
  }

  if (spec.kind === 'hyperbola') {
    const gap = extent / samples;
    return [
      ...clipPolyline(sampleFunction(spec, -extent, -gap, samples), extent),
      ...clipPolyline(sampleFunction(spec, gap, extent, samples), extent),
    ];
  }

  const points: { x: number; y: number }[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const angle = (2 * Math.PI * index) / samples;
    points.push({ x: spec.r * Math.cos(angle), y: spec.r * Math.sin(angle) });
  }
  return clipPolyline(points, extent);
}

// ───────────────────────── Оформление ответов ───────────────────────────────

/** Русская запись приближения: запятая и типографский минус. */
export function formatApproximate(value: number, digits = 2): string {
  if (!Number.isFinite(value)) throw new TypeError('Приближаемое значение должно быть конечным числом');
  if (!Number.isInteger(digits) || digits < 0 || digits > 10) {
    throw new RangeError('Число знаков после запятой должно быть целым от 0 до 10');
  }
  const fixed = value.toFixed(digits);
  if (Number(fixed) === 0) return '0';
  const trimmed = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return trimmed.replace('.', ',').replace('-', '−');
}

/** Текст корня: точная дробь либо приближение со знаком ≈. */
export function formatRoot(root: RealRoot, digits = 2): string {
  return root.exact === null ? `≈ ${formatApproximate(root.approx, digits)}` : formatExactRussian(root.exact);
}

/** Текст списка корней; пустой список читается как «корней нет». */
export function formatRootList(roots: readonly RealRoot[], digits = 2): string {
  if (roots.length === 0) return 'корней нет';
  return roots.map((root) => formatRoot(root, digits)).join('; ');
}

/** Текст пары (x; y). */
export function formatPoint(point: CurvePoint, digits = 2): string {
  return `(${formatRoot(point.x, digits)}; ${formatRoot(point.y, digits)})`;
}

/** Текст списка решений системы. */
export function formatPointList(points: readonly CurvePoint[], digits = 2): string {
  if (points.length === 0) return 'решений нет';
  return points.map((point) => formatPoint(point, digits)).join('; ');
}

/** Запись целого уравнения «многочлен = 0». */
export function formatPolynomialEquation(polynomial: Polynomial, variable = 'x'): string {
  return `${formatPolynomial(polynomial, variable)} = 0`;
}

/**
 * Уравнение, к которому свелась система, обычной строкой: «x² − x − 2 = 0».
 * Коэффициенты точные, поэтому дробные значения печатаются дробью.
 */
export function formatReducedEquation(
  reduced: CurveSystemSolution['reduced'],
  variable = 'x',
): string {
  if (reduced === null) return 'уравнение не составлено';

  const parts: { power: number; value: ExactRational }[] = [
    { power: 2, value: reduced.a },
    { power: 1, value: reduced.b },
    { power: 0, value: reduced.c },
  ];

  const pieces: string[] = [];
  for (const { power, value } of parts) {
    if (isExactZero(value)) continue;
    const negative = compareExact(value, ZERO) < 0;
    const magnitude = negative ? negateExact(value) : value;
    const body = power === 0
      ? formatExactRussian(magnitude)
      : `${compareExact(magnitude, ONE) === 0 ? '' : formatExactRussian(magnitude)}${variable}${power === 2 ? '²' : ''}`;
    if (pieces.length === 0) pieces.push(negative ? `−${body}` : body);
    else pieces.push(`${negative ? '−' : '+'} ${body}`);
  }

  return `${pieces.length === 0 ? '0' : pieces.join(' ')} = 0`;
}

/** Короткая фраза о том, сколько общих точек у двух линий и почему. */
export function describeCurveSystem(solution: CurveSystemSolution): string {
  if (solution.kind === 'unsupported') return 'Такую пару линий ядро главы не разбирает.';
  if (solution.kind === 'infinite') return 'Линии совпадают: общих точек бесконечно много.';
  if (solution.points.length === 0) return 'Общих точек нет: система решений не имеет.';
  if (solution.points.length === 1) return 'Общая точка ровно одна — линии касаются или пересекаются один раз.';
  return `Общих точек ${solution.points.length}: столько же решений и у системы.`;
}

/**
 * Совпадает ли набор корней с ответом ученика. Сравнение точное, поэтому
 * уравнения с иррациональными корнями честно возвращают false: такой ответ
 * записывается не списком дробей.
 */
export function matchesRootList(
  roots: readonly RealRoot[],
  answer: readonly ExactRational[],
): boolean {
  if (roots.some((root) => root.exact === null)) return false;
  const expected = roots.map((root) => root.exact as ExactRational);
  if (expected.length !== answer.length) return false;
  const sorted = [...answer].sort((left, right) => compareExact(left, right));
  return expected.every((value, index) => compareExact(value, sorted[index]!) === 0);
}

/** Проверяет пару (x; y) сразу в обоих уравнениях системы. */
export function satisfiesSystem(
  first: CurveSpec,
  second: CurveSpec,
  x: ExactInput,
  y: ExactInput,
): boolean {
  return satisfiesCurve(first, x, y) && satisfiesCurve(second, x, y);
}

// ───────────────────────── Наборы примеров для лабораторий ──────────────────

export type EquationPresetKind = 'polynomial' | 'rational';

export interface EquationPreset {
  readonly id: string;
  readonly kind: EquationPresetKind;
  readonly title: string;
  /** Как уравнение записано в условии. */
  readonly label: string;
  /** Целое уравнение: многочлен, приравненный к нулю. */
  readonly polynomial?: Polynomial;
  /** Дробно-рациональное уравнение по слагаемым. */
  readonly equation?: RationalEquation;
  readonly note: string;
}

export const EQUATION_PRESETS: readonly EquationPreset[] = Object.freeze([
  {
    id: 'cube-factor',
    kind: 'polynomial',
    title: 'Вынесение общего множителя',
    label: 'x³ − 9x = 0',
    polynomial: [0, -9, 0, 1],
    note: 'Общий множитель x даёт корень 0, скобка — разность квадратов.',
  },
  {
    id: 'grouping',
    kind: 'polynomial',
    title: 'Разложение группировкой',
    label: 'x³ − 2x² − x + 2 = 0',
    polynomial: [2, -1, -2, 1],
    note: 'Группировка даёт (x − 2)(x² − 1): три корня без всякой формулы.',
  },
  {
    id: 'product',
    kind: 'polynomial',
    title: 'Произведение равно нулю',
    label: '(x² − 4)(x + 5) = 0',
    polynomial: [-20, -4, 5, 1],
    note: 'Произведение равно нулю тогда и только тогда, когда нулю равен хотя бы один множитель.',
  },
  {
    id: 'biquadratic',
    kind: 'polynomial',
    title: 'Замена t = x²',
    label: 'x⁴ − 13x² + 36 = 0',
    polynomial: [36, 0, -13, 0, 1],
    note: 'После замены остаётся t² − 13t + 36 = 0; каждое положительное t даёт два значения x.',
  },
  {
    id: 'biquadratic-partial',
    kind: 'polynomial',
    title: 'Замена с отбраковкой',
    label: 'x⁴ + 3x² − 4 = 0',
    polynomial: [-4, 0, 3, 0, 1],
    note: 'Для t получается 1 и −4, но отрицательное t обратной замены не даёт.',
  },
  {
    id: 'shared-denominator',
    kind: 'rational',
    title: 'Посторонний корень',
    label: 'x/(x + 1) + 2/(x − 1) = 2/(x² − 1)',
    equation: {
      left: [
        { numerator: [0, 1], denominator: [1, 1] },
        { numerator: [2], denominator: [-1, 1] },
      ],
      right: [{ numerator: [2], denominator: [-1, 0, 1] }],
    },
    note: 'Один из двух кандидатов совпадает с запрещённым значением и корнем не становится.',
  },
  {
    id: 'work-pair',
    kind: 'rational',
    title: 'Уравнение из задачи о работе',
    label: '1/x + 1/(x + 3) = 1/2',
    equation: {
      left: [
        { numerator: [1], denominator: [0, 1] },
        { numerator: [1], denominator: [3, 1] },
      ],
      right: [{ numerator: [1], denominator: [2] }],
    },
    note: 'Оба корня допустимы, но смыслу задачи отвечает только положительный.',
  },
  {
    id: 'empty-answer',
    kind: 'rational',
    title: 'Ответ «корней нет»',
    label: '1/(x − 2) + 1/(x + 2) = 4/(x² − 4)',
    equation: {
      left: [
        { numerator: [1], denominator: [-2, 1] },
        { numerator: [1], denominator: [2, 1] },
      ],
      right: [{ numerator: [4], denominator: [-4, 0, 1] }],
    },
    note: 'Единственный кандидат запрещён знаменателем, поэтому корней нет.',
  },
  {
    id: 'contradiction',
    kind: 'rational',
    title: 'Переменная исчезла',
    label: '(x + 2)/(x − 1) = (x + 4)/(x + 1)',
    equation: {
      left: [{ numerator: [2, 1], denominator: [-1, 1] }],
      right: [{ numerator: [4, 1], denominator: [1, 1] }],
    },
    note: 'После умножения на общий знаменатель остаётся неверное числовое равенство.',
  },
  {
    id: 'cancel-trap',
    kind: 'rational',
    title: 'Ловушка сокращения',
    label: '(x² − 9)/(x − 3) = 6',
    equation: {
      left: [{ numerator: [-9, 0, 1], denominator: [-3, 1] }],
      right: [{ numerator: [6], denominator: [1] }],
    },
    note: 'Дробь сокращается до x + 3, но точка x = 3 остаётся выколотой.',
  },
  {
    id: 'two-roots',
    kind: 'rational',
    title: 'Два допустимых корня',
    label: '6/x − 6/(x + 1) = 1',
    equation: {
      left: [
        { numerator: [6], denominator: [0, 1] },
        { numerator: [-6], denominator: [1, 1] },
      ],
      right: [{ numerator: [1], denominator: [1] }],
    },
    note: 'Оба кандидата проходят проверку: посторонних корней здесь нет.',
  },
]);

export function getEquationPreset(id: string): EquationPreset {
  const preset = EQUATION_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new RangeError(`Неизвестный пример уравнения: ${id}`);
  return preset;
}

export interface SystemPreset {
  readonly id: string;
  readonly title: string;
  readonly first: CurveSpec;
  readonly second: CurveSpec;
  readonly extent: number;
  readonly note: string;
}

export const SYSTEM_PRESETS: readonly SystemPreset[] = Object.freeze([
  {
    id: 'parabola-line',
    title: 'Парабола и прямая',
    first: { kind: 'parabola', a: 1, b: 0, c: 0 },
    second: { kind: 'line', k: 1, b: 2 },
    extent: 6,
    note: 'Подстановка даёт x² = x + 2, то есть x² − x − 2 = 0.',
  },
  {
    id: 'hyperbola-line',
    title: 'Гипербола и прямая',
    first: { kind: 'hyperbola', k: 6 },
    second: { kind: 'line', k: 1, b: 1 },
    extent: 8,
    note: 'После умножения на x остаётся x² + x − 6 = 0; значение x = 0 запрещено.',
  },
  {
    id: 'circle-line',
    title: 'Окружность и прямая',
    first: { kind: 'circle', r: 5 },
    second: { kind: 'line', k: 1, b: 1 },
    extent: 7,
    note: 'Подстановка y = x + 1 в x² + y² = 25 даёт 2x² + 2x − 24 = 0.',
  },
  {
    id: 'line-line',
    title: 'Две прямые',
    first: { kind: 'line', k: 2, b: -1 },
    second: { kind: 'line', k: -1, b: 5 },
    extent: 7,
    note: 'Знакомый случай из 7 класса: одна общая точка.',
  },
  {
    id: 'tangent',
    title: 'Касание: одно решение',
    first: { kind: 'parabola', a: 1, b: 0, c: 0 },
    second: { kind: 'line', k: 2, b: -1 },
    extent: 6,
    note: 'Дискриминант равен нулю, и общая точка ровно одна.',
  },
  {
    id: 'no-solution',
    title: 'Решений нет',
    first: { kind: 'parabola', a: 1, b: 0, c: 0 },
    second: { kind: 'line', k: -1, b: -1 },
    extent: 6,
    note: 'x² + x + 1 = 0 имеет отрицательный дискриминант — линии не пересекаются.',
  },
  {
    id: 'irrational',
    title: 'Иррациональные координаты',
    first: { kind: 'parabola', a: 1, b: 0, c: -2 },
    second: { kind: 'parabola', a: -1, b: 0, c: 4 },
    extent: 7,
    note: 'Общие точки существуют, но их абсциссы не выражаются обыкновенной дробью.',
  },
]);

export function getSystemPreset(id: string): SystemPreset {
  const preset = SYSTEM_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new RangeError(`Неизвестный пример системы: ${id}`);
  return preset;
}
