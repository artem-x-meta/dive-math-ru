/**
 * Вычислительное ядро главы «Тригонометрия» (10 класс).
 *
 * Три идеи, ради которых написан файл:
 *  1. Табличные значения должны быть ТОЧНЫМИ. Не 0,8660254, а √3⁄2.
 *     Для этого есть тип ExactValue — число вида (k·√r)/d.
 *  2. Угол приводится к одному обороту честно, вместе с числом оборотов.
 *  3. Простейшее уравнение возвращает не одно число, а серию решений
 *     с периодом — так, как это записывают в тетради.
 */

const RADIANS_PER_DEGREE = Math.PI / 180;
const FULL_TURN_DEGREES = 360;
const TAU = 2 * Math.PI;

/* ------------------------------------------------------------------ */
/* Служебные функции                                                   */
/* ------------------------------------------------------------------ */

function roundValue(value: number, digits = 10): number {
  const factor = 10 ** digits;
  const result = Math.round(value * factor) / factor;
  return Object.is(result, -0) ? 0 : result;
}

function greatestCommonDivisor(first: number, second: number): number {
  let left = Math.abs(first);
  let right = Math.abs(second);
  while (right > 0) {
    [left, right] = [right, left % right];
  }
  return left;
}

function assertFiniteNumber(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label}: нужно конечное число`);
  }
  return value;
}

function assertInteger(value: number, label: string): number {
  assertFiniteNumber(value, label);
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label}: нужно целое число`);
  }
  return value;
}

/** Десятичная запись для KaTeX: запятая вместо точки, без хвостовых нулей. */
export function formatDecimalLatex(value: number, digits = 3): string {
  assertFiniteNumber(value, 'Число');
  const rounded = roundValue(value, digits);
  const text = String(rounded);
  return text.includes('.') ? text.replace('.', '{,}') : text;
}

/** Десятичная запись для обычного текста: −0,5 вместо -0.5. */
export function formatDecimalPlain(value: number, digits = 3): string {
  assertFiniteNumber(value, 'Число');
  return String(roundValue(value, digits)).replace('-', '−').replace('.', ',');
}

/**
 * Выносит множитель из-под корня: √12 = 2√3. Возвращает пару
 * «множитель снаружи» и «то, что осталось под корнем».
 */
export function simplifyRadical(radicand: number): { readonly outside: number; readonly inside: number } {
  assertInteger(radicand, 'Подкоренное выражение');
  if (radicand < 1) {
    throw new RangeError('Подкоренное выражение: нужно натуральное число');
  }
  for (let factor = Math.floor(Math.sqrt(radicand)); factor >= 1; factor -= 1) {
    if (radicand % (factor * factor) === 0) {
      return { outside: factor, inside: radicand / (factor * factor) };
    }
  }
  return { outside: 1, inside: radicand };
}

/* ------------------------------------------------------------------ */
/* Точное значение вида (k·√r)/d                                       */
/* ------------------------------------------------------------------ */

/** Точное число вида (numerator·√radicand)/denominator, дробь несократима. */
export interface ExactValue {
  readonly numerator: number;
  readonly radicand: number;
  readonly denominator: number;
  /** Запись для KaTeX, например \frac{\sqrt{3}}{2}. */
  readonly latex: string;
  /** Запись для обычного текста, например √3⁄2. */
  readonly plain: string;
  /** Десятичное приближение. */
  readonly value: number;
}

function exactLatex(numerator: number, radicand: number, denominator: number): string {
  if (numerator === 0) return '0';
  const sign = numerator < 0 ? '-' : '';
  const size = Math.abs(numerator);
  const top = radicand === 1
    ? String(size)
    : size === 1 ? `\\sqrt{${radicand}}` : `${size}\\sqrt{${radicand}}`;
  return denominator === 1 ? `${sign}${top}` : `${sign}\\frac{${top}}{${denominator}}`;
}

function exactPlain(numerator: number, radicand: number, denominator: number): string {
  if (numerator === 0) return '0';
  const sign = numerator < 0 ? '−' : '';
  const size = Math.abs(numerator);
  const top = radicand === 1 ? String(size) : size === 1 ? `√${radicand}` : `${size}√${radicand}`;
  return denominator === 1 ? `${sign}${top}` : `${sign}${top}/${denominator}`;
}

/** Собирает несократимое точное значение (k·√r)/d и сразу готовит обе записи. */
export function makeExactValue(numerator: number, radicand: number, denominator: number): ExactValue {
  assertInteger(numerator, 'Числитель');
  assertInteger(radicand, 'Подкоренное выражение');
  assertInteger(denominator, 'Знаменатель');
  if (denominator === 0) throw new RangeError('Знаменатель не может быть равен нулю');
  if (radicand < 1) throw new RangeError('Подкоренное выражение: нужно натуральное число');

  const { outside, inside } = simplifyRadical(radicand);
  let top = numerator * outside;
  let bottom = denominator;

  if (top === 0) {
    return { numerator: 0, radicand: 1, denominator: 1, latex: '0', plain: '0', value: 0 };
  }
  if (bottom < 0) {
    top = -top;
    bottom = -bottom;
  }
  const divisor = greatestCommonDivisor(top, bottom);
  top /= divisor;
  bottom /= divisor;

  return {
    numerator: top,
    radicand: inside,
    denominator: bottom,
    latex: exactLatex(top, inside, bottom),
    plain: exactPlain(top, inside, bottom),
    value: roundValue((top * Math.sqrt(inside)) / bottom),
  };
}

/** Произведение двух точных значений остаётся точным значением того же вида. */
export function multiplyExactValues(left: ExactValue, right: ExactValue): ExactValue {
  return makeExactValue(
    left.numerator * right.numerator,
    left.radicand * right.radicand,
    left.denominator * right.denominator,
  );
}

/** Обратное значение: 1 / ((k√r)/d) = d√r / (k·r). */
export function invertExactValue(value: ExactValue): ExactValue {
  if (value.numerator === 0) throw new RangeError('Нельзя обратить нулевое значение');
  return makeExactValue(value.denominator, value.radicand, value.numerator * value.radicand);
}

/** Частное двух точных значений. */
export function divideExactValues(left: ExactValue, right: ExactValue): ExactValue {
  return multiplyExactValues(left, invertExactValue(right));
}

/* ------------------------------------------------------------------ */
/* Приведение угла к окружности                                        */
/* ------------------------------------------------------------------ */

/** Приводит угол к промежутку [0°; 360°). */
export function normalizeDegrees(degrees: number): number {
  assertFiniteNumber(degrees, 'Угол');
  const remainder = degrees % FULL_TURN_DEGREES;
  return roundValue(remainder < 0 ? remainder + FULL_TURN_DEGREES : remainder, 10);
}

/** Сколько полных оборотов отброшено при приведении. Для −30° это −1. */
export function fullTurns(degrees: number): number {
  assertFiniteNumber(degrees, 'Угол');
  return Math.floor(roundValue(degrees / FULL_TURN_DEGREES, 12));
}

/** Приводит угол в радианах к промежутку [0; 2π). */
export function normalizeRadians(radians: number): number {
  assertFiniteNumber(radians, 'Угол');
  const remainder = radians % TAU;
  return roundValue(remainder < 0 ? remainder + TAU : remainder, 12);
}

/** Градусы в радианы. */
export function degreesToRadians(degrees: number): number {
  assertFiniteNumber(degrees, 'Угол');
  return roundValue(degrees * RADIANS_PER_DEGREE, 12);
}

/** Радианы в градусы. */
export function radiansToDegrees(radians: number): number {
  assertFiniteNumber(radians, 'Угол');
  return roundValue(radians / RADIANS_PER_DEGREE, 10);
}

/**
 * Номер четверти для угла: 1, 2, 3 или 4. Ноль означает, что точка попала
 * на ось координат и ни к какой четверти не относится.
 */
export function quadrantOfDegrees(degrees: number): 0 | 1 | 2 | 3 | 4 {
  const normalized = normalizeDegrees(degrees);
  if (normalized % 90 === 0) return 0;
  if (normalized < 90) return 1;
  if (normalized < 180) return 2;
  if (normalized < 270) return 3;
  return 4;
}

/** Острый угол между радиусом и осью абсцисс: от 0° до 90°. */
export function referenceAngleDegrees(degrees: number): number {
  const normalized = normalizeDegrees(degrees);
  if (normalized <= 90) return normalized;
  if (normalized <= 180) return roundValue(180 - normalized, 10);
  if (normalized <= 270) return roundValue(normalized - 180, 10);
  return roundValue(FULL_TURN_DEGREES - normalized, 10);
}

/** Знаки синуса, косинуса и тангенса в четверти: +1 или −1. */
export function signsInQuadrant(quadrant: 1 | 2 | 3 | 4): {
  readonly sine: 1 | -1;
  readonly cosine: 1 | -1;
  readonly tangent: 1 | -1;
} {
  switch (quadrant) {
    case 1: return { sine: 1, cosine: 1, tangent: 1 };
    case 2: return { sine: 1, cosine: -1, tangent: -1 };
    case 3: return { sine: -1, cosine: -1, tangent: 1 };
    case 4: return { sine: -1, cosine: 1, tangent: -1 };
    default: throw new RangeError('Номер четверти лежит от 1 до 4');
  }
}

/* ------------------------------------------------------------------ */
/* Табличные значения                                                  */
/* ------------------------------------------------------------------ */

type ExactTriple = readonly [number, number, number];

/** Синусы углов, кратных 30° и 45°, в виде (k·√r)/d. */
const TABLE_SINE: Readonly<Record<number, ExactTriple>> = {
  0: [0, 1, 1],
  30: [1, 1, 2],
  45: [1, 2, 2],
  60: [1, 3, 2],
  90: [1, 1, 1],
  120: [1, 3, 2],
  135: [1, 2, 2],
  150: [1, 1, 2],
  180: [0, 1, 1],
  210: [-1, 1, 2],
  225: [-1, 2, 2],
  240: [-1, 3, 2],
  270: [-1, 1, 1],
  300: [-1, 3, 2],
  315: [-1, 2, 2],
  330: [-1, 1, 2],
};

/** Верно ли, что угол попадает в таблицу точных значений. */
export function isTableAngle(degrees: number): boolean {
  const normalized = normalizeDegrees(degrees);
  return Object.prototype.hasOwnProperty.call(TABLE_SINE, normalized);
}

/** Точный синус табличного угла; для остальных углов — null. */
export function exactSine(degrees: number): ExactValue | null {
  const triple = TABLE_SINE[normalizeDegrees(degrees)];
  return triple === undefined ? null : makeExactValue(triple[0], triple[1], triple[2]);
}

/** Точный косинус табличного угла: cos α = sin(90° − α). */
export function exactCosine(degrees: number): ExactValue | null {
  return exactSine(90 - normalizeDegrees(degrees));
}

/** Точный тангенс табличного угла; null, если угол нетабличный или тангенса нет. */
export function exactTangent(degrees: number): ExactValue | null {
  const sine = exactSine(degrees);
  const cosine = exactCosine(degrees);
  if (sine === null || cosine === null || cosine.numerator === 0) return null;
  return divideExactValues(sine, cosine);
}

/** Синус числа, заданного углом в градусах. Табличные углы дают точный ответ. */
export function sineOf(degrees: number): number {
  const exact = exactSine(degrees);
  return exact === null ? roundValue(Math.sin(degrees * RADIANS_PER_DEGREE)) : exact.value;
}

/** Косинус числа, заданного углом в градусах. */
export function cosineOf(degrees: number): number {
  const exact = exactCosine(degrees);
  return exact === null ? roundValue(Math.cos(degrees * RADIANS_PER_DEGREE)) : exact.value;
}

/** Тангенс; null для углов 90° + 180°·k, где тангенс не определён. */
export function tangentOf(degrees: number): number | null {
  const normalized = normalizeDegrees(degrees);
  if (normalized === 90 || normalized === 270) return null;
  const exact = exactTangent(degrees);
  if (exact !== null) return exact.value;
  return roundValue(Math.tan(degrees * RADIANS_PER_DEGREE));
}

/** Точка единичной окружности, отвечающая углу поворота. */
export interface CirclePoint {
  readonly x: number;
  readonly y: number;
  readonly degrees: number;
  readonly radians: number;
  readonly quadrant: 0 | 1 | 2 | 3 | 4;
}

/** Координаты точки поворота: x = cos α, y = sin α. */
export function unitCirclePoint(degrees: number): CirclePoint {
  const normalized = normalizeDegrees(degrees);
  return {
    x: cosineOf(normalized),
    y: sineOf(normalized),
    degrees: normalized,
    radians: degreesToRadians(normalized),
    quadrant: quadrantOfDegrees(normalized),
  };
}

/* ------------------------------------------------------------------ */
/* Тождества                                                           */
/* ------------------------------------------------------------------ */

/** Значение sin²α + cos²α. По основному тождеству обязано равняться единице. */
export function pythagoreanIdentity(degrees: number): number {
  const sine = sineOf(degrees);
  const cosine = cosineOf(degrees);
  // Девять знаков: синус и косинус уже округлены до десятого, и их квадраты
  // складывают погрешности. На девятом знаке тождество выполняется ровно.
  return roundValue(sine * sine + cosine * cosine, 9);
}

/** Синус по косинусу и номеру четверти: знак берётся из четверти. */
export function sineFromCosine(cosine: number, quadrant: 1 | 2 | 3 | 4): number {
  assertFiniteNumber(cosine, 'Косинус');
  if (Math.abs(cosine) > 1) throw new RangeError('Косинус лежит на отрезке [−1; 1]');
  return roundValue(signsInQuadrant(quadrant).sine * Math.sqrt(1 - cosine * cosine));
}

/** Косинус по синусу и номеру четверти. */
export function cosineFromSine(sine: number, quadrant: 1 | 2 | 3 | 4): number {
  assertFiniteNumber(sine, 'Синус');
  if (Math.abs(sine) > 1) throw new RangeError('Синус лежит на отрезке [−1; 1]');
  return roundValue(signsInQuadrant(quadrant).cosine * Math.sqrt(1 - sine * sine));
}

/** Тангенс через синус и косинус; null, если косинус равен нулю. */
export function tangentFromRatio(sine: number, cosine: number): number | null {
  assertFiniteNumber(sine, 'Синус');
  assertFiniteNumber(cosine, 'Косинус');
  return cosine === 0 ? null : roundValue(sine / cosine);
}

/* ------------------------------------------------------------------ */
/* Формулы сложения и следствия (углы в градусах)                      */
/* ------------------------------------------------------------------ */

/** sin(α + β) = sin α·cos β + cos α·sin β. */
export function sineOfSum(alpha: number, beta: number): number {
  return roundValue(sineOf(alpha) * cosineOf(beta) + cosineOf(alpha) * sineOf(beta));
}

/** sin(α − β) = sin α·cos β − cos α·sin β. */
export function sineOfDifference(alpha: number, beta: number): number {
  return roundValue(sineOf(alpha) * cosineOf(beta) - cosineOf(alpha) * sineOf(beta));
}

/** cos(α + β) = cos α·cos β − sin α·sin β. */
export function cosineOfSum(alpha: number, beta: number): number {
  return roundValue(cosineOf(alpha) * cosineOf(beta) - sineOf(alpha) * sineOf(beta));
}

/** cos(α − β) = cos α·cos β + sin α·sin β. */
export function cosineOfDifference(alpha: number, beta: number): number {
  return roundValue(cosineOf(alpha) * cosineOf(beta) + sineOf(alpha) * sineOf(beta));
}

/** sin 2α = 2·sin α·cos α. */
export function doubleAngleSine(alpha: number): number {
  return roundValue(2 * sineOf(alpha) * cosineOf(alpha));
}

/** cos 2α = cos²α − sin²α. */
export function doubleAngleCosine(alpha: number): number {
  const sine = sineOf(alpha);
  const cosine = cosineOf(alpha);
  return roundValue(cosine * cosine - sine * sine);
}

/* ------------------------------------------------------------------ */
/* Доли числа π                                                        */
/* ------------------------------------------------------------------ */

/** Число вида (numerator·π)/denominator с несократимой дробью. */
export interface PiFraction {
  readonly numerator: number;
  readonly denominator: number;
}

/** Собирает несократимую долю π; знак хранится в числителе. */
export function piFraction(numerator: number, denominator: number): PiFraction {
  assertInteger(numerator, 'Числитель');
  assertInteger(denominator, 'Знаменатель');
  if (denominator === 0) throw new RangeError('Знаменатель не может быть равен нулю');
  if (numerator === 0) return { numerator: 0, denominator: 1 };
  const sign = denominator < 0 ? -1 : 1;
  const divisor = greatestCommonDivisor(numerator, denominator);
  return { numerator: (sign * numerator) / divisor, denominator: (sign * denominator) / divisor };
}

/** Разность долей π. */
export function subtractPiFractions(left: PiFraction, right: PiFraction): PiFraction {
  return piFraction(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

/** Целый угол в градусах — это всегда точная доля π. Нецелый даёт null. */
export function piFractionFromDegrees(degrees: number): PiFraction | null {
  assertFiniteNumber(degrees, 'Угол');
  return Number.isInteger(degrees) ? piFraction(degrees, 180) : null;
}

/** Запись доли π для KaTeX: \frac{5\pi}{6}. */
export function formatPiFractionLatex(fraction: PiFraction): string {
  const { numerator, denominator } = piFraction(fraction.numerator, fraction.denominator);
  if (numerator === 0) return '0';
  const sign = numerator < 0 ? '-' : '';
  const size = Math.abs(numerator);
  const top = size === 1 ? '\\pi' : `${size}\\pi`;
  return denominator === 1 ? `${sign}${top}` : `${sign}\\frac{${top}}{${denominator}}`;
}

/** Запись доли π обычным текстом: 5π/6. */
export function formatPiFractionPlain(fraction: PiFraction): string {
  const { numerator, denominator } = piFraction(fraction.numerator, fraction.denominator);
  if (numerator === 0) return '0';
  const sign = numerator < 0 ? '−' : '';
  const size = Math.abs(numerator);
  const top = size === 1 ? 'π' : `${size}π`;
  return denominator === 1 ? `${sign}${top}` : `${sign}${top}/${denominator}`;
}

/* ------------------------------------------------------------------ */
/* Арксинус, арккосинус, арктангенс                                    */
/* ------------------------------------------------------------------ */

/** Угол с известной записью: числом, в градусах и, если повезло, долей π. */
export interface AngleValue {
  readonly radians: number;
  readonly degrees: number;
  readonly piFraction: PiFraction | null;
  readonly latex: string;
  readonly plain: string;
}

function angleFromPiFraction(fraction: PiFraction): AngleValue {
  const reduced = piFraction(fraction.numerator, fraction.denominator);
  return {
    radians: roundValue((reduced.numerator * Math.PI) / reduced.denominator, 12),
    degrees: roundValue((reduced.numerator * 180) / reduced.denominator, 10),
    piFraction: reduced,
    latex: formatPiFractionLatex(reduced),
    plain: formatPiFractionPlain(reduced),
  };
}

function angleFromRadians(radians: number, latex: string, plain: string): AngleValue {
  return {
    radians: roundValue(radians, 12),
    degrees: radiansToDegrees(radians),
    piFraction: null,
    latex,
    plain,
  };
}

const ARCSIN_TABLE: readonly (readonly [number, number])[] = [-90, -60, -45, -30, 0, 30, 45, 60, 90]
  .map((degrees) => [sineOf(degrees), degrees] as const);

const ARCCOS_TABLE: readonly (readonly [number, number])[] = [0, 30, 45, 60, 90, 120, 135, 150, 180]
  .map((degrees) => [cosineOf(degrees), degrees] as const);

const ARCTAN_TABLE: readonly (readonly [number, number])[] = [-60, -45, -30, 0, 30, 45, 60]
  .map((degrees) => [tangentOf(degrees) as number, degrees] as const);

function matchTable(table: readonly (readonly [number, number])[], value: number): number | null {
  const found = table.find(([candidate]) => Math.abs(candidate - value) < 1e-9);
  return found === undefined ? null : found[1];
}

/** Арксинус: угол из [−π/2; π/2], точный для табличных значений. */
export function arcsineAngle(value: number): AngleValue {
  assertFiniteNumber(value, 'Значение синуса');
  if (Math.abs(value) > 1) throw new RangeError('Синус лежит на отрезке [−1; 1]');
  const degrees = matchTable(ARCSIN_TABLE, value);
  if (degrees !== null) return angleFromPiFraction(piFraction(degrees, 180));
  return angleFromRadians(
    Math.asin(value),
    `\\arcsin ${formatDecimalLatex(value)}`,
    `arcsin ${formatDecimalPlain(value)}`,
  );
}

/** Арккосинус: угол из [0; π], точный для табличных значений. */
export function arccosineAngle(value: number): AngleValue {
  assertFiniteNumber(value, 'Значение косинуса');
  if (Math.abs(value) > 1) throw new RangeError('Косинус лежит на отрезке [−1; 1]');
  const degrees = matchTable(ARCCOS_TABLE, value);
  if (degrees !== null) return angleFromPiFraction(piFraction(degrees, 180));
  return angleFromRadians(
    Math.acos(value),
    `\\arccos ${formatDecimalLatex(value)}`,
    `arccos ${formatDecimalPlain(value)}`,
  );
}

/** Арктангенс: угол из (−π/2; π/2), точный для табличных значений. */
export function arctangentAngle(value: number): AngleValue {
  assertFiniteNumber(value, 'Значение тангенса');
  const degrees = matchTable(ARCTAN_TABLE, value);
  if (degrees !== null) return angleFromPiFraction(piFraction(degrees, 180));
  return angleFromRadians(
    Math.atan(value),
    `\\operatorname{arctg} ${formatDecimalLatex(value)}`,
    `arctg ${formatDecimalPlain(value)}`,
  );
}

/* ------------------------------------------------------------------ */
/* Простейшие уравнения и серии решений                                */
/* ------------------------------------------------------------------ */

export type TrigFunctionKind = 'sin' | 'cos' | 'tg';

/** Одна серия решений: базовый угол плюс целое число периодов. */
export interface SolutionSeries {
  readonly base: AngleValue;
  readonly period: PiFraction;
  /** Запись серии для KaTeX, например x = \frac{\pi}{6} + 2\pi n. */
  readonly latex: string;
  /** Запись серии обычным текстом, например x = π/6 + 2πn. */
  readonly plain: string;
}

/** Полный ответ простейшего уравнения. */
export interface EquationSolution {
  readonly kind: TrigFunctionKind;
  readonly right: number;
  readonly solvable: boolean;
  readonly series: readonly SolutionSeries[];
  /** Свёрнутая запись всех серий одной формулой. */
  readonly combinedLatex: string;
  readonly note: string;
}

function periodTermLatex(period: PiFraction): string {
  const reduced = piFraction(period.numerator, period.denominator);
  const size = Math.abs(reduced.numerator);
  const top = size === 1 ? '\\pi n' : `${size}\\pi n`;
  return reduced.denominator === 1 ? top : `\\frac{${top}}{${reduced.denominator}}`;
}

function periodTermPlain(period: PiFraction): string {
  const reduced = piFraction(period.numerator, period.denominator);
  const size = Math.abs(reduced.numerator);
  const top = size === 1 ? 'πn' : `${size}πn`;
  return reduced.denominator === 1 ? top : `${top}/${reduced.denominator}`;
}

function makeSeries(base: AngleValue, period: PiFraction): SolutionSeries {
  const latexPeriod = periodTermLatex(period);
  const plainPeriod = periodTermPlain(period);
  return {
    base,
    period: piFraction(period.numerator, period.denominator),
    latex: base.radians === 0 ? `x = ${latexPeriod}` : `x = ${base.latex} + ${latexPeriod}`,
    plain: base.radians === 0 ? `x = ${plainPeriod}` : `x = ${base.plain} + ${plainPeriod}`,
  };
}

const PERIOD_FULL: PiFraction = { numerator: 2, denominator: 1 };
const PERIOD_HALF: PiFraction = { numerator: 1, denominator: 1 };

function supplementAngle(base: AngleValue): AngleValue {
  if (base.piFraction !== null) {
    return angleFromPiFraction(subtractPiFractions({ numerator: 1, denominator: 1 }, base.piFraction));
  }
  return angleFromRadians(Math.PI - base.radians, `\\pi - ${base.latex}`, `π − ${base.plain}`);
}

function negateAngle(base: AngleValue): AngleValue {
  if (base.piFraction !== null) {
    return angleFromPiFraction(piFraction(-base.piFraction.numerator, base.piFraction.denominator));
  }
  return angleFromRadians(-base.radians, `-${base.latex}`, `−${base.plain}`);
}

function noSolutions(kind: TrigFunctionKind, right: number): EquationSolution {
  return {
    kind,
    right: roundValue(right, 12),
    solvable: false,
    series: [],
    combinedLatex: '\\varnothing',
    note: `Значения ${kind === 'sin' ? 'синуса' : 'косинуса'} лежат на отрезке [−1; 1], поэтому корней нет.`,
  };
}

/** Решает sin x = a и возвращает серии решений. */
export function solveSineEquation(right: number): EquationSolution {
  assertFiniteNumber(right, 'Правая часть');
  if (Math.abs(right) > 1) return noSolutions('sin', right);

  const value = roundValue(right, 12);
  if (value === 1) {
    return {
      kind: 'sin', right: value, solvable: true,
      series: [makeSeries(angleFromPiFraction(piFraction(1, 2)), PERIOD_FULL)],
      combinedLatex: 'x = \\frac{\\pi}{2} + 2\\pi n',
      note: 'Синус достигает единицы только в верхней точке окружности, поэтому серия одна.',
    };
  }
  if (value === -1) {
    return {
      kind: 'sin', right: value, solvable: true,
      series: [makeSeries(angleFromPiFraction(piFraction(-1, 2)), PERIOD_FULL)],
      combinedLatex: 'x = -\\frac{\\pi}{2} + 2\\pi n',
      note: 'Синус равен −1 только в нижней точке окружности, поэтому серия одна.',
    };
  }
  if (value === 0) {
    return {
      kind: 'sin', right: 0, solvable: true,
      series: [makeSeries(angleFromPiFraction(piFraction(0, 1)), PERIOD_HALF)],
      combinedLatex: 'x = \\pi n',
      note: 'Ординату ноль дают обе точки на оси абсцисс, а они отличаются ровно на π.',
    };
  }

  const base = arcsineAngle(value);
  return {
    kind: 'sin', right: value, solvable: true,
    series: [makeSeries(base, PERIOD_FULL), makeSeries(supplementAngle(base), PERIOD_FULL)],
    combinedLatex: `x = (-1)^n ${base.latex} + \\pi n`,
    note: 'Горизонтальная прямая пересекает окружность в двух точках, симметричных относительно оси ординат.',
  };
}

/** Решает cos x = a и возвращает серии решений. */
export function solveCosineEquation(right: number): EquationSolution {
  assertFiniteNumber(right, 'Правая часть');
  if (Math.abs(right) > 1) return noSolutions('cos', right);

  const value = roundValue(right, 12);
  if (value === 1) {
    return {
      kind: 'cos', right: 1, solvable: true,
      series: [makeSeries(angleFromPiFraction(piFraction(0, 1)), PERIOD_FULL)],
      combinedLatex: 'x = 2\\pi n',
      note: 'Косинус равен единице только в правой точке окружности, поэтому серия одна.',
    };
  }
  if (value === -1) {
    return {
      kind: 'cos', right: -1, solvable: true,
      series: [makeSeries(angleFromPiFraction(piFraction(1, 1)), PERIOD_FULL)],
      combinedLatex: 'x = \\pi + 2\\pi n',
      note: 'Косинус равен −1 только в левой точке окружности, поэтому серия одна.',
    };
  }
  if (value === 0) {
    return {
      kind: 'cos', right: 0, solvable: true,
      series: [makeSeries(angleFromPiFraction(piFraction(1, 2)), PERIOD_HALF)],
      combinedLatex: 'x = \\frac{\\pi}{2} + \\pi n',
      note: 'Абсциссу ноль дают обе точки на оси ординат, а они отличаются ровно на π.',
    };
  }

  const base = arccosineAngle(value);
  return {
    kind: 'cos', right: value, solvable: true,
    series: [makeSeries(base, PERIOD_FULL), makeSeries(negateAngle(base), PERIOD_FULL)],
    combinedLatex: `x = \\pm${base.latex} + 2\\pi n`,
    note: 'Вертикальная прямая пересекает окружность в двух точках, симметричных относительно оси абсцисс.',
  };
}

/** Решает tg x = a. Решения есть при любом a, серия всегда одна. */
export function solveTangentEquation(right: number): EquationSolution {
  assertFiniteNumber(right, 'Правая часть');
  const value = roundValue(right, 12);
  const base = arctangentAngle(value);
  return {
    kind: 'tg', right: value, solvable: true,
    series: [makeSeries(base, PERIOD_HALF)],
    combinedLatex: value === 0 ? 'x = \\pi n' : `x = ${base.latex} + \\pi n`,
    note: 'Период тангенса равен π, поэтому серия ровно одна при любой правой части.',
  };
}

/** Решает простейшее уравнение выбранного вида. */
export function solveSimpleEquation(kind: TrigFunctionKind, right: number): EquationSolution {
  if (kind === 'sin') return solveSineEquation(right);
  if (kind === 'cos') return solveCosineEquation(right);
  if (kind === 'tg') return solveTangentEquation(right);
  throw new RangeError('Неизвестный вид уравнения');
}

/** Значение серии при данном номере n. */
export function seriesValue(series: SolutionSeries, index: number): number {
  assertInteger(index, 'Номер серии');
  const period = (series.period.numerator * Math.PI) / series.period.denominator;
  return roundValue(series.base.radians + period * index, 10);
}

/**
 * Все корни уравнения на полуинтервале [from; to). Именно этот отбор
 * и требуется в задачах вида «найдите корни, принадлежащие отрезку».
 */
export function solutionsInInterval(solution: EquationSolution, from: number, to: number): readonly number[] {
  assertFiniteNumber(from, 'Левый конец промежутка');
  assertFiniteNumber(to, 'Правый конец промежутка');
  if (from >= to) throw new RangeError('Левый конец промежутка должен быть меньше правого');

  const found: number[] = [];
  for (const series of solution.series) {
    const period = (series.period.numerator * Math.PI) / series.period.denominator;
    const first = Math.floor((from - series.base.radians) / period) - 1;
    const last = Math.ceil((to - series.base.radians) / period) + 1;
    for (let index = first; index <= last; index += 1) {
      const value = seriesValue(series, index);
      if (value >= from - 1e-9 && value < to - 1e-9) found.push(value);
    }
  }
  return [...new Set(found)].sort((left, right) => left - right);
}

/* ------------------------------------------------------------------ */
/* Графики                                                             */
/* ------------------------------------------------------------------ */

/** Точка графика; значение равно null там, где функция не определена. */
export interface WavePoint {
  readonly t: number;
  readonly value: number | null;
}

/** Период функции в радианах: 2π у синуса и косинуса, π у тангенса. */
export function periodOf(kind: TrigFunctionKind): number {
  if (kind === 'sin' || kind === 'cos') return roundValue(TAU, 12);
  if (kind === 'tg') return roundValue(Math.PI, 12);
  throw new RangeError('Неизвестный вид функции');
}

/** Значение функции от числа (аргумент в радианах); null там, где её нет. */
export function waveValue(kind: TrigFunctionKind, t: number): number | null {
  assertFiniteNumber(t, 'Аргумент');
  if (kind === 'sin') return roundValue(Math.sin(t), 12);
  if (kind === 'cos') return roundValue(Math.cos(t), 12);
  if (kind === 'tg') {
    const cosine = Math.cos(t);
    return Math.abs(cosine) < 1e-9 ? null : roundValue(Math.tan(t), 12);
  }
  throw new RangeError('Неизвестный вид функции');
}

/** Равномерная выборка точек графика — материал для ломаной в SVG. */
export function waveSamples(
  kind: TrigFunctionKind,
  from: number,
  to: number,
  count: number,
): readonly WavePoint[] {
  assertFiniteNumber(from, 'Левый конец');
  assertFiniteNumber(to, 'Правый конец');
  assertInteger(count, 'Число точек');
  if (from >= to) throw new RangeError('Левый конец должен быть меньше правого');
  if (count < 2) throw new RangeError('Точек должно быть хотя бы две');

  return Array.from({ length: count }, (_, index) => {
    const t = from + ((to - from) * index) / (count - 1);
    return { t: roundValue(t, 12), value: waveValue(kind, t) };
  });
}
