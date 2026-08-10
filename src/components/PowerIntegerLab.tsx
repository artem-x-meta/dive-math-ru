import { useId, useMemo, useState } from 'react';
import { compareExact, formatExactRussian, parseExact, type ExactRational } from '../lib/exactRational';
import {
  PowerError,
  applyIntegerPowerRule,
  checkIntegerPowerRule,
  powerIntegerExact,
  powerLadder,
  type IntegerPowerRow,
  type IntegerPowerRuleCheck,
  type IntegerPowerRuleStep,
  type PowerRuleId,
} from '../lib/powers';

export type PowerIntegerLabMode = 'ladder' | 'rules';

export interface PowerIntegerLabProps {
  mode?: PowerIntegerLabMode;
  initialBase?: number;
  /** Верхняя ступень лестницы показателей. */
  initialTop?: number;
  /** Насколько глубоко лестница уходит ниже нуля. */
  initialDepth?: number;
  initialRule?: PowerRuleId;
  initialLeft?: number;
  initialRight?: number;
  challenge?: boolean;
}

interface LadderState {
  rows?: IntegerPowerRow[];
  error?: string;
}

interface RulesState {
  check?: IntegerPowerRuleCheck;
  step?: IntegerPowerRuleStep;
  error?: string;
}

const MODES: readonly PowerIntegerLabMode[] = ['ladder', 'rules'];
const MODE_LABELS: Readonly<Record<PowerIntegerLabMode, string>> = {
  ladder: 'Лестница показателей',
  rules: 'Свойства для целых показателей',
};

const RULES: readonly PowerRuleId[] = ['product', 'quotient', 'power-of-power'];
const RULE_LABELS: Readonly<Record<PowerRuleId, string>> = {
  product: 'Произведение',
  quotient: 'Частное',
  'power-of-power': 'Степень степени',
};
const RULE_HINTS: Readonly<Record<PowerRuleId, string>> = {
  product: 'Показатели складываются как целые числа: минус в показателе ничего не ломает.',
  quotient: 'Показатели вычитаются; теперь разность может быть и отрицательной, и нулевой.',
  'power-of-power': 'Показатели перемножаются по правилу знаков: минус на минус даёт плюс.',
};

const MIN_BASE = 2;
const MAX_BASE = 10;
const MAX_TOP = 4;
const MAX_DEPTH = 4;
const MAX_RULE_EXPONENT = 6;
const GUESS_DRAFT = /^[+-]?\d{0,6}(?:[.,]\d{0,6})?(?:\/\d{0,6})?$/;

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function safeInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  return value === undefined || !Number.isFinite(value) ? fallback : clampInteger(value, minimum, maximum);
}

function describeError(error: unknown): string {
  if (error instanceof PowerError) return error.message;
  return 'Не удалось вычислить это точно: проверь введённые числа.';
}

/** Дробная запись: для степеней с отрицательным показателем она нагляднее десятичной. */
function fractionText(value: ExactRational): string {
  if (value.denominator === 1n) return formatExactRussian(value);
  const negative = value.numerator < 0n;
  const numerator = negative ? -value.numerator : value.numerator;
  return `${negative ? '−' : ''}${numerator}/${value.denominator}`;
}

function parseGuess(rawValue: string): ExactRational | null {
  const normalized = rawValue.trim();
  if (normalized === '' || normalized === '+' || normalized === '-') return null;
  try {
    return parseExact(normalized);
  } catch {
    return null;
  }
}

function exponentLabel(exponent: number): string {
  return exponent < 0 ? `−${Math.abs(exponent)}` : String(exponent);
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
  return (
    <div className="dm-field dm-algebra-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{exponentLabel(value)}</span>
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
          type="range"
          min={minimum}
          max={maximum}
          step={1}
          value={value}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onChange(clampInteger(Number(event.target.value), minimum, maximum))}
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

function PowerText({ base, exponent }: { base: string; exponent: number | string }) {
  return (
    <span>
      {base}
      <sup>{typeof exponent === 'number' ? exponentLabel(exponent) : exponent}</sup>
    </span>
  );
}

interface LadderChartProps {
  id: string;
  baseLabel: string;
  rows: IntegerPowerRow[];
  hideNonPositive: boolean;
}

function LadderChart({ id, baseLabel, rows, hideNonPositive }: LadderChartProps) {
  const rowHeight = 54;
  const boxHeight = 40;
  const top = 42;
  const width = 560;
  const height = top + rows.length * rowHeight + 18;
  const yOf = (index: number) => top + index * rowHeight;
  const visible = (row: IntegerPowerRow) => !(hideNonPositive && row.exponent <= 0);

  return (
    <svg
      className="dm-algebra-formula-flow"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>Лестница степеней числа {baseLabel}</title>
      <desc id={`${id}-desc`}>
        Ступени идут сверху вниз от показателя {exponentLabel(rows[0]?.exponent ?? 0)} до показателя{' '}
        {exponentLabel(rows[rows.length - 1]?.exponent ?? 0)}. При переходе на ступень ниже показатель уменьшается на
        единицу, а значение делится на {baseLabel}.
        {hideNonPositive
          ? ' Значения при показателях 0 и меньше пока скрыты: сначала прогноз, потом проверка.'
          : ` Ступени: ${rows.map((row) => `${baseLabel} в степени ${exponentLabel(row.exponent)} равно ${fractionText(row.value)}`).join('; ')}.`}
      </desc>
      <text x="24" y="24" fontSize="13" fontWeight="700" fill="var(--dm-muted)" aria-hidden="true">
        показатель
      </text>
      <text x="238" y="24" fontSize="13" fontWeight="700" fill="var(--dm-muted)" aria-hidden="true">
        значение
      </text>
      {rows.map((row, index) => {
        const y = yOf(index);
        const accent = row.exponent < 0 ? 'var(--dm-coral)' : row.exponent === 0 ? 'var(--dm-gold)' : 'var(--dm-violet)';
        const fill = row.exponent < 0
          ? 'var(--dm-coral-soft)'
          : row.exponent === 0
            ? 'var(--dm-gold-soft)'
            : 'var(--dm-violet-soft)';
        return (
          <g key={row.exponent} aria-hidden="true">
            <rect x="24" y={y} width="180" height={boxHeight} rx="9" fill={fill} stroke={accent} strokeWidth="2" />
            <text x="114" y={y + 26} textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--dm-ink)">
              {baseLabel}
              <tspan dy="-7" fontSize="13">{exponentLabel(row.exponent)}</tspan>
            </text>
            <text x="216" y={y + 26} fontSize="17" fontWeight="700" fill="var(--dm-muted)">=</text>
            <rect x="238" y={y} width="196" height={boxHeight} rx="9" fill="var(--dm-paper)" stroke="var(--dm-line)" strokeWidth="2" />
            <text x="336" y={y + 26} textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--dm-ink)">
              {visible(row) ? fractionText(row.value) : '?'}
            </text>
            {index < rows.length - 1 && (
              <>
                <line
                  x1="474"
                  y1={y + boxHeight - 2}
                  x2="474"
                  y2={yOf(index + 1) + 2}
                  stroke="var(--dm-teal)"
                  strokeWidth="2.5"
                />
                <polygon
                  points={`474,${yOf(index + 1) + 8} 470,${yOf(index + 1) - 2} 478,${yOf(index + 1) - 2}`}
                  fill="var(--dm-teal)"
                />
                <text x="486" y={y + boxHeight + 8} fontSize="13" fontWeight="700" fill="var(--dm-teal)">
                  : {baseLabel}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function PowerIntegerLab({
  mode = 'ladder',
  initialBase,
  initialTop,
  initialDepth,
  initialRule,
  initialLeft,
  initialRight,
  challenge = false,
}: PowerIntegerLabProps) {
  const reactId = useId();
  const labId = `power-integer-${reactId.replace(/:/g, '')}`;
  const safeMode: PowerIntegerLabMode = MODES.includes(mode) ? mode : 'ladder';
  const defaults = useMemo(() => ({
    base: safeInteger(initialBase, 2, MIN_BASE, MAX_BASE),
    top: safeInteger(initialTop, 3, 1, MAX_TOP),
    depth: safeInteger(initialDepth, 3, 1, MAX_DEPTH),
    rule: initialRule && RULES.includes(initialRule) ? initialRule : ('product' as PowerRuleId),
    left: safeInteger(initialLeft, 5, -MAX_RULE_EXPONENT, MAX_RULE_EXPONENT),
    right: safeInteger(initialRight, -3, -MAX_RULE_EXPONENT, MAX_RULE_EXPONENT),
  }), [initialBase, initialDepth, initialLeft, initialRight, initialRule, initialTop]);

  const [activeMode, setActiveMode] = useState<PowerIntegerLabMode>(safeMode);
  const [base, setBase] = useState(defaults.base);
  const [top, setTop] = useState(defaults.top);
  const [depth, setDepth] = useState(defaults.depth);
  const [rule, setRule] = useState<PowerRuleId>(defaults.rule);
  const [left, setLeft] = useState(defaults.left);
  const [right, setRight] = useState(defaults.right);
  const [zeroGuess, setZeroGuess] = useState('');
  const [negativeGuess, setNegativeGuess] = useState('');
  const [checked, setChecked] = useState(false);

  const ladder = useMemo<LadderState>(() => {
    try {
      return { rows: powerLadder(base, top, -depth) };
    } catch (error) {
      return { error: describeError(error) };
    }
  }, [base, depth, top]);

  const rules = useMemo<RulesState>(() => {
    try {
      const check = checkIntegerPowerRule(rule, base, left, right, String(base));
      return { check, step: check.step };
    } catch (error) {
      try {
        return { step: applyIntegerPowerRule(rule, left, right, String(base)), error: describeError(error) };
      } catch (inner) {
        return { error: describeError(inner) };
      }
    }
  }, [base, left, right, rule]);

  const expectations = useMemo(() => {
    try {
      return {
        zero: powerIntegerExact(base, 0),
        negative: powerIntegerExact(base, -1),
      };
    } catch {
      return null;
    }
  }, [base]);

  const guessCorrect = useMemo(() => {
    if (!expectations) return false;
    const zero = parseGuess(zeroGuess);
    const negative = parseGuess(negativeGuess);
    if (zero === null || negative === null) return false;
    return compareExact(zero, expectations.zero) === 0 && compareExact(negative, expectations.negative) === 0;
  }, [expectations, negativeGuess, zeroGuess]);

  const hidden = challenge && activeMode === 'ladder' && !checked;

  const reset = () => {
    setActiveMode(safeMode);
    setBase(defaults.base);
    setTop(defaults.top);
    setDepth(defaults.depth);
    setRule(defaults.rule);
    setLeft(defaults.left);
    setRight(defaults.right);
    setZeroGuess('');
    setNegativeGuess('');
    setChecked(false);
  };

  const changeLadder = (apply: () => void) => {
    apply();
    setChecked(false);
  };

  const negativeRow = ladder.rows?.find((row) => row.exponent === -1);

  const headline = (() => {
    if (activeMode === 'ladder') {
      if (ladder.error) return ladder.error;
      if (hidden) return `Назови ${base} в нулевой и в минус первой степени, потом нажми «Проверить».`;
      return `${base}⁰ = 1, а ${base}⁻¹ = ${negativeRow ? fractionText(negativeRow.value) : '—'}`;
    }
    if (rules.error) return rules.error;
    return `Показатель результата равен ${exponentLabel(rules.step?.resultExponent ?? 0)}.`;
  })();

  return (
    <section className="dm-lab dm-algebra-formula-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория целых показателей</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Ниже нуля: a⁰ и a⁻ⁿ</h3>
          <p>
            Спустись по лестнице показателей на ступень ниже нуля и проверь, что свойства степеней при этом остаются
            в силе.
          </p>
        </div>
        <span className="dm-lab__badge">a⁻ⁿ</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-algebra-tabs" role="group" aria-label="Режим лаборатории целых показателей">
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

        {activeMode === 'ladder' && (
          <>
            <div className="dm-lab__controls dm-algebra-controls">
              <IntegerField
                id={`${labId}-base`}
                label="Основание a"
                value={base}
                minimum={MIN_BASE}
                maximum={MAX_BASE}
                hint={`Целое от ${MIN_BASE} до ${MAX_BASE}; ноль в отрицательной степени не определён.`}
                onChange={(next) => changeLadder(() => setBase(next))}
              />
              <IntegerField
                id={`${labId}-top`}
                label="Верхняя ступень"
                value={top}
                minimum={1}
                maximum={MAX_TOP}
                hint="С какого натурального показателя начинаем спуск."
                onChange={(next) => changeLadder(() => setTop(next))}
              />
              <IntegerField
                id={`${labId}-depth`}
                label="Глубина ниже нуля"
                value={depth}
                minimum={1}
                maximum={MAX_DEPTH}
                hint="Сколько ступеней проходим после нулевого показателя."
                onChange={(next) => changeLadder(() => setDepth(next))}
              />
            </div>

            {challenge && (
              <div className="dm-geometry-answer-grid">
                <div className="dm-geometry-answer-field">
                  <label htmlFor={`${labId}-zero-guess`}>Моё значение a⁰</label>
                  <input
                    id={`${labId}-zero-guess`}
                    type="text"
                    inputMode="text"
                    value={zeroGuess}
                    onChange={(event) => {
                      const raw = event.target.value.trim();
                      if (!GUESS_DRAFT.test(raw)) return;
                      setZeroGuess(raw);
                      setChecked(false);
                    }}
                  />
                </div>
                <div className="dm-geometry-answer-field">
                  <label htmlFor={`${labId}-negative-guess`}>Моё значение a⁻¹ (можно дробью 1/2)</label>
                  <input
                    id={`${labId}-negative-guess`}
                    type="text"
                    inputMode="text"
                    value={negativeGuess}
                    onChange={(event) => {
                      const raw = event.target.value.trim();
                      if (!GUESS_DRAFT.test(raw)) return;
                      setNegativeGuess(raw);
                      setChecked(false);
                    }}
                  />
                </div>
                <button className="dm-button" type="button" onClick={() => setChecked(true)}>
                  Проверить
                </button>
              </div>
            )}

            {ladder.rows ? (
              <div className="dm-algebra-visual-wrap" role="region" aria-label="Прокручиваемая лестница показателей" tabIndex={0}>
                <LadderChart
                  id={`${labId}-ladder`}
                  baseLabel={String(base)}
                  rows={ladder.rows}
                  hideNonPositive={hidden}
                />
              </div>
            ) : (
              <p className="dm-nt-note">{ladder.error}</p>
            )}

            <aside className="dm-algebra-constraints dm-algebra-constraints--valid" aria-labelledby={`${labId}-ladder-note`}>
              <p className="dm-algebra-constraints__caption">Что держит лестницу</p>
              <h4 id={`${labId}-ladder-note`}>Каждая ступень вниз — деление на основание</h4>
              <p>
                Показатель уменьшился на единицу — значит из произведения ушёл один множитель, то есть значение
                разделили на {base}.{' '}
                {hidden
                  ? 'Ниже единицы это правило не отменяется — продолжи деление сам и проверь прогноз.'
                  : `Ниже единицы это правило не отменяется: ${base}⁰ = 1, а ${base}⁻¹ = ${negativeRow ? fractionText(negativeRow.value) : '—'}.`}{' '}
                Основание обязано быть отличным от нуля: делить на ноль нельзя.
              </p>
            </aside>
          </>
        )}

        {activeMode === 'rules' && (
          <>
            <div className="dm-geometry-preset-buttons" role="group" aria-label="Свойство степеней">
              {RULES.map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={rule === item}
                  className={`dm-geometry-preset-button ${rule === item ? 'dm-geometry-preset-button--active' : ''}`}
                  onClick={() => setRule(item)}
                >
                  {RULE_LABELS[item]}
                </button>
              ))}
            </div>

            <div className="dm-lab__controls dm-algebra-controls">
              <IntegerField
                id={`${labId}-rule-base`}
                label="Основание a"
                value={base}
                minimum={MIN_BASE}
                maximum={MAX_BASE}
                hint="На этом числе свойство проверяется точным вычислением."
                onChange={setBase}
              />
              <IntegerField
                id={`${labId}-left`}
                label={rule === 'power-of-power' ? 'Внутренний показатель m' : 'Первый показатель m'}
                value={left}
                minimum={-MAX_RULE_EXPONENT}
                maximum={MAX_RULE_EXPONENT}
                hint={`Целое от −${MAX_RULE_EXPONENT} до ${MAX_RULE_EXPONENT}.`}
                onChange={setLeft}
              />
              <IntegerField
                id={`${labId}-right`}
                label={rule === 'power-of-power' ? 'Внешний показатель n' : 'Второй показатель n'}
                value={right}
                minimum={-MAX_RULE_EXPONENT}
                maximum={MAX_RULE_EXPONENT}
                hint={`Целое от −${MAX_RULE_EXPONENT} до ${MAX_RULE_EXPONENT}; теперь минус разрешён.`}
                onChange={setRight}
              />
            </div>

            <div className="dm-algebra-equation" role="math" aria-label="Равенство свойства степеней с целыми показателями">
              {rule === 'power-of-power' ? (
                <span>
                  (<PowerText base={String(base)} exponent={left} />)<sup>{exponentLabel(right)}</sup>
                </span>
              ) : (
                <>
                  <span><PowerText base={String(base)} exponent={left} /></span>
                  <span aria-hidden="true">{rule === 'product' ? '·' : ':'}</span>
                  <span><PowerText base={String(base)} exponent={right} /></span>
                </>
              )}
              <span aria-hidden="true">=</span>
              <strong>
                {rules.step
                  ? <PowerText base={String(base)} exponent={rules.step.resultExponent} />
                  : 'не определено'}
              </strong>
            </div>

            {rules.check && (
              <section className="dm-algebra-table-panel" aria-labelledby={`${labId}-table`}>
                <div className="dm-algebra-table-panel__header">
                  <div>
                    <p className="dm-algebra-table-panel__caption">Два пути к одному числу</p>
                    <h4 id={`${labId}-table`}>Свойство против прямого вычисления</h4>
                  </div>
                </div>
                <div className="dm-algebra-table-wrap" role="region" aria-label="Прокручиваемая таблица проверки свойства" tabIndex={0}>
                  <table className="dm-algebra-table">
                    <thead>
                      <tr>
                        <th scope="col">Что считаем</th>
                        <th scope="col">Точное значение</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">{base}<sup>{exponentLabel(left)}</sup></th>
                        <td>{fractionText(rules.check.leftValue)}</td>
                      </tr>
                      {rules.check.rightValue && (
                        <tr>
                          <th scope="row">{base}<sup>{exponentLabel(right)}</sup></th>
                          <td>{fractionText(rules.check.rightValue)}</td>
                        </tr>
                      )}
                      <tr>
                        <th scope="row">по свойству: {base}<sup>{exponentLabel(rules.check.step.resultExponent)}</sup></th>
                        <td>{fractionText(rules.check.ruleValue)}</td>
                      </tr>
                      <tr>
                        <th scope="row">прямым действием</th>
                        <td>{fractionText(rules.check.directValue)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="dm-nt-note">{RULE_HINTS[rule]}</p>
              </section>
            )}

            <aside
              className={`dm-algebra-constraints ${rules.check?.matches ? 'dm-algebra-constraints--valid' : 'dm-algebra-constraints--warning'}`}
              aria-labelledby={`${labId}-verdict`}
            >
              <p className="dm-algebra-constraints__caption">Проверка на числе</p>
              <h4 id={`${labId}-verdict`}>
                {rules.check
                  ? `Оба пути дают ${fractionText(rules.check.ruleValue)}`
                  : 'Свойство здесь не применяется'}
              </h4>
              <p>
                {rules.check
                  ? 'Правило не пришлось менять: оно работает для любых целых показателей, потому что определения a⁰ и a⁻ⁿ выбраны именно так, чтобы его сохранить.'
                  : rules.error}
              </p>
            </aside>
          </>
        )}

        <div
          className={`dm-result ${ladder.error || rules.error ? 'dm-algebra-result--warning' : ''}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="dm-result__symbol" aria-hidden="true">
            {activeMode === 'ladder' && challenge && checked ? (guessCorrect ? '✓' : '×') : '='}
          </span>
          <p>
            <strong>{headline}</strong>
            <small>
              {activeMode === 'ladder'
                ? challenge && checked
                  ? guessCorrect
                    ? 'Верно: нулевая степень равна единице, а минус первая — числу, обратному основанию.'
                    : 'Спускайся по лестнице делением: после a¹ идёт a⁰ = 1, а следующая ступень — единица, делённая на основание.'
                  : 'Отрицательный показатель не делает число отрицательным: он переворачивает дробь.'
                : RULE_HINTS[rule]}
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
