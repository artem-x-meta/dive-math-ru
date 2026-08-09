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

/**
 * Точное ядро главы «Последовательности».
 *
 * Все вычисления идут через рациональные числа из `exactRational`, поэтому
 * 1{,}07^{10} и сумма геометрической прогрессии со знаменателем 1/3 считаются
 * без накопления ошибки двоичной дроби. Округление появляется только там, где
 * его просят явно (`roundExact`, `formatFixed`, `approximate`).
 */

export const SEQUENCE_LIMITS = Object.freeze({
  /** Наибольший номер члена, который разрешено вычислять. */
  maxIndex: 2_000,
  /** Наибольшее число членов в одном списке. */
  maxCount: 200,
  /** Наибольший показатель степени. */
  maxExponent: 512,
  /** Наибольшее число знаков после запятой при округлении. */
  maxDecimals: 12,
});

const ONE = parseExact(1);
const ZERO = parseExact(0);
const HUNDRED = parseExact(100);

function assertInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} должно быть целым числом`);
  }
  return value;
}

function assertIndex(index: number, label = 'Номер члена'): number {
  assertInteger(index, label);
  if (index < 1) {
    throw new RangeError(`${label} нумеруется с единицы`);
  }
  if (index > SEQUENCE_LIMITS.maxIndex) {
    throw new RangeError(`${label} не может превышать ${SEQUENCE_LIMITS.maxIndex}`);
  }
  return index;
}

function assertCount(count: number, label = 'Число членов'): number {
  assertInteger(count, label);
  if (count < 1) {
    throw new RangeError(`${label} должно быть положительным`);
  }
  if (count > SEQUENCE_LIMITS.maxCount) {
    throw new RangeError(`${label} не может превышать ${SEQUENCE_LIMITS.maxCount}`);
  }
  return count;
}

function isZero(value: ExactRational): boolean {
  return value.numerator === 0n;
}

/** Возводит точное рациональное число в целую степень быстрым алгоритмом. */
export function exactPower(base: ExactInput, exponent: number): ExactRational {
  assertInteger(exponent, 'Показатель степени');
  if (Math.abs(exponent) > SEQUENCE_LIMITS.maxExponent) {
    throw new RangeError(`Показатель степени не может превышать ${SEQUENCE_LIMITS.maxExponent} по модулю`);
  }

  const value = parseExact(base);
  if (exponent === 0) {
    if (isZero(value)) {
      throw new RangeError('Выражение 0^0 не определено');
    }
    return ONE;
  }
  if (exponent < 0) {
    if (isZero(value)) {
      throw new RangeError('Ноль нельзя возводить в отрицательную степень');
    }
    return divideExact(ONE, exactPower(value, -exponent));
  }

  let result = ONE;
  let factor = value;
  let remaining = exponent;

  while (remaining > 0) {
    if (remaining % 2 === 1) result = multiplyExact(result, factor);
    remaining = Math.floor(remaining / 2);
    if (remaining > 0) factor = multiplyExact(factor, factor);
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Общий способ задания: рекуррентная формула x_{n+1} = m * x_n + c     */
/* ------------------------------------------------------------------ */

export interface Recurrence {
  readonly first: ExactRational;
  readonly multiplier: ExactRational;
  readonly addend: ExactRational;
}

export function recurrence(first: ExactInput, multiplier: ExactInput, addend: ExactInput): Recurrence {
  return {
    first: parseExact(first),
    multiplier: parseExact(multiplier),
    addend: parseExact(addend),
  };
}

/** Первые `count` членов последовательности, заданной рекуррентно. */
export function recurrenceTerms(rule: Recurrence, count: number): ExactRational[] {
  assertCount(count);
  const terms: ExactRational[] = [rule.first];

  for (let step = 1; step < count; step += 1) {
    const previous = terms[step - 1]!;
    terms.push(addExact(multiplyExact(rule.multiplier, previous), rule.addend));
  }

  return terms;
}

/* ------------------------------------------------------------------ */
/* Арифметическая прогрессия                                            */
/* ------------------------------------------------------------------ */

export interface ArithmeticProgression {
  readonly first: ExactRational;
  readonly difference: ExactRational;
}

export function arithmeticProgression(first: ExactInput, difference: ExactInput): ArithmeticProgression {
  return { first: parseExact(first), difference: parseExact(difference) };
}

/** a_n = a_1 + (n − 1)d. */
export function arithmeticTerm(progression: ArithmeticProgression, index: number): ExactRational {
  assertIndex(index);
  return addExact(progression.first, multiplyExact(progression.difference, index - 1));
}

export function arithmeticTerms(progression: ArithmeticProgression, count: number): ExactRational[] {
  assertCount(count);
  return Array.from({ length: count }, (_unused, offset) => arithmeticTerm(progression, offset + 1));
}

/** S_n = n(2a_1 + (n − 1)d) / 2. */
export function arithmeticSum(progression: ArithmeticProgression, count: number): ExactRational {
  assertCount(count);
  const doubleFirst = multiplyExact(progression.first, 2);
  const spread = multiplyExact(progression.difference, count - 1);
  return divideExact(multiplyExact(addExact(doubleFirst, spread), count), 2);
}

/** Номер члена, равного `value`, или null, если такого члена нет. */
export function arithmeticIndexOf(progression: ArithmeticProgression, value: ExactInput): number | null {
  const target = parseExact(value);
  const shift = subtractExact(target, progression.first);

  if (isZero(progression.difference)) {
    return isZero(shift) ? 1 : null;
  }

  const steps = divideExact(shift, progression.difference);
  if (steps.denominator !== 1n) return null;

  const index = Number(steps.numerator) + 1;
  if (!Number.isSafeInteger(index) || index < 1 || index > SEQUENCE_LIMITS.maxIndex) return null;
  return index;
}

/** Восстанавливает прогрессию по двум её членам с разными номерами. */
export function arithmeticFromTwoTerms(
  indexA: number,
  valueA: ExactInput,
  indexB: number,
  valueB: ExactInput,
): ArithmeticProgression {
  assertIndex(indexA, 'Номер первого известного члена');
  assertIndex(indexB, 'Номер второго известного члена');
  if (indexA === indexB) {
    throw new RangeError('Нужны два члена с разными номерами');
  }

  const difference = divideExact(
    subtractExact(parseExact(valueB), parseExact(valueA)),
    indexB - indexA,
  );
  const first = subtractExact(parseExact(valueA), multiplyExact(difference, indexA - 1));
  return { first, difference };
}

/* ------------------------------------------------------------------ */
/* Геометрическая прогрессия                                            */
/* ------------------------------------------------------------------ */

export interface GeometricProgression {
  readonly first: ExactRational;
  readonly ratio: ExactRational;
}

export function geometricProgression(first: ExactInput, ratio: ExactInput): GeometricProgression {
  const exactFirst = parseExact(first);
  const exactRatio = parseExact(ratio);
  if (isZero(exactFirst)) {
    throw new RangeError('Первый член геометрической прогрессии не может быть нулём');
  }
  if (isZero(exactRatio)) {
    throw new RangeError('Знаменатель геометрической прогрессии не может быть нулём');
  }
  return { first: exactFirst, ratio: exactRatio };
}

/** b_n = b_1 q^{n−1}. */
export function geometricTerm(progression: GeometricProgression, index: number): ExactRational {
  assertIndex(index);
  return multiplyExact(progression.first, exactPower(progression.ratio, index - 1));
}

export function geometricTerms(progression: GeometricProgression, count: number): ExactRational[] {
  assertCount(count);
  return Array.from({ length: count }, (_unused, offset) => geometricTerm(progression, offset + 1));
}

/** S_n = b_1(q^n − 1)/(q − 1), а при q = 1 сумма равна n·b_1. */
export function geometricSum(progression: GeometricProgression, count: number): ExactRational {
  assertCount(count);
  if (compareExact(progression.ratio, ONE) === 0) {
    return multiplyExact(progression.first, count);
  }

  const numerator = subtractExact(exactPower(progression.ratio, count), ONE);
  const denominator = subtractExact(progression.ratio, ONE);
  return multiplyExact(progression.first, divideExact(numerator, denominator));
}

/* ------------------------------------------------------------------ */
/* Распознавание вида последовательности                                */
/* ------------------------------------------------------------------ */

export interface SequenceKind {
  readonly isArithmetic: boolean;
  readonly difference: ExactRational | null;
  readonly isGeometric: boolean;
  readonly ratio: ExactRational | null;
}

/** Проверяет, является ли список первых членов прогрессией, и находит d и q. */
export function classifySequence(values: readonly ExactInput[]): SequenceKind {
  if (values.length < 3) {
    throw new RangeError('Для распознавания нужно не меньше трёх членов');
  }

  const terms = values.map((value) => parseExact(value));
  const difference = subtractExact(terms[1]!, terms[0]!);
  let isArithmetic = true;

  for (let index = 1; index + 1 < terms.length; index += 1) {
    const step = subtractExact(terms[index + 1]!, terms[index]!);
    if (compareExact(step, difference) !== 0) {
      isArithmetic = false;
      break;
    }
  }

  let isGeometric = terms.every((term) => !isZero(term));
  let ratio: ExactRational | null = isGeometric ? divideExact(terms[1]!, terms[0]!) : null;

  if (isGeometric && ratio !== null) {
    for (let index = 1; index + 1 < terms.length; index += 1) {
      const step = divideExact(terms[index + 1]!, terms[index]!);
      if (compareExact(step, ratio) !== 0) {
        isGeometric = false;
        ratio = null;
        break;
      }
    }
  }

  return {
    isArithmetic,
    difference: isArithmetic ? difference : null,
    isGeometric,
    ratio,
  };
}

/* ------------------------------------------------------------------ */
/* Проценты и рост                                                      */
/* ------------------------------------------------------------------ */

/** Множитель одного шага: 1 + p/100. */
export function growthFactor(ratePercent: ExactInput): ExactRational {
  const factor = addExact(ONE, divideExact(parseExact(ratePercent), HUNDRED));
  if (compareExact(factor, ZERO) < 0) {
    throw new RangeError('Величина не может уменьшиться больше чем на 100 %');
  }
  return factor;
}

/** Сложный процент: A = A_0(1 + p/100)^n. */
export function compoundAmount(principal: ExactInput, ratePercent: ExactInput, periods: number): ExactRational {
  assertInteger(periods, 'Число периодов');
  if (periods < 0) {
    throw new RangeError('Число периодов не может быть отрицательным');
  }
  const factor = growthFactor(ratePercent);
  if (periods === 0) return parseExact(principal);
  return multiplyExact(parseExact(principal), exactPower(factor, periods));
}

/** Простой процент: A = A_0(1 + n·p/100). */
export function simpleAmount(principal: ExactInput, ratePercent: ExactInput, periods: number): ExactRational {
  assertInteger(periods, 'Число периодов');
  if (periods < 0) {
    throw new RangeError('Число периодов не может быть отрицательным');
  }
  const share = divideExact(multiplyExact(parseExact(ratePercent), periods), HUNDRED);
  return multiplyExact(parseExact(principal), addExact(ONE, share));
}

/** Суммарное изменение в процентах за n шагов сложного процента. */
export function totalPercentChange(ratePercent: ExactInput, periods: number): ExactRational {
  assertInteger(periods, 'Число периодов');
  if (periods < 0) {
    throw new RangeError('Число периодов не может быть отрицательным');
  }
  const factor = periods === 0 ? ONE : exactPower(growthFactor(ratePercent), periods);
  return multiplyExact(subtractExact(factor, ONE), HUNDRED);
}

/** Итоговый множитель нескольких последовательных изменений в процентах. */
export function chainedPercentFactor(rates: readonly ExactInput[]): ExactRational {
  return rates.reduce<ExactRational>((factor, rate) => multiplyExact(factor, growthFactor(rate)), ONE);
}

/** Наименьшее число шагов, за которое величина вырастет не меньше чем в `target` раз. */
export function periodsToReach(ratePercent: ExactInput, target: ExactInput): number {
  const factor = growthFactor(ratePercent);
  const goal = parseExact(target);

  if (compareExact(goal, ONE) <= 0) return 0;
  if (compareExact(factor, ONE) <= 0) {
    throw new RangeError('При неположительном росте цель недостижима');
  }

  let periods = 0;
  let value = ONE;
  while (compareExact(value, goal) < 0) {
    periods += 1;
    if (periods > SEQUENCE_LIMITS.maxIndex) {
      throw new RangeError('Цель не достигается за разумное число шагов');
    }
    value = multiplyExact(value, factor);
  }

  return periods;
}

/* ------------------------------------------------------------------ */
/* Линейный и экспоненциальный рост рядом                               */
/* ------------------------------------------------------------------ */

export interface GrowthPoint {
  readonly index: number;
  readonly linear: ExactRational;
  readonly exponential: ExactRational;
}

export interface GrowthComparison {
  readonly points: GrowthPoint[];
  /** Первый шаг, на котором экспоненциальный рост строго обгоняет линейный. */
  readonly crossoverIndex: number | null;
  readonly maxValue: ExactRational;
  readonly minValue: ExactRational;
  /** Абсолютная прибавка линейной модели за один шаг. */
  readonly step: ExactRational;
  readonly factor: ExactRational;
}

export interface GrowthOptions {
  readonly start: ExactInput;
  readonly ratePercent: ExactInput;
  readonly periods: number;
  /** Прибавка линейной модели за шаг; по умолчанию это простой процент start·p/100. */
  readonly step?: ExactInput;
}

/**
 * Считает обе модели на общей сетке шагов 0…n: линейную (равные прибавки) и
 * экспоненциальную (равные множители). Возвращает и границы значений, чтобы
 * график можно было построить в честном общем масштабе.
 */
export function compareGrowth(options: GrowthOptions): GrowthComparison {
  const periods = assertInteger(options.periods, 'Число шагов');
  if (periods < 1 || periods > SEQUENCE_LIMITS.maxCount) {
    throw new RangeError(`Число шагов должно быть от 1 до ${SEQUENCE_LIMITS.maxCount}`);
  }

  const start = parseExact(options.start);
  const factor = growthFactor(options.ratePercent);
  const step = options.step === undefined
    ? divideExact(multiplyExact(start, parseExact(options.ratePercent)), HUNDRED)
    : parseExact(options.step);

  const points: GrowthPoint[] = [];
  let crossoverIndex: number | null = null;
  let maxValue = start;
  let minValue = start;

  for (let index = 0; index <= periods; index += 1) {
    const linear = addExact(start, multiplyExact(step, index));
    const exponential = index === 0 ? start : multiplyExact(start, exactPower(factor, index));
    points.push({ index, linear, exponential });

    if (crossoverIndex === null && compareExact(exponential, linear) > 0) {
      crossoverIndex = index;
    }
    for (const value of [linear, exponential]) {
      if (compareExact(value, maxValue) > 0) maxValue = value;
      if (compareExact(value, minValue) < 0) minValue = value;
    }
  }

  return { points, crossoverIndex, maxValue, minValue, step, factor };
}

/* ------------------------------------------------------------------ */
/* Округление и запись                                                  */
/* ------------------------------------------------------------------ */

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function assertDecimals(decimals: number): number {
  assertInteger(decimals, 'Число знаков после запятой');
  if (decimals < 0 || decimals > SEQUENCE_LIMITS.maxDecimals) {
    throw new RangeError(`Число знаков после запятой должно быть от 0 до ${SEQUENCE_LIMITS.maxDecimals}`);
  }
  return decimals;
}

/** Округляет до `decimals` знаков по правилу «половина от нуля». */
export function roundExact(value: ExactInput, decimals: number): ExactRational {
  assertDecimals(decimals);
  const exact = parseExact(value);
  const scale = 10n ** BigInt(decimals);
  const scaledNumerator = exact.numerator * scale;
  const sign = scaledNumerator < 0n ? -1n : 1n;
  const magnitude = absoluteBigInt(scaledNumerator);
  const rounded = (2n * magnitude + exact.denominator) / (2n * exact.denominator);
  return parseExact({ numerator: sign * rounded, denominator: scale });
}

/** Запись числа по-русски: десятичная запятая, точная дробь при периодичности. */
export function formatExactValue(value: ExactInput): string {
  return formatExactRussian(value);
}

/** Запись с ровно `decimals` знаками после запятой — для денег и процентов. */
export function formatFixed(value: ExactInput, decimals: number): string {
  assertDecimals(decimals);
  const rounded = roundExact(value, decimals);
  const scale = 10n ** BigInt(decimals);
  const scaled = (rounded.numerator * scale) / rounded.denominator;
  const sign = scaled < 0n ? '−' : '';
  const digits = absoluteBigInt(scaled).toString().padStart(decimals + 1, '0');
  if (decimals === 0) return `${sign}${digits}`;
  return `${sign}${digits.slice(0, -decimals)},${digits.slice(-decimals)}`;
}

/** Приближённое значение с плавающей точкой — только для рисунков. */
export function approximate(value: ExactInput): number {
  return toExactNumber(value);
}

const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;

/**
 * Наименьшая «круглая» граница оси, не меньшая заданного значения. Нужна,
 * чтобы график двух моделей имел общий честный масштаб с читаемыми делениями.
 */
export function axisBound(value: ExactInput): ExactRational {
  const magnitude = approximate(value);
  if (!Number.isFinite(magnitude) || magnitude <= 0) return ONE;

  const exponent = Math.floor(Math.log10(magnitude));
  const base = 10 ** exponent;
  for (const factor of NICE_STEPS) {
    const candidate = parseExact((factor * base).toExponential(12));
    if (compareExact(candidate, value) >= 0) return candidate;
  }

  return parseExact((10 * base).toExponential(12));
}

/**
 * Равномерная шкала `0, bound/count, …, bound`. Деления вычисляются точно,
 * поэтому подписи оси не «плывут» и расстояния между ними действительно равны.
 */
export function axisTicks(bound: ExactInput, count: number): ExactRational[] {
  assertInteger(count, 'Число делений');
  if (count < 1 || count > 20) {
    throw new RangeError('Число делений должно быть от 1 до 20');
  }

  const upper = parseExact(bound);
  return Array.from({ length: count + 1 }, (_unused, slot) =>
    divideExact(multiplyExact(upper, slot), count));
}
