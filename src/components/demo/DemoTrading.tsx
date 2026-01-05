import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  createChart, 
  ColorType, 
  IChartApi, 
  ISeriesApi, 
  CandlestickData, 
  CandlestickSeries,
  LineSeries,
  IPriceLine
} from 'lightweight-charts';
import { 
  Play, Pause, Search, X, ArrowUpCircle, ArrowDownCircle, 
  Target, AlertCircle, Loader2, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { searchSymbols, getIntradayData, getStockQuote, SearchResult } from '@/lib/marketApi';

interface Order {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  price: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'open' | 'pending';
  slLine?: IPriceLine;
  tpLine?: IPriceLine;
  entryLine?: IPriceLine;
}

// Generate mock candlestick data for a symbol
const generateMockDataForSymbol = (basePrice: number): CandlestickData[] => {
  const data: CandlestickData[] = [];
  let price = basePrice;
  const now = new Date();
  
  for (let i = 200; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60000);
    const volatility = basePrice * 0.002;
    const open = price + (Math.random() - 0.5) * volatility;
    const close = open + (Math.random() - 0.5) * volatility * 1.5;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    
    data.push({
      time: (time.getTime() / 1000) as any,
      open,
      high,
      low,
      close,
    });
    
    price = close;
  }
  
  return data;
};

export const DemoTrading: React.FC = () => {
  const { isAuthenticated, setShowAuthModal, setAuthMode } = useAuth();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [balance, setBalance] = useState(10000);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentPrice, setCurrentPrice] = useState(100);
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [quantity, setQuantity] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState({ symbol: 'AAPL', name: 'Apple Inc.' });
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  
  // Draggable SL/TP state
  const [stopLoss, setStopLoss] = useState<number | null>(null);
  const [takeProfit, setTakeProfit] = useState<number | null>(null);
  const [isDraggingSL, setIsDraggingSL] = useState(false);
  const [isDraggingTP, setIsDraggingTP] = useState(false);
  
  // Price lines refs
  const slLineRef = useRef<IPriceLine | null>(null);
  const tpLineRef = useRef<IPriceLine | null>(null);

  // Search for symbols
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);
    
    try {
      const results = await searchSymbols(query);
      setSearchResults(results.slice(0, 8));
    } catch (error) {
      console.error('Search error:', error);
      // Fallback mock results
      setSearchResults([
        { symbol: 'AAPL', name: 'Apple Inc.', type: 'Equity', region: 'United States', currency: 'USD' },
        { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'Equity', region: 'United States', currency: 'USD' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'Equity', region: 'United States', currency: 'USD' },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'Equity', region: 'United States', currency: 'USD' },
        { symbol: 'TSLA', name: 'Tesla Inc.', type: 'Equity', region: 'United States', currency: 'USD' },
      ].filter(s => s.symbol.toLowerCase().includes(query.toLowerCase()) || s.name.toLowerCase().includes(query.toLowerCase())));
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Load chart data for selected symbol
  const loadSymbolData = useCallback(async (symbol: string, name: string) => {
    setIsLoadingChart(true);
    setSelectedSymbol({ symbol, name });
    setShowSearchResults(false);
    setSearchQuery('');
    
    try {
      // Try to get live quote first
      const quote = await getStockQuote(symbol);
      const basePrice = quote?.price || 150 + Math.random() * 100;
      
      // Generate or fetch chart data
      const chartData = generateMockDataForSymbol(basePrice);
      
      if (seriesRef.current) {
        seriesRef.current.setData(chartData as any);
        setCurrentPrice(chartData[chartData.length - 1].close);
        
        // Reset SL/TP
        setStopLoss(null);
        setTakeProfit(null);
        removePriceLines();
      }
      
      toast.success(`Loaded ${symbol}`);
    } catch (error) {
      console.error('Error loading symbol:', error);
      toast.error('Failed to load symbol data');
    } finally {
      setIsLoadingChart(false);
    }
  }, []);

  // Remove price lines
  const removePriceLines = useCallback(() => {
    if (seriesRef.current) {
      if (slLineRef.current) {
        seriesRef.current.removePriceLine(slLineRef.current);
        slLineRef.current = null;
      }
      if (tpLineRef.current) {
        seriesRef.current.removePriceLine(tpLineRef.current);
        tpLineRef.current = null;
      }
    }
  }, []);

  // Update SL price line
  const updateSLLine = useCallback((price: number) => {
    if (!seriesRef.current) return;
    
    if (slLineRef.current) {
      seriesRef.current.removePriceLine(slLineRef.current);
    }
    
    slLineRef.current = seriesRef.current.createPriceLine({
      price,
      color: '#ef4444',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: 'SL',
    });
    
    setStopLoss(price);
  }, []);

  // Update TP price line
  const updateTPLine = useCallback((price: number) => {
    if (!seriesRef.current) return;
    
    if (tpLineRef.current) {
      seriesRef.current.removePriceLine(tpLineRef.current);
    }
    
    tpLineRef.current = seriesRef.current.createPriceLine({
      price,
      color: '#22c55e',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: 'TP',
    });
    
    setTakeProfit(price);
  }, []);

  // Handle chart click for SL/TP placement
  const handleChartClick = useCallback((param: any) => {
    if (!param.point || !seriesRef.current) return;
    
    const price = seriesRef.current.coordinateToPrice(param.point.y);
    if (!price) return;

    if (isDraggingSL) {
      updateSLLine(price as number);
      setIsDraggingSL(false);
      toast.success(`Stop Loss set at $${(price as number).toFixed(2)}`);
    } else if (isDraggingTP) {
      updateTPLine(price as number);
      setIsDraggingTP(false);
      toast.success(`Take Profit set at $${(price as number).toFixed(2)}`);
    }
  }, [isDraggingSL, isDraggingTP, updateSLLine, updateTPLine]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

    const initialData = generateMockDataForSymbol(178.5);
    candlestickSeries.setData(initialData as any);
    setCurrentPrice(initialData[initialData.length - 1].close);

    chartRef.current = chart;
    seriesRef.current = candlestickSeries as any;

    // Subscribe to click events
    chart.subscribeClick(handleChartClick);

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.unsubscribeClick(handleChartClick);
      chart.remove();
    };
  }, []);

  // Update click handler when dragging state changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.unsubscribeClick(handleChartClick);
      chartRef.current.subscribeClick(handleChartClick);
    }
  }, [handleChartClick]);

  // Update chart with live data
  useEffect(() => {
    if (!isPlaying || !seriesRef.current) return;

    const interval = setInterval(() => {
      const lastPrice = currentPrice;
      const volatility = lastPrice * 0.001;
      const change = (Math.random() - 0.5) * volatility * 2;
      const newClose = lastPrice + change;
      const newOpen = lastPrice;
      const newHigh = Math.max(newOpen, newClose) + Math.random() * volatility * 0.3;
      const newLow = Math.min(newOpen, newClose) - Math.random() * volatility * 0.3;

      const newCandle: CandlestickData = {
        time: (Date.now() / 1000) as any,
        open: newOpen,
        high: newHigh,
        low: newLow,
        close: newClose,
      };

      seriesRef.current?.update(newCandle);
      setCurrentPrice(newClose);

      // Check SL/TP for open orders
      orders.forEach(order => {
        if (order.status === 'open') {
          if (order.stopLoss && ((order.type === 'buy' && newClose <= order.stopLoss) || (order.type === 'sell' && newClose >= order.stopLoss))) {
            closeOrderAtPrice(order.id, order.stopLoss, 'Stop Loss hit');
          } else if (order.takeProfit && ((order.type === 'buy' && newClose >= order.takeProfit) || (order.type === 'sell' && newClose <= order.takeProfit))) {
            closeOrderAtPrice(order.id, order.takeProfit, 'Take Profit hit');
          }
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentPrice, orders]);

  const closeOrderAtPrice = (orderId: string, closePrice: number, reason: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const pnl = order.type === 'buy' 
      ? (closePrice - order.price) * order.quantity * 100
      : (order.price - closePrice) * order.quantity * 100;

    setBalance(prev => prev + pnl);
    setOrders(prev => prev.filter(o => o.id !== orderId));
    toast.info(`${reason}: P/L $${pnl.toFixed(2)}`);
  };

  const placeOrder = (type: 'buy' | 'sell') => {
    if (!isAuthenticated) {
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const entryPrice = orderType === 'market' ? currentPrice : parseFloat(limitPrice) || currentPrice;

    const order: Order = {
      id: Date.now().toString(),
      symbol: selectedSymbol.symbol,
      type,
      orderType,
      price: entryPrice,
      quantity: qty,
      stopLoss: stopLoss || undefined,
      takeProfit: takeProfit || undefined,
      status: orderType === 'market' ? 'open' : 'pending',
    };

    setOrders(prev => [...prev, order]);
    
    // Reset SL/TP after placing order
    setStopLoss(null);
    setTakeProfit(null);
    removePriceLines();
    
    toast.success(`${type.toUpperCase()} ${selectedSymbol.symbol} @ $${order.price.toFixed(2)}`);
  };

  const closeOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const pnl = order.type === 'buy' 
      ? (currentPrice - order.price) * order.quantity * 100
      : (order.price - currentPrice) * order.quantity * 100;

    setBalance(prev => prev + pnl);
    setOrders(prev => prev.filter(o => o.id !== orderId));
    toast.success(`Order closed: P/L $${pnl.toFixed(2)}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4 animate-fade-in">
        <h1 className="text-4xl font-bold">
          <span className="gradient-text">Demo</span> Trading
        </h1>
        <p className="text-muted-foreground text-lg">
          Search any symbol, trade with live charts, drag SL/TP on chart
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative animate-fade-in">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search stocks, crypto, forex..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              onFocus={() => searchQuery && setShowSearchResults(true)}
              className="pl-10 bg-card border-border"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>
        
        {/* Search Results Dropdown */}
        {showSearchResults && (
          <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            {isSearching ? (
              <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </div>
            ) : searchResults.length > 0 ? (
              <div className="max-h-80 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.symbol}
                    onClick={() => loadSymbolData(result.symbol, result.name)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold">{result.symbol}</p>
                      <p className="text-sm text-muted-foreground truncate">{result.name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{result.type}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                No results found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Account Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border/50 animate-fade-in">
        <div>
          <p className="text-sm text-muted-foreground">Virtual Balance</p>
          <p className="text-2xl font-mono font-bold text-primary">${balance.toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{selectedSymbol.symbol}</p>
          <p className="text-2xl font-mono font-bold">${currentPrice.toFixed(2)}</p>
        </div>
        <Button
          variant={isPlaying ? 'secondary' : 'gradient'}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
      </div>

      {/* Chart with Trading Controls */}
      <div className="relative rounded-xl bg-card border border-border/50 overflow-hidden animate-fade-in">
        {/* Chart Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">{selectedSymbol.symbol}</h3>
              <p className="text-xs text-muted-foreground">{selectedSymbol.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-mono font-bold ${currentPrice > 0 ? '' : ''}`}>
              ${currentPrice.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Chart Container */}
        <div className="relative">
          {isLoadingChart && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
          <div ref={chartContainerRef} className="w-full" />
          
          {/* On-Chart Trading Panel */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
            {/* Order Type Toggle */}
            <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2 flex gap-1">
              <button
                onClick={() => setOrderType('market')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  orderType === 'market'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                Market
              </button>
              <button
                onClick={() => setOrderType('limit')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  orderType === 'limit'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                Limit
              </button>
            </div>

            {/* Quantity Input */}
            <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2">
              <label className="text-xs text-muted-foreground">Lots</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-transparent text-sm font-mono outline-none"
                min="0.01"
                step="0.01"
              />
            </div>

            {/* Limit Price (if limit order) */}
            {orderType === 'limit' && (
              <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2">
                <label className="text-xs text-muted-foreground">Price</label>
                <input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={currentPrice.toFixed(2)}
                  className="w-full bg-transparent text-sm font-mono outline-none"
                />
              </div>
            )}

            {/* SL/TP Buttons */}
            <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2 space-y-1">
              <button
                onClick={() => {
                  setIsDraggingSL(!isDraggingSL);
                  setIsDraggingTP(false);
                }}
                className={`w-full px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  isDraggingSL
                    ? 'bg-bearish text-white'
                    : 'bg-bearish/20 text-bearish hover:bg-bearish/30'
                }`}
              >
                <AlertCircle className="w-3 h-3" />
                {isDraggingSL ? 'Click chart for SL' : stopLoss ? `SL: $${stopLoss.toFixed(2)}` : 'Set SL'}
              </button>
              <button
                onClick={() => {
                  setIsDraggingTP(!isDraggingTP);
                  setIsDraggingSL(false);
                }}
                className={`w-full px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  isDraggingTP
                    ? 'bg-bullish text-white'
                    : 'bg-bullish/20 text-bullish hover:bg-bullish/30'
                }`}
              >
                <Target className="w-3 h-3" />
                {isDraggingTP ? 'Click chart for TP' : takeProfit ? `TP: $${takeProfit.toFixed(2)}` : 'Set TP'}
              </button>
            </div>

            {/* Buy/Sell Buttons */}
            <div className="flex gap-2">
              <Button
                variant="bullish"
                size="sm"
                onClick={() => placeOrder('buy')}
                className="flex-1"
              >
                <ArrowUpCircle className="w-4 h-4 mr-1" />
                BUY
              </Button>
              <Button
                variant="bearish"
                size="sm"
                onClick={() => placeOrder('sell')}
                className="flex-1"
              >
                <ArrowDownCircle className="w-4 h-4 mr-1" />
                SELL
              </Button>
            </div>
          </div>

          {/* Drag Instruction */}
          {(isDraggingSL || isDraggingTP) && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-4 py-2 text-sm">
              Click anywhere on the chart to place {isDraggingSL ? 'Stop Loss' : 'Take Profit'}
            </div>
          )}
        </div>
      </div>

      {/* Open Orders */}
      {orders.length > 0 && (
        <div className="p-4 rounded-xl bg-card border border-border/50 animate-fade-in">
          <h3 className="font-semibold mb-4">Open Positions</h3>
          <div className="space-y-2">
            {orders.map((order) => {
              const pnl = order.type === 'buy'
                ? (currentPrice - order.price) * order.quantity * 100
                : (order.price - currentPrice) * order.quantity * 100;
              
              return (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-lg bg-muted/30 border border-border/30"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      order.type === 'buy' ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'
                    }`}>
                      {order.type.toUpperCase()}
                    </span>
                    <span className="font-semibold">{order.symbol}</span>
                    <span className="font-mono text-sm">{order.quantity} @ ${order.price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {order.stopLoss && <span className="text-bearish">SL: ${order.stopLoss.toFixed(2)}</span>}
                    {order.takeProfit && <span className="text-bullish">TP: ${order.takeProfit.toFixed(2)}</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-mono font-medium ${pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => closeOrder(order.id)}>
                      Close
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
