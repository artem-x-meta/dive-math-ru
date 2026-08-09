import { useEffect, useId, useMemo, useState } from 'react';
import { formatExactRussian, parseExact, type ExactRational } from '../lib/exactRational';
import {
  PowerError,
  decimalDivisionSteps,
  decimalExpansion,
  formatDecimalExpansion,
  roundExact,
  roundingError,
  terminatingCheck,
  type DecimalDivision,
} from '../lib/powers';

export type PowerExactMode = 'decimal' | 'rounding';

export interface PowerExactLabProps {
  mode?: PowerExactMode;
  initialNumerator?: number;
  initialDenominator?: number;
  initialDecimals?: number;
  challenge?: boolean;
}

interface ExactState {
  value?: ExactRational;
  division?: DecimalDivision;
  expansionText?: string;
  periodLength?: number;
  factors?: ReturnType<typeof terminatingCheck>;
  error?: string;
}

const MODES: readonly PowerExactMode[] = ['decimal', 'rounding'];
const MODE_LABELS: Readonly<Record<PowerExactMode, string>> = {
  decimal: 'Десятичная запись',
  rounding: 'Точность и округление',
};

const MAX_TERM = 999;
const MAX_DIVISION_CELLS = 10;
const MAX_PERIOD_SHOWN = 18;
const INTEGER_DRAFT = /^\d{0,3}$/;
const ACCUMULATION_STEPS = [1, 10, 100] as const;

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function safeInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  return value === undefined || !Number.isFinite(value) ? fallback : clampInteger(value, minimum, maximum);
}

function describeError(error: unknown): string {
  if (error instanceof PowerError) return error.message;
  return 'Не удалось выполнить точное вычисление для этих чисел.';
}

interface IntegerFieldProps {
  id: string;
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  hint: string;
  onChange: (value: number) => void;
}

function IntegerField({ id, label, value, minimum, maximum, hint, onChange }: IntegerFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    const next = Number.isNaN(parsed) ? value : clampInteger(parsed, minimum, maximum);
    onChange(next);
    setDraft(String(next));
  };

  return (
    <div className="dm-field dm-algebra-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{value}</span>
      </label>
      <div className="dm-algebra-field__control">
        <button
          type="button"
          className="dm-algebra-field__step"
          onClick={() => onChange(clampInteger(value - 1, minimum, maximum))}
          disabled={value <= minimum}
          aria-label={`Уменьшить: ${label.toLowerCase()}`}
        >
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => setEditing(true)}
          onChange={(event) => {
            const raw = event.target.value.trim();
            if (!INTEGER_DRAFT.test(raw)) return;
            setDraft(raw);
            const parsed = Number.parseInt(raw, 10);
            if (!Number.isNaN(parsed) && parsed >= minimum && parsed <= maximum) onChange(parsed);
          }}
          onBlur={() => {
            commit();
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          className="dm-algebra-field__step"
          onClick={() => onChange(clampInteger(value + 1, minimum, maximum))}
          disabled={value >= maximum}
          aria-label={`Увеличить: ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

interface DivisionRibbonProps {
  id: string;
  division: DecimalDivision;
  fractionText: string;
}

function DivisionRibbon({ id, division, fractionText }: DivisionRibbonProps) {
  const cells = division.steps.slice(0, MAX_DIVISION_CELLS);
  const cellWidth = 64;
  const gap = 10;
  const left = 34;
  const width = left * 2 + cells.length * (cellWidth + gap);
  const height = 208;
  const centerOf = (index: number) => left + index * (cellWidth + gap) + cellWidth / 2;
  const cycleStart = division.repeatStart;
  const arcVisible = cycleStart !== null && cells.length > cycleStart;
  const arcFrom = centerOf(cells.length - 1);
  const arcTo = cycleStart === null ? arcFrom : centerOf(cycleStart);

  return (
    <svg
      className="dm-algebra-formula-flow"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>Деление в столбик для дроби {fractionText}</title>
      <desc id={`${id}-desc`}>
        Шагов деления показано: {cells.length}. В верхнем ряду — остаток перед шагом, в нижнем — очередная цифра после запятой.
        {division.terminating
          ? ' Остаток стал равен нулю, поэтому десятичная запись конечна.'
          : arcVisible
            ? ` Остаток ${division.steps[cells.length - 1]?.remainderAfter} уже встречался на шаге ${(cycleStart ?? 0) + 1}, поэтому цифры дальше повторяются.`
            : ' Деление показано не до конца: остаток пока не повторился.'}
      </desc>
      <defs>
        <marker id={`${id}-arrow`} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 Z" fill="var(--dm-violet)" />
        </marker>
      </defs>
      {cells.map((step, index) => {
        const x = centerOf(index);
        const inCycle = cycleStart !== null && index >= cycleStart;
        return (
          <g key={`${step.remainderBefore}-${index}`} aria-hidden="true">
            <circle cx={x} cy="38" r="20" fill="var(--dm-surface)" stroke="var(--dm-line)" strokeWidth="1.5" />
            <text x={x} y="44" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--dm-muted)">
              {step.remainderBefore}
            </text>
            <line x1={x} y1="60" x2={x} y2="80" stroke="var(--dm-line)" strokeWidth="2" />
            <rect
              x={x - cellWidth / 2}
              y="82"
              width={cellWidth}
              height="52"
              rx="10"
              fill={inCycle ? 'var(--dm-violet-soft)' : 'var(--dm-paper)'}
              stroke={inCycle ? 'var(--dm-violet)' : 'var(--dm-line)'}
              strokeWidth="2"
            />
            <text
              x={x}
              y="118"
              textAnchor="middle"
              fontSize="26"
              fontWeight="800"
              fill={inCycle ? 'var(--dm-violet-dark)' : 'var(--dm-ink)'}
            >
              {step.digit}
            </text>
            <text x={x} y="154" textAnchor="middle" fontSize="13" fill="var(--dm-muted)">
              {step.remainderAfter}
            </text>
          </g>
        );
      })}
      {arcVisible && (
        <g aria-hidden="true">
          <path
            d={`M ${arcFrom} 164 C ${arcFrom} 196, ${arcTo} 196, ${arcTo} 170`}
            fill="none"
            stroke="var(--dm-violet)"
            strokeWidth="2.5"
            markerEnd={`url(#${id}-arrow)`}
          />
          <text x={(arcFrom + arcTo) / 2} y="204" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--dm-violet-dark)">
            остаток повторился
          </text>
        </g>
      )}
      {division.terminating && cells.length > 0 && (
        <text x={centerOf(cells.length - 1)} y="186" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--dm-teal)">
          остаток 0 — конец
        </text>
      )}
    </svg>
  );
}

export default function PowerExactLab({
  mode = 'decimal',
  initialNumerator,
  initialDenominator,
  initialDecimals,
  challenge = false,
}: PowerExactLabProps) {
  const reactId = useId();
  const labId = `power-exact-${reactId.replace(/:/g, '')}`;
  const safeMode: PowerExactMode = MODES.includes(mode) ? mode : 'decimal';
  const defaults = useMemo(() => ({
    numerator: safeInteger(initialNumerator, 5, 1, MAX_TERM),
    denominator: safeInteger(initialDenominator, 12, 1, MAX_TERM),
    decimals: safeInteger(initialDecimals, 2, 0, 6),
  }), [initialDecimals, initialDenominator, initialNumerator]);

  const [activeMode, setActiveMode] = useState<PowerExactMode>(safeMode);
  const [numerator, setNumerator] = useState(defaults.numerator);
  const [denominator, setDenominator] = useState(defaults.denominator);
  const [decimals, setDecimals] = useState(defaults.decimals);
  const [guess, setGuess] = useState<'terminating' | 'periodic' | null>(null);
  const [checked, setChecked] = useState(false);

  const state: ExactState = useMemo(() => {
    try {
      const value = parseExact({ numerator: BigInt(numerator), denominator: BigInt(denominator) });
      const expansion = decimalExpansion(value);
      return {
        value,
        division: decimalDivisionSteps(value, MAX_DIVISION_CELLS),
        expansionText: formatDecimalExpansion(expansion),
        periodLength: expansion.repeating.length,
        factors: terminatingCheck(value),
      };
    } catch (error) {
      return { error: describeError(error) };
    }
  }, [denominator, numerator]);

  const fractionText = `${numerator}/${denominator}`;
  const terminating = state.factors?.terminating ?? false;
  const revealed = !challenge || checked || activeMode === 'rounding';
  const guessCorrect = guess === (terminating ? 'terminating' : 'periodic');

  const periodNote = useMemo(() => {
    if (!state.factors) return '';
    const { twos, fives, otherFactor } = state.factors;
    const parts: string[] = [];
    if (twos > 0) parts.push(`2^${twos}`);
    if (fives > 0) parts.push(`5^${fives}`);
    if (otherFactor > 1) parts.push(String(otherFactor));
    const product = parts.length === 0 ? '1' : parts.join(' · ');
    return otherFactor === 1
      ? `Знаменатель несократимой дроби: ${state.factors.denominator} = ${product}. Только двойки и пятёрки — запись конечна.`
      : `Знаменатель несократимой дроби: ${state.factors.denominator} = ${product}. Множитель ${otherFactor} не равен 2 и не равен 5 — появляется период.`;
  }, [state.factors]);

  const shownExpansion = useMemo(() => {
    if (!state.expansionText) return '';
    return state.expansionText.length > MAX_PERIOD_SHOWN + 12
      ? `${state.expansionText.slice(0, MAX_PERIOD_SHOWN + 12)}…`
      : state.expansionText;
  }, [state.expansionText]);

  const rounding = useMemo(() => {
    if (!state.value) return null;
    try {
      const rounded = roundExact(state.value, decimals);
      const error = roundingError(state.value, decimals);
      return {
        rounded: formatExactRussian(rounded),
        errorText: formatExactRussian(error),
        rows: ACCUMULATION_STEPS.map((count) => ({
          count,
          drift: formatExactRussian(parseExact({
            numerator: error.numerator * BigInt(count),
            denominator: error.denominator,
          })),
        })),
        exactZero: error.numerator === 0n,
        message: undefined as string | undefined,
      };
    } catch (caught) {
      return { rounded: '—', errorText: '—', rows: [], exactZero: false, message: describeError(caught) };
    }
  }, [decimals, state.value]);

  const reset = () => {
    setActiveMode(safeMode);
    setNumerator(defaults.numerator);
    setDenominator(defaults.denominator);
    setDecimals(defaults.decimals);
    setGuess(null);
    setChecked(false);
  };

  const changeFraction = (next: () => void) => {
    next();
    setChecked(false);
    setGuess(null);
  };

  return (
    <section className="dm-lab dm-algebra-formula-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория точных вычислений</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Дробь, деление и период</h3>
          <p>Раздели числитель на знаменатель и посмотри, когда деление обрывается, а когда цифры уходят в бесконечный круг.</p>
        </div>
        <span className="dm-lab__badge">m : n</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-algebra-tabs" role="group" aria-label="Режим лаборатории">
          {MODES.map((item) => (
            <button
              type="button"
              key={item}
              className={`dm-algebra-tab ${activeMode === item ? 'dm-algebra-tab--active' : ''}`}
              aria-pressed={activeMode === item}
              onClick={() => setActiveMode(item)}
            >
              {MODE_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-algebra-controls">
          <IntegerField
            id={`${labId}-numerator`}
            label="Числитель m"
            value={numerator}
            minimum={1}
            maximum={MAX_TERM}
            hint={`Целое от 1 до ${MAX_TERM}.`}
            onChange={(next) => changeFraction(() => setNumerator(next))}
          />
          <IntegerField
            id={`${labId}-denominator`}
            label="Знаменатель n"
            value={denominator}
            minimum={1}
            maximum={MAX_TERM}
            hint={`Целое от 1 до ${MAX_TERM}; ноль запрещён.`}
            onChange={(next) => changeFraction(() => setDenominator(next))}
          />
          {activeMode === 'rounding' && (
            <IntegerField
              id={`${labId}-decimals`}
              label="Знаков после запятой"
              value={decimals}
              minimum={0}
              maximum={6}
              hint="От 0 до 6 знаков при округлении."
              onChange={setDecimals}
            />
          )}
        </div>

        <div className="dm-algebra-equation" role="math" aria-label={`Дробь ${numerator} делить на ${denominator}`}>
          <span>{numerator} : {denominator}</span>
          <span aria-hidden="true">=</span>
          <strong>{state.error ? 'не определено' : revealed ? shownExpansion : '?'}</strong>
        </div>

        {activeMode === 'decimal' && (
          <>
            {challenge && (
              <fieldset className="dm-geometry-challenge">
                <legend>Какой будет десятичная запись этой дроби?</legend>
                <label>
                  <input
                    type="radio"
                    name={`${labId}-guess`}
                    checked={guess === 'terminating'}
                    onChange={() => {
                      setGuess('terminating');
                      setChecked(false);
                    }}
                  />
                  Конечной
                </label>
                <label>
                  <input
                    type="radio"
                    name={`${labId}-guess`}
                    checked={guess === 'periodic'}
                    onChange={() => {
                      setGuess('periodic');
                      setChecked(false);
                    }}
                  />
                  Бесконечной периодической
                </label>
                <button className="dm-button" type="button" disabled={guess === null} onClick={() => setChecked(true)}>
                  Проверить
                </button>
              </fieldset>
            )}

            {revealed && state.division ? (
              <div className="dm-algebra-visual-wrap" role="region" aria-label="Прокручиваемая схема деления в столбик" tabIndex={0}>
                <DivisionRibbon id={`${labId}-ribbon`} division={state.division} fractionText={fractionText} />
              </div>
            ) : (
              <p className="dm-nt-note">Сначала сделай прогноз и нажми «Проверить» — схема деления откроется после этого.</p>
            )}

            {revealed && (
              <aside
                className={`dm-algebra-constraints ${terminating ? 'dm-algebra-constraints--valid' : 'dm-algebra-constraints--warning'}`}
                aria-labelledby={`${labId}-verdict`}
              >
                <p className="dm-algebra-constraints__caption">Признак конечной записи</p>
                <h4 id={`${labId}-verdict`}>
                  {state.error
                    ? 'Значение не определено'
                    : terminating
                      ? 'Десятичная запись конечна'
                      : `Десятичная запись бесконечна, длина периода: ${state.periodLength}`}
                </h4>
                <p>{state.error ?? periodNote}</p>
              </aside>
            )}
          </>
        )}

        {activeMode === 'rounding' && rounding && (
          <section className="dm-algebra-table-panel" aria-labelledby={`${labId}-rounding`}>
            <div className="dm-algebra-table-panel__header">
              <div>
                <p className="dm-algebra-table-panel__caption">Что теряется при округлении</p>
                <h4 id={`${labId}-rounding`}>Точное {shownExpansion || '—'} против округлённого {rounding.rounded}</h4>
              </div>
            </div>
            <div className="dm-algebra-table-wrap" role="region" aria-label="Прокручиваемая таблица накопления погрешности" tabIndex={0}>
              <table className="dm-algebra-table">
                <thead>
                  <tr>
                    <th scope="col">Сколько раз сложили</th>
                    <th scope="col">Накопленное расхождение</th>
                  </tr>
                </thead>
                <tbody>
                  {rounding.rows.map((row) => (
                    <tr key={row.count}>
                      <th scope="row">{row.count}</th>
                      <td>{row.drift}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="dm-nt-note">
              {rounding.message
                ?? (rounding.exactZero
                  ? 'Здесь округление ничего не изменило: запись и так укладывается в выбранное число знаков.'
                  : 'Одно округление кажется безобидным, но расхождение растёт вместе с числом действий.')}
            </p>
          </section>
        )}

        <div className={`dm-result ${state.error ? 'dm-algebra-result--warning' : ''}`} aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">
            {state.error ? '!' : challenge && activeMode === 'decimal' && checked ? (guessCorrect ? '✓' : '×') : '='}
          </span>
          <p>
            <strong>
              {state.error
                ? state.error
                : challenge && activeMode === 'decimal' && !checked
                  ? 'Сделай прогноз: запись будет конечной или периодической?'
                  : `${fractionText} = ${shownExpansion}`}
            </strong>
            <small>
              {state.error
                ? 'Измени числитель или знаменатель.'
                : activeMode === 'rounding'
                  ? `Округление до ${decimals} знаков даёт ${rounding?.rounded ?? '—'}; потеря за одно действие равна ${rounding?.errorText ?? '—'}.`
                  : terminating
                    ? 'Деление обрывается: остаток стал нулевым.'
                    : `Остаток повторился, поэтому цифры идут по кругу; длина периода: ${state.periodLength}.`}
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
