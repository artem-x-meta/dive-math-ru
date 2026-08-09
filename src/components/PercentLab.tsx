import { useEffect, useId, useState } from 'react';

const DECIMAL_DRAFT = /^\d*(?:[.,]\d*)?$/;
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;
const MIN_VALUE = 0;
const MAX_VALUE = 1_000_000;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, precision = 4) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function parseDecimal(rawValue: string) {
  const normalized = rawValue.trim().replace(',', '.');
  if (normalized === '' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeDecimal(value: number | undefined, fallback: number, minimum: number, maximum: number) {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return round(clamp(value, minimum, maximum), 2);
}

function formatNumber(value: number) {
  return String(round(value)).replace('.', ',');
}

interface DecimalFieldProps {
  id: string;
  label: string;
  unit?: string;
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
}

function DecimalField({ id, label, unit, value, minimum, maximum, onChange }: DecimalFieldProps) {
  const hintId = `${id}-hint`;
  const [draft, setDraft] = useState(formatNumber(value));

  useEffect(() => setDraft(formatNumber(value)), [value]);

  const edit = (rawValue: string) => {
    if (!DECIMAL_DRAFT.test(rawValue)) return;
    setDraft(rawValue);
    const parsed = parseDecimal(rawValue);
    if (parsed !== null && parsed >= minimum && parsed <= maximum) onChange(parsed);
  };

  const commit = () => {
    const parsed = parseDecimal(draft);
    const next = parsed === null ? value : round(clamp(parsed, minimum, maximum), 2);
    setDraft(formatNumber(next));
    onChange(next);
  };

  return (
    <div className="dm-field dm-ratio-field">
      <label htmlFor={id}>
        {label}{unit ? `, ${unit}` : ''} <span className="dm-field__value">{formatNumber(value)}</span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-describedby={hintId}
        onChange={(event) => edit(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      <small id={hintId}>От {formatNumber(minimum)} до {formatNumber(maximum)}{unit ? ` ${unit}` : ''}.</small>
    </div>
  );
}

export interface PercentLabProps {
  initialPercent?: number;
  initialValue?: number;
  unit?: string;
  showChanges?: boolean;
}

export default function PercentLab({
  initialPercent,
  initialValue,
  unit = '₽',
  showChanges = true,
}: PercentLabProps) {
  const labId = useId();
  const [percent, setPercent] = useState(() => safeDecimal(initialPercent, 20, MIN_PERCENT, MAX_PERCENT));
  const [baseValue, setBaseValue] = useState(() => safeDecimal(initialValue, 500, MIN_VALUE, MAX_VALUE));
  const safeUnit = unit.trim().slice(0, 16);
  const ratio = percent / 100;
  const share = round(baseValue * ratio);
  const increaseFactor = round(1 + ratio);
  const decreaseFactor = round(1 - ratio);
  const increased = round(baseValue * increaseFactor);
  const decreased = round(baseValue * decreaseFactor);
  const afterIncreaseAndDecrease = round(increased * decreaseFactor);
  const returnDifference = round(baseValue - afterIncreaseAndDecrease);
  const withUnit = (value: number) => `${formatNumber(value)}${safeUnit ? ` ${safeUnit}` : ''}`;

  return (
    <section className="dm-lab dm-ratio-percent-lab not-content" aria-labelledby={`${labId}-title`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория процентов</p>
          <h3 className="dm-lab__title" id={`${labId}-title`}>Процент — одна сотая</h3>
          <p>
            {showChanges
              ? 'Свяжи сотенную сетку, дробь, десятичную запись и изменение величины.'
              : 'Свяжи сотенную сетку, обыкновенную дробь и десятичную запись.'}
          </p>
        </div>
        <span className="dm-lab__badge">100 клеток</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-lab__controls dm-ratio-controls">
          <DecimalField
            id={`${labId}-percent`}
            label="Процент"
            unit="%"
            value={percent}
            minimum={MIN_PERCENT}
            maximum={MAX_PERCENT}
            onChange={setPercent}
          />
          <DecimalField
            id={`${labId}-value`}
            label="Исходная величина"
            unit={safeUnit || undefined}
            value={baseValue}
            minimum={MIN_VALUE}
            maximum={MAX_VALUE}
            onChange={setBaseValue}
          />
        </div>

        <div className="dm-ratio-percent-model">
          <svg
            className="dm-ratio-percent-grid"
            viewBox="0 0 100 100"
            role="img"
            aria-labelledby={`${labId}-grid-title ${labId}-grid-desc`}
          >
            <title id={`${labId}-grid-title`}>Сотенная сетка: {formatNumber(percent)}%</title>
            <desc id={`${labId}-grid-desc`}>
              Закрашено {formatNumber(percent)} из 100 равных клеток. Если процент нецелый, последняя клетка закрашена частично.
            </desc>
            {Array.from({ length: 100 }, (_, index) => {
              const column = index % 10;
              const row = Math.floor(index / 10);
              const coverage = clamp(percent - index, 0, 1);
              return (
                <g aria-hidden="true" key={index}>
                  <rect className="dm-ratio-percent-grid__cell" x={column * 10 + 0.7} y={row * 10 + 0.7} width="8.6" height="8.6" rx="1" />
                  {coverage > 0 && (
                    <rect
                      className="dm-ratio-percent-grid__fill"
                      x={column * 10 + 0.7}
                      y={row * 10 + 0.7}
                      width={8.6 * coverage}
                      height="8.6"
                      rx={coverage === 1 ? 1 : 0}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          <div className="dm-ratio-percent-equation" role="math" aria-label={`${formatNumber(percent)} процентов равно ${formatNumber(percent)} сотых, или ${formatNumber(ratio)}`}>
            <span>{formatNumber(percent)}%</span>
            <span aria-hidden="true">=</span>
            <span className="dm-ratio-percent-fraction" aria-hidden="true">
              <span>{formatNumber(percent)}</span>
              <span>100</span>
            </span>
            <span aria-hidden="true">=</span>
            <span>{formatNumber(ratio)}</span>
          </div>
        </div>

        <div className="dm-ratio-percent-cards">
          <section className="dm-ratio-percent-card">
            <p className="dm-ratio-percent-card__caption">Найти {formatNumber(percent)}% от величины</p>
            <h4>{withUnit(share)}</h4>
            <p>{withUnit(baseValue)} · {formatNumber(ratio)} = {withUnit(share)}</p>
          </section>
          {showChanges && (
            <>
              <section className="dm-ratio-percent-card dm-ratio-percent-card--increase">
                <p className="dm-ratio-percent-card__caption">Увеличить на {formatNumber(percent)}%</p>
                <h4>{withUnit(increased)}</h4>
                <p>{withUnit(baseValue)} · (1 + {formatNumber(ratio)}) = {withUnit(baseValue)} · {formatNumber(increaseFactor)}</p>
              </section>
              <section className="dm-ratio-percent-card dm-ratio-percent-card--decrease">
                <p className="dm-ratio-percent-card__caption">Уменьшить на {formatNumber(percent)}%</p>
                <h4>{withUnit(decreased)}</h4>
                <p>{withUnit(baseValue)} · (1 − {formatNumber(ratio)}) = {withUnit(baseValue)} · {formatNumber(decreaseFactor)}</p>
              </section>
            </>
          )}
        </div>

        {showChanges && (
          <aside className="dm-ratio-percent-trap" aria-labelledby={`${labId}-trap-title`}>
            <p className="dm-ratio-percent-card__caption">Ловушка сложения процентов</p>
            <h4 id={`${labId}-trap-title`}>+{formatNumber(percent)}%, затем −{formatNumber(percent)}%</h4>
            <p>
              После увеличения получаем {withUnit(increased)}. Теперь уменьшение считают уже от этой новой величины:
              {' '}{withUnit(increased)} · {formatNumber(decreaseFactor)} = <strong>{withUnit(afterIncreaseAndDecrease)}</strong>.
            </p>
            <p>
              {returnDifference === 0
                ? 'Итог совпал с исходной величиной: так бывает при нулевом проценте или нулевом основании.'
                : `Это на ${withUnit(returnDifference)} меньше исходного: множители, а не знаки процентов, определяют результат.`}
            </p>
          </aside>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">%</span>
          <p>
            <strong>{formatNumber(percent)}% от {withUnit(baseValue)} — это {withUnit(share)}.</strong>
            <small>
              {showChanges
                ? `Для части умножаем на ${formatNumber(ratio)}; для увеличения — на ${formatNumber(increaseFactor)}, для уменьшения — на ${formatNumber(decreaseFactor)}.`
                : `Процент переводим в десятичную дробь ${formatNumber(ratio)} и умножаем на целое.`}
            </small>
          </p>
        </div>
      </div>
    </section>
  );
}
