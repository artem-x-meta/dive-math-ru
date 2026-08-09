import { useEffect, useId, useMemo, useState } from 'react';
import {
  estimateSquareRoot,
  exactSquareRoot,
  formatDecimalRussian,
  type SquareRootEstimate,
} from '../lib/roots';

export type RootLabMode = 'square' | 'estimate';

export interface RootLabProps {
  mode?: RootLabMode;
  initialValue?: number | string;
  initialDigits?: number;
  challenge?: boolean;
}

const MODES: readonly RootLabMode[] = ['square', 'estimate'];
const MODE_LABELS: Readonly<Record<RootLabMode, string>> = {
  square: 'Квадрат по площади',
  estimate: 'Зажим корня',
};
const DIGIT_OPTIONS: readonly number[] = [0, 1, 2, 3];
const DIGIT_LABELS: readonly string[] = ['целые', 'десятые', 'сотые', 'тысячные'];
const DIGIT_CASES: readonly string[] = ['целых', 'десятых', 'сотых', 'тысячных'];
const MIN_VALUE = 0.01;
const MAX_VALUE = 10_000;
const VALUE_DRAFT = /^\d*(?:[.,]\d{0,4})?$/;
const ANSWER_DRAFT = /^\d*(?:[.,]\d{0,6})?$/;
const MESH_LIMIT = 20;

function safeMode(value: RootLabMode | undefined): RootLabMode {
  return value !== undefined && MODES.includes(value) ? value : 'square';
}

function safeDigits(value: number | undefined): number {
  return typeof value === 'number' && DIGIT_OPTIONS.includes(Math.trunc(value)) ? Math.trunc(value) : 2;
}

/** Приводит пользовательскую запись к служебной форме с точкой либо сообщает о непригодности. */
function normalizeDecimal(raw: string): string | null {
  const source = String(raw).trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(source)) return null;
  const [integerPart, fractionPart = ''] = source.split('.');
  const trimmed = fractionPart.replace(/0+$/, '');
  const normalized = `${BigInt(integerPart)}${trimmed === '' ? '' : `.${trimmed}`}`;
  return normalized;
}

function safeValue(raw: number | string | undefined, fallback: string): string {
  const normalized = normalizeDecimal(raw === undefined ? fallback : String(raw));
  if (normalized === null) return fallback;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < MIN_VALUE || numeric > MAX_VALUE) return fallback;
  return normalized;
}

function display(text: string): string {
  return formatDecimalRussian(text);
}

interface ValueFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

function ValueField({ id, label, hint, value, onChange }: ValueFieldProps) {
  const [draft, setDraft] = useState(display(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(display(value));
  }, [editing, value]);

  const commit = (raw: string) => {
    const normalized = normalizeDecimal(raw);
    if (normalized === null) {
      setDraft(display(value));
      return;
    }
    const numeric = Number(normalized);
    const bounded = Math.min(MAX_VALUE, Math.max(MIN_VALUE, numeric));
    const next = bounded === numeric ? normalized : String(bounded);
    setDraft(display(next));
    onChange(next);
  };

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>
        {label}
        <span className="dm-field__value">{display(value)}</span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-describedby={`${id}-hint`}
        onFocus={() => setEditing(true)}
        onChange={(event) => {
          const raw = event.target.value.slice(0, 12);
          if (!VALUE_DRAFT.test(raw)) return;
          setDraft(raw);
          const normalized = normalizeDecimal(raw);
          if (normalized === null) return;
          const numeric = Number(normalized);
          if (numeric >= MIN_VALUE && numeric <= MAX_VALUE) onChange(normalized);
        }}
        onBlur={(event) => {
          commit(event.currentTarget.value);
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

interface SquarePictureProps {
  readonly id: string;
  readonly value: string;
  readonly estimate: SquareRootEstimate;
  readonly exact: string | null;
  readonly reveal: boolean;
}

function SquarePicture({ id, value, estimate, exact, reveal }: SquarePictureProps) {
  const side = Number(estimateSquareRoot(value, 6).lower);
  const inner = Math.floor(side);
  const outer = Math.max(1, Math.ceil(side));
  const originX = 150;
  const originY = 286;
  const maxPixels = 214;
  const scale = maxPixels / outer;
  const sidePixels = side * scale;
  const outerPixels = outer * scale;
  const innerPixels = inner * scale;
  const mesh = outer <= MESH_LIMIT ? Array.from({ length: outer + 1 }, (_, index) => index) : [];
  const sideText = reveal
    ? exact === null
      ? `a ≈ ${display(estimate.lower)}`
      : `a = ${display(exact)}`
    : 'a = ?';

  return (
    <svg className="dm-geometry-figure" viewBox="0 0 560 340" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Квадрат заданной площади на единичной сетке</title>
      <desc id={`${id}-desc`}>
        Сторона квадрата построена в масштабе и равна корню из площади {display(value)}.
        Клетки сетки единичные; пунктирная рамка — квадрат со стороной {outer} и площадью {outer * outer}.
        {inner >= 1 ? ` Внутренний штриховой контур — квадрат со стороной ${inner} и площадью ${inner * inner}.` : ''}
        {reveal
          ? ` Сторона равна ${exact === null ? `примерно ${display(estimate.lower)}` : display(exact)}.`
          : ' Числовое значение стороны скрыто до проверки.'}
      </desc>

      {mesh.length > 0 && (
        <g className="dm-geometry-grid__mesh" aria-hidden="true">
          {mesh.map((step) => (
            <line key={`v-${step}`} x1={originX + step * scale} y1={originY - outerPixels} x2={originX + step * scale} y2={originY} />
          ))}
          {mesh.map((step) => (
            <line key={`h-${step}`} x1={originX} y1={originY - step * scale} x2={originX + outerPixels} y2={originY - step * scale} />
          ))}
        </g>
      )}

      <rect
        className="dm-geometry-figure__completion"
        x={originX}
        y={originY - outerPixels}
        width={outerPixels}
        height={outerPixels}
      />

      {inner >= 1 && (
        <g className="dm-geometry-figure__construction" aria-hidden="true">
          <line x1={originX} y1={originY - innerPixels} x2={originX + innerPixels} y2={originY - innerPixels} />
          <line x1={originX + innerPixels} y1={originY - innerPixels} x2={originX + innerPixels} y2={originY} />
        </g>
      )}

      <rect
        className="dm-geometry-figure__shape"
        x={originX}
        y={originY - sidePixels}
        width={sidePixels}
        height={sidePixels}
      />

      <g className="dm-geometry-figure__dimensions">
        <line x1={originX} y1={originY + 26} x2={originX + sidePixels} y2={originY + 26} />
        <text x={originX + sidePixels / 2} y={originY + 50}>{sideText}</text>
        <text x={originX + sidePixels / 2} y={originY - sidePixels / 2 + 7}>S = {display(value)}</text>
        {reveal && <text x={280} y={40}>сторона между {inner} и {outer}</text>}
      </g>
    </svg>
  );
}

interface NumberLinePictureProps {
  readonly id: string;
  readonly value: string;
  readonly digits: number;
  readonly estimate: SquareRootEstimate;
  readonly reveal: boolean;
}

function NumberLinePicture({ id, value, digits, estimate, reveal }: NumberLinePictureProps) {
  const width = 10 ** (1 - digits);
  const start = digits === 0
    ? Math.floor(Number(estimateSquareRoot(value, 0).lower) / 10) * 10
    : Number(estimateSquareRoot(value, digits - 1).lower);
  const root = Number(estimateSquareRoot(value, 6).lower);
  const axisLeft = 60;
  const axisRight = 580;
  const axisY = 128;
  const span = axisRight - axisLeft;
  const position = (point: number) => axisLeft + ((point - start) / width) * span;
  const lower = Number(estimate.lower);
  const upper = Number(estimate.upper);
  const ticks = Array.from({ length: 11 }, (_, index) => start + (width * index) / 10);
  const tickLabel = (point: number) => display(point.toFixed(digits));

  return (
    <svg className="dm-geometry-figure" viewBox="0 0 640 210" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Числовая ось с зажимом корня</title>
      <desc id={`${id}-desc`}>
        Отрезок от {tickLabel(start)} до {tickLabel(start + width)} разбит на десять равных частей.
        {reveal
          ? estimate.exact
            ? ` Корень из ${display(value)} попадает точно в отметку ${display(estimate.lower)}.`
            : ` Корень из ${display(value)} лежит между ${display(estimate.lower)} и ${display(estimate.upper)}.`
          : ' Положение корня скрыто до проверки.'}
      </desc>

      {reveal && !estimate.exact && (
        <rect
          className="dm-geometry-figure__shape"
          x={position(lower)}
          y={axisY - 18}
          width={Math.max(position(upper) - position(lower), 2)}
          height={36}
        />
      )}

      <g className="dm-geometry-figure__dimensions">
        <line x1={axisLeft - 30} y1={axisY} x2={axisRight + 30} y2={axisY} />
        {ticks.map((point, index) => (
          <line
            key={`tick-${index}`}
            x1={position(point)}
            y1={axisY - (index % 5 === 0 ? 16 : 9)}
            x2={position(point)}
            y2={axisY + (index % 5 === 0 ? 16 : 9)}
          />
        ))}
        {ticks.map((point, index) => (index % 5 === 0
          ? <text key={`label-${index}`} x={position(point)} y={axisY + 44}>{tickLabel(point)}</text>
          : null))}
        {reveal && !estimate.exact && (
          <text x={(position(lower) + position(upper)) / 2} y={axisY - 34}>
            {display(estimate.lower)} … {display(estimate.upper)}
          </text>
        )}
      </g>

      {reveal && (
        <g className="dm-geometry-grid__point">
          <circle cx={position(root)} cy={axisY} r="9" />
          <text x={position(root)} y={axisY + 78} textAnchor="middle">√{display(value)}</text>
        </g>
      )}
    </svg>
  );
}

export default function RootLab({ mode, initialValue, initialDigits, challenge = false }: RootLabProps) {
  const reactId = useId();
  const labId = `root-lab-${reactId.replace(/:/g, '')}`;
  const defaultMode = safeMode(mode);
  const defaultValue = safeValue(initialValue, defaultMode === 'square' ? '20' : '2');
  const defaultDigits = safeDigits(initialDigits);

  const [activeMode, setActiveMode] = useState(defaultMode);
  const [value, setValue] = useState(defaultValue);
  const [digits, setDigits] = useState(defaultDigits);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const estimate = useMemo(() => estimateSquareRoot(value, digits), [value, digits]);
  const exact = useMemo(() => exactSquareRoot(value), [value]);
  const steps = useMemo(
    () => Array.from({ length: digits + 1 }, (_, index) => estimateSquareRoot(value, index)),
    [value, digits],
  );

  const normalizedAnswer = normalizeDecimal(answer);
  const answerIsCorrect = normalizedAnswer !== null && normalizedAnswer === normalizeDecimal(estimate.lower);
  const reveal = !challenge || checked;

  const changeValue = (next: string) => {
    setValue(next);
    setChecked(false);
  };
  const changeDigits = (next: number) => {
    setDigits(next);
    setChecked(false);
  };
  const reset = () => {
    setActiveMode(defaultMode);
    setValue(defaultValue);
    setDigits(defaultDigits);
    setAnswer('');
    setChecked(false);
  };

  const result = (() => {
    const bracketText = estimate.exact
      ? `${display(estimate.lower)}² = ${display(estimate.lowerSquare)} — корень извлекается точно.`
      : `${display(estimate.lower)}² = ${display(estimate.lowerSquare)} ≤ ${display(value)} ≤ ${display(estimate.upperSquare)} = ${display(estimate.upper)}².`;

    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: activeMode === 'square'
          ? `Оцени сторону квадрата площадью ${display(value)}.`
          : `Зажми √${display(value)} с точностью до ${DIGIT_CASES[digits]}.`,
        detail: 'Запиши приближение с недостатком — наибольшее число нужного разряда, квадрат которого не больше подкоренного числа. Затем нажми «Проверить».',
      };
    }
    if (challenge) {
      return {
        symbol: answerIsCorrect ? '✓' : '×',
        headline: answerIsCorrect
          ? `Верно: приближение с недостатком равно ${display(estimate.lower)}.`
          : `Приближение с недостатком равно ${display(estimate.lower)}.`,
        detail: bracketText,
      };
    }
    if (exact !== null) {
      return {
        symbol: '√',
        headline: `√${display(value)} = ${display(exact)} — корень извлекается точно.`,
        detail: `Проверка: ${display(exact)} · ${display(exact)} = ${display(value)}.`,
      };
    }
    return {
      symbol: '√',
      headline: `√${display(value)} ≈ ${display(estimate.lower)} с недостатком и ≈ ${display(estimate.upper)} с избытком.`,
      detail: `${bracketText} Точное значение — бесконечная непериодическая дробь, поэтому знак ≈ обязателен.`,
    };
  })();

  return (
    <section className="dm-lab dm-geometry-figure-measure not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория квадратного корня</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Площадь, сторона и зажим корня</h3>
          <p>Корень из числа — это сторона квадрата такой площади. Найти её точно удаётся не всегда, зажать между двумя числами — всегда.</p>
        </div>
        <span className="dm-lab__badge">√{display(value)}</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Режим лаборатории корня">
          {MODES.map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={activeMode === item}
              className={activeMode === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
              onClick={() => {
                setActiveMode(item);
                setChecked(false);
              }}
            >
              {MODE_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-geometry-controls">
          <ValueField
            id={`${labId}-value`}
            label={activeMode === 'square' ? 'Площадь квадрата' : 'Число под корнем'}
            hint={`От ${display(String(MIN_VALUE))} до ${MAX_VALUE}; можно вводить десятичную дробь.`}
            value={value}
            onChange={changeValue}
          />
        </div>

        <div className="dm-geometry-preset-buttons" role="group" aria-label="Точность приближения">
          {DIGIT_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              aria-pressed={digits === option}
              className={digits === option ? 'dm-geometry-preset-button dm-geometry-preset-button--active' : 'dm-geometry-preset-button'}
              onClick={() => changeDigits(option)}
            >
              До {DIGIT_CASES[option]}
            </button>
          ))}
        </div>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемая схема лаборатории корня" tabIndex={0}>
          {activeMode === 'square' ? (
            <SquarePicture id={`${labId}-square`} value={value} estimate={estimate} exact={exact} reveal={reveal} />
          ) : (
            <NumberLinePicture id={`${labId}-line`} value={value} digits={digits} estimate={estimate} reveal={reveal} />
          )}
        </div>

        {reveal && (
          <div className="dm-ratio-table-wrap">
            <table className="dm-ratio-table">
              <caption>Уточнение корня разряд за разрядом: квадрат нижней границы не больше подкоренного числа, квадрат верхней — не меньше.</caption>
              <thead>
                <tr>
                  <th scope="col">Разряд</th>
                  <th scope="col">Снизу</th>
                  <th scope="col">Квадрат снизу</th>
                  <th scope="col">Сверху</th>
                  <th scope="col">Квадрат сверху</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, index) => (
                  <tr key={step.digits} className={index === digits ? 'dm-ratio-table__current' : ''}>
                    <th scope="row">{DIGIT_LABELS[step.digits]}</th>
                    <td>{display(step.lower)}</td>
                    <td>{display(step.lowerSquare)}</td>
                    <td>{display(step.upper)}</td>
                    <td>{display(step.upperSquare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {challenge && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>Приближение с недостатком</label>
            <input
              id={`${labId}-answer`}
              type="text"
              inputMode="decimal"
              value={answer}
              onChange={(event) => {
                const raw = event.target.value.slice(0, 16);
                if (!ANSWER_DRAFT.test(raw)) return;
                setAnswer(raw);
                setChecked(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && normalizedAnswer !== null) {
                  event.preventDefault();
                  setChecked(true);
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setAnswer('');
                  setChecked(false);
                }
              }}
            />
            <button className="dm-button" type="button" disabled={normalizedAnswer === null} onClick={() => setChecked(true)}>
              Проверить
            </button>
          </div>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span>
          <p>
            <strong>{result.headline}</strong>
            <small>{result.detail}</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
