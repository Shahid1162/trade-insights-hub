import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


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
  
  const basePrompt = `You are an economic calendar data provider. Return ONLY a valid JSON array of economic events with no markdown formatting, no code blocks, and no explanations.

Each event must have these exact fields:
- id: unique string identifier
- title: event name (e.g., "US Non-Farm Payrolls", "ECB Interest Rate Decision")
- country: 3-letter currency code (USD, EUR, GBP, JPY, etc.)
- date: YYYY-MM-DD format
- time: HH:MM format (24-hour UTC)
- impact: "high", "medium", or "low"
- forecast: expected value (number or string like "2.5%" or "250K"), null if not available
- previous: previous release value, null if not available
- actual: actual released value, null if not yet released

Today's date is ${today}.`;

  switch (action) {
    case "upcoming":
      return `${basePrompt}

Return 15-20 upcoming economic events scheduled for the next 7 days that have NOT been released yet (actual should be null). Focus on high-impact events from major economies (US, EU, UK, Japan, China, Canada, Australia).

Return ONLY the JSON array, nothing else.`;

    case "ongoing":
      return `${basePrompt}

Return 5-10 economic events happening TODAY (${today}). Include both events that have been released today (with actual values) and events still pending today (actual is null).

Return ONLY the JSON array, nothing else.`;

    case "previous":
      return `${basePrompt}

Return 15-20 economic events that were released in the past 7 days. These MUST have actual values filled in. Focus on high-impact events from major economies.

Return ONLY the JSON array, nothing else.`;

    case "all":
    default:
      return `${basePrompt}

Return 25-30 economic events including:
- 10 upcoming events (next 7 days, actual is null)
- 5 events from today
- 10 recently released events (past 7 days, with actual values)

Focus on high-impact events from major economies (US, EU, UK, Japan, China, Canada, Australia).

Return ONLY the JSON array, nothing else.`;
  }
}

function parsePerplexityResponse(content: string): EconomicEvent[] {
  // Remove any markdown code blocks if present
  let cleaned = content.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      console.error("Parsed response is not an array");
      return [];
    }
    
    return parsed.map((ev: any, index: number) => ({
      id: String(ev.id || `event-${index}`),
      title: String(ev.title || "Unknown Event").slice(0, 200),
      country: String(ev.country || "USD").toUpperCase().slice(0, 3),
      date: String(ev.date || new Date().toISOString().split('T')[0]),
      time: String(ev.time || "00:00").slice(0, 5),
      impact: ["high", "medium", "low"].includes(ev.impact) ? ev.impact : "medium",
      forecast: ev.forecast ?? undefined,
      previous: ev.previous ?? undefined,
      actual: ev.actual ?? undefined,
    }));
  } catch (e) {
    console.error("Failed to parse response");
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = validateAction(body?.action);

    console.log(`economic-news request: action=${action}`);

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
