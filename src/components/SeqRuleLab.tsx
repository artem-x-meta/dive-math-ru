import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  approximate,
  arithmeticProgression,
  arithmeticSum,
  axisBound,
  classifySequence,
  formatExactValue,
  geometricProgression,
  geometricSum,
  recurrence,
  recurrenceTerms,
} from '../lib/sequences';
import { compareExact, parseExact, subtractExact, type ExactRational } from '../lib/exactRational';

export type SeqRulePreset = 'arithmetic' | 'geometric' | 'mixed';

export interface SeqRuleLabProps {
  preset?: SeqRulePreset;
  initialFirst?: number;
  initialStep?: number;
  initialRatio?: number;
  initialCount?: number;
  challenge?: boolean;
}

const DRAFT_PATTERN = /^[+\-−]?\d*(?:[.,]\d*)?$/;
const MAX_DRAFT_LENGTH = 12;
const FIRST_LIMIT = 50;
const STEP_LIMIT = 20;
const RATIO_LIMIT = 4;
const HALF = 0.5;
const MIN_COUNT = 3;
const MAX_COUNT = 10;
const VISIBLE_IN_CHALLENGE = 3;

const PRESET_LABELS: Record<SeqRulePreset, string> = {
  arithmetic: 'Арифметическая',
  geometric: 'Геометрическая',
  mixed: 'Смешанное правило',
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function safeNumber(value: number | undefined, fallback: number, limit: number, step: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clamp(quantize(value, step), -limit, limit);
}

function parseDraft(rawValue: string): number | null {
  const normalized = rawValue.trim().replace('−', '-').replace(',', '.');
  if (normalized === '' || normalized === '-' || normalized === '+' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: number | ExactRational): string {
  return formatExactValue(value);
}

function draftText(value: number): string {
  return String(value).replace('.', ',');
}

interface NumberFieldProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  skipZero?: boolean;
  onChange: (value: number) => void;
}

function NumberField({ id, label, hint, value, minimum, maximum, step, skipZero = false, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(draftText(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(draftText(value));
  }, [editing, value]);

  const settle = (candidate: number, direction: -1 | 1): number => {
    const bounded = clamp(quantize(candidate, step), minimum, maximum);
    if (!skipZero || bounded !== 0) return bounded;
    const shifted = clamp(quantize(bounded + direction * step, step), minimum, maximum);
    return shifted === 0 ? step : shifted;
  };

  const commit = () => {
    const parsed = parseDraft(draft);
    const next = parsed === null ? value : settle(parsed, 1);
    setDraft(draftText(next));
    onChange(next);
  };

  return (
    <div className="dm-field dm-signed-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{text(value)}</span>
      </label>
      <div className="dm-signed-field__control">
        <button
          type="button"
          className="dm-signed-field__step"
          onClick={() => onChange(settle(value - step, -1))}
          disabled={value <= minimum}
          aria-label={`Уменьшить: ${label}`}
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
            const raw = event.target.value;
            if (DRAFT_PATTERN.test(raw)) setDraft(raw);
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
          onClick={() => onChange(settle(value + step, 1))}
          disabled={value >= maximum}
          aria-label={`Увеличить: ${label}`}
        >
          +
        </button>
      </div>
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

interface PlotProps {
  id: string;
  terms: readonly ExactRational[];
  visibleCount: number;
  reveal: boolean;
  ruleText: string;
}

function TermPlot({ id, terms, visibleCount, reveal, ruleText }: PlotProps) {
  const plotLeft = 76;
  const plotTop = 26;
  const plotWidth = 540;
  const plotHeight = 250;
  const count = terms.length;

  const magnitudes = terms.map((term) => Math.abs(approximate(term)));
  const bound = axisBound(Math.max(...magnitudes, 1));
  const upper = approximate(bound);
  const hasNegative = terms.some((term) => approximate(term) < 0);
  const lower = hasNegative ? -upper : 0;

  const px = (index: number) => plotLeft + (index / count) * plotWidth;
  const py = (value: number) => plotTop + plotHeight * ((upper - value) / (upper - lower));
  const zeroY = py(0);
  const ticks = [0, 1, 2, 3, 4].map((slot) => lower + ((upper - lower) * slot) / 4);

  return (
    <svg className="dm-ratio-graph" viewBox="0 0 660 330" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Точки последовательности на координатной плоскости</title>
      <desc id={`${id}-desc`}>
        {reveal
          ? `${ruleText} Показаны точки с номерами от 1 до ${count}; значения: ${terms.map((term, index) => `a${index + 1} = ${text(term)}`).join(', ')}.`
          : `Показаны только первые ${visibleCount} точек последовательности: ${terms.slice(0, visibleCount).map((term, index) => `a${index + 1} = ${text(term)}`).join(', ')}. Остальные появятся после проверки ответа.`}
        {' '}Ось значений размечена от {text(lower)} до {text(upper)} с равным шагом, поэтому высоты точек сравнимы между собой.
      </desc>

      <g className="dm-ratio-graph__grid" aria-hidden="true">
        {ticks.map((tick) => (
          <line key={`h-${tick}`} x1={plotLeft} y1={py(tick)} x2={plotLeft + plotWidth} y2={py(tick)} />
        ))}
        {Array.from({ length: count + 1 }, (_unused, index) => (
          <line key={`v-${index}`} x1={px(index)} y1={plotTop} x2={px(index)} y2={plotTop + plotHeight} />
        ))}
      </g>

      <g aria-hidden="true">
        <line className="dm-ratio-graph__axis" x1={plotLeft} y1={zeroY} x2={plotLeft + plotWidth + 10} y2={zeroY} />
        <line className="dm-ratio-graph__axis" x1={plotLeft} y1={plotTop + plotHeight} x2={plotLeft} y2={plotTop - 10} />
      </g>

      <g aria-hidden="true">
        {terms.slice(0, visibleCount).map((term, index) => {
          const value = approximate(term);
          const x = px(index + 1);
          const y = py(value);
          return (
            <g key={`point-${index}`}>
              <line className="dm-ratio-graph__guide" x1={x} y1={zeroY} x2={x} y2={y} />
              <circle className="dm-ratio-graph__point" cx={x} cy={y} r="6" />
            </g>
          );
        })}
        {!reveal && terms.slice(visibleCount).map((_term, offset) => (
          <text
            className="dm-ratio-graph__label"
            key={`hidden-${offset}`}
            x={px(visibleCount + offset + 1)}
            y={zeroY - 10}
            textAnchor="middle"
          >
            ?
          </text>
        ))}
      </g>

      <g aria-hidden="true">
        {ticks.map((tick) => (
          <text className="dm-ratio-graph__label" key={`tl-${tick}`} x={plotLeft - 10} y={py(tick) + 4} textAnchor="end">
            {text(tick)}
          </text>
        ))}
        {Array.from({ length: count }, (_unused, index) => (
          <text
            className="dm-ratio-graph__label"
            key={`nl-${index}`}
            x={px(index + 1)}
            y={plotTop + plotHeight + 22}
            textAnchor="middle"
          >
            {index + 1}
          </text>
        ))}
        <text className="dm-ratio-graph__axis-title" x={plotLeft + plotWidth + 6} y={plotTop + plotHeight + 22} textAnchor="end">
          n — номер члена
        </text>
        <text className="dm-ratio-graph__axis-title" x={plotLeft - 46} y={plotTop - 6}>
          aₙ
        </text>
      </g>
    </svg>
  );
}

export default function SeqRuleLab({
  preset = 'arithmetic',
  initialFirst,
  initialStep,
  initialRatio,
  initialCount,
  challenge = false,
}: SeqRuleLabProps) {
  const reactId = useId();
  const labId = `seq-rule-${reactId.replace(/:/g, '')}`;

  const [kind, setKind] = useState<SeqRulePreset>(preset);
  const [first, setFirst] = useState(() => safeNumber(initialFirst, 3, FIRST_LIMIT, HALF));
  const [step, setStep] = useState(() => safeNumber(initialStep, 4, STEP_LIMIT, HALF));
  const [ratio, setRatio] = useState(() => {
    const candidate = safeNumber(initialRatio, 2, RATIO_LIMIT, HALF);
    return candidate === 0 ? 2 : candidate;
  });
  const [count, setCount] = useState(() => clamp(Math.round(initialCount ?? 7), MIN_COUNT, MAX_COUNT));
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const multiplier = kind === 'arithmetic' ? 1 : ratio;
  const addend = kind === 'geometric' ? 0 : step;

  const terms = useMemo(
    () => recurrenceTerms(recurrence(first, multiplier, addend), count),
    [first, multiplier, addend, count],
  );
  const kindInfo = useMemo(() => classifySequence(terms), [terms]);

  const reveal = !challenge || checked;
  const visibleCount = reveal ? count : Math.min(VISIBLE_IN_CHALLENGE, count);
  const lastTerm = terms[count - 1]!;

  const parsedAnswer = parseDraft(answer);
  const answerReady = parsedAnswer !== null;
  const answerCorrect = parsedAnswer !== null && compareExact(parseExact(parsedAnswer), lastTerm) === 0;

  const explicitText = kindInfo.isArithmetic && kindInfo.difference !== null
    ? `aₙ = ${text(first)} + (n − 1)·${text(kindInfo.difference)}`
    : kindInfo.isGeometric && kindInfo.ratio !== null
      ? `aₙ = ${text(first)}·${text(kindInfo.ratio)}^(n − 1)`
      : 'явной формулы через n у этого правила в школьном курсе нет';

  const sumText = useMemo(() => {
    if (kindInfo.isArithmetic && kindInfo.difference !== null) {
      return text(arithmeticSum(arithmeticProgression(first, kindInfo.difference), count));
    }
    if (kindInfo.isGeometric && kindInfo.ratio !== null && first !== 0) {
      return text(geometricSum(geometricProgression(first, kindInfo.ratio), count));
    }
    return null;
  }, [kindInfo, first, count]);

  const kindText = kindInfo.isArithmetic && kindInfo.isGeometric
    ? 'постоянная последовательность: это и арифметическая прогрессия с d = 0, и геометрическая с q = 1'
    : kindInfo.isArithmetic
      ? `арифметическая прогрессия с разностью d = ${text(kindInfo.difference!)}`
      : kindInfo.isGeometric
        ? `геометрическая прогрессия со знаменателем q = ${text(kindInfo.ratio!)}`
        : 'не арифметическая и не геометрическая прогрессия';

  const firstDifference = subtractExact(terms[1]!, terms[0]!);
  const secondDifference = subtractExact(terms[2]!, terms[1]!);

  const ruleText = `Правило: a₁ = ${text(first)}, aₙ₊₁ = ${text(multiplier)}·aₙ ${addend < 0 ? '−' : '+'} ${text(Math.abs(addend))}.`;

  const result = !reveal
    ? {
      symbol: '?',
      headline: `Предскажи a${count} по трём первым членам.`,
      detail: 'Сначала посмотри, что происходит при переходе от члена к члену: прибавляется одно и то же число или умножается на одно и то же число.',
    }
    : challenge
      ? {
        symbol: answerCorrect ? '✓' : '×',
        headline: answerCorrect
          ? `Верно: a${count} = ${text(lastTerm)}.`
          : `Здесь a${count} = ${text(lastTerm)}.`,
        detail: `Это ${kindText}. ${explicitText}.`,
      }
      : {
        symbol: 'aₙ',
        headline: `Это ${kindText}.`,
        detail: sumText === null
          ? `${explicitText}. Первые разности: ${text(firstDifference)} и ${text(secondDifference)} — они не совпадают, значит арифметической прогрессии нет.`
          : `${explicitText}; сумма первых ${count} членов равна ${sumText}.`,
      };

  const reset = () => {
    setKind(preset);
    setFirst(safeNumber(initialFirst, 3, FIRST_LIMIT, HALF));
    setStep(safeNumber(initialStep, 4, STEP_LIMIT, HALF));
    setRatio(safeNumber(initialRatio, 2, RATIO_LIMIT, HALF) || 2);
    setCount(clamp(Math.round(initialCount ?? 7), MIN_COUNT, MAX_COUNT));
    setAnswer('');
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-ratio-rate-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория последовательностей</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {challenge ? 'Угадай следующий член по правилу' : 'Одно правило — вся последовательность'}
          </h3>
          <p>
            Каждый следующий член получается из предыдущего по формуле aₙ₊₁ = m·aₙ + c. Меняй m и c и смотри,
            когда получается арифметическая прогрессия, когда геометрическая, а когда ни та ни другая.
          </p>
        </div>
        <span className="dm-lab__badge">aₙ₊₁ = m·aₙ + c</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-ratio-tabs" role="group" aria-label="Вид правила">
          {(Object.keys(PRESET_LABELS) as SeqRulePreset[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`dm-ratio-tab ${kind === option ? 'dm-ratio-tab--active' : ''}`}
              aria-pressed={kind === option}
              onClick={() => {
                setKind(option);
                setAnswer('');
                setChecked(false);
              }}
            >
              {PRESET_LABELS[option]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-ratio-controls">
          <NumberField
            id={`${labId}-first`}
            label="Первый член a₁"
            hint={`От −${FIRST_LIMIT} до ${FIRST_LIMIT}, шаг 0,5`}
            value={first}
            minimum={-FIRST_LIMIT}
            maximum={FIRST_LIMIT}
            step={HALF}
            onChange={(value) => {
              setFirst(value);
              setChecked(false);
            }}
          />
          {kind !== 'geometric' && (
            <NumberField
              id={`${labId}-step`}
              label={kind === 'arithmetic' ? 'Разность d (слагаемое c)' : 'Слагаемое c'}
              hint={`От −${STEP_LIMIT} до ${STEP_LIMIT}, шаг 0,5`}
              value={step}
              minimum={-STEP_LIMIT}
              maximum={STEP_LIMIT}
              step={HALF}
              onChange={(value) => {
                setStep(value);
                setChecked(false);
              }}
            />
          )}
          {kind !== 'arithmetic' && (
            <NumberField
              id={`${labId}-ratio`}
              label={kind === 'geometric' ? 'Знаменатель q (множитель m)' : 'Множитель m'}
              hint={`От −${RATIO_LIMIT} до ${RATIO_LIMIT} без нуля, шаг 0,5`}
              value={ratio}
              minimum={-RATIO_LIMIT}
              maximum={RATIO_LIMIT}
              step={HALF}
              skipZero
              onChange={(value) => {
                setRatio(value);
                setChecked(false);
              }}
            />
          )}
          <NumberField
            id={`${labId}-count`}
            label="Сколько членов показать"
            hint={`Целое число от ${MIN_COUNT} до ${MAX_COUNT}`}
            value={count}
            minimum={MIN_COUNT}
            maximum={MAX_COUNT}
            step={1}
            onChange={(value) => {
              setCount(clamp(Math.round(value), MIN_COUNT, MAX_COUNT));
              setChecked(false);
            }}
          />
        </div>

        <p className="dm-ratio-unit-rate"><strong>{ruleText}</strong></p>

        <div className="dm-ratio-table-wrap" role="region" aria-label="Таблица членов последовательности" tabIndex={0}>
          <table className="dm-ratio-table">
            <caption>Номер и значение члена</caption>
            <thead>
              <tr>
                <th scope="col">n</th>
                {terms.map((_term, index) => <th scope="col" key={`h-${index}`}>{index + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">aₙ</th>
                {terms.map((term, index) => (
                  <td key={`v-${index}`} className={index + 1 === count ? 'dm-ratio-table__current' : ''}>
                    {index < visibleCount ? text(term) : '?'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график членов последовательности" tabIndex={0}>
          <TermPlot id={`${labId}-plot`} terms={terms} visibleCount={visibleCount} reveal={reveal} ruleText={ruleText} />
        </div>
        <p className="dm-ratio-graph-note">
          Последовательность определена только при натуральных n, поэтому на графике стоят отдельные точки, а не сплошная линия.
        </p>

        {challenge && (
          <div className="dm-geometry-answer-grid">
            <div className="dm-geometry-answer-field">
              <label htmlFor={`${labId}-answer`}>Мой ответ: a{count}</label>
              <input
                id={`${labId}-answer`}
                type="text"
                inputMode="decimal"
                maxLength={MAX_DRAFT_LENGTH}
                value={answer}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (DRAFT_PATTERN.test(raw)) {
                    setAnswer(raw);
                    setChecked(false);
                  }
                }}
              />
            </div>
            <button className="dm-button" type="button" disabled={!answerReady} onClick={() => setChecked(true)}>
              Проверить
            </button>
          </div>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span>
          <p>
            <strong>{result.headline}</strong>
            <small>{result.detail}</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
