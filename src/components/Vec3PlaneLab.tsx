import { useId, useMemo, useState } from 'react';
import {
  BOX_FACES,
  BOX_NODES,
  BOX_NODE_GROUP_LABELS,
  CUBE_EDGES,
  DEFAULT_VIEW,
  type BoxDims,
  type BoxNodeGroup,
  type Point3,
  type ScreenPoint,
  type Vec3,
  type ViewAngles,
  angleBetweenPlanesDegrees,
  boxNode,
  boxPoint,
  cameraDirection,
  distanceToPlaneEquation,
  dot3,
  formatNumber,
  formatPlaneEquation,
  formatVec3,
  isCubeEdgeHidden,
  length3,
  planeEquation,
  planeEquationValue,
  planeEquationThroughPoints,
  planeFromEquation,
  planeNormal,
  pointsDefinePlane,
  projectAxonometric,
  projectPointOntoPlane,
  vec3,
} from '../lib/vectors3d';

export interface Vec3PlaneLabProps {
  /** `cube` — одно ребро на все три направления, `box` — три независимых ребра. */
  shape?: 'cube' | 'box';
  /** Начальные рёбра AB, AD и AA₁. */
  initialEdgeA?: number;
  initialEdgeB?: number;
  initialEdgeC?: number;
  /** Три узла тела, через которые проводится плоскость: id из BOX_NODES. */
  firstPoint?: string;
  secondPoint?: string;
  thirdPoint?: string;
  /** Узел, расстояние от которого до плоскости измеряется. */
  probePoint?: string;
  unitLabel?: string;
  /** Режим задачи: расстояние не показывается до нажатия «Проверить». */
  challenge?: boolean;
}

const WIDTH = 720;
const HEIGHT = 480;
const PADDING = 80;
const EDGE_RANGE = { minimum: 1, maximum: 8, step: 1 };
const GROUP_ORDER: readonly BoxNodeGroup[] = ['vertex', 'edge', 'face', 'center'];
/** Плоскость нижней грани: с ней сравниваем наклон выбранной плоскости. */
const BASE_EQUATION = planeEquation(0, 0, 1, 0);

function safeNode(value: string | undefined, fallback: string): string {
  return value !== undefined && BOX_NODES.some((node) => node.id === value) ? value : fallback;
}

function safeEdge(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(EDGE_RANGE.minimum, Math.min(EDGE_RANGE.maximum, Math.round(value)));
}

function parseAnswer(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.').replace('−', '-');
  if (normalized.length === 0 || normalized.length > 24) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export default function Vec3PlaneLab({
  shape = 'cube',
  initialEdgeA,
  initialEdgeB,
  initialEdgeC,
  firstPoint,
  secondPoint,
  thirdPoint,
  probePoint,
  unitLabel = 'см',
  challenge = false,
}: Vec3PlaneLabProps) {
  const reactId = useId();
  const labId = `vec3-plane-lab-${reactId.replace(/:/g, '')}`;
  const isCube = shape !== 'box';

  const defaultA = safeEdge(initialEdgeA, isCube ? 6 : 4);
  const defaultB = safeEdge(initialEdgeB, isCube ? defaultA : 3);
  const defaultC = safeEdge(initialEdgeC, isCube ? defaultA : 6);
  const defaults = {
    firstPoint: safeNode(firstPoint, 'A1'),
    secondPoint: safeNode(secondPoint, 'B'),
    thirdPoint: safeNode(thirdPoint, 'D'),
    probePoint: safeNode(probePoint, 'A'),
  };

  const [edgeA, setEdgeA] = useState(defaultA);
  const [edgeB, setEdgeB] = useState(isCube ? defaultA : defaultB);
  const [edgeC, setEdgeC] = useState(isCube ? defaultA : defaultC);
  const [nodes, setNodes] = useState(defaults);
  const [azimuth, setAzimuth] = useState(DEFAULT_VIEW.azimuthDegrees);
  const [elevation, setElevation] = useState(DEFAULT_VIEW.elevationDegrees);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const dims: BoxDims = { a: edgeA, b: edgeB, c: edgeC };
  const view: ViewAngles = { azimuthDegrees: azimuth, elevationDegrees: elevation };

  const cornerA = boxPoint(nodes.firstPoint, dims);
  const cornerB = boxPoint(nodes.secondPoint, dims);
  const cornerC = boxPoint(nodes.thirdPoint, dims);
  const probe = boxPoint(nodes.probePoint, dims);
  const valid = pointsDefinePlane(cornerA, cornerB, cornerC);

  const equation = valid ? planeEquationThroughPoints(cornerA, cornerB, cornerC) : BASE_EQUATION;
  const normal = planeNormal(equation);
  const plane = planeFromEquation(equation);
  const distance = valid ? distanceToPlaneEquation(probe, equation) : 0;
  const foot = valid ? projectPointOntoPlane(probe, plane) : probe;
  const tilt = valid ? angleBetweenPlanesDegrees(plane, planeFromEquation(BASE_EQUATION)) : 0;

  const parsedAnswer = parseAnswer(answer);
  const answerCorrect = parsedAnswer !== null && Math.abs(parsedAnswer - distance) <= 0.011;
  const reveal = !challenge || checked;

  const planeName = `${boxNode(nodes.firstPoint).label}${boxNode(nodes.secondPoint).label}${boxNode(nodes.thirdPoint).label}`;
  const probeName = boxNode(nodes.probePoint).label;

  const screen = useMemo(() => {
    const corners = CUBE_EDGES.flatMap((edge) => [edge.from, edge.to]);
    const unique = [...new Set(corners)];
    const spatial: Point3[] = unique.map((name) => boxPoint(name, dims));
    const flat = spatial.map((point) => projectAxonometric(point, view));
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
    return (point: Point3): ScreenPoint => {
      const projected = projectAxonometric(point, view);
      return {
        x: WIDTH / 2 + (projected.x - centerX) * scale,
        y: HEIGHT / 2 - (projected.y - centerY) * scale,
      };
    };
  }, [edgeA, edgeB, edgeC, azimuth, elevation]);

  const eye = cameraDirection(view);
  const visibleFaces = BOX_FACES.filter((face) => dot3(face.outward, eye) > 0);
  const nodeScreen = (id: string): ScreenPoint => screen(boxPoint(id, dims));
  const path = (from: ScreenPoint, to: ScreenPoint): string => `M${from.x} ${from.y} L${to.x} ${to.y}`;
  const edgePath = (fromId: string, toId: string): string => path(nodeScreen(fromId), nodeScreen(toId));
  const boxCenter = screen(boxPoint('O', dims));

  const labelPosition = (point: ScreenPoint, shift = 24): ScreenPoint => {
    const dx = point.x - boxCenter.x;
    const dy = point.y - boxCenter.y;
    const norm = Math.hypot(dx, dy) || 1;
    return { x: point.x + (dx / norm) * shift, y: point.y + (dy / norm) * shift + 5 };
  };

  const axisEnd = (direction: Vec3): Point3 => vec3(
    direction.x * dims.a * 1.28,
    direction.y * dims.b * 1.28,
    direction.z * dims.c * 1.28,
  );
  const origin = boxPoint('A', dims);
  const axes: readonly { readonly name: string; readonly end: Point3 }[] = [
    { name: 'x', end: axisEnd(vec3(1, 0, 0)) },
    { name: 'y', end: axisEnd(vec3(0, 1, 0)) },
    { name: 'z', end: axisEnd(vec3(0, 0, 1)) },
  ];

  const changeNode = (key: keyof typeof defaults, value: string) => {
    setNodes((current) => ({ ...current, [key]: safeNode(value, current[key]) }));
    setChecked(false);
  };

  const changeEdge = (axis: 'a' | 'b' | 'c', value: number) => {
    setChecked(false);
    if (isCube) {
      const next = safeEdge(value, defaultA);
      setEdgeA(next);
      setEdgeB(next);
      setEdgeC(next);
      return;
    }
    if (axis === 'a') setEdgeA(safeEdge(value, defaultA));
    if (axis === 'b') setEdgeB(safeEdge(value, defaultB));
    if (axis === 'c') setEdgeC(safeEdge(value, defaultC));
  };

  const reset = () => {
    setEdgeA(defaultA);
    setEdgeB(isCube ? defaultA : defaultB);
    setEdgeC(isCube ? defaultA : defaultC);
    setNodes(defaults);
    setAzimuth(DEFAULT_VIEW.azimuthDegrees);
    setElevation(DEFAULT_VIEW.elevationDegrees);
    setAnswer('');
    setChecked(false);
  };

  const result = (() => {
    if (!valid) {
      return {
        symbol: '!',
        headline: 'Через выбранные точки проходит не одна плоскость.',
        detail: 'Точки совпали или лежат на одной прямой. Выбери три точки, не лежащие на одной прямой.',
      };
    }
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: `Плоскость ${planeName} и точка ${probeName}.`,
        detail: 'Составь уравнение плоскости, подставь координаты точки и раздели модуль результата на длину нормали. Ответ вводи с точностью до 0,01.',
      };
    }
    const headlinePrefix = challenge ? (answerCorrect ? 'Верно. ' : 'Точный ответ. ') : '';
    return {
      symbol: challenge ? (answerCorrect ? '✓' : '×') : '⟂',
      headline: `${headlinePrefix}${formatPlaneEquation(equation)}; расстояние от ${probeName} равно ${formatNumber(distance, 2)} ${unitLabel}.`,
      detail: `Нормаль ${formatVec3(normal)}, её длина ${formatNumber(length3(normal), 3)}. Подстановка ${probeName}${formatVec3(probe)} в левую часть даёт ${formatNumber(planeEquationValue(equation, probe), 2)}; модуль этого числа делим на длину нормали. Наклон плоскости к нижней грани: ${formatNumber(tilt, 1)}°.`,
    };
  })();

  const description = `Прямоугольный параллелепипед ABCDA₁B₁C₁D₁ с рёбрами ${formatNumber(dims.a, 2)}, ${formatNumber(dims.b, 2)} и ${formatNumber(dims.c, 2)} ${unitLabel} в параллельной проекции. Через точки ${planeName} проведена плоскость${valid ? ` с уравнением ${formatPlaneEquation(equation)}` : ''}. Из точки ${probeName} опущен перпендикуляр на эту плоскость длиной ${formatNumber(distance, 2)} ${unitLabel}. Поворот ${formatNumber(azimuth, 0)}°, подъём ${formatNumber(elevation, 0)}°.`;

  const selectors: readonly { readonly key: keyof typeof defaults; readonly label: string }[] = [
    { key: 'firstPoint', label: 'Плоскость: первая точка' },
    { key: 'secondPoint', label: 'Плоскость: вторая точка' },
    { key: 'thirdPoint', label: 'Плоскость: третья точка' },
    { key: 'probePoint', label: 'Точка, до которой меряем' },
  ];

  const markedNodes = [nodes.firstPoint, nodes.secondPoint, nodes.thirdPoint, nodes.probePoint];

  return (
    <section className="dm-lab dm-geometry-solid-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория плоскостей в координатах</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Уравнение плоскости и расстояние до неё</h3>
          <p>
            Через три выбранные точки тела проходит единственная плоскость. Лаборатория составляет её уравнение,
            показывает нормаль и опускает перпендикуляр из четвёртой точки — всё это счётом по координатам, а не по чертежу.
          </p>
        </div>
        <span className="dm-lab__badge">d = |ax₀ + by₀ + cz₀ + d| : √(a² + b² + c²)</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-lab__controls dm-geometry-controls">
          {isCube ? (
            <div className="dm-field">
              <label htmlFor={`${labId}-edge`}>Ребро куба <span className="dm-field__value">{formatNumber(edgeA, 0)} {unitLabel}</span></label>
              <input
                id={`${labId}-edge`}
                type="range"
                min={EDGE_RANGE.minimum}
                max={EDGE_RANGE.maximum}
                step={EDGE_RANGE.step}
                value={edgeA}
                aria-valuetext={`${formatNumber(edgeA, 0)} ${unitLabel}`}
                onChange={(event) => changeEdge('a', Number(event.target.value))}
              />
            </div>
          ) : (
            <>
              <div className="dm-field">
                <label htmlFor={`${labId}-edge-a`}>Ребро AB <span className="dm-field__value">{formatNumber(edgeA, 0)} {unitLabel}</span></label>
                <input id={`${labId}-edge-a`} type="range" min={EDGE_RANGE.minimum} max={EDGE_RANGE.maximum} step={EDGE_RANGE.step} value={edgeA} aria-valuetext={`${formatNumber(edgeA, 0)} ${unitLabel}`} onChange={(event) => changeEdge('a', Number(event.target.value))} />
              </div>
              <div className="dm-field">
                <label htmlFor={`${labId}-edge-b`}>Ребро AD <span className="dm-field__value">{formatNumber(edgeB, 0)} {unitLabel}</span></label>
                <input id={`${labId}-edge-b`} type="range" min={EDGE_RANGE.minimum} max={EDGE_RANGE.maximum} step={EDGE_RANGE.step} value={edgeB} aria-valuetext={`${formatNumber(edgeB, 0)} ${unitLabel}`} onChange={(event) => changeEdge('b', Number(event.target.value))} />
              </div>
              <div className="dm-field">
                <label htmlFor={`${labId}-edge-c`}>Ребро AA₁ <span className="dm-field__value">{formatNumber(edgeC, 0)} {unitLabel}</span></label>
                <input id={`${labId}-edge-c`} type="range" min={EDGE_RANGE.minimum} max={EDGE_RANGE.maximum} step={EDGE_RANGE.step} value={edgeC} aria-valuetext={`${formatNumber(edgeC, 0)} ${unitLabel}`} onChange={(event) => changeEdge('c', Number(event.target.value))} />
              </div>
            </>
          )}
        </div>

        <div className="dm-lab__controls dm-ratio-controls">
          {selectors.map((selector) => (
            <div className="dm-field dm-ratio-field" key={selector.key}>
              <label htmlFor={`${labId}-${selector.key}`}>{selector.label}</label>
              <select
                id={`${labId}-${selector.key}`}
                value={nodes[selector.key]}
                onChange={(event) => changeNode(selector.key, event.target.value)}
              >
                {GROUP_ORDER.map((group) => (
                  <optgroup label={BOX_NODE_GROUP_LABELS[group]} key={group}>
                    {BOX_NODES.filter((node) => node.group === group).map((node) => (
                      <option value={node.id} key={node.id}>{node.title}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
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
              onChange={(event) => setAzimuth(Math.round(Number(event.target.value)))}
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
              onChange={(event) => setElevation(Math.round(Number(event.target.value)))}
            />
          </div>
        </div>
        <p id={`${labId}-view-hint`}>
          Проекция параллельная: перпендикуляр к плоскости почти никогда не выглядит на рисунке прямым углом.
          Прямой угол здесь — результат вычисления, а не картинки.
        </p>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемая модель тела с секущей плоскостью" tabIndex={0}>
          <svg className="dm-geometry-grid" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${labId}-title ${labId}-desc`}>
            <title id={`${labId}-title`}>Плоскость через три точки параллелепипеда</title>
            <desc id={`${labId}-desc`}>{description}</desc>
            <rect className="dm-geometry-grid__background" x="0" y="0" width={WIDTH} height={HEIGHT} rx="18" />
            <g aria-hidden="true">
              {visibleFaces.map((face) => (
                <polygon
                  key={face.id}
                  className="dm-geometry-solid__top"
                  points={face.loop.map((name) => { const p = nodeScreen(name); return `${p.x},${p.y}`; }).join(' ')}
                />
              ))}
            </g>
            <g aria-hidden="true">
              {CUBE_EDGES.filter((edge) => isCubeEdgeHidden(edge.id, view)).map((edge) => (
                <path key={edge.id} className="dm-geometry-solid__hidden" d={edgePath(edge.from, edge.to)} />
              ))}
            </g>
            <g className="dm-geometry-solid__body" fill="none" aria-hidden="true">
              {CUBE_EDGES.filter((edge) => !isCubeEdgeHidden(edge.id, view)).map((edge) => (
                <path key={edge.id} d={edgePath(edge.from, edge.to)} />
              ))}
            </g>
            <g className="dm-geometry-static__axis" fill="none" aria-hidden="true">
              {axes.map((axis) => {
                const start = screen(origin);
                const end = screen(axis.end);
                return <path key={axis.name} d={path(start, end)} />;
              })}
            </g>
            <g className="dm-geometry-figure__dimensions" aria-hidden="true">
              {axes.map((axis) => {
                const end = screen(axis.end);
                return <text key={axis.name} x={end.x} y={end.y - 8} textAnchor="middle">{axis.name}</text>;
              })}
            </g>

            {valid && (
              <g aria-hidden="true">
                <polygon
                  className="dm-geometry-figure__shape"
                  points={[nodes.firstPoint, nodes.secondPoint, nodes.thirdPoint]
                    .map((id) => { const p = nodeScreen(id); return `${p.x},${p.y}`; })
                    .join(' ')}
                />
              </g>
            )}

            {valid && reveal && distance > 1e-9 && (
              <g aria-hidden="true">
                <path className="dm-geometry-grid__perpendicular" d={path(screen(probe), screen(foot))} />
                <circle className="dm-geometry-static__point" cx={screen(foot).x} cy={screen(foot).y} r="5" />
              </g>
            )}

            <g className="dm-geometry-grid__point" aria-hidden="true">
              {[...new Set(markedNodes)].map((id) => {
                const point = nodeScreen(id);
                const label = labelPosition(point);
                return (
                  <g key={id}>
                    <circle cx={point.x} cy={point.y} r="6" />
                    <text x={label.x} y={label.y} textAnchor="middle">{boxNode(id).label}</text>
                  </g>
                );
              })}
            </g>

            {valid && reveal && (
              <g className="dm-geometry-figure__dimensions" aria-hidden="true">
                <text x={WIDTH - 22} y={30} textAnchor="end">{formatPlaneEquation(equation)}</text>
                <text x={WIDTH - 22} y={54} textAnchor="end">
                  ρ({probeName}) = {formatNumber(distance, 2)} {unitLabel}
                </text>
              </g>
            )}
          </svg>
        </div>

        {challenge && valid && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>Моё расстояние от {probeName} до плоскости {planeName}, {unitLabel}</label>
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
