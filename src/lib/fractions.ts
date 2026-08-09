export interface Fraction {
  numerator: number;
  denominator: number;
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} должно быть конечным безопасным целым числом`);
  }
}

function validateFraction(fraction: Fraction): void {
  assertSafeInteger(fraction.numerator, 'Числитель');
  assertSafeInteger(fraction.denominator, 'Знаменатель');
  if (fraction.denominator === 0) {
    throw new Error('Знаменатель не может быть равен нулю');
  }
}

function bigintGcd(a: bigint, b: bigint): bigint {
  let left = a < 0n ? -a : a;
  let right = b < 0n ? -b : b;
  while (right !== 0n) {
    [left, right] = [right, left % right];
  }
  return left;
}

function toSafeNumber(value: bigint, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} выходит за диапазон точных целых чисел`);
  }
  return result;
}

export function gcd(a: number, b: number): number {
  assertSafeInteger(a, 'Первый аргумент НОД');
  assertSafeInteger(b, 'Второй аргумент НОД');
  let left = Math.abs(a);
  let right = Math.abs(b);

  while (right !== 0) {
    [left, right] = [right, left % right];
  }

  return left;
}

export function lcm(a: number, b: number): number {
  assertSafeInteger(a, 'Первый аргумент НОК');
  assertSafeInteger(b, 'Второй аргумент НОК');
  if (a === 0 || b === 0) return 0;
  const divisor = gcd(a, b);
  const result = BigInt(Math.abs(a / divisor)) * BigInt(Math.abs(b));
  return toSafeNumber(result, 'НОК');
}

export function simplify(fraction: Fraction): Fraction {
  validateFraction(fraction);

  if (fraction.numerator === 0) {
    return { numerator: 0, denominator: 1 };
  }

  const sign = fraction.denominator < 0 ? -1 : 1;
  const divisor = gcd(fraction.numerator, fraction.denominator);

  return {
    numerator: sign * (fraction.numerator / divisor),
    denominator: Math.abs(fraction.denominator / divisor),
  };
}

export function compareFractions(a: Fraction, b: Fraction): -1 | 0 | 1 {
  validateFraction(a);
  validateFraction(b);

  const left = simplify(a);
  const right = simplify(b);
  const leftProduct = BigInt(left.numerator) * BigInt(right.denominator);
  const rightProduct = BigInt(right.numerator) * BigInt(left.denominator);
  return leftProduct === rightProduct ? 0 : leftProduct < rightProduct ? -1 : 1;
}

export function addFractions(a: Fraction, b: Fraction): Fraction {
  validateFraction(a);
  validateFraction(b);

  let numerator = BigInt(a.numerator) * BigInt(b.denominator) + BigInt(b.numerator) * BigInt(a.denominator);
  let denominator = BigInt(a.denominator) * BigInt(b.denominator);
  if (numerator === 0n) return { numerator: 0, denominator: 1 };

  const divisor = bigintGcd(numerator, denominator);
  numerator /= divisor;
  denominator /= divisor;
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }

  return {
    numerator: toSafeNumber(numerator, 'Числитель результата'),
    denominator: toSafeNumber(denominator, 'Знаменатель результата'),
  };
}
