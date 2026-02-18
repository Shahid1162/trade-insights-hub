import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation
const VALID_ANALYSIS_TYPES = ['intraday', 'swing', 'positional'];
const VALID_TIMEFRAMES = ['1min', '5min', '15min', '30min', '1H', '4H', '1D', '1W'];
const MAX_IMAGE_SIZE = 5000000; // ~5MB limit for base64 images
const DAILY_LIMIT = 3;
const OWNER_EMAIL = 'shaikshahid25476@gmail.com';

function validateInput(body: any): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { analysisType, image1Base64, image2Base64, timeframe1, timeframe2 } = body;

  // Validate analysisType
  if (!analysisType || !VALID_ANALYSIS_TYPES.includes(String(analysisType).toLowerCase())) {
    return { valid: false, error: 'Invalid analysis type' };
  }

  // Validate images exist and are within size limits
  if (!image1Base64 || typeof image1Base64 !== 'string') {
    return { valid: false, error: 'First image is required' };
  }
  if (!image2Base64 || typeof image2Base64 !== 'string') {
    return { valid: false, error: 'Second image is required' };
  }
  if (image1Base64.length > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'First image exceeds size limit' };
  }
  if (image2Base64.length > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Second image exceeds size limit' };
  }

  // Validate timeframes
  if (!timeframe1 || !VALID_TIMEFRAMES.includes(String(timeframe1))) {
    return { valid: false, error: 'Invalid first timeframe' };
  }
  if (!timeframe2 || !VALID_TIMEFRAMES.includes(String(timeframe2))) {
    return { valid: false, error: 'Invalid second timeframe' };
  }

  return { valid: true };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
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

    const userEmail = claimsData.user.email;
    const userId = claimsData.user.id;
    const isOwner = userEmail === OWNER_EMAIL;

    // Check daily usage limit (skip for owner)
    if (!isOwner) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error: countError } = await supabase
        .from('signal_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('used_at', today.toISOString());

      if (countError) {
        console.error('Usage check error:', countError);
        return new Response(JSON.stringify({ error: 'Failed to check usage' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if ((count ?? 0) >= DAILY_LIMIT) {
        return new Response(JSON.stringify({ 
          error: 'Daily limit reached',
          message: `You have used all ${DAILY_LIMIT} analyses for today. Come back tomorrow!`,
          limitReached: true,
          remaining: 0
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('API key configuration issue');
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    
    // Validate input
    const validation = validateInput(body);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { analysisType, image1Base64, image2Base64, timeframe1, timeframe2 } = body;
    const sanitizedAnalysisType = String(analysisType).toLowerCase();
    const sanitizedTimeframe1 = String(timeframe1);
    const sanitizedTimeframe2 = String(timeframe2);

    console.log(`User ${claimsData.user.id} starting ${sanitizedAnalysisType} analysis`);

    const systemPrompt = `You are an elite institutional trader with 20+ years of live trading experience specializing in ICT (Inner Circle Trader) and SMC (Smart Money Concepts). You have a proven track record of 70%+ win rate.

## YOUR ANALYSIS PROCESS (follow this EXACT order):

### STEP 1: READ THE CHART PRECISELY
- FIRST: Read the Y-axis price scale on the right side of BOTH charts to determine the exact price range
- Note the current/last candle's close price as your reference point
- Identify the instrument type from the price format (forex = 4-5 decimals, crypto = 0-2 decimals, indices = 0-2 decimals, stocks = 2 decimals)
- Note the exact HIGH and LOW of the visible chart range

### STEP 2: HIGHER TIMEFRAME ANALYSIS (${sanitizedTimeframe1})
- Identify the DOMINANT trend direction using swing structure (Higher Highs/Higher Lows = Bullish, Lower Highs/Lower Lows = Bearish)
- Mark the most recent Break of Structure (BOS) — a confirmed swing point break in trend direction
- Mark any Change of Character (CHoCH) — first sign of trend reversal
- Identify the current dealing range (most recent significant swing high to swing low)
- Determine if price is in Premium (above 50% of range) or Discount (below 50%)
- Locate major liquidity pools: equal highs (buy-side liquidity), equal lows (sell-side liquidity), swing highs/lows with multiple touches

### STEP 3: LOWER TIMEFRAME ANALYSIS (${sanitizedTimeframe2})
- Confirm the higher TF bias on this timeframe
- Find the most recent valid Order Block:
  - Bullish OB: Last bearish candle before a strong bullish BOS (the candle body is the zone)
  - Bearish OB: Last bullish candle before a strong bearish BOS
- Locate any Fair Value Gaps (FVG): 3-candle pattern where candle 1 high and candle 3 low don't overlap (bullish) or vice versa
- Check if liquidity has been swept recently (stop hunt below lows for bullish, above highs for bearish)
- The BEST entry = OB inside an FVG in the discount zone (for longs) or premium zone (for shorts)

### STEP 4: DETERMINE EXACT TRADE LEVELS
**Entry:**
- Must be at a specific price level where an OB or FVG exists on the ${sanitizedTimeframe2} chart
- For longs: Entry should be in the lower portion of the OB (near the OB low)
- For shorts: Entry should be in the upper portion of the OB (near the OB high)

**Stop Loss:**
- For longs: Place SL 2-5 pips below the OB low (beyond where smart money placed orders)
- For shorts: Place SL 2-5 pips above the OB high
- NEVER place SL at a round number or obvious swing point (liquidity sits there)

**Take Profit (3 levels for scaling out):**
- TP1 (40% position close): First opposing liquidity pool or FVG fill — this should be CONSERVATIVE and highly likely to hit
- TP2 (30% position close): Equilibrium of the next dealing range or a significant OB
- TP3 (30% position close): Major liquidity pool (equal highs/lows, major swing point)
- After TP1 hits, move SL to breakeven

### STEP 5: CONFIDENCE SCORING (be HONEST, not optimistic)
Score based on how many of these align (each worth ~12-15 points):
- Higher TF trend confirmation (BOS present)
- Lower TF entry at valid OB/FVG
- Entry in correct premium/discount zone
- Liquidity sweep occurred before entry
- Multiple confluences at entry (OB + FVG + fib level)
- Clean structure (no choppy/ranging market)
- Risk:Reward >= 1:3
- If fewer than 4 align → confidence should be 60-70 (consider "needsConfirmation: true")
- If 5-6 align → confidence 70-82
- If 7+ align → confidence 83-95
- NEVER give confidence above 90 unless everything aligns perfectly

### STEP 6: CONFIRMATION ASSESSMENT
Set needsConfirmation to TRUE if ANY of these apply:
- Price hasn't reached the OB/entry zone yet
- No liquidity sweep has occurred yet
- Market is in a ranging/choppy phase
- There's a high-impact news event approaching
- The lower TF structure contradicts the higher TF

${sanitizedAnalysisType === 'intraday' ? 
  'INTRADAY SPECIFICS:\n- Typical SL: 10-25 pips, TP1: 20-40 pips, TP2: 40-70 pips, TP3: 70-120 pips\n- Focus on London/NY killzone setups\n- Asian range sweep → London expansion is the highest probability setup\n- Avoid trading during low-volume hours' :
sanitizedAnalysisType === 'swing' ? 
  'SWING SPECIFICS:\n- Typical SL: 30-80 pips, TP1: 80-150 pips, TP2: 150-250 pips, TP3: 250-400 pips\n- Look for weekly/daily liquidity sweeps\n- Wait for 4H BOS confirmation before entry\n- Hold time: 2-7 days typically' :
  'POSITIONAL SPECIFICS:\n- Typical SL: 80-200 pips, TP1: 200-400 pips, TP2: 400-700 pips, TP3: 700-1200 pips\n- Based on weekly/monthly structure\n- Requires daily BOS confirmation\n- Hold time: 1-6 weeks typically'}

## ABSOLUTE RULES:
1. ALL prices MUST be read from the chart's Y-axis. NEVER invent prices.
2. Entry, SL, TP1, TP2, TP3 must ALL be DIFFERENT values
3. For bullish: SL < Entry < TP1 < TP2 < TP3
4. For bearish: SL > Entry > TP1 > TP2 > TP3
5. Minimum R:R of 1:2 for TP1, 1:3 for TP2, 1:5 for TP3
6. If the chart is unclear or you cannot read prices confidently, set confidence to 60 and needsConfirmation to true
7. Use correct decimal places for the instrument shown

Return ONLY this JSON (no markdown, no code blocks):
{
  "instrument": "detected pair/symbol name from chart (e.g. EURUSD, XAUUSD, BTCUSD, NIFTY50, AAPL etc.)",
  "bias": "bullish" or "bearish",
  "confidence": number 60-95,
  "entry": exact price from chart,
  "takeProfit": TP1 price (nearest, conservative),
  "takeProfit2": TP2 price (mid-range target),
  "takeProfit3": TP3 price (extended target),
  "stopLoss": price beyond the OB,
  "needsConfirmation": true/false,
  "confirmationNote": "specific condition to wait for, or empty string",
  "analysis": "Concise bullet points: 1) Market structure finding 2) Key OB/FVG identified 3) Liquidity context 4) Entry reasoning 5) Risk management plan"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze these two chart images for ${sanitizedAnalysisType} trading. The first image is the ${sanitizedTimeframe1} timeframe and the second is the ${sanitizedTimeframe2} timeframe. CRITICAL: Read the ACTUAL price values from the Y-axis/price scale on the right side of the charts. All entry, SL, and TP levels must be real prices visible on these charts. Do NOT use placeholder or example prices. Each TP must be a distinct price level. Return ONLY valid JSON.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${image1Base64}`
                }
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${image2Base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error('AI Gateway error:', response.status);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error('AI service error');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON from response - handle markdown code blocks
    let result;
    try {
      // Remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();
      
      // Try to find JSON object in the response
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('JSON parse error, raw content:', content);
      
      return new Response(JSON.stringify({ error: 'Failed to parse AI response. Please try again with a clearer chart image.' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields - but never use hardcoded fallback prices
    if (!result.bias) result.bias = 'bullish';
    if (!result.confidence) result.confidence = 75;
    if (!result.entry || !result.takeProfit || !result.stopLoss) {
      return new Response(JSON.stringify({ error: 'AI could not determine price levels from the chart. Please upload a clearer chart with visible price scale.' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!result.takeProfit2) result.takeProfit2 = result.takeProfit;
    if (!result.takeProfit3) result.takeProfit3 = result.takeProfit2;
    if (!result.analysis) result.analysis = 'Analysis based on chart patterns.';

    // Record usage (skip for owner)
    if (!isOwner) {
      const { error: insertError } = await supabase
        .from('signal_usage')
        .insert({ user_id: userId, analysis_type: sanitizedAnalysisType });
      
      if (insertError) {
        console.error('Failed to record usage:', insertError);
      }
    }

    // Get remaining count for response
    let remaining = isOwner ? 999 : DAILY_LIMIT;
    if (!isOwner) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('signal_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('used_at', today.toISOString());
      remaining = Math.max(0, DAILY_LIMIT - (count ?? 0));
    }

    console.log(`Analysis complete for user ${userId}`);

    return new Response(JSON.stringify({ ...result, remaining, isOwner }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: 'An error occurred processing your request' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
