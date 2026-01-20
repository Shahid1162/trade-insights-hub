import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALPHA_VANTAGE_API_KEY = Deno.env.get("ALPHA_VANTAGE_API_KEY");
const BASE_URL = "https://www.alphavantage.co/query";

// Input validation constants
const VALID_ACTIONS = ["quote", "search", "crypto", "forex", "intraday", "batch"];
const MAX_SYMBOL_LENGTH = 20;
const MAX_BATCH_SYMBOLS = 5;

// Cache to reduce API calls (free tier: 25/day)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Alpha Vantage free tier guidance: ~1 request / second burst limit
const MIN_CALL_INTERVAL_MS = 1100;
let lastCallAt = 0;

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

function sanitizeSymbol(input: any): string {
  return String(input ?? "").replace(/[^A-Z0-9\/]/gi, "").toUpperCase().slice(0, MAX_SYMBOL_LENGTH);
}

function validateAction(action: any): boolean {
  return VALID_ACTIONS.includes(String(action));
}

function getCacheEntry(key: string) {
  return cache.get(key) ?? null;
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

function isRateLimitedPayload(payload: any) {
  return Boolean(payload?.Note || payload?.Information);
}

async function alphaFetchJson(url: string) {
  const now = Date.now();
  const waitMs = MIN_CALL_INTERVAL_MS - (now - lastCallAt);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastCallAt = Date.now();

  const res = await fetch(url);
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Keep these outside try so the catch can reference them for fallbacks.
  let action: string | undefined;
  let symbol: string | undefined;
  let cacheKey: string | undefined;

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
    action = body?.action;
    symbol = sanitizeSymbol(body?.symbol);

    // Validate action
    if (!validateAction(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`User ${claimsData.user.id} market-data request: action=${action}`);

    if (!ALPHA_VANTAGE_API_KEY) {
      console.error("API key configuration issue");
      return new Response(JSON.stringify({ error: "Service temporarily unavailable" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    cacheKey = `${action}:${symbol}`;

    const freshCached = getFreshCached(cacheKey);
    if (freshCached) {
      return new Response(JSON.stringify({ data: freshCached, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data: any;

    switch (action) {
      case "quote": {
        if (!symbol) {
          return new Response(JSON.stringify({ error: "Symbol required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const quoteUrl = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA_VANTAGE_API_KEY}`;

        const quoteData = await alphaFetchJson(quoteUrl);

        if (isRateLimitedPayload(quoteData)) {
          throw new RateLimitError("API rate limit reached. Please try again later.");
        }

        if (quoteData?.["Global Quote"]?.["05. price"]) {
          const q = quoteData["Global Quote"];
          data = {
            symbol: q["01. symbol"],
            price: parseFloat(q["05. price"]),
            change: parseFloat(q["09. change"]),
            changePercent: parseFloat(String(q["10. change percent"] ?? "0").replace("%", "")),
            high: parseFloat(q["03. high"]),
            low: parseFloat(q["04. low"]),
            volume: parseInt(q["06. volume"]),
          };
        } else {
          data = null;
        }
        break;
      }

      case "search": {
        const searchKeyword = String(body?.symbol ?? "").slice(0, 50);
        const searchUrl = `${BASE_URL}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(searchKeyword)}&apikey=${ALPHA_VANTAGE_API_KEY}`;

        const searchData = await alphaFetchJson(searchUrl);

        if (isRateLimitedPayload(searchData)) {
          throw new RateLimitError("API rate limit reached. Please try again later.");
        }

        data = Array.isArray(searchData?.bestMatches)
          ? searchData.bestMatches.slice(0, 20).map((match: any) => ({
              symbol: match["1. symbol"],
              name: match["2. name"],
              type: match["3. type"],
              region: match["4. region"],
              currency: match["8. currency"],
            }))
          : [];
        break;
      }

      case "crypto": {
        if (!symbol) {
          return new Response(JSON.stringify({ error: "Symbol required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const cryptoUrl = `${BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${encodeURIComponent(symbol)}&to_currency=USD&apikey=${ALPHA_VANTAGE_API_KEY}`;

        const cryptoData = await alphaFetchJson(cryptoUrl);

        if (isRateLimitedPayload(cryptoData)) {
          throw new RateLimitError("API rate limit reached. Please try again later.");
        }

        if (cryptoData?.["Realtime Currency Exchange Rate"]) {
          const rate = cryptoData["Realtime Currency Exchange Rate"];
          data = {
            symbol: rate["1. From_Currency Code"],
            name: rate["2. From_Currency Name"],
            price: parseFloat(rate["5. Exchange Rate"]),
            bidPrice: parseFloat(rate["8. Bid Price"]),
            askPrice: parseFloat(rate["9. Ask Price"]),
          };
        } else {
          data = null;
        }
        break;
      }

      case "forex": {
        const [fromCurrency, toCurrency] = symbol.split("/");
        if (!fromCurrency || !toCurrency) {
          return new Response(JSON.stringify({ error: "Invalid forex pair format. Use FROM/TO" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const forexUrl = `${BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${encodeURIComponent(fromCurrency)}&to_currency=${encodeURIComponent(toCurrency)}&apikey=${ALPHA_VANTAGE_API_KEY}`;

        const forexData = await alphaFetchJson(forexUrl);

        if (isRateLimitedPayload(forexData)) {
          throw new RateLimitError("API rate limit reached. Please try again later.");
        }

        if (forexData?.["Realtime Currency Exchange Rate"]) {
          const rate = forexData["Realtime Currency Exchange Rate"];
          data = {
            symbol: `${rate["1. From_Currency Code"]}/${rate["3. To_Currency Code"]}`,
            price: parseFloat(rate["5. Exchange Rate"]),
            bidPrice: parseFloat(rate["8. Bid Price"]),
            askPrice: parseFloat(rate["9. Ask Price"]),
          };
        } else {
          data = null;
        }
        break;
      }

      case "intraday": {
        if (!symbol) {
          return new Response(JSON.stringify({ error: "Symbol required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const intradayUrl = `${BASE_URL}?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(symbol)}&interval=5min&apikey=${ALPHA_VANTAGE_API_KEY}`;

        const intradayData = await alphaFetchJson(intradayUrl);

        if (isRateLimitedPayload(intradayData)) {
          throw new RateLimitError("API rate limit reached. Please try again later.");
        }

        const timeSeries = intradayData?.["Time Series (5min)"];
        if (timeSeries) {
          data = Object.entries(timeSeries)
            .slice(0, 50)
            .map(([time, values]: [string, any]) => ({
              time: new Date(time).getTime() / 1000,
              open: parseFloat(values["1. open"]),
              high: parseFloat(values["2. high"]),
              low: parseFloat(values["3. low"]),
              close: parseFloat(values["4. close"]),
              volume: parseInt(values["5. volume"]),
            }))
            .reverse();
        } else {
          data = [];
        }
        break;
      }

      case "batch": {
        const symbols = String(body?.symbol ?? "")
          .split(",")
          .map((s) => sanitizeSymbol(s))
          .filter(Boolean)
          .slice(0, MAX_BATCH_SYMBOLS); // Limit to 5 symbols

        if (symbols.length === 0) {
          return new Response(JSON.stringify({ error: "At least one symbol required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        data = [] as any[];

        for (const sym of symbols) {
          const perKey = `quote:${sym}`;
          const cached = getFreshCached(perKey);
          if (cached) {
            data.push(cached);
            continue;
          }

          const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${ALPHA_VANTAGE_API_KEY}`;

          try {
            const result = await alphaFetchJson(url);

            if (isRateLimitedPayload(result)) {
              break; // Stop if rate limited
            }

            if (result?.["Global Quote"]?.["05. price"]) {
              const q = result["Global Quote"];
              const qData = {
                symbol: q["01. symbol"],
                price: parseFloat(q["05. price"]),
                change: parseFloat(q["09. change"]),
                changePercent: parseFloat(String(q["10. change percent"] ?? "0").replace("%", "")),
              };
              data.push(qData);
              setCache(perKey, qData);
            }
          } catch (e) {
            console.error(`Error fetching symbol`);
          }
        }
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Cache successful results (avoid caching null/empty-only payloads)
    if (data !== null && data !== undefined && !(Array.isArray(data) && data.length === 0)) {
      setCache(cacheKey, data);
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Function error:", error);

    // IMPORTANT: avoid hard 500s for rate-limit situations to prevent blank screens.
    if (error instanceof RateLimitError && cacheKey) {
      const fallback = getCacheEntry(cacheKey);
      const fallbackData = fallback?.data ?? null;

      return new Response(
        JSON.stringify({
          data: fallbackData,
          error: "Request limit reached. Please try again later.",
          rateLimited: true,
          cached: Boolean(fallback),
          stale: Boolean(fallback),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
