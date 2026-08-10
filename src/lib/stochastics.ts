/**
 * Вычислительное ядро главы «Статистическое мышление» (11 класс).
 *
 * Здесь нет ни одного обращения к `Math.random`. Всё, что можно посчитать
 * точно, считается точно: распределения — несократимыми дробями из
 * `probability.ts`, ожидание и дисперсия — функциями из `combinatorics.ts`
 * и `conditional.ts`, суммы независимых величин — свёрткой распределений.
 * Приближение появляется только там, где оно есть по существу: у корня
 * из дисперсии и у нормальной модели. «Случайная» серия наблюдений
 * получается сеемым генератором `createLcg` из `statistics.ts`, поэтому
 * один и тот же пример всегда выглядит одинаково.
 */

import {
  addFractions,
  compareFractions,
  decimalToFraction,
  fraction,
  fractionToNumber,
  multiplyFractions,
  subtractFractions,
  type Fraction,
} from './probability';
import {
  distributionOfEqualOutcomes,
  distributionTotal,
  expectedValue,
  type DistributionEntry,
} from './combinatorics';
import { distributionOfSum, distributionVariance } from './conditional';
import { createLcg, mean as exactMean, roundTo } from './statistics';

const ZERO: Fraction = { numerator: 0, denominator: 1 };
const ONE: Fraction = { numerator: 1, denominator: 1 };

/** Больше кубиков в сумме уже не помещается в наглядную диаграмму. */
export const MAX_DICE_IN_SUM = 8;

/** Дальше сеемая серия наблюдений считалась бы заметно дольше, чем рисуется. */
export const MAX_SIMULATION_DRAWS = 200_000;

function assertFinite(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} должно быть конечным числом`);
  }
  return value;
}

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} должно быть целым положительным числом`);
  }
  return value;
}

function assertShare(value: number, label: string): number {
  assertFinite(value, label);
  if (value < 0 || value > 1) {
    throw new RangeError(`${label} должна лежать между 0 и 1`);
  }
  return value;
}

/* ─────────────────────────  Игра как случайная величина  ───────────────────────── */

/** Один исход игры: подпись, выплата игроку в рублях и вероятность исхода. */
export interface GameOutcome {
  readonly label: string;
  /** Сколько игрок получает при этом исходе; цена входа сюда не входит. */
  readonly payoff: number;
  readonly probability: Fraction;
}

/**
 * Распределение выплаты по описанию игры: одинаковые выплаты объединяются,
 * значения выстраиваются по возрастанию, сумма вероятностей проверяется.
 */
export function gameDistribution(outcomes: readonly GameOutcome[]): DistributionEntry[] {
  if (!Array.isArray(outcomes) || outcomes.length < 2) {
    throw new RangeError('В игре должно быть не меньше двух исходов');
  }
  const merged = new Map<number, Fraction>();
  outcomes.forEach((outcome, index) => {
    if (!Number.isSafeInteger(outcome.payoff)) {
      throw new TypeError(`Выплата исхода №${index + 1} должна быть целым числом рублей`);
    }
    const probability = fraction(outcome.probability.numerator, outcome.probability.denominator);
    if (probability.numerator < 0 || probability.numerator > probability.denominator) {
      throw new RangeError(`Вероятность исхода №${index + 1} должна лежать между 0 и 1`);
    }
    merged.set(outcome.payoff, addFractions(merged.get(outcome.payoff) ?? ZERO, probability));
  });

  const entries = [...merged.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([value, probability]) => ({ value, probability }));

  if (compareFractions(distributionTotal(entries), ONE) !== 0) {
    throw new RangeError('Сумма вероятностей исходов игры должна равняться 1');
  }
  return entries;
}

/** Сдвиг всех значений величины на одно и то же число: $Y=X+c$. */
export function shiftDistribution(entries: readonly DistributionEntry[], shift: number): DistributionEntry[] {
  if (!Number.isSafeInteger(shift)) {
    throw new TypeError('Сдвиг должен быть целым числом');
  }
  return entries.map((entry) => {
    const value = entry.value + shift;
    if (!Number.isSafeInteger(value)) {
      throw new RangeError('Сдвинутое значение выходит за диапазон безопасных целых чисел');
    }
    return { value, probability: fraction(entry.probability.numerator, entry.probability.denominator) };
  });
}

/**
 * Справедливая цена игры — это её математическое ожидание: при такой цене
 * ожидание чистого результата равно нулю и никто не получает преимущества.
 */
export function fairPrice(entries: readonly DistributionEntry[]): Fraction {
  return expectedValue(entries);
}

/** Ожидание чистого результата игрока: $M(X)-\text{цена}$. */
export function netExpectation(entries: readonly DistributionEntry[], price: number): Fraction {
  assertFinite(price, 'Цена игры');
  return subtractFractions(expectedValue(entries), decimalToFraction(price));
}

/**
 * Дисперсия через квадраты: $D(X)=M(X^2)-\bigl(M(X)\bigr)^2$.
 * Даёт тот же результат, что и определение, и служит его проверкой.
 */
export function varianceThroughSquares(entries: readonly DistributionEntry[]): Fraction {
  const squares = entries.map((entry) => {
    const square = entry.value * entry.value;
    if (!Number.isSafeInteger(square)) {
      throw new RangeError('Квадрат значения выходит за диапазон безопасных целых чисел');
    }
    return { value: square, probability: entry.probability };
  });
  const mean = expectedValue(entries);
  return subtractFractions(expectedValue(squares), multiplyFractions(mean, mean));
}

/**
 * Стандартное отклонение $\sigma(X)=\sqrt{D(X)}$ — единственное место,
 * где точная дробь превращается в приближённое число.
 */
export function standardDeviation(entries: readonly DistributionEntry[]): number {
  return Math.sqrt(fractionToNumber(distributionVariance(entries)));
}

/** Стандартное отклонение готового ряда данных (не распределения). */
export function dataStandardDeviation(values: readonly number[]): number {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RangeError('Нужен хотя бы один элемент данных');
  }
  const centre = exactMean(values);
  const squares = values.reduce((total, value) => total + (value - centre) ** 2, 0);
  return Math.sqrt(squares / values.length);
}

/** Стандартизованное значение $z=\dfrac{x-\mu}{\sigma}$: «на сколько сигм отклонилось». */
export function standardScore(value: number, centre: number, deviation: number): number {
  assertFinite(value, 'Значение');
  assertFinite(centre, 'Среднее');
  assertFinite(deviation, 'Стандартное отклонение');
  if (deviation <= 0) {
    throw new RangeError('Стандартное отклонение должно быть положительным');
  }
  return (value - centre) / deviation;
}

/* ─────────────────────────  Сумма независимых величин  ───────────────────────── */

/**
 * Точное распределение суммы очков на `count` независимых кубиках.
 * Считается свёрткой, а не перебором: перебор для восьми кубиков — это
 * $6^8$ исходов, а свёртка обходится десятками строк.
 */
export function diceSumDistribution(count: number): DistributionEntry[] {
  assertPositiveInteger(count, 'Число кубиков');
  if (count > MAX_DICE_IN_SUM) {
    throw new RangeError(`Число кубиков должно быть целым от 1 до ${MAX_DICE_IN_SUM}`);
  }
  const single = distributionOfEqualOutcomes([1, 2, 3, 4, 5, 6]);
  let result = single;
  for (let step = 1; step < count; step += 1) {
    result = distributionOfSum(result, single);
  }
  return result;
}

/* ─────────────────────────  Правило трёх сигм  ───────────────────────── */

/**
 * Точная вероятность попасть в полосу $\mu\pm k\sigma$.
 *
 * Корень не извлекается: условие $|x-\mu|\le k\sigma$ равносильно
 * условию $(x-\mu)^2\le k^2 D(X)$, а обе его части — рациональные числа.
 */
export function withinSigmaProbability(entries: readonly DistributionEntry[], sigmas: number): Fraction {
  assertFinite(sigmas, 'Число сигм');
  if (sigmas <= 0) {
    throw new RangeError('Число сигм должно быть положительным');
  }
  const centre = expectedValue(entries);
  const variance = distributionVariance(entries);
  const factor = decimalToFraction(sigmas);
  const bound = multiplyFractions(multiplyFractions(factor, factor), variance);

  let total: Fraction = ZERO;
  for (const entry of entries) {
    const deviation = subtractFractions(fraction(entry.value, 1), centre);
    if (compareFractions(multiplyFractions(deviation, deviation), bound) <= 0) {
      total = addFractions(total, entry.probability);
    }
  }
  return total;
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  if (x === 0) return 0;
  if (x > 6) return sign;

  // Ряд с положительными слагаемыми: erf(x) = 2/√π · e^{−x²} · Σ 2ⁿx^{2n+1}/(1·3·…·(2n+1)).
  let term = x;
  let sum = x;
  for (let step = 1; step < 400; step += 1) {
    term *= (2 * x * x) / (2 * step + 1);
    sum += term;
    if (term < 1e-17 * sum) break;
  }
  return sign * (2 / Math.sqrt(Math.PI)) * Math.exp(-x * x) * sum;
}

/** Плотность нормальной модели — нужна только для того, чтобы нарисовать колокол. */
export function normalDensity(value: number, centre: number, deviation: number): number {
  assertFinite(value, 'Значение');
  assertFinite(centre, 'Среднее');
  if (!Number.isFinite(deviation) || deviation <= 0) {
    throw new RangeError('Стандартное отклонение должно быть положительным');
  }
  const z = (value - centre) / deviation;
  return Math.exp(-0.5 * z * z) / (deviation * Math.sqrt(2 * Math.PI));
}

/** Доля значений нормальной модели левее точки: $\Phi\!\left(\frac{x-\mu}{\sigma}\right)$. */
export function normalCdf(value: number, centre: number, deviation: number): number {
  assertFinite(value, 'Значение');
  assertFinite(centre, 'Среднее');
  if (!Number.isFinite(deviation) || deviation <= 0) {
    throw new RangeError('Стандартное отклонение должно быть положительным');
  }
  return 0.5 * (1 + erf((value - centre) / (deviation * Math.SQRT2)));
}

/** Доля нормальной модели в полосе $\mu\pm k\sigma$: 0,6827, 0,9545 и 0,9973 при k = 1, 2, 3. */
export function normalBandProbability(sigmas: number): number {
  assertFinite(sigmas, 'Число сигм');
  if (sigmas < 0) {
    throw new RangeError('Число сигм не может быть отрицательным');
  }
  return erf(sigmas / Math.SQRT2);
}

/**
 * Нижняя граница Чебышёва: какая доля значений ЛЮБОЙ величины обязана
 * попасть в полосу $\mu\pm k\sigma$. Гарантия слабее правила трёх сигм,
 * зато не требует никаких предположений о форме распределения.
 */
export function chebyshevBound(sigmas: number): number {
  assertFinite(sigmas, 'Число сигм');
  if (sigmas <= 1) return 0;
  return 1 - 1 / (sigmas * sigmas);
}

/** Строка сравнения: точная вероятность полосы против обещания нормальной модели. */
export interface SigmaRow {
  readonly sigmas: number;
  /** Точная вероятность для рассматриваемой дискретной величины. */
  readonly exact: Fraction;
  /** Приближение той же вероятности десятичной дробью. */
  readonly exactApprox: number;
  /** Что обещает нормальная модель. */
  readonly normal: number;
  /** Что гарантирует неравенство Чебышёва без всяких предположений. */
  readonly chebyshev: number;
}

/** Полное сравнение точных вероятностей с нормальной моделью для k = 1, 2, 3. */
export function sigmaComparison(
  entries: readonly DistributionEntry[],
  sigmaList: readonly number[] = [1, 2, 3],
): SigmaRow[] {
  return sigmaList.map((sigmas) => {
    const exact = withinSigmaProbability(entries, sigmas);
    return {
      sigmas,
      exact,
      exactApprox: roundTo(fractionToNumber(exact), 4),
      normal: roundTo(normalBandProbability(sigmas), 4),
      chebyshev: roundTo(chebyshevBound(sigmas), 4),
    };
  });
}

/* ─────────────────────────  Выборка и её ошибка  ───────────────────────── */

/**
 * Стандартная ошибка доли: $\sigma_{\hat p}=\sqrt{\dfrac{p(1-p)}{n}}$.
 * Величина уменьшается как $\dfrac{1}{\sqrt n}$: чтобы ошибка стала вдвое
 * меньше, выборку нужно увеличить вчетверо.
 */
export function standardError(share: number, size: number): number {
  assertShare(share, 'Доля');
  assertPositiveInteger(size, 'Объём выборки');
  return Math.sqrt((share * (1 - share)) / size);
}

/** Граница ошибки выборки: обычно берут две стандартные ошибки. */
export function marginOfError(share: number, size: number, sigmas = 2): number {
  assertFinite(sigmas, 'Число сигм');
  if (sigmas <= 0) {
    throw new RangeError('Число сигм должно быть положительным');
  }
  return sigmas * standardError(share, size);
}

export interface ShareInterval {
  readonly low: number;
  readonly high: number;
  readonly margin: number;
}

/** Интервал «доля ± граница ошибки», обрезанный отрезком от 0 до 1. */
export function shareInterval(share: number, size: number, sigmas = 2): ShareInterval {
  const margin = marginOfError(share, size, sigmas);
  return {
    low: Math.max(0, share - margin),
    high: Math.min(1, share + margin),
    margin,
  };
}

/**
 * Наименьший объём выборки, при котором граница ошибки не превосходит `margin`
 * при любой доле: худший случай $p=\tfrac12$ даёт $n\ge\dfrac{k^2}{4\,m^2}$.
 */
export function requiredSampleSize(margin: number, sigmas = 2): number {
  assertFinite(margin, 'Граница ошибки');
  if (margin <= 0 || margin >= 1) {
    throw new RangeError('Граница ошибки должна лежать строго между 0 и 1');
  }
  assertFinite(sigmas, 'Число сигм');
  if (sigmas <= 0) {
    throw new RangeError('Число сигм должно быть положительным');
  }
  return Math.ceil(roundTo((sigmas * sigmas) / (4 * margin * margin), 9));
}

/**
 * Серия выборок объёма `size` из населения, где доля сторонников равна `share`.
 * Возвращает наблюдённую долю в каждой выборке. Генератор сеемый, поэтому
 * результат воспроизводится и его можно печатать в учебнике.
 */
export function simulateSampleShares(
  seed: number,
  samples: number,
  size: number,
  share: number,
): number[] {
  assertPositiveInteger(samples, 'Число выборок');
  assertPositiveInteger(size, 'Объём выборки');
  assertShare(share, 'Доля в населении');
  if (samples * size > MAX_SIMULATION_DRAWS) {
    throw new RangeError(`Всего опросов должно быть не больше ${MAX_SIMULATION_DRAWS}`);
  }
  const next = createLcg(seed);
  return Array.from({ length: samples }, () => {
    let supporters = 0;
    for (let person = 0; person < size; person += 1) {
      if (next() < share) supporters += 1;
    }
    return supporters / size;
  });
}

/* ─────────────────────────  Связь двух признаков  ───────────────────────── */

/**
 * Коэффициент корреляции Пирсона: мера линейной СВЯЗИ, а не причины.
 * Значение $r=1$ означает, что точки лежат на возрастающей прямой,
 * $r=-1$ — на убывающей, $r=0$ — что линейной связи не видно.
 */
export function correlationCoefficient(xs: readonly number[], ys: readonly number[]): number {
  if (!Array.isArray(xs) || !Array.isArray(ys)) {
    throw new TypeError('Нужны два массива значений');
  }
  if (xs.length !== ys.length) {
    throw new RangeError('В обоих признаках должно быть одинаковое число наблюдений');
  }
  if (xs.length < 2) {
    throw new RangeError('Для коэффициента корреляции нужно не меньше двух наблюдений');
  }
  const meanX = exactMean(xs);
  const meanY = exactMean(ys);

  let product = 0;
  let squaresX = 0;
  let squaresY = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const dx = xs[index]! - meanX;
    const dy = ys[index]! - meanY;
    product += dx * dy;
    squaresX += dx * dx;
    squaresY += dy * dy;
  }
  if (squaresX === 0 || squaresY === 0) {
    throw new RangeError('Один из признаков не меняется, поэтому корреляция не определена');
  }
  return product / Math.sqrt(squaresX * squaresY);
}
