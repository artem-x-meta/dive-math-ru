import type { PlotSegment } from '../lib/equationLogic';

export interface PlaneCurve {
  readonly segments: readonly PlotSegment[];
  readonly text: string;
  readonly dashed: boolean;
}

export interface PlanePoint {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly accepted: boolean;
}

interface Props {
  readonly id: string;
  readonly extent: number;
  readonly curves: readonly PlaneCurve[];
  readonly points: readonly PlanePoint[];
  /** Вертикальная штриховая линия: точка перелома модуля или граница области определения. */
  readonly guideX?: number | null;
  readonly guideLabel?: string;
  readonly reveal: boolean;
  readonly title: string;
  readonly description: string;
}

/**
 * Координатная плоскость главы «Уравнения и логика».
 * Все отрезки приходят готовыми из ядра, компонент только переводит
 * математические координаты в экранные — рисунок остаётся честным.
 */
export default function LogicPlane({
  id,
  extent,
  curves,
  points,
  guideX = null,
  guideLabel,
  reveal,
  title,
  description,
}: Props) {
  const centerX = 360;
  const centerY = 278;
  const radius = 236;
  const scale = radius / extent;
  const px = (value: number) => centerX + value * scale;
  const py = (value: number) => centerY - value * scale;
  const step = extent > 8 ? 2 : 1;
  const gridValues: number[] = [];
  for (let value = -extent; value <= extent; value += step) gridValues.push(value);

  return (
    <svg className="dm-signed-plane" viewBox="0 0 720 570" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description}</desc>
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
        {gridValues.map((value) => (
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
        {gridValues.filter((value) => value !== 0).map((value) => (
          <g key={value}>
            <text x={px(value)} y={centerY + 20}>{value}</text>
            <text x={centerX - 14} y={py(value) + 4}>{value}</text>
          </g>
        ))}
        <text x={centerX + radius - 6} y={centerY - 12}>x</text>
        <text x={centerX + 13} y={centerY - radius + 11}>y</text>
        <text x={centerX - 15} y={centerY + 19}>0</text>
      </g>

      {guideX !== null && Math.abs(guideX) <= extent && (
        <g className="dm-signed-plane__reflection-guides" aria-hidden="true">
          <line x1={px(guideX)} y1={centerY - radius} x2={px(guideX)} y2={centerY + radius} />
        </g>
      )}

      {curves.map((curve, index) => (
        <g
          key={`${curve.text}-${index}`}
          className={curve.dashed ? 'dm-signed-plane__reflection-guides' : 'dm-signed-plane__route-segment'}
          aria-hidden="true"
        >
          {curve.segments.map((segment, segmentIndex) => (
            <line
              key={segmentIndex}
              x1={px(segment.x1)}
              y1={py(segment.y1)}
              x2={px(segment.x2)}
              y2={py(segment.y2)}
            />
          ))}
        </g>
      ))}

      {reveal && points
        .filter((point) => Math.abs(point.x) <= extent && Math.abs(point.y) <= extent)
        .map((point) => (
          <g
            key={`${point.label}-${point.x}-${point.y}`}
            className={point.accepted
              ? 'dm-signed-plane__point dm-signed-plane__point--finish'
              : 'dm-signed-plane__point dm-signed-plane__point--a'}
            transform={`translate(${px(point.x)} ${py(point.y)})`}
            aria-hidden="true"
          >
            <circle r={point.accepted ? 8 : 7} />
            <text x={12} y={point.accepted ? -12 : 18}>{point.label}</text>
          </g>
        ))}

      <g className="dm-signed-plane__labels" aria-hidden="true">
        {curves.map((curve, index) => (
          <text key={`legend-${index}`} x={centerX - radius + 78} y={centerY - radius + 20 + index * 18}>
            {curve.dashed ? 'пунктир' : 'сплошная'} — {curve.text}
          </text>
        ))}
        {guideX !== null && guideLabel !== undefined && Math.abs(guideX) <= extent && (
          <text x={centerX - radius + 78} y={centerY - radius + 20 + curves.length * 18}>{guideLabel}</text>
        )}
      </g>
    </svg>
  );
}
