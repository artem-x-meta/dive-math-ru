import { describe, expect, it } from 'vitest';
import {
  addVectors,
  angleBetweenDegrees,
  angleKind,
  applyMotion,
  areCollinear,
  arePerpendicular,
  circle,
  circleFromDiameter,
  crossProduct,
  cosineBetween,
  distance,
  dotProduct,
  equalVectors,
  fixedPointsDescription,
  formatCircle,
  formatLine,
  formatNumber,
  formatVector,
  isPointOnCircle,
  isPointOnLine,
  lineDirection,
  lineNormal,
  lineThroughPoints,
  midpoint,
  normalizeLine,
  oppositeVector,
  perpendicularBisector,
  preservesDistance,
  preservesOrientation,
  projectionLength,
  reflectOverLine,
  reflectOverPoint,
  rotatePoint,
  roundTo,
  scaleVector,
  squaredLength,
  subtractVectors,
  translatePoint,
  triangleArea,
  unitVector,
  vec,
  vectorBetween,
  vectorLength,
  isZeroVector,
} from '../src/lib/vectors';

describe('vector construction and equality', () => {
  it('builds a vector from the coordinates of two points', () => {
    expect(vectorBetween({ x: -2, y: 1 }, { x: 3, y: 4 })).toEqual({ x: 5, y: 3 });
    expect(vectorBetween({ x: 3, y: 4 }, { x: -2, y: 1 })).toEqual({ x: -5, y: -3 });
  });

  it('treats equal coordinates as one and the same vector', () => {
    expect(equalVectors(vectorBetween({ x: 0, y: 0 }, { x: 2, y: 3 }), vectorBetween({ x: 5, y: 1 }, { x: 7, y: 4 }))).toBe(true);
    expect(equalVectors(vec(2, 3), vec(3, 2))).toBe(false);
  });

  it('never returns negative zero', () => {
    expect(Object.is(vec(-0, 5).x, 0)).toBe(true);
    expect(Object.is(scaleVector(0, vec(-4, 7)).y, 0)).toBe(true);
  });

  it('rejects coordinates that are not finite numbers', () => {
    expect(() => vec(Number.NaN, 1)).toThrow('конечным числом');
    expect(() => vec(1, Number.POSITIVE_INFINITY)).toThrow('конечным числом');
    expect(() => addVectors(vec(1, 1), { x: 1, y: Number.NaN })).toThrow('конечным числом');
  });
});

describe('operations on vectors', () => {
  it('adds and subtracts coordinatewise', () => {
    expect(addVectors(vec(3, -1), vec(-5, 4))).toEqual({ x: -2, y: 3 });
    expect(subtractVectors(vec(3, -1), vec(-5, 4))).toEqual({ x: 8, y: -5 });
    expect(addVectors(vec(3, -1), oppositeVector(vec(3, -1)))).toEqual({ x: 0, y: 0 });
  });

  it('multiplies both coordinates by the same number', () => {
    expect(scaleVector(-2, vec(3, -1))).toEqual({ x: -6, y: 2 });
    expect(scaleVector(0.5, vec(6, -4))).toEqual({ x: 3, y: -2 });
    expect(isZeroVector(scaleVector(0, vec(6, -4)))).toBe(true);
  });

  it('keeps the squared length exact for integer coordinates', () => {
    expect(squaredLength(vec(3, 4))).toBe(25);
    expect(squaredLength(vec(-5, 12))).toBe(169);
    expect(vectorLength(vec(3, 4))).toBe(5);
    expect(vectorLength(vec(-5, 12))).toBe(13);
  });

  it('computes dot and cross products exactly', () => {
    expect(dotProduct(vec(3, 4), vec(4, -3))).toBe(0);
    expect(dotProduct(vec(2, -1), vec(5, 3))).toBe(7);
    expect(crossProduct(vec(1, 0), vec(0, 1))).toBe(1);
    expect(crossProduct(vec(2, -3), vec(-4, 6))).toBe(0);
  });

  it('detects collinear and perpendicular vectors', () => {
    expect(areCollinear(vec(2, -3), vec(-4, 6))).toBe(true);
    expect(areCollinear(vec(2, -3), vec(3, 2))).toBe(false);
    expect(arePerpendicular(vec(3, 4), vec(4, -3))).toBe(true);
    expect(arePerpendicular(vec(3, 4), vec(1, 0))).toBe(false);
    expect(() => arePerpendicular(vec(0, 0), vec(1, 0))).toThrow('нулевым вектором');
  });

  it('finds the unit vector and the signed projection', () => {
    expect(unitVector(vec(3, 4))).toEqual({ x: 0.6, y: 0.8 });
    expect(projectionLength(vec(3, 4), vec(1, 0))).toBe(3);
    expect(projectionLength(vec(3, 4), vec(0, 5))).toBe(4);
    expect(projectionLength(vec(-3, 4), vec(2, 0))).toBe(-3);
    expect(() => unitVector(vec(0, 0))).toThrow('направления');
    expect(() => projectionLength(vec(1, 1), vec(0, 0))).toThrow('Проекция');
  });
});

describe('angles between vectors', () => {
  it('computes standard angles', () => {
    expect(angleBetweenDegrees(vec(1, 0), vec(0, 1))).toBeCloseTo(90, 10);
    expect(angleBetweenDegrees(vec(1, 0), vec(1, 1))).toBeCloseTo(45, 10);
    expect(angleBetweenDegrees(vec(1, 0), vec(-1, 0))).toBeCloseTo(180, 10);
    expect(angleBetweenDegrees(vec(2, 0), vec(5, 0))).toBeCloseTo(0, 10);
    expect(cosineBetween(vec(1, 1), vec(1, 0))).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it('classifies the angle by the sign of the dot product', () => {
    expect(angleKind(vec(1, 0), vec(0, 5))).toBe('right');
    expect(angleKind(vec(1, 0), vec(1, 1))).toBe('acute');
    expect(angleKind(vec(1, 0), vec(-1, 1))).toBe('obtuse');
    expect(angleKind(vec(1, 0), vec(2, 0))).toBe('zero');
    expect(angleKind(vec(1, 0), vec(-3, 0))).toBe('straight');
    expect(() => angleKind(vec(0, 0), vec(1, 1))).toThrow('нулевым вектором');
  });

  it('clamps the cosine so rounding never leaves the segment from minus one to one', () => {
    expect(cosineBetween(vec(0.1, 0.2), vec(0.3, 0.6))).toBeLessThanOrEqual(1);
    expect(angleBetweenDegrees(vec(0.1, 0.2), vec(0.3, 0.6))).toBeCloseTo(0, 4);
    expect(Number.isNaN(angleBetweenDegrees(vec(0.1, 0.2), vec(0.3, 0.6)))).toBe(false);
  });
});

describe('coordinate method', () => {
  it('finds the midpoint and the distance', () => {
    expect(midpoint({ x: -3, y: 2 }, { x: 5, y: -6 })).toEqual({ x: 1, y: -2 });
    expect(distance({ x: 1, y: 2 }, { x: 4, y: 6 })).toBe(5);
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
  });

  it('computes the area of a triangle from its vertices', () => {
    expect(triangleArea({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 })).toBe(6);
    expect(triangleArea({ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 3, y: 1 })).toBe(0);
  });

  it('writes the equation of a line through two points in canonical form', () => {
    expect(lineThroughPoints({ x: 0, y: 0 }, { x: 2, y: 3 })).toEqual({ a: 3, b: -2, c: 0 });
    expect(lineThroughPoints({ x: 1, y: 2 }, { x: 3, y: 6 })).toEqual({ a: 2, b: -1, c: 0 });
    expect(lineThroughPoints({ x: 0, y: 5 }, { x: 4, y: 5 })).toEqual({ a: 0, b: 1, c: -5 });
    expect(lineThroughPoints({ x: -2, y: 1 }, { x: -2, y: 7 })).toEqual({ a: 1, b: 0, c: 2 });
    expect(() => lineThroughPoints({ x: 1, y: 1 }, { x: 1, y: 1 })).toThrow('совпадающие точки');
  });

  it('reduces the coefficients and fixes the sign', () => {
    expect(normalizeLine({ a: -4, b: 6, c: -10 })).toEqual({ a: 2, b: -3, c: 5 });
    expect(normalizeLine({ a: 0, b: -3, c: 9 })).toEqual({ a: 0, b: 1, c: -3 });
    expect(() => normalizeLine({ a: 0, b: 0, c: 5 })).toThrow('одновременно');
  });

  it('builds the perpendicular bisector of a segment', () => {
    expect(perpendicularBisector({ x: 0, y: 0 }, { x: 4, y: 0 })).toEqual({ a: 1, b: 0, c: -2 });
    const bisector = perpendicularBisector({ x: 1, y: 1 }, { x: 5, y: 3 });
    expect(bisector).toEqual({ a: 2, b: 1, c: -8 });
    expect(isPointOnLine(bisector, midpoint({ x: 1, y: 1 }, { x: 5, y: 3 }))).toBe(true);
    expect(() => perpendicularBisector({ x: 2, y: 2 }, { x: 2, y: 2 })).toThrow('различных точек');
  });

  it('recognizes points on a line and its direction and normal vectors', () => {
    const line = lineThroughPoints({ x: 0, y: 0 }, { x: 2, y: 3 });
    expect(isPointOnLine(line, { x: 4, y: 6 })).toBe(true);
    expect(isPointOnLine(line, { x: 4, y: 5 })).toBe(false);
    expect(lineDirection(line)).toEqual({ x: 2, y: 3 });
    expect(lineNormal(line)).toEqual({ x: 3, y: -2 });
    expect(dotProduct(lineDirection(line), lineNormal(line))).toBe(0);
  });

  it('works with circles given by a centre or by a diameter', () => {
    const shape = circle({ x: 3, y: -2 }, 5);
    expect(isPointOnCircle(shape, { x: 3, y: 3 })).toBe(true);
    expect(isPointOnCircle(shape, { x: 6, y: 2 })).toBe(true);
    expect(isPointOnCircle(shape, { x: 6, y: 3 })).toBe(false);
    const fromDiameter = circleFromDiameter({ x: -1, y: 2 }, { x: 5, y: 10 });
    expect(fromDiameter).toEqual({ center: { x: 2, y: 6 }, radius: 5 });
    expect(isPointOnCircle(fromDiameter, { x: -1, y: 2 })).toBe(true);
    expect(() => circle({ x: 0, y: 0 }, 0)).toThrow('положительным');
    expect(() => circleFromDiameter({ x: 1, y: 1 }, { x: 1, y: 1 })).toThrow('нулевым');
  });
});

describe('motions of the plane', () => {
  it('translates a point by a vector', () => {
    expect(translatePoint({ x: -1, y: 4 }, vec(3, -6))).toEqual({ x: 2, y: -2 });
  });

  it('reflects a point in a line', () => {
    expect(reflectOverLine({ x: 3, y: 5 }, { a: 0, b: 1, c: 0 })).toEqual({ x: 3, y: -5 });
    expect(reflectOverLine({ x: 3, y: 5 }, { a: 1, b: 0, c: 0 })).toEqual({ x: -3, y: 5 });
    expect(reflectOverLine({ x: 3, y: 5 }, { a: 1, b: -1, c: 0 })).toEqual({ x: 5, y: 3 });
    const image = reflectOverLine({ x: 2, y: 7 }, { a: 1, b: 0, c: -4 });
    expect(image).toEqual({ x: 6, y: 7 });
  });

  it('reflects a point in a centre', () => {
    expect(reflectOverPoint({ x: 3, y: 5 }, { x: 1, y: 1 })).toEqual({ x: -1, y: -3 });
    expect(reflectOverPoint({ x: 2, y: -3 }, { x: 0, y: 0 })).toEqual({ x: -2, y: 3 });
    expect(midpoint({ x: 3, y: 5 }, reflectOverPoint({ x: 3, y: 5 }, { x: 1, y: 1 }))).toEqual({ x: 1, y: 1 });
  });

  it('rotates exactly by multiples of ninety degrees', () => {
    const origin = { x: 0, y: 0 };
    expect(rotatePoint({ x: 3, y: 1 }, origin, 90)).toEqual({ x: -1, y: 3 });
    expect(rotatePoint({ x: 3, y: 1 }, origin, 180)).toEqual({ x: -3, y: -1 });
    expect(rotatePoint({ x: 3, y: 1 }, origin, 270)).toEqual({ x: 1, y: -3 });
    expect(rotatePoint({ x: 3, y: 1 }, origin, -90)).toEqual({ x: 1, y: -3 });
    expect(rotatePoint({ x: 3, y: 1 }, origin, 360)).toEqual({ x: 3, y: 1 });
    expect(rotatePoint({ x: 3, y: 1 }, { x: 1, y: 1 }, 180)).toEqual({ x: -1, y: 1 });
  });

  it('rotates approximately by an arbitrary angle', () => {
    const turned = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, 60);
    expect(turned.x).toBeCloseTo(0.5, 10);
    expect(turned.y).toBeCloseTo(Math.sqrt(3) / 2, 10);
    expect(vectorLength(turned)).toBeCloseTo(1, 12);
  });

  it('applies a motion described by an object', () => {
    expect(applyMotion({ kind: 'translation', vector: vec(2, -1) }, { x: 0, y: 0 })).toEqual({ x: 2, y: -1 });
    expect(applyMotion({ kind: 'axial-symmetry', line: { a: 0, b: 1, c: 0 } }, { x: 4, y: 3 })).toEqual({ x: 4, y: -3 });
    expect(applyMotion({ kind: 'central-symmetry', center: { x: 1, y: 0 } }, { x: 4, y: 3 })).toEqual({ x: -2, y: -3 });
    expect(applyMotion({ kind: 'rotation', center: { x: 0, y: 0 }, degrees: 90 }, { x: 4, y: 3 })).toEqual({ x: -3, y: 4 });
  });

  it('preserves distances for every motion', () => {
    const first = { x: -2, y: 5 };
    const second = { x: 4, y: -1 };
    expect(preservesDistance({ kind: 'translation', vector: vec(7, -3) }, first, second)).toBe(true);
    expect(preservesDistance({ kind: 'axial-symmetry', line: { a: 1, b: -1, c: 2 } }, first, second)).toBe(true);
    expect(preservesDistance({ kind: 'central-symmetry', center: { x: 3, y: 3 } }, first, second)).toBe(true);
    expect(preservesDistance({ kind: 'rotation', center: { x: 1, y: 2 }, degrees: 37 }, first, second)).toBe(true);
  });

  it('knows which motions keep the direction of a traversal', () => {
    expect(preservesOrientation('translation')).toBe(true);
    expect(preservesOrientation('rotation')).toBe(true);
    expect(preservesOrientation('central-symmetry')).toBe(true);
    expect(preservesOrientation('axial-symmetry')).toBe(false);
  });

  it('agrees with the sign of the cross product about orientation', () => {
    const first = { x: 0, y: 0 };
    const second = { x: 4, y: 0 };
    const third = { x: 0, y: 3 };
    const before = crossProduct(vectorBetween(first, second), vectorBetween(first, third));
    const line = { a: 0, b: 1, c: 0 };
    const reflected = [first, second, third].map((point) => reflectOverLine(point, line));
    const after = crossProduct(
      vectorBetween(reflected[0]!, reflected[1]!),
      vectorBetween(reflected[0]!, reflected[2]!),
    );
    expect(Math.sign(after)).toBe(-Math.sign(before));
  });

  it('describes the fixed points of each motion', () => {
    expect(fixedPointsDescription({ kind: 'translation', vector: vec(1, 1) })).toContain('нет');
    expect(fixedPointsDescription({ kind: 'translation', vector: vec(0, 0) })).toContain('все точки');
    expect(fixedPointsDescription({ kind: 'axial-symmetry', line: { a: 1, b: 0, c: 0 } })).toContain('оси');
    expect(fixedPointsDescription({ kind: 'central-symmetry', center: { x: 0, y: 0 } })).toContain('центр');
    expect(fixedPointsDescription({ kind: 'rotation', center: { x: 0, y: 0 }, degrees: 90 })).toContain('центр');
    expect(fixedPointsDescription({ kind: 'rotation', center: { x: 0, y: 0 }, degrees: 720 })).toContain('все точки');
  });
});

describe('russian formatting', () => {
  it('rounds and writes numbers with a decimal comma and a proper minus', () => {
    expect(roundTo(2.345, 2)).toBe(2.35);
    expect(roundTo(-2.344, 2)).toBe(-2.34);
    expect(Object.is(roundTo(-0.004, 2), 0)).toBe(true);
    expect(formatNumber(2.5)).toBe('2,5');
    expect(formatNumber(-3)).toBe('−3');
    expect(formatNumber(1 / 3)).toBe('0,33');
    expect(formatNumber(Math.sqrt(2), 3)).toBe('1,414');
    expect(() => roundTo(1, 1.5)).toThrow('целым от 0 до 10');
  });

  it('writes vectors, lines and circles the way the textbook does', () => {
    expect(formatVector(vec(3, -2))).toBe('(3; −2)');
    expect(formatLine({ a: 1, b: -2, c: 3 })).toBe('x − 2y + 3 = 0');
    expect(formatLine({ a: 0, b: 1, c: -5 })).toBe('y − 5 = 0');
    expect(formatLine({ a: 3, b: -2, c: 0 })).toBe('3x − 2y = 0');
    expect(formatLine({ a: -1, b: 0, c: 0 })).toBe('x = 0');
    expect(formatCircle(circle({ x: 3, y: -2 }, 5))).toBe('(x − 3)² + (y + 2)² = 25');
    expect(formatCircle(circle({ x: 0, y: 0 }, 3))).toBe('x² + y² = 9');
  });
});

/**
 * Ниже машинно проверяются числа, напечатанные в главе 5 девятого класса
 * «Векторы и движения»: разобранные примеры, ответы к практике и практикум.
 * Если формулировка задачи изменится, тест обязан измениться вместе с ней.
 */
describe('numbers printed in the chapter «Векторы и движения»', () => {
  it('checks the worked examples and answers of lesson 5.1', () => {
    // Лодка и течение: (0;4) + (3;0) = (3;4), длина 5.
    expect(addVectors(vec(0, 4), vec(3, 0))).toEqual({ x: 3, y: 4 });
    expect(vectorLength(addVectors(vec(0, 4), vec(3, 0)))).toBe(5);
    // Практика 1.
    expect(addVectors(vec(3, -4), vec(-1, 6))).toEqual({ x: 2, y: 2 });
    expect(subtractVectors(vec(3, -4), vec(-1, 6))).toEqual({ x: 4, y: -10 });
    expect(scaleVector(3, vec(3, -4))).toEqual({ x: 9, y: -12 });
    expect(scaleVector(-0.5, vec(-1, 6))).toEqual({ x: 0.5, y: -3 });
    // Практика 2, 3, 4.
    expect(vectorBetween({ x: -2, y: 5 }, { x: 4, y: -3 })).toEqual({ x: 6, y: -8 });
    expect(vectorBetween({ x: 4, y: -3 }, { x: -2, y: 5 })).toEqual({ x: -6, y: 8 });
    expect(scaleVector(-2, vec(2, -3))).toEqual({ x: -4, y: 6 });
    expect(areCollinear(vec(3, -2), vec(-6, 4))).toBe(true);
    // Практика 7, 8, 9.
    expect(scaleVector(0.5, subtractVectors(vec(-2, 6), vec(4, -2)))).toEqual({ x: -3, y: 4 });
    expect(addVectors(vec(5, 1), vec(-1, 3))).toEqual({ x: 4, y: 4 });
    expect(subtractVectors(vec(5, 1), vec(-1, 3))).toEqual({ x: 6, y: -2 });
    expect(subtractVectors(scaleVector(2, vec(1, -2)), scaleVector(3, vec(-2, 1)))).toEqual({ x: 8, y: -7 });
    // Три длины суммы для |a| = 3 и |b| = 4: 7, 1 и 5.
    expect(vectorLength(addVectors(vec(3, 0), vec(4, 0)))).toBe(7);
    expect(vectorLength(addVectors(vec(3, 0), vec(-4, 0)))).toBe(1);
    expect(vectorLength(addVectors(vec(3, 0), vec(0, 4)))).toBe(5);
  });

  it('checks the coordinate method of lesson 5.2', () => {
    // Разобранный пример: A(−2;1), B(4;9).
    expect(vectorBetween({ x: -2, y: 1 }, { x: 4, y: 9 })).toEqual({ x: 6, y: 8 });
    expect(distance({ x: -2, y: 1 }, { x: 4, y: 9 })).toBe(10);
    expect(midpoint({ x: -2, y: 1 }, { x: 4, y: 9 })).toEqual({ x: 1, y: 5 });
    expect(formatCircle(circleFromDiameter({ x: -2, y: 1 }, { x: 4, y: 9 }))).toBe('(x − 1)² + (y − 5)² = 25');
    expect(isPointOnCircle(circle({ x: 1, y: 5 }, 5), { x: 4, y: 9 })).toBe(true);
    expect(isPointOnCircle(circle({ x: 1, y: 5 }, 5), { x: 0, y: 0 })).toBe(false);
    // Прямая через A(1;2) и B(3;6) — это y = 2x.
    expect(formatLine(lineThroughPoints({ x: 1, y: 2 }, { x: 3, y: 6 }))).toBe('2x − y = 0');
    // Практика 1–4.
    expect(vectorBetween({ x: 1, y: -3 }, { x: 7, y: 5 })).toEqual({ x: 6, y: 8 });
    expect(distance({ x: 1, y: -3 }, { x: 7, y: 5 })).toBe(10);
    expect(midpoint({ x: 1, y: -3 }, { x: 7, y: 5 })).toEqual({ x: 4, y: 1 });
    expect(vectorLength(vec(-5, 12))).toBe(13);
    expect(distance({ x: -2, y: -1 }, { x: 3, y: 11 })).toBe(13);
    expect(reflectOverPoint({ x: -3, y: 4 }, { x: 2, y: -1 })).toEqual({ x: 7, y: -6 });
    // Практика 5–8.
    expect(formatCircle(circle({ x: 2, y: -5 }, 3))).toBe('(x − 2)² + (y + 5)² = 9');
    expect(formatCircle(circle({ x: 3, y: -2 }, 5))).toBe('(x − 3)² + (y + 2)² = 25');
    expect(isPointOnCircle(circle({ x: 3, y: -2 }, 5), { x: 6, y: 2 })).toBe(true);
    expect(isPointOnCircle(circle({ x: 3, y: -2 }, 5), { x: 0, y: 0 })).toBe(false);
    expect(formatCircle(circleFromDiameter({ x: -1, y: 2 }, { x: 5, y: 10 }))).toBe('(x − 2)² + (y − 6)² = 25');
    // Практика 9–12.
    expect(formatLine(lineThroughPoints({ x: 0, y: 0 }, { x: 2, y: 3 }))).toBe('3x − 2y = 0');
    expect(formatLine(lineThroughPoints({ x: -2, y: 1 }, { x: -2, y: 7 }))).toBe('x + 2 = 0');
    expect(formatLine(lineThroughPoints({ x: 0, y: 5 }, { x: 4, y: 5 }))).toBe('y − 5 = 0');
    expect(formatLine(perpendicularBisector({ x: 1, y: 1 }, { x: 5, y: 3 }))).toBe('2x + y − 8 = 0');
    expect(isPointOnLine(perpendicularBisector({ x: 1, y: 1 }, { x: 5, y: 3 }), { x: 4, y: 0 })).toBe(true);
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 3 })).toBeCloseTo(distance({ x: 6, y: 0 }, { x: 3, y: 3 }), 12);
    expect(distance({ x: 3, y: 3 }, midpoint({ x: 0, y: 0 }, { x: 6, y: 0 }))).toBe(3);
  });

  it('checks the dot products and angles of lesson 5.3', () => {
    // Прогноз урока: (4;3) и (3;−4) перпендикулярны.
    expect(dotProduct(vec(4, 3), vec(3, -4))).toBe(0);
    expect(angleBetweenDegrees(vec(4, 3), vec(3, -4))).toBeCloseTo(90, 10);
    // Разобранный пример: 45°.
    expect(dotProduct(vec(1, 2), vec(3, 1))).toBe(5);
    expect(angleBetweenDegrees(vec(1, 2), vec(3, 1))).toBeCloseTo(45, 10);
    // Треугольник A(1;2), B(5;2), C(1;5): 90°, ≈36,9° и ≈53,1°, в сумме 180°.
    const a = { x: 1, y: 2 };
    const b = { x: 5, y: 2 };
    const c = { x: 1, y: 5 };
    const angleA = angleBetweenDegrees(vectorBetween(a, b), vectorBetween(a, c));
    const angleB = angleBetweenDegrees(vectorBetween(b, a), vectorBetween(b, c));
    const angleC = angleBetweenDegrees(vectorBetween(c, a), vectorBetween(c, b));
    expect(angleA).toBeCloseTo(90, 10);
    expect(roundTo(angleB, 1)).toBe(36.9);
    expect(roundTo(angleC, 1)).toBe(53.1);
    expect(angleA + angleB + angleC).toBeCloseTo(180, 10);
    expect(cosineBetween(vectorBetween(b, a), vectorBetween(b, c))).toBeCloseTo(0.8, 12);
    expect(cosineBetween(vectorBetween(c, a), vectorBetween(c, b))).toBeCloseTo(0.6, 12);
    // Подбор координаты: t = 1,5.
    expect(dotProduct(vec(1.5, 3), vec(4, -2))).toBe(0);
    // Практика 1–3, 5, 6, 11.
    expect(dotProduct(vec(3, -2), vec(-1, 4))).toBe(-11);
    expect(dotProduct(vec(-6, 8), vec(-6, 8))).toBe(100);
    expect(vectorLength(vec(-6, 8))).toBe(10);
    expect(arePerpendicular(vec(2, -1), vec(3, 6))).toBe(true);
    expect(angleBetweenDegrees(vec(1, 0), vec(1, 1))).toBeCloseTo(45, 10);
    expect(angleBetweenDegrees(vec(2, 2), vec(-3, 0))).toBeCloseTo(135, 10);
    expect(roundTo(cosineBetween(vec(8, 6), vec(-8, 6)), 2)).toBe(-0.28);
    // Практика 12: ABCD — квадрат.
    const square = [{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 1, y: 7 }, { x: -3, y: 4 }];
    const sides = square.map((point, index) => vectorBetween(point, square[(index + 1) % 4]!));
    expect(sides.map((side) => vectorLength(side))).toEqual([5, 5, 5, 5]);
    expect(sides.map((side, index) => dotProduct(side, sides[(index + 1) % 4]!))).toEqual([0, 0, 0, 0]);
    // Ловушка: одинаковое произведение не означает равенства векторов.
    expect(dotProduct(vec(1, 0), vec(2, 5))).toBe(dotProduct(vec(1, 0), vec(2, -3)));
    expect(equalVectors(vec(2, 5), vec(2, -3))).toBe(false);
  });

  it('checks the motions of lesson 5.4', () => {
    // Перенос по двум точкам.
    const shift = vectorBetween({ x: -3, y: 4 }, { x: 2, y: 1 });
    expect(shift).toEqual({ x: 5, y: -3 });
    expect(translatePoint({ x: 1, y: 1 }, shift)).toEqual({ x: 6, y: -2 });
    expect(translatePoint({ x: -4, y: 3 }, vec(6, -5))).toEqual({ x: 2, y: -2 });
    // Поворот треугольника на 90°.
    const origin = { x: 0, y: 0 };
    expect(rotatePoint({ x: 2, y: 1 }, origin, 90)).toEqual({ x: -1, y: 2 });
    expect(rotatePoint({ x: 5, y: 1 }, origin, 90)).toEqual({ x: -1, y: 5 });
    expect(rotatePoint({ x: 2, y: 3 }, origin, 90)).toEqual({ x: -3, y: 2 });
    // Практика 3–7.
    expect(reflectOverLine({ x: 3, y: -7 }, { a: 0, b: 1, c: 0 })).toEqual({ x: 3, y: 7 });
    expect(reflectOverLine({ x: 3, y: -7 }, { a: 1, b: 0, c: 0 })).toEqual({ x: -3, y: -7 });
    expect(reflectOverPoint({ x: 3, y: -7 }, origin)).toEqual({ x: -3, y: 7 });
    expect(reflectOverPoint({ x: 3, y: -7 }, { x: 1, y: 2 })).toEqual({ x: -1, y: 11 });
    expect(midpoint({ x: 6, y: -2 }, { x: -2, y: 4 })).toEqual({ x: 2, y: 1 });
    expect(rotatePoint({ x: 4, y: 1 }, origin, 90)).toEqual({ x: -1, y: 4 });
    expect(rotatePoint({ x: 4, y: 1 }, origin, 180)).toEqual({ x: -4, y: -1 });
    expect(rotatePoint({ x: 4, y: 1 }, origin, -90)).toEqual({ x: 1, y: -4 });
    expect(reflectOverLine({ x: -2, y: 5 }, { a: 1, b: -1, c: 0 })).toEqual({ x: 5, y: -2 });
    // Практика 8: поворот на 180° сохраняет все три стороны.
    const triangle = [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 1, y: 5 }];
    const turned = triangle.map((point) => rotatePoint(point, origin, 180));
    expect(turned).toEqual([{ x: -1, y: -1 }, { x: -4, y: -1 }, { x: -1, y: -5 }]);
    expect(distance(triangle[0]!, triangle[1]!)).toBe(distance(turned[0]!, turned[1]!));
    expect(distance(triangle[0]!, triangle[2]!)).toBe(distance(turned[0]!, turned[2]!));
    expect(distance(triangle[1]!, triangle[2]!)).toBe(5);
    expect(distance(turned[1]!, turned[2]!)).toBe(5);
    // Практика 10: две симметрии относительно x = 1 и x = 4 дают перенос на (6;0).
    const mirrored = reflectOverLine(reflectOverLine({ x: 0, y: 3 }, { a: 1, b: 0, c: -1 }), { a: 1, b: 0, c: -4 });
    expect(mirrored).toEqual(translatePoint({ x: 0, y: 3 }, vec(6, 0)));
    // Схема урока: та же композиция для вершин треугольника (1;4), (1;2), (0;2)
    // относительно прямых x = 2 и x = 5.
    const figure = [{ x: 1, y: 4 }, { x: 1, y: 2 }, { x: 0, y: 2 }];
    const first = figure.map((point) => reflectOverLine(point, { a: 1, b: 0, c: -2 }));
    const second = first.map((point) => reflectOverLine(point, { a: 1, b: 0, c: -5 }));
    expect(first).toEqual([{ x: 3, y: 4 }, { x: 3, y: 2 }, { x: 4, y: 2 }]);
    expect(second).toEqual([{ x: 7, y: 4 }, { x: 7, y: 2 }, { x: 6, y: 2 }]);
    // Практика 12: поворот сохраняет длину отрезка.
    expect(rotatePoint({ x: 4, y: 2 }, origin, 90)).toEqual({ x: -2, y: 4 });
    expect(distance(origin, { x: 4, y: 2 })).toBeCloseTo(distance(origin, { x: -2, y: 4 }), 12);
    // Ориентация: только осевая симметрия переворачивает обход.
    expect(preservesOrientation('axial-symmetry')).toBe(false);
    expect(preservesOrientation('central-symmetry')).toBe(true);
  });

  it('checks the drone project of lesson 5.5', () => {
    const hangar = { x: 0, y: 0 };
    const firstLeg = vec(6, 8);
    const secondLeg = vec(8, -6);
    const b = translatePoint(hangar, firstLeg);
    const c = translatePoint(b, secondLeg);
    expect(b).toEqual({ x: 6, y: 8 });
    expect(c).toEqual({ x: 14, y: 2 });
    expect(vectorLength(firstLeg)).toBe(10);
    expect(vectorLength(secondLeg)).toBe(10);
    expect(addVectors(firstLeg, secondLeg)).toEqual({ x: 14, y: 2 });
    expect(squaredLength(vectorBetween(hangar, c))).toBe(200);
    expect(roundTo(distance(hangar, c), 1)).toBe(14.1);
    expect(dotProduct(firstLeg, secondLeg)).toBe(0);
    expect(midpoint(hangar, c)).toEqual({ x: 7, y: 1 });
    // Зона связи радиуса 12: B внутри, C снаружи.
    expect(squaredLength(vectorBetween(hangar, b))).toBe(100);
    expect(squaredLength(vectorBetween(hangar, b)) < 144).toBe(true);
    expect(squaredLength(vectorBetween(hangar, c)) > 144).toBe(true);
    // Угол между первым курсом и направлением на север.
    expect(dotProduct(firstLeg, vec(0, 1))).toBe(8);
    expect(cosineBetween(firstLeg, vec(0, 1))).toBeCloseTo(0.8, 12);
    expect(roundTo(angleBetweenDegrees(firstLeg, vec(0, 1)), 1)).toBe(36.9);
    // Прямая AB, возврат в ангар, симметрия и поворот.
    expect(formatLine(lineThroughPoints(hangar, b))).toBe('4x − 3y = 0');
    expect(vectorBetween(c, hangar)).toEqual({ x: -14, y: -2 });
    expect(addVectors(addVectors(firstLeg, secondLeg), vectorBetween(c, hangar))).toEqual({ x: 0, y: 0 });
    expect(reflectOverLine(b, { a: 1, b: 0, c: 0 })).toEqual({ x: -6, y: 8 });
    expect(reflectOverLine(c, { a: 1, b: 0, c: 0 })).toEqual({ x: -14, y: 2 });
    expect(rotatePoint({ x: 3, y: 2 }, hangar, 90)).toEqual({ x: -2, y: 3 });
    // Расстояние BC, площадь и прямой угол при вершине B.
    expect(distance(b, c)).toBe(10);
    expect(triangleArea(hangar, b, c)).toBe(50);
    expect(dotProduct(vectorBetween(b, hangar), vectorBetween(b, c))).toBe(0);
  });
});
