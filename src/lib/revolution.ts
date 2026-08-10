/**
 * Вычислительное ядро главы «Тела вращения» (11 класс).
 *
 * Три независимые части:
 *  1. точная арифметика вида $q\pi^k$ — площади и объёмы цилиндра, конуса и шара
 *     считаются без потери точности, пока размеры рациональны;
 *  2. осевые сечения, развёртка конуса, сечения шара и принцип Кавальери;
 *  3. честная параллельная проекция тела вращения: окружность уровня переходит
 *     в эллипс с полуосями $r$ и $r\sin\varepsilon$, а образующая — в точку,
 *     полученную поворотом вокруг оси.
 *
 * Все функции чистые: они не читают DOM и не хранят состояние.
 */
import {
  addExact,
  compareExact,
  divideExact,
  formatExactRussian,
  multiplyExact,
  parseExact,
  subtractExact,
  toExactNumber,
  type ExactInput,
  type ExactRational,
} from './exactRational';

export type { ExactRational } from './exactRational';

// ───────────────────────── точные значения с π ─────────────────────────

/** Значение вида $q\cdot\pi^{k}$, где $q$ — точная дробь, а $k$ равно 0 или 1. */
export interface ExactPi {
  readonly coefficient: ExactRational;
  readonly piPower: 0 | 1;
}

/**
 * Величина главы: точное значение, если оно представимо как $q\pi^k$, и всегда
 * доступное числовое приближение. Для иррациональных длин (например, образующей
 * конуса при непифагоровых размерах) поле `exact` равно `null`.
 */
export interface Measure {
  readonly exact: ExactPi | null;
  readonly value: number;
}

const ZERO = parseExact(0);
const TWO = parseExact(2);
const THREE = parseExact(3);
const FOUR = parseExact(4);
const FULL_TURN = parseExact(360);

function assertFiniteNumber(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} должно быть конечным числом`);
  }
  return value;
}

function assertPositiveExact(value: ExactInput, label: string): ExactRational {
  const parsed = parseExact(value);
  if (compareExact(parsed, ZERO) <= 0) {
    throw new RangeError(`${label} должно быть положительным`);
  }
  return parsed;
}

function assertNonNegativeExact(value: ExactInput, label: string): ExactRational {
  const parsed = parseExact(value);
  if (compareExact(parsed, ZERO) < 0) {
    throw new RangeError(`${label} не может быть отрицательным`);
  }
  return parsed;
}

/** Конструктор точного значения $q\pi^k$. */
export function exactPi(coefficient: ExactInput, piPower: 0 | 1 = 1): ExactPi {
  if (piPower !== 0 && piPower !== 1) {
    throw new RangeError('Степень π в этой главе равна 0 или 1');
  }
  return { coefficient: parseExact(coefficient), piPower };
}

/** Числовое значение точной величины. */
export function piNumber(value: ExactPi): number {
  return toExactNumber(value.coefficient) * (value.piPower === 1 ? Math.PI : 1);
}

/**
 * Запись точного значения обычным текстом: `12π`, `(32/3)π`, `−π`, `24`.
 * Используется в подписях лаборатории; в тексте уроков формулы набираются KaTeX.
 */
export function formatExactPi(value: ExactPi): string {
  const text = formatExactRussian(value.coefficient);
  if (value.piPower === 0) return text;
  if (text === '0') return '0';
  if (text === '1') return 'π';
  if (text === '−1') return '−π';
  return text.includes('/') ? `(${text})π` : `${text}π`;
}

function measureFromExact(value: ExactPi): Measure {
  return { exact: value, value: piNumber(value) };
}

function measureApproximate(value: number, label: string): Measure {
  return { exact: null, value: assertFiniteNumber(value, label) };
}

/** Округление для вывода (не для сравнений). */
export function roundTo(value: number, digits = 2): number {
  assertFiniteNumber(value, 'Значение');
  if (!Number.isInteger(digits) || digits < 0 || digits > 12) {
    throw new RangeError('Число знаков должно быть целым от 0 до 12');
  }
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON * Math.sign(value || 1)) * factor) / factor;
}

/** Десятичная запись с запятой — как принято в русской школе. */
export function formatNumber(value: number, digits = 2): string {
  return String(roundTo(value, digits)).replace('.', ',').replace('-', '−');
}

/**
 * Подпись величины: точная форма, если она есть, иначе приближение со знаком ≈.
 */
export function formatMeasure(value: Measure, digits = 2): string {
  if (value.exact === null) return `≈ ${formatNumber(value.value, digits)}`;
  if (value.exact.piPower === 0) return formatExactPi(value.exact);
  return `${formatExactPi(value.exact)} ≈ ${formatNumber(value.value, digits)}`;
}

function bigintSquareRoot(value: bigint): bigint | null {
  if (value < 0n) return null;
  if (value < 2n) return value;
  let previous = value;
  let current = (value + 1n) / 2n;
  while (current < previous) {
    previous = current;
    current = (current + value / current) / 2n;
  }
  return previous * previous === value ? previous : null;
}

/**
 * Точный квадратный корень из неотрицательной дроби: возвращает дробь, если и
 * числитель, и знаменатель — полные квадраты, иначе `null`.
 */
export function exactSquareRoot(value: ExactInput): ExactRational | null {
  const parsed = parseExact(value);
  if (compareExact(parsed, ZERO) < 0) {
    throw new RangeError('Квадратный корень из отрицательного числа не определён');
  }
  const numerator = bigintSquareRoot(parsed.numerator);
  const denominator = bigintSquareRoot(parsed.denominator);
  if (numerator === null || denominator === null) return null;
  return parseExact({ numerator, denominator });
}

/** Квадратный корень как величина главы: точная форма, если она существует. */
export function squareRootMeasure(value: ExactInput): Measure {
  const parsed = assertNonNegativeExact(value, 'Подкоренное выражение');
  const exact = exactSquareRoot(parsed);
  if (exact !== null) return measureFromExact(exactPi(exact, 0));
  return measureApproximate(Math.sqrt(toExactNumber(parsed)), 'Корень');
}

function square(value: ExactRational): ExactRational {
  return multiplyExact(value, value);
}

function cube(value: ExactRational): ExactRational {
  return multiplyExact(square(value), value);
}

// ───────────────────────── осевые сечения ─────────────────────────

export type RevolutionKind = 'cylinder' | 'cone' | 'sphere';

export const REVOLUTION_KINDS: readonly RevolutionKind[] = ['cylinder', 'cone', 'sphere'];

/** Плоская фигура, вращение которой даёт тело. */
export const GENERATING_FIGURE: Readonly<Record<RevolutionKind, string>> = {
  cylinder: 'прямоугольник вокруг своей стороны',
  cone: 'прямоугольный треугольник вокруг катета',
  sphere: 'полукруг вокруг диаметра',
};

export interface AxialSection {
  /** Название фигуры сечения. */
  readonly shape: string;
  /** Ширина сечения: она равна диаметру тела. */
  readonly width: number;
  readonly height: number;
  readonly area: Measure;
  /** Особый случай: квадрат в осевом сечении цилиндра, равносторонний треугольник у конуса. */
  readonly special: boolean;
}

export interface ConeAxialSection extends AxialSection {
  /** Угол при вершине осевого сечения в градусах. */
  readonly apexAngleDegrees: number;
  /** Угол наклона образующей к плоскости основания в градусах. */
  readonly baseAngleDegrees: number;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

// ───────────────────────── цилиндр ─────────────────────────

export interface CylinderNet {
  /** Ширина прямоугольника развёртки равна длине окружности основания $2\pi r$. */
  readonly rectangleWidth: Measure;
  readonly rectangleHeight: number;
  readonly rectangleArea: Measure;
  readonly circleArea: Measure;
}

export interface CylinderMetrics {
  readonly kind: 'cylinder';
  readonly radius: ExactRational;
  readonly height: ExactRational;
  readonly baseArea: Measure;
  readonly lateralArea: Measure;
  readonly totalArea: Measure;
  readonly volume: Measure;
  readonly axialSection: AxialSection;
  readonly net: CylinderNet;
}

/**
 * Цилиндр радиуса $r$ и высоты $h$:
 * $S_{\text{бок}}=2\pi rh$, $S=2\pi r(r+h)$, $V=\pi r^2h$.
 */
export function cylinderMetrics(radius: ExactInput, height: ExactInput): CylinderMetrics {
  const r = assertPositiveExact(radius, 'Радиус цилиндра');
  const h = assertPositiveExact(height, 'Высота цилиндра');
  const baseArea = exactPi(square(r));
  const lateralArea = exactPi(multiplyExact(multiplyExact(TWO, r), h));
  const totalArea = exactPi(multiplyExact(multiplyExact(TWO, r), addExact(r, h)));
  const volume = exactPi(multiplyExact(square(r), h));
  const diameter = multiplyExact(TWO, r);
  const sectionArea = multiplyExact(diameter, h);

  return {
    kind: 'cylinder',
    radius: r,
    height: h,
    baseArea: measureFromExact(baseArea),
    lateralArea: measureFromExact(lateralArea),
    totalArea: measureFromExact(totalArea),
    volume: measureFromExact(volume),
    axialSection: {
      shape: 'прямоугольник',
      width: toExactNumber(diameter),
      height: toExactNumber(h),
      area: measureFromExact(exactPi(sectionArea, 0)),
      special: compareExact(diameter, h) === 0,
    },
    net: {
      rectangleWidth: measureFromExact(exactPi(multiplyExact(TWO, r))),
      rectangleHeight: toExactNumber(h),
      rectangleArea: measureFromExact(lateralArea),
      circleArea: measureFromExact(baseArea),
    },
  };
}

// ───────────────────────── конус ─────────────────────────

export interface ConeNet {
  /** Радиус сектора развёртки равен образующей. */
  readonly sectorRadius: Measure;
  /** Угол сектора: $\varphi=360°\cdot\dfrac{r}{l}$. */
  readonly sectorAngleDegrees: Measure;
  /** Длина дуги сектора равна длине окружности основания. */
  readonly arcLength: Measure;
  readonly sectorArea: Measure;
}

export interface ConeMetrics {
  readonly kind: 'cone';
  readonly radius: ExactRational;
  readonly height: ExactRational;
  readonly slant: Measure;
  readonly baseArea: Measure;
  readonly lateralArea: Measure;
  readonly totalArea: Measure;
  readonly volume: Measure;
  readonly axialSection: ConeAxialSection;
  readonly net: ConeNet;
}

/**
 * Конус радиуса $r$ и высоты $h$: образующая $l=\sqrt{r^2+h^2}$,
 * $S_{\text{бок}}=\pi rl$, $S=\pi r(r+l)$, $V=\tfrac13\pi r^2h$.
 *
 * Если $l$ рациональна (пифагоровы размеры), то боковая и полная поверхность и
 * угол развёртки тоже записываются точно.
 */
export function coneMetrics(radius: ExactInput, height: ExactInput): ConeMetrics {
  const r = assertPositiveExact(radius, 'Радиус конуса');
  const h = assertPositiveExact(height, 'Высота конуса');
  const slantSquared = addExact(square(r), square(h));
  const exactSlant = exactSquareRoot(slantSquared);
  const slantValue = Math.sqrt(toExactNumber(slantSquared));
  const slant: Measure = exactSlant === null
    ? measureApproximate(slantValue, 'Образующая')
    : measureFromExact(exactPi(exactSlant, 0));

  const baseArea = exactPi(square(r));
  const volume = exactPi(divideExact(multiplyExact(square(r), h), THREE));
  const lateralArea: Measure = exactSlant === null
    ? measureApproximate(Math.PI * toExactNumber(r) * slantValue, 'Боковая поверхность')
    : measureFromExact(exactPi(multiplyExact(r, exactSlant)));
  const totalArea: Measure = exactSlant === null
    ? measureApproximate(Math.PI * toExactNumber(r) * (toExactNumber(r) + slantValue), 'Полная поверхность')
    : measureFromExact(exactPi(multiplyExact(r, addExact(r, exactSlant))));
  const sectorAngle: Measure = exactSlant === null
    ? measureApproximate((360 * toExactNumber(r)) / slantValue, 'Угол развёртки')
    : measureFromExact(exactPi(divideExact(multiplyExact(FULL_TURN, r), exactSlant), 0));

  const numericRadius = toExactNumber(r);
  const numericHeight = toExactNumber(h);
  const diameter = multiplyExact(TWO, r);

  return {
    kind: 'cone',
    radius: r,
    height: h,
    slant,
    baseArea: measureFromExact(baseArea),
    lateralArea,
    totalArea,
    volume: measureFromExact(volume),
    axialSection: {
      shape: 'равнобедренный треугольник',
      width: toExactNumber(diameter),
      height: numericHeight,
      area: measureFromExact(exactPi(multiplyExact(r, h), 0)),
      // Осевое сечение равностороннее ровно тогда, когда l = 2r.
      special: Math.abs(slantValue - 2 * numericRadius) <= 1e-12 * Math.max(1, slantValue),
      apexAngleDegrees: 2 * toDegrees(Math.atan2(numericRadius, numericHeight)),
      baseAngleDegrees: toDegrees(Math.atan2(numericHeight, numericRadius)),
    },
    net: {
      sectorRadius: slant,
      sectorAngleDegrees: sectorAngle,
      arcLength: measureFromExact(exactPi(multiplyExact(TWO, r))),
      sectorArea: lateralArea,
    },
  };
}

// ───────────────────────── шар и сфера ─────────────────────────

export interface SphereMetrics {
  readonly kind: 'sphere';
  readonly radius: ExactRational;
  /** Площадь сферы $S=4\pi R^2$. */
  readonly surfaceArea: Measure;
  /** Объём шара $V=\tfrac43\pi R^3$. */
  readonly volume: Measure;
  readonly greatCircleLength: Measure;
  readonly greatCircleArea: Measure;
  readonly axialSection: AxialSection;
}

export function sphereMetrics(radius: ExactInput): SphereMetrics {
  const r = assertPositiveExact(radius, 'Радиус шара');
  const greatCircleArea = exactPi(square(r));
  return {
    kind: 'sphere',
    radius: r,
    surfaceArea: measureFromExact(exactPi(multiplyExact(FOUR, square(r)))),
    volume: measureFromExact(exactPi(divideExact(multiplyExact(FOUR, cube(r)), THREE))),
    greatCircleLength: measureFromExact(exactPi(multiplyExact(TWO, r))),
    greatCircleArea: measureFromExact(greatCircleArea),
    axialSection: {
      shape: 'большой круг',
      width: toExactNumber(multiplyExact(TWO, r)),
      height: toExactNumber(multiplyExact(TWO, r)),
      area: measureFromExact(greatCircleArea),
      special: true,
    },
  };
}

export interface SphereSection {
  readonly distance: ExactRational;
  /** Плоскость пересекает шар (расстояние меньше радиуса). */
  readonly intersects: boolean;
  /** Плоскость касается сферы (расстояние равно радиусу). */
  readonly tangent: boolean;
  readonly sectionRadius: Measure;
  /** Площадь круга сечения $\pi(R^2-d^2)$ — всегда точная. */
  readonly sectionArea: Measure;
  readonly sectionLength: Measure;
}

/**
 * Сечение шара радиуса $R$ плоскостью на расстоянии $d$ от центра.
 * Радиус сечения $\rho=\sqrt{R^2-d^2}$, а его площадь $\pi(R^2-d^2)$ точна всегда.
 */
export function sphereSection(radius: ExactInput, distance: ExactInput): SphereSection {
  const r = assertPositiveExact(radius, 'Радиус шара');
  const d = assertNonNegativeExact(distance, 'Расстояние до плоскости');
  const comparison = compareExact(d, r);
  if (comparison > 0) {
    return {
      distance: d,
      intersects: false,
      tangent: false,
      sectionRadius: measureFromExact(exactPi(ZERO, 0)),
      sectionArea: measureFromExact(exactPi(ZERO)),
      sectionLength: measureFromExact(exactPi(ZERO)),
    };
  }
  const squared = subtractExact(square(r), square(d));
  const sectionRadius = squareRootMeasure(squared);
  const sectionLength: Measure = sectionRadius.exact === null
    ? measureApproximate(2 * Math.PI * sectionRadius.value, 'Длина окружности сечения')
    : measureFromExact(exactPi(multiplyExact(TWO, sectionRadius.exact.coefficient)));
  return {
    distance: d,
    intersects: comparison < 0,
    tangent: comparison === 0,
    sectionRadius,
    sectionArea: measureFromExact(exactPi(squared)),
    sectionLength,
  };
}

// ───────────────────────── принцип Кавальери ─────────────────────────

export interface CavalieriLevel {
  readonly level: ExactRational;
  /** Радиус круга, который высекает плоскость в полушаре. */
  readonly hemisphereRadius: Measure;
  /** Площадь сечения полушара: круг радиуса $\sqrt{R^2-y^2}$. */
  readonly hemisphereArea: Measure;
  /** Радиус выреза конуса на этом же уровне равен самому уровню $y$. */
  readonly coneRadius: ExactRational;
  /** Круг сечения цилиндра: он не зависит от уровня. */
  readonly cylinderArea: Measure;
  /** Круг сечения вырезанного конуса. */
  readonly coneArea: Measure;
  /** Кольцо между цилиндром и конусом. */
  readonly ringArea: Measure;
  /** Совпадают ли площади двух сечений — именно это и есть условие Кавальери. */
  readonly equal: boolean;
}

/**
 * Один «этаж» сравнения по Кавальери. На высоте $y$ полушар радиуса $R$ даёт круг
 * радиуса $\sqrt{R^2-y^2}$, а цилиндр с вырезанным конусом — кольцо между кругами
 * радиусов $R$ и $y$. Площади считаются независимо и затем сравниваются.
 */
export function cavalieriLevel(radius: ExactInput, level: ExactInput): CavalieriLevel {
  const r = assertPositiveExact(radius, 'Радиус шара');
  const y = assertNonNegativeExact(level, 'Уровень сечения');
  if (compareExact(y, r) > 0) {
    throw new RangeError('Уровень сечения не должен превышать радиус');
  }
  const hemisphereRadius = squareRootMeasure(subtractExact(square(r), square(y)));
  // Площадь круга полушара берём из его радиуса, а кольцо — как разность двух кругов.
  const hemisphereArea = exactPi(subtractExact(square(r), square(y)));
  const cylinderArea = exactPi(square(r));
  const coneArea = exactPi(square(y));
  const ringArea = exactPi(subtractExact(cylinderArea.coefficient, coneArea.coefficient));
  return {
    level: y,
    hemisphereRadius,
    hemisphereArea: measureFromExact(hemisphereArea),
    coneRadius: y,
    cylinderArea: measureFromExact(cylinderArea),
    coneArea: measureFromExact(coneArea),
    ringArea: measureFromExact(ringArea),
    equal: compareExact(hemisphereArea.coefficient, ringArea.coefficient) === 0,
  };
}

export interface CavalieriBalance {
  readonly cylinderVolume: Measure;
  readonly coneVolume: Measure;
  readonly hemisphereVolume: Measure;
  readonly sphereVolume: Measure;
}

/**
 * Вывод объёма шара: полушар равновелик цилиндру $R\times R$ без вписанного конуса,
 * поэтому $V_{\text{полушара}}=\pi R^3-\tfrac13\pi R^3=\tfrac23\pi R^3$.
 */
export function cavalieriBalance(radius: ExactInput): CavalieriBalance {
  const r = assertPositiveExact(radius, 'Радиус шара');
  const cylinder = exactPi(cube(r));
  const cone = exactPi(divideExact(cube(r), THREE));
  const hemisphere = exactPi(subtractExact(cube(r), divideExact(cube(r), THREE)));
  return {
    cylinderVolume: measureFromExact(cylinder),
    coneVolume: measureFromExact(cone),
    hemisphereVolume: measureFromExact(hemisphere),
    sphereVolume: measureFromExact(exactPi(multiplyExact(TWO, hemisphere.coefficient))),
  };
}

// ───────────────────────── комбинированные тела ─────────────────────────

export interface SphereInCylinder {
  readonly sphere: SphereMetrics;
  readonly cylinder: CylinderMetrics;
  /** Отношение объёмов шара и цилиндра. */
  readonly volumeRatio: ExactRational;
  /** Отношение площади сферы к полной поверхности цилиндра. */
  readonly areaRatio: ExactRational;
}

/**
 * Шар, вписанный в цилиндр: у цилиндра $h=2R$. Теорема Архимеда — оба отношения
 * равны $2:3$ и не зависят от радиуса.
 */
export function sphereInscribedInCylinder(radius: ExactInput): SphereInCylinder {
  const r = assertPositiveExact(radius, 'Радиус шара');
  const sphere = sphereMetrics(r);
  const cylinder = cylinderMetrics(r, multiplyExact(TWO, r));
  const volumeRatio = divideExact(
    (sphere.volume.exact as ExactPi).coefficient,
    (cylinder.volume.exact as ExactPi).coefficient,
  );
  const areaRatio = divideExact(
    (sphere.surfaceArea.exact as ExactPi).coefficient,
    (cylinder.totalArea.exact as ExactPi).coefficient,
  );
  return { sphere, cylinder, volumeRatio, areaRatio };
}

export interface CylinderInSphere {
  readonly sphereRadius: ExactRational;
  readonly cylinderRadius: ExactRational;
  readonly height: Measure;
  readonly volume: Measure;
  readonly lateralArea: Measure;
}

/**
 * Цилиндр, вписанный в шар: центр шара — середина оси, поэтому
 * $\left(\tfrac{h}{2}\right)^2+r^2=R^2$ и $h=2\sqrt{R^2-r^2}$.
 */
export function cylinderInscribedInSphere(sphereRadius: ExactInput, cylinderRadius: ExactInput): CylinderInSphere {
  const bigR = assertPositiveExact(sphereRadius, 'Радиус шара');
  const r = assertPositiveExact(cylinderRadius, 'Радиус цилиндра');
  if (compareExact(r, bigR) >= 0) {
    throw new RangeError('Радиус вписанного цилиндра должен быть меньше радиуса шара');
  }
  const halfHeight = squareRootMeasure(subtractExact(square(bigR), square(r)));
  const height: Measure = halfHeight.exact === null
    ? measureApproximate(2 * halfHeight.value, 'Высота цилиндра')
    : measureFromExact(exactPi(multiplyExact(TWO, halfHeight.exact.coefficient), 0));
  const volume: Measure = height.exact === null
    ? measureApproximate(Math.PI * toExactNumber(square(r)) * height.value, 'Объём цилиндра')
    : measureFromExact(exactPi(multiplyExact(square(r), height.exact.coefficient)));
  const lateralArea: Measure = height.exact === null
    ? measureApproximate(2 * Math.PI * toExactNumber(r) * height.value, 'Боковая поверхность')
    : measureFromExact(exactPi(multiplyExact(multiplyExact(TWO, r), height.exact.coefficient)));
  return { sphereRadius: bigR, cylinderRadius: r, height, volume, lateralArea };
}

export interface SphereInCone {
  readonly coneRadius: ExactRational;
  readonly coneHeight: ExactRational;
  readonly slant: Measure;
  /** Радиус вписанного шара равен радиусу окружности, вписанной в осевое сечение. */
  readonly sphereRadius: Measure;
  readonly sphereVolume: Measure;
}

/**
 * Шар, вписанный в конус. Осевое сечение — равнобедренный треугольник с основанием
 * $2r$ и боковыми сторонами $l$, поэтому $\rho=\dfrac{S}{p}=\dfrac{rh}{r+l}$.
 */
export function sphereInscribedInCone(radius: ExactInput, height: ExactInput): SphereInCone {
  const r = assertPositiveExact(radius, 'Радиус конуса');
  const h = assertPositiveExact(height, 'Высота конуса');
  const cone = coneMetrics(r, h);
  const slantExact = cone.slant.exact;
  if (slantExact === null) {
    const value = (toExactNumber(r) * toExactNumber(h)) / (toExactNumber(r) + cone.slant.value);
    return {
      coneRadius: r,
      coneHeight: h,
      slant: cone.slant,
      sphereRadius: measureApproximate(value, 'Радиус вписанного шара'),
      sphereVolume: measureApproximate((4 / 3) * Math.PI * value ** 3, 'Объём вписанного шара'),
    };
  }
  const rho = divideExact(multiplyExact(r, h), addExact(r, slantExact.coefficient));
  return {
    coneRadius: r,
    coneHeight: h,
    slant: cone.slant,
    sphereRadius: measureFromExact(exactPi(rho, 0)),
    sphereVolume: measureFromExact(exactPi(divideExact(multiplyExact(FOUR, cube(rho)), THREE))),
  };
}

export interface ArchimedesTriple {
  readonly cone: Measure;
  readonly sphere: Measure;
  readonly cylinder: Measure;
  /** Отношение объёмов конуса, шара и цилиндра при общем радиусе и высоте $2R$. */
  readonly ratio: readonly [number, number, number];
}

/** Конус, шар и цилиндр одного радиуса и высоты $2R$ дают объёмы в отношении 1 : 2 : 3. */
export function archimedesTriple(radius: ExactInput): ArchimedesTriple {
  const r = assertPositiveExact(radius, 'Радиус');
  const cone = coneMetrics(r, multiplyExact(TWO, r));
  const sphere = sphereMetrics(r);
  const cylinder = cylinderMetrics(r, multiplyExact(TWO, r));
  const base = (cone.volume.exact as ExactPi).coefficient;
  const share = (volume: Measure) => toExactNumber(divideExact((volume.exact as ExactPi).coefficient, base));
  return {
    cone: cone.volume,
    sphere: sphere.volume,
    cylinder: cylinder.volume,
    ratio: [share(cone.volume), share(sphere.volume), share(cylinder.volume)],
  };
}

/** Единый вход для лаборатории: метрики тела по его виду. */
export function solidMetrics(
  kind: RevolutionKind,
  radius: ExactInput,
  height: ExactInput,
): CylinderMetrics | ConeMetrics | SphereMetrics {
  if (kind === 'cylinder') return cylinderMetrics(radius, height);
  if (kind === 'cone') return coneMetrics(radius, height);
  if (kind === 'sphere') return sphereMetrics(radius);
  throw new RangeError(`Неизвестное тело вращения: ${String(kind)}`);
}

/** Во сколько раз изменятся поверхность и объём при увеличении всех размеров в k раз. */
export function similarityFactors(scale: ExactInput): { readonly area: ExactRational; readonly volume: ExactRational } {
  const k = assertPositiveExact(scale, 'Коэффициент подобия');
  return { area: square(k), volume: cube(k) };
}

// ───────────────────────── честная проекция ─────────────────────────

/** Точка образующей в полуплоскости: расстояние до оси и высота. */
export interface ProfilePoint {
  readonly r: number;
  readonly z: number;
}

/** Точка картинной плоскости; ось y направлена вверх, как в математике. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface Ellipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

/** Угол подъёма наблюдателя по умолчанию. */
export const DEFAULT_ELEVATION_DEGREES = 20;

function assertElevation(elevationDegrees: number): number {
  assertFiniteNumber(elevationDegrees, 'Угол подъёма');
  if (elevationDegrees <= 0 || elevationDegrees >= 90) {
    throw new RangeError('Угол подъёма должен быть строго между 0° и 90°');
  }
  return (elevationDegrees * Math.PI) / 180;
}

/**
 * Параллельная проекция точки тела вращения. Точка задаётся расстоянием до оси
 * $r$, высотой $z$ и углом поворота $\varphi$ вокруг оси:
 *
 * $$x=r\sin\varphi,\qquad y=z\cos\varepsilon-r\sin\varepsilon\cos\varphi.$$
 *
 * Формулы получаются из ортонормированного базиса картинной плоскости, поэтому
 * рисунок честный: параллельные отрезки остаются параллельными, а окружность
 * уровня переходит в эллипс.
 */
export function revolvePoint(
  point: ProfilePoint,
  angleDegrees: number,
  elevationDegrees: number = DEFAULT_ELEVATION_DEGREES,
): ScreenPoint {
  const r = assertFiniteNumber(point?.r, 'Расстояние до оси');
  const z = assertFiniteNumber(point?.z, 'Высота точки');
  if (r < 0) throw new RangeError('Расстояние до оси не может быть отрицательным');
  assertFiniteNumber(angleDegrees, 'Угол поворота');
  const elevation = assertElevation(elevationDegrees);
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: r * Math.sin(angle),
    y: z * Math.cos(elevation) - r * Math.sin(elevation) * Math.cos(angle),
  };
}

/** Проекция всей образующей, повёрнутой на заданный угол. */
export function revolveProfile(
  profile: readonly ProfilePoint[],
  angleDegrees: number,
  elevationDegrees: number = DEFAULT_ELEVATION_DEGREES,
): ScreenPoint[] {
  if (!Array.isArray(profile) || profile.length === 0) {
    throw new RangeError('Образующая должна содержать хотя бы одну точку');
  }
  return profile.map((point) => revolvePoint(point, angleDegrees, elevationDegrees));
}

/**
 * Окружность радиуса $r$ на высоте $z$ переходит в эллипс с полуосями $r$ и
 * $r\sin\varepsilon$; центр эллипса поднят на $z\cos\varepsilon$.
 */
export function levelEllipse(
  radius: number,
  level: number,
  elevationDegrees: number = DEFAULT_ELEVATION_DEGREES,
): Ellipse {
  const r = assertFiniteNumber(radius, 'Радиус окружности');
  if (r < 0) throw new RangeError('Радиус окружности не может быть отрицательным');
  const z = assertFiniteNumber(level, 'Высота окружности');
  const elevation = assertElevation(elevationDegrees);
  return { cx: 0, cy: z * Math.cos(elevation), rx: r, ry: r * Math.sin(elevation) };
}

/**
 * Контур образующей фигуры в полуплоскости. Замыкающий отрезок лежит на оси
 * вращения и в списке не повторяется.
 */
export function revolutionProfile(
  kind: RevolutionKind,
  radius: number,
  height: number,
  samples = 24,
): ProfilePoint[] {
  const r = assertFiniteNumber(radius, 'Радиус');
  const h = assertFiniteNumber(height, 'Высота');
  if (r <= 0) throw new RangeError('Радиус должен быть положительным');
  if (kind !== 'sphere' && h <= 0) throw new RangeError('Высота должна быть положительной');
  if (!Number.isInteger(samples) || samples < 4 || samples > 720) {
    throw new RangeError('Число точек дуги должно быть целым от 4 до 720');
  }

  if (kind === 'cylinder') {
    return [{ r: 0, z: 0 }, { r, z: 0 }, { r, z: h }, { r: 0, z: h }];
  }
  if (kind === 'cone') {
    return [{ r: 0, z: 0 }, { r, z: 0 }, { r: 0, z: h }];
  }
  if (kind !== 'sphere') {
    throw new RangeError(`Неизвестное тело вращения: ${String(kind)}`);
  }
  // Полукруг радиуса r: дуга идёт от северного полюса к южному, ось — диаметр.
  return Array.from({ length: samples + 1 }, (_, index) => {
    const angle = (Math.PI * index) / samples;
    return { r: r * Math.sin(angle), z: r * Math.cos(angle) };
  });
}

/** Наибольшая и наименьшая высота образующей — нужны для подгонки рисунка. */
export function profileExtent(profile: readonly ProfilePoint[]): { readonly minZ: number; readonly maxZ: number; readonly maxR: number } {
  if (!Array.isArray(profile) || profile.length === 0) {
    throw new RangeError('Образующая должна содержать хотя бы одну точку');
  }
  return {
    minZ: Math.min(...profile.map((point) => point.z)),
    maxZ: Math.max(...profile.map((point) => point.z)),
    maxR: Math.max(...profile.map((point) => point.r)),
  };
}

/**
 * Угол касания очерка конуса. Из вершины $(0,h\cos\varepsilon)$ проводятся
 * касательные к эллипсу основания; точка касания отвечает углу $\varphi$, где
 * $\sin\varphi=\dfrac{r\sin\varepsilon}{h\cos\varepsilon}$.
 *
 * Если вершина попадает внутрь эллипса (смотрим на конус почти сверху),
 * касательных нет и функция возвращает `null`.
 */
export function coneOutlineAngleDegrees(
  radius: number,
  height: number,
  elevationDegrees: number = DEFAULT_ELEVATION_DEGREES,
): number | null {
  const r = assertFiniteNumber(radius, 'Радиус конуса');
  const h = assertFiniteNumber(height, 'Высота конуса');
  if (r <= 0 || h <= 0) throw new RangeError('Размеры конуса должны быть положительными');
  const elevation = assertElevation(elevationDegrees);
  const sine = (r * Math.sin(elevation)) / (h * Math.cos(elevation));
  // Допуск отсекает вырожденный случай, когда вершина лежит на самом эллипсе.
  if (!(sine < 1 - 1e-12)) return null;
  return toDegrees(Math.asin(sine));
}

/**
 * Точки касания очерка конуса на картинной плоскости: две симметричные точки
 * основания, в которых боковая поверхность видна «с ребра».
 */
export function coneOutlinePoints(
  radius: number,
  height: number,
  elevationDegrees: number = DEFAULT_ELEVATION_DEGREES,
): readonly ScreenPoint[] {
  const angle = coneOutlineAngleDegrees(radius, height, elevationDegrees);
  if (angle === null) return [];
  return [
    revolvePoint({ r: radius, z: 0 }, 90 + angle, elevationDegrees),
    revolvePoint({ r: radius, z: 0 }, -90 - angle, elevationDegrees),
  ];
}
