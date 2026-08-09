/**
 * Точное ядро главы «Функции и неравенства» (8 класс).
 *
 * Три независимые части:
 *   1) числовые промежутки — границы, пересечение, запись и чтение;
 *   2) линейные неравенства с одной переменной и их системы;
 *   3) элементарные графики y = k/x, y = kx², y = k√x, y = k|x| для галереи.
 *
 * Всё, что связано с неравенствами, считается точно (BigInt-дроби из
 * exactRational). Числа с плавающей точкой используются только там, где нужны
 * координаты рисунка: у кривой нет точного представления в дробях.
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
  type ExactInput,
  type ExactRational,
} from './exactRational';
import {
  formatExactLatex,
  formatLinearLatex,
  formatLinearText,
  linearExpression,
  type LinearExpression,
} from './linear';

export type InequalityErrorCode =
  | 'invalid-interval'
  | 'unbounded'
  | 'contains-zero'
  | 'invalid-coefficient';

export class InequalityError extends Error {
  readonly code: InequalityErrorCode;

  constructor(code: InequalityErrorCode, message: string) {
    super(message);
    this.name = 'InequalityError';
    this.code = code;
  }
}

const ZERO = parseExact(0);

// ───────────────────────────── Знаки неравенств ──────────────────────────────

/** Знак неравенства: строгий или нестрогий, влево или вправо. */
export type Relation = 'lt' | 'le' | 'gt' | 'ge';

export const RELATIONS: readonly Relation[] = Object.freeze(['lt', 'le', 'gt', 'ge'] as const);

/** Меняет знак неравенства на противоположный (умножение на отрицательное). */
export function flipRelation(relation: Relation): Relation {
  if (relation === 'lt') return 'gt';
  if (relation === 'gt') return 'lt';
  if (relation === 'le') return 'ge';
  return 'le';
}

/** Строгое ли неравенство: у строгого граница не входит в ответ. */
export function isStrict(relation: Relation): boolean {
  return relation === 'lt' || relation === 'gt';
}

/** Смотрит ли знак «вправо», то есть задаёт ли он левую границу ответа. */
export function pointsRight(relation: Relation): boolean {
  return relation === 'gt' || relation === 'ge';
}

export function relationText(relation: Relation): string {
  if (relation === 'lt') return '<';
  if (relation === 'le') return '⩽';
  if (relation === 'gt') return '>';
  return '⩾';
}

export function relationLatex(relation: Relation): string {
  if (relation === 'lt') return '<';
  if (relation === 'le') return '\\leqslant';
  if (relation === 'gt') return '>';
  return '\\geqslant';
}

/** Верно ли числовое неравенство left ⋛ right. */
export function holdsRelation(relation: Relation, left: ExactInput, right: ExactInput): boolean {
  const sign = compareExact(left, right);
  if (relation === 'lt') return sign < 0;
  if (relation === 'le') return sign <= 0;
  if (relation === 'gt') return sign > 0;
  return sign >= 0;
}

// ───────────────────────────── Промежутки ────────────────────────────────────

/** Граница промежутка: число и признак «включена ли она в промежуток». */
export interface Bound {
  readonly value: ExactRational;
  readonly closed: boolean;
}

/** Числовой промежуток; null вместо границы означает бесконечность. */
export interface Interval {
  readonly left: Bound | null;
  readonly right: Bound | null;
}

/** Множество решений: либо промежуток, либо пустое множество. */
export type NumberSet =
  | { readonly kind: 'empty' }
  | { readonly kind: 'interval'; readonly interval: Interval };

export const EMPTY_SET: NumberSet = Object.freeze({ kind: 'empty' as const });

export function bound(value: ExactInput, closed = true): Bound {
  return Object.freeze({ value: parseExact(value), closed });
}

/**
 * Собирает промежуток из двух границ и запрещает пустую запись: левая граница
 * не может быть правее правой, а совпадение границ допустимо только у отрезка.
 */
export function interval(left: Bound | null, right: Bound | null): Interval {
  if (left && right) {
    const sign = compareExact(left.value, right.value);
    if (sign > 0) {
      throw new InequalityError('invalid-interval', 'Левая граница промежутка больше правой');
    }
    if (sign === 0 && !(left.closed && right.closed)) {
      throw new InequalityError('invalid-interval', 'Границы совпали, но не включены: такой промежуток пуст');
    }
  }
  return Object.freeze({ left, right });
}

/** Отрезок [a; b]. */
export function closedInterval(a: ExactInput, b: ExactInput): Interval {
  return interval(bound(a, true), bound(b, true));
}

/** Интервал (a; b). */
export function openInterval(a: ExactInput, b: ExactInput): Interval {
  return interval(bound(a, false), bound(b, false));
}

/** Полуинтервал [a; b) или (a; b] — по флагам включения границ. */
export function halfOpenInterval(a: ExactInput, b: ExactInput, leftClosed: boolean): Interval {
  return interval(bound(a, leftClosed), bound(b, !leftClosed));
}

/** Луч (−∞; b) или (−∞; b]. */
export function lessThanSet(b: ExactInput, orEqual = false): Interval {
  return interval(null, bound(b, orEqual));
}

/** Луч (a; +∞) или [a; +∞). */
export function greaterThanSet(a: ExactInput, orEqual = false): Interval {
  return interval(bound(a, orEqual), null);
}

export const ALL_REALS: Interval = Object.freeze({ left: null, right: null });

export function setOf(value: Interval): NumberSet {
  return Object.freeze({ kind: 'interval' as const, interval: value });
}

export function isAllReals(value: Interval): boolean {
  return value.left === null && value.right === null;
}

export function isBounded(value: Interval): boolean {
  return value.left !== null && value.right !== null;
}

/** Промежуток из одного числа: [a; a]. */
export function isPoint(value: Interval): boolean {
  return isBounded(value) && compareExact(value.left!.value, value.right!.value) === 0;
}

export function containsNumber(value: Interval, x: ExactInput): boolean {
  const point = parseExact(x);
  if (value.left) {
    const sign = compareExact(point, value.left.value);
    if (sign < 0 || (sign === 0 && !value.left.closed)) return false;
  }
  if (value.right) {
    const sign = compareExact(point, value.right.value);
    if (sign > 0 || (sign === 0 && !value.right.closed)) return false;
  }
  return true;
}

export function setContains(set: NumberSet, x: ExactInput): boolean {
  return set.kind === 'interval' && containsNumber(set.interval, x);
}

/** Длина промежутка; для бесконечного промежутка длины нет. */
export function intervalLength(value: Interval): ExactRational | null {
  if (!isBounded(value)) return null;
  return subtractExact(value.right!.value, value.left!.value);
}

function maxBound(first: Bound | null, second: Bound | null): Bound | null {
  if (!first) return second;
  if (!second) return first;
  const sign = compareExact(first.value, second.value);
  if (sign > 0) return first;
  if (sign < 0) return second;
  return Object.freeze({ value: first.value, closed: first.closed && second.closed });
}

function minBound(first: Bound | null, second: Bound | null): Bound | null {
  if (!first) return second;
  if (!second) return first;
  const sign = compareExact(first.value, second.value);
  if (sign < 0) return first;
  if (sign > 0) return second;
  return Object.freeze({ value: first.value, closed: first.closed && second.closed });
}

/**
 * Пересечение двух промежутков: берём самую правую левую границу и самую левую
 * правую. Если границы совпали, включённость сохраняется только тогда, когда
 * число входит в оба промежутка.
 */
export function intersectIntervals(first: Interval, second: Interval): NumberSet {
  const left = maxBound(first.left, second.left);
  const right = minBound(first.right, second.right);
  if (left && right) {
    const sign = compareExact(left.value, right.value);
    if (sign > 0) return EMPTY_SET;
    if (sign === 0 && !(left.closed && right.closed)) return EMPTY_SET;
  }
  return setOf(Object.freeze({ left, right }));
}

export function intersectSets(first: NumberSet, second: NumberSet): NumberSet {
  if (first.kind === 'empty' || second.kind === 'empty') return EMPTY_SET;
  return intersectIntervals(first.interval, second.interval);
}

/** Пересечение любого числа промежутков; пустой список задаёт всю прямую. */
export function intersectAll(values: readonly Interval[]): NumberSet {
  return values.reduce<NumberSet>((accumulator, item) => intersectSets(accumulator, setOf(item)), setOf(ALL_REALS));
}

// ───────────────────────────── Запись промежутков ────────────────────────────

export function formatIntervalText(value: Interval): string {
  const leftBracket = value.left && value.left.closed ? '[' : '(';
  const rightBracket = value.right && value.right.closed ? ']' : ')';
  const leftValue = value.left ? formatExactRussian(value.left.value) : '−∞';
  const rightValue = value.right ? formatExactRussian(value.right.value) : '+∞';
  return `${leftBracket}${leftValue}; ${rightValue}${rightBracket}`;
}

export function formatIntervalLatex(value: Interval): string {
  const leftBracket = value.left && value.left.closed ? '[' : '(';
  const rightBracket = value.right && value.right.closed ? ']' : ')';
  const leftValue = value.left ? formatExactLatex(value.left.value) : '-\\infty';
  const rightValue = value.right ? formatExactLatex(value.right.value) : '+\\infty';
  return `${leftBracket}${leftValue};\\ ${rightValue}${rightBracket}`;
}

export function formatSetText(set: NumberSet): string {
  return set.kind === 'empty' ? '∅' : formatIntervalText(set.interval);
}

export function formatSetLatex(set: NumberSet): string {
  return set.kind === 'empty' ? '\\varnothing' : formatIntervalLatex(set.interval);
}

/** Запись промежутка неравенством: «x ⩽ 3», «−2 < x ⩽ 5», «x — любое число». */
export function formatConditionText(value: Interval, variable = 'x'): string {
  if (isAllReals(value)) return `${variable} — любое число`;
  if (isPoint(value)) return `${variable} = ${formatExactRussian(value.left!.value)}`;
  if (!value.left) {
    return `${variable} ${value.right!.closed ? '⩽' : '<'} ${formatExactRussian(value.right!.value)}`;
  }
  if (!value.right) {
    return `${variable} ${value.left.closed ? '⩾' : '>'} ${formatExactRussian(value.left.value)}`;
  }
  const left = `${formatExactRussian(value.left.value)} ${value.left.closed ? '⩽' : '<'}`;
  const right = `${value.right.closed ? '⩽' : '<'} ${formatExactRussian(value.right.value)}`;
  return `${left} ${variable} ${right}`;
}

export function formatConditionLatex(value: Interval, variable = 'x'): string {
  if (isAllReals(value)) return `${variable} \\in \\mathbb{R}`;
  if (isPoint(value)) return `${variable} = ${formatExactLatex(value.left!.value)}`;
  if (!value.left) {
    return `${variable} ${value.right!.closed ? '\\leqslant' : '<'} ${formatExactLatex(value.right!.value)}`;
  }
  if (!value.right) {
    return `${variable} ${value.left.closed ? '\\geqslant' : '>'} ${formatExactLatex(value.left.value)}`;
  }
  const left = `${formatExactLatex(value.left.value)} ${value.left.closed ? '\\leqslant' : '<'}`;
  const right = `${value.right.closed ? '\\leqslant' : '<'} ${formatExactLatex(value.right.value)}`;
  return `${left} ${variable} ${right}`;
}

export function describeSet(set: NumberSet, variable = 'x'): string {
  if (set.kind === 'empty') return 'решений нет';
  return `${formatConditionText(set.interval, variable)}, то есть ${formatIntervalText(set.interval)}`;
}

/** Школьное название промежутка. */
export function intervalName(value: Interval): string {
  if (isAllReals(value)) return 'вся числовая прямая';
  if (isPoint(value)) return 'одно число';
  if (!value.left || !value.right) {
    const finite = value.left ?? value.right!;
    return finite.closed ? 'числовой луч' : 'открытый числовой луч';
  }
  if (value.left.closed && value.right.closed) return 'отрезок';
  if (!value.left.closed && !value.right.closed) return 'интервал';
  return 'полуинтервал';
}

// ───────────────────────── Линейные неравенства ──────────────────────────────

/** Неравенство «линейное выражение ⋛ линейное выражение». */
export interface LinearInequality {
  readonly left: LinearExpression;
  readonly relation: Relation;
  readonly right: LinearExpression;
}

export function linearInequality(
  left: LinearExpression,
  relation: Relation,
  right: LinearExpression,
): LinearInequality {
  return Object.freeze({ left, relation, right });
}

/** Короткая запись a·x ⋛ c. */
export function simpleInequality(
  coefficient: ExactInput,
  relation: Relation,
  constant: ExactInput,
): LinearInequality {
  return linearInequality(linearExpression(coefficient, 0), relation, linearExpression(0, constant));
}

export function formatInequalityText(item: LinearInequality, variable = 'x'): string {
  return `${formatLinearText(item.left, variable)} ${relationText(item.relation)} ${formatLinearText(item.right, variable)}`;
}

export function formatInequalityLatex(item: LinearInequality, variable = 'x'): string {
  return `${formatLinearLatex(item.left, variable)} ${relationLatex(item.relation)} ${formatLinearLatex(item.right, variable)}`;
}

/** Обращается ли неравенство в верное числовое при подстановке x. */
export function satisfiesInequality(item: LinearInequality, x: ExactInput): boolean {
  const point = parseExact(x);
  const left = addExact(multiplyExact(item.left.slope, point), item.left.intercept);
  const right = addExact(multiplyExact(item.right.slope, point), item.right.intercept);
  return holdsRelation(item.relation, left, right);
}

export interface NormalizedInequality {
  /** Коэффициент при переменной после переноса всех слагаемых влево. */
  readonly coefficient: ExactRational;
  /** Число в правой части после переноса. */
  readonly constant: ExactRational;
  readonly relation: Relation;
}

/** Приводит неравенство к виду a·x ⋛ c. */
export function normalizedInequality(item: LinearInequality): NormalizedInequality {
  return Object.freeze({
    coefficient: subtractExact(item.left.slope, item.right.slope),
    constant: subtractExact(item.right.intercept, item.left.intercept),
    relation: item.relation,
  });
}

function solutionFromRoot(root: ExactRational, relation: Relation): NumberSet {
  return setOf(pointsRight(relation)
    ? greaterThanSet(root, !isStrict(relation))
    : lessThanSet(root, !isStrict(relation)));
}

/**
 * Решает линейное неравенство. При делении на отрицательный коэффициент знак
 * меняется на противоположный; при нулевом коэффициенте ответ — либо вся
 * прямая, либо пустое множество.
 */
export function solveLinearInequality(item: LinearInequality): NumberSet {
  const { coefficient, constant, relation } = normalizedInequality(item);
  if (isExactZero(coefficient)) {
    return holdsRelation(relation, ZERO, constant) ? setOf(ALL_REALS) : EMPTY_SET;
  }
  const root = divideExact(constant, coefficient);
  const negative = compareExact(coefficient, ZERO) < 0;
  return solutionFromRoot(root, negative ? flipRelation(relation) : relation);
}

export type InequalityStepKind =
  | 'start'
  | 'collect-variable'
  | 'collect-constant'
  | 'divide'
  | 'conclusion';

export interface InequalityStep {
  readonly kind: InequalityStepKind;
  readonly rule: string;
  readonly latex: string;
  readonly text: string;
}

/**
 * Цепочка равносильных преобразований линейного неравенства — тот же порядок
 * шагов, что и у уравнения, плюс отдельное предупреждение о смене знака.
 */
export function solveInequalitySteps(item: LinearInequality, variable = 'x'): readonly InequalityStep[] {
  const steps: InequalityStep[] = [];
  const push = (kind: InequalityStepKind, rule: string, latex: string, text: string) => {
    steps.push(Object.freeze({ kind, rule, latex, text }));
  };

  push('start', 'Исходное неравенство', formatInequalityLatex(item, variable), formatInequalityText(item, variable));

  const { coefficient, constant, relation } = normalizedInequality(item);

  if (!isExactZero(item.right.slope)) {
    const moved = linearInequality(
      linearExpression(coefficient, item.left.intercept),
      relation,
      linearExpression(0, item.right.intercept),
    );
    push(
      'collect-variable',
      `Переносим слагаемые с ${variable} влево и меняем у них знак`,
      formatInequalityLatex(moved, variable),
      formatInequalityText(moved, variable),
    );
  }

  if (!isExactZero(item.left.intercept)) {
    const moved = linearInequality(
      linearExpression(coefficient, 0),
      relation,
      linearExpression(0, constant),
    );
    push(
      'collect-constant',
      'Переносим числа вправо и меняем у них знак',
      formatInequalityLatex(moved, variable),
      formatInequalityText(moved, variable),
    );
  }

  const solution = solveLinearInequality(item);

  if (isExactZero(coefficient)) {
    push(
      'conclusion',
      solution.kind === 'empty' ? 'Переменная исчезла, числовое неравенство неверно' : 'Переменная исчезла, числовое неравенство верно',
      solution.kind === 'empty' ? '\\varnothing' : formatIntervalLatex(ALL_REALS),
      solution.kind === 'empty' ? 'решений нет' : 'подходит любое число',
    );
    return Object.freeze(steps);
  }

  const negative = compareExact(coefficient, ZERO) < 0;
  const root = divideExact(constant, coefficient);
  const finalRelation = negative ? flipRelation(relation) : relation;
  push(
    'divide',
    negative
      ? `Делим обе части на отрицательное число ${formatExactRussian(coefficient)} — знак неравенства меняется на противоположный`
      : `Делим обе части на положительное число ${formatExactRussian(coefficient)} — знак неравенства сохраняется`,
    `${variable} ${relationLatex(finalRelation)} ${formatExactLatex(root)}`,
    `${variable} ${relationText(finalRelation)} ${formatExactRussian(root)}`,
  );
  push(
    'conclusion',
    'Записываем ответ промежутком',
    formatSetLatex(solution),
    formatSetText(solution),
  );
  return Object.freeze(steps);
}

/** Система линейных неравенств: пересечение множеств решений. */
export function solveInequalitySystem(items: readonly LinearInequality[]): NumberSet {
  return items.reduce<NumberSet>(
    (accumulator, item) => intersectSets(accumulator, solveLinearInequality(item)),
    setOf(ALL_REALS),
  );
}

// ───────────────────────── Оценка величин ────────────────────────────────────

/** Промежуток из противоположных чисел: если a ⩽ x ⩽ b, то −b ⩽ −x ⩽ −a. */
export function negateInterval(value: Interval): Interval {
  const left = value.right ? Object.freeze({ value: negateExact(value.right.value), closed: value.right.closed }) : null;
  const right = value.left ? Object.freeze({ value: negateExact(value.left.value), closed: value.left.closed }) : null;
  return Object.freeze({ left, right });
}

function addBounds(first: Bound | null, second: Bound | null): Bound | null {
  if (!first || !second) return null;
  return Object.freeze({ value: addExact(first.value, second.value), closed: first.closed && second.closed });
}

/** Оценка суммы: границы складываются по отдельности. */
export function estimateSum(first: Interval, second: Interval): Interval {
  return Object.freeze({
    left: addBounds(first.left, second.left),
    right: addBounds(first.right, second.right),
  });
}

/** Оценка разности: вычитаемое сначала заменяют противоположным. */
export function estimateDifference(first: Interval, second: Interval): Interval {
  return estimateSum(first, negateInterval(second));
}

/** Умножение промежутка на число: при отрицательном множителе границы меняются местами. */
export function estimateScaled(value: Interval, factor: ExactInput): Interval {
  const exact = parseExact(factor);
  if (isExactZero(exact)) return closedInterval(0, 0);
  const scale = (item: Bound | null): Bound | null => (
    item ? Object.freeze({ value: multiplyExact(item.value, exact), closed: item.closed }) : null
  );
  return compareExact(exact, ZERO) > 0
    ? Object.freeze({ left: scale(value.left), right: scale(value.right) })
    : Object.freeze({ left: scale(value.right), right: scale(value.left) });
}

function assertBounded(value: Interval, label: string): void {
  if (!isBounded(value)) {
    throw new InequalityError('unbounded', `${label} должен быть ограничен с обеих сторон`);
  }
}

/**
 * Оценка произведения двух ограниченных промежутков. Крайние значения
 * произведения достигаются в углах прямоугольника, поэтому достаточно
 * перебрать четыре комбинации границ.
 */
export function estimateProduct(first: Interval, second: Interval): Interval {
  assertBounded(first, 'Первый множитель');
  assertBounded(second, 'Второй множитель');

  const corners: Bound[] = [];
  for (const a of [first.left!, first.right!]) {
    for (const b of [second.left!, second.right!]) {
      corners.push(Object.freeze({ value: multiplyExact(a.value, b.value), closed: a.closed && b.closed }));
    }
  }

  let minimum = corners[0]!.value;
  let maximum = corners[0]!.value;
  for (const corner of corners) {
    if (compareExact(corner.value, minimum) < 0) minimum = corner.value;
    if (compareExact(corner.value, maximum) > 0) maximum = corner.value;
  }
  // Граница достигается, если её даёт хотя бы одна включённая комбинация.
  const reaches = (target: ExactRational) => corners
    .some((corner) => corner.closed && compareExact(corner.value, target) === 0);

  return Object.freeze({
    left: Object.freeze({ value: minimum, closed: reaches(minimum) }),
    right: Object.freeze({ value: maximum, closed: reaches(maximum) }),
  });
}

/** Оценка обратной величины для промежутка, не содержащего нуля. */
export function estimateReciprocal(value: Interval): Interval {
  assertBounded(value, 'Промежуток');
  if (containsNumber(value, 0)) {
    throw new InequalityError('contains-zero', 'Обратная величина не оценивается, если промежуток содержит ноль');
  }
  const one = parseExact(1);
  return Object.freeze({
    left: Object.freeze({ value: divideExact(one, value.right!.value), closed: value.right!.closed }),
    right: Object.freeze({ value: divideExact(one, value.left!.value), closed: value.left!.closed }),
  });
}

/** Оценка частного через произведение на обратную величину. */
export function estimateQuotient(first: Interval, second: Interval): Interval {
  return estimateProduct(first, estimateReciprocal(second));
}

// ───────────────────────── Галерея графиков ──────────────────────────────────

export type CurveKind = 'inverse' | 'square' | 'sqrt' | 'abs';

export const CURVE_KINDS: readonly CurveKind[] = Object.freeze(['inverse', 'square', 'sqrt', 'abs'] as const);

export interface CurvePoint {
  readonly x: number;
  readonly y: number;
}

export type CurveBranch = readonly CurvePoint[];

function assertCoefficient(coefficient: number): void {
  if (!Number.isFinite(coefficient) || coefficient === 0) {
    throw new InequalityError('invalid-coefficient', 'Коэффициент должен быть отличным от нуля числом');
  }
}

/** Входит ли число в область определения выбранной функции. */
export function curveDefined(kind: CurveKind, x: number): boolean {
  if (!Number.isFinite(x)) return false;
  if (kind === 'inverse') return x !== 0;
  if (kind === 'sqrt') return x >= 0;
  return true;
}

/** Значение функции галереи; null — если число не входит в область определения. */
export function curveValue(kind: CurveKind, coefficient: number, x: number): number | null {
  assertCoefficient(coefficient);
  if (!curveDefined(kind, x)) return null;
  if (kind === 'inverse') return coefficient / x;
  if (kind === 'square') return coefficient * x * x;
  if (kind === 'sqrt') return coefficient * Math.sqrt(x);
  return coefficient * Math.abs(x);
}

function coefficientText(coefficient: number): string {
  return String(coefficient).replace('.', ',');
}

/** Запись функции для KaTeX. */
export function curveLatex(kind: CurveKind, coefficient: number): string {
  assertCoefficient(coefficient);
  const body = kind === 'square' ? 'x^2' : kind === 'sqrt' ? '\\sqrt{x}' : kind === 'abs' ? '|x|' : '';
  if (kind === 'inverse') {
    return `y = \\dfrac{${String(coefficient)}}{x}`;
  }
  if (coefficient === 1) return `y = ${body}`;
  if (coefficient === -1) return `y = -${body}`;
  return `y = ${String(coefficient)}${body}`;
}

/** Запись функции обычным текстом — для подписей рисунка и экранного диктора. */
export function curveText(kind: CurveKind, coefficient: number): string {
  assertCoefficient(coefficient);
  const sign = coefficient < 0 ? '−' : '';
  const magnitude = Math.abs(coefficient);
  const factor = magnitude === 1 ? '' : coefficientText(magnitude);
  if (kind === 'inverse') return `y = ${sign}${coefficientText(magnitude)}/x`;
  if (kind === 'square') return `y = ${sign}${factor}x²`;
  if (kind === 'sqrt') return `y = ${sign}${factor}√x`;
  return `y = ${sign}${factor}|x|`;
}

export function curveTitle(kind: CurveKind): string {
  if (kind === 'inverse') return 'Обратная пропорциональность';
  if (kind === 'square') return 'Квадратичная функция';
  if (kind === 'sqrt') return 'Квадратный корень';
  return 'Модуль';
}

export function curveShape(kind: CurveKind): string {
  if (kind === 'inverse') return 'гипербола — две отдельные ветви';
  if (kind === 'square') return 'парабола с вершиной в начале координат';
  if (kind === 'sqrt') return 'половина параболы, лежащая на боку';
  return 'уголок из двух лучей';
}

export interface CurveFacts {
  readonly domain: string;
  readonly range: string;
  readonly zeros: string;
  readonly symmetry: string;
  readonly behaviour: string;
}

/** Свойства функции, которые читаются прямо по графику. */
export function curveFacts(kind: CurveKind, coefficient: number): CurveFacts {
  assertCoefficient(coefficient);
  const positive = coefficient > 0;

  if (kind === 'inverse') {
    return Object.freeze({
      domain: 'все числа, кроме нуля',
      range: 'все числа, кроме нуля',
      zeros: 'нулей нет: дробь с ненулевым числителем не равна нулю',
      symmetry: 'центральная симметрия относительно начала координат',
      behaviour: positive
        ? 'ветви лежат в I и III четвертях; на каждом из промежутков (−∞; 0) и (0; +∞) функция убывает'
        : 'ветви лежат во II и IV четвертях; на каждом из промежутков (−∞; 0) и (0; +∞) функция возрастает',
    });
  }

  if (kind === 'square') {
    return Object.freeze({
      domain: 'любое число',
      range: positive ? 'y ⩾ 0' : 'y ⩽ 0',
      zeros: 'один нуль: x = 0',
      symmetry: 'осевая симметрия относительно оси Oy',
      behaviour: positive
        ? 'убывает на (−∞; 0] и возрастает на [0; +∞); вершина (0; 0) — наименьшее значение'
        : 'возрастает на (−∞; 0] и убывает на [0; +∞); вершина (0; 0) — наибольшее значение',
    });
  }

  if (kind === 'sqrt') {
    return Object.freeze({
      domain: 'x ⩾ 0',
      range: positive ? 'y ⩾ 0' : 'y ⩽ 0',
      zeros: 'один нуль: x = 0',
      symmetry: 'симметрии нет: график занимает только половину плоскости',
      behaviour: positive
        ? 'возрастает на всей области определения, но всё медленнее'
        : 'убывает на всей области определения, но всё медленнее',
    });
  }

  return Object.freeze({
    domain: 'любое число',
    range: positive ? 'y ⩾ 0' : 'y ⩽ 0',
    zeros: 'один нуль: x = 0',
    symmetry: 'осевая симметрия относительно оси Oy',
    behaviour: positive
      ? 'убывает на (−∞; 0] и возрастает на [0; +∞); график состоит из двух лучей'
      : 'возрастает на (−∞; 0] и убывает на [0; +∞); график состоит из двух лучей',
  });
}

function edgePoint(
  kind: CurveKind,
  coefficient: number,
  insideX: number,
  outsideX: number,
  extent: number,
): CurvePoint | null {
  // Домножать до края окна имеет смысл только там, где функция определена.
  if (!curveDefined(kind, outsideX)) return null;
  let inside = insideX;
  let outside = outsideX;
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const middle = (inside + outside) / 2;
    const value = curveValue(kind, coefficient, middle);
    if (value !== null && Math.abs(value) <= extent) inside = middle;
    else outside = middle;
  }
  const y = curveValue(kind, coefficient, inside);
  return y === null ? null : { x: inside, y };
}

/**
 * Ломаная (или несколько ломаных), приближающая график в окне
 * [−extent; extent] по обеим осям. Разрыв области определения и выход за
 * пределы окна честно разрывают линию на отдельные ветви.
 */
export function curveBranches(
  kind: CurveKind,
  coefficient: number,
  extent: number,
  samples = 192,
): readonly CurveBranch[] {
  assertCoefficient(coefficient);
  if (!Number.isFinite(extent) || extent <= 0) {
    throw new InequalityError('invalid-interval', 'Окно графика должно быть положительным');
  }
  const count = Math.max(16, Math.min(2048, Math.round(samples)));
  const branches: CurvePoint[][] = [];
  let current: CurvePoint[] = [];
  let previousX: number | null = null;

  const closeBranch = () => {
    if (current.length > 1) branches.push(current);
    current = [];
  };

  for (let index = 0; index <= count; index += 1) {
    const x = -extent + (2 * extent * index) / count;
    const y = curveValue(kind, coefficient, x);
    const visible = y !== null && Math.abs(y) <= extent;

    if (visible) {
      if (current.length === 0 && previousX !== null) {
        const edge = edgePoint(kind, coefficient, x, previousX, extent);
        if (edge) current.push(edge);
      }
      current.push({ x, y: y as number });
    } else {
      if (current.length > 0) {
        const edge = edgePoint(kind, coefficient, current[current.length - 1]!.x, x, extent);
        if (edge) current.push(edge);
      }
      closeBranch();
    }
    previousX = x;
  }
  closeBranch();

  return Object.freeze(branches.map((branch) => Object.freeze(branch)));
}

/** Таблица значений функции в целых точках — то, что строят в тетради. */
export function curveTable(
  kind: CurveKind,
  coefficient: number,
  xs: readonly number[],
): readonly { readonly x: number; readonly y: number | null }[] {
  return Object.freeze(xs.map((x) => Object.freeze({ x, y: curveValue(kind, coefficient, x) })));
}
