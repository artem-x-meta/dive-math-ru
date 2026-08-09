export interface Ratio {
  first: number;
  second: number;
}

export interface Rational {
  numerator: number;
  denominator: number;
}

export type ProportionTerm = number | null;
export type ProportionIndex = 0 | 1 | 2 | 3;

export interface ProportionSolution {
  unknownIndex: ProportionIndex;
  value: Rational;
}

export type MeasurementUnit =
  | 'piece'
  | 'mm'
  | 'cm'
  | 'm'
  | 'km'
  | 'mg'
  | 'g'
  | 'kg';

export interface Quantity {
  value: number;
  unit: MeasurementUnit;
}

type Dimension = 'count' | 'length' | 'mass';

interface UnitDefinition {
  dimension: Dimension;
  /** Множитель для перевода в наименьшую единицу измерения. */
  scale: bigint;
}

interface BigRational {
  numerator: bigint;
  denominator: bigint;
}

const UNIT_DEFINITIONS: Record<MeasurementUnit, UnitDefinition> = {
  piece: { dimension: 'count', scale: 1n },
  mm: { dimension: 'length', scale: 1n },
  cm: { dimension: 'length', scale: 10n },
  m: { dimension: 'length', scale: 1_000n },
  km: { dimension: 'length', scale: 1_000_000n },
  mg: { dimension: 'mass', scale: 1n },
  g: { dimension: 'mass', scale: 1_000n },
  kg: { dimension: 'mass', scale: 1_000_000n },
};

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} должно быть безопасным целым числом`);
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

function bigintGcd(a: bigint, b: bigint): bigint {
  let left = absolute(a);
  let right = absolute(b);

  while (right !== 0n) {
    [left, right] = [right, left % right];
  }

  return left;
}

function numberToBigRational(value: number, label: string): BigRational {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new TypeError(`${label} должно быть конечным числом в безопасном диапазоне`);
  }
  if (value === 0) return { numerator: 0n, denominator: 1n };

  const [coefficient, exponentText = '0'] = value.toString().toLowerCase().split('e');
  const exponent = Number(exponentText);
  const negative = coefficient.startsWith('-');
  const unsigned = negative ? coefficient.slice(1) : coefficient;
  const [integerPart, fractionalPart = ''] = unsigned.split('.');
  let numerator = BigInt(`${integerPart}${fractionalPart}`);
  let denominator = 10n ** BigInt(fractionalPart.length);

  if (exponent > 0) numerator *= 10n ** BigInt(exponent);
  if (exponent < 0) denominator *= 10n ** BigInt(-exponent);
  if (negative) numerator = -numerator;

  const divisor = bigintGcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function normalizeBigRatio(first: bigint, second: bigint): Ratio {
  if (first === 0n && second === 0n) {
    throw new RangeError('Отношение 0 : 0 не определено');
  }
  if (second === 0n) {
    throw new RangeError('Второй член отношения не может быть равен нулю');
  }

  const divisor = bigintGcd(first, second);
  let normalizedFirst = first / divisor;
  let normalizedSecond = second / divisor;

  // Знак храним у первого члена, знаменатель канонической дроби положителен.
  if (normalizedSecond < 0n) {
    normalizedFirst = -normalizedFirst;
    normalizedSecond = -normalizedSecond;
  }

  return {
    first: toSafeNumber(normalizedFirst, 'Первый член отношения'),
    second: toSafeNumber(normalizedSecond, 'Второй член отношения'),
  };
}

function normalizeBigRational(numerator: bigint, denominator: bigint): Rational {
  if (denominator === 0n) {
    throw new RangeError('У пропорции нет единственного решения');
  }
  if (numerator === 0n) return { numerator: 0, denominator: 1 };

  const divisor = bigintGcd(numerator, denominator);
  let reducedNumerator = numerator / divisor;
  let reducedDenominator = denominator / divisor;

  if (reducedDenominator < 0n) {
    reducedNumerator = -reducedNumerator;
    reducedDenominator = -reducedDenominator;
  }

  return {
    numerator: toSafeNumber(reducedNumerator, 'Числитель ответа'),
    denominator: toSafeNumber(reducedDenominator, 'Знаменатель ответа'),
  };
}

function assertDefinedRatio(first: number, second: number, label: string): void {
  assertSafeInteger(first, `Первый член ${label}`);
  assertSafeInteger(second, `Второй член ${label}`);
  if (first === 0 && second === 0) {
    throw new RangeError(`${label} 0 : 0 не определено`);
  }
  if (second === 0) {
    throw new RangeError(`Второй член ${label.toLowerCase()} не может быть равен нулю`);
  }
}

function getUnitDefinition(unit: MeasurementUnit): UnitDefinition {
  const definition = UNIT_DEFINITIONS[unit];
  if (!definition) throw new RangeError(`Неизвестная единица измерения: ${String(unit)}`);
  return definition;
}

function quantityInBaseUnits(quantity: Quantity, label: string): BigRational {
  const value = numberToBigRational(quantity.value, label);
  const definition = getUnitDefinition(quantity.unit);
  return {
    numerator: value.numerator * definition.scale,
    denominator: value.denominator,
  };
}

/**
 * Сокращает отношение до канонической формы. Общий знак переносится к первому
 * члену; отношение 0 : b допустимо при b != 0, а деление на ноль запрещено.
 */
export function normalizeRatio(first: number, second: number): Ratio;
export function normalizeRatio(ratio: Ratio): Ratio;
export function normalizeRatio(firstOrRatio: number | Ratio, secondValue?: number): Ratio {
  const first = typeof firstOrRatio === 'number' ? firstOrRatio : firstOrRatio.first;
  const second = typeof firstOrRatio === 'number' ? secondValue : firstOrRatio.second;

  if (second === undefined) {
    throw new TypeError('Нужно указать оба члена отношения');
  }
  assertSafeInteger(first, 'Первый член отношения');
  assertSafeInteger(second, 'Второй член отношения');

  return normalizeBigRatio(BigInt(first), BigInt(second));
}

/** Сравнивает отношения точно, без переполнения при перекрёстном умножении. */
export function equivalentRatios(first: number, second: number, otherFirst: number, otherSecond: number): boolean;
export function equivalentRatios(left: Ratio, right: Ratio): boolean;
export function equivalentRatios(
  firstOrLeft: number | Ratio,
  secondOrRight: number | Ratio,
  otherFirst?: number,
  otherSecond?: number,
): boolean {
  const left = typeof firstOrLeft === 'number'
    ? { first: firstOrLeft, second: secondOrRight as number }
    : firstOrLeft;
  const right = typeof firstOrLeft === 'number'
    ? { first: otherFirst as number, second: otherSecond as number }
    : secondOrRight as Ratio;

  assertDefinedRatio(left.first, left.second, 'Левое отношение');
  assertDefinedRatio(right.first, right.second, 'Правое отношение');

  return BigInt(left.first) * BigInt(right.second) === BigInt(left.second) * BigInt(right.first);
}

/**
 * Находит единственный неизвестный член в a : b = c : d. Ровно один аргумент
 * должен быть null. Ответ возвращается несократимой точной дробью.
 */
export function solveProportion(
  a: ProportionTerm,
  b: ProportionTerm,
  c: ProportionTerm,
  d: ProportionTerm,
): ProportionSolution {
  const terms = [a, b, c, d] as const;
  const missing = terms
    .map((term, index) => term === null ? index : -1)
    .filter((index) => index !== -1);

  if (missing.length !== 1) {
    throw new RangeError('В пропорции должен быть ровно один неизвестный член');
  }

  terms.forEach((term, index) => {
    if (term !== null) assertSafeInteger(term, `Член пропорции №${index + 1}`);
  });

  if (b !== null && b === 0) throw new RangeError('Второй член отношения не может быть равен нулю');
  if (d !== null && d === 0) throw new RangeError('Четвёртый член отношения не может быть равен нулю');

  const unknownIndex = missing[0] as ProportionIndex;
  let numerator: bigint;
  let denominator: bigint;

  switch (unknownIndex) {
    case 0:
      numerator = BigInt(b as number) * BigInt(c as number);
      denominator = BigInt(d as number);
      break;
    case 1:
      numerator = BigInt(a as number) * BigInt(d as number);
      denominator = BigInt(c as number);
      break;
    case 2:
      numerator = BigInt(a as number) * BigInt(d as number);
      denominator = BigInt(b as number);
      break;
    case 3:
      numerator = BigInt(b as number) * BigInt(c as number);
      denominator = BigInt(a as number);
      break;
  }

  const value = normalizeBigRational(numerator, denominator);
  if ((unknownIndex === 1 || unknownIndex === 3) && value.numerator === 0) {
    throw new RangeError('Неизвестный знаменатель отношения не может быть равен нулю');
  }

  return { unknownIndex, value };
}

/** Проверяет, можно ли переводить две единицы друг в друга. */
export function compatibleUnits(first: MeasurementUnit, second: MeasurementUnit): boolean {
  return getUnitDefinition(first).dimension === getUnitDefinition(second).dimension;
}

/** Переводит конечное десятичное количество в другую единицу и возвращает точную дробь. */
export function convertQuantity(value: number, from: MeasurementUnit, to: MeasurementUnit): Rational {
  const exactValue = numberToBigRational(value, 'Количество');
  const source = getUnitDefinition(from);
  const target = getUnitDefinition(to);
  if (source.dimension !== target.dimension) {
    throw new RangeError('Нельзя переводить величины разных видов');
  }

  return normalizeBigRational(
    exactValue.numerator * source.scale,
    exactValue.denominator * target.scale,
  );
}

/** Составляет и сокращает отношение величин после точного перевода в общие единицы. */
export function normalizeQuantityRatio(first: Quantity, second: Quantity): Ratio {
  const firstDefinition = getUnitDefinition(first.unit);
  const secondDefinition = getUnitDefinition(second.unit);
  if (firstDefinition.dimension !== secondDefinition.dimension) {
    throw new RangeError('Отношение можно составить только для величин одного вида');
  }

  const exactFirst = quantityInBaseUnits(first, 'Первая величина');
  const exactSecond = quantityInBaseUnits(second, 'Вторая величина');
  return normalizeBigRatio(
    exactFirst.numerator * exactSecond.denominator,
    exactSecond.numerator * exactFirst.denominator,
  );
}

/** Сокращает отношение одной части к сумме двух совместимых величин. */
export function normalizePartToWholeRatio(part: Quantity, otherPart: Quantity): Ratio {
  const partDefinition = getUnitDefinition(part.unit);
  const otherDefinition = getUnitDefinition(otherPart.unit);
  if (partDefinition.dimension !== otherDefinition.dimension) {
    throw new RangeError('Части целого должны быть величинами одного вида');
  }
  if (part.value < 0 || otherPart.value < 0) {
    throw new RangeError('Части целого не могут быть отрицательными');
  }

  const partInBaseUnits = quantityInBaseUnits(part, 'Первая часть');
  const otherInBaseUnits = quantityInBaseUnits(otherPart, 'Вторая часть');
  const commonPart = partInBaseUnits.numerator * otherInBaseUnits.denominator;
  const commonOtherPart = otherInBaseUnits.numerator * partInBaseUnits.denominator;
  return normalizeBigRatio(commonPart, commonPart + commonOtherPart);
}
