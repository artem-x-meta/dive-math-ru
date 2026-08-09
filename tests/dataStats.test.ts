import { describe, expect, it } from 'vitest';
import {
  arithmeticMean,
  axisScale,
  cartesianProduct,
  countVariants,
  formatMean,
  meanAsRational,
  missingValueForMean,
  pairCount,
  pieSectors,
  polarPoint,
  reduceFraction,
  sectorAngle,
  sectorPath,
  sumValues,
  tally,
  unorderedPairs,
  variantTreeLayout,
} from '../src/lib/dataStats';

describe('доли и сокращение дробей', () => {
  it('сокращает дробь и держит знаменатель положительным', () => {
    expect(reduceFraction(9, 24)).toEqual({ numerator: 3, denominator: 8 });
    expect(reduceFraction(4, -24)).toEqual({ numerator: -1, denominator: 6 });
    expect(reduceFraction(0, 7)).toEqual({ numerator: 0, denominator: 1 });
  });

  it('отвергает нулевой знаменатель и нецелые входные данные', () => {
    expect(() => reduceFraction(3, 0)).toThrow('не может быть равен нулю');
    expect(() => reduceFraction(1.5, 2)).toThrow('безопасным целым');
  });
});

describe('сумма и среднее арифметическое', () => {
  it('складывает ряд и считает среднее', () => {
    expect(sumValues([12, 15, 11, 14, 13])).toBe(65);
    expect(sumValues([])).toBe(0);
    expect(arithmeticMean([12, 15, 11, 14, 13])).toBe(13);
    expect(arithmeticMean([3, 4, 4, 5, 5])).toBe(4.2);
  });

  it('даёт точную дробь, когда деление не заканчивается', () => {
    expect(meanAsRational([3, 4, 4, 5])).toEqual({ numerator: 4, denominator: 1 });
    expect(meanAsRational([1, 2])).toEqual({ numerator: 3, denominator: 2 });
    expect(meanAsRational([1, 2, 3, 5])).toEqual({ numerator: 11, denominator: 4 });
    expect(meanAsRational([1, 1, 2])).toEqual({ numerator: 4, denominator: 3 });
  });

  it('записывает среднее по-русски: десятичной или обыкновенной дробью', () => {
    expect(formatMean([12, 15, 11, 14, 13])).toBe('13');
    expect(formatMean([3, 4, 4, 5, 5])).toBe('4,2');
    expect(formatMean([1, 2, 3, 5])).toBe('2,75');
    expect(formatMean([1, 1, 2])).toBe('4/3');
  });

  it('находит недостающее значение по требуемому среднему', () => {
    expect(missingValueForMean([3, 4, 4, 5], 4)).toBe(4);
    expect(missingValueForMean([4, 5, 3, 4, 4], 4.5)).toBe(7);
    expect(missingValueForMean([], 6)).toBe(6);
  });

  it('отказывается усреднять пустой ряд', () => {
    expect(() => arithmeticMean([])).toThrow('пустого ряда');
    expect(() => meanAsRational([])).toThrow('пустого ряда');
    expect(() => sumValues([Number.POSITIVE_INFINITY])).toThrow('конечным числом');
  });
});

describe('шкала столбчатой диаграммы', () => {
  it('подбирает цену деления из ряда 1, 2, 5, 10, …', () => {
    expect(axisScale(9)).toEqual({ axisMax: 10, step: 2 });
    expect(axisScale(25)).toEqual({ axisMax: 25, step: 5 });
    expect(axisScale(4)).toEqual({ axisMax: 4, step: 1 });
    expect(axisScale(37)).toEqual({ axisMax: 40, step: 10 });
    expect(axisScale(120)).toEqual({ axisMax: 150, step: 50 });
  });

  it('никогда не обрезает данные и уважает число делений', () => {
    for (const maximum of [1, 3, 7, 18, 44, 99, 260, 1001]) {
      const scale = axisScale(maximum);
      expect(scale.axisMax).toBeGreaterThanOrEqual(maximum);
      expect(scale.axisMax % scale.step).toBe(0);
      expect(scale.axisMax / scale.step).toBeLessThanOrEqual(5);
    }
    expect(axisScale(9, 10)).toEqual({ axisMax: 9, step: 1 });
  });

  it('проверяет аргументы', () => {
    expect(axisScale(0)).toEqual({ axisMax: 1, step: 1 });
    expect(() => axisScale(10, 0)).toThrow('хотя бы одно деление');
    expect(() => axisScale(Number.NaN)).toThrow('конечным числом');
  });
});

describe('круговая диаграмма', () => {
  it('переводит часть от целого в градусы', () => {
    expect(sectorAngle(9, 24)).toBe(135);
    expect(sectorAngle(1, 4)).toBe(90);
    expect(sectorAngle(0, 24)).toBe(0);
    expect(sectorAngle(24, 24)).toBe(360);
  });

  it('делит сутки на секторы точно, без потери градусов', () => {
    const sectors = pieSectors([9, 7, 2, 4, 2]);
    expect(sectors.map((sector) => sector.angle)).toEqual([135, 105, 30, 60, 30]);
    expect(sectors.map((sector) => sector.fraction)).toEqual([
      { numerator: 3, denominator: 8 },
      { numerator: 7, denominator: 24 },
      { numerator: 1, denominator: 12 },
      { numerator: 1, denominator: 6 },
      { numerator: 1, denominator: 12 },
    ]);
    expect(sectors[0]?.percent).toBe(37.5);
    expect(sectors[0]?.startAngle).toBe(0);
    expect(sectors[4]?.endAngle).toBe(360);
    expect(sectors.reduce((total, sector) => total + sector.angle, 0)).toBe(360);
  });

  it('пропускает нулевые категории и не теряет замыкание круга', () => {
    const sectors = pieSectors([5, 0, 5]);
    expect(sectors[1]?.angle).toBe(0);
    expect(sectors[1]?.startAngle).toBe(180);
    expect(sectors[1]?.endAngle).toBe(180);
    expect(sectors[2]?.endAngle).toBe(360);
  });

  it('требует положительной суммы и неотрицательных значений', () => {
    expect(() => pieSectors([0, 0])).toThrow('положительной');
    expect(() => pieSectors([3, -1])).toThrow('не может быть отрицательным');
    expect(() => sectorAngle(5, 4)).toThrow('не может быть больше целого');
    expect(() => sectorAngle(1, 0)).toThrow('положительным');
  });
});

describe('геометрия секторов', () => {
  it('ставит нулевой угол на «двенадцать часов» и идёт по часовой стрелке', () => {
    expect(polarPoint(10, 0)).toEqual({ x: 0, y: -10 });
    expect(polarPoint(10, 90)).toEqual({ x: 10, y: 0 });
    expect(polarPoint(10, 180)).toEqual({ x: 0, y: 10 });
    expect(polarPoint(10, 270)).toEqual({ x: -10, y: 0 });
    expect(polarPoint(0, 37)).toEqual({ x: 0, y: 0 });
  });

  it('точка окружности действительно лежит на окружности', () => {
    for (const angle of [17, 63, 135, 244, 359]) {
      const point = polarPoint(100, angle);
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(100, 2);
    }
  });

  it('строит контур сектора с правильным флагом большой дуги', () => {
    expect(sectorPath(100, 0, 90)).toBe('M 0 0 L 0 -100 A 100 100 0 0 1 100 0 Z');
    expect(sectorPath(100, 0, 270)).toBe('M 0 0 L 0 -100 A 100 100 0 1 1 -100 0 Z');
    expect(sectorPath(100, 90, 90)).toBe('');
    expect(sectorPath(100, 0, 360)).toBe(
      'M 0 -100 A 100 100 0 1 1 0 100 A 100 100 0 1 1 0 -100 Z',
    );
  });

  it('проверяет аргументы контура', () => {
    expect(() => sectorPath(0, 0, 90)).toThrow('положительным');
    expect(() => sectorPath(100, 90, 30)).toThrow('меньше начального');
    expect(() => sectorPath(100, 0, 400)).toThrow('полного круга');
  });
});

describe('перебор вариантов', () => {
  it('перемножает число вариантов на каждом шаге', () => {
    expect(countVariants([3, 2])).toBe(6);
    expect(countVariants([3, 3, 2])).toBe(18);
    expect(countVariants([5])).toBe(5);
    expect(countVariants([4, 0])).toBe(0);
  });

  it('перечисляет комбинации так, что первый шаг меняется медленнее всех', () => {
    expect(cartesianProduct([['чай', 'сок'], ['сыр', 'мёд']])).toEqual([
      ['чай', 'сыр'],
      ['чай', 'мёд'],
      ['сок', 'сыр'],
      ['сок', 'мёд'],
    ]);
    expect(cartesianProduct([])).toEqual([[]]);
    expect(cartesianProduct([['a'], []])).toEqual([]);
  });

  it('число комбинаций совпадает с правилом умножения', () => {
    const groups = [['1', '2', '3'], ['x', 'y'], ['+', '-']];
    expect(cartesianProduct(groups)).toHaveLength(countVariants(groups.map((group) => group.length)));
  });

  it('считает и перечисляет неупорядоченные пары', () => {
    expect(pairCount(5)).toBe(10);
    expect(pairCount(1)).toBe(0);
    expect(pairCount(0)).toBe(0);
    expect(unorderedPairs(['А', 'Б', 'В'])).toEqual([
      ['А', 'Б'],
      ['А', 'В'],
      ['Б', 'В'],
    ]);
    const teams = ['А', 'Б', 'В', 'Г', 'Д'];
    expect(unorderedPairs(teams)).toHaveLength(pairCount(teams.length));
  });

  it('проверяет аргументы перебора', () => {
    expect(() => countVariants([])).toThrow('хотя бы один шаг');
    expect(() => countVariants([2, -1])).toThrow('не может быть отрицательным');
    expect(() => pairCount(-3)).toThrow('не может быть отрицательным');
  });
});

describe('разметка дерева вариантов', () => {
  const groups = [['чай', 'сок'], ['сыр', 'мёд', 'джем']];
  const nodes = variantTreeLayout(groups);

  it('содержит корень, ветви и по одному листу на каждый вариант', () => {
    expect(nodes.filter((node) => node.depth === 0)).toHaveLength(1);
    expect(nodes.filter((node) => node.depth === 1)).toHaveLength(2);
    expect(nodes.filter((node) => node.depth === 2)).toHaveLength(6);
  });

  it('ставит листья в подряд идущие строки в порядке систематического перебора', () => {
    const leaves = nodes.filter((node) => node.depth === 2);
    expect(leaves.map((leaf) => leaf.row)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(leaves.map((leaf) => leaf.path)).toEqual(cartesianProduct(groups));
  });

  it('ставит ветвь ровно посередине её листьев', () => {
    const branches = nodes.filter((node) => node.depth === 1);
    expect(branches.map((branch) => branch.row)).toEqual([1, 4]);
    expect(nodes[0]?.row).toBe(2.5);
    expect(nodes[0]?.parentRow).toBeNull();
    expect(nodes[0]?.label).toBe('Старт');
    expect(branches.every((branch) => branch.parentRow === 2.5)).toBe(true);
  });

  it('работает с одним шагом и с пустым списком шагов', () => {
    expect(variantTreeLayout([['A', 'B']]).map((node) => node.row)).toEqual([0.5, 0, 1]);
    expect(variantTreeLayout([], 'Начало')).toEqual([
      { label: 'Начало', depth: 0, row: 0, parentRow: null, path: [] },
    ]);
  });

  it('не принимает шаг без вариантов', () => {
    expect(() => variantTreeLayout([['A'], []])).toThrow('нет ни одного варианта');
  });
});

describe('частотная таблица', () => {
  it('считает повторы в порядке первого появления', () => {
    expect(tally(['да', 'нет', 'да', 'да', 'иногда', 'нет'])).toEqual([
      { value: 'да', count: 3 },
      { value: 'нет', count: 2 },
      { value: 'иногда', count: 1 },
    ]);
    expect(tally([])).toEqual([]);
  });

  it('сумма частот равна числу наблюдений', () => {
    const answers = ['футбол', 'шахматы', 'футбол', 'плавание', 'футбол', 'шахматы'];
    expect(sumValues(tally(answers).map((row) => row.count))).toBe(answers.length);
  });
});
