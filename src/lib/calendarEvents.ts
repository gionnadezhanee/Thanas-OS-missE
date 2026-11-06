export type CalendarEventColor = 'red' | 'gray' | 'green' | 'blue' | 'orange';

export interface PublishedCalendarEvent {
  id: string;
  title: string;
  description?: string;
  /** Calendar date as YYYY-MM-DD; all-day events are not tied to a timezone. */
  date: string;
  allDay: true;
  color: CalendarEventColor;
  // Reserved for later; not rendered yet.
  imageUrl?: string;
  flyerUrl?: string;
  linkUrl?: string;
}

export const PUBLISHED_CALENDAR_EVENTS: readonly PublishedCalendarEvent[] = [
  {
    id: 'launch-2027-01-08',
    title: 'FROM THE DESK OF… Launch',
    description: 'The official launch of FROM THE DESK OF…, Miss Editaire’s interactive personal computer.',
    date: '2027-01-08',
    allDay: true,
    color: 'red',
  },
];
