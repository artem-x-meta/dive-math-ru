/**
 * Ядро главы «Пространство» (10 класс).
 *
 * Все функции чистые. Точка и вектор описываются тремя координатами; прямая
 * задаётся точкой и направляющим вектором, плоскость — точкой и вектором
 * нормали. Классификация пар прямых опирается на смешанное произведение, а не
 * на вид рисунка, поэтому «скрещивающиеся» здесь — вычисленный факт.
 *
 * Изображение строится честной параллельной (аксонометрической) проекцией:
 * экранные координаты получаются скалярным умножением точки на два
 * ортонормированных вектора картинной плоскости.
 */
import { formatNumber, roundTo } from './vectors';

export { formatNumber, roundTo };

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Точка и вектор описываются одной тройкой чисел, но смысл разный. */
export type Point3 = Vec3;

/** Прямая: точка на ней и ненулевой направляющий вектор. */
export interface Line3 {
  readonly point: Point3;
  readonly direction: Vec3;
}

/** Плоскость: точка на ней и ненулевой вектор нормали. */
export interface Plane3 {
  readonly point: Point3;
  readonly normal: Vec3;
}

/** Взаимное расположение двух прямых в пространстве. */
export type LinePairKind = 'coincident' | 'parallel' | 'intersecting' | 'skew';

/** Взаимное расположение прямой и плоскости. */
export type LinePlaneKind = 'inside' | 'parallel' | 'intersecting';

/** Взаимное расположение двух плоскостей. */
export type PlanePairKind = 'coincident' | 'parallel' | 'intersecting';

export const LINE_PAIR_LABELS: Readonly<Record<LinePairKind, string>> = {
  coincident: 'совпадающие',
  parallel: 'параллельные',
  intersecting: 'пересекающиеся',
  skew: 'скрещивающиеся',
};

export const LINE_PLANE_LABELS: Readonly<Record<LinePlaneKind, string>> = {
  inside: 'прямая лежит в плоскости',
  parallel: 'прямая параллельна плоскости',
  intersecting: 'прямая пересекает плоскость',
};

const EPSILON = 1e-9;

function assertFinite(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} должно быть конечным числом`);
  }
}

function assertPoint(value: Vec3, label: string): Vec3 {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} должно задаваться тремя координатами`);
  }
  assertFinite(value.x, `Координата x (${label})`);
  assertFinite(value.y, `Координата y (${label})`);
  assertFinite(value.z, `Координата z (${label})`);
  return value;
}

/** Убирает минус-ноль, чтобы сравнения и вывод были предсказуемыми. */
function zeroSafe(value: number): number {
  return value === 0 ? 0 : value;
}

/** Сравнение с нулём с поправкой на масштаб данных. */
function negligible(value: number, scale = 1): boolean {
  return Math.abs(value) <= EPSILON * Math.max(1, Math.abs(scale));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function clampCosine(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function vec3(x: number, y: number, z: number): Vec3 {
  assertFinite(x, 'Координата x');
  assertFinite(y, 'Координата y');
  assertFinite(z, 'Координата z');
  return { x: zeroSafe(x), y: zeroSafe(y), z: zeroSafe(z) };
}

/** То же, что vec3: имя подчёркивает, что тройка задаёт положение точки. */
export function point3(x: number, y: number, z: number): Point3 {
  return vec3(x, y, z);
}

export function addVec3(first: Vec3, second: Vec3): Vec3 {
  assertPoint(first, 'первое слагаемое');
  assertPoint(second, 'второе слагаемое');
  return vec3(first.x + second.x, first.y + second.y, first.z + second.z);
}

/** Координаты вектора AB: из координат конца вычитаем координаты начала. */
export function subtractVec3(from: Vec3, subtracted: Vec3): Vec3 {
  assertPoint(from, 'уменьшаемое');
  assertPoint(subtracted, 'вычитаемое');
  return vec3(from.x - subtracted.x, from.y - subtracted.y, from.z - subtracted.z);
}

export function vectorBetween3(from: Point3, to: Point3): Vec3 {
  return subtractVec3(to, from);
}

export function scaleVec3(factor: number, vector: Vec3): Vec3 {
  assertFinite(factor, 'Множитель');
  assertPoint(vector, 'вектор');
  return vec3(factor * vector.x, factor * vector.y, factor * vector.z);
}

/** Скалярное произведение в координатах: x₁x₂ + y₁y₂ + z₁z₂. */
export function dot3(first: Vec3, second: Vec3): number {
  assertPoint(first, 'первый вектор');
  assertPoint(second, 'второй вектор');
  return zeroSafe(first.x * second.x + first.y * second.y + first.z * second.z);
}

/**
 * Векторное произведение. Ноль означает коллинеарность, а сам вектор
 * перпендикулярен обоим сомножителям — на этом держатся признаки главы.
 */
export function cross3(first: Vec3, second: Vec3): Vec3 {
  assertPoint(first, 'первый вектор');
  assertPoint(second, 'второй вектор');
  return vec3(
    first.y * second.z - first.z * second.y,
    first.z * second.x - first.x * second.z,
    first.x * second.y - first.y * second.x,
  );
}

/** Смешанное произведение: ноль означает, что три вектора лежат в одной плоскости. */
export function tripleProduct3(first: Vec3, second: Vec3, third: Vec3): number {
  return dot3(first, cross3(second, third));
}

export function squaredLength3(vector: Vec3): number {
  return dot3(vector, vector);
}

export function length3(vector: Vec3): number {
  return Math.sqrt(squaredLength3(vector));
}

export function isZeroVec3(vector: Vec3): boolean {
  assertPoint(vector, 'вектор');
  return vector.x === 0 && vector.y === 0 && vector.z === 0;
}

export function distance3(first: Point3, second: Point3): number {
  return length3(vectorBetween3(first, second));
}

export function midpoint3(first: Point3, second: Point3): Point3 {
  assertPoint(first, 'первая точка');
  assertPoint(second, 'вторая точка');
  return vec3((first.x + second.x) / 2, (first.y + second.y) / 2, (first.z + second.z) / 2);
}

export function areCollinear3(first: Vec3, second: Vec3): boolean {
  const product = cross3(first, second);
  return negligible(length3(product), length3(first) * length3(second));
}

export function arePerpendicular3(first: Vec3, second: Vec3): boolean {
  if (isZeroVec3(first) || isZeroVec3(second)) {
    throw new RangeError('Угол с нулевым вектором не определён');
  }
  return negligible(dot3(first, second), length3(first) * length3(second));
}

export function unitVec3(vector: Vec3): Vec3 {
  if (isZeroVec3(vector)) {
    throw new RangeError('У нулевого вектора нет направления');
  }
  return scaleVec3(1 / length3(vector), vector);
}

/** Угол между векторами в градусах, от 0 до 180. */
export function angleBetweenVectorsDegrees(first: Vec3, second: Vec3): number {
  if (isZeroVec3(first) || isZeroVec3(second)) {
    throw new RangeError('Угол с нулевым вектором не определён');
  }
  const cosine = clampCosine(dot3(first, second) / (length3(first) * length3(second)));
  return toDegrees(Math.acos(cosine));
}

/**
 * Угол между прямыми от 0° до 90°: у прямой нет направления, поэтому знак
 * скалярного произведения не важен и берётся его модуль.
 */
export function angleBetweenLinesDegrees(first: Vec3, second: Vec3): number {
  if (isZeroVec3(first) || isZeroVec3(second)) {
    throw new RangeError('Угол с нулевым вектором не определён');
  }
  const cosine = clampCosine(Math.abs(dot3(first, second)) / (length3(first) * length3(second)));
  return toDegrees(Math.acos(cosine));
}

export function line3(point: Point3, direction: Vec3): Line3 {
  assertPoint(point, 'точка прямой');
  assertPoint(direction, 'направляющий вектор');
  if (isZeroVec3(direction)) {
    throw new RangeError('Направляющий вектор прямой не может быть нулевым');
  }
  return { point: vec3(point.x, point.y, point.z), direction: vec3(direction.x, direction.y, direction.z) };
}

/** Прямая через две различные точки. */
export function lineThroughPoints3(first: Point3, second: Point3): Line3 {
  const direction = vectorBetween3(first, second);
  if (isZeroVec3(direction)) {
    throw new RangeError('Через совпадающие точки проходит бесконечно много прямых');
  }
  return line3(first, direction);
}

export function plane3(point: Point3, normal: Vec3): Plane3 {
  assertPoint(point, 'точка плоскости');
  assertPoint(normal, 'вектор нормали');
  if (isZeroVec3(normal)) {
    throw new RangeError('Вектор нормали плоскости не может быть нулевым');
  }
  return { point: vec3(point.x, point.y, point.z), normal: vec3(normal.x, normal.y, normal.z) };
}

/** Плоскость через три точки, не лежащие на одной прямой (аксиома A₁). */
export function planeThroughPoints3(first: Point3, second: Point3, third: Point3): Plane3 {
  const normal = cross3(vectorBetween3(first, second), vectorBetween3(first, third));
  if (negligible(length3(normal), distance3(first, second) * distance3(first, third))) {
    throw new RangeError('Через три точки одной прямой проходит бесконечно много плоскостей');
  }
  return plane3(first, normal);
}

export function planeContainsPoint(plane: Plane3, point: Point3): boolean {
  const model = plane3(plane.point, plane.normal);
  assertPoint(point, 'точка');
  const shift = vectorBetween3(model.point, point);
  return negligible(dot3(shift, model.normal), length3(shift) * length3(model.normal));
}

export function lineContainsPoint(line: Line3, point: Point3): boolean {
  const model = line3(line.point, line.direction);
  assertPoint(point, 'точка');
  return areCollinear3(vectorBetween3(model.point, point), model.direction);
}

/**
 * Классификация пары прямых. Если направляющие векторы коллинеарны, прямые
 * совпадают или параллельны. Иначе решает смешанное произведение: ноль —
 * прямые лежат в одной плоскости и пересекаются, не ноль — скрещиваются.
 */
export function classifyLines(first: Line3, second: Line3): LinePairKind {
  const left = line3(first.point, first.direction);
  const right = line3(second.point, second.direction);
  const between = vectorBetween3(left.point, right.point);

  if (areCollinear3(left.direction, right.direction)) {
    return isZeroVec3(between) || areCollinear3(between, left.direction) ? 'coincident' : 'parallel';
  }

  const mixed = tripleProduct3(between, left.direction, right.direction);
  const scale = length3(between) * length3(left.direction) * length3(right.direction);
  return negligible(mixed, scale) ? 'intersecting' : 'skew';
}

export function classifyLinePlane(line: Line3, plane: Plane3): LinePlaneKind {
  const model = line3(line.point, line.direction);
  const surface = plane3(plane.point, plane.normal);
  const parallelToPlane = negligible(
    dot3(model.direction, surface.normal),
    length3(model.direction) * length3(surface.normal),
  );
  if (!parallelToPlane) return 'intersecting';
  return planeContainsPoint(surface, model.point) ? 'inside' : 'parallel';
}

export function classifyPlanes(first: Plane3, second: Plane3): PlanePairKind {
  const left = plane3(first.point, first.normal);
  const right = plane3(second.point, second.normal);
  if (!areCollinear3(left.normal, right.normal)) return 'intersecting';
  return planeContainsPoint(left, right.point) ? 'coincident' : 'parallel';
}

export function arePlanesParallel(first: Plane3, second: Plane3): boolean {
  return classifyPlanes(first, second) === 'parallel';
}

/** Основание перпендикуляра, опущенного из точки на прямую. */
export function projectPointOntoLine(point: Point3, line: Line3): Point3 {
  const model = line3(line.point, line.direction);
  assertPoint(point, 'точка');
  const shift = vectorBetween3(model.point, point);
  const factor = dot3(shift, model.direction) / squaredLength3(model.direction);
  return addVec3(model.point, scaleVec3(factor, model.direction));
}

/** Основание перпендикуляра, опущенного из точки на плоскость: её проекция. */
export function projectPointOntoPlane(point: Point3, plane: Plane3): Point3 {
  const model = plane3(plane.point, plane.normal);
  assertPoint(point, 'точка');
  const shift = vectorBetween3(model.point, point);
  const factor = dot3(shift, model.normal) / squaredLength3(model.normal);
  return subtractVec3(point, scaleVec3(factor, model.normal));
}

export function distancePointLine(point: Point3, line: Line3): number {
  return distance3(point, projectPointOntoLine(point, line));
}

/** Расстояние от точки до плоскости — длина перпендикуляра, а не наклонной. */
export function distancePointPlane(point: Point3, plane: Plane3): number {
  const model = plane3(plane.point, plane.normal);
  assertPoint(point, 'точка');
  return Math.abs(dot3(vectorBetween3(model.point, point), model.normal)) / length3(model.normal);
}

/**
 * Расстояние между прямыми: для пересекающихся и совпадающих равно нулю, для
 * параллельных — длине перпендикуляра, для скрещивающихся — длине их общего
 * перпендикуляра.
 */
export function distanceBetweenLines(first: Line3, second: Line3): number {
  const left = line3(first.point, first.direction);
  const right = line3(second.point, second.direction);
  const kind = classifyLines(left, right);
  if (kind === 'coincident' || kind === 'intersecting') return 0;
  if (kind === 'parallel') return distancePointLine(right.point, left);
  const normal = cross3(left.direction, right.direction);
  return Math.abs(dot3(vectorBetween3(left.point, right.point), normal)) / length3(normal);
}

/** Расстояние от прямой до параллельной ей плоскости. */
export function distanceLinePlane(line: Line3, plane: Plane3): number {
  return classifyLinePlane(line, plane) === 'parallel' ? distancePointPlane(line.point, plane) : 0;
}

/** Расстояние между параллельными плоскостями. */
export function distanceBetweenPlanes(first: Plane3, second: Plane3): number {
  return classifyPlanes(first, second) === 'parallel' ? distancePointPlane(second.point, first) : 0;
}

/** Угол между прямой и плоскостью от 0° до 90°: угол между прямой и её проекцией. */
export function angleLinePlaneDegrees(line: Line3, plane: Plane3): number {
  const model = line3(line.point, line.direction);
  const surface = plane3(plane.point, plane.normal);
  const sine = clampCosine(
    Math.abs(dot3(model.direction, surface.normal)) / (length3(model.direction) * length3(surface.normal)),
  );
  return toDegrees(Math.asin(sine));
}

/** Угол между плоскостями от 0° до 90° — угол между их нормалями без учёта направления. */
export function angleBetweenPlanesDegrees(first: Plane3, second: Plane3): number {
  return angleBetweenLinesDegrees(plane3(first.point, first.normal).normal, plane3(second.point, second.normal).normal);
}

/** Длина наклонной по перпендикуляру и проекции: теорема Пифагора в пространстве. */
export function slantLength(perpendicular: number, projection: number): number {
  assertFinite(perpendicular, 'Длина перпендикуляра');
  assertFinite(projection, 'Длина проекции');
  if (perpendicular <= 0) throw new RangeError('Длина перпендикуляра должна быть положительной');
  if (projection < 0) throw new RangeError('Длина проекции не может быть отрицательной');
  return Math.hypot(perpendicular, projection);
}

/** Длина проекции наклонной: наклонная всегда длиннее перпендикуляра. */
export function slantProjection(slant: number, perpendicular: number): number {
  assertFinite(slant, 'Длина наклонной');
  assertFinite(perpendicular, 'Длина перпендикуляра');
  if (perpendicular <= 0) throw new RangeError('Длина перпендикуляра должна быть положительной');
  if (slant < perpendicular) throw new RangeError('Наклонная не может быть короче перпендикуляра');
  return Math.sqrt(slant * slant - perpendicular * perpendicular);
}

/** Угол между наклонной и плоскостью по перпендикуляру и проекции. */
export function slantAngleDegrees(perpendicular: number, projection: number): number {
  assertFinite(perpendicular, 'Длина перпендикуляра');
  assertFinite(projection, 'Длина проекции');
  if (perpendicular <= 0) throw new RangeError('Длина перпендикуляра должна быть положительной');
  if (projection < 0) throw new RangeError('Длина проекции не может быть отрицательной');
  return toDegrees(Math.atan2(perpendicular, projection));
}

/**
 * Машинная проверка теоремы о трёх перпендикулярах. Точка apex лежит вне
 * плоскости, base — основание наклонной в плоскости, а line — прямая этой же
 * плоскости. Оба поля результата всегда совпадают: прямая перпендикулярна
 * наклонной тогда и только тогда, когда она перпендикулярна её проекции.
 */
export function threePerpendicularsCheck(
  plane: Plane3,
  apex: Point3,
  base: Point3,
  line: Line3,
): { readonly slantPerpendicular: boolean; readonly projectionPerpendicular: boolean } {
  const surface = plane3(plane.point, plane.normal);
  const inPlaneLine = line3(line.point, line.direction);
  if (planeContainsPoint(surface, apex)) {
    throw new RangeError('Наклонная проводится из точки вне плоскости');
  }
  if (!planeContainsPoint(surface, base)) {
    throw new RangeError('Основание наклонной должно лежать в плоскости');
  }
  if (classifyLinePlane(inPlaneLine, surface) !== 'inside') {
    throw new RangeError('Прямая должна лежать в этой же плоскости');
  }
  const foot = projectPointOntoPlane(apex, surface);
  const slant = vectorBetween3(base, apex);
  const projection = vectorBetween3(base, foot);
  const scale = length3(inPlaneLine.direction);
  return {
    slantPerpendicular: negligible(dot3(slant, inPlaneLine.direction), length3(slant) * scale),
    projectionPerpendicular: isZeroVec3(projection)
      || negligible(dot3(projection, inPlaneLine.direction), length3(projection) * scale),
  };
}

export type CubeVertexName = 'A' | 'B' | 'C' | 'D' | 'A1' | 'B1' | 'C1' | 'D1';

export type CubeEdgeId =
  | 'AB' | 'BC' | 'CD' | 'DA'
  | 'A1B1' | 'B1C1' | 'C1D1' | 'D1A1'
  | 'AA1' | 'BB1' | 'CC1' | 'DD1';

export interface CubeEdge {
  readonly id: CubeEdgeId;
  readonly from: CubeVertexName;
  readonly to: CubeVertexName;
}

export const CUBE_VERTEX_NAMES: readonly CubeVertexName[] = ['A', 'B', 'C', 'D', 'A1', 'B1', 'C1', 'D1'];

const UNIT_CUBE: Readonly<Record<CubeVertexName, Vec3>> = {
  A: { x: 0, y: 0, z: 0 },
  B: { x: 1, y: 0, z: 0 },
  C: { x: 1, y: 1, z: 0 },
  D: { x: 0, y: 1, z: 0 },
  A1: { x: 0, y: 0, z: 1 },
  B1: { x: 1, y: 0, z: 1 },
  C1: { x: 1, y: 1, z: 1 },
  D1: { x: 0, y: 1, z: 1 },
};

export const CUBE_EDGES: readonly CubeEdge[] = [
  { id: 'AB', from: 'A', to: 'B' },
  { id: 'BC', from: 'B', to: 'C' },
  { id: 'CD', from: 'C', to: 'D' },
  { id: 'DA', from: 'D', to: 'A' },
  { id: 'A1B1', from: 'A1', to: 'B1' },
  { id: 'B1C1', from: 'B1', to: 'C1' },
  { id: 'C1D1', from: 'C1', to: 'D1' },
  { id: 'D1A1', from: 'D1', to: 'A1' },
  { id: 'AA1', from: 'A', to: 'A1' },
  { id: 'BB1', from: 'B', to: 'B1' },
  { id: 'CC1', from: 'C', to: 'C1' },
  { id: 'DD1', from: 'D', to: 'D1' },
];

/** Русская запись вершины с нижним индексом: A1 → A₁. */
export function formatVertexName(name: CubeVertexName): string {
  if (!CUBE_VERTEX_NAMES.includes(name)) {
    throw new RangeError(`Неизвестная вершина куба: ${String(name)}`);
  }
  return name.replace('1', '₁');
}

export function findCubeEdge(id: CubeEdgeId): CubeEdge {
  const edge = CUBE_EDGES.find((item) => item.id === id);
  if (!edge) throw new RangeError(`Неизвестное ребро куба: ${String(id)}`);
  return edge;
}

/** Подпись ребра: A1B1 → A₁B₁. */
export function formatEdgeId(id: CubeEdgeId): string {
  const edge = findCubeEdge(id);
  return `${formatVertexName(edge.from)}${formatVertexName(edge.to)}`;
}

function assertCubeSize(size: number): number {
  assertFinite(size, 'Ребро куба');
  if (size <= 0) throw new RangeError('Ребро куба должно быть положительным');
  return size;
}

export function cubeVertex(name: CubeVertexName, size = 1): Point3 {
  if (!CUBE_VERTEX_NAMES.includes(name)) {
    throw new RangeError(`Неизвестная вершина куба: ${String(name)}`);
  }
  return scaleVec3(assertCubeSize(size), UNIT_CUBE[name]);
}

export function cubeVertices(size = 1): Readonly<Record<CubeVertexName, Point3>> {
  const edge = assertCubeSize(size);
  return Object.fromEntries(
    CUBE_VERTEX_NAMES.map((name) => [name, cubeVertex(name, edge)]),
  ) as Record<CubeVertexName, Point3>;
}

export function cubeEdgeSegment(id: CubeEdgeId, size = 1): { readonly from: Point3; readonly to: Point3 } {
  const edge = findCubeEdge(id);
  return { from: cubeVertex(edge.from, size), to: cubeVertex(edge.to, size) };
}

export function cubeEdgeLine(id: CubeEdgeId, size = 1): Line3 {
  const segment = cubeEdgeSegment(id, size);
  return lineThroughPoints3(segment.from, segment.to);
}

/** Взаимное расположение двух рёбер куба; от длины ребра не зависит. */
export function classifyCubeEdges(first: CubeEdgeId, second: CubeEdgeId): LinePairKind {
  if (first === second) return 'coincident';
  return classifyLines(cubeEdgeLine(first), cubeEdgeLine(second));
}

/** Угол между прямыми, содержащими два ребра куба, в градусах. */
export function cubeEdgeAngleDegrees(first: CubeEdgeId, second: CubeEdgeId): number {
  return angleBetweenLinesDegrees(cubeEdgeLine(first).direction, cubeEdgeLine(second).direction);
}

/** Расстояние между прямыми, содержащими два ребра куба. */
export function cubeEdgeDistance(first: CubeEdgeId, second: CubeEdgeId, size = 1): number {
  if (first === second) return 0;
  return distanceBetweenLines(cubeEdgeLine(first, size), cubeEdgeLine(second, size));
}

/** Общая вершина двух рёбер, если она есть: именно в ней рёбра пересекаются. */
export function commonCubeVertex(first: CubeEdgeId, second: CubeEdgeId): CubeVertexName | null {
  const left = findCubeEdge(first);
  const right = findCubeEdge(second);
  if (left.id === right.id) return null;
  const shared = [left.from, left.to].filter((name) => name === right.from || name === right.to);
  return shared.length === 1 ? shared[0]! : null;
}

/** Сколько среди 66 пар рёбер куба параллельных, пересекающихся и скрещивающихся. */
export function cubeEdgePairCounts(): Readonly<Record<LinePairKind, number>> {
  const counts: Record<LinePairKind, number> = { coincident: 0, parallel: 0, intersecting: 0, skew: 0 };
  for (let i = 0; i < CUBE_EDGES.length; i += 1) {
    for (let j = i + 1; j < CUBE_EDGES.length; j += 1) {
      counts[classifyCubeEdges(CUBE_EDGES[i]!.id, CUBE_EDGES[j]!.id)] += 1;
    }
  }
  return counts;
}

/** Углы наблюдения: поворот вокруг вертикали и подъём над горизонтом. */
export interface ViewAngles {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** Вид по умолчанию: привычная школьная картинка куба со скрытой вершиной D. */
export const DEFAULT_VIEW: ViewAngles = { azimuthDegrees: -35, elevationDegrees: 28 };

/**
 * Классическая изометрия: взгляд вдоль диагонали куба. Три ребра, выходящие из
 * одной вершины, дают на рисунке равные отрезки под углами 120°.
 */
export const ISOMETRIC_VIEW: ViewAngles = {
  azimuthDegrees: 45,
  elevationDegrees: toDegrees(Math.atan(Math.SQRT1_2)),
};

function assertView(view: ViewAngles): ViewAngles {
  if (view === null || typeof view !== 'object') {
    throw new TypeError('Направление взгляда задаётся двумя углами');
  }
  assertFinite(view.azimuthDegrees, 'Угол поворота');
  assertFinite(view.elevationDegrees, 'Угол подъёма');
  if (view.elevationDegrees <= -90 || view.elevationDegrees >= 90) {
    throw new RangeError('Угол подъёма должен быть строго между −90° и 90°');
  }
  return view;
}

/** Направление на наблюдателя: единичный вектор от тела к глазу. */
export function cameraDirection(view: ViewAngles = DEFAULT_VIEW): Vec3 {
  const { azimuthDegrees, elevationDegrees } = assertView(view);
  const azimuth = toRadians(azimuthDegrees);
  const elevation = toRadians(elevationDegrees);
  return vec3(
    Math.cos(elevation) * Math.cos(azimuth),
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
  );
}

/** Ортонормированная пара векторов картинной плоскости: «вправо» и «вверх». */
export function viewBasis(view: ViewAngles = DEFAULT_VIEW): { readonly right: Vec3; readonly up: Vec3 } {
  const { azimuthDegrees, elevationDegrees } = assertView(view);
  const azimuth = toRadians(azimuthDegrees);
  const elevation = toRadians(elevationDegrees);
  return {
    right: vec3(-Math.sin(azimuth), Math.cos(azimuth), 0),
    up: vec3(
      -Math.cos(azimuth) * Math.sin(elevation),
      -Math.sin(azimuth) * Math.sin(elevation),
      Math.cos(elevation),
    ),
  };
}

/**
 * Параллельная проекция точки на картинную плоскость. Ось y результата
 * направлена вверх, как в математике; переворот под систему координат SVG
 * делает уже компонент.
 */
export function projectAxonometric(point: Point3, view: ViewAngles = DEFAULT_VIEW): ScreenPoint {
  assertPoint(point, 'точка');
  const { right, up } = viewBasis(view);
  return { x: dot3(point, right), y: dot3(point, up) };
}

/** Самая дальняя от наблюдателя вершина куба: её рёбра рисуют штриховыми. */
export function hiddenCubeVertex(view: ViewAngles = DEFAULT_VIEW): CubeVertexName {
  const direction = cameraDirection(view);
  let hidden: CubeVertexName = 'A';
  let smallest = Number.POSITIVE_INFINITY;
  for (const name of CUBE_VERTEX_NAMES) {
    const value = dot3(UNIT_CUBE[name], direction);
    if (value < smallest - EPSILON) {
      smallest = value;
      hidden = name;
    }
  }
  return hidden;
}

/** Ребро невидимо, если упирается в самую дальнюю вершину. */
export function isCubeEdgeHidden(id: CubeEdgeId, view: ViewAngles = DEFAULT_VIEW): boolean {
  const edge = findCubeEdge(id);
  const hidden = hiddenCubeVertex(view);
  return edge.from === hidden || edge.to === hidden;
}
