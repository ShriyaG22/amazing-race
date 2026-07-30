'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import MapPicker from '@/components/MapPicker';

type Props = {
  raceId: string;
  onSaved: () => void; // triggers refresh in AdminView
};

const PRESETS = [
  { label: '🗽 NYC', city: 'New York City' },
  { label: '🗼 Paris', city: 'Paris' },
  { label: '🏯 Tokyo', city: 'Tokyo' },
  { label: '🌉 SF', city: 'San Francisco' },
  { label: '🏖️ Barcelona', city: 'Barcelona' },
  { label: '🎭 London', city: 'London' },
];

const THEMES = [
  { label: '🌍 Any', value: '' },
  { label: '🍜 Foodie', value: 'Focus on food markets, street food, restaurants, and culinary culture.' },
  { label: '🏛️ History', value: 'Focus on historic landmarks, monuments, and cultural heritage.' },
  { label: '🎨 Art', value: 'Focus on street art, galleries, murals, and creative spaces.' },
  { label: '🏃 Active', value: 'Focus on parks, outdoor activities, physical challenges, and sport.' },
  { label: '🌃 Nightlife', value: 'Focus on bars, live music, rooftop views, and evening activities.' },
];

const DIFFICULTIES = [
  { value: 'easy', label: '😊 Easy', desc: 'Short walks, obvious clues' },
  { value: 'medium', label: '💪 Medium', desc: 'Moderate, descriptive clues' },
  { value: 'hard', label: '🔥 Hard', desc: 'Long routes, local knowledge' },
  { value: 'extreme', label: '☠️ Extreme', desc: 'Obscure history, tough tasks' },
];

const DURATIONS = ['30 minutes', '1 hour', '2 hours', 'half a day (3-4 hours)', 'a full day (6-8 hours)'];
const DURATION_LABELS = ['30 min', '1 hr', '2 hrs', 'Half day', 'Full day'];

const PROGRESS_MSGS = [
  'Scouting locations…', 'Planning the route…', 'Designing challenges…', 'Writing clues…',
  'Adding detours…', 'Placing roadblocks…', 'Setting pit stops…', 'Pinning coordinates…',
];

export default function AIGenerator({ raceId, onSaved }: Props) {
  const [city, setCity] = useState('');
  const [startAddress, setStartAddress] = useState('');
  const [startLat, setStartLat] = useState<number | null>(null);
  const [startLng, setStartLng] = useState<number | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(3);
  const [theme, setTheme] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration] = useState('1 hour');
  const [teamMode, setTeamMode] = useState<'solo' | 'duo'>('duo');
  const [notes, setNotes] = useState('');
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
      setProgress(Math.min(step * 10, 90));
      setProgressMsg(PROGRESS_MSGS[Math.min(step - 1, PROGRESS_MSGS.length - 1)]);
    }, 500);

    try {
      const durationNote = duration ? `The entire experience should be completable in approximately ${duration}.` : '';
      const fullNotes = [durationNote, notes].filter(Boolean).join('\n');

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: city.trim(),
          numLegs: null,
          difficulty,
          startAddress: startAddress.trim(),
          startLat,
          startLng,
          radiusKm: Math.round(radiusMiles * 1.609 * 10) / 10,
          notes: fullNotes,
          theme,
          gameMode: 'race',
          teamMode,
          duration: duration || '1 hour',
        }),
      });
      const data = await res.json();

      clearInterval(iv);
      setProgress(95);
      setProgressMsg('Saving to database…');

      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed');
      if (!data.legs?.length) throw new Error('No legs were generated');

      // Save directly to Supabase with ALL fields
      const validClueTypes = ['text', 'sliding', 'wordsearch', 'cipher', 'unscramble', 'emoji'];

      // Clear existing legs for this race first
      const { data: existingLegs } = await supabase.from('legs').select('id').eq('race_id', raceId);
      if (existingLegs?.length) {
        const legIds = existingLegs.map(l => l.id);
        await supabase.from('checkpoints').delete().in('leg_id', legIds);
        await supabase.from('legs').delete().eq('race_id', raceId);
      }

      for (let i = 0; i < data.legs.length; i++) {
        const gl = data.legs[i];
        const { data: legData } = await supabase.from('legs').insert({
          race_id: raceId, name: gl.name, order_num: i,
        }).select().single();

        if (legData && gl.checkpoints?.length) {
          await supabase.from('checkpoints').insert(gl.checkpoints.map((cp: any, j: number) => ({
            leg_id: legData.id,
            name: cp.name || `Checkpoint ${j + 1}`,
            type: cp.type || 'challenge',
            description: cp.description || '',
            clue_text: cp.clueText || '',
            clue_type: cp.clueType && validClueTypes.includes(cp.clueType) ? cp.clueType : 'text',
            location_answer: cp.locationAnswer || cp.name || '',
            fun_fact: cp.funFact || '',
            roadblock_hint: cp.roadblockHint || '',
            detour_option_a_title: cp.detourOptionATitle || '',
            detour_option_a_desc: cp.detourOptionADesc || '',
            detour_option_b_title: cp.detourOptionBTitle || '',
            detour_option_b_desc: cp.detourOptionBDesc || '',
            emoji_clue: cp.emojiClue || '',
            requires_approval: false,
            order_num: j,
            answer: cp.answer || '',
            mini_game_type: cp.clueType && cp.clueType !== 'text' ? cp.clueType : '',
            lat: cp.lat || null,
            lng: cp.lng || null,
          })));
        }
      }

      // Update race city
      await supabase.from('races').update({ city: city.trim() }).eq('id', raceId);

      setProgress(100);
      setProgressMsg('Done!');
      setTimeout(() => {
        onSaved();
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

  const canGenerate = city.trim().length > 0;

  return (
    <div className="animate-fade-in">
      {/* City */}
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">City</label>
      <input className="input-field" placeholder="e.g. New York City, Tokyo, Paris..." value={city} onChange={e => setCity(e.target.value)} />
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map(p => (
          <button key={p.city} onClick={() => setCity(p.city)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide border cursor-pointer transition-all ${
              city === p.city ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-transparent text-text-dim hover:border-text-muted'}`}>{p.label}</button>
        ))}
      </div>

      {/* Map + Starting Point */}
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Starting Point & Area</label>
      {city ? (
        <MapPicker lat={startLat} lng={startLng} radiusMiles={radiusMiles} city={city}
          onLocationChange={(lat, lng, addr) => { setStartLat(lat); setStartLng(lng); setStartAddress(addr); }}
          onRadiusChange={setRadiusMiles} />
      ) : (
        <div className="w-full h-[120px] rounded-xl border border-dashed border-border flex items-center justify-center mb-4">
          <p className="text-xs text-text-muted">Enter a city above to see the map</p>
        </div>
      )}

      {/* Theme */}
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Theme</label>
      <div className="flex flex-wrap gap-2 mb-4">
        {THEMES.map(t => (
          <button key={t.label} onClick={() => setTheme(t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-all ${
              theme === t.value ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-transparent text-text-dim hover:border-text-muted'}`}>{t.label}</button>
        ))}
      </div>

      {/* Duration — slider */}
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Duration</label>
      <div className="mb-4">
        <input type="range" min="0" max="4" step="1" value={DURATIONS.indexOf(duration)}
          onChange={e => setDuration(DURATIONS[parseInt(e.target.value)])}
          className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer" />
        <div className="flex justify-between mt-2">
          {DURATION_LABELS.map((l, i) => (
            <span key={l} className={`text-[9px] ${DURATIONS[i] === duration ? 'text-accent font-bold' : 'text-text-muted'}`}>{l}</span>
          ))}
        </div>
      </div>

      {/* Team Mode — affects roadblocks */}
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">
        Player Setup <span className="text-text-muted font-normal">— affects challenge types</span>
      </label>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTeamMode('solo')}
          className={`flex-1 py-3 rounded-xl text-center border cursor-pointer transition-all ${
            teamMode === 'solo' ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
          <div className="text-xl mb-0.5">🏃</div>
          <div className={`text-xs font-bold ${teamMode === 'solo' ? 'text-accent' : 'text-text-dim'}`}>Solo Players</div>
          <div className="text-[9px] text-text-muted mt-0.5">No roadblocks</div>
        </button>
        <button onClick={() => setTeamMode('duo')}
          className={`flex-1 py-3 rounded-xl text-center border cursor-pointer transition-all ${
            teamMode === 'duo' ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
          <div className="text-xl mb-0.5">👥</div>
          <div className={`text-xs font-bold ${teamMode === 'duo' ? 'text-accent' : 'text-text-dim'}`}>Duo / Teams</div>
          <div className="text-[9px] text-text-muted mt-0.5">Includes roadblocks</div>
        </button>
      </div>

      {/* Difficulty */}
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Difficulty</label>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {DIFFICULTIES.map(d => (
          <button key={d.value} onClick={() => setDifficulty(d.value)}
            className={`px-3 py-2.5 rounded-lg text-left border cursor-pointer transition-all ${
              difficulty === d.value ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-text-muted'}`}>
            <div className={`text-sm font-bold ${difficulty === d.value ? 'text-accent' : 'text-text-dim'}`}>{d.label}</div>
            <div className="text-[10px] text-text-muted mt-0.5">{d.desc}</div>
          </button>
        ))}
      </div>

      {/* Notes */}
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">
        Notes for AI <span className="text-text-muted font-normal">(optional)</span>
      </label>
      <textarea className="input-field resize-none min-h-[72px]" rows={3}
        placeholder="e.g. No museums, focus on outdoor spots, include at least one food challenge, avoid touristy areas..."
        value={notes} onChange={e => setNotes(e.target.value)} />
      <p className="text-[10px] text-text-muted mt-1 mb-4">Any preferences the AI should consider</p>

      {/* Generate Button */}
      <button onClick={handleGenerate} disabled={generating || !canGenerate}
        className="btn-ai flex items-center justify-center gap-2">
        {generating ? (
          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</>
        ) : '✦ Generate with AI'}
      </button>

      {!canGenerate && <p className="text-text-muted text-xs text-center mt-2">Enter a city to get started</p>}

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
