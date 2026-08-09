import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { describeRoot, parabolaSegments, type QuadraticSolution } from '../lib/quadratics';
import {
  QUAD_RELATIONS,
  describeParabola,
  inequalityText,
  pieceBounds,
  quadRelationText,
  rationalValue,
  shapeTitle,
  solveQuadraticInequality,
  standardFormText,
  valueTable,
  type ParabolaFacts,
  type QuadRelation,
  type QuadraticInequalitySolution,
  type SolutionShape,
} from '../lib/parabola';

export type ParabLabMode = 'graph' | 'inequality';

export interface ParabLabProps {
  /** «graph» — свойства функции по графику, «inequality» — квадратное неравенство. */
  mode?: ParabLabMode;
  /** Старший коэффициент; ноль запрещён и заменяется единицей. */
  initialA?: number;
  initialB?: number;
  initialC?: number;
  /** Знак неравенства для режима «inequality». */
  initialRelation?: QuadRelation;
  /** Режим задачи: график и ответ скрыты, пока не нажата кнопка «Проверить». */
  challenge?: boolean;
}

interface Puzzle {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly relation: QuadRelation;
}

const A_LIMIT = 4;
const B_LIMIT = 12;
const C_LIMIT = 24;
const DRAFT_PATTERN = /^[+\-−]?\d*$/;
const MAX_DRAFT_LENGTH = 4;
const SAMPLE_COUNT = 181;
const Y_STEPS = [1, 2, 3, 4, 5, 10, 20, 50, 100] as const;
const Y_DIVISIONS = 6;

const SHAPE_ORDER: readonly SolutionShape[] = [
  'between',
  'outside',
  'all',
  'empty',
  'point',
  'all-except-point',
];

/** Задачи покрывают все шесть форм ответа: D > 0, D = 0 и D < 0 при обоих знаках a. */
const PUZZLES: readonly Puzzle[] = [
  { a: 1, b: -5, c: 6, relation: 'gt' },
  { a: 1, b: -1, c: -6, relation: 'le' },
  { a: 1, b: -6, c: 9, relation: 'gt' },
  { a: -1, b: 2, c: -1, relation: 'ge' },
  { a: 1, b: 2, c: 5, relation: 'gt' },
  { a: -1, b: 1, c: -3, relation: 'ge' },
];

const RELATION_TITLE: Readonly<Record<QuadRelation, string>> = {
  lt: 'меньше нуля',
  le: 'меньше или равно нулю',
  gt: 'больше нуля',
  ge: 'больше или равно нулю',
};

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

function safeRelation(value: QuadRelation | undefined, fallback: QuadRelation): QuadRelation {
  return value !== undefined && QUAD_RELATIONS.includes(value) ? value : fallback;
}

function parseDraft(rawValue: string): number | null {
  const normalized = rawValue.trim().replace('−', '-');
  if (normalized === '' || normalized === '-' || normalized === '+') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function num(value: number): string {
  return String(Math.round(value * 1000) / 1000).replace('-', '−').replace('.', ',');
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

/** Окно подбирается по вершине, свободному члену и нулям — рисунок не «подгоняется». */
function plotWindow(facts: ParabolaFacts): PlotView {
  const vertexX = rationalValue(facts.vertex.x);
  const vertexY = rationalValue(facts.vertex.y);
  const xCandidates = [
    Math.abs(vertexX) + 2,
    4,
    ...facts.roots.map((root) => Math.abs(root.approx) + 2),
  ];
  const xExtent = Math.min(10, Math.max(4, Math.ceil(Math.max(...xCandidates))));
  const yCandidates = [Math.abs(vertexY), Math.abs(facts.yIntercept), 4];
  const { extent, step } = niceYExtent(Math.max(...yCandidates) * 1.2);
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

  return (
    <div className="dm-field dm-signed-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{num(value)}</span>
      </label>
      <div className="dm-signed-field__control">
        <button
          type="button"
          className="dm-signed-field__step"
          onClick={() => onChange(normalize(value - 1, -1))}
          disabled={value <= -limit}
          aria-label={`Уменьшить «${label}» на 1`}
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
          onClick={() => onChange(normalize(value + 1, 1))}
          disabled={value >= limit}
          aria-label={`Увеличить «${label}» на 1`}
        >
          +
        </button>
      </div>
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

interface PlaneProps {
  id: string;
  mode: ParabLabMode;
  facts: ParabolaFacts;
  view: PlotView;
  inequality: QuadraticInequalitySolution | null;
}

function Plane({ id, mode, facts, view, inequality }: PlaneProps) {
  const centerX = 368;
  const centerY = 250;
  const halfWidth = 300;
  const halfHeight = 214;
  const px = (value: number) => centerX + (value * halfWidth) / view.xExtent;
  const py = (value: number) => centerY - (value * halfHeight) / view.yExtent;

  const vertexX = rationalValue(facts.vertex.x);
  const vertexY = rationalValue(facts.vertex.y);
  const vertexVisible = Math.abs(vertexX) <= view.xExtent && Math.abs(vertexY) <= view.yExtent;
  const interceptVisible = Math.abs(facts.yIntercept) <= view.yExtent;

  const xTickStep = view.xExtent > 6 ? 2 : 1;
  const xTicks = Array.from({ length: 2 * view.xExtent + 1 }, (_, index) => index - view.xExtent)
    .filter((value) => value % xTickStep === 0);
  const yTicks = Array.from({ length: 2 * Y_DIVISIONS + 1 }, (_, index) => (index - Y_DIVISIONS) * view.yStep);

  const segments = parabolaSegments(
    facts.a,
    facts.b,
    facts.c,
    { xMin: -view.xExtent, xMax: view.xExtent, yMin: -view.yExtent, yMax: view.yExtent },
    SAMPLE_COUNT,
  );

  const solutionBars = inequality === null
    ? []
    : inequality.pieces
        .map((item) => {
          const bounds = pieceBounds(item);
          return {
            from: Math.max(bounds.from, -view.xExtent),
            to: Math.min(bounds.to, view.xExtent),
            openLeft: Number.isFinite(bounds.from) ? bounds.from : null,
            openRight: Number.isFinite(bounds.to) ? bounds.to : null,
            leftClosed: item.leftClosed,
            rightClosed: item.rightClosed,
          };
        })
        .filter((bar) => bar.to >= bar.from);

  const description = mode === 'inequality' && inequality !== null
    ? `Ветви направлены ${facts.direction === 'up' ? 'вверх' : 'вниз'}. ${facts.zerosText}. `
      + `Жирным на оси x отмечено множество решений: ${inequality.setText}.`
    : `Ветви направлены ${facts.direction === 'up' ? 'вверх' : 'вниз'}, вершина в точке (${num(vertexX)}; ${num(vertexY)}), `
      + `ось симметрии — прямая ${facts.axisText}. ${facts.zerosText}. График пересекает ось y в точке (0; ${num(facts.yIntercept)}). `
      + `Шаг сетки по оси x равен ${xTickStep}, по оси y равен ${view.yStep}.`;

  return (
    <svg className="dm-signed-plane" viewBox="0 0 736 500" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{`График функции ${standardFormText(facts.a, facts.b, facts.c)}`}</title>
      <desc id={`${id}-desc`}>{description}</desc>
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

      {mode === 'graph' && Math.abs(vertexX) <= view.xExtent && (
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

      {solutionBars.map((bar, index) => (
        <g className="dm-signed-number-line__distance" key={`bar-${index}`} aria-hidden="true">
          <line x1={px(bar.from)} y1={centerY} x2={px(bar.to)} y2={centerY} />
          {bar.openLeft === null && (
            <>
              <line x1={px(bar.from)} y1={centerY} x2={px(bar.from) + 14} y2={centerY - 8} />
              <line x1={px(bar.from)} y1={centerY} x2={px(bar.from) + 14} y2={centerY + 8} />
            </>
          )}
          {bar.openRight === null && (
            <>
              <line x1={px(bar.to)} y1={centerY} x2={px(bar.to) - 14} y2={centerY - 8} />
              <line x1={px(bar.to)} y1={centerY} x2={px(bar.to) - 14} y2={centerY + 8} />
            </>
          )}
        </g>
      ))}

      {facts.roots.map((root, index) => Math.abs(root.approx) <= view.xExtent && (
        <g
          className="dm-signed-plane__point dm-signed-plane__point--finish"
          transform={`translate(${px(root.approx)} ${centerY})`}
          key={`root-${index}`}
          aria-hidden="true"
        >
          <circle r="7" />
          {inequality !== null && !inequality.pieces.some((item) => (
            (item.leftClosed && item.left === root) || (item.rightClosed && item.right === root)
          )) && <circle className="dm-signed-plane__background" r="3.5" />}
          <text x={0} y={index === 0 ? 30 : -16}>{describeRoot(root)}</text>
        </g>
      ))}

      {mode === 'graph' && interceptVisible && (
        <g
          className="dm-signed-plane__point dm-signed-plane__point--a"
          transform={`translate(${px(0)} ${py(facts.yIntercept)})`}
          aria-hidden="true"
        >
          <circle r="6" />
          <text x={22} y={5}>(0; {num(facts.yIntercept)})</text>
        </g>
      )}

      {vertexVisible && (
        <g
          className="dm-signed-plane__point dm-signed-plane__point--waypoint"
          transform={`translate(${px(vertexX)} ${py(vertexY)})`}
          aria-hidden="true"
        >
          <circle r="7" />
          <text x={0} y={facts.direction === 'up' ? 28 : -16}>({num(vertexX)}; {num(vertexY)})</text>
        </g>
      )}
    </svg>
  );
}

export default function ParabLab({
  mode = 'graph',
  initialA,
  initialB,
  initialC,
  initialRelation,
  challenge = false,
}: ParabLabProps) {
  const reactId = useId();
  const labId = `parab-${reactId.replace(/:/g, '')}`;
  const isInequality = mode === 'inequality';
  const puzzleMode = isInequality && challenge;

  const defaultA = safeLeading(initialA, 1);
  const defaultB = safeCoefficient(initialB, -4, B_LIMIT);
  const defaultC = safeCoefficient(initialC, 3, C_LIMIT);
  const defaultRelation = safeRelation(initialRelation, 'gt');

  const [a, setA] = useState(defaultA);
  const [b, setB] = useState(defaultB);
  const [c, setC] = useState(defaultC);
  const [relation, setRelation] = useState<QuadRelation>(defaultRelation);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [guess, setGuess] = useState<SolutionShape | null>(null);
  const [checked, setChecked] = useState(false);

  const puzzle = PUZZLES[puzzleIndex % PUZZLES.length]!;
  const activeA = puzzleMode ? puzzle.a : a;
  const activeB = puzzleMode ? puzzle.b : b;
  const activeC = puzzleMode ? puzzle.c : c;
  const activeRelation = puzzleMode ? puzzle.relation : relation;
  const reveal = !puzzleMode || checked;

  const facts = useMemo(() => describeParabola(activeA, activeB, activeC), [activeA, activeB, activeC]);
  const view = useMemo(() => plotWindow(facts), [facts]);
  const inequality = useMemo(
    () => (isInequality ? solveQuadraticInequality(activeA, activeB, activeC, activeRelation) : null),
    [isInequality, activeA, activeB, activeC, activeRelation],
  );

  const axisValue = rationalValue(facts.vertex.x);
  const tableXs = useMemo(
    () => [-2, -1, 0, 1, 2].map((shift) => Math.round((axisValue + shift) * 1000) / 1000),
    [axisValue],
  );
  const table = useMemo(
    () => valueTable(activeA, activeB, activeC, tableXs),
    [activeA, activeB, activeC, tableXs],
  );

  const answerCorrect = guess !== null && inequality !== null && guess === inequality.shape;

  const reset = () => {
    setA(defaultA);
    setB(defaultB);
    setC(defaultC);
    setRelation(defaultRelation);
    setPuzzleIndex(0);
    setGuess(null);
    setChecked(false);
  };

  const nextPuzzle = () => {
    setPuzzleIndex((current) => (current + 1) % PUZZLES.length);
    setGuess(null);
    setChecked(false);
  };

  const headline = !reveal
    ? 'Какой формы будет ответ?'
    : isInequality && inequality !== null
      ? `Ответ: ${inequality.conditionText}.`
      : `${standardFormText(activeA, activeB, activeC)}: вершина (${num(axisValue)}; ${num(rationalValue(facts.vertex.y))}), ось симметрии ${facts.axisText}.`;

  const detail = !reveal
    ? 'Найди нули трёхчлена, представь параболу и выбери форму множества решений. График появится после проверки.'
    : isInequality && inequality !== null
      ? `${inequality.setText}. Форма ответа — ${shapeTitle(inequality.shape)}; D = ${num(inequality.discriminant)}.`
      : `Ветви направлены ${facts.direction === 'up' ? 'вверх' : 'вниз'}, поэтому в вершине достигается ${facts.extremum === 'min' ? 'наименьшее' : 'наибольшее'} значение. Область значений: ${facts.rangeText}.`;

  const symbol = !reveal
    ? '?'
    : puzzleMode
      ? (answerCorrect ? '✓' : '×')
      : isInequality
        ? quadRelationText(activeRelation)
        : facts.direction === 'up' ? '∪' : '∩';

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">
            {isInequality ? 'Лаборатория квадратных неравенств' : 'Лаборатория квадратичной функции'}
          </p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {puzzleMode
              ? 'Предскажи форму ответа, потом посмотри на параболу'
              : isInequality
                ? 'Ответ неравенства читается по расположению параболы'
                : 'Три коэффициента задают одну параболу'}
          </h3>
          <p>
            {puzzleMode
              ? 'Неравенство задано, график скрыт. Реши его в уме или на бумаге, выбери форму ответа и только потом проверь себя.'
              : isInequality
                ? 'Меняй коэффициенты и знак неравенства. Жирная линия на оси x — это множество решений.'
                : 'Меняй a, b и c и следи сразу за тремя вещами: направлением ветвей, положением вершины и числом точек пересечения с осью x.'}
          </p>
        </div>
        <span className="dm-lab__badge">
          {isInequality ? 'ax² + bx + c ⋛ 0' : 'y = ax² + bx + c'}
        </span>
      </header>

      <div className="dm-lab__body">
        {!puzzleMode && (
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

        {isInequality && !puzzleMode && (
          <div className="dm-geometry-preset-buttons" role="group" aria-label="Знак неравенства">
            {QUAD_RELATIONS.map((item) => (
              <button
                type="button"
                className={`dm-geometry-preset-button ${relation === item ? 'dm-geometry-preset-button--active' : ''}`}
                aria-pressed={relation === item}
                onClick={() => setRelation(item)}
                key={item}
              >
                {quadRelationText(item)} 0 <span className="dm-chip">{RELATION_TITLE[item]}</span>
              </button>
            ))}
          </div>
        )}

        {puzzleMode && (
          <div className="dm-geometry-example-switch">
            <span>Неравенство № {puzzleIndex + 1} из {PUZZLES.length}</span>
            <button className="dm-button dm-button--secondary" type="button" onClick={nextPuzzle}>
              Следующее неравенство
            </button>
          </div>
        )}

        <div
          className="dm-algebra-equation"
          role="math"
          aria-label={isInequality
            ? `Неравенство ${inequalityText(activeA, activeB, activeC, activeRelation)}`
            : `Функция ${standardFormText(activeA, activeB, activeC)}`}
        >
          <span>
            {isInequality
              ? inequalityText(activeA, activeB, activeC, activeRelation)
              : standardFormText(activeA, activeB, activeC)}
          </span>
          <span aria-hidden="true">→</span>
          <strong>{reveal ? `D = ${num(facts.discriminant)}` : 'D = ?'}</strong>
        </div>

        {puzzleMode && (
          <div className="dm-geometry-challenge-grid" role="group" aria-label="Форма множества решений">
            {SHAPE_ORDER.map((option) => (
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
                {shapeTitle(option)}
              </button>
            ))}
            <button className="dm-button" type="button" disabled={guess === null} onClick={() => setChecked(true)}>
              Проверить
            </button>
          </div>
        )}

        {reveal && (
          <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график параболы" tabIndex={0}>
            <Plane
              id={`${labId}-plane`}
              mode={mode}
              facts={facts}
              view={view}
              inequality={inequality}
            />
          </div>
        )}

        {reveal && !isInequality && (
          <div className="dm-algebra-table-wrap">
            <table className="dm-algebra-table">
              <caption>Значения в точках, симметричных относительно оси {facts.axisText}</caption>
              <thead>
                <tr>
                  <th scope="col">x</th>
                  {table.map((row) => (
                    <th scope="col" key={`x-${row.x}`}>{num(row.x)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">y</th>
                  {table.map((row) => (
                    <td key={`y-${row.x}`}>{num(row.y)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {reveal && !isInequality && (
          <ol className="dm-signed-route-list">
            <li>
              <span aria-hidden="true">1</span>
              <p>
                <strong>Ветви направлены {facts.direction === 'up' ? 'вверх' : 'вниз'}</strong>
                <small>Знак старшего коэффициента: a = {num(activeA)}. В вершине достигается {facts.extremum === 'min' ? 'наименьшее' : 'наибольшее'} значение.</small>
              </p>
            </li>
            <li>
              <span aria-hidden="true">2</span>
              <p>
                <strong>Вершина ({num(axisValue)}; {num(rationalValue(facts.vertex.y))}), ось симметрии {facts.axisText}</strong>
                <small>x₀ = −b/(2a) = −({num(activeB)}) / (2·{num(activeA)}); y₀ = −D/(4a).</small>
              </p>
            </li>
            <li>
              <span aria-hidden="true">3</span>
              <p>
                <strong>{facts.zerosText}</strong>
                <small>D = {num(facts.discriminant)}; график пересекает ось y в точке (0; {num(facts.yIntercept)}).</small>
              </p>
            </li>
            <li>
              <span aria-hidden="true">4</span>
              <p>
                <strong>Убывает на {facts.monotonicity.decreasing}, возрастает на {facts.monotonicity.increasing}</strong>
                <small>Область значений: {facts.rangeText}. Выше оси x: {facts.positiveText}. Ниже оси x: {facts.negativeText}.</small>
              </p>
            </li>
          </ol>
        )}

        {reveal && isInequality && inequality !== null && (
          <ol className="dm-signed-route-list">
            <li>
              <span aria-hidden="true">1</span>
              <p>
                <strong>Нули трёхчлена</strong>
                <small>
                  D = {num(inequality.discriminant)}. {inequality.rootCount === 0
                    ? 'Нулей нет: парабола целиком лежит по одну сторону от оси x.'
                    : `Корни: ${inequality.roots.map((root) => describeRoot(root)).join('; ')}.`}
                </small>
              </p>
            </li>
            <li>
              <span aria-hidden="true">2</span>
              <p>
                <strong>Ветви {facts.direction === 'up' ? 'вверх' : 'вниз'} — знак трёхчлена вне корней совпадает со знаком a</strong>
                <small>Выше оси x: {facts.positiveText}. Ниже оси x: {facts.negativeText}.</small>
              </p>
            </li>
            <li>
              <span aria-hidden="true">3</span>
              <p>
                <strong>{shapeTitle(inequality.shape)}: {inequality.setText}</strong>
                <small>
                  Знак {quadRelationText(activeRelation)} {inequality.relation === 'le' || inequality.relation === 'ge'
                    ? 'нестрогий, поэтому корни входят в ответ.'
                    : 'строгий, поэтому корни в ответ не входят.'}
                </small>
              </p>
            </li>
          </ol>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{symbol}</span>
          <p>
            <strong>{puzzleMode && reveal && !answerCorrect ? `Пока нет. ${headline}` : headline}</strong>
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
