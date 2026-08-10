import { useId, useMemo, useState } from 'react';
import {
  SECANT_PRESETS,
  SHRINKING_STEPS,
  availableSteps,
  derivativeAt,
  differentiate,
  formatPolynomial,
  formatValue,
  getSecantPreset,
  lineSegments,
  lineText,
  polynomialSegments,
  secantLine,
  secantRows,
  secantSlope,
  tangentLine,
  valueAt,
  type Box,
  type Point,
  type SecantPresetId,
} from '../lib/derivatives';

export interface DerivSecantLabProps {
  /** Какой сюжет открыт при загрузке. */
  initialPreset?: SecantPresetId;
  /** Точка, в которой ищем мгновенную скорость. */
  initialAnchor?: number;
  /** Режим задачи: касательная и точный ответ скрыты до проверки. */
  challenge?: boolean;
}

const PLOT_LEFT = 66;
const PLOT_TOP = 26;
const PLOT_WIDTH = 620;
const PLOT_HEIGHT = 376;

/** Шаг сетки, при котором на оси остаётся 6–10 подписанных делений. */
function niceStep(range: number): number {
  const rough = range / 8;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (magnitude * factor >= rough) return magnitude * factor;
  }
  return magnitude * 10;
}

/** Значения сетки внутри отрезка, кратные шагу. */
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

export default function DerivSecantLab({
  initialPreset = 'fall',
  initialAnchor,
  challenge = false,
}: DerivSecantLabProps) {
  const reactId = useId();
  const labId = `deriv-secant-${reactId.replace(/:/g, '')}`;

  const startPreset = SECANT_PRESETS.some((item) => item.id === initialPreset)
    ? initialPreset
    : 'fall';
  const startAnchor = (() => {
    const preset = getSecantPreset(startPreset);
    return initialAnchor !== undefined && preset.anchors.includes(initialAnchor)
      ? initialAnchor
      : preset.defaultAnchor;
  })();

  const [presetId, setPresetId] = useState<SecantPresetId>(startPreset);
  const [anchor, setAnchor] = useState(startAnchor);
  const [step, setStep] = useState(1);
  const [showTangent, setShowTangent] = useState(!challenge);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const preset = getSecantPreset(presetId);
  const box: Box = preset.box;
  const steps = availableSteps(preset, anchor);
  const activeStep = steps.includes(step) ? step : (steps[steps.length - 1] ?? 0.5);

  const derivative = useMemo(() => differentiate(preset.coefficients), [preset]);
  const exactSlope = derivativeAt(preset.coefficients, anchor);
  const currentSlope = secantSlope(preset.coefficients, anchor, activeStep);
  const yStart = valueAt(preset.coefficients, anchor);
  const yEnd = valueAt(preset.coefficients, anchor + activeStep);

  const rows = useMemo(
    () => secantRows(preset.coefficients, anchor, SHRINKING_STEPS.filter(
      (h) => anchor + h <= box.xMax + 1e-9,
    )),
    [preset, anchor, box.xMax],
  );

  const curve = useMemo(() => polynomialSegments(preset.coefficients, box, 361), [preset, box]);
  const secant = useMemo(
    () => lineSegments(secantLine(preset.coefficients, anchor, activeStep), box),
    [preset, anchor, activeStep, box],
  );
  const tangent = useMemo(
    () => lineSegments(tangentLine(preset.coefficients, anchor), box),
    [preset, anchor, box],
  );

  const reveal = !challenge || checked;

  /** Варианты ответа: правильный наклон и два правдоподобных двойника. */
  const options = useMemo(() => {
    const candidates = [
      exactSlope,
      yStart,
      secantSlope(preset.coefficients, anchor, steps[steps.length - 1] ?? 1),
    ].map((value) => Math.round(value * 1000) / 1000);
    const unique = candidates.filter((value, index) => candidates.indexOf(value) === index);
    if (!unique.includes(Math.round(exactSlope * 1000) / 1000)) {
      unique.push(Math.round(exactSlope * 1000) / 1000);
    }
    let filler = 1;
    while (unique.length < 3) {
      const candidate = Math.round((exactSlope + filler) * 1000) / 1000;
      if (!unique.includes(candidate)) unique.push(candidate);
      filler += 1;
    }
    return unique.sort((left, right) => left - right);
  }, [exactSlope, yStart, preset, anchor, steps]);

  const answerCorrect = answer !== ''
    && Math.abs(Number(answer) - exactSlope) < 1e-6;

  const scaleX = PLOT_WIDTH / (box.xMax - box.xMin);
  const scaleY = PLOT_HEIGHT / (box.yMax - box.yMin);
  const px = (value: number) => PLOT_LEFT + (value - box.xMin) * scaleX;
  const py = (value: number) => PLOT_TOP + PLOT_HEIGHT - (value - box.yMin) * scaleY;
  const stepX = niceStep(box.xMax - box.xMin);
  const stepY = niceStep(box.yMax - box.yMin);
  const xTicks = gridValues(box.xMin, box.xMax, stepX);
  const yTicks = gridValues(box.yMin, box.yMax, stepY);
  const axisY = py(Math.min(box.yMax, Math.max(box.yMin, 0)));
  const axisX = px(Math.min(box.xMax, Math.max(box.xMin, 0)));

  const functionText = `y = ${formatPolynomial(preset.coefficients, preset.variable)}`;
  const derivativeText = `y' = ${formatPolynomial(derivative, preset.variable)}`;

  const changePreset = (id: SecantPresetId) => {
    const next = getSecantPreset(id);
    setPresetId(id);
    setAnchor(next.defaultAnchor);
    setStep(1);
    setShowTangent(!challenge);
    setAnswer('');
    setChecked(false);
  };

  const reset = () => {
    setPresetId(startPreset);
    setAnchor(startAnchor);
    setStep(1);
    setShowTangent(!challenge);
    setAnswer('');
    setChecked(false);
  };

  const result = !reveal
    ? {
      symbol: '?',
      headline: `Секущая при h = ${formatValue(activeStep)} имеет наклон ${formatValue(currentSlope)}.`,
      detail: 'Уменьшай шаг и следи за числом в последнем столбце таблицы. К какому значению оно подбирается? Ответь — и касательная появится на рисунке.',
    }
    : challenge
      ? {
        symbol: answerCorrect ? '✓' : '×',
        headline: answerCorrect
          ? `Верно: ${derivativeText}, поэтому наклон в точке ${preset.variable} = ${formatValue(anchor)} равен ${formatValue(exactSlope)}.`
          : `Точный ответ: ${formatValue(exactSlope)}. Это значение производной ${derivativeText} в точке ${formatValue(anchor)}.`,
        detail: `Секущая при h = ${formatValue(activeStep)} даёт ${formatValue(currentSlope)} — это ещё не предел, а приближение с ошибкой ${formatValue(currentSlope - exactSlope)}.`,
      }
      : {
        symbol: '→',
        headline: `Секущая: ${formatValue(currentSlope)}. Касательная: ${formatValue(exactSlope)}.`,
        detail: `Разница ${formatValue(currentSlope - exactSlope)} и стремится к нулю вместе с h. Уравнение касательной: ${lineText(tangentLine(preset.coefficients, anchor), preset.variable)}.`,
      };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория секущей</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {challenge ? 'Угадай наклон касательной до подсказки' : 'Секущая стягивается к касательной'}
          </h3>
          <p>{preset.story}</p>
        </div>
        <span className="dm-lab__badge">Δy / Δx</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-signed-tabs" role="group" aria-label="Сюжет лаборатории">
          {SECANT_PRESETS.map((item) => (
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

        <div className="dm-lab__controls">
          <div className="dm-field">
            <label htmlFor={`${labId}-anchor`}>
              Точка {preset.variable}₀ <span className="dm-field__value">{formatValue(anchor)}</span>
            </label>
            <select
              id={`${labId}-anchor`}
              value={anchor}
              aria-describedby={`${labId}-anchor-hint`}
              onChange={(event) => {
                setAnchor(Number(event.target.value));
                setAnswer('');
                setChecked(false);
              }}
            >
              {preset.anchors.map((value) => (
                <option value={value} key={value}>{formatValue(value)}</option>
              ))}
            </select>
            <small id={`${labId}-anchor-hint`}>Здесь ищем мгновенное значение — {preset.slopeLabel}.</small>
          </div>

          <div className="dm-field">
            <label htmlFor={`${labId}-step`}>
              Шаг h <span className="dm-field__value">{formatValue(activeStep)}</span>
            </label>
            <select
              id={`${labId}-step`}
              value={activeStep}
              aria-describedby={`${labId}-step-hint`}
              onChange={(event) => setStep(Number(event.target.value))}
            >
              {steps.map((value) => (
                <option value={value} key={value}>{formatValue(value)}</option>
              ))}
            </select>
            <small id={`${labId}-step-hint`}>Расстояние до второй точки. Ноль запрещён: на ноль делить нельзя.</small>
          </div>
        </div>

        <div className="dm-algebra-equation" role="math" aria-label={`Функция ${functionText}`}>
          <span>{functionText}</span>
          <span aria-hidden="true">→</span>
          <strong>{reveal ? derivativeText : "y' = ?"}</strong>
        </div>

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график с секущей" tabIndex={0}>
          <svg
            className="dm-signed-plane"
            viewBox="0 0 720 470"
            role="img"
            aria-labelledby={`${labId}-svg-title ${labId}-svg-desc`}
          >
            <title id={`${labId}-svg-title`}>
              {`График ${functionText} с секущей через точки ${preset.variable}₀ и ${preset.variable}₀ + h`}
            </title>
            <desc id={`${labId}-svg-desc`}>
              По горизонтали отложено {preset.xLabel}, одно деление равно {formatValue(stepX)};
              по вертикали — {preset.yLabel}, одно деление равно {formatValue(stepY)}.
              Масштабы осей разные, поэтому угол наклона на рисунке не равен углу на местности,
              но все точки посчитаны по формуле.
              Точка A имеет координаты ({formatValue(anchor)}; {formatValue(yStart)}),
              точка B — ({formatValue(anchor + activeStep)}; {formatValue(yEnd)}).
              Наклон секущей AB равен {formatValue(currentSlope)}.
              {showTangent && reveal
                ? ` Сплошной прямой показана касательная с наклоном ${formatValue(exactSlope)}.`
                : ' Касательная сейчас скрыта.'}
            </desc>

            <rect
              className="dm-signed-plane__background"
              x={PLOT_LEFT}
              y={PLOT_TOP}
              width={PLOT_WIDTH}
              height={PLOT_HEIGHT}
              rx="12"
            />

            <g className="dm-signed-plane__grid" aria-hidden="true">
              {xTicks.map((value) => (
                <line key={`gx-${value}`} x1={px(value)} y1={PLOT_TOP} x2={px(value)} y2={PLOT_TOP + PLOT_HEIGHT} />
              ))}
              {yTicks.map((value) => (
                <line key={`gy-${value}`} x1={PLOT_LEFT} y1={py(value)} x2={PLOT_LEFT + PLOT_WIDTH} y2={py(value)} />
              ))}
            </g>

            <line className="dm-signed-plane__axis" x1={PLOT_LEFT} y1={axisY} x2={PLOT_LEFT + PLOT_WIDTH} y2={axisY} />
            <line className="dm-signed-plane__axis" x1={axisX} y1={PLOT_TOP + PLOT_HEIGHT} x2={axisX} y2={PLOT_TOP} />

            <g className="dm-signed-plane__labels" aria-hidden="true">
              {xTicks.map((value) => (
                <text key={`lx-${value}`} x={px(value)} y={PLOT_TOP + PLOT_HEIGHT + 18}>{formatValue(value)}</text>
              ))}
              {yTicks.map((value) => (
                <text key={`ly-${value}`} x={PLOT_LEFT - 10} y={py(value) + 4} textAnchor="end">{formatValue(value)}</text>
              ))}
              <text x={PLOT_LEFT + PLOT_WIDTH} y={PLOT_TOP + PLOT_HEIGHT + 42} textAnchor="end">{preset.xLabel}</text>
              <text x={PLOT_LEFT} y={PLOT_TOP - 10} textAnchor="start">{preset.yLabel}</text>
            </g>

            <Polyline segments={curve} className="dm-signed-plane__route-segment" keyPrefix="curve" px={px} py={py} />

            {showTangent && reveal && (
              <Polyline
                segments={tangent}
                className="dm-geometry-grid__line dm-geometry-grid__line--a"
                keyPrefix="tangent"
                px={px}
                py={py}
              />
            )}

            <Polyline
              segments={secant}
              className="dm-geometry-grid__line dm-geometry-grid__line--b"
              keyPrefix="secant"
              px={px}
              py={py}
            />

            <g aria-hidden="true">
              <line
                className="dm-geometry-static__guide"
                x1={px(anchor)}
                y1={py(yStart)}
                x2={px(anchor + activeStep)}
                y2={py(yStart)}
              />
              <line
                className="dm-geometry-static__guide"
                x1={px(anchor + activeStep)}
                y1={py(yStart)}
                x2={px(anchor + activeStep)}
                y2={py(yEnd)}
              />
            </g>

            <g className="dm-signed-plane__point dm-signed-plane__point--a" transform={`translate(${px(anchor)} ${py(yStart)})`} aria-hidden="true">
              <circle r="7" />
              <text x={0} y={-14}>A</text>
            </g>
            <g className="dm-signed-plane__point dm-signed-plane__point--finish" transform={`translate(${px(anchor + activeStep)} ${py(yEnd)})`} aria-hidden="true">
              <circle r="7" />
              <text x={0} y={-14}>B</text>
            </g>
          </svg>
        </div>

        <div className="dm-signed-reflection-cards">
          <div>
            <span>Δ{preset.variable} = h</span>
            <strong>{formatValue(activeStep)}</strong>
            <small>Насколько сдвинулись по горизонтали.</small>
          </div>
          <div>
            <span>Δy</span>
            <strong>{formatValue(yEnd - yStart)}</strong>
            <small>Настолько изменилось значение функции.</small>
          </div>
          <div>
            <span>Δy / h</span>
            <strong>{formatValue(currentSlope)}</strong>
            <small>{preset.slopeLabel} на всём отрезке AB, а не в точке A.</small>
          </div>
        </div>

        <p className="dm-signed-caption">Что происходит при уменьшении шага</p>
        <div className="dm-algebra-table-wrap">
          <table className="dm-algebra-table">
            <caption>Наклон секущей при уменьшении h из точки {preset.variable}₀ = {formatValue(anchor)}</caption>
            <thead>
              <tr>
                <th scope="col">h</th>
                <th scope="col">Δy</th>
                <th scope="col">Δy / h</th>
                <th scope="col">отличие от предела</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.h}>
                  <td>{formatValue(row.h, 4)}</td>
                  <td>{formatValue(row.deltaY, 4)}</td>
                  <td>{formatValue(row.slope, 4)}</td>
                  <td>{reveal ? formatValue(row.gap, 4) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {challenge && (
          <>
            <p className="dm-signed-caption">Мой ответ</p>
            <div className="dm-geometry-answer-grid">
              <div className="dm-geometry-answer-field">
                <label htmlFor={`${labId}-answer`}>Наклон касательной в точке {preset.variable}₀</label>
                <select
                  id={`${labId}-answer`}
                  value={answer}
                  onChange={(event) => {
                    setAnswer(event.target.value);
                    setChecked(false);
                  }}
                >
                  <option value="">— выбери —</option>
                  {options.map((value) => (
                    <option value={value} key={value}>{formatValue(value)}</option>
                  ))}
                </select>
              </div>
              <button
                className="dm-button"
                type="button"
                disabled={answer === ''}
                onClick={() => {
                  setChecked(true);
                  setShowTangent(true);
                }}
              >
                Проверить
              </button>
            </div>
          </>
        )}

        {reveal && (
          <button
            type="button"
            className="dm-button dm-button--secondary"
            aria-pressed={showTangent}
            onClick={() => setShowTangent((current) => !current)}
          >
            {showTangent ? 'Спрятать касательную' : 'Показать касательную'}
          </button>
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
