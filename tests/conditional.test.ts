import { describe, expect, it } from 'vitest';
import {
  areIndependent,
  assertTwoWayTable,
  bayesPosterior,
  bayesTable,
  conditionalDistribution,
  conditionalProbability,
  distributionOfSum,
  distributionVariance,
  expectedIndependentCount,
  independenceGap,
  isTableIndependent,
  leftCount,
  leftGivenNotRight,
  leftGivenRight,
  matchesProbability,
  multiplicationRule,
  naturalFrequencies,
  negativePredictiveValue,
  parseAnswerFraction,
  positivePredictiveValue,
  probabilityOfBoth,
  probabilityOfLeft,
  probabilityOfRight,
  rightCount,
  rightGivenLeft,
  screeningBranches,
  screeningToTable,
  smallestExactPopulation,
  tableTotal,
  totalProbabilityOf,
  type BayesBranch,
  type TwoWayTable,
} from '../src/lib/conditional';
import {
  bernoulliDistribution,
  distributionOfEqualOutcomes,
  distributionTotal,
  expectedValue,
  finiteExperimentDistribution,
} from '../src/lib/combinatorics';
import { addFractions, fraction } from '../src/lib/probability';

/** 250 учеников: A — делал домашнюю работу, B — справился с контрольной. */
const HOMEWORK: TwoWayTable = { both: 80, leftOnly: 20, rightOnly: 45, neither: 105 };

/** 200 деталей с двух станков: A — станок №1, B — брак. Признаки независимы. */
const MACHINES: TwoWayTable = { both: 6, leftOnly: 114, rightOnly: 4, neither: 76 };

describe('таблица частот 2 × 2', () => {
  it('считает итоги строк, столбцов и всей таблицы', () => {
    expect(tableTotal(HOMEWORK)).toBe(250);
    expect(leftCount(HOMEWORK)).toBe(100);
    expect(rightCount(HOMEWORK)).toBe(125);
  });

  it('переводит частоты в вероятности несократимыми дробями', () => {
    expect(probabilityOfLeft(HOMEWORK)).toEqual({ numerator: 2, denominator: 5 });
    expect(probabilityOfRight(HOMEWORK)).toEqual({ numerator: 1, denominator: 2 });
    expect(probabilityOfBoth(HOMEWORK)).toEqual({ numerator: 8, denominator: 25 });
  });

  it('отклоняет нецелые, отрицательные и пустые таблицы', () => {
    expect(() => assertTwoWayTable({ both: 1.5, leftOnly: 1, rightOnly: 1, neither: 1 })).toThrow('целым неотрицательным');
    expect(() => assertTwoWayTable({ both: -1, leftOnly: 1, rightOnly: 1, neither: 1 })).toThrow('целым неотрицательным');
    expect(() => assertTwoWayTable({ both: 0, leftOnly: 0, rightOnly: 0, neither: 0 })).toThrow('хотя бы один объект');
  });
});

describe('условная вероятность', () => {
  it('совпадает с долей внутри строки и внутри столбца', () => {
    // P(делал | справился) = 80/125, P(справился | делал) = 80/100.
    expect(leftGivenRight(HOMEWORK)).toEqual({ numerator: 16, denominator: 25 });
    expect(rightGivenLeft(HOMEWORK)).toEqual({ numerator: 4, denominator: 5 });
    expect(leftGivenNotRight(HOMEWORK)).toEqual({ numerator: 4, denominator: 25 });
  });

  it('даёт тот же ответ по определению через вероятности', () => {
    const byDefinition = conditionalProbability(probabilityOfBoth(HOMEWORK), probabilityOfRight(HOMEWORK));
    expect(byDefinition).toEqual(leftGivenRight(HOMEWORK));
  });

  it('возвращает правило умножения обратно к вероятности пересечения', () => {
    const restored = multiplicationRule(probabilityOfRight(HOMEWORK), leftGivenRight(HOMEWORK));
    expect(restored).toEqual(probabilityOfBoth(HOMEWORK));
  });

  it('не определена при нулевом условии и при слишком большом пересечении', () => {
    expect(() => conditionalProbability(fraction(0, 1), fraction(0, 1))).toThrow('равна нулю');
    expect(() => conditionalProbability(fraction(1, 2), fraction(1, 3))).toThrow('не может быть больше');
    expect(() => leftGivenRight({ both: 0, leftOnly: 4, rightOnly: 0, neither: 6 })).toThrow('не произошло ни разу');
    expect(() => leftGivenNotRight({ both: 4, leftOnly: 0, rightOnly: 6, neither: 0 })).toThrow('произошло всегда');
  });
});

describe('независимость событий', () => {
  it('распознаёт независимость по произведению вероятностей', () => {
    expect(isTableIndependent(MACHINES)).toBe(true);
    expect(isTableIndependent(HOMEWORK)).toBe(false);
    expect(areIndependent(fraction(3, 5), fraction(1, 20), fraction(3, 100))).toBe(true);
    expect(areIndependent(fraction(1, 2), fraction(1, 2), fraction(1, 3))).toBe(false);
  });

  it('у независимых признаков условная вероятность равна безусловной', () => {
    expect(rightGivenLeft(MACHINES)).toEqual(probabilityOfRight(MACHINES));
    expect(leftGivenRight(MACHINES)).toEqual(probabilityOfLeft(MACHINES));
  });

  it('измеряет отклонение от независимости и ожидаемую частоту клетки', () => {
    expect(independenceGap(MACHINES)).toEqual({ numerator: 0, denominator: 1 });
    expect(independenceGap(HOMEWORK)).toEqual({ numerator: 3, denominator: 25 });
    expect(expectedIndependentCount(HOMEWORK)).toEqual({ numerator: 50, denominator: 1 });
    expect(expectedIndependentCount(MACHINES)).toEqual({ numerator: 6, denominator: 1 });
  });

  it('несовместные события с положительными вероятностями зависимы', () => {
    const disjoint: TwoWayTable = { both: 0, leftOnly: 30, rightOnly: 20, neither: 50 };
    expect(isTableIndependent(disjoint)).toBe(false);
  });
});

describe('полная вероятность и формула Байеса', () => {
  /** 60 % деталей с первого завода (брак 2 %), 40 % со второго (брак 5 %). */
  const PLANTS: BayesBranch[] = [
    { label: 'первый завод', prior: fraction(3, 5), conditional: fraction(1, 50) },
    { label: 'второй завод', prior: fraction(2, 5), conditional: fraction(1, 20) },
  ];

  it('складывает вклады гипотез в полную вероятность', () => {
    expect(totalProbabilityOf(PLANTS)).toEqual({ numerator: 4, denominator: 125 });
  });

  it('переворачивает условную вероятность', () => {
    expect(bayesPosterior(PLANTS, 0)).toEqual({ numerator: 3, denominator: 8 });
    expect(bayesPosterior(PLANTS, 1)).toEqual({ numerator: 5, denominator: 8 });
  });

  it('строит полную таблицу разбора, сумма апостериорных вероятностей равна 1', () => {
    const rows = bayesTable(PLANTS);
    expect(rows.map((row) => row.joint)).toEqual([
      { numerator: 3, denominator: 250 },
      { numerator: 1, denominator: 50 },
    ]);
    const posteriorSum = rows.reduce(
      (sum, row) => addFractions(sum, row.posterior),
      fraction(0, 1),
    );
    expect(posteriorSum).toEqual({ numerator: 1, denominator: 1 });
  });

  it('требует полную группу гипотез', () => {
    expect(() => totalProbabilityOf([PLANTS[0]!])).toThrow('не меньше двух гипотез');
    expect(() => totalProbabilityOf([
      { label: 'A', prior: fraction(1, 2), conditional: fraction(1, 2) },
      { label: 'B', prior: fraction(1, 3), conditional: fraction(1, 2) },
    ])).toThrow('должна равняться 1');
    expect(() => bayesTable([
      { label: 'A', prior: fraction(1, 2), conditional: fraction(0, 1) },
      { label: 'B', prior: fraction(1, 2), conditional: fraction(0, 1) },
    ])).toThrow('не применима');
  });
});

describe('природные частоты и тест на редкую болезнь', () => {
  const SCREENING = naturalFrequencies({
    population: 10_000,
    prevalence: '1/100',
    sensitivity: '0,9',
    specificity: '0,9',
  });

  it('раскладывает 10 000 человек по клеткам целыми числами', () => {
    expect(SCREENING).toEqual({
      population: 10_000,
      sick: 100,
      healthy: 9_900,
      truePositive: 90,
      falseNegative: 10,
      falsePositive: 990,
      trueNegative: 8_910,
    });
    expect(tableTotal(screeningToTable(SCREENING))).toBe(10_000);
  });

  it('положительный тест при редкой болезни ещё не приговор', () => {
    expect(positivePredictiveValue(SCREENING)).toEqual({ numerator: 1, denominator: 12 });
    expect(negativePredictiveValue(SCREENING)).toEqual({ numerator: 891, denominator: 892 });
  });

  it('даёт тот же ответ через формулу Байеса', () => {
    const branches = screeningBranches(SCREENING);
    expect(branches[0]!.prior).toEqual({ numerator: 1, denominator: 100 });
    expect(branches[0]!.conditional).toEqual({ numerator: 9, denominator: 10 });
    expect(totalProbabilityOf(branches)).toEqual({ numerator: 27, denominator: 250 });
    expect(bayesPosterior(branches, 0)).toEqual(positivePredictiveValue(SCREENING));
  });

  it('редкая болезнь делает ложные тревоги ещё заметнее', () => {
    const rare = naturalFrequencies({
      population: 100_000,
      prevalence: '1/1000',
      sensitivity: '0,99',
      specificity: '0,95',
    });
    expect(rare.sick).toBe(100);
    expect(rare.truePositive).toBe(99);
    expect(rare.falsePositive).toBe(4_995);
    expect(positivePredictiveValue(rare)).toEqual({ numerator: 11, denominator: 566 });
  });

  it('честно отказывается округлять дробное число людей', () => {
    expect(() => naturalFrequencies({
      population: 10_000,
      prevalence: '1/1000',
      sensitivity: '0,99',
      specificity: '0,95',
    })).toThrow('получилось дробным');
    expect(() => naturalFrequencies({
      population: 1_000,
      prevalence: '1/3',
      sensitivity: '0,9',
      specificity: '0,9',
    })).toThrow('получилось дробным');
  });

  it('подбирает наименьшую подходящую численность группы', () => {
    expect(smallestExactPopulation({ prevalence: '1/100', sensitivity: '0,9', specificity: '0,9' }, 10_000)).toBe(10_000);
    expect(smallestExactPopulation({ prevalence: '1/1000', sensitivity: '0,99', specificity: '0,95' }, 10_000)).toBe(100_000);
    expect(smallestExactPopulation({ prevalence: '1/200', sensitivity: '0,99', specificity: '0,99' }, 10_000)).toBe(20_000);

    const setup = { prevalence: '1/200', sensitivity: '0,99', specificity: '0,99' } as const;
    const population = smallestExactPopulation(setup, 10_000);
    expect(() => naturalFrequencies({ ...setup, population })).not.toThrow();
  });

  it('проверяет допустимость долей', () => {
    expect(() => naturalFrequencies({
      population: 100,
      prevalence: '1,5',
      sensitivity: '0,9',
      specificity: '0,9',
    })).toThrow('между 0 и 1');
    expect(() => naturalFrequencies({
      population: 0,
      prevalence: '0,1',
      sensitivity: '0,9',
      specificity: '0,9',
    })).toThrow('Численность группы должна быть');
  });
});

describe('дискретные распределения', () => {
  const DIE = distributionOfEqualOutcomes([1, 2, 3, 4, 5, 6]);
  const TWO_DICE = finiteExperimentDistribution('twoDiceSum');

  it('сумма двух независимых кубиков совпадает с перебором 36 исходов', () => {
    expect(distributionOfSum(DIE, DIE)).toEqual(TWO_DICE);
  });

  it('условное распределение снова суммируется в единицу', () => {
    const even = conditionalDistribution(TWO_DICE, (value) => value % 2 === 0);
    expect(distributionTotal(even)).toEqual({ numerator: 1, denominator: 1 });
    expect(even[0]).toEqual({ value: 2, probability: { numerator: 1, denominator: 18 } });
    expect(expectedValue(even)).toEqual({ numerator: 7, denominator: 1 });
  });

  it('условие смещает математическое ожидание', () => {
    const large = conditionalDistribution(TWO_DICE, (value) => value >= 8);
    expect(large.map((entry) => entry.probability)).toEqual([
      { numerator: 1, denominator: 3 },
      { numerator: 4, denominator: 15 },
      { numerator: 1, denominator: 5 },
      { numerator: 2, denominator: 15 },
      { numerator: 1, denominator: 15 },
    ]);
    expect(expectedValue(large)).toEqual({ numerator: 28, denominator: 3 });
  });

  it('считает дисперсию точной дробью', () => {
    expect(distributionVariance(DIE)).toEqual({ numerator: 35, denominator: 12 });
    // Для схемы Бернулли D(X) = npq = 3 · 1/2 · 1/2.
    expect(distributionVariance(bernoulliDistribution(3, fraction(1, 2)))).toEqual({ numerator: 3, denominator: 4 });
  });

  it('отвергает неполные распределения и невозможные условия', () => {
    const broken = [
      { value: 0, probability: fraction(1, 3) },
      { value: 1, probability: fraction(1, 3) },
    ];
    expect(() => distributionVariance(broken)).toThrow('должна равняться 1');
    expect(() => conditionalDistribution(TWO_DICE, (value) => value > 100)).toThrow('Условие невозможно');
  });
});

describe('разбор ответа читателя', () => {
  it('понимает обыкновенные и десятичные дроби', () => {
    expect(parseAnswerFraction('1/12')).toEqual({ numerator: 1, denominator: 12 });
    expect(parseAnswerFraction(' 8 / 10 ')).toEqual({ numerator: 4, denominator: 5 });
    expect(parseAnswerFraction('0,083')).toEqual({ numerator: 83, denominator: 1000 });
    expect(parseAnswerFraction('0.75')).toEqual({ numerator: 3, denominator: 4 });
    expect(parseAnswerFraction('1')).toEqual({ numerator: 1, denominator: 1 });
  });

  it('отвергает мусор и отрицательные ответы', () => {
    expect(parseAnswerFraction('')).toBeNull();
    expect(parseAnswerFraction('почти половина')).toBeNull();
    expect(parseAnswerFraction('1/0')).toBeNull();
    expect(parseAnswerFraction('-1/2')).toBeNull();
  });

  it('принимает округлённый ответ в пределах допуска', () => {
    const target = fraction(1, 12);
    expect(matchesProbability(fraction(1, 12), target)).toBe(true);
    expect(matchesProbability(parseAnswerFraction('0,083')!, target)).toBe(true);
    expect(matchesProbability(parseAnswerFraction('0,08')!, target)).toBe(false);
    expect(matchesProbability(fraction(9, 10), target)).toBe(false);
  });
});
