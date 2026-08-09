import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  type ExactRational,
  addExact,
  compareExact,
  formatExactRussian,
  multiplyExact,
  negateExact,
  parseExact,
} from '../lib/exactRational';

export interface AlgebraTermSpec {
  coefficient: number;
  variable?: string;
}

export type LikeTermsMode = 'sort' | 'combine';

export interface LikeTermsLabProps {
  initialTerms: readonly AlgebraTermSpec[];
  allowedVariables?: readonly string[];
  sampleValues?: Readonly<Record<string, number>>;
  initialMode?: LikeTermsMode;
}

interface NormalizedTerm {
  coefficient: ExactRational;
  variable?: string;
  sourceIndex: number;
}

interface SampleFieldProps {
  id: string;
  variable: string;
  value: ExactRational;
  onChange: (value: ExactRational) => void;
}

const ZERO = parseExact('0');
const ONE = parseExact('1');
const SAMPLE_MINIMUM = parseExact('-20');
const SAMPLE_MAXIMUM = parseExact('20');
const DECIMAL_DRAFT = /^[+-]?(?:\d*(?:[.,]\d*)?)?$/;
const MAX_TERMS = 12;
const MAX_VARIABLES = MAX_TERMS;
const MAX_DRAFT_LENGTH = 64;

function safeExact(value: number | undefined, fallback = 0): ExactRational {
  try {
    return parseExact(value !== undefined && Number.isFinite(value) ? value : fallback);
  } catch {
    return parseExact(fallback);
  }
}

function normalizeVariable(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9_]{0,7}$/u.test(trimmed) ? trimmed : undefined;
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

function clampSample(value: ExactRational): ExactRational {
  if (compareExact(value, SAMPLE_MINIMUM) < 0) return SAMPLE_MINIMUM;
  if (compareExact(value, SAMPLE_MAXIMUM) > 0) return SAMPLE_MAXIMUM;
  return value;
}

function SampleField({ id, variable, value, onChange }: SampleFieldProps) {
  const [draft, setDraft] = useState(format(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);
  const valueAtFocus = useRef(value);

  useEffect(() => {
    if (!editing) setDraft(format(value));
  }, [editing, value]);

  const nudge = (direction: -1 | 1) => onChange(clampSample(addExact(value, direction)));

  return (
    <div className="dm-field dm-algebra-field">
      <label htmlFor={id}>Значение {variable} <span className="dm-field__value">{format(value)}</span></label>
      <div className="dm-algebra-field__control">
        <button type="button" className="dm-algebra-field__step" onClick={() => nudge(-1)} disabled={compareExact(value, SAMPLE_MINIMUM) <= 0} aria-label={`Уменьшить ${variable} на один`}>−</button>
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
            if (parsed !== null && compareExact(parsed, SAMPLE_MINIMUM) >= 0 && compareExact(parsed, SAMPLE_MAXIMUM) <= 0) onChange(parsed);
          }}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              onChange(valueAtFocus.current);
              setDraft(format(valueAtFocus.current));
            } else {
              const parsed = parseDraft(draft);
              const next = parsed === null ? value : clampSample(parsed);
              onChange(next);
              setDraft(format(next));
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
        <button type="button" className="dm-algebra-field__step" onClick={() => nudge(1)} disabled={compareExact(value, SAMPLE_MAXIMUM) >= 0} aria-label={`Увеличить ${variable} на один`}>+</button>
      </div>
      <small id={`${id}-hint`}>Проверочное значение от −20 до 20.</small>
    </div>
  );
}

function absolute(value: ExactRational): ExactRational {
  return compareExact(value, ZERO) < 0 ? negateExact(value) : value;
}

function unsignedTerm(term: NormalizedTerm): string {
  if (!term.variable) return format(absolute(term.coefficient));
  const magnitude = absolute(term.coefficient);
  if (compareExact(magnitude, ONE) === 0) return term.variable;
  return `${format(magnitude)}${term.variable}`;
}

function termText(term: NormalizedTerm, leading: boolean): string {
  const comparison = compareExact(term.coefficient, ZERO);
  if (comparison === 0) {
    const zeroBody = term.variable ? `0${term.variable}` : '0';
    return leading ? zeroBody : `+ ${zeroBody}`;
  }
  const body = unsignedTerm(term);
  if (leading) return comparison < 0 ? `−${body}` : body;
  return comparison < 0 ? `− ${body}` : `+ ${body}`;
}

function combinedTermText(coefficient: ExactRational, variable: string | undefined, leading: boolean): string {
  return termText({ coefficient, variable, sourceIndex: -1 }, leading);
}

function groupKey(variable: string | undefined): string {
  return variable ?? '__constant__';
}

function groupLabel(key: string): string {
  return key === '__constant__' ? 'Числа без букв' : `Слагаемые с ${key}`;
}

function coefficientSumText(terms: readonly NormalizedTerm[]): string {
  return terms.map((term, index) => {
    if (index === 0) return format(term.coefficient);
    return compareExact(term.coefficient, ZERO) < 0
      ? `− ${format(absolute(term.coefficient))}`
      : `+ ${format(term.coefficient)}`;
  }).join(' ');
}

interface GroupMapProps {
  id: string;
  terms: readonly NormalizedTerm[];
  groups: readonly string[];
  activeGroup: string;
  assigned: ReadonlySet<number>;
  selectedTerm: number | null;
}

function GroupMap({ id, terms, groups, activeGroup, assigned, selectedTerm }: GroupMapProps) {
  const rowHeight = 64;
  const laneTop = 78;
  const height = laneTop + groups.length * rowHeight + 12;
  const positions = new Map<string, number>();
  const descriptions = groups.map((key) => {
    const count = terms.filter((term) => assigned.has(term.sourceIndex) && groupKey(term.variable) === key).length;
    return `${groupLabel(key)}: ${count}`;
  });
  const unassigned = terms.filter((term) => !assigned.has(term.sourceIndex));

  return (
    <svg className="dm-algebra-group-map" viewBox={`0 0 740 ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Сортировка подобных слагаемых</title>
      <desc id={`${id}-desc`}>Неразложенных карточек: {unassigned.length}. {descriptions.join('. ')}. Подобными являются только слагаемые с одинаковой буквенной частью.</desc>
      <g className="dm-algebra-group-map__neutral" aria-hidden="true">
        <rect x="12" y="8" width="716" height="58" rx="12" />
        <text x="27" y="42">разобрать</text>
      </g>
      {unassigned.map((term, index) => (
        <g
          className={`dm-algebra-group-map__term ${term.sourceIndex === selectedTerm ? 'dm-algebra-group-map__term--selected' : ''}`}
          transform={`translate(${158 + index * 45} 37)`}
          key={`neutral-${term.sourceIndex}`}
          aria-hidden="true"
        >
          <rect x="-19" y="-17" width="38" height="34" rx="8" />
          <text y="5">{termText(term, true)}</text>
        </g>
      ))}
      {groups.map((key, row) => {
        positions.set(key, 0);
        const selected = key === activeGroup;
        return (
          <g className={`dm-algebra-group-map__lane ${selected ? 'dm-algebra-group-map__lane--active' : ''}`} key={key} aria-hidden="true">
            <rect x="12" y={laneTop + row * rowHeight} width="716" height="50" rx="12" />
            <text x="27" y={laneTop + row * rowHeight + 31}>{key === '__constant__' ? 'числа' : key}</text>
          </g>
        );
      })}
      {terms.filter((term) => assigned.has(term.sourceIndex)).map((term) => {
        const key = groupKey(term.variable);
        const row = groups.indexOf(key);
        const index = positions.get(key) ?? 0;
        positions.set(key, index + 1);
        const x = 158 + index * 45;
        const y = laneTop + row * rowHeight + 25;
        const selected = key === activeGroup;
        return (
          <g className={`dm-algebra-group-map__term dm-algebra-group-map__term--assigned ${selected ? 'dm-algebra-group-map__term--active' : 'dm-algebra-group-map__term--muted'}`} transform={`translate(${x} ${y})`} key={term.sourceIndex} aria-hidden="true">
            <rect x="-19" y="-17" width="38" height="34" rx="8" />
            <text y="5">{termText(term, true)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function LikeTermsLab({
  initialTerms,
  allowedVariables,
  sampleValues,
  initialMode = 'sort',
}: LikeTermsLabProps) {
  const reactId = useId();
  const labId = `algebra-like-terms-${reactId.replace(/:/g, '')}`;
  const terms = useMemo<readonly NormalizedTerm[]>(() => initialTerms
    .slice(0, MAX_TERMS)
    .flatMap((term, index) => {
      const variable = normalizeVariable(term.variable);
      const hasInvalidVariable = Boolean(term.variable?.trim()) && variable === undefined;
      if (!Number.isFinite(term.coefficient) || hasInvalidVariable) return [];
      return [{ coefficient: safeExact(term.coefficient), variable, sourceIndex: index }];
    }), [initialTerms]);
  const variables = useMemo(() => {
    const result: string[] = [];
    const add = (candidate: string | undefined) => {
      if (candidate && !result.includes(candidate) && result.length < MAX_VARIABLES) result.push(candidate);
    };
    terms.forEach((term) => add(term.variable));
    allowedVariables?.slice(0, MAX_VARIABLES).forEach((candidate) => add(normalizeVariable(candidate)));
    return result;
  }, [allowedVariables, terms]);
  const visibleTerms = useMemo(() => terms.filter((term) => !term.variable || variables.includes(term.variable)), [terms, variables]);
  const groups = useMemo(() => [...variables, '__constant__'], [variables]);
  const defaultSamples = useMemo(() => Object.fromEntries(variables.map((name, index) => [
    name,
    clampSample(safeExact(sampleValues?.[name], index === 0 ? 2 : -1)),
  ])) as Record<string, ExactRational>, [sampleValues, variables]);
  const [mode, setMode] = useState<LikeTermsMode>(initialMode);
  const [activeGroup, setActiveGroup] = useState(groups[0] ?? '__constant__');
  const [samples, setSamples] = useState<Record<string, ExactRational>>(defaultSamples);
  const initiallyAssigned = useMemo(() => new Set(initialMode === 'combine' ? visibleTerms.map((term) => term.sourceIndex) : []), [initialMode, visibleTerms]);
  const [assigned, setAssigned] = useState<Set<number>>(initiallyAssigned);
  const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(initialMode === 'combine' ? 'Все слагаемые уже разложены: можно складывать коэффициенты.' : 'Выбери карточку, затем укажи для неё группу.');
  const [feedbackKind, setFeedbackKind] = useState<'neutral' | 'correct' | 'wrong'>('neutral');

  const sums = useMemo(() => {
    const result = new Map<string, ExactRational>(groups.map((key) => [key, ZERO]));
    visibleTerms.forEach((term) => {
      const key = groupKey(term.variable);
      result.set(key, addExact(result.get(key) ?? ZERO, term.coefficient));
    });
    return result;
  }, [groups, visibleTerms]);

  const originalValue = visibleTerms.reduce((total, term) => {
    const value = term.variable ? (samples[term.variable] ?? ZERO) : ONE;
    return addExact(total, multiplyExact(term.coefficient, value));
  }, ZERO);
  const combinedValue = groups.reduce((total, key) => {
    const variableValue = key === '__constant__' ? ONE : (samples[key] ?? ZERO);
    return addExact(total, multiplyExact(sums.get(key) ?? ZERO, variableValue));
  }, ZERO);
  const equal = compareExact(originalValue, combinedValue) === 0;
  const originalExpression = visibleTerms.length > 0 ? visibleTerms.map((term, index) => termText(term, index === 0)).join(' ') : '0';
  const nonZeroCombined = groups.filter((key) => compareExact(sums.get(key) ?? ZERO, ZERO) !== 0);
  const combinedExpression = nonZeroCombined.length > 0
    ? nonZeroCombined.map((key, index) => combinedTermText(sums.get(key) ?? ZERO, key === '__constant__' ? undefined : key, index === 0)).join(' ')
    : '0';
  const activeTerms = visibleTerms.filter((term) => groupKey(term.variable) === activeGroup);
  const assignedActiveTerms = activeTerms.filter((term) => assigned.has(term.sourceIndex));
  const activeSum = sums.get(activeGroup) ?? ZERO;
  const assignedCount = visibleTerms.filter((term) => assigned.has(term.sourceIndex)).length;
  const allAssigned = assignedCount === visibleTerms.length;

  const selectTerm = (term: NormalizedTerm) => {
    if (assigned.has(term.sourceIndex)) return;
    setSelectedTerm(term.sourceIndex);
    setFeedback(`Карточка ${termText(term, true)} выбрана. Теперь нажми подходящую группу.`);
    setFeedbackKind('neutral');
  };

  const attemptGroup = (key: string) => {
    setActiveGroup(key);
    if (selectedTerm === null) {
      setFeedback(allAssigned ? 'Все карточки разложены. Переходи к приведению подобных слагаемых.' : 'Сначала выбери неразложенную карточку.');
      setFeedbackKind('neutral');
      return;
    }
    const term = visibleTerms.find((candidate) => candidate.sourceIndex === selectedTerm);
    if (!term) return;
    const actual = groupKey(term.variable);
    if (actual !== key) {
      setFeedback(`${termText(term, true)} не относится к группе «${groupLabel(key)}»: буквенная часть не совпадает.`);
      setFeedbackKind('wrong');
      return;
    }
    const nextAssigned = new Set(assigned).add(term.sourceIndex);
    const nextTerm = visibleTerms.find((candidate) => !nextAssigned.has(candidate.sourceIndex));
    setAssigned(nextAssigned);
    setSelectedTerm(nextTerm?.sourceIndex ?? null);
    setFeedback(nextTerm
      ? `Верно: ${termText(term, true)} отправлено в группу «${groupLabel(key)}». Следующая карточка ${termText(nextTerm, true)} уже выбрана.`
      : 'Все карточки разложены верно. Теперь открой режим «Привести».');
    setFeedbackKind('correct');
  };

  const reset = () => {
    setMode(initialMode);
    setActiveGroup(groups[0] ?? '__constant__');
    setSamples(defaultSamples);
    setAssigned(new Set(initiallyAssigned));
    setSelectedTerm(null);
    setFeedback(initialMode === 'combine' ? 'Все слагаемые уже разложены: можно складывать коэффициенты.' : 'Выбери карточку, затем укажи для неё группу.');
    setFeedbackKind('neutral');
  };

  return (
    <section className="dm-lab dm-algebra-like-terms not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория подобных слагаемых</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Сначала разложить по группам, затем сложить коэффициенты</h3>
          <p>Буквенная часть — ярлык группы. Числа без букв образуют отдельную группу.</p>
        </div>
        <span className="dm-lab__badge">{visibleTerms.length} слагаемых</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-algebra-tabs" role="group" aria-label="Этап работы">
          <button type="button" className={`dm-algebra-tab ${mode === 'sort' ? 'dm-algebra-tab--active' : ''}`} aria-pressed={mode === 'sort'} onClick={() => setMode('sort')}>Разложить</button>
          <button type="button" className={`dm-algebra-tab ${mode === 'combine' ? 'dm-algebra-tab--active' : ''}`} aria-pressed={mode === 'combine'} onClick={() => setMode('combine')} disabled={!allAssigned}>Привести</button>
        </div>

        <div className="dm-algebra-expression-strip" aria-label={`Исходное выражение: ${originalExpression}`}>
          {visibleTerms.length === 0 ? <span>0</span> : visibleTerms.map((term, index) => (
            <button
              type="button"
              className={`dm-algebra-term-button ${term.sourceIndex === selectedTerm ? 'dm-algebra-term-button--selected' : ''} ${assigned.has(term.sourceIndex) ? 'dm-algebra-term-button--assigned' : ''}`}
              aria-pressed={term.sourceIndex === selectedTerm}
              disabled={assigned.has(term.sourceIndex)}
              onClick={() => selectTerm(term)}
              key={term.sourceIndex}
            >
              {termText(term, index === 0)}
            </button>
          ))}
        </div>

        <div className="dm-algebra-group-buttons" role="group" aria-label="Выбрать группу подобных слагаемых">
          {groups.map((key) => (
            <button type="button" className={`dm-algebra-group-button ${activeGroup === key ? 'dm-algebra-group-button--active' : ''}`} aria-pressed={activeGroup === key} onClick={() => attemptGroup(key)} key={key}>
              {key === '__constant__' ? 'Числа' : key}
              <span>{visibleTerms.filter((term) => groupKey(term.variable) === key && (mode === 'combine' || assigned.has(term.sourceIndex))).length}</span>
            </button>
          ))}
        </div>

        <div className="dm-algebra-visual-wrap" role="region" aria-label="Прокручиваемая схема группировки" tabIndex={0}>
          <GroupMap id={`${labId}-groups`} terms={visibleTerms} groups={groups} activeGroup={activeGroup} assigned={mode === 'combine' ? new Set(visibleTerms.map((term) => term.sourceIndex)) : assigned} selectedTerm={selectedTerm} />
        </div>

        <section className="dm-algebra-group-detail" aria-labelledby={`${labId}-group-heading`}>
          <p className="dm-algebra-group-detail__caption">Выбрана группа</p>
          <h4 id={`${labId}-group-heading`}>{groupLabel(activeGroup)}</h4>
          <p>
            {(mode === 'combine' ? activeTerms : assignedActiveTerms).length === 0
              ? 'В этой группе пока нет разложенных слагаемых.'
              : mode === 'combine'
                ? `${coefficientSumText(activeTerms)} = ${format(activeSum)} — складываем только коэффициенты.`
                : `${assignedActiveTerms.map((term) => termText(term, true)).join(', ')} — карточки уже проверены.`}
          </p>
        </section>

        {mode === 'combine' && (
          <>
            <div className="dm-algebra-equation" role="math" aria-label={`${originalExpression} равно ${combinedExpression}`}>
              <span>{originalExpression}</span>
              <span aria-hidden="true">=</span>
              <strong>{combinedExpression}</strong>
            </div>

            {variables.length > 0 && (
              <div className="dm-lab__controls dm-algebra-controls">
                {variables.map((name) => (
                  <SampleField
                    id={`${labId}-sample-${name}`}
                    variable={name}
                    value={samples[name] ?? ZERO}
                    onChange={(value) => setSamples((current) => ({ ...current, [name]: value }))}
                    key={name}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <div className={`dm-result ${mode === 'sort' && feedbackKind === 'wrong' ? 'dm-algebra-result--warning' : ''}`} aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{mode === 'sort' ? (feedbackKind === 'wrong' ? '!' : assignedCount) : (equal ? '=' : '!')}</span>
          <p>
            <strong>{mode === 'sort' ? feedback : `${originalExpression} = ${combinedExpression}`}</strong>
            <small>{mode === 'combine' ? `Числовая проверка: исходная запись даёт ${format(originalValue)}, упрощённая — ${format(combinedValue)}. Значения ${equal ? 'совпадают точно' : 'не совпали'}.` : `Разложено ${assignedCount} из ${visibleTerms.length}. Одинаковая буква означает одинаковую буквенную часть.`}</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
