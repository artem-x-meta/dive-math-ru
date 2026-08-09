import { describe, expect, it } from 'vitest';
import {
  CUBE_EDGES,
  CUBE_VERTEX_NAMES,
  DEFAULT_VIEW,
  ISOMETRIC_VIEW,
  angleBetweenLinesDegrees,
  angleBetweenPlanesDegrees,
  angleLinePlaneDegrees,
  areCollinear3,
  arePerpendicular3,
  classifyCubeEdges,
  classifyLinePlane,
  classifyLines,
  classifyPlanes,
  commonCubeVertex,
  cross3,
  cubeEdgeAngleDegrees,
  cubeEdgeDistance,
  cubeEdgeLine,
  cubeEdgePairCounts,
  cubeVertex,
  distanceBetweenLines,
  distanceBetweenPlanes,
  distanceLinePlane,
  distancePointLine,
  distancePointPlane,
  distance3,
  dot3,
  formatEdgeId,
  formatVertexName,
  hiddenCubeVertex,
  isCubeEdgeHidden,
  line3,
  lineThroughPoints3,
  midpoint3,
  plane3,
  planeThroughPoints3,
  point3,
  projectAxonometric,
  projectPointOntoLine,
  projectPointOntoPlane,
  slantAngleDegrees,
  slantLength,
  slantProjection,
  threePerpendicularsCheck,
  tripleProduct3,
  vec3,
  viewBasis,
} from '../src/lib/stereometry';

const PRECISION = 9;

describe('vectors in space', () => {
  it('computes coordinates, length and midpoint exactly for integer inputs', () => {
    expect(distance3(point3(0, 0, 0), point3(3, 4, 12))).toBe(13);
    expect(distance3(point3(1, 2, 2), point3(4, 6, 14))).toBe(13);
    expect(midpoint3(point3(-2, 0, 4), point3(4, 6, 2))).toEqual({ x: 1, y: 3, z: 3 });
    expect(dot3(vec3(1, 2, 3), vec3(4, -5, 6))).toBe(12);
  });

  it('uses the cross product as a collinearity and perpendicularity test', () => {
    expect(cross3(vec3(1, 0, 0), vec3(0, 1, 0))).toEqual({ x: 0, y: 0, z: 1 });
    expect(areCollinear3(vec3(2, -4, 6), vec3(-1, 2, -3))).toBe(true);
    expect(areCollinear3(vec3(1, 0, 0), vec3(0, 0, 1))).toBe(false);
    expect(arePerpendicular3(vec3(1, 1, 0), vec3(1, -1, 5))).toBe(true);
    expect(() => arePerpendicular3(vec3(0, 0, 0), vec3(1, 0, 0))).toThrow('нулевым вектором');
  });

  it('detects coplanar triples by the triple product', () => {
    expect(tripleProduct3(vec3(1, 0, 0), vec3(0, 1, 0), vec3(1, 1, 0))).toBe(0);
    expect(tripleProduct3(vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1))).toBe(1);
  });
});

describe('mutual position of lines', () => {
  const first = lineThroughPoints3(point3(0, 0, 0), point3(1, 0, 0));

  it('separates coincident, parallel, intersecting and skew lines', () => {
    expect(classifyLines(first, lineThroughPoints3(point3(5, 0, 0), point3(-2, 0, 0)))).toBe('coincident');
    expect(classifyLines(first, lineThroughPoints3(point3(0, 3, 0), point3(1, 3, 0)))).toBe('parallel');
    expect(classifyLines(first, lineThroughPoints3(point3(0, 0, 0), point3(0, 1, 1)))).toBe('intersecting');
    expect(classifyLines(first, lineThroughPoints3(point3(0, 0, 4), point3(0, 1, 4)))).toBe('skew');
  });

  it('measures the angle between lines from 0 to 90 degrees', () => {
    expect(angleBetweenLinesDegrees(vec3(1, 0, 0), vec3(-1, 0, 0))).toBeCloseTo(0, PRECISION);
    expect(angleBetweenLinesDegrees(vec3(1, 0, 0), vec3(1, 1, 0))).toBeCloseTo(45, PRECISION);
    expect(angleBetweenLinesDegrees(vec3(1, 0, 0), vec3(0, 0, -7))).toBeCloseTo(90, PRECISION);
  });

  it('measures distance for parallel and skew lines', () => {
    expect(distanceBetweenLines(first, lineThroughPoints3(point3(0, 3, 4), point3(1, 3, 4)))).toBeCloseTo(5, PRECISION);
    expect(distanceBetweenLines(first, lineThroughPoints3(point3(0, 0, 6), point3(0, 1, 6)))).toBeCloseTo(6, PRECISION);
    expect(distanceBetweenLines(first, lineThroughPoints3(point3(2, 0, 0), point3(2, 5, 5)))).toBe(0);
  });
});

describe('cube edge pairs', () => {
  it('classifies the pairs that the chapter names explicitly', () => {
    expect(classifyCubeEdges('AB', 'CD')).toBe('parallel');
    expect(classifyCubeEdges('AB', 'A1B1')).toBe('parallel');
    expect(classifyCubeEdges('AB', 'C1D1')).toBe('parallel');
    expect(classifyCubeEdges('AB', 'BC')).toBe('intersecting');
    expect(classifyCubeEdges('AB', 'AA1')).toBe('intersecting');
    expect(classifyCubeEdges('AB', 'BB1')).toBe('intersecting');
    expect(classifyCubeEdges('AB', 'DA')).toBe('intersecting');
    expect(classifyCubeEdges('AB', 'CC1')).toBe('skew');
    expect(classifyCubeEdges('AB', 'DD1')).toBe('skew');
    expect(classifyCubeEdges('AB', 'B1C1')).toBe('skew');
    expect(classifyCubeEdges('AB', 'D1A1')).toBe('skew');
    expect(classifyCubeEdges('AB', 'AB')).toBe('coincident');
  });

  it('gives every edge three parallel, four intersecting and four skew partners', () => {
    for (const edge of CUBE_EDGES) {
      const partners = CUBE_EDGES.filter((other) => other.id !== edge.id)
        .map((other) => classifyCubeEdges(edge.id, other.id));
      expect(partners.filter((kind) => kind === 'parallel')).toHaveLength(3);
      expect(partners.filter((kind) => kind === 'intersecting')).toHaveLength(4);
      expect(partners.filter((kind) => kind === 'skew')).toHaveLength(4);
    }
  });

  it('counts all 66 pairs of edges', () => {
    const counts = cubeEdgePairCounts();
    expect(counts).toEqual({ coincident: 0, parallel: 18, intersecting: 24, skew: 24 });
    expect(counts.parallel + counts.intersecting + counts.skew).toBe(66);
  });

  it('keeps the classification independent of the edge length', () => {
    expect(classifyLines(cubeEdgeLine('AB', 7), cubeEdgeLine('CC1', 7))).toBe('skew');
    expect(cubeEdgeDistance('AB', 'CC1', 7)).toBeCloseTo(7, PRECISION);
    expect(cubeEdgeDistance('AB', 'B1C1', 4)).toBeCloseTo(4, PRECISION);
    expect(cubeEdgeDistance('AA1', 'BC', 4)).toBeCloseTo(4, PRECISION);
    expect(cubeEdgeDistance('AB', 'CD', 4)).toBeCloseTo(4, PRECISION);
  });

  it('measures angles between edge lines', () => {
    expect(cubeEdgeAngleDegrees('AB', 'B1C1')).toBeCloseTo(90, PRECISION);
    expect(cubeEdgeAngleDegrees('AB', 'C1D1')).toBeCloseTo(0, PRECISION);
    expect(cubeEdgeAngleDegrees('AA1', 'CD')).toBeCloseTo(90, PRECISION);
  });

  it('measures the classic 45 and 60 degree angles of the cube', () => {
    const size = 4;
    const at = (name: Parameters<typeof cubeVertex>[0]) => cubeVertex(name, size);
    const ab = lineThroughPoints3(at('A'), at('B'));
    const cd1 = lineThroughPoints3(at('C'), at('D1'));
    const ab1 = lineThroughPoints3(at('A'), at('B1'));
    const bc1 = lineThroughPoints3(at('B'), at('C1'));

    expect(angleBetweenLinesDegrees(ab.direction, cd1.direction)).toBeCloseTo(45, PRECISION);
    expect(classifyLines(ab1, bc1)).toBe('skew');
    expect(angleBetweenLinesDegrees(ab1.direction, bc1.direction)).toBeCloseTo(60, PRECISION);
    expect(distance3(at('A'), at('C1'))).toBeCloseTo(size * Math.sqrt(3), PRECISION);
    expect(distance3(at('A'), at('C'))).toBeCloseTo(size * Math.sqrt(2), PRECISION);
  });

  it('finds the common vertex exactly for intersecting edges', () => {
    expect(commonCubeVertex('AB', 'BC')).toBe('B');
    expect(commonCubeVertex('AB', 'AA1')).toBe('A');
    expect(commonCubeVertex('DA', 'AA1')).toBe('A');
    expect(commonCubeVertex('AB', 'CD')).toBeNull();
    expect(commonCubeVertex('AB', 'CC1')).toBeNull();
    expect(commonCubeVertex('AB', 'AB')).toBeNull();
    for (const first of CUBE_EDGES) {
      for (const second of CUBE_EDGES) {
        const shared = commonCubeVertex(first.id, second.id);
        expect(shared !== null).toBe(classifyCubeEdges(first.id, second.id) === 'intersecting');
      }
    }
  });

  it('formats vertex and edge names with subscripts', () => {
    expect(formatVertexName('A1')).toBe('A₁');
    expect(formatEdgeId('A1B1')).toBe('A₁B₁');
    expect(formatEdgeId('DA')).toBe('DA');
    expect(CUBE_VERTEX_NAMES).toHaveLength(8);
    expect(CUBE_EDGES).toHaveLength(12);
  });
});

describe('lines, planes and projections', () => {
  const base = planeThroughPoints3(point3(0, 0, 0), point3(1, 0, 0), point3(0, 1, 0));

  it('builds a plane through three points and rejects collinear ones', () => {
    expect(areCollinear3(base.normal, vec3(0, 0, 1))).toBe(true);
    expect(() => planeThroughPoints3(point3(0, 0, 0), point3(1, 1, 1), point3(2, 2, 2))).toThrow('одной прямой');
  });

  it('separates a line inside, parallel to and crossing a plane', () => {
    expect(classifyLinePlane(line3(point3(2, 3, 0), vec3(1, 1, 0)), base)).toBe('inside');
    expect(classifyLinePlane(line3(point3(2, 3, 5), vec3(1, 1, 0)), base)).toBe('parallel');
    expect(classifyLinePlane(line3(point3(2, 3, 5), vec3(0, 1, 1)), base)).toBe('intersecting');
    expect(distanceLinePlane(line3(point3(2, 3, 5), vec3(1, 1, 0)), base)).toBeCloseTo(5, PRECISION);
    expect(distanceLinePlane(line3(point3(2, 3, 5), vec3(0, 1, 1)), base)).toBe(0);
  });

  it('separates parallel, coincident and crossing planes', () => {
    const top = plane3(point3(0, 0, 6), vec3(0, 0, 1));
    expect(classifyPlanes(base, top)).toBe('parallel');
    expect(classifyPlanes(base, plane3(point3(4, 5, 0), vec3(0, 0, -3)))).toBe('coincident');
    expect(classifyPlanes(base, plane3(point3(0, 0, 0), vec3(0, 1, 1)))).toBe('intersecting');
    expect(distanceBetweenPlanes(base, top)).toBeCloseTo(6, PRECISION);
    expect(distanceBetweenPlanes(base, plane3(point3(0, 0, 0), vec3(0, 1, 1)))).toBe(0);
  });

  it('drops a perpendicular from a point to a plane and to a line', () => {
    expect(projectPointOntoPlane(point3(2, -3, 7), base)).toEqual({ x: 2, y: -3, z: 0 });
    expect(distancePointPlane(point3(2, -3, 7), base)).toBeCloseTo(7, PRECISION);
    expect(projectPointOntoLine(point3(3, 4, 0), lineThroughPoints3(point3(0, 0, 0), point3(1, 0, 0))))
      .toEqual({ x: 3, y: 0, z: 0 });
    expect(distancePointLine(point3(3, 4, 0), lineThroughPoints3(point3(0, 0, 0), point3(1, 0, 0))))
      .toBeCloseTo(4, PRECISION);
    expect(distancePointPlane(point3(1, 2, 3), plane3(point3(0, 0, 0), vec3(2, -1, 2)))).toBeCloseTo(2, PRECISION);
  });

  it('measures the angle between a line and a plane and between two planes', () => {
    expect(angleLinePlaneDegrees(line3(point3(0, 0, 0), vec3(0, 0, 1)), base)).toBeCloseTo(90, PRECISION);
    expect(angleLinePlaneDegrees(line3(point3(0, 0, 0), vec3(1, 0, 1)), base)).toBeCloseTo(45, PRECISION);
    expect(angleLinePlaneDegrees(line3(point3(0, 0, 5), vec3(3, 4, 0)), base)).toBeCloseTo(0, PRECISION);
    expect(angleBetweenPlanesDegrees(base, plane3(point3(0, 0, 0), vec3(0, 1, 1)))).toBeCloseTo(45, PRECISION);

    // Диагональ куба и плоскость основания: sin α = 1/√3.
    const diagonal = lineThroughPoints3(cubeVertex('A', 4), cubeVertex('C1', 4));
    expect(angleLinePlaneDegrees(diagonal, base)).toBeCloseTo((Math.asin(1 / Math.sqrt(3)) * 180) / Math.PI, PRECISION);
  });
});

describe('perpendicular, slant and its projection', () => {
  it('links the three lengths by the Pythagorean theorem', () => {
    expect(slantLength(3, 4)).toBeCloseTo(5, PRECISION);
    expect(slantLength(6, 8)).toBeCloseTo(10, PRECISION);
    expect(slantProjection(13, 12)).toBeCloseTo(5, PRECISION);
    expect(slantProjection(15, 12)).toBeCloseTo(9, PRECISION);
    expect(slantAngleDegrees(4, 4)).toBeCloseTo(45, PRECISION);
    expect(slantAngleDegrees(4, 4 * Math.sqrt(3))).toBeCloseTo(30, PRECISION);
    expect(slantAngleDegrees(5, 0)).toBeCloseTo(90, PRECISION);
  });

  it('rejects impossible sets of lengths', () => {
    expect(() => slantLength(0, 4)).toThrow('перпендикуляра должна быть положительной');
    expect(() => slantLength(3, -1)).toThrow('проекции не может быть отрицательной');
    expect(() => slantProjection(4, 5)).toThrow('короче перпендикуляра');
  });

  it('confirms the theorem of three perpendiculars for every line of the plane', () => {
    const plane = plane3(point3(0, 0, 0), vec3(0, 0, 1));
    const apex = point3(3, 1, 5);
    const bases = [point3(0, 0, 0), point3(-2, 4, 0), point3(3, 1, 0), point3(6, -3, 0)];
    const directions = [vec3(1, 0, 0), vec3(0, 1, 0), vec3(2, 5, 0), vec3(-3, 1, 0), vec3(1, 1, 0)];

    for (const start of bases) {
      for (const direction of directions) {
        const result = threePerpendicularsCheck(plane, apex, start, line3(start, direction));
        expect(result.slantPerpendicular).toBe(result.projectionPerpendicular);
      }
    }
  });

  it('shows the theorem on the classic square-base configuration', () => {
    // ABCD — квадрат со стороной 4, SA ⊥ (ABC), SA = 4.
    const plane = plane3(point3(0, 0, 0), vec3(0, 0, 1));
    const b = point3(4, 0, 0);
    const c = point3(4, 4, 0);
    const apex = point3(0, 0, 4);
    const bc = lineThroughPoints3(b, c);

    const check = threePerpendicularsCheck(plane, apex, b, bc);
    expect(check.projectionPerpendicular).toBe(true);
    expect(check.slantPerpendicular).toBe(true);
    expect(distance3(apex, b)).toBeCloseTo(4 * Math.sqrt(2), PRECISION);
    expect(distance3(apex, c)).toBeCloseTo(4 * Math.sqrt(3), PRECISION);
  });

  it('refuses configurations that contradict the setup', () => {
    const plane = plane3(point3(0, 0, 0), vec3(0, 0, 1));
    expect(() => threePerpendicularsCheck(plane, point3(1, 1, 0), point3(0, 0, 0), line3(point3(0, 0, 0), vec3(1, 0, 0))))
      .toThrow('вне плоскости');
    expect(() => threePerpendicularsCheck(plane, point3(1, 1, 5), point3(0, 0, 2), line3(point3(0, 0, 0), vec3(1, 0, 0))))
      .toThrow('должно лежать в плоскости');
    expect(() => threePerpendicularsCheck(plane, point3(1, 1, 5), point3(0, 0, 0), line3(point3(0, 0, 0), vec3(0, 0, 1))))
      .toThrow('в этой же плоскости');
  });
});

describe('axonometric drawing', () => {
  it('keeps the isometric view honest: equal edges under 120 degrees', () => {
    const x = projectAxonometric(vec3(1, 0, 0), ISOMETRIC_VIEW);
    const y = projectAxonometric(vec3(0, 1, 0), ISOMETRIC_VIEW);
    const z = projectAxonometric(vec3(0, 0, 1), ISOMETRIC_VIEW);
    const size = (point: { x: number; y: number }) => Math.hypot(point.x, point.y);
    const angle = (first: { x: number; y: number }, second: { x: number; y: number }) =>
      (Math.acos((first.x * second.x + first.y * second.y) / (size(first) * size(second))) * 180) / Math.PI;

    expect(size(x)).toBeCloseTo(size(y), PRECISION);
    expect(size(y)).toBeCloseTo(size(z), PRECISION);
    expect(size(x)).toBeCloseTo(Math.sqrt(2 / 3), PRECISION);
    expect(angle(x, y)).toBeCloseTo(120, PRECISION);
    expect(angle(y, z)).toBeCloseTo(120, PRECISION);
    expect(angle(z, x)).toBeCloseTo(120, PRECISION);
  });

  it('uses an orthonormal picture basis and keeps vertical edges vertical', () => {
    const { right, up } = viewBasis(DEFAULT_VIEW);
    expect(dot3(right, up)).toBeCloseTo(0, PRECISION);
    expect(Math.hypot(right.x, right.y, right.z)).toBeCloseTo(1, PRECISION);
    expect(Math.hypot(up.x, up.y, up.z)).toBeCloseTo(1, PRECISION);
    expect(projectAxonometric(vec3(0, 0, 5), DEFAULT_VIEW).x).toBeCloseTo(0, PRECISION);
    expect(projectAxonometric(vec3(0, 0, 5), DEFAULT_VIEW).y).toBeGreaterThan(0);
  });

  it('stays a parallel projection: midpoints go to midpoints', () => {
    const first = point3(1, 5, -2);
    const second = point3(7, -3, 4);
    const projectedMiddle = projectAxonometric(midpoint3(first, second), DEFAULT_VIEW);
    const a = projectAxonometric(first, DEFAULT_VIEW);
    const b = projectAxonometric(second, DEFAULT_VIEW);
    expect(projectedMiddle.x).toBeCloseTo((a.x + b.x) / 2, PRECISION);
    expect(projectedMiddle.y).toBeCloseTo((a.y + b.y) / 2, PRECISION);
  });

  it('hides the far vertex of the cube and its three edges', () => {
    expect(hiddenCubeVertex(DEFAULT_VIEW)).toBe('D');
    expect(CUBE_EDGES.filter((edge) => isCubeEdgeHidden(edge.id, DEFAULT_VIEW)).map((edge) => edge.id))
      .toEqual(['CD', 'DA', 'DD1']);
    expect(isCubeEdgeHidden('AB', DEFAULT_VIEW)).toBe(false);
  });

  it('rejects a degenerate direction of view', () => {
    expect(() => projectAxonometric(point3(0, 0, 0), { azimuthDegrees: 0, elevationDegrees: 90 }))
      .toThrow('Угол подъёма');
  });
});
