'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Props = { raceId: string };

type WizardStep = 'location' | 'clue' | 'challenge' | 'funfact';

type WizardData = {
  name: string;
  location_answer: string;
  lat: number | null;
  lng: number | null;
  clue_type: string;
  clue_text: string;
  answer: string;
  emoji_clue: string;
  type: string;
  description: string;
  roadblock_hint: string;
  detour_option_a_title: string;
  detour_option_a_desc: string;
  detour_option_b_title: string;
  detour_option_b_desc: string;
  fun_fact: string;
};

const EMPTY_WIZARD: WizardData = {
  name: '', location_answer: '', lat: null, lng: null,
  clue_type: 'text', clue_text: '', answer: '', emoji_clue: '',
  type: 'challenge', description: '', roadblock_hint: '',
  detour_option_a_title: '', detour_option_a_desc: '',
  detour_option_b_title: '', detour_option_b_desc: '',
  fun_fact: '',
};

const CLUE_TYPES = [
  { value: 'text', icon: '📜', label: 'Text Clue', desc: 'A written hint describing the location' },
  { value: 'sliding', icon: '🧩', label: 'Sliding Puzzle', desc: 'Rearrange tiles to reveal a hint word' },
  { value: 'wordsearch', icon: '🔤', label: 'Word Search', desc: 'Find a hidden word in a grid' },
  { value: 'cipher', icon: '🔐', label: 'Cipher', desc: 'Decode shifted letters' },
  { value: 'unscramble', icon: '🔀', label: 'Unscramble', desc: 'Rearrange jumbled letters' },
  { value: 'emoji', icon: '🖼️', label: 'Emoji Riddle', desc: 'Emojis represent the location' },
];

const CHALLENGE_TYPES = [
  { value: 'challenge', icon: '🏁', label: 'Challenge', desc: 'Both players do the task together' },
  { value: 'detour', icon: '🔀', label: 'Detour', desc: 'Players choose between two options' },
  { value: 'roadblock', icon: '🚧', label: 'Roadblock', desc: 'One player goes solo' },
  { value: 'pitstop', icon: '🏁', label: 'Pit Stop', desc: 'Rest point — end of a leg' },
];

// ── Checkpoint Wizard ────────────────────────────────────────
function CheckpointWizard({ legId, orderNum, onSaved, onCancel }: {
  legId: string; orderNum: number; onSaved: () => void; onCancel: () => void;
}) {
  const [step, setStep] = useState<WizardStep>('location');
  const [data, setData] = useState<WizardData>({ ...EMPTY_WIZARD });
  const [saving, setSaving] = useState(false);

  const update = (fields: Partial<WizardData>) => setData(prev => ({ ...prev, ...fields }));

  const save = async () => {
    setSaving(true);
    await supabase.from('checkpoints').insert({
      leg_id: legId, order_num: orderNum,
      name: data.name || data.location_answer || `Checkpoint ${orderNum + 1}`,
      location_answer: data.location_answer,
      lat: data.lat, lng: data.lng,
      clue_type: data.clue_type, clue_text: data.clue_text,
      answer: data.answer, emoji_clue: data.emoji_clue,
      type: data.type, description: data.description,
      roadblock_hint: data.roadblock_hint,
      detour_option_a_title: data.detour_option_a_title,
      detour_option_a_desc: data.detour_option_a_desc,
      detour_option_b_title: data.detour_option_b_title,
      detour_option_b_desc: data.detour_option_b_desc,
      fun_fact: data.fun_fact,
      requires_approval: false,
      mini_game_type: data.clue_type !== 'text' ? data.clue_type : '',
    });
    setSaving(false);
    onSaved();
  };

  const stepNum = step === 'location' ? 1 : step === 'clue' ? 2 : step === 'challenge' ? 3 : 4;

  return (
    <div className="card !border-accent/30 animate-fade-in">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {['location', 'clue', 'challenge', 'funfact'].map((s, i) => (
          <div key={s} className={`w-2 h-2 rounded-full transition-all ${
            i + 1 === stepNum ? 'bg-accent w-6' : i + 1 < stepNum ? 'bg-accent/50' : 'bg-border'}`} />
        ))}
      </div>

      {/* ── Step 1: Location ── */}
      {step === 'location' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📍</span>
            <h3 className="font-bold text-[15px]">Where should players go?</h3>
          </div>
          <p className="text-xs text-text-dim mb-4">This is the destination players need to find.</p>

          <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1">Location Name</label>
          <input className="input-field" placeholder="e.g. Central Park Fountain, Brooklyn Bridge..."
            value={data.location_answer} onChange={e => update({ location_answer: e.target.value, name: e.target.value })} autoFocus />

          <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1">Display Name <span className="text-text-muted font-normal">(what players see after finding it)</span></label>
          <input className="input-field" placeholder="e.g. The Secret Fountain"
            value={data.name} onChange={e => update({ name: e.target.value })} />

          <div className="flex gap-2 mt-2">
            <button onClick={onCancel} className="btn-ghost !w-auto px-4">Cancel</button>
            <button onClick={() => setStep('clue')} disabled={!data.location_answer.trim()} className="btn-primary flex-1">
              Next: Write a clue →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Clue ── */}
      {step === 'clue' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔍</span>
            <h3 className="font-bold text-[15px]">How will players discover this place?</h3>
          </div>
          <p className="text-xs text-text-dim mb-4">Write a clue that hints at <span className="text-accent font-semibold">{data.location_answer}</span> without naming it directly.</p>

          <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-2">Clue Type</label>
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {CLUE_TYPES.map(ct => (
              <button key={ct.value} onClick={() => update({ clue_type: ct.value })}
                className={`p-2 rounded-lg text-center border cursor-pointer transition-all ${
                  data.clue_type === ct.value ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
                <div className="text-lg">{ct.icon}</div>
                <div className={`text-[10px] font-bold mt-0.5 ${data.clue_type === ct.value ? 'text-accent' : 'text-text-dim'}`}>{ct.label}</div>
              </button>
            ))}
          </div>

          {/* Text clue */}
          {data.clue_type === 'text' && (
            <div>
              <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1">Your Clue</label>
              <textarea className="input-field resize-none min-h-[80px]" rows={3}
                placeholder={`Hint at "${data.location_answer}" without naming it...\n\ne.g. "Head to the spot where horse carriages line up near a big green rectangle in the middle of the island"`}
                value={data.clue_text} onChange={e => update({ clue_text: e.target.value })} />
            </div>
          )}

          {/* Puzzle clues */}
          {data.clue_type !== 'text' && data.clue_type !== 'emoji' && (
            <div>
              <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1">
                Hint Word <span className="text-text-muted font-normal">— revealed when puzzle is solved</span>
              </label>
              <input className="input-field" placeholder="e.g. FOUNTAIN (5-8 letters)"
                value={data.answer} onChange={e => update({ answer: e.target.value.toUpperCase() })} maxLength={10} />
              <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1 mt-1">
                Extra Clue <span className="text-text-muted font-normal">(shown after solving the puzzle)</span>
              </label>
              <input className="input-field" placeholder="e.g. Look for this near the south entrance..."
                value={data.clue_text} onChange={e => update({ clue_text: e.target.value })} />
            </div>
          )}

          {/* Emoji clue */}
          {data.clue_type === 'emoji' && (
            <div>
              <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1">
                Emoji Sequence <span className="text-text-muted font-normal">— 3-5 emojis representing the location</span>
              </label>
              <input className="input-field text-2xl text-center" placeholder="🌳⛲🐴"
                value={data.emoji_clue} onChange={e => update({ emoji_clue: e.target.value })} />
              <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1 mt-1">
                Answer <span className="text-text-muted font-normal">— what players type to solve it</span>
              </label>
              <input className="input-field" placeholder={data.location_answer || "Location name"}
                value={data.answer || data.location_answer} onChange={e => update({ answer: e.target.value })} />
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <button onClick={() => setStep('location')} className="btn-ghost !w-auto px-4">← Back</button>
            <button onClick={() => setStep('challenge')} disabled={data.clue_type === 'text' ? !data.clue_text.trim() : !(data.answer || '').trim()} className="btn-primary flex-1">
              Next: Set the challenge →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Challenge ── */}
      {step === 'challenge' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🏁</span>
            <h3 className="font-bold text-[15px]">What happens when they arrive?</h3>
          </div>
          <p className="text-xs text-text-dim mb-4">Players found <span className="text-accent font-semibold">{data.location_answer}</span>. Now what do they do?</p>

          <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-2">Challenge Type</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {CHALLENGE_TYPES.map(ct => (
              <button key={ct.value} onClick={() => update({ type: ct.value })}
                className={`p-3 rounded-xl text-left border cursor-pointer transition-all ${
                  data.type === ct.value ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ct.icon}</span>
                  <span className={`text-xs font-bold ${data.type === ct.value ? 'text-accent' : 'text-text-dim'}`}>{ct.label}</span>
                </div>
                <p className="text-[10px] text-text-muted mt-1">{ct.desc}</p>
              </button>
            ))}
          </div>

          {/* Challenge description */}
          {data.type !== 'detour' && (
            <div>
              <label className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold block mb-1">
                {data.type === 'pitstop' ? 'Arrival Message' : 'Task Description'}
              </label>
              <textarea className="input-field resize-none min-h-[64px]" rows={2}
                placeholder={data.type === 'pitstop' ? 'e.g. You made it! Grab a coffee and enjoy the view.' : 'e.g. Take a selfie with the fountain, find the hidden plaque...'}
                value={data.description} onChange={e => update({ description: e.target.value })} />
            </div>
          )}

          {/* Roadblock hint */}
          {data.type === 'roadblock' && (
            <div className="mt-1">
              <label className="text-[10px] text-danger uppercase tracking-[2px] font-bold block mb-1">
                Cryptic Hint <span className="text-text-muted font-normal">— shown before they commit</span>
              </label>
              <input className="input-field" placeholder='e.g. "Who has the better sense of direction?"'
                value={data.roadblock_hint} onChange={e => update({ roadblock_hint: e.target.value })} />
            </div>
          )}

          {/* Detour options */}
          {data.type === 'detour' && (
            <div className="space-y-3">
              <div className="bg-surface/60 border border-border rounded-xl p-3">
                <p className="text-[10px] text-info uppercase tracking-[2px] font-bold mb-2">Option A</p>
                <input className="input-field !text-sm" placeholder="Title (e.g. Taste)" value={data.detour_option_a_title}
                  onChange={e => update({ detour_option_a_title: e.target.value })} />
                <textarea className="input-field !text-sm resize-none" rows={2} placeholder="Description..." value={data.detour_option_a_desc}
                  onChange={e => update({ detour_option_a_desc: e.target.value })} />
              </div>
              <div className="text-center text-text-muted text-xs font-bold">— OR —</div>
              <div className="bg-surface/60 border border-border rounded-xl p-3">
                <p className="text-[10px] text-info uppercase tracking-[2px] font-bold mb-2">Option B</p>
                <input className="input-field !text-sm" placeholder="Title (e.g. Trace)" value={data.detour_option_b_title}
                  onChange={e => update({ detour_option_b_title: e.target.value })} />
                <textarea className="input-field !text-sm resize-none" rows={2} placeholder="Description..." value={data.detour_option_b_desc}
                  onChange={e => update({ detour_option_b_desc: e.target.value })} />
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button onClick={() => setStep('clue')} className="btn-ghost !w-auto px-4">← Back</button>
            <button onClick={() => setStep('funfact')} className="btn-primary flex-1">
              {data.type === 'pitstop' ? 'Almost done →' : 'Next: Fun fact →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Fun Fact (Optional) ── */}
      {step === 'funfact' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💡</span>
            <h3 className="font-bold text-[15px]">Share something cool <span className="text-text-muted font-normal">(optional)</span></h3>
          </div>
          <p className="text-xs text-text-dim mb-4">An interesting fact about <span className="text-accent font-semibold">{data.location_answer}</span> that players see after completing this stop.</p>

          <textarea className="input-field resize-none min-h-[80px]" rows={3}
            placeholder="e.g. This fountain was designed in 1873 and is one of the largest in New York City. The angel on top represents the healing of the waters..."
            value={data.fun_fact} onChange={e => update({ fun_fact: e.target.value })} />

          <div className="flex gap-2 mt-2">
            <button onClick={() => setStep('challenge')} className="btn-ghost !w-auto px-4">← Back</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : '✓ Save Checkpoint'}
            </button>
          </div>
          <button onClick={() => { update({ fun_fact: '' }); save(); }} disabled={saving}
            className="text-xs text-text-muted text-center w-full mt-2 cursor-pointer bg-transparent border-none hover:text-text-dim">
            Skip fun fact & save
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main LegsBuilder ─────────────────────────────────────────
export default function LegsBuilder({ raceId }: Props) {
  const [legs, setLegs] = useState<any[]>([]);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [expandedLeg, setExpandedLeg] = useState<string | null>(null);
  const [wizardLegId, setWizardLegId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);
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
    // "Leg 1" tells a first-time host nothing. Ask for the area, with examples,
    // so the name means something to players later.
    const suggested = window.prompt(
      num === 0
        ? 'Name this leg after the area it covers.\n\nExamples: Greenwich Village, The Waterfront, Old Town, Chinatown'
        : 'What area does leg ' + (num + 1) + ' cover?\n\nPick somewhere walkable from where the last leg ended.',
      ''
    );
    if (suggested === null) return;   // cancelled
    const name = suggested.trim() || `Leg ${num + 1}`;
    const { data } = await supabase.from('legs').insert({ race_id: raceId, name, order_num: num }).select().single();
    if (data) { await fetchData(); setExpandedLeg(data.id); }
  };

  const deleteLeg = async (legId: string) => {
    if (!confirm('Delete this leg and all its checkpoints?')) return;
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

  const deleteCheckpoint = async (cpId: string) => {
    await supabase.from('checkpoints').delete().eq('id', cpId);
    fetchData();
  };

  const getLegCps = (legId: string) => checkpoints.filter(cp => cp.leg_id === legId).sort((a: any, b: any) => a.order_num - b.order_num);

  const TYPE_ICONS: Record<string, string> = { challenge: '🏁', roadblock: '🚧', detour: '🔀', pitstop: '🏁', minigame: '🧩' };
  const CLUE_ICONS: Record<string, string> = { text: '📜', sliding: '🧩', wordsearch: '🔤', cipher: '🔐', unscramble: '🔀', emoji: '🖼️' };

  // Live status so a first-time host always knows what to do next.
  const totalCps = checkpoints.length;
  const legsWithPitstop = legs.filter(l => getLegCps(l.id).some((c: any) => c.type === 'pitstop')).length;
  const legsWithStops = legs.filter(l => getLegCps(l.id).length > 0).length;
  const nextStep =
    legs.length === 0 ? 'Start by adding your first leg — an area of the city.'
    : legsWithStops < legs.length ? 'Add stops to each leg. Aim for 3-5 per leg.'
    : legsWithPitstop < legs.length ? 'Every leg needs a Pit Stop as its last stop.'
    : legs.length < 2 ? 'Looking good. Add a second leg to make it a proper route.'
    : 'Ready to go. Start the race whenever you like.';

  return (
    <div className="animate-fade-in">
      {/* Where you are, and what to do next */}
      <div className="card !border-accent/20 mb-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-1">Next step</p>
            <p className="text-sm text-text-primary font-semibold leading-snug">{nextStep}</p>
          </div>
          <button onClick={() => setShowGuide(v => !v)}
            className="shrink-0 w-7 h-7 rounded-full border border-border text-text-muted text-xs cursor-pointer bg-transparent hover:border-accent/40 hover:text-accent">
            ?
          </button>
        </div>
        {legs.length > 0 && (
          <div className="flex gap-2 mt-3">
            <div className="flex-1 bg-surface/60 border border-border/60 rounded-lg py-2 text-center">
              <p className="font-display text-lg text-accent">{legs.length}</p>
              <p className="text-[9px] text-text-dim uppercase tracking-wider">Legs</p>
            </div>
            <div className="flex-1 bg-surface/60 border border-border/60 rounded-lg py-2 text-center">
              <p className="font-display text-lg text-accent">{totalCps}</p>
              <p className="text-[9px] text-text-dim uppercase tracking-wider">Stops</p>
            </div>
            <div className="flex-1 bg-surface/60 border border-border/60 rounded-lg py-2 text-center">
              <p className={`font-display text-lg ${legsWithPitstop === legs.length ? 'text-success' : 'text-danger'}`}>
                {legsWithPitstop}/{legs.length}
              </p>
              <p className="text-[9px] text-text-dim uppercase tracking-wider">Pit stops</p>
            </div>
          </div>
        )}
      </div>

      {/* Onboarding */}
      {showGuide && (
        <div className="card !border-accent/20 mb-4 animate-fade-in">
          <h3 className="font-display text-lg text-accent tracking-wider mb-2">BUILD YOUR ADVENTURE</h3>
          <p className="text-sm text-text-dim leading-relaxed mb-3">
            Your adventure is made of <strong className="text-text-primary">legs</strong> (areas of the city) and <strong className="text-text-primary">checkpoints</strong> (stops within each leg).
          </p>
          <div className="space-y-2 mb-4">
            <div className="flex items-start gap-3 bg-surface/60 rounded-lg p-3">
              <span className="text-lg">📍</span>
              <div>
                <p className="text-sm font-bold text-text-primary">Legs = Areas</p>
                <p className="text-xs text-text-dim">Each leg is a neighborhood or area. Think of it as a chapter of your adventure.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-surface/60 rounded-lg p-3">
              <span className="text-lg">🏁</span>
              <div>
                <p className="text-sm font-bold text-text-primary">Checkpoints = Stops</p>
                <p className="text-xs text-text-dim">Each stop has: a clue to find it → verify arrival → complete a challenge → learn a fun fact.</p>
              </div>
            </div>
          </div>
          <div className="bg-surface/60 border border-border/60 rounded-lg p-3 mb-3">
            <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-2">What it looks like</p>
            <p className="text-xs text-text-dim leading-relaxed">
              <strong className="text-accent">Leg 1 — Greenwich Village</strong><br />
              <span className="text-text-muted">Stop 1</span> Washington Square Arch · take a photo under it<br />
              <span className="text-text-muted">Stop 2</span> Detour: the oldest bar, or the smallest house<br />
              <span className="text-text-muted">Stop 3</span> Pit Stop at the chess tables<br />
              <br />
              <strong className="text-accent">Leg 2 — East Village</strong><br />
              <span className="text-text-muted">Stop 1</span> ...and so on, picking up where leg 1 ended.
            </p>
          </div>
          <p className="text-xs text-text-dim mb-3">
            <strong className="text-text-primary">Rules of thumb:</strong> 2-4 legs, 3-5 stops each,
            10-15 minutes walking between stops, and every leg ends with a Pit Stop so people get a breather.
          </p>
          <div className="flex gap-2">
            <button onClick={addLeg} className="btn-primary flex-1">Create your first leg →</button>
            <button onClick={() => setShowGuide(false)} className="btn-ghost !w-auto px-4">Got it</button>
          </div>
        </div>
      )}

      {/* Legs */}
      {legs.map((leg, legIdx) => {
        const legCps = getLegCps(leg.id);
        const isOpen = expandedLeg === leg.id;
        const hasPitstop = legCps.some((cp: any) => cp.type === 'pitstop');

        return (
          <div key={leg.id} className="mb-3">
            <div className={`card !mb-0 transition-all ${isOpen ? '!border-accent/30' : ''}`}>
              {/* Leg header */}
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedLeg(isOpen ? null : leg.id)}>
                <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-display shrink-0">{legIdx + 1}</div>
                <div className="flex-1 min-w-0">
                  {editingLegName && editingLegName.id === leg.id ? (
                    <input className="input-field !mb-0 !py-1 !text-sm font-bold" placeholder="e.g. Greenwich Village" value={editingLegName.name}
                      onChange={e => setEditingLegName({ id: editingLegName.id, name: e.target.value })}
                      onBlur={saveLegName} onKeyDown={e => e.key === 'Enter' && saveLegName()}
                      onClick={e => e.stopPropagation()} autoFocus />
                  ) : (
                    <p className="font-bold text-[15px] truncate">{leg.name}</p>
                  )}
                  <p className="text-xs text-text-dim">
                    {legCps.length} stop{legCps.length !== 1 ? 's' : ''}
                    {legCps.length > 0 && !hasPitstop && ' · ⚠️ Needs pit stop'}
                    {hasPitstop && ' · ✓ Complete'}
                  </p>
                </div>
                <span className={`text-text-muted text-lg transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>

              {/* Expanded */}
              {isOpen && (
                <div className="mt-3 pt-3 border-t border-border animate-fade-in">
                  {/* Actions */}
                  <div className="flex gap-2 mb-3">
                    <button onClick={(e) => { e.stopPropagation(); setEditingLegName({ id: leg.id, name: leg.name }); }}
                      className="btn-sm text-xs flex-1">✏️ Rename</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteLeg(leg.id); }}
                      className="btn-danger !px-3 text-xs">🗑</button>
                  </div>

                  {/* Checkpoints */}
                  {legCps.length === 0 && wizardLegId !== leg.id && (
                    <div className="bg-surface/40 border border-dashed border-accent/20 rounded-xl p-5 text-center mb-3">
                      <p className="text-sm text-text-dim mb-1">No stops in this leg yet</p>
                      <p className="text-xs text-text-muted mb-3 max-w-[260px] mx-auto leading-relaxed">
                        A stop is one place players have to find. You&apos;ll give it a clue, then a
                        challenge to do when they get there. Last stop in the leg should be a Pit Stop.
                      </p>
                      <button onClick={() => setWizardLegId(leg.id)} className="btn-primary !w-auto px-6">+ Add First Checkpoint</button>
                    </div>
                  )}

                  {legCps.map((cp: any) => (
                    <div key={cp.id} className="flex items-center gap-2 py-2 border-b border-border/30 last:border-none">
                      <span className="text-lg">{TYPE_ICONS[cp.type] || '📍'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{cp.name}</p>
                        <div className="flex gap-1 mt-0.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface text-text-muted">{cp.type}</span>
                          {cp.clue_type !== 'text' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple/10 text-purple">{CLUE_ICONS[cp.clue_type]} {cp.clue_type}</span>}
                        </div>
                      </div>
                      <button onClick={() => deleteCheckpoint(cp.id)} className="text-text-muted hover:text-danger text-xs p-1 cursor-pointer">✕</button>
                    </div>
                  ))}

                  {/* Wizard */}
                  {wizardLegId === leg.id && (
                    <div className="mt-3">
                      <CheckpointWizard
                        legId={leg.id}
                        orderNum={legCps.length}
                        onSaved={() => { setWizardLegId(null); fetchData(); }}
                        onCancel={() => setWizardLegId(null)}
                      />
                    </div>
                  )}

                  {/* Add checkpoint button */}
                  {legCps.length > 0 && wizardLegId !== leg.id && (
                    <div className="mt-3">
                      {/* Contextual prompt */}
                      {!hasPitstop && legCps.length >= 2 && (
                        <div className="bg-success/5 border border-success/20 rounded-xl p-3 mb-2 flex items-start gap-2">
                          <span>💡</span>
                          <p className="text-xs text-text-dim">This leg has {legCps.length} stops. Consider adding a <strong className="text-success">Pit Stop</strong> to finish it off!</p>
                        </div>
                      )}
                      <button onClick={() => setWizardLegId(leg.id)}
                        className="w-full py-2.5 rounded-xl border border-dashed border-border text-text-dim text-sm font-semibold cursor-pointer hover:border-accent/30 hover:text-accent transition-all bg-transparent">
                        + Add Another Checkpoint
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add leg */}
      {!showGuide && (
        <div className="mt-2">
          {legs.length > 0 && legs.every(l => getLegCps(l.id).some((cp: any) => cp.type === 'pitstop')) && (
            <div className="bg-accent/5 border border-accent/15 rounded-xl p-3 mb-2 text-center">
              <p className="text-xs text-text-dim">✨ All legs have pit stops! Add another leg or start the race.</p>
            </div>
          )}
          <button onClick={addLeg}
            className="w-full py-3 rounded-xl border-2 border-dashed border-border text-text-dim font-semibold cursor-pointer hover:border-accent/30 hover:text-accent transition-all bg-transparent text-sm">
            + Add Another Leg
          </button>
        </div>
      )}
    </div>
  );
}
