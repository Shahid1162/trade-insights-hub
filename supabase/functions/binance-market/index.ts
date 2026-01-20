import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BINANCE_BASE_URL = "https://api.binance.com";

// Input validation constants
const VALID_ACTIONS = ["prices", "ticker", "klines", "search"];
const VALID_INTERVALS = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"];
const MAX_SYMBOL_LENGTH = 20;
const MAX_LIMIT = 500;
const MIN_LIMIT = 1;

// Cache to reduce API calls
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10 * 1000; // 10 seconds for live data

function sanitizeSymbol(input: any): string {
  return String(input ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, MAX_SYMBOL_LENGTH);
}

function validateInterval(interval: any): string {
  const sanitized = String(interval ?? "1m").toLowerCase();
  return VALID_INTERVALS.includes(sanitized) ? sanitized : "1m";
}

function validateLimit(limit: any): number {
  const num = parseInt(String(limit), 10);
  if (isNaN(num) || num < MIN_LIMIT) return 100;
  if (num > MAX_LIMIT) return MAX_LIMIT;
  return num;
}

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
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const action = body?.action;
    const symbol = sanitizeSymbol(body?.symbol);

    // Validate action
    if (!VALID_ACTIONS.includes(String(action))) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`User ${claimsData.user.id} binance request: action=${action}`);

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
        if (!symbol) {
          return new Response(JSON.stringify({ error: "Symbol required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Get single ticker price
        const tickerSymbol = `${symbol}USDT`;
        const response = await fetch(`${BINANCE_BASE_URL}/api/v3/ticker/24hr?symbol=${encodeURIComponent(tickerSymbol)}`);
        const ticker = await response.json();
        
        if (ticker.code) {
          console.error("Binance API error");
          throw new Error("Failed to fetch data");
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
        if (!symbol) {
          return new Response(JSON.stringify({ error: "Symbol required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Get candlestick/kline data
        const klineSymbol = `${symbol}USDT`;
        const interval = validateInterval(body?.interval);
        const limit = validateLimit(body?.limit);
        
        const response = await fetch(
          `${BINANCE_BASE_URL}/api/v3/klines?symbol=${encodeURIComponent(klineSymbol)}&interval=${interval}&limit=${limit}`
        );
        const klines = await response.json();
        
        if (klines.code) {
          console.error("Binance API error");
          throw new Error("Failed to fetch data");
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
        
        const searchTerm = symbol || "";
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
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (data) {
      setCache(cacheKey, data);
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Function error:", error);

    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
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
