import { useId, useMemo, useState } from 'react';
import {
  CUBE_EDGES,
  CUBE_VERTEX_NAMES,
  DEFAULT_VIEW,
  LINE_PAIR_LABELS,
  type CubeEdgeId,
  type CubeVertexName,
  type LinePairKind,
  type ScreenPoint,
  type ViewAngles,
  cameraDirection,
  classifyCubeEdges,
  commonCubeVertex,
  cubeEdgeAngleDegrees,
  cubeEdgeDistance,
  cubeEdgePairCounts,
  cubeVertex,
  dot3,
  formatEdgeId,
  formatNumber,
  formatVertexName,
  isCubeEdgeHidden,
  projectAxonometric,
  vec3,
} from '../lib/stereometry';

export interface SpaceLabProps {
  /** Первое выделенное ребро. */
  initialFirst?: CubeEdgeId;
  /** Второе выделенное ребро. */
  initialSecond?: CubeEdgeId;
  /** Длина ребра куба в выбранных единицах. */
  edgeLength?: number;
  unitLabel?: string;
  /** Режим задачи: вид пары не показывается до нажатия «Проверить». */
  challenge?: boolean;
}

interface Face {
  readonly loop: readonly CubeVertexName[];
  readonly normal: { readonly x: number; readonly y: number; readonly z: number };
  readonly className: string;
  readonly label: string;
}

const WIDTH = 720;
const HEIGHT = 460;
const PADDING = 74;
const ANSWER_KINDS: readonly LinePairKind[] = ['parallel', 'intersecting', 'skew'];
const EDGE_IDS: readonly CubeEdgeId[] = CUBE_EDGES.map((edge) => edge.id);

const FACES: readonly Face[] = [
  { loop: ['A', 'B', 'C', 'D'], normal: { x: 0, y: 0, z: -1 }, className: 'dm-geometry-solid__top', label: 'ABCD' },
  { loop: ['A1', 'B1', 'C1', 'D1'], normal: { x: 0, y: 0, z: 1 }, className: 'dm-geometry-solid__top', label: 'A₁B₁C₁D₁' },
  { loop: ['A', 'B', 'B1', 'A1'], normal: { x: 0, y: -1, z: 0 }, className: 'dm-geometry-solid__front', label: 'ABB₁A₁' },
  { loop: ['D', 'C', 'C1', 'D1'], normal: { x: 0, y: 1, z: 0 }, className: 'dm-geometry-solid__front', label: 'DCC₁D₁' },
  { loop: ['A', 'D', 'D1', 'A1'], normal: { x: -1, y: 0, z: 0 }, className: 'dm-geometry-solid__side', label: 'ADD₁A₁' },
  { loop: ['B', 'C', 'C1', 'B1'], normal: { x: 1, y: 0, z: 0 }, className: 'dm-geometry-solid__side', label: 'BCC₁B₁' },
];

function safeEdge(value: CubeEdgeId | undefined, fallback: CubeEdgeId): CubeEdgeId {
  return value !== undefined && EDGE_IDS.includes(value) ? value : fallback;
}

function safeLength(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1000 ? value : 4;
}

function clampAngle(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

export default function SpaceLab({
  initialFirst,
  initialSecond,
  edgeLength,
  unitLabel = 'см',
  challenge = false,
}: SpaceLabProps) {
  const reactId = useId();
  const labId = `space-lab-${reactId.replace(/:/g, '')}`;
  const defaultFirst = safeEdge(initialFirst, 'AB');
  const defaultSecond = safeEdge(initialSecond, 'CC1');
  const size = safeLength(edgeLength);

  const [selected, setSelected] = useState<readonly CubeEdgeId[]>(
    defaultFirst === defaultSecond ? [defaultFirst] : [defaultFirst, defaultSecond],
  );
  const [azimuth, setAzimuth] = useState(DEFAULT_VIEW.azimuthDegrees);
  const [elevation, setElevation] = useState(DEFAULT_VIEW.elevationDegrees);
  const [answer, setAnswer] = useState<LinePairKind | null>(null);
  const [checked, setChecked] = useState(false);

  const view: ViewAngles = { azimuthDegrees: azimuth, elevationDegrees: elevation };
  const counts = useMemo(() => cubeEdgePairCounts(), []);

  const projected = useMemo(() => {
    const entries = CUBE_VERTEX_NAMES.map((name) => [name, projectAxonometric(cubeVertex(name, 1), view)] as const);
    const flat = entries.map(([, point]) => point);
    const minX = Math.min(...flat.map((point) => point.x));
    const maxX = Math.max(...flat.map((point) => point.x));
    const minY = Math.min(...flat.map((point) => point.y));
    const maxY = Math.max(...flat.map((point) => point.y));
    const spanX = Math.max(maxX - minX, 1e-6);
    const spanY = Math.max(maxY - minY, 1e-6);
    const scale = Math.min((WIDTH - 2 * PADDING) / spanX, (HEIGHT - 2 * PADDING) / spanY);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const toScreen = (point: ScreenPoint): ScreenPoint => ({
      x: WIDTH / 2 + (point.x - centerX) * scale,
      y: HEIGHT / 2 - (point.y - centerY) * scale,
    });
    return Object.fromEntries(entries.map(([name, point]) => [name, toScreen(point)])) as Record<CubeVertexName, ScreenPoint>;
  }, [azimuth, elevation]);

  const eye = cameraDirection(view);
  const visibleFaces = FACES.filter((face) => dot3(vec3(face.normal.x, face.normal.y, face.normal.z), eye) > 0);

  const first = selected[0];
  const second = selected[1];
  const complete = first !== undefined && second !== undefined;
  const kind = complete ? classifyCubeEdges(first, second) : null;
  const angle = complete ? cubeEdgeAngleDegrees(first, second) : 0;
  const distance = complete ? cubeEdgeDistance(first, second, size) : 0;
  const shared = complete ? commonCubeVertex(first, second) : null;

  const toggleEdge = (id: CubeEdgeId) => {
    setChecked(false);
    setAnswer(null);
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length < 2) return [...current, id];
      return [current[1]!, id];
    });
  };

  const reset = () => {
    setSelected(defaultFirst === defaultSecond ? [defaultFirst] : [defaultFirst, defaultSecond]);
    setAzimuth(DEFAULT_VIEW.azimuthDegrees);
    setElevation(DEFAULT_VIEW.elevationDegrees);
    setAnswer(null);
    setChecked(false);
  };

  const pairName = complete ? `${formatEdgeId(first)} и ${formatEdgeId(second)}` : '';
  const detail = (() => {
    if (!complete) return 'Отметь ровно два ребра.';
    if (kind === 'parallel') {
      return `Через них проходит одна плоскость, а общих точек нет. Угол ${formatNumber(angle, 1)}°, расстояние ${formatNumber(distance, 2)} ${unitLabel}.`;
    }
    if (kind === 'intersecting') {
      return `Общая точка — вершина ${shared ? formatVertexName(shared) : '—'}; через две пересекающиеся прямые проходит ровно одна плоскость. Угол ${formatNumber(angle, 1)}°.`;
    }
    return `Одной плоскости, содержащей обе прямые, не существует. Угол между ними ${formatNumber(angle, 1)}° (переносим ребро параллельно), расстояние ${formatNumber(distance, 2)} ${unitLabel}.`;
  })();

  const result = (() => {
    if (!complete) {
      return { symbol: '?', headline: `Выбрано рёбер: ${selected.length} из 2.`, detail: 'Отметь два ребра куба, чтобы сравнить их.' };
    }
    if (challenge && !checked) {
      return { symbol: '?', headline: `Пара ${pairName}.`, detail: 'Поверни куб, реши, есть ли плоскость, содержащая обе прямые, и выбери ответ.' };
    }
    const label = kind ? LINE_PAIR_LABELS[kind] : '';
    if (challenge) {
      const right = answer === kind;
      return {
        symbol: right ? '✓' : '×',
        headline: right ? `Верно: ${pairName} — ${label}.` : `${pairName} — ${label}.`,
        detail,
      };
    }
    return { symbol: '◇', headline: `${pairName} — ${label}.`, detail };
  })();

  const description = complete
    ? `Куб ABCDA₁B₁C₁D₁ в параллельной проекции. Выделены рёбра ${pairName}. Поворот ${formatNumber(azimuth, 0)}°, подъём ${formatNumber(elevation, 0)}°.`
    : `Куб ABCDA₁B₁C₁D₁ в параллельной проекции. Рёбра пока не выбраны. Поворот ${formatNumber(azimuth, 0)}°, подъём ${formatNumber(elevation, 0)}°.`;

  const center = { x: WIDTH / 2, y: HEIGHT / 2 };
  const labelPosition = (name: CubeVertexName): ScreenPoint => {
    const point = projected[name];
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const norm = Math.hypot(dx, dy) || 1;
    return { x: point.x + (dx / norm) * 26, y: point.y + (dy / norm) * 26 + 6 };
  };
  const edgePath = (id: CubeEdgeId): string => {
    const edge = CUBE_EDGES.find((item) => item.id === id)!;
    const from = projected[edge.from];
    const to = projected[edge.to];
    return `M${from.x} ${from.y} L${to.x} ${to.y}`;
  };

  return (
    <section className="dm-lab dm-geometry-solid-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория пространства</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Две прямые в кубе</h3>
          <p>Отметь два ребра и выясни, лежат ли они в одной плоскости. Куб можно повернуть: расположение прямых от этого не меняется.</p>
        </div>
        <span className="dm-lab__badge">{counts.parallel + counts.intersecting + counts.skew} пар рёбер</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-preset-buttons" role="group" aria-label="Рёбра куба">
          {EDGE_IDS.map((id) => (
            <button
              type="button"
              key={id}
              className={selected.includes(id) ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'}
              aria-pressed={selected.includes(id)}
              onClick={() => toggleEdge(id)}
            >{formatEdgeId(id)}</button>
          ))}
        </div>

        <div className="dm-lab__controls dm-geometry-controls">
          <div className="dm-field">
            <label htmlFor={`${labId}-azimuth`}>Поворот <span className="dm-field__value">{formatNumber(azimuth, 0)}°</span></label>
            <input
              id={`${labId}-azimuth`}
              type="range"
              min={-80}
              max={-5}
              step={1}
              value={azimuth}
              aria-valuetext={`${formatNumber(azimuth, 0)} градусов`}
              aria-describedby={`${labId}-view-hint`}
              onChange={(event) => setAzimuth(clampAngle(Number(event.target.value), -80, -5))}
            />
          </div>
          <div className="dm-field">
            <label htmlFor={`${labId}-elevation`}>Подъём <span className="dm-field__value">{formatNumber(elevation, 0)}°</span></label>
            <input
              id={`${labId}-elevation`}
              type="range"
              min={8}
              max={60}
              step={1}
              value={elevation}
              aria-valuetext={`${formatNumber(elevation, 0)} градусов`}
              aria-describedby={`${labId}-view-hint`}
              onChange={(event) => setElevation(clampAngle(Number(event.target.value), 8, 60))}
            />
          </div>
        </div>
        <p id={`${labId}-view-hint`}>Проекция параллельная: длины и углы на рисунке искажены, но параллельность прямых сохраняется.</p>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемая модель куба" tabIndex={0}>
          <svg className="dm-geometry-grid" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${labId}-title ${labId}-desc`}>
            <title id={`${labId}-title`}>Куб ABCDA₁B₁C₁D₁ и выбранная пара рёбер</title>
            <desc id={`${labId}-desc`}>{description}</desc>
            <rect className="dm-geometry-grid__background" x="0" y="0" width={WIDTH} height={HEIGHT} rx="18" />
            <g aria-hidden="true">
              {visibleFaces.map((face) => (
                <polygon
                  key={face.label}
                  className={face.className}
                  points={face.loop.map((name) => `${projected[name].x},${projected[name].y}`).join(' ')}
                />
              ))}
            </g>
            <g aria-hidden="true">
              {CUBE_EDGES.filter((edge) => isCubeEdgeHidden(edge.id, view)).map((edge) => (
                <path key={edge.id} className="dm-geometry-solid__hidden" d={edgePath(edge.id)} />
              ))}
            </g>
            <g className="dm-geometry-solid__body" fill="none" aria-hidden="true">
              {CUBE_EDGES.filter((edge) => !isCubeEdgeHidden(edge.id, view)).map((edge) => (
                <path key={edge.id} d={edgePath(edge.id)} />
              ))}
            </g>
            {first !== undefined && <path className="dm-geometry-grid__route" d={edgePath(first)} aria-hidden="true" />}
            {second !== undefined && <path className="dm-geometry-angle__arc" d={edgePath(second)} aria-hidden="true" />}
            <g className="dm-geometry-grid__point" aria-hidden="true">
              {CUBE_VERTEX_NAMES.map((name) => (
                <g key={name}>
                  <circle cx={projected[name].x} cy={projected[name].y} r="5" />
                  <text x={labelPosition(name).x} y={labelPosition(name).y} textAnchor="middle">{formatVertexName(name)}</text>
                </g>
              ))}
            </g>
          </svg>
        </div>

        {challenge && (
          <fieldset className="dm-geometry-challenge">
            <legend>Как расположены выбранные рёбра?</legend>
            {ANSWER_KINDS.map((item) => (
              <label key={item}>
                <input
                  type="radio"
                  name={`${labId}-answer`}
                  checked={answer === item}
                  onChange={() => { setAnswer(item); setChecked(false); }}
                />
                {LINE_PAIR_LABELS[item]}
              </label>
            ))}
            <button className="dm-button" type="button" disabled={answer === null || !complete} onClick={() => setChecked(true)}>Проверить</button>
          </fieldset>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span>
          <p>
            <strong>{result.headline}</strong>
            <small>{result.detail}</small>
          </p>
        </div>

        <p>Всего у куба {CUBE_EDGES.length} рёбер и {counts.parallel + counts.intersecting + counts.skew} пар: {counts.parallel} параллельных, {counts.intersecting} пересекающихся и {counts.skew} скрещивающихся.</p>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
