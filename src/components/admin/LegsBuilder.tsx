'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type Props = {
  raceId: string;
};

const CHECKPOINT_TYPES = [
  { value: 'challenge', icon: '🏁', label: 'Challenge', desc: 'A task at the location — take a photo, find something, answer a question.' },
  { value: 'detour', icon: '🔀', label: 'Detour', desc: 'Players choose between two different tasks. Great for variety.' },
  { value: 'roadblock', icon: '🚧', label: 'Roadblock', desc: 'One team member goes solo — they commit before seeing the full task.' },
  { value: 'pitstop', icon: '🏁', label: 'Pit Stop', desc: 'Rest point at the end of a leg. A scenic spot to celebrate.' },
];

const CLUE_TYPES = [
  { value: 'text', icon: '📜', label: 'Text Clue', desc: 'A written hint describing the location.' },
  { value: 'sliding', icon: '🧩', label: 'Sliding Puzzle', desc: 'Players rearrange tiles to reveal a hint word.' },
  { value: 'wordsearch', icon: '🔤', label: 'Word Search', desc: 'Players find a hidden word in a grid.' },
  { value: 'cipher', icon: '🔐', label: 'Cipher', desc: 'Letters are shifted — players decode the hint.' },
  { value: 'unscramble', icon: '🔀', label: 'Unscramble', desc: 'Jumbled letters players rearrange.' },
  { value: 'emoji', icon: '🖼️', label: 'Emoji Riddle', desc: 'Emojis represent the location — players guess.' },
];

export default function LegsBuilder({ raceId }: Props) {
  const [legs, setLegs] = useState<any[]>([]);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [expandedLeg, setExpandedLeg] = useState<string | null>(null);
  const [expandedCp, setExpandedCp] = useState<string | null>(null);
  const [addingCpToLeg, setAddingCpToLeg] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const legNameRef = useRef<HTMLInputElement>(null);
  const [editingLegName, setEditingLegName] = useState<{ id: string; name: string } | null>(null);

  const fetchData = async () => {
    const [l, c] = await Promise.all([
      supabase.from('legs').select().eq('race_id', raceId).order('order_num'),
      supabase.from('checkpoints').select().order('order_num'),
    ]);
    if (l.data) setLegs(l.data);
    if (c.data) {
      const legIds = (l.data || []).map((x: any) => x.id);
      setCheckpoints(c.data.filter((cp: any) => legIds.includes(cp.leg_id)));
    }
    if (l.data && l.data.length > 0) setShowGuide(false);
  };

  useEffect(() => { fetchData(); }, [raceId]);

  const addLeg = async () => {
    const num = legs.length;
    const { data } = await supabase.from('legs').insert({
      race_id: raceId, name: `Leg ${num + 1}`, order_num: num,
    }).select().single();
    if (data) { await fetchData(); setExpandedLeg(data.id); }
  };

  const deleteLeg = async (legId: string) => {
    await supabase.from('checkpoints').delete().eq('leg_id', legId);
    await supabase.from('legs').delete().eq('id', legId);
    fetchData();
  };

  const saveLegName = async () => {
    if (!editingLegName) return;
    await supabase.from('legs').update({ name: editingLegName.name }).eq('id', editingLegName.id);
    setEditingLegName(null);
    fetchData();
  };

  const addCheckpoint = async (legId: string, type: string) => {
    const legCps = checkpoints.filter(cp => cp.leg_id === legId);
    await supabase.from('checkpoints').insert({
      leg_id: legId, name: `New ${type}`, type, order_num: legCps.length,
      description: '', clue_text: '', clue_type: 'text', location_answer: '',
      fun_fact: '', answer: '', roadblock_hint: '',
      detour_option_a_title: '', detour_option_a_desc: '',
      detour_option_b_title: '', detour_option_b_desc: '',
      emoji_clue: '', requires_approval: false,
    });
    setAddingCpToLeg(null);
    fetchData();
  };

  const updateCheckpoint = async (cpId: string, updates: any) => {
    await supabase.from('checkpoints').update(updates).eq('id', cpId);
    fetchData();
  };

  const deleteCheckpoint = async (cpId: string) => {
    await supabase.from('checkpoints').delete().eq('id', cpId);
    fetchData();
  };

  const getLegCps = (legId: string) => checkpoints.filter(cp => cp.leg_id === legId).sort((a, b) => a.order_num - b.order_num);

  return (
    <div className="animate-fade-in">
      {/* Onboarding Guide */}
      {showGuide && (
        <div className="card !border-accent/20 mb-4 animate-fade-in">
          <h3 className="font-display text-lg text-accent tracking-wider mb-2">BUILD YOUR ADVENTURE</h3>
          <p className="text-sm text-text-dim leading-relaxed mb-3">
            Your adventure is built from <strong className="text-text-primary">legs</strong> and <strong className="text-text-primary">checkpoints</strong>. Here's what that means:
          </p>
          <div className="space-y-2 mb-4">
            <div className="flex items-start gap-3 bg-surface/60 rounded-lg p-3">
              <span className="text-lg">📍</span>
              <div>
                <p className="text-sm font-bold text-text-primary">Legs = Areas</p>
                <p className="text-xs text-text-dim">Each leg is a section of your adventure, usually in one neighborhood or area. Think of it as a chapter.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-surface/60 rounded-lg p-3">
              <span className="text-lg">🏁</span>
              <div>
                <p className="text-sm font-bold text-text-primary">Checkpoints = Stops</p>
                <p className="text-xs text-text-dim">Each leg has several checkpoints — places players visit. At each stop they get a clue, verify the location, do a challenge, and learn a fun fact.</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-text-dim mb-3">
            <strong className="text-text-primary">Recommended structure:</strong> 2-4 legs, each with 3-5 checkpoints. End every leg with a Pit Stop.
          </p>
          <div className="flex gap-2">
            <button onClick={addLeg} className="btn-primary flex-1">Create your first leg →</button>
            <button onClick={() => setShowGuide(false)} className="btn-ghost !w-auto px-4">Got it</button>
          </div>
        </div>
      )}

      {/* Tip bar (shown after first leg) */}
      {!showGuide && legs.length > 0 && legs.length < 2 && (
        <div className="bg-accent/5 border border-accent/15 rounded-xl p-3 mb-4 flex items-start gap-2">
          <span className="text-sm">💡</span>
          <p className="text-xs text-text-dim">
            <strong className="text-accent">Tip:</strong> Add checkpoints to your leg, then create more legs. End each leg with a Pit Stop for the best experience.
          </p>
        </div>
      )}

      {/* Legs List */}
      {legs.map((leg, legIdx) => {
        const legCps = getLegCps(leg.id);
        const isOpen = expandedLeg === leg.id;
        const hasPitstop = legCps.some(cp => cp.type === 'pitstop');

        return (
          <div key={leg.id} className="mb-3">
            <div className={`card !mb-0 transition-all ${isOpen ? '!border-accent/30' : ''}`}>
              {/* Leg header */}
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedLeg(isOpen ? null : leg.id)}>
                <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-display shrink-0">{legIdx + 1}</div>
                <div className="flex-1 min-w-0">
                  {editingLegName?.id === leg.id ? (
                    <input className="input-field !mb-0 !py-1 !text-sm font-bold" value={editingLegName.name}
                      onChange={e => setEditingLegName({ ...editingLegName, name: e.target.value })}
                      onBlur={saveLegName} onKeyDown={e => e.key === 'Enter' && saveLegName()}
                      onClick={e => e.stopPropagation()} autoFocus />
                  ) : (
                    <p className="font-bold text-[15px] truncate">{leg.name}</p>
                  )}
                  <p className="text-xs text-text-dim">{legCps.length} checkpoint{legCps.length !== 1 ? 's' : ''}{!hasPitstop && legCps.length > 0 ? ' · ⚠️ No pit stop' : ''}</p>
                </div>
                <span className={`text-text-muted text-lg transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>

              {/* Expanded leg content */}
              {isOpen && (
                <div className="mt-3 pt-3 border-t border-border animate-fade-in">
                  {/* Rename / Delete */}
                  <div className="flex gap-2 mb-3">
                    <button onClick={(e) => { e.stopPropagation(); setEditingLegName({ id: leg.id, name: leg.name }); }}
                      className="btn-sm text-xs flex-1">✏️ Rename</button>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this leg and all its checkpoints?')) deleteLeg(leg.id); }}
                      className="btn-danger !px-3 text-xs">🗑</button>
                  </div>

                  {/* Checkpoints */}
                  {legCps.length === 0 && (
                    <div className="bg-surface/40 border border-dashed border-border rounded-xl p-4 text-center mb-3">
                      <p className="text-sm text-text-dim mb-1">No checkpoints yet</p>
                      <p className="text-xs text-text-muted">Add your first checkpoint below</p>
                    </div>
                  )}

                  {legCps.map((cp, cpIdx) => {
                    const isExpanded = expandedCp === cp.id;
                    const typeInfo = CHECKPOINT_TYPES.find(t => t.value === cp.type) || CHECKPOINT_TYPES[0];

                    return (
                      <div key={cp.id} className={`border rounded-xl mb-2 transition-all ${isExpanded ? 'border-accent/30 bg-card/50' : 'border-border/50 bg-surface/30'}`}>
                        <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setExpandedCp(isExpanded ? null : cp.id)}>
                          <span className="text-lg">{typeInfo.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{cp.name || `${typeInfo.label} ${cpIdx + 1}`}</p>
                            <p className="text-[10px] text-text-muted">{typeInfo.label}</p>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); deleteCheckpoint(cp.id); }}
                            className="text-text-muted hover:text-danger text-xs p-1 cursor-pointer">✕</button>
                        </div>

                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-border/30 pt-3 animate-fade-in">
                            {/* Name */}
                            <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1">Name</label>
                            <input className="input-field !text-sm" value={cp.name} placeholder="Checkpoint name..."
                              onChange={e => updateCheckpoint(cp.id, { name: e.target.value })} />

                            {/* Clue */}
                            <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1">
                              Clue <span className="text-text-muted font-normal">— how players discover this location</span>
                            </label>
                            <select className="input-field !text-sm" value={cp.clue_type}
                              onChange={e => updateCheckpoint(cp.id, { clue_type: e.target.value })}>
                              {CLUE_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.icon} {ct.label}</option>)}
                            </select>
                            <textarea className="input-field !text-sm resize-none" rows={2}
                              value={cp.clue_text} placeholder="Write a clue that hints at this location without naming it..."
                              onChange={e => updateCheckpoint(cp.id, { clue_text: e.target.value })} />
                            {cp.clue_type !== 'text' && (
                              <input className="input-field !text-sm" value={cp.answer}
                                placeholder={cp.clue_type === 'emoji' ? 'Location name (answer)' : 'Hint word for puzzle (5-8 letters)'}
                                onChange={e => updateCheckpoint(cp.id, { answer: e.target.value })} />
                            )}
                            {cp.clue_type === 'emoji' && (
                              <input className="input-field !text-sm" value={cp.emoji_clue}
                                placeholder="Emoji sequence (e.g. 🗽🔥📗)"
                                onChange={e => updateCheckpoint(cp.id, { emoji_clue: e.target.value })} />
                            )}

                            {/* Location Answer */}
                            <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1">
                              Location Answer <span className="text-text-muted font-normal">— what players type to verify</span>
                            </label>
                            <input className="input-field !text-sm" value={cp.location_answer}
                              placeholder="e.g. Central Park, Wall Street..."
                              onChange={e => updateCheckpoint(cp.id, { location_answer: e.target.value })} />

                            {/* Challenge Description */}
                            <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1">
                              {cp.type === 'pitstop' ? 'Arrival Message' : 'Challenge'} <span className="text-text-muted font-normal">— what to do at this location</span>
                            </label>
                            <textarea className="input-field !text-sm resize-none" rows={2}
                              value={cp.description}
                              placeholder={cp.type === 'pitstop' ? 'e.g. You made it! Rest and enjoy the view.' : 'e.g. Take a photo with the statue, find the hidden plaque...'}
                              onChange={e => updateCheckpoint(cp.id, { description: e.target.value })} />

                            {/* Detour options */}
                            {cp.type === 'detour' && (
                              <div className="bg-surface/40 border border-border/40 rounded-xl p-3 mb-3">
                                <p className="text-[10px] text-info uppercase tracking-[2px] font-bold mb-2">🔀 Detour Options</p>
                                <input className="input-field !text-sm" value={cp.detour_option_a_title} placeholder="Option A title (e.g. Taste)"
                                  onChange={e => updateCheckpoint(cp.id, { detour_option_a_title: e.target.value })} />
                                <textarea className="input-field !text-sm resize-none" rows={2} value={cp.detour_option_a_desc} placeholder="Option A description..."
                                  onChange={e => updateCheckpoint(cp.id, { detour_option_a_desc: e.target.value })} />
                                <input className="input-field !text-sm" value={cp.detour_option_b_title} placeholder="Option B title (e.g. Trace)"
                                  onChange={e => updateCheckpoint(cp.id, { detour_option_b_title: e.target.value })} />
                                <textarea className="input-field !text-sm resize-none" rows={2} value={cp.detour_option_b_desc} placeholder="Option B description..."
                                  onChange={e => updateCheckpoint(cp.id, { detour_option_b_desc: e.target.value })} />
                              </div>
                            )}

                            {/* Roadblock hint */}
                            {cp.type === 'roadblock' && (
                              <div className="mb-3">
                                <label className="text-[10px] text-danger uppercase tracking-[2px] font-bold block mb-1">
                                  🚧 Cryptic Hint <span className="text-text-muted font-normal">— shown before they commit</span>
                                </label>
                                <input className="input-field !text-sm" value={cp.roadblock_hint}
                                  placeholder='e.g. "Who has the better sense of direction?"'
                                  onChange={e => updateCheckpoint(cp.id, { roadblock_hint: e.target.value })} />
                              </div>
                            )}

                            {/* Fun Fact */}
                            <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1">
                              Fun Fact <span className="text-text-muted font-normal">— shown after completing</span>
                            </label>
                            <textarea className="input-field !text-sm resize-none" rows={2}
                              value={cp.fun_fact} placeholder="An interesting fact about this location..."
                              onChange={e => updateCheckpoint(cp.id, { fun_fact: e.target.value })} />

                            {/* Coordinates */}
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1">Lat</label>
                                <input className="input-field !text-sm" type="number" step="any" value={cp.lat || ''}
                                  placeholder="40.7128" onChange={e => updateCheckpoint(cp.id, { lat: parseFloat(e.target.value) || null })} />
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1">Lng</label>
                                <input className="input-field !text-sm" type="number" step="any" value={cp.lng || ''}
                                  placeholder="-74.006" onChange={e => updateCheckpoint(cp.id, { lng: parseFloat(e.target.value) || null })} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add checkpoint */}
                  {addingCpToLeg === leg.id ? (
                    <div className="animate-fade-in">
                      <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-2">What type of checkpoint?</p>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {CHECKPOINT_TYPES.map(t => (
                          <button key={t.value} onClick={() => addCheckpoint(leg.id, t.value)}
                            className="p-3 rounded-xl border border-border bg-surface hover:border-accent/30 text-left cursor-pointer transition-all">
                            <span className="text-lg">{t.icon}</span>
                            <p className="text-xs font-bold text-text-primary mt-1">{t.label}</p>
                            <p className="text-[10px] text-text-muted mt-0.5">{t.desc}</p>
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setAddingCpToLeg(null)} className="text-xs text-text-dim cursor-pointer bg-transparent border-none">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingCpToLeg(leg.id)}
                      className="w-full py-2.5 rounded-xl border border-dashed border-border text-text-dim text-sm font-semibold cursor-pointer hover:border-accent/30 hover:text-accent transition-all bg-transparent">
                      + Add Checkpoint
                    </button>
                  )}

                  {/* Pit stop reminder */}
                  {!hasPitstop && legCps.length >= 2 && (
                    <div className="mt-2 bg-success/5 border border-success/20 rounded-xl p-3 flex items-start gap-2">
                      <span>💡</span>
                      <div>
                        <p className="text-xs text-text-dim">Don't forget to add a <strong className="text-success">Pit Stop</strong> at the end of this leg!</p>
                        <button onClick={() => addCheckpoint(leg.id, 'pitstop')}
                          className="text-xs text-success font-semibold cursor-pointer bg-transparent border-none mt-1">+ Add Pit Stop</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add Leg button */}
      {!showGuide && (
        <button onClick={addLeg}
          className="w-full py-3 rounded-xl border-2 border-dashed border-border text-text-dim font-semibold cursor-pointer hover:border-accent/30 hover:text-accent transition-all bg-transparent text-sm">
          + Add Another Leg
        </button>
      )}
    </div>
  );
}
