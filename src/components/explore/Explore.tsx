import React, { useState } from 'react';
import { Search, Plus, Trash2, TrendingUp, TrendingDown, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { Stock } from '@/lib/types';
import { toast } from 'sonner';

// Mock search results
const mockSearchResults: Stock[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 178.50, change: 2.34, changePercent: 1.33, market: 'us' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 378.90, change: -5.67, changePercent: -1.47, market: 'us' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 140.25, change: 3.45, changePercent: 2.52, market: 'us' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 245.80, change: 8.45, changePercent: 3.56, market: 'us' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 155.20, change: -2.30, changePercent: -1.46, market: 'us' },
  { symbol: 'BTC', name: 'Bitcoin', price: 43567.89, change: 1234.56, changePercent: 2.92, market: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', price: 2345.67, change: -78.90, changePercent: -3.25, market: 'crypto' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', price: 2456.75, change: 34.50, changePercent: 1.42, market: 'indian' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', price: 3890.20, change: -45.30, changePercent: -1.15, market: 'indian' },
];

export const Explore: React.FC = () => {
  const { isAuthenticated, setShowAuthModal, setAuthMode } = useAuth();
  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [showWatchlist, setShowWatchlist] = useState(false);

  const handleSearch = () => {
    if (!isAuthenticated) {
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    // Filter mock results based on query
    const results = mockSearchResults.filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setSearchResults(results);
  };

  const handleAddToWatchlist = (stock: Stock) => {
    if (!isAuthenticated) {
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }
    addToWatchlist({
      symbol: stock.symbol,
      name: stock.name,
      price: stock.price,
      change: stock.change,
      changePercent: stock.changePercent,
    });
    toast.success(`${stock.symbol} added to watchlist`);
  };

  const handleRemoveFromWatchlist = (symbol: string) => {
    removeFromWatchlist(symbol);
    toast.success(`${symbol} removed from watchlist`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4 animate-fade-in">
        <h1 className="text-4xl font-bold">
          <span className="gradient-text">Explore</span> Markets
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Search for stocks, cryptocurrencies, and more. Add your favorites to your watchlist.
        </p>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search stocks, crypto, indices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full trading-input pl-12 pr-24"
          />
          <Button
            variant="gradient"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={handleSearch}
          >
            Search
          </Button>
        </div>
      </div>

      {/* Toggle Buttons */}
      <div className="flex justify-center gap-4 animate-fade-in">
        <Button
          variant={!showWatchlist ? 'gradient' : 'outline'}
          onClick={() => setShowWatchlist(false)}
        >
          <Search className="w-4 h-4 mr-2" />
          Search Results
        </Button>
        <Button
          variant={showWatchlist ? 'gradient' : 'outline'}
          onClick={() => setShowWatchlist(true)}
        >
          <Star className="w-4 h-4 mr-2" />
          Watchlist ({watchlist.length})
        </Button>
      </div>

      {/* Results / Watchlist */}
      <div className="space-y-4">
        {!showWatchlist ? (
          <>
            {searchResults.length > 0 ? (
              <div className="grid gap-4">
                {searchResults.map((stock, index) => {
                  const isPositive = stock.change >= 0;
                  const inWatchlist = isInWatchlist(stock.symbol);
                  return (
                    <div
                      key={stock.symbol}
                      className="p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all animate-fade-in flex items-center justify-between"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${isPositive ? 'bg-bullish/10' : 'bg-bearish/10'}`}>
                          {isPositive ? (
                            <TrendingUp className="w-5 h-5 text-bullish" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-bearish" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{stock.symbol}</h3>
                          <p className="text-sm text-muted-foreground">{stock.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xl font-mono font-bold">
                            ${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <p className={`text-sm font-medium ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
                            {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                          </p>
                        </div>
                        <Button
                          variant={inWatchlist ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => inWatchlist ? handleRemoveFromWatchlist(stock.symbol) : handleAddToWatchlist(stock)}
                        >
                          {inWatchlist ? <Trash2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground animate-fade-in">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Search for stocks, cryptocurrencies, or indices to get started</p>
              </div>
            )}
          </>
        ) : (
          <>
            {watchlist.length > 0 ? (
              <div className="grid gap-4">
                {watchlist.map((item, index) => {
                  const isPositive = item.change >= 0;
                  return (
                    <div
                      key={item.symbol}
                      className="p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all animate-fade-in flex items-center justify-between"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${isPositive ? 'bg-bullish/10' : 'bg-bearish/10'}`}>
                          {isPositive ? (
                            <TrendingUp className="w-5 h-5 text-bullish" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-bearish" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{item.symbol}</h3>
                          <p className="text-sm text-muted-foreground">{item.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xl font-mono font-bold">
                            ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <p className={`text-sm font-medium ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
                            {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveFromWatchlist(item.symbol)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground animate-fade-in">
                <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Your watchlist is empty. Search and add stocks to get started.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
