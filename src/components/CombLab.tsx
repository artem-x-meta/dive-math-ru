import { useId, useMemo, useState } from 'react';
import {
  arrangements,
  combinations,
  factorial,
  formatCount,
  pascalParents,
  pascalRowSum,
  pascalTriangle,
  permutations,
} from '../lib/combinatorics';

export type CombLabMode = 'combinations' | 'arrangements' | 'permutations';

export interface CombLabProps {
  initialMode?: CombLabMode;
  initialN?: number;
  initialK?: number;
  challenge?: boolean;
}

const MODES: readonly CombLabMode[] = ['combinations', 'arrangements', 'permutations'];
const MODE_LABELS: Readonly<Record<CombLabMode, string>> = {
  combinations: 'Сочетания C(n, k)',
  arrangements: 'Размещения A(n, k)',
  permutations: 'Перестановки n!',
};

const MIN_N = 1;
const MAX_N = 12;
/** Меньше пяти строк — и треугольник перестаёт быть похож на треугольник. */
const MIN_VISIBLE_ROWS = 5;

const CELL_WIDTH = 62;
const CELL_HEIGHT = 32;
const ROW_HEIGHT = 44;
const MARGIN_X = 70;
const MARGIN_TOP = 28;

function clampInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function safeMode(value: CombLabMode | undefined): CombLabMode {
  return value !== undefined && MODES.includes(value) ? value : 'combinations';
}

function parseAnswer(text: string): bigint | null {
  const normalized = text.replace(/[\s  ]/g, '');
  if (!/^\d{1,15}$/.test(normalized)) return null;
  return BigInt(normalized);
}

/** Русское склонение существительного после числительного. */
function plural(count: number, one: string, few: string, many: string): string {
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  const last = count % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/** Разворачивает произведение n(n−1)…(n−k+1) в строку множителей. */
function descendingFactors(n: number, k: number): string {
  if (k === 0) return '1';
  return Array.from({ length: k }, (_unused, step) => n - step).join(' · ');
}

export default function CombLab({
  initialMode,
  initialN,
  initialK,
  challenge = false,
}: CombLabProps) {
  const reactId = useId();
  const labId = `comb-lab-${reactId.replace(/:/g, '')}`;
  const defaultMode = safeMode(initialMode);
  const defaultN = clampInteger(initialN, 5, MIN_N, MAX_N);
  const defaultK = clampInteger(initialK, 2, 0, defaultN);

  const [mode, setMode] = useState<CombLabMode>(defaultMode);
  const [n, setN] = useState(defaultN);
  const [k, setK] = useState(defaultK);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const invalidate = () => setChecked(false);
  const safeK = Math.min(k, n);

  const lastRow = Math.max(n, MIN_VISIBLE_ROWS);
  const triangle = useMemo(() => pascalTriangle(lastRow), [lastRow]);

  const chosen = combinations(n, safeK);
  const placed = arrangements(n, safeK);
  const ordered = permutations(n);
  const parents = pascalParents(n, safeK);
  const rowSum = pascalRowSum(n);

  const usesTriangle = mode !== 'permutations';
  const value = mode === 'combinations' ? chosen : mode === 'arrangements' ? placed : ordered;
  const reveal = !challenge || checked;
  const parsedAnswer = parseAnswer(answer);
  const answerCorrect = parsedAnswer !== null && parsedAnswer === value;

  const isTarget = (row: number, position: number) => row === n && (!usesTriangle || position === safeK);
  const isMirror = (row: number, position: number) =>
    usesTriangle && row === n && position === n - safeK && position !== safeK;
  const isParent = (row: number, position: number) =>
    usesTriangle && row === n - 1 && (position === safeK - 1 || position === safeK);
  /** В режиме задачи прячем две нижние строки: и сама клетка, и её соседи выдают ответ. */
  const isHidden = (row: number) => usesTriangle && !reveal && row >= n - 1;

  const centerX = MARGIN_X + ((lastRow + 1) * CELL_WIDTH) / 2;
  const chartWidth = MARGIN_X * 2 + (lastRow + 1) * CELL_WIDTH;
  const chartHeight = MARGIN_TOP * 2 + (lastRow + 1) * ROW_HEIGHT;
  const cellX = (row: number, position: number) => centerX + (position - row / 2) * CELL_WIDTH;
  const cellY = (row: number) => MARGIN_TOP + row * ROW_HEIGHT;

  const description =
    `Треугольник Паскаля со строками от нулевой до строки ${lastRow}. ` +
    'В строке n стоят числа C(n, 0), C(n, 1), …, C(n, n); каждое число внутри строки равно сумме двух чисел над ним. ' +
    (usesTriangle
      ? `Подсвечена клетка строки ${n} с номером ${safeK}: ` +
        (reveal
          ? `в ней стоит число ${formatCount(chosen)}. Над ней подсвечены числа ${formatCount(parents.left)} и ${formatCount(parents.right)}, а симметричная клетка с номером ${n - safeK} содержит то же самое число.`
          : `значения двух нижних строк скрыты до нажатия кнопки «Проверить».`)
      : `Подсвечена вся строка ${n}; сумма её чисел равна ${formatCount(rowSum)}.`);

  const reset = () => {
    setMode(defaultMode);
    setN(defaultN);
    setK(defaultK);
    setAnswer('');
    setChecked(false);
  };

  const question =
    mode === 'combinations'
      ? `сколькими способами можно выбрать ${safeK} ${plural(safeK, 'предмет', 'предмета', 'предметов')} из ${n}, если порядок внутри выбора не важен?`
      : mode === 'arrangements'
        ? `сколькими способами можно выбрать ${safeK} ${plural(safeK, 'предмет', 'предмета', 'предметов')} из ${n} и расставить их по порядку?`
        : `сколькими способами можно выстроить в ряд все ${n} ${plural(n, 'предмет', 'предмета', 'предметов')}?`;

  return (
    <section className="dm-lab dm-ratio-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория выбора</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Треугольник Паскаля и три формулы подсчёта</h3>
          <p>
            Выбери, что считаем, задай n и k — и посмотри, где ответ живёт в треугольнике.
            Числа строки с номером n — это в точности C(n, 0), C(n, 1), …, C(n, n).
          </p>
        </div>
        <span className="dm-lab__badge">строка {n}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-ratio-tabs" role="group" aria-label="Что считаем">
          {MODES.map((key) => (
            <button
              type="button"
              key={`${labId}-mode-${key}`}
              aria-pressed={mode === key}
              className={mode === key ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
              onClick={() => {
                invalidate();
                setMode(key);
              }}
            >
              {MODE_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-ratio-controls">
          <div className="dm-field">
            <label htmlFor={`${labId}-n`}>
              Сколько всего объектов, n <span className="dm-field__value">{n}</span>
            </label>
            <input
              id={`${labId}-n`}
              type="range"
              min={MIN_N}
              max={MAX_N}
              step={1}
              value={n}
              aria-describedby={`${labId}-n-hint`}
              onChange={(event) => {
                invalidate();
                const next = Number(event.target.value);
                setN(next);
                if (k > next) setK(next);
              }}
            />
            <small id={`${labId}-n-hint`}>От {MIN_N} до {MAX_N}; стрелки клавиатуры меняют n на 1.</small>
          </div>

          <div className="dm-field">
            <label htmlFor={`${labId}-k`}>
              Сколько выбираем, k <span className="dm-field__value">{usesTriangle ? safeK : '—'}</span>
            </label>
            <input
              id={`${labId}-k`}
              type="range"
              min={0}
              max={n}
              step={1}
              value={safeK}
              disabled={!usesTriangle}
              aria-describedby={`${labId}-k-hint`}
              onChange={(event) => {
                invalidate();
                setK(Number(event.target.value));
              }}
            />
            <small id={`${labId}-k-hint`}>
              {usesTriangle
                ? `От 0 до ${n}: выбрать больше, чем есть, нельзя.`
                : 'В перестановке участвуют сразу все объекты, поэтому k здесь не нужен.'}
            </small>
          </div>
        </div>

        <p className="dm-ratio-unit-rate">
          <strong>Вопрос:</strong> {question}
        </p>

        <div className="dm-geometry-static-wrap" role="region" aria-label="Прокручиваемый треугольник Паскаля" tabIndex={0}>
          <svg
            className="dm-geometry-static"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-labelledby={`${labId}-triangle-title ${labId}-triangle-desc`}
          >
            <title id={`${labId}-triangle-title`}>Треугольник Паскаля с подсвеченной клеткой</title>
            <desc id={`${labId}-triangle-desc`}>{description}</desc>

            <g aria-hidden="true">
              {triangle.map((row, rowIndex) => (
                <text key={`${labId}-rowlabel-${rowIndex}`} x={6} y={cellY(rowIndex) + 6} textAnchor="start">
                  n={rowIndex}
                </text>
              ))}
              {triangle.map((row, rowIndex) =>
                row.map((cell, position) => {
                  const target = isTarget(rowIndex, position);
                  const highlighted = isParent(rowIndex, position) || isMirror(rowIndex, position);
                  const className = target
                    ? 'dm-geometry-grid-cell dm-geometry-grid-cell--full'
                    : highlighted
                      ? 'dm-geometry-grid-cell dm-geometry-grid-cell--partial'
                      : 'dm-geometry-grid-cell dm-geometry-grid-cell--empty';
                  return (
                    <g key={`${labId}-cell-${rowIndex}-${position}`}>
                      <rect
                        className={className}
                        x={cellX(rowIndex, position) - CELL_WIDTH / 2 + 3}
                        y={cellY(rowIndex) - CELL_HEIGHT / 2}
                        width={CELL_WIDTH - 6}
                        height={CELL_HEIGHT}
                        rx={9}
                      />
                      <text x={cellX(rowIndex, position)} y={cellY(rowIndex) + 6} textAnchor="middle">
                        {isHidden(rowIndex) ? '?' : formatCount(cell)}
                      </text>
                    </g>
                  );
                }),
              )}
            </g>
          </svg>
        </div>

        {challenge && (
          <div className="dm-ratio-unit-note">
            <span aria-hidden="true">?</span>
            <div>
              <div className="dm-field">
                <label htmlFor={`${labId}-answer`}>Сколько получится? Запиши число без пробелов</label>
                <input
                  id={`${labId}-answer`}
                  type="text"
                  inputMode="numeric"
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
                <button type="button" className="dm-button" onClick={() => setChecked(true)}>Проверить</button>
              </div>
            </div>
          </div>
        )}

        <div className="dm-ratio-table-wrap">
          <table className="dm-ratio-table">
            <caption>Три величины для одних и тех же n и k</caption>
            <thead>
              <tr>
                <th scope="col">Величина</th>
                <th scope="col">Как считается</th>
                <th scope="col">Значение</th>
              </tr>
            </thead>
            <tbody>
              <tr className={mode === 'permutations' ? 'dm-ratio-table__current' : ''}>
                <th scope="row">P<sub>{n}</sub> = {n}!</th>
                <td>1 · 2 · … · {n}</td>
                <td>{reveal || mode !== 'permutations' ? formatCount(ordered) : '?'}</td>
              </tr>
              <tr className={mode === 'arrangements' ? 'dm-ratio-table__current' : ''}>
                <th scope="row">A({n}, {safeK})</th>
                <td>{descendingFactors(n, safeK)}</td>
                <td>{reveal || mode !== 'arrangements' ? formatCount(placed) : '?'}</td>
              </tr>
              <tr className={mode === 'combinations' ? 'dm-ratio-table__current' : ''}>
                <th scope="row">C({n}, {safeK})</th>
                <td>A({n}, {safeK}) : {safeK}!</td>
                <td>{reveal || mode !== 'combinations' ? formatCount(chosen) : '?'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">
            {reveal ? (challenge ? (answerCorrect ? '✓' : '×') : '=') : '?'}
          </span>
          <p>
            <strong>
              {!reveal
                ? 'Посчитай сам, запиши число и нажми «Проверить».'
                : mode === 'combinations'
                  ? `C(${n}, ${safeK}) = ${n}! : (${safeK}! · ${n - safeK}!) = ${formatCount(chosen)}.`
                  : mode === 'arrangements'
                    ? `A(${n}, ${safeK}) = ${descendingFactors(n, safeK)} = ${formatCount(placed)}.`
                    : `P${n} = ${n}! = ${formatCount(ordered)}.`}
            </strong>
            <small>
              {mode === 'combinations'
                ? `Симметрия: C(${n}, ${safeK}) = C(${n}, ${n - safeK}) — выбрать ${safeK} значит отложить ${n - safeK}. ` +
                  `Правило треугольника: ${formatCount(parents.left)} + ${formatCount(parents.right)} = ${formatCount(parents.sum)}. ` +
                  `Сумма всей строки равна ${formatCount(rowSum)} — столько у множества из ${n} элементов подмножеств.`
                : mode === 'arrangements'
                  ? `Размещение — это сочетание, объекты которого ещё и упорядочены: A(${n}, ${safeK}) = C(${n}, ${safeK}) · ${safeK}! = ${formatCount(chosen)} · ${formatCount(factorial(safeK))}.`
                  : `Перестановка — это размещение сразу всех объектов: P${n} = A(${n}, ${n}) = ${formatCount(ordered)}. Каждый добавленный объект умножает ответ, поэтому факториал растёт стремительно.`}
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
