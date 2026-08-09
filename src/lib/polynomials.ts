/**
 * Ядро главы «Алгебраический язык»: многочлены одной переменной.
 *
 * Многочлен хранится как массив коэффициентов по возрастанию степени:
 * индекс элемента равен степени члена. Например, [ -3, 0, 2 ] — это 2x² − 3.
 * Нулевой многочлен — пустой массив.
 */

export type Polynomial = readonly number[];

export interface PartialProduct {
  /** Степень члена первого многочлена. */
  firstDegree: number;
  /** Степень члена второго многочлена. */
  secondDegree: number;
  /** Коэффициент произведения двух членов. */
  coefficient: number;
  /** Степень произведения: сумма степеней сомножителей. */
  degree: number;
}

export interface BinomialSquareParts {
  /** a² — квадрат первого выражения. */
  firstSquare: number;
  /** ±2ab — удвоенное произведение с учётом знака формулы. */
  doubleProduct: number;
  /** b² — квадрат второго выражения. */
  secondSquare: number;
  /** (a ± b)² — значение квадрата двучлена. */
  total: number;
}

export interface DifferenceOfSquaresParts {
  /** a + b. */
  sum: number;
  /** a − b. */
  difference: number;
  /** (a + b)(a − b). */
  product: number;
  /** a² − b². */
  squareDifference: number;
}

/** Максимальная длина массива коэффициентов: степени 0…8 достаточно для школьных задач. */
export const MAX_POLYNOMIAL_LENGTH = 9;

/** Ограничение на модуль коэффициента, защищающее от потери точности. */
export const MAX_COEFFICIENT = 1_000_000;

const SUPERSCRIPTS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'] as const;
const MINUS = '−';

function assertCoefficient(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} должен быть конечным числом`);
  }
  if (Math.abs(value) > MAX_COEFFICIENT) {
    throw new RangeError(`${label} по модулю не может превышать ${MAX_COEFFICIENT}`);
  }
}

function assertPolynomialInput(coefficients: readonly number[], label: string): void {
  if (coefficients.length > MAX_POLYNOMIAL_LENGTH) {
    throw new RangeError(`${label}: поддерживаются степени не выше ${MAX_POLYNOMIAL_LENGTH - 1}`);
  }
  coefficients.forEach((coefficient, degree) => {
    assertCoefficient(coefficient, `${label}: коэффициент при степени ${degree}`);
  });
}

function assertExponent(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= MAX_POLYNOMIAL_LENGTH) {
    throw new RangeError(`${label} должен быть целым числом от 0 до ${MAX_POLYNOMIAL_LENGTH - 1}`);
  }
}

/**
 * Приводит массив коэффициентов к каноническому виду: убирает старшие нули
 * (в том числе −0) и проверяет допустимость значений.
 */
export function normalizePolynomial(coefficients: readonly number[], label = 'Многочлен'): Polynomial {
  assertPolynomialInput(coefficients, label);
  const cleaned = coefficients.map((coefficient) => (coefficient === 0 ? 0 : coefficient));
  let lastNonZero = -1;
  for (let index = cleaned.length - 1; index >= 0; index -= 1) {
    if (cleaned[index] !== 0) {
      lastNonZero = index;
      break;
    }
  }
  return cleaned.slice(0, lastNonZero + 1);
}

/** Степень многочлена; у нулевого многочлена степень не определена — возвращается null. */
export function polynomialDegree(coefficients: Polynomial): number | null {
  const normalized = normalizePolynomial(coefficients);
  return normalized.length === 0 ? null : normalized.length - 1;
}

/** Проверяет, является ли многочлен нулевым. */
export function isZeroPolynomial(coefficients: Polynomial): boolean {
  return normalizePolynomial(coefficients).length === 0;
}

/** Складывает многочлены почленно: подобные члены — это члены одной степени. */
export function addPolynomials(first: Polynomial, second: Polynomial): Polynomial {
  assertPolynomialInput(first, 'Первый многочлен');
  assertPolynomialInput(second, 'Второй многочлен');
  const length = Math.max(first.length, second.length);
  const sum = Array.from({ length }, (_, degree) => (first[degree] ?? 0) + (second[degree] ?? 0));
  return normalizePolynomial(sum, 'Сумма');
}

/** Умножает каждый коэффициент на число. */
export function scalePolynomial(coefficients: Polynomial, factor: number): Polynomial {
  assertPolynomialInput(coefficients, 'Многочлен');
  assertCoefficient(factor, 'Множитель');
  return normalizePolynomial(coefficients.map((coefficient) => coefficient * factor), 'Произведение');
}

/** Вычитание: прибавление противоположного многочлена. */
export function subtractPolynomials(first: Polynomial, second: Polynomial): Polynomial {
  return addPolynomials(first, scalePolynomial(second, -1));
}

/**
 * Перечисляет произведения «каждый член на каждый» — ячейки таблицы умножения
 * многочленов. Нулевые члены сомножителей пропускаются.
 */
export function partialProducts(first: Polynomial, second: Polynomial): PartialProduct[] {
  const left = normalizePolynomial(first, 'Первый многочлен');
  const right = normalizePolynomial(second, 'Второй многочлен');
  const products: PartialProduct[] = [];
  left.forEach((firstCoefficient, firstDegree) => {
    if (firstCoefficient === 0) return;
    right.forEach((secondCoefficient, secondDegree) => {
      if (secondCoefficient === 0) return;
      products.push({
        firstDegree,
        secondDegree,
        coefficient: firstCoefficient * secondCoefficient,
        degree: firstDegree + secondDegree,
      });
    });
  });
  return products;
}

/** Умножает многочлены: суммирует произведения «каждый член на каждый». */
export function multiplyPolynomials(first: Polynomial, second: Polynomial): Polynomial {
  const left = normalizePolynomial(first, 'Первый многочлен');
  const right = normalizePolynomial(second, 'Второй многочлен');
  if (left.length === 0 || right.length === 0) return [];
  const result = new Array<number>(left.length + right.length - 1).fill(0);
  for (const product of partialProducts(left, right)) {
    result[product.degree] += product.coefficient;
  }
  return normalizePolynomial(result, 'Произведение');
}

/** Значение многочлена в точке по схеме Горнера. */
export function evaluatePolynomial(coefficients: Polynomial, x: number): number {
  assertPolynomialInput(coefficients, 'Многочлен');
  assertCoefficient(x, 'Значение переменной');
  let value = 0;
  for (let degree = coefficients.length - 1; degree >= 0; degree -= 1) {
    value = value * x + (coefficients[degree] ?? 0);
  }
  return value;
}

function formatNumber(value: number): string {
  const text = String(Math.abs(value)).replace('.', ',');
  return value < 0 ? `${MINUS}${text}` : text;
}

/** Записывает степень надстрочными цифрами: 2 → «²», 12 → «¹²». */
export function formatExponent(exponent: number): string {
  assertExponent(exponent, 'Показатель степени');
  return String(exponent)
    .split('')
    .map((digit) => SUPERSCRIPTS[Number(digit)] ?? digit)
    .join('');
}

/**
 * Записывает одночлен cxⁿ в стандартном виде: «5», «−x», «3x²».
 * Коэффициенты 1 и −1 при степени ≥ 1 не показываются числом.
 */
export function formatMonomial(coefficient: number, degree: number, variable = 'x'): string {
  assertCoefficient(coefficient, 'Коэффициент');
  assertExponent(degree, 'Степень');
  if (coefficient === 0) return '0';
  if (degree === 0) return formatNumber(coefficient);
  const power = degree === 1 ? variable : `${variable}${formatExponent(degree)}`;
  if (coefficient === 1) return power;
  if (coefficient === -1) return `${MINUS}${power}`;
  return `${formatNumber(coefficient)}${power}`;
}

/**
 * Записывает многочлен в стандартном виде по убыванию степеней:
 * [ -3, 0, 2 ] → «2x² − 3». Нулевой многочлен → «0».
 */
export function formatPolynomial(coefficients: Polynomial, variable = 'x'): string {
  const normalized = normalizePolynomial(coefficients);
  if (normalized.length === 0) return '0';
  const parts: string[] = [];
  for (let degree = normalized.length - 1; degree >= 0; degree -= 1) {
    const coefficient = normalized[degree] ?? 0;
    if (coefficient === 0) continue;
    const monomial = formatMonomial(Math.abs(coefficient), degree, variable);
    if (parts.length === 0) {
      parts.push(coefficient < 0 ? `${MINUS}${monomial}` : monomial);
    } else {
      parts.push(`${coefficient < 0 ? MINUS : '+'} ${monomial}`);
    }
  }
  return parts.join(' ');
}

function assertFsuInput(a: number, b: number): void {
  assertCoefficient(a, 'Первое число');
  assertCoefficient(b, 'Второе число');
}

/** Числовые части формулы (a + b)² = a² + 2ab + b². */
export function expandSumSquare(a: number, b: number): BinomialSquareParts {
  assertFsuInput(a, b);
  return {
    firstSquare: a * a,
    doubleProduct: 2 * a * b,
    secondSquare: b * b,
    total: (a + b) * (a + b),
  };
}

/** Числовые части формулы (a − b)² = a² − 2ab + b². */
export function expandDifferenceSquare(a: number, b: number): BinomialSquareParts {
  assertFsuInput(a, b);
  return {
    firstSquare: a * a,
    doubleProduct: -2 * a * b,
    secondSquare: b * b,
    total: (a - b) * (a - b),
  };
}

/** Числовые части формулы a² − b² = (a + b)(a − b). */
export function expandDifferenceOfSquares(a: number, b: number): DifferenceOfSquaresParts {
  assertFsuInput(a, b);
  return {
    sum: a + b,
    difference: a - b,
    product: (a + b) * (a - b),
    squareDifference: a * a - b * b,
  };
}
