import { useEffect, useId, useRef, useState } from 'react';
import {
  areaFactor,
  fitPointsToBox,
  fourthProportional,
  projectPoint,
  thalesRatio,
  thalesSegment,
  triangleAreaByHeight,
  type ScreenPoint,
} from '../lib/similarity';
import type { PlanimetryPoint } from '../lib/planimetry';

export type SimTriangleMode = 'ratio' | 'thales';

export interface SimTriangleLabProps {
  mode?: SimTriangleMode;
  /** Сторона AB в условных единицах. */
  initialAb?: number;
  /** Сторона AC в условных единицах. */
  initialAc?: number;
  /** Угол между сторонами AB и AC, градусы. */
  initialAngle?: number;
  /** Коэффициент подобия, умноженный на 10 (15 означает k = 1,5). */
  initialFactorTenths?: number;
  /** Отрезок AM для режима Фалеса. */
  initialPart?: number;
  unit?: string;
  challenge?: boolean;
}

const MODES: readonly SimTriangleMode[] = ['ratio', 'thales'];
const MODE_LABELS: Readonly<Record<SimTriangleMode, string>> = {
  ratio: 'Коэффициент подобия',
  thales: 'Параллельная прямая',
};

const MIN_SIDE = 4;
const MAX_SIDE = 12;
const MIN_ANGLE = 25;
const MAX_ANGLE = 120;
const MIN_FACTOR_TENTHS = 5;
const MAX_FACTOR_TENTHS = 25;

const WIDTH = 720;
const HEIGHT = 420;
const PADDING = 72;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(Math.round(value), min, max) : fallback;
}

/** Округление до сотых с русской запятой: длины на чертеже читает человек. */
function formatNumber(value: number, digits = 2): string {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  const text = rounded.toFixed(digits).replace(/\.?0+$/, '');
  return (text === '' || text === '-' ? '0' : text).replace('.', ',');
}

function unitVector(from: ScreenPoint, to: ScreenPoint): ScreenPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function polyline(points: readonly ScreenPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

interface ArcDrawing {
  readonly path: string;
  readonly label: ScreenPoint;
}

/** Дуга угла при вершине; подпись ставится на биссектрисе. */
function angleArc(vertex: ScreenPoint, first: ScreenPoint, second: ScreenPoint, measure: number): ArcDrawing {
  const radius = measure < 35 ? 56 : measure < 70 ? 44 : 34;
  const left = unitVector(vertex, first);
  const right = unitVector(vertex, second);
  const start = { x: vertex.x + left.x * radius, y: vertex.y + left.y * radius };
  const end = { x: vertex.x + right.x * radius, y: vertex.y + right.y * radius };
  const cross = left.x * right.y - left.y * right.x;
  const bisector = unitVector({ x: 0, y: 0 }, { x: left.x + right.x, y: left.y + right.y });
  const distance = radius + 24;
  return {
    path: `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${cross > 0 ? 1 : 0} ${end.x} ${end.y}`,
    label: { x: vertex.x + bisector.x * distance, y: vertex.y + bisector.y * distance + 6 },
  };
}

/** Подпись стороны выносится наружу — в сторону, противоположную третьей вершине. */
function sideLabel(first: ScreenPoint, second: ScreenPoint, opposite: ScreenPoint, distance = 24): ScreenPoint {
  const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  const outward = unitVector(opposite, middle);
  return { x: middle.x + outward.x * distance, y: middle.y + outward.y * distance + 5 };
}

interface NumberFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly suffix: string;
  readonly hint: string;
  readonly display?: string;
  readonly onChange: (value: number) => void;
}

function NumberField({ id, label, value, min, max, step, suffix, hint, display, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>{label}<span className="dm-field__value">{display ?? value}{suffix}</span></label>
      <div className="dm-geometry-field__control">
        <button type="button" onClick={() => onChange(value - step)} disabled={value <= min} aria-label={`Уменьшить на ${step}`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => { cancelCommit.current = false; setEditing(true); }}
          onChange={(event) => {
            const raw = event.target.value.slice(0, 4);
            if (/^\d*$/.test(raw)) {
              setDraft(raw);
              if (/^\d+$/.test(raw)) {
                const parsed = Number(raw);
                if (parsed >= min && parsed <= max) onChange(parsed);
              }
            }
          }}
          onBlur={() => {
            if (cancelCommit.current) cancelCommit.current = false;
            else if (/^\d+$/.test(draft.trim())) onChange(Number(draft.trim()));
            setDraft(String(value));
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
            if (event.key === 'Escape') { event.preventDefault(); cancelCommit.current = true; setDraft(String(value)); event.currentTarget.blur(); }
          }}
        />
        <button type="button" onClick={() => onChange(value + step)} disabled={value >= max} aria-label={`Увеличить на ${step}`}>+</button>
      </div>
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

interface TriangleGeometry {
  readonly a: PlanimetryPoint;
  readonly b: PlanimetryPoint;
  readonly c: PlanimetryPoint;
  readonly ab: number;
  readonly ac: number;
  readonly bc: number;
  readonly height: number;
}

/** Треугольник по двум сторонам и углу между ними: вершина A в начале координат. */
function buildTriangle(ab: number, ac: number, angleDegrees: number): TriangleGeometry {
  const radians = (angleDegrees * Math.PI) / 180;
  const a: PlanimetryPoint = { x: 0, y: 0 };
  const b: PlanimetryPoint = { x: ab, y: 0 };
  const c: PlanimetryPoint = { x: ac * Math.cos(radians), y: ac * Math.sin(radians) };
  return { a, b, c, ab, ac, bc: Math.hypot(b.x - c.x, b.y - c.y), height: c.y };
}

function shiftPoint(point: PlanimetryPoint, dx: number, dy: number): PlanimetryPoint {
  return { x: point.x + dx, y: point.y + dy };
}

interface RatioPictureProps {
  readonly id: string;
  readonly triangle: TriangleGeometry;
  readonly factor: number;
  readonly angle: number;
  readonly unit: string;
}

function RatioPicture({ id, triangle, factor, angle, unit }: RatioPictureProps) {
  const scaled = buildTriangle(triangle.ab * factor, triangle.ac * factor, angle);
  const originalPoints = [triangle.a, triangle.b, triangle.c];
  const scaledRaw = [scaled.a, scaled.b, scaled.c];
  const gap = Math.max(triangle.ab, scaled.ab) * 0.22;
  const dx = Math.max(...originalPoints.map((point) => point.x)) + gap - Math.min(...scaledRaw.map((point) => point.x));
  const copyPoints = scaledRaw.map((point) => shiftPoint(point, dx, 0));
  const fit = fitPointsToBox([...originalPoints, ...copyPoints], WIDTH, HEIGHT, PADDING);
  const [a, b, c] = originalPoints.map((point) => projectPoint(point, fit)) as [ScreenPoint, ScreenPoint, ScreenPoint];
  const [a1, b1, c1] = copyPoints.map((point) => projectPoint(point, fit)) as [ScreenPoint, ScreenPoint, ScreenPoint];
  const arcA = angleArc(a, b, c, angle);
  const arcA1 = angleArc(a1, b1, c1, angle);

  return (
    <svg className="dm-geometry-polygon" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Два подобных треугольника с коэффициентом k</title>
      <desc id={`${id}-desc`}>
        Треугольник ABC со сторонами {formatNumber(triangle.ab)} и {formatNumber(triangle.ac)} {unit} и углом {angle} градусов между ними.
        Треугольник A₁B₁C₁ получен умножением каждой стороны на {formatNumber(factor)}: его стороны равны {formatNumber(scaled.ab)} и {formatNumber(scaled.ac)} {unit},
        а угол между ними тот же — {angle} градусов. Обе фигуры нарисованы в одном масштабе.
      </desc>
      <polygon className="dm-geometry-polygon__shape" points={polyline([a, b, c])} />
      <polygon className="dm-geometry-figure__completion" points={polyline([a1, b1, c1])} />
      <path className="dm-geometry-angle__arc" d={arcA.path} />
      <path className="dm-geometry-angle__arc" d={arcA1.path} />
      <g className="dm-geometry-figure__dimensions" aria-hidden="true">
        <text {...sideLabel(a, b, c)}>{formatNumber(triangle.ab)}</text>
        <text {...sideLabel(a, c, b)}>{formatNumber(triangle.ac)}</text>
        <text {...sideLabel(b, c, a)}>{formatNumber(triangle.bc)}</text>
        <text {...sideLabel(a1, b1, c1)}>{formatNumber(scaled.ab)}</text>
        <text {...sideLabel(a1, c1, b1)}>{formatNumber(scaled.ac)}</text>
        <text {...sideLabel(b1, c1, a1)}>{formatNumber(scaled.bc)}</text>
      </g>
      <g aria-hidden="true">
        <text className="dm-geometry-angle__value" x={arcA.label.x} y={arcA.label.y} textAnchor="middle">{angle}°</text>
        <text className="dm-geometry-angle__value" x={arcA1.label.x} y={arcA1.label.y} textAnchor="middle">{angle}°</text>
      </g>
      <g className="dm-geometry-polygon__vertex" aria-hidden="true">
        <circle cx={a.x} cy={a.y} r="7" /><text x={a.x - 24} y={a.y + 22}>A</text>
        <circle cx={b.x} cy={b.y} r="7" /><text x={b.x + 10} y={b.y + 22}>B</text>
        <circle cx={c.x} cy={c.y} r="7" /><text x={c.x - 8} y={c.y - 14}>C</text>
        <circle cx={a1.x} cy={a1.y} r="7" /><text x={a1.x - 30} y={a1.y + 22}>A₁</text>
        <circle cx={b1.x} cy={b1.y} r="7" /><text x={b1.x + 10} y={b1.y + 22}>B₁</text>
        <circle cx={c1.x} cy={c1.y} r="7" /><text x={c1.x - 10} y={c1.y - 14}>C₁</text>
      </g>
    </svg>
  );
}

interface ThalesPictureProps {
  readonly id: string;
  readonly triangle: TriangleGeometry;
  readonly part: number;
  readonly an: number;
  readonly nc: number;
  readonly mn: number;
  readonly reveal: boolean;
  readonly unit: string;
}

function ThalesPicture({ id, triangle, part, an, nc, mn, reveal, unit }: ThalesPictureProps) {
  const ratio = part / triangle.ab;
  const m: PlanimetryPoint = { x: triangle.b.x * ratio, y: triangle.b.y * ratio };
  const n: PlanimetryPoint = { x: triangle.c.x * ratio, y: triangle.c.y * ratio };
  const fit = fitPointsToBox([triangle.a, triangle.b, triangle.c], WIDTH, HEIGHT, PADDING);
  const a = projectPoint(triangle.a, fit);
  const b = projectPoint(triangle.b, fit);
  const c = projectPoint(triangle.c, fit);
  const mScreen = projectPoint(m, fit);
  const nScreen = projectPoint(n, fit);
  const mb = triangle.ab - part;

  return (
    <svg className="dm-geometry-polygon" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Треугольник, рассечённый прямой, параллельной стороне BC</title>
      <desc id={`${id}-desc`}>
        В треугольнике ABC сторона AB равна {formatNumber(triangle.ab)} {unit}, сторона AC равна {formatNumber(triangle.ac)} {unit}.
        Точка M делит AB на отрезки {formatNumber(part)} и {formatNumber(mb)} {unit}. Прямая MN параллельна BC,
        поэтому AN равно {formatNumber(an)} {unit}
        {reveal ? `, NC равно ${formatNumber(nc)} ${unit}, а сам отрезок MN равен ${formatNumber(mn)} ${unit}` : ', а длины NC и MN нужно найти'}.
      </desc>
      <polygon className="dm-geometry-polygon__shape" points={polyline([a, b, c])} />
      <polygon className="dm-geometry-figure__completion" points={polyline([a, mScreen, nScreen])} />
      <g className="dm-geometry-figure__construction" aria-hidden="true">
        <line x1={mScreen.x} y1={mScreen.y} x2={nScreen.x} y2={nScreen.y} />
      </g>
      <g className="dm-geometry-figure__dimensions" aria-hidden="true">
        <text {...sideLabel(a, mScreen, c, 20)}>{formatNumber(part)}</text>
        <text {...sideLabel(mScreen, b, c, 20)}>{formatNumber(mb)}</text>
        <text {...sideLabel(a, nScreen, b, 20)}>{formatNumber(an)}</text>
        <text {...sideLabel(nScreen, c, b, 20)}>{reveal ? formatNumber(nc) : '?'}</text>
        <text {...sideLabel(mScreen, nScreen, a, 20)}>{reveal ? formatNumber(mn) : 'MN'}</text>
        <text {...sideLabel(b, c, a, 22)}>{formatNumber(triangle.bc)}</text>
      </g>
      <g className="dm-geometry-polygon__vertex" aria-hidden="true">
        <circle cx={a.x} cy={a.y} r="7" /><text x={a.x - 24} y={a.y + 22}>A</text>
        <circle cx={b.x} cy={b.y} r="7" /><text x={b.x + 10} y={b.y + 22}>B</text>
        <circle cx={c.x} cy={c.y} r="7" /><text x={c.x - 8} y={c.y - 14}>C</text>
        <circle cx={mScreen.x} cy={mScreen.y} r="6" /><text x={mScreen.x - 6} y={mScreen.y + 26}>M</text>
        <circle cx={nScreen.x} cy={nScreen.y} r="6" /><text x={nScreen.x + 10} y={nScreen.y + 6}>N</text>
      </g>
    </svg>
  );
}

function parseAnswer(raw: string): number | null {
  const source = raw.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(source)) return null;
  const value = Number(source);
  return Number.isFinite(value) ? value : null;
}

export default function SimTriangleLab({
  mode,
  initialAb,
  initialAc,
  initialAngle,
  initialFactorTenths,
  initialPart,
  unit = 'см',
  challenge = false,
}: SimTriangleLabProps) {
  const reactId = useId();
  const labId = `sim-triangle-${reactId.replace(/:/g, '')}`;
  const defaultMode: SimTriangleMode = mode !== undefined && MODES.includes(mode) ? mode : 'ratio';
  const defaultAb = safeInteger(initialAb, 10, MIN_SIDE, MAX_SIDE);
  const defaultAc = safeInteger(initialAc, 8, MIN_SIDE, MAX_SIDE);
  const defaultAngle = safeInteger(initialAngle, 55, MIN_ANGLE, MAX_ANGLE);
  const defaultFactor = safeInteger(initialFactorTenths, 15, MIN_FACTOR_TENTHS, MAX_FACTOR_TENTHS);
  const defaultPart = safeInteger(initialPart, Math.max(1, Math.round(defaultAb * 0.4)), 1, defaultAb - 1);

  const [activeMode, setActiveMode] = useState(defaultMode);
  const [ab, setAb] = useState(defaultAb);
  const [ac, setAc] = useState(defaultAc);
  const [angle, setAngle] = useState(defaultAngle);
  const [factorTenths, setFactorTenths] = useState(defaultFactor);
  const [part, setPart] = useState(defaultPart);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const factor = factorTenths / 10;
  const triangle = buildTriangle(ab, ac, angle);
  const safePart = clamp(part, 1, ab - 1);
  const mb = ab - safePart;
  const an = fourthProportional(ab, ac, safePart);
  const nc = thalesSegment(safePart, mb, an);
  const ratio = thalesRatio(safePart, mb);
  const mn = triangle.bc * ratio;

  const area = triangleAreaByHeight(ab, triangle.height);
  const scaledArea = area * areaFactor(factor);
  const perimeter = ab + ac + triangle.bc;

  const activeChallenge = challenge && activeMode === 'thales';
  const reveal = !activeChallenge || checked;
  const answerValue = parseAnswer(answer);
  const answerCorrect = answerValue !== null && Math.abs(answerValue - nc) < 0.005;

  const changeAb = (value: number) => {
    const next = clamp(value, MIN_SIDE, MAX_SIDE);
    setAb(next);
    setPart((current) => clamp(current, 1, next - 1));
    setChecked(false);
  };
  const reset = () => {
    setActiveMode(defaultMode);
    setAb(defaultAb);
    setAc(defaultAc);
    setAngle(defaultAngle);
    setFactorTenths(defaultFactor);
    setPart(defaultPart);
    setAnswer('');
    setChecked(false);
  };

  const result = (() => {
    if (activeMode === 'ratio') {
      return {
        symbol: '∼',
        headline: `k = ${formatNumber(factor)}: каждая сторона длиннее в ${formatNumber(factor)} раза, площадь — в ${formatNumber(areaFactor(factor))} раза.`,
        detail: `Периметры: ${formatNumber(perimeter)} и ${formatNumber(perimeter * factor)} ${unit}. Площади: ${formatNumber(area)} и ${formatNumber(scaledArea)} ${unit}². Углы не изменились: подобие меняет размер, но не форму.`,
      };
    }
    if (activeChallenge && !checked) {
      return {
        symbol: '?',
        headline: `AM = ${formatNumber(safePart)}, MB = ${formatNumber(mb)}, AN = ${formatNumber(an)} ${unit}. Найди NC.`,
        detail: 'Прямая MN параллельна BC, поэтому AM : MB = AN : NC. Ответ можно записать десятичной дробью.',
      };
    }
    if (activeChallenge) {
      return {
        symbol: answerCorrect ? '✓' : '×',
        headline: answerCorrect ? 'Верно.' : `Пока нет: NC = ${formatNumber(nc)} ${unit}.`,
        detail: `AM : MB = ${formatNumber(safePart)} : ${formatNumber(mb)}, значит NC = AN · MB : AM = ${formatNumber(an)} · ${formatNumber(mb)} : ${formatNumber(safePart)} = ${formatNumber(nc)} ${unit}.`,
      };
    }
    return {
      symbol: '∥',
      headline: `AM : AB = ${formatNumber(safePart)} : ${formatNumber(ab)} = ${formatNumber(ratio)}, и ровно такое же отношение у AN : AC и MN : BC.`,
      detail: `AN = ${formatNumber(an)}, NC = ${formatNumber(nc)}, MN = ${formatNumber(mn)} ${unit}. Треугольник AMN подобен ABC с коэффициентом ${formatNumber(ratio)}.`,
    };
  })();

  return (
    <section className="dm-lab dm-geometry-angle-shape not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория подобия</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Одинаковая форма, разный размер</h3>
          <p>Обе картинки нарисованы в одном масштабе: если фигура на экране больше в полтора раза, значит коэффициент подобия действительно равен 1,5.</p>
        </div>
        <span className="dm-lab__badge">{activeChallenge ? 'задача' : 'исследование'}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Что исследуем">
          {MODES.map((item) => (
            <button
              type="button"
              className={activeMode === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
              aria-pressed={activeMode === item}
              onClick={() => { setActiveMode(item); setAnswer(''); setChecked(false); }}
              key={item}
            >
              {MODE_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-geometry-controls">
          <NumberField
            id={`${labId}-ab`}
            label="Сторона AB"
            value={ab}
            min={MIN_SIDE}
            max={MAX_SIDE}
            step={1}
            suffix={` ${unit}`}
            hint={`От ${MIN_SIDE} до ${MAX_SIDE} ${unit}`}
            onChange={changeAb}
          />
          <NumberField
            id={`${labId}-ac`}
            label="Сторона AC"
            value={ac}
            min={MIN_SIDE}
            max={MAX_SIDE}
            step={1}
            suffix={` ${unit}`}
            hint={`От ${MIN_SIDE} до ${MAX_SIDE} ${unit}`}
            onChange={(value) => { setAc(clamp(value, MIN_SIDE, MAX_SIDE)); setChecked(false); }}
          />
          <NumberField
            id={`${labId}-angle`}
            label="Угол A"
            value={angle}
            min={MIN_ANGLE}
            max={MAX_ANGLE}
            step={5}
            suffix="°"
            hint={`От ${MIN_ANGLE}° до ${MAX_ANGLE}°`}
            onChange={(value) => { setAngle(clamp(value, MIN_ANGLE, MAX_ANGLE)); setChecked(false); }}
          />
          {activeMode === 'ratio' ? (
            <NumberField
              id={`${labId}-factor`}
              label="Коэффициент k"
              value={factorTenths}
              min={MIN_FACTOR_TENTHS}
              max={MAX_FACTOR_TENTHS}
              step={1}
              suffix=""
              display={formatNumber(factor)}
              hint="Десятые доли: 5 означает k = 0,5, а 25 — k = 2,5"
              onChange={(value) => setFactorTenths(clamp(value, MIN_FACTOR_TENTHS, MAX_FACTOR_TENTHS))}
            />
          ) : (
            <NumberField
              id={`${labId}-part`}
              label="Отрезок AM"
              value={safePart}
              min={1}
              max={ab - 1}
              step={1}
              suffix={` ${unit}`}
              hint={`От 1 до ${ab - 1} ${unit}: точка M лежит на стороне AB`}
              onChange={(value) => { setPart(clamp(value, 1, ab - 1)); setChecked(false); }}
            />
          )}
        </div>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж подобных треугольников" tabIndex={0}>
          {activeMode === 'ratio' ? (
            <RatioPicture id={`${labId}-ratio`} triangle={triangle} factor={factor} angle={angle} unit={unit} />
          ) : (
            <ThalesPicture id={`${labId}-thales`} triangle={triangle} part={safePart} an={an} nc={nc} mn={mn} reveal={reveal} unit={unit} />
          )}
        </div>

        {activeChallenge && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>Длина NC, {unit}</label>
            <input
              id={`${labId}-answer`}
              type="text"
              inputMode="decimal"
              value={answer}
              onChange={(event) => {
                const raw = event.target.value.slice(0, 6);
                if (/^\d*(?:[.,]\d*)?$/.test(raw)) { setAnswer(raw); setChecked(false); }
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
          <span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span>
          <p><strong>{result.headline}</strong><small>{result.detail}</small></p>
        </div>
        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
