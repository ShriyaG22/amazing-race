'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Race, Leg, Checkpoint, Team, Progress } from '@/lib/supabase';

type Props = { raceId: string; onExit: () => void };

export default function AdminView({ raceId, onExit }: Props) {
  const [race, setRace] = useState<Race | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [tab, setTab] = useState<'legs' | 'map' | 'teams' | 'board' | 'review'>('legs');

  const fetchAll = async () => {
    const [r, l, c, t, p] = await Promise.all([
      supabase.from('races').select().eq('id', raceId).single(),
      supabase.from('legs').select().eq('race_id', raceId).order('order_num'),
      supabase.from('checkpoints').select().order('order_num'),
      supabase.from('teams').select().eq('race_id', raceId),
      supabase.from('progress').select(),
    ]);
    if (r.data) setRace(r.data);
    if (l.data) setLegs(l.data);
    if (c.data) {
      const legIds = (l.data || []).map(x => x.id);
      setCheckpoints(c.data.filter(cp => legIds.includes(cp.leg_id)));
    }
    if (t.data) setTeams(t.data);
    if (p.data) {
      const teamIds = (t.data || []).map(x => x.id);
      setProgress(p.data.filter(pr => teamIds.includes(pr.team_id)));
    }
  };

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 4000);
    return () => clearInterval(iv);
  }, [raceId]);

  const pendingCount = progress.filter(p => p.status === 'pending').length;

  if (!race) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-text-dim animate-pulse">Loading race...</p>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <p className="text-[11px] text-text-dim tracking-[3px] uppercase">Admin</p>
          <h1 className="font-display text-2xl text-accent tracking-wider">{race.name}</h1>
        </div>
        <button onClick={onExit} className="btn-sm">Exit</button>
      </div>

      {/* Join Code */}
      <div className="card flex items-center justify-between !p-4">
        <div>
          <p className="text-[11px] text-text-dim uppercase tracking-wide">Join Code</p>
          <p className="font-display text-3xl text-accent tracking-[4px]">{race.code}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-sm" onClick={() => navigator.clipboard?.writeText(race.code)}>
            Copy
          </button>
          {race.status === 'setup' && (
            <button className="btn-success" onClick={async () => {
              await supabase.from('races').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', raceId);
              fetchAll();
            }}>Start Race</button>
          )}
          {race.status === 'active' && (
            <button className="btn-danger" onClick={async () => {
              await supabase.from('races').update({ status: 'finished' }).eq('id', raceId);
              fetchAll();
            }}>End Race</button>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex gap-2 items-center mb-4">
        <span className={`badge ${race.status === 'setup' ? 'bg-info/20 text-info' : race.status === 'active' ? 'bg-success/20 text-success' : 'bg-text-muted/20 text-text-muted'}`}>
          {race.status === 'setup' ? 'Setting Up' : race.status === 'active' ? 'Race Active' : 'Finished'}
        </span>
        {race.city && <span className="badge bg-accent/10 text-accent">{race.city}</span>}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['legs', 'map', 'teams', 'board', 'review'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`tab ${tab === t ? 'tab-active' : 'tab-inactive'}`}>
            {t}{t === 'review' && pendingCount > 0 && (
              <span className="ml-1 bg-danger text-white rounded-full px-1.5 py-0.5 text-[10px]">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {tab === 'legs' && <p className="text-text-dim text-center py-8">Legs builder — coming with deploy</p>}
        {tab === 'map' && <p className="text-text-dim text-center py-8">Map — coming with deploy</p>}
        {tab === 'teams' && (
          <div>
            {teams.length === 0 && <p className="text-text-dim text-center py-8">No teams yet. Share the join code!</p>}
            {teams.map(t => (
              <div key={t.id} className="card flex justify-between items-center">
                <div>
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-xs text-text-dim">Joined {new Date(t.joined_at).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'board' && <p className="text-text-dim text-center py-8">Leaderboard — coming with deploy</p>}
        {tab === 'review' && <p className="text-text-dim text-center py-8">Review — coming with deploy</p>}
      </div>
    </div>
  );
}
