import { useEffect, useId, useRef, useState } from 'react';
import {
  solveByAsa,
  solveBySas,
  solveBySss,
  solvedTriangleVertices,
  type SolvedTriangle,
} from '../lib/triangles';
import { fitPointsToBox, projectPoint, type ScreenPoint } from '../lib/similarity';

export type TriSolveMode = 'sss' | 'sas' | 'asa';

export interface TriSolveLabProps {
  mode?: TriSolveMode;
  /** Сторона a — она лежит против угла A и в режиме «три стороны» задаётся вручную. */
  initialSideA?: number;
  /** Сторона b = AC. */
  initialSideB?: number;
  /** Сторона c = AB. */
  initialSideC?: number;
  /** Угол A при вершине A, градусы. */
  initialAngleA?: number;
  /** Угол B при вершине B, градусы. */
  initialAngleB?: number;
  unit?: string;
  challenge?: boolean;
}

const MODES: readonly TriSolveMode[] = ['sss', 'sas', 'asa'];
const MODE_LABELS: Readonly<Record<TriSolveMode, string>> = {
  sss: 'Три стороны',
  sas: 'Две стороны и угол между ними',
  asa: 'Сторона и два угла',
};
const MODE_TOOLS: Readonly<Record<TriSolveMode, string>> = {
  sss: 'Работает теорема косинусов в обратную сторону: косинус угла собирается из трёх квадратов.',
  sas: 'Сначала теорема косинусов даёт третью сторону, затем находятся оставшиеся углы.',
  asa: 'Третий угол — по сумме углов, две стороны — по теореме синусов.',
};

const MIN_SIDE = 3;
const MAX_SIDE = 15;
const MIN_ANGLE = 15;
const MAX_ANGLE = 150;
const MAX_ANGLE_SUM = 165;

const WIDTH = 720;
const HEIGHT = 430;
const PADDING = 80;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(Math.round(value), min, max) : fallback;
}

/** Округление до сотых с русской запятой: длины и углы на чертеже читает человек. */
function formatNumber(value: number, digits = 2): string {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  const text = rounded.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
  return (text === '' || text === '-' ? '0' : text).replace('.', ',');
}

function unitVector(from: ScreenPoint, to: ScreenPoint): ScreenPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function polyline(points: readonly ScreenPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

interface ArcDrawing {
  readonly path: string;
  readonly label: ScreenPoint;
}

/** Дуга угла при вершине; подпись ставится на биссектрисе, снаружи дуги. */
function angleArc(vertex: ScreenPoint, first: ScreenPoint, second: ScreenPoint, measure: number): ArcDrawing {
  const radius = measure < 35 ? 52 : measure < 75 ? 40 : 30;
  const left = unitVector(vertex, first);
  const right = unitVector(vertex, second);
  const start = { x: vertex.x + left.x * radius, y: vertex.y + left.y * radius };
  const end = { x: vertex.x + right.x * radius, y: vertex.y + right.y * radius };
  const cross = left.x * right.y - left.y * right.x;
  const bisector = unitVector({ x: 0, y: 0 }, { x: left.x + right.x, y: left.y + right.y });
  const distance = radius + 22;
  return {
    path: `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${cross > 0 ? 1 : 0} ${end.x} ${end.y}`,
    label: { x: vertex.x + bisector.x * distance, y: vertex.y + bisector.y * distance + 6 },
  };
}

/** Подпись стороны выносится наружу — в сторону, противоположную третьей вершине. */
function sideLabel(first: ScreenPoint, second: ScreenPoint, opposite: ScreenPoint, distance = 26): ScreenPoint {
  const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  const outward = unitVector(opposite, middle);
  return { x: middle.x + outward.x * distance, y: middle.y + outward.y * distance + 5 };
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

interface TrianglePictureProps {
  readonly id: string;
  readonly solved: SolvedTriangle;
  readonly hidden: 'none' | 'sideA' | 'angleA';
  readonly unit: string;
}

function TrianglePicture({ id, solved, hidden, unit }: TrianglePictureProps) {
  const vertices = solvedTriangleVertices(solved);
  const fit = fitPointsToBox([vertices.a, vertices.b, vertices.c], WIDTH, HEIGHT, PADDING);
  const a = projectPoint(vertices.a, fit);
  const b = projectPoint(vertices.b, fit);
  const c = projectPoint(vertices.c, fit);
  const [sideA, sideB, sideC] = solved.sides;
  const [angleA, angleB, angleC] = solved.angles;
  const arcA = angleArc(a, b, c, angleA);
  const arcB = angleArc(b, c, a, angleB);
  const arcC = angleArc(c, a, b, angleC);

  return (
    <svg className="dm-geometry-polygon" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Треугольник ABC, построенный по заданным данным</title>
      <desc id={`${id}-desc`}>
        Стороны треугольника: BC равна {hidden === 'sideA' ? 'искомой величине' : `${formatNumber(sideA)} ${unit}`},
        CA равна {formatNumber(sideB)} {unit}, AB равна {formatNumber(sideC)} {unit}.
        Углы: при вершине A {hidden === 'angleA' ? 'искомый' : `${formatNumber(angleA)} градусов`},
        при вершине B {formatNumber(angleB)} градусов, при вершине C {formatNumber(angleC)} градусов.
        Чертёж выполнен в едином масштабе, поэтому отношения сторон и величины углов на картинке настоящие.
      </desc>
      <polygon className="dm-geometry-polygon__shape" points={polyline([a, b, c])} />
      <path className="dm-geometry-angle__arc" d={arcA.path} />
      <path className="dm-geometry-angle__arc" d={arcB.path} />
      <path className="dm-geometry-angle__arc" d={arcC.path} />
      <g className="dm-geometry-figure__dimensions" aria-hidden="true">
        <text {...sideLabel(b, c, a)}>{hidden === 'sideA' ? 'a = ?' : `a = ${formatNumber(sideA)}`}</text>
        <text {...sideLabel(a, c, b)}>{`b = ${formatNumber(sideB)}`}</text>
        <text {...sideLabel(a, b, c)}>{`c = ${formatNumber(sideC)}`}</text>
      </g>
      <g aria-hidden="true">
        <text className="dm-geometry-angle__value" x={arcA.label.x} y={arcA.label.y} textAnchor="middle">
          {hidden === 'angleA' ? '?' : `${formatNumber(angleA, 1)}°`}
        </text>
        <text className="dm-geometry-angle__value" x={arcB.label.x} y={arcB.label.y} textAnchor="middle">{formatNumber(angleB, 1)}°</text>
        <text className="dm-geometry-angle__value" x={arcC.label.x} y={arcC.label.y} textAnchor="middle">{formatNumber(angleC, 1)}°</text>
      </g>
      <g className="dm-geometry-polygon__vertex" aria-hidden="true">
        <circle cx={a.x} cy={a.y} r="7" /><text x={a.x - 26} y={a.y + 24}>A</text>
        <circle cx={b.x} cy={b.y} r="7" /><text x={b.x + 12} y={b.y + 24}>B</text>
        <circle cx={c.x} cy={c.y} r="7" /><text x={c.x - 8} y={c.y - 16}>C</text>
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

const SHAPE_LABELS: Readonly<Record<SolvedTriangle['shape'], string>> = {
  acute: 'остроугольный',
  right: 'прямоугольный',
  obtuse: 'тупоугольный',
};

export default function TriSolveLab({
  mode,
  initialSideA,
  initialSideB,
  initialSideC,
  initialAngleA,
  initialAngleB,
  unit = 'см',
  challenge = false,
}: TriSolveLabProps) {
  const reactId = useId();
  const labId = `tri-solve-${reactId.replace(/:/g, '')}`;
  const defaultMode: TriSolveMode = mode !== undefined && MODES.includes(mode) ? mode : 'sas';
  const defaultSideA = safeInteger(initialSideA, 7, MIN_SIDE, MAX_SIDE);
  const defaultSideB = safeInteger(initialSideB, 5, MIN_SIDE, MAX_SIDE);
  const defaultSideC = safeInteger(initialSideC, 8, MIN_SIDE, MAX_SIDE);
  const defaultAngleA = safeInteger(initialAngleA, 60, MIN_ANGLE, MAX_ANGLE);
  const defaultAngleB = safeInteger(initialAngleB, 45, MIN_ANGLE, MAX_ANGLE);

  const [activeMode, setActiveMode] = useState(defaultMode);
  const [sideA, setSideA] = useState(defaultSideA);
  const [sideB, setSideB] = useState(defaultSideB);
  const [sideC, setSideC] = useState(defaultSideC);
  const [angleA, setAngleA] = useState(defaultAngleA);
  const [angleB, setAngleB] = useState(defaultAngleB);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const safeAngleB = clamp(angleB, MIN_ANGLE, Math.max(MIN_ANGLE, MAX_ANGLE_SUM - angleA));

  let solved: SolvedTriangle | null = null;
  let failure: string | null = null;
  try {
    if (activeMode === 'sss') solved = solveBySss(sideA, sideB, sideC);
    else if (activeMode === 'sas') solved = solveBySas(sideB, angleA, sideC);
    else solved = solveByAsa(angleA, sideC, safeAngleB);
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Такой треугольник построить нельзя';
  }

  const target = activeMode === 'sss' ? 'angleA' : 'sideA';
  const targetValue = solved === null ? 0 : target === 'angleA' ? solved.angles[0] : solved.sides[0];
  const tolerance = target === 'angleA' ? 0.5 : 0.05;
  const activeChallenge = challenge && solved !== null;
  const reveal = !activeChallenge || checked;
  const answerValue = parseAnswer(answer);
  const answerCorrect = answerValue !== null && Math.abs(answerValue - targetValue) <= tolerance;

  const reset = () => {
    setActiveMode(defaultMode);
    setSideA(defaultSideA);
    setSideB(defaultSideB);
    setSideC(defaultSideC);
    setAngleA(defaultAngleA);
    setAngleB(defaultAngleB);
    setAnswer('');
    setChecked(false);
  };

  const changeAngleA = (value: number) => {
    const next = clamp(value, MIN_ANGLE, MAX_ANGLE);
    setAngleA(next);
    setAngleB((current) => clamp(current, MIN_ANGLE, Math.max(MIN_ANGLE, MAX_ANGLE_SUM - next)));
    setChecked(false);
  };

  const result = (() => {
    if (solved === null) {
      return {
        symbol: '×',
        headline: 'Треугольника с такими данными не существует.',
        detail: failure ?? 'Проверь неравенство треугольника: каждая сторона должна быть меньше суммы двух других.',
      };
    }
    const [a, b, c] = solved.sides;
    const [alpha, beta, gamma] = solved.angles;
    if (activeChallenge && !checked) {
      return {
        symbol: '?',
        headline: target === 'angleA'
          ? `Стороны ${formatNumber(a)}, ${formatNumber(b)} и ${formatNumber(c)} ${unit}. Найди угол A.`
          : `Найди сторону a, лежащую против угла A.`,
        detail: MODE_TOOLS[activeMode],
      };
    }
    const measured = `Стороны: a = ${formatNumber(a)}, b = ${formatNumber(b)}, c = ${formatNumber(c)} ${unit}. `
      + `Углы: A = ${formatNumber(alpha, 1)}°, B = ${formatNumber(beta, 1)}°, C = ${formatNumber(gamma, 1)}°. `
      + `Площадь ${formatNumber(solved.area)} ${unit}², радиус описанной окружности ${formatNumber(solved.circumradius)} ${unit}.`;
    if (activeChallenge) {
      return {
        symbol: answerCorrect ? '✓' : '×',
        headline: answerCorrect
          ? 'Верно.'
          : target === 'angleA'
            ? `Пока нет: A = ${formatNumber(alpha, 1)}°.`
            : `Пока нет: a = ${formatNumber(a)} ${unit}.`,
        detail: measured,
      };
    }
    return {
      symbol: '△',
      headline: `Треугольник ${SHAPE_LABELS[solved.shape]}: наибольший угол равен ${formatNumber(Math.max(alpha, beta, gamma), 1)}°.`,
      detail: measured,
    };
  })();

  return (
    <section className="dm-lab dm-geometry-angle-shape not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория решения треугольников</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Достроить треугольник по трём числам</h3>
          <p>Чертёж строится из данных, а не рисуется на глаз: длины и углы на картинке настоящие. Меняй набор данных и следи, какая теорема нужна первой.</p>
        </div>
        <span className="dm-lab__badge">{activeChallenge ? 'задача' : 'исследование'}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Какой набор данных известен">
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
          {activeMode === 'sss' && (
            <NumberField
              id={`${labId}-side-a`}
              label="Сторона a = BC"
              value={sideA}
              min={MIN_SIDE}
              max={MAX_SIDE}
              step={1}
              suffix={` ${unit}`}
              hint={`От ${MIN_SIDE} до ${MAX_SIDE} ${unit}`}
              onChange={(value) => { setSideA(clamp(value, MIN_SIDE, MAX_SIDE)); setChecked(false); }}
            />
          )}
          {activeMode !== 'asa' && (
            <NumberField
              id={`${labId}-side-b`}
              label="Сторона b = AC"
              value={sideB}
              min={MIN_SIDE}
              max={MAX_SIDE}
              step={1}
              suffix={` ${unit}`}
              hint={`От ${MIN_SIDE} до ${MAX_SIDE} ${unit}`}
              onChange={(value) => { setSideB(clamp(value, MIN_SIDE, MAX_SIDE)); setChecked(false); }}
            />
          )}
          <NumberField
            id={`${labId}-side-c`}
            label="Сторона c = AB"
            value={sideC}
            min={MIN_SIDE}
            max={MAX_SIDE}
            step={1}
            suffix={` ${unit}`}
            hint={`От ${MIN_SIDE} до ${MAX_SIDE} ${unit}`}
            onChange={(value) => { setSideC(clamp(value, MIN_SIDE, MAX_SIDE)); setChecked(false); }}
          />
          {activeMode !== 'sss' && (
            <NumberField
              id={`${labId}-angle-a`}
              label="Угол A"
              value={angleA}
              min={MIN_ANGLE}
              max={MAX_ANGLE}
              step={5}
              suffix="°"
              hint={`От ${MIN_ANGLE}° до ${MAX_ANGLE}°`}
              onChange={changeAngleA}
            />
          )}
          {activeMode === 'asa' && (
            <NumberField
              id={`${labId}-angle-b`}
              label="Угол B"
              value={safeAngleB}
              min={MIN_ANGLE}
              max={Math.max(MIN_ANGLE, MAX_ANGLE_SUM - angleA)}
              step={5}
              suffix="°"
              hint={`Сумма A и B не больше ${MAX_ANGLE_SUM}°`}
              onChange={(value) => { setAngleB(clamp(value, MIN_ANGLE, Math.max(MIN_ANGLE, MAX_ANGLE_SUM - angleA))); setChecked(false); }}
            />
          )}
        </div>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж треугольника" tabIndex={0}>
          {solved === null ? (
            <p>Неравенство треугольника нарушено — чертёж построить нельзя.</p>
          ) : (
            <TrianglePicture
              id={`${labId}-picture`}
              solved={solved}
              hidden={reveal ? 'none' : target}
              unit={unit}
            />
          )}
        </div>

        {activeChallenge && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>{target === 'angleA' ? 'Угол A, градусы' : `Сторона a, ${unit}`}</label>
            <input
              id={`${labId}-answer`}
              type="text"
              inputMode="decimal"
              value={answer}
              onChange={(event) => {
                const raw = event.target.value.slice(0, 7);
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
