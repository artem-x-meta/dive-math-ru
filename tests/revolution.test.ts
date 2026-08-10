import { describe, expect, it } from 'vitest';
import { formatExactRussian, toExactNumber } from '../src/lib/exactRational';
import {
  archimedesTriple,
  cavalieriBalance,
  cavalieriLevel,
  coneMetrics,
  coneOutlineAngleDegrees,
  coneOutlinePoints,
  cylinderInscribedInSphere,
  cylinderMetrics,
  exactSquareRoot,
  formatExactPi,
  formatMeasure,
  levelEllipse,
  profileExtent,
  revolutionProfile,
  revolvePoint,
  revolveProfile,
  similarityFactors,
  solidMetrics,
  sphereInscribedInCone,
  sphereInscribedInCylinder,
  sphereMetrics,
  sphereSection,
  squareRootMeasure,
  type Measure,
} from '../src/lib/revolution';

/** Точная запись величины: «45π», «(32/3)π», «12» — или ошибка теста, если точной формы нет. */
function exactText(measure: Measure): string {
  if (measure.exact === null) throw new Error('Ожидалась точная форма');
  return formatExactPi(measure.exact);
}

describe('точные значения с π', () => {
  it('записывает коэффициент, дробь и особые случаи', () => {
    expect(formatExactPi({ coefficient: { numerator: 45n, denominator: 1n }, piPower: 1 })).toBe('45π');
    expect(formatExactPi({ coefficient: { numerator: 32n, denominator: 3n }, piPower: 1 })).toBe('(32/3)π');
    expect(formatExactPi({ coefficient: { numerator: 1n, denominator: 1n }, piPower: 1 })).toBe('π');
    expect(formatExactPi({ coefficient: { numerator: 0n, denominator: 1n }, piPower: 1 })).toBe('0');
    expect(formatExactPi({ coefficient: { numerator: 24n, denominator: 1n }, piPower: 0 })).toBe('24');
  });

  it('извлекает точный корень только из полных квадратов', () => {
    expect(exactSquareRoot(49)).toEqual({ numerator: 7n, denominator: 1n });
    expect(formatExactRussian(exactSquareRoot('49/4')!)).toBe('3,5');
    expect(exactSquareRoot(2)).toBeNull();
    expect(exactSquareRoot(0.25)).toEqual({ numerator: 1n, denominator: 2n });
    expect(() => exactSquareRoot(-1)).toThrow('отрицательного');
  });

  it('возвращает приближение, когда точной формы нет', () => {
    const root = squareRootMeasure(2);
    expect(root.exact).toBeNull();
    expect(root.value).toBeCloseTo(Math.SQRT2, 12);
    expect(formatMeasure(root)).toBe('≈ 1,41');
    expect(formatMeasure(squareRootMeasure(9))).toBe('3');
  });
});

describe('цилиндр', () => {
  it('считает площади и объём в точной форме', () => {
    const cylinder = cylinderMetrics(3, 5);
    expect(exactText(cylinder.baseArea)).toBe('9π');
    expect(exactText(cylinder.lateralArea)).toBe('30π');
    expect(exactText(cylinder.totalArea)).toBe('48π');
    expect(exactText(cylinder.volume)).toBe('45π');
    expect(cylinder.volume.value).toBeCloseTo(45 * Math.PI, 10);
  });

  it('складывает полную поверхность из двух оснований и боковой', () => {
    const cylinder = cylinderMetrics('1/2', 7);
    expect(cylinder.totalArea.value).toBeCloseTo(2 * cylinder.baseArea.value + cylinder.lateralArea.value, 12);
  });

  it('описывает осевое сечение и узнаёт квадрат', () => {
    const oblong = cylinderMetrics(3, 5);
    expect(oblong.axialSection.width).toBe(6);
    expect(oblong.axialSection.height).toBe(5);
    expect(exactText(oblong.axialSection.area)).toBe('30');
    expect(oblong.axialSection.special).toBe(false);

    const square = cylinderMetrics(2, 4);
    expect(square.axialSection.special).toBe(true);
    expect(exactText(square.axialSection.area)).toBe('16');
  });

  it('даёт развёртку: прямоугольник 2πr на h и два круга', () => {
    const net = cylinderMetrics(3, 5).net;
    expect(exactText(net.rectangleWidth)).toBe('6π');
    expect(net.rectangleHeight).toBe(5);
    expect(exactText(net.rectangleArea)).toBe('30π');
    expect(exactText(net.circleArea)).toBe('9π');
  });

  it('отвергает неположительные размеры', () => {
    expect(() => cylinderMetrics(0, 5)).toThrow('положительным');
    expect(() => cylinderMetrics(3, -1)).toThrow('положительным');
  });
});

describe('конус', () => {
  it('находит образующую и точные площади для пифагоровых размеров', () => {
    const cone = coneMetrics(3, 4);
    expect(exactText(cone.slant)).toBe('5');
    expect(exactText(cone.baseArea)).toBe('9π');
    expect(exactText(cone.lateralArea)).toBe('15π');
    expect(exactText(cone.totalArea)).toBe('24π');
    expect(exactText(cone.volume)).toBe('12π');
  });

  it('оставляет приближение, когда образующая иррациональна', () => {
    const cone = coneMetrics(1, 1);
    expect(cone.slant.exact).toBeNull();
    expect(cone.slant.value).toBeCloseTo(Math.SQRT2, 12);
    expect(cone.lateralArea.exact).toBeNull();
    expect(cone.lateralArea.value).toBeCloseTo(Math.PI * Math.SQRT2, 12);
    // Объём остаётся точным: в нём образующая не участвует.
    expect(exactText(cone.volume)).toBe('(1/3)π');
  });

  it('составляет треть объёма цилиндра с тем же основанием и высотой', () => {
    const cone = coneMetrics(3, 4);
    const cylinder = cylinderMetrics(3, 4);
    expect(cone.volume.value * 3).toBeCloseTo(cylinder.volume.value, 10);
  });

  it('вычисляет угол сектора развёртки как 360°·r/l', () => {
    const net = coneMetrics(3, 4).net;
    expect(exactText(net.sectorAngleDegrees)).toBe('216');
    expect(exactText(net.sectorRadius)).toBe('5');
    expect(exactText(net.arcLength)).toBe('6π');
    expect(exactText(net.sectorArea)).toBe('15π');
    // Длина дуги сектора равна длине окружности основания.
    expect(net.arcLength.value).toBeCloseTo((net.sectorAngleDegrees.value / 360) * 2 * Math.PI * 5, 10);
    // Полуокружность в развёртке отвечает конусу с l = 2r.
    expect(coneMetrics(3, 3.5).net.sectorAngleDegrees.value).toBeGreaterThan(180);
  });

  it('описывает осевое сечение и его углы', () => {
    const cone = coneMetrics(3, 4);
    expect(cone.axialSection.width).toBe(6);
    expect(cone.axialSection.height).toBe(4);
    expect(exactText(cone.axialSection.area)).toBe('12');
    expect(cone.axialSection.apexAngleDegrees).toBeCloseTo(2 * (180 / Math.PI) * Math.atan(3 / 4), 10);
    expect(cone.axialSection.baseAngleDegrees).toBeCloseTo((180 / Math.PI) * Math.atan(4 / 3), 10);
    expect(cone.axialSection.special).toBe(false);
  });

  it('узнаёт равносторонний конус при l = 2r', () => {
    const cone = coneMetrics(1, Math.sqrt(3));
    expect(cone.axialSection.special).toBe(true);
    expect(cone.axialSection.apexAngleDegrees).toBeCloseTo(60, 8);
    expect(cone.net.sectorAngleDegrees.value).toBeCloseTo(180, 8);
  });
});

describe('шар и сфера', () => {
  it('считает площадь сферы и объём шара точно', () => {
    const sphere = sphereMetrics(3);
    expect(exactText(sphere.surfaceArea)).toBe('36π');
    expect(exactText(sphere.volume)).toBe('36π');
    expect(exactText(sphereMetrics(2).volume)).toBe('(32/3)π');
    expect(exactText(sphereMetrics(2).surfaceArea)).toBe('16π');
    expect(exactText(sphereMetrics(5).greatCircleLength)).toBe('10π');
    expect(exactText(sphereMetrics(5).greatCircleArea)).toBe('25π');
  });

  it('связывает площадь сферы с четырьмя большими кругами', () => {
    const sphere = sphereMetrics(7);
    expect(sphere.surfaceArea.value).toBeCloseTo(4 * sphere.greatCircleArea.value, 10);
  });

  it('находит сечение шара плоскостью', () => {
    const section = sphereSection(5, 3);
    expect(section.intersects).toBe(true);
    expect(section.tangent).toBe(false);
    expect(exactText(section.sectionRadius)).toBe('4');
    expect(exactText(section.sectionArea)).toBe('16π');
    expect(exactText(section.sectionLength)).toBe('8π');
  });

  it('оставляет площадь сечения точной даже при иррациональном радиусе', () => {
    const section = sphereSection(5, 1);
    expect(section.sectionRadius.exact).toBeNull();
    expect(section.sectionRadius.value).toBeCloseTo(Math.sqrt(24), 12);
    expect(exactText(section.sectionArea)).toBe('24π');
  });

  it('различает касание и отсутствие пересечения', () => {
    const tangent = sphereSection(5, 5);
    expect(tangent.tangent).toBe(true);
    expect(tangent.intersects).toBe(false);
    expect(tangent.sectionRadius.value).toBe(0);

    const missed = sphereSection(5, 6);
    expect(missed.intersects).toBe(false);
    expect(missed.tangent).toBe(false);
    expect(missed.sectionArea.value).toBe(0);
  });

  it('даёт наибольшее сечение при плоскости через центр', () => {
    const sphere = sphereMetrics(5);
    expect(sphereSection(5, 0).sectionArea.value).toBeCloseTo(sphere.greatCircleArea.value, 10);
  });
});

describe('принцип Кавальери', () => {
  it('уравнивает сечения полушара и цилиндра без конуса на каждом уровне', () => {
    for (const level of [0, 1, '3/2', 2, 3]) {
      const slice = cavalieriLevel(3, level);
      expect(slice.equal).toBe(true);
      expect(slice.hemisphereArea.value).toBeCloseTo(slice.ringArea.value, 12);
      expect(slice.ringArea.value).toBeCloseTo(slice.cylinderArea.value - slice.coneArea.value, 12);
    }
  });

  it('на среднем уровне даёт согласованные радиусы', () => {
    const slice = cavalieriLevel(5, 3);
    expect(exactText(slice.hemisphereArea)).toBe('16π');
    expect(exactText(slice.hemisphereRadius)).toBe('4');
    expect(toExactNumber(slice.coneRadius)).toBe(3);
    expect(exactText(slice.cylinderArea)).toBe('25π');
    expect(exactText(slice.coneArea)).toBe('9π');
  });

  it('запрещает уровень выше радиуса', () => {
    expect(() => cavalieriLevel(3, 4)).toThrow('не должен превышать радиус');
    expect(() => cavalieriLevel(3, -1)).toThrow('не может быть отрицательным');
  });

  it('выводит объём шара из баланса цилиндр минус конус', () => {
    const balance = cavalieriBalance(3);
    expect(exactText(balance.cylinderVolume)).toBe('27π');
    expect(exactText(balance.coneVolume)).toBe('9π');
    expect(exactText(balance.hemisphereVolume)).toBe('18π');
    expect(exactText(balance.sphereVolume)).toBe('36π');
    expect(balance.sphereVolume.value).toBeCloseTo(sphereMetrics(3).volume.value, 10);
  });
});

describe('комбинированные тела', () => {
  it('даёт отношение 2 : 3 для шара, вписанного в цилиндр', () => {
    for (const radius of [1, 4, '5/2']) {
      const pair = sphereInscribedInCylinder(radius);
      expect(formatExactRussian(pair.volumeRatio)).toBe('2/3');
      expect(formatExactRussian(pair.areaRatio)).toBe('2/3');
      expect(toExactNumber(pair.cylinder.height)).toBeCloseTo(2 * toExactNumber(pair.sphere.radius), 12);
    }
  });

  it('считает цилиндр, вписанный в шар', () => {
    const inscribed = cylinderInscribedInSphere(5, 3);
    expect(exactText(inscribed.height)).toBe('8');
    expect(exactText(inscribed.volume)).toBe('72π');
    expect(exactText(inscribed.lateralArea)).toBe('48π');
    expect(() => cylinderInscribedInSphere(5, 5)).toThrow('меньше радиуса шара');
  });

  it('находит шар, вписанный в конус, через осевое сечение', () => {
    const inscribed = sphereInscribedInCone(3, 4);
    expect(exactText(inscribed.slant)).toBe('5');
    expect(exactText(inscribed.sphereRadius)).toBe('1,5');
    expect(exactText(inscribed.sphereVolume)).toBe('4,5π');
    // Радиус вписанного шара — это r = S/p для треугольника с основанием 2r и сторонами l.
    expect(inscribed.sphereRadius.value).toBeCloseTo((3 * 4) / (3 + 5), 12);
  });

  it('даёт отношение объёмов 1 : 2 : 3 для конуса, шара и цилиндра', () => {
    const triple = archimedesTriple(2);
    expect(triple.ratio).toEqual([1, 2, 3]);
    expect(exactText(triple.cone)).toBe('(16/3)π');
    expect(exactText(triple.sphere)).toBe('(32/3)π');
    expect(exactText(triple.cylinder)).toBe('16π');
    expect(archimedesTriple('7/3').ratio).toEqual([1, 2, 3]);
  });

  it('возводит коэффициент подобия в квадрат и в куб', () => {
    expect(formatExactRussian(similarityFactors(3).area)).toBe('9');
    expect(formatExactRussian(similarityFactors(3).volume)).toBe('27');
    expect(formatExactRussian(similarityFactors('1/2').volume)).toBe('0,125');
    expect(formatExactRussian(similarityFactors('1/3').volume)).toBe('1/27');
  });

  it('выбирает тело по названию', () => {
    expect(solidMetrics('cylinder', 3, 5).kind).toBe('cylinder');
    expect(solidMetrics('cone', 3, 4).kind).toBe('cone');
    expect(solidMetrics('sphere', 3, 4).kind).toBe('sphere');
    // @ts-expect-error проверяем защиту от неизвестного тела
    expect(() => solidMetrics('torus', 3, 4)).toThrow('Неизвестное тело');
  });
});

describe('честная проекция тела вращения', () => {
  it('переводит окружность уровня в эллипс со сжатием sin ε', () => {
    const ellipse = levelEllipse(4, 0, 30);
    expect(ellipse.rx).toBe(4);
    expect(ellipse.ry).toBeCloseTo(2, 12);
    expect(ellipse.cy).toBe(0);
    // Сжатие не зависит от радиуса.
    expect(levelEllipse(9, 0, 30).ry / 9).toBeCloseTo(levelEllipse(4, 0, 30).ry / 4, 12);
    // Центр поднимается на z·cos ε.
    expect(levelEllipse(4, 6, 30).cy).toBeCloseTo(6 * Math.cos(Math.PI / 6), 12);
  });

  it('согласует поворот образующей с эллипсом уровня', () => {
    const ellipse = levelEllipse(4, 0, 30);
    const right = revolvePoint({ r: 4, z: 0 }, 90, 30);
    const front = revolvePoint({ r: 4, z: 0 }, 0, 30);
    const back = revolvePoint({ r: 4, z: 0 }, 180, 30);
    expect(right.x).toBeCloseTo(ellipse.cx + ellipse.rx, 12);
    expect(right.y).toBeCloseTo(ellipse.cy, 12);
    expect(front.y).toBeCloseTo(ellipse.cy - ellipse.ry, 12);
    expect(back.y).toBeCloseTo(ellipse.cy + ellipse.ry, 12);
    expect(front.x).toBeCloseTo(0, 12);
  });

  it('оставляет точки оси на месте при любом повороте', () => {
    for (const angle of [0, 37, 90, 180, 355]) {
      const point = revolvePoint({ r: 0, z: 5 }, angle, 25);
      expect(point.x).toBeCloseTo(0, 12);
      expect(point.y).toBeCloseTo(5 * Math.cos((25 * Math.PI) / 180), 12);
    }
  });

  it('строит образующие фигуры честно', () => {
    expect(revolutionProfile('cylinder', 3, 4)).toEqual([
      { r: 0, z: 0 }, { r: 3, z: 0 }, { r: 3, z: 4 }, { r: 0, z: 4 },
    ]);
    expect(revolutionProfile('cone', 3, 4)).toEqual([
      { r: 0, z: 0 }, { r: 3, z: 0 }, { r: 0, z: 4 },
    ]);

    const semicircle = revolutionProfile('sphere', 5, 5, 8);
    expect(semicircle).toHaveLength(9);
    expect(semicircle[0]).toEqual({ r: 0, z: 5 });
    for (const point of semicircle) {
      expect(Math.hypot(point.r, point.z)).toBeCloseTo(5, 12);
      expect(point.r).toBeGreaterThanOrEqual(0);
    }
    const extent = profileExtent(semicircle);
    expect(extent.maxZ).toBeCloseTo(5, 12);
    expect(extent.minZ).toBeCloseTo(-5, 12);
    expect(extent.maxR).toBeCloseTo(5, 12);
  });

  it('поворачивает всю образующую целиком', () => {
    const profile = revolutionProfile('cone', 3, 4);
    const screen = revolveProfile(profile, 90, 30);
    expect(screen).toHaveLength(3);
    expect(screen[1]!.x).toBeCloseTo(3, 12);
    expect(screen[2]!.y).toBeCloseTo(4 * Math.cos(Math.PI / 6), 12);
  });

  it('находит угол касания очерка конуса и проверяет его максимальность', () => {
    const radius = 1;
    const height = 2;
    const elevation = 30;
    const angle = coneOutlineAngleDegrees(radius, height, elevation)!;
    expect(angle).toBeCloseTo((180 / Math.PI) * Math.asin(0.5 / (2 * Math.cos(Math.PI / 6))), 10);

    // Очерковая точка — та, из которой луч от вершины отклоняется сильнее всего.
    const apexY = height * Math.cos((elevation * Math.PI) / 180);
    const slope = (phi: number) => {
      const point = revolvePoint({ r: radius, z: 0 }, phi, elevation);
      return point.x / (apexY - point.y);
    };
    let best = 0;
    let bestPhi = 0;
    for (let phi = 0; phi <= 180; phi += 0.01) {
      const value = slope(phi);
      if (value > best) { best = value; bestPhi = phi; }
    }
    expect(bestPhi).toBeCloseTo(90 + angle, 1);

    const points = coneOutlinePoints(radius, height, elevation);
    expect(points).toHaveLength(2);
    expect(points[0]!.x).toBeCloseTo(-points[1]!.x, 12);
    expect(points[0]!.y).toBeCloseTo(points[1]!.y, 12);
    expect(slope(90 + angle)).toBeCloseTo(best, 6);
  });

  it('сообщает об отсутствии очерка при взгляде сверху', () => {
    expect(coneOutlineAngleDegrees(1, 1, 45)).toBeNull();
    expect(coneOutlinePoints(1, 1, 60)).toEqual([]);
    expect(() => levelEllipse(3, 0, 0)).toThrow('строго между');
    expect(() => revolvePoint({ r: -1, z: 0 }, 0, 30)).toThrow('отрицательным');
  });
});
