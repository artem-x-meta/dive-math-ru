import { useId, useMemo, useState } from 'react';
import {
  fairPrice,
  gameDistribution,
  netExpectation,
  standardDeviation,
  varianceThroughSquares,
  type GameOutcome,
} from '../lib/stochastics';
import { distributionVariance } from '../lib/conditional';
import {
  compareFractions,
  decimalToFraction,
  formatFraction,
  fraction,
  fractionToNumber,
  multiplyFractions,
  subtractFractions,
  type Fraction,
} from '../lib/probability';
import { chartAxisMaximum, roundTo } from '../lib/statistics';

export type StochGameKey = 'cube' | 'steady' | 'jackpot' | 'bike';

interface GameDefinition {
  readonly label: string;
  readonly headline: string;
  readonly story: string;
  readonly priceName: string;
  readonly payoffName: string;
  readonly defaultPrice: number;
  readonly minPrice: number;
  readonly maxPrice: number;
  readonly step: number;
  readonly outcomes: readonly GameOutcome[];
}

const GAMES: Readonly<Record<StochGameKey, GameDefinition>> = {
  cube: {
    label: 'Аттракцион с кубиком',
    headline: 'Бросок кубика за фиксированную плату',
    story: 'Платишь за вход, бросаешь кубик и получаешь 10 ₽ за каждое выпавшее очко.',
    priceName: 'Цена броска, ₽',
    payoffName: 'выплата за бросок',
    defaultPrice: 40,
    minPrice: 0,
    maxPrice: 70,
    step: 5,
    outcomes: [1, 2, 3, 4, 5, 6].map((face) => ({
      label: `${face} очков`,
      payoff: 10 * face,
      probability: { numerator: 1, denominator: 6 },
    })),
  },
  steady: {
    label: 'Надёжный конверт',
    headline: 'Один из двух почти одинаковых конвертов',
    story: 'В коробке два конверта: с 30 ₽ и с 40 ₽. Ты вслепую берёшь один.',
    priceName: 'Цена попытки, ₽',
    payoffName: 'содержимое конверта',
    defaultPrice: 35,
    minPrice: 20,
    maxPrice: 50,
    step: 1,
    outcomes: [
      { label: 'меньший конверт', payoff: 30, probability: { numerator: 1, denominator: 2 } },
      { label: 'больший конверт', payoff: 40, probability: { numerator: 1, denominator: 2 } },
    ],
  },
  jackpot: {
    label: 'Джекпот',
    headline: 'Почти всегда ноль, изредка много',
    story: 'Из ста билетов ровно один приносит 3500 ₽, остальные пустые.',
    priceName: 'Цена билета, ₽',
    payoffName: 'выигрыш по билету',
    defaultPrice: 50,
    minPrice: 0,
    maxPrice: 100,
    step: 5,
    outcomes: [
      { label: 'пусто', payoff: 0, probability: { numerator: 99, denominator: 100 } },
      { label: 'джекпот', payoff: 3500, probability: { numerator: 1, denominator: 100 } },
    ],
  },
  bike: {
    label: 'Страховка велосипеда',
    headline: 'Сколько за год выплатит страховая компания',
    story: 'За год велосипед за 20 000 ₽ пропадает у одного владельца из пятидесяти; тогда страховая возмещает всю сумму.',
    priceName: 'Взнос за полис, ₽',
    payoffName: 'выплата страховой за год',
    defaultPrice: 700,
    minPrice: 0,
    maxPrice: 2000,
    step: 50,
    outcomes: [
      { label: 'ничего не случилось', payoff: 0, probability: { numerator: 49, denominator: 50 } },
      { label: 'велосипед пропал', payoff: 20_000, probability: { numerator: 1, denominator: 50 } },
    ],
  },
};

const GAME_KEYS: readonly StochGameKey[] = ['cube', 'steady', 'jackpot', 'bike'];

const PLOT_LEFT = 86;
const PLOT_RIGHT = 686;
const PLOT_TOP = 34;
const PLOT_BOTTOM = 224;
const BAR_WIDTH = 18;

function safeGame(value: StochGameKey | undefined): StochGameKey {
  return value !== undefined && value in GAMES ? value : 'cube';
}

function clampPrice(value: number | undefined, game: GameDefinition): number {
  if (value === undefined || !Number.isFinite(value)) return game.defaultPrice;
  const stepped = Math.round(value / game.step) * game.step;
  return Math.min(game.maxPrice, Math.max(game.minPrice, stepped));
}

function decimal(value: number, digits = 2): string {
  return String(roundTo(value, digits)).replace('.', ',');
}

function exactDecimal(value: Fraction, digits = 2): string {
  return decimal(fractionToNumber(value), digits);
}

/** Разбирает ответ «35», «35,5» или «71/2»; иначе возвращает null. */
function parseMoneyAnswer(text: string): Fraction | null {
  const normalized = text.replace(/[\s  ₽]/g, '').replace(',', '.');
  if (normalized === '') return null;
  const asFraction = /^(-?\d{1,12})\/(\d{1,12})$/.exec(normalized);
  if (asFraction !== null) {
    const denominator = Number(asFraction[2]);
    if (denominator === 0) return null;
    return fraction(Number(asFraction[1]), denominator);
  }
  if (!/^-?\d{1,12}(?:\.\d{1,6})?$/.test(normalized)) return null;
  return decimalToFraction(Number(normalized));
}

export interface StochExpectLabProps {
  initialGame?: StochGameKey;
  initialPrice?: number;
  /** Показывать столбцы дисперсии, полосу ±σ и строку со стандартным отклонением. */
  showSpread?: boolean;
  challenge?: boolean;
}

export default function StochExpectLab({
  initialGame,
  initialPrice,
  showSpread = false,
  challenge = false,
}: StochExpectLabProps) {
  const reactId = useId();
  const labId = `stoch-expect-${reactId.replace(/:/g, '')}`;
  const defaultKey = safeGame(initialGame);
  const defaultPrice = clampPrice(initialPrice, GAMES[defaultKey]);

  const [gameKey, setGameKey] = useState<StochGameKey>(defaultKey);
  const [price, setPrice] = useState(defaultPrice);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const game = GAMES[gameKey];
  const entries = useMemo(() => gameDistribution(game.outcomes), [game]);

  const mean = fairPrice(entries);
  const variance = distributionVariance(entries);
  const deviation = standardDeviation(entries);
  const net = netExpectation(entries, price);
  const meanValue = fractionToNumber(mean);
  const netValue = fractionToNumber(net);

  const reveal = !challenge || checked;
  const parsedAnswer = parseMoneyAnswer(answer);
  const answerCorrect = parsedAnswer !== null && compareFractions(parsedAnswer, mean) === 0;

  const values = entries.map((entry) => entry.value);
  const lowRaw = Math.min(...values, meanValue - deviation, price);
  const highRaw = Math.max(...values, meanValue + deviation, price);
  const padding = (highRaw - lowRaw) * 0.08 || 1;
  const axisLow = lowRaw - padding;
  const axisHigh = highRaw + padding;
  const toX = (value: number) => PLOT_LEFT + ((value - axisLow) / (axisHigh - axisLow)) * (PLOT_RIGHT - PLOT_LEFT);

  const probabilities = entries.map((entry) => fractionToNumber(entry.probability));
  const axisMax = chartAxisMaximum(Math.max(...probabilities));
  const toY = (value: number) => PLOT_BOTTOM - (value / axisMax) * (PLOT_BOTTOM - PLOT_TOP);
  const gridLines = Array.from({ length: 5 }, (_unused, index) => roundTo((axisMax * index) / 4, 9));

  const verdict =
    net.numerator === 0
      ? 'цена совпадает со справедливой: в среднем никто не в выигрыше'
      : net.numerator > 0
        ? 'цена ниже справедливой: в длинной серии выигрывает игрок'
        : 'цена выше справедливой: в длинной серии выигрывает организатор';

  const description =
    `Столбчатая диаграмма распределения: по горизонтали ${game.payoffName} от ${Math.min(...values)} до ${Math.max(...values)} ₽, ` +
    `по вертикали вероятность от 0 до ${decimal(axisMax, 3)}. ` +
    (reveal
      ? `Вероятности: ${entries.map((entry) => `${entry.value} ₽ — ${formatFraction(entry.probability)}`).join('; ')}. ` +
        `Штриховая линия отмечает математическое ожидание ${exactDecimal(mean)} ₽, ` +
        `кружок на оси — назначенную цену ${decimal(price)} ₽.` +
        (showSpread ? ` Прямоугольник закрывает полосу от ${decimal(meanValue - deviation)} до ${decimal(meanValue + deviation)} ₽ — это M(X) ± σ.` : '')
      : 'Ожидание и полоса разброса скрыты до нажатия кнопки «Проверить».');

  const reset = () => {
    setGameKey(defaultKey);
    setPrice(defaultPrice);
    setAnswer('');
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-ratio-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория ожидания</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Справедливая цена случайной выплаты</h3>
          <p>
            Ожидание — это центр тяжести распределения. Назначь цену и посмотри, в какую сторону
            наклоняется длинная серия повторений.
          </p>
        </div>
        <span className="dm-lab__badge">{reveal ? `M(X) = ${exactDecimal(mean)} ₽` : 'M(X) = ?'}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-ratio-tabs" role="group" aria-label="Какую игру рассматриваем">
          {GAME_KEYS.map((key) => (
            <button
              type="button"
              key={`${labId}-game-${key}`}
              aria-pressed={gameKey === key}
              className={gameKey === key ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
              onClick={() => {
                setGameKey(key);
                setPrice(GAMES[key].defaultPrice);
                setAnswer('');
                setChecked(false);
              }}
            >
              {GAMES[key].label}
            </button>
          ))}
        </div>

        <p className="dm-nt-caption">
          <strong>{game.headline}.</strong> {game.story}
        </p>

        <div className="dm-lab__controls dm-ratio-controls">
          <div className="dm-field">
            <label htmlFor={`${labId}-price`}>
              {game.priceName} <span className="dm-field__value">{decimal(price, 0)}</span>
            </label>
            <input
              id={`${labId}-price`}
              type="range"
              min={game.minPrice}
              max={game.maxPrice}
              step={game.step}
              value={price}
              aria-valuetext={`${price} рублей`}
              aria-describedby={`${labId}-price-hint`}
              onChange={(event) => setPrice(Number(event.target.value))}
            />
            <small id={`${labId}-price-hint`}>
              Стрелки клавиатуры меняют цену шагом {game.step} ₽. Цена не влияет на распределение выплаты —
              она сдвигает только чистый результат.
            </small>
          </div>
        </div>

        <div className="dm-geometry-static-wrap" role="region" aria-label="Прокручиваемая диаграмма распределения выплаты" tabIndex={0}>
          <svg
            className="dm-ratio-graph"
            viewBox="0 0 720 292"
            role="img"
            aria-labelledby={`${labId}-chart-title ${labId}-chart-desc`}
          >
            <title id={`${labId}-chart-title`}>Распределение выплаты и её ожидание</title>
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

              {reveal && showSpread && (
                <rect
                  className="dm-geometry-grid-cell--partial"
                  x={Math.max(PLOT_LEFT, toX(meanValue - deviation))}
                  y={PLOT_TOP}
                  width={Math.max(2, Math.min(PLOT_RIGHT, toX(meanValue + deviation)) - Math.max(PLOT_LEFT, toX(meanValue - deviation)))}
                  height={PLOT_BOTTOM - PLOT_TOP}
                  rx={4}
                />
              )}

              {entries.map((entry, index) => {
                const top = toY(probabilities[index]!);
                return (
                  <g key={`${labId}-bar-${entry.value}`}>
                    <rect
                      className="dm-nt-array__cell"
                      x={toX(entry.value) - BAR_WIDTH / 2}
                      y={top}
                      width={BAR_WIDTH}
                      height={PLOT_BOTTOM - top}
                      rx={3}
                    />
                    <text className="dm-ratio-graph__label" x={toX(entry.value)} y={top - 8} textAnchor="middle">
                      {formatFraction(entry.probability)}
                    </text>
                    <text className="dm-ratio-graph__axis-title" x={toX(entry.value)} y={PLOT_BOTTOM + 22} textAnchor="middle">
                      {entry.value}
                    </text>
                  </g>
                );
              })}

              {reveal && (
                <>
                  <line className="dm-ratio-graph__guide" x1={toX(meanValue)} y1={PLOT_TOP - 8} x2={toX(meanValue)} y2={PLOT_BOTTOM} />
                  <text className="dm-ratio-graph__axis-title" x={toX(meanValue)} y={PLOT_TOP - 14} textAnchor="middle">
                    M(X) = {exactDecimal(mean)} ₽
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
                  ожидание скрыто — оцени его сам
                </text>
              )}

              <circle className="dm-ratio-graph__unit" cx={toX(price)} cy={PLOT_BOTTOM} r={7} />
              <text className="dm-ratio-graph__axis-title" x={toX(price)} y={PLOT_BOTTOM + 44} textAnchor="middle">
                цена {decimal(price, 0)} ₽
              </text>

              <line className="dm-ratio-graph__axis" x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT + 10} y2={PLOT_BOTTOM} />
              <line className="dm-ratio-graph__axis" x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_LEFT} y2={PLOT_TOP - 10} />
              <text className="dm-ratio-graph__axis-title" x={PLOT_LEFT - 10} y={PLOT_TOP - 18} textAnchor="end">
                вероятность
              </text>
              <text className="dm-ratio-graph__axis-title" x={PLOT_RIGHT + 10} y={PLOT_BOTTOM + 66} textAnchor="end">
                {game.payoffName}, ₽
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
                  Чему равно M(X) — справедливая цена этой игры в рублях? Можно записать дробью, например 71/2
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
            <caption>Как складывается ожидание: {game.payoffName}</caption>
            <thead>
              <tr>
                <th scope="col">Исход</th>
                <th scope="col">Выплата x, ₽</th>
                <th scope="col">Вероятность p</th>
                <th scope="col">Вклад x · p</th>
                {showSpread && <th scope="col">Вклад (x − M)² · p</th>}
              </tr>
            </thead>
            <tbody>
              {game.outcomes.map((outcome, index) => {
                const probability = fraction(outcome.probability.numerator, outcome.probability.denominator);
                const contribution = multiplyFractions(fraction(outcome.payoff, 1), probability);
                const gap = subtractFractions(fraction(outcome.payoff, 1), mean);
                const squareContribution = multiplyFractions(multiplyFractions(gap, gap), probability);
                return (
                  <tr key={`${labId}-row-${index}`}>
                    <th scope="row">{outcome.label}</th>
                    <td>{outcome.payoff}</td>
                    <td>{formatFraction(probability)}</td>
                    <td>{reveal ? exactDecimal(contribution, 2) : '?'}</td>
                    {showSpread && <td>{reveal ? exactDecimal(squareContribution, 2) : '?'}</td>}
                  </tr>
                );
              })}
              <tr className="dm-ratio-table__answer">
                <th scope="row">Сумма</th>
                <td>—</td>
                <td>1</td>
                <td>{reveal ? `M(X) = ${exactDecimal(mean)}` : '?'}</td>
                {showSpread && <td>{reveal ? `D(X) = ${exactDecimal(variance)}` : '?'}</td>}
              </tr>
            </tbody>
          </table>
          <p className="dm-nt-note">
            Третий столбец — не выплата и не вероятность, а их произведение: вклад исхода в среднее.
            {showSpread
              ? ' Последний столбец устроен так же, но взвешивает квадраты отклонений — из его суммы получается дисперсия.'
              : ' Сумма всех вкладов и есть математическое ожидание.'}
          </p>
        </div>

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">
            {reveal ? (challenge ? (answerCorrect ? '✓' : '×') : 'M') : '?'}
          </span>
          <p>
            <strong>
              {!reveal
                ? 'Посчитай сумму произведений x · p, запиши ответ и нажми «Проверить».'
                : `M(X) = ${formatFraction(mean)} ₽ — справедливая цена. При цене ${decimal(price, 0)} ₽ ожидание чистого результата равно ${decimal(netValue)} ₽ за попытку.`}
            </strong>
            <small>
              {reveal
                ? (showSpread
                    ? `D(X) = ${formatFraction(variance)} ≈ ${exactDecimal(variance)}, σ(X) = ${decimal(deviation)} ₽; ` +
                      `проверка через квадраты: M(X²) − M(X)² = ${exactDecimal(varianceThroughSquares(entries))}. ` +
                      `Полоса M(X) ± σ — это от ${decimal(meanValue - deviation)} до ${decimal(meanValue + deviation)} ₽. `
                    : '') +
                  `Итог: ${verdict}. За 100 повторений ожидаемый результат равен ${decimal(netValue * 100, 0)} ₽, ` +
                  'но отдельная попытка может закончиться как угодно.'
                : 'Подсказка: умножь каждую выплату на её вероятность и сложи все произведения.'}
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
