import { useId, useMemo, useState } from 'react';
import {
  MODULUS_PRESETS,
  absoluteBranches,
  absoluteCurve,
  evaluateAt,
  formatConsequence,
  formatEquation,
  formatRoot,
  formatRootList,
  polynomialCurve,
  solveEquation,
  type EquationSpec,
  type LogicPreset,
} from '../lib/equationLogic';
import { degreeOf, formatPolynomial } from '../lib/algebraicFractions';
import { formatApproximate } from '../lib/systems';
import LogicPlane, { type PlaneCurve, type PlanePoint } from './LogicPlane';

export interface LogicModulusLabProps {
  /** Идентификатор примера из MODULUS_PRESETS. */
  preset?: string;
  /** Режим задачи: корни не подписаны до нажатия «Проверить». */
  challenge?: boolean;
}

const COUNT_PATTERN = /^\d?$/;

function safePreset(id: string | undefined): LogicPreset {
  return MODULUS_PRESETS.find((item) => item.id === id) ?? MODULUS_PRESETS[0]!;
}

function innerOf(spec: EquationSpec): readonly number[] {
  return spec.kind === 'abs-poly' ? spec.inner : spec.kind === 'abs-abs' ? spec.left : [0];
}

function rightOf(spec: EquationSpec): readonly number[] {
  return spec.kind === 'abs-poly' || spec.kind === 'abs-abs' ? spec.right : [0];
}

/** Нуль линейного выражения под модулем — точка перелома «галочки». */
function breakpointOf(poly: readonly number[]): number | null {
  return degreeOf(poly) === 1 ? -(poly[0] ?? 0) / (poly[1] ?? 1) : null;
}

function buildCurves(spec: EquationSpec, extent: number): PlaneCurve[] {
  const inner = innerOf(spec);
  const right = rightOf(spec);
  const left: PlaneCurve = {
    segments: absoluteCurve(inner, extent),
    text: `y = |${formatPolynomial(inner)}|`,
    dashed: false,
  };
  return spec.kind === 'abs-abs'
    ? [left, { segments: absoluteCurve(right, extent), text: `y = |${formatPolynomial(right)}|`, dashed: true }]
    : [left, { segments: polynomialCurve(right, extent), text: `y = ${formatPolynomial(right)}`, dashed: true }];
}

export default function LogicModulusLab({ preset, challenge = false }: LogicModulusLabProps) {
  const reactId = useId();
  const labId = `logic-modulus-${reactId.replace(/:/g, '')}`;

  const initial = useMemo(() => safePreset(preset), [preset]);
  const [presetId, setPresetId] = useState(initial.id);
  const [guess, setGuess] = useState('');
  const [checked, setChecked] = useState(false);

  const active = useMemo(() => safePreset(presetId), [presetId]);
  const solution = useMemo(() => solveEquation(active.spec), [active]);
  const curves = useMemo(() => buildCurves(active.spec, active.extent), [active]);
  const branches = useMemo(
    () => (active.spec.kind === 'abs-poly' ? absoluteBranches(active.spec.inner, active.spec.right) : null),
    [active],
  );

  const reveal = !challenge || checked;
  const breakpoint = breakpointOf(innerOf(active.spec));

  const points: PlanePoint[] = solution.roots.map((root) => ({
    x: root.approx,
    y: Math.abs(evaluateAt(innerOf(active.spec), root.approx)),
    label: `x = ${formatRoot(root)}`,
    accepted: true,
  }));

  const guessNumber = guess === '' ? null : Number(guess);
  const guessIsRight = guessNumber !== null && guessNumber === solution.roots.length;
  const extraneousCount = solution.extraneous.length;

  const result = !reveal
    ? {
      symbol: '?',
      headline: `Сколько общих точек у линий уравнения ${formatEquation(active.spec)}?`,
      detail: 'Галочка модуля лежит выше оси всегда. Посмотри, где её пересекает вторая линия, и впиши число корней.',
    }
    : {
      symbol: solution.roots.length === 0 ? '∅' : String(solution.roots.length),
      headline: solution.roots.length === 0
        ? `Общих точек нет: ${formatEquation(active.spec)} корней не имеет.`
        : `Ответ: ${formatRootList(solution.roots)}.`,
      detail: `Возведение обеих частей в квадрат даёт ${formatConsequence(active.spec)}; кандидатов ${solution.candidates.length}${
        extraneousCount === 0 ? ', и все они прошли отбор' : `, из них посторонних ${extraneousCount}`
      }. ${active.note}`,
    };

  const reset = () => {
    setPresetId(initial.id);
    setGuess('');
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория модуля</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Модуль: два случая и одна картинка</h3>
          <p>
            График модуля никогда не опускается ниже оси. Поэтому там, где вторая линия ушла вниз,
            общих точек быть не может — и кандидат оттуда обязательно окажется посторонним.
          </p>
        </div>
        <span className="dm-lab__badge">{active.title}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-preset-buttons" role="group" aria-label="Пример уравнения">
          {MODULUS_PRESETS.map((item) => (
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

        <p className="dm-panel-title">{formatEquation(active.spec)}</p>

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график" tabIndex={0}>
          <LogicPlane
            id={`${labId}-plane`}
            extent={active.extent}
            curves={curves}
            points={points}
            guideX={breakpoint}
            guideLabel="вертикаль — точка перелома модуля"
            reveal={reveal}
            title="Графики левой и правой частей уравнения с модулем"
            description={reveal
              ? `Сплошная линия — ${curves[0]!.text}, пунктирная — ${curves[1]!.text}. Общих точек ${solution.roots.length}: ${formatRootList(solution.roots)}.`
              : 'Общие точки пока не подписаны: сначала оцени их число по рисунку.'}
          />
        </div>

        <div className="dm-geometry-answer-grid">
          <div className="dm-geometry-answer-field">
            <label htmlFor={`${labId}-guess`}>Сколько корней у уравнения</label>
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
              : `Пока нет: ты назвал ${guessNumber}, а корней ${solution.roots.length}.`}
          </p>
        )}

        {reveal && branches !== null && (
          <div className="dm-algebra-constraints">
            <h4>Тот же ответ по определению модуля</h4>
            <ol className="dm-algebra-steps">
              {branches.map((branch, index) => (
                <li key={branch.condition}>
                  <span aria-hidden="true">{index + 1}</span>
                  <p>
                    <strong>{branch.condition}</strong><br />
                    {formatPolynomial(branch.equation)} = 0<br />
                    {branch.roots.length === 0 ? 'подходящих корней нет' : `подходит: ${formatRootList(branch.roots)}`}
                    {branch.rejected.length > 0 && `; не выполняет условие ветви: ${formatRootList(branch.rejected)}`}
                  </p>
                </li>
              ))}
            </ol>
            <p className="dm-algebra-constraints__caption">
              Разбор по случаям и возведение в квадрат обязаны давать один и тот же ответ: {formatRootList(solution.roots)}.
            </p>
          </div>
        )}

        {reveal && (
          <div className={extraneousCount === 0 ? 'dm-algebra-constraints dm-algebra-constraints--valid' : 'dm-algebra-constraints dm-algebra-constraints--warning'}>
            <h4>Кандидаты и отбор</h4>
            <div className="dm-table-wrap">
              <table className="dm-algebra-table">
                <caption>Корни уравнения-следствия и проверка знака правой части</caption>
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
                      <td>{formatApproximate(Math.abs(candidate.innerValue.approx), 3)}</td>
                      <td>{formatRoot(candidate.rightValue, 3)}</td>
                      <td>{candidate.accepted ? 'корень' : 'посторонний корень'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="dm-algebra-constraints__caption">{solution.filter}.</p>
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
