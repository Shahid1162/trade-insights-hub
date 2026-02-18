import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

const VALID_ACTIONS = ["upcoming", "ongoing", "previous", "all"] as const;
type Action = typeof VALID_ACTIONS[number];

interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  time: string;
  impact: "high" | "medium" | "low";
  forecast?: string | number;
  previous?: string | number;
  actual?: string | number;
}

function validateAction(action: any): Action {
  const sanitized = String(action ?? "all").toLowerCase();
  return VALID_ACTIONS.includes(sanitized as Action) ? (sanitized as Action) : "all";
}

function getPromptForAction(action: Action): string {
  const today = new Date().toISOString().split('T')[0];
  
  const basePrompt = `Search the web for the REAL economic calendar for this week. Use sources like ForexFactory, Investing.com, DailyFX, or TradingEconomics to find ACTUAL scheduled economic events.

CRITICAL: Return ONLY real, verified economic events that are actually scheduled. Do NOT make up or hallucinate events. Every event must be a real scheduled release.

Return ONLY a valid JSON array. No markdown, no code blocks, no explanations.

Each object must have exactly these fields:
- id: unique string identifier
- title: the exact official name of the economic release (e.g. "US Non-Farm Payrolls", "ECB Interest Rate Decision", "UK CPI y/y")
- country: 3-letter currency code (USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD, CNY)
- date: YYYY-MM-DD format
- time: HH:MM format (24-hour UTC)
- impact: "high", "medium", or "low" based on typical market impact
- forecast: the consensus forecast value as a string (e.g. "2.5%", "250K") or null if not available
- previous: the previous release value as a string or null
- actual: the actual released value as a string, or null if not yet released

Today is ${today}. Events after today MUST have actual as null.
Start your response with [ and end with ].`;

  switch (action) {
    case "upcoming":
      return `${basePrompt}\n\nFind 15-20 REAL upcoming economic events scheduled for the next 7 days from ${today}. Focus on high and medium impact events from major economies (US, EU, UK, Japan, Australia, Canada). All actual values must be null since these haven't happened yet.`;
    case "ongoing":
      return `${basePrompt}\n\nFind all REAL economic events scheduled for today (${today}). Include their actual values if they have already been released today.`;
    case "previous":
      return `${basePrompt}\n\nFind 15-20 REAL economic events that were released in the past 7 days before ${today}. Include their actual released values.`;
    case "all":
    default:
      return `${basePrompt}\n\nFind 25-30 REAL economic events: include events from the past 3 days (with actual values), today's events, and upcoming events for the next 5 days (actual=null). Focus on high-impact events from major economies.`;
  }
}

function parsePerplexityResponse(content: string): EconomicEvent[] {
  let cleaned = content.trim();
  
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) cleaned = arrayMatch[0];

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      console.error("Parsed response is not an array, got:", typeof parsed);
      return [];
    }

    const today = new Date().toISOString().split('T')[0];

    function sanitizeValue(val: any): string | undefined {
      if (val == null) return undefined;
      const s = String(val).trim();
      if (s.length <= 20 && /^-?[\d.,]+[%KMBTkmbtp]?$/i.test(s)) return s;
      return undefined;
    }
    
    return parsed.map((ev: any, index: number) => {
      const eventDate = String(ev.date || today);
      const isFuture = eventDate > today;
      
      return {
        id: String(ev.id || `event-${index}`),
        title: String(ev.title || "Unknown Event").slice(0, 200),
        country: String(ev.country || "USD").toUpperCase().slice(0, 3),
        date: eventDate,
        time: String(ev.time || "00:00").slice(0, 5),
        impact: ["high", "medium", "low"].includes(ev.impact) ? ev.impact : "medium",
        forecast: sanitizeValue(ev.forecast),
        previous: sanitizeValue(ev.previous),
        actual: isFuture ? undefined : sanitizeValue(ev.actual),
      };
    });
  } catch (e) {
    console.error("Failed to parse response, first 500 chars:", cleaned.slice(0, 500));
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;
    const body = await req.json().catch(() => ({}));
    const action = validateAction(body?.action);

    console.log(`User ${userId} economic-news request: action=${action}`);

    if (!PERPLEXITY_API_KEY) {
      console.error("PERPLEXITY_API_KEY not configured");
      return new Response(JSON.stringify({ data: [], error: "Service temporarily unavailable" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = getPromptForAction(action);

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are an economic calendar data provider. You MUST search the web for REAL economic calendar data. Return ONLY valid JSON arrays. Never fabricate events." },
          { role: "user", content: prompt }
        ],
        temperature: 0.0,
        search_recency_filter: "week",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Perplexity API error:", response.status, errorBody);
      return new Response(JSON.stringify({ data: [], error: "Service temporarily unavailable" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "[]";
    
    console.log("Raw response length:", content.length);
    
    const data = parsePerplexityResponse(content);
    console.log(`Parsed ${data.length} events for action=${action}`);

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ data: [], error: "An error occurred processing your request" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
