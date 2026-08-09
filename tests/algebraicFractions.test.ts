import { describe, expect, it } from 'vitest';
import {
  DOMAIN_PRESETS,
  EQUIVALENCE_PRESETS,
  addFractions,
  addPolynomials,
  approachTable,
  combinationRestrictions,
  combineFractions,
  compareCombinationAt,
  compareFractionsAt,
  degreeOf,
  divideFractions,
  evaluateCombination,
  evaluateFraction,
  evaluatePolynomial,
  formatFractionExpression,
  formatPolynomial,
  getDomainPreset,
  getEquivalencePreset,
  isAllowedValue,
  missingRestrictions,
  multiplyFractions,
  multiplyPolynomials,
  negatePolynomial,
  parseValueList,
  powerFraction,
  rationalRoots,
  restrictedValues,
  sameValueSet,
  solveFractionEqualsZero,
  subtractFractions,
  subtractPolynomials,
  trimPolynomial,
} from '../src/lib/algebraicFractions';
import { formatExactRussian, parseExact } from '../src/lib/exactRational';

const exact = (source: string) => parseExact(source);
const asText = (values: readonly { numerator: bigint; denominator: bigint }[]) => values.map(formatExactRussian);

describe('многочлены внутри дроби', () => {
  it('определяет степень и распознаёт нулевой многочлен', () => {
    expect(degreeOf([-9, 0, 1])).toBe(2);
    expect(degreeOf([5])).toBe(0);
    expect(degreeOf([0, 0, 0])).toBe(-1);
  });

  it('вычисляет значение точно, в том числе в дробной точке', () => {
    expect(evaluatePolynomial([-9, 0, 1], 3)).toEqual({ numerator: 0n, denominator: 1n });
    expect(evaluatePolynomial([1, 2], '0,5')).toEqual({ numerator: 2n, denominator: 1n });
    expect(evaluatePolynomial([-1, 2], '1/3')).toEqual({ numerator: -1n, denominator: 3n });
  });

  it('перемножает, складывает и вычитает многочлены', () => {
    expect(multiplyPolynomials([-3, 1], [3, 1])).toEqual([-9, 0, 1]);
    expect(addPolynomials([1, 2], [3, 0, 4])).toEqual([4, 2, 4]);
    expect(subtractPolynomials([1, 2], [1, 2])).toEqual([0]);
    expect(negatePolynomial([1, -2])).toEqual([-1, 2]);
    expect(trimPolynomial([1, 0, 0])).toEqual([1]);
    expect(trimPolynomial([0, 0])).toEqual([0]);
  });

  it('записывает многочлен школьной строкой', () => {
    expect(formatPolynomial([-9, 0, 1])).toBe('x² − 9');
    expect(formatPolynomial([3, 1])).toBe('x + 3');
    expect(formatPolynomial([3, -1])).toBe('−x + 3');
    expect(formatPolynomial([0])).toBe('0');
    expect(formatPolynomial([0, 1], 'a')).toBe('a');
  });

  it('отвергает нецелые коэффициенты', () => {
    expect(() => degreeOf([1.5, 2])).toThrow('безопасными целыми');
    expect(() => addPolynomials([1], [0.5])).toThrow('безопасными целыми');
  });
});

describe('рациональные корни', () => {
  it('находит корни линейного и квадратного многочленов', () => {
    expect(rationalRoots([-6, 2])).toEqual([{ numerator: 3n, denominator: 1n }]);
    expect(asText(rationalRoots([-4, 0, 1]))).toEqual(['−2', '2']);
    expect(asText(rationalRoots([9, -6, 1]))).toEqual(['3']);
    expect(rationalRoots([5])).toEqual([]);
  });

  it('возвращает пустой список, когда корней нет', () => {
    expect(rationalRoots([1, 0, 1])).toEqual([]);
  });

  it('честно сообщает о выходе за рамки школьного ядра', () => {
    expect(() => rationalRoots([-2, 0, 1])).toThrow('иррациональны');
    expect(() => rationalRoots([0])).toThrow('Нулевой многочлен');
    expect(() => rationalRoots([1, 1, 1, 1])).toThrow('не выше 2');
  });
});

describe('допустимые значения переменной', () => {
  it('запрещает только нули знаменателя', () => {
    expect(asText(restrictedValues([-3, 1]))).toEqual(['3']);
    expect(asText(restrictedValues([-4, 0, 1]))).toEqual(['−2', '2']);
    expect(asText(restrictedValues([-1, 2]))).toEqual(['0,5']);
    expect(restrictedValues([1, 0, 1])).toEqual([]);
    expect(restrictedValues([7])).toEqual([]);
  });

  it('проверяет отдельное значение', () => {
    expect(isAllowedValue([-3, 1], 3)).toBe(false);
    expect(isAllowedValue([-3, 1], 4)).toBe(true);
    expect(isAllowedValue([-1, 2], '0,5')).toBe(false);
  });

  it('не допускает нулевой знаменатель как многочлен', () => {
    expect(() => restrictedValues([0])).toThrow('не может быть нулевым многочленом');
    expect(() => isAllowedValue([0, 0], 1)).toThrow('не может быть нулевым многочленом');
  });
});

describe('значение алгебраической дроби', () => {
  it('вычисляет дробь точно и отмечает неопределённость', () => {
    expect(evaluateFraction([-9, 0, 1], [-3, 1], 5)).toEqual({ defined: true, value: { numerator: 8n, denominator: 1n } });
    expect(evaluateFraction([-9, 0, 1], [-3, 1], 3)).toEqual({ defined: false });
    expect(evaluateFraction([1, 1], [-3, 1], 2)).toEqual({ defined: true, value: { numerator: -3n, denominator: 1n } });
  });

  it('сравнивает исходную дробь и результат сокращения', () => {
    expect(compareFractionsAt([-9, 0, 1], [-3, 1], [3, 1], [1], 5)).toBe('equal');
    expect(compareFractionsAt([-9, 0, 1], [-3, 1], [3, 1], [1], 3)).toBe('left-undefined');
    expect(compareFractionsAt([3, 1], [5, 1], [3], [5], 0)).toBe('equal');
    expect(compareFractionsAt([3, 1], [5, 1], [3], [5], 1)).toBe('different');
    expect(compareFractionsAt([1], [-3, 1], [1], [-3, 1], 3)).toBe('both-undefined');
    expect(compareFractionsAt([1], [1], [1], [-3, 1], 3)).toBe('right-undefined');
  });

  it('показывает рост модуля дроби у запрещённой точки', () => {
    const rows = approachTable([1, 1], [-3, 1], 3, ['1', '0,1', '0,01']);
    expect(rows).toHaveLength(3);
    expect(formatExactRussian(rows[0]!.below.value.value!)).toBe('−3');
    expect(formatExactRussian(rows[0]!.above.value.value!)).toBe('5');
    expect(formatExactRussian(rows[1]!.below.x)).toBe('2,9');
    expect(formatExactRussian(rows[1]!.below.value.value!)).toBe('−39');
    expect(formatExactRussian(rows[1]!.above.value.value!)).toBe('41');
    expect(formatExactRussian(rows[2]!.below.value.value!)).toBe('−399');
    expect(formatExactRussian(rows[2]!.above.value.value!)).toBe('401');
  });

  it('требует положительных смещений в таблице приближения', () => {
    expect(() => approachTable([1, 1], [-3, 1], 3, ['0'])).toThrow('положительными');
  });
});

describe('уравнение «дробь равна нулю»', () => {
  it('отделяет корни от посторонних значений', () => {
    const solution = solveFractionEqualsZero([-4, 0, 1], [-2, 1]);
    expect(asText(solution.roots)).toEqual(['−2']);
    expect(asText(solution.excluded)).toEqual(['2']);
  });

  it('находит уравнение без корней', () => {
    const solution = solveFractionEqualsZero([-4, 1], [-16, 0, 1]);
    expect(solution.roots).toEqual([]);
    expect(asText(solution.excluded)).toEqual(['4']);
  });

  it('оставляет допустимый корень корнем', () => {
    const solution = solveFractionEqualsZero([-6, 2], [1, 1]);
    expect(asText(solution.roots)).toEqual(['3']);
    expect(solution.excluded).toEqual([]);
  });

  it('не решает уравнение с тождественно нулевым числителем', () => {
    expect(() => solveFractionEqualsZero([0], [-3, 1])).toThrow('Числитель-ноль');
  });
});

describe('действия над алгебраическими дробями', () => {
  it('складывает и вычитает через общий знаменатель', () => {
    expect(addFractions(
      { numerator: [1], denominator: [-3, 1] },
      { numerator: [1], denominator: [3, 1] },
    )).toEqual({ numerator: [0, 2], denominator: [-9, 0, 1] });

    expect(subtractFractions(
      { numerator: [2], denominator: [-3, 1] },
      { numerator: [1], denominator: [3, 1] },
    )).toEqual({ numerator: [9, 1], denominator: [-9, 0, 1] });
  });

  it('умножает, делит и возводит дробь в степень', () => {
    expect(multiplyFractions(
      { numerator: [0, 1], denominator: [2, 1] },
      { numerator: [-4, 0, 1], denominator: [0, 0, 1] },
    )).toEqual({ numerator: [0, -4, 0, 1], denominator: [0, 0, 2, 1] });

    expect(divideFractions(
      { numerator: [0, 1], denominator: [-1, 1] },
      { numerator: [0, 0, 1], denominator: [-1, 0, 1] },
    )).toEqual({ numerator: [0, -1, 0, 1], denominator: [0, 0, -1, 1] });

    expect(powerFraction({ numerator: [0, 2], denominator: [3] }, 3))
      .toEqual({ numerator: [0, 0, 0, 8], denominator: [27] });
    expect(powerFraction({ numerator: [0, 2], denominator: [3] }, 0))
      .toEqual({ numerator: [1], denominator: [1] });
  });

  it('запрещает нулевой знаменатель и деление на нулевую дробь', () => {
    expect(() => addFractions(
      { numerator: [1], denominator: [0] },
      { numerator: [1], denominator: [1] },
    )).toThrow('не может быть нулевым многочленом');
    expect(() => divideFractions(
      { numerator: [1], denominator: [1] },
      { numerator: [0], denominator: [1] },
    )).toThrow('нулевым числителем');
    expect(() => powerFraction({ numerator: [1], denominator: [1] }, -2)).toThrow('неотрицательным');
  });
});

describe('запись действия целиком', () => {
  const product = {
    operation: 'product',
    left: { numerator: [0, 1], denominator: [2, 1] },
    right: { numerator: [-4, 0, 1], denominator: [0, 0, 1] },
  } as const;
  const quotient = {
    operation: 'quotient',
    left: { numerator: [0, 1], denominator: [-1, 1] },
    right: { numerator: [0, 0, 1], denominator: [-1, 0, 1] },
  } as const;

  it('сводит действие к одной дроби', () => {
    expect(combineFractions({ operation: 'single', left: { numerator: [-9, 0, 0], denominator: [-3, 1, 0] } }))
      .toEqual({ numerator: [-9], denominator: [-3, 1] });
    expect(combineFractions(product)).toEqual({ numerator: [0, -4, 0, 1], denominator: [0, 0, 2, 1] });
  });

  it('собирает запреты по частям записи, а не по результату', () => {
    expect(asText(combinationRestrictions(product))).toEqual(['−2', '0']);
    expect(asText(combinationRestrictions(quotient))).toEqual(['−1', '0', '1']);
    expect(asText(combinationRestrictions({ operation: 'single', left: { numerator: [1], denominator: [-4, 0, 1] } })))
      .toEqual(['−2', '2']);
  });

  it('вычисляет запись честно: каждая часть должна быть определена', () => {
    expect(evaluateCombination(quotient, -1)).toEqual({ defined: false });
    expect(evaluateCombination(quotient, 0)).toEqual({ defined: false });
    expect(evaluateCombination(quotient, 3)).toEqual({ defined: true, value: { numerator: 4n, denominator: 3n } });
    expect(evaluateCombination(product, 4)).toEqual({ defined: true, value: { numerator: 1n, denominator: 2n } });
  });

  it('каждое запрещённое значение действительно ломает запись', () => {
    for (const combination of [product, quotient]) {
      for (const value of combinationRestrictions(combination)) {
        expect(evaluateCombination(combination, value).defined).toBe(false);
      }
    }
  });

  it('сравнивает запись с предложенным ответом', () => {
    expect(compareCombinationAt(product, { numerator: [-2, 1], denominator: [0, 1] }, 4)).toBe('equal');
    expect(compareCombinationAt(product, { numerator: [-2, 1], denominator: [0, 1] }, -2)).toBe('left-undefined');
    expect(compareCombinationAt(quotient, { numerator: [1, 1], denominator: [0, 1] }, 2)).toBe('equal');
  });

  it('требует вторую дробь для действия', () => {
    expect(() => combineFractions({ operation: 'sum', left: { numerator: [1], denominator: [1] } }))
      .toThrow('вторая дробь');
  });
});

describe('сравнение множеств значений и разбор ответа', () => {
  it('находит потерянные ограничения', () => {
    expect(asText(missingRestrictions([exact('−2'), exact('0')], [exact('0')]))).toEqual(['−2']);
    expect(missingRestrictions([exact('0')], [exact('0')])).toEqual([]);
  });

  it('сравнивает множества без учёта порядка и повторов', () => {
    expect(sameValueSet([exact('2'), exact('−2')], [exact('−2'), exact('2'), exact('2')])).toBe(true);
    expect(sameValueSet([exact('2')], [exact('2'), exact('3')])).toBe(false);
  });

  it('разбирает ответ ученика', () => {
    expect(asText(parseValueList('3; −2')!)).toEqual(['−2', '3']);
    expect(asText(parseValueList(' 0,5 ')!)).toEqual(['0,5']);
    expect(asText(parseValueList('1/2')!)).toEqual(['0,5']);
    expect(parseValueList('нет')).toEqual([]);
    expect(parseValueList('НЕТ')).toEqual([]);
    expect(parseValueList('')).toBeNull();
    expect(parseValueList('два')).toBeNull();
    expect(parseValueList('3;;')).not.toBeNull();
    expect(parseValueList('x'.repeat(300))).toBeNull();
  });

  it('записывает дробь строкой', () => {
    expect(formatFractionExpression({ numerator: [-9, 0, 1], denominator: [-3, 1] }))
      .toBe('(x² − 9) / (x − 3)');
    expect(formatFractionExpression({ numerator: [3, 1], denominator: [1] })).toBe('x + 3');
    expect(formatFractionExpression({ numerator: [0, 1], denominator: [0, 0, 1] }, 'a')).toBe('a / a²');
  });
});

describe('наборы примеров для лабораторий', () => {
  it('каждый пример допустимых значений согласован с ядром', () => {
    for (const preset of DOMAIN_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      const restricted = restrictedValues(preset.denominator);
      for (const value of restricted) {
        expect(evaluateFraction(preset.numerator, preset.denominator, value).defined).toBe(false);
      }
      for (const sample of preset.samples) {
        expect(() => parseExact(sample)).not.toThrow();
      }
      expect(preset.samples.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('уравнения из набора решаются ядром', () => {
    expect(asText(solveFractionEqualsZero(
      getDomainPreset('equation-hole').numerator,
      getDomainPreset('equation-hole').denominator,
    ).roots)).toEqual(['−2']);
    expect(solveFractionEqualsZero(
      getDomainPreset('equation-empty').numerator,
      getDomainPreset('equation-empty').denominator,
    ).roots).toEqual([]);
    expect(restrictedValues(getDomainPreset('always-defined').denominator)).toEqual([]);
  });

  it('вердикт каждого примера на равенство подтверждается вычислением', () => {
    for (const preset of EQUIVALENCE_PRESETS) {
      for (const value of combinationRestrictions(preset.combination)) {
        expect(evaluateCombination(preset.combination, value).defined).toBe(false);
      }
      const statuses = preset.samples.map((sample) => compareCombinationAt(preset.combination, preset.proposed, sample));
      const comparable = statuses.filter((status) => status === 'equal' || status === 'different');
      expect(comparable.length).toBeGreaterThan(0);
      expect(comparable.every((status) => status === 'equal')).toBe(preset.correct);
    }
  });

  it('сообщает о неизвестном идентификаторе примера', () => {
    expect(() => getDomainPreset('нет такого' as never)).toThrow('Неизвестный пример');
    expect(() => getEquivalencePreset('нет такого' as never)).toThrow('Неизвестный пример');
    expect(getEquivalencePreset('reduce-wrong').correct).toBe(false);
  });
});
