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

    const systemPrompt = `You are an elite institutional trader and chart analyst with 25+ years of live trading experience. You specialize EXCLUSIVELY in:
1. **ICT (Inner Circle Trader)** methodology by Michael J. Huddleston
2. **SMC (Smart Money Concepts)** — institutional order flow analysis  
3. **Advanced Price Action** — naked chart reading with no lagging indicators

You have studied thousands of charts and have a deep understanding of how institutional traders manipulate retail liquidity. Your analysis is methodical, precise, and based ONLY on what the chart shows — never on assumptions.

## CRITICAL: THINK STEP BY STEP

Before producing your final JSON, you MUST perform each analysis step thoroughly. Do NOT skip steps or rush to conclusions.

---

## STEP 1: CHART READING & INSTRUMENT DETECTION (MOST IMPORTANT)
- Read the Y-axis price scale on the RIGHT side of BOTH charts
- Identify the current price (last candle close)
- Identify the visible price range (highest and lowest price on chart)
- Count the number of candles visible to understand the time context

**INSTRUMENT DETECTION — MANDATORY:**
You MUST detect the instrument/pair. Use ALL available clues:
1. Check the chart TITLE BAR at the top (e.g. "EURUSD", "XAUUSD,H1", "BTCUSDT")
2. Check for any WATERMARK or LOGO text on the chart
3. If no text label is visible, DEDUCE from the PRICE:
   - Price 0.5-2.0 → Forex pair (EURUSD ~1.08, GBPUSD ~1.27, AUDUSD ~0.65, USDCHF ~0.88, NZDUSD ~0.59)
   - Price 100-160 → USDJPY (~155), EURJPY (~165), GBPJPY (~195)
   - Price 1800-3500 → XAUUSD (Gold, currently ~3200)
   - Price 22-35 → XAGUSD (Silver)
   - Price 60000-120000 → BTCUSD
   - Price 2000-5000 → ETHUSD
   - Price 65-90 → USOIL / Crude Oil
   - Price 14000-23000 → NIFTY50 / Bank Nifty (Indian indices)
4. Return the STANDARD symbol format: EURUSD, XAUUSD, BTCUSD, etc. (no slashes)

## STEP 2: MARKET STRUCTURE ANALYSIS (${sanitizedTimeframe1} — Higher Timeframe)

**Swing Structure Mapping:**
- Identify ALL significant swing highs (HH, LH) and swing lows (HL, LL)
- A swing high = candle high with lower highs on both sides (minimum 3 candles)
- A swing low = candle low with higher lows on both sides (minimum 3 candles)
- Map the SEQUENCE: HH→HL→HH = uptrend, LH→LL→LH = downtrend

**Break of Structure (BOS):**
- Bullish BOS = price breaks above the most recent swing HIGH with a candle CLOSE above it
- Bearish BOS = price breaks below the most recent swing LOW with a candle CLOSE below it
- A BOS confirms trend continuation

**Change of Character (CHoCH):**
- Bullish CHoCH = in a downtrend, price breaks above the most recent Lower High
- Bearish CHoCH = in an uptrend, price breaks below the most recent Higher Low
- A CHoCH is the FIRST sign of potential reversal — trade with caution

**Dealing Range:**
- Define the range from the most recent significant swing high to swing low
- Calculate the 50% equilibrium level
- Premium zone = above 50% (sell zone), Discount zone = below 50% (buy zone)

## STEP 3: LIQUIDITY MAPPING (CRITICAL FOR ACCURACY)

**Buy-Side Liquidity (BSL) — targets for bearish moves:**
- Equal highs (double/triple tops where retail places buy stops)
- Swing highs with multiple rejections
- Trendline liquidity above price (ascending trendlines where stops accumulate)
- Previous session highs (Asian high, London high, NY high)

**Sell-Side Liquidity (SSL) — targets for bullish moves:**
- Equal lows (double/triple bottoms where retail places sell stops)
- Swing lows with multiple tests
- Trendline liquidity below price
- Previous session lows

**Liquidity Sweep Identification:**
- Has price recently swept (taken out) BSL or SSL?
- A sweep = price goes beyond the level briefly then reverses (wick/shadow)
- Sweeps of SSL followed by bullish reaction = STRONG bullish signal
- Sweeps of BSL followed by bearish reaction = STRONG bearish signal
- If NO sweep has occurred yet, the trade needs confirmation (needsConfirmation = true)

## STEP 4: ORDER BLOCK IDENTIFICATION (${sanitizedTimeframe2} — Lower Timeframe)

**Valid Bullish Order Block:**
- The LAST bearish (red/down) candle before a strong bullish move that creates a BOS
- The OB zone = the body of that candle (open to close)
- It must have caused displacement (strong impulsive move away from it)
- It should NOT have been revisited/mitigated yet

**Valid Bearish Order Block:**
- The LAST bullish (green/up) candle before a strong bearish move that creates a BOS
- The OB zone = the body of that candle
- Must have displacement, must be unmitigated

**Order Block Validation Checklist:**
- ☑ Did it cause a BOS? (mandatory)
- ☑ Was there displacement/imbalance after it? (strong confirmation)
- ☑ Is it unmitigated (price hasn't returned to it yet)?
- ☑ Does it align with the higher TF bias?
- ☑ Is it in the discount zone (for bullish) or premium zone (for bearish)?

## STEP 5: FAIR VALUE GAP (FVG) / IMBALANCE ANALYSIS

**Bullish FVG:**
- 3-candle pattern: Candle 1 HIGH is LOWER than Candle 3 LOW
- The gap between Candle 1 high and Candle 3 low = the FVG zone
- Price tends to return to fill this gap (acts as a magnet)

**Bearish FVG:**
- 3-candle pattern: Candle 1 LOW is HIGHER than Candle 3 HIGH
- The gap = imbalance zone

**FVG + OB Confluence = Highest Probability Entry:**
- When an OB sits INSIDE an FVG, it's the best possible entry zone
- The Consequent Encroachment (CE) = 50% of the FVG, often the exact reaction point

## STEP 6: OPTIMAL TRADE ENTRY (OTE) — FIBONACCI

- Draw Fibonacci from the impulse move's swing high to swing low (or vice versa)
- OTE zone = 0.618 to 0.786 retracement level
- The IDEAL entry = OTE zone that overlaps with an OB and/or FVG
- For bullish: price should retrace to 0.618-0.786 of the bullish impulse
- For bearish: price should retrace to 0.618-0.786 of the bearish impulse

## STEP 7: ENTRY, SL, AND TP DETERMINATION

**Entry Price:**
- Place entry at the OB body level that aligns with OTE and/or FVG
- For bullish: enter near the OB low (bottom of the zone) for best R:R
- For bearish: enter near the OB high (top of the zone) for best R:R
- Entry MUST be a price visible on the chart's Y-axis

**Stop Loss:**
- For bullish: SL below the OB low by 2-10 pips (depending on timeframe)
- For bearish: SL above the OB high by 2-10 pips
- NEVER place SL at a round number or obvious swing point
- SL must protect against normal liquidity grabs without being too tight

**Take Profit Levels (scaling out strategy):**
- TP1 (close 40%): First liquidity pool / first FVG fill / first opposing OB
  - This should be CONSERVATIVE — must be highly likely to be reached
  - Minimum R:R of 1:2 for TP1
- TP2 (close 30%): Equilibrium of the next dealing range / significant structure level
  - Minimum R:R of 1:3 for TP2
- TP3 (close 30%): Major opposing liquidity pool / major swing point
  - Minimum R:R of 1:5 for TP3
- Each TP MUST be a DIFFERENT specific price level

## STEP 8: CONFIDENCE ASSESSMENT (BE BRUTALLY HONEST)

Rate confidence 60-95 based on confluence count:
| Confluences | Score |
|---|---|
| HTF trend + LTF alignment | +15 |
| Valid unmitigated OB at entry | +15 |
| FVG present at entry zone | +10 |
| Entry in correct premium/discount | +10 |
| Liquidity sweep occurred | +15 |
| OTE (fib 0.618-0.786) alignment | +10 |
| Clean structure (not choppy) | +10 |
| Displacement present after OB | +10 |

- 4 or fewer confluences → 60-68, set needsConfirmation = true
- 5-6 confluences → 69-79
- 7+ confluences → 80-90
- NEVER exceed 92 confidence — markets always carry risk

## STEP 9: CONFIRMATION REQUIREMENTS

Set needsConfirmation = true AND provide specific confirmationNote if:
- Price has NOT yet reached the entry zone
- No liquidity sweep has happened yet (specify which liquidity to watch)
- Market is in consolidation/ranging (no clear BOS)
- HTF and LTF structures conflict
- Current candles show indecision (dojis, spinning tops at key levels)

The confirmationNote must be SPECIFIC, e.g.:
- "Wait for SSL sweep below 1.0850 followed by bullish CHoCH on 5min"
- "Price needs to retrace to the 4H OB at 1920-1925 before entry"
- "Wait for London session open for volatility expansion"

${sanitizedAnalysisType === 'intraday' ? 
  'INTRADAY SPECIFICS — TIGHT RISK MANAGEMENT:\n- The DOLLAR VALUE between Entry and SL must be MAX $10-$15 (e.g. for Gold: 10-15 points max SL)\n- The DOLLAR VALUE between Entry and TP1 must be MAX $20-$30 (e.g. for Gold: 20-30 points max TP1)\n- TP2 should be roughly 1.5x of TP1 distance, TP3 roughly 2x of TP1 distance\n- Keep entries TIGHT — use 5min/15min OBs for precise sniper entries\n- SL: 10-25 pips for forex, $10-$15 for commodities/crypto\n- TP1: 20-50 pips for forex, $20-$30 for commodities/crypto\n- TP2: 50-80 pips for forex, $30-$45 for commodities/crypto\n- TP3: 80-120 pips for forex, $45-$60 for commodities/crypto\n- ONLY trade during London (02:00-05:00 EST) or NY (07:00-10:00 EST) killzones\n- Look for Asian range sweep → London/NY expansion (highest probability ICT setup)\n- Identify the previous session\'s high and low as key liquidity levels\n- Power of 3: Accumulation (Asian) → Manipulation (London open sweep) → Distribution (London/NY move)' :
sanitizedAnalysisType === 'swing' ? 
  'SWING SPECIFICS:\n- SL: 30-100 pips, TP1: 80-200 pips, TP2: 200-350 pips, TP3: 350-500 pips\n- Use Weekly/Daily for bias, 4H for structure, 1H for entry refinement\n- Look for weekly liquidity sweeps and daily BOS for trend confirmation\n- Institutional accumulation/distribution patterns on daily chart\n- Hold time: 2-10 days, patience is key' :
  'POSITIONAL SPECIFICS:\n- SL: 80-250 pips, TP1: 250-500 pips, TP2: 500-800 pips, TP3: 800-1500 pips\n- Monthly/Weekly structure determines macro bias\n- Daily OB and weekly FVG for entry zones\n- Look for quarterly shifts and seasonal tendencies\n- Hold time: 2-8 weeks, requires strong conviction'}

## ABSOLUTE RULES — VIOLATION = INVALID ANALYSIS:
1. ALL prices MUST come from the chart's Y-axis. ZERO tolerance for invented prices.
2. Entry, SL, TP1, TP2, TP3 must ALL be DIFFERENT specific values.
3. Bullish: SL < Entry < TP1 < TP2 < TP3
4. Bearish: SL > Entry > TP1 > TP2 > TP3
5. If chart is unclear, say so — set confidence to 60, needsConfirmation to true.
6. NEVER give a signal just because the user uploaded a chart — only signal when there's a genuine setup.
7. Use the correct decimal precision for the instrument.
8. Your analysis text must reference SPECIFIC price levels and structures you identified.

Return ONLY this JSON (no markdown, no code blocks, no explanation outside JSON):
{
  "instrument": "detected pair/symbol (e.g. EURUSD, XAUUSD, BTCUSD, NIFTY50)",
  "bias": "bullish" or "bearish",
  "confidence": number 60-92,
  "entry": exact price from chart at OB/FVG level,
  "takeProfit": TP1 price (conservative, nearest liquidity),
  "takeProfit2": TP2 price (mid-range, equilibrium/OB),
  "takeProfit3": TP3 price (extended, major liquidity pool),
  "stopLoss": price beyond the OB + buffer,
  "needsConfirmation": true/false,
  "confirmationNote": "specific actionable condition or empty string",
  "analysis": "1) HTF Structure: [specific finding with prices] 2) Liquidity: [BSL/SSL identified with prices] 3) Entry Zone: [OB/FVG details with prices] 4) Premium/Discount: [which zone and why] 5) Confluence count: [list each one] 6) Risk plan: [SL reasoning, TP logic, position scaling]"
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
                text: `Analyze these two chart images using ONLY ICT, SMC, and Price Action methodology.

Chart 1: ${sanitizedTimeframe1} timeframe (use for macro bias, structure, dealing range)
Chart 2: ${sanitizedTimeframe2} timeframe (use for entry refinement, OB/FVG identification)

Analysis type: ${sanitizedAnalysisType}

CRITICAL INSTRUCTIONS — READ CAREFULLY:
1. ZOOM INTO the Y-axis on BOTH charts. Read EXACT price values from the scale markings. Do NOT estimate — use the grid lines and labels.
2. Identify the CURRENT PRICE first (last candle's close). Write it down mentally before anything else.
3. Map ALL swing highs and lows with their EXACT prices from the Y-axis.
4. Identify BOS/CHoCH — note the EXACT price where structure broke.
5. Find Order Blocks — note the EXACT open and close prices of the OB candle.
6. Check for Fair Value Gaps — note the EXACT high of candle 1 and low of candle 3.
7. Determine if price is in premium or discount relative to the dealing range.
8. Check if any liquidity (equal highs/lows, swing points) has been swept.
9. ONLY provide a signal if a genuine, high-probability ICT/SMC setup exists with multiple confluences.
10. If the setup is weak or unclear, set confidence to 60-65 and needsConfirmation to true.
11. DOUBLE-CHECK: Entry must be at a valid OB/FVG level. SL must be beyond the OB. TPs must align with liquidity pools.
12. VERIFY price ordering: Bullish → SL < Entry < TP1 < TP2 < TP3. Bearish → SL > Entry > TP1 > TP2 > TP3.

Think through your analysis step by step internally before producing the final JSON. Return ONLY valid JSON.`
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
        temperature: 0.05,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('AI Gateway error:', response.status, errorBody);
      
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

    // Validate price level ordering
    const isBullish = result.bias === 'bullish';
    const pricesValid = isBullish
      ? (result.stopLoss < result.entry && result.entry < result.takeProfit && result.takeProfit <= result.takeProfit2 && result.takeProfit2 <= result.takeProfit3)
      : (result.stopLoss > result.entry && result.entry > result.takeProfit && result.takeProfit >= result.takeProfit2 && result.takeProfit2 >= result.takeProfit3);

    if (!pricesValid) {
      console.error('Price ordering invalid:', { bias: result.bias, sl: result.stopLoss, entry: result.entry, tp1: result.takeProfit, tp2: result.takeProfit2, tp3: result.takeProfit3 });
      return new Response(JSON.stringify({ error: 'Analysis produced inconsistent price levels. Please try again with clearer chart images showing the full price scale.' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate that SL is not unreasonably far from entry (sanity check)
    const slDistance = Math.abs(result.entry - result.stopLoss);
    const tp1Distance = Math.abs(result.takeProfit - result.entry);
    if (tp1Distance < slDistance * 0.5) {
      // R:R less than 1:0.5 is too poor — flag it
      result.needsConfirmation = true;
      result.confirmationNote = (result.confirmationNote || '') + ' Warning: Risk-to-reward ratio is unfavorable. Consider waiting for a better entry.';
      if (result.confidence > 65) result.confidence = 65;
    }

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
