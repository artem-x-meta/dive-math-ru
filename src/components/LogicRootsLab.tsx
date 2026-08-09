import { useId, useMemo, useState } from 'react';
import {
  RADICAL_PRESETS,
  domainIntervals,
  formatConsequence,
  formatEquation,
  formatRoot,
  formatRootList,
  formatSquaredEquation,
  polynomialCurve,
  solveEquation,
  squarePolynomial,
  squareRootCurve,
  type EquationSpec,
  type LogicPreset,
} from '../lib/equationLogic';
import { formatApproximate } from '../lib/systems';
import LogicPlane, { type PlaneCurve, type PlanePoint } from './LogicPlane';

export type LogicRootsView = 'original' | 'squared';

export interface LogicRootsLabProps {
  /** Идентификатор примера из RADICAL_PRESETS. */
  preset?: string;
  /** С какой картинки начинать: исходное уравнение или уравнение после возведения в квадрат. */
  view?: LogicRootsView;
  /** Режим задачи: приговоры кандидатам скрыты до нажатия «Проверить». */
  challenge?: boolean;
}

const COUNT_PATTERN = /^\d?$/;

function safePreset(id: string | undefined): LogicPreset {
  return RADICAL_PRESETS.find((item) => item.id === id) ?? RADICAL_PRESETS[0]!;
}

function innerOf(spec: EquationSpec): readonly number[] {
  return spec.kind === 'sqrt-poly' ? spec.radicand : spec.kind === 'sqrt-sqrt' ? spec.left : [0];
}

function buildCurves(spec: EquationSpec, view: LogicRootsView, extent: number): PlaneCurve[] {
  if (spec.kind === 'sqrt-sqrt') {
    return view === 'original'
      ? [
        { segments: squareRootCurve(spec.left, extent), text: 'y = √(левое подкоренное)', dashed: false },
        { segments: squareRootCurve(spec.right, extent), text: 'y = √(правое подкоренное)', dashed: true },
      ]
      : [
        { segments: polynomialCurve(spec.left, extent), text: 'y = левое подкоренное', dashed: false },
        { segments: polynomialCurve(spec.right, extent), text: 'y = правое подкоренное', dashed: true },
      ];
  }

  if (spec.kind !== 'sqrt-poly') return [];

  return view === 'original'
    ? [
      { segments: squareRootCurve(spec.radicand, extent), text: 'y = левая часть (корень)', dashed: false },
      { segments: polynomialCurve(spec.right, extent), text: 'y = правая часть', dashed: true },
    ]
    : [
      { segments: polynomialCurve(spec.radicand, extent), text: 'y = подкоренное выражение', dashed: false },
      { segments: polynomialCurve(squarePolynomial(spec.right), extent), text: 'y = (правая часть)²', dashed: true },
    ];
}

export default function LogicRootsLab({ preset, view = 'original', challenge = false }: LogicRootsLabProps) {
  const reactId = useId();
  const labId = `logic-roots-${reactId.replace(/:/g, '')}`;

  const initial = useMemo(() => safePreset(preset), [preset]);
  const [presetId, setPresetId] = useState(initial.id);
  const [currentView, setCurrentView] = useState<LogicRootsView>(view);
  const [guess, setGuess] = useState('');
  const [checked, setChecked] = useState(false);

  const active = useMemo(() => safePreset(presetId), [presetId]);
  const solution = useMemo(() => solveEquation(active.spec), [active]);
  const curves = useMemo(
    () => buildCurves(active.spec, currentView, active.extent),
    [active, currentView],
  );

  const reveal = !challenge || checked;

  const points: PlanePoint[] = solution.candidates
    .filter((candidate) => currentView === 'squared' || candidate.accepted)
    .map((candidate) => ({
      x: candidate.root.approx,
      y: currentView === 'squared'
        ? candidate.innerValue.approx
        : (candidate.leftValue ?? candidate.rightValue.approx),
      label: `x = ${formatRoot(candidate.root)}`,
      accepted: candidate.accepted,
    }));

  const boundary = useMemo(() => {
    const intervals = domainIntervals(innerOf(active.spec), active.extent);
    const first = intervals[0];
    if (first === undefined) return null;
    return first.from > -active.extent + 1e-6 ? first.from : null;
  }, [active]);

  const extraneousCount = solution.extraneous.length;
  const guessNumber = guess === '' ? null : Number(guess);
  const guessIsRight = guessNumber !== null && guessNumber === solution.roots.length;

  const description = currentView === 'original'
    ? `Исходное уравнение ${formatEquation(active.spec)}. Сплошная линия — левая часть, пунктирная — правая. Общих точек ровно столько, сколько у уравнения корней: ${solution.roots.length}.`
    : `После возведения обеих частей в квадрат получается ${formatSquaredEquation(active.spec)}. У этой пары линий общих точек ${solution.candidates.length}: ${formatRootList(solution.candidates.map((candidate) => candidate.root))}. Лишние появились потому, что квадрат не различает противоположные числа.`;

  const result = !reveal
    ? {
      symbol: '?',
      headline: `Сколько корней у уравнения ${formatEquation(active.spec)}?`,
      detail: 'Сравни две картинки, впиши число корней исходного уравнения и нажми «Проверить».',
    }
    : {
      symbol: extraneousCount === 0 ? '=' : '≠',
      headline: extraneousCount === 0
        ? `Кандидатов ${solution.candidates.length}, корней ${solution.roots.length}: посторонних нет. Ответ: ${formatRootList(solution.roots)}.`
        : `Кандидатов ${solution.candidates.length}, а корней ${solution.roots.length}. Посторонние: ${formatRootList(solution.extraneous)}. Ответ: ${formatRootList(solution.roots)}.`,
      detail: `Уравнение-следствие: ${formatConsequence(active.spec)}. Условие отбора — ${solution.filter}. ${active.note}`,
    };

  const reset = () => {
    setPresetId(initial.id);
    setCurrentView(view);
    setGuess('');
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория равносильности</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Где именно квадрат добавляет лишний корень</h3>
          <p>
            Две картинки описывают два разных уравнения. Обе честные: точки вычислены по формулам.
            Переключай вид и смотри, в какой момент общих точек становится больше.
          </p>
        </div>
        <span className="dm-lab__badge">{active.title}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-preset-buttons" role="group" aria-label="Пример уравнения">
          {RADICAL_PRESETS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={item.id === active.id ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'}
              aria-pressed={item.id === active.id}
              onClick={() => { setPresetId(item.id); setGuess(''); setChecked(false); }}
            >
              {item.title}
            </button>
          ))}
        </div>

        <div className="dm-geometry-tabs" role="group" aria-label="Что нарисовано">
          <button
            type="button"
            className={currentView === 'original' ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
            aria-pressed={currentView === 'original'}
            onClick={() => setCurrentView('original')}
          >
            Исходное уравнение
          </button>
          <button
            type="button"
            className={currentView === 'squared' ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
            aria-pressed={currentView === 'squared'}
            onClick={() => setCurrentView('squared')}
          >
            После возведения в квадрат
          </button>
        </div>

        <p className="dm-panel-title">
          {currentView === 'original' ? formatEquation(active.spec) : formatSquaredEquation(active.spec)}
        </p>

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график" tabIndex={0}>
          <LogicPlane
            id={`${labId}-plane`}
            extent={active.extent}
            curves={curves}
            points={points}
            guideX={currentView === 'original' ? boundary : null}
            guideLabel="вертикаль — граница области определения"
            reveal={reveal}
            title={currentView === 'original'
              ? 'Графики левой и правой частей исходного уравнения'
              : 'Графики частей уравнения-следствия'}
            description={reveal ? description : 'Общие точки пока не подписаны: сначала оцени их число по рисунку.'}
          />
        </div>

        <div className="dm-geometry-answer-grid">
          <div className="dm-geometry-answer-field">
            <label htmlFor={`${labId}-guess`}>Сколько корней у исходного уравнения</label>
            <input
              id={`${labId}-guess`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={guess}
              onChange={(event) => {
                if (COUNT_PATTERN.test(event.target.value)) {
                  setGuess(event.target.value);
                  setChecked(false);
                }
              }}
            />
          </div>
          <button className="dm-button" type="button" disabled={guess === ''} onClick={() => setChecked(true)}>
            Проверить
          </button>
        </div>

        {checked && guessNumber !== null && (
          <p className="dm-panel-title" aria-live="polite">
            {guessIsRight
              ? `Верно: корней ровно ${solution.roots.length}.`
              : `Пока нет: ты назвал ${guessNumber}, а корней ${solution.roots.length}. Кандидатов при этом ${solution.candidates.length}.`}
          </p>
        )}

        {reveal && (
          <div className={extraneousCount === 0 ? 'dm-algebra-constraints dm-algebra-constraints--valid' : 'dm-algebra-constraints dm-algebra-constraints--warning'}>
            <h4>Кандидаты и отбор</h4>
            <div className="dm-table-wrap">
              <table className="dm-algebra-table">
                <caption>Каждый корень уравнения-следствия проверен подстановкой</caption>
                <thead>
                  <tr>
                    <th scope="col">Кандидат x</th>
                    <th scope="col">Левая часть</th>
                    <th scope="col">Правая часть</th>
                    <th scope="col">Приговор</th>
                  </tr>
                </thead>
                <tbody>
                  {solution.candidates.map((candidate) => (
                    <tr
                      key={candidate.root.approx}
                      className={candidate.accepted ? undefined : 'dm-algebra-table__row--undefined'}
                    >
                      <th scope="row">{formatRoot(candidate.root)}</th>
                      <td>{candidate.leftValue === null ? 'не существует' : formatApproximate(candidate.leftValue, 3)}</td>
                      <td>{formatRoot(candidate.rightValue, 3)}</td>
                      <td>{candidate.accepted ? 'корень' : 'посторонний корень'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="dm-algebra-constraints__caption">
              {solution.candidates.length === 0
                ? 'У уравнения-следствия корней нет, значит их нет и у исходного уравнения.'
                : solution.candidates[solution.candidates.length - 1]!.note}
            </p>
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
