import {
  addExact,
  compareExact,
  divideExact,
  multiplyExact,
  parseExact,
  subtractExact,
  toExactNumber,
  type ExactRational,
} from './exactRational';

export interface PlanimetryPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Пары углов при двух параллельных прямых и секущей:
 * соответственные, накрест лежащие и односторонние.
 */
export type TransversalPairKind = 'corresponding' | 'alternate' | 'co-interior';

export interface TriangleSides {
  /** Основание AB. */
  readonly ab: number;
  /** Сторона BC, лежащая против угла A. */
  readonly bc: number;
  /** Сторона CA, лежащая против угла B. */
  readonly ca: number;
}

/**
 * Полный набор данных треугольника: положение вершин, все три угла и все три
 * стороны. Вычисляется из основания и двух прилежащих углов — набора, который
 * по признаку УСУ задаёт треугольник однозначно.
 */
export interface TriangleLayout {
  readonly a: PlanimetryPoint;
  readonly b: PlanimetryPoint;
  readonly c: PlanimetryPoint;
  /** Углы при вершинах A, B и C в градусах. */
  readonly angles: readonly [number, number, number];
  readonly sides: TriangleSides;
}

const ZERO = parseExact(0);
const NINETY = parseExact(90);
const STRAIGHT = parseExact(180);

function parseDegrees(value: number, label: string): ExactRational {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} должен быть конечным числом градусов`);
  }
  return parseExact(value);
}

/** Проверяет, что угол лежит строго между 0° и 180° (не вырожден). */
function assertBetweenZeroAndStraight(value: number, label: string): ExactRational {
  const exact = parseDegrees(value, label);
  if (compareExact(exact, ZERO) <= 0 || compareExact(exact, STRAIGHT) >= 0) {
    throw new RangeError(`${label} должен быть строго между 0° и 180°`);
  }
  return exact;
}

/**
 * Смежный угол: два угла с общей стороной, две другие стороны которых
 * образуют прямую. Сумма смежных углов равна 180°.
 */
export function adjacentAngle(degrees: number): number {
  const exact = assertBetweenZeroAndStraight(degrees, 'Угол');
  return toExactNumber(subtractExact(STRAIGHT, exact));
}

/** Вертикальный угол равен исходному: это доказываемая теорема, а не рисунок. */
export function verticalAngle(degrees: number): number {
  const exact = assertBetweenZeroAndStraight(degrees, 'Угол');
  return toExactNumber(exact);
}

/**
 * Четыре угла при пересечении двух прямых, против часовой стрелки от заданного:
 * [α, 180° − α, α, 180° − α].
 */
export function crossingAngles(degrees: number): readonly [number, number, number, number] {
  const alpha = verticalAngle(degrees);
  const supplement = adjacentAngle(degrees);
  return [alpha, supplement, alpha, supplement];
}

/**
 * Величина парного угла при двух ПАРАЛЛЕЛЬНЫХ прямых и секущей.
 * Соответственные и накрест лежащие углы равны α, односторонние дополняют α до 180°.
 */
export function transversalPairAngle(kind: TransversalPairKind, degrees: number): number {
  if (kind === 'corresponding' || kind === 'alternate') return verticalAngle(degrees);
  if (kind === 'co-interior') return adjacentAngle(degrees);
  throw new RangeError(`Неизвестный вид пары углов: ${String(kind)}`);
}

/**
 * Признак параллельности: согласована ли измеренная пара углов при секущей
 * с параллельностью прямых. Соответственные и накрест лежащие должны быть
 * равны, односторонние — давать в сумме 180°.
 */
export function anglesImplyParallel(kind: TransversalPairKind, first: number, second: number): boolean {
  const left = assertBetweenZeroAndStraight(first, 'Первый угол');
  const right = assertBetweenZeroAndStraight(second, 'Второй угол');
  if (kind === 'corresponding' || kind === 'alternate') return compareExact(left, right) === 0;
  if (kind === 'co-interior') return compareExact(addExact(left, right), STRAIGHT) === 0;
  throw new RangeError(`Неизвестный вид пары углов: ${String(kind)}`);
}

/** Сумма углов выпуклого n-угольника: 180°·(n − 2). */
export function convexPolygonAngleSum(vertices: number): number {
  if (!Number.isInteger(vertices) || vertices < 3) {
    throw new RangeError('У многоугольника должно быть не меньше трёх вершин');
  }
  return 180 * (vertices - 2);
}

/** Сумма двух углов треугольника обязана быть меньше 180°. */
function assertTriangleAnglePair(a: number, b: number): readonly [ExactRational, ExactRational] {
  const first = assertBetweenZeroAndStraight(a, 'Первый угол');
  const second = assertBetweenZeroAndStraight(b, 'Второй угол');
  if (compareExact(addExact(first, second), STRAIGHT) >= 0) {
    throw new RangeError('Сумма двух углов треугольника должна быть меньше 180°');
  }
  return [first, second];
}

/** Третий угол треугольника по двум известным: 180° − α − β. */
export function thirdTriangleAngle(a: number, b: number): number {
  const [first, second] = assertTriangleAnglePair(a, b);
  return toExactNumber(subtractExact(STRAIGHT, addExact(first, second)));
}

/** Внешний угол, смежный с данным внутренним углом треугольника. */
export function exteriorAngle(interiorDegrees: number): number {
  return adjacentAngle(interiorDegrees);
}

/**
 * Теорема о внешнем угле: внешний угол равен сумме двух внутренних углов,
 * не смежных с ним.
 */
export function exteriorAngleFromRemote(a: number, b: number): number {
  const [first, second] = assertTriangleAnglePair(a, b);
  return toExactNumber(addExact(first, second));
}

/** Угол при основании равнобедренного треугольника по углу при вершине: (180° − α) : 2. */
export function isoscelesBaseAngle(apexDegrees: number): number {
  const apex = assertBetweenZeroAndStraight(apexDegrees, 'Угол при вершине');
  return toExactNumber(divideExact(subtractExact(STRAIGHT, apex), 2));
}

/** Угол при вершине равнобедренного треугольника по углу при основании: 180° − 2β. */
export function isoscelesApexAngle(baseDegrees: number): number {
  const base = parseDegrees(baseDegrees, 'Угол при основании');
  if (compareExact(base, ZERO) <= 0 || compareExact(base, NINETY) >= 0) {
    throw new RangeError('Угол при основании равнобедренного треугольника должен быть строго между 0° и 90°');
  }
  return toExactNumber(subtractExact(STRAIGHT, multiplyExact(2, base)));
}

function toRadians(degrees: ExactRational): number {
  return (toExactNumber(degrees) * Math.PI) / 180;
}

function assertPositiveLength(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} должна быть положительным конечным числом`);
  }
  return value;
}

/**
 * Вершина C треугольника, однозначно заданного стороной AB и прилежащими
 * углами A и B (жёсткость по признаку УСУ). A лежит в начале координат,
 * B — в точке (длина AB; 0), C — выше оси.
 */
export function triangleApexPoint(baseLength: number, angleA: number, angleB: number): PlanimetryPoint {
  const length = assertPositiveLength(baseLength, 'Длина основания');
  const [first, second] = assertTriangleAnglePair(angleA, angleB);
  const cotA = 1 / Math.tan(toRadians(first));
  const cotB = 1 / Math.tan(toRadians(second));
  const y = length / (cotA + cotB);
  return { x: y * cotA, y };
}

/**
 * Длины сторон треугольника, заданного основанием AB и углами A и B
 * (по теореме синусов). Против угла A лежит BC, против угла B — CA.
 */
export function triangleSidesFromBase(baseLength: number, angleA: number, angleB: number): TriangleSides {
  const length = assertPositiveLength(baseLength, 'Длина основания');
  const [first, second] = assertTriangleAnglePair(angleA, angleB);
  const third = subtractExact(STRAIGHT, addExact(first, second));
  const sinC = Math.sin(toRadians(third));
  return {
    ab: length,
    bc: (length * Math.sin(toRadians(first))) / sinC,
    ca: (length * Math.sin(toRadians(second))) / sinC,
  };
}

/**
 * Треугольник, восстановленный по стороне AB и двум прилежащим углам:
 * вершины, все углы и все стороны. Ровно те данные, которые нужны чертежу.
 */
export function triangleLayout(baseLength: number, angleA: number, angleB: number): TriangleLayout {
  return {
    a: { x: 0, y: 0 },
    b: { x: assertPositiveLength(baseLength, 'Длина основания'), y: 0 },
    c: triangleApexPoint(baseLength, angleA, angleB),
    angles: [angleA, angleB, thirdTriangleAngle(angleA, angleB)],
    sides: triangleSidesFromBase(baseLength, angleA, angleB),
  };
}

/**
 * Равнобедренный треугольник с основанием AB и заданным углом при вершине C.
 * Углы при основании вычисляются, а не подбираются на глаз.
 */
export function isoscelesLayout(baseLength: number, apexDegrees: number): TriangleLayout {
  const base = isoscelesBaseAngle(apexDegrees);
  return triangleLayout(baseLength, base, base);
}

function assertPoint(point: PlanimetryPoint, label: string): PlanimetryPoint {
  if (
    typeof point !== 'object' || point === null ||
    !Number.isFinite(point.x) || !Number.isFinite(point.y)
  ) {
    throw new TypeError(`${label} должна задаваться двумя конечными координатами`);
  }
  return point;
}

/** Середина отрезка — точка, равноудалённая от концов и лежащая на отрезке. */
export function segmentMidpoint(first: PlanimetryPoint, second: PlanimetryPoint): PlanimetryPoint {
  const start = assertPoint(first, 'Первая точка');
  const end = assertPoint(second, 'Вторая точка');
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

/**
 * Поворот точки вокруг центра на заданный угол против часовой стрелки.
 * Поворот сохраняет все расстояния, поэтому копия фигуры остаётся равной ей.
 */
export function rotatePoint(
  point: PlanimetryPoint,
  degrees: number,
  center: PlanimetryPoint = { x: 0, y: 0 },
): PlanimetryPoint {
  const source = assertPoint(point, 'Точка');
  const pivot = assertPoint(center, 'Центр поворота');
  const radians = toRadians(parseDegrees(degrees, 'Угол поворота'));
  const dx = source.x - pivot.x;
  const dy = source.y - pivot.y;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
}

/**
 * Продолжение отрезка за вторую точку на заданное расстояние.
 * Нужно, чтобы честно построить внешний угол треугольника.
 */
export function extendSegment(from: PlanimetryPoint, through: PlanimetryPoint, extra: number): PlanimetryPoint {
  const start = assertPoint(from, 'Начальная точка');
  const end = assertPoint(through, 'Вторая точка');
  const length = assertPositiveLength(extra, 'Длина продолжения');
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) throw new RangeError('Точки отрезка не должны совпадать');
  return { x: end.x + (dx / distance) * length, y: end.y + (dy / distance) * length };
}
