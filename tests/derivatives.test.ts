import { describe, expect, it } from 'vitest';
import {
  DERIVATIVE_FACTS,
  PROFILE_PRESETS,
  SECANT_PRESETS,
  SHRINKING_STEPS,
  availableSteps,
  chainRuleParts,
  composePolynomials,
  criticalPoints,
  derivativeAt,
  differentiate,
  differentiateTimes,
  extremaOnSegment,
  getProfilePreset,
  getSecantPreset,
  intervalText,
  lineText,
  lineValue,
  monotonicityIntervals,
  numericDerivative,
  polynomialRoots,
  polynomialSegments,
  productRuleParts,
  quotientRuleParts,
  rationalDerivativeValue,
  secantLine,
  secantRows,
  secantSlope,
  signAt,
  tangentLine,
  valueAt,
} from '../src/lib/derivatives';
import { evaluatePolynomial } from '../src/lib/polynomials';

/** x³ − 3x — рабочая лошадка главы. */
const CUBIC = [0, -3, 0, 1];

describe('точная производная многочлена', () => {
  it('понижает степень каждого члена и умножает на его показатель', () => {
    expect(differentiate([5])).toEqual([]);
    expect(differentiate([-7, 4])).toEqual([4]);
    expect(differentiate([1, 0, 3])).toEqual([0, 6]);
    expect(differentiate(CUBIC)).toEqual([-3, 0, 3]);
    expect(differentiate([0, 0, -2, 0, 1])).toEqual([0, -4, 0, 4]);
  });

  it('обнуляет постоянное слагаемое и нулевой многочлен', () => {
    expect(differentiate([])).toEqual([]);
    expect(differentiate([12, 0, 0])).toEqual([]);
    expect(differentiate([12, 5])).toEqual(differentiate([-100, 5]));
  });

  it('считает производные высших порядков', () => {
    expect(differentiateTimes(CUBIC, 0)).toEqual(CUBIC);
    expect(differentiateTimes(CUBIC, 1)).toEqual([-3, 0, 3]);
    expect(differentiateTimes(CUBIC, 2)).toEqual([0, 6]);
    expect(differentiateTimes(CUBIC, 3)).toEqual([6]);
    expect(differentiateTimes(CUBIC, 4)).toEqual([]);
    expect(() => differentiateTimes(CUBIC, -1)).toThrow('целым числом');
  });

  it('совпадает с численной производной в контрольных точках', () => {
    for (const x of [-2, -0.5, 0, 1.25, 3]) {
      const numeric = numericDerivative((t) => evaluatePolynomial(CUBIC, t), x);
      expect(numeric).toBeCloseTo(derivativeAt(CUBIC, x), 6);
    }
  });
});

describe('правила дифференцирования', () => {
  it('правило произведения даёт тот же ответ, что раскрытие скобок', () => {
    const parts = productRuleParts([1, 2], [-3, 0, 1]);
    expect(parts.du).toEqual([2]);
    expect(parts.dv).toEqual([0, 2]);
    expect(parts.byRule).toEqual(parts.direct);
    // (2x + 1)(x² − 3) = 2x³ + x² − 6x − 3, производная 6x² + 2x − 6.
    expect(parts.direct).toEqual([-6, 2, 6]);
  });

  it('произведение производных — не производная произведения', () => {
    const parts = productRuleParts([0, 1], [0, 1]);
    expect(parts.byRule).toEqual([0, 2]);
    expect(parts.du).toEqual([1]);
    expect(parts.dv).toEqual([1]);
  });

  it('правило частного совпадает с численной производной дроби', () => {
    const u = [1, 1];
    const v = [-2, 1];
    const parts = quotientRuleParts(u, v);
    // ((x + 1)/(x − 2))' = ((x − 2) − (x + 1)) / (x − 2)² = −3/(x − 2)².
    expect(parts.numerator).toEqual([-3]);
    expect(parts.denominator).toEqual([4, -4, 1]);

    for (const x of [-1, 0, 1, 3, 5]) {
      const numeric = numericDerivative(
        (t) => evaluatePolynomial(u, t) / evaluatePolynomial(v, t),
        x,
      );
      expect(numeric).toBeCloseTo(rationalDerivativeValue(u, v, x)!, 5);
    }
    expect(rationalDerivativeValue(u, v, 2)).toBeNull();
    expect(() => quotientRuleParts(u, [])).toThrow('нулевым многочленом');
  });

  it('правило цепочки совпадает с прямым дифференцированием', () => {
    const parts = chainRuleParts([0, 0, 1], [1, 3]);
    // (3x + 1)² = 9x² + 6x + 1, производная 18x + 6 = 2(3x + 1)·3.
    expect(parts.composed).toEqual([1, 6, 9]);
    expect(parts.byRule).toEqual(parts.direct);
    expect(parts.direct).toEqual([6, 18]);
  });

  it('подстановка многочлена в многочлен работает по схеме Горнера', () => {
    expect(composePolynomials([0, 0, 1], [0, 1])).toEqual([0, 0, 1]);
    expect(composePolynomials([1, 1], [2, 0, 3])).toEqual([3, 0, 3]);
    for (const x of [-2, 0, 1.5]) {
      const composed = composePolynomials([0, -3, 0, 1], [1, 2]);
      expect(valueAt(composed, x)).toBeCloseTo(
        evaluatePolynomial([0, -3, 0, 1], evaluatePolynomial([1, 2], x)),
        9,
      );
    }
  });
});

describe('разностное отношение и касательная', () => {
  it('для y = x² в точке 3 даёт ровно 6 + h', () => {
    for (const h of [1, 0.5, 0.1, -0.25]) {
      expect(secantSlope([0, 0, 1], 3, h)).toBeCloseTo(6 + h, 12);
    }
    expect(() => secantSlope([0, 0, 1], 3, 0)).toThrow('на ноль делить нельзя');
  });

  it('таблица секущих стягивается к точному значению производной', () => {
    const rows = secantRows([0, 0, 5], 2, SHRINKING_STEPS);
    expect(rows).toHaveLength(SHRINKING_STEPS.length);
    expect(rows[0]!.yStart).toBe(20);
    // s = 5t², s'(2) = 20; наклон секущей равен 20 + 5h.
    for (const row of rows) {
      expect(row.slope).toBeCloseTo(20 + 5 * row.h, 9);
      expect(row.gap).toBeCloseTo(5 * row.h, 9);
    }
    const gaps = rows.map((row) => Math.abs(row.gap));
    for (let index = 1; index < gaps.length; index += 1) {
      expect(gaps[index]!).toBeLessThan(gaps[index - 1]!);
    }
    expect(gaps[gaps.length - 1]!).toBeLessThan(0.01);
  });

  it('секущая и касательная проходят через точку графика', () => {
    const secant = secantLine(CUBIC, 1, 0.5);
    expect(lineValue(secant, 1)).toBeCloseTo(valueAt(CUBIC, 1), 9);
    expect(lineValue(secant, 1.5)).toBeCloseTo(valueAt(CUBIC, 1.5), 9);

    const tangent = tangentLine(CUBIC, 2);
    expect(tangent.slope).toBe(9);
    expect(tangent.intercept).toBe(-16);
    expect(lineValue(tangent, 2)).toBe(valueAt(CUBIC, 2));
    expect(lineText(tangent)).toBe('y = 9x − 16');
  });

  it('в точке экстремума касательная горизонтальна', () => {
    const tangent = tangentLine(CUBIC, -1);
    expect(tangent.slope).toBe(0);
    expect(lineText(tangent)).toBe('y = 2');
  });
});

describe('корни производной', () => {
  it('находит точные рациональные корни линейного и квадратного случая', () => {
    expect(polynomialRoots([-6, 4])).toEqual([{ x: 1.5, exact: { numerator: 3, denominator: 2 } }]);
    const roots = polynomialRoots([-3, 0, 3]);
    expect(roots.map((root) => root.x)).toEqual([-1, 1]);
    expect(roots[0]!.exact).toEqual({ numerator: -1, denominator: 1 });
  });

  it('ловит кратный корень без смены знака', () => {
    const roots = polynomialRoots([0, 0, 3]);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.x).toBe(0);
  });

  it('решает кубическое уравнение, разбивая его корнями производной', () => {
    const roots = polynomialRoots([0, -4, 0, 4]).map((root) => root.x);
    expect(roots).toHaveLength(3);
    expect(roots[0]!).toBeCloseTo(-1, 9);
    expect(roots[1]!).toBeCloseTo(0, 9);
    expect(roots[2]!).toBeCloseTo(1, 9);
  });

  it('возвращает иррациональные корни приближённо и честно помечает их', () => {
    const roots = polynomialRoots([-2, 0, 1]);
    expect(roots).toHaveLength(2);
    expect(roots[0]!.x).toBeCloseTo(-Math.SQRT2, 9);
    expect(roots[0]!.exact).toBeNull();
    expect(roots[1]!.exact).toBeNull();
  });

  it('у многочлена без корней список пуст, у нулевого — ошибка', () => {
    expect(polynomialRoots([4])).toEqual([]);
    expect(polynomialRoots([3, 0, 3])).toEqual([]);
    expect(() => polynomialRoots([])).toThrow('любое число');
  });

  it('определяет знак значения с допуском на округление', () => {
    expect(signAt([-3, 0, 3], -2)).toBe(1);
    expect(signAt([-3, 0, 3], 0)).toBe(-1);
    expect(signAt([-3, 0, 3], 1)).toBe(0);
  });
});

describe('исследование функции', () => {
  it('различает максимум, минимум и точку без экстремума', () => {
    const points = criticalPoints(CUBIC);
    expect(points.map((point) => [point.x, point.y, point.kind])).toEqual([
      [-1, 2, 'maximum'],
      [1, -2, 'minimum'],
    ]);

    const flat = criticalPoints([0, 0, 0, 1]);
    expect(flat).toHaveLength(1);
    expect(flat[0]!.x).toBe(0);
    expect(flat[0]!.kind).toBe('none');

    expect(criticalPoints([0, 3, 0, 1])).toEqual([]);
    expect(criticalPoints([7])).toEqual([]);
  });

  it('находит все три стационарные точки биквадратной функции', () => {
    const points = criticalPoints([0, 0, -2, 0, 1]);
    expect(points.map((point) => point.kind)).toEqual(['minimum', 'maximum', 'minimum']);
    expect(points.map((point) => Math.round(point.x * 1e6) / 1e6)).toEqual([-1, 0, 1]);
    expect(points.map((point) => Math.round(point.y * 1e6) / 1e6)).toEqual([-1, 0, -1]);
  });

  it('склеивает соседние промежутки с одинаковым знаком производной', () => {
    expect(monotonicityIntervals(CUBIC)).toEqual([
      { from: null, to: -1, kind: 'increasing' },
      { from: -1, to: 1, kind: 'decreasing' },
      { from: 1, to: null, kind: 'increasing' },
    ]);
    expect(monotonicityIntervals([0, 0, 0, 1])).toEqual([
      { from: null, to: null, kind: 'increasing' },
    ]);
    expect(monotonicityIntervals([5])).toEqual([{ from: null, to: null, kind: 'constant' }]);
  });

  it('записывает промежутки по-русски', () => {
    const intervals = monotonicityIntervals(CUBIC);
    expect(intervalText(intervals[0]!)).toBe('(−∞; −1]');
    expect(intervalText(intervals[1]!)).toBe('[−1; 1]');
    expect(intervalText(intervals[2]!)).toBe('[1; +∞)');
  });
});

describe('наибольшее и наименьшее значение на отрезке', () => {
  it('берёт в кандидаты только концы отрезка и стационарные точки внутри', () => {
    const result = extremaOnSegment(CUBIC, -2, 3);
    expect(result.candidates.map((candidate) => candidate.x)).toEqual([-2, -1, 1, 3]);
    expect(result.candidates.map((candidate) => candidate.y)).toEqual([-2, 2, -2, 18]);
    expect(result.maximum).toEqual({ x: 3, y: 18, source: 'endpoint' });
    expect(result.minimum.y).toBe(-2);
  });

  it('решает задачу о коробке из квадратного листа 12 на 12', () => {
    const volume = getProfilePreset('box-volume');
    const result = extremaOnSegment(volume.coefficients, 0, 6);
    expect(result.maximum.x).toBeCloseTo(2, 9);
    expect(result.maximum.y).toBeCloseTo(128, 9);
    expect(result.maximum.source).toBe('critical');
    expect(result.minimum.y).toBeCloseTo(0, 9);
  });

  it('решает задачу о заборе вдоль стены', () => {
    const fence = getProfilePreset('fence');
    const result = extremaOnSegment(fence.coefficients, 0, 30);
    expect(result.maximum.x).toBe(15);
    expect(result.maximum.y).toBe(450);
    expect(result.minimum.y).toBe(0);
  });

  it('требует корректный отрезок', () => {
    expect(() => extremaOnSegment(CUBIC, 3, 3)).toThrow('больше левого');
    expect(() => extremaOnSegment(CUBIC, 5, 1)).toThrow('больше левого');
  });
});

describe('таблица производных основных функций', () => {
  it('каждая формула выдерживает численную проверку', () => {
    for (const fact of DERIVATIVE_FACTS) {
      for (const x of fact.probes) {
        const numeric = numericDerivative(fact.value, x, 1e-5);
        expect(Math.abs(numeric - fact.derivative(x))).toBeLessThan(1e-4);
      }
    }
  });

  it('не содержит повторяющихся идентификаторов', () => {
    const ids = DERIVATIVE_FACTS.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('требует положительного шага численной производной', () => {
    expect(() => numericDerivative(Math.sin, 1, 0)).toThrow('положительным');
  });
});

describe('наборы лабораторий', () => {
  it('точки касания секущей лежат внутри окна рисунка', () => {
    for (const preset of SECANT_PRESETS) {
      expect(preset.box.xMin).toBeLessThan(preset.box.xMax);
      expect(preset.box.yMin).toBeLessThan(preset.box.yMax);
      expect(preset.anchors).toContain(preset.defaultAnchor);
      for (const anchor of preset.anchors) {
        expect(anchor).toBeGreaterThanOrEqual(preset.box.xMin);
        expect(anchor).toBeLessThanOrEqual(preset.box.xMax);
        expect(availableSteps(preset, anchor).length).toBeGreaterThan(1);
      }
    }
    expect(getSecantPreset('fall').coefficients).toEqual([0, 0, 5]);
    expect(() => getSecantPreset('нет' as never)).toThrow('Неизвестный набор');
  });

  it('оставляет только шаги, не выводящие вторую точку за окно', () => {
    const preset = getSecantPreset('fall');
    for (const h of availableSteps(preset, 2)) {
      expect(2 + h).toBeGreaterThanOrEqual(preset.box.xMin);
      expect(2 + h).toBeLessThanOrEqual(preset.box.xMax);
    }
    expect(availableSteps(preset, 0.5)).not.toContain(-1);
  });

  it('у графика функции и графика производной общая ось x', () => {
    for (const preset of PROFILE_PRESETS) {
      expect(preset.derivativeBox.xMin).toBe(preset.box.xMin);
      expect(preset.derivativeBox.xMax).toBe(preset.box.xMax);
      expect(preset.box.yMin).toBeLessThan(preset.box.yMax);
      expect(preset.derivativeBox.yMin).toBeLessThan(preset.derivativeBox.yMax);
      expect(() => criticalPoints(preset.coefficients)).not.toThrow();
      if (preset.segment) {
        expect(preset.segment.from).toBeLessThan(preset.segment.to);
        expect(() => extremaOnSegment(
          preset.coefficients,
          preset.segment!.from,
          preset.segment!.to,
        )).not.toThrow();
      }
    }
    expect(() => getProfilePreset('нет' as never)).toThrow('Неизвестный набор');
  });

  it('строит ломаные графика внутри окна', () => {
    const preset = getProfilePreset('cubic');
    const segments = polynomialSegments(preset.coefficients, preset.box, 121);
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      for (const point of segment) {
        expect(point.x).toBeGreaterThanOrEqual(preset.box.xMin - 1e-9);
        expect(point.x).toBeLessThanOrEqual(preset.box.xMax + 1e-9);
        expect(point.y).toBeGreaterThanOrEqual(preset.box.yMin - 1e-6);
        expect(point.y).toBeLessThanOrEqual(preset.box.yMax + 1e-6);
      }
    }
  });
});
