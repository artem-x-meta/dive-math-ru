import { useId, useMemo, useState } from 'react';
import { divideWithRemainder } from '../lib/numberTheory';

const DEFAULT_DIVIDEND = 53;
const DEFAULT_DIVISOR = 8;

function groupWords(value: number): string {
  const lastTwoDigits = value % 100;
  const lastDigit = value % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'полных групп';
  if (lastDigit === 1) return 'полную группу';
  if (lastDigit >= 2 && lastDigit <= 4) return 'полные группы';
  return 'полных групп';
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function NumberField({ id, label, value, min, max, onChange }: NumberFieldProps) {
  return (
    <div className="dm-field dm-nt-remainder__field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{value}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function DivisionStrip({ dividend, divisor, remainder, id }: { dividend: number; divisor: number; remainder: number; id: string }) {
  const width = 600;
  const height = 92;
  const padding = 12;
  const gap = 2;
  const cellWidth = dividend === 0 ? 0 : (width - padding * 2 - gap * Math.max(dividend - 1, 0)) / dividend;

  return (
    <svg
      className="dm-nt-remainder__strip"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`${id}-strip-title ${id}-strip-description`}
    >
      <title id={`${id}-strip-title`}>Деление {dividend} на группы по {divisor}</title>
      <desc id={`${id}-strip-description`}>
        {dividend === 0
          ? 'Делить нечего: получилось ноль полных групп и остаток ноль.'
          : `Каждая полная группа содержит ${divisor}. В неполной группе осталось ${remainder}.`}
      </desc>
      <rect className="dm-nt-remainder__strip-background" x="1" y="1" width={width - 2} height={height - 2} rx="14" />
      {dividend === 0 ? (
        <text className="dm-nt-remainder__empty" x={width / 2} y={height / 2} textAnchor="middle" dominantBaseline="middle">
          0 предметов
        </text>
      ) : Array.from({ length: dividend }, (_, index) => {
        const isRemainder = remainder > 0 && index >= dividend - remainder;
        const startsGroup = index > 0 && index % divisor === 0;
        return (
          <rect
            className={isRemainder ? 'dm-nt-remainder__cell dm-nt-remainder__cell--rest' : 'dm-nt-remainder__cell'}
            key={index}
            x={padding + index * (cellWidth + gap)}
            y="20"
            width={cellWidth}
            height="52"
            rx={Math.min(5, cellWidth / 4)}
            data-group-start={startsGroup || undefined}
          />
        );
      })}
    </svg>
  );
}

export default function RemainderLab() {
  const labId = useId();
  const titleId = `${labId}-title`;
  const [dividend, setDividend] = useState(DEFAULT_DIVIDEND);
  const [divisor, setDivisor] = useState(DEFAULT_DIVISOR);
  const result = useMemo(() => divideWithRemainder(dividend, divisor), [dividend, divisor]);
  const dividesEvenly = result.remainder === 0;

  const reset = () => {
    setDividend(DEFAULT_DIVIDEND);
    setDivisor(DEFAULT_DIVISOR);
  };

  return (
    <section className="dm-lab dm-nt-remainder not-content" aria-labelledby={titleId}>
      <header className="dm-lab__header dm-nt-remainder__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория остатков</p>
          <h3 className="dm-lab__title" id={titleId}>Разложи поровну по группам</h3>
          <p>Меняй числа и наблюдай: остаток всегда меньше размера одной полной группы.</p>
        </div>
        <span className="dm-lab__badge">живое деление</span>
      </header>

      <div className="dm-lab__body dm-nt-remainder__body">
        <div className="dm-lab__controls dm-nt-remainder__controls">
          <NumberField
            id={`${labId}-dividend`}
            label="Сколько предметов"
            value={dividend}
            min={0}
            max={96}
            onChange={setDividend}
          />
          <NumberField
            id={`${labId}-divisor`}
            label="Предметов в группе"
            value={divisor}
            min={1}
            max={12}
            onChange={setDivisor}
          />
        </div>

        <DivisionStrip dividend={dividend} divisor={divisor} remainder={result.remainder} id={labId} />

        <div className="dm-nt-remainder__result" aria-live="polite" aria-atomic="true">
          <p className="dm-nt-remainder__equation" role="math" aria-label={`${dividend} равно ${divisor} умножить на ${result.quotient} плюс ${result.remainder}`}>
            {dividend} = {divisor} · {result.quotient} + {result.remainder}
          </p>
          <p>
            Удалось собрать <strong>{result.quotient} {groupWords(result.quotient)}</strong>
            {dividesEvenly ? ' без остатка.' : <> и осталось <strong>{result.remainder}</strong>.</>}
          </p>
          <p className="dm-nt-remainder__rule">
            {dividesEvenly
              ? `${dividend} делится на ${divisor} нацело.`
              : `Проверка: остаток ${result.remainder} меньше делителя ${divisor}.`}
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-nt-remainder__reset" type="button" onClick={reset}>
          ↺ Вернуть пример {DEFAULT_DIVIDEND} : {DEFAULT_DIVISOR}
        </button>
      </div>
    </section>
  );
}
