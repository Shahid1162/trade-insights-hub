import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, RefreshCw, X, Maximize2, Minimize2 } from 'lucide-react';
import { createChart, ColorType, IChartApi, CandlestickData as LWCandlestickData, CandlestickSeries } from 'lightweight-charts';
import { getCryptoKlines, getCryptoTicker, CryptoTicker, CandlestickData } from '@/lib/binanceApi';

interface CryptoChartModalProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  name: string;
}

const intervals = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
];

export const CryptoChartModal: React.FC<CryptoChartModalProps> = ({
  open,
  onClose,
  symbol,
  name,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi['addSeries']> | null>(null);
  
  const [interval, setInterval] = useState('1m');
  const [ticker, setTicker] = useState<CryptoTicker | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [klines, tickerData] = await Promise.all([
        getCryptoKlines(symbol, interval, 500),
        getCryptoTicker(symbol),
      ]);

      if (tickerData) {
        setTicker(tickerData);
      }

      if (seriesRef.current && klines.length > 0) {
        const formattedData: LWCandlestickData[] = klines.map((k: CandlestickData) => ({
          time: k.time as any,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));
        seriesRef.current.setData(formattedData);
        chartRef.current?.timeScale().fitContent();
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initialize chart
  useEffect(() => {
    if (!open || !chartContainerRef.current) return;

    // Clear previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const container = chartContainerRef.current;
    
    // Create chart with proper sizing
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.7)',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: container.clientWidth,
      height: container.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: interval === '1m',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      crosshair: {
        vertLine: {
          color: 'rgba(255, 255, 255, 0.3)',
          labelBackgroundColor: 'hsl(var(--primary))',
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.3)',
          labelBackgroundColor: 'hsl(var(--primary))',
        },
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Fetch initial data
    fetchData();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Auto-refresh every 3 seconds for live data
    const refreshInterval = window.setInterval(fetchData, 3000);

    return () => {
      resizeObserver.disconnect();
      window.clearInterval(refreshInterval);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [open, symbol]);

  // Refetch when interval changes
  useEffect(() => {
    if (open && chartRef.current) {
      fetchData();
    }
  }, [interval]);

  const isPositive = (ticker?.change ?? 0) >= 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className={`p-0 border-border bg-background/95 backdrop-blur-xl ${
          isFullscreen 
            ? 'max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] rounded-none' 
            : 'max-w-6xl w-[95vw] h-[85vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary">{symbol}</span>
              <span className="text-muted-foreground">/USDT</span>
              <span className="text-sm text-muted-foreground ml-2">{name}</span>
            </div>
            {ticker && (
              <div className="flex items-center gap-4 ml-4">
                <span className="text-2xl font-mono font-bold">
                  ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: ticker.price < 1 ? 6 : 2 })}
                </span>
                <div className={`flex items-center gap-1 px-2 py-1 rounded ${isPositive ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'}`}>
                  {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="font-medium">
                    {isPositive ? '+' : ''}{ticker.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {loading && <RefreshCw className="w-4 h-4 animate-spin text-primary" />}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-bullish animate-pulse"></div>
              Live
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Timeframe Controls */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border/50 bg-muted/30">
          {intervals.map((int) => (
            <Button
              key={int.value}
              variant={interval === int.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setInterval(int.value)}
              className={`px-3 py-1 h-8 ${interval === int.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {int.label}
            </Button>
          ))}
        </div>

        {/* Chart Container */}
        <div 
          ref={chartContainerRef} 
          className="flex-1 w-full"
          style={{ height: 'calc(100% - 140px)' }}
        />

        {/* Stats Footer */}
        {ticker && (
          <div className="grid grid-cols-4 gap-4 px-4 py-3 border-t border-border/50 bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground">24h High</p>
              <p className="font-mono font-semibold text-bullish">
                ${ticker.high?.toLocaleString(undefined, { maximumFractionDigits: ticker.high && ticker.high < 1 ? 6 : 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">24h Low</p>
              <p className="font-mono font-semibold text-bearish">
                ${ticker.low?.toLocaleString(undefined, { maximumFractionDigits: ticker.low && ticker.low < 1 ? 6 : 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">24h Change</p>
              <p className={`font-mono font-semibold ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
                {isPositive ? '+' : ''}${ticker.change.toLocaleString(undefined, { maximumFractionDigits: ticker.change < 1 ? 6 : 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">24h Volume</p>
              <p className="font-mono font-semibold">
                {ticker.volume?.toLocaleString(undefined, { maximumFractionDigits: 0 })} {symbol}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
