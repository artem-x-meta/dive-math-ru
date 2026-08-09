/**
 * Вычислительное ядро главы «Квадратичная функция» (9 класс).
 *
 * Ядро надстроено над `src/lib/quadratics.ts` и ничего оттуда не повторяет:
 * дискриминант, корни, вершина, выделение полного квадрата и обрезка кривой по
 * окну берутся готовыми. Здесь добавлено только то, что относится к функции, а
 * не к уравнению:
 *
 *   1) направление ветвей, ось симметрии, монотонность, область значений;
 *   2) вершинная форма y = a(x − m)² + n и цепочка преобразований графика;
 *   3) работа с дробным старшим коэффициентом через целочисленный масштаб;
 *   4) решение квадратных неравенств по расположению параболы.
 *
 * Всё, что можно посчитать точно, считается дробями; десятичные приближения
 * появляются только там, где корень иррационален, и всегда помечаются знаком ≈.
 */

import {
  completeSquare,
  describeRoot,
  discriminant,
  evaluateQuadratic,
  formatRational,
  normalizeRational,
  parabolaSegments,
  solveQuadratic,
  vertex,
  type PlotBox,
  type Point,
  type QuadraticRoot,
  type Rational,
  type RootCount,
} from './quadratics';

// ───────────────────────────── Вспомогательное ───────────────────────────────

/** Направление ветвей параболы. */
export type BranchDirection = 'up' | 'down';

/** Наибольшее или наименьшее значение достигается в вершине. */
export type Extremum = 'min' | 'max';

function assertLeading(a: number): void {
  if (!Number.isSafeInteger(a)) {
    throw new TypeError('Старший коэффициент a должен быть безопасным целым числом');
  }
  if (a === 0) {
    throw new RangeError('Это не квадратичная функция: старший коэффициент a не может быть равен нулю');
  }
}

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} должно быть безопасным целым числом`);
  }
}

/** Числовое значение точной дроби — только для координат рисунка. */
export function rationalValue(value: Rational): number {
  if (value.denominator === 0) {
    throw new RangeError('Знаменатель дроби не может быть равен нулю');
  }
  return value.numerator / value.denominator;
}

function absRational(value: Rational): Rational {
  return { numerator: Math.abs(value.numerator), denominator: value.denominator };
}

function isZeroRational(value: Rational): boolean {
  return value.numerator === 0;
}

function isUnitRational(value: Rational): boolean {
  return Math.abs(value.numerator) === value.denominator;
}

function integerRational(value: number): Rational {
  assertInteger(value, 'Целое значение');
  return { numerator: value, denominator: 1 };
}

function numberText(value: number): string {
  return String(value).replace('-', '−');
}

// ───────────────────────────── Запись функции ────────────────────────────────

/**
 * Запись квадратичной функции обычными знаками: `y = 0,5x² − x + 3`.
 * Единичные коэффициенты и нулевые слагаемые не печатаются.
 */
export function quadraticFunctionText(a: Rational, b: Rational, c: Rational): string {
  if (isZeroRational(a)) {
    throw new RangeError('Старший коэффициент квадратичной функции не может быть равен нулю');
  }
  const head = isUnitRational(a)
    ? `${a.numerator < 0 ? '−' : ''}x²`
    : `${formatRational(a)}x²`;
  const middle = isZeroRational(b)
    ? ''
    : ` ${b.numerator < 0 ? '−' : '+'} ${isUnitRational(b) ? '' : formatRational(absRational(b))}x`;
  const tail = isZeroRational(c) ? '' : ` ${c.numerator < 0 ? '−' : '+'} ${formatRational(absRational(c))}`;
  return `y = ${head}${middle}${tail}`;
}

/** Та же запись для целых коэффициентов — короткий вызов для уроков и лабораторий. */
export function standardFormText(a: number, b: number, c: number): string {
  assertLeading(a);
  assertInteger(b, 'Коэффициент b');
  assertInteger(c, 'Свободный член c');
  return quadraticFunctionText(integerRational(a), integerRational(b), integerRational(c));
}

/** Запись вершинной формы: `y = 2(x − 1)² − 3`. */
export function vertexFormText(leading: Rational, m: Rational, n: Rational): string {
  if (isZeroRational(leading)) {
    throw new RangeError('Старший коэффициент квадратичной функции не может быть равен нулю');
  }
  const factor = isUnitRational(leading)
    ? (leading.numerator < 0 ? '−' : '')
    : formatRational(leading);
  const base = isZeroRational(m)
    ? 'x²'
    : `(x ${m.numerator < 0 ? '+' : '−'} ${formatRational(absRational(m))})²`;
  const tail = isZeroRational(n) ? '' : ` ${n.numerator < 0 ? '−' : '+'} ${formatRational(absRational(n))}`;
  return `y = ${factor}${base}${tail}`;
}

// ───────────────────────── Форма и свойства параболы ─────────────────────────

/** Куда смотрят ветви: вверх при a > 0 и вниз при a < 0. */
export function branchDirection(a: number): BranchDirection {
  assertLeading(a);
  return a > 0 ? 'up' : 'down';
}

/** Ось симметрии параболы — вертикальная прямая x = −b/(2a). */
export function axisOfSymmetry(a: number, b: number, c: number): Rational {
  return vertex(a, b, c).x;
}

/** Точки графика в узлах — та самая таблица, которую заполняют в тетради. */
export function valueTable(
  a: number,
  b: number,
  c: number,
  xs: readonly number[],
): readonly { readonly x: number; readonly y: number }[] {
  return Object.freeze(xs.map((x) => Object.freeze({ x, y: evaluateQuadratic(a, b, c, x) })));
}

/**
 * Симметричная относительно оси парабола: точке x соответствует «зеркальная»
 * точка 2·x₀ − x с тем же значением функции.
 */
export function mirrorPoint(a: number, b: number, c: number, x: number): number {
  if (!Number.isFinite(x)) {
    throw new TypeError('Аргумент x должен быть конечным числом');
  }
  const axis = axisOfSymmetry(a, b, c);
  return 2 * rationalValue(axis) - x;
}

export interface Monotonicity {
  /** Промежуток убывания, записанный скобками. */
  readonly decreasing: string;
  /** Промежуток возрастания, записанный скобками. */
  readonly increasing: string;
}

/** Промежутки монотонности: вершина делит область определения ровно пополам. */
export function monotonicity(a: number, b: number, c: number): Monotonicity {
  const axis = formatRational(axisOfSymmetry(a, b, c));
  const left = `(−∞; ${axis}]`;
  const right = `[${axis}; +∞)`;
  return branchDirection(a) === 'up'
    ? Object.freeze({ decreasing: left, increasing: right })
    : Object.freeze({ decreasing: right, increasing: left });
}

/** Область значений: луч от значения в вершине вверх или вниз. */
export function rangeText(a: number, b: number, c: number): string {
  const top = vertex(a, b, c).y;
  return branchDirection(a) === 'up'
    ? `y ⩾ ${formatRational(top)}`
    : `y ⩽ ${formatRational(top)}`;
}

/** Что достигается в вершине: наименьшее значение при a > 0, наибольшее при a < 0. */
export function extremumKind(a: number): Extremum {
  return branchDirection(a) === 'up' ? 'min' : 'max';
}

/** Словесное описание нулей функции. */
export function zerosText(a: number, b: number, c: number): string {
  const solution = solveQuadratic(a, b, c);
  if (solution.rootCount === 0) return 'нулей нет: график не пересекает ось x';
  if (solution.rootCount === 1) return `один нуль: x = ${describeRoot(solution.roots[0]!)} — вершина лежит на оси x`;
  return `два нуля: x = ${describeRoot(solution.roots[0]!)} и x = ${describeRoot(solution.roots[1]!)}`;
}

export interface ParabolaFacts {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly direction: BranchDirection;
  readonly vertex: { readonly x: Rational; readonly y: Rational };
  readonly axisText: string;
  /** Точка пересечения с осью y равна свободному члену. */
  readonly yIntercept: number;
  readonly discriminant: number;
  readonly rootCount: RootCount;
  readonly roots: readonly QuadraticRoot[];
  readonly extremum: Extremum;
  readonly extremeValue: Rational;
  readonly rangeText: string;
  readonly monotonicity: Monotonicity;
  readonly zerosText: string;
  /** Где график лежит выше оси x. */
  readonly positiveText: string;
  /** Где график лежит ниже оси x. */
  readonly negativeText: string;
}

/** Полный «паспорт» параболы: всё, что читается по графику. */
export function describeParabola(a: number, b: number, c: number): ParabolaFacts {
  const solution = solveQuadratic(a, b, c);
  const top = vertex(a, b, c);
  return Object.freeze({
    a,
    b,
    c,
    direction: branchDirection(a),
    vertex: Object.freeze({ x: top.x, y: top.y }),
    axisText: `x = ${formatRational(top.x)}`,
    yIntercept: c,
    discriminant: solution.discriminant,
    rootCount: solution.rootCount,
    roots: Object.freeze([...solution.roots]),
    extremum: extremumKind(a),
    extremeValue: top.y,
    rangeText: rangeText(a, b, c),
    monotonicity: monotonicity(a, b, c),
    zerosText: zerosText(a, b, c),
    positiveText: solveQuadraticInequality(a, b, c, 'gt').conditionText,
    negativeText: solveQuadraticInequality(a, b, c, 'lt').conditionText,
  });
}

// ────────────────────── Вершинная форма и преобразования ─────────────────────

export interface VertexForm {
  /** Старший коэффициент; он же коэффициент растяжения. */
  readonly leading: number;
  /** Сдвиг вдоль оси x: y = a(x − m)² + n. */
  readonly m: Rational;
  /** Сдвиг вдоль оси y. */
  readonly n: Rational;
}

/**
 * Переход ax² + bx + c → a(x − m)² + n. Выделение полного квадрата даёт
 * a(x + shift)² + constant, поэтому m = −shift, а n = constant.
 */
export function toVertexForm(a: number, b: number, c: number): VertexForm {
  const square = completeSquare(a, b, c);
  return Object.freeze({
    leading: square.leading,
    m: normalizeRational(-square.shift.numerator, square.shift.denominator),
    n: square.constant,
  });
}

/** Обратный переход a(x − m)² + n → ax² + bx + c для целых a, m, n. */
export function fromVertexForm(a: number, m: number, n: number): { a: number; b: number; c: number } {
  assertLeading(a);
  assertInteger(m, 'Сдвиг m');
  assertInteger(n, 'Сдвиг n');
  const b = -2 * a * m;
  const c = a * m * m + n;
  assertInteger(b, 'Коэффициент b');
  assertInteger(c, 'Свободный член c');
  return { a, b, c };
}

export type TransformKind = 'start' | 'scale' | 'reflect' | 'shift-x' | 'shift-y';

export interface TransformStep {
  readonly kind: TransformKind;
  /** Что делаем с графиком на этом шаге. */
  readonly action: string;
  /** Формула, которая получилась после шага. */
  readonly formula: string;
}

/**
 * Цепочка преобразований от эталона y = x² к y = a(x − m)² + n.
 * Порядок фиксирован: сначала масштаб и отражение, затем сдвиги.
 */
export function transformSteps(leading: Rational, m: number, n: number): readonly TransformStep[] {
  if (isZeroRational(leading)) {
    throw new RangeError('Старший коэффициент квадратичной функции не может быть равен нулю');
  }
  assertInteger(m, 'Сдвиг m');
  assertInteger(n, 'Сдвиг n');

  const magnitude = absRational(leading);
  const steps: TransformStep[] = [
    { kind: 'start', action: 'Берём эталонную параболу', formula: 'y = x²' },
  ];

  if (!isUnitRational(magnitude)) {
    const stretched = rationalValue(magnitude) > 1;
    const factor = stretched
      ? formatRational(magnitude)
      : formatRational(normalizeRational(magnitude.denominator, magnitude.numerator));
    steps.push({
      kind: 'scale',
      action: stretched
        ? `Растягиваем график от оси x в ${factor} раза по вертикали — парабола становится уже`
        : `Сжимаем график к оси x в ${factor} раза по вертикали — парабола становится шире`,
      formula: vertexFormText(magnitude, integerRational(0), integerRational(0)),
    });
  }

  if (leading.numerator < 0) {
    steps.push({
      kind: 'reflect',
      action: 'Отражаем график относительно оси x — ветви поворачиваются вниз',
      formula: vertexFormText(leading, integerRational(0), integerRational(0)),
    });
  }

  if (m !== 0) {
    steps.push({
      kind: 'shift-x',
      action: `Сдвигаем график вдоль оси x на ${Math.abs(m)} ${m > 0 ? 'вправо' : 'влево'}`,
      formula: vertexFormText(leading, integerRational(m), integerRational(0)),
    });
  }

  if (n !== 0) {
    steps.push({
      kind: 'shift-y',
      action: `Сдвигаем график вдоль оси y на ${Math.abs(n)} ${n > 0 ? 'вверх' : 'вниз'}`,
      formula: vertexFormText(leading, integerRational(m), integerRational(n)),
    });
  }

  return Object.freeze(steps);
}

// ────────────────── Дробный старший коэффициент через масштаб ────────────────

/**
 * Квадратичная функция с дробными коэффициентами, записанная целыми числами:
 * y = (a·x² + b·x + c) / scale, где a, b, c целые, а scale — натуральное.
 * Такое представление позволяет пользоваться целочисленными функциями
 * `quadratics.ts` без потери точности.
 */
export interface ScaledQuadratic {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly scale: number;
}

function assertScaled(value: ScaledQuadratic): void {
  assertLeading(value.a);
  assertInteger(value.b, 'Коэффициент b');
  assertInteger(value.c, 'Свободный член c');
  if (!Number.isSafeInteger(value.scale) || value.scale <= 0) {
    throw new RangeError('Масштаб должен быть натуральным числом');
  }
}

/**
 * y = a(x − m)² + n с рациональным a = p/q превращается в
 * (p·x² − 2pm·x + p·m² + q·n) / q.
 */
export function vertexFormToStandard(leading: Rational, m: number, n: number): ScaledQuadratic {
  if (isZeroRational(leading)) {
    throw new RangeError('Старший коэффициент квадратичной функции не может быть равен нулю');
  }
  assertInteger(m, 'Сдвиг m');
  assertInteger(n, 'Сдвиг n');
  const reduced = normalizeRational(leading.numerator, leading.denominator);
  const p = reduced.numerator;
  const q = reduced.denominator;
  const result: ScaledQuadratic = {
    a: p,
    b: -2 * p * m,
    c: p * m * m + q * n,
    scale: q,
  };
  assertScaled(result);
  return Object.freeze(result);
}

/** Коэффициенты дробной записи: точные несократимые дроби. */
export function scaledCoefficients(value: ScaledQuadratic): { a: Rational; b: Rational; c: Rational } {
  assertScaled(value);
  return {
    a: normalizeRational(value.a, value.scale),
    b: normalizeRational(value.b, value.scale),
    c: normalizeRational(value.c, value.scale),
  };
}

/** Запись такой функции обычными знаками. */
export function scaledFunctionText(value: ScaledQuadratic): string {
  const { a, b, c } = scaledCoefficients(value);
  return quadraticFunctionText(a, b, c);
}

/** Значение функции в точке: делим на масштаб уже после подстановки. */
export function scaledValue(value: ScaledQuadratic, x: number): number {
  assertScaled(value);
  return evaluateQuadratic(value.a, value.b, value.c, x) / value.scale;
}

/**
 * Вершина. Абсцисса −b/(2a) от масштаба не зависит, ордината делится на него:
 * умножение функции на число не двигает вершину по горизонтали.
 */
export function scaledVertex(value: ScaledQuadratic): { x: Rational; y: Rational } {
  assertScaled(value);
  const top = vertex(value.a, value.b, value.c);
  return {
    x: top.x,
    y: normalizeRational(top.y.numerator, top.y.denominator * value.scale),
  };
}

/** Нули функции: умножение на положительный масштаб их не меняет. */
export function scaledRoots(value: ScaledQuadratic): readonly QuadraticRoot[] {
  assertScaled(value);
  return Object.freeze([...solveQuadratic(value.a, value.b, value.c).roots]);
}

/**
 * Куски кривой внутри окна. Растянутое по вертикали окно и целые коэффициенты
 * дают ровно ту же ломаную, что и прямая обрезка дробной функции: и выборка по
 * x, и линейная интерполяция на границе переживают умножение на число.
 */
export function scaledSegments(
  value: ScaledQuadratic,
  box: PlotBox,
  sampleCount = 241,
): Point[][] {
  assertScaled(value);
  const stretched: PlotBox = {
    xMin: box.xMin,
    xMax: box.xMax,
    yMin: box.yMin * value.scale,
    yMax: box.yMax * value.scale,
  };
  return parabolaSegments(value.a, value.b, value.c, stretched, sampleCount)
    .map((segment) => segment.map((point) => ({ x: point.x, y: point.y / value.scale })));
}

// ───────────────────────── Квадратные неравенства ────────────────────────────

/** Знак квадратного неравенства. */
export type QuadRelation = 'lt' | 'le' | 'gt' | 'ge';

export const QUAD_RELATIONS: readonly QuadRelation[] = Object.freeze(['lt', 'le', 'gt', 'ge'] as const);

export function quadRelationText(relation: QuadRelation): string {
  if (relation === 'lt') return '<';
  if (relation === 'le') return '⩽';
  if (relation === 'gt') return '>';
  return '⩾';
}

/** Умножение обеих частей на отрицательное число переворачивает знак. */
export function flipQuadRelation(relation: QuadRelation): QuadRelation {
  if (relation === 'lt') return 'gt';
  if (relation === 'gt') return 'lt';
  if (relation === 'le') return 'ge';
  return 'le';
}

export function isStrictRelation(relation: QuadRelation): boolean {
  return relation === 'lt' || relation === 'gt';
}

function wantsPositive(relation: QuadRelation): boolean {
  return relation === 'gt' || relation === 'ge';
}

function assertRelation(relation: QuadRelation): void {
  if (!QUAD_RELATIONS.includes(relation)) {
    throw new RangeError('Неизвестный знак неравенства');
  }
}

/**
 * Приведение к положительному старшему коэффициенту: обе части умножаются
 * на −1, и знак неравенства меняется на противоположный. Множество решений
 * при этом сохраняется.
 */
export function withPositiveLeading(
  a: number,
  b: number,
  c: number,
  relation: QuadRelation,
): { a: number; b: number; c: number; relation: QuadRelation } {
  assertLeading(a);
  assertRelation(relation);
  return a > 0
    ? { a, b, c, relation }
    : { a: -a, b: -b, c: -c, relation: flipQuadRelation(relation) };
}

/** Один кусок ответа; null вместо границы означает бесконечность. */
export interface SolutionPiece {
  readonly left: QuadraticRoot | null;
  readonly right: QuadraticRoot | null;
  readonly leftClosed: boolean;
  readonly rightClosed: boolean;
}

/** Форма ответа квадратного неравенства. */
export type SolutionShape =
  | 'empty'
  | 'all'
  | 'between'
  | 'outside'
  | 'point'
  | 'all-except-point';

export interface QuadraticInequalitySolution {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly relation: QuadRelation;
  readonly discriminant: number;
  readonly rootCount: RootCount;
  readonly roots: readonly QuadraticRoot[];
  readonly shape: SolutionShape;
  readonly pieces: readonly SolutionPiece[];
  /** Ответ промежутками: «(−∞; 2) ∪ (3; +∞)». */
  readonly setText: string;
  /** Ответ условием на x: «x < 2 или x > 3». */
  readonly conditionText: string;
}

function piece(
  left: QuadraticRoot | null,
  right: QuadraticRoot | null,
  closed: boolean,
): SolutionPiece {
  return Object.freeze({
    left,
    right,
    leftClosed: left !== null && closed,
    rightClosed: right !== null && closed,
  });
}

function boundText(root: QuadraticRoot | null, infinity: string): string {
  return root === null ? infinity : describeRoot(root);
}

function pieceText(item: SolutionPiece): string {
  const open = item.leftClosed ? '[' : '(';
  const close = item.rightClosed ? ']' : ')';
  return `${open}${boundText(item.left, '−∞')}; ${boundText(item.right, '+∞')}${close}`;
}

/** Ответ промежутками; несколько кусков соединяются знаком объединения. */
export function formatSolutionSet(solution: QuadraticInequalitySolution): string {
  if (solution.shape === 'empty') return '∅';
  return solution.pieces.map(pieceText).join(' ∪ ');
}

function conditionFor(shape: SolutionShape, pieces: readonly SolutionPiece[], strict: boolean): string {
  const less = strict ? '<' : '⩽';
  const greater = strict ? '>' : '⩾';

  if (shape === 'empty') return 'решений нет';
  if (shape === 'all') return 'x — любое число';
  if (shape === 'point') return `x = ${describeRoot(pieces[0]!.left!)}`;
  if (shape === 'all-except-point') return `x — любое число, кроме x = ${describeRoot(pieces[0]!.right!)}`;
  if (shape === 'between') {
    const item = pieces[0]!;
    return `${describeRoot(item.left!)} ${less} x ${less} ${describeRoot(item.right!)}`;
  }
  const [first, second] = pieces as readonly [SolutionPiece, SolutionPiece];
  return `x ${less} ${describeRoot(first.right!)} или x ${greater} ${describeRoot(second.left!)}`;
}

/**
 * Решает ax² + bx + c ⋛ 0 по расположению параболы.
 *
 * Сначала неравенство приводится к положительному старшему коэффициенту, потом
 * работает единственное правило: между корнями трёхчлен имеет знак,
 * противоположный знаку a, а вне корней — совпадающий с ним.
 */
export function solveQuadraticInequality(
  a: number,
  b: number,
  c: number,
  relation: QuadRelation,
): QuadraticInequalitySolution {
  assertRelation(relation);
  const normalized = withPositiveLeading(a, b, c, relation);
  const solution = solveQuadratic(a, b, c);
  const roots = solution.roots;
  const strict = isStrictRelation(normalized.relation);
  const positive = wantsPositive(normalized.relation);

  let shape: SolutionShape;
  let pieces: readonly SolutionPiece[];

  if (solution.rootCount === 2) {
    const [first, second] = roots as readonly [QuadraticRoot, QuadraticRoot];
    if (positive) {
      shape = 'outside';
      pieces = [piece(null, first, !strict), piece(second, null, !strict)];
    } else {
      shape = 'between';
      pieces = [piece(first, second, !strict)];
    }
  } else if (solution.rootCount === 1) {
    const only = roots[0]!;
    if (positive && strict) {
      shape = 'all-except-point';
      pieces = [piece(null, only, false), piece(only, null, false)];
    } else if (positive) {
      shape = 'all';
      pieces = [piece(null, null, false)];
    } else if (strict) {
      shape = 'empty';
      pieces = [];
    } else {
      shape = 'point';
      pieces = [piece(only, only, true)];
    }
  } else if (positive) {
    shape = 'all';
    pieces = [piece(null, null, false)];
  } else {
    shape = 'empty';
    pieces = [];
  }

  const frozenPieces = Object.freeze([...pieces]);
  const draft: QuadraticInequalitySolution = {
    a,
    b,
    c,
    relation,
    discriminant: solution.discriminant,
    rootCount: solution.rootCount,
    roots: Object.freeze([...roots]),
    shape,
    pieces: frozenPieces,
    setText: '',
    conditionText: conditionFor(shape, frozenPieces, strict),
  };

  return Object.freeze({ ...draft, setText: formatSolutionSet(draft) });
}

/** Прямая проверка числа подстановкой — способ убедиться в ответе. */
export function satisfiesQuadraticInequality(
  a: number,
  b: number,
  c: number,
  relation: QuadRelation,
  x: number,
): boolean {
  assertRelation(relation);
  const value = evaluateQuadratic(a, b, c, x);
  if (relation === 'lt') return value < 0;
  if (relation === 'le') return value <= 0;
  if (relation === 'gt') return value > 0;
  return value >= 0;
}

/** Числовые границы куска ответа — для закраски на рисунке. */
export function pieceBounds(item: SolutionPiece): { from: number; to: number } {
  return {
    from: item.left === null ? Number.NEGATIVE_INFINITY : item.left.approx,
    to: item.right === null ? Number.POSITIVE_INFINITY : item.right.approx,
  };
}

/** Короткая запись неравенства обычными знаками: «x² − 5x + 6 > 0». */
export function inequalityText(a: number, b: number, c: number, relation: QuadRelation): string {
  assertRelation(relation);
  const left = standardFormText(a, b, c).replace('y = ', '');
  return `${left} ${quadRelationText(relation)} 0`;
}

/** Название формы ответа — подсказка для лаборатории и проверки. */
export function shapeTitle(shape: SolutionShape): string {
  if (shape === 'between') return 'промежуток между корнями';
  if (shape === 'outside') return 'два луча вне корней';
  if (shape === 'all') return 'вся числовая прямая';
  if (shape === 'empty') return 'решений нет';
  if (shape === 'point') return 'одно число';
  return 'вся прямая без одной точки';
}

/** Подпись к числу с типографским минусом — для осей рисунка. */
export function axisLabel(value: number): string {
  return numberText(value);
}
