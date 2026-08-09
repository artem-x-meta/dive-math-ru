import { useEffect, useId, useRef, useState } from 'react';
import {
  angleBetweenDegrees,
  angleKind,
  cosineBetween,
  dotProduct,
  formatNumber,
  formatVector,
  isZeroVector,
  projectionLength,
  scaleVector,
  squaredLength,
  vec,
  vectorLength,
  type AngleKind,
  type Point2,
} from '../lib/vectors';

export type VecDotLabMode = 'sign' | 'angle' | 'projection';

export interface VecDotLabProps {
  mode?: VecDotLabMode;
  initialAx?: number;
  initialAy?: number;
  initialBx?: number;
  initialBy?: number;
  challenge?: boolean;
}

const MODES: readonly VecDotLabMode[] = ['sign', 'angle', 'projection'];
const MODE_LABELS: Readonly<Record<VecDotLabMode, string>> = {
  sign: 'Знак произведения',
  angle: 'Косинус и угол',
  projection: 'Проекция',
};

const KIND_TEXT: Readonly<Record<AngleKind, string>> = {
  zero: 'нулевой (векторы сонаправлены)',
  acute: 'острый',
  right: 'прямой',
  obtuse: 'тупой',
  straight: 'развёрнутый (векторы противоположно направлены)',
};

const MIN_COORDINATE = -8;
const MAX_COORDINATE = 8;

const WIDTH = 720;
const HEIGHT = 570;
const CENTER_X = 360;
const CENTER_Y = 285;
const RADIUS = 248;
const ARC_RADIUS = 62;

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

function formatLength(value: number): string {
  return Number.isInteger(value) ? formatNumber(value) : `≈ ${formatNumber(value, 2)}`;
}

/** Отрицательный множитель в записи произведения берём в скобки. */
function factorText(value: number): string {
  return value < 0 ? `(${formatNumber(value)})` : formatNumber(value);
}

interface NumberFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

function NumberField({ id, label, value, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  const parse = (raw: string): number | null => {
    const normalized = raw.trim().replace('−', '-');
    if (!/^-?\d+$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? clamp(parsed, MIN_COORDINATE, MAX_COORDINATE) : null;
  };

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>{label}<span className="dm-field__value">{formatNumber(value)}</span></label>
      <div className="dm-geometry-field__control">
        <button type="button" onClick={() => onChange(clamp(value - 1, MIN_COORDINATE, MAX_COORDINATE))} disabled={value <= MIN_COORDINATE} aria-label={`Уменьшить ${label.toLowerCase()} на 1`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => { cancelCommit.current = false; setEditing(true); }}
          onChange={(event) => {
            const raw = event.target.value.slice(0, 3);
            if (!/^[-−]?\d*$/.test(raw)) return;
            setDraft(raw);
            const parsed = parse(raw);
            if (parsed !== null) onChange(parsed);
          }}
          onBlur={() => {
            if (!cancelCommit.current) {
              const parsed = parse(draft);
              if (parsed !== null) onChange(parsed);
            }
            cancelCommit.current = false;
            setDraft(String(value));
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
            if (event.key === 'Escape') { event.preventDefault(); cancelCommit.current = true; setDraft(String(value)); event.currentTarget.blur(); }
            if (event.key === 'ArrowUp') { event.preventDefault(); onChange(clamp(value + 1, MIN_COORDINATE, MAX_COORDINATE)); }
            if (event.key === 'ArrowDown') { event.preventDefault(); onChange(clamp(value - 1, MIN_COORDINATE, MAX_COORDINATE)); }
          }}
        />
        <button type="button" onClick={() => onChange(clamp(value + 1, MIN_COORDINATE, MAX_COORDINATE))} disabled={value >= MAX_COORDINATE} aria-label={`Увеличить ${label.toLowerCase()} на 1`}>+</button>
      </div>
      <small id={`${id}-hint`}>Целое число от {MIN_COORDINATE} до {MAX_COORDINATE}</small>
    </div>
  );
}

interface DotPlaneProps {
  readonly id: string;
  readonly extent: number;
  readonly first: Point2;
  readonly second: Point2;
  readonly mode: VecDotLabMode;
  readonly showAngle: boolean;
  readonly foot: Point2 | null;
  readonly description: string;
  readonly angleLabel: string;
}

function DotPlane({ id, extent, first, second, mode, showAngle, foot, description, angleLabel }: DotPlaneProps) {
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
  const centre = project({ x: 0, y: 0 });

  const arrowLines = (from: ScreenPoint, to: ScreenPoint) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) return null;
    const ux = dx / length;
    const uy = dy / length;
    const head = Math.min(15, length * 0.4);
    const wing = Math.min(7, head * 0.6);
    const baseX = to.x - ux * head;
    const baseY = to.y - uy * head;
    return {
      shaft: { x1: from.x, y1: from.y, x2: to.x, y2: to.y },
      left: { x1: baseX - uy * wing, y1: baseY + ux * wing, x2: to.x, y2: to.y },
      right: { x1: baseX + uy * wing, y1: baseY - ux * wing, x2: to.x, y2: to.y },
      label: { x: (from.x + to.x) / 2 - uy * 20, y: (from.y + to.y) / 2 + ux * 20 + 6 },
    };
  };

  const screenFirst = project(first);
  const screenSecond = project(second);
  const arrowFirst = arrowLines(centre, screenFirst);
  const arrowSecond = arrowLines(centre, screenSecond);

  const unitTo = (target: ScreenPoint) => {
    const dx = target.x - centre.x;
    const dy = target.y - centre.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  };
  const unitFirst = unitTo(screenFirst);
  const unitSecond = unitTo(screenSecond);
  const cross = unitFirst.x * unitSecond.y - unitFirst.y * unitSecond.x;
  const arcStart = { x: centre.x + unitFirst.x * ARC_RADIUS, y: centre.y + unitFirst.y * ARC_RADIUS };
  const arcEnd = { x: centre.x + unitSecond.x * ARC_RADIUS, y: centre.y + unitSecond.y * ARC_RADIUS };
  const bisector = (() => {
    const x = unitFirst.x + unitSecond.x;
    const y = unitFirst.y + unitSecond.y;
    const length = Math.hypot(x, y);
    return length < 1e-6 ? { x: -unitFirst.y, y: unitFirst.x } : { x: x / length, y: y / length };
  })();
  const arcPath = `M ${arcStart.x} ${arcStart.y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 ${cross > 0 ? 1 : 0} ${arcEnd.x} ${arcEnd.y}`;

  return (
    <svg className="dm-geometry-grid" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Два вектора из начала координат и угол между ними</title>
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
      </g>

      {mode === 'projection' && foot && (
        <>
          <g className="dm-signed-plane__reflection-guides" aria-hidden="true">
            <line x1={screenSecond.x} y1={screenSecond.y} x2={project(foot).x} y2={project(foot).y} />
          </g>
          <g className="dm-geometry-angle__ray" aria-hidden="true">
            <line x1={centre.x} y1={centre.y} x2={project(foot).x} y2={project(foot).y} />
          </g>
        </>
      )}

      {showAngle && (
        <>
          <path className="dm-geometry-angle__arc" d={arcPath} aria-hidden="true" />
          <text
            className="dm-geometry-angle__value"
            x={centre.x + bisector.x * (ARC_RADIUS + 30)}
            y={centre.y + bisector.y * (ARC_RADIUS + 30) + 9}
            textAnchor="middle"
            aria-hidden="true"
          >{angleLabel}</text>
        </>
      )}

      {arrowFirst && (
        <g aria-hidden="true">
          <g className="dm-geometry-grid__line dm-geometry-grid__line--a">
            <line {...arrowFirst.shaft} />
            <line {...arrowFirst.left} />
            <line {...arrowFirst.right} />
            <text x={arrowFirst.label.x} y={arrowFirst.label.y} textAnchor="middle">a</text>
          </g>
        </g>
      )}
      {arrowSecond && (
        <g aria-hidden="true">
          <g className="dm-geometry-grid__perpendicular">
            <line {...arrowSecond.shaft} />
            <line {...arrowSecond.left} />
            <line {...arrowSecond.right} />
          </g>
          <g className="dm-geometry-grid__line dm-geometry-grid__line--b">
            <text x={arrowSecond.label.x} y={arrowSecond.label.y} textAnchor="middle">b</text>
          </g>
        </g>
      )}

      <g className="dm-geometry-grid__point" aria-hidden="true">
        <circle cx={centre.x} cy={centre.y} r="6" />
        <text x={centre.x - 12} y={centre.y + 24} textAnchor="end">O</text>
        <circle cx={screenFirst.x} cy={screenFirst.y} r="6" />
        <text x={screenFirst.x + 12} y={screenFirst.y - 12}>A{formatVector(first)}</text>
        <circle cx={screenSecond.x} cy={screenSecond.y} r="6" />
        <text x={screenSecond.x + 12} y={screenSecond.y - 12}>B{formatVector(second)}</text>
      </g>
    </svg>
  );
}

export default function VecDotLab({
  mode,
  initialAx,
  initialAy,
  initialBx,
  initialBy,
  challenge = false,
}: VecDotLabProps) {
  const reactId = useId();
  const labId = `vec-dot-${reactId.replace(/:/g, '')}`;
  const defaultMode: VecDotLabMode = mode !== undefined && MODES.includes(mode) ? mode : 'sign';
  const defaultAx = safeCoordinate(initialAx, 5);
  const defaultAy = safeCoordinate(initialAy, 1);
  const defaultBx = safeCoordinate(initialBx, 2);
  const defaultBy = safeCoordinate(initialBy, 4);

  const [activeMode, setActiveMode] = useState(defaultMode);
  const [ax, setAx] = useState(defaultAx);
  const [ay, setAy] = useState(defaultAy);
  const [bx, setBx] = useState(defaultBx);
  const [by, setBy] = useState(defaultBy);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const a = vec(ax, ay);
  const b = vec(bx, by);
  const degenerate = isZeroVector(a) || isZeroVector(b);
  const dot = dotProduct(a, b);
  const kind = degenerate ? null : angleKind(a, b);
  const degrees = degenerate ? null : angleBetweenDegrees(a, b);
  const cosine = degenerate ? null : cosineBetween(a, b);
  const projection = degenerate ? null : projectionLength(b, a);
  const foot = degenerate ? null : scaleVector(dot / squaredLength(a), a);

  const reveal = !challenge || checked;
  const parseAnswer = (raw: string): number | null => {
    const normalized = raw.trim().replace('−', '-');
    if (!/^-?\d+$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const answerValue = parseAnswer(answer);
  const answerCorrect = answerValue !== null && answerValue === dot;

  const points: Point2[] = [{ x: 0, y: 0 }, a, b, ...(foot ? [foot] : [])];
  const extent = Math.max(4, ...points.map((point) => Math.ceil(Math.max(Math.abs(point.x), Math.abs(point.y)))));

  const dotExpression = `${factorText(ax)}·${factorText(bx)} + ${factorText(ay)}·${factorText(by)} = ${formatNumber(dot)}`;
  const angleLabel = degrees === null ? '' : kind === 'right' ? '90°' : `${formatNumber(degrees, 1)}°`;

  const description = degenerate
    ? `Один из векторов нулевой, поэтому угол между ними не определён. Координаты: a ${formatVector(a)}, b ${formatVector(b)}.`
    : `Векторы a ${formatVector(a)} и b ${formatVector(b)} отложены от начала координат. Скалярное произведение равно ${formatNumber(dot)}, угол между векторами ${formatNumber(degrees ?? 0, 1)} градусов, он ${KIND_TEXT[kind ?? 'right']}.${
      activeMode === 'projection' && projection !== null
        ? ` Из конца вектора b опущен перпендикуляр на прямую вектора a, проекция равна ${formatNumber(projection, 2)}.`
        : ''
    }`;

  const switchMode = (next: VecDotLabMode) => {
    setActiveMode(next);
    setAnswer('');
    setChecked(false);
  };

  const reset = () => {
    setActiveMode(defaultMode);
    setAx(defaultAx);
    setAy(defaultAy);
    setBx(defaultBx);
    setBy(defaultBy);
    setAnswer('');
    setChecked(false);
  };

  const readout = (() => {
    if (degenerate) {
      return {
        symbol: '!',
        headline: 'Нулевой вектор не задаёт направления, поэтому угол не определён.',
        detail: `Скалярное произведение при этом всё равно вычисляется по координатам и равно ${formatNumber(dot)}. Измени координаты так, чтобы оба вектора были ненулевыми.`,
      };
    }
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: `Найди скалярное произведение векторов a ${formatVector(a)} и b ${formatVector(b)}.`,
        detail: 'Перемножь одноимённые координаты и сложи результаты. Ответ — целое число.',
      };
    }
    if (activeMode === 'angle') {
      return {
        symbol: challenge ? (answerCorrect ? '✓' : '×') : '∠',
        headline: `cos α = ${formatNumber(dot)} : (${formatLength(vectorLength(a))} · ${formatLength(vectorLength(b))}) ${Number.isInteger((cosine ?? 0) * 1000) ? '=' : '≈'} ${formatNumber(cosine ?? 0, 3)}, поэтому α ${kind === 'right' ? '= 90°' : `≈ ${formatNumber(degrees ?? 0, 1)}°`}`,
        detail: 'Формула cos α = (a · b) : (|a| · |b|) даёт сам угол, а не только его вид. Знаменатель всегда положителен, поэтому знак косинуса совпадает со знаком скалярного произведения.',
      };
    }
    if (activeMode === 'projection') {
      return {
        symbol: challenge ? (answerCorrect ? '✓' : '×') : '⊥',
        headline: `Проекция b на направление a равна ${formatLength(projection ?? 0)}, и a · b = |a| · пр = ${formatLength(vectorLength(a))} · ${formatLength(projection ?? 0)} = ${formatNumber(dot)}`,
        detail: 'Проекция отрицательна ровно тогда, когда основание перпендикуляра лежит по другую сторону от начала координат — именно поэтому скалярное произведение меняет знак.',
      };
    }
    return {
      symbol: challenge ? (answerCorrect ? '✓' : '×') : dot > 0 ? '+' : dot < 0 ? '−' : '0',
      headline: `a · b = ${dotExpression}, угол ${KIND_TEXT[kind ?? 'right']}`,
      detail: 'Положительное произведение — угол меньше 90°, отрицательное — больше 90°, ноль — векторы перпендикулярны. Знак читается без вычисления самого угла.',
    };
  })();

  return (
    <section className="dm-lab dm-geometry-angle-shape not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория скалярного произведения</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Знак произведения и угол между векторами</h3>
          <p>Дуга угла и перпендикуляр строятся по вычисленным координатам, а не рисуются «на глаз».</p>
        </div>
        <span className="dm-lab__badge">{challenge ? 'задача' : 'исследование'}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Что исследуем">
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

        <div className="dm-lab__controls dm-geometry-controls dm-lab__controls--four">
          <NumberField id={`${labId}-ax`} label="a: координата x" value={ax} onChange={(value) => { setAx(value); setChecked(false); }} />
          <NumberField id={`${labId}-ay`} label="a: координата y" value={ay} onChange={(value) => { setAy(value); setChecked(false); }} />
          <NumberField id={`${labId}-bx`} label="b: координата x" value={bx} onChange={(value) => { setBx(value); setChecked(false); }} />
          <NumberField id={`${labId}-by`} label="b: координата y" value={by} onChange={(value) => { setBy(value); setChecked(false); }} />
        </div>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж с двумя векторами" tabIndex={0}>
          <DotPlane
            id={`${labId}-plane`}
            extent={extent}
            first={a}
            second={b}
            mode={activeMode}
            showAngle={!degenerate && reveal}
            foot={reveal ? foot : null}
            description={description}
            angleLabel={angleLabel}
          />
        </div>

        {challenge && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>Скалярное произведение a · b</label>
            <input
              id={`${labId}-answer`}
              type="text"
              inputMode="numeric"
              value={answer}
              onChange={(event) => {
                const raw = event.target.value.slice(0, 5);
                if (/^[-−]?\d*$/.test(raw)) { setAnswer(raw); setChecked(false); }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && answerValue !== null) { event.preventDefault(); setChecked(true); }
                if (event.key === 'Escape') { event.preventDefault(); setAnswer(''); setChecked(false); }
              }}
            />
            <button className="dm-button" type="button" disabled={answerValue === null} onClick={() => setChecked(true)}>Проверить</button>
          </div>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{readout.symbol}</span>
          <p><strong>{readout.headline}</strong><small>{readout.detail}</small></p>
        </div>

        {reveal && !degenerate && (
          <div className="dm-signed-reflection-cards">
            <div>
              <span>по координатам</span>
              <strong>a · b = {formatNumber(dot)}</strong>
              <small>{dotExpression}</small>
            </div>
            <div>
              <span>длины</span>
              <strong>|a| {formatLength(vectorLength(a))}, |b| {formatLength(vectorLength(b))}</strong>
              <small>|a|² = {formatNumber(squaredLength(a))}, |b|² = {formatNumber(squaredLength(b))} — точные значения</small>
            </div>
            <div>
              <span>угол</span>
              <strong>{kind === 'right' ? 'α = 90°' : `α ≈ ${formatNumber(degrees ?? 0, 1)}°`}</strong>
              <small>Угол {KIND_TEXT[kind ?? 'right']}</small>
            </div>
          </div>
        )}

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
