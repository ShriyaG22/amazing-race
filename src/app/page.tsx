'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { generateCode, randomMiniGame } from '@/lib/utils';
import AdminView from '@/components/admin/AdminView';
import PlayerView from '@/components/player/PlayerView';
import MapPicker from '@/components/MapPicker';
import ExplorePreview from '@/components/ExplorePreview';

type Session = { raceId: string; role: 'admin' | 'player' | 'explorer'; teamId?: string };

// ── Detailed How It Works ───────────────────────────────────
function HowItWorks() {
  return (
    <section id="how" className="py-16 md:py-20 px-4 scroll-mt-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-[11px] text-purple tracking-[4px] uppercase font-bold text-center mb-2">How it works</p>
        <h2 className="font-display text-2xl md:text-3xl text-white text-center tracking-wider mb-4">YOUR ADVENTURE, STEP BY STEP</h2>
        <p className="text-sm text-text-dim text-center max-w-lg mx-auto mb-10">
          Think of it like a scavenger hunt meets city exploration. You move through real locations, solve puzzles, and complete challenges — either competing against others or just having fun.
        </p>

        {/* Step 1: Setup */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center font-display text-lg shrink-0">1</div>
            <h3 className="font-bold text-lg text-text-primary">Choose your adventure</h3>
          </div>
          <div className="ml-11">
            <p className="text-sm text-text-dim leading-relaxed mb-3">
              Pick a city anywhere in the world. AI designs a walking route through real landmarks, restaurants, parks, and hidden gems — or create your own challenges from scratch.
            </p>
            <div className="bg-card/40 border border-border/60 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-accent font-bold text-xs">✦ AI Mode</span>
                <span className="text-text-muted text-xs">— Tell the AI your city, theme, and difficulty. It builds everything.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple font-bold text-xs">🛠 Manual Mode</span>
                <span className="text-text-muted text-xs">— Design every checkpoint, clue, and challenge yourself.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Challenges */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center font-display text-lg shrink-0">2</div>
            <h3 className="font-bold text-lg text-text-primary">Complete challenges at each stop</h3>
          </div>
          <div className="ml-11">
            <p className="text-sm text-text-dim leading-relaxed mb-3">
              Your adventure is divided into <strong className="text-text-primary">legs</strong> (areas of the city), each with a series of checkpoints. There are three types:
            </p>
            <div className="space-y-2">
              <div className="bg-card/40 border border-border/60 rounded-xl p-4 flex items-start gap-3">
                <span className="text-2xl">🏁</span>
                <div>
                  <p className="text-sm font-bold text-text-primary">Challenges</p>
                  <p className="text-xs text-text-dim">Go to a location and complete a task — take a photo at a landmark, find a hidden item, taste a local dish, or answer a trivia question about the area.</p>
                </div>
              </div>
              <div className="bg-card/40 border border-border/60 rounded-xl p-4 flex items-start gap-3">
                <span className="text-2xl">🚧</span>
                <div>
                  <p className="text-sm font-bold text-text-primary">Roadblocks</p>
                  <p className="text-xs text-text-dim">One team member must complete a solo task — like solving a riddle, performing a physical challenge, or navigating without GPS. Your partner can cheer but can't help.</p>
                </div>
              </div>
              <div className="bg-card/40 border border-border/60 rounded-xl p-4 flex items-start gap-3">
                <span className="text-2xl">🧩</span>
                <div>
                  <p className="text-sm font-bold text-text-primary">Minigames</p>
                  <p className="text-xs text-text-dim">Interactive puzzles right in the app — sliding tile puzzles, word searches, and Simon Says-style pattern games. Solve them to unlock the next clue.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Prove it */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center font-display text-lg shrink-0">3</div>
            <h3 className="font-bold text-lg text-text-primary">Prove it & move on</h3>
          </div>
          <div className="ml-11">
            <p className="text-sm text-text-dim leading-relaxed">
              At each checkpoint, snap a photo to prove you were there. The host can review photos live, or everyone can review together at the end. Minigames auto-complete when you solve them. Stuck? You can always pass a checkpoint and keep going.
            </p>
          </div>
        </div>

        {/* Step 4: Finish */}
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center font-display text-lg shrink-0">4</div>
            <h3 className="font-bold text-lg text-text-primary">Finish & celebrate</h3>
          </div>
          <div className="ml-11">
            <p className="text-sm text-text-dim leading-relaxed">
              In Race mode, the fastest team wins — check the live leaderboard as you go. In Explorer mode, there's no timer — just enjoy the journey, check off stops in any order, and review your photo memories at the end.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Features ────────────────────────────────────────────────
function Features() {
  const features = [
    { icon: '✦', title: 'AI-Generated Routes', desc: 'Enter a city and AI builds a geographically logical route through real landmarks with GPS coordinates.', border: 'hover:border-purple/30' },
    { icon: '🛠️', title: 'Custom Challenges', desc: 'Full control: build legs and checkpoints manually — set locations, clues, and difficulty yourself.', border: 'hover:border-accent/30' },
    { icon: '🧭', title: 'Live Map', desc: 'Fog-of-war map reveals checkpoints as you complete them. Host sees the full route.', border: 'hover:border-info/30' },
    { icon: '🎮', title: 'Interactive Puzzles', desc: 'Sliding tiles, word search, Simon Says — real minigames built right into the experience.', border: 'hover:border-success/30' },
    { icon: '📷', title: 'Photo Proof', desc: 'Capture moments at each stop. Review together at the end or approve live as host.', border: 'hover:border-danger/30' },
    { icon: '👥', title: 'Solo, Duo, or Teams', desc: 'Play alone, pair up on two phones, or compete as teams. Everyone sees live progress.', border: 'hover:border-cyan/30' },
  ];
  return (
    <section id="features" className="py-16 md:py-20 px-4 scroll-mt-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-[11px] text-accent tracking-[4px] uppercase font-bold text-center mb-2">Features</p>
        <h2 className="font-display text-2xl md:text-3xl text-white text-center tracking-wider mb-8">BUILT FOR REAL ADVENTURES</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {features.map((f, i) => (
            <div key={i} className={`bg-surface/40 border border-border/60 rounded-xl p-5 transition-all ${f.border} group`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 group-hover:scale-110 transition-transform">{f.icon}</span>
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
            <p>Wandr was born from a love of <em className="text-text-muted not-italic">The Amazing Race</em> — the iconic TV show where teams race around the world solving challenges, decoding clues, and navigating unfamiliar cities under pressure.</p>
            <p>We wanted to bring that same rush to everyday life. Instead of watching teams race on TV, what if you and your friends could race through your own city?</p>
            <p>So we built Wandr. AI can generate the entire route and challenges based on real landmarks — or you can design every checkpoint yourself. Whether it's a team-building event, a birthday adventure, or a solo exploration of a new city — every game is unique, every challenge is real, and every photo tells a story.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Sticky Nav ──────────────────────────────────────────────
function StickyNav({ activeSection }: { activeSection: string }) {
  const tabs = [
    { id: 'how', label: 'How It Works' },
    { id: 'features', label: 'Features' },
    { id: 'about', label: 'About' },
  ];
  return (
    <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
        <a href="#home" className="font-display text-xl text-accent tracking-wider hover:opacity-80 transition-opacity">WANDR</a>
        <div className="flex gap-1">
          {tabs.map(t => (
            <a key={t.id} href={`#${t.id}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeSection === t.id ? 'bg-accent/15 text-accent' : 'text-text-dim hover:text-text-muted'}`}>
              {t.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

// ── Main App ────────────────────────────────────────────────
export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<null | 'create' | 'join' | 'explore'>(null);
  const [activeSection, setActiveSection] = useState('home');

  // Create state
  const [name, setName] = useState('');
  const [adminPlaying, setAdminPlaying] = useState(false);
  const [requirePhoto, setRequirePhoto] = useState(true);

  // Join state
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [teamMode, setTeamMode] = useState<'solo' | 'duo'>('solo');
  const [joinStep, setJoinStep] = useState<'code' | 'team'>('code');
  const [existingTeams, setExistingTeams] = useState<any[]>([]);
  const [joinExisting, setJoinExisting] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [raceToJoin, setRaceToJoin] = useState<any>(null);

  // Explore state
  const [exploreCity, setExploreCity] = useState('');
  const [exploreDifficulty, setExploreDifficulty] = useState('medium');
  const [exploreRadius, setExploreRadius] = useState(3);
  const [exploring, setExploring] = useState(false);
  const [exploreProgress, setExploreProgress] = useState(0);
  const [exploreTheme, setExploreTheme] = useState('');
  const [exploreNotes, setExploreNotes] = useState('');
  const [exploreStartAddress, setExploreStartAddress] = useState('');
  const [exploreStartLat, setExploreStartLat] = useState<number | null>(null);
  const [exploreStartLng, setExploreStartLng] = useState<number | null>(null);
  const [exploreRequirePhoto, setExploreRequirePhoto] = useState(false);
  const [exploreTeamMode, setExploreTeamMode] = useState<'solo' | 'group'>('solo');
  const [exploreDuration, setExploreDuration] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Section tracking
  useEffect(() => {
    if (mode) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) setActiveSection(entry.target.id); });
    }, { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' });
    ['home', 'how', 'features', 'about'].forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [mode]);

  // ── Create Race ─────────────────────────────────────────────
  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const raceCode = generateCode();
    const { data, error: err } = await supabase.from('races').insert({
      name: name.trim(), code: raceCode, status: 'setup', city: '', boundary: [],
      admin_playing: adminPlaying, require_photo: requirePhoto, game_mode: 'race',
    }).select().single();
    if (err || !data) { setError(err?.message || 'Failed to create'); setLoading(false); return; }
    setSession({ raceId: data.id, role: 'admin' });
    setLoading(false);
  };

  // ── Join ────────────────────────────────────────────────────
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

  // ── Explore ─────────────────────────────────────────────────
  const [exploreRaceId, setExploreRaceId] = useState<string | null>(null);
  const [exploreTeamId, setExploreTeamId] = useState<string | null>(null);
  const [exploreReady, setExploreReady] = useState(false);
  const [exploreCode, setExploreCode] = useState('');

  const handleExplore = async () => {
    if (!exploreCity.trim()) return;
    setExploring(true); setExploreProgress(0);
    let step = 0;
    const iv = setInterval(() => { step++; setExploreProgress(Math.min(step * 12, 90)); }, 500);
    try {
      const raceCode = generateCode();
      const { data: race, error: rErr } = await supabase.from('races').insert({
        name: `${exploreCity} Explorer`, code: raceCode, status: 'active', city: exploreCity.trim(), boundary: [],
        admin_playing: true, is_solo_explorer: true, difficulty: exploreDifficulty,
        radius_km: Math.round(exploreRadius * 1.609 * 10) / 10, started_at: new Date().toISOString(),
        game_mode: 'explorer', require_photo: exploreRequirePhoto,
      }).select().single();
      if (rErr || !race) throw new Error(rErr?.message || 'Failed');

      const fullNotes = [exploreTheme, exploreDuration ? `The entire experience should be completable in approximately ${exploreDuration}.` : '', exploreNotes].filter(Boolean).join('\n');
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: exploreCity.trim(), numLegs: 3, difficulty: exploreDifficulty,
          radiusKm: Math.round(exploreRadius * 1.609 * 10) / 10, startAddress: exploreStartAddress.trim(), notes: fullNotes }),
      });
      const data = await res.json();
      if (!res.ok || !data.legs?.length) throw new Error(data.error || 'Generation failed');

      const validClueTypes = ['text', 'sliding', 'wordsearch', 'simon'];
      for (let i = 0; i < data.legs.length; i++) {
        const gl = data.legs[i];
        const { data: legData } = await supabase.from('legs').insert({ race_id: race.id, name: gl.name, order_num: i }).select().single();
        if (legData && gl.checkpoints?.length) {
          await supabase.from('checkpoints').insert(gl.checkpoints.map((cp: any, j: number) => ({
            leg_id: legData.id, name: cp.name, type: cp.type || 'challenge',
            description: cp.description || '', clue_text: cp.clueText || '',
            clue_type: cp.clueType && validClueTypes.includes(cp.clueType) ? cp.clueType : 'text',
            location_answer: cp.locationAnswer || cp.name || '',
            fun_fact: cp.funFact || '',
            requires_approval: false, order_num: j, answer: cp.answer || '',
            mini_game_type: cp.clueType && cp.clueType !== 'text' ? cp.clueType : '',
            lat: cp.lat || null, lng: cp.lng || null,
          })));
        }
      }

      const { data: team } = await supabase.from('teams').insert({ race_id: race.id, name: 'Wanderer', mode: 'solo' }).select().single();
      clearInterval(iv); setExploreProgress(100);

      // Show the preview/start choice
      setExploreRaceId(race.id);
      setExploreTeamId(team?.id || null);
      setExploreCode(raceCode);
      setExploreReady(true);
      setExploring(false);
    } catch (err: any) { clearInterval(iv); setError(err.message || 'Failed'); setExploring(false); }
  };

  const startExplore = () => {
    if (exploreRaceId && exploreTeamId) {
      setSession({ raceId: exploreRaceId, role: 'explorer', teamId: exploreTeamId });
    }
  };

  const previewExplore = () => {
    if (exploreRaceId && exploreTeamId) {
      setSession({ raceId: exploreRaceId, role: 'explorer-preview' as any, teamId: exploreTeamId });
    }
  };

  const logout = () => { setSession(null); setMode(null); setJoinStep('code'); setRaceToJoin(null); setJoinExisting(false); setError(''); };

  if (session?.role === 'admin') return <AdminView raceId={session.raceId} onExit={logout} />;
  if ((session as any)?.role === 'explorer-preview' && session.teamId) return (
    <ExplorePreview
      raceId={session.raceId}
      teamId={session.teamId}
      onStart={() => setSession({ raceId: session.raceId, role: 'explorer', teamId: session.teamId })}
      onBack={logout}
    />
  );
  if ((session?.role === 'player' || session?.role === 'explorer') && session.teamId) return <PlayerView raceId={session.raceId} teamId={session.teamId} onExit={logout} />;

  const PRESETS = [
    { label: '🗽 NYC', city: 'New York City' },
    { label: '🗼 Paris', city: 'Paris' },
    { label: '🏯 Tokyo', city: 'Tokyo' },
    { label: '🌉 SF', city: 'San Francisco' },
    { label: '🎭 London', city: 'London' },
  ];
  const THEMES = [
    { l: '🌍 Any', v: '' }, { l: '🍜 Foodie', v: 'Focus on food, markets, and culinary culture.' },
    { l: '🏛️ History', v: 'Focus on historic landmarks and heritage.' }, { l: '🎨 Art', v: 'Focus on street art and galleries.' },
    { l: '🏃 Active', v: 'Focus on parks and physical challenges.' }, { l: '🌃 Nightlife', v: 'Focus on bars and evening spots.' },
  ];

  // ── LANDING PAGE ────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="min-h-screen">
        <StickyNav activeSection={activeSection} />
        <section id="home" className="flex flex-col items-center justify-center min-h-[80vh] px-4 pt-4 text-center scroll-mt-16">
          <div className="animate-fade-in">
            <div className="inline-block px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-5">
              <p className="text-accent text-[11px] tracking-[3px] uppercase font-bold">Real-world adventure game</p>
            </div>
            <h1 className="font-display text-7xl md:text-9xl text-accent leading-none tracking-wider">WANDR</h1>
            <p className="text-text-dim text-sm md:text-base mt-4 max-w-sm mx-auto leading-relaxed">
              Turn any city into a playground. Race against friends or explore at your own pace.
            </p>
          </div>

          <div className="w-full max-w-xs flex flex-col gap-2.5 mt-8 animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <button onClick={() => setMode('create')} className="btn-primary">
              🏁 Create a Race
            </button>
            <p className="text-[10px] text-text-muted text-center -mt-0.5 mb-1">Host a competitive challenge for your group</p>

            <button onClick={() => setMode('explore')}
              className="w-full px-6 py-3 bg-gradient-to-br from-purple to-purple/60 text-white font-bold rounded-xl text-[15px] cursor-pointer hover:shadow-lg hover:shadow-purple/20 transition-all active:scale-[0.98]">
              🧭 Explore a City
            </button>
            <p className="text-[10px] text-text-muted text-center -mt-0.5 mb-2">Discover landmarks, solve puzzles — solo or with friends</p>

            <button onClick={() => setMode('join')} className="text-text-dim text-sm hover:text-accent transition-colors cursor-pointer bg-transparent border-none">
              Have a code? <span className="underline">Join an adventure →</span>
            </button>
          </div>

          <div className="mt-12 animate-pulse">
            <p className="text-[10px] text-text-muted tracking-widest uppercase mb-1">Scroll to learn more</p>
            <div className="text-text-muted text-lg">↓</div>
          </div>
        </section>

        <HowItWorks />
        <Features />
        <About />

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
        <button onClick={() => { setMode(null); setError(''); setJoinStep('code'); }} className="font-display text-2xl text-accent tracking-wider hover:opacity-80 transition-opacity cursor-pointer">WANDR</button>
      </div>

      {/* ── CREATE A RACE ── */}
      {mode === 'create' && (
        <div className="card w-full max-w-sm animate-fade-in">
          <h2 className="font-display text-xl text-accent tracking-wider mb-1">🏁 CREATE A RACE</h2>
          <p className="text-xs text-text-dim mb-4">Set up a competitive game. Share the code and race against each other.</p>

          <input className="input-field" placeholder="Name your race..." value={name}
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />

          <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-4 mb-3">
            <div>
              <p className="text-sm font-semibold">Playing too? 🎮</p>
              <p className="text-[11px] text-text-dim mt-0.5">
                {adminPlaying ? 'Players auto-advance. Review photos later.' : 'You\'ll review & approve each submission live.'}
              </p>
            </div>
            <button onClick={() => setAdminPlaying(!adminPlaying)}
              className={`relative w-12 h-7 rounded-full transition-all cursor-pointer shrink-0 ml-3 ${adminPlaying ? 'bg-success' : 'bg-border'}`}>
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${adminPlaying ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-4 mb-4">
            <div>
              <p className="text-sm font-semibold">Require photos? 📸</p>
              <p className="text-[11px] text-text-dim mt-0.5">
                {requirePhoto ? 'Players snap a photo at each checkpoint.' : 'No photos — players just mark complete.'}
              </p>
            </div>
            <button onClick={() => setRequirePhoto(!requirePhoto)}
              className={`relative w-12 h-7 rounded-full transition-all cursor-pointer shrink-0 ml-3 ${requirePhoto ? 'bg-success' : 'bg-border'}`}>
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${requirePhoto ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>

          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <button onClick={handleCreate} disabled={loading || !name.trim()} className="btn-primary">
            {loading ? 'Creating...' : 'Create Race'}
          </button>
          <button onClick={() => { setMode(null); setError(''); }} className="btn-ghost mt-2">← Back</button>
        </div>
      )}

      {/* ── JOIN ── */}
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
                  <div className={`text-xs font-bold ${teamMode === 'solo' ? 'text-accent' : 'text-text-dim'}`}>Solo</div>
                </button>
                <button onClick={() => setTeamMode('duo')}
                  className={`flex-1 py-3 rounded-xl text-center border cursor-pointer transition-all ${teamMode === 'duo' ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
                  <div className="text-2xl mb-1">👥</div>
                  <div className={`text-xs font-bold ${teamMode === 'duo' ? 'text-accent' : 'text-text-dim'}`}>Duo</div>
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
              {existingTeams.map(t => (
                <button key={t.id} onClick={() => setSelectedTeamId(t.id)}
                  className={`w-full p-3 rounded-xl border mb-2 text-left cursor-pointer transition-all ${selectedTeamId === t.id ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
                  <p className={`font-semibold text-sm ${selectedTeamId === t.id ? 'text-accent' : ''}`}>👥 {t.name}</p>
                </button>
              ))}
              <button onClick={() => { setJoinExisting(false); setSelectedTeamId(''); }} className="text-xs text-text-dim underline cursor-pointer">← New team</button>
            </div>
          )}
          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <button onClick={handleJoinTeam} disabled={loading || !playerName.trim()} className="btn-primary">
            {loading ? 'Joining...' : joinExisting ? 'Join Team' : teamMode === 'duo' ? 'Create Team & Join' : 'Join Adventure'}
          </button>
          <button onClick={() => { setJoinStep('code'); setError(''); setJoinExisting(false); }} className="btn-ghost mt-2">← Back</button>
        </div>
      )}

      {/* ── EXPLORE ── */}
      {mode === 'explore' && (
        <div className="card w-full max-w-sm animate-fade-in">
          <h2 className="font-display text-xl text-accent tracking-wider mb-1">🧭 EXPLORE</h2>
          <p className="text-xs text-text-dim mb-4">AI builds your route. Go at your own pace, in any order.</p>

          {/* Solo or Group */}
          <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Who's exploring?</label>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setExploreTeamMode('solo')}
              className={`flex-1 py-3 rounded-xl text-center border cursor-pointer transition-all ${
                exploreTeamMode === 'solo' ? 'border-purple bg-purple/10' : 'border-border bg-surface'}`}>
              <div className="text-xl mb-0.5">🏃</div>
              <div className={`text-xs font-bold ${exploreTeamMode === 'solo' ? 'text-purple' : 'text-text-dim'}`}>Just me</div>
            </button>
            <button onClick={() => setExploreTeamMode('group')}
              className={`flex-1 py-3 rounded-xl text-center border cursor-pointer transition-all ${
                exploreTeamMode === 'group' ? 'border-purple bg-purple/10' : 'border-border bg-surface'}`}>
              <div className="text-xl mb-0.5">👥</div>
              <div className={`text-xs font-bold ${exploreTeamMode === 'group' ? 'text-purple' : 'text-text-dim'}`}>With friends</div>
              <div className="text-[9px] text-text-muted mt-0.5">Share a code to join</div>
            </button>
          </div>

          <input className="input-field" placeholder="What city?" value={exploreCity} onChange={e => setExploreCity(e.target.value)} />
          <div className="flex flex-wrap gap-2 mb-4">
            {PRESETS.map(p => (
              <button key={p.city} onClick={() => setExploreCity(p.city)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide border cursor-pointer transition-all ${
                  exploreCity === p.city ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-transparent text-text-dim'}`}>{p.label}</button>
            ))}
          </div>

          {/* Starting Point + Map */}
          <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Starting Point & Area</label>
          {exploreCity && (
            <MapPicker
              lat={exploreStartLat}
              lng={exploreStartLng}
              radiusMiles={exploreRadius}
              city={exploreCity}
              onLocationChange={(lat, lng, addr) => {
                setExploreStartLat(lat);
                setExploreStartLng(lng);
                setExploreStartAddress(addr);
              }}
              onRadiusChange={setExploreRadius}
            />
          )}
          {!exploreCity && (
            <div className="w-full h-[120px] rounded-xl border border-dashed border-border flex items-center justify-center mb-4">
              <p className="text-xs text-text-muted">Enter a city above to see the map</p>
            </div>
          )}

          {/* Theme */}
          <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Theme</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {THEMES.map(t => (
              <button key={t.l} onClick={() => setExploreTheme(t.v)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-all ${
                  exploreTheme === t.v ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-transparent text-text-dim'}`}>{t.l}</button>
            ))}
          </div>

          {/* Difficulty */}
          <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Difficulty</label>
          <div className="flex gap-2 mb-4">
            {[{v:'easy',l:'😊 Easy'},{v:'medium',l:'💪 Medium'},{v:'hard',l:'🔥 Hard'}].map(d => (
              <button key={d.v} onClick={() => setExploreDifficulty(d.v)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                  exploreDifficulty === d.v ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-text-dim'}`}>{d.l}</button>
            ))}
          </div>

          {/* Duration */}
          <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">How long?</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { l: '⚡ 30 min', v: '30 minutes' },
              { l: '🕐 1 hour', v: '1 hour' },
              { l: '🕑 2 hours', v: '2 hours' },
              { l: '🌤️ Half day', v: 'half a day (3-4 hours)' },
              { l: '☀️ Full day', v: 'a full day (6-8 hours)' },
            ].map(d => (
              <button key={d.v} onClick={() => setExploreDuration(exploreDuration === d.v ? '' : d.v)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-all ${
                  exploreDuration === d.v ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-transparent text-text-dim'}`}>{d.l}</button>
            ))}
          </div>

          {/* Photo toggle */}
          <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-3 mb-4">
            <div>
              <p className="text-sm font-semibold">Photo proof? 📸</p>
              <p className="text-[10px] text-text-dim">{exploreRequirePhoto ? 'Snap a photo at each stop' : 'Just mark complete — no photos'}</p>
            </div>
            <button onClick={() => setExploreRequirePhoto(!exploreRequirePhoto)}
              className={`relative w-11 h-6 rounded-full transition-all cursor-pointer shrink-0 ml-3 ${exploreRequirePhoto ? 'bg-success' : 'bg-border'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${exploreRequirePhoto ? 'left-[21px]' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Notes */}
          <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Notes for AI <span className="text-text-muted font-normal">(optional)</span></label>
          <textarea className="input-field !mb-1 resize-none min-h-[56px]" rows={2}
            placeholder="e.g. No museums, keep it outdoors, include a coffee stop..."
            value={exploreNotes} onChange={e => setExploreNotes(e.target.value)} />
          <p className="text-[10px] text-text-muted mb-4">AI considers these when building your route</p>

          {exploring && (
            <div className="mb-3 animate-fade-in">
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-purple to-accent transition-all duration-500" style={{ width: `${exploreProgress}%` }} />
              </div>
              <p className="text-xs text-text-dim text-center mt-2 animate-pulse">Building your adventure…</p>
            </div>
          )}

          {/* Ready screen — after AI generation */}
          {exploreReady && (
            <div className="animate-fade-in">
              <div className="bg-success/10 border border-success/20 rounded-xl p-5 mb-4 text-center">
                <p className="text-3xl mb-2">🎉</p>
                <h3 className="font-display text-xl text-success tracking-wider mb-1">ADVENTURE READY</h3>
                <p className="text-xs text-text-dim">{exploreCity} Explorer</p>
                {exploreTeamMode === 'group' && (
                  <div className="mt-3 pt-3 border-t border-success/20">
                    <p className="text-[10px] text-text-dim uppercase tracking-wide mb-1">Share this code with friends</p>
                    <p className="font-mono text-2xl text-success tracking-[4px] font-bold">{exploreCode}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={previewExplore} className="btn-secondary flex-1">
                  Preview & Edit
                </button>
                <button onClick={startExplore}
                  className="flex-1 px-6 py-3 bg-gradient-to-br from-purple to-purple/60 text-white font-bold rounded-xl text-[15px] cursor-pointer hover:shadow-lg hover:shadow-purple/20 transition-all active:scale-[0.98]">
                  Start Now →
                </button>
              </div>
              <button onClick={() => { setMode(null); setError(''); setExploreReady(false); }} className="btn-ghost mt-2">← Back to home</button>
            </div>
          )}

          {/* Generate button — shown before generation */}
          {!exploreReady && (
            <>
              {error && <p className="text-danger text-sm mb-3">{error}</p>}
              <button onClick={handleExplore} disabled={exploring || !exploreCity.trim()}
                className="w-full px-6 py-3 bg-gradient-to-br from-purple to-purple/60 text-white font-bold rounded-xl text-[15px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple/20 transition-all active:scale-[0.98]">
                {exploring ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</>) : '🧭 Generate Adventure'}
              </button>
              <button onClick={() => { setMode(null); setError(''); }} className="btn-ghost mt-2">← Back</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
