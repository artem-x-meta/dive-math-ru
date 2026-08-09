export interface Rational {
  numerator: number;
  denominator: number;
}

export interface PieSector {
  /** Исходное значение категории. */
  value: number;
  /** Точная несократимая доля категории в целом. */
  fraction: Rational;
  /** Доля в процентах (может быть дробной). */
  percent: number;
  /** Центральный угол сектора в градусах: доля · 360°. */
  angle: number;
  /** Начало сектора в градусах от 0 (накопленная сумма предыдущих). */
  startAngle: number;
  /** Конец сектора в градусах; у последнего сектора ровно 360. */
  endAngle: number;
}

export interface AxisScale {
  /** Верхняя граница оси — кратна шагу и не меньше максимума данных. */
  axisMax: number;
  /** Цена деления оси. */
  step: number;
}

export interface TallyRow {
  value: string;
  count: number;
}

function assertFiniteNumber(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} должно быть конечным числом`);
  }
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} должно быть безопасным целым числом`);
  }
}

function gcd(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) {
    [left, right] = [right, left % right];
  }
  return left;
}

/** Сокращает дробь; знаменатель результата всегда положителен. */
export function reduceFraction(numerator: number, denominator: number): Rational {
  assertSafeInteger(numerator, 'Числитель');
  assertSafeInteger(denominator, 'Знаменатель');
  if (denominator === 0) {
    throw new RangeError('Знаменатель дроби не может быть равен нулю');
  }
  if (numerator === 0) return { numerator: 0, denominator: 1 };

  const divisor = gcd(numerator, denominator);
  const sign = denominator < 0 ? -1 : 1;
  return {
    numerator: (sign * numerator) / divisor,
    denominator: (sign * denominator) / divisor,
  };
}

/** Сумма ряда данных. Пустой ряд имеет сумму 0. */
export function sumValues(values: readonly number[]): number {
  values.forEach((value, index) => assertFiniteNumber(value, `Значение №${index + 1}`));
  return values.reduce((total, value) => total + value, 0);
}

/** Среднее арифметическое: сумма значений, делённая на их количество. */
export function arithmeticMean(values: readonly number[]): number {
  if (values.length === 0) {
    throw new RangeError('Среднее арифметическое пустого ряда не определено');
  }
  return sumValues(values) / values.length;
}

/** Среднее целочисленного ряда точной несократимой дробью. */
export function meanAsRational(values: readonly number[]): Rational {
  if (values.length === 0) {
    throw new RangeError('Среднее арифметическое пустого ряда не определено');
  }
  values.forEach((value, index) => assertSafeInteger(value, `Значение №${index + 1}`));
  return reduceFraction(sumValues(values), values.length);
}

/**
 * Какое значение нужно добавить к ряду, чтобы среднее нового ряда
 * стало равно targetMean: x = target · (n + 1) − сумма известных.
 */
export function missingValueForMean(values: readonly number[], targetMean: number): number {
  assertFiniteNumber(targetMean, 'Целевое среднее');
  return targetMean * (values.length + 1) - sumValues(values);
}

/** Центральный угол сектора: часть от целого, переведённая в градусы. */
export function sectorAngle(part: number, whole: number): number {
  assertFiniteNumber(part, 'Часть');
  assertFiniteNumber(whole, 'Целое');
  if (whole <= 0) throw new RangeError('Целое должно быть положительным');
  if (part < 0) throw new RangeError('Часть не может быть отрицательной');
  if (part > whole) throw new RangeError('Часть не может быть больше целого');
  return (part * 360) / whole;
}

/**
 * Разбивает целое на секторы круговой диаграммы. Значения — неотрицательные
 * целые с положительной суммой. Границы секторов считаются от накопленных
 * сумм, поэтому последний сектор заканчивается ровно на 360°.
 */
export function pieSectors(values: readonly number[]): PieSector[] {
  values.forEach((value, index) => {
    assertSafeInteger(value, `Значение №${index + 1}`);
    if (value < 0) throw new RangeError(`Значение №${index + 1} не может быть отрицательным`);
  });
  const total = sumValues(values);
  if (total <= 0) {
    throw new RangeError('Сумма значений круговой диаграммы должна быть положительной');
  }

  let cumulative = 0;
  return values.map((value) => {
    const startAngle = (cumulative * 360) / total;
    cumulative += value;
    const endAngle = (cumulative * 360) / total;
    return {
      value,
      fraction: reduceFraction(value, total),
      percent: (value * 100) / total,
      angle: (value * 360) / total,
      startAngle,
      endAngle,
    };
  });
}

const STEP_MANTISSAS = [1, 2, 5] as const;

/**
 * Подбирает цену деления оси из ряда 1, 2, 5, 10, 20, 50, … так, чтобы
 * делений было не больше maxTicks, а верхняя граница накрывала данные.
 */
export function axisScale(maxValue: number, maxTicks = 5): AxisScale {
  assertFiniteNumber(maxValue, 'Максимум данных');
  assertSafeInteger(maxTicks, 'Число делений');
  if (maxTicks < 1) throw new RangeError('Нужно хотя бы одно деление оси');
  const target = Math.max(maxValue, 1);

  for (let power = 1; power <= 1e15; power *= 10) {
    for (const mantissa of STEP_MANTISSAS) {
      const step = mantissa * power;
      if (Math.ceil(target / step) <= maxTicks) {
        return { axisMax: Math.ceil(target / step) * step, step };
      }
    }
  }
  throw new RangeError('Максимум данных слишком велик для шкалы');
}

/**
 * Правило умножения: общее число вариантов — произведение числа вариантов
 * на каждом шаге выбора.
 */
export function countVariants(optionCounts: readonly number[]): number {
  if (optionCounts.length === 0) {
    throw new RangeError('Нужен хотя бы один шаг выбора');
  }
  optionCounts.forEach((count, index) => {
    assertSafeInteger(count, `Число вариантов на шаге №${index + 1}`);
    if (count < 0) throw new RangeError(`Число вариантов на шаге №${index + 1} не может быть отрицательным`);
  });
  const product = optionCounts.reduce((total, count) => total * count, 1);
  if (!Number.isSafeInteger(product)) {
    throw new RangeError('Число вариантов выходит за диапазон безопасных целых чисел');
  }
  return product;
}

/**
 * Систематический перебор: все комбинации по одному варианту с каждого шага.
 * Первый шаг меняется медленнее всех — как ветви в дереве вариантов.
 */
export function cartesianProduct<T>(groups: readonly (readonly T[])[]): T[][] {
  let combinations: T[][] = [[]];
  for (const group of groups) {
    const extended: T[][] = [];
    for (const combination of combinations) {
      for (const option of group) {
        extended.push([...combination, option]);
      }
    }
    combinations = extended;
  }
  return combinations;
}

/** Число неупорядоченных пар из n объектов: n(n − 1) / 2. */
export function pairCount(n: number): number {
  assertSafeInteger(n, 'Число объектов');
  if (n < 0) throw new RangeError('Число объектов не может быть отрицательным');
  return (n * (n - 1)) / 2;
}

/** Частотная таблица: значения в порядке первого появления. */
export function tally(items: readonly string[]): TallyRow[] {
  const rows: TallyRow[] = [];
  const index = new Map<string, TallyRow>();
  for (const item of items) {
    const row = index.get(item);
    if (row) {
      row.count += 1;
    } else {
      const created = { value: item, count: 1 };
      index.set(item, created);
      rows.push(created);
    }
  }
  return rows;
}
