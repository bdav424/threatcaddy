import { useMemo } from 'react';
import type { ChartModel } from '../../lib/chart-model';

// Dependency-free SVG preview of a resolved ChartModel (CaddyLab Stage 5a).
// Its job is to let the analyst SEE and confirm the chart model — type,
// series, categories, colors — before any docx/OOXML is generated. It is
// deliberately not a charting library; it just draws the exact model the
// resolver produced so "what you preview" is "what the chart will plot."

const WIDTH = 440;
const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 34, left: 40 };

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function ChartPreview({ model }: { model: ChartModel }) {
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const flatValues = useMemo(() => model.series.flatMap((series) => series.values), [model.series]);
  const maxValue = useMemo(() => niceMax(Math.max(1, ...flatValues)), [flatValues]);
  const stackedMax = useMemo(() => {
    if (model.type !== 'stackedBar') return maxValue;
    const totals = model.categories.map((_, index) => model.series.reduce((sum, series) => sum + (series.values[index] || 0), 0));
    return niceMax(Math.max(1, ...totals));
  }, [model, maxValue]);

  const axisMax = model.type === 'stackedBar' ? stackedMax : maxValue;
  const yScale = (value: number) => PAD.top + plotHeight - (value / axisMax) * plotHeight;

  const body = () => {
    switch (model.type) {
      case 'pie':
        return <PieBody model={model} />;
      case 'scatter':
        return <ScatterBody model={model} plotWidth={plotWidth} plotHeight={plotHeight} />;
      case 'line':
      case 'area':
        return <LineBody model={model} plotWidth={plotWidth} plotHeight={plotHeight} yScale={yScale} area={model.type === 'area'} />;
      case 'stackedBar':
        return <BarBody model={model} plotWidth={plotWidth} yScale={yScale} stacked />;
      case 'bar':
      default:
        return <BarBody model={model} plotWidth={plotWidth} yScale={yScale} stacked={false} />;
    }
  };

  return (
    <div className="rounded-lg border border-border-subtle bg-white p-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={`${model.type} chart preview`}>
        {model.type !== 'pie' && (
          <>
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotHeight} stroke="#cbd5e1" strokeWidth={1} />
            <line x1={PAD.left} y1={PAD.top + plotHeight} x2={WIDTH - PAD.right} y2={PAD.top + plotHeight} stroke="#cbd5e1" strokeWidth={1} />
            {model.type !== 'scatter' && (
              <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" fontSize={9} fill="#64748b">{axisMax}</text>
            )}
          </>
        )}
        {body()}
      </svg>
      <div className="mt-1 flex flex-wrap gap-2 px-1">
        {(model.type === 'pie' ? model.categories : model.series.map((s) => s.name)).map((label, index) => (
          <span key={label + index} className="inline-flex items-center gap-1 text-[10px] text-gray-700">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: model.colors[index % model.colors.length] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarBody({ model, plotWidth, yScale, stacked }: { model: ChartModel; plotWidth: number; yScale: (v: number) => number; stacked: boolean }) {
  const groupWidth = plotWidth / Math.max(model.categories.length, 1);
  const baseY = yScale(0);
  return (
    <>
      {model.categories.map((category, catIndex) => {
        const groupX = PAD.left + catIndex * groupWidth;
        let stackTop = baseY;
        return (
          <g key={category + catIndex}>
            {model.series.map((series, seriesIndex) => {
              const value = series.values[catIndex] || 0;
              const color = model.colors[seriesIndex % model.colors.length];
              if (stacked) {
                const top = yScale(value) - (baseY - stackTop);
                const rect = <rect key={seriesIndex} x={groupX + groupWidth * 0.2} y={top} width={groupWidth * 0.6} height={Math.max(0, stackTop - top)} fill={color} />;
                stackTop = top;
                return rect;
              }
              const barWidth = (groupWidth * 0.7) / model.series.length;
              const x = groupX + groupWidth * 0.15 + seriesIndex * barWidth;
              const top = yScale(value);
              return <rect key={seriesIndex} x={x} y={top} width={Math.max(1, barWidth - 1)} height={Math.max(0, baseY - top)} fill={color} />;
            })}
            <text x={groupX + groupWidth / 2} y={HEIGHT - PAD.bottom + 12} textAnchor="middle" fontSize={8} fill="#64748b">
              {truncate(category, 8)}
            </text>
          </g>
        );
      })}
    </>
  );
}

function LineBody({ model, plotWidth, plotHeight, yScale, area }: { model: ChartModel; plotWidth: number; plotHeight: number; yScale: (v: number) => number; area: boolean }) {
  const stepX = plotWidth / Math.max(model.categories.length - 1, 1);
  const baseY = PAD.top + plotHeight;
  return (
    <>
      {model.series.map((series, seriesIndex) => {
        const color = model.colors[seriesIndex % model.colors.length];
        const points = series.values.map((value, index) => `${PAD.left + index * stepX},${yScale(value)}`);
        return (
          <g key={series.name + seriesIndex}>
            {area && (
              <polygon points={`${PAD.left},${baseY} ${points.join(' ')} ${PAD.left + (series.values.length - 1) * stepX},${baseY}`} fill={color} fillOpacity={0.18} />
            )}
            <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={1.5} />
            {series.values.map((value, index) => (
              <circle key={index} cx={PAD.left + index * stepX} cy={yScale(value)} r={2} fill={color} />
            ))}
          </g>
        );
      })}
      {model.categories.map((category, index) => (
        <text key={category + index} x={PAD.left + index * stepX} y={HEIGHT - PAD.bottom + 12} textAnchor="middle" fontSize={8} fill="#64748b">
          {truncate(category, 8)}
        </text>
      ))}
    </>
  );
}

function ScatterBody({ model, plotWidth, plotHeight }: { model: ChartModel; plotWidth: number; plotHeight: number }) {
  const xValues = model.series[0]?.values ?? [];
  const yValues = model.series[1]?.values ?? [];
  const xMax = niceMax(Math.max(1, ...xValues));
  const yMax = niceMax(Math.max(1, ...yValues));
  return (
    <>
      {xValues.map((x, index) => {
        const y = yValues[index] || 0;
        const cx = PAD.left + (x / xMax) * plotWidth;
        const cy = PAD.top + plotHeight - (y / yMax) * plotHeight;
        return <circle key={index} cx={cx} cy={cy} r={3} fill={model.colors[0]} fillOpacity={0.7} />;
      })}
    </>
  );
}

function PieBody({ model }: { model: ChartModel }) {
  const values = model.series[0]?.values ?? [];
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2 - 6;
  const radius = Math.min(WIDTH, HEIGHT) / 2 - 24;
  let angle = -Math.PI / 2;
  return (
    <>
      {values.map((value, index) => {
        const slice = (Math.max(0, value) / total) * Math.PI * 2;
        const x1 = cx + radius * Math.cos(angle);
        const y1 = cy + radius * Math.sin(angle);
        angle += slice;
        const x2 = cx + radius * Math.cos(angle);
        const y2 = cy + radius * Math.sin(angle);
        const largeArc = slice > Math.PI ? 1 : 0;
        return (
          <path
            key={index}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
            fill={model.colors[index % model.colors.length]}
          />
        );
      })}
    </>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
