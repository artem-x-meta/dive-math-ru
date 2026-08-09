import { describe, expect, it } from 'vitest';
import {
  checkVietaPair,
  completeSquare,
  describeRoot,
  discriminant,
  evaluateQuadratic,
  exactIntegerSquareRoot,
  factorPairs,
  formatApproximate,
  formatRational,
  integerRootPair,
  monicFromRoots,
  normalizeRational,
  parabolaSegments,
  quadraticKind,
  rootCountFromDiscriminant,
  solveQuadratic,
  vertex,
  vietaProduct,
  vietaSum,
} from '../src/lib/quadratics';

describe('rational normalization', () => {
  it('reduces a fraction and keeps the sign in the numerator', () => {
    expect(normalizeRational(6, 8)).toEqual({ numerator: 3, denominator: 4 });
    expect(normalizeRational(-6, 8)).toEqual({ numerator: -3, denominator: 4 });
    expect(normalizeRational(6, -8)).toEqual({ numerator: -3, denominator: 4 });
    expect(normalizeRational(-6, -8)).toEqual({ numerator: 3, denominator: 4 });
  });

  it('normalizes zero and rejects a zero denominator', () => {
    expect(normalizeRational(0, -7)).toEqual({ numerator: 0, denominator: 1 });
    expect(() => normalizeRational(5, 0)).toThrow('не может быть равен нулю');
    expect(() => normalizeRational(1.5, 2)).toThrow('безопасным целым');
  });
});

describe('discriminant', () => {
  it('computes b² − 4ac for the three standard cases', () => {
    expect(discriminant(1, -5, 6)).toBe(1);
    expect(discriminant(1, -6, 9)).toBe(0);
    expect(discriminant(1, 1, 1)).toBe(-3);
    expect(discriminant(3, -10, 8)).toBe(4);
    expect(discriminant(-1, 3, -2)).toBe(1);
  });

  it('stays exact where floating-point arithmetic already loses a unit', () => {
    // Наивный порядок действий даёт 0 и «теряет» второй корень.
    expect(94906267 * 94906267 - 4 * 2251799878968822).toBe(0);
    expect(discriminant(1, 94906267, 2251799878968822)).toBe(1);
  });

  it('rejects a non-quadratic equation and unsafe coefficients', () => {
    expect(() => discriminant(0, 2, 3)).toThrow('не квадратное');
    expect(() => discriminant(1, 2.5, 3)).toThrow('безопасным целым');
    expect(() => discriminant(1, 200000000, -1)).toThrow('диапазон');
  });

  it('translates the sign of the discriminant into the number of roots', () => {
    expect(rootCountFromDiscriminant(9)).toBe(2);
    expect(rootCountFromDiscriminant(0)).toBe(1);
    expect(rootCountFromDiscriminant(-4)).toBe(0);
    expect(() => rootCountFromDiscriminant(0.5)).toThrow('безопасным целым');
  });
});

describe('exact integer square root', () => {
  it('recognizes perfect squares and refuses everything else', () => {
    expect(exactIntegerSquareRoot(0)).toBe(0);
    expect(exactIntegerSquareRoot(49)).toBe(7);
    expect(exactIntegerSquareRoot(4503599761588225)).toBe(67108865);
    expect(exactIntegerSquareRoot(8)).toBeNull();
    expect(exactIntegerSquareRoot(-9)).toBeNull();
  });
});

describe('solving quadratic equations', () => {
  it('returns two integer roots in increasing order', () => {
    const solution = solveQuadratic(1, -5, 6);
    expect(solution.rootCount).toBe(2);
    expect(solution.isPerfectSquareDiscriminant).toBe(true);
    expect(solution.roots.map((root) => root.exact)).toEqual([
      { numerator: 2, denominator: 1 },
      { numerator: 3, denominator: 1 },
    ]);
    expect(solution.roots.map((root) => root.approx)).toEqual([2, 3]);
  });

  it('returns reduced fractions when the roots are rational but not integer', () => {
    const solution = solveQuadratic(2, -5, 2);
    expect(solution.discriminant).toBe(9);
    expect(solution.roots.map((root) => root.exact)).toEqual([
      { numerator: 1, denominator: 2 },
      { numerator: 2, denominator: 1 },
    ]);

    const negativeLeading = solveQuadratic(-1, 3, -2);
    expect(negativeLeading.roots.map((root) => root.exact)).toEqual([
      { numerator: 1, denominator: 1 },
      { numerator: 2, denominator: 1 },
    ]);

    const sixth = solveQuadratic(3, -1, 0);
    expect(sixth.roots.map((root) => root.exact)).toEqual([
      { numerator: 0, denominator: 1 },
      { numerator: 1, denominator: 3 },
    ]);
  });

  it('gives exactly one root when D = 0', () => {
    const solution = solveQuadratic(1, -6, 9);
    expect(solution.discriminant).toBe(0);
    expect(solution.rootCount).toBe(1);
    expect(solution.roots).toEqual([{ exact: { numerator: 3, denominator: 1 }, approx: 3 }]);

    const scaled = solveQuadratic(4, 4, 1);
    expect(scaled.discriminant).toBe(0);
    expect(scaled.roots).toEqual([{ exact: { numerator: -1, denominator: 2 }, approx: -0.5 }]);
  });

  it('gives no roots when D < 0', () => {
    const solution = solveQuadratic(1, 1, 1);
    expect(solution.discriminant).toBe(-3);
    expect(solution.rootCount).toBe(0);
    expect(solution.roots).toEqual([]);
    expect(solveQuadratic(2, 0, 5).rootCount).toBe(0);
  });

  it('marks irrational roots as approximate only', () => {
    const solution = solveQuadratic(1, 0, -2);
    expect(solution.discriminant).toBe(8);
    expect(solution.isPerfectSquareDiscriminant).toBe(false);
    expect(solution.rootCount).toBe(2);
    expect(solution.roots.every((root) => root.exact === null)).toBe(true);
    expect(solution.roots[0]!.approx).toBeCloseTo(-Math.SQRT2, 12);
    expect(solution.roots[1]!.approx).toBeCloseTo(Math.SQRT2, 12);
  });

  it('keeps a root pair that float arithmetic would merge into one', () => {
    const solution = solveQuadratic(1, 94906267, 2251799878968822);
    expect(solution.rootCount).toBe(2);
    expect(solution.roots.map((root) => root.exact)).toEqual([
      { numerator: -47453134, denominator: 1 },
      { numerator: -47453133, denominator: 1 },
    ]);
  });

  it('solves the incomplete forms without losing the root x = 0', () => {
    expect(solveQuadratic(1, -4, 0).roots.map((root) => root.approx)).toEqual([0, 4]);
    expect(solveQuadratic(5, 0, -20).roots.map((root) => root.approx)).toEqual([-2, 2]);
    expect(solveQuadratic(7, 0, 0).roots.map((root) => root.approx)).toEqual([0]);
  });
});

describe('evaluating and reshaping the quadratic', () => {
  it('computes values by the Horner scheme', () => {
    expect(evaluateQuadratic(1, -5, 6, 0)).toBe(6);
    expect(evaluateQuadratic(1, -5, 6, 2)).toBe(0);
    expect(evaluateQuadratic(2, -3, -2, -1)).toBe(3);
    expect(evaluateQuadratic(1, 0, 0, 1.5)).toBe(2.25);
    expect(() => evaluateQuadratic(1, 0, 0, Number.NaN)).toThrow('конечным числом');
  });

  it('finds the vertex exactly', () => {
    expect(vertex(1, -6, 9)).toEqual({
      x: { numerator: 3, denominator: 1 },
      y: { numerator: 0, denominator: 1 },
    });
    expect(vertex(1, -5, 6)).toEqual({
      x: { numerator: 5, denominator: 2 },
      y: { numerator: -1, denominator: 4 },
    });
    expect(vertex(-2, 4, 1)).toEqual({
      x: { numerator: 1, denominator: 1 },
      y: { numerator: 3, denominator: 1 },
    });
  });

  it('completes the square as a(x + shift)² + constant', () => {
    expect(completeSquare(1, 6, 5)).toEqual({
      leading: 1,
      shift: { numerator: 3, denominator: 1 },
      constant: { numerator: -4, denominator: 1 },
    });
    expect(completeSquare(1, -5, 6)).toEqual({
      leading: 1,
      shift: { numerator: -5, denominator: 2 },
      constant: { numerator: -1, denominator: 4 },
    });
    expect(completeSquare(2, -4, 5)).toEqual({
      leading: 2,
      shift: { numerator: -1, denominator: 1 },
      constant: { numerator: 3, denominator: 1 },
    });
  });

  it('checks the completed square against the original values', () => {
    const { leading, shift, constant } = completeSquare(2, -4, 5);
    const shiftValue = shift.numerator / shift.denominator;
    const constantValue = constant.numerator / constant.denominator;
    for (const x of [-3, -1, 0, 1, 2.5, 4]) {
      expect(leading * (x + shiftValue) ** 2 + constantValue).toBeCloseTo(evaluateQuadratic(2, -4, 5, x), 12);
    }
  });

  it('classifies complete and incomplete equations', () => {
    expect(quadraticKind(3, 0, 0)).toBe('pure');
    expect(quadraticKind(1, 0, -9)).toBe('no-linear');
    expect(quadraticKind(1, -4, 0)).toBe('no-constant');
    expect(quadraticKind(2, -3, 1)).toBe('full');
    expect(() => quadraticKind(0, 1, 2)).toThrow('не квадратное');
  });
});

describe('Vieta relations', () => {
  it('reads the sum and the product straight from the coefficients', () => {
    expect(vietaSum(1, -7, 12)).toEqual({ numerator: 7, denominator: 1 });
    expect(vietaProduct(1, -7, 12)).toEqual({ numerator: 12, denominator: 1 });
    expect(vietaSum(2, -5, 2)).toEqual({ numerator: 5, denominator: 2 });
    expect(vietaProduct(2, -5, 2)).toEqual({ numerator: 1, denominator: 1 });
  });

  it('agrees with the roots found by the formula', () => {
    const solution = solveQuadratic(2, -5, 2);
    const sum = solution.roots.reduce((total, root) => total + root.approx, 0);
    const product = solution.roots.reduce((total, root) => total * root.approx, 1);
    const expectedSum = vietaSum(2, -5, 2);
    const expectedProduct = vietaProduct(2, -5, 2);
    expect(sum).toBeCloseTo(expectedSum.numerator / expectedSum.denominator, 12);
    expect(product).toBeCloseTo(expectedProduct.numerator / expectedProduct.denominator, 12);
  });

  it('verifies a candidate pair for the monic equation exactly', () => {
    expect(checkVietaPair(-7, 12, 3, 4)).toBe(true);
    expect(checkVietaPair(-7, 12, 4, 3)).toBe(true);
    expect(checkVietaPair(-7, 12, 2, 6)).toBe(false);
    expect(checkVietaPair(5, 6, -2, -3)).toBe(true);
    expect(checkVietaPair(0, -9, -3, 3)).toBe(true);
  });

  it('builds the monic equation back from a pair of roots', () => {
    expect(monicFromRoots(3, 4)).toEqual({ p: -7, q: 12 });
    expect(monicFromRoots(-2, -3)).toEqual({ p: 5, q: 6 });
    expect(monicFromRoots(0, 5)).toEqual({ p: -5, q: 0 });
    expect(monicFromRoots(-4, 4)).toEqual({ p: 0, q: -16 });
  });

  it('lists factor pairs of q ordered by their sum', () => {
    expect(factorPairs(12)).toEqual([
      { first: -12, second: -1, sum: -13 },
      { first: -6, second: -2, sum: -8 },
      { first: -4, second: -3, sum: -7 },
      { first: 3, second: 4, sum: 7 },
      { first: 2, second: 6, sum: 8 },
      { first: 1, second: 12, sum: 13 },
    ]);
    expect(factorPairs(-6)).toEqual([
      { first: -6, second: 1, sum: -5 },
      { first: -3, second: 2, sum: -1 },
      { first: -2, second: 3, sum: 1 },
      { first: -1, second: 6, sum: 5 },
    ]);
    expect(factorPairs(-4)).toEqual([
      { first: -4, second: 1, sum: -3 },
      { first: -2, second: 2, sum: 0 },
      { first: -1, second: 4, sum: 3 },
    ]);
    expect(factorPairs(9)).toEqual([
      { first: -9, second: -1, sum: -10 },
      { first: -3, second: -3, sum: -6 },
      { first: 3, second: 3, sum: 6 },
      { first: 1, second: 9, sum: 10 },
    ]);
    expect(() => factorPairs(0)).toThrow('не может быть равен нулю');
  });

  it('finds an integer root pair only when one really exists', () => {
    expect(integerRootPair(-7, 12)).toEqual([3, 4]);
    expect(integerRootPair(5, 6)).toEqual([-3, -2]);
    expect(integerRootPair(-6, 9)).toEqual([3, 3]);
    expect(integerRootPair(-5, 0)).toEqual([0, 5]);
    expect(integerRootPair(0, 1)).toBeNull();
    expect(integerRootPair(1, -1)).toBeNull();
    expect(integerRootPair(-1, -1)).toBeNull();
  });
});

describe('formatting for the lessons and labs', () => {
  it('writes rational values the Russian way', () => {
    expect(formatRational({ numerator: 4, denominator: 1 })).toBe('4');
    expect(formatRational({ numerator: -3, denominator: 2 })).toBe('−1,5');
    expect(formatRational({ numerator: 1, denominator: 4 })).toBe('0,25');
    expect(formatRational({ numerator: -1, denominator: 3 })).toBe('−1/3');
    expect(formatRational({ numerator: 6, denominator: 3 })).toBe('2');
    expect(() => formatRational({ numerator: 1, denominator: 0 })).toThrow('не может быть равен нулю');
  });

  it('rounds approximations and trims trailing zeros', () => {
    expect(formatApproximate(Math.SQRT2)).toBe('1,41');
    expect(formatApproximate(-Math.SQRT2)).toBe('−1,41');
    expect(formatApproximate(2.5)).toBe('2,5');
    expect(formatApproximate(3)).toBe('3');
    expect(formatApproximate(-0.001)).toBe('0');
    expect(formatApproximate(Math.PI, 4)).toBe('3,1416');
    expect(() => formatApproximate(Number.POSITIVE_INFINITY)).toThrow('конечным числом');
  });

  it('describes exact roots as fractions and irrational roots with ≈', () => {
    const rational = solveQuadratic(2, -5, 2);
    expect(rational.roots.map((root) => describeRoot(root))).toEqual(['0,5', '2']);
    const irrational = solveQuadratic(1, 0, -2);
    expect(irrational.roots.map((root) => describeRoot(root))).toEqual(['≈ −1,41', '≈ 1,41']);
  });
});

describe('parabola segments inside a window', () => {
  const box = { xMin: -3, xMax: 3, yMin: -1, yMax: 4 };

  it('clips y = x² to a single arc touching the top of the window', () => {
    const segments = parabolaSegments(1, 0, 0, box);
    expect(segments).toHaveLength(1);
    const arc = segments[0]!;
    expect(arc[0]!.x).toBeCloseTo(-2, 6);
    expect(arc[arc.length - 1]!.x).toBeCloseTo(2, 6);
    expect(Math.min(...arc.map((point) => point.y))).toBeCloseTo(0, 6);
    expect(Math.max(...arc.map((point) => point.y))).toBeLessThanOrEqual(4);
  });

  it('splits the curve into two branches when the vertex is below the window', () => {
    const segments = parabolaSegments(1, 0, -5, box);
    expect(segments).toHaveLength(2);
    expect(segments[0]![0]!.x).toBeCloseTo(-3, 6);
    expect(segments[0]![segments[0]!.length - 1]!.x).toBeCloseTo(-2, 6);
    expect(segments[1]![0]!.x).toBeCloseTo(2, 6);
    expect(segments[1]![segments[1]!.length - 1]!.x).toBeCloseTo(3, 6);
  });

  it('returns nothing when the parabola misses the window', () => {
    expect(parabolaSegments(1, 0, 10, box)).toEqual([]);
  });

  it('keeps every returned point inside the window', () => {
    for (const [a, b, c] of [[1, -5, 6], [-2, 4, 1], [3, 0, -4]] as const) {
      for (const segment of parabolaSegments(a, b, c, box)) {
        for (const point of segment) {
          expect(point.y).toBeGreaterThanOrEqual(box.yMin - 1e-9);
          expect(point.y).toBeLessThanOrEqual(box.yMax + 1e-9);
          expect(point.x).toBeGreaterThanOrEqual(box.xMin - 1e-9);
          expect(point.x).toBeLessThanOrEqual(box.xMax + 1e-9);
        }
      }
    }
  });

  it('rejects a degenerate window or an impossible sample count', () => {
    expect(() => parabolaSegments(1, 0, 0, { xMin: 1, xMax: 1, yMin: -1, yMax: 1 })).toThrow('положительные');
    expect(() => parabolaSegments(1, 0, 0, box, 1)).toThrow('от 2 до 4001');
  });
});
