import { useState } from 'react';
import { compareFractions, type Fraction } from '../lib/fractions';

interface Problem {
  left: Fraction;
  right: Fraction;
  hint: string;
}

const problems: Problem[] = [
  { left: { numerator: 5, denominator: 6 }, right: { numerator: 7, denominator: 9 }, hint: 'Сравни 5 · 9 и 7 · 6.' },
  { left: { numerator: 3, denominator: 8 }, right: { numerator: 6, denominator: 16 }, hint: 'Вторая дробь сокращается.' },
  { left: { numerator: 4, denominator: 7 }, right: { numerator: 5, denominator: 7 }, hint: 'Знаменатели уже одинаковые.' },
  { left: { numerator: 7, denominator: 10 }, right: { numerator: 2, denominator: 3 }, hint: 'Сравни 7 · 3 и 2 · 10.' },
  { left: { numerator: 11, denominator: 12 }, right: { numerator: 8, denominator: 9 }, hint: 'Обе дроби близки к единице: сравни, какой части до неё не хватает.' },
];

function FractionValue({ numerator, denominator }: Fraction) {
  return <span className="dm-frac" aria-hidden="true"><span>{numerator}</span><span>{denominator}</span></span>;
}

export default function FractionTrainer() {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<'<' | '=' | '>' | null>(null);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [finished, setFinished] = useState(false);
  const problem = problems[index];
  const comparison = compareFractions(problem.left, problem.right);
  const answer = comparison < 0 ? '<' : comparison > 0 ? '>' : '=';
  const isCorrect = choice === answer;

  const choose = (symbol: '<' | '=' | '>') => {
    if (choice !== null) return;
    if (symbol === answer) setScore((current) => current + 1);
    setChoice(symbol);
  };

  const next = () => {
    if (index === problems.length - 1) {
      setFinished(true);
      return;
    }
    setIndex((current) => current + 1);
    setChoice(null);
    setShowHint(false);
  };

  const restart = () => {
    setIndex(0);
    setChoice(null);
    setScore(0);
    setShowHint(false);
    setFinished(false);
  };

  if (finished) {
    const resultText = score === problems.length ? 'Все сравнения точны.' : score >= 3 ? 'Основа уже уверенная.' : 'Стоит ещё раз пройти стратегии сравнения.';
    return (
      <section className="dm-lab dm-trainer not-content" aria-labelledby="trainer-result-title">
        <header className="dm-lab__header">
          <div>
            <p className="dm-lab__eyebrow">Итог тренажёра</p>
            <h3 className="dm-lab__title" id="trainer-result-title">{score} из {problems.length}</h3>
            <p>{resultText}</p>
          </div>
          <span className="dm-lab__badge">серия завершена</span>
        </header>
        <div className="dm-lab__body dm-trainer__result">
          <p>Счёт учитывает только первую попытку в каждом примере. Ошибка — это подсказка, какую стратегию повторить.</p>
          <button className="dm-button" type="button" onClick={restart}>↺ Пройти ещё раз</button>
        </div>
      </section>
    );
  }

  return (
    <section className="dm-lab dm-trainer not-content" aria-labelledby="trainer-title">
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Тренажёр</p>
          <h3 className="dm-lab__title" id="trainer-title">Пять точных сравнений</h3>
          <p>Решай без спешки: важнее объяснить знак, чем угадать его.</p>
        </div>
        <span className="dm-lab__badge">{index + 1} / {problems.length} · верно {score}</span>
      </header>
      <div className="dm-lab__body">
        <div className="dm-trainer__problem" role="math" aria-label={`Сравнить ${problem.left.numerator}/${problem.left.denominator} и ${problem.right.numerator}/${problem.right.denominator}`}>
          <FractionValue {...problem.left} />
          <span className="dm-trainer__slot">?</span>
          <FractionValue {...problem.right} />
        </div>
        <div className="dm-trainer__choices" aria-label="Выбери знак сравнения">
          {(['<', '=', '>'] as const).map((symbol) => (
            <button
              key={symbol}
              className={`dm-option dm-trainer__choice ${choice === symbol ? (isCorrect ? 'dm-option--correct' : 'dm-option--wrong') : ''}`}
              type="button"
              onClick={() => choose(symbol)}
              disabled={choice !== null}
              aria-label={`Знак ${symbol}`}
            >
              {symbol}
            </button>
          ))}
        </div>
        {choice === null ? (
          <button className="dm-hint-button" type="button" onClick={() => setShowHint((current) => !current)}>
            {showHint ? 'Скрыть подсказку' : 'Нужна подсказка?'}
          </button>
        ) : (
          <div className="dm-trainer__footer" aria-live="polite">
            <p><strong>{isCorrect ? 'Точно!' : `Правильный знак — ${answer}.`}</strong> {problem.hint}</p>
            <button className="dm-button" type="button" onClick={next}>{index === problems.length - 1 ? 'Посмотреть итог →' : 'Следующий пример →'}</button>
          </div>
        )}
        {showHint && choice === null && <p className="dm-trainer__hint">{problem.hint}</p>}
      </div>
    </section>
  );
}
