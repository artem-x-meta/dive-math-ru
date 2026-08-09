import { describe, expect, it } from 'vitest';
import { parseExact } from '../src/lib/exactRational';
import {
  LinearError,
  clipLineToBox,
  clipVerticalToBox,
  describeSolution,
  describeSystemSolution,
  eliminationPlan,
  equivalentEquations,
  evaluateLinear,
  exactGcd,
  formatEquationLatex,
  formatEquationText,
  formatExactLatex,
  formatFunctionLatex,
  formatLinearLatex,
  formatLinearText,
  formatTwoVariableLatex,
  formatTwoVariableText,
  intersectLines,
  isVerticalLine,
  linearEquation,
  linearExpression,
  linearTable,
  lineThroughPoints,
  normalizedEquation,
  satisfiesEquation,
  satisfiesTwoVariable,
  slopeBehaviour,
  solveLinearEquation,
  solveLinearEquationSteps,
  solveSystem,
  substitutionPlan,
  toSlopeIntercept,
  twoVariableEquation,
  xIntercept,
} from '../src/lib/linear';

const exact = (value: number | string) => parseExact(value);

describe('линейное уравнение с одной переменной', () => {
  it('находит единственный корень', () => {
    const solution = solveLinearEquation(linearEquation(linearExpression(5, -3), linearExpression(0, 12)));
    expect(solution).toEqual({ kind: 'unique', value: exact(3) });
  });

  it('переносит переменную из правой части', () => {
    const solution = solveLinearEquation(linearEquation(linearExpression(3, 1), linearExpression(1, -5)));
    expect(solution).toEqual({ kind: 'unique', value: exact(-3) });
  });

  it('работает с дробными коэффициентами точно', () => {
    const solution = solveLinearEquation(linearEquation(linearExpression('0.5', 1), linearExpression(0, 3)));
    expect(solution).toEqual({ kind: 'unique', value: exact(4) });

    const third = solveLinearEquation(linearEquation(linearExpression(3, 0), linearExpression(0, 1)));
    expect(third).toEqual({ kind: 'unique', value: { numerator: 1n, denominator: 3n } });
  });

  it('различает отсутствие корней и тождество', () => {
    expect(solveLinearEquation(linearEquation(linearExpression(2, 1), linearExpression(2, 5)))).toEqual({ kind: 'none' });
    expect(solveLinearEquation(linearEquation(linearExpression(2, 7), linearExpression(2, 7)))).toEqual({ kind: 'identity' });
  });

  it('приводит уравнение к виду ax = b', () => {
    expect(normalizedEquation(linearEquation(linearExpression(3, 4), linearExpression(1, -2)))).toEqual({
      slope: exact(2),
      intercept: exact(-6),
    });
  });

  it('проверяет корень подстановкой', () => {
    const equation = linearEquation(linearExpression(3, 4), linearExpression(1, -2));
    expect(satisfiesEquation(equation, -3)).toBe(true);
    expect(satisfiesEquation(equation, -2)).toBe(false);
    expect(evaluateLinear(linearExpression(3, 4), -3)).toEqual(exact(-5));
  });

  it('описывает ответ словами', () => {
    expect(describeSolution({ kind: 'unique', value: exact('-2.5') })).toBe('x = −2,5');
    expect(describeSolution({ kind: 'none' })).toBe('корней нет');
    expect(describeSolution({ kind: 'identity' })).toBe('корень — любое число');
  });
});

describe('равносильные преобразования', () => {
  const equation = linearEquation(linearExpression(3, 4), linearExpression(1, -2));

  it('строит цепочку шагов до ответа', () => {
    const steps = solveLinearEquationSteps(equation);
    expect(steps.map((step) => step.kind)).toEqual([
      'start',
      'collect-variable',
      'collect-constant',
      'divide',
      'conclusion',
    ]);
    expect(steps[0]!.latex).toBe('3x + 4 = x - 2');
    expect(steps[1]!.latex).toBe('2x + 4 = -2');
    expect(steps[2]!.latex).toBe('2x = -6');
    expect(steps[4]!.latex).toBe('x = -3');
  });

  it('сохраняет множество корней на каждом шаге', () => {
    for (const step of solveLinearEquationSteps(equation)) {
      if (step.equation) expect(equivalentEquations(equation, step.equation)).toBe(true);
    }
  });

  it('пропускает лишние шаги, если переносить нечего', () => {
    const steps = solveLinearEquationSteps(linearEquation(linearExpression(4, 0), linearExpression(0, 10)));
    expect(steps.map((step) => step.kind)).toEqual(['start', 'divide', 'conclusion']);
    expect(steps[2]!.latex).toBe('x = \\frac{5}{2}');
  });

  it('честно сообщает о вырожденных случаях', () => {
    const none = solveLinearEquationSteps(linearEquation(linearExpression(2, 1), linearExpression(2, 5)));
    expect(none.at(-1)!.kind).toBe('conclusion');
    expect(none.at(-1)!.latex).toBe('0 \\cdot x = 4');

    const identity = solveLinearEquationSteps(linearEquation(linearExpression(2, 7), linearExpression(2, 7)));
    expect(identity.at(-1)!.latex).toBe('0 \\cdot x = 0');
  });

  it('отличает равносильные уравнения от неравносильных', () => {
    expect(equivalentEquations(
      linearEquation(linearExpression(2, 0), linearExpression(0, 6)),
      linearEquation(linearExpression(1, 0), linearExpression(0, 3)),
    )).toBe(true);
    expect(equivalentEquations(
      linearEquation(linearExpression(2, 0), linearExpression(0, 6)),
      linearEquation(linearExpression(2, 0), linearExpression(0, 8)),
    )).toBe(false);
    expect(equivalentEquations(
      linearEquation(linearExpression(2, 1), linearExpression(2, 5)),
      linearEquation(linearExpression(1, 1), linearExpression(1, 9)),
    )).toBe(true);
  });
});

describe('запись формул', () => {
  it('записывает точные числа в KaTeX', () => {
    expect(formatExactLatex(4)).toBe('4');
    expect(formatExactLatex(-4)).toBe('-4');
    expect(formatExactLatex('0.5')).toBe('\\frac{1}{2}');
    expect(formatExactLatex('-1.5')).toBe('-\\frac{3}{2}');
  });

  it('не печатает единичные коэффициенты и нулевые слагаемые', () => {
    expect(formatLinearLatex(linearExpression(1, 0))).toBe('x');
    expect(formatLinearLatex(linearExpression(-1, 0))).toBe('-x');
    expect(formatLinearLatex(linearExpression(0, 5))).toBe('5');
    expect(formatLinearLatex(linearExpression(2, -3))).toBe('2x - 3');
    expect(formatLinearLatex(linearExpression('0.5', 4))).toBe('\\frac{1}{2}x + 4');
    expect(formatFunctionLatex(linearExpression(-2, 1))).toBe('y = -2x + 1');
    expect(formatEquationLatex(linearEquation(linearExpression(0, 7), linearExpression(1, 0)), 't')).toBe('7 = t');
  });

  it('даёт текстовую запись для интерфейса лабораторий', () => {
    expect(formatLinearText(linearExpression(1, 0))).toBe('x');
    expect(formatLinearText(linearExpression(-1, 0))).toBe('−x');
    expect(formatLinearText(linearExpression('2.5', -3))).toBe('2,5x − 3');
    expect(formatLinearText(linearExpression(0, '-0.5'))).toBe('−0,5');
    expect(formatEquationText(linearEquation(linearExpression(3, 4), linearExpression(1, -2)))).toBe('3x + 4 = x − 2');
    expect(formatTwoVariableText(twoVariableEquation(2, -3, 12))).toBe('2x − 3y = 12');
    expect(formatTwoVariableText(twoVariableEquation(0, 1, -4))).toBe('y = −4');
    expect(describeSystemSolution({ kind: 'unique', x: exact(3), y: exact(-2) })).toBe('(3; −2)');
    expect(describeSystemSolution({ kind: 'none' })).toBe('решений нет');
    expect(describeSystemSolution({ kind: 'infinite' })).toBe('бесконечно много решений');
  });

  it('записывает уравнение с двумя переменными', () => {
    expect(formatTwoVariableLatex(twoVariableEquation(2, 3, 12))).toBe('2x + 3y = 12');
    expect(formatTwoVariableLatex(twoVariableEquation(1, -1, 1))).toBe('x - y = 1');
    expect(formatTwoVariableLatex(twoVariableEquation(0, 2, 6))).toBe('2y = 6');
    expect(formatTwoVariableLatex(twoVariableEquation(1, 0, 4))).toBe('x = 4');
    expect(formatTwoVariableLatex(twoVariableEquation(0, -1, 3))).toBe('-y = 3');
  });
});

describe('линейная функция и её график', () => {
  it('определяет направление и нули', () => {
    expect(slopeBehaviour(linearExpression(2, 1))).toBe('increasing');
    expect(slopeBehaviour(linearExpression(-3, 1))).toBe('decreasing');
    expect(slopeBehaviour(linearExpression(0, 1))).toBe('constant');
    expect(xIntercept(linearExpression(2, -6))).toEqual(exact(3));
    expect(xIntercept(linearExpression(0, 4))).toBeNull();
  });

  it('строит таблицу значений', () => {
    expect(linearTable(linearExpression(2, -1), [-1, 0, 3])).toEqual([
      { x: exact(-1), y: exact(-3) },
      { x: exact(0), y: exact(-1) },
      { x: exact(3), y: exact(5) },
    ]);
  });

  it('восстанавливает прямую по двум точкам', () => {
    expect(lineThroughPoints(0, 1, 2, 5)).toEqual({ slope: exact(2), intercept: exact(1) });
    expect(lineThroughPoints(1, 4, 3, 4)).toEqual({ slope: exact(0), intercept: exact(4) });
    expect(lineThroughPoints(2, 1, 2, 7)).toBeNull();
    expect(() => lineThroughPoints(2, 1, 2, 1)).toThrow(LinearError);
  });

  it('находит точку пересечения двух прямых', () => {
    expect(intersectLines(linearExpression(2, -1), linearExpression(-1, 5))).toEqual({
      kind: 'point',
      x: exact(2),
      y: exact(3),
    });
    expect(intersectLines(linearExpression(2, -1), linearExpression(2, 5))).toEqual({ kind: 'parallel' });
    expect(intersectLines(linearExpression(2, -1), linearExpression(2, -1))).toEqual({ kind: 'same' });
  });

  it('находит пересечение с дробными координатами точно', () => {
    expect(intersectLines(linearExpression(1, 0), linearExpression(-1, 1))).toEqual({
      kind: 'point',
      x: { numerator: 1n, denominator: 2n },
      y: { numerator: 1n, denominator: 2n },
    });
  });
});

describe('системы двух линейных уравнений', () => {
  const first = twoVariableEquation(2, 3, 12);
  const second = twoVariableEquation(1, -1, 1);

  it('решает систему с единственным решением', () => {
    expect(solveSystem(first, second)).toEqual({ kind: 'unique', x: exact(3), y: exact(2) });
    expect(satisfiesTwoVariable(first, 3, 2)).toBe(true);
    expect(satisfiesTwoVariable(second, 3, 2)).toBe(true);
    expect(satisfiesTwoVariable(second, 2, 3)).toBe(false);
  });

  it('различает параллельные и совпавшие прямые', () => {
    expect(solveSystem(twoVariableEquation(1, 1, 2), twoVariableEquation(2, 2, 7))).toEqual({ kind: 'none' });
    expect(solveSystem(twoVariableEquation(1, 1, 2), twoVariableEquation(2, 2, 4))).toEqual({ kind: 'infinite' });
    expect(solveSystem(twoVariableEquation(0, 0, 5), twoVariableEquation(1, 1, 2))).toEqual({ kind: 'none' });
  });

  it('переводит уравнение в вид y = kx + b', () => {
    expect(toSlopeIntercept(first)).toEqual({ slope: { numerator: -2n, denominator: 3n }, intercept: exact(4) });
    expect(toSlopeIntercept(twoVariableEquation(1, 0, 4))).toBeNull();
    expect(isVerticalLine(twoVariableEquation(1, 0, 4))).toBe(true);
    expect(isVerticalLine(first)).toBe(false);
  });

  it('согласует графический ответ с алгебраическим', () => {
    const lineOne = toSlopeIntercept(first)!;
    const lineTwo = toSlopeIntercept(second)!;
    expect(intersectLines(lineOne, lineTwo)).toEqual({ kind: 'point', x: exact(3), y: exact(2) });
  });

  it('строит подстановку из переменной с коэффициентом ±1', () => {
    const plan = substitutionPlan(first, second);
    expect(plan.source).toBe(2);
    expect(plan.expressed).toBe('y');
    expect(plan.expression).toEqual({ slope: exact(1), intercept: exact(-1) });
    expect(formatEquationLatex(plan.reduced)).toBe('5x - 3 = 12');
    expect(plan.reducedVariable).toBe('x');
    expect(solveLinearEquation(plan.reduced)).toEqual({ kind: 'unique', value: exact(3) });
    expect(plan.solution).toEqual({ kind: 'unique', x: exact(3), y: exact(2) });
  });

  it('выражает переменную и при отсутствии коэффициента ±1', () => {
    const plan = substitutionPlan(twoVariableEquation(2, 4, 10), twoVariableEquation(3, 5, 14));
    expect(plan.expressed).toBe('y');
    expect(plan.expression).toEqual({ slope: { numerator: -1n, denominator: 2n }, intercept: { numerator: 5n, denominator: 2n } });
    expect(solveLinearEquation(plan.reduced)).toEqual({ kind: 'unique', value: exact(3) });
    expect(() => substitutionPlan(twoVariableEquation(0, 0, 1), twoVariableEquation(0, 0, 2))).toThrow(LinearError);
  });

  it('подбирает наименьшие множители для способа сложения', () => {
    const byX = eliminationPlan(first, second, 'x');
    expect(byX.firstFactor).toEqual(exact(1));
    expect(byX.secondFactor).toEqual(exact(-2));
    expect(byX.combined).toEqual({ a: exact(0), b: exact(5), c: exact(10) });

    const byY = eliminationPlan(first, second, 'y');
    expect(byY.firstFactor).toEqual(exact(1));
    expect(byY.secondFactor).toEqual(exact(3));
    expect(byY.combined).toEqual({ a: exact(5), b: exact(0), c: exact(15) });
  });

  it('сокращает множители до наименьших', () => {
    const plan = eliminationPlan(twoVariableEquation(4, 1, 9), twoVariableEquation(2, -3, 1), 'x');
    expect(plan.firstFactor).toEqual(exact(1));
    expect(plan.secondFactor).toEqual(exact(-2));
    expect(plan.combined).toEqual({ a: exact(0), b: exact(7), c: exact(7) });

    const opposite = eliminationPlan(twoVariableEquation(3, 2, 8), twoVariableEquation(-3, 5, 13), 'x');
    expect(opposite.firstFactor).toEqual(exact(1));
    expect(opposite.secondFactor).toEqual(exact(1));
    expect(opposite.combined).toEqual({ a: exact(0), b: exact(7), c: exact(21) });
  });

  it('обрабатывает уравнение без выбранной переменной', () => {
    const plan = eliminationPlan(twoVariableEquation(0, 2, 6), twoVariableEquation(1, 1, 5), 'x');
    expect(plan.firstFactor).toEqual(exact(1));
    expect(plan.secondFactor).toEqual(exact(0));
    expect(plan.combined).toEqual({ a: exact(0), b: exact(2), c: exact(6) });
  });

  it('считает рациональный НОД', () => {
    expect(exactGcd(6, 4)).toEqual(exact(2));
    expect(exactGcd(0, -5)).toEqual(exact(5));
    expect(exactGcd('0.5', '1/3')).toEqual({ numerator: 1n, denominator: 6n });
    expect(exactGcd(0, 0)).toEqual(exact(0));
  });
});

describe('геометрия рисунка', () => {
  it('отсекает прямую по видимому квадрату', () => {
    expect(clipLineToBox(1, 0, 5)).toEqual({ x1: -5, y1: -5, x2: 5, y2: 5 });
    expect(clipLineToBox(2, 3, 5)).toEqual({ x1: -4, y1: -5, x2: 1, y2: 5 });
    expect(clipLineToBox(-1, 2, 4)).toEqual({ x1: -2, y1: 4, x2: 4, y2: -2 });
    expect(clipLineToBox(0, 3, 5)).toEqual({ x1: -5, y1: 3, x2: 5, y2: 3 });
  });

  it('возвращает null, если прямой не видно', () => {
    expect(clipLineToBox(0, 9, 5)).toBeNull();
    expect(clipLineToBox(0.5, 8, 5)).toBeNull();
    expect(clipLineToBox(Number.NaN, 0, 5)).toBeNull();
    expect(clipLineToBox(1, 0, 0)).toBeNull();
  });

  it('отсекает вертикальную прямую', () => {
    expect(clipVerticalToBox(2, 5)).toEqual({ x1: 2, y1: -5, x2: 2, y2: 5 });
    expect(clipVerticalToBox(7, 5)).toBeNull();
  });
});
