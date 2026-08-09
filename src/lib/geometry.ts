import {
  addExact,
  compareExact,
  divideExact,
  multiplyExact,
  negateExact,
  parseExact,
  subtractExact,
  toExactNumber,
  type ExactInput,
  type ExactRational,
} from './exactRational';

export interface GeometryPoint {
  readonly x: number;
  readonly y: number;
}

export interface GridPoint extends GeometryPoint {}

export interface GridCell extends GeometryPoint {}

export interface GeometryLine {
  readonly start: GeometryPoint;
  readonly end: GeometryPoint;
}

export type AxisReflection = 'vertical' | 'horizontal' | 'diagonal-up' | 'diagonal-down';
export type AngleKind = 'zero' | 'acute' | 'right' | 'obtuse' | 'straight';
export type LineRelation = 'coincident' | 'parallel' | 'perpendicular' | 'intersecting';
export type DirectionLineRelation = Exclude<LineRelation, 'coincident'>;
export type TriangleSideKind = 'equilateral' | 'isosceles' | 'scalene';
export type TriangleAngleKind = 'acute' | 'right' | 'obtuse';
export type MetricUnit = 'mm' | 'cm' | 'dm' | 'm' | 'km' | 'a' | 'ha';
export type MetricDimension = 1 | 2 | 3;
export type PiApproximation = '3.14' | '22/7';

export type ShapeReflectionSpec =
  | {
      readonly kind: 'axis';
      readonly axis: AxisReflection;
      readonly axisCoordinate?: number;
    }
  | {
      readonly kind: 'center';
      readonly center: GeometryPoint;
    };

export interface NormalizedLineDirection {
  readonly dx: number;
  readonly dy: number;
}

export interface TriangleFacts {
  readonly sideKind: TriangleSideKind;
  readonly angleKind: TriangleAngleKind;
  /** Squared side lengths in the order AB, BC, CA. */
  readonly sideSquares: readonly [bigint, bigint, bigint];
}

export interface QuadrilateralFacts {
  readonly parallelPairs: 0 | 1 | 2;
  readonly rightAngles: number;
  readonly equalSideGroups: readonly (readonly number[])[];
  readonly equalDiagonals: boolean;
  readonly perpendicularDiagonals: boolean;
  readonly diagonalsBisectEachOther: boolean;
  readonly kind: 'square' | 'rectangle' | 'other';
}

export interface GridShapeMetrics {
  readonly area: number;
  readonly perimeter: number;
}

export interface NumericRectangleMetrics {
  readonly perimeter: number;
  readonly area: number;
}

export interface ExactRectangleMeasures {
  readonly perimeter: ExactRational;
  readonly area: ExactRational;
}

export interface GridAreaEstimate {
  readonly lower: ExactRational;
  readonly midpoint: ExactRational;
  readonly upper: ExactRational;
}

export interface CircleMeasures {
  readonly diameter: number;
  /** The value k in C = k·π. */
  readonly circumferencePiCoefficient: number;
  /** The value k in S = k·π. */
  readonly areaPiCoefficient: number;
}

export interface CuboidMetrics {
  readonly volume: number;
  readonly surfaceArea: number;
}

export type CubeNetValidationReason =
  | 'valid'
  | 'cell-count'
  | 'duplicate'
  | 'disconnected'
  | 'overlap'
  | 'inconsistent-fold';

export interface CubeNetValidation {
  readonly valid: boolean;
  readonly reason: CubeNetValidationReason;
}

export type GeometryErrorCode =
  | 'invalid-number'
  | 'invalid-angle'
  | 'invalid-direction'
  | 'invalid-point'
  | 'invalid-line'
  | 'invalid-route'
  | 'invalid-axis'
  | 'invalid-shape'
  | 'invalid-unit'
  | 'invalid-dimension'
  | 'limit-exceeded';

export class GeometryError extends Error {
  readonly code: GeometryErrorCode;

  constructor(code: GeometryErrorCode, message: string) {
    super(message);
    this.name = 'GeometryError';
    this.code = code;
  }
}

export const GEOMETRY_LIMITS = Object.freeze({
  maxCoordinateMagnitude: 1_000_000_000,
  maxMeasure: 100_000,
  maxCollectionSize: 10_000,
  maxGridCoordinateMagnitude: 1_000_000,
  directionEpsilon: 1e-9,
});

const ZERO = parseExact(0);
const TWO = parseExact(2);
const ONE_HUNDRED_EIGHTY = parseExact(180);

function geometryError(code: GeometryErrorCode, message: string): never {
  throw new GeometryError(code, message);
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function assertFiniteBounded(
  value: unknown,
  label: string,
  maximumMagnitude: number = GEOMETRY_LIMITS.maxCoordinateMagnitude,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return geometryError('invalid-number', `${label} must be a finite number.`);
  }
  if (Math.abs(value) > maximumMagnitude) {
    return geometryError(
      'limit-exceeded',
      `${label} exceeds the supported magnitude of ${maximumMagnitude}.`,
    );
  }
  return normalizeZero(value);
}

function assertSafeInteger(
  value: unknown,
  label: string,
  maximumMagnitude: number = GEOMETRY_LIMITS.maxCoordinateMagnitude,
): number {
  const bounded = assertFiniteBounded(value, label, maximumMagnitude);
  if (!Number.isSafeInteger(bounded)) {
    return geometryError('invalid-point', `${label} must be a safe integer.`);
  }
  return bounded;
}

function assertPoint(point: GeometryPoint, label: string): GeometryPoint {
  if (typeof point !== 'object' || point === null) {
    return geometryError('invalid-point', `${label} must be a point.`);
  }
  return {
    x: assertFiniteBounded(point.x, `${label}.x`),
    y: assertFiniteBounded(point.y, `${label}.y`),
  };
}

function assertIntegerPoint(
  point: GeometryPoint,
  label: string,
  maximumMagnitude: number = GEOMETRY_LIMITS.maxCoordinateMagnitude,
): GeometryPoint {
  if (typeof point !== 'object' || point === null) {
    return geometryError('invalid-point', `${label} must be a point.`);
  }
  return {
    x: assertSafeInteger(point.x, `${label}.x`, maximumMagnitude),
    y: assertSafeInteger(point.y, `${label}.y`, maximumMagnitude),
  };
}

function assertCollection(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    return geometryError('invalid-shape', `${label} must be an array.`);
  }
  if (value.length > GEOMETRY_LIMITS.maxCollectionSize) {
    return geometryError(
      'limit-exceeded',
      `${label} may contain at most ${GEOMETRY_LIMITS.maxCollectionSize} items.`,
    );
  }
  return value;
}

function parseGeometryExact(value: ExactInput, label: string): ExactRational {
  try {
    return parseExact(value);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'invalid exact number';
    return geometryError('invalid-number', `${label} is invalid: ${detail}`);
  }
}

function assertPositiveExact(value: ExactInput, label: string): ExactRational {
  const exact = parseGeometryExact(value, label);
  if (compareExact(exact, ZERO) <= 0) {
    return geometryError('invalid-number', `${label} must be positive.`);
  }
  if (compareExact(exact, GEOMETRY_LIMITS.maxMeasure) > 0) {
    return geometryError(
      'limit-exceeded',
      `${label} exceeds the supported size of ${GEOMETRY_LIMITS.maxMeasure}.`,
    );
  }
  return exact;
}

function assertNonNegativeExact(value: ExactInput, label: string): ExactRational {
  const exact = parseGeometryExact(value, label);
  if (compareExact(exact, ZERO) < 0) {
    return geometryError('invalid-number', `${label} cannot be negative.`);
  }
  if (compareExact(exact, Number.MAX_SAFE_INTEGER) > 0) {
    return geometryError('limit-exceeded', `${label} exceeds the safe input range.`);
  }
  return exact;
}

function exactAbsolute(value: ExactInput): ExactRational {
  const exact = parseExact(value);
  return exact.numerator < 0n ? negateExact(exact) : exact;
}

function exactToSafeNumber(value: ExactInput, label: string): number {
  let result: number;
  try {
    result = toExactNumber(value);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'not representable';
    return geometryError('limit-exceeded', `${label} cannot be represented safely: ${detail}`);
  }
  if (!Number.isFinite(result) || Math.abs(result) > Number.MAX_SAFE_INTEGER) {
    return geometryError('limit-exceeded', `${label} exceeds the safe numeric range.`);
  }
  return normalizeZero(result);
}

function exactToFiniteNumber(value: ExactInput, label: string): number {
  try {
    return normalizeZero(toExactNumber(value));
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'not representable';
    return geometryError('limit-exceeded', `${label} cannot be represented as a finite number: ${detail}`);
  }
}

function integerGcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

function modulo(value: number, modulus: number): number {
  const remainder = value % modulus;
  return normalizeZero(remainder < 0 ? remainder + modulus : remainder);
}

export function classifyAngle(degrees: ExactInput): AngleKind {
  const value = parseGeometryExact(degrees, 'Angle');
  if (compareExact(value, ZERO) < 0 || compareExact(value, ONE_HUNDRED_EIGHTY) > 0) {
    return geometryError('invalid-angle', 'An angle must be between 0° and 180° inclusive.');
  }
  if (compareExact(value, ZERO) === 0) return 'zero';
  if (compareExact(value, 90) < 0) return 'acute';
  if (compareExact(value, 90) === 0) return 'right';
  if (compareExact(value, ONE_HUNDRED_EIGHTY) < 0) return 'obtuse';
  return 'straight';
}

/** Normalizes an undirected line angle to the interval [0, 180). */
export function normalizeLineAngle(degrees: number): number {
  const value = assertFiniteBounded(degrees, 'Line direction', Number.MAX_SAFE_INTEGER);
  return modulo(value, 180);
}

export function lineRelation(angleA: number, angleB: number): DirectionLineRelation {
  const a = assertFiniteBounded(angleA, 'First line direction', Number.MAX_SAFE_INTEGER);
  const b = assertFiniteBounded(angleB, 'Second line direction', Number.MAX_SAFE_INTEGER);

  if (Number.isSafeInteger(a) && Number.isSafeInteger(b)) {
    const rawDifference = (BigInt(a) - BigInt(b)) % 180n;
    const difference = Number(rawDifference < 0n ? rawDifference + 180n : rawDifference);
    if (difference === 0) return 'parallel';
    if (difference === 90) return 'perpendicular';
    return 'intersecting';
  }

  const first = normalizeLineAngle(a);
  const second = normalizeLineAngle(b);
  const rawDifference = Math.abs(first - second);
  const difference = Math.min(rawDifference, 180 - rawDifference);
  if (difference <= GEOMETRY_LIMITS.directionEpsilon) return 'parallel';
  if (Math.abs(difference - 90) <= GEOMETRY_LIMITS.directionEpsilon) return 'perpendicular';
  return 'intersecting';
}

function integerLineVector(line: GeometryLine, label: string): readonly [number, number] {
  if (typeof line !== 'object' || line === null) {
    return geometryError('invalid-line', `${label} must be a line.`);
  }
  const start = assertIntegerPoint(line.start, `${label}.start`);
  const end = assertIntegerPoint(line.end, `${label}.end`);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return geometryError('invalid-line', `${label} needs two distinct points.`);
  }
  return [dx, dy];
}

export function normalizeLineDirection(line: GeometryLine): NormalizedLineDirection {
  let [dx, dy] = integerLineVector(line, 'Line');
  const divisor = integerGcd(dx, dy);
  dx /= divisor;
  dy /= divisor;
  if (dx < 0 || (dx === 0 && dy < 0)) {
    dx = -dx;
    dy = -dy;
  }
  return { dx: normalizeZero(dx), dy: normalizeZero(dy) };
}

export function classifyLineRelation(a: GeometryLine, b: GeometryLine): LineRelation {
  const [adx, ady] = integerLineVector(a, 'First line');
  const [bdx, bdy] = integerLineVector(b, 'Second line');
  const aStart = assertIntegerPoint(a.start, 'First line.start');
  const bStart = assertIntegerPoint(b.start, 'Second line.start');

  const ax = BigInt(adx);
  const ay = BigInt(ady);
  const bx = BigInt(bdx);
  const by = BigInt(bdy);
  const cross = ax * by - ay * bx;

  if (cross === 0n) {
    const offsetX = BigInt(bStart.x - aStart.x);
    const offsetY = BigInt(bStart.y - aStart.y);
    return ax * offsetY - ay * offsetX === 0n ? 'coincident' : 'parallel';
  }

  return ax * bx + ay * by === 0n ? 'perpendicular' : 'intersecting';
}

export function pointToLineDistanceSquared(
  point: GeometryPoint,
  line: GeometryLine,
): ExactRational {
  const p = assertIntegerPoint(point, 'Point');
  const [dx, dy] = integerLineVector(line, 'Line');
  const start = assertIntegerPoint(line.start, 'Line.start');
  const offsetX = BigInt(p.x - start.x);
  const offsetY = BigInt(p.y - start.y);
  const directionX = BigInt(dx);
  const directionY = BigInt(dy);
  const cross = directionX * offsetY - directionY * offsetX;
  const denominator = directionX * directionX + directionY * directionY;
  return parseExact({ numerator: cross * cross, denominator });
}

export function pointToAxisDistance(
  point: GridPoint,
  orientation: 'horizontal' | 'vertical',
  coordinate: number,
): number {
  const normalizedPoint = assertPoint(point, 'Point');
  const axisCoordinate = assertFiniteBounded(coordinate, 'Axis coordinate');
  if (orientation === 'horizontal') {
    return exactToSafeNumber(exactAbsolute(subtractExact(normalizedPoint.y, axisCoordinate)), 'Axis distance');
  }
  if (orientation === 'vertical') {
    return exactToSafeNumber(exactAbsolute(subtractExact(normalizedPoint.x, axisCoordinate)), 'Axis distance');
  }
  return geometryError('invalid-axis', `Unknown axis orientation: ${String(orientation)}.`);
}

export function gridRouteLength(points: readonly GridPoint[]): number {
  const rawPoints = assertCollection(points, 'Route');
  if (rawPoints.length < 2) {
    return geometryError('invalid-route', 'A route needs at least two points.');
  }
  const normalized = rawPoints.map((point, index) =>
    assertIntegerPoint(
      point as GridPoint,
      `Route point ${index + 1}`,
      GEOMETRY_LIMITS.maxGridCoordinateMagnitude,
    ),
  );

  let total = ZERO;
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    const dx = subtractExact(current.x, previous.x);
    const dy = subtractExact(current.y, previous.y);
    if (dx.numerator !== 0n && dy.numerator !== 0n) {
      return geometryError(
        'invalid-route',
        `Route segment ${index} is diagonal; grid routes must follow an axis.`,
      );
    }
    total = addExact(total, addExact(exactAbsolute(dx), exactAbsolute(dy)));
  }
  return exactToSafeNumber(total, 'Route length');
}

function reflectedCoordinate(axisCoordinate: number, coordinate: number, label: string): number {
  const exact = subtractExact(multiplyExact(2, axisCoordinate), coordinate);
  return exactToSafeNumber(exact, label);
}

export function reflectPointAcrossAxis(
  point: GridPoint,
  axis: AxisReflection,
  axisCoordinate?: number,
): GridPoint {
  const normalized = assertPoint(point, 'Point');

  if (axis === 'horizontal' || axis === 'vertical') {
    const coordinate = assertFiniteBounded(axisCoordinate ?? 0, 'Axis coordinate');
    return axis === 'horizontal'
      ? { x: normalized.x, y: reflectedCoordinate(coordinate, normalized.y, 'Reflected y') }
      : { x: reflectedCoordinate(coordinate, normalized.x, 'Reflected x'), y: normalized.y };
  }

  if (axisCoordinate !== undefined) {
    return geometryError('invalid-axis', 'A shifted coordinate is only valid for horizontal or vertical axes.');
  }
  if (axis === 'diagonal-up') return { x: normalized.y, y: normalized.x };
  if (axis === 'diagonal-down') {
    return { x: normalizeZero(-normalized.y), y: normalizeZero(-normalized.x) };
  }
  return geometryError('invalid-axis', `Unknown reflection axis: ${String(axis)}.`);
}

export function reflectPointThroughCenter(
  point: GridPoint,
  center: GridPoint,
): GridPoint {
  const normalizedPoint = assertPoint(point, 'Point');
  const normalizedCenter = assertPoint(center, 'Center');
  return {
    x: reflectedCoordinate(normalizedCenter.x, normalizedPoint.x, 'Reflected x'),
    y: reflectedCoordinate(normalizedCenter.y, normalizedPoint.y, 'Reflected y'),
  };
}

export function reflectShape(
  points: readonly GridPoint[],
  spec: ShapeReflectionSpec,
): readonly GridPoint[] {
  const rawPoints = assertCollection(points, 'Shape');
  if (typeof spec !== 'object' || spec === null) {
    return geometryError('invalid-axis', 'A reflection specification is required.');
  }
  return rawPoints.map((point) => {
    if (spec.kind === 'axis') {
      return reflectPointAcrossAxis(point as GridPoint, spec.axis, spec.axisCoordinate);
    }
    if (spec.kind === 'center') {
      return reflectPointThroughCenter(point as GridPoint, spec.center);
    }
    return geometryError('invalid-axis', 'Unknown reflection specification.');
  });
}

function pointKey(point: GeometryPoint): string {
  return `${point.x},${point.y}`;
}

export function gridShapeMetrics(cells: readonly GridCell[]): GridShapeMetrics {
  const rawCells = assertCollection(cells, 'Grid shape');
  const unique = new Map<string, GeometryPoint>();
  rawCells.forEach((cell, index) => {
    const normalized = assertIntegerPoint(
      cell as GridCell,
      `Cell ${index + 1}`,
      GEOMETRY_LIMITS.maxGridCoordinateMagnitude,
    );
    unique.set(pointKey(normalized), normalized);
  });

  let perimeter = 0;
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (const cell of unique.values()) {
    for (const [dx, dy] of directions) {
      if (!unique.has(`${cell.x + dx},${cell.y + dy}`)) perimeter += 1;
    }
  }
  return { area: unique.size, perimeter };
}

interface ExactPoint {
  readonly x: ExactRational;
  readonly y: ExactRational;
}

function exactPoint(point: GeometryPoint, label: string): ExactPoint {
  const normalized = assertPoint(point, label);
  return { x: parseExact(normalized.x), y: parseExact(normalized.y) };
}

function exactCross(a: ExactPoint, b: ExactPoint, c: ExactPoint): ExactRational {
  return subtractExact(
    multiplyExact(subtractExact(b.x, a.x), subtractExact(c.y, a.y)),
    multiplyExact(subtractExact(b.y, a.y), subtractExact(c.x, a.x)),
  );
}

function orientation(a: ExactPoint, b: ExactPoint, c: ExactPoint): -1 | 0 | 1 {
  return compareExact(exactCross(a, b, c), ZERO);
}

function between(value: ExactInput, endpointA: ExactInput, endpointB: ExactInput): boolean {
  const lower = compareExact(endpointA, endpointB) <= 0 ? endpointA : endpointB;
  const upper = compareExact(endpointA, endpointB) <= 0 ? endpointB : endpointA;
  return compareExact(value, lower) >= 0 && compareExact(value, upper) <= 0;
}

function onSegment(a: ExactPoint, b: ExactPoint, point: ExactPoint): boolean {
  return (
    orientation(a, b, point) === 0 &&
    between(point.x, a.x, b.x) &&
    between(point.y, a.y, b.y)
  );
}

function segmentsIntersect(a: ExactPoint, b: ExactPoint, c: ExactPoint, d: ExactPoint): boolean {
  const abc = orientation(a, b, c);
  const abd = orientation(a, b, d);
  const cda = orientation(c, d, a);
  const cdb = orientation(c, d, b);
  if (abc !== 0 && abd !== 0 && cda !== 0 && cdb !== 0 && abc !== abd && cda !== cdb) return true;
  return (
    (abc === 0 && onSegment(a, b, c)) ||
    (abd === 0 && onSegment(a, b, d)) ||
    (cda === 0 && onSegment(c, d, a)) ||
    (cdb === 0 && onSegment(c, d, b))
  );
}

function validateSimplePolygon(points: readonly GeometryPoint[]): readonly ExactPoint[] {
  const rawPoints = assertCollection(points, 'Polygon');
  if (rawPoints.length < 3) {
    return geometryError('invalid-shape', 'A polygon needs at least three vertices.');
  }
  const normalized = rawPoints.map((point, index) => exactPoint(point as GeometryPoint, `Vertex ${index + 1}`));
  const keys = new Set<string>();
  rawPoints.forEach((point, index) => {
    const normalizedPoint = assertPoint(point as GeometryPoint, `Vertex ${index + 1}`);
    const key = pointKey(normalizedPoint);
    if (keys.has(key)) geometryError('invalid-shape', 'Polygon vertices must be distinct.');
    keys.add(key);
  });

  for (let first = 0; first < normalized.length; first += 1) {
    const firstNext = (first + 1) % normalized.length;
    for (let second = first + 1; second < normalized.length; second += 1) {
      const secondNext = (second + 1) % normalized.length;
      const adjacent = firstNext === second || secondNext === first;
      if (adjacent) continue;
      if (segmentsIntersect(normalized[first], normalized[firstNext], normalized[second], normalized[secondNext])) {
        return geometryError('invalid-shape', 'Polygon edges must not cross or overlap.');
      }
    }
  }
  return normalized;
}

export function polygonArea(points: readonly GeometryPoint[]): ExactRational {
  const normalized = validateSimplePolygon(points);
  let doubledArea = ZERO;
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    const next = normalized[(index + 1) % normalized.length];
    doubledArea = addExact(
      doubledArea,
      subtractExact(multiplyExact(current.x, next.y), multiplyExact(current.y, next.x)),
    );
  }
  const area = divideExact(exactAbsolute(doubledArea), TWO);
  if (area.numerator === 0n) {
    return geometryError('invalid-shape', 'A polygon must have positive area.');
  }
  return area;
}

export function orthogonalPerimeter(points: readonly GeometryPoint[]): ExactRational {
  const normalized = validateSimplePolygon(points);
  let perimeter = ZERO;
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    const next = normalized[(index + 1) % normalized.length];
    const dx = subtractExact(next.x, current.x);
    const dy = subtractExact(next.y, current.y);
    if (dx.numerator !== 0n && dy.numerator !== 0n) {
      return geometryError('invalid-shape', 'Every side of an orthogonal polygon must follow an axis.');
    }
    perimeter = addExact(perimeter, addExact(exactAbsolute(dx), exactAbsolute(dy)));
  }
  if (perimeter.numerator === 0n) {
    return geometryError('invalid-shape', 'A polygon must have positive perimeter.');
  }
  return perimeter;
}

export function rectangleMeasures(width: ExactInput, height: ExactInput): ExactRectangleMeasures {
  const w = assertPositiveExact(width, 'Width');
  const h = assertPositiveExact(height, 'Height');
  return {
    perimeter: multiplyExact(TWO, addExact(w, h)),
    area: multiplyExact(w, h),
  };
}

export function rectangleMetrics(width: number, height: number): NumericRectangleMetrics {
  const measures = rectangleMeasures(width, height);
  return {
    perimeter: exactToSafeNumber(measures.perimeter, 'Rectangle perimeter'),
    area: exactToSafeNumber(measures.area, 'Rectangle area'),
  };
}

export function estimateGridArea(full: number, partial: number): GridAreaEstimate {
  const fullCells = assertSafeInteger(full, 'Full-cell count', GEOMETRY_LIMITS.maxCollectionSize);
  const partialCells = assertSafeInteger(partial, 'Partial-cell count', GEOMETRY_LIMITS.maxCollectionSize);
  if (fullCells < 0 || partialCells < 0) {
    return geometryError('invalid-number', 'Grid cell counts cannot be negative.');
  }
  return {
    lower: parseExact(fullCells),
    midpoint: addExact(fullCells, divideExact(partialCells, TWO)),
    upper: addExact(fullCells, partialCells),
  };
}

function squaredIntegerDistance(a: GeometryPoint, b: GeometryPoint): bigint {
  const dx = BigInt(b.x - a.x);
  const dy = BigInt(b.y - a.y);
  return dx * dx + dy * dy;
}

export function classifyTriangle(
  points: readonly [GeometryPoint, GeometryPoint, GeometryPoint],
): TriangleFacts {
  const rawPoints = assertCollection(points, 'Triangle');
  if (rawPoints.length !== 3) {
    return geometryError('invalid-shape', 'A triangle needs exactly three vertices.');
  }
  const [a, b, c] = rawPoints.map((point, index) =>
    assertIntegerPoint(point as GeometryPoint, `Triangle vertex ${index + 1}`),
  ) as [GeometryPoint, GeometryPoint, GeometryPoint];

  const twiceArea =
    BigInt(b.x - a.x) * BigInt(c.y - a.y) - BigInt(b.y - a.y) * BigInt(c.x - a.x);
  if (twiceArea === 0n) {
    return geometryError('invalid-shape', 'Triangle vertices must be distinct and non-collinear.');
  }

  const sideSquares = [
    squaredIntegerDistance(a, b),
    squaredIntegerDistance(b, c),
    squaredIntegerDistance(c, a),
  ] as const;
  const [shortest, middle, longest] = [...sideSquares].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  const sideKind: TriangleSideKind =
    shortest === longest
      ? 'equilateral'
      : shortest === middle || middle === longest
        ? 'isosceles'
        : 'scalene';
  const comparison = shortest + middle - longest;
  const angleKind: TriangleAngleKind = comparison === 0n ? 'right' : comparison > 0n ? 'acute' : 'obtuse';
  return { sideKind, angleKind, sideSquares };
}

function bigintCross(ax: bigint, ay: bigint, bx: bigint, by: bigint): bigint {
  return ax * by - ay * bx;
}

function bigintDot(ax: bigint, ay: bigint, bx: bigint, by: bigint): bigint {
  return ax * bx + ay * by;
}

export function inspectQuadrilateral(
  points: readonly [GeometryPoint, GeometryPoint, GeometryPoint, GeometryPoint],
): QuadrilateralFacts {
  const rawPoints = assertCollection(points, 'Quadrilateral');
  if (rawPoints.length !== 4) {
    return geometryError('invalid-shape', 'A quadrilateral needs exactly four vertices.');
  }
  validateSimplePolygon(points);
  const normalized = rawPoints.map((point, index) =>
    assertIntegerPoint(point as GeometryPoint, `Quadrilateral vertex ${index + 1}`),
  ) as [GeometryPoint, GeometryPoint, GeometryPoint, GeometryPoint];
  polygonArea(normalized);

  const vectors = normalized.map((point, index) => {
    const next = normalized[(index + 1) % 4];
    return [BigInt(next.x - point.x), BigInt(next.y - point.y)] as const;
  });
  const sideSquares = vectors.map(([dx, dy]) => dx * dx + dy * dy);
  const firstParallel = bigintCross(...vectors[0], ...vectors[2]) === 0n;
  const secondParallel = bigintCross(...vectors[1], ...vectors[3]) === 0n;
  const parallelPairs = (Number(firstParallel) + Number(secondParallel)) as 0 | 1 | 2;

  let rightAngles = 0;
  for (let index = 0; index < 4; index += 1) {
    const previous = normalized[(index + 3) % 4];
    const current = normalized[index];
    const next = normalized[(index + 1) % 4];
    const incomingX = BigInt(previous.x - current.x);
    const incomingY = BigInt(previous.y - current.y);
    const outgoingX = BigInt(next.x - current.x);
    const outgoingY = BigInt(next.y - current.y);
    if (bigintDot(incomingX, incomingY, outgoingX, outgoingY) === 0n) rightAngles += 1;
  }

  const used = new Set<number>();
  const equalSideGroups: number[][] = [];
  for (let index = 0; index < 4; index += 1) {
    if (used.has(index)) continue;
    const group = [index];
    for (let other = index + 1; other < 4; other += 1) {
      if (sideSquares[index] === sideSquares[other]) group.push(other);
    }
    group.forEach((member) => used.add(member));
    if (group.length > 1) equalSideGroups.push(group);
  }

  const diagonalA = [
    BigInt(normalized[2].x - normalized[0].x),
    BigInt(normalized[2].y - normalized[0].y),
  ] as const;
  const diagonalB = [
    BigInt(normalized[3].x - normalized[1].x),
    BigInt(normalized[3].y - normalized[1].y),
  ] as const;
  const diagonalASquare = bigintDot(...diagonalA, ...diagonalA);
  const diagonalBSquare = bigintDot(...diagonalB, ...diagonalB);
  const allSidesEqual = sideSquares.every((value) => value === sideSquares[0]);
  const kind = rightAngles === 4 ? (allSidesEqual ? 'square' : 'rectangle') : 'other';

  return {
    parallelPairs,
    rightAngles,
    equalSideGroups,
    equalDiagonals: diagonalASquare === diagonalBSquare,
    perpendicularDiagonals: bigintDot(...diagonalA, ...diagonalB) === 0n,
    diagonalsBisectEachOther:
      normalized[0].x + normalized[2].x === normalized[1].x + normalized[3].x &&
      normalized[0].y + normalized[2].y === normalized[1].y + normalized[3].y,
    kind,
  };
}

const LINEAR_UNIT_IN_MILLIMETRES: Readonly<Record<Exclude<MetricUnit, 'a' | 'ha'>, bigint>> = {
  mm: 1n,
  cm: 10n,
  dm: 100n,
  m: 1_000n,
  km: 1_000_000n,
};

function assertDimension(dimension: MetricDimension): MetricDimension {
  if (dimension !== 1 && dimension !== 2 && dimension !== 3) {
    return geometryError('invalid-dimension', 'Metric dimension must be 1, 2, or 3.');
  }
  return dimension;
}

function metricUnitSize(unit: MetricUnit, dimension: MetricDimension): ExactRational {
  assertDimension(dimension);
  if (unit === 'a' || unit === 'ha') {
    if (dimension !== 2) {
      return geometryError('invalid-unit', `${unit} is an area unit and is only valid with dimension 2.`);
    }
    // 1 a = 100 m²; 1 ha = 10 000 m². The base unit here is mm².
    const squareMillimetres = unit === 'a' ? 100_000_000n : 10_000_000_000n;
    return parseExact({ numerator: squareMillimetres, denominator: 1n });
  }
  const millimetres = LINEAR_UNIT_IN_MILLIMETRES[unit];
  if (millimetres === undefined) {
    return geometryError('invalid-unit', `Unknown metric unit: ${String(unit)}.`);
  }
  return parseExact({ numerator: millimetres ** BigInt(dimension), denominator: 1n });
}

export function metricConversionFactor(
  from: MetricUnit,
  to: MetricUnit,
  dimension: MetricDimension,
): number {
  const factor = divideExact(metricUnitSize(from, dimension), metricUnitSize(to, dimension));
  return exactToFiniteNumber(factor, 'Metric conversion factor');
}

export function convertMetricMeasure(
  value: ExactInput,
  from: MetricUnit,
  to: MetricUnit,
  dimension: MetricDimension,
): ExactRational {
  const amount = assertNonNegativeExact(value, 'Metric value');
  const factor = divideExact(metricUnitSize(from, dimension), metricUnitSize(to, dimension));
  return multiplyExact(amount, factor);
}

export function convertMetricValue(
  value: number,
  from: MetricUnit,
  to: MetricUnit,
  dimension: MetricDimension,
): number {
  return exactToFiniteNumber(convertMetricMeasure(value, from, to, dimension), 'Converted metric value');
}

export function circleMeasures(radius: number): CircleMeasures {
  const r = assertPositiveExact(radius, 'Radius');
  return {
    diameter: exactToSafeNumber(multiplyExact(TWO, r), 'Circle diameter'),
    circumferencePiCoefficient: exactToSafeNumber(multiplyExact(TWO, r), 'Circumference coefficient'),
    areaPiCoefficient: exactToSafeNumber(multiplyExact(r, r), 'Circle area coefficient'),
  };
}

export function approximatePiMultiple(
  coefficient: number,
  approximation: PiApproximation,
): number {
  const value = assertNonNegativeExact(coefficient, 'Pi coefficient');
  const pi = approximation === '3.14' ? parseExact('3.14') : approximation === '22/7' ? parseExact('22/7') : null;
  if (pi === null) {
    return geometryError('invalid-number', `Unknown pi approximation: ${String(approximation)}.`);
  }
  return exactToSafeNumber(multiplyExact(value, pi), 'Approximated pi multiple');
}

export function cuboidVolume(
  length: ExactInput,
  width: ExactInput,
  height: ExactInput,
): ExactRational {
  const l = assertPositiveExact(length, 'Length');
  const w = assertPositiveExact(width, 'Width');
  const h = assertPositiveExact(height, 'Height');
  return multiplyExact(multiplyExact(l, w), h);
}

export function cuboidMetrics(length: number, width: number, height: number): CuboidMetrics {
  const l = assertPositiveExact(length, 'Length');
  const w = assertPositiveExact(width, 'Width');
  const h = assertPositiveExact(height, 'Height');
  const volume = multiplyExact(multiplyExact(l, w), h);
  const surfaceArea = multiplyExact(
    TWO,
    addExact(addExact(multiplyExact(l, w), multiplyExact(l, h)), multiplyExact(w, h)),
  );
  return {
    volume: exactToSafeNumber(volume, 'Cuboid volume'),
    surfaceArea: exactToSafeNumber(surfaceArea, 'Cuboid surface area'),
  };
}

type Vector3 = readonly [number, number, number];

interface FaceOrientation {
  readonly right: Vector3;
  readonly up: Vector3;
  readonly normal: Vector3;
}

function negateVector([x, y, z]: Vector3): Vector3 {
  return [-x, -y, -z];
}

function vectorsEqual(a: Vector3, b: Vector3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function orientationsEqual(a: FaceOrientation, b: FaceOrientation): boolean {
  return vectorsEqual(a.right, b.right) && vectorsEqual(a.up, b.up) && vectorsEqual(a.normal, b.normal);
}

function foldOrientation(
  orientation: FaceOrientation,
  dx: -1 | 0 | 1,
  dy: -1 | 0 | 1,
): FaceOrientation {
  if (dx === 1) {
    return { right: negateVector(orientation.normal), up: orientation.up, normal: orientation.right };
  }
  if (dx === -1) {
    return { right: orientation.normal, up: orientation.up, normal: negateVector(orientation.right) };
  }
  if (dy === 1) {
    return { right: orientation.right, up: negateVector(orientation.normal), normal: orientation.up };
  }
  if (dy === -1) {
    return { right: orientation.right, up: orientation.normal, normal: negateVector(orientation.up) };
  }
  return geometryError('invalid-shape', 'Cube-net neighbours must share an edge.');
}

export function validateCubeNet(cells: readonly GridCell[]): CubeNetValidation {
  const rawCells = assertCollection(cells, 'Cube net');
  if (rawCells.length !== 6) return { valid: false, reason: 'cell-count' };

  const cellMap = new Map<string, GeometryPoint>();
  for (let index = 0; index < rawCells.length; index += 1) {
    const cell = assertIntegerPoint(
      rawCells[index] as GridCell,
      `Cube-net cell ${index + 1}`,
      GEOMETRY_LIMITS.maxGridCoordinateMagnitude,
    );
    const key = pointKey(cell);
    if (cellMap.has(key)) return { valid: false, reason: 'duplicate' };
    cellMap.set(key, cell);
  }

  const rootKey = cellMap.keys().next().value as string;
  const orientations = new Map<string, FaceOrientation>([
    [rootKey, { right: [1, 0, 0], up: [0, 1, 0], normal: [0, 0, 1] }],
  ]);
  const queue = [rootKey];
  const neighbours = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const key = queue[queueIndex];
    const cell = cellMap.get(key)!;
    const orientation = orientations.get(key)!;
    for (const [dx, dy] of neighbours) {
      const neighbourKey = `${cell.x + dx},${cell.y + dy}`;
      if (!cellMap.has(neighbourKey)) continue;
      const folded = foldOrientation(orientation, dx, dy);
      const existing = orientations.get(neighbourKey);
      if (existing !== undefined) {
        if (!orientationsEqual(existing, folded)) {
          return { valid: false, reason: 'inconsistent-fold' };
        }
      } else {
        orientations.set(neighbourKey, folded);
        queue.push(neighbourKey);
      }
    }
  }

  if (orientations.size !== 6) return { valid: false, reason: 'disconnected' };
  const normals = new Set([...orientations.values()].map(({ normal }) => normal.join(',')));
  if (normals.size !== 6) return { valid: false, reason: 'overlap' };
  return { valid: true, reason: 'valid' };
}

export function isValidCubeNet(cells: readonly GridCell[]): boolean {
  return validateCubeNet(cells).valid;
}
