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

/** Действие над двумя многочленами, которое показывает лаборатория. */
export type PolynomialOperation = 'add' | 'subtract' | 'multiply';

/** Строка «столбика» сложения или вычитания: одна степень — одна строка. */
export interface DegreeRow {
  degree: number;
  first: number;
  second: number;
  result: number;
}

/** Строка таблицы умножения: все произведения, дающие члены одной степени. */
export interface ProductRow {
  degree: number;
  parts: PartialProduct[];
  coefficient: number;
}

/** Одночлен-множитель, вынесенный за скобки. */
export interface MonomialFactor {
  coefficient: number;
  degree: number;
}

/** Результат вынесения общего одночлена: многочлен равен factor · quotient. */
export interface MonomialFactorization {
  factor: MonomialFactor;
  quotient: Polynomial;
}

/**
 * Роль прямоугольника в площадной модели формулы сокращённого умножения.
 * Знак sign показывает, добавляется площадь к итогу или вычитается из него.
 */
export type AreaTileKind = 'first-square' | 'product' | 'second-square' | 'result' | 'removed';

/** Прямоугольник площадной модели в «математических» координатах: ось y направлена вниз. */
export interface AreaTile {
  id: string;
  kind: AreaTileKind;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Буквенная запись площади: «a²», «ab», «b(a − b)». */
  label: string;
  /** Числовое значение площади для выбранных a и b. */
  area: number;
  /** Знак, с которым площадь входит в записанное тождество. */
  sign: 1 | -1;
}

/** Площадная модель квадрата двучлена: знаковая сумма плиток равна площади ответа. */
export interface BinomialSquareLayout {
  /** Сторона большого квадрата модели. */
  side: number;
  tiles: AreaTile[];
  /** Область-ответ внутри модели. */
  result: AreaTile;
}

/** Две раскладки одной и той же фигуры: разрез квадрата и собранный из кусков прямоугольник. */
export interface DifferenceOfSquaresLayout {
  /** Сторона исходного квадрата — это a. */
  side: number;
  /** Куски, оставшиеся после выреза; их знаковая сумма равна a² − b². */
  cut: AreaTile[];
  /** Вырезанный квадрат b²: в сумму оставшегося не входит, поэтому знак у него минус. */
  removed: AreaTile;
  /** Те же куски, сложенные в прямоугольник. */
  rearranged: AreaTile[];
  rectangleWidth: number;
  rectangleHeight: number;
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

/**
 * Тождественно ли равны два многочлена. Равенство многочленов — это совпадение
 * коэффициентов при каждой степени, а не совпадение значений в одной точке.
 */
export function polynomialsEqual(first: Polynomial, second: Polynomial): boolean {
  const left = normalizePolynomial(first, 'Первый многочлен');
  const right = normalizePolynomial(second, 'Второй многочлен');
  if (left.length !== right.length) return false;
  return left.every((coefficient, degree) => coefficient === right[degree]);
}

/** Выполняет над двумя многочленами выбранное действие. */
export function combinePolynomials(
  first: Polynomial,
  second: Polynomial,
  operation: PolynomialOperation,
): Polynomial {
  if (operation === 'add') return addPolynomials(first, second);
  if (operation === 'subtract') return subtractPolynomials(first, second);
  return multiplyPolynomials(first, second);
}

/**
 * Раскладка сложения или вычитания по степеням: в одной строке стоят
 * подобные члены обоих многочленов и член результата.
 */
export function degreeRows(
  first: Polynomial,
  second: Polynomial,
  operation: 'add' | 'subtract',
): DegreeRow[] {
  const left = normalizePolynomial(first, 'Первый многочлен');
  const right = normalizePolynomial(second, 'Второй многочлен');
  const result = combinePolynomials(left, right, operation);
  const length = Math.max(left.length, right.length, result.length);
  const rows: DegreeRow[] = [];
  for (let degree = length - 1; degree >= 0; degree -= 1) {
    rows.push({
      degree,
      first: left[degree] ?? 0,
      second: right[degree] ?? 0,
      result: result[degree] ?? 0,
    });
  }
  return rows;
}

/**
 * Группирует произведения «каждый член на каждый» по степени результата.
 * Именно внутри такой группы происходит приведение подобных членов.
 */
export function productRows(first: Polynomial, second: Polynomial): ProductRow[] {
  const products = partialProducts(first, second);
  const byDegree = new Map<number, PartialProduct[]>();
  for (const product of products) {
    const bucket = byDegree.get(product.degree);
    if (bucket) bucket.push(product);
    else byDegree.set(product.degree, [product]);
  }
  return [...byDegree.entries()]
    .sort(([left], [right]) => right - left)
    .map(([degree, parts]) => ({
      degree,
      parts,
      coefficient: parts.reduce((sum, part) => sum + part.coefficient, 0),
    }));
}

function integerGcd(first: number, second: number): number {
  let a = Math.abs(first);
  let b = Math.abs(second);
  while (b > 0) {
    const rest = a % b;
    a = b;
    b = rest;
  }
  return a;
}

/**
 * Наибольший общий одночленный множитель многочлена: НОД целых коэффициентов
 * и наименьшая встречающаяся степень. У нулевого многочлена его нет.
 * Если хотя бы один коэффициент дробный, числовая часть множителя равна 1.
 */
export function commonMonomialFactor(coefficients: Polynomial): MonomialFactor | null {
  const normalized = normalizePolynomial(coefficients, 'Многочлен');
  if (normalized.length === 0) return null;
  let lowestDegree = -1;
  let gcd = 0;
  let allIntegers = true;
  normalized.forEach((coefficient, degree) => {
    if (coefficient === 0) return;
    if (lowestDegree === -1) lowestDegree = degree;
    if (!Number.isInteger(coefficient)) allIntegers = false;
    gcd = integerGcd(gcd, coefficient);
  });
  return { coefficient: allIntegers ? gcd : 1, degree: lowestDegree };
}

/**
 * Выносит общий одночлен за скобки: возвращает множитель и оставшийся многочлен,
 * так что исходный многочлен равен их произведению.
 */
export function factorOutCommonMonomial(coefficients: Polynomial): MonomialFactorization | null {
  const normalized = normalizePolynomial(coefficients, 'Многочлен');
  const factor = commonMonomialFactor(normalized);
  if (!factor) return null;
  const quotient = normalized
    .slice(factor.degree)
    .map((coefficient) => coefficient / factor.coefficient);
  return { factor, quotient: normalizePolynomial(quotient, 'Второй множитель') };
}

function assertPositiveLength(value: number, label: string): void {
  assertCoefficient(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} должен быть положительным: у отрезка нет отрицательной длины`);
  }
}

function assertOrderedLengths(a: number, b: number): void {
  assertPositiveLength(a, 'Первый отрезок a');
  assertPositiveLength(b, 'Второй отрезок b');
  if (a <= b) {
    throw new RangeError('Для этой модели нужно a > b: иначе вычитаемый квадрат не помещается');
  }
}

/**
 * Разрезание квадрата со стороной a + b на четыре части: a², ab, ab, b².
 * Начало координат — верхний левый угол, ось y направлена вниз.
 */
export function sumSquareTiles(a: number, b: number): BinomialSquareLayout {
  assertPositiveLength(a, 'Первый отрезок a');
  assertPositiveLength(b, 'Второй отрезок b');
  const side = a + b;
  return {
    side,
    tiles: [
      { id: 'a2', kind: 'first-square', x: 0, y: 0, width: a, height: a, label: 'a²', area: a * a, sign: 1 },
      { id: 'ab-top', kind: 'product', x: a, y: 0, width: b, height: a, label: 'ab', area: a * b, sign: 1 },
      { id: 'ab-left', kind: 'product', x: 0, y: a, width: a, height: b, label: 'ab', area: a * b, sign: 1 },
      { id: 'b2', kind: 'second-square', x: a, y: a, width: b, height: b, label: 'b²', area: b * b, sign: 1 },
    ],
    result: { id: 'result', kind: 'result', x: 0, y: 0, width: side, height: side, label: '(a + b)²', area: side * side, sign: 1 },
  };
}

/**
 * Модель квадрата разности внутри квадрата со стороной a: два срезанных
 * прямоугольника a·b пересекаются по квадрату b², поэтому его возвращают обратно.
 * Знаковая сумма плиток равна площади оставшегося квадрата (a − b)².
 */
export function differenceSquareTiles(a: number, b: number): BinomialSquareLayout {
  assertOrderedLengths(a, b);
  const rest = a - b;
  return {
    side: a,
    tiles: [
      { id: 'a2', kind: 'first-square', x: 0, y: 0, width: a, height: a, label: 'a²', area: a * a, sign: 1 },
      { id: 'strip-right', kind: 'removed', x: rest, y: 0, width: b, height: a, label: 'ab', area: a * b, sign: -1 },
      { id: 'strip-bottom', kind: 'removed', x: 0, y: rest, width: a, height: b, label: 'ab', area: a * b, sign: -1 },
      { id: 'overlap', kind: 'second-square', x: rest, y: rest, width: b, height: b, label: 'b²', area: b * b, sign: 1 },
    ],
    result: { id: 'result', kind: 'result', x: 0, y: 0, width: rest, height: rest, label: '(a − b)²', area: rest * rest, sign: 1 },
  };
}

/**
 * Разность квадратов: из квадрата a² вырезают квадрат b², а два оставшихся
 * куска складывают в прямоугольник (a + b) на (a − b).
 */
export function differenceOfSquaresTiles(a: number, b: number): DifferenceOfSquaresLayout {
  assertOrderedLengths(a, b);
  const rest = a - b;
  return {
    side: a,
    cut: [
      { id: 'left', kind: 'result', x: 0, y: 0, width: rest, height: a, label: 'a(a − b)', area: a * rest, sign: 1 },
      { id: 'bottom', kind: 'second-square', x: rest, y: b, width: b, height: rest, label: 'b(a − b)', area: b * rest, sign: 1 },
    ],
    removed: { id: 'removed', kind: 'removed', x: rest, y: 0, width: b, height: b, label: 'b²', area: b * b, sign: -1 },
    rearranged: [
      { id: 'left', kind: 'result', x: 0, y: 0, width: a, height: rest, label: 'a(a − b)', area: a * rest, sign: 1 },
      { id: 'bottom', kind: 'second-square', x: a, y: 0, width: b, height: rest, label: 'b(a − b)', area: b * rest, sign: 1 },
    ],
    rectangleWidth: a + b,
    rectangleHeight: rest,
  };
}
