'use client';

import { useState } from 'react';

type Props = {
  city: string;
  onGenerated: (legs: GeneratedLeg[]) => void;
  onCityChange: (city: string) => void;
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

const PROGRESS_MSGS = [
  'Scouting locations…',
  'Designing challenges…',
  'Writing clues…',
  'Placing roadblocks…',
  'Adding minigames…',
  'Pinning coordinates…',
  'Finalizing legs…',
];

export default function AIGenerator({ city, onGenerated, onCityChange }: Props) {
  const [numLegs, setNumLegs] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!city.trim()) return;
    setGenerating(true);
    setError('');
    setProgress(0);

    let step = 0;
    const iv = setInterval(() => {
      step++;
      setProgress(Math.min(step * 12, 90));
      setProgressMsg(PROGRESS_MSGS[Math.min(step - 1, PROGRESS_MSGS.length - 1)]);
    }, 600);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: city.trim(), numLegs }),
      });
      const data = await res.json();

      clearInterval(iv);
      setProgress(100);
      setProgressMsg('Done!');

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Generation failed');
      }
      if (!data.legs?.length) {
        throw new Error('No legs were generated');
      }

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
      <div className="mb-4">
        <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">
          City / Location
        </label>
        <input
          className="input-field !mb-0"
          placeholder="e.g. Bangkok, Thailand"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.city}
            onClick={() => onCityChange(p.city)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide border cursor-pointer transition-all ${
              city === p.city
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-transparent text-text-dim hover:border-text-muted'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mb-5">
        <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">
          Number of Legs
        </label>
        <div className="flex gap-2">
          {[3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              onClick={() => setNumLegs(n)}
              className={`w-10 h-10 rounded-lg text-sm font-bold border cursor-pointer transition-all ${
                numLegs === n
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-surface text-text-dim hover:border-text-muted'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating || !city.trim()}
        className="btn-ai flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating…
          </>
        ) : (
          <>✦ Generate with AI</>
        )}
      </button>

      {generating && (
        <div className="mt-4 animate-fade-in">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-text-dim animate-pulse">{progressMsg}</span>
            <span className="text-xs text-text-muted font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple to-accent transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm animate-fade-in">
          {error}
        </div>
      )}
    </div>
  );
}
