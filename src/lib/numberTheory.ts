export interface DivisionWithRemainder {
  quotient: number;
  remainder: number;
}

export type FactorPair = [factor: number, cofactor: number];

const DETERMINISTIC_MILLER_RABIN_BASES = [2n, 325n, 9_375n, 28_178n, 450_775n, 9_780_504n, 1_795_265_022n];

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} должно быть безопасным целым числом`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} должно быть положительным целым числом`);
  }
}

function toSafeNumber(value: bigint, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${label} выходит за диапазон безопасных целых чисел`);
  }
  return result;
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function modPower(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let factor = base % modulus;
  let power = exponent;

  while (power > 0n) {
    if (power % 2n === 1n) result = (result * factor) % modulus;
    factor = (factor * factor) % modulus;
    power /= 2n;
  }

  return result;
}

/** Возвращает все положительные делители натурального числа по возрастанию. */
export function divisors(value: number): number[] {
  assertPositiveInteger(value, 'Число для поиска делителей');

  const result = [1];
  const factors = primeFactorization(value);

  for (let index = 0; index < factors.length;) {
    const prime = factors[index];
    let exponent = 0;
    while (factors[index + exponent] === prime) exponent += 1;

    const existing = [...result];
    let power = 1;
    for (let currentExponent = 1; currentExponent <= exponent; currentExponent += 1) {
      power *= prime;
      for (const divisor of existing) result.push(divisor * power);
    }
    index += exponent;
  }

  return result.sort((left, right) => left - right);
}

/** Возвращает пары положительных множителей [a, b], где a <= b и a * b = value. */
export function factorPairs(value: number): FactorPair[] {
  assertPositiveInteger(value, 'Число для поиска пар множителей');

  return divisors(value)
    .filter((factor) => factor <= value / factor)
    .map((factor) => [factor, value / factor]);
}

/**
 * Выполняет евклидово деление: dividend = divisor * quotient + remainder,
 * где 0 <= remainder < |divisor|.
 */
export function divideWithRemainder(dividend: number, divisor: number): DivisionWithRemainder {
  assertSafeInteger(dividend, 'Делимое');
  assertSafeInteger(divisor, 'Делитель');
  if (divisor === 0) throw new RangeError('Делитель не может быть равен нулю');

  const bigDividend = BigInt(dividend);
  const bigDivisor = BigInt(divisor);
  let quotient = bigDividend / bigDivisor;
  let remainder = bigDividend % bigDivisor;

  if (remainder < 0n) {
    if (bigDivisor > 0n) {
      quotient -= 1n;
      remainder += bigDivisor;
    } else {
      quotient += 1n;
      remainder -= bigDivisor;
    }
  }

  return {
    quotient: toSafeNumber(quotient, 'Частное'),
    remainder: toSafeNumber(remainder, 'Остаток'),
  };
}

/** Проверяет простоту безопасного целого числа. Числа меньше 2 не являются простыми. */
export function isPrime(value: number): boolean {
  assertSafeInteger(value, 'Проверяемое число');
  if (value < 2) return false;

  const candidate = BigInt(value);
  for (const smallPrime of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (candidate === smallPrime) return true;
    if (candidate % smallPrime === 0n) return false;
  }

  let oddPart = candidate - 1n;
  let powerOfTwo = 0;
  while (oddPart % 2n === 0n) {
    oddPart /= 2n;
    powerOfTwo += 1;
  }

  for (const rawBase of DETERMINISTIC_MILLER_RABIN_BASES) {
    const base = rawBase % candidate;
    if (base === 0n) continue;

    let witness = modPower(base, oddPart, candidate);
    if (witness === 1n || witness === candidate - 1n) continue;

    let probablyPrime = false;
    for (let round = 1; round < powerOfTwo; round += 1) {
      witness = (witness * witness) % candidate;
      if (witness === candidate - 1n) {
        probablyPrime = true;
        break;
      }
    }
    if (!probablyPrime) return false;
  }

  return true;
}

/** Возвращает простые множители натурального числа с повторениями; для 1 — пустой список. */
export function primeFactorization(value: number): number[] {
  assertPositiveInteger(value, 'Число для разложения');
  if (value === 1) return [];
  if (isPrime(value)) return [value];

  const result: number[] = [];
  let remaining = value;

  for (const prime of [2, 3]) {
    while (remaining % prime === 0) {
      result.push(prime);
      remaining /= prime;
    }
  }

  let candidate = 5;
  let step = 2;
  while (candidate <= Math.floor(Math.sqrt(remaining))) {
    if (remaining % candidate === 0) {
      do {
        result.push(candidate);
        remaining /= candidate;
      } while (remaining % candidate === 0);

      if (remaining > 1 && isPrime(remaining)) {
        result.push(remaining);
        return result;
      }
    }
    candidate += step;
    step = 6 - step;
  }

  if (remaining > 1) result.push(remaining);
  return result;
}

/** Возвращает неотрицательный НОД; gcd(0, 0) = 0. */
export function gcd(a: number, b: number): number {
  assertSafeInteger(a, 'Первый аргумент НОД');
  assertSafeInteger(b, 'Второй аргумент НОД');

  let left = absolute(BigInt(a));
  let right = absolute(BigInt(b));
  while (right !== 0n) {
    [left, right] = [right, left % right];
  }

  return toSafeNumber(left, 'НОД');
}

/** Возвращает неотрицательный НОК; если один из аргументов равен 0, результат равен 0. */
export function lcm(a: number, b: number): number {
  assertSafeInteger(a, 'Первый аргумент НОК');
  assertSafeInteger(b, 'Второй аргумент НОК');
  if (a === 0 || b === 0) return 0;

  const divisor = BigInt(gcd(a, b));
  const result = absolute((BigInt(a) / divisor) * BigInt(b));
  return toSafeNumber(result, 'НОК');
}
