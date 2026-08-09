import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  approximate,
  clipLineToBox,
  evaluateLinear,
  formatExactText,
  linearExpression,
  linearTable,
  slopeBehaviour,
  xIntercept,
} from '../lib/linear';
import { compareExact, parseExact } from '../lib/exactRational';

export type LinearGraphMode = 'function' | 'read';

export interface LinearGraphLabProps {
  mode?: LinearGraphMode;
  initialK?: number;
  initialB?: number;
  extent?: number;
  challenge?: boolean;
}

interface Puzzle {
  readonly k: number;
  readonly b: number;
}

const DRAFT_PATTERN = /^[+\-−]?\d*(?:[.,]\d*)?$/;
const MAX_DRAFT_LENGTH = 12;
const K_LIMIT = 5;
const B_LIMIT = 6;
const K_STEP = 0.5;
const B_STEP = 0.5;
const HARD_EXTENT_MIN = 3;
const HARD_EXTENT_MAX = 12;

const PUZZLES: readonly Puzzle[] = [
  { k: 2, b: -3 },
  { k: -1, b: 2 },
  { k: 0.5, b: 1 },
  { k: -2, b: 0 },
  { k: 1, b: -4 },
  { k: -0.5, b: 3 },
];

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeNumber(value: number | undefined, fallback: number, limit: number, step: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clamp(quantize(value, step), -limit, limit);
}

function parseDraft(rawValue: string): number | null {
  const normalized = rawValue.trim().replace('−', '-').replace(',', '.');
  if (normalized === '' || normalized === '-' || normalized === '+' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: number): string {
  return formatExactText(parseExact(value));
}

function draftText(value: number): string {
  return String(value).replace('.', ',');
}

function sameNumber(left: number, right: number): boolean {
  return compareExact(parseExact(left), parseExact(right)) === 0;
}

interface NumberFieldProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  limit: number;
  step: number;
  onChange: (value: number) => void;
}

function NumberField({ id, label, hint, value, limit, step, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(draftText(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(draftText(value));
  }, [editing, value]);

  const commit = () => {
    const parsed = parseDraft(draft);
    const next = parsed === null ? value : clamp(quantize(parsed, step), -limit, limit);
    setDraft(draftText(next));
    onChange(next);
  };

  const nudge = (direction: -1 | 1) => {
    onChange(clamp(quantize(value + direction * step, step), -limit, limit));
  };

  return (
    <div className="dm-field dm-signed-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{text(value)}</span>
      </label>
      <div className="dm-signed-field__control">
        <button
          type="button"
          className="dm-signed-field__step"
          onClick={() => nudge(-1)}
          disabled={value <= -limit}
          aria-label={`Уменьшить ${label} на ${text(step)}`}
        >
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          maxLength={MAX_DRAFT_LENGTH}
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => {
            cancelCommit.current = false;
            setEditing(true);
          }}
          onChange={(event) => {
            const raw = event.target.value;
            if (DRAFT_PATTERN.test(raw)) setDraft(raw);
          }}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              setDraft(draftText(value));
              setEditing(false);
              return;
            }
            commit();
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelCommit.current = true;
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          className="dm-signed-field__step"
          onClick={() => nudge(1)}
          disabled={value >= limit}
          aria-label={`Увеличить ${label} на ${text(step)}`}
        >
          +
        </button>
      </div>
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

interface PlaneProps {
  id: string;
  k: number;
  b: number;
  extent: number;
  reveal: boolean;
}

function LinearPlane({ id, k, b, extent, reveal }: PlaneProps) {
  const centerX = 360;
  const centerY = 278;
  const radius = 236;
  const scale = radius / extent;
  const px = (value: number) => centerX + value * scale;
  const py = (value: number) => centerY - value * scale;
  const gridValues = Array.from({ length: extent * 2 + 1 }, (_, index) => -extent + index);

  const segment = clipLineToBox(k, b, extent);
  const expression = linearExpression(k, b);
  const zero = xIntercept(expression);
  const zeroValue = zero === null ? null : approximate(zero);
  const stepVisible = extent >= 1 && Math.abs(b) <= extent && Math.abs(b + k) <= extent;
  const interceptVisible = Math.abs(b) <= extent;
  const zeroVisible = zeroValue !== null && Math.abs(zeroValue) <= extent;

  // Две точки прямой с целыми абсциссами — то же, что читает глаз по сетке.
  const sampleLeft = segment ? Math.ceil(segment.x1) : 0;
  const sampleRight = segment ? Math.floor(segment.x2) : 0;
  const samples = segment && sampleRight > sampleLeft
    ? [sampleLeft, sampleRight]
    : [0, 1];
  const sampleText = samples
    .map((sampleX) => `(${text(sampleX)}; ${formatExactText(evaluateLinear(expression, sampleX))})`)
    .join(' и ');

  return (
    <svg className="dm-signed-plane" viewBox="0 0 720 570" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{reveal ? `График функции y = ${text(k)}x + ${text(b)}` : 'График линейной функции для распознавания'}</title>
      <desc id={`${id}-desc`}>
        {segment === null
          ? 'В выбранном окне прямая не видна: сдвинь параметры или увеличь окно.'
          : reveal
            ? `Прямая проходит через точку ${text(0)}; ${text(b)} на оси y и имеет угловой коэффициент ${text(k)}: при сдвиге на 1 вправо ордината меняется на ${text(k)}. Прямая проходит через точки ${sampleText}.`
            : `Прямая построена на сетке с шагом 1 и проходит через точки ${sampleText}. Определи по рисунку угловой коэффициент и свободный член.`}
      </desc>
      <defs>
        <marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path className="dm-signed-plane__axis-arrow" d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>
      <rect className="dm-signed-plane__background" x={centerX - radius} y={centerY - radius} width={radius * 2} height={radius * 2} rx="12" />
      <g className="dm-signed-plane__grid" aria-hidden="true">
        {gridValues.map((value) => (
          <g key={value}>
            <line x1={px(value)} y1={centerY - radius} x2={px(value)} y2={centerY + radius} />
            <line x1={centerX - radius} y1={py(value)} x2={centerX + radius} y2={py(value)} />
          </g>
        ))}
      </g>
      <line className="dm-signed-plane__axis" x1={centerX - radius} y1={centerY} x2={centerX + radius} y2={centerY} markerEnd={`url(#${id}-arrow)`} />
      <line className="dm-signed-plane__axis" x1={centerX} y1={centerY + radius} x2={centerX} y2={centerY - radius} markerEnd={`url(#${id}-arrow)`} />
      <g className="dm-signed-plane__labels" aria-hidden="true">
        {gridValues.filter((value) => value !== 0).map((value) => (
          <g key={value}>
            <text x={px(value)} y={centerY + 20}>{value}</text>
            <text x={centerX - 14} y={py(value) + 4}>{value}</text>
          </g>
        ))}
        <text x={centerX + radius - 4} y={centerY - 12}>x</text>
        <text x={centerX + 13} y={centerY - radius + 11}>y</text>
        <text x={centerX - 15} y={centerY + 19}>0</text>
      </g>

      {segment && (
        <g className="dm-signed-plane__route-segment" aria-hidden="true">
          <line x1={px(segment.x1)} y1={py(segment.y1)} x2={px(segment.x2)} y2={py(segment.y2)} />
        </g>
      )}

      {reveal && stepVisible && (
        <g className="dm-signed-plane__reflection-guides" aria-hidden="true">
          <line x1={px(0)} y1={py(b)} x2={px(1)} y2={py(b)} />
          <line x1={px(1)} y1={py(b)} x2={px(1)} y2={py(b + k)} />
        </g>
      )}

      {interceptVisible && (
        <g className="dm-signed-plane__point dm-signed-plane__point--a" transform={`translate(${px(0)} ${py(b)})`} aria-hidden="true">
          <circle r="8" />
          {reveal && <text x={11} y={-11}>(0; {text(b)})</text>}
        </g>
      )}

      {reveal && zeroVisible && zeroValue !== null && (
        <g className="dm-signed-plane__point dm-signed-plane__point--finish" transform={`translate(${px(zeroValue)} ${py(0)})`} aria-hidden="true">
          <circle r="7" />
          <text x={11} y={21}>({formatExactText(zero!)}; 0)</text>
        </g>
      )}

      {reveal && stepVisible && (
        <g className="dm-signed-plane__labels" aria-hidden="true">
          <text x={px(0.5)} y={py(b) - 8}>+1</text>
          <text x={px(1) + 20} y={py(b + k / 2) + 4}>{k >= 0 ? '+' : ''}{text(k)}</text>
        </g>
      )}
    </svg>
  );
}

export default function LinearGraphLab({
  mode = 'function',
  initialK,
  initialB,
  extent,
  challenge = false,
}: LinearGraphLabProps) {
  const reactId = useId();
  const labId = `linear-graph-${reactId.replace(/:/g, '')}`;
  const isRead = mode === 'read' || challenge;

  const safeExtent = useMemo(
    () => clamp(Math.round(extent ?? 6), HARD_EXTENT_MIN, HARD_EXTENT_MAX),
    [extent],
  );
  const defaultK = safeNumber(initialK, 2, K_LIMIT, K_STEP);
  const defaultB = safeNumber(initialB, -3, B_LIMIT, B_STEP);

  const puzzles = useMemo<readonly Puzzle[]>(() => {
    const head: Puzzle = { k: defaultK, b: defaultB };
    const rest = PUZZLES.filter((item) => !(sameNumber(item.k, head.k) && sameNumber(item.b, head.b)));
    return [head, ...rest];
  }, [defaultK, defaultB]);

  const [k, setK] = useState(defaultK);
  const [b, setB] = useState(defaultB);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [kAnswer, setKAnswer] = useState('');
  const [bAnswer, setBAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const puzzle = puzzles[puzzleIndex % puzzles.length]!;
  const activeK = isRead ? puzzle.k : k;
  const activeB = isRead ? puzzle.b : b;
  const reveal = !isRead || checked;

  const expression = useMemo(() => linearExpression(activeK, activeB), [activeK, activeB]);
  const behaviour = slopeBehaviour(expression);
  const zero = xIntercept(expression);
  const tableXs = useMemo(
    () => [-2, -1, 0, 1, 2].filter((value) => Math.abs(value) <= safeExtent),
    [safeExtent],
  );
  const rows = useMemo(() => linearTable(expression, tableXs), [expression, tableXs]);

  const parsedK = parseDraft(kAnswer);
  const parsedB = parseDraft(bAnswer);
  const answerReady = parsedK !== null && parsedB !== null;
  const kCorrect = parsedK !== null && sameNumber(parsedK, activeK);
  const bCorrect = parsedB !== null && sameNumber(parsedB, activeB);
  const allCorrect = kCorrect && bCorrect;

  const behaviourText = behaviour === 'increasing'
    ? 'функция возрастает: график идёт вверх слева направо'
    : behaviour === 'decreasing'
      ? 'функция убывает: график идёт вниз слева направо'
      : 'функция постоянна: график — горизонтальная прямая';

  const result = isRead && !checked
    ? {
      symbol: '?',
      headline: 'Прочитай по графику k и b.',
      detail: 'Свободный член b — ордината точки пересечения с осью y. Угловой коэффициент k — изменение y при сдвиге на 1 вправо.',
    }
    : isRead
      ? {
        symbol: allCorrect ? '✓' : '×',
        headline: allCorrect
          ? `Верно: y = ${text(activeK)}x ${activeB < 0 ? '−' : '+'} ${text(Math.abs(activeB))}.`
          : `Здесь k = ${text(activeK)}, b = ${text(activeB)}.`,
        detail: allCorrect
          ? `Проверка: при x = 1 получается y = ${formatExactText(evaluateLinear(expression, 1))}.`
          : `${kCorrect ? 'Угловой коэффициент найден верно.' : 'Посчитай подъём при сдвиге ровно на 1 вправо.'} ${bCorrect ? 'Свободный член найден верно.' : 'Свободный член читается на оси y при x = 0.'}`,
      }
      : {
        symbol: 'ƒ',
        headline: `y = ${text(activeK)}x ${activeB < 0 ? '−' : '+'} ${text(Math.abs(activeB))}; ${behaviourText}.`,
        detail: zero === null
          ? `График пересекает ось y в точке (0; ${text(activeB)}) и не пересекает ось x, если b ≠ 0.`
          : `График пересекает ось y в точке (0; ${text(activeB)}), а ось x — в точке (${formatExactText(zero)}; 0).`,
      };

  const reset = () => {
    setK(defaultK);
    setB(defaultB);
    setPuzzleIndex(0);
    setKAnswer('');
    setBAnswer('');
    setChecked(false);
  };

  const nextPuzzle = () => {
    setPuzzleIndex((current) => (current + 1) % puzzles.length);
    setKAnswer('');
    setBAnswer('');
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория линейной функции</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {isRead ? 'Прочитай прямую: чему равны k и b' : 'Два числа задают всю прямую'}
          </h3>
          <p>
            {isRead
              ? 'Сетка честная: одна клетка — одна единица по каждой оси. Найди наклон и точку на оси y.'
              : 'Меняй k и b и следи, что именно меняется в рисунке: наклон или высота.'}
          </p>
        </div>
        <span className="dm-lab__badge">y = kx + b</span>
      </header>

      <div className="dm-lab__body">
        {!isRead && (
          <div className="dm-lab__controls dm-signed-controls">
            <NumberField
              id={`${labId}-k`}
              label="Угловой коэффициент k"
              hint={`От −${K_LIMIT} до ${K_LIMIT}, шаг ${text(K_STEP)}`}
              value={k}
              limit={K_LIMIT}
              step={K_STEP}
              onChange={setK}
            />
            <NumberField
              id={`${labId}-b`}
              label="Свободный член b"
              hint={`От −${B_LIMIT} до ${B_LIMIT}, шаг ${text(B_STEP)}`}
              value={b}
              limit={B_LIMIT}
              step={B_STEP}
              onChange={setB}
            />
          </div>
        )}

        {isRead && (
          <div className="dm-geometry-example-switch">
            <span>Прямая № {puzzleIndex + 1} из {puzzles.length}</span>
            <button className="dm-button dm-button--secondary" type="button" onClick={nextPuzzle}>
              Следующая прямая
            </button>
          </div>
        )}

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график линейной функции" tabIndex={0}>
          <LinearPlane id={`${labId}-plane`} k={activeK} b={activeB} extent={safeExtent} reveal={reveal} />
        </div>

        {isRead && (
          <div className="dm-geometry-answer-grid">
            <div className="dm-geometry-answer-field">
              <label htmlFor={`${labId}-k-answer`}>Мой k</label>
              <input
                id={`${labId}-k-answer`}
                type="text"
                inputMode="decimal"
                maxLength={MAX_DRAFT_LENGTH}
                value={kAnswer}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (DRAFT_PATTERN.test(raw)) {
                    setKAnswer(raw);
                    setChecked(false);
                  }
                }}
              />
            </div>
            <div className="dm-geometry-answer-field">
              <label htmlFor={`${labId}-b-answer`}>Мой b</label>
              <input
                id={`${labId}-b-answer`}
                type="text"
                inputMode="decimal"
                maxLength={MAX_DRAFT_LENGTH}
                value={bAnswer}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (DRAFT_PATTERN.test(raw)) {
                    setBAnswer(raw);
                    setChecked(false);
                  }
                }}
              />
            </div>
            <button className="dm-button" type="button" disabled={!answerReady} onClick={() => setChecked(true)}>
              Проверить
            </button>
          </div>
        )}

        {reveal && (
          <div className="dm-algebra-table-wrap">
            <table className="dm-algebra-table">
              <caption>Таблица значений для y = {text(activeK)}x {activeB < 0 ? '−' : '+'} {text(Math.abs(activeB))}</caption>
              <thead>
                <tr>
                  <th scope="col">x</th>
                  {rows.map((row) => <th scope="col" key={`h-${formatExactText(row.x)}`}>{formatExactText(row.x)}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">y</th>
                  {rows.map((row) => <td key={`v-${formatExactText(row.x)}`}>{formatExactText(row.y)}</td>)}
                </tr>
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

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
