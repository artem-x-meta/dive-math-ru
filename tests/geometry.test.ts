import { describe, expect, it } from 'vitest';
import {
  approximatePiMultiple,
  circleMeasures,
  classifyAngle,
  classifyLineRelation,
  classifyTriangle,
  convertMetricMeasure,
  convertMetricValue,
  cuboidMetrics,
  cuboidVolume,
  estimateGridArea,
  gridRouteLength,
  gridShapeMetrics,
  inspectQuadrilateral,
  isValidCubeNet,
  lineRelation,
  metricConversionFactor,
  normalizeLineAngle,
  normalizeLineDirection,
  orthogonalPerimeter,
  pointToAxisDistance,
  pointToLineDistanceSquared,
  polygonArea,
  rectangleMeasures,
  rectangleMetrics,
  reflectPointAcrossAxis,
  reflectPointThroughCenter,
  reflectShape,
  validateCubeNet,
  type GeometryLine,
  type GridCell,
} from '../src/lib/geometry';

describe('angles and lines', () => {
  it('classifies every boundary from 0° through 180° exactly', () => {
    expect(classifyAngle(0)).toBe('zero');
    expect(classifyAngle('0.001')).toBe('acute');
    expect(classifyAngle('89,999')).toBe('acute');
    expect(classifyAngle(90)).toBe('right');
    expect(classifyAngle('90.001')).toBe('obtuse');
    expect(classifyAngle(180)).toBe('straight');
  });

  it('rejects angles outside the closed school-angle range', () => {
    expect(() => classifyAngle(-0.001)).toThrow('between 0° and 180°');
    expect(() => classifyAngle(180.001)).toThrow('between 0° and 180°');
    expect(() => classifyAngle(Number.NaN)).toThrow('invalid');
    expect(() => classifyAngle(Number.POSITIVE_INFINITY)).toThrow('invalid');
  });

  it('normalizes undirected directions modulo 180', () => {
    expect(normalizeLineAngle(-30)).toBe(150);
    expect(normalizeLineAngle(540)).toBe(0);
    expect(lineRelation(0, 180)).toBe('parallel');
    expect(lineRelation(-45, 45)).toBe('perpendicular');
    expect(lineRelation(20, 70)).toBe('intersecting');
    expect(lineRelation(10.25, 190.25 + 5e-10)).toBe('parallel');
    expect(lineRelation(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 90)).toBe('perpendicular');
  });

  it('classifies infinite lines exactly from safe-integer points', () => {
    const horizontal: GeometryLine = { start: { x: 0, y: 1 }, end: { x: 4, y: 1 } };
    const same: GeometryLine = { start: { x: -2, y: 1 }, end: { x: 9, y: 1 } };
    const parallel: GeometryLine = { start: { x: 0, y: 3 }, end: { x: -7, y: 3 } };
    const vertical: GeometryLine = { start: { x: 2, y: -2 }, end: { x: 2, y: 5 } };
    const slanted: GeometryLine = { start: { x: 0, y: 0 }, end: { x: 3, y: 2 } };

    expect(classifyLineRelation(horizontal, same)).toBe('coincident');
    expect(classifyLineRelation(horizontal, parallel)).toBe('parallel');
    expect(classifyLineRelation(horizontal, vertical)).toBe('perpendicular');
    expect(classifyLineRelation(horizontal, slanted)).toBe('intersecting');
    expect(normalizeLineDirection({ start: { x: 6, y: 4 }, end: { x: 0, y: 0 } })).toEqual({
      dx: 3,
      dy: 2,
    });
  });

  it('rejects a zero-length or non-integer authored line', () => {
    expect(() =>
      classifyLineRelation(
        { start: { x: 1, y: 1 }, end: { x: 1, y: 1 } },
        { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
      ),
    ).toThrow('distinct');
    expect(() =>
      normalizeLineDirection({ start: { x: 0.5, y: 0 }, end: { x: 2, y: 0 } }),
    ).toThrow('safe integer');
  });

  it('keeps squared point-to-line distance exact', () => {
    expect(
      pointToLineDistanceSquared(
        { x: 0, y: 2 },
        { start: { x: 0, y: 0 }, end: { x: 3, y: 4 } },
      ),
    ).toEqual({ numerator: 36n, denominator: 25n });
    expect(pointToAxisDistance({ x: 0.7, y: -2 }, 'vertical', 0.4)).toBe(0.3);
    expect(pointToAxisDistance({ x: 0.7, y: -2 }, 'horizontal', 1)).toBe(3);
  });
});

describe('grid routes and reflections', () => {
  it('adds only axis-aligned grid segments', () => {
    expect(
      gridRouteLength([
        { x: -2, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: -4 },
        { x: 3, y: -4 },
      ]),
    ).toBe(10);
    expect(() => gridRouteLength([{ x: 0, y: 0 }, { x: 2, y: 3 }])).toThrow('diagonal');
    expect(() => gridRouteLength([{ x: 0, y: 0 }])).toThrow('at least two');
    expect(() => gridRouteLength([{ x: 0.5, y: 0 }, { x: 1, y: 0 }])).toThrow('safe integer');
  });

  it('implements four axes and central symmetry as involutions', () => {
    const point = { x: 2.5, y: -4 } as const;
    expect(reflectPointAcrossAxis(point, 'vertical', 1)).toEqual({ x: -0.5, y: -4 });
    expect(reflectPointAcrossAxis(point, 'horizontal', -1)).toEqual({ x: 2.5, y: 2 });
    expect(reflectPointAcrossAxis(point, 'diagonal-up')).toEqual({ x: -4, y: 2.5 });
    expect(reflectPointAcrossAxis(point, 'diagonal-down')).toEqual({ x: 4, y: -2.5 });
    expect(reflectPointThroughCenter(point, { x: 1, y: 2 })).toEqual({ x: -0.5, y: 8 });

    for (const axis of ['vertical', 'horizontal', 'diagonal-up', 'diagonal-down'] as const) {
      const coordinate = axis === 'vertical' || axis === 'horizontal' ? 1.25 : undefined;
      const once = reflectPointAcrossAxis(point, axis, coordinate);
      expect(reflectPointAcrossAxis(once, axis, coordinate)).toEqual(point);
    }
    const once = reflectPointThroughCenter(point, { x: -3, y: 1 });
    expect(reflectPointThroughCenter(once, { x: -3, y: 1 })).toEqual(point);
  });

  it('reflects whole shapes without mutating input and controls shifted diagonal axes', () => {
    const shape = [{ x: 0, y: 1 }, { x: 2, y: 1 }] as const;
    expect(reflectShape(shape, { kind: 'axis', axis: 'vertical', axisCoordinate: 1 })).toEqual([
      { x: 2, y: 1 },
      { x: 0, y: 1 },
    ]);
    expect(reflectShape(shape, { kind: 'center', center: { x: 0, y: 0 } })).toEqual([
      { x: 0, y: -1 },
      { x: -2, y: -1 },
    ]);
    expect(shape).toEqual([{ x: 0, y: 1 }, { x: 2, y: 1 }]);
    expect(() => reflectPointAcrossAxis({ x: 1, y: 2 }, 'diagonal-up', 0)).toThrow(
      'only valid for horizontal or vertical',
    );
  });
});

describe('plane figures and exact measures', () => {
  it('deduplicates cells and counts exposed edges, holes, and disconnected parts', () => {
    const rectangle = [
      { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 0, y: 1 }, { x: 1, y: 1 },
      { x: 0, y: 2 }, { x: 1, y: 2 },
    ];
    expect(gridShapeMetrics(rectangle)).toEqual({ area: 6, perimeter: 10 });
    expect(gridShapeMetrics([...rectangle, { x: 0, y: 0 }])).toEqual({ area: 6, perimeter: 10 });

    const ring: GridCell[] = [];
    for (let x = 0; x < 3; x += 1) {
      for (let y = 0; y < 3; y += 1) {
        if (x !== 1 || y !== 1) ring.push({ x, y });
      }
    }
    expect(gridShapeMetrics(ring)).toEqual({ area: 8, perimeter: 16 });
    expect(gridShapeMetrics([{ x: 0, y: 0 }, { x: 3, y: 0 }])).toEqual({ area: 2, perimeter: 8 });
    expect(gridShapeMetrics([])).toEqual({ area: 0, perimeter: 0 });
  });

  it('computes decimal rectangles and an L-shape without binary drift', () => {
    expect(rectangleMeasures('0.1', '0.2')).toEqual({
      perimeter: { numerator: 3n, denominator: 5n },
      area: { numerator: 1n, denominator: 50n },
    });
    expect(rectangleMetrics(0.1, 0.2)).toEqual({ perimeter: 0.6, area: 0.02 });

    const lShape = [
      { x: 0, y: 0 },
      { x: 2.5, y: 0 },
      { x: 2.5, y: 1.2 },
      { x: 1, y: 1.2 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
    ] as const;
    expect(polygonArea(lShape)).toEqual({ numerator: 24n, denominator: 5n });
    expect(orthogonalPerimeter(lShape)).toEqual({ numerator: 11n, denominator: 1n });
  });

  it('rejects crossed and non-orthogonal polygons', () => {
    const bowTie = [{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }];
    expect(() => polygonArea(bowTie)).toThrow('must not cross');
    expect(() =>
      orthogonalPerimeter([{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 2 }]),
    ).toThrow('follow an axis');
    expect(() => rectangleMeasures(0, 2)).toThrow('positive');
  });

  it('gives transparent lower, midpoint, and upper grid-area estimates', () => {
    expect(estimateGridArea(4, 3)).toEqual({
      lower: { numerator: 4n, denominator: 1n },
      midpoint: { numerator: 11n, denominator: 2n },
      upper: { numerator: 7n, denominator: 1n },
    });
    expect(() => estimateGridArea(-1, 3)).toThrow('cannot be negative');
  });
});

describe('triangle and quadrilateral facts', () => {
  it('classifies triangles independently by sides and angles', () => {
    expect(classifyTriangle([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }])).toEqual({
      sideKind: 'isosceles',
      angleKind: 'right',
      sideSquares: [4n, 8n, 4n],
    });
    expect(classifyTriangle([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 3 }])).toMatchObject({
      sideKind: 'scalene',
      angleKind: 'acute',
    });
    expect(classifyTriangle([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 1 }])).toMatchObject({
      sideKind: 'scalene',
      angleKind: 'obtuse',
    });
    expect(() => classifyTriangle([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }])).toThrow(
      'non-collinear',
    );
  });

  it('reports authored quadrilateral properties without promoting later-course names', () => {
    const square = inspectQuadrilateral([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }]);
    expect(square).toEqual({
      parallelPairs: 2,
      rightAngles: 4,
      equalSideGroups: [[0, 1, 2, 3]],
      equalDiagonals: true,
      perpendicularDiagonals: true,
      diagonalsBisectEachOther: true,
      kind: 'square',
    });

    const rectangle = inspectQuadrilateral([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }]);
    expect(rectangle).toMatchObject({
      parallelPairs: 2,
      rightAngles: 4,
      equalSideGroups: [[0, 2], [1, 3]],
      equalDiagonals: true,
      perpendicularDiagonals: false,
      kind: 'rectangle',
    });

    const oneParallelPair = inspectQuadrilateral([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 2 }]);
    expect(oneParallelPair).toMatchObject({ parallelPairs: 1, kind: 'other' });
  });

  it('rejects crossed, repeated, and non-integer authored vertices', () => {
    expect(() =>
      inspectQuadrilateral([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }]),
    ).toThrow('must not cross');
    expect(() =>
      inspectQuadrilateral([{ x: 0, y: 0 }, { x: 2.5, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }]),
    ).toThrow('safe integer');
  });
});

describe('metric units, circles, and volume', () => {
  it('raises the linear conversion factor to the requested dimension', () => {
    expect(metricConversionFactor('cm', 'm', 1)).toBe(0.01);
    expect(metricConversionFactor('m', 'cm', 2)).toBe(10_000);
    expect(metricConversionFactor('km', 'mm', 3)).toBe(10 ** 18);
    expect(metricConversionFactor('a', 'm', 2)).toBe(100);
    expect(metricConversionFactor('ha', 'a', 2)).toBe(100);
    expect(convertMetricValue(2.5, 'm', 'cm', 1)).toBe(250);
    expect(convertMetricMeasure('1.2', 'm', 'cm', 2)).toEqual({ numerator: 12_000n, denominator: 1n });
    expect(() => metricConversionFactor('ha', 'm', 1)).toThrow('area unit');
    expect(() => metricConversionFactor('m', 'cm', 4 as 3)).toThrow('must be 1, 2, or 3');
  });

  it('keeps pi symbolic until an approximation is explicitly selected', () => {
    expect(circleMeasures(2)).toEqual({
      diameter: 4,
      circumferencePiCoefficient: 4,
      areaPiCoefficient: 4,
    });
    expect(circleMeasures(2.5)).toEqual({
      diameter: 5,
      circumferencePiCoefficient: 5,
      areaPiCoefficient: 6.25,
    });
    expect(approximatePiMultiple(4, '3.14')).toBe(12.56);
    expect(approximatePiMultiple(7, '22/7')).toBe(22);
    expect(() => circleMeasures(0)).toThrow('positive');
    expect(() => approximatePiMultiple(-1, '3.14')).toThrow('cannot be negative');
  });

  it('computes exact decimal volume and numeric cuboid metrics', () => {
    expect(cuboidVolume('1.2', '2.5', '0.4')).toEqual({ numerator: 6n, denominator: 5n });
    expect(cuboidMetrics(2, 3, 4)).toEqual({ volume: 24, surfaceArea: 52 });
    expect(() => cuboidMetrics(2, -3, 4)).toThrow('positive');
  });

  it('obeys length×k, area×k², and volume×k³ scaling', () => {
    const baseRectangle = rectangleMetrics(3, 5);
    const scaledRectangle = rectangleMetrics(9, 15);
    expect(scaledRectangle.perimeter).toBe(baseRectangle.perimeter * 3);
    expect(scaledRectangle.area).toBe(baseRectangle.area * 3 ** 2);

    const baseCuboid = cuboidMetrics(2, 3, 4);
    const scaledCuboid = cuboidMetrics(6, 9, 12);
    expect(scaledCuboid.volume).toBe(baseCuboid.volume * 3 ** 3);
    expect(scaledCuboid.surfaceArea).toBe(baseCuboid.surfaceArea * 3 ** 2);
  });
});

type CellTuple = readonly [number, number];

function canonicalHexomino(cells: readonly CellTuple[]): string {
  const transforms = [
    ([x, y]: CellTuple): CellTuple => [x, y],
    ([x, y]: CellTuple): CellTuple => [-x, y],
    ([x, y]: CellTuple): CellTuple => [x, -y],
    ([x, y]: CellTuple): CellTuple => [-x, -y],
    ([x, y]: CellTuple): CellTuple => [y, x],
    ([x, y]: CellTuple): CellTuple => [-y, x],
    ([x, y]: CellTuple): CellTuple => [y, -x],
    ([x, y]: CellTuple): CellTuple => [-y, -x],
  ];

  return transforms
    .map((transform) => {
      const transformed = cells.map(transform);
      const minimumX = Math.min(...transformed.map(([x]) => x));
      const minimumY = Math.min(...transformed.map(([, y]) => y));
      return transformed
        .map(([x, y]) => [x - minimumX, y - minimumY] as const)
        .sort(([ax, ay], [bx, by]) => ax - bx || ay - by)
        .map(([x, y]) => `${x},${y}`)
        .join(';');
    })
    .sort()[0];
}

function decodeCells(canonical: string): CellTuple[] {
  return canonical.split(';').map((cell) => cell.split(',').map(Number) as [number, number]);
}

function enumerateFreeHexominoes(): readonly CellTuple[][] {
  let shapes = new Map<string, CellTuple[]>([['0,0', [[0, 0]]]]);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (let size = 2; size <= 6; size += 1) {
    const nextShapes = new Map<string, CellTuple[]>();
    for (const shape of shapes.values()) {
      const occupied = new Set(shape.map(([x, y]) => `${x},${y}`));
      for (const [x, y] of shape) {
        for (const [dx, dy] of directions) {
          if (occupied.has(`${x + dx},${y + dy}`)) continue;
          const canonical = canonicalHexomino([...shape, [x + dx, y + dy]]);
          if (!nextShapes.has(canonical)) nextShapes.set(canonical, decodeCells(canonical));
        }
      }
    }
    shapes = nextShapes;
  }
  return [...shapes.values()];
}

describe('cube nets', () => {
  const classicNet = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 },
    { x: 1, y: 3 },
  ] as const;

  it('folds a representative net and is invariant under rotation and translation', () => {
    expect(validateCubeNet(classicNet)).toEqual({ valid: true, reason: 'valid' });
    const rotatedAndShifted = classicNet.map(({ x, y }) => ({ x: -y + 20, y: x - 7 }));
    expect(isValidCubeNet(rotatedAndShifted)).toBe(true);
  });

  it('finds exactly the eleven free hexominoes that are cube nets', () => {
    const freeHexominoes = enumerateFreeHexominoes();
    expect(freeHexominoes).toHaveLength(35);
    const nets = freeHexominoes.filter((shape) =>
      isValidCubeNet(shape.map(([x, y]) => ({ x, y }))),
    );
    expect(nets).toHaveLength(11);
  });

  it('distinguishes malformed, disconnected, overlapping, and inconsistent folds', () => {
    expect(validateCubeNet(classicNet.slice(0, 5))).toEqual({ valid: false, reason: 'cell-count' });
    expect(validateCubeNet([...classicNet.slice(0, 5), classicNet[0]])).toEqual({
      valid: false,
      reason: 'duplicate',
    });
    expect(
      validateCubeNet([
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
        { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 10, y: 10 },
      ]),
    ).toEqual({ valid: false, reason: 'disconnected' });
    expect(isValidCubeNet([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
      { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
    ])).toBe(false);
    expect(isValidCubeNet([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
    ])).toBe(false);
  });
});

describe('hostile and oversized inputs', () => {
  it('rejects non-finite values and oversized collections before doing expensive work', () => {
    expect(() => circleMeasures(Number.POSITIVE_INFINITY)).toThrow('invalid');
    expect(() => rectangleMetrics(Number.MAX_VALUE, 2)).toThrow();
    expect(() => gridShapeMetrics([{ x: Number.NaN, y: 0 }])).toThrow('finite');
    expect(() => validateCubeNet([{ x: 0.5, y: 0 }, ...Array.from({ length: 5 }, (_, x) => ({ x: x + 1, y: 0 }))])).toThrow(
      'safe integer',
    );
    expect(() => gridShapeMetrics(Array.from({ length: 10_001 }, (_, x) => ({ x, y: 0 })))).toThrow(
      'at most 10000',
    );
  });
});
