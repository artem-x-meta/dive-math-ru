import { useId, useMemo, useState } from 'react';
import {
  exponentialSegments,
  expValue,
  logValue,
  logarithmSegments,
  mirrorPairs,
  reflectSegments,
} from '../lib/explog';
import { type Box, type Point, numberText } from '../lib/functionsCore';

export interface ExpoLogMirrorLabProps {
  /** Основание, с которого начинается работа. */
  initialBase?: number;
  /** Режим задачи: логарифмическая кривая и зеркальная точка появляются после проверки. */
  challenge?: boolean;
}

type MirrorChoice = 'swap' | 'same' | 'negate';

const BASE_OPTIONS: readonly number[] = [2, 3, 0.5];
const EXTENT = 8;
const BOX: Box = { xMin: -EXTENT, xMax: EXTENT, yMin: -EXTENT, yMax: EXTENT };
const SAMPLES = 401;
const GRID_VALUES: readonly number[] = Array.from({ length: 2 * EXTENT + 1 }, (_, index) => index - EXTENT);

/** Целые показатели, при которых и точка, и её зеркало помещаются в окно. */
function probesFor(base: number): readonly number[] {
  return [-3, -2, -1, 0, 1, 2, 3].filter((value) => {
    const image = expValue(base, value);
    return image <= EXTENT && image >= 1 / EXTENT;
  });
}

interface PlaneProps {
  id: string;
  base: number;
  probe: number;
  showReflection: boolean;
  reveal: boolean;
}

/** Масштаб по осям одинаковый — иначе отражение относительно y = x перестаёт быть отражением. */
function MirrorPlane({ id, base, probe, showReflection, reveal }: PlaneProps) {
  const centerX = 360;
  const centerY = 350;
  const radius = 320;
  const scale = radius / EXTENT;
  const px = (value: number) => centerX + value * scale;
  const py = (value: number) => centerY - value * scale;

  const exponential = useMemo(() => exponentialSegments(base, BOX, SAMPLES), [base]);
  const logarithm = useMemo(() => logarithmSegments(base, BOX, SAMPLES), [base]);
  const mirrored = useMemo(() => reflectSegments(exponential), [exponential]);

  const labelValues = GRID_VALUES.filter((value) => value !== 0 && value % 2 === 0);
  const image = expValue(base, probe);
  const insideDirect = Math.abs(probe) <= EXTENT && image <= EXTENT;

  const polyline = (segments: readonly Point[][], className: string, keyPrefix: string) => (
    <g className={className} aria-hidden="true">
      {segments.map((segment, segmentIndex) => segment.slice(1).map((point, index) => {
        const previous = segment[index]!;
        return (
          <line
            key={`${keyPrefix}-${segmentIndex}-${index}`}
            x1={px(previous.x)}
            y1={py(previous.y)}
            x2={px(point.x)}
            y2={py(point.y)}
          />
        );
      }))}
    </g>
  );

  const pathData = (segments: readonly Point[][]): string => segments
    .map((segment) => segment
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${px(point.x).toFixed(2)} ${py(point.y).toFixed(2)}`)
      .join(' '))
    .join(' ');

  return (
    <svg className="dm-signed-plane" viewBox="0 0 720 700" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Графики показательной и логарифмической функции с основанием {numberText(base)}</title>
      <desc id={`${id}-desc`}>
        Сетка честная: одна клетка — одна единица по обеим осям, масштаб одинаковый.
        Жирной линией показан график y = {numberText(base)} в степени x; он проходит через точку (0; 1) и целиком лежит выше оси x.
        {reveal
          ? ` Второй линией показан график y = log по основанию ${numberText(base)} от x; он проходит через точку (1; 0) и существует только при положительных x. Обе линии симметричны относительно пунктирной прямой y = x.`
          : ' График логарифма пока не показан.'}
        {reveal && insideDirect
          ? ` Отмечена точка (${numberText(probe)}; ${numberText(image)}) на показательной кривой и её зеркало (${numberText(image)}; ${numberText(probe)}) на логарифмической.`
          : ''}
        {reveal && showReflection ? ' Тонкой линией поверх логарифма нарисовано отражение показательной кривой: линии совпадают.' : ''}
      </desc>
      <defs>
        <marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path className="dm-signed-plane__axis-arrow" d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>

      <rect
        className="dm-signed-plane__background"
        x={centerX - radius}
        y={centerY - radius}
        width={radius * 2}
        height={radius * 2}
        rx="12"
      />

      <g className="dm-signed-plane__grid" aria-hidden="true">
        {GRID_VALUES.map((value) => (
          <g key={value}>
            <line x1={px(value)} y1={centerY - radius} x2={px(value)} y2={centerY + radius} />
            <line x1={centerX - radius} y1={py(value)} x2={centerX + radius} y2={py(value)} />
          </g>
        ))}
      </g>

      <line
        className="dm-signed-plane__axis"
        x1={centerX - radius}
        y1={centerY}
        x2={centerX + radius}
        y2={centerY}
        markerEnd={`url(#${id}-arrow)`}
      />
      <line
        className="dm-signed-plane__axis"
        x1={centerX}
        y1={centerY + radius}
        x2={centerX}
        y2={centerY - radius}
        markerEnd={`url(#${id}-arrow)`}
      />

      <g className="dm-signed-plane__labels" aria-hidden="true">
        {labelValues.map((value) => (
          <g key={value}>
            <text x={px(value)} y={centerY + 20}>{numberText(value)}</text>
            <text x={centerX - 16} y={py(value) + 4}>{numberText(value)}</text>
          </g>
        ))}
        <text x={centerX + radius - 6} y={centerY - 12}>x</text>
        <text x={centerX + 14} y={centerY - radius + 12}>y</text>
        <text x={centerX - 15} y={centerY + 19}>0</text>
      </g>

      <g className="dm-signed-plane__reflection-guides" aria-hidden="true">
        <line x1={px(-EXTENT)} y1={py(-EXTENT)} x2={px(EXTENT)} y2={py(EXTENT)} />
      </g>

      {polyline(exponential, 'dm-signed-plane__route-segment', 'exp')}
      {reveal && polyline(logarithm, 'dm-geometry-grid__perpendicular', 'log')}
      {reveal && showReflection && (
        <g className="dm-geometry-grid__perpendicular" aria-hidden="true">
          <path d={pathData(mirrored)} />
        </g>
      )}

      {reveal && insideDirect && (
        <>
          <g className="dm-geometry-grid__candidates" aria-hidden="true">
            <line x1={px(probe)} y1={py(image)} x2={px(image)} y2={py(probe)} />
          </g>
          <g
            className="dm-signed-plane__point dm-signed-plane__point--a"
            transform={`translate(${px(probe)} ${py(image)})`}
            aria-hidden="true"
          >
            <circle r="7" />
            <text x={-10} y={-12} textAnchor="end">({numberText(probe)}; {numberText(image)})</text>
          </g>
          <g
            className="dm-signed-plane__point dm-signed-plane__point--x-reflection"
            transform={`translate(${px(image)} ${py(probe)})`}
            aria-hidden="true"
          >
            <circle r="7" />
            <text x={10} y={20} textAnchor="start">({numberText(image)}; {numberText(probe)})</text>
          </g>
        </>
      )}
    </svg>
  );
}

export default function ExpoLogMirrorLab({ initialBase, challenge = false }: ExpoLogMirrorLabProps) {
  const reactId = useId();
  const labId = `expo-mirror-${reactId.replace(/:/g, '')}`;
  const defaultBase = initialBase !== undefined && BASE_OPTIONS.includes(initialBase) ? initialBase : 2;

  const [base, setBase] = useState(defaultBase);
  const [probeIndex, setProbeIndex] = useState(0);
  const [showReflection, setShowReflection] = useState(false);
  const [answer, setAnswer] = useState<MirrorChoice | ''>('');
  const [checked, setChecked] = useState(false);

  const probes = probesFor(base);
  const probe = probes[Math.min(probeIndex, probes.length - 1)] ?? 0;
  const reveal = !challenge || checked;
  const image = expValue(base, probe);
  const pairs = useMemo(() => mirrorPairs(base, probes), [base, probes]);
  const correct = challenge && answer === 'swap';

  const choiceLabel = (choice: MirrorChoice): string => {
    if (choice === 'swap') return `(${numberText(image)}; ${numberText(probe)})`;
    if (choice === 'same') return `(${numberText(probe)}; ${numberText(image)})`;
    return `(${numberText(-probe)}; ${numberText(image)})`;
  };

  const reset = () => {
    setBase(defaultBase);
    setProbeIndex(0);
    setShowReflection(false);
    setAnswer('');
    setChecked(false);
  };

  const result = !reveal
    ? {
      symbol: '?',
      headline: `Точка (${numberText(probe)}; ${numberText(image)}) лежит на графике y = ${numberText(base)}ˣ. Какая точка лежит на графике y = log_${numberText(base)} x?`,
      detail: 'Выбери ответ и нажми «Проверить». График логарифма появится только после этого.',
    }
    : challenge
      ? {
        symbol: correct ? '✓' : '×',
        headline: `${correct ? 'Верно' : 'Пока нет'}: на логарифмической кривой лежит точка (${numberText(image)}; ${numberText(probe)}).`,
        detail: `Равенство ${numberText(base)}^${numberText(probe)} = ${numberText(image)} и равенство log_${numberText(base)} ${numberText(image)} = ${numberText(probe)} — это одна и та же запись, прочитанная в разные стороны. Поэтому координаты просто меняются местами.`,
      }
      : {
        symbol: '⇄',
        headline: `${numberText(base)}^${numberText(probe)} = ${numberText(image)}, значит log_${numberText(base)} ${numberText(image)} = ${numberText(probe)}.`,
        detail: `Точка (${numberText(probe)}; ${numberText(image)}) на показательной кривой переходит в точку (${numberText(image)}; ${numberText(probe)}) на логарифмической. Отрезок между ними перпендикулярен прямой y = x и делится ею пополам — это и есть отражение.`,
      };

  return (
    <section className="dm-lab dm-signed-coordinate-plane not-content" aria-labelledby={`${labId}-heading`}>
      <header className="dm-lab__header">
        <div>
          <p className="dm-lab__eyebrow">Лаборатория зеркала</p>
          <h3 className="dm-lab__title" id={`${labId}-heading`}>
            {challenge ? 'Где окажется точка после отражения?' : 'Показательная и логарифмическая функции — отражение друг друга'}
          </h3>
          <p>
            {challenge
              ? 'График логарифма спрятан. Определи, куда переходит отмеченная точка, и проверь себя.'
              : 'Меняй основание и выбирай точку. Следи за тем, как координаты меняются местами и как обе кривые ложатся симметрично относительно прямой y = x.'}
          </p>
        </div>
        <span className="dm-lab__badge">y = log_{numberText(base)} x</span>
      </header>

      <div className="dm-lab__body">
        <div className="dm-geometry-preset-buttons" role="group" aria-label="Основание">
          {BASE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`dm-geometry-preset-button ${base === option ? 'dm-geometry-preset-button--active' : ''}`}
              aria-pressed={base === option}
              onClick={() => {
                setBase(option);
                setProbeIndex(0);
                setAnswer('');
                setChecked(false);
              }}
            >
              a = {numberText(option)}
            </button>
          ))}
        </div>

        <div className="dm-geometry-preset-buttons" role="group" aria-label="Показатель отмеченной точки">
          {probes.map((value, index) => (
            <button
              type="button"
              key={value}
              className={`dm-geometry-preset-button ${probe === value ? 'dm-geometry-preset-button--active' : ''}`}
              aria-pressed={probe === value}
              onClick={() => {
                setProbeIndex(index);
                setAnswer('');
                setChecked(false);
              }}
            >
              x = {numberText(value)}
            </button>
          ))}
        </div>

        <div className="dm-algebra-equation" role="math" aria-label={`Показательная функция y равно ${numberText(base)} в степени x`}>
          <span>y = {numberText(base)}ˣ</span>
          <span aria-hidden="true">⇄</span>
          <strong>{reveal ? `y = log_${numberText(base)} x` : 'y = ?'}</strong>
        </div>

        <div className="dm-signed-visual-wrap" role="region" aria-label="Прокручиваемый график двух функций" tabIndex={0}>
          <MirrorPlane
            id={`${labId}-plane`}
            base={base}
            probe={probe}
            showReflection={showReflection}
            reveal={reveal}
          />
        </div>

        {challenge && (
          <>
            <p className="dm-signed-caption">Мой ответ</p>
            <div className="dm-geometry-preset-buttons" role="group" aria-label="Точка на графике логарифма">
              {(['swap', 'same', 'negate'] as const).map((choice) => (
                <button
                  type="button"
                  key={choice}
                  className={`dm-geometry-preset-button ${answer === choice ? 'dm-geometry-preset-button--active' : ''}`}
                  aria-pressed={answer === choice}
                  onClick={() => {
                    setAnswer(choice);
                    setChecked(false);
                  }}
                >
                  {choiceLabel(choice)}
                </button>
              ))}
            </div>
            <div className="dm-geometry-answer-grid">
              <button className="dm-button" type="button" disabled={answer === ''} onClick={() => setChecked(true)}>
                Проверить
              </button>
            </div>
          </>
        )}

        {reveal && (
          <button
            type="button"
            className="dm-button dm-button--secondary"
            aria-pressed={showReflection}
            onClick={() => setShowReflection((current) => !current)}
          >
            {showReflection ? 'Убрать отражение показательной кривой' : 'Наложить отражение показательной кривой'}
          </button>
        )}

        <div className="dm-algebra-table-wrap" role="region" aria-label="Прокручиваемая таблица пар" tabIndex={0}>
          <table className="dm-algebra-table">
            <caption>Пары «показатель — значение» и возврат по логарифму</caption>
            <thead>
              <tr>
                <th scope="col">x</th>
                {pairs.map((pair) => <th scope="col" key={`x-${pair.x}`}>{numberText(pair.x)}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{numberText(base)}ˣ</th>
                {pairs.map((pair) => <td key={`e-${pair.x}`}>{numberText(pair.exponential)}</td>)}
              </tr>
              {reveal && (
                <tr>
                  <th scope="row">log_{numberText(base)} от этого числа</th>
                  {pairs.map((pair) => <td key={`b-${pair.x}`}>{numberText(pair.back)}</td>)}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {reveal && (
          <div className="dm-signed-reflection-cards">
            <div>
              <span>Общая точка экспоненты</span>
              <strong>(0; 1)</strong>
              <small>Любое допустимое основание в нулевой степени даёт единицу, поэтому все показательные кривые проходят через эту точку.</small>
            </div>
            <div>
              <span>Общая точка логарифма</span>
              <strong>(1; 0)</strong>
              <small>Это зеркало предыдущей точки: log_a 1 = 0 при любом допустимом основании.</small>
            </div>
            <div>
              <span>Проверка возврата</span>
              <strong>log_{numberText(base)} {numberText(image)} = {numberText(logValue(base, image))}</strong>
              <small>Логарифм возвращает тот самый показатель, который был подставлен в показательную функцию.</small>
            </div>
          </div>
        )}

        <div className="dm-result" aria-live="polite" aria-atomic="true">
          <span className="dm-result__symbol" aria-hidden="true">{result.symbol}</span>
          <p>
            <strong>{result.headline}</strong>
            <small>{result.detail}</small>
          </p>
        </div>

        <button className="dm-button dm-button--secondary dm-lab__reset" type="button" onClick={reset}>
          ↺ Вернуть пример
        </button>
      </div>
    </section>
  );
}
