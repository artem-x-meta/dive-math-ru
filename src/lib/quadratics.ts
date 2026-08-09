/**
 * Вычислительное ядро главы «Квадратные уравнения» (8 класс).
 *
 * Все функции работают с целыми коэффициентами и считают точно:
 * дискриминант вычисляется без потери точности, рациональные корни
 * возвращаются несократимыми дробями, иррациональные — честной парой
 * «точная форма + десятичное приближение».
 */

import { divideExact, formatExactRussian } from './exactRational';

export interface Rational {
  numerator: number;
  denominator: number;
}

export type RootCount = 0 | 1 | 2;

export interface QuadraticRoot {
  /** Несократимая дробь, если корень рационален (D — точный квадрат), иначе null. */
  exact: Rational | null;
  /** Числовое значение корня; для рационального корня совпадает с exact. */
  approx: number;
}

export interface QuadraticSolution {
  a: number;
  b: number;
  c: number;
  discriminant: number;
  /** true, если D ≥ 0 и является точным квадратом целого числа. */
  isPerfectSquareDiscriminant: boolean;
  rootCount: RootCount;
  /** Корни по возрастанию; при D = 0 список из одного корня, при D < 0 — пустой. */
  roots: QuadraticRoot[];
}

export interface FactorPair {
  first: number;
  second: number;
  sum: number;
}

/** Вид квадратного уравнения по «пустым» коэффициентам. */
export type QuadraticKind = 'pure' | 'no-linear' | 'no-constant' | 'full';

/** Запись a(x + shift)² + constant, полученная выделением полного квадрата. */
export interface CompletedSquare {
  leading: number;
  shift: Rational;
  constant: Rational;
}

export interface Point {
  x: number;
  y: number;
}

export interface PlotBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} должно быть безопасным целым числом`);
  }
}

function assertQuadratic(a: number, b: number, c: number): void {
  assertSafeInteger(a, 'Старший коэффициент a');
  assertSafeInteger(b, 'Коэффициент b');
  assertSafeInteger(c, 'Свободный член c');
  if (a === 0) {
    throw new RangeError('Уравнение не квадратное: старший коэффициент a не может быть равен нулю');
  }
}

function toSafeNumber(value: bigint, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${label} выходит за диапазон безопасных целых чисел`);
  }
  return result;
}

function gcd(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) {
    [left, right] = [right, left % right];
  }
  return left;
}

/** Приводит дробь к несократимому виду со знаменателем больше нуля. */
export function normalizeRational(numerator: number, denominator: number): Rational {
  assertSafeInteger(numerator, 'Числитель');
  assertSafeInteger(denominator, 'Знаменатель');
  if (denominator === 0) {
    throw new RangeError('Знаменатель дроби не может быть равен нулю');
  }
  if (numerator === 0) return { numerator: 0, denominator: 1 };

  const divisor = gcd(numerator, denominator);
  let reducedNumerator = numerator / divisor;
  let reducedDenominator = denominator / divisor;
  if (reducedDenominator < 0) {
    reducedNumerator = -reducedNumerator;
    reducedDenominator = -reducedDenominator;
  }
  return { numerator: reducedNumerator, denominator: reducedDenominator };
}

/** Дискриминант D = b² − 4ac, вычисленный точно. */
export function discriminant(a: number, b: number, c: number): number {
  assertQuadratic(a, b, c);
  const exact = BigInt(b) * BigInt(b) - 4n * BigInt(a) * BigInt(c);
  return toSafeNumber(exact, 'Дискриминант');
}

/** Число корней по знаку дискриминанта. */
export function rootCountFromDiscriminant(value: number): RootCount {
  assertSafeInteger(value, 'Дискриминант');
  if (value > 0) return 2;
  if (value === 0) return 1;
  return 0;
}

/** Точный целый корень из n, если n — точный квадрат, иначе null. */
export function exactIntegerSquareRoot(value: number): number | null {
  assertSafeInteger(value, 'Подкоренное число');
  if (value < 0) return null;
  const candidate = Math.round(Math.sqrt(value));
  for (const root of [candidate - 1, candidate, candidate + 1]) {
    if (root >= 0 && root * root === value) return root;
  }
  return null;
}

/** Значение ax² + bx + c в точке x (для честных графиков). */
export function evaluateQuadratic(a: number, b: number, c: number, x: number): number {
  assertQuadratic(a, b, c);
  if (!Number.isFinite(x)) {
    throw new TypeError('Аргумент x должен быть конечным числом');
  }
  return (a * x + b) * x + c;
}

/**
 * Решает ax² + bx + c = 0 с целыми коэффициентами.
 * При D — точном квадрате корни возвращаются несократимыми дробями,
 * иначе — десятичными приближениями формулы (−b ± √D) / (2a).
 */
export function solveQuadratic(a: number, b: number, c: number): QuadraticSolution {
  const d = discriminant(a, b, c);
  const base: Omit<QuadraticSolution, 'rootCount' | 'roots' | 'isPerfectSquareDiscriminant'> = {
    a,
    b,
    c,
    discriminant: d,
  };

  if (d < 0) {
    return { ...base, isPerfectSquareDiscriminant: false, rootCount: 0, roots: [] };
  }

  const exactRoot = exactIntegerSquareRoot(d);
  if (exactRoot !== null) {
    const first = normalizeRational(-b - exactRoot, 2 * a);
    const second = normalizeRational(-b + exactRoot, 2 * a);
    const roots: QuadraticRoot[] = d === 0
      ? [{ exact: first, approx: first.numerator / first.denominator }]
      : [first, second]
          .map((exact) => ({ exact, approx: exact.numerator / exact.denominator }))
          .sort((left, right) => left.approx - right.approx);
    return {
      ...base,
      isPerfectSquareDiscriminant: true,
      rootCount: d === 0 ? 1 : 2,
      roots,
    };
  }

  const sqrtD = Math.sqrt(d);
  const roots: QuadraticRoot[] = [
    { exact: null, approx: (-b - sqrtD) / (2 * a) },
    { exact: null, approx: (-b + sqrtD) / (2 * a) },
  ].sort((left, right) => left.approx - right.approx);
  return { ...base, isPerfectSquareDiscriminant: false, rootCount: 2, roots };
}

/** Вершина параболы y = ax² + bx + c: x₀ = −b/(2a), y₀ = −D/(4a). Точно, дробями. */
export function vertex(a: number, b: number, c: number): { x: Rational; y: Rational } {
  const d = discriminant(a, b, c);
  return {
    x: normalizeRational(-b, 2 * a),
    y: normalizeRational(-d, 4 * a),
  };
}

/** Сумма корней по Виету: x₁ + x₂ = −b/a (при D ≥ 0). */
export function vietaSum(a: number, b: number, c: number): Rational {
  assertQuadratic(a, b, c);
  return normalizeRational(-b, a);
}

/** Произведение корней по Виету: x₁ · x₂ = c/a (при D ≥ 0). */
export function vietaProduct(a: number, b: number, c: number): Rational {
  assertQuadratic(a, b, c);
  return normalizeRational(c, a);
}

/**
 * Обратная теорема Виета для приведённого уравнения x² + px + q = 0:
 * проверяет пару чисел (x₁; x₂) точным сравнением суммы и произведения.
 */
export function checkVietaPair(p: number, q: number, firstRoot: number, secondRoot: number): boolean {
  assertSafeInteger(p, 'Коэффициент p');
  assertSafeInteger(q, 'Свободный член q');
  assertSafeInteger(firstRoot, 'Первый корень');
  assertSafeInteger(secondRoot, 'Второй корень');
  const sum = BigInt(firstRoot) + BigInt(secondRoot);
  const product = BigInt(firstRoot) * BigInt(secondRoot);
  return sum === BigInt(-p) && product === BigInt(q);
}

/** Составляет приведённое уравнение x² + px + q = 0 по паре целых корней. */
export function monicFromRoots(firstRoot: number, secondRoot: number): { p: number; q: number } {
  assertSafeInteger(firstRoot, 'Первый корень');
  assertSafeInteger(secondRoot, 'Второй корень');
  const p = toSafeNumber(-(BigInt(firstRoot) + BigInt(secondRoot)), 'Коэффициент p');
  const q = toSafeNumber(BigInt(firstRoot) * BigInt(secondRoot), 'Свободный член q');
  return { p, q };
}

/**
 * Все пары целых чисел (m; n), m ≤ n, с произведением q ≠ 0 и их суммы —
 * материал для подбора корней по Виету. Пары отсортированы по сумме.
 */
export function factorPairs(q: number): FactorPair[] {
  assertSafeInteger(q, 'Свободный член q');
  if (q === 0) {
    throw new RangeError('Свободный член q не может быть равен нулю: у нуля бесконечно много пар делителей');
  }
  const pairs: FactorPair[] = [];
  const limit = Math.floor(Math.sqrt(Math.abs(q)));
  for (let divisor = 1; divisor <= limit; divisor += 1) {
    if (Math.abs(q) % divisor !== 0) continue;
    const partner = Math.abs(q) / divisor;
    if (q > 0) {
      pairs.push({ first: divisor, second: partner, sum: divisor + partner });
      pairs.push({ first: -partner, second: -divisor, sum: -divisor - partner });
    } else {
      pairs.push({ first: -divisor, second: partner, sum: partner - divisor });
      if (divisor !== partner) {
        pairs.push({ first: -partner, second: divisor, sum: divisor - partner });
      }
    }
  }
  return pairs.sort((left, right) => left.sum - right.sum || left.first - right.first);
}

/**
 * Пара целых корней приведённого уравнения x² + px + q = 0, если она существует.
 * Возвращает корни по возрастанию, иначе null. Случай q = 0 даёт корни 0 и −p.
 */
export function integerRootPair(p: number, q: number): readonly [number, number] | null {
  assertSafeInteger(p, 'Коэффициент p');
  assertSafeInteger(q, 'Свободный член q');
  const solution = solveQuadratic(1, p, q);
  if (solution.rootCount === 0) return null;
  const values = solution.roots.map((root) =>
    root.exact !== null && root.exact.denominator === 1 ? root.exact.numerator : null,
  );
  if (values.some((value) => value === null)) return null;
  const [first, second] = values as number[];
  return solution.rootCount === 1 ? [first!, first!] : [first!, second!];
}

/** Вид уравнения: полное или одно из трёх неполных. */
export function quadraticKind(a: number, b: number, c: number): QuadraticKind {
  assertQuadratic(a, b, c);
  if (b === 0 && c === 0) return 'pure';
  if (b === 0) return 'no-linear';
  if (c === 0) return 'no-constant';
  return 'full';
}

/**
 * Выделение полного квадрата: ax² + bx + c = a(x + b/(2a))² − D/(4a).
 * Обе дроби возвращаются точно, в несократимом виде.
 */
export function completeSquare(a: number, b: number, c: number): CompletedSquare {
  const d = discriminant(a, b, c);
  return {
    leading: a,
    shift: normalizeRational(b, 2 * a),
    constant: normalizeRational(-d, 4 * a),
  };
}

/** Русская запись дроби: целое, конечная десятичная или несократимая дробь. */
export function formatRational(value: Rational): string {
  if (!Number.isSafeInteger(value.numerator) || !Number.isSafeInteger(value.denominator)) {
    throw new TypeError('Дробь должна состоять из безопасных целых чисел');
  }
  if (value.denominator === 0) {
    throw new RangeError('Знаменатель дроби не может быть равен нулю');
  }
  return formatExactRussian(divideExact(value.numerator, value.denominator));
}

/** Русская запись приближённого значения: минус — типографский, разделитель — запятая. */
export function formatApproximate(value: number, digits = 2): string {
  if (!Number.isFinite(value)) {
    throw new TypeError('Приближаемое значение должно быть конечным числом');
  }
  if (!Number.isInteger(digits) || digits < 0 || digits > 10) {
    throw new RangeError('Число знаков после запятой должно быть целым от 0 до 10');
  }
  const fixed = value.toFixed(digits);
  if (Number(fixed) === 0) return '0';
  const trimmed = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return trimmed.replace('.', ',').replace('-', '−');
}

/** Текст корня: точная дробь, если она есть, иначе приближение со знаком ≈. */
export function describeRoot(root: QuadraticRoot, digits = 2): string {
  return root.exact === null
    ? `≈ ${formatApproximate(root.approx, digits)}`
    : formatRational(root.exact);
}

/**
 * Куски параболы y = ax² + bx + c, попадающие в прямоугольное окно.
 * Точки на границе окна добавляются линейной интерполяцией между соседними
 * узлами сетки, поэтому при большом sampleCount обрезка визуально точна.
 */
export function parabolaSegments(
  a: number,
  b: number,
  c: number,
  box: PlotBox,
  sampleCount = 241,
): Point[][] {
  assertQuadratic(a, b, c);
  if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 4001) {
    throw new RangeError('Число узлов должно быть целым от 2 до 4001');
  }
  if (!(box.xMin < box.xMax) || !(box.yMin < box.yMax)) {
    throw new RangeError('Окно графика должно иметь положительные ширину и высоту');
  }

  const inside = (y: number) => y >= box.yMin && y <= box.yMax;
  const clampY = (y: number) => Math.min(box.yMax, Math.max(box.yMin, y));
  const crossing = (from: Point, to: Point): Point => {
    const bound = to.y > box.yMax ? box.yMax : box.yMin;
    const span = to.y - from.y;
    if (span === 0) return { x: to.x, y: clampY(to.y) };
    const share = (bound - from.y) / span;
    return { x: from.x + share * (to.x - from.x), y: bound };
  };

  const samples: Point[] = Array.from({ length: sampleCount }, (_, index) => {
    const x = box.xMin + ((box.xMax - box.xMin) * index) / (sampleCount - 1);
    return { x, y: evaluateQuadratic(a, b, c, x) };
  });

  const segments: Point[][] = [];
  let current: Point[] = [];
  samples.forEach((point, index) => {
    const previous = index > 0 ? samples[index - 1]! : null;
    if (inside(point.y)) {
      if (current.length === 0 && previous !== null && !inside(previous.y)) {
        current.push(crossing(point, previous));
      }
      current.push(point);
      return;
    }
    if (current.length > 0) {
      current.push(crossing(current[current.length - 1]!, point));
      segments.push(current);
      current = [];
    }
  });
  if (current.length > 0) segments.push(current);
  return segments.filter((segment) => segment.length > 1);
}
