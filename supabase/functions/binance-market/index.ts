import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BINANCE_API_KEY = Deno.env.get("BINANCE_API_KEY");
const BINANCE_API_SECRET = Deno.env.get("BINANCE_API_SECRET");
const BINANCE_BASE_URL = "https://api.binance.com";

// Cache to reduce API calls
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10 * 1000; // 10 seconds for live data

function getFreshCached(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body?.action;
    const symbol = body?.symbol;

    console.log(`Binance request: action=${action}, symbol=${symbol}`);

    const cacheKey = `${action}:${symbol}`;
    const cachedData = getFreshCached(cacheKey);
    if (cachedData) {
      return new Response(JSON.stringify({ data: cachedData, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data: any;

    switch (action) {
      case "prices": {
        // Get all crypto prices
        const response = await fetch(`${BINANCE_BASE_URL}/api/v3/ticker/24hr`);
        const tickers = await response.json();
        
        // Filter for USDT pairs and popular cryptos
        const popularSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "DOTUSDT"];
        
        data = tickers
          .filter((t: any) => popularSymbols.includes(t.symbol))
          .map((t: any) => ({
            symbol: t.symbol.replace("USDT", ""),
            name: getFullName(t.symbol.replace("USDT", "")),
            price: parseFloat(t.lastPrice),
            change: parseFloat(t.priceChange),
            changePercent: parseFloat(t.priceChangePercent),
            high: parseFloat(t.highPrice),
            low: parseFloat(t.lowPrice),
            volume: parseFloat(t.volume),
          }));
        break;
      }

      case "ticker": {
        // Get single ticker price
        const tickerSymbol = `${symbol}USDT`;
        const response = await fetch(`${BINANCE_BASE_URL}/api/v3/ticker/24hr?symbol=${tickerSymbol}`);
        const ticker = await response.json();
        
        if (ticker.code) {
          throw new Error(ticker.msg || "Failed to fetch ticker");
        }
        
        data = {
          symbol: symbol,
          name: getFullName(symbol),
          price: parseFloat(ticker.lastPrice),
          change: parseFloat(ticker.priceChange),
          changePercent: parseFloat(ticker.priceChangePercent),
          high: parseFloat(ticker.highPrice),
          low: parseFloat(ticker.lowPrice),
          volume: parseFloat(ticker.volume),
        };
        break;
      }

      case "klines": {
        // Get candlestick/kline data
        const klineSymbol = `${symbol}USDT`;
        const interval = body?.interval || "1m";
        const limit = body?.limit || 100;
        
        const response = await fetch(
          `${BINANCE_BASE_URL}/api/v3/klines?symbol=${klineSymbol}&interval=${interval}&limit=${limit}`
        );
        const klines = await response.json();
        
        if (klines.code) {
          throw new Error(klines.msg || "Failed to fetch klines");
        }
        
        data = klines.map((k: any[]) => ({
          time: Math.floor(k[0] / 1000), // Convert to seconds
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }));
        break;
      }

      case "search": {
        // Search for symbols
        const response = await fetch(`${BINANCE_BASE_URL}/api/v3/exchangeInfo`);
        const info = await response.json();
        
        const searchTerm = symbol?.toUpperCase() || "";
        data = info.symbols
          .filter((s: any) => 
            s.quoteAsset === "USDT" && 
            (s.baseAsset.includes(searchTerm) || s.symbol.includes(searchTerm))
          )
          .slice(0, 20)
          .map((s: any) => ({
            symbol: s.baseAsset,
            name: getFullName(s.baseAsset),
            pair: s.symbol,
          }));
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    if (data) {
      setCache(cacheKey, data);
    }

    console.log(`Successfully fetched data for action: ${action}`);

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in binance-market function:", errorMessage);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getFullName(symbol: string): string {
  const names: Record<string, string> = {
    BTC: "Bitcoin",
    ETH: "Ethereum",
    BNB: "Binance Coin",
    SOL: "Solana",
    XRP: "Ripple",
    ADA: "Cardano",
    DOGE: "Dogecoin",
    DOT: "Polkadot",
    AVAX: "Avalanche",
    MATIC: "Polygon",
    LINK: "Chainlink",
    UNI: "Uniswap",
    ATOM: "Cosmos",
    LTC: "Litecoin",
    FIL: "Filecoin",
    NEAR: "NEAR Protocol",
    APT: "Aptos",
    ARB: "Arbitrum",
    OP: "Optimism",
    INJ: "Injective",
  };
  return names[symbol] || symbol;
}
