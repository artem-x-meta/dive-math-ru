/**
 * Ядро главы «Векторы в пространстве» (11 класс).
 *
 * Модуль ничего не изобретает заново: тройки координат, действия с векторами,
 * плоскость «точка + нормаль», расстояния, углы и честная параллельная
 * (аксонометрическая) проекция уже реализованы в `stereometry.ts`, а запись
 * чисел по-русски — в `vectors.ts`. Здесь добавлено только то, чего там нет:
 *
 * - именованные узлы прямоугольного параллелепипеда (вершины, середины рёбер,
 *   центры граней, центр тела) — общий словарь для уроков и лабораторий;
 * - общее уравнение плоскости `ax + by + cz + d = 0` и переход к нормали;
 * - разложение вектора по произвольному базису (правило Крамера);
 * - координаты правильной треугольной призмы.
 *
 * Все функции чистые. Для целых координат скалярное произведение, векторное
 * произведение и коэффициенты уравнения плоскости остаются точными целыми.
 */
import {
  CUBE_EDGES,
  CUBE_VERTEX_NAMES,
  DEFAULT_VIEW,
  ISOMETRIC_VIEW,
  type CubeEdge,
  type CubeEdgeId,
  type CubeVertexName,
  type Line3,
  type Plane3,
  type Point3,
  type ScreenPoint,
  type Vec3,
  type ViewAngles,
  addVec3,
  angleBetweenLinesDegrees,
  angleBetweenPlanesDegrees,
  angleBetweenVectorsDegrees,
  angleLinePlaneDegrees,
  areCollinear3,
  arePerpendicular3,
  cameraDirection,
  cross3,
  cubeEdgeSegment,
  cubeVertex,
  distance3,
  distanceBetweenLines,
  distancePointLine,
  distancePointPlane,
  dot3,
  formatEdgeId,
  formatNumber,
  formatVertexName,
  isCubeEdgeHidden,
  isZeroVec3,
  length3,
  line3,
  lineThroughPoints3,
  midpoint3,
  plane3,
  planeThroughPoints3,
  point3,
  projectAxonometric,
  projectPointOntoPlane,
  roundTo,
  scaleVec3,
  squaredLength3,
  subtractVec3,
  tripleProduct3,
  unitVec3,
  vec3,
  vectorBetween3,
} from './stereometry';

export {
  CUBE_EDGES,
  CUBE_VERTEX_NAMES,
  DEFAULT_VIEW,
  ISOMETRIC_VIEW,
  addVec3,
  angleBetweenLinesDegrees,
  angleBetweenPlanesDegrees,
  angleBetweenVectorsDegrees,
  angleLinePlaneDegrees,
  areCollinear3,
  arePerpendicular3,
  cameraDirection,
  cross3,
  distance3,
  distanceBetweenLines,
  distancePointLine,
  distancePointPlane,
  dot3,
  formatEdgeId,
  formatNumber,
  formatVertexName,
  isCubeEdgeHidden,
  isZeroVec3,
  length3,
  line3,
  lineThroughPoints3,
  midpoint3,
  plane3,
  planeThroughPoints3,
  point3,
  projectAxonometric,
  projectPointOntoPlane,
  roundTo,
  scaleVec3,
  squaredLength3,
  subtractVec3,
  tripleProduct3,
  unitVec3,
  vec3,
  vectorBetween3,
};

export type {
  CubeEdge,
  CubeEdgeId,
  CubeVertexName,
  Line3,
  Plane3,
  Point3,
  ScreenPoint,
  Vec3,
  ViewAngles,
};

const EPSILON = 1e-9;

function assertFiniteNumber(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} должно быть конечным числом`);
  }
}

/** Сравнение с нулём с поправкой на масштаб данных. */
function negligible(value: number, scale = 1): boolean {
  return Math.abs(value) <= EPSILON * Math.max(1, Math.abs(scale));
}

function zeroSafe(value: number): number {
  return value === 0 ? 0 : value;
}

function gcd(first: number, second: number): number {
  let left = Math.abs(first);
  let right = Math.abs(second);
  while (right > 0) {
    [left, right] = [right, left % right];
  }
  return left;
}

/** Приписной индекс в названиях: A1B1C1D1 → A₁B₁C₁D₁. */
export function subscriptName(text: string): string {
  if (typeof text !== 'string') {
    throw new TypeError('Название должно быть строкой');
  }
  return text.replace(/1/g, '₁');
}

/** Размеры прямоугольного параллелепипеда вдоль рёбер AB, AD и AA₁. */
export interface BoxDims {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

/** Единичный куб — частный случай параллелепипеда. */
export const UNIT_BOX: BoxDims = { a: 1, b: 1, c: 1 };

export function boxDims(a: number, b: number, c: number): BoxDims {
  assertFiniteNumber(a, 'Ребро AB');
  assertFiniteNumber(b, 'Ребро AD');
  assertFiniteNumber(c, 'Ребро AA₁');
  if (a <= 0 || b <= 0 || c <= 0) {
    throw new RangeError('Рёбра параллелепипеда должны быть положительными');
  }
  return { a, b, c };
}

/** Куб с заданным ребром. */
export function cubeDims(edge: number): BoxDims {
  return boxDims(edge, edge, edge);
}

function assertDims(dims: BoxDims): BoxDims {
  if (dims === null || typeof dims !== 'object') {
    throw new TypeError('Размеры параллелепипеда задаются тремя рёбрами');
  }
  return boxDims(dims.a, dims.b, dims.c);
}

/** Длина диагонали параллелепипеда: √(a² + b² + c²). */
export function boxDiagonalLength(dims: BoxDims): number {
  const { a, b, c } = assertDims(dims);
  return Math.sqrt(a * a + b * b + c * c);
}

/** Грань параллелепипеда: обход вершин и внешняя нормаль. */
export interface BoxFace {
  readonly id: string;
  readonly loop: readonly CubeVertexName[];
  readonly outward: Vec3;
}

export const BOX_FACES: readonly BoxFace[] = [
  { id: 'ABCD', loop: ['A', 'B', 'C', 'D'], outward: { x: 0, y: 0, z: -1 } },
  { id: 'A1B1C1D1', loop: ['A1', 'B1', 'C1', 'D1'], outward: { x: 0, y: 0, z: 1 } },
  { id: 'ABB1A1', loop: ['A', 'B', 'B1', 'A1'], outward: { x: 0, y: -1, z: 0 } },
  { id: 'DCC1D1', loop: ['D', 'C', 'C1', 'D1'], outward: { x: 0, y: 1, z: 0 } },
  { id: 'ADD1A1', loop: ['A', 'D', 'D1', 'A1'], outward: { x: -1, y: 0, z: 0 } },
  { id: 'BCC1B1', loop: ['B', 'C', 'C1', 'B1'], outward: { x: 1, y: 0, z: 0 } },
];

export type BoxNodeGroup = 'vertex' | 'edge' | 'face' | 'center';

export const BOX_NODE_GROUP_LABELS: Readonly<Record<BoxNodeGroup, string>> = {
  vertex: 'Вершины',
  edge: 'Середины рёбер',
  face: 'Центры граней',
  center: 'Центр тела',
};

/**
 * Именованная точка тела: `id` — для интерфейса, `label` — короткая подпись на
 * чертеже, `title` — полное название для списка и для экранного диктора,
 * `unit` — координаты в единичном кубе.
 */
export interface BoxNode {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly group: BoxNodeGroup;
  readonly unit: Vec3;
}

function averagePoint(points: readonly Point3[]): Point3 {
  const sum = points.reduce((total, item) => addVec3(total, item), vec3(0, 0, 0));
  return scaleVec3(1 / points.length, sum);
}

export const BOX_NODES: readonly BoxNode[] = [
  ...CUBE_VERTEX_NAMES.map((name): BoxNode => ({
    id: name,
    label: formatVertexName(name),
    title: `вершина ${formatVertexName(name)}`,
    group: 'vertex',
    unit: cubeVertex(name, 1),
  })),
  ...CUBE_EDGES.map((edge): BoxNode => {
    const segment = cubeEdgeSegment(edge.id, 1);
    return {
      id: `M-${edge.id}`,
      label: `M(${formatEdgeId(edge.id)})`,
      title: `середина ребра ${formatEdgeId(edge.id)}`,
      group: 'edge',
      unit: midpoint3(segment.from, segment.to),
    };
  }),
  ...BOX_FACES.map((face): BoxNode => ({
    id: `O-${face.id}`,
    label: `O(${subscriptName(face.id)})`,
    title: `центр грани ${subscriptName(face.id)}`,
    group: 'face',
    unit: averagePoint(face.loop.map((name) => cubeVertex(name, 1))),
  })),
  { id: 'O', label: 'O', title: 'центр тела', group: 'center', unit: vec3(0.5, 0.5, 0.5) },
];

const NODE_BY_ID = new Map(BOX_NODES.map((node) => [node.id, node]));

export function boxNode(id: string): BoxNode {
  const node = NODE_BY_ID.get(id);
  if (!node) throw new RangeError(`Неизвестная точка тела: ${String(id)}`);
  return node;
}

/** Координаты именованной точки в параллелепипеде с началом в вершине A. */
export function boxPoint(id: string, dims: BoxDims = UNIT_BOX): Point3 {
  const { unit } = boxNode(id);
  const { a, b, c } = assertDims(dims);
  return vec3(unit.x * a, unit.y * b, unit.z * c);
}

/** Вектор между двумя именованными точками тела. */
export function boxVector(fromId: string, toId: string, dims: BoxDims = UNIT_BOX): Vec3 {
  return vectorBetween3(boxPoint(fromId, dims), boxPoint(toId, dims));
}

/** Подпись отрезка по двум узлам: A и C1 дают «AC₁». */
export function boxSegmentName(fromId: string, toId: string): string {
  return `${boxNode(fromId).label}${boxNode(toId).label}`;
}

/** Косинус угла между ненулевыми векторами, зажатый в отрезок [−1; 1]. */
export function cosineBetween3(first: Vec3, second: Vec3): number {
  if (isZeroVec3(first) || isZeroVec3(second)) {
    throw new RangeError('Угол с нулевым вектором не определён');
  }
  const value = dot3(first, second) / (length3(first) * length3(second));
  return Math.max(-1, Math.min(1, value));
}

/** Проекция вектора на направление другого вектора: со знаком, как на оси. */
export function projectionLength3(vector: Vec3, onto: Vec3): number {
  if (isZeroVec3(onto)) {
    throw new RangeError('Проекция на нулевой вектор не определена');
  }
  return dot3(vector, onto) / length3(onto);
}

/** Три вектора компланарны, когда их смешанное произведение равно нулю. */
export function areCoplanar3(first: Vec3, second: Vec3, third: Vec3): boolean {
  const scale = length3(first) * length3(second) * length3(third);
  return negligible(tripleProduct3(first, second, third), scale);
}

/** Базис пространства образуют ровно три некомпланарных вектора. */
export function isBasis3(first: Vec3, second: Vec3, third: Vec3): boolean {
  if (isZeroVec3(first) || isZeroVec3(second) || isZeroVec3(third)) return false;
  return !areCoplanar3(first, second, third);
}

/**
 * Разложение вектора по базису: коэффициенты x, y, z в записи
 * `vector = x·first + y·second + z·third`. Считаются правилом Крамера через
 * смешанные произведения, поэтому для целых координат ответ точен.
 */
export function decomposeByBasis(vector: Vec3, first: Vec3, second: Vec3, third: Vec3): Vec3 {
  if (!isBasis3(first, second, third)) {
    throw new RangeError('Компланарные векторы не образуют базис пространства');
  }
  const denominator = tripleProduct3(first, second, third);
  return vec3(
    tripleProduct3(vector, second, third) / denominator,
    tripleProduct3(first, vector, third) / denominator,
    tripleProduct3(first, second, vector) / denominator,
  );
}

/** Общее уравнение плоскости: a·x + b·y + c·z + d = 0, где (a; b; c) — нормаль. */
export interface PlaneEquation {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

/**
 * Каноническая запись уравнения: целые коэффициенты делятся на наибольший общий
 * делитель, а знак выбирается так, чтобы первый ненулевой коэффициент нормали
 * был положительным. Уравнение задаёт ту же плоскость.
 */
export function normalizePlaneEquation(equation: PlaneEquation): PlaneEquation {
  if (equation === null || typeof equation !== 'object') {
    throw new TypeError('Уравнение плоскости задаётся четырьмя коэффициентами');
  }
  const a = roundTo(equation.a, 9);
  const b = roundTo(equation.b, 9);
  const c = roundTo(equation.c, 9);
  const d = roundTo(equation.d, 9);
  assertFiniteNumber(a, 'Коэффициент a');
  assertFiniteNumber(b, 'Коэффициент b');
  assertFiniteNumber(c, 'Коэффициент c');
  assertFiniteNumber(d, 'Коэффициент d');
  if (a === 0 && b === 0 && c === 0) {
    throw new RangeError('Коэффициенты a, b и c не могут быть нулевыми одновременно');
  }

  let [scaledA, scaledB, scaledC, scaledD] = [a, b, c, d];
  if ([a, b, c, d].every((value) => Number.isInteger(value))) {
    const divisor = gcd(gcd(gcd(a, b), c), d) || 1;
    scaledA = a / divisor;
    scaledB = b / divisor;
    scaledC = c / divisor;
    scaledD = d / divisor;
  }

  const leading = scaledA !== 0 ? scaledA : scaledB !== 0 ? scaledB : scaledC;
  const sign = leading < 0 ? -1 : 1;
  return {
    a: zeroSafe(scaledA * sign),
    b: zeroSafe(scaledB * sign),
    c: zeroSafe(scaledC * sign),
    d: zeroSafe(scaledD * sign),
  };
}

export function planeEquation(a: number, b: number, c: number, d: number): PlaneEquation {
  return normalizePlaneEquation({ a, b, c, d });
}

/** Переход от записи «точка и нормаль» к общему уравнению. */
export function planeEquationOf(plane: Plane3): PlaneEquation {
  const model = plane3(plane.point, plane.normal);
  return normalizePlaneEquation({
    a: model.normal.x,
    b: model.normal.y,
    c: model.normal.z,
    d: -dot3(model.normal, model.point),
  });
}

/** Уравнение плоскости через три точки, не лежащие на одной прямой. */
export function planeEquationThroughPoints(first: Point3, second: Point3, third: Point3): PlaneEquation {
  return planeEquationOf(planeThroughPoints3(first, second, third));
}

/** Обратный переход: по уравнению строим точку плоскости и её нормаль. */
export function planeFromEquation(equation: PlaneEquation): Plane3 {
  const { a, b, c, d } = normalizePlaneEquation(equation);
  const normal = vec3(a, b, c);
  const base = scaleVec3(-d / squaredLength3(normal), normal);
  return plane3(base, normal);
}

/** Вектор нормали плоскости — это тройка коэффициентов (a; b; c). */
export function planeNormal(equation: PlaneEquation): Vec3 {
  const { a, b, c } = normalizePlaneEquation(equation);
  return vec3(a, b, c);
}

/** Значение левой части уравнения в точке: ноль означает, что точка лежит в плоскости. */
export function planeEquationValue(equation: PlaneEquation, point: Point3): number {
  const { a, b, c, d } = normalizePlaneEquation(equation);
  return zeroSafe(a * point.x + b * point.y + c * point.z + d);
}

export function pointOnPlaneEquation(equation: PlaneEquation, point: Point3): boolean {
  const normal = planeNormal(equation);
  return negligible(planeEquationValue(equation, point), length3(normal) * (1 + length3(point)));
}

/**
 * Расстояние от точки до плоскости: модуль левой части уравнения, делённый на
 * длину нормали. Деление обязательно — без него получится не расстояние.
 */
export function distanceToPlaneEquation(point: Point3, equation: PlaneEquation): number {
  const normal = planeNormal(equation);
  return Math.abs(planeEquationValue(equation, point)) / length3(normal);
}

/** Расстояние между параллельными плоскостями с общей нормалью. */
export function distanceBetweenPlaneEquations(first: PlaneEquation, second: PlaneEquation): number {
  const left = normalizePlaneEquation(first);
  const right = normalizePlaneEquation(second);
  if (!areCollinear3(planeNormal(left), planeNormal(right))) return 0;
  return distanceToPlaneEquation(planeFromEquation(right).point, left);
}

/** Запись вектора или точки в координатах: (2; 3; −6). */
export function formatVec3(vector: Vec3, digits = 2): string {
  if (vector === null || typeof vector !== 'object') {
    throw new TypeError('Вектор задаётся тремя координатами');
  }
  return `(${formatNumber(vector.x, digits)}; ${formatNumber(vector.y, digits)}; ${formatNumber(vector.z, digits)})`;
}

/** Запись общего уравнения плоскости без лишних единиц и плюс-минусов. */
export function formatPlaneEquation(equation: PlaneEquation, digits = 2): string {
  const { a, b, c, d } = normalizePlaneEquation(equation);
  let text = '';
  const append = (coefficient: number, name: string): void => {
    if (coefficient === 0) return;
    const size = Math.abs(coefficient);
    const body = `${size === 1 && name !== '' ? '' : formatNumber(size, digits)}${name}`;
    if (text === '') {
      text = `${coefficient < 0 ? '−' : ''}${body}`;
    } else {
      text += `${coefficient < 0 ? ' − ' : ' + '}${body}`;
    }
  };
  append(a, 'x');
  append(b, 'y');
  append(c, 'z');
  append(d, '');
  return `${text} = 0`;
}

/** Разложение вектора по базису словами: 2a + b − 3c. */
export function formatDecomposition(
  coefficients: Vec3,
  names: readonly [string, string, string] = ['a', 'b', 'c'],
  digits = 2,
): string {
  const parts: readonly [number, string][] = [
    [coefficients.x, names[0]],
    [coefficients.y, names[1]],
    [coefficients.z, names[2]],
  ];
  let text = '';
  for (const [value, name] of parts) {
    const rounded = roundTo(value, digits);
    if (rounded === 0) continue;
    const size = Math.abs(rounded);
    const body = `${size === 1 ? '' : formatNumber(size, digits)}${name}`;
    text += text === '' ? `${rounded < 0 ? '−' : ''}${body}` : `${rounded < 0 ? ' − ' : ' + '}${body}`;
  }
  return text === '' ? '0' : text;
}

export type PrismVertexName = 'A' | 'B' | 'C' | 'A1' | 'B1' | 'C1';

export const PRISM_VERTEX_NAMES: readonly PrismVertexName[] = ['A', 'B', 'C', 'A1', 'B1', 'C1'];

/** Правильная треугольная призма: сторона основания и боковое ребро. */
export interface PrismDims {
  readonly side: number;
  readonly height: number;
}

export function prismDims(side: number, height: number): PrismDims {
  assertFiniteNumber(side, 'Сторона основания');
  assertFiniteNumber(height, 'Боковое ребро');
  if (side <= 0 || height <= 0) {
    throw new RangeError('Сторона основания и боковое ребро должны быть положительными');
  }
  return { side, height };
}

/**
 * Координаты вершин правильной треугольной призмы ABCA₁B₁C₁: начало в вершине
 * A, ось Ox вдоль ребра AB, основание лежит в плоскости Oxy.
 */
export function regularPrismVertex(name: PrismVertexName, dims: PrismDims): Point3 {
  if (!PRISM_VERTEX_NAMES.includes(name)) {
    throw new RangeError(`Неизвестная вершина призмы: ${String(name)}`);
  }
  const { side, height } = prismDims(dims.side, dims.height);
  const base: Readonly<Record<'A' | 'B' | 'C', Point3>> = {
    A: point3(0, 0, 0),
    B: point3(side, 0, 0),
    C: point3(side / 2, (side * Math.sqrt(3)) / 2, 0),
  };
  const lower = base[name.replace('1', '') as 'A' | 'B' | 'C'];
  return name.endsWith('1') ? addVec3(lower, vec3(0, 0, height)) : lower;
}

export function regularPrismVertices(dims: PrismDims): Readonly<Record<PrismVertexName, Point3>> {
  return Object.fromEntries(
    PRISM_VERTEX_NAMES.map((name) => [name, regularPrismVertex(name, dims)]),
  ) as Record<PrismVertexName, Point3>;
}
