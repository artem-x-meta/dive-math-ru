import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  type PolynomialOperation,
  combinePolynomials,
  degreeRows,
  evaluatePolynomial,
  formatMonomial,
  formatPolynomial,
  normalizePolynomial,
  polynomialDegree,
  productRows,
} from '../lib/polynomials';

export interface PolyOperationLabProps {
  /** Коэффициенты первого многочлена по возрастанию степени. */
  initialFirst?: readonly number[];
  /** Коэффициенты второго многочлена по возрастанию степени. */
  initialSecond?: readonly number[];
  /** Действие, открытое при загрузке. */
  mode?: PolynomialOperation;
  /** Какие вкладки показывать. */
  allowedModes?: readonly PolynomialOperation[];
  /** Буква переменной. */
  variable?: string;
  /** Наибольшая степень, для которой есть поле коэффициента (0…3). */
  maxDegree?: number;
  /** Значение переменной для числовой проверки. */
  initialSample?: number;
}

interface Term {
  degree: number;
  coefficient: number;
}

const MIN_COEFFICIENT = -20;
const MAX_COEFFICIENT = 20;
const MIN_SAMPLE = -10;
const MAX_SAMPLE = 10;
const HARD_MAX_DEGREE = 3;
const INTEGER_DRAFT = /^[+-]?\d*$/;
const MAX_DRAFT_LENGTH = 4;
const MINUS = '−';

const MODE_LABEL: Record<PolynomialOperation, string> = {
  add: 'Сложить',
  subtract: 'Вычесть',
  multiply: 'Умножить',
};

const MODE_SIGN: Record<PolynomialOperation, string> = {
  add: '+',
  subtract: MINUS,
  multiply: '·',
};

function num(value: number): string {
  return String(value).replace('-', MINUS).replace('.', ',');
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.trunc(value);
  return Math.min(maximum, Math.max(minimum, rounded));
}

function normalizeVariable(value: string | undefined): string {
  return value?.trim().match(/^[A-Za-zА-Яа-яЁё]$/u)?.[0] ?? 'x';
}

function safeCoefficients(source: readonly number[] | undefined, fallback: readonly number[], length: number): number[] {
  const base = source && source.length > 0 ? source : fallback;
  return Array.from({ length }, (_, degree) => clampInteger(base[degree] ?? 0, MIN_COEFFICIENT, MAX_COEFFICIENT));
}

function terms(coefficients: readonly number[]): Term[] {
  const normalized = normalizePolynomial(coefficients, 'Многочлен');
  const result: Term[] = [];
  for (let degree = normalized.length - 1; degree >= 0; degree -= 1) {
    const coefficient = normalized[degree] ?? 0;
    if (coefficient !== 0) result.push({ degree, coefficient });
  }
  return result;
}

/** Запись члена со знаком: первый член без ведущего плюса. */
function signedTerm(coefficient: number, degree: number, variable: string, leading: boolean): string {
  const body = formatMonomial(Math.abs(coefficient), degree, variable);
  if (leading) return coefficient < 0 ? `${MINUS}${body}` : body;
  return coefficient < 0 ? `${MINUS} ${body}` : `+ ${body}`;
}

function bracketed(coefficients: readonly number[], variable: string): string {
  const text = formatPolynomial(coefficients, variable);
  return terms(coefficients).length > 1 ? `(${text})` : text;
}

interface CoefficientFieldProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
}

function CoefficientField({ id, label, hint, value, minimum, maximum, onChange }: CoefficientFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const valueAtFocus = useRef(value);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const next = Number.isNaN(parsed) ? value : clampInteger(parsed, minimum, maximum);
    onChange(next);
    setDraft(String(next));
  };

  return (
    <div className="dm-field dm-algebra-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{num(value)}</span>
      </label>
      <div className="dm-algebra-field__control">
        <button
          type="button"
          className="dm-algebra-field__step"
          onClick={() => onChange(clampInteger(value - 1, minimum, maximum))}
          disabled={value <= minimum}
          aria-label={`Уменьшить ${label.toLowerCase()} на единицу`}
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
            valueAtFocus.current = value;
            setEditing(true);
          }}
          onChange={(event) => {
            const raw = event.target.value.replace(MINUS, '-');
            if (raw.length > MAX_DRAFT_LENGTH || !INTEGER_DRAFT.test(raw)) return;
            setDraft(raw);
            const parsed = Number.parseInt(raw, 10);
            if (!Number.isNaN(parsed) && parsed >= minimum && parsed <= maximum) onChange(parsed);
          }}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              onChange(valueAtFocus.current);
              setDraft(String(valueAtFocus.current));
            } else {
              commit(draft);
            }
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
              onChange(valueAtFocus.current);
              setDraft(String(valueAtFocus.current));
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          className="dm-algebra-field__step"
          onClick={() => onChange(clampInteger(value + 1, minimum, maximum))}
          disabled={value >= maximum}
          aria-label={`Увеличить ${label.toLowerCase()} на единицу`}
        >
          +
        </button>
      </div>
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

export default function PolyOperationLab({
  initialFirst,
  initialSecond,
  mode = 'add',
  allowedModes = ['add', 'subtract', 'multiply'],
  variable,
  maxDegree = 2,
  initialSample = 2,
}: PolyOperationLabProps) {
  const reactId = useId();
  const labId = `poly-operation-${reactId.replace(/:/g, '')}`;
  const letter = normalizeVariable(variable);
  const length = clampInteger(maxDegree, 1, HARD_MAX_DEGREE) + 1;
  const modes = useMemo(() => {
    const filtered = (['add', 'subtract', 'multiply'] as const).filter((candidate) => allowedModes.includes(candidate));
    return filtered.length > 0 ? filtered : (['add', 'subtract', 'multiply'] as const);
  }, [allowedModes]);
  const defaults = useMemo(() => ({
    first: safeCoefficients(initialFirst, [3, -2, 1], length),
    second: safeCoefficients(initialSecond, [-5, 4], length),
    operation: modes.includes(mode) ? mode : modes[0]!,
    sample: clampInteger(initialSample, MIN_SAMPLE, MAX_SAMPLE),
  }), [initialFirst, initialSample, initialSecond, length, mode, modes]);

  const [first, setFirst] = useState<number[]>(defaults.first);
  const [second, setSecond] = useState<number[]>(defaults.second);
  const [operation, setOperation] = useState<PolynomialOperation>(defaults.operation);
  const [sample, setSample] = useState(defaults.sample);

  const result = combinePolynomials(first, second, operation);
  const firstText = formatPolynomial(first, letter);
  const secondText = formatPolynomial(second, letter);
  const resultText = formatPolynomial(result, letter);
  const resultDegree = polynomialDegree(result);
  const firstValue = evaluatePolynomial(first, sample);
  const secondValue = evaluatePolynomial(second, sample);
  const directValue = operation === 'add'
    ? firstValue + secondValue
    : operation === 'subtract'
      ? firstValue - secondValue
      : firstValue * secondValue;
  const resultValue = evaluatePolynomial(result, sample);
  const agree = directValue === resultValue;

  const rows = operation === 'multiply' ? [] : degreeRows(first, second, operation);
  const grouped = operation === 'multiply' ? productRows(first, second) : [];
  const firstTerms = terms(first);
  const secondTerms = terms(second);

  const expression = operation === 'multiply'
    ? `${bracketed(first, letter)} · ${bracketed(second, letter)}`
    : `${bracketed(first, letter)} ${MODE_SIGN[operation]} ${bracketed(second, letter)}`;

  const openedBrackets = operation === 'subtract'
    ? `${firstText} ${secondTerms.map((term) => signedTerm(-term.coefficient, term.degree, letter, false)).join(' ') || '− 0'}`
    : operation === 'add'
      ? `${firstText} ${secondTerms.map((term) => signedTerm(term.coefficient, term.degree, letter, false)).join(' ') || '+ 0'}`
      : '';

  const setCoefficient = (which: 'first' | 'second', degree: number, value: number) => {
    const update = (current: number[]) => current.map((coefficient, index) => (index === degree ? value : coefficient));
    if (which === 'first') setFirst(update);
    else setSecond(update);
  };

  const reset = () => {
    setFirst(defaults.first);
    setSecond(defaults.second);
    setOperation(defaults.operation);
    setSample(defaults.sample);
  };

  const degreeName = (degree: number) => (degree === 0 ? 'свободный член' : `при ${formatMonomial(1, degree, letter)}`);

  return (
    <section className="dm-lab dm-algebra-formula-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория многочленов</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Действие с многочленами по шагам</h3>
          <p>Меняй коэффициенты и смотри, как складываются подобные члены и откуда берётся каждый член ответа.</p>
        </div>
        <span className="dm-lab__badge">{expression}</span>
      </header>

      <div className="dm-lab__body">
        {modes.length > 1 && (
          <div className="dm-algebra-tabs" role="group" aria-label="Действие над многочленами">
            {modes.map((candidate) => (
              <button
                type="button"
                className={`dm-algebra-tab ${operation === candidate ? 'dm-algebra-tab--active' : ''}`}
                aria-pressed={operation === candidate}
                onClick={() => setOperation(candidate)}
                key={candidate}
              >
                {MODE_LABEL[candidate]}
              </button>
            ))}
          </div>
        )}

        <div className="dm-lab__controls dm-algebra-controls">
          {Array.from({ length }, (_, index) => length - 1 - index).map((degree) => (
            <CoefficientField
              id={`${labId}-first-${degree}`}
              label={`Первый многочлен, ${degreeName(degree)}`}
              hint={`Целое число от ${num(MIN_COEFFICIENT)} до ${MAX_COEFFICIENT}.`}
              value={first[degree] ?? 0}
              minimum={MIN_COEFFICIENT}
              maximum={MAX_COEFFICIENT}
              onChange={(value) => setCoefficient('first', degree, value)}
              key={`first-${degree}`}
            />
          ))}
        </div>

        <div className="dm-lab__controls dm-algebra-controls">
          {Array.from({ length }, (_, index) => length - 1 - index).map((degree) => (
            <CoefficientField
              id={`${labId}-second-${degree}`}
              label={`Второй многочлен, ${degreeName(degree)}`}
              hint={`Целое число от ${num(MIN_COEFFICIENT)} до ${MAX_COEFFICIENT}.`}
              value={second[degree] ?? 0}
              minimum={MIN_COEFFICIENT}
              maximum={MAX_COEFFICIENT}
              onChange={(value) => setCoefficient('second', degree, value)}
              key={`second-${degree}`}
            />
          ))}
        </div>

        <div className="dm-algebra-equation" role="math" aria-label={`${expression} равно ${resultText}`}>
          <span>{expression}</span>
          <span aria-hidden="true">=</span>
          <strong>{resultText}</strong>
        </div>

        {operation === 'multiply' ? (
          <section className="dm-algebra-table-panel" aria-labelledby={`${labId}-grid-heading`}>
            <div className="dm-algebra-table-panel__header">
              <div>
                <p className="dm-algebra-table-panel__caption">Каждый член на каждый</p>
                <h4 id={`${labId}-grid-heading`}>Решётка произведений</h4>
              </div>
            </div>
            <div className="dm-algebra-table-wrap" role="region" aria-label="Прокручиваемая решётка произведений" tabIndex={0}>
              <table className="dm-algebra-table">
                <thead>
                  <tr>
                    <th scope="col">·</th>
                    {secondTerms.map((term) => (
                      <th scope="col" key={`col-${term.degree}`}>{signedTerm(term.coefficient, term.degree, letter, true)}</th>
                    ))}
                    {secondTerms.length === 0 && <th scope="col">0</th>}
                  </tr>
                </thead>
                <tbody>
                  {firstTerms.length === 0 ? (
                    <tr>
                      <th scope="row">0</th>
                      <td>0</td>
                    </tr>
                  ) : firstTerms.map((rowTerm) => (
                    <tr key={`row-${rowTerm.degree}`}>
                      <th scope="row">{signedTerm(rowTerm.coefficient, rowTerm.degree, letter, true)}</th>
                      {secondTerms.map((columnTerm) => (
                        <td key={`cell-${rowTerm.degree}-${columnTerm.degree}`}>
                          {signedTerm(rowTerm.coefficient * columnTerm.coefficient, rowTerm.degree + columnTerm.degree, letter, true)}
                        </td>
                      ))}
                      {secondTerms.length === 0 && <td>0</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="dm-algebra-table-panel" aria-labelledby={`${labId}-columns-heading`}>
            <div className="dm-algebra-table-panel__header">
              <div>
                <p className="dm-algebra-table-panel__caption">Подобные члены стоят в одной строке</p>
                <h4 id={`${labId}-columns-heading`}>Столбик по степеням</h4>
              </div>
            </div>
            <div className="dm-algebra-table-wrap" role="region" aria-label="Прокручиваемая таблица по степеням" tabIndex={0}>
              <table className="dm-algebra-table">
                <thead>
                  <tr>
                    <th scope="col">Степень</th>
                    <th scope="col">Первый</th>
                    <th scope="col">{operation === 'add' ? 'Прибавляем' : 'Вычитаем'}</th>
                    <th scope="col">Результат</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <th scope="row">0</th>
                      <td>0</td>
                      <td>0</td>
                      <td>0</td>
                    </tr>
                  ) : rows.map((row) => (
                    <tr className={row.result === 0 ? 'dm-algebra-table__row--undefined' : ''} key={row.degree}>
                      <th scope="row">{formatMonomial(1, row.degree, letter)}</th>
                      <td>{num(row.first)}</td>
                      <td>{num(row.second)}</td>
                      <td>{num(row.result)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {operation === 'multiply' && grouped.length > 0 && (
          <section className="dm-algebra-group-detail" aria-labelledby={`${labId}-collect-heading`}>
            <p className="dm-algebra-group-detail__caption">Приведение подобных после раскрытия скобок</p>
            <h4 id={`${labId}-collect-heading`}>Собираем члены одной степени</h4>
            <ul>
              {grouped.map((row) => (
                <li key={row.degree}>
                  {formatMonomial(1, row.degree, letter)}: {row.parts.map((part) => num(part.coefficient)).join(' и ')}
                  {' → '}
                  {row.parts.length > 1 ? `${row.parts.map((part) => num(part.coefficient)).join(' + ').replaceAll('+ −', '− ')} = ` : ''}
                  <strong>{formatMonomial(row.coefficient, row.degree, letter)}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ol className="dm-algebra-steps">
          <li>
            <span>1</span>
            <p>
              <strong>Раскрываем скобки.</strong>{' '}
              {operation === 'multiply'
                ? `Каждый член первого многочлена умножаем на каждый член второго: ${firstTerms.length} · ${secondTerms.length} = ${firstTerms.length * secondTerms.length} произведений.`
                : `${expression} = ${openedBrackets}.`}
            </p>
          </li>
          <li>
            <span>2</span>
            <p>
              <strong>Приводим подобные.</strong>{' '}
              {operation === 'multiply'
                ? 'Складываем коэффициенты произведений одинаковой степени.'
                : 'Складываем коэффициенты в каждой строке таблицы — буквенная часть при этом не меняется.'}
            </p>
          </li>
          <li>
            <span>3</span>
            <p>
              <strong>Записываем ответ.</strong> {resultText}
              {resultDegree === null ? ' — нулевой многочлен, степень не определена.' : `; степень равна ${resultDegree}.`}
            </p>
          </li>
        </ol>

        <div className="dm-lab__controls dm-algebra-controls">
          <CoefficientField
            id={`${labId}-sample`}
            label={`Проверочное значение ${letter}`}
            hint={`Целое число от ${num(MIN_SAMPLE)} до ${MAX_SAMPLE}.`}
            value={sample}
            minimum={MIN_SAMPLE}
            maximum={MAX_SAMPLE}
            onChange={setSample}
          />
        </div>

        <div className={`dm-result ${agree ? '' : 'dm-algebra-result--warning'}`} aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{agree ? '=' : '!'}</span>
          <p>
            <strong>{expression} = {resultText}</strong>
            <small>
              Числовая проверка при {letter} = {num(sample)}: слева {num(firstValue)} {MODE_SIGN[operation]} {num(secondValue)} = {num(directValue)}, справа {num(resultValue)}. Значения {agree ? 'совпали' : 'не совпали'}. Совпадение в одной точке — не доказательство, но любое расхождение сразу указывает на ошибку.
            </small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
