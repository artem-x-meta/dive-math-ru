/**
 * Вычислительное ядро главы «Комбинаторика» (9 класс).
 *
 * Счётные величины — факториал, размещения, сочетания, строки треугольника
 * Паскаля — считаются в bigint: уже $20!$ не помещается в double без потери
 * последней цифры. Вероятности схемы Бернулли считаются точными дробями,
 * поэтому сумма вероятностей распределения равна ровно единице, а не 0,9999.
 */

import {
  addFractions,
  compareFractions,
  fraction,
  fractionToNumber,
  multiplyFractions,
  subtractFractions,
  type Fraction,
} from './probability';

/** Дальше школьные задачи не заходят, а запись числа перестаёт читаться. */
export const MAX_FACTORIAL_ARGUMENT = 100;

/** Столько испытаний схемы Бернулли ещё умещается в точную дробь. */
export const MAX_BERNOULLI_TRIALS = 15;

const ONE: Fraction = { numerator: 1, denominator: 1 };
const ZERO: Fraction = { numerator: 0, denominator: 1 };

function assertCount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} должно быть целым неотрицательным числом`);
  }
}

function assertWithinFactorialLimit(value: number, label: string): void {
  if (value > MAX_FACTORIAL_ARGUMENT) {
    throw new RangeError(`${label} не должно превышать ${MAX_FACTORIAL_ARGUMENT}`);
  }
}

/** Переводит счётный результат в обычное число, если он безопасно помещается. */
export function countToNumber(value: bigint, label = 'Число вариантов'): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${label} выходит за диапазон безопасных целых чисел`);
  }
  return result;
}

/** Узкий неразрывный пробел: он делит разряды и не даёт числу переноситься. */
export const DIGIT_GROUP_SEPARATOR = '\u202F';

/** Записывает большое число группами по три цифры: 3 628 800. */
export function formatCount(value: bigint): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end));
  }
  return `${negative ? '−' : ''}${groups.join(DIGIT_GROUP_SEPARATOR)}`;
}

/* ─────────────────────────────  Правила подсчёта  ───────────────────────────── */

/**
 * Правило суммы: если наборы вариантов не пересекаются и выбирают ровно
 * из одного набора, число способов равно сумме.
 */
export function sumRule(counts: readonly number[]): number {
  if (counts.length === 0) {
    throw new RangeError('Нужен хотя бы один набор вариантов');
  }
  counts.forEach((count, index) => assertCount(count, `Число вариантов в наборе №${index + 1}`));
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!Number.isSafeInteger(total)) {
    throw new RangeError('Сумма вариантов выходит за диапазон безопасных целых чисел');
  }
  return total;
}

/**
 * Правило произведения: выбор идёт по шагам, и число вариантов очередного
 * шага одинаково при любом предыдущем выборе.
 */
export function productRule(counts: readonly number[]): number {
  if (counts.length === 0) {
    throw new RangeError('Нужен хотя бы один шаг выбора');
  }
  counts.forEach((count, index) => assertCount(count, `Число вариантов на шаге №${index + 1}`));
  const total = counts.reduce((product, count) => product * count, 1);
  if (!Number.isSafeInteger(total)) {
    throw new RangeError('Произведение вариантов выходит за диапазон безопасных целых чисел');
  }
  return total;
}

/* ──────────────────────  Факториал, размещения, сочетания  ────────────────────── */

/** $n! = 1\cdot2\cdot\ldots\cdot n$, причём $0!=1$. */
export function factorial(n: number): bigint {
  assertCount(n, 'Аргумент факториала');
  assertWithinFactorialLimit(n, 'Аргумент факториала');
  let result = 1n;
  for (let step = 2n; step <= BigInt(n); step += 1n) {
    result *= step;
  }
  return result;
}

/** Число перестановок $n$ различных объектов: $P_n = n!$. */
export function permutations(n: number): bigint {
  return factorial(n);
}

/**
 * Число размещений $A_n^k = n(n-1)\ldots(n-k+1)$: выбираем $k$ объектов
 * из $n$ и расставляем их по местам, то есть порядок важен.
 */
export function arrangements(n: number, k: number): bigint {
  assertCount(n, 'Число объектов');
  assertCount(k, 'Число мест');
  assertWithinFactorialLimit(n, 'Число объектов');
  if (k > n) return 0n;

  let result = 1n;
  for (let step = 0; step < k; step += 1) {
    result *= BigInt(n - step);
  }
  return result;
}

/**
 * Число сочетаний $C_n^k = \dfrac{n!}{k!\,(n-k)!}$: выбираем $k$ объектов
 * из $n$, порядок внутри выбора не важен.
 *
 * Считается по одному множителю за шаг; каждое промежуточное значение —
 * это готовое сочетание, поэтому деление всегда точное.
 */
export function combinations(n: number, k: number): bigint {
  assertCount(n, 'Число объектов');
  assertCount(k, 'Размер выбора');
  assertWithinFactorialLimit(n, 'Число объектов');
  if (k > n) return 0n;

  const shorter = Math.min(k, n - k);
  let result = 1n;
  for (let step = 1; step <= shorter; step += 1) {
    result = (result * BigInt(n - shorter + step)) / BigInt(step);
  }
  return result;
}

/* ───────────────────────────  Треугольник Паскаля  ─────────────────────────── */

/** Строка треугольника Паскаля с номером $n$: числа $C_n^0,\ldots,C_n^n$. */
export function pascalRow(n: number): bigint[] {
  assertCount(n, 'Номер строки треугольника Паскаля');
  assertWithinFactorialLimit(n, 'Номер строки треугольника Паскаля');

  let row: bigint[] = [1n];
  for (let index = 1; index <= n; index += 1) {
    const next: bigint[] = [1n];
    for (let position = 1; position < index; position += 1) {
      next.push(row[position - 1]! + row[position]!);
    }
    next.push(1n);
    row = next;
  }
  return row;
}

/** Треугольник Паскаля со строками от нулевой до строки `lastRow` включительно. */
export function pascalTriangle(lastRow: number): bigint[][] {
  assertCount(lastRow, 'Номер последней строки');
  assertWithinFactorialLimit(lastRow, 'Номер последней строки');

  const triangle: bigint[][] = [[1n]];
  for (let index = 1; index <= lastRow; index += 1) {
    const previous = triangle[index - 1]!;
    const next: bigint[] = [1n];
    for (let position = 1; position < index; position += 1) {
      next.push(previous[position - 1]! + previous[position]!);
    }
    next.push(1n);
    triangle.push(next);
  }
  return triangle;
}

/** Сумма чисел строки $n$: она всегда равна $2^n$ — числу подмножеств. */
export function pascalRowSum(n: number): bigint {
  assertCount(n, 'Номер строки треугольника Паскаля');
  assertWithinFactorialLimit(n, 'Номер строки треугольника Паскаля');
  return pascalRow(n).reduce((sum, value) => sum + value, 0n);
}

export interface PascalParents {
  /** Число $C_{n-1}^{k-1}$ — соседка слева сверху. */
  left: bigint;
  /** Число $C_{n-1}^{k}$ — соседка справа сверху. */
  right: bigint;
  /** Их сумма; она равна $C_n^k$. */
  sum: bigint;
}

/** Два числа, стоящие над клеткой $(n;k)$, и их сумма. */
export function pascalParents(n: number, k: number): PascalParents {
  assertCount(n, 'Номер строки треугольника Паскаля');
  assertCount(k, 'Номер числа в строке');
  if (n === 0) {
    throw new RangeError('У вершины треугольника Паскаля нет чисел над ней');
  }
  if (k > n) {
    throw new RangeError('Номер числа в строке не может превышать номер строки');
  }

  const left = k === 0 ? 0n : combinations(n - 1, k - 1);
  const right = k === n ? 0n : combinations(n - 1, k);
  return { left, right, sum: left + right };
}

/* ────────────────────  Случайная величина и её распределение  ──────────────────── */

export interface DistributionEntry {
  /** Значение случайной величины. */
  value: number;
  /** Вероятность этого значения — точная несократимая дробь. */
  probability: Fraction;
}

function assertProbabilityFraction(value: Fraction, label: string): Fraction {
  const normalized = fraction(value.numerator, value.denominator);
  if (normalized.numerator < 0 || normalized.numerator > normalized.denominator) {
    throw new RangeError(`${label} должна лежать между 0 и 1`);
  }
  return normalized;
}

/** Сумма вероятностей распределения; у полного распределения равна 1. */
export function distributionTotal(entries: readonly DistributionEntry[]): Fraction {
  let total: Fraction = ZERO;
  entries.forEach((entry, index) => {
    total = addFractions(total, assertProbabilityFraction(entry.probability, `Вероятность значения №${index + 1}`));
  });
  return total;
}

function assertCompleteDistribution(entries: readonly DistributionEntry[]): void {
  if (entries.length === 0) {
    throw new RangeError('У случайной величины должно быть хотя бы одно значение');
  }
  const total = distributionTotal(entries);
  if (total.numerator !== total.denominator) {
    throw new RangeError('Сумма вероятностей распределения должна равняться 1');
  }
}

/**
 * Распределение случайной величины по списку равновозможных исходов опыта:
 * одинаковые значения собираются вместе, вероятность каждого равна доле.
 */
export function distributionOfEqualOutcomes(values: readonly number[]): DistributionEntry[] {
  if (values.length === 0) {
    throw new RangeError('В опыте должен быть хотя бы один исход');
  }
  values.forEach((value, index) => {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`Значение исхода №${index + 1} должно быть целым числом`);
    }
  });

  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([value, count]) => ({ value, probability: fraction(count, values.length) }));
}

/** Математическое ожидание: $M(X)=\sum x_i p_i$ — точной дробью. */
export function expectedValue(entries: readonly DistributionEntry[]): Fraction {
  assertCompleteDistribution(entries);
  let total: Fraction = ZERO;
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.value)) {
      throw new TypeError('Значение случайной величины должно быть целым числом');
    }
    total = addFractions(total, multiplyFractions(fraction(entry.value, 1), entry.probability));
  }
  return total;
}

/** Значения с наибольшей вероятностью; их может быть два соседних. */
export function mostLikelyValues(entries: readonly DistributionEntry[]): number[] {
  if (entries.length === 0) {
    throw new RangeError('У случайной величины должно быть хотя бы одно значение');
  }
  let best = entries[0]!.probability;
  for (const entry of entries) {
    if (compareFractions(entry.probability, best) > 0) best = entry.probability;
  }
  return entries.filter((entry) => compareFractions(entry.probability, best) === 0).map((entry) => entry.value);
}

/** Вероятность события $X\ge t$. */
export function probabilityAtLeast(entries: readonly DistributionEntry[], threshold: number): Fraction {
  return distributionTotal(entries.filter((entry) => entry.value >= threshold));
}

/** Вероятность события $X\le t$. */
export function probabilityAtMost(entries: readonly DistributionEntry[], threshold: number): Fraction {
  return distributionTotal(entries.filter((entry) => entry.value <= threshold));
}

/** Вероятность события $X=t$; для значения вне списка равна нулю. */
export function probabilityOfValue(entries: readonly DistributionEntry[], value: number): Fraction {
  return distributionTotal(entries.filter((entry) => entry.value === value));
}

/* ────────────────────────────  Схема Бернулли  ──────────────────────────── */

function powerOfFraction(base: Fraction, exponent: number): Fraction {
  assertCount(exponent, 'Показатель степени');
  let result: Fraction = ONE;
  for (let step = 0; step < exponent; step += 1) {
    result = multiplyFractions(result, base);
  }
  return result;
}

function assertTrials(trials: number): void {
  assertCount(trials, 'Число испытаний');
  if (trials < 1 || trials > MAX_BERNOULLI_TRIALS) {
    throw new RangeError(`Число испытаний должно быть целым от 1 до ${MAX_BERNOULLI_TRIALS}`);
  }
}

function prepareSuccess(success: Fraction, trials: number): Fraction {
  const value = assertProbabilityFraction(success, 'Вероятность успеха');
  if (value.denominator ** trials > Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Знаменатель вероятности слишком велик для такого числа испытаний');
  }
  return value;
}

/**
 * Формула Бернулли: $P_n(k)=C_n^k\,p^k\,(1-p)^{\,n-k}$.
 *
 * Три множителя отвечают трём вопросам: сколько путей приводят к $k$ успехам,
 * какова вероятность успехов и какова вероятность неудач вдоль одного пути.
 */
export function bernoulliProbability(trials: number, successes: number, success: Fraction): Fraction {
  assertTrials(trials);
  assertCount(successes, 'Число успехов');
  if (successes > trials) return ZERO;

  const p = prepareSuccess(success, trials);
  const q = subtractFractions(ONE, p);
  const paths = countToNumber(combinations(trials, successes), 'Число благоприятных путей');
  const alongOnePath = multiplyFractions(powerOfFraction(p, successes), powerOfFraction(q, trials - successes));
  return multiplyFractions(fraction(paths, 1), alongOnePath);
}

/**
 * Распределение случайной величины «число успехов в $n$ испытаниях»:
 * список из $n+1$ строки, сумма вероятностей которых равна 1.
 */
export function bernoulliDistribution(trials: number, success: Fraction): DistributionEntry[] {
  assertTrials(trials);
  prepareSuccess(success, trials);
  return Array.from({ length: trials + 1 }, (_unused, successes) => ({
    value: successes,
    probability: bernoulliProbability(trials, successes, success),
  }));
}

/** Приближённое десятичное значение вероятности — для подписи под точной дробью. */
export function approximateProbability(value: Fraction, digits = 4): number {
  if (!Number.isSafeInteger(digits) || digits < 0 || digits > 12) {
    throw new RangeError('Число знаков после запятой должно быть целым от 0 до 12');
  }
  const factor = 10 ** digits;
  return Math.round(fractionToNumber(value) * factor) / factor;
}
