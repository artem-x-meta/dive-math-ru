import { useEffect, useId, useMemo, useState } from 'react';
import { applyTransform, fitToBox, type FitTransform, type Point2 } from '../lib/polyhedra';
import { compareExact, parseExact } from '../lib/exactRational';
import {
  DEFAULT_ELEVATION_DEGREES,
  cavalieriLevel,
  formatMeasure,
  formatNumber,
  levelEllipse,
  sphereSection,
  type Measure,
} from '../lib/revolution';

export type RevolSectionMode = 'section' | 'cavalieri';
export type RevolSectionUnit = 'cm' | 'dm' | 'm';

export interface RevolSectionLabProps {
  mode?: RevolSectionMode;
  initialRadius?: number;
  initialLevel?: number;
  unit?: RevolSectionUnit;
  challenge?: boolean;
}

const MODES: readonly RevolSectionMode[] = ['section', 'cavalieri'];
const UNITS: readonly RevolSectionUnit[] = ['cm', 'dm', 'm'];

const MODE_LABELS: Readonly<Record<RevolSectionMode, string>> = {
  section: 'Сечение шара',
  cavalieri: 'Этажи Кавальери',
};
const UNIT_LABELS: Readonly<Record<RevolSectionUnit, string>> = { cm: 'см', dm: 'дм', m: 'м' };

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 420;
const VIEW_PADDING = 58;
const ELEVATION = DEFAULT_ELEVATION_DEGREES;
const ARC_STEPS = 64;
const STEP = 0.5;
const MIN_RADIUS = 1;
const MAX_RADIUS = 12;
const DECIMAL_DRAFT = /^\d*(?:[.,]\d*)?$/;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function snap(value: number): number {
  return round(Math.round(value / STEP) * STEP, 1);
}

function parseDecimal(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (normalized === '' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeMode(value: RevolSectionMode | undefined): RevolSectionMode {
  return value !== undefined && MODES.includes(value) ? value : 'section';
}

function safeUnit(value: RevolSectionUnit | undefined): RevolSectionUnit {
  return value !== undefined && UNITS.includes(value) ? value : 'cm';
}

function safeRadius(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return snap(clamp(value, MIN_RADIUS, MAX_RADIUS));
}

function safeLevel(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return snap(clamp(value, 0, MAX_RADIUS + 1));
}

/** Верхняя граница ползунка: у Кавальери уровень не выходит за радиус, у сечения — на шаг дальше. */
function levelLimit(mode: RevolSectionMode, radius: number): number {
  return mode === 'cavalieri' ? radius : snap(radius + 1);
}

interface RadiusFieldProps {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

function RadiusField({ id, label, unit, value, onChange }: RadiusFieldProps) {
  const hintId = `${id}-hint`;
  const [draft, setDraft] = useState(formatNumber(value, 1));

  useEffect(() => setDraft(formatNumber(value, 1)), [value]);

  const commit = () => {
    const parsed = parseDecimal(draft);
    const next = parsed === null ? value : snap(clamp(parsed, MIN_RADIUS, MAX_RADIUS));
    setDraft(formatNumber(next, 1));
    onChange(next);
  };
  const nudge = (direction: -1 | 1) => onChange(snap(clamp(value + direction * STEP, MIN_RADIUS, MAX_RADIUS)));

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>
        {label}
        <span className="dm-field__value">{formatNumber(value, 1)} {unit}</span>
      </label>
      <div className="dm-geometry-field__control">
        <button type="button" onClick={() => nudge(-1)} disabled={value <= MIN_RADIUS} aria-label={`Уменьшить: ${label.toLowerCase()}`}>−</button>
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
            if (parsed !== null && parsed >= MIN_RADIUS && parsed <= MAX_RADIUS) onChange(snap(parsed));
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
          }}
        />
        <button type="button" onClick={() => nudge(1)} disabled={value >= MAX_RADIUS} aria-label={`Увеличить: ${label.toLowerCase()}`}>+</button>
      </div>
      <small id={hintId}>От {MIN_RADIUS} до {MAX_RADIUS} {unit}; шаг 0,5.</small>
    </div>
  );
}

/** Экранная точка после подгонки: ось y перевёрнута под систему координат SVG. */
function place(point: Point2, transform: FitTransform): Point2 {
  return applyTransform({ x: point.x, y: -point.y }, transform);
}

function pointsAttribute(points: readonly Point2[]): string {
  return points.map((point) => `${round(point.x, 2)},${round(point.y, 2)}`).join(' ');
}

// ───────────────────────── сечение шара ─────────────────────────

interface SectionPictureProps {
  readonly id: string;
  readonly radius: number;
  readonly distance: number;
  readonly sectionRadius: number;
  /** Готовая подпись радиуса сечения: «ρ = 4» либо «ρ ≈ 4,47». */
  readonly sectionLabel: string;
  readonly unit: string;
}

function SectionPicture({ id, radius, distance, sectionRadius, sectionLabel, unit }: SectionPictureProps) {
  const planeRadius = 1.3 * radius;
  const plane = levelEllipse(planeRadius, distance, ELEVATION);
  const equator = levelEllipse(radius, 0, ELEVATION);
  const cut = levelEllipse(sectionRadius, distance, ELEVATION);

  const transform = useMemo(() => {
    const bounds: Point2[] = [
      { x: -radius, y: -radius }, { x: radius, y: radius },
      { x: -plane.rx, y: plane.cy - plane.ry }, { x: plane.rx, y: plane.cy + plane.ry },
    ];
    return fitToBox(bounds.map((point) => ({ x: point.x, y: -point.y })), {
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      padding: VIEW_PADDING,
    });
  }, [plane.cy, plane.rx, plane.ry, radius]);

  const scale = transform.scale;
  const centre = place({ x: 0, y: 0 }, transform);
  const cutCentre = place({ x: 0, y: cut.cy }, transform);
  const planeCentre = place({ x: 0, y: plane.cy }, transform);
  const rim = place({ x: cut.rx, y: cut.cy }, transform);
  const axisTop = place({ x: 0, y: radius }, transform);
  const axisBottom = place({ x: 0, y: -radius }, transform);

  const touching = Math.abs(distance - radius) < 1e-9;
  const description = distance > radius && !touching
    ? `Плоскость поднята на ${formatNumber(distance, 1)} ${unit} над центром — это больше радиуса ${formatNumber(radius, 1)} ${unit}, поэтому общих точек с шаром у неё нет.`
    : touching
      ? `Расстояние от центра до плоскости равно радиусу ${formatNumber(radius, 1)} ${unit}: плоскость касается сферы ровно в одной точке, и радиус, проведённый в эту точку, перпендикулярен плоскости.`
      : `Шар радиуса ${formatNumber(radius, 1)} ${unit} и плоскость на расстоянии ${formatNumber(distance, 1)} ${unit} от центра. В сечении круг радиуса ${sectionLabel} ${unit}: он вычислен по теореме Пифагора из прямоугольного треугольника с гипотенузой R и катетом d. На рисунке окружности показаны эллипсами — это параллельная проекция, мерить её линейкой нельзя.`;

  return (
    <svg className="dm-geometry-solid" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Сечение шара плоскостью</title>
      <desc id={`${id}-desc`}>{description}</desc>

      <g className="dm-geometry-solid__body">
        <ellipse
          className="dm-geometry-solid__side"
          cx={round(planeCentre.x, 2)}
          cy={round(planeCentre.y, 2)}
          rx={round(plane.rx * scale, 2)}
          ry={round(plane.ry * scale, 2)}
        />
      </g>

      <g className="dm-geometry-solid__round">
        <circle cx={round(centre.x, 2)} cy={round(centre.y, 2)} r={round(radius * scale, 2)} />
        <ellipse
          className="dm-geometry-solid__hidden"
          cx={round(centre.x, 2)}
          cy={round(centre.y, 2)}
          rx={round(equator.rx * scale, 2)}
          ry={round(equator.ry * scale, 2)}
        />
      </g>

      {sectionRadius > 0 && (
        <g className="dm-geometry-solid__body">
          <ellipse
            className="dm-geometry-solid__top"
            cx={round(cutCentre.x, 2)}
            cy={round(cutCentre.y, 2)}
            rx={round(cut.rx * scale, 2)}
            ry={round(cut.ry * scale, 2)}
          />
        </g>
      )}

      <g className="dm-geometry-figure__construction" aria-hidden="true">
        <line x1={axisTop.x} y1={axisTop.y - 16} x2={axisBottom.x} y2={axisBottom.y + 16} />
        <line x1={centre.x} y1={centre.y} x2={cutCentre.x} y2={cutCentre.y} />
        <line x1={centre.x} y1={centre.y} x2={rim.x} y2={rim.y} />
        <line x1={cutCentre.x} y1={cutCentre.y} x2={rim.x} y2={rim.y} />
      </g>

      <g className="dm-geometry-solid__dimensions">
        <text x={round(centre.x - 26, 1)} y={round((centre.y + cutCentre.y) / 2 + 6, 1)}>d = {formatNumber(distance, 1)}</text>
        <text x={round((cutCentre.x + rim.x) / 2, 1)} y={round(cutCentre.y - 12, 1)}>{sectionLabel}</text>
        <text x={round((centre.x + rim.x) / 2 + 26, 1)} y={round((centre.y + rim.y) / 2 + 22, 1)}>R = {formatNumber(radius, 1)}</text>
      </g>
    </svg>
  );
}

// ───────────────────────── этажи Кавальери ─────────────────────────

interface CavalieriPictureProps {
  readonly id: string;
  readonly radius: number;
  readonly level: number;
  readonly sectionRadius: number;
  /** Готовая подпись радиуса сечения: «ρ = 4» либо «ρ ≈ 4,47». */
  readonly sectionLabel: string;
  readonly unit: string;
}

function CavalieriPicture({ id, radius, level, sectionRadius, sectionLabel, unit }: CavalieriPictureProps) {
  const leftX = -1.6 * radius;
  const rightX = 1.6 * radius;
  const discY = -1.35 * radius;

  const transform = useMemo(() => {
    const bounds: Point2[] = [
      { x: leftX - radius, y: radius },
      { x: rightX + radius, y: radius },
      { x: leftX - radius, y: discY - radius },
      { x: rightX + radius, y: discY - radius },
    ];
    return fitToBox(bounds.map((point) => ({ x: point.x, y: -point.y })), {
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      padding: VIEW_PADDING,
    });
  }, [discY, leftX, radius, rightX]);

  const scale = transform.scale;
  const to = (x: number, y: number) => place({ x, y }, transform);

  const dome = Array.from({ length: ARC_STEPS + 1 }, (_, index) => {
    const angle = Math.PI - (Math.PI * index) / ARC_STEPS;
    return to(leftX + radius * Math.cos(angle), radius * Math.sin(angle));
  });

  const boxTopLeft = to(rightX - radius, radius);
  const boxBottomRight = to(rightX + radius, 0);
  const apex = to(rightX, 0);
  const coneLeft = to(rightX - radius, radius);
  const coneRight = to(rightX + radius, radius);

  const leftCut = [to(leftX - sectionRadius, level), to(leftX + sectionRadius, level)];
  const rightCutOuter = [to(rightX - radius, level), to(rightX - level, level)];
  const rightCutInner = [to(rightX + level, level), to(rightX + radius, level)];

  const disc = to(leftX, discY);
  const ring = to(rightX, discY);
  const outer = round(radius * scale, 2);
  const inner = round(level * scale, 2);
  const ringPath = `M${round(ring.x - outer, 2)} ${round(ring.y, 2)} A${outer} ${outer} 0 1 0 ${round(ring.x + outer, 2)} ${round(ring.y, 2)} A${outer} ${outer} 0 1 0 ${round(ring.x - outer, 2)} ${round(ring.y, 2)} Z`
    + (level > 0
      ? ` M${round(ring.x - inner, 2)} ${round(ring.y, 2)} A${inner} ${inner} 0 1 0 ${round(ring.x + inner, 2)} ${round(ring.y, 2)} A${inner} ${inner} 0 1 0 ${round(ring.x - inner, 2)} ${round(ring.y, 2)} Z`
      : '');

  const description = `Слева осевое сечение полушара радиуса ${formatNumber(radius, 1)} ${unit}, справа — цилиндр того же радиуса и высоты ${formatNumber(radius, 1)} ${unit}, из которого вырезан конус с вершиной в центре нижнего основания. Горизонтальная плоскость на высоте ${formatNumber(level, 1)} ${unit} высекает слева круг радиуса ${sectionLabel} ${unit}, а справа — кольцо между радиусами ${formatNumber(level, 1)} и ${formatNumber(radius, 1)} ${unit}. Внизу эти два сечения показаны в натуральную величину: их площади равны.`;

  return (
    <svg className="dm-geometry-solid" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Полушар и цилиндр без конуса на одном уровне</title>
      <desc id={`${id}-desc`}>{description}</desc>

      <g className="dm-geometry-solid__body">
        <polygon className="dm-geometry-solid__front" points={pointsAttribute(dome)} />
        <rect
          className="dm-geometry-solid__side"
          x={round(boxTopLeft.x, 2)}
          y={round(boxTopLeft.y, 2)}
          width={round(boxBottomRight.x - boxTopLeft.x, 2)}
          height={round(boxBottomRight.y - boxTopLeft.y, 2)}
        />
        <polygon className="dm-geometry-solid__top" points={pointsAttribute([apex, coneLeft, coneRight])} />
      </g>

      <g className="dm-geometry-figure__construction" aria-hidden="true">
        <line x1={to(leftX - 1.15 * radius, level).x} y1={to(leftX, level).y} x2={to(rightX + 1.15 * radius, level).x} y2={to(rightX, level).y} />
      </g>

      <g className="dm-geometry-solid__round">
        <polyline fill="none" points={pointsAttribute(leftCut)} />
        <polyline fill="none" points={pointsAttribute(rightCutOuter)} />
        <polyline fill="none" points={pointsAttribute(rightCutInner)} />
      </g>

      <g className="dm-geometry-solid__body">
        {sectionRadius > 0 && (
          <circle className="dm-geometry-solid__front" cx={round(disc.x, 2)} cy={round(disc.y, 2)} r={round(sectionRadius * scale, 2)} />
        )}
        <path className="dm-geometry-solid__top" fillRule="evenodd" d={ringPath} />
      </g>

      <g className="dm-geometry-solid__dimensions">
        <text x={round(disc.x, 1)} y={round(to(leftX, discY - radius).y + 26, 1)}>круг πρ²</text>
        <text x={round(ring.x, 1)} y={round(to(rightX, discY - radius).y + 26, 1)}>кольцо π(R² − y²)</text>
        <text x={round(to(leftX, radius).x, 1)} y={round(to(leftX, radius).y - 14, 1)}>полушар</text>
        <text x={round(to(rightX, radius).x, 1)} y={round(to(rightX, radius).y - 14, 1)}>цилиндр без конуса</text>
      </g>
    </svg>
  );
}

// ───────────────────────── лаборатория ─────────────────────────

export default function RevolSectionLab({
  mode,
  initialRadius,
  initialLevel,
  unit,
  challenge = false,
}: RevolSectionLabProps) {
  const reactId = useId();
  const labId = `revol-section-${reactId.replace(/:/g, '')}`;
  const defaultMode = safeMode(mode);
  const defaultRadius = safeRadius(initialRadius, 5);
  const defaultLevel = safeLevel(initialLevel, 3);
  const unitKey = safeUnit(unit);
  const unitLabel = UNIT_LABELS[unitKey];

  const [activeMode, setActiveMode] = useState(defaultMode);
  const [radius, setRadius] = useState(defaultRadius);
  const [rawLevel, setRawLevel] = useState(defaultLevel);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const maxLevel = levelLimit(activeMode, radius);
  const level = Math.min(rawLevel, maxLevel);

  const section = useMemo(() => sphereSection(radius, level), [level, radius]);
  const floor = useMemo(
    () => (activeMode === 'cavalieri' ? cavalieriLevel(radius, Math.min(level, radius)) : null),
    [activeMode, level, radius],
  );

  const target: Measure = activeMode === 'cavalieri' && floor !== null ? floor.hemisphereArea : section.sectionArea;

  const parsedAnswer = (() => {
    const normalized = answer.trim().replace(',', '.');
    if (normalized === '' || normalized === '.') return null;
    try { return parseExact(normalized); } catch { return null; }
  })();
  const answerCorrect = parsedAnswer !== null
    && target.exact !== null
    && compareExact(parsedAnswer, target.exact.coefficient) === 0;
  const reveal = !challenge || checked;

  const invalidate = () => { setChecked(false); };
  const reset = () => {
    setActiveMode(defaultMode);
    setRadius(defaultRadius);
    setRawLevel(defaultLevel);
    setAnswer('');
    setChecked(false);
  };

  const badge = activeMode === 'cavalieri' ? `y = ${formatNumber(level, 1)} ${unitLabel}` : `d = ${formatNumber(level, 1)} ${unitLabel}`;
  // Знак равенства ставим только тогда, когда радиус сечения записывается точно.
  const sectionLabel = section.sectionRadius.exact === null
    ? `ρ ${formatMeasure(section.sectionRadius)}`
    : `ρ = ${formatMeasure(section.sectionRadius)}`;

  const result = (() => {
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: activeMode === 'cavalieri'
          ? 'Найди площадь сечения полушара и введи множитель при π.'
          : 'Найди площадь круга сечения и введи множитель при π.',
        detail: activeMode === 'cavalieri'
          ? 'Радиус круга равен √(R² − y²), поэтому площадь равна π(R² − y²). Введи число k, если S = kπ.'
          : 'Радиус круга равен √(R² − d²), поэтому площадь равна π(R² − d²). Введи число k, если S = kπ.',
      };
    }
    if (activeMode === 'cavalieri' && floor !== null) {
      return {
        symbol: challenge ? (answerCorrect ? '✓' : '×') : '=',
        headline: `На уровне y = ${formatNumber(level, 1)} ${unitLabel} площади сечений равны: ${formatMeasure(floor.hemisphereArea)} ${unitLabel}².`,
        detail: `Круг полушара: π(R² − y²). Кольцо цилиндра без конуса: πR² − πy². Это одно и то же число на каждом этаже, поэтому по принципу Кавальери равны и объёмы.`,
      };
    }
    if (!section.intersects && !section.tangent) {
      return {
        symbol: '∅',
        headline: `d = ${formatNumber(level, 1)} ${unitLabel} больше радиуса — общих точек нет.`,
        detail: 'Плоскость проходит мимо шара: ни одной точки шара она не содержит.',
      };
    }
    if (section.tangent) {
      return {
        symbol: '·',
        headline: `d = R = ${formatNumber(radius, 1)} ${unitLabel}: плоскость касается сферы.`,
        detail: 'Общая точка ровно одна. Радиус, проведённый в точку касания, перпендикулярен касательной плоскости.',
      };
    }
    return {
      symbol: challenge ? (answerCorrect ? '✓' : '×') : '◯',
      headline: `Сечение — круг радиуса ρ = ${formatMeasure(section.sectionRadius)} ${unitLabel}.`,
      detail: `Площадь круга сечения ${formatMeasure(section.sectionArea)} ${unitLabel}², длина окружности сечения ${formatMeasure(section.sectionLength)} ${unitLabel}. Чем ближе плоскость к центру, тем больше круг; при d = 0 получается большой круг.`,
    };
  })();

  return (
    <section className="dm-lab dm-geometry-solid-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория сечений</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Что плоскость высекает из шара</h3>
          <p>Двигай секущую плоскость и следи за радиусом круга. Во второй вкладке тот же уровень сравнивает полушар с цилиндром, из которого вырезан конус, — это и есть шаг к формуле объёма шара.</p>
        </div>
        <span className="dm-lab__badge">{badge}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Режим лаборатории сечений">
          {MODES.map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={activeMode === item}
              className={activeMode === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
              onClick={() => { setActiveMode(item); setAnswer(''); setChecked(false); }}
            >{MODE_LABELS[item]}</button>
          ))}
        </div>

        <div className="dm-lab__controls dm-geometry-controls">
          <RadiusField
            id={`${labId}-radius`}
            label="Радиус R"
            unit={unitLabel}
            value={radius}
            onChange={(value) => { setRadius(value); invalidate(); }}
          />
          <div className="dm-field">
            <label htmlFor={`${labId}-level`}>
              {activeMode === 'cavalieri' ? 'Уровень сечения y' : 'Расстояние до плоскости d'}
              <span className="dm-field__value">{formatNumber(level, 1)} {unitLabel}</span>
            </label>
            <input
              id={`${labId}-level`}
              type="range"
              min={0}
              max={maxLevel}
              step={STEP}
              value={level}
              onChange={(event) => { setRawLevel(Number(event.target.value)); invalidate(); }}
              aria-describedby={`${labId}-level-hint`}
            />
            <small id={`${labId}-level-hint`}>
              {activeMode === 'cavalieri'
                ? `Уровень меняется от 0 до R = ${formatNumber(radius, 1)} ${unitLabel}; стрелки двигают его на 0,5.`
                : `Ползунок доходит до R + 1, чтобы увидеть касание и промах; стрелки двигают плоскость на 0,5.`}
            </small>
          </div>
        </div>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж сечения" tabIndex={0}>
          {activeMode === 'cavalieri' ? (
            <CavalieriPicture
              id={`${labId}-cavalieri`}
              radius={radius}
              level={Math.min(level, radius)}
              sectionRadius={section.sectionRadius.value}
              sectionLabel={sectionLabel}
              unit={unitLabel}
            />
          ) : (
            <SectionPicture
              id={`${labId}-section`}
              radius={radius}
              distance={level}
              sectionRadius={section.sectionRadius.value}
              sectionLabel={sectionLabel}
              unit={unitLabel}
            />
          )}
        </div>

        {reveal && (
          <div className="dm-table-wrap">
            <table className="dm-ratio-table">
              <caption>Точная запись и приближение, {unitLabel}</caption>
              <tbody>
                <tr><th scope="row">Радиус шара R, {unitLabel}</th><td>{formatNumber(radius, 1)}</td></tr>
                <tr>
                  <th scope="row">{activeMode === 'cavalieri' ? 'Уровень y' : 'Расстояние d'}, {unitLabel}</th>
                  <td>{formatNumber(level, 1)}</td>
                </tr>
                <tr><th scope="row">Радиус сечения ρ, {unitLabel}</th><td>{formatMeasure(section.sectionRadius)}</td></tr>
                {activeMode === 'cavalieri' && floor !== null && (
                  <tr><th scope="row">Кольцо цилиндра без конуса, {unitLabel}²</th><td>{formatMeasure(floor.ringArea)}</td></tr>
                )}
                <tr className="dm-ratio-table__answer">
                  <th scope="row">Площадь круга сечения, {unitLabel}²</th>
                  <td>{formatMeasure(activeMode === 'cavalieri' && floor !== null ? floor.hemisphereArea : section.sectionArea)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {challenge && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>Множитель k, если S = kπ</label>
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
