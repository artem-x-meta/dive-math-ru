import { useId, useMemo, useState } from 'react';
import { addFractions, lcm, type Fraction } from '../lib/fractions';

function FractionValue({ numerator, denominator }: Fraction) {
  return (
    <span className="dm-frac" role="math" aria-label={`дробь ${numerator}/${denominator}`}>
      <span aria-hidden="true">{numerator}</span>
      <span aria-hidden="true">{denominator}</span>
    </span>
  );
}

interface CommonBarProps {
  filled: number;
  total: number;
  color: string;
  label: string;
}

function CommonBar({ filled, total, color, label }: CommonBarProps) {
  const width = 620;
  const height = 56;
  const cell = width / total;

  return (
    <svg className="dm-fraction-bar" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <rect width={width} height="38" y="8" rx="7" fill="var(--dm-paper)" />
      {Array.from({ length: total }, (_, index) => (
        <rect
          key={index}
          x={index * cell}
          y="8"
          width={cell}
          height="38"
          fill={index < filled ? color : 'transparent'}
          stroke="var(--dm-muted)"
          strokeWidth={total > 40 ? 0.6 : 1}
        />
      ))}
      <rect width={width} height="38" y="8" rx="7" fill="none" stroke="var(--dm-ink)" strokeWidth="1.5" />
    </svg>
  );
}

function NumberField({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="dm-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{value}</span>
      </label>
      <input id={id} type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} aria-label={label} />
    </div>
  );
}

export default function FractionAdditionLab() {
  const labId = useId();
  const [left, setLeft] = useState<Fraction>({ numerator: 2, denominator: 3 });
  const [right, setRight] = useState<Fraction>({ numerator: 1, denominator: 4 });

  const common = useMemo(() => lcm(left.denominator, right.denominator), [left.denominator, right.denominator]);
  const leftExpanded = left.numerator * (common / left.denominator);
  const rightExpanded = right.numerator * (common / right.denominator);
  const raw = { numerator: leftExpanded + rightExpanded, denominator: common };
  const answer = useMemo(() => addFractions(left, right), [left, right]);
  const wasSimplified = raw.numerator !== answer.numerator || raw.denominator !== answer.denominator;

  return (
    <div className="dm-lab not-content">
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория общего знаменателя</p>
          <h3 className="dm-lab__title">Складываем части одного размера</h3>
          <p>Меняй дроби: модель сама найдёт наименьший общий знаменатель.</p>
        </div>
        <span className="dm-lab__badge">живой расчёт</span>
      </header>
      <div className="dm-lab__body">
        <div className="dm-lab__controls dm-lab__controls--four">
          <NumberField id={`${labId}-left-numerator`} label="Числитель A" value={left.numerator} min={1} max={left.denominator} onChange={(numerator) => setLeft({ ...left, numerator })} />
          <NumberField id={`${labId}-left-denominator`} label="Знаменатель A" value={left.denominator} min={2} max={10} onChange={(denominator) => setLeft({ numerator: Math.min(left.numerator, denominator), denominator })} />
          <NumberField id={`${labId}-right-numerator`} label="Числитель B" value={right.numerator} min={1} max={right.denominator} onChange={(numerator) => setRight({ ...right, numerator })} />
          <NumberField id={`${labId}-right-denominator`} label="Знаменатель B" value={right.denominator} min={2} max={10} onChange={(denominator) => setRight({ numerator: Math.min(right.numerator, denominator), denominator })} />
        </div>

        <div className="dm-equation-line" aria-live="polite">
          <FractionValue {...left} /> <span>+</span> <FractionValue {...right} />
          <span>=</span>
          <FractionValue numerator={leftExpanded} denominator={common} /> <span>+</span>
          <FractionValue numerator={rightExpanded} denominator={common} />
          <span>=</span> <FractionValue {...answer} />
        </div>

        <div className="dm-common-bars">
          <div>
            <span className="dm-common-bars__label">Первая дробь: {leftExpanded} из {common} частей</span>
            <CommonBar filled={leftExpanded} total={common} color="#5947d6" label={`Первая дробь после приведения: ${leftExpanded}/${common}`} />
          </div>
          <div>
            <span className="dm-common-bars__label">Вторая дробь: {rightExpanded} из {common} частей</span>
            <CommonBar filled={rightExpanded} total={common} color="#e9664c" label={`Вторая дробь после приведения: ${rightExpanded}/${common}`} />
          </div>
        </div>

        <div className="dm-result">
          <span className="dm-result__symbol" aria-hidden="true">+</span>
          <p>
            <strong>Общий знаменатель — {common}.</strong>
            <small>
              Складываем {leftExpanded} + {rightExpanded} = {raw.numerator}. {wasSimplified ? `Дробь ${raw.numerator}/${raw.denominator} сокращается до ${answer.numerator}/${answer.denominator}.` : 'Ответ уже несократим.'}
            </small>
          </p>
        </div>
      </div>
    </div>
  );
}
