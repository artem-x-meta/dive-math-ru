import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlgebraError,
  type EvaluationReason,
  type EvaluationStep,
  type ExpressionNode,
  evaluateExpression,
  formatExpressionLatex,
  parseExpression,
  traceEvaluation,
} from '../lib/algebra';
import {
  type ExactRational,
  addExact,
  compareExact,
  formatExactRussian,
  negateExact,
  parseExact,
  subtractExact,
} from '../lib/exactRational';

export type ExpressionMachineMode = 'substitute' | 'order' | 'table';

export interface ExpressionVariableSpec {
  name: string;
  label: string;
  initial: number;
  min: number;
  max: number;
  step: number;
}

export interface ExpressionMachineLabProps {
  expression: string;
  mode?: ExpressionMachineMode;
  variables: readonly ExpressionVariableSpec[];
  resultLabel?: string;
  showTrace?: boolean;
  tableVariable?: string;
  tableValues?: readonly number[];
}

interface VariableModel {
  name: string;
  label: string;
  minimum: ExactRational;
  maximum: ExactRational;
  step: ExactRational;
  initial: ExactRational;
}

interface ExactFieldProps {
  id: string;
  model: VariableModel;
  value: ExactRational;
  onChange: (value: ExactRational) => void;
}

interface EvaluationState {
  value?: ExactRational;
  steps: readonly EvaluationStep[];
  error?: string;
  errorCode?: string;
}

const DECIMAL_DRAFT = /^[+-]?(?:\d*(?:[.,]\d*)?)?$/;
const ZERO = parseExact('0');
const MAX_VARIABLES = 6;
const MAX_TABLE_ROWS = 12;
const MAX_VISIBLE_STEPS = 24;
const MAX_DRAFT_LENGTH = 64;
const TREE_VIEWBOX_WIDTH = 740;
const HARD_MINIMUM = parseExact('-1000000');
const HARD_MAXIMUM = parseExact('1000000');

function safeExact(value: number, fallback: number): ExactRational {
  try {
    return parseExact(Number.isFinite(value) ? value : fallback);
  } catch {
    return parseExact(fallback);
  }
}

function clamp(value: ExactRational, minimum: ExactRational, maximum: ExactRational): ExactRational {
  if (compareExact(value, minimum) < 0) return minimum;
  if (compareExact(value, maximum) > 0) return maximum;
  return value;
}

function normalizeVariables(specs: readonly ExpressionVariableSpec[]): readonly VariableModel[] {
  const names = new Set<string>();
  const models: VariableModel[] = [];
  for (const spec of specs.slice(0, MAX_VARIABLES)) {
    const name = spec.name.trim();
    if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name) || names.has(name)) continue;
    names.add(name);
    let minimum = safeExact(spec.min, -10);
    let maximum = safeExact(spec.max, 10);
    minimum = compareExact(minimum, HARD_MINIMUM) < 0 ? HARD_MINIMUM : minimum;
    maximum = compareExact(maximum, HARD_MAXIMUM) > 0 ? HARD_MAXIMUM : maximum;
    if (compareExact(minimum, maximum) >= 0) {
      minimum = parseExact('-10');
      maximum = parseExact('10');
    }
    let step = safeExact(spec.step, 1);
    if (compareExact(step, ZERO) <= 0 || compareExact(step, subtractExact(maximum, minimum)) > 0) step = parseExact('1');
    const initial = clamp(safeExact(spec.initial, 0), minimum, maximum);
    models.push({
      name,
      label: spec.label.trim().slice(0, 80) || `Значение ${name}`,
      minimum,
      maximum,
      step,
      initial,
    });
  }
  return models;
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

function format(value: ExactRational): string {
  return formatExactRussian(value);
}

function focusHorizontalScroller(element: HTMLDivElement | null, fraction: number): void {
  if (!element) return;
  const maximum = Math.max(0, element.scrollWidth - element.clientWidth);
  const target = element.scrollWidth * Math.min(1, Math.max(0, fraction)) - element.clientWidth / 2;
  element.scrollLeft = Math.min(maximum, Math.max(0, Math.round(target)));
}

function ExactField({ id, model, value, onChange }: ExactFieldProps) {
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
      <label htmlFor={id}>{model.label} <span className="dm-field__value">{format(value)}</span></label>
      <div className="dm-algebra-field__control">
        <button type="button" className="dm-algebra-field__step" onClick={() => nudge(-1)} disabled={compareExact(value, model.minimum) <= 0} aria-label={`Уменьшить ${model.label.toLowerCase()} на ${format(model.step)}`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          maxLength={MAX_DRAFT_LENGTH}
          value={draft}
          aria-describedby={`${id}-hint`}
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
            if (parsed !== null && compareExact(parsed, model.minimum) >= 0 && compareExact(parsed, model.maximum) <= 0) onChange(parsed);
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
      <small id={`${id}-hint`}>От {format(model.minimum)} до {format(model.maximum)}, шаг {format(model.step)}.</small>
    </div>
  );
}

function evaluationError(error: unknown): { message: string; code: string } {
  if (error instanceof AlgebraError) {
    switch (error.code) {
      case 'division-by-zero':
        return { code: error.code, message: 'Значение не определено: делить на ноль нельзя.' };
      case 'missing-variable':
        return { code: error.code, message: 'Не хватает значения одной из переменных.' };
      case 'invalid-expression':
        return { code: error.code, message: 'Запись выражения некорректна.' };
      case 'limit-exceeded':
        return { code: error.code, message: 'Выражение слишком велико для этой учебной модели.' };
      case 'non-linear':
        return { code: error.code, message: 'Для этого режима нужно линейное выражение.' };
    }
  }
  return { code: 'unknown', message: 'Не удалось вычислить выражение.' };
}

function evaluate(ast: ExpressionNode, environment: Readonly<Record<string, ExactRational>>): EvaluationState {
  try {
    return {
      value: evaluateExpression(ast, environment),
      steps: traceEvaluation(ast, environment),
    };
  } catch (error) {
    const readable = evaluationError(error);
    return { steps: [], error: readable.message, errorCode: readable.code };
  }
}

function nodeLabel(node: ExpressionNode): string {
  if (node.kind === 'literal') return format(node.value);
  if (node.kind === 'variable') return node.name;
  if (node.kind === 'negate') return '−';
  if (node.operator === 'add') return '+';
  if (node.operator === 'subtract') return '−';
  if (node.operator === 'multiply') return '·';
  return '÷';
}

function nodeChildren(node: ExpressionNode): readonly ExpressionNode[] {
  if (node.kind === 'negate') return [node.operand];
  if (node.kind === 'binary') return [node.left, node.right];
  return [];
}

interface PositionedNode {
  node: ExpressionNode;
  x: number;
  y: number;
  parentId?: string;
}

function layoutExpressionTree(root: ExpressionNode): { nodes: readonly PositionedNode[]; height: number } {
  const provisional: Array<{ node: ExpressionNode; parentId?: string; leaf: number }> = [];
  let leaf = 0;
  let maximumDepth = 0;

  const visit = (node: ExpressionNode, depth: number, parentId?: string): number => {
    maximumDepth = Math.max(maximumDepth, depth);
    const children = nodeChildren(node);
    let location: number;
    if (children.length === 0) {
      location = leaf;
      leaf += 1;
    } else {
      const childLocations = children.map((child) => visit(child, depth + 1, node.id));
      location = childLocations.reduce((total, value) => total + value, 0) / childLocations.length;
    }
    provisional.push({ node, parentId, leaf: location });
    return location;
  };

  visit(root, 0);
  const leafCount = Math.max(1, leaf);
  const left = 45;
  const right = 695;
  const top = 38;
  const levelHeight = 82;
  const nodes = provisional.map(({ leaf: leafPosition, ...entry }) => ({
    ...entry,
    x: leafCount === 1 ? 370 : left + (leafPosition / (leafCount - 1)) * (right - left),
    y: top,
  }));
  const depthById = new Map<string, number>();
  const setDepth = (node: ExpressionNode, depth: number) => {
    depthById.set(node.id, depth);
    nodeChildren(node).forEach((child) => setDepth(child, depth + 1));
  };
  setDepth(root, 0);
  return {
    nodes: nodes.map((entry) => ({ ...entry, y: top + (depthById.get(entry.node.id) ?? 0) * levelHeight })),
    height: top * 2 + maximumDepth * levelHeight + 56,
  };
}

export function expressionTreeRootFocusFraction(ast: ExpressionNode): number {
  const root = layoutExpressionTree(ast).nodes.find((entry) => entry.node === ast);
  return root ? root.x / TREE_VIEWBOX_WIDTH : 0.5;
}

interface ExpressionTreeProps {
  id: string;
  ast: ExpressionNode;
  environment: Readonly<Record<string, ExactRational>>;
  evaluatedNodeIds: ReadonlySet<string>;
}

function ExpressionTree({ id, ast, environment, evaluatedNodeIds }: ExpressionTreeProps) {
  const layout = layoutExpressionTree(ast);
  const byId = new Map(layout.nodes.map((entry) => [entry.node.id, entry]));
  const valueFor = (node: ExpressionNode): string => {
    try {
      return format(evaluateExpression(node, environment));
    } catch (error) {
      return error instanceof AlgebraError && error.code === 'division-by-zero' ? 'не определено' : '?';
    }
  };

  return (
    <svg className="dm-algebra-expression-tree" viewBox={`0 0 ${TREE_VIEWBOX_WIDTH} ${layout.height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Дерево порядка действий</title>
      <desc id={`${id}-desc`}>Листья — числа и переменные. Каждый знак выше объединяет результаты своих ветвей. Значение корня — значение всего выражения.</desc>
      {layout.nodes.map((entry) => {
        if (!entry.parentId) return null;
        const parent = byId.get(entry.parentId);
        return parent ? <line className="dm-algebra-expression-tree__edge" x1={parent.x} y1={parent.y + 23} x2={entry.x} y2={entry.y - 23} aria-hidden="true" key={`edge-${entry.node.id}`} /> : null;
      })}
      {layout.nodes.map((entry) => {
        const active = evaluatedNodeIds.has(entry.node.id);
        const isOperator = entry.node.kind === 'negate' || entry.node.kind === 'binary';
        return (
          <g className={`dm-algebra-expression-tree__node ${isOperator ? 'dm-algebra-expression-tree__node--operator' : ''} ${active ? 'dm-algebra-expression-tree__node--evaluated' : ''}`} transform={`translate(${entry.x} ${entry.y})`} aria-hidden="true" key={entry.node.id}>
            <rect x="-34" y="-22" width="68" height="44" rx="12" />
            <text y="5">{nodeLabel(entry.node)}</text>
            <text className="dm-algebra-expression-tree__value" y="39">{valueFor(entry.node)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function reasonLabel(reason: EvaluationReason): string {
  switch (reason) {
    case 'substitute': return 'Подстановка';
    case 'parentheses': return 'Скобки';
    case 'multiply-divide': return 'Умножение или деление';
    case 'add-subtract': return 'Сложение или вычитание';
  }
}

function humanExpression(source: string): string {
  return source.replaceAll('*', ' · ').replaceAll('/', ' ÷ ').replace(/\s+/g, ' ').trim();
}

export default function ExpressionMachineLab({
  expression,
  mode = 'substitute',
  variables,
  resultLabel = 'Значение выражения',
  showTrace = true,
  tableVariable,
  tableValues,
}: ExpressionMachineLabProps) {
  const reactId = useId();
  const labId = `algebra-expression-${reactId.replace(/:/g, '')}`;
  const models = useMemo(() => normalizeVariables(variables), [variables]);
  const modelKey = models.map((model) => model.name).join('|');
  const initialEnvironment = useMemo(() => Object.fromEntries(models.map((model) => [model.name, model.initial])) as Record<string, ExactRational>, [models]);
  const [environment, setEnvironment] = useState<Record<string, ExactRational>>(initialEnvironment);
  const [activeMode, setActiveMode] = useState<ExpressionMachineMode>(mode);
  const defaultTableVariable = models.some((model) => model.name === tableVariable) ? tableVariable! : (models[0]?.name ?? '');
  const [activeTableVariable, setActiveTableVariable] = useState(defaultTableVariable);
  const visualScroller = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => {
    try {
      const ast = parseExpression(expression, modelKey ? modelKey.split('|') : []);
      return { ast, error: undefined };
    } catch (error) {
      return { ast: undefined, error: evaluationError(error).message };
    }
  }, [expression, modelKey]);
  const current = parsed.ast ? evaluate(parsed.ast, environment) : { steps: [], error: parsed.error, errorCode: 'invalid-expression' };
  const visibleSteps = current.steps.slice(0, MAX_VISIBLE_STEPS);
  const evaluatedNodeIds = new Set(current.steps.map((step) => step.nodeId));
  const rows = useMemo(() => {
    const source = tableValues && tableValues.length > 0 ? tableValues : [-2, -1, 0, 1, 2];
    return source.slice(0, MAX_TABLE_ROWS).map((value) => safeExact(value, 0));
  }, [tableValues]);
  const tableRows = parsed.ast && activeTableVariable ? rows.map((input) => {
    const rowEnvironment = { ...environment, [activeTableVariable]: input };
    const state = evaluate(parsed.ast!, rowEnvironment);
    return { input, state };
  }) : [];
  const expressionForPeople = humanExpression(expression);
  const latex = parsed.ast ? formatExpressionLatex(parsed.ast) : '';

  useEffect(() => {
    if (activeMode === 'order' && parsed.ast) {
      focusHorizontalScroller(visualScroller.current, expressionTreeRootFocusFraction(parsed.ast));
    }
  }, [activeMode, parsed.ast]);

  const reset = () => {
    setEnvironment(initialEnvironment);
    setActiveMode(mode);
    setActiveTableVariable(defaultTableVariable);
  };

  return (
    <section className="dm-lab dm-algebra-expression-machine not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Машина выражений</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Подставить числа и выполнить план</h3>
          <p>Дерево показывает, какие действия зависят друг от друга, а трассировка — в каком порядке они выполняются.</p>
        </div>
        <span className="dm-lab__badge">{expressionForPeople || 'выражение'}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-algebra-tabs" role="group" aria-label="Режим машины выражений">
          <button type="button" className={`dm-algebra-tab ${activeMode === 'substitute' ? 'dm-algebra-tab--active' : ''}`} aria-pressed={activeMode === 'substitute'} onClick={() => setActiveMode('substitute')}>Подстановка</button>
          <button type="button" className={`dm-algebra-tab ${activeMode === 'order' ? 'dm-algebra-tab--active' : ''}`} aria-pressed={activeMode === 'order'} onClick={() => setActiveMode('order')}>Порядок действий</button>
          <button type="button" className={`dm-algebra-tab ${activeMode === 'table' ? 'dm-algebra-tab--active' : ''}`} aria-pressed={activeMode === 'table'} onClick={() => setActiveMode('table')} disabled={models.length === 0}>Таблица</button>
        </div>

        {models.length > 0 && (
          <div className="dm-lab__controls dm-algebra-controls">
            {models.map((model) => (
              <ExactField id={`${labId}-${model.name}`} model={model} value={environment[model.name] ?? model.initial} onChange={(value) => setEnvironment((currentValues) => ({ ...currentValues, [model.name]: value }))} key={model.name} />
            ))}
          </div>
        )}

        <div className="dm-algebra-equation" role="math" aria-label={`Выражение ${expressionForPeople}`} data-latex={latex}>
          <span>{expressionForPeople}</span>
          <span aria-hidden="true">→</span>
          <strong>{current.value ? format(current.value) : 'не определено'}</strong>
        </div>

        {activeMode === 'order' && parsed.ast && (
          <div ref={visualScroller} className="dm-algebra-visual-wrap" role="region" aria-label="Прокручиваемое дерево выражения" tabIndex={0}>
            <ExpressionTree id={`${labId}-tree`} ast={parsed.ast} environment={environment} evaluatedNodeIds={evaluatedNodeIds} />
          </div>
        )}

        {activeMode !== 'table' && showTrace && parsed.ast && (
          <ol className="dm-algebra-trace">
            {visibleSteps.map((step, index) => (
              <li className={`dm-algebra-trace__step dm-algebra-trace__step--${step.reason}`} key={`${step.nodeId}-${index}`}>
                <span>{index + 1}</span>
                <p><small>{reasonLabel(step.reason)}</small><strong>{step.before} → {step.after}</strong></p>
              </li>
            ))}
            {current.steps.length > MAX_VISIBLE_STEPS && <li className="dm-algebra-trace__more">Показаны первые {MAX_VISIBLE_STEPS} шагов.</li>}
            {visibleSteps.length === 0 && !current.error && <li className="dm-algebra-trace__more">Действий нет: выражение уже является числом.</li>}
          </ol>
        )}

        {activeMode === 'table' && (
          <section className="dm-algebra-table-panel" aria-labelledby={`${labId}-table-heading`}>
            <div className="dm-algebra-table-panel__header">
              <div>
                <p className="dm-algebra-table-panel__caption">Меняем один вход</p>
                <h4 id={`${labId}-table-heading`}>Таблица значений</h4>
              </div>
              {models.length > 1 && (
                <div className="dm-algebra-table-variable" role="group" aria-label="Переменная таблицы">
                  {models.map((model) => <button type="button" className={activeTableVariable === model.name ? 'dm-algebra-table-variable--active' : ''} aria-pressed={activeTableVariable === model.name} onClick={() => setActiveTableVariable(model.name)} key={model.name}>{model.name}</button>)}
                </div>
              )}
            </div>
            <div className="dm-algebra-table-wrap" role="region" aria-label="Прокручиваемая таблица значений" tabIndex={0}>
              <table className="dm-algebra-table">
                <thead><tr><th scope="col">{activeTableVariable || 'вход'}</th><th scope="col">{resultLabel}</th><th scope="col">Состояние</th></tr></thead>
                <tbody>
                  {tableRows.map(({ input, state }, index) => (
                    <tr className={state.errorCode === 'division-by-zero' ? 'dm-algebra-table__row--undefined' : ''} key={`${format(input)}-${index}`}>
                      <th scope="row">{format(input)}</th>
                      <td>{state.value ? format(state.value) : '—'}</td>
                      <td>{state.error ?? 'определено'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className={`dm-result ${current.error ? 'dm-algebra-result--warning' : ''}`} aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{current.error ? '!' : 'ƒ'}</span>
          <p>
            <strong>{current.error ?? `${resultLabel}: ${current.value ? format(current.value) : 'не определено'}.`}</strong>
            <small>{current.errorCode === 'division-by-zero' ? 'Знаменатель стал равен нулю, поэтому у этой подстановки нет числового результата.' : activeMode === 'table' ? `В таблице меняется ${activeTableVariable}; остальные значения остаются закреплёнными.` : 'Сначала заменяем буквы числами, затем идём по дереву снизу вверх.'}</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
