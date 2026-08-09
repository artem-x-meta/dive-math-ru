import { describe, expect, it } from 'vitest';
import {
  absoluteValue,
  addSigned,
  compareSigned,
  divideSigned,
  formatRussianNumber,
  fromHalfTicks,
  isHalfStepGridValue,
  isHalfStepNumber,
  multiplySigned,
  normalizeSignedZero,
  normalizeHalfStepRange,
  opposite,
  parseSignedDraft,
  quadrantOf,
  quantizeHalfStep,
  reflectPoint,
  subtractSigned,
  toHalfTicks,
  translatePoint,
} from '../src/lib/signedNumbers';

describe('signed values', () => {
  it('normalizes negative zero in every elementary unary operation', () => {
    expect(Object.is(normalizeSignedZero(-0), -0)).toBe(false);
    expect(Object.is(opposite(0), -0)).toBe(false);
    expect(Object.is(absoluteValue(-0), -0)).toBe(false);
  });

  it('makes opposite and absolute-value invariants explicit', () => {
    for (const value of [-12.5, -1, 0, 3.5, 14]) {
      expect(opposite(opposite(value))).toBe(value);
      expect(absoluteValue(value)).toBeGreaterThanOrEqual(0);
      expect(absoluteValue(opposite(value))).toBe(absoluteValue(value));
    }
  });

  it('compares signed decimals without subtraction drift', () => {
    expect(compareSigned(-5, -2)).toBe(-1);
    expect(compareSigned(-0, 0)).toBe(0);
    expect(compareSigned(0.1 + 0.2, 0.3)).toBe(1);
    expect(compareSigned(7.5, 7.5)).toBe(0);
  });

  it('rejects non-finite and unsafe unary inputs', () => {
    expect(() => opposite(Number.NaN)).toThrow('конечным');
    expect(() => absoluteValue(Number.POSITIVE_INFINITY)).toThrow('конечным');
    expect(() => normalizeSignedZero(Number.MAX_VALUE)).toThrow('безопасный');
  });
});

describe('exact arithmetic', () => {
  it('adds and subtracts decimal values without school-decimal drift', () => {
    expect(addSigned(0.1, 0.2)).toBe(0.3);
    expect(addSigned(-2.5, 4)).toBe(1.5);
    expect(subtractSigned(3.5, -1.5)).toBe(5);
    expect(subtractSigned(-4, -4)).toBe(0);
    expect(addSigned(Number.MIN_VALUE, Number.MIN_VALUE)).toBe(1e-323);
  });

  it('satisfies the subtraction-as-addition identity', () => {
    for (const [a, b] of [[7, 3], [7, -3], [-2.5, 4], [0, -0.5]]) {
      expect(subtractSigned(a, b)).toBe(addSigned(a, opposite(b)));
    }
  });

  it('multiplies and divides with the correct sign', () => {
    expect(multiplySigned(-2.5, -4)).toBe(10);
    expect(multiplySigned(-2.5, 4)).toBe(-10);
    expect(multiplySigned(0.1, 0.2)).toBe(0.02);
    expect(divideSigned(-15, -3)).toBe(5);
    expect(divideSigned(1, 2)).toBe(0.5);
  });

  it('normalizes zero results and rejects division by zero', () => {
    expect(Object.is(multiplySigned(-7, 0), -0)).toBe(false);
    expect(Object.is(divideSigned(-0, 3), -0)).toBe(false);
    expect(() => divideSigned(4, 0)).toThrow('Делить на ноль нельзя');
    expect(() => divideSigned(4, -0)).toThrow('Делить на ноль нельзя');
  });

  it('rejects overflow and invalid operands', () => {
    expect(() => addSigned(Number.MAX_SAFE_INTEGER, 1)).toThrow('безопасный');
    expect(() => multiplySigned(Number.MAX_SAFE_INTEGER, 2)).toThrow('безопасный');
    expect(divideSigned(Number.MIN_VALUE, 2)).toBe(Number.MIN_VALUE);
    expect(() => addSigned(Number.NaN, 1)).toThrow('конечным');
  });
});

describe('coordinate geometry', () => {
  it('classifies four quadrants and gives axes no quadrant', () => {
    expect(quadrantOf(2, 3)).toBe(1);
    expect(quadrantOf({ x: -2, y: 3 })).toBe(2);
    expect(quadrantOf(-2, -3)).toBe(3);
    expect(quadrantOf(2, -3)).toBe(4);
    expect(quadrantOf(0, 3)).toBeNull();
    expect(quadrantOf(-2, 0)).toBeNull();
    expect(quadrantOf(-0, -0)).toBeNull();
  });

  it('reflects points over each axis and reflection twice restores the point', () => {
    const point = { x: -2.5, y: 4 } as const;
    expect(reflectPoint(point, 'x')).toEqual({ x: -2.5, y: -4 });
    expect(reflectPoint(point, 'y')).toEqual({ x: 2.5, y: 4 });
    expect(reflectPoint(point, 'origin')).toEqual({ x: 2.5, y: -4 });

    for (const axis of ['x', 'y', 'origin'] as const) {
      expect(reflectPoint(reflectPoint(point, axis), axis)).toEqual(point);
    }
  });

  it('translates points using every supported call shape', () => {
    expect(translatePoint({ x: 1.5, y: -2 }, { dx: -3, dy: 4.5 })).toEqual({ x: -1.5, y: 2.5 });
    expect(translatePoint({ x: 1.5, y: -2 }, -3, 4.5)).toEqual({ x: -1.5, y: 2.5 });
    expect(translatePoint(1.5, -2, -3, 4.5)).toEqual({ x: -1.5, y: 2.5 });
  });

  it('validates coordinates, axes and displacement', () => {
    expect(() => quadrantOf(1, Number.NaN)).toThrow('конечным');
    expect(() => reflectPoint({ x: 1, y: 2 }, 'z' as 'x')).toThrow('Неизвестная');
    expect(() => translatePoint({ x: 1, y: 2 }, 3, Number.POSITIVE_INFINITY)).toThrow('конечным');
  });
});

describe('half-step grid and editable drafts', () => {
  it('converts half-integers to integer ticks and back exactly', () => {
    for (const value of [-10, -2.5, -0.5, 0, 4.5, 12]) {
      expect(fromHalfTicks(toHalfTicks(value))).toBe(value);
    }
    expect(isHalfStepNumber(2.5)).toBe(true);
    expect(isHalfStepNumber(2.25)).toBe(false);
    expect(() => toHalfTicks(2.25)).toThrow('полуцелым');
    expect(() => fromHalfTicks(1.5)).toThrow('безопасным целым');
  });

  it('quantizes entirely on integer half-ticks', () => {
    expect(quantizeHalfStep(3.5, 1)).toBe(4);
    expect(quantizeHalfStep(-3.5, 1)).toBe(-3);
    expect(quantizeHalfStep(-4.5, 2)).toBe(-4);
    expect(quantizeHalfStep(2.5, 0.5)).toBe(2.5);
    expect(() => quantizeHalfStep(2.5, 0)).toThrow('положительным');
    expect(() => quantizeHalfStep(2.25, 0.5)).toThrow('полуцелым');
  });

  it('normalizes lab ranges to endpoints reachable from the zero-anchored grid', () => {
    const aligned = normalizeHalfStepRange(-9.5, 10.5, 2, {
      defaultMinimum: -10,
      defaultMaximum: 10,
    });
    expect(aligned).toEqual({ minimum: -8, maximum: 10, step: 2 });
    expect(isHalfStepGridValue(aligned.minimum, aligned.step)).toBe(true);
    expect(isHalfStepGridValue(aligned.maximum, aligned.step)).toBe(true);

    const narrowAtHardEdge = normalizeHalfStepRange(29, 30, 4, {
      defaultMinimum: -10,
      defaultMaximum: 10,
      hardMinimum: -30,
      hardMaximum: 30,
    });
    expect(narrowAtHardEdge).toEqual({ minimum: 29, maximum: 30, step: 0.5 });
  });

  it('can guarantee visible grid values on both sides of zero', () => {
    const range = normalizeHalfStepRange(2, 5, 2, {
      defaultMinimum: -6,
      defaultMaximum: 6,
      includeValuesAroundZero: true,
    });
    expect(range).toEqual({ minimum: -2, maximum: 4, step: 2 });
    expect(isHalfStepGridValue(0, range.step)).toBe(true);
    expect(isHalfStepGridValue(1, range.step)).toBe(false);
    expect(isHalfStepGridValue(2.25, 0.5)).toBe(false);
    expect(isHalfStepGridValue(2, 0)).toBe(false);
  });

  it('accepts comma decimals and keeps intermediate negative drafts representable', () => {
    expect(parseSignedDraft('-')).toBeNull();
    expect(parseSignedDraft('-0,')).toBe(0);
    expect(parseSignedDraft('-0,5')).toBe(-0.5);
    expect(parseSignedDraft(' +3.5 ')).toBe(3.5);
    expect(parseSignedDraft(',5')).toBe(0.5);
    expect(parseSignedDraft('1,2,3')).toBeNull();
    expect(parseSignedDraft('Infinity')).toBeNull();
    expect(formatRussianNumber(-0)).toBe('0');
    expect(formatRussianNumber(-2.5)).toBe('−2,5');
  });
});
