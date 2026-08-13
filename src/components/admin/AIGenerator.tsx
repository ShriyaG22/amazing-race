'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import MapPicker from '@/components/MapPicker';
import WhenPicker from '@/components/WhenPicker';
import { generateAdventure, progressLabel } from '@/lib/generateAdventure';

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

// Focus phrases are noun clauses so they can be composed into one instruction.
const THEMES = [
  { key: 'foodie', label: '🍜 Foodie', focus: 'food markets, street food, restaurants, and culinary culture' },
  { key: 'history', label: '🏛️ History', focus: 'historic landmarks, monuments, and cultural heritage' },
  { key: 'art', label: '🎨 Art', focus: 'street art, galleries, murals, and creative spaces' },
  { key: 'active', label: '🏃 Active', focus: 'parks, outdoor activities, physical challenges, and sport' },
  { key: 'nightlife', label: '🌃 Nightlife', focus: 'bars, live music, rooftop views, and evening activities' },
  { key: 'hidden', label: '🔍 Hidden Gems', focus: 'lesser-known spots that locals love and tourists usually miss' },
];

/** Turns selected theme keys into a single instruction for the generator. */
function composeTheme(keys: string[]): string {
  const picked = THEMES.filter(t => keys.includes(t.key));
  if (picked.length === 0) return '';
  if (picked.length === 1) return `Focus on ${picked[0].focus}.`;
  const list = picked.map(t => t.focus).join('; ');
  return `Blend these themes across the route, giving each roughly equal weight: ${list}. Vary which theme each stop leans into rather than grouping them together.`;
}

const DIFFICULTIES = [
  { value: 'easy', label: '😊 Easy', desc: 'Short walks, obvious clues' },
  { value: 'medium', label: '💪 Medium', desc: 'Moderate, descriptive clues' },
  { value: 'hard', label: '🔥 Hard', desc: 'Long routes, local knowledge' },
  { value: 'extreme', label: '☠️ Extreme', desc: 'Obscure history, tough tasks' },
];

const DURATIONS = ['30 minutes', '1 hour', '2 hours', 'half a day (3-4 hours)', 'a full day (6-8 hours)'];
const DURATION_LABELS = ['30 min', '1 hr', '2 hrs', 'Half day', 'Full day'];

const LIVE_PROGRESS_MSGS = [
  'Looking up the city…', 'Checking what\'s still open…', 'Checking opening hours…',
  'Looking for events that week…', 'Scouting locations…', 'Planning the route…',
  'Designing challenges…', 'Writing clues…', 'Adding detours…', 'Setting pit stops…',
  'Pinning coordinates…', 'Almost there…',
];

export default function AIGenerator({ raceId, onSaved }: Props) {
  const [city, setCity] = useState('');
  const [startAddress, setStartAddress] = useState('');
  const [startLat, setStartLat] = useState<number | null>(null);
  const [startLng, setStartLng] = useState<number | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(3);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration] = useState('1 hour');
  const [teamMode, setTeamMode] = useState<'solo' | 'duo'>('duo');
  const [notes, setNotes] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [budget, setBudget] = useState<'free' | 'cheap' | 'any'>('cheap');
  const [accessibility, setAccessibility] = useState(false);
  const [localKnowledge, setLocalKnowledge] = useState<'visitor' | 'mixed' | 'local'>('mixed');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!city.trim()) return;
    // Generating replaces everything. Silently deleting a route someone spent
    // time editing is not acceptable.
    const { data: existing } = await supabase.from('legs').select('id').eq('race_id', raceId);
    if (existing?.length) {
      const ok = confirm(`This race already has ${existing.length} leg${existing.length === 1 ? '' : 's'}. Generating will delete them and any edits you've made. Continue?`);
      if (!ok) return;
    }
    setGenerating(true);
    setError('');
    setProgress(0);

    try {
      // Notes go through verbatim — duration is a server-side time budget now.
      const fullNotes = notes.trim();

      const params = {
        city: city.trim(),
        numLegs: null,
        difficulty,
        startAddress: startAddress.trim(),
        startLat,
        startLng,
        radiusKm: Math.round(radiusMiles * 1.609 * 10) / 10,
        notes: fullNotes,
        theme: composeTheme(selectedThemes),
        gameMode: 'race',
        teamMode,
        duration: duration || '1 hour',
        eventDate,
        startTime,
        budget,
        accessibility,
        localKnowledge,
      };

      const validClueTypes = ['text', 'sliding', 'wordsearch', 'cipher', 'unscramble', 'emoji'];

      // Clear existing legs for this race before the first leg arrives.
      const { data: existingLegs } = await supabase.from('legs').select('id').eq('race_id', raceId);
      if (existingLegs?.length) {
        const legIds = existingLegs.map(l => l.id);
        await supabase.from('checkpoints').delete().in('leg_id', legIds);
        await supabase.from('legs').delete().eq('race_id', raceId);
      }

      // One request per leg, saved as each one lands. Progress is real.
      const result = await generateAdventure(
        params,
        (p) => {
          setProgressMsg(progressLabel(p));
          const per = 100 / p.totalLegs;
          const base = p.legIndex * per;
          setProgress(Math.min(97, Math.round(base + (p.phase === 'saving' ? per * 0.9 : per * 0.35))));
        },
        async (gl, i) => {
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
      );

      if (result.geo.outOfRange || result.geo.missing) {
        console.warn('Generation location issues:', result.geo);
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
      const msg = err?.name === 'AbortError'
        ? 'Generation took too long and was stopped. Try a shorter duration, or generate again.'
        : (err.message || 'Something went wrong');
      setError(msg);
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

      {/* Theme — pick as many as you like */}
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">
        Theme <span className="text-text-muted font-normal">— pick any combination</span>
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        <button onClick={() => setSelectedThemes([])}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-all ${
            selectedThemes.length === 0 ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-transparent text-text-dim hover:border-text-muted'}`}>
          🌍 Surprise me
        </button>
        {THEMES.map(t => {
          const on = selectedThemes.includes(t.key);
          return (
            <button key={t.key}
              onClick={() => setSelectedThemes(prev => on ? prev.filter(k => k !== t.key) : [...prev, t.key])}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-all ${
                on ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-transparent text-text-dim hover:border-text-muted'}`}>
              {on ? '✓ ' : ''}{t.label}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-text-muted mb-4">
        {selectedThemes.length === 0
          ? 'No theme picked — the route will cover a bit of everything.'
          : selectedThemes.length === 1
            ? 'Every stop will lean into this theme.'
            : `Blending ${selectedThemes.length} themes across the route.`}
      </p>

      {/* Duration */}
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">How long?</label>
      <div className="grid grid-cols-5 gap-1.5 mb-4">
        {DURATIONS.map((d, i) => (
          <button key={d} onClick={() => setDuration(d)}
            className={`py-2.5 px-1 rounded-xl text-center border cursor-pointer transition-all ${
              duration === d ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-text-muted'}`}>
            <div className={`text-xs font-bold ${duration === d ? 'text-accent' : 'text-text-dim'}`}>{DURATION_LABELS[i]}</div>
          </button>
        ))}
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

      {/* When it's being played */}
      <WhenPicker
        date={eventDate}
        time={startTime}
        onDateChange={setEventDate}
        onTimeChange={setStartTime}
        hint="affects opening hours, daylight and season"
      />

      {/* Money */}
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Spending</label>
      <div className="flex gap-2 mb-4">
        {([
          { v: 'free', l: 'Free only', d: 'No purchases' },
          { v: 'cheap', l: 'Cheap', d: 'Under $10pp' },
          { v: 'any', l: 'Anything', d: 'Meals, tickets' },
        ] as const).map(b => (
          <button key={b.v} onClick={() => setBudget(b.v)}
            className={`flex-1 py-2.5 rounded-xl text-center border cursor-pointer transition-all ${
              budget === b.v ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
            <div className={`text-xs font-bold ${budget === b.v ? 'text-accent' : 'text-text-dim'}`}>{b.l}</div>
            <div className="text-[9px] text-text-muted mt-0.5">{b.d}</div>
          </button>
        ))}
      </div>

      {/* Local knowledge */}
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">
        Who's playing <span className="text-text-muted font-normal">— how much city knowledge to assume</span>
      </label>
      <div className="flex gap-2 mb-4">
        {([
          { v: 'visitor', l: 'Visitors', d: 'New to the city' },
          { v: 'mixed', l: 'Mixed', d: 'Some know it' },
          { v: 'local', l: 'Locals', d: 'Know it well' },
        ] as const).map(k => (
          <button key={k.v} onClick={() => setLocalKnowledge(k.v)}
            className={`flex-1 py-2.5 rounded-xl text-center border cursor-pointer transition-all ${
              localKnowledge === k.v ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
            <div className={`text-xs font-bold ${localKnowledge === k.v ? 'text-accent' : 'text-text-dim'}`}>{k.l}</div>
            <div className="text-[9px] text-text-muted mt-0.5">{k.d}</div>
          </button>
        ))}
      </div>

      {/* Accessibility */}
      <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-3 mb-4">
        <div className="flex-1 pr-3">
          <p className="text-sm font-semibold">Step-free route</p>
          <p className="text-[10px] text-text-dim leading-relaxed">
            Avoids stairs, steep hills and uneven ground. Keeps walks short.
          </p>
        </div>
        <button onClick={() => setAccessibility(v => !v)}
          className={`relative w-11 h-6 rounded-full transition-all cursor-pointer shrink-0 ${accessibility ? 'bg-success' : 'bg-border'}`}>
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${accessibility ? 'left-[21px]' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Notes */}
      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">
        Notes for AI <span className="text-text-muted font-normal">(optional)</span>
      </label>
      <textarea className="input-field resize-none min-h-[72px]" rows={3}
        placeholder="Anything specific: a place you want included, somewhere to avoid, an occasion, dietary needs, who's playing, a vibe you're after..."
        value={notes} onChange={e => setNotes(e.target.value)} />
      <p className="text-[10px] text-text-muted mt-1 mb-4">Whatever you write here takes priority over everything above</p>

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
