import { describe, expect, it } from 'vitest';
import { evaluateQuadratic, solveQuadratic } from '../src/lib/quadratics';
import {
  axisOfSymmetry,
  branchDirection,
  describeParabola,
  extremumKind,
  flipQuadRelation,
  formatSolutionSet,
  fromVertexForm,
  inequalityText,
  mirrorPoint,
  monotonicity,
  pieceBounds,
  quadraticFunctionText,
  rangeText,
  rationalValue,
  satisfiesQuadraticInequality,
  scaledCoefficients,
  scaledFunctionText,
  scaledRoots,
  scaledSegments,
  scaledValue,
  scaledVertex,
  shapeTitle,
  solveQuadraticInequality,
  standardFormText,
  toVertexForm,
  transformSteps,
  valueTable,
  vertexFormText,
  vertexFormToStandard,
  withPositiveLeading,
  zerosText,
  type QuadRelation,
} from '../src/lib/parabola';

const integer = (value: number) => ({ numerator: value, denominator: 1 });

describe('форма параболы', () => {
  it('определяет направление ветвей по знаку старшего коэффициента', () => {
    expect(branchDirection(1)).toBe('up');
    expect(branchDirection(5)).toBe('up');
    expect(branchDirection(-2)).toBe('down');
    expect(extremumKind(3)).toBe('min');
    expect(extremumKind(-3)).toBe('max');
  });

  it('не считает квадратичной функцию с нулевым старшим коэффициентом', () => {
    expect(() => branchDirection(0)).toThrow('не может быть равен нулю');
    expect(() => branchDirection(1.5)).toThrow('безопасным целым');
  });

  it('находит ось симметрии и вершину точно', () => {
    expect(axisOfSymmetry(1, -4, 3)).toEqual({ numerator: 2, denominator: 1 });
    expect(axisOfSymmetry(2, 3, -1)).toEqual({ numerator: -3, denominator: 4 });
    expect(axisOfSymmetry(-1, 5, 0)).toEqual({ numerator: 5, denominator: 2 });
  });

  it('связывает симметричные точки графика', () => {
    // Ось x = 2, значит 0 и 4 дают одно значение функции.
    expect(mirrorPoint(1, -4, 3, 0)).toBe(4);
    expect(evaluateQuadratic(1, -4, 3, 0)).toBe(evaluateQuadratic(1, -4, 3, 4));
    expect(mirrorPoint(1, -4, 3, 2)).toBe(2);
    expect(mirrorPoint(2, 3, -1, 1)).toBeCloseTo(-2.5, 12);
  });

  it('строит таблицу значений по формуле', () => {
    expect(valueTable(1, -4, 3, [0, 1, 2, 3, 4])).toEqual([
      { x: 0, y: 3 },
      { x: 1, y: 0 },
      { x: 2, y: -1 },
      { x: 3, y: 0 },
      { x: 4, y: 3 },
    ]);
  });

  it('разбивает область определения на промежутки монотонности', () => {
    expect(monotonicity(1, -4, 3)).toEqual({ decreasing: '(−∞; 2]', increasing: '[2; +∞)' });
    expect(monotonicity(-1, 4, -3)).toEqual({ decreasing: '[2; +∞)', increasing: '(−∞; 2]' });
    expect(monotonicity(2, 3, -1)).toEqual({ decreasing: '(−∞; −0,75]', increasing: '[−0,75; +∞)' });
  });

  it('читает область значений по вершине и направлению ветвей', () => {
    expect(rangeText(1, -4, 3)).toBe('y ⩾ −1');
    expect(rangeText(-1, 4, -3)).toBe('y ⩽ 1');
    expect(rangeText(1, 0, 0)).toBe('y ⩾ 0');
    expect(rangeText(1, 2, 5)).toBe('y ⩾ 4');
  });

  it('описывает нули словами для всех трёх случаев дискриминанта', () => {
    expect(zerosText(1, -4, 3)).toBe('два нуля: x = 1 и x = 3');
    expect(zerosText(1, -6, 9)).toBe('один нуль: x = 3 — вершина лежит на оси x');
    expect(zerosText(1, 0, 4)).toBe('нулей нет: график не пересекает ось x');
  });
});

describe('паспорт параболы', () => {
  it('собирает свойства функции y = x² − 4x + 3', () => {
    const facts = describeParabola(1, -4, 3);
    expect(facts.direction).toBe('up');
    expect(facts.vertex).toEqual({ x: { numerator: 2, denominator: 1 }, y: { numerator: -1, denominator: 1 } });
    expect(facts.axisText).toBe('x = 2');
    expect(facts.yIntercept).toBe(3);
    expect(facts.discriminant).toBe(4);
    expect(facts.rootCount).toBe(2);
    expect(facts.extremum).toBe('min');
    expect(facts.rangeText).toBe('y ⩾ −1');
    expect(facts.positiveText).toBe('x < 1 или x > 3');
    expect(facts.negativeText).toBe('1 < x < 3');
  });

  it('собирает свойства параболы с ветвями вниз без нулей', () => {
    const facts = describeParabola(-1, 2, -5);
    expect(facts.direction).toBe('down');
    expect(facts.extremum).toBe('max');
    expect(facts.discriminant).toBe(-16);
    expect(facts.rootCount).toBe(0);
    expect(facts.vertex).toEqual({ x: { numerator: 1, denominator: 1 }, y: { numerator: -4, denominator: 1 } });
    expect(facts.rangeText).toBe('y ⩽ −4');
    expect(facts.positiveText).toBe('решений нет');
    expect(facts.negativeText).toBe('x — любое число');
  });
});

describe('запись функции', () => {
  it('печатает стандартный вид без лишних единиц и нулей', () => {
    expect(standardFormText(1, -4, 3)).toBe('y = x² − 4x + 3');
    expect(standardFormText(-1, 0, 0)).toBe('y = −x²');
    expect(standardFormText(2, 1, -7)).toBe('y = 2x² + x − 7');
    expect(standardFormText(3, -1, 0)).toBe('y = 3x² − x');
    expect(standardFormText(1, 0, -9)).toBe('y = x² − 9');
  });

  it('печатает дробные коэффициенты десятичной запятой', () => {
    expect(quadraticFunctionText(
      { numerator: 1, denominator: 2 },
      { numerator: -2, denominator: 1 },
      { numerator: -1, denominator: 1 },
    )).toBe('y = 0,5x² − 2x − 1');
    expect(() => quadraticFunctionText(integer(0), integer(1), integer(1))).toThrow('не может быть равен нулю');
  });

  it('печатает вершинную форму со знаком внутри скобки', () => {
    expect(vertexFormText(integer(1), integer(2), integer(-1))).toBe('y = (x − 2)² − 1');
    expect(vertexFormText(integer(2), integer(-1), integer(-3))).toBe('y = 2(x + 1)² − 3');
    expect(vertexFormText(integer(-1), integer(0), integer(4))).toBe('y = −x² + 4');
    expect(vertexFormText({ numerator: 1, denominator: 2 }, integer(3), integer(0))).toBe('y = 0,5(x − 3)²');
  });
});

describe('вершинная форма и преобразования', () => {
  it('переводит стандартный вид в вершинный', () => {
    expect(toVertexForm(1, -4, 3)).toEqual({
      leading: 1,
      m: { numerator: 2, denominator: 1 },
      n: { numerator: -1, denominator: 1 },
    });
    expect(toVertexForm(2, 4, 5)).toEqual({
      leading: 2,
      m: { numerator: -1, denominator: 1 },
      n: { numerator: 3, denominator: 1 },
    });
    expect(toVertexForm(-1, 6, -5)).toEqual({
      leading: -1,
      m: { numerator: 3, denominator: 1 },
      n: { numerator: 4, denominator: 1 },
    });
  });

  it('раскрывает вершинную форму обратно и возвращается к тем же значениям', () => {
    expect(fromVertexForm(1, 2, -1)).toEqual({ a: 1, b: -4, c: 3 });
    expect(fromVertexForm(-2, -3, 5)).toEqual({ a: -2, b: -12, c: -13 });
    for (const [a, m, n] of [[1, 2, -1], [3, -2, 4], [-2, 5, -6]] as const) {
      const standard = fromVertexForm(a, m, n);
      for (const x of [-4, -1, 0, 1.5, 3, 7]) {
        expect(evaluateQuadratic(standard.a, standard.b, standard.c, x))
          .toBeCloseTo(a * (x - m) ** 2 + n, 12);
      }
      const back = toVertexForm(standard.a, standard.b, standard.c);
      expect(rationalValue(back.m)).toBe(m);
      expect(rationalValue(back.n)).toBe(n);
    }
  });

  it('перечисляет преобразования эталона y = x² в нужном порядке', () => {
    const steps = transformSteps(integer(2), -1, -3);
    expect(steps.map((step) => step.kind)).toEqual(['start', 'scale', 'shift-x', 'shift-y']);
    expect(steps.map((step) => step.formula)).toEqual([
      'y = x²',
      'y = 2x²',
      'y = 2(x + 1)²',
      'y = 2(x + 1)² − 3',
    ]);
    expect(steps[1]!.action).toContain('Растягиваем');
    expect(steps[2]!.action).toContain('влево');
    expect(steps[3]!.action).toContain('вниз');
  });

  it('добавляет отражение при отрицательном коэффициенте и сжатие при дробном', () => {
    const steps = transformSteps({ numerator: -1, denominator: 2 }, 3, 0);
    expect(steps.map((step) => step.kind)).toEqual(['start', 'scale', 'reflect', 'shift-x']);
    expect(steps[1]!.action).toContain('Сжимаем');
    expect(steps[1]!.action).toContain('в 2 раза');
    expect(steps[2]!.formula).toBe('y = −0,5x²');
    expect(steps[3]!.formula).toBe('y = −0,5(x − 3)²');
  });

  it('оставляет только начальный шаг, когда преобразовывать нечего', () => {
    expect(transformSteps(integer(1), 0, 0)).toEqual([
      { kind: 'start', action: 'Берём эталонную параболу', formula: 'y = x²' },
    ]);
    expect(() => transformSteps(integer(0), 1, 1)).toThrow('не может быть равен нулю');
  });
});

describe('дробный старший коэффициент', () => {
  const half = { numerator: 1, denominator: 2 };

  it('превращает y = 0,5(x − 2)² − 3 в целочисленную запись с масштабом', () => {
    const scaled = vertexFormToStandard(half, 2, -3);
    expect(scaled).toEqual({ a: 1, b: -4, c: -2, scale: 2 });
    expect(scaledCoefficients(scaled)).toEqual({
      a: { numerator: 1, denominator: 2 },
      b: { numerator: -2, denominator: 1 },
      c: { numerator: -1, denominator: 1 },
    });
    expect(scaledFunctionText(scaled)).toBe('y = 0,5x² − 2x − 1');
  });

  it('считает значения, вершину и нули дробной функции точно', () => {
    const scaled = vertexFormToStandard(half, 2, -3);
    for (const x of [-2, 0, 2, 3.5, 6]) {
      expect(scaledValue(scaled, x)).toBeCloseTo(0.5 * (x - 2) ** 2 - 3, 12);
    }
    expect(scaledVertex(scaled)).toEqual({
      x: { numerator: 2, denominator: 1 },
      y: { numerator: -3, denominator: 1 },
    });
    const roots = scaledRoots(scaled);
    expect(roots).toHaveLength(2);
    expect(roots[0]!.approx).toBeCloseTo(2 - Math.sqrt(6), 12);
    expect(roots[1]!.approx).toBeCloseTo(2 + Math.sqrt(6), 12);
  });

  it('сохраняет вершину дробной параболы с ветвями вниз', () => {
    const scaled = vertexFormToStandard({ numerator: -1, denominator: 3 }, -3, 4);
    expect(scaled).toEqual({ a: -1, b: -6, c: 3, scale: 3 });
    expect(scaledVertex(scaled)).toEqual({
      x: { numerator: -3, denominator: 1 },
      y: { numerator: 4, denominator: 1 },
    });
    expect(scaledValue(scaled, 0)).toBeCloseTo(1, 12);
  });

  it('рисует дробную кривую теми же точками, что даёт прямая подстановка', () => {
    const scaled = vertexFormToStandard(half, 1, -2);
    const box = { xMin: -6, xMax: 6, yMin: -5, yMax: 5 };
    const segments = scaledSegments(scaled, box, 121);
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      segment.forEach((point, index) => {
        expect(point.y).toBeGreaterThanOrEqual(box.yMin - 1e-9);
        expect(point.y).toBeLessThanOrEqual(box.yMax + 1e-9);
        // Крайние точки куска — это точки пересечения с границей окна, найденные
        // линейной интерполяцией; узлы сетки внутри куска лежат ровно на кривой.
        if (index > 0 && index < segment.length - 1) {
          expect(point.y).toBeCloseTo(scaledValue(scaled, point.x), 9);
        }
      });
    }
  });

  it('отвергает нулевой старший коэффициент и нецелые сдвиги', () => {
    expect(() => vertexFormToStandard({ numerator: 0, denominator: 1 }, 1, 1)).toThrow('не может быть равен нулю');
    expect(() => vertexFormToStandard(half, 1.5, 0)).toThrow('безопасным целым');
  });
});

describe('квадратные неравенства', () => {
  it('меняет знак при умножении обеих частей на минус единицу', () => {
    expect(flipQuadRelation('lt')).toBe('gt');
    expect(flipQuadRelation('ge')).toBe('le');
    expect(inequalityText(1, -5, 6, 'gt')).toBe('x² − 5x + 6 > 0');
    expect(inequalityText(-1, 4, -3, 'ge')).toBe('−x² + 4x − 3 ⩾ 0');
  });

  it('приводит неравенство к положительному старшему коэффициенту', () => {
    expect(withPositiveLeading(-1, 4, -3, 'ge')).toEqual({ a: 1, b: -4, c: 3, relation: 'le' });
    expect(withPositiveLeading(2, -3, 1, 'lt')).toEqual({ a: 2, b: -3, c: 1, relation: 'lt' });
  });

  it('при D > 0 даёт два луча для «больше» и отрезок для «меньше»', () => {
    const outside = solveQuadraticInequality(1, -5, 6, 'gt');
    expect(outside.shape).toBe('outside');
    expect(outside.setText).toBe('(−∞; 2) ∪ (3; +∞)');
    expect(outside.conditionText).toBe('x < 2 или x > 3');

    const between = solveQuadraticInequality(1, -5, 6, 'le');
    expect(between.shape).toBe('between');
    expect(between.setText).toBe('[2; 3]');
    expect(between.conditionText).toBe('2 ⩽ x ⩽ 3');

    const strictBetween = solveQuadraticInequality(1, -5, 6, 'lt');
    expect(strictBetween.setText).toBe('(2; 3)');
    expect(strictBetween.conditionText).toBe('2 < x < 3');

    const closedOutside = solveQuadraticInequality(1, -5, 6, 'ge');
    expect(closedOutside.setText).toBe('(−∞; 2] ∪ [3; +∞)');
    expect(closedOutside.conditionText).toBe('x ⩽ 2 или x ⩾ 3');
  });

  it('обрабатывает случай D = 0 всеми четырьмя знаками', () => {
    expect(solveQuadraticInequality(1, -6, 9, 'gt')).toMatchObject({
      shape: 'all-except-point',
      setText: '(−∞; 3) ∪ (3; +∞)',
      conditionText: 'x — любое число, кроме x = 3',
    });
    expect(solveQuadraticInequality(1, -6, 9, 'ge')).toMatchObject({
      shape: 'all',
      setText: '(−∞; +∞)',
      conditionText: 'x — любое число',
    });
    expect(solveQuadraticInequality(1, -6, 9, 'lt')).toMatchObject({
      shape: 'empty',
      setText: '∅',
      conditionText: 'решений нет',
    });
    expect(solveQuadraticInequality(1, -6, 9, 'le')).toMatchObject({
      shape: 'point',
      setText: '[3; 3]',
      conditionText: 'x = 3',
    });
  });

  it('обрабатывает случай D < 0: знак трёхчлена постоянен', () => {
    expect(solveQuadraticInequality(1, 1, 1, 'gt').shape).toBe('all');
    expect(solveQuadraticInequality(1, 1, 1, 'ge').shape).toBe('all');
    expect(solveQuadraticInequality(1, 1, 1, 'lt').shape).toBe('empty');
    expect(solveQuadraticInequality(1, 1, 1, 'le').shape).toBe('empty');
    expect(solveQuadraticInequality(-1, 2, -5, 'lt').shape).toBe('all');
    expect(solveQuadraticInequality(-1, 2, -5, 'gt').shape).toBe('empty');
  });

  it('переворачивает ответ при отрицательном старшем коэффициенте', () => {
    const solution = solveQuadraticInequality(-1, 4, -3, 'ge');
    expect(solution.shape).toBe('between');
    expect(solution.setText).toBe('[1; 3]');
    expect(solution.conditionText).toBe('1 ⩽ x ⩽ 3');

    const opposite = solveQuadraticInequality(-1, 4, -3, 'lt');
    expect(opposite.shape).toBe('outside');
    expect(opposite.conditionText).toBe('x < 1 или x > 3');
  });

  it('честно помечает иррациональные границы знаком приближения', () => {
    const solution = solveQuadraticInequality(1, 0, -2, 'gt');
    expect(solution.rootCount).toBe(2);
    expect(solution.setText).toBe('(−∞; ≈ −1,41) ∪ (≈ 1,41; +∞)');
    expect(formatSolutionSet(solution)).toBe(solution.setText);
  });

  it('согласуется с прямой подстановкой чисел', () => {
    const cases: readonly (readonly [number, number, number, QuadRelation])[] = [
      [1, -5, 6, 'gt'],
      [1, -5, 6, 'le'],
      [-1, 4, -3, 'ge'],
      [1, -6, 9, 'gt'],
      [1, 1, 1, 'lt'],
      [2, -3, -2, 'lt'],
    ];
    for (const [a, b, c, relation] of cases) {
      const solution = solveQuadraticInequality(a, b, c, relation);
      for (let x = -6; x <= 6; x += 0.25) {
        const inside = solution.pieces.some((item) => {
          const { from, to } = pieceBounds(item);
          const leftOk = x > from || (x === from && item.leftClosed);
          const rightOk = x < to || (x === to && item.rightClosed);
          return leftOk && rightOk;
        });
        expect(inside).toBe(satisfiesQuadraticInequality(a, b, c, relation, x));
      }
    }
  });

  it('строит границы ответа из корней уравнения', () => {
    const solution = solveQuadraticInequality(2, -3, -2, 'gt');
    const roots = solveQuadratic(2, -3, -2).roots.map((root) => root.approx);
    expect(roots).toEqual([-0.5, 2]);
    expect(solution.setText).toBe('(−∞; −0,5) ∪ (2; +∞)');
    expect(pieceBounds(solution.pieces[0]!)).toEqual({ from: Number.NEGATIVE_INFINITY, to: -0.5 });
    expect(pieceBounds(solution.pieces[1]!)).toEqual({ from: 2, to: Number.POSITIVE_INFINITY });
  });

  it('называет форму ответа по-русски', () => {
    expect(shapeTitle('between')).toBe('промежуток между корнями');
    expect(shapeTitle('outside')).toBe('два луча вне корней');
    expect(shapeTitle('empty')).toBe('решений нет');
    expect(shapeTitle('all')).toBe('вся числовая прямая');
  });

  it('отвергает неизвестный знак неравенства', () => {
    expect(() => solveQuadraticInequality(1, 0, -1, 'ne' as QuadRelation)).toThrow('Неизвестный знак');
  });
});
