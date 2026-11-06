import { getHolidayOccurrences } from './holidays';

export type CalendarId = 'personal' | 'holidays';

export interface CalendarDefinition {
  id: CalendarId;
  name: string;
  color: string;
}

export const CALENDARS: readonly CalendarDefinition[] = [
  { id: 'personal', name: 'Miss Editaire', color: '#F472B6' },
  { id: 'holidays', name: 'Holidays & Observances', color: '#A78BFA' },
];

// Reserved for later; not rendered yet.
export interface CalendarEventExtras {
  message?: string;
  emoji?: string;
  imageUrl?: string;
  flyerUrl?: string;
  linkUrl?: string;
}

export interface PublishedCalendarEvent extends CalendarEventExtras {
  id: string;
  calendarId: CalendarId;
  title: string;
  description?: string;
  /** Calendar date as YYYY-MM-DD; all-day events are not tied to a timezone. */
  date: string;
  /** Inclusive last day, YYYY-MM-DD, for multi-day all-day events. */
  endDate?: string;
  allDay: true;
}

const PERSONAL_EVENTS: readonly PublishedCalendarEvent[] = [
  {
    id: 'launch-2027-01-08',
    calendarId: 'personal',
    title: 'FROM THE DESK OF… Launch',
    description: 'The official launch of FROM THE DESK OF…, Miss Editaire’s interactive personal computer.',
    date: '2027-01-08',
    allDay: true,
  },
];

// Per-holiday content keyed by holiday slug, applied to every year; empty until the owner publishes some.
const HOLIDAY_EXTRAS: Readonly<Record<string, CalendarEventExtras>> = {};

/** Events for one calendar year; holidays come from neighboring years too so observed dates that cross New Year are included. */
export function getPublishedCalendarEvents(year: number): PublishedCalendarEvent[] {
  const holidays = [year - 1, year, year + 1].flatMap(getHolidayOccurrences).map((h): PublishedCalendarEvent => ({
    id: h.id,
    calendarId: 'holidays',
    title: h.title,
    date: h.date,
    ...(h.endDate ? { endDate: h.endDate } : {}),
    allDay: true,
    ...HOLIDAY_EXTRAS[h.slug],
  }));
  return [...PERSONAL_EVENTS, ...holidays];
}
