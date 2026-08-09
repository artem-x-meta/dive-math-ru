import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  approximate,
  axisBound,
  axisTicks,
  compareGrowth,
  formatExactValue,
  formatFixed,
  periodsToReach,
  roundExact,
  totalPercentChange,
} from '../lib/sequences';
import { addExact, compareExact, negateExact, parseExact, subtractExact, type ExactRational } from '../lib/exactRational';

export type SeqGrowthMode = 'simple' | 'fixed';

export interface SeqGrowthLabProps {
  initialStart?: number;
  initialRate?: number;
  initialPeriods?: number;
  initialLinearStep?: number;
  initialMode?: SeqGrowthMode;
  challenge?: boolean;
}

const DRAFT_PATTERN = /^[+\-−]?\d*(?:[.,]\d*)?$/;
const MAX_DRAFT_LENGTH = 14;

const START_MIN = 1_000;
const START_MAX = 200_000;
const START_STEP = 1_000;
const RATE_MIN = -50;
const RATE_MAX = 50;
const RATE_STEP = 0.5;
const PERIODS_MIN = 1;
const PERIODS_MAX = 15;
const LINEAR_MIN = 0;
const LINEAR_MAX = 50_000;
const LINEAR_STEP = 500;
const VISIBLE_IN_CHALLENGE = 1;

const MODE_LABELS: Record<SeqGrowthMode, string> = {
  simple: 'Линейная модель = простой процент',
  fixed: 'Своя прибавка за шаг',
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function safeNumber(value: number | undefined, fallback: number, minimum: number, maximum: number, step: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clamp(quantize(value, step), minimum, maximum);
}

function parseDraft(rawValue: string): number | null {
  const normalized = rawValue.trim().replace('−', '-').replace(',', '.');
  if (normalized === '' || normalized === '-' || normalized === '+' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function draftText(value: number): string {
  return String(value).replace('.', ',');
}

function money(value: ExactRational | number): string {
  return formatFixed(value, 2);
}

interface NumberFieldProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  onChange: (value: number) => void;
}

function NumberField({ id, label, hint, value, minimum, maximum, step, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(draftText(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(draftText(value));
  }, [editing, value]);

  const settle = (candidate: number): number => clamp(quantize(candidate, step), minimum, maximum);

  const commit = () => {
    const parsed = parseDraft(draft);
    const next = parsed === null ? value : settle(parsed);
    setDraft(draftText(next));
    onChange(next);
  };

  return (
    <div className="dm-field dm-signed-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{formatExactValue(value)}</span>
      </label>
      <div className="dm-signed-field__control">
        <button
          type="button"
          className="dm-signed-field__step"
          onClick={() => onChange(settle(value - step))}
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
          onClick={() => onChange(settle(value + step))}
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

interface GrowthPlotProps {
  id: string;
  points: readonly { index: number; linear: ExactRational; exponential: ExactRational }[];
  lower: ExactRational;
  upper: ExactRational;
  ticks: readonly ExactRational[];
  visibleCount: number;
  reveal: boolean;
  summary: string;
}

function GrowthPlot({ id, points, lower, upper, ticks, visibleCount, reveal, summary }: GrowthPlotProps) {
  const plotLeft = 92;
  const plotTop = 30;
  const plotWidth = 512;
  const plotHeight = 232;
  const lastIndex = points.length - 1;

  const low = approximate(lower);
  const high = approximate(upper);
  const span = high - low === 0 ? 1 : high - low;

  const px = (index: number) => plotLeft + (index / Math.max(lastIndex, 1)) * plotWidth;
  const py = (value: number) => plotTop + plotHeight * ((high - value) / span);
  // Ноль всегда попадает в отрезок [low; high], поэтому горизонтальная ось честно стоит на нуле.
  const baseY = py(0);

  const shown = points.slice(0, visibleCount + 1);
  const segments = (pick: 'linear' | 'exponential') =>
    shown.slice(1).map((point, offset) => ({
      key: `${pick}-${point.index}`,
      x1: px(shown[offset]!.index),
      y1: py(approximate(shown[offset]![pick])),
      x2: px(point.index),
      y2: py(approximate(point[pick])),
    }));

  return (
    <svg className="dm-ratio-graph" viewBox="0 0 680 330" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Две модели роста на одной координатной плоскости</title>
      <desc id={`${id}-desc`}>
        {reveal
          ? summary
          : `Показаны только первые ${visibleCount + 1} шага обеих моделей. Остальные точки появятся после проверки ответа.`}
        {' '}Вертикальная ось размечена от {formatExactValue(lower)} до {formatExactValue(upper)} с равным шагом, обе модели нарисованы в одном масштабе, поэтому их высоты сравнимы.
      </desc>

      <g className="dm-ratio-graph__grid" aria-hidden="true">
        {ticks.map((tick, slot) => (
          <line key={`h-${slot}`} x1={plotLeft} y1={py(approximate(tick))} x2={plotLeft + plotWidth} y2={py(approximate(tick))} />
        ))}
        {points.map((point) => (
          <line key={`v-${point.index}`} x1={px(point.index)} y1={plotTop} x2={px(point.index)} y2={plotTop + plotHeight} />
        ))}
      </g>

      <g aria-hidden="true">
        <line className="dm-ratio-graph__axis" x1={plotLeft} y1={baseY} x2={plotLeft + plotWidth + 10} y2={baseY} />
        <line className="dm-ratio-graph__axis" x1={plotLeft} y1={plotTop + plotHeight} x2={plotLeft} y2={plotTop - 10} />
      </g>

      <g aria-hidden="true">
        {segments('linear').map((segment) => (
          <line className="dm-ratio-graph__guide" key={segment.key} x1={segment.x1} y1={segment.y1} x2={segment.x2} y2={segment.y2} />
        ))}
      </g>
      <g className="dm-signed-plane__route-segment" aria-hidden="true">
        {segments('exponential').map((segment) => (
          <line key={segment.key} x1={segment.x1} y1={segment.y1} x2={segment.x2} y2={segment.y2} />
        ))}
      </g>

      <g aria-hidden="true">
        {shown.map((point) => (
          <circle
            className="dm-ratio-graph__point"
            key={`lin-${point.index}`}
            cx={px(point.index)}
            cy={py(approximate(point.linear))}
            r="5"
          />
        ))}
      </g>
      <g className="dm-signed-plane__point dm-signed-plane__point--a" aria-hidden="true">
        {shown.map((point) => (
          <circle key={`exp-${point.index}`} cx={px(point.index)} cy={py(approximate(point.exponential))} r="6" />
        ))}
        {!reveal && points.slice(visibleCount + 1).map((point) => (
          <text
            className="dm-ratio-graph__label"
            key={`hidden-${point.index}`}
            x={px(point.index)}
            y={baseY - 12}
            textAnchor="middle"
          >
            ?
          </text>
        ))}
      </g>

      <g aria-hidden="true">
        {ticks.map((tick, slot) => (
          <text
            className="dm-ratio-graph__label"
            key={`tl-${slot}`}
            x={plotLeft - 10}
            y={py(approximate(tick)) + 4}
            textAnchor="end"
          >
            {formatExactValue(roundExact(tick, 0))}
          </text>
        ))}
        {points.map((point) => (
          <text
            className="dm-ratio-graph__label"
            key={`nl-${point.index}`}
            x={px(point.index)}
            y={plotTop + plotHeight + 22}
            textAnchor="middle"
          >
            {point.index}
          </text>
        ))}
        <text className="dm-ratio-graph__axis-title" x={plotLeft + plotWidth + 10} y={plotTop + plotHeight + 22} textAnchor="end">
          n — номер шага
        </text>
        <text className="dm-ratio-graph__axis-title" x={plotLeft - 82} y={plotTop - 8}>
          величина
        </text>
      </g>

      <g aria-hidden="true">
        <line className="dm-ratio-graph__guide" x1={plotLeft + 10} y1={310} x2={plotLeft + 52} y2={310} />
        <circle className="dm-ratio-graph__point" cx={plotLeft + 31} cy={310} r="5" />
        <text className="dm-ratio-graph__label" x={plotLeft + 60} y={314}>равные прибавки (линейная)</text>
        <g className="dm-signed-plane__route-segment">
          <line x1={plotLeft + 262} y1={310} x2={plotLeft + 304} y2={310} />
        </g>
        <g className="dm-signed-plane__point dm-signed-plane__point--a">
          <circle cx={plotLeft + 283} cy={310} r="6" />
        </g>
        <text className="dm-ratio-graph__label" x={plotLeft + 312} y={314}>равные множители (сложный процент)</text>
      </g>
    </svg>
  );
}

export default function SeqGrowthLab({
  initialStart,
  initialRate,
  initialPeriods,
  initialLinearStep,
  initialMode = 'simple',
  challenge = false,
}: SeqGrowthLabProps) {
  const reactId = useId();
  const labId = `seq-growth-${reactId.replace(/:/g, '')}`;

  const [start, setStart] = useState(() => safeNumber(initialStart, 40_000, START_MIN, START_MAX, START_STEP));
  const [rate, setRate] = useState(() => safeNumber(initialRate, 8, RATE_MIN, RATE_MAX, RATE_STEP));
  const [periods, setPeriods] = useState(() => safeNumber(initialPeriods, 8, PERIODS_MIN, PERIODS_MAX, 1));
  const [mode, setMode] = useState<SeqGrowthMode>(initialMode in MODE_LABELS ? initialMode : 'simple');
  const [linearStep, setLinearStep] = useState(() =>
    safeNumber(initialLinearStep, 3_000, LINEAR_MIN, LINEAR_MAX, LINEAR_STEP));
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const comparison = useMemo(
    () => compareGrowth(
      mode === 'simple'
        ? { start, ratePercent: rate, periods }
        : { start, ratePercent: rate, periods, step: linearStep },
    ),
    [start, rate, periods, mode, linearStep],
  );

  const finalPoint = comparison.points[periods]!;
  const gap = subtractExact(finalPoint.exponential, finalPoint.linear);

  const upper = axisBound(compareExact(comparison.maxValue, 1) > 0 ? comparison.maxValue : 1);
  const lower = compareExact(comparison.minValue, 0) < 0
    ? negateExact(axisBound(negateExact(comparison.minValue)))
    : parseExact(0);
  const ticks = useMemo(
    () => axisTicks(subtractExact(upper, lower), 4).map((offset) => addExact(lower, offset)),
    [upper, lower],
  );

  const reveal = !challenge || checked;
  const visibleCount = reveal ? periods : Math.min(VISIBLE_IN_CHALLENGE, periods);

  const parsedAnswer = parseDraft(answer);
  const answerReady = parsedAnswer !== null;
  const answerCorrect = parsedAnswer !== null
    && compareExact(roundExact(parsedAnswer, 0), roundExact(finalPoint.exponential, 0)) === 0;

  const totalChange = totalPercentChange(rate, periods);
  const doubling = useMemo(() => {
    try {
      return periodsToReach(rate, 2);
    } catch {
      return null;
    }
  }, [rate]);

  const summary = `Через ${periods} шагов линейная модель даёт ${money(finalPoint.linear)}, а сложный процент — ${money(finalPoint.exponential)}; разница составляет ${money(gap)}.`;

  const crossoverText = comparison.crossoverIndex === null
    ? 'На показанном отрезке экспоненциальная модель ни разу не обогнала линейную.'
    : `Экспоненциальная модель обгоняет линейную начиная с шага n = ${comparison.crossoverIndex}.`;

  const result = !reveal
    ? {
      symbol: '?',
      headline: `Посчитай сам: чему равна величина после ${periods} шагов при сложном проценте?`,
      detail: `Каждый шаг умножает величину на один и тот же множитель ${formatExactValue(comparison.factor)}. Ответ округли до целых.`,
    }
    : challenge
      ? {
        symbol: answerCorrect ? '✓' : '×',
        headline: answerCorrect
          ? `Верно: ${money(finalPoint.exponential)}.`
          : `Правильный ответ: ${money(finalPoint.exponential)}.`,
        detail: `${start} · ${formatExactValue(comparison.factor)}^${periods}. Линейная модель за то же время даёт только ${money(finalPoint.linear)}. ${crossoverText}`,
      }
      : {
        symbol: '↗',
        headline: summary,
        detail: `${crossoverText} Суммарное изменение при сложном проценте равно ${formatFixed(totalChange, 2)} %, а простое сложение ${formatExactValue(rate)} % × ${periods} дало бы ${formatExactValue(rate * periods)} %.`,
      };

  const reset = () => {
    setStart(safeNumber(initialStart, 40_000, START_MIN, START_MAX, START_STEP));
    setRate(safeNumber(initialRate, 8, RATE_MIN, RATE_MAX, RATE_STEP));
    setPeriods(safeNumber(initialPeriods, 8, PERIODS_MIN, PERIODS_MAX, 1));
    setMode(initialMode in MODE_LABELS ? initialMode : 'simple');
    setLinearStep(safeNumber(initialLinearStep, 3_000, LINEAR_MIN, LINEAR_MAX, LINEAR_STEP));
    setAnswer('');
    setChecked(false);
  };

  return (
    <section
      className="dm-lab dm-ratio-rate-lab dm-signed-coordinate-plane not-content"
      aria-labelledby={`${labId}-heading`}
    >
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория роста</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {challenge ? 'Посчитай, куда придёт сложный процент' : 'Равные прибавки против равных множителей'}
          </h3>
          <p>
            Две модели стартуют из одного числа. Первая каждый шаг прибавляет одно и то же, вторая — умножает
            на одно и то же. Обе нарисованы в одном масштабе, поэтому разрыв между ними виден честно.
          </p>
        </div>
        <span className="dm-lab__badge">A₀ + kn против A₀qⁿ</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-ratio-tabs" role="group" aria-label="Чем задана линейная модель">
          {(Object.keys(MODE_LABELS) as SeqGrowthMode[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`dm-ratio-tab ${mode === option ? 'dm-ratio-tab--active' : ''}`}
              aria-pressed={mode === option}
              onClick={() => {
                setMode(option);
                setChecked(false);
              }}
            >
              {MODE_LABELS[option]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-ratio-controls">
          <NumberField
            id={`${labId}-start`}
            label="Начальная величина A₀"
            hint={`От ${START_MIN} до ${START_MAX}, шаг ${START_STEP}`}
            value={start}
            minimum={START_MIN}
            maximum={START_MAX}
            step={START_STEP}
            onChange={(value) => {
              setStart(value);
              setChecked(false);
            }}
          />
          <NumberField
            id={`${labId}-rate`}
            label="Ставка за шаг p, %"
            hint={`От ${RATE_MIN} до ${RATE_MAX}, шаг ${RATE_STEP}`}
            value={rate}
            minimum={RATE_MIN}
            maximum={RATE_MAX}
            step={RATE_STEP}
            onChange={(value) => {
              setRate(value);
              setChecked(false);
            }}
          />
          <NumberField
            id={`${labId}-periods`}
            label="Число шагов n"
            hint={`Целое число от ${PERIODS_MIN} до ${PERIODS_MAX}`}
            value={periods}
            minimum={PERIODS_MIN}
            maximum={PERIODS_MAX}
            step={1}
            onChange={(value) => {
              setPeriods(Math.round(value));
              setChecked(false);
            }}
          />
          {mode === 'fixed' && (
            <NumberField
              id={`${labId}-linear`}
              label="Прибавка линейной модели за шаг"
              hint={`От ${LINEAR_MIN} до ${LINEAR_MAX}, шаг ${LINEAR_STEP}`}
              value={linearStep}
              minimum={LINEAR_MIN}
              maximum={LINEAR_MAX}
              step={LINEAR_STEP}
              onChange={(value) => {
                setLinearStep(value);
                setChecked(false);
              }}
            />
          )}
        </div>

        <p className="dm-ratio-unit-rate">
          <strong>
            Линейная модель: aₙ = {formatExactValue(start)} + {formatExactValue(comparison.step)}·n. Экспоненциальная
            модель: bₙ = {formatExactValue(start)}·{formatExactValue(comparison.factor)}ⁿ.
          </strong>
        </p>

        <div className="dm-ratio-table-wrap" role="region" aria-label="Таблица значений обеих моделей" tabIndex={0}>
          <table className="dm-ratio-table">
            <caption>Значения после каждого шага</caption>
            <thead>
              <tr>
                <th scope="col">n</th>
                {comparison.points.map((point) => <th scope="col" key={`h-${point.index}`}>{point.index}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">равные прибавки</th>
                {comparison.points.map((point) => (
                  <td key={`lin-${point.index}`} className={point.index === periods ? 'dm-ratio-table__current' : ''}>
                    {point.index <= visibleCount ? money(point.linear) : '?'}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">равные множители</th>
                {comparison.points.map((point) => (
                  <td key={`exp-${point.index}`} className={point.index === periods ? 'dm-ratio-table__current' : ''}>
                    {point.index <= visibleCount ? money(point.exponential) : '?'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график двух моделей роста" tabIndex={0}>
          <GrowthPlot
            id={`${labId}-plot`}
            points={comparison.points}
            lower={lower}
            upper={upper}
            ticks={ticks}
            visibleCount={visibleCount}
            reveal={reveal}
            summary={summary}
          />
        </div>
        <p className="dm-ratio-graph-note">
          Обе модели определены только при целых n, поэтому точки соединены лишь для того, чтобы взгляд не терял
          линию: сами значения существуют только в отмеченных узлах.
        </p>

        {challenge && (
          <div className="dm-geometry-answer-grid">
            <div className="dm-geometry-answer-field">
              <label htmlFor={`${labId}-answer`}>Мой ответ (сложный процент, до целых)</label>
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
            <small>
              {result.detail}
              {doubling !== null && reveal
                ? ` При такой ставке величина удваивается за ${doubling} шагов.`
                : ''}
            </small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
