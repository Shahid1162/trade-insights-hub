import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

const VALID_ACTIONS = ["upcoming", "all"] as const;
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
  
  const basePrompt = `What are the real scheduled economic calendar events this week? Include events like CPI, GDP, NFP, interest rate decisions, PMI, unemployment, retail sales, etc.

Return ONLY a JSON array. No markdown, no explanation, no code blocks. Start with [ and end with ].

Each object must have: { "id": "unique-string", "title": "event name", "country": "USD", "date": "YYYY-MM-DD", "time": "HH:MM", "impact": "high", "forecast": "value or null", "previous": "value or null", "actual": "value or null" }

Countries: USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD, CNY. Impact: high, medium, low. Time in UTC 24h format. Today is ${today}.`;

  switch (action) {
    case "upcoming":
      return `${basePrompt}\n\nList 15-20 upcoming economic events from ${getDateOffset(1)} to ${getDateOffset(7)}. Focus on high and medium impact. Set actual to null for all.`;
    case "all":
    default:
      return `${basePrompt}\n\nList 20-25 economic events covering: events from ${getDateOffset(-3)} to ${today} (include actual released values where available), and upcoming events from ${getDateOffset(1)} to ${getDateOffset(5)} (actual=null). Focus on high and medium impact from major economies.`;
  }
}

function parseResponse(content: string, action: Action): EconomicEvent[] {
  let cleaned = content.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) cleaned = arrayMatch[0];

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    const today = getToday();

    return parsed.map((ev: any, i: number) => {
      const date = String(ev.date || today);
      const isFuture = date > today;
      const val = (v: any) => {
        if (v == null || v === "null" || v === "" || v === "N/A") return undefined;
        const s = String(v).trim();
        return s.length <= 30 ? s : undefined;
      };
      return {
        id: String(ev.id || `ev-${i}`),
        title: String(ev.title || "Unknown Event").slice(0, 200),
        country: String(ev.country || "USD").toUpperCase().slice(0, 3),
        date,
        time: String(ev.time || "00:00").slice(0, 5),
        impact: ["high", "medium", "low"].includes(ev.impact) ? ev.impact : "medium",
        forecast: val(ev.forecast),
        previous: val(ev.previous),
        actual: isFuture ? undefined : val(ev.actual),
      };
    }).filter((e: EconomicEvent) => {
      if (action === "upcoming") return e.date > today;
      return true;
    });
  } catch {
    console.error("Parse failed:", cleaned.slice(0, 300));
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = validateAction(body?.action);

    console.log(`User ${user.id} economic-news: action=${action}`);

    if (!PERPLEXITY_API_KEY) {
      return new Response(JSON.stringify({ data: [], error: "Service unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "You are an economic calendar data provider. Return ONLY valid JSON arrays. No text, no markdown, no explanation. Just the JSON array." },
          { role: "user", content: getPromptForAction(action) }
        ],
        temperature: 0.0,
      }),
    });

    if (!response.ok) {
      console.error("Perplexity error:", response.status);
      return new Response(JSON.stringify({ data: [], error: "Service unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "[]";
    const data = parseResponse(content, action);
    console.log(`Parsed ${data.length} events`);

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ data: [], error: "Request failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
