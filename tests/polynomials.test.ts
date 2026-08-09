import { describe, expect, it } from 'vitest';
import {
  addPolynomials,
  combinePolynomials,
  commonMonomialFactor,
  degreeRows,
  differenceOfSquaresTiles,
  differenceSquareTiles,
  evaluatePolynomial,
  expandDifferenceOfSquares,
  expandDifferenceSquare,
  expandSumSquare,
  factorOutCommonMonomial,
  formatExponent,
  formatMonomial,
  formatPolynomial,
  isZeroPolynomial,
  multiplyPolynomials,
  normalizePolynomial,
  partialProducts,
  polynomialDegree,
  polynomialsEqual,
  productRows,
  scalePolynomial,
  subtractPolynomials,
  sumSquareTiles,
} from '../src/lib/polynomials';

describe('стандартный вид многочлена', () => {
  it('убирает старшие нули и оставляет внутренние', () => {
    expect(normalizePolynomial([3, 0, 2, 0, 0])).toEqual([3, 0, 2]);
    expect(normalizePolynomial([0, 0, 0])).toEqual([]);
    expect(normalizePolynomial([-0, 5])).toEqual([0, 5]);
  });

  it('определяет степень, а у нулевого многочлена возвращает null', () => {
    expect(polynomialDegree([-3, 0, 2])).toBe(2);
    expect(polynomialDegree([7])).toBe(0);
    expect(polynomialDegree([0, 0])).toBeNull();
    expect(isZeroPolynomial([0, 0, 0])).toBe(true);
    expect(isZeroPolynomial([0, 1])).toBe(false);
  });

  it('отклоняет слишком длинные и нечисловые входы', () => {
    expect(() => normalizePolynomial([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toThrow('степени не выше');
    expect(() => normalizePolynomial([Number.NaN])).toThrow('конечным числом');
    expect(() => normalizePolynomial([2_000_000])).toThrow('по модулю');
  });
});

describe('сложение и вычитание многочленов', () => {
  it('складывает подобные члены — члены одной степени', () => {
    expect(addPolynomials([1, 2, 3], [5, -2])).toEqual([6, 0, 3]);
    expect(addPolynomials([], [4, 1])).toEqual([4, 1]);
  });

  it('вычитает как прибавление противоположного и умеет давать нулевой многочлен', () => {
    expect(subtractPolynomials([1, 2, 3], [1, 2, 3])).toEqual([]);
    expect(subtractPolynomials([0, 5], [3, 5])).toEqual([-3]);
    expect(scalePolynomial([1, -2, 3], -2)).toEqual([-2, 4, -6]);
  });

  it('раскладывает действие по степеням от старшей к младшей', () => {
    expect(degreeRows([5, -2], [1, 2, 3], 'add')).toEqual([
      { degree: 2, first: 0, second: 3, result: 3 },
      { degree: 1, first: -2, second: 2, result: 0 },
      { degree: 0, first: 5, second: 1, result: 6 },
    ]);
    expect(degreeRows([1, 2, 3], [1, 2, 3], 'subtract')).toEqual([
      { degree: 2, first: 3, second: 3, result: 0 },
      { degree: 1, first: 2, second: 2, result: 0 },
      { degree: 0, first: 1, second: 1, result: 0 },
    ]);
  });

  it('выбирает действие по имени', () => {
    expect(combinePolynomials([1, 1], [1, -1], 'add')).toEqual([2]);
    expect(combinePolynomials([1, 1], [1, -1], 'subtract')).toEqual([0, 2]);
    expect(combinePolynomials([1, 1], [1, -1], 'multiply')).toEqual([1, 0, -1]);
  });
});

describe('умножение многочленов', () => {
  it('перемножает каждый член с каждым', () => {
    // (x + 3)(x − 5) = x² − 2x − 15
    expect(multiplyPolynomials([3, 1], [-5, 1])).toEqual([-15, -2, 1]);
    // 2x(3x² − 4) = 6x³ − 8x
    expect(multiplyPolynomials([0, 2], [-4, 0, 3])).toEqual([0, -8, 0, 6]);
  });

  it('умножение на нулевой многочлен даёт нулевой многочлен', () => {
    expect(multiplyPolynomials([3, 1], [])).toEqual([]);
    expect(multiplyPolynomials([0, 0], [-5, 1])).toEqual([]);
  });

  it('перечисляет попарные произведения без нулевых членов', () => {
    expect(partialProducts([3, 1], [-5, 1])).toEqual([
      { firstDegree: 0, secondDegree: 0, coefficient: -15, degree: 0 },
      { firstDegree: 0, secondDegree: 1, coefficient: 3, degree: 1 },
      { firstDegree: 1, secondDegree: 0, coefficient: -5, degree: 1 },
      { firstDegree: 1, secondDegree: 1, coefficient: 1, degree: 2 },
    ]);
    expect(partialProducts([0, 2], [-4, 0, 3])).toHaveLength(2);
  });

  it('группирует произведения по степени результата', () => {
    const rows = productRows([3, 1], [-5, 1]);
    expect(rows.map((row) => row.degree)).toEqual([2, 1, 0]);
    expect(rows.map((row) => row.coefficient)).toEqual([1, -2, -15]);
    expect(rows[1]?.parts).toHaveLength(2);
    // Сумма коэффициентов групп совпадает с произведением.
    expect(rows.map((row) => row.coefficient).reverse()).toEqual([...multiplyPolynomials([3, 1], [-5, 1])]);
  });
});

describe('значение и равенство', () => {
  it('вычисляет значение по схеме Горнера', () => {
    expect(evaluatePolynomial([-15, -2, 1], 5)).toBe(0);
    expect(evaluatePolynomial([-15, -2, 1], -3)).toBe(0);
    expect(evaluatePolynomial([1, 2, 3], 2)).toBe(17);
    expect(evaluatePolynomial([], 7)).toBe(0);
  });

  it('сравнивает многочлены по коэффициентам, а не по одной точке', () => {
    expect(polynomialsEqual([1, 2, 3], [1, 2, 3, 0])).toBe(true);
    expect(polynomialsEqual([0, 1], [0, 0, 1])).toBe(false);
    // Значения совпали при x = 1, но многочлены разные.
    expect(evaluatePolynomial([0, 1], 1)).toBe(evaluatePolynomial([0, 0, 1], 1));
  });
});

describe('запись в стандартном виде', () => {
  it('пишет степень надстрочными цифрами', () => {
    expect(formatExponent(2)).toBe('²');
    expect(formatExponent(0)).toBe('⁰');
    expect(() => formatExponent(-1)).toThrow('целым числом');
  });

  it('не показывает коэффициенты 1 и −1 при букве', () => {
    expect(formatMonomial(1, 2)).toBe('x²');
    expect(formatMonomial(-1, 1)).toBe('−x');
    expect(formatMonomial(-4, 0)).toBe('−4');
    expect(formatMonomial(0, 3)).toBe('0');
    expect(formatMonomial(2.5, 1, 'a')).toBe('2,5a');
  });

  it('записывает многочлен по убыванию степеней и пропускает нули', () => {
    expect(formatPolynomial([-3, 0, 2])).toBe('2x² − 3');
    expect(formatPolynomial([-15, -2, 1])).toBe('x² − 2x − 15');
    expect(formatPolynomial([0, 0, 0])).toBe('0');
    expect(formatPolynomial([1, 1], 'a')).toBe('a + 1');
  });
});

describe('формулы сокращённого умножения', () => {
  it('раскладывает квадрат суммы и квадрат разности', () => {
    expect(expandSumSquare(3, 4)).toEqual({ firstSquare: 9, doubleProduct: 24, secondSquare: 16, total: 49 });
    expect(expandDifferenceSquare(7, 2)).toEqual({ firstSquare: 49, doubleProduct: -28, secondSquare: 4, total: 25 });
  });

  it('согласуется с прямым умножением многочленов', () => {
    // (x + 4)² = x² + 8x + 16
    expect(multiplyPolynomials([4, 1], [4, 1])).toEqual([16, 8, 1]);
    // (x − 4)² = x² − 8x + 16
    expect(multiplyPolynomials([-4, 1], [-4, 1])).toEqual([16, -8, 1]);
    // (x − 4)(x + 4) = x² − 16
    expect(multiplyPolynomials([-4, 1], [4, 1])).toEqual([-16, 0, 1]);
  });

  it('связывает разность квадратов с произведением суммы и разности', () => {
    const parts = expandDifferenceOfSquares(51, 49);
    expect(parts).toEqual({ sum: 100, difference: 2, product: 200, squareDifference: 200 });
    expect(parts.product).toBe(parts.squareDifference);
  });
});

describe('вынесение общего множителя', () => {
  it('находит НОД коэффициентов и наименьшую степень', () => {
    expect(commonMonomialFactor([0, 6, 9])).toEqual({ coefficient: 3, degree: 1 });
    expect(commonMonomialFactor([0, 0, -4, 8])).toEqual({ coefficient: 4, degree: 2 });
    expect(commonMonomialFactor([5, 3])).toEqual({ coefficient: 1, degree: 0 });
    expect(commonMonomialFactor([0, 0])).toBeNull();
  });

  it('для дробных коэффициентов оставляет числовую часть равной единице', () => {
    expect(commonMonomialFactor([0, 1.5, 3])).toEqual({ coefficient: 1, degree: 1 });
  });

  it('выносит множитель так, что произведение возвращает исходный многочлен', () => {
    const factorization = factorOutCommonMonomial([0, 6, 9]);
    expect(factorization).toEqual({ factor: { coefficient: 3, degree: 1 }, quotient: [2, 3] });
    const restored = multiplyPolynomials(
      [...new Array<number>(factorization!.factor.degree).fill(0), factorization!.factor.coefficient],
      factorization!.quotient,
    );
    expect(restored).toEqual([0, 6, 9]);
    expect(factorOutCommonMonomial([])).toBeNull();
  });

  it('не теряет единицу, когда член сам является общим множителем', () => {
    // 5x² + 5x = 5x(x + 1): в скобках обязана остаться единица.
    expect(factorOutCommonMonomial([0, 5, 5])).toEqual({ factor: { coefficient: 5, degree: 1 }, quotient: [1, 1] });
  });
});

function signedArea(tiles: readonly { sign: number; area: number }[]): number {
  return tiles.reduce((sum, tile) => sum + tile.sign * tile.area, 0);
}

describe('площадные модели формул', () => {
  it('разрезает квадрат a + b на четыре части, покрывающие его целиком', () => {
    const layout = sumSquareTiles(3, 2);
    expect(layout.side).toBe(5);
    expect(layout.tiles.map((tile) => tile.area)).toEqual([9, 6, 6, 4]);
    expect(signedArea(layout.tiles)).toBe(layout.result.area);
    expect(layout.result.area).toBe(expandSumSquare(3, 2).total);
    // Плитки не выходят за границы квадрата и не накладываются друг на друга.
    const covered = layout.tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0);
    expect(covered).toBe(layout.side * layout.side);
    for (const tile of layout.tiles) {
      expect(tile.x + tile.width).toBeLessThanOrEqual(layout.side);
      expect(tile.y + tile.height).toBeLessThanOrEqual(layout.side);
    }
  });

  it('в квадрате разности возвращает вычтенный дважды угол', () => {
    const layout = differenceSquareTiles(7, 2);
    const parts = expandDifferenceSquare(7, 2);
    // 49 − 14 − 14 + 4 = 25.
    expect(signedArea(layout.tiles)).toBe(parts.total);
    expect(layout.result.area).toBe(parts.total);
    expect(layout.tiles[0]!.area).toBe(parts.firstSquare);
    expect(layout.tiles[1]!.area + layout.tiles[2]!.area).toBe(-parts.doubleProduct);
    expect(layout.tiles[3]!.area).toBe(parts.secondSquare);
    // Оставшийся квадрат — это угол со стороной a − b.
    expect(layout.result.width).toBe(5);
    expect(layout.result.height).toBe(5);
  });

  it('складывает разрезанный квадрат в прямоугольник (a + b)(a − b)', () => {
    const layout = differenceOfSquaresTiles(9, 4);
    const parts = expandDifferenceOfSquares(9, 4);
    expect(signedArea(layout.cut)).toBe(parts.squareDifference);
    expect(signedArea(layout.rearranged)).toBe(parts.product);
    expect(layout.removed.area).toBe(16);
    // Куски вместе с вырезом покрывают исходный квадрат ровно один раз.
    const covered = [...layout.cut, layout.removed].reduce((sum, tile) => sum + tile.width * tile.height, 0);
    expect(covered).toBe(layout.side * layout.side);
    expect(layout.rectangleWidth).toBe(13);
    expect(layout.rectangleHeight).toBe(5);
    expect(layout.rectangleWidth * layout.rectangleHeight).toBe(parts.product);
    const width = Math.max(...layout.rearranged.map((tile) => tile.x + tile.width));
    const height = Math.max(...layout.rearranged.map((tile) => tile.y + tile.height));
    expect(width).toBe(layout.rectangleWidth);
    expect(height).toBe(layout.rectangleHeight);
  });

  it('требует положительных отрезков и условия a > b', () => {
    expect(() => sumSquareTiles(0, 3)).toThrow('положительным');
    expect(() => differenceSquareTiles(2, 5)).toThrow('a > b');
    expect(() => differenceOfSquaresTiles(4, 4)).toThrow('a > b');
  });
});
