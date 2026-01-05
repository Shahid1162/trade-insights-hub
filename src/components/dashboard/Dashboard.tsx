import React from 'react';
import { Globe, IndianRupee, Bitcoin } from 'lucide-react';
import { MarketSection } from './MarketSection';
import { Stock } from '@/lib/types';

// Mock data - will be replaced with API data
const indianStocks: Stock[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', price: 2456.75, change: 34.50, changePercent: 1.42, market: 'indian' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', price: 3890.20, change: -45.30, changePercent: -1.15, market: 'indian' },
  { symbol: 'INFY', name: 'Infosys Limited', price: 1567.80, change: 23.45, changePercent: 1.52, market: 'indian' },
  { symbol: 'HDFC', name: 'HDFC Bank', price: 1678.90, change: 12.30, changePercent: 0.74, market: 'indian' },
];

const usStocks: Stock[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 178.50, change: 2.34, changePercent: 1.33, market: 'us' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 378.90, change: -5.67, changePercent: -1.47, market: 'us' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 140.25, change: 3.45, changePercent: 2.52, market: 'us' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 495.80, change: 12.45, changePercent: 2.58, market: 'us' },
];

const cryptoAssets: Stock[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 43567.89, change: 1234.56, changePercent: 2.92, market: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', price: 2345.67, change: -78.90, changePercent: -3.25, market: 'crypto' },
  { symbol: 'SOL', name: 'Solana', price: 98.45, change: 5.67, changePercent: 6.11, market: 'crypto' },
  { symbol: 'BNB', name: 'Binance Coin', price: 312.34, change: 8.90, changePercent: 2.93, market: 'crypto' },
];

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold">
          Welcome to <span className="gradient-text">TA5</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Your comprehensive trading analysis platform. Monitor markets, analyze signals, and make informed decisions.
        </p>
      </div>

      {/* Market Ticker */}
      <div className="relative overflow-hidden py-4 rounded-xl bg-card/50 border border-border/50 animate-fade-in">
        <div className="flex animate-ticker gap-8">
          {[...indianStocks, ...usStocks, ...cryptoAssets, ...indianStocks, ...usStocks, ...cryptoAssets].map((stock, i) => (
            <div key={`${stock.symbol}-${i}`} className="flex items-center gap-3 whitespace-nowrap">
              <span className="font-semibold">{stock.symbol}</span>
              <span className="font-mono">${stock.price.toLocaleString()}</span>
              <span className={stock.change >= 0 ? 'text-bullish' : 'text-bearish'}>
                {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Market Sections */}
      <div className="space-y-8">
        <MarketSection
          title="Indian Market"
          icon={<IndianRupee className="w-5 h-5" />}
          stocks={indianStocks}
        />
        <MarketSection
          title="US Market"
          icon={<Globe className="w-5 h-5" />}
          stocks={usStocks}
        />
        <MarketSection
          title="Cryptocurrency"
          icon={<Bitcoin className="w-5 h-5" />}
          stocks={cryptoAssets}
        />
      </div>
    </div>
  );
};
