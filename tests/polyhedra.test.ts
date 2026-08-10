import { describe, expect, it } from 'vitest';
import {
  CUBE_EDGES,
  PLATONIC_KINDS,
  applyTransform,
  completeEuler,
  countsFromFaces,
  cubeModel,
  cubeSection,
  cubeSectionFromEdges,
  cubeThirdPyramids,
  cuboidSurface,
  cuboidVolume,
  eulerCharacteristic,
  fitToBox,
  isFaceVisible,
  obliquePrismModel,
  obliquePyramidModel,
  planeThroughPoints,
  platonicSolid,
  pointOnCubeEdge,
  polygonArea,
  polygonPerimeter,
  prismCounts,
  prismVolume,
  projectPoint,
  pyramidCounts,
  pyramidCrossSectionArea,
  pyramidVolume,
  pyramidVolumeFromBase,
  regularPolygonArea,
  regularPolygonCircumradius,
  regularPolygonInradius,
  regularPrismModel,
  regularPrismSurface,
  regularPrismVolume,
  regularPyramidModel,
  regularPyramidSurface,
  regularPyramidVolume,
  roundTo,
  satisfiesEuler,
  tetrahedronVolume,
  viewerDirection,
  visibleEdges,
  type Vec3,
} from '../src/lib/polyhedra';

const SQRT2 = Math.SQRT2;
const SQRT3 = Math.sqrt(3);

describe('formula Eulera', () => {
  it('gives characteristic 2 for prisms and pyramids of any base', () => {
    for (let n = 3; n <= 12; n += 1) {
      expect(eulerCharacteristic(prismCounts(n))).toBe(2);
      expect(eulerCharacteristic(pyramidCounts(n))).toBe(2);
    }
  });

  it('counts elements of prisms and pyramids', () => {
    expect(prismCounts(6)).toEqual({ vertices: 12, edges: 18, faces: 8 });
    expect(pyramidCounts(4)).toEqual({ vertices: 5, edges: 8, faces: 5 });
    expect(pyramidCounts(3)).toEqual({ vertices: 4, edges: 6, faces: 4 });
    expect(platonicSolid('cube')).toMatchObject(prismCounts(4));
  });

  it('rejects impossible bases', () => {
    expect(() => prismCounts(2)).toThrow('от 3 до 24');
    expect(() => pyramidCounts(3.5)).toThrow('от 3 до 24');
    expect(() => prismCounts(25)).toThrow('от 3 до 24');
  });

  it('detects shapes that break the relation', () => {
    expect(satisfiesEuler({ vertices: 8, edges: 12, faces: 6 })).toBe(true);
    expect(satisfiesEuler({ vertices: 8, edges: 12, faces: 5 })).toBe(false);
    expect(eulerCharacteristic({ vertices: 16, edges: 32, faces: 16 })).toBe(0);
  });

  it('restores the single missing count', () => {
    expect(completeEuler(null, 30, 12)).toEqual({ vertices: 20, edges: 30, faces: 12 });
    expect(completeEuler(12, null, 20)).toEqual({ vertices: 12, edges: 30, faces: 20 });
    expect(completeEuler(6, 12, null)).toEqual({ vertices: 6, edges: 12, faces: 8 });
    expect(() => completeEuler(6, 12, 8)).toThrow('Ровно одно');
    expect(() => completeEuler(null, null, 8)).toThrow('Ровно одно');
    expect(() => completeEuler(null, -1, 8)).toThrow('целым неотрицательным');
  });

  it('derives counts from faces, face sides and vertex degree', () => {
    expect(countsFromFaces(12, 5, 3)).toEqual({ vertices: 20, edges: 30, faces: 12 });
    expect(countsFromFaces(20, 3, 5)).toEqual({ vertices: 12, edges: 30, faces: 20 });
    expect(countsFromFaces(8, 3, 4)).toEqual({ vertices: 6, edges: 12, faces: 8 });
    expect(() => countsFromFaces(5, 3, 3)).toThrow('чётным');
    expect(() => countsFromFaces(6, 4, 5)).toThrow('не согласовано');
    expect(() => countsFromFaces(6, 2, 3)).toThrow('не меньше трёх сторон');
  });

  it('lists exactly five platonic solids that all satisfy the relation', () => {
    expect(PLATONIC_KINDS).toHaveLength(5);
    for (const kind of PLATONIC_KINDS) {
      const solid = platonicSolid(kind);
      expect(satisfiesEuler(solid)).toBe(true);
      expect(solid.faces * solid.faceSides).toBe(2 * solid.edges);
      expect(solid.vertices * solid.vertexDegree).toBe(2 * solid.edges);
    }
    expect(platonicSolid('icosahedron')).toMatchObject({ vertices: 12, edges: 30, faces: 20 });
    expect(platonicSolid('tetrahedron')).toMatchObject({ vertices: 4, edges: 6, faces: 4 });
  });
});

describe('ploshchad poverkhnosti', () => {
  it('computes the regular polygon base', () => {
    expect(regularPolygonArea(4, 5)).toBeCloseTo(25, 10);
    expect(regularPolygonArea(3, 6)).toBeCloseTo(9 * SQRT3, 10);
    expect(regularPolygonArea(6, 4)).toBeCloseTo(24 * SQRT3, 10);
    expect(regularPolygonCircumradius(6, 4)).toBeCloseTo(4, 10);
    expect(regularPolygonInradius(4, 6)).toBeCloseTo(3, 10);
    expect(regularPolygonCircumradius(4, 6)).toBeCloseTo(3 * SQRT2, 10);
  });

  it('splits the prism surface into base and lateral parts', () => {
    const square = regularPrismSurface(4, 3, 5);
    expect(square.baseArea).toBeCloseTo(9, 10);
    expect(square.basePerimeter).toBe(12);
    expect(square.lateralArea).toBeCloseTo(60, 10);
    expect(square.totalArea).toBeCloseTo(78, 10);

    const hexagonal = regularPrismSurface(6, 4, 10);
    expect(hexagonal.lateralArea).toBeCloseTo(240, 10);
    expect(hexagonal.totalArea).toBeCloseTo(240 + 48 * SQRT3, 10);
  });

  it('matches the cube through both formulas', () => {
    expect(regularPrismSurface(4, 3, 3).totalArea).toBeCloseTo(54, 10);
    expect(cuboidSurface(3, 3, 3)).toBe(54);
    expect(cuboidSurface(2, 3, 4)).toBe(52);
  });

  it('uses the slant height for the pyramid, not the height', () => {
    const pyramid = regularPyramidSurface(4, 6, 4);
    expect(pyramid.inradius).toBeCloseTo(3, 10);
    expect(pyramid.apothem).toBeCloseTo(5, 10);
    expect(pyramid.lateralEdge).toBeCloseTo(Math.sqrt(34), 10);
    expect(pyramid.baseArea).toBeCloseTo(36, 10);
    expect(pyramid.lateralArea).toBeCloseTo(60, 10);
    expect(pyramid.totalArea).toBeCloseTo(96, 10);
    // Ошибка «взять высоту вместо апофемы» даёт заметно меньший ответ.
    expect(0.5 * pyramid.basePerimeter * 4).toBeCloseTo(48, 10);
  });

  it('handles a triangular pyramid with irrational answers', () => {
    const pyramid = regularPyramidSurface(3, 6, 4);
    expect(pyramid.inradius).toBeCloseTo(SQRT3, 10);
    expect(pyramid.apothem).toBeCloseTo(Math.sqrt(19), 10);
    expect(pyramid.lateralArea).toBeCloseTo(9 * Math.sqrt(19), 10);
    expect(pyramid.totalArea).toBeCloseTo(9 * SQRT3 + 9 * Math.sqrt(19), 10);
  });

  it('scales the surface as the square of the linear size', () => {
    const small = regularPyramidSurface(6, 2, 3).totalArea;
    const large = regularPyramidSurface(6, 4, 6).totalArea;
    expect(large / small).toBeCloseTo(4, 10);
  });

  it('rejects non-positive measurements', () => {
    expect(() => regularPrismSurface(4, 0, 5)).toThrow('положительным');
    expect(() => regularPyramidSurface(4, 5, -1)).toThrow('положительным');
    expect(() => cuboidSurface(1, 2, 0)).toThrow('положительным');
    expect(() => regularPolygonArea(6, Number.NaN)).toThrow('конечным');
  });
});

/**
 * Независимая проверка объёма любой выпуклой модели: тело разрезается на пирамиды
 * с общей вершиной во внутренней точке, основаниями служат грани.
 */
function modelVolume(model: { vertices: readonly Vec3[]; faces: readonly (readonly number[])[] }): number {
  const inner = model.vertices.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y, z: sum.z + point.z }),
    { x: 0, y: 0, z: 0 },
  );
  const center: Vec3 = {
    x: inner.x / model.vertices.length,
    y: inner.y / model.vertices.length,
    z: inner.z / model.vertices.length,
  };
  return model.faces.reduce(
    (sum, face) => sum + pyramidVolumeFromBase(face.map((index) => model.vertices[index] as Vec3), center),
    0,
  );
}

describe('obyomy mnogogrannikov', () => {
  it('measures the box by three edges', () => {
    expect(cuboidVolume(3, 4, 5)).toBe(60);
    expect(cuboidVolume(4, 4, 4)).toBe(64);
    // Кубический дециметр — это литр: 10 см × 10 см × 10 см.
    expect(cuboidVolume(10, 10, 10)).toBe(1000);
    expect(() => cuboidVolume(3, 0, 5)).toThrow('положительным');
  });

  it('multiplies base area by height for a prism', () => {
    expect(prismVolume(12, 5)).toBe(60);

    const square = regularPrismVolume(4, 3, 5);
    expect(square.baseArea).toBeCloseTo(9, 10);
    expect(square.volume).toBeCloseTo(45, 10);
    expect(square.volume).toBeCloseTo(cuboidVolume(3, 3, 5), 10);
    expect(square.share).toBe(1);

    const hexagonal = regularPrismVolume(6, 4, 10);
    expect(hexagonal.baseArea).toBeCloseTo(24 * SQRT3, 10);
    expect(hexagonal.volume).toBeCloseTo(240 * SQRT3, 10);
  });

  it('gives the pyramid exactly one third of its prism', () => {
    expect(pyramidVolume(12, 5)).toBeCloseTo(20, 10);

    const pyramid = regularPyramidVolume(4, 6, 9);
    expect(pyramid.baseArea).toBeCloseTo(36, 10);
    expect(pyramid.volume).toBeCloseTo(108, 10);
    expect(pyramid.prismVolume).toBeCloseTo(324, 10);
    expect(pyramid.share).toBeCloseTo(1 / 3, 12);
    expect(pyramid.volume * 3).toBeCloseTo(regularPrismVolume(4, 6, 9).volume, 10);

    const triangular = regularPyramidVolume(3, 6, 5);
    expect(triangular.baseArea).toBeCloseTo(9 * SQRT3, 10);
    expect(triangular.volume).toBeCloseTo(15 * SQRT3, 10);
  });

  it('cuts the cube into three pyramids of equal volume', () => {
    const pieces = cubeThirdPyramids(3);
    expect(pieces).toHaveLength(3);
    for (const piece of pieces) {
      expect(piece.base).toHaveLength(4);
      expect(piece.volume).toBeCloseTo(9, 10);
      expect(piece.volume).toBeCloseTo(cuboidVolume(3, 3, 3) / 3, 10);
      // Каждый кусок — пирамида с площадью основания 9 и высотой 3.
      expect(piece.volume).toBeCloseTo(pyramidVolume(9, 3), 10);
    }
    const total = pieces.reduce((sum, piece) => sum + piece.volume, 0);
    expect(total).toBeCloseTo(cuboidVolume(3, 3, 3), 10);
    expect(pieces.map((piece) => piece.baseName)).toEqual(['BCC₁B₁', 'CDD₁C₁', 'A₁B₁C₁D₁']);
    expect(cubeThirdPyramids(1)[0]?.volume).toBeCloseTo(1 / 3, 12);
  });

  it('computes volumes straight from the vertices', () => {
    // Угловой тетраэдр единичного куба: 1/3 · (1/2) · 1 = 1/6.
    expect(tetrahedronVolume(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    )).toBeCloseTo(1 / 6, 12);

    const base: Vec3[] = [
      { x: -3, y: -3, z: 0 },
      { x: 3, y: -3, z: 0 },
      { x: 3, y: 3, z: 0 },
      { x: -3, y: 3, z: 0 },
    ];
    expect(pyramidVolumeFromBase(base, { x: 0, y: 0, z: 4 })).toBeCloseTo(48, 10);
    // Сдвиг вершины в сторону не меняет объём: основание и высота те же.
    expect(pyramidVolumeFromBase(base, { x: 9, y: 0, z: 4 })).toBeCloseTo(48, 10);
    expect(() => pyramidVolumeFromBase(base.slice(0, 2), { x: 0, y: 0, z: 4 })).toThrow('не меньше трёх');
  });

  it('keeps sections equal in area for the Cavalieri argument', () => {
    expect(pyramidCrossSectionArea(36, 6, 0)).toBeCloseTo(36, 10);
    expect(pyramidCrossSectionArea(36, 6, 3)).toBeCloseTo(9, 10);
    expect(pyramidCrossSectionArea(36, 6, 6)).toBeCloseTo(0, 12);

    // Пирамиды с разными основаниями, но равными площадью основания и высотой
    // дают на каждом уровне равные площади сечений — условие принципа Кавальери.
    const square = regularPyramidVolume(4, 6, 6);
    const hexagonSide = 6 / Math.sqrt(regularPolygonArea(6, 1));
    const hexagonal = regularPyramidVolume(6, hexagonSide, 6);
    expect(hexagonal.baseArea).toBeCloseTo(square.baseArea, 10);
    for (const level of [0, 1.5, 3, 4.5]) {
      expect(pyramidCrossSectionArea(hexagonal.baseArea, hexagonal.height, level)).toBeCloseTo(
        pyramidCrossSectionArea(square.baseArea, square.height, level),
        10,
      );
    }
    expect(hexagonal.volume).toBeCloseTo(square.volume, 10);
    expect(() => pyramidCrossSectionArea(36, 6, 7)).toThrow('между 0 и высотой');
  });

  it('does not change the volume when the top is shifted sideways', () => {
    const straight = regularPrismModel(6, 4, 10);
    const leaning = obliquePrismModel(6, 4, 10, 5, -2);
    expect(leaning.vertices).toHaveLength(straight.vertices.length);
    expect(leaning.edges).toHaveLength(18);
    expect(leaning.faces).toHaveLength(8);
    expect(modelVolume(straight)).toBeCloseTo(240 * SQRT3, 8);
    expect(modelVolume(leaning)).toBeCloseTo(modelVolume(straight), 8);
    expect(modelVolume(leaning)).toBeCloseTo(regularPrismVolume(6, 4, 10).volume, 8);

    const cone = regularPyramidModel(4, 6, 9);
    const leaningCone = obliquePyramidModel(4, 6, 9, 7, 4);
    expect(modelVolume(cone)).toBeCloseTo(108, 8);
    expect(modelVolume(leaningCone)).toBeCloseTo(108, 8);
    // Наклонное тело остаётся выпуклым, поэтому чертёж строится без ошибок.
    for (const model of [leaning, leaningCone]) {
      const flags = visibleEdges(model, 'isometric');
      expect(flags).toHaveLength(model.edges.length);
      expect(flags.some(Boolean)).toBe(true);
      expect(flags.every(Boolean)).toBe(false);
      expect(model.faces.some((_, index) => isFaceVisible(model, index, 'cabinet'))).toBe(true);
    }

    // Прямая призма — частный случай наклонной с нулевым сдвигом.
    expect(obliquePrismModel(5, 3, 4)).toEqual(regularPrismModel(5, 3, 4));
    expect(obliquePyramidModel(5, 3, 4)).toEqual(regularPyramidModel(5, 3, 4));
    expect(() => obliquePrismModel(6, 4, 10, Number.NaN)).toThrow('конечным');
  });

  it('rejects impossible measurements', () => {
    expect(() => prismVolume(0, 5)).toThrow('положительным');
    expect(() => pyramidVolume(12, -3)).toThrow('положительным');
    expect(() => regularPrismVolume(2, 3, 4)).toThrow('от 3 до 24');
    expect(() => regularPyramidVolume(4, 3, 0)).toThrow('положительным');
  });
});

describe('modeli i proektsii', () => {
  it('builds a prism and a pyramid with the announced element counts', () => {
    const prism = regularPrismModel(6, 4, 10);
    expect(prism.vertices).toHaveLength(12);
    expect(prism.edges).toHaveLength(18);
    expect(prism.faces).toHaveLength(8);

    const pyramid = regularPyramidModel(4, 6, 4);
    expect(pyramid.vertices).toHaveLength(5);
    expect(pyramid.edges).toHaveLength(8);
    expect(pyramid.faces).toHaveLength(5);
    expect(pyramid.vertices[4]).toEqual({ x: 0, y: 0, z: 4 });
  });

  it('keeps the isometric projection parallel and degenerate along (1,1,1)', () => {
    const origin = projectPoint({ x: 0, y: 0, z: 0 }, 'isometric');
    const diagonal = projectPoint({ x: 1, y: 1, z: 1 }, 'isometric');
    expect(origin.x).toBeCloseTo(diagonal.x, 12);
    expect(origin.y).toBeCloseTo(diagonal.y, 12);

    // Параллельность: равные векторы дают равные смещения на экране.
    const shift: Vec3 = { x: 2, y: -1, z: 3 };
    const first = projectPoint({ x: 1, y: 1, z: 1 }, 'isometric');
    const second = projectPoint({ x: 3, y: 0, z: 4 }, 'isometric');
    const third = projectPoint({ x: 5, y: -1, z: 7 }, 'isometric');
    expect(second.x - first.x).toBeCloseTo(third.x - second.x, 12);
    expect(second.y - first.y).toBeCloseTo(third.y - second.y, 12);
    expect(shift.x).toBe(2);
  });

  it('shortens the depth axis twice in the cabinet projection', () => {
    const depth = projectPoint({ x: 0, y: 1, z: 0 }, 'cabinet');
    expect(Math.hypot(depth.x, depth.y)).toBeCloseTo(0.5, 12);
    expect(projectPoint({ x: 1, y: 0, z: 0 }, 'cabinet')).toEqual({ x: 1, y: -0 });
    expect(projectPoint({ x: 0, y: 0, z: 1 }, 'cabinet').y).toBeCloseTo(-1, 12);
    expect(() => projectPoint({ x: 0, y: 0, z: 0 }, 'oblique' as never)).toThrow('Неизвестная проекция');
  });

  it('hides exactly the three edges at the far vertex of a cube', () => {
    const cube = cubeModel(1);
    const flags = visibleEdges(cube, 'cabinet');
    expect(flags.filter(Boolean)).toHaveLength(9);
    const hidden = CUBE_EDGES.filter((_, index) => !flags[index]).map((edge) => edge.id).sort();
    expect(hidden).toEqual(['AD', 'CD', 'DD1']);
    expect(visibleEdges(cube, 'isometric').filter(Boolean)).toHaveLength(9);
  });

  it('marks a face visible only when its outward normal looks at the viewer', () => {
    const cube = cubeModel(1);
    // Грани перечислены как ABCD, A₁B₁C₁D₁, ABB₁A₁, BCC₁B₁, CDD₁C₁, ADD₁A₁.
    expect(isFaceVisible(cube, 0, 'cabinet')).toBe(false);
    expect(isFaceVisible(cube, 1, 'cabinet')).toBe(true);
    expect(isFaceVisible(cube, 2, 'cabinet')).toBe(true);
    expect(isFaceVisible(cube, 3, 'cabinet')).toBe(true);
    expect(isFaceVisible(cube, 4, 'cabinet')).toBe(false);
    expect(isFaceVisible(cube, 5, 'cabinet')).toBe(false);
    expect(Math.hypot(...Object.values(viewerDirection('isometric')))).toBeCloseTo(1, 12);
  });

  it('fits a projection into a box without distorting proportions', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ];
    const transform = fitToBox(points, { width: 400, height: 300, padding: 20 });
    expect(transform.scale).toBeCloseTo(180, 10);
    const corner = applyTransform({ x: 0, y: 0 }, transform);
    const opposite = applyTransform({ x: 2, y: 1 }, transform);
    expect(opposite.x - corner.x).toBeCloseTo(360, 10);
    expect(opposite.y - corner.y).toBeCloseTo(180, 10);
    expect(() => fitToBox(points, { width: 40, height: 40, padding: 30 })).toThrow('Отступ');
  });
});

describe('sechenie kuba', () => {
  it('cuts a regular triangle off the corner through three midpoints', () => {
    const section = cubeSectionFromEdges([
      { edgeId: 'AB', t: 0.5 },
      { edgeId: 'AD', t: 0.5 },
      { edgeId: 'AA1', t: 0.5 },
    ], 1);
    expect(section.sides).toBe(3);
    expect(section.shape).toBe('треугольник');
    expect(section.regular).toBe(true);
    expect(section.sideLengths.every((side) => Math.abs(side - SQRT2 / 2) < 1e-12)).toBe(true);
    expect(section.perimeter).toBeCloseTo(1.5 * SQRT2, 12);
    expect(section.area).toBeCloseTo(SQRT3 / 8, 12);
    expect([...section.vertices].map((point) => [point.x, point.y, point.z].map((value) => roundTo(value, 6)))).toEqual(
      expect.arrayContaining([[0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5]]),
    );
  });

  it('produces a regular hexagon through midpoints of AB, BC and CC1', () => {
    const section = cubeSectionFromEdges([
      { edgeId: 'AB', t: 0.5 },
      { edgeId: 'BC', t: 0.5 },
      { edgeId: 'CC1', t: 0.5 },
    ], 1);
    expect(section.sides).toBe(6);
    expect(section.shape).toBe('шестиугольник');
    expect(section.regular).toBe(true);
    expect(section.perimeter).toBeCloseTo(3 * SQRT2, 12);
    expect(section.area).toBeCloseTo((3 * SQRT3) / 4, 12);
    // Плоскость перпендикулярна диагонали DB₁ и проходит через центр куба.
    expect(Math.abs(section.plane.normal.x)).toBeCloseTo(1 / SQRT3, 12);
    expect(section.vertices.every((point) => Math.abs(point.x - point.y + point.z - 0.5) < 1e-12)).toBe(true);
  });

  it('produces a pentagon when the plane meets five faces', () => {
    const section = cubeSectionFromEdges([
      { edgeId: 'AB', t: 0.5 },
      { edgeId: 'AD', t: 0.5 },
      { edgeId: 'CC1', t: 0.5 },
    ], 1);
    expect(section.sides).toBe(5);
    expect(section.shape).toBe('пятиугольник');
    expect(section.regular).toBe(false);
    expect(section.area).toBeCloseTo(0.967349, 5);
    expect(section.vertices).toHaveLength(5);
  });

  it('returns the diagonal rectangle ACC1A1', () => {
    const section = cubeSectionFromEdges([
      { edgeId: 'AA1', t: 0 },
      { edgeId: 'CC1', t: 0 },
      { edgeId: 'CC1', t: 1 },
    ], 1);
    expect(section.sides).toBe(4);
    expect(section.area).toBeCloseTo(SQRT2, 12);
    expect(section.perimeter).toBeCloseTo(2 + 2 * SQRT2, 12);
    expect([...section.sideLengths].sort((a, b) => a - b).map((value) => roundTo(value, 6)))
      .toEqual([1, 1, roundTo(SQRT2, 6), roundTo(SQRT2, 6)]);
  });

  it('reproduces the section of a cube with edge 6 by scaling', () => {
    const unit = cubeSectionFromEdges([
      { edgeId: 'AB', t: 0.5 },
      { edgeId: 'BC', t: 0.5 },
      { edgeId: 'CC1', t: 0.5 },
    ], 1);
    const scaled = cubeSectionFromEdges([
      { edgeId: 'AB', t: 0.5 },
      { edgeId: 'BC', t: 0.5 },
      { edgeId: 'CC1', t: 0.5 },
    ], 6);
    expect(scaled.sides).toBe(unit.sides);
    expect(scaled.perimeter / unit.perimeter).toBeCloseTo(6, 10);
    expect(scaled.area / unit.area).toBeCloseTo(36, 10);
    expect(scaled.area).toBeCloseTo(27 * SQRT3, 10);
  });

  it('gives a square when the plane is parallel to a face', () => {
    const section = cubeSection([
      { x: 0, y: 0, z: 0.4 },
      { x: 1, y: 0, z: 0.4 },
      { x: 0, y: 1, z: 0.4 },
    ], 1);
    expect(section.sides).toBe(4);
    expect(section.regular).toBe(true);
    expect(section.area).toBeCloseTo(1, 12);
    expect(section.plane.offset).toBeCloseTo(0.4, 12);
  });

  it('agrees with direct polygon measurements', () => {
    const section = cubeSectionFromEdges([
      { edgeId: 'AB', t: 0.5 },
      { edgeId: 'BC', t: 0.5 },
      { edgeId: 'CC1', t: 0.5 },
    ], 1);
    expect(polygonArea(section.vertices)).toBeCloseTo(section.area, 12);
    expect(polygonPerimeter(section.vertices)).toBeCloseTo(section.perimeter, 12);
    expect(polygonArea(section.vertices.slice(0, 2))).toBe(0);
    expect(polygonPerimeter([])).toBe(0);
  });

  it('places points on cube edges and refuses impossible input', () => {
    expect(pointOnCubeEdge('CC1', 0.25, 4)).toEqual({ x: 4, y: 4, z: 1 });
    expect(pointOnCubeEdge('A1D1', 1, 1)).toEqual({ x: 0, y: 1, z: 1 });
    expect(() => pointOnCubeEdge('AC', 0.5)).toThrow('Неизвестное ребро');
    expect(() => pointOnCubeEdge('AB', 1.5)).toThrow('между 0 и 1');
  });

  it('refuses degenerate planes', () => {
    expect(() => planeThroughPoints(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
      { x: 2, y: 2, z: 2 },
    )).toThrow('одной прямой');
    expect(() => cubeSectionFromEdges([
      { edgeId: 'AB', t: 0 },
      { edgeId: 'AB', t: 0.5 },
      { edgeId: 'AB', t: 1 },
    ], 1)).toThrow('одной прямой');
    expect(() => cubeSection([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }], 1)).toThrow('тремя точками');
  });
});
