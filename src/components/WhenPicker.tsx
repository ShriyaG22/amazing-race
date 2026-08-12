'use client';

import { useEffect, useRef, useState } from 'react';

interface WhenPickerProps {
  date: string;                    // YYYY-MM-DD
  time: string;                    // HH:MM
  onDateChange: (d: string) => void;
  onTimeChange: (t: string) => void;
  hint?: string;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const toISO = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().split('T')[0];
};

const parseISO = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d.getTime()) ? new Date() : d;
};

function prettyDate(iso: string) {
  const d = parseISO(iso);
  const today = toISO(new Date());
  const tomorrow = toISO(new Date(Date.now() + 86400000));
  if (iso === today) return 'Today';
  if (iso === tomorrow) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function prettyTime(t: string) {
  if (!/^\d{1,2}:\d{2}$/.test(t)) return t;
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}:00 ${suffix}` : `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Every half hour from 6am to 11pm. */
const TIME_OPTIONS = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 23; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`);
    if (h !== 23) out.push(`${String(h).padStart(2, '0')}:30`);
  }
  return out;
})();

function timeOfDay(t: string) {
  const h = parseInt(t.split(':')[0], 10);
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 21) return 'Evening';
  return 'Night';
}

export default function WhenPicker({ date, time, onDateChange, onTimeChange, hint }: WhenPickerProps) {
  const [openCal, setOpenCal] = useState(false);
  const [openTime, setOpenTime] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseISO(date);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const wrapRef = useRef<HTMLDivElement>(null);
  const timeListRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!openCal && !openTime) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenCal(false); setOpenTime(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openCal, openTime]);

  // Scroll the dropdown to the current selection when it opens
  useEffect(() => {
    if (!openTime || !timeListRef.current) return;
    const el = timeListRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
    if (el) timeListRef.current.scrollTop = el.offsetTop - 80;
  }, [openTime]);

  const todayISO = toISO(new Date());
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISO(new Date(year, month, i + 1))),
  ];

  // Don't let people page back before this month
  const atCurrentMonth =
    year === new Date().getFullYear() && month === new Date().getMonth();

  const shiftMonth = (delta: number) =>
    setViewMonth(new Date(year, month + delta, 1));

  return (
    <div className="mb-4" ref={wrapRef}>
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">
        When {hint && <span className="text-text-muted font-normal normal-case tracking-normal">— {hint}</span>}
      </label>

      <div className="flex gap-2">
        {/* ── Date ── */}
        <div className="relative flex-1">
          <button
            onClick={() => { setOpenCal(v => !v); setOpenTime(false); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border bg-surface text-left cursor-pointer transition-all ${
              openCal ? 'border-accent' : 'border-border hover:border-text-muted'}`}>
            <span className="text-[15px] text-text-primary font-semibold">{prettyDate(date)}</span>
            <span className="text-text-muted text-sm">📅</span>
          </button>

          {openCal && (
            <div className="absolute z-50 mt-2 left-0 right-0 min-w-[280px] rounded-2xl border border-border bg-card shadow-2xl p-3 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => shiftMonth(-1)}
                  disabled={atCurrentMonth}
                  className={`w-8 h-8 rounded-lg border border-border bg-surface text-sm cursor-pointer ${
                    atCurrentMonth ? 'opacity-30 cursor-not-allowed' : 'hover:border-text-muted'}`}>
                  ‹
                </button>
                <p className="text-sm font-bold text-text-primary">{MONTHS[month]} {year}</p>
                <button
                  onClick={() => shiftMonth(1)}
                  className="w-8 h-8 rounded-lg border border-border bg-surface text-sm cursor-pointer hover:border-text-muted">
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((d, i) => (
                  <div key={i} className="text-center text-[10px] text-text-muted font-bold py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {cells.map((iso, i) => {
                  if (!iso) return <div key={`b${i}`} />;
                  const isPast = iso < todayISO;
                  const isSelected = iso === date;
                  const isToday = iso === todayISO;
                  return (
                    <button
                      key={iso}
                      disabled={isPast}
                      onClick={() => { onDateChange(iso); setOpenCal(false); }}
                      className={`aspect-square rounded-lg text-xs font-semibold transition-all ${
                        isPast
                          ? 'text-text-muted/30 cursor-not-allowed'
                          : isSelected
                            ? 'bg-accent text-bg cursor-pointer'
                            : isToday
                              ? 'border border-accent/40 text-accent cursor-pointer hover:bg-accent/10'
                              : 'text-text-dim cursor-pointer hover:bg-surface'}`}>
                      {parseInt(iso.split('-')[2], 10)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Time ── */}
        <div className="relative w-[46%]">
          <button
            onClick={() => { setOpenTime(v => !v); setOpenCal(false); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border bg-surface text-left cursor-pointer transition-all ${
              openTime ? 'border-accent' : 'border-border hover:border-text-muted'}`}>
            <span className="text-[15px] text-text-primary font-semibold">{prettyTime(time)}</span>
            <span className="text-text-muted text-xs">▾</span>
          </button>

          {openTime && (
            <div
              ref={timeListRef}
              className="absolute z-50 mt-2 left-0 right-0 max-h-[240px] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl py-1 animate-fade-in">
              {TIME_OPTIONS.map(t => {
                const selected = t === time;
                return (
                  <button
                    key={t}
                    data-selected={selected}
                    onClick={() => { onTimeChange(t); setOpenTime(false); }}
                    className={`w-full flex items-center justify-between px-4 py-2 text-left text-sm cursor-pointer transition-colors ${
                      selected ? 'bg-accent/15 text-accent font-bold' : 'text-text-dim hover:bg-surface'}`}>
                    <span>{prettyTime(t)}</span>
                    <span className="text-[10px] text-text-muted">{timeOfDay(t)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
