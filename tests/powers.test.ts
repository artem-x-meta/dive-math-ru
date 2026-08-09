import { describe, expect, it } from 'vitest';
import { formatExactRussian, parseExact } from '../src/lib/exactRational';
import {
  applyPowerRule,
  checkPowerRule,
  decimalDivisionSteps,
  decimalExpansion,
  expandPower,
  formatDecimalExpansion,
  fromStandardForm,
  isStandardMantissa,
  isTerminatingDecimal,
  periodLength,
  powerExact,
  powerSign,
  powerTable,
  roundExact,
  roundingError,
  terminatingCheck,
  toStandardForm,
} from '../src/lib/powers';

const show = (value: Parameters<typeof formatExactRussian>[0]) => formatExactRussian(value);

describe('powerExact', () => {
  it('multiplies the base by itself the stated number of times', () => {
    expect(show(powerExact(2, 10))).toBe('1024');
    expect(show(powerExact(3, 4))).toBe('81');
    expect(show(powerExact(10, 6))).toBe('1000000');
  });

  it('keeps fractional and negative bases exact', () => {
    expect(powerExact('2/3', 3)).toEqual({ numerator: 8n, denominator: 27n });
    expect(show(powerExact('0,1', 3))).toBe('0,001');
    expect(show(powerExact(-2, 5))).toBe('−32');
    expect(show(powerExact(-3, 2))).toBe('9');
  });

  it('treats the zero exponent and the zero base by definition', () => {
    expect(show(powerExact(7, 0))).toBe('1');
    expect(show(powerExact('-4/5', 0))).toBe('1');
    expect(show(powerExact(0, 5))).toBe('0');
    expect(() => powerExact(0, 0)).toThrow('0^0');
  });

  it('rejects exponents that are not natural and results that are too long', () => {
    expect(() => powerExact(2, -1)).toThrow('целым числом');
    expect(() => powerExact(2, 1.5)).toThrow('целым числом');
    expect(() => powerExact(2, 100_000)).toThrow('не должен превышать');
    expect(() => powerExact(12_345, 400)).toThrow('длиннее');
    expect(show(powerExact(10, 500)).length).toBe(501);
  });
});

describe('sign of a power', () => {
  it('explains the sign without computing the value', () => {
    expect(powerSign(-2, 4)).toEqual({ sign: 1, reason: 'even-exponent' });
    expect(powerSign(-2, 5)).toEqual({ sign: -1, reason: 'odd-exponent' });
    expect(powerSign('3/4', 7)).toEqual({ sign: 1, reason: 'positive-base' });
    expect(powerSign(0, 3)).toEqual({ sign: 0, reason: 'zero-base' });
    expect(powerSign(-9, 0)).toEqual({ sign: 1, reason: 'zero-exponent' });
    expect(() => powerSign(0, 0)).toThrow('0^0');
  });
});

describe('expanded notation', () => {
  it('writes a power as a product of equal factors', () => {
    expect(expandPower('3', 4)).toBe('3 · 3 · 3 · 3');
    expect(expandPower('a', 2)).toBe('a · a');
  });

  it('brackets bases that are not a single positive number or letter', () => {
    expect(expandPower('-2', 3)).toBe('(-2) · (-2) · (-2)');
    expect(expandPower('0,5', 2)).toBe('(0,5) · (0,5)');
  });

  it('refuses an empty product and an unreadable one', () => {
    expect(() => expandPower('3', 0)).toThrow('не меньше 1');
    expect(() => expandPower('3', 25)).toThrow('не больше 24');
  });
});

describe('rules for powers with equal bases', () => {
  it('adds, subtracts and multiplies exponents', () => {
    expect(applyPowerRule('product', 3, 4)).toMatchObject({ resultExponent: 7, factorCount: 7 });
    expect(applyPowerRule('quotient', 7, 3)).toMatchObject({ resultExponent: 4 });
    expect(applyPowerRule('power-of-power', 3, 4)).toMatchObject({ resultExponent: 12, factorCount: 12 });
  });

  it('builds a readable equality', () => {
    expect(applyPowerRule('product', 2, 5, 'x').latex).toBe('x^{2} \\cdot x^{5} = x^{7}');
    expect(applyPowerRule('power-of-power', 2, 3).latex).toBe('\\left(a^{2}\\right)^{3} = a^{6}');
  });

  it('keeps the quotient exponent non-negative', () => {
    expect(applyPowerRule('quotient', 5, 5).resultExponent).toBe(0);
    expect(() => applyPowerRule('quotient', 3, 7)).toThrow('m ≥ n');
  });

  it('confirms every rule by a second, independent computation', () => {
    const product = checkPowerRule('product', 2, 3, 4);
    expect(product.matches).toBe(true);
    expect(show(product.ruleValue)).toBe('128');
    expect(show(product.directValue)).toBe('128');

    const quotient = checkPowerRule('quotient', '2/3', 5, 2);
    expect(quotient.matches).toBe(true);
    expect(quotient.ruleValue).toEqual({ numerator: 8n, denominator: 27n });

    const tower = checkPowerRule('power-of-power', -2, 2, 3);
    expect(tower.matches).toBe(true);
    expect(tower.rightValue).toBeNull();
    expect(show(tower.ruleValue)).toBe('64');
  });

  it('does not divide powers of zero', () => {
    expect(() => checkPowerRule('quotient', 0, 3, 2)).toThrow('отличного от нуля');
  });
});

describe('power table', () => {
  it('lists the growth step by step', () => {
    expect(powerTable(2, 5).map((row) => show(row.value))).toEqual(['2', '4', '8', '16', '32']);
    expect(powerTable('1/2', 3).map((row) => show(row.value))).toEqual(['0,5', '0,25', '0,125']);
  });

  it('refuses a table that would not fit on screen', () => {
    expect(() => powerTable(2, 40)).toThrow('не более чем до показателя');
  });
});

describe('standard form', () => {
  it('splits a number into a mantissa between 1 and 10 and a power of ten', () => {
    const light = toStandardForm(149_600_000);
    expect(light.exponent).toBe(8);
    expect(show(light.mantissa)).toBe('1,496');

    const small = toStandardForm('0,00042');
    expect(small.exponent).toBe(-4);
    expect(show(small.mantissa)).toBe('4,2');

    const negative = toStandardForm(-2500);
    expect(negative.exponent).toBe(3);
    expect(show(negative.mantissa)).toBe('−2,5');

    expect(toStandardForm(7)).toMatchObject({ exponent: 0 });
    expect(toStandardForm('1/3').exponent).toBe(-1);
    expect(toStandardForm('1/3').mantissa).toEqual({ numerator: 10n, denominator: 3n });
  });

  it('restores the ordinary notation', () => {
    expect(show(fromStandardForm({ mantissa: parseExact('1,496'), exponent: 8 }))).toBe('149600000');
    expect(show(fromStandardForm({ mantissa: parseExact('4,2'), exponent: -4 }))).toBe('0,00042');
    expect(show(fromStandardForm(toStandardForm('0,000305')))).toBe('0,000305');
  });

  it('recognizes a valid mantissa', () => {
    expect(isStandardMantissa(1)).toBe(true);
    expect(isStandardMantissa('9,99')).toBe(true);
    expect(isStandardMantissa(-3)).toBe(true);
    expect(isStandardMantissa(10)).toBe(false);
    expect(isStandardMantissa('0,5')).toBe(false);
    expect(isStandardMantissa(0)).toBe(false);
  });

  it('has no standard form for zero', () => {
    expect(() => toStandardForm(0)).toThrow('нет стандартного вида');
  });
});

describe('decimal expansion', () => {
  it('finds terminating decimals', () => {
    expect(decimalExpansion('7/8')).toEqual({
      negative: false,
      integerPart: '0',
      nonRepeating: '875',
      repeating: '',
      terminating: true,
    });
    expect(formatDecimalExpansion(decimalExpansion('13/25'))).toBe('0,52');
    expect(formatDecimalExpansion(decimalExpansion(6))).toBe('6');
  });

  it('finds the period of an infinite decimal', () => {
    expect(formatDecimalExpansion(decimalExpansion('5/12'))).toBe('0,41(6)');
    expect(formatDecimalExpansion(decimalExpansion('1/3'))).toBe('0,(3)');
    expect(formatDecimalExpansion(decimalExpansion('2/7'))).toBe('0,(285714)');
    expect(formatDecimalExpansion(decimalExpansion('9/22'))).toBe('0,4(09)');
    expect(formatDecimalExpansion(decimalExpansion('10/21'))).toBe('0,(476190)');
    expect(formatDecimalExpansion(decimalExpansion('-11/6'))).toBe('−1,8(3)');
  });

  it('separates terminating denominators from the rest', () => {
    expect(isTerminatingDecimal('3/40')).toBe(true);
    expect(isTerminatingDecimal('13/25')).toBe(true);
    expect(isTerminatingDecimal(5)).toBe(true);
    expect(isTerminatingDecimal('5/12')).toBe(false);
    expect(isTerminatingDecimal('7/30')).toBe(false);
  });

  it('splits the reduced denominator into twos, fives and the rest', () => {
    expect(terminatingCheck('3/40')).toEqual({ denominator: 40, twos: 3, fives: 1, otherFactor: 1, terminating: true });
    expect(terminatingCheck('5/12')).toEqual({ denominator: 12, twos: 2, fives: 0, otherFactor: 3, terminating: false });
    // 6/15 сокращается до 2/5, поэтому знаменатель здесь именно 5.
    expect(terminatingCheck('6/15')).toEqual({ denominator: 5, twos: 0, fives: 1, otherFactor: 1, terminating: true });
    expect(terminatingCheck(4)).toEqual({ denominator: 1, twos: 0, fives: 0, otherFactor: 1, terminating: true });
  });

  it('measures the period', () => {
    expect(periodLength('1/7')).toBe(6);
    expect(periodLength('7/30')).toBe(1);
    expect(periodLength('7/8')).toBe(0);
  });

  it('refuses denominators that make the search too long', () => {
    expect(() => decimalExpansion({ numerator: 1n, denominator: 1_000_003n })).toThrow('Период');
  });
});

describe('long division steps', () => {
  it('stops when the remainder becomes zero', () => {
    const division = decimalDivisionSteps('7/8');
    expect(division.steps.map((step) => step.digit)).toEqual([8, 7, 5]);
    expect(division.steps.map((step) => step.remainderBefore)).toEqual([7, 6, 4]);
    expect(division).toMatchObject({ integerPart: '0', terminating: true, repeatStart: null, truncated: false });
  });

  it('marks the step where a remainder comes back', () => {
    const division = decimalDivisionSteps('5/12');
    expect(division.steps.map((step) => step.digit)).toEqual([4, 1, 6]);
    expect(division.steps.map((step) => step.remainderAfter)).toEqual([2, 8, 8]);
    expect(division).toMatchObject({ repeatStart: 2, terminating: false, truncated: false });
  });

  it('reports an interrupted division honestly', () => {
    const division = decimalDivisionSteps('1/7', 3);
    expect(division.steps).toHaveLength(3);
    expect(division).toMatchObject({ repeatStart: null, terminating: false, truncated: true });
    expect(() => decimalDivisionSteps('1/7', 0)).toThrow('целым и положительным');
  });

  it('keeps the sign and the integer part', () => {
    expect(decimalDivisionSteps('-11/6')).toMatchObject({ negative: true, integerPart: '1', repeatStart: 1 });
  });
});

describe('rounding', () => {
  it('rounds half away from zero', () => {
    expect(show(roundExact('1/3', 2))).toBe('0,33');
    expect(show(roundExact('2/3', 2))).toBe('0,67');
    expect(show(roundExact('-2/3', 2))).toBe('−0,67');
    expect(show(roundExact('1/8', 2))).toBe('0,13');
    expect(show(roundExact('1/3', 0))).toBe('0');
    expect(show(roundExact('5/6', 0))).toBe('1');
  });

  it('reports how much the rounding lost', () => {
    expect(roundingError('1/3', 2)).toEqual({ numerator: 1n, denominator: 300n });
    expect(roundingError('1/4', 2)).toEqual({ numerator: 0n, denominator: 1n });
  });

  it('rejects an impossible precision', () => {
    expect(() => roundExact('1/3', -1)).toThrow('от 0 до 30');
    expect(() => roundExact('1/3', 99)).toThrow('от 0 до 30');
  });
});
