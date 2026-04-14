'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Race, Team } from '@/lib/supabase';

type Props = { raceId: string; teamId: string; onExit: () => void };

export default function PlayerView({ raceId, teamId, onExit }: Props) {
  const [race, setRace] = useState<Race | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [tab, setTab] = useState<'race' | 'map' | 'board'>('race');

  useEffect(() => {
    const fetch = async () => {
      const [r, t] = await Promise.all([
        supabase.from('races').select().eq('id', raceId).single(),
        supabase.from('teams').select().eq('id', teamId).single(),
      ]);
      if (r.data) setRace(r.data);
      if (t.data) setTeam(t.data);
    };
    fetch();
    const iv = setInterval(fetch, 4000);
    return () => clearInterval(iv);
  }, [raceId, teamId]);

  if (!race || !team) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-text-dim animate-pulse">Loading...</p>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center px-4 pt-4">
        <div>
          <p className="text-[10px] text-text-dim tracking-[3px] uppercase">{race.city || 'Race'}</p>
          <h1 className="font-display text-xl text-accent tracking-wider">{team.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${race.status === 'active' ? 'bg-success/20 text-success' : 'bg-text-muted/20 text-text-muted'}`}>
            {race.status === 'active' ? 'LIVE' : race.status === 'finished' ? 'END' : 'WAIT'}
          </span>
          <button onClick={onExit} className="btn-sm !py-1.5 !px-3 text-xs">Exit</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mx-4">
        {(['race', 'map', 'board'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`tab ${tab === t ? 'tab-active' : 'tab-inactive'}`}>
            {t === 'board' ? 'Board' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {tab === 'race' && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <p className="text-5xl mb-4">
                {race.status === 'setup' ? '⏳' : race.status === 'finished' ? '🏁' : '🏃'}
              </p>
              <h2 className="font-display text-2xl text-accent">
                {race.status === 'setup' ? 'WAITING TO START' : race.status === 'finished' ? 'RACE OVER' : 'RACE ON'}
              </h2>
              <p className="text-text-dim text-sm mt-2">
                {race.status === 'setup' ? 'The host is setting things up.' : race.status === 'finished' ? 'Check the leaderboard!' : 'Full race view coming with deploy'}
              </p>
            </div>
          </div>
        )}
        {tab === 'map' && <p className="text-text-dim text-center py-16">Map — coming with deploy</p>}
        {tab === 'board' && <p className="text-text-dim text-center py-16">Leaderboard — coming with deploy</p>}
      </div>
    </div>
  );
}
