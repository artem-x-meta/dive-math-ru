import { describe, expect, it } from 'vitest';
import {
  MODULUS_PRESETS,
  RADICAL_PRESETS,
  TRANSFORMS,
  absoluteBranches,
  absoluteCurve,
  consequencePolynomial,
  domainIntervals,
  evaluateAt,
  formatAnswer,
  formatConsequence,
  formatEquation,
  formatSquaredEquation,
  getLogicPreset,
  negatePolynomial,
  polynomialCurve,
  signOfValue,
  solveEquation,
  squarePolynomial,
  squareRootCurve,
  subtractPolynomials,
  transformInfo,
  valueAt,
  withPositiveLeading,
  type EquationSpec,
  type RealRoot,
} from '../src/lib/equationLogic';

function exactRoots(roots: readonly RealRoot[]): string[] {
  return roots.map((root) => (root.exact === null
    ? `≈${root.approx.toFixed(4)}`
    : `${root.exact.numerator}/${root.exact.denominator}`));
}

describe('многочлены главы', () => {
  it('вычитает и возводит в квадрат точно', () => {
    expect(subtractPolynomials([3, 1], [1, 2, 1])).toEqual([2, -1, -1]);
    expect(squarePolynomial([1, 1])).toEqual([1, 2, 1]);
    expect(squarePolynomial([-5, 0, 1])).toEqual([25, 0, -10, 0, 1]);
    expect(negatePolynomial([2, -1, -1])).toEqual([-2, 1, 1]);
  });

  it('приводит уравнение к положительному старшему коэффициенту', () => {
    expect(withPositiveLeading([2, -1, -1])).toEqual([-2, 1, 1]);
    expect(withPositiveLeading([-18, 11, -1])).toEqual([18, -11, 1]);
    expect(withPositiveLeading([-4, -3, 1])).toEqual([-4, -3, 1]);
    expect(withPositiveLeading([0, 0])).toEqual([0]);
  });

  it('считает значение многочлена точно и приближённо', () => {
    expect(evaluateAt([3, 1], 5)).toBe(8);
    expect(evaluateAt([-5, 0, 1], -3)).toBe(4);
    const exact = valueAt([-4, 2], { exact: { numerator: 3n, denominator: 2n }, approx: 1.5 });
    expect(exact.exact).toEqual({ numerator: -1n, denominator: 1n });
    expect(signOfValue(exact)).toBe(-1);
    expect(signOfValue(valueAt([0, 1], { exact: { numerator: 0n, denominator: 1n }, approx: 0 }))).toBe(0);
  });

  it('отвергает нецелые и нечисловые коэффициенты', () => {
    expect(() => squarePolynomial([1.5, 1])).toThrow('целыми');
    expect(() => evaluateAt([], 1)).toThrow('непустым');
  });
});

describe('уравнение-следствие', () => {
  it('возводит в квадрат уравнение с корнем', () => {
    // √(x + 3) = x + 1  →  x + 3 = (x + 1)²  →  x² + x − 2 = 0
    expect(consequencePolynomial({ kind: 'sqrt-poly', radicand: [3, 1], right: [1, 1] })).toEqual([-2, 1, 1]);
    // √(x + 7) = x − 5  →  x² − 11x + 18 = 0
    expect(consequencePolynomial({ kind: 'sqrt-poly', radicand: [7, 1], right: [-5, 1] })).toEqual([18, -11, 1]);
  });

  it('приравнивает подкоренные выражения и квадраты модулей', () => {
    expect(consequencePolynomial({ kind: 'sqrt-sqrt', left: [-4, 0, 1], right: [0, 3] })).toEqual([-4, -3, 1]);
    // |x − 1| = 2x − 4  →  3x² − 14x + 15 = 0
    expect(consequencePolynomial({ kind: 'abs-poly', inner: [-1, 1], right: [-4, 2] })).toEqual([15, -14, 3]);
    // |x + 2| = |2x − 1|  →  3x² − 8x − 3 = 0
    expect(consequencePolynomial({ kind: 'abs-abs', left: [2, 1], right: [-1, 2] })).toEqual([-3, -8, 3]);
  });
});

describe('иррациональные уравнения: отбор кандидатов', () => {
  it('оставляет только тот корень, при котором правая часть неотрицательна', () => {
    const solution = solveEquation({ kind: 'sqrt-poly', radicand: [3, 1], right: [1, 1] });
    expect(exactRoots(solution.candidates.map((item) => item.root))).toEqual(['-2/1', '1/1']);
    expect(exactRoots(solution.roots)).toEqual(['1/1']);
    expect(exactRoots(solution.extraneous)).toEqual(['-2/1']);
    expect(solution.candidates[0]!.status).toBe('right-negative');
    expect(solution.candidates[0]!.note).toContain('Посторонний корень');
    expect(solution.candidates[1]!.accepted).toBe(true);
    expect(solution.complete).toBe(true);
  });

  it('разбирает √(2x + 3) = x и √(x + 7) = x − 5', () => {
    const first = solveEquation({ kind: 'sqrt-poly', radicand: [3, 2], right: [0, 1] });
    expect(exactRoots(first.candidates.map((item) => item.root))).toEqual(['-1/1', '3/1']);
    expect(exactRoots(first.roots)).toEqual(['3/1']);

    const second = solveEquation({ kind: 'sqrt-poly', radicand: [7, 1], right: [-5, 1] });
    expect(exactRoots(second.candidates.map((item) => item.root))).toEqual(['2/1', '9/1']);
    expect(exactRoots(second.roots)).toEqual(['9/1']);
    expect(second.extraneous).toHaveLength(1);
  });

  it('не выбрасывает никого, если правая часть — неотрицательное число', () => {
    const constant = solveEquation({ kind: 'sqrt-poly', radicand: [-1, 1], right: [3] });
    expect(exactRoots(constant.roots)).toEqual(['10/1']);
    expect(constant.extraneous).toHaveLength(0);

    const quadratic = solveEquation({ kind: 'sqrt-poly', radicand: [0, -3, 1], right: [2] });
    expect(exactRoots(quadratic.roots)).toEqual(['-1/1', '4/1']);
    expect(quadratic.extraneous).toHaveLength(0);
  });

  it('ловит кандидата с отрицательным подкоренным выражением', () => {
    const solution = solveEquation({ kind: 'sqrt-sqrt', left: [-4, 0, 1], right: [0, 3] });
    expect(exactRoots(solution.candidates.map((item) => item.root))).toEqual(['-1/1', '4/1']);
    expect(solution.candidates[0]!.status).toBe('radicand-negative');
    expect(exactRoots(solution.roots)).toEqual(['4/1']);
  });

  it('честно сообщает, когда корней не остаётся', () => {
    // √(x − 1) = −2: после возведения x − 1 = 4, кандидат x = 5, но правая часть отрицательна.
    const solution = solveEquation({ kind: 'sqrt-poly', radicand: [-1, 1], right: [-2] });
    expect(exactRoots(solution.candidates.map((item) => item.root))).toEqual(['5/1']);
    expect(solution.roots).toHaveLength(0);
    expect(formatAnswer(solution)).toBe('корней нет');
  });
});

describe('уравнения с модулем', () => {
  it('решает |x − 2| = 3 без посторонних корней', () => {
    const solution = solveEquation({ kind: 'abs-poly', inner: [-2, 1], right: [3] });
    expect(exactRoots(solution.roots)).toEqual(['-1/1', '5/1']);
    expect(solution.extraneous).toHaveLength(0);
  });

  it('отсеивает кандидата с отрицательной правой частью', () => {
    const solution = solveEquation({ kind: 'abs-poly', inner: [-1, 1], right: [-4, 2] });
    expect(exactRoots(solution.candidates.map((item) => item.root))).toEqual(['5/3', '3/1']);
    expect(exactRoots(solution.roots)).toEqual(['3/1']);
    expect(solution.candidates[0]!.status).toBe('right-negative');
    expect(solution.candidates[0]!.note).toContain('модуль отрицательным не бывает');
  });

  it('оставляет оба корня, когда правая часть в обеих точках неотрицательна', () => {
    const solution = solveEquation({ kind: 'abs-poly', inner: [1, 2], right: [4, 1] });
    expect(exactRoots(solution.roots)).toEqual(['-5/3', '3/1']);
    expect(solution.extraneous).toHaveLength(0);
  });

  it('находит четыре корня у |x² − 5| = 4', () => {
    const solution = solveEquation({ kind: 'abs-poly', inner: [-5, 0, 1], right: [4] });
    expect(exactRoots(solution.roots)).toEqual(['-3/1', '-1/1', '1/1', '3/1']);
  });

  it('оставляет уравнение |x − 3| = x − 5 без корней', () => {
    const solution = solveEquation({ kind: 'abs-poly', inner: [-3, 1], right: [-5, 1] });
    expect(exactRoots(solution.candidates.map((item) => item.root))).toEqual(['4/1']);
    expect(solution.roots).toHaveLength(0);
  });

  it('для |A| = |B| отбора не требуется', () => {
    const solution = solveEquation({ kind: 'abs-abs', left: [2, 1], right: [-1, 2] });
    expect(exactRoots(solution.roots)).toEqual(['-1/3', '3/1']);
    expect(solution.extraneous).toHaveLength(0);
    expect(solution.filter).toContain('отбор не нужен');
  });
});

describe('разбор модуля по определению', () => {
  it('делит |x − 1| = 2x − 4 на две ветви и проверяет условие каждой', () => {
    const [first, second] = absoluteBranches([-1, 1], [-4, 2]);
    expect(first!.condition).toBe('x − 1 ≥ 0');
    expect(first!.equation).toEqual([-3, 1]);
    expect(exactRoots(first!.roots)).toEqual(['3/1']);
    expect(first!.rejected).toHaveLength(0);

    expect(second!.condition).toBe('x − 1 < 0');
    expect(second!.equation).toEqual([-5, 3]);
    expect(second!.roots).toHaveLength(0);
    expect(exactRoots(second!.rejected)).toEqual(['5/3']);
  });

  it('обе ветви |x − 2| = 3 дают по корню', () => {
    const [first, second] = absoluteBranches([-2, 1], [3]);
    expect(exactRoots(first!.roots)).toEqual(['5/1']);
    expect(exactRoots(second!.roots)).toEqual(['-1/1']);
  });

  it('совпадает по ответу с решением через квадрат', () => {
    for (const preset of MODULUS_PRESETS) {
      if (preset.spec.kind !== 'abs-poly') continue;
      const bySquare = exactRoots(solveEquation(preset.spec).roots).sort();
      const branches = absoluteBranches(preset.spec.inner, preset.spec.right);
      const byCases = exactRoots([...branches[0]!.roots, ...branches[1]!.roots]).sort();
      expect(byCases).toEqual(bySquare);
    }
  });
});

describe('преобразования уравнений', () => {
  it('разделяет равносильные преобразования и следствия', () => {
    expect(transformInfo('add-both').effect).toBe('equivalent');
    expect(transformInfo('cube-both').effect).toBe('equivalent');
    expect(transformInfo('square-both').effect).toBe('adds-roots');
    expect(transformInfo('multiply-variable').effect).toBe('adds-roots');
    expect(transformInfo('divide-variable').effect).toBe('loses-roots');
    expect(TRANSFORMS).toHaveLength(6);
    expect(() => transformInfo('shift' as never)).toThrow('Неизвестное преобразование');
  });
});

describe('запись уравнений', () => {
  it('печатает исходное уравнение, квадрат и следствие', () => {
    const spec: EquationSpec = { kind: 'sqrt-poly', radicand: [3, 1], right: [1, 1] };
    expect(formatEquation(spec)).toBe('√(x + 3) = x + 1');
    expect(formatSquaredEquation(spec)).toBe('x + 3 = (x + 1)²');
    expect(formatConsequence(spec)).toBe('x² + x − 2 = 0');
    expect(formatEquation({ kind: 'abs-abs', left: [2, 1], right: [-1, 2] })).toBe('|x + 2| = |2x − 1|');
    expect(formatAnswer(solveEquation(spec))).toBe('1');
  });
});

describe('примеры лабораторий', () => {
  it('каждый пример решается и находится по идентификатору', () => {
    for (const preset of [...RADICAL_PRESETS, ...MODULUS_PRESETS]) {
      const solution = solveEquation(preset.spec);
      expect(solution.complete).toBe(true);
      expect(getLogicPreset(preset.id)).toBe(preset);
      expect(preset.title.length).toBeGreaterThan(0);
    }
    expect(() => getLogicPreset('нет-такого')).toThrow('Неизвестный пример');
  });

  it('для каждого примера строятся все линии, которые рисует лаборатория', () => {
    for (const preset of RADICAL_PRESETS) {
      const spec = preset.spec;
      if (spec.kind === 'sqrt-poly') {
        expect(squareRootCurve(spec.radicand, preset.extent).length).toBeGreaterThan(0);
        expect(polynomialCurve(spec.right, preset.extent).length).toBeGreaterThan(0);
        expect(polynomialCurve(squarePolynomial(spec.right), preset.extent).length).toBeGreaterThan(0);
        expect(domainIntervals(spec.radicand, preset.extent).length).toBeGreaterThan(0);
      }
      if (spec.kind === 'sqrt-sqrt') {
        expect(squareRootCurve(spec.left, preset.extent).length).toBeGreaterThan(0);
        expect(squareRootCurve(spec.right, preset.extent).length).toBeGreaterThan(0);
        expect(polynomialCurve(spec.left, preset.extent).length).toBeGreaterThan(0);
      }
    }
    for (const preset of MODULUS_PRESETS) {
      const spec = preset.spec;
      const inner = spec.kind === 'abs-poly' ? spec.inner : spec.kind === 'abs-abs' ? spec.left : [0];
      const right = spec.kind === 'abs-poly' || spec.kind === 'abs-abs' ? spec.right : [0];
      expect(absoluteCurve(inner, preset.extent).length).toBeGreaterThan(0);
      expect(spec.kind === 'abs-abs'
        ? absoluteCurve(right, preset.extent).length
        : polynomialCurve(right, preset.extent).length).toBeGreaterThan(0);
    }
  });

  it('все отмечаемые точки помещаются в окно рисунка', () => {
    for (const preset of [...RADICAL_PRESETS, ...MODULUS_PRESETS]) {
      for (const candidate of solveEquation(preset.spec).candidates) {
        expect(Math.abs(candidate.root.approx)).toBeLessThanOrEqual(preset.extent);
        // Точка на картинке уравнения-следствия: высота равна значению подкоренного
        // выражения (или выражения под модулем в квадрате его же знака).
        expect(Math.abs(candidate.innerValue.approx)).toBeLessThanOrEqual(preset.extent);
        if (candidate.leftValue !== null) {
          expect(candidate.leftValue).toBeLessThanOrEqual(preset.extent);
        }
      }
    }
  });

  it('у половины примеров с корнем есть посторонние корни, у половины — нет', () => {
    const withExtraneous = RADICAL_PRESETS.filter((preset) => solveEquation(preset.spec).extraneous.length > 0);
    expect(withExtraneous.length).toBeGreaterThan(0);
    expect(withExtraneous.length).toBeLessThan(RADICAL_PRESETS.length);
  });
});

describe('честная геометрия рисунка', () => {
  it('строит прямую одним отрезком и отсекает по окну', () => {
    const segments = polynomialCurve([1, 1], 6);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.x1).toBeCloseTo(-6, 10);
    expect(segments[0]!.y1).toBeCloseTo(-5, 10);
    // Прямая упирается в верхнюю границу окна раньше правой: y = 6 при x = 5.
    expect(segments[0]!.x2).toBeCloseTo(5, 10);
    expect(segments[0]!.y2).toBeCloseTo(6, 10);
  });

  it('обрывает график корня ровно на границе области определения', () => {
    const segments = squareRootCurve([3, 1], 6);
    expect(segments.length).toBeGreaterThan(0);
    const leftmost = Math.min(...segments.flatMap((segment) => [segment.x1, segment.x2]));
    expect(leftmost).toBeCloseTo(-3, 6);
    for (const segment of segments) {
      expect(segment.x1).toBeGreaterThanOrEqual(-3 - 1e-6);
      expect(Math.abs(segment.y1 - Math.sqrt(segment.x1 + 3))).toBeLessThan(1e-3);
    }
  });

  it('область определения √(x² − 3x) распадается на два промежутка', () => {
    const intervals = domainIntervals([0, -3, 1], 6);
    expect(intervals).toHaveLength(2);
    expect(intervals[0]!.to).toBeCloseTo(0, 6);
    expect(intervals[1]!.from).toBeCloseTo(3, 6);
  });

  it('график модуля всюду неотрицателен и совпадает с |P(x)|', () => {
    const segments = absoluteCurve([-2, 1], 8);
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      expect(segment.y1).toBeGreaterThanOrEqual(-1e-9);
      expect(Math.abs(segment.y1 - Math.abs(segment.x1 - 2))).toBeLessThan(1e-3);
    }
  });

  it('проверяет размеры окна и число узлов', () => {
    expect(() => polynomialCurve([0, 0, 1], 0)).toThrow('положительным');
    expect(() => polynomialCurve([0, 0, 1], 6, 3)).toThrow('от 8 до 2001');
  });
});
