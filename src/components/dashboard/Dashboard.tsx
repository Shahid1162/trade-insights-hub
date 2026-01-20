import React, { useState, useEffect, useRef } from 'react';
import { Bitcoin, RefreshCw } from 'lucide-react';
import { MarketSection } from './MarketSection';
import { CryptoChartModal } from './CryptoChartModal';
import { Stock } from '@/lib/types';
import { getCryptoPrices, CryptoTicker } from '@/lib/binanceApi';

export const Dashboard: React.FC = () => {
  const [cryptoAssets, setCryptoAssets] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const initialFetchDone = useRef(false);
  
  // Chart modal state
  const [selectedCrypto, setSelectedCrypto] = useState<{ symbol: string; name: string } | null>(null);

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

  // Handle crypto click to show chart
  const handleCryptoClick = (symbol: string, name: string) => {
    setSelectedCrypto({ symbol, name });
  };

  // Auto-fetch on mount and every 5 seconds for live updates
  useEffect(() => {
    if (!initialFetchDone.current) {
      fetchMarketData(true);
      initialFetchDone.current = true;
    }
    
    const interval = setInterval(() => fetchMarketData(false), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold">
          <span className="gradient-text">TA5</span> Live Crypto
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Real-time cryptocurrency prices from Binance. Click any crypto to view live candlestick charts.
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

      {/* Loading State */}
      {loading && cryptoAssets.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Loading live prices from Binance...</span>
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
                className="flex items-center gap-3 whitespace-nowrap cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleCryptoClick(stock.symbol, stock.name)}
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
            onStockClick={handleCryptoClick}
          />
        </div>
      )}

      {/* Chart Modal - Full Screen */}
      {selectedCrypto && (
        <CryptoChartModal
          open={!!selectedCrypto}
          onClose={() => setSelectedCrypto(null)}
          symbol={selectedCrypto.symbol}
          name={selectedCrypto.name}
        />
      )}
    </div>
  );
};
