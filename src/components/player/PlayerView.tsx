'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { elapsed } from '@/lib/utils';
import type { Race, Team, Leg, Checkpoint, Progress } from '@/lib/supabase';

type Props = { raceId: string; teamId: string; onExit: () => void };

const TYPE_ICONS: Record<string, string> = { challenge: '🏁', roadblock: '🚧', minigame: '🧩' };
const TYPE_LABELS: Record<string, string> = { challenge: 'Challenge', roadblock: 'Roadblock', minigame: 'Minigame' };
const TYPE_COLORS: Record<string, string> = {
  challenge: 'bg-accent/15 text-accent border-accent/20',
  roadblock: 'bg-danger/15 text-danger border-danger/20',
  minigame: 'bg-purple/15 text-purple border-purple/20',
};
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// ══════════════════════════════════════════════════════════════
// MINIGAME: Sliding Tile Puzzle
// ══════════════════════════════════════════════════════════════
function SlidingPuzzle({ answer, onSolve }: { answer: string; onSolve: () => void }) {
  const size = 3;
  const total = size * size;
  const [tiles, setTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    // Generate solvable puzzle
    const gen = (): number[] => {
      const arr = Array.from({ length: total - 1 }, (_, i) => i + 1).concat(0);
      // Shuffle with Fisher-Yates
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      // Check solvability
      let inversions = 0;
      const flat = arr.filter(x => x !== 0);
      for (let i = 0; i < flat.length; i++) {
        for (let j = i + 1; j < flat.length; j++) {
          if (flat[i] > flat[j]) inversions++;
        }
      }
      return inversions % 2 === 0 ? arr : gen();
    };
    setTiles(gen());
  }, []);

  const emptyIdx = tiles.indexOf(0);

  const canMove = (idx: number) => {
    const row = Math.floor(idx / size), col = idx % size;
    const eRow = Math.floor(emptyIdx / size), eCol = emptyIdx % size;
    return (Math.abs(row - eRow) + Math.abs(col - eCol)) === 1;
  };

  const move = (idx: number) => {
    if (!canMove(idx) || solved) return;
    const next = [...tiles];
    [next[idx], next[emptyIdx]] = [next[emptyIdx], next[idx]];
    setTiles(next);
    setMoves(m => m + 1);

    // Check win
    const win = next.every((v, i) => i === total - 1 ? v === 0 : v === i + 1);
    if (win) {
      setSolved(true);
      setTimeout(onSolve, 600);
    }
  };

  const letters = answer.toUpperCase().padEnd(total - 1, '✦').slice(0, total - 1);

  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-1 font-bold">Sliding Puzzle</p>
      <p className="text-xs text-text-muted mb-4">Arrange tiles to reveal the word</p>
      <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {tiles.map((tile, idx) => (
          <button
            key={idx}
            onClick={() => move(idx)}
            disabled={tile === 0}
            className={`w-[72px] h-[72px] rounded-xl font-display text-2xl font-bold flex items-center justify-center transition-all cursor-pointer ${
              tile === 0
                ? 'bg-transparent border border-dashed border-border'
                : solved
                ? 'bg-success/20 text-success border border-success/30'
                : canMove(idx)
                ? 'bg-card border border-accent/30 text-accent hover:bg-accent/10'
                : 'bg-card border border-border text-text-primary'
            }`}
          >
            {tile > 0 ? letters[tile - 1] : ''}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-muted mt-3">{moves} moves</p>
      {solved && <p className="text-success font-bold mt-2 animate-fade-in">🎉 Solved!</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MINIGAME: Word Search
// ══════════════════════════════════════════════════════════════
function WordSearchGame({ answer, onSolve }: { answer: string; onSolve: () => void }) {
  const word = answer.toUpperCase();
  const gridSize = Math.max(8, word.length + 2);
  const [grid] = useState(() => {
    const g: string[][] = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)])
    );
    // Place word in a random row
    const row = Math.floor(Math.random() * gridSize);
    const startCol = Math.floor(Math.random() * (gridSize - word.length));
    for (let i = 0; i < word.length; i++) {
      g[row][startCol + i] = word[i];
    }
    return g;
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [found, setFound] = useState(false);

  const toggleCell = (r: number, c: number) => {
    if (found) return;
    const key = `${r},${c}`;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);

    // Check if selected letters spell the word
    const selectedLetters = Array.from(next)
      .map(k => { const [rr, cc] = k.split(',').map(Number); return { r: rr, c: cc, l: grid[rr][cc] }; })
      .sort((a, b) => a.r === b.r ? a.c - b.c : a.r - b.r);

    if (selectedLetters.length === word.length) {
      const spelled = selectedLetters.map(s => s.l).join('');
      if (spelled === word) {
        setFound(true);
        setTimeout(onSolve, 800);
      }
    }
  };

  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-1 font-bold">Word Search</p>
      <p className="text-xs text-text-muted mb-1">Find: <span className="text-accent font-bold tracking-wider">{word}</span></p>
      <p className="text-[10px] text-text-muted mb-3">Tap letters to select them</p>
      <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
        {grid.map((row, r) =>
          row.map((letter, c) => {
            const key = `${r},${c}`;
            const isSel = selected.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleCell(r, c)}
                className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center cursor-pointer transition-all ${
                  found && isSel
                    ? 'bg-success/20 text-success'
                    : isSel
                    ? 'bg-accent/20 text-accent border border-accent/40'
                    : 'bg-surface text-text-dim hover:bg-card border border-transparent'
                }`}
              >
                {letter}
              </button>
            );
          })
        )}
      </div>
      {found && <p className="text-success font-bold mt-3 animate-fade-in">🎉 Found it!</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MINIGAME: Simon Says (Pattern Sequence)
// ══════════════════════════════════════════════════════════════
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
    for (let i = 0; i < seq.length; i++) {
      await new Promise(r => setTimeout(r, 400));
      setActiveBtn(seq[i]);
      await new Promise(r => setTimeout(r, 500));
      setActiveBtn(null);
    }
    await new Promise(r => setTimeout(r, 200));
    setPhase('play');
  }, []);

  useEffect(() => {
    const first = [Math.floor(Math.random() * 4)];
    setSequence(first);
    playSequence(first);
  }, []);

  const handlePress = (idx: number) => {
    if (phase !== 'play') return;
    setActiveBtn(idx);
    setTimeout(() => setActiveBtn(null), 200);

    const next = [...playerInput, idx];
    setPlayerInput(next);

    // Check
    if (next[next.length - 1] !== sequence[next.length - 1]) {
      setPhase('fail');
      setTimeout(() => {
        setPlayerInput([]);
        playSequence(sequence);
      }, 1000);
      return;
    }

    if (next.length === sequence.length) {
      if (round >= targetRounds) {
        setPhase('win');
        setTimeout(onSolve, 800);
      } else {
        // Next round
        const nextSeq = [...sequence, Math.floor(Math.random() * 4)];
        setSequence(nextSeq);
        setPlayerInput([]);
        setRound(r => r + 1);
        setTimeout(() => playSequence(nextSeq), 600);
      }
    }
  };

  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-1 font-bold">Simon Says</p>
      <p className="text-xs text-text-muted mb-4">
        {phase === 'watch' ? 'Watch the pattern…' : phase === 'play' ? 'Your turn! Repeat the pattern' : phase === 'fail' ? 'Wrong! Watch again…' : '🎉 You got it!'}
      </p>
      <div className="inline-grid grid-cols-2 gap-3 mb-4">
        {colors.map((color, i) => (
          <button
            key={i}
            onClick={() => handlePress(i)}
            disabled={phase !== 'play'}
            className="w-24 h-24 rounded-2xl text-3xl flex items-center justify-center transition-all cursor-pointer border-2"
            style={{
              background: activeBtn === i ? color : `${color}22`,
              borderColor: activeBtn === i ? color : `${color}44`,
              transform: activeBtn === i ? 'scale(0.95)' : 'scale(1)',
              opacity: phase === 'watch' && activeBtn !== i ? 0.4 : 1,
            }}
          >
            {labels[i]}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-muted">Round {round}/{targetRounds}</p>
      {phase === 'win' && <p className="text-success font-bold mt-2 animate-fade-in">🎉 Pattern master!</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MINIGAME ROUTER
// ══════════════════════════════════════════════════════════════
function MinigamePlayer({ type, answer, onSolve }: { type: string; answer: string; onSolve: () => void }) {
  switch (type) {
    case 'sliding':
      return <SlidingPuzzle answer={answer} onSolve={onSolve} />;
    case 'wordsearch':
      return <WordSearchGame answer={answer} onSolve={onSolve} />;
    case 'simon':
      return <SimonSaysGame onSolve={onSolve} />;
    default:
      // Fallback: unscramble
      return <FallbackPuzzle answer={answer} onSolve={onSolve} />;
  }
}

function FallbackPuzzle({ answer, onSolve }: { answer: string; onSolve: () => void }) {
  const [guess, setGuess] = useState('');
  const [error, setError] = useState(false);
  const scrambled = answer.split('').sort(() => Math.random() - 0.5).join('').toUpperCase();

  const check = () => {
    if (guess.trim().toLowerCase() === answer.toLowerCase()) onSolve();
    else { setError(true); setTimeout(() => setError(false), 1000); }
  };

  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-2 font-bold">Unscramble</p>
      <p className="font-display text-4xl text-accent tracking-[8px] mb-6">{scrambled}</p>
      <input
        className={`input-field text-center text-lg font-bold tracking-wider ${error ? 'animate-shake !border-danger' : ''}`}
        placeholder="Your answer..." value={guess}
        onChange={e => setGuess(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && check()} autoFocus
      />
      <button onClick={check} className="btn-primary mt-2">Submit</button>
    </div>
  );
}

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
  const [tab, setTab] = useState<'race' | 'map' | 'board'>('race');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

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
    if (c.data) {
      const legIds = (l.data || []).map(x => x.id);
      setCheckpoints(c.data.filter(cp => legIds.includes(cp.leg_id)));
    }
    if (p.data) setProgress(p.data);
    if (at.data) setAllTeams(at.data);
    if (ap.data) setAllProgress(ap.data);
  };

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 3000);
    return () => clearInterval(iv);
  }, [raceId, teamId]);

  // ── Fog of War Map ──────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'map' || !mapContainerRef.current || !MAPBOX_TOKEN) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const loadMap = async () => {
      if (!(window as any).mapboxgl) {
        if (!document.querySelector('link[href*="mapbox-gl"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
          document.head.appendChild(link);
        }
        await new Promise<void>(resolve => {
          const script = document.createElement('script');
          script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }

      const mapboxgl = (window as any).mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      // Only show completed + current checkpoint (fog of war)
      const completedCpIds = new Set(progress.filter(p => p.status === 'complete').map(p => p.checkpoint_id));
      const orderedCps = legs.flatMap(leg =>
        checkpoints.filter(cp => cp.leg_id === leg.id).sort((a, b) => a.order_num - b.order_num)
      );
      const currentCp = orderedCps.find(cp => !completedCpIds.has(cp.id));

      const visibleCps = checkpoints.filter(cp =>
        (cp.lat && cp.lng) && (completedCpIds.has(cp.id) || cp.id === currentCp?.id)
      );

      const center: [number, number] = visibleCps.length > 0
        ? [
            visibleCps.reduce((s, c) => s + (c.lng || 0), 0) / visibleCps.length,
            visibleCps.reduce((s, c) => s + (c.lat || 0), 0) / visibleCps.length,
          ]
        : [-74.006, 40.7128];

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center,
        zoom: visibleCps.length > 0 ? 13 : 11,
      });

      visibleCps.forEach(cp => {
        const isCompleted = completedCpIds.has(cp.id);
        const isCurrent = cp.id === currentCp?.id;
        const el = document.createElement('div');
        el.style.cssText = `
          width: 28px; height: 28px; border-radius: 50%;
          background: ${isCompleted ? '#2ecc71' : '#f5a623'};
          border: 3px solid #0a0a0f;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; color: #0a0a0f; font-weight: 800;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          ${isCurrent ? 'animation: pulse 2s infinite;' : ''}
        `;
        el.textContent = isCompleted ? '✓' : '?';

        new mapboxgl.Marker({ element: el })
          .setLngLat([cp.lng!, cp.lat!])
          .setPopup(
            new mapboxgl.Popup({ offset: 20 })
              .setHTML(`
                <div style="font-family:'DM Sans',sans-serif;padding:4px;">
                  <div style="font-size:14px;font-weight:700;color:#fff;">${cp.name}</div>
                  <div style="font-size:11px;color:#888;margin-top:2px;">${isCompleted ? '✓ Completed' : '📍 Current'}</div>
                </div>
              `)
          )
          .addTo(map);
      });

      mapRef.current = map;
    };

    loadMap();
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [tab, checkpoints, progress, legs]);

  // ── Derived State ───────────────────────────────────────────
  const orderedCheckpoints = legs.flatMap(leg =>
    checkpoints.filter(cp => cp.leg_id === leg.id).sort((a, b) => a.order_num - b.order_num)
  );

  const completedIds = new Set(progress.filter(p => p.status === 'complete').map(p => p.checkpoint_id));
  const pendingIds = new Set(progress.filter(p => p.status === 'pending').map(p => p.checkpoint_id));
  const rejectedIds = new Set(progress.filter(p => p.status === 'rejected').map(p => p.checkpoint_id));

  const currentCheckpoint = orderedCheckpoints.find(cp => !completedIds.has(cp.id) && !pendingIds.has(cp.id));
  // If admin_playing, pending counts as "done" for progression
  const currentCheckpointWithPlayMode = race?.admin_playing
    ? orderedCheckpoints.find(cp => !completedIds.has(cp.id) && !pendingIds.has(cp.id))
    : orderedCheckpoints.find(cp => !completedIds.has(cp.id));

  const activeCp = currentCheckpointWithPlayMode;
  const currentLeg = activeCp ? legs.find(l => l.id === activeCp.leg_id) : null;
  const currentLegIdx = currentLeg ? legs.indexOf(currentLeg) : -1;

  const totalCheckpoints = orderedCheckpoints.length;
  const doneCount = race?.admin_playing
    ? completedIds.size + pendingIds.size
    : completedIds.size;
  const progressPct = totalCheckpoints > 0 ? (doneCount / totalCheckpoints) * 100 : 0;

  const isPending = activeCp ? pendingIds.has(activeCp.id) : false;
  const isRejected = activeCp ? rejectedIds.has(activeCp.id) : false;
  const raceFinished = race?.status === 'finished' || (!activeCp && doneCount > 0 && doneCount >= totalCheckpoints);

  // ── Actions ─────────────────────────────────────────────────
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const submitProof = async (proof: string) => {
    if (!activeCp || submitting) return;
    setSubmitting(true);

    const existing = progress.find(p => p.checkpoint_id === activeCp.id && p.status === 'rejected');

    if (existing) {
      await supabase.from('progress').update({ proof, status: 'pending', submitted_at: new Date().toISOString(), reviewed_at: null }).eq('id', existing.id);
    } else {
      await supabase.from('progress').insert({ team_id: teamId, checkpoint_id: activeCp.id, status: 'pending', proof });
    }

    setPhotoPreview(null);
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fetchAll();
  };

  const solveMinigame = async () => {
    if (!activeCp) return;
    const existing = progress.find(p => p.checkpoint_id === activeCp.id);
    if (existing) {
      await supabase.from('progress').update({ status: 'complete', proof: 'minigame_solved', reviewed_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('progress').insert({ team_id: teamId, checkpoint_id: activeCp.id, status: 'complete', proof: 'minigame_solved' });
    }
    setGaveUp(false);
    setShowGiveUpConfirm(false);
    fetchAll();
  };

  const handleGiveUp = async () => {
    if (!activeCp) return;
    setGaveUp(true);
    setShowGiveUpConfirm(false);

    // Auto-complete the checkpoint as "passed"
    const existing = progress.find(p => p.checkpoint_id === activeCp.id);
    if (existing) {
      await supabase.from('progress').update({ status: 'complete', proof: 'passed', reviewed_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('progress').insert({ team_id: teamId, checkpoint_id: activeCp.id, status: 'complete', proof: 'passed' });
    }

    // Show answer for 3 seconds then advance
    setTimeout(() => {
      setGaveUp(false);
      fetchAll();
    }, 3500);
  };

  // ── Leaderboard ─────────────────────────────────────────────
  const leaderboard = allTeams
    .map(t => {
      const tp = allProgress.filter(p => p.team_id === t.id && (p.status === 'complete' || (race?.admin_playing && p.status === 'pending')));
      return { ...t, completed: tp.length };
    })
    .sort((a, b) => b.completed - a.completed);

  // ── Render ──────────────────────────────────────────────────
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

      {/* Progress Bar */}
      {race.status === 'active' && totalCheckpoints > 0 && (
        <div className="mx-4 mt-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-text-dim font-bold uppercase tracking-wide">Progress</span>
            <span className="text-[10px] text-text-muted font-mono">{doneCount}/{totalCheckpoints}</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all duration-700 ease-out" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border mx-4 mt-2">
        {(['race', 'map', 'board'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? 'tab-active' : 'tab-inactive'}`}>
            {t === 'board' ? 'Board' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {/* ── RACE TAB ── */}
        {tab === 'race' && (
          <div>
            {race.status === 'setup' && (
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                  <p className="text-5xl mb-4">⏳</p>
                  <h2 className="font-display text-2xl text-accent">WAITING TO START</h2>
                  <p className="text-text-dim text-sm mt-2">The host is setting things up.</p>
                </div>
              </div>
            )}

            {race.status !== 'setup' && raceFinished && (
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center animate-fade-in">
                  <p className="text-5xl mb-4">🏆</p>
                  <h2 className="font-display text-3xl text-accent">RACE COMPLETE</h2>
                  <p className="text-text-dim text-sm mt-2">You finished all {totalCheckpoints} checkpoints!</p>
                  <p className="text-text-muted text-xs mt-1">Time: {elapsed(race.started_at)}</p>
                  <button onClick={() => setTab('board')} className="btn-primary mt-6 !w-auto">View Leaderboard</button>
                </div>
              </div>
            )}

            {race.status === 'active' && totalCheckpoints === 0 && (
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                  <p className="text-5xl mb-4">🏃</p>
                  <h2 className="font-display text-2xl text-accent">RACE ON</h2>
                  <p className="text-text-dim text-sm mt-2">Waiting for the host to set up checkpoints...</p>
                </div>
              </div>
            )}

            {race.status === 'active' && activeCp && !raceFinished && (
              <div className="animate-fade-in">
                {/* Leg Header */}
                {currentLeg && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-display shrink-0">{currentLegIdx + 1}</div>
                      <p className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold">{currentLeg.name}</p>
                    </div>
                    <div className="flex gap-1.5 ml-9">
                      {checkpoints
                        .filter(cp => cp.leg_id === currentLeg.id)
                        .sort((a, b) => a.order_num - b.order_num)
                        .map(cp => (
                          <div key={cp.id} className={`w-2.5 h-2.5 rounded-full transition-all ${
                            completedIds.has(cp.id) || (race.admin_playing && pendingIds.has(cp.id))
                              ? 'bg-success'
                              : cp.id === activeCp.id ? 'bg-accent animate-pulse' : 'bg-border'
                          }`} />
                        ))}
                    </div>
                  </div>
                )}

                {/* Checkpoint Card */}
                <div className={`card !p-0 overflow-hidden border ${TYPE_COLORS[activeCp.type].split(' ').pop()}`}>
                  <div className={`px-5 py-3 flex items-center gap-2 ${TYPE_COLORS[activeCp.type].split(' ').slice(0, 2).join(' ')}`}>
                    <span className="text-xl">{TYPE_ICONS[activeCp.type]}</span>
                    <span className="text-xs font-bold uppercase tracking-[2px]">{TYPE_LABELS[activeCp.type]}</span>
                  </div>

                  <div className="p-5">
                    <h2 className="font-display text-2xl text-accent tracking-wider mb-2">{activeCp.name}</h2>
                    {activeCp.description && <p className="text-text-primary text-[15px] leading-relaxed mb-4">{activeCp.description}</p>}
                    {activeCp.clue_text && (
                      <div className="bg-surface border border-border rounded-xl p-4 mb-4">
                        <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-1">📍 Clue</p>
                        <p className="text-text-primary text-sm italic">{activeCp.clue_text}</p>
                      </div>
                    )}

                    {/* Minigame */}
                    {activeCp.type === 'minigame' && !gaveUp && (
                      <MinigamePlayer type={activeCp.mini_game_type} answer={activeCp.answer} onSolve={solveMinigame} />
                    )}

                    {/* Give Up — answer reveal (minigame) */}
                    {activeCp.type === 'minigame' && gaveUp && (
                      <div className="text-center py-6 animate-fade-in">
                        <p className="text-[11px] text-text-muted uppercase tracking-[2px] font-bold mb-2">The answer was</p>
                        <p className="font-display text-4xl text-accent tracking-[6px] mb-4">{activeCp.answer?.toUpperCase() || '—'}</p>
                        <p className="text-text-dim text-sm animate-pulse">Moving on…</p>
                      </div>
                    )}

                    {/* Challenge / Roadblock — Photo Proof */}
                    {activeCp.type !== 'minigame' && !isPending && !gaveUp && (
                      <div>
                        {isRejected && (
                          <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 mb-3 animate-fade-in">
                            <p className="text-danger text-sm font-semibold">✗ Submission rejected — try again!</p>
                          </div>
                        )}
                        <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-3">Submit photo proof</p>

                        {/* Hidden file input */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoCapture}
                          className="hidden"
                        />

                        {/* Photo preview or capture button */}
                        {!photoPreview ? (
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-8 rounded-xl border-2 border-dashed border-border hover:border-accent/40 bg-surface/50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all mb-3"
                          >
                            <span className="text-4xl">📸</span>
                            <span className="text-sm font-semibold text-text-dim">Take a Photo</span>
                            <span className="text-[10px] text-text-muted">Tap to open camera</span>
                          </button>
                        ) : (
                          <div className="mb-3 animate-fade-in">
                            <div className="relative rounded-xl overflow-hidden border border-border">
                              <img src={photoPreview} alt="Proof" className="w-full max-h-[240px] object-cover" />
                              <button
                                onClick={() => { setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-bg/80 border border-border text-text-dim flex items-center justify-center text-sm cursor-pointer hover:bg-danger/20 hover:text-danger transition-all"
                              >
                                ✕
                              </button>
                            </div>
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="text-xs text-text-dim mt-2 underline cursor-pointer"
                            >
                              Retake photo
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => submitProof(photoPreview || 'photo_submitted')}
                          disabled={!photoPreview || submitting}
                          className="btn-primary flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <><span className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />Submitting…</>
                          ) : race?.admin_playing ? 'Submit & Continue →' : 'Submit for Review'}
                        </button>
                        {race?.admin_playing && (
                          <p className="text-[10px] text-text-muted text-center mt-2">📸 Photo saved — you can keep going!</p>
                        )}
                      </div>
                    )}

                    {/* Give Up — answer reveal (challenge/roadblock) */}
                    {activeCp.type !== 'minigame' && gaveUp && (
                      <div className="text-center py-6 animate-fade-in">
                        <p className="text-text-muted text-sm mb-2">Checkpoint passed.</p>
                        <p className="text-text-dim text-sm animate-pulse">Moving on…</p>
                      </div>
                    )}

                    {/* Give Up / Pass Button */}
                    {!gaveUp && !isPending && (
                      <div className="mt-4 pt-3 border-t border-border/50">
                        {!showGiveUpConfirm ? (
                          <button
                            onClick={() => setShowGiveUpConfirm(true)}
                            className="w-full py-2 text-xs text-text-muted hover:text-text-dim transition-all cursor-pointer bg-transparent border-none"
                          >
                            Stuck? Pass this checkpoint →
                          </button>
                        ) : (
                          <div className="animate-fade-in">
                            <p className="text-sm text-text-dim text-center mb-2">
                              {activeCp.type === 'minigame'
                                ? 'Give up? The answer will be revealed.'
                                : 'Skip this checkpoint? It will count as passed.'}
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setShowGiveUpConfirm(false)}
                                className="flex-1 py-2 rounded-lg border border-border text-text-dim text-sm font-semibold cursor-pointer bg-transparent"
                              >
                                Keep trying
                              </button>
                              <button
                                onClick={handleGiveUp}
                                className="flex-1 py-2 rounded-lg border border-danger/30 bg-danger/10 text-danger text-sm font-semibold cursor-pointer"
                              >
                                Pass
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pending (only shown when NOT admin_playing) */}
                    {isPending && !race.admin_playing && (
                      <div className="text-center py-6 animate-fade-in">
                        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
                          <span className="text-2xl animate-pulse">⏳</span>
                        </div>
                        <p className="font-display text-xl text-accent">AWAITING REVIEW</p>
                        <p className="text-text-dim text-sm mt-1">The host is reviewing your submission...</p>
                      </div>
                    )}

                    {submitted && <p className="text-success text-sm text-center mt-2 animate-fade-in font-semibold">✓ Submitted!</p>}
                  </div>
                </div>

                {/* Completed */}
                {doneCount > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-2">Completed ({doneCount})</p>
                    {orderedCheckpoints
                      .filter(cp => completedIds.has(cp.id) || (race.admin_playing && pendingIds.has(cp.id)))
                      .map(cp => (
                        <div key={cp.id} className="flex items-center gap-2 py-2 border-b border-border/50 last:border-none">
                          <span className="text-success text-sm">✓</span>
                          <span className="text-sm text-text-muted">{TYPE_ICONS[cp.type]}</span>
                          <span className="text-sm text-text-dim">{cp.name}</span>
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
          <div>
            {!MAPBOX_TOKEN && (
              <div className="card !bg-info/5 !border-info/20 text-center mb-4">
                <p className="text-info text-sm">Map requires Mapbox token</p>
              </div>
            )}
            <div ref={mapContainerRef} className="w-full rounded-xl overflow-hidden border border-border" style={{ height: 350 }} />
            <p className="text-[10px] text-text-muted text-center mt-2">
              🟢 Completed · 🟡 Current · Hidden checkpoints revealed as you progress
            </p>
          </div>
        )}

        {/* ── BOARD TAB ── */}
        {tab === 'board' && (
          <div className="animate-fade-in">
            <h2 className="font-display text-xl text-accent tracking-wider mb-4">LEADERBOARD</h2>
            {leaderboard.length === 0 && <p className="text-text-dim text-center py-8">No teams yet.</p>}
            {leaderboard.map((t, i) => {
              const isMe = t.id === teamId;
              const pct = totalCheckpoints > 0 ? (t.completed / totalCheckpoints) * 100 : 0;
              return (
                <div key={t.id} className={`card flex items-center gap-3 ${isMe ? '!border-accent/30' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-lg shrink-0 ${
                    i === 0 ? 'bg-accent/15 text-accent' : i === 1 ? 'bg-text-dim/10 text-text-dim' : 'bg-surface text-text-muted'
                  }`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold text-sm truncate ${isMe ? 'text-accent' : ''}`}>{t.name}</p>
                      {isMe && <span className="text-[9px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-bold uppercase">You</span>}
                    </div>
                    <div className="h-1 rounded-full bg-border overflow-hidden mt-1.5">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <p className="text-sm font-mono text-text-dim shrink-0">{t.completed}/{totalCheckpoints}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
