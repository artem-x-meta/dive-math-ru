import { useEffect, useId, useRef, useState } from 'react';
import {
  addVectors,
  areCollinear,
  formatNumber,
  formatVector,
  scaleVector,
  squaredLength,
  subtractVectors,
  vec,
  vectorLength,
  type Point2,
  type Vec2,
} from '../lib/vectors';

export type VecLabMode = 'sum' | 'difference' | 'scale';

export interface VecLabProps {
  mode?: VecLabMode;
  initialAx?: number;
  initialAy?: number;
  initialBx?: number;
  initialBy?: number;
  initialFactor?: number;
  challenge?: boolean;
}

const MODES: readonly VecLabMode[] = ['sum', 'difference', 'scale'];
const MODE_LABELS: Readonly<Record<VecLabMode, string>> = {
  sum: 'Сложение',
  difference: 'Вычитание',
  scale: 'Умножение на число',
};

const MIN_COORDINATE = -8;
const MAX_COORDINATE = 8;
const MIN_FACTOR = -3;
const MAX_FACTOR = 3;
const FACTOR_STEP = 0.5;

const WIDTH = 720;
const HEIGHT = 570;
const CENTER_X = 360;
const CENTER_Y = 285;
const RADIUS = 248;
const HEAD_LENGTH = 15;
const HEAD_HALF_WIDTH = 7;

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function safeCoordinate(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(Math.round(value), MIN_COORDINATE, MAX_COORDINATE)
    : fallback;
}

function safeFactor(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value / FACTOR_STEP) * FACTOR_STEP, MIN_FACTOR, MAX_FACTOR);
}

/** Длина: целую печатаем точно, иррациональную — со знаком приближения. */
function formatLength(value: number): string {
  return Number.isInteger(value) ? formatNumber(value) : `≈ ${formatNumber(value, 2)}`;
}

function factorText(value: number): string {
  return formatNumber(value, 1);
}

interface NumberFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}

function NumberField({ id, label, value, minimum, maximum, step, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(formatNumber(value, 1));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(formatNumber(value, 1));
  }, [editing, value]);

  const quantize = (raw: number): number => clamp(Math.round(raw / step) * step, minimum, maximum);

  const parse = (raw: string): number | null => {
    const normalized = raw.trim().replace('−', '-').replace(',', '.');
    if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>{label}<span className="dm-field__value">{formatNumber(value, 1)}</span></label>
      <div className="dm-geometry-field__control">
        <button
          type="button"
          onClick={() => onChange(quantize(value - step))}
          disabled={value <= minimum}
          aria-label={`Уменьшить ${label.toLowerCase()} на ${formatNumber(step, 1)}`}
        >−</button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => { cancelCommit.current = false; setEditing(true); }}
          onChange={(event) => {
            const raw = event.target.value.slice(0, 6);
            if (!/^[-−]?\d*(?:[.,]\d*)?$/.test(raw)) return;
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
            setDraft(formatNumber(value, 1));
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelCommit.current = true;
              setDraft(formatNumber(value, 1));
              event.currentTarget.blur();
            }
            if (event.key === 'ArrowUp') { event.preventDefault(); onChange(quantize(value + step)); }
            if (event.key === 'ArrowDown') { event.preventDefault(); onChange(quantize(value - step)); }
          }}
        />
        <button
          type="button"
          onClick={() => onChange(quantize(value + step))}
          disabled={value >= maximum}
          aria-label={`Увеличить ${label.toLowerCase()} на ${formatNumber(step, 1)}`}
        >+</button>
      </div>
      <small id={`${id}-hint`}>От {formatNumber(minimum, 1)} до {formatNumber(maximum, 1)}, шаг {formatNumber(step, 1)}</small>
    </div>
  );
}

type ArrowTone = 'first' | 'second' | 'copy' | 'result';

interface ArrowModel {
  readonly from: Point2;
  readonly to: Point2;
  readonly label: string;
  readonly tone: ArrowTone;
}

const ARROW_GROUP_CLASS: Readonly<Record<ArrowTone, string>> = {
  first: 'dm-geometry-grid__line dm-geometry-grid__line--a',
  second: 'dm-geometry-grid__perpendicular',
  copy: 'dm-geometry-grid__line dm-geometry-grid__line--b',
  result: 'dm-geometry-angle__ray',
};

const LABEL_GROUP_CLASS: Readonly<Record<ArrowTone, string>> = {
  first: 'dm-geometry-grid__line dm-geometry-grid__line--a',
  second: 'dm-geometry-grid__line dm-geometry-grid__line--b',
  copy: 'dm-geometry-grid__line dm-geometry-grid__line--b',
  result: 'dm-geometry-grid__point',
};

interface VectorPlaneProps {
  readonly id: string;
  readonly extent: number;
  readonly arrows: readonly ArrowModel[];
  readonly guides: readonly (readonly [Point2, Point2])[];
  readonly dots: readonly { readonly point: Point2; readonly label: string }[];
  readonly description: string;
}

function VectorPlane({ id, extent, arrows, guides, dots, description }: VectorPlaneProps) {
  const scale = RADIUS / extent;
  const project = (point: Point2): ScreenPoint => ({
    x: CENTER_X + point.x * scale,
    y: CENTER_Y - point.y * scale,
  });
  const gridStep = extent <= 8 ? 1 : 2;
  const ticks = Array.from(
    { length: Math.floor(extent / gridStep) * 2 + 1 },
    (_, index) => -Math.floor(extent / gridStep) * gridStep + index * gridStep,
  );

  const arrowShape = (from: ScreenPoint, to: ScreenPoint) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) return null;
    const ux = dx / length;
    const uy = dy / length;
    const head = Math.min(HEAD_LENGTH, length * 0.4);
    const baseX = to.x - ux * head;
    const baseY = to.y - uy * head;
    const wing = Math.min(HEAD_HALF_WIDTH, head * 0.6);
    return {
      shaft: { x1: from.x, y1: from.y, x2: to.x, y2: to.y },
      left: { x1: baseX - uy * wing, y1: baseY + ux * wing, x2: to.x, y2: to.y },
      right: { x1: baseX + uy * wing, y1: baseY - ux * wing, x2: to.x, y2: to.y },
      label: { x: (from.x + to.x) / 2 - uy * 20, y: (from.y + to.y) / 2 + ux * 20 + 6 },
    };
  };

  return (
    <svg className="dm-geometry-grid" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Векторы на координатной сетке</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <rect className="dm-geometry-grid__background" x={CENTER_X - RADIUS} y={CENTER_Y - RADIUS} width={RADIUS * 2} height={RADIUS * 2} rx="12" />
      <g className="dm-geometry-grid__mesh" aria-hidden="true">
        {ticks.map((value) => (
          <g key={`mesh-${value}`}>
            <line x1={project({ x: value, y: 0 }).x} y1={CENTER_Y - RADIUS} x2={project({ x: value, y: 0 }).x} y2={CENTER_Y + RADIUS} />
            <line x1={CENTER_X - RADIUS} y1={project({ x: 0, y: value }).y} x2={CENTER_X + RADIUS} y2={project({ x: 0, y: value }).y} />
          </g>
        ))}
      </g>
      <line className="dm-signed-plane__axis" x1={CENTER_X - RADIUS} y1={CENTER_Y} x2={CENTER_X + RADIUS} y2={CENTER_Y} />
      <line className="dm-signed-plane__axis" x1={CENTER_X} y1={CENTER_Y + RADIUS} x2={CENTER_X} y2={CENTER_Y - RADIUS} />
      <g className="dm-signed-plane__labels" aria-hidden="true">
        {ticks.filter((value) => value !== 0).map((value) => (
          <g key={`tick-${value}`}>
            <text x={project({ x: value, y: 0 }).x} y={CENTER_Y + 18}>{formatNumber(value)}</text>
            <text x={CENTER_X - 14} y={project({ x: 0, y: value }).y + 4}>{formatNumber(value)}</text>
          </g>
        ))}
        <text x={CENTER_X + RADIUS - 6} y={CENTER_Y - 12}>x</text>
        <text x={CENTER_X + 14} y={CENTER_Y - RADIUS + 12}>y</text>
        <text x={CENTER_X - 14} y={CENTER_Y + 18}>0</text>
      </g>

      <g className="dm-signed-plane__reflection-guides" aria-hidden="true">
        {guides.map(([from, to], index) => {
          const start = project(from);
          const end = project(to);
          return <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} key={`guide-${index}`} />;
        })}
      </g>

      {arrows.map((arrow, index) => {
        const shape = arrowShape(project(arrow.from), project(arrow.to));
        if (!shape) return null;
        return (
          <g key={`arrow-${index}-${arrow.label}`} aria-hidden="true">
            <g className={ARROW_GROUP_CLASS[arrow.tone]}>
              <line {...shape.shaft} />
              <line {...shape.left} />
              <line {...shape.right} />
            </g>
            <g className={LABEL_GROUP_CLASS[arrow.tone]}>
              <text x={shape.label.x} y={shape.label.y} textAnchor="middle">{arrow.label}</text>
            </g>
          </g>
        );
      })}

      <g className="dm-geometry-grid__point" aria-hidden="true">
        {dots.map((dot, index) => {
          const screen = project(dot.point);
          const toLeft = dot.point.x > extent * 0.55;
          return (
            <g key={`dot-${index}-${dot.label}`}>
              <circle cx={screen.x} cy={screen.y} r="6" />
              <text x={screen.x + (toLeft ? -12 : 12)} y={screen.y - 12} textAnchor={toLeft ? 'end' : 'start'}>{dot.label}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default function VecLab({
  mode,
  initialAx,
  initialAy,
  initialBx,
  initialBy,
  initialFactor,
  challenge = false,
}: VecLabProps) {
  const reactId = useId();
  const labId = `vec-lab-${reactId.replace(/:/g, '')}`;
  const defaultMode: VecLabMode = mode !== undefined && MODES.includes(mode) ? mode : 'sum';
  const defaultAx = safeCoordinate(initialAx, 4);
  const defaultAy = safeCoordinate(initialAy, 1);
  const defaultBx = safeCoordinate(initialBx, -1);
  const defaultBy = safeCoordinate(initialBy, 3);
  const defaultFactor = safeFactor(initialFactor, 1.5);

  const [activeMode, setActiveMode] = useState(defaultMode);
  const [ax, setAx] = useState(defaultAx);
  const [ay, setAy] = useState(defaultAy);
  const [bx, setBx] = useState(defaultBx);
  const [by, setBy] = useState(defaultBy);
  const [factor, setFactor] = useState(defaultFactor);
  const [answerX, setAnswerX] = useState('');
  const [answerY, setAnswerY] = useState('');
  const [checked, setChecked] = useState(false);

  const a = vec(ax, ay);
  const b = vec(bx, by);
  const origin: Point2 = { x: 0, y: 0 };
  const sum = addVectors(a, b);
  const difference = subtractVectors(a, b);
  const scaled = scaleVector(factor, a);
  const result: Vec2 = activeMode === 'sum' ? sum : activeMode === 'difference' ? difference : scaled;
  const resultName = activeMode === 'sum' ? 'a + b' : activeMode === 'difference' ? 'a − b' : `${factorText(factor)}·a`;

  const reveal = !challenge || checked;

  const parseAnswer = (raw: string): number | null => {
    const normalized = raw.trim().replace('−', '-').replace(',', '.');
    if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const answerVector = (() => {
    const x = parseAnswer(answerX);
    const y = parseAnswer(answerY);
    return x === null || y === null ? null : { x, y };
  })();
  const answerCorrect = answerVector !== null
    && Math.abs(answerVector.x - result.x) < 1e-9
    && Math.abs(answerVector.y - result.y) < 1e-9;

  const shownPoints: Point2[] = [origin, a, b, sum, difference, scaled];
  const extent = Math.max(4, ...shownPoints.map((point) => Math.ceil(Math.max(Math.abs(point.x), Math.abs(point.y)))));

  const arrows: ArrowModel[] = [];
  const guides: (readonly [Point2, Point2])[] = [];
  const dots: { point: Point2; label: string }[] = [{ point: origin, label: 'O' }];

  if (activeMode === 'sum') {
    arrows.push({ from: origin, to: a, label: 'a', tone: 'first' });
    arrows.push({ from: origin, to: b, label: 'b', tone: 'second' });
    arrows.push({ from: a, to: sum, label: 'b', tone: 'copy' });
    guides.push([b, sum]);
    if (reveal) arrows.push({ from: origin, to: sum, label: 'a + b', tone: 'result' });
    dots.push({ point: a, label: `A${formatVector(a)}` }, { point: b, label: `B${formatVector(b)}` });
    if (reveal) dots.push({ point: sum, label: `S${formatVector(sum)}` });
  } else if (activeMode === 'difference') {
    arrows.push({ from: origin, to: a, label: 'a', tone: 'first' });
    arrows.push({ from: origin, to: b, label: 'b', tone: 'second' });
    if (reveal) {
      arrows.push({ from: b, to: a, label: 'a − b', tone: 'result' });
      guides.push([origin, difference], [difference, a]);
    }
    dots.push({ point: a, label: `A${formatVector(a)}` }, { point: b, label: `B${formatVector(b)}` });
    if (reveal) dots.push({ point: difference, label: `D${formatVector(difference)}` });
  } else {
    const far = Math.max(1, extent / Math.max(Math.abs(a.x), Math.abs(a.y), 1));
    guides.push([scaleVector(-far, a), scaleVector(far, a)]);
    arrows.push({ from: origin, to: a, label: 'a', tone: 'first' });
    if (reveal) arrows.push({ from: origin, to: scaled, label: `${factorText(factor)}·a`, tone: 'result' });
    dots.push({ point: a, label: `A${formatVector(a)}` });
    if (reveal) dots.push({ point: scaled, label: `K${formatVector(scaled)}` });
  }

  const description = activeMode === 'sum'
    ? `Векторы a ${formatVector(a)} и b ${formatVector(b)} отложены от начала координат. Копия вектора b отложена от конца вектора a, поэтому замыкающий вектор равен a + b = ${formatVector(sum)}. Пунктирные отрезки достраивают параллелограмм.`
    : activeMode === 'difference'
      ? `Векторы a ${formatVector(a)} и b ${formatVector(b)} отложены от начала координат. Вектор, идущий из конца вектора b в конец вектора a, равен a − b = ${formatVector(difference)}.`
      : `Вектор a ${formatVector(a)} умножен на число ${factorText(factor)}. Результат ${formatVector(scaled)} лежит на той же прямой, проходящей через начало координат.`;

  const switchMode = (next: VecLabMode) => {
    setActiveMode(next);
    setAnswerX('');
    setAnswerY('');
    setChecked(false);
  };

  const reset = () => {
    setActiveMode(defaultMode);
    setAx(defaultAx);
    setAy(defaultAy);
    setBx(defaultBx);
    setBy(defaultBy);
    setFactor(defaultFactor);
    setAnswerX('');
    setAnswerY('');
    setChecked(false);
  };

  const readout = (() => {
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: `Найди координаты вектора ${resultName} и введи их в поля ниже.`,
        detail: activeMode === 'scale'
          ? 'Обе координаты умножаются на одно и то же число.'
          : 'Складывать и вычитать координаты нужно по отдельности: отдельно x, отдельно y.',
      };
    }
    if (activeMode === 'scale') {
      return {
        symbol: challenge ? (answerCorrect ? '✓' : '×') : '·',
        headline: `${factorText(factor)}·${formatVector(a)} = ${formatVector(scaled)}`,
        detail: factor === 0
          ? 'Умножение на ноль даёт нулевой вектор: у него нет направления.'
          : `Длина умножилась на |${factorText(factor)}| = ${formatNumber(Math.abs(factor), 1)}: |a| ${formatLength(vectorLength(a))}, |${factorText(factor)}·a| ${formatLength(vectorLength(scaled))}. Направление ${factor > 0 ? 'сохранилось' : 'сменилось на противоположное'}, и оба вектора коллинеарны.`,
      };
    }
    const sign = activeMode === 'sum' ? '+' : '−';
    return {
      symbol: challenge ? (answerCorrect ? '✓' : '×') : sign,
      headline: `${formatVector(a)} ${sign} ${formatVector(b)} = ${formatVector(result)}`,
      detail: `|${resultName}| ${formatLength(vectorLength(result))}, при этом |a| ${formatLength(vectorLength(a))} и |b| ${formatLength(vectorLength(b))}. ${
        areCollinear(a, b)
          ? 'Здесь векторы коллинеарны, поэтому длины складываются или вычитаются напрямую.'
          : 'Длины не складываются: сумма длин больше длины суммы, если векторы не сонаправлены.'
      }`,
    };
  })();

  return (
    <section className="dm-lab dm-geometry-grid-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория векторов</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Действия с векторами на решётке</h3>
          <p>Все стрелки строятся по введённым координатам: рисунок нельзя «подогнать» под ответ.</p>
        </div>
        <span className="dm-lab__badge">{challenge ? 'задача' : 'исследование'}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Действие с векторами">
          {MODES.map((item) => (
            <button
              type="button"
              className={activeMode === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
              aria-pressed={activeMode === item}
              onClick={() => switchMode(item)}
              key={item}
            >
              {MODE_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-geometry-controls">
          <NumberField id={`${labId}-ax`} label="a: координата x" value={ax} minimum={MIN_COORDINATE} maximum={MAX_COORDINATE} step={1} onChange={(value) => { setAx(value); setChecked(false); }} />
          <NumberField id={`${labId}-ay`} label="a: координата y" value={ay} minimum={MIN_COORDINATE} maximum={MAX_COORDINATE} step={1} onChange={(value) => { setAy(value); setChecked(false); }} />
          {activeMode === 'scale' ? (
            <NumberField id={`${labId}-k`} label="Множитель k" value={factor} minimum={MIN_FACTOR} maximum={MAX_FACTOR} step={FACTOR_STEP} onChange={(value) => { setFactor(value); setChecked(false); }} />
          ) : (
            <>
              <NumberField id={`${labId}-bx`} label="b: координата x" value={bx} minimum={MIN_COORDINATE} maximum={MAX_COORDINATE} step={1} onChange={(value) => { setBx(value); setChecked(false); }} />
              <NumberField id={`${labId}-by`} label="b: координата y" value={by} minimum={MIN_COORDINATE} maximum={MAX_COORDINATE} step={1} onChange={(value) => { setBy(value); setChecked(false); }} />
            </>
          )}
        </div>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж с векторами" tabIndex={0}>
          <VectorPlane id={`${labId}-plane`} extent={extent} arrows={arrows} guides={guides} dots={dots} description={description} />
        </div>

        {challenge && (
          <div className="dm-geometry-answer-grid">
            <div className="dm-geometry-answer-field">
              <label htmlFor={`${labId}-answer-x`}>Координата x вектора {resultName}</label>
              <input
                id={`${labId}-answer-x`}
                type="text"
                inputMode="decimal"
                value={answerX}
                onChange={(event) => {
                  const raw = event.target.value.slice(0, 6);
                  if (/^[-−]?\d*(?:[.,]\d*)?$/.test(raw)) { setAnswerX(raw); setChecked(false); }
                }}
                onKeyDown={(event) => { if (event.key === 'Enter' && answerVector !== null) { event.preventDefault(); setChecked(true); } }}
              />
            </div>
            <div className="dm-geometry-answer-field">
              <label htmlFor={`${labId}-answer-y`}>Координата y вектора {resultName}</label>
              <input
                id={`${labId}-answer-y`}
                type="text"
                inputMode="decimal"
                value={answerY}
                onChange={(event) => {
                  const raw = event.target.value.slice(0, 6);
                  if (/^[-−]?\d*(?:[.,]\d*)?$/.test(raw)) { setAnswerY(raw); setChecked(false); }
                }}
                onKeyDown={(event) => { if (event.key === 'Enter' && answerVector !== null) { event.preventDefault(); setChecked(true); } }}
              />
            </div>
            <button className="dm-button" type="button" disabled={answerVector === null} onClick={() => setChecked(true)}>Проверить</button>
          </div>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{readout.symbol}</span>
          <p><strong>{readout.headline}</strong><small>{readout.detail}</small></p>
        </div>

        <p className="dm-signed-caption">
          Квадрат длины считается точно: |a|² = {formatNumber(squaredLength(a))}
          {activeMode === 'scale' ? '' : `, |b|² = ${formatNumber(squaredLength(b))}`}
          {reveal ? `, |${resultName}|² = ${formatNumber(squaredLength(result))}` : ''}.
        </p>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
