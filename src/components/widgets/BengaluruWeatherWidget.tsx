import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { IoCloudySharp, IoPartlySunny, IoSunny, IoMoon, IoRainy, IoThunderstorm } from 'react-icons/io5';
import {
  BsFillMoonStarsFill,
  BsFillSunsetFill,
  BsFillSunriseFill,
  BsFillCloudMoonFill,
  BsCloudDrizzleFill,
  BsCloudLightningFill,
  BsCloudLightningRainFill,
} from 'react-icons/bs';
import { FaCloudSunRain, FaCloudMoonRain } from 'react-icons/fa6';

interface CurrentWeather {
  temp: number;
  weather_code: number;
  is_day: number;
  high: number;
  low: number;
}

interface HourSlot {
  hour: string;
  temp: number;
  code: number;
  is_day: number;
  isSunset?: boolean;
  isSunrise?: boolean;
}

export interface WeatherLocation {
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export const DEFAULT_WEATHER_LOCATION: WeatherLocation = {
  city: 'New York City',
  region: 'New York',
  country: 'USA',
  latitude: 40.7128,
  longitude: -74.006,
  timezone: 'America/New_York',
};

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    weather_code: number;
    is_day: number;
  };
  hourly: {
    time: number[];
    temperature_2m: number[];
    weather_code: number[];
    is_day: number[];
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: number[];
    sunset: number[];
  };
}

const formatCityTime = (timestamp: number, timezone: string, includeMinutes = false) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    ...(includeMinutes ? { minute: '2-digit' as const } : {}),
    hour12: true,
  }).format(new Date(timestamp * 1000)).replace(/\s/g, '');

const conditionLabel = (code: number, isDay: number) => {
  if (code === 0) return isDay ? 'Sunny' : 'Clear';
  if (code <= 2) return 'Partly Cloudy';
  if (code === 3) return 'Cloudy';
  if (code <= 49) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow Showers';
  return 'Thunderstorm';
};

const WeatherGlyph = ({
  code,
  isDay,
  size = 22,
  sunset,
  sunrise,
}: {
  code: number;
  isDay: number;
  size?: number;
  sunset?: boolean;
  sunrise?: boolean;
}) => {
  const style = { color: '#ffffff' };
  const props = { size, style };

  if (sunrise) return <BsFillSunriseFill {...props} />;
  if (sunset) return <BsFillSunsetFill {...props} />;
  if (code === 0) return isDay ? <IoSunny {...props} /> : <BsFillMoonStarsFill {...props} />;
  if (code <= 2) return isDay ? <IoPartlySunny {...props} /> : <BsFillCloudMoonFill {...props} />;
  if (code === 3 || code <= 49) return <IoCloudySharp {...props} />;
  if (code <= 57) return <BsCloudDrizzleFill {...props} />;
  if (code <= 67 || (code >= 80 && code <= 82)) return isDay ? <FaCloudSunRain {...props} /> : <FaCloudMoonRain {...props} />;
  if (code === 95) return <IoThunderstorm {...props} />;
  if (code === 96 || code === 99) return <BsCloudLightningRainFill {...props} />;
  if (code <= 99) return <BsCloudLightningFill {...props} />;
  return <IoRainy {...props} />;
};

export const BengaluruWeatherWidget = ({
  className,
  location = DEFAULT_WEATHER_LOCATION,
}: {
  className?: string;
  location?: WeatherLocation;
}) => {
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [hours, setHours] = useState<HourSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const { latitude, longitude, timezone } = location;

  useEffect(() => {
    let cancelled = false;
    let refreshTimeout: number | undefined;
    let activeRequest: AbortController | undefined;

    const fetchWeather = async () => {
      activeRequest = new AbortController();
      setIsLoading(true);
      setIsUnavailable(false);
      setCurrent(null);
      setHours([]);

      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          current: 'temperature_2m,is_day,weather_code',
          hourly: 'temperature_2m,weather_code,is_day',
          daily: 'temperature_2m_max,temperature_2m_min,sunset,sunrise',
          timezone,
          forecast_days: '2',
          timeformat: 'unixtime',
          temperature_unit: 'fahrenheit',
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
          signal: activeRequest.signal,
        });
        if (!response.ok) throw new Error('Weather request failed');

        const data = await response.json() as OpenMeteoResponse;
        const hourly = data?.hourly;
        const daily = data?.daily;
        const currentData = data?.current;
        if (
          !currentData || !hourly || !daily ||
          !Array.isArray(hourly.time) || !Array.isArray(hourly.temperature_2m) ||
          !Array.isArray(hourly.weather_code) || !Array.isArray(hourly.is_day) ||
          !Array.isArray(daily.temperature_2m_max) || !Array.isArray(daily.temperature_2m_min)
        ) {
          throw new Error('Weather response is incomplete');
        }

        const dailyHigh = daily.temperature_2m_max[0];
        const dailyLow = daily.temperature_2m_min[0];
        if (![currentData.temperature_2m, currentData.weather_code, currentData.is_day, dailyHigh, dailyLow].every(Number.isFinite)) {
          throw new Error('Weather response contains invalid values');
        }

        const now = Math.floor(Date.now() / 1000);
        const start = hourly.time.findIndex(timestamp => timestamp >= now);
        if (start < 0 || start + 5 >= hourly.time.length) {
          throw new Error('Hourly forecast is unavailable');
        }

        const slots: HourSlot[] = [];
        for (let offset = 0; offset < 6; offset++) {
          const index = start + offset;
          const temperature = hourly.temperature_2m[index];
          const code = hourly.weather_code[index];
          const isDay = hourly.is_day[index];
          if (![hourly.time[index], temperature, code, isDay].every(Number.isFinite)) {
            throw new Error('Hourly forecast contains invalid values');
          }
          slots.push({
            hour: formatCityTime(hourly.time[index], timezone),
            temp: Math.round(temperature),
            code,
            is_day: isDay,
          });
        }

        const firstHour = hourly.time[start];
        const lastHour = hourly.time[start + 5];
        const sunEvents = [
          ...(Array.isArray(daily.sunrise) ? daily.sunrise.map(timestamp => ({ timestamp, isSunrise: true })) : []),
          ...(Array.isArray(daily.sunset) ? daily.sunset.map(timestamp => ({ timestamp, isSunset: true })) : []),
        ]
          .filter(event => Number.isFinite(event.timestamp) && event.timestamp >= firstHour && event.timestamp <= lastHour)
          .sort((first, second) => first.timestamp - second.timestamp);

        sunEvents.forEach(event => {
          const offset = Math.round((event.timestamp - firstHour) / 3600);
          slots.splice(Math.min(offset, slots.length - 1), 0, {
            hour: formatCityTime(event.timestamp, timezone, true),
            temp: 0,
            code: 0,
            is_day: 1,
            isSunrise: 'isSunrise' in event ? event.isSunrise : undefined,
            isSunset: 'isSunset' in event ? event.isSunset : undefined,
          });
        });

        if (cancelled) return;
        setCurrent({
          temp: Math.round(currentData.temperature_2m),
          weather_code: currentData.weather_code,
          is_day: currentData.is_day,
          high: Math.round(dailyHigh),
          low: Math.round(dailyLow),
        });
        setHours(slots.slice(0, 6));
      } catch {
        if (!cancelled) {
          setCurrent(null);
          setHours([]);
          setIsUnavailable(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          refreshTimeout = window.setTimeout(() => { void fetchWeather(); }, REFRESH_INTERVAL_MS);
        }
      }
    };

    void fetchWeather();
    return () => {
      cancelled = true;
      activeRequest?.abort();
      if (refreshTimeout !== undefined) window.clearTimeout(refreshTimeout);
    };
  }, [latitude, longitude, timezone]);

  return (
    <div
      className={cn('rounded-3xl overflow-hidden liquid-glass-card text-white', className)}
      style={{ width: 356, fontFamily: "'Inter', -apple-system, sans-serif" }}
    >
      <div className="px-4 pt-3 pb-2.5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[14px]" style={{ fontWeight: 500, letterSpacing: '0.01em' }}>
              {location.city}
            </div>

            <div
              className="leading-none mt-1"
              style={{ fontSize: 38, fontWeight: 400, letterSpacing: '-0.02em' }}
            >
              {current ? `${current.temp}°` : '—'}
            </div>
          </div>

          <div className="text-right flex flex-col items-end gap-0.5">
            {current && <WeatherGlyph code={current.weather_code} isDay={current.is_day} size={22} />}
            {!current && (isUnavailable || isLoading) && (
              <div className="text-[12px] text-white/75" aria-live="polite">
                {isUnavailable ? 'Weather unavailable' : 'Updating…'}
              </div>
            )}

            {current && (
              <>
                <div className="text-[13px]" style={{ fontWeight: 400, letterSpacing: '0.01em' }}>
                  {conditionLabel(current.weather_code, current.is_day)}
                </div>

                <div className="text-[12px] text-white/75" style={{ fontWeight: 300 }}>
                  H:{current.high}° L:{current.low}°
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1 mt-2">
          {hours.map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="text-[11px] text-white/80" style={{ fontWeight: 400 }}>
                {h.hour}
              </div>

              <WeatherGlyph code={h.code} isDay={h.is_day} size={20} sunset={h.isSunset} sunrise={h.isSunrise} />

              {!h.isSunset && !h.isSunrise ? (
                <div className="text-[13px]" style={{ fontWeight: 500 }}>
                  {h.temp}°
                </div>
              ) : (
                <div className="text-[11px] text-white/75" style={{ fontWeight: 400 }}>
                  {h.isSunset ? 'Set' : 'Rise'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
