export interface HolidayOccurrence {
  id: string;
  /** Stable across years, so future per-holiday content can be keyed to it. */
  slug: string;
  title: string;
  /** Calendar date, YYYY-MM-DD. Never a timestamp, so it cannot shift between timezones. */
  date: string;
  /** Inclusive last day, YYYY-MM-DD, for multi-day observances. */
  endDate?: string;
}

type Season = 'spring' | 'summer' | 'fall' | 'winter';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

// All civil-date math goes through UTC so the host timezone can never leak in.
const utcDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));
const weekdayOf = (year: number, month: number, day: number) => utcDate(year, month, day).getUTCDay();
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const addDays = (year: number, month: number, day: number, delta: number) => {
  const d = utcDate(year, month, day + delta);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

/** Day-of-month of the nth given weekday (0 = Sunday) in a month. */
const nthWeekday = (year: number, month: number, weekday: number, n: number) =>
  1 + ((weekday - weekdayOf(year, month, 1) + 7) % 7) + (n - 1) * 7;

const lastWeekday = (year: number, month: number, weekday: number) => {
  const last = daysInMonth(year, month);
  return last - ((weekdayOf(year, month, last) - weekday + 7) % 7);
};

/** Gregorian Easter (anonymous / Meeus-Jones-Butcher algorithm). */
const easterDate = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
};

/** Federal rule: a Saturday holiday is observed Friday, a Sunday holiday Monday. */
const observedDate = (year: number, month: number, day: number) => {
  const weekday = weekdayOf(year, month, day);
  if (weekday === 6) return addDays(year, month, day, -1);
  if (weekday === 0) return addDays(year, month, day, 1);
  return null;
};

// Meeus, Astronomical Algorithms ch. 27: mean JDE of each seasonal event, valid for years 1000-3000.
const SEASON_POLY: Record<Season, readonly number[]> = {
  spring: [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
  summer: [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.0003],
  fall: [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
  winter: [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
};

// Meeus table 27.C periodic terms: [A, B degrees, C degrees per Julian century].
const SEASON_TERMS: readonly (readonly [number, number, number])[] = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186],
  [182, 27.85, 445267.112], [156, 73.14, 45036.886], [136, 171.52, 22518.443],
  [77, 222.54, 65928.934], [74, 296.72, 3034.906], [70, 243.58, 9037.513],
  [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
  [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417],
  [18, 155.12, 67555.328], [17, 288.79, 4562.452], [16, 198.04, 62894.029],
  [14, 199.76, 31436.921], [12, 95.39, 14577.848], [12, 287.11, 31931.756],
  [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
];

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** TT minus UT in seconds (Espenak & Meeus polynomials, accurate for roughly 2005-2150). */
const deltaTSeconds = (year: number) => {
  if (year >= 2050) return -20 + 32 * ((year - 1820) / 100) ** 2 - 0.5628 * (2150 - year);
  const t = year - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t * t;
};

/** The instant of an equinox or solstice; accurate to about a minute for years near 2000-2100. */
export function seasonInstant(year: number, season: Season): Date {
  const [c0, c1, c2, c3, c4] = SEASON_POLY[season];
  const y = (year - 2000) / 1000;
  const jde0 = c0 + c1 * y + c2 * y ** 2 + c3 * y ** 3 + c4 * y ** 4;
  const t = (jde0 - 2451545.0) / 36525;
  const w = radians(35999.373 * t - 2.47);
  const lambda = 1 + 0.0334 * Math.cos(w) + 0.0007 * Math.cos(2 * w);
  const s = SEASON_TERMS.reduce((sum, [a, b, c]) => sum + a * Math.cos(radians(b + c * t)), 0);
  const jde = jde0 + (0.00001 * s) / lambda;
  return new Date((jde - 2440587.5) * 86400000 - deltaTSeconds(year) * 1000);
}

const NEW_YORK_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The America/New_York calendar date on which a season begins. */
const seasonDate = (year: number, season: Season) => {
  const parts = Object.fromEntries(NEW_YORK_DATE.formatToParts(seasonInstant(year, season)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** Every curated holiday and observance generated for one year; observed dates may land in a neighboring year. */
export function getHolidayOccurrences(year: number): HolidayOccurrence[] {
  const out: HolidayOccurrence[] = [];
  const add = (slug: string, title: string, date: string, endDate?: string) => {
    out.push({ id: `holiday-${slug}-${year}`, slug, title, date, ...(endDate ? { endDate } : {}) });
  };
  const addFederal = (slug: string, title: string, month: number, day: number) => {
    add(slug, title, iso(year, month, day));
    const observedOn = observedDate(year, month, day);
    if (observedOn) add(`${slug}-observed`, `${title} (Observed)`, observedOn);
  };

  // Some emoji below carry an explicit U+FE0F so they render as color emoji, not text glyphs.
  addFederal('new-years-day', '🎆 New Year’s Day', 1, 1);
  add('mlk-day', 'Martin Luther King Jr. Day', iso(year, 1, nthWeekday(year, 1, 1, 3)));
  add('black-history-month', 'Black History Month', iso(year, 2, 1), iso(year, 2, daysInMonth(year, 2)));
  add('valentines-day', '💌 Valentine’s Day', iso(year, 2, 14));
  add('presidents-day', 'Presidents’ Day', iso(year, 2, nthWeekday(year, 2, 1, 3)));
  add('womens-history-month', 'Women’s History Month', iso(year, 3, 1), iso(year, 3, 31));
  add('st-patricks-day', '\u2618\uFE0F St. Patrick’s Day', iso(year, 3, 17));
  add('first-day-of-spring', '🌸 First Day of Spring', seasonDate(year, 'spring'));
  add('april-fools-day', 'April Fools’ Day', iso(year, 4, 1));
  add('easter', '🐣 Easter Sunday', easterDate(year));
  add('mothers-day', 'Mother’s Day', iso(year, 5, nthWeekday(year, 5, 0, 2)));
  add('memorial-day', 'Memorial Day', iso(year, 5, lastWeekday(year, 5, 1)));
  add('fathers-day', 'Father’s Day', iso(year, 6, nthWeekday(year, 6, 0, 3)));
  addFederal('juneteenth', 'Juneteenth', 6, 19);
  add('first-day-of-summer', '\u2600\uFE0F First Day of Summer', seasonDate(year, 'summer'));
  addFederal('independence-day', '🇺🇸 Independence Day', 7, 4);
  add('labor-day', 'Labor Day', iso(year, 9, nthWeekday(year, 9, 1, 1)));
  add('first-day-of-fall', '🍂 First Day of Fall', seasonDate(year, 'fall'));
  add('indigenous-peoples-day', 'Indigenous Peoples’ Day', iso(year, 10, nthWeekday(year, 10, 1, 2)));
  add('halloween', '🎃 Halloween', iso(year, 10, 31));
  addFederal('veterans-day', 'Veterans Day', 11, 11);
  add('thanksgiving', '🦃 Thanksgiving', iso(year, 11, nthWeekday(year, 11, 4, 4)));
  add('first-day-of-winter', '\u2744\uFE0F First Day of Winter', seasonDate(year, 'winter'));
  add('christmas-eve', 'Christmas Eve', iso(year, 12, 24));
  addFederal('christmas-day', '🎄 Christmas Day', 12, 25);
  add('new-years-eve', 'New Year’s Eve', iso(year, 12, 31));

  return out;
}
