import { useId, useMemo, useState } from 'react';
import {
  type DomainPresetId,
  type DomainPreset,
  approachTable,
  evaluateFraction,
  formatPolynomial,
  getDomainPreset,
  parseValueList,
  restrictedValues,
  sameValueSet,
  solveFractionEqualsZero,
} from '../lib/algebraicFractions';
import { compareExact, formatExactRussian, parseExact, type ExactRational } from '../lib/exactRational';

export type DomainLabMode = 'domain' | 'equation';

export interface AlgFracDomainLabProps {
  preset: DomainPresetId;
  mode?: DomainLabMode;
  variable?: string;
  challenge?: boolean;
}

const OFFSETS = ['1', '0,1', '0,01'] as const;
const MAX_ANSWER_LENGTH = 120;
const VALUE_DRAFT = /^[+\-−]?\d*(?:[.,]\d*)?$/;

function safePreset(id: DomainPresetId): DomainPreset {
  try {
    return getDomainPreset(id);
  } catch {
    return getDomainPreset('linear');
  }
}

function show(value: ExactRational): string {
  return formatExactRussian(value);
}

function listValues(values: readonly ExactRational[]): string {
  return values.length === 0 ? 'нет' : values.map(show).join('; ');
}

function parsePoint(draft: string): ExactRational | null {
  const trimmed = draft.trim();
  if (trimmed.length === 0 || trimmed === '+' || trimmed === '-' || trimmed === '−' || trimmed === ',' || trimmed === '.') {
    return null;
  }
  try {
    return parseExact(trimmed);
  } catch {
    return null;
  }
}

interface SolutionState {
  roots: ExactRational[];
  excluded: ExactRational[];
  error?: string;
}

function solveSafely(preset: DomainPreset): SolutionState {
  try {
    const solution = solveFractionEqualsZero(preset.numerator, preset.denominator);
    return { roots: solution.roots, excluded: solution.excluded };
  } catch (error) {
    return { roots: [], excluded: [], error: error instanceof Error ? error.message : 'Уравнение выходит за рамки главы.' };
  }
}

export default function AlgFracDomainLab({
  preset: presetId,
  mode = 'domain',
  variable = 'x',
  challenge = false,
}: AlgFracDomainLabProps) {
  const reactId = useId();
  const labId = `alg-frac-domain-${reactId.replace(/:/g, '')}`;
  const preset = useMemo(() => safePreset(presetId), [presetId]);
  const [activeMode, setActiveMode] = useState<DomainLabMode>(mode);
  const [point, setPoint] = useState('');
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const restricted = useMemo(() => restrictedValues(preset.denominator), [preset]);
  const solution = useMemo(() => solveSafely(preset), [preset]);
  const target = activeMode === 'domain' ? restricted : solution.roots;
  const parsedAnswer = parseValueList(answer);
  const answerCorrect = parsedAnswer !== null && sameValueSet(parsedAnswer, target);
  const revealed = !challenge || checked;

  const rows = useMemo(() => {
    const points = preset.samples
      .map((sample) => parsePoint(sample))
      .filter((value): value is ExactRational => value !== null)
      .map((value) => ({ x: value, own: false }));
    const own = parsePoint(point);
    if (own !== null) points.push({ x: own, own: true });
    return points.map(({ x, own: isOwn }) => ({
      x,
      own: isOwn,
      value: evaluateFraction(preset.numerator, preset.denominator, x),
      denominator: evaluateFraction(preset.denominator, [1], x),
    }));
  }, [point, preset]);

  const approach = useMemo(() => {
    if (restricted.length === 0) return [];
    try {
      return approachTable(preset.numerator, preset.denominator, restricted[0]!, OFFSETS);
    } catch {
      return [];
    }
  }, [preset, restricted]);

  const numeratorText = formatPolynomial(preset.numerator, variable);
  const denominatorText = formatPolynomial(preset.denominator, variable);
  const question = activeMode === 'domain'
    ? `При каких значениях ${variable} эта дробь не имеет смысла?`
    : `Какие корни имеет уравнение «дробь = 0»?`;

  const summary = (() => {
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: question,
        detail: 'Перечисли значения через точку с запятой; если таких значений нет — напиши «нет».',
      };
    }
    if (activeMode === 'domain') {
      return {
        symbol: restricted.length === 0 ? '∞' : '≠',
        headline: restricted.length === 0
          ? `Знаменатель ${denominatorText} не обращается в ноль: подходят любые значения ${variable}.`
          : `Дробь определена при всех ${variable}, кроме ${listValues(restricted)}.`,
        detail: preset.note,
      };
    }
    if (solution.error) return { symbol: '!', headline: solution.error, detail: 'Выбери другой пример.' };
    return {
      symbol: solution.roots.length === 0 ? '∅' : '=',
      headline: solution.roots.length === 0
        ? 'Корней нет: все нули числителя запрещены знаменателем.'
        : `Корни: ${listValues(solution.roots)}.`,
      detail: solution.excluded.length === 0
        ? 'Ни один нуль числителя не попал в запрещённые значения.'
        : `Посторонние значения (нули числителя, запрещённые знаменателем): ${listValues(solution.excluded)}.`,
    };
  })();

  const reset = () => {
    setActiveMode(mode);
    setPoint('');
    setAnswer('');
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-algebra-formula-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория алгебраических дробей</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>{preset.title}</h3>
          <p>Знаменатель — единственный источник запретов. Подставляй значения и смотри, где дробь теряет смысл.</p>
        </div>
        <span className="dm-lab__badge">{preset.label}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-algebra-tabs" role="group" aria-label="Что исследуем">
          <button
            type="button"
            className={`dm-algebra-tab ${activeMode === 'domain' ? 'dm-algebra-tab--active' : ''}`}
            aria-pressed={activeMode === 'domain'}
            onClick={() => { setActiveMode('domain'); setChecked(false); setAnswer(''); }}
          >
            Допустимые значения
          </button>
          <button
            type="button"
            className={`dm-algebra-tab ${activeMode === 'equation' ? 'dm-algebra-tab--active' : ''}`}
            aria-pressed={activeMode === 'equation'}
            onClick={() => { setActiveMode('equation'); setChecked(false); setAnswer(''); }}
          >
            Дробь = 0
          </button>
        </div>

        <div className="dm-algebra-equation" role="math" aria-label={`Дробь ${numeratorText} делить на ${denominatorText}`}>
          <span>{preset.label}</span>
          <span aria-hidden="true">→</span>
          <strong>
            {revealed
              ? activeMode === 'domain'
                ? restricted.length === 0 ? `любое ${variable}` : `${variable} ≠ ${listValues(restricted)}`
                : solution.error ? 'не определено' : solution.roots.length === 0 ? 'корней нет' : `${variable} = ${listValues(solution.roots)}`
              : '?'}
          </strong>
        </div>

        {challenge && (
          <fieldset className="dm-geometry-challenge">
            <legend>{question}</legend>
            <label htmlFor={`${labId}-answer`}>Мой ответ</label>
            <input
              id={`${labId}-answer`}
              type="text"
              value={answer}
              maxLength={MAX_ANSWER_LENGTH}
              aria-describedby={`${labId}-answer-hint`}
              onChange={(event) => { setAnswer(event.target.value.slice(0, MAX_ANSWER_LENGTH)); setChecked(false); }}
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
            <small id={`${labId}-answer-hint`}>Например: 3; −2. Если таких значений нет — напиши «нет».</small>
            <button className="dm-button" type="button" disabled={parsedAnswer === null} onClick={() => setChecked(true)}>
              Проверить
            </button>
          </fieldset>
        )}

        <section className="dm-algebra-table-panel" aria-labelledby={`${labId}-table-heading`}>
          <div className="dm-algebra-table-panel__header">
            <div>
              <p className="dm-algebra-table-panel__caption">Подстановка вместо догадки</p>
              <h4 id={`${labId}-table-heading`}>Значения дроби</h4>
            </div>
            <div className="dm-field dm-algebra-field">
              <label htmlFor={`${labId}-point`}>Своё значение {variable}</label>
              <input
                id={`${labId}-point`}
                type="text"
                inputMode="decimal"
                value={point}
                maxLength={24}
                aria-describedby={`${labId}-point-hint`}
                onChange={(event) => {
                  const raw = event.target.value.slice(0, 24);
                  if (VALUE_DRAFT.test(raw)) setPoint(raw);
                }}
              />
              <small id={`${labId}-point-hint`}>Целое или десятичная дробь, например 2,5.</small>
            </div>
          </div>
          <div className="dm-algebra-table-wrap" role="region" aria-label="Прокручиваемая таблица значений дроби" tabIndex={0}>
            <table className="dm-algebra-table">
              <caption>Дробь {preset.label} при разных {variable}</caption>
              <thead>
                <tr>
                  <th scope="col">{variable}</th>
                  <th scope="col">Знаменатель {denominatorText}</th>
                  <th scope="col">Значение дроби</th>
                  <th scope="col">Вывод</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    className={row.value.defined ? '' : 'dm-algebra-table__row--undefined'}
                    key={`${show(row.x)}-${index}`}
                  >
                    <th scope="row">{show(row.x)}{row.own ? ' (твоё)' : ''}</th>
                    <td>{row.denominator.defined ? show(row.denominator.value!) : '—'}</td>
                    <td>{row.value.defined ? show(row.value.value!) : 'не определено'}</td>
                    <td>{row.value.defined ? 'значение допустимо' : 'знаменатель равен нулю'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {activeMode === 'domain' && approach.length > 0 && (
          <section className="dm-algebra-table-panel" aria-labelledby={`${labId}-approach-heading`}>
            <div className="dm-algebra-table-panel__header">
              <div>
                <p className="dm-algebra-table-panel__caption">Почему запрет именно там</p>
                <h4 id={`${labId}-approach-heading`}>Подходим к {variable} = {show(restricted[0]!)}</h4>
              </div>
            </div>
            <div className="dm-algebra-table-wrap" role="region" aria-label="Прокручиваемая таблица приближения" tabIndex={0}>
              <table className="dm-algebra-table">
                <caption>Чем ближе к запрещённой точке, тем больше модуль дроби</caption>
                <thead>
                  <tr>
                    <th scope="col">Отступ</th>
                    <th scope="col">{variable} слева</th>
                    <th scope="col">Значение</th>
                    <th scope="col">{variable} справа</th>
                    <th scope="col">Значение</th>
                  </tr>
                </thead>
                <tbody>
                  {approach.map((row, index) => (
                    <tr key={OFFSETS[index]}>
                      <th scope="row">{OFFSETS[index]}</th>
                      <td>{show(row.below.x)}</td>
                      <td>{row.below.value.defined ? show(row.below.value.value!) : 'не определено'}</td>
                      <td>{show(row.above.x)}</td>
                      <td>{row.above.value.defined ? show(row.above.value.value!) : 'не определено'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeMode === 'equation' && revealed && !solution.error && (
          <aside
            className={`dm-algebra-constraints ${solution.excluded.length === 0 ? 'dm-algebra-constraints--valid' : 'dm-algebra-constraints--warning'}`}
            aria-labelledby={`${labId}-roots-heading`}
          >
            <p className="dm-algebra-constraints__caption">Дробь равна нулю только вместе с числителем</p>
            <h4 id={`${labId}-roots-heading`}>Разбор кандидатов</h4>
            <ul>
              {[...solution.roots.map((value) => ({ value, allowed: true })), ...solution.excluded.map((value) => ({ value, allowed: false }))]
                .sort((left, right) => compareExact(left.value, right.value))
                .map(({ value, allowed }) => (
                  <li key={show(value)}>
                    {variable} = {show(value)} — числитель равен нулю; {allowed ? 'знаменатель не равен нулю, значит это корень' : 'знаменатель тоже равен нулю, значит значение постороннее'}.
                  </li>
                ))}
              {solution.roots.length === 0 && solution.excluded.length === 0 && (
                <li>Числитель не обращается в ноль ни при одном значении {variable}.</li>
              )}
            </ul>
          </aside>
        )}

        <div
          className={`dm-result ${challenge && checked && !answerCorrect ? 'dm-algebra-result--warning' : ''}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="dm-result__symbol" aria-hidden="true">
            {challenge && checked ? (answerCorrect ? '✓' : '×') : summary.symbol}
          </span>
          <p>
            <strong>
              {challenge && checked && !answerCorrect ? 'Пока нет. ' : ''}
              {summary.headline}
            </strong>
            <small>{challenge && checked && !answerCorrect ? `Твой ответ: ${listValues(parsedAnswer ?? [])}. ${summary.detail}` : summary.detail}</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
