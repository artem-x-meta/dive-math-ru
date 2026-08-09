import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  absoluteValue,
  compareSigned,
  formatRussianNumber,
  fromHalfTicks,
  isHalfStepGridValue,
  isHalfStepNumber,
  normalizeHalfStepRange,
  opposite,
  parseSignedDraft,
  quantizeHalfStep,
  subtractSigned,
  toHalfTicks,
  type SignedComparison,
} from '../lib/signedNumbers';

export type SignedNumberLineMode = 'locate' | 'opposite' | 'absolute' | 'compare' | 'distance';

export interface SignedNumberLineLabProps {
  mode?: SignedNumberLineMode;
  initialA?: number;
  initialB?: number;
  min?: number;
  max?: number;
  step?: number;
}

interface LabRange {
  minimum: number;
  maximum: number;
  step: number;
}

const HARD_MINIMUM = -30;
const HARD_MAXIMUM = 30;

const MODE_LABELS: Readonly<Record<SignedNumberLineMode, string>> = {
  locate: 'Положение',
  opposite: 'Противоположные',
  absolute: 'Модуль',
  compare: 'Сравнение',
  distance: 'Расстояние',
};

function safeHalf(value: number | undefined, fallback: number): number {
  return value !== undefined && isHalfStepNumber(value) ? value : fallback;
}

function makeRange(minimum: number | undefined, maximum: number | undefined, requestedStep: number | undefined): LabRange {
  return normalizeHalfStepRange(minimum, maximum, requestedStep, {
    defaultMinimum: -10,
    defaultMaximum: 10,
    hardMinimum: HARD_MINIMUM,
    hardMaximum: HARD_MAXIMUM,
  });
}

function safeValue(value: number | undefined, fallback: number, range: LabRange): number {
  const candidate = safeHalf(value, fallback);
  const snapped = quantizeHalfStep(candidate, range.step);
  return Math.max(range.minimum, Math.min(range.maximum, snapped));
}

function inputText(value: number): string {
  return String(value).replace('.', ',');
}

interface SignedFieldProps {
  id: string;
  label: string;
  value: number;
  range: LabRange;
  onChange: (value: number) => void;
}

function SignedField({ id, label, value, range, onChange }: SignedFieldProps) {
  const [draft, setDraft] = useState(inputText(value));
  const [isEditing, setIsEditing] = useState(false);
  const cancelCommit = useRef(false);
  const stepTicks = toHalfTicks(range.step);

  useEffect(() => {
    if (!isEditing) setDraft(inputText(value));
  }, [isEditing, value]);

  const acceptsGridValue = (candidate: number) => {
    return isHalfStepGridValue(candidate, range.step);
  };

  const edit = (rawValue: string) => {
    setDraft(rawValue);
    const parsed = parseSignedDraft(rawValue);
    if (parsed !== null && acceptsGridValue(parsed) && parsed >= range.minimum && parsed <= range.maximum) {
      onChange(parsed);
    }
  };

  const commit = () => {
    const parsed = parseSignedDraft(draft);
    const next = parsed !== null && isHalfStepNumber(parsed)
      ? Math.max(range.minimum, Math.min(range.maximum, quantizeHalfStep(parsed, range.step)))
      : value;
    setDraft(inputText(next));
    onChange(next);
  };

  const nudge = (direction: -1 | 1) => {
    const nextTicks = toHalfTicks(value) + direction * stepTicks;
    const next = Math.max(range.minimum, Math.min(range.maximum, fromHalfTicks(nextTicks)));
    onChange(next);
  };

  return (
    <div className="dm-field dm-signed-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{formatRussianNumber(value)}</span>
      </label>
      <div className="dm-signed-field__control">
        <button
          type="button"
          className="dm-signed-field__step"
          aria-label={`Уменьшить ${label.toLowerCase()} на ${formatRussianNumber(range.step)}`}
          disabled={value <= range.minimum}
          onClick={() => nudge(-1)}
        >
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => {
            cancelCommit.current = false;
            setIsEditing(true);
          }}
          onChange={(event) => edit(event.target.value)}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              setDraft(inputText(value));
              setIsEditing(false);
              return;
            }
            commit();
            setIsEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelCommit.current = true;
              setDraft(inputText(value));
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          className="dm-signed-field__step"
          aria-label={`Увеличить ${label.toLowerCase()} на ${formatRussianNumber(range.step)}`}
          disabled={value >= range.maximum}
          onClick={() => nudge(1)}
        >
          +
        </button>
      </div>
      <small id={`${id}-hint`}>
        От {formatRussianNumber(range.minimum)} до {formatRussianNumber(range.maximum)}, шаг {formatRussianNumber(range.step)}
      </small>
    </div>
  );
}

function comparisonSymbol(comparison: SignedComparison): string {
  return comparison < 0 ? '<' : comparison > 0 ? '>' : '=';
}

function positionExplanation(value: number): string {
  if (value < 0) return 'Отрицательные числа стоят слева от нуля.';
  if (value > 0) return 'Положительные числа стоят справа от нуля.';
  return 'Ноль — граница между отрицательными и положительными числами.';
}

export default function SignedNumberLineLab({
  mode = 'locate',
  initialA = -3,
  initialB = 2,
  min,
  max,
  step,
}: SignedNumberLineLabProps) {
  const reactId = useId();
  const labId = `signed-line-${reactId.replace(/:/g, '')}`;
  const range = useMemo(() => makeRange(min, max, step), [min, max, step]);
  const defaultA = safeValue(initialA, -3, range);
  const defaultB = safeValue(initialB, 2, range);
  const [activeMode, setActiveMode] = useState<SignedNumberLineMode>(mode);
  const [a, setA] = useState(defaultA);
  const [b, setB] = useState(defaultB);

  const oppositeA = opposite(a);
  const visualMinimum = Math.min(range.minimum, activeMode === 'opposite' ? oppositeA : range.minimum, 0);
  const visualMaximum = Math.max(range.maximum, activeMode === 'opposite' ? oppositeA : range.maximum, 0);
  const width = 720;
  const left = 46;
  const right = 674;
  const axisY = 104;
  const coordinate = (value: number) => left + ((value - visualMinimum) / (visualMaximum - visualMinimum)) * (right - left);
  const tickCount = Math.floor((visualMaximum - visualMinimum) / range.step);
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => {
    const tickValue = fromHalfTicks(toHalfTicks(visualMinimum) + index * toHalfTicks(range.step));
    return tickValue <= visualMaximum ? tickValue : null;
  }).filter((value): value is number => value !== null);
  const comparison = compareSigned(a, b);
  const distance = absoluteValue(subtractSigned(a, b));
  const showsB = activeMode === 'compare' || activeMode === 'distance';
  const showsOpposite = activeMode === 'opposite';
  const highlightedStart = activeMode === 'absolute' ? coordinate(Math.min(0, a))
    : activeMode === 'distance' ? coordinate(Math.min(a, b))
      : null;
  const highlightedEnd = activeMode === 'absolute' ? coordinate(Math.max(0, a))
    : activeMode === 'distance' ? coordinate(Math.max(a, b))
      : null;

  const result = (() => {
    if (activeMode === 'locate') {
      return {
        headline: `Точка A находится в ${formatRussianNumber(a)}.`,
        detail: positionExplanation(a),
      };
    }
    if (activeMode === 'opposite') {
      return {
        headline: `Числа ${formatRussianNumber(a)} и ${formatRussianNumber(oppositeA)} противоположны.`,
        detail: `Они находятся по разные стороны от нуля на одинаковом расстоянии ${formatRussianNumber(absoluteValue(a))}.`,
      };
    }
    if (activeMode === 'absolute') {
      return {
        headline: `|${formatRussianNumber(a)}| = ${formatRussianNumber(absoluteValue(a))}.`,
        detail: 'Модуль — это расстояние от числа до нуля, поэтому он не бывает отрицательным.',
      };
    }
    if (activeMode === 'compare') {
      const explanation = comparison === 0
        ? 'Точки совпали, поэтому числа равны.'
        : `${formatRussianNumber(comparison > 0 ? a : b)} правее на координатной прямой, значит это число больше.`;
      return {
        headline: `${formatRussianNumber(a)} ${comparisonSymbol(comparison)} ${formatRussianNumber(b)}.`,
        detail: explanation,
      };
    }
    return {
      headline: `Расстояние между A и B равно ${formatRussianNumber(distance)}.`,
      detail: `Вычитаем координаты и берём модуль: |${formatRussianNumber(a)} − (${formatRussianNumber(b)})| = ${formatRussianNumber(distance)}.`,
    };
  })();

  const reset = () => {
    setActiveMode(mode);
    setA(defaultA);
    setB(defaultB);
  };

  return (
    <section className="dm-lab dm-signed-line not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория координатной прямой</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Числа как точки и расстояния</h3>
          <p>Меняй координаты кнопками или вводи их с клавиатуры. Следи не только за знаком, но и за положением точки.</p>
        </div>
        <span className="dm-lab__badge">шаг {formatRussianNumber(range.step)}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-signed-tabs" role="group" aria-label="Что исследовать на координатной прямой">
          {(Object.keys(MODE_LABELS) as SignedNumberLineMode[]).map((item) => (
            <button
              type="button"
              className={`dm-signed-tab ${activeMode === item ? 'dm-signed-tab--active' : ''}`}
              aria-pressed={activeMode === item}
              onClick={() => setActiveMode(item)}
              key={item}
            >
              {MODE_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-signed-controls">
          <SignedField id={`${labId}-a`} label="Координата A" value={a} range={range} onChange={setA} />
          {showsB && <SignedField id={`${labId}-b`} label="Координата B" value={b} range={range} onChange={setB} />}
        </div>

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемая схема координатной прямой" tabIndex={0}>
          <svg
            className="dm-signed-number-line"
            viewBox={`0 0 ${width} 210`}
            role="img"
            aria-labelledby={`${labId}-svg-title ${labId}-svg-desc`}
          >
            <title id={`${labId}-svg-title`}>Координатная прямая с выбранными точками</title>
            <desc id={`${labId}-svg-desc`}>
              Точка A имеет координату {formatRussianNumber(a)}.
              {showsB ? ` Точка B имеет координату ${formatRussianNumber(b)}.` : ''}
              {showsOpposite ? ` Противоположная точка имеет координату ${formatRussianNumber(oppositeA)}.` : ''}
            </desc>
            <defs>
              <marker id={`${labId}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path className="dm-signed-number-line__arrow" d="M0,0 L8,4 L0,8 Z" />
              </marker>
            </defs>
            <line className="dm-signed-number-line__axis" x1={left} y1={axisY} x2={right} y2={axisY} markerEnd={`url(#${labId}-arrow)`} />
            {ticks.map((tick) => {
              const x = coordinate(tick);
              const showLabel = Number.isInteger(tick)
                && (visualMaximum - visualMinimum <= 24 || tick === 0 || tick === visualMinimum || tick === visualMaximum);
              return (
                <g className="dm-signed-number-line__tick" key={tick} aria-hidden="true">
                  <line x1={x} y1={axisY - (tick === 0 ? 10 : 6)} x2={x} y2={axisY + (tick === 0 ? 10 : 6)} />
                  {showLabel && <text x={x} y={axisY + 30}>{formatRussianNumber(tick)}</text>}
                </g>
              );
            })}
            {highlightedStart !== null && highlightedEnd !== null && (
              <g className="dm-signed-number-line__distance" aria-hidden="true">
                <line x1={highlightedStart} y1={axisY - 31} x2={highlightedEnd} y2={axisY - 31} />
                <line x1={highlightedStart} y1={axisY - 38} x2={highlightedStart} y2={axisY - 24} />
                <line x1={highlightedEnd} y1={axisY - 38} x2={highlightedEnd} y2={axisY - 24} />
                <text x={(highlightedStart + highlightedEnd) / 2} y={axisY - 43}>
                  {formatRussianNumber(activeMode === 'absolute' ? absoluteValue(a) : distance)}
                </text>
              </g>
            )}
            <g className="dm-signed-number-line__point dm-signed-number-line__point--a" transform={`translate(${coordinate(a)} ${axisY})`} aria-hidden="true">
              <circle r="9" />
              <text y="55">A({formatRussianNumber(a)})</text>
            </g>
            {showsB && (
              <g className="dm-signed-number-line__point dm-signed-number-line__point--b" transform={`translate(${coordinate(b)} ${axisY})`} aria-hidden="true">
                <circle r="9" />
                <text y="78">B({formatRussianNumber(b)})</text>
              </g>
            )}
            {showsOpposite && (
              <g className="dm-signed-number-line__point dm-signed-number-line__point--opposite" transform={`translate(${coordinate(oppositeA)} ${axisY})`} aria-hidden="true">
                <circle r="9" />
                <text y="78">−A({formatRussianNumber(oppositeA)})</text>
              </g>
            )}
          </svg>
        </div>

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">↔</span>
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
