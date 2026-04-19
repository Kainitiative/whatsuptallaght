import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";

const BASE_URL = import.meta.env.BASE_URL;

interface WeatherData {
  placeName: string;
  fetchedAt: string;
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    precipitation: number;
    windSpeed: number;
    windDir: string;
    uvIndex: number;
    condition: { label: string; emoji: string };
  };
  hourly: Array<{
    time: string;
    hour: string;
    temp: number;
    precipProb: number;
    condition: { label: string; emoji: string };
  }>;
  daily: Array<{
    date: string;
    dayLabel: string;
    tempMax: number;
    tempMin: number;
    precipSum: number;
    precipProbMax: number;
    condition: { label: string; emoji: string };
  }>;
}

function uvLabel(uv: number): { label: string; color: string } {
  if (uv <= 2) return { label: "Low", color: "text-green-600" };
  if (uv <= 5) return { label: "Moderate", color: "text-yellow-600" };
  if (uv <= 7) return { label: "High", color: "text-orange-600" };
  if (uv <= 10) return { label: "Very High", color: "text-red-600" };
  return { label: "Extreme", color: "text-purple-700" };
}

function formatFetchTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
}

function irishWeatherNote(place: string, condition: string, temp: number): string {
  if (temp >= 20) return `It's a warm one in ${place} today — make the most of it!`;
  if (condition.toLowerCase().includes("rain") || condition.toLowerCase().includes("drizzle"))
    return `Typical Irish weather in ${place} — don't forget your coat.`;
  if (condition.toLowerCase().includes("thunder"))
    return `Stay safe in ${place} today — there's a thunderstorm about.`;
  if (condition.toLowerCase().includes("clear") || condition.toLowerCase().includes("sunny"))
    return `A lovely day in ${place} — get outside if you can!`;
  if (temp <= 3) return `It's bitter in ${place} today — wrap up well.`;
  return `Here's your ${place} weather update for today.`;
}

export default function WeatherPage() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}api/public/weather`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch weather");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Weather data is temporarily unavailable. Please try again shortly."))
      .finally(() => setLoading(false));
  }, []);

  const place = data?.placeName ?? "Tallaght";
  const title = `${place} Weather`;

  return (
    <>
      <Helmet>
        <title>{title} — Live Forecast | What's Up Tallaght</title>
        <meta
          name="description"
          content={`Live ${place} weather forecast. Current conditions, hourly and 7-day outlook for ${place}.`}
        />
      </Helmet>

      {/* Hero */}
      <div className="bg-zinc-800 text-white">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <p className="text-white/50 text-sm uppercase tracking-widest mb-2">Live forecast</p>
          <h1 className="text-3xl md:text-5xl font-bold mb-1">{title}</h1>
          {data && (
            <p className="text-white/60 text-sm mt-3">
              {irishWeatherNote(place, data.current.condition.label, data.current.temp)}
            </p>
          )}
          {data && (
            <p className="text-white/40 text-xs mt-2">
              Updated at {formatFetchTime(data.fetchedAt)} · Refreshes every 30 minutes
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-6 py-5 text-destructive text-sm">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* SEO content block */}
            <div className="rounded-2xl border border-border bg-muted/30 p-6 md:p-8 space-y-4 text-sm text-muted-foreground leading-relaxed">
              <h2 className="text-lg font-bold text-foreground">{place} Weather — What to Expect</h2>
              <p>
                {place} sits in the south-west of County Dublin, giving it a mild, maritime climate year-round.
                Temperatures rarely dip below freezing in winter or climb above 25°C in summer, with most days
                falling somewhere between 8°C and 18°C. Rainfall is spread fairly evenly across the year —
                there's no true dry season, so a light jacket is always a sensible companion.
              </p>
              <p>
                Spring (March–May) brings longer days and gradual warming, often with bright spells and the
                occasional sharp shower. Summer (June–August) is the warmest and driest stretch — warm evenings
                are perfect for outdoor events in the area. Autumn is mild and changeable, with the first frosts
                typically arriving in November. Winters are cool and damp rather than bitterly cold, though
                Atlantic storms can bring strong winds between November and February.
              </p>
              <p>
                This weather data is pulled live from{" "}
                <a
                  href="https://open-meteo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                >
                  Open-Meteo
                </a>{" "}
                and refreshes every 30 minutes. For Met Éireann warnings and severe weather alerts, visit{" "}
                <a
                  href="https://www.met.ie"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                >
                  met.ie
                </a>.
              </p>
              <p>
                Want to know what's happening in {place} this week?{" "}
                <Link href="/events" className="underline hover:text-foreground transition-colors">
                  Check local events
                </Link>{" "}
                or{" "}
                <Link href="/" className="underline hover:text-foreground transition-colors">
                  browse the latest news
                </Link>.
              </p>
            </div>

            {/* Current conditions */}
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-5">
                Right now
              </h2>
              <div className="flex items-start gap-6 flex-wrap">
                <div>
                  <div className="flex items-end gap-3">
                    <span className="text-6xl md:text-7xl font-bold text-foreground leading-none">
                      {data.current.temp}°
                    </span>
                    <span className="text-4xl leading-none mb-1">{data.current.condition.emoji}</span>
                  </div>
                  <p className="text-xl text-muted-foreground mt-2">{data.current.condition.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Feels like {data.current.feelsLike}°C
                  </p>
                </div>
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 min-w-[240px]">
                  {[
                    { label: "Humidity", value: `${data.current.humidity}%` },
                    { label: "Wind", value: `${data.current.windSpeed} km/h ${data.current.windDir}` },
                    { label: "Rain now", value: `${data.current.precipitation} mm` },
                    {
                      label: "UV Index",
                      value: (
                        <span className={uvLabel(data.current.uvIndex).color}>
                          {data.current.uvIndex} — {uvLabel(data.current.uvIndex).label}
                        </span>
                      ),
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted/50 rounded-xl px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-sm font-semibold text-foreground">{value as React.ReactNode}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Hourly */}
            {data.hourly.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                  Next 12 hours
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {data.hourly.map((h) => (
                    <div
                      key={h.time}
                      className="flex-shrink-0 flex flex-col items-center gap-1.5 bg-muted/40 rounded-xl px-4 py-3 min-w-[70px]"
                    >
                      <p className="text-xs text-muted-foreground">{h.hour}</p>
                      <span className="text-2xl">{h.condition.emoji}</span>
                      <p className="text-sm font-bold text-foreground">{h.temp}°</p>
                      {h.precipProb > 0 && (
                        <p className="text-xs text-blue-500">💧{h.precipProb}%</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7-day */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                7-day forecast
              </h2>
              <div className="divide-y divide-border">
                {data.daily.map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="w-12 text-sm font-medium text-foreground">{day.dayLabel}</span>
                    <span className="text-xl">{day.condition.emoji}</span>
                    <span className="flex-1 text-sm text-muted-foreground hidden sm:block">
                      {day.condition.label}
                    </span>
                    {day.precipProbMax > 10 && (
                      <span className="text-xs text-blue-500 w-12 text-right">
                        💧{day.precipProbMax}%
                      </span>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-sm font-bold text-foreground">{day.tempMax}°</span>
                      <span className="text-sm text-muted-foreground">{day.tempMin}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </>
        )}
      </div>
    </>
  );
}
