import { useEffect, useMemo, useRef, useState, useId } from 'react';
import {
  type QuadraticSolution,
  completeSquare,
  describeRoot,
  evaluateQuadratic,
  formatRational,
  parabolaSegments,
  quadraticKind,
  solveQuadratic,
  vertex,
} from '../lib/quadratics';

export interface QuadRootsLabProps {
  /** Старший коэффициент; ноль запрещён и заменяется единицей. */
  initialA?: number;
  initialB?: number;
  initialC?: number;
  /** Режим задачи: график и корни скрыты, пока не нажата кнопка «Проверить». */
  challenge?: boolean;
}

interface Puzzle {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

const A_LIMIT = 4;
const B_LIMIT = 12;
const C_LIMIT = 24;
const DRAFT_PATTERN = /^[+\-−]?\d*$/;
const MAX_DRAFT_LENGTH = 4;
const SAMPLE_COUNT = 161;
const Y_STEPS = [1, 2, 3, 4, 5, 10, 20, 50, 100] as const;
const Y_DIVISIONS = 6;

const PUZZLES: readonly Puzzle[] = [
  { a: 1, b: -4, c: 3 },
  { a: 1, b: 6, c: 9 },
  { a: 1, b: 2, c: 5 },
  { a: 2, b: -3, c: -2 },
  { a: -1, b: 4, c: -4 },
  { a: 3, b: 1, c: 1 },
];

const ROOT_WORD = ['корней нет', 'ровно один корень', 'два различных корня'] as const;

function clampInteger(value: number, limit: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(limit, Math.max(-limit, Math.trunc(value)));
}

function safeLeading(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  const clamped = clampInteger(value, A_LIMIT);
  return clamped === 0 ? fallback : clamped;
}

function safeCoefficient(value: number | undefined, fallback: number, limit: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clampInteger(value, limit);
}

function parseDraft(rawValue: string): number | null {
  const normalized = rawValue.trim().replace('−', '-');
  if (normalized === '' || normalized === '-' || normalized === '+') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function sign(value: number): string {
  return value < 0 ? '−' : '+';
}

function num(value: number): string {
  return String(value).replace('-', '−');
}

/** Отрицательное число в записи произведения берётся в скобки. */
function paren(value: number): string {
  return value < 0 ? `(${num(value)})` : num(value);
}

/** Запись ax² + bx + c = 0 обычными знаками, без лишних единиц и нулей. */
export function quadraticText(a: number, b: number, c: number): string {
  const head = a === 1 ? 'x²' : a === -1 ? '−x²' : `${num(a)}x²`;
  const middle = b === 0 ? '' : ` ${sign(b)} ${Math.abs(b) === 1 ? '' : Math.abs(b)}x`;
  const tail = c === 0 ? '' : ` ${sign(c)} ${Math.abs(c)}`;
  return `${head}${middle}${tail} = 0`;
}

function niceYExtent(limit: number): { extent: number; step: number } {
  for (const step of Y_STEPS) {
    if (step * Y_DIVISIONS >= limit) return { extent: step * Y_DIVISIONS, step };
  }
  const last = Y_STEPS[Y_STEPS.length - 1]!;
  return { extent: last * Y_DIVISIONS, step: last };
}

interface PlotView {
  xExtent: number;
  yExtent: number;
  yStep: number;
}

/** Окно графика подбирается по вершине, свободному члену и корням — без «подгонки» рисунка. */
function plotWindow(a: number, b: number, c: number, solution: QuadraticSolution): PlotView {
  const top = vertex(a, b, c);
  const vertexX = top.x.numerator / top.x.denominator;
  const vertexY = top.y.numerator / top.y.denominator;
  const xCandidates = [Math.abs(vertexX) + 1.5, 3, ...solution.roots.map((root) => Math.abs(root.approx) + 1.5)];
  const xExtent = Math.min(10, Math.max(3, Math.ceil(Math.max(...xCandidates))));
  const yCandidates = [Math.abs(vertexY), Math.abs(c), 3];
  const { extent, step } = niceYExtent(Math.max(...yCandidates) * 1.15);
  return { xExtent, yExtent: extent, yStep: step };
}

interface IntegerFieldProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  limit: number;
  skipZero?: boolean;
  onChange: (value: number) => void;
}

function IntegerField({ id, label, hint, value, limit, skipZero = false, onChange }: IntegerFieldProps) {
  const [draft, setDraft] = useState(num(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(num(value));
  }, [editing, value]);

  const normalize = (candidate: number, direction: -1 | 1): number => {
    const clamped = clampInteger(candidate, limit);
    if (!skipZero || clamped !== 0) return clamped;
    return direction === 1 ? 1 : -1;
  };

  const commit = () => {
    const parsed = parseDraft(draft);
    const next = parsed === null ? value : normalize(parsed, parsed >= value ? 1 : -1);
    setDraft(num(next));
    onChange(next);
  };

  const nudge = (direction: -1 | 1) => {
    onChange(normalize(value + direction, direction));
  };

  return (
    <div className="dm-field dm-signed-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{num(value)}</span>
      </label>
      <div className="dm-signed-field__control">
        <button
          type="button"
          className="dm-signed-field__step"
          onClick={() => nudge(-1)}
          disabled={value <= -limit}
          aria-label={`Уменьшить ${label} на 1`}
        >
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          maxLength={MAX_DRAFT_LENGTH}
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => {
            cancelCommit.current = false;
            setEditing(true);
          }}
          onChange={(event) => {
            const raw = event.target.value;
            if (DRAFT_PATTERN.test(raw)) setDraft(raw);
          }}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              setDraft(num(value));
              setEditing(false);
              return;
            }
            commit();
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelCommit.current = true;
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          className="dm-signed-field__step"
          onClick={() => nudge(1)}
          disabled={value >= limit}
          aria-label={`Увеличить ${label} на 1`}
        >
          +
        </button>
      </div>
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

interface ParabolaProps {
  id: string;
  a: number;
  b: number;
  c: number;
  solution: QuadraticSolution;
  view: PlotView;
}

function Parabola({ id, a, b, c, solution, view }: ParabolaProps) {
  const centerX = 368;
  const centerY = 250;
  const halfWidth = 300;
  const halfHeight = 214;
  const px = (value: number) => centerX + (value * halfWidth) / view.xExtent;
  const py = (value: number) => centerY - (value * halfHeight) / view.yExtent;

  const top = vertex(a, b, c);
  const vertexX = top.x.numerator / top.x.denominator;
  const vertexY = top.y.numerator / top.y.denominator;
  const vertexVisible = Math.abs(vertexX) <= view.xExtent && Math.abs(vertexY) <= view.yExtent;

  const xTickStep = view.xExtent > 6 ? 2 : 1;
  const xTicks = Array.from({ length: 2 * view.xExtent + 1 }, (_, index) => index - view.xExtent)
    .filter((value) => value % xTickStep === 0);
  const yTicks = Array.from({ length: 2 * Y_DIVISIONS + 1 }, (_, index) => (index - Y_DIVISIONS) * view.yStep);

  const segments = parabolaSegments(
    a,
    b,
    c,
    { xMin: -view.xExtent, xMax: view.xExtent, yMin: -view.yExtent, yMax: view.yExtent },
    SAMPLE_COUNT,
  );

  const rootsText = solution.rootCount === 0
    ? 'парабола не пересекает ось x'
    : `парабола пересекает ось x в точках ${solution.roots.map((root) => describeRoot(root)).join(' и ')}`;

  return (
    <svg className="dm-signed-plane" viewBox="0 0 736 500" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{`График функции y = ${quadraticText(a, b, c).replace(' = 0', '')}`}</title>
      <desc id={`${id}-desc`}>
        {`Ветви направлены ${a > 0 ? 'вверх' : 'вниз'}, вершина в точке (${formatRational(top.x)}; ${formatRational(top.y)}). `}
        {`Дискриминант равен ${num(solution.discriminant)}, поэтому ${rootsText}. `}
        {`Шаг сетки по оси x равен ${xTickStep}, по оси y равен ${view.yStep}.`}
      </desc>
      <defs>
        <marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path className="dm-signed-plane__axis-arrow" d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>

      <rect
        className="dm-signed-plane__background"
        x={centerX - halfWidth}
        y={centerY - halfHeight}
        width={halfWidth * 2}
        height={halfHeight * 2}
        rx="12"
      />

      <g className="dm-signed-plane__grid" aria-hidden="true">
        {xTicks.map((value) => (
          <line key={`vx-${value}`} x1={px(value)} y1={centerY - halfHeight} x2={px(value)} y2={centerY + halfHeight} />
        ))}
        {yTicks.map((value) => (
          <line key={`hy-${value}`} x1={centerX - halfWidth} y1={py(value)} x2={centerX + halfWidth} y2={py(value)} />
        ))}
      </g>

      <line
        className="dm-signed-plane__axis"
        x1={centerX - halfWidth}
        y1={centerY}
        x2={centerX + halfWidth}
        y2={centerY}
        markerEnd={`url(#${id}-arrow)`}
      />
      <line
        className="dm-signed-plane__axis"
        x1={centerX}
        y1={centerY + halfHeight}
        x2={centerX}
        y2={centerY - halfHeight}
        markerEnd={`url(#${id}-arrow)`}
      />

      <g className="dm-signed-plane__labels" aria-hidden="true">
        {xTicks.filter((value) => value !== 0).map((value) => (
          <text key={`lx-${value}`} x={px(value)} y={centerY + 18}>{num(value)}</text>
        ))}
        {yTicks.filter((value) => value !== 0).map((value) => (
          <text key={`ly-${value}`} x={centerX - 18} y={py(value) + 4}>{num(value)}</text>
        ))}
        <text x={centerX + halfWidth - 6} y={centerY - 12}>x</text>
        <text x={centerX + 14} y={centerY - halfHeight + 14}>y</text>
        <text x={centerX - 14} y={centerY + 18}>0</text>
      </g>

      {vertexVisible && (
        <g className="dm-signed-plane__reflection-guides" aria-hidden="true">
          <line x1={px(vertexX)} y1={centerY - halfHeight} x2={px(vertexX)} y2={centerY + halfHeight} />
        </g>
      )}

      <g className="dm-signed-plane__route-segment" aria-hidden="true">
        {segments.map((segment, segmentIndex) => segment.slice(1).map((point, index) => {
          const previous = segment[index]!;
          return (
            <line
              key={`s-${segmentIndex}-${index}`}
              x1={px(previous.x)}
              y1={py(previous.y)}
              x2={px(point.x)}
              y2={py(point.y)}
            />
          );
        }))}
      </g>

      {solution.roots.map((root, index) => Math.abs(root.approx) <= view.xExtent && (
        <g
          className="dm-signed-plane__point dm-signed-plane__point--finish"
          transform={`translate(${px(root.approx)} ${py(0)})`}
          key={`root-${index}`}
          aria-hidden="true"
        >
          <circle r="7" />
          <text x={0} y={index === 0 ? 26 : -14}>{describeRoot(root)}</text>
        </g>
      ))}

      {vertexVisible && (
        <g
          className="dm-signed-plane__point dm-signed-plane__point--waypoint"
          transform={`translate(${px(vertexX)} ${py(vertexY)})`}
          aria-hidden="true"
        >
          <circle r="7" />
          <text x={0} y={a > 0 ? 26 : -14}>({formatRational(top.x)}; {formatRational(top.y)})</text>
        </g>
      )}
    </svg>
  );
}

export default function QuadRootsLab({ initialA, initialB, initialC, challenge = false }: QuadRootsLabProps) {
  const reactId = useId();
  const labId = `quad-roots-${reactId.replace(/:/g, '')}`;

  const defaultA = safeLeading(initialA, 1);
  const defaultB = safeCoefficient(initialB, -5, B_LIMIT);
  const defaultC = safeCoefficient(initialC, 6, C_LIMIT);

  const puzzles = useMemo<readonly Puzzle[]>(() => {
    const head: Puzzle = { a: defaultA, b: defaultB, c: defaultC };
    const rest = PUZZLES.filter((item) => !(item.a === head.a && item.b === head.b && item.c === head.c));
    return [head, ...rest];
  }, [defaultA, defaultB, defaultC]);

  const [a, setA] = useState(defaultA);
  const [b, setB] = useState(defaultB);
  const [c, setC] = useState(defaultC);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [guess, setGuess] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  const puzzle = puzzles[puzzleIndex % puzzles.length]!;
  const activeA = challenge ? puzzle.a : a;
  const activeB = challenge ? puzzle.b : b;
  const activeC = challenge ? puzzle.c : c;
  const reveal = !challenge || checked;

  const solution = useMemo(() => solveQuadratic(activeA, activeB, activeC), [activeA, activeB, activeC]);
  const view = useMemo(() => plotWindow(activeA, activeB, activeC, solution), [activeA, activeB, activeC, solution]);
  const square = useMemo(() => completeSquare(activeA, activeB, activeC), [activeA, activeB, activeC]);
  const kind = quadraticKind(activeA, activeB, activeC);
  const d = solution.discriminant;

  const kindText = kind === 'pure'
    ? 'неполное уравнение вида ax² = 0'
    : kind === 'no-linear'
      ? 'неполное уравнение вида ax² + c = 0'
      : kind === 'no-constant'
        ? 'неполное уравнение вида ax² + bx = 0'
        : 'полное квадратное уравнение';

  const leadingText = activeA === 1 ? '' : activeA === -1 ? '−' : num(activeA);
  const shiftText = square.shift.numerator === 0
    ? 'x²'
    : `(x ${square.shift.numerator < 0 ? '−' : '+'} ${formatRational({
      numerator: Math.abs(square.shift.numerator),
      denominator: square.shift.denominator,
    })})²`;
  const constantText = square.constant.numerator === 0
    ? ''
    : ` ${square.constant.numerator < 0 ? '−' : '+'} ${formatRational({
      numerator: Math.abs(square.constant.numerator),
      denominator: square.constant.denominator,
    })}`;
  const squareText = `${leadingText}${shiftText}${constantText}`;

  const answerCorrect = guess !== null && guess === solution.rootCount;

  const result = !reveal
    ? {
      symbol: '?',
      headline: 'Сколько корней у этого уравнения?',
      detail: 'Посчитай дискриминант в уме или на бумаге и выбери ответ. График появится после проверки.',
    }
    : challenge
      ? {
        symbol: answerCorrect ? '✓' : '×',
        headline: answerCorrect
          ? `Верно: D = ${num(d)}, значит ${ROOT_WORD[solution.rootCount]}.`
          : `Здесь D = ${num(d)}, поэтому ${ROOT_WORD[solution.rootCount]}.`,
        detail: solution.rootCount === 0
          ? 'Парабола целиком лежит по одну сторону от оси x — общих точек с ней нет.'
          : `Корни: ${solution.roots.map((root) => describeRoot(root)).join('; ')}.`,
      }
      : {
        symbol: solution.rootCount === 0 ? '∅' : solution.rootCount === 1 ? '•' : '••',
        headline: `D = ${paren(activeB)}² − 4·${paren(activeA)}·${paren(activeC)} = ${num(d)} — ${ROOT_WORD[solution.rootCount]}.`,
        detail: solution.rootCount === 0
          ? `Вершина параболы лежит ${activeA > 0 ? 'выше' : 'ниже'} оси x, а ветви направлены ${activeA > 0 ? 'вверх' : 'вниз'}: пересечений нет.`
          : `Корни: ${solution.roots.map((root) => describeRoot(root)).join('; ')}. Проверка: значение в корне равно ${num(Math.round(evaluateQuadratic(activeA, activeB, activeC, solution.roots[0]!.approx) * 1e6) / 1e6)}.`,
      };

  const reset = () => {
    setA(defaultA);
    setB(defaultB);
    setC(defaultC);
    setPuzzleIndex(0);
    setGuess(null);
    setChecked(false);
  };

  const nextPuzzle = () => {
    setPuzzleIndex((current) => (current + 1) % puzzles.length);
    setGuess(null);
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория дискриминанта</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {challenge ? 'Предскажи число корней по дискриминанту' : 'Один знак решает, сколько корней'}
          </h3>
          <p>
            {challenge
              ? 'Уравнение задано, график скрыт. Посчитай D сам, выбери ответ и только потом смотри на параболу.'
              : 'Меняй коэффициенты и следи за двумя вещами сразу: за знаком D и за тем, как парабола стоит относительно оси x.'}
          </p>
        </div>
        <span className="dm-lab__badge">D = b² − 4ac</span>
      </header>

      <div className="dm-lab__body">
        {!challenge && (
          <div className="dm-lab__controls dm-signed-controls">
            <IntegerField
              id={`${labId}-a`}
              label="Коэффициент a"
              hint={`Целое от −${A_LIMIT} до ${A_LIMIT}, кроме нуля`}
              value={a}
              limit={A_LIMIT}
              skipZero
              onChange={setA}
            />
            <IntegerField
              id={`${labId}-b`}
              label="Коэффициент b"
              hint={`Целое от −${B_LIMIT} до ${B_LIMIT}`}
              value={b}
              limit={B_LIMIT}
              onChange={setB}
            />
            <IntegerField
              id={`${labId}-c`}
              label="Свободный член c"
              hint={`Целое от −${C_LIMIT} до ${C_LIMIT}`}
              value={c}
              limit={C_LIMIT}
              onChange={setC}
            />
          </div>
        )}

        {challenge && (
          <div className="dm-geometry-example-switch">
            <span>Уравнение № {puzzleIndex + 1} из {puzzles.length}</span>
            <button className="dm-button dm-button--secondary" type="button" onClick={nextPuzzle}>
              Следующее уравнение
            </button>
          </div>
        )}

        <div className="dm-algebra-equation" role="math" aria-label={`Уравнение ${quadraticText(activeA, activeB, activeC)}`}>
          <span>{quadraticText(activeA, activeB, activeC)}</span>
          <span aria-hidden="true">→</span>
          <strong>{reveal ? `D = ${num(d)}` : 'D = ?'}</strong>
        </div>

        {challenge && (
          <div className="dm-geometry-challenge-grid" role="group" aria-label="Сколько корней у уравнения">
            {[0, 1, 2].map((option) => (
              <button
                type="button"
                className={`dm-button ${guess === option ? '' : 'dm-button--secondary'}`}
                aria-pressed={guess === option}
                onClick={() => {
                  setGuess(option);
                  setChecked(false);
                }}
                key={option}
              >
                {option === 0 ? 'Корней нет' : option === 1 ? 'Один корень' : 'Два корня'}
              </button>
            ))}
            <button className="dm-button" type="button" disabled={guess === null} onClick={() => setChecked(true)}>
              Проверить
            </button>
          </div>
        )}

        {reveal && (
          <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график параболы" tabIndex={0}>
            <Parabola
              id={`${labId}-plane`}
              a={activeA}
              b={activeB}
              c={activeC}
              solution={solution}
              view={view}
            />
          </div>
        )}

        {reveal && (
          <ol className="dm-signed-steps">
            <li>
              <span aria-hidden="true">1</span>
              <p>
                <strong>{kindText}</strong>
                <small>a = {num(activeA)}, b = {num(activeB)}, c = {num(activeC)}</small>
              </p>
            </li>
            <li>
              <span aria-hidden="true">2</span>
              <p>
                <strong>Полный квадрат: {squareText}</strong>
                <small>Вершина параболы: ({formatRational(vertex(activeA, activeB, activeC).x)}; {formatRational(vertex(activeA, activeB, activeC).y)})</small>
              </p>
            </li>
            <li>
              <span aria-hidden="true">3</span>
              <p>
                <strong>{d > 0 ? 'D > 0' : d === 0 ? 'D = 0' : 'D < 0'} → {ROOT_WORD[solution.rootCount]}</strong>
                <small>{solution.isPerfectSquareDiscriminant ? 'D — точный квадрат, корни рациональные' : d < 0 ? 'из отрицательного числа квадратный корень не извлекается' : 'D не является точным квадратом, корни иррациональные'}</small>
              </p>
            </li>
          </ol>
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
