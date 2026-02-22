export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high?: number;
  low?: number;
  prevClose?: number;
  volume?: number;
  market: 'indian' | 'us' | 'crypto';
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  addedAt: Date;
}

export interface SignalAnalysis {
  type: 'intraday' | 'swing' | 'positional';
  instrument?: string;
  entry: number;
  takeProfit: number;
  takeProfit2?: number;
  takeProfit3?: number;
  stopLoss: number;
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  analysis: string;
}

export interface LotSizeResult {
  lotSize: number;
  riskAmount: number;
  pipValue: number;
}

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  time: string;
  impact: 'low' | 'medium' | 'high';
  actual?: string;
  forecast?: string;
  previous?: string;
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'buyStop' | 'sellStop';
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  quantity: number;
  pnl: number;
  status: 'open' | 'closed' | 'pending';
}
