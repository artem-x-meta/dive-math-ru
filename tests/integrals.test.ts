import { describe, expect, it } from 'vitest';
import {
  accumulated,
  accumulationSteps,
  antiderivativeExact,
  antiderivativeFamilyText,
  antiderivativeText,
  areaBetween,
  constantThroughPoint,
  crossingPoints,
  curveExtremes,
  definiteIntegral,
  definiteIntegralExact,
  differentiateExact,
  evaluateExactPolynomial,
  exactPolynomialToNumbers,
  functionText,
  getIntegralFunction,
  newtonLeibnizReport,
  numberText,
  riemannConvergence,
  riemannRectangles,
  riemannSum,
  riemannSummary,
  samplePolynomial,
  verifyAntiderivative,
  INTEGRAL_FUNCTIONS,
  MAX_RIEMANN_PARTS,
} from '../src/lib/integrals';
import { formatExactRussian, parseExact } from '../src/lib/exactRational';

const SQUARE = [0, 0, 1];
const LINEAR = [1, 2];
const DOME = [4, 0, -1];
const CUBIC = [0, 0, 0, 1];

function exact(numerator: number, denominator: number) {
  return parseExact(`${numerator}/${denominator}`);
}

describe('первообразная многочлена', () => {
  it('делит коэффициент на новую степень и не теряет точность', () => {
    expect(antiderivativeExact(SQUARE)).toEqual([
      parseExact(0),
      parseExact(0),
      parseExact(0),
      exact(1, 3),
    ]);
    expect(antiderivativeExact([1, 1, 1])).toEqual([
      parseExact(0),
      parseExact(1),
      exact(1, 2),
      exact(1, 3),
    ]);
    expect(antiderivativeExact([])).toEqual([parseExact(0)]);
  });

  it('восстанавливает исходную функцию после дифференцирования', () => {
    const samples = [SQUARE, LINEAR, DOME, CUBIC, [7], [0, -5, 0, 2], []];
    for (const coefficients of samples) {
      expect(verifyAntiderivative(coefficients)).toBe(true);
    }
    expect(exactPolynomialToNumbers(differentiateExact(antiderivativeExact(DOME)))).toEqual(DOME);
  });

  it('записывает первообразную дробью, а семейство — с постоянной C', () => {
    expect(antiderivativeText(SQUARE)).toBe('x³/3');
    expect(antiderivativeText(LINEAR)).toBe('x² + x');
    expect(antiderivativeText(DOME)).toBe('−x³/3 + 4x');
    expect(antiderivativeText([0, 0, 0, 4])).toBe('x⁴');
    expect(antiderivativeText([3, -2, 1], 't')).toBe('t³/3 − t² + 3t');
    expect(antiderivativeFamilyText(SQUARE)).toBe('x³/3 + C');
    expect(antiderivativeFamilyText([])).toBe('C');
  });

  it('находит постоянную по точке, через которую проходит график', () => {
    // F(x) = x³/3 + C, условие F(3) = 10 даёт C = 10 − 9 = 1.
    expect(formatExactRussian(constantThroughPoint(SQUARE, 3, 10))).toBe('1');
    // F(x) = x² + x + C, условие F(0) = −2 даёт C = −2.
    expect(formatExactRussian(constantThroughPoint(LINEAR, 0, -2))).toBe('−2');
    // F(x) = x³/3 + C, условие F(1) = 0 даёт C = −1/3.
    expect(formatExactRussian(constantThroughPoint(SQUARE, 1, 0))).toBe('−1/3');
  });

  it('отвергает слишком большую степень', () => {
    expect(() => antiderivativeExact([0, 0, 0, 0, 0, 0, 0, 0, 1])).toThrow('степень');
  });
});

describe('определённый интеграл', () => {
  it('считает значение точно, без потери 1/3', () => {
    expect(formatExactRussian(definiteIntegralExact(SQUARE, 0, 1))).toBe('1/3');
    expect(formatExactRussian(definiteIntegralExact(SQUARE, -1, 2))).toBe('3');
    expect(formatExactRussian(definiteIntegralExact([1, -2, 3], 0, 2))).toBe('6');
    expect(definiteIntegral(DOME, -2, 2)).toBeCloseTo(32 / 3, 12);
  });

  it('меняет знак при перестановке пределов и обнуляется на вырожденном отрезке', () => {
    expect(definiteIntegral(SQUARE, 2, 0)).toBeCloseTo(-8 / 3, 12);
    expect(definiteIntegral(SQUARE, 2, 2)).toBe(0);
  });

  it('складывает соседние отрезки', () => {
    const left = definiteIntegral(CUBIC, 0, 1.5);
    const right = definiteIntegral(CUBIC, 1.5, 4);
    expect(left + right).toBeCloseTo(definiteIntegral(CUBIC, 0, 4), 10);
  });

  it('собирает выкладку по формуле Ньютона–Лейбница', () => {
    expect(newtonLeibnizReport(SQUARE, 0, 2)).toEqual({
      integrand: 'x²',
      antiderivative: 'x³/3',
      upperValue: '8/3',
      lowerValue: '0',
      result: '8/3',
      resultNumber: 8 / 3,
    });
    const motion = newtonLeibnizReport(LINEAR, 1, 3, 't');
    expect(motion.antiderivative).toBe('t² + t');
    expect(motion.upperValue).toBe('12');
    expect(motion.lowerValue).toBe('2');
    expect(motion.result).toBe('10');
  });

  it('вычисляет значение многочлена с точными коэффициентами', () => {
    const antiderivative = antiderivativeExact(SQUARE);
    expect(formatExactRussian(evaluateExactPolynomial(antiderivative, 2))).toBe('8/3');
  });
});

describe('суммы Римана', () => {
  it('строит прямоугольники одинаковой ширины с честной высотой', () => {
    const rectangles = riemannRectangles(SQUARE, 0, 1, 4, 'left');
    expect(rectangles).toHaveLength(4);
    expect(rectangles.map((item) => item.sample)).toEqual([0, 0.25, 0.5, 0.75]);
    expect(rectangles.map((item) => item.height)).toEqual([0, 0.0625, 0.25, 0.5625]);
    expect(riemannRectangles(SQUARE, 0, 1, 4, 'right').map((item) => item.sample))
      .toEqual([0.25, 0.5, 0.75, 1]);
    expect(riemannRectangles(SQUARE, 0, 1, 4, 'middle').map((item) => item.sample))
      .toEqual([0.125, 0.375, 0.625, 0.875]);
  });

  it('на возрастающей функции зажимает точное значение между левой и правой суммой', () => {
    const exactValue = definiteIntegral(SQUARE, 0, 1);
    const left = riemannSum(SQUARE, 0, 1, 8, 'left');
    const right = riemannSum(SQUARE, 0, 1, 8, 'right');
    expect(left).toBeLessThan(exactValue);
    expect(right).toBeGreaterThan(exactValue);
    // Разность крайних сумм равна (f(b) − f(a))·h — это ширина «вилки».
    expect(right - left).toBeCloseTo((1 - 0) / 8, 12);
  });

  it('сходится к точному значению при сгущении разбиения', () => {
    const rows = riemannConvergence(SQUARE, 0, 1, [4, 8, 16, 32, 64, 128, 256], 'left');
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index]!.error).toBeLessThan(rows[index - 1]!.error);
    }
    expect(rows.at(-1)!.error).toBeLessThan(0.002);
    expect(riemannSum(SQUARE, 0, 1, 1000, 'left')).toBeCloseTo(1 / 3, 3);
    expect(riemannSum(DOME, -2, 2, 800, 'middle')).toBeCloseTo(32 / 3, 4);
    expect(riemannSum(CUBIC, 0, 2, 1000, 'right')).toBeCloseTo(4, 1);
  });

  it('на линейной функции средние прямоугольники дают точный ответ', () => {
    for (const parts of [1, 2, 3, 7, 20]) {
      expect(riemannSum(LINEAR, 1, 4, parts, 'middle')).toBeCloseTo(definiteIntegral(LINEAR, 1, 4), 10);
    }
  });

  it('учитывает знак: под осью площадь входит со знаком минус', () => {
    const below = [0, 0, -1];
    const summary = riemannSummary(below, 0, 1, 500, 'middle');
    expect(summary.sum).toBeLessThan(0);
    expect(summary.exact).toBeCloseTo(-1 / 3, 12);
    expect(summary.error).toBeLessThan(1e-5);
    expect(summary.width).toBeCloseTo(0.002, 12);
  });

  it('проверяет аргументы', () => {
    expect(() => riemannSum(SQUARE, 1, 1, 4, 'left')).toThrow('строго меньше');
    expect(() => riemannSum(SQUARE, 0, 1, 0, 'left')).toThrow('от 1 до');
    expect(() => riemannSum(SQUARE, 0, 1, MAX_RIEMANN_PARTS + 1, 'left')).toThrow('от 1 до');
    expect(() => riemannSum(SQUARE, 0, 1, 2.5, 'left')).toThrow('целым');
    expect(() => riemannSum(SQUARE, 0, 1, 4, 'lower' as never)).toThrow('правило');
    expect(() => riemannSum(SQUARE, 0, 1000, 4, 'left')).toThrow('не может превышать');
  });
});

describe('площадь между графиками', () => {
  it('находит точки пересечения параболы и прямой', () => {
    expect(crossingPoints(SQUARE, [2, 1], -5, 5)).toEqual([-1, 2]);
    expect(crossingPoints(DOME, [], -5, 5)).toEqual([-2, 2]);
    expect(crossingPoints([1, 2], [1, 2], -5, 5)).toEqual([]);
    expect(crossingPoints(SQUARE, [-1], -5, 5)).toEqual([]);
  });

  it('считает площадь фигуры, ограниченной параболой и прямой', () => {
    const result = areaBetween([2, 1], SQUARE, -1, 2);
    expect(result.area).toBeCloseTo(4.5, 10);
    expect(result.signed).toBeCloseTo(4.5, 10);
    expect(result.pieces).toHaveLength(1);
    expect(result.pieces[0]!.upper).toBe('first');
  });

  it('не даёт кускам погасить друг друга при пересечении внутри отрезка', () => {
    const result = areaBetween(CUBIC, [0, 1], -1, 1);
    expect(result.intersections).toEqual([0]);
    expect(result.signed).toBeCloseTo(0, 10);
    expect(result.area).toBeCloseTo(0.5, 8);
    expect(result.pieces).toHaveLength(2);
    expect(result.pieces[0]!.upper).toBe('first');
    expect(result.pieces[1]!.upper).toBe('second');
    expect(result.pieces[0]!.area).toBeCloseTo(0.25, 8);
    expect(result.pieces[1]!.area).toBeCloseTo(0.25, 8);
  });

  it('площадь под графиком — частный случай площади между графиками', () => {
    const underCurve = areaBetween(SQUARE, [], 0, 3);
    expect(underCurve.area).toBeCloseTo(9, 10);
    expect(underCurve.area).toBeCloseTo(definiteIntegral(SQUARE, 0, 3), 10);
  });

  it('у совпадающих графиков площадь равна нулю', () => {
    expect(areaBetween(DOME, DOME, -2, 2).area).toBe(0);
  });
});

describe('накопление величины', () => {
  it('накапливает путь по скорости', () => {
    // v(t) = 2t + 1: путь за 3 секунды равен 9 + 3 = 12.
    expect(accumulated(LINEAR, 0, 3)).toBeCloseTo(12, 12);
    const steps = accumulationSteps(LINEAR, 0, 3, 3);
    expect(steps.map((step) => step.added)).toEqual([2, 4, 6]);
    expect(steps.map((step) => step.total)).toEqual([2, 6, 12]);
    expect(steps.at(-1)!.total).toBeCloseTo(accumulated(LINEAR, 0, 3), 12);
  });

  it('накопление на всём отрезке равно сумме накоплений на кусках', () => {
    const steps = accumulationSteps(SQUARE, 0, 2, 8);
    const total = steps.reduce((sum, step) => sum + step.added, 0);
    expect(total).toBeCloseTo(8 / 3, 10);
  });
});

describe('вспомогательные средства лабораторий', () => {
  it('строит точки графика и границы значений', () => {
    const points = samplePolynomial(SQUARE, 0, 2, 5);
    expect(points.map((point) => point.x)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(points.map((point) => point.y)).toEqual([0, 0.25, 1, 2.25, 4]);
    expect(curveExtremes(DOME, -2, 2)).toEqual({ min: 0, max: 4 });
  });

  it('пишет числа по-русски и подписывает функции', () => {
    expect(numberText(0.5)).toBe('0,5');
    expect(numberText(-1 / 3)).toBe('−0,3333');
    expect(numberText(12)).toBe('12');
    expect(functionText(DOME)).toBe('f(x) = −x² + 4');
    expect(functionText(LINEAR, 'v', 't')).toBe('v(t) = 2t + 1');
  });

  it('хранит согласованный набор готовых функций', () => {
    expect(new Set(INTEGRAL_FUNCTIONS.map((item) => item.id)).size).toBe(INTEGRAL_FUNCTIONS.length);
    expect(getIntegralFunction('dome').coefficients).toEqual(DOME);
    expect(() => getIntegralFunction('sinus')).toThrow('Неизвестная функция');
    for (const preset of INTEGRAL_FUNCTIONS) {
      expect(verifyAntiderivative(preset.coefficients)).toBe(true);
    }
  });
});
