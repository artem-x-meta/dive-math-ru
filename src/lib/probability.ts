/**
 * Вычислительное ядро главы «Вероятностные деревья» (8 класс).
 *
 * Все вероятности и статистики считаются точно, на несократимых дробях
 * с целыми числителем и знаменателем. Внутри используется bigint,
 * чтобы промежуточные произведения не теряли точность.
 */

export interface Fraction {
  /** Числитель; знак дроби хранится здесь. */
  numerator: number;
  /** Знаменатель; всегда положительный. */
  denominator: number;
}

export interface TreeEdge {
  /** Подпись ребра: исход шага, например «орёл» или «красный». */
  label: string;
  /** Вероятность этого исхода на данном шаге. */
  probability: Fraction;
  /** Узел, в который ведёт ребро. */
  child: TreeNode;
}

export interface TreeNode {
  /** Исходящие рёбра; лист дерева — узел без рёбер. */
  edges?: readonly TreeEdge[];
}

export interface TreeOutcome {
  /** Подписи рёбер вдоль пути от корня к листу. */
  steps: readonly string[];
  /** Вероятность пути — произведение вероятностей рёбер. */
  probability: Fraction;
}

interface BigFraction {
  numerator: bigint;
  denominator: bigint;
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

function normalizeBig(numerator: bigint, denominator: bigint): Fraction {
  if (denominator === 0n) {
    throw new RangeError('Знаменатель дроби не может быть равен нулю');
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
    numerator: toSafeNumber(reducedNumerator, 'Числитель дроби'),
    denominator: toSafeNumber(reducedDenominator, 'Знаменатель дроби'),
  };
}

function toBig(value: Fraction, label: string): BigFraction {
  assertSafeInteger(value.numerator, `Числитель (${label})`);
  assertSafeInteger(value.denominator, `Знаменатель (${label})`);
  if (value.denominator === 0) {
    throw new RangeError('Знаменатель дроби не может быть равен нулю');
  }
  return { numerator: BigInt(value.numerator), denominator: BigInt(value.denominator) };
}

/** Строит несократимую дробь; знак переносится к числителю. */
export function fraction(numerator: number, denominator: number): Fraction {
  assertSafeInteger(numerator, 'Числитель');
  assertSafeInteger(denominator, 'Знаменатель');
  return normalizeBig(BigInt(numerator), BigInt(denominator));
}

/** Точно переводит конечную десятичную запись числа в дробь. */
export function decimalToFraction(value: number): Fraction {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new TypeError('Значение должно быть конечным числом в безопасном диапазоне');
  }
  if (value === 0) return { numerator: 0, denominator: 1 };

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

  return normalizeBig(numerator, denominator);
}

export function addFractions(left: Fraction, right: Fraction): Fraction {
  const a = toBig(left, 'первое слагаемое');
  const b = toBig(right, 'второе слагаемое');
  return normalizeBig(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

export function subtractFractions(left: Fraction, right: Fraction): Fraction {
  const a = toBig(left, 'уменьшаемое');
  const b = toBig(right, 'вычитаемое');
  return normalizeBig(
    a.numerator * b.denominator - b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

export function multiplyFractions(left: Fraction, right: Fraction): Fraction {
  const a = toBig(left, 'первый множитель');
  const b = toBig(right, 'второй множитель');
  return normalizeBig(a.numerator * b.numerator, a.denominator * b.denominator);
}

export function compareFractions(left: Fraction, right: Fraction): -1 | 0 | 1 {
  const a = toBig(left, 'левая дробь');
  const b = toBig(right, 'правая дробь');
  const sign = b.denominator < 0n !== a.denominator < 0n ? -1n : 1n;
  const difference = sign * (a.numerator * b.denominator - b.numerator * a.denominator);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function fractionToNumber(value: Fraction): number {
  const exact = toBig(value, 'дробь');
  return Number(exact.numerator) / Number(exact.denominator);
}

/** Записывает дробь строкой: «3/8», «2», «−1/4». */
export function formatFraction(value: Fraction): string {
  const normalized = fraction(value.numerator, value.denominator);
  const sign = normalized.numerator < 0 ? '−' : '';
  const numerator = Math.abs(normalized.numerator);
  if (normalized.denominator === 1) return `${sign}${numerator}`;
  return `${sign}${numerator}/${normalized.denominator}`;
}

/** Проверяет, что дробь лежит между 0 и 1 включительно. */
export function isProbability(value: Fraction): boolean {
  const normalized = fraction(value.numerator, value.denominator);
  return normalized.numerator >= 0 && normalized.numerator <= normalized.denominator;
}

function assertProbability(value: Fraction, label: string): Fraction {
  const normalized = fraction(value.numerator, value.denominator);
  if (!isProbability(normalized)) {
    throw new RangeError(`${label} должна лежать между 0 и 1`);
  }
  return normalized;
}

/**
 * Классическое определение: P(A) = m / n при n равновозможных исходах,
 * из которых m благоприятствуют событию A.
 */
export function classicalProbability(favorable: number, total: number): Fraction {
  assertSafeInteger(favorable, 'Число благоприятных исходов');
  assertSafeInteger(total, 'Число всех исходов');
  if (total <= 0) {
    throw new RangeError('Число всех исходов должно быть положительным');
  }
  if (favorable < 0 || favorable > total) {
    throw new RangeError('Число благоприятных исходов должно быть от 0 до числа всех исходов');
  }
  return fraction(favorable, total);
}

/** Вероятность противоположного события: P(Ā) = 1 − P(A). */
export function complementProbability(probability: Fraction): Fraction {
  const p = assertProbability(probability, 'Вероятность события');
  return subtractFractions({ numerator: 1, denominator: 1 }, p);
}

/** Правило умножения: вероятность пути — произведение вероятностей рёбер. */
export function pathProbability(probabilities: readonly Fraction[]): Fraction {
  if (probabilities.length === 0) {
    throw new RangeError('Путь должен содержать хотя бы один шаг');
  }
  let product: Fraction = { numerator: 1, denominator: 1 };
  probabilities.forEach((probability, index) => {
    product = multiplyFractions(product, assertProbability(probability, `Вероятность шага №${index + 1}`));
  });
  return product;
}

function assertCompleteBranch(edges: readonly TreeEdge[], path: readonly string[]): void {
  let sum: Fraction = { numerator: 0, denominator: 1 };
  edges.forEach((edge, index) => {
    sum = addFractions(sum, assertProbability(edge.probability, `Вероятность ребра №${index + 1}`));
  });
  if (sum.numerator !== sum.denominator) {
    const place = path.length === 0 ? 'корне дерева' : `узле «${path.join(' → ')}»`;
    throw new RangeError(`Сумма вероятностей рёбер в ${place} должна равняться 1, а равна ${formatFraction(sum)}`);
  }
}

/**
 * Обходит дерево испытаний и возвращает все пути от корня к листьям
 * с их вероятностями. Проверяет, что в каждом узле ветвления сумма
 * вероятностей исходящих рёбер равна 1.
 */
export function enumerateOutcomes(root: TreeNode): TreeOutcome[] {
  const outcomes: TreeOutcome[] = [];

  const walk = (node: TreeNode, steps: readonly string[], probabilities: readonly Fraction[]): void => {
    const edges = node.edges ?? [];
    if (edges.length === 0) {
      if (steps.length === 0) {
        throw new RangeError('Дерево должно содержать хотя бы один шаг испытания');
      }
      outcomes.push({ steps, probability: pathProbability(probabilities) });
      return;
    }
    assertCompleteBranch(edges, steps);
    for (const edge of edges) {
      walk(edge.child, [...steps, edge.label], [...probabilities, edge.probability]);
    }
  };

  walk(root, [], []);
  return outcomes;
}

/** Сумма вероятностей всех перечисленных исходов; у полного дерева равна 1. */
export function totalProbability(outcomes: readonly TreeOutcome[]): Fraction {
  let sum: Fraction = { numerator: 0, denominator: 1 };
  for (const outcome of outcomes) {
    sum = addFractions(sum, assertProbability(outcome.probability, 'Вероятность исхода'));
  }
  return sum;
}

/** Правило сложения по листьям: событие — сумма вероятностей благоприятных путей. */
export function eventProbability(
  outcomes: readonly TreeOutcome[],
  isFavorable: (outcome: TreeOutcome) => boolean,
): Fraction {
  return totalProbability(outcomes.filter(isFavorable));
}

function toExactValues(values: readonly number[], label: string): BigFraction[] {
  if (values.length === 0) {
    throw new RangeError(`${label}: нужен хотя бы один элемент данных`);
  }
  return values.map((value) => {
    const exact = decimalToFraction(value);
    return { numerator: BigInt(exact.numerator), denominator: BigInt(exact.denominator) };
  });
}

/** Размах ряда: разность наибольшего и наименьшего значений. */
export function rangeOf(values: readonly number[]): Fraction {
  toExactValues(values, 'Размах');
  const smallest = values.reduce((left, right) => Math.min(left, right));
  const largest = values.reduce((left, right) => Math.max(left, right));
  return subtractFractions(decimalToFraction(largest), decimalToFraction(smallest));
}

/** Среднее арифметическое ряда — точной дробью. */
export function meanOf(values: readonly number[]): Fraction {
  const exactValues = toExactValues(values, 'Среднее');
  let numerator = 0n;
  let denominator = 1n;
  for (const value of exactValues) {
    numerator = numerator * value.denominator + value.numerator * denominator;
    denominator *= value.denominator;
  }
  return normalizeBig(numerator, denominator * BigInt(exactValues.length));
}

/** Отклонения каждого значения от среднего; их сумма всегда равна 0. */
export function deviationsFromMean(values: readonly number[]): Fraction[] {
  const mean = meanOf(values);
  return values.map((value) => subtractFractions(decimalToFraction(value), mean));
}

/** Дисперсия (среднее квадратов отклонений) — точной дробью. */
export function populationVariance(values: readonly number[]): Fraction {
  const deviations = deviationsFromMean(values);
  let sum: Fraction = { numerator: 0, denominator: 1 };
  for (const deviation of deviations) {
    sum = addFractions(sum, multiplyFractions(deviation, deviation));
  }
  const big = toBig(sum, 'сумма квадратов отклонений');
  return normalizeBig(big.numerator, big.denominator * BigInt(values.length));
}
