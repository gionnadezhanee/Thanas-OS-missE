import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Calendar as CalIcon, Clock, Grid3x3, List, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMacOS } from '@/contexts/MacOSContext';
import { CALENDARS, getPublishedCalendarEvents, type CalendarId, type PublishedCalendarEvent } from '@/lib/calendarEvents';

interface CalEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
  calendarId: CalendarId;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const dkey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const sameDay = (a: Date, b: Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

type Tone = ReturnType<typeof getTone>;

const getTone = (dark: boolean) => dark ? {
  page: '#1c1c1e', text: '#f5f5f7', sub: '#a8a8ad', border: 'rgba(255,255,255,0.10)',
  cell: '#1c1c1e', cellAlt: '#16161a', hover: 'rgba(250,45,72,0.12)',
  modal: '#2a2a2e', input: '#1c1c1e', inputBorder: 'rgba(255,255,255,0.18)',
  segActive: '#f5f5f7', segActiveText: '#1c1c1e', segText: '#a8a8ad', segHover: 'rgba(255,255,255,0.06)',
  headerBg: '#2a2a2e',
} : {
  page: '#ffffff', text: '#1c1c1e', sub: '#737378', border: 'rgba(0,0,0,0.10)',
  cell: '#ffffff', cellAlt: '#fafafa', hover: 'rgba(250,45,72,0.06)',
  modal: '#ffffff', input: '#ffffff', inputBorder: 'rgba(0,0,0,0.15)',
  segActive: '#1c1c1e', segActiveText: '#ffffff', segText: '#404048', segHover: 'rgba(0,0,0,0.05)',
  headerBg: '#3a3a3e',
};

const CALENDAR_COLORS = Object.fromEntries(CALENDARS.map((c) => [c.id, c.color])) as Record<CalendarId, string>;
const eventColor = (e: CalEvent) => CALENDAR_COLORS[e.calendarId];

// Frosted-glass event chip (Apple-style transparent tint)
const evChip = (hex: string, dark: boolean) => ({
  background: dark
    ? `linear-gradient(180deg, ${hex}40, ${hex}26)`
    : `linear-gradient(180deg, ${hex}33, ${hex}1f)`,
  // Pastel calendar colors are too light to read as text on a light background.
  color: dark ? '#fff' : '#1c1c1e',
  border: `1px solid ${hex}55`,
  backdropFilter: 'blur(10px) saturate(160%)',
  WebkitBackdropFilter: 'blur(10px) saturate(160%)',
  boxShadow: `inset 0 1px 0 ${hex}33`,
  borderLeft: `3px solid ${hex}`,
});


// Built from y/m/d parts so an all-day event stays on its date in every timezone; endTime is exclusive.
const toCalEvent = (e: PublishedCalendarEvent): CalEvent => {
  const [y, m, d] = e.date.split('-').map(Number);
  const [ey, em, ed] = (e.endDate ?? e.date).split('-').map(Number);
  return {
    id: e.id, title: e.title, description: e.description, calendarId: e.calendarId, allDay: e.allDay,
    startTime: new Date(y, m - 1, d),
    endTime: new Date(ey, em - 1, ed + 1),
  };
};

const lastDayOf = (e: CalEvent) => new Date(e.endTime.getFullYear(), e.endTime.getMonth(), e.endTime.getDate() - 1);
const isMultiDay = (e: CalEvent) => !!e.allDay && dkey(lastDayOf(e)) > dkey(e.startTime);

const coversDay = (e: CalEvent, d: Date) =>
  e.allDay ? dkey(d) >= dkey(e.startTime) && dkey(d) < dkey(e.endTime) : sameDay(e.startTime, d);

// Calendar order first, then month-long banners, so rows stay consistent from day to day.
const calendarIndex = (id: CalendarId) => CALENDARS.findIndex((c) => c.id === id);
const compareEvents = (a: CalEvent, b: CalEvent) =>
  calendarIndex(a.calendarId) - calendarIndex(b.calendarId) ||
  Number(isMultiDay(b)) - Number(isMultiDay(a)) ||
  +a.startTime - +b.startTime;

const formatDateRange = (e: CalEvent, long: boolean) => {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-US', opts);
  if (!isMultiDay(e)) {
    return fmt(e.startTime, long ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
  }
  const end = lastDayOf(e);
  const month = long ? 'long' : 'short';
  const sameMonth = e.startTime.getMonth() === end.getMonth() && e.startTime.getFullYear() === end.getFullYear();
  const finish = sameMonth
    ? fmt(end, long ? { day: 'numeric', year: 'numeric' } : { day: 'numeric' })
    : fmt(end, long ? { month, day: 'numeric', year: 'numeric' } : { month, day: 'numeric' });
  return `${fmt(e.startTime, { month, day: 'numeric' })} – ${finish}`;
};

type View = 'month' | 'week' | 'day' | 'list';

export const CalendarApp = () => {
  const { settings } = useMacOS();
  const dark = settings.theme === 'dark';
  const tone = getTone(dark);

  const [current, setCurrent] = useState(new Date());
  const [view, setView] = useState<View>('month');
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [visible, setVisible] = useState<Record<CalendarId, boolean>>({ personal: true, holidays: true });

  const year = current.getFullYear();
  const events = useMemo(
    () => getPublishedCalendarEvents(year).map(toCalEvent).filter((e) => visible[e.calendarId]).sort(compareEvents),
    [year, visible],
  );

  const today = new Date();

  const navigate = (dir: -1 | 1) => {
    setCurrent((p) => {
      if (view === 'month' || view === 'list') {
        // Clamp the day so Jan 31 + 1 month lands in February instead of rolling into March.
        const n = new Date(p.getFullYear(), p.getMonth() + dir, 1);
        n.setDate(Math.min(p.getDate(), new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()));
        return n;
      }
      const n = new Date(p);
      n.setDate(p.getDate() + (view === 'week' ? 7 : 1) * dir);
      return n;
    });
  };

  const headerLabel = useMemo(() => {
    if (view === 'month') return `${MONTHS[current.getMonth()]} ${current.getFullYear()}`;
    if (view === 'day') return current.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (view === 'week') {
      const ws = startOfWeek(current);
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      return `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return 'All Events';
  }, [view, current]);

  return (
    <div className="h-full w-full flex flex-col select-none overflow-hidden"
      style={{ background: tone.page, color: tone.text, fontFamily: '-apple-system, "SF Pro Text", Roboto, sans-serif' }}>

      {/* Header — leave 78px on the left for traffic lights */}
      <div
        className="flex items-center justify-between pl-[88px] pr-4 py-3 border-b text-white"
        style={{ borderColor: tone.border, background: tone.headerBg, backdropFilter: 'blur(20px) saturate(180%)' }}
      >
        <div className="flex items-center gap-5 ml-auto">
          <h2 className="text-[19px] font-semibold tracking-tight">{headerLabel}</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="w-7 h-7 flex items-center justify-center rounded-md text-white hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => navigate(1)} className="w-7 h-7 flex items-center justify-center rounded-md text-white hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex items-center gap-6 ml-4">
          <Segmented tone={tone} value={view} onChange={setView} />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <CalendarSidebar tone={tone} visible={visible} onToggle={(id) => setVisible((v) => ({ ...v, [id]: !v[id] }))} />
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {view === 'month' && (
          <MonthView
            tone={tone}
            dark={dark}
            current={current}
            today={today}
            events={events}
            onCellClick={(d) => { setCurrent(d); setView('day'); }}
            onEventClick={setSelected}
          />
        )}
        {view === 'week' && <WeekView tone={tone} dark={dark} current={current} today={today} events={events} onEventClick={setSelected} />}
        {view === 'day' && <DayView tone={tone} dark={dark} current={current} today={today} events={events} onEventClick={setSelected} />}
        {view === 'list' && <ListView tone={tone} current={current} events={events} onEventClick={setSelected} />}
        </div>
      </div>

      {selected && (
        <Modal tone={tone} onClose={() => setSelected(null)} title={selected.title} accent={eventColor(selected)}>
          <div className="text-[13px]" style={{ color: tone.text }}>
            {formatDateRange(selected, true)}
          </div>
          <div className="text-[13px] mt-0.5" style={{ color: tone.sub }}>
            {selected.allDay ? 'All-day' : `${selected.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${selected.endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
          </div>
          {selected.description && (
            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: tone.text }}>{selected.description}</p>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <button onClick={() => setSelected(null)} className="h-8 px-3 rounded-md text-[12.5px] text-white" style={{ background: '#fa2d48' }}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const startOfWeek = (d: Date) => {
  const r = new Date(d);
  const wd = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - wd);
  r.setHours(0, 0, 0, 0);
  return r;
};

const CalendarSidebar = ({ visible, onToggle, tone }: { visible: Record<CalendarId, boolean>; onToggle: (id: CalendarId) => void; tone: Tone }) => (
  <aside className="w-[190px] shrink-0 border-r p-3 overflow-auto thin-scrollbar" style={{ borderColor: tone.border, background: tone.cellAlt }}>
    <div className="px-1 pb-2 text-[10.5px] uppercase tracking-wider" style={{ color: tone.sub }}>Calendars</div>
    {CALENDARS.map((c) => (
      <button
        key={c.id}
        type="button"
        role="checkbox"
        aria-checked={visible[c.id]}
        onClick={() => onToggle(c.id)}
        className="w-full flex items-center gap-2 px-1 py-1.5 rounded-md text-left text-[12.5px]"
        style={{ color: tone.text }}
        onMouseEnter={(e) => (e.currentTarget.style.background = tone.segHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span
          className="w-3.5 h-3.5 rounded-[4px] flex items-center justify-center shrink-0"
          style={{ background: visible[c.id] ? c.color : 'transparent', border: `1.5px solid ${c.color}` }}
        >
          {visible[c.id] && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
        </span>
        <span className="truncate">{c.name}</span>
      </button>
    ))}
  </aside>
);

const IconBtn = ({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone: Tone }) => (
  <button onClick={onClick} className="w-7 h-7 flex items-center justify-center rounded-md" style={{ color: tone.text }}
    onMouseEnter={(e) => (e.currentTarget.style.background = tone.segHover)}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>{children}</button>
);

const Segmented = ({ value, onChange, tone }: { value: View; onChange: (v: View) => void; tone: Tone }) => {
  const items: { v: View; icon: React.ReactNode; label: string }[] = [
    { v: 'month', icon: <CalIcon className="w-3.5 h-3.5" />, label: 'Month' },
    { v: 'week', icon: <Grid3x3 className="w-3.5 h-3.5" />, label: 'Week' },
    { v: 'day', icon: <Clock className="w-3.5 h-3.5" />, label: 'Day' },
    { v: 'list', icon: <List className="w-3.5 h-3.5" />, label: 'List' },
  ];
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg border" style={{ borderColor: tone.border }}>
      {items.map((it) => (
        <button
          key={it.v}
          onClick={() => onChange(it.v)}
          className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1 transition-colors"
          style={{
            background: value === it.v ? tone.segActive : 'transparent',
            color: value === it.v ? tone.segActiveText : tone.segText,
          }}
        >
          {it.icon}{it.label}
        </button>
      ))}
    </div>
  );
};

const Modal = ({ children, title, accent, onClose, tone }: { children: React.ReactNode; title: string; accent: string; onClose: () => void; tone: Tone }) => (
  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
    <div
      className="w-[440px] max-w-[92%] rounded-2xl p-5 shadow-2xl border"
      style={{ background: tone.modal, borderColor: tone.border, color: tone.text }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
          <h3 className="text-[15px] font-semibold">{title}</h3>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded"
          onMouseEnter={(e) => (e.currentTarget.style.background = tone.segHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

// ───── views ─────
const MonthView = ({ current, today, events, onCellClick, onEventClick, tone, dark }: {
  current: Date; today: Date; events: CalEvent[];
  onCellClick: (d: Date) => void; onEventClick: (e: CalEvent) => void; tone: Tone; dark: boolean;
}) => {
  const cells = useMemo(() => {
    const first = new Date(current.getFullYear(), current.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const out: { d: Date; current: boolean }[] = [];
    const prevDays = new Date(current.getFullYear(), current.getMonth(), 0).getDate();
    for (let i = offset - 1; i >= 0; i--) {
      out.push({ d: new Date(current.getFullYear(), current.getMonth() - 1, prevDays - i), current: false });
    }
    const days = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= days; d++) out.push({ d: new Date(current.getFullYear(), current.getMonth(), d), current: true });
    let nd = 1;
    while (out.length < 42) out.push({ d: new Date(current.getFullYear(), current.getMonth() + 1, nd++), current: false });
    return out;
  }, [current]);

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-3 py-1.5 text-[10.5px] uppercase tracking-wider text-right border-b" style={{ color: tone.sub, borderColor: tone.border }}>{w}</div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7 grid-rows-6 min-h-0">
        {cells.map((c, i) => {
          const evs = events.filter((e) => coversDay(e, c.d));
          const shown = evs.slice(0, 3);
          const isToday = sameDay(c.d, today);
          return (
            <button
              key={i}
              onClick={() => onCellClick(c.d)}
              className="relative text-left px-2 pt-1.5 pb-1 border-r border-b overflow-hidden min-h-0"
              style={{
                borderColor: tone.border,
                background: !c.current ? tone.cellAlt : isToday ? 'rgba(250,45,72,0.10)' : tone.cell,
                ...(isToday ? { borderTop: '3px solid #fa2d48' } : {}),
              }}
              onMouseEnter={(e) => { if (!isToday) e.currentTarget.style.background = tone.hover; }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = !c.current ? tone.cellAlt : isToday ? 'rgba(250,45,72,0.10)' : tone.cell;
              }}
            >
              {/* Date number — pinned top-right */}
              <div
                className="absolute top-1 right-2 text-[12.5px] leading-none"
                style={{
                  color: isToday ? '#fa2d48' : c.current ? tone.text : tone.sub,
                  fontWeight: isToday ? 700 : 500,
                }}
              >
                {c.d.getDate()}
              </div>
              {/* Spacer so content doesn't collide with date */}
              <div className="h-4" />
              <div className="space-y-0.5">
                {shown.map((e) => (
                  <div
                    key={e.id}
                    onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                    className="text-[10.5px] truncate px-1.5 py-px rounded cursor-pointer"
                    style={evChip(eventColor(e), dark)}
                  >
                    {e.allDay ? e.title : `${e.startTime.toLocaleTimeString('en-US', { hour: 'numeric' })} ${e.title}`}
                  </div>
                ))}
                {evs.length > shown.length && (
                  <div className="text-[10px] px-1.5" style={{ color: tone.sub }}>+{evs.length - shown.length} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const WeekView = ({ current, today, events, onEventClick, tone, dark }: {
  current: Date; today: Date; events: CalEvent[];
  onEventClick: (e: CalEvent) => void; tone: Tone; dark: boolean;
}) => {
  const start = startOfWeek(current);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const hasAllDay = events.some((e) => e.allDay && days.some((d) => coversDay(e, d)));
  return (
    <div className="h-full flex flex-col">
      <div className="grid border-b" style={{ gridTemplateColumns: '60px repeat(7, 1fr)', borderColor: tone.border }}>
        <div />
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          return (
            <div key={i} className="text-center py-2">
              <div className="text-[10.5px] uppercase tracking-wider" style={{ color: tone.sub }}>{WEEKDAYS[i]}</div>
              <div className="text-[18px] font-semibold mt-0.5" style={{ color: isToday ? '#fa2d48' : tone.text }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      {hasAllDay && (
        <div className="grid border-b" style={{ gridTemplateColumns: '60px repeat(7, 1fr)', borderColor: tone.border }}>
          <div className="text-[10.5px] text-right pr-2 py-1" style={{ color: tone.sub }}>all-day</div>
          {days.map((d, di) => (
            <div key={di} className="border-l px-1 py-1 space-y-0.5 min-w-0" style={{ borderColor: tone.border }}>
              {events.filter((e) => e.allDay && coversDay(e, d)).map((e) => (
                <div
                  key={e.id}
                  onClick={() => onEventClick(e)}
                  className="text-[10.5px] px-1.5 py-0.5 rounded truncate cursor-pointer"
                  style={evChip(eventColor(e), dark)}
                >
                  {e.title}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto thin-scrollbar">
        <div className="grid" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
          {HOURS.map((h) => (
            <div key={h} className="contents">
              <div className="text-[10.5px] text-right pr-2 pt-1 border-t h-12" style={{ color: tone.sub, borderColor: tone.border }}>{h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}</div>
              {days.map((d, di) => {
                const evs = events.filter((e) => !e.allDay && sameDay(e.startTime, d) && e.startTime.getHours() === h);
                return (
                  <div key={di} className="border-t border-l h-12 relative" style={{ borderColor: tone.border }}>
                    {evs.map((e) => (
                      <div
                        key={e.id}
                        onClick={() => onEventClick(e)}
                        className="absolute inset-x-1 top-0.5 text-[10.5px] px-1.5 py-0.5 rounded truncate cursor-pointer"
                        style={evChip(eventColor(e), dark)}
                      >
                        {e.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DayView = ({ current, today, events, onEventClick, tone, dark }: {
  current: Date; today: Date; events: CalEvent[];
  onEventClick: (e: CalEvent) => void; tone: Tone; dark: boolean;
}) => {
  const isToday = sameDay(current, today);
  const allDayEvents = events.filter((e) => e.allDay && coversDay(e, current));
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b text-[12px] flex items-center gap-2" style={{ borderColor: tone.border }}>
        <CalIcon className="w-4 h-4" style={isToday ? { color: '#fa2d48' } : undefined} />
        <span style={isToday ? { color: '#fa2d48', fontWeight: 600 } : undefined}>
          {current.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>
      {allDayEvents.length > 0 && (
        <div className="grid border-b" style={{ gridTemplateColumns: '80px 1fr', borderColor: tone.border }}>
          <div className="text-[11px] text-right pr-3 pt-2" style={{ color: tone.sub }}>all-day</div>
          <div className="py-1 pr-3 space-y-1">
            {allDayEvents.map((e) => (
              <div
                key={e.id}
                onClick={() => onEventClick(e)}
                className="text-[12px] px-2 py-1 rounded cursor-pointer"
                style={evChip(eventColor(e), dark)}
              >
                <div className="font-medium">{e.title}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto thin-scrollbar">
        {HOURS.map((h) => {
          const evs = events.filter((e) => !e.allDay && sameDay(e.startTime, current) && e.startTime.getHours() === h);
          return (
            <div key={h} className="w-full grid border-b text-left" style={{ gridTemplateColumns: '80px 1fr', borderColor: tone.border }}>
              <div className="text-[11px] text-right pr-3 pt-2" style={{ color: tone.sub }}>{h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}</div>
              <div className="min-h-[56px] py-1 pr-3 space-y-1">
                {evs.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    className="text-[12px] px-2 py-1 rounded cursor-pointer"
                    style={evChip(eventColor(e), dark)}
                  >
                    <div className="font-medium">{e.title}</div>
                    <div className="text-[10.5px] opacity-75">
                      {e.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {e.endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ListView = ({ current, events, onEventClick, tone }: { current: Date; events: CalEvent[]; onEventClick: (e: CalEvent) => void; tone: Tone }) => {
  const monthStart = dkey(new Date(current.getFullYear(), current.getMonth(), 1));
  const nextMonthStart = dkey(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  const list = events
    .filter((e) => e.allDay
      ? dkey(e.startTime) < nextMonthStart && dkey(e.endTime) > monthStart
      : dkey(e.startTime) >= monthStart && dkey(e.startTime) < nextMonthStart)
    .sort((a, b) => +a.startTime - +b.startTime || compareEvents(a, b));
  return (
    <div className="h-full overflow-auto thin-scrollbar p-4">
      {list.length === 0 ? (
        <div className="text-center mt-10 text-[13px]" style={{ color: tone.sub }}>No events this month.</div>
      ) : (
        <div className="space-y-1.5">
          {list.map((e) => (
            <button
              key={e.id}
              onClick={() => onEventClick(e)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border text-left"
              style={{ borderColor: tone.border }}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: eventColor(e) }} />
              <div className="w-28 text-[12px]" style={{ color: tone.sub }}>
                {formatDateRange(e, false)}
              </div>
              <div className="flex-1 text-[13px] font-medium truncate">{e.title}</div>
              <div className="text-[11.5px]" style={{ color: tone.sub }}>
                {e.allDay ? 'All-day' : e.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
