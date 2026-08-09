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
