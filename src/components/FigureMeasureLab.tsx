import { useEffect, useId, useRef, useState } from 'react';
import {
  addExact,
  compareExact,
  divideExact,
  formatExactRussian,
  multiplyExact,
  parseExact,
  subtractExact,
  toExactNumber,
  type ExactInput,
  type ExactRational,
} from '../lib/exactRational';
import {
  estimateGridArea,
  rectangleMeasures,
  type GeometryPoint,
} from '../lib/geometry';

export type FigureMeasureMode = 'perimeter-area' | 'grid-estimate' | 'circle';
export type FigurePreset = 'rectangle' | 'l-shape' | 'stairs' | 'circle';
export type GeometryLengthUnit = 'mm' | 'cm' | 'dm' | 'm';
export type AreaStrategy = 'count' | 'split' | 'complete';

export interface FigureMeasureLabProps {
  mode?: FigureMeasureMode;
  preset?: FigurePreset;
  initialWidth?: number | string;
  initialHeight?: number | string;
  initialCutWidth?: number | string;
  initialCutHeight?: number | string;
  initialRadius?: number | string;
  unit?: GeometryLengthUnit;
  piApproximation?: '3.14' | '22/7';
  initialStrategy?: AreaStrategy;
  challenge?: boolean;
}

interface ShapeMeasures {
  readonly perimeter: ExactRational;
  readonly area: ExactRational;
}

interface GridCellModel {
  readonly column: number;
  readonly row: number;
  readonly status: 'full' | 'partial' | 'empty';
}

interface GridEstimateModel {
  readonly cells: readonly GridCellModel[];
  readonly full: number;
  readonly partial: number;
  readonly lower: ExactRational;
  readonly midpoint: ExactRational;
  readonly upper: ExactRational;
}

const MODES: readonly FigureMeasureMode[] = ['perimeter-area', 'grid-estimate', 'circle'];
const PRESETS: readonly FigurePreset[] = ['rectangle', 'l-shape', 'stairs', 'circle'];
const STRATEGIES: readonly AreaStrategy[] = ['count', 'split', 'complete'];
const UNITS: readonly GeometryLengthUnit[] = ['mm', 'cm', 'dm', 'm'];
const MODE_LABELS: Readonly<Record<FigureMeasureMode, string>> = {
  'perimeter-area': 'Периметр и площадь',
  'grid-estimate': 'Оценка по сетке',
  circle: 'Круг и окружность',
};
const PRESET_LABELS: Readonly<Record<FigurePreset, string>> = {
  rectangle: 'Прямоугольник',
  'l-shape': 'Г-образная',
  stairs: 'Ступеньки',
  circle: 'Круг',
};
const STRATEGY_LABELS: Readonly<Record<AreaStrategy, string>> = {
  count: 'Считать клетки',
  split: 'Разбить на части',
  complete: 'Дополнить и вычесть',
};
const UNIT_LABELS: Readonly<Record<GeometryLengthUnit, string>> = {
  mm: 'мм',
  cm: 'см',
  dm: 'дм',
  m: 'м',
};
const MINIMUM = parseExact('0.1');
const MAXIMUM = parseExact('1000');
const FIELD_STEP = parseExact('0.1');

function safeMode(value: FigureMeasureMode | undefined): FigureMeasureMode {
  return value !== undefined && MODES.includes(value) ? value : 'perimeter-area';
}

function safePreset(value: FigurePreset | undefined): FigurePreset {
  return value !== undefined && PRESETS.includes(value) ? value : 'rectangle';
}

function safeStrategy(value: AreaStrategy | undefined): AreaStrategy {
  return value !== undefined && STRATEGIES.includes(value) ? value : 'count';
}

function safeUnit(value: GeometryLengthUnit | undefined): GeometryLengthUnit {
  return value !== undefined && UNITS.includes(value) ? value : 'cm';
}

function safeExact(value: ExactInput | undefined, fallback: ExactInput): ExactRational {
  try {
    const parsed = value === undefined ? parseExact(fallback) : parseExact(value);
    if (compareExact(parsed, MINIMUM) < 0 || compareExact(parsed, MAXIMUM) > 0) return parseExact(fallback);
    return parsed;
  } catch {
    return parseExact(fallback);
  }
}

function clampExact(value: ExactRational, minimum = MINIMUM, maximum = MAXIMUM): ExactRational {
  if (compareExact(value, minimum) < 0) return minimum;
  if (compareExact(value, maximum) > 0) return maximum;
  return value;
}

function inputText(value: ExactRational): string {
  return formatExactRussian(value).replace('−', '-');
}

function display(value: ExactRational): string {
  return formatExactRussian(value);
}

function piValue(approximation: '3.14' | '22/7'): ExactRational {
  return parseExact(approximation);
}

function symbolicPi(coefficient: ExactRational): string {
  if (compareExact(coefficient, 1) === 0) return 'π';
  return `${display(coefficient)}π`;
}

function parseDraft(raw: string): ExactRational | null {
  const source = raw.trim().replace('−', '-');
  if (source.length === 0 || source.length > 64) return null;
  try {
    return parseExact(source);
  } catch {
    return null;
  }
}

interface ExactFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: ExactRational;
  readonly unit: string;
  readonly onChange: (value: ExactRational) => void;
}

function ExactField({ id, label, value, unit, onChange }: ExactFieldProps) {
  const [draft, setDraft] = useState(inputText(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(inputText(value));
  }, [editing, value]);

  const commit = () => {
    const parsed = parseDraft(draft);
    const next = parsed === null ? value : clampExact(parsed);
    setDraft(inputText(next));
    onChange(next);
  };
  const nudge = (direction: -1 | 1) => {
    const next = direction < 0 ? subtractExact(value, FIELD_STEP) : addExact(value, FIELD_STEP);
    onChange(clampExact(next));
  };

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>{label}<span className="dm-field__value">{display(value)} {unit}</span></label>
      <div className="dm-geometry-field__control">
        <button type="button" onClick={() => nudge(-1)} disabled={compareExact(value, MINIMUM) <= 0} aria-label={`Уменьшить ${label.toLowerCase()} на 0,1 ${unit}`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => { cancelCommit.current = false; setEditing(true); }}
          onChange={(event) => {
            const raw = event.target.value.slice(0, 64);
            if (/^[+\-−]?\d*(?:[.,]\d*)?(?:\s*\/\s*[+\-−]?\d*(?:[.,]\d*)?)?$/.test(raw)) {
              setDraft(raw);
              const parsed = parseDraft(raw);
              if (parsed && compareExact(parsed, MINIMUM) >= 0 && compareExact(parsed, MAXIMUM) <= 0) onChange(parsed);
            }
          }}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              setDraft(inputText(value));
            } else commit();
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
            if (event.key === 'Escape') { event.preventDefault(); cancelCommit.current = true; setDraft(inputText(value)); event.currentTarget.blur(); }
          }}
        />
        <button type="button" onClick={() => nudge(1)} disabled={compareExact(value, MAXIMUM) >= 0} aria-label={`Увеличить ${label.toLowerCase()} на 0,1 ${unit}`}>+</button>
      </div>
      <small id={`${id}-hint`}>От 0,1 до 1000 {unit}; можно вводить десятичную или обычную дробь</small>
    </div>
  );
}

function shapeMeasures(
  preset: Exclude<FigurePreset, 'circle'>,
  width: ExactRational,
  height: ExactRational,
  cutWidth: ExactRational,
  cutHeight: ExactRational,
): ShapeMeasures | null {
  if (preset === 'rectangle') return rectangleMeasures(width, height);
  if (preset === 'l-shape') {
    if (compareExact(cutWidth, width) >= 0 || compareExact(cutHeight, height) >= 0) return null;
    return {
      perimeter: multiplyExact(2, addExact(width, height)),
      area: subtractExact(multiplyExact(width, height), multiplyExact(cutWidth, cutHeight)),
    };
  }
  return {
    perimeter: multiplyExact(2, addExact(width, height)),
    area: divideExact(multiplyExact(2, multiplyExact(width, height)), 3),
  };
}

function polygonFor(
  preset: Exclude<FigurePreset, 'circle'>,
  width: number,
  height: number,
  cutWidth: number,
  cutHeight: number,
): readonly GeometryPoint[] {
  if (preset === 'rectangle') return [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  if (preset === 'l-shape') return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height - cutHeight },
    { x: width - cutWidth, y: height - cutHeight },
    { x: width - cutWidth, y: height },
    { x: 0, y: height },
  ];
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height / 3 },
    { x: (2 * width) / 3, y: height / 3 },
    { x: (2 * width) / 3, y: (2 * height) / 3 },
    { x: width / 3, y: (2 * height) / 3 },
    { x: width / 3, y: height },
    { x: 0, y: height },
  ];
}

function insideShape(
  preset: FigurePreset,
  x: number,
  y: number,
  width: number,
  height: number,
  cutWidth: number,
  cutHeight: number,
): boolean {
  if (preset === 'circle') {
    const dx = x - width / 2;
    const dy = y - height / 2;
    return dx * dx + dy * dy <= (width * width) / 4 + 1e-9;
  }
  if (x < 0 || y < 0 || x > width || y > height) return false;
  if (preset === 'rectangle') return true;
  if (preset === 'l-shape') return !(x > width - cutWidth && y > height - cutHeight);
  if (x <= width / 3) return true;
  if (x <= (2 * width) / 3) return y <= (2 * height) / 3 + 1e-9;
  return y <= height / 3 + 1e-9;
}

function makeGridEstimate(
  preset: FigurePreset,
  widthExact: ExactRational,
  heightExact: ExactRational,
  cutWidthExact: ExactRational,
  cutHeightExact: ExactRational,
  radiusExact: ExactRational,
): GridEstimateModel {
  const columns = 10;
  const rows = 10;
  const radius = toExactNumber(radiusExact);
  const width = preset === 'circle' ? radius * 2 : toExactNumber(widthExact);
  const height = preset === 'circle' ? radius * 2 : toExactNumber(heightExact);
  const cutWidth = toExactNumber(cutWidthExact);
  const cutHeight = toExactNumber(cutHeightExact);
  const cells: GridCellModel[] = [];
  let full = 0;
  let partial = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x0 = (column / columns) * width;
      const x1 = ((column + 1) / columns) * width;
      const y0 = (row / rows) * height;
      const y1 = ((row + 1) / rows) * height;
      let status: GridCellModel['status'];
      if (preset === 'circle') {
        const centerX = width / 2;
        const centerY = height / 2;
        const radiusSquared = (width * width) / 4;
        const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const;
        const farthestSquared = Math.max(...corners.map(([x, y]) => (x - centerX) ** 2 + (y - centerY) ** 2));
        const nearestX = Math.max(x0, Math.min(x1, centerX));
        const nearestY = Math.max(y0, Math.min(y1, centerY));
        const nearestSquared = (nearestX - centerX) ** 2 + (nearestY - centerY) ** 2;
        status = farthestSquared <= radiusSquared + 1e-9
          ? 'full'
          : nearestSquared <= radiusSquared + 1e-9
            ? 'partial'
            : 'empty';
      } else {
        const samples = [
          [x0, y0], [x1, y0], [x0, y1], [x1, y1],
          [(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1],
          [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2],
          [(x0 + x1) / 2, (y0 + y1) / 2],
        ] as const;
        const inside = samples.map(([x, y]) => insideShape(preset, x, y, width, height, cutWidth, cutHeight));
        status = inside.every(Boolean) ? 'full' : inside.some(Boolean) ? 'partial' : 'empty';
      }
      if (status === 'full') full += 1;
      if (status === 'partial') partial += 1;
      cells.push({ column, row, status });
    }
  }
  const cellArea = divideExact(
    preset === 'circle' ? multiplyExact(multiplyExact(2, radiusExact), multiplyExact(2, radiusExact)) : multiplyExact(widthExact, heightExact),
    columns * rows,
  );
  const estimate = estimateGridArea(full, partial);
  return {
    cells,
    full,
    partial,
    lower: multiplyExact(estimate.lower, cellArea),
    midpoint: multiplyExact(estimate.midpoint, cellArea),
    upper: multiplyExact(estimate.upper, cellArea),
  };
}

interface FigurePictureProps {
  readonly id: string;
  readonly mode: FigureMeasureMode;
  readonly preset: FigurePreset;
  readonly strategy: AreaStrategy;
  readonly width: ExactRational;
  readonly height: ExactRational;
  readonly cutWidth: ExactRational;
  readonly cutHeight: ExactRational;
  readonly radius: ExactRational;
  readonly unit: string;
  readonly grid: GridEstimateModel;
  readonly revealMeasures: boolean;
}

function FigurePicture({ id, mode, preset, strategy, width, height, cutWidth, cutHeight, radius, unit, grid, revealMeasures }: FigurePictureProps) {
  const viewWidth = 720;
  const viewHeight = 440;
  const circleMode = mode === 'circle' || preset === 'circle';
  const numericWidth = toExactNumber(width);
  const numericHeight = toExactNumber(height);
  const numericCutWidth = toExactNumber(cutWidth);
  const numericCutHeight = toExactNumber(cutHeight);
  const title = circleMode ? 'Круг с отмеченными радиусом и диаметром' : `${PRESET_LABELS[preset]} с размерами`;
  const description = revealMeasures
    ? circleMode
      ? `Радиус ${display(radius)} ${unit}, диаметр ${display(multiplyExact(2, radius))} ${unit}. Окружность развёрнута в отрезок C в том же визуальном масштабе; при изменении радиуса вся схема автоматически подгоняется под окно.`
      : `Ширина ${display(width)} ${unit}, высота ${display(height)} ${unit}.`
    : `${title}. Численный результат скрыт до проверки.`;

  if (mode === 'grid-estimate') {
    const cellSize = 34;
    const gridSize = cellSize * 10;
    const left = (viewWidth - gridSize) / 2;
    const top = (viewHeight - gridSize) / 2;
    return (
      <svg className="dm-geometry-figure dm-geometry-figure--grid" viewBox={`0 0 ${viewWidth} ${viewHeight}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Оценка площади по квадратной сетке</title><desc id={`${id}-desc`}>{description} Полных клеток: {grid.full}, частичных: {grid.partial}.</desc>
        <g transform={`translate(${left} ${top})`}>
          {grid.cells.map((cell) => <rect className={`dm-geometry-grid-cell dm-geometry-grid-cell--${cell.status}`} x={cell.column * cellSize} y={(9 - cell.row) * cellSize} width={cellSize} height={cellSize} key={`${cell.column}-${cell.row}`} />)}
        </g>
      </svg>
    );
  }

  if (circleMode) {
    const center = { x: viewWidth / 2, y: 155 };
    const visualRadius = 82;
    const unrolledLength = 2 * Math.PI * visualRadius;
    const unrolledStart = (viewWidth - unrolledLength) / 2;
    return (
      <svg className="dm-geometry-figure dm-geometry-figure--circle" viewBox={`0 0 ${viewWidth} ${viewHeight}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{title}</title><desc id={`${id}-desc`}>{description}</desc>
        <circle className="dm-geometry-circle__disk" cx={center.x} cy={center.y} r={visualRadius} />
        <circle className="dm-geometry-circle__boundary" cx={center.x} cy={center.y} r={visualRadius} />
        <line className="dm-geometry-circle__diameter" x1={center.x - visualRadius} y1={center.y} x2={center.x + visualRadius} y2={center.y} />
        <line className="dm-geometry-circle__radius" x1={center.x} y1={center.y} x2={center.x + visualRadius} y2={center.y} />
        <circle className="dm-geometry-circle__center" cx={center.x} cy={center.y} r="6" />
        <text className="dm-geometry-circle__label" x={center.x + visualRadius / 2} y={center.y - 12}>r{revealMeasures ? ` = ${display(radius)} ${unit}` : ''}</text>
        <text className="dm-geometry-circle__label" x={center.x} y={center.y + 30}>d{revealMeasures ? ` = ${display(multiplyExact(2, radius))} ${unit}` : ''}</text>
        <g className="dm-geometry-circle__unrolled"><line x1={unrolledStart} y1="350" x2={unrolledStart + unrolledLength} y2="350" /><line x1={unrolledStart} y1="338" x2={unrolledStart} y2="362" /><line x1={unrolledStart + unrolledLength} y1="338" x2={unrolledStart + unrolledLength} y2="362" /><text x={viewWidth / 2} y="384">C — развёрнутая окружность</text></g>
      </svg>
    );
  }

  const points = polygonFor(preset as Exclude<FigurePreset, 'circle'>, numericWidth, numericHeight, numericCutWidth, numericCutHeight);
  // The same scale is used on both axes, so a square remains a square.
  const padding = 78;
  const scale = Math.min((viewWidth - padding * 2) / Math.max(numericWidth, 0.1), (viewHeight - padding * 2) / Math.max(numericHeight, 0.1));
  const left = (viewWidth - numericWidth * scale) / 2;
  const bottom = (viewHeight + numericHeight * scale) / 2;
  const px = (value: number) => left + value * scale;
  const py = (value: number) => bottom - value * scale;
  return (
    <svg className="dm-geometry-figure" viewBox={`0 0 ${viewWidth} ${viewHeight}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{title}</title><desc id={`${id}-desc`}>{description}</desc>
      <polygon className="dm-geometry-figure__shape" points={points.map((point) => `${px(point.x)},${py(point.y)}`).join(' ')} />
      {strategy === 'split' && preset === 'rectangle' && <g className="dm-geometry-figure__construction"><line x1={px(numericWidth / 2)} y1={py(0)} x2={px(numericWidth / 2)} y2={py(numericHeight)} /></g>}
      {strategy === 'split' && preset === 'l-shape' && <g className="dm-geometry-figure__construction"><line x1={px(0)} y1={py(numericHeight - numericCutHeight)} x2={px(numericWidth - numericCutWidth)} y2={py(numericHeight - numericCutHeight)} /></g>}
      {strategy === 'split' && preset === 'stairs' && <g className="dm-geometry-figure__construction"><line x1={px(numericWidth / 3)} y1={py(0)} x2={px(numericWidth / 3)} y2={py(numericHeight)} /><line x1={px((2 * numericWidth) / 3)} y1={py(0)} x2={px((2 * numericWidth) / 3)} y2={py((2 * numericHeight) / 3)} /></g>}
      {strategy === 'complete' && preset !== 'rectangle' && <rect className="dm-geometry-figure__completion" x={px(0)} y={py(numericHeight)} width={numericWidth * scale} height={numericHeight * scale} />}
      <g className="dm-geometry-figure__dimensions"><line x1={px(0)} y1={py(0) + 28} x2={px(numericWidth)} y2={py(0) + 28} /><text x={px(numericWidth / 2)} y={py(0) + 52}>{revealMeasures ? `${display(width)} ${unit}` : 'ширина'}</text><line x1={px(0) - 28} y1={py(0)} x2={px(0) - 28} y2={py(numericHeight)} /><text x={px(0) - 38} y={py(numericHeight / 2)}>{revealMeasures ? `${display(height)} ${unit}` : 'высота'}</text></g>
    </svg>
  );
}

interface AnswerFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
}

function AnswerField({ id, label, value, onChange, onSubmit }: AnswerFieldProps) {
  return <div className="dm-field dm-geometry-answer-field"><label htmlFor={id}>{label}</label><input id={id} type="text" inputMode="decimal" value={value} onChange={(event) => { const raw = event.target.value.slice(0, 64); if (/^[+\-−]?\d*(?:[.,]\d*)?(?:\s*\/\s*[+\-−]?\d*(?:[.,]\d*)?)?$/.test(raw)) onChange(raw); }} onBlur={(event) => onChange(event.currentTarget.value.trim())} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onSubmit(); } if (event.key === 'Escape') { event.preventDefault(); onChange(''); } }} /></div>;
}

export default function FigureMeasureLab({
  mode,
  preset,
  initialWidth,
  initialHeight,
  initialCutWidth,
  initialCutHeight,
  initialRadius,
  unit,
  piApproximation,
  initialStrategy,
  challenge = false,
}: FigureMeasureLabProps) {
  const reactId = useId();
  const labId = `figure-measure-${reactId.replace(/:/g, '')}`;
  const defaultMode = safeMode(mode);
  const defaultPreset = safePreset(preset);
  const defaultStrategy = safeStrategy(initialStrategy);
  const lengthUnit = safeUnit(unit);
  const unitLabel = UNIT_LABELS[lengthUnit];
  const defaultPi = piApproximation === '22/7' ? '22/7' : '3.14';
  const defaultWidth = safeExact(initialWidth, 8);
  const defaultHeight = safeExact(initialHeight, 5);
  const defaultCutWidth = safeExact(initialCutWidth, 3);
  const defaultCutHeight = safeExact(initialCutHeight, 2);
  const defaultRadius = safeExact(initialRadius, 3);
  const [activeMode, setActiveMode] = useState(defaultMode);
  const [activePreset, setActivePreset] = useState(defaultPreset);
  const [strategy, setStrategy] = useState(defaultStrategy);
  const [activePi, setActivePi] = useState<'3.14' | '22/7'>(defaultPi);
  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  const [cutWidth, setCutWidth] = useState(defaultCutWidth);
  const [cutHeight, setCutHeight] = useState(defaultCutHeight);
  const [radius, setRadius] = useState(defaultRadius);
  const [firstAnswer, setFirstAnswer] = useState('');
  const [secondAnswer, setSecondAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const effectivePreset: FigurePreset = activeMode === 'circle'
    ? 'circle'
    : activeMode === 'grid-estimate'
      ? activePreset
      : activePreset === 'circle'
        ? 'rectangle'
        : activePreset;
  const cutsValid = effectivePreset !== 'l-shape' || (compareExact(cutWidth, width) < 0 && compareExact(cutHeight, height) < 0);
  const measures = effectivePreset === 'circle' ? null : shapeMeasures(effectivePreset, width, height, cutWidth, cutHeight);
  const circle = {
    diameter: multiplyExact(2, radius),
    circumferenceCoefficient: multiplyExact(2, radius),
    areaCoefficient: multiplyExact(radius, radius),
  };
  const circumferenceApproximation = multiplyExact(circle.circumferenceCoefficient, piValue(activePi));
  const circleAreaApproximation = multiplyExact(circle.areaCoefficient, piValue(activePi));
  const grid = makeGridEstimate(effectivePreset, width, height, cutWidth, cutHeight, radius);
  const expectedFirst = activeMode === 'grid-estimate'
    ? grid.midpoint
    : effectivePreset === 'circle'
      ? circumferenceApproximation
      : measures?.perimeter;
  const expectedSecond = effectivePreset === 'circle' ? circleAreaApproximation : measures?.area;
  const parsedFirst = parseDraft(firstAnswer);
  const parsedSecond = parseDraft(secondAnswer);
  const firstCorrect = expectedFirst !== undefined && parsedFirst !== null && compareExact(parsedFirst, expectedFirst) === 0;
  const secondRequired = activeMode !== 'grid-estimate';
  const secondCorrect = !secondRequired || (expectedSecond !== undefined && parsedSecond !== null && compareExact(parsedSecond, expectedSecond) === 0);
  const answerReady = parsedFirst !== null && (!secondRequired || parsedSecond !== null) && cutsValid;
  const answersCorrect = firstCorrect && secondCorrect;
  const revealMeasures = !challenge || checked;

  const invalidate = () => setChecked(false);
  const update = (setter: (value: ExactRational) => void) => (value: ExactRational) => { invalidate(); setter(value); };
  const reset = () => {
    setActiveMode(defaultMode); setActivePreset(defaultPreset); setStrategy(defaultStrategy); setActivePi(defaultPi);
    setWidth(defaultWidth); setHeight(defaultHeight); setCutWidth(defaultCutWidth); setCutHeight(defaultCutHeight); setRadius(defaultRadius);
    setFirstAnswer(''); setSecondAnswer(''); setChecked(false);
  };

  const result = (() => {
    if (!cutsValid || measures === null && effectivePreset !== 'circle') return { symbol: '!', headline: 'Вырез не помещается внутри фигуры.', detail: 'Ширина и высота выреза должны быть строго меньше внешних размеров.' };
    if (challenge && !checked) return { symbol: '?', headline: activeMode === 'grid-estimate' ? 'Запиши среднюю оценку площади.' : effectivePreset === 'circle' ? 'Вычисли длину окружности и площадь круга.' : 'Вычисли периметр и площадь.', detail: 'Результаты появятся только после нажатия «Проверить».' };
    if (challenge && checked) {
      const detail = activeMode === 'grid-estimate'
        ? `Средняя оценка: ${display(grid.midpoint)} ${unitLabel}².`
        : effectivePreset === 'circle'
          ? `C ≈ ${display(circumferenceApproximation)} ${unitLabel}; S ≈ ${display(circleAreaApproximation)} ${unitLabel}² при π ≈ ${activePi}.`
          : `P = ${display(measures!.perimeter)} ${unitLabel}; S = ${display(measures!.area)} ${unitLabel}².`;
      return { symbol: answersCorrect ? '✓' : '×', headline: answersCorrect ? 'Все значения верны.' : 'Есть значение, которое стоит пересчитать.', detail };
    }
    if (activeMode === 'grid-estimate') return { symbol: '▦', headline: `Оценка: от ${display(grid.lower)} до ${display(grid.upper)} ${unitLabel}².`, detail: `Средняя оценка ${display(grid.midpoint)} ${unitLabel}²: ${grid.full} полных и ${grid.partial} частичных клеток.` };
    if (effectivePreset === 'circle') return { symbol: '○', headline: `C = ${symbolicPi(circle.circumferenceCoefficient)} ≈ ${display(circumferenceApproximation)} ${unitLabel}.`, detail: `S = ${symbolicPi(circle.areaCoefficient)} ≈ ${display(circleAreaApproximation)} ${unitLabel}² при π ≈ ${activePi}. Окружность — граница, круг — заполненная область.` };
    return { symbol: '▰', headline: `P = ${display(measures!.perimeter)} ${unitLabel}; S = ${display(measures!.area)} ${unitLabel}².`, detail: strategy === 'count' ? 'Периметр измеряет границу, площадь — поверхность внутри.' : strategy === 'split' ? 'Площади неперекрывающихся частей складываются.' : 'Можно дополнить фигуру до прямоугольника и вычесть лишнюю часть.' };
  })();

  return (
    <section className="dm-lab dm-geometry-figure-measure not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header"><div><p className="dm-lab__eyebrow">Измерение фигур</p><h3 className="dm-lab__title" id={`${labId}-heading`}>Граница, поверхность и окружность</h3><p>Единица длины превращается в квадратную единицу только при измерении площади.</p></div><span className="dm-lab__badge">{unitLabel} · {unitLabel}²</span></header>
      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Режим измерения фигуры">{MODES.map((item) => <button type="button" className={activeMode === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'} aria-pressed={activeMode === item} onClick={() => { setActiveMode(item); if (item === 'perimeter-area' && activePreset === 'circle') setActivePreset('rectangle'); setChecked(false); }} key={item}>{MODE_LABELS[item]}</button>)}</div>

        {activeMode !== 'circle' && <div className="dm-geometry-preset-buttons" role="group" aria-label="Фигура">{PRESETS.filter((item) => item !== 'circle' || activeMode === 'grid-estimate').map((item) => <button type="button" className={effectivePreset === item ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'} aria-pressed={effectivePreset === item} onClick={() => { setActivePreset(item); setChecked(false); }} key={item}>{PRESET_LABELS[item]}</button>)}</div>}

        <div className="dm-lab__controls dm-geometry-controls">
          {effectivePreset === 'circle' ? <ExactField id={`${labId}-radius`} label="Радиус" value={radius} unit={unitLabel} onChange={update(setRadius)} /> : <><ExactField id={`${labId}-width`} label="Ширина" value={width} unit={unitLabel} onChange={update(setWidth)} /><ExactField id={`${labId}-height`} label="Высота" value={height} unit={unitLabel} onChange={update(setHeight)} />{effectivePreset === 'l-shape' && <><ExactField id={`${labId}-cut-width`} label="Ширина выреза" value={cutWidth} unit={unitLabel} onChange={update(setCutWidth)} /><ExactField id={`${labId}-cut-height`} label="Высота выреза" value={cutHeight} unit={unitLabel} onChange={update(setCutHeight)} /></>}</>}
        </div>

        {effectivePreset === 'circle' && <div className="dm-geometry-pi-switch" role="group" aria-label="Приближение числа пи"><button type="button" aria-pressed={activePi === '3.14'} className={activePi === '3.14' ? 'dm-geometry-preset-button--active' : ''} onClick={() => { setActivePi('3.14'); setChecked(false); }}>π ≈ 3,14</button><button type="button" aria-pressed={activePi === '22/7'} className={activePi === '22/7' ? 'dm-geometry-preset-button--active' : ''} onClick={() => { setActivePi('22/7'); setChecked(false); }}>π ≈ 22/7</button></div>}
        {activeMode === 'perimeter-area' && <div className="dm-geometry-strategies" role="group" aria-label="Стратегия вычисления площади">{STRATEGIES.map((item) => <button type="button" aria-pressed={strategy === item} className={strategy === item ? 'dm-geometry-strategy dm-geometry-strategy--active' : 'dm-geometry-strategy'} onClick={() => { setStrategy(item); setChecked(false); }} key={item}>{STRATEGY_LABELS[item]}</button>)}</div>}

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемая схема измеряемой фигуры" tabIndex={0}><FigurePicture id={`${labId}-figure`} mode={activeMode} preset={effectivePreset} strategy={strategy} width={width} height={height} cutWidth={cutWidth} cutHeight={cutHeight} radius={radius} unit={unitLabel} grid={grid} revealMeasures={revealMeasures} /></div>

        {challenge && (
          <div className="dm-geometry-answer-grid">
            <AnswerField id={`${labId}-answer-first`} label={activeMode === 'grid-estimate' ? `Средняя оценка, ${unitLabel}²` : effectivePreset === 'circle' ? `Длина окружности, ${unitLabel}` : `Периметр, ${unitLabel}`} value={firstAnswer} onChange={(value) => { setFirstAnswer(value); setChecked(false); }} onSubmit={() => { if (answerReady) setChecked(true); }} />
            {secondRequired && <AnswerField id={`${labId}-answer-second`} label={`Площадь, ${unitLabel}²`} value={secondAnswer} onChange={(value) => { setSecondAnswer(value); setChecked(false); }} onSubmit={() => { if (answerReady) setChecked(true); }} />}
            <button className="dm-button" type="button" disabled={!answerReady} onClick={() => setChecked(true)}>Проверить</button>
          </div>
        )}
        <div className="dm-result" aria-live="polite" aria-atomic="true"><span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span><p><strong>{result.headline}</strong><small>{result.detail}</small></p></div>
        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
