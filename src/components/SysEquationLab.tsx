import { useId, useMemo, useState } from 'react';
import {
  EQUATION_PRESETS,
  formatPolynomialEquation,
  formatRootList,
  getEquationPreset,
  matchesRootList,
  solvePolynomialEquation,
  solveRationalEquation,
  type EquationPreset,
  type RealRoot,
} from '../lib/systems';
import { degreeOf, formatPolynomial, parseValueList } from '../lib/algebraicFractions';

export interface SysEquationLabProps {
  /** Идентификатор примера из EQUATION_PRESETS. */
  preset?: string;
  /** Показывать только целые, только дробные или все примеры. */
  filter?: 'all' | 'polynomial' | 'rational';
  /** Режим задачи: ответ и последние шаги скрыты до нажатия «Проверить». */
  challenge?: boolean;
}

interface Step {
  readonly rule: string;
  readonly text: string;
  /** Шаг, который в режиме задачи прячется до проверки. */
  readonly secret?: boolean;
}

const MAX_ANSWER_LENGTH = 60;

function safePreset(id: string | undefined, filter: 'all' | 'polynomial' | 'rational'): EquationPreset {
  const allowed = EQUATION_PRESETS.filter((item) => filter === 'all' || item.kind === filter);
  if (id !== undefined) {
    const found = allowed.find((item) => item.id === id);
    if (found) return found;
    try {
      return getEquationPreset(id);
    } catch {
      // Неизвестный идентификатор — берём первый подходящий пример.
    }
  }
  return allowed[0] ?? EQUATION_PRESETS[0]!;
}

function polynomialSteps(preset: EquationPreset): { steps: Step[]; roots: readonly RealRoot[]; note: string } {
  const polynomial = preset.polynomial ?? [0];
  const solution = solvePolynomialEquation(polynomial);
  const degree = degreeOf(polynomial);

  const steps: Step[] = [
    { rule: 'Переносим всё в левую часть', text: formatPolynomialEquation(polynomial) },
    {
      rule: 'Смотрим на степень',
      text: degree <= 0
        ? 'переменной не осталось — равенство числовое'
        : `степень ${degree}: формулы корней тут нет, работает разложение на множители или замена`,
    },
    {
      rule: 'Разложение или замена даёт корни',
      text: formatRootList(solution.roots),
      secret: true,
    },
  ];

  if (!solution.complete) {
    steps.push({
      rule: 'Осторожно',
      text: 'у этого уравнения есть и другие действительные корни, но рациональной записи у них нет',
      secret: true,
    });
  }

  return {
    steps,
    roots: solution.roots,
    note: solution.identity ? 'Равенство верно при любом x.' : preset.note,
  };
}

function rationalSteps(preset: EquationPreset): { steps: Step[]; roots: readonly RealRoot[]; note: string } {
  const equation = preset.equation ?? { left: [], right: [] };
  const solution = solveRationalEquation(equation);

  const steps: Step[] = [
    {
      rule: 'Выписываем запреты: нули знаменателей',
      text: solution.restrictions.length === 0
        ? 'знаменатели в ноль не обращаются — запретов нет'
        : `x ≠ ${formatRootList(solution.restrictions).split('; ').join(', x ≠ ')}`,
    },
    {
      rule: 'Общий знаменатель обеих частей',
      text: formatPolynomial(solution.commonDenominator),
    },
    {
      rule: 'Умножаем на него и приводим подобные',
      text: formatPolynomialEquation(solution.cleared),
      secret: true,
    },
    {
      rule: 'Корни целого уравнения — это только кандидаты',
      text: solution.identity
        ? 'равенство обратилось в тождество: подходит любое допустимое значение'
        : formatRootList(solution.candidates),
      secret: true,
    },
    {
      rule: 'Сверяем каждого кандидата со списком запретов',
      text: solution.extraneous.length === 0
        ? 'посторонних корней нет'
        : `запрещены: ${formatRootList(solution.extraneous)}`,
      secret: true,
    },
    {
      rule: 'Ответ',
      text: formatRootList(solution.roots),
      secret: true,
    },
  ];

  return { steps, roots: solution.roots, note: preset.note };
}

export default function SysEquationLab({ preset, filter = 'all', challenge = false }: SysEquationLabProps) {
  const reactId = useId();
  const labId = `sys-equation-${reactId.replace(/:/g, '')}`;

  const options = useMemo(
    () => EQUATION_PRESETS.filter((item) => filter === 'all' || item.kind === filter),
    [filter],
  );
  const initial = useMemo(() => safePreset(preset, filter), [preset, filter]);

  const [activeId, setActiveId] = useState(initial.id);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const active = useMemo(() => safePreset(activeId, filter), [activeId, filter]);
  const plan = useMemo(
    () => (active.kind === 'polynomial' ? polynomialSteps(active) : rationalSteps(active)),
    [active],
  );

  const reveal = !challenge || checked;
  const parsedAnswer = parseValueList(answer);
  const answerReady = parsedAnswer !== null;
  const answerCorrect = parsedAnswer !== null && matchesRootList(plan.roots, parsedAnswer);
  const visibleSteps = plan.steps.filter((step) => reveal || !step.secret);

  const chooseExample = (id: string) => {
    setActiveId(id);
    setAnswer('');
    setChecked(false);
  };

  const result = !reveal
    ? {
      symbol: '?',
      headline: 'Реши уравнение сам, а потом сверься с разбором.',
      detail: 'Запиши корни через точку с запятой: «3; −2». Если корней нет, так и напиши: «нет».',
    }
    : {
      symbol: challenge ? (answerCorrect ? '✓' : '×') : '=',
      headline: `Ответ: ${formatRootList(plan.roots)}.`,
      detail: challenge && !answerCorrect
        ? `Твоя запись: ${answer.trim() || '—'}. Сравни её с разбором по шагам выше и найди, где потерялся или прибавился корень.`
        : plan.note,
    };

  const reset = () => {
    setActiveId(initial.id);
    setAnswer('');
    setChecked(false);
  };

  return (
    <section className="dm-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория рациональных уравнений</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>От записи с дробями — к целому уравнению и обратно</h3>
          <p>Умножение на выражение с буквой может добавить корни. Поэтому запреты выписывают до решения, а кандидатов сверяют с ними после.</p>
        </div>
        <span className="dm-lab__badge">{active.label}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-preset-buttons" role="group" aria-label="Пример уравнения">
          {options.map((item) => (
            <button
              type="button"
              key={item.id}
              className={item.id === active.id ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'}
              aria-pressed={item.id === active.id}
              onClick={() => chooseExample(item.id)}
            >
              {item.title}
            </button>
          ))}
        </div>

        <p className="dm-panel-title">
          {active.kind === 'polynomial' ? 'Целое уравнение' : 'Дробно-рациональное уравнение'}: {active.label}
        </p>

        <ol className="dm-algebra-steps">
          {visibleSteps.map((step, index) => (
            <li key={`${active.id}-${step.rule}`}>
              <span>{index + 1}</span>
              <p>
                <small>{step.rule}</small>
                <strong>{step.text}</strong>
              </p>
            </li>
          ))}
        </ol>

        {challenge && (
          <div className="dm-geometry-answer-grid">
            <div className="dm-geometry-answer-field">
              <label htmlFor={`${labId}-answer`}>Мои корни</label>
              <input
                id={`${labId}-answer`}
                type="text"
                inputMode="text"
                maxLength={MAX_ANSWER_LENGTH}
                value={answer}
                aria-describedby={`${labId}-answer-hint`}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  setChecked(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && answerReady) {
                    event.preventDefault();
                    setChecked(true);
                  }
                }}
              />
              <small id={`${labId}-answer-hint`}>Через точку с запятой, например «3; −2»; можно написать «нет»</small>
            </div>
            <button className="dm-button" type="button" disabled={!answerReady} onClick={() => setChecked(true)}>
              Проверить
            </button>
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
