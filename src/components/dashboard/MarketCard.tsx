import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Stock } from '@/lib/types';
import { Sparkline } from './Sparkline';

interface MarketCardProps {
  stock: Stock;
  index: number;
  sparklineData?: number[];
  onClick?: () => void;
}

function getStructure(stock: Stock): { label: string; bullish: boolean } {
  const price = stock.price ?? 0;
  const prevClose = stock.prevClose ?? price;
  const high = stock.high ?? price;
  const low = stock.low ?? price;
  const range = high - low;
  const midpoint = low + range / 2;
  const abovePrevClose = price > prevClose;
  const aboveMidpoint = price > midpoint;
  const bullish = abovePrevClose && aboveMidpoint;
  return { label: bullish ? 'Bullish' : 'Bearish', bullish };
}

export const MarketCard: React.FC<MarketCardProps> = ({ stock, index, sparklineData, onClick }) => {
  const price = stock?.price ?? 0;
  const change = stock?.change ?? 0;
  const changePercent = stock?.changePercent ?? 0;
  const isPositive = change >= 0;
  const structure = getStructure(stock);

  const fmt = (v: number) =>
    v >= 1
      ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : v.toFixed(6);

  const fmtVol = (v: number) => {
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return v.toFixed(0);
  };

  return (
    <div
      className={`p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 animate-fade-in ${onClick ? 'cursor-pointer' : ''}`}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">{stock?.symbol ?? 'N/A'}</h3>
          <p className="text-xs text-muted-foreground truncate max-w-[120px]">{stock?.name ?? 'Unknown'}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-bullish/10' : 'bg-bearish/10'}`}>
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-bullish" />
            ) : (
              <TrendingDown className="w-4 h-4 text-bearish" />
            )}
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${structure.bullish ? 'bg-bullish/15 text-bullish' : 'bg-bearish/15 text-bearish'}`}>
            {structure.label}
          </span>
        </div>
      </div>

      {/* Price & Change */}
      <div className="flex items-end justify-between mb-3">
        <span className="text-xl font-mono font-bold">${fmt(price)}</span>
        <span className={`text-sm font-medium ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
          {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
        </span>
      </div>

      {/* Sparkline Chart */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="mb-3 rounded-lg overflow-hidden bg-muted/30 p-1">
          <Sparkline data={sparklineData} height={36} positive={isPositive} />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40">
        <div className="text-center">
          <p className="text-[10px] text-bullish uppercase tracking-wide">High</p>
          <p className="text-xs font-mono font-medium mt-0.5">${fmt(stock.high ?? 0)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-bearish uppercase tracking-wide">Low</p>
          <p className="text-xs font-mono font-medium mt-0.5">${fmt(stock.low ?? 0)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Prev Close</p>
          <p className="text-xs font-mono font-medium mt-0.5">${fmt(stock.prevClose ?? 0)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Volume</p>
          <p className="text-xs font-mono font-medium mt-0.5">{fmtVol(stock.volume ?? 0)}</p>
        </div>
      </div>
    </div>
  );
};
