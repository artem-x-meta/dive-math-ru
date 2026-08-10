import { useEffect, useId, useMemo, useState } from 'react';
import { subtractPolynomials } from '../lib/polynomials';
import {
  INTEGRAL_FUNCTIONS,
  areaBetween,
  crossingPoints,
  curveExtremes,
  getIntegralFunction,
  newtonLeibnizReport,
  numberText,
  samplePolynomial,
} from '../lib/integrals';

const DECIMAL_DRAFT = /^[-−]?\d*(?:[.,]\d*)?$/;
const ANSWER_DRAFT = /^[-−]?\d*(?:[.,]\d*)?(?:\s*\/\s*\d*(?:[.,]\d*)?)?$/;
const BOUND_LIMIT = 8;
const SEARCH_WINDOW = 8;
const TOLERANCE = 0.005;

export type IntegAreaContext = 'area' | 'motion';

interface ContextDefinition {
  readonly variable: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly intro: string;
  readonly quantity: string;
  readonly upperLabel: string;
  readonly lowerLabel: string;
}

const CONTEXTS: Record<IntegAreaContext, ContextDefinition> = {
  area: {
    variable: 'x',
    eyebrow: 'Лаборатория первообразной',
    title: 'Площадь считается вычитанием',
    intro: 'Выбери две функции и отрезок. Площадь фигуры между графиками — это интеграл разности, а интеграл считается через первообразную.',
    quantity: 'Площадь',
    upperLabel: 'Верхняя функция f',
    lowerLabel: 'Нижняя функция g',
  },
  motion: {
    variable: 't',
    eyebrow: 'Лаборатория накопления',
    title: 'Площадь под графиком скорости — это путь',
    intro: 'Верхний график — скорость, нижний — ноль. Площадь под графиком скорости равна пути, пройденному за выбранный промежуток времени.',
    quantity: 'Накопленная величина',
    upperLabel: 'Скорость v',
    lowerLabel: 'Нижняя граница',
  },
};

export interface IntegAreaLabProps {
  /** Сюжет: чистая площадь или накопление по скорости. */
  context?: IntegAreaContext;
  /** Идентификатор верхней функции из INTEGRAL_FUNCTIONS. */
  initialTop?: string;
  /** Идентификатор нижней функции; 'zero' — это ось абсцисс. */
  initialBottom?: string;
  initialFrom?: number;
  initialTo?: number;
  /** Режим задачи: числа и выкладка появляются только после нажатия «Проверить». */
  challenge?: boolean;
}

function parseDecimal(raw: string): number | null {
  const normalized = raw.trim().replace('−', '-').replace(',', '.');
  if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAnswer(raw: string): number | null {
  const normalized = raw.trim().replace('−', '-').replace(',', '.').replace(/\s+/g, '');
  if (normalized === '') return null;
  const slash = normalized.indexOf('/');
  if (slash === -1) return parseDecimal(normalized);
  const numerator = parseDecimal(normalized.slice(0, slash));
  const denominator = parseDecimal(normalized.slice(slash + 1));
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundTo(value: number, step = 0.1): number {
  return Number((Math.round(value / step) * step).toFixed(6));
}

function safeBound(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return roundTo(clamp(value, -BOUND_LIMIT, BOUND_LIMIT));
}

function safeFunctionId(id: string | undefined, fallback: string): string {
  return INTEGRAL_FUNCTIONS.some((preset) => preset.id === id) ? (id as string) : fallback;
}

/** Подбирает круглый шаг сетки, чтобы подписей было не больше десятка. */
function niceTicks(minimum: number, maximum: number): number[] {
  const span = maximum - minimum;
  const candidates = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 50];
  const step = candidates.find((value) => span / value <= 10) ?? 100;
  const first = Math.ceil(minimum / step) * step;
  const ticks: number[] = [];
  for (let value = first; value <= maximum + step / 1000; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return ticks;
}

interface BoundFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

function BoundField({ id, label, hint, value, onChange }: BoundFieldProps) {
  const [draft, setDraft] = useState(numberText(value));
  useEffect(() => setDraft(numberText(value)), [value]);

  return (
    <div className="dm-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{numberText(value)}</span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          const raw = event.target.value.slice(0, 12);
          if (!DECIMAL_DRAFT.test(raw)) return;
          setDraft(raw);
          const parsed = parseDecimal(raw);
          if (parsed !== null && Math.abs(parsed) <= BOUND_LIMIT) onChange(roundTo(parsed));
        }}
        onBlur={(event) => {
          const parsed = parseDecimal(event.currentTarget.value);
          const next = parsed === null ? value : roundTo(clamp(parsed, -BOUND_LIMIT, BOUND_LIMIT));
          setDraft(numberText(next));
          onChange(next);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

interface PictureProps {
  readonly id: string;
  readonly top: readonly number[];
  readonly bottom: readonly number[];
  readonly topFormula: string;
  readonly bottomFormula: string;
  readonly from: number;
  readonly to: number;
  readonly pieces: ReturnType<typeof areaBetween>['pieces'];
  readonly variable: string;
  readonly showValue: boolean;
  readonly area: number;
}

/** Все координаты рисунка получены из вычисленных значений функций: масштаб честный. */
function AreaPicture({
  id, top, bottom, topFormula, bottomFormula, from, to, pieces, variable, showValue, area,
}: PictureProps) {
  const left = 64;
  const marginTop = 24;
  const width = 632;
  const height = 392;

  const span = to - from;
  const xMin = from - span * 0.08;
  const xMax = to + span * 0.08;
  const topExtremes = curveExtremes(top, xMin, xMax, 401);
  const bottomExtremes = curveExtremes(bottom, xMin, xMax, 401);
  const rawMin = Math.min(0, topExtremes.min, bottomExtremes.min);
  const rawMax = Math.max(0, topExtremes.max, bottomExtremes.max);
  const padding = Math.max((rawMax - rawMin) * 0.12, 0.5);
  const yMin = rawMin - padding;
  const yMax = rawMax + padding;

  const px = (value: number) => left + ((value - xMin) / (xMax - xMin)) * width;
  const py = (value: number) => marginTop + ((yMax - value) / (yMax - yMin)) * height;

  const topCurve = useMemo(() => samplePolynomial(top, xMin, xMax, 241), [top, xMin, xMax]);
  const bottomCurve = useMemo(() => samplePolynomial(bottom, xMin, xMax, 241), [bottom, xMin, xMax]);
  const xTicks = niceTicks(xMin, xMax);
  const yTicks = niceTicks(yMin, yMax);
  const axisY = py(clamp(0, yMin, yMax));
  const axisX = px(clamp(0, xMin, xMax));

  const polygons = pieces.map((piece) => {
    const upper = piece.upper === 'first' ? top : bottom;
    const lower = piece.upper === 'first' ? bottom : top;
    const upperPoints = samplePolynomial(upper, piece.from, piece.to, 81);
    const lowerPoints = samplePolynomial(lower, piece.from, piece.to, 81);
    const points = [...upperPoints, ...lowerPoints.reverse()]
      .map((point) => `${px(point.x).toFixed(2)},${py(point.y).toFixed(2)}`)
      .join(' ');
    return { key: `${piece.from}-${piece.to}`, points };
  });

  const line = (points: readonly { x: number; y: number }[], keyPrefix: string) =>
    points.slice(1).map((point, index) => {
      const previous = points[index]!;
      return (
        <line
          key={`${keyPrefix}-${index}`}
          x1={px(previous.x)}
          y1={py(previous.y)}
          x2={px(point.x)}
          y2={py(point.y)}
        />
      );
    });

  return (
    <svg className="dm-signed-plane" viewBox="0 0 720 470" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{`Фигура между графиками ${topFormula} и ${bottomFormula}`}</title>
      <desc id={`${id}-desc`}>
        Закрашена область между графиками на отрезке от {numberText(from)} до {numberText(to)}.
        Сплошная линия — график {topFormula}, пунктирная — график {bottomFormula}.
        Фигура состоит из {pieces.length === 1 ? 'одного куска' : `${pieces.length} кусков`}.
        {showValue ? ` Её площадь равна ${numberText(area)}.` : ' Значение площади появится после проверки ответа.'}
        Масштаб по каждой оси постоянный.
      </desc>

      <rect className="dm-signed-plane__background" x={left} y={marginTop} width={width} height={height} rx="12" />

      <g className="dm-signed-plane__grid" aria-hidden="true">
        {xTicks.map((tick) => (
          <line key={`x-${tick}`} x1={px(tick)} y1={marginTop} x2={px(tick)} y2={marginTop + height} />
        ))}
        {yTicks.map((tick) => (
          <line key={`y-${tick}`} x1={left} y1={py(tick)} x2={left + width} y2={py(tick)} />
        ))}
      </g>

      <g aria-hidden="true">
        {polygons.map((polygon) => (
          <polygon className="dm-geometry-figure__shape" key={polygon.key} points={polygon.points} />
        ))}
      </g>

      <g className="dm-signed-plane__reflection-guides" aria-hidden="true">
        <line x1={px(from)} y1={marginTop} x2={px(from)} y2={marginTop + height} />
        <line x1={px(to)} y1={marginTop} x2={px(to)} y2={marginTop + height} />
        {line(bottomCurve, 'bottom')}
      </g>

      <g aria-hidden="true">
        <line className="dm-signed-plane__axis" x1={left} y1={axisY} x2={left + width} y2={axisY} />
        <line className="dm-signed-plane__axis" x1={axisX} y1={marginTop} x2={axisX} y2={marginTop + height} />
      </g>

      <g className="dm-signed-plane__route-segment" aria-hidden="true">
        {line(topCurve, 'top')}
      </g>

      <g className="dm-signed-plane__labels" aria-hidden="true">
        {xTicks.map((tick) => (
          <text key={`xl-${tick}`} x={px(tick)} y={Math.min(axisY + 18, marginTop + height + 18)}>{numberText(tick)}</text>
        ))}
        {yTicks.filter((tick) => tick !== 0).map((tick) => (
          <text key={`yl-${tick}`} x={left - 12} y={py(tick) + 4}>{numberText(tick)}</text>
        ))}
        <text x={left + width - 6} y={axisY - 12}>{variable}</text>
        <text x={axisX + 16} y={marginTop + 14}>y</text>
        <text x={px(from)} y={marginTop + height + 34}>a = {numberText(from)}</text>
        <text x={px(to)} y={marginTop + height + 34}>b = {numberText(to)}</text>
      </g>
    </svg>
  );
}

export default function IntegAreaLab({
  context = 'area',
  initialTop,
  initialBottom,
  initialFrom,
  initialTo,
  challenge = false,
}: IntegAreaLabProps) {
  const reactId = useId();
  const labId = `integ-area-${reactId.replace(/:/g, '')}`;
  const definition = CONTEXTS[context] ?? CONTEXTS.area;

  const defaultTop = safeFunctionId(initialTop, 'square');
  const defaultBottom = safeFunctionId(initialBottom, 'zero');
  const defaultFrom = safeBound(initialFrom, 0);
  const defaultTo = safeBound(initialTo, defaultFrom + 2);

  const [topId, setTopId] = useState(defaultTop);
  const [bottomId, setBottomId] = useState(defaultBottom);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const topPreset = getIntegralFunction(topId);
  const bottomPreset = getIntegralFunction(bottomId);
  const valid = to - from >= 0.2;

  const difference = useMemo(
    () => subtractPolynomials(topPreset.coefficients, bottomPreset.coefficients),
    [topPreset, bottomPreset],
  );
  const result = useMemo(
    () => (valid ? areaBetween(topPreset.coefficients, bottomPreset.coefficients, from, to) : null),
    [topPreset, bottomPreset, from, to, valid],
  );
  const report = useMemo(
    () => (valid ? newtonLeibnizReport(difference, from, to, definition.variable) : null),
    [difference, from, to, valid, definition.variable],
  );
  const allCrossings = useMemo(
    () => crossingPoints(topPreset.coefficients, bottomPreset.coefficients, -SEARCH_WINDOW, SEARCH_WINDOW),
    [topPreset, bottomPreset],
  );

  const parsedAnswer = parseAnswer(answer);
  const answerReady = parsedAnswer !== null && valid;
  const correct = answerReady && result !== null && Math.abs(parsedAnswer - result.area) < TOLERANCE;
  const reveal = !challenge || checked;

  const invalidate = () => setChecked(false);
  const useCrossings = () => {
    if (allCrossings.length < 2) return;
    const first = allCrossings[0]!;
    const last = allCrossings.at(-1)!;
    invalidate();
    setFrom(roundTo(clamp(first, -BOUND_LIMIT, BOUND_LIMIT), 0.001));
    setTo(roundTo(clamp(last, -BOUND_LIMIT, BOUND_LIMIT), 0.001));
  };

  const reset = () => {
    setTopId(defaultTop);
    setBottomId(defaultBottom);
    setFrom(defaultFrom);
    setTo(defaultTo);
    setAnswer('');
    setChecked(false);
  };

  const resultBlock = (() => {
    if (!valid || result === null || report === null) {
      return {
        symbol: '!',
        headline: 'Верхний предел должен быть больше нижнего.',
        detail: 'Сделай b больше a хотя бы на 0,2 — иначе фигуры нет.',
      };
    }
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: `Вычисли ${definition.quantity.toLowerCase()} сам.`,
        detail: 'Найди разность функций, её первообразную и подставь пределы. Числа появятся после нажатия «Проверить».',
      };
    }
    if (challenge && checked) {
      return {
        symbol: correct ? '✓' : '×',
        headline: correct
          ? `Верно: ${numberText(result.area)}.`
          : `Точный ответ: ${report.result}, то есть ${numberText(result.area)}.`,
        detail: result.intersections.length > 0
          ? 'Графики пересекаются внутри отрезка, поэтому фигура состоит из нескольких кусков и площади складываются по модулю.'
          : `Разность равна ${report.integrand}, её первообразная — ${report.antiderivative}.`,
      };
    }
    return {
      symbol: '∫',
      headline: `${definition.quantity} равна ${report.result}${result.area !== Math.abs(result.signed) ? ` (по кускам: ${numberText(result.area)})` : ''}.`,
      detail: result.intersections.length > 0
        ? `Внутри отрезка есть пересечение при ${definition.variable} = ${result.intersections.map((value) => numberText(value)).join('; ')}: интеграл разности равен ${numberText(result.signed)}, а площадь — ${numberText(result.area)}.`
        : `Интеграл разности сразу даёт площадь: на всём отрезке один график лежит выше другого.`,
    };
  })();

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">{definition.eyebrow}</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>{definition.title}</h3>
          <p>{definition.intro}</p>
        </div>
        <span className="dm-lab__badge">F(b) − F(a)</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-lab__controls">
          <div className="dm-field">
            <label htmlFor={`${labId}-top`}>{definition.upperLabel}</label>
            <select
              id={`${labId}-top`}
              value={topId}
              onChange={(event) => { invalidate(); setTopId(event.target.value); }}
            >
              {INTEGRAL_FUNCTIONS.map((item) => (
                <option value={item.id} key={item.id}>{item.formula}</option>
              ))}
            </select>
            <small>График этой функции рисуется сплошной линией.</small>
          </div>
          <div className="dm-field">
            <label htmlFor={`${labId}-bottom`}>{definition.lowerLabel}</label>
            <select
              id={`${labId}-bottom`}
              value={bottomId}
              onChange={(event) => { invalidate(); setBottomId(event.target.value); }}
            >
              {INTEGRAL_FUNCTIONS.map((item) => (
                <option value={item.id} key={item.id}>{item.formula}</option>
              ))}
            </select>
            <small>Значение «0» — это ось абсцисс: получится площадь под графиком.</small>
          </div>
          <BoundField
            id={`${labId}-from`}
            label={`Нижний предел a`}
            hint="От −8 до 8."
            value={from}
            onChange={(value) => { invalidate(); setFrom(value); }}
          />
          <BoundField
            id={`${labId}-to`}
            label={`Верхний предел b`}
            hint="Должен быть больше a хотя бы на 0,2."
            value={to}
            onChange={(value) => { invalidate(); setTo(value); }}
          />
        </div>

        <div className="dm-geometry-example-switch">
          <span>
            {allCrossings.length === 0
              ? 'Эти графики не пересекаются: границы фигуры задаёшь ты сам.'
              : `Графики пересекаются при ${definition.variable} = ${allCrossings.map((value) => numberText(value)).join('; ')}.`}
          </span>
          <button
            className="dm-button dm-button--secondary"
            type="button"
            disabled={allCrossings.length < 2}
            onClick={useCrossings}
          >
            Взять пределы по пересечениям
          </button>
        </div>

        {valid && result !== null && report !== null && (
          <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый рисунок фигуры между графиками" tabIndex={0}>
            <AreaPicture
              id={`${labId}-picture`}
              top={topPreset.coefficients}
              bottom={bottomPreset.coefficients}
              topFormula={topPreset.formula}
              bottomFormula={bottomPreset.formula}
              from={from}
              to={to}
              pieces={result.pieces}
              variable={definition.variable}
              showValue={reveal}
              area={result.area}
            />
          </div>
        )}

        {challenge && (
          <div className="dm-geometry-answer-grid">
            <div className="dm-field dm-geometry-answer-field">
              <label htmlFor={`${labId}-answer`}>{definition.quantity}</label>
              <input
                id={`${labId}-answer`}
                type="text"
                inputMode="decimal"
                value={answer}
                onChange={(event) => {
                  const raw = event.target.value.slice(0, 24);
                  if (!ANSWER_DRAFT.test(raw)) return;
                  setAnswer(raw);
                  setChecked(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (answerReady) setChecked(true);
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setAnswer('');
                    setChecked(false);
                  }
                }}
              />
              <small>Можно написать дробью: 9/2 или 4,5.</small>
            </div>
            <button className="dm-button" type="button" disabled={!answerReady} onClick={() => setChecked(true)}>
              Проверить
            </button>
          </div>
        )}

        {reveal && valid && report !== null && result !== null && (
          <ol className="dm-signed-route-list">
            <li>
              <span aria-hidden="true">1</span>
              <p>
                <strong>Разность: f({definition.variable}) − g({definition.variable}) = {report.integrand}</strong>
                <small>Высота вертикального отрезка внутри фигуры.</small>
              </p>
            </li>
            <li>
              <span aria-hidden="true">2</span>
              <p>
                <strong>Первообразная: F({definition.variable}) = {report.antiderivative}</strong>
                <small>Постоянную C можно не писать: при вычитании она исчезнет.</small>
              </p>
            </li>
            <li>
              <span aria-hidden="true">3</span>
              <p>
                <strong>F({numberText(to)}) = {report.upperValue}, F({numberText(from)}) = {report.lowerValue}</strong>
                <small>Подставляем сначала верхний предел, потом нижний.</small>
              </p>
            </li>
            <li>
              <span aria-hidden="true">4</span>
              <p>
                <strong>F(b) − F(a) = {report.result}</strong>
                <small>
                  {result.intersections.length > 0
                    ? 'Это интеграл разности со знаком; площадь фигуры считается по кускам.'
                    : 'Разность неотрицательна на всём отрезке, поэтому это и есть площадь.'}
                </small>
              </p>
            </li>
          </ol>
        )}

        {reveal && valid && result !== null && result.pieces.length > 1 && (
          <div className="dm-ratio-table-wrap">
            <table className="dm-ratio-table">
              <caption>Куски фигуры между точками пересечения</caption>
              <thead>
                <tr>
                  <th scope="col">Отрезок</th>
                  <th scope="col">Сверху</th>
                  <th scope="col">Площадь куска</th>
                </tr>
              </thead>
              <tbody>
                {result.pieces.map((piece) => (
                  <tr key={`${piece.from}-${piece.to}`}>
                    <td>[{numberText(piece.from)}; {numberText(piece.to)}]</td>
                    <td>{piece.upper === 'first' ? topPreset.formula : bottomPreset.formula}</td>
                    <td>{numberText(piece.area)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{resultBlock.symbol}</span>
          <p>
            <strong>{resultBlock.headline}</strong>
            <small>{resultBlock.detail}</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>
          ↺ Вернуть пример
        </button>
      </div>
    </section>
  );
}
