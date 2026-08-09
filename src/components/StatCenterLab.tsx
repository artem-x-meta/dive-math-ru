import { useId, useState } from 'react';
import { chartAxisMaximum, frequencyTable, roundTo, sampleSummary } from '../lib/statistics';

export type StatCenterPreset = 'cubing' | 'gift';

interface PresetDefinition {
  readonly label: string;
  readonly headline: string;
  readonly story: string;
  readonly unit: string;
  readonly base: readonly number[];
  readonly extraLabel: string;
  readonly usual: number;
  readonly outlier: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
}

const PRESETS: Readonly<Record<StatCenterPreset, PresetDefinition>> = {
  cubing: {
    label: 'Сборка кубика',
    headline: 'Десять результатов клуба спидкубинга, секунды',
    story: 'Девять участников уже собрали кубик. Время десятого задаёшь ты.',
    unit: 'с',
    base: [30, 32, 33, 34, 35, 36, 38, 40, 42],
    extraLabel: 'Время десятого участника',
    usual: 40,
    outlier: 300,
    minimum: 25,
    maximum: 300,
    step: 1,
  },
  gift: {
    label: 'Сбор на подарок',
    headline: 'Десять взносов на общий подарок, рубли',
    story: 'Девять человек уже сдали деньги. Взнос десятого задаёшь ты.',
    unit: '₽',
    base: [200, 250, 250, 300, 300, 350, 400, 450, 500],
    extraLabel: 'Взнос десятого ученика',
    usual: 400,
    outlier: 5000,
    minimum: 100,
    maximum: 5000,
    step: 50,
  },
};

const PRESET_KEYS = Object.freeze(['cubing', 'gift'] as const);

const PLOT_LEFT = 62;
const PLOT_RIGHT = 682;
const AXIS_Y = 214;
const DOT_RADIUS = 7;
const DOT_GAP = 17;

function safePreset(value: StatCenterPreset | undefined): StatCenterPreset {
  return value !== undefined && value in PRESETS ? value : 'cubing';
}

function formatNumber(value: number): string {
  return String(roundTo(value, 3)).replace('.', ',');
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

interface AxisScale {
  readonly start: number;
  readonly end: number;
  readonly step: number;
}

/** Шкала числовой оси: круглый шаг и границы, кратные шагу, чтобы рисунок был честным. */
function axisScale(minimum: number, maximum: number): AxisScale {
  const span = maximum - minimum;
  const step = chartAxisMaximum(span > 0 ? span / 6 : Math.max(Math.abs(maximum), 1) / 6);
  const start = roundTo(Math.floor(minimum / step) * step, 6);
  const end = roundTo(Math.ceil(maximum / step) * step, 6);
  return { start, end: end > start ? end : roundTo(start + step, 6), step };
}

export interface StatCenterLabProps {
  preset?: StatCenterPreset;
  initialExtra?: number;
  challenge?: boolean;
}

export default function StatCenterLab({ preset, initialExtra, challenge = false }: StatCenterLabProps) {
  const reactId = useId();
  const labId = `stat-center-${reactId.replace(/:/g, '')}`;
  const defaultPreset = safePreset(preset);
  const startExtra = (key: StatCenterPreset): number => {
    const definition = PRESETS[key];
    if (key !== defaultPreset || initialExtra === undefined || !Number.isFinite(initialExtra)) return definition.usual;
    return roundTo(clamp(initialExtra, definition.minimum, definition.maximum), 2);
  };

  const [presetKey, setPresetKey] = useState<StatCenterPreset>(defaultPreset);
  const [extra, setExtra] = useState(() => startExtra(defaultPreset));
  const [revealed, setRevealed] = useState(false);

  const definition = PRESETS[presetKey];
  const values = [...definition.base, extra];
  const summary = sampleSummary(values);
  const dots = frequencyTable(values);
  const reveal = !challenge || revealed;

  const changeExtra = (next: number) => {
    setExtra(roundTo(clamp(next, definition.minimum, definition.maximum), 2));
    setRevealed(false);
  };

  const changePreset = (key: StatCenterPreset) => {
    setPresetKey(key);
    setExtra(startExtra(key));
    setRevealed(false);
  };

  const scale = axisScale(Math.min(summary.minimum, summary.mean), Math.max(summary.maximum, summary.mean));
  const toX = (value: number) =>
    PLOT_LEFT + ((value - scale.start) / (scale.end - scale.start)) * (PLOT_RIGHT - PLOT_LEFT);
  const tickCount = Math.round((scale.end - scale.start) / scale.step);
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => roundTo(scale.start + index * scale.step, 6));
  const meanX = toX(summary.mean);
  const medianX = toX(summary.median);
  const outlierIsFar = extra > summary.median * 2;

  const axisText = `Точечная диаграмма десяти значений; числовая ось размечена от ${formatNumber(scale.start)} до ${formatNumber(scale.end)} с шагом ${formatNumber(scale.step)}, единица измерения — ${definition.unit}.`;
  const description = reveal
    ? `${axisText} Каждая точка — одно значение, одинаковые значения стоят столбиком. Сплошная линия отмечает среднее ${formatNumber(summary.mean)}, пунктирная — медиану ${formatNumber(summary.median)}. Наименьшее значение ${formatNumber(summary.minimum)}, наибольшее ${formatNumber(summary.maximum)}, размах ${formatNumber(summary.range)}.`
    : `${axisText} Каждая точка — одно значение, одинаковые значения стоят столбиком. Отметки среднего и медианы скрыты до нажатия кнопки «Показать центр».`;

  return (
    <section className="dm-lab dm-ratio-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория данных</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Среднее, медиана и размах</h3>
          <p>{definition.story} Проверь, какая характеристика убегает вслед за одним значением, а какая остаётся на месте.</p>
        </div>
        <span className="dm-lab__badge">n = {summary.count}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-ratio-tabs" role="group" aria-label="Набор данных">
          {PRESET_KEYS.map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={presetKey === key}
              className={presetKey === key ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
              onClick={() => changePreset(key)}
            >
              {PRESETS[key].label}
            </button>
          ))}
        </div>

        <p className="dm-nt-caption">{definition.headline}</p>

        <div className="dm-field">
          <label htmlFor={`${labId}-extra`}>
            {definition.extraLabel}
            <span className="dm-field__value">{formatNumber(extra)} {definition.unit}</span>
          </label>
          <input
            id={`${labId}-extra`}
            type="range"
            min={definition.minimum}
            max={definition.maximum}
            step={definition.step}
            value={extra}
            aria-valuetext={`${formatNumber(extra)} ${definition.unit}`}
            aria-describedby={`${labId}-extra-hint`}
            onChange={(event) => changeExtra(Number(event.target.value))}
          />
          <small id={`${labId}-extra-hint`}>
            От {formatNumber(definition.minimum)} до {formatNumber(definition.maximum)} {definition.unit}; стрелки клавиатуры двигают ползунок на {formatNumber(definition.step)}.
          </small>
        </div>

        <div className="dm-ratio-tabs" role="group" aria-label="Быстрый выбор значения">
          <button
            type="button"
            aria-pressed={extra === definition.usual}
            className={extra === definition.usual ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
            onClick={() => changeExtra(definition.usual)}
          >
            Обычное значение: {formatNumber(definition.usual)} {definition.unit}
          </button>
          <button
            type="button"
            aria-pressed={extra === definition.outlier}
            className={extra === definition.outlier ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
            onClick={() => changeExtra(definition.outlier)}
          >
            Выброс: {formatNumber(definition.outlier)} {definition.unit}
          </button>
        </div>

        <svg className="dm-ratio-graph" viewBox="0 0 720 272" role="img" aria-labelledby={`${labId}-svg-title ${labId}-svg-desc`}>
          <title id={`${labId}-svg-title`}>Точечная диаграмма набора данных</title>
          <desc id={`${labId}-svg-desc`}>{description}</desc>

          <g aria-hidden="true">
            {ticks.map((tick) => (
              <g key={tick}>
                <line className="dm-ratio-graph__grid" x1={toX(tick)} y1={AXIS_Y - 156} x2={toX(tick)} y2={AXIS_Y} />
                <text className="dm-ratio-graph__label" x={toX(tick)} y={AXIS_Y + 20} textAnchor="middle">
                  {formatNumber(tick)}
                </text>
              </g>
            ))}

            <line className="dm-ratio-graph__axis" x1={PLOT_LEFT} y1={AXIS_Y} x2={PLOT_RIGHT + 12} y2={AXIS_Y} />
            <text className="dm-ratio-graph__axis-title" x={PLOT_RIGHT + 12} y={AXIS_Y + 58} textAnchor="end">
              значение, {definition.unit}
            </text>

            {dots.map((row) =>
              Array.from({ length: row.count }, (_, level) => (
                <circle
                  key={`${row.value}-${level}`}
                  className={row.value === extra && level === row.count - 1 ? 'dm-ratio-graph__point' : 'dm-ratio-graph__unit'}
                  cx={toX(row.value)}
                  cy={AXIS_Y - DOT_RADIUS - 5 - level * DOT_GAP}
                  r={DOT_RADIUS}
                />
              )),
            )}

            <line className="dm-ratio-graph__grid" x1={toX(summary.minimum)} y1={AXIS_Y + 34} x2={toX(summary.maximum)} y2={AXIS_Y + 34} />
            <line className="dm-ratio-graph__grid" x1={toX(summary.minimum)} y1={AXIS_Y + 28} x2={toX(summary.minimum)} y2={AXIS_Y + 40} />
            <line className="dm-ratio-graph__grid" x1={toX(summary.maximum)} y1={AXIS_Y + 28} x2={toX(summary.maximum)} y2={AXIS_Y + 40} />
            <text
              className="dm-ratio-graph__label"
              x={(toX(summary.minimum) + toX(summary.maximum)) / 2}
              y={AXIS_Y + 54}
              textAnchor="middle"
            >
              размах {formatNumber(summary.range)} {definition.unit}
            </text>

            {reveal && (
              <>
                <line className="dm-ratio-graph__line" x1={meanX} y1={AXIS_Y} x2={meanX} y2={38} />
                <text className="dm-ratio-graph__axis-title" x={meanX} y={28} textAnchor="middle">
                  среднее {formatNumber(summary.mean)}
                </text>
                <line className="dm-ratio-graph__guide" x1={medianX} y1={AXIS_Y} x2={medianX} y2={70} />
                <text className="dm-ratio-graph__axis-title" x={medianX} y={60} textAnchor="middle">
                  медиана {formatNumber(summary.median)}
                </text>
              </>
            )}
          </g>
        </svg>
        <p className="dm-ratio-graph-note">
          Масштаб оси один для всех точек: расстояние на рисунке пропорционально разности значений.
        </p>

        {challenge && !revealed && (
          <button className="dm-button" type="button" onClick={() => setRevealed(true)}>
            Показать центр
          </button>
        )}

        <div className="dm-nt-model-grid">
          <div className="dm-nt-card">
            <div className="dm-nt-card__header">
              <h4>Среднее</h4>
              <p className="dm-nt-card__value">{reveal ? formatNumber(summary.mean) : '?'}</p>
            </div>
            <p>Сумма всех значений, делённая на их количество: слагаемых ровно {summary.count}.</p>
          </div>
          <div className="dm-nt-card">
            <div className="dm-nt-card__header">
              <h4>Медиана</h4>
              <p className="dm-nt-card__value">{reveal ? formatNumber(summary.median) : '?'}</p>
            </div>
            <p>Середина упорядоченного ряда; при чётном объёме — среднее двух серединных значений.</p>
          </div>
          <div className="dm-nt-card">
            <div className="dm-nt-card__header">
              <h4>Размах</h4>
              <p className="dm-nt-card__value">{formatNumber(summary.range)}</p>
            </div>
            <p>
              Разность наибольшего и наименьшего: {formatNumber(summary.maximum)} − {formatNumber(summary.minimum)}.
            </p>
          </div>
        </div>

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{reveal ? '◎' : '?'}</span>
          <p>
            <strong>
              {reveal
                ? `Среднее ${formatNumber(summary.mean)} ${definition.unit}, медиана ${formatNumber(summary.median)} ${definition.unit}, размах ${formatNumber(summary.range)} ${definition.unit}.`
                : 'Сначала оцени центр на глаз, потом открой ответ.'}
            </strong>
            <small>
              {!reveal
                ? 'Точки уже нарисованы: прикинь, где окажется середина ряда, а где — среднее.'
                : outlierIsFar
                  ? 'Одно большое значение подтянуло среднее вверх, а медиана осталась на месте: ей важен порядок значений, а не их величина.'
                  : 'Пока выброса нет, среднее и медиана держатся рядом: обе характеристики описывают одно и то же типичное значение.'}
            </small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={() => changePreset(defaultPreset)}>
          ↺ Вернуть пример
        </button>
      </div>
    </section>
  );
}
