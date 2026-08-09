import { useId, useMemo, useState } from 'react';
import { axisScale, formatMean, pieSectors, sectorPath, sumValues } from '../lib/dataStats';

export type DataChartMode = 'bar' | 'pie' | 'mean';

export interface DataChartItem {
  label: string;
  value: number;
}

export interface DataChartLabProps {
  mode?: DataChartMode;
  initialItems?: DataChartItem[];
  categoryName?: string;
  valueName?: string;
  unitLabel?: string;
  challenge?: boolean;
}

interface Row {
  label: string;
  draft: string;
}

const MODES: readonly DataChartMode[] = ['bar', 'pie', 'mean'];
const MIN_ROWS = 2;
const MAX_ROWS = 6;
const MAX_VALUE = 999;
const DIGITS_DRAFT = /^\d{0,3}$/;

/** Цвета категорий берём из палитры книги: они переопределяются в тёмной теме. */
const CATEGORY_COLORS: readonly string[] = [
  'var(--dm-violet)',
  'var(--dm-teal)',
  'var(--dm-gold)',
  'var(--dm-coral)',
  'var(--dm-violet-dark)',
  'var(--dm-muted)',
];

const DEFAULT_ITEMS: Readonly<Record<DataChartMode, readonly DataChartItem[]>> = {
  bar: [
    { label: 'Футбол', value: 9 },
    { label: 'Волейбол', value: 6 },
    { label: 'Баскетбол', value: 5 },
    { label: 'Плавание', value: 3 },
    { label: 'Шахматы', value: 2 },
  ],
  pie: [
    { label: 'Сон', value: 9 },
    { label: 'Школа', value: 7 },
    { label: 'Уроки дома', value: 4 },
    { label: 'Кружок', value: 2 },
    { label: 'Свободное', value: 2 },
  ],
  mean: [
    { label: 'Пн', value: 12 },
    { label: 'Вт', value: 15 },
    { label: 'Ср', value: 11 },
    { label: 'Чт', value: 14 },
    { label: 'Пт', value: 13 },
  ],
};

const HEADINGS: Readonly<Record<DataChartMode, { eyebrow: string; title: string; lead: string; badge: string }>> = {
  bar: {
    eyebrow: 'Лаборатория данных',
    title: 'От таблицы к столбчатой диаграмме',
    lead: 'Меняй числа в таблице: высоты столбиков и цена деления шкалы пересчитываются честно.',
    badge: 'таблица → столбики',
  },
  pie: {
    eyebrow: 'Лаборатория данных',
    title: 'Круг делится на доли',
    lead: 'Каждый сектор получает свой угол: доля от целого, умноженная на 360°.',
    badge: 'доля · 360°',
  },
  mean: {
    eyebrow: 'Лаборатория данных',
    title: 'Среднее выравнивает столбики',
    lead: 'Сумма делится поровну между наблюдениями: пунктир показывает уровень, на котором столбики сравнялись бы.',
    badge: 'сумма : количество',
  },
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function toValue(draft: string): number {
  const parsed = Number.parseInt(draft, 10);
  return Number.isFinite(parsed) ? clamp(parsed, 0, MAX_VALUE) : 0;
}

/** Русская запись числа: десятичная запятая и не более двух знаков после неё. */
function ru(value: number, digits = 2): string {
  const factor = 10 ** digits;
  const rounded = Math.round((value + Number.EPSILON * Math.sign(value || 1)) * factor) / factor;
  return String(rounded).replace('.', ',').replace('-', '−');
}

function safeMode(value: DataChartMode | undefined): DataChartMode {
  return value !== undefined && MODES.includes(value) ? value : 'bar';
}

function toRows(items: readonly DataChartItem[]): Row[] {
  return items
    .slice(0, MAX_ROWS)
    .map((item, index) => ({
      label: String(item.label ?? `Категория ${index + 1}`).slice(0, 18),
      draft: String(clamp(Math.round(Number(item.value) || 0), 0, MAX_VALUE)),
    }));
}

function parseAnswer(text: string): number | null {
  const normalized = text.trim().replace(',', '.').replace('−', '-');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function DataChartLab({
  mode,
  initialItems,
  categoryName = 'Категория',
  valueName = 'Значение',
  unitLabel = '',
  challenge = false,
}: DataChartLabProps) {
  const reactId = useId();
  const labId = `data-chart-${reactId.replace(/:/g, '')}`;
  const activeMode = safeMode(mode);
  const heading = HEADINGS[activeMode];
  const defaultRows = useMemo(() => {
    const source = initialItems && initialItems.length >= MIN_ROWS ? initialItems : DEFAULT_ITEMS[activeMode];
    return toRows(source);
  }, [activeMode, initialItems]);

  const [rows, setRows] = useState<Row[]>(defaultRows);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const values = rows.map((row) => toValue(row.draft));
  const total = sumValues(values);
  const maximum = Math.max(...values, 0);
  const scale = axisScale(maximum);
  const meanValue = total / values.length;
  const meanText = formatMean(values);
  const positive = total > 0;
  const sectors = positive ? pieSectors(values) : [];
  const reveal = !challenge || checked;

  const invalidate = () => setChecked(false);
  const editLabel = (index: number, text: string) => {
    invalidate();
    setRows((current) => current.map((row, position) => (position === index ? { ...row, label: text.slice(0, 18) } : row)));
  };
  const editValue = (index: number, text: string) => {
    if (!DIGITS_DRAFT.test(text)) return;
    invalidate();
    setRows((current) => current.map((row, position) => (position === index ? { ...row, draft: text } : row)));
  };
  const addRow = () => {
    invalidate();
    setRows((current) => (current.length >= MAX_ROWS ? current : [...current, { label: `Категория ${current.length + 1}`, draft: '1' }]));
  };
  const removeRow = () => {
    invalidate();
    setRows((current) => (current.length <= MIN_ROWS ? current : current.slice(0, -1)));
  };
  const reset = () => {
    setRows(defaultRows);
    setAnswer('');
    setChecked(false);
  };

  const target = activeMode === 'mean' ? meanValue : activeMode === 'pie' ? (sectors[0]?.angle ?? 0) : total;
  const targetQuestion =
    activeMode === 'mean'
      ? 'Чему равно среднее арифметическое ряда?'
      : activeMode === 'pie'
        ? `Чему равен угол сектора «${rows[0]?.label ?? ''}» в градусах?`
        : 'Чему равна сумма всех значений?';
  const parsedAnswer = parseAnswer(answer);
  const answerCorrect = parsedAnswer !== null && Math.abs(parsedAnswer - target) < 0.05;

  // Разметка столбчатой диаграммы: одна и та же для режимов «столбики» и «среднее».
  const plotLeft = 54;
  const plotTop = 18;
  const plotWidth = 486;
  const plotHeight = 206;
  const baseLine = plotTop + plotHeight;
  const slot = plotWidth / values.length;
  const barWidth = Math.min(72, slot * 0.6);
  const tickCount = scale.axisMax / scale.step;
  const meanY = baseLine - (meanValue / scale.axisMax) * plotHeight;

  const pieRadius = 132;

  const result = (() => {
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: targetQuestion,
        detail: 'Сначала посчитай сам, запиши ответ и нажми «Проверить».',
      };
    }
    if (activeMode === 'mean') {
      return {
        symbol: challenge ? (answerCorrect ? '✓' : '×') : '≈',
        headline: `Среднее арифметическое: ${total} : ${values.length} = ${meanText}${unitLabel ? ` ${unitLabel}` : ''}.`,
        detail: 'Среднее — это уровень, на котором все столбики стали бы одинаковыми, а общая сумма не изменилась бы.',
      };
    }
    if (activeMode === 'pie') {
      return {
        symbol: challenge ? (answerCorrect ? '✓' : '×') : '◔',
        headline: positive
          ? `Целое равно ${total}${unitLabel ? ` ${unitLabel}` : ''}; сектор «${rows[0]?.label ?? ''}» получает ${ru(sectors[0]?.angle ?? 0, 1)}°.`
          : 'Пока все значения нулевые: круг делить не на что.',
        detail: 'Угол каждого сектора равен доле категории, умноженной на 360°; сумма всех углов всегда даёт полный круг.',
      };
    }
    return {
      symbol: challenge ? (answerCorrect ? '✓' : '×') : '▮',
      headline: `Всего ${total}${unitLabel ? ` ${unitLabel}` : ''}; самый высокий столбик — ${maximum}.`,
      detail: `Цена деления шкалы равна ${scale.step}, верхняя отметка оси — ${scale.axisMax}. Столбики стоят на общей нулевой линии, поэтому их высоты сравнимы.`,
    };
  })();

  return (
    <section className="dm-lab dm-ratio-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">{heading.eyebrow}</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>{heading.title}</h3>
          <p>{heading.lead}</p>
        </div>
        <span className="dm-lab__badge">{heading.badge}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-lab__controls dm-ratio-controls">
          {rows.map((row, index) => (
            <div className="dm-ratio-field" key={`${labId}-row-${index}`}>
              <p className="dm-ratio-field__heading">
                <span
                  className="dm-ratio-swatch"
                  style={{ color: CATEGORY_COLORS[index % CATEGORY_COLORS.length], background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                  aria-hidden="true"
                />
                Строка {index + 1}
              </p>
              <div className="dm-ratio-field__inputs">
                <div className="dm-field">
                  <label htmlFor={`${labId}-label-${index}`}>{categoryName}</label>
                  <input
                    id={`${labId}-label-${index}`}
                    type="text"
                    value={row.label}
                    maxLength={18}
                    onChange={(event) => editLabel(index, event.target.value)}
                  />
                </div>
                <div className="dm-field">
                  <label htmlFor={`${labId}-value-${index}`}>
                    {valueName} <span className="dm-field__value">{values[index]}</span>
                  </label>
                  <input
                    id={`${labId}-value-${index}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_VALUE}
                    step={1}
                    value={row.draft}
                    aria-describedby={`${labId}-value-hint-${index}`}
                    onChange={(event) => editValue(index, event.target.value)}
                  />
                  <small id={`${labId}-value-hint-${index}`}>Целое от 0 до {MAX_VALUE}{unitLabel ? `, ${unitLabel}` : ''}.</small>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="dm-nt-actions" role="group" aria-label="Изменить число строк таблицы">
          <button type="button" className="dm-button dm-button--secondary" onClick={addRow} disabled={rows.length >= MAX_ROWS}>
            Добавить строку
          </button>
          <button type="button" className="dm-button dm-button--secondary" onClick={removeRow} disabled={rows.length <= MIN_ROWS}>
            Убрать последнюю
          </button>
          <button type="button" className="dm-button dm-button--secondary" onClick={reset}>
            Сбросить пример
          </button>
        </div>

        {activeMode === 'pie' ? (
          <svg
            className="dm-ratio-graph"
            viewBox="0 0 320 320"
            role="img"
            aria-labelledby={`${labId}-pie-title ${labId}-pie-desc`}
          >
            <title id={`${labId}-pie-title`}>Круговая диаграмма из {rows.length} секторов</title>
            <desc id={`${labId}-pie-desc`}>
              {positive
                ? `Целое равно ${total}. ${sectors
                    .map((sector, index) => {
                      const head = `${rows[index]?.label ?? ''}: ${sector.value}, доля ${sector.fraction.numerator}/${sector.fraction.denominator}`;
                      return reveal ? `${head}, угол ${ru(sector.angle, 1)} градуса` : head;
                    })
                    .join('; ')}.`
                : 'Все значения равны нулю, поэтому круг не разделён на секторы.'}
            </desc>
            <g transform="translate(160 160)">
              <circle r={pieRadius} style={{ fill: 'var(--dm-surface)', stroke: 'var(--dm-line)', strokeWidth: 1 }} aria-hidden="true" />
              {positive &&
                sectors.map((sector, index) => (
                  <path
                    key={`${labId}-sector-${index}`}
                    d={sectorPath(pieRadius, sector.startAngle, sector.endAngle)}
                    style={{
                      fill: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                      stroke: 'var(--dm-surface)',
                      strokeWidth: 2,
                    }}
                    aria-hidden="true"
                  />
                ))}
              {positive &&
                reveal &&
                sectors.map((sector, index) => {
                  if (sector.angle < 26) return null;
                  const middle = (sector.startAngle + sector.endAngle) / 2;
                  const radians = (middle * Math.PI) / 180;
                  return (
                    <text
                      key={`${labId}-sector-label-${index}`}
                      x={Math.sin(radians) * pieRadius * 0.62}
                      y={-Math.cos(radians) * pieRadius * 0.62 + 4}
                      textAnchor="middle"
                      style={{ fill: 'var(--dm-surface)', fontSize: '13px', fontWeight: 800 }}
                      aria-hidden="true"
                    >
                      {ru(sector.percent, 0)}%
                    </text>
                  );
                })}
            </g>
          </svg>
        ) : (
          <svg
            className="dm-ratio-graph"
            viewBox="0 0 560 300"
            role="img"
            aria-labelledby={`${labId}-bar-title ${labId}-bar-desc`}
          >
            <title id={`${labId}-bar-title`}>Столбчатая диаграмма из {rows.length} столбиков</title>
            <desc id={`${labId}-bar-desc`}>
              Ось значений размечена от 0 до {scale.axisMax} с ценой деления {scale.step}. Данные:{' '}
              {rows.map((row, index) => `${row.label} — ${values[index]}`).join('; ')}.
              {activeMode === 'mean' && reveal ? ` Пунктирная линия отмечает среднее ${meanText}.` : ''}
            </desc>
            {Array.from({ length: tickCount + 1 }, (_, index) => {
              const value = index * scale.step;
              const y = baseLine - (value / scale.axisMax) * plotHeight;
              return (
                <g aria-hidden="true" key={`${labId}-tick-${index}`}>
                  <line className="dm-ratio-graph__grid" x1={plotLeft} y1={y} x2={plotLeft + plotWidth} y2={y} />
                  <text className="dm-ratio-graph__label" x={plotLeft - 10} y={y + 4} textAnchor="end">{value}</text>
                </g>
              );
            })}
            <g aria-hidden="true">
              <line className="dm-ratio-graph__axis" x1={plotLeft} y1={baseLine} x2={plotLeft + plotWidth} y2={baseLine} />
              <line className="dm-ratio-graph__axis" x1={plotLeft} y1={baseLine} x2={plotLeft} y2={plotTop - 8} />
            </g>
            {rows.map((row, index) => {
              const value = values[index] as number;
              const height = (value / scale.axisMax) * plotHeight;
              const centre = plotLeft + slot * (index + 0.5);
              return (
                <g aria-hidden="true" key={`${labId}-bar-${index}`}>
                  <rect
                    x={centre - barWidth / 2}
                    y={baseLine - height}
                    width={barWidth}
                    height={height}
                    rx={4}
                    style={{ fill: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                  />
                  <text className="dm-ratio-graph__axis-title" x={centre} y={baseLine - height - 8} textAnchor="middle">{value}</text>
                  <text className="dm-ratio-graph__label" x={centre} y={baseLine + 20} textAnchor="middle">{row.label}</text>
                </g>
              );
            })}
            {activeMode === 'mean' && reveal && (
              <g aria-hidden="true">
                <line className="dm-ratio-graph__guide" x1={plotLeft} y1={meanY} x2={plotLeft + plotWidth} y2={meanY} />
                <text className="dm-ratio-graph__axis-title" x={plotLeft + plotWidth} y={meanY - 8} textAnchor="end">
                  среднее {meanText}
                </text>
              </g>
            )}
            <text className="dm-ratio-graph__axis-title" x={plotLeft - 44} y={plotTop - 4}>
              {valueName}{unitLabel ? `, ${unitLabel}` : ''}
            </text>
          </svg>
        )}

        <div className="dm-ratio-table-wrap">
          <table className="dm-ratio-table">
            <caption>
              {activeMode === 'pie'
                ? 'Таблица долей: значение, доля от целого, процент и угол сектора'
                : activeMode === 'mean'
                  ? 'Таблица наблюдений и отклонений от среднего'
                  : 'Таблица данных'}
            </caption>
            <thead>
              <tr>
                <th scope="col">{categoryName}</th>
                <th scope="col">{valueName}{unitLabel ? `, ${unitLabel}` : ''}</th>
                {activeMode === 'pie' && <th scope="col">Доля</th>}
                {activeMode === 'pie' && <th scope="col">Процент</th>}
                {activeMode === 'pie' && <th scope="col">Угол сектора</th>}
                {activeMode === 'mean' && <th scope="col">Отклонение от среднего</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const sector = sectors[index];
                return (
                  <tr key={`${labId}-table-${index}`}>
                    <th scope="row">{row.label}</th>
                    <td>{values[index]}</td>
                    {activeMode === 'pie' && <td>{sector ? `${sector.fraction.numerator}/${sector.fraction.denominator}` : '—'}</td>}
                    {activeMode === 'pie' && <td>{sector && reveal ? `${ru(sector.percent, 1)}%` : '?'}</td>}
                    {activeMode === 'pie' && <td>{sector && reveal ? `${ru(sector.angle, 1)}°` : '?'}</td>}
                    {activeMode === 'mean' && <td>{reveal ? ru((values[index] as number) - meanValue, 2) : '?'}</td>}
                  </tr>
                );
              })}
              <tr className="dm-ratio-table__answer">
                <th scope="row">Всего</th>
                <td>{activeMode === 'bar' && !reveal ? '?' : total}</td>
                {activeMode === 'pie' && <td>1</td>}
                {activeMode === 'pie' && <td>{reveal ? '100%' : '?'}</td>}
                {activeMode === 'pie' && <td>{reveal ? '360°' : '?'}</td>}
                {activeMode === 'mean' && <td>{reveal ? '0' : '?'}</td>}
              </tr>
            </tbody>
          </table>
        </div>

        {challenge && (
          <div className="dm-ratio-unit-note">
            <span aria-hidden="true">?</span>
            <div>
              <div className="dm-field">
                <label htmlFor={`${labId}-answer`}>{targetQuestion}</label>
                <input
                  id={`${labId}-answer`}
                  type="text"
                  inputMode="decimal"
                  value={answer}
                  onChange={(event) => {
                    setAnswer(event.target.value);
                    setChecked(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') setChecked(true);
                  }}
                />
              </div>
              <div className="dm-nt-actions">
                <button type="button" className="dm-button" onClick={() => setChecked(true)}>Проверить</button>
              </div>
            </div>
          </div>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span>
          <p>
            <strong>{result.headline}</strong>
            <small>{result.detail}</small>
          </p>
        </div>
      </div>
    </section>
  );
}
