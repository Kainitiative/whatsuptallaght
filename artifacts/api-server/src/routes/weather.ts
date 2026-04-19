import { Router } from "express";
import { getSettingValue } from "./settings";

const router = Router();

// ---------------------------------------------------------------------------
// In-memory cache (30-minute TTL — weather doesn't change faster than this)
// ---------------------------------------------------------------------------

interface WeatherCache {
  data: WeatherResponse;
  expiresAt: number;
}

let cache: WeatherCache | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// WMO weather code → human description + emoji
// ---------------------------------------------------------------------------

function describeCode(code: number): { label: string; emoji: string } {
  if (code === 0)  return { label: "Clear sky", emoji: "☀️" };
  if (code === 1)  return { label: "Mainly clear", emoji: "🌤️" };
  if (code === 2)  return { label: "Partly cloudy", emoji: "⛅" };
  if (code === 3)  return { label: "Overcast", emoji: "☁️" };
  if (code <= 49)  return { label: "Foggy", emoji: "🌫️" };
  if (code <= 55)  return { label: "Drizzle", emoji: "🌦️" };
  if (code <= 65)  return { label: "Rainy", emoji: "🌧️" };
  if (code <= 77)  return { label: "Snowy", emoji: "❄️" };
  if (code <= 82)  return { label: "Rain showers", emoji: "🌧️" };
  if (code <= 86)  return { label: "Snow showers", emoji: "🌨️" };
  if (code <= 99)  return { label: "Thunderstorm", emoji: "⛈️" };
  return { label: "Unknown", emoji: "🌡️" };
}

function windDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export interface WeatherResponse {
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
    time: string;       // ISO
    hour: string;       // "14:00"
    temp: number;
    precipProb: number;
    condition: { label: string; emoji: string };
  }>;
  daily: Array<{
    date: string;       // "2025-04-20"
    dayLabel: string;   // "Mon", "Tue" etc
    tempMax: number;
    tempMin: number;
    precipSum: number;
    precipProbMax: number;
    condition: { label: string; emoji: string };
  }>;
}

// ---------------------------------------------------------------------------
// Fetch from Open-Meteo (free, no key required)
// ---------------------------------------------------------------------------

async function fetchWeather(lat: number, lon: number): Promise<WeatherResponse> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "uv_index",
    ].join(","),
    hourly: ["temperature_2m", "precipitation_probability", "weather_code"].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
    ].join(","),
    timezone: "Europe/Dublin",
    forecast_days: "7",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const raw = await res.json() as Record<string, unknown>;

  const c = raw.current as Record<string, unknown>;
  const h = raw.hourly as Record<string, number[]>;
  const d = raw.daily as Record<string, (number | string)[]>;

  // Only return the next 12 hourly slots from now
  const nowHour = new Date().getHours();
  const startIdx = h.time.findIndex((t: string) => {
    const hour = new Date(t).getHours();
    return hour >= nowHour;
  });
  const hourlySlice = h.time
    .slice(startIdx, startIdx + 12)
    .map((t: string, i: number) => ({
      time: t,
      hour: t.slice(11, 16),
      temp: Math.round(h.temperature_2m[startIdx + i]),
      precipProb: h.precipitation_probability[startIdx + i] ?? 0,
      condition: describeCode(h.weather_code[startIdx + i]),
    }));

  const dailyFormatted = (d.time as string[]).map((date: string, i: number) => {
    const day = new Date(date + "T12:00:00");
    return {
      date,
      dayLabel: i === 0 ? "Today" : day.toLocaleDateString("en-IE", { weekday: "short" }),
      tempMax: Math.round(d.temperature_2m_max[i] as number),
      tempMin: Math.round(d.temperature_2m_min[i] as number),
      precipSum: Math.round((d.precipitation_sum[i] as number) * 10) / 10,
      precipProbMax: d.precipitation_probability_max[i] as number,
      condition: describeCode(d.weather_code[i] as number),
    };
  });

  return {
    placeName: "", // filled in by the route
    fetchedAt: new Date().toISOString(),
    current: {
      temp: Math.round(c.temperature_2m as number),
      feelsLike: Math.round(c.apparent_temperature as number),
      humidity: Math.round(c.relative_humidity_2m as number),
      precipitation: c.precipitation as number,
      windSpeed: Math.round(c.wind_speed_10m as number),
      windDir: windDirection(c.wind_direction_10m as number),
      uvIndex: Math.round(c.uv_index as number),
      condition: describeCode(c.weather_code as number),
    },
    hourly: hourlySlice,
    daily: dailyFormatted,
  };
}

// ---------------------------------------------------------------------------
// Public: GET /public/weather
// ---------------------------------------------------------------------------

router.get("/public/weather", async (_req, res) => {
  try {
    const now = Date.now();

    if (cache && cache.expiresAt > now) {
      return res.json(cache.data);
    }

    const [latStr, lonStr, placeName] = await Promise.all([
      getSettingValue("weather_lat"),
      getSettingValue("weather_lon"),
      getSettingValue("weather_place_name"),
    ]);

    const lat = latStr ? parseFloat(latStr) : 53.2877;
    const lon = lonStr ? parseFloat(lonStr) : -6.3664;
    const name = placeName ?? "Tallaght";

    const data = await fetchWeather(lat, lon);
    data.placeName = name;

    cache = { data, expiresAt: now + CACHE_TTL_MS };

    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "weather_fetch_failed", message: "Could not fetch weather data. Please try again shortly." });
  }
});

export default router;
