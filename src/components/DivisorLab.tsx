import { useId, useMemo, useState } from 'react';
import { divisors, factorPairs, type FactorPair } from '../lib/numberTheory';

const DEFAULT_NUMBER = 24;

function FactorArray({ value, pair, id }: { value: number; pair: FactorPair; id: string }) {
  const [rows, columns] = pair;
  const width = 600;
  const height = 210;
  const padding = 14;
  const gap = 4;
  const cellWidth = (width - padding * 2 - gap * Math.max(columns - 1, 0)) / columns;
  const cellHeight = (height - padding * 2 - gap * Math.max(rows - 1, 0)) / rows;

  return (
    <svg
      className="dm-nt-array"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`${id}-array-title ${id}-array-description`}
    >
      <title id={`${id}-array-title`}>{value} предметов в прямоугольнике {rows} на {columns}</title>
      <desc id={`${id}-array-description`}>
        {rows} рядов, в каждом по {columns} предметов. Всего {value}.
      </desc>
      <rect className="dm-nt-array__background" x="1" y="1" width={width - 2} height={height - 2} rx="14" />
      {Array.from({ length: value }, (_, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        return (
          <rect
            className="dm-nt-array__cell"
            key={index}
            x={padding + column * (cellWidth + gap)}
            y={padding + row * (cellHeight + gap)}
            width={cellWidth}
            height={cellHeight}
            rx={Math.min(6, cellWidth / 4, cellHeight / 4)}
          />
        );
      })}
    </svg>
  );
}

export default function DivisorLab() {
  const labId = useId();
  const inputId = `${labId}-number`;
  const titleId = `${labId}-title`;
  const [value, setValue] = useState(DEFAULT_NUMBER);
  const [preferredRows, setPreferredRows] = useState(4);

  const valueDivisors = useMemo(() => divisors(value), [value]);
  const pairs = useMemo(() => factorPairs(value), [value]);
  const selectedPair = pairs.find(([rows]) => rows === preferredRows) ?? pairs[pairs.length - 1];

  const reset = () => {
    setValue(DEFAULT_NUMBER);
    setPreferredRows(4);
  };

  return (
    <section className="dm-lab dm-nt-divisor not-content" aria-labelledby={titleId}>
      <header className="dm-lab__header dm-nt-divisor__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория делителей</p>
          <h3 className="dm-lab__title" id={titleId}>Собери число в прямоугольник</h3>
          <p>Если предметы заполнили все ряды без пустот, длина ряда и число рядов — делители.</p>
        </div>
        <span className="dm-lab__badge">все пары видны</span>
      </header>

      <div className="dm-lab__body dm-nt-divisor__body">
        <div className="dm-lab__controls dm-nt-divisor__controls">
          <div className="dm-field dm-nt-divisor__field">
            <label htmlFor={inputId}>
              Исследуемое число <span className="dm-field__value">{value}</span>
            </label>
            <input
              id={inputId}
              type="range"
              min="1"
              max="120"
              value={value}
              onChange={(event) => setValue(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="dm-nt-divisor__pairs" role="group" aria-label={`Пары множителей числа ${value}`}>
          {pairs.map((pair) => {
            const [rows, columns] = pair;
            const selected = pair === selectedPair;
            return (
              <button
                className="dm-button dm-button--secondary dm-nt-divisor__pair"
                type="button"
                key={`${rows}-${columns}`}
                aria-pressed={selected}
                onClick={() => setPreferredRows(rows)}
              >
                {rows} × {columns}
              </button>
            );
          })}
        </div>

        <FactorArray value={value} pair={selectedPair} id={labId} />

        <div className="dm-nt-divisor__result" aria-live="polite" aria-atomic="true">
          <p className="dm-nt-divisor__equation" role="math">
            {selectedPair[0]} · {selectedPair[1]} = {value}
          </p>
          <p>
            <strong>{valueDivisors.length} {valueDivisors.length === 1 ? 'делитель' : 'делителей'}:</strong>{' '}
            <span>{valueDivisors.join(', ')}</span>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-nt-divisor__reset" type="button" onClick={reset}>
          ↺ Вернуть число {DEFAULT_NUMBER}
        </button>
      </div>
    </section>
  );
}
