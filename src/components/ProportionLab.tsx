import { useEffect, useId, useMemo, useState } from 'react';
import { normalizeRatio, solveProportion, type Rational } from '../lib/ratios';

type Mode = 'scale' | 'unknown';

const MAX_VALUE = 999;
const MAX_FACTOR = 20;

function safePositiveInteger(value: number, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return Math.min(maximum, Math.max(1, fallback));
  return Math.min(maximum, Math.max(1, Math.trunc(value)));
}

function rationalText(value: Rational): string {
  return value.denominator === 1 ? String(value.numerator) : `${value.numerator}/${value.denominator}`;
}

function ExactValue({ value }: { value: Rational }) {
  if (value.denominator === 1) return <span className="dm-ratio-exact">{value.numerator}</span>;

  return (
    <span
      className="dm-ratio-fraction"
      role="math"
      aria-label={`дробь ${value.numerator}/${value.denominator}`}
    >
      <span aria-hidden="true">{value.numerator}</span>
      <span aria-hidden="true">{value.denominator}</span>
    </span>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  maximum?: number;
  onChange: (value: number) => void;
}

function NumberField({ id, label, value, maximum = MAX_VALUE, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const edit = (rawValue: string) => {
    setDraft(rawValue);
    const parsed = Number(rawValue);
    if (rawValue.trim() !== '' && Number.isInteger(parsed) && parsed >= 1 && parsed <= maximum) {
      onChange(parsed);
    }
  };

  const commit = () => {
    const next = draft.trim() === '' ? value : safePositiveInteger(Number(draft), value, maximum);
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
        min="1"
        max={maximum}
        step="1"
        value={draft}
        onChange={(event) => edit(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      <small>Целое число от 1 до {maximum}</small>
    </div>
  );
}

interface ProportionTableProps {
  label: string;
  first: number;
  second: number;
  targetFirst: number;
  targetSecond: number | Rational;
  factor: string;
}

function ProportionTable({ label, first, second, targetFirst, targetSecond, factor }: ProportionTableProps) {
  const exactTarget = typeof targetSecond === 'number'
    ? <span className="dm-ratio-exact">{targetSecond}</span>
    : <ExactValue value={targetSecond} />;

  return (
    <div className="dm-ratio-table-wrap">
      <table className="dm-ratio-table" aria-label={label}>
        <thead>
          <tr>
            <th scope="col">Строка</th>
            <th scope="col">Первая величина</th>
            <th scope="col">Вторая величина</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Исходное отношение</th>
            <td>{first}</td>
            <td>{second}</td>
          </tr>
          <tr className="dm-ratio-table__operation">
            <th scope="row">Одно действие</th>
            <td><span aria-label={`умножить на ${factor}`}>× {factor}</span></td>
            <td><span aria-label={`умножить на ${factor}`}>× {factor}</span></td>
          </tr>
          <tr className="dm-ratio-table__answer">
            <th scope="row">Новое отношение</th>
            <td>{targetFirst}</td>
            <td>{exactTarget}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  initialFirst?: number;
  initialSecond?: number;
  initialTarget?: number;
}

export default function ProportionLab({ initialFirst = 3, initialSecond = 5, initialTarget = 12 }: Props) {
  const labId = useId();
  const defaultFirst = safePositiveInteger(initialFirst, 3, MAX_VALUE);
  const defaultSecond = safePositiveInteger(initialSecond, 5, MAX_VALUE);
  const defaultTarget = safePositiveInteger(initialTarget, 12, MAX_VALUE);
  const [mode, setMode] = useState<Mode>('unknown');
  const [first, setFirst] = useState(defaultFirst);
  const [second, setSecond] = useState(defaultSecond);
  const [factor, setFactor] = useState(4);
  const [targetFirst, setTargetFirst] = useState(defaultTarget);

  const scaledFirst = first * factor;
  const scaledSecond = second * factor;
  const solution = useMemo(() => solveProportion(first, second, targetFirst, null).value, [first, second, targetFirst]);
  const targetScale = useMemo(() => normalizeRatio(targetFirst, first), [targetFirst, first]);
  const targetScaleText = targetScale.second === 1
    ? String(targetScale.first)
    : `${targetScale.first}/${targetScale.second}`;
  const perOneRatio = normalizeRatio(second, first);
  const perOne: Rational = { numerator: perOneRatio.first, denominator: perOneRatio.second };

  const reset = () => {
    setMode('unknown');
    setFirst(defaultFirst);
    setSecond(defaultSecond);
    setFactor(4);
    setTargetFirst(defaultTarget);
  };

  return (
    <section className="dm-lab dm-ratio-proportion not-content" aria-labelledby={`${labId}-title`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория пропорций</p>
          <h3 className="dm-lab__title" id={`${labId}-title`}>Одинаковое изменение двух величин</h3>
          <p>Строй равные отношения и находи неизвестное через смысл масштаба.</p>
        </div>
        <span className="dm-lab__badge">таблица отношений</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-ratio-tabs" role="group" aria-label="Режим лаборатории">
          <button
            className={`dm-ratio-tab ${mode === 'scale' ? 'dm-ratio-tab--active' : ''}`}
            type="button"
            aria-pressed={mode === 'scale'}
            onClick={() => setMode('scale')}
          >
            Построить равное отношение
          </button>
          <button
            className={`dm-ratio-tab ${mode === 'unknown' ? 'dm-ratio-tab--active' : ''}`}
            type="button"
            aria-pressed={mode === 'unknown'}
            onClick={() => setMode('unknown')}
          >
            Найти неизвестное
          </button>
        </div>

        <div className="dm-lab__controls dm-ratio-proportion__controls">
          <NumberField id={`${labId}-first`} label="Первый член" value={first} onChange={setFirst} />
          <NumberField id={`${labId}-second`} label="Второй член" value={second} onChange={setSecond} />
          {mode === 'scale' ? (
            <NumberField
              id={`${labId}-factor`}
              label="Множитель"
              value={factor}
              maximum={MAX_FACTOR}
              onChange={setFactor}
            />
          ) : (
            <NumberField
              id={`${labId}-target`}
              label="Новый первый член"
              value={targetFirst}
              onChange={setTargetFirst}
            />
          )}
        </div>

        {mode === 'scale' ? (
          <>
            <ProportionTable
              label={`Построение отношения, равного ${first} к ${second}`}
              first={first}
              second={second}
              targetFirst={scaledFirst}
              targetSecond={scaledSecond}
              factor={String(factor)}
            />
            <ol className="dm-ratio-steps">
              <li><span>1</span><p><strong>Выбираем масштаб.</strong> Сейчас это множитель {factor}.</p></li>
              <li><span>2</span><p><strong>Меняем оба члена одинаково.</strong> {first} · {factor} = {scaledFirst}, {second} · {factor} = {scaledSecond}.</p></li>
              <li><span>3</span><p><strong>Смысл сохраняется.</strong> На каждые {scaledFirst} единиц первой величины приходится {scaledSecond} второй.</p></li>
            </ol>
            <div className="dm-result" aria-live="polite" aria-atomic="true">
              <span className="dm-result__symbol" aria-hidden="true">=</span>
              <p>
                <strong>{first} : {second} = {scaledFirst} : {scaledSecond}</strong>
                <small>Оба члена умножены на {factor}, поэтому отношение не изменилось.</small>
              </p>
            </div>
          </>
        ) : (
          <>
            <ProportionTable
              label={`Поиск второго члена отношения ${targetFirst} к неизвестному`}
              first={first}
              second={second}
              targetFirst={targetFirst}
              targetSecond={solution}
              factor={targetScaleText}
            />
            <ol className="dm-ratio-steps">
              <li>
                <span>1</span>
                <p><strong>Читаем первую строку.</strong> На {first} единиц первой величины приходится {second} второй.</p>
              </li>
              <li>
                <span>2</span>
                <p>
                  <strong>Находим значение для одной единицы.</strong> {second} ÷ {first} ={' '}
                  <ExactValue value={perOne} />. Это количество второй величины, которое приходится на одну единицу первой.
                </p>
              </li>
              <li>
                <span>3</span>
                <p>
                  <strong>Переходим к {targetFirst} единицам.</strong> Умножаем обе величины на один масштаб {targetScaleText};
                  получаем <ExactValue value={solution} />.
                </p>
              </li>
            </ol>
            <div className="dm-result" aria-live="polite" aria-atomic="true">
              <span className="dm-result__symbol" aria-hidden="true">?</span>
              <p>
                <strong>{first} : {second} = {targetFirst} : {rationalText(solution)}</strong>
                <small>
                  Мы проследили одинаковое изменение столбцов. Формула «крест-накрест» здесь не нужна как догадка.
                </small>
              </p>
            </div>
            {solution.denominator !== 1 && (
              <p className="dm-ratio-fraction-note">
                Ответ получился дробным — это допустимо для измеряемых величин. В задаче про целые предметы нужно проверить смысл условия.
              </p>
            )}
          </>
        )}

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>
          ↺ Вернуть пример
        </button>
      </div>
    </section>
  );
}
