import { describe, expect, it } from 'vitest';
import {
  anglesWithSine,
  angleShapeFromCosine,
  arcLength,
  arcLengthPiCoefficient,
  circleArea,
  circleAreaPiCoefficient,
  circumference,
  circumferencePiCoefficient,
  circumradius,
  cosineDegrees,
  cosineFromSides,
  lawOfCosinesAngle,
  lawOfCosinesSide,
  lawOfSinesSide,
  regularPolygonArea,
  regularPolygonCentralAngle,
  regularPolygonCircumradius,
  regularPolygonInradius,
  regularPolygonInteriorAngle,
  regularPolygonMetrics,
  regularPolygonSideFromCircumradius,
  regularPolygonSideFromInradius,
  regularPolygonVertices,
  sectorArea,
  sectorAreaPiCoefficient,
  segmentArea,
  sineDegrees,
  sineOfAngleFromSides,
  solveByAsa,
  solveBySas,
  solveBySsa,
  solveBySss,
  solvedTriangleVertices,
  supplementaryAngle,
  triangleAreaBySas,
  trianglesAnglesFromSides,
  triangleShapeFromSides,
  triangleVerticesFromSides,
} from '../src/lib/triangles';

describe('синус и косинус углов от 0° до 180°', () => {
  it('даёт точные значения там, где они рациональны', () => {
    expect(sineDegrees(0)).toBe(0);
    expect(sineDegrees(30)).toBe(0.5);
    expect(sineDegrees(90)).toBe(1);
    expect(sineDegrees(150)).toBe(0.5);
    expect(sineDegrees(180)).toBe(0);
    expect(cosineDegrees(0)).toBe(1);
    expect(cosineDegrees(60)).toBe(0.5);
    expect(cosineDegrees(90)).toBe(0);
    expect(cosineDegrees(120)).toBe(-0.5);
    expect(cosineDegrees(180)).toBe(-1);
  });

  it('сохраняет формулы приведения sin(180° − α) = sin α и cos(180° − α) = −cos α', () => {
    for (const alpha of [10, 25, 40, 55, 70, 88]) {
      expect(sineDegrees(supplementaryAngle(alpha))).toBe(sineDegrees(alpha));
      expect(cosineDegrees(supplementaryAngle(alpha))).toBe(-cosineDegrees(alpha));
    }
  });

  it('держит синус неотрицательным, а косинус — меняющим знак в 90°', () => {
    expect(sineDegrees(120)).toBeGreaterThan(0);
    expect(cosineDegrees(45)).toBeGreaterThan(0);
    expect(cosineDegrees(135)).toBeLessThan(0);
    expect(angleShapeFromCosine(cosineDegrees(45))).toBe('acute');
    expect(angleShapeFromCosine(cosineDegrees(90))).toBe('right');
    expect(angleShapeFromCosine(cosineDegrees(135))).toBe('obtuse');
  });

  it('отвергает углы вне промежутка от 0° до 180°', () => {
    expect(() => sineDegrees(-1)).toThrow('от 0° до 180°');
    expect(() => cosineDegrees(190)).toThrow('от 0° до 180°');
    expect(() => supplementaryAngle(Number.NaN)).toThrow('от 0° до 180°');
  });
});

describe('теорема косинусов', () => {
  it('находит третью сторону по двум сторонам и углу между ними', () => {
    expect(lawOfCosinesSide(5, 8, 60)).toBe(7);
    expect(lawOfCosinesSide(3, 4, 90)).toBe(5);
    expect(lawOfCosinesSide(7, 3, 120)).toBe(Math.round(Math.sqrt(79) * 1e10) / 1e10);
  });

  it('в прямоугольном случае превращается в теорему Пифагора', () => {
    expect(lawOfCosinesSide(6, 8, 90)).toBe(10);
    expect(lawOfCosinesSide(5, 12, 90)).toBe(13);
  });

  it('находит угол по трём сторонам без накопления погрешности', () => {
    expect(cosineFromSides(5, 3, 4)).toBe(0);
    expect(cosineFromSides(7, 5, 8)).toBe(0.5);
    expect(cosineFromSides(7, 3, 5)).toBe(-0.5);
    expect(lawOfCosinesAngle(5, 3, 4)).toBe(90);
    expect(lawOfCosinesAngle(7, 5, 8)).toBe(60);
    expect(lawOfCosinesAngle(7, 3, 5)).toBe(120);
  });

  it('возвращает все три угла с суммой 180°', () => {
    const angles = trianglesAnglesFromSides(6, 7, 9);
    expect(angles.reduce((sum, angle) => sum + angle, 0)).toBeCloseTo(180, 6);
    expect(angles[2]).toBeGreaterThan(angles[1]);
    expect(angles[1]).toBeGreaterThan(angles[0]);
  });

  it('определяет вид треугольника по знаку косинуса наибольшего угла', () => {
    expect(triangleShapeFromSides(3, 4, 5)).toBe('right');
    expect(triangleShapeFromSides(4, 5, 6)).toBe('acute');
    expect(triangleShapeFromSides(2, 3, 4)).toBe('obtuse');
  });

  it('проверяет неравенство треугольника до вычислений', () => {
    expect(() => cosineFromSides(3, 1, 2)).toThrow('не существует');
    expect(() => lawOfCosinesAngle(10, 2, 3)).toThrow('не существует');
    expect(() => solveBySss(1, 2, 3)).toThrow('не существует');
  });

  it('запрещает вырожденные углы и неположительные стороны', () => {
    expect(() => lawOfCosinesSide(5, 8, 180)).toThrow('строго между 0° и 180°');
    expect(() => lawOfCosinesSide(5, 8, 0)).toThrow('строго между 0° и 180°');
    expect(() => lawOfCosinesSide(0, 8, 60)).toThrow('положительное конечное число');
  });
});

describe('теорема синусов и описанная окружность', () => {
  it('связывает сторону с противолежащим углом', () => {
    expect(lawOfSinesSide(10, 30, 90)).toBe(20);
    expect(lawOfSinesSide(6, 30, 30)).toBe(6);
    expect(lawOfSinesSide(12, 150, 30)).toBe(12);
  });

  it('даёт радиус описанной окружности, равный половине гипотенузы', () => {
    expect(circumradius(5, 90)).toBe(2.5);
    expect(circumradius(13, 90)).toBe(6.5);
    expect(circumradius(1, 60)).toBeCloseTo(1 / Math.sqrt(3), 9);
  });

  it('одинаково работает для острого и тупого угла с равным синусом', () => {
    expect(circumradius(8, 30)).toBe(circumradius(8, 150));
  });

  it('находит синус второго угла и оба подходящих значения', () => {
    expect(sineOfAngleFromSides(6, 30, 9)).toBe(0.75);
    expect(anglesWithSine(0.5)).toEqual([30, 150]);
    expect(anglesWithSine(1)).toEqual([90]);
    expect(anglesWithSine(1.4)).toEqual([]);
  });

  it('отвергает несуществующий угол и вырожденные данные', () => {
    expect(() => circumradius(5, 180)).toThrow('строго между 0° и 180°');
    expect(() => anglesWithSine(0)).toThrow('положительным числом');
  });
});

describe('площадь через синус', () => {
  it('считает площадь по двум сторонам и углу между ними', () => {
    expect(triangleAreaBySas(6, 8, 30)).toBe(12);
    expect(triangleAreaBySas(4, 5, 90)).toBe(10);
  });

  it('даёт одинаковую площадь для смежных углов', () => {
    expect(triangleAreaBySas(6, 8, 30)).toBe(triangleAreaBySas(6, 8, 150));
  });

  it('согласуется с формулой Герона', () => {
    // Стороны 5 и 8 с углом 60° между ними дают третью сторону 7.
    expect(triangleAreaBySas(5, 8, 60)).toBeCloseTo(Math.sqrt(300), 8);
  });
});

describe('решение треугольников', () => {
  it('решает треугольник по трём сторонам', () => {
    const solved = solveBySss(3, 4, 5);
    expect(solved.angles[2]).toBe(90);
    expect(solved.shape).toBe('right');
    expect(solved.area).toBe(6);
    expect(solved.perimeter).toBe(12);
    expect(solved.circumradius).toBeCloseTo(2.5, 8);
  });

  it('решает треугольник по двум сторонам и углу между ними', () => {
    const solved = solveBySas(5, 60, 8);
    expect(solved.sides[0]).toBe(7);
    expect(solved.angles[0]).toBe(60);
    expect(solved.angles.reduce((sum, angle) => sum + angle, 0)).toBeCloseTo(180, 6);
    expect(solved.area).toBeCloseTo(Math.sqrt(300), 8);
    expect(solved.shape).toBe('acute');
  });

  it('решает треугольник по стороне и двум прилежащим углам', () => {
    const solved = solveByAsa(45, 10, 60);
    expect(solved.angles).toEqual([45, 60, 75]);
    expect(solved.sides[2]).toBe(10);
    expect(solved.sides[0]).toBeCloseTo((10 * Math.sin(Math.PI / 4)) / Math.sin((75 * Math.PI) / 180), 8);
    expect(solved.sides[1]).toBeCloseTo((10 * Math.sin(Math.PI / 3)) / Math.sin((75 * Math.PI) / 180), 8);
  });

  it('в равностороннем треугольнике возвращает три угла по 60°', () => {
    const solved = solveBySss(6, 6, 6);
    expect(solved.angles.map((angle) => Math.round(angle))).toEqual([60, 60, 60]);
    expect(solved.area).toBeCloseTo(9 * Math.sqrt(3), 8);
  });

  it('честно показывает неоднозначность набора «две стороны и угол не между ними»', () => {
    expect(solveBySsa(6, 9, 30)).toHaveLength(2);
    expect(solveBySsa(10, 6, 30)).toHaveLength(1);
    expect(solveBySsa(3, 9, 30)).toHaveLength(0);
  });

  it('в неоднозначном случае даёт острый и тупой варианты второго угла', () => {
    const [first, second] = solveBySsa(6, 9, 30);
    expect(first?.angles[1]).toBeCloseTo(48.5903779, 6);
    expect(second?.angles[1]).toBeCloseTo(131.4096221, 6);
    expect(first?.angles[1] ?? 0).toBeLessThan(90);
    expect(second?.angles[1] ?? 0).toBeGreaterThan(90);
  });

  it('отвергает набор углов с суммой не меньше 180°', () => {
    expect(() => solveByAsa(100, 10, 90)).toThrow('меньше 180°');
  });
});

describe('честный чертёж треугольника', () => {
  it('ставит вершины так, что все три стороны совпадают с данными', () => {
    const { a, b, c } = triangleVerticesFromSides(7, 5, 8);
    expect(a).toEqual({ x: 0, y: 0 });
    expect(b).toEqual({ x: 8, y: 0 });
    expect(Math.hypot(c.x - a.x, c.y - a.y)).toBeCloseTo(5, 8);
    expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeCloseTo(7, 8);
  });

  it('поднимает вершину C над осью и для тупого угла A', () => {
    const { c } = triangleVerticesFromSides(7, 3, 5);
    expect(c.y).toBeGreaterThan(0);
    expect(c.x).toBeLessThan(0);
  });

  it('строит чертёж прямо по решённому треугольнику', () => {
    const vertices = solvedTriangleVertices(solveBySas(5, 60, 8));
    expect(Math.hypot(vertices.c.x - vertices.b.x, vertices.c.y - vertices.b.y)).toBeCloseTo(7, 8);
  });
});

describe('правильные многоугольники', () => {
  it('считает внутренний и центральный углы', () => {
    expect(regularPolygonInteriorAngle(3)).toBe(60);
    expect(regularPolygonInteriorAngle(4)).toBe(90);
    expect(regularPolygonInteriorAngle(6)).toBe(120);
    expect(regularPolygonInteriorAngle(8)).toBe(135);
    expect(regularPolygonCentralAngle(6)).toBe(60);
    expect(regularPolygonCentralAngle(10)).toBe(36);
  });

  it('связывает сторону с обоими радиусами', () => {
    expect(regularPolygonCircumradius(6, 6)).toBe(6);
    expect(regularPolygonInradius(4, 5)).toBe(2.5);
    expect(regularPolygonInradius(6, 6)).toBeCloseTo(3 * Math.sqrt(3), 9);
    expect(regularPolygonSideFromCircumradius(6, 5)).toBe(5);
    expect(regularPolygonSideFromInradius(4, 3)).toBe(6);
  });

  it('считает площадь как половину произведения периметра на апофему', () => {
    expect(regularPolygonArea(4, 5)).toBe(25);
    expect(regularPolygonArea(3, 2)).toBeCloseTo(Math.sqrt(3), 9);
    expect(regularPolygonArea(6, 6)).toBeCloseTo(54 * Math.sqrt(3), 8);
  });

  it('собирает все размеры в один согласованный набор', () => {
    const metrics = regularPolygonMetrics(6, 4);
    expect(metrics.perimeter).toBe(24);
    expect(metrics.circumradius).toBe(4);
    expect(metrics.area).toBeCloseTo(0.5 * metrics.perimeter * metrics.inradius, 9);
    expect(metrics.inradius).toBeLessThan(metrics.circumradius);
  });

  it('раскладывает вершины по описанной окружности', () => {
    const square = regularPolygonVertices(4, 1);
    expect(square).toHaveLength(4);
    expect(square[0]).toEqual({ x: 0, y: 1 });
    for (const point of square) {
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(1, 9);
    }
  });

  it('требует не меньше трёх вершин', () => {
    expect(() => regularPolygonInteriorAngle(2)).toThrow('не меньше трёх вершин');
    expect(() => regularPolygonMetrics(6.5, 4)).toThrow('не меньше трёх вершин');
    expect(() => regularPolygonCircumradius(6, 0)).toThrow('положительное конечное число');
  });
});

describe('окружность, дуга и сектор', () => {
  it('хранит ответ в виде коэффициента при π', () => {
    expect(circumferencePiCoefficient(5)).toBe(10);
    expect(circleAreaPiCoefficient(5)).toBe(25);
    expect(arcLengthPiCoefficient(6, 60)).toBe(2);
    expect(sectorAreaPiCoefficient(6, 60)).toBe(6);
    expect(sectorAreaPiCoefficient(4, 90)).toBe(4);
  });

  it('переводит коэффициент в число', () => {
    expect(circumference(5)).toBeCloseTo(10 * Math.PI, 8);
    expect(circleArea(5)).toBeCloseTo(25 * Math.PI, 8);
    expect(arcLength(6, 60)).toBeCloseTo(2 * Math.PI, 8);
    expect(sectorArea(6, 60)).toBeCloseTo(6 * Math.PI, 8);
  });

  it('считает сегмент как сектор без треугольника', () => {
    expect(segmentArea(6, 90)).toBeCloseTo(9 * Math.PI - 18, 8);
    expect(segmentArea(2, 180)).toBeCloseTo(2 * Math.PI, 8);
  });

  it('проверяет границы дуги', () => {
    expect(() => arcLength(6, 400)).toThrow('от 0° до 360°');
    expect(() => sectorArea(6, -10)).toThrow('от 0° до 360°');
    expect(() => segmentArea(6, 360)).toThrow('строго между 0° и 360°');
  });
});
