import { useId, useMemo, useState } from 'react';
import {
  type DistributionEntry,
  type FiniteExperimentKind,
  approximateProbability,
  bernoulliDistribution,
  combinations,
  expectedValue,
  finiteExperimentDistribution,
  finiteExperimentValues,
  formatCount,
  mostLikelyValues,
  probabilityAtLeast,
  probabilityAtMost,
  probabilityOfValue,
} from '../lib/combinatorics';
import { compareFractions, formatFraction, fraction, type Fraction } from '../lib/probability';
import { chartAxisMaximum, roundTo } from '../lib/statistics';

export type CombBernoulliMode = 'bernoulli' | 'variable';

export interface CombBernoulliLabProps {
  initialMode?: CombBernoulliMode;
  initialTrials?: number;
  /** Вероятность успеха в записи «3/5»; берётся из списка ниже. */
  initialSuccess?: string;
  initialExperiment?: FiniteExperimentKind;
  challenge?: boolean;
}

const MODES: readonly CombBernoulliMode[] = ['bernoulli', 'variable'];
const MODE_LABELS: Readonly<Record<CombBernoulliMode, string>> = {
  bernoulli: 'Схема Бернулли',
  variable: 'Опыт с равновозможными исходами',
};

const MIN_TRIALS = 1;
/** Дальше столбиков становится столько, что подписи под ними сливаются. */
const MAX_TRIALS = 12;

interface SuccessOption {
  readonly key: string;
  readonly numerator: number;
  readonly denominator: number;
  readonly story: string;
}

const SUCCESS_OPTIONS: readonly SuccessOption[] = [
  { key: '1/6', numerator: 1, denominator: 6, story: 'шестёрка при броске кубика' },
  { key: '1/4', numerator: 1, denominator: 4, story: 'угадать ответ из четырёх наугад' },
  { key: '1/3', numerator: 1, denominator: 3, story: 'вытянуть красный шар из трёх' },
  { key: '1/2', numerator: 1, denominator: 2, story: 'орёл у симметричной монеты' },
  { key: '3/5', numerator: 3, denominator: 5, story: 'попадание у среднего стрелка' },
  { key: '2/3', numerator: 2, denominator: 3, story: 'верный ответ у подготовленного ученика' },
  { key: '3/4', numerator: 3, denominator: 4, story: 'исправная деталь на потоке' },
  { key: '9/10', numerator: 9, denominator: 10, story: 'надёжный блок прибора' },
];

interface ExperimentOption {
  readonly key: FiniteExperimentKind;
  readonly label: string;
  readonly quantity: string;
  readonly story: string;
}

const EXPERIMENT_OPTIONS: readonly ExperimentOption[] = [
  {
    key: 'twoDiceSum',
    label: 'Сумма двух кубиков',
    quantity: 'сумма очков',
    story: 'Бросают красный и синий кубики. Равновозможны 36 пар, а не 11 сумм.',
  },
  {
    key: 'twoDiceMax',
    label: 'Наибольшее из двух',
    quantity: 'наибольшее число очков',
    story: 'Те же 36 пар, но записываем наибольшее из двух выпавших чисел.',
  },
  {
    key: 'twoDiceGap',
    label: 'Разность двух кубиков',
    quantity: 'разность очков без знака',
    story: 'Из большего числа вычитаем меньшее; значение 0 означает равные грани.',
  },
  {
    key: 'threeCoinsHeads',
    label: 'Орлы на трёх монетах',
    quantity: 'число орлов',
    story: 'Три монеты дают 8 равновозможных цепочек О и Р.',
  },
];

const PLOT_LEFT = 78;
const PLOT_RIGHT = 690;
const PLOT_TOP = 28;
const PLOT_BOTTOM = 226;

function clampInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function safeMode(value: CombBernoulliMode | undefined): CombBernoulliMode {
  return value !== undefined && MODES.includes(value) ? value : 'bernoulli';
}

function safeSuccess(value: string | undefined): SuccessOption {
  return SUCCESS_OPTIONS.find((option) => option.key === value) ?? SUCCESS_OPTIONS[3]!;
}

function safeExperiment(value: FiniteExperimentKind | undefined): ExperimentOption {
  return EXPERIMENT_OPTIONS.find((option) => option.key === value) ?? EXPERIMENT_OPTIONS[0]!;
}

function decimal(value: Fraction, digits = 4): string {
  return String(approximateProbability(value, digits)).replace('.', ',');
}

/** Разбирает ответ вида «3/8», «3 / 8» или «1» в дробь; иначе возвращает null. */
function parseFractionAnswer(text: string): Fraction | null {
  const normalized = text.replace(/[\s  ]/g, '').replace(',', '.');
  const asFraction = /^(\d{1,15})\/(\d{1,15})$/.exec(normalized);
  if (asFraction !== null) {
    const denominator = Number(asFraction[2]);
    if (denominator === 0) return null;
    return fraction(Number(asFraction[1]), denominator);
  }
  const asInteger = /^[01]$/.exec(normalized);
  if (asInteger !== null) return fraction(Number(asInteger[0]), 1);
  return null;
}

export default function CombBernoulliLab({
  initialMode,
  initialTrials,
  initialSuccess,
  initialExperiment,
  challenge = false,
}: CombBernoulliLabProps) {
  const reactId = useId();
  const labId = `comb-bernoulli-${reactId.replace(/:/g, '')}`;
  const defaultMode = safeMode(initialMode);
  const defaultTrials = clampInteger(initialTrials, 5, MIN_TRIALS, MAX_TRIALS);
  const defaultSuccess = safeSuccess(initialSuccess);
  const defaultExperiment = safeExperiment(initialExperiment);

  const [mode, setMode] = useState<CombBernoulliMode>(defaultMode);
  const [trials, setTrials] = useState(defaultTrials);
  const [successKey, setSuccessKey] = useState(defaultSuccess.key);
  const [experimentKey, setExperimentKey] = useState<FiniteExperimentKind>(defaultExperiment.key);
  const [markedIndex, setMarkedIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const invalidate = () => setChecked(false);

  const success = safeSuccess(successKey);
  const experiment = safeExperiment(experimentKey);

  const distribution: DistributionEntry[] = useMemo(
    () =>
      mode === 'bernoulli'
        ? bernoulliDistribution(trials, fraction(success.numerator, success.denominator))
        : finiteExperimentDistribution(experiment.key),
    [mode, trials, success.numerator, success.denominator, experiment.key],
  );

  const outcomeCount = mode === 'bernoulli' ? 0 : finiteExperimentValues(experiment.key).length;
  const marked = distribution[Math.min(markedIndex, distribution.length - 1)]!;
  const markedValue = marked.value;

  const mean = expectedValue(distribution);
  const peak = mostLikelyValues(distribution);
  const exactly = probabilityOfValue(distribution, markedValue);
  const atLeast = probabilityAtLeast(distribution, markedValue);
  const atMost = probabilityAtMost(distribution, markedValue);

  const reveal = !challenge || checked;
  const parsedAnswer = parseFractionAnswer(answer);
  const answerCorrect = parsedAnswer !== null && compareFractions(parsedAnswer, exactly) === 0;

  const firstValue = distribution[0]!.value;
  const heights = distribution.map((entry) => approximateProbability(entry.probability, 9));
  const axisMax = chartAxisMaximum(Math.max(...heights));
  const slot = (PLOT_RIGHT - PLOT_LEFT) / distribution.length;
  const barWidth = Math.min(56, slot * 0.62);
  const barX = (index: number) => PLOT_LEFT + slot * (index + 0.5);
  const toY = (value: number) => PLOT_BOTTOM - (value / axisMax) * (PLOT_BOTTOM - PLOT_TOP);
  const meanValue = mean.numerator / mean.denominator;
  const meanX = PLOT_LEFT + slot * (meanValue - firstValue + 0.5);
  const gridLines = Array.from({ length: 5 }, (_unused, index) => roundTo((axisMax * index) / 4, 9));

  const quantity = mode === 'bernoulli' ? 'число успехов' : experiment.quantity;
  const story =
    mode === 'bernoulli'
      ? `Схема Бернулли: ${trials} независимых испытаний, вероятность успеха в каждом равна ${success.key} (${success.story}).`
      : experiment.story;

  const description =
    `Столбчатая диаграмма распределения: по горизонтали значения случайной величины (${quantity}) ` +
    `от ${firstValue} до ${distribution.at(-1)!.value}, по вертикали вероятность от 0 до ${String(roundTo(axisMax, 3)).replace('.', ',')}. ` +
    (reveal
      ? `Вероятности значений: ${distribution
          .map((entry) => `${entry.value} — ${formatFraction(entry.probability)}`)
          .join('; ')}. Самое вероятное значение: ${peak.join(' и ')}. ` +
        `Штриховая вертикальная линия отмечает математическое ожидание ${formatFraction(mean)} ≈ ${decimal(mean, 3)}.`
      : 'Высоты столбиков скрыты до нажатия кнопки «Проверить».');

  const reset = () => {
    setMode(defaultMode);
    setTrials(defaultTrials);
    setSuccessKey(defaultSuccess.key);
    setExperimentKey(defaultExperiment.key);
    setMarkedIndex(0);
    setAnswer('');
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-ratio-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория распределений</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Случайная величина и её распределение</h3>
          <p>
            Слева таблица всех значений с точными вероятностями, справа их картина. Сумма вероятностей всегда
            равна единице — это первая проверка любой таблицы.
          </p>
        </div>
        <span className="dm-lab__badge">{mode === 'bernoulli' ? `n = ${trials}, p = ${success.key}` : `${outcomeCount} исходов`}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-ratio-tabs" role="group" aria-label="Откуда берётся случайная величина">
          {MODES.map((key) => (
            <button
              type="button"
              key={`${labId}-mode-${key}`}
              aria-pressed={mode === key}
              className={mode === key ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
              onClick={() => {
                invalidate();
                setMode(key);
                setMarkedIndex(0);
              }}
            >
              {MODE_LABELS[key]}
            </button>
          ))}
        </div>

        {mode === 'bernoulli' ? (
          <div className="dm-lab__controls dm-ratio-controls">
            <div className="dm-field">
              <label htmlFor={`${labId}-trials`}>
                Число испытаний n <span className="dm-field__value">{trials}</span>
              </label>
              <input
                id={`${labId}-trials`}
                type="range"
                min={MIN_TRIALS}
                max={MAX_TRIALS}
                step={1}
                value={trials}
                aria-describedby={`${labId}-trials-hint`}
                onChange={(event) => {
                  invalidate();
                  const next = Number(event.target.value);
                  setTrials(next);
                  if (markedIndex > next) setMarkedIndex(next);
                }}
              />
              <small id={`${labId}-trials-hint`}>
                От {MIN_TRIALS} до {MAX_TRIALS}; испытания независимы, и вероятность успеха в каждом одна и та же.
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
                  invalidate();
                  setSuccessKey(event.target.value);
                }}
              >
                {SUCCESS_OPTIONS.map((option) => (
                  <option value={option.key} key={`${labId}-p-${option.key}`}>
                    {option.key} — {option.story}
                  </option>
                ))}
              </select>
              <small id={`${labId}-success-hint`}>
                Вероятность неудачи равна q = 1 − p = {formatFraction(fraction(success.denominator - success.numerator, success.denominator))}.
              </small>
            </div>
          </div>
        ) : (
          <div className="dm-ratio-tabs" role="group" aria-label="Какой опыт рассматриваем">
            {EXPERIMENT_OPTIONS.map((option) => (
              <button
                type="button"
                key={`${labId}-exp-${option.key}`}
                aria-pressed={experimentKey === option.key}
                className={experimentKey === option.key ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
                onClick={() => {
                  invalidate();
                  setExperimentKey(option.key);
                  setMarkedIndex(0);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <p className="dm-nt-caption">{story}</p>

        <div className="dm-field">
          <label htmlFor={`${labId}-marked`}>
            Отмеченное значение X <span className="dm-field__value">{markedValue}</span>
          </label>
          <input
            id={`${labId}-marked`}
            type="range"
            min={0}
            max={distribution.length - 1}
            step={1}
            value={Math.min(markedIndex, distribution.length - 1)}
            aria-valuetext={`X = ${markedValue}`}
            aria-describedby={`${labId}-marked-hint`}
            onChange={(event) => {
              setChecked(false);
              setMarkedIndex(Number(event.target.value));
            }}
          />
          <small id={`${labId}-marked-hint`}>
            Стрелки клавиатуры двигают отметку по значениям величины; для неё считаются P(X = k), P(X ≥ k) и P(X ≤ k).
          </small>
        </div>

        <div className="dm-geometry-static-wrap" role="region" aria-label="Прокручиваемая диаграмма распределения" tabIndex={0}>
          <svg
            className="dm-ratio-graph"
            viewBox="0 0 720 288"
            role="img"
            aria-labelledby={`${labId}-chart-title ${labId}-chart-desc`}
          >
            <title id={`${labId}-chart-title`}>Распределение случайной величины</title>
            <desc id={`${labId}-chart-desc`}>{description}</desc>

            <g aria-hidden="true">
              {gridLines.map((line) => (
                <g key={`${labId}-grid-${line}`}>
                  <line className="dm-ratio-graph__grid" x1={PLOT_LEFT} y1={toY(line)} x2={PLOT_RIGHT} y2={toY(line)} />
                  <text className="dm-ratio-graph__label" x={PLOT_LEFT - 10} y={toY(line) + 4} textAnchor="end">
                    {String(roundTo(line, 3)).replace('.', ',')}
                  </text>
                </g>
              ))}

              {reveal &&
                distribution.map((entry, index) => {
                  const top = toY(heights[index]!);
                  return (
                    <g key={`${labId}-bar-${entry.value}`}>
                      {heights[index]! > 0 && (
                        <rect
                          className={
                            entry.value === markedValue
                              ? 'dm-geometry-grid-cell dm-geometry-grid-cell--full'
                              : 'dm-nt-array__cell'
                          }
                          x={barX(index) - barWidth / 2}
                          y={top}
                          width={barWidth}
                          height={PLOT_BOTTOM - top}
                          rx={4}
                        />
                      )}
                      <text className="dm-ratio-graph__label" x={barX(index)} y={top - 8} textAnchor="middle">
                        {formatFraction(entry.probability)}
                      </text>
                    </g>
                  );
                })}

              {!reveal && (
                <text
                  className="dm-ratio-graph__axis-title"
                  x={(PLOT_LEFT + PLOT_RIGHT) / 2}
                  y={(PLOT_TOP + PLOT_BOTTOM) / 2}
                  textAnchor="middle"
                >
                  высоты столбиков скрыты — посчитай сам
                </text>
              )}

              {distribution.map((entry, index) => (
                <text
                  key={`${labId}-tick-${entry.value}`}
                  className="dm-ratio-graph__axis-title"
                  x={barX(index)}
                  y={PLOT_BOTTOM + 24}
                  textAnchor="middle"
                >
                  {entry.value}
                </text>
              ))}

              {reveal && meanX >= PLOT_LEFT && meanX <= PLOT_RIGHT && (
                <>
                  <line className="dm-ratio-graph__guide" x1={meanX} y1={PLOT_TOP - 6} x2={meanX} y2={PLOT_BOTTOM} />
                  <text className="dm-ratio-graph__axis-title" x={meanX} y={PLOT_TOP - 12} textAnchor="middle">
                    M(X) = {formatFraction(mean)}
                  </text>
                </>
              )}

              <line className="dm-ratio-graph__axis" x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT + 10} y2={PLOT_BOTTOM} />
              <line className="dm-ratio-graph__axis" x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_LEFT} y2={PLOT_TOP - 10} />
              <text className="dm-ratio-graph__axis-title" x={PLOT_LEFT - 10} y={PLOT_TOP - 16} textAnchor="end">
                вероятность
              </text>
              <text className="dm-ratio-graph__axis-title" x={PLOT_RIGHT + 10} y={PLOT_BOTTOM + 50} textAnchor="end">
                {quantity}
              </text>
            </g>
          </svg>
        </div>

        {challenge && (
          <div className="dm-ratio-unit-note">
            <span aria-hidden="true">?</span>
            <div>
              <div className="dm-field">
                <label htmlFor={`${labId}-answer`}>
                  Чему равна вероятность P(X = {markedValue})? Запиши обыкновенной дробью, например 3/8
                </label>
                <input
                  id={`${labId}-answer`}
                  type="text"
                  inputMode="text"
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
                <button type="button" className="dm-button" onClick={() => setChecked(true)}>
                  Проверить
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="dm-ratio-table-wrap">
          <table className="dm-ratio-table">
            <caption>
              Таблица распределения: {quantity}
              {mode === 'bernoulli' ? `, n = ${trials}, p = ${success.key}` : `, всего ${outcomeCount} равновозможных исходов`}
            </caption>
            <thead>
              <tr>
                <th scope="col">Значение</th>
                <th scope="col">{mode === 'bernoulli' ? 'Число путей C(n, k)' : 'Благоприятных исходов'}</th>
                <th scope="col">Вероятность</th>
                <th scope="col">Приближённо</th>
              </tr>
            </thead>
            <tbody>
              {distribution.map((entry, index) => (
                <tr className={entry.value === markedValue ? 'dm-ratio-table__current' : ''} key={`${labId}-row-${entry.value}`}>
                  <th scope="row">{entry.value}</th>
                  <td>
                    {mode === 'bernoulli'
                      ? formatCount(combinations(trials, index))
                      : (entry.probability.numerator * outcomeCount) / entry.probability.denominator}
                  </td>
                  <td>{reveal ? formatFraction(entry.probability) : '?'}</td>
                  <td>{reveal ? decimal(entry.probability) : '?'}</td>
                </tr>
              ))}
              <tr className="dm-ratio-table__answer">
                <th scope="row">Сумма</th>
                <td>{mode === 'bernoulli' ? formatCount(2n ** BigInt(trials)) : outcomeCount}</td>
                <td>1</td>
                <td>1</td>
              </tr>
            </tbody>
          </table>
          <p className="dm-nt-note">
            {mode === 'bernoulli'
              ? `Второй столбец — строка треугольника Паскаля с номером ${trials}; её сумма равна 2^${trials}. Числа путей одинаковы при любом p, а вероятности — нет.`
              : 'Второй столбец — просто число благоприятных исходов; вероятность получается делением на общее число равновозможных исходов.'}
          </p>
        </div>

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">
            {reveal ? (challenge ? (answerCorrect ? '✓' : '×') : 'Σ') : '?'}
          </span>
          <p>
            <strong>
              {!reveal
                ? `Посчитай P(X = ${markedValue}) сам, запиши дробь и нажми «Проверить».`
                : `P(X = ${markedValue}) = ${formatFraction(exactly)} ≈ ${decimal(exactly)}; ` +
                  `P(X ≥ ${markedValue}) = ${formatFraction(atLeast)}; P(X ≤ ${markedValue}) = ${formatFraction(atMost)}.`}
            </strong>
            <small>
              {reveal
                ? `Математическое ожидание M(X) = ${formatFraction(mean)} ≈ ${decimal(mean, 3)}. ` +
                  `Самое вероятное значение — ${peak.join(' и ')}. ` +
                  (mode === 'bernoulli'
                    ? `Проверка формулой: M(X) = n·p = ${trials}·${success.key} = ${formatFraction(mean)}. ` +
                      `Ожидание почти никогда не совпадает с самым вероятным значением и вовсе не обязано быть целым.`
                    : 'Ожидание — это «центр тяжести» распределения, а не самое частое значение: у несимметричной картинки они расходятся.')
                : mode === 'bernoulli'
                  ? `Подсказка: перемножь три множителя — число путей C(${trials}, ${markedValue}), степень p и степень q.`
                  : 'Подсказка: сосчитай благоприятные исходы во втором столбце и раздели на общее число исходов.'}
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
