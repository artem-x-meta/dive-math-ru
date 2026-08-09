import { useEffect, useId, useRef, useState } from 'react';
import {
  exactCosine,
  exactSine,
  exactTangent,
  formatDecimalPlain,
  formatPiFractionPlain,
  fullTurns,
  piFractionFromDegrees,
  referenceAngleDegrees,
  tangentOf,
  unitCirclePoint,
  type ExactValue,
} from '../lib/trigonometry';

export type TrigCircleMode = 'point' | 'reduce';

export interface TrigCircleLabProps {
  mode?: TrigCircleMode;
  initialDegrees?: number;
  challenge?: boolean;
}

const MODES: readonly TrigCircleMode[] = ['point', 'reduce'];
const MODE_LABELS: Readonly<Record<TrigCircleMode, string>> = {
  point: 'Точка поворота',
  reduce: 'Приведение к обороту',
};

const MIN_DEGREES = -900;
const MAX_DEGREES = 900;
const STEP_DEGREES = 15;

const WIDTH = 720;
const HEIGHT = 560;
const CENTER_X = 330;
const CENTER_Y = 280;
const RADIUS = 208;
const ARC_RADIUS = 66;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function safeDegrees(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value / STEP_DEGREES) * STEP_DEGREES, MIN_DEGREES, MAX_DEGREES);
}

/** Точное значение печатаем как есть, иррациональное дополняем приближением. */
function describeExact(exact: ExactValue | null, value: number | null): string {
  if (value === null) return 'не существует';
  if (exact === null) return `≈ ${formatDecimalPlain(value, 4)}`;
  if (exact.radicand === 1) return exact.plain;
  return `${exact.plain} ≈ ${formatDecimalPlain(value, 4)}`;
}

interface AngleFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

function AngleField({ id, label, value, onChange }: AngleFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  const quantize = (raw: number): number =>
    clamp(Math.round(raw / STEP_DEGREES) * STEP_DEGREES, MIN_DEGREES, MAX_DEGREES);

  const parse = (raw: string): number | null => {
    const normalized = raw.trim().replace('−', '-');
    if (!/^-?\d+$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>{label}<span className="dm-field__value">{value}°</span></label>
      <div className="dm-geometry-field__control">
        <button
          type="button"
          onClick={() => onChange(quantize(value - STEP_DEGREES))}
          disabled={value <= MIN_DEGREES}
          aria-label={`Уменьшить угол на ${STEP_DEGREES} градусов`}
        >−</button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => { cancelCommit.current = false; setEditing(true); }}
          onChange={(event) => {
            const raw = event.target.value.slice(0, 5);
            if (!/^[-−]?\d*$/.test(raw)) return;
            setDraft(raw);
            const parsed = parse(raw);
            if (parsed !== null) onChange(quantize(parsed));
          }}
          onBlur={() => {
            if (!cancelCommit.current) {
              const parsed = parse(draft);
              if (parsed !== null) onChange(quantize(parsed));
            }
            cancelCommit.current = false;
            setDraft(String(value));
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelCommit.current = true;
              setDraft(String(value));
              event.currentTarget.blur();
            }
            if (event.key === 'ArrowUp') { event.preventDefault(); onChange(quantize(value + STEP_DEGREES)); }
            if (event.key === 'ArrowDown') { event.preventDefault(); onChange(quantize(value - STEP_DEGREES)); }
          }}
        />
        <button
          type="button"
          onClick={() => onChange(quantize(value + STEP_DEGREES))}
          disabled={value >= MAX_DEGREES}
          aria-label={`Увеличить угол на ${STEP_DEGREES} градусов`}
        >+</button>
      </div>
      <small id={`${id}-hint`}>От {MIN_DEGREES}° до {MAX_DEGREES}°, шаг {STEP_DEGREES}°; стрелки ↑ и ↓ тоже работают.</small>
    </div>
  );
}

export default function TrigCircleLab({ mode, initialDegrees, challenge = false }: TrigCircleLabProps) {
  const reactId = useId();
  const labId = `trig-circle-${reactId.replace(/:/g, '')}`;
  const defaultMode: TrigCircleMode = mode !== undefined && MODES.includes(mode) ? mode : 'point';
  const defaultDegrees = safeDegrees(initialDegrees, defaultMode === 'reduce' ? 750 : 210);

  const [activeMode, setActiveMode] = useState(defaultMode);
  const [degrees, setDegrees] = useState(defaultDegrees);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const point = unitCirclePoint(degrees);
  const normalized = point.degrees;
  const turns = fullTurns(degrees);
  const quadrant = point.quadrant;
  const reference = referenceAngleDegrees(degrees);
  const radianFraction = piFractionFromDegrees(normalized);
  const sine = exactSine(normalized);
  const cosine = exactCosine(normalized);
  const tangentExact = exactTangent(normalized);
  const tangentNumber = tangentOf(normalized);

  const reveal = !challenge || checked;
  const parsedAnswer = /^[0-4]$/.test(answer.trim()) ? Number(answer.trim()) : null;
  const answerCorrect = parsedAnswer !== null && parsedAnswer === quadrant;

  const screenX = CENTER_X + RADIUS * point.x;
  const screenY = CENTER_Y - RADIUS * point.y;
  const arcEndX = CENTER_X + ARC_RADIUS * point.x;
  const arcEndY = CENTER_Y - ARC_RADIUS * point.y;
  const midAngle = (normalized / 2) * (Math.PI / 180);
  const labelX = CENTER_X + (ARC_RADIUS + 34) * Math.cos(midAngle);
  const labelY = CENTER_Y - (ARC_RADIUS + 34) * Math.sin(midAngle) + 9;
  const arcPath = normalized === 0
    ? ''
    : `M ${CENTER_X + ARC_RADIUS} ${CENTER_Y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 ${normalized > 180 ? 1 : 0} 0 ${arcEndX} ${arcEndY}`;

  const turnsText = turns === 0
    ? 'полных оборотов нет'
    : `${Math.abs(turns)} ${Math.abs(turns) === 1 ? 'полный оборот' : 'полных оборота'} ${turns > 0 ? 'против' : 'по'} часовой стрелке отброшено`;

  const description = `Единичная окружность с центром в начале координат. Угол поворота ${degrees} градусов приведён к ${normalized} градусам: ${turnsText}. Точка поворота имеет координаты x = ${formatDecimalPlain(point.x, 4)} и y = ${formatDecimalPlain(point.y, 4)}, она лежит ${quadrant === 0 ? 'на оси координат' : `в ${quadrant} четверти`}. Абсцисса точки равна косинусу, ордината — синусу.`;

  const reset = () => {
    setActiveMode(defaultMode);
    setDegrees(defaultDegrees);
    setAnswer('');
    setChecked(false);
  };

  const changeDegrees = (value: number) => {
    setDegrees(value);
    setChecked(false);
    setAnswer('');
  };

  const readout = (() => {
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: `Угол поворота равен ${degrees}°. В какой четверти окажется точка?`,
        detail: 'Сначала отбрось полные обороты, потом сравни остаток с 90°, 180° и 270°. Если точка попала на ось, введи 0.',
      };
    }
    return {
      symbol: challenge ? (answerCorrect ? '✓' : '×') : '↺',
      headline: `${degrees}° → ${normalized}°${radianFraction === null ? '' : ` = ${formatPiFractionPlain(radianFraction)}`}; ${quadrant === 0 ? 'точка лежит на оси' : `${quadrant} четверть`}`,
      detail: `cos = ${describeExact(cosine, point.x)}; sin = ${describeExact(sine, point.y)}; tg = ${describeExact(tangentExact, tangentNumber)}. Опорный острый угол равен ${reference}°, ${turnsText}.`,
    };
  })();

  return (
    <section className="dm-lab dm-geometry-angle-shape not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория единичной окружности</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Угол поворота и координаты точки</h3>
          <p>Координаты вычисляются по углу, а не подгоняются под картинку: для табличных углов они точные.</p>
        </div>
        <span className="dm-lab__badge">{challenge ? 'задача' : 'исследование'}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Что рассматриваем">
          {MODES.map((item) => (
            <button
              type="button"
              className={activeMode === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
              aria-pressed={activeMode === item}
              onClick={() => { setActiveMode(item); setChecked(false); setAnswer(''); }}
              key={item}
            >
              {MODE_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-geometry-controls">
          <AngleField id={`${labId}-angle`} label="Угол поворота" value={degrees} onChange={changeDegrees} />
        </div>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж единичной окружности" tabIndex={0}>
          <svg
            className="dm-geometry-angle"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-labelledby={`${labId}-title ${labId}-desc`}
          >
            <title id={`${labId}-title`}>Точка поворота на единичной окружности</title>
            <desc id={`${labId}-desc`}>{description}</desc>

            <g aria-hidden="true">
              <line className="dm-signed-plane__axis" x1={CENTER_X - RADIUS - 46} y1={CENTER_Y} x2={CENTER_X + RADIUS + 46} y2={CENTER_Y} />
              <line className="dm-signed-plane__axis" x1={CENTER_X} y1={CENTER_Y + RADIUS + 46} x2={CENTER_X} y2={CENTER_Y - RADIUS - 46} />
              <circle className="dm-geometry-circle__boundary" cx={CENTER_X} cy={CENTER_Y} r={RADIUS} />
              <g className="dm-signed-plane__labels">
                <text x={CENTER_X + RADIUS + 34} y={CENTER_Y - 14}>x = cos</text>
                <text x={CENTER_X + 12} y={CENTER_Y - RADIUS - 30}>y = sin</text>
                <text x={CENTER_X + RADIUS - 6} y={CENTER_Y + 22}>1</text>
                <text x={CENTER_X - RADIUS - 4} y={CENTER_Y + 22}>−1</text>
                <text x={CENTER_X - 22} y={CENTER_Y - RADIUS + 6}>1</text>
                <text x={CENTER_X - 28} y={CENTER_Y + RADIUS + 6}>−1</text>
                <text x={CENTER_X - 18} y={CENTER_Y + 22}>0</text>
                <text x={CENTER_X + RADIUS + 26} y={CENTER_Y + 40}>0°</text>
                <text x={CENTER_X + 26} y={CENTER_Y - RADIUS - 8}>90°</text>
                <text x={CENTER_X - RADIUS - 52} y={CENTER_Y + 40}>180°</text>
                <text x={CENTER_X + 26} y={CENTER_Y + RADIUS + 34}>270°</text>
              </g>
            </g>

            {arcPath !== '' && (
              <g aria-hidden="true">
                <path className="dm-geometry-angle__arc" d={arcPath} />
                <text className="dm-geometry-angle__value" x={labelX} y={labelY} textAnchor="middle">{normalized}°</text>
              </g>
            )}

            {reveal && (
              <g aria-hidden="true">
                <g className="dm-geometry-figure__construction">
                  <line x1={screenX} y1={screenY} x2={screenX} y2={CENTER_Y} />
                  <line x1={screenX} y1={screenY} x2={CENTER_X} y2={screenY} />
                </g>
                <line className="dm-geometry-circle__radius" x1={CENTER_X} y1={CENTER_Y} x2={screenX} y2={screenY} />
                <circle className="dm-geometry-circle__center" cx={CENTER_X} cy={CENTER_Y} r="7" />
                <circle className="dm-geometry-static__point" cx={screenX} cy={screenY} r="10" />
                <g className="dm-geometry-circle__label">
                  <text x={screenX + (point.x >= 0 ? 56 : -56)} y={screenY + (point.y >= 0 ? -22 : 34)}>
                    P({formatDecimalPlain(point.x, 3)}; {formatDecimalPlain(point.y, 3)})
                  </text>
                  <text x={screenX} y={CENTER_Y + (point.y >= 0 ? 30 : -16)}>cos = {formatDecimalPlain(point.x, 3)}</text>
                  <text x={CENTER_X + (point.x >= 0 ? -76 : 76)} y={screenY - 12}>sin = {formatDecimalPlain(point.y, 3)}</text>
                </g>
              </g>
            )}
          </svg>
        </div>

        {activeMode === 'reduce' && (
          <p className="dm-signed-caption">
            {degrees}° = {normalized}° + 360°·{turns}. Точка поворота у углов {degrees}° и {normalized}° одна и та же,
            поэтому синус, косинус и тангенс у них совпадают.
          </p>
        )}

        {challenge && (
          <div className="dm-geometry-answer-grid">
            <div className="dm-geometry-answer-field">
              <label htmlFor={`${labId}-answer`}>Номер четверти (0 — если точка на оси)</label>
              <input
                id={`${labId}-answer`}
                type="text"
                inputMode="numeric"
                value={answer}
                onChange={(event) => {
                  const raw = event.target.value.slice(0, 1);
                  if (/^[0-4]?$/.test(raw)) { setAnswer(raw); setChecked(false); }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && parsedAnswer !== null) { event.preventDefault(); setChecked(true); }
                }}
              />
            </div>
            <button className="dm-button" type="button" disabled={parsedAnswer === null} onClick={() => setChecked(true)}>Проверить</button>
          </div>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{readout.symbol}</span>
          <p><strong>{readout.headline}</strong><small>{readout.detail}</small></p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
