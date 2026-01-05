import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JBLANKET_API_KEY = Deno.env.get("JBLANKET_API_KEY");

// JBlanked calendar API (previous domain appears deprecated)
const BASE_URL = "https://www.jblanked.com/news/api";

type Action = "upcoming" | "ongoing" | "previous" | "all";

type RawJBlankedEvent = {
  Id?: string | number;
  Name?: string;
  Currency?: string;
  Date?: string; // YYYY.MM.DD HH:mm:ss
  Actual?: string | number | null;
  Forecast?: string | number | null;
  Previous?: string | number | null;
  Strength?: string | null;
  Impact?: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseJBlankedDate(value?: string) {
  // Expected: "YYYY.MM.DD HH:mm:ss"
  if (!value) return { date: toYMD(new Date()), time: "00:00" };

  const [datePart, timePart] = value.split(" ");
  const [y, m, d] = (datePart ?? "").split(".").map((x) => Number(x));

  if (!y || !m || !d) return { date: toYMD(new Date()), time: "00:00" };

  const date = `${y}-${pad2(m)}-${pad2(d)}`;
  const time = (timePart ?? "00:00").slice(0, 5);
  return { date, time };
}

function toImpact(raw?: RawJBlankedEvent) {
  const s = String(raw?.Strength ?? raw?.Impact ?? "").toLowerCase();
  if (s.includes("strong") || s.includes("high")) return "high";
  if (s.includes("moderate") || s.includes("medium")) return "medium";
  if (s.includes("low")) return "low";
  return "medium";
}

function getEndpoint(action: Action) {
  switch (action) {
    case "ongoing":
      return `${BASE_URL}/mql5/calendar/today/`;
    case "upcoming":
    case "all":
      return `${BASE_URL}/mql5/calendar/week/`;
    case "previous": {
      const now = new Date();
      const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7));
      return `${BASE_URL}/mql5/calendar/range/?from=${toYMD(from)}&to=${toYMD(to)}`;
    }
    default:
      return `${BASE_URL}/mql5/calendar/week/`;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = (body?.action ?? "all") as Action;

    console.log(`Economic news request: action=${action}`);

    if (!JBLANKET_API_KEY) {
      throw new Error("JBlanked API key not configured");
    }

    const url = getEndpoint(action);
    console.log(`Fetching economic events from: ${url}`);

    const res = await fetch(url, {
      headers: {
        Authorization: `Api-Key ${JBLANKET_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Upstream API error (${res.status}): ${text || res.statusText}`);
    }

    const raw = (await res.json()) as unknown;
    const rawEvents: RawJBlankedEvent[] = Array.isArray(raw) ? (raw as RawJBlankedEvent[]) : [];

    const data = rawEvents.map((ev, index) => {
      const { date, time } = parseJBlankedDate(ev.Date);
      return {
        id: String(ev.Id ?? index),
        title: ev.Name ?? "Unknown Event",
        country: ev.Currency ?? "USD",
        date,
        time,
        impact: toImpact(ev),
        forecast: ev.Forecast ?? undefined,
        previous: ev.Previous ?? undefined,
        actual: ev.Actual ?? undefined,
      };
    });

    console.log(`Successfully fetched ${data.length} events for action: ${action}`);

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in economic-news function:", errorMessage);

    // Return 200 so the frontend can gracefully fall back without surfacing a hard function error.
    return new Response(JSON.stringify({ data: [], error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
