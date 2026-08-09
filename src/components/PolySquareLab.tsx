import { useEffect, useId, useMemo, useState } from 'react';
import {
  type AreaTile,
  differenceOfSquaresTiles,
  differenceSquareTiles,
  expandDifferenceOfSquares,
  expandDifferenceSquare,
  expandSumSquare,
  sumSquareTiles,
} from '../lib/polynomials';

export type PolySquareMode = 'sum' | 'difference' | 'difference-of-squares';

export interface PolySquareLabProps {
  /** Формула, открытая при загрузке. */
  mode?: PolySquareMode;
  /** Какие вкладки показывать. */
  allowedModes?: readonly PolySquareMode[];
  /** Длина первого отрезка a. */
  initialA?: number;
  /** Длина второго отрезка b. */
  initialB?: number;
  /** Режим задачи: площадь-ответ скрыта до нажатия «Проверить». */
  challenge?: boolean;
}

const MIN_A = 2;
const MAX_A = 12;
const MIN_B = 1;
const PAD = 62;
const SQUARE_BOX = 300;
const PAIR_BOX = 620;
const PAIR_GAP = 56;
const PAIR_HEIGHT = 258;
const MINUS = '−';
const ANSWER_DRAFT = /^[+-]?\d*$/;

const MODE_LABEL: Record<PolySquareMode, string> = {
  sum: 'Квадрат суммы',
  difference: 'Квадрат разности',
  'difference-of-squares': 'Разность квадратов',
};

const MODE_FORMULA: Record<PolySquareMode, string> = {
  sum: '(a + b)² = a² + 2ab + b²',
  difference: '(a − b)² = a² − 2ab + b²',
  'difference-of-squares': 'a² − b² = (a + b)(a − b)',
};

const TILE_CLASS: Record<AreaTile['kind'], string> = {
  'first-square': 'dm-geometry-polygon__shape',
  product: 'dm-geometry-grid-cell dm-geometry-grid-cell--partial',
  'second-square': 'dm-geometry-figure__shape',
  result: 'dm-geometry-polygon__shape',
  removed: 'dm-geometry-figure__completion',
};

function num(value: number): string {
  return String(value).replace('-', MINUS);
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

interface LengthFieldProps {
  id: string;
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
}

function LengthField({ id, label, value, minimum, maximum, onChange }: LengthFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  return (
    <div className="dm-field dm-algebra-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{num(value)}</span>
      </label>
      <div className="dm-algebra-field__control">
        <button
          type="button"
          className="dm-algebra-field__step"
          onClick={() => onChange(clampInteger(value - 1, minimum, maximum))}
          disabled={value <= minimum}
          aria-label={`Уменьшить ${label.toLowerCase()} на единицу`}
        >
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          maxLength={3}
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => setEditing(true)}
          onChange={(event) => {
            const raw = event.target.value;
            if (!/^\d*$/.test(raw)) return;
            setDraft(raw);
            const parsed = Number.parseInt(raw, 10);
            if (!Number.isNaN(parsed) && parsed >= minimum && parsed <= maximum) onChange(parsed);
          }}
          onBlur={() => {
            const parsed = Number.parseInt(draft, 10);
            const next = Number.isNaN(parsed) ? value : clampInteger(parsed, minimum, maximum);
            onChange(next);
            setDraft(String(next));
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(String(value));
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          className="dm-algebra-field__step"
          onClick={() => onChange(clampInteger(value + 1, minimum, maximum))}
          disabled={value >= maximum}
          aria-label={`Увеличить ${label.toLowerCase()} на единицу`}
        >
          +
        </button>
      </div>
      <small id={`${id}-hint`}>Целое число от {num(minimum)} до {num(maximum)} условных единиц.</small>
    </div>
  );
}

interface TilesProps {
  tiles: readonly AreaTile[];
  scale: number;
  originX: number;
  originY: number;
  reveal: boolean;
}

function Tiles({ tiles, scale, originX, originY, reveal }: TilesProps) {
  return (
    <>
      {tiles.map((tile) => {
        const width = tile.width * scale;
        const height = tile.height * scale;
        const x = originX + tile.x * scale;
        const y = originY + tile.y * scale;
        const roomy = width >= 54 && height >= 38;
        return (
          <g key={`${tile.id}-${tile.kind}`} aria-hidden="true">
            <rect className={TILE_CLASS[tile.kind]} x={x} y={y} width={width} height={height} />
            {roomy && (
              <g className="dm-geometry-figure__dimensions">
                <text x={x + width / 2} y={y + height / 2 - 2} textAnchor="middle">{tile.label}</text>
                <text x={x + width / 2} y={y + height / 2 + 20} textAnchor="middle">
                  {reveal ? num(tile.area) : '?'}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}

interface EdgeMarksProps {
  originX: number;
  originY: number;
  segments: readonly { length: number; label: string }[];
  scale: number;
}

/** Подписи отрезков вдоль верхней стороны фигуры. */
function EdgeMarks({ originX, originY, segments, scale }: EdgeMarksProps) {
  let offset = 0;
  return (
    <g className="dm-geometry-figure__dimensions" aria-hidden="true">
      {segments.map((segment) => {
        const start = originX + offset * scale;
        const width = segment.length * scale;
        offset += segment.length;
        return (
          <g key={`${segment.label}-${start}`}>
            <line x1={start + 3} y1={originY - 22} x2={start + width - 3} y2={originY - 22} />
            <line x1={start + 3} y1={originY - 29} x2={start + 3} y2={originY - 15} />
            <line x1={start + width - 3} y1={originY - 29} x2={start + width - 3} y2={originY - 15} />
            <text x={start + width / 2} y={originY - 30} textAnchor="middle">{segment.label}</text>
          </g>
        );
      })}
    </g>
  );
}

export default function PolySquareLab({
  mode = 'sum',
  allowedModes = ['sum', 'difference', 'difference-of-squares'],
  initialA = 5,
  initialB = 2,
  challenge = false,
}: PolySquareLabProps) {
  const reactId = useId();
  const labId = `poly-square-${reactId.replace(/:/g, '')}`;
  const modes = useMemo(() => {
    const filtered = (['sum', 'difference', 'difference-of-squares'] as const).filter((candidate) => allowedModes.includes(candidate));
    return filtered.length > 0 ? filtered : (['sum', 'difference', 'difference-of-squares'] as const);
  }, [allowedModes]);
  const defaults = useMemo(() => {
    const activeMode = modes.includes(mode) ? mode : modes[0]!;
    const a = clampInteger(initialA, MIN_A, MAX_A);
    const maximumB = activeMode === 'sum' ? MAX_A : a - 1;
    return { mode: activeMode, a, b: clampInteger(initialB, MIN_B, Math.max(MIN_B, maximumB)) };
  }, [initialA, initialB, mode, modes]);

  const [activeMode, setActiveMode] = useState<PolySquareMode>(defaults.mode);
  const [a, setA] = useState(defaults.a);
  const [b, setB] = useState(defaults.b);
  const [checked, setChecked] = useState(false);
  const [answer, setAnswer] = useState('');

  const maximumB = activeMode === 'sum' ? MAX_A : a - 1;
  const safeB = clampInteger(b, MIN_B, Math.max(MIN_B, maximumB));
  const reveal = !challenge || checked;

  const changeMode = (next: PolySquareMode) => {
    setActiveMode(next);
    setChecked(false);
    setAnswer('');
    if (next !== 'sum' && b >= a) setB(Math.max(MIN_B, a - 1));
  };

  const changeA = (next: number) => {
    setA(next);
    setChecked(false);
    setAnswer('');
    if (activeMode !== 'sum' && safeB >= next) setB(Math.max(MIN_B, next - 1));
  };

  const changeB = (next: number) => {
    setB(next);
    setChecked(false);
    setAnswer('');
  };

  const sumParts = expandSumSquare(a, safeB);
  const differenceParts = expandDifferenceSquare(a, safeB);
  const differenceOfSquares = expandDifferenceOfSquares(a, safeB);

  const squareLayout = activeMode === 'difference'
    ? differenceSquareTiles(a, safeB)
    : sumSquareTiles(a, safeB);
  const pairLayout = differenceOfSquaresTiles(a, Math.max(MIN_B, Math.min(safeB, a - 1)));

  const targetArea = activeMode === 'sum'
    ? sumParts.total
    : activeMode === 'difference'
      ? differenceParts.total
      : differenceOfSquares.squareDifference;

  const parsedAnswer = ANSWER_DRAFT.test(answer.trim()) && answer.trim() !== '' && answer.trim() !== '-' && answer.trim() !== '+'
    ? Number.parseInt(answer.trim(), 10)
    : null;
  const answerCorrect = parsedAnswer !== null && parsedAnswer === targetArea;

  const squareScale = SQUARE_BOX / squareLayout.side;
  const squareView = `0 0 ${SQUARE_BOX + 2 * PAD} ${SQUARE_BOX + 2 * PAD}`;

  const pairUnits = pairLayout.side + pairLayout.rectangleWidth;
  const pairScale = Math.min((PAIR_BOX - PAIR_GAP) / pairUnits, PAIR_HEIGHT / pairLayout.side);
  const pairWidth = pairUnits * pairScale + PAIR_GAP;
  const pairHeight = pairLayout.side * pairScale;
  const pairView = `0 0 ${pairWidth + 2 * PAD} ${pairHeight + 2 * PAD}`;
  const rectangleX = PAD + pairLayout.side * pairScale + PAIR_GAP;

  const equationText = activeMode === 'sum'
    ? `(${a} + ${safeB})² = ${sumParts.firstSquare} + ${num(sumParts.doubleProduct)} + ${sumParts.secondSquare} = ${sumParts.total}`
    : activeMode === 'difference'
      ? `(${a} ${MINUS} ${safeB})² = ${differenceParts.firstSquare} ${MINUS} ${Math.abs(differenceParts.doubleProduct)} + ${differenceParts.secondSquare} = ${differenceParts.total}`
      : `${a}² ${MINUS} ${safeB}² = ${a * a} ${MINUS} ${safeB * safeB} = ${differenceOfSquares.squareDifference} = ${differenceOfSquares.sum} · ${differenceOfSquares.difference}`;

  const svgDescription = activeMode === 'sum'
    ? `Квадрат со стороной a + b = ${a + safeB} разрезан на квадрат ${a}×${a}, два прямоугольника ${a}×${safeB} и квадрат ${safeB}×${safeB}.`
    : activeMode === 'difference'
      ? `Из квадрата со стороной a = ${a} срезаны две полосы ${a}×${safeB}; они пересекаются по квадрату ${safeB}×${safeB}, который поэтому возвращается в подсчёт. Остаётся квадрат со стороной ${a - safeB}.`
      : `Из квадрата со стороной ${a} вырезан квадрат со стороной ${safeB}. Оставшиеся два куска складываются в прямоугольник ${a + safeB} на ${a - safeB}.`;

  const reset = () => {
    setActiveMode(defaults.mode);
    setA(defaults.a);
    setB(defaults.b);
    setChecked(false);
    setAnswer('');
  };

  return (
    <section className="dm-lab dm-algebra-distributive dm-geometry-figure-measure not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория формул сокращённого умножения</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Формула как разрезанный квадрат</h3>
          <p>Каждое слагаемое формулы — это площадь настоящего куска фигуры. Меняй a и b: пропорции на рисунке пересчитываются честно.</p>
        </div>
        <span className="dm-lab__badge">{MODE_FORMULA[activeMode]}</span>
      </header>

      <div className="dm-lab__body">
        {modes.length > 1 && (
          <div className="dm-algebra-tabs" role="group" aria-label="Формула сокращённого умножения">
            {modes.map((candidate) => (
              <button
                type="button"
                className={`dm-algebra-tab ${activeMode === candidate ? 'dm-algebra-tab--active' : ''}`}
                aria-pressed={activeMode === candidate}
                onClick={() => changeMode(candidate)}
                key={candidate}
              >
                {MODE_LABEL[candidate]}
              </button>
            ))}
          </div>
        )}

        <div className="dm-lab__controls dm-algebra-controls">
          <LengthField id={`${labId}-a`} label="Отрезок a" value={a} minimum={MIN_A} maximum={MAX_A} onChange={changeA} />
          <LengthField id={`${labId}-b`} label="Отрезок b" value={safeB} minimum={MIN_B} maximum={Math.max(MIN_B, maximumB)} onChange={changeB} />
        </div>

        {activeMode !== 'sum' && (
          <p className="dm-algebra-group-detail__caption">Для этих двух моделей нужно a &gt; b: иначе вырезаемый квадрат не помещается.</p>
        )}

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемая площадная модель формулы" tabIndex={0}>
          {activeMode === 'difference-of-squares' ? (
            <svg className="dm-geometry-figure" viewBox={pairView} role="img" aria-labelledby={`${labId}-svg-title ${labId}-svg-desc`}>
              <title id={`${labId}-svg-title`}>Разность квадратов как перекроенный прямоугольник</title>
              <desc id={`${labId}-svg-desc`}>{svgDescription}</desc>
              <rect className="dm-geometry-grid__background" x={PAD} y={PAD} width={pairLayout.side * pairScale} height={pairLayout.side * pairScale} />
              <Tiles tiles={pairLayout.cut} scale={pairScale} originX={PAD} originY={PAD} reveal={reveal} />
              <Tiles tiles={[pairLayout.removed]} scale={pairScale} originX={PAD} originY={PAD} reveal={reveal} />
              <Tiles tiles={pairLayout.rearranged} scale={pairScale} originX={rectangleX} originY={PAD} reveal={reveal} />
              <EdgeMarks originX={PAD} originY={PAD} scale={pairScale} segments={[{ length: a, label: `a = ${a}` }]} />
              <EdgeMarks
                originX={rectangleX}
                originY={PAD}
                scale={pairScale}
                segments={[{ length: a, label: `a = ${a}` }, { length: safeB, label: `b = ${safeB}` }]}
              />
              <g className="dm-geometry-figure__dimensions" aria-hidden="true">
                <text x={PAD + (pairLayout.side * pairScale) / 2} y={PAD + pairLayout.side * pairScale + 34} textAnchor="middle">
                  вырезали b² = {safeB * safeB}
                </text>
                <text x={rectangleX + (pairLayout.rectangleWidth * pairScale) / 2} y={PAD + pairLayout.rectangleHeight * pairScale + 34} textAnchor="middle">
                  {a + safeB} · {a - safeB} = {reveal ? differenceOfSquares.product : '?'}
                </text>
              </g>
            </svg>
          ) : (
            <svg className="dm-geometry-figure" viewBox={squareView} role="img" aria-labelledby={`${labId}-svg-title ${labId}-svg-desc`}>
              <title id={`${labId}-svg-title`}>Площадная модель квадрата двучлена</title>
              <desc id={`${labId}-svg-desc`}>{svgDescription}</desc>
              <rect className="dm-geometry-grid__background" x={PAD} y={PAD} width={SQUARE_BOX} height={SQUARE_BOX} />
              <Tiles
                tiles={activeMode === 'difference' ? squareLayout.tiles.slice(1) : squareLayout.tiles}
                scale={squareScale}
                originX={PAD}
                originY={PAD}
                reveal={reveal}
              />
              {activeMode === 'difference' && (
                <Tiles tiles={[squareLayout.result]} scale={squareScale} originX={PAD} originY={PAD} reveal={reveal} />
              )}
              <EdgeMarks
                originX={PAD}
                originY={PAD}
                scale={squareScale}
                segments={activeMode === 'difference'
                  ? [{ length: a - safeB, label: `a − b = ${a - safeB}` }, { length: safeB, label: `b = ${safeB}` }]
                  : [{ length: a, label: `a = ${a}` }, { length: safeB, label: `b = ${safeB}` }]}
              />
              <g className="dm-geometry-figure__dimensions" aria-hidden="true">
                <text x={PAD + SQUARE_BOX / 2} y={PAD + SQUARE_BOX + 34} textAnchor="middle">
                  {activeMode === 'sum'
                    ? `(a + b)² = ${reveal ? sumParts.total : '?'}`
                    : `a² = ${a * a}, остаток (a − b)² = ${reveal ? differenceParts.total : '?'}`}
                </text>
              </g>
            </svg>
          )}
        </div>

        <div className="dm-algebra-equation" role="math" aria-label={equationText}>
          <span>{MODE_FORMULA[activeMode]}</span>
          <span aria-hidden="true">→</span>
          <strong>{reveal ? equationText : 'ответ закрыт до проверки'}</strong>
        </div>

        {challenge && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>
              {activeMode === 'difference-of-squares' ? 'Площадь оставшейся фигуры' : 'Площадь фигуры-ответа'}
            </label>
            <input
              id={`${labId}-answer`}
              type="text"
              inputMode="numeric"
              value={answer}
              onChange={(event) => {
                const raw = event.target.value.replace(MINUS, '-').slice(0, 6);
                if (!ANSWER_DRAFT.test(raw)) return;
                setAnswer(raw);
                setChecked(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && parsedAnswer !== null) {
                  event.preventDefault();
                  setChecked(true);
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setAnswer('');
                  setChecked(false);
                }
              }}
            />
            <button className="dm-button" type="button" disabled={parsedAnswer === null} onClick={() => setChecked(true)}>Проверить</button>
          </div>
        )}

        <ol className="dm-algebra-steps">
          {activeMode === 'sum' && (
            <>
              <li><span>1</span><p><strong>Сторона.</strong> Она равна a + b, то есть {a} + {safeB} = {a + safeB}.</p></li>
              <li><span>2</span><p><strong>Части.</strong> {a}² = {sumParts.firstSquare}, два прямоугольника по {a} · {safeB} = {a * safeB}, и {safeB}² = {sumParts.secondSquare}.</p></li>
              <li><span>3</span><p><strong>Итог.</strong> {sumParts.firstSquare} + {num(sumParts.doubleProduct)} + {sumParts.secondSquare} = {reveal ? sumParts.total : '?'} — это и есть ({a} + {safeB})².</p></li>
            </>
          )}
          {activeMode === 'difference' && (
            <>
              <li><span>1</span><p><strong>Целое.</strong> Большой квадрат имеет площадь {a}² = {differenceParts.firstSquare}.</p></li>
              <li><span>2</span><p><strong>Срезаем дважды.</strong> Две полосы {a} · {safeB} = {a * safeB} пересекаются по квадрату {safeB}² = {differenceParts.secondSquare}: он вычтен два раза.</p></li>
              <li><span>3</span><p><strong>Возвращаем угол.</strong> {differenceParts.firstSquare} − {Math.abs(differenceParts.doubleProduct)} + {differenceParts.secondSquare} = {reveal ? differenceParts.total : '?'} = ({a} − {safeB})².</p></li>
            </>
          )}
          {activeMode === 'difference-of-squares' && (
            <>
              <li><span>1</span><p><strong>Вырезаем.</strong> Из {a}² = {a * a} убираем {safeB}² = {safeB * safeB}; остаётся {reveal ? differenceOfSquares.squareDifference : '?'}.</p></li>
              <li><span>2</span><p><strong>Перекладываем.</strong> Два куска дают прямоугольник со сторонами {a} + {safeB} = {differenceOfSquares.sum} и {a} − {safeB} = {differenceOfSquares.difference}.</p></li>
              <li><span>3</span><p><strong>Сверяем.</strong> Площадь не изменилась: {differenceOfSquares.sum} · {differenceOfSquares.difference} = {reveal ? differenceOfSquares.product : '?'}.</p></li>
            </>
          )}
        </ol>

        <div className={`dm-result ${challenge && checked && !answerCorrect ? 'dm-algebra-result--warning' : ''}`} aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">
            {challenge ? (!checked ? '?' : answerCorrect ? '✓' : '×') : '='}
          </span>
          <p>
            <strong>
              {challenge && !checked
                ? 'Посчитай площадь по рисунку и нажми «Проверить».'
                : challenge && !answerCorrect
                  ? `Пока нет: площадь равна ${num(targetArea)}.`
                  : equationText}
            </strong>
            <small>
              {activeMode === 'sum'
                ? 'Удвоенное произведение — это два одинаковых прямоугольника. Именно их теряют, когда пишут (a + b)² = a² + b².'
                : activeMode === 'difference'
                  ? 'Квадрат b² вычтен дважды, поэтому его один раз возвращают. Знак минус стоит только у удвоенного произведения.'
                  : 'Площадь при перекладывании не меняется, поэтому a² − b² и (a + b)(a − b) — одно и то же число при любых a и b.'}
            </small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
