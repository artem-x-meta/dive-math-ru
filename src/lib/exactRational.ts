export interface ExactRational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export type ExactInput = number | string | ExactRational;

export type ExactRationalErrorCode =
  | 'invalid-number'
  | 'division-by-zero'
  | 'limit-exceeded';

export class ExactRationalError extends Error {
  readonly code: ExactRationalErrorCode;

  constructor(code: ExactRationalErrorCode, message: string) {
    super(message);
    this.name = 'ExactRationalError';
    this.code = code;
  }
}

export const EXACT_RATIONAL_LIMITS = Object.freeze({
  /** Bound the work done by trimming and validating an untrusted textual input. */
  maxSourceLength: 1024,
  /** Maximum number of decimal digits accepted in one textual operand. */
  maxInputDigits: 256,
  /** Guard against accidentally constructing enormous intermediate values. */
  maxResultDigits: 2048,
  /** Numeric inputs written in exponential notation may not exceed this power. */
  maxAbsoluteExponent: 512,
});

const ZERO = makeUnchecked(0n, 1n);

function makeUnchecked(numerator: bigint, denominator: bigint): ExactRational {
  return Object.freeze({ numerator, denominator });
}

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcdBigInt(left: bigint, right: bigint): bigint {
  let a = absoluteBigInt(left);
  let b = absoluteBigInt(right);

  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a;
}

function countDigits(value: bigint): number {
  return absoluteBigInt(value).toString().length;
}

function assertResultSize(numerator: bigint, denominator: bigint): void {
  if (
    countDigits(numerator) > EXACT_RATIONAL_LIMITS.maxResultDigits ||
    countDigits(denominator) > EXACT_RATIONAL_LIMITS.maxResultDigits
  ) {
    throw new ExactRationalError(
      'limit-exceeded',
      `Exact value exceeds the ${EXACT_RATIONAL_LIMITS.maxResultDigits}-digit safety limit.`,
    );
  }
}

function normalize(numerator: bigint, denominator: bigint): ExactRational {
  if (denominator === 0n) {
    throw new ExactRationalError('division-by-zero', 'An exact rational denominator cannot be zero.');
  }

  if (numerator === 0n) {
    return ZERO;
  }

  const sign = denominator < 0n ? -1n : 1n;
  const commonDivisor = gcdBigInt(numerator, denominator);
  const normalizedNumerator = (numerator / commonDivisor) * sign;
  const normalizedDenominator = (denominator / commonDivisor) * sign;
  assertResultSize(normalizedNumerator, normalizedDenominator);
  return makeUnchecked(normalizedNumerator, normalizedDenominator);
}

function invalidNumber(message: string): never {
  throw new ExactRationalError('invalid-number', message);
}

function parseDecimal(source: string): ExactRational {
  const match = /^([+\-−]?)(?:(\d+)(?:[.,](\d*))?|[.,](\d+))(?:[eE]([+-]?\d+))?$/.exec(source);
  if (!match) {
    return invalidNumber(`Invalid exact number: "${source}".`);
  }

  const integerDigits = match[2] ?? '0';
  const fractionalDigits = match[3] ?? match[4] ?? '';
  const digitCount = integerDigits.length + fractionalDigits.length;
  if (digitCount > EXACT_RATIONAL_LIMITS.maxInputDigits) {
    throw new ExactRationalError(
      'limit-exceeded',
      `An exact number may contain at most ${EXACT_RATIONAL_LIMITS.maxInputDigits} digits.`,
    );
  }

  const exponent = match[5] === undefined ? 0 : Number(match[5]);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > EXACT_RATIONAL_LIMITS.maxAbsoluteExponent) {
    throw new ExactRationalError(
      'limit-exceeded',
      `The exponent must be between -${EXACT_RATIONAL_LIMITS.maxAbsoluteExponent} and ${EXACT_RATIONAL_LIMITS.maxAbsoluteExponent}.`,
    );
  }

  const unsignedDigits = `${integerDigits}${fractionalDigits}`;
  const sign = match[1] === '-' || match[1] === '−' ? -1n : 1n;
  let numerator = sign * BigInt(unsignedDigits);
  let denominator = 10n ** BigInt(fractionalDigits.length);

  if (exponent > 0) {
    numerator *= 10n ** BigInt(exponent);
  } else if (exponent < 0) {
    denominator *= 10n ** BigInt(-exponent);
  }

  return normalize(numerator, denominator);
}

function isExactRational(value: unknown): value is ExactRational {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<ExactRational>;
  return typeof candidate.numerator === 'bigint' && typeof candidate.denominator === 'bigint';
}

export function parseExact(input: ExactInput): ExactRational {
  if (isExactRational(input)) {
    if (input.denominator === 0n) {
      throw new ExactRationalError('division-by-zero', 'An exact rational denominator cannot be zero.');
    }
    assertResultSize(input.numerator, input.denominator);
    return normalize(input.numerator, input.denominator);
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      return invalidNumber('An exact number must be finite.');
    }

    return parseDecimal(Object.is(input, -0) ? '0' : input.toString());
  }

  if (typeof input !== 'string') {
    return invalidNumber('Expected a number, a string, or an exact rational value.');
  }

  if (input.length > EXACT_RATIONAL_LIMITS.maxSourceLength) {
    throw new ExactRationalError(
      'limit-exceeded',
      `An exact number may contain at most ${EXACT_RATIONAL_LIMITS.maxSourceLength} characters.`,
    );
  }

  const source = input.trim();
  if (source.length === 0) {
    return invalidNumber('An exact number cannot be empty.');
  }

  const slash = source.indexOf('/');
  if (slash !== -1) {
    if (slash !== source.lastIndexOf('/')) {
      return invalidNumber(`Invalid exact fraction: "${source}".`);
    }

    const numeratorSource = source.slice(0, slash).trim();
    const denominatorSource = source.slice(slash + 1).trim();
    if (numeratorSource.length === 0 || denominatorSource.length === 0) {
      return invalidNumber(`Invalid exact fraction: "${source}".`);
    }

    return divideExact(parseDecimal(numeratorSource), parseDecimal(denominatorSource));
  }

  return parseDecimal(source);
}

export function addExact(left: ExactInput, right: ExactInput): ExactRational {
  const a = parseExact(left);
  const b = parseExact(right);
  const commonDivisor = gcdBigInt(a.denominator, b.denominator);
  const leftScale = b.denominator / commonDivisor;
  const rightScale = a.denominator / commonDivisor;
  return normalize(a.numerator * leftScale + b.numerator * rightScale, a.denominator * leftScale);
}

export function subtractExact(left: ExactInput, right: ExactInput): ExactRational {
  const a = parseExact(left);
  const b = parseExact(right);
  const commonDivisor = gcdBigInt(a.denominator, b.denominator);
  const leftScale = b.denominator / commonDivisor;
  const rightScale = a.denominator / commonDivisor;
  return normalize(a.numerator * leftScale - b.numerator * rightScale, a.denominator * leftScale);
}

export function multiplyExact(left: ExactInput, right: ExactInput): ExactRational {
  const a = parseExact(left);
  const b = parseExact(right);

  // Cross-cancellation keeps intermediate BigInts much smaller.
  const firstDivisor = gcdBigInt(a.numerator, b.denominator);
  const secondDivisor = gcdBigInt(b.numerator, a.denominator);
  return normalize(
    (a.numerator / firstDivisor) * (b.numerator / secondDivisor),
    (a.denominator / secondDivisor) * (b.denominator / firstDivisor),
  );
}

export function divideExact(dividend: ExactInput, divisor: ExactInput): ExactRational {
  const a = parseExact(dividend);
  const b = parseExact(divisor);
  if (b.numerator === 0n) {
    throw new ExactRationalError('division-by-zero', 'Division by zero is undefined.');
  }

  return multiplyExact(a, makeUnchecked(b.denominator, b.numerator));
}

export function compareExact(left: ExactInput, right: ExactInput): -1 | 0 | 1 {
  const a = parseExact(left);
  const b = parseExact(right);
  const difference = a.numerator * b.denominator - b.numerator * a.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function negateExact(value: ExactInput): ExactRational {
  const exact = parseExact(value);
  return normalize(-exact.numerator, exact.denominator);
}

export function isExactZero(value: ExactInput): boolean {
  return parseExact(value).numerator === 0n;
}

export function toExactNumber(value: ExactInput): number {
  const exact = parseExact(value);
  const result = Number(exact.numerator) / Number(exact.denominator);
  if (!Number.isFinite(result) || (exact.numerator !== 0n && result === 0)) {
    throw new ExactRationalError('limit-exceeded', 'The exact value cannot be represented as a finite number.');
  }
  return Object.is(result, -0) ? 0 : result;
}

function terminatingDecimalScale(denominator: bigint): number | null {
  let remaining = denominator;
  let powersOfTwo = 0;
  let powersOfFive = 0;

  while (remaining % 2n === 0n) {
    remaining /= 2n;
    powersOfTwo += 1;
  }
  while (remaining % 5n === 0n) {
    remaining /= 5n;
    powersOfFive += 1;
  }

  return remaining === 1n ? Math.max(powersOfTwo, powersOfFive) : null;
}

export function formatExactRussian(input: ExactInput): string {
  const value = parseExact(input);
  if (value.denominator === 1n) {
    return value.numerator < 0n ? `−${absoluteBigInt(value.numerator).toString()}` : value.numerator.toString();
  }

  const scale = terminatingDecimalScale(value.denominator);
  if (scale === null) {
    const sign = value.numerator < 0n ? '−' : '';
    return `${sign}${absoluteBigInt(value.numerator).toString()}/${value.denominator.toString()}`;
  }

  const sign = value.numerator < 0n ? '−' : '';
  const absoluteNumerator = absoluteBigInt(value.numerator);
  const scaledInteger = absoluteNumerator * (10n ** BigInt(scale) / value.denominator);
  const padded = scaledInteger.toString().padStart(scale + 1, '0');
  const integerPart = padded.slice(0, -scale) || '0';
  const fractionalPart = padded.slice(-scale).replace(/0+$/, '');
  return fractionalPart.length === 0 ? `${sign}${integerPart}` : `${sign}${integerPart},${fractionalPart}`;
}
