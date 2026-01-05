import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const JBLANKET_API_KEY = Deno.env.get('JBLANKET_API_KEY');
const BASE_URL = 'https://api.jblanket.io/v1';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, filter } = await req.json();
    console.log(`Economic news request: action=${action}, filter=${filter}`);

    if (!JBLANKET_API_KEY) {
      throw new Error('JBlanket API key not configured');
    }

    let data;

    switch (action) {
      case 'upcoming':
        // Fetch upcoming economic events
        const upcomingUrl = `${BASE_URL}/economic-calendar/upcoming`;
        console.log('Fetching upcoming economic events');
        const upcomingResponse = await fetch(upcomingUrl, {
          headers: {
            'Authorization': `Bearer ${JBLANKET_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        data = await upcomingResponse.json();
        break;

      case 'ongoing':
        // Fetch ongoing/current economic events
        const ongoingUrl = `${BASE_URL}/economic-calendar/today`;
        console.log('Fetching ongoing economic events');
        const ongoingResponse = await fetch(ongoingUrl, {
          headers: {
            'Authorization': `Bearer ${JBLANKET_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        data = await ongoingResponse.json();
        break;

      case 'previous':
        // Fetch previous/historical economic events
        const previousUrl = `${BASE_URL}/economic-calendar/past`;
        console.log('Fetching previous economic events');
        const previousResponse = await fetch(previousUrl, {
          headers: {
            'Authorization': `Bearer ${JBLANKET_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        data = await previousResponse.json();
        break;

      case 'all':
        // Fetch all economic events (combined)
        const allUrl = `${BASE_URL}/economic-calendar`;
        console.log('Fetching all economic events');
        const allResponse = await fetch(allUrl, {
          headers: {
            'Authorization': `Bearer ${JBLANKET_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        data = await allResponse.json();
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Successfully fetched economic news for action: ${action}`);
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in economic-news function:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
