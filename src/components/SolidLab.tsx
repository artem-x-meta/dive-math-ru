import { useEffect, useId, useRef, useState } from 'react';
import {
  addExact,
  compareExact,
  formatExactRussian,
  multiplyExact,
  parseExact,
  subtractExact,
  toExactNumber,
  type ExactInput,
  type ExactRational,
} from '../lib/exactRational';
import {
  cuboidVolume,
  validateCubeNet,
  type CubeNetValidationReason,
  type GeometryPoint,
  type GridCell,
} from '../lib/geometry';

export type { GeometryPoint } from '../lib/geometry';

export type SolidKind =
  | 'cube'
  | 'cuboid'
  | 'triangular-prism'
  | 'square-pyramid'
  | 'cylinder'
  | 'cone'
  | 'sphere';
export type SolidLabMode = 'identify' | 'net' | 'volume';
export type SolidLengthUnit = 'cm' | 'dm' | 'm';

export interface SolidLabProps {
  mode?: SolidLabMode;
  initialSolid?: SolidKind;
  initialNet?: readonly GeometryPoint[];
  initialLength?: number | string;
  initialWidth?: number | string;
  initialHeight?: number | string;
  unit?: SolidLengthUnit;
  challenge?: boolean;
}

interface SolidInfo {
  readonly label: string;
  readonly visualDescription: string;
  readonly surfaces: string;
  readonly edges: string;
  readonly vertices: string;
}

const MODES: readonly SolidLabMode[] = ['identify', 'net', 'volume'];
const SOLIDS: readonly SolidKind[] = ['cube', 'cuboid', 'triangular-prism', 'square-pyramid', 'cylinder', 'cone', 'sphere'];
const UNITS: readonly SolidLengthUnit[] = ['cm', 'dm', 'm'];
const MODE_LABELS: Readonly<Record<SolidLabMode, string>> = {
  identify: 'Узнать тело',
  net: 'Развёртка куба',
  volume: 'Объём',
};
const UNIT_LABELS: Readonly<Record<SolidLengthUnit, string>> = { cm: 'см', dm: 'дм', m: 'м' };
const SOLID_INFO: Readonly<Record<SolidKind, SolidInfo>> = {
  cube: { label: 'куб', visualDescription: 'Шесть равных квадратных граней.', surfaces: '6 плоских граней', edges: '12 рёбер', vertices: '8 вершин' },
  cuboid: { label: 'прямоугольный параллелепипед', visualDescription: 'Шесть прямоугольных граней; противоположные грани равны.', surfaces: '6 плоских граней', edges: '12 рёбер', vertices: '8 вершин' },
  'triangular-prism': { label: 'треугольная призма', visualDescription: 'Два равных треугольных основания соединены тремя прямоугольниками.', surfaces: '5 граней', edges: '9 рёбер', vertices: '6 вершин' },
  'square-pyramid': { label: 'четырёхугольная пирамида', visualDescription: 'Квадратное основание и четыре треугольника сходятся в вершине.', surfaces: '5 граней', edges: '8 рёбер', vertices: '5 вершин' },
  cylinder: { label: 'цилиндр', visualDescription: 'Два равных круглых основания соединены боковой поверхностью.', surfaces: '2 основания и боковая поверхность', edges: '2 круглые границы', vertices: 'нет вершин' },
  cone: { label: 'конус', visualDescription: 'Круглое основание и боковая поверхность сходятся в одной вершине.', surfaces: 'основание и боковая поверхность', edges: '1 круглая граница', vertices: '1 вершина' },
  sphere: { label: 'шар / сфера', visualDescription: 'Сфера — граница, одинаково удалённая от центра; шар состоит из этой границы и всего пространства внутри.', surfaces: '1 сферическая граница', edges: 'нет рёбер', vertices: 'нет вершин' },
};
const NET_REASON_LABELS: Readonly<Record<CubeNetValidationReason, string>> = {
  valid: 'Шесть квадратов складываются в шесть разных граней куба.',
  'cell-count': 'Для развёртки куба нужны ровно 6 квадратов.',
  duplicate: 'Один квадрат отмечен дважды.',
  disconnected: 'Все квадраты должны быть соединены сторонами.',
  overlap: 'При складывании две грани попадают на одно место.',
  'inconsistent-fold': 'Сгибы противоречат друг другу и не дают куб.',
};
const DEFAULT_NET: readonly GeometryPoint[] = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 1, y: 1 }, { x: 1, y: -1 },
] as const;
const MINIMUM = parseExact('0.1');
const MAXIMUM = parseExact('1000');
const FIELD_STEP = parseExact('0.1');

function safeMode(value: SolidLabMode | undefined): SolidLabMode {
  return value !== undefined && MODES.includes(value) ? value : 'identify';
}

function safeSolid(value: SolidKind | undefined): SolidKind {
  return value !== undefined && SOLIDS.includes(value) ? value : 'cube';
}

function safeUnit(value: SolidLengthUnit | undefined): SolidLengthUnit {
  return value !== undefined && UNITS.includes(value) ? value : 'cm';
}

function safeExact(value: ExactInput | undefined, fallback: ExactInput): ExactRational {
  try {
    const parsed = value === undefined ? parseExact(fallback) : parseExact(value);
    return compareExact(parsed, MINIMUM) >= 0 && compareExact(parsed, MAXIMUM) <= 0 ? parsed : parseExact(fallback);
  } catch {
    return parseExact(fallback);
  }
}

function clampExact(value: ExactRational): ExactRational {
  if (compareExact(value, MINIMUM) < 0) return MINIMUM;
  if (compareExact(value, MAXIMUM) > 0) return MAXIMUM;
  return value;
}

function parseDraft(raw: string): ExactRational | null {
  const source = raw.trim().replace('−', '-');
  if (source.length === 0 || source.length > 64) return null;
  try { return parseExact(source); } catch { return null; }
}

function inputText(value: ExactRational): string {
  return formatExactRussian(value).replace('−', '-');
}

function display(value: ExactRational): string {
  return formatExactRussian(value);
}

interface DimensionFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: ExactRational;
  readonly unit: string;
  readonly onChange: (value: ExactRational) => void;
}

function DimensionField({ id, label, value, unit, onChange }: DimensionFieldProps) {
  const [draft, setDraft] = useState(inputText(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);
  useEffect(() => { if (!editing) setDraft(inputText(value)); }, [editing, value]);

  const commit = () => {
    const parsed = parseDraft(draft);
    const next = parsed === null ? value : clampExact(parsed);
    setDraft(inputText(next));
    onChange(next);
  };
  const nudge = (direction: -1 | 1) => onChange(clampExact(direction < 0 ? subtractExact(value, FIELD_STEP) : addExact(value, FIELD_STEP)));

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>{label}<span className="dm-field__value">{display(value)} {unit}</span></label>
      <div className="dm-geometry-field__control">
        <button type="button" onClick={() => nudge(-1)} disabled={compareExact(value, MINIMUM) <= 0} aria-label={`Уменьшить ${label.toLowerCase()} на 0,1 ${unit}`}>−</button>
        <input id={id} type="text" inputMode="decimal" value={draft} aria-describedby={`${id}-hint`} onFocus={() => { cancelCommit.current = false; setEditing(true); }} onChange={(event) => { const raw = event.target.value.slice(0, 64); if (/^[+\-−]?\d*(?:[.,]\d*)?(?:\s*\/\s*[+\-−]?\d*(?:[.,]\d*)?)?$/.test(raw)) { setDraft(raw); const parsed = parseDraft(raw); if (parsed && compareExact(parsed, MINIMUM) >= 0 && compareExact(parsed, MAXIMUM) <= 0) onChange(parsed); } }} onBlur={() => { if (cancelCommit.current) { cancelCommit.current = false; setDraft(inputText(value)); } else commit(); setEditing(false); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape') { event.preventDefault(); cancelCommit.current = true; setDraft(inputText(value)); event.currentTarget.blur(); } }} />
        <button type="button" onClick={() => nudge(1)} disabled={compareExact(value, MAXIMUM) >= 0} aria-label={`Увеличить ${label.toLowerCase()} на 0,1 ${unit}`}>+</button>
      </div>
      <small id={`${id}-hint`}>От 0,1 до 1000 {unit}</small>
    </div>
  );
}

function safeNet(points: readonly GeometryPoint[] | undefined): readonly GridCell[] {
  const source = Array.isArray(points) && points.length > 0 ? points.slice(0, 6) : DEFAULT_NET;
  const unique = new Map<string, GeometryPoint>();
  for (const point of source) {
    if (typeof point?.x !== 'number' || typeof point?.y !== 'number' || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const normalized = { x: Math.max(-20, Math.min(20, Math.round(point.x))), y: Math.max(-20, Math.min(20, Math.round(point.y))) };
    unique.set(`${normalized.x},${normalized.y}`, normalized);
  }
  const cells = [...unique.values()];
  if (cells.length === 0) return safeNet(DEFAULT_NET);
  const minX = Math.min(...cells.map((cell) => cell.x));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  const maxY = Math.max(...cells.map((cell) => cell.y));
  if (maxX - minX >= 5 || maxY - minY >= 5) return safeNet(DEFAULT_NET);
  const offsetX = Math.floor((5 - (maxX - minX + 1)) / 2) - minX;
  const offsetY = Math.floor((5 - (maxY - minY + 1)) / 2) - minY;
  return cells.map((cell) => ({ x: cell.x + offsetX, y: cell.y + offsetY }));
}

function keyOf(point: GeometryPoint): string {
  return `${point.x},${point.y}`;
}

interface SolidPictureProps {
  readonly id: string;
  readonly solid: SolidKind;
  readonly mode: 'identify' | 'volume';
  readonly revealName: boolean;
  readonly length: ExactRational;
  readonly width: ExactRational;
  readonly height: ExactRational;
  readonly unit: string;
}

function SolidPicture({ id, solid, mode, revealName, length, width, height, unit }: SolidPictureProps) {
  const title = revealName ? `Модель: ${SOLID_INFO[solid].label}` : 'Пространственное тело для распознавания';
  const description = mode === 'volume'
    ? `Условная аксонометрическая схема. Длина ${display(length)} ${unit}, ширина ${display(width)} ${unit}, высота ${display(height)} ${unit}. Изображённые под углом рёбра не следует измерять по экрану.`
    : `${SOLID_INFO[solid].visualDescription} Название нужно определить по изображению.`;
  const common = <><title id={`${id}-title`}>{title}</title><desc id={`${id}-desc`}>{description}</desc></>;
  const labels = mode === 'volume' && <g className="dm-geometry-solid__dimensions"><text x="355" y="384">{display(length)} {unit}</text><text x="548" y="248">{display(width)} {unit}</text><text x="165" y="240">{display(height)} {unit}</text></g>;

  if (solid === 'cube' || solid === 'cuboid') {
    const cube = solid === 'cube';
    const frontLeft = cube ? 235 : 190;
    const frontTop = cube ? 130 : 165;
    const frontWidth = cube ? 210 : 300;
    const frontHeight = cube ? 210 : 165;
    const depthX = cube ? 86 : 108;
    const depthY = cube ? -62 : -70;
    const frontRight = frontLeft + frontWidth;
    const frontBottom = frontTop + frontHeight;
    const backLeft = frontLeft + depthX;
    const backRight = frontRight + depthX;
    const backTop = frontTop + depthY;
    const backBottom = frontBottom + depthY;
    const boundedDivisions = (value: ExactRational, fallback: number) => {
      const numeric = toExactNumber(value);
      return Number.isInteger(numeric) && numeric >= 1 && numeric <= 8 ? numeric : fallback;
    };
    const lengthDivisions = mode === 'volume' ? boundedDivisions(length, 4) : 1;
    const widthDivisions = mode === 'volume' ? boundedDivisions(width, 3) : 1;
    const heightDivisions = mode === 'volume' ? boundedDivisions(height, 3) : 1;
    return (
      <svg className={`dm-geometry-solid dm-geometry-solid--${solid}`} viewBox="0 0 720 430" role="img" aria-labelledby={`${id}-title ${id}-desc`}>{common}
        <g className="dm-geometry-solid__body">
          <polygon className="dm-geometry-solid__top" points={`${frontLeft},${frontTop} ${frontRight},${frontTop} ${backRight},${backTop} ${backLeft},${backTop}`} />
          <polygon className="dm-geometry-solid__side" points={`${frontRight},${frontTop} ${backRight},${backTop} ${backRight},${backBottom} ${frontRight},${frontBottom}`} />
          <polygon className="dm-geometry-solid__front" points={`${frontLeft},${frontTop} ${frontRight},${frontTop} ${frontRight},${frontBottom} ${frontLeft},${frontBottom}`} />
          <path className="dm-geometry-solid__hidden" d={`M${frontLeft} ${frontTop} L${backLeft} ${backTop} L${backRight} ${backTop} M${backLeft} ${backTop} L${backLeft} ${backBottom} L${frontLeft} ${frontBottom} M${backLeft} ${backBottom} L${backRight} ${backBottom}`} />
          {cube && <g className="dm-geometry-solid__equal-edge-marks" aria-hidden="true"><line x1={(frontLeft + frontRight) / 2} y1={frontTop - 8} x2={(frontLeft + frontRight) / 2} y2={frontTop + 8} /><line x1={frontLeft - 8} y1={(frontTop + frontBottom) / 2} x2={frontLeft + 8} y2={(frontTop + frontBottom) / 2} /><line x1={(frontLeft + backLeft) / 2 - 5} y1={(frontTop + backTop) / 2 - 7} x2={(frontLeft + backLeft) / 2 + 5} y2={(frontTop + backTop) / 2 + 7} /></g>}
          {mode === 'volume' && <g className="dm-geometry-solid__layers" aria-hidden="true">
            {Array.from({ length: Math.max(0, lengthDivisions - 1) }, (_, index) => { const ratio = (index + 1) / lengthDivisions; const x = frontLeft + frontWidth * ratio; return <g key={`length-${index}`}><line x1={x} y1={frontTop} x2={x} y2={frontBottom} /><line x1={x} y1={frontTop} x2={x + depthX} y2={backTop} /></g>; })}
            {Array.from({ length: Math.max(0, heightDivisions - 1) }, (_, index) => { const ratio = (index + 1) / heightDivisions; const y = frontTop + frontHeight * ratio; return <g key={`height-${index}`}><line x1={frontLeft} y1={y} x2={frontRight} y2={y} /><line x1={frontRight} y1={y} x2={backRight} y2={y + depthY} /></g>; })}
            {Array.from({ length: Math.max(0, widthDivisions - 1) }, (_, index) => { const ratio = (index + 1) / widthDivisions; return <line x1={frontLeft + depthX * ratio} y1={frontTop + depthY * ratio} x2={frontRight + depthX * ratio} y2={frontTop + depthY * ratio} key={`width-${index}`} />; })}
          </g>}
        </g>{labels}
      </svg>
    );
  }
  if (solid === 'triangular-prism') return (
    <svg className="dm-geometry-solid" viewBox="0 0 720 430" role="img" aria-labelledby={`${id}-title ${id}-desc`}>{common}<g className="dm-geometry-solid__body"><polygon className="dm-geometry-solid__front" points="190,330 310,120 430,330" /><polygon className="dm-geometry-solid__side" points="430,330 530,270 410,60 310,120" /><polygon className="dm-geometry-solid__top" points="190,330 290,270 530,270 430,330" /><path className="dm-geometry-solid__hidden" d="M290 270 L410 60 M290 270 L530 270" /></g></svg>
  );
  if (solid === 'square-pyramid') return (
    <svg className="dm-geometry-solid" viewBox="0 0 720 430" role="img" aria-labelledby={`${id}-title ${id}-desc`}>{common}<g className="dm-geometry-solid__body"><polygon className="dm-geometry-solid__front" points="190,330 450,330 360,70" /><polygon className="dm-geometry-solid__side" points="450,330 555,260 360,70" /><polygon className="dm-geometry-solid__top" points="190,330 295,260 555,260 450,330" /><path className="dm-geometry-solid__hidden" d="M295 260 L360 70" /></g></svg>
  );
  if (solid === 'cylinder') return (
    <svg className="dm-geometry-solid" viewBox="0 0 720 430" role="img" aria-labelledby={`${id}-title ${id}-desc`}>{common}<g className="dm-geometry-solid__round"><path d="M230 120 L230 315 C230 365 490 365 490 315 L490 120" /><ellipse cx="360" cy="120" rx="130" ry="48" /><path className="dm-geometry-solid__hidden" d="M230 315 C230 265 490 265 490 315" /></g></svg>
  );
  if (solid === 'cone') return (
    <svg className="dm-geometry-solid" viewBox="0 0 720 430" role="img" aria-labelledby={`${id}-title ${id}-desc`}>{common}<g className="dm-geometry-solid__round"><path d="M360 55 L225 330 C225 380 495 380 495 330 Z" /><path className="dm-geometry-solid__hidden" d="M225 330 C225 280 495 280 495 330" /></g></svg>
  );
  return (
    <svg className="dm-geometry-solid" viewBox="0 0 720 430" role="img" aria-labelledby={`${id}-title ${id}-desc`}>{common}<g className="dm-geometry-solid__round"><circle cx="360" cy="220" r="150" /><path className="dm-geometry-solid__hidden" d="M210 220 A150 48 0 0 1 510 220" /><path className="dm-geometry-solid__equator" d="M210 220 A150 48 0 0 0 510 220" /><path d="M360 70 C285 125 285 315 360 370 C435 315 435 125 360 70" /></g></svg>
  );
}

interface NetEditorProps {
  readonly id: string;
  readonly cells: readonly GridCell[];
  readonly focusIndex: number;
  readonly setFocusIndex: (index: number) => void;
  readonly onToggle: (point: GridCell) => void;
}

function NetEditor({ id, cells, focusIndex, setFocusIndex, onToggle }: NetEditorProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = new Set(cells.map(keyOf));
  const moveFocus = (index: number, dx: number, dy: number) => {
    const row = Math.floor(index / 5);
    const column = index % 5;
    const nextRow = Math.max(0, Math.min(4, row + dy));
    const nextColumn = Math.max(0, Math.min(4, column + dx));
    const next = nextRow * 5 + nextColumn;
    setFocusIndex(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="dm-geometry-net" role="grid" aria-label="Редактор развёртки куба, сетка 5 на 5" aria-describedby={`${id}-hint`} aria-rowcount={5} aria-colcount={5}>
      {Array.from({ length: 5 }, (_, row) => <div role="row" className="dm-geometry-net__row" key={row}>
        {Array.from({ length: 5 }, (_, column) => {
        const index = row * 5 + column;
        const point = { x: column, y: row };
        const active = selected.has(keyOf(point));
        return <button
          type="button"
          role="gridcell"
          ref={(element) => { refs.current[index] = element; }}
          tabIndex={focusIndex === index ? 0 : -1}
          aria-selected={active}
          aria-rowindex={row + 1}
          aria-colindex={column + 1}
          aria-label={`Строка ${point.y + 1}, столбец ${point.x + 1}: ${active ? 'квадрат выбран' : 'пусто'}`}
          className={active ? 'dm-geometry-net__cell dm-geometry-net__cell--active' : 'dm-geometry-net__cell'}
          onFocus={() => setFocusIndex(index)}
          onClick={() => onToggle(point)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') { event.preventDefault(); moveFocus(index, -1, 0); }
            if (event.key === 'ArrowRight') { event.preventDefault(); moveFocus(index, 1, 0); }
            if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(index, 0, -1); }
            if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(index, 0, 1); }
            if (event.key === 'Home') { event.preventDefault(); moveFocus(index, -5, 0); }
            if (event.key === 'End') { event.preventDefault(); moveFocus(index, 5, 0); }
          }}
          key={column}
        ><span aria-hidden="true">{active ? '■' : ''}</span></button>;
      })}</div>)}
    </div>
  );
}

export default function SolidLab({
  mode,
  initialSolid,
  initialNet,
  initialLength,
  initialWidth,
  initialHeight,
  unit,
  challenge = false,
}: SolidLabProps) {
  const reactId = useId();
  const labId = `solid-lab-${reactId.replace(/:/g, '')}`;
  const defaultMode = safeMode(mode);
  const defaultSolid = safeSolid(initialSolid);
  const defaultNet = safeNet(initialNet);
  const lengthUnit = safeUnit(unit);
  const unitLabel = UNIT_LABELS[lengthUnit];
  const defaultLength = safeExact(initialLength, 4);
  const defaultWidth = safeExact(initialWidth, 3);
  const defaultHeight = safeExact(initialHeight, 2);
  const [activeMode, setActiveMode] = useState(defaultMode);
  const [solid, setSolid] = useState(defaultSolid);
  const [net, setNet] = useState<readonly GridCell[]>(defaultNet);
  const [focusIndex, setFocusIndex] = useState(12);
  const [length, setLength] = useState(defaultLength);
  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  const [identifyAnswer, setIdentifyAnswer] = useState<SolidKind | null>(null);
  const [volumeAnswer, setVolumeAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const volumeKind: 'cube' | 'cuboid' = solid === 'cube' ? 'cube' : 'cuboid';
  const volumeWidth = volumeKind === 'cube' ? length : width;
  const volumeHeight = volumeKind === 'cube' ? length : height;
  const volume = cuboidVolume(length, volumeWidth, volumeHeight);
  const baseArea = multiplyExact(length, volumeWidth);
  const parsedVolumeAnswer = parseDraft(volumeAnswer);
  const volumeCorrect = parsedVolumeAnswer !== null && compareExact(parsedVolumeAnswer, volume) === 0;
  const identifyCorrect = identifyAnswer === solid;
  const netValidation = validateCubeNet(net);
  const reveal = !challenge || checked;

  const invalidate = () => setChecked(false);
  const update = (setter: (value: ExactRational) => void) => (value: ExactRational) => { invalidate(); setter(value); };
  const chooseSolid = (value: SolidKind) => { setSolid(value); setChecked(false); setIdentifyAnswer(null); };
  const toggleCell = (point: GridCell) => {
    setChecked(false);
    setNet((current) => {
      const key = keyOf(point);
      const exists = current.some((cell) => keyOf(cell) === key);
      if (exists) return current.filter((cell) => keyOf(cell) !== key);
      if (current.length >= 6) return current;
      return [...current, point];
    });
  };
  const reset = () => {
    setActiveMode(defaultMode); setSolid(defaultSolid); setNet(defaultNet); setFocusIndex(12);
    setLength(defaultLength); setWidth(defaultWidth); setHeight(defaultHeight);
    setIdentifyAnswer(null); setVolumeAnswer(''); setChecked(false);
  };

  const result = (() => {
    if (activeMode === 'identify') {
      if (challenge && !checked) return { symbol: '?', headline: 'Определи тело по модели.', detail: 'Выбери название, затем нажми «Проверить».' };
      if (challenge) return { symbol: identifyCorrect ? '✓' : '×', headline: identifyCorrect ? `Верно: это ${SOLID_INFO[solid].label}.` : `Это ${SOLID_INFO[solid].label}.`, detail: `${SOLID_INFO[solid].surfaces}; ${SOLID_INFO[solid].edges}; ${SOLID_INFO[solid].vertices}.` };
      return { symbol: '◇', headline: `${SOLID_INFO[solid].label}.`, detail: `${SOLID_INFO[solid].surfaces}; ${SOLID_INFO[solid].edges}; ${SOLID_INFO[solid].vertices}.` };
    }
    if (activeMode === 'net') {
      if (!checked) return { symbol: '?', headline: `Выбрано квадратов: ${net.length} из 6.`, detail: 'Сначала составь развёртку, затем проверь складывание. Стрелки перемещают фокус, пробел выбирает клетку.' };
      return { symbol: netValidation.valid ? '✓' : '×', headline: netValidation.valid ? 'Это развёртка куба.' : 'Эта схема пока не складывается в куб.', detail: NET_REASON_LABELS[netValidation.reason] };
    }
    if (challenge && !checked) return { symbol: '?', headline: 'Вычисли объём.', detail: 'Перемножь три измерения; результат запиши в кубических единицах.' };
    if (challenge) return { symbol: volumeCorrect ? '✓' : '×', headline: volumeCorrect ? 'Объём вычислен верно.' : 'Проверь произведение трёх измерений.', detail: `V = ${display(length)} · ${display(volumeWidth)} · ${display(volumeHeight)} = ${display(volume)} ${unitLabel}³.` };
    return { symbol: '▦', headline: `V = ${display(volume)} ${unitLabel}³.`, detail: `Площадь слоя: ${display(length)} · ${display(volumeWidth)} = ${display(baseArea)} ${unitLabel}²; объём равен площади слоя, умноженной на высоту ${display(volumeHeight)} ${unitLabel}. Сетка слоёв ограничена и схематична; наклонные рёбра по экрану не измеряют.` };
  })();

  return (
    <section className="dm-lab dm-geometry-solid-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header"><div><p className="dm-lab__eyebrow">Пространственные тела</p><h3 className="dm-lab__title" id={`${labId}-heading`}>От модели и развёртки к объёму</h3><p>Плоский рисунок передаёт устройство тела, а числовые размеры задают его объём.</p></div><span className="dm-lab__badge">{activeMode === 'volume' ? `${unitLabel}³` : '3D → 2D'}</span></header>
      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Режим лаборатории пространственных тел">{MODES.map((item) => <button type="button" className={activeMode === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'} aria-pressed={activeMode === item} onClick={() => { setActiveMode(item); setChecked(false); }} key={item}>{MODE_LABELS[item]}</button>)}</div>

        {activeMode === 'identify' && !challenge && <div className="dm-geometry-solid-picker" role="group" aria-label="Выбрать пространственное тело">{SOLIDS.map((item) => <button type="button" aria-pressed={solid === item} className={solid === item ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'} onClick={() => chooseSolid(item)} key={item}>{SOLID_INFO[item].label}</button>)}</div>}
        {activeMode === 'identify' && challenge && <div className="dm-geometry-example-switch"><span>Рассмотри признаки модели</span><button className="dm-button dm-button--secondary" type="button" onClick={() => chooseSolid(SOLIDS[(SOLIDS.indexOf(solid) + 1) % SOLIDS.length]!)}>Следующее тело</button></div>}

        {activeMode === 'volume' && <><div className="dm-geometry-preset-buttons" role="group" aria-label="Тело для вычисления объёма"><button type="button" aria-pressed={volumeKind === 'cube'} className={volumeKind === 'cube' ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'} onClick={() => chooseSolid('cube')}>Куб</button><button type="button" aria-pressed={volumeKind === 'cuboid'} className={volumeKind === 'cuboid' ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'} onClick={() => chooseSolid('cuboid')}>Параллелепипед</button></div><div className="dm-lab__controls dm-geometry-controls"><DimensionField id={`${labId}-length`} label={volumeKind === 'cube' ? 'Ребро' : 'Длина'} value={length} unit={unitLabel} onChange={update(setLength)} />{volumeKind === 'cuboid' && <><DimensionField id={`${labId}-width`} label="Ширина" value={width} unit={unitLabel} onChange={update(setWidth)} /><DimensionField id={`${labId}-height`} label="Высота" value={height} unit={unitLabel} onChange={update(setHeight)} /></>}</div></>}

        {activeMode === 'net' ? (
          <section className="dm-geometry-net-panel" aria-labelledby={`${labId}-net-heading`}><div className="dm-geometry-net-panel__heading"><div><p>Редактор 5 × 5</p><h4 id={`${labId}-net-heading`}>Выбери шесть квадратов</h4></div><span>{net.length}/6</span></div><p id={`${labId}-net-hint`}>Стрелки перемещают фокус по сетке; Enter или пробел включает и выключает квадрат.</p><NetEditor id={`${labId}-net`} cells={net} focusIndex={focusIndex} setFocusIndex={setFocusIndex} onToggle={toggleCell} /><button className="dm-button" type="button" onClick={() => setChecked(true)}>Проверить развёртку</button></section>
        ) : (
          <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемая модель пространственного тела" tabIndex={0}><SolidPicture id={`${labId}-solid`} solid={activeMode === 'volume' ? volumeKind : solid} mode={activeMode} revealName={reveal} length={length} width={volumeWidth} height={volumeHeight} unit={unitLabel} /></div>
        )}

        {challenge && activeMode === 'identify' && <fieldset className="dm-geometry-challenge"><legend>Как называется тело?</legend>{SOLIDS.map((item) => <label key={item}><input type="radio" name={`${labId}-solid-answer`} checked={identifyAnswer === item} onChange={() => { setIdentifyAnswer(item); setChecked(false); }} />{SOLID_INFO[item].label}</label>)}<button className="dm-button" type="button" disabled={identifyAnswer === null} onClick={() => setChecked(true)}>Проверить</button></fieldset>}
        {challenge && activeMode === 'volume' && <div className="dm-geometry-answer"><label htmlFor={`${labId}-volume-answer`}>Мой объём, {unitLabel}³</label><input id={`${labId}-volume-answer`} type="text" inputMode="decimal" value={volumeAnswer} onChange={(event) => { const raw = event.target.value.slice(0, 64); if (/^[+\-−]?\d*(?:[.,]\d*)?(?:\s*\/\s*[+\-−]?\d*(?:[.,]\d*)?)?$/.test(raw)) { setVolumeAnswer(raw); setChecked(false); } }} onBlur={(event) => setVolumeAnswer(event.currentTarget.value.trim())} onKeyDown={(event) => { if (event.key === 'Enter' && parsedVolumeAnswer !== null) { event.preventDefault(); setChecked(true); } if (event.key === 'Escape') { event.preventDefault(); setVolumeAnswer(''); setChecked(false); } }} /><button className="dm-button" type="button" disabled={parsedVolumeAnswer === null} onClick={() => setChecked(true)}>Проверить</button></div>}

        <div className="dm-result" aria-live="polite" aria-atomic="true"><span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span><p><strong>{result.headline}</strong><small>{result.detail}</small></p></div>
        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
