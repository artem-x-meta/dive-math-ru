import { useEffect, useId, useRef, useState } from 'react';
import {
  fitPointsToBox,
  hypotenuseLength,
  legsFromHypotenuseAndAngle,
  projectPoint,
  rightTriangleFromLegs,
  specialAngleRatios,
  squaresOnSides,
  type ScreenPoint,
} from '../lib/similarity';
import type { PlanimetryPoint } from '../lib/planimetry';

export type PythSquaresMode = 'squares' | 'find' | 'ratios';

export interface PythSquaresLabProps {
  mode?: PythSquaresMode;
  /** Вертикальный катет CB. */
  initialLegA?: number;
  /** Горизонтальный катет CA. */
  initialLegB?: number;
  /** Гипотенуза для режима отношений. */
  initialHypotenuse?: number;
  /** Острый угол при вершине A, градусы. */
  initialAngle?: number;
  unit?: string;
  challenge?: boolean;
}

const MODES: readonly PythSquaresMode[] = ['squares', 'find', 'ratios'];
const MODE_LABELS: Readonly<Record<PythSquaresMode, string>> = {
  squares: 'Квадраты на сторонах',
  find: 'Найти сторону',
  ratios: 'Синус, косинус, тангенс',
};

const MIN_LEG = 3;
const MAX_LEG = 12;
const MIN_HYPOTENUSE = 5;
const MAX_HYPOTENUSE = 15;
const MIN_ANGLE = 10;
const MAX_ANGLE = 80;

const WIDTH = 720;
const HEIGHT = 520;
const PADDING = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(Math.round(value), min, max) : fallback;
}

function formatNumber(value: number, digits = 2): string {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  const text = rounded.toFixed(digits).replace(/\.?0+$/, '');
  return (text === '' || text === '-' ? '0' : text).replace('.', ',');
}

/** Длина с честным знаком приближения: точное значение без «≈», иррациональное — с ним. */
function formatLength(value: number, digits = 2): string {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return `${Math.abs(rounded - value) < 1e-12 ? '' : '≈ '}${formatNumber(value, digits)}`;
}

function polyline(points: readonly ScreenPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function centroid(points: readonly ScreenPoint[]): ScreenPoint {
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length + 6 };
}

function unitVector(from: ScreenPoint, to: ScreenPoint): ScreenPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

/** Квадратик прямого угла между двумя направлениями, выходящими из вершины. */
function rightAngleMark(vertex: ScreenPoint, first: ScreenPoint, second: ScreenPoint, size = 18): string {
  const left = unitVector(vertex, first);
  const right = unitVector(vertex, second);
  const one = { x: vertex.x + left.x * size, y: vertex.y + left.y * size };
  const two = { x: vertex.x + right.x * size, y: vertex.y + right.y * size };
  const corner = { x: one.x + two.x - vertex.x, y: one.y + two.y - vertex.y };
  return `M ${one.x} ${one.y} L ${corner.x} ${corner.y} L ${two.x} ${two.y}`;
}

interface ArcDrawing {
  readonly path: string;
  readonly label: ScreenPoint;
}

function angleArc(vertex: ScreenPoint, first: ScreenPoint, second: ScreenPoint, measure: number): ArcDrawing {
  const radius = measure < 25 ? 62 : measure < 50 ? 50 : 40;
  const left = unitVector(vertex, first);
  const right = unitVector(vertex, second);
  const start = { x: vertex.x + left.x * radius, y: vertex.y + left.y * radius };
  const end = { x: vertex.x + right.x * radius, y: vertex.y + right.y * radius };
  const cross = left.x * right.y - left.y * right.x;
  const bisector = unitVector({ x: 0, y: 0 }, { x: left.x + right.x, y: left.y + right.y });
  const distance = radius + 26;
  return {
    path: `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${cross > 0 ? 1 : 0} ${end.x} ${end.y}`,
    label: { x: vertex.x + bisector.x * distance, y: vertex.y + bisector.y * distance + 6 },
  };
}

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
  readonly onChange: (value: number) => void;
}

function NumberField({ id, label, value, min, max, step, suffix, hint, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>{label}<span className="dm-field__value">{value}{suffix}</span></label>
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

interface SquaresPictureProps {
  readonly id: string;
  readonly legA: number;
  readonly legB: number;
  readonly unit: string;
}

/**
 * Прямой угол в точке C = (0; 0), катет CA лежит на оси x, катет CB — на оси y.
 * Квадраты строятся наружу, координаты вычисляются, а не подбираются.
 */
function SquaresPicture({ id, legA, legB, unit }: SquaresPictureProps) {
  const c: PlanimetryPoint = { x: 0, y: 0 };
  const a: PlanimetryPoint = { x: legB, y: 0 };
  const b: PlanimetryPoint = { x: 0, y: legA };
  const areas = squaresOnSides(legA, legB);
  const hypotenuse = hypotenuseLength(legA, legB);

  const squareB: readonly PlanimetryPoint[] = [c, a, { x: legB, y: -legB }, { x: 0, y: -legB }];
  const squareA: readonly PlanimetryPoint[] = [c, b, { x: -legA, y: legA }, { x: -legA, y: 0 }];
  // Внешняя нормаль к гипотенузе равна (a; b) и имеет длину, равную самой гипотенузе.
  const squareC: readonly PlanimetryPoint[] = [a, b, { x: legA, y: legA + legB }, { x: legA + legB, y: legB }];

  const fit = fitPointsToBox([...squareA, ...squareB, ...squareC], WIDTH, HEIGHT, PADDING);
  const project = (point: PlanimetryPoint) => projectPoint(point, fit);
  const screenA = project(a);
  const screenB = project(b);
  const screenC = project(c);
  const shapeA = squareA.map(project);
  const shapeB = squareB.map(project);
  const shapeC = squareC.map(project);

  return (
    <svg className="dm-geometry-polygon" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Квадраты, построенные на сторонах прямоугольного треугольника</title>
      <desc id={`${id}-desc`}>
        Прямоугольный треугольник с катетами {legA} и {legB} {unit} и гипотенузой {formatLength(hypotenuse)} {unit}.
        На катетах построены квадраты площадью {formatNumber(areas.legA)} и {formatNumber(areas.legB)} квадратных единиц,
        на гипотенузе — квадрат площадью {formatNumber(areas.hypotenuse)} квадратных единиц.
        Сумма площадей квадратов на катетах равна площади квадрата на гипотенузе.
      </desc>
      <polygon className="dm-geometry-figure__completion" points={polyline(shapeA)} />
      <polygon className="dm-geometry-figure__completion" points={polyline(shapeB)} />
      <polygon className="dm-geometry-figure__shape" points={polyline(shapeC)} />
      <polygon className="dm-geometry-polygon__shape" points={polyline([screenA, screenB, screenC])} />
      <path className="dm-geometry-static__right-angle" d={rightAngleMark(screenC, screenA, screenB)} />
      <g className="dm-geometry-figure__dimensions" aria-hidden="true">
        <text {...centroid(shapeA)}>{formatNumber(areas.legA)}</text>
        <text {...centroid(shapeB)}>{formatNumber(areas.legB)}</text>
        <text {...centroid(shapeC)}>{formatNumber(areas.hypotenuse)}</text>
        <text {...sideLabel(screenC, screenA, screenB, 18)}>{legB}</text>
        <text {...sideLabel(screenC, screenB, screenA, 18)}>{legA}</text>
      </g>
      <g className="dm-geometry-polygon__vertex" aria-hidden="true">
        <circle cx={screenC.x} cy={screenC.y} r="7" /><text x={screenC.x + 12} y={screenC.y + 22}>C</text>
        <circle cx={screenA.x} cy={screenA.y} r="7" /><text x={screenA.x + 12} y={screenA.y + 22}>A</text>
        <circle cx={screenB.x} cy={screenB.y} r="7" /><text x={screenB.x + 12} y={screenB.y - 10}>B</text>
      </g>
    </svg>
  );
}

interface TrianglePictureProps {
  readonly id: string;
  readonly horizontal: number;
  readonly vertical: number;
  readonly hypotenuse: number;
  readonly angle: number;
  readonly showAngle: boolean;
  readonly hiddenSide: 'hypotenuse' | 'vertical' | 'none';
  readonly unit: string;
}

/** Прямой угол в точке C справа внизу: A слева, B сверху над C. */
function TrianglePicture({ id, horizontal, vertical, hypotenuse, angle, showAngle, hiddenSide, unit }: TrianglePictureProps) {
  const a: PlanimetryPoint = { x: 0, y: 0 };
  const c: PlanimetryPoint = { x: horizontal, y: 0 };
  const b: PlanimetryPoint = { x: horizontal, y: vertical };
  const fit = fitPointsToBox([a, b, c], WIDTH, HEIGHT - 120, PADDING);
  const screenA = projectPoint(a, fit);
  const screenB = projectPoint(b, fit);
  const screenC = projectPoint(c, fit);
  const arc = angleArc(screenA, screenC, screenB, angle);

  return (
    <svg className="dm-geometry-polygon" viewBox={`0 0 ${WIDTH} ${HEIGHT - 120}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Прямоугольный треугольник с прямым углом при вершине C</title>
      <desc id={`${id}-desc`}>
        Прямоугольный треугольник ABC: прямой угол при вершине C, катет AC равен {formatLength(horizontal)} {unit},
        катет BC равен {hiddenSide === 'vertical' ? 'искомой величине' : `${formatLength(vertical)} ${unit}`},
        гипотенуза AB равна {hiddenSide === 'hypotenuse' ? 'искомой величине' : `${formatLength(hypotenuse)} ${unit}`}
        {showAngle ? `, острый угол при вершине A равен ${angle} градусам` : ''}.
      </desc>
      <polygon className="dm-geometry-polygon__shape" points={polyline([screenA, screenC, screenB])} />
      <path className="dm-geometry-static__right-angle" d={rightAngleMark(screenC, screenA, screenB)} />
      {showAngle && <path className="dm-geometry-angle__arc" d={arc.path} />}
      {showAngle && (
        <text className="dm-geometry-angle__value" x={arc.label.x} y={arc.label.y} textAnchor="middle" aria-hidden="true">{angle}°</text>
      )}
      <g className="dm-geometry-figure__dimensions" aria-hidden="true">
        <text {...sideLabel(screenA, screenC, screenB, 22)}>{formatLength(horizontal)}</text>
        <text {...sideLabel(screenC, screenB, screenA, 22)}>{hiddenSide === 'vertical' ? '?' : formatLength(vertical)}</text>
        <text {...sideLabel(screenA, screenB, screenC, 22)}>{hiddenSide === 'hypotenuse' ? '?' : formatLength(hypotenuse)}</text>
      </g>
      <g className="dm-geometry-polygon__vertex" aria-hidden="true">
        <circle cx={screenA.x} cy={screenA.y} r="7" /><text x={screenA.x - 24} y={screenA.y + 22}>A</text>
        <circle cx={screenC.x} cy={screenC.y} r="7" /><text x={screenC.x + 12} y={screenC.y + 22}>C</text>
        <circle cx={screenB.x} cy={screenB.y} r="7" /><text x={screenB.x + 12} y={screenB.y - 10}>B</text>
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

export default function PythSquaresLab({
  mode,
  initialLegA,
  initialLegB,
  initialHypotenuse,
  initialAngle,
  unit = 'см',
  challenge = false,
}: PythSquaresLabProps) {
  const reactId = useId();
  const labId = `pyth-squares-${reactId.replace(/:/g, '')}`;
  const defaultMode: PythSquaresMode = mode !== undefined && MODES.includes(mode) ? mode : 'squares';
  const defaultLegA = safeInteger(initialLegA, 3, MIN_LEG, MAX_LEG);
  const defaultLegB = safeInteger(initialLegB, 4, MIN_LEG, MAX_LEG);
  const defaultHypotenuse = safeInteger(initialHypotenuse, 10, MIN_HYPOTENUSE, MAX_HYPOTENUSE);
  const defaultAngle = safeInteger(initialAngle, 30, MIN_ANGLE, MAX_ANGLE);

  const [activeMode, setActiveMode] = useState(defaultMode);
  const [legA, setLegA] = useState(defaultLegA);
  const [legB, setLegB] = useState(defaultLegB);
  const [hypotenuseValue, setHypotenuseValue] = useState(defaultHypotenuse);
  const [angle, setAngle] = useState(defaultAngle);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const areas = squaresOnSides(legA, legB);
  const hypotenuse = hypotenuseLength(legA, legB);
  const legs = legsFromHypotenuseAndAngle(hypotenuseValue, angle);
  const ratios = rightTriangleFromLegs(legs.opposite, legs.adjacent);
  const table = specialAngleRatios(angle);

  const activeChallenge = challenge && activeMode !== 'squares';
  const reveal = !activeChallenge || checked;
  const expected = activeMode === 'find' ? hypotenuse : legs.opposite;
  const answerValue = parseAnswer(answer);
  const answerCorrect = answerValue !== null && Math.abs(answerValue - expected) <= 0.05;

  const switchMode = (next: PythSquaresMode) => {
    setActiveMode(next);
    setAnswer('');
    setChecked(false);
  };
  const reset = () => {
    setActiveMode(defaultMode);
    setLegA(defaultLegA);
    setLegB(defaultLegB);
    setHypotenuseValue(defaultHypotenuse);
    setAngle(defaultAngle);
    setAnswer('');
    setChecked(false);
  };

  const result = (() => {
    if (activeMode === 'squares') {
      return {
        symbol: '□',
        headline: `${formatNumber(areas.legA)} + ${formatNumber(areas.legB)} = ${formatNumber(areas.hypotenuse)}`,
        detail: `Площади квадратов на катетах в сумме дают площадь квадрата на гипотенузе, поэтому c² = ${formatNumber(areas.hypotenuse)} и c = ${formatLength(hypotenuse)} ${unit}. Меняй катеты: равенство не ломается никогда.`,
      };
    }
    if (activeMode === 'find') {
      if (activeChallenge && !checked) {
        return {
          symbol: '?',
          headline: `Катеты равны ${legB} и ${legA} ${unit}. Найди гипотенузу с точностью до десятых.`,
          detail: 'Сначала найди c², потом извлеки корень. Ответ вводи десятичной дробью.',
        };
      }
      return {
        symbol: activeChallenge ? (answerCorrect ? '✓' : '×') : '√',
        headline: activeChallenge && !answerCorrect
          ? `Пока нет: c = ${formatLength(hypotenuse)} ${unit}.`
          : `c² = ${legB}² + ${legA}² = ${formatNumber(areas.hypotenuse)}, поэтому c = ${formatLength(hypotenuse)} ${unit}.`,
        detail: Number.isInteger(hypotenuse)
          ? 'Здесь корень извлекается нацело: перед тобой пифагорова тройка.'
          : `Корень из ${formatNumber(areas.hypotenuse)} не целый, поэтому точный ответ записывают как √${formatNumber(areas.hypotenuse)}, а десятичную дробь помечают знаком ≈.`,
      };
    }
    if (activeChallenge && !checked) {
      return {
        symbol: '?',
        headline: `Гипотенуза ${hypotenuseValue} ${unit}, угол A равен ${angle}°. Найди катет BC с точностью до десятых.`,
        detail: 'Катет BC лежит против угла A, значит нужен синус: BC = AB · sin A.',
      };
    }
    return {
      symbol: activeChallenge ? (answerCorrect ? '✓' : '×') : '∠',
      headline: `sin ${angle}° ≈ ${formatNumber(ratios.sine, 4)}, cos ${angle}° ≈ ${formatNumber(ratios.cosine, 4)}, tg ${angle}° ≈ ${formatNumber(ratios.tangent, 4)}.`,
      detail: `При гипотенузе ${hypotenuseValue} ${unit} катеты равны BC ${formatLength(legs.opposite)} и AC ${formatLength(legs.adjacent)} ${unit}.${table ? ` Точные значения: sin = ${table.sine}, cos = ${table.cosine}, tg = ${table.tangent}.` : ' Меняй гипотенузу: три отношения не меняются, потому что треугольники подобны.'}`,
    };
  })();

  return (
    <section className="dm-lab dm-geometry-angle-shape not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория прямоугольного треугольника</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Квадраты, корни и отношения сторон</h3>
          <p>Все длины и площади вычисляются из введённых катетов, а квадраты строятся по настоящим координатам.</p>
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
              onClick={() => switchMode(item)}
              key={item}
            >
              {MODE_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-geometry-controls">
          {activeMode === 'ratios' ? (
            <>
              <NumberField
                id={`${labId}-hyp`}
                label="Гипотенуза AB"
                value={hypotenuseValue}
                min={MIN_HYPOTENUSE}
                max={MAX_HYPOTENUSE}
                step={1}
                suffix={` ${unit}`}
                hint={`От ${MIN_HYPOTENUSE} до ${MAX_HYPOTENUSE} ${unit}`}
                onChange={(value) => { setHypotenuseValue(clamp(value, MIN_HYPOTENUSE, MAX_HYPOTENUSE)); setChecked(false); }}
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
            </>
          ) : (
            <>
              <NumberField
                id={`${labId}-leg-b`}
                label="Катет AC"
                value={legB}
                min={MIN_LEG}
                max={MAX_LEG}
                step={1}
                suffix={` ${unit}`}
                hint={`От ${MIN_LEG} до ${MAX_LEG} ${unit}`}
                onChange={(value) => { setLegB(clamp(value, MIN_LEG, MAX_LEG)); setChecked(false); }}
              />
              <NumberField
                id={`${labId}-leg-a`}
                label="Катет BC"
                value={legA}
                min={MIN_LEG}
                max={MAX_LEG}
                step={1}
                suffix={` ${unit}`}
                hint={`От ${MIN_LEG} до ${MAX_LEG} ${unit}`}
                onChange={(value) => { setLegA(clamp(value, MIN_LEG, MAX_LEG)); setChecked(false); }}
              />
            </>
          )}
        </div>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж прямоугольного треугольника" tabIndex={0}>
          {activeMode === 'squares' && (
            <SquaresPicture id={`${labId}-squares`} legA={legA} legB={legB} unit={unit} />
          )}
          {activeMode === 'find' && (
            <TrianglePicture
              id={`${labId}-find`}
              horizontal={legB}
              vertical={legA}
              hypotenuse={hypotenuse}
              angle={0}
              showAngle={false}
              hiddenSide={reveal ? 'none' : 'hypotenuse'}
              unit={unit}
            />
          )}
          {activeMode === 'ratios' && (
            <TrianglePicture
              id={`${labId}-ratios`}
              horizontal={legs.adjacent}
              vertical={legs.opposite}
              hypotenuse={hypotenuseValue}
              angle={angle}
              showAngle
              hiddenSide={reveal ? 'none' : 'vertical'}
              unit={unit}
            />
          )}
        </div>

        {activeChallenge && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>{activeMode === 'find' ? 'Гипотенуза' : 'Катет BC'}, {unit}</label>
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
