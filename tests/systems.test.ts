import { describe, expect, it } from 'vitest';
import {
  EQUATION_PRESETS,
  SYSTEM_PRESETS,
  biquadraticPlan,
  containsRoot,
  curveSegments,
  curveShape,
  curveText,
  curveValue,
  describeCurveSystem,
  exactSquareRoot,
  formatApproximate,
  formatPoint,
  formatPointList,
  formatPolynomialEquation,
  formatReducedEquation,
  formatRoot,
  formatRootList,
  getEquationPreset,
  getSystemPreset,
  isFunctionCurve,
  matchesRootList,
  normalizeRoots,
  satisfiesCurve,
  satisfiesSystem,
  solveCurveSystem,
  solvePolynomialEquation,
  solveQuadraticExact,
  solveRationalEquation,
  type CurveSpec,
  type RealRoot,
} from '../src/lib/systems';
import { parseValueList } from '../src/lib/algebraicFractions';
import { formatExactRussian, parseExact } from '../src/lib/exactRational';

const text = (root: RealRoot) => formatRoot(root, 4);
const list = (roots: readonly RealRoot[]) => roots.map(text);

describe('точный квадратный корень', () => {
  it('извлекается только из точных квадратов', () => {
    expect(exactSquareRoot(49)).toEqual({ numerator: 7n, denominator: 1n });
    expect(exactSquareRoot('9/4')).toEqual({ numerator: 3n, denominator: 2n });
    expect(exactSquareRoot(0)).toEqual({ numerator: 0n, denominator: 1n });
  });

  it('возвращает null там, где точного значения нет', () => {
    expect(exactSquareRoot(2)).toBeNull();
    expect(exactSquareRoot('2/3')).toBeNull();
    expect(exactSquareRoot(-4)).toBeNull();
  });
});

describe('квадратное уравнение', () => {
  it('находит два рациональных корня и дискриминант', () => {
    const outcome = solveQuadraticExact(1, -5, 6);
    expect(outcome.kind).toBe('two');
    expect(outcome.degenerate).toBe(false);
    expect(list(outcome.roots)).toEqual(['2', '3']);
    expect(formatExactRussian(outcome.discriminant!)).toBe('1');
  });

  it('склеивает совпавшие корни при нулевом дискриминанте', () => {
    const outcome = solveQuadraticExact(1, -2, 1);
    expect(outcome.kind).toBe('one');
    expect(list(outcome.roots)).toEqual(['1']);
    expect(formatExactRussian(outcome.discriminant!)).toBe('0');
  });

  it('честно сообщает об отсутствии действительных корней', () => {
    const outcome = solveQuadraticExact(1, 0, 1);
    expect(outcome.kind).toBe('none');
    expect(outcome.roots).toHaveLength(0);
    expect(formatExactRussian(outcome.discriminant!)).toBe('−4');
  });

  it('оставляет иррациональные корни приближёнными, а не выдуманно точными', () => {
    const outcome = solveQuadraticExact(1, 0, -2);
    expect(outcome.roots.map((root) => root.exact)).toEqual([null, null]);
    expect(outcome.roots[0]!.approx).toBeCloseTo(-Math.SQRT2, 12);
    expect(outcome.roots[1]!.approx).toBeCloseTo(Math.SQRT2, 12);
    expect(list(outcome.roots)).toEqual(['≈ −1,4142', '≈ 1,4142']);
  });

  it('распознаёт вырождение в линейное уравнение и в числовое равенство', () => {
    const linear = solveQuadraticExact(0, 2, -6);
    expect(linear.degenerate).toBe(true);
    expect(linear.discriminant).toBeNull();
    expect(list(linear.roots)).toEqual(['3']);

    expect(solveQuadraticExact(0, 0, 5).kind).toBe('none');
    expect(solveQuadraticExact(0, 0, 0).kind).toBe('all');
  });

  it('находит дробные корни точно', () => {
    expect(list(solveQuadraticExact(2, -1, -1).roots)).toEqual(['−0,5', '1']);
    expect(list(solveQuadraticExact(3, -1, 0).roots)).toEqual(['0', '1/3']);
  });
});

describe('список корней', () => {
  const two: RealRoot = { exact: parseExact(2), approx: 2 };
  const twoAgain: RealRoot = { exact: parseExact('4/2'), approx: 2 };
  const five: RealRoot = { exact: parseExact(5), approx: 5 };

  it('упорядочивает и убирает повторы', () => {
    expect(list(normalizeRoots([five, two, twoAgain]))).toEqual(['2', '5']);
  });

  it('проверяет принадлежность точным сравнением', () => {
    expect(containsRoot([two, five], twoAgain)).toBe(true);
    expect(containsRoot([two], five)).toBe(false);
  });
});

describe('целое уравнение', () => {
  it('раскладывает уравнение с общим множителем', () => {
    const solution = solvePolynomialEquation([0, -9, 0, 1]);
    expect(list(solution.roots)).toEqual(['−3', '0', '3']);
    expect(solution.complete).toBe(true);
    expect(solution.identity).toBe(false);
  });

  it('решает кубическое уравнение через рациональный корень', () => {
    expect(list(solvePolynomialEquation([2, -1, -2, 1]).roots)).toEqual(['−1', '1', '2']);
    expect(list(solvePolynomialEquation([-20, -4, 5, 1]).roots)).toEqual(['−5', '−2', '2']);
  });

  it('решает биквадратное уравнение', () => {
    expect(list(solvePolynomialEquation([36, 0, -13, 0, 1]).roots)).toEqual(['−3', '−2', '2', '3']);
    expect(list(solvePolynomialEquation([-4, 0, 3, 0, 1]).roots)).toEqual(['−1', '1']);
  });

  it('видит тождество 0 = 0', () => {
    const solution = solvePolynomialEquation([0, 0, 0]);
    expect(solution.identity).toBe(true);
    expect(solution.roots).toHaveLength(0);
  });

  it('не притворяется, что нашло все корни кубического уравнения без рациональных корней', () => {
    const solution = solvePolynomialEquation([-1, -3, 0, 1]);
    expect(solution.complete).toBe(false);
    expect(solution.roots).toHaveLength(0);
  });

  it('отказывается от слишком высокой степени', () => {
    expect(() => solvePolynomialEquation([1, 0, 0, 0, 0, 0, 0, 0, 0, 1])).toThrow(RangeError);
  });
});

describe('замена t = x²', () => {
  it('переводит корни для t в корни для x', () => {
    const plan = biquadraticPlan(1, -13, 36);
    expect(list(plan.substitution.roots)).toEqual(['4', '9']);
    expect(list(plan.usableT)).toEqual(['4', '9']);
    expect(list(plan.roots)).toEqual(['−3', '−2', '2', '3']);
  });

  it('отбраковывает отрицательные значения t', () => {
    const plan = biquadraticPlan(1, 3, -4);
    expect(list(plan.substitution.roots)).toEqual(['−4', '1']);
    expect(list(plan.usableT)).toEqual(['1']);
    expect(list(plan.roots)).toEqual(['−1', '1']);
  });

  it('оставляет один корень при t = 0', () => {
    const plan = biquadraticPlan(1, 0, 0);
    expect(list(plan.roots)).toEqual(['0']);
  });
});

describe('дробно-рациональное уравнение', () => {
  it('выписывает запреты, общий знаменатель и целое уравнение', () => {
    const solution = solveRationalEquation(getEquationPreset('work-pair').equation!);
    expect(list(solution.restrictions)).toEqual(['−3', '0']);
    expect(formatPolynomialEquation(solution.commonDenominator)).toBe('x² + 3x = 0');
    expect(formatPolynomialEquation(solution.cleared)).toBe('x² − x − 6 = 0');
    expect(list(solution.roots)).toEqual(['−2', '3']);
    expect(solution.extraneous).toHaveLength(0);
  });

  it('отделяет посторонний корень от настоящего', () => {
    const solution = solveRationalEquation(getEquationPreset('shared-denominator').equation!);
    expect(list(solution.restrictions)).toEqual(['−1', '1']);
    expect(list(solution.candidates)).toEqual(['−1', '0']);
    expect(list(solution.roots)).toEqual(['0']);
    expect(list(solution.extraneous)).toEqual(['−1']);
  });

  it('доводит до ответа «корней нет», когда единственный кандидат запрещён', () => {
    const solution = solveRationalEquation(getEquationPreset('empty-answer').equation!);
    expect(list(solution.candidates)).toEqual(['2']);
    expect(solution.roots).toHaveLength(0);
    expect(list(solution.extraneous)).toEqual(['2']);
    expect(formatRootList(solution.roots)).toBe('корней нет');
  });

  it('ловит выколотую точку после сокращения дроби', () => {
    const solution = solveRationalEquation(getEquationPreset('cancel-trap').equation!);
    expect(list(solution.restrictions)).toEqual(['3']);
    expect(list(solution.candidates)).toEqual(['3']);
    expect(solution.roots).toHaveLength(0);
  });

  it('распознаёт исчезнувшую переменную', () => {
    const solution = solveRationalEquation(getEquationPreset('contradiction').equation!);
    expect(solution.candidates).toHaveLength(0);
    expect(solution.roots).toHaveLength(0);
    expect(solution.identity).toBe(false);
  });

  it('оставляет оба корня, когда посторонних нет', () => {
    const solution = solveRationalEquation(getEquationPreset('two-roots').equation!);
    expect(list(solution.roots)).toEqual(['−3', '2']);
    expect(solution.extraneous).toHaveLength(0);
  });

  it('запрещает нулевой знаменатель слагаемого', () => {
    expect(() => solveRationalEquation({
      left: [{ numerator: [1], denominator: [0] }],
      right: [{ numerator: [1], denominator: [1] }],
    })).toThrow(RangeError);
  });
});

describe('уравнение с двумя переменными', () => {
  const line: CurveSpec = { kind: 'line', k: -1, b: -2 };
  const parabola: CurveSpec = { kind: 'parabola', a: -1, b: 0, c: 4 };
  const hyperbola: CurveSpec = { kind: 'hyperbola', k: 6 };
  const circle: CurveSpec = { kind: 'circle', r: 5 };

  it('записывает уравнение школьной строкой', () => {
    expect(curveText({ kind: 'line', k: 1, b: 0 })).toBe('y = x');
    expect(curveText({ kind: 'line', k: 0, b: 3 })).toBe('y = 3');
    expect(curveText(line)).toBe('y = −x − 2');
    expect(curveText({ kind: 'parabola', a: 1, b: 0, c: 0 })).toBe('y = x²');
    expect(curveText(parabola)).toBe('y = −x² + 4');
    expect(curveText(hyperbola)).toBe('y = 6/x');
    expect(curveText(circle)).toBe('x² + y² = 25');
  });

  it('называет линию', () => {
    expect(curveShape(line)).toBe('прямая');
    expect(curveShape(parabola)).toBe('парабола');
    expect(curveShape(hyperbola)).toContain('гипербола');
    expect(curveShape(circle)).toContain('окружность');
  });

  it('отличает график функции от окружности', () => {
    expect(isFunctionCurve(line)).toBe(true);
    expect(isFunctionCurve(hyperbola)).toBe(true);
    expect(isFunctionCurve(circle)).toBe(false);
  });

  it('вычисляет y там, где он определён', () => {
    expect(curveValue(line, 3)).toBe(-5);
    expect(curveValue(parabola, 2)).toBe(0);
    expect(curveValue(hyperbola, 3)).toBe(2);
    expect(curveValue(hyperbola, 0)).toBeNull();
    expect(curveValue(circle, 1)).toBeNull();
  });

  it('точно проверяет пару (x; y)', () => {
    expect(satisfiesCurve({ kind: 'parabola', a: 1, b: 0, c: 0 }, -2, 4)).toBe(true);
    expect(satisfiesCurve({ kind: 'parabola', a: 1, b: 0, c: 0 }, 4, -2)).toBe(false);
    expect(satisfiesCurve(hyperbola, '0,5', 12)).toBe(true);
    expect(satisfiesCurve(hyperbola, 0, 6)).toBe(false);
    expect(satisfiesCurve(circle, 3, -4)).toBe(true);
    expect(satisfiesCurve(circle, 3, -2)).toBe(false);
  });

  it('запрещает вырожденные коэффициенты', () => {
    expect(() => curveText({ kind: 'parabola', a: 0, b: 1, c: 2 })).toThrow(RangeError);
    expect(() => curveText({ kind: 'hyperbola', k: 0 })).toThrow(RangeError);
    expect(() => curveText({ kind: 'circle', r: 0 })).toThrow(RangeError);
    expect(() => curveText({ kind: 'line', k: Number.NaN, b: 1 })).toThrow(TypeError);
  });
});

describe('система двух уравнений', () => {
  it('сводит параболу и прямую к квадратному уравнению', () => {
    const solution = solveCurveSystem({ kind: 'parabola', a: 1, b: 0, c: 0 }, { kind: 'line', k: 1, b: 2 });
    expect(solution.kind).toBe('points');
    expect(formatReducedEquation(solution.reduced)).toBe('x² − x − 2 = 0');
    expect(formatExactRussian(solution.discriminant!)).toBe('9');
    expect(solution.points.map((point) => formatPoint(point))).toEqual(['(−1; 1)', '(2; 4)']);
  });

  it('решает систему с гиперболой', () => {
    const solution = solveCurveSystem({ kind: 'hyperbola', k: 6 }, { kind: 'line', k: 1, b: 1 });
    expect(formatPointList(solution.points)).toBe('(−3; −2); (2; 3)');
  });

  it('решает систему с окружностью', () => {
    const solution = solveCurveSystem({ kind: 'circle', r: 5 }, { kind: 'line', k: 1, b: 1 });
    expect(formatPointList(solution.points)).toBe('(−4; −3); (3; 4)');
    expect(formatReducedEquation(solution.reduced)).toBe('2x² + 2x − 24 = 0');
  });

  it('даёт одно решение при касании и ни одного при отрицательном дискриминанте', () => {
    const tangent = solveCurveSystem({ kind: 'parabola', a: 1, b: 0, c: 0 }, { kind: 'line', k: 2, b: -1 });
    expect(formatExactRussian(tangent.discriminant!)).toBe('0');
    expect(formatPointList(tangent.points)).toBe('(1; 1)');

    const empty = solveCurveSystem({ kind: 'parabola', a: 1, b: 0, c: 0 }, { kind: 'line', k: -1, b: -1 });
    expect(formatExactRussian(empty.discriminant!)).toBe('−3');
    expect(formatPointList(empty.points)).toBe('решений нет');
  });

  it('вырождается в линейное уравнение для двух прямых', () => {
    const solution = solveCurveSystem({ kind: 'line', k: 2, b: -1 }, { kind: 'line', k: -1, b: 5 });
    expect(formatReducedEquation(solution.reduced)).toBe('3x − 6 = 0');
    expect(solution.discriminant).toBeNull();
    expect(formatPointList(solution.points)).toBe('(2; 3)');
  });

  it('распознаёт совпадающие линии', () => {
    const lines = solveCurveSystem({ kind: 'line', k: 2, b: -1 }, { kind: 'line', k: 2, b: -1 });
    expect(lines.kind).toBe('infinite');
    expect(solveCurveSystem({ kind: 'circle', r: 4 }, { kind: 'circle', r: 4 }).kind).toBe('infinite');
    expect(solveCurveSystem({ kind: 'circle', r: 4 }, { kind: 'circle', r: 5 }).points).toHaveLength(0);
  });

  it('оставляет иррациональные координаты приближёнными', () => {
    const solution = solveCurveSystem({ kind: 'parabola', a: 1, b: 0, c: -2 }, { kind: 'parabola', a: -1, b: 0, c: 4 });
    expect(solution.points).toHaveLength(2);
    expect(solution.points[1]!.x.exact).toBeNull();
    expect(solution.points[1]!.x.approx).toBeCloseTo(Math.sqrt(3), 12);
  });

  it('честно отказывается от пары, которую не разбирает', () => {
    const solution = solveCurveSystem({ kind: 'circle', r: 5 }, { kind: 'parabola', a: 1, b: 0, c: 0 });
    expect(solution.kind).toBe('unsupported');
    expect(solution.points).toHaveLength(0);
  });

  it('проверяет пару сразу в двух уравнениях', () => {
    const parabola: CurveSpec = { kind: 'parabola', a: 1, b: 0, c: 0 };
    const line: CurveSpec = { kind: 'line', k: 1, b: 2 };
    expect(satisfiesSystem(parabola, line, 2, 4)).toBe(true);
    expect(satisfiesSystem(parabola, line, 3, 9)).toBe(false);
  });

  it('описывает число общих точек словами', () => {
    expect(describeCurveSystem(solveCurveSystem({ kind: 'parabola', a: 1, b: 0, c: 0 }, { kind: 'line', k: 1, b: 2 })))
      .toContain('2');
    expect(describeCurveSystem(solveCurveSystem({ kind: 'parabola', a: 1, b: 0, c: 0 }, { kind: 'line', k: -1, b: -1 })))
      .toContain('нет');
    expect(describeCurveSystem(solveCurveSystem({ kind: 'line', k: 1, b: 1 }, { kind: 'line', k: 1, b: 1 })))
      .toContain('бесконечно');
  });
});

describe('геометрия рисунка', () => {
  const inside = (value: number, extent: number) => value >= -extent - 1e-9 && value <= extent + 1e-9;

  it('строит прямую одним отрезком, отсечённым по окну', () => {
    expect(curveSegments({ kind: 'line', k: 1, b: 2 }, 6)).toEqual([{ x1: -6, y1: -4, x2: 4, y2: 6 }]);
    expect(curveSegments({ kind: 'line', k: 0, b: 9 }, 6)).toEqual([]);
  });

  it('держит все узлы параболы внутри окна и на самой параболе', () => {
    const extent = 4;
    const segments = curveSegments({ kind: 'parabola', a: 1, b: 0, c: -2 }, extent, 121);
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      expect(inside(segment.x1, extent)).toBe(true);
      expect(inside(segment.y1, extent)).toBe(true);
      expect(inside(segment.x2, extent)).toBe(true);
      expect(inside(segment.y2, extent)).toBe(true);
    }
    const middle = segments[Math.floor(segments.length / 2)]!;
    expect(middle.y1).toBeCloseTo(middle.x1 * middle.x1 - 2, 6);
  });

  it('рисует гиперболу двумя ветвями и не проходит через ось y', () => {
    const segments = curveSegments({ kind: 'hyperbola', k: 6 }, 8, 61);
    expect(segments.length).toBeGreaterThan(0);
    const left = segments.filter((segment) => segment.x1 < 0 && segment.x2 < 0);
    const right = segments.filter((segment) => segment.x1 > 0 && segment.x2 > 0);
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBeGreaterThan(0);
    expect(left.length + right.length).toBe(segments.length);
    // Узлы, не задетые отсечением по краю окна, обязаны лежать ровно на гиперболе.
    const interior = segments.filter((segment) => Math.abs(segment.y1) < 8 - 1e-6 && Math.abs(segment.x1) < 8 - 1e-6);
    expect(interior.length).toBeGreaterThan(0);
    for (const segment of interior) {
      expect(segment.y1 * segment.x1).toBeCloseTo(6, 6);
    }
  });

  it('держит окружность на своём радиусе', () => {
    const segments = curveSegments({ kind: 'circle', r: 5 }, 7, 120);
    expect(segments).toHaveLength(120);
    for (const segment of segments) {
      expect(Math.hypot(segment.x1, segment.y1)).toBeCloseTo(5, 6);
    }
  });

  it('проверяет параметры окна и числа узлов', () => {
    expect(() => curveSegments({ kind: 'line', k: 1, b: 0 }, 0)).toThrow(RangeError);
    expect(() => curveSegments({ kind: 'parabola', a: 1, b: 0, c: 0 }, 5, 4)).toThrow(RangeError);
    expect(() => curveSegments({ kind: 'parabola', a: 1, b: 0, c: 0 }, 5, 3000)).toThrow(RangeError);
  });
});

describe('оформление ответов', () => {
  it('пишет приближение по-русски', () => {
    expect(formatApproximate(1.7320508, 2)).toBe('1,73');
    expect(formatApproximate(-1.5, 1)).toBe('−1,5');
    expect(formatApproximate(2, 2)).toBe('2');
    expect(formatApproximate(0.004, 2)).toBe('0');
    expect(() => formatApproximate(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => formatApproximate(1, 11)).toThrow(RangeError);
  });

  it('различает точный корень и приближённый', () => {
    expect(formatRoot({ exact: parseExact('3/2'), approx: 1.5 })).toBe('1,5');
    expect(formatRoot({ exact: null, approx: Math.SQRT2 })).toBe('≈ 1,41');
    expect(formatRootList([])).toBe('корней нет');
    expect(formatPointList([])).toBe('решений нет');
  });

  it('записывает целое уравнение и уравнение системы', () => {
    expect(formatPolynomialEquation([-2, -1, 1])).toBe('x² − x − 2 = 0');
    expect(formatReducedEquation(null)).toBe('уравнение не составлено');
    expect(formatReducedEquation({ a: parseExact(0), b: parseExact(0), c: parseExact(0) })).toBe('0 = 0');
    expect(formatReducedEquation({ a: parseExact('1/2'), b: parseExact(-1), c: parseExact(0) })).toBe('0,5x² − x = 0');
    expect(formatReducedEquation({ a: parseExact(1), b: parseExact(0), c: parseExact(-9) }, 't')).toBe('t² − 9 = 0');
  });

  it('сравнивает ответ ученика со списком корней', () => {
    const roots = solveQuadraticExact(1, -1, -2).roots;
    expect(matchesRootList(roots, parseValueList('2; −1')!)).toBe(true);
    expect(matchesRootList(roots, parseValueList('−1')!)).toBe(false);
    expect(matchesRootList([], parseValueList('нет')!)).toBe(true);
    expect(matchesRootList(solveQuadraticExact(1, 0, -2).roots, parseValueList('1,41; −1,41')!)).toBe(false);
  });
});

describe('наборы примеров', () => {
  it('у каждого примера уравнения есть данные своего вида', () => {
    for (const preset of EQUATION_PRESETS) {
      expect(preset.title.length).toBeGreaterThan(0);
      expect(preset.note.length).toBeGreaterThan(0);
      if (preset.kind === 'polynomial') {
        expect(preset.polynomial).toBeDefined();
        expect(() => solvePolynomialEquation(preset.polynomial!)).not.toThrow();
      } else {
        expect(preset.equation).toBeDefined();
        expect(() => solveRationalEquation(preset.equation!)).not.toThrow();
      }
    }
    expect(new Set(EQUATION_PRESETS.map((preset) => preset.id)).size).toBe(EQUATION_PRESETS.length);
  });

  it('каждая пара линий в примерах систем разбирается ядром', () => {
    for (const preset of SYSTEM_PRESETS) {
      const solution = solveCurveSystem(preset.first, preset.second);
      expect(solution.kind).not.toBe('unsupported');
      expect(preset.extent).toBeGreaterThan(0);
      expect(curveSegments(preset.first, preset.extent).length).toBeGreaterThan(0);
      expect(curveSegments(preset.second, preset.extent).length).toBeGreaterThan(0);
    }
    expect(new Set(SYSTEM_PRESETS.map((preset) => preset.id)).size).toBe(SYSTEM_PRESETS.length);
  });

  it('находит пример по имени и отвергает неизвестное', () => {
    expect(getEquationPreset('biquadratic').label).toBe('x⁴ − 13x² + 36 = 0');
    expect(getSystemPreset('parabola-line').title).toBe('Парабола и прямая');
    expect(() => getEquationPreset('нет-такого')).toThrow(RangeError);
    expect(() => getSystemPreset('нет-такого')).toThrow(RangeError);
  });
});
