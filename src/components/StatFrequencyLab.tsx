import { useId, useMemo, useState } from 'react';
import {
  chartAxisMaximum,
  countOutcomes,
  frequencyTable,
  groupIntoIntervals,
  relativeFrequency,
  roundTo,
  runningRelativeFrequencies,
  simulateEquallyLikelyTrials,
  simulateSuccessSeries,
} from '../lib/statistics';

export type StatFrequencyMode = 'data' | 'experiment';
export type StatDataPreset = 'marks' | 'shots' | 'heights';
export type StatExperiment = 'coin' | 'die' | 'pin';

interface DataPreset {
  readonly label: string;
  readonly quantity: string;
  readonly values: readonly number[];
  readonly grouped: boolean;
  readonly intervalWidth: number;
  readonly intervalStart: number;
  readonly widths: readonly number[];
}

const DATA_PRESETS: Readonly<Record<StatDataPreset, DataPreset>> = {
  marks: {
    label: 'Отметки за тест',
    quantity: 'отметка за тест',
    values: [4, 3, 5, 4, 4, 3, 5, 4, 2, 3, 4, 5, 3, 4, 4, 3, 5, 2, 4, 3, 5, 4, 3, 4, 5],
    grouped: false,
    intervalWidth: 2,
    intervalStart: 2,
    widths: [1, 2],
  },
  shots: {
    label: 'Попадания из пяти бросков',
    quantity: 'число попаданий',
    values: [2, 3, 1, 4, 2, 3, 0, 2, 5, 3, 1, 2, 4, 3, 2, 1, 3, 5, 4, 3],
    grouped: false,
    intervalWidth: 2,
    intervalStart: 0,
    widths: [1, 2, 3],
  },
  heights: {
    label: 'Рост, см',
    quantity: 'рост, см',
    values: [157, 142, 163, 151, 168, 155, 149, 162, 158, 145, 171, 153, 159, 165, 148, 156, 174, 161, 152, 167],
    grouped: true,
    intervalWidth: 10,
    intervalStart: 140,
    widths: [5, 10, 20],
  },
};

interface ExperimentDefinition {
  readonly label: string;
  readonly title: string;
  readonly story: string;
  readonly outcomeCount: number;
  readonly outcomeNames: readonly string[];
  readonly eventNames: readonly string[];
  readonly defaultTracked: number;
  readonly defaultSeed: number;
  /** Ожидаемая доля исхода при равновозможных исходах; для несимметричного опыта — null. */
  readonly expected: number | null;
  /** Доля, заложенная в модель несимметричного опыта; открывается кнопкой. */
  readonly hidden: number | null;
}

const EXPERIMENTS: Readonly<Record<StatExperiment, ExperimentDefinition>> = {
  coin: {
    label: 'Монета',
    title: 'Симметричная монета',
    story: 'Два исхода, и симметрия монеты делает их равновозможными.',
    outcomeCount: 2,
    outcomeNames: ['орёл', 'решка'],
    eventNames: ['выпал орёл', 'выпала решка'],
    defaultTracked: 1,
    defaultSeed: 11,
    expected: 0.5,
    hidden: null,
  },
  die: {
    label: 'Кубик',
    title: 'Игральный кубик',
    story: 'Шесть равновозможных исходов: грани от 1 до 6.',
    outcomeCount: 6,
    outcomeNames: ['1', '2', '3', '4', '5', '6'],
    eventNames: ['выпала 1', 'выпала 2', 'выпала 3', 'выпала 4', 'выпала 5', 'выпала 6'],
    defaultTracked: 6,
    defaultSeed: 7,
    expected: 1 / 6,
    hidden: null,
  },
  pin: {
    label: 'Кнопка',
    title: 'Канцелярская кнопка',
    story: 'Тоже два исхода, но кнопка несимметрична, и доля заранее неизвестна.',
    outcomeCount: 2,
    outcomeNames: ['остриём вверх', 'на боку'],
    eventNames: ['кнопка упала остриём вверх', 'кнопка легла на бок'],
    defaultTracked: 1,
    defaultSeed: 3,
    expected: null,
    hidden: 0.7,
  },
};

const MODE_KEYS = Object.freeze(['data', 'experiment'] as const);
const MODE_LABELS: Readonly<Record<StatFrequencyMode, string>> = {
  data: 'Данные наблюдений',
  experiment: 'Случайный опыт',
};
const DATA_KEYS = Object.freeze(['marks', 'shots', 'heights'] as const);
const EXPERIMENT_KEYS = Object.freeze(['coin', 'die', 'pin'] as const);
const TRIAL_STEPS = Object.freeze([10, 20, 50, 100, 200, 500, 1000] as const);

const PLOT_LEFT = 76;
const PLOT_RIGHT = 690;
const PLOT_TOP = 30;
const PLOT_BOTTOM = 214;

function formatNumber(value: number, digits = 3): string {
  return String(roundTo(value, digits)).replace('.', ',');
}

function formatPercent(value: number): string {
  return formatNumber(value * 100, 1);
}

function safeMode(value: StatFrequencyMode | undefined): StatFrequencyMode {
  return value === 'experiment' ? 'experiment' : 'data';
}

function safeDataPreset(value: StatDataPreset | undefined): StatDataPreset {
  return value !== undefined && value in DATA_PRESETS ? value : 'marks';
}

function safeExperiment(value: StatExperiment | undefined): StatExperiment {
  return value !== undefined && value in EXPERIMENTS ? value : 'coin';
}

function safeSeed(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 && value <= 999_999 ? value : fallback;
}

function safeTrials(value: number | undefined): (typeof TRIAL_STEPS)[number] {
  const found = TRIAL_STEPS.find((step) => step === value);
  return found ?? 100;
}

/** Число делений вертикальной оси, при котором подписи остаются круглыми. */
function axisDivisions(axisMax: number): number {
  const mantissa = axisMax / 10 ** Math.floor(Math.log10(axisMax));
  return Math.abs(mantissa - 2) < 1e-9 ? 4 : 5;
}

interface BarSpec {
  readonly key: string;
  readonly caption: string;
  readonly value: number;
}

interface BarChartProps {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly bars: readonly BarSpec[];
  readonly axisTitle: string;
  readonly captionTitle: string;
  readonly digits: number;
  readonly reference: { readonly value: number; readonly caption: string } | null;
}

function BarChart({ id, title, description, bars, axisTitle, captionTitle, digits, reference }: BarChartProps) {
  const axisMax = chartAxisMaximum(Math.max(...bars.map((bar) => bar.value), reference?.value ?? 0));
  const height = PLOT_BOTTOM - PLOT_TOP;
  const slot = (PLOT_RIGHT - PLOT_LEFT) / bars.length;
  const barWidth = Math.min(74, slot * 0.6);
  const toY = (value: number) => PLOT_BOTTOM - (value / axisMax) * height;
  const divisions = axisDivisions(axisMax);
  const gridLines = Array.from({ length: divisions + 1 }, (_, index) => roundTo((axisMax * index) / divisions, 6));

  return (
    <svg className="dm-ratio-graph" viewBox="0 0 720 276" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <g aria-hidden="true">
        {gridLines.map((line) => (
          <g key={line}>
            <line className="dm-ratio-graph__grid" x1={PLOT_LEFT} y1={toY(line)} x2={PLOT_RIGHT} y2={toY(line)} />
            <text className="dm-ratio-graph__label" x={PLOT_LEFT - 10} y={toY(line) + 4} textAnchor="end">
              {formatNumber(line)}
            </text>
          </g>
        ))}
        {bars.map((bar, index) => {
          const centre = PLOT_LEFT + slot * (index + 0.5);
          const top = toY(bar.value);
          return (
            <g key={bar.key}>
              {bar.value > 0 && (
                <rect className="dm-nt-array__cell" x={centre - barWidth / 2} y={top} width={barWidth} height={PLOT_BOTTOM - top} rx="4" />
              )}
              <text className="dm-ratio-graph__label" x={centre} y={top - 9} textAnchor="middle">
                {formatNumber(bar.value, digits)}
              </text>
              <text className="dm-ratio-graph__axis-title" x={centre} y={PLOT_BOTTOM + 24} textAnchor="middle">
                {bar.caption}
              </text>
            </g>
          );
        })}
        {reference !== null && reference.value <= axisMax && (
          <>
            <line className="dm-ratio-graph__guide" x1={PLOT_LEFT} y1={toY(reference.value)} x2={PLOT_RIGHT} y2={toY(reference.value)} />
            <text className="dm-ratio-graph__axis-title" x={PLOT_RIGHT} y={toY(reference.value) - 9} textAnchor="end">
              {reference.caption}
            </text>
          </>
        )}
        <line className="dm-ratio-graph__axis" x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT + 10} y2={PLOT_BOTTOM} />
        <line className="dm-ratio-graph__axis" x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_LEFT} y2={PLOT_TOP - 10} />
        <text className="dm-ratio-graph__axis-title" x={PLOT_LEFT - 10} y={PLOT_TOP - 14} textAnchor="end">
          {axisTitle}
        </text>
        <text className="dm-ratio-graph__axis-title" x={PLOT_RIGHT + 10} y={PLOT_BOTTOM + 48} textAnchor="end">
          {captionTitle}
        </text>
      </g>
    </svg>
  );
}

interface RunChartProps {
  readonly id: string;
  readonly running: readonly number[];
  readonly reference: number | null;
  readonly eventName: string;
}

function RunChart({ id, running, reference, eventName }: RunChartProps) {
  const trials = running.length;
  const height = PLOT_BOTTOM - PLOT_TOP;
  const toX = (index: number) => PLOT_LEFT + ((index + 1) / trials) * (PLOT_RIGHT - PLOT_LEFT);
  const toY = (value: number) => PLOT_BOTTOM - value * height;
  const step = Math.max(1, Math.ceil(trials / 240));
  const points = running
    .map((value, index) => ({ value, index }))
    .filter((point) => point.index % step === 0 || point.index === trials - 1);
  const path = points
    .map((point, position) => `${position === 0 ? 'M' : 'L'}${roundTo(toX(point.index), 2)} ${roundTo(toY(point.value), 2)}`)
    .join(' ');
  const last = running.at(-1) ?? 0;

  return (
    <svg className="dm-ratio-graph" viewBox="0 0 720 276" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Как ведёт себя относительная частота с ростом числа опытов</title>
      <desc id={`${id}-desc`}>
        Ломаная показывает долю опытов, в которых {eventName}, после каждого из {trials} опытов серии. Вертикальная ось — доля от 0 до 1,
        горизонтальная — номер опыта от 1 до {trials}. В начале ломаная сильно скачет, дальше колебания становятся мельче; после
        последнего опыта доля равна {formatNumber(last)}.
        {reference === null ? '' : ` Пунктирная линия отмечает уровень ${formatNumber(reference)}.`}
      </desc>
      <g aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((share) => (
          <g key={share}>
            <line className="dm-ratio-graph__grid" x1={PLOT_LEFT} y1={toY(share)} x2={PLOT_RIGHT} y2={toY(share)} />
            <text className="dm-ratio-graph__label" x={PLOT_LEFT - 10} y={toY(share) + 4} textAnchor="end">
              {formatNumber(share)}
            </text>
          </g>
        ))}
        {reference !== null && (
          <>
            <line className="dm-ratio-graph__guide" x1={PLOT_LEFT} y1={toY(reference)} x2={PLOT_RIGHT} y2={toY(reference)} />
            <text className="dm-ratio-graph__axis-title" x={PLOT_RIGHT} y={toY(reference) - 9} textAnchor="end">
              ожидаемая доля {formatNumber(reference)}
            </text>
          </>
        )}
        <path className="dm-ratio-graph__line" d={path} fill="none" />
        <circle className="dm-ratio-graph__point" cx={toX(trials - 1)} cy={toY(last)} r="6" />
        <line className="dm-ratio-graph__axis" x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT + 10} y2={PLOT_BOTTOM} />
        <line className="dm-ratio-graph__axis" x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_LEFT} y2={PLOT_TOP - 10} />
        <text className="dm-ratio-graph__label" x={PLOT_LEFT} y={PLOT_BOTTOM + 22} textAnchor="start">1</text>
        <text className="dm-ratio-graph__label" x={PLOT_RIGHT} y={PLOT_BOTTOM + 22} textAnchor="end">{trials}</text>
        <text className="dm-ratio-graph__axis-title" x={PLOT_RIGHT + 10} y={PLOT_BOTTOM + 48} textAnchor="end">номер опыта</text>
        <text className="dm-ratio-graph__axis-title" x={PLOT_LEFT - 10} y={PLOT_TOP - 14} textAnchor="end">доля</text>
      </g>
    </svg>
  );
}

export interface StatFrequencyLabProps {
  mode?: StatFrequencyMode;
  preset?: StatDataPreset;
  experiment?: StatExperiment;
  initialTrials?: number;
  initialSeed?: number;
}

export default function StatFrequencyLab({ mode, preset, experiment, initialTrials, initialSeed }: StatFrequencyLabProps) {
  const reactId = useId();
  const labId = `stat-frequency-${reactId.replace(/:/g, '')}`;
  const defaultMode = safeMode(mode);
  const defaultPreset = safeDataPreset(preset);
  const defaultExperiment = safeExperiment(experiment);
  const defaultTrials = safeTrials(initialTrials);
  const defaultSeed = safeSeed(initialSeed, EXPERIMENTS[defaultExperiment].defaultSeed);

  const [activeMode, setActiveMode] = useState<StatFrequencyMode>(defaultMode);
  const [presetKey, setPresetKey] = useState<StatDataPreset>(defaultPreset);
  const [grouped, setGrouped] = useState(DATA_PRESETS[defaultPreset].grouped);
  const [intervalWidth, setIntervalWidth] = useState<number>(DATA_PRESETS[defaultPreset].intervalWidth);
  const [experimentKey, setExperimentKey] = useState<StatExperiment>(defaultExperiment);
  const [trials, setTrials] = useState<number>(defaultTrials);
  const [seed, setSeed] = useState(defaultSeed);
  const [tracked, setTracked] = useState(EXPERIMENTS[defaultExperiment].defaultTracked);
  const [hiddenShown, setHiddenShown] = useState(false);

  const data = DATA_PRESETS[presetKey];
  const definition = EXPERIMENTS[experimentKey];

  const choosePreset = (key: StatDataPreset) => {
    setPresetKey(key);
    setGrouped(DATA_PRESETS[key].grouped);
    setIntervalWidth(DATA_PRESETS[key].intervalWidth);
  };

  const chooseExperiment = (key: StatExperiment) => {
    setExperimentKey(key);
    setSeed(EXPERIMENTS[key].defaultSeed);
    setTracked(EXPERIMENTS[key].defaultTracked);
    setHiddenShown(false);
  };

  const reset = () => {
    setActiveMode(defaultMode);
    choosePreset(defaultPreset);
    setExperimentKey(defaultExperiment);
    setSeed(defaultSeed);
    setTrials(defaultTrials);
    setTracked(EXPERIMENTS[defaultExperiment].defaultTracked);
    setHiddenShown(false);
  };

  const outcomes = useMemo(() => {
    if (definition.hidden === null) return simulateEquallyLikelyTrials(seed, trials, definition.outcomeCount);
    return simulateSuccessSeries(seed, trials, definition.hidden).map((success) => (success ? 1 : 2));
  }, [definition, seed, trials]);

  const outcomeRows = countOutcomes(outcomes, definition.outcomeCount);
  const trackedRow = outcomeRows[tracked - 1] ?? outcomeRows[0]!;
  const trackedName = definition.eventNames[tracked - 1] ?? definition.eventNames[0]!;
  const running = useMemo(() => runningRelativeFrequencies(outcomes.map((value) => value === tracked)), [outcomes, tracked]);
  const trackedShare = relativeFrequency(trackedRow.count, trials);

  const valueRows = frequencyTable(data.values);
  const intervalRows = grouped ? groupIntoIntervals(data.values, intervalWidth, data.intervalStart) : [];
  const dataBars: BarSpec[] = grouped
    ? intervalRows.map((row) => ({ key: String(row.from), caption: `${formatNumber(row.from)}–${formatNumber(row.to)}`, value: row.count }))
    : valueRows.map((row) => ({ key: String(row.value), caption: formatNumber(row.value), value: row.count }));
  const dataTotal = data.values.length;
  const topBar = dataBars.reduce((best, bar) => (bar.value > best.value ? bar : best), dataBars[0]!);

  return (
    <section className="dm-lab dm-ratio-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория частот</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Частота, доля и диаграмма</h3>
          <p>Слева таблица, справа столбики: одно и то же считается двумя способами — в штуках и в долях.</p>
        </div>
        <span className="dm-lab__badge">n = {activeMode === 'data' ? dataTotal : trials}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-ratio-tabs" role="group" aria-label="Откуда берутся данные">
          {MODE_KEYS.map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={activeMode === key}
              className={activeMode === key ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
              onClick={() => setActiveMode(key)}
            >
              {MODE_LABELS[key]}
            </button>
          ))}
        </div>

        {activeMode === 'data' ? (
          <>
            <div className="dm-ratio-tabs" role="group" aria-label="Набор наблюдений">
              {DATA_KEYS.map((key) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={presetKey === key}
                  className={presetKey === key ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
                  onClick={() => choosePreset(key)}
                >
                  {DATA_PRESETS[key].label}
                </button>
              ))}
            </div>

            <div className="dm-ratio-tabs" role="group" aria-label="Способ подсчёта частот">
              <button
                type="button"
                aria-pressed={!grouped}
                className={grouped ? 'dm-ratio-tab' : 'dm-ratio-tab dm-ratio-tab--active'}
                onClick={() => setGrouped(false)}
              >
                По отдельным значениям
              </button>
              <button
                type="button"
                aria-pressed={grouped}
                className={grouped ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
                onClick={() => setGrouped(true)}
              >
                По интервалам
              </button>
            </div>

            {grouped && (
              <div className="dm-field dm-ratio-field">
                <label htmlFor={`${labId}-width`}>
                  Ширина интервала <span className="dm-field__value">{formatNumber(intervalWidth)}</span>
                </label>
                <select id={`${labId}-width`} value={intervalWidth} onChange={(event) => setIntervalWidth(Number(event.target.value))}>
                  {data.widths.map((width) => (
                    <option value={width} key={width}>
                      {width}
                    </option>
                  ))}
                </select>
                <small>
                  Ширина задана в тех же единицах, что и данные ({data.quantity}). Интервалы полуоткрытые: значение на правой границе
                  относится к следующему интервалу.
                </small>
              </div>
            )}

            <div className="dm-ratio-model-grid">
              <div className="dm-ratio-table-wrap">
                <table className="dm-ratio-table">
                  <caption>Таблица частот: {data.quantity}; всего наблюдений {dataTotal}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{grouped ? 'Интервал' : 'Значение'}</th>
                      <th scope="col">Частота</th>
                      <th scope="col">Отн. частота</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped
                      ? intervalRows.map((row) => (
                          <tr key={row.from}>
                            <th scope="row">
                              {formatNumber(row.from)} – {formatNumber(row.to)}
                            </th>
                            <td>{row.count}</td>
                            <td>{formatNumber(row.relativeFrequency)}</td>
                          </tr>
                        ))
                      : valueRows.map((row) => (
                          <tr key={row.value}>
                            <th scope="row">{formatNumber(row.value)}</th>
                            <td>{row.count}</td>
                            <td>{formatNumber(row.relativeFrequency)}</td>
                          </tr>
                        ))}
                    <tr className="dm-ratio-table__answer">
                      <th scope="row">Всего</th>
                      <td>{dataTotal}</td>
                      <td>1</td>
                    </tr>
                  </tbody>
                </table>
                <p className="dm-nt-note">
                  Относительная частота — частота, делённая на {dataTotal}. Сумма всех относительных частот равна единице.
                </p>
              </div>

              <BarChart
                id={`${labId}-data-chart`}
                title="Столбчатая диаграмма частот"
                description={`Диаграмма из ${dataBars.length} столбиков. Подписи по горизонтали: ${dataBars
                  .map((bar) => bar.caption)
                  .join(', ')}. Высоты столбиков в наблюдениях: ${dataBars
                  .map((bar) => bar.value)
                  .join(', ')}. Вертикальная ось начинается с нуля, поэтому высоты сравнимы напрямую.`}
                bars={dataBars}
                axisTitle="частота"
                captionTitle={data.quantity}
                digits={0}
                reference={null}
              />
            </div>
            <p className="dm-ratio-graph-note">Ось частот начинается с нуля: иначе разница между столбиками выглядела бы больше, чем есть.</p>

            <div className="dm-result" aria-live="polite" aria-atomic="true">
              <span className="dm-result__symbol" aria-hidden="true">▥</span>
              <p>
                <strong>
                  Самая многочисленная группа — {topBar.caption}: {topBar.value} наблюдений из {dataTotal}, доля {formatNumber(topBar.value / dataTotal)}.
                </strong>
                <small>
                  {grouped
                    ? 'Группировка теряет отдельные значения, зато показывает форму распределения. Слишком широкие интервалы прячут различия, слишком узкие дают рваную картинку.'
                    : 'Пока различных значений мало, каждое удобно считать отдельно. Когда значений становится много, переходи к интервалам.'}
                </small>
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="dm-ratio-tabs" role="group" aria-label="Случайный опыт">
              {EXPERIMENT_KEYS.map((key) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={experimentKey === key}
                  className={experimentKey === key ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
                  onClick={() => chooseExperiment(key)}
                >
                  {EXPERIMENTS[key].label}
                </button>
              ))}
            </div>

            <p className="dm-nt-caption">{definition.title}. {definition.story}</p>

            <div className="dm-lab__controls dm-ratio-controls">
              <div className="dm-field">
                <label htmlFor={`${labId}-trials`}>
                  Число опытов <span className="dm-field__value">{trials}</span>
                </label>
                <input
                  id={`${labId}-trials`}
                  type="range"
                  min={0}
                  max={TRIAL_STEPS.length - 1}
                  step={1}
                  value={TRIAL_STEPS.findIndex((value) => value === trials)}
                  aria-valuetext={`${trials} опытов`}
                  aria-describedby={`${labId}-trials-hint`}
                  onChange={(event) => setTrials(TRIAL_STEPS[Number(event.target.value)] ?? 100)}
                />
                <small id={`${labId}-trials-hint`}>Доступны серии: {TRIAL_STEPS.join(', ')}. Длиннее серия — надёжнее оценка.</small>
              </div>

              <div className="dm-field dm-ratio-field">
                <label htmlFor={`${labId}-seed`}>
                  Номер серии <span className="dm-field__value">{seed}</span>
                </label>
                <input
                  id={`${labId}-seed`}
                  type="text"
                  inputMode="numeric"
                  value={String(seed)}
                  aria-describedby={`${labId}-seed-hint`}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, '').slice(0, 6);
                    setSeed(digits === '' ? 0 : Number(digits));
                    setHiddenShown(false);
                  }}
                />
                <small id={`${labId}-seed-hint`}>Номер задаёт серию целиком: тот же номер — та же последовательность исходов.</small>
              </div>
            </div>

            <button
              className="dm-button dm-button--secondary"
              type="button"
              onClick={() => {
                setSeed((value) => (value >= 999_999 ? 0 : value + 1));
                setHiddenShown(false);
              }}
            >
              Провести новую серию
            </button>

            <div className="dm-ratio-tabs" role="group" aria-label="Какой исход отслеживаем">
              {definition.outcomeNames.map((name, index) => (
                <button
                  type="button"
                  key={name}
                  aria-pressed={tracked === index + 1}
                  className={tracked === index + 1 ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
                  onClick={() => setTracked(index + 1)}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="dm-ratio-model-grid">
              <div className="dm-ratio-table-wrap">
                <table className="dm-ratio-table">
                  <caption>Исходы серии из {trials} опытов, серия № {seed}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Исход</th>
                      <th scope="col">Частота</th>
                      <th scope="col">Отн. частота</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcomeRows.map((row, index) => (
                      <tr className={tracked === row.value ? 'dm-ratio-table__current' : ''} key={row.value}>
                        <th scope="row">{definition.outcomeNames[index]}</th>
                        <td>{row.count}</td>
                        <td>{formatNumber(row.relativeFrequency)}</td>
                      </tr>
                    ))}
                    <tr className="dm-ratio-table__answer">
                      <th scope="row">Всего</th>
                      <td>{trials}</td>
                      <td>1</td>
                    </tr>
                  </tbody>
                </table>
                <p className="dm-nt-note">
                  {definition.expected === null
                    ? 'Исходы этого опыта не равновозможны, поэтому ожидаемую долю нельзя получить рассуждением о симметрии — её оценивают по частоте.'
                    : `Исходы равновозможны, поэтому ожидаемая доля каждого равна ${formatNumber(definition.expected)}.`}
                </p>
              </div>

              <BarChart
                id={`${labId}-outcome-chart`}
                title="Диаграмма относительных частот исходов"
                description={`Диаграмма из ${outcomeRows.length} столбиков по серии из ${trials} опытов. Исходы: ${definition.outcomeNames.join(
                  ', ',
                )}. Относительные частоты: ${outcomeRows.map((row) => formatNumber(row.relativeFrequency)).join(', ')}.`}
                bars={outcomeRows.map((row, index) => ({
                  key: String(row.value),
                  caption: definition.outcomeNames[index] ?? String(row.value),
                  value: row.relativeFrequency,
                }))}
                axisTitle="доля"
                captionTitle="исход опыта"
                digits={3}
                reference={
                  definition.expected === null
                    ? null
                    : { value: definition.expected, caption: `ожидаемая доля ${formatNumber(definition.expected)}` }
                }
              />
            </div>

            <RunChart id={`${labId}-run-chart`} running={running} reference={definition.expected} eventName={trackedName} />
            <p className="dm-ratio-graph-note">
              Ломаная построена по одной и той же серии: первые опыты дают резкие скачки, дальше каждый новый опыт меняет долю всё слабее.
            </p>

            {definition.hidden !== null && (
              <button className="dm-button" type="button" onClick={() => setHiddenShown((value) => !value)}>
                {hiddenShown ? 'Спрятать долю модели' : 'Показать долю модели'}
              </button>
            )}

            <div className="dm-result" aria-live="polite" aria-atomic="true">
              <span className="dm-result__symbol" aria-hidden="true">≈</span>
              <p>
                <strong>
                  Событие «{trackedName}» случилось {trackedRow.count} раз из {trials}: относительная частота {formatNumber(trackedShare)}, то есть {formatPercent(trackedShare)} %.
                </strong>
                <small>
                  {definition.expected === null
                    ? hiddenShown && definition.hidden !== null
                      ? `В модель этой кнопки заложена доля ${formatNumber(definition.hidden)}. В короткой серии частота может заметно от неё отличаться, в длинной — почти нет.`
                      : 'Доля модели скрыта. Увеличивай серию и следи, около какого числа успокаивается ломаная: это и есть частотная оценка вероятности.'
                    : `Ожидаемая доля равна ${formatNumber(definition.expected)}; расхождение с частотой составляет ${formatNumber(Math.abs(trackedShare - definition.expected))}. Чем длиннее серия, тем меньше такие расхождения.`}
                </small>
              </p>
            </div>
          </>
        )}

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>
          ↺ Вернуть пример
        </button>
      </div>
    </section>
  );
}
