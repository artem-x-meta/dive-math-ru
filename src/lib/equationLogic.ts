/**
 * Вычислительное ядро главы «Уравнения и логика» (10 класс).
 *
 * Главная мысль главы: возведение в квадрат и снятие модуля — это переход к
 * уравнению-СЛЕДСТВИЮ. Корни следствия — только кандидаты; настоящие корни
 * получаются отбором по знаку. Поэтому ядро всегда возвращает две вещи сразу:
 *   1) полный список кандидатов с приговором и причиной;
 *   2) список корней исходного уравнения.
 *
 * Всё, что можно посчитать точно, считается точно: коэффициенты — целые,
 * значения частей — обыкновенные дроби (ExactRational). Числа с плавающей
 * точкой появляются только там, где нужны координаты рисунка или где корень
 * действительно иррационален.
 */

import {
  compareExact,
  isExactZero,
  parseExact,
  toExactNumber,
  type ExactRational,
} from './exactRational';
import {
  degreeOf,
  evaluatePolynomial,
  formatPolynomial,
  multiplyPolynomials,
  trimPolynomial,
  type Polynomial,
} from './algebraicFractions';
import {
  formatApproximate,
  formatRoot,
  formatRootList,
  normalizeRoots,
  solvePolynomialEquation,
  type PlotSegment,
  type RealRoot,
} from './systems';

export type { Polynomial } from './algebraicFractions';
export type { PlotSegment, RealRoot } from './systems';
export { formatRoot, formatRootList } from './systems';

const ZERO = parseExact(0);

/** Допуск для сравнения приближённых значений (только для иррациональных корней). */
const EPSILON = 1e-9;

// ───────────────────────────── Многочлены ───────────────────────────────────

function assertPoly(poly: Polynomial, label: string): void {
  if (!Array.isArray(poly) || poly.length === 0) {
    throw new TypeError(`${label} должен быть непустым массивом целых коэффициентов`);
  }
  for (const coefficient of poly) {
    if (!Number.isSafeInteger(coefficient)) {
      throw new TypeError(`Коэффициенты (${label.toLowerCase()}) должны быть безопасными целыми числами`);
    }
  }
}

/** Разность многочленов с целыми коэффициентами. */
export function subtractPolynomials(left: Polynomial, right: Polynomial): number[] {
  assertPoly(left, 'Уменьшаемое');
  assertPoly(right, 'Вычитаемое');
  const length = Math.max(left.length, right.length);
  const difference: number[] = [];
  for (let index = 0; index < length; index += 1) {
    const term = (left[index] ?? 0) - (right[index] ?? 0);
    if (!Number.isSafeInteger(term)) {
      throw new RangeError('Коэффициент разности выходит за диапазон безопасных целых чисел');
    }
    difference.push(term);
  }
  return trimPolynomial(difference);
}

/** Квадрат многочлена. */
export function squarePolynomial(poly: Polynomial): number[] {
  assertPoly(poly, 'Многочлен');
  return trimPolynomial(multiplyPolynomials(poly, poly));
}

/** Умножает многочлен на −1: уравнение P = 0 при этом не меняется. */
export function negatePolynomial(poly: Polynomial): number[] {
  assertPoly(poly, 'Многочлен');
  return trimPolynomial(poly.map((coefficient) => -coefficient));
}

/**
 * Приводит уравнение P(x) = 0 к привычному виду с положительным старшим
 * коэффициентом. Множество корней от этого не меняется.
 */
export function withPositiveLeading(poly: Polynomial): number[] {
  const trimmed = trimPolynomial(poly);
  const degree = degreeOf(trimmed);
  if (degree === -1) return trimmed;
  return (trimmed[degree] ?? 0) < 0 ? negatePolynomial(trimmed) : trimmed;
}

/** Значение многочлена в числовой точке (для координат рисунка). */
export function evaluateAt(poly: Polynomial, x: number): number {
  assertPoly(poly, 'Многочлен');
  if (!Number.isFinite(x)) throw new TypeError('Точка должна быть конечным числом');
  let accumulator = 0;
  for (let index = poly.length - 1; index >= 0; index -= 1) {
    accumulator = accumulator * x + (poly[index] ?? 0);
  }
  return accumulator;
}

/** Значение многочлена в корне: точное, если корень точный. */
export function valueAt(poly: Polynomial, root: RealRoot): RealRoot {
  if (root.exact !== null) {
    const exact = evaluatePolynomial(poly, root.exact);
    return Object.freeze({ exact, approx: toExactNumber(exact) });
  }
  return Object.freeze({ exact: null, approx: evaluateAt(poly, root.approx) });
}

/** Знак значения: точный там, где значение точное. */
export function signOfValue(value: RealRoot): -1 | 0 | 1 {
  if (value.exact !== null) {
    if (isExactZero(value.exact)) return 0;
    return compareExact(value.exact, ZERO) < 0 ? -1 : 1;
  }
  if (Math.abs(value.approx) < EPSILON) return 0;
  return value.approx < 0 ? -1 : 1;
}

// ───────────────────────────── Виды уравнений ───────────────────────────────

/** √(radicand) = right. */
export interface SqrtPolyEquation {
  readonly kind: 'sqrt-poly';
  readonly radicand: Polynomial;
  readonly right: Polynomial;
}

/** √(left) = √(right). */
export interface SqrtSqrtEquation {
  readonly kind: 'sqrt-sqrt';
  readonly left: Polynomial;
  readonly right: Polynomial;
}

/** |inner| = right. */
export interface AbsPolyEquation {
  readonly kind: 'abs-poly';
  readonly inner: Polynomial;
  readonly right: Polynomial;
}

/** |left| = |right|. */
export interface AbsAbsEquation {
  readonly kind: 'abs-abs';
  readonly left: Polynomial;
  readonly right: Polynomial;
}

export type EquationSpec = SqrtPolyEquation | SqrtSqrtEquation | AbsPolyEquation | AbsAbsEquation;

/** Приговор кандидату: корень либо посторонний корень с указанием причины. */
export type CandidateStatus = 'root' | 'right-negative' | 'radicand-negative';

export interface CandidateCheck {
  readonly root: RealRoot;
  readonly accepted: boolean;
  readonly status: CandidateStatus;
  /** Значение выражения под корнем или под модулем. */
  readonly innerValue: RealRoot;
  /** Значение правой части (для √ = √ — второго подкоренного выражения). */
  readonly rightValue: RealRoot;
  /** Численное значение левой части исходного уравнения; null — не определена. */
  readonly leftValue: number | null;
  readonly note: string;
}

export interface EquationSolution {
  readonly spec: EquationSpec;
  /** Уравнение-следствие: многочлен, приравненный к нулю. */
  readonly consequence: number[];
  /** Все корни следствия — кандидаты исходного уравнения. */
  readonly candidates: readonly CandidateCheck[];
  /** Корни исходного уравнения. */
  readonly roots: readonly RealRoot[];
  /** Кандидаты, не прошедшие отбор. */
  readonly extraneous: readonly RealRoot[];
  /** true, если найдены все корни уравнения-следствия. */
  readonly complete: boolean;
  /** true, если следствие обращается в тождество 0 = 0. */
  readonly identity: boolean;
  /** Условие отбора обычными словами. */
  readonly filter: string;
}

function partsOf(spec: EquationSpec): { inner: Polynomial; right: Polynomial } {
  switch (spec.kind) {
    case 'sqrt-poly':
      return { inner: spec.radicand, right: spec.right };
    case 'sqrt-sqrt':
      return { inner: spec.left, right: spec.right };
    case 'abs-poly':
      return { inner: spec.inner, right: spec.right };
    case 'abs-abs':
      return { inner: spec.left, right: spec.right };
  }
}

function assertSpec(spec: EquationSpec): void {
  const parts = partsOf(spec);
  assertPoly(parts.inner, 'Левая часть');
  assertPoly(parts.right, 'Правая часть');
}

/**
 * Многочлен уравнения-следствия, приравненного к нулю.
 *
 *   √A = B      →  A − B² = 0    (после возведения обеих частей в квадрат)
 *   √A = √B     →  A − B = 0
 *   |A| = B     →  A² − B² = 0
 *   |A| = |B|   →  A² − B² = 0
 */
export function consequencePolynomial(spec: EquationSpec): number[] {
  assertSpec(spec);
  switch (spec.kind) {
    case 'sqrt-poly':
      return withPositiveLeading(subtractPolynomials(spec.radicand, squarePolynomial(spec.right)));
    case 'sqrt-sqrt':
      return withPositiveLeading(subtractPolynomials(spec.left, spec.right));
    case 'abs-poly':
      return withPositiveLeading(subtractPolynomials(squarePolynomial(spec.inner), squarePolynomial(spec.right)));
    case 'abs-abs':
      return withPositiveLeading(subtractPolynomials(squarePolynomial(spec.left), squarePolynomial(spec.right)));
  }
}

/** Условие отбора кандидатов обычными словами. */
export function filterCondition(spec: EquationSpec): string {
  switch (spec.kind) {
    case 'sqrt-poly':
      return 'правая часть должна быть неотрицательной: арифметический корень отрицательным не бывает';
    case 'sqrt-sqrt':
      return 'подкоренное выражение должно быть неотрицательным: иначе левая и правая части просто не существуют';
    case 'abs-poly':
      return 'правая часть должна быть неотрицательной: модуль отрицательным не бывает';
    case 'abs-abs':
      return 'отбор не нужен: обе части неотрицательны при любом значении переменной';
  }
}

function leftValueOf(spec: EquationSpec, innerValue: RealRoot): number | null {
  if (spec.kind === 'abs-poly' || spec.kind === 'abs-abs') return Math.abs(innerValue.approx);
  return innerValue.approx < 0 ? null : Math.sqrt(innerValue.approx);
}

function checkCandidate(spec: EquationSpec, root: RealRoot): CandidateCheck {
  const parts = partsOf(spec);
  const innerValue = valueAt(parts.inner, root);
  const rightValue = valueAt(parts.right, root);
  const leftValue = leftValueOf(spec, innerValue);
  const innerText = formatRoot(innerValue, 3);
  const rightText = formatRoot(rightValue, 3);

  if (spec.kind === 'sqrt-sqrt' && signOfValue(innerValue) < 0) {
    return Object.freeze({
      root,
      accepted: false,
      status: 'radicand-negative' as const,
      innerValue,
      rightValue,
      leftValue,
      note: `Подкоренное выражение равно ${innerText} — это меньше нуля, корень не определён. Посторонний корень.`,
    });
  }

  if (spec.kind !== 'abs-abs' && signOfValue(rightValue) < 0) {
    const reason = spec.kind === 'abs-poly'
      ? 'а модуль отрицательным не бывает'
      : 'а арифметический квадратный корень отрицательным не бывает';
    return Object.freeze({
      root,
      accepted: false,
      status: 'right-negative' as const,
      innerValue,
      rightValue,
      leftValue,
      note: `Правая часть равна ${rightText} — это меньше нуля, ${reason}. Посторонний корень.`,
    });
  }

  const bothSides = leftValue === null ? '' : ` Обе части равны ${formatApproximate(leftValue, 3)}.`;
  return Object.freeze({
    root,
    accepted: true,
    status: 'root' as const,
    innerValue,
    rightValue,
    leftValue,
    note: `Отбор пройден: подкоренное выражение (или выражение под модулем) равно ${innerText}, правая часть — ${rightText}.${bothSides}`,
  });
}

/** Решает уравнение с корнем или модулем через уравнение-следствие и отбор. */
export function solveEquation(spec: EquationSpec): EquationSolution {
  assertSpec(spec);
  const consequence = consequencePolynomial(spec);
  const outcome = solvePolynomialEquation(consequence);
  const candidates = normalizeRoots(outcome.roots).map((root) => checkCandidate(spec, root));

  return Object.freeze({
    spec,
    consequence,
    candidates: Object.freeze(candidates),
    roots: Object.freeze(candidates.filter((item) => item.accepted).map((item) => item.root)),
    extraneous: Object.freeze(candidates.filter((item) => !item.accepted).map((item) => item.root)),
    complete: outcome.complete,
    identity: outcome.identity,
    filter: filterCondition(spec),
  });
}

// ───────────────────────── Модуль по определению: два случая ────────────────

export interface AbsoluteBranch {
  /** Условие ветви обычной записью: «x − 1 ≥ 0» или «x − 1 < 0». */
  readonly condition: string;
  /** Уравнение ветви, приведённое к виду «многочлен = 0». */
  readonly equation: number[];
  /** Корни ветви, удовлетворяющие её условию. */
  readonly roots: readonly RealRoot[];
  /** Корни ветви, нарушающие её условие. */
  readonly rejected: readonly RealRoot[];
  readonly nonNegative: boolean;
}

/**
 * Разбор |inner| = right по определению модуля.
 *
 *   inner ≥ 0:  inner − right = 0
 *   inner < 0:  inner + right = 0
 *
 * Корень ветви оставляют только тогда, когда он выполняет условие своей ветви.
 */
export function absoluteBranches(inner: Polynomial, right: Polynomial): readonly AbsoluteBranch[] {
  assertPoly(inner, 'Выражение под модулем');
  assertPoly(right, 'Правая часть');
  const innerText = formatPolynomial(inner);

  const build = (nonNegative: boolean): AbsoluteBranch => {
    const equation = withPositiveLeading(
      nonNegative
        ? subtractPolynomials(inner, right)
        : subtractPolynomials(negatePolynomial(inner), right),
    );
    const outcome = solvePolynomialEquation(equation);
    const accepted: RealRoot[] = [];
    const rejected: RealRoot[] = [];
    for (const root of outcome.roots) {
      const sign = signOfValue(valueAt(inner, root));
      const fits = nonNegative ? sign >= 0 : sign < 0;
      (fits ? accepted : rejected).push(root);
    }
    return Object.freeze({
      condition: `${innerText} ${nonNegative ? '≥' : '<'} 0`,
      equation,
      roots: Object.freeze(accepted),
      rejected: Object.freeze(rejected),
      nonNegative,
    });
  };

  return Object.freeze([build(true), build(false)]);
}

// ───────────────────────── Преобразования и равносильность ──────────────────

export type TransformKind =
  | 'add-both'
  | 'multiply-nonzero'
  | 'multiply-variable'
  | 'divide-variable'
  | 'square-both'
  | 'cube-both';

export type TransformEffect = 'equivalent' | 'adds-roots' | 'loses-roots';

export interface TransformInfo {
  readonly kind: TransformKind;
  readonly title: string;
  readonly effect: TransformEffect;
  readonly note: string;
}

/** Шесть школьных преобразований и их честный статус. */
export const TRANSFORMS: readonly TransformInfo[] = Object.freeze([
  Object.freeze({
    kind: 'add-both' as const,
    title: 'Прибавить к обеим частям одно и то же число',
    effect: 'equivalent' as const,
    note: 'Обратное действие — вычесть то же число, поэтому множество корней не меняется.',
  }),
  Object.freeze({
    kind: 'multiply-nonzero' as const,
    title: 'Умножить обе части на одно и то же число, не равное нулю',
    effect: 'equivalent' as const,
    note: 'Обратное действие — деление на это же число. Ноль запрещён именно потому, что делить на него нельзя.',
  }),
  Object.freeze({
    kind: 'multiply-variable' as const,
    title: 'Умножить обе части на выражение с переменной',
    effect: 'adds-roots' as const,
    note: 'Там, где множитель обращается в ноль, равенство становится верным «даром». Появляются посторонние корни.',
  }),
  Object.freeze({
    kind: 'divide-variable' as const,
    title: 'Разделить обе части на выражение с переменной',
    effect: 'loses-roots' as const,
    note: 'Значения, при которых делитель равен нулю, выпадают из рассмотрения вместе со своими корнями.',
  }),
  Object.freeze({
    kind: 'square-both' as const,
    title: 'Возвести обе части в квадрат',
    effect: 'adds-roots' as const,
    note: 'Квадрат склеивает противоположные числа: из a = b следует a² = b², но из a² = b² следует лишь a = ±b.',
  }),
  Object.freeze({
    kind: 'cube-both' as const,
    title: 'Возвести обе части в куб',
    effect: 'equivalent' as const,
    note: 'Куб сохраняет знак и строго возрастает, поэтому a³ = b³ равносильно a = b.',
  }),
]);

export function transformInfo(kind: TransformKind): TransformInfo {
  const found = TRANSFORMS.find((item) => item.kind === kind);
  if (found === undefined) throw new RangeError(`Неизвестное преобразование: ${String(kind)}`);
  return found;
}

// ───────────────────────── Оформление записей ───────────────────────────────

function wrap(poly: Polynomial): string {
  const text = formatPolynomial(poly);
  return degreeOf(poly) <= 0 ? text : `(${text})`;
}

/** Исходное уравнение обычной строкой. */
export function formatEquation(spec: EquationSpec): string {
  assertSpec(spec);
  switch (spec.kind) {
    case 'sqrt-poly':
      return `√(${formatPolynomial(spec.radicand)}) = ${formatPolynomial(spec.right)}`;
    case 'sqrt-sqrt':
      return `√(${formatPolynomial(spec.left)}) = √(${formatPolynomial(spec.right)})`;
    case 'abs-poly':
      return `|${formatPolynomial(spec.inner)}| = ${formatPolynomial(spec.right)}`;
    case 'abs-abs':
      return `|${formatPolynomial(spec.left)}| = |${formatPolynomial(spec.right)}|`;
  }
}

/** Что получается сразу после возведения обеих частей в квадрат. */
export function formatSquaredEquation(spec: EquationSpec): string {
  assertSpec(spec);
  switch (spec.kind) {
    case 'sqrt-poly':
      return `${formatPolynomial(spec.radicand)} = ${wrap(spec.right)}²`;
    case 'sqrt-sqrt':
      return `${formatPolynomial(spec.left)} = ${formatPolynomial(spec.right)}`;
    case 'abs-poly':
      return `${wrap(spec.inner)}² = ${wrap(spec.right)}²`;
    case 'abs-abs':
      return `${wrap(spec.left)}² = ${wrap(spec.right)}²`;
  }
}

/** Уравнение-следствие после приведения подобных. */
export function formatConsequence(spec: EquationSpec): string {
  return `${formatPolynomial(consequencePolynomial(spec))} = 0`;
}

/** Короткий текст ответа: корни либо «корней нет». */
export function formatAnswer(solution: EquationSolution, digits = 2): string {
  return formatRootList(solution.roots, digits);
}

// ───────────────────────── Примеры для лабораторий ──────────────────────────

export interface LogicPreset {
  readonly id: string;
  readonly title: string;
  readonly spec: EquationSpec;
  /** Полуразмер квадратного окна рисунка. */
  readonly extent: number;
  readonly note: string;
}

export const RADICAL_PRESETS: readonly LogicPreset[] = Object.freeze([
  Object.freeze({
    id: 'sqrt-const',
    title: '√(x − 1) = 3',
    spec: { kind: 'sqrt-poly' as const, radicand: [-1, 1], right: [3] },
    extent: 12,
    note: 'Правая часть — положительное число, поэтому отбор пройдёт кто угодно: посторонних корней здесь не бывает.',
  }),
  Object.freeze({
    id: 'sqrt-linear-a',
    title: '√(x + 3) = x + 1',
    spec: { kind: 'sqrt-poly' as const, radicand: [3, 1], right: [1, 1] },
    extent: 6,
    note: 'Кандидатов двое, но при x = −2 правая часть отрицательна: прямая ушла под ось, а корень туда не опускается.',
  }),
  Object.freeze({
    id: 'sqrt-linear-b',
    title: '√(2x + 3) = x',
    spec: { kind: 'sqrt-poly' as const, radicand: [3, 2], right: [0, 1] },
    extent: 10,
    note: 'Кандидат x = −1 обслуживает не это уравнение, а его «зеркало» √(2x + 3) = −x.',
  }),
  Object.freeze({
    id: 'sqrt-linear-c',
    title: '√(x + 7) = x − 5',
    spec: { kind: 'sqrt-poly' as const, radicand: [7, 1], right: [-5, 1] },
    extent: 18,
    note: 'Здесь подкоренное выражение при x = 2 вполне определено — мешает именно знак правой части.',
  }),
  Object.freeze({
    id: 'sqrt-decreasing',
    title: '√(x + 5) = 1 − x',
    spec: { kind: 'sqrt-poly' as const, radicand: [5, 1], right: [1, -1] },
    extent: 10,
    note: 'Правая часть убывает, поэтому отбор снимает больший кандидат. Правила «лишний всегда меньший» не существует.',
  }),
  Object.freeze({
    id: 'sqrt-quad',
    title: '√(x² − 3x) = 2',
    spec: { kind: 'sqrt-poly' as const, radicand: [0, -3, 1], right: [2] },
    extent: 6,
    note: 'Два кандидата и два корня: постоянная правая часть неотрицательна, отбор никого не отсеивает.',
  }),
  Object.freeze({
    id: 'sqrt-sqrt',
    title: '√(x² − 4) = √(3x)',
    spec: { kind: 'sqrt-sqrt' as const, left: [-4, 0, 1], right: [0, 3] },
    extent: 14,
    note: 'Приравняли подкоренные выражения — и получили кандидата, при котором обеих частей просто не существует.',
  }),
]);

export const MODULUS_PRESETS: readonly LogicPreset[] = Object.freeze([
  Object.freeze({
    id: 'abs-const',
    title: '|x − 2| = 3',
    spec: { kind: 'abs-poly' as const, inner: [-2, 1], right: [3] },
    extent: 8,
    note: 'Расстояние от x до 2 равно 3. Таких точек ровно две, и обе проходят отбор.',
  }),
  Object.freeze({
    id: 'abs-linear',
    title: '|x − 1| = 2x − 4',
    spec: { kind: 'abs-poly' as const, inner: [-1, 1], right: [-4, 2] },
    extent: 8,
    note: 'Прямая справа пересекает ось: слева от x = 2 она отрицательна, и кандидат оттуда не выживает.',
  }),
  Object.freeze({
    id: 'abs-linear-both',
    title: '|2x + 1| = x + 4',
    spec: { kind: 'abs-poly' as const, inner: [1, 2], right: [4, 1] },
    extent: 8,
    note: 'Оба кандидата лежат правее точки x = −4, где правая часть уже неотрицательна. Посторонних нет.',
  }),
  Object.freeze({
    id: 'abs-empty',
    title: '|x − 3| = x − 5',
    spec: { kind: 'abs-poly' as const, inner: [-3, 1], right: [-5, 1] },
    extent: 10,
    note: 'Галочка модуля целиком лежит выше прямой: общих точек нет, и единственный кандидат оказывается посторонним.',
  }),
  Object.freeze({
    id: 'abs-quad',
    title: '|x² − 5| = 4',
    spec: { kind: 'abs-poly' as const, inner: [-5, 0, 1], right: [4] },
    extent: 6,
    note: 'Четыре корня: парабола пересекает уровень 4 и уровень −4, а модуль поднимает вторую пару наверх.',
  }),
  Object.freeze({
    id: 'abs-abs',
    title: '|x + 2| = |2x − 1|',
    spec: { kind: 'abs-abs' as const, left: [2, 1], right: [-1, 2] },
    extent: 6,
    note: 'Обе части неотрицательны, поэтому квадрат ничего не портит: оба кандидата — настоящие корни.',
  }),
]);

export function getLogicPreset(id: string): LogicPreset {
  const found = [...RADICAL_PRESETS, ...MODULUS_PRESETS].find((preset) => preset.id === id);
  if (found === undefined) throw new RangeError(`Неизвестный пример: ${id}`);
  return found;
}

// ───────────────────────── Геометрия рисунка ────────────────────────────────

interface PlotPoint {
  readonly x: number;
  readonly y: number;
}

/** Отсечение отрезка по квадрату [−extent; extent]² алгоритмом Лианга — Барски. */
function clipSegment(x1: number, y1: number, x2: number, y2: number, extent: number): PlotSegment | null {
  if (![x1, y1, x2, y2].every((value) => Number.isFinite(value))) return null;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 + extent, extent - x1, y1 + extent, extent - y1];
  let t0 = 0;
  let t1 = 1;

  for (let index = 0; index < 4; index += 1) {
    const pi = p[index]!;
    const qi = q[index]!;
    if (pi === 0) {
      if (qi < 0) return null;
      continue;
    }
    const ratio = qi / pi;
    if (pi < 0) {
      if (ratio > t1) return null;
      if (ratio > t0) t0 = ratio;
    } else {
      if (ratio < t0) return null;
      if (ratio < t1) t1 = ratio;
    }
  }

  return Object.freeze({
    x1: x1 + t0 * dx,
    y1: y1 + t0 * dy,
    x2: x1 + t1 * dx,
    y2: y1 + t1 * dy,
  });
}

function clipRun(points: readonly PlotPoint[], extent: number): PlotSegment[] {
  const segments: PlotSegment[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const clipped = clipSegment(from.x, from.y, to.x, to.y, extent);
    if (clipped !== null) segments.push(clipped);
  }
  return segments;
}

function assertWindow(extent: number, samples: number): void {
  if (!(extent > 0) || !Number.isFinite(extent)) {
    throw new RangeError('Полуразмер окна должен быть положительным числом');
  }
  if (!Number.isInteger(samples) || samples < 8 || samples > 2001) {
    throw new RangeError('Число узлов должно быть целым от 8 до 2001');
  }
}

/**
 * Ломаная по значениям функции. Там, где функция не определена, линия
 * разрывается, а граница области определения уточняется делением пополам —
 * поэтому конец графика корня стоит ровно на своём месте.
 */
function sampleRuns(
  value: (x: number) => number | null,
  extent: number,
  samples: number,
): PlotPoint[][] {
  const runs: PlotPoint[][] = [];
  let current: PlotPoint[] = [];
  let previousX: number | null = null;
  let previousDefined = false;

  const boundaryBetween = (definedX: number, undefinedX: number): number => {
    let inside = definedX;
    let outside = undefinedX;
    for (let step = 0; step < 60; step += 1) {
      const middle = (inside + outside) / 2;
      if (value(middle) === null) outside = middle;
      else inside = middle;
    }
    return inside;
  };

  for (let index = 0; index < samples; index += 1) {
    const x = -extent + (2 * extent * index) / (samples - 1);
    const y = value(x);

    if (y === null) {
      if (previousDefined && previousX !== null) {
        const edge = boundaryBetween(previousX, x);
        const edgeValue = value(edge);
        if (edgeValue !== null && Number.isFinite(edgeValue)) current.push({ x: edge, y: edgeValue });
      }
      if (current.length > 1) runs.push(current);
      current = [];
      previousDefined = false;
      previousX = x;
      continue;
    }

    if (!previousDefined && previousX !== null) {
      const edge = boundaryBetween(x, previousX);
      const edgeValue = value(edge);
      if (edgeValue !== null && Number.isFinite(edgeValue)) current.push({ x: edge, y: edgeValue });
    }
    if (Number.isFinite(y)) current.push({ x, y });
    previousDefined = true;
    previousX = x;
  }

  if (current.length > 1) runs.push(current);
  return runs;
}

function segmentsFrom(
  value: (x: number) => number | null,
  extent: number,
  samples: number,
): PlotSegment[] {
  assertWindow(extent, samples);
  return sampleRuns(value, extent, samples).flatMap((run) => clipRun(run, extent));
}

/** График y = P(x). Все точки вычислены по формуле, поэтому рисунок честный. */
export function polynomialCurve(poly: Polynomial, extent: number, samples = 321): PlotSegment[] {
  assertPoly(poly, 'Многочлен');
  if (degreeOf(poly) <= 1) {
    assertWindow(extent, samples);
    const segment = clipSegment(-extent, evaluateAt(poly, -extent), extent, evaluateAt(poly, extent), extent);
    return segment === null ? [] : [segment];
  }
  return segmentsFrom((x) => evaluateAt(poly, x), extent, samples);
}

/** График y = √(P(x)); вне области определения линии просто нет. */
export function squareRootCurve(radicand: Polynomial, extent: number, samples = 321): PlotSegment[] {
  assertPoly(radicand, 'Подкоренное выражение');
  return segmentsFrom((x) => {
    const inside = evaluateAt(radicand, x);
    return inside < 0 ? null : Math.sqrt(inside);
  }, extent, samples);
}

/** График y = |P(x)|. */
export function absoluteCurve(inner: Polynomial, extent: number, samples = 321): PlotSegment[] {
  assertPoly(inner, 'Выражение под модулем');
  return segmentsFrom((x) => Math.abs(evaluateAt(inner, x)), extent, samples);
}

/** Отрезки области определения √(P(x)) внутри окна: где подкоренное ≥ 0. */
export function domainIntervals(radicand: Polynomial, extent: number, samples = 641): { from: number; to: number }[] {
  assertPoly(radicand, 'Подкоренное выражение');
  assertWindow(extent, samples);
  return sampleRuns((x) => (evaluateAt(radicand, x) < 0 ? null : 0), extent, samples)
    .map((run) => ({ from: run[0]!.x, to: run[run.length - 1]!.x }));
}
