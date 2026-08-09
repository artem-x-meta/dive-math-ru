import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  absoluteValue,
  divideSigned,
  formatRussianNumber,
  multiplySigned,
  normalizeSignedZero,
  parseSignedDraft,
} from '../lib/signedNumbers';

export interface SignRulesLabProps {
  initialFactorA?: number;
  initialFactorB?: number;
  maxMagnitude?: number;
  showPattern?: boolean;
  showDivisionFamily?: boolean;
}

const ABSOLUTE_MAX_MAGNITUDE = 20;

function safeMagnitude(value: number | undefined): number {
  if (!Number.isFinite(value)) return 9;
  return Math.min(ABSOLUTE_MAX_MAGNITUDE, Math.max(2, Math.trunc(value as number)));
}

function safeFactor(value: number | undefined, fallback: number, maximum: number): number {
  const integer = Number.isFinite(value) ? Math.trunc(value as number) : fallback;
  return normalizeSignedZero(Math.max(-maximum, Math.min(maximum, integer)));
}

function inputText(value: number): string {
  return String(value).replace('.', ',');
}

interface FactorFieldProps {
  id: string;
  label: string;
  value: number;
  maximum: number;
  onChange: (value: number) => void;
}

function FactorField({ id, label, value, maximum, onChange }: FactorFieldProps) {
  const [draft, setDraft] = useState(inputText(value));
  const [isEditing, setIsEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!isEditing) setDraft(inputText(value));
  }, [isEditing, value]);

  const edit = (rawValue: string) => {
    setDraft(rawValue);
    const parsed = parseSignedDraft(rawValue);
    if (parsed !== null && Number.isInteger(parsed) && parsed >= -maximum && parsed <= maximum) {
      onChange(parsed);
    }
  };

  const commit = () => {
    const parsed = parseSignedDraft(draft);
    const next = parsed === null
      ? value
      : normalizeSignedZero(Math.max(-maximum, Math.min(maximum, Math.round(parsed))));
    setDraft(inputText(next));
    onChange(next);
  };

  const nudge = (direction: -1 | 1) => {
    onChange(Math.max(-maximum, Math.min(maximum, value + direction)));
  };

  return (
    <div className="dm-field dm-signed-field">
      <label htmlFor={id}>
        {label} <span className="dm-field__value">{formatRussianNumber(value)}</span>
      </label>
      <div className="dm-signed-field__control">
        <button type="button" className="dm-signed-field__step" onClick={() => nudge(-1)} disabled={value <= -maximum} aria-label={`Уменьшить ${label.toLowerCase()} на 1`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => {
            cancelCommit.current = false;
            setIsEditing(true);
          }}
          onChange={(event) => edit(event.target.value)}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              setDraft(inputText(value));
              setIsEditing(false);
              return;
            }
            commit();
            setIsEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelCommit.current = true;
              setDraft(inputText(value));
              event.currentTarget.blur();
            }
          }}
        />
        <button type="button" className="dm-signed-field__step" onClick={() => nudge(1)} disabled={value >= maximum} aria-label={`Увеличить ${label.toLowerCase()} на 1`}>+</button>
      </div>
      <small id={`${id}-hint`}>Целое число от {formatRussianNumber(-maximum)} до {maximum}</small>
    </div>
  );
}

function signOf(value: number): '+' | '−' | '0' {
  return value > 0 ? '+' : value < 0 ? '−' : '0';
}

function numberKind(value: number): string {
  return value > 0 ? 'положительное число' : value < 0 ? 'отрицательное число' : 'ноль';
}

function signReason(a: number, b: number): string {
  if (a === 0 || b === 0) return 'Если хотя бы один множитель равен нулю, всё произведение равно нулю.';
  if ((a > 0) === (b > 0)) return 'Знаки множителей одинаковые, поэтому произведение положительное.';
  return 'Знаки множителей разные, поэтому произведение отрицательное.';
}

interface SignDiagramProps {
  id: string;
  a: number;
  b: number;
  product: number;
}

function SignDiagram({ id, a, b, product }: SignDiagramProps) {
  return (
    <svg className="dm-signed-sign-diagram" viewBox="0 0 720 210" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Как знаки множителей определяют знак произведения</title>
      <desc id={`${id}-desc`}>
        Первый множитель {formatRussianNumber(a)}, его знак {signOf(a)}. Второй множитель {formatRussianNumber(b)}, его знак {signOf(b)}. Произведение {formatRussianNumber(product)}, его знак {signOf(product)}.
      </desc>
      <defs>
        <marker id={`${id}-arrow`} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path className="dm-signed-sign-diagram__arrowhead" d="M0,0 L9,4.5 L0,9 Z" />
        </marker>
      </defs>
      <g className={`dm-signed-sign-diagram__node dm-signed-sign-diagram__node--${a > 0 ? 'positive' : a < 0 ? 'negative' : 'zero'}`} transform="translate(125 95)" aria-hidden="true">
        <circle r="62" />
        <text className="dm-signed-sign-diagram__sign" y="3">{signOf(a)}</text>
        <text className="dm-signed-sign-diagram__value" y="33">a = {formatRussianNumber(a)}</text>
      </g>
      <text className="dm-signed-sign-diagram__operator" x="231" y="104" aria-hidden="true">×</text>
      <g className={`dm-signed-sign-diagram__node dm-signed-sign-diagram__node--${b > 0 ? 'positive' : b < 0 ? 'negative' : 'zero'}`} transform="translate(325 95)" aria-hidden="true">
        <circle r="62" />
        <text className="dm-signed-sign-diagram__sign" y="3">{signOf(b)}</text>
        <text className="dm-signed-sign-diagram__value" y="33">b = {formatRussianNumber(b)}</text>
      </g>
      <line className="dm-signed-sign-diagram__connector" x1="400" y1="95" x2="475" y2="95" markerEnd={`url(#${id}-arrow)`} aria-hidden="true" />
      <g className={`dm-signed-sign-diagram__node dm-signed-sign-diagram__node--result dm-signed-sign-diagram__node--${product > 0 ? 'positive' : product < 0 ? 'negative' : 'zero'}`} transform="translate(580 95)" aria-hidden="true">
        <circle r="72" />
        <text className="dm-signed-sign-diagram__sign" y="3">{signOf(product)}</text>
        <text className="dm-signed-sign-diagram__value" y="34">ab = {formatRussianNumber(product)}</text>
      </g>
      <text className="dm-signed-sign-diagram__caption" x="360" y="198" aria-hidden="true">
        Модули перемножаются: {formatRussianNumber(absoluteValue(a))} · {formatRussianNumber(absoluteValue(b))} = {formatRussianNumber(absoluteValue(product))}
      </text>
    </svg>
  );
}

export default function SignRulesLab({
  initialFactorA = -3,
  initialFactorB = -2,
  maxMagnitude,
  showPattern = true,
  showDivisionFamily = true,
}: SignRulesLabProps) {
  const reactId = useId();
  const labId = `sign-rules-${reactId.replace(/:/g, '')}`;
  const maximum = useMemo(() => safeMagnitude(maxMagnitude), [maxMagnitude]);
  const defaultA = safeFactor(initialFactorA, -3, maximum);
  const defaultB = safeFactor(initialFactorB, -2, maximum);
  const [a, setA] = useState(defaultA);
  const [b, setB] = useState(defaultB);
  const product = multiplySigned(a, b);
  const patternMagnitude = Math.min(3, maximum);
  const patternFactors = Array.from({ length: patternMagnitude * 2 + 1 }, (_, index) => patternMagnitude - index);
  const patternChange = multiplySigned(-1, b);
  const bothNonZero = a !== 0 && b !== 0;

  const reset = () => {
    setA(defaultA);
    setB(defaultB);
  };

  return (
    <section className="dm-lab dm-signed-sign-rules not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория правил знаков</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Не угадываем знак — продолжаем закономерность</h3>
          <p>Модули отвечают за размер произведения, а сочетание знаков — за его направление относительно нуля.</p>
        </div>
        <span className="dm-lab__badge">× и ÷</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-lab__controls dm-signed-controls">
          <FactorField id={`${labId}-a`} label="Множитель a" value={a} maximum={maximum} onChange={setA} />
          <FactorField id={`${labId}-b`} label="Множитель b" value={b} maximum={maximum} onChange={setB} />
        </div>

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемая схема правила знаков" tabIndex={0}>
          <SignDiagram id={`${labId}-diagram`} a={a} b={b} product={product} />
        </div>

        <div className="dm-signed-sign-explanation">
          <p><strong>Шаг 1. Модули:</strong> |{formatRussianNumber(a)}| · |{formatRussianNumber(b)}| = {formatRussianNumber(absoluteValue(product))}.</p>
          <p><strong>Шаг 2. Знак:</strong> {signReason(a, b)}</p>
          <p><strong>Итог:</strong> {formatRussianNumber(a)} · ({formatRussianNumber(b)}) = {formatRussianNumber(product)} — {numberKind(product)}.</p>
        </div>

        {showPattern && (
          <section className="dm-signed-pattern" aria-labelledby={`${labId}-pattern-title`}>
            <div className="dm-signed-pattern__heading">
              <div>
                <p className="dm-signed-caption">Продолжение таблицы</p>
                <h4 id={`${labId}-pattern-title`}>Фиксируем b = {formatRussianNumber(b)}</h4>
              </div>
              <span>каждая строка: {patternChange >= 0 ? '+' : '−'}{formatRussianNumber(absoluteValue(patternChange))}</span>
            </div>
            <div className="dm-signed-pattern__table-wrap">
              <table className="dm-signed-pattern__table">
                <caption>Как меняется произведение при уменьшении первого множителя на один</caption>
                <thead><tr><th scope="col">a</th><th scope="col">b</th><th scope="col">a · b</th><th scope="col">Изменение</th></tr></thead>
                <tbody>
                  {patternFactors.map((factor, index) => {
                    const value = multiplySigned(factor, b);
                    return (
                      <tr className={factor === a ? 'dm-signed-pattern__row--current' : ''} key={factor}>
                        <th scope="row">{formatRussianNumber(factor)}</th>
                        <td>{formatRussianNumber(b)}</td>
                        <td>{formatRussianNumber(value)}</td>
                        <td>{index === 0 ? 'начало' : `${patternChange >= 0 ? '+' : '−'}${formatRussianNumber(absoluteValue(patternChange))}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="dm-signed-pattern__note">
              Мы уменьшаем a на 1, поэтому произведение каждый раз меняется на −b = {formatRussianNumber(patternChange)}. Закономерность проходит через ноль и сама приводит к правилу для отрицательных множителей.
            </p>
          </section>
        )}

        {showDivisionFamily && (
          <section className="dm-signed-fact-family" aria-labelledby={`${labId}-family-title`}>
            <div>
              <p className="dm-signed-caption">Семейство фактов</p>
              <h4 id={`${labId}-family-title`}>Деление возвращает неизвестный множитель</h4>
            </div>
            {bothNonZero ? (
              <div className="dm-signed-fact-family__equations">
                <span>{formatRussianNumber(a)} · ({formatRussianNumber(b)}) = {formatRussianNumber(product)}</span>
                <span>{formatRussianNumber(product)} ÷ ({formatRussianNumber(a)}) = {formatRussianNumber(divideSigned(product, a))}</span>
                <span>{formatRussianNumber(product)} ÷ ({formatRussianNumber(b)}) = {formatRussianNumber(divideSigned(product, b))}</span>
              </div>
            ) : (
              <p>{b !== 0 ? `0 ÷ (${formatRussianNumber(b)}) = 0` : a !== 0 ? `0 ÷ (${formatRussianNumber(a)}) = 0` : '0 · 0 = 0'}. Обратного семейства из трёх разных записей здесь не получается.</p>
            )}
            <p className="dm-signed-division-warning"><strong>Граница правила:</strong> деление на 0 не определено. Ни одно число при умножении на 0 не позволит восстановить ненулевое делимое.</p>
          </section>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{signOf(product)}</span>
          <p>
            <strong>{formatRussianNumber(a)} · ({formatRussianNumber(b)}) = {formatRussianNumber(product)}</strong>
            <small>{signReason(a, b)} Модуль ответа равен {formatRussianNumber(absoluteValue(product))}.</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
