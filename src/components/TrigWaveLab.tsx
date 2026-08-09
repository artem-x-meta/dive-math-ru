import { useEffect, useId, useRef, useState } from 'react';
import {
  degreesToRadians,
  exactCosine,
  exactSine,
  formatDecimalPlain,
  formatPiFractionPlain,
  piFractionFromDegrees,
  unitCirclePoint,
  waveSamples,
  waveValue,
  type ExactValue,
} from '../lib/trigonometry';

export type TrigWaveKind = 'sin' | 'cos';

export interface TrigWaveLabProps {
  kind?: TrigWaveKind;
  initialDegrees?: number;
  challenge?: boolean;
}

const KINDS: readonly TrigWaveKind[] = ['sin', 'cos'];
const KIND_LABELS: Readonly<Record<TrigWaveKind, string>> = {
  sin: 'y = sin x',
  cos: 'y = cos x',
};

const MIN_DEGREES = -360;
const MAX_DEGREES = 360;
const STEP_DEGREES = 15;

const WIDTH = 880;
const HEIGHT = 430;
const CENTER_X = 152;
const CENTER_Y = 208;
const RADIUS = 118;
const GRAPH_LEFT = 336;
const GRAPH_RIGHT = 862;
const T_MIN = -2 * Math.PI;
const T_MAX = 2 * Math.PI;
const SAMPLE_COUNT = 241;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function safeDegrees(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value / STEP_DEGREES) * STEP_DEGREES, MIN_DEGREES, MAX_DEGREES);
}

function graphX(t: number): number {
  return GRAPH_LEFT + ((t - T_MIN) / (T_MAX - T_MIN)) * (GRAPH_RIGHT - GRAPH_LEFT);
}

function graphY(value: number): number {
  return CENTER_Y - value * RADIUS;
}

function describeExact(exact: ExactValue | null, value: number): string {
  if (exact === null) return `≈ ${formatDecimalPlain(value, 4)}`;
  if (exact.radicand === 1) return exact.plain;
  return `${exact.plain} ≈ ${formatDecimalPlain(value, 4)}`;
}

/** Подписи на оси аргумента: доли π в тех точках, где сетка ставит штрих. */
const GRID_STEPS: readonly number[] = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

function gridLabel(halfPiSteps: number): string {
  if (halfPiSteps === 0) return '0';
  const sign = halfPiSteps < 0 ? '−' : '';
  const size = Math.abs(halfPiSteps);
  if (size % 2 === 0) return `${sign}${size / 2 === 1 ? '' : size / 2}π`;
  return `${sign}${size}π/2`;
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
          aria-label={`Уменьшить аргумент на ${STEP_DEGREES} градусов`}
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
          aria-label={`Увеличить аргумент на ${STEP_DEGREES} градусов`}
        >+</button>
      </div>
      <small id={`${id}-hint`}>От {MIN_DEGREES}° до {MAX_DEGREES}°, шаг {STEP_DEGREES}°; стрелки ↑ и ↓ тоже работают.</small>
    </div>
  );
}

export default function TrigWaveLab({ kind, initialDegrees, challenge = false }: TrigWaveLabProps) {
  const reactId = useId();
  const labId = `trig-wave-${reactId.replace(/:/g, '')}`;
  const defaultKind: TrigWaveKind = kind !== undefined && KINDS.includes(kind) ? kind : 'sin';
  const defaultDegrees = safeDegrees(initialDegrees, 60);

  const [activeKind, setActiveKind] = useState(defaultKind);
  const [degrees, setDegrees] = useState(defaultDegrees);
  const [showTwins, setShowTwins] = useState(true);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const t = degreesToRadians(degrees);
  const point = unitCirclePoint(degrees);
  const value = waveValue(activeKind, t) as number;
  const exact = activeKind === 'sin' ? exactSine(degrees) : exactCosine(degrees);
  const radianFraction = piFractionFromDegrees(degrees);

  const reveal = !challenge || checked;
  const parsedAnswer = (() => {
    const normalized = answer.trim().replace('−', '-').replace(',', '.');
    if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  })();
  const answerCorrect = parsedAnswer !== null && Math.abs(parsedAnswer - value) <= 0.011;

  const samples = waveSamples(activeKind, T_MIN, T_MAX, SAMPLE_COUNT);
  const curvePath = samples
    .map((sample, index) => `${index === 0 ? 'M' : 'L'} ${graphX(sample.t).toFixed(2)} ${graphY(sample.value as number).toFixed(2)}`)
    .join(' ');

  const pointX = CENTER_X + RADIUS * point.x;
  const pointY = CENTER_Y - RADIUS * point.y;
  const currentGraphX = graphX(t);
  const currentGraphY = graphY(value);
  const twins = [t - 2 * Math.PI, t + 2 * Math.PI].filter((twin) => twin >= T_MIN - 1e-9 && twin <= T_MAX + 1e-9);

  // Для синуса ордината переносится по горизонтали, для косинуса абсциссу
  // сначала поднимают на нужную высоту — ломаная, но честная по длинам.
  const connector: readonly { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }[] =
    activeKind === 'sin'
      ? [{ x1: pointX, y1: pointY, x2: currentGraphX, y2: currentGraphY }]
      : [
        { x1: pointX, y1: CENTER_Y, x2: pointX, y2: currentGraphY },
        { x1: pointX, y1: currentGraphY, x2: currentGraphX, y2: currentGraphY },
      ];

  const description = `Слева единичная окружность с точкой поворота на угол ${degrees} градусов, справа график функции ${KIND_LABELS[activeKind]} на промежутке от минус двух пи до двух пи. ${activeKind === 'sin' ? 'Ордината точки окружности' : 'Абсцисса точки окружности'} равна ${formatDecimalPlain(value, 4)} и совпадает с высотой графика в точке x = ${formatDecimalPlain(t, 4)}. Отметки на расстоянии два пи показывают, что значения повторяются.`;

  const reset = () => {
    setActiveKind(defaultKind);
    setDegrees(defaultDegrees);
    setShowTwins(true);
    setAnswer('');
    setChecked(false);
  };

  const change = (next: number) => {
    setDegrees(next);
    setChecked(false);
    setAnswer('');
  };

  const readout = (() => {
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: `Чему равно ${activeKind === 'sin' ? 'sin' : 'cos'} ${degrees}°?`,
        detail: 'Найди точку поворота на окружности и сними нужную координату. Ответ вводи с точностью до сотых.',
      };
    }
    return {
      symbol: challenge ? (answerCorrect ? '✓' : '×') : '∿',
      headline: `${activeKind === 'sin' ? 'sin' : 'cos'} ${degrees}°${radianFraction === null ? '' : ` = ${activeKind === 'sin' ? 'sin' : 'cos'} ${formatPiFractionPlain(radianFraction)}`} = ${describeExact(exact, value)}`,
      detail: `Такое же значение функция принимает в точках ${formatDecimalPlain(degrees - 360)}° и ${formatDecimalPlain(degrees + 360)}°: сдвиг на полный оборот возвращает точку окружности на место. Поэтому период равен 2π.`,
    };
  })();

  return (
    <section className="dm-lab dm-geometry-grid-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория тригонометрических функций</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>От окружности к синусоиде</h3>
          <p>График не нарисован от руки: каждая его точка получена из координат точки поворота.</p>
        </div>
        <span className="dm-lab__badge">{challenge ? 'задача' : 'исследование'}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Какую функцию разворачиваем">
          {KINDS.map((item) => (
            <button
              type="button"
              className={activeKind === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
              aria-pressed={activeKind === item}
              onClick={() => { setActiveKind(item); setChecked(false); setAnswer(''); }}
              key={item}
            >
              {KIND_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-geometry-controls">
          <AngleField id={`${labId}-angle`} label="Аргумент" value={degrees} onChange={change} />
          <div className="dm-field dm-geometry-field">
            <label htmlFor={`${labId}-twins`}>Отметки через период<span className="dm-field__value">{showTwins ? 'видны' : 'скрыты'}</span></label>
            <button
              className="dm-button dm-button--secondary"
              type="button"
              id={`${labId}-twins`}
              aria-pressed={showTwins}
              onClick={() => setShowTwins((current) => !current)}
            >
              {showTwins ? 'Скрыть точки x ± 2π' : 'Показать точки x ± 2π'}
            </button>
            <small>Точки, отличающиеся на полный оборот, обязаны лежать на одной высоте.</small>
          </div>
        </div>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж окружности и графика" tabIndex={0}>
          <svg
            className="dm-geometry-grid"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-labelledby={`${labId}-title ${labId}-desc`}
          >
            <title id={`${labId}-title`}>Единичная окружность и график тригонометрической функции</title>
            <desc id={`${labId}-desc`}>{description}</desc>

            <g className="dm-geometry-grid__mesh" aria-hidden="true">
              {GRID_STEPS.map((step) => (
                <line
                  key={`vertical-${step}`}
                  x1={graphX((step * Math.PI) / 2)}
                  y1={CENTER_Y - RADIUS - 24}
                  x2={graphX((step * Math.PI) / 2)}
                  y2={CENTER_Y + RADIUS + 24}
                />
              ))}
              {[-1, -0.5, 0.5, 1].map((level) => (
                <line key={`level-${level}`} x1={GRAPH_LEFT - 12} y1={graphY(level)} x2={GRAPH_RIGHT} y2={graphY(level)} />
              ))}
            </g>

            <g aria-hidden="true">
              <line className="dm-signed-plane__axis" x1={CENTER_X - RADIUS - 26} y1={CENTER_Y} x2={CENTER_X + RADIUS + 26} y2={CENTER_Y} />
              <line className="dm-signed-plane__axis" x1={CENTER_X} y1={CENTER_Y + RADIUS + 26} x2={CENTER_X} y2={CENTER_Y - RADIUS - 26} />
              <circle className="dm-geometry-circle__boundary" cx={CENTER_X} cy={CENTER_Y} r={RADIUS} />
              <line className="dm-signed-plane__axis" x1={GRAPH_LEFT - 16} y1={CENTER_Y} x2={GRAPH_RIGHT + 12} y2={CENTER_Y} />
              <line className="dm-signed-plane__axis" x1={graphX(0)} y1={CENTER_Y + RADIUS + 26} x2={graphX(0)} y2={CENTER_Y - RADIUS - 26} />
            </g>

            <g className="dm-signed-plane__labels" aria-hidden="true">
              {GRID_STEPS.filter((step) => step !== 0).map((step) => (
                <text key={`label-${step}`} x={graphX((step * Math.PI) / 2)} y={CENTER_Y + 20}>{gridLabel(step)}</text>
              ))}
              <text x={graphX(0) - 12} y={CENTER_Y + 20}>0</text>
              <text x={GRAPH_LEFT - 26} y={graphY(1) + 4}>1</text>
              <text x={GRAPH_LEFT - 28} y={graphY(-1) + 4}>−1</text>
              <text x={GRAPH_RIGHT + 2} y={CENTER_Y - 16}>x</text>
              <text x={graphX(0) + 16} y={CENTER_Y - RADIUS - 30}>y</text>
              <text x={CENTER_X} y={CENTER_Y + RADIUS + 46}>единичная окружность</text>
            </g>

            <path className="dm-geometry-grid__route" d={curvePath} aria-hidden="true" />

            {reveal && (
              <g aria-hidden="true">
                <g className="dm-geometry-figure__construction">
                  {connector.map((segment, index) => (
                    <line key={`connector-${index}`} x1={segment.x1} y1={segment.y1} x2={segment.x2} y2={segment.y2} />
                  ))}
                </g>
                <line className="dm-geometry-circle__radius" x1={CENTER_X} y1={CENTER_Y} x2={pointX} y2={pointY} />
                {activeKind === 'sin'
                  ? <line className="dm-geometry-angle__ray dm-geometry-angle__ray--moving" x1={pointX} y1={CENTER_Y} x2={pointX} y2={pointY} />
                  : <line className="dm-geometry-angle__ray dm-geometry-angle__ray--moving" x1={CENTER_X} y1={CENTER_Y} x2={pointX} y2={CENTER_Y} />}
                <circle className="dm-geometry-circle__center" cx={CENTER_X} cy={CENTER_Y} r="6" />
                <circle className="dm-geometry-static__point" cx={pointX} cy={pointY} r="9" />
                <circle className="dm-geometry-static__point" cx={currentGraphX} cy={currentGraphY} r="9" />
                {showTwins && twins.map((twin) => (
                  <circle
                    className="dm-geometry-static__image-point"
                    key={`twin-${twin.toFixed(4)}`}
                    cx={graphX(twin)}
                    cy={currentGraphY}
                    r="8"
                  />
                ))}
                <g className="dm-geometry-circle__label">
                  <text x={currentGraphX} y={currentGraphY + (value >= 0 ? -22 : 32)}>
                    ({formatDecimalPlain(t, 2)}; {formatDecimalPlain(value, 3)})
                  </text>
                </g>
              </g>
            )}
          </svg>
        </div>

        {challenge && (
          <div className="dm-geometry-answer-grid">
            <div className="dm-geometry-answer-field">
              <label htmlFor={`${labId}-answer`}>Значение функции (до сотых)</label>
              <input
                id={`${labId}-answer`}
                type="text"
                inputMode="decimal"
                value={answer}
                onChange={(event) => {
                  const raw = event.target.value.slice(0, 6);
                  if (/^[-−]?\d*(?:[.,]\d*)?$/.test(raw)) { setAnswer(raw); setChecked(false); }
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

        <p className="dm-signed-caption">
          Ломаная графика построена по {SAMPLE_COUNT} вычисленным точкам, а не нарисована по памяти. Высота графика над
          осью в каждой точке равна {activeKind === 'sin' ? 'ординате' : 'абсциссе'} соответствующей точки окружности.
        </p>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
