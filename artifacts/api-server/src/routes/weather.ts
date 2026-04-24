import { Router } from "express";
import OpenAI from "openai";
import { getSettingValue } from "./settings";

const router = Router();

// ---------------------------------------------------------------------------
// In-memory caches (30-minute TTL)
// ---------------------------------------------------------------------------

interface WeatherCache {
  data: WeatherResponse;
  expiresAt: number;
}

interface DayCache {
  data: DayForecast;
  expiresAt: number;
}

let cache7: WeatherCache | null = null;
let cache16: WeatherCache | null = null;
const dayCache: Record<string, DayCache> = {};
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
// Rule-based human weather message (exported for server-side use)
// ---------------------------------------------------------------------------

export function generateWeatherMessage(
  tempMax: number,
  precipProbMax: number,
  conditionCode: number,
  placeName: string,
): string {
  const isSunny = conditionCode <= 2;
  if (tempMax >= 20 && isSunny) return "Looks like a deadly day — sun cream wouldn't go amiss.";
  if (precipProbMax > 60) return "Rain is likely — worth packin' an umbrella, sham.";
  if (tempMax <= 4) return "Pure Baltic out there — wrap up or you'll be destroyed.";
  if (tempMax <= 10 && precipProbMax > 40) return "A cold, manky one — the classic Dublin combo.";
  return `Typical ${placeName} weather — sure you'd be used to it at this stage.`;
}

// ---------------------------------------------------------------------------
// AI-generated Dublin satirical weather quip (linked to article topic)
// ---------------------------------------------------------------------------

/**
 * Generates a one-line Dublin-flavoured satirical weather comment that ties
 * together the article topic and the weather forecast. Uses gpt-4o-mini.
 * Falls back to generateWeatherMessage() if AI is unavailable.
 *
 * @param openai  - OpenAI client
 * @param headline - The article headline
 * @param tone     - Article tone (sport, event, community, etc.)
 * @param tempMax  - Max temperature for the day (°C)
 * @param precipProbMax - Precipitation probability 0–100
 * @param conditionLabel - Human weather label e.g. "Rainy", "Clear sky"
 */
export async function generateWeatherQuip(
  openai: OpenAI,
  headline: string,
  tone: string,
  tempMax: number,
  precipProbMax: number,
  conditionLabel: string,
): Promise<string | null> {
  try {
    const weatherDesc = precipProbMax > 60
      ? `${conditionLabel}, ${tempMax}°C, high chance of rain`
      : conditionLabel === "Clear sky" || conditionLabel === "Mainly clear"
        ? `${conditionLabel}, ${tempMax}°C, sunny`
        : `${conditionLabel}, ${tempMax}°C`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      max_completion_tokens: 60,
      messages: [
        {
          role: "system",
          content: `You write one-line satirical weather comments for a community news website in Tallaght, Dublin, Ireland.

Your comments are written in the voice of a witty Dublin local — dry humour, light sarcasm, and natural Dublin slang.

Dublin slang to draw from (use naturally, not forced):
- "deadly" = great/brilliant
- "bleeding" / "bleedin'" = intensifier (like "very")
- "gas" = funny/amusing
- "manky" = awful/disgusting
- "savage" = brilliant/intense
- "sham" = mate/friend
- "rapid" = great
- "Jaysus" = exclamation of surprise
- "Pure [adjective]" = very [adjective] e.g. "pure Baltic" = very cold
- "scarlet" = embarrassed
- "acting the maggot" = messing around
- "knackered" = exhausted
- "bang on" = perfect
- "the craic" = the fun/vibe
- "sorted" = done/arranged

Rules:
- ONE sentence only — short and punchy
- Must relate to BOTH the article topic AND the weather
- Dry, self-aware Dublin humour — not try-hard or cringe
- Never mention specific real people by name
- Never be offensive or mean-spirited
- Do not use hashtags, emojis, or quotation marks
- Return ONLY the one-line comment, nothing else`,
        },
        {
          role: "user",
          content: `Article headline: ${headline}\nArticle type: ${tone}\nWeather: ${weatherDesc}`,
        },
      ],
    });

    const result = response.choices[0].message.content?.trim() ?? "";
    return result.length > 5 ? result : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Response shapes
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

export interface DayForecast {
  date: string;
  dayLabel: string;
  tempMax: number;
  tempMin: number;
  precipProbMax: number;
  condition: { label: string; emoji: string };
  message: string;
  placeName: string;
}

// ---------------------------------------------------------------------------
// Fetch from Open-Meteo
// ---------------------------------------------------------------------------

async function fetchWeather(lat: number, lon: number, forecastDays = 7): Promise<WeatherResponse> {
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
    forecast_days: String(forecastDays),
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const raw = await res.json() as Record<string, unknown>;

  const c = raw.current as Record<string, unknown>;
  const h = raw.hourly as Record<string, number[]>;
  const d = raw.daily as Record<string, (number | string)[]>;

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
    placeName: "",
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
// Internal export: fetch forecast for a specific date (used by schedulers)
// ---------------------------------------------------------------------------

export async function getWeatherForDate(date: string): Promise<DayForecast | null> {
  try {
    const now = Date.now();
    const cached = dayCache[date];
    if (cached && cached.expiresAt > now) return cached.data;

    const [latStr, lonStr, placeName] = await Promise.all([
      getSettingValue("weather_lat"),
      getSettingValue("weather_lon"),
      getSettingValue("weather_place_name"),
    ]);

    const lat = latStr ? parseFloat(latStr) : 53.2877;
    const lon = lonStr ? parseFloat(lonStr) : -6.3664;
    const name = placeName ?? "Tallaght";

    // Use cached 16-day data if available, otherwise fetch
    let weather: WeatherResponse;
    if (cache16 && cache16.expiresAt > now) {
      weather = cache16.data;
    } else {
      weather = await fetchWeather(lat, lon, 16);
      weather.placeName = name;
      cache16 = { data: weather, expiresAt: now + CACHE_TTL_MS };
    }

    const day = weather.daily.find((d) => d.date === date);
    if (!day) return null;

    const result: DayForecast = {
      date: day.date,
      dayLabel: day.dayLabel,
      tempMax: day.tempMax,
      tempMin: day.tempMin,
      precipProbMax: day.precipProbMax,
      condition: day.condition,
      message: generateWeatherMessage(day.tempMax, day.precipProbMax, 0, name),
      placeName: name,
    };

    dayCache[date] = { data: result, expiresAt: now + CACHE_TTL_MS };
    return result;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public: GET /public/weather   (7-day, existing endpoint — unchanged shape)
// Optional ?days=16 for extended forecast
// ---------------------------------------------------------------------------

router.get("/public/weather", async (req, res) => {
  try {
    const requestedDays = Math.min(16, Math.max(1, parseInt(String(req.query.days ?? "7")) || 7));
    const use16 = requestedDays > 7;
    const now = Date.now();

    const activeCache = use16 ? cache16 : cache7;
    if (activeCache && activeCache.expiresAt > now) {
      return res.json(activeCache.data);
    }

    const [latStr, lonStr, placeName] = await Promise.all([
      getSettingValue("weather_lat"),
      getSettingValue("weather_lon"),
      getSettingValue("weather_place_name"),
    ]);

    const lat = latStr ? parseFloat(latStr) : 53.2877;
    const lon = lonStr ? parseFloat(lonStr) : -6.3664;
    const name = placeName ?? "Tallaght";

    const data = await fetchWeather(lat, lon, requestedDays);
    data.placeName = name;

    if (use16) {
      cache16 = { data, expiresAt: now + CACHE_TTL_MS };
    } else {
      cache7 = { data, expiresAt: now + CACHE_TTL_MS };
    }

    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "weather_fetch_failed", message: "Could not fetch weather data. Please try again shortly." });
  }
});

// ---------------------------------------------------------------------------
// Public: GET /public/weather/day?date=YYYY-MM-DD
// Returns a single day's forecast with a human message, or 404 if out of range
// ---------------------------------------------------------------------------

router.get("/public/weather/day", async (req, res) => {
  const date = String(req.query.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "validation_error", message: "date must be YYYY-MM-DD" });
  }

  try {
    const forecast = await getWeatherForDate(date);
    if (!forecast) {
      return res.status(404).json({ error: "not_found", message: "Date is outside the 16-day forecast window" });
    }
    res.json(forecast);
  } catch (err) {
    res.status(502).json({ error: "weather_fetch_failed", message: "Could not fetch weather data." });
  }
});

export default router;
