import { useId, useMemo, useState } from 'react';
import {
  BASE_FUNCTION_IDS,
  IDENTITY_TRANSFORM,
  getBaseFunction,
  numberText,
  parityText,
  transformSegments,
  transformSteps,
  transformText,
  transformedDomainText,
  transformedParity,
  transformedRangeText,
  type BaseFunctionId,
  type Box,
  type Point,
  type TransformParams,
} from '../lib/functionsCore';

export interface FnTransformLabProps {
  /** Эталон, от которого идёт преобразование. */
  initialBase?: BaseFunctionId;
  /** Вертикальный множитель a ≠ 0. */
  initialA?: number;
  /** Горизонтальный множитель k ≠ 0. */
  initialK?: number;
  /** Сдвиг вдоль оси x. */
  initialM?: number;
  /** Сдвиг вдоль оси y. */
  initialN?: number;
  /** Режим задачи: график скрыт, пока не нажата кнопка «Проверить». */
  challenge?: boolean;
}

interface Preset {
  readonly title: string;
  readonly params: TransformParams;
}

interface Puzzle {
  readonly base: BaseFunctionId;
  readonly params: TransformParams;
}

const EXTENT = 8;
const BOX: Box = { xMin: -EXTENT, xMax: EXTENT, yMin: -EXTENT, yMax: EXTENT };
const SAMPLES = 361;
const GRID_VALUES: readonly number[] = Array.from({ length: 2 * EXTENT + 1 }, (_, index) => index - EXTENT);
const SHIFT_LIMIT = 5;
const SHIFT_VALUES: readonly number[] = Array.from(
  { length: 2 * SHIFT_LIMIT + 1 },
  (_, index) => index - SHIFT_LIMIT,
);
const A_VALUES: readonly number[] = [-3, -2, -1, -0.5, 0.5, 1, 2, 3];
const K_VALUES: readonly number[] = [-2, -1, -0.5, 0.5, 1, 2];

const PRESETS: readonly Preset[] = [
  { title: 'Эталон', params: { a: 1, k: 1, m: 0, n: 0 } },
  { title: 'Вправо на 3', params: { a: 1, k: 1, m: 3, n: 0 } },
  { title: 'Вниз на 4', params: { a: 1, k: 1, m: 0, n: -4 } },
  { title: 'Отражение по оси x', params: { a: -1, k: 1, m: 0, n: 0 } },
  { title: 'Отражение по оси y', params: { a: 1, k: -1, m: 0, n: 0 } },
  { title: 'Сжатие к оси y вдвое', params: { a: 1, k: 2, m: 0, n: 0 } },
  { title: 'Растяжение от оси x вдвое', params: { a: 2, k: 1, m: 0, n: 0 } },
  { title: 'Всё сразу', params: { a: -2, k: 1, m: 1, n: 3 } },
];

const PUZZLES: readonly Puzzle[] = [
  { base: 'sqrt', params: { a: 1, k: 1, m: 3, n: -2 } },
  { base: 'sqrt', params: { a: -1, k: -1, m: 2, n: 1 } },
  { base: 'reciprocal', params: { a: 1, k: 1, m: -1, n: 2 } },
  { base: 'square', params: { a: -2, k: 1, m: 1, n: 3 } },
  { base: 'abs', params: { a: 0.5, k: 1, m: -2, n: -1 } },
  { base: 'cube', params: { a: -1, k: 2, m: 1, n: 0 } },
];

function unique(values: readonly string[]): readonly string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function pick(values: readonly number[], candidate: number | undefined, fallback: number): number {
  return candidate !== undefined && values.includes(candidate) ? candidate : fallback;
}

function safeShift(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(SHIFT_LIMIT, Math.max(-SHIFT_LIMIT, Math.trunc(value)));
}

function sameParams(left: TransformParams, right: TransformParams): boolean {
  return left.a === right.a && left.k === right.k && left.m === right.m && left.n === right.n;
}

interface ValueSelectProps {
  id: string;
  label: string;
  hint: string;
  values: readonly number[];
  value: number;
  onChange: (value: number) => void;
}

function ValueSelect({ id, label, hint, values, value, onChange }: ValueSelectProps) {
  return (
    <div className="dm-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{numberText(value)}</span>
      </label>
      <select
        id={id}
        value={value}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {values.map((item) => (
          <option value={item} key={item}>{numberText(item)}</option>
        ))}
      </select>
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

interface PlaneProps {
  id: string;
  base: BaseFunctionId;
  params: TransformParams;
  formula: string;
  showGhost: boolean;
}

/** Масштаб по обеим осям одинаков, поэтому форма кривой на рисунке не искажена. */
function TransformPlane({ id, base, params, formula, showGhost }: PlaneProps) {
  const centerX = 360;
  const centerY = 350;
  const radius = 320;
  const scale = radius / EXTENT;
  const px = (value: number) => centerX + value * scale;
  const py = (value: number) => centerY - value * scale;

  const ghost = useMemo(() => transformSegments(base, IDENTITY_TRANSFORM, BOX, SAMPLES), [base]);
  const curve = useMemo(() => transformSegments(base, params, BOX, SAMPLES), [base, params]);
  const anchorVisible = Math.abs(params.m) <= EXTENT && Math.abs(params.n) <= EXTENT;
  const labelValues = GRID_VALUES.filter((value) => value !== 0 && value % 2 === 0);

  const polyline = (segments: readonly Point[][], className: string, keyPrefix: string) => (
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
      <title id={`${id}-title`}>{`График функции ${formula} рядом с эталоном ${getBaseFunction(base).formulaText}`}</title>
      <desc id={`${id}-desc`}>
        Сетка честная: одна клетка — одна единица по каждой оси, масштаб по осям одинаковый.
        {showGhost
          ? ` Пунктиром показан эталон ${getBaseFunction(base).formulaText}.`
          : ' Эталон сейчас скрыт.'}
        {' '}Сплошной линией показан график {formula}: область определения — {transformedDomainText(base, params)},
        область значений — {transformedRangeText(base, params)}.
        Опорная точка эталона (0; 0) перешла в точку ({numberText(params.m)}; {numberText(params.n)}).
        Линия состоит из {curve.length === 1 ? 'одной ветви' : `${numberText(curve.length)} ветвей`}.
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
            <text x={px(value)} y={centerY + 20}>{numberText(value)}</text>
            <text x={centerX - 16} y={py(value) + 4}>{numberText(value)}</text>
          </g>
        ))}
        <text x={centerX + radius - 6} y={centerY - 12}>x</text>
        <text x={centerX + 14} y={centerY - radius + 12}>y</text>
        <text x={centerX - 15} y={centerY + 19}>0</text>
      </g>

      {showGhost && polyline(ghost, 'dm-signed-plane__reflection-guides', 'ghost')}
      {polyline(curve, 'dm-signed-plane__route-segment', 'curve')}

      {anchorVisible && (
        <g
          className="dm-signed-plane__point dm-signed-plane__point--waypoint"
          transform={`translate(${px(params.m)} ${py(params.n)})`}
          aria-hidden="true"
        >
          <circle r="7" />
          <text x={0} y={params.a > 0 ? 26 : -16}>({numberText(params.m)}; {numberText(params.n)})</text>
        </g>
      )}
    </svg>
  );
}

export default function FnTransformLab({
  initialBase = 'square',
  initialA,
  initialK,
  initialM,
  initialN,
  challenge = false,
}: FnTransformLabProps) {
  const reactId = useId();
  const labId = `fn-transform-${reactId.replace(/:/g, '')}`;

  const defaultBase: BaseFunctionId = BASE_FUNCTION_IDS.includes(initialBase) ? initialBase : 'square';
  const defaultParams: TransformParams = {
    a: pick(A_VALUES, initialA, 1),
    k: pick(K_VALUES, initialK, 1),
    m: safeShift(initialM, 0),
    n: safeShift(initialN, 0),
  };

  const [base, setBase] = useState<BaseFunctionId>(defaultBase);
  const [a, setA] = useState(defaultParams.a);
  const [k, setK] = useState(defaultParams.k);
  const [m, setM] = useState(defaultParams.m);
  const [n, setN] = useState(defaultParams.n);
  const [showGhost, setShowGhost] = useState(true);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [domainAnswer, setDomainAnswer] = useState('');
  const [rangeAnswer, setRangeAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const puzzle = PUZZLES[puzzleIndex % PUZZLES.length]!;
  const activeBase = challenge ? puzzle.base : base;
  const activeParams = useMemo<TransformParams>(
    () => (challenge ? puzzle.params : { a, k, m, n }),
    [challenge, puzzle, a, k, m, n],
  );
  const reveal = !challenge || checked;

  const spec = getBaseFunction(activeBase);
  const formula = transformText(activeBase, activeParams);
  const domain = transformedDomainText(activeBase, activeParams);
  const range = transformedRangeText(activeBase, activeParams);
  const parity = transformedParity(activeBase, activeParams);
  const steps = useMemo(() => transformSteps(activeBase, activeParams), [activeBase, activeParams]);

  const domainOptions = unique([
    'любое число',
    `x ⩾ ${numberText(activeParams.m)}`,
    `x ⩽ ${numberText(activeParams.m)}`,
    `x ≠ ${numberText(activeParams.m)}`,
  ]);
  const rangeOptions = unique([
    'любое число',
    `y ⩾ ${numberText(activeParams.n)}`,
    `y ⩽ ${numberText(activeParams.n)}`,
    `y ≠ ${numberText(activeParams.n)}`,
  ]);

  const domainCorrect = domainAnswer === domain;
  const rangeCorrect = rangeAnswer === range;
  const allCorrect = domainCorrect && rangeCorrect;
  const answerReady = domainAnswer !== '' && rangeAnswer !== '';

  const reset = () => {
    setBase(defaultBase);
    setA(defaultParams.a);
    setK(defaultParams.k);
    setM(defaultParams.m);
    setN(defaultParams.n);
    setShowGhost(true);
    setPuzzleIndex(0);
    setDomainAnswer('');
    setRangeAnswer('');
    setChecked(false);
  };

  const nextPuzzle = () => {
    setPuzzleIndex((current) => (current + 1) % PUZZLES.length);
    setDomainAnswer('');
    setRangeAnswer('');
    setChecked(false);
  };

  const result = !reveal
    ? {
      symbol: '?',
      headline: 'Прочитай D(f) и E(f) прямо по формуле.',
      detail: 'Корень запрещает отрицательное подкоренное выражение, дробь — нулевой знаменатель. Область значений подскажут знак a и сдвиг n. График появится после проверки.',
    }
    : challenge
      ? {
        symbol: allCorrect ? '✓' : '×',
        headline: allCorrect ? `Верно: ${formula}.` : `Правильный ответ: D(f): ${domain}; E(f): ${range}.`,
        detail: allCorrect
          ? `${spec.shapeText} после преобразования; ${parityText(parity)}.`
          : `${domainCorrect ? 'Область определения найдена верно.' : 'Область определения зависит только от того, что стоит под корнем или в знаменателе.'} ${rangeCorrect ? 'Область значений найдена верно.' : 'Область значений эталона сдвигается на n, а знак a решает, вверх или вниз смотрит луч значений.'}`,
      }
      : {
        symbol: 'ƒ',
        headline: `${formula}: D(f): ${domain}, E(f): ${range}.`,
        detail: `${parityText(parity)}. Опорная точка (0; 0) эталона перешла в (${numberText(activeParams.m)}; ${numberText(activeParams.n)}).`,
      };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория преобразований</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {challenge ? 'Прочитай D(f) и E(f) по формуле' : 'Четыре ручки над любым эталоном'}
          </h3>
          <p>
            {challenge
              ? 'Функция задана формулой, график спрятан. Сначала назови область определения и область значений, потом проверь себя рисунком.'
              : 'Пунктир — эталон, он не двигается никогда. Меняй по одной ручке за раз и следи, что случилось со сплошной линией, с D(f) и с E(f).'}
          </p>
        </div>
        <span className="dm-lab__badge">y = a·f(k(x − m)) + n</span>
      </header>

      <div className="dm-lab__body">
        {!challenge && (
          <>
            <div className="dm-signed-tabs" role="group" aria-label="Эталонная функция">
              {BASE_FUNCTION_IDS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`dm-signed-tab ${base === item ? 'dm-signed-tab--active' : ''}`}
                  aria-pressed={base === item}
                  onClick={() => setBase(item)}
                >
                  {getBaseFunction(item).title}
                </button>
              ))}
            </div>

            <div className="dm-geometry-preset-buttons" role="group" aria-label="Готовые преобразования">
              {PRESETS.map((preset) => {
                const active = sameParams(preset.params, activeParams);
                return (
                  <button
                    type="button"
                    key={preset.title}
                    className={`dm-geometry-preset-button ${active ? 'dm-geometry-preset-button--active' : ''}`}
                    aria-pressed={active}
                    onClick={() => {
                      setA(preset.params.a);
                      setK(preset.params.k);
                      setM(preset.params.m);
                      setN(preset.params.n);
                    }}
                  >
                    {preset.title}
                  </button>
                );
              })}
            </div>

            <div className="dm-lab__controls dm-lab__controls--four">
              <ValueSelect
                id={`${labId}-a`}
                label="Множитель a"
                hint="Растягивает по вертикали; при a < 0 отражает относительно оси x."
                values={A_VALUES}
                value={a}
                onChange={setA}
              />
              <ValueSelect
                id={`${labId}-k`}
                label="Множитель k"
                hint="Сжимает по горизонтали в |k| раз; при k < 0 отражает относительно оси y."
                values={K_VALUES}
                value={k}
                onChange={setK}
              />
              <ValueSelect
                id={`${labId}-m`}
                label="Сдвиг m"
                hint="Стоит внутри скобки со знаком минус: вправо при m > 0."
                values={SHIFT_VALUES}
                value={m}
                onChange={setM}
              />
              <ValueSelect
                id={`${labId}-n`}
                label="Сдвиг n"
                hint="Прибавляется в конце: вверх при n > 0."
                values={SHIFT_VALUES}
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

        <div className="dm-algebra-equation" role="math" aria-label={`Функция ${formula}`}>
          <span>{getBaseFunction(activeBase).formulaText}</span>
          <span aria-hidden="true">→</span>
          <strong>{formula}</strong>
        </div>

        {challenge && (
          <>
            <p className="dm-signed-caption">Мой ответ</p>
            <div className="dm-geometry-answer-grid">
              <div className="dm-geometry-answer-field">
                <label htmlFor={`${labId}-domain`}>Область определения D(f)</label>
                <select
                  id={`${labId}-domain`}
                  value={domainAnswer}
                  onChange={(event) => {
                    setDomainAnswer(event.target.value);
                    setChecked(false);
                  }}
                >
                  <option value="">— выбери —</option>
                  {domainOptions.map((option) => (
                    <option value={option} key={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="dm-geometry-answer-field">
                <label htmlFor={`${labId}-range`}>Область значений E(f)</label>
                <select
                  id={`${labId}-range`}
                  value={rangeAnswer}
                  onChange={(event) => {
                    setRangeAnswer(event.target.value);
                    setChecked(false);
                  }}
                >
                  <option value="">— выбери —</option>
                  {rangeOptions.map((option) => (
                    <option value={option} key={option}>{option}</option>
                  ))}
                </select>
              </div>
              <button className="dm-button" type="button" disabled={!answerReady} onClick={() => setChecked(true)}>
                Проверить
              </button>
            </div>
          </>
        )}

        {reveal && (
          <>
            <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график функции" tabIndex={0}>
              <TransformPlane
                id={`${labId}-plane`}
                base={activeBase}
                params={activeParams}
                formula={formula}
                showGhost={showGhost}
              />
            </div>

            <button
              type="button"
              className="dm-button dm-button--secondary"
              aria-pressed={showGhost}
              onClick={() => setShowGhost((current) => !current)}
            >
              {showGhost ? `Спрятать эталон ${spec.formulaText}` : `Показать эталон ${spec.formulaText}`}
            </button>

            <ol className="dm-signed-route-list">
              {steps.map((step, index) => (
                <li key={`${step.formula}-${index}`}>
                  <span aria-hidden="true">{index + 1}</span>
                  <p>
                    <strong>{step.formula}</strong>
                    <small>{step.action}</small>
                  </p>
                </li>
              ))}
            </ol>

            <div className="dm-signed-reflection-cards">
              <div>
                <span>Область определения</span>
                <strong>{domain}</strong>
                <small>Какие x вообще можно подставить.</small>
              </div>
              <div>
                <span>Область значений</span>
                <strong>{range}</strong>
                <small>Какие y встречаются на графике.</small>
              </div>
              <div>
                <span>Чётность</span>
                <strong>{parity === 'even' ? 'чётная' : parity === 'odd' ? 'нечётная' : 'ни чётная, ни нечётная'}</strong>
                <small>{parityText(parity)}.</small>
              </div>
            </div>
          </>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span>
          <p>
            <strong>{result.headline}</strong>
            <small>{result.detail}</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>
          ↺ Вернуть пример
        </button>
      </div>
    </section>
  );
}
