import { useId, useMemo, useState } from 'react';
import {
  expectedIndependentCount,
  isTableIndependent,
  leftCount,
  leftGivenNotRight,
  leftGivenRight,
  matchesProbability,
  naturalFrequencies,
  negativePredictiveValue,
  parseAnswerFraction,
  positivePredictiveValue,
  probabilityOfBoth,
  probabilityOfLeft,
  probabilityOfRight,
  rightCount,
  rightGivenLeft,
  screeningToTable,
  smallestExactPopulation,
  tableTotal,
  type TwoWayTable,
} from '../lib/conditional';
import { approximateProbability, formatCount } from '../lib/combinatorics';
import { formatFraction, type Fraction } from '../lib/probability';

export type CondTableMode = 'table' | 'screening';
export type CondScenarioKey = 'homework' | 'machines' | 'pets';

export interface CondTableLabProps {
  mode?: CondTableMode;
  initialScenario?: CondScenarioKey;
  /** Доля больных: ключ из списка ниже, например «1/100». */
  initialPrevalence?: string;
  /** Чувствительность теста: «0,9», «0,95», «0,99» или «0,8». */
  initialSensitivity?: string;
  /** Специфичность теста: те же значения. */
  initialSpecificity?: string;
  challenge?: boolean;
}

interface Scenario {
  readonly key: CondScenarioKey;
  readonly button: string;
  readonly story: string;
  /** Единица счёта во множественном числе: «учеников», «деталей». */
  readonly unit: string;
  readonly leftLabel: string;
  readonly leftNegativeLabel: string;
  readonly rightLabel: string;
  readonly rightNegativeLabel: string;
  readonly table: TwoWayTable;
}

const SCENARIOS: readonly Scenario[] = [
  {
    key: 'homework',
    button: 'Домашняя работа',
    story:
      'В параллели 250 учеников. Классный руководитель сверил, кто делал домашнюю работу всю четверть, и кто справился с контрольной.',
    unit: 'учеников',
    leftLabel: 'делал домашнюю работу',
    leftNegativeLabel: 'не делал',
    rightLabel: 'справился с контрольной',
    rightNegativeLabel: 'не справился',
    table: { both: 80, leftOnly: 20, rightOnly: 45, neither: 105 },
  },
  {
    key: 'machines',
    button: 'Два станка',
    story:
      'На складе 200 деталей: часть сделал станок №1, остальные — станок №2. Контролёр отметил, какие детали оказались бракованными.',
    unit: 'деталей',
    leftLabel: 'станок №1',
    leftNegativeLabel: 'станок №2',
    rightLabel: 'брак',
    rightNegativeLabel: 'годная',
    table: { both: 6, leftOnly: 114, rightOnly: 4, neither: 76 },
  },
  {
    key: 'pets',
    button: 'Коты и собаки',
    story:
      'Опрос 250 школьников: у кого дома живёт кот, у кого — собака. Кто-то отметил обоих, кто-то никого.',
    unit: 'школьников',
    leftLabel: 'есть кот',
    leftNegativeLabel: 'кота нет',
    rightLabel: 'есть собака',
    rightNegativeLabel: 'собаки нет',
    table: { both: 60, leftOnly: 40, rightOnly: 60, neither: 90 },
  },
];

interface ShareOption {
  readonly key: string;
  readonly label: string;
}

const PREVALENCE_OPTIONS: readonly ShareOption[] = [
  { key: '1/20', label: '1 из 20 — 5 % населения' },
  { key: '1/100', label: '1 из 100 — 1 % населения' },
  { key: '1/200', label: '1 из 200 — 0,5 % населения' },
  { key: '1/1000', label: '1 из 1000 — 0,1 % населения' },
];

const ACCURACY_OPTIONS: readonly ShareOption[] = [
  { key: '0,8', label: '80 %' },
  { key: '0,9', label: '90 %' },
  { key: '0,95', label: '95 %' },
  { key: '0,99', label: '99 %' },
];

const MAX_CELL = 20_000;
const CELL_KEYS = Object.freeze(['both', 'leftOnly', 'rightOnly', 'neither'] as const);
type CellKey = (typeof CELL_KEYS)[number];

const PLOT = { x: 104, y: 66, width: 470, height: 200 };

function safeScenario(value: CondScenarioKey | undefined): Scenario {
  return SCENARIOS.find((scenario) => scenario.key === value) ?? SCENARIOS[0]!;
}

function safeShare(options: readonly ShareOption[], value: string | undefined, fallback: string): string {
  return options.some((option) => option.key === value) ? (value as string) : fallback;
}

function toCount(draft: string): number {
  if (!/^\d{1,5}$/.test(draft)) return 0;
  return Math.min(MAX_CELL, Number(draft));
}

function decimal(value: Fraction, digits = 4): string {
  return String(approximateProbability(value, digits)).replace('.', ',');
}

function people(count: number): string {
  return formatCount(BigInt(count));
}

/** Короткая подпись на картинке: дробь, пока она читаемая, иначе десятичное приближение. */
function shortProbability(value: Fraction): string {
  return value.denominator <= 100 ? formatFraction(value) : `≈ ${decimal(value, 4)}`;
}

export default function CondTableLab({
  mode = 'table',
  initialScenario,
  initialPrevalence,
  initialSensitivity,
  initialSpecificity,
  challenge = false,
}: CondTableLabProps) {
  const reactId = useId();
  const labId = `cond-table-${reactId.replace(/:/g, '')}`;
  const activeMode: CondTableMode = mode === 'screening' ? 'screening' : 'table';

  const defaultScenario = safeScenario(initialScenario);
  const defaultPrevalence = safeShare(PREVALENCE_OPTIONS, initialPrevalence, '1/100');
  const defaultSensitivity = safeShare(ACCURACY_OPTIONS, initialSensitivity, '0,9');
  const defaultSpecificity = safeShare(ACCURACY_OPTIONS, initialSpecificity, '0,9');

  const [scenarioKey, setScenarioKey] = useState<CondScenarioKey>(defaultScenario.key);
  const [cells, setCells] = useState<Record<CellKey, string>>(() => ({
    both: String(defaultScenario.table.both),
    leftOnly: String(defaultScenario.table.leftOnly),
    rightOnly: String(defaultScenario.table.rightOnly),
    neither: String(defaultScenario.table.neither),
  }));
  const [prevalence, setPrevalence] = useState(defaultPrevalence);
  const [sensitivity, setSensitivity] = useState(defaultSensitivity);
  const [specificity, setSpecificity] = useState(defaultSpecificity);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const scenario = safeScenario(scenarioKey);

  const screening = useMemo(() => {
    const shares = { prevalence, sensitivity, specificity };
    const population = smallestExactPopulation(shares, 10_000);
    return naturalFrequencies({ ...shares, population });
  }, [prevalence, sensitivity, specificity]);

  const table: TwoWayTable = useMemo(() => {
    if (activeMode === 'screening') return screeningToTable(screening);
    return {
      both: toCount(cells.both),
      leftOnly: toCount(cells.leftOnly),
      rightOnly: toCount(cells.rightOnly),
      neither: toCount(cells.neither),
    };
  }, [activeMode, cells, screening]);

  const labels = activeMode === 'screening'
    ? {
      unit: 'человек',
      leftLabel: 'болен',
      leftNegativeLabel: 'здоров',
      rightLabel: 'тест положительный',
      rightNegativeLabel: 'тест отрицательный',
    }
    : {
      unit: scenario.unit,
      leftLabel: scenario.leftLabel,
      leftNegativeLabel: scenario.leftNegativeLabel,
      rightLabel: scenario.rightLabel,
      rightNegativeLabel: scenario.rightNegativeLabel,
    };

  const total = table.both + table.leftOnly + table.rightOnly + table.neither;
  const empty = total === 0;
  const withLeft = table.both + table.leftOnly;
  const withoutLeft = table.rightOnly + table.neither;
  const withRight = table.both + table.rightOnly;
  const withoutRight = table.leftOnly + table.neither;

  const stats = useMemo(() => {
    if (empty) return null;
    const checkedTable = { ...table };
    return {
      total: tableTotal(checkedTable),
      left: probabilityOfLeft(checkedTable),
      right: probabilityOfRight(checkedTable),
      both: probabilityOfBoth(checkedTable),
      leftCountValue: leftCount(checkedTable),
      rightCountValue: rightCount(checkedTable),
      leftGiven: withRight > 0 ? leftGivenRight(checkedTable) : null,
      rightGiven: withLeft > 0 ? rightGivenLeft(checkedTable) : null,
      leftGivenNot: withoutRight > 0 ? leftGivenNotRight(checkedTable) : null,
      independent: isTableIndependent(checkedTable),
      expectedBoth: expectedIndependentCount(checkedTable),
    };
  }, [empty, table, withLeft, withRight, withoutRight]);

  /** Величина, которую спрашивает режим задачи. */
  const target: Fraction | null = activeMode === 'screening'
    ? (withRight > 0 ? positivePredictiveValue(screening) : null)
    : (stats?.leftGiven ?? null);

  const reveal = !challenge || checked;
  const parsedAnswer = parseAnswerFraction(answer);
  const answerCorrect = parsedAnswer !== null && target !== null && matchesProbability(parsedAnswer, target);

  const columnWidth = empty ? 0 : (withLeft / total) * PLOT.width;
  const secondColumnWidth = PLOT.width - columnWidth;
  const bothHeight = withLeft === 0 ? 0 : (table.both / withLeft) * PLOT.height;
  const rightOnlyHeight = withoutLeft === 0 ? 0 : (table.rightOnly / withoutLeft) * PLOT.height;
  const marginalHeight = empty ? 0 : (withRight / total) * PLOT.height;

  const rectangles = [
    {
      key: 'both',
      x: PLOT.x,
      y: PLOT.y,
      width: columnWidth,
      height: bothHeight,
      count: table.both,
      className: 'dm-geometry-grid-cell dm-geometry-grid-cell--full',
    },
    {
      key: 'leftOnly',
      x: PLOT.x,
      y: PLOT.y + bothHeight,
      width: columnWidth,
      height: PLOT.height - bothHeight,
      count: table.leftOnly,
      className: 'dm-geometry-grid-cell dm-geometry-grid-cell--empty',
    },
    {
      key: 'rightOnly',
      x: PLOT.x + columnWidth,
      y: PLOT.y,
      width: secondColumnWidth,
      height: rightOnlyHeight,
      count: table.rightOnly,
      className: 'dm-geometry-grid-cell dm-geometry-grid-cell--partial',
    },
    {
      key: 'neither',
      x: PLOT.x + columnWidth,
      y: PLOT.y + rightOnlyHeight,
      width: secondColumnWidth,
      height: PLOT.height - rightOnlyHeight,
      count: table.neither,
      className: 'dm-geometry-grid-cell dm-geometry-grid-cell--empty',
    },
  ];

  const description = empty
    ? 'В таблице пока нет ни одного объекта, поэтому прямоугольник не построен.'
    : `Прямоугольник разбит на четыре части. Левый столбец шириной ${decimal(probabilityOfLeft(table), 3)} от всей ширины — ` +
      `это «${labels.leftLabel}», в нём ${people(withLeft)} из ${people(total)}. Правый столбец — «${labels.leftNegativeLabel}», в нём ${people(withoutLeft)}. ` +
      `Верхняя часть каждого столбца отвечает событию «${labels.rightLabel}»: слева ${people(table.both)} из ${people(withLeft)}, ` +
      `справа ${people(table.rightOnly)} из ${people(withoutLeft)}. Штриховая горизонтальная линия стоит на уровне ` +
      `безусловной доли ${shortProbability(probabilityOfRight(table))}. ` +
      (stats?.independent
        ? 'Верхние части обоих столбцов заканчиваются ровно на этой линии — признаки независимы.'
        : 'Верхние части столбцов заканчиваются на разной высоте, поэтому условная доля зависит от столбца.');

  const reset = () => {
    setScenarioKey(defaultScenario.key);
    setCells({
      both: String(defaultScenario.table.both),
      leftOnly: String(defaultScenario.table.leftOnly),
      rightOnly: String(defaultScenario.table.rightOnly),
      neither: String(defaultScenario.table.neither),
    });
    setPrevalence(defaultPrevalence);
    setSensitivity(defaultSensitivity);
    setSpecificity(defaultSpecificity);
    setAnswer('');
    setChecked(false);
  };

  const applyScenario = (key: CondScenarioKey) => {
    const next = safeScenario(key);
    setScenarioKey(next.key);
    setCells({
      both: String(next.table.both),
      leftOnly: String(next.table.leftOnly),
      rightOnly: String(next.table.rightOnly),
      neither: String(next.table.neither),
    });
    setAnswer('');
    setChecked(false);
  };

  const editCell = (key: CellKey, rawValue: string) => {
    if (!/^\d{0,5}$/.test(rawValue)) return;
    setCells((previous) => ({ ...previous, [key]: rawValue }));
    setChecked(false);
  };

  const cellFields: { key: CellKey; label: string }[] = [
    { key: 'both', label: `${labels.leftLabel} и ${labels.rightLabel}` },
    { key: 'leftOnly', label: `${labels.leftLabel}, но ${labels.rightNegativeLabel}` },
    { key: 'rightOnly', label: `${labels.leftNegativeLabel}, но ${labels.rightLabel}` },
    { key: 'neither', label: `${labels.leftNegativeLabel} и ${labels.rightNegativeLabel}` },
  ];

  const questionText = activeMode === 'screening'
    ? 'Чему равна вероятность того, что человек с положительным тестом действительно болен?'
    : `Чему равна условная вероятность P(${labels.leftLabel} | ${labels.rightLabel})?`;

  return (
    <section className="dm-lab dm-ratio-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория условной вероятности</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {activeMode === 'screening' ? 'Природные частоты: тест на редкую болезнь' : 'Таблица частот и условная доля'}
          </h3>
          <p>
            {activeMode === 'screening'
              ? 'Вместо процентов и формул — живые люди. Группа раскладывается по четырём клеткам целыми числами, и условная вероятность считается делением одного числа на другое.'
              : 'Условие сужает группу: мы смотрим не на всех, а только на один столбец таблицы. Меняй частоты и следи, как расходятся доли.'}
          </p>
        </div>
        <span className="dm-lab__badge">
          {activeMode === 'screening' ? `${people(screening.population)} человек` : `n = ${people(total)}`}
        </span>
      </header>

      <div className="dm-lab__body">
        {activeMode === 'table' ? (
          <>
            <div className="dm-ratio-tabs" role="group" aria-label="Готовые наборы данных">
              {SCENARIOS.map((option) => (
                <button
                  type="button"
                  key={`${labId}-scenario-${option.key}`}
                  aria-pressed={scenarioKey === option.key}
                  className={scenarioKey === option.key ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
                  onClick={() => applyScenario(option.key)}
                >
                  {option.button}
                </button>
              ))}
            </div>

            <p className="dm-nt-caption">{scenario.story}</p>

            <div className="dm-lab__controls dm-lab__controls--four">
              {cellFields.map((field) => (
                <div className="dm-field" key={`${labId}-cell-${field.key}`}>
                  <label htmlFor={`${labId}-${field.key}`}>{field.label}</label>
                  <input
                    id={`${labId}-${field.key}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_CELL}
                    step={1}
                    value={cells[field.key]}
                    aria-describedby={`${labId}-cells-hint`}
                    onChange={(event) => editCell(field.key, event.target.value)}
                  />
                </div>
              ))}
            </div>
            <p className="dm-nt-note" id={`${labId}-cells-hint`}>
              Каждый объект попадает ровно в одну клетку, поэтому четыре числа в сумме дают всю группу: {people(total)} {labels.unit}.
            </p>
          </>
        ) : (
          <>
            <div className="dm-lab__controls dm-ratio-controls">
              <div className="dm-field">
                <label htmlFor={`${labId}-prevalence`}>Как часто встречается болезнь</label>
                <select
                  id={`${labId}-prevalence`}
                  value={prevalence}
                  onChange={(event) => {
                    setPrevalence(event.target.value);
                    setChecked(false);
                  }}
                >
                  {PREVALENCE_OPTIONS.map((option) => (
                    <option value={option.key} key={`${labId}-prev-${option.key}`}>{option.label}</option>
                  ))}
                </select>
                <small>Больных в группе: {people(screening.sick)} из {people(screening.population)}.</small>
              </div>
              <div className="dm-field">
                <label htmlFor={`${labId}-sensitivity`}>Чувствительность: тест находит больного</label>
                <select
                  id={`${labId}-sensitivity`}
                  value={sensitivity}
                  onChange={(event) => {
                    setSensitivity(event.target.value);
                    setChecked(false);
                  }}
                >
                  {ACCURACY_OPTIONS.map((option) => (
                    <option value={option.key} key={`${labId}-sens-${option.key}`}>{option.label}</option>
                  ))}
                </select>
                <small>Из {people(screening.sick)} больных тест поймает {people(screening.truePositive)}.</small>
              </div>
              <div className="dm-field">
                <label htmlFor={`${labId}-specificity`}>Специфичность: тест не тревожит здорового</label>
                <select
                  id={`${labId}-specificity`}
                  value={specificity}
                  onChange={(event) => {
                    setSpecificity(event.target.value);
                    setChecked(false);
                  }}
                >
                  {ACCURACY_OPTIONS.map((option) => (
                    <option value={option.key} key={`${labId}-spec-${option.key}`}>{option.label}</option>
                  ))}
                </select>
                <small>Из {people(screening.healthy)} здоровых тест ошибётся на {people(screening.falsePositive)}.</small>
              </div>
            </div>
            <p className="dm-nt-note">
              Численность группы подобрана так, чтобы все четыре числа получились целыми: ни одного округления.
            </p>
          </>
        )}

        <div className="dm-geometry-static-wrap" role="region" aria-label="Прокручиваемый прямоугольник частот" tabIndex={0}>
          <svg
            className="dm-geometry-static"
            viewBox="0 0 640 340"
            role="img"
            aria-labelledby={`${labId}-svg-title ${labId}-svg-desc`}
          >
            <title id={`${labId}-svg-title`}>Прямоугольник частот: ширина столбца — условие, высота — условная доля</title>
            <desc id={`${labId}-svg-desc`}>{description}</desc>

            {!empty && (
              <g aria-hidden="true">
                {rectangles.map((rectangle) => (
                  <g key={`${labId}-rect-${rectangle.key}`}>
                    <rect
                      className={rectangle.className}
                      x={rectangle.x}
                      y={rectangle.y}
                      width={Math.max(0, rectangle.width)}
                      height={Math.max(0, rectangle.height)}
                    />
                    {rectangle.width >= 52 && rectangle.height >= 26 && (
                      <text x={rectangle.x + rectangle.width / 2} y={rectangle.y + rectangle.height / 2 + 6} textAnchor="middle">
                        {people(rectangle.count)}
                      </text>
                    )}
                  </g>
                ))}

                <line
                  className="dm-geometry-static__axis"
                  x1={PLOT.x - 12}
                  y1={PLOT.y + marginalHeight}
                  x2={PLOT.x + PLOT.width + 12}
                  y2={PLOT.y + marginalHeight}
                />
                <text x={PLOT.x - 18} y={PLOT.y + marginalHeight + 5} textAnchor="end">
                  {shortProbability(probabilityOfRight(table))}
                </text>

                <line
                  className="dm-geometry-static__guide"
                  x1={PLOT.x + columnWidth}
                  y1={PLOT.y}
                  x2={PLOT.x + columnWidth}
                  y2={PLOT.y + PLOT.height + 8}
                />

                <text x={PLOT.x} y={PLOT.y - 36}>Сверху в каждом столбце — «{labels.rightLabel}»</text>

                {columnWidth < 52 && columnWidth > 0 && (
                  <text x={PLOT.x + columnWidth + 10} y={PLOT.y - 10}>
                    ↙ {labels.leftLabel}: {people(table.both)} из {people(withLeft)}
                  </text>
                )}
                {secondColumnWidth < 52 && secondColumnWidth > 0 && (
                  <text x={PLOT.x + columnWidth - 10} y={PLOT.y - 10} textAnchor="end">
                    {labels.leftNegativeLabel}: {people(table.rightOnly)} из {people(withoutLeft)} ↘
                  </text>
                )}

                <text x={PLOT.x} y={PLOT.y + PLOT.height + 30}>
                  {labels.leftLabel} — {people(withLeft)}
                </text>
                <text x={PLOT.x + PLOT.width} y={PLOT.y + PLOT.height + 30} textAnchor="end">
                  {labels.leftNegativeLabel} — {people(withoutLeft)}
                </text>
                <text x={PLOT.x} y={PLOT.y + PLOT.height + 60}>
                  Ширина ∝ числу объектов в столбце, высота цветной части ∝ условной доле
                </text>
              </g>
            )}

            {empty && (
              <text x={320} y={170} textAnchor="middle">Введи хотя бы одно число больше нуля</text>
            )}
          </svg>
        </div>

        <div className="dm-ratio-table-wrap">
          <table className="dm-ratio-table">
            <caption>
              Таблица частот: {people(total)} {labels.unit}
              {activeMode === 'screening' ? ' в мысленной группе' : ''}
            </caption>
            <thead>
              <tr>
                <th scope="col">&nbsp;</th>
                <th scope="col">{labels.rightLabel}</th>
                <th scope="col">{labels.rightNegativeLabel}</th>
                <th scope="col">Всего</th>
              </tr>
            </thead>
            <tbody>
              <tr className="dm-ratio-table__current">
                <th scope="row">{labels.leftLabel}</th>
                <td>{people(table.both)}</td>
                <td>{people(table.leftOnly)}</td>
                <td>{people(withLeft)}</td>
              </tr>
              <tr>
                <th scope="row">{labels.leftNegativeLabel}</th>
                <td>{people(table.rightOnly)}</td>
                <td>{people(table.neither)}</td>
                <td>{people(withoutLeft)}</td>
              </tr>
              <tr className="dm-ratio-table__answer">
                <th scope="row">Всего</th>
                <td>{people(withRight)}</td>
                <td>{people(withoutRight)}</td>
                <td>{people(total)}</td>
              </tr>
            </tbody>
          </table>
          <p className="dm-nt-note">
            Итоги строк и столбцов — это частоты событий по отдельности, а четыре внутренние клетки — частоты пересечений.
          </p>
        </div>

        {challenge && target !== null && (
          <div className="dm-ratio-unit-note">
            <span aria-hidden="true">?</span>
            <div>
              <div className="dm-field">
                <label htmlFor={`${labId}-answer`}>
                  {questionText} Запиши обыкновенной дробью (например 1/12) или десятичной с тремя знаками
                </label>
                <input
                  id={`${labId}-answer`}
                  type="text"
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

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">
            {!reveal ? '?' : challenge ? (answerCorrect ? '✓' : '×') : 'P'}
          </span>
          {empty || stats === null ? (
            <p>
              <strong>Пока считать нечего: в таблице ноль объектов.</strong>
              <small>Введи частоты — сумма четырёх клеток должна быть больше нуля.</small>
            </p>
          ) : !reveal ? (
            <p>
              <strong>{questionText}</strong>
              <small>
                Подсказка: условие сужает группу до одного столбца. Раздели число объектов в нужной клетке на итог этого столбца —
                и не путай его с итогом строки.
              </small>
            </p>
          ) : activeMode === 'screening' ? (
            <p>
              <strong>
                P(болен | тест положительный) = {people(screening.truePositive)} / {people(screening.truePositive + screening.falsePositive)} = {formatFraction(positivePredictiveValue(screening))} ≈ {decimal(positivePredictiveValue(screening), 4)}.
              </strong>
              <small>
                Положительных результатов всего {people(withRight)}, но верных среди них только {people(screening.truePositive)}:
                здоровых слишком много, и даже редкая ошибка даёт {people(screening.falsePositive)} ложных тревог.
                Обратная величина: P(здоров | тест отрицательный) = {formatFraction(negativePredictiveValue(screening))} ≈ {decimal(negativePredictiveValue(screening), 5)}.
                {challenge && parsedAnswer !== null && !answerCorrect ? ' Твой ответ не совпал: скорее всего, ты разделил на число больных, а не на число всех положительных.' : ''}
              </small>
            </p>
          ) : (
            <p>
              <strong>
                P({labels.rightLabel}) = {formatFraction(stats.right)} ≈ {decimal(stats.right, 3)};
                {stats.rightGiven !== null && ` P(${labels.rightLabel} | ${labels.leftLabel}) = ${people(table.both)} / ${people(withLeft)} = ${formatFraction(stats.rightGiven)} ≈ ${decimal(stats.rightGiven, 3)};`}
                {stats.leftGiven !== null && ` P(${labels.leftLabel} | ${labels.rightLabel}) = ${people(table.both)} / ${people(withRight)} = ${formatFraction(stats.leftGiven)}.`}
              </strong>
              <small>
                P({labels.leftLabel}) = {formatFraction(stats.left)}, P(оба сразу) = {formatFraction(stats.both)}, произведение
                P(A)·P(B) = {formatFraction(probabilityOfLeft(table))}·{formatFraction(probabilityOfRight(table))}.
                {stats.independent
                  ? ` Пересечение совпало с произведением, значит события независимы: условная доля равна безусловной.`
                  : ` При независимости в первой клетке стояло бы ${formatFraction(stats.expectedBoth)} вместо ${people(table.both)}, поэтому события зависимы.`}
                {stats.leftGivenNot !== null && ` Для сравнения: P(${labels.leftLabel} | ${labels.rightNegativeLabel}) = ${formatFraction(stats.leftGivenNot)}.`}
                {challenge && parsedAnswer !== null && !answerCorrect ? ' Проверь, на какой итог ты делил: условие задаёт столбец, а не строку.' : ''}
              </small>
            </p>
          )}
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>
          ↺ Вернуть пример
        </button>
      </div>
    </section>
  );
}
