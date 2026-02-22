import React, { useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({ data, width = 200, height = 40, positive = true }) => {
  const path = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const w = width - padding * 2;
    const h = height - padding * 2;

    return data
      .map((v, i) => {
        const x = padding + (i / (data.length - 1)) * w;
        const y = padding + h - ((v - min) / range) * h;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data, width, height]);

  const fillPath = useMemo(() => {
    if (data.length < 2) return '';
    const padding = 2;
    const w = width - padding * 2;
    return `${path} L${(padding + w).toFixed(1)},${height - padding} L${padding},${height - padding} Z`;
  }, [path, width, height, data.length]);

  if (data.length < 2) return null;

  const strokeColor = positive ? 'hsl(var(--bullish))' : 'hsl(var(--bearish))';
  const fillColor = positive ? 'hsl(var(--bullish) / 0.1)' : 'hsl(var(--bearish) / 0.1)';

  return (
    <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={fillPath} fill={fillColor} />
      <path d={path} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
