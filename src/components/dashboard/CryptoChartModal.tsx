import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  
  const [selectedInterval, setSelectedInterval] = useState('1m');
  const [ticker, setTicker] = useState<CryptoTicker | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [chartReady, setChartReady] = useState(false);

  const fetchData = useCallback(async () => {
    if (!seriesRef.current) return;
    
    setLoading(true);
    try {
      const [klines, tickerData] = await Promise.all([
        getCryptoKlines(symbol, selectedInterval, 500),
        getCryptoTicker(symbol),
      ]);

      console.log('Fetched klines:', klines.length, 'ticker:', tickerData?.price);

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
  }, [symbol, selectedInterval]);

  // Initialize chart after a short delay to ensure container is rendered
  useEffect(() => {
    if (!open) {
      setChartReady(false);
      return;
    }

    // Small delay to ensure DialogContent is fully rendered
    const initTimer = setTimeout(() => {
      if (!chartContainerRef.current) return;

      // Clear previous chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }

      const container = chartContainerRef.current;
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 500;
      
      console.log('Creating chart with dimensions:', width, height);
      
      // Create chart
      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'rgba(255, 255, 255, 0.7)',
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        width,
        height,
        timeScale: {
          timeVisible: true,
          secondsVisible: selectedInterval === '1m',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        },
        rightPriceScale: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
        },
        crosshair: {
          vertLine: {
            color: 'rgba(255, 255, 255, 0.3)',
            labelBackgroundColor: '#6366f1',
          },
          horzLine: {
            color: 'rgba(255, 255, 255, 0.3)',
            labelBackgroundColor: '#6366f1',
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
      setChartReady(true);
    }, 100);

    return () => {
      clearTimeout(initTimer);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [open, symbol]);

  // Fetch data when chart is ready or interval changes
  useEffect(() => {
    if (!chartReady || !open) return;

    fetchData();

    // Auto-refresh every 3 seconds
    const refreshInterval = setInterval(fetchData, 3000);

    return () => clearInterval(refreshInterval);
  }, [chartReady, open, fetchData]);

  // Handle resize
  useEffect(() => {
    if (!open || !chartRef.current || !chartContainerRef.current) return;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const width = chartContainerRef.current.clientWidth;
        const height = chartContainerRef.current.clientHeight;
        if (width > 0 && height > 0) {
          chartRef.current.applyOptions({ width, height });
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => resizeObserver.disconnect();
  }, [open, chartReady]);

  const isPositive = (ticker?.change ?? 0) >= 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className={`flex flex-col p-0 border-border bg-background/95 backdrop-blur-xl ${
          isFullscreen 
            ? 'max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] rounded-none' 
            : 'max-w-6xl w-[95vw] h-[85vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
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
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border/50 bg-muted/30 shrink-0">
          {intervals.map((int) => (
            <Button
              key={int.value}
              variant={selectedInterval === int.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedInterval(int.value)}
              className={`px-3 py-1 h-8 ${selectedInterval === int.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {int.label}
            </Button>
          ))}
        </div>

        {/* Chart Container */}
        <div 
          ref={chartContainerRef} 
          className="flex-1 w-full min-h-[400px]"
        />

        {/* Stats Footer */}
        {ticker && (
          <div className="grid grid-cols-4 gap-4 px-4 py-3 border-t border-border/50 bg-muted/30 shrink-0">
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
