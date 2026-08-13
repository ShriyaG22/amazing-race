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
  cipher: '🔐',
  unscramble: '🔀',
};

// Keep in step with the clue types the generator can actually produce.
const PUZZLE_TYPES = ['sliding', 'wordsearch', 'cipher', 'unscramble'];

const TYPE_ICONS: Record<string, string> = {
  challenge: '🏁',
  roadblock: '🚧',
  detour: '🔀',
  pitstop: '🏁',
  minigame: '🧩',
};

const TYPE_COLORS: Record<string, string> = {
  challenge: 'bg-accent/10 text-accent',
  roadblock: 'bg-danger/10 text-danger',
  detour: 'bg-info/10 text-info',
  pitstop: 'bg-success/10 text-success',
  minigame: 'bg-purple/10 text-purple',
};

export default function ExplorePreview({ raceId, teamId, onStart, onBack }: Props) {
  const [race, setRace] = useState<Race | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [expandedLeg, setExpandedLeg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingCp, setEditingCp] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = (cp: any) => {
    setEditingCp(cp.id);
    setDraft({
      name: cp.name || '',
      clue_text: cp.clue_text || '',
      location_answer: cp.location_answer || '',
      description: cp.description || '',
      fun_fact: cp.fun_fact || '',
      detour_option_a_title: cp.detour_option_a_title || '',
      detour_option_a_desc: cp.detour_option_a_desc || '',
      detour_option_b_title: cp.detour_option_b_title || '',
      detour_option_b_desc: cp.detour_option_b_desc || '',
      roadblock_hint: cp.roadblock_hint || '',
    });
  };

  const saveEdit = async (cpId: string) => {
    setSaving(true);
    await supabase.from('checkpoints').update(draft).eq('id', cpId);
    setSaving(false);
    setEditingCp(null);
    fetchAll();
  };

  const renameLeg = async (legId: string, name: string) => {
    await supabase.from('legs').update({ name }).eq('id', legId);
    fetchAll();
  };

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
  // Was only counting sliding/wordsearch/simon, so cipher and unscramble
  // puzzles never appeared in the count — and 'simon' no longer exists.
  const totalPuzzles = checkpoints.filter(cp => PUZZLE_TYPES.includes(cp.clue_type || '')).length;
  const totalDetours = checkpoints.filter(cp => cp.type === 'detour').length;
  const totalPitStops = checkpoints.filter(cp => cp.type === 'pitstop').length;

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
      <div className="flex gap-2 mb-6">
        <div className="flex-1 bg-surface border border-border rounded-xl p-3 text-center">
          <div className="text-xl font-display text-accent">{legs.length}</div>
          <div className="text-[9px] text-text-dim tracking-[2px] uppercase">Legs</div>
        </div>
        <div className="flex-1 bg-surface border border-border rounded-xl p-3 text-center">
          <div className="text-xl font-display text-accent">{totalCheckpoints}</div>
          <div className="text-[9px] text-text-dim tracking-[2px] uppercase">Stops</div>
        </div>
        <div className="flex-1 bg-surface border border-border rounded-xl p-3 text-center">
          <div className="text-xl font-display text-info">{totalDetours}</div>
          <div className="text-[9px] text-text-dim tracking-[2px] uppercase">Detours</div>
        </div>
        <div className="flex-1 bg-surface border border-border rounded-xl p-3 text-center">
          <div className="text-xl font-display text-purple">{totalPuzzles}</div>
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
                  {legCps.map((cp, cpIdx) => editingCp === cp.id ? (
                    <div key={cp.id} className="py-3 border-b border-border/30 last:border-none animate-fade-in">
                      <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-2">Editing stop {cpIdx + 1}</p>

                      <label className="text-[10px] text-text-muted block mb-1">Name</label>
                      <input className="input-field !mb-2 !py-2 !text-sm" value={draft.name}
                        onChange={e => setDraft({ ...draft, name: e.target.value })} />

                      <label className="text-[10px] text-text-muted block mb-1">Location answer (what players type)</label>
                      <input className="input-field !mb-2 !py-2 !text-sm" value={draft.location_answer}
                        onChange={e => setDraft({ ...draft, location_answer: e.target.value })} />

                      <label className="text-[10px] text-text-muted block mb-1">
                        Clue{cp.clue_type !== 'text' ? ' — keep the _____ gap for the puzzle answer' : ''}
                      </label>
                      <textarea className="input-field !mb-2 !py-2 !text-sm resize-none" rows={3} value={draft.clue_text}
                        onChange={e => setDraft({ ...draft, clue_text: e.target.value })} />

                      {cp.type === 'detour' ? (
                        <>
                          <label className="text-[10px] text-text-muted block mb-1">Option A</label>
                          <input className="input-field !mb-1 !py-2 !text-sm" placeholder="Title" value={draft.detour_option_a_title}
                            onChange={e => setDraft({ ...draft, detour_option_a_title: e.target.value })} />
                          <textarea className="input-field !mb-2 !py-2 !text-sm resize-none" rows={2} placeholder="What they do" value={draft.detour_option_a_desc}
                            onChange={e => setDraft({ ...draft, detour_option_a_desc: e.target.value })} />
                          <label className="text-[10px] text-text-muted block mb-1">Option B</label>
                          <input className="input-field !mb-1 !py-2 !text-sm" placeholder="Title" value={draft.detour_option_b_title}
                            onChange={e => setDraft({ ...draft, detour_option_b_title: e.target.value })} />
                          <textarea className="input-field !mb-2 !py-2 !text-sm resize-none" rows={2} placeholder="What they do" value={draft.detour_option_b_desc}
                            onChange={e => setDraft({ ...draft, detour_option_b_desc: e.target.value })} />
                        </>
                      ) : (
                        <>
                          <label className="text-[10px] text-text-muted block mb-1">Challenge</label>
                          <textarea className="input-field !mb-2 !py-2 !text-sm resize-none" rows={2} value={draft.description}
                            onChange={e => setDraft({ ...draft, description: e.target.value })} />
                        </>
                      )}

                      {cp.type === 'roadblock' && (
                        <>
                          <label className="text-[10px] text-text-muted block mb-1">Roadblock hint (seen before committing)</label>
                          <input className="input-field !mb-2 !py-2 !text-sm" value={draft.roadblock_hint}
                            onChange={e => setDraft({ ...draft, roadblock_hint: e.target.value })} />
                        </>
                      )}

                      <label className="text-[10px] text-text-muted block mb-1">Fun fact</label>
                      <textarea className="input-field !mb-3 !py-2 !text-sm resize-none" rows={2} value={draft.fun_fact}
                        onChange={e => setDraft({ ...draft, fun_fact: e.target.value })} />

                      <div className="flex gap-2">
                        <button onClick={() => setEditingCp(null)}
                          className="flex-1 py-2 rounded-lg border border-border text-text-dim text-xs font-semibold cursor-pointer bg-transparent">
                          Cancel
                        </button>
                        <button onClick={() => saveEdit(cp.id)} disabled={saving}
                          className="flex-1 py-2 rounded-lg bg-accent text-bg text-xs font-bold cursor-pointer disabled:opacity-50">
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={cp.id} className={`flex items-start gap-2 py-2.5 border-b border-border/30 last:border-none ${cp.type === 'pitstop' ? 'bg-success/5 -mx-3 px-3 rounded-lg' : ''}`}>
                      <span className="text-lg mt-0.5">{TYPE_ICONS[cp.type] || '🏁'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{cp.name}</p>
                        {cp.clue_text && <p className="text-[11px] text-text-dim mt-0.5 italic">Clue: {cp.clue_text.substring(0, 60)}…</p>}
                        {cp.type === 'detour' && cp.detour_option_a_title && (
                          <div className="flex gap-2 mt-1">
                            <span className="badge bg-info/10 text-info">A: {cp.detour_option_a_title}</span>
                            <span className="badge bg-info/10 text-info">B: {cp.detour_option_b_title}</span>
                          </div>
                        )}
                        {cp.type === 'roadblock' && cp.roadblock_hint && (
                          <p className="text-[11px] text-danger mt-0.5 italic">&quot;{cp.roadblock_hint}&quot;</p>
                        )}
                        {cp.fun_fact && <p className="text-[11px] text-purple mt-0.5">💡 {cp.fun_fact.substring(0, 60)}…</p>}
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <span className={`badge ${TYPE_COLORS[cp.type] || 'bg-surface text-text-muted'}`}>{cp.type}</span>
                          {cp.clue_type !== 'text' && <span className="badge bg-purple/15 text-purple">{CLUE_ICONS[cp.clue_type || ''] || '🧩'} {cp.clue_type}</span>}
                          {(!cp.lat || !cp.lng) && <span className="badge bg-danger/15 text-danger">no location</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); startEdit(cp); }}
                          className="text-text-muted hover:text-accent text-xs p-1 cursor-pointer bg-transparent border-none">✎</button>
                        {cp.type !== 'pitstop' && (
                          <button onClick={(e) => { e.stopPropagation(); deleteCheckpoint(cp.id); }}
                            className="text-text-muted hover:text-danger text-xs p-1 cursor-pointer bg-transparent border-none">✕</button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center mt-2">
                    <button
                      onClick={() => {
                        const next = prompt('Rename this leg', leg.name);
                        if (next && next.trim() && next !== leg.name) renameLeg(leg.id, next.trim());
                      }}
                      className="text-xs text-text-muted hover:text-accent cursor-pointer bg-transparent border-none">
                      Rename leg
                    </button>
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
