import {
  compareExact,
  divideExact,
  isExactZero,
  parseExact,
  type ExactInput,
  type ExactRational,
} from './exactRational';

/**
 * Многочлен с целыми коэффициентами, записанными от свободного члена
 * к старшему: [c0, c1, c2] означает c0 + c1·x + c2·x².
 */
export type Polynomial = readonly number[];

export interface FractionValue {
  /** Определено ли значение дроби: знаменатель не обратился в ноль. */
  defined: boolean;
  /** Точное значение дроби, если оно определено. */
  value?: ExactRational;
}

export type AgreementStatus =
  | 'equal'
  | 'different'
  | 'left-undefined'
  | 'right-undefined'
  | 'both-undefined';

export interface FractionZeroSolution {
  /** Корни уравнения P/Q = 0: нули числителя, допустимые для дроби. */
  roots: ExactRational[];
  /** Посторонние кандидаты: нули числителя, запрещённые знаменателем. */
  excluded: ExactRational[];
}

export interface ApproachRow {
  x: ExactRational;
  value: FractionValue;
}

const SUPERSCRIPTS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'] as const;
const MINUS = '−';

function assertPolynomial(polynomial: Polynomial, label: string): void {
  if (!Array.isArray(polynomial)) {
    throw new TypeError(`${label} должен быть массивом целых коэффициентов`);
  }
  for (const coefficient of polynomial) {
    if (!Number.isSafeInteger(coefficient)) {
      throw new TypeError(`Коэффициенты (${label.toLowerCase()}) должны быть безопасными целыми числами`);
    }
  }
}

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/** Целочисленный квадратный корень; null, если аргумент не является точным квадратом. */
function exactSquareRoot(value: bigint): bigint | null {
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

function sortAndDeduplicate(values: readonly ExactRational[]): ExactRational[] {
  const sorted = [...values].sort((left, right) => compareExact(left, right));
  return sorted.filter((value, index) => index === 0 || compareExact(value, sorted[index - 1]!) !== 0);
}

/** Степень многочлена; для нулевого многочлена возвращает -1. */
export function degreeOf(polynomial: Polynomial): number {
  assertPolynomial(polynomial, 'Многочлен');
  for (let index = polynomial.length - 1; index >= 0; index -= 1) {
    if (polynomial[index] !== 0) return index;
  }
  return -1;
}

/** Точно вычисляет значение многочлена в точке x по схеме Горнера. */
export function evaluatePolynomial(polynomial: Polynomial, x: ExactInput): ExactRational {
  assertPolynomial(polynomial, 'Многочлен');
  const point = parseExact(x);
  let accumulator = { numerator: 0n, denominator: 1n } as ExactRational;

  for (let index = polynomial.length - 1; index >= 0; index -= 1) {
    // accumulator * x + coefficient, всё — в точных рациональных числах.
    const scaledNumerator = accumulator.numerator * point.numerator;
    const scaledDenominator = accumulator.denominator * point.denominator;
    accumulator = parseExact({
      numerator: scaledNumerator + BigInt(polynomial[index]!) * scaledDenominator,
      denominator: scaledDenominator,
    });
  }

  return accumulator;
}

/** Перемножает многочлены с целыми коэффициентами. */
export function multiplyPolynomials(left: Polynomial, right: Polynomial): number[] {
  assertPolynomial(left, 'Левый множитель');
  assertPolynomial(right, 'Правый множитель');
  if (left.length === 0 || right.length === 0) return [0];

  const product = new Array<number>(left.length + right.length - 1).fill(0);
  for (let i = 0; i < left.length; i += 1) {
    for (let j = 0; j < right.length; j += 1) {
      const term = product[i + j]! + left[i]! * right[j]!;
      if (!Number.isSafeInteger(term)) {
        throw new RangeError('Коэффициент произведения выходит за диапазон безопасных целых чисел');
      }
      product[i + j] = term;
    }
  }
  return product;
}

/**
 * Записывает многочлен привычной школьной строкой: от старшей степени к младшей,
 * со знаком минус U+2212 и надстрочными показателями.
 */
export function formatPolynomial(polynomial: Polynomial, variable = 'x'): string {
  assertPolynomial(polynomial, 'Многочлен');
  const degree = degreeOf(polynomial);
  if (degree === -1) return '0';

  const parts: string[] = [];
  for (let power = degree; power >= 0; power -= 1) {
    const coefficient = polynomial[power] ?? 0;
    if (coefficient === 0) continue;

    const magnitude = Math.abs(coefficient);
    const sign = coefficient < 0 ? MINUS : '+';
    let body: string;
    if (power === 0) {
      body = String(magnitude);
    } else {
      const variablePart = power === 1
        ? variable
        : `${variable}${String(power).split('').map((digit) => SUPERSCRIPTS[Number(digit)]).join('')}`;
      body = magnitude === 1 ? variablePart : `${magnitude}${variablePart}`;
    }

    if (parts.length === 0) {
      parts.push(coefficient < 0 ? `${MINUS}${body}` : body);
    } else {
      parts.push(`${sign === MINUS ? MINUS : '+'} ${body}`);
    }
  }

  return parts.join(' ');
}

/**
 * Рациональные корни многочлена степени не выше 2. Иррациональные корни и
 * степени выше второй в школьном ядре не поддерживаются — бросается ошибка.
 */
export function rationalRoots(polynomial: Polynomial): ExactRational[] {
  const degree = degreeOf(polynomial);
  if (degree === -1) {
    throw new RangeError('Нулевой многочлен обращается в ноль при любом значении переменной');
  }
  if (degree === 0) return [];
  if (degree === 1) {
    const [b, a] = [polynomial[0]!, polynomial[1]!];
    return [parseExact({ numerator: BigInt(-b), denominator: BigInt(a) })];
  }
  if (degree === 2) {
    const a = BigInt(polynomial[2]!);
    const b = BigInt(polynomial[1] ?? 0);
    const c = BigInt(polynomial[0] ?? 0);
    const discriminant = b * b - 4n * a * c;
    if (discriminant < 0n) return [];

    const root = exactSquareRoot(discriminant);
    if (root === null) {
      throw new RangeError('Корни этого многочлена иррациональны и не поддерживаются ядром главы');
    }

    const first = parseExact({ numerator: -b + root, denominator: 2n * a });
    if (discriminant === 0n) return [first];
    const second = parseExact({ numerator: -b - root, denominator: 2n * a });
    return sortAndDeduplicate([first, second]);
  }

  throw new RangeError('Поддерживаются многочлены степени не выше 2');
}

/** Запрещённые значения переменной: нули знаменателя, по возрастанию. */
export function restrictedValues(denominator: Polynomial): ExactRational[] {
  if (degreeOf(denominator) === -1) {
    throw new RangeError('Знаменатель алгебраической дроби не может быть нулевым многочленом');
  }
  return rationalRoots(denominator);
}

/** Допустимо ли значение x для дроби с данным знаменателем. */
export function isAllowedValue(denominator: Polynomial, x: ExactInput): boolean {
  if (degreeOf(denominator) === -1) {
    throw new RangeError('Знаменатель алгебраической дроби не может быть нулевым многочленом');
  }
  return !isExactZero(evaluatePolynomial(denominator, x));
}

/** Точно вычисляет значение алгебраической дроби в точке x. */
export function evaluateFraction(numerator: Polynomial, denominator: Polynomial, x: ExactInput): FractionValue {
  const denominatorValue = evaluatePolynomial(denominator, x);
  if (isExactZero(denominatorValue)) return { defined: false };
  return { defined: true, value: divideExact(evaluatePolynomial(numerator, x), denominatorValue) };
}

/** Сравнивает значения двух алгебраических дробей в одной точке. */
export function compareFractionsAt(
  leftNumerator: Polynomial,
  leftDenominator: Polynomial,
  rightNumerator: Polynomial,
  rightDenominator: Polynomial,
  x: ExactInput,
): AgreementStatus {
  const left = evaluateFraction(leftNumerator, leftDenominator, x);
  const right = evaluateFraction(rightNumerator, rightDenominator, x);
  if (!left.defined && !right.defined) return 'both-undefined';
  if (!left.defined) return 'left-undefined';
  if (!right.defined) return 'right-undefined';
  return compareExact(left.value!, right.value!) === 0 ? 'equal' : 'different';
}

/**
 * Решает уравнение P/Q = 0: корни числителя делятся на допустимые
 * (настоящие корни) и посторонние (запрещены знаменателем).
 */
export function solveFractionEqualsZero(numerator: Polynomial, denominator: Polynomial): FractionZeroSolution {
  if (degreeOf(numerator) === -1) {
    throw new RangeError('Числитель-ноль обращает дробь в ноль при всех допустимых значениях');
  }

  const candidates = rationalRoots(numerator);
  const roots: ExactRational[] = [];
  const excluded: ExactRational[] = [];
  for (const candidate of candidates) {
    (isAllowedValue(denominator, candidate) ? roots : excluded).push(candidate);
  }
  return { roots, excluded };
}

/**
 * Таблица приближения к точке target: для каждого смещения возвращает значения
 * дроби слева и справа от target. Показывает, почему деление на ноль не имеет
 * смысла: чем ближе к запрещённому значению, тем больше |дроби|.
 */
export function approachTable(
  numerator: Polynomial,
  denominator: Polynomial,
  target: ExactInput,
  offsets: readonly ExactInput[],
): { below: ApproachRow; above: ApproachRow }[] {
  const centre = parseExact(target);
  return offsets.map((offset) => {
    const step = parseExact(offset);
    if (step.numerator <= 0n) {
      throw new RangeError('Смещения в таблице приближения должны быть положительными');
    }
    const below = parseExact({
      numerator: centre.numerator * step.denominator - step.numerator * centre.denominator,
      denominator: centre.denominator * step.denominator,
    });
    const above = parseExact({
      numerator: centre.numerator * step.denominator + step.numerator * centre.denominator,
      denominator: centre.denominator * step.denominator,
    });
    return {
      below: { x: below, value: evaluateFraction(numerator, denominator, below) },
      above: { x: above, value: evaluateFraction(numerator, denominator, above) },
    };
  });
}

/** Модуль точного рационального числа — удобен для таблиц роста |дроби|. */
export function absoluteExact(value: ExactInput): ExactRational {
  const exact = parseExact(value);
  return parseExact({ numerator: absoluteBigInt(exact.numerator), denominator: exact.denominator });
}
