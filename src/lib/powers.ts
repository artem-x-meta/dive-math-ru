import {
  type ExactInput,
  type ExactRational,
  compareExact,
  divideExact,
  multiplyExact,
  parseExact,
} from './exactRational';

export type PowerErrorCode =
  | 'invalid-exponent'
  | 'undefined-power'
  | 'non-natural-result'
  | 'limit-exceeded';

export class PowerError extends Error {
  readonly code: PowerErrorCode;

  constructor(code: PowerErrorCode, message: string) {
    super(message);
    this.name = 'PowerError';
    this.code = code;
  }
}

export const POWER_LIMITS = Object.freeze({
  /** Наибольший показатель, который разрешено вычислять точно. */
  maxExponent: 512,
  /** Наибольшее число десятичных знаков в точном результате. */
  maxResultDigits: 1024,
  /** Наибольшее число множителей в развёрнутой записи степени. */
  maxExpandedFactors: 24,
  /** Наибольший знаменатель, для которого ищем период десятичной дроби. */
  maxPeriodDenominator: 100_000,
  /** Наибольшее число знаков после запятой при округлении. */
  maxRoundingDigits: 30,
});

export type PowerRuleId = 'product' | 'quotient' | 'power-of-power';

export interface PowerRuleStep {
  readonly rule: PowerRuleId;
  readonly left: number;
  readonly right: number;
  readonly resultExponent: number;
  /** Число одинаковых множителей после раскрытия обеих частей. */
  readonly factorCount: number;
  readonly latex: string;
}

export interface PowerRuleCheck {
  readonly step: PowerRuleStep;
  /** Значение первой степени: a^m. */
  readonly leftValue: ExactRational;
  /** Значение второй степени: a^n; у степени степени второго множителя нет. */
  readonly rightValue: ExactRational | null;
  /** Ответ по свойству: a^(m+n), a^(m−n) или a^(mn). */
  readonly ruleValue: ExactRational;
  /** Ответ прямым действием над значениями степеней. */
  readonly directValue: ExactRational;
  readonly matches: boolean;
}

export type PowerSignReason =
  | 'zero-base'
  | 'zero-exponent'
  | 'positive-base'
  | 'even-exponent'
  | 'odd-exponent';

export interface PowerSignInfo {
  readonly sign: -1 | 0 | 1;
  readonly reason: PowerSignReason;
}

export interface StandardForm {
  /** Мантисса: точное значение с условием 1 ≤ |a| < 10. */
  readonly mantissa: ExactRational;
  /** Показатель степени десятки; для больших чисел он натуральный. */
  readonly exponent: number;
}

export interface DecimalExpansion {
  readonly negative: boolean;
  readonly integerPart: string;
  /** Знаки после запятой до начала периода. */
  readonly nonRepeating: string;
  /** Период; пустая строка у конечной дроби. */
  readonly repeating: string;
  readonly terminating: boolean;
}

export interface PowerTableRow {
  readonly exponent: number;
  readonly value: ExactRational;
}

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function digitCount(value: bigint): number {
  return absoluteBigInt(value).toString().length;
}

function integerPower(base: bigint, exponent: number): bigint {
  let result = 1n;
  let factor = base;
  let remaining = exponent;

  while (remaining > 0) {
    if (remaining % 2 === 1) result *= factor;
    remaining = Math.floor(remaining / 2);
    if (remaining > 0) factor *= factor;
  }

  return result;
}

function powerOfTen(exponent: number): ExactRational {
  return exponent >= 0
    ? parseExact({ numerator: integerPower(10n, exponent), denominator: 1n })
    : parseExact({ numerator: 1n, denominator: integerPower(10n, -exponent) });
}

function assertExponent(exponent: number, minimum: number): void {
  if (!Number.isSafeInteger(exponent) || exponent < minimum) {
    throw new PowerError(
      'invalid-exponent',
      `Показатель степени должен быть целым числом не меньше ${minimum}.`,
    );
  }
  if (exponent > POWER_LIMITS.maxExponent) {
    throw new PowerError(
      'limit-exceeded',
      `Показатель степени не должен превышать ${POWER_LIMITS.maxExponent}.`,
    );
  }
}

function assertPowerSize(value: ExactRational, exponent: number): void {
  const widest = Math.max(digitCount(value.numerator), digitCount(value.denominator));
  const estimate = widest === 1 ? 1 : (widest - 1) * exponent + 1;
  if (estimate > POWER_LIMITS.maxResultDigits) {
    throw new PowerError(
      'limit-exceeded',
      `Точное значение степени длиннее ${POWER_LIMITS.maxResultDigits} знаков.`,
    );
  }
}

/**
 * Возводит точное рациональное число в степень с натуральным показателем.
 * Показатель 0 допускается для любого основания, кроме нуля: 0^0 не определено.
 */
export function powerExact(base: ExactInput, exponent: number): ExactRational {
  assertExponent(exponent, 0);
  const value = parseExact(base);

  if (value.numerator === 0n) {
    if (exponent === 0) {
      throw new PowerError('undefined-power', 'Выражение 0^0 не определено.');
    }
    return parseExact(0);
  }

  if (exponent === 0) return parseExact(1);
  assertPowerSize(value, exponent);

  return parseExact({
    numerator: integerPower(value.numerator, exponent),
    denominator: integerPower(value.denominator, exponent),
  });
}

/** Определяет знак степени, не вычисляя её значение. */
export function powerSign(base: ExactInput, exponent: number): PowerSignInfo {
  assertExponent(exponent, 0);
  const value = parseExact(base);

  if (value.numerator === 0n) {
    if (exponent === 0) {
      throw new PowerError('undefined-power', 'Выражение 0^0 не определено.');
    }
    return { sign: 0, reason: 'zero-base' };
  }
  if (exponent === 0) return { sign: 1, reason: 'zero-exponent' };
  if (value.numerator > 0n) return { sign: 1, reason: 'positive-base' };

  return exponent % 2 === 0
    ? { sign: 1, reason: 'even-exponent' }
    : { sign: -1, reason: 'odd-exponent' };
}

function needsBrackets(label: string): boolean {
  return /[^0-9A-Za-zА-Яа-яЁё]/.test(label);
}

/** Возвращает список одинаковых множителей развёрнутой степени. */
export function expandPowerFactors(baseLabel: string, exponent: number): string[] {
  assertExponent(exponent, 1);
  if (exponent > POWER_LIMITS.maxExpandedFactors) {
    throw new PowerError(
      'limit-exceeded',
      `Развернуть можно не больше ${POWER_LIMITS.maxExpandedFactors} множителей.`,
    );
  }

  const token = needsBrackets(baseLabel) ? `(${baseLabel})` : baseLabel;
  return Array.from({ length: exponent }, () => token);
}

/** Записывает степень как произведение одинаковых множителей. */
export function expandPower(baseLabel: string, exponent: number): string {
  return expandPowerFactors(baseLabel, exponent).join(' · ');
}

/**
 * Применяет одно свойство степеней с одинаковым основанием и возвращает
 * показатель результата вместе с готовой записью равенства.
 */
export function applyPowerRule(
  rule: PowerRuleId,
  left: number,
  right: number,
  baseLabel = 'a',
): PowerRuleStep {
  assertExponent(left, 1);
  assertExponent(right, 1);

  let resultExponent: number;
  let operator: string;

  switch (rule) {
    case 'product':
      resultExponent = left + right;
      operator = '\\cdot';
      break;
    case 'quotient':
      if (left < right) {
        throw new PowerError(
          'non-natural-result',
          'В 7 классе частное степеней рассматривают при m ≥ n: показатель результата должен остаться неотрицательным.',
        );
      }
      resultExponent = left - right;
      operator = ':';
      break;
    case 'power-of-power':
      resultExponent = left * right;
      operator = '';
      break;
    default:
      throw new PowerError('invalid-exponent', 'Неизвестное свойство степеней.');
  }

  if (resultExponent > POWER_LIMITS.maxExponent) {
    throw new PowerError(
      'limit-exceeded',
      `Показатель результата не должен превышать ${POWER_LIMITS.maxExponent}.`,
    );
  }

  const base = needsBrackets(baseLabel) ? `(${baseLabel})` : baseLabel;
  const latex = rule === 'power-of-power'
    ? `\\left(${base}^{${left}}\\right)^{${right}} = ${base}^{${resultExponent}}`
    : `${base}^{${left}} ${operator} ${base}^{${right}} = ${base}^{${resultExponent}}`;

  return {
    rule,
    left,
    right,
    resultExponent,
    factorCount: rule === 'power-of-power' ? left * right : left + right,
    latex,
  };
}

/** Проверяет свойство степеней на конкретном основании точной арифметикой. */
export function checkPowerRule(
  rule: PowerRuleId,
  base: ExactInput,
  left: number,
  right: number,
  baseLabel?: string,
): PowerRuleCheck {
  const value = parseExact(base);
  if (rule === 'quotient' && value.numerator === 0n) {
    throw new PowerError('undefined-power', 'Частное степеней требует основания, отличного от нуля.');
  }

  const step = applyPowerRule(rule, left, right, baseLabel ?? 'a');
  const leftValue = powerExact(value, left);
  const rightValue = rule === 'power-of-power' ? null : powerExact(value, right);
  const ruleValue = powerExact(value, step.resultExponent);
  // Прямое действие выполняем над значениями степеней, а не по свойству:
  // только тогда совпадение подтверждает правило, а не повторяет его.
  const directValue = rightValue === null
    ? powerExact(leftValue, right)
    : rule === 'product'
      ? multiplyExact(leftValue, rightValue)
      : divideExact(leftValue, rightValue);

  return {
    step,
    leftValue,
    rightValue,
    ruleValue,
    directValue,
    matches: compareExact(ruleValue, directValue) === 0,
  };
}

/** Строит таблицу значений степени для показателей от 1 до maxExponent. */
export function powerTable(base: ExactInput, maxExponent: number): PowerTableRow[] {
  assertExponent(maxExponent, 1);
  if (maxExponent > POWER_LIMITS.maxExpandedFactors) {
    throw new PowerError(
      'limit-exceeded',
      `Таблица строится не более чем до показателя ${POWER_LIMITS.maxExpandedFactors}.`,
    );
  }

  const value = parseExact(base);
  return Array.from({ length: maxExponent }, (_, index) => ({
    exponent: index + 1,
    value: powerExact(value, index + 1),
  }));
}

/**
 * Приводит число к стандартному виду a · 10^n, где 1 ≤ |a| < 10.
 * У нуля стандартного вида нет.
 */
export function toStandardForm(value: ExactInput): StandardForm {
  const exact = parseExact(value);
  if (exact.numerator === 0n) {
    throw new PowerError('undefined-power', 'У числа 0 нет стандартного вида.');
  }

  const negative = exact.numerator < 0n;
  const numerator = absoluteBigInt(exact.numerator);
  const denominator = exact.denominator;
  let exponent = digitCount(numerator) - digitCount(denominator);

  const atLeastTen = (candidate: number): boolean => {
    // Проверяем 10^candidate ≤ numerator / denominator без деления.
    const scale = powerOfTen(candidate);
    return scale.numerator * denominator <= numerator * scale.denominator;
  };

  while (!atLeastTen(exponent)) exponent -= 1;
  while (atLeastTen(exponent + 1)) exponent += 1;

  if (Math.abs(exponent) > POWER_LIMITS.maxExponent) {
    throw new PowerError('limit-exceeded', 'Порядок числа выходит за допустимый диапазон.');
  }

  const scale = powerOfTen(exponent);
  const mantissa = parseExact({
    numerator: (negative ? -1n : 1n) * numerator * scale.denominator,
    denominator: denominator * scale.numerator,
  });

  return { mantissa, exponent };
}

/** Восстанавливает обычную запись числа из стандартного вида. */
export function fromStandardForm(form: StandardForm): ExactRational {
  assertExponent(Math.abs(form.exponent), 0);
  const mantissa = parseExact(form.mantissa);
  const scale = powerOfTen(form.exponent);
  return parseExact({
    numerator: mantissa.numerator * scale.numerator,
    denominator: mantissa.denominator * scale.denominator,
  });
}

/** Проверяет, что мантисса удовлетворяет условию 1 ≤ |a| < 10. */
export function isStandardMantissa(value: ExactInput): boolean {
  const exact = parseExact(value);
  if (exact.numerator === 0n) return false;
  const positive = parseExact({
    numerator: absoluteBigInt(exact.numerator),
    denominator: exact.denominator,
  });
  return compareExact(positive, 1) >= 0 && compareExact(positive, 10) < 0;
}

/**
 * Раскладывает точное число в десятичную запись: конечную либо
 * бесконечную периодическую с явно выделенным периодом.
 */
export function decimalExpansion(value: ExactInput): DecimalExpansion {
  const exact = parseExact(value);
  const negative = exact.numerator < 0n;
  const numerator = absoluteBigInt(exact.numerator);
  const denominator = exact.denominator;
  const integerPart = (numerator / denominator).toString();
  let remainder = numerator % denominator;

  if (remainder === 0n) {
    return { negative, integerPart, nonRepeating: '', repeating: '', terminating: true };
  }
  if (denominator > BigInt(POWER_LIMITS.maxPeriodDenominator)) {
    throw new PowerError(
      'limit-exceeded',
      `Период ищем только для знаменателей не больше ${POWER_LIMITS.maxPeriodDenominator}.`,
    );
  }

  const seen = new Map<bigint, number>();
  const digits: string[] = [];

  while (remainder !== 0n && !seen.has(remainder)) {
    seen.set(remainder, digits.length);
    remainder *= 10n;
    digits.push((remainder / denominator).toString());
    remainder %= denominator;
  }

  if (remainder === 0n) {
    return {
      negative,
      integerPart,
      nonRepeating: digits.join(''),
      repeating: '',
      terminating: true,
    };
  }

  const start = seen.get(remainder) ?? 0;
  return {
    negative,
    integerPart,
    nonRepeating: digits.slice(0, start).join(''),
    repeating: digits.slice(start).join(''),
    terminating: false,
  };
}

export interface DivisionStep {
  /** Остаток, с которым начинается шаг деления в столбик. */
  readonly remainderBefore: number;
  readonly digit: number;
  readonly remainderAfter: number;
}

export interface DecimalDivision {
  readonly integerPart: string;
  readonly negative: boolean;
  readonly steps: DivisionStep[];
  /** Номер шага, с которого остатки начинают повторяться; null у конечной дроби. */
  readonly repeatStart: number | null;
  readonly terminating: boolean;
  /** true, если деление оборвано по ограничению на число шагов. */
  readonly truncated: boolean;
}

/**
 * Выполняет деление в столбик и показывает остатки: именно их повторение
 * объясняет, почему у бесконечной десятичной дроби появляется период.
 */
export function decimalDivisionSteps(value: ExactInput, maxSteps = 24): DecimalDivision {
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1) {
    throw new PowerError('invalid-exponent', 'Число шагов деления должно быть целым и положительным.');
  }

  const exact = parseExact(value);
  const negative = exact.numerator < 0n;
  const numerator = absoluteBigInt(exact.numerator);
  const denominator = exact.denominator;
  const integerPart = (numerator / denominator).toString();
  let remainder = numerator % denominator;

  if (denominator > BigInt(POWER_LIMITS.maxPeriodDenominator)) {
    throw new PowerError(
      'limit-exceeded',
      `Деление в столбик показываем только для знаменателей не больше ${POWER_LIMITS.maxPeriodDenominator}.`,
    );
  }

  const steps: DivisionStep[] = [];
  const seen = new Map<bigint, number>();
  let repeatStart: number | null = null;

  while (remainder !== 0n && steps.length < maxSteps) {
    const known = seen.get(remainder);
    if (known !== undefined) {
      repeatStart = known;
      break;
    }

    seen.set(remainder, steps.length);
    const scaled = remainder * 10n;
    const digit = Number(scaled / denominator);
    const next = scaled % denominator;
    steps.push({
      remainderBefore: Number(remainder),
      digit,
      remainderAfter: Number(next),
    });
    remainder = next;
  }

  return {
    integerPart,
    negative,
    steps,
    repeatStart,
    terminating: remainder === 0n,
    truncated: remainder !== 0n && repeatStart === null,
  };
}

/** Записывает разложение по-русски: 0,41(6). */
export function formatDecimalExpansion(expansion: DecimalExpansion): string {
  const sign = expansion.negative ? '−' : '';
  const fractional = expansion.repeating
    ? `${expansion.nonRepeating}(${expansion.repeating})`
    : expansion.nonRepeating;
  return fractional.length === 0
    ? `${sign}${expansion.integerPart}`
    : `${sign}${expansion.integerPart},${fractional}`;
}

/** Конечна ли десятичная запись числа. */
export function isTerminatingDecimal(value: ExactInput): boolean {
  const exact = parseExact(value);
  let remaining = exact.denominator;
  while (remaining % 2n === 0n) remaining /= 2n;
  while (remaining % 5n === 0n) remaining /= 5n;
  return remaining === 1n;
}

export interface TerminatingCheck {
  /** Знаменатель несократимой дроби. */
  readonly denominator: number;
  readonly twos: number;
  readonly fives: number;
  /** То, что осталось после деления на двойки и пятёрки. */
  readonly otherFactor: number;
  readonly terminating: boolean;
}

/**
 * Разбирает знаменатель несократимой дроби на двойки, пятёрки и остальное:
 * именно «остальное» отвечает за появление бесконечного периода.
 */
export function terminatingCheck(value: ExactInput): TerminatingCheck {
  const exact = parseExact(value);
  if (exact.denominator > BigInt(POWER_LIMITS.maxPeriodDenominator)) {
    throw new PowerError(
      'limit-exceeded',
      `Знаменатель должен быть не больше ${POWER_LIMITS.maxPeriodDenominator}.`,
    );
  }

  let remaining = exact.denominator;
  let twos = 0;
  let fives = 0;
  while (remaining % 2n === 0n) {
    remaining /= 2n;
    twos += 1;
  }
  while (remaining % 5n === 0n) {
    remaining /= 5n;
    fives += 1;
  }

  return {
    denominator: Number(exact.denominator),
    twos,
    fives,
    otherFactor: Number(remaining),
    terminating: remaining === 1n,
  };
}

/** Длина периода десятичной записи; 0 у конечной дроби. */
export function periodLength(value: ExactInput): number {
  return decimalExpansion(value).repeating.length;
}

/** Округляет точное число до заданного числа знаков после запятой (половину — от нуля). */
export function roundExact(value: ExactInput, decimals: number): ExactRational {
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > POWER_LIMITS.maxRoundingDigits) {
    throw new PowerError(
      'invalid-exponent',
      `Число знаков после запятой должно быть целым от 0 до ${POWER_LIMITS.maxRoundingDigits}.`,
    );
  }

  const exact = parseExact(value);
  const scale = integerPower(10n, decimals);
  const negative = exact.numerator < 0n;
  const numerator = absoluteBigInt(exact.numerator) * scale;
  const denominator = exact.denominator;
  let quotient = numerator / denominator;
  if ((numerator % denominator) * 2n >= denominator) quotient += 1n;

  return parseExact({
    numerator: negative ? -quotient : quotient,
    denominator: scale,
  });
}

/** Модуль разности между точным значением и его округлением. */
export function roundingError(value: ExactInput, decimals: number): ExactRational {
  const exact = parseExact(value);
  const rounded = roundExact(exact, decimals);
  const difference = exact.numerator * rounded.denominator - rounded.numerator * exact.denominator;
  return parseExact({
    numerator: absoluteBigInt(difference),
    denominator: exact.denominator * rounded.denominator,
  });
}
