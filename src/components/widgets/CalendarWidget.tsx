import { useEffect, useMemo, useState } from "react";
import { useMacOS } from "@/contexts/MacOSContext";
import { getNewYorkClock } from "@/lib/newYorkTime";

const MONTH_NAMES = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

export const CalendarWidget = () => {
  const { openApp } = useMacOS();
  const [today, setToday] = useState(() => getNewYorkClock());

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = getNewYorkClock();
      setToday(prev => (prev.year === next.year && prev.month === next.month && prev.day === next.day ? prev : next));
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  const todayDate = today.day;
  const todayMonth = today.month;
  const todayYear = today.year;

  const monthName = MONTH_NAMES[todayMonth];
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

  const calendarDays = useMemo(() => {
    // UTC arithmetic keeps the month grid independent of the browser timezone.
    const firstDay = new Date(Date.UTC(todayYear, todayMonth, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(todayYear, todayMonth + 1, 0)).getUTCDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [todayYear, todayMonth]);

  return (
    <button
      onClick={() => openApp('calendar')}
      className="rounded-3xl p-3 select-none shadow-xl text-left hover:brightness-110 transition"
      style={{
        width: 172,
        height: 172,
        background: '#18181A',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="text-[11.75px] font-semibold tracking-wider mb-1 pl-1.5" style={{ color: '#FF453A' }}>
        {monthName}
      </div>

      <div className="grid grid-cols-7 gap-0 mb-1">
        {weekdays.map((d, i) => (
          <div key={i} className="text-center text-[10.25px] font-medium text-white/55">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {calendarDays.map((day, i) => (
          <div key={i} className="flex items-center justify-center h-4">
  {day !== null && (
    <div
      className="w-4 h-4 shrink-0 flex items-center justify-center rounded-full text-[10.25px] font-medium leading-none"
      style={
        day === todayDate
          ? { background: '#F14237', color: 'white' }
          : { color: 'rgba(255,255,255,0.92)' }
      }
    >
      {day}
    </div>
  )}
</div>
        ))}
      </div>
    </button>
  );
};
