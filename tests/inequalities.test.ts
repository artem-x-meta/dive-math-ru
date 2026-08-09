import { describe, expect, it } from 'vitest';
import { formatExactRussian } from '../src/lib/exactRational';
import { linearExpression } from '../src/lib/linear';
import {
  ALL_REALS,
  bound,
  closedInterval,
  containsNumber,
  curveBranches,
  curveFacts,
  curveLatex,
  curveText,
  curveTable,
  curveValue,
  describeSet,
  estimateDifference,
  estimateProduct,
  estimateQuotient,
  estimateReciprocal,
  estimateScaled,
  estimateSum,
  flipRelation,
  formatConditionText,
  formatInequalityText,
  formatIntervalLatex,
  formatIntervalText,
  formatSetText,
  greaterThanSet,
  halfOpenInterval,
  holdsRelation,
  intersectAll,
  intersectIntervals,
  interval,
  intervalLength,
  intervalName,
  isPoint,
  lessThanSet,
  linearInequality,
  negateInterval,
  openInterval,
  satisfiesInequality,
  setOf,
  simpleInequality,
  solveInequalitySteps,
  solveInequalitySystem,
  solveLinearInequality,
  type Interval,
  type NumberSet,
} from '../src/lib/inequalities';

function textOf(set: NumberSet): string {
  return formatSetText(set);
}

function intervalOf(set: NumberSet): Interval {
  if (set.kind === 'empty') throw new Error('Ожидался непустой промежуток');
  return set.interval;
}

describe('знаки неравенств', () => {
  it('меняет знак на противоположный ровно один раз', () => {
    expect(flipRelation('lt')).toBe('gt');
    expect(flipRelation('gt')).toBe('lt');
    expect(flipRelation('le')).toBe('ge');
    expect(flipRelation('ge')).toBe('le');
    expect(flipRelation(flipRelation('le'))).toBe('le');
  });

  it('проверяет числовые неравенства точно', () => {
    expect(holdsRelation('lt', 2, 3)).toBe(true);
    expect(holdsRelation('le', 3, 3)).toBe(true);
    expect(holdsRelation('lt', 3, 3)).toBe(false);
    expect(holdsRelation('ge', '0,3', '0,1')).toBe(true);
    // 0,1 + 0,2 сравнивается точно, без ошибки двоичной дроби.
    expect(holdsRelation('le', '0,3', '0,30')).toBe(true);
  });
});

describe('числовые промежутки', () => {
  it('запрещает пустую запись промежутка', () => {
    expect(() => interval(bound(5), bound(2))).toThrow('больше правой');
    expect(() => interval(bound(3, false), bound(3, true))).toThrow('пуст');
    expect(isPoint(closedInterval(3, 3))).toBe(true);
  });

  it('проверяет принадлежность числа с учётом включённости границ', () => {
    expect(containsNumber(closedInterval(-2, 5), -2)).toBe(true);
    expect(containsNumber(openInterval(-2, 5), -2)).toBe(false);
    expect(containsNumber(openInterval(-2, 5), 4.999)).toBe(true);
    expect(containsNumber(lessThanSet(3, true), 3)).toBe(true);
    expect(containsNumber(lessThanSet(3, false), 3)).toBe(false);
    expect(containsNumber(lessThanSet(3), -1000)).toBe(true);
    expect(containsNumber(greaterThanSet(0, false), 0)).toBe(false);
    expect(containsNumber(ALL_REALS, -17.5)).toBe(true);
  });

  it('записывает промежуток скобками и неравенством', () => {
    expect(formatIntervalText(closedInterval(-2, 5))).toBe('[−2; 5]');
    expect(formatIntervalText(openInterval(-2, 5))).toBe('(−2; 5)');
    expect(formatIntervalText(halfOpenInterval(-2, 5, true))).toBe('[−2; 5)');
    expect(formatIntervalText(lessThanSet(3, true))).toBe('(−∞; 3]');
    expect(formatIntervalText(greaterThanSet(3, false))).toBe('(3; +∞)');
    expect(formatIntervalText(ALL_REALS)).toBe('(−∞; +∞)');

    expect(formatConditionText(halfOpenInterval(-2, 5, true))).toBe('−2 ⩽ x < 5');
    expect(formatConditionText(lessThanSet(3, true))).toBe('x ⩽ 3');
    expect(formatConditionText(greaterThanSet(3, false), 'a')).toBe('a > 3');
    expect(formatConditionText(ALL_REALS)).toBe('x — любое число');
    expect(formatConditionText(closedInterval(7, 7))).toBe('x = 7');

    expect(formatIntervalLatex(lessThanSet(3, true))).toBe('(-\\infty;\\ 3]');
    expect(formatIntervalLatex(ALL_REALS)).toBe('(-\\infty;\\ +\\infty)');
  });

  it('называет промежутки по-школьному', () => {
    expect(intervalName(closedInterval(1, 3))).toBe('отрезок');
    expect(intervalName(openInterval(1, 3))).toBe('интервал');
    expect(intervalName(halfOpenInterval(1, 3, false))).toBe('полуинтервал');
    expect(intervalName(greaterThanSet(2, true))).toBe('числовой луч');
    expect(intervalName(lessThanSet(2, false))).toBe('открытый числовой луч');
    expect(intervalName(ALL_REALS)).toBe('вся числовая прямая');
    expect(intervalName(closedInterval(4, 4))).toBe('одно число');
  });

  it('считает длину только у ограниченного промежутка', () => {
    expect(formatExactRussian(intervalLength(closedInterval(-2, 5))!)).toBe('7');
    expect(intervalLength(greaterThanSet(1))).toBeNull();
    expect(intervalLength(ALL_REALS)).toBeNull();
  });
});

describe('пересечение промежутков', () => {
  it('находит общую часть двух промежутков', () => {
    expect(textOf(intersectIntervals(closedInterval(-2, 5), closedInterval(0, 9)))).toBe('[0; 5]');
    expect(textOf(intersectIntervals(greaterThanSet(1, false), lessThanSet(5, true)))).toBe('(1; 5]');
    expect(textOf(intersectIntervals(closedInterval(-2, 5), ALL_REALS))).toBe('[−2; 5]');
    expect(textOf(intersectIntervals(closedInterval(0, 1), closedInterval(-9, 9)))).toBe('[0; 1]');
  });

  it('берёт более строгую границу при совпадении чисел', () => {
    expect(textOf(intersectIntervals(greaterThanSet(2, true), greaterThanSet(2, false)))).toBe('(2; +∞)');
    expect(textOf(intersectIntervals(lessThanSet(2, true), lessThanSet(2, true)))).toBe('(−∞; 2]');
  });

  it('различает касание границ и пустое пересечение', () => {
    expect(textOf(intersectIntervals(greaterThanSet(2, true), lessThanSet(2, true)))).toBe('[2; 2]');
    expect(textOf(intersectIntervals(greaterThanSet(2, false), lessThanSet(2, true)))).toBe('∅');
    expect(textOf(intersectIntervals(greaterThanSet(2, true), lessThanSet(2, false)))).toBe('∅');
    expect(textOf(intersectIntervals(closedInterval(3, 8), closedInterval(-4, 1)))).toBe('∅');
  });

  it('пересекает список промежутков и считает пустой список всей прямой', () => {
    expect(textOf(intersectAll([]))).toBe('(−∞; +∞)');
    expect(textOf(intersectAll([greaterThanSet(-1, true), lessThanSet(4, false), lessThanSet(2, true)]))).toBe('[−1; 2]');
    expect(textOf(intersectAll([greaterThanSet(5, true), lessThanSet(4, true)]))).toBe('∅');
  });
});

describe('линейные неравенства', () => {
  it('решает неравенство с положительным коэффициентом', () => {
    const item = linearInequality(linearExpression(3, -5), 'lt', linearExpression(0, 7));
    expect(formatInequalityText(item)).toBe('3x − 5 < 7');
    expect(textOf(solveLinearInequality(item))).toBe('(−∞; 4)');
    expect(satisfiesInequality(item, 3)).toBe(true);
    expect(satisfiesInequality(item, 4)).toBe(false);
  });

  it('меняет знак при делении на отрицательное число', () => {
    const item = linearInequality(linearExpression(-2, 1), 'ge', linearExpression(0, 7));
    expect(textOf(solveLinearInequality(item))).toBe('(−∞; −3]');
    expect(satisfiesInequality(item, -3)).toBe(true);
    expect(satisfiesInequality(item, -2)).toBe(false);
  });

  it('собирает переменную с обеих сторон', () => {
    // 5x + 4 > 2x − 8  ⇔  3x > −12  ⇔  x > −4
    const item = linearInequality(linearExpression(5, 4), 'gt', linearExpression(2, -8));
    expect(textOf(solveLinearInequality(item))).toBe('(−4; +∞)');
    expect(satisfiesInequality(item, -4)).toBe(false);
    expect(satisfiesInequality(item, -3)).toBe(true);
  });

  it('даёт точный дробный ответ без округления', () => {
    const item = simpleInequality(4, 'ge', 3);
    const answer = intervalOf(solveLinearInequality(item));
    expect(formatIntervalText(answer)).toBe('[0,75; +∞)');
    expect(containsNumber(answer, '3/4')).toBe(true);
    expect(containsNumber(answer, '0,7499')).toBe(false);
  });

  it('обрабатывает исчезновение переменной', () => {
    const always = linearInequality(linearExpression(5, 2), 'gt', linearExpression(5, -1));
    const never = linearInequality(linearExpression(2, 3), 'le', linearExpression(2, 1));
    expect(textOf(solveLinearInequality(always))).toBe('(−∞; +∞)');
    expect(textOf(solveLinearInequality(never))).toBe('∅');
    expect(describeSet(solveLinearInequality(never))).toBe('решений нет');
  });

  it('строит цепочку равносильных шагов и предупреждает о смене знака', () => {
    const item = linearInequality(linearExpression(-2, 1), 'ge', linearExpression(0, 7));
    const steps = solveInequalitySteps(item);
    expect(steps[0]!.kind).toBe('start');
    expect(steps.at(-1)!.kind).toBe('conclusion');
    expect(steps.at(-1)!.text).toBe('(−∞; −3]');
    const divide = steps.find((step) => step.kind === 'divide')!;
    expect(divide.rule).toContain('меняется на противоположный');
    expect(divide.text).toBe('x ⩽ −3');

    const positive = solveInequalitySteps(simpleInequality(3, 'lt', 12));
    expect(positive.find((step) => step.kind === 'divide')!.rule).toContain('сохраняется');
  });

  it('завершает вырожденный случай выводом без деления', () => {
    const steps = solveInequalitySteps(linearInequality(linearExpression(2, 3), 'le', linearExpression(2, 1)));
    expect(steps.some((step) => step.kind === 'divide')).toBe(false);
    expect(steps.at(-1)!.text).toBe('решений нет');
  });
});

describe('системы линейных неравенств', () => {
  it('пересекает решения отдельных неравенств', () => {
    const system = [
      linearInequality(linearExpression(2, -1), 'gt', linearExpression(0, 3)), // x > 2
      linearInequality(linearExpression(1, 0), 'le', linearExpression(0, 6)), // x ⩽ 6
    ];
    expect(textOf(solveInequalitySystem(system))).toBe('(2; 6]');
  });

  it('находит единственное решение и пустое множество', () => {
    expect(textOf(solveInequalitySystem([
      simpleInequality(1, 'ge', 2),
      simpleInequality(1, 'le', 2),
    ]))).toBe('[2; 2]');
    expect(textOf(solveInequalitySystem([
      simpleInequality(1, 'gt', 2),
      simpleInequality(1, 'lt', 2),
    ]))).toBe('∅');
    expect(textOf(solveInequalitySystem([
      simpleInequality(1, 'ge', 3),
      simpleInequality(1, 'le', 1),
    ]))).toBe('∅');
  });

  it('считает пустую систему всей прямой и учитывает вырожденные неравенства', () => {
    expect(textOf(solveInequalitySystem([]))).toBe('(−∞; +∞)');
    expect(textOf(solveInequalitySystem([
      linearInequality(linearExpression(1, 1), 'gt', linearExpression(1, 0)), // 0 > −1
      simpleInequality(1, 'lt', 5),
    ]))).toBe('(−∞; 5)');
  });
});

describe('оценка величин', () => {
  const a = closedInterval(2, 3);
  const b = closedInterval(5, 7);

  it('складывает и вычитает границы', () => {
    expect(formatIntervalText(estimateSum(a, b))).toBe('[7; 10]');
    expect(formatIntervalText(estimateDifference(a, b))).toBe('[−5; −2]');
    expect(formatIntervalText(negateInterval(halfOpenInterval(2, 3, true)))).toBe('(−3; −2]');
  });

  it('сохраняет строгость только тогда, когда обе границы включены', () => {
    expect(formatIntervalText(estimateSum(openInterval(2, 3), closedInterval(5, 7)))).toBe('(7; 10)');
    expect(formatIntervalText(estimateSum(halfOpenInterval(2, 3, true), closedInterval(5, 7)))).toBe('[7; 10)');
  });

  it('переворачивает промежуток при умножении на отрицательное число', () => {
    expect(formatIntervalText(estimateScaled(a, 10))).toBe('[20; 30]');
    expect(formatIntervalText(estimateScaled(a, -2))).toBe('[−6; −4]');
    expect(formatIntervalText(estimateScaled(greaterThanSet(4, true), -1))).toBe('(−∞; −4]');
    expect(formatIntervalText(estimateScaled(a, 0))).toBe('[0; 0]');
  });

  it('оценивает произведение по четырём углам', () => {
    expect(formatIntervalText(estimateProduct(a, b))).toBe('[10; 21]');
    expect(formatIntervalText(estimateProduct(closedInterval(-2, 3), closedInterval(-1, 4)))).toBe('[−8; 12]');
    expect(formatIntervalText(estimateProduct(closedInterval(-3, -2), closedInterval(-5, -4)))).toBe('[8; 15]');
    expect(formatIntervalText(estimateProduct(openInterval(2, 3), closedInterval(5, 7)))).toBe('(10; 21)');
  });

  it('оценивает обратную величину и частное', () => {
    expect(formatIntervalText(estimateReciprocal(closedInterval(2, 4)))).toBe('[0,25; 0,5]');
    expect(formatIntervalText(estimateReciprocal(closedInterval(-4, -2)))).toBe('[−0,5; −0,25]');
    expect(formatIntervalText(estimateQuotient(closedInterval(2, 3), closedInterval(4, 5)))).toBe('[0,4; 0,75]');
  });

  it('отказывается оценивать в невозможных случаях', () => {
    expect(() => estimateProduct(greaterThanSet(1), closedInterval(2, 3))).toThrow('ограничен');
    expect(() => estimateReciprocal(closedInterval(-1, 2))).toThrow('ноль');
    expect(() => estimateReciprocal(closedInterval(0, 2))).toThrow('ноль');
    expect(() => estimateQuotient(closedInterval(1, 2), closedInterval(-1, 1))).toThrow('ноль');
  });

  it('согласуется с прямой проверкой в конкретной точке', () => {
    // 2,5 + 5,1 = 7,6 — число должно попасть в найденную оценку суммы.
    expect(containsNumber(estimateSum(a, b), '7,6')).toBe(true);
    expect(containsNumber(estimateProduct(a, b), 15)).toBe(true);
    expect(containsNumber(estimateProduct(a, b), 9)).toBe(false);
  });
});

describe('галерея графиков', () => {
  it('уважает область определения', () => {
    expect(curveValue('inverse', 1, 0)).toBeNull();
    expect(curveValue('inverse', 6, 3)).toBe(2);
    expect(curveValue('sqrt', 1, -4)).toBeNull();
    expect(curveValue('sqrt', 1, 9)).toBe(3);
    expect(curveValue('square', -1, -3)).toBe(-9);
    expect(curveValue('abs', 2, -3)).toBe(6);
  });

  it('требует ненулевой коэффициент', () => {
    expect(() => curveValue('square', 0, 2)).toThrow('отличным от нуля');
    expect(() => curveBranches('inverse', 0, 6)).toThrow('отличным от нуля');
    expect(() => curveBranches('square', 1, 0)).toThrow('положительным');
  });

  it('записывает функцию формулой и текстом', () => {
    expect(curveLatex('inverse', 6)).toBe('y = \\dfrac{6}{x}');
    expect(curveLatex('square', 1)).toBe('y = x^2');
    expect(curveLatex('square', -1)).toBe('y = -x^2');
    expect(curveLatex('sqrt', 2)).toBe('y = 2\\sqrt{x}');
    expect(curveLatex('abs', -3)).toBe('y = -3|x|');
    expect(curveText('inverse', -4)).toBe('y = −4/x');
    expect(curveText('abs', 1)).toBe('y = |x|');
  });

  it('разбивает гиперболу на две ветви, а остальные графики оставляет цельными', () => {
    expect(curveBranches('inverse', 1, 6)).toHaveLength(2);
    expect(curveBranches('square', 1, 6)).toHaveLength(1);
    expect(curveBranches('sqrt', 1, 6)).toHaveLength(1);
    expect(curveBranches('abs', 1, 6)).toHaveLength(1);
    // Если в окне графика не видно ни одной точки, ветвей нет вовсе.
    expect(curveBranches('inverse', 1, 0.5)).toHaveLength(0);
  });

  it('строит ветви только внутри окна и в правильных четвертях', () => {
    const branches = curveBranches('inverse', 1, 6);
    for (const branch of branches) {
      for (const point of branch) {
        expect(Math.abs(point.x)).toBeLessThanOrEqual(6 + 1e-9);
        expect(Math.abs(point.y)).toBeLessThanOrEqual(6 + 1e-9);
        expect(point.x * point.y).toBeGreaterThan(0);
      }
    }
    const left = branches[0]!;
    const right = branches[1]!;
    expect(left.every((point) => point.x < 0)).toBe(true);
    expect(right.every((point) => point.x > 0)).toBe(true);
  });

  it('доводит ветвь ровно до края окна', () => {
    const [branch] = curveBranches('square', 1, 6);
    const last = branch!.at(-1)!;
    expect(Math.abs(last.y - 6)).toBeLessThan(1e-6);
    expect(Math.abs(last.x - Math.sqrt(6))).toBeLessThan(1e-6);

    const [ray] = curveBranches('sqrt', 1, 4);
    expect(ray![0]!.x).toBe(0);
    expect(ray![0]!.y).toBe(0);
  });

  it('описывает свойства, читаемые по графику', () => {
    expect(curveFacts('inverse', 2).zeros).toContain('нулей нет');
    expect(curveFacts('inverse', 2).behaviour).toContain('I и III');
    expect(curveFacts('inverse', -2).behaviour).toContain('II и IV');
    expect(curveFacts('square', 1).range).toBe('y ⩾ 0');
    expect(curveFacts('square', -1).range).toBe('y ⩽ 0');
    expect(curveFacts('sqrt', 1).domain).toBe('x ⩾ 0');
    expect(curveFacts('abs', 1).symmetry).toContain('Oy');
  });

  it('строит таблицу значений с пропусками вне области определения', () => {
    expect(curveTable('inverse', 6, [-3, 0, 2])).toEqual([
      { x: -3, y: -2 },
      { x: 0, y: null },
      { x: 2, y: 3 },
    ]);
    expect(curveTable('sqrt', 1, [-1, 4])).toEqual([
      { x: -1, y: null },
      { x: 4, y: 2 },
    ]);
  });
});

describe('связь промежутков и решений', () => {
  it('множество решений совпадает с промежутком, найденным вручную', () => {
    const answer = solveLinearInequality(linearInequality(linearExpression(-3, 2), 'lt', linearExpression(0, -7)));
    // −3x + 2 < −7 ⇔ −3x < −9 ⇔ x > 3
    expect(textOf(answer)).toBe('(3; +∞)');
    expect(setOf(greaterThanSet(3, false)).kind).toBe('interval');
    expect(textOf(intersectSetsHelper(answer))).toBe('(3; 5]');
  });
});

function intersectSetsHelper(set: NumberSet): NumberSet {
  return intersectIntervals(intervalOf(set), lessThanSet(5, true));
}
