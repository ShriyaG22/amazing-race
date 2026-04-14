'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { generateCode } from '@/lib/utils';
import AdminView from '@/components/admin/AdminView';
import PlayerView from '@/components/player/PlayerView';

type Session = {
  raceId: string;
  role: 'admin' | 'player' | 'explorer';
  teamId?: string;
};

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<null | 'create' | 'join' | 'explore'>(null);
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

  // Solo Explorer state
  const [exploreCity, setExploreCity] = useState('');
  const [exploreDifficulty, setExploreDifficulty] = useState('medium');
  const [exploreRadius, setExploreRadius] = useState(5);
  const [exploring, setExploring] = useState(false);
  const [exploreProgress, setExploreProgress] = useState(0);

  // ── Create Race ─────────────────────────────────────────────
  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const raceCode = generateCode();
    const { data, error: err } = await supabase
      .from('races')
      .insert({
        name: name.trim(),
        code: raceCode,
        status: 'setup',
        city: '',
        boundary: [],
        admin_playing: adminPlaying,
      })
      .select()
      .single();
    
    if (err || !data) {
      setError(err?.message || 'Failed to create race');
      setLoading(false);
      return;
    }
    setSession({ raceId: data.id, role: 'admin' });
    setLoading(false);
  };

  // ── Join Race — Step 1: Validate Code ───────────────────────
  const [raceToJoin, setRaceToJoin] = useState<any>(null);

  const handleValidateCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');

    const { data: race } = await supabase
      .from('races')
      .select()
      .eq('code', code.trim().toUpperCase())
      .single();

    if (!race) {
      setError('Race not found. Check the code.');
      setLoading(false);
      return;
    }

    setRaceToJoin(race);

    // Fetch existing teams for duo joining
    const { data: teams } = await supabase
      .from('teams')
      .select()
      .eq('race_id', race.id)
      .eq('mode', 'duo');

    setExistingTeams(teams || []);
    setJoinStep('team');
    setLoading(false);
  };

  // ── Join Race — Step 2: Create or Join Team ─────────────────
  const handleJoinTeam = async () => {
    if (!raceToJoin) return;
    setLoading(true);
    setError('');

    let teamId: string;

    if (joinExisting && selectedTeamId) {
      // Join existing duo team
      teamId = selectedTeamId;
      // Add as team member
      await supabase.from('team_members').insert({
        team_id: teamId,
        name: playerName.trim() || 'Player 2',
      });
    } else {
      // Create new team
      const tName = teamMode === 'solo' ? (playerName.trim() || 'Solo Player') : (teamName.trim() || 'Team');
      const { data: team, error: err } = await supabase
        .from('teams')
        .insert({ race_id: raceToJoin.id, name: tName, mode: teamMode })
        .select()
        .single();

      if (err || !team) {
        setError(err?.message || 'Failed to join');
        setLoading(false);
        return;
      }
      teamId = team.id;

      // Add first member
      await supabase.from('team_members').insert({
        team_id: teamId,
        name: playerName.trim() || (teamMode === 'solo' ? 'Player' : 'Player 1'),
      });
    }

    setSession({ raceId: raceToJoin.id, role: 'player', teamId });
    setLoading(false);
  };

  // ── Solo Explorer ───────────────────────────────────────────
  const handleExplore = async () => {
    if (!exploreCity.trim()) return;
    setExploring(true);
    setExploreProgress(0);

    const msgs = ['Creating your adventure…', 'Scouting locations…', 'Building challenges…', 'Almost ready…'];
    let step = 0;
    const iv = setInterval(() => {
      step++;
      setExploreProgress(Math.min(step * 15, 90));
    }, 500);

    try {
      // 1. Create a solo race
      const raceCode = generateCode();
      const { data: race, error: rErr } = await supabase
        .from('races')
        .insert({
          name: `${exploreCity} Explorer`,
          code: raceCode,
          status: 'active',
          city: exploreCity.trim(),
          boundary: [],
          admin_playing: true,
          is_solo_explorer: true,
          difficulty: exploreDifficulty,
          radius_km: exploreRadius,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (rErr || !race) throw new Error(rErr?.message || 'Failed to create');

      // 2. Generate legs via AI
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: exploreCity.trim(),
          numLegs: 3,
          difficulty: exploreDifficulty,
          radiusKm: exploreRadius,
          startAddress: '',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.legs?.length) throw new Error(data.error || 'Generation failed');

      // 3. Save legs + checkpoints
      const validMiniGames = ['sliding', 'wordsearch', 'simon'];
      for (let i = 0; i < data.legs.length; i++) {
        const gl = data.legs[i];
        const { data: legData } = await supabase
          .from('legs')
          .insert({ race_id: race.id, name: gl.name, order_num: i })
          .select().single();

        if (legData && gl.checkpoints?.length) {
          const cpRows = gl.checkpoints.map((cp: any, j: number) => ({
            leg_id: legData.id,
            name: cp.name,
            type: cp.type,
            description: cp.description || '',
            clue_text: cp.clueText || '',
            requires_approval: false,
            order_num: j,
            answer: cp.answer || '',
            mini_game_type: cp.type === 'minigame'
              ? (cp.miniGameType && validMiniGames.includes(cp.miniGameType) ? cp.miniGameType : 'sliding')
              : '',
            lat: cp.lat || null,
            lng: cp.lng || null,
          }));
          await supabase.from('checkpoints').insert(cpRows);
        }
      }

      // 4. Create a solo team
      const { data: team } = await supabase
        .from('teams')
        .insert({ race_id: race.id, name: 'Explorer', mode: 'solo' })
        .select().single();

      clearInterval(iv);
      setExploreProgress(100);

      if (team) {
        setTimeout(() => {
          setSession({ raceId: race.id, role: 'explorer', teamId: team.id });
          setExploring(false);
        }, 500);
      }
    } catch (err: any) {
      clearInterval(iv);
      setError(err.message || 'Failed to create explorer race');
      setExploring(false);
    }
  };

  // ── Logout ──────────────────────────────────────────────────
  const logout = () => {
    setSession(null);
    setMode(null);
    setJoinStep('code');
    setRaceToJoin(null);
    setJoinExisting(false);
    setError('');
  };

  // ── Routing ─────────────────────────────────────────────────
  if (session?.role === 'admin') {
    return <AdminView raceId={session.raceId} onExit={logout} />;
  }
  if ((session?.role === 'player' || session?.role === 'explorer') && session.teamId) {
    return <PlayerView raceId={session.raceId} teamId={session.teamId} onExit={logout} />;
  }

  // ── PRESETS ─────────────────────────────────────────────────
  const EXPLORE_PRESETS = [
    { label: '🗽 NYC', city: 'New York City' },
    { label: '🗼 Paris', city: 'Paris' },
    { label: '🏯 Tokyo', city: 'Tokyo' },
    { label: '🌉 SF', city: 'San Francisco' },
    { label: '🎭 London', city: 'London' },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-10">
      <div className="text-center mb-10">
        <p className="text-text-dim text-sm tracking-[6px] uppercase mb-2 font-semibold">Live Game</p>
        <h1 className="font-display text-5xl md:text-6xl text-accent leading-none tracking-wider">
          THE AMAZING RACE
        </h1>
        <div className="w-16 h-[3px] bg-accent mx-auto mt-4 rounded-full" />
        <p className="text-text-dim text-sm mt-4 max-w-xs mx-auto">
          Race through real-world checkpoints. Solve puzzles. Prove it. Win.
        </p>
      </div>

      {/* ── HOME BUTTONS ── */}
      {!mode && (
        <div className="w-full max-w-sm flex flex-col gap-3">
          <button onClick={() => setMode('create')} className="btn-primary">
            Create a Race
          </button>
          <button onClick={() => setMode('join')} className="btn-secondary">
            Join a Race
          </button>
          <button onClick={() => setMode('explore')}
            className="w-full px-6 py-3 bg-gradient-to-br from-purple to-purple/70 text-white font-bold rounded-xl text-[15px] cursor-pointer">
            🧭 Explore Solo
          </button>
        </div>
      )}

      {/* ── CREATE RACE ── */}
      {mode === 'create' && (
        <div className="card w-full max-w-sm">
          <h2 className="font-display text-xl text-accent tracking-wider mb-4">CREATE RACE</h2>
          <input
            className="input-field"
            placeholder="Race name..."
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
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
          <button onClick={handleCreate} disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Create'}
          </button>
          <button onClick={() => { setMode(null); setError(''); }} className="btn-ghost mt-2">Back</button>
        </div>
      )}

      {/* ── JOIN RACE — Step 1: Code ── */}
      {mode === 'join' && joinStep === 'code' && (
        <div className="card w-full max-w-sm">
          <h2 className="font-display text-xl text-accent tracking-wider mb-4">JOIN RACE</h2>
          <input
            className="input-field"
            placeholder="Race code..."
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            onKeyDown={e => e.key === 'Enter' && handleValidateCode()}
          />
          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <button onClick={handleValidateCode} disabled={loading} className="btn-primary">
            {loading ? 'Checking...' : 'Next'}
          </button>
          <button onClick={() => { setMode(null); setError(''); }} className="btn-ghost mt-2">Back</button>
        </div>
      )}

      {/* ── JOIN RACE — Step 2: Team Setup ── */}
      {mode === 'join' && joinStep === 'team' && raceToJoin && (
        <div className="card w-full max-w-sm">
          <h2 className="font-display text-xl text-accent tracking-wider mb-1">JOIN RACE</h2>
          <p className="text-text-dim text-xs mb-4">{raceToJoin.name} · {raceToJoin.city || 'Race'}</p>

          {/* Solo vs Duo toggle */}
          {!joinExisting && (
            <>
              <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">How are you playing?</label>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setTeamMode('solo')}
                  className={`flex-1 py-3 rounded-xl text-center border cursor-pointer transition-all ${
                    teamMode === 'solo' ? 'border-accent bg-accent/10' : 'border-border bg-surface'
                  }`}>
                  <div className="text-2xl mb-1">🏃</div>
                  <div className={`text-sm font-bold ${teamMode === 'solo' ? 'text-accent' : 'text-text-dim'}`}>Solo</div>
                  <div className="text-[10px] text-text-muted">Just me</div>
                </button>
                <button onClick={() => setTeamMode('duo')}
                  className={`flex-1 py-3 rounded-xl text-center border cursor-pointer transition-all ${
                    teamMode === 'duo' ? 'border-accent bg-accent/10' : 'border-border bg-surface'
                  }`}>
                  <div className="text-2xl mb-1">👥</div>
                  <div className={`text-sm font-bold ${teamMode === 'duo' ? 'text-accent' : 'text-text-dim'}`}>With a Teammate</div>
                  <div className="text-[10px] text-text-muted">2 phones, 1 team</div>
                </button>
              </div>
            </>
          )}

          {/* Player name */}
          <input className="input-field" placeholder="Your name..." value={playerName}
            onChange={e => setPlayerName(e.target.value)} />

          {/* Team name (new team) */}
          {teamMode === 'duo' && !joinExisting && (
            <input className="input-field" placeholder="Team name..." value={teamName}
              onChange={e => setTeamName(e.target.value)} />
          )}

          {/* Join existing duo team option */}
          {teamMode === 'duo' && existingTeams.length > 0 && !joinExisting && (
            <button onClick={() => setJoinExisting(true)}
              className="text-xs text-accent underline cursor-pointer mb-3 block">
              Or join your teammate's existing team →
            </button>
          )}

          {/* Existing team picker */}
          {joinExisting && (
            <div className="mb-3">
              <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Pick your team</label>
              {existingTeams.map(t => (
                <button key={t.id} onClick={() => setSelectedTeamId(t.id)}
                  className={`w-full p-3 rounded-xl border mb-2 text-left cursor-pointer transition-all ${
                    selectedTeamId === t.id ? 'border-accent bg-accent/10' : 'border-border bg-surface'
                  }`}>
                  <p className={`font-semibold text-sm ${selectedTeamId === t.id ? 'text-accent' : 'text-text-primary'}`}>
                    👥 {t.name}
                  </p>
                </button>
              ))}
              <button onClick={() => { setJoinExisting(false); setSelectedTeamId(''); }}
                className="text-xs text-text-dim underline cursor-pointer">
                ← Create a new team instead
              </button>
            </div>
          )}

          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <button onClick={handleJoinTeam} disabled={loading || (!playerName.trim() && teamMode === 'solo') || (joinExisting && !selectedTeamId)}
            className="btn-primary">
            {loading ? 'Joining...' : joinExisting ? 'Join Team' : teamMode === 'duo' ? 'Create Team & Join' : 'Join Race'}
          </button>
          <button onClick={() => { setJoinStep('code'); setError(''); setJoinExisting(false); }} className="btn-ghost mt-2">Back</button>
        </div>
      )}

      {/* ── SOLO EXPLORER ── */}
      {mode === 'explore' && (
        <div className="card w-full max-w-sm">
          <h2 className="font-display text-xl text-accent tracking-wider mb-1">🧭 EXPLORE SOLO</h2>
          <p className="text-text-dim text-xs mb-4">Pick a city and go. No host needed.</p>

          <input className="input-field" placeholder="City name..." value={exploreCity}
            onChange={e => setExploreCity(e.target.value)} />

          <div className="flex flex-wrap gap-2 mb-4">
            {EXPLORE_PRESETS.map(p => (
              <button key={p.city} onClick={() => setExploreCity(p.city)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide border cursor-pointer transition-all ${
                  exploreCity === p.city ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-transparent text-text-dim'
                }`}>{p.label}</button>
            ))}
          </div>

          {/* Difficulty */}
          <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Difficulty</label>
          <div className="flex gap-2 mb-4">
            {['easy', 'medium', 'hard'].map(d => (
              <button key={d} onClick={() => setExploreDifficulty(d)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border cursor-pointer transition-all capitalize ${
                  exploreDifficulty === d ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-text-dim'
                }`}>{d === 'easy' ? '😊' : d === 'medium' ? '💪' : '🔥'} {d}</button>
            ))}
          </div>

          {/* Radius slider */}
          <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-2">Radius</label>
          <div className="flex items-center gap-3 mb-4">
            <input type="range" min={0.5} max={10} step={0.5}
              value={exploreRadius / 1.609}
              onChange={e => setExploreRadius(Math.round(parseFloat(e.target.value) * 1.609 * 10) / 10)}
              className="flex-1 h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent" />
            <span className="text-sm font-bold text-accent min-w-[50px] text-right">
              {(exploreRadius / 1.609).toFixed(1)} mi
            </span>
          </div>

          {/* Progress */}
          {exploring && (
            <div className="mb-3 animate-fade-in">
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-purple to-accent transition-all duration-500"
                  style={{ width: `${exploreProgress}%` }} />
              </div>
              <p className="text-xs text-text-dim text-center mt-2 animate-pulse">Building your adventure…</p>
            </div>
          )}

          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <button onClick={handleExplore} disabled={exploring || !exploreCity.trim()}
            className="w-full px-6 py-3 bg-gradient-to-br from-purple to-purple/70 text-white font-bold rounded-xl text-[15px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
            {exploring ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</>
            ) : '🧭 Start Exploring'}
          </button>
          <button onClick={() => { setMode(null); setError(''); }} className="btn-ghost mt-2">Back</button>
        </div>
      )}
    </div>
  );
}
