import { useId, useMemo, useState } from 'react';
import {
  PROFILE_PRESETS,
  criticalPoints,
  differentiate,
  extremaOnSegment,
  extremumText,
  formatPolynomial,
  formatValue,
  getProfilePreset,
  intervalText,
  monotonicityIntervals,
  monotonicityText,
  polynomialSegments,
  valueAt,
  type Box,
  type Point,
  type ProfilePresetId,
} from '../lib/derivatives';

export interface DerivProfileLabProps {
  /** Какая функция открыта при загрузке. */
  initialPreset?: ProfilePresetId;
  /** Режим задачи: выводы и график производной скрыты до проверки. */
  challenge?: boolean;
}

const PLOT_LEFT = 70;
const PLOT_WIDTH = 616;
const TOP_PLOT_TOP = 30;
const TOP_PLOT_HEIGHT = 232;
const BOTTOM_PLOT_TOP = 322;
const BOTTOM_PLOT_HEIGHT = 178;

function niceStep(range: number): number {
  const rough = range / 8;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (magnitude * factor >= rough) return magnitude * factor;
  }
  return magnitude * 10;
}

function gridValues(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  for (let index = first; index <= last; index += 1) {
    values.push(Number((index * step).toFixed(6)));
  }
  return values;
}

interface PolylineProps {
  segments: readonly Point[][];
  className: string;
  keyPrefix: string;
  px: (value: number) => number;
  py: (value: number) => number;
}

function Polyline({ segments, className, keyPrefix, px, py }: PolylineProps) {
  return (
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
}

export default function DerivProfileLab({
  initialPreset = 'cubic',
  challenge = false,
}: DerivProfileLabProps) {
  const reactId = useId();
  const labId = `deriv-profile-${reactId.replace(/:/g, '')}`;

  const startPreset = PROFILE_PRESETS.some((item) => item.id === initialPreset)
    ? initialPreset
    : 'cubic';

  const [presetId, setPresetId] = useState<ProfilePresetId>(startPreset);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const preset = getProfilePreset(presetId);
  const box: Box = preset.box;
  const derivativeBox: Box = preset.derivativeBox;

  const derivative = useMemo(() => differentiate(preset.coefficients), [preset]);
  const points = useMemo(() => criticalPoints(preset.coefficients), [preset]);
  const intervals = useMemo(() => monotonicityIntervals(preset.coefficients), [preset]);
  const extrema = useMemo(
    () => (preset.segment
      ? extremaOnSegment(preset.coefficients, preset.segment.from, preset.segment.to)
      : null),
    [preset],
  );

  const curve = useMemo(() => polynomialSegments(preset.coefficients, box, 361), [preset, box]);
  const derivativeCurve = useMemo(
    () => polynomialSegments(derivative.length === 0 ? [0] : derivative, derivativeBox, 361),
    [derivative, derivativeBox],
  );

  const reveal = !challenge || checked;

  const maximumPoint = points.find((point) => point.kind === 'maximum') ?? null;
  const answerOptions = useMemo(() => {
    const labels = points.map((point) => formatValue(point.x));
    return [...labels, 'таких точек нет'];
  }, [points]);
  const correctAnswer = maximumPoint === null ? 'таких точек нет' : formatValue(maximumPoint.x);
  const answerCorrect = answer === correctAnswer;

  const scaleX = PLOT_WIDTH / (box.xMax - box.xMin);
  const px = (value: number) => PLOT_LEFT + (value - box.xMin) * scaleX;

  const topScaleY = TOP_PLOT_HEIGHT / (box.yMax - box.yMin);
  const topPy = (value: number) => TOP_PLOT_TOP + TOP_PLOT_HEIGHT - (value - box.yMin) * topScaleY;
  const bottomScaleY = BOTTOM_PLOT_HEIGHT / (derivativeBox.yMax - derivativeBox.yMin);
  const bottomPy = (value: number) =>
    BOTTOM_PLOT_TOP + BOTTOM_PLOT_HEIGHT - (value - derivativeBox.yMin) * bottomScaleY;

  const stepX = niceStep(box.xMax - box.xMin);
  const stepTopY = niceStep(box.yMax - box.yMin);
  const stepBottomY = niceStep(derivativeBox.yMax - derivativeBox.yMin);
  const xTicks = gridValues(box.xMin, box.xMax, stepX);
  const topTicks = gridValues(box.yMin, box.yMax, stepTopY);
  const bottomTicks = gridValues(derivativeBox.yMin, derivativeBox.yMax, stepBottomY);

  const topAxisY = topPy(Math.min(box.yMax, Math.max(box.yMin, 0)));
  const bottomAxisY = bottomPy(Math.min(derivativeBox.yMax, Math.max(derivativeBox.yMin, 0)));
  const axisX = px(Math.min(box.xMax, Math.max(box.xMin, 0)));

  const functionText = `y = ${formatPolynomial(preset.coefficients, preset.variable)}`;
  const derivativeText = `y' = ${formatPolynomial(derivative, preset.variable)}`;

  const changePreset = (id: ProfilePresetId) => {
    setPresetId(id);
    setAnswer('');
    setChecked(false);
  };

  const reset = () => {
    setPresetId(startPreset);
    setAnswer('');
    setChecked(false);
  };

  const summary = points.length === 0
    ? 'Производная нигде не обращается в ноль, поэтому стационарных точек нет.'
    : points
      .map((point) => `${preset.variable} = ${formatValue(point.x)} — ${extremumText(point.kind)}`)
      .join('; ');

  const result = !reveal
    ? {
      symbol: '?',
      headline: 'Сначала прочитай график функции глазами.',
      detail: 'Где линия идёт вверх, а где вниз? В каких точках она разворачивается? Ответь на вопрос — и появится график производной со всеми выводами.',
    }
    : challenge
      ? {
        symbol: answerCorrect ? '✓' : '×',
        headline: answerCorrect
          ? `Верно. ${summary}.`
          : `Правильный ответ: ${correctAnswer}. ${summary}.`,
        detail: `Производная ${derivativeText} меняет знак только в стационарных точках; смена «плюс на минус» и есть максимум.`,
      }
      : {
        symbol: 'ƒ',
        headline: `${derivativeText}. ${summary}.`,
        detail: intervals
          .map((interval) => `${monotonicityText(interval.kind)} на ${intervalText(interval)}`)
          .join('; ') + '.',
      };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория исследования</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {challenge ? 'Найди точку максимума по графику' : 'График функции и знак её производной'}
          </h3>
          <p>{preset.story}</p>
        </div>
        <span className="dm-lab__badge">y′ и монотонность</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-signed-tabs" role="group" aria-label="Функция для исследования">
          {PROFILE_PRESETS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`dm-signed-tab ${item.id === presetId ? 'dm-signed-tab--active' : ''}`}
              aria-pressed={item.id === presetId}
              onClick={() => changePreset(item.id)}
            >
              {item.title}
            </button>
          ))}
        </div>

        <div className="dm-algebra-equation" role="math" aria-label={`Функция ${functionText}`}>
          <span>{functionText}</span>
          <span aria-hidden="true">→</span>
          <strong>{reveal ? derivativeText : "y' = ?"}</strong>
        </div>

        {challenge && (
          <>
            <p className="dm-signed-caption">Мой ответ</p>
            <div className="dm-geometry-answer-grid">
              <div className="dm-geometry-answer-field">
                <label htmlFor={`${labId}-answer`}>Точка максимума</label>
                <select
                  id={`${labId}-answer`}
                  value={answer}
                  onChange={(event) => {
                    setAnswer(event.target.value);
                    setChecked(false);
                  }}
                >
                  <option value="">— выбери —</option>
                  {answerOptions.map((option) => (
                    <option value={option} key={option}>{option}</option>
                  ))}
                </select>
              </div>
              <button
                className="dm-button"
                type="button"
                disabled={answer === ''}
                onClick={() => setChecked(true)}
              >
                Проверить
              </button>
            </div>
          </>
        )}

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемая пара графиков" tabIndex={0}>
          <svg
            className="dm-signed-plane"
            viewBox="0 0 720 540"
            role="img"
            aria-labelledby={`${labId}-svg-title ${labId}-svg-desc`}
          >
            <title id={`${labId}-svg-title`}>
              {`Сверху график ${functionText}, снизу график его производной`}
            </title>
            <desc id={`${labId}-svg-desc`}>
              У обоих рисунков общая ось {preset.variable} с делением {formatValue(stepX)}.
              На верхнем графике деление по вертикали равно {formatValue(stepTopY)},
              на нижнем — {formatValue(stepBottomY)}.
              {reveal
                ? ` ${summary}. Ниже нуля производная отрицательна, и там функция убывает.`
                : ' Нижний график пока скрыт.'}
            </desc>

            <rect
              className="dm-signed-plane__background"
              x={PLOT_LEFT}
              y={TOP_PLOT_TOP}
              width={PLOT_WIDTH}
              height={TOP_PLOT_HEIGHT}
              rx="12"
            />
            <rect
              className="dm-signed-plane__background"
              x={PLOT_LEFT}
              y={BOTTOM_PLOT_TOP}
              width={PLOT_WIDTH}
              height={BOTTOM_PLOT_HEIGHT}
              rx="12"
            />

            <g className="dm-signed-plane__grid" aria-hidden="true">
              {xTicks.map((value) => (
                <g key={`gx-${value}`}>
                  <line x1={px(value)} y1={TOP_PLOT_TOP} x2={px(value)} y2={TOP_PLOT_TOP + TOP_PLOT_HEIGHT} />
                  <line x1={px(value)} y1={BOTTOM_PLOT_TOP} x2={px(value)} y2={BOTTOM_PLOT_TOP + BOTTOM_PLOT_HEIGHT} />
                </g>
              ))}
              {topTicks.map((value) => (
                <line key={`gt-${value}`} x1={PLOT_LEFT} y1={topPy(value)} x2={PLOT_LEFT + PLOT_WIDTH} y2={topPy(value)} />
              ))}
              {bottomTicks.map((value) => (
                <line key={`gb-${value}`} x1={PLOT_LEFT} y1={bottomPy(value)} x2={PLOT_LEFT + PLOT_WIDTH} y2={bottomPy(value)} />
              ))}
            </g>

            <line className="dm-signed-plane__axis" x1={PLOT_LEFT} y1={topAxisY} x2={PLOT_LEFT + PLOT_WIDTH} y2={topAxisY} />
            <line className="dm-signed-plane__axis" x1={axisX} y1={TOP_PLOT_TOP + TOP_PLOT_HEIGHT} x2={axisX} y2={TOP_PLOT_TOP} />
            <line className="dm-signed-plane__axis" x1={PLOT_LEFT} y1={bottomAxisY} x2={PLOT_LEFT + PLOT_WIDTH} y2={bottomAxisY} />
            <line className="dm-signed-plane__axis" x1={axisX} y1={BOTTOM_PLOT_TOP + BOTTOM_PLOT_HEIGHT} x2={axisX} y2={BOTTOM_PLOT_TOP} />

            <g className="dm-signed-plane__labels" aria-hidden="true">
              {xTicks.map((value) => (
                <text key={`lx-${value}`} x={px(value)} y={BOTTOM_PLOT_TOP + BOTTOM_PLOT_HEIGHT + 20}>
                  {formatValue(value)}
                </text>
              ))}
              {topTicks.map((value) => (
                <text key={`lt-${value}`} x={PLOT_LEFT - 10} y={topPy(value) + 4} textAnchor="end">{formatValue(value)}</text>
              ))}
              {bottomTicks.map((value) => (
                <text key={`lb-${value}`} x={PLOT_LEFT - 10} y={bottomPy(value) + 4} textAnchor="end">{formatValue(value)}</text>
              ))}
              <text x={PLOT_LEFT} y={TOP_PLOT_TOP - 12} textAnchor="start">y = f({preset.variable})</text>
              <text x={PLOT_LEFT} y={BOTTOM_PLOT_TOP - 12} textAnchor="start">y = f′({preset.variable})</text>
              <text x={PLOT_LEFT + PLOT_WIDTH} y={BOTTOM_PLOT_TOP + BOTTOM_PLOT_HEIGHT + 44} textAnchor="end">
                {preset.variable}
              </text>
            </g>

            <Polyline segments={curve} className="dm-signed-plane__route-segment" keyPrefix="curve" px={px} py={topPy} />

            {reveal && (
              <Polyline
                segments={derivativeCurve}
                className="dm-geometry-grid__line dm-geometry-grid__line--a"
                keyPrefix="derivative"
                px={px}
                py={bottomPy}
              />
            )}

            {reveal && points.map((point) => (
              <g key={`mark-${point.x}`} aria-hidden="true">
                <line
                  className="dm-geometry-static__axis"
                  x1={px(point.x)}
                  y1={TOP_PLOT_TOP}
                  x2={px(point.x)}
                  y2={BOTTOM_PLOT_TOP + BOTTOM_PLOT_HEIGHT}
                />
                <g
                  className={`dm-signed-plane__point ${point.kind === 'maximum' ? 'dm-signed-plane__point--finish' : point.kind === 'minimum' ? 'dm-signed-plane__point--waypoint' : 'dm-signed-plane__point--a'}`}
                  transform={`translate(${px(point.x)} ${topPy(point.y)})`}
                >
                  <circle r="7" />
                  <text x={0} y={point.kind === 'maximum' ? -14 : 24}>
                    ({formatValue(point.x)}; {formatValue(point.y)})
                  </text>
                </g>
              </g>
            ))}
          </svg>
        </div>

        {reveal && (
          <>
            <p className="dm-signed-caption">Что говорит знак производной</p>
            <ol className="dm-signed-route-list">
              {intervals.map((interval, index) => (
                <li key={`${interval.from}-${interval.to}-${index}`}>
                  <span aria-hidden="true">{index + 1}</span>
                  <p>
                    <strong>{`f′(${preset.variable}) ${interval.kind === 'increasing' ? '> 0' : interval.kind === 'decreasing' ? '< 0' : '= 0'} на ${intervalText(interval)}`}</strong>
                    <small>Значит, функция {monotonicityText(interval.kind)} на этом промежутке.</small>
                  </p>
                </li>
              ))}
              {points.length === 0 && (
                <li className="dm-signed-route-list__empty">
                  <p>
                    <strong>Стационарных точек нет</strong>
                    <small>Производная не обращается в ноль, поэтому и экстремумов нет.</small>
                  </p>
                </li>
              )}
              {points.map((point, index) => (
                <li key={`point-${point.x}`}>
                  <span aria-hidden="true">{intervals.length + index + 1}</span>
                  <p>
                    <strong>{`${preset.variable} = ${formatValue(point.x)}: f′ = 0, значение ${formatValue(point.y)}`}</strong>
                    <small>
                      Слева от точки производная {point.signBefore > 0 ? 'положительна' : point.signBefore < 0 ? 'отрицательна' : 'равна нулю'},
                      справа — {point.signAfter > 0 ? 'положительна' : point.signAfter < 0 ? 'отрицательна' : 'равна нулю'};
                      это {extremumText(point.kind)}.
                    </small>
                  </p>
                </li>
              ))}
            </ol>
          </>
        )}

        {reveal && extrema && preset.segment && (
          <div className="dm-signed-reflection-cards">
            <div>
              <span>Отрезок задачи</span>
              <strong>[{formatValue(preset.segment.from)}; {formatValue(preset.segment.to)}]</strong>
              <small>{preset.segmentNote}</small>
            </div>
            <div>
              <span>Наибольшее значение</span>
              <strong>{formatValue(extrema.maximum.y)} при {preset.variable} = {formatValue(extrema.maximum.x)}</strong>
              <small>{extrema.maximum.source === 'critical' ? 'Достигается внутри отрезка.' : 'Достигается на конце отрезка.'}</small>
            </div>
            <div>
              <span>Наименьшее значение</span>
              <strong>{formatValue(extrema.minimum.y)} при {preset.variable} = {formatValue(extrema.minimum.x)}</strong>
              <small>{extrema.minimum.source === 'critical' ? 'Достигается внутри отрезка.' : 'Достигается на конце отрезка.'}</small>
            </div>
          </div>
        )}

        {reveal && extrema && (
          <div className="dm-algebra-table-wrap">
            <table className="dm-algebra-table">
              <caption>Кандидаты на наибольшее и наименьшее значение</caption>
              <thead>
                <tr>
                  <th scope="col">{preset.variable}</th>
                  <th scope="col">откуда взялся</th>
                  <th scope="col">значение</th>
                </tr>
              </thead>
              <tbody>
                {extrema.candidates.map((candidate) => (
                  <tr key={candidate.x}>
                    <td>{formatValue(candidate.x)}</td>
                    <td>{candidate.source === 'endpoint' ? 'конец отрезка' : 'f′ = 0'}</td>
                    <td>{formatValue(valueAt(preset.coefficients, candidate.x))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
