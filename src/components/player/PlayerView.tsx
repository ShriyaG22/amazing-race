'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { elapsed } from '@/lib/utils';
import type { Race, Team, Leg, Checkpoint, Progress } from '@/lib/supabase';

type Props = { raceId: string; teamId: string; onExit: () => void };

// ══════════════════════════════════════════════════════════════
// MINIGAME COMPONENTS
// ══════════════════════════════════════════════════════════════

function SlidingPuzzle({ answer, onSolve }: { answer: string; onSolve: () => void }) {
  const size = 3;
  const total = size * size;
  const [tiles, setTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    const gen = (): number[] => {
      const arr = Array.from({ length: total - 1 }, (_, i) => i + 1).concat(0);
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      let inv = 0; const flat = arr.filter(x => x !== 0);
      for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) if (flat[i] > flat[j]) inv++;
      return inv % 2 === 0 ? arr : gen();
    };
    setTiles(gen());
  }, []);

  const emptyIdx = tiles.indexOf(0);
  const canMove = (idx: number) => { const r = Math.floor(idx / size), c = idx % size, eR = Math.floor(emptyIdx / size), eC = emptyIdx % size; return (Math.abs(r - eR) + Math.abs(c - eC)) === 1; };
  const move = (idx: number) => {
    if (!canMove(idx) || solved) return;
    const next = [...tiles]; [next[idx], next[emptyIdx]] = [next[emptyIdx], next[idx]]; setTiles(next); setMoves(m => m + 1);
    if (next.every((v, i) => i === total - 1 ? v === 0 : v === i + 1)) { setSolved(true); setTimeout(onSolve, 600); }
  };
  const letters = answer.toUpperCase().padEnd(total - 1, '✦').slice(0, total - 1);

  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-1 font-bold">Sliding Puzzle</p>
      <p className="text-xs text-text-muted mb-4">Arrange tiles to reveal the hint word</p>
      <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {tiles.map((tile, idx) => (
          <button key={idx} onClick={() => move(idx)} disabled={tile === 0}
            className={`w-[68px] h-[68px] rounded-xl font-display text-2xl font-bold flex items-center justify-center transition-all cursor-pointer ${
              tile === 0 ? 'bg-transparent border border-dashed border-border' : solved ? 'bg-success/20 text-success border border-success/30' : canMove(idx) ? 'bg-card border border-accent/30 text-accent hover:bg-accent/10' : 'bg-card border border-border text-text-primary'}`}>
            {tile > 0 ? letters[tile - 1] : ''}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-muted mt-3">{moves} moves</p>
      {solved && <p className="text-success font-bold mt-2 animate-fade-in">Solved! The hint is: {answer.toUpperCase()}</p>}
    </div>
  );
}

function WordSearchGame({ answer, onSolve }: { answer: string; onSolve: () => void }) {
  const word = answer.toUpperCase();
  const gridSize = Math.max(8, word.length + 2);
  const [grid] = useState(() => {
    const g: string[][] = Array.from({ length: gridSize }, () => Array.from({ length: gridSize }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]));
    const row = Math.floor(Math.random() * gridSize);
    const startCol = Math.floor(Math.random() * (gridSize - word.length));
    for (let i = 0; i < word.length; i++) g[row][startCol + i] = word[i];
    return g;
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [found, setFound] = useState(false);

  const toggleCell = (r: number, c: number) => {
    if (found) return;
    const key = `${r},${c}`;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
    const letters = Array.from(next).map(k => { const [rr, cc] = k.split(',').map(Number); return { r: rr, c: cc, l: grid[rr][cc] }; }).sort((a, b) => a.r === b.r ? a.c - b.c : a.r - b.r);
    if (letters.length === word.length && letters.map(s => s.l).join('') === word) { setFound(true); setTimeout(onSolve, 800); }
  };

  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-1 font-bold">Word Search</p>
      <p className="text-xs text-text-muted mb-1">Find: <span className="text-accent font-bold tracking-wider">{word}</span></p>
      <div className="inline-grid gap-0.5 mb-2" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
        {grid.map((row, r) => row.map((letter, c) => {
          const key = `${r},${c}`; const isSel = selected.has(key);
          return (<button key={key} onClick={() => toggleCell(r, c)}
            className={`w-7 h-7 rounded text-xs font-bold flex items-center justify-center cursor-pointer transition-all ${found && isSel ? 'bg-success/20 text-success' : isSel ? 'bg-accent/20 text-accent border border-accent/40' : 'bg-surface text-text-dim hover:bg-card border border-transparent'}`}>{letter}</button>);
        }))}
      </div>
      {found && <p className="text-success font-bold mt-2 animate-fade-in">Found! The hint is: {word}</p>}
    </div>
  );
}

function SimonSaysGame({ onSolve }: { onSolve: () => void }) {
  const colors = ['#e74c5e', '#3b82f6', '#2ecc71', '#f5a623'];
  const labels = ['🔴', '🔵', '🟢', '🟡'];
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [phase, setPhase] = useState<'watch' | 'play' | 'win' | 'fail'>('watch');
  const [activeBtn, setActiveBtn] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const targetRounds = 5;

  const playSequence = useCallback(async (seq: number[]) => {
    setPhase('watch');
    for (let i = 0; i < seq.length; i++) { await new Promise(r => setTimeout(r, 400)); setActiveBtn(seq[i]); await new Promise(r => setTimeout(r, 500)); setActiveBtn(null); }
    await new Promise(r => setTimeout(r, 200)); setPhase('play');
  }, []);

  useEffect(() => { const first = [Math.floor(Math.random() * 4)]; setSequence(first); playSequence(first); }, []);

  const handlePress = (idx: number) => {
    if (phase !== 'play') return;
    setActiveBtn(idx); setTimeout(() => setActiveBtn(null), 200);
    const next = [...playerInput, idx]; setPlayerInput(next);
    if (next[next.length - 1] !== sequence[next.length - 1]) { setPhase('fail'); setTimeout(() => { setPlayerInput([]); playSequence(sequence); }, 1000); return; }
    if (next.length === sequence.length) {
      if (round >= targetRounds) { setPhase('win'); setTimeout(onSolve, 800); }
      else { const nextSeq = [...sequence, Math.floor(Math.random() * 4)]; setSequence(nextSeq); setPlayerInput([]); setRound(r => r + 1); setTimeout(() => playSequence(nextSeq), 600); }
    }
  };

  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-1 font-bold">Simon Says</p>
      <p className="text-xs text-text-muted mb-4">{phase === 'watch' ? 'Watch the pattern…' : phase === 'play' ? 'Repeat it!' : phase === 'fail' ? 'Wrong! Watch again…' : 'You got it!'}</p>
      <div className="inline-grid grid-cols-2 gap-3 mb-3">
        {colors.map((color, i) => (
          <button key={i} onClick={() => handlePress(i)} disabled={phase !== 'play'}
            className="w-20 h-20 rounded-2xl text-2xl flex items-center justify-center transition-all cursor-pointer border-2"
            style={{ background: activeBtn === i ? color : `${color}22`, borderColor: activeBtn === i ? color : `${color}44`, transform: activeBtn === i ? 'scale(0.95)' : 'scale(1)', opacity: phase === 'watch' && activeBtn !== i ? 0.4 : 1 }}>
            {labels[i]}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-muted">Round {round}/{targetRounds}</p>
    </div>
  );
}

function MinigamePlayer({ type, answer, onSolve }: { type: string; answer: string; onSolve: () => void }) {
  switch (type) {
    case 'sliding': return <SlidingPuzzle answer={answer} onSolve={onSolve} />;
    case 'wordsearch': return <WordSearchGame answer={answer} onSolve={onSolve} />;
    case 'simon': return <SimonSaysGame onSolve={onSolve} />;
    default: return <SlidingPuzzle answer={answer || 'WANDR'} onSolve={onSolve} />;
  }
}

// ══════════════════════════════════════════════════════════════
// CHECKPOINT PHASE TYPE
// ══════════════════════════════════════════════════════════════
type Phase = 'welcome' | 'clue' | 'verify' | 'detour-choice' | 'roadblock-commit' | 'challenge' | 'funfact' | 'pitstop';

// ══════════════════════════════════════════════════════════════
// MAIN PLAYER VIEW
// ══════════════════════════════════════════════════════════════
export default function PlayerView({ raceId, teamId, onExit }: Props) {
  const [race, setRace] = useState<Race | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allProgress, setAllProgress] = useState<Progress[]>([]);
  const [tab, setTab] = useState<'adventure' | 'map' | 'board'>('adventure');

  // Game flow state
  const [phase, setPhase] = useState<Phase>('welcome');
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyError, setVerifyError] = useState(false);
  const [selectedDetour, setSelectedDetour] = useState<'a' | 'b' | null>(null);
  const [roadblockCommitted, setRoadblockCommitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showGiveUp, setShowGiveUp] = useState(false);
  const [clueSolved, setClueSolved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = async () => {
    const [r, t, l, c, p, at, ap] = await Promise.all([
      supabase.from('races').select().eq('id', raceId).single(),
      supabase.from('teams').select().eq('id', teamId).single(),
      supabase.from('legs').select().eq('race_id', raceId).order('order_num'),
      supabase.from('checkpoints').select().order('order_num'),
      supabase.from('progress').select().eq('team_id', teamId),
      supabase.from('teams').select().eq('race_id', raceId),
      supabase.from('progress').select(),
    ]);
    if (r.data) setRace(r.data);
    if (t.data) setTeam(t.data);
    if (l.data) setLegs(l.data);
    if (c.data) { const ids = (l.data || []).map(x => x.id); setCheckpoints(c.data.filter(cp => ids.includes(cp.leg_id))); }
    if (p.data) setProgress(p.data);
    if (at.data) setAllTeams(at.data);
    if (ap.data) setAllProgress(ap.data);
  };

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, 4000); return () => clearInterval(iv); }, [raceId, teamId]);

  // ── Derived State ──────────────────────────────────────────
  const orderedCps = legs.flatMap(leg => checkpoints.filter(cp => cp.leg_id === leg.id).sort((a, b) => a.order_num - b.order_num));
  const completedIds = new Set(progress.filter(p => p.status === 'complete' || (race?.admin_playing && p.status === 'pending')).map(p => p.checkpoint_id));
  const activeCp = orderedCps.find(cp => !completedIds.has(cp.id));
  const currentLeg = activeCp ? legs.find(l => l.id === activeCp.leg_id) : null;
  const currentLegIdx = currentLeg ? legs.indexOf(currentLeg) : -1;
  const totalCps = orderedCps.length;
  const doneCount = completedIds.size;
  const progressPct = totalCps > 0 ? (doneCount / totalCps) * 100 : 0;
  const raceFinished = race?.status === 'finished' || (!activeCp && doneCount > 0 && doneCount >= totalCps);
  const isExplorer = race?.game_mode === 'explorer';
  const requirePhoto = race?.require_photo ?? true;

  // Reset phase when checkpoint changes
  useEffect(() => {
    if (activeCp) {
      setPhase(doneCount === 0 ? 'welcome' : 'clue');
      setVerifyInput(''); setVerifyError(false); setSelectedDetour(null);
      setRoadblockCommitted(false); setClueSolved(false); setShowGiveUp(false);
      setPhotoPreview(null);
    }
  }, [activeCp?.id]);

  // ── Actions ────────────────────────────────────────────────
  const completeCheckpoint = async (proof: string = 'completed') => {
    if (!activeCp || submitting) return;
    setSubmitting(true);
    await supabase.from('progress').insert({ team_id: teamId, checkpoint_id: activeCp.id, status: race?.admin_playing ? 'pending' : 'complete', proof });
    setSubmitting(false);
    fetchAll();
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleVerify = () => {
    if (!activeCp) return;
    const answer = activeCp.location_answer?.toLowerCase().trim() || activeCp.name?.toLowerCase().trim();
    const input = verifyInput.toLowerCase().trim();
    if (input === answer || answer.includes(input) || input.includes(answer)) {
      setVerifyError(false);
      // Move to next phase based on type
      if (activeCp.type === 'detour') setPhase('detour-choice');
      else if (activeCp.type === 'roadblock') setPhase('roadblock-commit');
      else if (activeCp.type === 'pitstop') setPhase('pitstop');
      else setPhase('challenge');
    } else {
      setVerifyError(true);
      setTimeout(() => setVerifyError(false), 2000);
    }
  };

  const handleGiveUp = async () => {
    if (!activeCp) return;
    await supabase.from('progress').insert({ team_id: teamId, checkpoint_id: activeCp.id, status: 'complete', proof: 'passed' });
    setShowGiveUp(false);
    fetchAll();
  };

  // ── Render Helpers ─────────────────────────────────────────
  if (!race || !team) return <div className="min-h-screen flex items-center justify-center"><p className="text-text-dim animate-pulse">Loading...</p></div>;

  const tabs = isExplorer
    ? [{ id: 'adventure', label: 'Adventure' }, { id: 'map', label: 'Map' }]
    : [{ id: 'adventure', label: 'Race' }, { id: 'map', label: 'Map' }, { id: 'board', label: 'Board' }];

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center px-4 pt-4">
        <div>
          <p className="text-[10px] text-text-dim tracking-[3px] uppercase">{race.city || (isExplorer ? 'Explore' : 'Race')}</p>
          <h1 className="font-display text-xl text-accent tracking-wider">{team.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!isExplorer && <span className="badge bg-success/20 text-success">LIVE</span>}
          <button onClick={onExit} className="btn-sm !py-1.5 !px-3 text-xs">Exit</button>
        </div>
      </div>

      {/* Progress Bar */}
      {totalCps > 0 && (
        <div className="mx-4 mt-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-text-dim font-bold uppercase tracking-wide">Progress</span>
            <span className="text-[10px] text-text-muted font-mono">{doneCount}/{totalCps}</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all duration-700 ease-out" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border mx-4 mt-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={`tab ${tab === t.id ? 'tab-active' : 'tab-inactive'}`}>{t.label}</button>
        ))}
      </div>

      <div className="px-4 py-4">
        {/* ── ADVENTURE / RACE TAB ── */}
        {tab === 'adventure' && (
          <div>
            {/* Waiting */}
            {race.status === 'setup' && (
              <div className="flex items-center justify-center min-h-[50vh]"><div className="text-center">
                <p className="text-5xl mb-4">⏳</p>
                <h2 className="font-display text-2xl text-accent">WAITING TO START</h2>
                <p className="text-text-dim text-sm mt-2">The host is setting things up.</p>
              </div></div>
            )}

            {/* Finished */}
            {raceFinished && (
              <div className="flex items-center justify-center min-h-[50vh]"><div className="text-center animate-fade-in">
                <p className="text-5xl mb-4">🏆</p>
                <h2 className="font-display text-3xl text-accent">{isExplorer ? 'ADVENTURE COMPLETE' : 'RACE COMPLETE'}</h2>
                <p className="text-text-dim text-sm mt-2">You finished all {totalCps} checkpoints!</p>
                {race.started_at && <p className="text-text-muted text-xs mt-1">Time: {elapsed(race.started_at)}</p>}
              </div></div>
            )}

            {/* Active game */}
            {race.status === 'active' && activeCp && !raceFinished && (
              <div className="animate-fade-in">
                {/* Leg indicator */}
                {currentLeg && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-display shrink-0">{currentLegIdx + 1}</div>
                      <p className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold">{currentLeg.name}</p>
                    </div>
                  </div>
                )}

                {/* ── WELCOME PHASE ── */}
                {phase === 'welcome' && (
                  <div className="card text-center animate-fade-in">
                    <p className="text-4xl mb-3">🧭</p>
                    <h2 className="font-display text-2xl text-accent tracking-wider mb-2">{isExplorer ? 'YOUR ADVENTURE BEGINS' : 'RACE STARTS NOW'}</h2>
                    <p className="text-text-dim text-sm mb-1">{race.city}</p>
                    {currentLeg && <p className="text-text-muted text-xs mb-4">Starting in: {currentLeg.name}</p>}
                    <p className="text-sm text-text-dim leading-relaxed mb-6">
                      {isExplorer
                        ? 'Follow the clues to discover hidden gems around the city. Take your time, enjoy the journey, and learn something new at every stop.'
                        : 'Decode clues, race to each location, complete challenges, and make it to the Pit Stop. The clock is ticking!'}
                    </p>
                    <button onClick={() => setPhase('clue')} className="btn-primary">
                      Let's go! →
                    </button>
                  </div>
                )}

                {/* ── CLUE PHASE ── */}
                {phase === 'clue' && (
                  <div className="card animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="badge bg-purple/15 text-purple">📜 Clue</span>
                      <span className="text-xs text-text-muted">Stop {orderedCps.indexOf(activeCp) + 1} of {totalCps}</span>
                    </div>

                    {/* Text clue */}
                    {activeCp.clue_type === 'text' && (
                      <div className="bg-surface/60 border border-border/60 rounded-xl p-5 mb-4">
                        <p className="text-base text-text-primary italic leading-relaxed text-center">{activeCp.clue_text || 'Head to the next checkpoint...'}</p>
                      </div>
                    )}

                    {/* Minigame clue */}
                    {activeCp.clue_type !== 'text' && !clueSolved && (
                      <div className="mb-4">
                        <p className="text-xs text-text-dim text-center mb-3">Solve the puzzle to reveal your hint</p>
                        <MinigamePlayer type={activeCp.clue_type} answer={activeCp.answer || 'WANDR'} onSolve={() => setClueSolved(true)} />
                      </div>
                    )}

                    {/* After minigame solved */}
                    {activeCp.clue_type !== 'text' && clueSolved && (
                      <div className="bg-success/10 border border-success/20 rounded-xl p-4 mb-4 text-center animate-fade-in">
                        <p className="text-success font-bold mb-1">Puzzle solved!</p>
                        <p className="text-sm text-text-dim">Your hint: <span className="text-accent font-bold tracking-wider">{(activeCp.answer || '').toUpperCase()}</span></p>
                        {activeCp.clue_text && <p className="text-xs text-text-muted mt-2 italic">{activeCp.clue_text}</p>}
                      </div>
                    )}

                    <button onClick={() => setPhase('verify')}
                      disabled={activeCp.clue_type !== 'text' && !clueSolved}
                      className="btn-primary">
                      I know where to go! →
                    </button>

                    {/* Give up */}
                    <div className="mt-3 text-center">
                      {!showGiveUp ? (
                        <button onClick={() => setShowGiveUp(true)} className="text-xs text-text-muted hover:text-text-dim cursor-pointer bg-transparent border-none">Stuck? Skip this one →</button>
                      ) : (
                        <div className="animate-fade-in">
                          <p className="text-xs text-text-dim mb-2">The answer is: <span className="text-accent font-bold">{activeCp.location_answer || activeCp.name}</span></p>
                          <button onClick={handleGiveUp} className="text-xs text-danger cursor-pointer bg-transparent border-none">Skip and continue →</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── VERIFY PHASE ── */}
                {phase === 'verify' && (
                  <div className="card animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="badge bg-info/15 text-info">📍 Verify Location</span>
                    </div>
                    <p className="text-sm text-text-dim mb-4">Where do you think you need to go?</p>
                    <input
                      className={`input-field text-center text-lg font-semibold ${verifyError ? 'animate-shake !border-danger' : ''}`}
                      placeholder="Type the location name..."
                      value={verifyInput}
                      onChange={e => setVerifyInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleVerify()}
                      autoFocus
                    />
                    {verifyError && <p className="text-danger text-xs text-center mb-2">Not quite — try again!</p>}
                    <button onClick={handleVerify} disabled={!verifyInput.trim()} className="btn-primary">Check →</button>
                  </div>
                )}

                {/* ── DETOUR CHOICE PHASE ── */}
                {phase === 'detour-choice' && (
                  <div className="card animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="badge bg-info/15 text-info">🔀 Detour</span>
                    </div>
                    <p className="text-sm text-text-dim mb-4">Choose your challenge:</p>
                    <div className="space-y-3 mb-4">
                      <button onClick={() => setSelectedDetour('a')}
                        className={`w-full p-4 rounded-xl border text-left cursor-pointer transition-all ${selectedDetour === 'a' ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-text-muted'}`}>
                        <p className="font-bold text-sm text-text-primary">{activeCp.detour_option_a_title || 'Option A'}</p>
                        <p className="text-xs text-text-dim mt-1">{activeCp.detour_option_a_desc || 'Complete this challenge'}</p>
                      </button>
                      <div className="text-center text-text-muted text-xs font-bold">— OR —</div>
                      <button onClick={() => setSelectedDetour('b')}
                        className={`w-full p-4 rounded-xl border text-left cursor-pointer transition-all ${selectedDetour === 'b' ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-text-muted'}`}>
                        <p className="font-bold text-sm text-text-primary">{activeCp.detour_option_b_title || 'Option B'}</p>
                        <p className="text-xs text-text-dim mt-1">{activeCp.detour_option_b_desc || 'Complete this challenge'}</p>
                      </button>
                    </div>
                    <button onClick={() => setPhase('challenge')} disabled={!selectedDetour} className="btn-primary">
                      Go with {selectedDetour === 'a' ? activeCp.detour_option_a_title : selectedDetour === 'b' ? activeCp.detour_option_b_title : '...'} →
                    </button>
                  </div>
                )}

                {/* ── ROADBLOCK COMMIT PHASE ── */}
                {phase === 'roadblock-commit' && (
                  <div className="card animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="badge bg-danger/15 text-danger">🚧 Roadblock</span>
                    </div>
                    <p className="text-sm text-text-dim mb-2">One team member must take this on solo.</p>
                    <div className="bg-surface/60 border border-danger/20 rounded-xl p-5 mb-4 text-center">
                      <p className="text-lg text-text-primary italic font-semibold">"{activeCp.roadblock_hint || 'Who\'s feeling brave?'}"</p>
                    </div>
                    <p className="text-xs text-text-muted text-center mb-4">Once you commit, you can't switch!</p>
                    <button onClick={() => { setRoadblockCommitted(true); setPhase('challenge'); }} className="btn-primary">
                      I'll do it! →
                    </button>
                  </div>
                )}

                {/* ── CHALLENGE PHASE ── */}
                {phase === 'challenge' && (
                  <div className="card animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`badge ${activeCp.type === 'detour' ? 'bg-info/15 text-info' : activeCp.type === 'roadblock' ? 'bg-danger/15 text-danger' : 'bg-accent/15 text-accent'}`}>
                        {activeCp.type === 'detour' ? '🔀' : activeCp.type === 'roadblock' ? '🚧' : '🏁'} {activeCp.type === 'detour' ? (selectedDetour === 'a' ? activeCp.detour_option_a_title : activeCp.detour_option_b_title) : 'Challenge'}
                      </span>
                    </div>
                    <h3 className="font-display text-xl text-accent tracking-wider mb-2">{activeCp.name}</h3>
                    <p className="text-sm text-text-primary leading-relaxed mb-4">
                      {activeCp.type === 'detour'
                        ? (selectedDetour === 'a' ? activeCp.detour_option_a_desc : activeCp.detour_option_b_desc)
                        : activeCp.description}
                    </p>

                    {/* Photo proof (if required) */}
                    {requirePhoto ? (
                      <div>
                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                        {!photoPreview ? (
                          <button onClick={() => fileInputRef.current?.click()}
                            className="w-full py-6 rounded-xl border-2 border-dashed border-border hover:border-accent/40 bg-surface/50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all mb-3">
                            <span className="text-3xl">📸</span>
                            <span className="text-sm font-semibold text-text-dim">Take a Photo</span>
                          </button>
                        ) : (
                          <div className="mb-3 animate-fade-in">
                            <div className="relative rounded-xl overflow-hidden border border-border">
                              <img src={photoPreview} alt="Proof" className="w-full max-h-[200px] object-cover" />
                              <button onClick={() => { setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-bg/80 border border-border text-text-dim flex items-center justify-center text-xs cursor-pointer">✕</button>
                            </div>
                          </div>
                        )}
                        <button onClick={() => { completeCheckpoint(photoPreview || 'photo'); setPhase('funfact'); }}
                          disabled={!photoPreview || submitting} className="btn-primary">
                          {submitting ? 'Submitting…' : 'Submit & Continue →'}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { completeCheckpoint('done'); setPhase('funfact'); }}
                        disabled={submitting} className="btn-primary">
                        {submitting ? 'Submitting…' : 'Done ✓ Continue →'}
                      </button>
                    )}

                    {/* Give up */}
                    <div className="mt-3 text-center">
                      <button onClick={() => { completeCheckpoint('passed'); setPhase('funfact'); }}
                        className="text-xs text-text-muted hover:text-text-dim cursor-pointer bg-transparent border-none">Skip this challenge →</button>
                    </div>
                  </div>
                )}

                {/* ── FUN FACT PHASE ── */}
                {phase === 'funfact' && (
                  <div className="card animate-fade-in text-center">
                    <p className="text-3xl mb-2">💡</p>
                    <h3 className="font-display text-lg text-accent tracking-wider mb-3">DID YOU KNOW?</h3>
                    <p className="text-sm text-text-dim leading-relaxed mb-6">{activeCp.fun_fact || `${activeCp.name} is a fascinating spot with a rich history.`}</p>
                    <button onClick={() => fetchAll()} className="btn-primary">Continue →</button>
                  </div>
                )}

                {/* ── PIT STOP PHASE ── */}
                {phase === 'pitstop' && (
                  <div className="card animate-fade-in text-center">
                    <p className="text-5xl mb-3">🏁</p>
                    <h3 className="font-display text-2xl text-success tracking-wider mb-2">PIT STOP!</h3>
                    <h4 className="font-display text-lg text-accent mb-1">{activeCp.name}</h4>
                    <p className="text-sm text-text-dim leading-relaxed mb-2">{activeCp.description || 'You made it! Take a moment to rest and enjoy.'}</p>
                    {activeCp.fun_fact && (
                      <div className="bg-surface/60 border border-border/60 rounded-xl p-4 mb-4 mt-3">
                        <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-1">💡 About this place</p>
                        <p className="text-xs text-text-dim leading-relaxed">{activeCp.fun_fact}</p>
                      </div>
                    )}
                    <p className="text-xs text-success font-bold mb-4">Leg {currentLegIdx + 1} Complete!</p>
                    <button onClick={() => { completeCheckpoint('pitstop_reached'); }}
                      disabled={submitting} className="btn-primary !bg-gradient-to-br !from-success !to-success/70">
                      {submitting ? 'Saving…' : orderedCps.indexOf(activeCp) === totalCps - 1 ? 'Finish Adventure! 🏆' : 'On to the next leg! →'}
                    </button>
                  </div>
                )}

                {/* Completed list */}
                {doneCount > 0 && phase !== 'welcome' && (
                  <div className="mt-6">
                    <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-2">Completed ({doneCount})</p>
                    {orderedCps.filter(cp => completedIds.has(cp.id)).map(cp => (
                      <div key={cp.id} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-none">
                        <span className="text-success text-xs">✓</span>
                        <span className="text-xs text-text-muted">{cp.type === 'pitstop' ? '🏁' : cp.type === 'detour' ? '🔀' : cp.type === 'roadblock' ? '🚧' : '🏁'}</span>
                        <span className="text-xs text-text-dim">{cp.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MAP TAB ── */}
        {tab === 'map' && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <p className="text-4xl mb-3">🗺️</p>
              <p className="text-text-dim text-sm">Map coming soon</p>
            </div>
          </div>
        )}

        {/* ── BOARD TAB (Race mode only) ── */}
        {tab === 'board' && !isExplorer && (
          <div className="animate-fade-in">
            <h2 className="font-display text-xl text-accent tracking-wider mb-4">LEADERBOARD</h2>
            {allTeams.map((t, i) => {
              const tp = allProgress.filter(p => p.team_id === t.id && (p.status === 'complete' || (race?.admin_playing && p.status === 'pending')));
              const isMe = t.id === teamId;
              const pct = totalCps > 0 ? (tp.length / totalCps) * 100 : 0;
              return (
                <div key={t.id} className={`card flex items-center gap-3 ${isMe ? '!border-accent/30' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-lg shrink-0 ${i === 0 ? 'bg-accent/15 text-accent' : 'bg-surface text-text-muted'}`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold text-sm truncate ${isMe ? 'text-accent' : ''}`}>{t.name}</p>
                      {isMe && <span className="text-[9px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-bold">You</span>}
                    </div>
                    <div className="h-1 rounded-full bg-border overflow-hidden mt-1.5">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <p className="text-sm font-mono text-text-dim">{tp.length}/{totalCps}</p>
                </div>
              );
            }).sort((a: any, b: any) => 0)}
          </div>
        )}
      </div>
    </div>
  );
}
