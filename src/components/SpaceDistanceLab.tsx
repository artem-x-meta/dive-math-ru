import { useId, useMemo, useState } from 'react';
import {
  DEFAULT_VIEW,
  type Point3,
  type ScreenPoint,
  type Vec3,
  type ViewAngles,
  addVec3,
  formatNumber,
  point3,
  projectAxonometric,
  scaleVec3,
  slantAngleDegrees,
  slantLength,
  unitVec3,
  vec3,
} from '../lib/stereometry';

export type SpaceDistanceMode = 'slant' | 'three-perpendiculars';

export interface SpaceDistanceLabProps {
  mode?: SpaceDistanceMode;
  /** Длина перпендикуляра MH. */
  initialHeight?: number;
  /** Длина проекции HA. */
  initialProjection?: number;
  unitLabel?: string;
  /** Режим задачи: длина наклонной не показывается до нажатия «Проверить». */
  challenge?: boolean;
}

const WIDTH = 720;
const HEIGHT = 440;
const PADDING = 66;
const MODES: readonly SpaceDistanceMode[] = ['slant', 'three-perpendiculars'];
const MODE_LABELS: Readonly<Record<SpaceDistanceMode, string>> = {
  slant: 'Перпендикуляр и наклонная',
  'three-perpendiculars': 'Три перпендикуляра',
};
const HEIGHT_RANGE = { minimum: 1, maximum: 12, step: 0.5 };
const PROJECTION_RANGE = { minimum: 1, maximum: 12, step: 0.5 };
const VIEW: ViewAngles = DEFAULT_VIEW;

function safeMode(value: SpaceDistanceMode | undefined): SpaceDistanceMode {
  return value !== undefined && MODES.includes(value) ? value : 'slant';
}

function clampToRange(value: number, range: { minimum: number; maximum: number; step: number }, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const snapped = Math.round(value / range.step) * range.step;
  return Math.max(range.minimum, Math.min(range.maximum, Number(snapped.toFixed(2))));
}

function parseAnswer(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.').replace('−', '-');
  if (normalized.length === 0 || normalized.length > 24) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export default function SpaceDistanceLab({
  mode,
  initialHeight,
  initialProjection,
  unitLabel = 'см',
  challenge = false,
}: SpaceDistanceLabProps) {
  const reactId = useId();
  const labId = `space-distance-${reactId.replace(/:/g, '')}`;
  const defaultMode = safeMode(mode);
  const defaultHeight = clampToRange(initialHeight ?? 3, HEIGHT_RANGE, 3);
  const defaultProjection = clampToRange(initialProjection ?? 4, PROJECTION_RANGE, 4);

  const [activeMode, setActiveMode] = useState<SpaceDistanceMode>(defaultMode);
  const [height, setHeight] = useState(defaultHeight);
  const [projection, setProjection] = useState(defaultProjection);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const slant = slantLength(height, projection);
  const angle = slantAngleDegrees(height, projection);
  const parsedAnswer = parseAnswer(answer);
  const answerCorrect = parsedAnswer !== null && Math.abs(parsedAnswer - slant) <= 0.011;
  const reveal = !challenge || checked;

  const scene = useMemo(() => {
    const span = Math.max(projection, height, 4);
    const foot: Point3 = point3(0, 0, 0);
    const apex: Point3 = point3(0, 0, height);
    const base: Point3 = point3(projection, 0, 0);
    const along = vec3(0, 1, 0);
    const armInPlane = 0.75 * span;
    const corners: readonly Point3[] = [
      point3(-0.55 * span, -0.95 * span, 0),
      point3(1.35 * span, -0.95 * span, 0),
      point3(1.35 * span, 0.95 * span, 0),
      point3(-0.55 * span, 0.95 * span, 0),
    ];
    const lineEnds: readonly Point3[] = [
      addVec3(base, scaleVec3(-armInPlane, along)),
      addVec3(base, scaleVec3(armInPlane, along)),
    ];
    const markArm = 0.16 * span;
    const all = [...corners, foot, apex, base, ...lineEnds];
    const flat = all.map((point) => projectAxonometric(point, VIEW));
    const minX = Math.min(...flat.map((point) => point.x));
    const maxX = Math.max(...flat.map((point) => point.x));
    const minY = Math.min(...flat.map((point) => point.y));
    const maxY = Math.max(...flat.map((point) => point.y));
    const scale = Math.min(
      (WIDTH - 2 * PADDING) / Math.max(maxX - minX, 1e-6),
      (HEIGHT - 2 * PADDING) / Math.max(maxY - minY, 1e-6),
    );
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const screen = (point: Point3): ScreenPoint => {
      const flatPoint = projectAxonometric(point, VIEW);
      return {
        x: WIDTH / 2 + (flatPoint.x - centerX) * scale,
        y: HEIGHT / 2 - (flatPoint.y - centerY) * scale,
      };
    };
    /** Метка прямого угла — проекция настоящего квадратика, построенного в пространстве. */
    const rightAngle = (vertex: Point3, first: Vec3, second: Vec3): string => {
      const u = scaleVec3(markArm, unitVec3(first));
      const v = scaleVec3(markArm, unitVec3(second));
      const p1 = screen(addVec3(vertex, u));
      const p2 = screen(addVec3(addVec3(vertex, u), v));
      const p3 = screen(addVec3(vertex, v));
      return `M${p1.x} ${p1.y} L${p2.x} ${p2.y} L${p3.x} ${p3.y}`;
    };
    const segment = (from: Point3, to: Point3): string => {
      const start = screen(from);
      const end = screen(to);
      return `M${start.x} ${start.y} L${end.x} ${end.y}`;
    };
    return { foot, apex, base, along, corners, lineEnds, screen, rightAngle, segment };
  }, [height, projection]);

  const { foot, apex, base, along, corners, lineEnds, screen, rightAngle, segment } = scene;
  const footScreen = screen(foot);
  const apexScreen = screen(apex);
  const baseScreen = screen(base);
  const showLine = activeMode === 'three-perpendiculars';

  const labelAt = (from: ScreenPoint, to: ScreenPoint, shift: number): ScreenPoint => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const norm = Math.hypot(dx, dy) || 1;
    return { x: (from.x + to.x) / 2 - (dy / norm) * shift, y: (from.y + to.y) / 2 + (dx / norm) * shift + 5 };
  };

  const reset = () => {
    setActiveMode(defaultMode);
    setHeight(defaultHeight);
    setProjection(defaultProjection);
    setAnswer('');
    setChecked(false);
  };

  const result = (() => {
    if (showLine) {
      return {
        symbol: '⊥',
        headline: 'Прямая a перпендикулярна и проекции HA, и наклонной MA.',
        detail: `Она лежит в плоскости и перпендикулярна проекции, поэтому по теореме о трёх перпендикулярах она перпендикулярна наклонной. Проверь: меняй MH = ${formatNumber(height, 2)} ${unitLabel} и HA = ${formatNumber(projection, 2)} ${unitLabel} — оба прямых угла сохраняются.`,
      };
    }
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: `MH = ${formatNumber(height, 2)} ${unitLabel}, HA = ${formatNumber(projection, 2)} ${unitLabel}.`,
        detail: 'Найди длину наклонной MA и запиши ответ с точностью до 0,01.',
      };
    }
    if (challenge) {
      return {
        symbol: answerCorrect ? '✓' : '×',
        headline: answerCorrect ? 'Наклонная найдена верно.' : 'Проверь теорему Пифагора в треугольнике MHA.',
        detail: `MA² = MH² + HA² = ${formatNumber(height * height, 2)} + ${formatNumber(projection * projection, 2)} = ${formatNumber(slant * slant, 2)}, поэтому MA = ${formatNumber(slant, 2)} ${unitLabel}. Угол наклонной с плоскостью ${formatNumber(angle, 1)}°.`,
      };
    }
    return {
      symbol: '△',
      headline: `MA = ${formatNumber(slant, 2)} ${unitLabel}, угол с плоскостью ${formatNumber(angle, 1)}°.`,
      detail: `Треугольник MHA прямоугольный: MA² = ${formatNumber(height, 2)}² + ${formatNumber(projection, 2)}² = ${formatNumber(slant * slant, 2)}. Расстояние от M до плоскости равно перпендикуляру MH = ${formatNumber(height, 2)} ${unitLabel}, а не наклонной.`,
    };
  })();

  const description = `Плоскость α, перпендикуляр MH длиной ${formatNumber(height, 2)} ${unitLabel}, проекция HA длиной ${formatNumber(projection, 2)} ${unitLabel} и наклонная MA${showLine ? `, а также прямая a плоскости, проходящая через A перпендикулярно HA` : ''}.`;

  return (
    <section className="dm-lab dm-geometry-solid-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория пространства</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Перпендикуляр, наклонная и проекция</h3>
          <p>Из точки M к плоскости проведены перпендикуляр MH и наклонная MA. Отрезок HA — проекция наклонной.</p>
        </div>
        <span className="dm-lab__badge">MA² = MH² + HA²</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Режим лаборатории">
          {MODES.map((item) => (
            <button
              type="button"
              key={item}
              className={activeMode === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
              aria-pressed={activeMode === item}
              onClick={() => { setActiveMode(item); setChecked(false); }}
            >{MODE_LABELS[item]}</button>
          ))}
        </div>

        <div className="dm-lab__controls dm-geometry-controls">
          <div className="dm-field">
            <label htmlFor={`${labId}-height`}>Перпендикуляр MH <span className="dm-field__value">{formatNumber(height, 2)} {unitLabel}</span></label>
            <input
              id={`${labId}-height`}
              type="range"
              min={HEIGHT_RANGE.minimum}
              max={HEIGHT_RANGE.maximum}
              step={HEIGHT_RANGE.step}
              value={height}
              aria-valuetext={`${formatNumber(height, 2)} ${unitLabel}`}
              onChange={(event) => { setHeight(clampToRange(Number(event.target.value), HEIGHT_RANGE, defaultHeight)); setChecked(false); }}
            />
          </div>
          <div className="dm-field">
            <label htmlFor={`${labId}-projection`}>Проекция HA <span className="dm-field__value">{formatNumber(projection, 2)} {unitLabel}</span></label>
            <input
              id={`${labId}-projection`}
              type="range"
              min={PROJECTION_RANGE.minimum}
              max={PROJECTION_RANGE.maximum}
              step={PROJECTION_RANGE.step}
              value={projection}
              aria-valuetext={`${formatNumber(projection, 2)} ${unitLabel}`}
              onChange={(event) => { setProjection(clampToRange(Number(event.target.value), PROJECTION_RANGE, defaultProjection)); setChecked(false); }}
            />
          </div>
        </div>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж в пространстве" tabIndex={0}>
          <svg className="dm-geometry-grid" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${labId}-title ${labId}-desc`}>
            <title id={`${labId}-title`}>Перпендикуляр, наклонная и её проекция</title>
            <desc id={`${labId}-desc`}>{description}</desc>
            <rect className="dm-geometry-grid__background" x="0" y="0" width={WIDTH} height={HEIGHT} rx="18" />
            <g aria-hidden="true">
              <polygon className="dm-geometry-solid__top" points={corners.map((corner) => { const p = screen(corner); return `${p.x},${p.y}`; }).join(' ')} />
              <g className="dm-geometry-solid__body" fill="none">
                <path d={`${corners.map((corner, index) => { const p = screen(corner); return `${index === 0 ? 'M' : 'L'}${p.x} ${p.y}`; }).join(' ')} Z`} />
                {showLine && <path d={segment(lineEnds[0]!, lineEnds[1]!)} />}
              </g>
              <g className="dm-geometry-grid__perpendicular">
                <path d={segment(foot, base)} />
              </g>
              <path className="dm-geometry-grid__route" d={segment(foot, apex)} />
              <path className="dm-geometry-angle__arc" d={segment(base, apex)} />
              <path className="dm-geometry-static__right-angle" d={rightAngle(foot, vec3(0, 0, 1), vec3(1, 0, 0))} />
              {showLine && <path className="dm-geometry-static__right-angle" d={rightAngle(base, vec3(-1, 0, 0), along)} />}
              {showLine && <path className="dm-geometry-static__right-angle" d={rightAngle(base, vec3(-projection, 0, height), along)} />}
            </g>
            <g className="dm-geometry-figure__dimensions" aria-hidden="true">
              <text x={labelAt(footScreen, apexScreen, 26).x} y={labelAt(footScreen, apexScreen, 26).y}>{formatNumber(height, 2)}</text>
              <text x={labelAt(footScreen, baseScreen, 24).x} y={labelAt(footScreen, baseScreen, 24).y}>{formatNumber(projection, 2)}</text>
              {reveal && <text x={labelAt(apexScreen, baseScreen, -26).x} y={labelAt(apexScreen, baseScreen, -26).y}>{formatNumber(slant, 2)}</text>}
            </g>
            <g className="dm-geometry-grid__point" aria-hidden="true">
              <circle cx={apexScreen.x} cy={apexScreen.y} r="6" />
              <text x={apexScreen.x} y={apexScreen.y - 16} textAnchor="middle">M</text>
              <circle cx={footScreen.x} cy={footScreen.y} r="6" />
              <text x={footScreen.x - 18} y={footScreen.y + 24} textAnchor="middle">H</text>
              <circle cx={baseScreen.x} cy={baseScreen.y} r="6" />
              <text x={baseScreen.x + 18} y={baseScreen.y + 24} textAnchor="middle">A</text>
              {showLine && <text x={screen(lineEnds[1]!).x + 14} y={screen(lineEnds[1]!).y + 6} textAnchor="middle">a</text>}
              <text x={screen(corners[3]!).x + 26} y={screen(corners[3]!).y + 22} textAnchor="middle">α</text>
            </g>
          </svg>
        </div>

        {challenge && activeMode === 'slant' && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>Моя наклонная MA, {unitLabel}</label>
            <input
              id={`${labId}-answer`}
              type="text"
              inputMode="decimal"
              value={answer}
              onChange={(event) => { setAnswer(event.target.value.slice(0, 24)); setChecked(false); }}
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
