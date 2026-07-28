'use client';

import { useState } from 'react';

type Props = {
  city: string;
  difficulty: string;
  startAddress: string;
  radiusKm: number;
  onGenerated: (legs: GeneratedLeg[]) => void;
  onCityChange: (city: string) => void;
  onDifficultyChange: (d: string) => void;
  onStartAddressChange: (a: string) => void;
  onRadiusChange: (r: number) => void;
};

export type GeneratedCheckpoint = {
  name: string;
  type: 'challenge' | 'roadblock' | 'minigame';
  description: string;
  clueText: string;
  requiresApproval: boolean;
  answer?: string;
  miniGameType?: string;
  lat?: number;
  lng?: number;
};

export type GeneratedLeg = {
  name: string;
  checkpoints: GeneratedCheckpoint[];
};

const PRESETS = [
  { label: '🗽 NYC', city: 'New York City' },
  { label: '🗼 Paris', city: 'Paris' },
  { label: '🏯 Tokyo', city: 'Tokyo' },
  { label: '🌉 SF', city: 'San Francisco' },
  { label: '🏖️ Barcelona', city: 'Barcelona' },
  { label: '🎭 London', city: 'London' },
];

const DIFFICULTIES = [
  { value: 'easy', label: '😊 Easy', desc: 'Short walks, simple tasks' },
  { value: 'medium', label: '💪 Medium', desc: 'Moderate challenges' },
  { value: 'hard', label: '🔥 Hard', desc: 'Long routes, tough puzzles' },
  { value: 'extreme', label: '☠️ Extreme', desc: 'Maximum difficulty' },
];

const THEMES = [
  { label: '🌍 Any', value: '' },
  { label: '🍜 Foodie', value: 'Focus on food markets, street food, restaurants, and culinary culture.' },
  { label: '🏛️ History', value: 'Focus on historic landmarks, museums, monuments, and cultural heritage.' },
  { label: '🎨 Art', value: 'Focus on street art, galleries, murals, and creative spaces.' },
  { label: '🏃 Active', value: 'Focus on parks, outdoor activities, physical challenges, and sport.' },
  { label: '🌃 Nightlife', value: 'Focus on bars, live music, rooftop views, and evening activities.' },
];

const PROGRESS_MSGS = [
  'Scouting locations…',
  'Planning the route…',
  'Designing challenges…',
  'Writing clues…',
  'Placing roadblocks…',
  'Adding minigames…',
  'Pinning coordinates…',
  'Finalizing legs…',
];

export default function AIGenerator({
  city, difficulty, startAddress, radiusKm,
  onGenerated, onCityChange, onDifficultyChange, onStartAddressChange, onRadiusChange,
}: Props) {
  const [numLegs, setNumLegs] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('');
  const [notes, setNotes] = useState('');

  const handleGenerate = async () => {
    if (!city.trim()) return;
    setGenerating(true);
    setError('');
    setProgress(0);

    let step = 0;
    const iv = setInterval(() => {
      step++;
      setProgress(Math.min(step * 10, 90));
      setProgressMsg(PROGRESS_MSGS[Math.min(step - 1, PROGRESS_MSGS.length - 1)]);
    }, 500);

    try {
      // Combine theme and notes
      const fullNotes = [theme, notes].filter(Boolean).join('\n');

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: city.trim(),
          numLegs,
          difficulty,
          startAddress: startAddress.trim(),
          radiusKm: Math.round(radiusKm * 1.609 * 10) / 10,
          notes: fullNotes,
        }),
      });
      const data = await res.json();

      clearInterval(iv);
      setProgress(100);
      setProgressMsg('Done!');

      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed');
      if (!data.legs?.length) throw new Error('No legs were generated');

      setTimeout(() => {
        onGenerated(data.legs);
        setGenerating(false);
        setProgress(0);
      }, 400);
    } catch (err: any) {
      clearInterval(iv);
      setError(err.message || 'Something went wrong');
      setGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* City */}
      <div className="mb-4">
        <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">City / Location</label>
        <input className="input-field !mb-0" placeholder="e.g. New York City" value={city} onChange={e => onCityChange(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map(p => (
          <button key={p.city} onClick={() => onCityChange(p.city)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide border cursor-pointer transition-all ${
              city === p.city ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-transparent text-text-dim hover:border-text-muted'
            }`}>{p.label}</button>
        ))}
      </div>

      {/* Starting Point */}
      <div className="mb-4">
        <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Starting Point <span className="text-text-muted font-normal">(optional)</span></label>
        <input className="input-field !mb-0" placeholder="e.g. Times Square, Grand Central..."
          value={startAddress} onChange={e => onStartAddressChange(e.target.value)} />
        <p className="text-[10px] text-text-muted mt-1">Adventure flows outward from here</p>
      </div>

      {/* Radius Slider */}
      <div className="mb-4">
        <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Race Radius</label>
        <div className="flex items-center gap-3">
          <input type="range" min="0.5" max="15" step="0.5" value={radiusKm}
            onChange={e => onRadiusChange(parseFloat(e.target.value))}
            className="flex-1 h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent" />
          <div className="text-right shrink-0 min-w-[70px]">
            <span className="text-lg font-bold text-accent">{radiusKm.toFixed(1)}</span>
            <span className="text-xs text-text-dim ml-1">mi</span>
          </div>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-text-muted">0.5 mi · Walking</span>
          <span className="text-[9px] text-text-muted">15 mi · Metro area</span>
        </div>
      </div>

      {/* Theme */}
      <div className="mb-4">
        <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Theme <span className="text-text-muted font-normal">(optional)</span></label>
        <div className="flex flex-wrap gap-2">
          {THEMES.map(t => (
            <button key={t.label} onClick={() => setTheme(t.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-all ${
                theme === t.value ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-transparent text-text-dim hover:border-text-muted'
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div className="mb-4">
        <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Difficulty</label>
        <div className="grid grid-cols-2 gap-2">
          {DIFFICULTIES.map(d => (
            <button key={d.value} onClick={() => onDifficultyChange(d.value)}
              className={`px-3 py-2.5 rounded-lg text-left border cursor-pointer transition-all ${
                difficulty === d.value ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-text-muted'
              }`}>
              <div className={`text-sm font-bold ${difficulty === d.value ? 'text-accent' : 'text-text-dim'}`}>{d.label}</div>
              <div className="text-[10px] text-text-muted mt-0.5">{d.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Number of Legs */}
      <div className="mb-4">
        <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Number of Legs</label>
        <div className="flex gap-2">
          {[3, 4, 5, 6, 7].map(n => (
            <button key={n} onClick={() => setNumLegs(n)}
              className={`w-10 h-10 rounded-lg text-sm font-bold border cursor-pointer transition-all ${
                numLegs === n ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-text-dim hover:border-text-muted'
              }`}>{n}</button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-5">
        <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">
          Notes for AI <span className="text-text-muted font-normal">(optional)</span>
        </label>
        <textarea className="input-field !mb-0 resize-none min-h-[72px]" rows={3}
          placeholder="e.g. No museums, focus on outdoor spots, include at least one food challenge, avoid touristy areas..."
          value={notes} onChange={e => setNotes(e.target.value)} />
        <p className="text-[10px] text-text-muted mt-1">Any preferences the AI should consider when building your route</p>
      </div>

      {/* Generate */}
      <button onClick={handleGenerate} disabled={generating || !city.trim()}
        className="btn-ai flex items-center justify-center gap-2">
        {generating ? (
          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</>
        ) : <>✦ Generate with AI</>}
      </button>

      {generating && (
        <div className="mt-4 animate-fade-in">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-text-dim animate-pulse">{progressMsg}</span>
            <span className="text-xs text-text-muted font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-purple to-accent transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm animate-fade-in">{error}</div>
      )}
    </div>
  );
}
