export type SignedComparison = -1 | 0 | 1;
export type Quadrant = 1 | 2 | 3 | 4 | null;
export type ReflectionAxis = 'x' | 'y' | 'origin';

export interface CoordinatePoint {
  readonly x: number;
  readonly y: number;
}

export interface CoordinateVector {
  readonly dx: number;
  readonly dy: number;
}

export interface HalfStepRange {
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
}

export interface HalfStepRangeOptions {
  readonly defaultMinimum: number;
  readonly defaultMaximum: number;
  readonly defaultStep?: number;
  readonly hardMinimum?: number;
  readonly hardMaximum?: number;
  readonly maximumStep?: number;
  readonly includeValuesAroundZero?: boolean;
}

interface ExactFraction {
  numerator: bigint;
  denominator: bigint;
}

const MAX_SAFE_MAGNITUDE = Number.MAX_SAFE_INTEGER;

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function assertFiniteSafe(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} должно быть конечным числом`);
  }
  if (Math.abs(value) > MAX_SAFE_MAGNITUDE) {
    throw new RangeError(`${label} выходит за безопасный числовой диапазон`);
  }
  return normalizeZero(value);
}

function bigintAbsolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function bigintGcd(a: bigint, b: bigint): bigint {
  let left = bigintAbsolute(a);
  let right = bigintAbsolute(b);

  while (right !== 0n) {
    [left, right] = [right, left % right];
  }

  return left;
}

function reduceFraction(numerator: bigint, denominator: bigint): ExactFraction {
  if (denominator === 0n) throw new RangeError('Делить на ноль нельзя');
  if (numerator === 0n) return { numerator: 0n, denominator: 1n };

  const divisor = bigintGcd(numerator, denominator);
  const sign = denominator < 0n ? -1n : 1n;
  return {
    numerator: (numerator / divisor) * sign,
    denominator: bigintAbsolute(denominator / divisor),
  };
}

/**
 * Number#toString gives the shortest decimal that round-trips to the same
 * number. Reading that decimal as a fraction lets school-style decimal
 * operations (in particular every half-step) avoid binary floating drift.
 */
function decimalFraction(value: number, label: string): ExactFraction {
  const normalized = assertFiniteSafe(value, label);
  if (normalized === 0) return { numerator: 0n, denominator: 1n };

  const text = normalized.toString().toLowerCase();
  const [coefficient, exponentText] = text.split('e');
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  const negative = coefficient.startsWith('-');
  const unsigned = negative ? coefficient.slice(1) : coefficient;
  const [integerPart, decimalPart = ''] = unsigned.split('.');
  const digits = `${integerPart}${decimalPart}`.replace(/^0+(?=\d)/, '');
  const scale = decimalPart.length - exponent;
  let numerator = BigInt(digits || '0');
  let denominator = 1n;

  if (scale > 0) denominator = 10n ** BigInt(scale);
  if (scale < 0) numerator *= 10n ** BigInt(-scale);
  if (negative) numerator = -numerator;

  return reduceFraction(numerator, denominator);
}

function fractionToNumber(fraction: ExactFraction, label: string): number {
  const reduced = reduceFraction(fraction.numerator, fraction.denominator);
  if (reduced.numerator === 0n) return 0;

  const negative = reduced.numerator < 0n;
  const numerator = bigintAbsolute(reduced.numerator);
  const denominator = reduced.denominator;
  const numeratorDigits = numerator.toString().length;
  const denominatorDigits = denominator.toString().length;
  let exponent = numeratorDigits - denominatorDigits;

  if (exponent >= 0) {
    if (numerator < denominator * (10n ** BigInt(exponent))) exponent -= 1;
  } else if (numerator * (10n ** BigInt(-exponent)) < denominator) {
    exponent -= 1;
  }

  // Seventeen significant decimal digits are enough to round-trip a Number.
  const significantDigits = 17;
  const shift = significantDigits - 1 - exponent;
  const scaledNumerator = shift >= 0 ? numerator * (10n ** BigInt(shift)) : numerator;
  const scaledDenominator = shift >= 0 ? denominator : denominator * (10n ** BigInt(-shift));
  let quotient = scaledNumerator / scaledDenominator;
  const remainder = scaledNumerator % scaledDenominator;
  if (remainder * 2n >= scaledDenominator) quotient += 1n;

  const overflowThreshold = 10n ** BigInt(significantDigits);
  if (quotient >= overflowThreshold) {
    quotient /= 10n;
    exponent += 1;
  }

  const digits = quotient.toString().padStart(significantDigits, '0');
  const scientific = `${negative ? '-' : ''}${digits[0]}.${digits.slice(1)}e${exponent}`;
  const value = Number(scientific);
  if (value === 0) throw new RangeError(`${label} слишком мало для безопасного представления`);
  return assertFiniteSafe(value, label);
}

/** Приводит JavaScript-значение -0 к обычному школьному нулю. */
export function normalizeSignedZero(value: number): number {
  return assertFiniteSafe(value, 'Число');
}

export function opposite(value: number): number {
  return normalizeSignedZero(-assertFiniteSafe(value, 'Число'));
}

export function absoluteValue(value: number): number {
  return normalizeSignedZero(Math.abs(assertFiniteSafe(value, 'Число')));
}

export function compareSigned(left: number, right: number): SignedComparison {
  const a = decimalFraction(left, 'Левое число');
  const b = decimalFraction(right, 'Правое число');
  const difference = a.numerator * b.denominator - b.numerator * a.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function addSigned(left: number, right: number): number {
  const a = decimalFraction(left, 'Первое слагаемое');
  const b = decimalFraction(right, 'Второе слагаемое');
  return fractionToNumber({
    numerator: a.numerator * b.denominator + b.numerator * a.denominator,
    denominator: a.denominator * b.denominator,
  }, 'Сумма');
}

export function subtractSigned(left: number, right: number): number {
  const a = decimalFraction(left, 'Уменьшаемое');
  const b = decimalFraction(right, 'Вычитаемое');
  return fractionToNumber({
    numerator: a.numerator * b.denominator - b.numerator * a.denominator,
    denominator: a.denominator * b.denominator,
  }, 'Разность');
}

export function multiplySigned(left: number, right: number): number {
  const a = decimalFraction(left, 'Первый множитель');
  const b = decimalFraction(right, 'Второй множитель');
  return fractionToNumber({
    numerator: a.numerator * b.numerator,
    denominator: a.denominator * b.denominator,
  }, 'Произведение');
}

export function divideSigned(dividend: number, divisor: number): number {
  const a = decimalFraction(dividend, 'Делимое');
  const b = decimalFraction(divisor, 'Делитель');
  if (b.numerator === 0n) throw new RangeError('Делить на ноль нельзя');

  return fractionToNumber({
    numerator: a.numerator * b.denominator,
    denominator: a.denominator * b.numerator,
  }, 'Частное');
}

export function quadrantOf(point: CoordinatePoint): Quadrant;
export function quadrantOf(x: number, y: number): Quadrant;
export function quadrantOf(pointOrX: CoordinatePoint | number, yValue?: number): Quadrant {
  const x = typeof pointOrX === 'number' ? pointOrX : pointOrX.x;
  const y = typeof pointOrX === 'number' ? yValue : pointOrX.y;
  if (y === undefined) throw new TypeError('Нужно указать обе координаты');

  const safeX = normalizeSignedZero(x);
  const safeY = normalizeSignedZero(y);
  if (safeX === 0 || safeY === 0) return null;
  if (safeX > 0 && safeY > 0) return 1;
  if (safeX < 0 && safeY > 0) return 2;
  if (safeX < 0 && safeY < 0) return 3;
  return 4;
}

export function reflectPoint(point: CoordinatePoint, axis: ReflectionAxis): CoordinatePoint;
export function reflectPoint(x: number, y: number, axis: ReflectionAxis): CoordinatePoint;
export function reflectPoint(
  pointOrX: CoordinatePoint | number,
  yOrAxis: number | ReflectionAxis,
  possibleAxis?: ReflectionAxis,
): CoordinatePoint {
  const point = typeof pointOrX === 'number'
    ? { x: pointOrX, y: yOrAxis as number }
    : pointOrX;
  const axis = typeof pointOrX === 'number' ? possibleAxis : yOrAxis as ReflectionAxis;
  const x = normalizeSignedZero(point.x);
  const y = normalizeSignedZero(point.y);

  if (axis === 'x') return { x, y: opposite(y) };
  if (axis === 'y') return { x: opposite(x), y };
  if (axis === 'origin') return { x: opposite(x), y: opposite(y) };
  throw new RangeError(`Неизвестная ось отражения: ${String(axis)}`);
}

export function translatePoint(point: CoordinatePoint, vector: CoordinateVector): CoordinatePoint;
export function translatePoint(point: CoordinatePoint, dx: number, dy: number): CoordinatePoint;
export function translatePoint(x: number, y: number, dx: number, dy: number): CoordinatePoint;
export function translatePoint(
  pointOrX: CoordinatePoint | number,
  vectorOrY: CoordinateVector | number,
  dxOrDy?: number,
  possibleDy?: number,
): CoordinatePoint {
  let point: CoordinatePoint;
  let dx: number;
  let dy: number;

  if (typeof pointOrX === 'number') {
    point = { x: pointOrX, y: vectorOrY as number };
    dx = dxOrDy as number;
    dy = possibleDy as number;
  } else if (typeof vectorOrY === 'number') {
    point = pointOrX;
    dx = vectorOrY;
    dy = dxOrDy as number;
  } else {
    point = pointOrX;
    dx = vectorOrY.dx;
    dy = vectorOrY.dy;
  }

  if (dx === undefined || dy === undefined) throw new TypeError('Нужно указать оба смещения');
  return {
    x: addSigned(point.x, dx),
    y: addSigned(point.y, dy),
  };
}

/** True exactly for finite, safely representable multiples of 1/2. */
export function isHalfStepNumber(value: number): boolean {
  return Number.isFinite(value)
    && Math.abs(value) <= MAX_SAFE_MAGNITUDE / 2
    && Number.isSafeInteger(value * 2);
}

export function toHalfTicks(value: number): number {
  if (!isHalfStepNumber(value)) {
    throw new RangeError('Число должно быть безопасным целым или полуцелым');
  }
  return normalizeZero(value * 2);
}

export function fromHalfTicks(ticks: number): number {
  if (!Number.isSafeInteger(ticks)) {
    throw new RangeError('Число полушагов должно быть безопасным целым');
  }
  return normalizeZero(ticks / 2);
}

/** True when a half-step value lies on the zero-anchored grid for `step`. */
export function isHalfStepGridValue(value: number, step: number): boolean {
  if (!isHalfStepNumber(value) || !isHalfStepNumber(step) || step <= 0) return false;
  return toHalfTicks(value) % toHalfTicks(step) === 0;
}

/**
 * Builds a bounded, zero-anchored half-step grid for the interactive labs.
 * The returned endpoints are always reachable with repeated `step` nudges.
 */
export function normalizeHalfStepRange(
  minimum: number | undefined,
  maximum: number | undefined,
  requestedStep: number | undefined,
  options: HalfStepRangeOptions,
): HalfStepRange {
  const hardMinimum = options.hardMinimum ?? -30;
  const hardMaximum = options.hardMaximum ?? 30;
  const maximumStep = options.maximumStep ?? 5;
  const configuredDefaultStep = options.defaultStep ?? 0.5;

  if (
    !isHalfStepNumber(hardMinimum)
    || !isHalfStepNumber(hardMaximum)
    || hardMinimum >= hardMaximum
    || !isHalfStepNumber(options.defaultMinimum)
    || !isHalfStepNumber(options.defaultMaximum)
  ) {
    throw new RangeError('Границы сетки должны быть корректными целыми или полуцелыми числами');
  }

  const defaultStep = isHalfStepNumber(configuredDefaultStep)
    && configuredDefaultStep > 0
    && configuredDefaultStep <= maximumStep
    ? configuredDefaultStep
    : 0.5;
  let step = requestedStep !== undefined
    && isHalfStepNumber(requestedStep)
    && requestedStep > 0
    && requestedStep <= maximumStep
    ? requestedStep
    : defaultStep;

  const bounded = (value: number | undefined, fallback: number) => {
    const candidate = value !== undefined && isHalfStepNumber(value) ? value : fallback;
    return Math.max(hardMinimum, Math.min(hardMaximum, candidate));
  };

  let rawMinimum = bounded(minimum, options.defaultMinimum);
  let rawMaximum = bounded(maximum, options.defaultMaximum);
  if (rawMaximum <= rawMinimum) {
    rawMinimum = bounded(options.defaultMinimum, hardMinimum);
    rawMaximum = bounded(options.defaultMaximum, hardMaximum);
  }
  if (rawMaximum <= rawMinimum) {
    rawMinimum = hardMinimum;
    rawMaximum = hardMaximum;
  }

  const align = (gridStep: number): HalfStepRange | null => {
    const alignedRawMinimum = options.includeValuesAroundZero
      ? Math.min(rawMinimum, -gridStep)
      : rawMinimum;
    const alignedRawMaximum = options.includeValuesAroundZero
      ? Math.max(rawMaximum, gridStep)
      : rawMaximum;

    const stepTicks = toHalfTicks(gridStep);
    const hardMinimumTicks = toHalfTicks(hardMinimum);
    const hardMaximumTicks = toHalfTicks(hardMaximum);
    const lowestGridTick = Math.ceil(hardMinimumTicks / stepTicks) * stepTicks;
    const highestGridTick = Math.floor(hardMaximumTicks / stepTicks) * stepTicks;
    const minimumTicks = Math.max(
      lowestGridTick,
      Math.ceil(toHalfTicks(alignedRawMinimum) / stepTicks) * stepTicks,
    );
    const maximumTicks = Math.min(
      highestGridTick,
      Math.floor(toHalfTicks(alignedRawMaximum) / stepTicks) * stepTicks,
    );

    if (maximumTicks <= minimumTicks) return null;
    return {
      minimum: fromHalfTicks(minimumTicks),
      maximum: fromHalfTicks(maximumTicks),
      step: gridStep,
    };
  };

  let range = align(step);
  if (range === null && step !== defaultStep) {
    step = defaultStep;
    range = align(step);
  }
  if (range === null) {
    throw new RangeError('Диапазон слишком узок для выбранного шага');
  }
  return range;
}

/**
 * Parses an editable Russian decimal. Intermediate drafts such as "-" are
 * deliberately returned as null; "-0," is valid and normalizes to zero.
 */
export function parseSignedDraft(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '+') return null;
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(trimmed)) return null;

  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value) || Math.abs(value) > MAX_SAFE_MAGNITUDE) return null;
  return normalizeZero(value);
}

/** Rounds on an integer half-tick grid, so repeated moves never accumulate drift. */
export function quantizeHalfStep(value: number, step = 0.5): number {
  const ticks = toHalfTicks(value);
  const stepTicks = toHalfTicks(step);
  if (stepTicks <= 0) throw new RangeError('Шаг должен быть положительным');
  const snappedTicks = Math.round(ticks / stepTicks) * stepTicks;
  if (!Number.isSafeInteger(snappedTicks)) throw new RangeError('Результат выходит за безопасный числовой диапазон');
  return fromHalfTicks(snappedTicks);
}

export function formatRussianNumber(value: number): string {
  const safe = normalizeSignedZero(value);
  return String(safe).replace('-', '−').replace('.', ',');
}
