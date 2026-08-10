import { useEffect, useId, useMemo, useState } from 'react';
import { applyTransform, fitToBox, type FitTransform, type Point2 } from '../lib/polyhedra';
import { compareExact, parseExact } from '../lib/exactRational';
import {
  DEFAULT_ELEVATION_DEGREES,
  GENERATING_FIGURE,
  coneMetrics,
  coneOutlinePoints,
  cylinderMetrics,
  formatMeasure,
  formatNumber,
  levelEllipse,
  revolutionProfile,
  revolvePoint,
  revolveProfile,
  sphereMetrics,
  type ConeMetrics,
  type CylinderMetrics,
  type Measure,
  type ProfilePoint,
  type RevolutionKind,
  type ScreenPoint,
  type SphereMetrics,
} from '../lib/revolution';

export type RevolLabMode = 'rotate' | 'measure' | 'net';
export type RevolUnit = 'cm' | 'dm' | 'm';

export interface RevolLabProps {
  mode?: RevolLabMode;
  initialSolid?: RevolutionKind;
  initialRadius?: number;
  initialHeight?: number;
  initialAngle?: number;
  unit?: RevolUnit;
  challenge?: boolean;
}

const MODES: readonly RevolLabMode[] = ['rotate', 'measure', 'net'];
const KINDS: readonly RevolutionKind[] = ['cylinder', 'cone', 'sphere'];
const UNITS: readonly RevolUnit[] = ['cm', 'dm', 'm'];

const MODE_LABELS: Readonly<Record<RevolLabMode, string>> = {
  rotate: 'Вращение фигуры',
  measure: 'Площади и объём',
  net: 'Развёртка',
};
const KIND_LABELS: Readonly<Record<RevolutionKind, string>> = {
  cylinder: 'Цилиндр',
  cone: 'Конус',
  sphere: 'Шар',
};
const UNIT_LABELS: Readonly<Record<RevolUnit, string>> = { cm: 'см', dm: 'дм', m: 'м' };

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 420;
const VIEW_PADDING = 52;
const ELEVATION = DEFAULT_ELEVATION_DEGREES;
const ARC_STEPS = 72;
const DECIMAL_DRAFT = /^\d*(?:[.,]\d*)?$/;
const MIN_SIZE = 1;
const MAX_SIZE = 12;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function parseDecimal(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (normalized === '' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeMode(value: RevolLabMode | undefined): RevolLabMode {
  return value !== undefined && MODES.includes(value) ? value : 'rotate';
}

function safeKind(value: RevolutionKind | undefined): RevolutionKind {
  return value !== undefined && KINDS.includes(value) ? value : 'cylinder';
}

function safeUnit(value: RevolUnit | undefined): RevolUnit {
  return value !== undefined && UNITS.includes(value) ? value : 'cm';
}

function safeSize(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return round(clamp(value, MIN_SIZE, MAX_SIZE), 1);
}

function safeAngle(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 360;
  return Math.round(clamp(value, 0, 360));
}

interface SizeFieldProps {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

function SizeField({ id, label, unit, value, onChange }: SizeFieldProps) {
  const hintId = `${id}-hint`;
  const [draft, setDraft] = useState(formatNumber(value, 1));

  useEffect(() => setDraft(formatNumber(value, 1)), [value]);

  const commit = () => {
    const parsed = parseDecimal(draft);
    const next = parsed === null ? value : round(clamp(parsed, MIN_SIZE, MAX_SIZE), 1);
    setDraft(formatNumber(next, 1));
    onChange(next);
  };
  const nudge = (direction: -1 | 1) => onChange(round(clamp(value + direction * 0.5, MIN_SIZE, MAX_SIZE), 1));

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>
        {label}
        <span className="dm-field__value">{formatNumber(value, 1)} {unit}</span>
      </label>
      <div className="dm-geometry-field__control">
        <button type="button" onClick={() => nudge(-1)} disabled={value <= MIN_SIZE} aria-label={`Уменьшить: ${label.toLowerCase()}`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          aria-describedby={hintId}
          onChange={(event) => {
            const raw = event.target.value.slice(0, 8);
            if (!DECIMAL_DRAFT.test(raw)) return;
            setDraft(raw);
            const parsed = parseDecimal(raw);
            if (parsed !== null && parsed >= MIN_SIZE && parsed <= MAX_SIZE) onChange(round(parsed, 1));
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
          }}
        />
        <button type="button" onClick={() => nudge(1)} disabled={value >= MAX_SIZE} aria-label={`Увеличить: ${label.toLowerCase()}`}>+</button>
      </div>
      <small id={hintId}>От {MIN_SIZE} до {MAX_SIZE} {unit}; шаг кнопок 0,5.</small>
    </div>
  );
}

/** Экранная точка после подгонки: ось y перевёрнута под систему координат SVG. */
function place(point: ScreenPoint, transform: FitTransform): Point2 {
  return applyTransform({ x: point.x, y: -point.y }, transform);
}

function pointsAttribute(points: readonly Point2[]): string {
  return points.map((point) => `${round(point.x, 2)},${round(point.y, 2)}`).join(' ');
}

/** Дуга окружности уровня: честная выборка точек проекции. */
function levelArc(
  radius: number,
  level: number,
  fromDegrees: number,
  toDegrees: number,
  transform: FitTransform,
  steps = ARC_STEPS,
): Point2[] {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = fromDegrees + ((toDegrees - fromDegrees) * index) / steps;
    return place(revolvePoint({ r: radius, z: level }, angle, ELEVATION), transform);
  });
}

interface Scene {
  readonly transform: FitTransform;
  readonly profile: readonly ProfilePoint[];
  readonly topLevel: number;
  readonly bottomLevel: number;
}

function buildScene(kind: RevolutionKind, radius: number, height: number): Scene {
  const profile = revolutionProfile(kind, radius, kind === 'sphere' ? 2 * radius : height, 48);
  const bounds: ScreenPoint[] = [];
  for (const point of profile) {
    const ellipse = levelEllipse(point.r, point.z, ELEVATION);
    bounds.push(
      { x: ellipse.cx - ellipse.rx, y: ellipse.cy },
      { x: ellipse.cx + ellipse.rx, y: ellipse.cy },
      { x: ellipse.cx, y: ellipse.cy - ellipse.ry },
      { x: ellipse.cx, y: ellipse.cy + ellipse.ry },
    );
  }
  const transform = fitToBox(
    bounds.map((point) => ({ x: point.x, y: -point.y })),
    { width: VIEW_WIDTH, height: VIEW_HEIGHT, padding: VIEW_PADDING },
  );
  return {
    transform,
    profile,
    topLevel: Math.max(...profile.map((point) => point.z)),
    bottomLevel: Math.min(...profile.map((point) => point.z)),
  };
}

interface BodyPictureProps {
  readonly id: string;
  readonly kind: RevolutionKind;
  readonly radius: number;
  readonly height: number;
  readonly angle: number;
  readonly showSweep: boolean;
  readonly unit: string;
}

function BodyPicture({ id, kind, radius, height, angle, showSweep, unit }: BodyPictureProps) {
  const scene = useMemo(() => buildScene(kind, radius, height), [kind, radius, height]);
  const { transform, profile, topLevel, bottomLevel } = scene;
  const complete = angle >= 360;

  const axisTop = place({ x: 0, y: topLevel * Math.cos((ELEVATION * Math.PI) / 180) }, transform);
  const axisBottom = place({ x: 0, y: bottomLevel * Math.cos((ELEVATION * Math.PI) / 180) }, transform);

  // Окружности, которые заметают угловые точки образующей.
  const traced = kind === 'sphere'
    ? [{ r: radius, z: 0 }]
    : profile.filter((point) => point.r > 0);

  const fanAngles = showSweep && angle > 0
    ? Array.from({ length: 13 }, (_, index) => (angle * index) / 12)
    : [];

  const currentPolygon = pointsAttribute(revolveProfile(profile, angle % 360, ELEVATION).map((point) => place(point, transform)));
  const startPolygon = pointsAttribute(revolveProfile(profile, 0, ELEVATION).map((point) => place(point, transform)));

  const silhouette = (() => {
    if (!complete) return null;
    if (kind === 'sphere') {
      const center = place({ x: 0, y: 0 }, transform);
      return <circle className="dm-geometry-solid__outline" cx={round(center.x, 2)} cy={round(center.y, 2)} r={round(radius * transform.scale, 2)} fill="none" />;
    }
    if (kind === 'cylinder') {
      const left = [
        place(revolvePoint({ r: radius, z: 0 }, -90, ELEVATION), transform),
        place(revolvePoint({ r: radius, z: height }, -90, ELEVATION), transform),
      ];
      const right = [
        place(revolvePoint({ r: radius, z: 0 }, 90, ELEVATION), transform),
        place(revolvePoint({ r: radius, z: height }, 90, ELEVATION), transform),
      ];
      return (
        <g className="dm-geometry-solid__outline">
          <line x1={left[0]!.x} y1={left[0]!.y} x2={left[1]!.x} y2={left[1]!.y} />
          <line x1={right[0]!.x} y1={right[0]!.y} x2={right[1]!.x} y2={right[1]!.y} />
        </g>
      );
    }
    const apex = place(revolvePoint({ r: 0, z: height }, 0, ELEVATION), transform);
    const touches = coneOutlinePoints(radius, height, ELEVATION);
    const feet = (touches.length === 2 ? touches : [
      revolvePoint({ r: radius, z: 0 }, 90, ELEVATION),
      revolvePoint({ r: radius, z: 0 }, -90, ELEVATION),
    ]).map((point) => place(point, transform));
    return (
      <g className="dm-geometry-solid__outline">
        {feet.map((foot, index) => (
          <line key={index} x1={apex.x} y1={apex.y} x2={foot.x} y2={foot.y} />
        ))}
      </g>
    );
  })();

  const description = complete
    ? `Полный оборот образующей даёт тело: ${KIND_LABELS[kind].toLowerCase()}. Радиус ${formatNumber(radius, 1)} ${unit}${kind === 'sphere' ? '' : `, высота ${formatNumber(height, 1)} ${unit}`}. Окружность каждого уровня изображена эллипсом: параллельная проекция сжимает её по вертикали в sin 20° раз, поэтому измерять эллипс линейкой нельзя.`
    : `Образующая фигура (${GENERATING_FIGURE[kind]}) повёрнута на ${Math.round(angle)}°. Тонкие линии — уже пройденные положения образующей, дуги — следы её угловых точек.`;

  return (
    <svg
      className="dm-geometry-solid"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>{complete ? `Тело вращения: ${KIND_LABELS[kind].toLowerCase()}` : `Поворот образующей на ${Math.round(angle)}°`}</title>
      <desc id={`${id}-desc`}>{description}</desc>

      <g className="dm-geometry-figure__construction" aria-hidden="true">
        <line x1={axisTop.x} y1={axisTop.y - 18} x2={axisBottom.x} y2={axisBottom.y + 18} />
      </g>

      {showSweep && fanAngles.length > 0 && (
        <g className="dm-geometry-solid__hidden" aria-hidden="true">
          {fanAngles.map((value) => (
            <polyline
              key={value}
              fill="none"
              points={pointsAttribute(revolveProfile(profile, value, ELEVATION).map((point) => place(point, transform)))}
            />
          ))}
        </g>
      )}

      <g className="dm-geometry-solid__body">
        {traced.map((point) => (
          <polyline
            key={`${point.r}-${point.z}`}
            fill="none"
            points={pointsAttribute(levelArc(point.r, point.z, 90, 90 + Math.min(angle, 360), transform))}
          />
        ))}
        {complete && traced.map((point) => (
          <polyline
            key={`back-${point.r}-${point.z}`}
            className="dm-geometry-solid__hidden"
            fill="none"
            points={pointsAttribute(levelArc(point.r, point.z, 90, 270, transform))}
          />
        ))}
        {silhouette}
      </g>

      <g className="dm-geometry-solid__front" aria-hidden="true">
        <polygon points={currentPolygon} />
      </g>
      <g className="dm-geometry-figure__shape" aria-hidden="true">
        <polygon points={startPolygon} fill="none" />
      </g>
    </svg>
  );
}

interface NetPictureProps {
  readonly id: string;
  readonly kind: RevolutionKind;
  readonly radius: number;
  readonly height: number;
  readonly sectorAngle: number;
  readonly slant: number;
  readonly unit: string;
}

function NetPicture({ id, kind, radius, height, sectorAngle, slant, unit }: NetPictureProps) {
  const circumference = 2 * Math.PI * radius;

  const scene = useMemo(() => {
    const points: Point2[] = [];
    if (kind === 'cylinder') {
      points.push(
        { x: 0, y: 0 }, { x: circumference, y: 0 }, { x: circumference, y: height },
        { x: 0, y: height },
        { x: circumference / 2 - radius, y: -2 * radius }, { x: circumference / 2 + radius, y: -2 * radius },
        { x: circumference / 2 - radius, y: height + 2 * radius }, { x: circumference / 2 + radius, y: height + 2 * radius },
      );
    } else if (kind === 'cone') {
      const start = 90 - sectorAngle / 2;
      for (let index = 0; index <= 48; index += 1) {
        const angle = ((start + (sectorAngle * index) / 48) * Math.PI) / 180;
        points.push({ x: slant * Math.cos(angle), y: slant * Math.sin(angle) });
      }
      points.push({ x: 0, y: 0 }, { x: -radius, y: slant + 2 * radius }, { x: radius, y: slant + 2 * radius });
    } else {
      points.push({ x: -radius, y: -radius }, { x: radius, y: radius });
      for (let index = 0; index < 4; index += 1) {
        const cx = 2.6 * radius + 2.2 * radius * (index % 2);
        const cy = (index < 2 ? -1.1 : 1.1) * radius;
        points.push({ x: cx - radius, y: cy - radius }, { x: cx + radius, y: cy + radius });
      }
    }
    return fitToBox(points, { width: VIEW_WIDTH, height: VIEW_HEIGHT, padding: VIEW_PADDING });
  }, [circumference, height, kind, radius, sectorAngle, slant]);

  const to = (point: Point2) => applyTransform(point, scene);
  const scale = scene.scale;

  const description = kind === 'cylinder'
    ? `Развёртка цилиндра: прямоугольник шириной 2πr ≈ ${formatNumber(circumference, 2)} ${unit} и высотой ${formatNumber(height, 1)} ${unit}, а также два круга радиуса ${formatNumber(radius, 1)} ${unit}. Пропорции на рисунке настоящие.`
    : kind === 'cone'
      ? `Развёртка конуса: круговой сектор радиуса l = ${formatNumber(slant, 2)} ${unit} с углом ${formatNumber(sectorAngle, 1)}° и круг основания радиуса ${formatNumber(radius, 1)} ${unit}. Угол сектора вычислен как 360°·r/l, поэтому длина дуги равна длине окружности основания.`
      : `У сферы развёртки на плоскость не существует. Зато её площадь равна площади ровно четырёх больших кругов: 4πR².`;

  if (kind === 'cylinder') {
    const topLeft = to({ x: 0, y: 0 });
    const bottomRight = to({ x: circumference, y: height });
    const upperCircle = to({ x: circumference / 2, y: -radius });
    const lowerCircle = to({ x: circumference / 2, y: height + radius });
    return (
      <svg className="dm-geometry-solid" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Развёртка цилиндра</title>
        <desc id={`${id}-desc`}>{description}</desc>
        <g className="dm-geometry-solid__body">
          <rect
            className="dm-geometry-solid__side"
            x={round(topLeft.x, 2)}
            y={round(topLeft.y, 2)}
            width={round(bottomRight.x - topLeft.x, 2)}
            height={round(bottomRight.y - topLeft.y, 2)}
          />
          <circle className="dm-geometry-solid__top" cx={round(upperCircle.x, 2)} cy={round(upperCircle.y, 2)} r={round(radius * scale, 2)} />
          <circle className="dm-geometry-solid__top" cx={round(lowerCircle.x, 2)} cy={round(lowerCircle.y, 2)} r={round(radius * scale, 2)} />
        </g>
        <g className="dm-geometry-solid__dimensions">
          <text x={round((topLeft.x + bottomRight.x) / 2 - 46, 1)} y={round(bottomRight.y + 26, 1)}>2πr ≈ {formatNumber(circumference, 2)} {unit}</text>
          <text x={round(bottomRight.x + 8, 1)} y={round((topLeft.y + bottomRight.y) / 2, 1)}>h = {formatNumber(height, 1)} {unit}</text>
        </g>
      </svg>
    );
  }

  if (kind === 'cone') {
    const apex = to({ x: 0, y: 0 });
    const start = ((90 - sectorAngle / 2) * Math.PI) / 180;
    const end = ((90 + sectorAngle / 2) * Math.PI) / 180;
    const from = to({ x: slant * Math.cos(start), y: slant * Math.sin(start) });
    const till = to({ x: slant * Math.cos(end), y: slant * Math.sin(end) });
    const arcRadius = round(slant * scale, 2);
    const largeArc = sectorAngle > 180 ? 1 : 0;
    const baseCircle = to({ x: 0, y: slant + radius });
    return (
      <svg className="dm-geometry-solid" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Развёртка конуса</title>
        <desc id={`${id}-desc`}>{description}</desc>
        <g className="dm-geometry-solid__body">
          <path
            className="dm-geometry-solid__side"
            d={`M${round(apex.x, 2)} ${round(apex.y, 2)} L${round(from.x, 2)} ${round(from.y, 2)} A${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${round(till.x, 2)} ${round(till.y, 2)} Z`}
          />
          <circle className="dm-geometry-solid__top" cx={round(baseCircle.x, 2)} cy={round(baseCircle.y, 2)} r={round(radius * scale, 2)} />
        </g>
        <g className="dm-geometry-solid__dimensions">
          <text x={round(apex.x + 10, 1)} y={round(apex.y - 10, 1)}>φ = {formatNumber(sectorAngle, 1)}°</text>
          <text x={round(from.x - 92, 1)} y={round((apex.y + from.y) / 2, 1)}>l = {formatNumber(slant, 2)} {unit}</text>
        </g>
      </svg>
    );
  }

  const center = to({ x: 0, y: 0 });
  const equator = levelEllipse(radius, 0, ELEVATION);
  return (
    <svg className="dm-geometry-solid" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Сфера и четыре больших круга</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <g className="dm-geometry-solid__round">
        <circle cx={round(center.x, 2)} cy={round(center.y, 2)} r={round(radius * scale, 2)} />
        <ellipse
          className="dm-geometry-solid__hidden"
          cx={round(center.x, 2)}
          cy={round(center.y, 2)}
          rx={round(equator.rx * scale, 2)}
          ry={round(equator.ry * scale, 2)}
        />
      </g>
      <g className="dm-geometry-solid__body">
        {Array.from({ length: 4 }, (_, index) => {
          const point = to({ x: 2.6 * radius + 2.2 * radius * (index % 2), y: (index < 2 ? -1.1 : 1.1) * radius });
          return <circle key={index} className="dm-geometry-solid__top" cx={round(point.x, 2)} cy={round(point.y, 2)} r={round(radius * scale, 2)} />;
        })}
      </g>
      <g className="dm-geometry-solid__dimensions">
        <text x={round(center.x - 30, 1)} y={round(center.y + radius * scale + 28, 1)}>S = 4πR²</text>
      </g>
    </svg>
  );
}

export default function RevolLab({
  mode,
  initialSolid,
  initialRadius,
  initialHeight,
  initialAngle,
  unit,
  challenge = false,
}: RevolLabProps) {
  const reactId = useId();
  const labId = `revol-lab-${reactId.replace(/:/g, '')}`;
  const defaultMode = safeMode(mode);
  const defaultKind = safeKind(initialSolid);
  const defaultRadius = safeSize(initialRadius, 3);
  const defaultHeight = safeSize(initialHeight, 4);
  const defaultAngle = safeAngle(initialAngle);
  const unitKey = safeUnit(unit);
  const unitLabel = UNIT_LABELS[unitKey];

  const [activeMode, setActiveMode] = useState(defaultMode);
  const [kind, setKind] = useState(defaultKind);
  const [radius, setRadius] = useState(defaultRadius);
  const [height, setHeight] = useState(defaultHeight);
  const [angle, setAngle] = useState(defaultAngle);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const metrics = useMemo(() => {
    if (kind === 'cylinder') return cylinderMetrics(radius, height) as CylinderMetrics;
    if (kind === 'cone') return coneMetrics(radius, height) as ConeMetrics;
    return sphereMetrics(radius) as SphereMetrics;
  }, [height, kind, radius]);

  const volume: Measure = metrics.volume;
  const totalArea: Measure = metrics.kind === 'sphere' ? metrics.surfaceArea : metrics.totalArea;
  const lateralArea: Measure | null = metrics.kind === 'sphere' ? null : metrics.lateralArea;
  const baseArea: Measure | null = metrics.kind === 'sphere' ? null : metrics.baseArea;

  const parsedAnswer = (() => {
    const normalized = answer.trim().replace(',', '.');
    if (normalized === '' || normalized === '.') return null;
    try { return parseExact(normalized); } catch { return null; }
  })();
  const answerCorrect = parsedAnswer !== null
    && volume.exact !== null
    && compareExact(parsedAnswer, volume.exact.coefficient) === 0;
  const reveal = !challenge || checked;

  const invalidate = () => setChecked(false);
  const reset = () => {
    setActiveMode(defaultMode);
    setKind(defaultKind);
    setRadius(defaultRadius);
    setHeight(defaultHeight);
    setAngle(defaultAngle);
    setAnswer('');
    setChecked(false);
  };

  const slant = metrics.kind === 'cone' ? metrics.slant.value : 0;
  const sectorAngle = metrics.kind === 'cone' ? metrics.net.sectorAngleDegrees.value : 0;

  const badge = activeMode === 'net' ? 'развёртка' : activeMode === 'measure' ? `${unitLabel}³` : `${Math.round(angle)}°`;

  const result = (() => {
    if (activeMode === 'rotate') {
      if (angle < 360) {
        return {
          symbol: '↻',
          headline: `Повёрнуто на ${Math.round(angle)}° из 360°.`,
          detail: `Вращаем ${GENERATING_FIGURE[kind]}. Пока оборот не полный, тела ещё нет — есть только след образующей.`,
        };
      }
      return {
        symbol: '◍',
        headline: `Полный оборот даёт: ${KIND_LABELS[kind].toLowerCase()}.`,
        detail: `${GENERATING_FIGURE[kind]} — образующая фигура. Ось вращения проходит через центр тела; любое сечение, перпендикулярное оси, — круг.`,
      };
    }
    if (activeMode === 'net') {
      if (kind === 'cylinder') {
        return {
          symbol: '▭',
          headline: `Боковая поверхность разворачивается в прямоугольник 2πr × h.`,
          detail: `2πr = ${formatMeasure(metrics.kind === 'cylinder' ? metrics.net.rectangleWidth : volume)} ${unitLabel}, высота ${formatNumber(height, 1)} ${unitLabel}. Площадь прямоугольника и есть S_бок.`,
        };
      }
      if (kind === 'cone') {
        return {
          symbol: '◔',
          headline: `Сектор с углом φ = 360°·r/l = ${formatNumber(sectorAngle, 1)}°.`,
          detail: `Радиус сектора равен образующей l = ${formatMeasure(metrics.kind === 'cone' ? metrics.slant : volume)} ${unitLabel}. Дуга сектора равна окружности основания, поэтому φ зависит только от отношения r к l.`,
        };
      }
      return {
        symbol: '⊘',
        headline: 'У сферы развёртки нет.',
        detail: 'Сферу нельзя разложить на плоскость без разрывов и растяжений — именно поэтому карты мира искажают площади. Но площадь сферы ровно вчетверо больше площади большого круга.',
      };
    }
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: 'Найди объём и введи множитель при π.',
        detail: kind === 'cylinder'
          ? 'V = πr²h. Введи число k, если V = kπ.'
          : kind === 'cone'
            ? 'V = ⅓πr²h. Введи число k, если V = kπ.'
            : 'V = 4⁄3·πR³. Введи число k, если V = kπ.',
      };
    }
    return {
      symbol: challenge ? (answerCorrect ? '✓' : '×') : '∑',
      headline: `V = ${formatMeasure(volume)} ${unitLabel}³.`,
      detail: `S = ${formatMeasure(totalArea)} ${unitLabel}². Точная запись хранит π, приближение округлено до сотых.`,
    };
  })();

  return (
    <section className="dm-lab dm-geometry-solid-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория тел вращения</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Плоская фигура вращается — получается тело</h3>
          <p>Крути образующую, меняй размеры и смотри, как из прямоугольника, треугольника и полукруга получаются цилиндр, конус и шар. Контуры вычисляются честной параллельной проекцией.</p>
        </div>
        <span className="dm-lab__badge">{badge}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Режим лаборатории тел вращения">
          {MODES.map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={activeMode === item}
              className={activeMode === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
              onClick={() => { setActiveMode(item); setChecked(false); setAnswer(''); }}
            >{MODE_LABELS[item]}</button>
          ))}
        </div>

        <div className="dm-geometry-preset-buttons" role="group" aria-label="Тело вращения">
          {KINDS.map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={kind === item}
              className={kind === item ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'}
              onClick={() => { setKind(item); invalidate(); }}
            >{KIND_LABELS[item]}</button>
          ))}
        </div>

        <div className="dm-lab__controls dm-geometry-controls">
          <SizeField
            id={`${labId}-radius`}
            label={kind === 'sphere' ? 'Радиус шара R' : 'Радиус основания r'}
            unit={unitLabel}
            value={radius}
            onChange={(value) => { setRadius(value); invalidate(); }}
          />
          {kind !== 'sphere' && (
            <SizeField
              id={`${labId}-height`}
              label="Высота h"
              unit={unitLabel}
              value={height}
              onChange={(value) => { setHeight(value); invalidate(); }}
            />
          )}
        </div>

        {activeMode === 'rotate' && (
          <div className="dm-field">
            <label htmlFor={`${labId}-angle`}>
              Угол поворота образующей
              <span className="dm-field__value">{Math.round(angle)}°</span>
            </label>
            <input
              id={`${labId}-angle`}
              type="range"
              min={0}
              max={360}
              step={5}
              value={angle}
              onChange={(event) => setAngle(Number(event.target.value))}
              aria-describedby={`${labId}-angle-hint`}
            />
            <small id={`${labId}-angle-hint`}>Стрелки меняют угол на 5°; полный оборот — 360°.</small>
          </div>
        )}

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж тела вращения" tabIndex={0}>
          {activeMode === 'net' ? (
            <NetPicture
              id={`${labId}-net`}
              kind={kind}
              radius={radius}
              height={height}
              sectorAngle={sectorAngle}
              slant={slant}
              unit={unitLabel}
            />
          ) : (
            <BodyPicture
              id={`${labId}-body`}
              kind={kind}
              radius={radius}
              height={height}
              angle={activeMode === 'rotate' ? angle : 360}
              showSweep={activeMode === 'rotate'}
              unit={unitLabel}
            />
          )}
        </div>

        {activeMode === 'measure' && reveal && (
          <div className="dm-table-wrap">
            <table className="dm-ratio-table">
              <caption>Точная запись и приближение, {unitLabel}</caption>
              <tbody>
                {baseArea !== null && (
                  <tr><th scope="row">Площадь основания, {unitLabel}²</th><td>{formatMeasure(baseArea)}</td></tr>
                )}
                {lateralArea !== null && (
                  <tr><th scope="row">Боковая поверхность, {unitLabel}²</th><td>{formatMeasure(lateralArea)}</td></tr>
                )}
                {metrics.kind === 'cone' && (
                  <tr><th scope="row">Образующая l, {unitLabel}</th><td>{formatMeasure(metrics.slant)}</td></tr>
                )}
                <tr><th scope="row">{metrics.kind === 'sphere' ? 'Площадь сферы' : 'Полная поверхность'}, {unitLabel}²</th><td>{formatMeasure(totalArea)}</td></tr>
                <tr><th scope="row">Осевое сечение</th><td>{metrics.axialSection.shape}, площадь {formatMeasure(metrics.axialSection.area)} {unitLabel}²</td></tr>
                <tr className="dm-ratio-table__answer"><th scope="row">Объём, {unitLabel}³</th><td>{formatMeasure(volume)}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        {challenge && activeMode === 'measure' && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>Множитель k, если V = kπ</label>
            <input
              id={`${labId}-answer`}
              type="text"
              inputMode="decimal"
              value={answer}
              onChange={(event) => {
                const raw = event.target.value.slice(0, 16);
                if (!/^\d*(?:[.,]\d*)?(?:\s*\/\s*\d*)?$/.test(raw)) return;
                setAnswer(raw);
                setChecked(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && parsedAnswer !== null) { event.preventDefault(); setChecked(true); }
                if (event.key === 'Escape') { event.preventDefault(); setAnswer(''); setChecked(false); }
              }}
            />
            <button className="dm-button" type="button" disabled={parsedAnswer === null} onClick={() => setChecked(true)}>Проверить</button>
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
