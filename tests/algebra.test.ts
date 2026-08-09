import { describe, expect, it } from 'vitest';

import { distributiveZeroFocusFraction } from '../src/components/DistributiveLab';
import { expressionTreeRootFocusFraction } from '../src/components/ExpressionMachineLab';

import {
  ALGEBRA_LIMITS,
  AlgebraError,
  collectExpressionVariables,
  equivalentLinearExpressions,
  evaluateExpression,
  formatExpressionLatex,
  linearizeExpression,
  parseExpression,
  traceEvaluation,
} from '../src/lib/algebra';
import {
  EXACT_RATIONAL_LIMITS,
  ExactRationalError,
  addExact,
  compareExact,
  divideExact,
  formatExactRussian,
  multiplyExact,
  parseExact,
  subtractExact,
  toExactNumber,
} from '../src/lib/exactRational';
import {
  evaluateFormulaPreset,
  getFormulaPreset,
  initialFormulaValues,
  listFormulaPresets,
  validateFormulaValues,
} from '../src/lib/formulas';

function exact(numerator: bigint, denominator = 1n) {
  return { numerator, denominator } as const;
}

function expectAlgebraCode(action: () => unknown, code: AlgebraError['code']): void {
  try {
    action();
    throw new Error('Expected an AlgebraError.');
  } catch (error) {
    expect(error).toBeInstanceOf(AlgebraError);
    expect((error as AlgebraError).code).toBe(code);
  }
}

describe('exact rational arithmetic', () => {
  it('normalizes signs, common factors, and every representation of zero', () => {
    expect(parseExact({ numerator: -6n, denominator: -8n })).toEqual(exact(3n, 4n));
    expect(parseExact({ numerator: 0n, denominator: -19n })).toEqual(exact(0n));
    expect(Object.isFrozen(parseExact('3/4'))).toBe(true);
  });

  it('adds 0.1 and 0.2 exactly', () => {
    expect(addExact('0.1', '0.2')).toEqual(exact(3n, 10n));
    expect(addExact('0,1', '0,2')).toEqual(exact(3n, 10n));
  });

  it('parses decimal fractions, ordinary fractions, signs, and safe exponent notation', () => {
    expect(parseExact('1,25')).toEqual(exact(5n, 4n));
    expect(parseExact(' 3 / 4 ')).toEqual(exact(3n, 4n));
    expect(parseExact('−0,5')).toEqual(exact(-1n, 2n));
    expect(parseExact(1e-7)).toEqual(exact(1n, 10_000_000n));
  });

  it('performs the four operations and comparison without floating-point rounding', () => {
    expect(subtractExact('5/6', '1/3')).toEqual(exact(1n, 2n));
    expect(multiplyExact('6/35', '14/9')).toEqual(exact(4n, 15n));
    expect(divideExact('3/5', '9/10')).toEqual(exact(2n, 3n));
    expect(compareExact('-2/3', '-0,6')).toBe(-1);
    expect(compareExact('2/4', '0,5')).toBe(0);
  });

  it('reports exact division by zero with a stable machine code', () => {
    expect(() => divideExact(1, 0)).toThrow(ExactRationalError);
    try {
      divideExact(1, 0);
    } catch (error) {
      expect((error as ExactRationalError).code).toBe('division-by-zero');
    }
  });

  it('formats terminating and repeating values deterministically for Russian text', () => {
    expect(formatExactRussian('-3/2')).toBe('−1,5');
    expect(formatExactRussian('-1/3')).toBe('−1/3');
    expect(formatExactRussian('120/100')).toBe('1,2');
    expect(formatExactRussian(0)).toBe('0');
  });

  it('guards input size and numeric conversion underflow', () => {
    expect(() => parseExact('1'.repeat(EXACT_RATIONAL_LIMITS.maxInputDigits + 1))).toThrow(
      ExactRationalError,
    );
    expect(() => toExactNumber(exact(1n, 10n ** 400n))).toThrow(ExactRationalError);
  });

  it('bounds textual and pre-built exact inputs before expensive processing', () => {
    expect(() => parseExact(`1e${'9'.repeat(EXACT_RATIONAL_LIMITS.maxSourceLength)}`)).toThrow(
      ExactRationalError,
    );
    expect(() => parseExact(exact(1n, 10n ** BigInt(EXACT_RATIONAL_LIMITS.maxResultDigits + 1)))).toThrow(
      ExactRationalError,
    );
  });
});

describe('safe expression parser and evaluator', () => {
  it('respects precedence and left-associative division', () => {
    expect(evaluateExpression(parseExpression('2 + 3 * 4'))).toEqual(exact(14n));
    expect(evaluateExpression(parseExpression('8 / 4 / 2'))).toEqual(exact(1n));
  });

  it('supports parentheses, unary signs, decimal comma, and exact fractions', () => {
    const ast = parseExpression('-(1,5 + x) / (3/4)', ['x']);
    expect(evaluateExpression(ast, { x: '-0,5' })).toEqual(exact(-4n, 3n));
  });

  it('accepts explicit variable names and rejects undeclared ones', () => {
    expect(collectExpressionVariables(parseExpression('x + a + t0', ['x', 'a', 't0']))).toEqual([
      'a',
      't0',
      'x',
    ]);
    expectAlgebraCode(() => parseExpression('x + y', ['x']), 'invalid-expression');
  });

  it('rejects implicit multiplication, equality, calls, and unknown characters', () => {
    for (const source of ['2x', '2(x + 1)', 'x = 3', 'f(2)', 'x ** 2']) {
      expectAlgebraCode(() => parseExpression(source), 'invalid-expression');
    }
  });

  it('does not read inherited object properties as variable values', () => {
    const ast = parseExpression('constructor');
    expectAlgebraCode(() => evaluateExpression(ast, {}), 'missing-variable');
  });

  it('reports missing variables and evaluator division by zero with stable codes', () => {
    expectAlgebraCode(() => evaluateExpression(parseExpression('x + 1')), 'missing-variable');
    expectAlgebraCode(
      () => evaluateExpression(parseExpression('1 / (x - 2)'), { x: 2 }),
      'division-by-zero',
    );
  });

  it('allows products of substituted variables during ordinary evaluation', () => {
    expect(evaluateExpression(parseExpression('a * b'), { a: '1,5', b: 4 })).toEqual(exact(6n));
  });

  it('produces an ordered pedagogical trace and parenthesizes a negative substitution', () => {
    const trace = traceEvaluation(parseExpression('5 - x'), { x: -3 });
    expect(trace).toEqual([
      { nodeId: 'n2', reason: 'substitute', before: 'x', after: '−3' },
      { nodeId: 'n3', reason: 'add-subtract', before: '5 − (−3)', after: '8' },
    ]);

    const grouped = traceEvaluation(parseExpression('2 * (x + 1)'), { x: 3 });
    expect(grouped.map((step) => step.reason)).toEqual([
      'substitute',
      'add-subtract',
      'parentheses',
      'multiply-divide',
    ]);
    expect(grouped.at(-1)?.after).toBe('8');

    const negativeProduct = traceEvaluation(parseExpression('2 * x'), { x: -3 });
    expect(negativeProduct.at(-1)?.before).toBe('2 · (−3)');
  });

  it('renders exact fractions, indexed variables, and schoolbook multiplication in LaTeX', () => {
    expect(formatExpressionLatex(parseExpression('3 * x'))).toBe('3x');
    expect(formatExpressionLatex(parseExpression('2 * (x + 3)'))).toBe('2\\left(x + 3\\right)');
    expect(formatExpressionLatex(parseExpression('t0 / 0,5'))).toBe(
      '\\frac{t_{0}}{\\frac{1}{2}}',
    );
    expect(formatExpressionLatex(parseExpression('2 * 3'))).toBe('2 \\cdot 3');
    expect(formatExpressionLatex(parseExpression('x - -2'))).toBe('x - \\left(-2\\right)');
    expect(formatExpressionLatex(parseExpression('3 * -2'))).toBe('3 \\cdot \\left(-2\\right)');
  });

  it('enforces source, digit, and nesting limits', () => {
    expectAlgebraCode(
      () => parseExpression(' '.repeat(ALGEBRA_LIMITS.maxSourceLength + 1)),
      'limit-exceeded',
    );
    expectAlgebraCode(
      () => parseExpression('1'.repeat(ALGEBRA_LIMITS.maxNumericDigits + 1)),
      'limit-exceeded',
    );
    const tooDeep = `${'('.repeat(ALGEBRA_LIMITS.maxDepth + 1)}1${')'.repeat(ALGEBRA_LIMITS.maxDepth + 1)}`;
    expectAlgebraCode(() => parseExpression(tooDeep), 'limit-exceeded');
    expectAlgebraCode(
      () => parseExpression('1', new Set(Array.from({ length: ALGEBRA_LIMITS.maxDeclaredVariables + 1 }, (_, index) => `x${index}`))),
      'limit-exceeded',
    );
    expectAlgebraCode(
      () => parseExpression(Array.from({ length: 100 }, () => '1').join('+')),
      'limit-exceeded',
    );
  });

  it('rejects forged trees with duplicate or oversized node ids', () => {
    const duplicate = {
      kind: 'binary',
      operator: 'add',
      id: 'same',
      left: { kind: 'literal', value: exact(1n), id: 'same' },
      right: { kind: 'literal', value: exact(2n), id: 'right' },
    } as const;
    expectAlgebraCode(() => evaluateExpression(duplicate), 'invalid-expression');

    const oversized = {
      kind: 'literal',
      value: exact(1n),
      id: 'n'.repeat(ALGEBRA_LIMITS.maxNodeIdLength + 1),
    } as const;
    expectAlgebraCode(() => evaluateExpression(oversized), 'invalid-expression');
  });
});

describe('algebra SVG focus invariants', () => {
  it('focuses an asymmetric expression tree on its actual root', () => {
    const ast = parseExpression('2 * (x + 3) - 5');
    expect(expressionTreeRootFocusFraction(ast)).toBeCloseTo(451.25 / 740, 10);
    expect(expressionTreeRootFocusFraction(ast)).not.toBeCloseTo(0.5, 2);
  });

  it('keeps zero in view when distributive contributions change direction', () => {
    expect(distributiveZeroFocusFraction(exact(12n), exact(18n))).toBe(0);
    expect(distributiveZeroFocusFraction(exact(-12n), exact(-18n))).toBe(1);
    expect(distributiveZeroFocusFraction(exact(-6n), exact(3n))).toBeCloseTo(2 / 3, 10);
    expect(distributiveZeroFocusFraction(exact(0n), exact(0n))).toBe(0.5);
  });
});

describe('linear forms and equivalence', () => {
  it('collects exact coefficients and the constant term', () => {
    const form = linearizeExpression(parseExpression('2 * (x + 3) - x / 2 + y'));
    expect(form.constant).toEqual(exact(6n));
    expect(form.coefficients.get('x')).toEqual(exact(3n, 2n));
    expect(form.coefficients.get('y')).toEqual(exact(1n));
  });

  it('recognizes the distributive law and removal of zero coefficients', () => {
    expect(equivalentLinearExpressions('3 * (x + 2)', '3 * x + 6')).toBe(true);
    expect(equivalentLinearExpressions('x - x + 4', '4')).toBe(true);
    expect(linearizeExpression(parseExpression('x - x')).coefficients.size).toBe(0);
  });

  it('distinguishes non-equivalent linear expressions', () => {
    expect(equivalentLinearExpressions('2 * x + 1', '2 * x - 1')).toBe(false);
    expect(equivalentLinearExpressions('x + y', '2 * x')).toBe(false);
  });

  it('rejects variable products and variable divisors as non-linear', () => {
    for (const source of ['x * y', '1 / x', 'x / x']) {
      expectAlgebraCode(() => linearizeExpression(parseExpression(source)), 'non-linear');
    }
  });

  it('reports a constant zero divisor separately from non-linearity', () => {
    expectAlgebraCode(
      () => linearizeExpression(parseExpression('x / (2 - 2)')),
      'division-by-zero',
    );
  });
});

describe('formula presets', () => {
  it('publishes all six stable preset ids with parsed formulas and units', () => {
    expect(listFormulaPresets().map((preset) => preset.id)).toEqual([
      'purchase',
      'taxi',
      'perimeter',
      'distance',
      'temperature',
      'expedition-cost',
    ]);
    expect(getFormulaPreset('purchase').variables.map((variable) => variable.unit)).toEqual([
      '₽/шт',
      'шт',
    ]);
    expect(getFormulaPreset('temperature').output.unit).toBe('°C');
  });

  it('evaluates every preset exactly at its initial values', () => {
    expect(evaluateFormulaPreset('purchase', initialFormulaValues('purchase'))).toEqual(exact(360n));
    expect(evaluateFormulaPreset('taxi', initialFormulaValues('taxi'))).toEqual(exact(350n));
    expect(evaluateFormulaPreset('perimeter', initialFormulaValues('perimeter'))).toEqual(exact(20n));
    expect(evaluateFormulaPreset('distance', initialFormulaValues('distance'))).toEqual(exact(120n));
    expect(evaluateFormulaPreset('temperature', initialFormulaValues('temperature'))).toEqual(exact(-3n));
    expect(evaluateFormulaPreset('expedition-cost', initialFormulaValues('expedition-cost'))).toEqual(
      exact(3_240n),
    );
  });

  it('keeps the six school-model formulas stable and uses every declared input', () => {
    expect(Object.fromEntries(listFormulaPresets().map((preset) => [preset.id, preset.expression]))).toEqual({
      purchase: 'p * n',
      taxi: 'f + r * x',
      perimeter: '2 * (a + b)',
      distance: 'v * t',
      temperature: 't0 + d',
      'expedition-cost': '1800 + 240 * n',
    });
    expect(evaluateFormulaPreset('taxi', { f: 90, r: 17, x: 4 })).toEqual(exact(158n));
    expect(evaluateFormulaPreset('perimeter', { a: 7, b: 2 })).toEqual(exact(18n));
    expect(evaluateFormulaPreset('temperature', { t0: -12, d: 5 })).toEqual(exact(-7n));
  });

  it('validates required values, ranges, integer counts, and input steps', () => {
    expect(validateFormulaValues('purchase', {})).toHaveLength(2);
    expect(validateFormulaValues('purchase', { p: -1, n: '1,5' }).map((item) => item.code)).toEqual(
      expect.arrayContaining(['below-minimum', 'not-integer', 'off-step']),
    );
    expect(validateFormulaValues('taxi', { f: 150, r: 25, x: '8,05' }).map((item) => item.code)).toContain(
      'off-step',
    );
    expect(validateFormulaValues('taxi', { f: 150, r: 25, x: '8,05' })[0]?.message).toContain('0,1 км');
    expect(validateFormulaValues('temperature', { t0: 5, d: -8 })).toEqual([]);
  });

  it('treats an unknown preset as a controlled programming error', () => {
    expectAlgebraCode(() => getFormulaPreset('unknown'), 'invalid-expression');
  });
});
