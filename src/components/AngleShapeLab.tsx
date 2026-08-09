import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { compareExact, parseExact } from '../lib/exactRational';
import {
  classifyAngle,
  classifyTriangle,
  inspectQuadrilateral,
  type AngleKind,
  type GeometryPoint,
  type QuadrilateralFacts,
  type TriangleAngleKind,
  type TriangleFacts,
  type TriangleSideKind,
} from '../lib/geometry';

export type { GeometryPoint } from '../lib/geometry';

export type AngleShapeMode = 'measure' | 'build' | 'triangle' | 'quadrilateral';

export interface AngleShapeLabProps {
  mode?: AngleShapeMode;
  initialDegrees?: number;
  targetDegrees?: number;
  initialTriangle?: readonly [GeometryPoint, GeometryPoint, GeometryPoint];
  initialQuadrilateral?: readonly [GeometryPoint, GeometryPoint, GeometryPoint, GeometryPoint];
  step?: number;
  challenge?: boolean;
}

const MODES: readonly AngleShapeMode[] = ['measure', 'build', 'triangle', 'quadrilateral'];
const MODE_LABELS: Readonly<Record<AngleShapeMode, string>> = {
  measure: 'Измерить угол',
  build: 'Построить угол',
  triangle: 'Треугольник',
  quadrilateral: 'Четырёхугольник',
};
const ANGLE_LABELS: Readonly<Record<AngleKind, string>> = {
  zero: 'нулевой',
  acute: 'острый',
  right: 'прямой',
  obtuse: 'тупой',
  straight: 'развёрнутый',
};
const TRIANGLE_SIDE_LABELS: Readonly<Record<TriangleSideKind, string>> = {
  equilateral: 'равносторонний',
  isosceles: 'равнобедренный',
  scalene: 'разносторонний',
};
const TRIANGLE_ANGLE_LABELS: Readonly<Record<TriangleAngleKind, string>> = {
  acute: 'остроугольный',
  right: 'прямоугольный',
  obtuse: 'тупоугольный',
};
const QUADRILATERAL_LABELS: Readonly<Record<QuadrilateralFacts['kind'], string>> = {
  square: 'квадрат',
  rectangle: 'прямоугольник',
  other: 'другой четырёхугольник',
};

const DEFAULT_TRIANGLE: readonly [GeometryPoint, GeometryPoint, GeometryPoint] = [
  { x: -3, y: -2 },
  { x: 3, y: -2 },
  { x: 0, y: 3 },
] as const;
const DEFAULT_QUADRILATERAL: readonly [GeometryPoint, GeometryPoint, GeometryPoint, GeometryPoint] = [
  { x: -4, y: -2 },
  { x: 4, y: -2 },
  { x: 4, y: 2 },
  { x: -4, y: 2 },
] as const;

const TRIANGLE_EXAMPLES: readonly (readonly [GeometryPoint, GeometryPoint, GeometryPoint])[] = [
  DEFAULT_TRIANGLE,
  [{ x: -3, y: -2 }, { x: 3, y: -2 }, { x: -3, y: 2 }],
  [{ x: -4, y: -1 }, { x: 4, y: -1 }, { x: -2, y: 1 }],
  [{ x: 0, y: 4 }, { x: -4, y: 0 }, { x: 4, y: 0 }],
] as const;
const QUADRILATERAL_EXAMPLES: readonly (readonly [GeometryPoint, GeometryPoint, GeometryPoint, GeometryPoint])[] = [
  DEFAULT_QUADRILATERAL,
  [{ x: -3, y: -3 }, { x: 3, y: -3 }, { x: 3, y: 3 }, { x: -3, y: 3 }],
  [{ x: -4, y: -2 }, { x: 2, y: -2 }, { x: 4, y: 2 }, { x: -2, y: 2 }],
  [{ x: -4, y: -2 }, { x: 4, y: -2 }, { x: 2, y: 2 }, { x: -3, y: 2 }],
] as const;

function safeMode(value: AngleShapeMode | undefined): AngleShapeMode {
  return value !== undefined && MODES.includes(value) ? value : 'measure';
}

function safeDegrees(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(180, Math.round(value)))
    : fallback;
}

function safeStep(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(10, Math.round(value)))
    : 5;
}

function safeGridPoint(value: GeometryPoint | undefined, fallback: GeometryPoint): GeometryPoint {
  const coordinate = (candidate: unknown, backup: number) =>
    typeof candidate === 'number' && Number.isFinite(candidate)
      ? Math.max(-12, Math.min(12, Math.round(candidate)))
      : backup;
  return { x: coordinate(value?.x, fallback.x), y: coordinate(value?.y, fallback.y) };
}

function safeTriangle(
  value: readonly [GeometryPoint, GeometryPoint, GeometryPoint] | undefined,
): readonly [GeometryPoint, GeometryPoint, GeometryPoint] {
  if (!Array.isArray(value) || value.length !== 3) return DEFAULT_TRIANGLE;
  const candidate = value.map((point, index) => safeGridPoint(point, DEFAULT_TRIANGLE[index]!)) as unknown as readonly [GeometryPoint, GeometryPoint, GeometryPoint];
  try {
    classifyTriangle(candidate);
    return candidate;
  } catch {
    return DEFAULT_TRIANGLE;
  }
}

function safeQuadrilateral(
  value: readonly [GeometryPoint, GeometryPoint, GeometryPoint, GeometryPoint] | undefined,
): readonly [GeometryPoint, GeometryPoint, GeometryPoint, GeometryPoint] {
  if (!Array.isArray(value) || value.length !== 4) return DEFAULT_QUADRILATERAL;
  const candidate = value.map((point, index) => safeGridPoint(point, DEFAULT_QUADRILATERAL[index]!)) as unknown as readonly [GeometryPoint, GeometryPoint, GeometryPoint, GeometryPoint];
  try {
    inspectQuadrilateral(candidate);
    return candidate;
  } catch {
    return DEFAULT_QUADRILATERAL;
  }
}

interface DegreeFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}

function DegreeField({ id, label, value, step, onChange }: DegreeFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  const commit = () => {
    const parsed = /^\d+(?:[.,]\d+)?$/.test(draft.trim()) ? Number(draft.replace(',', '.')) : value;
    const next = safeDegrees(parsed, value);
    setDraft(String(next));
    onChange(next);
  };
  const nudge = (direction: -1 | 1) => onChange(Math.max(1, Math.min(180, value + direction * step)));

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>{label}<span className="dm-field__value">{value}°</span></label>
      <div className="dm-geometry-field__control">
        <button type="button" onClick={() => nudge(-1)} disabled={value <= 1} aria-label={`Уменьшить угол на ${step} градусов`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => { cancelCommit.current = false; setEditing(true); }}
          onChange={(event) => {
            const raw = event.target.value.slice(0, 8);
            if (/^\d*(?:[.,]\d*)?$/.test(raw)) {
              setDraft(raw);
              if (/^\d+(?:[.,]\d+)?$/.test(raw)) {
                const parsed = Number(raw.replace(',', '.'));
                if (parsed >= 1 && parsed <= 180 && Number.isInteger(parsed)) onChange(parsed);
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
        <button type="button" onClick={() => nudge(1)} disabled={value >= 180} aria-label={`Увеличить угол на ${step} градусов`}>+</button>
      </div>
      <small id={`${id}-hint`}>От 1° до 180°, шаг кнопок {step}°</small>
    </div>
  );
}

interface AnglePictureProps {
  readonly id: string;
  readonly degrees: number;
  readonly target: number;
  readonly build: boolean;
  readonly revealValue: boolean;
}

function AnglePicture({ id, degrees, target, build, revealValue }: AnglePictureProps) {
  const width = 720;
  const height = 410;
  const center = { x: 360, y: 330 };
  const radius = 245;
  const pointAt = (angle: number, length = radius) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: Math.round((center.x + Math.cos(radians) * length) * 1000) / 1000,
      y: Math.round((center.y - Math.sin(radians) * length) * 1000) / 1000,
    };
  };
  const end = pointAt(degrees);
  const targetEnd = pointAt(target);
  const arcRadius = 78;
  const arcEnd = pointAt(degrees, arcRadius);
  const ticks = Array.from({ length: 37 }, (_, index) => index * 5);
  const title = build ? 'Построение угла по транспортиру' : 'Измерение угла транспортиром';
  const description = revealValue
    ? `Один луч лежит горизонтально, второй образует угол ${degrees} градусов.${build ? ` Цель — ${target} градусов.` : ''}`
    : `Один луч лежит горизонтально, положение второго нужно определить по шкале транспортира.${build ? ` Требуется построить ${target} градусов.` : ''}`;

  return (
    <svg className="dm-geometry-angle" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{title}</title><desc id={`${id}-desc`}>{description}</desc>
      <path className="dm-geometry-angle__protractor" d={`M ${center.x - radius} ${center.y} A ${radius} ${radius} 0 0 1 ${center.x + radius} ${center.y}`} />
      <g className="dm-geometry-angle__ticks" aria-hidden="true">
        {ticks.map((angle) => {
          const outer = pointAt(angle);
          const inner = pointAt(angle, radius - (angle % 10 === 0 ? 18 : 10));
          const label = pointAt(angle, radius - 38);
          return <g key={angle}><line x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} />{angle % 10 === 0 && <text x={label.x} y={label.y}>{angle}</text>}</g>;
        })}
      </g>
      {build && revealValue && <line className="dm-geometry-angle__target" x1={center.x} y1={center.y} x2={targetEnd.x} y2={targetEnd.y} />}
      <line className="dm-geometry-angle__ray" x1={center.x} y1={center.y} x2={center.x + radius} y2={center.y} />
      <line className="dm-geometry-angle__ray dm-geometry-angle__ray--moving" x1={center.x} y1={center.y} x2={end.x} y2={end.y} />
      <path className="dm-geometry-angle__arc" d={`M ${center.x + arcRadius} ${center.y} A ${arcRadius} ${arcRadius} 0 ${degrees > 180 ? 1 : 0} 0 ${arcEnd.x} ${arcEnd.y}`} />
      <circle className="dm-geometry-angle__vertex" cx={center.x} cy={center.y} r="7" />
      {revealValue && <text className="dm-geometry-angle__value" x={center.x + 92} y={center.y - 46}>{degrees}°</text>}
    </svg>
  );
}

interface PolygonPictureProps {
  readonly id: string;
  readonly points: readonly GeometryPoint[];
  readonly name: 'triangle' | 'quadrilateral';
  readonly revealFacts: boolean;
  readonly rightAngles: number;
}

function PolygonPicture({ id, points, name, revealFacts, rightAngles }: PolygonPictureProps) {
  const width = 720;
  const height = 430;
  const padding = 72;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const px = (value: number) => width / 2 + (value - (minX + maxX) / 2) * scale;
  const py = (value: number) => height / 2 - (value - (minY + maxY) / 2) * scale;
  const labels = ['A', 'B', 'C', 'D'];
  const rightAngleIndices = points.flatMap((point, index) => {
    const previous = points[(index + points.length - 1) % points.length]!;
    const next = points[(index + 1) % points.length]!;
    const incoming = { x: previous.x - point.x, y: previous.y - point.y };
    const outgoing = { x: next.x - point.x, y: next.y - point.y };
    return incoming.x * outgoing.x + incoming.y * outgoing.y === 0 ? [index] : [];
  });
  const sideSquares = points.map((point, index) => {
    const next = points[(index + 1) % points.length]!;
    return (next.x - point.x) ** 2 + (next.y - point.y) ** 2;
  });
  const repeatedLengths = [...new Set(sideSquares.filter((value, index) => sideSquares.indexOf(value) !== index))];
  const title = name === 'triangle' ? 'Треугольник на квадратной сетке' : 'Четырёхугольник на квадратной сетке';
  const description = `${title}. Вершины: ${points.map((point, index) => `${labels[index]}(${point.x}; ${point.y})`).join(', ')}.${revealFacts && rightAngles > 0 ? ` Отмечено прямых углов: ${rightAngles}.` : ''}`;

  return (
    <svg className="dm-geometry-polygon" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{title}</title><desc id={`${id}-desc`}>{description}</desc>
      <defs><pattern id={`${id}-grid`} x={px(0)} y={py(0)} width={scale} height={scale} patternUnits="userSpaceOnUse"><path d={`M ${scale} 0 L 0 0 0 ${scale}`} /></pattern></defs>
      <rect className="dm-geometry-polygon__background" x="24" y="24" width={width - 48} height={height - 48} rx="12" />
      <rect className="dm-geometry-polygon__grid" x="24" y="24" width={width - 48} height={height - 48} fill={`url(#${id}-grid)`} />
      <polygon className="dm-geometry-polygon__shape" points={points.map((point) => `${px(point.x)},${py(point.y)}`).join(' ')} />
      {name === 'quadrilateral' && revealFacts && <g className="dm-geometry-polygon__diagonals"><line x1={px(points[0]!.x)} y1={py(points[0]!.y)} x2={px(points[2]!.x)} y2={py(points[2]!.y)} /><line x1={px(points[1]!.x)} y1={py(points[1]!.y)} x2={px(points[3]!.x)} y2={py(points[3]!.y)} /></g>}
      {revealFacts && (
        <g className="dm-geometry-polygon__right-angle-marks" aria-hidden="true">
          {rightAngleIndices.map((index) => {
            const current = points[index]!;
            const previous = points[(index + points.length - 1) % points.length]!;
            const next = points[(index + 1) % points.length]!;
            const previousLength = Math.hypot(previous.x - current.x, previous.y - current.y) || 1;
            const nextLength = Math.hypot(next.x - current.x, next.y - current.y) || 1;
            const size = 15 / scale;
            const first = { x: current.x + ((previous.x - current.x) / previousLength) * size, y: current.y + ((previous.y - current.y) / previousLength) * size };
            const third = { x: current.x + ((next.x - current.x) / nextLength) * size, y: current.y + ((next.y - current.y) / nextLength) * size };
            const middle = { x: first.x + third.x - current.x, y: first.y + third.y - current.y };
            return <path d={`M ${px(first.x)} ${py(first.y)} L ${px(middle.x)} ${py(middle.y)} L ${px(third.x)} ${py(third.y)}`} key={`right-${index}`} />;
          })}
        </g>
      )}
      {revealFacts && repeatedLengths.length > 0 && (
        <g className="dm-geometry-polygon__side-marks" aria-hidden="true">
          {points.map((point, index) => {
            const groupIndex = repeatedLengths.indexOf(sideSquares[index]!);
            if (groupIndex === -1) return null;
            const next = points[(index + 1) % points.length]!;
            const dx = next.x - point.x;
            const dy = next.y - point.y;
            const length = Math.hypot(dx, dy) || 1;
            const normal = { x: -dy / length, y: dx / length };
            const tangent = { x: dx / length, y: dy / length };
            const middle = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
            const tickCount = Math.min(2, groupIndex + 1);
            return Array.from({ length: tickCount }, (_, tickIndex) => {
              const offset = (tickIndex - (tickCount - 1) / 2) * (7 / scale);
              const center = { x: middle.x + tangent.x * offset, y: middle.y + tangent.y * offset };
              const half = 7 / scale;
              return <line x1={px(center.x - normal.x * half)} y1={py(center.y - normal.y * half)} x2={px(center.x + normal.x * half)} y2={py(center.y + normal.y * half)} key={`${index}-${tickIndex}`} />;
            });
          })}
        </g>
      )}
      {points.map((point, index) => <g className="dm-geometry-polygon__vertex" key={`${point.x}-${point.y}-${index}`}><circle cx={px(point.x)} cy={py(point.y)} r="7" /><text x={px(point.x) + 11} y={py(point.y) - 11}>{labels[index]}</text></g>)}
    </svg>
  );
}

function parseAnswer(raw: string): number | null {
  const source = raw.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(source)) return null;
  const value = Number(source.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export default function AngleShapeLab({
  mode,
  initialDegrees,
  targetDegrees,
  initialTriangle,
  initialQuadrilateral,
  step,
  challenge = false,
}: AngleShapeLabProps) {
  const reactId = useId();
  const labId = `angle-shape-${reactId.replace(/:/g, '')}`;
  const defaultMode = safeMode(mode);
  const defaultDegrees = safeDegrees(initialDegrees, 65);
  const target = safeDegrees(targetDegrees, 120);
  const safeDegreeStep = safeStep(step);
  const authoredTriangle = useMemo(() => safeTriangle(initialTriangle), [initialTriangle]);
  const authoredQuadrilateral = useMemo(() => safeQuadrilateral(initialQuadrilateral), [initialQuadrilateral]);
  const triangleExamples = useMemo(() => [authoredTriangle, ...TRIANGLE_EXAMPLES.filter((item) => item !== DEFAULT_TRIANGLE)], [authoredTriangle]);
  const quadrilateralExamples = useMemo(() => [authoredQuadrilateral, ...QUADRILATERAL_EXAMPLES.filter((item) => item !== DEFAULT_QUADRILATERAL)], [authoredQuadrilateral]);
  const [activeMode, setActiveMode] = useState(defaultMode);
  const [degrees, setDegrees] = useState(defaultDegrees);
  const [triangleIndex, setTriangleIndex] = useState(0);
  const [quadrilateralIndex, setQuadrilateralIndex] = useState(0);
  const [measureAnswer, setMeasureAnswer] = useState('');
  const [triangleSideAnswer, setTriangleSideAnswer] = useState<TriangleSideKind | null>(null);
  const [triangleAngleAnswer, setTriangleAngleAnswer] = useState<TriangleAngleKind | null>(null);
  const [quadrilateralAnswer, setQuadrilateralAnswer] = useState<QuadrilateralFacts['kind'] | null>(null);
  const [checked, setChecked] = useState(false);

  const triangle = triangleExamples[triangleIndex % triangleExamples.length]!;
  const quadrilateral = quadrilateralExamples[quadrilateralIndex % quadrilateralExamples.length]!;
  const triangleFacts: TriangleFacts = classifyTriangle(triangle);
  const quadrilateralFacts = inspectQuadrilateral(quadrilateral);
  const angleKind = classifyAngle(degrees);
  const measureValue = parseAnswer(measureAnswer);
  const measureCorrect = measureValue !== null && compareExact(parseExact(measureValue), parseExact(degrees)) === 0;
  const buildCorrect = degrees === target;
  const triangleCorrect = triangleSideAnswer === triangleFacts.sideKind && triangleAngleAnswer === triangleFacts.angleKind;
  const quadrilateralCorrect = quadrilateralAnswer === quadrilateralFacts.kind;
  const revealFacts = !challenge || checked;

  const invalidate = () => setChecked(false);
  const setAngle = (value: number) => { invalidate(); setDegrees(safeDegrees(value, degrees)); };
  const nudgeBuildAngle = (direction: -1 | 1) => {
    const requested = degrees + direction * safeDegreeStep;
    const crossesTarget = direction > 0
      ? degrees < target && requested > target
      : degrees > target && requested < target;
    setAngle(crossesTarget ? target : requested);
  };
  const cycleTriangle = () => { setTriangleIndex((current) => (current + 1) % triangleExamples.length); setChecked(false); setTriangleSideAnswer(null); setTriangleAngleAnswer(null); };
  const cycleQuadrilateral = () => { setQuadrilateralIndex((current) => (current + 1) % quadrilateralExamples.length); setChecked(false); setQuadrilateralAnswer(null); };

  const reset = () => {
    setActiveMode(defaultMode);
    setDegrees(defaultDegrees);
    setTriangleIndex(0);
    setQuadrilateralIndex(0);
    setMeasureAnswer('');
    setTriangleSideAnswer(null);
    setTriangleAngleAnswer(null);
    setQuadrilateralAnswer(null);
    setChecked(false);
  };

  const result = (() => {
    if (activeMode === 'measure') {
      if (challenge && !checked) return { symbol: '?', headline: 'Измерь угол по шкале.', detail: 'Введи число градусов и нажми «Проверить».' };
      if (challenge) return { symbol: measureCorrect ? '✓' : '×', headline: measureCorrect ? 'Точное измерение.' : 'Проверь начало отсчёта и шкалу.', detail: `Угол равен ${degrees}°; это ${ANGLE_LABELS[angleKind]} угол.` };
      return { symbol: '∠', headline: `${degrees}° — ${ANGLE_LABELS[angleKind]} угол.`, detail: 'Вершина совпадает с центром транспортира, один луч — с нулевой отметкой.' };
    }
    if (activeMode === 'build') {
      if (challenge && !checked) return { symbol: '?', headline: `Построй угол ${target}°.`, detail: `Поворачивай луч с шагом ${safeDegreeStep}°, затем проверь построение.` };
      if (challenge) return { symbol: buildCorrect ? '✓' : '×', headline: buildCorrect ? 'Луч поставлен точно.' : `Сейчас ${degrees}°, цель ${target}°.` , detail: buildCorrect ? `${target}° — ${ANGLE_LABELS[classifyAngle(target)]} угол.` : 'Продолжай поворачивать луч в нужную сторону.' };
      return { symbol: buildCorrect ? '✓' : '↻', headline: `Сейчас ${degrees}°, цель ${target}°.`, detail: buildCorrect ? 'Построение совпало с целевой линией.' : `Разница ${Math.abs(target - degrees)}°.` };
    }
    if (activeMode === 'triangle') {
      if (challenge && !checked) return { symbol: '?', headline: 'Классифицируй треугольник двумя способами.', detail: 'Отдельно сравни стороны и определи вид углов.' };
      if (challenge) return { symbol: triangleCorrect ? '✓' : '×', headline: triangleCorrect ? 'Обе классификации верны.' : 'Одна или обе классификации требуют проверки.', detail: `Это ${TRIANGLE_SIDE_LABELS[triangleFacts.sideKind]} и ${TRIANGLE_ANGLE_LABELS[triangleFacts.angleKind]} треугольник.` };
      return { symbol: '△', headline: `${TRIANGLE_SIDE_LABELS[triangleFacts.sideKind]} и ${TRIANGLE_ANGLE_LABELS[triangleFacts.angleKind]}.`, detail: 'Классификация по сторонам и по углам отвечает на разные вопросы.' };
    }
    if (challenge && !checked) return { symbol: '?', headline: 'Определи вид четырёхугольника.', detail: 'Проверь параллельность сторон и количество прямых углов.' };
    if (challenge) return { symbol: quadrilateralCorrect ? '✓' : '×', headline: quadrilateralCorrect ? 'Верно.' : 'Сверь свойства сторон и углов.', detail: `Фигура — ${QUADRILATERAL_LABELS[quadrilateralFacts.kind]}. Прямых углов: ${quadrilateralFacts.rightAngles}; пар параллельных сторон: ${quadrilateralFacts.parallelPairs}.` };
    return { symbol: '▱', headline: `Фигура — ${QUADRILATERAL_LABELS[quadrilateralFacts.kind]}.`, detail: `Прямых углов: ${quadrilateralFacts.rightAngles}; пар параллельных сторон: ${quadrilateralFacts.parallelPairs}.` };
  })();

  return (
    <section className="dm-lab dm-geometry-angle-shape not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header"><div><p className="dm-lab__eyebrow">Углы и фигуры</p><h3 className="dm-lab__title" id={`${labId}-heading`}>Измеряй, строй и классифицируй</h3><p>Чертёж даёт наблюдение, а свойства помогают назвать фигуру точно.</p></div><span className="dm-lab__badge">{challenge ? 'задача' : 'исследование'}</span></header>
      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Режим лаборатории углов и фигур">{MODES.map((item) => <button type="button" className={activeMode === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'} aria-pressed={activeMode === item} onClick={() => { setActiveMode(item); setChecked(false); }} key={item}>{MODE_LABELS[item]}</button>)}</div>

        {(activeMode === 'measure' || activeMode === 'build') && (
          <>
            {(!challenge || activeMode === 'measure' && checked) ? (
              <div className="dm-lab__controls dm-geometry-controls"><DegreeField id={`${labId}-degrees`} label="Величина угла" value={degrees} step={safeDegreeStep} onChange={setAngle} /></div>
            ) : activeMode === 'build' ? (
              <div className="dm-geometry-angle-nudges" role="group" aria-label={`Повернуть луч с шагом ${safeDegreeStep} градусов`}><button type="button" onClick={() => nudgeBuildAngle(-1)} disabled={degrees <= 1}>↶<span>меньше</span></button><button type="button" onClick={() => nudgeBuildAngle(1)} disabled={degrees >= 180}>↷<span>больше</span></button></div>
            ) : null}
            <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемая схема угла с транспортиром" tabIndex={0}><AnglePicture id={`${labId}-angle`} degrees={degrees} target={target} build={activeMode === 'build'} revealValue={revealFacts} /></div>
          </>
        )}
        {activeMode === 'triangle' && <><div className="dm-geometry-example-switch"><span>Пример {triangleIndex + 1} из {triangleExamples.length}</span><button className="dm-button dm-button--secondary" type="button" onClick={cycleTriangle}>Следующий треугольник</button></div><div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж треугольника" tabIndex={0}><PolygonPicture id={`${labId}-triangle`} points={triangle} name="triangle" revealFacts={revealFacts} rightAngles={triangleFacts.angleKind === 'right' ? 1 : 0} /></div></>}
        {activeMode === 'quadrilateral' && <><div className="dm-geometry-example-switch"><span>Пример {quadrilateralIndex + 1} из {quadrilateralExamples.length}</span><button className="dm-button dm-button--secondary" type="button" onClick={cycleQuadrilateral}>Следующий четырёхугольник</button></div><div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж четырёхугольника" tabIndex={0}><PolygonPicture id={`${labId}-quadrilateral`} points={quadrilateral} name="quadrilateral" revealFacts={revealFacts} rightAngles={quadrilateralFacts.rightAngles} /></div></>}

        {challenge && activeMode === 'measure' && (
          <div className="dm-geometry-answer"><label htmlFor={`${labId}-measure-answer`}>Моя величина угла, °</label><input id={`${labId}-measure-answer`} type="text" inputMode="decimal" value={measureAnswer} onChange={(event) => { const raw = event.target.value.slice(0, 12); if (/^\d*(?:[.,]\d*)?$/.test(raw)) { setMeasureAnswer(raw); setChecked(false); } }} onKeyDown={(event) => { if (event.key === 'Enter' && measureValue !== null) { event.preventDefault(); setChecked(true); } if (event.key === 'Escape') { event.preventDefault(); setMeasureAnswer(''); setChecked(false); } }} /><button className="dm-button" type="button" disabled={measureValue === null} onClick={() => setChecked(true)}>Проверить</button></div>
        )}
        {challenge && activeMode === 'build' && <div className="dm-geometry-challenge"><p>Цель: <strong>{target}°</strong>. Текущее число скрыто до проверки.</p><button className="dm-button" type="button" onClick={() => setChecked(true)}>Проверить построение</button></div>}
        {challenge && activeMode === 'triangle' && (
          <div className="dm-geometry-challenge-grid"><fieldset className="dm-geometry-challenge"><legend>По сторонам</legend>{(Object.keys(TRIANGLE_SIDE_LABELS) as TriangleSideKind[]).map((choice) => <label key={choice}><input type="radio" name={`${labId}-triangle-side`} checked={triangleSideAnswer === choice} onChange={() => { setTriangleSideAnswer(choice); setChecked(false); }} />{TRIANGLE_SIDE_LABELS[choice]}</label>)}</fieldset><fieldset className="dm-geometry-challenge"><legend>По углам</legend>{(Object.keys(TRIANGLE_ANGLE_LABELS) as TriangleAngleKind[]).map((choice) => <label key={choice}><input type="radio" name={`${labId}-triangle-angle`} checked={triangleAngleAnswer === choice} onChange={() => { setTriangleAngleAnswer(choice); setChecked(false); }} />{TRIANGLE_ANGLE_LABELS[choice]}</label>)}</fieldset><button className="dm-button" type="button" disabled={triangleSideAnswer === null || triangleAngleAnswer === null} onClick={() => setChecked(true)}>Проверить обе классификации</button></div>
        )}
        {challenge && activeMode === 'quadrilateral' && <fieldset className="dm-geometry-challenge"><legend>Как точнее назвать фигуру?</legend>{(Object.keys(QUADRILATERAL_LABELS) as QuadrilateralFacts['kind'][]).map((choice) => <label key={choice}><input type="radio" name={`${labId}-quadrilateral-kind`} checked={quadrilateralAnswer === choice} onChange={() => { setQuadrilateralAnswer(choice); setChecked(false); }} />{QUADRILATERAL_LABELS[choice]}</label>)}<button className="dm-button" type="button" disabled={quadrilateralAnswer === null} onClick={() => setChecked(true)}>Проверить</button></fieldset>}

        <div className="dm-result" aria-live="polite" aria-atomic="true"><span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span><p><strong>{result.headline}</strong><small>{result.detail}</small></p></div>
        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
