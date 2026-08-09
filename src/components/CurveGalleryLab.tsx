import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  CURVE_KINDS,
  curveBranches,
  curveFacts,
  curveShape,
  curveTable,
  curveText,
  curveTitle,
  curveValue,
  type CurveKind,
} from '../lib/inequalities';

export interface CurveGalleryLabProps {
  initialKind?: CurveKind;
  initialCoefficient?: number;
  extent?: number;
  challenge?: boolean;
}

interface Puzzle {
  readonly kind: CurveKind;
  readonly coefficient: number;
}

const DRAFT_PATTERN = /^[+\-−]?\d*(?:[.,]\d*)?$/;
const MAX_DRAFT_LENGTH = 8;
const COEFFICIENT_LIMIT = 6;
const COEFFICIENT_STEP = 0.5;
const EXTENT_MIN = 3;
const EXTENT_MAX = 12;
const SAMPLES = 192;

const PUZZLES: readonly Puzzle[] = [
  { kind: 'square', coefficient: 1 },
  { kind: 'inverse', coefficient: 4 },
  { kind: 'abs', coefficient: -1 },
  { kind: 'sqrt', coefficient: 2 },
  { kind: 'inverse', coefficient: -3 },
  { kind: 'square', coefficient: -0.5 },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function numberText(value: number): string {
  return String(value).replace('.', ',').replace('-', '−');
}

function draftText(value: number): string {
  return String(value).replace('.', ',');
}

function parseDraft(rawValue: string): number | null {
  const normalized = rawValue.trim().replace('−', '-').replace(',', '.');
  if (normalized === '' || normalized === '-' || normalized === '+' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeCoefficient(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  const snapped = clamp(quantize(value, COEFFICIENT_STEP), -COEFFICIENT_LIMIT, COEFFICIENT_LIMIT);
  return snapped === 0 ? fallback : snapped;
}

/** Ноль запрещён: при k = 0 все четыре формулы вырождаются в одну прямую y = 0. */
function skipZero(value: number, direction: -1 | 1): number {
  return value === 0 ? direction * COEFFICIENT_STEP : value;
}

interface CoefficientFieldProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
}

function CoefficientField({ id, value, onChange }: CoefficientFieldProps) {
  const [draft, setDraft] = useState(draftText(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(draftText(value));
  }, [editing, value]);

  const commit = () => {
    const parsed = parseDraft(draft);
    const next = parsed === null || parsed === 0
      ? value
      : clamp(quantize(parsed, COEFFICIENT_STEP), -COEFFICIENT_LIMIT, COEFFICIENT_LIMIT) || value;
    setDraft(draftText(next));
    onChange(next);
  };

  const nudge = (direction: -1 | 1) => {
    const raw = quantize(value + direction * COEFFICIENT_STEP, COEFFICIENT_STEP);
    onChange(clamp(skipZero(raw, direction), -COEFFICIENT_LIMIT, COEFFICIENT_LIMIT));
  };

  return (
    <div className="dm-field dm-signed-field">
      <label htmlFor={id}>
        Коэффициент k <span className="dm-field__value">{numberText(value)}</span>
      </label>
      <div className="dm-signed-field__control">
        <button
          type="button"
          className="dm-signed-field__step"
          onClick={() => nudge(-1)}
          disabled={value <= -COEFFICIENT_LIMIT}
          aria-label={`Уменьшить коэффициент k на ${numberText(COEFFICIENT_STEP)}`}
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
            if (DRAFT_PATTERN.test(event.target.value)) setDraft(event.target.value);
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
          disabled={value >= COEFFICIENT_LIMIT}
          aria-label={`Увеличить коэффициент k на ${numberText(COEFFICIENT_STEP)}`}
        >
          +
        </button>
      </div>
      <small id={`${id}-hint`}>
        От −{COEFFICIENT_LIMIT} до {COEFFICIENT_LIMIT}, шаг {numberText(COEFFICIENT_STEP)}; ноль запрещён
      </small>
    </div>
  );
}

interface CurvePlaneProps {
  id: string;
  kind: CurveKind;
  coefficient: number;
  extent: number;
  reveal: boolean;
}

function CurvePlane({ id, kind, coefficient, extent, reveal }: CurvePlaneProps) {
  const centerX = 360;
  const centerY = 278;
  const radius = 236;
  const scale = radius / extent;
  const px = (value: number) => centerX + value * scale;
  const py = (value: number) => centerY - value * scale;
  const gridValues = Array.from({ length: extent * 2 + 1 }, (_, index) => -extent + index);

  const branches = useMemo(
    () => curveBranches(kind, coefficient, extent, SAMPLES),
    [kind, coefficient, extent],
  );
  const facts = curveFacts(kind, coefficient);
  const unitValue = curveValue(kind, coefficient, 1);
  const unitVisible = unitValue !== null && Math.abs(unitValue) <= extent;
  const formula = curveText(kind, coefficient);

  return (
    <svg className="dm-signed-plane" viewBox="0 0 720 570" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>
        {reveal ? `График функции ${formula}` : 'График функции для распознавания'}
      </title>
      <desc id={`${id}-desc`}>
        {branches.length === 0
          ? 'В выбранном окне график не виден: измени коэффициент или увеличь окно.'
          : reveal
            ? `${curveShape(kind)}. Область определения: ${facts.domain}. Область значений: ${facts.range}. ${facts.behaviour}.`
            : `Сетка честная: одна клетка — одна единица по каждой оси. Линий на рисунке ${branches.length}. Определи по рисунку семейство функции и коэффициент k: он равен значению функции при x = 1.`}
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
        {gridValues.map((value) => (
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

      {/* Каждая ветвь — ломаная из коротких отрезков, посчитанных по формуле. */}
      <g className="dm-signed-plane__route-segment" aria-hidden="true">
        {branches.map((branch, branchIndex) => branch.slice(1).map((point, index) => {
          const previous = branch[index]!;
          return (
            <line
              key={`${branchIndex}-${index}`}
              x1={px(previous.x)}
              y1={py(previous.y)}
              x2={px(point.x)}
              y2={py(point.y)}
            />
          );
        }))}
      </g>

      {reveal && unitVisible && (
        <>
          <g className="dm-signed-plane__reflection-guides" aria-hidden="true">
            <line x1={px(1)} y1={centerY} x2={px(1)} y2={py(unitValue!)} />
            <line x1={centerX} y1={py(unitValue!)} x2={px(1)} y2={py(unitValue!)} />
          </g>
          <g
            className="dm-signed-plane__point dm-signed-plane__point--a"
            transform={`translate(${px(1)} ${py(unitValue!)})`}
            aria-hidden="true"
          >
            <circle r="8" />
            <text x={12} y={-11}>(1; {numberText(unitValue!)})</text>
          </g>
        </>
      )}
    </svg>
  );
}

export default function CurveGalleryLab({
  initialKind = 'inverse',
  initialCoefficient,
  extent,
  challenge = false,
}: CurveGalleryLabProps) {
  const reactId = useId();
  const labId = `curve-gallery-${reactId.replace(/:/g, '')}`;
  const safeExtent = useMemo(
    () => clamp(Math.round(extent ?? 6), EXTENT_MIN, EXTENT_MAX),
    [extent],
  );
  const defaultKind: CurveKind = CURVE_KINDS.includes(initialKind) ? initialKind : 'inverse';
  const defaultCoefficient = safeCoefficient(initialCoefficient, 1);

  const puzzles = useMemo<readonly Puzzle[]>(() => {
    const head: Puzzle = { kind: defaultKind, coefficient: defaultCoefficient };
    const rest = PUZZLES.filter((item) => !(item.kind === head.kind && item.coefficient === head.coefficient));
    return [head, ...rest];
  }, [defaultKind, defaultCoefficient]);

  const [kind, setKind] = useState<CurveKind>(defaultKind);
  const [coefficient, setCoefficient] = useState(defaultCoefficient);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [kindAnswer, setKindAnswer] = useState<CurveKind | ''>('');
  const [coefficientAnswer, setCoefficientAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const puzzle = puzzles[puzzleIndex % puzzles.length]!;
  const activeKind = challenge ? puzzle.kind : kind;
  const activeCoefficient = challenge ? puzzle.coefficient : coefficient;
  const reveal = !challenge || checked;

  const facts = curveFacts(activeKind, activeCoefficient);
  const formula = curveText(activeKind, activeCoefficient);
  const tableXs = useMemo(() => {
    if (activeKind === 'sqrt') return [0, 1, 4, 9];
    if (activeKind === 'inverse') return [-4, -2, -1, 1, 2, 4];
    return [-3, -2, -1, 0, 1, 2, 3];
  }, [activeKind]);
  const rows = useMemo(
    () => curveTable(activeKind, activeCoefficient, tableXs),
    [activeKind, activeCoefficient, tableXs],
  );

  const parsedAnswer = parseDraft(coefficientAnswer);
  const answerReady = kindAnswer !== '' && parsedAnswer !== null;
  const kindCorrect = kindAnswer === activeKind;
  const coefficientCorrect = parsedAnswer !== null && Math.abs(parsedAnswer - activeCoefficient) < 1e-9;
  const allCorrect = kindCorrect && coefficientCorrect;

  const result = challenge && !checked
    ? {
      symbol: '?',
      headline: 'Назови семейство функции и коэффициент k.',
      detail: 'Подсказка одна на все четыре формулы: k равен значению функции при x = 1.',
    }
    : challenge
      ? {
        symbol: allCorrect ? '✓' : '×',
        headline: allCorrect ? `Верно: ${formula}.` : `Здесь ${formula}.`,
        detail: allCorrect
          ? `${curveShape(activeKind)}; ${facts.behaviour}.`
          : `${kindCorrect ? 'Семейство определено верно.' : `Это ${curveTitle(activeKind).toLowerCase()}: ${curveShape(activeKind)}.`} ${coefficientCorrect ? 'Коэффициент найден верно.' : 'Найди на графике точку с абсциссой 1: её ордината и есть k.'}`,
      }
      : {
        symbol: 'ƒ',
        headline: `${formula}: ${curveShape(activeKind)}.`,
        detail: `Область определения: ${facts.domain}. Область значений: ${facts.range}. ${facts.behaviour}.`,
      };

  const reset = () => {
    setKind(defaultKind);
    setCoefficient(defaultCoefficient);
    setPuzzleIndex(0);
    setKindAnswer('');
    setCoefficientAnswer('');
    setChecked(false);
  };

  const nextPuzzle = () => {
    setPuzzleIndex((current) => (current + 1) % puzzles.length);
    setKindAnswer('');
    setCoefficientAnswer('');
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Галерея графиков</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {challenge ? 'Узнай функцию по её графику' : 'Четыре формы, которые нужно узнавать сразу'}
          </h3>
          <p>
            {challenge
              ? 'Сетка честная: одна клетка — одна единица по каждой оси. Сначала прочитай ответ по рисунку, потом нажми «Проверить».'
              : 'Переключай семейство и меняй коэффициент k. Следи, что остаётся неизменным: форма, область определения и симметрия.'}
          </p>
        </div>
        <span className="dm-lab__badge">{reveal ? formula : 'y = ?'}</span>
      </header>

      <div className="dm-lab__body">
        {!challenge && (
          <>
            <div className="dm-signed-tabs" role="group" aria-label="Семейство функции">
              {CURVE_KINDS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`dm-signed-tab ${kind === item ? 'dm-signed-tab--active' : ''}`}
                  aria-pressed={kind === item}
                  onClick={() => setKind(item)}
                >
                  {curveTitle(item)}
                </button>
              ))}
            </div>

            <div className="dm-lab__controls dm-signed-controls">
              <CoefficientField id={`${labId}-k`} value={coefficient} onChange={setCoefficient} />
              <p className="dm-nt-note">
                Все четыре формулы записаны с одним и тем же коэффициентом: {curveText(kind, coefficient)}.
                Знак k отражает график, а модуль k растягивает его по вертикали.
              </p>
            </div>
          </>
        )}

        {challenge && (
          <div className="dm-geometry-example-switch">
            <span>График № {puzzleIndex + 1} из {puzzles.length}</span>
            <button className="dm-button dm-button--secondary" type="button" onClick={nextPuzzle}>
              Следующий график
            </button>
          </div>
        )}

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график функции" tabIndex={0}>
          <CurvePlane
            id={`${labId}-plane`}
            kind={activeKind}
            coefficient={activeCoefficient}
            extent={safeExtent}
            reveal={reveal}
          />
        </div>

        {challenge && (
          <>
            <p className="dm-signed-caption">Моё семейство функции</p>
            <div className="dm-geometry-preset-buttons" role="group" aria-label="Семейство функции — твой ответ">
              {CURVE_KINDS.map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={kindAnswer === item}
                  onClick={() => {
                    setKindAnswer(item);
                    setChecked(false);
                  }}
                >
                  {curveTitle(item)}
                </button>
              ))}
            </div>
            <div className="dm-geometry-answer-grid">
              <div className="dm-geometry-answer-field">
                <label htmlFor={`${labId}-k-answer`}>Мой k — значение функции при x = 1</label>
                <input
                  id={`${labId}-k-answer`}
                  type="text"
                  inputMode="decimal"
                  maxLength={MAX_DRAFT_LENGTH}
                  value={coefficientAnswer}
                  onChange={(event) => {
                    if (DRAFT_PATTERN.test(event.target.value)) {
                      setCoefficientAnswer(event.target.value);
                      setChecked(false);
                    }
                  }}
                />
              </div>
              <button className="dm-button" type="button" disabled={!answerReady} onClick={() => setChecked(true)}>
                Проверить
              </button>
            </div>
          </>
        )}

        {reveal && (
          <>
            <div className="dm-algebra-table-wrap">
              <table className="dm-algebra-table">
                <caption>Таблица значений для {formula}</caption>
                <thead>
                  <tr>
                    <th scope="col">x</th>
                    {rows.map((row) => <th scope="col" key={`h-${row.x}`}>{numberText(row.x)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">y</th>
                    {rows.map((row) => (
                      <td key={`v-${row.x}`}>{row.y === null ? '—' : numberText(Math.round(row.y * 1000) / 1000)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="dm-signed-reflection-cards">
              <div>
                <span>Область определения</span>
                <strong>{facts.domain}</strong>
                <small>Какие x вообще можно подставить.</small>
              </div>
              <div>
                <span>Область значений</span>
                <strong>{facts.range}</strong>
                <small>Какие y встречаются на графике.</small>
              </div>
              <div>
                <span>Нули функции</span>
                <strong>{facts.zeros}</strong>
                <small>Где график пересекает ось x.</small>
              </div>
              <div>
                <span>Симметрия</span>
                <strong>{facts.symmetry}</strong>
                <small>Что видно, если сложить рисунок пополам.</small>
              </div>
              <div>
                <span>Возрастание и убывание</span>
                <strong>{facts.behaviour}</strong>
                <small>Куда идёт график слева направо.</small>
              </div>
              <div>
                <span>Форма</span>
                <strong>{curveShape(activeKind)}</strong>
                <small>Как называют эту линию.</small>
              </div>
            </div>
          </>
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
