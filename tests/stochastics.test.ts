import { describe, expect, it } from 'vitest';
import {
  chebyshevBound,
  correlationCoefficient,
  dataStandardDeviation,
  diceSumDistribution,
  fairPrice,
  gameDistribution,
  marginOfError,
  netExpectation,
  normalBandProbability,
  normalCdf,
  normalDensity,
  requiredSampleSize,
  shareInterval,
  shiftDistribution,
  sigmaComparison,
  simulateSampleShares,
  standardDeviation,
  standardError,
  standardScore,
  varianceThroughSquares,
  withinSigmaProbability,
} from '../src/lib/stochastics';
import { distributionTotal, expectedValue } from '../src/lib/combinatorics';
import { distributionVariance } from '../src/lib/conditional';
import { fraction, fractionToNumber } from '../src/lib/probability';
import { roundTo } from '../src/lib/statistics';

/** Аттракцион: бросаешь кубик, получаешь 10·k рублей. */
const CUBE_GAME = [1, 2, 3, 4, 5, 6].map((face) => ({
  label: `${face} очков`,
  payoff: 10 * face,
  probability: fraction(1, 6),
}));

/** Надёжный конверт: 30 ₽ или 40 ₽ поровну. */
const STEADY_GAME = [
  { label: 'меньший конверт', payoff: 30, probability: fraction(1, 2) },
  { label: 'больший конверт', payoff: 40, probability: fraction(1, 2) },
];

/** Джекпот: почти всегда ноль, изредка 3500 ₽. */
const JACKPOT_GAME = [
  { label: 'пусто', payoff: 0, probability: fraction(99, 100) },
  { label: 'джекпот', payoff: 3500, probability: fraction(1, 100) },
];

/** Убыток владельца велосипеда за год без страховки. */
const BIKE_LOSS = [
  { label: 'ничего не случилось', payoff: 0, probability: fraction(49, 50) },
  { label: 'велосипед пропал', payoff: 20_000, probability: fraction(1, 50) },
];

describe('распределение игры', () => {
  it('объединяет одинаковые выплаты и упорядочивает значения', () => {
    const entries = gameDistribution([
      { label: 'пусто', payoff: 0, probability: fraction(1, 4) },
      { label: 'тоже пусто', payoff: 0, probability: fraction(1, 4) },
      { label: 'приз', payoff: 100, probability: fraction(1, 2) },
    ]);
    expect(entries).toEqual([
      { value: 0, probability: { numerator: 1, denominator: 2 } },
      { value: 100, probability: { numerator: 1, denominator: 2 } },
    ]);
  });

  it('требует полной группы исходов и целых выплат', () => {
    expect(() =>
      gameDistribution([
        { label: 'a', payoff: 0, probability: fraction(1, 3) },
        { label: 'b', payoff: 10, probability: fraction(1, 3) },
      ]),
    ).toThrow('должна равняться 1');
    expect(() =>
      gameDistribution([
        { label: 'a', payoff: 0.5, probability: fraction(1, 2) },
        { label: 'b', payoff: 10, probability: fraction(1, 2) },
      ]),
    ).toThrow('целым числом рублей');
    expect(() => gameDistribution([{ label: 'a', payoff: 0, probability: fraction(1, 1) }])).toThrow(
      'не меньше двух исходов',
    );
  });

  it('сдвигает все значения на цену игры', () => {
    const net = shiftDistribution(gameDistribution(STEADY_GAME), -35);
    expect(net.map((entry) => entry.value)).toEqual([-5, 5]);
    expect(distributionTotal(net)).toEqual({ numerator: 1, denominator: 1 });
  });
});

describe('ожидание на точных дробях', () => {
  it('считает справедливую цену четырёх игр', () => {
    expect(fairPrice(gameDistribution(CUBE_GAME))).toEqual({ numerator: 35, denominator: 1 });
    expect(fairPrice(gameDistribution(STEADY_GAME))).toEqual({ numerator: 35, denominator: 1 });
    expect(fairPrice(gameDistribution(JACKPOT_GAME))).toEqual({ numerator: 35, denominator: 1 });
    expect(fairPrice(gameDistribution(BIKE_LOSS))).toEqual({ numerator: 400, denominator: 1 });
  });

  it('вычитает цену и показывает знак ожидаемого результата', () => {
    expect(netExpectation(gameDistribution(CUBE_GAME), 40)).toEqual({ numerator: -5, denominator: 1 });
    expect(netExpectation(gameDistribution(STEADY_GAME), 35)).toEqual({ numerator: 0, denominator: 1 });
    expect(netExpectation(gameDistribution(CUBE_GAME), 30)).toEqual({ numerator: 5, denominator: 1 });
  });

  it('ожидание сдвинутой величины сдвигается на то же число', () => {
    const net = shiftDistribution(gameDistribution(CUBE_GAME), -40);
    expect(expectedValue(net)).toEqual({ numerator: -5, denominator: 1 });
  });

  it('ожидание суммы кубиков равно сумме ожиданий', () => {
    for (const count of [1, 2, 3, 5]) {
      expect(expectedValue(diceSumDistribution(count))).toEqual(fraction(7 * count, 2));
    }
  });
});

describe('дисперсия на точных дробях', () => {
  it('различает игры с одинаковым ожиданием', () => {
    expect(distributionVariance(gameDistribution(STEADY_GAME))).toEqual({ numerator: 25, denominator: 1 });
    expect(distributionVariance(gameDistribution(CUBE_GAME))).toEqual({ numerator: 875, denominator: 3 });
    expect(distributionVariance(gameDistribution(JACKPOT_GAME))).toEqual({ numerator: 121_275, denominator: 1 });
  });

  it('совпадает с формулой D(X) = M(X²) − M(X)²', () => {
    for (const game of [CUBE_GAME, STEADY_GAME, JACKPOT_GAME, BIKE_LOSS]) {
      const entries = gameDistribution(game);
      expect(varianceThroughSquares(entries)).toEqual(distributionVariance(entries));
    }
  });

  it('даёт круглые стандартные отклонения там, где они круглые', () => {
    expect(standardDeviation(gameDistribution(STEADY_GAME))).toBe(5);
    expect(standardDeviation(gameDistribution(BIKE_LOSS))).toBe(2800);
    expect(roundTo(standardDeviation(gameDistribution(CUBE_GAME)), 2)).toBe(17.08);
    expect(roundTo(standardDeviation(gameDistribution(JACKPOT_GAME)), 2)).toBe(348.25);
  });

  it('не меняется при сдвиге, потому что сдвиг не меняет отклонений', () => {
    const entries = gameDistribution(CUBE_GAME);
    expect(distributionVariance(shiftDistribution(entries, -40))).toEqual(distributionVariance(entries));
  });

  it('дисперсия суммы n кубиков равна 35n/12', () => {
    for (const count of [1, 2, 3, 4, 6]) {
      expect(distributionVariance(diceSumDistribution(count))).toEqual(fraction(35 * count, 12));
    }
  });

  it('считает стандартное отклонение готового ряда данных', () => {
    expect(dataStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
    expect(dataStandardDeviation([7, 7, 7])).toBe(0);
    expect(standardScore(9, 5, 2)).toBe(2);
    expect(() => standardScore(9, 5, 0)).toThrow('положительным');
  });
});

describe('распределение суммы кубиков', () => {
  it('для одного кубика совпадает с равномерным', () => {
    expect(diceSumDistribution(1)).toEqual(
      [1, 2, 3, 4, 5, 6].map((value) => ({ value, probability: fraction(1, 6) })),
    );
  });

  it('для двух кубиков даёт классическую «крышу»', () => {
    const two = diceSumDistribution(2);
    expect(two).toHaveLength(11);
    expect(two[0]).toEqual({ value: 2, probability: fraction(1, 36) });
    expect(two[5]).toEqual({ value: 7, probability: fraction(6, 36) });
    expect(two.at(-1)).toEqual({ value: 12, probability: fraction(1, 36) });
  });

  it('для трёх кубиков воспроизводит известные частоты из 216 исходов', () => {
    const three = diceSumDistribution(3);
    const counts = three.map((entry) => (entry.probability.numerator * 216) / entry.probability.denominator);
    expect(counts).toEqual([1, 3, 6, 10, 15, 21, 25, 27, 27, 25, 21, 15, 10, 6, 3, 1]);
    expect(counts.reduce((total, count) => total + count, 0)).toBe(216);
  });

  it('остаётся полным распределением и симметричным при любом числе кубиков', () => {
    for (const count of [1, 2, 4, 8]) {
      const entries = diceSumDistribution(count);
      expect(distributionTotal(entries)).toEqual({ numerator: 1, denominator: 1 });
      expect(entries[0]!.value).toBe(count);
      expect(entries.at(-1)!.value).toBe(6 * count);
      expect(entries.map((entry) => entry.probability)).toEqual(
        [...entries].reverse().map((entry) => entry.probability),
      );
    }
  });

  it('отказывается считать слишком длинную сумму', () => {
    expect(() => diceSumDistribution(0)).toThrow('целым положительным');
    expect(() => diceSumDistribution(9)).toThrow('от 1 до 8');
  });
});

describe('правило трёх сигм', () => {
  it('даёт нормальной модели канонические 0,6827, 0,9545 и 0,9973', () => {
    expect(roundTo(normalBandProbability(1), 4)).toBe(0.6827);
    expect(roundTo(normalBandProbability(2), 4)).toBe(0.9545);
    expect(roundTo(normalBandProbability(3), 4)).toBe(0.9973);
    expect(normalBandProbability(0)).toBe(0);
  });

  it('согласована с функцией распределения нормальной модели', () => {
    expect(roundTo(normalCdf(0, 0, 1), 6)).toBe(0.5);
    expect(roundTo(normalCdf(1, 0, 1) - normalCdf(-1, 0, 1), 6)).toBe(roundTo(normalBandProbability(1), 6));
    expect(roundTo(normalCdf(115, 100, 15), 4)).toBe(0.8413);
    expect(roundTo(normalDensity(0, 0, 1), 6)).toBe(0.398942);
    expect(normalDensity(3, 0, 1)).toBeCloseTo(normalDensity(-3, 0, 1), 12);
  });

  it('считает точную вероятность полосы без извлечения корня', () => {
    expect(withinSigmaProbability(diceSumDistribution(1), 1)).toEqual(fraction(2, 3));
    expect(withinSigmaProbability(diceSumDistribution(3), 1)).toEqual(fraction(73, 108));
    expect(withinSigmaProbability(diceSumDistribution(3), 2)).toEqual(fraction(26, 27));
    expect(withinSigmaProbability(diceSumDistribution(3), 3)).toEqual({ numerator: 1, denominator: 1 });
  });

  it('у резко несимметричной величины расходится с нормальной моделью', () => {
    const jackpot = gameDistribution(JACKPOT_GAME);
    // Внутрь полосы μ ± σ попадает только «пусто»: 0 отличается от 35 меньше чем на 348.
    expect(withinSigmaProbability(jackpot, 1)).toEqual(fraction(99, 100));
    // А вот сам джекпот отстоит от среднего почти на 10 сигм — трёх сигм ему мало.
    expect(withinSigmaProbability(jackpot, 3)).toEqual(fraction(99, 100));
  });

  it('сравнивает точные вероятности с моделью и с границей Чебышёва', () => {
    const rows = sigmaComparison(diceSumDistribution(4));
    expect(rows.map((row) => row.sigmas)).toEqual([1, 2, 3]);
    expect(rows[0]!.normal).toBe(0.6827);
    expect(rows[1]!.normal).toBe(0.9545);
    expect(rows[2]!.normal).toBe(0.9973);
    expect(rows.map((row) => row.chebyshev)).toEqual([0, 0.75, 0.8889]);
    for (const row of rows) {
      expect(row.exactApprox).toBe(roundTo(fractionToNumber(row.exact), 4));
      expect(row.exactApprox).toBeGreaterThanOrEqual(row.chebyshev);
    }
    expect(Math.abs(rows[1]!.exactApprox - rows[1]!.normal)).toBeLessThan(0.03);
  });

  it('граница Чебышёва ничего не обещает при k ≤ 1', () => {
    expect(chebyshevBound(1)).toBe(0);
    expect(chebyshevBound(0.5)).toBe(0);
    expect(chebyshevBound(2)).toBe(0.75);
    expect(roundTo(chebyshevBound(3), 4)).toBe(0.8889);
  });
});

describe('выборка и её ошибка', () => {
  it('стандартная ошибка убывает как 1/√n', () => {
    expect(standardError(0.5, 2500)).toBe(0.01);
    expect(roundTo(standardError(0.5, 400), 4)).toBe(0.025);
    expect(roundTo(standardError(0.5, 1600) * 2, 9)).toBe(roundTo(standardError(0.5, 400), 9));
    expect(standardError(0, 100)).toBe(0);
  });

  it('граница ошибки и интервал согласованы', () => {
    expect(marginOfError(0.5, 2500)).toBe(0.02);
    const interval = shareInterval(0.5, 2500);
    expect(roundTo(interval.low, 4)).toBe(0.48);
    expect(roundTo(interval.high, 4)).toBe(0.52);
    expect(shareInterval(0.99, 100).high).toBe(1);
    expect(shareInterval(0.01, 100).low).toBe(0);
  });

  it('обратная задача: какой объём нужен для заданной точности', () => {
    expect(requiredSampleSize(0.02)).toBe(2500);
    expect(requiredSampleSize(0.01)).toBe(10_000);
    expect(requiredSampleSize(0.04)).toBe(625);
    expect(() => requiredSampleSize(0)).toThrow('строго между 0 и 1');
  });

  it('сеемая серия выборок воспроизводима и держится около истинной доли', () => {
    const first = simulateSampleShares(2025, 40, 100, 0.6);
    const again = simulateSampleShares(2025, 40, 100, 0.6);
    expect(first).toEqual(again);
    expect(first).toHaveLength(40);

    const centre = first.reduce((total, share) => total + share, 0) / first.length;
    expect(Math.abs(centre - 0.6)).toBeLessThan(0.02);

    const margin = marginOfError(0.6, 100, 3);
    expect(first.filter((share) => Math.abs(share - 0.6) > margin)).toEqual([]);
    expect(simulateSampleShares(7, 2, 50, 0.6)).not.toEqual(first.slice(0, 2));
  });
});

describe('связь двух признаков', () => {
  it('различает возрастающую, убывающую и отсутствующую линейную связь', () => {
    expect(correlationCoefficient([1, 2, 3, 4], [3, 5, 7, 9])).toBeCloseTo(1, 12);
    expect(correlationCoefficient([1, 2, 3, 4], [9, 7, 5, 3])).toBeCloseTo(-1, 12);
    expect(correlationCoefficient([-2, -1, 1, 2], [4, 1, 1, 4])).toBeCloseTo(0, 12);
  });

  it('видит сильную связь там, где общая причина одна', () => {
    const iceCream = [18, 24, 31, 45, 58, 66, 71];
    const drowning = [3, 5, 4, 9, 11, 10, 14];
    expect(roundTo(correlationCoefficient(iceCream, drowning), 3)).toBe(0.954);
    // Тот же коэффициент не изменится, если поменять признаки местами.
    expect(correlationCoefficient(drowning, iceCream)).toBeCloseTo(
      correlationCoefficient(iceCream, drowning),
      12,
    );
  });

  it('проверяет данные', () => {
    expect(() => correlationCoefficient([1, 2], [1])).toThrow('одинаковое число наблюдений');
    expect(() => correlationCoefficient([1], [1])).toThrow('не меньше двух наблюдений');
    expect(() => correlationCoefficient([3, 3, 3], [1, 2, 3])).toThrow('не меняется');
  });
});
