import { describe, expect, it } from 'vitest';
import {
  arccosineAngle,
  arcsineAngle,
  arctangentAngle,
  cosineFromSine,
  cosineOf,
  cosineOfDifference,
  cosineOfSum,
  degreesToRadians,
  divideExactValues,
  doubleAngleCosine,
  doubleAngleSine,
  exactCosine,
  exactSine,
  exactTangent,
  formatPiFractionLatex,
  fullTurns,
  invertExactValue,
  isTableAngle,
  makeExactValue,
  multiplyExactValues,
  normalizeDegrees,
  normalizeRadians,
  periodOf,
  piFraction,
  piFractionFromDegrees,
  pythagoreanIdentity,
  quadrantOfDegrees,
  radiansToDegrees,
  referenceAngleDegrees,
  seriesValue,
  signsInQuadrant,
  simplifyRadical,
  sineFromCosine,
  sineOf,
  sineOfDifference,
  sineOfSum,
  solutionsInInterval,
  solveCosineEquation,
  solveSimpleEquation,
  solveSineEquation,
  solveTangentEquation,
  tangentFromRatio,
  tangentOf,
  unitCirclePoint,
  waveSamples,
  waveValue,
} from '../src/lib/trigonometry';

describe('точные значения вида k·√r / d', () => {
  it('выносит множитель из-под корня и сокращает дробь', () => {
    expect(simplifyRadical(12)).toEqual({ outside: 2, inside: 3 });
    expect(simplifyRadical(9)).toEqual({ outside: 3, inside: 1 });
    expect(simplifyRadical(2)).toEqual({ outside: 1, inside: 2 });

    const value = makeExactValue(2, 12, 8);
    expect(value).toMatchObject({ numerator: 1, radicand: 3, denominator: 2 });
    expect(value.latex).toBe('\\frac{\\sqrt{3}}{2}');
    expect(value.plain).toBe('√3/2');
    expect(value.value).toBeCloseTo(Math.sqrt(3) / 2, 9);
  });

  it('хранит знак в числителе и знает про ноль', () => {
    expect(makeExactValue(1, 1, -2)).toMatchObject({ numerator: -1, denominator: 2 });
    expect(makeExactValue(0, 3, 5)).toMatchObject({ numerator: 0, radicand: 1, denominator: 1 });
    expect(makeExactValue(0, 3, 5).latex).toBe('0');
    expect(() => makeExactValue(1, 1, 0)).toThrow('не может быть равен нулю');
    expect(() => makeExactValue(1, 0, 2)).toThrow('натуральное число');
  });

  it('умножает, обращает и делит точные значения без потери точности', () => {
    const half = makeExactValue(1, 1, 2);
    const rootThreeOverTwo = makeExactValue(1, 3, 2);

    expect(multiplyExactValues(half, rootThreeOverTwo)).toMatchObject({ numerator: 1, radicand: 3, denominator: 4 });
    expect(invertExactValue(rootThreeOverTwo)).toMatchObject({ numerator: 2, radicand: 3, denominator: 3 });
    expect(divideExactValues(half, rootThreeOverTwo)).toMatchObject({ numerator: 1, radicand: 3, denominator: 3 });
    expect(() => invertExactValue(makeExactValue(0, 1, 1))).toThrow('нулевое значение');
  });
});

describe('таблица значений', () => {
  it('даёт точный синус для всех углов, кратных 30° и 45°', () => {
    expect(exactSine(0)?.latex).toBe('0');
    expect(exactSine(30)?.latex).toBe('\\frac{1}{2}');
    expect(exactSine(45)?.latex).toBe('\\frac{\\sqrt{2}}{2}');
    expect(exactSine(60)?.latex).toBe('\\frac{\\sqrt{3}}{2}');
    expect(exactSine(90)?.latex).toBe('1');
    expect(exactSine(150)?.latex).toBe('\\frac{1}{2}');
    expect(exactSine(210)?.latex).toBe('-\\frac{1}{2}');
    expect(exactSine(270)?.latex).toBe('-1');
    expect(exactSine(330)?.latex).toBe('-\\frac{1}{2}');
  });

  it('получает косинус сдвигом на 90° и согласуется с синусом', () => {
    expect(exactCosine(0)?.latex).toBe('1');
    expect(exactCosine(60)?.latex).toBe('\\frac{1}{2}');
    expect(exactCosine(120)?.latex).toBe('-\\frac{1}{2}');
    expect(exactCosine(135)?.latex).toBe('-\\frac{\\sqrt{2}}{2}');
    expect(exactCosine(180)?.latex).toBe('-1');
    expect(exactCosine(300)?.latex).toBe('\\frac{1}{2}');
    for (const degrees of [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]) {
      expect(exactCosine(degrees)?.value).toBeCloseTo(Math.cos(degrees * Math.PI / 180), 9);
      expect(exactSine(degrees)?.value).toBeCloseTo(Math.sin(degrees * Math.PI / 180), 9);
    }
  });

  it('делит синус на косинус и получает точный тангенс', () => {
    expect(exactTangent(0)?.latex).toBe('0');
    expect(exactTangent(30)?.latex).toBe('\\frac{\\sqrt{3}}{3}');
    expect(exactTangent(45)?.latex).toBe('1');
    expect(exactTangent(60)?.latex).toBe('\\sqrt{3}');
    expect(exactTangent(120)?.latex).toBe('-\\sqrt{3}');
    expect(exactTangent(135)?.latex).toBe('-1');
    expect(exactTangent(225)?.latex).toBe('1');
    expect(exactTangent(90)).toBeNull();
    expect(exactTangent(270)).toBeNull();
  });

  it('не выдумывает точных значений для нетабличных углов', () => {
    expect(isTableAngle(45)).toBe(true);
    expect(isTableAngle(405)).toBe(true);
    expect(isTableAngle(50)).toBe(false);
    expect(exactSine(50)).toBeNull();
    expect(exactCosine(17)).toBeNull();
  });

  it('возвращает точные нули и единицы в числовых функциях', () => {
    expect(cosineOf(90)).toBe(0);
    expect(cosineOf(270)).toBe(0);
    expect(sineOf(180)).toBe(0);
    expect(sineOf(-90)).toBe(-1);
    expect(sineOf(30)).toBe(0.5);
    expect(tangentOf(45)).toBe(1);
    expect(tangentOf(90)).toBeNull();
    expect(tangentOf(-90)).toBeNull();
    expect(sineOf(50)).toBeCloseTo(0.766044443, 8);
  });
});

describe('приведение угла к окружности', () => {
  it('сводит любой поворот к промежутку от 0° до 360°', () => {
    expect(normalizeDegrees(30)).toBe(30);
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(390)).toBe(30);
    expect(normalizeDegrees(-30)).toBe(330);
    expect(normalizeDegrees(-390)).toBe(330);
    expect(normalizeDegrees(1110)).toBe(30);
    expect(normalizeDegrees(-720)).toBe(0);
  });

  it('считает число отброшенных оборотов', () => {
    expect(fullTurns(30)).toBe(0);
    expect(fullTurns(390)).toBe(1);
    expect(fullTurns(1110)).toBe(3);
    expect(fullTurns(-30)).toBe(-1);
    expect(fullTurns(-720)).toBe(-2);
  });

  it('приводит радианную запись и переводит меры друг в друга', () => {
    expect(normalizeRadians(0)).toBe(0);
    expect(normalizeRadians(3 * Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(normalizeRadians(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 10);
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI, 12);
    expect(degreesToRadians(30)).toBeCloseTo(Math.PI / 6, 12);
    expect(radiansToDegrees(Math.PI / 4)).toBe(45);
    expect(radiansToDegrees(2 * Math.PI)).toBe(360);
  });

  it('называет четверть и опорный острый угол', () => {
    expect(quadrantOfDegrees(40)).toBe(1);
    expect(quadrantOfDegrees(100)).toBe(2);
    expect(quadrantOfDegrees(200)).toBe(3);
    expect(quadrantOfDegrees(-40)).toBe(4);
    expect(quadrantOfDegrees(90)).toBe(0);
    expect(quadrantOfDegrees(720)).toBe(0);

    expect(referenceAngleDegrees(30)).toBe(30);
    expect(referenceAngleDegrees(150)).toBe(30);
    expect(referenceAngleDegrees(210)).toBe(30);
    expect(referenceAngleDegrees(330)).toBe(30);
    expect(referenceAngleDegrees(-30)).toBe(30);
  });

  it('знает знаки функций по четвертям', () => {
    expect(signsInQuadrant(1)).toEqual({ sine: 1, cosine: 1, tangent: 1 });
    expect(signsInQuadrant(2)).toEqual({ sine: 1, cosine: -1, tangent: -1 });
    expect(signsInQuadrant(3)).toEqual({ sine: -1, cosine: -1, tangent: 1 });
    expect(signsInQuadrant(4)).toEqual({ sine: -1, cosine: 1, tangent: -1 });
  });

  it('ставит точку на единичной окружности честно', () => {
    expect(unitCirclePoint(0)).toMatchObject({ x: 1, y: 0, quadrant: 0 });
    expect(unitCirclePoint(90)).toMatchObject({ x: 0, y: 1 });
    expect(unitCirclePoint(180)).toMatchObject({ x: -1, y: 0 });
    expect(unitCirclePoint(450)).toMatchObject({ x: 0, y: 1, degrees: 90 });
    const point = unitCirclePoint(-60);
    expect(point.degrees).toBe(300);
    expect(point.quadrant).toBe(4);
    expect(point.x).toBeCloseTo(0.5, 9);
    expect(point.y).toBeCloseTo(-Math.sqrt(3) / 2, 9);
    expect(point.x * point.x + point.y * point.y).toBeCloseTo(1, 9);
  });
});

describe('тождества', () => {
  it('подтверждает основное тождество на любом угле', () => {
    for (const degrees of [0, 17, 30, 45, 90, 123, 180, 240, 359, -17]) {
      expect(pythagoreanIdentity(degrees)).toBe(1);
    }
  });

  it('восстанавливает вторую функцию по четверти', () => {
    expect(sineFromCosine(0.8, 1)).toBe(0.6);
    expect(sineFromCosine(-0.8, 3)).toBe(-0.6);
    expect(cosineFromSine(0.6, 2)).toBe(-0.8);
    expect(cosineFromSine(-0.6, 4)).toBe(0.8);
    expect(tangentFromRatio(0.6, 0.8)).toBe(0.75);
    expect(tangentFromRatio(1, 0)).toBeNull();
    expect(() => sineFromCosine(1.2, 1)).toThrow('[−1; 1]');
  });

  it('согласует формулы сложения с прямым вычислением', () => {
    expect(sineOfSum(45, 30)).toBe(sineOf(75));
    expect(sineOfDifference(45, 30)).toBe(sineOf(15));
    expect(cosineOfSum(45, 30)).toBe(cosineOf(75));
    expect(cosineOfDifference(60, 45)).toBe(cosineOf(15));
    expect(cosineOfSum(90, 90)).toBe(-1);
    expect(sineOfSum(30, 60)).toBe(1);
  });

  it('подтверждает формулы двойного угла', () => {
    expect(doubleAngleSine(30)).toBe(sineOf(60));
    expect(doubleAngleSine(45)).toBe(1);
    expect(doubleAngleCosine(30)).toBe(0.5);
    expect(doubleAngleCosine(45)).toBe(0);
    expect(doubleAngleCosine(60)).toBe(-0.5);
  });
});

describe('доли числа π и обратные функции', () => {
  it('сокращает доли и печатает их для формул', () => {
    expect(piFraction(30, 180)).toEqual({ numerator: 1, denominator: 6 });
    expect(piFraction(-2, -4)).toEqual({ numerator: 1, denominator: 2 });
    expect(piFractionFromDegrees(150)).toEqual({ numerator: 5, denominator: 6 });
    expect(piFractionFromDegrees(360)).toEqual({ numerator: 2, denominator: 1 });
    expect(piFractionFromDegrees(22.5)).toBeNull();
    expect(formatPiFractionLatex({ numerator: 5, denominator: 6 })).toBe('\\frac{5\\pi}{6}');
    expect(formatPiFractionLatex({ numerator: 1, denominator: 1 })).toBe('\\pi');
    expect(formatPiFractionLatex({ numerator: -1, denominator: 2 })).toBe('-\\frac{\\pi}{2}');
    expect(formatPiFractionLatex({ numerator: 0, denominator: 3 })).toBe('0');
  });

  it('возвращает точные арксинус, арккосинус и арктангенс', () => {
    expect(arcsineAngle(0.5).latex).toBe('\\frac{\\pi}{6}');
    expect(arcsineAngle(-0.5).latex).toBe('-\\frac{\\pi}{6}');
    expect(arcsineAngle(1).latex).toBe('\\frac{\\pi}{2}');
    expect(arcsineAngle(Math.sqrt(2) / 2).latex).toBe('\\frac{\\pi}{4}');
    expect(arccosineAngle(0.5).latex).toBe('\\frac{\\pi}{3}');
    expect(arccosineAngle(-0.5).latex).toBe('\\frac{2\\pi}{3}');
    expect(arccosineAngle(0).latex).toBe('\\frac{\\pi}{2}');
    expect(arctangentAngle(1).latex).toBe('\\frac{\\pi}{4}');
    expect(arctangentAngle(Math.sqrt(3)).latex).toBe('\\frac{\\pi}{3}');
    expect(arctangentAngle(-1).latex).toBe('-\\frac{\\pi}{4}');
  });

  it('для нетабличных значений честно оставляет знак функции', () => {
    const angle = arcsineAngle(0.3);
    expect(angle.piFraction).toBeNull();
    expect(angle.latex).toBe('\\arcsin 0{,}3');
    expect(angle.radians).toBeCloseTo(Math.asin(0.3), 10);
    expect(() => arcsineAngle(1.5)).toThrow('[−1; 1]');
    expect(() => arccosineAngle(-2)).toThrow('[−1; 1]');
  });
});

describe('простейшие уравнения и серии решений', () => {
  it('решает sin x = a двумя сериями', () => {
    const solution = solveSineEquation(0.5);
    expect(solution.solvable).toBe(true);
    expect(solution.series.map((series) => series.latex)).toEqual([
      'x = \\frac{\\pi}{6} + 2\\pi n',
      'x = \\frac{5\\pi}{6} + 2\\pi n',
    ]);
    expect(solution.combinedLatex).toBe('x = (-1)^n \\frac{\\pi}{6} + \\pi n');
    expect(solution.series[1].plain).toBe('x = 5π/6 + 2πn');
  });

  it('сворачивает особые случаи синуса в одну серию', () => {
    expect(solveSineEquation(1).series.map((series) => series.latex)).toEqual(['x = \\frac{\\pi}{2} + 2\\pi n']);
    expect(solveSineEquation(-1).series.map((series) => series.latex)).toEqual(['x = -\\frac{\\pi}{2} + 2\\pi n']);
    expect(solveSineEquation(0).series.map((series) => series.latex)).toEqual(['x = \\pi n']);
    expect(solveSineEquation(0).series[0].period).toEqual({ numerator: 1, denominator: 1 });
  });

  it('решает cos x = a двумя симметричными сериями', () => {
    const solution = solveCosineEquation(0.5);
    expect(solution.series.map((series) => series.latex)).toEqual([
      'x = \\frac{\\pi}{3} + 2\\pi n',
      'x = -\\frac{\\pi}{3} + 2\\pi n',
    ]);
    expect(solution.combinedLatex).toBe('x = \\pm\\frac{\\pi}{3} + 2\\pi n');

    expect(solveCosineEquation(1).series.map((series) => series.latex)).toEqual(['x = 2\\pi n']);
    expect(solveCosineEquation(-1).series.map((series) => series.latex)).toEqual(['x = \\pi + 2\\pi n']);
    expect(solveCosineEquation(0).series.map((series) => series.latex)).toEqual(['x = \\frac{\\pi}{2} + \\pi n']);
  });

  it('решает tg x = a одной серией при любой правой части', () => {
    expect(solveTangentEquation(1).series.map((series) => series.latex)).toEqual(['x = \\frac{\\pi}{4} + \\pi n']);
    expect(solveTangentEquation(0).series.map((series) => series.latex)).toEqual(['x = \\pi n']);
    const big = solveTangentEquation(5);
    expect(big.solvable).toBe(true);
    expect(big.series).toHaveLength(1);
    expect(big.series[0].latex).toBe('x = \\operatorname{arctg} 5 + \\pi n');
  });

  it('честно сообщает об отсутствии корней', () => {
    const solution = solveSineEquation(1.5);
    expect(solution.solvable).toBe(false);
    expect(solution.series).toEqual([]);
    expect(solution.combinedLatex).toBe('\\varnothing');
    expect(solveCosineEquation(-2).solvable).toBe(false);
  });

  it('вычисляет отдельные члены серии', () => {
    const solution = solveSineEquation(0.5);
    expect(seriesValue(solution.series[0], 0)).toBeCloseTo(Math.PI / 6, 9);
    expect(seriesValue(solution.series[0], 1)).toBeCloseTo(Math.PI / 6 + 2 * Math.PI, 9);
    expect(seriesValue(solution.series[0], -1)).toBeCloseTo(Math.PI / 6 - 2 * Math.PI, 9);
  });

  it('отбирает корни на промежутке', () => {
    const sine = solutionsInInterval(solveSineEquation(0.5), 0, 2 * Math.PI);
    expect(sine).toHaveLength(2);
    expect(sine[0]).toBeCloseTo(Math.PI / 6, 9);
    expect(sine[1]).toBeCloseTo((5 * Math.PI) / 6, 9);

    const cosine = solutionsInInterval(solveCosineEquation(0.5), 0, 2 * Math.PI);
    expect(cosine).toHaveLength(2);
    expect(cosine[0]).toBeCloseTo(Math.PI / 3, 9);
    expect(cosine[1]).toBeCloseTo((5 * Math.PI) / 3, 9);

    expect(solutionsInInterval(solveSineEquation(0), 0, 2 * Math.PI)).toHaveLength(2);
    expect(solutionsInInterval(solveCosineEquation(0), 0, 2 * Math.PI)).toHaveLength(2);
    expect(solutionsInInterval(solveTangentEquation(1), 0, 2 * Math.PI)).toHaveLength(2);
    expect(solutionsInInterval(solveSineEquation(1), 0, 2 * Math.PI)).toHaveLength(1);
    expect(solutionsInInterval(solveSineEquation(2), 0, 2 * Math.PI)).toEqual([]);
    expect(() => solutionsInInterval(solveSineEquation(0.5), 1, 1)).toThrow('меньше правого');
  });

  it('каждый найденный корень действительно обращает уравнение в верное равенство', () => {
    for (const right of [0.5, -0.5, 0.3, 0, 1, -1]) {
      for (const root of solutionsInInterval(solveSineEquation(right), 0, 4 * Math.PI)) {
        expect(Math.sin(root)).toBeCloseTo(right, 9);
      }
      for (const root of solutionsInInterval(solveCosineEquation(right), 0, 4 * Math.PI)) {
        expect(Math.cos(root)).toBeCloseTo(right, 9);
      }
    }
    for (const root of solutionsInInterval(solveTangentEquation(1), 0, 4 * Math.PI)) {
      expect(Math.tan(root)).toBeCloseTo(1, 9);
    }
  });

  it('выбирает решатель по виду уравнения', () => {
    expect(solveSimpleEquation('sin', 0.5).kind).toBe('sin');
    expect(solveSimpleEquation('cos', 0.5).kind).toBe('cos');
    expect(solveSimpleEquation('tg', 0.5).kind).toBe('tg');
  });
});

describe('графики', () => {
  it('знает периоды', () => {
    expect(periodOf('sin')).toBeCloseTo(2 * Math.PI, 10);
    expect(periodOf('cos')).toBeCloseTo(2 * Math.PI, 10);
    expect(periodOf('tg')).toBeCloseTo(Math.PI, 10);
  });

  it('считает значения и отмечает разрывы тангенса', () => {
    expect(waveValue('sin', 0)).toBe(0);
    expect(waveValue('cos', 0)).toBe(1);
    expect(waveValue('sin', Math.PI / 2)).toBe(1);
    expect(waveValue('tg', Math.PI / 2)).toBeNull();
    expect(waveValue('tg', Math.PI / 4)).toBeCloseTo(1, 10);
  });

  it('строит выборку точек графика', () => {
    const samples = waveSamples('sin', 0, 2 * Math.PI, 5);
    expect(samples).toHaveLength(5);
    expect(samples[0]).toEqual({ t: 0, value: 0 });
    expect(samples[4].t).toBeCloseTo(2 * Math.PI, 10);
    expect(samples[1].value).toBeCloseTo(1, 10);
    expect(() => waveSamples('sin', 0, 1, 1)).toThrow('хотя бы две');
    expect(() => waveSamples('sin', 2, 1, 10)).toThrow('меньше правого');
  });

  it('подтверждает периодичность выборкой', () => {
    for (const t of [0.3, 1.1, 2.7, -0.8]) {
      expect(waveValue('sin', t + 2 * Math.PI)).toBeCloseTo(waveValue('sin', t) as number, 10);
      expect(waveValue('cos', t + 2 * Math.PI)).toBeCloseTo(waveValue('cos', t) as number, 10);
      expect(waveValue('tg', t + Math.PI)).toBeCloseTo(waveValue('tg', t) as number, 9);
    }
  });
});
