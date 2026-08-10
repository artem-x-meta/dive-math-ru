import { useId, useMemo, useState } from 'react';
import {
  type GrowthKind,
  type GrowthModel,
  firstPermanentLead,
  growthBox,
  growthExit,
  growthSegments,
  growthTable,
  growthValue,
} from '../lib/explog';
import { type Point, numberText } from '../lib/functionsCore';

export interface ExpoLabProps {
  /** Основание показательной функции. */
  initialBase?: number;
  /** Показатель степенной функции y = x^k. */
  initialDegree?: number;
  /** Угловой коэффициент линейной функции y = c·x. */
  initialSlope?: number;
  /** Правая граница отрезка наблюдения. */
  initialMaxX?: number;
  /** Режим задачи: сначала виден только маленький кусок, ответ — после проверки. */
  challenge?: boolean;
}

const BASE_OPTIONS: readonly number[] = [1.5, 2, 3];
const DEGREE_OPTIONS: readonly number[] = [1, 2, 3];
const SLOPE_OPTIONS: readonly number[] = [5, 10, 20];
const PREVIEW_MAX_X = 4;

const LEFT = 74;
const TOP = 28;
const PLOT_WIDTH = 618;
const PLOT_HEIGHT = 424;

const KIND_TITLES: Record<GrowthKind, string> = {
  exponential: 'показательная',
  power: 'степенная',
  linear: 'линейная',
};

function pick(options: readonly number[], value: number | undefined, fallback: number): number {
  return value !== undefined && options.includes(value) ? value : fallback;
}

/** Круглый шаг сетки: 1, 2, 5, 10, 20, 50, … — тот, что даёт около шести линий. */
function niceStep(range: number): number {
  const rough = range / 6;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1e-6))));
  const normalized = rough / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

interface ChartProps {
  id: string;
  model: GrowthModel;
  formulaText: string;
  reveal: boolean;
}

function GrowthChart({ id, model, formulaText, reveal }: ChartProps) {
  const box = growthBox(model);
  const px = (value: number) => LEFT + ((value - box.xMin) / (box.xMax - box.xMin)) * PLOT_WIDTH;
  const py = (value: number) => TOP + (1 - (value - box.yMin) / (box.yMax - box.yMin)) * PLOT_HEIGHT;

  const exponential = useMemo(() => growthSegments(model, 'exponential', 321), [model]);
  const power = useMemo(() => growthSegments(model, 'power', 321), [model]);
  const linear = useMemo(() => growthSegments(model, 'linear', 321), [model]);

  const xStep = box.xMax <= 8 ? 1 : 2;
  const xTicks: number[] = [];
  for (let value = 0; value <= box.xMax + 1e-9; value += xStep) xTicks.push(value);
  const yStep = niceStep(box.yMax);
  const yTicks: number[] = [];
  for (let value = 0; value <= box.yMax + 1e-9; value += yStep) yTicks.push(value);

  const exit = growthExit(model);
  const lastX = model.maxX;

  const polyline = (segments: readonly Point[][], className: string, keyPrefix: string) => (
    <g className={className} aria-hidden="true">
      {segments.map((segment, segmentIndex) => segment.slice(1).map((point, index) => {
        const previous = segment[index]!;
        return (
          <line
            key={`${keyPrefix}-${segmentIndex}-${index}`}
            x1={px(previous.x)}
            y1={py(previous.y)}
            x2={px(point.x)}
            y2={py(point.y)}
          />
        );
      }))}
    </g>
  );

  return (
    <svg className="dm-signed-plane" viewBox="0 0 720 540" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Три вида роста на отрезке от 0 до {numberText(lastX)}</title>
      <desc id={`${id}-desc`}>
        Сравниваются {formulaText}. Окно по вертикали доходит до {numberText(box.yMax)} — его высоты хватает
        степенной и линейной функции. В точке x = {numberText(lastX)} степенная функция равна {numberText(growthValue(model, 'power', lastX))},
        линейная — {numberText(growthValue(model, 'linear', lastX))}, показательная — {numberText(growthValue(model, 'exponential', lastX))}.
        {exit === null
          ? ' Показательная кривая целиком помещается в окно.'
          : ` Показательная кривая уходит выше окна уже при x ≈ ${numberText(exit)}, поэтому её линия обрывается на верхнем краю.`}
        {reveal ? '' : ' Показан только начальный участок: продолжение появится после проверки.'}
      </desc>

      <rect className="dm-signed-plane__background" x={LEFT} y={TOP} width={PLOT_WIDTH} height={PLOT_HEIGHT} rx="12" />

      <g className="dm-signed-plane__grid" aria-hidden="true">
        {xTicks.map((value) => (
          <line key={`vx-${value}`} x1={px(value)} y1={TOP} x2={px(value)} y2={TOP + PLOT_HEIGHT} />
        ))}
        {yTicks.map((value) => (
          <line key={`hy-${value}`} x1={LEFT} y1={py(value)} x2={LEFT + PLOT_WIDTH} y2={py(value)} />
        ))}
      </g>

      <line className="dm-signed-plane__axis" x1={LEFT} y1={TOP + PLOT_HEIGHT} x2={LEFT + PLOT_WIDTH} y2={TOP + PLOT_HEIGHT} />
      <line className="dm-signed-plane__axis" x1={LEFT} y1={TOP + PLOT_HEIGHT} x2={LEFT} y2={TOP} />

      <g className="dm-signed-plane__labels" aria-hidden="true">
        {xTicks.map((value) => (
          <text key={`tx-${value}`} x={px(value)} y={TOP + PLOT_HEIGHT + 22}>{numberText(value)}</text>
        ))}
        {yTicks.map((value) => (
          <text key={`ty-${value}`} x={LEFT - 12} y={py(value) + 4} textAnchor="end">{numberText(value)}</text>
        ))}
        <text x={LEFT + PLOT_WIDTH - 4} y={TOP + PLOT_HEIGHT + 22}>x</text>
        <text x={LEFT - 12} y={TOP - 8} textAnchor="end">y</text>
      </g>

      {polyline(linear, 'dm-geometry-grid__candidates', 'linear')}
      {polyline(power, 'dm-geometry-grid__perpendicular', 'power')}
      {polyline(exponential, 'dm-signed-plane__route-segment', 'exponential')}

      <g className="dm-signed-plane__labels" aria-hidden="true">
        <text x={LEFT} y={TOP + PLOT_HEIGHT + 52} textAnchor="start">
          сплошная жирная — y = {numberText(model.base)}ˣ · вторая сплошная — y = x{model.degree === 1 ? '' : model.degree === 2 ? '²' : '³'} · пунктир — y = {numberText(model.slope)}x
        </text>
      </g>
    </svg>
  );
}

export default function ExpoLab({
  initialBase,
  initialDegree,
  initialSlope,
  initialMaxX = 12,
  challenge = false,
}: ExpoLabProps) {
  const reactId = useId();
  const labId = `expo-growth-${reactId.replace(/:/g, '')}`;

  const defaultBase = pick(BASE_OPTIONS, initialBase, 2);
  const defaultDegree = pick(DEGREE_OPTIONS, initialDegree, 2);
  const defaultSlope = pick(SLOPE_OPTIONS, initialSlope, 10);
  const maxX = Number.isSafeInteger(initialMaxX) && initialMaxX >= 6 && initialMaxX <= 20 ? initialMaxX : 12;

  const [base, setBase] = useState(defaultBase);
  const [degree, setDegree] = useState(defaultDegree);
  const [slope, setSlope] = useState(defaultSlope);
  const [answer, setAnswer] = useState<GrowthKind | ''>('');
  const [checked, setChecked] = useState(false);

  const reveal = !challenge || checked;
  const fullModel: GrowthModel = { base, degree, slope, maxX };
  const shownModel: GrowthModel = reveal ? fullModel : { base, degree, slope, maxX: PREVIEW_MAX_X };

  const rows = useMemo(() => growthTable(fullModel), [base, degree, slope, maxX]);
  const shownRows = rows.filter((row) => (reveal ? row.x % 2 === 0 : row.x <= PREVIEW_MAX_X));
  const lead = firstPermanentLead(fullModel);
  const finalRow = rows[rows.length - 1]!;
  const winner: GrowthKind = finalRow.leader === 'tie' ? 'exponential' : finalRow.leader;
  const correct = challenge && answer === winner;

  const degreeLabel = degree === 1 ? 'x' : degree === 2 ? 'x²' : 'x³';
  const formulaText = `y = ${numberText(base)}ˣ, y = ${degreeLabel} и y = ${numberText(slope)}x`;

  const reset = () => {
    setBase(defaultBase);
    setDegree(defaultDegree);
    setSlope(defaultSlope);
    setAnswer('');
    setChecked(false);
  };

  const result = !reveal
    ? {
      symbol: '?',
      headline: `Кто окажется больше при x = ${numberText(maxX)}?`,
      detail: `Пока виден только участок до x = ${PREVIEW_MAX_X}, где показательная функция выглядит скромно. Выбери ответ и нажми «Проверить».`,
    }
    : {
      symbol: challenge ? (correct ? '✓' : '×') : '↗',
      headline: challenge
        ? `${correct ? 'Верно' : 'Пока нет'}: при x = ${numberText(maxX)} больше всех ${KIND_TITLES[winner]} функция.`
        : `При x = ${numberText(maxX)}: ${numberText(base)}^${numberText(maxX)} = ${numberText(finalRow.exponential)}, ${degreeLabel} = ${numberText(finalRow.power)}, ${numberText(slope)}x = ${numberText(finalRow.linear)}.`,
      detail: lead === null
        ? `На отрезке до x = ${maxX} показательная функция ещё не вышла вперёд навсегда, но обгон обязательно произойдёт: при любом основании больше единицы показательный рост в итоге сильнее степенного.`
        : `Начиная с x = ${lead} неравенство ${numberText(base)}ˣ > ${degreeLabel} выполняется уже для всех целых x. До этого момента степенная функция может лидировать — и именно поэтому «на глаз» первые значения обманывают.`,
    };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория роста</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {challenge ? 'Кто впереди в конце отрезка?' : 'Показательный рост против степенного и линейного'}
          </h3>
          <p>
            {challenge
              ? 'Сначала видны только первые значения. Реши, какая функция окажется наибольшей в конце отрезка, и проверь себя.'
              : 'Меняй основание и показатель степени. Следи не за первыми числами, а за тем, кто выигрывает в конце.'}
          </p>
        </div>
        <span className="dm-lab__badge">y = {numberText(base)}ˣ</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-preset-buttons" role="group" aria-label="Основание показательной функции">
          {BASE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`dm-geometry-preset-button ${base === option ? 'dm-geometry-preset-button--active' : ''}`}
              aria-pressed={base === option}
              onClick={() => {
                setBase(option);
                setChecked(false);
              }}
            >
              a = {numberText(option)}
            </button>
          ))}
        </div>

        <div className="dm-geometry-preset-buttons" role="group" aria-label="Показатель степенной функции">
          {DEGREE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`dm-geometry-preset-button ${degree === option ? 'dm-geometry-preset-button--active' : ''}`}
              aria-pressed={degree === option}
              onClick={() => {
                setDegree(option);
                setChecked(false);
              }}
            >
              y = x{option === 1 ? '' : option === 2 ? '²' : '³'}
            </button>
          ))}
        </div>

        <div className="dm-geometry-preset-buttons" role="group" aria-label="Угловой коэффициент линейной функции">
          {SLOPE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`dm-geometry-preset-button ${slope === option ? 'dm-geometry-preset-button--active' : ''}`}
              aria-pressed={slope === option}
              onClick={() => {
                setSlope(option);
                setChecked(false);
              }}
            >
              y = {numberText(option)}x
            </button>
          ))}
        </div>

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график трёх видов роста" tabIndex={0}>
          <GrowthChart id={`${labId}-chart`} model={shownModel} formulaText={formulaText} reveal={reveal} />
        </div>

        {challenge && (
          <>
            <p className="dm-signed-caption">Мой ответ</p>
            <div className="dm-geometry-preset-buttons" role="group" aria-label="Какая функция больше в конце отрезка">
              {(['exponential', 'power', 'linear'] as const).map((kind) => (
                <button
                  type="button"
                  key={kind}
                  className={`dm-geometry-preset-button ${answer === kind ? 'dm-geometry-preset-button--active' : ''}`}
                  aria-pressed={answer === kind}
                  onClick={() => {
                    setAnswer(kind);
                    setChecked(false);
                  }}
                >
                  {kind === 'exponential' ? `y = ${numberText(base)}ˣ` : kind === 'power' ? `y = ${degreeLabel}` : `y = ${numberText(slope)}x`}
                </button>
              ))}
            </div>
            <div className="dm-geometry-answer-grid">
              <button className="dm-button" type="button" disabled={answer === ''} onClick={() => setChecked(true)}>
                Проверить
              </button>
            </div>
          </>
        )}

        <div className="dm-algebra-table-wrap" role="region" aria-label="Прокручиваемая таблица значений" tabIndex={0}>
          <table className="dm-algebra-table">
            <caption>
              Значения трёх функций {reveal ? `при чётных x от 0 до ${maxX}` : `на первом участке до x = ${PREVIEW_MAX_X}`}; жирным выделено наибольшее число в столбце
            </caption>
            <thead>
              <tr>
                <th scope="col">x</th>
                {shownRows.map((row) => <th scope="col" key={`x-${row.x}`}>{row.x}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{numberText(base)}ˣ</th>
                {shownRows.map((row) => (
                  <td key={`e-${row.x}`}>
                    {row.leader === 'exponential' ? <strong>{numberText(row.exponential)}</strong> : numberText(row.exponential)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">{degreeLabel}</th>
                {shownRows.map((row) => (
                  <td key={`p-${row.x}`}>
                    {row.leader === 'power' ? <strong>{numberText(row.power)}</strong> : numberText(row.power)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">{numberText(slope)}x</th>
                {shownRows.map((row) => (
                  <td key={`l-${row.x}`}>
                    {row.leader === 'linear' ? <strong>{numberText(row.linear)}</strong> : numberText(row.linear)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {reveal && (
          <div className="dm-signed-reflection-cards">
            <div>
              <span>Обгон навсегда</span>
              <strong>{lead === null ? 'позже конца отрезка' : `x = ${lead}`}</strong>
              <small>Начиная с этого целого значения показательная функция больше степенной при всех следующих x.</small>
            </div>
            <div>
              <span>Множитель за шаг</span>
              <strong>{numberText(base)} раза</strong>
              <small>Показательная функция умножается на одно и то же число при каждом шаге в единицу — это и есть её отличие.</small>
            </div>
            <div>
              <span>Выход за окно</span>
              <strong>{growthExit(fullModel) === null ? 'не выходит' : `x ≈ ${numberText(growthExit(fullModel)!)}`}</strong>
              <small>Высота окна подобрана под степенную и линейную функции — показательная в неё просто не помещается.</small>
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

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>
          ↺ Вернуть пример
        </button>
      </div>
    </section>
  );
}
