import { supabase } from "@/integrations/supabase/client";

export interface CryptoTicker {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  pair: string;
}

// Get all popular crypto prices
export async function getCryptoPrices(): Promise<CryptoTicker[]> {
  try {
    const { data, error } = await supabase.functions.invoke('binance-market', {
      body: { action: 'prices' },
    });

    if (error) throw error;
    return data?.data || [];
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    return [];
  }
}

// Get single crypto ticker
export async function getCryptoTicker(symbol: string): Promise<CryptoTicker | null> {
  try {
    const { data, error } = await supabase.functions.invoke('binance-market', {
      body: { action: 'ticker', symbol },
    });

    if (error) throw error;
    return data?.data || null;
  } catch (error) {
    console.error('Error fetching crypto ticker:', error);
    return null;
  }
}

// Get candlestick data for charts
export async function getCryptoKlines(
  symbol: string, 
  interval: string = '1m', 
  limit: number = 100
): Promise<CandlestickData[]> {
  try {
    const { data, error } = await supabase.functions.invoke('binance-market', {
      body: { action: 'klines', symbol, interval, limit },
    });

    if (error) throw error;
    return data?.data || [];
  } catch (error) {
    console.error('Error fetching crypto klines:', error);
    return [];
  }
}

// Search for crypto symbols
export async function searchCrypto(keyword: string): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabase.functions.invoke('binance-market', {
      body: { action: 'search', symbol: keyword },
    });

    if (error) throw error;
    return data?.data || [];
  } catch (error) {
    console.error('Error searching crypto:', error);
    return [];
  }
}
