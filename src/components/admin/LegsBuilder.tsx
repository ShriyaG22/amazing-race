'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { randomMiniGame, MINI_GAME_TYPES } from '@/lib/utils';
import type { Leg, Checkpoint } from '@/lib/supabase';

type Props = {
  raceId: string;
  legs: Leg[];
  checkpoints: Checkpoint[];
  onRefresh: () => void;
};

const TYPE_ICONS: Record<string, string> = {
  challenge: '🏁',
  roadblock: '🚧',
  minigame: '🧩',
};

const TYPE_COLORS: Record<string, string> = {
  challenge: 'bg-accent/15 text-accent',
  roadblock: 'bg-danger/15 text-danger',
  minigame: 'bg-purple/15 text-purple',
};

export default function LegsBuilder({ raceId, legs, checkpoints, onRefresh }: Props) {
  const [expandedLeg, setExpandedLeg] = useState<string | null>(null);
  const [expandedCp, setExpandedCp] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // ── Leg CRUD ───────────────────────────────────────────────────

  const addLeg = async () => {
    setSaving(true);
    const order = legs.length;
    const { data } = await supabase
      .from('legs')
      .insert({ race_id: raceId, name: `Leg ${order + 1}`, order_num: order })
      .select()
      .single();
    setSaving(false);
    onRefresh();
    if (data) setExpandedLeg(data.id);
  };

  const updateLeg = async (id: string, updates: Partial<Leg>) => {
    await supabase.from('legs').update(updates).eq('id', id);
    onRefresh();
  };

  const deleteLeg = async (id: string) => {
    await supabase.from('legs').delete().eq('id', id);
    if (expandedLeg === id) setExpandedLeg(null);
    onRefresh();
  };

  const reorderLeg = async (from: number, to: number) => {
    if (from === to) return;
    const reordered = [...legs];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    // Batch update order_num
    await Promise.all(
      reordered.map((leg, i) =>
        supabase.from('legs').update({ order_num: i }).eq('id', leg.id)
      )
    );
    onRefresh();
  };

  // ── Checkpoint CRUD ────────────────────────────────────────────

  const addCheckpoint = async (legId: string, type: 'challenge' | 'roadblock' | 'minigame' = 'challenge') => {
    const legCps = checkpoints.filter((c) => c.leg_id === legId);
    const order = legCps.length;
    const isMinigame = type === 'minigame';
    const { data } = await supabase
      .from('checkpoints')
      .insert({
        leg_id: legId,
        name: type === 'challenge' ? 'New Challenge' : type === 'roadblock' ? 'New Roadblock' : 'New Minigame',
        type,
        description: '',
        clue_text: '',
        requires_approval: !isMinigame,
        order_num: order,
        answer: '',
        mini_game_type: isMinigame ? randomMiniGame() : '',
      })
      .select()
      .single();
    onRefresh();
    if (data) setExpandedCp(data.id);
  };

  const updateCheckpoint = async (id: string, updates: Partial<Checkpoint>) => {
    await supabase.from('checkpoints').update(updates).eq('id', id);
    onRefresh();
  };

  const deleteCheckpoint = async (id: string) => {
    await supabase.from('checkpoints').delete().eq('id', id);
    if (expandedCp === id) setExpandedCp(null);
    onRefresh();
  };

  const reorderCheckpoint = async (legId: string, from: number, to: number) => {
    if (from === to) return;
    const legCps = checkpoints.filter((c) => c.leg_id === legId).sort((a, b) => a.order_num - b.order_num);
    const [moved] = legCps.splice(from, 1);
    legCps.splice(to, 0, moved);
    await Promise.all(
      legCps.map((cp, i) => supabase.from('checkpoints').update({ order_num: i }).eq('id', cp.id))
    );
    onRefresh();
  };

  // ── Render ─────────────────────────────────────────────────────

  const getLegCheckpoints = (legId: string) =>
    checkpoints.filter((c) => c.leg_id === legId).sort((a, b) => a.order_num - b.order_num);

  return (
    <div>
      {/* Stats Bar */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-surface border border-border rounded-xl p-3 text-center">
          <div className="text-2xl font-display text-accent">{legs.length}</div>
          <div className="text-[10px] text-text-dim tracking-[2px] uppercase">Legs</div>
        </div>
        <div className="flex-1 bg-surface border border-border rounded-xl p-3 text-center">
          <div className="text-2xl font-display text-accent">{checkpoints.length}</div>
          <div className="text-[10px] text-text-dim tracking-[2px] uppercase">Checkpoints</div>
        </div>
        <div className="flex-1 bg-surface border border-border rounded-xl p-3 text-center">
          <div className="text-2xl font-display text-purple">{checkpoints.filter((c) => c.type === 'minigame').length}</div>
          <div className="text-[10px] text-text-dim tracking-[2px] uppercase">Minigames</div>
        </div>
      </div>

      {/* Legs List */}
      {legs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🗺️</p>
          <p className="text-text-dim text-sm">No legs yet. Add one or use AI to generate.</p>
        </div>
      )}

      {legs.map((leg, legIdx) => {
        const isOpen = expandedLeg === leg.id;
        const legCps = getLegCheckpoints(leg.id);

        return (
          <div key={leg.id} className="mb-3 animate-fade-in">
            {/* Leg connector line */}
            {legIdx > 0 && (
              <div className="flex justify-center -mb-1 -mt-1">
                <div className="w-0.5 h-4 bg-border" />
              </div>
            )}

            <div className={`card !mb-0 transition-all ${isOpen ? '!border-accent/30' : ''}`}>
              {/* Leg Header */}
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setExpandedLeg(isOpen ? null : leg.id)}
              >
                {/* Drag Handle */}
                <span
                  className="text-text-muted text-lg cursor-grab select-none hover:text-text-dim"
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setDragIdx(legIdx);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIdx !== null) {
                      reorderLeg(dragIdx, legIdx);
                      setDragIdx(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  ⠿
                </span>

                {/* Leg Number Circle */}
                <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-display shrink-0">
                  {legIdx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[15px] truncate">{leg.name || 'Untitled Leg'}</p>
                  <p className="text-xs text-text-dim">
                    {legCps.length} checkpoint{legCps.length !== 1 ? 's' : ''}
                    {legCps.some((c) => c.type === 'minigame') && ' · 🧩 has minigame'}
                  </p>
                </div>

                <span className={`text-text-muted text-lg transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </div>

              {/* Expanded Leg Editor */}
              {isOpen && (
                <div className="mt-4 pt-4 border-t border-border animate-fade-in">
                  {/* Leg Name */}
                  <div className="mb-3">
                    <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold block mb-1">Leg Name</label>
                    <input
                      className="input-field !mb-0"
                      value={leg.name}
                      onChange={(e) => updateLeg(leg.id, { name: e.target.value })}
                      placeholder="e.g. Chinatown Sprint"
                    />
                  </div>

                  {/* Checkpoints */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold">
                        Checkpoints ({legCps.length})
                      </label>
                    </div>

                    {legCps.length === 0 && (
                      <p className="text-text-dim text-xs text-center py-4">No checkpoints yet.</p>
                    )}

                    {legCps.map((cp, cpIdx) => {
                      const cpOpen = expandedCp === cp.id;
                      return (
                        <div
                          key={cp.id}
                          className={`bg-surface border rounded-xl mb-2 overflow-hidden transition-all ${
                            cpOpen ? 'border-accent/20' : 'border-border'
                          }`}
                        >
                          {/* Checkpoint Header */}
                          <div
                            className="flex items-center gap-2 p-3 cursor-pointer"
                            onClick={() => setExpandedCp(cpOpen ? null : cp.id)}
                          >
                            <span className="text-lg">{TYPE_ICONS[cp.type]}</span>
                            <span className="flex-1 font-semibold text-sm truncate">{cp.name || 'Untitled'}</span>
                            <span className={`badge ${TYPE_COLORS[cp.type]}`}>{cp.type}</span>
                            <button
                              className="text-text-muted hover:text-danger text-xs ml-1 p-1"
                              onClick={(e) => { e.stopPropagation(); deleteCheckpoint(cp.id); }}
                            >
                              ✕
                            </button>
                          </div>

                          {/* Checkpoint Editor */}
                          {cpOpen && (
                            <div className="px-3 pb-3 border-t border-border pt-3 animate-fade-in">
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                  <label className="text-[10px] text-text-dim uppercase tracking-wide font-bold block mb-1">Name</label>
                                  <input
                                    className="input-field !mb-0 !text-sm !py-2"
                                    value={cp.name}
                                    onChange={(e) => updateCheckpoint(cp.id, { name: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-text-dim uppercase tracking-wide font-bold block mb-1">Type</label>
                                  <select
                                    className="input-field !mb-0 !text-sm !py-2 cursor-pointer"
                                    value={cp.type}
                                    onChange={(e) =>
                                      updateCheckpoint(cp.id, {
                                        type: e.target.value as any,
                                        requires_approval: e.target.value !== 'minigame',
                                      })
                                    }
                                  >
                                    <option value="challenge">🏁 Challenge</option>
                                    <option value="roadblock">🚧 Roadblock</option>
                                    <option value="minigame">🧩 Minigame</option>
                                  </select>
                                </div>
                              </div>

                              <div className="mb-2">
                                <label className="text-[10px] text-text-dim uppercase tracking-wide font-bold block mb-1">Description</label>
                                <textarea
                                  className="input-field !mb-0 !text-sm !py-2 resize-y min-h-[56px]"
                                  value={cp.description}
                                  onChange={(e) => updateCheckpoint(cp.id, { description: e.target.value })}
                                  placeholder="Instructions for teams…"
                                  rows={2}
                                />
                              </div>

                              <div className="mb-2">
                                <label className="text-[10px] text-text-dim uppercase tracking-wide font-bold block mb-1">Clue Text</label>
                                <textarea
                                  className="input-field !mb-0 !text-sm !py-2 resize-y min-h-[56px]"
                                  value={cp.clue_text}
                                  onChange={(e) => updateCheckpoint(cp.id, { clue_text: e.target.value })}
                                  placeholder="Clue revealed after completion…"
                                  rows={2}
                                />
                              </div>

                              {cp.type === 'minigame' && (
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <div>
                                    <label className="text-[10px] text-text-dim uppercase tracking-wide font-bold block mb-1">Minigame Type</label>
                                    <select
                                      className="input-field !mb-0 !text-sm !py-2 cursor-pointer"
                                      value={cp.mini_game_type}
                                      onChange={(e) => updateCheckpoint(cp.id, { mini_game_type: e.target.value })}
                                    >
                                      {MINI_GAME_TYPES.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-text-dim uppercase tracking-wide font-bold block mb-1">Answer</label>
                                    <input
                                      className="input-field !mb-0 !text-sm !py-2 font-mono"
                                      value={cp.answer}
                                      onChange={(e) => updateCheckpoint(cp.id, { answer: e.target.value })}
                                      placeholder="Decoded word…"
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-3 mt-1">
                                <label className="flex items-center gap-2 text-xs text-text-dim cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={cp.requires_approval}
                                    onChange={(e) => updateCheckpoint(cp.id, { requires_approval: e.target.checked })}
                                    className="accent-accent"
                                  />
                                  Requires admin approval
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add Checkpoint Buttons */}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => addCheckpoint(leg.id, 'challenge')}
                        className="flex-1 py-2 rounded-lg border border-dashed border-border text-text-dim text-xs font-semibold hover:border-accent/30 hover:text-accent transition-all cursor-pointer"
                      >
                        + 🏁 Challenge
                      </button>
                      <button
                        onClick={() => addCheckpoint(leg.id, 'roadblock')}
                        className="flex-1 py-2 rounded-lg border border-dashed border-border text-text-dim text-xs font-semibold hover:border-danger/30 hover:text-danger transition-all cursor-pointer"
                      >
                        + 🚧 Roadblock
                      </button>
                      <button
                        onClick={() => addCheckpoint(leg.id, 'minigame')}
                        className="flex-1 py-2 rounded-lg border border-dashed border-border text-text-dim text-xs font-semibold hover:border-purple/30 hover:text-purple transition-all cursor-pointer"
                      >
                        + 🧩 Minigame
                      </button>
                    </div>
                  </div>

                  {/* Delete Leg */}
                  <div className="flex justify-end mt-3 pt-3 border-t border-border">
                    <button className="btn-danger !text-xs !px-3 !py-1.5" onClick={() => deleteLeg(leg.id)}>
                      Delete Leg
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add Leg Button */}
      <button
        onClick={addLeg}
        disabled={saving}
        className="w-full py-3 mt-2 rounded-xl border border-dashed border-border text-text-dim text-sm font-bold hover:border-accent/30 hover:text-accent transition-all cursor-pointer bg-transparent"
      >
        {saving ? 'Adding…' : '+ Add Leg'}
      </button>
    </div>
  );
}
