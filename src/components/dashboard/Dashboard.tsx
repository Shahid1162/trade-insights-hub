import React, { useState, useEffect, useCallback } from 'react';
import { Bitcoin, RefreshCw, AlertCircle, Wifi, WifiOff, Search } from 'lucide-react';
import { MarketSection } from './MarketSection';
import { CryptoChartModal } from './CryptoChartModal';
import { Stock } from '@/lib/types';
import { getCryptoPrices, searchCrypto, CryptoTicker } from '@/lib/binanceApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useRealtimePrices, simulatePriceMovement } from '@/hooks/useRealtimePrices';

// Fallback mock data when API fails
const fallbackCryptoAssets: Stock[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 43567.89, change: 1234.56, changePercent: 2.92, market: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', price: 2345.67, change: -78.90, changePercent: -3.25, market: 'crypto' },
  { symbol: 'SOL', name: 'Solana', price: 98.45, change: 5.67, changePercent: 6.11, market: 'crypto' },
  { symbol: 'BNB', name: 'Binance Coin', price: 312.34, change: 8.90, changePercent: 2.93, market: 'crypto' },
  { symbol: 'XRP', name: 'Ripple', price: 0.62, change: 0.03, changePercent: 5.12, market: 'crypto' },
  { symbol: 'ADA', name: 'Cardano', price: 0.45, change: -0.02, changePercent: -4.23, market: 'crypto' },
  { symbol: 'DOGE', name: 'Dogecoin', price: 0.08, change: 0.01, changePercent: 12.5, market: 'crypto' },
  { symbol: 'DOT', name: 'Polkadot', price: 7.23, change: 0.34, changePercent: 4.93, market: 'crypto' },
];

export const Dashboard: React.FC = () => {
  const [cryptoAssets, setCryptoAssets] = useState<Stock[]>(fallbackCryptoAssets);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Chart modal state
  const [selectedCrypto, setSelectedCrypto] = useState<{ symbol: string; name: string } | null>(null);

  // Handle real-time price updates
  const handlePriceUpdate = useCallback((update: { stocks: Stock[]; market: 'indian' | 'us' | 'crypto'; timestamp: number }) => {
    if (update.market === 'crypto') {
      setCryptoAssets(update.stocks);
      setLastUpdated(new Date(update.timestamp));
    }
  }, []);

  const { broadcastPriceUpdate } = useRealtimePrices({
    onPriceUpdate: handlePriceUpdate,
    onConnectionChange: setIsConnected,
  });

  const fetchMarketData = async () => {
    setLoading(true);
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
        setIsLive(true);
        
        // Broadcast to other clients
        broadcastPriceUpdate({
          stocks: cryptoData,
          market: 'crypto',
          timestamp: Date.now(),
        });
      }

      setLastUpdated(new Date());
      toast.success('Live crypto data refreshed');
    } catch (error) {
      console.error('Error fetching market data:', error);
      toast.error('Failed to fetch live data, showing cached values');
    } finally {
      setLoading(false);
    }
  };

  // Search for crypto
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchCrypto(searchQuery);
      const searchData: Stock[] = results.map((r) => ({
        symbol: r.symbol,
        name: r.name,
        price: 0,
        change: 0,
        changePercent: 0,
        market: 'crypto' as const,
      }));
      setSearchResults(searchData);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle crypto click to show chart
  const handleCryptoClick = (symbol: string, name: string) => {
    setSelectedCrypto({ symbol, name });
  };

  // Start/stop simulated real-time streaming
  const toggleStreaming = () => {
    setIsStreaming(prev => !prev);
    if (!isStreaming) {
      toast.success('Real-time streaming started');
    } else {
      toast.info('Real-time streaming stopped');
    }
  };

  // Simulated real-time price updates
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      const updatedCrypto = simulatePriceMovement(cryptoAssets);
      setCryptoAssets(updatedCrypto);
      setLastUpdated(new Date());
      broadcastPriceUpdate({ stocks: updatedCrypto, market: 'crypto', timestamp: Date.now() });
    }, 2000);

    return () => clearInterval(interval);
  }, [isStreaming, cryptoAssets, broadcastPriceUpdate]);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30 * 1000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Search on enter key
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const displayedCryptos = searchResults.length > 0 ? searchResults : cryptoAssets;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold">
          Welcome to <span className="gradient-text">TA5</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Your comprehensive crypto trading analysis platform. Monitor live cryptocurrency prices and analyze candlestick charts.
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 max-w-md mx-auto animate-fade-in">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search cryptocurrency..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {isSearching && (
          <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-card/50 border border-border/50 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-bullish" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-bullish animate-pulse' : isLive ? 'bg-bullish' : 'bg-amber-500'}`}></div>
            <span className="text-sm text-muted-foreground">
              {isStreaming ? 'Streaming Live' : isLive ? 'Binance Live' : 'Cached Data'}
            </span>
          </div>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Last: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isStreaming ? 'gradient' : 'outline'}
            size="sm"
            onClick={toggleStreaming}
          >
            {isStreaming ? (
              <>
                <div className="w-2 h-2 rounded-full bg-white animate-pulse mr-2" />
                Stop Stream
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 mr-2" />
                Start Stream
              </>
            )}
          </Button>
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
      </div>

      {/* API Notice */}
      {!isLive && !isStreaming && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">Connecting to Binance...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Fetching live cryptocurrency data from Binance. Click on any crypto to view the live candlestick chart.
            </p>
          </div>
        </div>
      )}

      {/* Market Ticker */}
      <div className="relative overflow-hidden py-4 rounded-xl bg-card/50 border border-border/50 animate-fade-in">
        <div className="flex animate-ticker gap-8">
          {[...cryptoAssets, ...cryptoAssets].filter(s => s?.price != null).map((stock, i) => (
            <div 
              key={`${stock.symbol}-${i}`} 
              className="flex items-center gap-3 whitespace-nowrap cursor-pointer hover:text-primary transition-colors"
              onClick={() => handleCryptoClick(stock.symbol, stock.name)}
            >
              <span className="font-semibold">{stock.symbol}</span>
              <span className="font-mono">${(stock.price ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span className={(stock.change ?? 0) >= 0 ? 'text-bullish' : 'text-bearish'}>
                {(stock.change ?? 0) >= 0 ? '+' : ''}{(stock.changePercent ?? 0).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Crypto Section */}
      <div className="space-y-8">
        <MarketSection
          title="Cryptocurrency"
          icon={<Bitcoin className="w-5 h-5" />}
          stocks={displayedCryptos}
          onStockClick={handleCryptoClick}
        />
      </div>

      {/* Chart Modal */}
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
