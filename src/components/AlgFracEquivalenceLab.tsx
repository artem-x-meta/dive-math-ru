import { useId, useMemo, useState } from 'react';
import {
  type AgreementStatus,
  type EquivalencePreset,
  type EquivalencePresetId,
  combinationRestrictions,
  compareCombinationAt,
  evaluateCombination,
  evaluateFraction,
  getEquivalencePreset,
  missingRestrictions,
  restrictedValues,
} from '../lib/algebraicFractions';
import { formatExactRussian, parseExact, type ExactRational } from '../lib/exactRational';

export interface AlgFracEquivalenceLabProps {
  preset: EquivalencePresetId;
  variable?: string;
  challenge?: boolean;
}

const VALUE_DRAFT = /^[+\-−]?\d*(?:[.,]\d*)?$/;

const VERDICT: Record<AgreementStatus, string> = {
  equal: 'значения совпали',
  different: 'значения разные',
  'left-undefined': 'слева не определено',
  'right-undefined': 'справа не определено',
  'both-undefined': 'обе записи не определены',
};

function safePreset(id: EquivalencePresetId): EquivalencePreset {
  try {
    return getEquivalencePreset(id);
  } catch {
    return getEquivalencePreset('reduce-difference');
  }
}

function show(value: ExactRational): string {
  return formatExactRussian(value);
}

function listValues(values: readonly ExactRational[]): string {
  return values.length === 0 ? 'нет' : values.map(show).join('; ');
}

function parsePoint(draft: string): ExactRational | null {
  const trimmed = draft.trim();
  if (trimmed.length === 0 || trimmed === '+' || trimmed === '-' || trimmed === '−' || trimmed === ',' || trimmed === '.') {
    return null;
  }
  try {
    return parseExact(trimmed);
  } catch {
    return null;
  }
}

export default function AlgFracEquivalenceLab({
  preset: presetId,
  variable = 'x',
  challenge = false,
}: AlgFracEquivalenceLabProps) {
  const reactId = useId();
  const labId = `alg-frac-equivalence-${reactId.replace(/:/g, '')}`;
  const preset = useMemo(() => safePreset(presetId), [presetId]);
  const [point, setPoint] = useState('');
  const [guess, setGuess] = useState<'equal' | 'different' | null>(null);
  const [checked, setChecked] = useState(false);

  const sourceRestrictions = useMemo(() => combinationRestrictions(preset.combination), [preset]);
  const answerRestrictions = useMemo(() => restrictedValues(preset.proposed.denominator), [preset]);
  const lost = useMemo(
    () => missingRestrictions(sourceRestrictions, answerRestrictions),
    [answerRestrictions, sourceRestrictions],
  );

  const rows = useMemo(() => {
    const points = preset.samples
      .map((sample) => parsePoint(sample))
      .filter((value): value is ExactRational => value !== null)
      .map((value) => ({ x: value, own: false }));
    const own = parsePoint(point);
    if (own !== null) points.push({ x: own, own: true });
    return points.map(({ x, own: isOwn }) => ({
      x,
      own: isOwn,
      left: evaluateCombination(preset.combination, x),
      right: evaluateFraction(preset.proposed.numerator, preset.proposed.denominator, x),
      status: compareCombinationAt(preset.combination, preset.proposed, x),
    }));
  }, [point, preset]);

  const revealed = !challenge || checked;
  const guessCorrect = guess === (preset.correct ? 'equal' : 'different');
  const differentRows = rows.filter((row) => row.status === 'different');
  const equalRows = rows.filter((row) => row.status === 'equal');

  const summary = (() => {
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: preset.prompt,
        detail: 'Сначала выскажи предположение, потом сверься с таблицей значений.',
      };
    }
    if (preset.correct) {
      return {
        symbol: '=',
        headline: `Записи равны при всех допустимых значениях ${variable}.`,
        detail: preset.comment,
      };
    }
    return {
      symbol: '×',
      headline: 'Записи не равны: это не преобразование, а ошибка.',
      detail: preset.comment,
    };
  })();

  const reset = () => {
    setPoint('');
    setGuess(null);
    setChecked(false);
  };

  return (
    <section className="dm-lab dm-algebra-formula-lab not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория равносильных записей</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>{preset.title}</h3>
          <p>{preset.prompt} Значения считаются точно, без округлений — в каждой точке видно, совпадают записи или нет.</p>
        </div>
        <span className="dm-lab__badge">{preset.leftLabel}</span>
      </header>

      <div className="dm-lab__body">
        <div
          className="dm-algebra-equation"
          role="math"
          aria-label={`Слева ${preset.leftLabel}, справа ${preset.rightLabel}`}
        >
          <span>{preset.leftLabel}</span>
          <span aria-hidden="true">{revealed ? (preset.correct ? '=' : '≠') : '?'}</span>
          <strong>{preset.rightLabel}</strong>
        </div>

        {challenge && (
          <fieldset className="dm-geometry-challenge">
            <legend>Что покажет проверка значениями?</legend>
            <label>
              <input
                type="radio"
                name={`${labId}-guess`}
                checked={guess === 'equal'}
                onChange={() => { setGuess('equal'); setChecked(false); }}
              />
              Записи равны при всех допустимых {variable}
            </label>
            <label>
              <input
                type="radio"
                name={`${labId}-guess`}
                checked={guess === 'different'}
                onChange={() => { setGuess('different'); setChecked(false); }}
              />
              Найдётся {variable}, при котором значения разные
            </label>
            <button className="dm-button" type="button" disabled={guess === null} onClick={() => setChecked(true)}>
              Проверить
            </button>
          </fieldset>
        )}

        <section className="dm-algebra-table-panel" aria-labelledby={`${labId}-table-heading`}>
          <div className="dm-algebra-table-panel__header">
            <div>
              <p className="dm-algebra-table-panel__caption">Одно значение — две записи</p>
              <h4 id={`${labId}-table-heading`}>Таблица сравнения</h4>
            </div>
            <div className="dm-field dm-algebra-field">
              <label htmlFor={`${labId}-point`}>Своё значение {variable}</label>
              <input
                id={`${labId}-point`}
                type="text"
                inputMode="decimal"
                value={point}
                maxLength={24}
                aria-describedby={`${labId}-point-hint`}
                onChange={(event) => {
                  const raw = event.target.value.slice(0, 24);
                  if (VALUE_DRAFT.test(raw)) setPoint(raw);
                }}
              />
              <small id={`${labId}-point-hint`}>Целое или десятичная дробь, например −1,5.</small>
            </div>
          </div>
          <div className="dm-algebra-table-wrap" role="region" aria-label="Прокручиваемая таблица сравнения записей" tabIndex={0}>
            <table className="dm-algebra-table">
              <caption>Слева {preset.leftLabel}, справа {preset.rightLabel}</caption>
              <thead>
                <tr>
                  <th scope="col">{variable}</th>
                  <th scope="col">Исходная запись</th>
                  <th scope="col">Предложенный ответ</th>
                  <th scope="col">Вывод</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    className={row.status === 'equal' ? '' : 'dm-algebra-table__row--undefined'}
                    key={`${show(row.x)}-${index}`}
                  >
                    <th scope="row">{show(row.x)}{row.own ? ' (твоё)' : ''}</th>
                    <td>{row.left.defined ? show(row.left.value!) : 'не определено'}</td>
                    <td>{row.right.defined ? show(row.right.value!) : 'не определено'}</td>
                    <td>{VERDICT[row.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside
          className={`dm-algebra-constraints ${lost.length === 0 ? 'dm-algebra-constraints--valid' : 'dm-algebra-constraints--warning'}`}
          aria-labelledby={`${labId}-constraints-heading`}
        >
          <p className="dm-algebra-constraints__caption">Что стало с допустимыми значениями</p>
          <h4 id={`${labId}-constraints-heading`}>
            {lost.length === 0 ? 'Обе записи запрещают одно и то же' : 'Ответ «шире» исходной записи'}
          </h4>
          <ul>
            <li>Исходная запись запрещает: {listValues(sourceRestrictions)}.</li>
            <li>Предложенный ответ запрещает: {listValues(answerRestrictions)}.</li>
            {lost.length > 0 && (
              <li>
                Потеряно при преобразовании: {listValues(lost)}. Именно поэтому рядом с ответом пишут условие
                {' '}{lost.map((value) => `${variable} ≠ ${show(value)}`).join(', ')}.
              </li>
            )}
          </ul>
        </aside>

        <div
          className={`dm-result ${!preset.correct && revealed ? 'dm-algebra-result--warning' : ''}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="dm-result__symbol" aria-hidden="true">
            {challenge && checked ? (guessCorrect ? '✓' : '×') : summary.symbol}
          </span>
          <p>
            <strong>
              {challenge && checked ? (guessCorrect ? 'Верно. ' : 'Пока нет. ') : ''}
              {summary.headline}
            </strong>
            <small>
              {revealed && differentRows.length > 0
                ? `Достаточно одного расхождения: при ${variable} = ${show(differentRows[0]!.x)} слева ${differentRows[0]!.left.defined ? show(differentRows[0]!.left.value!) : 'не определено'}, справа ${differentRows[0]!.right.defined ? show(differentRows[0]!.right.value!) : 'не определено'}. ${summary.detail}`
                : revealed && equalRows.length > 0
                  ? `Совпадение в ${equalRows.length} проверенных точках — это ещё не доказательство, но повод искать преобразование. ${summary.detail}`
                  : summary.detail}
            </small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
