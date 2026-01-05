import React from 'react';
import { Stock } from '@/lib/types';
import { MarketCard } from './MarketCard';

interface MarketSectionProps {
  title: string;
  icon: React.ReactNode;
  stocks: Stock[];
}

export const MarketSection: React.FC<MarketSectionProps> = ({ title, icon, stocks }) => {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {stocks.map((stock, index) => (
          <MarketCard key={stock.symbol} stock={stock} index={index} />
        ))}
      </div>
    </div>
  );
};
