import { describe, expect, it } from 'vitest';
import {
  addRadicals,
  bracketSquareRoot,
  compareRadicals,
  estimateSquareRoot,
  exactSquareRoot,
  formatDecimalRussian,
  formatRadical,
  integerSquareRoot,
  isPerfectSquare,
  makeRadical,
  multiplyRadicals,
  pairPrimeFactors,
  radicalToSquareRoot,
  rationalizeDenominator,
  roundSquareRoot,
  simplifyRadical,
  squareRootOfSquare,
} from '../src/lib/roots';

describe('целый квадратный корень', () => {
  it('узнаёт точные квадраты', () => {
    expect(isPerfectSquare(0)).toBe(true);
    expect(isPerfectSquare(1)).toBe(true);
    expect(isPerfectSquare(144)).toBe(true);
    expect(isPerfectSquare(1_000_000)).toBe(true);
    expect(isPerfectSquare(2)).toBe(false);
    expect(isPerfectSquare(999_999_999)).toBe(false);
  });

  it('находит целую часть корня без ошибок округления', () => {
    expect(integerSquareRoot(0)).toBe(0);
    expect(integerSquareRoot(50)).toBe(7);
    expect(integerSquareRoot(99)).toBe(9);
    expect(integerSquareRoot(100)).toBe(10);
    expect(integerSquareRoot(999_999_999)).toBe(31_622);
    expect(integerSquareRoot(1_000_000_000)).toBe(31_622);
  });

  it('зажимает корень между соседними целыми', () => {
    expect(bracketSquareRoot(50)).toEqual({ lower: 7, upper: 8, exact: false });
    expect(bracketSquareRoot(49)).toEqual({ lower: 7, upper: 7, exact: true });
    expect(bracketSquareRoot(2)).toEqual({ lower: 1, upper: 2, exact: false });
    expect(bracketSquareRoot(0)).toEqual({ lower: 0, upper: 0, exact: true });
  });

  it('отклоняет некорректные подкоренные числа', () => {
    expect(() => integerSquareRoot(-4)).toThrow('не может быть отрицательным');
    expect(() => integerSquareRoot(2.5)).toThrow('целым числом');
    expect(() => integerSquareRoot(2_000_000_000)).toThrow('не должно превышать');
  });
});

describe('десятичный зажим корня', () => {
  it('уточняет корень из двух знак за знаком', () => {
    expect(estimateSquareRoot(2, 0)).toEqual({
      digits: 0, lower: '1', upper: '2', lowerSquare: '1', upperSquare: '4', exact: false,
    });
    expect(estimateSquareRoot(2, 1)).toEqual({
      digits: 1, lower: '1.4', upper: '1.5', lowerSquare: '1.96', upperSquare: '2.25', exact: false,
    });
    expect(estimateSquareRoot(2, 2)).toEqual({
      digits: 2, lower: '1.41', upper: '1.42', lowerSquare: '1.9881', upperSquare: '2.0164', exact: false,
    });
    expect(estimateSquareRoot(2, 5).lower).toBe('1.41421');
    expect(estimateSquareRoot(2, 8).lower).toBe('1.41421356');
  });

  it('сохраняет ведущие и хвостовые нули в разрядной записи', () => {
    expect(estimateSquareRoot(0.5, 2).lower).toBe('0.70');
    expect(estimateSquareRoot(0.5, 2).upper).toBe('0.71');
    expect(estimateSquareRoot(1, 3)).toEqual({
      digits: 3, lower: '1.000', upper: '1.000', lowerSquare: '1.000000', upperSquare: '1.000000', exact: true,
    });
  });

  it('отмечает точное совпадение и работает с десятичным подкоренным числом', () => {
    expect(estimateSquareRoot('2,25', 1)).toEqual({
      digits: 1, lower: '1.5', upper: '1.5', lowerSquare: '2.25', upperSquare: '2.25', exact: true,
    });
    expect(estimateSquareRoot('2,25', 0)).toEqual({
      digits: 0, lower: '1', upper: '2', lowerSquare: '1', upperSquare: '4', exact: false,
    });
    expect(estimateSquareRoot(1_000_000, 2).exact).toBe(true);
  });

  it('даёт границы, квадраты которых окружают подкоренное число', () => {
    for (const value of [2, 3, 5, 7, 10, 17, 50, 99, 123.45]) {
      const estimate = estimateSquareRoot(value, 3);
      expect(Number(estimate.lowerSquare)).toBeLessThanOrEqual(value);
      expect(Number(estimate.upperSquare)).toBeGreaterThanOrEqual(value);
    }
  });

  it('находит точное значение корня или сообщает о его отсутствии', () => {
    expect(exactSquareRoot(16)).toBe('4');
    expect(exactSquareRoot('2,25')).toBe('1.5');
    expect(exactSquareRoot('0,16')).toBe('0.4');
    expect(exactSquareRoot(0)).toBe('0');
    expect(exactSquareRoot(2)).toBeNull();
    expect(exactSquareRoot('2,3')).toBeNull();
  });

  it('округляет корень до нужного разряда', () => {
    expect(roundSquareRoot(2, 0)).toBe('1');
    expect(roundSquareRoot(2, 2)).toBe('1.41');
    expect(roundSquareRoot(3, 2)).toBe('1.73');
    expect(roundSquareRoot(50, 1)).toBe('7.1');
    expect(roundSquareRoot(50, 2)).toBe('7.07');
    expect(roundSquareRoot('2,25', 0)).toBe('2');
    expect(roundSquareRoot(0.5, 3)).toBe('0.707');
  });

  it('проверяет аргументы приближения', () => {
    expect(() => estimateSquareRoot(-2, 2)).toThrow('десятичной записью');
    expect(() => estimateSquareRoot('два', 2)).toThrow('десятичной записью');
    expect(() => estimateSquareRoot(2, 9)).toThrow('от 0 до 8');
    expect(() => estimateSquareRoot('1,1234567', 2)).toThrow('знаков после запятой');
  });

  it('переводит служебную запись в русскую', () => {
    expect(formatDecimalRussian('1.41')).toBe('1,41');
    expect(formatDecimalRussian('7')).toBe('7');
  });
});

describe('вынесение множителя из-под корня', () => {
  it('выносит все квадратные множители', () => {
    expect(simplifyRadical(72)).toEqual({ coefficient: 6, radicand: 2 });
    expect(simplifyRadical(50)).toEqual({ coefficient: 5, radicand: 2 });
    expect(simplifyRadical(48)).toEqual({ coefficient: 4, radicand: 3 });
    expect(simplifyRadical(45)).toEqual({ coefficient: 3, radicand: 5 });
    expect(simplifyRadical(196)).toEqual({ coefficient: 14, radicand: 1 });
    expect(simplifyRadical(7)).toEqual({ coefficient: 1, radicand: 7 });
    expect(simplifyRadical(0)).toEqual({ coefficient: 0, radicand: 1 });
  });

  it('упрощает произведение множителя и корня', () => {
    expect(makeRadical(3, 8)).toEqual({ coefficient: 6, radicand: 2 });
    expect(makeRadical(-2, 18)).toEqual({ coefficient: -6, radicand: 2 });
    expect(makeRadical(5, 0)).toEqual({ coefficient: 0, radicand: 1 });
  });

  it('вносит множитель под корень', () => {
    expect(radicalToSquareRoot({ coefficient: 6, radicand: 2 })).toBe(72);
    expect(radicalToSquareRoot({ coefficient: 3, radicand: 1 })).toBe(9);
    expect(radicalToSquareRoot({ coefficient: 0, radicand: 5 })).toBe(0);
    expect(() => radicalToSquareRoot({ coefficient: -3, radicand: 2 })).toThrow('неотрицательный множитель');
  });

  it('разбивает простые множители на пары и одиночки', () => {
    expect(pairPrimeFactors(72)).toEqual({ extracted: [2, 3], remaining: [2] });
    expect(pairPrimeFactors(48)).toEqual({ extracted: [2, 2], remaining: [3] });
    expect(pairPrimeFactors(7)).toEqual({ extracted: [], remaining: [7] });
    expect(pairPrimeFactors(196)).toEqual({ extracted: [2, 7], remaining: [] });
    expect(pairPrimeFactors(1)).toEqual({ extracted: [], remaining: [] });
    expect(() => pairPrimeFactors(0)).toThrow('натуральным');
  });

  it('согласует разбиение на пары с вынесением множителя', () => {
    const product = (values: readonly number[]) => values.reduce((total, item) => total * item, 1);
    for (const value of [8, 12, 18, 45, 50, 72, 98, 108, 200, 300, 999, 1024]) {
      const { extracted, remaining } = pairPrimeFactors(value);
      const radical = simplifyRadical(value);
      expect(product(extracted)).toBe(radical.coefficient);
      expect(product(remaining)).toBe(radical.radicand);
    }
  });

  it('согласует вынесение и внесение множителя', () => {
    for (const value of [8, 12, 18, 20, 27, 32, 45, 50, 72, 98, 108, 200, 300]) {
      expect(radicalToSquareRoot(simplifyRadical(value))).toBe(value);
    }
  });
});

describe('действия с радикалами', () => {
  it('перемножает корни и упрощает результат', () => {
    expect(multiplyRadicals({ coefficient: 1, radicand: 2 }, { coefficient: 1, radicand: 8 }))
      .toEqual({ coefficient: 4, radicand: 1 });
    expect(multiplyRadicals({ coefficient: 1, radicand: 3 }, { coefficient: 1, radicand: 12 }))
      .toEqual({ coefficient: 6, radicand: 1 });
    expect(multiplyRadicals({ coefficient: 2, radicand: 3 }, { coefficient: 5, radicand: 6 }))
      .toEqual({ coefficient: 30, radicand: 2 });
    expect(multiplyRadicals({ coefficient: 1, radicand: 5 }, { coefficient: 1, radicand: 5 }))
      .toEqual({ coefficient: 5, radicand: 1 });
    expect(multiplyRadicals({ coefficient: 0, radicand: 7 }, { coefficient: 3, radicand: 2 }))
      .toEqual({ coefficient: 0, radicand: 1 });
  });

  it('складывает только подобные радикалы', () => {
    expect(addRadicals({ coefficient: 3, radicand: 2 }, { coefficient: 5, radicand: 2 }))
      .toEqual({ coefficient: 8, radicand: 2 });
    expect(addRadicals({ coefficient: 1, radicand: 8 }, { coefficient: 1, radicand: 18 }))
      .toEqual({ coefficient: 5, radicand: 2 });
    expect(addRadicals({ coefficient: 3, radicand: 2 }, { coefficient: -3, radicand: 2 }))
      .toEqual({ coefficient: 0, radicand: 1 });
    expect(addRadicals({ coefficient: 1, radicand: 2 }, { coefficient: 1, radicand: 3 })).toBeNull();
  });

  it('сравнивает радикалы точно', () => {
    expect(compareRadicals({ coefficient: 2, radicand: 3 }, { coefficient: 3, radicand: 2 })).toBe(-1);
    expect(compareRadicals({ coefficient: 1, radicand: 50 }, { coefficient: 5, radicand: 2 })).toBe(0);
    expect(compareRadicals({ coefficient: 7, radicand: 1 }, { coefficient: 1, radicand: 50 })).toBe(-1);
    expect(compareRadicals({ coefficient: -2, radicand: 3 }, { coefficient: 1, radicand: 3 })).toBe(-1);
    expect(compareRadicals({ coefficient: -2, radicand: 3 }, { coefficient: -3, radicand: 2 })).toBe(1);
    expect(compareRadicals({ coefficient: 0, radicand: 5 }, { coefficient: 0, radicand: 7 })).toBe(0);
  });

  it('избавляется от иррациональности в знаменателе', () => {
    expect(rationalizeDenominator(1, 2)).toEqual({ numerator: 1, denominator: 2, radicand: 2 });
    expect(rationalizeDenominator(6, 3)).toEqual({ numerator: 2, denominator: 1, radicand: 3 });
    expect(rationalizeDenominator(5, 8)).toEqual({ numerator: 5, denominator: 4, radicand: 2 });
    expect(rationalizeDenominator(4, 4)).toEqual({ numerator: 2, denominator: 1, radicand: 1 });
    expect(() => rationalizeDenominator(1, 0)).toThrow('корень из нуля');
  });

  it('применяет тождество корня из квадрата', () => {
    expect(squareRootOfSquare(5)).toBe(5);
    expect(squareRootOfSquare(-5)).toBe(5);
    expect(squareRootOfSquare(0)).toBe(0);
  });

  it('записывает радикал текстом', () => {
    expect(formatRadical({ coefficient: 6, radicand: 2 })).toBe('6√2');
    expect(formatRadical({ coefficient: 1, radicand: 7 })).toBe('√7');
    expect(formatRadical({ coefficient: -1, radicand: 7 })).toBe('−√7');
    expect(formatRadical({ coefficient: 4, radicand: 1 })).toBe('4');
    expect(formatRadical({ coefficient: 0, radicand: 5 })).toBe('0');
    expect(formatRadical({ coefficient: 3, radicand: 8 })).toBe('6√2');
  });
});
