import { useEffect, useId, useRef, useState } from 'react';
import {
  exteriorAngle,
  extendSegment,
  isoscelesBaseAngle,
  isoscelesLayout,
  rotatePoint,
  segmentMidpoint,
  thirdTriangleAngle,
  triangleLayout,
  type PlanimetryPoint,
  type TriangleLayout,
} from '../lib/planimetry';

export type ProofTriangleMode = 'build' | 'isosceles' | 'angles';
export type ProofTriangleQuestion = 'third' | 'exterior';

export interface ProofTriangleLabProps {
  mode?: ProofTriangleMode;
  initialBase?: number;
  initialAngleA?: number;
  initialAngleB?: number;
  initialApex?: number;
  unit?: string;
  challenge?: boolean;
}

const MODES: readonly ProofTriangleMode[] = ['build', 'isosceles', 'angles'];
const MODE_LABELS: Readonly<Record<ProofTriangleMode, string>> = {
  build: 'Треугольник по данным',
  isosceles: 'Равнобедренный',
  angles: 'Сумма углов и внешний угол',
};
const QUESTION_LABELS: Readonly<Record<ProofTriangleQuestion, string>> = {
  third: 'третий угол C',
  exterior: 'внешний угол при вершине C',
};

const MIN_ANGLE = 20;
const MAX_ANGLE = 120;
/** Сумма двух заданных углов ограничена, чтобы третий угол не стал слишком острым. */
const MAX_PAIR_SUM = 150;
const MIN_BASE = 3;
const MAX_BASE = 12;
const MIN_APEX = 20;
const MAX_APEX = 150;
/** Угол поворота копии: копия должна выглядеть иначе, оставаясь равной оригиналу. */
const COPY_ROTATION = 145;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(Math.round(value), min, max) : fallback;
}

/** Угол при вершине берём чётным, чтобы углы при основании оставались целыми. */
function safeApex(value: number | undefined, fallback: number): number {
  const rounded = safeInteger(value, fallback, MIN_APEX, MAX_APEX);
  return rounded % 2 === 0 ? rounded : clamp(rounded - 1, MIN_APEX, MAX_APEX - 1);
}

function formatLength(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
}

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

interface Projector {
  readonly map: (point: PlanimetryPoint) => ScreenPoint;
}

/**
 * Единый масштаб для всего чертежа: длины сжимаются одинаково,
 * поэтому углы на картинке совпадают с вычисленными.
 */
function createProjector(
  points: readonly PlanimetryPoint[],
  width: number,
  height: number,
  padding: number,
): Projector {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 0.001);
  const spanY = Math.max(maxY - minY, 0.001);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  return {
    map: (point) => ({
      x: Math.round((width / 2 + (point.x - centreX) * scale) * 100) / 100,
      y: Math.round((height / 2 - (point.y - centreY) * scale) * 100) / 100,
    }),
  };
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

/** Дуга угла при вершине и точка для подписи на его биссектрисе. */
function angleArc(vertex: ScreenPoint, first: ScreenPoint, second: ScreenPoint, measure: number): ArcDrawing {
  const radius = measure < 32 ? 62 : measure < 62 ? 48 : 38;
  const left = unitVector(vertex, first);
  const right = unitVector(vertex, second);
  const start = { x: vertex.x + left.x * radius, y: vertex.y + left.y * radius };
  const end = { x: vertex.x + right.x * radius, y: vertex.y + right.y * radius };
  const cross = left.x * right.y - left.y * right.x;
  const sweep = cross > 0 ? 1 : 0;
  const bisector = unitVector({ x: 0, y: 0 }, { x: left.x + right.x, y: left.y + right.y });
  const labelDistance = radius + (measure < 32 ? 24 : 30);
  return {
    path: `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${sweep} ${end.x} ${end.y}`,
    label: { x: vertex.x + bisector.x * labelDistance, y: vertex.y + bisector.y * labelDistance + 9 },
  };
}

/** Квадратик прямого угла в вершине между двумя направлениями. */
function rightAngleMark(vertex: ScreenPoint, first: ScreenPoint, second: ScreenPoint, size = 16): string {
  const left = unitVector(vertex, first);
  const right = unitVector(vertex, second);
  const one = { x: vertex.x + left.x * size, y: vertex.y + left.y * size };
  const two = { x: vertex.x + right.x * size, y: vertex.y + right.y * size };
  const corner = { x: one.x + two.x - vertex.x, y: one.y + two.y - vertex.y };
  return `M ${one.x} ${one.y} L ${corner.x} ${corner.y} L ${two.x} ${two.y}`;
}

/** Штрихи на середине стороны — школьная пометка «эти отрезки равны». */
function equalMarks(
  first: ScreenPoint,
  second: ScreenPoint,
  count: number,
  size = 9,
): readonly (readonly [ScreenPoint, ScreenPoint])[] {
  const direction = unitVector(first, second);
  const normal = { x: -direction.y, y: direction.x };
  const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  return Array.from({ length: count }, (_, index) => {
    const shift = (index - (count - 1) / 2) * 7;
    const anchor = { x: middle.x + direction.x * shift, y: middle.y + direction.y * shift };
    return [
      { x: anchor.x - normal.x * size, y: anchor.y - normal.y * size },
      { x: anchor.x + normal.x * size, y: anchor.y + normal.y * size },
    ] as const;
  });
}

/** Точка подписи стороны — снаружи треугольника, со стороны, противоположной третьей вершине. */
function sideLabel(first: ScreenPoint, second: ScreenPoint, opposite: ScreenPoint, distance = 26): ScreenPoint {
  const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  const outward = unitVector(opposite, middle);
  return { x: middle.x + outward.x * distance, y: middle.y + outward.y * distance + 6 };
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

  const commit = () => {
    const parsed = /^\d+$/.test(draft.trim()) ? Number(draft.trim()) : value;
    onChange(parsed);
    setDraft(String(value));
  };

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>{label}<span className="dm-field__value">{value}{suffix}</span></label>
      <div className="dm-geometry-field__control">
        <button
          type="button"
          onClick={() => onChange(value - step)}
          disabled={value <= min}
          aria-label={`Уменьшить на ${step}`}
        >
          −
        </button>
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
            if (cancelCommit.current) {
              cancelCommit.current = false;
              setDraft(String(value));
            } else commit();
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
            if (event.key === 'Escape') { event.preventDefault(); cancelCommit.current = true; setDraft(String(value)); event.currentTarget.blur(); }
          }}
        />
        <button
          type="button"
          onClick={() => onChange(value + step)}
          disabled={value >= max}
          aria-label={`Увеличить на ${step}`}
        >
          +
        </button>
      </div>
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

const WIDTH = 720;
const HEIGHT = 430;
const PADDING = 76;

interface BuildPictureProps {
  readonly id: string;
  readonly layout: TriangleLayout;
  readonly unit: string;
  readonly overlay: boolean;
}

function BuildPicture({ id, layout, unit, overlay }: BuildPictureProps) {
  const original: readonly PlanimetryPoint[] = [layout.a, layout.b, layout.c];
  const centre: PlanimetryPoint = {
    x: (layout.a.x + layout.b.x + layout.c.x) / 3,
    y: (layout.a.y + layout.b.y + layout.c.y) / 3,
  };
  const turned = original.map((point) => rotatePoint(point, COPY_ROTATION, centre));
  const gap = layout.sides.ab * 0.45;
  const shiftX = overlay ? 0 : Math.max(...original.map((point) => point.x)) + gap - Math.min(...turned.map((point) => point.x));
  const shiftY = overlay
    ? 0
    : (Math.max(...original.map((point) => point.y)) + Math.min(...original.map((point) => point.y))) / 2
      - (Math.max(...turned.map((point) => point.y)) + Math.min(...turned.map((point) => point.y))) / 2;
  const copy = overlay ? original : turned.map((point) => ({ x: point.x + shiftX, y: point.y + shiftY }));
  const projector = createProjector([...original, ...copy], WIDTH, HEIGHT, PADDING);
  const [a, b, c] = original.map(projector.map) as [ScreenPoint, ScreenPoint, ScreenPoint];
  const [a1, b1, c1] = copy.map(projector.map) as [ScreenPoint, ScreenPoint, ScreenPoint];
  const arcA = angleArc(a, b, c, layout.angles[0]);
  const arcB = angleArc(b, c, a, layout.angles[1]);
  const arcA1 = angleArc(a1, b1, c1, layout.angles[0]);
  const arcB1 = angleArc(b1, c1, a1, layout.angles[1]);
  const description = overlay
    ? `Второй треугольник наложен на первый и полностью с ним совпал: основание ${formatLength(layout.sides.ab)} ${unit}, углы при основании ${layout.angles[0]} и ${layout.angles[1]} градусов.`
    : `Два треугольника построены по одинаковым данным: сторона ${formatLength(layout.sides.ab)} ${unit} и прилежащие к ней углы ${layout.angles[0]} и ${layout.angles[1]} градусов. Второй треугольник повёрнут, но его стороны те же: ${formatLength(layout.sides.bc)} ${unit} и ${formatLength(layout.sides.ca)} ${unit}.`;

  return (
    <svg className="dm-geometry-polygon" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Треугольник по стороне и двум прилежащим углам</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <polygon className="dm-geometry-polygon__shape" points={polyline([a, b, c])} />
      <polygon
        className={overlay ? 'dm-geometry-figure__completion' : 'dm-geometry-polygon__shape'}
        points={polyline([a1, b1, c1])}
      />
      <path className="dm-geometry-angle__arc" d={arcA.path} />
      <path className="dm-geometry-angle__arc" d={arcB.path} />
      {!overlay && <path className="dm-geometry-angle__arc" d={arcA1.path} />}
      {!overlay && <path className="dm-geometry-angle__arc" d={arcB1.path} />}
      <g className="dm-geometry-figure__dimensions" aria-hidden="true">
        <text {...sideLabel(a, b, c)}>{formatLength(layout.sides.ab)} {unit}</text>
        <text {...sideLabel(b, c, a)}>{formatLength(layout.sides.bc)} {unit}</text>
        <text {...sideLabel(c, a, b)}>{formatLength(layout.sides.ca)} {unit}</text>
      </g>
      <g aria-hidden="true">
        <text className="dm-geometry-angle__value" x={arcA.label.x} y={arcA.label.y} textAnchor="middle">{layout.angles[0]}°</text>
        <text className="dm-geometry-angle__value" x={arcB.label.x} y={arcB.label.y} textAnchor="middle">{layout.angles[1]}°</text>
        {!overlay && (
          <>
            <text className="dm-geometry-angle__value" x={arcA1.label.x} y={arcA1.label.y} textAnchor="middle">{layout.angles[0]}°</text>
            <text className="dm-geometry-angle__value" x={arcB1.label.x} y={arcB1.label.y} textAnchor="middle">{layout.angles[1]}°</text>
          </>
        )}
      </g>
      <g className="dm-geometry-polygon__vertex" aria-hidden="true">
        <circle cx={a.x} cy={a.y} r="7" /><text x={a.x - 22} y={a.y + 22}>{overlay ? 'A = A₁' : 'A'}</text>
        <circle cx={b.x} cy={b.y} r="7" /><text x={b.x + 12} y={b.y + 22}>{overlay ? 'B = B₁' : 'B'}</text>
        <circle cx={c.x} cy={c.y} r="7" /><text x={c.x - 6} y={c.y - 16}>{overlay ? 'C = C₁' : 'C'}</text>
        {!overlay && (
          <>
            <circle cx={a1.x} cy={a1.y} r="7" /><text x={a1.x - 28} y={a1.y + 22}>A₁</text>
            <circle cx={b1.x} cy={b1.y} r="7" /><text x={b1.x + 12} y={b1.y + 22}>B₁</text>
            <circle cx={c1.x} cy={c1.y} r="7" /><text x={c1.x - 8} y={c1.y - 16}>C₁</text>
          </>
        )}
      </g>
    </svg>
  );
}

interface IsoscelesPictureProps {
  readonly id: string;
  readonly layout: TriangleLayout;
  readonly reveal: boolean;
}

function IsoscelesPicture({ id, layout, reveal }: IsoscelesPictureProps) {
  const middle = segmentMidpoint(layout.a, layout.b);
  const projector = createProjector([layout.a, layout.b, layout.c], WIDTH, HEIGHT, PADDING);
  const a = projector.map(layout.a);
  const b = projector.map(layout.b);
  const c = projector.map(layout.c);
  const m = projector.map(middle);
  const arcA = angleArc(a, b, c, layout.angles[0]);
  const arcB = angleArc(b, c, a, layout.angles[1]);
  const arcC = angleArc(c, a, b, layout.angles[2]);
  const marks = [
    ...equalMarks(c, a, 1),
    ...equalMarks(c, b, 1),
    ...equalMarks(a, m, 2),
    ...equalMarks(m, b, 2),
  ];
  const description = reveal
    ? `Равнобедренный треугольник ABC: угол при вершине C равен ${layout.angles[2]} градусов, углы при основании равны ${layout.angles[0]} градусов каждый. Отрезок CM делит основание пополам и перпендикулярен ему.`
    : `Равнобедренный треугольник ABC: угол при вершине C равен ${layout.angles[2]} градусов, величины углов при основании скрыты. Отрезок CM делит основание пополам и перпендикулярен ему.`;

  return (
    <svg className="dm-geometry-polygon" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Равнобедренный треугольник и отрезок из вершины к середине основания</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <polygon className="dm-geometry-polygon__shape" points={polyline([a, b, c])} />
      <g className="dm-geometry-figure__construction" aria-hidden="true">
        <line x1={c.x} y1={c.y} x2={m.x} y2={m.y} />
      </g>
      <path className="dm-geometry-static__right-angle" d={rightAngleMark(m, b, c)} />
      <path className="dm-geometry-angle__arc" d={arcA.path} />
      <path className="dm-geometry-angle__arc" d={arcB.path} />
      <path className="dm-geometry-angle__arc" d={arcC.path} />
      <g className="dm-geometry-figure__dimensions" aria-hidden="true">
        {marks.map(([start, end], index) => (
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} key={`mark-${index}`} />
        ))}
      </g>
      <g aria-hidden="true">
        <text className="dm-geometry-angle__value" x={arcC.label.x} y={arcC.label.y} textAnchor="middle">{layout.angles[2]}°</text>
        <text className="dm-geometry-angle__value" x={arcA.label.x} y={arcA.label.y} textAnchor="middle">{reveal ? `${layout.angles[0]}°` : '?'}</text>
        <text className="dm-geometry-angle__value" x={arcB.label.x} y={arcB.label.y} textAnchor="middle">{reveal ? `${layout.angles[1]}°` : '?'}</text>
      </g>
      <g className="dm-geometry-polygon__vertex" aria-hidden="true">
        <circle cx={a.x} cy={a.y} r="7" /><text x={a.x - 24} y={a.y + 20}>A</text>
        <circle cx={b.x} cy={b.y} r="7" /><text x={b.x + 12} y={b.y + 20}>B</text>
        <circle cx={c.x} cy={c.y} r="7" /><text x={c.x - 6} y={c.y - 16}>C</text>
        <circle cx={m.x} cy={m.y} r="6" /><text x={m.x - 6} y={m.y + 28}>M</text>
      </g>
    </svg>
  );
}

interface AnglesPictureProps {
  readonly id: string;
  readonly layout: TriangleLayout;
  readonly reveal: boolean;
  readonly question: ProofTriangleQuestion;
}

function AnglesPicture({ id, layout, reveal, question }: AnglesPictureProps) {
  const outer = extendSegment(layout.a, layout.c, layout.sides.ca * 0.6);
  const projector = createProjector([layout.a, layout.b, layout.c, outer], WIDTH, HEIGHT, PADDING);
  const a = projector.map(layout.a);
  const b = projector.map(layout.b);
  const c = projector.map(layout.c);
  const d = projector.map(outer);
  const exterior = exteriorAngle(layout.angles[2]);
  const arcA = angleArc(a, b, c, layout.angles[0]);
  const arcB = angleArc(b, c, a, layout.angles[1]);
  const arcC = angleArc(c, a, b, layout.angles[2]);
  const arcD = angleArc(c, b, d, exterior);
  const description = reveal
    ? `Треугольник ABC: угол A равен ${layout.angles[0]}, угол B равен ${layout.angles[1]}, угол C равен ${layout.angles[2]} градусов. Сторона AC продолжена за вершину C до точки D, внешний угол BCD равен ${exterior} градусов.`
    : `Треугольник ABC: угол A равен ${layout.angles[0]}, угол B равен ${layout.angles[1]} градусов. Сторона AC продолжена за вершину C до точки D. Требуется найти ${QUESTION_LABELS[question]}.`;

  return (
    <svg className="dm-geometry-polygon" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Углы треугольника и внешний угол при вершине C</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <polygon className="dm-geometry-polygon__shape" points={polyline([a, b, c])} />
      <line className="dm-geometry-angle__ray dm-geometry-angle__ray--moving" x1={c.x} y1={c.y} x2={d.x} y2={d.y} />
      <path className="dm-geometry-angle__arc" d={arcA.path} />
      <path className="dm-geometry-angle__arc" d={arcB.path} />
      <path className="dm-geometry-angle__arc" d={arcC.path} />
      <g className="dm-geometry-grid__perpendicular" aria-hidden="true">
        <path d={arcD.path} />
      </g>
      <g aria-hidden="true">
        <text className="dm-geometry-angle__value" x={arcA.label.x} y={arcA.label.y} textAnchor="middle">{layout.angles[0]}°</text>
        <text className="dm-geometry-angle__value" x={arcB.label.x} y={arcB.label.y} textAnchor="middle">{layout.angles[1]}°</text>
        <text className="dm-geometry-angle__value" x={arcC.label.x} y={arcC.label.y} textAnchor="middle">
          {reveal ? `${layout.angles[2]}°` : question === 'third' ? '?' : ''}
        </text>
        <text className="dm-geometry-angle__value" x={arcD.label.x} y={arcD.label.y} textAnchor="middle">
          {reveal ? `${exterior}°` : question === 'exterior' ? '?' : ''}
        </text>
      </g>
      <g className="dm-geometry-polygon__vertex" aria-hidden="true">
        <circle cx={a.x} cy={a.y} r="7" /><text x={a.x - 24} y={a.y + 20}>A</text>
        <circle cx={b.x} cy={b.y} r="7" /><text x={b.x + 12} y={b.y + 20}>B</text>
        <circle cx={c.x} cy={c.y} r="7" /><text x={c.x - 24} y={c.y - 12}>C</text>
        <circle cx={d.x} cy={d.y} r="6" /><text x={d.x - 4} y={d.y - 14}>D</text>
      </g>
    </svg>
  );
}

function parseAnswer(raw: string): number | null {
  const source = raw.trim();
  if (!/^\d+$/.test(source)) return null;
  const value = Number(source);
  return Number.isFinite(value) ? value : null;
}

export default function ProofTriangleLab({
  mode,
  initialBase,
  initialAngleA,
  initialAngleB,
  initialApex,
  unit = 'см',
  challenge = false,
}: ProofTriangleLabProps) {
  const reactId = useId();
  const labId = `proof-triangle-${reactId.replace(/:/g, '')}`;
  const defaultMode: ProofTriangleMode = mode !== undefined && MODES.includes(mode) ? mode : 'build';
  const defaultBase = safeInteger(initialBase, 6, MIN_BASE, MAX_BASE);
  const defaultAngleA = safeInteger(initialAngleA, 50, MIN_ANGLE, MAX_ANGLE);
  const defaultAngleB = safeInteger(initialAngleB, MAX_PAIR_SUM - defaultAngleA >= 70 ? 70 : MIN_ANGLE, MIN_ANGLE, MAX_ANGLE);
  const defaultApex = safeApex(initialApex, 40);

  const [activeMode, setActiveMode] = useState(defaultMode);
  const [base, setBase] = useState(defaultBase);
  const [angleA, setAngleA] = useState(defaultAngleA);
  const [angleB, setAngleB] = useState(Math.min(defaultAngleB, MAX_PAIR_SUM - defaultAngleA));
  const [apex, setApex] = useState(defaultApex);
  const [overlay, setOverlay] = useState(false);
  const [question, setQuestion] = useState<ProofTriangleQuestion>('third');
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  // В режиме построения нечего прятать: там исследуют, а не отвечают.
  const activeChallenge = challenge && activeMode !== 'build';
  const reveal = !activeChallenge || checked;

  const changeAngleA = (value: number) => {
    const next = clamp(value, MIN_ANGLE, Math.min(MAX_ANGLE, MAX_PAIR_SUM - MIN_ANGLE));
    setAngleA(next);
    setAngleB((current) => clamp(current, MIN_ANGLE, MAX_PAIR_SUM - next));
    setChecked(false);
  };
  const changeAngleB = (value: number) => {
    const next = clamp(value, MIN_ANGLE, Math.min(MAX_ANGLE, MAX_PAIR_SUM - MIN_ANGLE));
    setAngleB(next);
    setAngleA((current) => clamp(current, MIN_ANGLE, MAX_PAIR_SUM - next));
    setChecked(false);
  };
  const changeApex = (value: number) => {
    const rounded = clamp(value, MIN_APEX, MAX_APEX);
    setApex(rounded % 2 === 0 ? rounded : clamp(rounded - 1, MIN_APEX, MAX_APEX - 1));
    setChecked(false);
  };
  const switchMode = (next: ProofTriangleMode) => {
    setActiveMode(next);
    setChecked(false);
    setAnswer('');
  };
  const switchQuestion = (next: ProofTriangleQuestion) => {
    setQuestion(next);
    setChecked(false);
    setAnswer('');
  };
  const reset = () => {
    setActiveMode(defaultMode);
    setBase(defaultBase);
    setAngleA(defaultAngleA);
    setAngleB(Math.min(defaultAngleB, MAX_PAIR_SUM - defaultAngleA));
    setApex(defaultApex);
    setOverlay(false);
    setQuestion('third');
    setAnswer('');
    setChecked(false);
  };

  const buildLayout = triangleLayout(base, angleA, angleB);
  const isoscelesLayoutValue = isoscelesLayout(8, apex);
  const anglesLayout = triangleLayout(8, angleA, angleB);
  const baseAngle = isoscelesBaseAngle(apex);
  const thirdAngle = thirdTriangleAngle(angleA, angleB);
  const exterior = exteriorAngle(thirdAngle);

  const expected = activeMode === 'isosceles'
    ? baseAngle
    : question === 'third' ? thirdAngle : exterior;
  const answerValue = parseAnswer(answer);
  const answerCorrect = answerValue !== null && answerValue === expected;

  const result = (() => {
    if (activeMode === 'build') {
      return {
        symbol: '≅',
        headline: `Сторона ${base} ${unit} и углы ${angleA}° и ${angleB}° задают ровно один треугольник.`,
        detail: overlay
          ? 'Копия наложена на оригинал и совпала с ним: третья вершина не имеет выбора.'
          : `Обе картинки построены по одним и тем же данным, поэтому BC = B₁C₁ = ${formatLength(buildLayout.sides.bc)} ${unit}, CA = C₁A₁ = ${formatLength(buildLayout.sides.ca)} ${unit}. Нажми «Совместить», чтобы проверить наложением.`,
      };
    }
    if (activeMode === 'isosceles') {
      if (activeChallenge && !checked) {
        return {
          symbol: '?',
          headline: `Угол при вершине равен ${apex}°. Найди угол при основании.`,
          detail: 'Углы при основании равны между собой, а все три угла дают в сумме 180°.',
        };
      }
      if (activeChallenge) {
        return {
          symbol: answerCorrect ? '✓' : '×',
          headline: answerCorrect ? 'Верно.' : `Пока нет: угол при основании равен ${baseAngle}°.`,
          detail: `(180° − ${apex}°) : 2 = ${baseAngle}°. Отрезок CM одновременно медиана, высота и биссектриса.`,
        };
      }
      return {
        symbol: '△',
        headline: `∠A = ∠B = ${baseAngle}° при ∠C = ${apex}°.`,
        detail: 'Меняй угол при вершине: углы при основании остаются равными друг другу при любом его значении.',
      };
    }
    if (activeChallenge && !checked) {
      return {
        symbol: '?',
        headline: `Даны ∠A = ${angleA}° и ∠B = ${angleB}°. Найди ${QUESTION_LABELS[question]}.`,
        detail: 'Одна теорема про сумму трёх углов, другая — про внешний угол. Реши, какая нужна.',
      };
    }
    if (activeChallenge) {
      return {
        symbol: answerCorrect ? '✓' : '×',
        headline: answerCorrect ? 'Точно.' : `Пока нет: ответ ${expected}°.`,
        detail: question === 'third'
          ? `∠C = 180° − ${angleA}° − ${angleB}° = ${thirdAngle}°.`
          : `Внешний угол при C равен ${angleA}° + ${angleB}° = ${exterior}°, и он же дополняет ∠C = ${thirdAngle}° до 180°.`,
      };
    }
    return {
      symbol: 'Σ',
      headline: `${angleA}° + ${angleB}° + ${thirdAngle}° = 180°, внешний угол при C равен ${exterior}°.`,
      detail: 'Сумма трёх углов не меняется при любом наклоне сторон, а внешний угол всегда равен сумме двух не смежных с ним внутренних.',
    };
  })();

  return (
    <section className="dm-lab dm-geometry-angle-shape not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория доказательств</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Треугольник, у которого нет свободы</h3>
          <p>Каждая длина и каждый угол на чертеже вычислены из введённых данных, а не подогнаны на глаз.</p>
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
          {activeMode === 'build' && (
            <NumberField
              id={`${labId}-base`}
              label="Сторона AB"
              value={base}
              min={MIN_BASE}
              max={MAX_BASE}
              step={1}
              suffix={` ${unit}`}
              hint={`От ${MIN_BASE} до ${MAX_BASE} ${unit}`}
              onChange={(value) => { setBase(clamp(value, MIN_BASE, MAX_BASE)); setChecked(false); }}
            />
          )}
          {activeMode === 'isosceles' ? (
            <NumberField
              id={`${labId}-apex`}
              label="Угол при вершине C"
              value={apex}
              min={MIN_APEX}
              max={MAX_APEX}
              step={2}
              suffix="°"
              hint={`Чётные значения от ${MIN_APEX}° до ${MAX_APEX}°`}
              onChange={changeApex}
            />
          ) : (
            <>
              <NumberField
                id={`${labId}-angle-a`}
                label="Угол A"
                value={angleA}
                min={MIN_ANGLE}
                max={MAX_ANGLE}
                step={5}
                suffix="°"
                hint={`От ${MIN_ANGLE}° до ${MAX_ANGLE}°, сумма двух углов не больше ${MAX_PAIR_SUM}°`}
                onChange={changeAngleA}
              />
              <NumberField
                id={`${labId}-angle-b`}
                label="Угол B"
                value={angleB}
                min={MIN_ANGLE}
                max={MAX_ANGLE}
                step={5}
                suffix="°"
                hint={`От ${MIN_ANGLE}° до ${MAX_ANGLE}°, сумма двух углов не больше ${MAX_PAIR_SUM}°`}
                onChange={changeAngleB}
              />
            </>
          )}
        </div>

        {activeMode === 'build' && (
          <div className="dm-geometry-example-switch">
            <span>{overlay ? 'Копия наложена на оригинал' : 'Копия построена по тем же данным и повёрнута'}</span>
            <button
              className="dm-button dm-button--secondary"
              type="button"
              aria-pressed={overlay}
              onClick={() => setOverlay((current) => !current)}
            >
              {overlay ? 'Развести треугольники' : 'Совместить наложением'}
            </button>
          </div>
        )}

        {activeMode === 'angles' && activeChallenge && (
          <div className="dm-geometry-tabs" role="group" aria-label="Какой угол ищем">
            {(Object.keys(QUESTION_LABELS) as ProofTriangleQuestion[]).map((item) => (
              <button
                type="button"
                className={question === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
                aria-pressed={question === item}
                onClick={() => switchQuestion(item)}
                key={item}
              >
                Найти {QUESTION_LABELS[item]}
              </button>
            ))}
          </div>
        )}

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж треугольника" tabIndex={0}>
          {activeMode === 'build' && (
            <BuildPicture id={`${labId}-build`} layout={buildLayout} unit={unit} overlay={overlay} />
          )}
          {activeMode === 'isosceles' && (
            <IsoscelesPicture id={`${labId}-isosceles`} layout={isoscelesLayoutValue} reveal={reveal} />
          )}
          {activeMode === 'angles' && (
            <AnglesPicture id={`${labId}-angles`} layout={anglesLayout} reveal={reveal} question={question} />
          )}
        </div>

        {activeChallenge && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>Искомый угол, °</label>
            <input
              id={`${labId}-answer`}
              type="text"
              inputMode="numeric"
              value={answer}
              onChange={(event) => {
                const raw = event.target.value.slice(0, 4);
                if (/^\d*$/.test(raw)) { setAnswer(raw); setChecked(false); }
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
