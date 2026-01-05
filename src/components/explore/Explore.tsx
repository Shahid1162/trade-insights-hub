import React, { useState } from 'react';
import { Search, Plus, Trash2, TrendingUp, TrendingDown, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { Stock } from '@/lib/types';
import { searchSymbols, getStockQuote, SearchResult } from '@/lib/marketApi';
import { toast } from 'sonner';

export const Explore: React.FC = () => {
  const { isAuthenticated, setShowAuthModal, setAuthMode } = useAuth();
  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!isAuthenticated) {
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      // First search for matching symbols
      const results: SearchResult[] = await searchSymbols(searchQuery);
      
      if (results.length === 0) {
        toast.info('No results found');
        setSearchResults([]);
        setLoading(false);
        return;
      }

      // Get quotes for top results
      const stockResults: Stock[] = [];
      for (const result of results.slice(0, 5)) {
        const quote = await getStockQuote(result.symbol);
        if (quote && quote.price) {
          stockResults.push({
            symbol: result.symbol,
            name: result.name,
            price: quote.price,
            change: quote.change || 0,
            changePercent: quote.changePercent || 0,
            market: result.region === 'United States' ? 'us' : 'indian',
          });
        } else {
          // Add without price data
          stockResults.push({
            symbol: result.symbol,
            name: result.name,
            price: 0,
            change: 0,
            changePercent: 0,
            market: result.region === 'United States' ? 'us' : 'indian',
          });
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
      }

      setSearchResults(stockResults);
      toast.success(`Found ${stockResults.length} results`);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
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
          Search for stocks, cryptocurrencies, and more using live Alpha Vantage data.
        </p>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search stocks, crypto, indices... (e.g., AAPL, MSFT, BTC)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full trading-input pl-12 pr-28"
          />
          <Button
            variant="gradient"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Powered by Alpha Vantage API • Real-time market data
        </p>
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
            {loading ? (
              <div className="text-center py-12 animate-fade-in">
                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-muted-foreground">Searching Alpha Vantage...</p>
              </div>
            ) : searchResults.length > 0 ? (
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
                            {stock.price > 0 
                              ? `$${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` 
                              : 'N/A'}
                          </p>
                          {stock.price > 0 && (
                            <p className={`text-sm font-medium ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
                              {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                            </p>
                          )}
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
                <p className="text-sm mt-2">Try: AAPL, MSFT, GOOGL, TSLA, BTC</p>
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
