/**
 * Вычислительное ядро главы «Действительные числа» (8 класс).
 *
 * Все проверки точные: целые вычисления ведутся в BigInt, а десятичные границы
 * получаются из точного целого корня. Поэтому нижняя и верхняя оценки корня
 * гарантированно верны и не зависят от погрешности чисел с плавающей точкой.
 */

import { primeFactorization } from './numberTheory';

/** Число вида `coefficient · √radicand`, где подкоренное выражение свободно от квадратов. */
export interface Radical {
  readonly coefficient: number;
  readonly radicand: number;
}

/** Разбиение простых множителей на пары (выходят из-под корня) и одиночки (остаются). */
export interface FactorPairing {
  /** По одному простому числу от каждой найденной пары. */
  readonly extracted: readonly number[];
  /** Простые множители, которым не нашлось пары. */
  readonly remaining: readonly number[];
}

/** Число вида `numerator · √radicand / denominator` с несократимой дробью. */
export interface RationalizedRadical {
  readonly numerator: number;
  readonly denominator: number;
  readonly radicand: number;
}

/** Зажим корня между двумя соседними целыми числами. */
export interface IntegerBracket {
  readonly lower: number;
  readonly upper: number;
  readonly exact: boolean;
}

/** Десятичный зажим корня с заданным числом знаков после запятой. */
export interface SquareRootEstimate {
  readonly digits: number;
  readonly lower: string;
  readonly upper: string;
  readonly lowerSquare: string;
  readonly upperSquare: string;
  readonly exact: boolean;
}

export type DecimalInput = number | string;

export const ROOT_LIMITS = Object.freeze({
  maxValue: 1_000_000_000,
  maxDigits: 8,
  maxInputDigits: 6,
});

const DECIMAL_PATTERN = /^\d+(?:[.,]\d+)?$/;

interface ScaledDecimal {
  readonly numerator: bigint;
  readonly scale: number;
}

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} должно быть целым числом из безопасного диапазона`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  assertInteger(value, label);
  if (value < 0) throw new RangeError(`${label} не может быть отрицательным`);
  if (value > ROOT_LIMITS.maxValue) {
    throw new RangeError(`${label} не должно превышать ${ROOT_LIMITS.maxValue}`);
  }
}

function assertDigits(digits: number): void {
  assertInteger(digits, 'Число знаков после запятой');
  if (digits < 0 || digits > ROOT_LIMITS.maxDigits) {
    throw new RangeError(`Число знаков после запятой должно быть от 0 до ${ROOT_LIMITS.maxDigits}`);
  }
}

function toSafeNumber(value: bigint, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${label} выходит за диапазон безопасных целых чисел`);
  }
  return result;
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function bigintGcd(left: bigint, right: bigint): bigint {
  let a = absolute(left);
  let b = absolute(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/** Целая часть квадратного корня из неотрицательного BigInt (метод Ньютона). */
function bigIntegerSquareRoot(value: bigint): bigint {
  if (value < 0n) throw new RangeError('Квадратный корень из отрицательного числа не определён');
  if (value < 2n) return value;

  let guess = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
  for (;;) {
    const next = (guess + value / guess) >> 1n;
    if (next >= guess) return guess;
    guess = next;
  }
}

/** Разбирает неотрицательную конечную десятичную запись в точную пару «числитель / 10^scale». */
function parseDecimal(input: DecimalInput, label: string): ScaledDecimal {
  const source = typeof input === 'number' ? String(input) : input.trim().replace(/\s+/g, '');

  if (typeof input === 'number' && !Number.isFinite(input)) {
    throw new TypeError(`${label} должно быть конечным числом`);
  }
  if (!DECIMAL_PATTERN.test(source)) {
    throw new TypeError(`${label} должно быть неотрицательной десятичной записью, например 2 или 2,25`);
  }

  const [integerPart, fractionPart = ''] = source.replace(',', '.').split('.');
  if (fractionPart.length > ROOT_LIMITS.maxInputDigits) {
    throw new RangeError(`${label} не должно иметь больше ${ROOT_LIMITS.maxInputDigits} знаков после запятой`);
  }

  const numerator = BigInt(`${integerPart}${fractionPart}`);
  const scale = fractionPart.length;
  if (numerator > BigInt(ROOT_LIMITS.maxValue) * 10n ** BigInt(scale)) {
    throw new RangeError(`${label} не должно превышать ${ROOT_LIMITS.maxValue}`);
  }

  return { numerator, scale };
}

/** Вставляет запятую (в виде точки) в целое значение, разделённое на 10^digits. */
function formatScaled(value: bigint, digits: number): string {
  if (value < 0n) throw new RangeError('Форматируются только неотрицательные значения');
  if (digits === 0) return value.toString();

  const text = value.toString().padStart(digits + 1, '0');
  return `${text.slice(0, text.length - digits)}.${text.slice(text.length - digits)}`;
}

function trimTrailingZeros(text: string): string {
  if (!text.includes('.')) return text;
  return text.replace(/0+$/, '').replace(/\.$/, '');
}

/** Переводит служебную запись с точкой в русскую запись с запятой. */
export function formatDecimalRussian(text: string): string {
  return text.replace('.', ',');
}

/** Проверяет, является ли неотрицательное целое число точным квадратом. */
export function isPerfectSquare(value: number): boolean {
  assertNonNegativeInteger(value, 'Подкоренное число');
  const root = bigIntegerSquareRoot(BigInt(value));
  return root * root === BigInt(value);
}

/** Целая часть квадратного корня из неотрицательного целого числа. */
export function integerSquareRoot(value: number): number {
  assertNonNegativeInteger(value, 'Подкоренное число');
  return toSafeNumber(bigIntegerSquareRoot(BigInt(value)), 'Целая часть корня');
}

/**
 * Зажимает корень между соседними целыми: `lower ≤ √value ≤ upper`.
 * Если корень извлекается точно, обе границы совпадают и `exact` равно `true`.
 */
export function bracketSquareRoot(value: number): IntegerBracket {
  const lower = integerSquareRoot(value);
  const exact = lower * lower === value;
  return { lower, upper: exact ? lower : lower + 1, exact };
}

/**
 * Десятичный зажим: наибольшее число с `digits` знаками после запятой, квадрат
 * которого не превосходит `value`, и следующее за ним число. Квадраты обеих
 * границ возвращаются точно.
 */
export function estimateSquareRoot(value: DecimalInput, digits: number): SquareRootEstimate {
  assertDigits(digits);
  const { numerator, scale } = parseDecimal(value, 'Подкоренное число');

  const scaleFactor = 10n ** BigInt(scale);
  const digitFactor = 10n ** BigInt(2 * digits);
  const root = bigIntegerSquareRoot(numerator * digitFactor * scaleFactor) / scaleFactor;
  const exact = root * root * scaleFactor === numerator * digitFactor;
  const next = root + 1n;

  return {
    digits,
    lower: formatScaled(root, digits),
    upper: formatScaled(exact ? root : next, digits),
    lowerSquare: formatScaled(root * root, 2 * digits),
    upperSquare: formatScaled(exact ? root * root : next * next, 2 * digits),
    exact,
  };
}

/**
 * Точное значение корня, если оно записывается конечной десятичной дробью,
 * иначе `null`. Для конечной десятичной записи это равносильно рациональности корня.
 */
export function exactSquareRoot(value: DecimalInput): string | null {
  const { numerator, scale } = parseDecimal(value, 'Подкоренное число');
  const target = numerator * 10n ** BigInt(scale);
  const root = bigIntegerSquareRoot(target);
  if (root * root !== target) return null;
  return trimTrailingZeros(formatScaled(root, scale));
}

/** Приближение корня с округлением до `digits` знаков (половина округляется вверх). */
export function roundSquareRoot(value: DecimalInput, digits: number): string {
  assertDigits(digits);
  const { numerator, scale } = parseDecimal(value, 'Подкоренное число');

  const scaleFactor = 10n ** BigInt(scale);
  const digitFactor = 10n ** BigInt(2 * digits);
  const root = bigIntegerSquareRoot(numerator * digitFactor * scaleFactor) / scaleFactor;
  const half = 2n * root + 1n;
  const roundUp = half * half * scaleFactor <= 4n * numerator * digitFactor;

  return formatScaled(roundUp ? root + 1n : root, digits);
}

/**
 * Приводит `coefficient · √radicand` к виду с наименьшим подкоренным числом:
 * из-под корня выносятся все квадратные множители.
 */
export function makeRadical(coefficient: number, radicand: number): Radical {
  assertInteger(coefficient, 'Множитель перед корнем');
  assertNonNegativeInteger(radicand, 'Подкоренное число');
  if (Math.abs(coefficient) > ROOT_LIMITS.maxValue) {
    throw new RangeError(`Множитель перед корнем не должен превышать ${ROOT_LIMITS.maxValue} по модулю`);
  }
  if (coefficient === 0 || radicand === 0) return { coefficient: 0, radicand: 1 };

  let extracted = 1;
  let rest = radicand;
  for (let divisor = 2; divisor * divisor <= rest; divisor += 1) {
    while (rest % (divisor * divisor) === 0) {
      extracted *= divisor;
      rest /= divisor * divisor;
    }
  }

  const product = BigInt(coefficient) * BigInt(extracted);
  return { coefficient: toSafeNumber(product, 'Множитель перед корнем'), radicand: rest };
}

/** Вынесение множителя из-под знака корня: `√value = coefficient · √radicand`. */
export function simplifyRadical(value: number): Radical {
  return makeRadical(1, value);
}

/**
 * Раскладывает подкоренное число на простые множители и разбивает их на пары.
 * Из каждой пары один множитель выходит из-под корня, одиночки остаются внутри.
 */
export function pairPrimeFactors(value: number): FactorPairing {
  assertNonNegativeInteger(value, 'Подкоренное число');
  if (value === 0) throw new RangeError('Подкоренное число должно быть натуральным');

  const factors = primeFactorization(value);
  const extracted: number[] = [];
  const remaining: number[] = [];

  for (let index = 0; index < factors.length;) {
    const prime = factors[index] as number;
    if (factors[index + 1] === prime) {
      extracted.push(prime);
      index += 2;
    } else {
      remaining.push(prime);
      index += 1;
    }
  }

  return { extracted, remaining };
}

/** Внесение множителя под знак корня: `coefficient · √radicand = √value` при `coefficient ≥ 0`. */
export function radicalToSquareRoot(radical: Radical): number {
  const { coefficient, radicand } = normalizeRadicalInput(radical);
  if (coefficient < 0) {
    throw new RangeError('Под корень вносится только неотрицательный множитель');
  }
  const value = BigInt(coefficient) * BigInt(coefficient) * BigInt(radicand);
  return toSafeNumber(value, 'Подкоренное число');
}

function normalizeRadicalInput(radical: Radical): Radical {
  if (typeof radical !== 'object' || radical === null) {
    throw new TypeError('Ожидалось число вида «множитель · корень»');
  }
  return makeRadical(radical.coefficient, radical.radicand);
}

/** Произведение двух радикалов: `(c₁√r₁)(c₂√r₂) = c₁c₂√(r₁r₂)` с последующим упрощением. */
export function multiplyRadicals(left: Radical, right: Radical): Radical {
  const first = normalizeRadicalInput(left);
  const second = normalizeRadicalInput(right);
  if (first.coefficient === 0 || second.coefficient === 0) return { coefficient: 0, radicand: 1 };

  const coefficient = toSafeNumber(BigInt(first.coefficient) * BigInt(second.coefficient), 'Множитель перед корнем');
  const radicand = toSafeNumber(BigInt(first.radicand) * BigInt(second.radicand), 'Подкоренное число');
  return makeRadical(coefficient, radicand);
}

/**
 * Сумма подобных радикалов. Если подкоренные числа различны, слагаемые
 * не подобны и сумма не сворачивается — возвращается `null`.
 */
export function addRadicals(left: Radical, right: Radical): Radical | null {
  const first = normalizeRadicalInput(left);
  const second = normalizeRadicalInput(right);
  if (first.coefficient === 0) return second;
  if (second.coefficient === 0) return first;
  if (first.radicand !== second.radicand) return null;
  return makeRadical(first.coefficient + second.coefficient, first.radicand);
}

/** Точное сравнение двух радикалов: −1, 0 или 1. */
export function compareRadicals(left: Radical, right: Radical): -1 | 0 | 1 {
  const first = normalizeRadicalInput(left);
  const second = normalizeRadicalInput(right);
  const firstSign = Math.sign(first.coefficient);
  const secondSign = Math.sign(second.coefficient);
  if (firstSign !== secondSign) return firstSign < secondSign ? -1 : 1;
  if (firstSign === 0) return 0;

  const firstSquare = BigInt(first.coefficient) * BigInt(first.coefficient) * BigInt(first.radicand);
  const secondSquare = BigInt(second.coefficient) * BigInt(second.coefficient) * BigInt(second.radicand);
  if (firstSquare === secondSquare) return 0;
  const bigger = firstSquare > secondSquare ? 1 : -1;
  return (firstSign > 0 ? bigger : -bigger) as -1 | 1;
}

/** Избавление от иррациональности в знаменателе: `numerator / √radicand`. */
export function rationalizeDenominator(numerator: number, radicand: number): RationalizedRadical {
  assertInteger(numerator, 'Числитель');
  assertNonNegativeInteger(radicand, 'Подкоренное число');
  if (radicand === 0) throw new RangeError('Делить на корень из нуля нельзя');

  const simplified = simplifyRadical(radicand);
  const rawNumerator = BigInt(numerator);
  const rawDenominator = BigInt(simplified.coefficient) * BigInt(simplified.radicand);
  const divisor = bigintGcd(rawNumerator, rawDenominator) || 1n;

  return {
    numerator: toSafeNumber(rawNumerator / divisor, 'Числитель'),
    denominator: toSafeNumber(rawDenominator / divisor, 'Знаменатель'),
    radicand: simplified.radicand,
  };
}

/** Тождество `√(a²) = |a|` для целого `a`. */
export function squareRootOfSquare(value: number): number {
  assertInteger(value, 'Основание квадрата');
  return Math.abs(value);
}

/** Текстовая запись радикала: 0, целое число, `√7` или `6√2`. */
export function formatRadical(radical: Radical): string {
  const { coefficient, radicand } = normalizeRadicalInput(radical);
  if (coefficient === 0) return '0';

  const sign = coefficient < 0 ? '−' : '';
  const size = Math.abs(coefficient);
  if (radicand === 1) return `${sign}${size}`;
  if (size === 1) return `${sign}√${radicand}`;
  return `${sign}${size}√${radicand}`;
}
