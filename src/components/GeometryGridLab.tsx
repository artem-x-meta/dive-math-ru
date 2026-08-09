import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatExactRussian, type ExactRational } from '../lib/exactRational';
import {
  classifyLineRelation,
  gridRouteLength,
  pointToLineDistanceSquared,
  type GeometryLine,
  type GeometryPoint,
  type LineRelation,
} from '../lib/geometry';

export type { GeometryLine, GeometryPoint } from '../lib/geometry';

export type GeometryGridMode = 'line-relations' | 'point-distance' | 'route';
export type GeometryLineRelation = LineRelation;

export interface GeometryGridLabProps {
  mode?: GeometryGridMode;
  initialLineA?: GeometryLine;
  initialLineB?: GeometryLine;
  initialPoint?: GeometryPoint;
  initialRoute?: readonly GeometryPoint[];
  min?: number;
  max?: number;
  unitLabel?: string;
  challenge?: boolean;
}

interface Bounds {
  readonly minimum: number;
  readonly maximum: number;
}

type DistanceChoice = 'perpendicular' | 'start' | 'end';

const HARD_MINIMUM = -20;
const HARD_MAXIMUM = 20;
const MAX_ROUTE_POINTS = 24;
const MODES: readonly GeometryGridMode[] = ['line-relations', 'point-distance', 'route'];
const DEFAULT_LINE_A: GeometryLine = { start: { x: -4, y: -1 }, end: { x: 4, y: -1 } };
const DEFAULT_LINE_B: GeometryLine = { start: { x: 1, y: -4 }, end: { x: 1, y: 4 } };
const DEFAULT_POINT: GeometryPoint = { x: 3, y: 3 };
const DEFAULT_ROUTE: readonly GeometryPoint[] = [
  { x: -4, y: -2 },
  { x: 2, y: -2 },
  { x: 2, y: 3 },
] as const;

const MODE_LABELS: Readonly<Record<GeometryGridMode, string>> = {
  'line-relations': 'Прямые',
  'point-distance': 'До прямой',
  route: 'Маршрут',
};

const RELATION_LABELS: Readonly<Record<GeometryLineRelation, string>> = {
  coincident: 'совпадают',
  parallel: 'параллельны',
  perpendicular: 'перпендикулярны',
  intersecting: 'пересекаются, но не под прямым углом',
};

function safeMode(value: GeometryGridMode | undefined): GeometryGridMode {
  return value !== undefined && MODES.includes(value) ? value : 'line-relations';
}

function safeBounds(minimum: number | undefined, maximum: number | undefined): Bounds {
  const minCandidate = Number.isFinite(minimum) ? Math.round(minimum!) : -6;
  const maxCandidate = Number.isFinite(maximum) ? Math.round(maximum!) : 6;
  const low = Math.max(HARD_MINIMUM, Math.min(HARD_MAXIMUM - 2, Math.min(minCandidate, maxCandidate)));
  const high = Math.min(HARD_MAXIMUM, Math.max(low + 2, Math.max(minCandidate, maxCandidate)));
  return { minimum: low, maximum: high };
}

function clampInteger(value: unknown, fallback: number, bounds: Bounds): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(bounds.minimum, Math.min(bounds.maximum, Math.round(value)));
}

function safePoint(value: GeometryPoint | undefined, fallback: GeometryPoint, bounds: Bounds): GeometryPoint {
  return {
    x: clampInteger(value?.x, clampInteger(fallback.x, 0, bounds), bounds),
    y: clampInteger(value?.y, clampInteger(fallback.y, 0, bounds), bounds),
  };
}

function samePoint(left: GeometryPoint, right: GeometryPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

function safeLine(value: GeometryLine | undefined, fallback: GeometryLine, bounds: Bounds): GeometryLine {
  const candidate = {
    start: safePoint(value?.start, fallback.start, bounds),
    end: safePoint(value?.end, fallback.end, bounds),
  };
  if (!samePoint(candidate.start, candidate.end)) return candidate;
  const safeFallback = {
    start: safePoint(fallback.start, { x: bounds.minimum, y: 0 }, bounds),
    end: safePoint(fallback.end, { x: bounds.maximum, y: 0 }, bounds),
  };
  if (!samePoint(safeFallback.start, safeFallback.end)) return safeFallback;
  return { start: { x: bounds.minimum, y: 0 }, end: { x: bounds.maximum, y: 0 } };
}

function safeRoute(points: readonly GeometryPoint[] | undefined, bounds: Bounds): readonly GeometryPoint[] {
  const source = Array.isArray(points) && points.length > 0 ? points.slice(0, MAX_ROUTE_POINTS) : DEFAULT_ROUTE;
  const route: GeometryPoint[] = [];
  for (const sourcePoint of source) {
    let point = safePoint(sourcePoint, route.at(-1) ?? { x: 0, y: 0 }, bounds);
    const previous = route.at(-1);
    if (previous && point.x !== previous.x && point.y !== previous.y) {
      point = { x: point.x, y: previous.y };
    }
    if (!previous || !samePoint(previous, point)) route.push(point);
  }
  return route.length > 0 ? route : [{ x: 0, y: 0 }];
}

function safeUnitLabel(value: string | undefined): string {
  const normalized = typeof value === 'string' ? value.trim().slice(0, 16) : '';
  return normalized || 'ед.';
}

function projectionOnLine(point: GeometryPoint, line: GeometryLine): GeometryPoint {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const denominator = dx * dx + dy * dy;
  if (denominator === 0) return line.start;
  const factor = ((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) / denominator;
  return { x: line.start.x + factor * dx, y: line.start.y + factor * dy };
}

function formatDistance(squared: ExactRational): string {
  if (squared.numerator === 0n) return '0';
  const numeratorRoot = Math.sqrt(Number(squared.numerator));
  const denominatorRoot = Math.sqrt(Number(squared.denominator));
  if (Number.isSafeInteger(numeratorRoot) && Number.isSafeInteger(denominatorRoot)) {
    return formatExactRussian({ numerator: BigInt(numeratorRoot), denominator: BigInt(denominatorRoot) });
  }
  const approximation = Math.sqrt(Number(squared.numerator) / Number(squared.denominator));
  return `≈ ${approximation.toFixed(2).replace('.', ',')}`;
}

interface IntegerFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly bounds: Bounds;
  readonly onChange: (value: number) => void;
}

function IntegerField({ id, label, value, bounds, onChange }: IntegerFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  const commit = () => {
    const parsed = /^[-+]?\d+$/.test(draft.trim()) ? Number(draft) : value;
    const next = clampInteger(parsed, value, bounds);
    setDraft(String(next));
    onChange(next);
  };

  const nudge = (direction: -1 | 1) => {
    onChange(Math.max(bounds.minimum, Math.min(bounds.maximum, value + direction)));
  };

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>{label}<span className="dm-field__value">{value}</span></label>
      <div className="dm-geometry-field__control">
        <button type="button" onClick={() => nudge(-1)} disabled={value <= bounds.minimum} aria-label={`Уменьшить ${label} на 1`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => { cancelCommit.current = false; setEditing(true); }}
          onChange={(event) => {
            const raw = event.target.value.slice(0, 8);
            if (/^[-+]?\d*$/.test(raw)) {
              setDraft(raw);
              if (/^[-+]?\d+$/.test(raw)) {
                const parsed = Number(raw);
                if (parsed >= bounds.minimum && parsed <= bounds.maximum) onChange(parsed);
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
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelCommit.current = true;
              setDraft(String(value));
              event.currentTarget.blur();
            }
          }}
        />
        <button type="button" onClick={() => nudge(1)} disabled={value >= bounds.maximum} aria-label={`Увеличить ${label} на 1`}>+</button>
      </div>
      <small id={`${id}-hint`}>Целое от {bounds.minimum} до {bounds.maximum}</small>
    </div>
  );
}

interface GridPictureProps {
  readonly id: string;
  readonly mode: GeometryGridMode;
  readonly lineA: GeometryLine;
  readonly lineB: GeometryLine;
  readonly point: GeometryPoint;
  readonly route: readonly GeometryPoint[];
  readonly bounds: Bounds;
  readonly revealConstruction: boolean;
  readonly challenge: boolean;
}

function GridPicture({ id, mode, lineA, lineB, point, route, bounds, revealConstruction, challenge }: GridPictureProps) {
  const width = 720;
  const height = 450;
  const padding = 52;
  const span = bounds.maximum - bounds.minimum;
  const scale = Math.min((width - padding * 2) / span, (height - padding * 2) / span);
  const contentWidth = span * scale;
  const contentHeight = span * scale;
  const left = (width - contentWidth) / 2;
  const top = (height - contentHeight) / 2;
  const px = (x: number) => left + (x - bounds.minimum) * scale;
  const py = (y: number) => top + (bounds.maximum - y) * scale;
  const clipId = `${id}-clip`;
  const projection = projectionOnLine(point, lineA);
  const lineDx = lineA.end.x - lineA.start.x;
  const lineDy = lineA.end.y - lineA.start.y;
  const lineLength = Math.hypot(lineDx, lineDy) || 1;
  const tangent = { x: lineDx / lineLength, y: lineDy / lineLength };
  const pointOffset = { x: point.x - projection.x, y: point.y - projection.y };
  const pointDistance = Math.hypot(pointOffset.x, pointOffset.y);
  const normal = pointDistance > 1e-9
    ? { x: pointOffset.x / pointDistance, y: pointOffset.y / pointDistance }
    : { x: -tangent.y, y: tangent.x };
  const markerSize = Math.min(0.42, 12 / scale);
  const markerA = { x: projection.x + tangent.x * markerSize, y: projection.y + tangent.y * markerSize };
  const markerB = { x: markerA.x + normal.x * markerSize, y: markerA.y + normal.y * markerSize };
  const markerC = { x: projection.x + normal.x * markerSize, y: projection.y + normal.y * markerSize };
  const values = Array.from({ length: span + 1 }, (_, index) => bounds.minimum + index);

  const longLine = (line: GeometryLine, modifier: string, label: string) => {
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    const extension = 100;
    return (
      <g className={`dm-geometry-grid__line dm-geometry-grid__line--${modifier}`}>
        <line x1={px(line.start.x - dx * extension)} y1={py(line.start.y - dy * extension)} x2={px(line.end.x + dx * extension)} y2={py(line.end.y + dy * extension)} />
        <text x={px(line.start.x) + 9} y={py(line.start.y) - 10}>{label}</text>
      </g>
    );
  };

  const title = mode === 'line-relations'
    ? 'Две прямые на координатной сетке'
    : mode === 'point-distance'
      ? 'Точка и прямая на координатной сетке'
      : 'Ломаный маршрут по координатной сетке';
  const description = mode === 'line-relations'
    ? `Прямая a задана точками (${lineA.start.x}; ${lineA.start.y}) и (${lineA.end.x}; ${lineA.end.y}); прямая b — точками (${lineB.start.x}; ${lineB.start.y}) и (${lineB.end.x}; ${lineB.end.y}).`
    : mode === 'point-distance'
      ? `Точка P имеет координаты (${point.x}; ${point.y}); прямая a задана двумя отмеченными точками.${revealConstruction ? ' Показан перпендикуляр от P к прямой.' : ''}`
      : `Маршрут проходит через ${route.length} точек и состоит только из горизонтальных и вертикальных отрезков.`;

  return (
    <svg className="dm-geometry-grid" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <defs>
        <clipPath id={clipId}><rect x={left} y={top} width={contentWidth} height={contentHeight} rx="8" /></clipPath>
      </defs>
      <rect className="dm-geometry-grid__background" x={left} y={top} width={contentWidth} height={contentHeight} rx="8" />
      <g className="dm-geometry-grid__mesh" aria-hidden="true">
        {values.map((value) => <line key={`v-${value}`} x1={px(value)} y1={top} x2={px(value)} y2={top + contentHeight} />)}
        {values.map((value) => <line key={`h-${value}`} x1={left} y1={py(value)} x2={left + contentWidth} y2={py(value)} />)}
      </g>
      <g clipPath={`url(#${clipId})`}>
        {mode === 'line-relations' && <>{longLine(lineA, 'a', 'a')}{longLine(lineB, 'b', 'b')}</>}
        {mode === 'point-distance' && (
          <>
            {longLine(lineA, 'a', 'a')}
            {challenge && !revealConstruction ? (
              <g className="dm-geometry-grid__candidates">
                <line x1={px(point.x)} y1={py(point.y)} x2={px(projection.x)} y2={py(projection.y)} />
                <line x1={px(point.x)} y1={py(point.y)} x2={px(lineA.start.x)} y2={py(lineA.start.y)} />
                <line x1={px(point.x)} y1={py(point.y)} x2={px(lineA.end.x)} y2={py(lineA.end.y)} />
              </g>
            ) : (
              <g className="dm-geometry-grid__perpendicular">
                <line x1={px(point.x)} y1={py(point.y)} x2={px(projection.x)} y2={py(projection.y)} />
                <path d={`M ${px(markerA.x)} ${py(markerA.y)} L ${px(markerB.x)} ${py(markerB.y)} L ${px(markerC.x)} ${py(markerC.y)}`} />
              </g>
            )}
            <g className="dm-geometry-grid__point"><circle cx={px(point.x)} cy={py(point.y)} r="7" /><text x={px(point.x) + 10} y={py(point.y) - 10}>P</text></g>
          </>
        )}
        {mode === 'route' && (
          <>
            <polyline className="dm-geometry-grid__route" points={route.map((item) => `${px(item.x)},${py(item.y)}`).join(' ')} />
            {route.map((item, index) => (
              <g className="dm-geometry-grid__point" key={`${item.x}-${item.y}-${index}`}>
                <circle cx={px(item.x)} cy={py(item.y)} r={index === route.length - 1 ? 8 : 6} />
                <text x={px(item.x) + 9} y={py(item.y) - 9}>{index === 0 ? 'A' : index === route.length - 1 ? 'B' : index}</text>
              </g>
            ))}
          </>
        )}
      </g>
    </svg>
  );
}

export default function GeometryGridLab({
  mode,
  initialLineA,
  initialLineB,
  initialPoint,
  initialRoute,
  min,
  max,
  unitLabel,
  challenge = false,
}: GeometryGridLabProps) {
  const reactId = useId();
  const labId = `geometry-grid-${reactId.replace(/:/g, '')}`;
  const bounds = useMemo(() => safeBounds(min, max), [min, max]);
  const defaultMode = safeMode(mode);
  const defaultLineA = useMemo(() => safeLine(initialLineA, DEFAULT_LINE_A, bounds), [initialLineA, bounds]);
  const defaultLineB = useMemo(() => safeLine(initialLineB, DEFAULT_LINE_B, bounds), [initialLineB, bounds]);
  const defaultPoint = useMemo(() => safePoint(initialPoint, DEFAULT_POINT, bounds), [initialPoint, bounds]);
  const defaultRoute = useMemo(() => safeRoute(initialRoute, bounds), [initialRoute, bounds]);
  const unit = safeUnitLabel(unitLabel);
  const [activeMode, setActiveMode] = useState(defaultMode);
  const [lineB, setLineB] = useState(defaultLineB);
  const [point, setPoint] = useState(defaultPoint);
  const [route, setRoute] = useState<readonly GeometryPoint[]>(defaultRoute);
  const [relationAnswer, setRelationAnswer] = useState<GeometryLineRelation | null>(null);
  const [distanceAnswer, setDistanceAnswer] = useState<DistanceChoice | null>(null);
  const [checked, setChecked] = useState(false);

  const invalidate = () => setChecked(false);
  const relation = samePoint(lineB.start, lineB.end) ? null : classifyLineRelation(defaultLineA, lineB);
  const squaredDistance = pointToLineDistanceSquared(point, defaultLineA);
  const routeLength = route.length < 2 ? 0 : gridRouteLength(route);
  const relationCorrect = relation !== null && relationAnswer === relation;
  const distanceCorrect = distanceAnswer === 'perpendicular';
  const revealConstruction = !challenge || checked;

  const updateLineEnd = (coordinate: 'x' | 'y', value: number) => {
    invalidate();
    setLineB((current) => ({ ...current, end: { ...current.end, [coordinate]: value } }));
  };
  const updatePoint = (coordinate: 'x' | 'y', value: number) => {
    invalidate();
    setPoint((current) => ({ ...current, [coordinate]: value }));
  };
  const addRouteStep = (dx: number, dy: number) => {
    invalidate();
    setRoute((current) => {
      if (current.length >= MAX_ROUTE_POINTS) return current;
      const last = current.at(-1) ?? { x: 0, y: 0 };
      const next = { x: last.x + dx, y: last.y + dy };
      if (next.x < bounds.minimum || next.x > bounds.maximum || next.y < bounds.minimum || next.y > bounds.maximum) return current;
      return [...current, next];
    });
  };

  const reset = () => {
    setActiveMode(defaultMode);
    setLineB(defaultLineB);
    setPoint(defaultPoint);
    setRoute(defaultRoute);
    setRelationAnswer(null);
    setDistanceAnswer(null);
    setChecked(false);
  };

  const result = (() => {
    if (activeMode === 'route') {
      return { symbol: '↱', headline: `Длина маршрута: ${routeLength} ${unit}.`, detail: `${Math.max(0, route.length - 1)} осевых отрезков; на каждом шаге меняется только одна координата.` };
    }
    if (activeMode === 'line-relations') {
      if (relation === null) return { symbol: '!', headline: 'Прямая b пока не задана.', detail: 'Её начальная и конечная точки должны различаться.' };
      if (challenge && !checked) return { symbol: '?', headline: 'Определи отношение прямых.', detail: 'Выбери вариант и только затем нажми «Проверить».' };
      if (challenge) return { symbol: relationCorrect ? '✓' : '×', headline: relationCorrect ? 'Верно.' : 'Пока нет.', detail: `Прямые ${RELATION_LABELS[relation]}.` };
      return { symbol: '∠', headline: `Прямые ${RELATION_LABELS[relation]}.`, detail: 'Меняй координаты конца прямой b и следи за направляющими векторами.' };
    }
    if (challenge && !checked) return { symbol: '?', headline: 'Какой отрезок задаёт расстояние?', detail: 'Выбери кратчайший путь от точки P до прямой a.' };
    if (challenge) return { symbol: distanceCorrect ? '✓' : '×', headline: distanceCorrect ? 'Верно: нужен перпендикуляр.' : 'Расстояние задаёт перпендикуляр.', detail: `Его длина ${formatDistance(squaredDistance)} ${unit}.` };
    return { symbol: '⊥', headline: `Расстояние от P до a: ${formatDistance(squaredDistance)} ${unit}.`, detail: 'Перпендикуляр — самый короткий отрезок от точки до прямой.' };
  })();

  return (
    <section className="dm-lab dm-geometry-grid-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div><p className="dm-lab__eyebrow">Геометрическая сетка</p><h3 className="dm-lab__title" id={`${labId}-heading`}>Прямые, расстояния и маршруты</h3><p>Координатная сетка помогает строить точно, но вывод всегда остаётся геометрическим.</p></div>
        <span className="dm-lab__badge">{challenge ? 'задача' : 'исследование'}</span>
      </header>
      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Режим геометрической сетки">
          {MODES.map((item) => <button type="button" className={activeMode === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'} aria-pressed={activeMode === item} onClick={() => { setActiveMode(item); setChecked(false); }} key={item}>{MODE_LABELS[item]}</button>)}
        </div>

        {activeMode === 'line-relations' && (
          <div className="dm-lab__controls dm-geometry-controls">
            <IntegerField id={`${labId}-bx`} label="x конца b" value={lineB.end.x} bounds={bounds} onChange={(value) => updateLineEnd('x', value)} />
            <IntegerField id={`${labId}-by`} label="y конца b" value={lineB.end.y} bounds={bounds} onChange={(value) => updateLineEnd('y', value)} />
          </div>
        )}
        {activeMode === 'point-distance' && (
          <div className="dm-lab__controls dm-geometry-controls">
            <IntegerField id={`${labId}-px`} label="x точки P" value={point.x} bounds={bounds} onChange={(value) => updatePoint('x', value)} />
            <IntegerField id={`${labId}-py`} label="y точки P" value={point.y} bounds={bounds} onChange={(value) => updatePoint('y', value)} />
          </div>
        )}
        {activeMode === 'route' && (
          <div className="dm-geometry-route-controls" role="group" aria-label="Добавить единичный шаг маршрута">
            <button type="button" onClick={() => addRouteStep(-1, 0)} disabled={(route.at(-1)?.x ?? 0) <= bounds.minimum}>←<span>влево</span></button>
            <button type="button" onClick={() => addRouteStep(0, 1)} disabled={(route.at(-1)?.y ?? 0) >= bounds.maximum}>↑<span>вверх</span></button>
            <button type="button" onClick={() => addRouteStep(1, 0)} disabled={(route.at(-1)?.x ?? 0) >= bounds.maximum}>→<span>вправо</span></button>
            <button type="button" onClick={() => addRouteStep(0, -1)} disabled={(route.at(-1)?.y ?? 0) <= bounds.minimum}>↓<span>вниз</span></button>
            <button type="button" onClick={() => { invalidate(); setRoute((current) => current.length > 1 ? current.slice(0, -1) : current); }} disabled={route.length <= 1}>↶<span>отменить шаг</span></button>
          </div>
        )}

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемая геометрическая схема" tabIndex={0}>
          <GridPicture id={`${labId}-picture`} mode={activeMode} lineA={defaultLineA} lineB={lineB} point={point} route={route} bounds={bounds} revealConstruction={revealConstruction} challenge={challenge} />
        </div>

        {challenge && activeMode === 'line-relations' && (
          <fieldset className="dm-geometry-challenge"><legend>Как расположены прямые a и b?</legend>
            {(Object.keys(RELATION_LABELS) as GeometryLineRelation[]).map((choice) => <label key={choice}><input type="radio" name={`${labId}-relation`} value={choice} checked={relationAnswer === choice} onChange={() => { setRelationAnswer(choice); setChecked(false); }} />{RELATION_LABELS[choice]}</label>)}
            <button className="dm-button" type="button" disabled={relationAnswer === null || relation === null} onClick={() => setChecked(true)}>Проверить</button>
          </fieldset>
        )}
        {challenge && activeMode === 'point-distance' && (
          <fieldset className="dm-geometry-challenge"><legend>Какой отрезок является расстоянием до прямой?</legend>
            <label><input type="radio" name={`${labId}-distance`} checked={distanceAnswer === 'perpendicular'} onChange={() => { setDistanceAnswer('perpendicular'); setChecked(false); }} />перпендикуляр к прямой</label>
            <label><input type="radio" name={`${labId}-distance`} checked={distanceAnswer === 'start'} onChange={() => { setDistanceAnswer('start'); setChecked(false); }} />отрезок к первой отмеченной точке</label>
            <label><input type="radio" name={`${labId}-distance`} checked={distanceAnswer === 'end'} onChange={() => { setDistanceAnswer('end'); setChecked(false); }} />отрезок ко второй отмеченной точке</label>
            <button className="dm-button" type="button" disabled={distanceAnswer === null} onClick={() => setChecked(true)}>Проверить</button>
          </fieldset>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true"><span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span><p><strong>{result.headline}</strong><small>{result.detail}</small></p></div>
        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
