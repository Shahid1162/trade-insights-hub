import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, CandlestickSeries } from 'lightweight-charts';
import { Play, Pause, ShoppingCart, ArrowUpCircle, ArrowDownCircle, Target, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Generate mock candlestick data
const generateMockData = (): CandlestickData[] => {
  const data: CandlestickData[] = [];
  let basePrice = 100;
  const now = new Date();
  
  for (let i = 100; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60000); // 1 minute intervals
    const open = basePrice + (Math.random() - 0.5) * 2;
    const close = open + (Math.random() - 0.5) * 3;
    const high = Math.max(open, close) + Math.random() * 1;
    const low = Math.min(open, close) - Math.random() * 1;
    
    data.push({
      time: (time.getTime() / 1000) as any,
      open,
      high,
      low,
      close,
    });
    
    basePrice = close;
  }
  
  return data;
};

interface Order {
  id: string;
  type: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'buyStop' | 'sellStop';
  price: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'open' | 'pending';
}

export const DemoTrading: React.FC = () => {
  const { isAuthenticated, setShowAuthModal, setAuthMode } = useAuth();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [balance, setBalance] = useState(10000);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentPrice, setCurrentPrice] = useState(100);
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'buyStop' | 'sellStop'>('market');
  const [quantity, setQuantity] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

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
      height: 400,
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
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

    const initialData = generateMockData();
    candlestickSeries.setData(initialData as any);
    setCurrentPrice(initialData[initialData.length - 1].close);

    chartRef.current = chart;
    seriesRef.current = candlestickSeries as any;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update chart with new data
  useEffect(() => {
    if (!isPlaying || !seriesRef.current) return;

    const interval = setInterval(() => {
      const lastPrice = currentPrice;
      const change = (Math.random() - 0.5) * 2;
      const newClose = lastPrice + change;
      const newOpen = lastPrice;
      const newHigh = Math.max(newOpen, newClose) + Math.random() * 0.5;
      const newLow = Math.min(newOpen, newClose) - Math.random() * 0.5;

      const newCandle: CandlestickData = {
        time: (Date.now() / 1000) as any,
        open: newOpen,
        high: newHigh,
        low: newLow,
        close: newClose,
      };

      seriesRef.current?.update(newCandle);
      setCurrentPrice(newClose);
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentPrice]);

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

    const order: Order = {
      id: Date.now().toString(),
      type,
      orderType,
      price: orderType === 'market' ? currentPrice : parseFloat(limitPrice) || currentPrice,
      quantity: qty,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      status: orderType === 'market' ? 'open' : 'pending',
    };

    setOrders(prev => [...prev, order]);
    toast.success(`${type.toUpperCase()} order placed at $${order.price.toFixed(2)}`);
  };

  const closeOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const pnl = order.type === 'buy' 
      ? (currentPrice - order.price) * order.quantity * 100
      : (order.price - currentPrice) * order.quantity * 100;

    setBalance(prev => prev + pnl);
    setOrders(prev => prev.filter(o => o.id !== orderId));
    toast.success(`Order closed with P/L: $${pnl.toFixed(2)}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4 animate-fade-in">
        <h1 className="text-4xl font-bold">
          <span className="gradient-text">Demo</span> Trading
        </h1>
        <p className="text-muted-foreground text-lg">
          Practice trading with live candlestick charts and virtual balance
        </p>
      </div>

      {/* Account Info */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 animate-fade-in">
        <div>
          <p className="text-sm text-muted-foreground">Virtual Balance</p>
          <p className="text-2xl font-mono font-bold text-primary">${balance.toFixed(2)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Current Price</p>
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

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-card border border-border/50 animate-fade-in">
          <div ref={chartContainerRef} className="w-full" />
        </div>

        {/* Order Panel */}
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4 animate-fade-in">
          <h3 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Place Order
          </h3>

          {/* Order Type */}
          <div className="grid grid-cols-2 gap-2">
            {(['market', 'limit', 'buyStop', 'sellStop'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                className={`p-2 rounded-lg text-xs font-medium transition-all ${
                  orderType === type
                    ? 'bg-primary/10 text-primary border border-primary'
                    : 'bg-muted border border-border hover:border-primary/30'
                }`}
              >
                {type === 'market' && 'Market'}
                {type === 'limit' && 'Limit'}
                {type === 'buyStop' && 'Buy Stop'}
                {type === 'sellStop' && 'Sell Stop'}
              </button>
            ))}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Quantity (Lots)</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full trading-input"
              min="0.01"
              step="0.01"
            />
          </div>

          {/* Limit Price (for non-market orders) */}
          {orderType !== 'market' && (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Price</label>
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="w-full trading-input"
                placeholder={currentPrice.toFixed(2)}
              />
            </div>
          )}

          {/* SL/TP */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-bearish" /> SL
              </label>
              <input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full trading-input"
                placeholder="Stop Loss"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground flex items-center gap-1">
                <Target className="w-3 h-3 text-bullish" /> TP
              </label>
              <input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full trading-input"
                placeholder="Take Profit"
              />
            </div>
          </div>

          {/* Buy/Sell Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="bullish" onClick={() => placeOrder('buy')}>
              <ArrowUpCircle className="w-4 h-4" />
              BUY
            </Button>
            <Button variant="bearish" onClick={() => placeOrder('sell')}>
              <ArrowDownCircle className="w-4 h-4" />
              SELL
            </Button>
          </div>
        </div>
      </div>

      {/* Open Orders */}
      {orders.length > 0 && (
        <div className="p-4 rounded-xl bg-card border border-border/50 animate-fade-in">
          <h3 className="font-semibold mb-4">Open Orders</h3>
          <div className="space-y-2">
            {orders.map((order) => {
              const pnl = order.type === 'buy'
                ? (currentPrice - order.price) * order.quantity * 100
                : (order.price - currentPrice) * order.quantity * 100;
              
              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      order.type === 'buy' ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'
                    }`}>
                      {order.type.toUpperCase()}
                    </span>
                    <span className="font-mono">{order.quantity} @ ${order.price.toFixed(2)}</span>
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
