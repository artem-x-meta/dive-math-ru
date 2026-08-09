import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatExactRussian, toExactNumber } from '../lib/exactRational';
import { linearExpression } from '../lib/linear';
import {
  EMPTY_SET,
  RELATIONS,
  bound,
  formatConditionText,
  formatInequalityText,
  formatIntervalText,
  formatSetText,
  interval,
  intersectSets,
  intervalName,
  linearInequality,
  relationText,
  setOf,
  solveInequalitySteps,
  solveLinearInequality,
  type NumberSet,
  type Relation,
} from '../lib/inequalities';

export type IneqIntervalMode = 'interval' | 'solve' | 'system';

export interface IneqIntervalLabProps {
  mode?: IneqIntervalMode;
  challenge?: boolean;
  /** Режимы «solve» и «system»: левая часть первого неравенства. */
  leftSlope?: number;
  leftConst?: number;
  relation?: Relation;
  /** Режим «solve»: правая часть первого неравенства. */
  rightSlope?: number;
  rightConst?: number;
  /** Режим «system»: второе неравенство secondSlope·x + secondConst ⋛ secondBound. */
  secondSlope?: number;
  secondConst?: number;
  secondRelation?: Relation;
  secondBound?: number;
  /** Режим «interval»: начальные границы. */
  initialLeft?: number;
  initialRight?: number;
}

type EndpointMode = 'closed' | 'open' | 'infinite';

const DRAFT_PATTERN = /^[+\-−]?\d*(?:[.,]\d*)?$/;
const MAX_DRAFT_LENGTH = 8;
const COEFFICIENT_LIMIT = 10;
const VALUE_LIMIT = 10;
const VALUE_STEP = 0.5;

const RELATION_HINTS: Readonly<Record<Relation, string>> = {
  lt: 'меньше',
  le: 'меньше или равно',
  gt: 'больше',
  ge: 'больше или равно',
};

const ENDPOINT_LABELS: Readonly<Record<EndpointMode, string>> = {
  closed: 'включена',
  open: 'не включена',
  infinite: 'бесконечность',
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function numberText(value: number): string {
  return String(value).replace('.', ',').replace('-', '−');
}

function draftText(value: number): string {
  return String(value).replace('.', ',');
}

function parseDraft(rawValue: string): number | null {
  const normalized = rawValue.trim().replace('−', '-').replace(',', '.');
  if (normalized === '' || normalized === '-' || normalized === '+' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeNumber(value: number | undefined, fallback: number, limit: number, step: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clamp(quantize(value, step), -limit, limit);
}

function safeRelation(value: Relation | undefined, fallback: Relation): Relation {
  return value !== undefined && RELATIONS.includes(value) ? value : fallback;
}

interface StepperFieldProps {
  id: string;
  label: string;
  value: number;
  limit: number;
  step: number;
  onChange: (value: number) => void;
}

function StepperField({ id, label, value, limit, step, onChange }: StepperFieldProps) {
  const [draft, setDraft] = useState(draftText(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(draftText(value));
  }, [editing, value]);

  const commit = () => {
    const parsed = parseDraft(draft);
    const next = parsed === null ? value : clamp(quantize(parsed, step), -limit, limit);
    setDraft(draftText(next));
    onChange(next);
  };

  return (
    <div className="dm-field dm-signed-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{numberText(value)}</span>
      </label>
      <div className="dm-signed-field__control">
        <button
          type="button"
          className="dm-signed-field__step"
          onClick={() => onChange(clamp(quantize(value - step, step), -limit, limit))}
          disabled={value <= -limit}
          aria-label={`Уменьшить «${label}» на ${numberText(step)}`}
        >
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          maxLength={MAX_DRAFT_LENGTH}
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => {
            cancelCommit.current = false;
            setEditing(true);
          }}
          onChange={(event) => {
            if (DRAFT_PATTERN.test(event.target.value)) setDraft(event.target.value);
          }}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              setDraft(draftText(value));
              setEditing(false);
              return;
            }
            commit();
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
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          className="dm-signed-field__step"
          onClick={() => onChange(clamp(quantize(value + step, step), -limit, limit))}
          disabled={value >= limit}
          aria-label={`Увеличить «${label}» на ${numberText(step)}`}
        >
          +
        </button>
      </div>
      <small id={`${id}-hint`}>От −{limit} до {limit}, шаг {numberText(step)}</small>
    </div>
  );
}

interface RelationPickerProps {
  legend: string;
  value: Relation;
  onChange: (value: Relation) => void;
}

function RelationPicker({ legend, value, onChange }: RelationPickerProps) {
  return (
    <div className="dm-field dm-signed-field">
      <p className="dm-signed-caption">Знак: {relationText(value)} — {RELATION_HINTS[value]}</p>
      <div className="dm-geometry-preset-buttons" role="group" aria-label={legend}>
        {RELATIONS.map((item) => (
          <button
            type="button"
            key={item}
            aria-pressed={value === item}
            aria-label={`${legend}: ${RELATION_HINTS[item]}`}
            onClick={() => onChange(item)}
          >
            {relationText(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

interface NumberLineProps {
  id: string;
  title: string;
  set: NumberSet;
  minimum: number;
  maximum: number;
  hidden?: boolean;
}

/** Рисует множество решений на координатной прямой: жирная часть и границы. */
function IntervalLine({ id, title, set, minimum, maximum, hidden = false }: NumberLineProps) {
  const width = 720;
  const left = 46;
  const right = 674;
  const axisY = 68;
  const span = maximum - minimum;
  const coordinate = (value: number) => left + ((value - minimum) / span) * (right - left);
  const tickStep = Math.max(1, Math.ceil(span / 24));
  const ticks: number[] = [];
  for (let value = Math.ceil(minimum); value <= maximum; value += tickStep) ticks.push(value);

  const shown = hidden ? EMPTY_SET : set;
  const item = shown.kind === 'interval' ? shown.interval : null;
  const leftValue = item?.left ? toExactNumber(item.left.value) : null;
  const rightValue = item?.right ? toExactNumber(item.right.value) : null;
  const startPixel = leftValue === null ? left : coordinate(clamp(leftValue, minimum, maximum));
  const endPixel = rightValue === null ? right : coordinate(clamp(rightValue, minimum, maximum));

  const description = hidden
    ? 'Ответ скрыт: сначала предскажи его, потом нажми «Проверить».'
    : shown.kind === 'empty'
      ? 'Множество решений пусто: на прямой не закрашено ничего.'
      : `Закрашена часть прямой ${formatIntervalText(shown.interval)}. Это ${intervalName(shown.interval)}. Условие: ${formatConditionText(shown.interval)}.`;

  return (
    <svg
      className="dm-signed-number-line"
      viewBox={`0 0 ${width} 130`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <defs>
        <marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path className="dm-signed-number-line__arrow" d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>

      <line
        className="dm-signed-number-line__axis"
        x1={left}
        y1={axisY}
        x2={right}
        y2={axisY}
        markerEnd={`url(#${id}-arrow)`}
      />
      {ticks.map((tick) => (
        <g className="dm-signed-number-line__tick" key={tick} aria-hidden="true">
          <line x1={coordinate(tick)} y1={axisY - (tick === 0 ? 10 : 6)} x2={coordinate(tick)} y2={axisY + (tick === 0 ? 10 : 6)} />
          <text x={coordinate(tick)} y={axisY + 28}>{numberText(tick)}</text>
        </g>
      ))}

      {item && (
        <g className="dm-signed-number-line__distance" aria-hidden="true">
          <line x1={startPixel} y1={axisY} x2={endPixel} y2={axisY} />
          {leftValue === null && <line x1={left} y1={axisY} x2={left + 14} y2={axisY - 8} />}
          {leftValue === null && <line x1={left} y1={axisY} x2={left + 14} y2={axisY + 8} />}
          {rightValue === null && <line x1={right} y1={axisY} x2={right - 14} y2={axisY - 8} />}
          {rightValue === null && <line x1={right} y1={axisY} x2={right - 14} y2={axisY + 8} />}
          <text x={(startPixel + endPixel) / 2} y={axisY - 38}>{formatSetText(shown)}</text>
        </g>
      )}

      {item?.left && (
        <g
          className="dm-signed-number-line__point dm-signed-number-line__point--a"
          transform={`translate(${startPixel} ${axisY})`}
          aria-hidden="true"
        >
          <circle r="8" />
          {!item.left.closed && <circle className="dm-signed-plane__background" r="4" />}
          <text y="-17">{formatExactRussian(item.left.value)}</text>
        </g>
      )}

      {item?.right && (
        <g
          className="dm-signed-number-line__point dm-signed-number-line__point--b"
          transform={`translate(${endPixel} ${axisY})`}
          aria-hidden="true"
        >
          <circle r="8" />
          {!item.right.closed && <circle className="dm-signed-plane__background" r="4" />}
          <text y="-17">{formatExactRussian(item.right.value)}</text>
        </g>
      )}

      {!item && (
        <g className="dm-signed-number-line__distance" aria-hidden="true">
          <text x={(left + right) / 2} y={axisY - 38}>{hidden ? 'ответ скрыт' : 'решений нет'}</text>
        </g>
      )}
    </svg>
  );
}

/** Окно рисунка подбирается так, чтобы все границы были видны с запасом. */
function makeWindow(values: readonly number[]): { minimum: number; maximum: number } {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { minimum: -6, maximum: 6 };
  let minimum = Math.floor(Math.min(...finite, 0)) - 2;
  let maximum = Math.ceil(Math.max(...finite, 0)) + 2;
  while (maximum - minimum < 8) {
    minimum -= 1;
    maximum += 1;
  }
  return { minimum, maximum };
}

function finiteBounds(set: NumberSet): number[] {
  if (set.kind === 'empty') return [];
  const result: number[] = [];
  if (set.interval.left) result.push(toExactNumber(set.interval.left.value));
  if (set.interval.right) result.push(toExactNumber(set.interval.right.value));
  return result;
}

export default function IneqIntervalLab({
  mode = 'solve',
  challenge = false,
  leftSlope,
  leftConst,
  relation,
  rightSlope,
  rightConst,
  secondSlope,
  secondConst,
  secondRelation,
  secondBound,
  initialLeft,
  initialRight,
}: IneqIntervalLabProps) {
  const reactId = useId();
  const labId = `ineq-interval-${reactId.replace(/:/g, '')}`;

  const defaults = useMemo(() => ({
    leftSlope: safeNumber(leftSlope, 3, COEFFICIENT_LIMIT, 1),
    leftConst: safeNumber(leftConst, -5, COEFFICIENT_LIMIT, 1),
    relation: safeRelation(relation, 'lt'),
    rightSlope: safeNumber(rightSlope, 0, COEFFICIENT_LIMIT, 1),
    rightConst: safeNumber(rightConst, 7, COEFFICIENT_LIMIT, 1),
    secondSlope: safeNumber(secondSlope, -2, COEFFICIENT_LIMIT, 1),
    secondConst: safeNumber(secondConst, 0, COEFFICIENT_LIMIT, 1),
    secondRelation: safeRelation(secondRelation, 'le'),
    secondBound: safeNumber(secondBound, 4, COEFFICIENT_LIMIT, 1),
    left: safeNumber(initialLeft, -2, VALUE_LIMIT, VALUE_STEP),
    right: safeNumber(initialRight, 5, VALUE_LIMIT, VALUE_STEP),
  }), [
    leftSlope, leftConst, relation, rightSlope, rightConst,
    secondSlope, secondConst, secondRelation, secondBound, initialLeft, initialRight,
  ]);

  const [firstSlope, setFirstSlope] = useState(defaults.leftSlope);
  const [firstConst, setFirstConst] = useState(defaults.leftConst);
  const [firstRelation, setFirstRelation] = useState<Relation>(defaults.relation);
  const [otherSlope, setOtherSlope] = useState(defaults.rightSlope);
  const [otherConst, setOtherConst] = useState(defaults.rightConst);

  const [twoSlope, setTwoSlope] = useState(defaults.secondSlope);
  const [twoConst, setTwoConst] = useState(defaults.secondConst);
  const [twoRelation, setTwoRelation] = useState<Relation>(defaults.secondRelation);
  const [twoBound, setTwoBound] = useState(defaults.secondBound);

  const [leftValue, setLeftValue] = useState(defaults.left);
  const [rightValue, setRightValue] = useState(defaults.right);
  const [leftMode, setLeftMode] = useState<EndpointMode>('closed');
  const [rightMode, setRightMode] = useState<EndpointMode>('open');

  const [answerRelation, setAnswerRelation] = useState<Relation | null>(null);
  const [answerBoundary, setAnswerBoundary] = useState('');
  const [checked, setChecked] = useState(false);

  const isSystem = mode === 'system';
  const isInterval = mode === 'interval';

  const firstInequality = useMemo(() => linearInequality(
    linearExpression(firstSlope, firstConst),
    firstRelation,
    linearExpression(isSystem ? 0 : otherSlope, otherConst),
  ), [firstSlope, firstConst, firstRelation, isSystem, otherSlope, otherConst]);

  const secondInequality = useMemo(() => linearInequality(
    linearExpression(twoSlope, twoConst),
    twoRelation,
    linearExpression(0, twoBound),
  ), [twoSlope, twoConst, twoRelation, twoBound]);

  const firstSolution = useMemo(() => solveLinearInequality(firstInequality), [firstInequality]);
  const secondSolution = useMemo(() => solveLinearInequality(secondInequality), [secondInequality]);
  const systemSolution = useMemo(
    () => intersectSets(firstSolution, secondSolution),
    [firstSolution, secondSolution],
  );
  const steps = useMemo(() => solveInequalitySteps(firstInequality), [firstInequality]);

  const builtSet = useMemo<NumberSet>(() => {
    const leftBound = leftMode === 'infinite' ? null : bound(leftValue, leftMode === 'closed');
    const rightBound = rightMode === 'infinite' ? null : bound(rightValue, rightMode === 'closed');
    try {
      return setOf(interval(leftBound, rightBound));
    } catch {
      return EMPTY_SET;
    }
  }, [leftMode, rightMode, leftValue, rightValue]);

  const reveal = !challenge || checked;

  const displayed = isInterval ? builtSet : isSystem ? systemSolution : firstSolution;
  const windowValues = isSystem
    ? [...finiteBounds(firstSolution), ...finiteBounds(secondSolution), ...finiteBounds(systemSolution)]
    : isInterval
      ? [leftMode === 'infinite' ? Number.NaN : leftValue, rightMode === 'infinite' ? Number.NaN : rightValue]
      : finiteBounds(firstSolution);
  const { minimum, maximum } = makeWindow(windowValues);

  const parsedBoundary = parseDraft(answerBoundary);
  const answerReady = answerRelation !== null && parsedBoundary !== null;
  const trueBoundary = firstSolution.kind === 'interval'
    ? (firstSolution.interval.left ?? firstSolution.interval.right ?? null)
    : null;
  const trueRelation: Relation | null = firstSolution.kind === 'interval' && trueBoundary
    ? (firstSolution.interval.left
      ? (trueBoundary.closed ? 'ge' : 'gt')
      : (trueBoundary.closed ? 'le' : 'lt'))
    : null;
  const relationCorrect = answerRelation !== null && answerRelation === trueRelation;
  const boundaryCorrect = parsedBoundary !== null && trueBoundary !== null
    && Math.abs(parsedBoundary - toExactNumber(trueBoundary.value)) < 1e-9;
  const allCorrect = relationCorrect && boundaryCorrect;

  const result = (() => {
    if (isInterval) {
      if (builtSet.kind === 'empty') {
        return {
          symbol: '∅',
          headline: 'Такой промежуток пуст.',
          detail: 'Левая граница оказалась правее правой либо совпала с ней, не будучи включённой. Ни одно число не подходит.',
        };
      }
      return {
        symbol: '↔',
        headline: `${formatIntervalText(builtSet.interval)} — это ${intervalName(builtSet.interval)}.`,
        detail: `Условие на число: ${formatConditionText(builtSet.interval)}. Круглая скобка — граница не входит, квадратная — входит.`,
      };
    }
    if (isSystem) {
      return {
        symbol: systemSolution.kind === 'empty' ? '∅' : '∩',
        headline: systemSolution.kind === 'empty'
          ? 'Общих решений нет: части прямой не перекрываются.'
          : `Ответ системы: ${formatSetText(systemSolution)}.`,
        detail: `Первое неравенство даёт ${formatSetText(firstSolution)}, второе — ${formatSetText(secondSolution)}. Решение системы — общая часть.`,
      };
    }
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: 'Реши неравенство в уме и запиши ответ.',
        detail: 'Выбери знак итогового неравенства и введи граничное число. Помни про деление на отрицательное.',
      };
    }
    if (challenge) {
      return {
        symbol: allCorrect ? '✓' : '×',
        headline: allCorrect
          ? `Верно: ${formatSetText(firstSolution)}.`
          : `Правильный ответ: ${formatSetText(firstSolution)}.`,
        detail: firstSolution.kind === 'empty'
          ? 'Переменная исчезла, и числовое неравенство оказалось неверным.'
          : `${relationCorrect ? 'Знак выбран верно.' : 'Проверь знак: при делении на отрицательное число он меняется.'} ${boundaryCorrect ? 'Граница найдена верно.' : 'Проверь арифметику при переносе слагаемых.'}`,
      };
    }
    return {
      symbol: firstSolution.kind === 'empty' ? '∅' : '⩽',
      headline: `${formatInequalityText(firstInequality)} ⟺ ${formatSetText(firstSolution)}.`,
      detail: firstSolution.kind === 'empty'
        ? 'Ни одно число не подходит: после упрощения получилось неверное числовое неравенство.'
        : `Условие на x: ${formatConditionText(firstSolution.interval)}. Промежуток называется так: ${intervalName(firstSolution.interval)}.`,
    };
  })();

  const reset = () => {
    setFirstSlope(defaults.leftSlope);
    setFirstConst(defaults.leftConst);
    setFirstRelation(defaults.relation);
    setOtherSlope(defaults.rightSlope);
    setOtherConst(defaults.rightConst);
    setTwoSlope(defaults.secondSlope);
    setTwoConst(defaults.secondConst);
    setTwoRelation(defaults.secondRelation);
    setTwoBound(defaults.secondBound);
    setLeftValue(defaults.left);
    setRightValue(defaults.right);
    setLeftMode('closed');
    setRightMode('open');
    setAnswerRelation(null);
    setAnswerBoundary('');
    setChecked(false);
  };

  const heading = isInterval
    ? 'Собери промежуток и прочитай его запись'
    : isSystem
      ? 'Система: где два условия выполняются одновременно'
      : 'Решаем линейное неравенство по шагам';

  const badge = isInterval
    ? formatSetText(builtSet)
    : isSystem
      ? 'система'
      : reveal ? formatSetText(firstSolution) : 'x ⋛ ?';

  return (
    <section className="dm-lab dm-signed-line not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория неравенств</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>{heading}</h3>
          <p>
            {isInterval
              ? 'Меняй границы и их включённость. Следи за тремя записями одного и того же множества: рисунок, скобки, неравенство.'
              : isSystem
                ? 'Каждое неравенство даёт свою часть прямой. Ответ системы — то, что закрашено дважды.'
                : 'Меняй коэффициенты и знак. Обрати внимание на шаг деления: там прячется самая частая ошибка.'}
          </p>
        </div>
        <span className="dm-lab__badge">{badge}</span>
      </header>

      <div className="dm-lab__body">
        {isInterval && (
          <>
            <div className="dm-lab__controls dm-signed-controls">
              <StepperField
                id={`${labId}-left`}
                label="Левая граница"
                value={leftValue}
                limit={VALUE_LIMIT}
                step={VALUE_STEP}
                onChange={setLeftValue}
              />
              <StepperField
                id={`${labId}-right`}
                label="Правая граница"
                value={rightValue}
                limit={VALUE_LIMIT}
                step={VALUE_STEP}
                onChange={setRightValue}
              />
            </div>
            <div className="dm-lab__controls dm-signed-controls">
              <div className="dm-field dm-signed-field">
                <p className="dm-signed-caption">Левый конец: {ENDPOINT_LABELS[leftMode]}</p>
                <div className="dm-geometry-preset-buttons" role="group" aria-label="Левый конец промежутка">
                  {(['closed', 'open', 'infinite'] as EndpointMode[]).map((item) => (
                    <button type="button" key={item} aria-pressed={leftMode === item} onClick={() => setLeftMode(item)}>
                      {item === 'infinite' ? '−∞' : item === 'closed' ? '[ включена' : '( не включена'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="dm-field dm-signed-field">
                <p className="dm-signed-caption">Правый конец: {ENDPOINT_LABELS[rightMode]}</p>
                <div className="dm-geometry-preset-buttons" role="group" aria-label="Правый конец промежутка">
                  {(['closed', 'open', 'infinite'] as EndpointMode[]).map((item) => (
                    <button type="button" key={item} aria-pressed={rightMode === item} onClick={() => setRightMode(item)}>
                      {item === 'infinite' ? '+∞' : item === 'closed' ? '] включена' : ') не включена'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {!isInterval && (
          <>
            <p className="dm-signed-caption">{isSystem ? 'Первое неравенство' : 'Неравенство'}</p>
            <div className="dm-lab__controls dm-signed-controls">
              <StepperField
                id={`${labId}-a`}
                label="Коэффициент при x слева"
                value={firstSlope}
                limit={COEFFICIENT_LIMIT}
                step={1}
                onChange={setFirstSlope}
              />
              <StepperField
                id={`${labId}-b`}
                label="Число слева"
                value={firstConst}
                limit={COEFFICIENT_LIMIT}
                step={1}
                onChange={setFirstConst}
              />
              <RelationPicker legend="Знак первого неравенства" value={firstRelation} onChange={setFirstRelation} />
              {!isSystem && (
                <StepperField
                  id={`${labId}-c`}
                  label="Коэффициент при x справа"
                  value={otherSlope}
                  limit={COEFFICIENT_LIMIT}
                  step={1}
                  onChange={setOtherSlope}
                />
              )}
              <StepperField
                id={`${labId}-d`}
                label="Число справа"
                value={otherConst}
                limit={COEFFICIENT_LIMIT}
                step={1}
                onChange={setOtherConst}
              />
            </div>
          </>
        )}

        {isSystem && (
          <>
            <p className="dm-signed-caption">Второе неравенство</p>
            <div className="dm-lab__controls dm-signed-controls">
              <StepperField
                id={`${labId}-a2`}
                label="Коэффициент при x слева"
                value={twoSlope}
                limit={COEFFICIENT_LIMIT}
                step={1}
                onChange={setTwoSlope}
              />
              <StepperField
                id={`${labId}-b2`}
                label="Число слева"
                value={twoConst}
                limit={COEFFICIENT_LIMIT}
                step={1}
                onChange={setTwoConst}
              />
              <RelationPicker legend="Знак второго неравенства" value={twoRelation} onChange={setTwoRelation} />
              <StepperField
                id={`${labId}-d2`}
                label="Число справа"
                value={twoBound}
                limit={COEFFICIENT_LIMIT}
                step={1}
                onChange={setTwoBound}
              />
            </div>
          </>
        )}

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемая координатная прямая" tabIndex={0}>
          {isSystem ? (
            <>
              <IntervalLine
                id={`${labId}-line-1`}
                title={`Решение первого неравенства ${formatInequalityText(firstInequality)}`}
                set={firstSolution}
                minimum={minimum}
                maximum={maximum}
              />
              <IntervalLine
                id={`${labId}-line-2`}
                title={`Решение второго неравенства ${formatInequalityText(secondInequality)}`}
                set={secondSolution}
                minimum={minimum}
                maximum={maximum}
              />
              <IntervalLine
                id={`${labId}-line-3`}
                title="Общая часть — решение системы"
                set={systemSolution}
                minimum={minimum}
                maximum={maximum}
              />
            </>
          ) : (
            <IntervalLine
              id={`${labId}-line`}
              title={isInterval ? 'Промежуток на координатной прямой' : `Решение неравенства ${formatInequalityText(firstInequality)}`}
              set={displayed}
              minimum={minimum}
              maximum={maximum}
              hidden={!isInterval && !reveal}
            />
          )}
        </div>

        {mode === 'solve' && challenge && (
          <>
            <p className="dm-signed-caption">Мой ответ</p>
            <div className="dm-geometry-preset-buttons" role="group" aria-label="Знак итогового неравенства">
              {RELATIONS.map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={answerRelation === item}
                  aria-label={`x ${RELATION_HINTS[item]} границы`}
                  onClick={() => {
                    setAnswerRelation(item);
                    setChecked(false);
                  }}
                >
                  x {relationText(item)} …
                </button>
              ))}
            </div>
            <div className="dm-geometry-answer-grid">
              <div className="dm-geometry-answer-field">
                <label htmlFor={`${labId}-boundary`}>Граничное число</label>
                <input
                  id={`${labId}-boundary`}
                  type="text"
                  inputMode="decimal"
                  maxLength={MAX_DRAFT_LENGTH}
                  value={answerBoundary}
                  onChange={(event) => {
                    if (DRAFT_PATTERN.test(event.target.value)) {
                      setAnswerBoundary(event.target.value);
                      setChecked(false);
                    }
                  }}
                />
              </div>
              <button className="dm-button" type="button" disabled={!answerReady} onClick={() => setChecked(true)}>
                Проверить
              </button>
            </div>
          </>
        )}

        {mode === 'solve' && reveal && (
          <ol className="dm-algebra-steps">
            {steps.map((step, index) => (
              <li key={`${index}-${step.text}`}>
                <span>{index + 1}</span>
                <p>
                  <small>{step.rule}</small>
                  <strong>{step.text}</strong>
                </p>
              </li>
            ))}
          </ol>
        )}

        {isSystem && (
          <div className="dm-algebra-table-wrap">
            <table className="dm-algebra-table">
              <caption>Три множества: два условия и их общая часть</caption>
              <thead>
                <tr>
                  <th scope="col">Неравенство</th>
                  <th scope="col">Решение</th>
                  <th scope="col">Название</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{formatInequalityText(firstInequality)}</th>
                  <td>{formatSetText(firstSolution)}</td>
                  <td>{firstSolution.kind === 'empty' ? '—' : intervalName(firstSolution.interval)}</td>
                </tr>
                <tr>
                  <th scope="row">{formatInequalityText(secondInequality)}</th>
                  <td>{formatSetText(secondSolution)}</td>
                  <td>{secondSolution.kind === 'empty' ? '—' : intervalName(secondSolution.interval)}</td>
                </tr>
                <tr>
                  <th scope="row">Система</th>
                  <td>{formatSetText(systemSolution)}</td>
                  <td>{systemSolution.kind === 'empty' ? '—' : intervalName(systemSolution.interval)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span>
          <p>
            <strong>{result.headline}</strong>
            <small>{result.detail}</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>
          ↺ Вернуть пример
        </button>
      </div>
    </section>
  );
}
