import React, { createContext, useContext, useState, useCallback } from 'react';
import { WatchlistItem } from '@/lib/types';

interface WatchlistContextType {
  watchlist: WatchlistItem[];
  addToWatchlist: (item: Omit<WatchlistItem, 'addedAt'>) => void;
  removeFromWatchlist: (symbol: string) => void;
  isInWatchlist: (symbol: string) => boolean;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export const WatchlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  const addToWatchlist = useCallback((item: Omit<WatchlistItem, 'addedAt'>) => {
    setWatchlist(prev => {
      if (prev.some(w => w.symbol === item.symbol)) return prev;
      return [...prev, { ...item, addedAt: new Date() }];
    });
  }, []);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setWatchlist(prev => prev.filter(w => w.symbol !== symbol));
  }, []);

  const isInWatchlist = useCallback((symbol: string) => {
    return watchlist.some(w => w.symbol === symbol);
  }, [watchlist]);

  return (
    <WatchlistContext.Provider value={{
      watchlist,
      addToWatchlist,
      removeFromWatchlist,
      isInWatchlist,
    }}>
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
};
