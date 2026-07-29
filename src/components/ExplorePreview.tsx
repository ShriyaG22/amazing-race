'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Race, Leg, Checkpoint } from '@/lib/supabase';

type Props = {
  raceId: string;
  teamId: string;
  onStart: () => void;
  onBack: () => void;
};

const CLUE_ICONS: Record<string, string> = {
  text: '📜',
  sliding: '🧩',
  wordsearch: '🔤',
  simon: '🎮',
};

export default function ExplorePreview({ raceId, teamId, onStart, onBack }: Props) {
  const [race, setRace] = useState<Race | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [expandedLeg, setExpandedLeg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchAll = async () => {
    const [r, l, c] = await Promise.all([
      supabase.from('races').select().eq('id', raceId).single(),
      supabase.from('legs').select().eq('race_id', raceId).order('order_num'),
      supabase.from('checkpoints').select().order('order_num'),
    ]);
    if (r.data) setRace(r.data);
    if (l.data) setLegs(l.data);
    if (c.data) {
      const legIds = (l.data || []).map(x => x.id);
      setCheckpoints(c.data.filter(cp => legIds.includes(cp.leg_id)));
    }
  };

  useEffect(() => { fetchAll(); }, [raceId]);

  const getLegCheckpoints = (legId: string) =>
    checkpoints.filter(cp => cp.leg_id === legId).sort((a, b) => a.order_num - b.order_num);

  const deleteLeg = async (legId: string) => {
    setDeleting(legId);
    await supabase.from('checkpoints').delete().eq('leg_id', legId);
    await supabase.from('legs').delete().eq('id', legId);
    setDeleting(null);
    fetchAll();
  };

  const deleteCheckpoint = async (cpId: string) => {
    await supabase.from('checkpoints').delete().eq('id', cpId);
    fetchAll();
  };

  const totalCheckpoints = checkpoints.length;
  const totalMinigames = checkpoints.filter(cp =>
    cp.clue_type === 'sliding' || cp.clue_type === 'wordsearch' || cp.clue_type === 'simon' || cp.type === 'minigame'
  ).length;

  if (!race) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-text-dim animate-pulse">Loading preview...</p>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-[10px] text-text-dim tracking-[3px] uppercase mb-1">Preview Your Adventure</p>
        <h1 className="font-display text-2xl text-accent tracking-wider">{race.name}</h1>
        <p className="text-xs text-text-dim mt-1">{race.city}</p>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-surface border border-border rounded-xl p-3 text-center">
          <div className="text-xl font-display text-accent">{legs.length}</div>
          <div className="text-[9px] text-text-dim tracking-[2px] uppercase">Legs</div>
        </div>
        <div className="flex-1 bg-surface border border-border rounded-xl p-3 text-center">
          <div className="text-xl font-display text-accent">{totalCheckpoints}</div>
          <div className="text-[9px] text-text-dim tracking-[2px] uppercase">Stops</div>
        </div>
        <div className="flex-1 bg-surface border border-border rounded-xl p-3 text-center">
          <div className="text-xl font-display text-purple">{totalMinigames}</div>
          <div className="text-[9px] text-text-dim tracking-[2px] uppercase">Puzzles</div>
        </div>
      </div>

      {/* Legs List */}
      {legs.map((leg, legIdx) => {
        const legCps = getLegCheckpoints(leg.id);
        const isOpen = expandedLeg === leg.id;

        return (
          <div key={leg.id} className="mb-3 animate-fade-in">
            {legIdx > 0 && (
              <div className="flex justify-center -mb-1 -mt-1">
                <div className="w-0.5 h-3 bg-border" />
              </div>
            )}
            <div className={`card !mb-0 transition-all ${isOpen ? '!border-accent/30' : ''}`}>
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedLeg(isOpen ? null : leg.id)}>
                <div className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-display shrink-0">
                  {legIdx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[15px] truncate">{leg.name}</p>
                  <p className="text-xs text-text-dim">{legCps.length} checkpoint{legCps.length !== 1 ? 's' : ''}</p>
                </div>
                <span className={`text-text-muted text-lg transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>

              {isOpen && (
                <div className="mt-3 pt-3 border-t border-border animate-fade-in">
                  {legCps.map((cp, cpIdx) => (
                    <div key={cp.id} className="flex items-start gap-2 py-2 border-b border-border/30 last:border-none">
                      <span className="text-sm mt-0.5">{CLUE_ICONS[cp.clue_type] || '🏁'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{cp.name}</p>
                        {cp.clue_text && <p className="text-[11px] text-text-dim mt-0.5 italic">Clue: {cp.clue_text.substring(0, 60)}…</p>}
                        {cp.fun_fact && <p className="text-[11px] text-purple mt-0.5">💡 {cp.fun_fact.substring(0, 60)}…</p>}
                        <div className="flex gap-1 mt-1">
                          <span className="badge bg-surface text-text-muted">{cp.type}</span>
                          {cp.clue_type !== 'text' && <span className="badge bg-purple/15 text-purple">{cp.clue_type} puzzle</span>}
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteCheckpoint(cp.id); }}
                        className="text-text-muted hover:text-danger text-xs p-1 cursor-pointer shrink-0">✕</button>
                    </div>
                  ))}
                  <div className="flex justify-end mt-2">
                    <button onClick={() => deleteLeg(leg.id)} disabled={deleting === leg.id}
                      className="text-xs text-danger hover:text-danger/80 cursor-pointer bg-transparent border-none">
                      {deleting === leg.id ? 'Removing...' : 'Remove leg'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Finish line */}
      <div className="text-center py-4">
        <div className="text-2xl">🏁</div>
        <p className="text-[10px] text-text-muted uppercase tracking-wide mt-1">End of adventure</p>
      </div>

      {/* Action buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg/90 backdrop-blur-lg border-t border-border/50 p-4">
        <div className="max-w-lg mx-auto flex gap-2">
          <button onClick={onBack} className="btn-secondary !w-auto px-6 shrink-0">← Back</button>
          <button onClick={onStart}
            className="flex-1 px-6 py-3 bg-gradient-to-br from-purple to-purple/60 text-white font-bold rounded-xl text-[15px] cursor-pointer hover:shadow-lg hover:shadow-purple/20 transition-all active:scale-[0.98]">
            🧭 Start Adventure →
          </button>
        </div>
      </div>
    </div>
  );
}
