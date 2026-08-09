/**
 * Вычислительное ядро главы «Многогранники и сечения» (10 класс).
 *
 * Здесь собраны три независимые части:
 *  1. счётные характеристики многогранников и формула Эйлера;
 *  2. площади поверхностей правильных призм и пирамид;
 *  3. модель куба, честные параллельные проекции и сечение куба плоскостью.
 *
 * Все функции чистые: они не читают DOM и не хранят состояние.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

/** Допуск для сравнения координат: модель куба имеет размер порядка единицы. */
const EPSILON = 1e-9;

function assertFinite(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} должно быть конечным числом`);
  }
}

function assertPositive(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} должно быть положительным`);
  }
}

function assertBaseSides(n: number): void {
  if (!Number.isInteger(n) || n < 3 || n > 24) {
    throw new RangeError('Число сторон основания должно быть целым от 3 до 24');
  }
}

/** Округление до заданного числа знаков после запятой (для вывода, не для сравнения). */
export function roundTo(value: number, digits = 4): number {
  assertFinite(value, 'Значение');
  if (!Number.isInteger(digits) || digits < 0 || digits > 12) {
    throw new RangeError('Число знаков должно быть целым от 0 до 12');
  }
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON * Math.sign(value || 1)) * factor) / factor;
}

// ───────────────────────────── векторы ─────────────────────────────

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scale(a: Vec3, factor: number): Vec3 {
  return { x: a.x * factor, y: a.y * factor, z: a.z * factor };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function distance(a: Vec3, b: Vec3): number {
  return length(subtract(a, b));
}

export function normalize(a: Vec3): Vec3 {
  const size = length(a);
  if (size <= EPSILON) {
    throw new RangeError('Нулевой вектор нельзя нормировать');
  }
  return scale(a, 1 / size);
}

// ────────────────────── формула Эйлера и счёт элементов ──────────────────────

export interface PolyhedronCounts {
  readonly vertices: number;
  readonly edges: number;
  readonly faces: number;
}

function assertCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} должно быть целым неотрицательным числом`);
  }
}

/** Эйлерова характеристика $V - E + F$. Для выпуклого многогранника она равна 2. */
export function eulerCharacteristic(counts: PolyhedronCounts): number {
  assertCount(counts.vertices, 'Число вершин');
  assertCount(counts.edges, 'Число рёбер');
  assertCount(counts.faces, 'Число граней');
  return counts.vertices - counts.edges + counts.faces;
}

/** Проверяет соотношение $V - E + F = 2$. */
export function satisfiesEuler(counts: PolyhedronCounts): boolean {
  return eulerCharacteristic(counts) === 2;
}

/**
 * Восстанавливает недостающее число элементов по формуле Эйлера.
 * Ровно одно из трёх значений должно быть null.
 */
export function completeEuler(
  vertices: number | null,
  edges: number | null,
  faces: number | null,
): PolyhedronCounts {
  const known = [vertices, edges, faces];
  const missing = known.filter((value) => value === null).length;
  if (missing !== 1) {
    throw new RangeError('Ровно одно из чисел V, E, F должно быть неизвестным');
  }
  if (vertices !== null) assertCount(vertices, 'Число вершин');
  if (edges !== null) assertCount(edges, 'Число рёбер');
  if (faces !== null) assertCount(faces, 'Число граней');

  if (vertices === null) {
    return { vertices: 2 + (edges as number) - (faces as number), edges: edges as number, faces: faces as number };
  }
  if (edges === null) {
    return { vertices, edges: vertices + (faces as number) - 2, faces: faces as number };
  }
  return { vertices, edges, faces: 2 + edges - vertices };
}

/** $n$-угольная призма: $2n$ вершин, $3n$ рёбер, $n+2$ грани. */
export function prismCounts(n: number): PolyhedronCounts {
  assertBaseSides(n);
  return { vertices: 2 * n, edges: 3 * n, faces: n + 2 };
}

/** $n$-угольная пирамида: $n+1$ вершина, $2n$ рёбер, $n+1$ грань. */
export function pyramidCounts(n: number): PolyhedronCounts {
  assertBaseSides(n);
  return { vertices: n + 1, edges: 2 * n, faces: n + 1 };
}

/**
 * Считает элементы многогранника, у которого все грани — правильные $k$-угольники
 * и в каждой вершине сходится ровно $m$ рёбер.
 * Каждое ребро принадлежит двум граням, поэтому $E = \frac{Fk}{2}$ и $V = \frac{2E}{m}$.
 */
export function countsFromFaces(faces: number, faceSides: number, vertexDegree: number): PolyhedronCounts {
  assertCount(faces, 'Число граней');
  if (!Number.isInteger(faceSides) || faceSides < 3) {
    throw new RangeError('У грани должно быть не меньше трёх сторон');
  }
  if (!Number.isInteger(vertexDegree) || vertexDegree < 3) {
    throw new RangeError('В вершине должно сходиться не меньше трёх рёбер');
  }
  const doubledEdges = faces * faceSides;
  if (doubledEdges % 2 !== 0) {
    throw new RangeError('Произведение числа граней на число сторон должно быть чётным');
  }
  const edges = doubledEdges / 2;
  if ((2 * edges) % vertexDegree !== 0) {
    throw new RangeError('Число рёбер не согласовано со степенью вершины');
  }
  return { vertices: (2 * edges) / vertexDegree, edges, faces };
}

export type PlatonicKind = 'tetrahedron' | 'cube' | 'octahedron' | 'dodecahedron' | 'icosahedron';

export interface PlatonicSolid extends PolyhedronCounts {
  readonly kind: PlatonicKind;
  readonly name: string;
  readonly faceName: string;
  readonly faceSides: number;
  readonly vertexDegree: number;
}

const PLATONIC_TABLE: Readonly<Record<PlatonicKind, Omit<PlatonicSolid, keyof PolyhedronCounts>>> = {
  tetrahedron: { kind: 'tetrahedron', name: 'тетраэдр', faceName: 'правильный треугольник', faceSides: 3, vertexDegree: 3 },
  cube: { kind: 'cube', name: 'куб (гексаэдр)', faceName: 'квадрат', faceSides: 4, vertexDegree: 3 },
  octahedron: { kind: 'octahedron', name: 'октаэдр', faceName: 'правильный треугольник', faceSides: 3, vertexDegree: 4 },
  dodecahedron: { kind: 'dodecahedron', name: 'додекаэдр', faceName: 'правильный пятиугольник', faceSides: 5, vertexDegree: 3 },
  icosahedron: { kind: 'icosahedron', name: 'икосаэдр', faceName: 'правильный треугольник', faceSides: 3, vertexDegree: 5 },
};

const PLATONIC_FACE_COUNT: Readonly<Record<PlatonicKind, number>> = {
  tetrahedron: 4,
  cube: 6,
  octahedron: 8,
  dodecahedron: 12,
  icosahedron: 20,
};

export const PLATONIC_KINDS: readonly PlatonicKind[] = [
  'tetrahedron',
  'cube',
  'octahedron',
  'dodecahedron',
  'icosahedron',
];

/** Полное описание правильного многогранника; числа V и E выводятся из F, k и m. */
export function platonicSolid(kind: PlatonicKind): PlatonicSolid {
  const info = PLATONIC_TABLE[kind];
  if (!info) throw new RangeError(`Неизвестный правильный многогранник: ${String(kind)}`);
  const counts = countsFromFaces(PLATONIC_FACE_COUNT[kind], info.faceSides, info.vertexDegree);
  return { ...info, ...counts };
}

// ───────────────────────── площади поверхностей ─────────────────────────

/** Радиус описанной окружности правильного $n$-угольника со стороной $a$. */
export function regularPolygonCircumradius(n: number, side: number): number {
  assertBaseSides(n);
  assertPositive(side, 'Сторона основания');
  return side / (2 * Math.sin(Math.PI / n));
}

/** Радиус вписанной окружности (апофема основания) правильного $n$-угольника. */
export function regularPolygonInradius(n: number, side: number): number {
  assertBaseSides(n);
  assertPositive(side, 'Сторона основания');
  return side / (2 * Math.tan(Math.PI / n));
}

/** Площадь правильного $n$-угольника: $S=\frac{na^2}{4\operatorname{tg}(\pi/n)}$. */
export function regularPolygonArea(n: number, side: number): number {
  assertBaseSides(n);
  assertPositive(side, 'Сторона основания');
  return (n * side * side) / (4 * Math.tan(Math.PI / n));
}

export interface PrismSurface {
  readonly baseArea: number;
  readonly basePerimeter: number;
  readonly lateralArea: number;
  readonly totalArea: number;
  readonly circumradius: number;
  readonly inradius: number;
}

/** Площади поверхности правильной $n$-угольной призмы: $S_{\text{бок}}=Ph$, $S=2S_{\text{осн}}+S_{\text{бок}}$. */
export function regularPrismSurface(n: number, side: number, height: number): PrismSurface {
  assertBaseSides(n);
  assertPositive(side, 'Сторона основания');
  assertPositive(height, 'Высота');
  const baseArea = regularPolygonArea(n, side);
  const basePerimeter = n * side;
  const lateralArea = basePerimeter * height;
  return {
    baseArea,
    basePerimeter,
    lateralArea,
    totalArea: 2 * baseArea + lateralArea,
    circumradius: regularPolygonCircumradius(n, side),
    inradius: regularPolygonInradius(n, side),
  };
}

export interface PyramidSurface {
  readonly baseArea: number;
  readonly basePerimeter: number;
  /** Апофема пирамиды — высота боковой грани, проведённая к стороне основания. */
  readonly apothem: number;
  readonly lateralEdge: number;
  readonly lateralArea: number;
  readonly totalArea: number;
  readonly circumradius: number;
  readonly inradius: number;
}

/**
 * Площади поверхности правильной $n$-угольной пирамиды.
 * Апофема $l=\sqrt{h^2+r^2}$, боковое ребро $=\sqrt{h^2+R^2}$, $S_{\text{бок}}=\tfrac12 Pl$.
 */
export function regularPyramidSurface(n: number, side: number, height: number): PyramidSurface {
  assertBaseSides(n);
  assertPositive(side, 'Сторона основания');
  assertPositive(height, 'Высота');
  const baseArea = regularPolygonArea(n, side);
  const basePerimeter = n * side;
  const inradius = regularPolygonInradius(n, side);
  const circumradius = regularPolygonCircumradius(n, side);
  const apothem = Math.hypot(height, inradius);
  const lateralArea = 0.5 * basePerimeter * apothem;
  return {
    baseArea,
    basePerimeter,
    apothem,
    lateralEdge: Math.hypot(height, circumradius),
    lateralArea,
    totalArea: baseArea + lateralArea,
    circumradius,
    inradius,
  };
}

/** Площадь поверхности прямоугольного параллелепипеда: $S=2(ab+bc+ca)$. */
export function cuboidSurface(a: number, b: number, c: number): number {
  assertPositive(a, 'Первое измерение');
  assertPositive(b, 'Второе измерение');
  assertPositive(c, 'Третье измерение');
  return 2 * (a * b + b * c + c * a);
}

// ───────────────────── модели многогранников ─────────────────────

export interface SolidModel {
  readonly vertices: readonly Vec3[];
  readonly edges: readonly (readonly [number, number])[];
  readonly faces: readonly (readonly number[])[];
  readonly labels: readonly string[];
}

function regularBase(n: number, side: number): Vec3[] {
  const radius = regularPolygonCircumradius(n, side);
  // Смещение на половину шага ставит стороны симметрично относительно осей.
  return Array.from({ length: n }, (_, index) => {
    const angle = (2 * Math.PI * index) / n + Math.PI / n;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle), z: 0 };
  });
}

/** Правильная $n$-угольная призма: основание в плоскости $z=0$, второе — в $z=h$. */
export function regularPrismModel(n: number, side: number, height: number): SolidModel {
  assertBaseSides(n);
  assertPositive(side, 'Сторона основания');
  assertPositive(height, 'Высота');
  const bottom = regularBase(n, side);
  const top = bottom.map((point) => ({ ...point, z: height }));
  const vertices = [...bottom, ...top];
  const edges: [number, number][] = [];
  for (let index = 0; index < n; index += 1) {
    const next = (index + 1) % n;
    edges.push([index, next], [n + index, n + next], [index, n + index]);
  }
  const faces: number[][] = [
    Array.from({ length: n }, (_, index) => index),
    Array.from({ length: n }, (_, index) => n + index),
  ];
  for (let index = 0; index < n; index += 1) {
    const next = (index + 1) % n;
    faces.push([index, next, n + next, n + index]);
  }
  const labels = [
    ...Array.from({ length: n }, (_, index) => `P${index + 1}`),
    ...Array.from({ length: n }, (_, index) => `Q${index + 1}`),
  ];
  return { vertices, edges, faces, labels };
}

/** Правильная $n$-угольная пирамида: основание в $z=0$, вершина на оси в $z=h$. */
export function regularPyramidModel(n: number, side: number, height: number): SolidModel {
  assertBaseSides(n);
  assertPositive(side, 'Сторона основания');
  assertPositive(height, 'Высота');
  const base = regularBase(n, side);
  const vertices = [...base, { x: 0, y: 0, z: height }];
  const edges: [number, number][] = [];
  for (let index = 0; index < n; index += 1) {
    edges.push([index, (index + 1) % n], [index, n]);
  }
  const faces: number[][] = [Array.from({ length: n }, (_, index) => index)];
  for (let index = 0; index < n; index += 1) {
    faces.push([index, (index + 1) % n, n]);
  }
  const labels = [...Array.from({ length: n }, (_, index) => `P${index + 1}`), 'S'];
  return { vertices, edges, faces, labels };
}

export const CUBE_VERTEX_LABELS: readonly string[] = ['A', 'B', 'C', 'D', 'A₁', 'B₁', 'C₁', 'D₁'];

export interface CubeEdgeDefinition {
  readonly id: string;
  readonly label: string;
  readonly from: number;
  readonly to: number;
}

/** Двенадцать рёбер куба $ABCDA_1B_1C_1D_1$; параметр отсчитывается от первой вершины. */
export const CUBE_EDGES: readonly CubeEdgeDefinition[] = [
  { id: 'AB', label: 'AB', from: 0, to: 1 },
  { id: 'BC', label: 'BC', from: 1, to: 2 },
  { id: 'CD', label: 'CD', from: 2, to: 3 },
  { id: 'AD', label: 'AD', from: 0, to: 3 },
  { id: 'A1B1', label: 'A₁B₁', from: 4, to: 5 },
  { id: 'B1C1', label: 'B₁C₁', from: 5, to: 6 },
  { id: 'C1D1', label: 'C₁D₁', from: 6, to: 7 },
  { id: 'A1D1', label: 'A₁D₁', from: 4, to: 7 },
  { id: 'AA1', label: 'AA₁', from: 0, to: 4 },
  { id: 'BB1', label: 'BB₁', from: 1, to: 5 },
  { id: 'CC1', label: 'CC₁', from: 2, to: 6 },
  { id: 'DD1', label: 'DD₁', from: 3, to: 7 },
];

/** Куб с ребром `size`: $A$ в начале координат, $AA_1$ вдоль оси $z$. */
export function cubeModel(size = 1): SolidModel {
  assertPositive(size, 'Ребро куба');
  const s = size;
  const vertices: Vec3[] = [
    { x: 0, y: 0, z: 0 },
    { x: s, y: 0, z: 0 },
    { x: s, y: s, z: 0 },
    { x: 0, y: s, z: 0 },
    { x: 0, y: 0, z: s },
    { x: s, y: 0, z: s },
    { x: s, y: s, z: s },
    { x: 0, y: s, z: s },
  ];
  const edges = CUBE_EDGES.map((edge) => [edge.from, edge.to] as [number, number]);
  const faces: number[][] = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [0, 3, 7, 4],
  ];
  return { vertices, edges, faces, labels: [...CUBE_VERTEX_LABELS] };
}

/** Точка на ребре куба: `t = 0` — первая вершина ребра, `t = 1` — вторая. */
export function pointOnCubeEdge(edgeId: string, t: number, size = 1): Vec3 {
  const edge = CUBE_EDGES.find((item) => item.id === edgeId);
  if (!edge) throw new RangeError(`Неизвестное ребро куба: ${String(edgeId)}`);
  assertFinite(t, 'Доля вдоль ребра');
  if (t < 0 || t > 1) throw new RangeError('Доля вдоль ребра должна лежать между 0 и 1');
  const { vertices } = cubeModel(size);
  const from = vertices[edge.from] as Vec3;
  const to = vertices[edge.to] as Vec3;
  return add(from, scale(subtract(to, from), t));
}

// ───────────────────────── проекции ─────────────────────────

export type ProjectionKind = 'isometric' | 'cabinet';

const ISOMETRIC_COS30 = Math.sqrt(3) / 2;
/** Коэффициент сокращения оси y в кабинетной проекции: $\tfrac12\cos45°$. */
const CABINET_SHIFT = Math.SQRT2 / 4;

/**
 * Честная параллельная проекция точки на экран (ось y экрана направлена вниз).
 *
 * Изометрия: $u=(x-y)\cos30°$, $v=(x+y)\sin30°-z$ — все три оси сокращаются одинаково.
 * Кабинетная проекция: ось $y$ идёт под $45°$ и сокращается вдвое.
 */
export function projectPoint(point: Vec3, projection: ProjectionKind = 'isometric'): Point2 {
  assertFinite(point.x, 'Координата x');
  assertFinite(point.y, 'Координата y');
  assertFinite(point.z, 'Координата z');
  if (projection === 'cabinet') {
    return { x: point.x + CABINET_SHIFT * point.y, y: -point.z - CABINET_SHIFT * point.y };
  }
  if (projection !== 'isometric') {
    throw new RangeError(`Неизвестная проекция: ${String(projection)}`);
  }
  return { x: (point.x - point.y) * ISOMETRIC_COS30, y: (point.x + point.y) / 2 - point.z };
}

/** Единичный вектор «на зрителя»: вдоль него проекция вырождается в точку. */
export function viewerDirection(projection: ProjectionKind = 'isometric'): Vec3 {
  if (projection === 'cabinet') {
    return normalize({ x: CABINET_SHIFT, y: -1, z: CABINET_SHIFT });
  }
  if (projection !== 'isometric') {
    throw new RangeError(`Неизвестная проекция: ${String(projection)}`);
  }
  return normalize({ x: 1, y: 1, z: 1 });
}

function centroidOf(points: readonly Vec3[]): Vec3 {
  if (points.length === 0) throw new RangeError('Нужна хотя бы одна точка');
  const sum = points.reduce((accumulator, point) => add(accumulator, point), { x: 0, y: 0, z: 0 });
  return scale(sum, 1 / points.length);
}

/** Внешняя нормаль грани: направление выбирается «от центра тела». */
export function outwardNormal(model: SolidModel, faceIndex: number): Vec3 {
  const face = model.faces[faceIndex];
  if (!face || face.length < 3) throw new RangeError('У грани должно быть не меньше трёх вершин');
  const points = face.map((index) => model.vertices[index] as Vec3);
  const raw = cross(subtract(points[1] as Vec3, points[0] as Vec3), subtract(points[2] as Vec3, points[0] as Vec3));
  const normal = normalize(raw);
  const outward = subtract(centroidOf(points), centroidOf(model.vertices));
  return dot(normal, outward) < 0 ? scale(normal, -1) : normal;
}

/** Грань видима, если её внешняя нормаль направлена в сторону зрителя. */
export function isFaceVisible(model: SolidModel, faceIndex: number, projection: ProjectionKind = 'isometric'): boolean {
  return dot(outwardNormal(model, faceIndex), viewerDirection(projection)) > EPSILON;
}

function faceContainsEdge(face: readonly number[], a: number, b: number): boolean {
  for (let index = 0; index < face.length; index += 1) {
    const current = face[index] as number;
    const next = face[(index + 1) % face.length] as number;
    if ((current === a && next === b) || (current === b && next === a)) return true;
  }
  return false;
}

/**
 * Для каждого ребра модели сообщает, видимо ли оно.
 * Ребро видимо, если хотя бы одна прилегающая грань обращена к зрителю.
 */
export function visibleEdges(model: SolidModel, projection: ProjectionKind = 'isometric'): boolean[] {
  const visibility = model.faces.map((_, index) => isFaceVisible(model, index, projection));
  return model.edges.map(([a, b]) => model.faces.some(
    (face, index) => visibility[index] === true && faceContainsEdge(face, a, b),
  ));
}

export interface FitBox {
  readonly width: number;
  readonly height: number;
  readonly padding: number;
}

export interface FitTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Подбирает единый масштаб и сдвиг, чтобы проекция целиком поместилась в прямоугольник. */
export function fitToBox(points: readonly Point2[], box: FitBox): FitTransform {
  if (points.length === 0) throw new RangeError('Нужна хотя бы одна точка');
  assertPositive(box.width, 'Ширина области');
  assertPositive(box.height, 'Высота области');
  assertFinite(box.padding, 'Отступ');
  const usableWidth = box.width - 2 * box.padding;
  const usableHeight = box.height - 2 * box.padding;
  if (usableWidth <= 0 || usableHeight <= 0) {
    throw new RangeError('Отступ не должен превышать половину размера области');
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, EPSILON);
  const spanY = Math.max(maxY - minY, EPSILON);
  const factor = Math.min(usableWidth / spanX, usableHeight / spanY);
  return {
    scale: factor,
    offsetX: box.width / 2 - factor * ((minX + maxX) / 2),
    offsetY: box.height / 2 - factor * ((minY + maxY) / 2),
  };
}

/** Применяет подобранное преобразование к точке проекции. */
export function applyTransform(point: Point2, transform: FitTransform): Point2 {
  return {
    x: transform.offsetX + transform.scale * point.x,
    y: transform.offsetY + transform.scale * point.y,
  };
}

// ───────────────────────── сечение куба ─────────────────────────

export interface Plane {
  readonly normal: Vec3;
  readonly offset: number;
}

/** Плоскость через три точки в виде $\vec n\cdot\vec r = d$ с единичной нормалью. */
export function planeThroughPoints(a: Vec3, b: Vec3, c: Vec3): Plane {
  const raw = cross(subtract(b, a), subtract(c, a));
  if (length(raw) <= 1e-7) {
    throw new RangeError('Три точки лежат на одной прямой и не задают плоскость');
  }
  const normal = normalize(raw);
  return { normal, offset: dot(normal, a) };
}

export type SectionShape = 'треугольник' | 'четырёхугольник' | 'пятиугольник' | 'шестиугольник';

const SHAPE_NAMES: Readonly<Record<number, SectionShape>> = {
  3: 'треугольник',
  4: 'четырёхугольник',
  5: 'пятиугольник',
  6: 'шестиугольник',
};

export interface CubeSection {
  /** Вершины многоугольника сечения в порядке обхода. */
  readonly vertices: readonly Vec3[];
  readonly sides: number;
  readonly shape: SectionShape;
  readonly sideLengths: readonly number[];
  readonly perimeter: number;
  readonly area: number;
  readonly regular: boolean;
  readonly plane: Plane;
}

function samePoint(a: Vec3, b: Vec3, tolerance: number): boolean {
  return Math.abs(a.x - b.x) <= tolerance
    && Math.abs(a.y - b.y) <= tolerance
    && Math.abs(a.z - b.z) <= tolerance;
}

/** Упорядочивает вершины выпуклого многоугольника по углу вокруг его центра. */
function orderConvexPolygon(points: readonly Vec3[], normal: Vec3): Vec3[] {
  const center = centroidOf(points);
  const reference = points.reduce<Vec3 | null>((found, point) => {
    if (found) return found;
    const candidate = subtract(point, center);
    return length(candidate) > 1e-7 ? candidate : null;
  }, null);
  if (!reference) throw new RangeError('Многоугольник сечения вырожден');
  const axisU = normalize(reference);
  const axisV = cross(normal, axisU);
  return [...points].sort((left, right) => {
    const leftVector = subtract(left, center);
    const rightVector = subtract(right, center);
    const leftAngle = Math.atan2(dot(leftVector, axisV), dot(leftVector, axisU));
    const rightAngle = Math.atan2(dot(rightVector, axisV), dot(rightVector, axisU));
    return leftAngle - rightAngle;
  });
}

/** Площадь плоского многоугольника в пространстве (формула через векторные произведения). */
export function polygonArea(points: readonly Vec3[]): number {
  if (points.length < 3) return 0;
  const origin = points[0] as Vec3;
  let sum: Vec3 = { x: 0, y: 0, z: 0 };
  for (let index = 1; index < points.length - 1; index += 1) {
    sum = add(sum, cross(
      subtract(points[index] as Vec3, origin),
      subtract(points[index + 1] as Vec3, origin),
    ));
  }
  return length(sum) / 2;
}

/** Периметр замкнутой ломаной по её вершинам. */
export function polygonPerimeter(points: readonly Vec3[]): number {
  if (points.length < 2) return 0;
  return points.reduce(
    (sum, point, index) => sum + distance(point, points[(index + 1) % points.length] as Vec3),
    0,
  );
}

/**
 * Сечение куба с ребром `size` плоскостью, проходящей через три данные точки.
 *
 * Плоскость пересекается с каждым из двенадцати рёбер; полученные точки
 * упорядочиваются по обходу — это и есть многоугольник сечения.
 */
export function cubeSection(points: readonly Vec3[], size = 1): CubeSection {
  assertPositive(size, 'Ребро куба');
  if (points.length !== 3) {
    throw new RangeError('Секущая плоскость задаётся ровно тремя точками');
  }
  const plane = planeThroughPoints(points[0] as Vec3, points[1] as Vec3, points[2] as Vec3);
  const model = cubeModel(size);
  const tolerance = 1e-7 * size;
  const found: Vec3[] = [];
  const remember = (candidate: Vec3) => {
    if (!found.some((point) => samePoint(point, candidate, tolerance))) found.push(candidate);
  };

  for (const [fromIndex, toIndex] of model.edges) {
    const from = model.vertices[fromIndex] as Vec3;
    const to = model.vertices[toIndex] as Vec3;
    const fromValue = dot(plane.normal, from) - plane.offset;
    const toValue = dot(plane.normal, to) - plane.offset;
    if (Math.abs(fromValue) <= tolerance) remember(from);
    if (Math.abs(toValue) <= tolerance) remember(to);
    if (Math.abs(fromValue) > tolerance && Math.abs(toValue) > tolerance && fromValue * toValue < 0) {
      remember(add(from, scale(subtract(to, from), fromValue / (fromValue - toValue))));
    }
  }

  if (found.length < 3) {
    throw new RangeError('Плоскость не пересекает куб по многоугольнику');
  }

  const ordered = orderConvexPolygon(found, plane.normal);
  const sideLengths = ordered.map(
    (point, index) => distance(point, ordered[(index + 1) % ordered.length] as Vec3),
  );
  const shape = SHAPE_NAMES[ordered.length];
  if (!shape) throw new RangeError('Сечение куба не может иметь столько сторон');
  const minSide = Math.min(...sideLengths);
  const maxSide = Math.max(...sideLengths);

  return {
    vertices: ordered,
    sides: ordered.length,
    shape,
    sideLengths,
    perimeter: polygonPerimeter(ordered),
    area: polygonArea(ordered),
    regular: maxSide - minSide <= 1e-6 * size,
    plane,
  };
}

export interface EdgeSelection {
  readonly edgeId: string;
  readonly t: number;
}

/** Удобная обёртка: сечение куба плоскостью через три точки, заданные на рёбрах. */
export function cubeSectionFromEdges(selections: readonly EdgeSelection[], size = 1): CubeSection {
  if (selections.length !== 3) {
    throw new RangeError('Секущая плоскость задаётся ровно тремя точками');
  }
  return cubeSection(
    selections.map((selection) => pointOnCubeEdge(selection.edgeId, selection.t, size)),
    size,
  );
}
