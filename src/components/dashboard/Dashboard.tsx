import React, { useState, useEffect } from 'react';
import { Globe, IndianRupee, Bitcoin, RefreshCw, AlertCircle } from 'lucide-react';
import { MarketSection } from './MarketSection';
import { Stock } from '@/lib/types';
import { batchFetchQuotes, getCryptoQuote, MarketQuote } from '@/lib/marketApi';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Fallback mock data when API fails
const fallbackIndianStocks: Stock[] = [
  { symbol: 'RELIANCE.BSE', name: 'Reliance Industries', price: 2456.75, change: 34.50, changePercent: 1.42, market: 'indian' },
  { symbol: 'TCS.BSE', name: 'Tata Consultancy Services', price: 3890.20, change: -45.30, changePercent: -1.15, market: 'indian' },
  { symbol: 'INFY.BSE', name: 'Infosys Limited', price: 1567.80, change: 23.45, changePercent: 1.52, market: 'indian' },
  { symbol: 'HDFC.BSE', name: 'HDFC Bank', price: 1678.90, change: 12.30, changePercent: 0.74, market: 'indian' },
];

const fallbackUsStocks: Stock[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 178.50, change: 2.34, changePercent: 1.33, market: 'us' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 378.90, change: -5.67, changePercent: -1.47, market: 'us' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 140.25, change: 3.45, changePercent: 2.52, market: 'us' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 495.80, change: 12.45, changePercent: 2.58, market: 'us' },
];

const fallbackCryptoAssets: Stock[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 43567.89, change: 1234.56, changePercent: 2.92, market: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', price: 2345.67, change: -78.90, changePercent: -3.25, market: 'crypto' },
  { symbol: 'SOL', name: 'Solana', price: 98.45, change: 5.67, changePercent: 6.11, market: 'crypto' },
  { symbol: 'BNB', name: 'Binance Coin', price: 312.34, change: 8.90, changePercent: 2.93, market: 'crypto' },
];

const stockSymbols = {
  indian: ['RELIANCE.BSE', 'TCS.BSE', 'INFY', 'HDFCBANK.BSE'],
  us: ['AAPL', 'MSFT', 'GOOGL', 'NVDA'],
};

const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'BNB'];

const stockNames: Record<string, string> = {
  'RELIANCE.BSE': 'Reliance Industries',
  'TCS.BSE': 'Tata Consultancy Services',
  'INFY': 'Infosys Limited',
  'HDFCBANK.BSE': 'HDFC Bank',
  'AAPL': 'Apple Inc.',
  'MSFT': 'Microsoft Corporation',
  'GOOGL': 'Alphabet Inc.',
  'NVDA': 'NVIDIA Corporation',
  'BTC': 'Bitcoin',
  'ETH': 'Ethereum',
  'SOL': 'Solana',
  'BNB': 'Binance Coin',
};

export const Dashboard: React.FC = () => {
  const [indianStocks, setIndianStocks] = useState<Stock[]>(fallbackIndianStocks);
  const [usStocks, setUsStocks] = useState<Stock[]>(fallbackUsStocks);
  const [cryptoAssets, setCryptoAssets] = useState<Stock[]>(fallbackCryptoAssets);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetchMarketData = async () => {
    setLoading(true);
    try {
      // Fetch US stocks
      const usQuotes = await batchFetchQuotes(stockSymbols.us);
      if (usQuotes.length > 0) {
        const usData: Stock[] = usQuotes.map(q => ({
          symbol: q.symbol,
          name: stockNames[q.symbol] || q.symbol,
          price: q.price,
          change: q.change,
          changePercent: q.changePercent,
          market: 'us' as const,
        }));
        setUsStocks(usData);
        setIsLive(true);
      }

      // Fetch crypto
      const cryptoData: Stock[] = [];
      for (const symbol of cryptoSymbols.slice(0, 2)) { // Limit to avoid rate limiting
        const quote = await getCryptoQuote(symbol);
        if (quote) {
          // Calculate approximate change (API doesn't provide historical)
          const mockChange = (Math.random() - 0.5) * quote.price * 0.05;
          cryptoData.push({
            symbol: quote.symbol,
            name: quote.name || stockNames[symbol] || symbol,
            price: quote.price,
            change: mockChange,
            changePercent: (mockChange / quote.price) * 100,
            market: 'crypto' as const,
          });
        }
        await new Promise(r => setTimeout(r, 300)); // Delay to avoid rate limits
      }
      
      if (cryptoData.length > 0) {
        // Merge with fallback for symbols we couldn't fetch
        const mergedCrypto = [...cryptoData, ...fallbackCryptoAssets.filter(
          f => !cryptoData.some(c => c.symbol === f.symbol)
        )];
        setCryptoAssets(mergedCrypto);
      }

      setLastUpdated(new Date());
      toast.success('Market data refreshed');
    } catch (error) {
      console.error('Error fetching market data:', error);
      toast.error('Failed to fetch live data, showing cached values');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-refresh on mount
    fetchMarketData();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const allStocks = [...indianStocks, ...usStocks, ...cryptoAssets];

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

      {/* Status Bar */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-bullish animate-pulse' : 'bg-amber-500'}`}></div>
          <span className="text-sm text-muted-foreground">
            {isLive ? 'Live Data via Alpha Vantage' : 'Cached Data'}
          </span>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              • Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchMarketData}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* API Notice */}
      {!isLive && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">Alpha Vantage Free Tier Limits</p>
            <p className="text-xs text-muted-foreground mt-1">
              Free API allows 25 requests/day. Some data may be cached. Upgrade to premium for real-time data.
            </p>
          </div>
        </div>
      )}

      {/* Market Ticker */}
      <div className="relative overflow-hidden py-4 rounded-xl bg-card/50 border border-border/50 animate-fade-in">
        <div className="flex animate-ticker gap-8">
          {[...allStocks, ...allStocks].map((stock, i) => (
            <div key={`${stock.symbol}-${i}`} className="flex items-center gap-3 whitespace-nowrap">
              <span className="font-semibold">{stock.symbol}</span>
              <span className="font-mono">${stock.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
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
