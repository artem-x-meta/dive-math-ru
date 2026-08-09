import {
  AlgebraError,
  evaluateExpression,
  formatExpressionLatex,
  parseExpression,
  type ExpressionEnvironment,
  type ExpressionNode,
} from './algebra';
import {
  ExactRationalError,
  compareExact,
  divideExact,
  formatExactRussian,
  parseExact,
  subtractExact,
  type ExactInput,
  type ExactRational,
} from './exactRational';

export type FormulaPresetId =
  | 'purchase'
  | 'taxi'
  | 'perimeter'
  | 'distance'
  | 'temperature'
  | 'expedition-cost';

export interface FormulaOutputDefinition {
  readonly name: string;
  readonly label: string;
  readonly unit?: string;
}

export interface FormulaVariableDefinition {
  readonly name: string;
  readonly label: string;
  readonly unit?: string;
  readonly initial: ExactRational;
  readonly min: ExactRational;
  readonly max: ExactRational;
  readonly step: ExactRational;
  readonly integer?: boolean;
}

export interface FormulaPreset {
  readonly id: FormulaPresetId;
  readonly title: string;
  readonly description: string;
  /** Right-hand side written in the parser's explicit-multiplication syntax. */
  readonly expression: string;
  readonly ast: ExpressionNode;
  readonly latex: string;
  readonly output: FormulaOutputDefinition;
  readonly variables: readonly FormulaVariableDefinition[];
}

export type FormulaValidationCode =
  | 'missing-value'
  | 'invalid-value'
  | 'below-minimum'
  | 'above-maximum'
  | 'not-integer'
  | 'off-step';

export interface FormulaValidationIssue {
  readonly code: FormulaValidationCode;
  readonly variable?: string;
  readonly message: string;
}

interface FormulaPresetSource {
  readonly id: FormulaPresetId;
  readonly title: string;
  readonly description: string;
  readonly expression: string;
  readonly output: FormulaOutputDefinition;
  readonly variables: readonly {
    readonly name: string;
    readonly label: string;
    readonly unit?: string;
    readonly initial: ExactInput;
    readonly min: ExactInput;
    readonly max: ExactInput;
    readonly step: ExactInput;
    readonly integer?: boolean;
  }[];
}

const PRESET_SOURCES: readonly FormulaPresetSource[] = [
  {
    id: 'purchase',
    title: 'Стоимость покупки',
    description: 'Цена одной единицы товара, умноженная на количество.',
    expression: 'p * n',
    output: { name: 'C', label: 'Стоимость', unit: '₽' },
    variables: [
      { name: 'p', label: 'Цена', unit: '₽/шт', initial: 120, min: 0, max: 100_000, step: '0.01' },
      { name: 'n', label: 'Количество', unit: 'шт', initial: 3, min: 0, max: 10_000, step: 1, integer: true },
    ],
  },
  {
    id: 'taxi',
    title: 'Стоимость поездки на такси',
    description: 'Фиксированная посадка плюс оплата каждого километра.',
    expression: 'f + r * x',
    output: { name: 'C', label: 'Стоимость поездки', unit: '₽' },
    variables: [
      { name: 'f', label: 'Посадка', unit: '₽', initial: 150, min: 0, max: 10_000, step: 1 },
      { name: 'r', label: 'Тариф', unit: '₽/км', initial: 25, min: 0, max: 10_000, step: '0.01' },
      { name: 'x', label: 'Расстояние', unit: 'км', initial: 8, min: 0, max: 1_000, step: '0.1' },
    ],
  },
  {
    id: 'perimeter',
    title: 'Периметр прямоугольника',
    description: 'У прямоугольника две стороны длины a и две стороны длины b.',
    expression: '2 * (a + b)',
    output: { name: 'P', label: 'Периметр', unit: 'м' },
    variables: [
      { name: 'a', label: 'Длина', unit: 'м', initial: 6, min: '0.1', max: 10_000, step: '0.1' },
      { name: 'b', label: 'Ширина', unit: 'м', initial: 4, min: '0.1', max: 10_000, step: '0.1' },
    ],
  },
  {
    id: 'distance',
    title: 'Путь по скорости и времени',
    description: 'При постоянной скорости путь равен произведению скорости и времени.',
    expression: 'v * t',
    output: { name: 's', label: 'Путь', unit: 'км' },
    variables: [
      { name: 'v', label: 'Скорость', unit: 'км/ч', initial: 60, min: 0, max: 1_000, step: '0.1' },
      { name: 't', label: 'Время', unit: 'ч', initial: 2, min: 0, max: 1_000, step: '0.1' },
    ],
  },
  {
    id: 'temperature',
    title: 'Изменение температуры',
    description: 'К начальной температуре прибавляется направленное изменение: оно может быть отрицательным.',
    expression: 't0 + d',
    output: { name: 'T', label: 'Новая температура', unit: '°C' },
    variables: [
      { name: 't0', label: 'Начальная температура', unit: '°C', initial: 5, min: -100, max: 100, step: '0.5' },
      { name: 'd', label: 'Изменение', unit: '°C', initial: -8, min: -100, max: 100, step: '0.5' },
    ],
  },
  {
    id: 'expedition-cost',
    title: 'Бюджет экспедиции',
    description: 'К фиксированным расходам 1800 ₽ добавляется по 240 ₽ на каждого участника.',
    expression: '1800 + 240 * n',
    output: { name: 'C', label: 'Общие расходы', unit: '₽' },
    variables: [
      { name: 'n', label: 'Участники', unit: 'человек', initial: 6, min: 0, max: 1_000, step: 1, integer: true },
    ],
  },
] as const;

function buildVariable(source: FormulaPresetSource['variables'][number]): FormulaVariableDefinition {
  const variable = Object.freeze({
    name: source.name,
    label: source.label,
    ...(source.unit === undefined ? {} : { unit: source.unit }),
    initial: parseExact(source.initial),
    min: parseExact(source.min),
    max: parseExact(source.max),
    step: parseExact(source.step),
    ...(source.integer === undefined ? {} : { integer: source.integer }),
  });

  if (compareExact(variable.min, variable.max) > 0) {
    throw new Error(`Invalid bounds for formula variable "${source.name}".`);
  }
  if (compareExact(variable.step, 0) <= 0) {
    throw new Error(`The step for formula variable "${source.name}" must be positive.`);
  }
  if (compareExact(variable.initial, variable.min) < 0 || compareExact(variable.initial, variable.max) > 0) {
    throw new Error(`The initial value for formula variable "${source.name}" is outside its bounds.`);
  }
  return variable;
}

function buildPreset(source: FormulaPresetSource): FormulaPreset {
  const variables = Object.freeze(source.variables.map(buildVariable));
  const ast = parseExpression(source.expression, variables.map((variable) => variable.name));
  return Object.freeze({
    id: source.id,
    title: source.title,
    description: source.description,
    expression: source.expression,
    ast,
    latex: `${source.output.name} = ${formatExpressionLatex(ast)}`,
    output: Object.freeze({ ...source.output }),
    variables,
  });
}

const FORMULA_PRESETS: readonly FormulaPreset[] = Object.freeze(PRESET_SOURCES.map(buildPreset));
const FORMULA_PRESETS_BY_ID = new Map(FORMULA_PRESETS.map((preset) => [preset.id, preset]));

export function listFormulaPresets(): readonly FormulaPreset[] {
  return FORMULA_PRESETS;
}

export function getFormulaPreset(id: FormulaPresetId | string): FormulaPreset {
  const preset = FORMULA_PRESETS_BY_ID.get(id as FormulaPresetId);
  if (preset === undefined) {
    throw new AlgebraError('invalid-expression', `Unknown formula preset "${id}".`);
  }
  return preset;
}

function readEnvironmentValue(
  values: ExpressionEnvironment,
  name: string,
): { readonly present: boolean; readonly value?: ExactInput } {
  if (values instanceof Map) {
    return { present: values.has(name), value: values.get(name) };
  }
  const record = values as Readonly<Record<string, ExactInput>>;
  const present = Object.prototype.hasOwnProperty.call(record, name);
  return { present, value: present ? record[name] : undefined };
}

function issue(
  code: FormulaValidationCode,
  message: string,
  variable?: string,
): FormulaValidationIssue {
  return Object.freeze({ code, message, ...(variable === undefined ? {} : { variable }) });
}

function formattedVariableValue(
  value: ExactInput,
  definition: FormulaVariableDefinition,
): string {
  return `${formatExactRussian(value)}${definition.unit ? ` ${definition.unit}` : ''}`;
}

export function validateFormulaValues(
  presetId: FormulaPresetId | string,
  values: ExpressionEnvironment,
): readonly FormulaValidationIssue[] {
  const preset = getFormulaPreset(presetId);
  const issues: FormulaValidationIssue[] = [];

  for (const definition of preset.variables) {
    const input = readEnvironmentValue(values, definition.name);
    if (!input.present || input.value === undefined) {
      issues.push(issue('missing-value', `Укажите значение «${definition.label}».`, definition.name));
      continue;
    }

    let value: ExactRational;
    try {
      value = parseExact(input.value);
    } catch (error) {
      const detail = error instanceof ExactRationalError ? error.message : 'Некорректное число.';
      issues.push(issue('invalid-value', `«${definition.label}»: ${detail}`, definition.name));
      continue;
    }

    if (compareExact(value, definition.min) < 0) {
      issues.push(
        issue(
          'below-minimum',
          `«${definition.label}» должно быть не меньше ${formattedVariableValue(definition.min, definition)}.`,
          definition.name,
        ),
      );
    }
    if (compareExact(value, definition.max) > 0) {
      issues.push(
        issue(
          'above-maximum',
          `«${definition.label}» должно быть не больше ${formattedVariableValue(definition.max, definition)}.`,
          definition.name,
        ),
      );
    }
    if (definition.integer === true && value.denominator !== 1n) {
      issues.push(issue('not-integer', `«${definition.label}» должно быть целым числом.`, definition.name));
    }

    try {
      const stepNumber = divideExact(subtractExact(value, definition.min), definition.step);
      if (stepNumber.denominator !== 1n) {
        issues.push(
          issue(
            'off-step',
            `«${definition.label}» должно меняться с шагом ${formattedVariableValue(definition.step, definition)}.`,
            definition.name,
          ),
        );
      }
    } catch {
      issues.push(issue('invalid-value', `Не удалось проверить шаг для «${definition.label}».`, definition.name));
    }
  }

  return Object.freeze(issues);
}

export function evaluateFormulaPreset(
  presetId: FormulaPresetId | string,
  values: ExpressionEnvironment,
): ExactRational {
  const preset = getFormulaPreset(presetId);
  return evaluateExpression(preset.ast, values);
}

export function initialFormulaValues(
  presetId: FormulaPresetId | string,
): Readonly<Record<string, ExactRational>> {
  const preset = getFormulaPreset(presetId);
  return Object.freeze(
    Object.fromEntries(preset.variables.map((variable) => [variable.name, variable.initial])),
  );
}
