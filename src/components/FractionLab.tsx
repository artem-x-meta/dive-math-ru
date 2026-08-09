import { useId, useMemo, useState } from 'react';
import { compareFractions, type Fraction } from '../lib/fractions';

function FractionValue({ numerator, denominator }: Fraction) {
  return (
    <span className="dm-frac" role="math" aria-label={`дробь ${numerator}/${denominator}`}>
      <span aria-hidden="true">{numerator}</span>
      <span aria-hidden="true">{denominator}</span>
    </span>
  );
}

interface FractionBarProps extends Fraction {
  color: string;
  id: string;
  label: string;
}

function FractionBar({ numerator, denominator, color, id, label }: FractionBarProps) {
  const width = 360;
  const padding = 12;
  const innerWidth = width - padding * 2;
  const cellWidth = innerWidth / denominator;

  return (
    <svg
      className="dm-fraction-bar"
      viewBox={`0 0 ${width} 68`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>{label}</title>
      <desc id={`${id}-desc`}>
        Закрашено {numerator} из {denominator} равных частей.
      </desc>
      <rect x={padding} y="15" width={innerWidth} height="38" rx="8" fill="var(--dm-paper)" />
      {Array.from({ length: denominator }, (_, index) => (
        <rect
          key={index}
          x={padding + index * cellWidth}
          y="15"
          width={cellWidth}
          height="38"
          fill={index < numerator ? color : 'transparent'}
          stroke="var(--dm-muted)"
          strokeWidth="1"
        />
      ))}
      <rect x={padding} y="15" width={innerWidth} height="38" rx="8" fill="none" stroke="var(--dm-ink)" strokeWidth="1.5" />
    </svg>
  );
}

interface FractionControlsProps {
  name: string;
  idPrefix: string;
  fraction: Fraction;
  color: string;
  onChange: (fraction: Fraction) => void;
}

function FractionControls({ name, idPrefix, fraction, color, onChange }: FractionControlsProps) {
  const numeratorId = `${idPrefix}-${name}-numerator`;
  const denominatorId = `${idPrefix}-${name}-denominator`;
  const setDenominator = (denominator: number) => {
    onChange({ numerator: Math.min(fraction.numerator, denominator), denominator });
  };

  return (
    <section className="dm-fraction-card" style={{ '--fraction-color': color } as React.CSSProperties}>
      <div className="dm-fraction-card__title">
        <strong>{name}</strong>
        <FractionValue {...fraction} />
      </div>
      <FractionBar {...fraction} color={color} id={`${idPrefix}-${name}`} label={`Дробь ${name}`} />
      <div className="dm-lab__controls">
        <div className="dm-field">
          <label htmlFor={numeratorId}>
            Числитель <span className="dm-field__value">{fraction.numerator}</span>
          </label>
          <input
            id={numeratorId}
            type="range"
            min="1"
            max={fraction.denominator}
            value={fraction.numerator}
            onChange={(event) => onChange({ ...fraction, numerator: Number(event.target.value) })}
            aria-label={`Числитель дроби ${name}`}
          />
        </div>
        <div className="dm-field">
          <label htmlFor={denominatorId}>
            Знаменатель <span className="dm-field__value">{fraction.denominator}</span>
          </label>
          <input
            id={denominatorId}
            type="range"
            min="2"
            max="12"
            value={fraction.denominator}
            onChange={(event) => setDenominator(Number(event.target.value))}
            aria-label={`Знаменатель дроби ${name}`}
          />
        </div>
      </div>
    </section>
  );
}

export default function FractionLab() {
  const labId = useId();
  const [left, setLeft] = useState<Fraction>({ numerator: 3, denominator: 4 });
  const [right, setRight] = useState<Fraction>({ numerator: 5, denominator: 8 });

  const comparison = useMemo(() => compareFractions(left, right), [left, right]);
  const leftProduct = left.numerator * right.denominator;
  const rightProduct = right.numerator * left.denominator;
  const symbol = comparison === 0 ? '=' : comparison > 0 ? '>' : '<';
  const relationText = comparison === 0 ? 'равны' : comparison > 0 ? 'левая дробь больше' : 'правая дробь больше';

  const reset = () => {
    setLeft({ numerator: 3, denominator: 4 });
    setRight({ numerator: 5, denominator: 8 });
  };

  return (
    <div className="dm-lab not-content">
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Интерактивная лаборатория</p>
          <h3 className="dm-lab__title">Какая дробь больше?</h3>
          <p>Двигай ползунки и ищи закономерность между рисунком и вычислением.</p>
        </div>
        <span className="dm-lab__badge">можно двигать</span>
      </header>
      <div className="dm-lab__body">
        <div className="dm-lab__grid">
          <FractionControls name="A" idPrefix={labId} fraction={left} color="#5947d6" onChange={setLeft} />
          <FractionControls name="B" idPrefix={labId} fraction={right} color="#e9664c" onChange={setRight} />
        </div>

        <div className="dm-fraction-display" aria-live="polite">
          <FractionValue {...left} />
          <span>{symbol}</span>
          <FractionValue {...right} />
        </div>

        <div className="dm-result">
          <span className="dm-result__symbol" aria-hidden="true">{symbol}</span>
          <p>
            <strong>{relationText[0].toUpperCase() + relationText.slice(1)}.</strong>
            <small>
              Сравниваем крест-накрест: {left.numerator} · {right.denominator} = {leftProduct}, а {right.numerator} · {left.denominator} = {rightProduct}.
            </small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>
          ↺ Вернуть пример
        </button>
      </div>
    </div>
  );
}
