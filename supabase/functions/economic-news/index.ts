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

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function getPromptForAction(action: Action): string {
  const today = getToday();
  
  const basePrompt = `You are an economic calendar data provider. Search the web for REAL economic calendar data for the week of ${today}.

Use reliable sources: ForexFactory.com, Investing.com, TradingEconomics.com, DailyFX.com.

CRITICAL RULES:
1. Return ONLY real, verified economic events. Do NOT fabricate events.
2. Return ONLY a valid JSON array starting with [ and ending with ].
3. No markdown, no code blocks, no explanations - ONLY the JSON array.
4. Each object MUST have these exact fields:
   - id: unique string
   - title: official event name (e.g. "US Non-Farm Payrolls", "ECB Interest Rate Decision")
   - country: 3-letter currency code (USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD, CNY)
   - date: YYYY-MM-DD format
   - time: HH:MM format (24-hour UTC)
   - impact: "high", "medium", or "low"
   - forecast: consensus forecast as string (e.g. "2.5%", "250K") or null
   - previous: previous value as string or null
   - actual: released value as string, or null if not yet released

IMPORTANT: Today's date is ${today}.`;

  switch (action) {
    case "upcoming":
      return `${basePrompt}

Find 15-20 REAL upcoming high and medium impact economic events scheduled between ${getDateOffset(1)} and ${getDateOffset(7)}.
Focus on major economies: US, EU, UK, Japan, Australia, Canada.
ALL events must have dates AFTER ${today}.
ALL actual values MUST be null (these events haven't happened yet).`;

    case "ongoing":
      return `${basePrompt}

Find ALL economic events scheduled for TODAY ${today} ONLY.
CRITICAL: The date field for EVERY event MUST be exactly "${today}".
For events that have ALREADY been released today, you MUST include their actual released values - search ForexFactory.com and Investing.com for the latest released data.
Do NOT leave actual as null if the data has already been published today.
Include both released and upcoming events for today.`;

    case "previous":
      return `${basePrompt}

Find 15-20 REAL high and medium impact economic events that were ALREADY RELEASED between ${getDateOffset(-7)} and ${getDateOffset(-1)}.
CRITICAL: ALL events must have dates BEFORE ${today} (between ${getDateOffset(-7)} and ${getDateOffset(-1)}).
CRITICAL: You MUST include the actual released values for ALL events. Every single event MUST have an actual value because they have already occurred.
Search ForexFactory.com and Investing.com to find the actual released values.
Do NOT return any event without an actual value.`;

    case "all":
    default:
      return `${basePrompt}

Find 25-30 REAL economic events covering:
- Past 3 days (${getDateOffset(-3)} to ${getDateOffset(-1)}): MUST include actual released values for all
- Today (${today}): include actual if already released, null if pending
- Next 5 days (${getDateOffset(1)} to ${getDateOffset(5)}): actual must be null
Focus on high and medium impact events from major economies.
Past events MUST have actual values filled in.`;
  }
}

function parsePerplexityResponse(content: string, action: Action): EconomicEvent[] {
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

    const today = getToday();

    function sanitizeValue(val: any): string | undefined {
      if (val == null || val === "null" || val === "" || val === "N/A" || val === "n/a") return undefined;
      const s = String(val).trim();
      if (s.length <= 30) return s;
      return undefined;
    }
    
    let events = parsed.map((ev: any, index: number) => {
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

    // Post-processing: enforce date constraints based on action
    switch (action) {
      case "ongoing":
        // Only keep today's events
        events = events.map(e => ({ ...e, date: today }));
        break;
      case "upcoming":
        // Only keep future events
        events = events.filter(e => e.date > today);
        // Ensure no actual values for future events
        events = events.map(e => ({ ...e, actual: undefined }));
        break;
      case "previous":
        // Only keep past events
        events = events.filter(e => e.date < today);
        break;
    }

    return events;
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = validateAction(body?.action);

    console.log(`User ${user.id} economic-news request: action=${action}, today=${getToday()}`);

    if (!PERPLEXITY_API_KEY) {
      console.error("PERPLEXITY_API_KEY not configured");
      return new Response(JSON.stringify({ data: [], error: "Service temporarily unavailable" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = getPromptForAction(action);

    // Use sonar-pro for ongoing (needs actual values), sonar for others (more reliable JSON)
    const model = (action === "ongoing" || action === "previous") ? "sonar-pro" : "sonar";
    const recency = (action === "previous" || action === "all") ? "week" : "day";

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are an economic calendar data provider. You MUST search the web for REAL economic calendar data from ForexFactory.com, Investing.com, or TradingEconomics.com. Return ONLY a valid JSON array. No markdown code blocks, no explanations, no extra text. Start with [ and end with ]. Never fabricate events. Always include actual released values for past events." },
          { role: "user", content: prompt }
        ],
        temperature: 0.0,
        search_recency_filter: recency,
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
    console.log("Raw response preview:", content.slice(0, 300));
    
    const data = parsePerplexityResponse(content, action);
    console.log(`Parsed ${data.length} events for action=${action}`);
    
    // Log sample of actual values for debugging
    const withActual = data.filter(e => e.actual);
    console.log(`Events with actual values: ${withActual.length}/${data.length}`);

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
