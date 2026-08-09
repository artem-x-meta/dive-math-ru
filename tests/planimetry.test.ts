import { describe, expect, it } from 'vitest';
import {
  adjacentAngle,
  crossingAngles,
  exteriorAngle,
  exteriorAngleFromRemote,
  isoscelesApexAngle,
  isoscelesBaseAngle,
  thirdTriangleAngle,
  transversalPairAngle,
  triangleApexPoint,
  triangleSidesFromBase,
  verticalAngle,
} from '../src/lib/planimetry';

describe('adjacent and vertical angles', () => {
  it('computes the supplement exactly, including decimal degrees', () => {
    expect(adjacentAngle(35)).toBe(145);
    expect(adjacentAngle(90)).toBe(90);
    expect(adjacentAngle(62.3)).toBe(117.7);
  });

  it('keeps the vertical angle equal to the original', () => {
    expect(verticalAngle(35)).toBe(35);
    expect(verticalAngle(117.7)).toBe(117.7);
  });

  it('lists the four angles around the crossing point', () => {
    expect(crossingAngles(40)).toEqual([40, 140, 40, 140]);
    expect(crossingAngles(90)).toEqual([90, 90, 90, 90]);
  });

  it('rejects degenerate and non-finite angles', () => {
    expect(() => adjacentAngle(0)).toThrow('строго между');
    expect(() => adjacentAngle(180)).toThrow('строго между');
    expect(() => verticalAngle(-5)).toThrow('строго между');
    expect(() => adjacentAngle(Number.NaN)).toThrow('конечным числом');
  });
});

describe('parallel lines and a transversal', () => {
  it('keeps corresponding and alternate angles equal to the source angle', () => {
    expect(transversalPairAngle('corresponding', 64)).toBe(64);
    expect(transversalPairAngle('alternate', 64)).toBe(64);
  });

  it('makes co-interior angles supplementary', () => {
    expect(transversalPairAngle('co-interior', 64)).toBe(116);
    expect(transversalPairAngle('co-interior', 90)).toBe(90);
  });

  it('rejects unknown pair kinds', () => {
    expect(() => transversalPairAngle('diagonal' as never, 30)).toThrow('Неизвестный вид пары');
  });
});

describe('triangle angle theorems', () => {
  it('finds the third angle from the other two', () => {
    expect(thirdTriangleAngle(60, 60)).toBe(60);
    expect(thirdTriangleAngle(90, 30)).toBe(60);
    expect(thirdTriangleAngle(35.5, 44.5)).toBe(100);
  });

  it('computes the exterior angle both ways consistently', () => {
    expect(exteriorAngle(75)).toBe(105);
    expect(exteriorAngleFromRemote(65, 40)).toBe(105);
    expect(exteriorAngleFromRemote(65, 40)).toBe(exteriorAngle(thirdTriangleAngle(65, 40)));
  });

  it('rejects pairs whose sum is not below a straight angle', () => {
    expect(() => thirdTriangleAngle(120, 60)).toThrow('меньше 180');
    expect(() => thirdTriangleAngle(179, 1.5)).toThrow('меньше 180');
    expect(() => exteriorAngleFromRemote(90, 90)).toThrow('меньше 180');
  });
});

describe('isosceles triangle', () => {
  it('finds base angles from the apex angle and back', () => {
    expect(isoscelesBaseAngle(40)).toBe(70);
    expect(isoscelesBaseAngle(90)).toBe(45);
    expect(isoscelesApexAngle(70)).toBe(40);
    expect(isoscelesApexAngle(45)).toBe(90);
  });

  it('round-trips exactly for decimal degrees', () => {
    expect(isoscelesApexAngle(isoscelesBaseAngle(36.4))).toBe(36.4);
  });

  it('rejects base angles that leave no room for the apex', () => {
    expect(() => isoscelesApexAngle(90)).toThrow('между 0° и 90°');
    expect(() => isoscelesApexAngle(0)).toThrow('между 0° и 90°');
  });
});

describe('triangle determined by ASA data', () => {
  it('places the apex of an equilateral-like triangle symmetrically', () => {
    const apex = triangleApexPoint(6, 60, 60);
    expect(apex.x).toBeCloseTo(3, 9);
    expect(apex.y).toBeCloseTo(3 * Math.sqrt(3), 9);
  });

  it('handles a right angle at A without dividing by zero', () => {
    const apex = triangleApexPoint(4, 90, 45);
    expect(apex.x).toBeCloseTo(0, 9);
    expect(apex.y).toBeCloseTo(4, 9);
  });

  it('moves the apex outside the base for an obtuse angle at A', () => {
    const apex = triangleApexPoint(4, 120, 30);
    expect(apex.x).toBeLessThan(0);
    expect(apex.y).toBeGreaterThan(0);
  });

  it('computes side lengths by the law of sines', () => {
    const sides = triangleSidesFromBase(6, 60, 60);
    expect(sides.ab).toBe(6);
    expect(sides.bc).toBeCloseTo(6, 9);
    expect(sides.ca).toBeCloseTo(6, 9);

    const right = triangleSidesFromBase(5, 90, 30);
    // C = 60°, BC = 5·sin90/sin60, CA = 5·sin30/sin60.
    expect(right.bc).toBeCloseTo(5 / Math.sin(Math.PI / 3), 9);
    expect(right.ca).toBeCloseTo(2.5 / Math.sin(Math.PI / 3), 9);
  });

  it('keeps the apex consistent with the reported side lengths', () => {
    const apex = triangleApexPoint(7, 50, 75);
    const sides = triangleSidesFromBase(7, 50, 75);
    expect(Math.hypot(apex.x, apex.y)).toBeCloseTo(sides.ca, 9);
    expect(Math.hypot(apex.x - 7, apex.y)).toBeCloseTo(sides.bc, 9);
  });

  it('rejects a non-positive base and an impossible angle pair', () => {
    expect(() => triangleApexPoint(0, 60, 60)).toThrow('положительным');
    expect(() => triangleApexPoint(5, 100, 80)).toThrow('меньше 180');
    expect(() => triangleSidesFromBase(-2, 60, 60)).toThrow('положительным');
  });
});
