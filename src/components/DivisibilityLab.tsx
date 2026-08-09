import { useId, useMemo, useState } from 'react';

const RULES = [
  { divisor: 2, title: 'На 2' },
  { divisor: 3, title: 'На 3' },
  { divisor: 5, title: 'На 5' },
  { divisor: 6, title: 'На 6' },
  { divisor: 9, title: 'На 9' },
  { divisor: 10, title: 'На 10' },
] as const;

function safeDigit(rawValue: string, minimum: number, fallback: number) {
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(9, Math.max(minimum, Math.trunc(parsed)));
}

function ruleExplanation(divisor: (typeof RULES)[number]['divisor'], digits: number[], matches: boolean) {
  const lastDigit = digits.at(-1) ?? 0;
  const digitSum = digits.reduce((sum, digit) => sum + digit, 0);

  switch (divisor) {
    case 2:
      return `Последняя цифра ${lastDigit} ${matches ? 'чётная' : 'нечётная'}.`;
    case 3:
      return `Сумма цифр ${digitSum} ${matches ? 'делится' : 'не делится'} на 3.`;
    case 5:
      return `Последняя цифра ${lastDigit} ${matches ? 'равна 0 или 5' : 'не равна ни 0, ни 5'}.`;
    case 6:
      return matches
        ? 'Число делится и на 2, и на 3.'
        : 'Не выполнен хотя бы один из признаков на 2 и на 3.';
    case 9:
      return `Сумма цифр ${digitSum} ${matches ? 'делится' : 'не делится'} на 9.`;
    case 10:
      return `Последняя цифра ${lastDigit} ${matches ? 'равна 0' : 'не равна 0'}.`;
  }
}

export default function DivisibilityLab() {
  const labId = useId();
  const [digits, setDigits] = useState([2, 4, 3, 0]);

  const number = useMemo(() => Number(digits.join('')), [digits]);
  const digitSum = useMemo(() => digits.reduce((sum, digit) => sum + digit, 0), [digits]);
  const matches = useMemo(
    () => RULES.filter(({ divisor }) => number % divisor === 0).map(({ divisor }) => divisor),
    [number],
  );

  const setLength = (length: 3 | 4) => {
    setDigits((current) => {
      if (current.length === length) return current;
      return length === 3 ? current.slice(0, 3) : [...current, 0];
    });
  };

  const setDigit = (index: number, rawValue: string) => {
    setDigits((current) => {
      const next = [...current];
      next[index] = safeDigit(rawValue, index === 0 ? 1 : 0, current[index] ?? 0);
      return next;
    });
  };

  return (
    <section className="dm-lab dm-nt-divisibility not-content" aria-labelledby={`${labId}-title`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория делимости</p>
          <h3 className="dm-lab__title" id={`${labId}-title`}>Собери число и проверь его</h3>
          <p>Меняй цифры — признаки делимости сработают без письменного деления.</p>
        </div>
        <span className="dm-lab__badge">6 признаков</span>
      </header>

      <div className="dm-lab__body">
        <fieldset className="dm-nt-switch">
          <legend>Количество цифр</legend>
          <button
            className={`dm-button ${digits.length === 3 ? '' : 'dm-button--secondary'}`}
            type="button"
            aria-pressed={digits.length === 3}
            onClick={() => setLength(3)}
          >
            3 цифры
          </button>
          <button
            className={`dm-button ${digits.length === 4 ? '' : 'dm-button--secondary'}`}
            type="button"
            aria-pressed={digits.length === 4}
            onClick={() => setLength(4)}
          >
            4 цифры
          </button>
        </fieldset>

        <div className="dm-nt-number-builder" role="group" aria-label={`Собрано число ${number}`}>
          {digits.map((digit, index) => {
            const place = digits.length - index - 1;
            const placeName = ['единицы', 'десятки', 'сотни', 'тысячи'][place];
            const inputId = `${labId}-digit-${index}`;

            return (
              <div className="dm-field dm-nt-digit" key={`${digits.length}-${index}`}>
                <label htmlFor={inputId}>{placeName}</label>
                <input
                  id={inputId}
                  type="number"
                  inputMode="numeric"
                  min={index === 0 ? 1 : 0}
                  max="9"
                  step="1"
                  value={digit}
                  onChange={(event) => setDigit(index, event.target.value)}
                  aria-label={`Цифра разряда «${placeName}»`}
                />
              </div>
            );
          })}
        </div>

        <div className="dm-nt-number-readout">
          <span>Число</span>
          <output>{number}</output>
          <small>Сумма цифр: {digits.join(' + ')} = {digitSum}</small>
        </div>

        <ul className="dm-nt-rule-grid" aria-label={`Признаки делимости числа ${number}`}>
          {RULES.map(({ divisor, title }) => {
            const isMatch = matches.includes(divisor);

            return (
              <li
                className={`dm-nt-rule ${isMatch ? 'dm-nt-rule--yes' : 'dm-nt-rule--no'}`}
                data-status={isMatch ? 'yes' : 'no'}
                key={divisor}
              >
                <span className="dm-nt-rule__mark" aria-hidden="true">{isMatch ? '✓' : '×'}</span>
                <p>
                  <strong>{title}: {isMatch ? 'да' : 'нет'}</strong>
                  <small>{ruleExplanation(divisor, digits, isMatch)}</small>
                </p>
              </li>
            );
          })}
        </ul>

        <p className="dm-nt-summary" aria-live="polite" aria-atomic="true">
          <strong>{number}</strong> делится без остатка {matches.length > 0 ? `на ${matches.join(', ')}` : 'ни на одно из проверяемых чисел'}.
        </p>
      </div>
    </section>
  );
}
