import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  formatRussianNumber,
  fromHalfTicks,
  isHalfStepGridValue,
  isHalfStepNumber,
  normalizeHalfStepRange,
  parseSignedDraft,
  quadrantOf,
  quantizeHalfStep,
  reflectPoint,
  toHalfTicks,
  translatePoint,
  type CoordinatePoint,
  type Quadrant,
} from '../lib/signedNumbers';

export type CoordinatePlaneMode = 'point' | 'reflections' | 'route';

export interface CoordinateStep {
  readonly dx: number;
  readonly dy: number;
  readonly label?: string;
}

export interface CoordinatePlaneLabProps {
  mode?: CoordinatePlaneMode;
  initialX?: number;
  initialY?: number;
  min?: number;
  max?: number;
  step?: number;
  route?: readonly CoordinateStep[];
}

interface LabRange {
  minimum: number;
  maximum: number;
  step: number;
}

const HARD_MINIMUM = -30;
const HARD_MAXIMUM = 30;
const MAX_ROUTE_STEPS = 12;
const DEFAULT_ROUTE: readonly CoordinateStep[] = [
  { dx: 3, dy: 0, label: 'Вправо' },
  { dx: 0, dy: 2, label: 'Вверх' },
  { dx: -4, dy: -1, label: 'Назад по диагонали' },
] as const;

const MODE_LABELS: Readonly<Record<CoordinatePlaneMode, string>> = {
  point: 'Координаты точки',
  reflections: 'Отражения',
  route: 'Маршрут',
};

function safeHalf(value: number | undefined, fallback: number): number {
  return value !== undefined && isHalfStepNumber(value) ? value : fallback;
}

function makeRange(minimum: number | undefined, maximum: number | undefined, requestedStep: number | undefined): LabRange {
  return normalizeHalfStepRange(minimum, maximum, requestedStep, {
    defaultMinimum: -6,
    defaultMaximum: 6,
    hardMinimum: HARD_MINIMUM,
    hardMaximum: HARD_MAXIMUM,
    includeValuesAroundZero: true,
  });
}

function safeValue(value: number | undefined, fallback: number, range: LabRange): number {
  const candidate = safeHalf(value, fallback);
  return Math.max(range.minimum, Math.min(range.maximum, quantizeHalfStep(candidate, range.step)));
}

function inputText(value: number): string {
  return String(value).replace('.', ',');
}

function pointText(point: CoordinatePoint): string {
  return `(${formatRussianNumber(point.x)}; ${formatRussianNumber(point.y)})`;
}

interface CoordinateFieldProps {
  id: string;
  label: string;
  value: number;
  range: LabRange;
  onChange: (value: number) => void;
}

function CoordinateField({ id, label, value, range, onChange }: CoordinateFieldProps) {
  const [draft, setDraft] = useState(inputText(value));
  const [isEditing, setIsEditing] = useState(false);
  const cancelCommit = useRef(false);
  const stepTicks = toHalfTicks(range.step);

  useEffect(() => {
    if (!isEditing) setDraft(inputText(value));
  }, [isEditing, value]);

  const edit = (rawValue: string) => {
    setDraft(rawValue);
    const parsed = parseSignedDraft(rawValue);
    if (
      parsed !== null
      && isHalfStepGridValue(parsed, range.step)
      && parsed >= range.minimum
      && parsed <= range.maximum
    ) {
      onChange(parsed);
    }
  };

  const commit = () => {
    const parsed = parseSignedDraft(draft);
    const next = parsed !== null && isHalfStepNumber(parsed)
      ? Math.max(range.minimum, Math.min(range.maximum, quantizeHalfStep(parsed, range.step)))
      : value;
    setDraft(inputText(next));
    onChange(next);
  };

  const nudge = (direction: -1 | 1) => {
    const next = fromHalfTicks(toHalfTicks(value) + direction * stepTicks);
    onChange(Math.max(range.minimum, Math.min(range.maximum, next)));
  };

  return (
    <div className="dm-field dm-signed-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{formatRussianNumber(value)}</span>
      </label>
      <div className="dm-signed-field__control">
        <button type="button" className="dm-signed-field__step" onClick={() => nudge(-1)} disabled={value <= range.minimum} aria-label={`Уменьшить ${label.toLowerCase()} на ${formatRussianNumber(range.step)}`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => {
            cancelCommit.current = false;
            setIsEditing(true);
          }}
          onChange={(event) => edit(event.target.value)}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              setDraft(inputText(value));
              setIsEditing(false);
              return;
            }
            commit();
            setIsEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelCommit.current = true;
              setDraft(inputText(value));
              event.currentTarget.blur();
            }
          }}
        />
        <button type="button" className="dm-signed-field__step" onClick={() => nudge(1)} disabled={value >= range.maximum} aria-label={`Увеличить ${label.toLowerCase()} на ${formatRussianNumber(range.step)}`}>+</button>
      </div>
      <small id={`${id}-hint`}>От {formatRussianNumber(range.minimum)} до {formatRussianNumber(range.maximum)}, шаг {formatRussianNumber(range.step)}</small>
    </div>
  );
}

function locationText(point: CoordinatePoint, quadrant: Quadrant): string {
  if (quadrant !== null) return `${quadrant}-я координатная четверть`;
  if (point.x === 0 && point.y === 0) return 'начало координат';
  if (point.y === 0) return 'ось x';
  return 'ось y';
}

interface PlaneProps {
  id: string;
  mode: CoordinatePlaneMode;
  point: CoordinatePoint;
  routePoints: readonly CoordinatePoint[];
  route: readonly CoordinateStep[];
  range: LabRange;
}

function CoordinatePlane({ id, mode, point, routePoints, route, range }: PlaneProps) {
  const reflectedX = reflectPoint(point, 'x');
  const reflectedY = reflectPoint(point, 'y');
  const reflectedOrigin = reflectPoint(point, 'origin');
  const visiblePoints = mode === 'route'
    ? routePoints
    : mode === 'reflections'
      ? [point, reflectedX, reflectedY, reflectedOrigin]
      : [point];
  const routeExtent = visiblePoints.reduce((largest, item) => Math.max(largest, Math.abs(item.x), Math.abs(item.y)), 0);
  const extent = Math.max(1, Math.abs(range.minimum), Math.abs(range.maximum), routeExtent);
  const centerX = 360;
  const centerY = 278;
  const radius = 236;
  const scale = radius / extent;
  const px = (value: number) => centerX + value * scale;
  const py = (value: number) => centerY - value * scale;
  const gridStep = extent <= 7 ? 1 : extent <= 18 ? 2 : extent <= 45 ? 5 : 10;
  const gridLimit = Math.ceil(extent / gridStep) * gridStep;
  const gridValues = Array.from({ length: Math.floor((gridLimit * 2) / gridStep) + 1 }, (_, index) => -gridLimit + index * gridStep)
    .filter((value) => Math.abs(value) <= extent);
  const routeDescription = route.length === 0
    ? 'нет шагов'
    : route.map((segment, index) => `${segment.label ?? `шаг ${index + 1}`}: на ${formatRussianNumber(segment.dx)} по x и ${formatRussianNumber(segment.dy)} по y`).join('; ');

  const reflectionPlotPoints = (() => {
    const candidates = [
      { item: point, label: 'A', modifier: 'a' },
      { item: reflectedX, label: 'Aₓ', modifier: 'x-reflection' },
      { item: reflectedY, label: 'Aᵧ', modifier: 'y-reflection' },
      { item: reflectedOrigin, label: 'A₀', modifier: 'origin-reflection' },
    ];
    const unique = new Map<string, { item: CoordinatePoint; labels: string[]; modifier: string }>();
    for (const candidate of candidates) {
      const key = `${candidate.item.x};${candidate.item.y}`;
      const existing = unique.get(key);
      if (existing) existing.labels.push(candidate.label);
      else unique.set(key, { item: candidate.item, labels: [candidate.label], modifier: candidate.modifier });
    }
    return Array.from(unique.values());
  })();

  const routePlotPoints = (() => {
    if (routePoints.length === 1) {
      return [{ item: routePoints[0], labels: ['A = B'], modifier: 'a' }];
    }
    const unique = new Map<string, { item: CoordinatePoint; labels: string[]; modifier: string }>();
    routePoints.forEach((item, index) => {
      const isStart = index === 0;
      const isFinish = index === routePoints.length - 1;
      const label = isStart ? 'A' : isFinish ? 'B' : String(index);
      const modifier = isStart ? 'a' : isFinish ? 'finish' : 'waypoint';
      const key = `${item.x};${item.y}`;
      const existing = unique.get(key);
      if (existing) {
        existing.labels.push(label);
        if (isFinish) existing.modifier = 'finish';
      } else {
        unique.set(key, { item, labels: [label], modifier });
      }
    });
    return Array.from(unique.values());
  })();

  const drawPoint = (item: CoordinatePoint, label: string, modifier: string) => {
    const placeLabelToLeft = item.x > extent * 0.55;
    const placeLabelBelow = item.y > extent * 0.72;
    return (
      <g className={`dm-signed-plane__point dm-signed-plane__point--${modifier}`} transform={`translate(${px(item.x)} ${py(item.y)})`} aria-hidden="true" key={`${modifier}-${label}-${item.x}-${item.y}`}>
        <circle r="8" />
        <text x={placeLabelToLeft ? -11 : 11} y={placeLabelBelow ? 21 : -11} textAnchor={placeLabelToLeft ? 'end' : 'start'}>{label}{pointText(item)}</text>
      </g>
    );
  };

  return (
    <svg className="dm-signed-plane" viewBox="0 0 720 570" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Координатная плоскость</title>
      <desc id={`${id}-desc`}>
        Исходная точка A имеет координаты {pointText(point)}. Она находится: {locationText(point, quadrantOf(point))}.
        {mode === 'reflections' ? ` Отражение относительно оси x: ${pointText(reflectedX)}, относительно оси y: ${pointText(reflectedY)}, относительно начала координат: ${pointText(reflectedOrigin)}.` : ''}
        {mode === 'route' ? ` Маршрут: ${routeDescription}. Конечная точка ${pointText(routePoints.at(-1) ?? point)}.` : ''}
      </desc>
      <defs>
        <marker id={`${id}-axis-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path className="dm-signed-plane__axis-arrow" d="M0,0 L8,4 L0,8 Z" />
        </marker>
        <marker id={`${id}-route-arrow`} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path className="dm-signed-plane__route-arrow" d="M0,0 L9,4.5 L0,9 Z" />
        </marker>
      </defs>
      <rect className="dm-signed-plane__background" x={centerX - radius} y={centerY - radius} width={radius * 2} height={radius * 2} rx="12" />
      <g className="dm-signed-plane__grid" aria-hidden="true">
        {gridValues.map((value) => (
          <g key={value}>
            <line x1={px(value)} y1={centerY - radius} x2={px(value)} y2={centerY + radius} />
            <line x1={centerX - radius} y1={py(value)} x2={centerX + radius} y2={py(value)} />
          </g>
        ))}
      </g>
      <line className="dm-signed-plane__axis" x1={centerX - radius} y1={centerY} x2={centerX + radius} y2={centerY} markerEnd={`url(#${id}-axis-arrow)`} />
      <line className="dm-signed-plane__axis" x1={centerX} y1={centerY + radius} x2={centerX} y2={centerY - radius} markerEnd={`url(#${id}-axis-arrow)`} />
      <g className="dm-signed-plane__labels" aria-hidden="true">
        {gridValues.filter((value) => value !== 0 && Math.abs(value) <= extent).map((value) => (
          <g key={value}>
            <text x={px(value)} y={centerY + 20}>{formatRussianNumber(value)}</text>
            <text x={centerX - 14} y={py(value) + 4}>{formatRussianNumber(value)}</text>
          </g>
        ))}
        <text x={centerX + radius - 4} y={centerY - 12}>x</text>
        <text x={centerX + 13} y={centerY - radius + 11}>y</text>
        <text x={centerX - 15} y={centerY + 19}>0</text>
      </g>

      {mode === 'reflections' && (
        <g className="dm-signed-plane__reflection-guides" aria-hidden="true">
          <line x1={px(point.x)} y1={py(point.y)} x2={px(reflectedX.x)} y2={py(reflectedX.y)} />
          <line x1={px(point.x)} y1={py(point.y)} x2={px(reflectedY.x)} y2={py(reflectedY.y)} />
          <line x1={px(point.x)} y1={py(point.y)} x2={px(reflectedOrigin.x)} y2={py(reflectedOrigin.y)} />
        </g>
      )}

      {mode === 'route' && routePoints.slice(1).map((destination, index) => {
        const start = routePoints[index];
        return (
          <g className="dm-signed-plane__route-segment" key={`${index}-${destination.x}-${destination.y}`} aria-hidden="true">
            <line x1={px(start.x)} y1={py(start.y)} x2={px(destination.x)} y2={py(destination.y)} markerEnd={`url(#${id}-route-arrow)`} />
          </g>
        );
      })}

      {mode === 'point' && drawPoint(point, 'A', 'a')}
      {mode === 'reflections' && reflectionPlotPoints.map((plotted) => (
        drawPoint(plotted.item, plotted.labels.join(' = '), plotted.modifier)
      ))}
      {mode === 'route' && routePlotPoints.map((plotted) => (
        drawPoint(plotted.item, plotted.labels.join(' = '), plotted.modifier)
      ))}
    </svg>
  );
}

export default function CoordinatePlaneLab({
  mode = 'point',
  initialX = -3,
  initialY = 2,
  min,
  max,
  step,
  route = DEFAULT_ROUTE,
}: CoordinatePlaneLabProps) {
  const reactId = useId();
  const labId = `coordinate-plane-${reactId.replace(/:/g, '')}`;
  const range = useMemo(() => makeRange(min, max, step), [min, max, step]);
  const defaultX = safeValue(initialX, -3, range);
  const defaultY = safeValue(initialY, 2, range);
  const [x, setX] = useState(defaultX);
  const [y, setY] = useState(defaultY);
  const [activeMode, setActiveMode] = useState<CoordinatePlaneMode>(mode);
  const point = useMemo<CoordinatePoint>(() => ({ x, y }), [x, y]);
  const safeRoute = useMemo<readonly CoordinateStep[]>(() => route.slice(0, MAX_ROUTE_STEPS).map((segment, index) => {
    const dx = isHalfStepNumber(segment.dx) ? quantizeHalfStep(segment.dx, range.step) : 0;
    const dy = isHalfStepNumber(segment.dy) ? quantizeHalfStep(segment.dy, range.step) : 0;
    return {
      dx: Math.max(HARD_MINIMUM, Math.min(HARD_MAXIMUM, dx)),
      dy: Math.max(HARD_MINIMUM, Math.min(HARD_MAXIMUM, dy)),
      ...(typeof segment.label === 'string' && segment.label.trim() !== '' ? { label: segment.label.trim().slice(0, 48) } : { label: `Шаг ${index + 1}` }),
    };
  }), [route, range.step]);
  const routePoints = useMemo<readonly CoordinatePoint[]>(() => {
    const points: CoordinatePoint[] = [point];
    for (const segment of safeRoute) {
      points.push(translatePoint(points[points.length - 1], segment.dx, segment.dy));
    }
    return points;
  }, [point, safeRoute]);
  const reflectedX = reflectPoint(point, 'x');
  const reflectedY = reflectPoint(point, 'y');
  const reflectedOrigin = reflectPoint(point, 'origin');
  const quadrant = quadrantOf(point);
  const finish = routePoints.at(-1) ?? point;

  const move = (dx: number, dy: number) => {
    const moved = translatePoint(point, dx, dy);
    setX(Math.max(range.minimum, Math.min(range.maximum, moved.x)));
    setY(Math.max(range.minimum, Math.min(range.maximum, moved.y)));
  };

  const result = activeMode === 'point'
    ? {
      headline: `A${pointText(point)} — ${locationText(point, quadrant)}.`,
      detail: `Сначала читаем x по горизонтали: ${formatRussianNumber(x)}; затем y по вертикали: ${formatRussianNumber(y)}.`,
    }
    : activeMode === 'reflections'
      ? {
        headline: `Отражения A: Aₓ${pointText(reflectedX)}, Aᵧ${pointText(reflectedY)}, A₀${pointText(reflectedOrigin)}.`,
        detail: 'При отражении относительно оси меняется знак перпендикулярной координаты; относительно начала — знаки обеих.',
      }
      : {
        headline: `Маршрут начинается в A${pointText(point)} и заканчивается в B${pointText(finish)}.`,
        detail: `Каждый шаг прибавляет смещение (Δx; Δy) к текущим координатам. Выполнено шагов: ${safeRoute.length}.`,
      };

  const reset = () => {
    setX(defaultX);
    setY(defaultY);
    setActiveMode(mode);
  };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория координатной плоскости</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Адрес точки: сначала x, затем y</h3>
          <p>В записи (x; y) первая координата задаёт горизонтальное движение, вторая — вертикальное.</p>
        </div>
        <span className="dm-lab__badge">(x; y)</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-signed-tabs" role="group" aria-label="Режим координатной плоскости">
          {(Object.keys(MODE_LABELS) as CoordinatePlaneMode[]).map((item) => (
            <button type="button" className={`dm-signed-tab ${activeMode === item ? 'dm-signed-tab--active' : ''}`} aria-pressed={activeMode === item} onClick={() => setActiveMode(item)} key={item}>
              {MODE_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-signed-controls">
          <CoordinateField id={`${labId}-x`} label="Координата x" value={x} range={range} onChange={setX} />
          <CoordinateField id={`${labId}-y`} label="Координата y" value={y} range={range} onChange={setY} />
        </div>

        <div className="dm-signed-plane-nudges" role="group" aria-label={`Переместить точку A с шагом ${formatRussianNumber(range.step)}`}>
          <button type="button" onClick={() => move(0, range.step)} disabled={y >= range.maximum} aria-label="Переместить точку вверх">↑<span>y + {formatRussianNumber(range.step)}</span></button>
          <button type="button" onClick={() => move(-range.step, 0)} disabled={x <= range.minimum} aria-label="Переместить точку влево">←<span>x − {formatRussianNumber(range.step)}</span></button>
          <button type="button" onClick={() => { setX(0); setY(0); }} aria-label="Переместить точку в начало координат">0<span>в начало</span></button>
          <button type="button" onClick={() => move(range.step, 0)} disabled={x >= range.maximum} aria-label="Переместить точку вправо">→<span>x + {formatRussianNumber(range.step)}</span></button>
          <button type="button" onClick={() => move(0, -range.step)} disabled={y <= range.minimum} aria-label="Переместить точку вниз">↓<span>y − {formatRussianNumber(range.step)}</span></button>
        </div>

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемая схема координатной плоскости" tabIndex={0}>
          <CoordinatePlane id={`${labId}-plane`} mode={activeMode} point={point} routePoints={routePoints} route={safeRoute} range={range} />
        </div>

        {activeMode === 'reflections' && (
          <div className="dm-signed-reflection-cards">
            <div><span>относительно Ox</span><strong>{pointText(point)} → {pointText(reflectedX)}</strong><small>x сохраняется, y меняет знак</small></div>
            <div><span>относительно Oy</span><strong>{pointText(point)} → {pointText(reflectedY)}</strong><small>y сохраняется, x меняет знак</small></div>
            <div><span>относительно O</span><strong>{pointText(point)} → {pointText(reflectedOrigin)}</strong><small>оба знака меняются</small></div>
          </div>
        )}

        {activeMode === 'route' && (
          <ol className="dm-signed-route-list">
            {safeRoute.map((segment, index) => (
              <li key={`${index}-${segment.dx}-${segment.dy}`}>
                <span>{index + 1}</span>
                <p>
                  <strong>{segment.label}</strong>
                  <small>{pointText(routePoints[index])} + ({formatRussianNumber(segment.dx)}; {formatRussianNumber(segment.dy)}) = {pointText(routePoints[index + 1])}</small>
                </p>
              </li>
            ))}
            {safeRoute.length === 0 && <li className="dm-signed-route-list__empty">Маршрут пуст: начальная и конечная точки совпадают.</li>}
          </ol>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">⌖</span>
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
