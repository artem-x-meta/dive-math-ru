import { useEffect, useId, useState } from 'react';

const DECIMAL_DRAFT = /^\d*(?:[.,]\d*)?$/;
const INTEGER_DRAFT = /^\d*$/;
const MIN_SCALE = 1;
const MAX_SCALE = 10_000_000;
const MIN_MAP_CM = 0.1;
const MAX_MAP_CM = 30;
const MIN_REAL_VALUE = 0.000001;
const MAX_REAL_VALUE = 1_000_000;

export type ScaleDirection = 'map-to-real' | 'real-to-map';
export type RealLengthUnit = 'cm' | 'm' | 'km';

const REAL_UNITS: Record<RealLengthUnit, { label: string; centimeters: number }> = {
  cm: { label: 'см', centimeters: 1 },
  m: { label: 'м', centimeters: 100 },
  km: { label: 'км', centimeters: 100_000 },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, precision = 8) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function parseDecimal(rawValue: string) {
  const normalized = rawValue.trim().replace(',', '.');
  if (normalized === '' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number) {
  return String(round(value)).replace('.', ',');
}

function safeScale(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 100_000;
  return Math.round(clamp(value, MIN_SCALE, MAX_SCALE));
}

function safeMapLength(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 3.5;
  return round(clamp(value, MIN_MAP_CM, MAX_MAP_CM));
}

interface DecimalFieldProps {
  id: string;
  label: string;
  unit: string;
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
    const next = parsed === null ? value : round(clamp(parsed, minimum, maximum));
    setDraft(formatNumber(next));
    onChange(next);
  };

  return (
    <div className="dm-field dm-ratio-field">
      <label htmlFor={id}>
        {label}, {unit} <span className="dm-field__value">{formatNumber(value)}</span>
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
      <small id={hintId}>Допустимо от {formatNumber(minimum)} до {formatNumber(maximum)} {unit}.</small>
    </div>
  );
}

interface ScaleFieldProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
}

function ScaleField({ id, value, onChange }: ScaleFieldProps) {
  const hintId = `${id}-hint`;
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const edit = (rawValue: string) => {
    if (!INTEGER_DRAFT.test(rawValue)) return;
    setDraft(rawValue);
    const parsed = Number(rawValue);
    if (rawValue !== '' && Number.isInteger(parsed) && parsed >= MIN_SCALE && parsed <= MAX_SCALE) onChange(parsed);
  };

  const commit = () => {
    const parsed = Number(draft);
    const next = draft === '' || !Number.isFinite(parsed)
      ? value
      : Math.round(clamp(parsed, MIN_SCALE, MAX_SCALE));
    setDraft(String(next));
    onChange(next);
  };

  return (
    <div className="dm-field dm-ratio-field">
      <label htmlFor={id}>
        Масштаб 1 : n <span className="dm-field__value">1 : {value}</span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={draft}
        aria-describedby={hintId}
        onChange={(event) => edit(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      <small id={hintId}>Целое n от {MIN_SCALE} до {MAX_SCALE}; 1 см на карте равен n см на местности.</small>
    </div>
  );
}

export interface ScaleLabProps {
  initialScale?: number;
  initialMapCm?: number;
  initialDirection?: ScaleDirection;
  initialRealUnit?: RealLengthUnit;
}

export default function ScaleLab({
  initialScale,
  initialMapCm,
  initialDirection = 'map-to-real',
  initialRealUnit = 'km',
}: ScaleLabProps) {
  const labId = useId();
  const startingScale = safeScale(initialScale);
  const startingMapCm = safeMapLength(initialMapCm);
  const safeDirection: ScaleDirection = initialDirection === 'real-to-map' ? 'real-to-map' : 'map-to-real';
  const safeUnit: RealLengthUnit = initialRealUnit in REAL_UNITS ? initialRealUnit : 'km';
  const [direction, setDirection] = useState<ScaleDirection>(safeDirection);
  const [scale, setScale] = useState(startingScale);
  const [mapCm, setMapCm] = useState(startingMapCm);
  const [realCm, setRealCm] = useState(() => startingMapCm * startingScale);
  const [realUnit, setRealUnit] = useState<RealLengthUnit>(safeUnit);
  const unitDefinition = REAL_UNITS[realUnit];
  const realValue = round(realCm / unitDefinition.centimeters);

  const updateScale = (nextScale: number) => {
    setScale(nextScale);
    if (direction === 'map-to-real') {
      setRealCm(round(mapCm * nextScale));
    } else {
      setMapCm(round(realCm / nextScale));
    }
  };

  const updateMapLength = (nextMapCm: number) => {
    setMapCm(nextMapCm);
    setRealCm(round(nextMapCm * scale));
  };

  const updateRealLength = (nextRealValue: number) => {
    const nextRealCm = round(nextRealValue * unitDefinition.centimeters);
    setRealCm(nextRealCm);
    setMapCm(round(nextRealCm / scale));
  };

  const conversionText = direction === 'map-to-real'
    ? `${formatNumber(mapCm)} см · ${scale} = ${formatNumber(realCm)} см = ${formatNumber(realValue)} ${unitDefinition.label}`
    : `${formatNumber(realValue)} ${unitDefinition.label} = ${formatNumber(realCm)} см; ${formatNumber(realCm)} см : ${scale} = ${formatNumber(mapCm)} см`;

  return (
    <section className="dm-lab dm-ratio-scale-lab not-content" aria-labelledby={`${labId}-title`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория масштаба</p>
          <h3 className="dm-lab__title" id={`${labId}-title`}>От карты к местности и обратно</h3>
          <p>Масштаб 1 : n означает: каждому 1 см на карте соответствуют n см в действительности.</p>
        </div>
        <span className="dm-lab__badge">1 : {scale}</span>
      </header>

      <div className="dm-lab__body">
        <fieldset className="dm-ratio-direction">
          <legend>Направление пересчёта</legend>
          <label className="dm-ratio-direction__option">
            <input
              type="radio"
              name={`${labId}-direction`}
              value="map-to-real"
              checked={direction === 'map-to-real'}
              onChange={() => setDirection('map-to-real')}
            />
            С карты на местность
          </label>
          <label className="dm-ratio-direction__option">
            <input
              type="radio"
              name={`${labId}-direction`}
              value="real-to-map"
              checked={direction === 'real-to-map'}
              onChange={() => setDirection('real-to-map')}
            />
            С местности на карту
          </label>
        </fieldset>

        <div className="dm-lab__controls dm-ratio-controls">
          <ScaleField id={`${labId}-scale`} value={scale} onChange={updateScale} />
          {direction === 'map-to-real' ? (
            <DecimalField
              id={`${labId}-map-length`}
              label="Длина на карте"
              unit="см"
              value={mapCm}
              minimum={Math.min(MIN_MAP_CM, mapCm)}
              maximum={Math.max(MAX_MAP_CM, mapCm)}
              onChange={updateMapLength}
            />
          ) : (
            <DecimalField
              id={`${labId}-real-length`}
              label="Длина на местности"
              unit={unitDefinition.label}
              value={realValue}
              minimum={Math.min(MIN_REAL_VALUE, realValue)}
              maximum={Math.max(MAX_REAL_VALUE, realValue)}
              onChange={updateRealLength}
            />
          )}
          <div className="dm-field dm-ratio-field">
            <label htmlFor={`${labId}-real-unit`}>Единица длины на местности</label>
            <select
              id={`${labId}-real-unit`}
              value={realUnit}
              onChange={(event) => setRealUnit(event.target.value as RealLengthUnit)}
            >
              {Object.entries(REAL_UNITS).map(([unit, definition]) => (
                <option value={unit} key={unit}>{definition.label}</option>
              ))}
            </select>
            <small>На карте длина всегда задана в сантиметрах.</small>
          </div>
        </div>

        <div className="dm-ratio-scale-equivalence">
          <strong>1 см на карте</strong>
          <span aria-hidden="true">↔</span>
          <strong>{formatNumber(scale / unitDefinition.centimeters)} {unitDefinition.label} на местности</strong>
        </div>

        <svg
          className="dm-ratio-ruler"
          viewBox="0 0 520 205"
          role="img"
          aria-labelledby={`${labId}-ruler-title ${labId}-ruler-desc`}
        >
          <title id={`${labId}-ruler-title`}>Соответствующие отрезки на карте и на местности</title>
          <desc id={`${labId}-ruler-desc`}>
            Отрезок длиной {formatNumber(mapCm)} сантиметра на карте соответствует {formatNumber(realValue)} {unitDefinition.label} на местности при масштабе один к {scale}. Отрезки нарисованы одинаковой ширины, чтобы показать соответствие, а не физический размер.
          </desc>
          <g aria-hidden="true">
            <text className="dm-ratio-ruler__heading" x="36" y="24">на карте</text>
            <line className="dm-ratio-ruler__line dm-ratio-ruler__line--map" x1="42" y1="58" x2="478" y2="58" />
            {Array.from({ length: 11 }, (_, index) => {
              const tickX = 42 + (436 * index) / 10;
              const tickHeight = index === 0 || index === 10 ? 18 : index === 5 ? 14 : 9;
              return <line className="dm-ratio-ruler__tick" x1={tickX} y1={58 - tickHeight / 2} x2={tickX} y2={58 + tickHeight / 2} key={`map-${index}`} />;
            })}
            <text className="dm-ratio-ruler__value" x="42" y="86">0</text>
            <text className="dm-ratio-ruler__value" x="478" y="86" textAnchor="end">{formatNumber(mapCm)} см</text>

            <path className="dm-ratio-ruler__connector" d="M 250 92 L 250 116 M 244 110 L 250 116 L 256 110" />

            <text className="dm-ratio-ruler__heading" x="36" y="138">на местности</text>
            <line className="dm-ratio-ruler__line dm-ratio-ruler__line--real" x1="42" y1="169" x2="478" y2="169" />
            {Array.from({ length: 11 }, (_, index) => {
              const tickX = 42 + (436 * index) / 10;
              const tickHeight = index === 0 || index === 10 ? 18 : index === 5 ? 14 : 9;
              return <line className="dm-ratio-ruler__tick" x1={tickX} y1={169 - tickHeight / 2} x2={tickX} y2={169 + tickHeight / 2} key={`real-${index}`} />;
            })}
            <text className="dm-ratio-ruler__value" x="42" y="198">0</text>
            <text className="dm-ratio-ruler__value" x="478" y="198" textAnchor="end">{formatNumber(realValue)} {unitDefinition.label}</text>
          </g>
        </svg>

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">↔</span>
          <p>
            <strong>{conversionText}.</strong>
            <small>{direction === 'map-to-real' ? 'Измерение на карте умножаем на знаменатель масштаба.' : 'Сначала переводим реальную длину в сантиметры, затем делим на знаменатель масштаба.'}</small>
          </p>
        </div>
      </div>
    </section>
  );
}
