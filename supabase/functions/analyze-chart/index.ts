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

    const systemPrompt = `You are a world-class institutional trader and technical analyst who ONLY uses Advanced Price Action, ICT (Inner Circle Trader), and SMC (Smart Money Concepts) for precise trade execution.

## MANDATORY ANALYSIS FRAMEWORK:

### 1. MULTI-TIMEFRAME STRUCTURE (Higher TF → Lower TF)
- On the ${sanitizedTimeframe1} chart: Identify the MACRO trend (bullish/bearish), key swing highs/lows, and the current dealing range
- On the ${sanitizedTimeframe2} chart: Identify the MICRO structure for precision entry within the macro context
- Map Break of Structure (BOS) and Change of Character (CHoCH) on BOTH timeframes
- Determine if the market is in accumulation, manipulation, or distribution phase (AMD cycle)

### 2. LIQUIDITY ANALYSIS (Critical for Entry)
- Identify buy-side liquidity (BSL) pools: equal highs, swing highs, trendline liquidity above price
- Identify sell-side liquidity (SSL) pools: equal lows, swing lows, trendline liquidity below price
- Determine which liquidity pool price is likely to target NEXT (this defines your TP)
- Look for recent liquidity sweeps/stop hunts that signal smart money has entered

### 3. ORDER BLOCKS & SUPPLY/DEMAND
- Identify the most recent valid Bullish Order Block (last down candle before a BOS up) on both TFs
- Identify the most recent valid Bearish Order Block (last up candle before a BOS down) on both TFs
- Check for Breaker Blocks (failed order blocks that flip to opposite bias)
- Identify Mitigation Blocks where price has returned to fill an inefficiency
- The ENTRY should be at a refined order block on the lower timeframe that aligns with higher TF direction

### 4. FAIR VALUE GAPS (FVG) / IMBALANCES
- Locate all unfilled FVGs on both timeframes
- Determine if price is likely to fill these gaps (they act as magnets)
- Use FVGs as confluence for entry — an OB inside an FVG is the highest probability entry
- Identify Consequent Encroachment (CE) — the 50% level of the FVG

### 5. PREMIUM/DISCOUNT & FIBONACCI
- Draw the current dealing range (swing high to swing low)
- Calculate equilibrium (50% level) — the dividing line between premium and discount
- For LONGS: Enter ONLY in the discount zone (below 50%), ideally at the 70.5% or 79% OTE (Optimal Trade Entry)
- For SHORTS: Enter ONLY in the premium zone (above 50%), ideally at the 70.5% or 79% OTE
- Use the 0.618, 0.705, and 0.786 fib levels for precision entry within the OB

### 6. TIME-BASED ANALYSIS (ICT Killzones)
- London Killzone: 02:00–05:00 EST (high volatility, trend initiation)
- New York Killzone: 07:00–10:00 EST (continuation or reversal)
- Asian Range: 20:00–00:00 EST (consolidation, defines the range for London to sweep)
- Identify if the current price action aligns with a killzone for optimal entry timing

### 7. ENTRY CRITERIA (ALL must align for a valid signal):
- ✅ Higher TF bias confirmed (BOS/CHoCH on ${sanitizedTimeframe1})
- ✅ Lower TF entry at a valid OB/FVG on ${sanitizedTimeframe2}
- ✅ Entry in discount for longs / premium for shorts
- ✅ Liquidity has been swept on the opposite side before entry
- ✅ Risk:Reward minimum 1:3 for ${sanitizedAnalysisType} trades

### 8. TRADE PARAMETERS:
${sanitizedAnalysisType === 'intraday' ? 
  '- Target: 15-50 pips, Stop: 10-20 pips, R:R minimum 1:3\n- Look for Asian range sweep → London continuation\n- Focus on M15 OB refined on M5' :
sanitizedAnalysisType === 'swing' ? 
  '- Target: 100-300 pips, Stop: 30-80 pips, R:R minimum 1:3\n- Look for weekly/daily liquidity sweep → 4H continuation\n- Focus on 4H OB refined on 1H for entry' :
  '- Target: 300-1000+ pips, Stop: 80-200 pips, R:R minimum 1:3\n- Look for monthly/weekly liquidity sweep → Daily continuation\n- Focus on Daily OB refined on 4H for entry'}

### STOP LOSS PLACEMENT:
- Place SL beyond the order block that your entry is based on
- For longs: SL below the low of the bullish OB (+ small buffer)
- For shorts: SL above the high of the bearish OB (+ small buffer)
- Never place SL at an obvious level where liquidity sits

### TAKE PROFIT PLACEMENT:
- TP at the next opposing liquidity pool
- For longs: TP at buy-side liquidity (equal highs, swing high)
- For shorts: TP at sell-side liquidity (equal lows, swing low)
- Consider partial TP at the first FVG fill or equilibrium level

IMPORTANT: Return your response in this EXACT JSON format (no markdown, no code blocks, just raw JSON):
{
  "bias": "bullish" or "bearish",
  "confidence": number between 60-95,
  "entry": exact price level as number based on the refined OB/FVG on the lower timeframe,
  "takeProfit": exact price level at the next liquidity pool,
  "stopLoss": exact price level beyond the OB with buffer,
  "analysis": "Detailed markdown analysis covering: 1) Market Structure on both TFs 2) Liquidity pools identified 3) Order Block used for entry 4) FVG confluence 5) Premium/Discount zone confirmation 6) Killzone timing 7) Risk:Reward ratio calculation 8) Step-by-step trade execution plan"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze these two chart images for ${sanitizedAnalysisType} trading. The first image is the ${sanitizedTimeframe1} timeframe and the second is the ${sanitizedTimeframe2} timeframe. Look at the price action, identify key ICT/SMC concepts, and provide entry, take profit, and stop loss levels based on what you observe in the charts. Return ONLY valid JSON.`
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
      console.error('JSON parse error');
      
      // Return a structured response based on keywords in the content
      result = {
        bias: content.toLowerCase().includes('bullish') ? 'bullish' : 'bearish',
        confidence: 75,
        entry: 1.0850,
        takeProfit: 1.0920,
        stopLoss: 1.0810,
        analysis: content
      };
    }

    // Validate required fields
    if (!result.bias) result.bias = 'bullish';
    if (!result.confidence) result.confidence = 75;
    if (!result.entry) result.entry = 1.0850;
    if (!result.takeProfit) result.takeProfit = result.entry * 1.01;
    if (!result.stopLoss) result.stopLoss = result.entry * 0.99;
    if (!result.analysis) result.analysis = 'Analysis based on chart patterns and ICT/SMC concepts.';

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
