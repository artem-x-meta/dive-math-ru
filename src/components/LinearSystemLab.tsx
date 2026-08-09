import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  approximate,
  clipLineToBox,
  clipVerticalToBox,
  describeSystemSolution,
  eliminationPlan,
  formatEquationText,
  formatExactText,
  formatLinearText,
  formatTwoVariableText,
  isVerticalLine,
  solveLinearEquationSteps,
  solveSystem,
  substitutionPlan,
  toSlopeIntercept,
  twoVariableEquation,
  type SystemSolution,
  type TwoVariableEquation,
} from '../lib/linear';
import { compareExact, parseExact, type ExactRational } from '../lib/exactRational';

export type LinearSystemMode = 'graph' | 'substitution' | 'elimination';

export interface SystemCoefficients {
  a: number;
  b: number;
  c: number;
}

export interface LinearSystemLabProps {
  mode?: LinearSystemMode;
  first?: SystemCoefficients;
  second?: SystemCoefficients;
  extent?: number;
  challenge?: boolean;
}

const DRAFT_PATTERN = /^[+\-−]?\d*(?:[.,]\d*)?$/;
const MAX_DRAFT_LENGTH = 12;
const COEFFICIENT_LIMIT = 12;
const HARD_EXTENT_MIN = 4;
const HARD_EXTENT_MAX = 12;

const MODE_LABELS: Readonly<Record<LinearSystemMode, string>> = {
  graph: 'График',
  substitution: 'Подстановка',
  elimination: 'Сложение',
};

const PUZZLES: readonly (readonly [SystemCoefficients, SystemCoefficients])[] = [
  [{ a: 2, b: 3, c: 12 }, { a: 1, b: -1, c: 1 }],
  [{ a: 1, b: 1, c: 5 }, { a: 3, b: -1, c: 3 }],
  [{ a: 2, b: -1, c: 4 }, { a: 1, b: 2, c: 7 }],
  [{ a: 1, b: 1, c: 2 }, { a: 2, b: 2, c: 7 }],
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeCoefficient(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), -COEFFICIENT_LIMIT, COEFFICIENT_LIMIT);
}

function safeTriple(value: SystemCoefficients | undefined, fallback: SystemCoefficients): SystemCoefficients {
  return {
    a: safeCoefficient(value?.a, fallback.a),
    b: safeCoefficient(value?.b, fallback.b),
    c: safeCoefficient(value?.c, fallback.c),
  };
}

function parseDraft(rawValue: string): number | null {
  const normalized = rawValue.trim().replace('−', '-').replace(',', '.');
  if (normalized === '' || normalized === '-' || normalized === '+' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameNumber(left: number, right: ExactRational): boolean {
  return compareExact(parseExact(left), right) === 0;
}

interface IntegerFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function IntegerField({ id, label, value, onChange }: IntegerFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  const commit = () => {
    const parsed = parseDraft(draft);
    const next = parsed === null ? value : clamp(Math.round(parsed), -COEFFICIENT_LIMIT, COEFFICIENT_LIMIT);
    setDraft(String(next));
    onChange(next);
  };

  return (
    <div className="dm-field dm-signed-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{formatExactText(parseExact(value))}</span>
      </label>
      <div className="dm-signed-field__control">
        <button
          type="button"
          className="dm-signed-field__step"
          onClick={() => onChange(clamp(value - 1, -COEFFICIENT_LIMIT, COEFFICIENT_LIMIT))}
          disabled={value <= -COEFFICIENT_LIMIT}
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
              setDraft(String(value));
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
          onClick={() => onChange(clamp(value + 1, -COEFFICIENT_LIMIT, COEFFICIENT_LIMIT))}
          disabled={value >= COEFFICIENT_LIMIT}
          aria-label={`Увеличить ${label} на 1`}
        >
          +
        </button>
      </div>
      <small id={`${id}-hint`}>Целое от −{COEFFICIENT_LIMIT} до {COEFFICIENT_LIMIT}</small>
    </div>
  );
}

interface SystemPlaneProps {
  id: string;
  first: TwoVariableEquation;
  second: TwoVariableEquation;
  solution: SystemSolution;
  extent: number;
  reveal: boolean;
}

function SystemPlane({ id, first, second, solution, extent, reveal }: SystemPlaneProps) {
  const centerX = 360;
  const centerY = 278;
  const radius = 236;
  const scale = radius / extent;
  const px = (value: number) => centerX + value * scale;
  const py = (value: number) => centerY - value * scale;
  const gridValues = Array.from({ length: extent * 2 + 1 }, (_, index) => -extent + index);

  const segmentFor = (equation: TwoVariableEquation) => {
    if (isVerticalLine(equation)) {
      return clipVerticalToBox(approximate(equation.c) / approximate(equation.a), extent);
    }
    const line = toSlopeIntercept(equation);
    if (line === null) return null;
    return clipLineToBox(approximate(line.slope), approximate(line.intercept), extent);
  };

  const firstSegment = segmentFor(first);
  const secondSegment = segmentFor(second);
  const point = solution.kind === 'unique'
    ? { x: approximate(solution.x), y: approximate(solution.y) }
    : null;
  const pointVisible = point !== null && Math.abs(point.x) <= extent && Math.abs(point.y) <= extent;

  const relationText = solution.kind === 'unique'
    ? `Прямые пересекаются в одной точке ${describeSystemSolution(solution)}.`
    : solution.kind === 'none'
      ? 'Прямые не пересекаются: общих точек нет.'
      : 'Прямые совпадают: общих точек бесконечно много.';

  return (
    <svg className="dm-signed-plane" viewBox="0 0 720 570" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Графики двух уравнений системы</title>
      <desc id={`${id}-desc`}>
        Первое уравнение: {formatTwoVariableText(first)}. Второе уравнение: {formatTwoVariableText(second)}.
        {reveal ? ` ${relationText}` : ' Найди общую точку по рисунку и проверь её подстановкой.'}
      </desc>
      <defs>
        <marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path className="dm-signed-plane__axis-arrow" d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>
      <rect className="dm-signed-plane__background" x={centerX - radius} y={centerY - radius} width={radius * 2} height={radius * 2} rx="12" />
      <g className="dm-signed-plane__grid" aria-hidden="true">
        {gridValues.map((value) => (
          <g key={value}>
            <line x1={px(value)} y1={centerY - radius} x2={px(value)} y2={centerY + radius} />
            <line x1={centerX - radius} y1={py(value)} x2={centerX + radius} y2={py(value)} />
          </g>
        ))}
      </g>
      <line className="dm-signed-plane__axis" x1={centerX - radius} y1={centerY} x2={centerX + radius} y2={centerY} markerEnd={`url(#${id}-arrow)`} />
      <line className="dm-signed-plane__axis" x1={centerX} y1={centerY + radius} x2={centerX} y2={centerY - radius} markerEnd={`url(#${id}-arrow)`} />
      <g className="dm-signed-plane__labels" aria-hidden="true">
        {gridValues.filter((value) => value !== 0).map((value) => (
          <g key={value}>
            <text x={px(value)} y={centerY + 20}>{value}</text>
            <text x={centerX - 14} y={py(value) + 4}>{value}</text>
          </g>
        ))}
        <text x={centerX + radius - 4} y={centerY - 12}>x</text>
        <text x={centerX + 13} y={centerY - radius + 11}>y</text>
        <text x={centerX - 15} y={centerY + 19}>0</text>
      </g>

      {firstSegment && (
        <g className="dm-signed-plane__route-segment" aria-hidden="true">
          <line x1={px(firstSegment.x1)} y1={py(firstSegment.y1)} x2={px(firstSegment.x2)} y2={py(firstSegment.y2)} />
        </g>
      )}
      {secondSegment && (
        <g className="dm-signed-plane__reflection-guides" aria-hidden="true">
          <line x1={px(secondSegment.x1)} y1={py(secondSegment.y1)} x2={px(secondSegment.x2)} y2={py(secondSegment.y2)} />
        </g>
      )}

      {reveal && pointVisible && point && (
        <g className="dm-signed-plane__point dm-signed-plane__point--finish" transform={`translate(${px(point.x)} ${py(point.y)})`} aria-hidden="true">
          <circle r="8" />
          <text x={12} y={-12}>{solution.kind === 'unique' ? describeSystemSolution(solution) : ''}</text>
        </g>
      )}

      <g className="dm-signed-plane__labels" aria-hidden="true">
        <text x={centerX - radius + 60} y={centerY - radius + 20}>сплошная — первое уравнение</text>
        <text x={centerX - radius + 60} y={centerY - radius + 38}>пунктир — второе уравнение</text>
      </g>
    </svg>
  );
}

interface StepListProps {
  steps: readonly { rule: string; text: string }[];
}

function StepList({ steps }: StepListProps) {
  return (
    <ol className="dm-algebra-steps">
      {steps.map((step, index) => (
        <li key={`${index}-${step.text}`}>
          <span>{index + 1}</span>
          <p>
            <small>{step.rule}</small>
            <strong>{step.text}</strong>
          </p>
        </li>
      ))}
    </ol>
  );
}

export default function LinearSystemLab({
  mode = 'graph',
  first,
  second,
  extent,
  challenge = false,
}: LinearSystemLabProps) {
  const reactId = useId();
  const labId = `linear-system-${reactId.replace(/:/g, '')}`;

  const safeExtent = useMemo(
    () => clamp(Math.round(extent ?? 7), HARD_EXTENT_MIN, HARD_EXTENT_MAX),
    [extent],
  );
  const defaultFirst = useMemo(() => safeTriple(first, { a: 2, b: 3, c: 12 }), [first]);
  const defaultSecond = useMemo(() => safeTriple(second, { a: 1, b: -1, c: 1 }), [second]);

  const puzzles = useMemo<readonly (readonly [SystemCoefficients, SystemCoefficients])[]>(() => {
    const head = [defaultFirst, defaultSecond] as const;
    const key = (pair: readonly [SystemCoefficients, SystemCoefficients]) =>
      `${pair[0].a},${pair[0].b},${pair[0].c},${pair[1].a},${pair[1].b},${pair[1].c}`;
    return [head, ...PUZZLES.filter((pair) => key(pair) !== key(head))];
  }, [defaultFirst, defaultSecond]);

  const [firstValues, setFirstValues] = useState<SystemCoefficients>(defaultFirst);
  const [secondValues, setSecondValues] = useState<SystemCoefficients>(defaultSecond);
  const [activeMode, setActiveMode] = useState<LinearSystemMode>(mode);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [xAnswer, setXAnswer] = useState('');
  const [yAnswer, setYAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const puzzle = puzzles[puzzleIndex % puzzles.length]!;
  const activeFirst = challenge ? puzzle[0] : firstValues;
  const activeSecond = challenge ? puzzle[1] : secondValues;
  const reveal = !challenge || checked;

  const equationOne = useMemo(
    () => twoVariableEquation(activeFirst.a, activeFirst.b, activeFirst.c),
    [activeFirst],
  );
  const equationTwo = useMemo(
    () => twoVariableEquation(activeSecond.a, activeSecond.b, activeSecond.c),
    [activeSecond],
  );
  const solution = useMemo(() => solveSystem(equationOne, equationTwo), [equationOne, equationTwo]);

  const substitution = useMemo(() => {
    try {
      return substitutionPlan(equationOne, equationTwo);
    } catch {
      return null;
    }
  }, [equationOne, equationTwo]);

  const elimination = useMemo(
    () => eliminationPlan(equationOne, equationTwo, 'x'),
    [equationOne, equationTwo],
  );

  const substitutionSteps = useMemo(() => {
    if (!substitution) return [];
    const other = substitution.source === 1 ? 2 : 1;
    const steps: { rule: string; text: string }[] = [
      {
        rule: `Выражаем ${substitution.expressed} из уравнения ${substitution.source}`,
        text: `${substitution.expressed} = ${formatLinearText(substitution.expression, substitution.reducedVariable)}`,
      },
      {
        rule: `Подставляем это выражение в уравнение ${other}`,
        text: formatEquationText(substitution.reduced, substitution.reducedVariable),
      },
    ];
    for (const step of solveLinearEquationSteps(substitution.reduced, substitution.reducedVariable)) {
      if (step.kind === 'start') continue;
      steps.push({
        rule: step.rule,
        text: step.equation
          ? formatEquationText(step.equation, substitution.reducedVariable)
          : step.kind === 'conclusion' && solution.kind === 'unique'
            ? `${substitution.reducedVariable} = ${formatExactText(substitution.reducedVariable === 'x' ? solution.x : solution.y)}`
            : step.rule,
      });
    }
    if (solution.kind === 'unique') {
      steps.push({
        rule: `Возвращаемся к выражению для ${substitution.expressed}`,
        text: `${substitution.expressed} = ${formatExactText(substitution.expressed === 'x' ? solution.x : solution.y)}`,
      });
    }
    return steps;
  }, [substitution, solution]);

  const eliminationSteps = useMemo(() => {
    const steps: { rule: string; text: string }[] = [
      { rule: 'Первое уравнение умножаем на', text: `${formatExactText(elimination.firstFactor)}: ${formatTwoVariableText(elimination.scaledFirst)}` },
      { rule: 'Второе уравнение умножаем на', text: `${formatExactText(elimination.secondFactor)}: ${formatTwoVariableText(elimination.scaledSecond)}` },
      { rule: 'Складываем уравнения почленно: слагаемые с x взаимно уничтожаются', text: formatTwoVariableText(elimination.combined) },
    ];
    if (solution.kind === 'unique') {
      steps.push({ rule: 'Находим y, затем подставляем его в любое исходное уравнение', text: `y = ${formatExactText(solution.y)}, x = ${formatExactText(solution.x)}` });
    } else {
      steps.push({
        rule: 'Переменные исчезли обе',
        text: solution.kind === 'none'
          ? 'осталось неверное числовое равенство — решений нет'
          : 'осталось верное равенство 0 = 0 — решений бесконечно много',
      });
    }
    return steps;
  }, [elimination, solution]);

  const parsedX = parseDraft(xAnswer);
  const parsedY = parseDraft(yAnswer);
  const answerReady = parsedX !== null && parsedY !== null;
  const answerCorrect = solution.kind === 'unique'
    && parsedX !== null
    && parsedY !== null
    && sameNumber(parsedX, solution.x)
    && sameNumber(parsedY, solution.y);

  const result = challenge && !checked
    ? {
      symbol: '?',
      headline: 'Найди пару (x; y), которая подходит обоим уравнениям.',
      detail: 'Прочитай координаты общей точки по сетке, а затем обязательно проверь их подстановкой в оба уравнения.',
    }
    : {
      symbol: solution.kind === 'unique' ? (challenge ? (answerCorrect ? '✓' : '×') : '=') : solution.kind === 'none' ? '∅' : '∞',
      headline: solution.kind === 'unique'
        ? `Решение системы: ${describeSystemSolution(solution)}.`
        : solution.kind === 'none'
          ? 'Решений нет: прямые параллельны и не имеют общих точек.'
          : 'Решений бесконечно много: уравнения задают одну и ту же прямую.',
      detail: solution.kind === 'unique'
        ? `Проверка: подставь x = ${formatExactText(solution.x)} и y = ${formatExactText(solution.y)} в оба уравнения — оба обратятся в верные равенства.`
        : 'Алгебра и график согласованы: после исключения переменной остаётся числовое равенство без переменных.',
    };

  const reset = () => {
    setFirstValues(defaultFirst);
    setSecondValues(defaultSecond);
    setActiveMode(mode);
    setPuzzleIndex(0);
    setXAnswer('');
    setYAnswer('');
    setChecked(false);
  };

  const nextPuzzle = () => {
    setPuzzleIndex((current) => (current + 1) % puzzles.length);
    setXAnswer('');
    setYAnswer('');
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория систем уравнений</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Одна пара чисел на два условия сразу</h3>
          <p>Каждое уравнение — прямая. Решение системы — точка, которая лежит на обеих прямых.</p>
        </div>
        <span className="dm-lab__badge">{formatTwoVariableText(equationOne)}</span>
      </header>

      <div className="dm-lab__body">
        {reveal && (
          <div className="dm-signed-tabs" role="group" aria-label="Способ решения системы">
            {(Object.keys(MODE_LABELS) as LinearSystemMode[]).map((item) => (
              <button
                type="button"
                className={`dm-signed-tab ${activeMode === item ? 'dm-signed-tab--active' : ''}`}
                aria-pressed={activeMode === item}
                onClick={() => setActiveMode(item)}
                key={item}
              >
                {MODE_LABELS[item]}
              </button>
            ))}
          </div>
        )}

        {!challenge && (
          <>
            <p className="dm-panel-title">Первое уравнение: {formatTwoVariableText(equationOne)}</p>
            <div className="dm-lab__controls dm-lab__controls--four dm-signed-controls">
              <IntegerField id={`${labId}-a1`} label="a₁ при x" value={firstValues.a} onChange={(value) => { setFirstValues((current) => ({ ...current, a: value })); setChecked(false); }} />
              <IntegerField id={`${labId}-b1`} label="b₁ при y" value={firstValues.b} onChange={(value) => { setFirstValues((current) => ({ ...current, b: value })); setChecked(false); }} />
              <IntegerField id={`${labId}-c1`} label="c₁ справа" value={firstValues.c} onChange={(value) => { setFirstValues((current) => ({ ...current, c: value })); setChecked(false); }} />
            </div>
            <p className="dm-panel-title">Второе уравнение: {formatTwoVariableText(equationTwo)}</p>
            <div className="dm-lab__controls dm-lab__controls--four dm-signed-controls">
              <IntegerField id={`${labId}-a2`} label="a₂ при x" value={secondValues.a} onChange={(value) => { setSecondValues((current) => ({ ...current, a: value })); setChecked(false); }} />
              <IntegerField id={`${labId}-b2`} label="b₂ при y" value={secondValues.b} onChange={(value) => { setSecondValues((current) => ({ ...current, b: value })); setChecked(false); }} />
              <IntegerField id={`${labId}-c2`} label="c₂ справа" value={secondValues.c} onChange={(value) => { setSecondValues((current) => ({ ...current, c: value })); setChecked(false); }} />
            </div>
          </>
        )}

        {challenge && (
          <div className="dm-geometry-example-switch">
            <span>
              Система № {puzzleIndex + 1}: {formatTwoVariableText(equationOne)} и {formatTwoVariableText(equationTwo)}
            </span>
            <button className="dm-button dm-button--secondary" type="button" onClick={nextPuzzle}>Следующая система</button>
          </div>
        )}

        {(activeMode === 'graph' || !reveal) && (
          <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график системы уравнений" tabIndex={0}>
            <SystemPlane
              id={`${labId}-plane`}
              first={equationOne}
              second={equationTwo}
              solution={solution}
              extent={safeExtent}
              reveal={reveal}
            />
          </div>
        )}

        {reveal && activeMode === 'substitution' && (
          substitution
            ? <StepList steps={substitutionSteps} />
            : <p className="dm-panel-title">В этой системе нет ни одной переменной с ненулевым коэффициентом — выражать нечего.</p>
        )}

        {reveal && activeMode === 'elimination' && <StepList steps={eliminationSteps} />}

        {challenge && (
          <div className="dm-geometry-answer-grid">
            <div className="dm-geometry-answer-field">
              <label htmlFor={`${labId}-x-answer`}>Мой x</label>
              <input
                id={`${labId}-x-answer`}
                type="text"
                inputMode="decimal"
                maxLength={MAX_DRAFT_LENGTH}
                value={xAnswer}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (DRAFT_PATTERN.test(raw)) {
                    setXAnswer(raw);
                    setChecked(false);
                  }
                }}
              />
            </div>
            <div className="dm-geometry-answer-field">
              <label htmlFor={`${labId}-y-answer`}>Мой y</label>
              <input
                id={`${labId}-y-answer`}
                type="text"
                inputMode="decimal"
                maxLength={MAX_DRAFT_LENGTH}
                value={yAnswer}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (DRAFT_PATTERN.test(raw)) {
                    setYAnswer(raw);
                    setChecked(false);
                  }
                }}
              />
            </div>
            <button className="dm-button" type="button" disabled={!answerReady} onClick={() => setChecked(true)}>Проверить</button>
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
