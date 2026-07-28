'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { generateCode, randomMiniGame } from '@/lib/utils';
import AdminView from '@/components/admin/AdminView';
import PlayerView from '@/components/player/PlayerView';

type Session = {
  raceId: string;
  role: 'admin' | 'player' | 'explorer';
  teamId?: string;
};

// ── Sticky Nav ──────────────────────────────────────────────
function StickyNav({ activeSection }: { activeSection: string }) {
  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'how', label: 'How It Works' },
    { id: 'features', label: 'Features' },
    { id: 'about', label: 'About' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
        <a href="#home" className="font-display text-xl text-accent tracking-wider hover:opacity-80 transition-opacity">WANDR</a>
        <div className="flex gap-1">
          {tabs.slice(1).map(t => (
            <a key={t.id} href={`#${t.id}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeSection === t.id
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-dim hover:text-text-muted'
              }`}>
              {t.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

// ── How It Works ────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { icon: '🗺️', title: 'Choose your adventure', desc: 'Let AI design a route from real landmarks, or build your own custom challenges from scratch.' },
    { icon: '🧩', title: 'Solve & explore', desc: 'Navigate to checkpoints, crack puzzles, complete challenges — each one unique to your city.' },
    { icon: '📸', title: 'Prove it', desc: 'Snap photo proof at each stop. Your host reviews live, or auto-advance if they\'re playing too.' },
    { icon: '🏆', title: 'Win or wander', desc: 'Race against teams on the leaderboard, or explore solo at your own pace. Your call.' },
  ];

  return (
    <section id="how" className="py-16 md:py-20 px-4 scroll-mt-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-[11px] text-purple tracking-[4px] uppercase font-bold text-center mb-2">How it works</p>
        <h2 className="font-display text-2xl md:text-3xl text-white text-center tracking-wider mb-10">
          ADVENTURE IN 4 STEPS
        </h2>
        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-4 items-start bg-card/40 border border-border/60 rounded-2xl p-5 hover:border-accent/25 transition-all group">
              <div className="text-3xl shrink-0 group-hover:scale-110 transition-transform">{s.icon}</div>
              <div>
                <h3 className="font-bold text-[15px] text-text-primary mb-1">{s.title}</h3>
                <p className="text-xs text-text-dim leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features ────────────────────────────────────────────────
function Features() {
  const features = [
    { icon: '✦', title: 'AI-Generated Routes', desc: 'Enter a city and AI builds a geographically logical route through real landmarks with GPS coordinates.', color: 'text-purple', border: 'hover:border-purple/30' },
    { icon: '🛠️', title: 'Custom Challenges', desc: 'Prefer full control? Build legs and checkpoints manually — set locations, clues, and difficulty yourself.', color: 'text-accent', border: 'hover:border-accent/30' },
    { icon: '🧭', title: 'Live Map', desc: 'Fog-of-war Mapbox map reveals checkpoints as you complete them. Host sees the full route.', color: 'text-info', border: 'hover:border-info/30' },
    { icon: '🎮', title: 'Interactive Puzzles', desc: 'Sliding tiles, word search, Simon Says — real minigames built right into the experience.', color: 'text-success', border: 'hover:border-success/30' },
    { icon: '📷', title: 'Photo Proof', desc: 'Capture moments at each checkpoint. Review together at the end or approve live as host.', color: 'text-danger', border: 'hover:border-danger/30' },
    { icon: '👥', title: 'Solo, Duo, or Teams', desc: 'Play alone, pair up on two phones, or compete as teams. Everyone sees live progress.', color: 'text-cyan', border: 'hover:border-cyan/30' },
  ];

  return (
    <section id="features" className="py-16 md:py-20 px-4 scroll-mt-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-[11px] text-accent tracking-[4px] uppercase font-bold text-center mb-2">Features</p>
        <h2 className="font-display text-2xl md:text-3xl text-white text-center tracking-wider mb-3">
          BUILT FOR REAL ADVENTURES
        </h2>
        <p className="text-sm text-text-dim text-center max-w-md mx-auto mb-10">
          Whether AI designs your route or you craft every checkpoint — Wandr gives you the tools to make it unforgettable.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {features.map((f, i) => (
            <div key={i} className={`bg-surface/40 border border-border/60 rounded-xl p-5 transition-all ${f.border} group`}>
              <div className="flex items-start gap-3">
                <span className={`text-2xl ${f.color} shrink-0 group-hover:scale-110 transition-transform`}>{f.icon}</span>
                <div>
                  <h3 className="font-bold text-sm text-text-primary mb-1">{f.title}</h3>
                  <p className="text-[11px] text-text-dim leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── About ───────────────────────────────────────────────────
function About() {
  return (
    <section id="about" className="py-16 md:py-20 px-4 scroll-mt-16">
      <div className="max-w-xl mx-auto">
        <div className="bg-card/30 border border-border/60 rounded-2xl p-6 md:p-8">
          <p className="text-[11px] text-accent tracking-[4px] uppercase font-bold text-center mb-2">About</p>
          <h2 className="font-display text-2xl text-white text-center tracking-wider mb-6">THE STORY BEHIND WANDR</h2>
          <div className="space-y-4 text-sm text-text-dim leading-relaxed">
            <p>
              Wandr was born from a love of <em className="text-text-muted not-italic">The Amazing Race</em> — the iconic show where teams race around the world solving challenges, decoding clues, and navigating unfamiliar cities under pressure.
            </p>
            <p>
              We wanted to bring that same rush to everyday life. Instead of watching teams race on TV, what if you and your friends could race through your own city?
            </p>
            <p>
              So we built Wandr. AI can generate the entire route and challenges based on real landmarks — or you can design every checkpoint yourself for a fully custom experience. Whether it's a team-building event, a birthday adventure, or a solo exploration of a new city — every game is unique, every challenge is real, and every photo tells a story.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Main App ────────────────────────────────────────────────
export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<null | 'create' | 'join' | 'explore'>(null);
  const [activeSection, setActiveSection] = useState('home');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [teamMode, setTeamMode] = useState<'solo' | 'duo'>('solo');
  const [joinStep, setJoinStep] = useState<'code' | 'team'>('code');
  const [existingTeams, setExistingTeams] = useState<any[]>([]);
  const [joinExisting, setJoinExisting] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [adminPlaying, setAdminPlaying] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [raceToJoin, setRaceToJoin] = useState<any>(null);

  const [exploreCity, setExploreCity] = useState('');
  const [exploreDifficulty, setExploreDifficulty] = useState('medium');
  const [exploreRadius, setExploreRadius] = useState(5);
  const [exploring, setExploring] = useState(false);
  const [exploreProgress, setExploreProgress] = useState(0);

  // Track active section for nav highlight
  useEffect(() => {
    if (mode) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' }
    );
    ['home', 'how', 'features', 'about'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [mode]);

  // ── Create Race ─────────────────────────────────────────────
  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const raceCode = generateCode();
    const { data, error: err } = await supabase.from('races').insert({
      name: name.trim(), code: raceCode, status: 'setup', city: '', boundary: [], admin_playing: adminPlaying,
    }).select().single();
    if (err || !data) { setError(err?.message || 'Failed to create'); setLoading(false); return; }
    setSession({ raceId: data.id, role: 'admin' });
    setLoading(false);
  };

  const handleValidateCode = async () => {
    if (!code.trim()) return;
    setLoading(true); setError('');
    const { data: race } = await supabase.from('races').select().eq('code', code.trim().toUpperCase()).single();
    if (!race) { setError('Adventure not found. Check the code.'); setLoading(false); return; }
    setRaceToJoin(race);
    const { data: teams } = await supabase.from('teams').select().eq('race_id', race.id).eq('mode', 'duo');
    setExistingTeams(teams || []);
    setJoinStep('team');
    setLoading(false);
  };

  const handleJoinTeam = async () => {
    if (!raceToJoin) return;
    setLoading(true); setError('');
    let teamId: string;
    if (joinExisting && selectedTeamId) {
      teamId = selectedTeamId;
      await supabase.from('team_members').insert({ team_id: teamId, name: playerName.trim() || 'Player 2' });
    } else {
      const tName = teamMode === 'solo' ? (playerName.trim() || 'Solo Player') : (teamName.trim() || 'Team');
      const { data: team, error: err } = await supabase.from('teams').insert({ race_id: raceToJoin.id, name: tName, mode: teamMode }).select().single();
      if (err || !team) { setError(err?.message || 'Failed to join'); setLoading(false); return; }
      teamId = team.id;
      await supabase.from('team_members').insert({ team_id: teamId, name: playerName.trim() || (teamMode === 'solo' ? 'Player' : 'Player 1') });
    }
    setSession({ raceId: raceToJoin.id, role: 'player', teamId });
    setLoading(false);
  };

  const handleExplore = async () => {
    if (!exploreCity.trim()) return;
    setExploring(true); setExploreProgress(0);
    let step = 0;
    const iv = setInterval(() => { step++; setExploreProgress(Math.min(step * 15, 90)); }, 500);
    try {
      const raceCode = generateCode();
      const { data: race, error: rErr } = await supabase.from('races').insert({
        name: `${exploreCity} Explorer`, code: raceCode, status: 'active', city: exploreCity.trim(), boundary: [],
        admin_playing: true, is_solo_explorer: true, difficulty: exploreDifficulty, radius_km: exploreRadius, started_at: new Date().toISOString(),
      }).select().single();
      if (rErr || !race) throw new Error(rErr?.message || 'Failed');
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: exploreCity.trim(), numLegs: 3, difficulty: exploreDifficulty, radiusKm: exploreRadius, startAddress: '' }),
      });
      const data = await res.json();
      if (!res.ok || !data.legs?.length) throw new Error(data.error || 'Generation failed');
      const validMiniGames = ['sliding', 'wordsearch', 'simon'];
      for (let i = 0; i < data.legs.length; i++) {
        const gl = data.legs[i];
        const { data: legData } = await supabase.from('legs').insert({ race_id: race.id, name: gl.name, order_num: i }).select().single();
        if (legData && gl.checkpoints?.length) {
          await supabase.from('checkpoints').insert(gl.checkpoints.map((cp: any, j: number) => ({
            leg_id: legData.id, name: cp.name, type: cp.type, description: cp.description || '', clue_text: cp.clueText || '',
            requires_approval: false, order_num: j, answer: cp.answer || '',
            mini_game_type: cp.type === 'minigame' ? (cp.miniGameType && validMiniGames.includes(cp.miniGameType) ? cp.miniGameType : randomMiniGame()) : '',
            lat: cp.lat || null, lng: cp.lng || null,
          })));
        }
      }
      const { data: team } = await supabase.from('teams').insert({ race_id: race.id, name: 'Wanderer', mode: 'solo' }).select().single();
      clearInterval(iv); setExploreProgress(100);
      if (team) setTimeout(() => { setSession({ raceId: race.id, role: 'explorer', teamId: team.id }); setExploring(false); }, 500);
    } catch (err: any) { clearInterval(iv); setError(err.message || 'Failed'); setExploring(false); }
  };

  const logout = () => { setSession(null); setMode(null); setJoinStep('code'); setRaceToJoin(null); setJoinExisting(false); setError(''); };

  if (session?.role === 'admin') return <AdminView raceId={session.raceId} onExit={logout} />;
  if ((session?.role === 'player' || session?.role === 'explorer') && session.teamId) return <PlayerView raceId={session.raceId} teamId={session.teamId} onExit={logout} />;

  const EXPLORE_PRESETS = [
    { label: '🗽 NYC', city: 'New York City' },
    { label: '🗼 Paris', city: 'Paris' },
    { label: '🏯 Tokyo', city: 'Tokyo' },
    { label: '🌉 SF', city: 'San Francisco' },
    { label: '🎭 London', city: 'London' },
  ];

  // ── LANDING PAGE ────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="min-h-screen">
        <StickyNav activeSection={activeSection} />

        {/* Hero */}
        <section id="home" className="flex flex-col items-center justify-center min-h-[85vh] px-4 text-center scroll-mt-16">
          <div className="animate-fade-in">
            <div className="inline-block px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-4">
              <p className="text-accent text-[11px] tracking-[3px] uppercase font-bold">Real-world adventure game</p>
            </div>
            <h1 className="font-display text-7xl md:text-9xl text-accent leading-none tracking-wider">WANDR</h1>
            <p className="text-text-dim text-sm md:text-base mt-4 max-w-sm mx-auto leading-relaxed">
              Turn any city into a playground. AI designs the route — or build your own. You bring the energy.
            </p>
          </div>

          <div className="w-full max-w-xs flex flex-col gap-2.5 mt-8 animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <button onClick={() => setMode('create')} className="btn-primary">
              Create an Adventure
            </button>
            <p className="text-[10px] text-text-muted text-center -mt-0.5 mb-1">Host a game for friends, events, or parties</p>

            <button onClick={() => setMode('join')} className="btn-secondary">
              Join an Adventure
            </button>
            <p className="text-[10px] text-text-muted text-center -mt-0.5 mb-1">Got a code? Jump into a live game</p>

            <button onClick={() => setMode('explore')}
              className="w-full px-6 py-3 bg-gradient-to-br from-purple to-purple/60 text-white font-bold rounded-xl text-[15px] cursor-pointer hover:shadow-lg hover:shadow-purple/20 transition-all active:scale-[0.98]">
              🧭 Explore Solo
            </button>
            <p className="text-[10px] text-text-muted text-center -mt-0.5">No host needed — pick a city and go</p>
          </div>

          {/* Scroll hint */}
          <div className="mt-12 animate-pulse">
            <p className="text-[10px] text-text-muted tracking-widest uppercase mb-1">Scroll to learn more</p>
            <div className="text-text-muted text-lg">↓</div>
          </div>
        </section>

        <HowItWorks />
        <Features />
        <About />

        {/* Footer */}
        <footer className="text-center py-8 border-t border-border/30">
          <p className="font-display text-lg text-accent/40 tracking-wider mb-1">WANDR</p>
          <p className="text-[11px] text-text-muted">
            Built by <a href="https://shriyagotety.com" target="_blank" rel="noopener" className="text-text-dim hover:text-accent transition-colors">Shriya Gotety</a>
          </p>
        </footer>
      </div>
    );
  }

  // ── FORMS ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-10">
      <div className="text-center mb-6">
        <button onClick={() => { setMode(null); setError(''); setJoinStep('code'); }} className="font-display text-2xl text-accent tracking-wider hover:opacity-80 transition-opacity cursor-pointer">
          WANDR
        </button>
      </div>

      {/* ── CREATE ── */}
      {mode === 'create' && (
        <div className="card w-full max-w-sm animate-fade-in">
          <h2 className="font-display text-xl text-accent tracking-wider mb-1">CREATE ADVENTURE</h2>
          <p className="text-xs text-text-dim mb-4">Set up a game and share the code with players</p>
          <input className="input-field" placeholder="Give your adventure a name..." value={name}
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />

          <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-4 mb-3">
            <div>
              <p className="text-sm font-semibold">Playing too? 🎮</p>
              <p className="text-[11px] text-text-dim mt-0.5">
                {adminPlaying ? 'Players auto-advance. Review photos at the end.' : 'You\'ll review & approve submissions live.'}
              </p>
            </div>
            <button onClick={() => setAdminPlaying(!adminPlaying)}
              className={`relative w-12 h-7 rounded-full transition-all cursor-pointer shrink-0 ml-3 ${adminPlaying ? 'bg-success' : 'bg-border'}`}>
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${adminPlaying ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>

          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <button onClick={handleCreate} disabled={loading || !name.trim()} className="btn-primary">
            {loading ? 'Creating...' : 'Create Adventure'}
          </button>
          <button onClick={() => { setMode(null); setError(''); }} className="btn-ghost mt-2">← Back</button>
        </div>
      )}

      {/* ── JOIN Step 1 ── */}
      {mode === 'join' && joinStep === 'code' && (
        <div className="card w-full max-w-sm animate-fade-in">
          <h2 className="font-display text-xl text-accent tracking-wider mb-1">JOIN ADVENTURE</h2>
          <p className="text-xs text-text-dim mb-4">Enter the 6-character code from your host</p>
          <input className="input-field text-center font-mono text-xl tracking-[6px] uppercase" placeholder="• • • • • •"
            value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6}
            onKeyDown={e => e.key === 'Enter' && handleValidateCode()} />
          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <button onClick={handleValidateCode} disabled={loading || code.length < 4} className="btn-primary">
            {loading ? 'Checking...' : 'Find Adventure'}
          </button>
          <button onClick={() => { setMode(null); setError(''); }} className="btn-ghost mt-2">← Back</button>
        </div>
      )}

      {/* ── JOIN Step 2 ── */}
      {mode === 'join' && joinStep === 'team' && raceToJoin && (
        <div className="card w-full max-w-sm animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-success" />
            <p className="text-xs text-success font-semibold">Found: {raceToJoin.name}</p>
            {raceToJoin.city && <span className="badge bg-accent/10 text-accent">{raceToJoin.city}</span>}
          </div>

          {!joinExisting && (
            <>
              <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">How are you playing?</label>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setTeamMode('solo')}
                  className={`flex-1 py-3 rounded-xl text-center border cursor-pointer transition-all ${teamMode === 'solo' ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
                  <div className="text-2xl mb-1">🏃</div>
                  <div className={`text-sm font-bold ${teamMode === 'solo' ? 'text-accent' : 'text-text-dim'}`}>Solo</div>
                  <div className="text-[10px] text-text-muted">Just me</div>
                </button>
                <button onClick={() => setTeamMode('duo')}
                  className={`flex-1 py-3 rounded-xl text-center border cursor-pointer transition-all ${teamMode === 'duo' ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
                  <div className="text-2xl mb-1">👥</div>
                  <div className={`text-sm font-bold ${teamMode === 'duo' ? 'text-accent' : 'text-text-dim'}`}>Duo</div>
                  <div className="text-[10px] text-text-muted">2 phones, 1 team</div>
                </button>
              </div>
            </>
          )}

          <input className="input-field" placeholder="Your name..." value={playerName} onChange={e => setPlayerName(e.target.value)} />
          {teamMode === 'duo' && !joinExisting && <input className="input-field" placeholder="Team name..." value={teamName} onChange={e => setTeamName(e.target.value)} />}
          {teamMode === 'duo' && existingTeams.length > 0 && !joinExisting && (
            <button onClick={() => setJoinExisting(true)} className="text-xs text-accent underline cursor-pointer mb-3 block">Join your teammate's existing team →</button>
          )}
          {joinExisting && (
            <div className="mb-3">
              <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Pick your team</label>
              {existingTeams.map(t => (
                <button key={t.id} onClick={() => setSelectedTeamId(t.id)}
                  className={`w-full p-3 rounded-xl border mb-2 text-left cursor-pointer transition-all ${selectedTeamId === t.id ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
                  <p className={`font-semibold text-sm ${selectedTeamId === t.id ? 'text-accent' : ''}`}>👥 {t.name}</p>
                </button>
              ))}
              <button onClick={() => { setJoinExisting(false); setSelectedTeamId(''); }} className="text-xs text-text-dim underline cursor-pointer">← Create a new team</button>
            </div>
          )}
          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <button onClick={handleJoinTeam} disabled={loading || !playerName.trim()} className="btn-primary">
            {loading ? 'Joining...' : joinExisting ? 'Join Team' : teamMode === 'duo' ? 'Create Team & Join' : 'Join Adventure'}
          </button>
          <button onClick={() => { setJoinStep('code'); setError(''); setJoinExisting(false); }} className="btn-ghost mt-2">← Back</button>
        </div>
      )}

      {/* ── EXPLORE SOLO ── */}
      {mode === 'explore' && (
        <div className="card w-full max-w-sm animate-fade-in">
          <h2 className="font-display text-xl text-accent tracking-wider mb-1">🧭 EXPLORE SOLO</h2>
          <p className="text-xs text-text-dim mb-4">Pick a city. AI builds your route. No host needed.</p>

          <input className="input-field" placeholder="Where do you want to explore?" value={exploreCity} onChange={e => setExploreCity(e.target.value)} />
          <div className="flex flex-wrap gap-2 mb-4">
            {EXPLORE_PRESETS.map(p => (
              <button key={p.city} onClick={() => setExploreCity(p.city)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide border cursor-pointer transition-all ${
                  exploreCity === p.city ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-transparent text-text-dim'}`}>{p.label}</button>
            ))}
          </div>

          <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Difficulty</label>
          <div className="flex gap-2 mb-4">
            {['easy', 'medium', 'hard'].map(d => (
              <button key={d} onClick={() => setExploreDifficulty(d)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border cursor-pointer transition-all capitalize ${
                  exploreDifficulty === d ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-text-dim'}`}>
                {d === 'easy' ? '😊' : d === 'medium' ? '💪' : '🔥'} {d}
              </button>
            ))}
          </div>

          <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Radius</label>
          <div className="flex items-center gap-3 mb-5">
            <input type="range" min={0.5} max={10} step={0.5} value={exploreRadius / 1.609}
              onChange={e => setExploreRadius(Math.round(parseFloat(e.target.value) * 1.609 * 10) / 10)}
              className="flex-1 h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent" />
            <span className="text-sm font-bold text-accent min-w-[50px] text-right">{(exploreRadius / 1.609).toFixed(1)} mi</span>
          </div>

          {exploring && (
            <div className="mb-3 animate-fade-in">
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-purple to-accent transition-all duration-500" style={{ width: `${exploreProgress}%` }} />
              </div>
              <p className="text-xs text-text-dim text-center mt-2 animate-pulse">Building your adventure…</p>
            </div>
          )}

          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <button onClick={handleExplore} disabled={exploring || !exploreCity.trim()}
            className="w-full px-6 py-3 bg-gradient-to-br from-purple to-purple/60 text-white font-bold rounded-xl text-[15px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple/20 transition-all active:scale-[0.98]">
            {exploring ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</>) : '🧭 Start Exploring'}
          </button>
          <button onClick={() => { setMode(null); setError(''); }} className="btn-ghost mt-2">← Back</button>
        </div>
      )}
    </div>
  );
}
