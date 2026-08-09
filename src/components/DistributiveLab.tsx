import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  type ExactRational,
  addExact,
  compareExact,
  formatExactRussian,
  multiplyExact,
  parseExact,
  subtractExact,
  toExactNumber,
} from '../lib/exactRational';

export type Operation = 'add' | 'subtract';
export type View = 'whole' | 'split';
export type DistributiveOperation = Operation;
export type DistributiveView = View;

export interface DistributiveLabProps {
  variable?: string;
  initialFactor?: number;
  initialValue?: number;
  initialConstant?: number;
  operation?: Operation;
  min?: number;
  max?: number;
  step?: number;
  initialView?: View;
  showFactorMode?: boolean;
}

type ActiveView = View | 'factor';

interface ExactRange {
  minimum: ExactRational;
  maximum: ExactRational;
  step: ExactRational;
}

const DECIMAL_DRAFT = /^[+-]?(?:\d*(?:[.,]\d*)?)?$/;
const MAX_DRAFT_LENGTH = 64;

function exact(value: number | string, fallback = '0'): ExactRational {
  try {
    return parseExact(typeof value === 'number' && !Number.isFinite(value) ? fallback : String(value));
  } catch {
    return parseExact(fallback);
  }
}

function normalizeVariable(value: string | undefined): string {
  const candidate = value?.trim().match(/^[A-Za-zА-Яа-яЁё]$/u)?.[0];
  return candidate ?? 'x';
}

function makeRange(minimum: number | undefined, maximum: number | undefined, step: number | undefined): ExactRange {
  const hardMinimum = exact('-50');
  const hardMaximum = exact('50');
  let lower = exact(minimum ?? -10, '-10');
  let upper = exact(maximum ?? 10, '10');
  if (compareExact(lower, hardMinimum) < 0) lower = hardMinimum;
  if (compareExact(upper, hardMaximum) > 0) upper = hardMaximum;
  if (compareExact(lower, upper) >= 0) {
    lower = exact('-10');
    upper = exact('10');
  }
  let increment = exact(step ?? 1, '1');
  if (compareExact(increment, exact('0')) <= 0 || compareExact(increment, subtractExact(upper, lower)) > 0) {
    increment = exact('1');
  }
  return { minimum: lower, maximum: upper, step: increment };
}

function clampExact(value: ExactRational, range: ExactRange): ExactRational {
  if (compareExact(value, range.minimum) < 0) return range.minimum;
  if (compareExact(value, range.maximum) > 0) return range.maximum;
  return value;
}

function initialExact(value: number | undefined, fallback: number, range: ExactRange): ExactRational {
  return clampExact(exact(value ?? fallback, String(fallback)), range);
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

function inputText(value: ExactRational): string {
  return formatExactRussian(value);
}

function focusHorizontalScroller(element: HTMLDivElement | null, fraction: number): void {
  if (!element) return;
  const maximum = Math.max(0, element.scrollWidth - element.clientWidth);
  const target = element.scrollWidth * Math.min(1, Math.max(0, fraction)) - element.clientWidth / 2;
  element.scrollLeft = Math.min(maximum, Math.max(0, Math.round(target)));
}

export function distributiveZeroFocusFraction(firstPart: ExactRational, result: ExactRational): number {
  const first = toExactNumber(firstPart);
  const total = toExactNumber(result);
  let minimum = Math.min(0, first, total);
  let maximum = Math.max(0, first, total);
  if (minimum === maximum) {
    minimum = -1;
    maximum = 1;
  }
  return (0 - minimum) / (maximum - minimum);
}

interface ExactFieldProps {
  id: string;
  label: string;
  value: ExactRational;
  range: ExactRange;
  onChange: (value: ExactRational) => void;
}

function ExactField({ id, label, value, range, onChange }: ExactFieldProps) {
  const [draft, setDraft] = useState(inputText(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);
  const valueAtFocus = useRef(value);

  useEffect(() => {
    if (!editing) setDraft(inputText(value));
  }, [editing, value]);

  const commit = () => {
    const parsed = parseDraft(draft);
    const next = parsed === null ? value : clampExact(parsed, range);
    onChange(next);
    setDraft(inputText(next));
  };

  const nudge = (direction: -1 | 1) => {
    const delta = direction === 1 ? range.step : multiplyExact(exact('-1'), range.step);
    onChange(clampExact(addExact(value, delta), range));
  };

  return (
    <div className="dm-field dm-algebra-field">
      <label htmlFor={id}>{label} <span className="dm-field__value">{inputText(value)}</span></label>
      <div className="dm-algebra-field__control">
        <button type="button" className="dm-algebra-field__step" onClick={() => nudge(-1)} disabled={compareExact(value, range.minimum) <= 0} aria-label={`Уменьшить ${label.toLowerCase()} на ${inputText(range.step)}`}>−</button>
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
            if (parsed !== null && compareExact(parsed, range.minimum) >= 0 && compareExact(parsed, range.maximum) <= 0) onChange(parsed);
          }}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              onChange(valueAtFocus.current);
              setDraft(inputText(valueAtFocus.current));
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
              setDraft(inputText(valueAtFocus.current));
              event.currentTarget.blur();
            }
          }}
        />
        <button type="button" className="dm-algebra-field__step" onClick={() => nudge(1)} disabled={compareExact(value, range.maximum) >= 0} aria-label={`Увеличить ${label.toLowerCase()} на ${inputText(range.step)}`}>+</button>
      </div>
      <small id={`${id}-hint`}>От {inputText(range.minimum)} до {inputText(range.maximum)}, шаг {inputText(range.step)}.</small>
    </div>
  );
}

function parenthesized(value: ExactRational): string {
  return compareExact(value, exact('0')) < 0 ? `(${inputText(value)})` : inputText(value);
}

function signedContribution(value: ExactRational): string {
  const sign = compareExact(value, exact('0')) < 0 ? '−' : '+';
  const magnitude = compareExact(value, exact('0')) < 0 ? multiplyExact(exact('-1'), value) : value;
  return `${sign} ${inputText(magnitude)}`;
}

interface SignedBarsProps {
  id: string;
  activeView: ActiveView;
  firstPart: ExactRational;
  secondPart: ExactRational;
  result: ExactRational;
  factor: ExactRational;
  variable: string;
}

function SignedBars({ id, activeView, firstPart, secondPart, result, factor, variable }: SignedBarsProps) {
  const first = toExactNumber(firstPart);
  const second = toExactNumber(secondPart);
  const total = toExactNumber(result);
  let minimum = Math.min(0, first, total, activeView === 'whole' ? total : first + second);
  let maximum = Math.max(0, first, total, activeView === 'whole' ? total : first + second);
  if (minimum === maximum) {
    minimum = -1;
    maximum = 1;
  }
  const span = maximum - minimum;
  const left = 58;
  const right = 682;
  const coordinate = (value: number) => left + ((value - minimum) / span) * (right - left);
  const zeroX = coordinate(0);
  const firstX = coordinate(first);
  const totalX = coordinate(total);
  const directClass = total >= 0 ? 'dm-algebra-signed-bars__bar--positive' : 'dm-algebra-signed-bars__bar--negative';
  const firstClass = first >= 0 ? 'dm-algebra-signed-bars__bar--positive' : 'dm-algebra-signed-bars__bar--negative';
  const secondClass = second >= 0 ? 'dm-algebra-signed-bars__bar--positive' : 'dm-algebra-signed-bars__bar--negative';
  const viewDescription = activeView === 'whole'
    ? `Один отрезок ведёт от нуля к ${inputText(result)}.`
    : `Первый отрезок даёт ${inputText(firstPart)}, второй добавляет ${inputText(secondPart)}, итог ${inputText(result)}.`;

  return (
    <svg className="dm-algebra-signed-bars" viewBox="0 0 740 238" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Распределительный закон на направленных полосах</title>
      <desc id={`${id}-desc`}>{viewDescription} Полоса вправо означает положительный вклад, влево — отрицательный.</desc>
      <defs>
        <marker id={`${id}-positive-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path className="dm-algebra-signed-bars__arrow dm-algebra-signed-bars__arrow--positive" d="M0,0 L8,4 L0,8 Z" />
        </marker>
        <marker id={`${id}-negative-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path className="dm-algebra-signed-bars__arrow dm-algebra-signed-bars__arrow--negative" d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>
      <line className="dm-algebra-signed-bars__axis" x1={left} y1="176" x2={right} y2="176" />
      <line className="dm-algebra-signed-bars__zero" x1={zeroX} y1="164" x2={zeroX} y2="188" />
      <text className="dm-algebra-signed-bars__axis-label" x={zeroX} y="207">0</text>

      {activeView === 'whole' ? (
        <>
          <line className={`dm-algebra-signed-bars__bar ${directClass}`} x1={zeroX} y1="96" x2={totalX} y2="96" markerEnd={total === 0 ? undefined : `url(#${id}-${total > 0 ? 'positive' : 'negative'}-arrow)`} />
          <text className="dm-algebra-signed-bars__label" x={(zeroX + totalX) / 2} y="75">всё выражение: {inputText(result)}</text>
        </>
      ) : (
        <>
          <line className={`dm-algebra-signed-bars__bar ${firstClass}`} x1={zeroX} y1="77" x2={firstX} y2="77" markerEnd={first === 0 ? undefined : `url(#${id}-${first > 0 ? 'positive' : 'negative'}-arrow)`} />
          <text className="dm-algebra-signed-bars__label" x={(zeroX + firstX) / 2} y="57">{inputText(firstPart)}</text>
          <line className={`dm-algebra-signed-bars__bar ${secondClass}`} x1={firstX} y1="126" x2={totalX} y2="126" markerEnd={second === 0 ? undefined : `url(#${id}-${second > 0 ? 'positive' : 'negative'}-arrow)`} />
          <text className="dm-algebra-signed-bars__label" x={(firstX + totalX) / 2} y="151">{signedContribution(secondPart)}</text>
          <circle className="dm-algebra-signed-bars__join" cx={firstX} cy="102" r="5" />
        </>
      )}

      <circle className="dm-algebra-signed-bars__result" cx={totalX} cy="176" r="7" />
      <text className="dm-algebra-signed-bars__result-label" x={totalX} y="228">{inputText(result)}</text>
      {activeView === 'factor' && (
        <text className="dm-algebra-signed-bars__factor-note" x="370" y="25">общий множитель {inputText(factor)} выносим за скобки: {variable} и число остаются внутри</text>
      )}
    </svg>
  );
}

export default function DistributiveLab({
  variable,
  initialFactor,
  initialValue,
  initialConstant,
  operation = 'add',
  min,
  max,
  step,
  initialView = 'whole',
  showFactorMode = false,
}: DistributiveLabProps) {
  const reactId = useId();
  const labId = `algebra-distributive-${reactId.replace(/:/g, '')}`;
  const safeVariable = normalizeVariable(variable);
  const range = useMemo(() => makeRange(min, max, step), [min, max, step]);
  const defaults = useMemo(() => ({
    factor: initialExact(initialFactor, 3, range),
    value: initialExact(initialValue, 2, range),
    constant: initialExact(initialConstant, 4, range),
  }), [initialConstant, initialFactor, initialValue, range]);
  const [factor, setFactor] = useState(defaults.factor);
  const [value, setValue] = useState(defaults.value);
  const [constant, setConstant] = useState(defaults.constant);
  const [activeView, setActiveView] = useState<ActiveView>(initialView);
  const visualScroller = useRef<HTMLDivElement>(null);

  const signedConstant = operation === 'add' ? constant : multiplyExact(exact('-1'), constant);
  const inside = addExact(value, signedConstant);
  const firstPart = multiplyExact(factor, value);
  const secondPart = multiplyExact(factor, signedConstant);
  const result = multiplyExact(factor, inside);
  const splitResult = addExact(firstPart, secondPart);
  const equal = compareExact(result, splitResult) === 0;
  const operationSign = operation === 'add' ? '+' : '−';
  const innerText = `${parenthesized(value)} ${operationSign} ${parenthesized(constant)}`;
  const currentZeroFocus = distributiveZeroFocusFraction(firstPart, result);

  useEffect(() => {
    focusHorizontalScroller(visualScroller.current, currentZeroFocus);
  }, [activeView, currentZeroFocus]);

  const reset = () => {
    setFactor(defaults.factor);
    setValue(defaults.value);
    setConstant(defaults.constant);
    setActiveView(initialView);
  };

  return (
    <section className="dm-lab dm-algebra-distributive not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория распределительного закона</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Умножить сумму целиком или по частям</h3>
          <p>Направленные полосы сохраняют знак каждого вклада — в том числе при отрицательном множителе.</p>
        </div>
        <span className="dm-lab__badge">a(b ± c)</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-algebra-tabs" role="group" aria-label="Способ представить выражение">
          <button type="button" className={`dm-algebra-tab ${activeView === 'whole' ? 'dm-algebra-tab--active' : ''}`} aria-pressed={activeView === 'whole'} onClick={() => setActiveView('whole')}>Целиком</button>
          <button type="button" className={`dm-algebra-tab ${activeView === 'split' ? 'dm-algebra-tab--active' : ''}`} aria-pressed={activeView === 'split'} onClick={() => setActiveView('split')}>По частям</button>
          {showFactorMode && (
            <button type="button" className={`dm-algebra-tab ${activeView === 'factor' ? 'dm-algebra-tab--active' : ''}`} aria-pressed={activeView === 'factor'} onClick={() => setActiveView('factor')}>Собрать обратно</button>
          )}
        </div>

        <div className="dm-lab__controls dm-algebra-controls">
          <ExactField id={`${labId}-factor`} label="Множитель" value={factor} range={range} onChange={setFactor} />
          <ExactField id={`${labId}-variable`} label={`Значение ${safeVariable}`} value={value} range={range} onChange={setValue} />
          <ExactField id={`${labId}-constant`} label="Число в скобках" value={constant} range={range} onChange={setConstant} />
        </div>

        <div className="dm-algebra-equation" role="math" aria-label={`${inputText(factor)} умножить на скобку ${innerText} равно ${inputText(result)}`}>
          <span>{inputText(factor)} · ({innerText})</span>
          <span aria-hidden="true">=</span>
          <span>{inputText(firstPart)} {signedContribution(secondPart)}</span>
          <span aria-hidden="true">=</span>
          <strong>{inputText(result)}</strong>
        </div>

        <div ref={visualScroller} className="dm-algebra-visual-wrap" role="region" aria-label="Прокручиваемая схема направленных полос" tabIndex={0}>
          <SignedBars id={`${labId}-bars`} activeView={activeView} firstPart={firstPart} secondPart={secondPart} result={result} factor={factor} variable={safeVariable} />
        </div>

        <ol className="dm-algebra-steps">
          <li><span>1</span><p><strong>Внутри скобок.</strong> {innerText} = {inputText(inside)}.</p></li>
          <li><span>2</span><p><strong>Распределяем множитель.</strong> Первый вклад — {inputText(factor)} · {parenthesized(value)} = {inputText(firstPart)}, второй — {inputText(factor)} · ({inputText(signedConstant)}) = {inputText(secondPart)}.</p></li>
          <li><span>3</span><p><strong>Сверяем.</strong> Оба маршрута дают {inputText(result)}.</p></li>
        </ol>

        <div className={`dm-result ${equal ? '' : 'dm-algebra-result--warning'}`} aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{equal ? '=' : '!'}</span>
          <p>
            <strong>{inputText(factor)} · ({innerText}) = {inputText(firstPart)} {signedContribution(secondPart)} = {inputText(result)}</strong>
            <small>{activeView === 'factor' ? 'Обратный ход собирает общий множитель за скобками.' : 'Знак второго вклада определяется всем произведением, а не только знаком между членами в скобках.'}</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
