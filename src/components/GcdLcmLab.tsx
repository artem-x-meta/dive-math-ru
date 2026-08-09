import { useEffect, useId, useMemo, useState } from 'react';

const MIN_NUMBER = 2;
const MAX_VISUAL_NUMBER = 150;

function safeInteger(rawValue: string, fallback: number, maximum: number) {
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) return Math.min(maximum, Math.max(MIN_NUMBER, fallback));
  return Math.min(maximum, Math.max(MIN_NUMBER, Math.trunc(parsed)));
}

function greatestCommonDivisor(left: number, right: number) {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b !== 0) {
    [a, b] = [b, a % b];
  }

  return a;
}

function multiplesUntil(value: number, limit: number) {
  return Array.from({ length: limit / value }, (_, index) => value * (index + 1));
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  maximum: number;
  onChange: (value: number) => void;
}

function NumberField({ id, label, value, maximum, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const edit = (rawValue: string) => {
    setDraft(rawValue);
    const parsed = Number(rawValue);
    if (rawValue.trim() !== '' && Number.isInteger(parsed) && parsed >= MIN_NUMBER && parsed <= maximum) {
      onChange(parsed);
    }
  };

  const commit = () => {
    const next = safeInteger(draft, value, maximum);
    setDraft(String(next));
    onChange(next);
  };

  return (
    <div className="dm-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{value}</span>
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={MIN_NUMBER}
        max={maximum}
        step="1"
        value={draft}
        onChange={(event) => edit(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      <small>От {MIN_NUMBER} до {maximum}</small>
    </div>
  );
}

interface Props {
  initialLeft?: number;
  initialRight?: number;
  maxNumber?: number;
}

export default function GcdLcmLab({ initialLeft = 12, initialRight = 18, maxNumber = 18 }: Props) {
  const labId = useId();
  const requestedMaximum = Number.isFinite(maxNumber) ? Math.trunc(maxNumber) : 18;
  const maximum = Math.min(MAX_VISUAL_NUMBER, Math.max(MIN_NUMBER, requestedMaximum));
  const [left, setLeft] = useState(() => safeInteger(String(initialLeft), MIN_NUMBER, maximum));
  const [right, setRight] = useState(() => safeInteger(String(initialRight), MIN_NUMBER, maximum));

  const gcd = useMemo(() => greatestCommonDivisor(left, right), [left, right]);
  const lcm = (left / gcd) * right;
  const perKitLeft = left / gcd;
  const perKitRight = right / gcd;
  const leftMultiples = useMemo(() => multiplesUntil(left, lcm), [left, lcm]);
  const rightMultiples = useMemo(() => multiplesUntil(right, lcm), [right, lcm]);

  return (
    <section className="dm-lab dm-nt-gcd-lcm not-content" aria-labelledby={`${labId}-title`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория НОД и НОК</p>
          <h3 className="dm-lab__title" id={`${labId}-title`}>Комплекты и совпадения циклов</h3>
          <p>Одни и те же числа показывают две разные задачи: разделить и синхронизировать.</p>
        </div>
        <span className="dm-lab__badge">две модели</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-lab__controls dm-nt-pair-controls">
          <NumberField id={`${labId}-left`} label="Первое число" value={left} maximum={maximum} onChange={setLeft} />
          <NumberField id={`${labId}-right`} label="Второе число" value={right} maximum={maximum} onChange={setRight} />
        </div>

        <div className="dm-nt-model-grid">
          <section className="dm-nt-card" aria-labelledby={`${labId}-gcd-title`}>
            <div className="dm-nt-card__header">
              <div>
                <p className="dm-nt-caption">Разделить поровну</p>
                <h4 id={`${labId}-gcd-title`}>НОД({left}, {right}) = {gcd}</h4>
              </div>
              <span className="dm-nt-card__value">{gcd}</span>
            </div>

            <p>Получается {gcd} одинаковых комплектов: в каждом по {perKitLeft} фиолетовых и {perKitRight} оранжевых фишек.</p>
            <div
              className="dm-nt-kits"
              role="img"
              aria-label={`${gcd} одинаковых комплектов, в каждом ${perKitLeft} фиолетовых и ${perKitRight} оранжевых фишек`}
            >
              {Array.from({ length: gcd }, (_, kitIndex) => (
                <div className="dm-nt-kit" aria-hidden="true" key={kitIndex}>
                  <span className="dm-nt-kit__number">{kitIndex + 1}</span>
                  <span className="dm-nt-kit__tokens">
                    {Array.from({ length: perKitLeft }, (_, tokenIndex) => (
                      <i className="dm-nt-token dm-nt-token--left" key={`left-${tokenIndex}`} />
                    ))}
                    {Array.from({ length: perKitRight }, (_, tokenIndex) => (
                      <i className="dm-nt-token dm-nt-token--right" key={`right-${tokenIndex}`} />
                    ))}
                  </span>
                </div>
              ))}
            </div>
            <p className="dm-nt-note">Больше {gcd} одинаковых комплектов собрать нельзя.</p>
          </section>

          <section className="dm-nt-card" aria-labelledby={`${labId}-lcm-title`}>
            <div className="dm-nt-card__header">
              <div>
                <p className="dm-nt-caption">Дождаться совпадения</p>
                <h4 id={`${labId}-lcm-title`}>НОК({left}, {right}) = {lcm}</h4>
              </div>
              <span className="dm-nt-card__value">{lcm}</span>
            </div>

            <p>Первый цикл срабатывает каждые {left}, второй — каждые {right}. Их первая общая отметка — {lcm}.</p>
            <div className="dm-nt-cycles" role="group" aria-label={`Кратные чисел ${left} и ${right} до первого совпадения ${lcm}`}>
              <div className="dm-nt-cycle">
                <strong>Шаг {left}</strong>
                <ol>
                  {leftMultiples.map((multiple) => (
                    <li className={multiple === lcm ? 'dm-nt-cycle__match' : ''} key={multiple}>{multiple}</li>
                  ))}
                </ol>
              </div>
              <div className="dm-nt-cycle">
                <strong>Шаг {right}</strong>
                <ol>
                  {rightMultiples.map((multiple) => (
                    <li className={multiple === lcm ? 'dm-nt-cycle__match' : ''} key={multiple}>{multiple}</li>
                  ))}
                </ol>
              </div>
            </div>
            <p className="dm-nt-note">На отметке {lcm} оба цикла звучат вместе.</p>
          </section>
        </div>

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">↔</span>
          <p>
            <strong>НОД отвечает про максимальное число групп, НОК — про первое общее кратное.</strong>
            <small>Проверка связи: {gcd} · {lcm} = {gcd * lcm}, и {left} · {right} = {left * right}.</small>
          </p>
        </div>
      </div>
    </section>
  );
}
