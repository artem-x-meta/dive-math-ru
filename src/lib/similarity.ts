import {
  addExact,
  compareExact,
  divideExact,
  multiplyExact,
  parseExact,
  subtractExact,
  toExactNumber,
} from './exactRational';
import type { PlanimetryPoint } from './planimetry';

/** Тройка сторон треугольника: a, b и c в фиксированном порядке. */
export interface TriangleSideTriple {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

/** Площади трёх квадратов, построенных на сторонах прямоугольного треугольника. */
export interface SquaresOnSides {
  /** Площадь квадрата на первом катете. */
  readonly legA: number;
  /** Площадь квадрата на втором катете. */
  readonly legB: number;
  /** Площадь квадрата на гипотенузе. */
  readonly hypotenuse: number;
}

/** Полный набор данных прямоугольного треугольника по двум катетам. */
export interface RightTriangleData {
  readonly opposite: number;
  readonly adjacent: number;
  readonly hypotenuse: number;
  readonly sine: number;
  readonly cosine: number;
  readonly tangent: number;
  /** Острый угол, лежащий против стороны opposite, в градусах. */
  readonly angleDegrees: number;
}

/** Точные значения синуса, косинуса и тангенса табличного угла — текстом. */
export interface SpecialAngleRatios {
  readonly sine: string;
  readonly cosine: string;
  readonly tangent: string;
}

/** Взаимное расположение прямой и окружности. */
export type LineCirclePosition = 'secant' | 'tangent' | 'external';

/** Пересчёт математических координат в координаты SVG с единым масштабом. */
export interface ViewportFit {
  readonly scale: number;
  readonly translateX: number;
  readonly translateY: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

const RADIANS_PER_DEGREE = Math.PI / 180;

function toRadians(degrees: number): number {
  return degrees * RADIANS_PER_DEGREE;
}

function toDegrees(radians: number): number {
  return radians / RADIANS_PER_DEGREE;
}

/** Убирает мусор последних разрядов, который мешает сравнивать и показывать числа. */
function roundValue(value: number, digits = 10): number {
  const factor = 10 ** digits;
  const result = Math.round(value * factor) / factor;
  return Object.is(result, -0) ? 0 : result;
}

function assertPositive(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label}: нужно положительное конечное число`);
  }
  return value;
}

function assertNonNegative(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label}: нужно неотрицательное конечное число`);
  }
  return value;
}

function assertAcuteDegrees(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= 90) {
    throw new RangeError(`${label}: нужен острый угол строго между 0° и 90°`);
  }
  return value;
}

function assertPoint(point: PlanimetryPoint, label: string): PlanimetryPoint {
  if (
    typeof point !== 'object' || point === null ||
    !Number.isFinite(point.x) || !Number.isFinite(point.y)
  ) {
    throw new TypeError(`${label} задаётся двумя конечными координатами`);
  }
  return point;
}

function assertSides(sides: TriangleSideTriple, label: string): TriangleSideTriple {
  if (typeof sides !== 'object' || sides === null) {
    throw new TypeError(`${label} задаётся тремя длинами`);
  }
  assertPositive(sides.a, `${label}, сторона a`);
  assertPositive(sides.b, `${label}, сторона b`);
  assertPositive(sides.c, `${label}, сторона c`);
  return sides;
}

/* ------------------------------------------------------------------ */
/* Пропорциональные отрезки и теорема Фалеса                           */
/* ------------------------------------------------------------------ */

/**
 * Четвёртый пропорциональный отрезок: решает a : b = c : x,
 * то есть x = b·c / a. Ответ точный для конечных десятичных данных.
 */
export function fourthProportional(a: number, b: number, c: number): number {
  assertPositive(a, 'Первый член пропорции');
  assertPositive(b, 'Второй член пропорции');
  assertPositive(c, 'Третий член пропорции');
  return toExactNumber(divideExact(multiplyExact(parseExact(b), parseExact(c)), parseExact(a)));
}

/**
 * Теорема о пропорциональных отрезках: прямая, параллельная стороне BC,
 * пересекает стороны AB и AC в точках M и N, причём AM : MB = AN : NC.
 * По AM, MB и AN находим NC.
 */
export function thalesSegment(am: number, mb: number, an: number): number {
  assertPositive(am, 'Отрезок AM');
  assertPositive(mb, 'Отрезок MB');
  assertPositive(an, 'Отрезок AN');
  return fourthProportional(am, mb, an);
}

/**
 * Отношение подобия отсечённого треугольника AMN к треугольнику ABC:
 * AM : AB. Именно во столько раз короче каждая сторона малого треугольника.
 */
export function thalesRatio(am: number, mb: number): number {
  assertPositive(am, 'Отрезок AM');
  assertPositive(mb, 'Отрезок MB');
  const exactAm = parseExact(am);
  return toExactNumber(divideExact(exactAm, addExact(exactAm, parseExact(mb))));
}

/* ------------------------------------------------------------------ */
/* Подобие треугольников                                               */
/* ------------------------------------------------------------------ */

/** Существует ли треугольник с такими сторонами: каждая меньше суммы двух других. */
export function triangleInequalityHolds(a: number, b: number, c: number): boolean {
  assertPositive(a, 'Сторона a');
  assertPositive(b, 'Сторона b');
  assertPositive(c, 'Сторона c');
  const [x, y, z] = [parseExact(a), parseExact(b), parseExact(c)];
  return compareExact(addExact(x, y), z) > 0
    && compareExact(addExact(y, z), x) > 0
    && compareExact(addExact(z, x), y) > 0;
}

/**
 * Коэффициент подобия второго треугольника к первому при данном соответствии
 * вершин. Возвращает k, если все три отношения совпали, и null, если нет.
 */
export function similarityFactor(first: TriangleSideTriple, second: TriangleSideTriple): number | null {
  assertSides(first, 'Первый треугольник');
  assertSides(second, 'Второй треугольник');
  const ratioA = divideExact(parseExact(second.a), parseExact(first.a));
  const ratioB = divideExact(parseExact(second.b), parseExact(first.b));
  const ratioC = divideExact(parseExact(second.c), parseExact(first.c));
  if (compareExact(ratioA, ratioB) !== 0 || compareExact(ratioB, ratioC) !== 0) return null;
  return toExactNumber(ratioA);
}

/** Подобны ли треугольники при данном порядке сторон. */
export function trianglesAreSimilar(first: TriangleSideTriple, second: TriangleSideTriple): boolean {
  return similarityFactor(first, second) !== null;
}

/** Растягивает треугольник в k раз: точное умножение каждой стороны. */
export function scaleTriangle(sides: TriangleSideTriple, factor: number): TriangleSideTriple {
  assertSides(sides, 'Треугольник');
  assertPositive(factor, 'Коэффициент подобия');
  const exactFactor = parseExact(factor);
  return {
    a: toExactNumber(multiplyExact(parseExact(sides.a), exactFactor)),
    b: toExactNumber(multiplyExact(parseExact(sides.b), exactFactor)),
    c: toExactNumber(multiplyExact(parseExact(sides.c), exactFactor)),
  };
}

/** Отношение площадей подобных фигур: квадрат коэффициента подобия. */
export function areaFactor(similarityRatio: number): number {
  assertPositive(similarityRatio, 'Коэффициент подобия');
  const exact = parseExact(similarityRatio);
  return toExactNumber(multiplyExact(exact, exact));
}

/** Периметр растёт как первая степень коэффициента — в отличие от площади. */
export function perimeterFactor(similarityRatio: number): number {
  return assertPositive(similarityRatio, 'Коэффициент подобия');
}

/** Площадь треугольника по трём сторонам (формула Герона). */
export function triangleAreaBySides(a: number, b: number, c: number): number {
  if (!triangleInequalityHolds(a, b, c)) {
    throw new RangeError('Треугольника с такими сторонами не существует');
  }
  const p = (a + b + c) / 2;
  return roundValue(Math.sqrt(p * (p - a) * (p - b) * (p - c)));
}

/** Площадь треугольника по основанию и проведённой к нему высоте. */
export function triangleAreaByHeight(base: number, height: number): number {
  assertPositive(base, 'Основание');
  assertPositive(height, 'Высота');
  return toExactNumber(divideExact(multiplyExact(parseExact(base), parseExact(height)), 2));
}

/* ------------------------------------------------------------------ */
/* Теорема Пифагора                                                    */
/* ------------------------------------------------------------------ */

/** Гипотенуза по двум катетам. */
export function hypotenuseLength(legA: number, legB: number): number {
  assertPositive(legA, 'Первый катет');
  assertPositive(legB, 'Второй катет');
  return roundValue(Math.hypot(legA, legB));
}

/** Второй катет по гипотенузе и первому катету. */
export function legLength(hypotenuse: number, leg: number): number {
  assertPositive(hypotenuse, 'Гипотенуза');
  assertPositive(leg, 'Катет');
  if (compareExact(parseExact(leg), parseExact(hypotenuse)) >= 0) {
    throw new RangeError('Катет должен быть короче гипотенузы');
  }
  const exact = subtractExact(
    multiplyExact(parseExact(hypotenuse), parseExact(hypotenuse)),
    multiplyExact(parseExact(leg), parseExact(leg)),
  );
  return roundValue(Math.sqrt(toExactNumber(exact)));
}

/** Площади квадратов, построенных на сторонах прямоугольного треугольника. */
export function squaresOnSides(legA: number, legB: number): SquaresOnSides {
  assertPositive(legA, 'Первый катет');
  assertPositive(legB, 'Второй катет');
  const squareA = multiplyExact(parseExact(legA), parseExact(legA));
  const squareB = multiplyExact(parseExact(legB), parseExact(legB));
  return {
    legA: toExactNumber(squareA),
    legB: toExactNumber(squareB),
    hypotenuse: toExactNumber(addExact(squareA, squareB)),
  };
}

/**
 * Обратная теорема Пифагора: прямоугольный ли треугольник с такими сторонами.
 * Сравнение точное, поэтому 3-4-5 проходит, а 3-4-5,0001 — нет.
 */
export function isRightTriangle(a: number, b: number, c: number): boolean {
  if (!triangleInequalityHolds(a, b, c)) return false;
  const squares = [a, b, c]
    .map((side) => multiplyExact(parseExact(side), parseExact(side)))
    .sort((left, right) => compareExact(left, right));
  return compareExact(addExact(squares[0]!, squares[1]!), squares[2]!) === 0;
}

/** Пифагорова тройка — прямоугольный треугольник с натуральными сторонами. */
export function isPythagoreanTriple(a: number, b: number, c: number): boolean {
  if (![a, b, c].every((side) => Number.isInteger(side) && side > 0)) return false;
  return isRightTriangle(a, b, c);
}

/* ------------------------------------------------------------------ */
/* Синус, косинус и тангенс острого угла                               */
/* ------------------------------------------------------------------ */

/**
 * Все шесть чисел прямоугольного треугольника по двум катетам.
 * opposite — катет, лежащий против искомого острого угла.
 */
export function rightTriangleFromLegs(opposite: number, adjacent: number): RightTriangleData {
  assertPositive(opposite, 'Противолежащий катет');
  assertPositive(adjacent, 'Прилежащий катет');
  const hypotenuse = hypotenuseLength(opposite, adjacent);
  return {
    opposite,
    adjacent,
    hypotenuse,
    sine: roundValue(opposite / hypotenuse),
    cosine: roundValue(adjacent / hypotenuse),
    tangent: roundValue(opposite / adjacent),
    angleDegrees: roundValue(toDegrees(Math.atan2(opposite, adjacent)), 8),
  };
}

/** Катеты по гипотенузе и острому углу: opposite = c·sin α, adjacent = c·cos α. */
export function legsFromHypotenuseAndAngle(
  hypotenuse: number,
  degrees: number,
): { readonly opposite: number; readonly adjacent: number } {
  assertPositive(hypotenuse, 'Гипотенуза');
  assertAcuteDegrees(degrees, 'Острый угол');
  const radians = toRadians(degrees);
  return {
    opposite: roundValue(hypotenuse * Math.sin(radians)),
    adjacent: roundValue(hypotenuse * Math.cos(radians)),
  };
}

/** Острый угол в градусах по противолежащему и прилежащему катетам. */
export function acuteAngleFromLegs(opposite: number, adjacent: number): number {
  return rightTriangleFromLegs(opposite, adjacent).angleDegrees;
}

/** Синус, косинус и тангенс острого угла в градусах. */
export function sineDegrees(degrees: number): number {
  assertAcuteDegrees(degrees, 'Острый угол');
  return roundValue(Math.sin(toRadians(degrees)));
}

export function cosineDegrees(degrees: number): number {
  assertAcuteDegrees(degrees, 'Острый угол');
  return roundValue(Math.cos(toRadians(degrees)));
}

export function tangentDegrees(degrees: number): number {
  assertAcuteDegrees(degrees, 'Острый угол');
  return roundValue(Math.tan(toRadians(degrees)));
}

const SPECIAL_ANGLES: Readonly<Record<number, SpecialAngleRatios>> = {
  30: { sine: '1/2', cosine: '√3/2', tangent: '√3/3' },
  45: { sine: '√2/2', cosine: '√2/2', tangent: '1' },
  60: { sine: '√3/2', cosine: '1/2', tangent: '√3' },
};

/** Точные значения для 30°, 45° и 60°; для остальных углов — null. */
export function specialAngleRatios(degrees: number): SpecialAngleRatios | null {
  return SPECIAL_ANGLES[degrees] ?? null;
}

/**
 * Основное тригонометрическое тождество: sin²α + cos²α = 1.
 * Проверяем численно, потому что синус и косинус — иррациональные числа.
 */
export function pythagoreanIdentityResidual(degrees: number): number {
  assertAcuteDegrees(degrees, 'Острый угол');
  const radians = toRadians(degrees);
  const sine = Math.sin(radians);
  const cosine = Math.cos(radians);
  return roundValue(sine * sine + cosine * cosine - 1, 12);
}

/* ------------------------------------------------------------------ */
/* Окружность: касательные, хорды, вписанные углы                      */
/* ------------------------------------------------------------------ */

/**
 * Взаимное расположение прямой и окружности по расстоянию от центра
 * до прямой: d < R — секущая, d = R — касательная, d > R — общих точек нет.
 */
export function lineCirclePosition(radius: number, distance: number): LineCirclePosition {
  assertPositive(radius, 'Радиус');
  assertNonNegative(distance, 'Расстояние от центра до прямой');
  const comparison = compareExact(parseExact(distance), parseExact(radius));
  if (comparison < 0) return 'secant';
  if (comparison === 0) return 'tangent';
  return 'external';
}

/**
 * Длина отрезка касательной от внешней точки до точки касания.
 * Радиус перпендикулярен касательной, поэтому работает теорема Пифагора.
 */
export function tangentSegmentLength(radius: number, distanceToCentre: number): number {
  assertPositive(radius, 'Радиус');
  assertPositive(distanceToCentre, 'Расстояние до центра');
  if (compareExact(parseExact(distanceToCentre), parseExact(radius)) <= 0) {
    throw new RangeError('Точка должна лежать вне окружности');
  }
  return legLength(distanceToCentre, radius);
}

/** Угол между двумя касательными, проведёнными из одной внешней точки. */
export function angleBetweenTangents(radius: number, distanceToCentre: number): number {
  tangentSegmentLength(radius, distanceToCentre);
  return roundValue(2 * toDegrees(Math.asin(radius / distanceToCentre)), 8);
}

/** Длина хорды, стягивающей центральный угол α: 2R·sin(α/2). */
export function chordLength(radius: number, centralDegrees: number): number {
  assertPositive(radius, 'Радиус');
  if (!Number.isFinite(centralDegrees) || centralDegrees <= 0 || centralDegrees >= 360) {
    throw new RangeError('Центральный угол должен быть строго между 0° и 360°');
  }
  return roundValue(2 * radius * Math.sin(toRadians(centralDegrees / 2)));
}

/** Центральный угол по радиусу и длине хорды. */
export function centralAngleFromChord(radius: number, chord: number): number {
  assertPositive(radius, 'Радиус');
  assertPositive(chord, 'Хорда');
  if (chord > 2 * radius) {
    throw new RangeError('Хорда не может быть длиннее диаметра');
  }
  return roundValue(2 * toDegrees(Math.asin(chord / (2 * radius))), 8);
}

/** Теорема о вписанном угле: он вдвое меньше центрального, опирающегося на ту же дугу. */
export function inscribedAngleFromCentral(centralDegrees: number): number {
  if (!Number.isFinite(centralDegrees) || centralDegrees <= 0 || centralDegrees >= 360) {
    throw new RangeError('Центральный угол должен быть строго между 0° и 360°');
  }
  return toExactNumber(divideExact(parseExact(centralDegrees), 2));
}

/** Обратный пересчёт: дуга (центральный угол) вдвое больше вписанного угла. */
export function centralAngleFromInscribed(inscribedDegrees: number): number {
  if (!Number.isFinite(inscribedDegrees) || inscribedDegrees <= 0 || inscribedDegrees >= 180) {
    throw new RangeError('Вписанный угол должен быть строго между 0° и 180°');
  }
  return toExactNumber(multiplyExact(parseExact(inscribedDegrees), 2));
}

/**
 * Свойство пересекающихся хорд: AE·EB = CE·ED. По трём известным отрезкам
 * находим четвёртый — это прямое следствие подобия треугольников AEC и DEB.
 */
export function chordIntersectionSegment(ae: number, eb: number, ce: number): number {
  assertPositive(ae, 'Отрезок AE');
  assertPositive(eb, 'Отрезок EB');
  assertPositive(ce, 'Отрезок CE');
  return toExactNumber(divideExact(multiplyExact(parseExact(ae), parseExact(eb)), parseExact(ce)));
}

/** Точка окружности с данным центром по углу, отсчитанному от направления вправо. */
export function pointOnCircle(
  radius: number,
  degrees: number,
  centre: PlanimetryPoint = { x: 0, y: 0 },
): PlanimetryPoint {
  assertPositive(radius, 'Радиус');
  if (!Number.isFinite(degrees)) throw new TypeError('Угол должен быть конечным числом градусов');
  assertPoint(centre, 'Центр окружности');
  const radians = toRadians(degrees);
  return {
    x: roundValue(centre.x + radius * Math.cos(radians)),
    y: roundValue(centre.y + radius * Math.sin(radians)),
  };
}

/**
 * Две точки касания для касательных, проведённых из внешней точки.
 * Центр окружности — начало координат.
 */
export function tangentPointsFromExternal(
  radius: number,
  external: PlanimetryPoint,
): readonly [PlanimetryPoint, PlanimetryPoint] {
  assertPositive(radius, 'Радиус');
  assertPoint(external, 'Внешняя точка');
  const distance = Math.hypot(external.x, external.y);
  if (distance <= radius) throw new RangeError('Точка должна лежать вне окружности');
  const direction = toDegrees(Math.atan2(external.y, external.x));
  const spread = toDegrees(Math.acos(radius / distance));
  return [
    pointOnCircle(radius, direction + spread),
    pointOnCircle(radius, direction - spread),
  ];
}

/* ------------------------------------------------------------------ */
/* Честный масштаб чертежа                                             */
/* ------------------------------------------------------------------ */

/**
 * Единый масштаб для всех точек чертежа: по обеим осям он одинаков,
 * поэтому углы и отношения длин на картинке настоящие.
 */
export function fitPointsToBox(
  points: readonly PlanimetryPoint[],
  width: number,
  height: number,
  padding: number,
): ViewportFit {
  if (!Array.isArray(points) || points.length === 0) {
    throw new RangeError('Для масштаба нужна хотя бы одна точка');
  }
  points.forEach((point, index) => assertPoint(point, `Точка №${index + 1}`));
  assertPositive(width, 'Ширина области');
  assertPositive(height, 'Высота области');
  assertNonNegative(padding, 'Отступ');
  if (padding * 2 >= width || padding * 2 >= height) {
    throw new RangeError('Отступ не должен съедать всю область чертежа');
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  return {
    scale,
    translateX: width / 2 - ((minX + maxX) / 2) * scale,
    translateY: height / 2 + ((minY + maxY) / 2) * scale,
  };
}

/** Переводит математическую точку в координаты SVG: ось y смотрит вниз. */
export function projectPoint(point: PlanimetryPoint, fit: ViewportFit): ScreenPoint {
  assertPoint(point, 'Точка');
  if (typeof fit !== 'object' || fit === null || !Number.isFinite(fit.scale)) {
    throw new TypeError('Масштаб задаётся объектом ViewportFit');
  }
  return {
    x: roundValue(fit.translateX + point.x * fit.scale, 2),
    y: roundValue(fit.translateY - point.y * fit.scale, 2),
  };
}
