import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Stock } from '@/lib/types';

interface MarketCardProps {
  stock: Stock;
  index: number;
}

export const MarketCard: React.FC<MarketCardProps> = ({ stock, index }) => {
  const price = stock?.price ?? 0;
  const change = stock?.change ?? 0;
  const changePercent = stock?.changePercent ?? 0;
  const isPositive = change >= 0;

  return (
    <div
      className="p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">{stock?.symbol ?? 'N/A'}</h3>
          <p className="text-xs text-muted-foreground truncate max-w-[120px]">{stock?.name ?? 'Unknown'}</p>
        </div>
        <div className={`p-2 rounded-lg ${isPositive ? 'bg-bullish/10' : 'bg-bearish/10'}`}>
          {isPositive ? (
            <TrendingUp className="w-4 h-4 text-bullish" />
          ) : (
            <TrendingDown className="w-4 h-4 text-bearish" />
          )}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-xl font-mono font-bold">
          ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
          <span>{isPositive ? '+' : ''}{changePercent.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
};
