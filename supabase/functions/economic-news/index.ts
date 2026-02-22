import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ACTIONS = ["upcoming", "all"] as const;
type Action = (typeof VALID_ACTIONS)[number];

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function validateAction(action: any): Action {
  const sanitized = String(action ?? "all").toLowerCase();
  return VALID_ACTIONS.includes(sanitized as Action) ? (sanitized as Action) : "all";
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getPrompt(action: Action): string {
  const today = getToday();
  const base = `Return a JSON array of real economic calendar events. No markdown. Start with [ end with ].
Format: [{"id":"1","title":"event","country":"USD","date":"YYYY-MM-DD","time":"HH:MM","impact":"high","forecast":null,"previous":null,"actual":null}]
Countries: USD,EUR,GBP,JPY,AUD,CAD,CHF,NZD,CNY. Impact: high,medium,low. Today: ${today}.`;

  if (action === "upcoming") {
    return `${base} List 15 upcoming high/medium impact events from ${getDateOffset(1)} to ${getDateOffset(7)}. All actual=null.`;
  }
  return `${base} List 20 events: past 3 days with actual values, today, next 5 days (actual=null). High/medium impact.`;
}

function parsePerplexityResponse(content: string, action: Action): any[] {
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/```$/, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) cleaned = match[0];

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    const today = getToday();

    return parsed.map((ev: any, i: number) => {
      const date = String(ev.date || today);
      const isFuture = date > today;
      const val = (v: any) => {
        if (v == null || v === "null" || v === "" || v === "N/A") return undefined;
        return String(v).trim().slice(0, 30) || undefined;
      };
      return {
        id: String(ev.id || `ev-${i}`),
        title: String(ev.title || "Unknown").slice(0, 200),
        country: String(ev.country || "USD").toUpperCase().slice(0, 3),
        date,
        time: String(ev.time || "00:00").slice(0, 5),
        impact: ["high", "medium", "low"].includes(ev.impact) ? ev.impact : "medium",
        forecast: val(ev.forecast),
        previous: val(ev.previous),
        actual: isFuture ? undefined : val(ev.actual),
      };
    }).filter((e: any) => action === "upcoming" ? e.date > today : true);
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = validateAction(body?.action);
    console.log(`User ${user.id} economic-news: action=${action}`);

    const today = getToday();
    const cacheKey = `${action}-${today}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Cache hit: ${cached.data.length} events`);
      return new Response(JSON.stringify({ data: cached.data, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use Perplexity (fast sonar model with caching)
    const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ data: [], error: "Service unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "Return ONLY valid JSON arrays. No text." },
          { role: "user", content: getPrompt(action) },
        ],
        temperature: 0.0,
        max_tokens: 3000,
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
    const data = parsePerplexityResponse(content, action);

    if (data.length > 0) {
      cache.set(cacheKey, { data, timestamp: Date.now() });
    }

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
