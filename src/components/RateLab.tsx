import { useEffect, useId, useMemo, useState } from 'react';

const DECIMAL_DRAFT = /^\d*(?:[.,]\d*)?$/;

export type RateContext = 'travel' | 'shopping';

interface ContextDefinition {
  label: string;
  xName: string;
  xUnit: string;
  yName: string;
  yUnit: string;
  rateName: string;
  rateUnit: string;
  defaultRate: number;
  defaultX: number;
  maxRate: number;
  maxX: number;
  graphMaxX: number;
  graphMaxY: number;
}

const CONTEXTS: Record<RateContext, ContextDefinition> = {
  travel: {
    label: 'Равномерное движение',
    xName: 'Время',
    xUnit: 'ч',
    yName: 'Расстояние',
    yUnit: 'км',
    rateName: 'Скорость',
    rateUnit: 'км/ч',
    defaultRate: 60,
    defaultX: 2.5,
    maxRate: 120,
    maxX: 6,
    graphMaxX: 6,
    graphMaxY: 720,
  },
  shopping: {
    label: 'Покупка на вес',
    xName: 'Масса',
    xUnit: 'кг',
    yName: 'Стоимость',
    yUnit: '₽',
    rateName: 'Цена',
    rateUnit: '₽/кг',
    defaultRate: 240,
    defaultX: 1.5,
    maxRate: 500,
    maxX: 5,
    graphMaxX: 5,
    graphMaxY: 2500,
  },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, precision = 4) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function parseDecimal(rawValue: string) {
  const normalized = rawValue.trim().replace(',', '.');
  if (normalized === '' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeDecimal(value: number | undefined, fallback: number, minimum: number, maximum: number) {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return round(clamp(value, minimum, maximum), 2);
}

function formatNumber(value: number) {
  return String(round(value)).replace('.', ',');
}

interface DecimalFieldProps {
  id: string;
  label: string;
  unit: string;
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
}

function DecimalField({ id, label, unit, value, minimum, maximum, onChange }: DecimalFieldProps) {
  const hintId = `${id}-hint`;
  const [draft, setDraft] = useState(formatNumber(value));

  useEffect(() => setDraft(formatNumber(value)), [value]);

  const edit = (rawValue: string) => {
    if (!DECIMAL_DRAFT.test(rawValue)) return;
    setDraft(rawValue);
    const parsed = parseDecimal(rawValue);
    if (parsed !== null && parsed >= minimum && parsed <= maximum) onChange(parsed);
  };

  const commit = () => {
    const parsed = parseDecimal(draft);
    const next = parsed === null ? value : round(clamp(parsed, minimum, maximum), 2);
    setDraft(formatNumber(next));
    onChange(next);
  };

  return (
    <div className="dm-field dm-ratio-field">
      <label htmlFor={id}>
        {label}, {unit} <span className="dm-field__value">{formatNumber(value)}</span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-describedby={hintId}
        onChange={(event) => edit(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      <small id={hintId}>От {formatNumber(minimum)} до {formatNumber(maximum)}; можно вводить десятичную дробь.</small>
    </div>
  );
}

export interface RateLabProps {
  initialContext?: RateContext;
  initialRate?: number;
  initialX?: number;
}

export default function RateLab({
  initialContext = 'travel',
  initialRate,
  initialX,
}: RateLabProps) {
  const labId = useId();
  const safeInitialContext: RateContext = initialContext in CONTEXTS ? initialContext : 'travel';
  const initialDefinition = CONTEXTS[safeInitialContext];
  const [contextKey, setContextKey] = useState<RateContext>(safeInitialContext);
  const [rate, setRate] = useState(() => safeDecimal(initialRate, initialDefinition.defaultRate, 0.1, initialDefinition.maxRate));
  const [x, setX] = useState(() => safeDecimal(initialX, initialDefinition.defaultX, 0.1, initialDefinition.maxX));
  const context = CONTEXTS[contextKey];
  const y = round(rate * x);

  const tableValues = useMemo(() => {
    const candidates = [0, 1, 2, 3, x].map((value) => round(value));
    return candidates
      .filter((value, index) => candidates.findIndex((candidate) => candidate === value) === index)
      .sort((left, right) => left - right);
  }, [x]);

  const changeContext = (nextContext: RateContext) => {
    const next = CONTEXTS[nextContext];
    setContextKey(nextContext);
    setRate(next.defaultRate);
    setX(next.defaultX);
  };

  const plotLeft = 58;
  const plotTop = 24;
  const plotWidth = 422;
  const plotHeight = 210;
  const chartMaxX = context.graphMaxX;
  const chartMaxY = context.graphMaxY;
  const pointX = plotLeft + (x / chartMaxX) * plotWidth;
  const pointY = plotTop + plotHeight - (y / chartMaxY) * plotHeight;
  const unitX = plotLeft + plotWidth / chartMaxX;
  const unitY = plotTop + plotHeight - (rate / chartMaxY) * plotHeight;
  const unitIsVisible = chartMaxX >= 1 && rate <= chartMaxY;
  const lineEndXValue = Math.min(chartMaxX, chartMaxY / rate);
  const lineEndYValue = rate * lineEndXValue;
  const lineEndX = plotLeft + (lineEndXValue / chartMaxX) * plotWidth;
  const lineEndY = plotTop + plotHeight - (lineEndYValue / chartMaxY) * plotHeight;

  return (
    <section className="dm-lab dm-ratio-rate-lab not-content" aria-labelledby={`${labId}-title`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория пропорциональности</p>
          <h3 className="dm-lab__title" id={`${labId}-title`}>Как растёт величина y = kx</h3>
          <p>Меняй единичную ставку и аргумент: таблица и график описывают одну зависимость.</p>
        </div>
        <span className="dm-lab__badge">y = kx</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-ratio-context">
          <label htmlFor={`${labId}-context`}>Сюжет</label>
          <select
            id={`${labId}-context`}
            value={contextKey}
            onChange={(event) => changeContext(event.target.value as RateContext)}
          >
            {Object.entries(CONTEXTS).map(([key, definition]) => (
              <option value={key} key={key}>{definition.label}</option>
            ))}
          </select>
        </div>

        <div className="dm-lab__controls dm-ratio-controls">
          <DecimalField
            id={`${labId}-rate`}
            label={context.rateName}
            unit={context.rateUnit}
            value={rate}
            minimum={0.1}
            maximum={context.maxRate}
            onChange={setRate}
          />
          <DecimalField
            id={`${labId}-x`}
            label={context.xName}
            unit={context.xUnit}
            value={x}
            minimum={0.1}
            maximum={context.maxX}
            onChange={setX}
          />
        </div>

        <div className="dm-ratio-model-grid">
          <div className="dm-ratio-table-wrap">
            <table className="dm-ratio-table">
              <caption>Таблица значений для {context.yName.toLowerCase()}</caption>
              <thead>
                <tr>
                  <th scope="col">{context.xName}, {context.xUnit}</th>
                  <th scope="col">{context.yName}, {context.yUnit}</th>
                </tr>
              </thead>
              <tbody>
                {tableValues.map((tableX) => (
                  <tr className={tableX === x ? 'dm-ratio-table__current' : ''} key={tableX}>
                    <td>{formatNumber(tableX)}</td>
                    <td>{formatNumber(rate * tableX)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="dm-ratio-unit-rate">
              <strong>Единичная ставка:</strong> за 1 {context.xUnit} получается {formatNumber(rate)} {context.yUnit}.
            </p>
          </div>

          <svg
            className="dm-ratio-graph"
            viewBox="0 0 520 290"
            role="img"
            aria-labelledby={`${labId}-graph-title ${labId}-graph-desc`}
          >
            <title id={`${labId}-graph-title`}>График прямой пропорциональности</title>
            <desc id={`${labId}-graph-desc`}>
              Прямая проходит через начало координат и точку {formatNumber(x)} {context.xUnit}, {formatNumber(y)} {context.yUnit}. Коэффициент пропорциональности равен {formatNumber(rate)} {context.rateUnit}.
              Шкалы осей остаются неизменными при изменении параметров этого сюжета.
            </desc>
            {Array.from({ length: 5 }, (_, index) => {
              const gridX = plotLeft + (plotWidth * index) / 4;
              const gridY = plotTop + (plotHeight * index) / 4;
              return (
                <g aria-hidden="true" key={index}>
                  <line className="dm-ratio-graph__grid" x1={gridX} y1={plotTop} x2={gridX} y2={plotTop + plotHeight} />
                  <line className="dm-ratio-graph__grid" x1={plotLeft} y1={gridY} x2={plotLeft + plotWidth} y2={gridY} />
                </g>
              );
            })}
            <g aria-hidden="true">
              <line className="dm-ratio-graph__axis" x1={plotLeft} y1={plotTop + plotHeight} x2={plotLeft + plotWidth + 8} y2={plotTop + plotHeight} />
              <line className="dm-ratio-graph__axis" x1={plotLeft} y1={plotTop + plotHeight} x2={plotLeft} y2={plotTop - 8} />
              <line className="dm-ratio-graph__line" x1={plotLeft} y1={plotTop + plotHeight} x2={lineEndX} y2={lineEndY} />
              {unitIsVisible && <circle className="dm-ratio-graph__unit" cx={unitX} cy={unitY} r="5" />}
              <circle className="dm-ratio-graph__point" cx={pointX} cy={pointY} r="7" />
              <line className="dm-ratio-graph__guide" x1={pointX} y1={pointY} x2={pointX} y2={plotTop + plotHeight} />
              <line className="dm-ratio-graph__guide" x1={plotLeft} y1={pointY} x2={pointX} y2={pointY} />
              <text className="dm-ratio-graph__label" x={plotLeft - 8} y={plotTop + plotHeight + 18}>0</text>
              <text className="dm-ratio-graph__label" x={plotLeft + plotWidth} y={plotTop + plotHeight + 18} textAnchor="end">{formatNumber(chartMaxX)}</text>
              <text className="dm-ratio-graph__label" x={plotLeft - 8} y={plotTop + 5} textAnchor="end">{formatNumber(chartMaxY)}</text>
              <text className="dm-ratio-graph__axis-title" x={plotLeft + plotWidth} y={278} textAnchor="end">x, {context.xUnit}</text>
              <text className="dm-ratio-graph__axis-title" x={plotLeft + 6} y={16}>y, {context.yUnit}</text>
            </g>
          </svg>
          <p className="dm-ratio-graph-note">Оси сохраняют один масштаб: изменение наклона показывает изменение коэффициента k.</p>
        </div>

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">×</span>
          <p>
            <strong>{formatNumber(x)} {context.xUnit} · {formatNumber(rate)} {context.rateUnit} = {formatNumber(y)} {context.yUnit}.</strong>
            <small>Отношение y : x постоянно и равно k = {formatNumber(rate)} {context.rateUnit}; поэтому это прямая пропорциональность.</small>
          </p>
        </div>
      </div>
    </section>
  );
}
