import { useId, useMemo, useState } from 'react';
import {
  complementOfSet,
  differenceOfSets,
  formatFraction,
  intersectionOfSets,
  partitionByEvents,
  probabilityOfSet,
  selectOutcomes,
  unionOfSets,
  type NumberEventKind,
} from '../lib/probability';

export type ProbEventMode = 'sets' | 'chance';

export type ProbEventOperation =
  | 'left'
  | 'right'
  | 'union'
  | 'intersection'
  | 'complementLeft'
  | 'differenceLeft';

export interface ProbEventLabProps {
  mode?: ProbEventMode;
  initialLeft?: NumberEventKind;
  initialRight?: NumberEventKind;
  initialOperation?: ProbEventOperation;
}

/** Опыт лаборатории: из мешка наугад достают одну из двенадцати одинаковых карточек. */
const UNIVERSE: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const EVENT_LABELS: Readonly<Record<NumberEventKind, string>> = {
  even: 'число чётное',
  odd: 'число нечётное',
  multipleOfThree: 'число делится на 3',
  prime: 'число простое',
  greaterThanSix: 'число больше 6',
};

const EVENT_KEYS = Object.freeze([
  'even',
  'odd',
  'multipleOfThree',
  'prime',
  'greaterThanSix',
] as const);

interface OperationDefinition {
  readonly short: string;
  readonly button: string;
  readonly meaning: string;
}

const OPERATIONS: Readonly<Record<ProbEventOperation, OperationDefinition>> = {
  left: { short: 'A', button: 'A', meaning: 'произошло событие A' },
  right: { short: 'B', button: 'B', meaning: 'произошло событие B' },
  union: { short: 'A ∪ B', button: 'A ∪ B', meaning: 'произошло хотя бы одно из событий' },
  intersection: { short: 'A ∩ B', button: 'A ∩ B', meaning: 'произошли оба события сразу' },
  complementLeft: { short: 'Ā', button: 'Ā', meaning: 'событие A не произошло' },
  differenceLeft: { short: 'A \\ B', button: 'A \\ B', meaning: 'A произошло, а B — нет' },
};

const OPERATION_KEYS = Object.freeze([
  'left',
  'right',
  'union',
  'intersection',
  'complementLeft',
  'differenceLeft',
] as const);

function safeKind(value: NumberEventKind | undefined, fallback: NumberEventKind): NumberEventKind {
  return value !== undefined && EVENT_KEYS.includes(value) ? value : fallback;
}

function safeOperation(value: ProbEventOperation | undefined): ProbEventOperation {
  return value !== undefined && OPERATION_KEYS.includes(value) ? value : 'union';
}

interface Chip {
  readonly value: number;
  readonly x: number;
  readonly y: number;
}

/** Раскладывает карточки области по строкам вокруг её центра. */
function layoutChips(
  values: readonly number[],
  centreX: number,
  centreY: number,
  perRow: number,
  stepX: number,
  stepY: number,
): Chip[] {
  const rowCount = Math.max(1, Math.ceil(values.length / perRow));
  const firstY = centreY - ((rowCount - 1) * stepY) / 2;
  return values.map((value, index) => {
    const row = Math.floor(index / perRow);
    const inRow = Math.min(perRow, values.length - row * perRow);
    const column = index % perRow;
    const firstX = centreX - ((inRow - 1) * stepX) / 2;
    return { value, x: firstX + column * stepX, y: firstY + row * stepY };
  });
}

const FRAME = { x: 12, y: 40, width: 536, height: 286 };
const CIRCLE_A = { cx: 224, cy: 176, r: 104 };
const CIRCLE_B = { cx: 336, cy: 176, r: 104 };

export default function ProbEventLab({
  mode = 'sets',
  initialLeft,
  initialRight,
  initialOperation,
}: ProbEventLabProps) {
  const reactId = useId();
  const labId = `prob-event-${reactId.replace(/:/g, '')}`;
  const activeMode: ProbEventMode = mode === 'chance' ? 'chance' : 'sets';

  const [leftKind, setLeftKind] = useState<NumberEventKind>(() => safeKind(initialLeft, 'even'));
  const [rightKind, setRightKind] = useState<NumberEventKind>(() => safeKind(initialRight, 'multipleOfThree'));
  const [operation, setOperation] = useState<ProbEventOperation>(() => safeOperation(initialOperation));

  const left = useMemo(() => selectOutcomes(UNIVERSE, leftKind), [leftKind]);
  const right = useMemo(() => selectOutcomes(UNIVERSE, rightKind), [rightKind]);
  const partition = useMemo(() => partitionByEvents(UNIVERSE, left, right), [left, right]);

  const selected = useMemo(() => {
    switch (operation) {
      case 'left':
        return left;
      case 'right':
        return right;
      case 'union':
        return unionOfSets(left, right);
      case 'intersection':
        return intersectionOfSets(left, right);
      case 'complementLeft':
        return complementOfSet(UNIVERSE, left);
      default:
        return differenceOfSets(left, right);
    }
  }, [left, operation, right]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const probability = probabilityOfSet(selected, UNIVERSE);
  const reduced = formatFraction(probability);
  const rawFraction = `${selected.length}/${UNIVERSE.length}`;

  const chips = useMemo(
    () => [
      ...layoutChips(partition.onlyLeft, 176, CIRCLE_A.cy, 2, 42, 36),
      ...layoutChips(partition.both, 280, CIRCLE_A.cy, 2, 42, 36),
      ...layoutChips(partition.onlyRight, 384, CIRCLE_A.cy, 2, 42, 36),
      ...layoutChips(partition.neither, 280, 306, 8, 48, 34),
    ],
    [partition],
  );

  const clipLeftId = `${labId}-clip-left`;
  const maskLeftId = `${labId}-mask-left`;
  const maskRightId = `${labId}-mask-right`;
  const maskUnionId = `${labId}-mask-union`;
  const maskNotLeftId = `${labId}-mask-not-left`;
  const maskNotRightId = `${labId}-mask-not-right`;

  const shadingProps = (() => {
    switch (operation) {
      case 'left':
        return { mask: `url(#${maskLeftId})` };
      case 'right':
        return { mask: `url(#${maskRightId})` };
      case 'union':
        return { mask: `url(#${maskUnionId})` };
      case 'intersection':
        return { clipPath: `url(#${clipLeftId})`, mask: `url(#${maskRightId})` };
      case 'complementLeft':
        return { mask: `url(#${maskNotLeftId})` };
      default:
        return { clipPath: `url(#${clipLeftId})`, mask: `url(#${maskNotRightId})` };
    }
  })();

  const listing = selected.length === 0 ? 'ни одного исхода' : `{${selected.join('; ')}}`;
  const definition = OPERATIONS[operation];

  const description =
    `Прямоугольник — все ${UNIVERSE.length} равновозможных исходов опыта. Левый круг — событие A: ${EVENT_LABELS[leftKind]}; ` +
    `правый круг — событие B: ${EVENT_LABELS[rightKind]}. В общей части кругов стоят числа ${
      partition.both.length === 0 ? 'отсутствуют' : partition.both.join(', ')
    }; только в A — ${partition.onlyLeft.length === 0 ? 'ничего' : partition.onlyLeft.join(', ')}; ` +
    `только в B — ${partition.onlyRight.length === 0 ? 'ничего' : partition.onlyRight.join(', ')}; ` +
    `вне обоих кругов — ${partition.neither.length === 0 ? 'ничего' : partition.neither.join(', ')}. ` +
    `Закрашена область ${definition.short}, в неё входит ${selected.length} исходов.`;

  return (
    <section className="dm-lab dm-ratio-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория событий</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {activeMode === 'chance' ? 'Вероятность события и операции над событиями' : 'События, операции и диаграмма Эйлера'}
          </h3>
          <p>
            В мешке двенадцать одинаковых карточек с числами от 1 до 12; одну достают наугад. Выбери два события
            и посмотри, из каких исходов складывается результат операции.
          </p>
        </div>
        <span className="dm-lab__badge">{activeMode === 'chance' ? 'P = m / n' : 'n = 12'}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-lab__controls dm-ratio-controls">
          <div className="dm-field">
            <label htmlFor={`${labId}-left`}>Событие A</label>
            <select
              id={`${labId}-left`}
              value={leftKind}
              onChange={(event) => setLeftKind(event.target.value as NumberEventKind)}
            >
              {EVENT_KEYS.map((key) => (
                <option value={key} key={`${labId}-left-${key}`}>{EVENT_LABELS[key]}</option>
              ))}
            </select>
            <small>Благоприятных исходов: {left.length}</small>
          </div>
          <div className="dm-field">
            <label htmlFor={`${labId}-right`}>Событие B</label>
            <select
              id={`${labId}-right`}
              value={rightKind}
              onChange={(event) => setRightKind(event.target.value as NumberEventKind)}
            >
              {EVENT_KEYS.map((key) => (
                <option value={key} key={`${labId}-right-${key}`}>{EVENT_LABELS[key]}</option>
              ))}
            </select>
            <small>Благоприятных исходов: {right.length}</small>
          </div>
        </div>

        <div className="dm-ratio-tabs" role="group" aria-label="Операция над событиями">
          {OPERATION_KEYS.map((key) => (
            <button
              type="button"
              key={`${labId}-op-${key}`}
              aria-pressed={operation === key}
              className={operation === key ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
              onClick={() => setOperation(key)}
            >
              {OPERATIONS[key].button}
            </button>
          ))}
        </div>

        <div className="dm-geometry-static-wrap" role="region" aria-label="Прокручиваемая диаграмма Эйлера" tabIndex={0}>
          <svg
            className="dm-geometry-static"
            viewBox="0 0 560 340"
            role="img"
            aria-labelledby={`${labId}-svg-title ${labId}-svg-desc`}
          >
            <title id={`${labId}-svg-title`}>Диаграмма Эйлера для событий A и B</title>
            <desc id={`${labId}-svg-desc`}>{description}</desc>

            <defs>
              <clipPath id={clipLeftId}>
                <circle cx={CIRCLE_A.cx} cy={CIRCLE_A.cy} r={CIRCLE_A.r} />
              </clipPath>
              <mask id={maskLeftId}>
                <rect x="0" y="0" width="560" height="340" fill="black" />
                <circle cx={CIRCLE_A.cx} cy={CIRCLE_A.cy} r={CIRCLE_A.r} fill="white" />
              </mask>
              <mask id={maskRightId}>
                <rect x="0" y="0" width="560" height="340" fill="black" />
                <circle cx={CIRCLE_B.cx} cy={CIRCLE_B.cy} r={CIRCLE_B.r} fill="white" />
              </mask>
              <mask id={maskUnionId}>
                <rect x="0" y="0" width="560" height="340" fill="black" />
                <circle cx={CIRCLE_A.cx} cy={CIRCLE_A.cy} r={CIRCLE_A.r} fill="white" />
                <circle cx={CIRCLE_B.cx} cy={CIRCLE_B.cy} r={CIRCLE_B.r} fill="white" />
              </mask>
              <mask id={maskNotLeftId}>
                <rect x="0" y="0" width="560" height="340" fill="white" />
                <circle cx={CIRCLE_A.cx} cy={CIRCLE_A.cy} r={CIRCLE_A.r} fill="black" />
              </mask>
              <mask id={maskNotRightId}>
                <rect x="0" y="0" width="560" height="340" fill="white" />
                <circle cx={CIRCLE_B.cx} cy={CIRCLE_B.cy} r={CIRCLE_B.r} fill="black" />
              </mask>
            </defs>

            <g aria-hidden="true">
              <rect
                className="dm-geometry-circle__disk"
                x={FRAME.x}
                y={FRAME.y}
                width={FRAME.width}
                height={FRAME.height}
                rx={14}
                {...shadingProps}
              />
              <rect
                className="dm-geometry-static__guide"
                x={FRAME.x}
                y={FRAME.y}
                width={FRAME.width}
                height={FRAME.height}
                rx={14}
                fill="none"
              />
              <circle
                className="dm-geometry-circle__boundary"
                cx={CIRCLE_A.cx}
                cy={CIRCLE_A.cy}
                r={CIRCLE_A.r}
              />
              <circle
                className="dm-geometry-circle__boundary"
                cx={CIRCLE_B.cx}
                cy={CIRCLE_B.cy}
                r={CIRCLE_B.r}
              />

              <text x={FRAME.x + 16} y={FRAME.y - 12}>Ω — все 12 исходов</text>
              <text x={CIRCLE_A.cx - 64} y={CIRCLE_A.cy - 70} textAnchor="middle">A</text>
              <text x={CIRCLE_B.cx + 64} y={CIRCLE_B.cy - 70} textAnchor="middle">B</text>

              {chips.map((chip) => (
                <g key={`${labId}-chip-${chip.value}`}>
                  <circle
                    className={
                      selectedSet.has(chip.value)
                        ? 'dm-geometry-grid-cell dm-geometry-grid-cell--full'
                        : 'dm-geometry-grid-cell dm-geometry-grid-cell--empty'
                    }
                    cx={chip.x}
                    cy={chip.y}
                    r={17}
                  />
                  <text x={chip.x} y={chip.y + 6} textAnchor="middle">{chip.value}</text>
                </g>
              ))}
            </g>
          </svg>
        </div>

        <div className="dm-nt-model-grid">
          <div className="dm-nt-card">
            <div className="dm-nt-card__header">
              <h4>Событие A</h4>
              <p className="dm-nt-card__value">{left.length}</p>
            </div>
            <p>{EVENT_LABELS[leftKind]}: {`{${left.join('; ')}}`}.</p>
          </div>
          <div className="dm-nt-card">
            <div className="dm-nt-card__header">
              <h4>Событие B</h4>
              <p className="dm-nt-card__value">{right.length}</p>
            </div>
            <p>{EVENT_LABELS[rightKind]}: {`{${right.join('; ')}}`}.</p>
          </div>
        </div>

        {activeMode === 'chance' && (
          <div className="dm-ratio-table-wrap">
            <table className="dm-ratio-table">
              <caption>Все исходы равновозможны, поэтому вероятность — доля благоприятных</caption>
              <thead>
                <tr>
                  <th scope="col">Событие</th>
                  <th scope="col">Благоприятных m</th>
                  <th scope="col">m / 12</th>
                  <th scope="col">Вероятность</th>
                </tr>
              </thead>
              <tbody>
                {OPERATION_KEYS.map((key) => {
                  const set =
                    key === 'left'
                      ? left
                      : key === 'right'
                        ? right
                        : key === 'union'
                          ? unionOfSets(left, right)
                          : key === 'intersection'
                            ? intersectionOfSets(left, right)
                            : key === 'complementLeft'
                              ? complementOfSet(UNIVERSE, left)
                              : differenceOfSets(left, right);
                  return (
                    <tr key={`${labId}-row-${key}`} className={key === operation ? 'dm-ratio-table__current' : ''}>
                      <th scope="row">{OPERATIONS[key].short}</th>
                      <td>{set.length}</td>
                      <td>{set.length}/12</td>
                      <td>{formatFraction(probabilityOfSet(set, UNIVERSE))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{activeMode === 'chance' ? 'P' : '∪'}</span>
          <p>
            <strong>
              {definition.short} = {listing}
              {activeMode === 'chance'
                ? `, поэтому P(${definition.short}) = ${rawFraction}${rawFraction === reduced ? '' : ` = ${reduced}`}.`
                : `; в этом событии ${selected.length} из ${UNIVERSE.length} исходов.`}
            </strong>
            <small>
              Событие {definition.short} происходит ровно тогда, когда {definition.meaning}. Проверка суммы по областям
              диаграммы: {partition.onlyLeft.length} + {partition.both.length} + {partition.onlyRight.length} + {partition.neither.length} = {UNIVERSE.length}.
            </small>
          </p>
        </div>
      </div>
    </section>
  );
}
