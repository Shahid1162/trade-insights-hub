import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { createChart, ColorType, IChartApi, CandlestickData as LWCandlestickData, CandlestickSeries } from 'lightweight-charts';
import { getCryptoKlines, getCryptoTicker, CryptoTicker, CandlestickData } from '@/lib/binanceApi';

interface CryptoChartModalProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  name: string;
}

const intervals = [
  { value: '1m', label: '1 Min' },
  { value: '5m', label: '5 Min' },
  { value: '15m', label: '15 Min' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hour' },
  { value: '1d', label: '1 Day' },
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [klines, tickerData] = await Promise.all([
        getCryptoKlines(symbol, interval, 200),
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
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.7)',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
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
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    // Auto-refresh every 5 seconds for live data
    const refreshInterval = window.setInterval(fetchData, 5000);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.clearInterval(refreshInterval);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [open, symbol]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [interval]);

  const isPositive = (ticker?.change ?? 0) >= 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl w-full bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold">{symbol}/USDT</span>
              <span className="text-muted-foreground text-sm">{name}</span>
            </div>
            {ticker && (
              <div className="flex items-center gap-4">
                <span className="text-2xl font-mono font-bold">
                  ${ticker.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <div className={`flex items-center gap-1 ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
                  {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="font-medium">
                    {isPositive ? '+' : ''}{ticker.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Select value={interval} onValueChange={setInterval}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Interval" />
                </SelectTrigger>
                <SelectContent>
                  {intervals.map((int) => (
                    <SelectItem key={int.value} value={int.value}>
                      {int.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Chart */}
          <div 
            ref={chartContainerRef} 
            className="w-full rounded-lg overflow-hidden bg-background/50"
          />

          {/* Stats */}
          {ticker && (
            <div className="grid grid-cols-4 gap-4 p-4 rounded-lg bg-background/50">
              <div>
                <p className="text-xs text-muted-foreground">24h High</p>
                <p className="font-mono font-semibold text-bullish">
                  ${ticker.high?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">24h Low</p>
                <p className="font-mono font-semibold text-bearish">
                  ${ticker.low?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">24h Change</p>
                <p className={`font-mono font-semibold ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
                  ${Math.abs(ticker.change).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">24h Volume</p>
                <p className="font-mono font-semibold">
                  {ticker.volume?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
