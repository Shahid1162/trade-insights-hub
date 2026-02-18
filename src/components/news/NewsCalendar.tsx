import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Globe, AlertTriangle, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EconomicEvent } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Fallback mock events when API fails
const fallbackEvents: EconomicEvent[] = [
  { id: '1', title: 'US Non-Farm Payrolls', country: 'USD', date: '2025-01-06', time: '13:30', impact: 'high', forecast: '180K', previous: '199K' },
  { id: '2', title: 'ECB Interest Rate Decision', country: 'EUR', date: '2025-01-06', time: '12:15', impact: 'high', forecast: '4.0%', previous: '4.0%' },
  { id: '3', title: 'UK GDP m/m', country: 'GBP', date: '2025-01-07', time: '07:00', impact: 'medium', forecast: '0.2%', previous: '0.1%', actual: '0.3%' },
  { id: '4', title: 'Australia Employment Change', country: 'AUD', date: '2025-01-07', time: '00:30', impact: 'high', forecast: '25.0K', previous: '15.9K' },
  { id: '5', title: 'Japan Core CPI y/y', country: 'JPY', date: '2025-01-08', time: '23:30', impact: 'medium', forecast: '2.9%', previous: '2.8%' },
];

const countryFlags: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺',
  CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿', CNY: '🇨🇳',
};

const impactColors = {
  high: 'bg-bearish/20 text-bearish border-bearish/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-muted text-muted-foreground border-border',
};

type EventCategory = 'all' | 'upcoming' | 'ongoing' | 'previous';

const timezones = [
  { value: 'Asia/Kolkata', label: 'India (IST)', offset: '+5:30' },
  { value: 'UTC', label: 'UTC', offset: '+0:00' },
  { value: 'America/New_York', label: 'New York (EST)', offset: '-5:00' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)', offset: '-8:00' },
  { value: 'Europe/London', label: 'London (GMT)', offset: '+0:00' },
  { value: 'Europe/Paris', label: 'Paris (CET)', offset: '+1:00' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: '+9:00' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: '+8:00' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: '+4:00' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)', offset: '+11:00' },
];

// Market impact analysis based on event type
function getMarketImpact(event: EconomicEvent): { gold: string; crypto: string; currencies: string; goldDir: 'up' | 'down' | 'neutral'; cryptoDir: 'up' | 'down' | 'neutral'; currDir: 'up' | 'down' | 'neutral' } {
  const title = event.title.toLowerCase();
  const country = event.country;

  if (title.includes('interest rate') || title.includes('rate decision')) {
    return {
      gold: 'Higher rates strengthen USD, pressuring gold lower. Rate cuts are bullish for gold.',
      crypto: 'Rate hikes reduce risk appetite, bearish for crypto. Cuts boost crypto demand.',
      currencies: `Hawkish stance strengthens ${country}. Dovish weakens it against peers.`,
      goldDir: 'down', cryptoDir: 'down', currDir: 'up',
    };
  }
  if (title.includes('non-farm') || title.includes('nfp') || title.includes('employment') || title.includes('jobs')) {
    return {
      gold: 'Strong jobs data strengthens USD, pushing gold down. Weak data supports gold.',
      crypto: 'Strong employment reduces rate cut expectations, mixed for crypto.',
      currencies: `Strong jobs boost ${country}. Weak data weakens it.`,
      goldDir: 'down', cryptoDir: 'neutral', currDir: 'up',
    };
  }
  if (title.includes('cpi') || title.includes('inflation') || title.includes('ppi')) {
    return {
      gold: 'High inflation is bullish for gold as a hedge. Low inflation reduces gold demand.',
      crypto: 'Rising inflation drives investors to crypto as an alternative store of value.',
      currencies: `Higher inflation may force rate hikes, initially strengthening ${country}.`,
      goldDir: 'up', cryptoDir: 'up', currDir: 'neutral',
    };
  }
  if (title.includes('gdp')) {
    return {
      gold: 'Strong GDP reduces safe-haven demand for gold. Weak GDP boosts gold.',
      crypto: 'Strong growth boosts risk appetite, mildly bullish for crypto.',
      currencies: `Strong GDP strengthens ${country}. Weak GDP weakens it.`,
      goldDir: 'down', cryptoDir: 'up', currDir: 'up',
    };
  }
  if (title.includes('pmi') || title.includes('manufacturing') || title.includes('services')) {
    return {
      gold: "Strong PMI reduces gold's safe-haven appeal. Weak PMI supports gold prices.",
      crypto: 'PMI data has moderate indirect impact on crypto through risk sentiment.',
      currencies: `Above-50 PMI is bullish for ${country}. Below-50 is bearish.`,
      goldDir: 'neutral', cryptoDir: 'neutral', currDir: 'up',
    };
  }
  if (title.includes('retail sales') || title.includes('consumer')) {
    return {
      gold: 'Strong consumer spending reduces gold demand. Weak spending supports gold.',
      crypto: 'Consumer confidence can boost risk assets including crypto.',
      currencies: `Strong retail data supports ${country}. Weak data pressures it.`,
      goldDir: 'down', cryptoDir: 'up', currDir: 'up',
    };
  }
  if (title.includes('trade balance') || title.includes('current account')) {
    return {
      gold: 'Trade deficits can weaken USD, supporting gold prices.',
      crypto: 'Minimal direct impact on crypto markets.',
      currencies: `Trade surplus strengthens ${country}. Deficit weakens it.`,
      goldDir: 'neutral', cryptoDir: 'neutral', currDir: 'neutral',
    };
  }
  if (title.includes('unemployment') || title.includes('jobless')) {
    return {
      gold: 'Rising unemployment boosts gold as a safe haven.',
      crypto: 'Higher unemployment may lead to rate cuts, potentially bullish for crypto.',
      currencies: `Lower unemployment strengthens ${country}. Higher weakens it.`,
      goldDir: 'up', cryptoDir: 'up', currDir: 'down',
    };
  }
  // Default
  return {
    gold: 'Monitor this event for potential volatility in gold markets.',
    crypto: 'This event may create short-term crypto market volatility.',
    currencies: `Watch for ${country} currency movements around this release.`,
    goldDir: 'neutral', cryptoDir: 'neutral', currDir: 'neutral',
  };
}

const DirectionIcon = ({ dir }: { dir: 'up' | 'down' | 'neutral' }) => {
  if (dir === 'up') return <TrendingUp className="w-3.5 h-3.5 text-bullish" />;
  if (dir === 'down') return <TrendingDown className="w-3.5 h-3.5 text-bearish" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
};

export const NewsCalendar: React.FC = () => {
  const [events, setEvents] = useState<EconomicEvent[]>(fallbackEvents);
  const [impactFilter, setImpactFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [categoryFilter, setCategoryFilter] = useState<EventCategory>('all');
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState('Asia/Kolkata');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  const filteredEvents = events.filter((event) => {
    const matchesImpact = impactFilter === 'all' || event.impact === impactFilter;
    const matchesDate = !selectedDate || event.date === format(selectedDate, 'yyyy-MM-dd');
    return matchesImpact && matchesDate;
  });

  // Sort: today first, then upcoming (future), then previous (past)
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const aIsToday = a.date === today;
    const bIsToday = b.date === today;
    const aIsFuture = a.date > today;
    const bIsFuture = b.date > today;

    if (aIsToday && !bIsToday) return -1;
    if (!aIsToday && bIsToday) return 1;
    if (aIsFuture && !bIsFuture && !bIsToday) return -1;
    if (!aIsFuture && !aIsToday && bIsFuture) return 1;
    return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
  });

  // Group sorted events by category label
  const categorizedEvents = sortedEvents.reduce((acc, event) => {
    let label: string;
    if (event.date === today) label = "📌 Today's Events";
    else if (event.date > today) label = "🔜 Upcoming Events";
    else label = "📋 Previous Events";

    if (!acc[label]) acc[label] = [];
    acc[label].push(event);
    return acc;
  }, {} as Record<string, EconomicEvent[]>);

  // Convert time to selected timezone
  const convertToTimezone = (time: string, date: string) => {
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const eventDate = new Date(date);
      eventDate.setUTCHours(hours, minutes, 0, 0);
      return eventDate.toLocaleTimeString('en-US', {
        timeZone: selectedTimezone, hour: '2-digit', minute: '2-digit', hour12: false,
      });
    } catch { return time; }
  };

  const getTimezoneAbbr = () => {
    const tz = timezones.find(t => t.value === selectedTimezone);
    return tz ? tz.label.match(/\(([^)]+)\)/)?.[1] || '' : '';
  };

  const fetchEconomicNews = async (category: EventCategory = 'all') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('economic-news', {
        body: { action: category },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (data?.data && Array.isArray(data.data)) {
        const formattedEvents: EconomicEvent[] = data.data.map((event: any, index: number) => ({
          id: event.id || String(index),
          title: event.title || event.event || 'Unknown Event',
          country: event.country || event.currency || 'USD',
          date: event.date || new Date().toISOString().split('T')[0],
          time: event.time || '00:00',
          impact: event.impact || 'medium',
          forecast: event.forecast,
          previous: event.previous,
          actual: event.actual,
        }));
        setEvents(formattedEvents);
        setIsLive(true);
        toast.success('Economic news updated');
      }
    } catch (error) {
      console.error('Error fetching economic news:', error);
      toast.error('Failed to fetch live news, showing cached data');
      setEvents(fallbackEvents);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEconomicNews(categoryFilter);
    const interval = setInterval(() => fetchEconomicNews(categoryFilter), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [categoryFilter]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4 animate-fade-in">
        <h1 className="text-4xl font-bold">
          <span className="gradient-text">Economic</span> Calendar
        </h1>
        <p className="text-muted-foreground text-lg">
          Stay updated with economic events and their impact on Gold, Crypto & Currencies
        </p>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-card/50 border border-border/50 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-bullish animate-pulse' : 'bg-amber-500'}`}></div>
          <span className="text-sm text-muted-foreground">
            {isLive ? 'Live Economic Data' : 'Economic Data'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
            <SelectTrigger className="w-[180px]">
              <Globe className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timezones.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                <CalendarIcon className="w-4 h-4 mr-2" />
                {selectedDate ? format(selectedDate, 'PPP') : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[100] bg-popover" align="start">
              <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          {selectedDate && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>Clear</Button>
          )}

          <Button variant="secondary" size="sm" onClick={() => fetchEconomicNews(categoryFilter)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap items-center gap-4 animate-fade-in">
        <span className="text-sm text-muted-foreground">Category:</span>
        <div className="flex gap-2">
          {(['all', 'upcoming', 'ongoing', 'previous'] as EventCategory[]).map((category) => (
            <Button key={category} variant={categoryFilter === category ? 'gradient' : 'outline'} size="sm" onClick={() => setCategoryFilter(category)}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Impact Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 animate-fade-in">
        <div className="flex gap-2">
          {(['all', 'high', 'medium', 'low'] as const).map((level) => (
            <Button key={level} variant={impactFilter === level ? 'gradient' : 'outline'} size="sm" onClick={() => setImpactFilter(level)}>
              {level === 'high' && <AlertTriangle className="w-4 h-4 mr-1" />}
              {level.charAt(0).toUpperCase() + level.slice(1)} Impact
            </Button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-card/50 border border-border/50 text-sm animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-bearish"></div>
          <span className="text-muted-foreground">High Impact</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span className="text-muted-foreground">Medium Impact</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
          <span className="text-muted-foreground">Low Impact</span>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span>💡 Tap an event to see market impact</span>
        </div>
      </div>

      {/* Events grouped by category */}
      <div className="space-y-8">
        {Object.entries(categorizedEvents).map(([label, categoryEvents]) => (
          <div key={label} className="animate-fade-in">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">{label}</h2>
            <div className="space-y-3">
              {categoryEvents.map((event, index) => {
                const impact = getMarketImpact(event);
                const isExpanded = expandedEvent === event.id;
                return (
                  <div
                    key={event.id}
                    className="rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all cursor-pointer"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                  >
                    <div className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="text-2xl">{countryFlags[event.country] || '🌐'}</div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${impactColors[event.impact]}`}>
                                {event.impact.toUpperCase()}
                              </span>
                              <span className="text-sm font-mono text-muted-foreground">
                                {convertToTimezone(event.time, event.date)} {getTimezoneAbbr()}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(event.date)}
                              </span>
                            </div>
                            <h3 className="font-semibold">{event.title}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          {event.actual && (
                            <div className="text-center">
                              <p className="text-muted-foreground text-xs mb-1">Actual</p>
                              <p className="font-mono font-bold text-primary">{event.actual}</p>
                            </div>
                          )}
                          {event.forecast && (
                            <div className="text-center">
                              <p className="text-muted-foreground text-xs mb-1">Forecast</p>
                              <p className="font-mono font-medium">{event.forecast}</p>
                            </div>
                          )}
                          {event.previous && (
                            <div className="text-center">
                              <p className="text-muted-foreground text-xs mb-1">Previous</p>
                              <p className="font-mono text-muted-foreground">{event.previous}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Market Impact Panel */}
                    {isExpanded && (
                      <div className="border-t border-border/50 p-4 bg-muted/30 rounded-b-xl space-y-3 animate-fade-in">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Market Impact Analysis</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="p-3 rounded-lg bg-card border border-amber-500/20">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-lg">🥇</span>
                              <span className="text-sm font-semibold text-amber-400">Gold (XAU)</span>
                              <DirectionIcon dir={impact.goldDir} />
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{impact.gold}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-card border border-primary/20">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-lg">₿</span>
                              <span className="text-sm font-semibold text-primary">Crypto</span>
                              <DirectionIcon dir={impact.cryptoDir} />
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{impact.crypto}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-card border border-bullish/20">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-lg">💱</span>
                              <span className="text-sm font-semibold text-bullish">Currencies</span>
                              <DirectionIcon dir={impact.currDir} />
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{impact.currencies}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {sortedEvents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground animate-fade-in">
          <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No events found for the selected filter</p>
        </div>
      )}
    </div>
  );
};
