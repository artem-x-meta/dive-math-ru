import { useEffect, useId, useMemo, useState } from 'react';
import {
  compatibleUnits,
  normalizePartToWholeRatio,
  normalizeQuantityRatio,
  type MeasurementUnit,
  type Quantity,
  type Ratio,
} from '../lib/ratios';

const ABSOLUTE_MAX_AMOUNT = 40;
const MAX_MEASUREMENT = 10_000;
const DECIMAL_DRAFT = /^\d*(?:[.,]\d{0,2})?$/;

const UNIT_OPTIONS: ReadonlyArray<{ value: MeasurementUnit; short: string; label: string }> = [
  { value: 'piece', short: 'шт.', label: 'штуки' },
  { value: 'cm', short: 'см', label: 'сантиметры' },
  { value: 'm', short: 'м', label: 'метры' },
  { value: 'g', short: 'г', label: 'граммы' },
  { value: 'kg', short: 'кг', label: 'килограммы' },
];

function safeAmount(value: number, fallback: number, minimum: number, maximum: number, integer = true): number {
  if (!Number.isFinite(value)) return Math.min(maximum, Math.max(minimum, fallback));
  const normalized = integer ? Math.trunc(value) : Math.round(value * 100) / 100;
  return Math.min(maximum, Math.max(minimum, normalized));
}

function parseAmount(rawValue: string): number | null {
  const normalized = rawValue.trim().replace(',', '.');
  if (normalized === '' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAmount(value: number): string {
  return String(value).replace('.', ',');
}

function unitLabel(unit: MeasurementUnit): string {
  return UNIT_OPTIONS.find((option) => option.value === unit)?.short ?? unit;
}

function RatioValue({ value, label }: { value: Ratio; label: string }) {
  return (
    <span className="dm-ratio-value" role="math" aria-label={`${label}: ${value.first} к ${value.second}`}>
      <span aria-hidden="true">{value.first}</span>
      <span className="dm-ratio-value__colon" aria-hidden="true">:</span>
      <span aria-hidden="true">{value.second}</span>
    </span>
  );
}

interface AmountFieldProps {
  id: string;
  label: string;
  colorName: string;
  value: number;
  unit: MeasurementUnit;
  minimum: number;
  maximum: number;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: MeasurementUnit) => void;
}

function AmountField({
  id,
  label,
  colorName,
  value,
  unit,
  minimum,
  maximum,
  onValueChange,
  onUnitChange,
}: AmountFieldProps) {
  const isCount = unit === 'piece';
  const [draft, setDraft] = useState(formatAmount(value));

  useEffect(() => setDraft(formatAmount(value)), [value]);

  const edit = (rawValue: string) => {
    if (!DECIMAL_DRAFT.test(rawValue)) return;
    setDraft(rawValue);
    const parsed = parseAmount(rawValue);
    const hasAllowedPrecision = parsed !== null && (!isCount || Number.isInteger(parsed));
    if (hasAllowedPrecision && parsed >= minimum && parsed <= maximum) {
      onValueChange(parsed);
    }
  };

  const commit = () => {
    const parsed = parseAmount(draft);
    const next = parsed === null ? value : safeAmount(parsed, value, minimum, maximum, isCount);
    setDraft(formatAmount(next));
    onValueChange(next);
  };

  return (
    <section className="dm-ratio-field" aria-labelledby={`${id}-title`}>
      <div className="dm-ratio-field__heading">
        <span className={`dm-ratio-swatch dm-ratio-swatch--${colorName}`} aria-hidden="true" />
        <strong id={`${id}-title`}>{label}</strong>
      </div>
      <div className="dm-ratio-field__inputs">
        <div className="dm-field">
          <label htmlFor={`${id}-amount`}>
            Количество <span className="dm-field__value">{formatAmount(value)}</span>
          </label>
          <input
            id={`${id}-amount`}
            type="text"
            inputMode={isCount ? 'numeric' : 'decimal'}
            value={draft}
            onChange={(event) => edit(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <small>
            {isCount
              ? `Целое число от ${minimum} до ${maximum}`
              : `Число от ${formatAmount(minimum)} до ${formatAmount(maximum)}; до двух знаков после запятой`}
          </small>
        </div>
        <div className="dm-field">
          <label htmlFor={`${id}-unit`}>Единица</label>
          <select
            id={`${id}-unit`}
            value={unit}
            onChange={(event) => onUnitChange(event.target.value as MeasurementUnit)}
          >
            {UNIT_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label} ({option.short})</option>
            ))}
          </select>
          <small>Для отношения важен вид величины</small>
        </div>
      </div>
    </section>
  );
}

interface QuantityPictureProps {
  id: string;
  first: Quantity;
  second: Quantity;
}

function QuantityPicture({ id, first, second }: QuantityPictureProps) {
  const columns = 8;
  const usesDots = first.unit === 'piece' && second.unit === 'piece';
  const usesConvertedScale = !usesDots && compatibleUnits(first.unit, second.unit);
  const convertedRatio = usesConvertedScale ? normalizeQuantityRatio(first, second) : null;
  const largestConvertedPart = convertedRatio
    ? Math.max(convertedRatio.first, convertedRatio.second)
    : 1;
  const barWidth = (value: number) => value === 0
    ? 0
    : Math.max(7, (value / largestConvertedPart) * 190);
  const dot = (index: number, startX: number, colorClass: string) => (
    <circle
      className={`dm-ratio-dot ${colorClass}`}
      cx={startX + (index % columns) * 25}
      cy={76 + Math.floor(index / columns) * 25}
      r="9"
      key={index}
      aria-hidden="true"
    />
  );

  return (
    <svg
      className="dm-ratio-picture"
      viewBox="0 0 560 225"
      role="img"
      aria-labelledby={`${id}-title ${id}-description`}
    >
      <title id={`${id}-title`}>Две сравниваемые группы</title>
      <desc id={`${id}-description`}>
        В первой группе {first.value} {unitLabel(first.unit)}, во второй — {second.value} {unitLabel(second.unit)}.
        {usesConvertedScale
          ? ' Полосы сравнивают величины после перевода в общую единицу.'
          : usesDots
            ? ' Точки условно показывают величину каждой группы.'
            : ' Общий визуальный масштаб появится после выбора величин одного вида.'}
      </desc>
      <rect className="dm-ratio-picture__panel dm-ratio-picture__panel--first" x="12" y="12" width="258" height="200" rx="18" />
      <rect className="dm-ratio-picture__panel dm-ratio-picture__panel--second" x="290" y="12" width="258" height="200" rx="18" />
      <text className="dm-ratio-picture__label" x="30" y="43">A · {first.value} {unitLabel(first.unit)}</text>
      <text className="dm-ratio-picture__label" x="308" y="43">B · {second.value} {unitLabel(second.unit)}</text>
      {convertedRatio ? (
        <>
          <rect className="dm-ratio-picture__bar-track" x="38" y="78" width="190" height="34" rx="10" />
          <rect className="dm-ratio-picture__bar dm-ratio-picture__bar--first" x="38" y="78" width={barWidth(convertedRatio.first)} height="34" rx="10" />
          <rect className="dm-ratio-picture__bar-track" x="316" y="78" width="190" height="34" rx="10" />
          <rect className="dm-ratio-picture__bar dm-ratio-picture__bar--second" x="316" y="78" width={barWidth(convertedRatio.second)} height="34" rx="10" />
          <text className="dm-ratio-picture__scale-note" x="30" y="154">в общем масштабе: {convertedRatio.first}</text>
          <text className="dm-ratio-picture__scale-note" x="308" y="154">в общем масштабе: {convertedRatio.second}</text>
        </>
      ) : usesDots ? (
        <>
          {Array.from({ length: first.value }, (_, index) => dot(index, 38, 'dm-ratio-dot--first'))}
          {Array.from({ length: second.value }, (_, index) => dot(index, 316, 'dm-ratio-dot--second'))}
          {first.value === 0 && <text className="dm-ratio-picture__empty" x="78" y="125">пустая группа</text>}
          {second.value === 0 && <text className="dm-ratio-picture__empty" x="356" y="125">пустая группа</text>}
        </>
      ) : (
        <text className="dm-ratio-picture__empty" x="280" y="126" textAnchor="middle">
          выбери величины одного вида
        </text>
      )}
    </svg>
  );
}

interface RatioCalculation {
  partToPart: Ratio;
  firstToWhole: Ratio;
  secondToWhole: Ratio;
}

interface Props {
  initialFirst?: number;
  initialSecond?: number;
  maxAmount?: number;
}

export default function RatioLab({ initialFirst = 6, initialSecond = 9, maxAmount = 30 }: Props) {
  const labId = useId();
  const requestedMaximum = Number.isFinite(maxAmount) ? Math.trunc(maxAmount) : 30;
  const maximum = Math.min(ABSOLUTE_MAX_AMOUNT, Math.max(10, requestedMaximum));
  const defaultFirst = safeAmount(initialFirst, 6, 0, maximum);
  const defaultSecond = safeAmount(initialSecond, 9, 1, maximum);
  const [firstValue, setFirstValue] = useState(defaultFirst);
  const [secondValue, setSecondValue] = useState(defaultSecond);
  const [firstUnit, setFirstUnit] = useState<MeasurementUnit>('piece');
  const [secondUnit, setSecondUnit] = useState<MeasurementUnit>('piece');

  const changeFirstUnit = (nextUnit: MeasurementUnit) => {
    setFirstUnit(nextUnit);
    if (nextUnit === 'piece') setFirstValue((value) => safeAmount(value, defaultFirst, 0, maximum));
  };

  const changeSecondUnit = (nextUnit: MeasurementUnit) => {
    setSecondUnit(nextUnit);
    if (nextUnit === 'piece') setSecondValue((value) => safeAmount(value, defaultSecond, 1, maximum));
  };

  const first = useMemo<Quantity>(() => ({ value: firstValue, unit: firstUnit }), [firstValue, firstUnit]);
  const second = useMemo<Quantity>(() => ({ value: secondValue, unit: secondUnit }), [secondValue, secondUnit]);
  const unitsAreCompatible = compatibleUnits(firstUnit, secondUnit);

  const calculation = useMemo<{ value?: RatioCalculation; error?: string }>(() => {
    if (!unitsAreCompatible) {
      return { error: 'Эти величины имеют разный смысл: сначала выбери единицы одного вида.' };
    }

    try {
      return {
        value: {
          partToPart: normalizeQuantityRatio(first, second),
          firstToWhole: normalizePartToWholeRatio(first, second),
          secondToWhole: normalizePartToWholeRatio(second, first),
        },
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Не удалось составить отношение.' };
    }
  }, [first, second, unitsAreCompatible]);

  const reset = () => {
    setFirstValue(defaultFirst);
    setSecondValue(defaultSecond);
    setFirstUnit('piece');
    setSecondUnit('piece');
  };

  const unitMessage = !unitsAreCompatible
    ? `Нельзя напрямую сравнить ${unitLabel(firstUnit)} и ${unitLabel(secondUnit)}: это величины разных видов.`
    : firstUnit !== secondUnit
      ? `Единицы разные, но совместимые. Перед сокращением лаборатория точно переводит обе величины в общую единицу.`
      : `Единицы совпадают — можно сравнивать сами количества.`;

  return (
    <section className="dm-lab dm-ratio-lab not-content" aria-labelledby={`${labId}-title`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Интерактивная лаборатория</p>
          <h3 className="dm-lab__title" id={`${labId}-title`}>Сравни две группы</h3>
          <p>Меняй количества и единицы: отношение покажет не разность, а во сколько раз соотносятся величины.</p>
        </div>
        <span className="dm-lab__badge">часть : часть : целое</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-lab__controls dm-ratio-controls">
          <AmountField
            id={`${labId}-first`}
            label="Группа A"
            colorName="first"
            value={firstValue}
            unit={firstUnit}
            minimum={0}
            maximum={firstUnit === 'piece' ? maximum : MAX_MEASUREMENT}
            onValueChange={setFirstValue}
            onUnitChange={changeFirstUnit}
          />
          <AmountField
            id={`${labId}-second`}
            label="Группа B"
            colorName="second"
            value={secondValue}
            unit={secondUnit}
            minimum={secondUnit === 'piece' ? 1 : 0.01}
            maximum={secondUnit === 'piece' ? maximum : MAX_MEASUREMENT}
            onValueChange={setSecondValue}
            onUnitChange={changeSecondUnit}
          />
        </div>

        <QuantityPicture id={`${labId}-picture`} first={first} second={second} />

        <p
          className={`dm-ratio-unit-note ${unitsAreCompatible ? '' : 'dm-ratio-unit-note--warning'}`}
        >
          <span aria-hidden="true">{unitsAreCompatible ? '↔' : '!'}</span>
          {unitMessage}
        </p>

        {calculation.value ? (
          <div className="dm-ratio-results" aria-live="polite" aria-atomic="true">
            <section className="dm-ratio-card dm-ratio-card--part">
              <p className="dm-ratio-card__eyebrow">часть к части</p>
              <h4>A : B</h4>
              <RatioValue value={calculation.value.partToPart} label="Отношение A к B" />
              <small>Сколько единиц A приходится на единицы B.</small>
            </section>
            <section className="dm-ratio-card dm-ratio-card--whole">
              <p className="dm-ratio-card__eyebrow">часть к целому</p>
              <h4>A : (A + B)</h4>
              <RatioValue value={calculation.value.firstToWhole} label="Отношение A к целому" />
              <small>Какую долю всего составляет первая часть.</small>
            </section>
            <section className="dm-ratio-card dm-ratio-card--whole">
              <p className="dm-ratio-card__eyebrow">часть к целому</p>
              <h4>B : (A + B)</h4>
              <RatioValue value={calculation.value.secondToWhole} label="Отношение B к целому" />
              <small>Какую долю всего составляет вторая часть.</small>
            </section>
          </div>
        ) : (
          <div className="dm-result dm-ratio-result--warning" role="alert">
            <span className="dm-result__symbol" aria-hidden="true">?</span>
            <p>
              <strong>Отношение пока не определено.</strong>
              <small>{calculation.error}</small>
            </p>
          </div>
        )}

        <div className="dm-result">
          <span className="dm-result__symbol" aria-hidden="true">÷</span>
          <p>
            <strong>Сокращаем оба члена одним и тем же делителем.</strong>
            <small>Порядок важен: A : B и B : A отвечают на разные вопросы.</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>
          ↺ Вернуть пример
        </button>
      </div>
    </section>
  );
}
