'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { generateCode } from '@/lib/utils';
import AdminView from '@/components/admin/AdminView';
import PlayerView from '@/components/player/PlayerView';

type Session = {
  raceId: string;
  role: 'admin' | 'player';
  teamId?: string;
};

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<null | 'create' | 'join'>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const raceCode = generateCode();
    const { data, error: err } = await supabase
      .from('races')
      .insert({ name: name.trim(), code: raceCode, status: 'setup', city: '', boundary: [] })
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

  const handleJoin = async () => {
    if (!code.trim() || !teamName.trim()) return;
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

    const { data: team, error: err } = await supabase
      .from('teams')
      .insert({ race_id: race.id, name: teamName.trim() })
      .select()
      .single();

    if (err || !team) {
      setError(err?.message || 'Failed to join');
      setLoading(false);
      return;
    }

    setSession({ raceId: race.id, role: 'player', teamId: team.id });
    setLoading(false);
  };

  const logout = () => setSession(null);

  if (session?.role === 'admin') {
    return <AdminView raceId={session.raceId} onExit={logout} />;
  }
  if (session?.role === 'player' && session.teamId) {
    return <PlayerView raceId={session.raceId} teamId={session.teamId} onExit={logout} />;
  }

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

      {!mode && (
        <div className="w-full max-w-sm flex flex-col gap-3">
          <button onClick={() => setMode('create')} className="btn-primary">
            Create a Race
          </button>
          <button onClick={() => setMode('join')} className="btn-secondary">
            Join a Race
          </button>
        </div>
      )}

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
          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <button onClick={handleCreate} disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Create'}
          </button>
          <button onClick={() => { setMode(null); setError(''); }} className="btn-ghost mt-2">
            Back
          </button>
        </div>
      )}

      {mode === 'join' && (
        <div className="card w-full max-w-sm">
          <h2 className="font-display text-xl text-accent tracking-wider mb-4">JOIN RACE</h2>
          <input
            className="input-field"
            placeholder="Race code..."
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <input
            className="input-field"
            placeholder="Your team name..."
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />
          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <button onClick={handleJoin} disabled={loading} className="btn-primary">
            {loading ? 'Joining...' : 'Join Race'}
          </button>
          <button onClick={() => { setMode(null); setError(''); }} className="btn-ghost mt-2">
            Back
          </button>
        </div>
      )}
    </div>
  );
}
