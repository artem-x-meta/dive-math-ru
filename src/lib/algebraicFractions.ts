import {
  addExact,
  compareExact,
  divideExact,
  isExactZero,
  multiplyExact,
  parseExact,
  subtractExact,
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

/* ------------------------------------------------------------------ *
 *  Алгебраическая дробь как выражение: действия и допустимые значения
 * ------------------------------------------------------------------ */

/** Алгебраическая дробь: пара многочленов, знаменатель — не нулевой многочлен. */
export interface FractionExpression {
  readonly numerator: Polynomial;
  readonly denominator: Polynomial;
}

export type FractionOperation = 'single' | 'sum' | 'difference' | 'product' | 'quotient';

/** Одно действие над алгебраическими дробями (или одна дробь без действия). */
export interface FractionCombination {
  readonly operation: FractionOperation;
  readonly left: FractionExpression;
  readonly right?: FractionExpression;
}

function assertSafeCoefficient(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} выходит за диапазон безопасных целых чисел`);
  }
  return value;
}

/** Убирает старшие нулевые коэффициенты; нулевой многочлен превращается в [0]. */
export function trimPolynomial(polynomial: Polynomial): number[] {
  const degree = degreeOf(polynomial);
  return degree === -1 ? [0] : polynomial.slice(0, degree + 1);
}

/** Многочлен с противоположными коэффициентами. */
export function negatePolynomial(polynomial: Polynomial): number[] {
  assertPolynomial(polynomial, 'Многочлен');
  return trimPolynomial(polynomial.map((coefficient) => -coefficient));
}

/** Сумма многочленов с целыми коэффициентами. */
export function addPolynomials(left: Polynomial, right: Polynomial): number[] {
  assertPolynomial(left, 'Первое слагаемое');
  assertPolynomial(right, 'Второе слагаемое');
  const length = Math.max(left.length, right.length, 1);
  const sum = new Array<number>(length).fill(0);
  for (let index = 0; index < length; index += 1) {
    sum[index] = assertSafeCoefficient((left[index] ?? 0) + (right[index] ?? 0), 'Коэффициент суммы');
  }
  return trimPolynomial(sum);
}

/** Разность многочленов с целыми коэффициентами. */
export function subtractPolynomials(left: Polynomial, right: Polynomial): number[] {
  return addPolynomials(left, negatePolynomial(right));
}

function assertFraction(expression: FractionExpression, label: string): void {
  if (typeof expression !== 'object' || expression === null) {
    throw new TypeError(`${label}: ожидалась алгебраическая дробь`);
  }
  assertPolynomial(expression.numerator, `${label}: числитель`);
  if (degreeOf(expression.denominator) === -1) {
    throw new RangeError(`${label}: знаменатель алгебраической дроби не может быть нулевым многочленом`);
  }
}

/** Сумма двух алгебраических дробей, приведённая к общему знаменателю $BD$. */
export function addFractions(left: FractionExpression, right: FractionExpression): FractionExpression {
  assertFraction(left, 'Первая дробь');
  assertFraction(right, 'Вторая дробь');
  return {
    numerator: addPolynomials(
      multiplyPolynomials(left.numerator, right.denominator),
      multiplyPolynomials(right.numerator, left.denominator),
    ),
    denominator: multiplyPolynomials(left.denominator, right.denominator),
  };
}

/** Разность двух алгебраических дробей. */
export function subtractFractions(left: FractionExpression, right: FractionExpression): FractionExpression {
  assertFraction(left, 'Первая дробь');
  assertFraction(right, 'Вторая дробь');
  return {
    numerator: subtractPolynomials(
      multiplyPolynomials(left.numerator, right.denominator),
      multiplyPolynomials(right.numerator, left.denominator),
    ),
    denominator: multiplyPolynomials(left.denominator, right.denominator),
  };
}

/** Произведение двух алгебраических дробей: числитель на числитель, знаменатель на знаменатель. */
export function multiplyFractions(left: FractionExpression, right: FractionExpression): FractionExpression {
  assertFraction(left, 'Первая дробь');
  assertFraction(right, 'Вторая дробь');
  return {
    numerator: multiplyPolynomials(left.numerator, right.numerator),
    denominator: multiplyPolynomials(left.denominator, right.denominator),
  };
}

/** Частное двух алгебраических дробей: умножение на перевёрнутый делитель. */
export function divideFractions(dividend: FractionExpression, divisor: FractionExpression): FractionExpression {
  assertFraction(dividend, 'Делимое');
  assertFraction(divisor, 'Делитель');
  if (degreeOf(divisor.numerator) === -1) {
    throw new RangeError('Делить на дробь с нулевым числителем нельзя');
  }
  return {
    numerator: multiplyPolynomials(dividend.numerator, divisor.denominator),
    denominator: multiplyPolynomials(dividend.denominator, divisor.numerator),
  };
}

/** Степень алгебраической дроби: возводятся и числитель, и знаменатель. */
export function powerFraction(base: FractionExpression, exponent: number): FractionExpression {
  assertFraction(base, 'Основание степени');
  if (!Number.isSafeInteger(exponent) || exponent < 0) {
    throw new RangeError('Показатель степени дроби должен быть целым неотрицательным числом');
  }
  let result: FractionExpression = { numerator: [1], denominator: [1] };
  for (let step = 0; step < exponent; step += 1) {
    result = multiplyFractions(result, base);
  }
  return result;
}

function requireRight(combination: FractionCombination): FractionExpression {
  if (!combination.right) {
    throw new RangeError('Для этого действия нужна вторая дробь');
  }
  return combination.right;
}

/** Выполняет действие и возвращает результат одной дробью. */
export function combineFractions(combination: FractionCombination): FractionExpression {
  assertFraction(combination.left, 'Левая дробь');
  if (combination.operation === 'single') {
    return {
      numerator: trimPolynomial(combination.left.numerator),
      denominator: trimPolynomial(combination.left.denominator),
    };
  }

  const right = requireRight(combination);
  switch (combination.operation) {
    case 'sum':
      return addFractions(combination.left, right);
    case 'difference':
      return subtractFractions(combination.left, right);
    case 'product':
      return multiplyFractions(combination.left, right);
    case 'quotient':
      return divideFractions(combination.left, right);
    default:
      throw new RangeError('Неизвестное действие над алгебраическими дробями');
  }
}

/**
 * Запрещённые значения ИСХОДНОГО выражения. Их считают по частям записи, а не по
 * результату: после приведения к одной дроби часть ограничений исчезает из записи,
 * но не из условия задачи.
 */
export function combinationRestrictions(combination: FractionCombination): ExactRational[] {
  assertFraction(combination.left, 'Левая дробь');
  const values: ExactRational[] = [...restrictedValues(combination.left.denominator)];

  if (combination.operation !== 'single') {
    const right = requireRight(combination);
    assertFraction(right, 'Правая дробь');
    values.push(...restrictedValues(right.denominator));
    if (combination.operation === 'quotient') {
      if (degreeOf(right.numerator) === -1) {
        throw new RangeError('Делить на дробь с нулевым числителем нельзя');
      }
      values.push(...rationalRoots(right.numerator));
    }
  }

  return sortAndDeduplicate(values);
}

/** Точное значение всей записи в точке x — по частям, честно, с проверкой каждой дроби. */
export function evaluateCombination(combination: FractionCombination, x: ExactInput): FractionValue {
  assertFraction(combination.left, 'Левая дробь');
  const left = evaluateFraction(combination.left.numerator, combination.left.denominator, x);
  if (combination.operation === 'single') return left;

  const rightExpression = requireRight(combination);
  assertFraction(rightExpression, 'Правая дробь');
  const right = evaluateFraction(rightExpression.numerator, rightExpression.denominator, x);
  if (!left.defined || !right.defined) return { defined: false };

  switch (combination.operation) {
    case 'sum':
      return { defined: true, value: addExact(left.value!, right.value!) };
    case 'difference':
      return { defined: true, value: subtractExact(left.value!, right.value!) };
    case 'product':
      return { defined: true, value: multiplyExact(left.value!, right.value!) };
    case 'quotient':
      return isExactZero(right.value!)
        ? { defined: false }
        : { defined: true, value: divideExact(left.value!, right.value!) };
    default:
      throw new RangeError('Неизвестное действие над алгебраическими дробями');
  }
}

/** Сравнивает исходную запись с предложенным ответом в одной точке. */
export function compareCombinationAt(
  combination: FractionCombination,
  proposed: FractionExpression,
  x: ExactInput,
): AgreementStatus {
  assertFraction(proposed, 'Предложенная запись');
  const left = evaluateCombination(combination, x);
  const right = evaluateFraction(proposed.numerator, proposed.denominator, x);
  if (!left.defined && !right.defined) return 'both-undefined';
  if (!left.defined) return 'left-undefined';
  if (!right.defined) return 'right-undefined';
  return compareExact(left.value!, right.value!) === 0 ? 'equal' : 'different';
}

/** Значения, которые запрещены в исходной записи, но не видны в предложенном ответе. */
export function missingRestrictions(
  source: readonly ExactRational[],
  target: readonly ExactRational[],
): ExactRational[] {
  return sortAndDeduplicate(
    source.filter((value) => !target.some((candidate) => compareExact(value, candidate) === 0)),
  );
}

/** Совпадают ли два множества значений (порядок и повторы не важны). */
export function sameValueSet(left: readonly ExactRational[], right: readonly ExactRational[]): boolean {
  const first = sortAndDeduplicate(left);
  const second = sortAndDeduplicate(right);
  return first.length === second.length && first.every((value, index) => compareExact(value, second[index]!) === 0);
}

/**
 * Разбирает ответ ученика: «3; −2» или «нет». Возвращает null, если запись
 * непонятна, и пустой массив, если ученик утверждает, что таких значений нет.
 */
export function parseValueList(source: string): ExactRational[] | null {
  if (typeof source !== 'string' || source.length > 200) return null;
  const trimmed = source.trim();
  if (trimmed.length === 0) return null;
  if (/^нет$/i.test(trimmed)) return [];

  const parts = trimmed.split(';').map((part) => part.trim()).filter((part) => part.length > 0);
  if (parts.length === 0) return null;

  const values: ExactRational[] = [];
  for (const part of parts) {
    try {
      values.push(parseExact(part));
    } catch {
      return null;
    }
  }
  return sortAndDeduplicate(values);
}

/** Записывает дробь строкой: «(x² − 9) / (x − 3)»; знаменатель 1 не печатается. */
export function formatFractionExpression(expression: FractionExpression, variable = 'x'): string {
  assertFraction(expression, 'Дробь');
  const numerator = formatPolynomial(expression.numerator, variable);
  const denominator = formatPolynomial(expression.denominator, variable);
  const wrap = (text: string) => (text.includes(' + ') || text.includes(` ${MINUS} `) ? `(${text})` : text);
  return denominator === '1' ? numerator : `${wrap(numerator)} / ${wrap(denominator)}`;
}

/* ------------------------------------------------------------------ *
 *  Наборы примеров для лабораторий главы
 * ------------------------------------------------------------------ */

export type DomainPresetId =
  | 'linear'
  | 'two-roots'
  | 'half-root'
  | 'always-defined'
  | 'removable'
  | 'equation-hole'
  | 'equation-empty'
  | 'equation-plain';

export interface DomainPreset {
  readonly id: DomainPresetId;
  readonly title: string;
  readonly label: string;
  readonly numerator: Polynomial;
  readonly denominator: Polynomial;
  readonly samples: readonly string[];
  readonly note: string;
}

export const DOMAIN_PRESETS: readonly DomainPreset[] = Object.freeze([
  {
    id: 'linear',
    title: 'Одно запрещённое значение',
    label: '(x + 1) / (x − 3)',
    numerator: [1, 1],
    denominator: [-3, 1],
    samples: ['−2', '0', '2', '3', '4'],
    note: 'Знаменатель — линейный многочлен, он обращается в ноль ровно один раз.',
  },
  {
    id: 'two-roots',
    title: 'Два запрещённых значения',
    label: '(2x + 1) / (x² − 4)',
    numerator: [1, 2],
    denominator: [-4, 0, 1],
    samples: ['−3', '−2', '0', '2', '3'],
    note: 'Разность квадратов в знаменателе даёт сразу два запрета.',
  },
  {
    id: 'half-root',
    title: 'Запрет в нецелой точке',
    label: '(x + 5) / (2x − 1)',
    numerator: [5, 1],
    denominator: [-1, 2],
    samples: ['−1', '0', '0,5', '1', '3'],
    note: 'Запрещённое значение не обязано быть целым числом.',
  },
  {
    id: 'always-defined',
    title: 'Запретов нет',
    label: '(x − 1) / (x² + 1)',
    numerator: [-1, 1],
    denominator: [1, 0, 1],
    samples: ['−2', '0', '1', '2', '5'],
    note: 'Сумма квадрата и единицы положительна при любом x, поэтому запретов нет.',
  },
  {
    id: 'removable',
    title: 'Запрет, который переживает сокращение',
    label: '(x² − 9) / (x − 3)',
    numerator: [-9, 0, 1],
    denominator: [-3, 1],
    samples: ['−3', '0', '2', '3', '5'],
    note: 'Дробь сокращается до x + 3, но точка x = 3 остаётся выколотой.',
  },
  {
    id: 'equation-hole',
    title: 'Уравнение с посторонним корнем',
    label: '(x² − 4) / (x − 2)',
    numerator: [-4, 0, 1],
    denominator: [-2, 1],
    samples: ['−2', '0', '1', '2', '3'],
    note: 'Числитель обращается в ноль дважды, но одно из этих значений запрещено.',
  },
  {
    id: 'equation-empty',
    title: 'Уравнение без корней',
    label: '(x − 4) / (x² − 16)',
    numerator: [-4, 1],
    denominator: [-16, 0, 1],
    samples: ['−4', '0', '2', '4', '5'],
    note: 'Единственный нуль числителя запрещён знаменателем.',
  },
  {
    id: 'equation-plain',
    title: 'Уравнение без ловушек',
    label: '(2x − 6) / (x + 1)',
    numerator: [-6, 2],
    denominator: [1, 1],
    samples: ['−1', '0', '1', '3', '4'],
    note: 'Нуль числителя допустим, значит он и есть корень.',
  },
]);

export function getDomainPreset(id: DomainPresetId): DomainPreset {
  const preset = DOMAIN_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) {
    throw new RangeError(`Неизвестный пример допустимых значений: ${id}`);
  }
  return preset;
}

export type EquivalencePresetId =
  | 'reduce-difference'
  | 'reduce-opposite'
  | 'reduce-wrong'
  | 'sum-correct'
  | 'sum-wrong'
  | 'product'
  | 'quotient';

export interface EquivalencePreset {
  readonly id: EquivalencePresetId;
  readonly title: string;
  readonly prompt: string;
  readonly leftLabel: string;
  readonly rightLabel: string;
  readonly combination: FractionCombination;
  readonly proposed: FractionExpression;
  readonly correct: boolean;
  readonly comment: string;
  readonly samples: readonly string[];
}

export const EQUIVALENCE_PRESETS: readonly EquivalencePreset[] = Object.freeze([
  {
    id: 'reduce-difference',
    title: 'Сокращение по разности квадратов',
    prompt: 'Верно ли выполнено сокращение?',
    leftLabel: '(x² − 9) / (x − 3)',
    rightLabel: 'x + 3',
    combination: { operation: 'single', left: { numerator: [-9, 0, 1], denominator: [-3, 1] } },
    proposed: { numerator: [3, 1], denominator: [1] },
    correct: true,
    comment: 'Значения совпадают всюду, кроме x = 3: там исходная дробь не определена, а сумма x + 3 определена.',
    samples: ['−3', '0', '2', '3', '5'],
  },
  {
    id: 'reduce-opposite',
    title: 'Противоположные скобки',
    prompt: 'Верно ли, что эта дробь равна −1?',
    leftLabel: '(3 − x) / (x − 3)',
    rightLabel: '−1',
    combination: { operation: 'single', left: { numerator: [3, -1], denominator: [-3, 1] } },
    proposed: { numerator: [-1], denominator: [1] },
    correct: true,
    comment: 'Числитель противоположен знаменателю, поэтому частное равно −1 при всех допустимых x.',
    samples: ['−1', '0', '2', '3', '7'],
  },
  {
    id: 'reduce-wrong',
    title: 'Сокращение слагаемых',
    prompt: 'Ученик «сократил x». Проверь его ответ.',
    leftLabel: '(x + 3) / (x + 5)',
    rightLabel: '3 / 5',
    combination: { operation: 'single', left: { numerator: [3, 1], denominator: [5, 1] } },
    proposed: { numerator: [3], denominator: [5] },
    correct: false,
    comment: 'При x = 0 записи случайно совпадают — одной удачной подстановки недостаточно, чтобы поверить в равенство.',
    samples: ['−5', '0', '1', '2', '5'],
  },
  {
    id: 'sum-correct',
    title: 'Сложение с разными знаменателями',
    prompt: 'Верно ли приведены дроби к общему знаменателю?',
    leftLabel: '1/(x − 3) + 1/(x + 3)',
    rightLabel: '2x / (x² − 9)',
    combination: {
      operation: 'sum',
      left: { numerator: [1], denominator: [-3, 1] },
      right: { numerator: [1], denominator: [3, 1] },
    },
    proposed: { numerator: [0, 2], denominator: [-9, 0, 1] },
    correct: true,
    comment: 'Общий знаменатель (x − 3)(x + 3) = x² − 9; числители дают (x + 3) + (x − 3) = 2x.',
    samples: ['−3', '−1', '0', '1', '3'],
  },
  {
    id: 'sum-wrong',
    title: 'Сложили числители и знаменатели',
    prompt: 'Проверь: можно ли складывать дроби «по этажам»?',
    leftLabel: '1/x + 1/(x + 1)',
    rightLabel: '2 / (2x + 1)',
    combination: {
      operation: 'sum',
      left: { numerator: [1], denominator: [0, 1] },
      right: { numerator: [1], denominator: [1, 1] },
    },
    proposed: { numerator: [2], denominator: [1, 2] },
    correct: false,
    comment: 'Записи не совпадают ни при одном значении x: складывать знаменатели нельзя.',
    samples: ['−1', '0', '1', '2', '4'],
  },
  {
    id: 'product',
    title: 'Умножение с сокращением',
    prompt: 'Верно ли выполнено умножение дробей?',
    leftLabel: 'x/(x + 2) · (x² − 4)/x²',
    rightLabel: '(x − 2) / x',
    combination: {
      operation: 'product',
      left: { numerator: [0, 1], denominator: [2, 1] },
      right: { numerator: [-4, 0, 1], denominator: [0, 0, 1] },
    },
    proposed: { numerator: [-2, 1], denominator: [0, 1] },
    correct: true,
    comment: 'Ответ верен, но запрет x ≠ −2 виден только в исходном произведении.',
    samples: ['−2', '−1', '0', '1', '4'],
  },
  {
    id: 'quotient',
    title: 'Деление дробей',
    prompt: 'Верно ли выполнено деление?',
    leftLabel: 'x/(x − 1) : x²/(x² − 1)',
    rightLabel: '(x + 1) / x',
    combination: {
      operation: 'quotient',
      left: { numerator: [0, 1], denominator: [-1, 1] },
      right: { numerator: [0, 0, 1], denominator: [-1, 0, 1] },
    },
    proposed: { numerator: [1, 1], denominator: [0, 1] },
    correct: true,
    comment: 'При делении запрещает и знаменатель делителя, и его числитель: x ≠ 0, x ≠ 1, x ≠ −1.',
    samples: ['−1', '0', '1', '2', '3'],
  },
]);

export function getEquivalencePreset(id: EquivalencePresetId): EquivalencePreset {
  const preset = EQUIVALENCE_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) {
    throw new RangeError(`Неизвестный пример на равенство записей: ${id}`);
  }
  return preset;
}
