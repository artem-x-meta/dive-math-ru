import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  absoluteValue,
  addSigned,
  formatRussianNumber,
  fromHalfTicks,
  isHalfStepGridValue,
  isHalfStepNumber,
  normalizeHalfStepRange,
  opposite,
  parseSignedDraft,
  quantizeHalfStep,
  subtractSigned,
  toHalfTicks,
} from '../lib/signedNumbers';

export type SignedOperation = 'add' | 'subtract';
export type SignedOperationModel = 'walk' | 'zero-pairs';

export interface SignedOperationLabProps {
  operation: SignedOperation;
  initialA?: number;
  initialB?: number;
  min?: number;
  max?: number;
  step?: number;
  model?: SignedOperationModel;
  showRewrite?: boolean;
}

interface LabRange {
  minimum: number;
  maximum: number;
  step: number;
}

const HARD_MINIMUM = -30;
const HARD_MAXIMUM = 30;

function safeHalf(value: number | undefined, fallback: number): number {
  return value !== undefined && isHalfStepNumber(value) ? value : fallback;
}

function makeRange(minimum: number | undefined, maximum: number | undefined, requestedStep: number | undefined): LabRange {
  return normalizeHalfStepRange(minimum, maximum, requestedStep, {
    defaultMinimum: -10,
    defaultMaximum: 10,
    hardMinimum: HARD_MINIMUM,
    hardMaximum: HARD_MAXIMUM,
  });
}

function safeValue(value: number | undefined, fallback: number, range: LabRange): number {
  const candidate = safeHalf(value, fallback);
  return Math.max(range.minimum, Math.min(range.maximum, quantizeHalfStep(candidate, range.step)));
}

function inputText(value: number): string {
  return String(value).replace('.', ',');
}

interface SignedFieldProps {
  id: string;
  label: string;
  value: number;
  range: LabRange;
  onChange: (value: number) => void;
}

function SignedField({ id, label, value, range, onChange }: SignedFieldProps) {
  const [draft, setDraft] = useState(inputText(value));
  const [isEditing, setIsEditing] = useState(false);
  const cancelCommit = useRef(false);
  const stepTicks = toHalfTicks(range.step);

  useEffect(() => {
    if (!isEditing) setDraft(inputText(value));
  }, [isEditing, value]);

  const edit = (rawValue: string) => {
    setDraft(rawValue);
    const parsed = parseSignedDraft(rawValue);
    if (
      parsed !== null
      && isHalfStepGridValue(parsed, range.step)
      && parsed >= range.minimum
      && parsed <= range.maximum
    ) {
      onChange(parsed);
    }
  };

  const commit = () => {
    const parsed = parseSignedDraft(draft);
    const next = parsed !== null && isHalfStepNumber(parsed)
      ? Math.max(range.minimum, Math.min(range.maximum, quantizeHalfStep(parsed, range.step)))
      : value;
    setDraft(inputText(next));
    onChange(next);
  };

  const nudge = (direction: -1 | 1) => {
    const next = fromHalfTicks(toHalfTicks(value) + direction * stepTicks);
    onChange(Math.max(range.minimum, Math.min(range.maximum, next)));
  };

  return (
    <div className="dm-field dm-signed-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{formatRussianNumber(value)}</span>
      </label>
      <div className="dm-signed-field__control">
        <button type="button" className="dm-signed-field__step" onClick={() => nudge(-1)} disabled={value <= range.minimum} aria-label={`Уменьшить ${label.toLowerCase()} на ${formatRussianNumber(range.step)}`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => {
            cancelCommit.current = false;
            setIsEditing(true);
          }}
          onChange={(event) => edit(event.target.value)}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              setDraft(inputText(value));
              setIsEditing(false);
              return;
            }
            commit();
            setIsEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelCommit.current = true;
              setDraft(inputText(value));
              event.currentTarget.blur();
            }
          }}
        />
        <button type="button" className="dm-signed-field__step" onClick={() => nudge(1)} disabled={value >= range.maximum} aria-label={`Увеличить ${label.toLowerCase()} на ${formatRussianNumber(range.step)}`}>+</button>
      </div>
      <small id={`${id}-hint`}>От {formatRussianNumber(range.minimum)} до {formatRussianNumber(range.maximum)}, шаг {formatRussianNumber(range.step)}</small>
    </div>
  );
}

interface NumberLineWalkProps {
  id: string;
  a: number;
  b: number;
  movement: number;
  result: number;
  operation: SignedOperation;
  range: LabRange;
}

function NumberLineWalk({ id, a, b, movement, result, operation, range }: NumberLineWalkProps) {
  const visualMinimum = Math.min(range.minimum, a, result, 0);
  const visualMaximum = Math.max(range.maximum, a, result, 0);
  const left = 48;
  const right = 672;
  const axisY = 122;
  const coordinate = (value: number) => left + ((value - visualMinimum) / (visualMaximum - visualMinimum)) * (right - left);
  const visualSpan = visualMaximum - visualMinimum;
  const tickStep = visualSpan <= 18 ? 1 : visualSpan <= 36 ? 2 : visualSpan <= 80 ? 5 : 10;
  const firstTick = Math.ceil(visualMinimum / tickStep) * tickStep;
  const tickCount = Math.floor((visualMaximum - firstTick) / tickStep);
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => firstTick + index * tickStep);
  const direction = movement > 0 ? 'вправо' : movement < 0 ? 'влево' : 'остаёмся на месте';

  return (
    <svg className="dm-signed-operation-line" viewBox="0 0 720 235" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{operation === 'add' ? 'Сложение' : 'Вычитание'} на координатной прямой</title>
      <desc id={`${id}-desc`}>
        Сначала идём от нуля к числу {formatRussianNumber(a)}, затем {direction} на {formatRussianNumber(absoluteValue(movement))} и попадаем в {formatRussianNumber(result)}.
      </desc>
      <defs>
        <marker id={`${id}-axis-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path className="dm-signed-operation-line__axis-arrow" d="M0,0 L8,4 L0,8 Z" />
        </marker>
        <marker id={`${id}-walk-arrow`} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path className="dm-signed-operation-line__walk-arrow" d="M0,0 L9,4.5 L0,9 Z" />
        </marker>
      </defs>
      <line className="dm-signed-operation-line__axis" x1={left} y1={axisY} x2={right} y2={axisY} markerEnd={`url(#${id}-axis-arrow)`} />
      {ticks.map((tick) => (
        <g className="dm-signed-operation-line__tick" key={tick} aria-hidden="true">
          <line x1={coordinate(tick)} y1={axisY - (tick === 0 ? 10 : 6)} x2={coordinate(tick)} y2={axisY + (tick === 0 ? 10 : 6)} />
          <text x={coordinate(tick)} y={axisY + 28}>{formatRussianNumber(tick)}</text>
        </g>
      ))}
      {a !== 0 && (
        <path
          className="dm-signed-operation-line__start-path"
          d={`M ${coordinate(0)} ${axisY - 15} Q ${(coordinate(0) + coordinate(a)) / 2} 38 ${coordinate(a)} ${axisY - 15}`}
          markerEnd={`url(#${id}-walk-arrow)`}
          aria-hidden="true"
        />
      )}
      {movement !== 0 && (
        <path
          className="dm-signed-operation-line__move-path"
          d={`M ${coordinate(a)} ${axisY - 24} Q ${(coordinate(a) + coordinate(result)) / 2} 18 ${coordinate(result)} ${axisY - 24}`}
          markerEnd={`url(#${id}-walk-arrow)`}
          aria-hidden="true"
        />
      )}
      <g className="dm-signed-operation-line__point dm-signed-operation-line__point--start" transform={`translate(${coordinate(a)} ${axisY})`} aria-hidden="true">
        <circle r="7" />
        <text y="52">старт {formatRussianNumber(a)}</text>
      </g>
      <g className="dm-signed-operation-line__point dm-signed-operation-line__point--result" transform={`translate(${coordinate(result)} ${axisY})`} aria-hidden="true">
        <circle r="9" />
        <text y="78">ответ {formatRussianNumber(result)}</text>
      </g>
      <text className="dm-signed-operation-line__move-label" x={(coordinate(a) + coordinate(result)) / 2} y="22" aria-hidden="true">
        {movement > 0 ? '+' : movement < 0 ? '−' : ''}{formatRussianNumber(absoluteValue(movement))}
      </text>
      <text className="dm-signed-operation-line__caption" x="360" y="218" aria-hidden="true">
        {formatRussianNumber(a)} {operation === 'add' ? '+' : '−'} ({formatRussianNumber(b)}) = {formatRussianNumber(result)}
      </text>
    </svg>
  );
}

function halfTokenCount(value: number): number {
  return Math.abs(toHalfTicks(value));
}

interface ZeroPairsProps {
  id: string;
  a: number;
  movement: number;
  result: number;
}

function ZeroPairs({ id, a, movement, result }: ZeroPairsProps) {
  const positiveHalves = (a > 0 ? halfTokenCount(a) : 0) + (movement > 0 ? halfTokenCount(movement) : 0);
  const negativeHalves = (a < 0 ? halfTokenCount(a) : 0) + (movement < 0 ? halfTokenCount(movement) : 0);
  const canceled = Math.min(positiveHalves, negativeHalves);
  const remaining = Math.abs(positiveHalves - negativeHalves);
  const columns = 30;
  const tokenX = (index: number) => 34 + (index % columns) * 21;
  const tokenY = (index: number, base: number) => base + Math.floor(index / columns) * 25;
  const rowHeight = Math.max(1, Math.ceil(Math.max(positiveHalves, negativeHalves) / columns)) * 25;
  const lowerRow = 58 + rowHeight;
  const captionY = lowerRow + rowHeight + 34;
  const height = Math.max(225, captionY + 42);

  return (
    <svg className="dm-signed-zero-pairs" viewBox={`0 0 720 ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Модель нулевых пар</title>
      <desc id={`${id}-desc`}>
        Положительных половинок {positiveHalves}, отрицательных половинок {negativeHalves}. Сокращается {canceled} нулевых пар; остаётся число {formatRussianNumber(result)}.
      </desc>
      <text className="dm-signed-zero-pairs__row-label" x="18" y="31">Положительные половинки</text>
      {Array.from({ length: positiveHalves }, (_, index) => (
        <g
          className={`dm-signed-zero-pairs__token dm-signed-zero-pairs__token--positive ${index < canceled ? 'dm-signed-zero-pairs__token--canceled' : ''}`}
          transform={`translate(${tokenX(index)} ${tokenY(index, 52)})`}
          aria-hidden="true"
          key={`positive-${index}`}
        >
          <rect x="-9" y="-9" width="18" height="18" rx="4" />
          <text y="4">+</text>
        </g>
      ))}
      <text className="dm-signed-zero-pairs__row-label" x="18" y={lowerRow - 20}>Отрицательные половинки</text>
      {Array.from({ length: negativeHalves }, (_, index) => (
        <g
          className={`dm-signed-zero-pairs__token dm-signed-zero-pairs__token--negative ${index < canceled ? 'dm-signed-zero-pairs__token--canceled' : ''}`}
          transform={`translate(${tokenX(index)} ${tokenY(index, lowerRow)})`}
          aria-hidden="true"
          key={`negative-${index}`}
        >
          <rect x="-9" y="-9" width="18" height="18" rx="4" />
          <text y="4">−</text>
        </g>
      ))}
      <line className="dm-signed-zero-pairs__divider" x1="18" y1={captionY - 22} x2="702" y2={captionY - 22} />
      <text className="dm-signed-zero-pairs__caption" x="360" y={captionY}>
        {canceled === 0
          ? 'Противоположных половинок нет — складываем одинаковые знаки.'
          : `${canceled} пар (+½) + (−½) дают ноль; остаётся ${remaining} половинок.`}
      </text>
      <text className="dm-signed-zero-pairs__result" x="360" y={captionY + 28}>
        результат: {formatRussianNumber(result)}
      </text>
    </svg>
  );
}

export default function SignedOperationLab({
  operation,
  initialA = -2,
  initialB = 5,
  min,
  max,
  step,
  model = 'walk',
  showRewrite = true,
}: SignedOperationLabProps) {
  const reactId = useId();
  const labId = `signed-operation-${reactId.replace(/:/g, '')}`;
  const range = useMemo(() => makeRange(min, max, step), [min, max, step]);
  const defaultA = safeValue(initialA, -2, range);
  const defaultB = safeValue(initialB, 5, range);
  const [a, setA] = useState(defaultA);
  const [b, setB] = useState(defaultB);
  const [activeModel, setActiveModel] = useState<SignedOperationModel>(model);
  const movement = operation === 'add' ? b : opposite(b);
  const result = operation === 'add' ? addSigned(a, b) : subtractSigned(a, b);
  const direction = movement > 0 ? 'вправо' : movement < 0 ? 'влево' : 'не двигаться';
  const operationName = operation === 'add' ? 'Сложение' : 'Вычитание';
  const action = movement === 0
    ? 'Второе число равно нулю, поэтому точка остаётся на месте.'
    : `Из ${formatRussianNumber(a)} нужно двигаться ${direction} на ${formatRussianNumber(absoluteValue(movement))}.`;

  const reset = () => {
    setA(defaultA);
    setB(defaultB);
    setActiveModel(model);
  };

  return (
    <section className="dm-lab dm-signed-operation not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория действий со знаками</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>{operationName}: движение и нулевые пары</h3>
          <p>Одна и та же запись видна как путь по прямой и как взаимное уничтожение противоположных величин.</p>
        </div>
        <span className="dm-lab__badge">{operation === 'add' ? 'a + b' : 'a − b'}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-signed-tabs" role="group" aria-label="Модель действия">
          <button type="button" className={`dm-signed-tab ${activeModel === 'walk' ? 'dm-signed-tab--active' : ''}`} aria-pressed={activeModel === 'walk'} onClick={() => setActiveModel('walk')}>
            Движение по прямой
          </button>
          <button type="button" className={`dm-signed-tab ${activeModel === 'zero-pairs' ? 'dm-signed-tab--active' : ''}`} aria-pressed={activeModel === 'zero-pairs'} onClick={() => setActiveModel('zero-pairs')}>
            Нулевые пары
          </button>
        </div>

        <div className="dm-lab__controls dm-signed-controls">
          <SignedField id={`${labId}-a`} label={operation === 'add' ? 'Первое слагаемое' : 'Уменьшаемое'} value={a} range={range} onChange={setA} />
          <SignedField id={`${labId}-b`} label={operation === 'add' ? 'Второе слагаемое' : 'Вычитаемое'} value={b} range={range} onChange={setB} />
        </div>

        {showRewrite && operation === 'subtract' && (
          <div className="dm-signed-rewrite" aria-label={`Вычитание ${formatRussianNumber(b)} заменяем сложением с ${formatRussianNumber(opposite(b))}`}>
            <span>{formatRussianNumber(a)} − ({formatRussianNumber(b)})</span>
            <span aria-hidden="true">=</span>
            <span>{formatRussianNumber(a)} + ({formatRussianNumber(opposite(b))})</span>
            <span aria-hidden="true">=</span>
            <strong>{formatRussianNumber(result)}</strong>
          </div>
        )}

        <div
          className="dm-signed-visual-wrap"
          role="region"
          aria-label={activeModel === 'walk' ? 'Прокручиваемая схема движения по координатной прямой' : 'Прокручиваемая схема нулевых пар'}
          tabIndex={0}
        >
          {activeModel === 'walk' ? (
            <NumberLineWalk id={`${labId}-walk`} a={a} b={b} movement={movement} result={result} operation={operation} range={range} />
          ) : (
            <ZeroPairs id={`${labId}-pairs`} a={a} movement={movement} result={result} />
          )}
        </div>

        <ol className="dm-signed-steps">
          {operation === 'subtract' && <li><span>1</span><p><strong>Меняем действие.</strong> Вычесть {formatRussianNumber(b)} — значит прибавить противоположное число {formatRussianNumber(opposite(b))}.</p></li>}
          <li><span>{operation === 'subtract' ? '2' : '1'}</span><p><strong>Определяем направление.</strong> {action}</p></li>
          <li><span>{operation === 'subtract' ? '3' : '2'}</span><p><strong>Читаем конечную координату.</strong> Получаем {formatRussianNumber(result)}.</p></li>
        </ol>

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{operation === 'add' ? '+' : '−'}</span>
          <p>
            <strong>{formatRussianNumber(a)} {operation === 'add' ? '+' : '−'} ({formatRussianNumber(b)}) = {formatRussianNumber(result)}</strong>
            <small>{action} Знак ответа подтверждает конечная точка, а не правило, выученное отдельно от смысла.</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
