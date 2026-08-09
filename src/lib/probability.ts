/**
 * Вычислительное ядро главы «Вероятностные деревья» (8 класс).
 *
 * Все вероятности и статистики считаются точно, на несократимых дробях
 * с целыми числителем и знаменателем. Внутри используется bigint,
 * чтобы промежуточные произведения не теряли точность.
 */

export interface Fraction {
  /** Числитель; знак дроби хранится здесь. */
  numerator: number;
  /** Знаменатель; всегда положительный. */
  denominator: number;
}

export interface TreeEdge {
  /** Подпись ребра: исход шага, например «орёл» или «красный». */
  label: string;
  /** Вероятность этого исхода на данном шаге. */
  probability: Fraction;
  /** Узел, в который ведёт ребро. */
  child: TreeNode;
}

export interface TreeNode {
  /** Исходящие рёбра; лист дерева — узел без рёбер. */
  edges?: readonly TreeEdge[];
}

export interface TreeOutcome {
  /** Подписи рёбер вдоль пути от корня к листу. */
  steps: readonly string[];
  /** Вероятность пути — произведение вероятностей рёбер. */
  probability: Fraction;
}

interface BigFraction {
  numerator: bigint;
  denominator: bigint;
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function bigintGcd(a: bigint, b: bigint): bigint {
  let left = absolute(a);
  let right = absolute(b);
  while (right !== 0n) {
    [left, right] = [right, left % right];
  }
  return left;
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} должно быть безопасным целым числом`);
  }
}

function toSafeNumber(value: bigint, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${label} выходит за диапазон безопасных целых чисел`);
  }
  return result;
}

function normalizeBig(numerator: bigint, denominator: bigint): Fraction {
  if (denominator === 0n) {
    throw new RangeError('Знаменатель дроби не может быть равен нулю');
  }
  if (numerator === 0n) return { numerator: 0, denominator: 1 };

  const divisor = bigintGcd(numerator, denominator);
  let reducedNumerator = numerator / divisor;
  let reducedDenominator = denominator / divisor;
  if (reducedDenominator < 0n) {
    reducedNumerator = -reducedNumerator;
    reducedDenominator = -reducedDenominator;
  }

  return {
    numerator: toSafeNumber(reducedNumerator, 'Числитель дроби'),
    denominator: toSafeNumber(reducedDenominator, 'Знаменатель дроби'),
  };
}

function toBig(value: Fraction, label: string): BigFraction {
  assertSafeInteger(value.numerator, `Числитель (${label})`);
  assertSafeInteger(value.denominator, `Знаменатель (${label})`);
  if (value.denominator === 0) {
    throw new RangeError('Знаменатель дроби не может быть равен нулю');
  }
  return { numerator: BigInt(value.numerator), denominator: BigInt(value.denominator) };
}

/** Строит несократимую дробь; знак переносится к числителю. */
export function fraction(numerator: number, denominator: number): Fraction {
  assertSafeInteger(numerator, 'Числитель');
  assertSafeInteger(denominator, 'Знаменатель');
  return normalizeBig(BigInt(numerator), BigInt(denominator));
}

/** Точно переводит конечную десятичную запись числа в дробь. */
export function decimalToFraction(value: number): Fraction {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new TypeError('Значение должно быть конечным числом в безопасном диапазоне');
  }
  if (value === 0) return { numerator: 0, denominator: 1 };

  const [coefficient, exponentText = '0'] = value.toString().toLowerCase().split('e');
  const exponent = Number(exponentText);
  const negative = coefficient.startsWith('-');
  const unsigned = negative ? coefficient.slice(1) : coefficient;
  const [integerPart, fractionalPart = ''] = unsigned.split('.');
  let numerator = BigInt(`${integerPart}${fractionalPart}`);
  let denominator = 10n ** BigInt(fractionalPart.length);

  if (exponent > 0) numerator *= 10n ** BigInt(exponent);
  if (exponent < 0) denominator *= 10n ** BigInt(-exponent);
  if (negative) numerator = -numerator;

  return normalizeBig(numerator, denominator);
}

export function addFractions(left: Fraction, right: Fraction): Fraction {
  const a = toBig(left, 'первое слагаемое');
  const b = toBig(right, 'второе слагаемое');
  return normalizeBig(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

export function subtractFractions(left: Fraction, right: Fraction): Fraction {
  const a = toBig(left, 'уменьшаемое');
  const b = toBig(right, 'вычитаемое');
  return normalizeBig(
    a.numerator * b.denominator - b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

export function multiplyFractions(left: Fraction, right: Fraction): Fraction {
  const a = toBig(left, 'первый множитель');
  const b = toBig(right, 'второй множитель');
  return normalizeBig(a.numerator * b.numerator, a.denominator * b.denominator);
}

export function compareFractions(left: Fraction, right: Fraction): -1 | 0 | 1 {
  const a = toBig(left, 'левая дробь');
  const b = toBig(right, 'правая дробь');
  const sign = b.denominator < 0n !== a.denominator < 0n ? -1n : 1n;
  const difference = sign * (a.numerator * b.denominator - b.numerator * a.denominator);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function fractionToNumber(value: Fraction): number {
  const exact = toBig(value, 'дробь');
  return Number(exact.numerator) / Number(exact.denominator);
}

/** Записывает дробь строкой: «3/8», «2», «−1/4». */
export function formatFraction(value: Fraction): string {
  const normalized = fraction(value.numerator, value.denominator);
  const sign = normalized.numerator < 0 ? '−' : '';
  const numerator = Math.abs(normalized.numerator);
  if (normalized.denominator === 1) return `${sign}${numerator}`;
  return `${sign}${numerator}/${normalized.denominator}`;
}

/** Проверяет, что дробь лежит между 0 и 1 включительно. */
export function isProbability(value: Fraction): boolean {
  const normalized = fraction(value.numerator, value.denominator);
  return normalized.numerator >= 0 && normalized.numerator <= normalized.denominator;
}

function assertProbability(value: Fraction, label: string): Fraction {
  const normalized = fraction(value.numerator, value.denominator);
  if (!isProbability(normalized)) {
    throw new RangeError(`${label} должна лежать между 0 и 1`);
  }
  return normalized;
}

/**
 * Классическое определение: P(A) = m / n при n равновозможных исходах,
 * из которых m благоприятствуют событию A.
 */
export function classicalProbability(favorable: number, total: number): Fraction {
  assertSafeInteger(favorable, 'Число благоприятных исходов');
  assertSafeInteger(total, 'Число всех исходов');
  if (total <= 0) {
    throw new RangeError('Число всех исходов должно быть положительным');
  }
  if (favorable < 0 || favorable > total) {
    throw new RangeError('Число благоприятных исходов должно быть от 0 до числа всех исходов');
  }
  return fraction(favorable, total);
}

/** Вероятность противоположного события: P(Ā) = 1 − P(A). */
export function complementProbability(probability: Fraction): Fraction {
  const p = assertProbability(probability, 'Вероятность события');
  return subtractFractions({ numerator: 1, denominator: 1 }, p);
}

/** Правило умножения: вероятность пути — произведение вероятностей рёбер. */
export function pathProbability(probabilities: readonly Fraction[]): Fraction {
  if (probabilities.length === 0) {
    throw new RangeError('Путь должен содержать хотя бы один шаг');
  }
  let product: Fraction = { numerator: 1, denominator: 1 };
  probabilities.forEach((probability, index) => {
    product = multiplyFractions(product, assertProbability(probability, `Вероятность шага №${index + 1}`));
  });
  return product;
}

function assertCompleteBranch(edges: readonly TreeEdge[], path: readonly string[]): void {
  let sum: Fraction = { numerator: 0, denominator: 1 };
  edges.forEach((edge, index) => {
    sum = addFractions(sum, assertProbability(edge.probability, `Вероятность ребра №${index + 1}`));
  });
  if (sum.numerator !== sum.denominator) {
    const place = path.length === 0 ? 'корне дерева' : `узле «${path.join(' → ')}»`;
    throw new RangeError(`Сумма вероятностей рёбер в ${place} должна равняться 1, а равна ${formatFraction(sum)}`);
  }
}

/**
 * Обходит дерево испытаний и возвращает все пути от корня к листьям
 * с их вероятностями. Проверяет, что в каждом узле ветвления сумма
 * вероятностей исходящих рёбер равна 1.
 */
export function enumerateOutcomes(root: TreeNode): TreeOutcome[] {
  const outcomes: TreeOutcome[] = [];

  const walk = (node: TreeNode, steps: readonly string[], probabilities: readonly Fraction[]): void => {
    const edges = node.edges ?? [];
    if (edges.length === 0) {
      if (steps.length === 0) {
        throw new RangeError('Дерево должно содержать хотя бы один шаг испытания');
      }
      outcomes.push({ steps, probability: pathProbability(probabilities) });
      return;
    }
    assertCompleteBranch(edges, steps);
    for (const edge of edges) {
      walk(edge.child, [...steps, edge.label], [...probabilities, edge.probability]);
    }
  };

  walk(root, [], []);
  return outcomes;
}

/** Сумма вероятностей всех перечисленных исходов; у полного дерева равна 1. */
export function totalProbability(outcomes: readonly TreeOutcome[]): Fraction {
  let sum: Fraction = { numerator: 0, denominator: 1 };
  for (const outcome of outcomes) {
    sum = addFractions(sum, assertProbability(outcome.probability, 'Вероятность исхода'));
  }
  return sum;
}

/** Правило сложения по листьям: событие — сумма вероятностей благоприятных путей. */
export function eventProbability(
  outcomes: readonly TreeOutcome[],
  isFavorable: (outcome: TreeOutcome) => boolean,
): Fraction {
  return totalProbability(outcomes.filter(isFavorable));
}

function toExactValues(values: readonly number[], label: string): BigFraction[] {
  if (values.length === 0) {
    throw new RangeError(`${label}: нужен хотя бы один элемент данных`);
  }
  return values.map((value) => {
    const exact = decimalToFraction(value);
    return { numerator: BigInt(exact.numerator), denominator: BigInt(exact.denominator) };
  });
}

/** Размах ряда: разность наибольшего и наименьшего значений. */
export function rangeOf(values: readonly number[]): Fraction {
  toExactValues(values, 'Размах');
  const smallest = values.reduce((left, right) => Math.min(left, right));
  const largest = values.reduce((left, right) => Math.max(left, right));
  return subtractFractions(decimalToFraction(largest), decimalToFraction(smallest));
}

/** Среднее арифметическое ряда — точной дробью. */
export function meanOf(values: readonly number[]): Fraction {
  const exactValues = toExactValues(values, 'Среднее');
  let numerator = 0n;
  let denominator = 1n;
  for (const value of exactValues) {
    numerator = numerator * value.denominator + value.numerator * denominator;
    denominator *= value.denominator;
  }
  return normalizeBig(numerator, denominator * BigInt(exactValues.length));
}

/** Отклонения каждого значения от среднего; их сумма всегда равна 0. */
export function deviationsFromMean(values: readonly number[]): Fraction[] {
  const mean = meanOf(values);
  return values.map((value) => subtractFractions(decimalToFraction(value), mean));
}

/** Дисперсия (среднее квадратов отклонений) — точной дробью. */
export function populationVariance(values: readonly number[]): Fraction {
  const deviations = deviationsFromMean(values);
  let sum: Fraction = { numerator: 0, denominator: 1 };
  for (const deviation of deviations) {
    sum = addFractions(sum, multiplyFractions(deviation, deviation));
  }
  const big = toBig(sum, 'сумма квадратов отклонений');
  return normalizeBig(big.numerator, big.denominator * BigInt(values.length));
}

/* ─────────────────────────  События как множества исходов  ───────────────────────── */

function assertOutcomeList(values: readonly number[], label: string): void {
  if (!Array.isArray(values)) {
    throw new TypeError(`${label}: нужен массив исходов`);
  }
  values.forEach((value, index) => {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`${label}: исход №${index + 1} должен быть целым числом`);
    }
  });
}

/** Приводит перечень исходов к множеству: без повторов и по возрастанию. */
export function outcomeSet(values: readonly number[]): number[] {
  assertOutcomeList(values, 'Множество исходов');
  return [...new Set(values)].sort((left, right) => left - right);
}

/** Объединение $A\cup B$: исход попадает в него, если принадлежит хотя бы одному событию. */
export function unionOfSets(left: readonly number[], right: readonly number[]): number[] {
  return outcomeSet([...outcomeSet(left), ...outcomeSet(right)]);
}

/** Пересечение $A\cap B$: исходы, принадлежащие обоим событиям сразу. */
export function intersectionOfSets(left: readonly number[], right: readonly number[]): number[] {
  const rightSet = new Set(outcomeSet(right));
  return outcomeSet(left).filter((value) => rightSet.has(value));
}

/** Разность $A\setminus B$: исходы события $A$, которых нет в $B$. */
export function differenceOfSets(left: readonly number[], right: readonly number[]): number[] {
  const rightSet = new Set(outcomeSet(right));
  return outcomeSet(left).filter((value) => !rightSet.has(value));
}

function assertSubset(universe: readonly number[], part: readonly number[]): number[] {
  const all = outcomeSet(universe);
  const allSet = new Set(all);
  const subset = outcomeSet(part);
  for (const value of subset) {
    if (!allSet.has(value)) {
      throw new RangeError(`Исход ${value} не входит в список исходов опыта`);
    }
  }
  return subset;
}

/** Противоположное событие $\bar{A}$: все исходы опыта, которые не входят в $A$. */
export function complementOfSet(universe: readonly number[], part: readonly number[]): number[] {
  assertSubset(universe, part);
  return differenceOfSets(universe, part);
}

/** Два события несовместны, если их пересечение пусто. */
export function areDisjointSets(left: readonly number[], right: readonly number[]): boolean {
  return intersectionOfSets(left, right).length === 0;
}

/** Классическая вероятность события, заданного списком благоприятных исходов. */
export function probabilityOfSet(favorable: readonly number[], universe: readonly number[]): Fraction {
  const all = outcomeSet(universe);
  if (all.length === 0) {
    throw new RangeError('В опыте должен быть хотя бы один исход');
  }
  const subset = assertSubset(all, favorable);
  return classicalProbability(subset.length, all.length);
}

export interface EventPartition {
  /** Исходы события $A$, не попавшие в $B$. */
  onlyLeft: number[];
  /** Исходы пересечения $A\cap B$. */
  both: number[];
  /** Исходы события $B$, не попавшие в $A$. */
  onlyRight: number[];
  /** Исходы опыта вне обоих событий. */
  neither: number[];
}

/** Разбивает все исходы опыта на четыре области диаграммы Эйлера. */
export function partitionByEvents(
  universe: readonly number[],
  left: readonly number[],
  right: readonly number[],
): EventPartition {
  const all = outcomeSet(universe);
  const a = assertSubset(all, left);
  const b = assertSubset(all, right);
  return {
    onlyLeft: differenceOfSets(a, b),
    both: intersectionOfSets(a, b),
    onlyRight: differenceOfSets(b, a),
    neither: differenceOfSets(all, unionOfSets(a, b)),
  };
}

/** Простое ли число: делится только на 1 и на себя, единица простой не считается. */
export function isPrimeNumber(value: number): boolean {
  if (!Number.isSafeInteger(value) || value < 2) return false;
  for (let divisor = 2; divisor * divisor <= value; divisor += 1) {
    if (value % divisor === 0) return false;
  }
  return true;
}

export type NumberEventKind = 'even' | 'odd' | 'multipleOfThree' | 'prime' | 'greaterThanSix';

const NUMBER_EVENT_TESTS: Readonly<Record<NumberEventKind, (value: number) => boolean>> = {
  even: (value) => value % 2 === 0,
  odd: (value) => Math.abs(value % 2) === 1,
  multipleOfThree: (value) => value % 3 === 0,
  prime: (value) => isPrimeNumber(value),
  greaterThanSix: (value) => value > 6,
};

/** Отбирает из исходов опыта те, что благоприятствуют событию заданного вида. */
export function selectOutcomes(universe: readonly number[], kind: NumberEventKind): number[] {
  const test = NUMBER_EVENT_TESTS[kind];
  if (test === undefined) {
    throw new RangeError('Неизвестный вид события');
  }
  return outcomeSet(universe).filter(test);
}

/* ─────────────────────────  Построение деревьев испытаний  ───────────────────────── */

export interface UrnColor {
  /** Подпись исхода: «красный», «синий». */
  label: string;
  /** Сколько таких шаров лежит в мешке в начале опыта. */
  count: number;
}

function assertUrn(colors: readonly UrnColor[], draws: number, withReplacement: boolean): number {
  if (!Array.isArray(colors) || colors.length < 2 || colors.length > 4) {
    throw new RangeError('В мешке должно быть от 2 до 4 разных цветов');
  }
  const labels = new Set<string>();
  let total = 0;
  colors.forEach((color, index) => {
    if (typeof color.label !== 'string' || color.label.trim() === '') {
      throw new TypeError(`У цвета №${index + 1} должна быть подпись`);
    }
    if (!Number.isSafeInteger(color.count) || color.count < 0 || color.count > 50) {
      throw new RangeError(`Число шаров цвета «${color.label}» должно быть целым от 0 до 50`);
    }
    if (labels.has(color.label)) {
      throw new RangeError(`Подпись «${color.label}» встречается дважды`);
    }
    labels.add(color.label);
    total += color.count;
  });
  if (total === 0) throw new RangeError('В мешке должен быть хотя бы один шар');
  if (!Number.isSafeInteger(draws) || draws < 1 || draws > 4) {
    throw new RangeError('Число извлечений должно быть целым от 1 до 4');
  }
  if (!withReplacement && draws > total) {
    throw new RangeError('Без возвращения нельзя вынуть больше шаров, чем лежит в мешке');
  }
  return total;
}

/**
 * Дерево извлечений из мешка. При возвращении состав мешка не меняется и шаги
 * независимы; без возвращения на каждом шаге пересчитываются и числитель, и знаменатель.
 */
export function buildUrnTree(
  colors: readonly UrnColor[],
  draws: number,
  withReplacement: boolean,
): TreeNode {
  assertUrn(colors, draws, withReplacement);

  const grow = (counts: readonly number[], depth: number): TreeNode => {
    if (depth === draws) return {};
    const total = counts.reduce((sum, count) => sum + count, 0);
    const edges: TreeEdge[] = [];
    counts.forEach((count, index) => {
      if (count === 0) return;
      const nextCounts = withReplacement
        ? counts
        : counts.map((value, position) => (position === index ? value - 1 : value));
      edges.push({
        label: colors[index]!.label,
        probability: fraction(count, total),
        child: grow(nextCounts, depth + 1),
      });
    });
    return { edges };
  };

  return grow(colors.map((color) => color.count), 0);
}

export interface StepOutcome {
  label: string;
  probability: Fraction;
}

/**
 * Дерево опыта из независимых шагов: на каждом шаге набор исходов и их
 * вероятности одинаковы во всех узлах этого уровня.
 */
export function buildIndependentTree(steps: readonly (readonly StepOutcome[])[]): TreeNode {
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 4) {
    throw new RangeError('Опыт должен содержать от 1 до 4 шагов');
  }
  steps.forEach((step, index) => {
    if (!Array.isArray(step) || step.length < 2) {
      throw new RangeError(`На шаге №${index + 1} должно быть не меньше двух исходов`);
    }
  });

  const grow = (depth: number): TreeNode => {
    if (depth === steps.length) return {};
    return {
      edges: steps[depth]!.map((outcome: StepOutcome) => ({
        label: outcome.label,
        probability: outcome.probability,
        child: grow(depth + 1),
      })),
    };
  };

  return grow(0);
}

/** Сколько раз подпись встретилась в пути исхода: «ровно один красный» — это 1. */
export function countLabel(outcome: TreeOutcome, label: string): number {
  return outcome.steps.filter((step) => step === label).length;
}

export interface TreeLayoutNode {
  /** Номер узла в порядке обхода дерева сверху вниз. */
  index: number;
  /** Номер узла-родителя; у корня — null. */
  parent: number | null;
  /** Номер шага испытания: корень стоит на глубине 0. */
  depth: number;
  /** Положение по вертикали, измеренное в «строках листьев». */
  row: number;
  /** Подпись ребра, ведущего в узел; у корня — пустая строка. */
  label: string;
  /** Вероятность этого ребра; у корня — null. */
  edgeProbability: Fraction | null;
  /** Произведение вероятностей вдоль пути от корня; у корня — 1. */
  pathProbability: Fraction;
  /** Подписи всех рёбер пути от корня к узлу. */
  steps: readonly string[];
  isLeaf: boolean;
}

/**
 * Раскладка дерева для рисунка: листья занимают последовательные строки,
 * а каждый внутренний узел встаёт ровно посередине между своими потомками.
 */
export function layoutTree(root: TreeNode): TreeLayoutNode[] {
  const nodes: TreeLayoutNode[] = [];
  let leafRow = 0;

  const place = (
    node: TreeNode,
    parent: number | null,
    depth: number,
    label: string,
    edgeProbability: Fraction | null,
    pathProbability: Fraction,
    steps: readonly string[],
  ): number => {
    const index = nodes.length;
    const edges = node.edges ?? [];
    nodes.push({
      index,
      parent,
      depth,
      row: 0,
      label,
      edgeProbability,
      pathProbability,
      steps,
      isLeaf: edges.length === 0,
    });

    if (edges.length === 0) {
      nodes[index]!.row = leafRow;
      leafRow += 1;
      return nodes[index]!.row;
    }

    const childRows = edges.map((edge) =>
      place(
        edge.child,
        index,
        depth + 1,
        edge.label,
        edge.probability,
        multiplyFractions(pathProbability, edge.probability),
        [...steps, edge.label],
      ),
    );
    const row = (Math.min(...childRows) + Math.max(...childRows)) / 2;
    nodes[index]!.row = row;
    return row;
  };

  place(root, null, 0, '', null, { numerator: 1, denominator: 1 }, []);
  return nodes;
}
