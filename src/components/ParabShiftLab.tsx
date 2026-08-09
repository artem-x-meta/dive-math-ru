import { useId, useMemo, useState } from 'react';
import { parabolaSegments, type Rational } from '../lib/quadratics';
import {
  integerShift,
  scaledFunctionText,
  scaledSegments,
  transformChain,
  transformSteps,
  vertexFormText,
  type ScaledQuadratic,
  type TransformStep,
  vertexFormToStandard,
} from '../lib/parabola';

export interface ParabShiftLabProps {
  /** Старший коэффициент из списка допустимых значений. */
  initialLeading?: number;
  /** Сдвиг вдоль оси x в записи y = a(x − m)² + n. */
  initialM?: number;
  /** Сдвиг вдоль оси y. */
  initialN?: number;
  /** Режим задачи: дан стандартный вид, график скрыт до нажатия «Проверить». */
  challenge?: boolean;
}

interface LeadingOption {
  readonly value: number;
  readonly rational: Rational;
  readonly label: string;
}

interface Preset {
  readonly title: string;
  readonly leading: number;
  readonly m: number;
  readonly n: number;
}

interface Puzzle {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

const EXTENT = 8;
const SHIFT_LIMIT = 5;
const SAMPLES = 241;

/** Только те коэффициенты, при которых сдвиги остаются целыми, а рисунок читаемым. */
const LEADING_OPTIONS: readonly LeadingOption[] = [
  { value: -2, rational: { numerator: -2, denominator: 1 }, label: '−2' },
  { value: -1, rational: { numerator: -1, denominator: 1 }, label: '−1' },
  { value: -0.5, rational: { numerator: -1, denominator: 2 }, label: '−0,5' },
  { value: 0.5, rational: { numerator: 1, denominator: 2 }, label: '0,5' },
  { value: 1, rational: { numerator: 1, denominator: 1 }, label: '1' },
  { value: 2, rational: { numerator: 2, denominator: 1 }, label: '2' },
  { value: 3, rational: { numerator: 3, denominator: 1 }, label: '3' },
];

const PRESETS: readonly Preset[] = [
  { title: 'Эталон y = x²', leading: 1, m: 0, n: 0 },
  { title: 'Вправо на 3', leading: 1, m: 3, n: 0 },
  { title: 'Влево на 2', leading: 1, m: -2, n: 0 },
  { title: 'Вверх на 4', leading: 1, m: 0, n: 4 },
  { title: 'Ветви вниз', leading: -1, m: 0, n: 0 },
  { title: 'Уже в 3 раза', leading: 3, m: 0, n: 0 },
  { title: 'Шире в 2 раза', leading: 0.5, m: 0, n: 0 },
  { title: 'Всё сразу', leading: -0.5, m: -3, n: 4 },
];

/** У каждой задачи вершина попадает в узел сетки, поэтому сдвиги целые. */
const PUZZLES: readonly Puzzle[] = [
  { a: 1, b: -6, c: 5 },
  { a: 1, b: 4, c: 1 },
  { a: -1, b: 2, c: 3 },
  { a: 2, b: -4, c: -1 },
  { a: 1, b: 2, c: 0 },
  { a: -2, b: -8, c: -5 },
];

const SHIFT_VALUES: readonly number[] = Array.from(
  { length: 2 * SHIFT_LIMIT + 1 },
  (_, index) => index - SHIFT_LIMIT,
);

const BOX = { xMin: -EXTENT, xMax: EXTENT, yMin: -EXTENT, yMax: EXTENT };
const GRID_VALUES: readonly number[] = Array.from({ length: 2 * EXTENT + 1 }, (_, index) => index - EXTENT);
/** Эталон y = x² один и тот же на всех рисунках — считаем его один раз. */
const GHOST_SEGMENTS = parabolaSegments(1, 0, 0, BOX, SAMPLES);

function num(value: number): string {
  return String(Math.round(value * 1000) / 1000).replace('-', '−').replace('.', ',');
}

function integerRational(value: number): Rational {
  return { numerator: value, denominator: 1 };
}

function findLeading(value: number | undefined, fallback: number): LeadingOption {
  const match = LEADING_OPTIONS.find((option) => option.value === value);
  return match ?? LEADING_OPTIONS.find((option) => option.value === fallback) ?? LEADING_OPTIONS[4]!;
}

function safeShift(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(SHIFT_LIMIT, Math.max(-SHIFT_LIMIT, Math.trunc(value)));
}

interface ShiftSelectProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}

function ShiftSelect({ id, label, hint, value, onChange }: ShiftSelectProps) {
  return (
    <div className="dm-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{num(value)}</span>
      </label>
      <select
        id={id}
        value={value}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {SHIFT_VALUES.map((item) => (
          <option value={item} key={item}>{num(item)}</option>
        ))}
      </select>
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

interface ShiftPlaneProps {
  id: string;
  scaled: ScaledQuadratic;
  vertexX: number;
  vertexY: number;
  formula: string;
  showGhost: boolean;
}

/** Масштаб по обеим осям одинаков: форма параболы на рисунке не искажена. */
function ShiftPlane({ id, scaled, vertexX, vertexY, formula, showGhost }: ShiftPlaneProps) {
  const centerX = 360;
  const centerY = 350;
  const radius = 320;
  const scale = radius / EXTENT;
  const px = (value: number) => centerX + value * scale;
  const py = (value: number) => centerY - value * scale;

  const labelValues = GRID_VALUES.filter((value) => value !== 0 && value % 2 === 0);
  const curve = useMemo(() => scaledSegments(scaled, BOX, SAMPLES), [scaled]);
  const vertexVisible = Math.abs(vertexX) <= EXTENT && Math.abs(vertexY) <= EXTENT;

  const polyline = (segments: { x: number; y: number }[][], className: string, keyPrefix: string) => (
    <g className={className} aria-hidden="true">
      {segments.map((segment, segmentIndex) => segment.slice(1).map((point, index) => {
        const previous = segment[index]!;
        return (
          <line
            key={`${keyPrefix}-${segmentIndex}-${index}`}
            x1={px(previous.x)}
            y1={py(previous.y)}
            x2={px(point.x)}
            y2={py(point.y)}
          />
        );
      }))}
    </g>
  );

  return (
    <svg className="dm-signed-plane" viewBox="0 0 720 700" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{`График функции ${formula} рядом с эталоном y = x²`}</title>
      <desc id={`${id}-desc`}>
        Сетка честная: одна клетка — одна единица по каждой оси, масштаб по осям одинаковый.
        {showGhost ? ' Пунктиром показан эталон y = x² с вершиной в начале координат.' : ' Эталон y = x² сейчас скрыт.'}
        {' '}Сплошной линией показан график {formula} с вершиной в точке ({num(vertexX)}; {num(vertexY)}).
        Ветви направлены {scaled.a > 0 ? 'вверх' : 'вниз'}, ось симметрии — прямая x = {num(vertexX)}.
      </desc>
      <defs>
        <marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path className="dm-signed-plane__axis-arrow" d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>

      <rect
        className="dm-signed-plane__background"
        x={centerX - radius}
        y={centerY - radius}
        width={radius * 2}
        height={radius * 2}
        rx="12"
      />

      <g className="dm-signed-plane__grid" aria-hidden="true">
        {GRID_VALUES.map((value) => (
          <g key={value}>
            <line x1={px(value)} y1={centerY - radius} x2={px(value)} y2={centerY + radius} />
            <line x1={centerX - radius} y1={py(value)} x2={centerX + radius} y2={py(value)} />
          </g>
        ))}
      </g>

      <line
        className="dm-signed-plane__axis"
        x1={centerX - radius}
        y1={centerY}
        x2={centerX + radius}
        y2={centerY}
        markerEnd={`url(#${id}-arrow)`}
      />
      <line
        className="dm-signed-plane__axis"
        x1={centerX}
        y1={centerY + radius}
        x2={centerX}
        y2={centerY - radius}
        markerEnd={`url(#${id}-arrow)`}
      />

      <g className="dm-signed-plane__labels" aria-hidden="true">
        {labelValues.map((value) => (
          <g key={value}>
            <text x={px(value)} y={centerY + 20}>{num(value)}</text>
            <text x={centerX - 16} y={py(value) + 4}>{num(value)}</text>
          </g>
        ))}
        <text x={centerX + radius - 6} y={centerY - 12}>x</text>
        <text x={centerX + 14} y={centerY - radius + 12}>y</text>
        <text x={centerX - 15} y={centerY + 19}>0</text>
      </g>

      {showGhost && polyline(GHOST_SEGMENTS, 'dm-signed-plane__reflection-guides', 'ghost')}
      {polyline(curve, 'dm-signed-plane__route-segment', 'curve')}

      {vertexVisible && (
        <g
          className="dm-signed-plane__point dm-signed-plane__point--waypoint"
          transform={`translate(${px(vertexX)} ${py(vertexY)})`}
          aria-hidden="true"
        >
          <circle r="7" />
          <text x={0} y={scaled.a > 0 ? 28 : -16}>({num(vertexX)}; {num(vertexY)})</text>
        </g>
      )}
    </svg>
  );
}

export default function ParabShiftLab({
  initialLeading,
  initialM,
  initialN,
  challenge = false,
}: ParabShiftLabProps) {
  const reactId = useId();
  const labId = `parab-shift-${reactId.replace(/:/g, '')}`;

  const defaultLeading = findLeading(initialLeading, 1);
  const defaultM = safeShift(initialM, 0);
  const defaultN = safeShift(initialN, 0);

  const [leadingValue, setLeadingValue] = useState(defaultLeading.value);
  const [m, setM] = useState(defaultM);
  const [n, setN] = useState(defaultN);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [guessM, setGuessM] = useState(0);
  const [guessN, setGuessN] = useState(0);
  const [checked, setChecked] = useState(false);
  const [showGhost, setShowGhost] = useState(true);

  const leading = findLeading(leadingValue, 1);
  const puzzle = PUZZLES[puzzleIndex % PUZZLES.length]!;
  const reveal = !challenge || checked;

  /** Целочисленная запись функции: и для конструктора, и для задачи она одна и та же. */
  const scaled = useMemo<ScaledQuadratic>(
    () => (challenge
      ? { a: puzzle.a, b: puzzle.b, c: puzzle.c, scale: 1 }
      : vertexFormToStandard(leading.rational, m, n)),
    [challenge, puzzle, leading, m, n],
  );

  const puzzleShift = useMemo(
    () => (challenge ? integerShift(puzzle.a, puzzle.b, puzzle.c) : null),
    [challenge, puzzle],
  );

  const activeM = challenge ? (puzzleShift?.m ?? 0) : m;
  const activeN = challenge ? (puzzleShift?.n ?? 0) : n;
  const activeLeading = challenge ? integerRational(puzzle.a) : leading.rational;

  const steps = useMemo<readonly TransformStep[]>(
    () => (challenge
      ? transformChain(puzzle.a, puzzle.b, puzzle.c)
      : transformSteps(leading.rational, m, n)),
    [challenge, puzzle, leading, m, n],
  );

  const vertexForm = vertexFormText(activeLeading, integerRational(activeM), integerRational(activeN));
  const standardForm = scaledFunctionText(scaled);
  const correct = challenge && guessM === activeM && guessN === activeN;

  const reset = () => {
    setLeadingValue(defaultLeading.value);
    setM(defaultM);
    setN(defaultN);
    setPuzzleIndex(0);
    setGuessM(0);
    setGuessN(0);
    setChecked(false);
    setShowGhost(true);
  };

  const nextPuzzle = () => {
    setPuzzleIndex((current) => (current + 1) % PUZZLES.length);
    setGuessM(0);
    setGuessN(0);
    setChecked(false);
  };

  const symbol = !reveal ? '?' : challenge ? (correct ? '✓' : '×') : activeLeading.numerator > 0 ? '∪' : '∩';

  const headline = !reveal
    ? 'Куда уехала вершина?'
    : challenge
      ? `${standardForm} — это ${vertexForm}.`
      : `${vertexForm}, то есть ${standardForm}.`;

  const detail = !reveal
    ? 'Выдели полный квадрат или найди вершину по формуле x₀ = −b/(2a). График появится после проверки.'
    : challenge
      ? `Вершина (${num(activeM)}; ${num(activeN)}): эталон сдвинули на ${Math.abs(activeM)} ${activeM >= 0 ? 'вправо' : 'влево'} и на ${Math.abs(activeN)} ${activeN >= 0 ? 'вверх' : 'вниз'}.`
      : `Вершина (${num(activeM)}; ${num(activeN)}), ось симметрии x = ${num(activeM)}. Сдвиги видны прямо в записи: число в скобке отвечает за горизонталь, число за скобкой — за вертикаль.`;

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория преобразований графика</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {challenge
              ? 'Найди вершину, не рисуя график'
              : 'Одна парабола, три ручки управления'}
          </h3>
          <p>
            {challenge
              ? 'Функция задана стандартным видом. Определи, на сколько и куда сдвинут эталон y = x², и только потом проверь себя рисунком.'
              : 'Пунктирная линия — эталон y = x², она никогда не двигается. Меняй a, m и n и следи, что происходит со сплошной линией.'}
          </p>
        </div>
        <span className="dm-lab__badge">y = a(x − m)² + n</span>
      </header>

      <div className="dm-lab__body">
        {!challenge && (
          <>
            <div className="dm-geometry-preset-buttons" role="group" aria-label="Готовые примеры преобразований">
              {PRESETS.map((preset) => {
                const active = preset.leading === leadingValue && preset.m === m && preset.n === n;
                return (
                  <button
                    type="button"
                    key={preset.title}
                    className={`dm-geometry-preset-button ${active ? 'dm-geometry-preset-button--active' : ''}`}
                    aria-pressed={active}
                    onClick={() => {
                      setLeadingValue(preset.leading);
                      setM(preset.m);
                      setN(preset.n);
                    }}
                  >
                    {preset.title}
                  </button>
                );
              })}
            </div>

            <div className="dm-lab__controls dm-signed-controls">
              <div className="dm-field">
                <label htmlFor={`${labId}-a`}>
                  Коэффициент a <span className="dm-field__value">{leading.label}</span>
                </label>
                <select
                  id={`${labId}-a`}
                  value={leadingValue}
                  aria-describedby={`${labId}-a-hint`}
                  onChange={(event) => setLeadingValue(Number(event.target.value))}
                >
                  {LEADING_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
                <small id={`${labId}-a-hint`}>Знак задаёт направление ветвей, модуль — растяжение по вертикали.</small>
              </div>
              <ShiftSelect
                id={`${labId}-m`}
                label="Сдвиг m (по горизонтали)"
                hint={`Целое от −${SHIFT_LIMIT} до ${SHIFT_LIMIT}; в записи стоит внутри скобки со знаком минус.`}
                value={m}
                onChange={setM}
              />
              <ShiftSelect
                id={`${labId}-n`}
                label="Сдвиг n (по вертикали)"
                hint={`Целое от −${SHIFT_LIMIT} до ${SHIFT_LIMIT}; прибавляется после скобки.`}
                value={n}
                onChange={setN}
              />
            </div>
          </>
        )}

        {challenge && (
          <div className="dm-geometry-example-switch">
            <span>Функция № {puzzleIndex + 1} из {PUZZLES.length}</span>
            <button className="dm-button dm-button--secondary" type="button" onClick={nextPuzzle}>
              Следующая функция
            </button>
          </div>
        )}

        <div
          className="dm-algebra-equation"
          role="math"
          aria-label={challenge ? `Функция ${standardForm}` : `Функция ${vertexForm}`}
        >
          <span>{challenge ? standardForm : vertexForm}</span>
          <span aria-hidden="true">→</span>
          <strong>{reveal ? (challenge ? vertexForm : standardForm) : 'вершина (?; ?)'}</strong>
        </div>

        {challenge && (
          <>
            <p className="dm-signed-caption">Моя вершина</p>
            <div className="dm-geometry-answer-grid">
              <ShiftSelect
                id={`${labId}-guess-m`}
                label="Абсцисса вершины m"
                hint="Это же число — сдвиг вдоль оси x."
                value={guessM}
                onChange={(value) => {
                  setGuessM(value);
                  setChecked(false);
                }}
              />
              <ShiftSelect
                id={`${labId}-guess-n`}
                label="Ордината вершины n"
                hint="Это же число — сдвиг вдоль оси y."
                value={guessN}
                onChange={(value) => {
                  setGuessN(value);
                  setChecked(false);
                }}
              />
              <button className="dm-button" type="button" onClick={() => setChecked(true)}>
                Проверить
              </button>
            </div>
          </>
        )}

        {reveal && (
          <>
            <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график параболы" tabIndex={0}>
              <ShiftPlane
                id={`${labId}-plane`}
                scaled={scaled}
                vertexX={activeM}
                vertexY={activeN}
                formula={vertexForm}
                showGhost={showGhost}
              />
            </div>

            <button
              type="button"
              className="dm-button dm-button--secondary"
              aria-pressed={showGhost}
              onClick={() => setShowGhost((current) => !current)}
            >
              {showGhost ? 'Спрятать эталон y = x²' : 'Показать эталон y = x²'}
            </button>

            <ol className="dm-signed-route-list">
              {steps.map((step, index) => (
                <li key={step.formula}>
                  <span aria-hidden="true">{index + 1}</span>
                  <p>
                    <strong>{step.formula}</strong>
                    <small>{step.action}</small>
                  </p>
                </li>
              ))}
            </ol>
          </>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{symbol}</span>
          <p>
            <strong>{challenge && reveal && !correct ? `Пока нет. ${headline}` : headline}</strong>
            <small>{detail}</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>
          ↺ Вернуть пример
        </button>
      </div>
    </section>
  );
}
