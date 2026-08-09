import { useEffect, useId, useRef, useState } from 'react';
import {
  adjacentAngle,
  transversalPairAngle,
  verticalAngle,
  type TransversalPairKind,
} from '../lib/planimetry';

export type ProofAngleMode = 'crossing' | 'parallel';

export interface ProofAngleLabProps {
  mode?: ProofAngleMode;
  initialDegrees?: number;
  step?: number;
  challenge?: boolean;
}

const MODES: readonly ProofAngleMode[] = ['crossing', 'parallel'];
const MODE_LABELS: Readonly<Record<ProofAngleMode, string>> = {
  crossing: 'Две пересекающиеся прямые',
  parallel: 'Параллельные прямые и секущая',
};
const PAIR_KINDS: readonly TransversalPairKind[] = ['corresponding', 'alternate', 'co-interior'];
const PAIR_LABELS: Readonly<Record<TransversalPairKind, string>> = {
  corresponding: 'соответственные',
  alternate: 'накрест лежащие',
  'co-interior': 'односторонние',
};
type CrossingQuestion = 'adjacent' | 'vertical';
const CROSSING_QUESTION_LABELS: Readonly<Record<CrossingQuestion, string>> = {
  adjacent: 'смежный угол 2',
  vertical: 'вертикальный угол 3',
};

const MIN_DEGREES = 15;
const MAX_DEGREES = 165;

function safeDegrees(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(MIN_DEGREES, Math.min(MAX_DEGREES, Math.round(value)))
    : fallback;
}

function safeStep(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(15, Math.round(value)))
    : 5;
}

/** Точка на расстоянии length от центра в направлении angle (против часовой, ось x вправо). */
function rayPoint(center: { x: number; y: number }, angle: number, length: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: Math.round((center.x + Math.cos(radians) * length) * 1000) / 1000,
    y: Math.round((center.y - Math.sin(radians) * length) * 1000) / 1000,
  };
}

/** Дуга против часовой стрелки от направления from к направлению to (разность не больше 180°). */
function arcPath(center: { x: number; y: number }, radius: number, from: number, to: number): string {
  const start = rayPoint(center, from, radius);
  const end = rayPoint(center, to, radius);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 0 ${end.x} ${end.y}`;
}

interface DegreeFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}

function DegreeField({ id, label, value, step, onChange }: DegreeFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const cancelCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  const commit = () => {
    const parsed = /^\d+$/.test(draft.trim()) ? Number(draft.trim()) : value;
    const next = safeDegrees(parsed, value);
    setDraft(String(next));
    onChange(next);
  };
  const nudge = (direction: -1 | 1) =>
    onChange(Math.max(MIN_DEGREES, Math.min(MAX_DEGREES, value + direction * step)));

  return (
    <div className="dm-field dm-geometry-field">
      <label htmlFor={id}>{label}<span className="dm-field__value">{value}°</span></label>
      <div className="dm-geometry-field__control">
        <button type="button" onClick={() => nudge(-1)} disabled={value <= MIN_DEGREES} aria-label={`Уменьшить угол на ${step} градусов`}>−</button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft}
          aria-describedby={`${id}-hint`}
          onFocus={() => { cancelCommit.current = false; setEditing(true); }}
          onChange={(event) => {
            const raw = event.target.value.slice(0, 4);
            if (/^\d*$/.test(raw)) {
              setDraft(raw);
              if (/^\d+$/.test(raw)) {
                const parsed = Number(raw);
                if (parsed >= MIN_DEGREES && parsed <= MAX_DEGREES) onChange(parsed);
              }
            }
          }}
          onBlur={() => {
            if (cancelCommit.current) {
              cancelCommit.current = false;
              setDraft(String(value));
            } else commit();
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
            if (event.key === 'Escape') { event.preventDefault(); cancelCommit.current = true; setDraft(String(value)); event.currentTarget.blur(); }
          }}
        />
        <button type="button" onClick={() => nudge(1)} disabled={value >= MAX_DEGREES} aria-label={`Увеличить угол на ${step} градусов`}>+</button>
      </div>
      <small id={`${id}-hint`}>От {MIN_DEGREES}° до {MAX_DEGREES}°, шаг кнопок {step}°</small>
    </div>
  );
}

interface CrossingPictureProps {
  readonly id: string;
  readonly degrees: number;
  readonly reveal: boolean;
  readonly question: CrossingQuestion;
  readonly challenge: boolean;
}

function CrossingPicture({ id, degrees, reveal, question, challenge }: CrossingPictureProps) {
  const center = { x: 360, y: 220 };
  const rayLength = 275;
  const supplement = adjacentAngle(degrees);
  const secondRayEnd = rayPoint(center, degrees, rayLength);
  const secondRayStart = rayPoint(center, degrees + 180, rayLength);
  // Углы 1–4 против часовой стрелки: [начало дуги, конец дуги, величина].
  const sectors: readonly (readonly [number, number, number])[] = [
    [0, degrees, degrees],
    [degrees, 180, supplement],
    [180, 180 + degrees, degrees],
    [180 + degrees, 360, supplement],
  ];
  const arcRadius = (measure: number) => (measure < 40 ? 88 : 62);
  const labelRadius = (measure: number) => (measure < 40 ? 152 : 118);
  const hiddenIndices = challenge && !reveal
    ? question === 'adjacent' ? [1, 2, 3] : [1, 2, 3]
    : [];
  const questionIndex = question === 'adjacent' ? 1 : 2;
  const description = reveal
    ? `Прямые AB и CD пересекаются в точке O. Угол 1 равен ${degrees}°, смежные с ним углы 2 и 4 равны ${supplement}°, вертикальный угол 3 равен ${degrees}°.`
    : `Прямые AB и CD пересекаются в точке O. Угол 1 равен ${degrees}°. Величины остальных углов скрыты: найди ${CROSSING_QUESTION_LABELS[question]}.`;

  return (
    <svg className="dm-geometry-angle" viewBox="0 0 720 440" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Углы при пересечении двух прямых</title>
      <desc id={`${id}-desc`}>{description}</desc>
      {sectors.map(([from, to, measure], index) =>
        index % 2 === 0 ? (
          <path className="dm-geometry-angle__arc" d={arcPath(center, arcRadius(measure) + (index === 2 ? 8 : 0), from, to)} key={`arc-${index}`} />
        ) : (
          <g className="dm-geometry-grid__perpendicular" key={`arc-${index}`}>
            <path d={arcPath(center, arcRadius(measure) + (index === 3 ? 8 : 0), from, to)} />
          </g>
        ),
      )}
      <line className="dm-geometry-angle__ray" x1={center.x - rayLength} y1={center.y} x2={center.x + rayLength} y2={center.y} />
      <line className="dm-geometry-angle__ray dm-geometry-angle__ray--moving" x1={secondRayStart.x} y1={secondRayStart.y} x2={secondRayEnd.x} y2={secondRayEnd.y} />
      <circle className="dm-geometry-angle__vertex" cx={center.x} cy={center.y} r="7" />
      <g className="dm-geometry-angle__ticks" aria-hidden="true">
        <text x={center.x + rayLength + 14} y={center.y + 5}>B</text>
        <text x={center.x - rayLength - 14} y={center.y + 5}>A</text>
        <text x={secondRayEnd.x + 12} y={secondRayEnd.y - 8}>C</text>
        <text x={secondRayStart.x - 12} y={secondRayStart.y + 16}>D</text>
        <text x={center.x + 14} y={center.y + 22}>O</text>
      </g>
      {sectors.map(([from, to, measure], index) => {
        const anchor = rayPoint(center, (from + to) / 2, labelRadius(measure));
        const hidden = hiddenIndices.includes(index);
        const text = hidden ? (index === questionIndex ? '?' : `∠${index + 1}`) : `${measure}°`;
        return (
          <text className="dm-geometry-angle__value" x={anchor.x} y={anchor.y + 9} textAnchor="middle" key={`value-${index}`}>
            {text}
          </text>
        );
      })}
    </svg>
  );
}

interface ParallelPictureProps {
  readonly id: string;
  readonly degrees: number;
  readonly kind: TransversalPairKind;
  readonly reveal: boolean;
}

function ParallelPicture({ id, degrees, kind, reveal }: ParallelPictureProps) {
  const topY = 150;
  const bottomY = 305;
  const halfGap = (bottomY - topY) / 2;
  const tangent = Math.tan((degrees * Math.PI) / 180);
  const offset = halfGap / tangent;
  const top = { x: 360 - offset, y: topY };
  const bottom = { x: 360 + offset, y: bottomY };
  const direction = { x: bottom.x - top.x, y: bottom.y - top.y };
  const directionLength = Math.hypot(direction.x, direction.y);
  const unit = { x: direction.x / directionLength, y: direction.y / directionLength };
  const extension = 78;
  const transversalStart = { x: top.x - unit.x * extension, y: top.y - unit.y * extension };
  const transversalEnd = { x: bottom.x + unit.x * extension, y: bottom.y + unit.y * extension };
  const pairValue = transversalPairAngle(kind, degrees);
  const supplement = adjacentAngle(degrees);
  // Направления в математических координатах: вниз к второй точке — это −degrees.
  const down = -degrees;
  const up = 180 - degrees;
  const givenArc = { center: top, from: down, to: 0, measure: verticalAngle(degrees) };
  const pairArc = kind === 'corresponding'
    ? { center: bottom, from: down, to: 0, measure: pairValue }
    : kind === 'alternate'
      ? { center: bottom, from: up, to: 180, measure: pairValue }
      : { center: bottom, from: 0, to: up, measure: pairValue };
  const arcRadius = (measure: number) => (measure < 40 ? 74 : 52);
  const labelRadius = (measure: number) => (measure < 40 ? 126 : 98);
  const givenLabel = rayPoint(givenArc.center, (givenArc.from + givenArc.to) / 2, labelRadius(givenArc.measure));
  const pairLabel = rayPoint(pairArc.center, (pairArc.from + pairArc.to) / 2, labelRadius(pairArc.measure));
  const equal = kind !== 'co-interior';
  const description = reveal
    ? `Параллельные прямые a и b пересечены секущей c. Отмеченный угол при верхней точке равен ${degrees}°, парный к нему (${PAIR_LABELS[kind]} углы) равен ${pairValue}°.`
    : `Параллельные прямые a и b пересечены секущей c. Отмеченный угол при верхней точке равен ${degrees}°. Найди второй угол пары: углы ${PAIR_LABELS[kind]}.`;

  return (
    <svg className="dm-geometry-angle" viewBox="0 0 720 455" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Углы при параллельных прямых и секущей</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <path className="dm-geometry-angle__arc" d={arcPath(givenArc.center, arcRadius(givenArc.measure), givenArc.from, givenArc.to)} />
      {equal ? (
        <path className="dm-geometry-angle__arc" d={arcPath(pairArc.center, arcRadius(pairArc.measure), pairArc.from, pairArc.to)} />
      ) : (
        <g className="dm-geometry-grid__perpendicular">
          <path d={arcPath(pairArc.center, arcRadius(pairArc.measure), pairArc.from, pairArc.to)} />
        </g>
      )}
      <line className="dm-geometry-angle__ray" x1={40} y1={topY} x2={680} y2={topY} />
      <line className="dm-geometry-angle__ray" x1={40} y1={bottomY} x2={680} y2={bottomY} />
      <line className="dm-geometry-angle__ray dm-geometry-angle__ray--moving" x1={transversalStart.x} y1={transversalStart.y} x2={transversalEnd.x} y2={transversalEnd.y} />
      <circle className="dm-geometry-angle__vertex" cx={top.x} cy={top.y} r="7" />
      <circle className="dm-geometry-angle__vertex" cx={bottom.x} cy={bottom.y} r="7" />
      <g className="dm-geometry-angle__ticks" aria-hidden="true">
        <text x={694} y={topY + 5}>a</text>
        <text x={694} y={bottomY + 5}>b</text>
        <text x={transversalEnd.x + 4} y={transversalEnd.y + 18}>c</text>
      </g>
      <text className="dm-geometry-angle__value" x={givenLabel.x} y={givenLabel.y + 9} textAnchor="middle">{degrees}°</text>
      <text className="dm-geometry-angle__value" x={pairLabel.x} y={pairLabel.y + 9} textAnchor="middle">
        {reveal ? `${pairValue}°` : '?'}
      </text>
      {!reveal && supplement === degrees ? null : null}
    </svg>
  );
}

function parseAnswer(raw: string): number | null {
  const source = raw.trim();
  if (!/^\d+$/.test(source)) return null;
  const value = Number(source);
  return Number.isFinite(value) ? value : null;
}

export default function ProofAngleLab({
  mode,
  initialDegrees,
  step,
  challenge = false,
}: ProofAngleLabProps) {
  const reactId = useId();
  const labId = `proof-angle-${reactId.replace(/:/g, '')}`;
  const defaultMode: ProofAngleMode = mode !== undefined && MODES.includes(mode) ? mode : 'crossing';
  const defaultDegrees = safeDegrees(initialDegrees, 40);
  const degreeStep = safeStep(step);
  const [activeMode, setActiveMode] = useState(defaultMode);
  const [degrees, setDegrees] = useState(defaultDegrees);
  const [pairKind, setPairKind] = useState<TransversalPairKind>('alternate');
  const [crossingQuestion, setCrossingQuestion] = useState<CrossingQuestion>('adjacent');
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const supplement = adjacentAngle(degrees);
  const expected = activeMode === 'crossing'
    ? crossingQuestion === 'adjacent' ? supplement : verticalAngle(degrees)
    : transversalPairAngle(pairKind, degrees);
  const answerValue = parseAnswer(answer);
  const answerCorrect = answerValue !== null && answerValue === expected;
  const reveal = !challenge || checked;

  const setAngle = (value: number) => { setChecked(false); setDegrees(safeDegrees(value, degrees)); };
  const switchMode = (next: ProofAngleMode) => { setActiveMode(next); setChecked(false); setAnswer(''); };
  const switchKind = (next: TransversalPairKind) => { setPairKind(next); setChecked(false); setAnswer(''); };
  const switchQuestion = (next: CrossingQuestion) => { setCrossingQuestion(next); setChecked(false); setAnswer(''); };
  const reset = () => {
    setActiveMode(defaultMode);
    setDegrees(defaultDegrees);
    setPairKind('alternate');
    setCrossingQuestion('adjacent');
    setAnswer('');
    setChecked(false);
  };

  const result = (() => {
    if (activeMode === 'crossing') {
      if (challenge && !checked) {
        return {
          symbol: '?',
          headline: `Дан угол 1 = ${degrees}°. Найди ${CROSSING_QUESTION_LABELS[crossingQuestion]}.`,
          detail: 'Сначала реши, какая теорема работает: про смежные или про вертикальные углы.',
        };
      }
      if (challenge) {
        return {
          symbol: answerCorrect ? '✓' : '×',
          headline: answerCorrect ? 'Верно, теорема сработала.' : `Пока нет: искомый угол равен ${expected}°.`,
          detail: crossingQuestion === 'adjacent'
            ? `Смежные углы дают в сумме 180°, поэтому ∠2 = 180° − ${degrees}° = ${supplement}°.`
            : `Вертикальные углы равны, поэтому ∠3 = ∠1 = ${degrees}°.`,
        };
      }
      return {
        symbol: '∠',
        headline: `∠1 = ∠3 = ${degrees}°, ∠2 = ∠4 = ${supplement}°.`,
        detail: 'Меняй угол: равенство вертикальных и сумма смежных 180° сохраняются при любом наклоне — это и есть теоремы.',
      };
    }
    if (challenge && !checked) {
      return {
        symbol: '?',
        headline: `Углы ${PAIR_LABELS[pairKind]}. Верхний угол равен ${degrees}°. Найди второй.`,
        detail: 'Реши, равны ли углы этой пары или дают в сумме 180°.',
      };
    }
    if (challenge) {
      return {
        symbol: answerCorrect ? '✓' : '×',
        headline: answerCorrect ? 'Точно.' : `Пока нет: второй угол равен ${expected}°.`,
        detail: pairKind === 'co-interior'
          ? `Односторонние углы при параллельных прямых дают в сумме 180°: 180° − ${degrees}° = ${expected}°.`
          : `Углы ${PAIR_LABELS[pairKind]} при параллельных прямых равны, поэтому второй тоже ${expected}°.`,
      };
    }
    return {
      symbol: '∥',
      headline: pairKind === 'co-interior'
        ? `Односторонние: ${degrees}° и ${expected}°, в сумме 180°.`
        : `Углы ${PAIR_LABELS[pairKind]} равны: оба по ${expected}°.`,
      detail: 'Это работает только потому, что прямые a и b параллельны: наклон секущей к обеим прямым один и тот же.',
    };
  })();

  return (
    <section className="dm-lab dm-geometry-angle-shape not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория доказательств</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>Углы, которые нельзя нарисовать неправильно</h3>
          <p>Все величины на чертеже вычислены из одного угла — проверь, что теоремы выполняются при любом наклоне.</p>
        </div>
        <span className="dm-lab__badge">{challenge ? 'задача' : 'исследование'}</span>
      </header>
      <div className="dm-lab__body">
        <div className="dm-geometry-tabs" role="group" aria-label="Конфигурация прямых">
          {MODES.map((item) => (
            <button
              type="button"
              className={activeMode === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
              aria-pressed={activeMode === item}
              onClick={() => switchMode(item)}
              key={item}
            >
              {MODE_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="dm-lab__controls dm-geometry-controls">
          <DegreeField
            id={`${labId}-degrees`}
            label={activeMode === 'crossing' ? 'Угол 1 между прямыми' : 'Угол между секущей и прямой a'}
            value={degrees}
            step={degreeStep}
            onChange={setAngle}
          />
        </div>

        {activeMode === 'parallel' && (
          <div className="dm-geometry-tabs" role="group" aria-label="Какую пару углов рассматриваем">
            {PAIR_KINDS.map((item) => (
              <button
                type="button"
                className={pairKind === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
                aria-pressed={pairKind === item}
                onClick={() => switchKind(item)}
                key={item}
              >
                {PAIR_LABELS[item]}
              </button>
            ))}
          </div>
        )}
        {activeMode === 'crossing' && challenge && (
          <div className="dm-geometry-tabs" role="group" aria-label="Какой угол ищем">
            {(Object.keys(CROSSING_QUESTION_LABELS) as CrossingQuestion[]).map((item) => (
              <button
                type="button"
                className={crossingQuestion === item ? 'dm-geometry-tab dm-geometry-tab--active' : 'dm-geometry-tab'}
                aria-pressed={crossingQuestion === item}
                onClick={() => switchQuestion(item)}
                key={item}
              >
                Найти {CROSSING_QUESTION_LABELS[item]}
              </button>
            ))}
          </div>
        )}

        <div className="dm-geometry-visual-wrap" role="region" aria-label="Прокручиваемый чертёж с вычисленными углами" tabIndex={0}>
          {activeMode === 'crossing' ? (
            <CrossingPicture id={`${labId}-crossing`} degrees={degrees} reveal={reveal} question={crossingQuestion} challenge={challenge} />
          ) : (
            <ParallelPicture id={`${labId}-parallel`} degrees={degrees} kind={pairKind} reveal={reveal} />
          )}
        </div>

        {challenge && (
          <div className="dm-geometry-answer">
            <label htmlFor={`${labId}-answer`}>Искомый угол, °</label>
            <input
              id={`${labId}-answer`}
              type="text"
              inputMode="numeric"
              value={answer}
              onChange={(event) => {
                const raw = event.target.value.slice(0, 4);
                if (/^\d*$/.test(raw)) { setAnswer(raw); setChecked(false); }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && answerValue !== null) { event.preventDefault(); setChecked(true); }
                if (event.key === 'Escape') { event.preventDefault(); setAnswer(''); setChecked(false); }
              }}
            />
            <button className="dm-button" type="button" disabled={answerValue === null} onClick={() => setChecked(true)}>Проверить</button>
          </div>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span>
          <p><strong>{result.headline}</strong><small>{result.detail}</small></p>
        </div>
        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>↺ Вернуть пример</button>
      </div>
    </section>
  );
}
