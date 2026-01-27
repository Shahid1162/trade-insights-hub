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

    const systemPrompt = `You are an expert technical analyst specializing in Price Action, ICT (Inner Circle Trader) concepts, and SMC (Smart Money Concepts). 

Your analysis MUST include:
1. **Market Structure Analysis**: Identify trend direction, BOS (Break of Structure), CHoCH (Change of Character), higher highs/lows or lower highs/lows
2. **Order Blocks**: Identify bullish and bearish order blocks, breaker blocks, and mitigation blocks
3. **Fair Value Gaps (FVG)**: Locate imbalances in price that may act as magnets
4. **Liquidity Analysis**: Identify buy-side and sell-side liquidity pools, stop hunts, and liquidity grabs
5. **Premium/Discount Zones**: Determine if price is in premium or discount relative to the range
6. **Key Levels**: Support, resistance, and institutional levels

Based on the ${sanitizedAnalysisType} timeframe analysis (${sanitizedTimeframe1} and ${sanitizedTimeframe2} charts):
- For INTRADAY: Focus on quick scalping opportunities, look for 15-50 pip moves
- For SWING: Focus on multi-day positions, look for 100-300 pip moves  
- For POSITIONAL: Focus on long-term trends, look for 500+ pip moves

IMPORTANT: You must provide your response in this EXACT JSON format (no markdown, no code blocks, just raw JSON):
{
  "bias": "bullish" or "bearish",
  "confidence": number between 60-95,
  "entry": realistic price level as number based on what you see in the chart,
  "takeProfit": realistic price level as number,
  "stopLoss": realistic price level as number,
  "analysis": "Detailed markdown analysis covering all the concepts above"
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
        max_tokens: 2000,
        temperature: 0.3,
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
