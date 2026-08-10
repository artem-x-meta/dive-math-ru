import { describe, expect, it } from 'vitest';
import {
  adjacentAngle,
  anglesImplyParallel,
  canFormTriangle,
  convexPolygonAngleSum,
  crossingAngles,
  exteriorAngle,
  exteriorAngleFromRemote,
  extendSegment,
  isoscelesApexAngle,
  isoscelesBaseAngle,
  isoscelesLayout,
  parallelogramFourthVertex,
  parallelogramLayout,
  polygonFanCut,
  polygonVerticesFromAngleSum,
  regularPolygonAngle,
  rotatePoint,
  segmentMidpoint,
  thirdSideRange,
  thirdTriangleAngle,
  transversalPairAngle,
  triangleApexPoint,
  triangleInequality,
  triangleLayout,
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

describe('parallelism criterion', () => {
  it('accepts equal corresponding and alternate angles', () => {
    expect(anglesImplyParallel('corresponding', 72, 72)).toBe(true);
    expect(anglesImplyParallel('alternate', 72, 72)).toBe(true);
    expect(anglesImplyParallel('alternate', 72, 73)).toBe(false);
  });

  it('accepts co-interior angles only when they add up to a straight angle', () => {
    expect(anglesImplyParallel('co-interior', 110, 70)).toBe(true);
    expect(anglesImplyParallel('co-interior', 110, 71)).toBe(false);
    expect(anglesImplyParallel('co-interior', 62.5, 117.5)).toBe(true);
  });

  it('rejects unknown pair kinds and degenerate angles', () => {
    expect(() => anglesImplyParallel('diagonal' as never, 40, 40)).toThrow('Неизвестный вид пары');
    expect(() => anglesImplyParallel('alternate', 0, 40)).toThrow('строго между');
  });
});

describe('sum of angles of a convex polygon', () => {
  it('matches the triangle and the quadrilateral', () => {
    expect(convexPolygonAngleSum(3)).toBe(180);
    expect(convexPolygonAngleSum(4)).toBe(360);
    expect(convexPolygonAngleSum(12)).toBe(1800);
  });

  it('rejects figures that cannot be closed', () => {
    expect(() => convexPolygonAngleSum(2)).toThrow('не меньше трёх');
    expect(() => convexPolygonAngleSum(4.5)).toThrow('не меньше трёх');
  });

  it('counts the diagonals and the triangles of the fan cut', () => {
    expect(polygonFanCut(3)).toEqual({ vertices: 3, diagonals: 0, triangles: 1, angleSum: 180 });
    expect(polygonFanCut(4)).toEqual({ vertices: 4, diagonals: 1, triangles: 2, angleSum: 360 });
    expect(polygonFanCut(5)).toEqual({ vertices: 5, diagonals: 2, triangles: 3, angleSum: 540 });
    expect(polygonFanCut(6)).toEqual({ vertices: 6, diagonals: 3, triangles: 4, angleSum: 720 });
  });

  it('always makes the triangle count exceed the diagonal count by one', () => {
    for (const n of [3, 4, 5, 6, 8, 12, 100]) {
      const cut = polygonFanCut(n);
      expect(cut.triangles).toBe(cut.diagonals + 1);
      expect(cut.angleSum).toBe(convexPolygonAngleSum(n));
    }
  });

  it('splits the sum evenly between the vertices of a regular polygon', () => {
    expect(regularPolygonAngle(3)).toBe(60);
    expect(regularPolygonAngle(4)).toBe(90);
    expect(regularPolygonAngle(5)).toBe(108);
    expect(regularPolygonAngle(6)).toBe(120);
    expect(regularPolygonAngle(8)).toBe(135);
    expect(regularPolygonAngle(12)).toBe(150);
    // Не всякий угол целый: у семиугольника 900/7 = 128,571…
    expect(regularPolygonAngle(7)).toBeCloseTo(900 / 7, 12);
  });

  it('keeps every angle of a convex polygon below a straight angle', () => {
    for (const n of [3, 4, 5, 6, 7, 8, 12, 100]) {
      expect(regularPolygonAngle(n)).toBeLessThan(180);
      expect(regularPolygonAngle(n) * n).toBeCloseTo(convexPolygonAngleSum(n), 9);
    }
  });

  it('recovers the number of sides from the angle sum', () => {
    expect(polygonVerticesFromAngleSum(180)).toBe(3);
    expect(polygonVerticesFromAngleSum(360)).toBe(4);
    expect(polygonVerticesFromAngleSum(1080)).toBe(8);
    expect(polygonVerticesFromAngleSum(1440)).toBe(10);
    expect(polygonVerticesFromAngleSum(convexPolygonAngleSum(17))).toBe(17);
  });

  it('rejects angle sums that no convex polygon can have', () => {
    expect(() => polygonVerticesFromAngleSum(500)).toThrow('кратна 180');
    expect(() => polygonVerticesFromAngleSum(0)).toThrow('кратна 180');
    expect(() => polygonVerticesFromAngleSum(Number.NaN)).toThrow('конечным числом');
    expect(() => polygonFanCut(2)).toThrow('не меньше трёх');
    expect(() => regularPolygonAngle(2.5)).toThrow('не меньше трёх');
  });
});

describe('triangle layout for drawings', () => {
  it('places the base on the x axis and reports all three angles', () => {
    const layout = triangleLayout(6, 50, 70);
    expect(layout.a).toEqual({ x: 0, y: 0 });
    expect(layout.b).toEqual({ x: 6, y: 0 });
    expect(layout.angles).toEqual([50, 70, 60]);
    expect(layout.sides.ab).toBe(6);
    expect(Math.hypot(layout.c.x, layout.c.y)).toBeCloseTo(layout.sides.ca, 9);
    expect(Math.hypot(layout.c.x - 6, layout.c.y)).toBeCloseTo(layout.sides.bc, 9);
  });

  it('makes the isosceles layout symmetric with equal legs', () => {
    const layout = isoscelesLayout(8, 40);
    expect(layout.angles).toEqual([70, 70, 40]);
    expect(layout.c.x).toBeCloseTo(4, 9);
    expect(layout.sides.bc).toBeCloseTo(layout.sides.ca, 9);
  });

  it('keeps the equilateral triangle equilateral', () => {
    const layout = isoscelesLayout(5, 60);
    expect(layout.angles).toEqual([60, 60, 60]);
    expect(layout.sides.bc).toBeCloseTo(5, 9);
    expect(layout.sides.ca).toBeCloseTo(5, 9);
  });

  it('rejects impossible data', () => {
    expect(() => triangleLayout(0, 60, 60)).toThrow('положительным');
    expect(() => isoscelesLayout(6, 180)).toThrow('строго между');
  });
});

describe('point helpers used by the drawings', () => {
  it('finds the midpoint of a segment', () => {
    expect(segmentMidpoint({ x: -3, y: 1 }, { x: 5, y: 7 })).toEqual({ x: 1, y: 4 });
  });

  it('rotates a point around a centre without changing the distance', () => {
    const rotated = rotatePoint({ x: 3, y: 0 }, 90);
    expect(rotated.x).toBeCloseTo(0, 9);
    expect(rotated.y).toBeCloseTo(3, 9);

    const aroundCentre = rotatePoint({ x: 2, y: 1 }, 180, { x: 1, y: 1 });
    expect(aroundCentre.x).toBeCloseTo(0, 9);
    expect(aroundCentre.y).toBeCloseTo(1, 9);
  });

  it('keeps every distance of a rotated triangle', () => {
    const layout = triangleLayout(7, 45, 60);
    const centre = { x: 2, y: -1 };
    const image = [layout.a, layout.b, layout.c].map((point) => rotatePoint(point, 137, centre));
    expect(Math.hypot(image[0]!.x - image[1]!.x, image[0]!.y - image[1]!.y)).toBeCloseTo(layout.sides.ab, 9);
    expect(Math.hypot(image[1]!.x - image[2]!.x, image[1]!.y - image[2]!.y)).toBeCloseTo(layout.sides.bc, 9);
    expect(Math.hypot(image[2]!.x - image[0]!.x, image[2]!.y - image[0]!.y)).toBeCloseTo(layout.sides.ca, 9);
  });

  it('extends a segment beyond its end point along the same line', () => {
    const extended = extendSegment({ x: 0, y: 0 }, { x: 3, y: 4 }, 5);
    expect(extended.x).toBeCloseTo(6, 9);
    expect(extended.y).toBeCloseTo(8, 9);
  });

  it('rejects broken point data', () => {
    expect(() => segmentMidpoint({ x: Number.NaN, y: 0 }, { x: 1, y: 1 })).toThrow('конечными координатами');
    expect(() => extendSegment({ x: 1, y: 1 }, { x: 1, y: 1 }, 2)).toThrow('не должны совпадать');
    expect(() => extendSegment({ x: 0, y: 0 }, { x: 1, y: 0 }, 0)).toThrow('положительным');
  });
});

describe('triangle inequality', () => {
  it('rejects a set whose two shorter sides do not reach', () => {
    const check = triangleInequality(2, 3, 10);
    expect(check.sorted).toEqual([2, 3, 10]);
    expect(check.shorterSum).toBe(5);
    expect(check.longest).toBe(10);
    expect(check.possible).toBe(false);
    expect(check.degenerate).toBe(false);
  });

  it('accepts a set whose two shorter sides overshoot', () => {
    const check = triangleInequality(5, 5, 8);
    expect(check.shorterSum).toBe(10);
    expect(check.longest).toBe(8);
    expect(check.possible).toBe(true);
    expect(canFormTriangle(5, 6, 9)).toBe(true);
    expect(canFormTriangle(6, 7, 12)).toBe(true);
    expect(canFormTriangle(3, 4, 5)).toBe(true);
  });

  it('marks the boundary case as degenerate rather than possible', () => {
    const check = triangleInequality(4, 5, 9);
    expect(check.shorterSum).toBe(9);
    expect(check.longest).toBe(9);
    expect(check.degenerate).toBe(true);
    expect(check.possible).toBe(false);
    expect(canFormTriangle(4, 5, 9)).toBe(false);
  });

  it('does not depend on the order of the sides', () => {
    for (const [first, second, third] of [[10, 2, 3], [3, 10, 2], [2, 10, 3]]) {
      expect(triangleInequality(first!, second!, third!).sorted).toEqual([2, 3, 10]);
      expect(canFormTriangle(first!, second!, third!)).toBe(false);
    }
  });

  it('compares decimal lengths exactly', () => {
    expect(canFormTriangle(0.1, 0.2, 0.3)).toBe(false);
    expect(triangleInequality(0.1, 0.2, 0.3).degenerate).toBe(true);
    expect(canFormTriangle(2.5, 2.5, 4.9)).toBe(true);
  });

  it('reports the open range for the third side', () => {
    expect(thirdSideRange(5, 8)).toEqual({ greaterThan: 3, lessThan: 13 });
    expect(thirdSideRange(8, 5)).toEqual({ greaterThan: 3, lessThan: 13 });
    expect(thirdSideRange(6, 6)).toEqual({ greaterThan: 0, lessThan: 12 });
    const { greaterThan, lessThan } = thirdSideRange(5, 8);
    expect(canFormTriangle(5, 8, greaterThan)).toBe(false);
    expect(canFormTriangle(5, 8, lessThan)).toBe(false);
    expect(canFormTriangle(5, 8, (greaterThan + lessThan) / 2)).toBe(true);
  });

  it('rejects non-positive and non-finite lengths', () => {
    expect(() => triangleInequality(0, 3, 4)).toThrow('положительным');
    expect(() => triangleInequality(3, -1, 4)).toThrow('положительным');
    expect(() => thirdSideRange(5, Number.NaN)).toThrow('положительным');
  });
});

describe('parallelogram layout', () => {
  it('keeps opposite sides equal and parallel by construction', () => {
    const layout = parallelogramLayout(9, 5, 58);
    expect(layout.sides).toEqual([9, 5, 9, 5]);
    expect(layout.perimeter).toBe(28);
    expect(Math.hypot(layout.b.x - layout.a.x, layout.b.y - layout.a.y)).toBeCloseTo(9, 9);
    expect(Math.hypot(layout.c.x - layout.d.x, layout.c.y - layout.d.y)).toBeCloseTo(9, 9);
    expect(Math.hypot(layout.d.x - layout.a.x, layout.d.y - layout.a.y)).toBeCloseTo(5, 9);
    expect(Math.hypot(layout.c.x - layout.b.x, layout.c.y - layout.b.y)).toBeCloseTo(5, 9);
    // AB и DC — один и тот же вектор, значит стороны параллельны.
    expect(layout.b.x - layout.a.x).toBeCloseTo(layout.c.x - layout.d.x, 9);
    expect(layout.b.y - layout.a.y).toBeCloseTo(layout.c.y - layout.d.y, 9);
  });

  it('makes neighbouring angles supplementary and opposite angles equal', () => {
    expect(parallelogramLayout(9, 5, 58).angles).toEqual([58, 122, 58, 122]);
    expect(parallelogramLayout(6, 5, 90).angles).toEqual([90, 90, 90, 90]);
    const [a, b, c, d] = parallelogramLayout(7, 4, 63.5).angles;
    expect(a).toBe(c);
    expect(b).toBe(d);
    expect(a + b).toBe(180);
    expect(a + b + c + d).toBe(360);
  });

  it('puts the intersection of the diagonals at their common midpoint', () => {
    const layout = parallelogramLayout(9, 5, 58);
    const other = segmentMidpoint(layout.b, layout.d);
    expect(layout.centre.x).toBeCloseTo(other.x, 9);
    expect(layout.centre.y).toBeCloseTo(other.y, 9);
  });

  it('degenerates into a rectangle exactly at 90°', () => {
    const rectangle = parallelogramLayout(8, 3, 90);
    expect(rectangle.a).toEqual({ x: 0, y: 0 });
    expect(rectangle.b).toEqual({ x: 8, y: 0 });
    expect(rectangle.d.x).toBeCloseTo(0, 12);
    expect(rectangle.d.y).toBeCloseTo(3, 12);
    expect(rectangle.c.x).toBeCloseTo(8, 12);
    expect(rectangle.c.y).toBeCloseTo(3, 12);
    // У прямоугольника диагонали равны, а у наклонного параллелограмма — нет.
    const diagonals = (layout: ReturnType<typeof parallelogramLayout>) => [
      Math.hypot(layout.c.x - layout.a.x, layout.c.y - layout.a.y),
      Math.hypot(layout.d.x - layout.b.x, layout.d.y - layout.b.y),
    ];
    const [first, second] = diagonals(rectangle);
    expect(first).toBeCloseTo(second!, 9);
    const [long, short] = diagonals(parallelogramLayout(8, 3, 60));
    expect(long!).toBeGreaterThan(short!);
  });

  it('finds the fourth vertex from the other three', () => {
    expect(parallelogramFourthVertex({ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 9, y: 4 }))
      .toEqual({ x: 3, y: 4 });
    const layout = parallelogramLayout(9, 5, 58);
    const restored = parallelogramFourthVertex(layout.a, layout.b, layout.c);
    expect(restored.x).toBeCloseTo(layout.d.x, 9);
    expect(restored.y).toBeCloseTo(layout.d.y, 9);
  });

  it('rejects impossible parallelogram data', () => {
    expect(() => parallelogramLayout(0, 5, 60)).toThrow('положительным');
    expect(() => parallelogramLayout(9, 5, 180)).toThrow('строго между');
    expect(() => parallelogramFourthVertex({ x: 0, y: 0 }, { x: 1, y: Number.NaN }, { x: 2, y: 2 }))
      .toThrow('конечными координатами');
  });
});
