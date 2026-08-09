import { describe, expect, it } from 'vitest';
import {
  acuteAngleFromLegs,
  angleBetweenTangents,
  areaFactor,
  centralAngleFromChord,
  centralAngleFromInscribed,
  chordIntersectionSegment,
  chordLength,
  cosineDegrees,
  fitPointsToBox,
  fourthProportional,
  hypotenuseLength,
  inscribedAngleFromCentral,
  isPythagoreanTriple,
  isRightTriangle,
  legLength,
  legsFromHypotenuseAndAngle,
  lineCirclePosition,
  perimeterFactor,
  pointOnCircle,
  projectPoint,
  pythagoreanIdentityResidual,
  rightTriangleFromLegs,
  scaleTriangle,
  similarityFactor,
  sineDegrees,
  specialAngleRatios,
  squaresOnSides,
  tangentDegrees,
  tangentPointsFromExternal,
  tangentSegmentLength,
  thalesRatio,
  thalesSegment,
  triangleAreaByHeight,
  triangleAreaBySides,
  triangleInequalityHolds,
  trianglesAreSimilar,
} from '../src/lib/similarity';

describe('пропорциональные отрезки и теорема Фалеса', () => {
  it('находит четвёртый пропорциональный отрезок точно', () => {
    expect(fourthProportional(3, 5, 6)).toBe(10);
    expect(fourthProportional(4, 6, 10)).toBe(15);
    expect(fourthProportional(2, 3, 5)).toBe(7.5);
  });

  it('не теряет точность на десятичных данных', () => {
    // 0,3 : 0,7 = 1,2 : x, поэтому x = 0,7·1,2 / 0,3 = 2,8.
    expect(fourthProportional(0.3, 0.7, 1.2)).toBe(2.8);
  });

  it('делит вторую сторону в том же отношении, что и первую', () => {
    expect(thalesSegment(4, 6, 6)).toBe(9);
    expect(thalesSegment(5, 5, 8)).toBe(8);
    expect(thalesSegment(2.5, 7.5, 3)).toBe(9);
  });

  it('считает коэффициент отсечённого треугольника как AM : AB', () => {
    expect(thalesRatio(4, 6)).toBe(0.4);
    expect(thalesRatio(3, 3)).toBe(0.5);
    expect(thalesRatio(1, 3)).toBe(0.25);
  });

  it('отвергает неположительные отрезки', () => {
    expect(() => fourthProportional(0, 5, 6)).toThrow('положительное конечное число');
    expect(() => thalesSegment(4, -1, 6)).toThrow('положительное конечное число');
    expect(() => thalesRatio(4, Number.NaN)).toThrow('положительное конечное число');
  });
});

describe('подобие треугольников', () => {
  it('проверяет неравенство треугольника', () => {
    expect(triangleInequalityHolds(3, 4, 5)).toBe(true);
    expect(triangleInequalityHolds(1, 2, 3)).toBe(false);
    expect(triangleInequalityHolds(1, 2, 4)).toBe(false);
  });

  it('находит коэффициент подобия при верном соответствии сторон', () => {
    expect(similarityFactor({ a: 3, b: 4, c: 5 }, { a: 6, b: 8, c: 10 })).toBe(2);
    expect(similarityFactor({ a: 6, b: 8, c: 10 }, { a: 3, b: 4, c: 5 })).toBe(0.5);
    expect(similarityFactor({ a: 4, b: 6, c: 8 }, { a: 6, b: 9, c: 12 })).toBe(1.5);
  });

  it('возвращает null, если хотя бы одно отношение отличается', () => {
    expect(similarityFactor({ a: 3, b: 4, c: 5 }, { a: 6, b: 8, c: 11 })).toBeNull();
    expect(trianglesAreSimilar({ a: 3, b: 4, c: 5 }, { a: 6, b: 8, c: 10 })).toBe(true);
    expect(trianglesAreSimilar({ a: 3, b: 4, c: 5 }, { a: 4, b: 5, c: 6 })).toBe(false);
  });

  it('растягивает треугольник без накопления ошибки', () => {
    expect(scaleTriangle({ a: 3, b: 4, c: 5 }, 1.2)).toEqual({ a: 3.6, b: 4.8, c: 6 });
    expect(similarityFactor({ a: 3, b: 4, c: 5 }, scaleTriangle({ a: 3, b: 4, c: 5 }, 2.5))).toBe(2.5);
  });

  it('возводит коэффициент в квадрат для площадей и оставляет его для периметра', () => {
    expect(areaFactor(2)).toBe(4);
    expect(areaFactor(1.5)).toBe(2.25);
    expect(areaFactor(0.1)).toBe(0.01);
    expect(perimeterFactor(1.5)).toBe(1.5);
  });

  it('считает площадь по Герону и по высоте', () => {
    expect(triangleAreaBySides(3, 4, 5)).toBe(6);
    expect(triangleAreaBySides(6, 8, 10)).toBe(24);
    expect(triangleAreaByHeight(6, 4)).toBe(12);
    expect(triangleAreaByHeight(2.5, 4)).toBe(5);
  });

  it('подтверждает отношение площадей на настоящих треугольниках', () => {
    const small = { a: 3, b: 4, c: 5 } as const;
    const big = scaleTriangle(small, 3);
    const smallArea = triangleAreaBySides(small.a, small.b, small.c);
    const bigArea = triangleAreaBySides(big.a, big.b, big.c);
    expect(bigArea / smallArea).toBeCloseTo(areaFactor(3), 9);
  });

  it('отвергает невозможные данные', () => {
    expect(() => triangleAreaBySides(1, 2, 3)).toThrow('не существует');
    expect(() => scaleTriangle({ a: 3, b: 4, c: 5 }, 0)).toThrow('положительное конечное число');
    expect(() => similarityFactor({ a: 3, b: 4, c: 0 }, { a: 6, b: 8, c: 10 })).toThrow('положительное конечное число');
  });
});

describe('теорема Пифагора', () => {
  it('находит гипотенузу и катет', () => {
    expect(hypotenuseLength(3, 4)).toBe(5);
    expect(hypotenuseLength(5, 12)).toBe(13);
    expect(legLength(13, 5)).toBe(12);
    expect(legLength(10, 6)).toBe(8);
  });

  it('даёт иррациональную гипотенузу с честным приближением', () => {
    expect(hypotenuseLength(1, 1)).toBeCloseTo(Math.SQRT2, 9);
    expect(hypotenuseLength(2, 3)).toBeCloseTo(Math.sqrt(13), 9);
  });

  it('считает площади трёх квадратов и их баланс', () => {
    expect(squaresOnSides(3, 4)).toEqual({ legA: 9, legB: 16, hypotenuse: 25 });
    expect(squaresOnSides(1.5, 2)).toEqual({ legA: 2.25, legB: 4, hypotenuse: 6.25 });
    const squares = squaresOnSides(6, 8);
    expect(squares.legA + squares.legB).toBe(squares.hypotenuse);
  });

  it('проверяет обратную теорему точно', () => {
    expect(isRightTriangle(3, 4, 5)).toBe(true);
    expect(isRightTriangle(5, 4, 3)).toBe(true);
    expect(isRightTriangle(8, 15, 17)).toBe(true);
    expect(isRightTriangle(4, 5, 6)).toBe(false);
    expect(isRightTriangle(3, 4, 5.0001)).toBe(false);
    expect(isRightTriangle(1, 2, 3)).toBe(false);
  });

  it('отличает пифагорову тройку от просто прямоугольного треугольника', () => {
    expect(isPythagoreanTriple(6, 8, 10)).toBe(true);
    expect(isPythagoreanTriple(1.5, 2, 2.5)).toBe(false);
    expect(isRightTriangle(1.5, 2, 2.5)).toBe(true);
  });

  it('отвергает катет, который не короче гипотенузы', () => {
    expect(() => legLength(5, 5)).toThrow('короче гипотенузы');
    expect(() => legLength(5, 7)).toThrow('короче гипотенузы');
  });
});

describe('синус, косинус и тангенс острого угла', () => {
  it('собирает прямоугольный треугольник по двум катетам', () => {
    const triangle = rightTriangleFromLegs(3, 4);
    expect(triangle.hypotenuse).toBe(5);
    expect(triangle.sine).toBe(0.6);
    expect(triangle.cosine).toBe(0.8);
    expect(triangle.tangent).toBe(0.75);
    expect(triangle.angleDegrees).toBeCloseTo(36.8699, 4);
  });

  it('даёт ровно 45° для равных катетов и 60° для 1 и √3', () => {
    expect(acuteAngleFromLegs(5, 5)).toBe(45);
    expect(acuteAngleFromLegs(Math.sqrt(3), 1)).toBeCloseTo(60, 6);
  });

  it('восстанавливает катеты по гипотенузе и углу', () => {
    const legs = legsFromHypotenuseAndAngle(10, 30);
    expect(legs.opposite).toBeCloseTo(5, 9);
    expect(legs.adjacent).toBeCloseTo(5 * Math.sqrt(3), 9);
    const back = rightTriangleFromLegs(legs.opposite, legs.adjacent);
    expect(back.hypotenuse).toBeCloseTo(10, 9);
    expect(back.angleDegrees).toBeCloseTo(30, 6);
  });

  it('знает табличные значения', () => {
    expect(sineDegrees(30)).toBe(0.5);
    expect(cosineDegrees(60)).toBe(0.5);
    expect(tangentDegrees(45)).toBe(1);
    expect(sineDegrees(45)).toBeCloseTo(Math.SQRT2 / 2, 9);
    expect(specialAngleRatios(60)).toEqual({ sine: '√3/2', cosine: '1/2', tangent: '√3' });
    expect(specialAngleRatios(50)).toBeNull();
  });

  it('подтверждает основное тождество для разных углов', () => {
    for (const angle of [7, 30, 45, 60, 83]) {
      expect(pythagoreanIdentityResidual(angle)).toBe(0);
    }
  });

  it('отвергает неострые углы', () => {
    expect(() => sineDegrees(90)).toThrow('острый угол');
    expect(() => cosineDegrees(0)).toThrow('острый угол');
    expect(() => legsFromHypotenuseAndAngle(10, 120)).toThrow('острый угол');
  });
});

describe('окружность, касательные и хорды', () => {
  it('определяет взаимное расположение прямой и окружности', () => {
    expect(lineCirclePosition(5, 3)).toBe('secant');
    expect(lineCirclePosition(5, 5)).toBe('tangent');
    expect(lineCirclePosition(5, 7.5)).toBe('external');
    expect(lineCirclePosition(2.5, 2.5)).toBe('tangent');
  });

  it('находит длину отрезка касательной и угол между касательными', () => {
    expect(tangentSegmentLength(6, 10)).toBe(8);
    expect(tangentSegmentLength(5, 13)).toBe(12);
    expect(angleBetweenTangents(5, 10)).toBeCloseTo(60, 6);
    expect(() => tangentSegmentLength(5, 5)).toThrow('вне окружности');
  });

  it('связывает хорду и центральный угол в обе стороны', () => {
    expect(chordLength(5, 60)).toBeCloseTo(5, 9);
    expect(chordLength(5, 180)).toBeCloseTo(10, 9);
    expect(centralAngleFromChord(5, 5)).toBeCloseTo(60, 6);
    expect(centralAngleFromChord(6, 6 * Math.SQRT2)).toBeCloseTo(90, 6);
    expect(() => centralAngleFromChord(5, 11)).toThrow('длиннее диаметра');
  });

  it('делит центральный угол пополам и умножает вписанный на два', () => {
    expect(inscribedAngleFromCentral(80)).toBe(40);
    expect(inscribedAngleFromCentral(180)).toBe(90);
    expect(inscribedAngleFromCentral(75)).toBe(37.5);
    expect(centralAngleFromInscribed(37.5)).toBe(75);
    expect(centralAngleFromInscribed(inscribedAngleFromCentral(214))).toBe(214);
  });

  it('отвергает невозможные дуги и углы', () => {
    expect(() => inscribedAngleFromCentral(360)).toThrow('между 0° и 360°');
    expect(() => centralAngleFromInscribed(180)).toThrow('между 0° и 180°');
  });

  it('решает задачу о пересекающихся хордах', () => {
    expect(chordIntersectionSegment(4, 6, 3)).toBe(8);
    expect(chordIntersectionSegment(2.5, 4, 5)).toBe(2);
  });

  it('ставит точки на окружности и находит точки касания', () => {
    expect(pointOnCircle(5, 0)).toEqual({ x: 5, y: 0 });
    expect(pointOnCircle(5, 90)).toEqual({ x: 0, y: 5 });
    const [first, second] = tangentPointsFromExternal(6, { x: 10, y: 0 });
    expect(Math.hypot(first.x, first.y)).toBeCloseTo(6, 9);
    expect(Math.hypot(first.x - 10, first.y)).toBeCloseTo(8, 9);
    expect(second.y).toBeCloseTo(-first.y, 9);
    // Радиус в точку касания перпендикулярен касательной.
    const dot = first.x * (10 - first.x) + first.y * (0 - first.y);
    expect(dot).toBeCloseTo(0, 9);
    expect(() => tangentPointsFromExternal(6, { x: 3, y: 0 })).toThrow('вне окружности');
  });
});

describe('масштаб чертежа', () => {
  it('вписывает точки в область с одинаковым масштабом по осям', () => {
    const points = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 2 }];
    const fit = fitPointsToBox(points, 200, 100, 10);
    const [a, b, c] = points.map((point) => projectPoint(point, fit));
    expect(Math.hypot(b!.x - a!.x, b!.y - a!.y) / Math.hypot(c!.x - a!.x, c!.y - a!.y)).toBeCloseTo(2, 6);
    expect(a!.y).toBeGreaterThan(c!.y);
  });

  it('не выходит за пределы области', () => {
    const points = [{ x: -3, y: -1 }, { x: 5, y: 7 }];
    const fit = fitPointsToBox(points, 400, 300, 20);
    for (const point of points) {
      const screen = projectPoint(point, fit);
      expect(screen.x).toBeGreaterThanOrEqual(20 - 1e-6);
      expect(screen.x).toBeLessThanOrEqual(380 + 1e-6);
      expect(screen.y).toBeGreaterThanOrEqual(20 - 1e-6);
      expect(screen.y).toBeLessThanOrEqual(280 + 1e-6);
    }
  });

  it('отвергает пустой список точек и слишком большой отступ', () => {
    expect(() => fitPointsToBox([], 100, 100, 5)).toThrow('хотя бы одна точка');
    expect(() => fitPointsToBox([{ x: 0, y: 0 }], 100, 100, 60)).toThrow('всю область');
  });
});
