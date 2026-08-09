import {
  addExact,
  divideExact,
  multiplyExact,
  parseExact,
  subtractExact,
  toExactNumber,
} from './exactRational';
import { circleMeasures } from './geometry';
import { convexPolygonAngleSum, type PlanimetryPoint } from './planimetry';
import { triangleAreaBySides, triangleInequalityHolds } from './similarity';

/** Форма треугольника по наибольшему углу. */
export type TriangleAngleShape = 'acute' | 'right' | 'obtuse';

/** Набор данных, по которому треугольник восстанавливается однозначно. */
export type TriangleDataSet = 'sss' | 'sas' | 'asa';

/**
 * Полностью решённый треугольник. Стороны идут в порядке a, b, c;
 * углы — в порядке A, B, C, причём сторона a лежит против угла A.
 */
export interface SolvedTriangle {
  readonly sides: readonly [number, number, number];
  readonly angles: readonly [number, number, number];
  readonly perimeter: number;
  readonly area: number;
  /** Радиус описанной окружности: R = a / (2 sin A). */
  readonly circumradius: number;
  readonly shape: TriangleAngleShape;
}

/** Вершины треугольника на плоскости: A в начале координат, B на оси x. */
export interface TriangleVertices {
  readonly a: PlanimetryPoint;
  readonly b: PlanimetryPoint;
  readonly c: PlanimetryPoint;
}

/** Все размеры правильного n-угольника со стороной side. */
export interface RegularPolygonMetrics {
  readonly vertices: number;
  readonly side: number;
  /** Внутренний угол: 180°·(n − 2) / n. */
  readonly interiorAngle: number;
  /** Центральный угол, опирающийся на одну сторону: 360° / n. */
  readonly centralAngle: number;
  /** Радиус описанной окружности. */
  readonly circumradius: number;
  /** Радиус вписанной окружности (апофема). */
  readonly inradius: number;
  readonly perimeter: number;
  readonly area: number;
}

const RADIANS_PER_DEGREE = Math.PI / 180;

/**
 * Углы, у которых синус или косинус — рациональное число. Отдельная таблица
 * нужна, чтобы cos 90° был ровно нулём, а не 6·10⁻¹⁷: иначе «хороший» ответ
 * вроде 7 приходил бы в виде 6,999999999.
 */
const RATIONAL_SINES: Readonly<Record<number, number>> = { 0: 0, 30: 0.5, 90: 1, 150: 0.5, 180: 0 };
const RATIONAL_COSINES: Readonly<Record<number, number>> = { 0: 1, 60: 0.5, 90: 0, 120: -0.5, 180: -1 };

function roundValue(value: number, digits = 10): number {
  const factor = 10 ** digits;
  const result = Math.round(value * factor) / factor;
  return Object.is(result, -0) ? 0 : result;
}

function toDegrees(radians: number): number {
  return radians / RADIANS_PER_DEGREE;
}

function assertPositive(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label}: нужно положительное конечное число`);
  }
  return value;
}

/** Угол, для которого определены синус и косинус в этой главе: от 0° до 180°. */
function assertSpanDegrees(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 180) {
    throw new RangeError(`${label}: нужен угол от 0° до 180°`);
  }
  return value;
}

/** Угол треугольника: строго между 0° и 180°, вырожденные значения запрещены. */
function assertTriangleAngle(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= 180) {
    throw new RangeError(`${label}: угол треугольника лежит строго между 0° и 180°`);
  }
  return value;
}

function assertPolygonVertices(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 3) {
    throw new RangeError(`${label}: у правильного многоугольника не меньше трёх вершин`);
  }
  return value;
}

/* ------------------------------------------------------------------ */
/* Синус и косинус углов от 0° до 180°                                 */
/* ------------------------------------------------------------------ */

/** Смежный угол: 180° − α. В отличие от острого случая, 0° и 180° допустимы. */
export function supplementaryAngle(degrees: number): number {
  const alpha = assertSpanDegrees(degrees, 'Угол');
  return toExactNumber(subtractExact(180, parseExact(alpha)));
}

/** Синус угла от 0° до 180°. Неотрицателен всюду и равен нулю на концах. */
export function sineDegrees(degrees: number): number {
  const alpha = assertSpanDegrees(degrees, 'Угол');
  const exact = RATIONAL_SINES[alpha];
  return exact === undefined ? roundValue(Math.sin(alpha * RADIANS_PER_DEGREE)) : exact;
}

/** Косинус угла от 0° до 180°. Положителен до 90°, равен нулю в 90°, дальше отрицателен. */
export function cosineDegrees(degrees: number): number {
  const alpha = assertSpanDegrees(degrees, 'Угол');
  const exact = RATIONAL_COSINES[alpha];
  return exact === undefined ? roundValue(Math.cos(alpha * RADIANS_PER_DEGREE)) : exact;
}

/** Знак косинуса сразу называет вид угла — это рабочий признак для теоремы косинусов. */
export function angleShapeFromCosine(cosine: number): TriangleAngleShape {
  if (typeof cosine !== 'number' || !Number.isFinite(cosine)) {
    throw new TypeError('Косинус должен быть конечным числом');
  }
  if (cosine > 1e-9) return 'acute';
  if (cosine < -1e-9) return 'obtuse';
  return 'right';
}

/* ------------------------------------------------------------------ */
/* Теорема косинусов                                                   */
/* ------------------------------------------------------------------ */

/**
 * Теорема косинусов, прямой ход: третья сторона по двум сторонам и углу
 * между ними. a² = b² + c² − 2bc·cos A.
 */
export function lawOfCosinesSide(b: number, c: number, angleA: number): number {
  assertPositive(b, 'Сторона b');
  assertPositive(c, 'Сторона c');
  assertTriangleAngle(angleA, 'Угол между сторонами');
  const exactB = parseExact(b);
  const exactC = parseExact(c);
  const square = subtractExact(
    addExact(multiplyExact(exactB, exactB), multiplyExact(exactC, exactC)),
    multiplyExact(multiplyExact(2, multiplyExact(exactB, exactC)), parseExact(cosineDegrees(angleA))),
  );
  return roundValue(Math.sqrt(toExactNumber(square)));
}

/**
 * Косинус угла A по трём сторонам: cos A = (b² + c² − a²) / (2bc).
 * Значение точное, поэтому для 3-4-5 получается ровно ноль.
 */
export function cosineFromSides(a: number, b: number, c: number): number {
  if (!triangleInequalityHolds(a, b, c)) {
    throw new RangeError('Треугольника с такими сторонами не существует');
  }
  const exactA = parseExact(a);
  const exactB = parseExact(b);
  const exactC = parseExact(c);
  const numerator = subtractExact(
    addExact(multiplyExact(exactB, exactB), multiplyExact(exactC, exactC)),
    multiplyExact(exactA, exactA),
  );
  return toExactNumber(divideExact(numerator, multiplyExact(2, multiplyExact(exactB, exactC))));
}

/** Теорема косинусов, обратный ход: угол A, лежащий против стороны a. */
export function lawOfCosinesAngle(a: number, b: number, c: number): number {
  return roundValue(toDegrees(Math.acos(cosineFromSides(a, b, c))), 8);
}

/** Все три угла треугольника по трём сторонам, в порядке A, B, C. */
export function trianglesAnglesFromSides(a: number, b: number, c: number): readonly [number, number, number] {
  return [
    lawOfCosinesAngle(a, b, c),
    lawOfCosinesAngle(b, c, a),
    lawOfCosinesAngle(c, a, b),
  ];
}

/**
 * Вид треугольника по трём сторонам — обобщение обратной теоремы Пифагора.
 * Достаточно проверить знак косинуса угла против самой длинной стороны.
 */
export function triangleShapeFromSides(a: number, b: number, c: number): TriangleAngleShape {
  const [shortest, middle, longest] = [a, b, c].slice().sort((left, right) => left - right) as [number, number, number];
  return angleShapeFromCosine(cosineFromSides(longest, shortest, middle));
}

/* ------------------------------------------------------------------ */
/* Теорема синусов                                                     */
/* ------------------------------------------------------------------ */

/** Радиус описанной окружности: 2R = a / sin A. */
export function circumradius(side: number, oppositeDegrees: number): number {
  assertPositive(side, 'Сторона');
  assertTriangleAngle(oppositeDegrees, 'Противолежащий угол');
  return roundValue(side / (2 * sineDegrees(oppositeDegrees)));
}

/** Сторона, противолежащая углу wantedAngle, по известной паре «сторона — угол». */
export function lawOfSinesSide(knownSide: number, knownAngle: number, wantedAngle: number): number {
  assertPositive(knownSide, 'Известная сторона');
  assertTriangleAngle(knownAngle, 'Известный угол');
  assertTriangleAngle(wantedAngle, 'Искомый угол');
  return roundValue((knownSide * sineDegrees(wantedAngle)) / sineDegrees(knownAngle));
}

/**
 * Синус искомого угла по паре «сторона — противолежащий угол» и второй стороне:
 * sin B = b·sin A / a. Может оказаться больше единицы — тогда треугольника нет.
 */
export function sineOfAngleFromSides(knownSide: number, knownAngle: number, wantedSide: number): number {
  assertPositive(knownSide, 'Известная сторона');
  assertTriangleAngle(knownAngle, 'Известный угол');
  assertPositive(wantedSide, 'Вторая сторона');
  return roundValue((wantedSide * sineDegrees(knownAngle)) / knownSide);
}

/**
 * Углы от 0° до 180° с данным синусом. Их два — острый и тупой, — и это ровно
 * та причина, по которой набор «две стороны и угол не между ними» неоднозначен.
 */
export function anglesWithSine(sine: number): readonly number[] {
  if (typeof sine !== 'number' || !Number.isFinite(sine) || sine <= 0) {
    throw new RangeError('Синус угла треугольника должен быть положительным числом');
  }
  if (sine > 1 + 1e-12) return [];
  const acute = roundValue(toDegrees(Math.asin(Math.min(sine, 1))), 8);
  if (Math.abs(acute - 90) < 1e-9) return [90];
  return [acute, roundValue(180 - acute, 8)];
}

/* ------------------------------------------------------------------ */
/* Площадь через синус                                                 */
/* ------------------------------------------------------------------ */

/** Площадь по двум сторонам и углу между ними: S = ½·b·c·sin A. */
export function triangleAreaBySas(b: number, c: number, angleA: number): number {
  assertPositive(b, 'Сторона b');
  assertPositive(c, 'Сторона c');
  assertTriangleAngle(angleA, 'Угол между сторонами');
  return roundValue(0.5 * b * c * sineDegrees(angleA));
}

/* ------------------------------------------------------------------ */
/* Решение треугольников                                               */
/* ------------------------------------------------------------------ */

function buildSolution(a: number, b: number, c: number, angles: readonly [number, number, number]): SolvedTriangle {
  const [angleA, angleB, angleC] = angles;
  const sideA = roundValue(a);
  const sideB = roundValue(b);
  const sideC = roundValue(c);
  const largest = Math.max(angleA, angleB, angleC);
  return {
    sides: [sideA, sideB, sideC],
    angles: [roundValue(angleA, 8), roundValue(angleB, 8), roundValue(angleC, 8)],
    perimeter: roundValue(sideA + sideB + sideC),
    // Формула Герона точнее для набора «три стороны»; для остальных наборов
    // страхуемся площадью через синус, чтобы не споткнуться об округление.
    area: triangleInequalityHolds(sideA, sideB, sideC)
      ? triangleAreaBySides(sideA, sideB, sideC)
      : roundValue(0.5 * sideB * sideC * Math.sin(angleA * RADIANS_PER_DEGREE)),
    circumradius: circumradius(sideA, angleA),
    shape: largest > 90 + 1e-8 ? 'obtuse' : largest < 90 - 1e-8 ? 'acute' : 'right',
  };
}

/** Три стороны: углы находит теорема косинусов, площадь — формула Герона. */
export function solveBySss(a: number, b: number, c: number): SolvedTriangle {
  if (!triangleInequalityHolds(a, b, c)) {
    throw new RangeError('Треугольника с такими сторонами не существует');
  }
  return buildSolution(a, b, c, trianglesAnglesFromSides(a, b, c));
}

/** Две стороны и угол между ними: сначала теорема косинусов, потом остальные углы. */
export function solveBySas(b: number, angleA: number, c: number): SolvedTriangle {
  const a = lawOfCosinesSide(b, c, angleA);
  const angleB = lawOfCosinesAngle(b, c, a);
  return buildSolution(a, b, c, [angleA, angleB, roundValue(180 - angleA - angleB, 8)]);
}

/** Сторона и два прилежащих угла: третий угол — по сумме, стороны — по теореме синусов. */
export function solveByAsa(angleA: number, c: number, angleB: number): SolvedTriangle {
  assertTriangleAngle(angleA, 'Угол A');
  assertTriangleAngle(angleB, 'Угол B');
  assertPositive(c, 'Сторона между углами');
  const angleC = roundValue(180 - angleA - angleB, 8);
  if (angleC <= 0) {
    throw new RangeError('Сумма двух углов треугольника должна быть меньше 180°');
  }
  return buildSolution(
    lawOfSinesSide(c, angleC, angleA),
    lawOfSinesSide(c, angleC, angleB),
    c,
    [angleA, angleB, angleC],
  );
}

/**
 * Две стороны и угол, лежащий против одной из них. Набор ненадёжный: решений
 * может не быть вовсе, быть одно или два. Возвращаем все подходящие.
 */
export function solveBySsa(a: number, b: number, angleA: number): readonly SolvedTriangle[] {
  assertPositive(a, 'Сторона a');
  assertPositive(b, 'Сторона b');
  assertTriangleAngle(angleA, 'Угол A');
  return anglesWithSine(sineOfAngleFromSides(a, angleA, b))
    .filter((angleB) => angleA + angleB < 180 - 1e-9)
    .map((angleB) => {
      const angleC = roundValue(180 - angleA - angleB, 8);
      return buildSolution(a, b, lawOfSinesSide(a, angleA, angleC), [angleA, angleB, angleC]);
    });
}

/**
 * Вершины треугольника по трём сторонам: A в начале координат, B на оси x
 * на расстоянии c, C — выше оси. Чертёж получается честным по всем углам.
 */
export function triangleVerticesFromSides(a: number, b: number, c: number): TriangleVertices {
  const cosA = cosineFromSides(a, b, c);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  return {
    a: { x: 0, y: 0 },
    b: { x: roundValue(c), y: 0 },
    c: { x: roundValue(b * cosA), y: roundValue(b * sinA) },
  };
}

/** Тот же чертёж, но по уже решённому треугольнику. */
export function solvedTriangleVertices(solution: SolvedTriangle): TriangleVertices {
  const [a, b, c] = solution.sides;
  return triangleVerticesFromSides(a, b, c);
}

/* ------------------------------------------------------------------ */
/* Правильные многоугольники                                           */
/* ------------------------------------------------------------------ */

/** Внутренний угол правильного n-угольника: сумма углов, делённая на n. */
export function regularPolygonInteriorAngle(vertices: number): number {
  assertPolygonVertices(vertices, 'Число вершин');
  return toExactNumber(divideExact(convexPolygonAngleSum(vertices), vertices));
}

/** Центральный угол: полный оборот, разделённый на n равных частей. */
export function regularPolygonCentralAngle(vertices: number): number {
  assertPolygonVertices(vertices, 'Число вершин');
  return toExactNumber(divideExact(360, vertices));
}

/** Радиус описанной окружности по стороне: R = a / (2·sin(180°/n)). */
export function regularPolygonCircumradius(vertices: number, side: number): number {
  assertPolygonVertices(vertices, 'Число вершин');
  assertPositive(side, 'Сторона');
  return roundValue(side / (2 * Math.sin(Math.PI / vertices)));
}

/** Радиус вписанной окружности (апофема) по стороне: r = a / (2·tg(180°/n)). */
export function regularPolygonInradius(vertices: number, side: number): number {
  assertPolygonVertices(vertices, 'Число вершин');
  assertPositive(side, 'Сторона');
  return roundValue(side / (2 * Math.tan(Math.PI / vertices)));
}

/** Сторона по радиусу описанной окружности: a = 2R·sin(180°/n). */
export function regularPolygonSideFromCircumradius(vertices: number, radius: number): number {
  assertPolygonVertices(vertices, 'Число вершин');
  assertPositive(radius, 'Радиус описанной окружности');
  return roundValue(2 * radius * Math.sin(Math.PI / vertices));
}

/** Сторона по радиусу вписанной окружности: a = 2r·tg(180°/n). */
export function regularPolygonSideFromInradius(vertices: number, radius: number): number {
  assertPolygonVertices(vertices, 'Число вершин');
  assertPositive(radius, 'Радиус вписанной окружности');
  return roundValue(2 * radius * Math.tan(Math.PI / vertices));
}

/** Площадь правильного многоугольника: половина произведения периметра на апофему. */
export function regularPolygonArea(vertices: number, side: number): number {
  return roundValue(0.5 * vertices * side * regularPolygonInradius(vertices, side));
}

/** Все размеры правильного многоугольника одним объектом — под чертёж и таблицу. */
export function regularPolygonMetrics(vertices: number, side: number): RegularPolygonMetrics {
  assertPolygonVertices(vertices, 'Число вершин');
  assertPositive(side, 'Сторона');
  return {
    vertices,
    side,
    interiorAngle: regularPolygonInteriorAngle(vertices),
    centralAngle: regularPolygonCentralAngle(vertices),
    circumradius: regularPolygonCircumradius(vertices, side),
    inradius: regularPolygonInradius(vertices, side),
    perimeter: roundValue(vertices * side),
    area: regularPolygonArea(vertices, side),
  };
}

/**
 * Вершины правильного многоугольника на описанной окружности с центром
 * в начале координат. Первая вершина поднята вверх, обход — против часовой.
 */
export function regularPolygonVertices(vertices: number, radius: number): readonly PlanimetryPoint[] {
  assertPolygonVertices(vertices, 'Число вершин');
  assertPositive(radius, 'Радиус описанной окружности');
  return Array.from({ length: vertices }, (_, index) => {
    const angle = Math.PI / 2 + (2 * Math.PI * index) / vertices;
    return { x: roundValue(radius * Math.cos(angle)), y: roundValue(radius * Math.sin(angle)) };
  });
}

/* ------------------------------------------------------------------ */
/* Окружность, дуга и сектор                                           */
/* ------------------------------------------------------------------ */

/** Коэффициент k в записи C = k·π: для окружности он равен диаметру. */
export function circumferencePiCoefficient(radius: number): number {
  assertPositive(radius, 'Радиус');
  return circleMeasures(radius).circumferencePiCoefficient;
}

/** Коэффициент k в записи S = k·π: для круга он равен квадрату радиуса. */
export function circleAreaPiCoefficient(radius: number): number {
  assertPositive(radius, 'Радиус');
  return circleMeasures(radius).areaPiCoefficient;
}

/** Коэффициент k в записи длины дуги l = k·π: k = R·α / 180. */
export function arcLengthPiCoefficient(radius: number, degrees: number): number {
  assertPositive(radius, 'Радиус');
  assertArcDegrees(degrees);
  return toExactNumber(divideExact(multiplyExact(parseExact(radius), parseExact(degrees)), 180));
}

/** Коэффициент k в записи площади сектора S = k·π: k = R²·α / 360. */
export function sectorAreaPiCoefficient(radius: number, degrees: number): number {
  assertPositive(radius, 'Радиус');
  assertArcDegrees(degrees);
  const exactRadius = parseExact(radius);
  return toExactNumber(
    divideExact(multiplyExact(multiplyExact(exactRadius, exactRadius), parseExact(degrees)), 360),
  );
}

function assertArcDegrees(degrees: number): number {
  if (typeof degrees !== 'number' || !Number.isFinite(degrees) || degrees < 0 || degrees > 360) {
    throw new RangeError('Градусная мера дуги лежит от 0° до 360°');
  }
  return degrees;
}

/** Длина окружности с настоящим числом π. */
export function circumference(radius: number): number {
  return roundValue(Math.PI * circumferencePiCoefficient(radius));
}

/** Площадь круга с настоящим числом π. */
export function circleArea(radius: number): number {
  return roundValue(Math.PI * circleAreaPiCoefficient(radius));
}

/** Длина дуги в α градусов. */
export function arcLength(radius: number, degrees: number): number {
  return roundValue(Math.PI * arcLengthPiCoefficient(radius, degrees));
}

/** Площадь кругового сектора с дугой в α градусов. */
export function sectorArea(radius: number, degrees: number): number {
  return roundValue(Math.PI * sectorAreaPiCoefficient(radius, degrees));
}

/** Площадь кругового сегмента: сектор минус треугольник с вершиной в центре. */
export function segmentArea(radius: number, degrees: number): number {
  assertPositive(radius, 'Радиус');
  if (!Number.isFinite(degrees) || degrees <= 0 || degrees >= 360) {
    throw new RangeError('Центральный угол сегмента лежит строго между 0° и 360°');
  }
  return roundValue(sectorArea(radius, degrees) - 0.5 * radius * radius * Math.sin(degrees * RADIANS_PER_DEGREE));
}
