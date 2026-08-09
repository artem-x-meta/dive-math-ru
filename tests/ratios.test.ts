import { describe, expect, it } from 'vitest';
import {
  compatibleUnits,
  convertQuantity,
  equivalentRatios,
  normalizePartToWholeRatio,
  normalizeQuantityRatio,
  normalizeRatio,
  solveProportion,
} from '../src/lib/ratios';

describe('ratio normalization', () => {
  it('reduces ratios by their greatest common divisor', () => {
    expect(normalizeRatio(18, 24)).toEqual({ first: 3, second: 4 });
    expect(normalizeRatio({ first: 150, second: 90 })).toEqual({ first: 5, second: 3 });
  });

  it('uses one canonical place for the sign', () => {
    expect(normalizeRatio(-6, 8)).toEqual({ first: -3, second: 4 });
    expect(normalizeRatio(6, -8)).toEqual({ first: -3, second: 4 });
    expect(normalizeRatio(-6, -8)).toEqual({ first: 3, second: 4 });
  });

  it('allows a zero numerator and rejects a zero denominator', () => {
    expect(normalizeRatio(0, 12)).toEqual({ first: 0, second: 1 });
    expect(normalizeRatio(0, -12)).toEqual({ first: 0, second: 1 });
    expect(() => normalizeRatio(12, 0)).toThrow('не может быть равен нулю');
    expect(() => normalizeRatio(-12, 0)).toThrow('не может быть равен нулю');
  });

  it('rejects the indeterminate ratio and unsafe inputs', () => {
    expect(() => normalizeRatio(0, 0)).toThrow('0 : 0');
    expect(() => normalizeRatio(1.5, 2)).toThrow('безопасным целым');
    expect(() => normalizeRatio(Number.MAX_SAFE_INTEGER + 1, 2)).toThrow('безопасным целым');
  });
});

describe('ratio equivalence', () => {
  it('recognizes equivalent ratios with different signs and scales', () => {
    expect(equivalentRatios(2, 3, 10, 15)).toBe(true);
    expect(equivalentRatios({ first: -2, second: 3 }, { first: 10, second: -15 })).toBe(true);
    expect(equivalentRatios(2, 3, 10, 14)).toBe(false);
  });

  it('compares near-limit products exactly', () => {
    const largest = Number.MAX_SAFE_INTEGER;
    expect(equivalentRatios(largest, largest - 1, largest, largest - 1)).toBe(true);
    expect(equivalentRatios(largest, largest - 1, largest - 1, largest)).toBe(false);
  });

  it('rejects undefined ratios', () => {
    expect(() => equivalentRatios(0, 0, 1, 2)).toThrow('0 : 0');
    expect(() => equivalentRatios(1, 0, 1, 2)).toThrow('не может быть равен нулю');
  });
});

describe('exact proportion solving', () => {
  it('solves each of the four possible unknown positions', () => {
    expect(solveProportion(null, 3, 8, 12)).toEqual({ unknownIndex: 0, value: { numerator: 2, denominator: 1 } });
    expect(solveProportion(2, null, 8, 12)).toEqual({ unknownIndex: 1, value: { numerator: 3, denominator: 1 } });
    expect(solveProportion(2, 3, null, 12)).toEqual({ unknownIndex: 2, value: { numerator: 8, denominator: 1 } });
    expect(solveProportion(2, 3, 8, null)).toEqual({ unknownIndex: 3, value: { numerator: 12, denominator: 1 } });
  });

  it('returns a reduced exact fraction when the answer is not an integer', () => {
    expect(solveProportion(3, 5, 10, null)).toEqual({
      unknownIndex: 3,
      value: { numerator: 50, denominator: 3 },
    });
    expect(solveProportion(-3, 5, 6, null).value).toEqual({ numerator: -10, denominator: 1 });
  });

  it('requires exactly one unknown and valid ratio denominators', () => {
    expect(() => solveProportion(2, 3, 4, 6)).toThrow('ровно один');
    expect(() => solveProportion(null, null, 4, 6)).toThrow('ровно один');
    expect(() => solveProportion(2, 0, 4, null)).toThrow('не может быть равен нулю');
    expect(() => solveProportion(0, null, 5, 2)).toThrow('не может быть равен нулю');
    expect(() => solveProportion(0, 3, 0, null)).toThrow('единственного решения');
  });

  it('rejects unsafe inputs and unsafe exact results', () => {
    expect(() => solveProportion(1.5, 2, 3, null)).toThrow('безопасным целым');
    expect(() => solveProportion(1, Number.MAX_SAFE_INTEGER, 2, null)).toThrow('диапазон');
  });
});

describe('quantities and units', () => {
  it('detects compatible and incompatible units', () => {
    expect(compatibleUnits('cm', 'm')).toBe(true);
    expect(compatibleUnits('g', 'kg')).toBe(true);
    expect(compatibleUnits('piece', 'cm')).toBe(false);
  });

  it('converts quantities exactly, including fractional results', () => {
    expect(convertQuantity(2, 'm', 'cm')).toEqual({ numerator: 200, denominator: 1 });
    expect(convertQuantity(25, 'cm', 'm')).toEqual({ numerator: 1, denominator: 4 });
    expect(convertQuantity(-3, 'kg', 'g')).toEqual({ numerator: -3_000, denominator: 1 });
    expect(convertQuantity(1.5, 'kg', 'g')).toEqual({ numerator: 1_500, denominator: 1 });
  });

  it('normalizes measured part-to-part and part-to-whole ratios', () => {
    expect(normalizeQuantityRatio(
      { value: 2, unit: 'm' },
      { value: 50, unit: 'cm' },
    )).toEqual({ first: 4, second: 1 });
    expect(normalizePartToWholeRatio(
      { value: 2, unit: 'm' },
      { value: 50, unit: 'cm' },
    )).toEqual({ first: 4, second: 5 });
    expect(normalizeQuantityRatio(
      { value: 1.5, unit: 'kg' },
      { value: 600, unit: 'g' },
    )).toEqual({ first: 5, second: 2 });
    expect(normalizePartToWholeRatio(
      { value: 1.5, unit: 'kg' },
      { value: 500, unit: 'g' },
    )).toEqual({ first: 3, second: 4 });
  });

  it('rejects incompatible dimensions and unsafe converted results', () => {
    expect(() => convertQuantity(2, 'piece', 'cm')).toThrow('разных видов');
    expect(() => normalizeQuantityRatio(
      { value: 2, unit: 'kg' },
      { value: 50, unit: 'cm' },
    )).toThrow('одного вида');
    expect(() => convertQuantity(Number.MAX_SAFE_INTEGER, 'km', 'mm')).toThrow('диапазон');
    expect(() => normalizePartToWholeRatio(
      { value: -1, unit: 'kg' },
      { value: 2, unit: 'kg' },
    )).toThrow('не могут быть отрицательными');
  });
});
