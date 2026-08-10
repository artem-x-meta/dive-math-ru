import { describe, expect, it } from 'vitest';
import {
  BOX_NODES,
  UNIT_BOX,
  angleBetweenLinesDegrees,
  angleBetweenPlanesDegrees,
  angleBetweenVectorsDegrees,
  angleLinePlaneDegrees,
  areCoplanar3,
  arePerpendicular3,
  boxDims,
  boxDiagonalLength,
  boxNode,
  boxPoint,
  boxSegmentName,
  boxVector,
  cosineBetween3,
  cubeDims,
  decomposeByBasis,
  distanceBetweenPlaneEquations,
  distanceToPlaneEquation,
  dot3,
  formatDecomposition,
  formatPlaneEquation,
  formatVec3,
  isBasis3,
  length3,
  lineThroughPoints3,
  planeEquation,
  planeEquationThroughPoints,
  planeEquationValue,
  planeFromEquation,
  planeNormal,
  point3,
  pointOnPlaneEquation,
  pointsDefinePlane,
  prismDims,
  projectionLength3,
  regularPrismVertex,
  regularPrismVertices,
  subscriptName,
  vec3,
} from '../src/lib/vectors3d';

const CUBE = UNIT_BOX;
const BOX = boxDims(2, 3, 6);
/** Точность сравнения углов и расстояний: пять знаков после запятой. */
const PLACES = 5;

describe('узлы прямоугольного параллелепипеда', () => {
  it('нумерует вершины, середины рёбер, центры граней и центр тела', () => {
    const groups = BOX_NODES.reduce<Record<string, number>>((counts, node) => {
      counts[node.group] = (counts[node.group] ?? 0) + 1;
      return counts;
    }, {});
    expect(groups).toEqual({ vertex: 8, edge: 12, face: 6, center: 1 });
    expect(new Set(BOX_NODES.map((node) => node.id)).size).toBe(BOX_NODES.length);
  });

  it('ставит начало координат в вершину A и направляет оси по рёбрам', () => {
    expect(boxPoint('A', CUBE)).toEqual({ x: 0, y: 0, z: 0 });
    expect(boxPoint('B', BOX)).toEqual({ x: 2, y: 0, z: 0 });
    expect(boxPoint('D', BOX)).toEqual({ x: 0, y: 3, z: 0 });
    expect(boxPoint('A1', BOX)).toEqual({ x: 0, y: 0, z: 6 });
    expect(boxPoint('C1', BOX)).toEqual({ x: 2, y: 3, z: 6 });
  });

  it('считает середины рёбер, центры граней и центр тела', () => {
    expect(boxPoint('M-AB', BOX)).toEqual({ x: 1, y: 0, z: 0 });
    expect(boxPoint('M-CC1', BOX)).toEqual({ x: 2, y: 3, z: 3 });
    expect(boxPoint('O-ABCD', BOX)).toEqual({ x: 1, y: 1.5, z: 0 });
    expect(boxPoint('O-BCC1B1', BOX)).toEqual({ x: 2, y: 1.5, z: 3 });
    expect(boxPoint('O', BOX)).toEqual({ x: 1, y: 1.5, z: 3 });
  });

  it('подписывает узлы и отрезки по-русски', () => {
    expect(boxNode('A1').label).toBe('A₁');
    expect(boxNode('M-B1C1').title).toBe('середина ребра B₁C₁');
    expect(boxNode('O-ABB1A1').title).toBe('центр грани ABB₁A₁');
    expect(boxSegmentName('A', 'C1')).toBe('AC₁');
    expect(subscriptName('A1B1C1D1')).toBe('A₁B₁C₁D₁');
    expect(() => boxPoint('Z', CUBE)).toThrow('Неизвестная точка тела');
    expect(() => boxDims(0, 1, 1)).toThrow('положительными');
  });

  it('находит диагональ параллелепипеда по трём рёбрам', () => {
    expect(boxDiagonalLength(BOX)).toBeCloseTo(7, PLACES);
    expect(length3(boxVector('A', 'C1', BOX))).toBeCloseTo(7, PLACES);
    expect(boxDiagonalLength(cubeDims(4))).toBeCloseTo(4 * Math.sqrt(3), PLACES);
  });
});

describe('скалярное произведение', () => {
  it('считается по координатам и не зависит от порядка сомножителей', () => {
    const first = vec3(2, -1, 3);
    const second = vec3(1, 4, 2);
    expect(dot3(first, second)).toBe(4);
    expect(dot3(second, first)).toBe(4);
    expect(dot3(first, first)).toBe(14);
  });

  it('даёт угол между векторами через косинус', () => {
    const first = vec3(2, -1, 3);
    const second = vec3(1, 4, 2);
    expect(cosineBetween3(first, second)).toBeCloseTo(4 / Math.sqrt(14 * 21), PLACES);
    expect(angleBetweenVectorsDegrees(first, second)).toBeCloseTo(76.5094645, PLACES);
  });

  it('равно нулю ровно для перпендикулярных векторов', () => {
    expect(dot3(vec3(2, 2, -1), vec3(3, -1, 4))).toBe(0);
    expect(arePerpendicular3(vec3(2, 2, -1), vec3(3, -1, 4))).toBe(true);
    expect(arePerpendicular3(vec3(1, 1, 1), vec3(1, 1, 0))).toBe(false);
    expect(() => arePerpendicular3(vec3(0, 0, 0), vec3(1, 1, 1))).toThrow('нулевым вектором');
  });

  it('в кубе обнаруживает перпендикулярность диагонали и диагоналей граней', () => {
    const diagonal = boxVector('A', 'C1', CUBE);
    expect(dot3(diagonal, boxVector('B', 'D', CUBE))).toBe(0);
    expect(dot3(diagonal, boxVector('A1', 'B', CUBE))).toBe(0);
  });

  it('находит проекцию вектора на направление', () => {
    expect(projectionLength3(vec3(3, 4, 0), vec3(1, 0, 0))).toBeCloseTo(3, PLACES);
    expect(projectionLength3(boxVector('A', 'C1', CUBE), boxVector('A', 'B', CUBE)))
      .toBeCloseTo(1, PLACES);
    expect(() => projectionLength3(vec3(1, 1, 1), vec3(0, 0, 0))).toThrow('нулевой вектор');
  });
});

describe('углы между диагоналями куба', () => {
  const cube = cubeDims(1);

  it('даёт 60° для диагоналей смежных граней', () => {
    const first = boxVector('A', 'B1', cube);
    const second = boxVector('B', 'C1', cube);
    expect(dot3(first, second)).toBe(1);
    expect(angleBetweenVectorsDegrees(first, second)).toBeCloseTo(60, PLACES);
  });

  it('даёт arccos(1/3) ≈ 70,53° для двух диагоналей куба', () => {
    const first = boxVector('A', 'C1', cube);
    const second = boxVector('B', 'D1', cube);
    expect(dot3(first, second)).toBe(1);
    expect(angleBetweenVectorsDegrees(first, second)).toBeCloseTo(70.5287794, PLACES);
  });

  it('даёт arccos(1/√3) ≈ 54,74° между диагональю куба и ребром', () => {
    const diagonal = boxVector('A', 'C1', cube);
    expect(angleBetweenLinesDegrees(diagonal, boxVector('A', 'B', cube)))
      .toBeCloseTo(54.7356103, PLACES);
    expect(angleBetweenLinesDegrees(diagonal, boxVector('A', 'B1', cube)))
      .toBeCloseTo(35.2643897, PLACES);
  });

  it('не зависит от длины ребра куба', () => {
    for (const edge of [1, 2, 4, 7.5]) {
      const scaled = cubeDims(edge);
      expect(angleBetweenVectorsDegrees(boxVector('A', 'B1', scaled), boxVector('B', 'C1', scaled)))
        .toBeCloseTo(60, PLACES);
    }
  });

  it('измеряет угол между прямыми в промежутке от 0° до 90°', () => {
    const first = boxVector('A', 'C1', cube);
    const second = boxVector('D1', 'B', cube);
    expect(angleBetweenVectorsDegrees(first, second)).toBeCloseTo(180 - 70.5287794, PLACES);
    expect(angleBetweenLinesDegrees(first, second)).toBeCloseTo(70.5287794, PLACES);
  });

  it('даёт 45° между диагональю боковой грани и основанием правильной призмы', () => {
    const prism = regularPrismVertices(prismDims(2, 2));
    const diagonal = { x: prism.C1.x, y: prism.C1.y, z: prism.C1.z };
    const base = planeEquation(0, 0, 1, 0);
    expect(angleLinePlaneDegrees(lineThroughPoints3(prism.A, prism.C1), planeFromEquation(base)))
      .toBeCloseTo(45, PLACES);
    expect(length3(diagonal)).toBeCloseTo(Math.sqrt(8), PLACES);
  });
});

describe('разложение по базису', () => {
  const basis = [
    boxVector('A', 'B', BOX),
    boxVector('A', 'D', BOX),
    boxVector('A', 'A1', BOX),
  ] as const;

  it('раскладывает диагонали параллелепипеда с целыми коэффициентами', () => {
    expect(decomposeByBasis(boxVector('A', 'C1', BOX), ...basis)).toEqual({ x: 1, y: 1, z: 1 });
    expect(decomposeByBasis(boxVector('B', 'D1', BOX), ...basis)).toEqual({ x: -1, y: 1, z: 1 });
    expect(decomposeByBasis(boxVector('A1', 'C', BOX), ...basis)).toEqual({ x: 1, y: 1, z: -1 });
    expect(decomposeByBasis(boxVector('A', 'O-BCC1B1', BOX), ...basis)).toEqual({ x: 1, y: 0.5, z: 0.5 });
  });

  it('отличает базис от компланарной тройки', () => {
    expect(isBasis3(...basis)).toBe(true);
    expect(areCoplanar3(vec3(1, 2, -1), vec3(0, 3, 2), vec3(2, 1, -4))).toBe(true);
    expect(isBasis3(vec3(1, 2, -1), vec3(0, 3, 2), vec3(2, 1, -4))).toBe(false);
    expect(isBasis3(vec3(0, 0, 0), vec3(0, 3, 2), vec3(2, 1, -4))).toBe(false);
    expect(() => decomposeByBasis(vec3(1, 1, 1), vec3(1, 2, -1), vec3(0, 3, 2), vec3(2, 1, -4)))
      .toThrow('не образуют базис');
  });

  it('записывает разложение обычной буквенной строкой', () => {
    expect(formatDecomposition(vec3(-1, 1, 1))).toBe('−a + b + c');
    expect(formatDecomposition(vec3(1, 0.5, 0.5))).toBe('a + 0,5b + 0,5c');
    expect(formatDecomposition(vec3(2, 0, -3), ['p', 'q', 'r'])).toBe('2p − 3r');
    expect(formatDecomposition(vec3(0, 0, 0))).toBe('0');
  });
});

describe('уравнение плоскости и расстояние до неё', () => {
  it('строит уравнение по трём точкам и приводит его к целым коэффициентам', () => {
    const equation = planeEquationThroughPoints(point3(1, 0, 0), point3(0, 2, 0), point3(0, 0, 3));
    expect(equation).toEqual({ a: 6, b: 3, c: 2, d: -6 });
    expect(formatPlaneEquation(equation)).toBe('6x + 3y + 2z − 6 = 0');
    expect(planeNormal(equation)).toEqual({ x: 6, y: 3, z: 2 });
    expect(length3(planeNormal(equation))).toBeCloseTo(7, PLACES);
  });

  it('не меняет плоскость при умножении уравнения на число', () => {
    const equation = planeEquation(-2, -2, -2, 2);
    expect(equation).toEqual({ a: 1, b: 1, c: 1, d: -1 });
    expect(formatPlaneEquation(equation)).toBe('x + y + z − 1 = 0');
    expect(formatPlaneEquation(planeEquation(0, 0, 5, 0))).toBe('z = 0');
    expect(() => planeEquation(0, 0, 0, 4)).toThrow('нулевыми одновременно');
  });

  it('переводит уравнение в пару «точка и нормаль» и обратно', () => {
    const equation = planeEquation(2, -1, 2, -6);
    const plane = planeFromEquation(equation);
    expect(pointOnPlaneEquation(equation, plane.point)).toBe(true);
    expect(planeEquationValue(equation, plane.point)).toBeCloseTo(0, PLACES);
    expect(planeNormal(equation)).toEqual(plane.normal);
  });

  it('делит на длину нормали при вычислении расстояния', () => {
    const equation = planeEquation(2, -1, 2, -6);
    expect(planeEquationValue(equation, point3(1, 1, 1))).toBe(-3);
    expect(distanceToPlaneEquation(point3(1, 1, 1), equation)).toBeCloseTo(1, PLACES);
    expect(distanceToPlaneEquation(point3(0, 0, 0), planeEquationThroughPoints(
      point3(1, 0, 0),
      point3(0, 2, 0),
      point3(0, 0, 3),
    ))).toBeCloseTo(6 / 7, PLACES);
  });

  it('в кубе даёт расстояние √3⁄3 от вершины до плоскости A₁BD', () => {
    const cube = cubeDims(1);
    const equation = planeEquationThroughPoints(
      boxPoint('A1', cube),
      boxPoint('B', cube),
      boxPoint('D', cube),
    );
    expect(equation).toEqual({ a: 1, b: 1, c: 1, d: -1 });
    expect(distanceToPlaneEquation(boxPoint('A', cube), equation)).toBeCloseTo(Math.sqrt(3) / 3, PLACES);
    expect(distanceToPlaneEquation(boxPoint('C1', cube), equation)).toBeCloseTo(2 * Math.sqrt(3) / 3, PLACES);
    // Диагональ AC₁ перпендикулярна плоскости, поэтому два расстояния дают всю диагональ.
    expect(
      distanceToPlaneEquation(boxPoint('A', cube), equation)
      + distanceToPlaneEquation(boxPoint('C1', cube), equation),
    ).toBeCloseTo(Math.sqrt(3), PLACES);
  });

  it('масштабируется вместе с ребром куба', () => {
    const cube = cubeDims(6);
    const equation = planeEquationThroughPoints(
      boxPoint('A1', cube),
      boxPoint('B', cube),
      boxPoint('D', cube),
    );
    expect(distanceToPlaneEquation(boxPoint('A', cube), equation)).toBeCloseTo(2 * Math.sqrt(3), PLACES);
  });

  it('находит расстояние между параллельными плоскостями', () => {
    expect(distanceBetweenPlaneEquations(
      planeEquation(2, -1, 2, -6),
      planeEquation(2, -1, 2, 3),
    )).toBeCloseTo(3, PLACES);
    expect(distanceBetweenPlaneEquations(
      planeEquation(1, 0, 0, 0),
      planeEquation(0, 1, 0, 0),
    )).toBe(0);
  });

  it('измеряет угол наклонной плоскости к основанию куба', () => {
    const cube = cubeDims(1);
    const slanted = planeFromEquation(planeEquationThroughPoints(
      boxPoint('A1', cube),
      boxPoint('B', cube),
      boxPoint('D', cube),
    ));
    const base = planeFromEquation(planeEquation(0, 0, 1, 0));
    expect(angleBetweenPlanesDegrees(slanted, base)).toBeCloseTo(54.7356103, PLACES);
    expect(angleLinePlaneDegrees(lineThroughPoints3(boxPoint('A', cube), boxPoint('C1', cube)), base))
      .toBeCloseTo(35.2643897, PLACES);
  });
});

describe('правильная треугольная призма', () => {
  const dims = prismDims(2, 2);

  it('кладёт основание в плоскость Oxy и делает его равносторонним', () => {
    const prism = regularPrismVertices(dims);
    expect(prism.A).toEqual({ x: 0, y: 0, z: 0 });
    expect(prism.B).toEqual({ x: 2, y: 0, z: 0 });
    expect(prism.C.x).toBeCloseTo(1, PLACES);
    expect(prism.C.y).toBeCloseTo(Math.sqrt(3), PLACES);
    expect(prism.C1.z).toBeCloseTo(2, PLACES);
    for (const [from, to] of [['A', 'B'], ['B', 'C'], ['C', 'A']] as const) {
      const edge = vec3(
        regularPrismVertex(to, dims).x - regularPrismVertex(from, dims).x,
        regularPrismVertex(to, dims).y - regularPrismVertex(from, dims).y,
        regularPrismVertex(to, dims).z - regularPrismVertex(from, dims).z,
      );
      expect(length3(edge)).toBeCloseTo(2, PLACES);
    }
  });

  it('даёт arccos(1/4) для угла между диагоналями соседних боковых граней', () => {
    const prism = regularPrismVertices(dims);
    const first = vec3(prism.B1.x - prism.A.x, prism.B1.y - prism.A.y, prism.B1.z - prism.A.z);
    const second = vec3(prism.C1.x - prism.B.x, prism.C1.y - prism.B.y, prism.C1.z - prism.B.z);
    expect(cosineBetween3(first, second)).toBeCloseTo(0.25, PLACES);
    expect(angleBetweenVectorsDegrees(first, second)).toBeCloseTo(75.5224878, PLACES);
  });

  it('даёт высоту основания как расстояние от вершины до противоположной грани', () => {
    const prism = regularPrismVertices(dims);
    const equation = planeEquationThroughPoints(prism.B, prism.C, prism.B1);
    expect(distanceToPlaneEquation(prism.A, equation)).toBeCloseTo(Math.sqrt(3), PLACES);
    expect(() => prismDims(2, 0)).toThrow('положительными');
    expect(() => regularPrismVertex('D' as never, dims)).toThrow('Неизвестная вершина призмы');
  });
});

describe('три точки и плоскость', () => {
  it('отличает тройку точек, задающую плоскость, от вырожденной', () => {
    expect(pointsDefinePlane(point3(0, 0, 0), point3(1, 0, 0), point3(0, 1, 0))).toBe(true);
    // Три точки одного ребра лежат на одной прямой.
    expect(pointsDefinePlane(
      boxPoint('A', BOX),
      boxPoint('M-AB', BOX),
      boxPoint('B', BOX),
    )).toBe(false);
    expect(pointsDefinePlane(point3(1, 2, 3), point3(1, 2, 3), point3(0, 1, 0))).toBe(false);
    expect(pointsDefinePlane(
      boxPoint('A1', BOX),
      boxPoint('B', BOX),
      boxPoint('D', BOX),
    )).toBe(true);
  });
});

describe('числа из уроков главы', () => {
  const degrees = (cosine: number) => (Math.acos(cosine) * 180) / Math.PI;

  it('урок 5.3: углы между прямыми куба', () => {
    const cube = cubeDims(6);
    // AB₁ и CD₁ перпендикулярны.
    expect(dot3(boxVector('A', 'B1', cube), boxVector('C', 'D1', cube))).toBe(0);
    // A₁B и B₁C дают 60°.
    expect(angleBetweenLinesDegrees(boxVector('A1', 'B', cube), boxVector('B1', 'C', cube)))
      .toBeCloseTo(60, PLACES);
  });

  it('урок 5.4: плоскость с нормалью (2; −1; 2) через точку M(1; 3; −1)', () => {
    const equation = planeEquation(2, -1, 2, 3);
    expect(pointOnPlaneEquation(equation, point3(1, 3, -1))).toBe(true);
    expect(formatPlaneEquation(equation)).toBe('2x − y + 2z + 3 = 0');
    expect(distanceToPlaneEquation(point3(0, 0, 0), equation)).toBeCloseTo(1, PLACES);
    expect(angleBetweenPlanesDegrees(
      planeFromEquation(equation),
      planeFromEquation(planeEquation(0, 0, 1, 0)),
    )).toBeCloseTo(degrees(2 / 3), PLACES);
  });

  it('практикум: цех 12 × 9 × 8 метров', () => {
    const hall = boxDims(12, 9, 8);
    expect(boxDiagonalLength(hall)).toBeCloseTo(17, PLACES);
    // Две диагонали цеха почти перпендикулярны, но не перпендикулярны.
    expect(dot3(boxVector('A', 'C1', hall), boxVector('B', 'D1', hall))).toBe(1);
    expect(angleBetweenLinesDegrees(boxVector('A', 'C1', hall), boxVector('B', 'D1', hall)))
      .toBeCloseTo(degrees(1 / 289), PLACES);
  });

  it('практикум: наклонная кровля через B, D и A₁', () => {
    const hall = boxDims(12, 9, 8);
    const roof = planeEquationThroughPoints(
      boxPoint('B', hall),
      boxPoint('D', hall),
      boxPoint('A1', hall),
    );
    expect(roof).toEqual({ a: 6, b: 8, c: 9, d: -72 });
    expect(formatPlaneEquation(roof)).toBe('6x + 8y + 9z − 72 = 0');
    expect(length3(planeNormal(roof))).toBeCloseTo(Math.sqrt(181), PLACES);
    expect(distanceToPlaneEquation(boxPoint('A', hall), roof)).toBeCloseTo(72 / Math.sqrt(181), PLACES);
    expect(distanceToPlaneEquation(boxPoint('A', hall), roof)).toBeCloseTo(5.35, 2);
    expect(distanceToPlaneEquation(boxPoint('C1', hall), roof)).toBeCloseTo(10.7, 1);
    expect(angleBetweenPlanesDegrees(planeFromEquation(roof), planeFromEquation(planeEquation(0, 0, 1, 0))))
      .toBeCloseTo(48.01, 2);
    // Угол диагонали цеха с кровлей.
    expect(angleLinePlaneDegrees(
      lineThroughPoints3(boxPoint('A', hall), boxPoint('C1', hall)),
      planeFromEquation(roof),
    )).toBeCloseTo(70.81, 2);
    // Вершина A и центр потолка лежат по разные стороны от кровли, но равноудалены.
    expect(planeEquationValue(roof, boxPoint('A', hall))).toBe(-72);
    expect(planeEquationValue(roof, boxPoint('O-A1B1C1D1', hall))).toBe(72);
    expect(distanceToPlaneEquation(boxPoint('O-A1B1C1D1', hall), roof))
      .toBeCloseTo(distanceToPlaneEquation(boxPoint('A', hall), roof), PLACES);
  });

  it('практикум: опора — правильная призма со стороной 6 и высотой 8', () => {
    const prism = regularPrismVertices(prismDims(6, 8));
    const first = vec3(prism.B1.x - prism.A.x, prism.B1.y - prism.A.y, prism.B1.z - prism.A.z);
    const second = vec3(prism.C1.x - prism.B.x, prism.C1.y - prism.B.y, prism.C1.z - prism.B.z);
    expect(length3(first)).toBeCloseTo(10, PLACES);
    expect(length3(second)).toBeCloseTo(10, PLACES);
    expect(cosineBetween3(first, second)).toBeCloseTo(0.46, PLACES);
    expect(angleBetweenVectorsDegrees(first, second)).toBeCloseTo(62.61, 2);
    // Угол диагонали боковой грани с плоскостью основания: sin φ = 8 : 10.
    expect(angleLinePlaneDegrees(
      lineThroughPoints3(prism.A, prism.B1),
      planeFromEquation(planeEquation(0, 0, 1, 0)),
    )).toBeCloseTo((Math.asin(0.8) * 180) / Math.PI, PLACES);
    // Расстояние до боковой грани равно высоте основания.
    expect(distanceToPlaneEquation(
      prism.A,
      planeEquationThroughPoints(prism.B, prism.C, prism.B1),
    )).toBeCloseTo(3 * Math.sqrt(3), PLACES);
  });
});

describe('запись координат', () => {
  it('печатает тройку через точку с запятой и русский минус', () => {
    expect(formatVec3(vec3(2, 3, -6))).toBe('(2; 3; −6)');
    expect(formatVec3(vec3(0.5, 0, 1.25))).toBe('(0,5; 0; 1,25)');
    expect(formatVec3(boxPoint('C1', BOX))).toBe('(2; 3; 6)');
  });
});
