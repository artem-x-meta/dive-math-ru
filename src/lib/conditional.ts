/**
 * Вычислительное ядро главы «Условная вероятность» (10 класс).
 *
 * Всё считается точно: частоты — целыми числами, вероятности — несократимыми
 * дробями из `probability.ts`, доли и проценты разбираются точной арифметикой
 * из `exactRational.ts`. Распределения используют тип и проверки из
 * `combinatorics.ts`, поэтому таблица распределения здесь и в 9 классе — одна
 * и та же структура данных. Генератор случайных чисел не используется нигде:
 * все «эксперименты» получаются полным перебором или прямым подсчётом.
 */

import {
  addFractions,
  classicalProbability,
  compareFractions,
  fraction,
  isProbability,
  multiplyFractions,
  subtractFractions,
  type Fraction,
} from './probability';
import {
  distributionTotal,
  expectedValue,
  type DistributionEntry,
} from './combinatorics';
import {
  compareExact,
  multiplyExact,
  parseExact,
  type ExactInput,
  type ExactRational,
} from './exactRational';

const ZERO: Fraction = { numerator: 0, denominator: 1 };
const ONE: Fraction = { numerator: 1, denominator: 1 };

/** Больше этого числа людей в мысленной группе уже не помещается в наглядную таблицу. */
export const MAX_POPULATION = 10_000_000;

function assertCount(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} должно быть целым неотрицательным числом`);
  }
  return value;
}

function assertProbabilityValue(value: Fraction, label: string): Fraction {
  const normalized = fraction(value.numerator, value.denominator);
  if (!isProbability(normalized)) {
    throw new RangeError(`${label} должна лежать между 0 и 1`);
  }
  return normalized;
}

function divideFractions(left: Fraction, right: Fraction): Fraction {
  const divisor = fraction(right.numerator, right.denominator);
  if (divisor.numerator === 0) {
    throw new RangeError('Делить на нулевую вероятность нельзя');
  }
  return multiplyFractions(left, fraction(divisor.denominator, divisor.numerator));
}

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcdBigInt(left: bigint, right: bigint): bigint {
  let a = absoluteBigInt(left);
  let b = absoluteBigInt(right);
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

function lcmBigInt(left: bigint, right: bigint): bigint {
  if (left === 0n || right === 0n) return 0n;
  return (left / gcdBigInt(left, right)) * right;
}

/* ─────────────────────────  Таблица частот 2 × 2  ───────────────────────── */

/**
 * Таблица сопряжённости: каждый объект попадает ровно в одну из четырёх клеток
 * по признакам A (строка) и B (столбец).
 */
export interface TwoWayTable {
  /** Число объектов, у которых произошли оба события: $n(A\cap B)$. */
  readonly both: number;
  /** Произошло A, но не B: $n(A\cap\bar B)$. */
  readonly leftOnly: number;
  /** Произошло B, но не A: $n(\bar A\cap B)$. */
  readonly rightOnly: number;
  /** Не произошло ни одно из событий: $n(\bar A\cap\bar B)$. */
  readonly neither: number;
}

/** Проверяет, что все четыре клетки — целые неотрицательные числа и группа непуста. */
export function assertTwoWayTable(table: TwoWayTable): TwoWayTable {
  if (typeof table !== 'object' || table === null) {
    throw new TypeError('Нужна таблица из четырёх клеток');
  }
  const both = assertCount(table.both, 'Число объектов в клетке «A и B»');
  const leftOnly = assertCount(table.leftOnly, 'Число объектов в клетке «A без B»');
  const rightOnly = assertCount(table.rightOnly, 'Число объектов в клетке «B без A»');
  const neither = assertCount(table.neither, 'Число объектов в клетке «ни A, ни B»');
  const total = both + leftOnly + rightOnly + neither;
  if (total === 0) {
    throw new RangeError('В таблице должен быть хотя бы один объект');
  }
  if (!Number.isSafeInteger(total)) {
    throw new RangeError('Общее число объектов выходит за диапазон безопасных целых чисел');
  }
  return { both, leftOnly, rightOnly, neither };
}

/** Общее число объектов в таблице. */
export function tableTotal(table: TwoWayTable): number {
  const checked = assertTwoWayTable(table);
  return checked.both + checked.leftOnly + checked.rightOnly + checked.neither;
}

/** Итог строки: $n(A)$. */
export function leftCount(table: TwoWayTable): number {
  const checked = assertTwoWayTable(table);
  return checked.both + checked.leftOnly;
}

/** Итог столбца: $n(B)$. */
export function rightCount(table: TwoWayTable): number {
  const checked = assertTwoWayTable(table);
  return checked.both + checked.rightOnly;
}

/** $P(A)$ по таблице частот. */
export function probabilityOfLeft(table: TwoWayTable): Fraction {
  return classicalProbability(leftCount(table), tableTotal(table));
}

/** $P(B)$ по таблице частот. */
export function probabilityOfRight(table: TwoWayTable): Fraction {
  return classicalProbability(rightCount(table), tableTotal(table));
}

/** $P(A\cap B)$ по таблице частот. */
export function probabilityOfBoth(table: TwoWayTable): Fraction {
  return classicalProbability(assertTwoWayTable(table).both, tableTotal(table));
}

/**
 * Определение условной вероятности: $P(A\mid B)=\dfrac{P(A\cap B)}{P(B)}$.
 * Требует $P(B)>0$ и $P(A\cap B)\le P(B)$.
 */
export function conditionalProbability(joint: Fraction, condition: Fraction): Fraction {
  const jointValue = assertProbabilityValue(joint, 'Вероятность пересечения');
  const conditionValue = assertProbabilityValue(condition, 'Вероятность условия');
  if (conditionValue.numerator === 0) {
    throw new RangeError('Условная вероятность не определена: вероятность условия равна нулю');
  }
  if (compareFractions(jointValue, conditionValue) > 0) {
    throw new RangeError('Вероятность пересечения не может быть больше вероятности условия');
  }
  return divideFractions(jointValue, conditionValue);
}

/** $P(A\mid B)$ прямо по частотам: доля клетки «A и B» внутри столбца B. */
export function leftGivenRight(table: TwoWayTable): Fraction {
  const checked = assertTwoWayTable(table);
  const condition = checked.both + checked.rightOnly;
  if (condition === 0) {
    throw new RangeError('Условная вероятность не определена: событие B не произошло ни разу');
  }
  return classicalProbability(checked.both, condition);
}

/** $P(B\mid A)$ прямо по частотам: доля клетки «A и B» внутри строки A. */
export function rightGivenLeft(table: TwoWayTable): Fraction {
  const checked = assertTwoWayTable(table);
  const condition = checked.both + checked.leftOnly;
  if (condition === 0) {
    throw new RangeError('Условная вероятность не определена: событие A не произошло ни разу');
  }
  return classicalProbability(checked.both, condition);
}

/** $P(A\mid\bar B)$ — та же доля, но во втором столбце. */
export function leftGivenNotRight(table: TwoWayTable): Fraction {
  const checked = assertTwoWayTable(table);
  const condition = checked.leftOnly + checked.neither;
  if (condition === 0) {
    throw new RangeError('Условная вероятность не определена: событие B произошло всегда');
  }
  return classicalProbability(checked.leftOnly, condition);
}

/** Правило умножения: $P(A\cap B)=P(B)\cdot P(A\mid B)$. */
export function multiplicationRule(condition: Fraction, conditional: Fraction): Fraction {
  return multiplyFractions(
    assertProbabilityValue(condition, 'Вероятность условия'),
    assertProbabilityValue(conditional, 'Условная вероятность'),
  );
}

/** Определение независимости: $P(A\cap B)=P(A)\cdot P(B)$. */
export function areIndependent(left: Fraction, right: Fraction, both: Fraction): boolean {
  const a = assertProbabilityValue(left, 'Вероятность события A');
  const b = assertProbabilityValue(right, 'Вероятность события B');
  const joint = assertProbabilityValue(both, 'Вероятность пересечения');
  return compareFractions(multiplyFractions(a, b), joint) === 0;
}

/** Независимы ли признаки таблицы частот. */
export function isTableIndependent(table: TwoWayTable): boolean {
  return areIndependent(probabilityOfLeft(table), probabilityOfRight(table), probabilityOfBoth(table));
}

/** Насколько таблица отклоняется от независимости: $P(A\cap B)-P(A)P(B)$. */
export function independenceGap(table: TwoWayTable): Fraction {
  return subtractFractions(
    probabilityOfBoth(table),
    multiplyFractions(probabilityOfLeft(table), probabilityOfRight(table)),
  );
}

/** Сколько объектов стояло бы в клетке «A и B» при независимости: $\dfrac{n(A)\,n(B)}{n}$. */
export function expectedIndependentCount(table: TwoWayTable): Fraction {
  const total = tableTotal(table);
  return fraction(leftCount(table) * rightCount(table), total);
}

/* ────────────────  Формула полной вероятности и формула Байеса  ──────────────── */

/** Одна гипотеза $H_i$ вместе с вероятностью события A при этой гипотезе. */
export interface BayesBranch {
  /** Название гипотезы: «первый цех», «человек болен». */
  readonly label: string;
  /** Априорная вероятность гипотезы $P(H_i)$. */
  readonly prior: Fraction;
  /** Вероятность наблюдения при этой гипотезе $P(A\mid H_i)$. */
  readonly conditional: Fraction;
}

/** Строка разбора: гипотеза, её вклад в $P(A)$ и апостериорная вероятность. */
export interface BayesRow extends BayesBranch {
  /** Вклад ветви: $P(H_i)\cdot P(A\mid H_i)$. */
  readonly joint: Fraction;
  /** Апостериорная вероятность $P(H_i\mid A)$. */
  readonly posterior: Fraction;
}

function assertBranches(branches: readonly BayesBranch[]): BayesBranch[] {
  if (!Array.isArray(branches) || branches.length < 2) {
    throw new RangeError('Полная группа должна содержать не меньше двух гипотез');
  }
  const labels = new Set<string>();
  let priorSum: Fraction = ZERO;
  const checked = branches.map((branch, index) => {
    if (typeof branch.label !== 'string' || branch.label.trim() === '') {
      throw new TypeError(`У гипотезы №${index + 1} должно быть название`);
    }
    if (labels.has(branch.label)) {
      throw new RangeError(`Название гипотезы «${branch.label}» встречается дважды`);
    }
    labels.add(branch.label);
    const prior = assertProbabilityValue(branch.prior, `Вероятность гипотезы №${index + 1}`);
    const conditional = assertProbabilityValue(branch.conditional, `Условная вероятность в гипотезе №${index + 1}`);
    priorSum = addFractions(priorSum, prior);
    return { label: branch.label, prior, conditional };
  });

  if (compareFractions(priorSum, ONE) !== 0) {
    throw new RangeError('Сумма вероятностей гипотез должна равняться 1');
  }
  return checked;
}

/** Формула полной вероятности: $P(A)=\sum P(H_i)\,P(A\mid H_i)$. */
export function totalProbabilityOf(branches: readonly BayesBranch[]): Fraction {
  const checked = assertBranches(branches);
  let total: Fraction = ZERO;
  for (const branch of checked) {
    total = addFractions(total, multiplyFractions(branch.prior, branch.conditional));
  }
  return total;
}

/**
 * Полный разбор по Байесу: для каждой гипотезы вклад $P(H_i)P(A\mid H_i)$
 * и апостериорная вероятность $P(H_i\mid A)=\dfrac{P(H_i)P(A\mid H_i)}{P(A)}$.
 */
export function bayesTable(branches: readonly BayesBranch[]): BayesRow[] {
  const checked = assertBranches(branches);
  const total = totalProbabilityOf(checked);
  if (total.numerator === 0) {
    throw new RangeError('Событие невозможно при всех гипотезах, поэтому формула Байеса не применима');
  }
  return checked.map((branch) => {
    const joint = multiplyFractions(branch.prior, branch.conditional);
    return { ...branch, joint, posterior: divideFractions(joint, total) };
  });
}

/** Апостериорная вероятность одной гипотезы. */
export function bayesPosterior(branches: readonly BayesBranch[], index: number): Fraction {
  const rows = bayesTable(branches);
  if (!Number.isSafeInteger(index) || index < 0 || index >= rows.length) {
    throw new RangeError('Номер гипотезы выходит за границы списка');
  }
  return rows[index]!.posterior;
}

/* ──────────────────────────  Природные частоты  ────────────────────────── */

/** Условия скрининга: доли задаются точно — числом, строкой «0,01» или «1/100». */
export interface ScreeningSetup {
  /** Сколько человек в мысленной группе. */
  readonly population: number;
  /** Доля больных в группе — распространённость. */
  readonly prevalence: ExactInput;
  /** Чувствительность: $P(+\mid\text{болен})$. */
  readonly sensitivity: ExactInput;
  /** Специфичность: $P(-\mid\text{здоров})$. */
  readonly specificity: ExactInput;
}

/** Та же группа, разложенная по четырём клеткам целыми числами людей. */
export interface ScreeningTable {
  readonly population: number;
  readonly sick: number;
  readonly healthy: number;
  /** Болен и тест положителен. */
  readonly truePositive: number;
  /** Болен, но тест отрицателен — пропуск болезни. */
  readonly falseNegative: number;
  /** Здоров, но тест положителен — ложная тревога. */
  readonly falsePositive: number;
  /** Здоров и тест отрицателен. */
  readonly trueNegative: number;
}

function shareOf(value: ExactInput, label: string): ExactRational {
  const exact = parseExact(value);
  if (compareExact(exact, 0) < 0 || compareExact(exact, 1) > 0) {
    throw new RangeError(`${label} должна лежать между 0 и 1`);
  }
  return exact;
}

function exactWholeCount(value: ExactRational, label: string): number {
  if (value.denominator !== 1n) {
    throw new RangeError(`${label} получилось дробным; возьми другую численность группы`);
  }
  const count = Number(value.numerator);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(`${label} выходит за диапазон безопасных целых чисел`);
  }
  return count;
}

/**
 * Раскладывает группу людей по четырём клеткам без единого округления.
 * Если хотя бы одно произведение получается дробным, функция сообщает об этом,
 * а не «подгоняет» число людей.
 */
export function naturalFrequencies(setup: ScreeningSetup): ScreeningTable {
  const population = assertCount(setup.population, 'Численность группы');
  if (population === 0 || population > MAX_POPULATION) {
    throw new RangeError(`Численность группы должна быть от 1 до ${MAX_POPULATION}`);
  }
  const prevalence = shareOf(setup.prevalence, 'Доля больных');
  const sensitivity = shareOf(setup.sensitivity, 'Чувствительность теста');
  const specificity = shareOf(setup.specificity, 'Специфичность теста');

  const sick = exactWholeCount(parseExact(multiplyExact(population, prevalence)), 'Число больных');
  const healthy = population - sick;
  const truePositive = exactWholeCount(parseExact(multiplyExact(sick, sensitivity)), 'Число верных положительных результатов');
  const trueNegative = exactWholeCount(parseExact(multiplyExact(healthy, specificity)), 'Число верных отрицательных результатов');

  return {
    population,
    sick,
    healthy,
    truePositive,
    falseNegative: sick - truePositive,
    falsePositive: healthy - trueNegative,
    trueNegative,
  };
}

/**
 * Наименьшая численность группы не меньше `atLeast`, при которой все четыре
 * клетки природных частот окажутся целыми числами.
 */
export function smallestExactPopulation(
  setup: Omit<ScreeningSetup, 'population'>,
  atLeast = 1,
): number {
  if (!Number.isSafeInteger(atLeast) || atLeast < 1) {
    throw new RangeError('Нижняя граница численности должна быть целым числом не меньше 1');
  }
  const prevalence = shareOf(setup.prevalence, 'Доля больных');
  const sensitivity = shareOf(setup.sensitivity, 'Чувствительность теста');
  const specificity = shareOf(setup.specificity, 'Специфичность теста');

  const sickNumerator = prevalence.numerator;
  const healthyNumerator = prevalence.denominator - prevalence.numerator;
  const sickStep = sensitivity.denominator / gcdBigInt(sickNumerator, sensitivity.denominator);
  const healthyStep = specificity.denominator / gcdBigInt(healthyNumerator, specificity.denominator);
  const step = prevalence.denominator * lcmBigInt(sickStep, healthyStep);
  const bound = BigInt(atLeast);
  const multiplier = (bound + step - 1n) / step;
  const population = step * (multiplier < 1n ? 1n : multiplier);

  if (population > BigInt(MAX_POPULATION)) {
    throw new RangeError('Для таких долей нужна слишком большая группа; выбери более круглые доли');
  }
  return Number(population);
}

/** Тот же скрининг в виде таблицы 2 × 2: событие A — «болен», событие B — «тест положителен». */
export function screeningToTable(screening: ScreeningTable): TwoWayTable {
  return assertTwoWayTable({
    both: screening.truePositive,
    leftOnly: screening.falseNegative,
    rightOnly: screening.falsePositive,
    neither: screening.trueNegative,
  });
}

/** Прогностическая ценность положительного результата: $P(\text{болен}\mid +)$. */
export function positivePredictiveValue(screening: ScreeningTable): Fraction {
  const positives = screening.truePositive + screening.falsePositive;
  if (positives === 0) {
    throw new RangeError('Ни один тест не дал положительного результата, вероятность не определена');
  }
  return classicalProbability(screening.truePositive, positives);
}

/** Прогностическая ценность отрицательного результата: $P(\text{здоров}\mid -)$. */
export function negativePredictiveValue(screening: ScreeningTable): Fraction {
  const negatives = screening.trueNegative + screening.falseNegative;
  if (negatives === 0) {
    throw new RangeError('Ни один тест не дал отрицательного результата, вероятность не определена');
  }
  return classicalProbability(screening.trueNegative, negatives);
}

/**
 * Тот же скрининг в виде двух гипотез для формулы Байеса: событие A — «тест
 * положителен», гипотезы — «болен» и «здоров».
 */
export function screeningBranches(screening: ScreeningTable): BayesBranch[] {
  const table = screeningToTable(screening);
  const total = tableTotal(table);
  return [
    {
      label: 'болен',
      prior: classicalProbability(screening.sick, total),
      conditional: screening.sick === 0 ? ZERO : classicalProbability(screening.truePositive, screening.sick),
    },
    {
      label: 'здоров',
      prior: classicalProbability(screening.healthy, total),
      conditional: screening.healthy === 0 ? ZERO : classicalProbability(screening.falsePositive, screening.healthy),
    },
  ];
}

/* ───────────────────────  Дискретные распределения  ─────────────────────── */

function assertCompleteDistribution(entries: readonly DistributionEntry[], label: string): DistributionEntry[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new RangeError(`${label}: нужна хотя бы одна строка распределения`);
  }
  entries.forEach((entry, index) => {
    if (!Number.isSafeInteger(entry.value)) {
      throw new TypeError(`${label}: значение в строке №${index + 1} должно быть целым числом`);
    }
  });
  const total = distributionTotal(entries);
  if (compareFractions(total, ONE) !== 0) {
    throw new RangeError(`${label}: сумма вероятностей должна равняться 1`);
  }
  return entries.map((entry) => ({
    value: entry.value,
    probability: fraction(entry.probability.numerator, entry.probability.denominator),
  }));
}

/**
 * Условное распределение: оставляем только те значения, которые удовлетворяют
 * условию, и делим каждую вероятность на вероятность условия. Сумма снова равна 1.
 */
export function conditionalDistribution(
  entries: readonly DistributionEntry[],
  isAllowed: (value: number) => boolean,
): DistributionEntry[] {
  const checked = assertCompleteDistribution(entries, 'Условное распределение');
  if (typeof isAllowed !== 'function') {
    throw new TypeError('Условие должно быть функцией от значения случайной величины');
  }
  const kept = checked.filter((entry) => isAllowed(entry.value));
  const condition = distributionTotal(kept);
  if (condition.numerator === 0) {
    throw new RangeError('Условие невозможно: его вероятность равна нулю');
  }
  return kept.map((entry) => ({
    value: entry.value,
    probability: divideFractions(entry.probability, condition),
  }));
}

/** Дисперсия: $D(X)=\sum p_i\,(x_i-M(X))^2$ — точной дробью. */
export function distributionVariance(entries: readonly DistributionEntry[]): Fraction {
  const checked = assertCompleteDistribution(entries, 'Дисперсия');
  const mean = expectedValue(checked);
  let total: Fraction = ZERO;
  for (const entry of checked) {
    const deviation = subtractFractions(fraction(entry.value, 1), mean);
    total = addFractions(total, multiplyFractions(entry.probability, multiplyFractions(deviation, deviation)));
  }
  return total;
}

/**
 * Распределение суммы двух **независимых** случайных величин:
 * $P(X+Y=s)=\sum_x P(X=x)\,P(Y=s-x)$. Именно независимость позволяет
 * перемножать вероятности внутри суммы.
 */
export function distributionOfSum(
  left: readonly DistributionEntry[],
  right: readonly DistributionEntry[],
): DistributionEntry[] {
  const first = assertCompleteDistribution(left, 'Первая величина');
  const second = assertCompleteDistribution(right, 'Вторая величина');
  const sums = new Map<number, Fraction>();

  for (const x of first) {
    for (const y of second) {
      const value = x.value + y.value;
      if (!Number.isSafeInteger(value)) {
        throw new RangeError('Сумма значений выходит за диапазон безопасных целых чисел');
      }
      const added = multiplyFractions(x.probability, y.probability);
      sums.set(value, addFractions(sums.get(value) ?? ZERO, added));
    }
  }

  return [...sums.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, probability]) => ({ value, probability }));
}

/* ────────────────────────  Разбор ответа читателя  ──────────────────────── */

/**
 * Понимает ответ, записанный обыкновенной дробью («1/12»), десятичной дробью
 * («0,083» или «0.083») или целым числом. Возвращает `null`, если запись
 * не разобралась или получилось отрицательное число.
 */
export function parseAnswerFraction(text: string): Fraction | null {
  if (typeof text !== 'string') return null;
  const normalized = text.replace(/[\s  ]/g, '');
  if (normalized === '') return null;

  try {
    const exact = parseExact(normalized);
    if (exact.numerator < 0n) return null;
    const numerator = Number(exact.numerator);
    const denominator = Number(exact.denominator);
    if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) return null;
    return fraction(numerator, denominator);
  } catch {
    return null;
  }
}

/** Считает ответ верным, если он совпал точно или отличается не больше чем на допуск. */
export function matchesProbability(
  answer: Fraction,
  target: Fraction,
  tolerance: Fraction = { numerator: 1, denominator: 1000 },
): boolean {
  const difference = subtractFractions(
    fraction(answer.numerator, answer.denominator),
    fraction(target.numerator, target.denominator),
  );
  const distance = fraction(Math.abs(difference.numerator), difference.denominator);
  const allowed = fraction(tolerance.numerator, tolerance.denominator);
  if (allowed.numerator < 0) {
    throw new RangeError('Допуск не может быть отрицательным');
  }
  return compareFractions(distance, allowed) <= 0;
}
