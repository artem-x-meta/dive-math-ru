import { useEffect, useId, useRef, useState } from 'react';
import {
  arcLength,
  arcLengthPiCoefficient,
  circleArea,
  circumference,
  regularPolygonMetrics,
  regularPolygonVertices,
  sectorArea,
  sectorAreaPiCoefficient,
} from '../lib/triangles';

export type TriSolvePolygonMode = 'polygon' | 'sector';

export interface TriSolvePolygonLabProps {
  mode?: TriSolvePolygonMode;
  /** Число сторон правильного многоугольника. */
  initialVertices?: number;
  /** Длина стороны многоугольника. */
  initialSide?: number;
  /** Радиус круга для режима сектора. */
  initialRadius?: number;
  /** Градусная мера дуги сектора. */
  initialArc?: number;
  unit?: string;
  challenge?: boolean;
}

const MODES: readonly TriSolvePolygonMode[] = ['polygon', 'sector'];
const MODE_LABELS: Readonly<Record<TriSolvePolygonMode, string>> = {
  polygon: 'Правильный многоугольник',
  sector: 'Дуга и сектор',
};

const MIN_VERTICES = 3;
const MAX_VERTICES = 12;
const MIN_SIDE = 2;
const MAX_SIDE = 10;
const MIN_RADIUS = 2;
const MAX_RADIUS = 12;
const MIN_ARC = 10;
const MAX_ARC = 350;

const WIDTH = 720;
const HEIGHT = 430;
const CENTRE_X = 360;
const CENTRE_Y = 215;
const VISUAL_RADIUS = 150;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(Math.round(value), min, max) : fallback;
}

/** Округление до сотых с русской запятой. */
function formatNumber(value: number, digits = 2): string {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  const text = rounded.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
  return (text === '' || text === '-' ? '0' : text).replace('.', ',');
}

/** Коэффициент при π читается как «2π», «6π» или «7,5π». */
function formatPiMultiple(coefficient: number): string {
  if (coefficient === 0) return '0';
  if (coefficient === 1) return 'π';
  return `${formatNumber(coefficient)}π`;
}

function polygonName(vertices: number): string {
  const names: Readonly<Record<number, string>> = {
    3: 'правильный треугольник',
    4: 'квадрат',
    5: 'правильный пятиугольник',
    6: 'правильный шестиугольник',
    7: 'правильный семиугольник',
    8: 'правильный восьмиугольник',
    9: 'правильный девятиугольник',
    10: 'правильный десятиугольник',
    11: 'правильный одиннадцатиугольник',
    12: 'правильный двенадцатиугольник',
  };
  return names[vertices] ?? `правильный ${vertices}-угольник`;
}

interface NumberFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly suffix: string;
  readonly hint: string;
  readonly onChange: (value: number) => void;
}

function NumberField({ id, label, value, min, max, step, suffix, hint, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>{label}<span className="dm-field__value">{value}{suffix}</span></label>
      <div className="dm-geometry-field__control">
        <button type="button" onClick={() => onChange(value - step)} disabled={value <= min} aria-label={`Уменьшить на ${step}`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => { cancelCommit.current = false; setEditing(true); }}
          onChange={(event) => {
            const raw = event.target.value.slice(0, 3);
            if (/^\d*$/.test(raw)) {
              setDraft(raw);
              if (/^\d+$/.test(raw)) {
                const parsed = Number(raw);
                if (parsed >= min && parsed <= max) onChange(parsed);
              }
            }
          }}
          onBlur={() => {
            if (cancelCommit.current) cancelCommit.current = false;
            else if (/^\d+$/.test(draft.trim())) onChange(Number(draft.trim()));
            setDraft(String(value));
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
            if (event.key === 'Escape') { event.preventDefault(); cancelCommit.current = true; setDraft(String(value)); event.currentTarget.blur(); }
          }}
        />
        <button type="button" onClick={() => onChange(value + step)} disabled={value >= max} aria-label={`Увеличить на ${step}`}>+</button>
      </div>
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

interface PolygonPictureProps {
  readonly id: string;
  readonly vertices: number;
  readonly side: number;
  readonly unit: string;
  readonly reveal: boolean;
}

function PolygonPicture({ id, vertices, side, unit, reveal }: PolygonPictureProps) {
  const metrics = regularPolygonMetrics(vertices, side);
  // Единый масштаб: экранный радиус описанной окружности фиксирован,
  // все остальные длины уменьшаются в том же отношении.
  const scale = VISUAL_RADIUS / metrics.circumradius;
  const points = regularPolygonVertices(vertices, metrics.circumradius)
    .map((point) => ({ x: CENTRE_X + point.x * scale, y: CENTRE_Y - point.y * scale }));
  const first = points[0] as { x: number; y: number };
  const second = points[1] as { x: number; y: number };
  const apothem = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };

  return (
    <svg className="dm-geometry-polygon" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Правильный многоугольник с описанной и вписанной окружностями</title>
      <desc id={`${id}-desc`}>
        {polygonName(vertices)} со стороной {formatNumber(side)} {unit}. Внутренний угол равен {formatNumber(metrics.interiorAngle, 2)} градусов,
        центральный угол — {formatNumber(metrics.centralAngle, 2)} градусов. Радиус описанной окружности {formatNumber(metrics.circumradius)} {unit},
        радиус вписанной окружности {formatNumber(metrics.inradius)} {unit}.
        {reveal ? ` Периметр ${formatNumber(metrics.perimeter)} ${unit}, площадь ${formatNumber(metrics.area)} квадратных ${unit}.` : ' Периметр и площадь нужно найти самостоятельно.'}
      </desc>
      <circle className="dm-geometry-circle__boundary" cx={CENTRE_X} cy={CENTRE_Y} r={VISUAL_RADIUS} />
      <polygon className="dm-geometry-polygon__shape" points={points.map((point) => `${point.x},${point.y}`).join(' ')} />
      <circle className="dm-geometry-figure__completion" cx={CENTRE_X} cy={CENTRE_Y} r={VISUAL_RADIUS * (metrics.inradius / metrics.circumradius)} />
      <g aria-hidden="true">
        <line className="dm-geometry-circle__radius" x1={CENTRE_X} y1={CENTRE_Y} x2={first.x} y2={first.y} />
        <line className="dm-geometry-circle__radius" x1={CENTRE_X} y1={CENTRE_Y} x2={apothem.x} y2={apothem.y} />
        <circle className="dm-geometry-circle__center" cx={CENTRE_X} cy={CENTRE_Y} r="6" />
      </g>
      <g className="dm-geometry-figure__dimensions" aria-hidden="true">
        <text x={CENTRE_X + 14} y={CENTRE_Y - VISUAL_RADIUS / 2}>R = {formatNumber(metrics.circumradius)}</text>
        <text x={(CENTRE_X + apothem.x) / 2 + 12} y={(CENTRE_Y + apothem.y) / 2 + 20}>r = {formatNumber(metrics.inradius)}</text>
        <text x={(first.x + second.x) / 2} y={(first.y + second.y) / 2 - 14} textAnchor="middle">a = {formatNumber(side)}</text>
      </g>
      <g aria-hidden="true">
        <text className="dm-geometry-angle__value" x={CENTRE_X} y={CENTRE_Y + VISUAL_RADIUS + 44} textAnchor="middle">
          центральный угол {formatNumber(metrics.centralAngle, 2)}° · внутренний угол {formatNumber(metrics.interiorAngle, 2)}°
        </text>
      </g>
    </svg>
  );
}

interface SectorPictureProps {
  readonly id: string;
  readonly radius: number;
  readonly degrees: number;
  readonly unit: string;
  readonly reveal: boolean;
}

function SectorPicture({ id, radius, degrees, unit, reveal }: SectorPictureProps) {
  const radians = (degrees * Math.PI) / 180;
  const startX = CENTRE_X + VISUAL_RADIUS;
  const startY = CENTRE_Y;
  const endX = CENTRE_X + VISUAL_RADIUS * Math.cos(radians);
  const endY = CENTRE_Y - VISUAL_RADIUS * Math.sin(radians);
  const largeArc = degrees > 180 ? 1 : 0;
  const sectorPath = `M ${CENTRE_X} ${CENTRE_Y} L ${startX} ${startY} A ${VISUAL_RADIUS} ${VISUAL_RADIUS} 0 ${largeArc} 0 ${endX} ${endY} Z`;
  const arcPath = `M ${startX} ${startY} A ${VISUAL_RADIUS} ${VISUAL_RADIUS} 0 ${largeArc} 0 ${endX} ${endY}`;
  const bisector = (degrees / 2 * Math.PI) / 180;
  const labelX = CENTRE_X + VISUAL_RADIUS * 0.55 * Math.cos(bisector);
  const labelY = CENTRE_Y - VISUAL_RADIUS * 0.55 * Math.sin(bisector);

  return (
    <svg className="dm-geometry-polygon" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Круговой сектор с дугой в {formatNumber(degrees, 0)} градусов</title>
      <desc id={`${id}-desc`}>
        Круг радиуса {formatNumber(radius)} {unit}. Выделен сектор с центральным углом {formatNumber(degrees, 0)} градусов,
        то есть {formatNumber(degrees / 360 * 100, 1)} процентов круга.
        {reveal
          ? ` Длина дуги равна ${formatPiMultiple(arcLengthPiCoefficient(radius, degrees))}, около ${formatNumber(arcLength(radius, degrees))} ${unit}; площадь сектора равна ${formatPiMultiple(sectorAreaPiCoefficient(radius, degrees))}, около ${formatNumber(sectorArea(radius, degrees))} квадратных ${unit}.`
          : ' Длину дуги и площадь сектора нужно найти самостоятельно.'}
      </desc>
      <circle className="dm-geometry-circle__boundary" cx={CENTRE_X} cy={CENTRE_Y} r={VISUAL_RADIUS} />
      <path className="dm-geometry-circle__disk" d={sectorPath} />
      <path className="dm-geometry-angle__arc" d={arcPath} />
      <g aria-hidden="true">
        <line className="dm-geometry-circle__radius" x1={CENTRE_X} y1={CENTRE_Y} x2={startX} y2={startY} />
        <line className="dm-geometry-circle__radius" x1={CENTRE_X} y1={CENTRE_Y} x2={endX} y2={endY} />
        <circle className="dm-geometry-circle__center" cx={CENTRE_X} cy={CENTRE_Y} r="6" />
      </g>
      <g className="dm-geometry-figure__dimensions" aria-hidden="true">
        <text x={CENTRE_X + VISUAL_RADIUS / 2} y={CENTRE_Y - 12} textAnchor="middle">R = {formatNumber(radius)}</text>
      </g>
      <g aria-hidden="true">
        <text className="dm-geometry-angle__value" x={labelX} y={labelY} textAnchor="middle">{formatNumber(degrees, 0)}°</text>
        <text className="dm-geometry-angle__value" x={CENTRE_X} y={CENTRE_Y + VISUAL_RADIUS + 44} textAnchor="middle">
          сектор занимает {formatNumber(degrees, 0)} из 360 частей круга
        </text>
      </g>
    </svg>
  );
}

function parseAnswer(raw: string): number | null {
  const source = raw.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(source)) return null;
  const value = Number(source);
  return Number.isFinite(value) ? value : null;
}

export default function TriSolvePolygonLab({
  mode,
  initialVertices,
  initialSide,
  initialRadius,
  initialArc,
  unit = 'см',
  challenge = false,
}: TriSolvePolygonLabProps) {
  const reactId = useId();
  const labId = `tri-polygon-${reactId.replace(/:/g, '')}`;
  const defaultMode: TriSolvePolygonMode = mode !== undefined && MODES.includes(mode) ? mode : 'polygon';
  const defaultVertices = safeInteger(initialVertices, 6, MIN_VERTICES, MAX_VERTICES);
  const defaultSide = safeInteger(initialSide, 4, MIN_SIDE, MAX_SIDE);
  const defaultRadius = safeInteger(initialRadius, 6, MIN_RADIUS, MAX_RADIUS);
  const defaultArc = clamp(safeInteger(initialArc, 60, MIN_ARC, MAX_ARC), MIN_ARC, MAX_ARC);

  const [activeMode, setActiveMode] = useState(defaultMode);
  const [vertices, setVertices] = useState(defaultVertices);
  const [side, setSide] = useState(defaultSide);
  const [radius, setRadius] = useState(defaultRadius);
  const [arc, setArc] = useState(defaultArc);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const metrics = regularPolygonMetrics(vertices, side);
  const sector = sectorArea(radius, arc);
  const targetValue = activeMode === 'polygon' ? metrics.area : sector;
  const reveal = !challenge || checked;
  const answerValue = parseAnswer(answer);
  const answerCorrect = answerValue !== null && Math.abs(answerValue - targetValue) <= Math.max(0.05, targetValue * 0.005);

  const reset = () => {
    setActiveMode(defaultMode);
    setVertices(defaultVertices);
    setSide(defaultSide);
    setRadius(defaultRadius);
    setArc(defaultArc);
    setAnswer('');
    setChecked(false);
  };

  const result = (() => {
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: activeMode === 'polygon'
          ? `Найди площадь: ${polygonName(vertices)} со стороной ${formatNumber(side)} ${unit}.`
          : `Найди площадь сектора: радиус ${formatNumber(radius)} ${unit}, дуга ${formatNumber(arc, 0)}°.`,
        detail: activeMode === 'polygon'
          ? `Апофема известна: r = ${formatNumber(metrics.inradius)} ${unit}. Площадь равна половине произведения периметра на апофему.`
          : 'Сектор — это доля круга. Найди, какую часть от 360° занимает дуга, и возьми такую же часть площади круга.',
      };
    }
    if (activeMode === 'polygon') {
      const headline = `У фигуры ${vertices} равных сторон: внутренний угол ${formatNumber(metrics.interiorAngle, 2)}°, центральный ${formatNumber(metrics.centralAngle, 2)}°.`;
      const detail = `R = ${formatNumber(metrics.circumradius)} ${unit}, r = ${formatNumber(metrics.inradius)} ${unit}, `
        + `P = ${formatNumber(metrics.perimeter)} ${unit}, S = ${formatNumber(metrics.area)} ${unit}². `
        + `Отношение S к площади описанного круга равно ${formatNumber(metrics.area / circleArea(metrics.circumradius), 3)} — с ростом числа сторон оно стремится к единице.`;
      return challenge
        ? { symbol: answerCorrect ? '✓' : '×', headline: answerCorrect ? 'Верно.' : `Пока нет: S = ${formatNumber(metrics.area)} ${unit}².`, detail }
        : { symbol: '⬡', headline, detail };
    }
    const arcCoefficient = arcLengthPiCoefficient(radius, arc);
    const areaCoefficient = sectorAreaPiCoefficient(radius, arc);
    const headline = `Дуга ${formatNumber(arc, 0)}° — это ${formatNumber(arc, 0)}/360 полного круга.`;
    const detail = `Длина дуги ${formatPiMultiple(arcCoefficient)} ≈ ${formatNumber(arcLength(radius, arc))} ${unit} `
      + `при длине всей окружности ${formatNumber(circumference(radius))} ${unit}. `
      + `Площадь сектора ${formatPiMultiple(areaCoefficient)} ≈ ${formatNumber(sector)} ${unit}² `
      + `при площади всего круга ${formatNumber(circleArea(radius))} ${unit}².`;
    return challenge
      ? { symbol: answerCorrect ? '✓' : '×', headline: answerCorrect ? 'Верно.' : `Пока нет: S = ${formatNumber(sector)} ${unit}².`, detail }
      : { symbol: '◔', headline, detail };
  })();

  return (
    <section className="dm-lab dm-geometry-angle-shape not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория круга и правильных фигур</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Многоугольник, вписанный в окружность</h3>
          <p>Все размеры вычисляются из числа сторон и одной длины. Чертёж честный: отношение радиусов на картинке ровно такое, каким его даёт формула.</p>
        </div>
        <span className="dm-lab__badge">{challenge ? 'задача' : 'исследование'}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Что исследуем">
          {MODES.map((item) => (
            <button
              type="button"
              className={activeMode === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
              aria-pressed={activeMode === item}
              onClick={() => { setActiveMode(item); setAnswer(''); setChecked(false); }}
              key={item}
            >
              {MODE_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-geometry-controls">
          {activeMode === 'polygon' ? (
            <>
              <NumberField
                id={`${labId}-vertices`}
                label="Число сторон n"
                value={vertices}
                min={MIN_VERTICES}
                max={MAX_VERTICES}
                step={1}
                suffix=""
                hint={`От ${MIN_VERTICES} до ${MAX_VERTICES}`}
                onChange={(value) => { setVertices(clamp(value, MIN_VERTICES, MAX_VERTICES)); setChecked(false); }}
              />
              <NumberField
                id={`${labId}-side`}
                label="Сторона a"
                value={side}
                min={MIN_SIDE}
                max={MAX_SIDE}
                step={1}
                suffix={` ${unit}`}
                hint={`От ${MIN_SIDE} до ${MAX_SIDE} ${unit}`}
                onChange={(value) => { setSide(clamp(value, MIN_SIDE, MAX_SIDE)); setChecked(false); }}
              />
            </>
          ) : (
            <>
              <NumberField
                id={`${labId}-radius`}
                label="Радиус R"
                value={radius}
                min={MIN_RADIUS}
                max={MAX_RADIUS}
                step={1}
                suffix={` ${unit}`}
                hint={`От ${MIN_RADIUS} до ${MAX_RADIUS} ${unit}`}
                onChange={(value) => { setRadius(clamp(value, MIN_RADIUS, MAX_RADIUS)); setChecked(false); }}
              />
              <NumberField
                id={`${labId}-arc`}
                label="Дуга α"
                value={arc}
                min={MIN_ARC}
                max={MAX_ARC}
                step={10}
                suffix="°"
                hint={`От ${MIN_ARC}° до ${MAX_ARC}°`}
                onChange={(value) => { setArc(clamp(value, MIN_ARC, MAX_ARC)); setChecked(false); }}
              />
            </>
          )}
        </div>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж" tabIndex={0}>
          {activeMode === 'polygon' ? (
            <PolygonPicture id={`${labId}-polygon`} vertices={vertices} side={side} unit={unit} reveal={reveal} />
          ) : (
            <SectorPicture id={`${labId}-sector`} radius={radius} degrees={arc} unit={unit} reveal={reveal} />
          )}
        </div>

        {challenge && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>Площадь, {unit}²</label>
            <input
              id={`${labId}-answer`}
              type="text"
              inputMode="decimal"
              value={answer}
              onChange={(event) => {
                const raw = event.target.value.slice(0, 8);
                if (/^\d*(?:[.,]\d*)?$/.test(raw)) { setAnswer(raw); setChecked(false); }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && answerValue !== null) { event.preventDefault(); setChecked(true); }
                if (event.key === 'Escape') { event.preventDefault(); setAnswer(''); setChecked(false); }
              }}
            />
            <button className="dm-button" type="button" disabled={answerValue === null} onClick={() => setChecked(true)}>Проверить</button>
          </div>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span>
          <p><strong>{result.headline}</strong><small>{result.detail}</small></p>
        </div>
        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
