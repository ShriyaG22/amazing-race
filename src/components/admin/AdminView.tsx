'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import AIGenerator from '@/components/admin/AIGenerator';
import LegsBuilder from '@/components/admin/LegsBuilder';

type Props = {
  raceId: string;
  onExit: () => void;
};

export default function AdminView({ raceId, onExit }: Props) {
  const [race, setRace] = useState<any>(null);
  const [legs, setLegs] = useState<any[]>([]);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [tab, setTab] = useState<'legs' | 'teams' | 'board' | 'review'>('legs');
  const [buildMode, setBuildMode] = useState<'build' | 'ai'>('ai');

  const fetchData = async () => {
    const [r, l, c, t, p] = await Promise.all([
      supabase.from('races').select().eq('id', raceId).single(),
      supabase.from('legs').select().eq('race_id', raceId).order('order_num'),
      supabase.from('checkpoints').select().order('order_num'),
      supabase.from('teams').select().eq('race_id', raceId).order('joined_at'),
      supabase.from('progress').select(),
    ]);
    if (r.data) setRace(r.data);
    if (l.data) setLegs(l.data);
    if (c.data) {
      const legIds = (l.data || []).map((x: any) => x.id);
      setCheckpoints(c.data.filter((cp: any) => legIds.includes(cp.leg_id)));
    }
    if (t.data) setTeams(t.data);
    if (p.data) setProgress(p.data);
  };

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 4000); return () => clearInterval(iv); }, [raceId]);

  const startRace = async () => {
    await supabase.from('races').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', raceId);
    fetchData();
  };

  const endRace = async () => {
    if (!confirm('End the race? This cannot be undone.')) return;
    await supabase.from('races').update({ status: 'finished' }).eq('id', raceId);
    fetchData();
  };

  const toggleAdminPlaying = async () => {
    if (!race) return;
    await supabase.from('races').update({ admin_playing: !race.admin_playing }).eq('id', raceId);
    fetchData();
  };

  const approveSubmission = async (progressId: string) => {
    await supabase.from('progress').update({ status: 'complete', reviewed_at: new Date().toISOString() }).eq('id', progressId);
    fetchData();
  };

  const rejectSubmission = async (progressId: string) => {
    await supabase.from('progress').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', progressId);
    fetchData();
  };

  if (!race) return <div className="min-h-screen flex items-center justify-center"><p className="text-text-dim animate-pulse">Loading...</p></div>;

  const totalCps = checkpoints.length;
  const minigames = checkpoints.filter(cp => cp.clue_type && cp.clue_type !== 'text').length;
  const detours = checkpoints.filter(cp => cp.type === 'detour').length;
  const pitstops = checkpoints.filter(cp => cp.type === 'pitstop').length;
  const pendingReviews = progress.filter(p => p.status === 'pending');

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-[10px] text-text-dim tracking-[3px] uppercase">Admin</p>
          <h1 className="font-display text-2xl text-accent tracking-wider">{race.name}</h1>
        </div>
        <button onClick={onExit} className="btn-sm !py-1.5 !px-3 text-xs">Exit</button>
      </div>

      {/* Join Code */}
      <div className="card flex items-center justify-between">
        <div>
          <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold">Join Code</p>
          <p className="font-mono text-2xl text-accent tracking-[4px] font-bold">{race.code}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigator.clipboard?.writeText(race.code)} className="btn-sm text-xs">Copy</button>
          {race.status === 'setup' && legs.length > 0 && (
            <button onClick={startRace} className="btn-success !py-1.5 !px-3 text-xs">Start Race</button>
          )}
          {race.status === 'active' && (
            <button onClick={endRace} className="btn-danger !py-1.5 !px-3 text-xs">End Race</button>
          )}
        </div>
      </div>

      {/* Status badges */}
      <div className="flex gap-2 mb-3">
        <span className={`badge ${race.status === 'active' ? 'bg-success/20 text-success' : race.status === 'finished' ? 'bg-text-muted/20 text-text-muted' : 'bg-accent/20 text-accent'}`}>
          {race.status.toUpperCase()}
        </span>
        {race.city && <span className="badge bg-purple/20 text-purple">{race.city}</span>}
      </div>

      {/* Playing too toggle */}
      <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-3 mb-4">
        <div>
          <p className="text-sm font-semibold">Playing too?</p>
          <p className="text-[10px] text-text-dim">{race.admin_playing ? 'Auto-advance. Review later.' : 'Review submissions live.'}</p>
        </div>
        <button onClick={toggleAdminPlaying}
          className={`relative w-11 h-6 rounded-full transition-all cursor-pointer shrink-0 ${race.admin_playing ? 'bg-success' : 'bg-border'}`}>
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${race.admin_playing ? 'left-[21px]' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        {[
          { id: 'legs', label: 'Legs' },
          { id: 'teams', label: `Teams (${teams.length})` },
          { id: 'board', label: 'Board' },
          { id: 'review', label: `Review${pendingReviews.length > 0 ? ` (${pendingReviews.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={`tab ${tab === t.id ? 'tab-active' : 'tab-inactive'}`}>{t.label}</button>
        ))}
      </div>

      {/* ── LEGS TAB ── */}
      {tab === 'legs' && (
        <div>
          {/* Build / AI toggle */}
          <div className="flex gap-2 mb-4">
            <button onClick={() => setBuildMode('build')}
              className={`flex-1 py-2.5 rounded-xl text-center text-sm font-bold border cursor-pointer transition-all ${
                buildMode === 'build' ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-text-dim'}`}>
              🛠 Build
            </button>
            <button onClick={() => setBuildMode('ai')}
              className={`flex-1 py-2.5 rounded-xl text-center text-sm font-bold border cursor-pointer transition-all ${
                buildMode === 'ai' ? 'border-purple bg-purple/10 text-purple' : 'border-border bg-surface text-text-dim'}`}>
              ✦ AI Generate
            </button>
          </div>

          {/* Stats */}
          {totalCps > 0 && (
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-surface border border-border rounded-lg p-2 text-center">
                <div className="text-lg font-display text-accent">{legs.length}</div>
                <div className="text-[8px] text-text-dim uppercase tracking-wider">Legs</div>
              </div>
              <div className="flex-1 bg-surface border border-border rounded-lg p-2 text-center">
                <div className="text-lg font-display text-accent">{totalCps}</div>
                <div className="text-[8px] text-text-dim uppercase tracking-wider">Stops</div>
              </div>
              <div className="flex-1 bg-surface border border-border rounded-lg p-2 text-center">
                <div className="text-lg font-display text-info">{detours}</div>
                <div className="text-[8px] text-text-dim uppercase tracking-wider">Detours</div>
              </div>
              <div className="flex-1 bg-surface border border-border rounded-lg p-2 text-center">
                <div className="text-lg font-display text-purple">{minigames}</div>
                <div className="text-[8px] text-text-dim uppercase tracking-wider">Puzzles</div>
              </div>
            </div>
          )}

          {buildMode === 'ai' ? (
            <AIGenerator raceId={raceId} onSaved={fetchData} />
          ) : (
            <LegsBuilder raceId={raceId} />
          )}
        </div>
      )}

      {/* ── TEAMS TAB ── */}
      {tab === 'teams' && (
        <div>
          {teams.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">👥</p>
              <p className="text-text-dim text-sm">No teams yet</p>
              <p className="text-text-muted text-xs mt-1">Share the code <span className="text-accent font-mono">{race.code}</span> with players</p>
            </div>
          ) : (
            teams.map(team => {
              const teamProgress = progress.filter(p => p.team_id === team.id && (p.status === 'complete' || p.status === 'pending'));
              const pct = totalCps > 0 ? (teamProgress.length / totalCps) * 100 : 0;
              return (
                <div key={team.id} className="card flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center font-display text-lg shrink-0">
                    {team.mode === 'duo' ? '👥' : '🏃'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{team.name}</p>
                    <div className="h-1 rounded-full bg-border overflow-hidden mt-1.5">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <p className="text-sm font-mono text-text-dim">{teamProgress.length}/{totalCps}</p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── BOARD TAB ── */}
      {tab === 'board' && (
        <div>
          {teams.length === 0 ? (
            <div className="text-center py-12"><p className="text-text-dim text-sm">No teams yet</p></div>
          ) : (
            teams.sort((a, b) => {
              const ap = progress.filter(p => p.team_id === a.id && (p.status === 'complete' || p.status === 'pending')).length;
              const bp = progress.filter(p => p.team_id === b.id && (p.status === 'complete' || p.status === 'pending')).length;
              return bp - ap;
            }).map((team, i) => {
              const tp = progress.filter(p => p.team_id === team.id && (p.status === 'complete' || p.status === 'pending'));
              const pct = totalCps > 0 ? (tp.length / totalCps) * 100 : 0;
              return (
                <div key={team.id} className="card flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-lg shrink-0 ${i === 0 ? 'bg-accent/15 text-accent' : 'bg-surface text-text-muted'}`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{team.name}</p>
                    <div className="h-1 rounded-full bg-border overflow-hidden mt-1"><div className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all" style={{ width: `${pct}%` }} /></div>
                  </div>
                  <p className="text-sm font-mono text-text-dim">{tp.length}/{totalCps}</p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── REVIEW TAB ── */}
      {tab === 'review' && (
        <div>
          {pendingReviews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-text-dim text-sm">No pending reviews</p>
              <p className="text-text-muted text-xs mt-1">{race.admin_playing ? 'You\'re auto-advancing. Reviews will appear here after the race.' : 'Submissions will appear here when players complete checkpoints.'}</p>
            </div>
          ) : (
            pendingReviews.map(p => {
              const team = teams.find(t => t.id === p.team_id);
              const cp = checkpoints.find(c => c.id === p.checkpoint_id);
              return (
                <div key={p.id} className="card animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge bg-accent/15 text-accent">{team?.name || 'Team'}</span>
                    <span className="text-xs text-text-dim">→ {cp?.name || 'Checkpoint'}</span>
                  </div>
                  {p.proof && p.proof.startsWith('data:image') && (
                    <div className="rounded-xl overflow-hidden border border-border mb-3">
                      <img src={p.proof} alt="Proof" className="w-full max-h-[200px] object-cover" />
                    </div>
                  )}
                  {p.proof && !p.proof.startsWith('data:image') && (
                    <p className="text-xs text-text-muted italic mb-2">Submitted: {p.proof}</p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => approveSubmission(p.id)} className="btn-success flex-1 !py-2 text-xs">✓ Approve</button>
                    <button onClick={() => rejectSubmission(p.id)} className="btn-danger flex-1 !py-2 text-xs">✗ Reject</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
