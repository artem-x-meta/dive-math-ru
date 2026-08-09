import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlgebraError, traceEvaluation } from '../lib/algebra';
import {
  type ExactRational,
  addExact,
  compareExact,
  formatExactRussian,
  negateExact,
  parseExact,
  subtractExact,
} from '../lib/exactRational';
import {
  type FormulaPreset,
  type FormulaPresetId,
  type FormulaValidationIssue,
  evaluateFormulaPreset,
  getFormulaPreset,
  initialFormulaValues,
  validateFormulaValues,
} from '../lib/formulas';

export type FormulaMode = 'evaluate' | 'table' | 'unknown-bridge';

export interface FormulaLabProps {
  preset: FormulaPresetId;
  mode?: FormulaMode;
  initialValues?: Readonly<Record<string, number>>;
  tableVariable?: string;
  tableValues?: readonly number[];
  unknownVariable?: string;
  targetValue?: number;
  guessMin?: number;
  guessMax?: number;
  guessStep?: number;
}

interface FieldModel {
  name: string;
  label: string;
  unit?: string;
  minimum: ExactRational;
  maximum: ExactRational;
  step: ExactRational;
}

interface FormulaFieldProps {
  id: string;
  model: FieldModel;
  value: ExactRational;
  issueIds?: string;
  onChange: (value: ExactRational) => void;
}

interface FormulaState {
  value?: ExactRational;
  issues: readonly FormulaValidationIssue[];
  error?: string;
}

const ZERO = parseExact('0');
const DECIMAL_DRAFT = /^[+-]?(?:\d*(?:[.,]\d*)?)?$/;
const MAX_TABLE_ROWS = 12;
const MAX_TRACE_STEPS = 12;
const MAX_DRAFT_LENGTH = 64;

function format(value: ExactRational): string {
  return formatExactRussian(value);
}

function focusHorizontalScroller(element: HTMLDivElement | null): void {
  if (!element) return;
  const maximum = Math.max(0, element.scrollWidth - element.clientWidth);
  element.scrollLeft = Math.round(maximum / 2);
}

function safeExact(value: number | undefined, fallback: ExactRational): ExactRational {
  try {
    return value !== undefined && Number.isFinite(value) ? parseExact(value) : fallback;
  } catch {
    return fallback;
  }
}

function clamp(value: ExactRational, minimum: ExactRational, maximum: ExactRational): ExactRational {
  if (compareExact(value, minimum) < 0) return minimum;
  if (compareExact(value, maximum) > 0) return maximum;
  return value;
}

function parseDraft(rawValue: string): ExactRational | null {
  const normalized = rawValue.trim().replace(',', '.');
  if (!normalized || normalized === '+' || normalized === '-' || normalized === '.' || normalized === '+.' || normalized === '-.') return null;
  try {
    return parseExact(normalized);
  } catch {
    return null;
  }
}

function FormulaField({ id, model, value, issueIds, onChange }: FormulaFieldProps) {
  const [draft, setDraft] = useState(format(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);
  const valueAtFocus = useRef(value);

  useEffect(() => {
    if (!editing) setDraft(format(value));
  }, [editing, value]);

  const commit = () => {
    const parsed = parseDraft(draft);
    const next = parsed === null ? value : clamp(parsed, model.minimum, model.maximum);
    onChange(next);
    setDraft(format(next));
  };

  const nudge = (direction: -1 | 1) => {
    const delta = direction === 1 ? model.step : negateExact(model.step);
    onChange(clamp(addExact(value, delta), model.minimum, model.maximum));
  };

  return (
    <div className="dm-field dm-algebra-field">
      <label htmlFor={id}>
        {model.label}{model.unit ? `, ${model.unit}` : ''} <span className="dm-field__value">{format(value)}</span>
      </label>
      <div className="dm-algebra-field__control">
        <button type="button" className="dm-algebra-field__step" onClick={() => nudge(-1)} disabled={compareExact(value, model.minimum) <= 0} aria-label={`Уменьшить ${model.label.toLowerCase()} на ${format(model.step)}`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          maxLength={MAX_DRAFT_LENGTH}
          value={draft}
          aria-describedby={`${id}-hint${issueIds ? ` ${issueIds}` : ''}`}
          aria-invalid={issueIds ? true : undefined}
          onFocus={() => {
            cancelCommit.current = false;
            valueAtFocus.current = value;
            setEditing(true);
          }}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw.length > MAX_DRAFT_LENGTH) return;
            if (!DECIMAL_DRAFT.test(raw)) return;
            setDraft(raw);
            const parsed = parseDraft(raw);
            if (parsed !== null) onChange(parsed);
          }}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              onChange(valueAtFocus.current);
              setDraft(format(valueAtFocus.current));
            } else {
              commit();
            }
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelCommit.current = true;
              onChange(valueAtFocus.current);
              setDraft(format(valueAtFocus.current));
              event.currentTarget.blur();
            }
          }}
        />
        <button type="button" className="dm-algebra-field__step" onClick={() => nudge(1)} disabled={compareExact(value, model.maximum) >= 0} aria-label={`Увеличить ${model.label.toLowerCase()} на ${format(model.step)}`}>+</button>
      </div>
      <small id={`${id}-hint`}>От {format(model.minimum)} до {format(model.maximum)}, шаг {format(model.step)}{model.unit ? ` ${model.unit}` : ''}.</small>
    </div>
  );
}

function safePreset(id: FormulaPresetId): FormulaPreset {
  try {
    return getFormulaPreset(id);
  } catch {
    return getFormulaPreset('purchase');
  }
}

function evaluateState(preset: FormulaPreset, values: Readonly<Record<string, ExactRational>>): FormulaState {
  const issues = validateFormulaValues(preset.id, values);
  try {
    return { value: evaluateFormulaPreset(preset.id, values), issues };
  } catch (error) {
    if (error instanceof AlgebraError && error.code === 'division-by-zero') {
      return { issues, error: 'Значение не определено: делить на ноль нельзя.' };
    }
    return { issues, error: 'Не удалось вычислить формулу для этих значений.' };
  }
}

function withUnit(value: ExactRational, unit: string | undefined): string {
  return `${format(value)}${unit ? ` ${unit}` : ''}`;
}

function humanFormula(preset: FormulaPreset): string {
  return `${preset.output.name} = ${preset.expression.replaceAll('*', ' · ').replace(/\s+/g, ' ')}`;
}

interface FormulaFlowProps {
  id: string;
  preset: FormulaPreset;
  values: Readonly<Record<string, ExactRational>>;
  output?: ExactRational;
  hasIssues: boolean;
}

function FormulaFlow({ id, preset, values, output, hasIssues }: FormulaFlowProps) {
  const inputCount = preset.variables.length;
  const inputX = (index: number) => inputCount === 1 ? 370 : 105 + index * (530 / Math.max(1, inputCount - 1));
  const description = preset.variables.map((variable) => `${variable.label}: ${withUnit(values[variable.name] ?? ZERO, variable.unit)}`).join('. ');
  return (
    <svg className="dm-algebra-formula-flow" viewBox="0 0 740 286" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Поток величин через формулу</title>
      <desc id={`${id}-desc`}>{description}. По формуле {humanFormula(preset)} получается {output ? withUnit(output, preset.output.unit) : 'неопределённое значение'}.</desc>
      <defs>
        <marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path className="dm-algebra-formula-flow__arrow" d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>
      {preset.variables.map((variable, index) => {
        const x = inputX(index);
        return (
          <g className="dm-algebra-formula-flow__input" transform={`translate(${x} 48)`} key={variable.name} aria-hidden="true">
            <rect x="-82" y="-31" width="164" height="62" rx="13" />
            <text className="dm-algebra-formula-flow__caption" y="-7">{variable.label}</text>
            <text className="dm-algebra-formula-flow__value" y="17">{withUnit(values[variable.name] ?? ZERO, variable.unit)}</text>
            <line x1="0" y1="34" x2={370 - x} y2="91" markerEnd={`url(#${id}-arrow)`} />
          </g>
        );
      })}
      <g className="dm-algebra-formula-flow__formula" transform="translate(370 164)" aria-hidden="true">
        <rect x="-154" y="-34" width="308" height="68" rx="17" />
        <text y="7">{humanFormula(preset)}</text>
        <line x1="0" y1="38" x2="0" y2="67" markerEnd={`url(#${id}-arrow)`} />
      </g>
      <g className={`dm-algebra-formula-flow__output ${hasIssues ? 'dm-algebra-formula-flow__output--warning' : ''}`} transform="translate(370 258)" aria-hidden="true">
        <rect x="-122" y="-25" width="244" height="50" rx="14" />
        <text y="6">{output ? `${preset.output.name} = ${withUnit(output, preset.output.unit)}` : `${preset.output.name} не определено`}</text>
      </g>
    </svg>
  );
}

function comparisonText(value: ExactRational, target: ExactRational, unit: string | undefined): { kind: 'equal' | 'low' | 'high'; text: string } {
  const comparison = compareExact(value, target);
  if (comparison === 0) return { kind: 'equal', text: `Точное совпадение: ${withUnit(value, unit)}.` };
  const difference = comparison < 0 ? subtractExact(target, value) : subtractExact(value, target);
  return comparison < 0
    ? { kind: 'low', text: `Получилось ${withUnit(value, unit)} — на ${withUnit(difference, unit)} меньше цели.` }
    : { kind: 'high', text: `Получилось ${withUnit(value, unit)} — на ${withUnit(difference, unit)} больше цели.` };
}

export default function FormulaLab({
  preset: presetId,
  mode = 'evaluate',
  initialValues,
  tableVariable,
  tableValues,
  unknownVariable,
  targetValue,
  guessMin,
  guessMax,
  guessStep,
}: FormulaLabProps) {
  const reactId = useId();
  const labId = `algebra-formula-${reactId.replace(/:/g, '')}`;
  const preset = useMemo(() => safePreset(presetId), [presetId]);
  const defaults = useMemo(() => {
    const base = initialFormulaValues(preset.id);
    return Object.fromEntries(preset.variables.map((definition) => [
      definition.name,
      safeExact(initialValues?.[definition.name], base[definition.name] ?? definition.initial),
    ])) as Record<string, ExactRational>;
  }, [initialValues, preset]);
  const [values, setValues] = useState<Record<string, ExactRational>>(defaults);
  const [activeMode, setActiveMode] = useState<FormulaMode>(mode);
  const defaultTableVariable = preset.variables.some((definition) => definition.name === tableVariable) ? tableVariable! : preset.variables[0]!.name;
  const defaultUnknownVariable = preset.variables.some((definition) => definition.name === unknownVariable) ? unknownVariable! : preset.variables.at(-1)!.name;
  const [activeTableVariable, setActiveTableVariable] = useState(defaultTableVariable);
  const [activeUnknownVariable, setActiveUnknownVariable] = useState(defaultUnknownVariable);
  const visualScroller = useRef<HTMLDivElement>(null);
  const current = evaluateState(preset, values);
  const fieldModels = useMemo(() => preset.variables.map<FieldModel>((definition) => ({
    name: definition.name,
    label: definition.label,
    unit: definition.unit,
    minimum: definition.min,
    maximum: definition.max,
    step: definition.step,
  })), [preset]);
  const unknownDefinition = preset.variables.find((definition) => definition.name === activeUnknownVariable) ?? preset.variables.at(-1)!;
  let guessMinimum = safeExact(guessMin, unknownDefinition.min);
  let guessMaximum = safeExact(guessMax, unknownDefinition.max);
  if (compareExact(guessMinimum, unknownDefinition.min) < 0) guessMinimum = unknownDefinition.min;
  if (compareExact(guessMaximum, unknownDefinition.max) > 0) guessMaximum = unknownDefinition.max;
  if (compareExact(guessMinimum, guessMaximum) >= 0) {
    guessMinimum = unknownDefinition.min;
    guessMaximum = unknownDefinition.max;
  }
  let safeGuessStep = safeExact(guessStep, unknownDefinition.step);
  const guessSpan = subtractExact(guessMaximum, guessMinimum);
  if (compareExact(safeGuessStep, ZERO) <= 0 || compareExact(safeGuessStep, guessSpan) > 0) {
    safeGuessStep = compareExact(unknownDefinition.step, guessSpan) <= 0 ? unknownDefinition.step : guessSpan;
  }
  const guessModel: FieldModel = {
    name: unknownDefinition.name,
    label: `Подбор: ${unknownDefinition.label}`,
    unit: unknownDefinition.unit,
    minimum: guessMinimum,
    maximum: guessMaximum,
    step: safeGuessStep,
  };
  const defaultTarget = useMemo(() => evaluateState(preset, defaults).value ?? ZERO, [defaults, preset]);
  const target = safeExact(targetValue, defaultTarget);
  const comparison = current.value ? comparisonText(current.value, target, preset.output.unit) : undefined;
  const trace = current.error ? [] : traceEvaluation(preset.ast, values).slice(0, MAX_TRACE_STEPS);
  const tableInputs = useMemo(() => {
    const source = tableValues && tableValues.length > 0 ? tableValues : [0, 1, 2, 3, 4];
    return source.slice(0, MAX_TABLE_ROWS).map((value) => safeExact(value, ZERO));
  }, [tableValues]);
  const tableRows = tableInputs.map((input) => {
    const rowValues = { ...values, [activeTableVariable]: input };
    return { input, state: evaluateState(preset, rowValues) };
  });
  const activeTableDefinition = preset.variables.find((definition) => definition.name === activeTableVariable);
  const formulaText = humanFormula(preset);
  const issueIdsFor = (variable: string): string => current.issues
    .map((issue, index) => issue.variable === variable ? `${labId}-issue-${index}` : '')
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    focusHorizontalScroller(visualScroller.current);
  }, [preset]);

  const reset = () => {
    setValues(defaults);
    setActiveMode(mode);
    setActiveTableVariable(defaultTableVariable);
    setActiveUnknownVariable(defaultUnknownVariable);
  };

  return (
    <section className="dm-lab dm-algebra-formula-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория формул</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>{preset.title}</h3>
          <p>{preset.description}</p>
        </div>
        <span className="dm-lab__badge">{formulaText}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-algebra-tabs" role="group" aria-label="Режим работы с формулой">
          <button type="button" className={`dm-algebra-tab ${activeMode === 'evaluate' ? 'dm-algebra-tab--active' : ''}`} aria-pressed={activeMode === 'evaluate'} onClick={() => setActiveMode('evaluate')}>Вычислить</button>
          <button type="button" className={`dm-algebra-tab ${activeMode === 'table' ? 'dm-algebra-tab--active' : ''}`} aria-pressed={activeMode === 'table'} onClick={() => setActiveMode('table')}>Таблица</button>
          <button type="button" className={`dm-algebra-tab ${activeMode === 'unknown-bridge' ? 'dm-algebra-tab--active' : ''}`} aria-pressed={activeMode === 'unknown-bridge'} onClick={() => setActiveMode('unknown-bridge')}>Подобрать вход</button>
        </div>

        <div className="dm-lab__controls dm-algebra-controls">
          {fieldModels.filter((model) => activeMode !== 'unknown-bridge' || model.name !== activeUnknownVariable).map((model) => (
            <FormulaField id={`${labId}-${model.name}`} model={model} value={values[model.name] ?? ZERO} issueIds={issueIdsFor(model.name)} onChange={(value) => setValues((currentValues) => ({ ...currentValues, [model.name]: value }))} key={model.name} />
          ))}
          {activeMode === 'unknown-bridge' && (
            <FormulaField id={`${labId}-guess-${activeUnknownVariable}`} model={guessModel} value={values[activeUnknownVariable] ?? unknownDefinition.initial} issueIds={issueIdsFor(activeUnknownVariable)} onChange={(value) => setValues((currentValues) => ({ ...currentValues, [activeUnknownVariable]: value }))} />
          )}
        </div>

        <div className="dm-algebra-equation" role="math" aria-label={formulaText} data-latex={preset.latex}>
          <span>{formulaText}</span>
          <span aria-hidden="true">→</span>
          <strong>{current.value ? withUnit(current.value, preset.output.unit) : 'не определено'}</strong>
        </div>

        <div ref={visualScroller} className="dm-algebra-visual-wrap" role="region" aria-label="Прокручиваемая схема формулы" tabIndex={0}>
          <FormulaFlow id={`${labId}-flow`} preset={preset} values={values} output={current.value} hasIssues={current.issues.length > 0 || Boolean(current.error)} />
        </div>

        <aside className={`dm-algebra-constraints ${current.issues.length === 0 ? 'dm-algebra-constraints--valid' : 'dm-algebra-constraints--warning'}`} aria-labelledby={`${labId}-constraints-heading`}>
          <p className="dm-algebra-constraints__caption">Проверка смысла величин</p>
          <h4 id={`${labId}-constraints-heading`}>{current.issues.length === 0 ? 'Условия модели выполнены' : 'Есть значения вне контекста'}</h4>
          {current.issues.length > 0 ? (
            <ul>{current.issues.map((issue, index) => <li id={`${labId}-issue-${index}`} key={`${issue.variable ?? 'formula'}-${issue.code}-${index}`}>{issue.message}</li>)}</ul>
          ) : (
            <p>Все входы лежат в допустимых диапазонах{preset.variables.some((definition) => definition.integer) ? ', а счётные величины остаются целыми' : ''}.</p>
          )}
        </aside>

        {activeMode === 'evaluate' && trace.length > 0 && (
          <ol className="dm-algebra-formula-trace">
            {trace.map((step, index) => (
              <li key={`${step.nodeId}-${index}`}><span>{index + 1}</span><p><small>{step.reason === 'substitute' ? 'Подстановка' : 'Действие'}</small><strong>{step.before} → {step.after}</strong></p></li>
            ))}
          </ol>
        )}

        {activeMode === 'table' && (
          <section className="dm-algebra-table-panel" aria-labelledby={`${labId}-table-heading`}>
            <div className="dm-algebra-table-panel__header">
              <div><p className="dm-algebra-table-panel__caption">Один план — несколько входов</p><h4 id={`${labId}-table-heading`}>Таблица модели</h4></div>
              {preset.variables.length > 1 && (
                <div className="dm-algebra-table-variable" role="group" aria-label="Переменная таблицы">
                  {preset.variables.map((definition) => <button type="button" className={activeTableVariable === definition.name ? 'dm-algebra-table-variable--active' : ''} aria-pressed={activeTableVariable === definition.name} onClick={() => setActiveTableVariable(definition.name)} key={definition.name}>{definition.name}</button>)}
                </div>
              )}
            </div>
            <div className="dm-algebra-table-wrap" role="region" aria-label="Прокручиваемая таблица формулы" tabIndex={0}>
              <table className="dm-algebra-table">
                <thead><tr><th scope="col">{activeTableVariable}{activeTableDefinition?.unit ? `, ${activeTableDefinition.unit}` : ''}</th><th scope="col">{preset.output.name}{preset.output.unit ? `, ${preset.output.unit}` : ''}</th><th scope="col">Контекст</th></tr></thead>
                <tbody>
                  {tableRows.map(({ input, state }, index) => (
                    <tr className={state.error || state.issues.length > 0 ? 'dm-algebra-table__row--undefined' : ''} key={`${format(input)}-${index}`}>
                      <th scope="row">{format(input)}</th>
                      <td>{state.value ? withUnit(state.value, preset.output.unit) : '—'}</td>
                      <td>{state.error ?? state.issues[0]?.message ?? 'допустимо'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeMode === 'unknown-bridge' && (
          <section className="dm-algebra-unknown" aria-labelledby={`${labId}-unknown-heading`}>
            <p className="dm-algebra-unknown__caption">Мост к уравнениям</p>
            <h4 id={`${labId}-unknown-heading`}>Цель: {preset.output.name} = {withUnit(target, preset.output.unit)}</h4>
            {preset.variables.length > 1 && (
              <div className="dm-algebra-unknown-variable" role="group" aria-label="Неизвестный вход">
                {preset.variables.map((definition) => <button type="button" className={activeUnknownVariable === definition.name ? 'dm-algebra-unknown-variable--active' : ''} aria-pressed={activeUnknownVariable === definition.name} onClick={() => setActiveUnknownVariable(definition.name)} key={definition.name}>{definition.name}</button>)}
              </div>
            )}
            <div className={`dm-algebra-unknown__comparison dm-algebra-unknown__comparison--${comparison?.kind ?? 'undefined'}`}>
              <strong>{current.error ?? comparison?.text ?? 'Результат не определён.'}</strong>
              <p>{comparison?.kind === 'equal' ? 'Равенство выполнено точно — без округления.' : `Меняй ${activeUnknownVariable} с шагом ${format(safeGuessStep)} и следи, приближается ли результат к цели.`}</p>
            </div>
          </section>
        )}

        <div className={`dm-result ${current.error || current.issues.length > 0 ? 'dm-algebra-result--warning' : ''}`} aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{current.error ? '!' : activeMode === 'unknown-bridge' && comparison?.kind === 'equal' ? '=' : 'ƒ'}</span>
          <p>
            <strong>{current.error ?? (activeMode === 'unknown-bridge' ? comparison?.text : `${preset.output.label}: ${current.value ? withUnit(current.value, preset.output.unit) : 'не определено'}.`)}</strong>
            <small>{current.issues.length > 0 ? `Число вычислено формально, но модель предупреждает: ${current.issues[0]!.message}` : activeMode === 'table' ? `В строках меняется ${activeTableVariable}, остальные входы закреплены.` : activeMode === 'unknown-bridge' ? `Сравнение с целью выполнено точно для ${activeUnknownVariable} = ${format(values[activeUnknownVariable] ?? ZERO)}.` : 'Единицы входов подсказывают единицу результата и помогают проверить смысл формулы.'}</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
