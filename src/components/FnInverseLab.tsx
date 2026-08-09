import { useId, useMemo, useState } from 'react';
import {
  INVERSE_PRESET_IDS,
  getInversePreset,
  inversePairs,
  inverseSegments,
  levelCrossings,
  numberText,
  presetSegments,
  type Box,
  type InversePresetId,
  type Point,
} from '../lib/functionsCore';

export interface FnInverseLabProps {
  /** Пример, с которого начинается работа. */
  initialPreset?: InversePresetId;
  /** Режим задачи: обратная линия и свидетель появляются только после проверки. */
  challenge?: boolean;
}

const EXTENT = 10;
const BOX: Box = { xMin: -EXTENT, xMax: EXTENT, yMin: -EXTENT, yMax: EXTENT };
const SAMPLES = 401;
const GRID_VALUES: readonly number[] = Array.from({ length: 2 * EXTENT + 1 }, (_, index) => index - EXTENT);

const PUZZLE_ORDER: readonly InversePresetId[] = [
  'square-all',
  'square-right',
  'cube',
  'abs-all',
  'reciprocal',
  'square-shift',
];

interface PlaneProps {
  id: string;
  preset: InversePresetId;
  showInverse: boolean;
  reveal: boolean;
}

/** Масштаб по осям одинаковый — только тогда отражение относительно y = x честное. */
function InversePlane({ id, preset, showInverse, reveal }: PlaneProps) {
  const centerX = 360;
  const centerY = 350;
  const radius = 320;
  const scale = radius / EXTENT;
  const px = (value: number) => centerX + value * scale;
  const py = (value: number) => centerY - value * scale;

  const spec = getInversePreset(preset);
  const direct = useMemo(() => presetSegments(preset, BOX, SAMPLES), [preset]);
  const mirrored = useMemo(() => inverseSegments(preset, BOX, SAMPLES), [preset]);
  const labelValues = GRID_VALUES.filter((value) => value !== 0 && value % 2 === 0);
  const collision = spec.collision;
  const showCollision = reveal && collision !== null && Math.abs(collision.level) <= EXTENT;

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
    <svg className="dm-signed-plane" viewBox="0 0 720 700" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{`График функции ${spec.formulaText} и проверка обратимости`}</title>
      <desc id={`${id}-desc`}>
        Сетка честная: одна клетка — одна единица по каждой оси, масштаб по осям одинаковый.
        Сплошной фиолетовой линией показан график {spec.formulaText}; область определения — {spec.domainText},
        область значений — {spec.rangeText}.
        {reveal && spec.invertible && showInverse
          ? ` Второй сплошной линией показан график обратной функции ${spec.inverseText}: он получен отражением первого относительно пунктирной прямой y = x.`
          : ''}
        {showCollision
          ? ` Горизонтальная прямая y = ${numberText(collision!.level)} пересекает график дважды: в точках с абсциссами ${numberText(collision!.firstX)} и ${numberText(collision!.secondX)}, поэтому обратной функции нет.`
          : ''}
        {!reveal ? ' Ответ про обратимость пока не показан.' : ''}
      </desc>
      <defs>
        <marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path className="dm-signed-plane__axis-arrow" d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>

      <rect
        className="dm-signed-plane__background"
        x={centerX - radius}
        y={centerY - radius}
        width={radius * 2}
        height={radius * 2}
        rx="12"
      />

      <g className="dm-signed-plane__grid" aria-hidden="true">
        {GRID_VALUES.map((value) => (
          <g key={value}>
            <line x1={px(value)} y1={centerY - radius} x2={px(value)} y2={centerY + radius} />
            <line x1={centerX - radius} y1={py(value)} x2={centerX + radius} y2={py(value)} />
          </g>
        ))}
      </g>

      <line
        className="dm-signed-plane__axis"
        x1={centerX - radius}
        y1={centerY}
        x2={centerX + radius}
        y2={centerY}
        markerEnd={`url(#${id}-arrow)`}
      />
      <line
        className="dm-signed-plane__axis"
        x1={centerX}
        y1={centerY + radius}
        x2={centerX}
        y2={centerY - radius}
        markerEnd={`url(#${id}-arrow)`}
      />

      <g className="dm-signed-plane__labels" aria-hidden="true">
        {labelValues.map((value) => (
          <g key={value}>
            <text x={px(value)} y={centerY + 20}>{numberText(value)}</text>
            <text x={centerX - 16} y={py(value) + 4}>{numberText(value)}</text>
          </g>
        ))}
        <text x={centerX + radius - 6} y={centerY - 12}>x</text>
        <text x={centerX + 14} y={centerY - radius + 12}>y</text>
        <text x={centerX - 15} y={centerY + 19}>0</text>
      </g>

      {reveal && (
        <g className="dm-signed-plane__reflection-guides" aria-hidden="true">
          <line x1={px(-EXTENT)} y1={py(-EXTENT)} x2={px(EXTENT)} y2={py(EXTENT)} />
        </g>
      )}

      {polyline(direct, 'dm-signed-plane__route-segment', 'direct')}

      {reveal && showInverse && polyline(mirrored, 'dm-geometry-grid__perpendicular', 'inverse')}

      {showCollision && (
        <>
          <g className="dm-geometry-grid__candidates" aria-hidden="true">
            <line
              x1={px(-EXTENT)}
              y1={py(collision!.level)}
              x2={px(EXTENT)}
              y2={py(collision!.level)}
            />
          </g>
          <g
            className="dm-signed-plane__point dm-signed-plane__point--x-reflection"
            transform={`translate(${px(collision!.firstX)} ${py(collision!.level)})`}
            aria-hidden="true"
          >
            <circle r="7" />
            <text x={-6} y={-14} textAnchor="end">({numberText(collision!.firstX)}; {numberText(collision!.level)})</text>
          </g>
          <g
            className="dm-signed-plane__point dm-signed-plane__point--y-reflection"
            transform={`translate(${px(collision!.secondX)} ${py(collision!.level)})`}
            aria-hidden="true"
          >
            <circle r="7" />
            <text x={6} y={-14} textAnchor="start">({numberText(collision!.secondX)}; {numberText(collision!.level)})</text>
          </g>
        </>
      )}
    </svg>
  );
}

export default function FnInverseLab({ initialPreset = 'square-right', challenge = false }: FnInverseLabProps) {
  const reactId = useId();
  const labId = `fn-inverse-${reactId.replace(/:/g, '')}`;
  const defaultPreset: InversePresetId = INVERSE_PRESET_IDS.includes(initialPreset)
    ? initialPreset
    : 'square-right';

  const [preset, setPreset] = useState<InversePresetId>(defaultPreset);
  const [showInverse, setShowInverse] = useState(true);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [answer, setAnswer] = useState<'yes' | 'no' | ''>('');
  const [checked, setChecked] = useState(false);

  const activePreset = challenge ? PUZZLE_ORDER[puzzleIndex % PUZZLE_ORDER.length]! : preset;
  const spec = getInversePreset(activePreset);
  const reveal = !challenge || checked;

  const pairs = useMemo(() => inversePairs(activePreset, spec.probes), [activePreset, spec.probes]);
  const crossings = spec.collision === null ? null : levelCrossings(activePreset, spec.collision.level);

  const correct = challenge && ((answer === 'yes') === spec.invertible);

  const reset = () => {
    setPreset(defaultPreset);
    setShowInverse(true);
    setPuzzleIndex(0);
    setAnswer('');
    setChecked(false);
  };

  const nextPuzzle = () => {
    setPuzzleIndex((current) => (current + 1) % PUZZLE_ORDER.length);
    setAnswer('');
    setChecked(false);
  };

  const result = !reveal
    ? {
      symbol: '?',
      headline: 'Можно ли по значению восстановить аргумент однозначно?',
      detail: 'Мысленно проведи горизонтальную прямую и посмотри, сколько раз она пересекает график. Ответ и вторая линия появятся после проверки.',
    }
    : challenge
      ? {
        symbol: correct ? '✓' : '×',
        headline: correct
          ? `Верно: функция ${spec.invertible ? 'обратима' : 'не обратима'}.`
          : `Пока нет: функция ${spec.invertible ? 'обратима' : 'не обратима'}.`,
        detail: `${spec.reason}${spec.inverseText ? ` Обратная функция: ${spec.inverseText}, её область определения — ${spec.inverseDomainText}.` : ''}`,
      }
      : {
        symbol: spec.invertible ? '⇄' : '×',
        headline: spec.invertible
          ? `${spec.formulaText} обратима, обратная функция: ${spec.inverseText}.`
          : `${spec.formulaText} не обратима на этой области определения.`,
        detail: `${spec.reason}${spec.invertible ? ` Область определения обратной функции — ${spec.inverseDomainText}: это в точности множество значений исходной.` : ''}`,
      };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория обратимости</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {challenge ? 'Есть ли у этой функции обратная?' : 'Отражение относительно прямой y = x'}
          </h3>
          <p>
            {challenge
              ? 'Смотри на график и решай: можно ли по каждому значению восстановить аргумент однозначно. Потом нажми «Проверить».'
              : 'Переключай примеры и следи за двумя вещами: сколько раз горизонтальная прямая пересекает график и как обратная линия получается отражением.'}
          </p>
        </div>
        <span className="dm-lab__badge">{reveal && spec.invertible ? (spec.inverseText ?? 'y = f⁻¹(x)') : 'y = f⁻¹(x)'}</span>
      </header>

      <div className="dm-lab__body">
        {!challenge && (
          <div className="dm-geometry-preset-buttons" role="group" aria-label="Примеры функций">
            {INVERSE_PRESET_IDS.map((item) => {
              const active = item === preset;
              return (
                <button
                  type="button"
                  key={item}
                  className={`dm-geometry-preset-button ${active ? 'dm-geometry-preset-button--active' : ''}`}
                  aria-pressed={active}
                  onClick={() => setPreset(item)}
                >
                  {getInversePreset(item).title}
                </button>
              );
            })}
          </div>
        )}

        {challenge && (
          <div className="dm-geometry-example-switch">
            <span>Функция № {puzzleIndex + 1} из {PUZZLE_ORDER.length}</span>
            <button className="dm-button dm-button--secondary" type="button" onClick={nextPuzzle}>
              Следующая функция
            </button>
          </div>
        )}

        <div className="dm-algebra-equation" role="math" aria-label={`Функция ${spec.formulaText}`}>
          <span>{spec.formulaText}</span>
          <span aria-hidden="true">⇄</span>
          <strong>{reveal ? (spec.inverseText ?? 'обратной функции нет') : 'обратная функция: ?'}</strong>
        </div>

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график функции" tabIndex={0}>
          <InversePlane
            id={`${labId}-plane`}
            preset={activePreset}
            showInverse={showInverse}
            reveal={reveal}
          />
        </div>

        {challenge && (
          <>
            <p className="dm-signed-caption">Мой ответ</p>
            <div className="dm-geometry-preset-buttons" role="group" aria-label="Обратима ли функция">
              <button
                type="button"
                className={`dm-geometry-preset-button ${answer === 'yes' ? 'dm-geometry-preset-button--active' : ''}`}
                aria-pressed={answer === 'yes'}
                onClick={() => {
                  setAnswer('yes');
                  setChecked(false);
                }}
              >
                Обратима
              </button>
              <button
                type="button"
                className={`dm-geometry-preset-button ${answer === 'no' ? 'dm-geometry-preset-button--active' : ''}`}
                aria-pressed={answer === 'no'}
                onClick={() => {
                  setAnswer('no');
                  setChecked(false);
                }}
              >
                Не обратима
              </button>
            </div>
            <div className="dm-geometry-answer-grid">
              <button className="dm-button" type="button" disabled={answer === ''} onClick={() => setChecked(true)}>
                Проверить
              </button>
            </div>
          </>
        )}

        {reveal && spec.invertible && (
          <button
            type="button"
            className="dm-button dm-button--secondary"
            aria-pressed={showInverse}
            onClick={() => setShowInverse((current) => !current)}
          >
            {showInverse ? 'Спрятать обратную функцию' : 'Показать обратную функцию'}
          </button>
        )}

        <div className="dm-algebra-table-wrap">
          <table className="dm-algebra-table">
            <caption>
              Пары «аргумент — значение» для {spec.formulaText}
              {reveal && spec.invertible ? ' и возврат по обратной функции' : ''}
            </caption>
            <thead>
              <tr>
                <th scope="col">x</th>
                {pairs.map((pair) => <th scope="col" key={`x-${pair.x}`}>{numberText(pair.x)}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">y = f(x)</th>
                {pairs.map((pair) => (
                  <td key={`y-${pair.x}`}>{pair.y === null ? '—' : numberText(pair.y)}</td>
                ))}
              </tr>
              {reveal && spec.invertible && (
                <tr>
                  <th scope="row">f⁻¹(y)</th>
                  {pairs.map((pair) => (
                    <td key={`back-${pair.x}`}>{pair.back === null ? '—' : numberText(pair.back)}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {reveal && (
          <div className="dm-signed-reflection-cards">
            <div>
              <span>Область определения f</span>
              <strong>{spec.domainText}</strong>
              <small>Что можно подставить в исходную функцию.</small>
            </div>
            <div>
              <span>Область значений f</span>
              <strong>{spec.rangeText}</strong>
              <small>Она же станет областью определения обратной.</small>
            </div>
            <div>
              <span>Горизонтальная прямая</span>
              <strong>
                {crossings === null
                  ? 'не больше одной точки'
                  : `${numberText(crossings)} точки при y = ${numberText(spec.collision!.level)}`}
              </strong>
              <small>Признак обратимости: каждое значение достигается не более одного раза.</small>
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
