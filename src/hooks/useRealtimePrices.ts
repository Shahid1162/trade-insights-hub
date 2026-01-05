import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Stock } from '@/lib/types';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PriceUpdate {
  stocks: Stock[];
  market: 'indian' | 'us' | 'crypto';
  timestamp: number;
}

interface UseRealtimePricesProps {
  onPriceUpdate: (update: PriceUpdate) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export const useRealtimePrices = ({ onPriceUpdate, onConnectionChange }: UseRealtimePricesProps) => {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const connect = useCallback(() => {
    if (channelRef.current) return;

    console.log('[Realtime] Connecting to price channel...');
    
    const channel = supabase.channel('market-prices', {
      config: {
        broadcast: { self: true },
      },
    });

    channel
      .on('broadcast', { event: 'price-update' }, (payload) => {
        console.log('[Realtime] Received price update:', payload);
        if (payload.payload) {
          onPriceUpdate(payload.payload as PriceUpdate);
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          onConnectionChange?.(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          onConnectionChange?.(false);
        }
      });

    channelRef.current = channel;
  }, [onPriceUpdate, onConnectionChange]);

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      console.log('[Realtime] Disconnecting from price channel...');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      onConnectionChange?.(false);
    }
  }, [onConnectionChange]);

  const broadcastPriceUpdate = useCallback((update: PriceUpdate) => {
    if (channelRef.current) {
      console.log('[Realtime] Broadcasting price update:', update.market);
      channelRef.current.send({
        type: 'broadcast',
        event: 'price-update',
        payload: update,
      });
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connect, disconnect, broadcastPriceUpdate };
};

// Simulated price movement generator for demo purposes
export const simulatePriceMovement = (stocks: Stock[]): Stock[] => {
  return stocks.map(stock => {
    const volatility = stock.market === 'crypto' ? 0.02 : 0.005;
    const priceChange = (Math.random() - 0.5) * 2 * volatility * (stock.price || 100);
    const newPrice = (stock.price || 100) + priceChange;
    const change = priceChange;
    const changePercent = ((change / (stock.price || 100)) * 100);
    
    return {
      ...stock,
      price: parseFloat(newPrice.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
    };
  });
};
