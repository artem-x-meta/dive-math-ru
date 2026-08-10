/**
 * Вычислительное ядро главы «Экспонента и логарифм» (11 класс).
 *
 * Четыре независимые части:
 *   1) степень с рациональным показателем: сокращение показателя, точный корень
 *      n-й степени и точное значение a^(p/q), когда оно рационально;
 *   2) рост показательной функции против степенной и линейной: таблица значений,
 *      честное окно рисунка и номер, начиная с которого экспонента впереди навсегда;
 *   3) логарифм: область допустимых значений, точное значение log_a b, когда оно
 *      рационально, и численная проверка свойств логарифмов;
 *   4) простейшие показательные и логарифмические уравнения и неравенства
 *      вместе с ОДЗ и записью ответа промежутком.
 *
 * Точная арифметика используется там, где она возможна (BigInt через
 * ExactRational), а числа с плавающей точкой — только для значений, у которых
 * конечной записи нет: log_2 5, 3^0,7 и координат точек кривой.
 */

import {
  type ExactInput,
  type ExactRational,
  compareExact,
  divideExact,
  formatExactRussian,
  parseExact,
  toExactNumber,
} from './exactRational';
import { powerExact } from './powers';
import { integerSquareRoot } from './roots';
import {
  type Box,
  type Point,
  numberText,
  reflectPoint,
  sampleSegments,
} from './functionsCore';

export type ExpLogErrorCode =
  | 'invalid-base'
  | 'invalid-argument'
  | 'invalid-exponent'
  | 'invalid-model'
  | 'limit-exceeded';

export class ExpLogError extends Error {
  readonly code: ExpLogErrorCode;

  constructor(code: ExpLogErrorCode, message: string) {
    super(message);
    this.name = 'ExpLogError';
    this.code = code;
  }
}

export const EXPLOG_LIMITS = Object.freeze({
  /** Наибольшая степень корня, которую разрешено извлекать. */
  maxRootDegree: 24,
  /** Наибольший по модулю числитель рационального показателя. */
  maxExponentNumerator: 128,
  /** Сколько знаменателей перебираем, когда ищем точное значение логарифма. */
  maxLogDenominator: 8,
  /** Диапазон числителей при том же переборе. */
  maxLogNumerator: 32,
  /** Наибольшее число строк в таблице роста. */
  maxTableRows: 40,
  /** Предел поиска момента, начиная с которого экспонента впереди навсегда. */
  maxLeadSearch: 400,
});

const TOLERANCE = 1e-9;

// ────────────────────────── Рациональный показатель ──────────────────────────

/** Рациональное число p/q в несократимом виде с положительным знаменателем. */
export interface RationalExponent {
  readonly numerator: number;
  readonly denominator: number;
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

/** Приводит показатель p/q к несократимому виду; знак уходит в числитель. */
export function reduceExponent(numerator: number, denominator: number): RationalExponent {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    throw new ExpLogError('invalid-exponent', 'Числитель и знаменатель показателя должны быть целыми числами.');
  }
  if (denominator === 0) {
    throw new ExpLogError('invalid-exponent', 'Знаменатель показателя не может быть равен нулю.');
  }
  if (Math.abs(numerator) > EXPLOG_LIMITS.maxExponentNumerator) {
    throw new ExpLogError('limit-exceeded', `Числитель показателя не должен превышать ${EXPLOG_LIMITS.maxExponentNumerator} по модулю.`);
  }
  if (Math.abs(denominator) > EXPLOG_LIMITS.maxRootDegree) {
    throw new ExpLogError('limit-exceeded', `Знаменатель показателя не должен превышать ${EXPLOG_LIMITS.maxRootDegree} по модулю.`);
  }

  if (numerator === 0) return { numerator: 0, denominator: 1 };
  const divisor = gcd(numerator, denominator) || 1;
  const sign = denominator < 0 ? -1 : 1;
  return {
    numerator: (sign * numerator) / divisor,
    denominator: Math.abs(denominator) / divisor,
  };
}

/** Сумма, разность и произведение рациональных показателей. */
export function addExponents(left: RationalExponent, right: RationalExponent): RationalExponent {
  const first = reduceExponent(left.numerator, left.denominator);
  const second = reduceExponent(right.numerator, right.denominator);
  return reduceExponent(
    first.numerator * second.denominator + second.numerator * first.denominator,
    first.denominator * second.denominator,
  );
}

export function subtractExponents(left: RationalExponent, right: RationalExponent): RationalExponent {
  return addExponents(left, { numerator: -right.numerator, denominator: right.denominator });
}

export function multiplyExponents(left: RationalExponent, right: RationalExponent): RationalExponent {
  const first = reduceExponent(left.numerator, left.denominator);
  const second = reduceExponent(right.numerator, right.denominator);
  return reduceExponent(first.numerator * second.numerator, first.denominator * second.denominator);
}

/** Числовое значение показателя. */
export function exponentValue(exponent: RationalExponent): number {
  const reduced = reduceExponent(exponent.numerator, exponent.denominator);
  return reduced.numerator / reduced.denominator;
}

/** Текстовая запись показателя: «3/2», «2», «−1/2». */
export function exponentText(exponent: RationalExponent): string {
  const reduced = reduceExponent(exponent.numerator, exponent.denominator);
  const sign = reduced.numerator < 0 ? '−' : '';
  const size = Math.abs(reduced.numerator);
  return reduced.denominator === 1 ? `${sign}${size}` : `${sign}${size}/${reduced.denominator}`;
}

const SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'] as const;

function superscript(value: number): string {
  const digits = Math.abs(value).toString().split('');
  const body = digits.map((digit) => SUPERSCRIPT_DIGITS[Number(digit)] ?? digit).join('');
  return value < 0 ? `⁻${body}` : body;
}

/** Запись a^(p/q) через знак корня: «√(a³)», «∛(a²)», «1/⁵√(a³)». */
export function radicalText(baseLabel: string, exponent: RationalExponent): string {
  const reduced = reduceExponent(exponent.numerator, exponent.denominator);
  const size = Math.abs(reduced.numerator);
  const negative = reduced.numerator < 0;

  if (reduced.denominator === 1) {
    const power = size === 1 ? baseLabel : `${baseLabel}${superscript(size)}`;
    return negative ? `1/${power}` : power;
  }

  const sign = reduced.denominator === 2 ? '√' : reduced.denominator === 3 ? '∛' : reduced.denominator === 4 ? '∜' : `${superscript(reduced.denominator)}√`;
  const inner = size === 1 ? baseLabel : `${baseLabel}${superscript(size)}`;
  const root = `${sign}(${inner})`;
  return negative ? `1/${root}` : root;
}

function bigAbs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/** Целая часть корня degree-й степени из неотрицательного BigInt. */
function bigNthRootFloor(value: bigint, degree: number): bigint {
  if (value < 0n) throw new ExpLogError('invalid-argument', 'Корень извлекаем только из неотрицательного числа.');
  if (degree === 1 || value < 2n) return value;

  const power = BigInt(degree);
  let high = 2n;
  while (high ** power <= value) high *= 2n;
  let low = high / 2n;
  while (low + 1n < high) {
    const middle = (low + high) / 2n;
    if (middle ** power <= value) low = middle;
    else high = middle;
  }
  return low;
}

function assertRootDegree(degree: number): void {
  if (!Number.isSafeInteger(degree) || degree < 1) {
    throw new ExpLogError('invalid-exponent', 'Степень корня должна быть натуральным числом.');
  }
  if (degree > EXPLOG_LIMITS.maxRootDegree) {
    throw new ExpLogError('limit-exceeded', `Степень корня не должна превышать ${EXPLOG_LIMITS.maxRootDegree}.`);
  }
}

/**
 * Точный корень degree-й степени из натурального числа; null, если корень
 * иррационален. Для квадратного корня переиспользуется ядро 8 класса.
 */
export function integerNthRoot(value: number, degree: number): number | null {
  assertRootDegree(degree);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ExpLogError('invalid-argument', 'Подкоренное число должно быть целым неотрицательным.');
  }
  if (degree === 2) {
    const root = integerSquareRoot(value);
    return root * root === value ? root : null;
  }

  const root = bigNthRootFloor(BigInt(value), degree);
  return root ** BigInt(degree) === BigInt(value) ? Number(root) : null;
}

/** Точный корень degree-й степени из положительного рационального числа. */
function exactNthRoot(value: ExactRational, degree: number): ExactRational | null {
  const numerator = bigNthRootFloor(bigAbs(value.numerator), degree);
  if (numerator ** BigInt(degree) !== bigAbs(value.numerator)) return null;
  const denominator = bigNthRootFloor(value.denominator, degree);
  if (denominator ** BigInt(degree) !== value.denominator) return null;
  return parseExact({ numerator, denominator });
}

function assertPositiveBase(base: ExactRational): void {
  if (base.numerator <= 0n) {
    throw new ExpLogError('invalid-base', 'Степень с рациональным показателем определена только для положительного основания.');
  }
}

/**
 * Точное значение a^(p/q) для положительного рационального a.
 * Возвращает null, если значение иррационально (например, 2^(1/2)).
 */
export function rationalPowerExact(base: ExactInput, numerator: number, denominator: number): ExactRational | null {
  const value = parseExact(base);
  assertPositiveBase(value);
  const exponent = reduceExponent(numerator, denominator);
  assertRootDegree(exponent.denominator);

  const root = exactNthRoot(value, exponent.denominator);
  if (root === null) return null;

  const power = powerExact(root, Math.abs(exponent.numerator));
  return exponent.numerator < 0 ? divideExact(1, power) : power;
}

/** Числовое значение a^(p/q) для положительного основания. */
export function rationalPowerValue(base: number, numerator: number, denominator: number): number {
  if (!Number.isFinite(base) || base <= 0) {
    throw new ExpLogError('invalid-base', 'Степень с рациональным показателем определена только для положительного основания.');
  }
  return Math.pow(base, exponentValue(reduceExponent(numerator, denominator)));
}

export type RationalPowerRuleId = 'product' | 'quotient' | 'power-of-power' | 'radical';

export interface RationalPowerCheck {
  readonly rule: RationalPowerRuleId;
  /** Показатель результата по свойству степеней. */
  readonly resultExponent: RationalExponent;
  /** Готовая запись равенства обычным текстом. */
  readonly text: string;
  /** Точное значение результата или null, если оно иррационально. */
  readonly exactValue: ExactRational | null;
  /** Значение левой части, посчитанное действиями над самими степенями. */
  readonly directValue: number;
  /** Значение правой части — по свойству. */
  readonly ruleValue: number;
  readonly matches: boolean;
}

/**
 * Проверяет свойство степеней с рациональными показателями на конкретном
 * основании: слева действие над значениями, справа — сложенный показатель.
 */
export function checkRationalPowerRule(
  rule: RationalPowerRuleId,
  base: ExactInput,
  first: RationalExponent,
  second: RationalExponent,
  baseLabel = 'a',
): RationalPowerCheck {
  const exact = parseExact(base);
  assertPositiveBase(exact);
  const baseValue = toExactNumber(exact);
  const left = reduceExponent(first.numerator, first.denominator);
  const right = reduceExponent(second.numerator, second.denominator);

  let resultExponent: RationalExponent;
  let directValue: number;
  let text: string;

  switch (rule) {
    case 'product':
      resultExponent = addExponents(left, right);
      directValue = rationalPowerValue(baseValue, left.numerator, left.denominator)
        * rationalPowerValue(baseValue, right.numerator, right.denominator);
      text = `${baseLabel}^(${exponentText(left)}) · ${baseLabel}^(${exponentText(right)}) = ${baseLabel}^(${exponentText(resultExponent)})`;
      break;
    case 'quotient':
      resultExponent = subtractExponents(left, right);
      directValue = rationalPowerValue(baseValue, left.numerator, left.denominator)
        / rationalPowerValue(baseValue, right.numerator, right.denominator);
      text = `${baseLabel}^(${exponentText(left)}) : ${baseLabel}^(${exponentText(right)}) = ${baseLabel}^(${exponentText(resultExponent)})`;
      break;
    case 'power-of-power':
      resultExponent = multiplyExponents(left, right);
      directValue = Math.pow(rationalPowerValue(baseValue, left.numerator, left.denominator), exponentValue(right));
      text = `(${baseLabel}^(${exponentText(left)}))^(${exponentText(right)}) = ${baseLabel}^(${exponentText(resultExponent)})`;
      break;
    case 'radical':
      // Определение: корень степени q из a^p — это ровно a^(p/q).
      // Второй показатель здесь не участвует, работает только первый.
      resultExponent = left;
      directValue = Math.pow(Math.pow(baseValue, left.numerator), 1 / left.denominator);
      text = `${radicalText(baseLabel, left)} = ${baseLabel}^(${exponentText(left)})`;
      break;
    default:
      throw new ExpLogError('invalid-exponent', 'Неизвестное свойство степеней.');
  }

  const ruleValue = rationalPowerValue(baseValue, resultExponent.numerator, resultExponent.denominator);
  const exactValue = rationalPowerExact(exact, resultExponent.numerator, resultExponent.denominator);

  return {
    rule,
    resultExponent,
    text,
    exactValue,
    directValue,
    ruleValue,
    matches: Math.abs(directValue - ruleValue) <= TOLERANCE * Math.max(1, Math.abs(ruleValue)),
  };
}

/** Русская запись точного значения: «2», «1/8», «0,25» — как в остальных главах. */
export function formatExact(value: ExactInput): string {
  return formatExactRussian(value);
}

// ─────────────────────── Рост: экспонента против степени ─────────────────────

export type GrowthKind = 'exponential' | 'power' | 'linear';

export const GROWTH_KINDS: readonly GrowthKind[] = Object.freeze(['exponential', 'power', 'linear'] as const);

/** Три соперника: y = a^x, y = x^k и y = c·x на отрезке [0; maxX]. */
export interface GrowthModel {
  readonly base: number;
  readonly degree: number;
  readonly slope: number;
  readonly maxX: number;
}

export interface GrowthRow {
  readonly x: number;
  readonly exponential: number;
  readonly power: number;
  readonly linear: number;
  readonly leader: GrowthKind | 'tie';
}

function assertGrowthModel(model: GrowthModel): void {
  if (!Number.isFinite(model.base) || model.base <= 1) {
    throw new ExpLogError('invalid-model', 'Основание роста должно быть больше единицы.');
  }
  if (!Number.isSafeInteger(model.degree) || model.degree < 1 || model.degree > 6) {
    throw new ExpLogError('invalid-model', 'Показатель степенной функции должен быть целым от 1 до 6.');
  }
  if (!Number.isFinite(model.slope) || model.slope <= 0) {
    throw new ExpLogError('invalid-model', 'Угловой коэффициент линейной функции должен быть положительным.');
  }
  if (!Number.isSafeInteger(model.maxX) || model.maxX < 2 || model.maxX > EXPLOG_LIMITS.maxTableRows) {
    throw new ExpLogError('invalid-model', `Правая граница должна быть целой от 2 до ${EXPLOG_LIMITS.maxTableRows}.`);
  }
}

/** Значение одного из трёх соперников в точке x. */
export function growthValue(model: GrowthModel, kind: GrowthKind, x: number): number {
  assertGrowthModel(model);
  if (!Number.isFinite(x)) {
    throw new ExpLogError('invalid-argument', 'Аргумент должен быть конечным числом.');
  }
  if (kind === 'exponential') return Math.pow(model.base, x);
  if (kind === 'linear') return model.slope * x;
  return x < 0 ? Math.pow(-x, model.degree) * (model.degree % 2 === 0 ? 1 : -1) : Math.pow(x, model.degree);
}

/** Таблица целых значений x от 0 до maxX с пометкой лидера в каждой строке. */
export function growthTable(model: GrowthModel): readonly GrowthRow[] {
  assertGrowthModel(model);
  const rows: GrowthRow[] = [];

  for (let x = 0; x <= model.maxX; x += 1) {
    const exponential = growthValue(model, 'exponential', x);
    const power = growthValue(model, 'power', x);
    const linear = growthValue(model, 'linear', x);
    const best = Math.max(exponential, power, linear);
    const leaders = GROWTH_KINDS.filter((kind) => {
      const value = kind === 'exponential' ? exponential : kind === 'power' ? power : linear;
      return Math.abs(value - best) <= TOLERANCE * Math.max(1, Math.abs(best));
    });
    rows.push({
      x,
      exponential,
      power,
      linear,
      leader: leaders.length === 1 ? leaders[0]! : 'tie',
    });
  }

  return rows;
}

/**
 * Наименьшее натуральное N, начиная с которого a^n > n^k для всех n ⩾ N.
 * Сравнение ведём через логарифмы: n·ln a и k·ln n растут медленно и не
 * переполняются, в отличие от самих значений.
 */
export function firstPermanentLead(model: GrowthModel, limit = EXPLOG_LIMITS.maxLeadSearch): number | null {
  assertGrowthModel(model);
  if (!Number.isSafeInteger(limit) || limit < 2 || limit > EXPLOG_LIMITS.maxLeadSearch) {
    throw new ExpLogError('limit-exceeded', `Предел поиска должен быть целым от 2 до ${EXPLOG_LIMITS.maxLeadSearch}.`);
  }

  const logBase = Math.log(model.base);
  let last = 0;
  for (let n = 1; n <= limit; n += 1) {
    if (n * logBase <= model.degree * Math.log(n) + TOLERANCE) last = n;
  }
  return last === limit ? null : last + 1;
}

/**
 * Окно рисунка: по вертикали хватает степенной и линейной кривой, а экспонента
 * честно уходит за верхнюю границу — именно это и надо увидеть.
 */
export function growthBox(model: GrowthModel): Box {
  assertGrowthModel(model);
  const top = Math.max(
    growthValue(model, 'power', model.maxX),
    growthValue(model, 'linear', model.maxX),
    1,
  );
  return { xMin: 0, xMax: model.maxX, yMin: 0, yMax: top * 1.1 };
}

/** Абсцисса, на которой экспонента покидает окно рисунка; null — не покидает. */
export function growthExit(model: GrowthModel): number | null {
  const box = growthBox(model);
  const exit = Math.log(box.yMax) / Math.log(model.base);
  return exit >= 0 && exit <= model.maxX ? exit : null;
}

/** Ломаные одной из трёх кривых внутри окна; каждая точка посчитана по формуле. */
export function growthSegments(model: GrowthModel, kind: GrowthKind, samples = 241): readonly Point[][] {
  const box = growthBox(model);
  return sampleSegments((x) => growthValue(model, kind, x), box, samples);
}

// ──────────────────────────────── Логарифм ───────────────────────────────────

export interface DomainCheck {
  readonly ok: boolean;
  readonly reason: string;
}

/** Проверка условий на основание логарифма: a > 0 и a ≠ 1. */
export function checkLogBase(base: number): DomainCheck {
  if (!Number.isFinite(base)) return { ok: false, reason: 'Основание должно быть числом.' };
  if (base <= 0) return { ok: false, reason: 'Основание логарифма должно быть положительным.' };
  if (Math.abs(base - 1) <= TOLERANCE) return { ok: false, reason: 'Основание логарифма не может равняться единице: 1 в любой степени даёт 1.' };
  return { ok: true, reason: 'Основание допустимо: оно положительно и не равно единице.' };
}

/** Полная проверка ОДЗ выражения log_a b. */
export function checkLogDomain(base: number, argument: number): DomainCheck {
  const baseCheck = checkLogBase(base);
  if (!baseCheck.ok) return baseCheck;
  if (!Number.isFinite(argument)) return { ok: false, reason: 'Аргумент должен быть числом.' };
  if (argument <= 0) {
    return { ok: false, reason: 'Под знаком логарифма должно стоять строго положительное число: показательная функция отрицательных значений не принимает.' };
  }
  return { ok: true, reason: 'ОДЗ выполнено: основание допустимо, аргумент положителен.' };
}

function assertLogDomain(base: number, argument: number): void {
  const check = checkLogDomain(base, argument);
  if (!check.ok) {
    throw new ExpLogError(argument <= 0 ? 'invalid-argument' : 'invalid-base', check.reason);
  }
}

/** Значение log_a b. Для оснований 2, 10 и e берём отдельные функции — они точнее. */
export function logValue(base: number, argument: number): number {
  assertLogDomain(base, argument);
  if (base === 2) return Math.log2(argument);
  if (base === 10) return Math.log10(argument);
  if (base === Math.E) return Math.log(argument);
  return Math.log(argument) / Math.log(base);
}

/** Значение показательной функции a^x при положительном основании. */
export function expValue(base: number, x: number): number {
  const check = checkLogBase(base);
  if (!check.ok) throw new ExpLogError('invalid-base', check.reason);
  if (!Number.isFinite(x)) throw new ExpLogError('invalid-argument', 'Показатель должен быть конечным числом.');
  return Math.pow(base, x);
}

/**
 * Точное значение log_a b, если оно рационально: перебираем несократимые
 * показатели p/q и проверяем равенство a^(p/q) = b точной арифметикой.
 */
export function exactLog(base: ExactInput, argument: ExactInput): RationalExponent | null {
  const exactBase = parseExact(base);
  const exactArgument = parseExact(argument);
  if (exactBase.numerator <= 0n || compareExact(exactBase, 1) === 0) {
    throw new ExpLogError('invalid-base', 'Основание логарифма должно быть положительным и не равным единице.');
  }
  if (exactArgument.numerator <= 0n) {
    throw new ExpLogError('invalid-argument', 'Под знаком логарифма должно стоять положительное число.');
  }
  if (compareExact(exactArgument, 1) === 0) return { numerator: 0, denominator: 1 };

  for (let denominator = 1; denominator <= EXPLOG_LIMITS.maxLogDenominator; denominator += 1) {
    for (let numerator = -EXPLOG_LIMITS.maxLogNumerator; numerator <= EXPLOG_LIMITS.maxLogNumerator; numerator += 1) {
      if (numerator === 0) continue;
      if (gcd(numerator, denominator) !== 1) continue;
      const candidate = rationalPowerExact(exactBase, numerator, denominator);
      if (candidate !== null && compareExact(candidate, exactArgument) === 0) {
        return { numerator, denominator };
      }
    }
  }

  return null;
}

/** Основное логарифмическое тождество: a^(log_a b) = b. */
export function logIdentityValue(base: number, argument: number): number {
  return Math.pow(base, logValue(base, argument));
}

export type LogRuleId = 'product' | 'quotient' | 'power' | 'change-base';

export interface LogRuleCheck {
  readonly rule: LogRuleId;
  readonly text: string;
  /** Левая часть: логарифм от составного выражения. */
  readonly leftValue: number;
  /** Правая часть: то же самое по свойству. */
  readonly rightValue: number;
  readonly matches: boolean;
}

/**
 * Численная проверка свойства логарифмов на конкретных числах.
 * Для 'change-base' роль второго числа играет новое основание.
 */
export function checkLogRule(rule: LogRuleId, base: number, first: number, second: number): LogRuleCheck {
  assertLogDomain(base, first);

  switch (rule) {
    case 'product': {
      assertLogDomain(base, second);
      const leftValue = logValue(base, first * second);
      const rightValue = logValue(base, first) + logValue(base, second);
      return {
        rule,
        text: `log_${numberText(base)}(${numberText(first)} · ${numberText(second)}) = log_${numberText(base)} ${numberText(first)} + log_${numberText(base)} ${numberText(second)}`,
        leftValue,
        rightValue,
        matches: Math.abs(leftValue - rightValue) <= TOLERANCE * Math.max(1, Math.abs(rightValue)),
      };
    }
    case 'quotient': {
      assertLogDomain(base, second);
      const leftValue = logValue(base, first / second);
      const rightValue = logValue(base, first) - logValue(base, second);
      return {
        rule,
        text: `log_${numberText(base)}(${numberText(first)} : ${numberText(second)}) = log_${numberText(base)} ${numberText(first)} − log_${numberText(base)} ${numberText(second)}`,
        leftValue,
        rightValue,
        matches: Math.abs(leftValue - rightValue) <= TOLERANCE * Math.max(1, Math.abs(rightValue)),
      };
    }
    case 'power': {
      if (!Number.isFinite(second)) {
        throw new ExpLogError('invalid-exponent', 'Показатель должен быть конечным числом.');
      }
      const leftValue = logValue(base, Math.pow(first, second));
      const rightValue = second * logValue(base, first);
      return {
        rule,
        text: `log_${numberText(base)}(${numberText(first)}^${numberText(second)}) = ${numberText(second)} · log_${numberText(base)} ${numberText(first)}`,
        leftValue,
        rightValue,
        matches: Math.abs(leftValue - rightValue) <= TOLERANCE * Math.max(1, Math.abs(rightValue)),
      };
    }
    case 'change-base': {
      const newBase = second;
      const check = checkLogBase(newBase);
      if (!check.ok) throw new ExpLogError('invalid-base', check.reason);
      const leftValue = logValue(base, first);
      const rightValue = logValue(newBase, first) / logValue(newBase, base);
      return {
        rule,
        text: `log_${numberText(base)} ${numberText(first)} = log_${numberText(newBase)} ${numberText(first)} : log_${numberText(newBase)} ${numberText(base)}`,
        leftValue,
        rightValue,
        matches: Math.abs(leftValue - rightValue) <= TOLERANCE * Math.max(1, Math.abs(rightValue)),
      };
    }
    default:
      throw new ExpLogError('invalid-argument', 'Неизвестное свойство логарифмов.');
  }
}

/** Пара «аргумент — значение» показательной функции и возврат по логарифму. */
export interface MirrorPair {
  readonly x: number;
  readonly exponential: number;
  readonly back: number;
}

export function mirrorPairs(base: number, probes: readonly number[]): readonly MirrorPair[] {
  const check = checkLogBase(base);
  if (!check.ok) throw new ExpLogError('invalid-base', check.reason);
  return probes.map((x) => {
    const exponential = expValue(base, x);
    return { x, exponential, back: logValue(base, exponential) };
  });
}

/** Ломаные графика y = a^x внутри окна. */
export function exponentialSegments(base: number, box: Box, samples = 321): readonly Point[][] {
  const check = checkLogBase(base);
  if (!check.ok) throw new ExpLogError('invalid-base', check.reason);
  return sampleSegments((x) => Math.pow(base, x), box, samples);
}

/** Ломаные графика y = log_a x внутри окна; при x ⩽ 0 значения нет. */
export function logarithmSegments(base: number, box: Box, samples = 321): readonly Point[][] {
  const check = checkLogBase(base);
  if (!check.ok) throw new ExpLogError('invalid-base', check.reason);
  return sampleSegments((x) => (x <= 0 ? null : logValue(base, x)), box, samples);
}

/** Отражение ломаных относительно прямой y = x. */
export function reflectSegments(segments: readonly Point[][]): readonly Point[][] {
  return segments.map((segment) => segment.map(reflectPoint));
}

// ────────────────── Уравнения, неравенства и запись ответа ───────────────────

export interface EquationSolution {
  readonly solvable: boolean;
  /** Числовое значение корня; null, если корней нет. */
  readonly x: number | null;
  /** Точное значение корня, если оно рационально. */
  readonly exact: RationalExponent | null;
  readonly explanation: string;
}

/** Простейшее показательное уравнение a^x = b. */
export function solveExponentialEquation(base: number, target: number): EquationSolution {
  const check = checkLogBase(base);
  if (!check.ok) throw new ExpLogError('invalid-base', check.reason);

  if (!Number.isFinite(target)) {
    throw new ExpLogError('invalid-argument', 'Правая часть должна быть конечным числом.');
  }
  if (target <= 0) {
    return {
      solvable: false,
      x: null,
      exact: null,
      explanation: 'Корней нет: показательная функция принимает только положительные значения, а справа стоит неположительное число.',
    };
  }

  const exact = exactLog(base, target);
  const x = logValue(base, target);
  return {
    solvable: true,
    x,
    exact,
    explanation: exact === null
      ? `Единственный корень x = log_${numberText(base)} ${numberText(target)}: показательная функция монотонна, поэтому значение достигается ровно один раз.`
      : `Единственный корень x = ${exponentText(exact)}: обе части приведены к одному основанию.`,
  };
}

/** Простейшее логарифмическое уравнение log_a(kx + m) = c. */
export function solveLogEquation(base: number, k: number, m: number, c: number): EquationSolution {
  const check = checkLogBase(base);
  if (!check.ok) throw new ExpLogError('invalid-base', check.reason);
  if (!Number.isFinite(k) || k === 0) {
    throw new ExpLogError('invalid-argument', 'Коэффициент при x не может быть равен нулю.');
  }
  if (!Number.isFinite(m) || !Number.isFinite(c)) {
    throw new ExpLogError('invalid-argument', 'Все коэффициенты должны быть конечными числами.');
  }

  const inner = Math.pow(base, c);
  const x = (inner - m) / k;
  const domain = checkLogDomain(base, k * x + m);

  return {
    solvable: domain.ok,
    x: domain.ok ? x : null,
    exact: null,
    explanation: domain.ok
      ? `Переходим к равенству kx + m = a^c: ${numberText(k)}x + ${numberText(m)} = ${numberText(inner)}, откуда x = ${numberText(x)}. ОДЗ выполнено автоматически: a^c > 0 при любом c.`
      : domain.reason,
  };
}

export type InequalitySign = '>' | '>=' | '<' | '<=';

/** Числовой промежуток; null у границы означает бесконечность. */
export interface SolutionInterval {
  readonly empty: boolean;
  readonly min: number | null;
  readonly max: number | null;
  readonly minOpen: boolean;
  readonly maxOpen: boolean;
}

export const EMPTY_INTERVAL: SolutionInterval = Object.freeze({
  empty: true,
  min: null,
  max: null,
  minOpen: true,
  maxOpen: true,
});

export const ALL_NUMBERS: SolutionInterval = Object.freeze({
  empty: false,
  min: null,
  max: null,
  minOpen: true,
  maxOpen: true,
});

function makeInterval(
  min: number | null,
  max: number | null,
  minOpen: boolean,
  maxOpen: boolean,
): SolutionInterval {
  if (min !== null && max !== null) {
    if (min > max) return EMPTY_INTERVAL;
    if (min === max && (minOpen || maxOpen)) return EMPTY_INTERVAL;
  }
  return { empty: false, min, max, minOpen, maxOpen };
}

/** Пересечение двух промежутков. */
export function intersectIntervals(left: SolutionInterval, right: SolutionInterval): SolutionInterval {
  if (left.empty || right.empty) return EMPTY_INTERVAL;

  let min = left.min;
  let minOpen = left.minOpen;
  if (right.min !== null && (min === null || right.min > min || (right.min === min && right.minOpen))) {
    min = right.min;
    minOpen = right.minOpen;
  }

  let max = left.max;
  let maxOpen = left.maxOpen;
  if (right.max !== null && (max === null || right.max < max || (right.max === max && right.maxOpen))) {
    max = right.max;
    maxOpen = right.maxOpen;
  }

  return makeInterval(min, max, minOpen, maxOpen);
}

/** Замена переменной u = kx + m: переводит промежуток по u в промежуток по x. */
function pullBackInterval(interval: SolutionInterval, k: number, m: number): SolutionInterval {
  if (interval.empty) return EMPTY_INTERVAL;
  const lower = interval.min === null ? null : (interval.min - m) / k;
  const upper = interval.max === null ? null : (interval.max - m) / k;

  return k > 0
    ? makeInterval(lower, upper, interval.minOpen, interval.maxOpen)
    : makeInterval(upper, lower, interval.maxOpen, interval.minOpen);
}

function strictly(sign: InequalitySign): boolean {
  return sign === '>' || sign === '<';
}

function greater(sign: InequalitySign): boolean {
  return sign === '>' || sign === '>=';
}

/** Показательное неравенство a^x ⋛ b. */
export function solveExponentialInequality(base: number, target: number, sign: InequalitySign): SolutionInterval {
  const check = checkLogBase(base);
  if (!check.ok) throw new ExpLogError('invalid-base', check.reason);
  if (!Number.isFinite(target)) {
    throw new ExpLogError('invalid-argument', 'Правая часть должна быть конечным числом.');
  }

  // Значения показательной функции строго положительны: сравнение с
  // неположительным числом решается без логарифма.
  if (target <= 0) return greater(sign) ? ALL_NUMBERS : EMPTY_INTERVAL;

  const boundary = logValue(base, target);
  // При основании из промежутка (0; 1) функция убывает, поэтому знак переворачивается.
  const keepDirection = base > 1;
  const wantGreater = keepDirection ? greater(sign) : !greater(sign);
  const open = strictly(sign);

  return wantGreater
    ? makeInterval(boundary, null, open, true)
    : makeInterval(null, boundary, true, open);
}

/** Логарифмическое неравенство log_a(kx + m) ⋛ c вместе с ОДЗ. */
export function solveLogInequality(
  base: number,
  k: number,
  m: number,
  c: number,
  sign: InequalitySign,
): SolutionInterval {
  const check = checkLogBase(base);
  if (!check.ok) throw new ExpLogError('invalid-base', check.reason);
  if (!Number.isFinite(k) || k === 0) {
    throw new ExpLogError('invalid-argument', 'Коэффициент при x не может быть равен нулю.');
  }
  if (!Number.isFinite(m) || !Number.isFinite(c)) {
    throw new ExpLogError('invalid-argument', 'Все коэффициенты должны быть конечными числами.');
  }

  const boundary = Math.pow(base, c);
  const keepDirection = base > 1;
  const wantGreater = keepDirection ? greater(sign) : !greater(sign);
  const open = strictly(sign);

  // Сначала решаем относительно u = kx + m, затем добавляем ОДЗ u > 0.
  const solved = wantGreater
    ? makeInterval(boundary, null, open, true)
    : makeInterval(null, boundary, true, open);
  const domain = makeInterval(0, null, true, true);
  const inU = intersectIntervals(solved, domain);

  return pullBackInterval(inU, k, m);
}

/** Ответ промежутком по-русски: «(2; +∞)», «[−1; 3)», «решений нет». */
export function intervalText(interval: SolutionInterval): string {
  if (interval.empty) return 'решений нет';
  if (interval.min === null && interval.max === null) return 'любое число';

  const left = interval.min === null ? '(−∞' : `${interval.minOpen ? '(' : '['}${numberText(interval.min)}`;
  const right = interval.max === null ? '+∞)' : `${numberText(interval.max)}${interval.maxOpen ? ')' : ']'}`;
  return `${left}; ${right}`;
}

/** Лежит ли число в промежутке — удобная проверка для тестов и лаборатории. */
export function intervalContains(interval: SolutionInterval, value: number): boolean {
  if (interval.empty) return false;
  if (interval.min !== null) {
    if (interval.minOpen ? value <= interval.min : value < interval.min) return false;
  }
  if (interval.max !== null) {
    if (interval.maxOpen ? value >= interval.max : value > interval.max) return false;
  }
  return true;
}
