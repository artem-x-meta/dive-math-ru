import { useId, useMemo, useState } from 'react';
import {
  diceSumDistribution,
  normalDensity,
  sigmaComparison,
  standardDeviation,
  MAX_DICE_IN_SUM,
} from '../lib/stochastics';
import { bernoulliDistribution, expectedValue, type DistributionEntry } from '../lib/combinatorics';
import { distributionVariance } from '../lib/conditional';
import { formatFraction, fraction, fractionToNumber } from '../lib/probability';
import { chartAxisMaximum, roundTo } from '../lib/statistics';

export type StochNormalSource = 'dice' | 'success';

const SOURCES: readonly StochNormalSource[] = ['dice', 'success'];
const SOURCE_LABELS: Readonly<Record<StochNormalSource, string>> = {
  dice: 'Сумма очков на кубиках',
  success: 'Число успехов в серии',
};

/** Дальше строк треугольника Паскаля становится больше, чем допускает ядро. */
const MAX_TRIALS = 15;

interface SuccessOption {
  readonly key: string;
  readonly numerator: number;
  readonly denominator: number;
  readonly story: string;
}

const SUCCESS_OPTIONS: readonly SuccessOption[] = [
  { key: '1/2', numerator: 1, denominator: 2, story: 'орёл у симметричной монеты' },
  { key: '3/5', numerator: 3, denominator: 5, story: 'сторонник проекта в опросе' },
  { key: '1/4', numerator: 1, denominator: 4, story: 'угадать ответ из четырёх наугад' },
  { key: '9/10', numerator: 9, denominator: 10, story: 'исправная деталь на потоке' },
];

const BAND_GUESSES: readonly { readonly key: string; readonly label: string; readonly correct: boolean }[] = [
  { key: 'half', label: 'примерно половина, около 50 %', correct: false },
  { key: 'two-thirds', label: 'примерно две трети, около 68 %', correct: true },
  { key: 'almost-all', label: 'почти всё, около 95 %', correct: false },
];

const PLOT_LEFT = 76;
const PLOT_RIGHT = 690;
const PLOT_TOP = 34;
const PLOT_BOTTOM = 226;
const CURVE_POINTS = 240;

function safeSource(value: StochNormalSource | undefined): StochNormalSource {
  return value !== undefined && SOURCES.includes(value) ? value : 'dice';
}

function safeSuccess(value: string | undefined): SuccessOption {
  return SUCCESS_OPTIONS.find((option) => option.key === value) ?? SUCCESS_OPTIONS[0]!;
}

function clampInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function decimal(value: number, digits = 4): string {
  return String(roundTo(value, digits)).replace('.', ',');
}

function percent(value: number): string {
  return `${decimal(value * 100, 1)} %`;
}

export interface StochNormalLabProps {
  initialSource?: StochNormalSource;
  /** Число кубиков в сумме или число испытаний в серии. */
  initialCount?: number;
  /** Вероятность успеха в записи «3/5»; используется в режиме серии испытаний. */
  initialSuccess?: string;
  challenge?: boolean;
}

export default function StochNormalLab({
  initialSource,
  initialCount,
  initialSuccess,
  challenge = false,
}: StochNormalLabProps) {
  const reactId = useId();
  const labId = `stoch-normal-${reactId.replace(/:/g, '')}`;
  const defaultSource = safeSource(initialSource);
  const defaultDice = clampInteger(defaultSource === 'dice' ? initialCount : undefined, 4, 1, MAX_DICE_IN_SUM);
  const defaultTrials = clampInteger(defaultSource === 'success' ? initialCount : undefined, 12, 1, MAX_TRIALS);
  const defaultSuccess = safeSuccess(initialSuccess);

  const [source, setSource] = useState<StochNormalSource>(defaultSource);
  const [diceCount, setDiceCount] = useState(defaultDice);
  const [trials, setTrials] = useState(defaultTrials);
  const [successKey, setSuccessKey] = useState(defaultSuccess.key);
  const [guess, setGuess] = useState('');
  const [checked, setChecked] = useState(false);

  const success = safeSuccess(successKey);
  const entries: DistributionEntry[] = useMemo(
    () =>
      source === 'dice'
        ? diceSumDistribution(diceCount)
        : bernoulliDistribution(trials, fraction(success.numerator, success.denominator)),
    [source, diceCount, trials, success.numerator, success.denominator],
  );

  const meanExact = expectedValue(entries);
  const varianceExact = distributionVariance(entries);
  const centre = fractionToNumber(meanExact);
  const deviation = standardDeviation(entries);
  const rows = useMemo(() => sigmaComparison(entries), [entries]);

  const reveal = !challenge || checked;
  const guessCorrect = BAND_GUESSES.some((option) => option.key === guess && option.correct);

  const firstValue = entries[0]!.value;
  const lastValue = entries.at(-1)!.value;
  const axisLow = firstValue - 0.5;
  const axisHigh = lastValue + 0.5;
  const toX = (value: number) => PLOT_LEFT + ((value - axisLow) / (axisHigh - axisLow)) * (PLOT_RIGHT - PLOT_LEFT);
  const slot = (PLOT_RIGHT - PLOT_LEFT) / entries.length;
  const barWidth = Math.max(3, slot * 0.72);

  const probabilities = entries.map((entry) => fractionToNumber(entry.probability));
  const axisMax = chartAxisMaximum(Math.max(...probabilities, normalDensity(centre, centre, deviation)));
  const toY = (value: number) => PLOT_BOTTOM - (value / axisMax) * (PLOT_BOTTOM - PLOT_TOP);
  const gridLines = Array.from({ length: 5 }, (_unused, index) => roundTo((axisMax * index) / 4, 9));

  // Шаг между соседними значениями равен 1, поэтому плотность и вероятность
  // сравнимы напрямую: площадь столбика ширины 1 равна его высоте.
  const curve = Array.from({ length: CURVE_POINTS + 1 }, (_unused, index) => {
    const value = axisLow + ((axisHigh - axisLow) * index) / CURVE_POINTS;
    return `${roundTo(toX(value), 2)},${roundTo(toY(normalDensity(value, centre, deviation)), 2)}`;
  }).join(' ');

  const quantity = source === 'dice' ? 'сумма очков' : 'число успехов';
  const story =
    source === 'dice'
      ? `Бросают ${diceCount} независимых кубиков и складывают очки. Всего ${6 ** diceCount} равновозможных цепочек граней, но суммы получаются далеко не равновозможными.`
      : `Серия из ${trials} независимых испытаний, вероятность успеха в каждом равна ${success.key} (${success.story}).`;

  const description =
    `Столбчатая диаграмма распределения: по горизонтали ${quantity} от ${firstValue} до ${lastValue}, ` +
    `по вертикали вероятность от 0 до ${decimal(axisMax, 3)}. ` +
    (reveal
      ? `Поверх столбиков проведена кривая нормальной модели со средним ${decimal(centre, 3)} и стандартным отклонением ${decimal(deviation, 3)}. ` +
        `Прямоугольник закрывает полосу от ${decimal(centre - deviation, 2)} до ${decimal(centre + deviation, 2)}; ` +
        `точная вероятность попасть в неё равна ${decimal(rows[0]!.exactApprox)}, нормальная модель обещает ${decimal(rows[0]!.normal)}.`
      : 'Кривая нормальной модели и полоса ± σ скрыты: сначала выбери ответ и нажми «Проверить».');

  const reset = () => {
    setSource(defaultSource);
    setDiceCount(defaultDice);
    setTrials(defaultTrials);
    setSuccessKey(defaultSuccess.key);
    setGuess('');
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-ratio-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория нормальной модели</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Откуда берётся колокол</h3>
          <p>
            Ни кубик, ни монета сами по себе на колокол не похожи. Увеличивай число слагаемых
            и смотри, как форма распределения суммы меняется сама собой.
          </p>
        </div>
        <span className="dm-lab__badge">σ = {decimal(deviation, 3)}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-ratio-tabs" role="group" aria-label="Что складываем">
          {SOURCES.map((key) => (
            <button
              type="button"
              key={`${labId}-source-${key}`}
              aria-pressed={source === key}
              className={source === key ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
              onClick={() => {
                setSource(key);
                setChecked(false);
              }}
            >
              {SOURCE_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-ratio-controls">
          {source === 'dice' ? (
            <div className="dm-field">
              <label htmlFor={`${labId}-dice`}>
                Сколько кубиков складываем <span className="dm-field__value">{diceCount}</span>
              </label>
              <input
                id={`${labId}-dice`}
                type="range"
                min={1}
                max={MAX_DICE_IN_SUM}
                step={1}
                value={diceCount}
                aria-valuetext={`${diceCount} кубиков`}
                aria-describedby={`${labId}-dice-hint`}
                onChange={(event) => {
                  setDiceCount(Number(event.target.value));
                  setChecked(false);
                }}
              />
              <small id={`${labId}-dice-hint`}>
                От 1 до {MAX_DICE_IN_SUM}. Один кубик даёт ровную «полку», два — «крышу», а дальше начинается колокол.
              </small>
            </div>
          ) : (
            <>
              <div className="dm-field">
                <label htmlFor={`${labId}-trials`}>
                  Число испытаний n <span className="dm-field__value">{trials}</span>
                </label>
                <input
                  id={`${labId}-trials`}
                  type="range"
                  min={1}
                  max={MAX_TRIALS}
                  step={1}
                  value={trials}
                  aria-valuetext={`${trials} испытаний`}
                  aria-describedby={`${labId}-trials-hint`}
                  onChange={(event) => {
                    setTrials(Number(event.target.value));
                    setChecked(false);
                  }}
                />
                <small id={`${labId}-trials-hint`}>
                  От 1 до {MAX_TRIALS}; испытания независимы, вероятность успеха в каждом одна и та же.
                </small>
              </div>
              <div className="dm-field dm-ratio-field">
                <label htmlFor={`${labId}-success`}>
                  Вероятность успеха p <span className="dm-field__value">{success.key}</span>
                </label>
                <select
                  id={`${labId}-success`}
                  value={successKey}
                  aria-describedby={`${labId}-success-hint`}
                  onChange={(event) => {
                    setSuccessKey(event.target.value);
                    setChecked(false);
                  }}
                >
                  {SUCCESS_OPTIONS.map((option) => (
                    <option value={option.key} key={`${labId}-p-${option.key}`}>
                      {option.key} — {option.story}
                    </option>
                  ))}
                </select>
                <small id={`${labId}-success-hint`}>
                  Чем дальше p от 1/2, тем несимметричнее картинка и тем позже она становится похожей на колокол.
                </small>
              </div>
            </>
          )}
        </div>

        <p className="dm-nt-caption">{story}</p>

        <div className="dm-geometry-static-wrap" role="region" aria-label="Прокручиваемая диаграмма распределения" tabIndex={0}>
          <svg
            className="dm-ratio-graph"
            viewBox="0 0 720 296"
            role="img"
            aria-labelledby={`${labId}-chart-title ${labId}-chart-desc`}
          >
            <title id={`${labId}-chart-title`}>Распределение суммы и нормальная кривая</title>
            <desc id={`${labId}-chart-desc`}>{description}</desc>

            <g aria-hidden="true">
              {gridLines.map((line) => (
                <g key={`${labId}-grid-${line}`}>
                  <line className="dm-ratio-graph__grid" x1={PLOT_LEFT} y1={toY(line)} x2={PLOT_RIGHT} y2={toY(line)} />
                  <text className="dm-ratio-graph__label" x={PLOT_LEFT - 10} y={toY(line) + 4} textAnchor="end">
                    {decimal(line, 3)}
                  </text>
                </g>
              ))}

              {reveal && (
                <rect
                  className="dm-geometry-grid-cell--partial"
                  x={Math.max(PLOT_LEFT, toX(centre - deviation))}
                  y={PLOT_TOP}
                  width={Math.max(2, Math.min(PLOT_RIGHT, toX(centre + deviation)) - Math.max(PLOT_LEFT, toX(centre - deviation)))}
                  height={PLOT_BOTTOM - PLOT_TOP}
                  rx={4}
                />
              )}

              {entries.map((entry, index) => {
                const top = toY(probabilities[index]!);
                const inBand = Math.abs(entry.value - centre) <= deviation;
                return (
                  <rect
                    key={`${labId}-bar-${entry.value}`}
                    className={reveal && inBand ? 'dm-geometry-grid-cell dm-geometry-grid-cell--full' : 'dm-nt-array__cell'}
                    x={toX(entry.value) - barWidth / 2}
                    y={top}
                    width={barWidth}
                    height={Math.max(0.5, PLOT_BOTTOM - top)}
                    rx={3}
                  />
                );
              })}

              {reveal && <polyline className="dm-ratio-graph__line" points={curve} fill="none" />}

              {reveal &&
                [-3, -2, -1, 1, 2, 3].map((k) => {
                  const x = toX(centre + k * deviation);
                  if (x < PLOT_LEFT || x > PLOT_RIGHT) return null;
                  return (
                    <line
                      key={`${labId}-sigma-${k}`}
                      className="dm-ratio-graph__grid"
                      x1={x}
                      y1={PLOT_TOP}
                      x2={x}
                      y2={PLOT_BOTTOM}
                    />
                  );
                })}

              {reveal && (
                <>
                  <line className="dm-ratio-graph__guide" x1={toX(centre)} y1={PLOT_TOP - 8} x2={toX(centre)} y2={PLOT_BOTTOM} />
                  <text className="dm-ratio-graph__axis-title" x={toX(centre)} y={PLOT_TOP - 14} textAnchor="middle">
                    M(X) = {decimal(centre, 2)}
                  </text>
                </>
              )}

              {!reveal && (
                <text
                  className="dm-ratio-graph__axis-title"
                  x={(PLOT_LEFT + PLOT_RIGHT) / 2}
                  y={PLOT_TOP + 4}
                  textAnchor="middle"
                >
                  кривая и полоса ± σ скрыты — сначала дай прогноз
                </text>
              )}

              {entries.map((entry, index) =>
                entries.length <= 22 || index % 2 === 0 ? (
                  <text
                    key={`${labId}-tick-${entry.value}`}
                    className="dm-ratio-graph__axis-title"
                    x={toX(entry.value)}
                    y={PLOT_BOTTOM + 24}
                    textAnchor="middle"
                  >
                    {entry.value}
                  </text>
                ) : null,
              )}

              <line className="dm-ratio-graph__axis" x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT + 10} y2={PLOT_BOTTOM} />
              <line className="dm-ratio-graph__axis" x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_LEFT} y2={PLOT_TOP - 10} />
              <text className="dm-ratio-graph__axis-title" x={PLOT_LEFT - 10} y={PLOT_TOP - 18} textAnchor="end">
                вероятность
              </text>
              <text className="dm-ratio-graph__axis-title" x={PLOT_RIGHT + 10} y={PLOT_BOTTOM + 52} textAnchor="end">
                {quantity}
              </text>
            </g>
          </svg>
        </div>

        {challenge && (
          <div className="dm-ratio-unit-note">
            <span aria-hidden="true">?</span>
            <div>
              <div className="dm-field dm-ratio-field">
                <label htmlFor={`${labId}-guess`}>
                  Какая доля значений попадёт в полосу M(X) ± σ?
                </label>
                <select
                  id={`${labId}-guess`}
                  value={guess}
                  onChange={(event) => {
                    setGuess(event.target.value);
                    setChecked(false);
                  }}
                >
                  <option value="">— выбери ответ —</option>
                  {BAND_GUESSES.map((option) => (
                    <option value={option.key} key={`${labId}-guess-${option.key}`}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dm-nt-actions">
                <button type="button" className="dm-button" onClick={() => setChecked(guess !== '')}>
                  Проверить
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="dm-ratio-table-wrap">
          <table className="dm-ratio-table">
            <caption>Полосы вокруг среднего: точный расчёт против нормальной модели</caption>
            <thead>
              <tr>
                <th scope="col">Полоса</th>
                <th scope="col">Границы</th>
                <th scope="col">Точная вероятность</th>
                <th scope="col">Приближённо</th>
                <th scope="col">Нормальная модель</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${labId}-sigma-row-${row.sigmas}`}>
                  <th scope="row">M ± {row.sigmas}σ</th>
                  <td>
                    {decimal(centre - row.sigmas * deviation, 2)} … {decimal(centre + row.sigmas * deviation, 2)}
                  </td>
                  <td>{reveal ? formatFraction(row.exact) : '?'}</td>
                  <td>{reveal ? decimal(row.exactApprox) : '?'}</td>
                  <td>{decimal(row.normal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="dm-nt-note">
            Точные вероятности вычислены по распределению, без всякого нормального приближения:
            сравнение $(x-M)^2\le k^2D$ обходится без извлечения корня. Последний столбец — то,
            что обещает модель; расхождение показывает, насколько модель уже пригодна.
          </p>
        </div>

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">
            {reveal ? (challenge ? (guessCorrect ? '✓' : '×') : 'σ') : '?'}
          </span>
          <p>
            <strong>
              {!reveal
                ? 'Выбери прогноз для полосы M(X) ± σ и нажми «Проверить».'
                : `M(X) = ${formatFraction(meanExact)}, D(X) = ${formatFraction(varianceExact)}, σ(X) = ${decimal(deviation, 3)}. ` +
                  `В полосу M ± σ попадает ${percent(rows[0]!.exactApprox)} вероятности, в M ± 2σ — ${percent(rows[1]!.exactApprox)}, в M ± 3σ — ${percent(rows[2]!.exactApprox)}.`}
            </strong>
            <small>
              {reveal
                ? 'Кривая нигде не совпадает со столбиками точно: нормальная модель — приближение, а не истина. ' +
                  'Чем больше независимых слагаемых, тем ближе картинка к колоколу и тем ближе три числа к 68 %, 95 % и 99,7 %.'
                : 'Подсказка: посмотри, какая часть столбиков попадает внутрь выделенной полосы.'}
            </small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>
          ↺ Вернуть пример
        </button>
      </div>
    </section>
  );
}
