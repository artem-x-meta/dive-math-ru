import { useId, useMemo, useState } from 'react';
import {
  SYSTEM_PRESETS,
  curveSegments,
  curveShape,
  curveText,
  curveValue,
  describeCurveSystem,
  formatApproximate,
  formatPoint,
  formatPointList,
  formatReducedEquation,
  getSystemPreset,
  isFunctionCurve,
  satisfiesCurve,
  solveCurveSystem,
  type CurveSpec,
  type PlotSegment,
  type SystemPreset,
} from '../lib/systems';
import { formatExactRussian, parseExact } from '../lib/exactRational';

export type SysGraphMode = 'point' | 'system';

export interface SysGraphLabProps {
  /** 'point' — одно уравнение и проверка пары; 'system' — две линии и их общие точки. */
  mode?: SysGraphMode;
  /** Идентификатор примера из SYSTEM_PRESETS (для режима системы). */
  preset?: string;
  /** Идентификатор линии для режима одного уравнения. */
  curve?: string;
  /** Режим задачи: общие точки не подписаны до нажатия «Проверить». */
  challenge?: boolean;
}

interface SingleCurve {
  readonly id: string;
  readonly title: string;
  readonly spec: CurveSpec;
  readonly extent: number;
  readonly note: string;
}

const SINGLE_CURVES: readonly SingleCurve[] = Object.freeze([
  {
    id: 'line',
    title: 'y = x + 2',
    spec: { kind: 'line', k: 1, b: 2 },
    extent: 6,
    note: 'Каждому x отвечает ровно один y, и все решения ложатся на прямую.',
  },
  {
    id: 'parabola',
    title: 'y = x²',
    spec: { kind: 'parabola', a: 1, b: 0, c: 0 },
    extent: 6,
    note: 'Пары (−2; 4) и (2; 4) разные, но обе — решения одного уравнения.',
  },
  {
    id: 'hyperbola',
    title: 'xy = 6',
    spec: { kind: 'hyperbola', k: 6 },
    extent: 8,
    note: 'Значение x = 0 решения не даёт: произведение нулём шесть не сделаешь.',
  },
  {
    id: 'circle',
    title: 'x² + y² = 25',
    spec: { kind: 'circle', r: 5 },
    extent: 7,
    note: 'Одному x здесь отвечают два y, поэтому функцией это уравнение не задаёт.',
  },
]);

const DRAFT_PATTERN = /^[+\-−]?\d*(?:[.,]\d*)?$/;
const MAX_DRAFT_LENGTH = 10;
const TABLE_X = [-3, -2, -1, 0, 1, 2, 3];

function parseDraft(rawValue: string): number | null {
  const normalized = rawValue.trim().replace('−', '-').replace(',', '.');
  if (normalized === '' || normalized === '-' || normalized === '+' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeSystemPreset(id: string | undefined): SystemPreset {
  if (id === undefined) return SYSTEM_PRESETS[0]!;
  try {
    return getSystemPreset(id);
  } catch {
    return SYSTEM_PRESETS[0]!;
  }
}

function safeCurve(id: string | undefined): SingleCurve {
  return SINGLE_CURVES.find((item) => item.id === id) ?? SINGLE_CURVES[0]!;
}

interface PlaneProps {
  id: string;
  extent: number;
  /** Линии рисунка: сплошная — первая, пунктирная — вторая. */
  curves: readonly { spec: CurveSpec; text: string; dashed: boolean }[];
  /** Общие точки системы; показываются только при reveal. */
  solutions: readonly { x: number; y: number; label: string }[];
  /** Точка, которую проверяет ученик. */
  probe: { x: number; y: number; onCurve: boolean } | null;
  reveal: boolean;
  description: string;
}

function Plane({ id, extent, curves, solutions, probe, reveal, description }: PlaneProps) {
  const centerX = 360;
  const centerY = 278;
  const radius = 236;
  const scale = radius / extent;
  const px = (value: number) => centerX + value * scale;
  const py = (value: number) => centerY - value * scale;
  const gridValues = Array.from({ length: extent * 2 + 1 }, (_, index) => -extent + index);
  const labelStep = extent > 8 ? 2 : 1;

  const drawn = curves.map((curve) => ({
    ...curve,
    segments: curveSegments(curve.spec, extent) as readonly PlotSegment[],
  }));

  return (
    <svg className="dm-signed-plane" viewBox="0 0 720 570" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>
        {curves.length > 1 ? 'Графики двух уравнений на одной координатной плоскости' : 'График уравнения с двумя переменными'}
      </title>
      <desc id={`${id}-desc`}>{description}</desc>
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
        {gridValues.filter((value) => value !== 0 && value % labelStep === 0).map((value) => (
          <g key={value}>
            <text x={px(value)} y={centerY + 20}>{value}</text>
            <text x={centerX - 14} y={py(value) + 4}>{value}</text>
          </g>
        ))}
        <text x={centerX + radius - 4} y={centerY - 12}>x</text>
        <text x={centerX + 13} y={centerY - radius + 11}>y</text>
        <text x={centerX - 15} y={centerY + 19}>0</text>
      </g>

      {drawn.map((curve, index) => (
        <g
          key={`${curve.text}-${index}`}
          className={curve.dashed ? 'dm-signed-plane__reflection-guides' : 'dm-signed-plane__route-segment'}
          aria-hidden="true"
        >
          {curve.segments.map((segment, segmentIndex) => (
            <line
              key={segmentIndex}
              x1={px(segment.x1)}
              y1={py(segment.y1)}
              x2={px(segment.x2)}
              y2={py(segment.y2)}
            />
          ))}
        </g>
      ))}

      {reveal && solutions
        .filter((point) => Math.abs(point.x) <= extent && Math.abs(point.y) <= extent)
        .map((point) => (
          <g
            key={point.label}
            className="dm-signed-plane__point dm-signed-plane__point--finish"
            transform={`translate(${px(point.x)} ${py(point.y)})`}
            aria-hidden="true"
          >
            <circle r="8" />
            <text x={12} y={-12}>{point.label}</text>
          </g>
        ))}

      {probe && Math.abs(probe.x) <= extent && Math.abs(probe.y) <= extent && (
        <g
          className="dm-signed-plane__point dm-signed-plane__point--a"
          transform={`translate(${px(probe.x)} ${py(probe.y)})`}
          aria-hidden="true"
        >
          <circle r="7" />
          <text x={12} y={16}>{probe.onCurve ? 'на линии' : 'вне линии'}</text>
        </g>
      )}

      <g className="dm-signed-plane__labels" aria-hidden="true">
        {drawn.map((curve, index) => (
          <text key={`legend-${index}`} x={centerX - radius + 60} y={centerY - radius + 20 + index * 18}>
            {curve.dashed ? 'пунктир' : 'сплошная'} — {curve.text}
          </text>
        ))}
      </g>
    </svg>
  );
}

export default function SysGraphLab({ mode = 'system', preset, curve, challenge = false }: SysGraphLabProps) {
  const reactId = useId();
  const labId = `sys-graph-${reactId.replace(/:/g, '')}`;

  const initialSystem = useMemo(() => safeSystemPreset(preset), [preset]);
  const initialCurve = useMemo(() => safeCurve(curve), [curve]);

  const [systemId, setSystemId] = useState(initialSystem.id);
  const [curveId, setCurveId] = useState(initialCurve.id);
  const [xDraft, setXDraft] = useState('');
  const [yDraft, setYDraft] = useState('');
  const [checked, setChecked] = useState(false);

  const activeSystem = useMemo(() => safeSystemPreset(systemId), [systemId]);
  const activeCurve = useMemo(() => safeCurve(curveId), [curveId]);
  const solution = useMemo(
    () => solveCurveSystem(activeSystem.first, activeSystem.second),
    [activeSystem],
  );

  const reveal = !challenge || checked;
  const parsedX = parseDraft(xDraft);
  const parsedY = parseDraft(yDraft);
  const answerReady = parsedX !== null && parsedY !== null;

  const pointOnCurve = mode === 'point'
    && answerReady
    && satisfiesCurve(activeCurve.spec, parseExact(parsedX), parseExact(parsedY));
  const pointSolvesSystem = mode === 'system'
    && answerReady
    && satisfiesCurve(activeSystem.first, parseExact(parsedX), parseExact(parsedY))
    && satisfiesCurve(activeSystem.second, parseExact(parsedX), parseExact(parsedY));

  const extent = mode === 'point' ? activeCurve.extent : activeSystem.extent;

  const curves = mode === 'point'
    ? [{ spec: activeCurve.spec, text: curveText(activeCurve.spec), dashed: false }]
    : [
      { spec: activeSystem.first, text: curveText(activeSystem.first), dashed: false },
      { spec: activeSystem.second, text: curveText(activeSystem.second), dashed: true },
    ];

  const solutions = mode === 'system'
    ? solution.points.map((point) => ({
      x: point.x.approx,
      y: point.y.approx,
      label: formatPoint(point),
    }))
    : [];

  const probe = answerReady && (mode === 'point' ? checked : reveal && checked)
    ? { x: parsedX, y: parsedY, onCurve: mode === 'point' ? pointOnCurve : pointSolvesSystem }
    : null;

  const solutionTable = useMemo(() => {
    if (mode !== 'point' || !isFunctionCurve(activeCurve.spec)) return [];
    return TABLE_X
      .map((x) => ({ x, y: curveValue(activeCurve.spec, x) }))
      .filter((row): row is { x: number; y: number } => row.y !== null && Math.abs(row.y) <= activeCurve.extent);
  }, [mode, activeCurve]);

  const description = mode === 'point'
    ? `Уравнение ${curveText(activeCurve.spec)}. Его график — ${curveShape(activeCurve.spec)}. Каждая точка линии — решение уравнения, каждое решение — точка линии.`
    : `Первое уравнение: ${curveText(activeSystem.first)}. Второе уравнение: ${curveText(activeSystem.second)}. ${
      reveal ? describeCurveSystem(solution) : 'Найди общие точки по рисунку и проверь их подстановкой.'
    }`;

  const result = mode === 'point'
    ? (!checked
      ? {
        symbol: '?',
        headline: `Проверь любую пару в уравнении ${curveText(activeCurve.spec)}.`,
        detail: 'Подставь свои x и y в уравнение. Если равенство верное, точка обязана оказаться на линии.',
      }
      : {
        symbol: pointOnCurve ? '✓' : '×',
        headline: pointOnCurve
          ? `Пара (${formatApproximate(parsedX ?? 0, 3)}; ${formatApproximate(parsedY ?? 0, 3)}) — решение уравнения.`
          : `Пара (${formatApproximate(parsedX ?? 0, 3)}; ${formatApproximate(parsedY ?? 0, 3)}) решением не является.`,
        detail: pointOnCurve ? activeCurve.note : 'Точка нарисована рядом с линией, но не на ней: равенство не выполнилось.',
      })
    : (!reveal
      ? {
        symbol: '?',
        headline: 'Сколько у этих линий общих точек?',
        detail: 'Оцени ответ по рисунку, затем впиши координаты одной из общих точек и нажми «Проверить».',
      }
      : {
        symbol: solution.kind === 'infinite' ? '∞' : solution.points.length === 0 ? '∅' : String(solution.points.length),
        headline: `${describeCurveSystem(solution)} Решения: ${formatPointList(solution.points)}.`,
        detail: `Подстановка сводит систему к уравнению ${formatReducedEquation(solution.reduced)}${
          solution.discriminant === null ? '' : `, где D = ${formatExactRussian(solution.discriminant)}`
        }. ${activeSystem.note}`,
      });

  const reset = () => {
    setSystemId(initialSystem.id);
    setCurveId(initialCurve.id);
    setXDraft('');
    setYDraft('');
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория графиков и систем</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {mode === 'point' ? 'Одно уравнение — целая линия решений' : 'Решение системы — общая точка двух линий'}
          </h3>
          <p>
            {mode === 'point'
              ? 'Решение уравнения с двумя переменными — пара чисел. Все такие пары вместе и образуют график.'
              : 'Каждое уравнение задаёт свою линию. Пара, подходящая обоим уравнениям, лежит на обеих линиях сразу.'}
          </p>
        </div>
        <span className="dm-lab__badge">{mode === 'point' ? curveText(activeCurve.spec) : curveText(activeSystem.first)}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-preset-buttons" role="group" aria-label={mode === 'point' ? 'Уравнение' : 'Пример системы'}>
          {mode === 'point'
            ? SINGLE_CURVES.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === activeCurve.id ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'}
                aria-pressed={item.id === activeCurve.id}
                onClick={() => { setCurveId(item.id); setChecked(false); }}
              >
                {item.title}
              </button>
            ))
            : SYSTEM_PRESETS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === activeSystem.id ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'}
                aria-pressed={item.id === activeSystem.id}
                onClick={() => { setSystemId(item.id); setXDraft(''); setYDraft(''); setChecked(false); }}
              >
                {item.title}
              </button>
            ))}
        </div>

        <p className="dm-panel-title">
          {mode === 'point'
            ? `${curveText(activeCurve.spec)} — это ${curveShape(activeCurve.spec)}`
            : `Система: ${curveText(activeSystem.first)} и ${curveText(activeSystem.second)}`}
        </p>

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график" tabIndex={0}>
          <Plane
            id={`${labId}-plane`}
            extent={extent}
            curves={curves}
            solutions={solutions}
            probe={probe}
            reveal={reveal}
            description={description}
          />
        </div>

        {mode === 'point' && (
          solutionTable.length > 0
            ? (
              <div className="dm-table-wrap">
                <table className="dm-algebra-table">
                  <caption>Несколько решений уравнения {curveText(activeCurve.spec)}</caption>
                  <thead>
                    <tr>
                      <th scope="col">x</th>
                      {solutionTable.map((row) => <th scope="col" key={row.x}>{formatApproximate(row.x, 2)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">y</th>
                      {solutionTable.map((row) => <td key={row.x}>{formatApproximate(row.y, 2)}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            )
            : (
              <p className="dm-panel-title">
                Таблицы «x → y» здесь не получится: одному значению x отвечают сразу два значения y. Это уравнение задаёт линию, но не функцию.
              </p>
            )
        )}

        <div className="dm-geometry-answer-grid">
          <div className="dm-geometry-answer-field">
            <label htmlFor={`${labId}-x`}>Мой x</label>
            <input
              id={`${labId}-x`}
              type="text"
              inputMode="decimal"
              maxLength={MAX_DRAFT_LENGTH}
              value={xDraft}
              onChange={(event) => {
                if (DRAFT_PATTERN.test(event.target.value)) {
                  setXDraft(event.target.value);
                  setChecked(false);
                }
              }}
            />
          </div>
          <div className="dm-geometry-answer-field">
            <label htmlFor={`${labId}-y`}>Мой y</label>
            <input
              id={`${labId}-y`}
              type="text"
              inputMode="decimal"
              maxLength={MAX_DRAFT_LENGTH}
              value={yDraft}
              onChange={(event) => {
                if (DRAFT_PATTERN.test(event.target.value)) {
                  setYDraft(event.target.value);
                  setChecked(false);
                }
              }}
            />
          </div>
          <button className="dm-button" type="button" disabled={!answerReady} onClick={() => setChecked(true)}>
            Проверить
          </button>
        </div>

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
