import { supabase } from "@/integrations/supabase/client";

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
}

export interface CryptoQuote {
  symbol: string;
  name: string;
  price: number;
  bidPrice?: number;
  askPrice?: number;
}

export interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Get a single stock quote
export async function getStockQuote(symbol: string): Promise<MarketQuote | null> {
  try {
    const { data, error } = await supabase.functions.invoke('market-data', {
      body: { action: 'quote', symbol },
    });

    if (error) throw error;
    return data?.data || null;
  } catch (error) {
    console.error('Error fetching stock quote:', error);
    return null;
  }
}

// Search for symbols
export async function searchSymbols(keywords: string): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabase.functions.invoke('market-data', {
      body: { action: 'search', symbol: keywords },
    });

    if (error) throw error;
    return data?.data || [];
  } catch (error) {
    console.error('Error searching symbols:', error);
    return [];
  }
}

// Get crypto quote
export async function getCryptoQuote(symbol: string): Promise<CryptoQuote | null> {
  try {
    const { data, error } = await supabase.functions.invoke('market-data', {
      body: { action: 'crypto', symbol },
    });

    if (error) throw error;
    return data?.data || null;
  } catch (error) {
    console.error('Error fetching crypto quote:', error);
    return null;
  }
}

// Get forex quote
export async function getForexQuote(pair: string): Promise<MarketQuote | null> {
  try {
    const { data, error } = await supabase.functions.invoke('market-data', {
      body: { action: 'forex', symbol: pair },
    });

    if (error) throw error;
    return data?.data || null;
  } catch (error) {
    console.error('Error fetching forex quote:', error);
    return null;
  }
}

// Get intraday data for charts
export async function getIntradayData(symbol: string): Promise<CandlestickData[]> {
  try {
    const { data, error } = await supabase.functions.invoke('market-data', {
      body: { action: 'intraday', symbol },
    });

    if (error) throw error;
    return data?.data || [];
  } catch (error) {
    console.error('Error fetching intraday data:', error);
    return [];
  }
}

// Batch fetch multiple quotes
export async function batchFetchQuotes(symbols: string[]): Promise<MarketQuote[]> {
  try {
    const { data, error } = await supabase.functions.invoke('market-data', {
      body: { action: 'batch', symbol: symbols.join(',') },
    });

    if (error) throw error;
    return data?.data || [];
  } catch (error) {
    console.error('Error batch fetching quotes:', error);
    return [];
  }
}
