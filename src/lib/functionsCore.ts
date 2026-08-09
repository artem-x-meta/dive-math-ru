/**
 * Вычислительное ядро главы «Общий язык функций» (10 класс).
 *
 * Три независимые части:
 *   1) шесть эталонных функций и общее преобразование y = a·f(k(x − m)) + n:
 *      значения, область определения, область значений, чётность, цепочка шагов
 *      и честно посчитанные по точкам ломаные для рисунка;
 *   2) обратимость: набор разобранных примеров, у каждого точно известно,
 *      обратим он или нет, и какова формула обратной функции;
 *   3) композиция: таблица «x → внутренняя → внешняя» и её значение.
 *
 * Точной дробной арифметики здесь нет намеренно: у корня, куба и гиперболы нет
 * конечного дробного представления, поэтому все координаты — числа с плавающей
 * точкой. Зато каждая точка кривой считается по формуле, а не рисуется на глаз.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Прямоугольное окно рисунка в математических координатах. */
export interface Box {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

/** Отрезок оси x, на котором исследуют функцию. */
export interface Interval {
  readonly min: number;
  readonly max: number;
}

export type FunctionErrorCode =
  | 'unknown-function'
  | 'unknown-preset'
  | 'zero-coefficient'
  | 'invalid-window'
  | 'invalid-interval';

export class FunctionError extends Error {
  readonly code: FunctionErrorCode;

  constructor(code: FunctionErrorCode, message: string) {
    super(message);
    this.name = 'FunctionError';
    this.code = code;
  }
}

/** Чётность функции: симметрия относительно оси y, начала координат или ничего. */
export type Parity = 'even' | 'odd' | 'none';

/** Характер монотонности на промежутке. */
export type Monotonicity = 'increasing' | 'decreasing' | 'none';

// ─────────────────────────── Числа и запись формул ───────────────────────────

const EPSILON = 1e-9;

/** Русская запись числа: десятичная запятая и типографский минус. */
export function numberText(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 1000) / 1000;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return String(normalized).replace('.', ',').replace('-', '−');
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  const rounded = Math.round(Number.isFinite(value) ? value : minimum);
  return Math.min(maximum, Math.max(minimum, rounded));
}

// ───────────────────────────── Эталонные функции ─────────────────────────────

export type BaseFunctionId = 'linear' | 'square' | 'cube' | 'abs' | 'sqrt' | 'reciprocal';

export const BASE_FUNCTION_IDS: readonly BaseFunctionId[] = Object.freeze([
  'linear',
  'square',
  'cube',
  'abs',
  'sqrt',
  'reciprocal',
] as const);

/** Форма множества значений эталона: она и определяет E(f) после преобразования. */
type RangeKind = 'all' | 'nonnegative' | 'nonzero';

export interface BaseFunctionSpec {
  readonly id: BaseFunctionId;
  /** Короткое имя для кнопки. */
  readonly title: string;
  /** Формула эталона в виде текста. */
  readonly formulaText: string;
  /** Название линии. */
  readonly shapeText: string;
  readonly domainText: string;
  readonly rangeText: string;
  readonly parity: Parity;
  readonly behaviourText: string;
  readonly rangeKind: RangeKind;
}

const BASE_SPECS: Record<BaseFunctionId, BaseFunctionSpec> = {
  linear: {
    id: 'linear',
    title: 'y = x',
    formulaText: 'y = x',
    shapeText: 'прямая — биссектриса I и III четвертей',
    domainText: 'любое число',
    rangeText: 'любое число',
    parity: 'odd',
    behaviourText: 'возрастает на всей числовой прямой',
    rangeKind: 'all',
  },
  square: {
    id: 'square',
    title: 'y = x²',
    formulaText: 'y = x²',
    shapeText: 'парабола с вершиной в начале координат',
    domainText: 'любое число',
    rangeText: 'y ⩾ 0',
    parity: 'even',
    behaviourText: 'убывает при x ⩽ 0 и возрастает при x ⩾ 0',
    rangeKind: 'nonnegative',
  },
  cube: {
    id: 'cube',
    title: 'y = x³',
    formulaText: 'y = x³',
    shapeText: 'кубическая парабола',
    domainText: 'любое число',
    rangeText: 'любое число',
    parity: 'odd',
    behaviourText: 'возрастает на всей числовой прямой',
    rangeKind: 'all',
  },
  abs: {
    id: 'abs',
    title: 'y = |x|',
    formulaText: 'y = |x|',
    shapeText: 'уголок из двух лучей',
    domainText: 'любое число',
    rangeText: 'y ⩾ 0',
    parity: 'even',
    behaviourText: 'убывает при x ⩽ 0 и возрастает при x ⩾ 0',
    rangeKind: 'nonnegative',
  },
  sqrt: {
    id: 'sqrt',
    title: 'y = √x',
    formulaText: 'y = √x',
    shapeText: 'половина лежащей параболы',
    domainText: 'x ⩾ 0',
    rangeText: 'y ⩾ 0',
    parity: 'none',
    behaviourText: 'возрастает на всей области определения',
    rangeKind: 'nonnegative',
  },
  reciprocal: {
    id: 'reciprocal',
    title: 'y = 1/x',
    formulaText: 'y = 1/x',
    shapeText: 'гипербола из двух ветвей',
    domainText: 'x ≠ 0',
    rangeText: 'y ≠ 0',
    parity: 'odd',
    behaviourText: 'убывает на каждой из двух ветвей по отдельности',
    rangeKind: 'nonzero',
  },
};

export function getBaseFunction(id: BaseFunctionId): BaseFunctionSpec {
  const spec = BASE_SPECS[id];
  if (!spec) throw new FunctionError('unknown-function', `Неизвестная эталонная функция: ${String(id)}`);
  return spec;
}

/** Значение эталона; null означает, что число не входит в область определения. */
export function baseValue(id: BaseFunctionId, x: number): number | null {
  getBaseFunction(id);
  if (!Number.isFinite(x)) return null;

  switch (id) {
    case 'linear':
      return x;
    case 'square':
      return x * x;
    case 'cube':
      return x * x * x;
    case 'abs':
      return Math.abs(x);
    case 'sqrt':
      return x < 0 ? null : Math.sqrt(x);
    case 'reciprocal':
      return x === 0 ? null : 1 / x;
  }
}

// ──────────────────────── Общее преобразование графика ───────────────────────

/** Параметры записи y = a·f(k(x − m)) + n. */
export interface TransformParams {
  /** Вертикальный множитель, a ≠ 0. */
  readonly a: number;
  /** Горизонтальный множитель внутри аргумента, k ≠ 0. */
  readonly k: number;
  /** Сдвиг вдоль оси x. */
  readonly m: number;
  /** Сдвиг вдоль оси y. */
  readonly n: number;
}

export const IDENTITY_TRANSFORM: TransformParams = Object.freeze({ a: 1, k: 1, m: 0, n: 0 });

function assertTransform(params: TransformParams): void {
  const values = [params.a, params.k, params.m, params.n];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new FunctionError('zero-coefficient', 'Все параметры преобразования должны быть конечными числами');
  }
  if (params.a === 0) {
    throw new FunctionError('zero-coefficient', 'Множитель a не может быть равен нулю');
  }
  if (params.k === 0) {
    throw new FunctionError('zero-coefficient', 'Множитель k не может быть равен нулю');
  }
}

/** Текст внутреннего выражения k(x − m) и признак «это один множитель». */
function innerParts(k: number, m: number): { readonly text: string; readonly atomic: boolean } {
  const shift = m === 0 ? 'x' : `x ${m > 0 ? '−' : '+'} ${numberText(Math.abs(m))}`;
  if (k === 1) return { text: shift, atomic: m === 0 };
  const factor = k === -1 ? '−' : numberText(k);
  return m === 0 ? { text: `${factor}x`, atomic: true } : { text: `${factor}(${shift})`, atomic: true };
}

/** Подставляет готовое выражение в эталон и расставляет скобки. */
function applyBaseText(id: BaseFunctionId, argument: string, atomic: boolean): string {
  const simple = argument === 'x';
  switch (id) {
    case 'linear':
      return atomic ? argument : `(${argument})`;
    case 'square':
      return simple ? 'x²' : `(${argument})²`;
    case 'cube':
      return simple ? 'x³' : `(${argument})³`;
    case 'abs':
      return `|${argument}|`;
    case 'sqrt':
      return simple ? '√x' : `√(${argument})`;
    case 'reciprocal':
      return simple ? '1/x' : `1/(${argument})`;
  }
}

/** Текстовая запись преобразованной функции, например «y = −2·|x − 3| + 1». */
export function transformText(id: BaseFunctionId, params: TransformParams): string {
  getBaseFunction(id);
  assertTransform(params);

  const inner = innerParts(params.k, params.m);
  const core = applyBaseText(id, inner.text, inner.atomic);
  // Ведущий минус даёт только линейный эталон: −u можно записать без множителя.
  const negated = core.startsWith('−');

  let body: string;
  if (params.a === 1) {
    body = core;
  } else if (params.a === -1) {
    body = negated ? core.slice(1) : `−${core}`;
  } else {
    body = negated ? `${numberText(params.a)}·(${core})` : `${numberText(params.a)}·${core}`;
  }

  const tail = params.n === 0 ? '' : ` ${params.n > 0 ? '+' : '−'} ${numberText(Math.abs(params.n))}`;
  return `y = ${body}${tail}`;
}

/** Значение преобразованной функции; null — точка вне области определения. */
export function transformValue(id: BaseFunctionId, params: TransformParams, x: number): number | null {
  getBaseFunction(id);
  assertTransform(params);
  if (!Number.isFinite(x)) return null;

  const inner = baseValue(id, params.k * (x - params.m));
  if (inner === null) return null;
  const value = params.a * inner + params.n;
  return Number.isFinite(value) ? value : null;
}

/** Область определения преобразованной функции словами. */
export function transformedDomainText(id: BaseFunctionId, params: TransformParams): string {
  getBaseFunction(id);
  assertTransform(params);

  if (id === 'sqrt') {
    return `x ${params.k > 0 ? '⩾' : '⩽'} ${numberText(params.m)}`;
  }
  if (id === 'reciprocal') {
    return `x ≠ ${numberText(params.m)}`;
  }
  return 'любое число';
}

/** Область значений преобразованной функции словами. */
export function transformedRangeText(id: BaseFunctionId, params: TransformParams): string {
  const spec = getBaseFunction(id);
  assertTransform(params);

  if (spec.rangeKind === 'all') return 'любое число';
  if (spec.rangeKind === 'nonzero') return `y ≠ ${numberText(params.n)}`;
  return `y ${params.a > 0 ? '⩾' : '⩽'} ${numberText(params.n)}`;
}

/**
 * Чётность преобразованной функции.
 *
 * Сдвиг по горизонтали убивает любую симметрию, поэтому при m ≠ 0 ответ «нет».
 * У чётного эталона вертикальный сдвиг симметрию сохраняет, у нечётного — нет.
 */
export function transformedParity(id: BaseFunctionId, params: TransformParams): Parity {
  const spec = getBaseFunction(id);
  assertTransform(params);

  if (params.m !== 0) return 'none';
  if (spec.parity === 'even') return 'even';
  if (spec.parity === 'odd') return params.n === 0 ? 'odd' : 'none';
  return 'none';
}

export function parityText(parity: Parity): string {
  if (parity === 'even') return 'чётная: график симметричен относительно оси y';
  if (parity === 'odd') return 'нечётная: график симметричен относительно начала координат';
  return 'ни чётная, ни нечётная';
}

export interface TransformStep {
  readonly formula: string;
  readonly action: string;
}

/**
 * Цепочка преобразований эталона в порядке, который не ломает результат:
 * сначала действия с аргументом (масштаб, затем сдвиг), потом действия
 * со значением (масштаб, затем сдвиг).
 */
export function transformSteps(id: BaseFunctionId, params: TransformParams): readonly TransformStep[] {
  const spec = getBaseFunction(id);
  assertTransform(params);

  const steps: TransformStep[] = [
    { formula: spec.formulaText, action: 'Эталон, от которого идём.' },
  ];

  if (params.k !== 1) {
    const size = Math.abs(params.k);
    const scale = size > 1
      ? `сжатие к оси y в ${numberText(size)} раз`
      : size < 1
        ? `растяжение от оси y в ${numberText(1 / size)} раз`
        : 'масштаб по горизонтали не меняется';
    const mirror = params.k < 0 ? ', плюс отражение относительно оси y' : '';
    steps.push({
      formula: transformText(id, { a: 1, k: params.k, m: 0, n: 0 }),
      action: `Аргумент умножили на ${numberText(params.k)}: ${scale}${mirror}.`,
    });
  }

  if (params.m !== 0) {
    steps.push({
      formula: transformText(id, { a: 1, k: params.k, m: params.m, n: 0 }),
      action: `Сдвиг вдоль оси x на ${numberText(Math.abs(params.m))} ${params.m > 0 ? 'вправо' : 'влево'}.`,
    });
  }

  if (params.a !== 1) {
    const size = Math.abs(params.a);
    const scale = size > 1
      ? `растяжение от оси x в ${numberText(size)} раз`
      : size < 1
        ? `сжатие к оси x в ${numberText(1 / size)} раз`
        : 'масштаб по вертикали не меняется';
    const mirror = params.a < 0 ? ', плюс отражение относительно оси x' : '';
    steps.push({
      formula: transformText(id, { a: params.a, k: params.k, m: params.m, n: 0 }),
      action: `Значение умножили на ${numberText(params.a)}: ${scale}${mirror}.`,
    });
  }

  if (params.n !== 0) {
    steps.push({
      formula: transformText(id, params),
      action: `Сдвиг вдоль оси y на ${numberText(Math.abs(params.n))} ${params.n > 0 ? 'вверх' : 'вниз'}.`,
    });
  }

  return steps;
}

function assertBox(box: Box): void {
  const values = [box.xMin, box.xMax, box.yMin, box.yMax];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new FunctionError('invalid-window', 'Границы окна должны быть конечными числами');
  }
  if (box.xMax <= box.xMin || box.yMax <= box.yMin) {
    throw new FunctionError('invalid-window', 'Окно графика должно иметь положительные размеры');
  }
}

function inWindow(value: number | null, box: Box): value is number {
  return value !== null && value >= box.yMin - EPSILON && value <= box.yMax + EPSILON;
}

/** Делением пополам находит точку, где кривая уходит за верхнюю или нижнюю границу. */
function edgePoint(
  value: (x: number) => number | null,
  insideX: number,
  outsideX: number,
  box: Box,
): Point | null {
  let low = insideX;
  let high = outsideX;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (inWindow(value(middle), box)) low = middle;
    else high = middle;
  }
  const y = value(low);
  return inWindow(y, box) ? { x: low, y } : null;
}

/**
 * Разбивает график на ломаные, обрывая линию там, где функция не определена
 * или уходит за пределы окна. Каждая точка вычислена по формуле.
 */
export function sampleSegments(
  value: (x: number) => number | null,
  box: Box,
  samples = 241,
): readonly Point[][] {
  assertBox(box);
  const count = clampInteger(samples, 16, 4096);
  const segments: Point[][] = [];
  let current: Point[] = [];
  let previousX: number | null = null;

  const close = () => {
    if (current.length > 1) segments.push(current);
    current = [];
  };

  for (let index = 0; index <= count; index += 1) {
    const x = box.xMin + ((box.xMax - box.xMin) * index) / count;
    const y = value(x);

    if (inWindow(y, box)) {
      if (current.length === 0 && previousX !== null) {
        const edge = edgePoint(value, x, previousX, box);
        if (edge) current.push(edge);
      }
      current.push({ x, y });
    } else {
      if (current.length > 0) {
        const edge = edgePoint(value, current[current.length - 1]!.x, x, box);
        if (edge) current.push(edge);
      }
      close();
    }
    previousX = x;
  }

  close();
  return segments;
}

/** Ломаные графика y = a·f(k(x − m)) + n внутри окна. */
export function transformSegments(
  id: BaseFunctionId,
  params: TransformParams,
  box: Box,
  samples = 241,
): readonly Point[][] {
  getBaseFunction(id);
  assertTransform(params);
  return sampleSegments((x) => transformValue(id, params, x), box, samples);
}

// ─────────────────────── Свойства по выборке значений ────────────────────────

function assertInterval(interval: Interval): void {
  if (!Number.isFinite(interval.min) || !Number.isFinite(interval.max)) {
    throw new FunctionError('invalid-interval', 'Границы промежутка должны быть конечными числами');
  }
  if (interval.max <= interval.min) {
    throw new FunctionError('invalid-interval', 'Правая граница промежутка должна быть больше левой');
  }
}

/** Равномерная сетка точек промежутка вместе со значениями функции. */
export function sampleValues(
  value: (x: number) => number | null,
  interval: Interval,
  samples = 129,
): readonly Point[] {
  assertInterval(interval);
  const count = clampInteger(samples, 3, 4096);
  const points: Point[] = [];
  for (let index = 0; index <= count; index += 1) {
    const x = interval.min + ((interval.max - interval.min) * index) / count;
    const y = value(x);
    if (y !== null && Number.isFinite(y)) points.push({ x, y });
  }
  return points;
}

/**
 * Монотонность по выборке значений. Это не доказательство, а честный
 * численный эксперимент: он ловит смену направления, но не заменяет
 * рассуждение.
 */
export function monotonicityOnInterval(
  id: BaseFunctionId,
  params: TransformParams,
  interval: Interval,
  samples = 129,
): Monotonicity {
  const points = sampleValues((x) => transformValue(id, params, x), interval, samples);
  if (points.length < 2) return 'none';

  let up = true;
  let down = true;
  for (let index = 1; index < points.length; index += 1) {
    const difference = points[index]!.y - points[index - 1]!.y;
    if (difference <= EPSILON) up = false;
    if (difference >= -EPSILON) down = false;
  }

  if (up) return 'increasing';
  if (down) return 'decreasing';
  return 'none';
}

export function monotonicityText(monotonicity: Monotonicity): string {
  if (monotonicity === 'increasing') return 'возрастает';
  if (monotonicity === 'decreasing') return 'убывает';
  return 'не монотонна';
}

export interface BoundsFacts {
  readonly minimum: number | null;
  readonly maximum: number | null;
  readonly bounded: boolean;
}

/** Наибольшее и наименьшее из встреченных значений — оценка ограниченности. */
export function boundsOnInterval(
  id: BaseFunctionId,
  params: TransformParams,
  interval: Interval,
  samples = 129,
): BoundsFacts {
  const points = sampleValues((x) => transformValue(id, params, x), interval, samples);
  if (points.length === 0) return { minimum: null, maximum: null, bounded: false };

  let minimum = points[0]!.y;
  let maximum = points[0]!.y;
  for (const point of points) {
    if (point.y < minimum) minimum = point.y;
    if (point.y > maximum) maximum = point.y;
  }
  return { minimum, maximum, bounded: true };
}

/** Проверка чётности перебором пар x и −x. */
export function parityFromSamples(
  value: (x: number) => number | null,
  probes: readonly number[],
): Parity {
  let even = true;
  let odd = true;
  let checked = 0;

  for (const x of probes) {
    const right = value(x);
    const left = value(-x);
    if (right === null || left === null) {
      // Если одна из симметричных точек вне области определения, симметрии нет.
      if (right !== left) return 'none';
      continue;
    }
    checked += 1;
    if (Math.abs(left - right) > 1e-6) even = false;
    if (Math.abs(left + right) > 1e-6) odd = false;
  }

  if (checked === 0) return 'none';
  if (even) return 'even';
  if (odd) return 'odd';
  return 'none';
}

// ───────────────────────────── Обратная функция ──────────────────────────────

export type InversePresetId =
  | 'linear'
  | 'cube'
  | 'sqrt'
  | 'reciprocal'
  | 'square-right'
  | 'square-shift'
  | 'square-all'
  | 'abs-all';

export const INVERSE_PRESET_IDS: readonly InversePresetId[] = Object.freeze([
  'linear',
  'square-right',
  'square-shift',
  'cube',
  'sqrt',
  'reciprocal',
  'square-all',
  'abs-all',
] as const);

/** Свидетель необратимости: одно значение, которое достигается дважды. */
export interface Collision {
  readonly level: number;
  readonly firstX: number;
  readonly secondX: number;
}

export interface InversePreset {
  readonly id: InversePresetId;
  readonly title: string;
  readonly formulaText: string;
  readonly domainText: string;
  readonly rangeText: string;
  /** Окно по оси x, в котором рисуем прямую функцию. */
  readonly window: Interval;
  /** Удобные аргументы для таблицы пар. */
  readonly probes: readonly number[];
  readonly value: (x: number) => number | null;
  readonly invertible: boolean;
  /** Формула обратной функции или null, если её нет. */
  readonly inverseText: string | null;
  readonly inverse: ((x: number) => number | null) | null;
  /** Область определения обратной функции — это множество значений прямой. */
  readonly inverseDomainText: string;
  readonly reason: string;
  readonly collision: Collision | null;
}

function ray(x: number, minimum: number): boolean {
  return x >= minimum - EPSILON;
}

const INVERSE_PRESETS: Record<InversePresetId, InversePreset> = {
  linear: {
    id: 'linear',
    title: 'y = 2x − 3',
    formulaText: 'y = 2x − 3',
    domainText: 'любое число',
    rangeText: 'любое число',
    window: { min: -6, max: 6 },
    probes: [-3, -1, 0, 2, 4],
    value: (x) => 2 * x - 3,
    invertible: true,
    inverseText: 'y = (x + 3)/2',
    inverse: (x) => (x + 3) / 2,
    inverseDomainText: 'любое число',
    reason: 'Функция возрастает на всей числовой прямой, поэтому разные x дают разные y.',
    collision: null,
  },
  'square-right': {
    id: 'square-right',
    title: 'y = x², x ⩾ 0',
    formulaText: 'y = x², x ⩾ 0',
    domainText: 'x ⩾ 0',
    rangeText: 'y ⩾ 0',
    window: { min: 0, max: 6 },
    probes: [0, 1, 2, 3, 4],
    value: (x) => (ray(x, 0) ? x * x : null),
    invertible: true,
    inverseText: 'y = √x',
    inverse: (x) => (ray(x, 0) ? Math.sqrt(x) : null),
    inverseDomainText: 'x ⩾ 0',
    reason: 'На луче x ⩾ 0 парабола только возрастает: каждое значение встречается ровно один раз.',
    collision: null,
  },
  'square-shift': {
    id: 'square-shift',
    title: 'y = (x − 1)² + 2, x ⩾ 1',
    formulaText: 'y = (x − 1)² + 2, x ⩾ 1',
    domainText: 'x ⩾ 1',
    rangeText: 'y ⩾ 2',
    window: { min: 1, max: 6 },
    probes: [1, 2, 3, 4, 5],
    value: (x) => (ray(x, 1) ? (x - 1) * (x - 1) + 2 : null),
    invertible: true,
    inverseText: 'y = 1 + √(x − 2)',
    inverse: (x) => (ray(x, 2) ? 1 + Math.sqrt(x - 2) : null),
    inverseDomainText: 'x ⩾ 2',
    reason: 'Правая половина параболы возрастает, поэтому обратная функция существует.',
    collision: null,
  },
  cube: {
    id: 'cube',
    title: 'y = x³',
    formulaText: 'y = x³',
    domainText: 'любое число',
    rangeText: 'любое число',
    window: { min: -3, max: 3 },
    probes: [-2, -1, 0, 1, 2],
    value: (x) => x * x * x,
    invertible: true,
    inverseText: 'y = ∛x',
    inverse: (x) => Math.cbrt(x),
    inverseDomainText: 'любое число',
    reason: 'Куб возрастает на всей прямой: у каждого числа ровно один кубический корень.',
    collision: null,
  },
  sqrt: {
    id: 'sqrt',
    title: 'y = √x',
    formulaText: 'y = √x',
    domainText: 'x ⩾ 0',
    rangeText: 'y ⩾ 0',
    window: { min: 0, max: 9 },
    probes: [0, 1, 4, 9],
    value: (x) => (ray(x, 0) ? Math.sqrt(x) : null),
    invertible: true,
    inverseText: 'y = x², x ⩾ 0',
    inverse: (x) => (ray(x, 0) ? x * x : null),
    inverseDomainText: 'x ⩾ 0',
    reason: 'Корень возрастает на своей области определения, а значения заполняют луч y ⩾ 0.',
    collision: null,
  },
  reciprocal: {
    id: 'reciprocal',
    title: 'y = 1/x',
    formulaText: 'y = 1/x',
    domainText: 'x ≠ 0',
    rangeText: 'y ≠ 0',
    window: { min: -6, max: 6 },
    probes: [-4, -2, -1, 1, 2, 4],
    value: (x) => (x === 0 ? null : 1 / x),
    invertible: true,
    inverseText: 'y = 1/x',
    inverse: (x) => (x === 0 ? null : 1 / x),
    inverseDomainText: 'x ≠ 0',
    reason: 'Разным x отвечают разные y, хотя на всей области определения функция не монотонна: она обратна самой себе.',
    collision: null,
  },
  'square-all': {
    id: 'square-all',
    title: 'y = x²',
    formulaText: 'y = x²',
    domainText: 'любое число',
    rangeText: 'y ⩾ 0',
    window: { min: -4, max: 4 },
    probes: [-2, -1, 0, 1, 2],
    value: (x) => x * x,
    invertible: false,
    inverseText: null,
    inverse: null,
    inverseDomainText: '—',
    reason: 'Значение 4 получают сразу два аргумента, поэтому по y восстановить x однозначно нельзя.',
    collision: { level: 4, firstX: -2, secondX: 2 },
  },
  'abs-all': {
    id: 'abs-all',
    title: 'y = |x|',
    formulaText: 'y = |x|',
    domainText: 'любое число',
    rangeText: 'y ⩾ 0',
    window: { min: -6, max: 6 },
    probes: [-3, -1, 0, 1, 3],
    value: (x) => Math.abs(x),
    invertible: false,
    inverseText: null,
    inverse: null,
    inverseDomainText: '—',
    reason: 'Уголок принимает значение 3 и при x = −3, и при x = 3: соответствие в обратную сторону не однозначно.',
    collision: { level: 3, firstX: -3, secondX: 3 },
  },
};

export function getInversePreset(id: InversePresetId): InversePreset {
  const preset = INVERSE_PRESETS[id];
  if (!preset) throw new FunctionError('unknown-preset', `Неизвестный пример обратимости: ${String(id)}`);
  return preset;
}

/** Отражение точки относительно прямой y = x — геометрия обратной функции. */
export function reflectPoint(point: Point): Point {
  return { x: point.y, y: point.x };
}

/** Ломаные прямой функции внутри окна рисунка. */
export function presetSegments(
  id: InversePresetId,
  box: Box,
  samples = 241,
): readonly Point[][] {
  const preset = getInversePreset(id);
  assertBox(box);
  const value = (x: number) => (x < preset.window.min - EPSILON || x > preset.window.max + EPSILON
    ? null
    : preset.value(x));
  return sampleSegments(value, box, samples);
}

/** Ломаные обратной функции: тот же график, отражённый относительно y = x. */
export function inverseSegments(
  id: InversePresetId,
  box: Box,
  samples = 241,
): readonly Point[][] {
  const preset = getInversePreset(id);
  assertBox(box);
  if (!preset.invertible) return [];

  const mirrored = { xMin: box.yMin, xMax: box.yMax, yMin: box.xMin, yMax: box.xMax };
  return presetSegments(id, mirrored, samples).map((segment) => segment.map(reflectPoint));
}

/** Пары «аргумент — значение», из которых видно правило обратной функции. */
export interface InversePair {
  readonly x: number;
  readonly y: number | null;
  readonly back: number | null;
}

export function inversePairs(id: InversePresetId, probes: readonly number[]): readonly InversePair[] {
  const preset = getInversePreset(id);
  return probes.map((x) => {
    const y = preset.value(x);
    const back = y === null || preset.inverse === null ? null : preset.inverse(y);
    return { x, y, back };
  });
}

/**
 * Сколько раз горизонтальная прямая y = level пересекает график.
 * Считаем по смене знака разности f(x) − level на выборке.
 */
export function levelCrossings(
  id: InversePresetId,
  level: number,
  samples = 601,
): number {
  const preset = getInversePreset(id);
  if (!Number.isFinite(level)) throw new FunctionError('invalid-interval', 'Уровень должен быть конечным числом');

  const points = sampleValues(preset.value, preset.window, samples);
  let crossings = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!.y - level;
    const current = points[index]!.y - level;
    if (Math.abs(previous) <= EPSILON) continue;
    if (Math.abs(current) <= EPSILON || previous * current < 0) crossings += 1;
  }
  return crossings;
}

// ───────────────────────────── Композиция функций ────────────────────────────

/** Одна строка таблицы «x → внутренняя → внешняя». */
export interface CompositionRow {
  readonly x: number;
  readonly inner: number | null;
  readonly outer: number | null;
}

/** Значение f(g(x)); null, если хотя бы один шаг не определён. */
export function compositionValue(
  outerId: BaseFunctionId,
  outerParams: TransformParams,
  innerId: BaseFunctionId,
  innerParams: TransformParams,
  x: number,
): number | null {
  const inner = transformValue(innerId, innerParams, x);
  if (inner === null) return null;
  return transformValue(outerId, outerParams, inner);
}

export function compositionTable(
  outerId: BaseFunctionId,
  outerParams: TransformParams,
  innerId: BaseFunctionId,
  innerParams: TransformParams,
  probes: readonly number[],
): readonly CompositionRow[] {
  return probes.map((x) => {
    const inner = transformValue(innerId, innerParams, x);
    const outer = inner === null ? null : transformValue(outerId, outerParams, inner);
    return { x, inner, outer };
  });
}
