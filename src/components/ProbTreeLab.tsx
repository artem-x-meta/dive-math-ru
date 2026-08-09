import { useId, useMemo, useState } from 'react';
import {
  buildIndependentTree,
  buildUrnTree,
  compareFractions,
  complementProbability,
  countLabel,
  enumerateOutcomes,
  eventProbability,
  formatFraction,
  fraction,
  layoutTree,
  totalProbability,
  type Fraction,
  type TreeLayoutNode,
  type TreeOutcome,
} from '../lib/probability';

export type ProbTreePreset = 'urn' | 'series';
export type ProbTreeEvent = 'all' | 'atLeastOne' | 'exactlyOne' | 'none';

export interface ProbTreeLabProps {
  preset?: ProbTreePreset;
  initialRed?: number;
  initialBlue?: number;
  initialDraws?: number;
  initialWithReplacement?: boolean;
  initialSuccess?: string;
  initialEvent?: ProbTreeEvent;
  challenge?: boolean;
}

const PRESET_KEYS = Object.freeze(['urn', 'series'] as const);
const EVENT_KEYS = Object.freeze(['all', 'atLeastOne', 'exactlyOne', 'none'] as const);

/** Вероятности успеха, из которых можно собрать серию независимых испытаний. */
const SUCCESS_OPTIONS = Object.freeze([
  { key: '1/2', numerator: 1, denominator: 2 },
  { key: '1/3', numerator: 1, denominator: 3 },
  { key: '2/3', numerator: 2, denominator: 3 },
  { key: '1/4', numerator: 1, denominator: 4 },
  { key: '3/4', numerator: 3, denominator: 4 },
  { key: '2/5', numerator: 2, denominator: 5 },
  { key: '3/5', numerator: 3, denominator: 5 },
] as const);

const MIN_BALLS = 1;
const MAX_BALLS = 5;
const MIN_STEPS = 2;
const MAX_STEPS = 3;

function clampInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function parseFractionAnswer(text: string): Fraction | null {
  const normalized = text.trim().replace(',', '.');
  if (/^\d{1,6}$/.test(normalized)) return fraction(Number.parseInt(normalized, 10), 1);
  const parts = normalized.match(/^(\d{1,6})\s*\/\s*(\d{1,6})$/);
  if (parts === null) return null;
  const denominator = Number.parseInt(parts[2]!, 10);
  if (denominator === 0) return null;
  return fraction(Number.parseInt(parts[1]!, 10), denominator);
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

const COLUMN_WIDTH = 150;
const ROW_HEIGHT = 42;
const MARGIN_LEFT = 34;
const MARGIN_TOP = 26;
const LEAF_WIDTH = 178;

export default function ProbTreeLab({
  preset,
  initialRed,
  initialBlue,
  initialDraws,
  initialWithReplacement,
  initialSuccess,
  initialEvent,
  challenge = false,
}: ProbTreeLabProps) {
  const reactId = useId();
  const labId = `prob-tree-${reactId.replace(/:/g, '')}`;
  const defaultPreset: ProbTreePreset = preset !== undefined && PRESET_KEYS.includes(preset) ? preset : 'urn';
  const defaultSuccess =
    SUCCESS_OPTIONS.find((option) => option.key === initialSuccess)?.key ?? '1/2';
  const defaultEvent: ProbTreeEvent =
    initialEvent !== undefined && EVENT_KEYS.includes(initialEvent) ? initialEvent : 'atLeastOne';

  const [presetKey, setPresetKey] = useState<ProbTreePreset>(defaultPreset);
  const [red, setRed] = useState(() => clampInteger(initialRed, 2, MIN_BALLS, MAX_BALLS));
  const [blue, setBlue] = useState(() => clampInteger(initialBlue, 3, MIN_BALLS, MAX_BALLS));
  const [steps, setSteps] = useState(() => clampInteger(initialDraws, 2, MIN_STEPS, MAX_STEPS));
  const [withReplacement, setWithReplacement] = useState(initialWithReplacement === true);
  const [successKey, setSuccessKey] = useState<string>(defaultSuccess);
  const [selectedEvent, setSelectedEvent] = useState<ProbTreeEvent>(defaultEvent);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const success = SUCCESS_OPTIONS.find((option) => option.key === successKey) ?? SUCCESS_OPTIONS[0];
  const targetLabel = presetKey === 'urn' ? 'К' : 'П';
  const otherLabel = presetKey === 'urn' ? 'С' : 'М';
  const isUrn = presetKey === 'urn';

  const invalidate = () => setChecked(false);

  /** Из мешка нельзя вынуть больше шаров, чем в нём лежит: тогда опыт идёт с возвращением. */
  const forcedReplacement = presetKey === 'urn' && !withReplacement && steps > red + blue;
  const activeReplacement = withReplacement || forcedReplacement;

  const tree = useMemo(() => {
    if (presetKey === 'urn') {
      return buildUrnTree(
        [
          { label: targetLabel, count: red },
          { label: otherLabel, count: blue },
        ],
        steps,
        activeReplacement,
      );
    }
    const successProbability = fraction(success.numerator, success.denominator);
    const failureProbability = complementProbability(successProbability);
    return buildIndependentTree(
      Array.from({ length: steps }, () => [
        { label: targetLabel, probability: successProbability },
        { label: otherLabel, probability: failureProbability },
      ]),
    );
  }, [activeReplacement, blue, otherLabel, presetKey, red, steps, success, targetLabel]);

  const outcomes = useMemo(() => enumerateOutcomes(tree), [tree]);
  const layout = useMemo(() => layoutTree(tree), [tree]);

  const isFavorable = useMemo(() => {
    switch (selectedEvent) {
      case 'all':
        return (outcome: TreeOutcome) => countLabel(outcome, targetLabel) === steps;
      case 'exactlyOne':
        return (outcome: TreeOutcome) => countLabel(outcome, targetLabel) === 1;
      case 'none':
        return (outcome: TreeOutcome) => countLabel(outcome, targetLabel) === 0;
      default:
        return (outcome: TreeOutcome) => countLabel(outcome, targetLabel) >= 1;
    }
  }, [selectedEvent, steps, targetLabel]);

  const eventNames: Readonly<Record<ProbTreeEvent, string>> = {
    all: isUrn ? `все ${steps} шара красные` : `все ${steps} выстрела — попадания`,
    atLeastOne: isUrn ? 'хотя бы один красный шар' : 'хотя бы одно попадание',
    exactlyOne: isUrn ? 'ровно один красный шар' : 'ровно одно попадание',
    none: isUrn ? 'ни одного красного шара' : 'ни одного попадания',
  };

  const answerProbability = eventProbability(outcomes, isFavorable);
  const favorableOutcomes = outcomes.filter(isFavorable);
  const favorableKeys = useMemo(
    () => new Set(favorableOutcomes.map((outcome) => outcome.steps.join('|'))),
    [favorableOutcomes],
  );
  const total = totalProbability(outcomes);

  const reveal = !challenge || checked;
  const parsedAnswer = parseFractionAnswer(answer);
  const answerCorrect = parsedAnswer !== null && compareFractions(parsedAnswer, answerProbability) === 0;

  const leafNodes = useMemo(() => layout.filter((node) => node.isLeaf), [layout]);
  /** Множители пути: вероятности рёбер от корня к листу, собранные по родителям. */
  const edgeFactors = (leaf: TreeLayoutNode): string[] => {
    const factors: string[] = [];
    let current: TreeLayoutNode | undefined = leaf;
    while (current !== undefined && current.parent !== null) {
      factors.unshift(formatFraction(current.edgeProbability ?? fraction(1, 1)));
      current = layout[current.parent];
    }
    return factors;
  };

  const leafCount = outcomes.length;
  const treeWidth = MARGIN_LEFT + steps * COLUMN_WIDTH + LEAF_WIDTH + 20;
  const treeHeight = MARGIN_TOP * 2 + leafCount * ROW_HEIGHT;
  const nodeX = (depth: number) => MARGIN_LEFT + depth * COLUMN_WIDTH;
  const nodeY = (row: number) => MARGIN_TOP + (row + 0.5) * ROW_HEIGHT;

  const description =
    `Дерево испытания из ${steps} ${plural(steps, 'шага', 'шагов', 'шагов')}. ` +
    `У каждого узла ветвление на исходы «${targetLabel}» и «${otherLabel}», на рёбрах записаны их вероятности. ` +
    `Листьев ${leafCount}: ` +
    outcomes.map((outcome) => `${outcome.steps.join('')} — ${formatFraction(outcome.probability)}`).join('; ') +
    `. Сумма вероятностей всех листьев равна ${formatFraction(total)}.`;

  const reset = () => {
    setPresetKey(defaultPreset);
    setRed(clampInteger(initialRed, 2, MIN_BALLS, MAX_BALLS));
    setBlue(clampInteger(initialBlue, 3, MIN_BALLS, MAX_BALLS));
    setSteps(clampInteger(initialDraws, 2, MIN_STEPS, MAX_STEPS));
    setWithReplacement(initialWithReplacement === true);
    setSuccessKey(defaultSuccess);
    setSelectedEvent(defaultEvent);
    setAnswer('');
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-ratio-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория дерева испытаний</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Многошаговый опыт и правило умножения</h3>
          <p>
            {presetKey === 'urn'
              ? 'В мешке лежат красные (К) и синие (С) шары. Шары вынимают по одному; режим определяет, возвращается ли шар обратно.'
              : 'Стрелок делает несколько независимых выстрелов. П — попадание, М — промах; вероятность попадания одна и та же в каждом выстреле.'}
          </p>
        </div>
        <span className="dm-lab__badge">{leafCount} {plural(leafCount, 'путь', 'пути', 'путей')}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-ratio-tabs" role="group" aria-label="Сюжет опыта">
          {PRESET_KEYS.map((key) => (
            <button
              type="button"
              key={`${labId}-preset-${key}`}
              aria-pressed={presetKey === key}
              className={presetKey === key ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
              onClick={() => {
                invalidate();
                setPresetKey(key);
              }}
            >
              {key === 'urn' ? 'Мешок с шарами' : 'Серия выстрелов'}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-ratio-controls">
          {presetKey === 'urn' ? (
            <>
              <div className="dm-field">
                <label htmlFor={`${labId}-red`}>
                  Красных шаров <span className="dm-field__value">{red}</span>
                </label>
                <input
                  id={`${labId}-red`}
                  type="range"
                  min={MIN_BALLS}
                  max={MAX_BALLS}
                  step={1}
                  value={red}
                  aria-describedby={`${labId}-red-hint`}
                  onChange={(event) => {
                    invalidate();
                    setRed(Number(event.target.value));
                  }}
                />
                <small id={`${labId}-red-hint`}>От {MIN_BALLS} до {MAX_BALLS}; стрелки клавиатуры меняют число на 1.</small>
              </div>
              <div className="dm-field">
                <label htmlFor={`${labId}-blue`}>
                  Синих шаров <span className="dm-field__value">{blue}</span>
                </label>
                <input
                  id={`${labId}-blue`}
                  type="range"
                  min={MIN_BALLS}
                  max={MAX_BALLS}
                  step={1}
                  value={blue}
                  aria-describedby={`${labId}-blue-hint`}
                  onChange={(event) => {
                    invalidate();
                    setBlue(Number(event.target.value));
                  }}
                />
                <small id={`${labId}-blue-hint`}>Всего в мешке {red + blue} {plural(red + blue, 'шар', 'шара', 'шаров')}.</small>
              </div>
            </>
          ) : (
            <div className="dm-field">
              <label htmlFor={`${labId}-success`}>Вероятность попадания в одном выстреле</label>
              <select
                id={`${labId}-success`}
                value={successKey}
                onChange={(event) => {
                  invalidate();
                  setSuccessKey(event.target.value);
                }}
              >
                {SUCCESS_OPTIONS.map((option) => (
                  <option value={option.key} key={`${labId}-p-${option.key}`}>{option.key}</option>
                ))}
              </select>
              <small>Вероятность промаха дополняет её до единицы.</small>
            </div>
          )}

          <div className="dm-field">
            <label htmlFor={`${labId}-steps`}>
              {presetKey === 'urn' ? 'Извлечений' : 'Выстрелов'} <span className="dm-field__value">{steps}</span>
            </label>
            <input
              id={`${labId}-steps`}
              type="range"
              min={MIN_STEPS}
              max={MAX_STEPS}
              step={1}
              value={steps}
              aria-describedby={`${labId}-steps-hint`}
              onChange={(event) => {
                invalidate();
                setSteps(Number(event.target.value));
              }}
            />
            <small id={`${labId}-steps-hint`}>
              Каждый новый шаг ветвит дерево дальше; сейчас у него {leafCount} {plural(leafCount, 'путь', 'пути', 'путей')}.
            </small>
          </div>
        </div>

        {presetKey === 'urn' && (
          <div className="dm-ratio-tabs" role="group" aria-label="Возвращают ли шар в мешок">
            <button
              type="button"
              aria-pressed={!activeReplacement}
              className={!activeReplacement ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
              onClick={() => {
                invalidate();
                setWithReplacement(false);
              }}
              disabled={steps > red + blue}
            >
              Без возвращения
            </button>
            <button
              type="button"
              aria-pressed={activeReplacement}
              className={activeReplacement ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
              onClick={() => {
                invalidate();
                setWithReplacement(true);
              }}
            >
              С возвращением
            </button>
          </div>
        )}

        <div className="dm-geometry-static-wrap" role="region" aria-label="Прокручиваемое дерево испытания" tabIndex={0}>
          <svg
            className="dm-geometry-static"
            viewBox={`0 0 ${treeWidth} ${treeHeight}`}
            role="img"
            aria-labelledby={`${labId}-tree-title ${labId}-tree-desc`}
          >
            <title id={`${labId}-tree-title`}>Дерево испытания с вероятностями на рёбрах</title>
            <desc id={`${labId}-tree-desc`}>{description}</desc>

            <g aria-hidden="true">
              {layout
                .filter((node) => node.parent !== null)
                .map((node) => {
                  const parent = layout[node.parent as number]!;
                  const startX = nodeX(parent.depth) + 12;
                  const startY = nodeY(parent.row);
                  const endX = nodeX(node.depth) - 12;
                  const endY = nodeY(node.row);
                  return (
                    <g key={`${labId}-edge-${node.index}`}>
                      <line
                        className="dm-geometry-static__guide"
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                      />
                      <text x={(startX + endX) / 2} y={(startY + endY) / 2 - 8} textAnchor="middle">
                        {node.label} {formatFraction(node.edgeProbability ?? fraction(1, 1))}
                      </text>
                    </g>
                  );
                })}

              {layout
                .filter((node) => !node.isLeaf)
                .map((node) => (
                  <circle
                    className="dm-geometry-static__point"
                    key={`${labId}-node-${node.index}`}
                    cx={nodeX(node.depth)}
                    cy={nodeY(node.row)}
                    r={9}
                  />
                ))}

              {layout
                .filter((node) => node.isLeaf)
                .map((node) => {
                  const favorable = favorableKeys.has(node.steps.join('|'));
                  return (
                    <g key={`${labId}-leaf-${node.index}`}>
                      <rect
                        className={
                          favorable && reveal
                            ? 'dm-geometry-grid-cell dm-geometry-grid-cell--full'
                            : 'dm-geometry-grid-cell dm-geometry-grid-cell--empty'
                        }
                        x={nodeX(node.depth) - 10}
                        y={nodeY(node.row) - 16}
                        width={LEAF_WIDTH}
                        height={32}
                        rx={10}
                      />
                      <text x={nodeX(node.depth) - 10 + LEAF_WIDTH / 2} y={nodeY(node.row) + 6} textAnchor="middle">
                        {node.steps.join('')} — {formatFraction(node.pathProbability)}
                      </text>
                    </g>
                  );
                })}
            </g>
          </svg>
        </div>

        <div className="dm-ratio-tabs" role="group" aria-label="Событие, вероятность которого считаем">
          {EVENT_KEYS.map((key) => (
            <button
              type="button"
              key={`${labId}-event-${key}`}
              aria-pressed={selectedEvent === key}
              className={selectedEvent === key ? 'dm-ratio-tab dm-ratio-tab--active' : 'dm-ratio-tab'}
              onClick={() => {
                invalidate();
                setSelectedEvent(key);
              }}
            >
              {eventNames[key]}
            </button>
          ))}
        </div>

        {challenge && (
          <div className="dm-ratio-unit-note">
            <span aria-hidden="true">?</span>
            <div>
              <div className="dm-field">
                <label htmlFor={`${labId}-answer`}>
                  Вероятность события «{eventNames[selectedEvent]}» — запиши дробью вида 3/10
                </label>
                <input
                  id={`${labId}-answer`}
                  type="text"
                  inputMode="text"
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
            <caption>Пути дерева: вероятность пути — произведение вероятностей его рёбер</caption>
            <thead>
              <tr>
                <th scope="col">Путь</th>
                <th scope="col">Произведение по рёбрам</th>
                <th scope="col">Вероятность</th>
                <th scope="col">Событие</th>
              </tr>
            </thead>
            <tbody>
              {leafNodes.map((leaf) => {
                const favorable = favorableKeys.has(leaf.steps.join('|'));
                return (
                  <tr key={`${labId}-outcome-${leaf.index}`} className={favorable && reveal ? 'dm-ratio-table__current' : ''}>
                    <th scope="row">{leaf.steps.join('')}</th>
                    <td>{edgeFactors(leaf).join(' · ')}</td>
                    <td>{formatFraction(leaf.pathProbability)}</td>
                    <td>{favorable && reveal ? '✓' : reveal ? '—' : '?'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">
            {reveal ? (challenge ? (answerCorrect ? '✓' : '×') : '·') : '?'}
          </span>
          <p>
            <strong>
              {reveal
                ? `P(${eventNames[selectedEvent]}) = ${
                    favorableOutcomes.length === 0
                      ? '0'
                      : favorableOutcomes.map((outcome) => formatFraction(outcome.probability)).join(' + ')
                  } = ${formatFraction(answerProbability)}.`
                : 'Посчитай вероятность события сам, запиши дробь и нажми «Проверить».'}
            </strong>
            <small>
              Сумма вероятностей всех {leafCount} путей равна {formatFraction(total)} — дерево полное, ни один исход не потерян.
              {reveal
                ? ' Благоприятные пути отмечены: вероятность события — сумма вероятностей его путей.'
                : ' Подсказка: вероятность каждого пути — произведение чисел на его рёбрах.'}
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
