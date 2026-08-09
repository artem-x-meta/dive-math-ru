import { useId, useMemo, useState } from 'react';
import { cartesianProduct, countVariants, pairCount, unorderedPairs, variantTreeLayout } from '../lib/dataStats';

export type DataTreeMode = 'tree' | 'pairs';

export interface DataTreeStep {
  name: string;
  options: string[];
}

export interface DataTreeLabProps {
  mode?: DataTreeMode;
  initialSteps?: DataTreeStep[];
  initialItems?: string[];
  challenge?: boolean;
}

interface StepDraft {
  name: string;
  options: string;
}

const MODES: readonly DataTreeMode[] = ['tree', 'pairs'];
const MIN_STEPS = 1;
const MAX_STEPS = 3;
const MAX_OPTIONS = 4;
const MAX_ITEMS = 8;
const MIN_ITEMS = 2;
const ROOT_LABEL = 'Начало';

const DEFAULT_STEPS: readonly DataTreeStep[] = [
  { name: 'Напиток', options: ['чай', 'какао', 'сок'] },
  { name: 'Бутерброд', options: ['с сыром', 'с джемом'] },
];
const DEFAULT_ITEMS: readonly string[] = ['Астра', 'Барс', 'Вихрь', 'Гроза'];

function safeMode(value: DataTreeMode | undefined): DataTreeMode {
  return value !== undefined && MODES.includes(value) ? value : 'tree';
}

/** Разбирает строку «а, б, в» в список вариантов без пустых и лишних элементов. */
function parseOptions(text: string, limit: number): string[] {
  return text
    .split(',')
    .map((part) => part.trim().slice(0, 14))
    .filter((part) => part.length > 0)
    .slice(0, limit);
}

function toDrafts(steps: readonly DataTreeStep[]): StepDraft[] {
  return steps.slice(0, MAX_STEPS).map((step, index) => ({
    name: String(step.name ?? `Шаг ${index + 1}`).slice(0, 16),
    options: (step.options ?? []).slice(0, MAX_OPTIONS).join(', '),
  }));
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

function parseAnswer(text: string): number | null {
  const normalized = text.trim();
  if (!/^\d{1,4}$/.test(normalized)) return null;
  return Number.parseInt(normalized, 10);
}

export default function DataTreeLab({
  mode,
  initialSteps,
  initialItems,
  challenge = false,
}: DataTreeLabProps) {
  const reactId = useId();
  const labId = `data-tree-${reactId.replace(/:/g, '')}`;
  const activeMode = safeMode(mode);

  const defaultDrafts = useMemo(
    () => toDrafts(initialSteps && initialSteps.length > 0 ? initialSteps : DEFAULT_STEPS),
    [initialSteps],
  );
  const defaultItems = useMemo(
    () => (initialItems && initialItems.length >= MIN_ITEMS ? initialItems : DEFAULT_ITEMS).slice(0, MAX_ITEMS).join(', '),
    [initialItems],
  );

  const [drafts, setDrafts] = useState<StepDraft[]>(defaultDrafts);
  const [itemsDraft, setItemsDraft] = useState(defaultItems);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const groups = drafts.map((draft) => parseOptions(draft.options, MAX_OPTIONS));
  const valid = groups.length > 0 && groups.every((group) => group.length > 0);
  const counts = groups.map((group) => group.length);
  const totalVariants = valid ? countVariants(counts) : 0;
  const combinations = valid ? cartesianProduct(groups) : [];
  const nodes = valid ? variantTreeLayout(groups, ROOT_LABEL) : [];

  const items = parseOptions(itemsDraft, MAX_ITEMS);
  const pairs = unorderedPairs(items);
  const totalPairs = pairCount(items.length);

  const reveal = !challenge || checked;
  const target = activeMode === 'tree' ? totalVariants : totalPairs;
  const question =
    activeMode === 'tree'
      ? 'Сколько всего вариантов даёт этот выбор?'
      : 'Сколько получится разных пар?';
  const parsedAnswer = parseAnswer(answer);
  const answerCorrect = parsedAnswer !== null && parsedAnswer === target;

  const invalidate = () => setChecked(false);
  const editStep = (index: number, patch: Partial<StepDraft>) => {
    invalidate();
    setDrafts((current) => current.map((draft, position) => (position === index ? { ...draft, ...patch } : draft)));
  };
  const addStep = () => {
    invalidate();
    setDrafts((current) => (current.length >= MAX_STEPS ? current : [...current, { name: `Шаг ${current.length + 1}`, options: 'да, нет' }]));
  };
  const removeStep = () => {
    invalidate();
    setDrafts((current) => (current.length <= MIN_STEPS ? current : current.slice(0, -1)));
  };
  const reset = () => {
    setDrafts(defaultDrafts);
    setItemsDraft(defaultItems);
    setAnswer('');
    setChecked(false);
  };

  // Разметка дерева: колонка — шаг выбора, строка — лист систематического перебора.
  const columnWidth = 158;
  const nodeWidth = 122;
  const nodeHeight = 26;
  const rowHeight = 34;
  const marginLeft = 16;
  const marginTop = 14;
  const treeWidth = marginLeft * 2 + (groups.length + 1) * columnWidth - (columnWidth - nodeWidth);
  const treeHeight = marginTop * 2 + Math.max(totalVariants, 1) * rowHeight;
  const nodeLeft = (depth: number) => marginLeft + depth * columnWidth;
  const nodeCentreY = (row: number) => marginTop + (row + 0.5) * rowHeight;

  const result = (() => {
    if (challenge && !checked) {
      return { symbol: '?', headline: question, detail: 'Посчитай сам, запиши число и нажми «Проверить»: перебор появится после ответа.' };
    }
    if (activeMode === 'tree') {
      if (!valid) {
        return { symbol: '×', headline: 'На каком-то шаге не осталось вариантов.', detail: 'В каждой строке перечисли хотя бы один вариант через запятую.' };
      }
      return {
        symbol: challenge ? (answerCorrect ? '✓' : '×') : '·',
        headline: `${counts.join(' · ')} = ${totalVariants} ${plural(totalVariants, 'вариант', 'варианта', 'вариантов')}.`,
        detail: 'Правило умножения: число вариантов на каждом шаге перемножается, потому что от каждой ветви отходит одинаковый набор продолжений.',
      };
    }
    if (items.length < MIN_ITEMS) {
      return { symbol: '×', headline: 'Нужно хотя бы два объекта.', detail: 'Перечисли названия через запятую.' };
    }
    return {
      symbol: challenge ? (answerCorrect ? '✓' : '×') : ':',
      headline: `${items.length} · ${items.length - 1} : 2 = ${totalPairs} ${plural(totalPairs, 'пара', 'пары', 'пар')}.`,
      detail: 'Каждый объект образует пару с остальными, поэтому упорядоченных пар n · (n − 1). В паре порядок не важен, значит каждая пара посчитана дважды.',
    };
  })();

  return (
    <section className="dm-lab dm-ratio-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория перебора</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {activeMode === 'tree' ? 'Дерево вариантов и правило умножения' : 'Все пары без повторов'}
          </h3>
          <p>
            {activeMode === 'tree'
              ? 'Задай шаги выбора: дерево и полный список вариантов строятся систематически, без пропусков и повторов.'
              : 'Перечисли объекты: лаборатория соберёт все пары, в которых порядок не важен.'}
          </p>
        </div>
        <span className="dm-lab__badge">{activeMode === 'tree' ? 'n₁ · n₂ · …' : 'n(n − 1) : 2'}</span>
      </header>

      <div className="dm-lab__body">
        {activeMode === 'tree' ? (
          <>
            <div className="dm-lab__controls dm-ratio-controls">
              {drafts.map((draft, index) => (
                <div className="dm-ratio-field" key={`${labId}-step-${index}`}>
                  <p className="dm-ratio-field__heading">Шаг {index + 1}</p>
                  <div className="dm-ratio-field__inputs">
                    <div className="dm-field">
                      <label htmlFor={`${labId}-name-${index}`}>Название шага</label>
                      <input
                        id={`${labId}-name-${index}`}
                        type="text"
                        value={draft.name}
                        maxLength={16}
                        onChange={(event) => editStep(index, { name: event.target.value })}
                      />
                    </div>
                    <div className="dm-field">
                      <label htmlFor={`${labId}-options-${index}`}>
                        Варианты через запятую <span className="dm-field__value">{groups[index]?.length ?? 0}</span>
                      </label>
                      <input
                        id={`${labId}-options-${index}`}
                        type="text"
                        value={draft.options}
                        aria-describedby={`${labId}-options-hint-${index}`}
                        onChange={(event) => editStep(index, { options: event.target.value })}
                      />
                      <small id={`${labId}-options-hint-${index}`}>Не больше {MAX_OPTIONS} вариантов на шаг.</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="dm-nt-actions" role="group" aria-label="Изменить число шагов выбора">
              <button type="button" className="dm-button dm-button--secondary" onClick={addStep} disabled={drafts.length >= MAX_STEPS}>
                Добавить шаг
              </button>
              <button type="button" className="dm-button dm-button--secondary" onClick={removeStep} disabled={drafts.length <= MIN_STEPS}>
                Убрать последний шаг
              </button>
              <button type="button" className="dm-button dm-button--secondary" onClick={reset}>
                Сбросить пример
              </button>
            </div>

            {valid && reveal && (
              <div className="dm-ratio-table-wrap" role="region" aria-label="Прокручиваемое дерево вариантов" tabIndex={0}>
                <svg
                  className="dm-algebra-expression-tree"
                  viewBox={`0 0 ${treeWidth} ${treeHeight}`}
                  role="img"
                  aria-labelledby={`${labId}-tree-title ${labId}-tree-desc`}
                >
                  <title id={`${labId}-tree-title`}>Дерево вариантов из {groups.length} шагов</title>
                  <desc id={`${labId}-tree-desc`}>
                    От начала отходит {counts[0]} ветвей{groups.length > 1 ? `, от каждой из них — ещё ${counts.slice(1).join(', затем ')}` : ''}.
                    Всего листьев {totalVariants}: {combinations.map((combination) => combination.join(' + ')).join('; ')}.
                  </desc>
                  {nodes
                    .filter((node) => node.parentRow !== null)
                    .map((node, index) => {
                      const startX = nodeLeft(node.depth - 1) + nodeWidth;
                      const startY = nodeCentreY(node.parentRow as number);
                      const endX = nodeLeft(node.depth);
                      const endY = nodeCentreY(node.row);
                      return (
                        <path
                          className="dm-algebra-expression-tree__edge"
                          key={`${labId}-edge-${index}`}
                          d={`M ${startX} ${startY} C ${startX + 18} ${startY}, ${endX - 18} ${endY}, ${endX} ${endY}`}
                          fill="none"
                          aria-hidden="true"
                        />
                      );
                    })}
                  {nodes.map((node, index) => {
                    const isLeaf = node.depth === groups.length;
                    return (
                      <g
                        className="dm-algebra-expression-tree__node"
                        key={`${labId}-node-${index}`}
                        aria-hidden="true"
                      >
                        <rect
                          x={nodeLeft(node.depth)}
                          y={nodeCentreY(node.row) - nodeHeight / 2}
                          width={nodeWidth}
                          height={nodeHeight}
                          rx={9}
                          style={isLeaf ? { fill: 'var(--dm-teal-soft)', stroke: 'var(--dm-teal)' } : undefined}
                        />
                        <text x={nodeLeft(node.depth) + nodeWidth / 2} y={nodeCentreY(node.row) + 5}>
                          {node.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}

            {valid && reveal && (
              <div className="dm-ratio-table-wrap">
                <table className="dm-ratio-table">
                  <caption>Систематический перебор: первый шаг меняется медленнее всех</caption>
                  <thead>
                    <tr>
                      <th scope="col">№</th>
                      {drafts.map((draft, index) => (
                        <th scope="col" key={`${labId}-head-${index}`}>{draft.name || `Шаг ${index + 1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {combinations.map((combination, index) => (
                      <tr key={`${labId}-combo-${index}`}>
                        <th scope="row">{index + 1}</th>
                        {combination.map((option, position) => (
                          <td key={`${labId}-combo-${index}-${position}`}>{option}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="dm-lab__controls dm-ratio-controls">
              <div className="dm-field">
                <label htmlFor={`${labId}-items`}>
                  Объекты через запятую <span className="dm-field__value">{items.length}</span>
                </label>
                <input
                  id={`${labId}-items`}
                  type="text"
                  value={itemsDraft}
                  aria-describedby={`${labId}-items-hint`}
                  onChange={(event) => {
                    setItemsDraft(event.target.value);
                    setChecked(false);
                  }}
                />
                <small id={`${labId}-items-hint`}>От {MIN_ITEMS} до {MAX_ITEMS} названий.</small>
              </div>
              <div className="dm-nt-actions">
                <button type="button" className="dm-button dm-button--secondary" onClick={reset}>Сбросить пример</button>
              </div>
            </div>

            {items.length >= MIN_ITEMS && reveal && (
              <div className="dm-ratio-table-wrap">
                <table className="dm-ratio-table">
                  <caption>Таблица встреч: отмечаем только клетки выше главной диагонали</caption>
                  <thead>
                    <tr>
                      <th scope="col">С кем</th>
                      {items.map((item) => (
                        <th scope="col" key={`${labId}-col-${item}`}>{item}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((rowItem, rowIndex) => (
                      <tr key={`${labId}-row-${rowItem}`}>
                        <th scope="row">{rowItem}</th>
                        {items.map((_columnItem, columnIndex) => (
                          <td key={`${labId}-cell-${rowIndex}-${columnIndex}`}>
                            {columnIndex > rowIndex ? '✓' : columnIndex === rowIndex ? '—' : '·'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {items.length >= MIN_ITEMS && reveal && (
              <ol className="dm-ratio-steps" aria-label="Все пары в систематическом порядке">
                {pairs.map((pair, index) => (
                  <li key={`${labId}-pair-${index}`}>
                    <span aria-hidden="true">{index + 1}</span>
                    <p>{pair[0]} — {pair[1]}</p>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}

        {challenge && (
          <div className="dm-ratio-unit-note">
            <span aria-hidden="true">?</span>
            <div>
              <div className="dm-field">
                <label htmlFor={`${labId}-answer`}>{question}</label>
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

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span>
          <p>
            <strong>{result.headline}</strong>
            <small>{result.detail}</small>
          </p>
        </div>
      </div>
    </section>
  );
}
