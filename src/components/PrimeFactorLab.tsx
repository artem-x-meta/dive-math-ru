import { useId, useMemo, useState } from 'react';

const MIN_NUMBER = 2;
const MAX_NUMBER = 360;

function safeInteger(rawValue: string, fallback: number) {
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_NUMBER, Math.max(MIN_NUMBER, Math.trunc(parsed)));
}

function primeFactors(value: number) {
  const factors: number[] = [];
  let remainder = value;

  for (let divisor = 2; divisor * divisor <= remainder; divisor += 1) {
    while (remainder % divisor === 0) {
      factors.push(divisor);
      remainder /= divisor;
    }
  }

  if (remainder > 1) factors.push(remainder);
  return factors;
}

interface FactorNodeProps {
  factors: number[];
  revealedSplits: number;
  depth?: number;
}

function FactorNode({ factors, revealedSplits, depth = 0 }: FactorNodeProps) {
  const value = factors.reduce((product, factor) => product * factor, 1);
  const canSplit = factors.length > 1 && depth < revealedSplits;

  return (
    <li className="dm-nt-factor-tree__branch">
      <span className={`dm-nt-factor-tree__node ${factors.length === 1 ? 'dm-nt-factor-tree__node--prime' : ''}`}>
        {value}
      </span>
      {canSplit && (
        <ul>
          <li>
            <span className="dm-nt-factor-tree__node dm-nt-factor-tree__node--prime">{factors[0]}</span>
          </li>
          <FactorNode factors={factors.slice(1)} revealedSplits={revealedSplits} depth={depth + 1} />
        </ul>
      )}
    </li>
  );
}

export default function PrimeFactorLab() {
  const labId = useId();
  const [number, setNumber] = useState(84);
  const [numberDraft, setNumberDraft] = useState('84');
  const [revealedSplits, setRevealedSplits] = useState(0);
  const factors = useMemo(() => primeFactors(number), [number]);
  const splitCount = Math.max(0, factors.length - 1);
  const isPrime = factors.length === 1;
  const isComplete = revealedSplits >= splitCount;

  const applyNumber = (next: number) => {
    setNumber(next);
    setNumberDraft(String(next));
    setRevealedSplits(0);
  };

  const editNumber = (rawValue: string) => {
    setNumberDraft(rawValue);
    const parsed = Number(rawValue);
    if (rawValue.trim() !== '' && Number.isInteger(parsed) && parsed >= MIN_NUMBER && parsed <= MAX_NUMBER) {
      setNumber(parsed);
      setRevealedSplits(0);
    }
  };

  const commitNumber = () => applyNumber(safeInteger(numberDraft, number));

  const revealNext = () => {
    setRevealedSplits((current) => Math.min(splitCount, current + 1));
  };

  const visibleFactors = isComplete ? factors : factors.slice(0, revealedSplits);
  const visibleRemainder = visibleFactors.reduce((remainder, factor) => remainder / factor, number);

  return (
    <section className="dm-lab dm-nt-prime not-content" aria-labelledby={`${labId}-title`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Дерево множителей</p>
          <h3 className="dm-lab__title" id={`${labId}-title`}>Разложи число до простых листьев</h3>
          <p>На каждом шаге отделяется наименьший простой множитель.</p>
        </div>
        <span className="dm-lab__badge">шаг за шагом</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-lab__controls dm-nt-prime__controls">
          <div className="dm-field">
            <label htmlFor={`${labId}-number`}>
              Число <span className="dm-field__value">{number}</span>
            </label>
            <input
              id={`${labId}-number`}
              type="number"
              inputMode="numeric"
              min={MIN_NUMBER}
              max={MAX_NUMBER}
              step="1"
              value={numberDraft}
              onChange={(event) => editNumber(event.target.value)}
              onBlur={commitNumber}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
            <small>От {MIN_NUMBER} до {MAX_NUMBER}</small>
          </div>
          <div className="dm-field dm-nt-prime__slider">
            <label htmlFor={`${labId}-range`}>Быстрый выбор числа</label>
            <input
              id={`${labId}-range`}
              type="range"
              min={MIN_NUMBER}
              max={MAX_NUMBER}
              value={number}
              onChange={(event) => applyNumber(safeInteger(event.target.value, number))}
              aria-label="Выбрать число ползунком"
            />
          </div>
        </div>

        <div className="dm-nt-factor-workspace">
          <div>
            <p className="dm-nt-caption">Дерево числа {number}</p>
            <ul
              className="dm-nt-factor-tree"
              aria-label={isComplete ? `Разложение ${number}: ${factors.join(' умножить на ')}` : `Дерево множителей числа ${number}, раскрыто шагов: ${revealedSplits}`}
            >
              <FactorNode factors={factors} revealedSplits={revealedSplits} />
            </ul>
          </div>

          <div className="dm-nt-factor-steps" aria-live="polite" aria-atomic="true">
            {isPrime ? (
              <p><strong>{number} — простое число.</strong> У него ровно два натуральных делителя: 1 и {number}.</p>
            ) : isComplete ? (
              <p>
                <strong>Все листья простые.</strong>
                <span>{number} = {factors.join(' · ')}</span>
              </p>
            ) : revealedSplits === 0 ? (
              <p><strong>Начни с корня.</strong> Найдём его наименьший простой делитель.</p>
            ) : (
              <p>
                <strong>Отделили {visibleFactors.join(' · ')}.</strong>
                <span>Осталось разложить {visibleRemainder}.</span>
              </p>
            )}
          </div>
        </div>

        {!isPrime && (
          <div className="dm-nt-actions">
            <button className="dm-button" type="button" onClick={revealNext} disabled={isComplete}>
              {revealedSplits === 0 ? 'Найти первый множитель' : isComplete ? 'Разложение готово' : 'Раскрыть следующую ветвь'}
            </button>
            <button
              className="dm-button dm-button--secondary"
              type="button"
              onClick={() => setRevealedSplits(0)}
              disabled={revealedSplits === 0}
            >
              ↺ Свернуть дерево
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
