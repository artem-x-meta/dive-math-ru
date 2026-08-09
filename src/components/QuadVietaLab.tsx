import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  checkVietaPair,
  describeRoot,
  discriminant,
  factorPairs,
  integerRootPair,
  monicFromRoots,
  solveQuadratic,
} from '../lib/quadratics';

export type QuadVietaMode = 'find' | 'build';

export interface QuadVietaLabProps {
  /** Вкладка, открытая при загрузке. */
  mode?: QuadVietaMode;
  initialP?: number;
  initialQ?: number;
  initialFirstRoot?: number;
  initialSecondRoot?: number;
  /** Режим задачи: таблица делителей и ответ скрыты до нажатия «Проверить». */
  challenge?: boolean;
}

const P_LIMIT = 20;
const Q_LIMIT = 48;
const ROOT_LIMIT = 12;
const DRAFT_PATTERN = /^[+\-−]?\d*$/;
const MAX_DRAFT_LENGTH = 4;

function clampInteger(value: number, limit: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(limit, Math.max(-limit, Math.trunc(value)));
}

function safeCoefficient(value: number | undefined, fallback: number, limit: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clampInteger(value, limit);
}

function parseDraft(rawValue: string): number | null {
  const normalized = rawValue.trim().replace('−', '-');
  if (normalized === '' || normalized === '-' || normalized === '+') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function num(value: number): string {
  return String(value).replace('-', '−');
}

/** Множитель (x − r) с уже упрощённым знаком: при r = 0 остаётся просто x. */
function rootFactor(root: number): string {
  if (root === 0) return 'x';
  return `(x ${root > 0 ? '−' : '+'} ${Math.abs(root)})`;
}

/** Запись приведённого уравнения x² + px + q = 0 без лишних единиц и нулей. */
export function monicText(p: number, q: number): string {
  const middle = p === 0 ? '' : ` ${p < 0 ? '−' : '+'} ${Math.abs(p) === 1 ? '' : Math.abs(p)}x`;
  const tail = q === 0 ? '' : ` ${q < 0 ? '−' : '+'} ${Math.abs(q)}`;
  return `x²${middle}${tail} = 0`;
}

interface IntegerFieldProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  limit: number;
  onChange: (value: number) => void;
}

function IntegerField({ id, label, hint, value, limit, onChange }: IntegerFieldProps) {
  const [draft, setDraft] = useState(num(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(num(value));
  }, [editing, value]);

  const commit = () => {
    const parsed = parseDraft(draft);
    const next = parsed === null ? value : clampInteger(parsed, limit);
    setDraft(num(next));
    onChange(next);
  };

  return (
    <div className="dm-field dm-signed-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{num(value)}</span>
      </label>
      <div className="dm-signed-field__control">
        <button
          type="button"
          className="dm-signed-field__step"
          onClick={() => onChange(clampInteger(value - 1, limit))}
          disabled={value <= -limit}
          aria-label={`Уменьшить ${label} на 1`}
        >
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          maxLength={MAX_DRAFT_LENGTH}
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => {
            cancelCommit.current = false;
            setEditing(true);
          }}
          onChange={(event) => {
            const raw = event.target.value;
            if (DRAFT_PATTERN.test(raw)) setDraft(raw);
          }}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              setDraft(num(value));
              setEditing(false);
              return;
            }
            commit();
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelCommit.current = true;
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          className="dm-signed-field__step"
          onClick={() => onChange(clampInteger(value + 1, limit))}
          disabled={value >= limit}
          aria-label={`Увеличить ${label} на 1`}
        >
          +
        </button>
      </div>
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

export default function QuadVietaLab({
  mode = 'find',
  initialP,
  initialQ,
  initialFirstRoot,
  initialSecondRoot,
  challenge = false,
}: QuadVietaLabProps) {
  const reactId = useId();
  const labId = `quad-vieta-${reactId.replace(/:/g, '')}`;

  const defaultP = safeCoefficient(initialP, -7, P_LIMIT);
  const defaultQ = safeCoefficient(initialQ, 12, Q_LIMIT);
  const defaultFirst = safeCoefficient(initialFirstRoot, 3, ROOT_LIMIT);
  const defaultSecond = safeCoefficient(initialSecondRoot, -5, ROOT_LIMIT);

  const [activeMode, setActiveMode] = useState<QuadVietaMode>(mode);
  const [p, setP] = useState(defaultP);
  const [q, setQ] = useState(defaultQ);
  const [firstRoot, setFirstRoot] = useState(defaultFirst);
  const [secondRoot, setSecondRoot] = useState(defaultSecond);
  const [firstAnswer, setFirstAnswer] = useState('');
  const [secondAnswer, setSecondAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const reveal = !challenge || checked || activeMode === 'build';

  const pairs = useMemo(() => (q === 0 ? [] : factorPairs(q)), [q]);
  const solution = useMemo(() => solveQuadratic(1, p, q), [p, q]);
  const integerPair = useMemo(() => integerRootPair(p, q), [p, q]);
  const d = discriminant(1, p, q);

  const parsedFirst = parseDraft(firstAnswer);
  const parsedSecond = parseDraft(secondAnswer);
  const answerReady = parsedFirst !== null && parsedSecond !== null;
  const answerCorrect = answerReady && checkVietaPair(p, q, parsedFirst, parsedSecond);

  const built = useMemo(() => monicFromRoots(firstRoot, secondRoot), [firstRoot, secondRoot]);
  const builtCheck = checkVietaPair(built.p, built.q, firstRoot, secondRoot);

  const findHeadline = integerPair === null
    ? d < 0
      ? `Пары нет: D = ${num(d)} < 0, у уравнения нет корней.`
      : `Целой пары нет: D = ${num(d)}, корни ${solution.roots.map((root) => describeRoot(root)).join(' и ')}.`
    : integerPair[0] === integerPair[1]
      ? `Подходит пара ${num(integerPair[0])} и ${num(integerPair[1])}: это один корень кратности два, D = 0.`
      : `Подходит пара ${num(integerPair[0])} и ${num(integerPair[1])}: сумма ${num(integerPair[0] + integerPair[1])}, произведение ${num(integerPair[0] * integerPair[1])}.`;

  const findDetail = integerPair === null
    ? 'Виет не универсален: если целой пары нет, работает формула корней через дискриминант.'
    : `Проверка по Виету: x₁ + x₂ = −p = ${num(-p)} и x₁ · x₂ = q = ${num(q)}.`;

  const result = activeMode === 'build'
    ? {
      symbol: builtCheck ? '✓' : '×',
      headline: `Корни ${num(firstRoot)} и ${num(secondRoot)} задают уравнение ${monicText(built.p, built.q)}.`,
      detail: `p = −(x₁ + x₂) = ${num(built.p)}, q = x₁ · x₂ = ${num(built.q)}. Обратная теорема Виета гарантирует, что других корней нет: ${monicText(built.p, built.q).replace(' = 0', '')} = ${rootFactor(firstRoot)}${rootFactor(secondRoot)}.`,
    }
    : !reveal
      ? {
        symbol: '?',
        headline: `Подбери два числа: сумма ${num(-p)}, произведение ${num(q)}.`,
        detail: 'Введи оба числа и нажми «Проверить». Таблица делителей откроется после ответа.',
      }
      : challenge
        ? {
          symbol: answerCorrect ? '✓' : '×',
          headline: answerCorrect
            ? `Верно: ${num(parsedFirst!)} и ${num(parsedSecond!)} дают сумму ${num(-p)} и произведение ${num(q)}.`
            : findHeadline,
          detail: answerCorrect ? findDetail : 'Сумма должна равняться −p, а произведение — q. Обе проверки обязательны.',
        }
        : { symbol: integerPair === null ? '!' : '=', headline: findHeadline, detail: findDetail };

  const reset = () => {
    setActiveMode(mode);
    setP(defaultP);
    setQ(defaultQ);
    setFirstRoot(defaultFirst);
    setSecondRoot(defaultSecond);
    setFirstAnswer('');
    setSecondAnswer('');
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-algebra-formula-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория теоремы Виета</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Сумма и произведение вместо формулы корней</h3>
          <p>
            Для приведённого уравнения x² + px + q = 0 пара корней полностью описывается двумя числами:
            сумма равна −p, произведение равно q. Проверь, когда этого хватает, а когда нет.
          </p>
        </div>
        <span className="dm-lab__badge">x₁ + x₂ = −p, x₁ · x₂ = q</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-algebra-tabs" role="group" aria-label="Режим работы с теоремой Виета">
          <button
            type="button"
            className={`dm-algebra-tab ${activeMode === 'find' ? 'dm-algebra-tab--active' : ''}`}
            aria-pressed={activeMode === 'find'}
            onClick={() => setActiveMode('find')}
          >
            Подобрать корни
          </button>
          <button
            type="button"
            className={`dm-algebra-tab ${activeMode === 'build' ? 'dm-algebra-tab--active' : ''}`}
            aria-pressed={activeMode === 'build'}
            onClick={() => setActiveMode('build')}
          >
            Составить уравнение
          </button>
        </div>

        {activeMode === 'find' ? (
          <div className="dm-lab__controls dm-signed-controls">
            <IntegerField
              id={`${labId}-p`}
              label="Коэффициент p"
              hint={`Целое от −${P_LIMIT} до ${P_LIMIT}`}
              value={p}
              limit={P_LIMIT}
              onChange={(value) => {
                setP(value);
                setChecked(false);
              }}
            />
            <IntegerField
              id={`${labId}-q`}
              label="Свободный член q"
              hint={`Целое от −${Q_LIMIT} до ${Q_LIMIT}`}
              value={q}
              limit={Q_LIMIT}
              onChange={(value) => {
                setQ(value);
                setChecked(false);
              }}
            />
          </div>
        ) : (
          <div className="dm-lab__controls dm-signed-controls">
            <IntegerField
              id={`${labId}-x1`}
              label="Корень x₁"
              hint={`Целое от −${ROOT_LIMIT} до ${ROOT_LIMIT}`}
              value={firstRoot}
              limit={ROOT_LIMIT}
              onChange={setFirstRoot}
            />
            <IntegerField
              id={`${labId}-x2`}
              label="Корень x₂"
              hint={`Целое от −${ROOT_LIMIT} до ${ROOT_LIMIT}`}
              value={secondRoot}
              limit={ROOT_LIMIT}
              onChange={setSecondRoot}
            />
          </div>
        )}

        <div
          className="dm-algebra-equation"
          role="math"
          aria-label={activeMode === 'find' ? `Уравнение ${monicText(p, q)}` : `Уравнение ${monicText(built.p, built.q)}`}
        >
          <span>{activeMode === 'find' ? monicText(p, q) : monicText(built.p, built.q)}</span>
          <span aria-hidden="true">→</span>
          <strong>
            {activeMode === 'find'
              ? `x₁ + x₂ = ${num(-p)}, x₁ · x₂ = ${num(q)}`
              : `x₁ = ${num(firstRoot)}, x₂ = ${num(secondRoot)}`}
          </strong>
        </div>

        {activeMode === 'find' && challenge && (
          <div className="dm-geometry-answer-grid">
            <div className="dm-geometry-answer-field">
              <label htmlFor={`${labId}-first-answer`}>Мой x₁</label>
              <input
                id={`${labId}-first-answer`}
                type="text"
                inputMode="numeric"
                maxLength={MAX_DRAFT_LENGTH}
                value={firstAnswer}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (DRAFT_PATTERN.test(raw)) {
                    setFirstAnswer(raw);
                    setChecked(false);
                  }
                }}
              />
            </div>
            <div className="dm-geometry-answer-field">
              <label htmlFor={`${labId}-second-answer`}>Мой x₂</label>
              <input
                id={`${labId}-second-answer`}
                type="text"
                inputMode="numeric"
                maxLength={MAX_DRAFT_LENGTH}
                value={secondAnswer}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (DRAFT_PATTERN.test(raw)) {
                    setSecondAnswer(raw);
                    setChecked(false);
                  }
                }}
              />
            </div>
            <button className="dm-button" type="button" disabled={!answerReady} onClick={() => setChecked(true)}>
              Проверить
            </button>
          </div>
        )}

        {activeMode === 'find' && reveal && q === 0 && (
          <p className="dm-signed-caption">
            При q = 0 уравнение раскладывается сразу: x(x {p < 0 ? '−' : '+'} {Math.abs(p)}) = 0, корни {num(0)} и {num(-p)}.
            Перебирать делители нуля бессмысленно — их бесконечно много.
          </p>
        )}

        {activeMode === 'find' && reveal && q !== 0 && (
          <div className="dm-algebra-table-wrap" role="region" aria-label="Прокручиваемая таблица пар делителей" tabIndex={0}>
            <table className="dm-algebra-table">
              <caption>Все пары целых чисел с произведением {num(q)}</caption>
              <thead>
                <tr>
                  <th scope="col">Первое число</th>
                  <th scope="col">Второе число</th>
                  <th scope="col">Их сумма</th>
                  <th scope="col">Совпадает с −p = {num(-p)}?</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((pair) => {
                  const matches = pair.sum === -p;
                  return (
                    <tr className={matches ? 'dm-ratio-table__answer' : ''} key={`${pair.first}-${pair.second}`}>
                      <th scope="row">{num(pair.first)}</th>
                      <td>{num(pair.second)}</td>
                      <td>{num(pair.sum)}</td>
                      <td>{matches ? 'да — это корни' : 'нет'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeMode === 'build' && (
          <ol className="dm-signed-steps">
            <li>
              <span aria-hidden="true">1</span>
              <p>
                <strong>x₁ + x₂ = {num(firstRoot + secondRoot)}</strong>
                <small>значит p = −({num(firstRoot)} + {num(secondRoot)}) = {num(built.p)}</small>
              </p>
            </li>
            <li>
              <span aria-hidden="true">2</span>
              <p>
                <strong>x₁ · x₂ = {num(firstRoot * secondRoot)}</strong>
                <small>значит q = {num(built.q)}</small>
              </p>
            </li>
            <li>
              <span aria-hidden="true">3</span>
              <p>
                <strong>D = {num(discriminant(1, built.p, built.q))}</strong>
                <small>{firstRoot === secondRoot ? 'корни совпали, поэтому D = 0' : 'корни различны, поэтому D > 0'}</small>
              </p>
            </li>
          </ol>
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
