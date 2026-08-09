/**
 * Ядро главы «Векторы и движения» (9 класс).
 *
 * Все функции чистые. Там, где входные координаты целые, результат остаётся
 * точным целым: сложение, умножение на число, скалярное и косое произведения,
 * координаты прямой и повороты на кратные 90° не вносят погрешности.
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Точка плоскости и вектор описываются одной парой чисел, но смысл разный. */
export type Point2 = Vec2;

/** Общее уравнение прямой: a·x + b·y + c = 0, причём a и b не равны нулю одновременно. */
export interface LineEquation {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

/** Окружность (x − x₀)² + (y − y₀)² = R². */
export interface CircleEquation {
  readonly center: Point2;
  readonly radius: number;
}

/** Вид угла между векторами, определённый по знакам скалярного и косого произведений. */
export type AngleKind = 'zero' | 'acute' | 'right' | 'obtuse' | 'straight';

/** Виды движений плоскости, изучаемые в 9 классе. */
export type MotionKind = 'translation' | 'axial-symmetry' | 'central-symmetry' | 'rotation';

export type Motion =
  | { readonly kind: 'translation'; readonly vector: Vec2 }
  | { readonly kind: 'axial-symmetry'; readonly line: LineEquation }
  | { readonly kind: 'central-symmetry'; readonly center: Point2 }
  | { readonly kind: 'rotation'; readonly center: Point2; readonly degrees: number };

const EPSILON = 1e-9;

function assertFinite(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} должно быть конечным числом`);
  }
}

function assertVector(value: Vec2, label: string): Vec2 {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${label} должно задаваться парой координат`);
  }
  assertFinite(value.x, `Координата x (${label})`);
  assertFinite(value.y, `Координата y (${label})`);
  return value;
}

/** Убирает минус-ноль, чтобы сравнения и вывод были предсказуемыми. */
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

/** Собирает вектор из координат с проверкой входа. */
export function vec(x: number, y: number): Vec2 {
  assertFinite(x, 'Координата x');
  assertFinite(y, 'Координата y');
  return { x: zeroSafe(x), y: zeroSafe(y) };
}

/** Координаты вектора AB: из координат конца вычитаем координаты начала. */
export function vectorBetween(from: Point2, to: Point2): Vec2 {
  assertVector(from, 'начало вектора');
  assertVector(to, 'конец вектора');
  return vec(to.x - from.x, to.y - from.y);
}

export function addVectors(first: Vec2, second: Vec2): Vec2 {
  assertVector(first, 'первый вектор');
  assertVector(second, 'второй вектор');
  return vec(first.x + second.x, first.y + second.y);
}

export function subtractVectors(first: Vec2, second: Vec2): Vec2 {
  assertVector(first, 'первый вектор');
  assertVector(second, 'второй вектор');
  return vec(first.x - second.x, first.y - second.y);
}

/** Умножение вектора на число: обе координаты умножаются на один множитель. */
export function scaleVector(factor: number, vector: Vec2): Vec2 {
  assertFinite(factor, 'Множитель');
  assertVector(vector, 'вектор');
  return vec(factor * vector.x, factor * vector.y);
}

export function oppositeVector(vector: Vec2): Vec2 {
  return scaleVector(-1, vector);
}

export function isZeroVector(vector: Vec2): boolean {
  assertVector(vector, 'вектор');
  return vector.x === 0 && vector.y === 0;
}

/** Векторы равны, когда совпадают обе координаты: длина и направление одинаковы. */
export function equalVectors(first: Vec2, second: Vec2): boolean {
  assertVector(first, 'первый вектор');
  assertVector(second, 'второй вектор');
  return first.x === second.x && first.y === second.y;
}

/** Квадрат длины остаётся целым для целых координат — им удобно сравнивать длины. */
export function squaredLength(vector: Vec2): number {
  assertVector(vector, 'вектор');
  return vector.x * vector.x + vector.y * vector.y;
}

export function vectorLength(vector: Vec2): number {
  return Math.sqrt(squaredLength(vector));
}

/** Скалярное произведение в координатах: x₁x₂ + y₁y₂. */
export function dotProduct(first: Vec2, second: Vec2): number {
  assertVector(first, 'первый вектор');
  assertVector(second, 'второй вектор');
  return zeroSafe(first.x * second.x + first.y * second.y);
}

/**
 * Косое (псевдоскалярное) произведение x₁y₂ − y₁x₂. В школьной программе его
 * не вводят, но ноль здесь — точный признак коллинеарности, а модуль равен
 * удвоенной площади треугольника.
 */
export function crossProduct(first: Vec2, second: Vec2): number {
  assertVector(first, 'первый вектор');
  assertVector(second, 'второй вектор');
  return zeroSafe(first.x * second.y - first.y * second.x);
}

/** Коллинеарность: один вектор выражается через другой умножением на число. */
export function areCollinear(first: Vec2, second: Vec2): boolean {
  return Math.abs(crossProduct(first, second)) <= EPSILON;
}

/** Перпендикулярность ненулевых векторов равносильна равенству нулю скалярного произведения. */
export function arePerpendicular(first: Vec2, second: Vec2): boolean {
  if (isZeroVector(first) || isZeroVector(second)) {
    throw new RangeError('Угол с нулевым вектором не определён');
  }
  return Math.abs(dotProduct(first, second)) <= EPSILON;
}

export function midpoint(first: Point2, second: Point2): Point2 {
  assertVector(first, 'первая точка');
  assertVector(second, 'вторая точка');
  return vec((first.x + second.x) / 2, (first.y + second.y) / 2);
}

/** Расстояние между точками — длина вектора, соединяющего их. */
export function distance(first: Point2, second: Point2): number {
  return vectorLength(vectorBetween(first, second));
}

export function cosineBetween(first: Vec2, second: Vec2): number {
  if (isZeroVector(first) || isZeroVector(second)) {
    throw new RangeError('Угол с нулевым вектором не определён');
  }
  const value = dotProduct(first, second) / (vectorLength(first) * vectorLength(second));
  return Math.max(-1, Math.min(1, value));
}

/** Угол между векторами в градусах, от 0 до 180. */
export function angleBetweenDegrees(first: Vec2, second: Vec2): number {
  return (Math.acos(cosineBetween(first, second)) * 180) / Math.PI;
}

/**
 * Вид угла по знаку скалярного произведения. Отдельно выделены случаи 0° и
 * 180°: сонаправленный и противоположно направленный векторы не дают острого
 * или тупого угла, хотя знак произведения такой же.
 */
export function angleKind(first: Vec2, second: Vec2): AngleKind {
  if (isZeroVector(first) || isZeroVector(second)) {
    throw new RangeError('Угол с нулевым вектором не определён');
  }
  const dot = dotProduct(first, second);
  if (Math.abs(dot) <= EPSILON) return 'right';
  if (areCollinear(first, second)) return dot > 0 ? 'zero' : 'straight';
  return dot > 0 ? 'acute' : 'obtuse';
}

/** Единичный вектор того же направления. */
export function unitVector(vector: Vec2): Vec2 {
  if (isZeroVector(vector)) {
    throw new RangeError('У нулевого вектора нет направления');
  }
  const length = vectorLength(vector);
  return vec(vector.x / length, vector.y / length);
}

/** Проекция первого вектора на направление второго: со знаком, как на оси. */
export function projectionLength(vector: Vec2, onto: Vec2): number {
  if (isZeroVector(onto)) {
    throw new RangeError('Проекция на нулевой вектор не определена');
  }
  return dotProduct(vector, onto) / vectorLength(onto);
}

/** Площадь треугольника по координатам вершин — половина модуля косого произведения. */
export function triangleArea(first: Point2, second: Point2, third: Point2): number {
  return Math.abs(crossProduct(vectorBetween(first, second), vectorBetween(first, third))) / 2;
}

/**
 * Приводит уравнение к каноническому виду: для целых коэффициентов делит их на
 * наибольший общий делитель, а знак выбирает так, чтобы первый ненулевой
 * коэффициент был положительным.
 */
export function normalizeLine(line: LineEquation): LineEquation {
  const { a, b, c } = line;
  assertFinite(a, 'Коэффициент a');
  assertFinite(b, 'Коэффициент b');
  assertFinite(c, 'Коэффициент c');
  if (a === 0 && b === 0) {
    throw new RangeError('Коэффициенты a и b не могут быть нулевыми одновременно');
  }

  let [scaledA, scaledB, scaledC] = [a, b, c];
  if (Number.isInteger(a) && Number.isInteger(b) && Number.isInteger(c)) {
    const divisor = gcd(gcd(a, b), c) || 1;
    scaledA = a / divisor;
    scaledB = b / divisor;
    scaledC = c / divisor;
  }

  const leading = scaledA !== 0 ? scaledA : scaledB;
  const sign = leading < 0 ? -1 : 1;
  return { a: zeroSafe(scaledA * sign), b: zeroSafe(scaledB * sign), c: zeroSafe(scaledC * sign) };
}

/** Уравнение прямой через две различные точки. */
export function lineThroughPoints(first: Point2, second: Point2): LineEquation {
  const direction = vectorBetween(first, second);
  if (isZeroVector(direction)) {
    throw new RangeError('Через совпадающие точки проходит бесконечно много прямых');
  }
  return normalizeLine({
    a: direction.y,
    b: -direction.x,
    c: direction.x * first.y - direction.y * first.x,
  });
}

/** Серединный перпендикуляр к отрезку: множество точек, равноудалённых от концов. */
export function perpendicularBisector(first: Point2, second: Point2): LineEquation {
  assertVector(first, 'первая точка');
  assertVector(second, 'вторая точка');
  if (first.x === second.x && first.y === second.y) {
    throw new RangeError('Серединный перпендикуляр определён только для различных точек');
  }
  return normalizeLine({
    a: 2 * (second.x - first.x),
    b: 2 * (second.y - first.y),
    c: first.x * first.x + first.y * first.y - second.x * second.x - second.y * second.y,
  });
}

export function isPointOnLine(line: LineEquation, point: Point2): boolean {
  assertVector(point, 'точка');
  const normalized = normalizeLine(line);
  return Math.abs(normalized.a * point.x + normalized.b * point.y + normalized.c) <= EPSILON;
}

/** Направляющий вектор прямой a·x + b·y + c = 0 равен (−b; a). */
export function lineDirection(line: LineEquation): Vec2 {
  const normalized = normalizeLine(line);
  return vec(-normalized.b, normalized.a);
}

/** Вектор нормали к прямой — это (a; b): он перпендикулярен направляющему. */
export function lineNormal(line: LineEquation): Vec2 {
  const normalized = normalizeLine(line);
  return vec(normalized.a, normalized.b);
}

export function circle(center: Point2, radius: number): CircleEquation {
  assertVector(center, 'центр окружности');
  assertFinite(radius, 'Радиус');
  if (radius <= 0) {
    throw new RangeError('Радиус окружности должен быть положительным');
  }
  return { center: vec(center.x, center.y), radius };
}

/** Окружность, для которой данный отрезок является диаметром. */
export function circleFromDiameter(first: Point2, second: Point2): CircleEquation {
  const length = distance(first, second);
  if (length === 0) {
    throw new RangeError('Диаметр не может быть нулевым');
  }
  return circle(midpoint(first, second), length / 2);
}

export function isPointOnCircle(shape: CircleEquation, point: Point2): boolean {
  assertVector(point, 'точка');
  const model = circle(shape.center, shape.radius);
  return Math.abs(squaredLength(vectorBetween(model.center, point)) - model.radius * model.radius) <= 1e-9;
}

/** Параллельный перенос точки на вектор. */
export function translatePoint(point: Point2, vector: Vec2): Point2 {
  return addVectors(point, vector);
}

/** Отражение точки относительно прямой a·x + b·y + c = 0. */
export function reflectOverLine(point: Point2, line: LineEquation): Point2 {
  assertVector(point, 'точка');
  const { a, b, c } = normalizeLine(line);
  const factor = (2 * (a * point.x + b * point.y + c)) / (a * a + b * b);
  return vec(point.x - a * factor, point.y - b * factor);
}

/** Центральная симметрия: центр — середина отрезка между точкой и её образом. */
export function reflectOverPoint(point: Point2, center: Point2): Point2 {
  assertVector(point, 'точка');
  assertVector(center, 'центр симметрии');
  return vec(2 * center.x - point.x, 2 * center.y - point.y);
}

/**
 * Поворот точки вокруг центра против часовой стрелки. Для углов, кратных 90°,
 * координаты вычисляются точно, без обращения к синусу и косинусу.
 */
export function rotatePoint(point: Point2, center: Point2, degrees: number): Point2 {
  assertVector(point, 'точка');
  assertVector(center, 'центр поворота');
  assertFinite(degrees, 'Угол поворота');

  const shifted = vectorBetween(center, point);
  const normalized = ((degrees % 360) + 360) % 360;
  const exact: Readonly<Record<number, Vec2>> = {
    0: shifted,
    90: vec(-shifted.y, shifted.x),
    180: vec(-shifted.x, -shifted.y),
    270: vec(shifted.y, -shifted.x),
  };
  const turned = exact[normalized] ?? (() => {
    const radians = (normalized * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return vec(shifted.x * cosine - shifted.y * sine, shifted.x * sine + shifted.y * cosine);
  })();

  return addVectors(center, turned);
}

/** Применяет описанное движение к точке. */
export function applyMotion(motion: Motion, point: Point2): Point2 {
  switch (motion.kind) {
    case 'translation':
      return translatePoint(point, motion.vector);
    case 'axial-symmetry':
      return reflectOverLine(point, motion.line);
    case 'central-symmetry':
      return reflectOverPoint(point, motion.center);
    case 'rotation':
      return rotatePoint(point, motion.center, motion.degrees);
    default:
      throw new RangeError('Неизвестный вид движения');
  }
}

/**
 * Сохраняет ли движение направление обхода. Перенос и поворот сохраняют,
 * осевая симметрия меняет его на противоположное. Центральная симметрия —
 * это поворот на 180°, поэтому обход сохраняется.
 */
export function preservesOrientation(kind: MotionKind): boolean {
  switch (kind) {
    case 'translation':
    case 'rotation':
    case 'central-symmetry':
      return true;
    case 'axial-symmetry':
      return false;
    default:
      throw new RangeError('Неизвестный вид движения');
  }
}

/**
 * Проверяет главное свойство движения: расстояние между образами равно
 * расстоянию между прообразами. Служит машинной проверкой формул выше.
 */
export function preservesDistance(motion: Motion, first: Point2, second: Point2): boolean {
  const before = distance(first, second);
  const after = distance(applyMotion(motion, first), applyMotion(motion, second));
  return Math.abs(before - after) <= 1e-9;
}

/** Неподвижные точки движения, если их множество конечно или легко описывается словами. */
export function fixedPointsDescription(motion: Motion): string {
  switch (motion.kind) {
    case 'translation':
      return isZeroVector(motion.vector)
        ? 'все точки плоскости: перенос на нулевой вектор ничего не меняет'
        : 'неподвижных точек нет';
    case 'axial-symmetry':
      return 'все точки оси симметрии';
    case 'central-symmetry':
      return 'единственная точка — центр симметрии';
    case 'rotation':
      return ((motion.degrees % 360) + 360) % 360 === 0
        ? 'все точки плоскости: поворот на 0° ничего не меняет'
        : 'единственная точка — центр поворота';
    default:
      throw new RangeError('Неизвестный вид движения');
  }
}

/** Округление до заданного числа знаков после запятой. */
export function roundTo(value: number, digits = 2): number {
  assertFinite(value, 'Значение');
  if (!Number.isInteger(digits) || digits < 0 || digits > 10) {
    throw new RangeError('Число знаков после запятой должно быть целым от 0 до 10');
  }
  return zeroSafe(Number(value.toFixed(digits)));
}

/** Русская запись числа: десятичная запятая и без хвостовых нулей. */
export function formatNumber(value: number, digits = 2): string {
  const rounded = roundTo(value, digits);
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits).replace(/0+$/, '');
  return text.replace('.', ',').replace('-', '−');
}

/** Запись вектора в координатах: (3; −2). */
export function formatVector(vector: Vec2, digits = 2): string {
  assertVector(vector, 'вектор');
  return `(${formatNumber(vector.x, digits)}; ${formatNumber(vector.y, digits)})`;
}

/** Запись уравнения прямой в общем виде без лишних единиц и плюс-минусов. */
export function formatLine(line: LineEquation, digits = 2): string {
  const { a, b, c } = normalizeLine(line);
  const term = (coefficient: number, name: string, isFirst: boolean): string => {
    if (coefficient === 0) return '';
    const sign = coefficient < 0 ? (isFirst ? '−' : ' − ') : (isFirst ? '' : ' + ');
    const size = Math.abs(coefficient);
    return `${sign}${size === 1 ? '' : formatNumber(size, digits)}${name}`;
  };
  const head = term(a, 'x', true);
  const middle = term(b, 'y', head === '');
  const tail = c === 0 ? '' : `${c < 0 ? (head === '' && middle === '' ? '−' : ' − ') : (head === '' && middle === '' ? '' : ' + ')}${formatNumber(Math.abs(c), digits)}`;
  return `${head}${middle}${tail} = 0`;
}

/** Запись уравнения окружности в виде (x − x₀)² + (y − y₀)² = R². */
export function formatCircle(shape: CircleEquation, digits = 2): string {
  const model = circle(shape.center, shape.radius);
  const part = (value: number, name: string): string => {
    if (value === 0) return `${name}²`;
    return `(${name} ${value > 0 ? '−' : '+'} ${formatNumber(Math.abs(value), digits)})²`;
  };
  const squared = roundTo(model.radius * model.radius, digits);
  return `${part(model.center.x, 'x')} + ${part(model.center.y, 'y')} = ${formatNumber(squared, digits)}`;
}
