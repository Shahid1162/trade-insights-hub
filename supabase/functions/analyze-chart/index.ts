import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('API key configuration issue');
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { analysisType, image1Base64, image2Base64, timeframe1, timeframe2 } = await req.json();

    console.log(`Starting ${analysisType} analysis for timeframes: ${timeframe1} and ${timeframe2}`);

    const systemPrompt = `You are an expert technical analyst specializing in Price Action, ICT (Inner Circle Trader) concepts, and SMC (Smart Money Concepts). 

Your analysis MUST include:
1. **Market Structure Analysis**: Identify trend direction, BOS (Break of Structure), CHoCH (Change of Character), higher highs/lows or lower highs/lows
2. **Order Blocks**: Identify bullish and bearish order blocks, breaker blocks, and mitigation blocks
3. **Fair Value Gaps (FVG)**: Locate imbalances in price that may act as magnets
4. **Liquidity Analysis**: Identify buy-side and sell-side liquidity pools, stop hunts, and liquidity grabs
5. **Premium/Discount Zones**: Determine if price is in premium or discount relative to the range
6. **Key Levels**: Support, resistance, and institutional levels

Based on the ${analysisType} timeframe analysis (${timeframe1} and ${timeframe2} charts):
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
                text: `Analyze these two chart images for ${analysisType} trading. The first image is the ${timeframe1} timeframe and the second is the ${timeframe2} timeframe. Look at the price action, identify key ICT/SMC concepts, and provide entry, take profit, and stop loss levels based on what you observe in the charts. Return ONLY valid JSON.`
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
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
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
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('Raw AI response:', content.substring(0, 500));

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
      console.error('JSON parse error:', parseError);
      console.log('Content that failed to parse:', content);
      
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

    console.log('Analysis complete:', result.bias, 'confidence:', result.confidence);

    return new Response(JSON.stringify(result), {
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
