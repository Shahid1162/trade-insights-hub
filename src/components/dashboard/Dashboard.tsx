import React, { useState, useEffect, useRef } from 'react';
import { Bitcoin, RefreshCw, BarChart3, Calculator, Newspaper, Zap, TrendingUp, Shield } from 'lucide-react';
import { MarketSection } from './MarketSection';
import { Stock } from '@/lib/types';
import { getCryptoPrices, CryptoTicker } from '@/lib/binanceApi';

const features = [
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'AI Trading Signals',
    description: 'Get real-time buy/sell signals powered by advanced AI analysis across multiple timeframes and indicators.',
    color: 'from-primary/20 to-primary/5',
    borderColor: 'border-primary/30',
  },
  {
    icon: <Calculator className="w-6 h-6" />,
    title: 'Lot Size Calculator',
    description: 'Precisely calculate your position size based on risk percentage, stop-loss, and account balance.',
    color: 'from-amber-500/20 to-amber-500/5',
    borderColor: 'border-amber-500/30',
  },
  {
    icon: <Newspaper className="w-6 h-6" />,
    title: 'Economic Calendar',
    description: 'Track high-impact economic events worldwide with real-time updates, forecasts, and timezone support.',
    color: 'from-blue-500/20 to-blue-500/5',
    borderColor: 'border-blue-500/30',
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: 'Live Market Data',
    description: 'Monitor cryptocurrency prices in real-time with auto-refreshing data directly from Binance.',
    color: 'from-bullish/20 to-bullish/5',
    borderColor: 'border-bullish/30',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Chart Analysis',
    description: 'Upload any chart and get instant AI-powered technical analysis with key support/resistance levels.',
    color: 'from-purple-500/20 to-purple-500/5',
    borderColor: 'border-purple-500/30',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Risk Management',
    description: 'Built-in tools to manage your risk per trade, ensuring disciplined and consistent trading.',
    color: 'from-bearish/20 to-bearish/5',
    borderColor: 'border-bearish/30',
  },
];

export const Dashboard: React.FC = () => {
  const [cryptoAssets, setCryptoAssets] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const initialFetchDone = useRef(false);

  const fetchMarketData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const prices = await getCryptoPrices();
      
      if (prices.length > 0) {
        const cryptoData: Stock[] = prices.map((p: CryptoTicker) => ({
          symbol: p.symbol,
          name: p.name,
          price: p.price,
          change: p.change,
          changePercent: p.changePercent,
          market: 'crypto' as const,
        }));
        
        setCryptoAssets(cryptoData);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setLoading(false);
    }
  };


  // Auto-fetch on mount and every 5 seconds for live updates
  useEffect(() => {
    if (!initialFetchDone.current) {
      fetchMarketData(true);
      initialFetchDone.current = true;
    }
    
    const interval = setInterval(() => fetchMarketData(false), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="text-center space-y-4 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold">
          Welcome to <span className="gradient-text">TA5</span> Pro
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Your all-in-one AI-powered trading companion. Track live cryptocurrency prices, generate smart buy/sell signals, calculate precise lot sizes, and stay ahead with real-time economic news — all in one place.
        </p>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-card/50 border border-border/50 animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-bullish animate-pulse"></div>
          <span className="text-sm text-muted-foreground">Live</span>
        </div>
        {lastUpdated && (
          <span className="text-xs text-muted-foreground">
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Features Section */}
      {/* Loading State */}
      {loading && cryptoAssets.length === 0 && (
        <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Loading...</span>
          </div>
        </div>
      )}

      {/* Live Market Ticker */}
      {cryptoAssets.length > 0 && (
        <div className="relative overflow-hidden py-4 rounded-xl bg-card/50 border border-border/50 animate-fade-in">
          <div className="flex animate-ticker gap-8">
            {[...cryptoAssets, ...cryptoAssets].map((stock, i) => (
              <div 
                key={`${stock.symbol}-${i}`} 
                className="flex items-center gap-3 whitespace-nowrap"
              >
                <span className="font-semibold">{stock.symbol}</span>
                <span className="font-mono">${stock.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <span className={stock.change >= 0 ? 'text-bullish' : 'text-bearish'}>
                  {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crypto Section */}
      {cryptoAssets.length > 0 && (
        <div className="space-y-6">
          <MarketSection
            title="Cryptocurrency"
            icon={<Bitcoin className="w-5 h-5" />}
            stocks={cryptoAssets}
          />
        </div>
      )}

      {/* Features Section */}
      <div className="space-y-4 animate-fade-in">
        <h2 className="text-xl font-semibold text-center">
          Everything you need for <span className="text-primary">smarter trading</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`p-5 rounded-xl bg-gradient-to-br ${feature.color} border ${feature.borderColor} hover:scale-[1.02] transition-all duration-300`}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-background/50 text-foreground shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
