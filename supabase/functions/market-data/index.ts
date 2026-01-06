import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY');
const BASE_URL = 'https://www.alphavantage.co/query';

// Cache to reduce API calls (free tier: 25/day)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Cache hit for ${key}`);
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbol, market } = await req.json();
    console.log(`Market data request: action=${action}, symbol=${symbol}, market=${market}`);

    if (!ALPHA_VANTAGE_API_KEY) {
      throw new Error('Alpha Vantage API key not configured');
    }

    const cacheKey = `${action}:${symbol}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
      return new Response(JSON.stringify({ data: cachedData, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let data;

    switch (action) {
      case 'quote':
        const quoteUrl = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        console.log(`Fetching quote for ${symbol}`);
        const quoteResponse = await fetch(quoteUrl);
        const quoteData = await quoteResponse.json();
        console.log(`Quote response for ${symbol}:`, JSON.stringify(quoteData));
        
        if (quoteData['Note'] || quoteData['Information']) {
          console.log('API rate limit reached:', quoteData['Note'] || quoteData['Information']);
          throw new Error('API rate limit reached. Please try again later.');
        }
        
        if (quoteData['Global Quote'] && quoteData['Global Quote']['05. price']) {
          const q = quoteData['Global Quote'];
          data = {
            symbol: q['01. symbol'],
            price: parseFloat(q['05. price']),
            change: parseFloat(q['09. change']),
            changePercent: parseFloat(q['10. change percent']?.replace('%', '') || '0'),
            high: parseFloat(q['03. high']),
            low: parseFloat(q['04. low']),
            volume: parseInt(q['06. volume']),
          };
        } else {
          console.log('No valid quote data found for', symbol);
          data = null;
        }
        break;

      case 'search':
        const searchUrl = `${BASE_URL}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(symbol)}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        console.log(`Searching for ${symbol}`);
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        if (searchData['Note'] || searchData['Information']) {
          console.log('API rate limit reached');
          throw new Error('API rate limit reached. Please try again later.');
        }
        
        if (searchData.bestMatches) {
          data = searchData.bestMatches.map((match: any) => ({
            symbol: match['1. symbol'],
            name: match['2. name'],
            type: match['3. type'],
            region: match['4. region'],
            currency: match['8. currency'],
          }));
        } else {
          data = [];
        }
        break;

      case 'crypto':
        const cryptoUrl = `${BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbol}&to_currency=USD&apikey=${ALPHA_VANTAGE_API_KEY}`;
        console.log(`Fetching crypto rate for ${symbol}`);
        const cryptoResponse = await fetch(cryptoUrl);
        const cryptoData = await cryptoResponse.json();
        console.log(`Crypto response for ${symbol}:`, JSON.stringify(cryptoData));
        
        if (cryptoData['Note'] || cryptoData['Information']) {
          console.log('API rate limit reached');
          throw new Error('API rate limit reached. Please try again later.');
        }
        
        if (cryptoData['Realtime Currency Exchange Rate']) {
          const rate = cryptoData['Realtime Currency Exchange Rate'];
          data = {
            symbol: rate['1. From_Currency Code'],
            name: rate['2. From_Currency Name'],
            price: parseFloat(rate['5. Exchange Rate']),
            bidPrice: parseFloat(rate['8. Bid Price']),
            askPrice: parseFloat(rate['9. Ask Price']),
          };
        } else {
          console.log('No valid crypto data found for', symbol);
          data = null;
        }
        break;

      case 'forex':
        const [fromCurrency, toCurrency] = symbol.split('/');
        const forexUrl = `${BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        console.log(`Fetching forex rate for ${symbol}`);
        const forexResponse = await fetch(forexUrl);
        const forexData = await forexResponse.json();
        
        if (forexData['Note'] || forexData['Information']) {
          throw new Error('API rate limit reached. Please try again later.');
        }
        
        if (forexData['Realtime Currency Exchange Rate']) {
          const rate = forexData['Realtime Currency Exchange Rate'];
          data = {
            symbol: `${rate['1. From_Currency Code']}/${rate['3. To_Currency Code']}`,
            price: parseFloat(rate['5. Exchange Rate']),
            bidPrice: parseFloat(rate['8. Bid Price']),
            askPrice: parseFloat(rate['9. Ask Price']),
          };
        } else {
          data = null;
        }
        break;

      case 'intraday':
        const intradayUrl = `${BASE_URL}?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=${ALPHA_VANTAGE_API_KEY}`;
        console.log(`Fetching intraday data for ${symbol}`);
        const intradayResponse = await fetch(intradayUrl);
        const intradayData = await intradayResponse.json();
        
        if (intradayData['Note'] || intradayData['Information']) {
          throw new Error('API rate limit reached. Please try again later.');
        }
        
        const timeSeries = intradayData['Time Series (5min)'];
        if (timeSeries) {
          data = Object.entries(timeSeries).slice(0, 50).map(([time, values]: [string, any]) => ({
            time: new Date(time).getTime() / 1000,
            open: parseFloat(values['1. open']),
            high: parseFloat(values['2. high']),
            low: parseFloat(values['3. low']),
            close: parseFloat(values['4. close']),
            volume: parseInt(values['5. volume']),
          })).reverse();
        } else {
          data = [];
        }
        break;

      case 'batch':
        const symbols = symbol.split(',');
        console.log(`Batch fetching ${symbols.length} symbols:`, symbols);
        data = [];
        
        for (const sym of symbols.slice(0, 5)) {
          try {
            const trimmedSym = sym.trim();
            const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${trimmedSym}&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const response = await fetch(url);
            const result = await response.json();
            console.log(`Batch result for ${trimmedSym}:`, JSON.stringify(result));
            
            if (result['Note'] || result['Information']) {
              console.log('API rate limit reached during batch');
              break; // Stop if rate limited
            }
            
            if (result['Global Quote'] && result['Global Quote']['05. price']) {
              const q = result['Global Quote'];
              data.push({
                symbol: q['01. symbol'],
                price: parseFloat(q['05. price']),
                change: parseFloat(q['09. change']),
                changePercent: parseFloat(q['10. change percent']?.replace('%', '') || '0'),
              });
            }
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (e) {
            console.error(`Error fetching ${sym}:`, e);
          }
        }
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Cache successful results
    if (data) {
      setCache(cacheKey, data);
    }

    console.log(`Successfully fetched data for action: ${action}, data:`, data ? 'present' : 'null');
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in market-data function:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
