import { useEffect, useId, useMemo, useState } from 'react';
import {
  INTEGRAL_FUNCTIONS,
  RIEMANN_RULES,
  RIEMANN_RULE_LABELS,
  curveExtremes,
  definiteIntegralExact,
  exactText,
  getIntegralFunction,
  numberText,
  riemannConvergence,
  riemannSummary,
  samplePolynomial,
  type RiemannRule,
} from '../lib/integrals';

const DECIMAL_DRAFT = /^[-−]?\d*(?:[.,]\d*)?$/;
const PART_CHOICES: readonly number[] = [1, 2, 4, 8, 16, 32, 64, 128];
const CONVERGENCE_PARTS: readonly number[] = [2, 4, 8, 16, 32, 64];
const BOUND_LIMIT = 8;
const CHOICES = INTEGRAL_FUNCTIONS.filter((preset) => preset.id !== 'zero');

export interface IntegRiemannLabProps {
  /** Идентификатор подынтегральной функции из INTEGRAL_FUNCTIONS. */
  initialFunction?: string;
  /** Нижний предел интегрирования. */
  initialFrom?: number;
  /** Верхний предел интегрирования. */
  initialTo?: number;
  /** Начальное число прямоугольников. */
  initialParts?: number;
  /** Правило выбора точки: по левому краю, по правому или по середине. */
  initialRule?: RiemannRule;
}

function parseDecimal(raw: string): number | null {
  const normalized = raw.trim().replace('−', '-').replace(',', '.');
  if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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

  const commit = (raw: string) => {
    const parsed = parseDecimal(raw);
    const next = parsed === null ? value : roundTo(clamp(parsed, -BOUND_LIMIT, BOUND_LIMIT));
    setDraft(numberText(next));
    onChange(next);
  };

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
        onBlur={(event) => commit(event.currentTarget.value)}
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
  readonly coefficients: readonly number[];
  readonly formula: string;
  readonly from: number;
  readonly to: number;
  readonly parts: number;
  readonly rule: RiemannRule;
  readonly rectangles: ReturnType<typeof riemannSummary>['rectangles'];
  readonly sum: number;
  readonly exact: number;
}

/** Рисунок строится по вычисленным числам: масштаб общий для кривой и прямоугольников. */
function RiemannPicture({ id, coefficients, formula, from, to, parts, rule, rectangles, sum, exact }: PictureProps) {
  const left = 64;
  const top = 24;
  const width = 632;
  const height = 392;

  const span = to - from;
  const xMin = from - span * 0.05;
  const xMax = to + span * 0.05;
  const extremes = curveExtremes(coefficients, from, to, 401);
  const rawMin = Math.min(0, extremes.min);
  const rawMax = Math.max(0, extremes.max);
  const padding = Math.max((rawMax - rawMin) * 0.12, 0.5);
  const yMin = rawMin - padding;
  const yMax = rawMax + padding;

  const px = (value: number) => left + ((value - xMin) / (xMax - xMin)) * width;
  const py = (value: number) => top + ((yMax - value) / (yMax - yMin)) * height;

  const curve = useMemo(() => samplePolynomial(coefficients, from, to, 241), [coefficients, from, to]);
  const xTicks = useMemo(() => niceTicks(xMin, xMax), [xMin, xMax]);
  const yTicks = useMemo(() => niceTicks(yMin, yMax), [yMin, yMax]);
  const axisY = py(clamp(0, yMin, yMax));
  const axisX = px(clamp(0, xMin, xMax));
  const strokeWidth = parts > 48 ? 0.4 : parts > 16 ? 1.2 : 2.4;

  return (
    <svg className="dm-signed-plane" viewBox="0 0 720 470" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{`Ступенчатая фигура из ${parts} прямоугольников под графиком ${formula}`}</title>
      <desc id={`${id}-desc`}>
        Отрезок от {numberText(from)} до {numberText(to)} разбит на {parts} равных частей шириной {numberText((to - from) / parts)}.
        Высота каждого прямоугольника измерена {RIEMANN_RULE_LABELS[rule]} частичного отрезка.
        Сумма площадей равна {numberText(sum)}, точное значение интеграла равно {numberText(exact)},
        разница составляет {numberText(Math.abs(sum - exact))}. Масштаб по обеим осям постоянный.
      </desc>

      <rect className="dm-signed-plane__background" x={left} y={top} width={width} height={height} rx="12" />

      <g className="dm-signed-plane__grid" aria-hidden="true">
        {xTicks.map((tick) => (
          <line key={`x-${tick}`} x1={px(tick)} y1={top} x2={px(tick)} y2={top + height} />
        ))}
        {yTicks.map((tick) => (
          <line key={`y-${tick}`} x1={left} y1={py(tick)} x2={left + width} y2={py(tick)} />
        ))}
      </g>

      <g aria-hidden="true">
        {rectangles.map((rectangle) => {
          const barTop = Math.min(py(rectangle.height), axisY);
          const barHeight = Math.abs(py(rectangle.height) - axisY);
          return (
            <rect
              key={rectangle.index}
              className={rectangle.height >= 0
                ? 'dm-geometry-grid-cell dm-geometry-grid-cell--full'
                : 'dm-geometry-grid-cell dm-geometry-grid-cell--partial'}
              style={{ strokeWidth }}
              x={px(rectangle.from)}
              y={barTop}
              width={Math.max(px(rectangle.to) - px(rectangle.from), 0.4)}
              height={Math.max(barHeight, 0.4)}
            />
          );
        })}
      </g>

      <g className="dm-signed-plane__reflection-guides" aria-hidden="true">
        <line x1={px(from)} y1={top} x2={px(from)} y2={top + height} />
        <line x1={px(to)} y1={top} x2={px(to)} y2={top + height} />
      </g>

      <g aria-hidden="true">
        <line className="dm-signed-plane__axis" x1={left} y1={axisY} x2={left + width} y2={axisY} />
        <line className="dm-signed-plane__axis" x1={axisX} y1={top} x2={axisX} y2={top + height} />
      </g>

      <g className="dm-signed-plane__route-segment" aria-hidden="true">
        {curve.slice(1).map((point, index) => {
          const previous = curve[index]!;
          return (
            <line
              key={`curve-${index}`}
              x1={px(previous.x)}
              y1={py(previous.y)}
              x2={px(point.x)}
              y2={py(point.y)}
            />
          );
        })}
      </g>

      <g className="dm-signed-plane__labels" aria-hidden="true">
        {xTicks.map((tick) => (
          <text key={`xl-${tick}`} x={px(tick)} y={Math.min(axisY + 18, top + height + 18)}>{numberText(tick)}</text>
        ))}
        {yTicks.filter((tick) => tick !== 0).map((tick) => (
          <text key={`yl-${tick}`} x={left - 12} y={py(tick) + 4}>{numberText(tick)}</text>
        ))}
        <text x={left + width - 6} y={axisY - 12}>x</text>
        <text x={axisX + 16} y={top + 14}>y</text>
        <text x={px(from)} y={top + height + 34}>a = {numberText(from)}</text>
        <text x={px(to)} y={top + height + 34}>b = {numberText(to)}</text>
      </g>
    </svg>
  );
}

/** Подбирает шаг сетки так, чтобы подписей было немного и они были круглыми. */
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

export default function IntegRiemannLab({
  initialFunction = 'square',
  initialFrom,
  initialTo,
  initialParts,
  initialRule = 'left',
}: IntegRiemannLabProps) {
  const reactId = useId();
  const labId = `integ-riemann-${reactId.replace(/:/g, '')}`;

  const defaultFunctionId = CHOICES.some((preset) => preset.id === initialFunction) ? initialFunction : 'square';
  const defaultFrom = safeBound(initialFrom, 0);
  const defaultTo = safeBound(initialTo, defaultFrom + 2);
  const defaultParts = initialParts !== undefined && PART_CHOICES.includes(initialParts) ? initialParts : 4;
  const defaultRule: RiemannRule = RIEMANN_RULES.includes(initialRule) ? initialRule : 'left';

  const [functionId, setFunctionId] = useState(defaultFunctionId);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [parts, setParts] = useState(defaultParts);
  const [rule, setRule] = useState<RiemannRule>(defaultRule);

  const preset = getIntegralFunction(functionId);
  const valid = to - from >= 0.2;

  const summary = useMemo(
    () => (valid ? riemannSummary(preset.coefficients, from, to, parts, rule) : null),
    [preset, from, to, parts, rule, valid],
  );
  const convergence = useMemo(
    () => (valid ? riemannConvergence(preset.coefficients, from, to, CONVERGENCE_PARTS, rule) : []),
    [preset, from, to, rule, valid],
  );
  const exactValue = valid ? exactText(definiteIntegralExact(preset.coefficients, from, to)) : '—';

  const reset = () => {
    setFunctionId(defaultFunctionId);
    setFrom(defaultFrom);
    setTo(defaultTo);
    setParts(defaultParts);
    setRule(defaultRule);
  };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория площади</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Прямоугольники сгущаются — сумма сходится</h3>
          <p>
            Криволинейную трапецию заменяем ступенчатой фигурой. Меняй число частей и следи за последним
            столбцом таблицы: погрешность уменьшается, а не «дрожит».
          </p>
        </div>
        <span className="dm-lab__badge">Σ f(xᵢ)·h</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-lab__controls">
          <div className="dm-field">
            <label htmlFor={`${labId}-function`}>Подынтегральная функция</label>
            <select
              id={`${labId}-function`}
              value={functionId}
              onChange={(event) => setFunctionId(event.target.value)}
            >
              {CHOICES.map((item) => (
                <option value={item.id} key={item.id}>{item.title}: f(x) = {item.formula}</option>
              ))}
            </select>
            <small>Все функции — многочлены, поэтому точное значение известно и можно честно сравнивать.</small>
          </div>
          <BoundField
            id={`${labId}-from`}
            label="Нижний предел a"
            hint="От −8 до 8; шаг 0,1."
            value={from}
            onChange={setFrom}
          />
          <BoundField
            id={`${labId}-to`}
            label="Верхний предел b"
            hint="Должен быть больше a хотя бы на 0,2."
            value={to}
            onChange={setTo}
          />
        </div>

        <div className="dm-geometry-tabs" role="group" aria-label="Точка, по которой измеряется высота">
          {RIEMANN_RULES.map((item) => (
            <button
              type="button"
              key={item}
              className={rule === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
              aria-pressed={rule === item}
              onClick={() => setRule(item)}
            >
              Высота {RIEMANN_RULE_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="dm-geometry-preset-buttons" role="group" aria-label="Число прямоугольников">
          {PART_CHOICES.map((item) => (
            <button
              type="button"
              key={item}
              className={parts === item ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'}
              aria-pressed={parts === item}
              onClick={() => setParts(item)}
            >
              n = {item}
            </button>
          ))}
        </div>

        {valid && summary !== null ? (
          <>
            <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый рисунок ступенчатой фигуры" tabIndex={0}>
              <RiemannPicture
                id={`${labId}-picture`}
                coefficients={preset.coefficients}
                formula={preset.formula}
                from={from}
                to={to}
                parts={parts}
                rule={rule}
                rectangles={summary.rectangles}
                sum={summary.sum}
                exact={summary.exact}
              />
            </div>

            <div className="dm-ratio-table-wrap">
              <table className="dm-ratio-table">
                <caption>Сгущение разбиения при высоте {RIEMANN_RULE_LABELS[rule]}</caption>
                <thead>
                  <tr>
                    <th scope="col">Частей n</th>
                    <th scope="col">Ширина h</th>
                    <th scope="col">Сумма</th>
                    <th scope="col">|Сумма − точное|</th>
                  </tr>
                </thead>
                <tbody>
                  {convergence.map((row) => (
                    <tr className={row.parts === parts ? 'dm-ratio-table__current' : ''} key={row.parts}>
                      <td>{row.parts}</td>
                      <td>{numberText(row.width)}</td>
                      <td>{numberText(row.sum)}</td>
                      <td>{numberText(row.error)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="dm-signed-reflection-cards">
              <div>
                <span>Сумма прямоугольников</span>
                <strong>{numberText(summary.sum)}</strong>
                <small>{parts} шт. шириной {numberText(summary.width)}.</small>
              </div>
              <div>
                <span>Точное значение</span>
                <strong>{exactValue}</strong>
                <small>Оно найдено через первообразную, а не измерено по рисунку.</small>
              </div>
              <div>
                <span>Погрешность</span>
                <strong>{numberText(summary.error)}</strong>
                <small>Стремится к нулю при увеличении n.</small>
              </div>
            </div>

            <div className="dm-result" aria-live="polite" aria-atomic="true">
              <span className="dm-result__symbol" aria-hidden="true">Σ</span>
              <p>
                <strong>
                  При n = {parts} сумма равна {numberText(summary.sum)}, точное значение — {exactValue}.
                </strong>
                <small>
                  {summary.error === 0
                    ? 'Здесь приближение совпало с точным значением: для этой функции выбранное правило не даёт ошибки.'
                    : `Разница ${numberText(summary.error)}. Удвой n — и она уменьшится примерно вдвое для крайних точек и вчетверо для середины.`}
                </small>
              </p>
            </div>
          </>
        ) : (
          <div className="dm-result" aria-live="polite" aria-atomic="true">
            <span className="dm-result__symbol" aria-hidden="true">!</span>
            <p>
              <strong>Верхний предел должен быть больше нижнего.</strong>
              <small>Сделай b хотя бы на 0,2 больше, чем a — иначе отрезок нечего делить.</small>
            </p>
          </div>
        )}

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>
          ↺ Вернуть пример
        </button>
      </div>
    </section>
  );
}
