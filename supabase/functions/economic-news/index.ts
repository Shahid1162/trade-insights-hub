import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

// Input validation
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
  
  const basePrompt = `You are an economic calendar assistant. Your job is to provide realistic economic calendar events based on your knowledge of regularly scheduled economic releases.

Return ONLY a valid JSON array. No markdown, no code blocks, no explanations, no disclaimers.

Each object in the array must have:
- id: unique string
- title: event name (e.g. "US Non-Farm Payrolls", "ECB Interest Rate Decision")  
- country: 3-letter currency code (USD, EUR, GBP, JPY, etc.)
- date: YYYY-MM-DD format
- time: HH:MM format (24-hour UTC)
- impact: "high", "medium", or "low"
- forecast: short numeric string like "2.5%" or "250K" or null
- previous: short numeric string like "2.3%" or "220K" or null
- actual: short numeric string or null. MUST be null for future events after ${today}.

Use your knowledge of typical economic calendar schedules. These events happen on regular schedules (monthly, quarterly, etc.). Provide realistic values based on recent economic trends.

Today is ${today}. Start your response with [ and end with ].`;

  switch (action) {
    case "upcoming":
      return `${basePrompt}\n\nProvide 15-20 upcoming economic events for the next 7 days. All actual values must be null. Focus on major economies.`;
    case "ongoing":
      return `${basePrompt}\n\nProvide 5-10 economic events for today (${today}).`;
    case "previous":
      return `${basePrompt}\n\nProvide 15-20 economic events from the past 7 days with actual values filled in.`;
    case "all":
    default:
      return `${basePrompt}\n\nProvide 25 economic events: ~10 upcoming (next 7 days, actual=null), ~5 today, ~10 past (last 7 days, with actual values). Focus on high-impact events.`;
  }
}

function parsePerplexityResponse(content: string): EconomicEvent[] {
  let cleaned = content.trim();
  
  // Remove markdown code blocks
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Try to extract JSON array from the response if it contains extra text
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    cleaned = arrayMatch[0];
  }

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
      if (s.length <= 20 && /^-?[\d.,]+[%KMBTkmbtp]?$/i.test(s)) {
        return s;
      }
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
    // Authentication required
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
      console.error("API key configuration issue");
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
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("External API error:", response.status);
      return new Response(JSON.stringify({ data: [], error: "Service temporarily unavailable" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "[]";
    
    const data = parsePerplexityResponse(content);

    console.log(`Parsed ${data.length} events`);

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
