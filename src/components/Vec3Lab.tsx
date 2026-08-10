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
  angleBetweenLinesDegrees,
  angleBetweenVectorsDegrees,
  boxNode,
  boxPoint,
  boxSegmentName,
  boxVector,
  cameraDirection,
  cosineBetween3,
  dot3,
  formatNumber,
  formatVec3,
  isCubeEdgeHidden,
  isZeroVec3,
  length3,
  projectAxonometric,
  vec3,
} from '../lib/vectors3d';

export type Vec3LabMode = 'vector' | 'dot';

export interface Vec3LabProps {
  /** `vector` — координаты и длина одного вектора; `dot` — скалярное произведение и угол. */
  mode?: Vec3LabMode;
  /** `cube` — одно ребро на все три направления, `box` — три независимых ребра. */
  shape?: 'cube' | 'box';
  /** Начальные рёбра AB, AD и AA₁. */
  initialEdgeA?: number;
  initialEdgeB?: number;
  initialEdgeC?: number;
  /** Узлы первого вектора: id из BOX_NODES, например `A` или `M-CC1`. */
  firstFrom?: string;
  firstTo?: string;
  /** Узлы второго вектора; используются в режиме `dot`. */
  secondFrom?: string;
  secondTo?: string;
  unitLabel?: string;
  /** Режим задачи: ответ не показывается до нажатия «Проверить». */
  challenge?: boolean;
}

const WIDTH = 720;
const HEIGHT = 470;
const PADDING = 78;
const EDGE_RANGE = { minimum: 1, maximum: 8, step: 1 };
const GROUP_ORDER: readonly BoxNodeGroup[] = ['vertex', 'edge', 'face', 'center'];

function safeNode(value: string | undefined, fallback: string): string {
  return value !== undefined && BOX_NODES.some((node) => node.id === value) ? value : fallback;
}

function safeEdge(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(EDGE_RANGE.minimum, Math.min(EDGE_RANGE.maximum, Math.round(value)));
}

function clampEdge(value: number, fallback: number): number {
  return safeEdge(value, fallback);
}

function parseAnswer(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.').replace('−', '-');
  if (normalized.length === 0 || normalized.length > 24) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export default function Vec3Lab({
  mode = 'vector',
  shape = 'cube',
  initialEdgeA,
  initialEdgeB,
  initialEdgeC,
  firstFrom,
  firstTo,
  secondFrom,
  secondTo,
  unitLabel = 'см',
  challenge = false,
}: Vec3LabProps) {
  const reactId = useId();
  const labId = `vec3-lab-${reactId.replace(/:/g, '')}`;
  const activeMode: Vec3LabMode = mode === 'dot' ? 'dot' : 'vector';
  const isCube = shape !== 'box';

  const defaultA = safeEdge(initialEdgeA, isCube ? 4 : 2);
  const defaultB = safeEdge(initialEdgeB, isCube ? defaultA : 3);
  const defaultC = safeEdge(initialEdgeC, isCube ? defaultA : 6);
  const defaults = {
    firstFrom: safeNode(firstFrom, 'A'),
    firstTo: safeNode(firstTo, 'C1'),
    secondFrom: safeNode(secondFrom, 'B'),
    secondTo: safeNode(secondTo, 'D1'),
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

  const first = boxVector(nodes.firstFrom, nodes.firstTo, dims);
  const second = boxVector(nodes.secondFrom, nodes.secondTo, dims);
  const firstName = boxSegmentName(nodes.firstFrom, nodes.firstTo);
  const secondName = boxSegmentName(nodes.secondFrom, nodes.secondTo);
  const firstLength = length3(first);
  const secondLength = length3(second);
  const degenerate = isZeroVec3(first) || (activeMode === 'dot' && isZeroVec3(second));
  const product = dot3(first, second);
  const cosine = degenerate ? 0 : cosineBetween3(first, second);
  const vectorAngle = degenerate ? 0 : angleBetweenVectorsDegrees(first, second);
  const lineAngle = degenerate ? 0 : angleBetweenLinesDegrees(first, second);

  const target = activeMode === 'dot' ? vectorAngle : firstLength;
  const tolerance = activeMode === 'dot' ? 0.5 : 0.011;
  const parsedAnswer = parseAnswer(answer);
  const answerCorrect = parsedAnswer !== null && Math.abs(parsedAnswer - target) <= tolerance;
  const reveal = !challenge || checked;

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
  const segment = (fromId: string, toId: string): string => {
    const start = nodeScreen(fromId);
    const end = nodeScreen(toId);
    return `M${start.x} ${start.y} L${end.x} ${end.y}`;
  };
  const boxCenter = screen(boxPoint('O', dims));

  /** Наконечник стрелки строится в экранных координатах уже спроецированного отрезка. */
  const arrowHead = (from: ScreenPoint, to: ScreenPoint): string => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const norm = Math.hypot(dx, dy) || 1;
    const ux = dx / norm;
    const uy = dy / norm;
    const size = Math.min(16, norm / 2.4);
    const baseX = to.x - ux * size;
    const baseY = to.y - uy * size;
    const half = size * 0.42;
    return `${to.x},${to.y} ${baseX - uy * half},${baseY + ux * half} ${baseX + uy * half},${baseY - ux * half}`;
  };

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
      const next = clampEdge(value, defaultA);
      setEdgeA(next);
      setEdgeB(next);
      setEdgeC(next);
      return;
    }
    if (axis === 'a') setEdgeA(clampEdge(value, defaultA));
    if (axis === 'b') setEdgeB(clampEdge(value, defaultB));
    if (axis === 'c') setEdgeC(clampEdge(value, defaultC));
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
    if (degenerate) {
      return {
        symbol: '!',
        headline: 'Начало и конец вектора совпали.',
        detail: 'У нулевого вектора нет направления, поэтому угол не определён. Выбери две различные точки.',
      };
    }
    if (activeMode === 'vector') {
      if (challenge && !checked) {
        return {
          symbol: '?',
          headline: `Вектор ${firstName} в теле с рёбрами ${formatNumber(dims.a, 2)}, ${formatNumber(dims.b, 2)} и ${formatNumber(dims.c, 2)} ${unitLabel}.`,
          detail: 'Запиши координаты вектора, найди его длину и введи ответ с точностью до 0,01.',
        };
      }
      const headline = challenge
        ? (answerCorrect ? `Верно: ${firstName} = ${formatVec3(first)}, длина ${formatNumber(firstLength, 2)} ${unitLabel}.` : `${firstName} = ${formatVec3(first)}, длина ${formatNumber(firstLength, 2)} ${unitLabel}.`)
        : `${firstName} = ${formatVec3(first)}, длина ${formatNumber(firstLength, 2)} ${unitLabel}.`;
      return {
        symbol: challenge ? (answerCorrect ? '✓' : '×') : '→',
        headline,
        detail: `Координаты вектора — это разности координат конца и начала. Длина: √(${formatNumber(first.x, 2)}² + ${formatNumber(first.y, 2)}² + ${formatNumber(first.z, 2)}²) = ${formatNumber(firstLength, 2)} ${unitLabel}.`,
      };
    }
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: `Векторы ${firstName} и ${secondName}.`,
        detail: 'Найди скалярное произведение, затем угол между векторами. Ответ вводи в градусах с точностью до 0,1.',
      };
    }
    const sign = product > 0 ? 'острый' : product < 0 ? 'тупой' : 'прямой';
    return {
      symbol: challenge ? (answerCorrect ? '✓' : '×') : '·',
      headline: `${firstName} · ${secondName} = ${formatNumber(product, 2)}; угол между векторами ${formatNumber(vectorAngle, 1)}°.`,
      detail: `${formatVec3(first)} · ${formatVec3(second)} = ${formatNumber(product, 2)}. Значит cos φ = ${formatNumber(product, 2)} : (${formatNumber(firstLength, 2)} · ${formatNumber(secondLength, 2)}) = ${formatNumber(cosine, 4)}, угол ${sign}. Угол между прямыми берётся по модулю косинуса и равен ${formatNumber(lineAngle, 1)}°.`,
    };
  })();

  const description = `Прямоугольный параллелепипед ABCDA₁B₁C₁D₁ с рёбрами ${formatNumber(dims.a, 2)}, ${formatNumber(dims.b, 2)} и ${formatNumber(dims.c, 2)} ${unitLabel} в параллельной проекции. Выделен вектор ${firstName} с координатами ${formatVec3(first)}${activeMode === 'dot' ? ` и вектор ${secondName} с координатами ${formatVec3(second)}` : ''}. Поворот ${formatNumber(azimuth, 0)}°, подъём ${formatNumber(elevation, 0)}°.`;

  const selectors: readonly { readonly key: keyof typeof defaults; readonly label: string }[] = activeMode === 'dot'
    ? [
      { key: 'firstFrom', label: 'Первый вектор: начало' },
      { key: 'firstTo', label: 'Первый вектор: конец' },
      { key: 'secondFrom', label: 'Второй вектор: начало' },
      { key: 'secondTo', label: 'Второй вектор: конец' },
    ]
    : [
      { key: 'firstFrom', label: 'Начало вектора' },
      { key: 'firstTo', label: 'Конец вектора' },
    ];

  const markedNodes = activeMode === 'dot'
    ? [nodes.firstFrom, nodes.firstTo, nodes.secondFrom, nodes.secondTo]
    : [nodes.firstFrom, nodes.firstTo];

  return (
    <section className="dm-lab dm-geometry-solid-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория векторов в пространстве</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {activeMode === 'dot' ? 'Скалярное произведение в теле' : 'Вектор по двум точкам тела'}
          </h3>
          <p>
            Начало координат стоит в вершине A, оси направлены по рёбрам AB, AD и AA₁. Выбирай точки — координаты и
            {activeMode === 'dot' ? ' угол' : ' длина'} пересчитываются по формулам, а не измеряются по рисунку.
          </p>
        </div>
        <span className="dm-lab__badge">{activeMode === 'dot' ? 'a · b = x₁x₂ + y₁y₂ + z₁z₂' : '|a| = √(x² + y² + z²)'}</span>
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
          Проекция параллельная и честная: экранные координаты получены скалярным умножением точки на два вектора
          картинной плоскости. Поэтому на рисунке углы и длины искажены — доверять нужно вычислениям в координатах.
        </p>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемая модель тела с векторами" tabIndex={0}>
          <svg className="dm-geometry-grid" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${labId}-title ${labId}-desc`}>
            <title id={`${labId}-title`}>Векторы в прямоугольном параллелепипеде</title>
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
                <path key={edge.id} className="dm-geometry-solid__hidden" d={segment(edge.from, edge.to)} />
              ))}
            </g>
            <g className="dm-geometry-solid__body" fill="none" aria-hidden="true">
              {CUBE_EDGES.filter((edge) => !isCubeEdgeHidden(edge.id, view)).map((edge) => (
                <path key={edge.id} d={segment(edge.from, edge.to)} />
              ))}
            </g>
            <g className="dm-geometry-static__axis" fill="none" aria-hidden="true">
              {axes.map((axis) => {
                const start = screen(origin);
                const end = screen(axis.end);
                return <path key={axis.name} d={`M${start.x} ${start.y} L${end.x} ${end.y}`} />;
              })}
            </g>
            <g className="dm-geometry-figure__dimensions" aria-hidden="true">
              {axes.map((axis) => {
                const end = screen(axis.end);
                return <text key={axis.name} x={end.x} y={end.y - 8} textAnchor="middle">{axis.name}</text>;
              })}
            </g>

            <g aria-hidden="true">
              <path className="dm-geometry-grid__route" d={segment(nodes.firstFrom, nodes.firstTo)} />
              <polygon
                className="dm-geometry-grid__route"
                points={arrowHead(nodeScreen(nodes.firstFrom), nodeScreen(nodes.firstTo))}
              />
              {activeMode === 'dot' && (
                <>
                  <path className="dm-geometry-angle__arc" d={segment(nodes.secondFrom, nodes.secondTo)} />
                  <polygon
                    className="dm-geometry-angle__arc"
                    points={arrowHead(nodeScreen(nodes.secondFrom), nodeScreen(nodes.secondTo))}
                  />
                </>
              )}
            </g>

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

            {reveal && !degenerate && (
              <g className="dm-geometry-figure__dimensions" aria-hidden="true">
                <text x={WIDTH - 22} y={30} textAnchor="end">
                  {activeMode === 'dot'
                    ? `${firstName} · ${secondName} = ${formatNumber(product, 2)}`
                    : `|${firstName}| = ${formatNumber(firstLength, 2)}`}
                </text>
                {activeMode === 'dot' && (
                  <text x={WIDTH - 22} y={54} textAnchor="end">φ = {formatNumber(vectorAngle, 1)}°</text>
                )}
              </g>
            )}
          </svg>
        </div>

        {challenge && !degenerate && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>
              {activeMode === 'dot' ? `Мой угол между ${firstName} и ${secondName}, градусы` : `Моя длина ${firstName}, ${unitLabel}`}
            </label>
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
