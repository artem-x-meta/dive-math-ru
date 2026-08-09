import { useEffect, useId, useMemo, useState } from 'react';
import {
  formatRadical,
  multiplyRadicals,
  pairPrimeFactors,
  simplifyRadical,
  type Radical,
} from '../lib/roots';

export type RootSimplifyLabMode = 'simplify' | 'product';

export interface RootSimplifyLabProps {
  mode?: RootSimplifyLabMode;
  initialValue?: number;
  initialFirst?: number;
  initialSecond?: number;
  challenge?: boolean;
}

const MODES: readonly RootSimplifyLabMode[] = ['simplify', 'product'];
const MODE_LABELS: Readonly<Record<RootSimplifyLabMode, string>> = {
  simplify: 'Вынести множитель',
  product: 'Корень произведения',
};
const MIN_VALUE = 2;
const MAX_VALUE = 10_000;
const MAX_FACTOR = 400;
const MESH_LIMIT = 30;
const INTEGER_DRAFT = /^\d{0,5}$/;

function safeMode(value: RootSimplifyLabMode | undefined): RootSimplifyLabMode {
  return value !== undefined && MODES.includes(value) ? value : 'simplify';
}

function safeInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.trunc(value);
  return rounded >= MIN_VALUE && rounded <= maximum ? rounded : fallback;
}

/** Наибольший квадратный делитель числа: n = square · rest. */
function largestSquareDivisor(value: number): number {
  const { coefficient } = simplifyRadical(value);
  return coefficient * coefficient;
}

/** Согласование существительного «квадратик» с числом. */
function cellWord(count: number): string {
  const tail = count % 100;
  if (tail >= 11 && tail <= 14) return 'квадратиков';
  const last = count % 10;
  if (last === 1) return 'квадратик';
  if (last >= 2 && last <= 4) return 'квадратика';
  return 'квадратиков';
}

interface IntegerFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly maximum: number;
  readonly onChange: (value: number) => void;
}

function IntegerField({ id, label, value, maximum, onChange }: IntegerFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  const bound = (next: number) => Math.min(maximum, Math.max(MIN_VALUE, next));

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>
        {label}
        <span className="dm-field__value">{value}</span>
      </label>
      <div className="dm-geometry-field__control">
        <button type="button" onClick={() => onChange(bound(value - 1))} disabled={value <= MIN_VALUE} aria-label={`Уменьшить: ${label.toLowerCase()}`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => setEditing(true)}
          onChange={(event) => {
            const raw = event.target.value.trim();
            if (!INTEGER_DRAFT.test(raw)) return;
            setDraft(raw);
            const parsed = Number(raw);
            if (raw !== '' && Number.isInteger(parsed) && parsed >= MIN_VALUE && parsed <= maximum) onChange(parsed);
          }}
          onBlur={() => {
            const parsed = Number(draft);
            const next = draft === '' || !Number.isInteger(parsed) ? value : bound(parsed);
            setDraft(String(next));
            onChange(next);
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        <button type="button" onClick={() => onChange(bound(value + 1))} disabled={value >= maximum} aria-label={`Увеличить: ${label.toLowerCase()}`}>+</button>
      </div>
      <small id={`${id}-hint`}>Целое число от {MIN_VALUE} до {maximum}</small>
    </div>
  );
}

interface SplitPictureProps {
  readonly id: string;
  readonly value: number;
  readonly radical: Radical;
  readonly reveal: boolean;
}

function SplitPicture({ id, value, radical, reveal }: SplitPictureProps) {
  const parts = radical.coefficient;
  const cellArea = radical.radicand;
  const originX = 168;
  const originY = 300;
  const sidePixels = 232;
  const cellPixels = sidePixels / parts;
  const mesh = parts <= MESH_LIMIT ? Array.from({ length: parts + 1 }, (_, index) => index) : [];

  return (
    <svg className="dm-geometry-figure" viewBox="0 0 560 350" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{`Квадрат площади ${value}, разрезанный на равные квадратики`}</title>
      <desc id={`${id}-desc`}>
        Квадрат площадью {value} разрезан на {parts} рядов по {parts} одинаковых квадратиков.
        Площадь каждого квадратика равна {cellArea}, поэтому его сторона равна корню из {cellArea}.
        {reveal
          ? ` Сторона большого квадрата содержит ${parts} таких отрезков: √${value} = ${formatRadical(radical)}.`
          : ' Итоговая запись скрыта до проверки.'}
      </desc>

      {mesh.length > 0 && (
        <g className="dm-geometry-grid__mesh" aria-hidden="true">
          {mesh.map((step) => (
            <line key={`v-${step}`} x1={originX + step * cellPixels} y1={originY - sidePixels} x2={originX + step * cellPixels} y2={originY} />
          ))}
          {mesh.map((step) => (
            <line key={`h-${step}`} x1={originX} y1={originY - step * cellPixels} x2={originX + sidePixels} y2={originY - step * cellPixels} />
          ))}
        </g>
      )}

      <rect className="dm-geometry-figure__shape" x={originX} y={originY - sidePixels} width={sidePixels} height={sidePixels} />

      {parts > 1 && (
        <rect
          className="dm-geometry-figure__completion"
          x={originX}
          y={originY - cellPixels}
          width={cellPixels}
          height={cellPixels}
        />
      )}

      <g className="dm-geometry-figure__dimensions">
        <line x1={originX} y1={originY + 26} x2={originX + sidePixels} y2={originY + 26} />
        <text x={originX + sidePixels / 2} y={originY + 50}>{reveal ? `сторона = ${formatRadical(radical)}` : 'сторона = ?'}</text>
        <text x={280} y={36}>площадь {value} = {parts * parts} · {cellArea}</text>
        <text x={280} y={62}>{parts * parts} {cellWord(parts * parts)} площадью {cellArea}; сторона каждого √{cellArea}</text>
        <line x1={originX - 26} y1={originY} x2={originX - 26} y2={originY - cellPixels} />
        <text x={originX - 74} y={originY - cellPixels / 2 + 6}>√{cellArea}</text>
      </g>
    </svg>
  );
}

interface ProductPictureProps {
  readonly id: string;
  readonly first: number;
  readonly second: number;
  readonly radical: Radical;
  readonly reveal: boolean;
}

function ProductPicture({ id, first, second, radical, reveal }: ProductPictureProps) {
  const product = first * second;
  const { extracted, remaining } = pairPrimeFactors(product);
  const tokens: Array<{ readonly prime: number; readonly paired: boolean }> = [
    ...extracted.flatMap((prime) => [
      { prime, paired: true },
      { prime, paired: true },
    ]),
    ...remaining.map((prime) => ({ prime, paired: false })),
  ];
  const count = Math.max(tokens.length, 1);
  const available = 540;
  const size = Math.max(24, Math.min(54, available / count - 8));
  const gap = size / 5;
  const totalWidth = count * size + (count - 1) * gap;
  const startX = 310 - totalWidth / 2;
  const tokenY = 150;
  const tokenX = (index: number) => startX + index * (size + gap);

  return (
    <svg className="dm-geometry-figure" viewBox="0 0 620 300" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Простые множители произведения, разбитые на пары</title>
      <desc id={`${id}-desc`}>
        Произведение подкоренных чисел равно {product}. Его простые множители выписаны подряд;
        одинаковые множители объединяются в пары, и из каждой пары одно число выходит из-под корня.
        {reveal
          ? ` Пар получилось ${extracted.length}, без пары осталось множителей: ${remaining.length}. Ответ: ${formatRadical(radical)}.`
          : ' Разбиение на пары и ответ скрыты до проверки.'}
      </desc>

      <g className="dm-geometry-figure__dimensions">
        <text x={310} y={44}>√{first} · √{second} = √{product}</text>
        <text x={310} y={78}>
          {product} = {tokens.length === 0 ? '1' : tokens.map((token) => token.prime).join(' · ')}
        </text>
      </g>

      {reveal && extracted.map((prime, index) => (
        <rect
          key={`pair-${index}`}
          className="dm-geometry-figure__completion"
          x={tokenX(index * 2) - 6}
          y={tokenY - 6}
          width={2 * size + gap + 12}
          height={size + 12}
          rx={10}
        />
      ))}

      {tokens.map((token, index) => (
        <rect
          key={`token-${index}`}
          className="dm-geometry-figure__shape"
          x={tokenX(index)}
          y={tokenY}
          width={size}
          height={size}
          rx={8}
        />
      ))}

      <g className="dm-geometry-figure__dimensions">
        {tokens.map((token, index) => (
          <text key={`value-${index}`} x={tokenX(index) + size / 2} y={tokenY + size / 2 + 7}>{token.prime}</text>
        ))}
        {reveal && extracted.map((prime, index) => (
          <text key={`out-${index}`} x={tokenX(index * 2) + size + gap / 2} y={tokenY - 22}>↑ {prime}</text>
        ))}
        {reveal && (
          <text x={310} y={tokenY + size + 62}>
            выходит {formatRadical({ coefficient: radical.coefficient, radicand: 1 })}, под корнем остаётся {radical.radicand}
          </text>
        )}
      </g>
    </svg>
  );
}

export default function RootSimplifyLab({
  mode,
  initialValue,
  initialFirst,
  initialSecond,
  challenge = false,
}: RootSimplifyLabProps) {
  const reactId = useId();
  const labId = `root-simplify-${reactId.replace(/:/g, '')}`;
  const defaultMode = safeMode(mode);
  const defaultValue = safeInteger(initialValue, 72, MAX_VALUE);
  const defaultFirst = safeInteger(initialFirst, 6, MAX_FACTOR);
  const defaultSecond = safeInteger(initialSecond, 8, MAX_FACTOR);

  const [activeMode, setActiveMode] = useState(defaultMode);
  const [value, setValue] = useState(defaultValue);
  const [first, setFirst] = useState(defaultFirst);
  const [second, setSecond] = useState(defaultSecond);
  const [coefficientAnswer, setCoefficientAnswer] = useState('');
  const [radicandAnswer, setRadicandAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const radical = useMemo(
    () => (activeMode === 'simplify'
      ? simplifyRadical(value)
      : multiplyRadicals({ coefficient: 1, radicand: first }, { coefficient: 1, radicand: second })),
    [activeMode, value, first, second],
  );
  const product = first * second;
  const square = largestSquareDivisor(activeMode === 'simplify' ? value : product);
  const rest = (activeMode === 'simplify' ? value : product) / square;

  const answerIsCorrect = Number(coefficientAnswer) === radical.coefficient
    && Number(radicandAnswer) === radical.radicand
    && coefficientAnswer !== ''
    && radicandAnswer !== '';
  const answerIsReady = coefficientAnswer !== '' && radicandAnswer !== '';
  const reveal = !challenge || checked;

  const invalidate = <T,>(setter: (next: T) => void) => (next: T) => {
    setter(next);
    setChecked(false);
  };
  const reset = () => {
    setActiveMode(defaultMode);
    setValue(defaultValue);
    setFirst(defaultFirst);
    setSecond(defaultSecond);
    setCoefficientAnswer('');
    setRadicandAnswer('');
    setChecked(false);
  };

  const sourceText = activeMode === 'simplify' ? `√${value}` : `√${first} · √${second}`;
  const chain = activeMode === 'simplify'
    ? `√${value} = √(${square} · ${rest}) = √${square} · √${rest} = ${formatRadical(radical)}`
    : `√${first} · √${second} = √${product} = √(${square} · ${rest}) = ${formatRadical(radical)}`;

  const result = (() => {
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: `Приведи ${sourceText} к простейшему виду.`,
        detail: 'Найди наибольший квадратный делитель подкоренного числа, вынеси его корень и запиши ответ в двух полях.',
      };
    }
    if (challenge) {
      return {
        symbol: answerIsCorrect ? '✓' : '×',
        headline: answerIsCorrect ? `Верно: ${sourceText} = ${formatRadical(radical)}.` : `Простейший вид: ${formatRadical(radical)}.`,
        detail: chain,
      };
    }
    if (radical.radicand === 1) {
      return {
        symbol: '√',
        headline: `${sourceText} = ${formatRadical(radical)} — корень извлекается точно.`,
        detail: chain,
      };
    }
    return {
      symbol: '√',
      headline: `${sourceText} = ${formatRadical(radical)}.`,
      detail: `${chain}. Проверка внесением множителя: ${radical.coefficient}² · ${radical.radicand} = ${radical.coefficient * radical.coefficient * radical.radicand}.`,
    };
  })();

  return (
    <section className="dm-lab dm-geometry-figure-measure not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория преобразований</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Вынесение множителя и корень произведения</h3>
          <p>Квадратный делитель под корнем — это разрезание квадрата на одинаковые квадратики. Их количество и выходит наружу.</p>
        </div>
        <span className="dm-lab__badge">√ab = √a · √b</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Режим лаборатории преобразований">
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
          {activeMode === 'simplify' ? (
            <IntegerField id={`${labId}-value`} label="Число под корнем" value={value} maximum={MAX_VALUE} onChange={invalidate(setValue)} />
          ) : (
            <>
              <IntegerField id={`${labId}-first`} label="Первое число" value={first} maximum={MAX_FACTOR} onChange={invalidate(setFirst)} />
              <IntegerField id={`${labId}-second`} label="Второе число" value={second} maximum={MAX_FACTOR} onChange={invalidate(setSecond)} />
            </>
          )}
        </div>

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемая схема преобразования корня" tabIndex={0}>
          {activeMode === 'simplify' ? (
            <SplitPicture id={`${labId}-split`} value={value} radical={radical} reveal={reveal} />
          ) : (
            <ProductPicture id={`${labId}-product`} first={first} second={second} radical={radical} reveal={reveal} />
          )}
        </div>

        {challenge && (
          <div className="dm-geometry-answer-grid">
            <div className="dm-field dm-geometry-answer-field">
              <label htmlFor={`${labId}-coefficient`}>Множитель перед корнем</label>
              <input
                id={`${labId}-coefficient`}
                type="text"
                inputMode="numeric"
                value={coefficientAnswer}
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  if (!INTEGER_DRAFT.test(raw)) return;
                  setCoefficientAnswer(raw);
                  setChecked(false);
                }}
              />
            </div>
            <div className="dm-field dm-geometry-answer-field">
              <label htmlFor={`${labId}-radicand`}>Число под корнем</label>
              <input
                id={`${labId}-radicand`}
                type="text"
                inputMode="numeric"
                value={radicandAnswer}
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  if (!INTEGER_DRAFT.test(raw)) return;
                  setRadicandAnswer(raw);
                  setChecked(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && answerIsReady) {
                    event.preventDefault();
                    setChecked(true);
                  }
                }}
              />
            </div>
            <button className="dm-button" type="button" disabled={!answerIsReady} onClick={() => setChecked(true)}>
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
