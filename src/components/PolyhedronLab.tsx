import { useEffect, useId, useMemo, useState } from 'react';
import {
  applyTransform,
  fitToBox,
  isFaceVisible,
  obliquePrismModel,
  obliquePyramidModel,
  outwardNormal,
  prismCounts,
  projectPoint,
  pyramidCounts,
  regularPrismSurface,
  regularPrismVolume,
  regularPyramidSurface,
  regularPyramidVolume,
  satisfiesEuler,
  visibleEdges,
  type Point2,
  type PolyhedronCounts,
  type ProjectionKind,
  type SolidModel,
  type Vec3,
} from '../lib/polyhedra';

export type PolyhedronKind = 'prism' | 'pyramid';
export type PolyhedronLabMode = 'counts' | 'surface' | 'volume';
export type PolyhedronUnit = 'cm' | 'dm' | 'm';

export interface PolyhedronLabProps {
  mode?: PolyhedronLabMode;
  initialSolid?: PolyhedronKind;
  initialSides?: number;
  initialSide?: number;
  initialHeight?: number;
  initialProjection?: ProjectionKind;
  unit?: PolyhedronUnit;
  challenge?: boolean;
}

const MODES: readonly PolyhedronLabMode[] = ['counts', 'surface', 'volume'];
const KINDS: readonly PolyhedronKind[] = ['prism', 'pyramid'];
const PROJECTIONS: readonly ProjectionKind[] = ['isometric', 'cabinet'];
const UNITS: readonly PolyhedronUnit[] = ['cm', 'dm', 'm'];
const SIDE_CHOICES: readonly number[] = [3, 4, 5, 6, 8];

const MODE_LABELS: Readonly<Record<PolyhedronLabMode, string>> = {
  counts: 'Элементы и Эйлер',
  surface: 'Площадь поверхности',
  volume: 'Объём',
};

/** Наклон: во сколько раз верх сдвинут в сторону относительно стороны основания. */
const LEAN_CHOICES: readonly number[] = [0, 0.7, 1.6];
const LEAN_LABELS: Readonly<Record<number, string>> = {
  0: 'Прямое тело',
  0.7: 'Наклон',
  1.6: 'Сильный наклон',
};
const KIND_LABELS: Readonly<Record<PolyhedronKind, string>> = {
  prism: 'Призма',
  pyramid: 'Пирамида',
};
const PROJECTION_LABELS: Readonly<Record<ProjectionKind, string>> = {
  isometric: 'Изометрия',
  cabinet: 'Кабинетная',
};
const UNIT_LABELS: Readonly<Record<PolyhedronUnit, string>> = { cm: 'см', dm: 'дм', m: 'м' };
const BASE_NAMES: Readonly<Record<number, string>> = {
  3: 'треугольная',
  4: 'четырёхугольная',
  5: 'пятиугольная',
  6: 'шестиугольная',
  8: 'восьмиугольная',
};

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 430;
const VIEW_PADDING = 62;
const DECIMAL_DRAFT = /^\d*(?:[.,]\d*)?$/;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatNumber(value: number, digits = 2): string {
  return String(round(value, digits)).replace('.', ',');
}

function parseDecimal(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (normalized === '' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeMode(value: PolyhedronLabMode | undefined): PolyhedronLabMode {
  return value !== undefined && MODES.includes(value) ? value : 'counts';
}

function safeKind(value: PolyhedronKind | undefined): PolyhedronKind {
  return value !== undefined && KINDS.includes(value) ? value : 'prism';
}

function safeProjection(value: ProjectionKind | undefined): ProjectionKind {
  return value !== undefined && PROJECTIONS.includes(value) ? value : 'isometric';
}

function safeUnit(value: PolyhedronUnit | undefined): PolyhedronUnit {
  return value !== undefined && UNITS.includes(value) ? value : 'cm';
}

function safeSides(value: number | undefined): number {
  return value !== undefined && SIDE_CHOICES.includes(value) ? value : 6;
}

function safeLength(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return round(clamp(value, 1, 40), 1);
}

interface LengthFieldProps {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

function LengthField({ id, label, unit, value, onChange }: LengthFieldProps) {
  const hintId = `${id}-hint`;
  const [draft, setDraft] = useState(formatNumber(value, 1));

  useEffect(() => setDraft(formatNumber(value, 1)), [value]);

  const commit = () => {
    const parsed = parseDecimal(draft);
    const next = parsed === null ? value : round(clamp(parsed, 1, 40), 1);
    setDraft(formatNumber(next, 1));
    onChange(next);
  };

  const nudge = (direction: -1 | 1) => onChange(round(clamp(value + direction, 1, 40), 1));

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>
        {label}
        <span className="dm-field__value">{formatNumber(value, 1)} {unit}</span>
      </label>
      <div className="dm-geometry-field__control">
        <button type="button" onClick={() => nudge(-1)} disabled={value <= 1} aria-label={`Уменьшить: ${label.toLowerCase()}`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          aria-describedby={hintId}
          onChange={(event) => {
            const raw = event.target.value.slice(0, 12);
            if (!DECIMAL_DRAFT.test(raw)) return;
            setDraft(raw);
            const parsed = parseDecimal(raw);
            if (parsed !== null && parsed >= 1 && parsed <= 40) onChange(round(parsed, 1));
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
          }}
        />
        <button type="button" onClick={() => nudge(1)} disabled={value >= 40} aria-label={`Увеличить: ${label.toLowerCase()}`}>+</button>
      </div>
      <small id={hintId}>От 1 до 40 {unit}; можно вводить десятичную дробь.</small>
    </div>
  );
}

interface FacePiece {
  readonly index: number;
  readonly points: string;
  readonly className: string;
  readonly depth: number;
}

function faceClassName(model: SolidModel, kind: PolyhedronKind, faceIndex: number): string {
  const baseFaces = kind === 'prism' ? 2 : 1;
  if (faceIndex < baseFaces) return 'dm-geometry-solid__top';
  return outwardNormal(model, faceIndex).y < 0 ? 'dm-geometry-solid__front' : 'dm-geometry-solid__side';
}

export default function PolyhedronLab({
  mode,
  initialSolid,
  initialSides,
  initialSide,
  initialHeight,
  initialProjection,
  unit,
  challenge = false,
}: PolyhedronLabProps) {
  const reactId = useId();
  const labId = `polyhedron-lab-${reactId.replace(/:/g, '')}`;
  const defaultMode = safeMode(mode);
  const defaultKind = safeKind(initialSolid);
  const defaultSides = safeSides(initialSides);
  const defaultSide = safeLength(initialSide, 4);
  const defaultHeight = safeLength(initialHeight, 7);
  const defaultProjection = safeProjection(initialProjection);
  const unitKey = safeUnit(unit);
  const unitLabel = UNIT_LABELS[unitKey];

  const [activeMode, setActiveMode] = useState(defaultMode);
  const [kind, setKind] = useState(defaultKind);
  const [sides, setSides] = useState(defaultSides);
  const [side, setSide] = useState(defaultSide);
  const [height, setHeight] = useState(defaultHeight);
  const [projection, setProjection] = useState(defaultProjection);
  const [showHeights, setShowHeights] = useState(true);
  const [lean, setLean] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  // Наклон имеет смысл только в режиме объёма: площади поверхности у наклонного тела другие.
  const leaning = activeMode === 'volume' ? lean : 0;
  const shift = round(leaning * side, 3);

  const model = useMemo<SolidModel>(
    () => (kind === 'prism'
      ? obliquePrismModel(sides, side, height, shift)
      : obliquePyramidModel(sides, side, height, shift)),
    [kind, sides, side, height, shift],
  );
  const counts: PolyhedronCounts = kind === 'prism' ? prismCounts(sides) : pyramidCounts(sides);
  const prism = useMemo(() => regularPrismSurface(sides, side, height), [sides, side, height]);
  const pyramid = useMemo(() => regularPyramidSurface(sides, side, height), [sides, side, height]);
  const surface = kind === 'prism' ? prism : pyramid;
  const prismBody = useMemo(() => regularPrismVolume(sides, side, height), [sides, side, height]);
  const pyramidBody = useMemo(() => regularPyramidVolume(sides, side, height), [sides, side, height]);
  const body = kind === 'prism' ? prismBody : pyramidBody;

  const picture = useMemo(() => {
    const flat = model.vertices.map((point) => projectPoint(point, projection));
    const extras: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: height },
    ];
    const flatExtras = extras.map((point) => projectPoint(point, projection));
    const transform = fitToBox([...flat, ...flatExtras], {
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      padding: VIEW_PADDING,
    });
    const screen = flat.map((point) => applyTransform(point, transform));
    const project = (point: Vec3): Point2 => applyTransform(projectPoint(point, projection), transform);
    const visibility = visibleEdges(model, projection);
    const faces: FacePiece[] = model.faces
      .map((face, index) => ({ face, index }))
      .filter(({ index }) => isFaceVisible(model, index, projection))
      .map(({ face, index }) => ({
        index,
        points: face.map((vertexIndex) => {
          const point = screen[vertexIndex] as Point2;
          return `${round(point.x, 2)},${round(point.y, 2)}`;
        }).join(' '),
        className: faceClassName(model, kind, index),
        depth: face.reduce((sum, vertexIndex) => {
          const vertex = model.vertices[vertexIndex] as Vec3;
          return sum + vertex.x + vertex.y + vertex.z;
        }, 0) / face.length,
      }))
      .sort((left, right) => left.depth - right.depth);

    return { screen, project, visibility, faces };
  }, [height, kind, model, projection]);

  const frontEdge = useMemo(() => {
    // Ребро основания, ближайшее к зрителю, — на нём подписываем сторону a.
    let bestIndex = 0;
    let bestValue = Number.POSITIVE_INFINITY;
    for (let index = 0; index < sides; index += 1) {
      const from = model.vertices[index] as Vec3;
      const to = model.vertices[(index + 1) % sides] as Vec3;
      const value = projection === 'cabinet'
        ? (from.y + to.y) / 2
        : -((from.x + to.x) / 2 + (from.y + to.y) / 2);
      if (value < bestValue) { bestValue = value; bestIndex = index; }
    }
    const from = model.vertices[bestIndex] as Vec3;
    const to = model.vertices[(bestIndex + 1) % sides] as Vec3;
    return {
      midpoint: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: 0 },
      screenFrom: picture.screen[bestIndex] as Point2,
      screenTo: picture.screen[(bestIndex + 1) % sides] as Point2,
    };
  }, [model, picture.screen, projection, sides]);

  const parsedAnswer = parseDecimal(answer);
  const target = activeMode === 'counts'
    ? counts.edges
    : (activeMode === 'volume' ? body.volume : surface.totalArea);
  const tolerance = activeMode === 'counts' ? 0 : 0.06;
  const answerCorrect = parsedAnswer !== null && Math.abs(parsedAnswer - target) <= tolerance;
  const reveal = !challenge || checked;

  const invalidate = () => setChecked(false);
  const reset = () => {
    setActiveMode(defaultMode);
    setKind(defaultKind);
    setSides(defaultSides);
    setSide(defaultSide);
    setHeight(defaultHeight);
    setProjection(defaultProjection);
    setShowHeights(true);
    setLean(0);
    setAnswer('');
    setChecked(false);
  };

  const baseName = BASE_NAMES[sides] ?? '';
  const solidName = leaning === 0
    ? `правильная ${baseName} ${kind === 'prism' ? 'призма' : 'пирамида'}`
    : `наклонная ${baseName} ${kind === 'prism' ? 'призма' : 'пирамида'}`;
  const badge = activeMode === 'counts'
    ? 'V − E + F'
    : (activeMode === 'volume' ? `${unitLabel}³` : `${unitLabel}²`);

  const result = (() => {
    if (activeMode === 'counts') {
      if (challenge && !checked) {
        return {
          symbol: '?',
          headline: 'Сосчитай рёбра по модели.',
          detail: 'Считай по группам: рёбра оснований и боковые рёбра. Затем нажми «Проверить».',
        };
      }
      const eulerText = `${counts.vertices} − ${counts.edges} + ${counts.faces} = ${counts.vertices - counts.edges + counts.faces}`;
      return {
        symbol: challenge ? (answerCorrect ? '✓' : '×') : '△',
        headline: `V = ${counts.vertices}, E = ${counts.edges}, F = ${counts.faces}.`,
        detail: `${solidName}. Проверка Эйлера: ${eulerText}${satisfiesEuler(counts) ? ' — соотношение выполнено.' : '.'}`,
      };
    }
    if (activeMode === 'volume') {
      if (challenge && !checked) {
        return {
          symbol: '?',
          headline: 'Вычисли объём тела.',
          detail: kind === 'prism'
            ? 'Найди площадь основания и умножь на высоту. Ответ округли до сотых.'
            : 'Найди площадь основания, умножь на высоту и возьми треть. Ответ округли до сотых.',
        };
      }
      const leanNote = leaning === 0
        ? 'Тело прямое.'
        : `Верх сдвинут на ${formatNumber(shift, 1)} ${unitLabel}, но расстояние между основаниями прежнее — по принципу Кавальери объём не изменился.`;
      if (kind === 'prism') {
        return {
          symbol: challenge ? (answerCorrect ? '✓' : '×') : '▦',
          headline: `V = ${formatNumber(prismBody.volume)} ${unitLabel}³.`,
          detail: `S_осн = ${formatNumber(prismBody.baseArea)} ${unitLabel}², h = ${formatNumber(height, 1)} ${unitLabel}, V = S_осн·h. ${leanNote}`,
        };
      }
      return {
        symbol: challenge ? (answerCorrect ? '✓' : '×') : '▲',
        headline: `V = ${formatNumber(pyramidBody.volume)} ${unitLabel}³.`,
        detail: `S_осн = ${formatNumber(pyramidBody.baseArea)} ${unitLabel}², h = ${formatNumber(height, 1)} ${unitLabel}, V = ⅓·S_осн·h. Призма с тем же основанием и той же высотой вмещает ${formatNumber(pyramidBody.prismVolume)} ${unitLabel}³ — ровно втрое больше. ${leanNote}`,
      };
    }
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: 'Вычисли площадь полной поверхности.',
        detail: kind === 'prism'
          ? 'Сначала площадь основания, потом боковую поверхность Ph. Ответ округли до сотых.'
          : 'Сначала апофему по теореме Пифагора, потом ½Pl и площадь основания. Ответ округли до сотых.',
      };
    }
    if (kind === 'prism') {
      return {
        symbol: challenge ? (answerCorrect ? '✓' : '×') : '▦',
        headline: `S = ${formatNumber(prism.totalArea)} ${unitLabel}².`,
        detail: `S_осн = ${formatNumber(prism.baseArea)} ${unitLabel}², P = ${formatNumber(prism.basePerimeter)} ${unitLabel}, S_бок = P·h = ${formatNumber(prism.lateralArea)} ${unitLabel}², S = 2S_осн + S_бок.`,
      };
    }
    return {
      symbol: challenge ? (answerCorrect ? '✓' : '×') : '▲',
      headline: `S = ${formatNumber(pyramid.totalArea)} ${unitLabel}².`,
      detail: `r = ${formatNumber(pyramid.inradius)} ${unitLabel}, апофема l = √(h² + r²) = ${formatNumber(pyramid.apothem)} ${unitLabel}, S_бок = ½Pl = ${formatNumber(pyramid.lateralArea)} ${unitLabel}², S_осн = ${formatNumber(pyramid.baseArea)} ${unitLabel}², боковое ребро = ${formatNumber(pyramid.lateralEdge)} ${unitLabel}.`,
    };
  })();

  const apexScreen = kind === 'pyramid'
    ? picture.screen[sides] as Point2
    : picture.project({ x: 0, y: 0, z: height });
  // Высота — расстояние между плоскостями оснований, поэтому она вертикальна
  // и при наклоне тела: отрезок идёт из центра основания строго вверх.
  const heightTopScreen = picture.project({ x: 0, y: 0, z: height });
  const centerScreen = picture.project({ x: 0, y: 0, z: 0 });
  const apothemFoot = picture.project(frontEdge.midpoint);

  return (
    <section className="dm-lab dm-geometry-solid-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория многогранников</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Призма и пирамида: элементы и поверхность</h3>
          <p>Меняй основание, сторону и высоту. Чертёж строится честной параллельной проекцией, а невидимые рёбра рисуются штрихами.</p>
        </div>
        <span className="dm-lab__badge">{badge}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Режим лаборатории многогранников">
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

        <div className="dm-geometry-preset-buttons" role="group" aria-label="Вид многогранника">
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

        <div className="dm-geometry-preset-buttons" role="group" aria-label="Число сторон основания">
          {SIDE_CHOICES.map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={sides === item}
              className={sides === item ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'}
              onClick={() => { setSides(item); invalidate(); }}
            >{item}-угольная</button>
          ))}
        </div>

        <div className="dm-lab__controls dm-geometry-controls">
          <LengthField id={`${labId}-side`} label="Сторона основания a" unit={unitLabel} value={side} onChange={(value) => { setSide(value); invalidate(); }} />
          <LengthField id={`${labId}-height`} label="Высота h" unit={unitLabel} value={height} onChange={(value) => { setHeight(value); invalidate(); }} />
        </div>

        <div className="dm-geometry-example-switch">
          <span>Проекция чертежа</span>
          <div className="dm-geometry-preset-buttons" role="group" aria-label="Способ изображения">
            {PROJECTIONS.map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={projection === item}
                className={projection === item ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'}
                onClick={() => setProjection(item)}
              >{PROJECTION_LABELS[item]}</button>
            ))}
            <button
              type="button"
              aria-pressed={showHeights}
              className={showHeights ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'}
              onClick={() => setShowHeights((current) => !current)}
            >Высота и апофема</button>
          </div>
        </div>

        {activeMode === 'volume' && (
          <div className="dm-geometry-example-switch">
            <span>Наклон тела</span>
            <div className="dm-geometry-preset-buttons" role="group" aria-label="Наклон тела при неизменной высоте">
              {LEAN_CHOICES.map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={lean === item}
                  className={lean === item ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'}
                  onClick={() => { setLean(item); invalidate(); }}
                >{LEAN_LABELS[item]}</button>
              ))}
            </div>
          </div>
        )}

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж многогранника" tabIndex={0}>
          <svg className="dm-geometry-solid" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-labelledby={`${labId}-svg-title ${labId}-svg-desc`}>
            <title id={`${labId}-svg-title`}>Чертёж: {solidName}</title>
            <desc id={`${labId}-svg-desc`}>
              {`Сторона основания ${formatNumber(side, 1)} ${unitLabel}, высота ${formatNumber(height, 1)} ${unitLabel}. `}
              {`Изображение построено ${projection === 'isometric' ? 'изометрической' : 'кабинетной'} параллельной проекцией: параллельные рёбра остаются параллельными, но углы и длины на экране искажены и измерять их линейкой нельзя. `}
              {`Штриховые линии — невидимые рёбра. У тела ${counts.vertices} вершин, ${counts.edges} рёбер и ${counts.faces} граней. `}
              {leaning === 0
                ? 'Верхняя часть тела стоит над центром основания.'
                : `Верхняя часть сдвинута в сторону на ${formatNumber(shift, 1)} ${unitLabel}; расстояние между плоскостями оснований осталось прежним, поэтому объём не изменился.`}
            </desc>
            <g className="dm-geometry-solid__body">
              {picture.faces.map((face) => (
                <polygon key={face.index} className={face.className} points={face.points} />
              ))}
              {model.edges.map(([from, to], index) => {
                if (!picture.visibility[index]) return null;
                const start = picture.screen[from] as Point2;
                const end = picture.screen[to] as Point2;
                return <line key={`solid-${index}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
              })}
              <path
                className="dm-geometry-solid__hidden"
                d={model.edges
                  .map(([from, to], index) => {
                    if (picture.visibility[index]) return '';
                    const start = picture.screen[from] as Point2;
                    const end = picture.screen[to] as Point2;
                    return `M${round(start.x, 2)} ${round(start.y, 2)} L${round(end.x, 2)} ${round(end.y, 2)}`;
                  })
                  .filter(Boolean)
                  .join(' ') || 'M0 0'}
              />
            </g>
            {showHeights && (
              <g className="dm-geometry-figure__construction" aria-hidden="true">
                <line x1={centerScreen.x} y1={centerScreen.y} x2={heightTopScreen.x} y2={heightTopScreen.y} />
                <line x1={centerScreen.x} y1={centerScreen.y} x2={apothemFoot.x} y2={apothemFoot.y} />
                {kind === 'pyramid' && leaning === 0 && (
                  <line x1={apexScreen.x} y1={apexScreen.y} x2={apothemFoot.x} y2={apothemFoot.y} />
                )}
                {kind === 'pyramid' && leaning !== 0 && (
                  <line x1={heightTopScreen.x} y1={heightTopScreen.y} x2={apexScreen.x} y2={apexScreen.y} />
                )}
              </g>
            )}
            <g className="dm-geometry-solid__dimensions">
              <text x={round((frontEdge.screenFrom.x + frontEdge.screenTo.x) / 2, 1)} y={round((frontEdge.screenFrom.y + frontEdge.screenTo.y) / 2 + 26, 1)}>
                a = {formatNumber(side, 1)} {unitLabel}
              </text>
              <text x={round(centerScreen.x - 52, 1)} y={round((centerScreen.y + heightTopScreen.y) / 2, 1)}>
                h = {formatNumber(height, 1)} {unitLabel}
              </text>
            </g>
          </svg>
        </div>

        {reveal && (
          <div className="dm-table-wrap">
            <table className="dm-ratio-table">
              <caption>
                {activeMode === 'counts' && 'Элементы многогранника'}
                {activeMode === 'surface' && `Разбор площади, ${unitLabel}²`}
                {activeMode === 'volume' && `Разбор объёма, ${unitLabel}³`}
              </caption>
              <tbody>
                {activeMode === 'counts' && (
                  <>
                    <tr><th scope="row">Вершины V</th><td>{counts.vertices}</td></tr>
                    <tr><th scope="row">Рёбра E</th><td>{counts.edges}</td></tr>
                    <tr><th scope="row">Грани F</th><td>{counts.faces}</td></tr>
                    <tr className="dm-ratio-table__answer"><th scope="row">V − E + F</th><td>{counts.vertices - counts.edges + counts.faces}</td></tr>
                  </>
                )}
                {activeMode === 'volume' && (
                  <>
                    <tr><th scope="row">Площадь основания S<sub>осн</sub></th><td>{formatNumber(body.baseArea)} {unitLabel}²</td></tr>
                    <tr><th scope="row">Высота h</th><td>{formatNumber(height, 1)} {unitLabel}</td></tr>
                    <tr><th scope="row">Сдвиг верха</th><td>{formatNumber(shift, 1)} {unitLabel}</td></tr>
                    <tr><th scope="row">Призма S<sub>осн</sub>·h</th><td>{formatNumber(body.prismVolume)}</td></tr>
                    <tr className="dm-ratio-table__answer"><th scope="row">Объём V</th><td>{formatNumber(body.volume)}</td></tr>
                  </>
                )}
                {activeMode === 'surface' && (
                  <>
                    <tr><th scope="row">Периметр основания P</th><td>{formatNumber(surface.basePerimeter)} {unitLabel}</td></tr>
                    <tr><th scope="row">Площадь основания</th><td>{formatNumber(surface.baseArea)}</td></tr>
                    {kind === 'pyramid' && <tr><th scope="row">Апофема l</th><td>{formatNumber(pyramid.apothem)} {unitLabel}</td></tr>}
                    <tr><th scope="row">Боковая поверхность</th><td>{formatNumber(surface.lateralArea)}</td></tr>
                    <tr className="dm-ratio-table__answer"><th scope="row">Полная поверхность</th><td>{formatNumber(surface.totalArea)}</td></tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {challenge && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>
              {activeMode === 'counts' && 'Сколько рёбер'}
              {activeMode === 'surface' && `Полная поверхность, ${unitLabel}²`}
              {activeMode === 'volume' && `Объём, ${unitLabel}³`}
            </label>
            <input
              id={`${labId}-answer`}
              type="text"
              inputMode="decimal"
              value={answer}
              onChange={(event) => {
                const raw = event.target.value.slice(0, 12);
                if (!DECIMAL_DRAFT.test(raw)) return;
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
