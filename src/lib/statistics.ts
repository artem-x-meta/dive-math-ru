export interface FrequencyRow {
  value: number;
  count: number;
  relativeFrequency: number;
}

export interface IntervalRow {
  from: number;
  to: number;
  count: number;
  relativeFrequency: number;
}

export interface SampleSummary {
  /** Объём выборки. */
  count: number;
  minimum: number;
  maximum: number;
  mean: number;
  median: number;
  range: number;
}

/** Внутреннее точное представление конечной десятичной дроби: value = units / scale. */
interface ScaledDecimal {
  units: bigint;
  scale: bigint;
}

const MAXIMUM_TRIALS = 100_000;

function assertFiniteNumber(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} должно быть конечным числом`);
  }
}

function assertNonEmptySample(values: readonly number[], label: string): void {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RangeError(`${label}: нужен хотя бы один элемент данных`);
  }
  values.forEach((value, index) => assertFiniteNumber(value, `${label}: элемент №${index + 1}`));
}

function toSafeNumber(value: bigint, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${label} выходит за диапазон безопасных целых чисел`);
  }
  return result;
}

/** Разбирает конечное десятичное число в пару «целые единицы / степень десяти» без потери точности. */
function toScaledDecimal(value: number, label: string): ScaledDecimal {
  assertFiniteNumber(value, label);
  if (value === 0) return { units: 0n, scale: 1n };

  const [coefficient, exponentText = '0'] = value.toString().toLowerCase().split('e');
  const exponent = Number(exponentText);
  const negative = coefficient.startsWith('-');
  const unsigned = negative ? coefficient.slice(1) : coefficient;
  const [integerPart, fractionalPart = ''] = unsigned.split('.');
  let units = BigInt(`${integerPart}${fractionalPart}`);
  let scale = 10n ** BigInt(fractionalPart.length);

  if (exponent > 0) units *= 10n ** BigInt(exponent);
  if (exponent < 0) scale *= 10n ** BigInt(-exponent);
  if (negative) units = -units;

  return { units, scale };
}

/** Приводит выборку к общему знаменателю-степени десяти. */
function toCommonScale(values: readonly number[], label: string): { units: bigint[]; scale: bigint } {
  const scaled = values.map((value, index) => toScaledDecimal(value, `${label}: элемент №${index + 1}`));
  const scale = scaled.reduce((maximum, item) => (item.scale > maximum ? item.scale : maximum), 1n);
  return {
    units: scaled.map((item) => item.units * (scale / item.scale)),
    scale,
  };
}

function scaledToNumber(units: bigint, scale: bigint, label: string): number {
  return toSafeNumber(units, label) / toSafeNumber(scale, `${label}: знаменатель`);
}

/** Округляет число до указанного количества знаков после запятой, гася двоичный шум. */
export function roundTo(value: number, digits: number): number {
  assertFiniteNumber(value, 'Округляемое значение');
  if (!Number.isInteger(digits) || digits < 0 || digits > 12) {
    throw new RangeError('Количество знаков после запятой должно быть целым от 0 до 12');
  }
  const factor = 10 ** digits;
  return Math.round((value + Math.sign(value) * Number.EPSILON) * factor) / factor;
}

/** Среднее арифметическое: сумма считается точно, деление выполняется в конце. */
export function mean(values: readonly number[]): number {
  assertNonEmptySample(values, 'Среднее арифметическое');
  const { units, scale } = toCommonScale(values, 'Среднее арифметическое');
  const sum = units.reduce((total, item) => total + item, 0n);
  return scaledToNumber(sum, scale * BigInt(values.length), 'Сумма данных');
}

/** Медиана: серединное значение упорядоченного ряда; при чётном объёме — среднее двух серединных. */
export function median(values: readonly number[]): number {
  assertNonEmptySample(values, 'Медиана');
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return mean([sorted[middle - 1]!, sorted[middle]!]);
}

/** Размах: разность наибольшего и наименьшего значения, вычисленная точно. */
export function range(values: readonly number[]): number {
  assertNonEmptySample(values, 'Размах');
  const { units, scale } = toCommonScale(values, 'Размах');
  const maximum = units.reduce((best, item) => (item > best ? item : best), units[0]!);
  const minimum = units.reduce((best, item) => (item < best ? item : best), units[0]!);
  return scaledToNumber(maximum - minimum, scale, 'Размах');
}

/** Все характеристики одной выборки сразу: объём, границы, центр и разброс. */
export function sampleSummary(values: readonly number[]): SampleSummary {
  assertNonEmptySample(values, 'Сводка по данным');
  const { units, scale } = toCommonScale(values, 'Сводка по данным');
  const largest = units.reduce((best, item) => (item > best ? item : best), units[0]!);
  const smallest = units.reduce((best, item) => (item < best ? item : best), units[0]!);
  return {
    count: values.length,
    minimum: scaledToNumber(smallest, scale, 'Наименьшее значение'),
    maximum: scaledToNumber(largest, scale, 'Наибольшее значение'),
    mean: mean(values),
    median: median(values),
    range: range(values),
  };
}

/**
 * Верхняя граница шкалы диаграммы: ближайшее «круглое» число вида
 * 1, 2, 2{,}5 или 5, умноженное на степень десяти, не меньшее максимума данных.
 */
export function chartAxisMaximum(maximum: number): number {
  assertFiniteNumber(maximum, 'Максимум данных');
  if (maximum <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(maximum));
  for (const factor of [1, 2, 2.5, 5]) {
    const candidate = roundTo(factor * power, 9);
    if (candidate >= maximum) return candidate;
  }
  return roundTo(10 * power, 9);
}

/**
 * Частоты исходов опыта с номерами от 1 до outcomeCount.
 * В отличие от таблицы частот, ни один исход не пропадает: не выпавший
 * исход остаётся в таблице с частотой 0 — иначе диаграмма обманывает.
 */
export function countOutcomes(outcomes: readonly number[], outcomeCount: number): FrequencyRow[] {
  if (!Array.isArray(outcomes)) throw new TypeError('Нужен массив исходов серии');
  if (!Number.isInteger(outcomeCount) || outcomeCount < 2 || outcomeCount > 1_000) {
    throw new RangeError('Число исходов должно быть целым от 2 до 1000');
  }
  const counts = new Array<number>(outcomeCount).fill(0);
  outcomes.forEach((outcome, index) => {
    if (!Number.isInteger(outcome) || outcome < 1 || outcome > outcomeCount) {
      throw new RangeError(`Исход №${index + 1} должен быть целым числом от 1 до ${outcomeCount}`);
    }
    counts[outcome - 1] = (counts[outcome - 1] ?? 0) + 1;
  });
  return counts.map((count, index) => ({
    value: index + 1,
    count,
    relativeFrequency: outcomes.length === 0 ? 0 : count / outcomes.length,
  }));
}

/** Таблица частот: различные значения по возрастанию, абсолютная и относительная частота. */
export function frequencyTable(values: readonly number[]): FrequencyRow[] {
  assertNonEmptySample(values, 'Таблица частот');
  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([value, count]) => ({ value, count, relativeFrequency: count / values.length }));
}

/**
 * Группирует данные в интервалы равной ширины [from; to). Наибольшее значение,
 * попавшее на правую границу последнего интервала, относится к последнему интервалу.
 * Пустые интервалы внутри диапазона сохраняются, чтобы диаграмма была честной.
 */
export function groupIntoIntervals(
  values: readonly number[],
  intervalWidth: number,
  start?: number,
): IntervalRow[] {
  assertNonEmptySample(values, 'Группировка данных');
  assertFiniteNumber(intervalWidth, 'Ширина интервала');
  if (intervalWidth <= 0) throw new RangeError('Ширина интервала должна быть положительной');
  if (start !== undefined) assertFiniteNumber(start, 'Начало первого интервала');

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const firstEdge = start ?? Math.floor(minimum / intervalWidth) * intervalWidth;
  if (firstEdge > minimum) {
    throw new RangeError('Начало первого интервала должно быть не больше наименьшего значения');
  }

  const intervalCount = Math.max(1, Math.ceil(roundTo((maximum - firstEdge) / intervalWidth, 9)));
  if (intervalCount > 1_000) throw new RangeError('Получается слишком много интервалов');

  const rows: IntervalRow[] = Array.from({ length: intervalCount }, (_, index) => ({
    from: roundTo(firstEdge + index * intervalWidth, 9),
    to: roundTo(firstEdge + (index + 1) * intervalWidth, 9),
    count: 0,
    relativeFrequency: 0,
  }));

  for (const value of values) {
    let index = Math.floor(roundTo((value - firstEdge) / intervalWidth, 9));
    if (index >= intervalCount) index = intervalCount - 1;
    rows[index]!.count += 1;
  }

  for (const row of rows) row.relativeFrequency = row.count / values.length;
  return rows;
}

const LCG_MULTIPLIER = 1_664_525;
const LCG_INCREMENT = 1_013_904_223;
const LCG_MODULUS = 2 ** 32;

/**
 * Детерминированный линейный конгруэнтный генератор: одно и то же зерно всегда
 * даёт одну и ту же последовательность чисел из промежутка [0; 1).
 */
export function createLcg(seed: number): () => number {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError('Зерно генератора должно быть целым неотрицательным числом');
  }
  let state = seed % LCG_MODULUS;
  return () => {
    state = (LCG_MULTIPLIER * state + LCG_INCREMENT) % LCG_MODULUS;
    return state / LCG_MODULUS;
  };
}

function assertTrialCount(trials: number): void {
  if (!Number.isInteger(trials) || trials < 0 || trials > MAXIMUM_TRIALS) {
    throw new RangeError(`Число опытов должно быть целым от 0 до ${MAXIMUM_TRIALS}`);
  }
}

/**
 * Серия опытов с равновозможными исходами (монета — 2, кубик — 6).
 * Возвращает номера исходов от 1 до sideCount; при одном зерне серия воспроизводима.
 */
export function simulateEquallyLikelyTrials(seed: number, trials: number, sideCount: number): number[] {
  assertTrialCount(trials);
  if (!Number.isInteger(sideCount) || sideCount < 2 || sideCount > 1_000) {
    throw new RangeError('Число исходов должно быть целым от 2 до 1000');
  }
  const next = createLcg(seed);
  return Array.from({ length: trials }, () => Math.floor(next() * sideCount) + 1);
}

/** Серия опытов «успех/неудача» с заданной вероятностью успеха; воспроизводима по зерну. */
export function simulateSuccessSeries(seed: number, trials: number, successProbability: number): boolean[] {
  assertTrialCount(trials);
  assertFiniteNumber(successProbability, 'Вероятность успеха');
  if (successProbability <= 0 || successProbability >= 1) {
    throw new RangeError('Вероятность успеха должна лежать строго между 0 и 1');
  }
  const next = createLcg(seed);
  return Array.from({ length: trials }, () => next() < successProbability);
}

/** Относительная частота: доля успехов среди всех опытов. */
export function relativeFrequency(successCount: number, totalCount: number): number {
  if (!Number.isInteger(successCount) || successCount < 0) {
    throw new RangeError('Число успехов должно быть целым неотрицательным');
  }
  if (!Number.isInteger(totalCount) || totalCount <= 0) {
    throw new RangeError('Общее число опытов должно быть целым положительным');
  }
  if (successCount > totalCount) {
    throw new RangeError('Число успехов не может превышать число опытов');
  }
  return successCount / totalCount;
}

/**
 * Накопленные относительные частоты после каждого опыта серии —
 * ломаная «устойчивости частоты» для диаграммы.
 */
export function runningRelativeFrequencies(outcomes: readonly boolean[]): number[] {
  if (!Array.isArray(outcomes)) throw new TypeError('Нужен массив исходов серии');
  let successes = 0;
  return outcomes.map((outcome, index) => {
    if (typeof outcome !== 'boolean') {
      throw new TypeError(`Исход №${index + 1} должен быть логическим значением`);
    }
    if (outcome) successes += 1;
    return successes / (index + 1);
  });
}
