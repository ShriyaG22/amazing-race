'use client';

import { useState } from 'react';

interface WhenPickerProps {
  date: string;                    // YYYY-MM-DD
  time: string;                    // HH:MM
  onDateChange: (d: string) => void;
  onTimeChange: (t: string) => void;
  /** Copy under the control. */
  hint?: string;
}

const toISO = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().split('T')[0];
};

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Next Saturday, or today if today is Saturday. */
const nextWeekend = () => {
  const d = new Date();
  const delta = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return toISO(d);
};

const TIME_SLOTS = [
  { value: '08:00', label: 'Early', sub: '8am' },
  { value: '10:00', label: 'Morning', sub: '10am' },
  { value: '13:00', label: 'Midday', sub: '1pm' },
  { value: '16:00', label: 'Afternoon', sub: '4pm' },
  { value: '19:00', label: 'Evening', sub: '7pm' },
];

function prettyDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function prettyTime(t: string) {
  if (!/^\d{2}:\d{2}$/.test(t)) return t;
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, '0')}${suffix}`;
}

export default function WhenPicker({ date, time, onDateChange, onTimeChange, hint }: WhenPickerProps) {
  const today = toISO(new Date());
  const tomorrow = addDays(1);
  const weekend = nextWeekend();

  const presets = [
    { value: today, label: 'Today' },
    { value: tomorrow, label: 'Tomorrow' },
    ...(weekend !== today && weekend !== tomorrow ? [{ value: weekend, label: 'Saturday' }] : []),
  ];

  const isPreset = presets.some((p) => p.value === date);
  const [customDate, setCustomDate] = useState(!isPreset);
  const isCustomTime = !TIME_SLOTS.some((s) => s.value === time);
  const [customTime, setCustomTime] = useState(isCustomTime);

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-all ${
      active
        ? 'border-accent bg-accent/10 text-accent'
        : 'border-border bg-transparent text-text-dim hover:border-text-muted'
    }`;

  return (
    <div className="mb-4">
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">
        When {hint && <span className="text-text-muted font-normal normal-case tracking-normal">— {hint}</span>}
      </label>

      {/* Day */}
      <div className="flex flex-wrap gap-2 mb-2">
        {presets.map((p) => (
          <button key={p.value}
            onClick={() => { onDateChange(p.value); setCustomDate(false); }}
            className={chip(!customDate && date === p.value)}>
            {p.label}
          </button>
        ))}
        <button onClick={() => setCustomDate(true)} className={chip(customDate)}>
          {customDate && !presets.some((p) => p.value === date) ? prettyDate(date) : 'Pick a date'}
        </button>
      </div>

      {customDate && (
        <input
          type="date"
          className="input-field !mb-2 animate-fade-in"
          value={date}
          min={today}
          onChange={(e) => onDateChange(e.target.value)}
        />
      )}

      {/* Time */}
      <div className="flex flex-wrap gap-2 mb-2">
        {TIME_SLOTS.map((s) => (
          <button key={s.value}
            onClick={() => { onTimeChange(s.value); setCustomTime(false); }}
            className={chip(!customTime && time === s.value)}>
            {s.label} <span className="text-text-muted font-normal">{s.sub}</span>
          </button>
        ))}
        <button onClick={() => setCustomTime(true)} className={chip(customTime)}>
          {customTime ? prettyTime(time) : 'Other'}
        </button>
      </div>

      {customTime && (
        <input
          type="time"
          className="input-field !mb-2 animate-fade-in"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
        />
      )}

      <p className="text-[10px] text-text-muted">
        Starting {prettyDate(date)} at {prettyTime(time)}
      </p>
    </div>
  );
}
