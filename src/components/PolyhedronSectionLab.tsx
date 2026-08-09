import { useId, useMemo, useState } from 'react';
import {
  CUBE_EDGES,
  CUBE_VERTEX_LABELS,
  applyTransform,
  cubeModel,
  cubeSectionFromEdges,
  fitToBox,
  projectPoint,
  visibleEdges,
  type CubeSection,
  type EdgeSelection,
  type Point2,
  type Vec3,
} from '../lib/polyhedra';

export type SectionPreset = 'triangle' | 'diagonal' | 'pentagon' | 'hexagon';
export type SectionUnit = 'cm' | 'dm' | 'm';

export interface PolyhedronSectionLabProps {
  initialPreset?: SectionPreset;
  initialEdge?: number;
  unit?: SectionUnit;
  challenge?: boolean;
}

interface PresetDefinition {
  readonly label: string;
  readonly hint: string;
  readonly points: readonly EdgeSelection[];
}

const PRESETS: Readonly<Record<SectionPreset, PresetDefinition>> = {
  triangle: {
    label: 'Треугольник у вершины',
    hint: 'Три середины рёбер, выходящих из одной вершины. Плоскость встречает только три грани.',
    points: [{ edgeId: 'AB', t: 0.5 }, { edgeId: 'AD', t: 0.5 }, { edgeId: 'AA1', t: 0.5 }],
  },
  diagonal: {
    label: 'Диагональное сечение',
    hint: 'Плоскость через A, C и A₁ содержит диагональ основания AC и вертикальные рёбра.',
    points: [{ edgeId: 'AA1', t: 0 }, { edgeId: 'CD', t: 0 }, { edgeId: 'A1D1', t: 0 }],
  },
  pentagon: {
    label: 'Пятиугольник',
    hint: 'Плоскость пересекает пять из шести граней куба.',
    points: [{ edgeId: 'AB', t: 0.5 }, { edgeId: 'AD', t: 0.5 }, { edgeId: 'CC1', t: 0.5 }],
  },
  hexagon: {
    label: 'Правильный шестиугольник',
    hint: 'Середины шести рёбер: плоскость проходит через центр куба перпендикулярно диагонали DB₁.',
    points: [{ edgeId: 'AB', t: 0.5 }, { edgeId: 'BC', t: 0.5 }, { edgeId: 'CC1', t: 0.5 }],
  },
};

const PRESET_ORDER: readonly SectionPreset[] = ['triangle', 'diagonal', 'pentagon', 'hexagon'];
const UNITS: readonly SectionUnit[] = ['cm', 'dm', 'm'];
const UNIT_LABELS: Readonly<Record<SectionUnit, string>> = { cm: 'см', dm: 'дм', m: 'м' };
const SIDE_OPTIONS: readonly number[] = [3, 4, 5, 6];
const POINT_NAMES: readonly string[] = ['M', 'N', 'K'];

const VIEW_WIDTH = 620;
const VIEW_HEIGHT = 460;
const VIEW_PADDING = 58;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatNumber(value: number, digits = 2): string {
  return String(round(value, digits)).replace('.', ',');
}

function safePreset(value: SectionPreset | undefined): SectionPreset {
  return value !== undefined && PRESET_ORDER.includes(value) ? value : 'triangle';
}

function safeUnit(value: SectionUnit | undefined): SectionUnit {
  return value !== undefined && UNITS.includes(value) ? value : 'cm';
}

function safeEdge(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 6;
  return Math.min(12, Math.max(1, Math.round(value)));
}

function edgeLabel(edgeId: string): string {
  return CUBE_EDGES.find((edge) => edge.id === edgeId)?.label ?? edgeId;
}

export default function PolyhedronSectionLab({
  initialPreset,
  initialEdge,
  unit,
  challenge = false,
}: PolyhedronSectionLabProps) {
  const reactId = useId();
  const labId = `polyhedron-section-${reactId.replace(/:/g, '')}`;
  const defaultPreset = safePreset(initialPreset);
  const defaultEdge = safeEdge(initialEdge);
  const unitKey = safeUnit(unit);
  const unitLabel = UNIT_LABELS[unitKey];

  const [selections, setSelections] = useState<readonly EdgeSelection[]>(PRESETS[defaultPreset].points);
  const [edge, setEdge] = useState(defaultEdge);
  const [guess, setGuess] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  const cube = useMemo(() => cubeModel(edge), [edge]);

  const layout = useMemo(() => {
    const flat = cube.vertices.map((vertex) => projectPoint(vertex, 'cabinet'));
    const transform = fitToBox(flat, { width: VIEW_WIDTH, height: VIEW_HEIGHT, padding: VIEW_PADDING });
    const project = (point: Vec3): Point2 => applyTransform(projectPoint(point, 'cabinet'), transform);
    return {
      project,
      screen: flat.map((point) => applyTransform(point, transform)),
      visibility: visibleEdges(cube, 'cabinet'),
      center: project({ x: edge / 2, y: edge / 2, z: edge / 2 }),
    };
  }, [cube, edge]);

  const chosenPoints = useMemo(
    () => selections.map((selection) => {
      const definition = CUBE_EDGES.find((item) => item.id === selection.edgeId);
      if (!definition) return { x: 0, y: 0, z: 0 };
      const from = cube.vertices[definition.from] as Vec3;
      const to = cube.vertices[definition.to] as Vec3;
      return {
        x: from.x + (to.x - from.x) * selection.t,
        y: from.y + (to.y - from.y) * selection.t,
        z: from.z + (to.z - from.z) * selection.t,
      };
    }),
    [cube.vertices, selections],
  );

  const outcome = useMemo<{ section: CubeSection | null; error: string | null }>(() => {
    try {
      return { section: cubeSectionFromEdges(selections, edge), error: null };
    } catch (error) {
      return { section: null, error: error instanceof Error ? error.message : 'Сечение не построено' };
    }
  }, [edge, selections]);

  const section = outcome.section;
  const reveal = !challenge || checked;
  const guessCorrect = section !== null && guess === section.sides;

  const applyPreset = (preset: SectionPreset) => {
    setSelections(PRESETS[preset].points);
    setGuess(null);
    setChecked(false);
  };

  const updateSelection = (index: number, patch: Partial<EdgeSelection>) => {
    setSelections((current) => current.map((item, position) => (position === index ? { ...item, ...patch } : item)));
    setChecked(false);
  };

  const activePreset = PRESET_ORDER.find((preset) => PRESETS[preset].points.every(
    (point, index) => selections[index]?.edgeId === point.edgeId && Math.abs((selections[index]?.t ?? -1) - point.t) < 1e-9,
  ));

  const result = (() => {
    if (outcome.error) {
      return {
        symbol: '×',
        headline: 'Плоскость не задана.',
        detail: `${outcome.error}. Передвинь одну из точек: три точки не должны лежать на одной прямой.`,
      };
    }
    if (section === null) return { symbol: '×', headline: 'Сечение не построено.', detail: 'Измени положение точек.' };
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: 'Сколько сторон будет у сечения?',
        detail: 'Посчитай, скольких граней куба касается плоскость: столько сторон и получится. Затем нажми «Проверить».',
      };
    }
    const regularNote = section.regular ? ' Все стороны равны.' : '';
    const sidesWord = section.sides <= 4 ? 'стороны' : 'сторон';
    return {
      symbol: challenge ? (guessCorrect ? '✓' : '×') : '◆',
      headline: `Сечение — ${section.shape}: ${section.sides} ${sidesWord}.`,
      detail: `Периметр ${formatNumber(section.perimeter)} ${unitLabel}, площадь ${formatNumber(section.area)} ${unitLabel}².${regularNote} Стороны: ${section.sideLengths.map((value) => formatNumber(value)).join('; ')} ${unitLabel}.`,
    };
  })();

  const sectionPath = section !== null
    ? section.vertices.map((vertex) => {
      const point = layout.project(vertex);
      return `${round(point.x, 2)},${round(point.y, 2)}`;
    }).join(' ')
    : '';

  return (
    <section className="dm-lab dm-geometry-solid-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория сечений</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Сечение куба плоскостью через три точки</h3>
          <p>Поставь три точки на рёбрах куба ABCDA₁B₁C₁D₁ — лаборатория найдёт все точки пересечения плоскости с рёбрами и соберёт из них многоугольник.</p>
        </div>
        <span className="dm-lab__badge">{reveal && section ? `${section.sides} стороны` : '3 точки'}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-preset-buttons" role="group" aria-label="Готовые расположения точек">
          {PRESET_ORDER.map((preset) => (
            <button
              type="button"
              key={preset}
              aria-pressed={activePreset === preset}
              className={activePreset === preset ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'}
              onClick={() => applyPreset(preset)}
            >{PRESETS[preset].label}</button>
          ))}
        </div>

        <div className="dm-lab__controls">
          {selections.map((selection, index) => {
            const selectId = `${labId}-edge-${index}`;
            const rangeId = `${labId}-t-${index}`;
            return (
              <div className="dm-field dm-ratio-field" key={POINT_NAMES[index]}>
                <label htmlFor={selectId}>
                  Точка {POINT_NAMES[index]} на ребре
                  <span className="dm-field__value">{edgeLabel(selection.edgeId)}</span>
                </label>
                <select
                  id={selectId}
                  value={selection.edgeId}
                  onChange={(event) => updateSelection(index, { edgeId: event.target.value })}
                >
                  {CUBE_EDGES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                </select>
                <label htmlFor={rangeId}>
                  Доля от начала ребра
                  <span className="dm-field__value">{formatNumber(selection.t)}</span>
                </label>
                <input
                  id={rangeId}
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selection.t}
                  aria-valuetext={`${formatNumber(selection.t)} длины ребра ${edgeLabel(selection.edgeId)}`}
                  onChange={(event) => updateSelection(index, { t: Number(event.target.value) })}
                />
              </div>
            );
          })}
        </div>

        <div className="dm-field dm-ratio-field">
          <label htmlFor={`${labId}-edge-length`}>
            Ребро куба
            <span className="dm-field__value">{edge} {unitLabel}</span>
          </label>
          <input
            id={`${labId}-edge-length`}
            type="range"
            min={1}
            max={12}
            step={1}
            value={edge}
            aria-valuetext={`${edge} ${unitLabel}`}
            onChange={(event) => { setEdge(safeEdge(Number(event.target.value))); setChecked(false); }}
          />
        </div>

        <p>{activePreset ? PRESETS[activePreset].hint : 'Три точки на рёбрах задают единственную плоскость, если они не лежат на одной прямой.'}</p>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж куба с сечением" tabIndex={0}>
          <svg className="dm-geometry-solid" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-labelledby={`${labId}-svg-title ${labId}-svg-desc`}>
            <title id={`${labId}-svg-title`}>Куб ABCDA₁B₁C₁D₁ с секущей плоскостью</title>
            <desc id={`${labId}-svg-desc`}>
              {`Куб с ребром ${edge} ${unitLabel} изображён кабинетной проекцией: ось глубины идёт под 45° и сокращена вдвое, невидимые рёбра CD, AD и DD₁ показаны штрихами. `}
              {selections.map((selection, index) => `Точка ${POINT_NAMES[index]} делит ребро ${edgeLabel(selection.edgeId)} в отношении ${formatNumber(selection.t)} от первой вершины.`).join(' ')}
              {reveal && section ? ` Многоугольник сечения — ${section.shape} с ${section.sides} вершинами, его площадь ${formatNumber(section.area)} ${unitLabel} в квадрате.` : ' Многоугольник сечения пока не показан.'}
            </desc>

            <g className="dm-geometry-solid__body">
              {cube.edges.map(([from, to], index) => {
                if (!layout.visibility[index]) return null;
                const start = layout.screen[from] as Point2;
                const end = layout.screen[to] as Point2;
                return <line key={`edge-${index}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
              })}
              <path
                className="dm-geometry-solid__hidden"
                d={cube.edges
                  .map(([from, to], index) => {
                    if (layout.visibility[index]) return '';
                    const start = layout.screen[from] as Point2;
                    const end = layout.screen[to] as Point2;
                    return `M${round(start.x, 2)} ${round(start.y, 2)} L${round(end.x, 2)} ${round(end.y, 2)}`;
                  })
                  .filter(Boolean)
                  .join(' ') || 'M0 0'}
              />
            </g>

            {reveal && section !== null && (
              <polygon className="dm-geometry-figure__shape" points={sectionPath} />
            )}

            <g className="dm-geometry-polygon__vertex">
              {cube.vertices.map((vertex, index) => {
                const point = layout.screen[index] as Point2;
                const dx = point.x - layout.center.x;
                const dy = point.y - layout.center.y;
                const size = Math.max(Math.hypot(dx, dy), 1);
                return (
                  <text
                    key={`label-${index}`}
                    x={round(point.x + (dx / size) * 24, 1)}
                    y={round(point.y + (dy / size) * 24 + 6, 1)}
                    textAnchor="middle"
                  >{CUBE_VERTEX_LABELS[index]}</text>
                );
              })}
              {chosenPoints.map((point, index) => {
                const screen = layout.project(point);
                return (
                  <g key={`point-${index}`}>
                    <circle cx={round(screen.x, 2)} cy={round(screen.y, 2)} r={7} />
                    <text x={round(screen.x, 1)} y={round(screen.y - 14, 1)} textAnchor="middle">{POINT_NAMES[index]}</text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {challenge && (
          <fieldset className="dm-geometry-challenge">
            <legend>Сколько сторон у многоугольника сечения?</legend>
            {SIDE_OPTIONS.map((option) => (
              <label key={option}>
                <input
                  type="radio"
                  name={`${labId}-guess`}
                  checked={guess === option}
                  onChange={() => { setGuess(option); setChecked(false); }}
                />
                {option}
              </label>
            ))}
            <button className="dm-button" type="button" disabled={guess === null} onClick={() => setChecked(true)}>Проверить</button>
          </fieldset>
        )}

        {reveal && section !== null && (
          <div className="dm-table-wrap">
            <table className="dm-ratio-table">
              <caption>Вершины сечения; начало координат — вершина A, ось z вдоль ребра AA₁</caption>
              <thead>
                <tr>
                  <th scope="col">Вершина</th>
                  <th scope="col">x</th>
                  <th scope="col">y</th>
                  <th scope="col">z</th>
                  <th scope="col">Сторона до следующей, {unitLabel}</th>
                </tr>
              </thead>
              <tbody>
                {section.vertices.map((vertex, index) => (
                  <tr key={`row-${index}`}>
                    <th scope="row">{index + 1}</th>
                    <td>{formatNumber(vertex.x)}</td>
                    <td>{formatNumber(vertex.y)}</td>
                    <td>{formatNumber(vertex.z)}</td>
                    <td>{formatNumber(section.sideLengths[index] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span>
          <p>
            <strong>{result.headline}</strong>
            <small>{result.detail}</small>
          </p>
        </div>

        <button
          className="dm-button dm-button--secondary dm-lab__reset"
          type="button"
          onClick={() => { setSelections(PRESETS[defaultPreset].points); setEdge(defaultEdge); setGuess(null); setChecked(false); }}
        >↺ Вернуть пример</button>
      </div>
    </section>
  );
}
