import { useEffect, useId, useMemo, useState } from 'react';
import {
  formatExactRussian,
  parseExact,
  toExactNumber,
  type ExactRational,
} from '../lib/exactRational';
import {
  PowerError,
  applyPowerRule,
  checkPowerRule,
  expandPower,
  isStandardMantissa,
  powerExact,
  powerSign,
  powerTable,
  toStandardForm,
  type PowerRuleCheck,
  type PowerRuleId,
  type PowerRuleStep,
  type PowerSignInfo,
  type StandardForm,
} from '../lib/powers';

interface DefinitionState {
  label?: string;
  expanded?: string;
  value?: ExactRational;
  valueText?: string;
  sign?: PowerSignInfo;
  values?: number[];
  linear?: number[];
  error?: string;
}

interface PropertiesState {
  check?: PowerRuleCheck;
  step?: PowerRuleStep;
  error?: string;
}

interface StandardState {
  form?: StandardForm;
  mantissaText?: string;
  valueText?: string;
  fraction?: number;
  natural?: boolean;
  error?: string;
}

export type PowerLabMode = 'definition' | 'properties' | 'standard';

export interface PowerLabProps {
  mode?: PowerLabMode;
  initialBase?: string;
  initialExponent?: number;
  initialRule?: PowerRuleId;
  initialLeft?: number;
  initialRight?: number;
  initialCheckBase?: number;
  initialNumber?: string;
  challenge?: boolean;
}

const MODES: readonly PowerLabMode[] = ['definition', 'properties', 'standard'];
const MODE_LABELS: Readonly<Record<PowerLabMode, string>> = {
  definition: 'Что такое степень',
  properties: 'Свойства степеней',
  standard: 'Стандартный вид',
};

const RULES: readonly PowerRuleId[] = ['product', 'quotient', 'power-of-power'];
const RULE_LABELS: Readonly<Record<PowerRuleId, string>> = {
  product: 'Произведение',
  quotient: 'Частное',
  'power-of-power': 'Степень степени',
};
const RULE_HINTS: Readonly<Record<PowerRuleId, string>> = {
  product: 'Множители обеих степеней просто встают в один ряд, поэтому показатели складываются.',
  quotient: 'Одинаковые множители сокращаются парами, поэтому показатели вычитаются.',
  'power-of-power': 'Каждая из n скобок содержит m множителей, поэтому показатели перемножаются.',
};

const MAX_EXPONENT = 10;
const MAX_RULE_EXPONENT = 8;
const EXACT_DRAFT = /^[+-]?\d{0,4}(?:[.,]\d{0,4})?(?:\/\d{0,4})?$/;
const NUMBER_DRAFT = /^[+-]?\d{0,15}(?:[.,]\d{0,10})?$/;
const RULER_MIN = 0;
const RULER_MAX = 12;

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

function parseDraft(rawValue: string): ExactRational | null {
  const normalized = rawValue.trim();
  if (normalized === '' || normalized === '+' || normalized === '-') return null;
  try {
    return parseExact(normalized);
  } catch {
    return null;
  }
}

function shorten(text: string, limit = 14): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function signWord(info: PowerSignInfo): string {
  if (info.sign === 0) return 'равна нулю';
  return info.sign > 0 ? 'положительна' : 'отрицательна';
}

function signReasonText(info: PowerSignInfo): string {
  switch (info.reason) {
    case 'positive-base':
      return 'основание положительно, поэтому знак не меняется ни при каком показателе';
    case 'even-exponent':
      return 'минусы разбиваются на пары, и каждая пара даёт плюс';
    case 'odd-exponent':
      return 'после разбиения на пары остаётся один лишний минус';
    case 'zero-base':
      return 'ноль в любой натуральной степени равен нулю';
    default:
      return 'по соглашению нулевая степень ненулевого числа равна единице';
  }
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

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  hint: string;
  pattern: RegExp;
  onChange: (value: string) => void;
}

function TextField({ id, label, value, hint, pattern, onChange }: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  return (
    <div className="dm-field dm-algebra-field">
      <label htmlFor={id}>{label}</label>
      <div className="dm-algebra-field__control">
        <input
          id={id}
          type="text"
          inputMode="text"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => setEditing(true)}
          onChange={(event) => {
            const raw = event.target.value.trim();
            if (!pattern.test(raw)) return;
            setDraft(raw);
            onChange(raw);
          }}
          onBlur={() => {
            setEditing(false);
            onChange(draft.trim());
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      </div>
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

function PowerText({ base, exponent }: { base: string; exponent: number | string }) {
  return (
    <span>
      {base}
      <sup>{exponent}</sup>
    </span>
  );
}

interface GrowthChartProps {
  id: string;
  baseLabel: string;
  values: number[];
  linear: number[];
}

function GrowthChart({ id, baseLabel, values, linear }: GrowthChartProps) {
  const columnWidth = 66;
  const left = 54;
  const bottom = 214;
  const plotHeight = 172;
  const width = left + values.length * columnWidth + 26;
  const maximum = Math.max(...values, ...linear, 1);
  const heightOf = (value: number) => Math.max(2, (value / maximum) * plotHeight);
  const centerOf = (index: number) => left + index * columnWidth + columnWidth / 2;
  const linePoints = linear
    .map((value, index) => `${centerOf(index)},${bottom - heightOf(value)}`)
    .join(' ');

  return (
    <svg
      className="dm-algebra-formula-flow"
      viewBox={`0 0 ${width} 258`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>Рост степени по сравнению с равномерным ростом</title>
      <desc id={`${id}-desc`}>
        Столбики показывают модуль значений {baseLabel} в степенях от 1 до {values.length}, ломаная — равномерный рост,
        при котором к результату каждый раз прибавляют одно и то же число. Высоты столбиков пропорциональны значениям,
        наибольшее значение равно {maximum}.
      </desc>
      <line x1={left - 12} y1={bottom} x2={width - 12} y2={bottom} stroke="var(--dm-line)" strokeWidth="2" aria-hidden="true" />
      {values.map((value, index) => {
        const barHeight = heightOf(value);
        const x = centerOf(index);
        return (
          <g key={index} aria-hidden="true">
            <rect
              x={x - 20}
              y={bottom - barHeight}
              width="40"
              height={barHeight}
              rx="6"
              fill="var(--dm-violet-soft)"
              stroke="var(--dm-violet)"
              strokeWidth="2"
            />
            <text x={x} y={bottom + 20} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--dm-muted)">
              {index + 1}
            </text>
            <text x={x} y={bottom - barHeight - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--dm-violet-dark)">
              {shorten(String(value), 9)}
            </text>
          </g>
        );
      })}
      <polyline points={linePoints} fill="none" stroke="var(--dm-teal)" strokeWidth="2.5" strokeDasharray="7 5" aria-hidden="true" />
      <text x={left - 12} y={bottom + 40} fontSize="13" fill="var(--dm-muted)" aria-hidden="true">показатель</text>
      <text x={left - 12} y="20" fontSize="13" fontWeight="700" fill="var(--dm-violet-dark)" aria-hidden="true">столбики: степень</text>
      <text x={left - 12} y="38" fontSize="13" fontWeight="700" fill="var(--dm-teal)" aria-hidden="true">пунктир: равномерный рост</text>
    </svg>
  );
}

interface FactorStripProps {
  id: string;
  rule: PowerRuleId;
  left: number;
  right: number;
  baseLabel: string;
}

function FactorStrip({ id, rule, left, right, baseLabel }: FactorStripProps) {
  const cell = 34;
  const gap = 6;
  const originX = 24;
  const originY = 54;
  const columns = rule === 'power-of-power' ? left : left + right;
  const rows = rule === 'power-of-power' ? right : 1;
  const width = originX * 2 + columns * (cell + gap);
  const height = originY + rows * (cell + gap) + 46;

  return (
    <svg
      className="dm-algebra-formula-flow"
      viewBox={`0 0 ${Math.max(width, 420)} ${height}`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>Множители в развёрнутой записи</title>
      <desc id={`${id}-desc`}>
        {rule === 'product' && `Множителей слева: ${left}, справа: ${right}. Всего одинаковых множителей ${baseLabel}: ${left + right}.`}
        {rule === 'quotient' && `Множителей в числителе: ${left}, сокращается со знаменателем: ${right}. Остаётся: ${left - right}.`}
        {rule === 'power-of-power' && `Строк: ${right}, множителей в каждой строке: ${left}. Всего множителей ${baseLabel}: ${left * right}.`}
      </desc>
      <text x={originX} y="30" fontSize="14" fontWeight="700" fill="var(--dm-muted)" aria-hidden="true">
        {rule === 'product' && 'первая степень + вторая степень'}
        {rule === 'quotient' && 'числитель; зачёркнутое сокращается'}
        {rule === 'power-of-power' && 'каждая скобка — своя строка'}
      </text>
      {Array.from({ length: rows * columns }, (_, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const x = originX + column * (cell + gap);
        const y = originY + row * (cell + gap);
        const isSecondGroup = rule !== 'power-of-power' && column >= left;
        const isCancelled = rule === 'quotient' && column >= left - right;
        return (
          <g key={`${row}-${column}`} aria-hidden="true">
            <rect
              x={x}
              y={y}
              width={cell}
              height={cell}
              rx="7"
              fill={isCancelled ? 'var(--dm-paper)' : isSecondGroup ? 'var(--dm-teal-soft)' : 'var(--dm-violet-soft)'}
              stroke={isCancelled ? 'var(--dm-muted)' : isSecondGroup ? 'var(--dm-teal)' : 'var(--dm-violet)'}
              strokeWidth="2"
            />
            <text
              x={x + cell / 2}
              y={y + cell / 2 + 5}
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill={isCancelled ? 'var(--dm-muted)' : 'var(--dm-ink)'}
            >
              {baseLabel}
            </text>
            {isCancelled && (
              <line x1={x + 3} y1={y + cell - 3} x2={x + cell - 3} y2={y + 3} stroke="var(--dm-coral)" strokeWidth="2.5" />
            )}
          </g>
        );
      })}
      {rule === 'quotient' && right > 0 && (
        <text x={originX} y={height - 16} fontSize="13" fontWeight="700" fill="var(--dm-coral)" aria-hidden="true">
          сокращено множителей: {right}
        </text>
      )}
    </svg>
  );
}

interface OrderRulerProps {
  id: string;
  exponent: number;
  fraction: number;
  numberText: string;
}

function OrderRuler({ id, exponent, fraction, numberText }: OrderRulerProps) {
  const left = 46;
  const right = 46;
  const width = 760;
  const axisY = 132;
  const span = RULER_MAX - RULER_MIN;
  const positionOf = (order: number) => left + ((order - RULER_MIN) / span) * (width - left - right);
  const clamped = Math.min(RULER_MAX, Math.max(RULER_MIN, exponent + fraction));
  const markerX = positionOf(clamped);
  const outside = exponent < RULER_MIN || exponent > RULER_MAX;

  return (
    <svg
      className="dm-algebra-formula-flow"
      viewBox={`0 0 ${width} 200`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>Линейка порядков от 10⁰ до 10¹²</title>
      <desc id={`${id}-desc`}>
        Число {numberText} отмечено между соседними степенями десятки; его порядок равен {exponent}.
        {outside ? ' Порядок выходит за пределы линейки, отметка прижата к краю.' : ''}
      </desc>
      <line x1={left} y1={axisY} x2={width - right} y2={axisY} stroke="var(--dm-ink)" strokeWidth="2" aria-hidden="true" />
      {Array.from({ length: span + 1 }, (_, index) => {
        const order = RULER_MIN + index;
        const x = positionOf(order);
        return (
          <g key={order} aria-hidden="true">
            <line x1={x} y1={axisY - 10} x2={x} y2={axisY + 10} stroke="var(--dm-line)" strokeWidth="2" />
            <text x={x} y={axisY + 32} textAnchor="middle" fontSize="13" fill="var(--dm-muted)">
              10{' '}
              <tspan dy="-6" fontSize="11">{order}</tspan>
            </text>
          </g>
        );
      })}
      <g aria-hidden="true">
        <line x1={markerX} y1={axisY - 62} x2={markerX} y2={axisY} stroke="var(--dm-violet)" strokeWidth="3" />
        <circle cx={markerX} cy={axisY} r="8" fill="var(--dm-violet)" />
        <rect x={Math.min(width - 210, Math.max(6, markerX - 96))} y={axisY - 100} width="192" height="36" rx="10" fill="var(--dm-violet-soft)" stroke="var(--dm-violet)" strokeWidth="2" />
        <text
          x={Math.min(width - 114, Math.max(102, markerX))}
          y={axisY - 76}
          textAnchor="middle"
          fontSize="15"
          fontWeight="700"
          fill="var(--dm-violet-dark)"
        >
          {shorten(numberText, 18)}
        </text>
      </g>
      <text x={left} y="184" fontSize="13" fill="var(--dm-muted)" aria-hidden="true">
        соседние деления отличаются в 10 раз, поэтому шкала сжимает даже очень большие числа
      </text>
    </svg>
  );
}

export default function PowerLab({
  mode = 'definition',
  initialBase,
  initialExponent,
  initialRule,
  initialLeft,
  initialRight,
  initialCheckBase,
  initialNumber,
  challenge = false,
}: PowerLabProps) {
  const reactId = useId();
  const labId = `power-lab-${reactId.replace(/:/g, '')}`;
  const safeMode: PowerLabMode = MODES.includes(mode) ? mode : 'definition';
  const defaults = useMemo(() => ({
    base: initialBase && parseDraft(initialBase) !== null ? initialBase.trim() : '2',
    exponent: safeInteger(initialExponent, 5, 1, MAX_EXPONENT),
    rule: initialRule && RULES.includes(initialRule) ? initialRule : 'product' as PowerRuleId,
    left: safeInteger(initialLeft, 3, 1, MAX_RULE_EXPONENT),
    right: safeInteger(initialRight, 4, 1, MAX_RULE_EXPONENT),
    checkBase: safeInteger(initialCheckBase, 2, 2, 10),
    numberText: initialNumber && parseDraft(initialNumber) !== null ? initialNumber.trim() : '149600000',
  }), [initialBase, initialCheckBase, initialExponent, initialLeft, initialNumber, initialRight, initialRule]);

  const [activeMode, setActiveMode] = useState<PowerLabMode>(safeMode);
  const [baseText, setBaseText] = useState(defaults.base);
  const [exponent, setExponent] = useState(defaults.exponent);
  const [rule, setRule] = useState<PowerRuleId>(defaults.rule);
  const [left, setLeft] = useState(defaults.left);
  const [right, setRight] = useState(defaults.right);
  const [checkBase, setCheckBase] = useState(defaults.checkBase);
  const [numberText, setNumberText] = useState(defaults.numberText);
  const [mantissaGuess, setMantissaGuess] = useState('');
  const [exponentGuess, setExponentGuess] = useState(0);
  const [checked, setChecked] = useState(false);

  const definition = useMemo<DefinitionState>(() => {
    const base = parseDraft(baseText);
    if (base === null) return { error: 'Введи основание: целое число, десятичную дробь вроде 0,5 или обыкновенную вроде 2/3.' };
    try {
      const label = formatExactRussian(base);
      const value = powerExact(base, exponent);
      const rows = powerTable(base, exponent);
      const baseNumber = Math.abs(toExactNumber(base));
      return {
        label,
        expanded: expandPower(label, exponent),
        value,
        valueText: formatExactRussian(value),
        sign: powerSign(base, exponent),
        values: rows.map((row) => Math.abs(toExactNumber(row.value))),
        linear: rows.map((row) => baseNumber * row.exponent),
      };
    } catch (error) {
      return { error: describeError(error) };
    }
  }, [baseText, exponent]);

  const properties = useMemo<PropertiesState>(() => {
    try {
      const check = checkPowerRule(rule, checkBase, left, right, String(checkBase));
      return { check, step: check.step };
    } catch (error) {
      try {
        return { step: applyPowerRule(rule, left, right, String(checkBase)), error: describeError(error) };
      } catch (inner) {
        return { error: describeError(inner) };
      }
    }
  }, [checkBase, left, right, rule]);

  const standard = useMemo<StandardState>(() => {
    const value = parseDraft(numberText);
    if (value === null) return { error: 'Введи число: например 149600000 или 0,00042.' };
    try {
      const form = toStandardForm(value);
      const mantissaNumber = Math.abs(toExactNumber(form.mantissa));
      return {
        form,
        mantissaText: formatExactRussian(form.mantissa),
        valueText: formatExactRussian(value),
        fraction: Math.log10(mantissaNumber),
        natural: form.exponent >= 0,
      };
    } catch (error) {
      return { error: describeError(error) };
    }
  }, [numberText]);

  const guessCorrect = useMemo(() => {
    if (!standard.form) return false;
    const parsed = parseDraft(mantissaGuess);
    if (parsed === null || !isStandardMantissa(parsed)) return false;
    try {
      return (
        formatExactRussian(parsed) === formatExactRussian(standard.form.mantissa)
        && exponentGuess === standard.form.exponent
      );
    } catch {
      return false;
    }
  }, [exponentGuess, mantissaGuess, standard.form]);

  const revealed = !challenge || checked || activeMode !== 'standard';

  const reset = () => {
    setActiveMode(safeMode);
    setBaseText(defaults.base);
    setExponent(defaults.exponent);
    setRule(defaults.rule);
    setLeft(defaults.left);
    setRight(defaults.right);
    setCheckBase(defaults.checkBase);
    setNumberText(defaults.numberText);
    setMantissaGuess('');
    setExponentGuess(0);
    setChecked(false);
  };

  const headline = (() => {
    if (activeMode === 'definition') {
      return definition.error ?? `${definition.label}^${exponent} = ${shorten(definition.valueText ?? '', 20)}`;
    }
    if (activeMode === 'properties') {
      return properties.error ?? `Показатель результата равен ${properties.step?.resultExponent}.`;
    }
    if (standard.error) return standard.error;
    if (challenge && !checked) return 'Запиши число в стандартном виде и нажми «Проверить».';
    return `${standard.valueText} = ${standard.mantissaText} · 10^${standard.form?.exponent}`;
  })();

  return (
    <section className="dm-lab dm-algebra-formula-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория степеней</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Степень: запись, свойства и порядок числа</h3>
          <p>Разверни степень в произведение, проверь свойства на конкретном числе и посмотри, где число стоит на шкале порядков.</p>
        </div>
        <span className="dm-lab__badge">aⁿ</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-algebra-tabs" role="group" aria-label="Режим лаборатории степеней">
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

        {activeMode === 'definition' && (
          <>
            <div className="dm-lab__controls dm-algebra-controls">
              <TextField
                id={`${labId}-base`}
                label="Основание a"
                value={baseText}
                hint="Можно вводить −3, 0,5 или 2/3."
                pattern={EXACT_DRAFT}
                onChange={setBaseText}
              />
              <IntegerField
                id={`${labId}-exponent`}
                label="Показатель n"
                value={exponent}
                minimum={1}
                maximum={MAX_EXPONENT}
                hint={`Натуральное число от 1 до ${MAX_EXPONENT}.`}
                onChange={setExponent}
              />
            </div>

            <div className="dm-algebra-equation" role="math" aria-label={`Степень ${definition.label ?? baseText} в степени ${exponent}`}>
              <span><PowerText base={definition.label ?? baseText} exponent={exponent} /></span>
              <span aria-hidden="true">=</span>
              <span>{definition.expanded ? shorten(definition.expanded, 44) : '—'}</span>
              <span aria-hidden="true">=</span>
              <strong>{definition.error ? 'не определено' : shorten(definition.valueText ?? '', 18)}</strong>
            </div>

            {definition.values && (
              <div className="dm-algebra-visual-wrap" role="region" aria-label="Прокручиваемая диаграмма роста степени" tabIndex={0}>
                <GrowthChart
                  id={`${labId}-growth`}
                  baseLabel={definition.label ?? baseText}
                  values={definition.values}
                  linear={definition.linear ?? []}
                />
              </div>
            )}

            <aside className="dm-algebra-constraints dm-algebra-constraints--valid" aria-labelledby={`${labId}-sign`}>
              <p className="dm-algebra-constraints__caption">Знак степени</p>
              <h4 id={`${labId}-sign`}>
                {definition.sign ? `Степень ${signWord(definition.sign)}` : 'Знак не определён'}
              </h4>
              <p>{definition.sign ? `${signReasonText(definition.sign)}.` : definition.error}</p>
            </aside>
          </>
        )}

        {activeMode === 'properties' && (
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
                id={`${labId}-left`}
                label={rule === 'power-of-power' ? 'Внутренний показатель m' : 'Первый показатель m'}
                value={left}
                minimum={1}
                maximum={MAX_RULE_EXPONENT}
                hint={`Натуральное число от 1 до ${MAX_RULE_EXPONENT}.`}
                onChange={setLeft}
              />
              <IntegerField
                id={`${labId}-right`}
                label={rule === 'power-of-power' ? 'Внешний показатель n' : 'Второй показатель n'}
                value={right}
                minimum={1}
                maximum={MAX_RULE_EXPONENT}
                hint={rule === 'quotient' ? 'При n больше m показатель результата стал бы отрицательным.' : `Натуральное число от 1 до ${MAX_RULE_EXPONENT}.`}
                onChange={setRight}
              />
              <IntegerField
                id={`${labId}-check-base`}
                label="Основание для проверки"
                value={checkBase}
                minimum={2}
                maximum={10}
                hint="На этом числе свойство проверяется точным вычислением."
                onChange={setCheckBase}
              />
            </div>

            <div className="dm-algebra-equation" role="math" aria-label="Равенство свойства степеней">
              {rule === 'power-of-power' ? (
                <span>(<PowerText base={String(checkBase)} exponent={left} />)<sup>{right}</sup></span>
              ) : (
                <>
                  <span><PowerText base={String(checkBase)} exponent={left} /></span>
                  <span aria-hidden="true">{rule === 'product' ? '·' : ':'}</span>
                  <span><PowerText base={String(checkBase)} exponent={right} /></span>
                </>
              )}
              <span aria-hidden="true">=</span>
              <strong>
                {properties.step
                  ? <PowerText base={String(checkBase)} exponent={properties.step.resultExponent} />
                  : 'не определено'}
              </strong>
            </div>

            {properties.step && (
              <div className="dm-algebra-visual-wrap" role="region" aria-label="Прокручиваемая схема множителей" tabIndex={0}>
                <FactorStrip
                  id={`${labId}-strip`}
                  rule={rule}
                  left={left}
                  right={right}
                  baseLabel={String(checkBase)}
                />
              </div>
            )}

            <aside
              className={`dm-algebra-constraints ${properties.check?.matches ? 'dm-algebra-constraints--valid' : 'dm-algebra-constraints--warning'}`}
              aria-labelledby={`${labId}-check`}
            >
              <p className="dm-algebra-constraints__caption">Проверка на числе</p>
              <h4 id={`${labId}-check`}>
                {properties.check
                  ? `Оба пути дают ${shorten(formatExactRussian(properties.check.ruleValue), 18)}`
                  : 'Свойство здесь не применяется'}
              </h4>
              <p>
                {properties.check
                  ? `${RULE_HINTS[rule]} Прямое действие над значениями степеней даёт ${shorten(formatExactRussian(properties.check.directValue), 18)}, вычисление по свойству — ${shorten(formatExactRussian(properties.check.ruleValue), 18)}.`
                  : properties.error}
              </p>
            </aside>
          </>
        )}

        {activeMode === 'standard' && (
          <>
            <div className="dm-lab__controls dm-algebra-controls">
              <TextField
                id={`${labId}-number`}
                label="Число"
                value={numberText}
                hint="Например 149600000, 5720 или 0,00042."
                pattern={NUMBER_DRAFT}
                onChange={(next) => {
                  setNumberText(next);
                  setChecked(false);
                }}
              />
            </div>

            {challenge && (
              <div className="dm-geometry-answer-grid">
                <div className="dm-geometry-answer-field">
                  <label htmlFor={`${labId}-mantissa-guess`}>Моя мантисса a, где 1 ≤ a &lt; 10</label>
                  <input
                    id={`${labId}-mantissa-guess`}
                    type="text"
                    inputMode="decimal"
                    value={mantissaGuess}
                    onChange={(event) => {
                      const raw = event.target.value.trim();
                      if (!NUMBER_DRAFT.test(raw)) return;
                      setMantissaGuess(raw);
                      setChecked(false);
                    }}
                  />
                </div>
                <IntegerField
                  id={`${labId}-exponent-guess`}
                  label="Мой показатель"
                  value={exponentGuess}
                  minimum={-6}
                  maximum={RULER_MAX}
                  hint="Показатель степени десятки."
                  onChange={(next) => {
                    setExponentGuess(next);
                    setChecked(false);
                  }}
                />
                <button className="dm-button" type="button" onClick={() => setChecked(true)}>Проверить</button>
              </div>
            )}

            <div className="dm-algebra-equation" role="math" aria-label="Стандартный вид числа">
              <span>{shorten(standard.valueText ?? numberText, 20)}</span>
              <span aria-hidden="true">=</span>
              <strong>
                {standard.error
                  ? 'не определено'
                  : revealed
                    ? <>{standard.mantissaText} · <PowerText base="10" exponent={standard.form?.exponent ?? 0} /></>
                    : '?'}
              </strong>
            </div>

            {revealed && standard.form && (
              <div className="dm-algebra-visual-wrap" role="region" aria-label="Прокручиваемая линейка порядков" tabIndex={0}>
                <OrderRuler
                  id={`${labId}-ruler`}
                  exponent={standard.form.exponent}
                  fraction={standard.fraction ?? 0}
                  numberText={shorten(standard.valueText ?? '', 18)}
                />
              </div>
            )}

            <aside
              className={`dm-algebra-constraints ${standard.natural ? 'dm-algebra-constraints--valid' : 'dm-algebra-constraints--warning'}`}
              aria-labelledby={`${labId}-order`}
            >
              <p className="dm-algebra-constraints__caption">Порядок числа</p>
              <h4 id={`${labId}-order`}>
                {standard.error
                  ? 'Стандартный вид не найден'
                  : standard.natural
                    ? `Порядок равен ${standard.form?.exponent}`
                    : `Показатель равен ${standard.form?.exponent} — он отрицательный`}
              </h4>
              <p>
                {standard.error
                  ?? (standard.natural
                    ? 'Мантисса лежит между 1 и 10, а показатель показывает, сколько раз число содержит десятку как множитель.'
                    : 'Для чисел меньше единицы нужен отрицательный показатель. Такая степень появится в 8 классе; в 7 классе стандартный вид записываем для больших чисел.')}
              </p>
            </aside>
          </>
        )}

        <div
          className={`dm-result ${definition.error || properties.error || standard.error ? 'dm-algebra-result--warning' : ''}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="dm-result__symbol" aria-hidden="true">
            {activeMode === 'standard' && challenge && checked ? (guessCorrect ? '✓' : '×') : '='}
          </span>
          <p>
            <strong>{headline}</strong>
            <small>
              {activeMode === 'definition'
                ? 'Показатель считает множители, а не слагаемые: он говорит, сколько раз основание участвует в произведении.'
                : activeMode === 'properties'
                  ? RULE_HINTS[rule]
                  : challenge && checked
                    ? guessCorrect
                      ? 'Мантисса и показатель записаны верно.'
                      : 'Проверь два условия: мантисса должна быть не меньше 1 и меньше 10, а показатель — считать десятки.'
                    : 'Стандартный вид сравнивает числа по порядку: сначала смотрим на показатель, и только потом на мантиссу.'}
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
