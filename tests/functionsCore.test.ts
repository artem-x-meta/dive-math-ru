import { describe, expect, it } from 'vitest';
import {
  BASE_FUNCTION_IDS,
  IDENTITY_TRANSFORM,
  INVERSE_PRESET_IDS,
  boundsOnInterval,
  baseValue,
  compositionTable,
  compositionValue,
  getBaseFunction,
  getInversePreset,
  inversePairs,
  inverseSegments,
  levelCrossings,
  monotonicityOnInterval,
  numberText,
  parityFromSamples,
  presetSegments,
  reflectPoint,
  transformedDomainText,
  transformedParity,
  transformedRangeText,
  transformSegments,
  transformSteps,
  transformText,
  transformValue,
  type BaseFunctionId,
  type Box,
  type TransformParams,
} from '../src/lib/functionsCore';

const WINDOW: Box = { xMin: -6, xMax: 6, yMin: -6, yMax: 6 };

function params(patch: Partial<TransformParams> = {}): TransformParams {
  return { ...IDENTITY_TRANSFORM, ...patch };
}

describe('эталонные функции', () => {
  it('считает значения шести эталонов', () => {
    expect(baseValue('linear', -3)).toBe(-3);
    expect(baseValue('square', -3)).toBe(9);
    expect(baseValue('cube', -3)).toBe(-27);
    expect(baseValue('abs', -3)).toBe(3);
    expect(baseValue('sqrt', 6.25)).toBe(2.5);
    expect(baseValue('reciprocal', -4)).toBe(-0.25);
  });

  it('возвращает null вне области определения', () => {
    expect(baseValue('sqrt', -0.0001)).toBeNull();
    expect(baseValue('reciprocal', 0)).toBeNull();
    expect(baseValue('square', Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('хранит паспорт каждого эталона и отвергает чужой ключ', () => {
    expect(BASE_FUNCTION_IDS).toHaveLength(6);
    expect(getBaseFunction('reciprocal').parity).toBe('odd');
    expect(getBaseFunction('sqrt').domainText).toBe('x ⩾ 0');
    expect(() => getBaseFunction('parabola' as BaseFunctionId)).toThrow('Неизвестная эталонная функция');
  });
});

describe('запись преобразованной функции', () => {
  it('оформляет русскую запись числа', () => {
    expect(numberText(-2.5)).toBe('−2,5');
    expect(numberText(0)).toBe('0');
    expect(numberText(1 / 3)).toBe('0,333');
  });

  it('расставляет скобки по каждому эталону', () => {
    expect(transformText('square', params())).toBe('y = x²');
    expect(transformText('abs', params({ a: -2, m: 3, n: 1 }))).toBe('y = −2·|x − 3| + 1');
    expect(transformText('sqrt', params({ k: -1 }))).toBe('y = √(−x)');
    expect(transformText('reciprocal', params({ m: 2, n: -3 }))).toBe('y = 1/(x − 2) − 3');
    expect(transformText('square', params({ k: 2 }))).toBe('y = (2x)²');
    expect(transformText('square', params({ a: 0.5, m: -4 }))).toBe('y = 0,5·(x + 4)²');
    expect(transformText('cube', params({ a: -1, m: 1 }))).toBe('y = −(x − 1)³');
  });

  it('не теряет скобки у линейного эталона', () => {
    expect(transformText('linear', params({ a: 2, m: 3 }))).toBe('y = 2·(x − 3)');
    expect(transformText('linear', params({ k: -1 }))).toBe('y = −x');
    expect(transformText('linear', params({ a: -1, k: -1 }))).toBe('y = x');
    expect(transformText('linear', params({ a: 3, k: -2 }))).toBe('y = 3·(−2x)');
  });
});

describe('значения после преобразования', () => {
  it('подставляет аргумент по правилу a·f(k(x − m)) + n', () => {
    expect(transformValue('square', params({ a: -2, m: 1, n: 3 }), 3)).toBe(-5);
    expect(transformValue('sqrt', params({ m: 4 }), 8)).toBe(2);
    expect(transformValue('reciprocal', params({ m: 2, n: 1 }), 3)).toBe(2);
    expect(transformValue('abs', params({ k: -1, n: -2 }), 5)).toBe(3);
  });

  it('сообщает о точках вне области определения', () => {
    expect(transformValue('sqrt', params({ m: 4 }), 0)).toBeNull();
    expect(transformValue('reciprocal', params({ m: 2 }), 2)).toBeNull();
  });

  it('запрещает нулевые множители', () => {
    expect(() => transformValue('square', params({ a: 0 }), 1)).toThrow('a не может быть равен нулю');
    expect(() => transformValue('square', params({ k: 0 }), 1)).toThrow('k не может быть равен нулю');
  });
});

describe('область определения, область значений и чётность', () => {
  it('читает область определения прямо из параметров', () => {
    expect(transformedDomainText('sqrt', params({ m: 2 }))).toBe('x ⩾ 2');
    expect(transformedDomainText('sqrt', params({ k: -1, m: 2 }))).toBe('x ⩽ 2');
    expect(transformedDomainText('reciprocal', params({ m: -3 }))).toBe('x ≠ −3');
    expect(transformedDomainText('cube', params({ m: 5 }))).toBe('любое число');
  });

  it('читает область значений по знаку a и сдвигу n', () => {
    expect(transformedRangeText('square', params({ a: -2, n: 3 }))).toBe('y ⩽ 3');
    expect(transformedRangeText('abs', params({ n: -1 }))).toBe('y ⩾ −1');
    expect(transformedRangeText('reciprocal', params({ n: 1 }))).toBe('y ≠ 1');
    expect(transformedRangeText('cube', params({ a: -4, n: 7 }))).toBe('любое число');
  });

  it('теряет симметрию при сдвиге по горизонтали', () => {
    expect(transformedParity('square', params({ n: 5 }))).toBe('even');
    expect(transformedParity('square', params({ m: 1 }))).toBe('none');
    expect(transformedParity('cube', params())).toBe('odd');
    expect(transformedParity('cube', params({ n: 5 }))).toBe('none');
    expect(transformedParity('sqrt', params())).toBe('none');
  });

  it('подтверждает чётность численно', () => {
    const probes = [0.5, 1, 2, 3];
    expect(parityFromSamples((x) => transformValue('square', params({ n: 5 }), x), probes)).toBe('even');
    expect(parityFromSamples((x) => transformValue('cube', params({ a: -2 }), x), probes)).toBe('odd');
    expect(parityFromSamples((x) => transformValue('sqrt', params(), x), probes)).toBe('none');
    expect(parityFromSamples((x) => transformValue('square', params({ m: 1 }), x), probes)).toBe('none');
  });
});

describe('цепочка преобразований', () => {
  it('идёт от аргумента к значению и пропускает пустые шаги', () => {
    const steps = transformSteps('square', params({ a: -2, m: 1, n: 3 }));
    expect(steps.map((step) => step.formula)).toEqual([
      'y = x²',
      'y = (x − 1)²',
      'y = −2·(x − 1)²',
      'y = −2·(x − 1)² + 3',
    ]);
    expect(steps[1]!.action).toContain('вправо');
    expect(steps[2]!.action).toContain('отражение относительно оси x');
  });

  it('у эталона цепочка состоит из одного шага', () => {
    expect(transformSteps('abs', params())).toHaveLength(1);
  });

  it('различает сжатие и растяжение по горизонтали', () => {
    expect(transformSteps('square', params({ k: 2 }))[1]!.action).toContain('сжатие к оси y в 2 раз');
    expect(transformSteps('square', params({ k: 0.5 }))[1]!.action).toContain('растяжение от оси y в 2 раз');
    expect(transformSteps('square', params({ k: -1 }))[1]!.action).toContain('отражение относительно оси y');
  });
});

describe('ломаные графика', () => {
  it('рвёт гиперболу на две ветви', () => {
    const segments = transformSegments('reciprocal', params(), WINDOW, 240);
    expect(segments).toHaveLength(2);
    expect(segments[0]!.every((point) => point.x < 0)).toBe(true);
    expect(segments[1]!.every((point) => point.x > 0)).toBe(true);
  });

  it('начинает корень в точке сдвига и не заходит левее', () => {
    const segments = transformSegments('sqrt', params({ m: 2 }), WINDOW, 240);
    expect(segments).toHaveLength(1);
    expect(segments[0]![0]!.x).toBeCloseTo(2, 6);
    expect(segments[0]!.every((point) => point.x >= 2 - 1e-6)).toBe(true);
  });

  it('считает каждую точку по формуле, а не рисует на глаз', () => {
    const transform = params({ a: -0.5, k: 2, m: 1, n: 3 });
    const segments = transformSegments('square', transform, WINDOW, 200);
    for (const segment of segments) {
      for (const point of segment) {
        expect(point.y).toBeCloseTo(-0.5 * (2 * (point.x - 1)) ** 2 + 3, 6);
      }
    }
  });

  it('обрезает кривую по верхней и нижней границе окна', () => {
    const segments = transformSegments('square', params(), WINDOW, 200);
    expect(segments).toHaveLength(1);
    const xs = segments[0]!.map((point) => point.x);
    expect(Math.min(...xs)).toBeCloseTo(-Math.sqrt(6), 4);
    expect(Math.max(...xs)).toBeCloseTo(Math.sqrt(6), 4);
  });

  it('отвергает вырожденное окно', () => {
    expect(() => transformSegments('square', params(), { xMin: 1, xMax: 1, yMin: -1, yMax: 1 }))
      .toThrow('положительные размеры');
  });
});

describe('монотонность и ограниченность', () => {
  it('различает возрастание, убывание и смену направления', () => {
    expect(monotonicityOnInterval('square', params(), { min: 0, max: 5 })).toBe('increasing');
    expect(monotonicityOnInterval('square', params(), { min: -5, max: 5 })).toBe('none');
    expect(monotonicityOnInterval('square', params({ a: -1 }), { min: 0, max: 5 })).toBe('decreasing');
    expect(monotonicityOnInterval('reciprocal', params(), { min: 1, max: 5 })).toBe('decreasing');
    expect(monotonicityOnInterval('reciprocal', params(), { min: -3, max: 3 })).toBe('none');
  });

  it('находит наибольшее и наименьшее значения на отрезке', () => {
    expect(boundsOnInterval('square', params(), { min: -2, max: 2 }, 128)).toEqual({
      minimum: 0,
      maximum: 4,
      bounded: true,
    });
    const cosLike = boundsOnInterval('abs', params({ a: -1, n: 2 }), { min: -3, max: 3 }, 120);
    expect(cosLike.maximum).toBeCloseTo(2, 9);
    expect(cosLike.minimum).toBeCloseTo(-1, 9);
  });

  it('отвергает промежуток нулевой длины', () => {
    expect(() => monotonicityOnInterval('square', params(), { min: 2, max: 2 })).toThrow('больше левой');
  });
});

describe('обратная функция', () => {
  it('перечисляет восемь разобранных примеров', () => {
    expect(INVERSE_PRESET_IDS).toHaveLength(8);
    expect(() => getInversePreset('parabola' as never)).toThrow('Неизвестный пример');
  });

  it('возвращает аргумент обратно там, где обратная функция есть', () => {
    for (const id of INVERSE_PRESET_IDS) {
      const preset = getInversePreset(id);
      if (!preset.invertible || preset.inverse === null) continue;
      for (const x of [preset.window.min + 0.5, (preset.window.min + preset.window.max) / 2, preset.window.max - 0.5]) {
        const y = preset.value(x);
        if (y === null) continue;
        expect(preset.inverse(y)!).toBeCloseTo(x, 9);
      }
    }
  });

  it('строит таблицу пар для y = x² при x ⩾ 0', () => {
    expect(inversePairs('square-right', [0, 1, 2, 3])).toEqual([
      { x: 0, y: 0, back: 0 },
      { x: 1, y: 1, back: 1 },
      { x: 2, y: 4, back: 2 },
      { x: 3, y: 9, back: 3 },
    ]);
  });

  it('честно помечает необратимые примеры и показывает свидетеля', () => {
    const square = getInversePreset('square-all');
    expect(square.invertible).toBe(false);
    expect(square.inverse).toBeNull();
    expect(square.collision).toEqual({ level: 4, firstX: -2, secondX: 2 });
    expect(square.value(-2)).toBe(square.value(2));

    const abs = getInversePreset('abs-all');
    expect(abs.value(-3)).toBe(abs.value(3));
  });

  it('считает пересечения с горизонтальной прямой', () => {
    expect(levelCrossings('square-all', 4)).toBe(2);
    expect(levelCrossings('square-all', -1)).toBe(0);
    expect(levelCrossings('abs-all', 3)).toBe(2);
    expect(levelCrossings('linear', 5)).toBe(1);
    expect(levelCrossings('cube', -8)).toBe(1);
  });

  it('получает график обратной функции отражением относительно y = x', () => {
    expect(reflectPoint({ x: 2, y: -7 })).toEqual({ x: -7, y: 2 });

    const box: Box = { xMin: -1, xMax: 10, yMin: -1, yMax: 10 };
    const direct = presetSegments('sqrt', box, 200);
    const mirrored = inverseSegments('sqrt', box, 200);
    expect(direct.length).toBe(1);
    expect(mirrored.length).toBe(1);
    for (const point of mirrored[0]!) {
      expect(point.y).toBeCloseTo(point.x * point.x, 6);
    }
  });

  it('не рисует обратную функцию там, где её нет', () => {
    expect(inverseSegments('square-all', WINDOW, 120)).toEqual([]);
  });
});

describe('композиция функций', () => {
  it('выполняет сначала внутреннюю, потом внешнюю функцию', () => {
    expect(compositionValue('square', params(), 'linear', params({ m: 3 }), 5)).toBe(4);
    expect(compositionValue('linear', params({ m: 3 }), 'square', params(), 5)).toBe(22);
  });

  it('обрывается там, где внутренний результат вне области определения внешней', () => {
    expect(compositionValue('sqrt', params(), 'linear', params({ n: -4 }), 2)).toBeNull();
    expect(compositionValue('sqrt', params(), 'linear', params({ n: -4 }), 4)).toBe(0);
    expect(compositionValue('linear', params({ n: -4 }), 'sqrt', params(), 2)).toBeCloseTo(Math.SQRT2 - 4, 9);
  });

  it('строит таблицу переходов x → u → y', () => {
    const rows = compositionTable('square', params(), 'linear', params({ m: 1 }), [-1, 1, 4]);
    expect(rows).toEqual([
      { x: -1, inner: -2, outer: 4 },
      { x: 1, inner: 0, outer: 0 },
      { x: 4, inner: 3, outer: 9 },
    ]);
  });

  it('помечает неопределённые строки таблицы', () => {
    const rows = compositionTable('reciprocal', params(), 'linear', params({ m: 2 }), [2, 3]);
    expect(rows[0]).toEqual({ x: 2, inner: 0, outer: null });
    expect(rows[1]).toEqual({ x: 3, inner: 1, outer: 1 });
  });
});
