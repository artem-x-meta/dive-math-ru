import { describe, expect, it } from 'vitest';
import {
  ALL_NUMBERS,
  EMPTY_INTERVAL,
  addExponents,
  checkLogBase,
  checkLogDomain,
  checkLogRule,
  checkRationalPowerRule,
  exactLog,
  exponentText,
  exponentialSegments,
  expValue,
  firstPermanentLead,
  formatExact,
  growthBox,
  growthExit,
  growthSegments,
  growthTable,
  growthValue,
  integerNthRoot,
  intersectIntervals,
  intervalContains,
  intervalText,
  logIdentityValue,
  logValue,
  logarithmSegments,
  mirrorPairs,
  multiplyExponents,
  radicalText,
  rationalPowerExact,
  rationalPowerValue,
  reduceExponent,
  reflectSegments,
  solveExponentialEquation,
  solveExponentialInequality,
  solveLogEquation,
  solveLogInequality,
  subtractExponents,
  type GrowthModel,
} from '../src/lib/explog';
import type { Box } from '../src/lib/functionsCore';

describe('rational exponents', () => {
  it('reduces the exponent and keeps the sign in the numerator', () => {
    expect(reduceExponent(4, 6)).toEqual({ numerator: 2, denominator: 3 });
    expect(reduceExponent(3, -6)).toEqual({ numerator: -1, denominator: 2 });
    expect(reduceExponent(-8, -4)).toEqual({ numerator: 2, denominator: 1 });
    expect(reduceExponent(0, 5)).toEqual({ numerator: 0, denominator: 1 });
  });

  it('rejects a zero denominator and non-integer parts', () => {
    expect(() => reduceExponent(1, 0)).toThrow('не может быть равен нулю');
    expect(() => reduceExponent(1.5, 2)).toThrow('целыми числами');
  });

  it('adds, subtracts and multiplies exponents as fractions', () => {
    expect(addExponents({ numerator: 1, denominator: 3 }, { numerator: 2, denominator: 3 })).toEqual({ numerator: 1, denominator: 1 });
    expect(addExponents({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 3 })).toEqual({ numerator: 5, denominator: 6 });
    expect(subtractExponents({ numerator: 3, denominator: 4 }, { numerator: 1, denominator: 4 })).toEqual({ numerator: 1, denominator: 2 });
    expect(multiplyExponents({ numerator: 2, denominator: 3 }, { numerator: 3, denominator: 4 })).toEqual({ numerator: 1, denominator: 2 });
  });

  it('extracts an exact integer root or reports that there is none', () => {
    expect(integerNthRoot(64, 3)).toBe(4);
    expect(integerNthRoot(64, 2)).toBe(8);
    expect(integerNthRoot(81, 4)).toBe(3);
    expect(integerNthRoot(1024, 10)).toBe(2);
    expect(integerNthRoot(63, 3)).toBeNull();
    expect(integerNthRoot(2, 2)).toBeNull();
    expect(integerNthRoot(0, 5)).toBe(0);
    expect(integerNthRoot(1, 7)).toBe(1);
  });

  it('computes a^(p/q) exactly when the value is rational', () => {
    expect(formatExact(rationalPowerExact(8, 2, 3)!)).toBe('4');
    expect(formatExact(rationalPowerExact(16, 3, 4)!)).toBe('8');
    expect(formatExact(rationalPowerExact(27, -2, 3)!)).toBe('1/9');
    expect(formatExact(rationalPowerExact('0.25', 1, 2)!)).toBe('0,5');
    expect(formatExact(rationalPowerExact(32, 0, 5)!)).toBe('1');
    expect(rationalPowerExact(2, 1, 2)).toBeNull();
    expect(rationalPowerExact(10, 1, 3)).toBeNull();
  });

  it('refuses a non-positive base for a rational exponent', () => {
    expect(() => rationalPowerExact(-8, 1, 3)).toThrow('положительного основания');
    expect(() => rationalPowerValue(0, 1, 2)).toThrow('положительного основания');
  });

  it('agrees with the floating point value', () => {
    expect(rationalPowerValue(9, 1, 2)).toBeCloseTo(3, 12);
    expect(rationalPowerValue(8, 2, 3)).toBeCloseTo(4, 12);
    expect(rationalPowerValue(4, -3, 2)).toBeCloseTo(0.125, 12);
  });

  it('writes a rational power with a radical sign', () => {
    expect(exponentText({ numerator: 4, denominator: 6 })).toBe('2/3');
    expect(exponentText({ numerator: -6, denominator: 3 })).toBe('−2');
    expect(radicalText('a', { numerator: 3, denominator: 2 })).toBe('√(a³)');
    expect(radicalText('a', { numerator: 2, denominator: 3 })).toBe('∛(a²)');
    expect(radicalText('a', { numerator: 3, denominator: 5 })).toBe('⁵√(a³)');
    expect(radicalText('a', { numerator: -1, denominator: 2 })).toBe('1/√(a)');
    expect(radicalText('a', { numerator: 6, denominator: 3 })).toBe('a²');
  });

  it('confirms the power rules on concrete numbers', () => {
    const product = checkRationalPowerRule('product', 8, { numerator: 1, denominator: 3 }, { numerator: 2, denominator: 3 });
    expect(product.resultExponent).toEqual({ numerator: 1, denominator: 1 });
    expect(product.matches).toBe(true);
    expect(formatExact(product.exactValue!)).toBe('8');

    const quotient = checkRationalPowerRule('quotient', 16, { numerator: 3, denominator: 4 }, { numerator: 1, denominator: 4 });
    expect(quotient.resultExponent).toEqual({ numerator: 1, denominator: 2 });
    expect(formatExact(quotient.exactValue!)).toBe('4');
    expect(quotient.matches).toBe(true);

    const tower = checkRationalPowerRule('power-of-power', 4, { numerator: 1, denominator: 2 }, { numerator: 3, denominator: 1 });
    expect(tower.resultExponent).toEqual({ numerator: 3, denominator: 2 });
    expect(formatExact(tower.exactValue!)).toBe('8');
    expect(tower.matches).toBe(true);

    const radical = checkRationalPowerRule('radical', 9, { numerator: 3, denominator: 2 }, { numerator: 1, denominator: 1 });
    expect(radical.resultExponent).toEqual({ numerator: 3, denominator: 2 });
    expect(formatExact(radical.exactValue!)).toBe('27');
    expect(radical.matches).toBe(true);
    expect(radical.text).toBe('√(a³) = a^(3/2)');
  });

  it('keeps the rule true even when the value is irrational', () => {
    const check = checkRationalPowerRule('product', 2, { numerator: 1, denominator: 2 }, { numerator: 1, denominator: 3 });
    expect(check.resultExponent).toEqual({ numerator: 5, denominator: 6 });
    expect(check.exactValue).toBeNull();
    expect(check.matches).toBe(true);
  });
});

describe('exponential growth against power and linear growth', () => {
  const model: GrowthModel = { base: 2, degree: 2, slope: 5, maxX: 12 };

  it('builds an honest table of values', () => {
    const rows = growthTable(model);
    expect(rows).toHaveLength(13);
    expect(rows[0]).toEqual({ x: 0, exponential: 1, power: 0, linear: 0, leader: 'exponential' });
    expect(rows[2]!.exponential).toBe(4);
    expect(rows[2]!.power).toBe(4);
    expect(rows[2]!.linear).toBe(10);
    expect(rows[2]!.leader).toBe('linear');
    expect(rows[12]!.exponential).toBe(4096);
    expect(rows[12]!.power).toBe(144);
    expect(rows[12]!.leader).toBe('exponential');
  });

  it('marks a tie when two competitors coincide', () => {
    const rows = growthTable({ base: 2, degree: 2, slope: 1, maxX: 4 });
    expect(rows[2]!.leader).toBe('tie');
    expect(rows[4]!.leader).toBe('tie');
  });

  it('finds the point after which the exponential leads forever', () => {
    expect(firstPermanentLead({ base: 2, degree: 2, slope: 1, maxX: 12 })).toBe(5);
    expect(firstPermanentLead({ base: 2, degree: 1, slope: 1, maxX: 12 })).toBe(1);
    expect(firstPermanentLead({ base: 2, degree: 3, slope: 1, maxX: 12 })).toBe(10);
  });

  it('confirms the lead by direct comparison of values', () => {
    const lead = firstPermanentLead({ base: 2, degree: 2, slope: 1, maxX: 12 })!;
    const before = lead - 1;
    expect(Math.pow(2, before) <= Math.pow(before, 2)).toBe(true);
    for (let n = lead; n <= 40; n += 1) {
      expect(Math.pow(2, n) > Math.pow(n, 2)).toBe(true);
    }
  });

  it('keeps the window sized by the slower competitors', () => {
    const box = growthBox(model);
    expect(box.xMin).toBe(0);
    expect(box.xMax).toBe(12);
    expect(box.yMax).toBeCloseTo(144 * 1.1, 9);
    expect(growthExit(model)).toBeCloseTo(Math.log2(144 * 1.1), 9);
  });

  it('samples every curve from its formula', () => {
    const box = growthBox(model);
    const power = growthSegments(model, 'power', 41);
    expect(power.length).toBeGreaterThan(0);
    for (const point of power.flat()) {
      expect(point.y).toBeCloseTo(Math.pow(point.x, 2), 9);
      expect(point.y).toBeLessThanOrEqual(box.yMax + 1e-6);
    }
    const exponential = growthSegments(model, 'exponential', 41);
    // Экспонента обрывается на границе окна, а не рисуется за его пределами.
    const highest = Math.max(...exponential.flat().map((point) => point.x));
    expect(highest).toBeLessThan(model.maxX);
  });

  it('rejects models outside the school setting', () => {
    expect(() => growthValue({ base: 1, degree: 2, slope: 1, maxX: 5 }, 'exponential', 2)).toThrow('больше единицы');
    expect(() => growthValue({ base: 2, degree: 0, slope: 1, maxX: 5 }, 'power', 2)).toThrow('от 1 до 6');
    expect(() => growthValue({ base: 2, degree: 2, slope: 0, maxX: 5 }, 'linear', 2)).toThrow('положительным');
  });
});

describe('logarithm and its domain', () => {
  it('checks the base', () => {
    expect(checkLogBase(3).ok).toBe(true);
    expect(checkLogBase(0.5).ok).toBe(true);
    expect(checkLogBase(1).ok).toBe(false);
    expect(checkLogBase(0).ok).toBe(false);
    expect(checkLogBase(-2).ok).toBe(false);
  });

  it('requires a strictly positive argument', () => {
    expect(checkLogDomain(2, 8).ok).toBe(true);
    expect(checkLogDomain(2, 0).ok).toBe(false);
    expect(checkLogDomain(2, -5).ok).toBe(false);
    expect(() => logValue(2, 0)).toThrow('строго положительное');
    expect(() => logValue(1, 8)).toThrow('не может равняться единице');
  });

  it('computes values that are checkable by hand', () => {
    expect(logValue(2, 8)).toBe(3);
    expect(logValue(10, 1000)).toBe(3);
    expect(logValue(2, 1)).toBe(0);
    expect(logValue(3, 81)).toBeCloseTo(4, 12);
    expect(logValue(0.5, 8)).toBeCloseTo(-3, 12);
    expect(logValue(9, 27)).toBeCloseTo(1.5, 12);
  });

  it('satisfies the main logarithmic identity', () => {
    expect(logIdentityValue(7, 5)).toBeCloseTo(5, 9);
    expect(logIdentityValue(0.5, 12)).toBeCloseTo(12, 9);
    expect(expValue(3, logValue(3, 17))).toBeCloseTo(17, 9);
  });

  it('finds the exact rational value of a logarithm', () => {
    expect(exactLog(2, 8)).toEqual({ numerator: 3, denominator: 1 });
    expect(exactLog(2, 1)).toEqual({ numerator: 0, denominator: 1 });
    expect(exactLog(2, '0.125')).toEqual({ numerator: -3, denominator: 1 });
    expect(exactLog(9, 27)).toEqual({ numerator: 3, denominator: 2 });
    expect(exactLog(4, 8)).toEqual({ numerator: 3, denominator: 2 });
    expect(exactLog('0.5', 8)).toEqual({ numerator: -3, denominator: 1 });
    expect(exactLog(2, 5)).toBeNull();
    expect(exactLog(3, 5)).toBeNull();
  });

  it('refuses an impossible logarithm', () => {
    expect(() => exactLog(1, 8)).toThrow('не равным единице');
    expect(() => exactLog(2, 0)).toThrow('положительное число');
  });

  it('confirms the logarithm rules on numbers that can be checked mentally', () => {
    const product = checkLogRule('product', 2, 8, 4);
    expect(product.leftValue).toBeCloseTo(5, 12);
    expect(product.rightValue).toBeCloseTo(5, 12);
    expect(product.matches).toBe(true);

    const quotient = checkLogRule('quotient', 3, 81, 3);
    expect(quotient.leftValue).toBeCloseTo(3, 12);
    expect(quotient.matches).toBe(true);

    const power = checkLogRule('power', 5, 25, 3);
    expect(power.leftValue).toBeCloseTo(6, 12);
    expect(power.rightValue).toBeCloseTo(6, 12);
    expect(power.matches).toBe(true);

    const change = checkLogRule('change-base', 8, 2, 2);
    expect(change.leftValue).toBeCloseTo(1 / 3, 12);
    expect(change.rightValue).toBeCloseTo(1 / 3, 12);
    expect(change.matches).toBe(true);
  });

  it('does not let a rule be applied outside the domain', () => {
    expect(() => checkLogRule('product', 2, -8, 4)).toThrow('строго положительное');
    expect(() => checkLogRule('quotient', 2, 8, 0)).toThrow('строго положительное');
    expect(() => checkLogRule('change-base', 2, 8, 1)).toThrow('не может равняться единице');
  });
});

describe('graphs of the exponential and the logarithm', () => {
  const box: Box = { xMin: -4, xMax: 4, yMin: -4, yMax: 4 };

  it('returns the argument after the round trip', () => {
    for (const pair of mirrorPairs(2, [-2, -1, 0, 1, 3])) {
      expect(pair.exponential).toBeCloseTo(Math.pow(2, pair.x), 12);
      expect(pair.back).toBeCloseTo(pair.x, 9);
    }
  });

  it('places the reflected exponential exactly on the logarithm', () => {
    const reflected = reflectSegments(exponentialSegments(2, box, 121));
    expect(reflected.length).toBeGreaterThan(0);
    for (const point of reflected.flat()) {
      expect(point.x).toBeGreaterThan(0);
      expect(point.y).toBeCloseTo(logValue(2, point.x), 9);
    }
  });

  it('never draws the logarithm to the left of the y axis', () => {
    const segments = logarithmSegments(3, box, 121);
    expect(segments.length).toBeGreaterThan(0);
    for (const point of segments.flat()) {
      expect(point.x).toBeGreaterThan(0);
      expect(point.y).toBeCloseTo(logValue(3, point.x), 9);
    }
  });

  it('draws a decreasing curve for a base between zero and one', () => {
    const points = exponentialSegments(0.5, box, 121).flat();
    for (let index = 1; index < points.length; index += 1) {
      expect(points[index]!.y).toBeLessThan(points[index - 1]!.y);
    }
  });
});

describe('simplest exponential and logarithmic equations', () => {
  it('solves a^x = b when both sides share a base', () => {
    const solution = solveExponentialEquation(2, 8);
    expect(solution.solvable).toBe(true);
    expect(solution.x).toBeCloseTo(3, 12);
    expect(solution.exact).toEqual({ numerator: 3, denominator: 1 });
  });

  it('solves a^x = b through a logarithm when there is no common base', () => {
    const solution = solveExponentialEquation(3, 5);
    expect(solution.solvable).toBe(true);
    expect(solution.exact).toBeNull();
    expect(Math.pow(3, solution.x!)).toBeCloseTo(5, 9);
  });

  it('reports that a non-positive right side gives no roots', () => {
    expect(solveExponentialEquation(2, 0).solvable).toBe(false);
    expect(solveExponentialEquation(2, -4).x).toBeNull();
    expect(solveExponentialEquation(2, -4).explanation).toContain('положительные значения');
  });

  it('works for a decreasing exponential too', () => {
    const solution = solveExponentialEquation(0.5, 8);
    expect(solution.x).toBeCloseTo(-3, 12);
    expect(solution.exact).toEqual({ numerator: -3, denominator: 1 });
  });

  it('solves log_a(kx + m) = c and checks the domain', () => {
    const first = solveLogEquation(2, 1, -3, 4);
    expect(first.solvable).toBe(true);
    expect(first.x).toBeCloseTo(19, 12);
    expect(logValue(2, 19 - 3)).toBeCloseTo(4, 12);

    const second = solveLogEquation(3, 2, 1, 2);
    expect(second.x).toBeCloseTo(4, 12);
    expect(logValue(3, 2 * 4 + 1)).toBeCloseTo(2, 12);

    const third = solveLogEquation(0.5, 1, 0, 3);
    expect(third.x).toBeCloseTo(0.125, 12);
  });

  it('rejects a degenerate logarithmic equation', () => {
    expect(() => solveLogEquation(2, 0, 1, 3)).toThrow('не может быть равен нулю');
    expect(() => solveLogEquation(1, 1, 0, 3)).toThrow('не может равняться единице');
  });
});

describe('exponential and logarithmic inequalities', () => {
  it('keeps the direction when the base is greater than one', () => {
    const solution = solveExponentialInequality(2, 8, '>');
    expect(intervalText(solution)).toBe('(3; +∞)');
    expect(intervalContains(solution, 3)).toBe(false);
    expect(intervalContains(solution, 3.5)).toBe(true);

    expect(intervalText(solveExponentialInequality(3, 9, '<='))).toBe('(−∞; 2]');
    expect(intervalContains(solveExponentialInequality(3, 9, '<='), 2)).toBe(true);
  });

  it('reverses the direction when the base is between zero and one', () => {
    const solution = solveExponentialInequality(0.5, 8, '>');
    expect(intervalText(solution)).toBe('(−∞; −3)');
    expect(intervalContains(solution, -4)).toBe(true);
    expect(Math.pow(0.5, -4) > 8).toBe(true);
    expect(intervalContains(solution, -2)).toBe(false);
    expect(Math.pow(0.5, -2) > 8).toBe(false);
  });

  it('handles a non-positive right side without a logarithm', () => {
    expect(solveExponentialInequality(2, -1, '>')).toEqual(ALL_NUMBERS);
    expect(solveExponentialInequality(2, 0, '>=')).toEqual(ALL_NUMBERS);
    expect(solveExponentialInequality(2, -1, '<')).toEqual(EMPTY_INTERVAL);
  });

  it('adds the domain to a logarithmic inequality', () => {
    expect(intervalText(solveLogInequality(2, 1, -3, 4, '>'))).toBe('(19; +∞)');
    // Здесь ОДЗ отсекает левый конец: без него получился бы луч (−∞; 19).
    expect(intervalText(solveLogInequality(2, 1, -3, 4, '<'))).toBe('(3; 19)');
    expect(intervalContains(solveLogInequality(2, 1, -3, 4, '<'), 3)).toBe(false);
    expect(intervalContains(solveLogInequality(2, 1, -3, 4, '<'), 4)).toBe(true);
  });

  it('flips the direction for a decreasing logarithm', () => {
    const solution = solveLogInequality(0.5, 1, 0, 2, '<');
    expect(intervalText(solution)).toBe('(0,25; +∞)');
    expect(intervalContains(solution, 1)).toBe(true);
    expect(logValue(0.5, 1) < 2).toBe(true);
  });

  it('turns the interval around when the coefficient at x is negative', () => {
    const solution = solveLogInequality(2, -1, 5, 1, '>');
    expect(intervalText(solution)).toBe('(−∞; 3)');
    expect(intervalContains(solution, 0)).toBe(true);
    expect(logValue(2, 5 - 0) > 1).toBe(true);
    expect(intervalContains(solution, 4)).toBe(false);
  });

  it('intersects intervals and recognizes an empty answer', () => {
    const left = solveExponentialInequality(2, 8, '>');
    const right = solveExponentialInequality(2, 32, '<');
    expect(intervalText(intersectIntervals(left, right))).toBe('(3; 5)');
    expect(intersectIntervals(left, solveExponentialInequality(2, 8, '<')).empty).toBe(true);
    expect(intervalText(EMPTY_INTERVAL)).toBe('решений нет');
    expect(intervalText(ALL_NUMBERS)).toBe('любое число');
  });
});
