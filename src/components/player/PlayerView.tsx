'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { elapsed } from '@/lib/utils';
import type { Race, Team, Leg, Checkpoint, Progress } from '@/lib/supabase';

type Props = { raceId: string; teamId: string; onExit: () => void };

const TYPE_ICONS: Record<string, string> = {
  challenge: '🏁',
  roadblock: '🚧',
  minigame: '🧩',
};

const TYPE_LABELS: Record<string, string> = {
  challenge: 'Challenge',
  roadblock: 'Roadblock',
  minigame: 'Minigame',
};

const TYPE_COLORS: Record<string, string> = {
  challenge: 'bg-accent/15 text-accent border-accent/20',
  roadblock: 'bg-danger/15 text-danger border-danger/20',
  minigame: 'bg-purple/15 text-purple border-purple/20',
};

// ── Minigame Components ──────────────────────────────────────────

function UnscrambleGame({ answer, onSolve }: { answer: string; onSolve: () => void }) {
  const [guess, setGuess] = useState('');
  const [error, setError] = useState(false);
  const scrambled = answer
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
    .toUpperCase();

  const check = () => {
    if (guess.trim().toLowerCase() === answer.toLowerCase()) {
      onSolve();
    } else {
      setError(true);
      setTimeout(() => setError(false), 1000);
    }
  };

  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-2 font-bold">Unscramble the word</p>
      <p className="font-display text-4xl text-accent tracking-[8px] mb-6">{scrambled}</p>
      <input
        className={`input-field text-center text-lg font-bold tracking-wider ${error ? 'animate-shake !border-danger' : ''}`}
        placeholder="Your answer..."
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && check()}
        autoFocus
      />
      <button onClick={check} className="btn-primary mt-2">Submit Answer</button>
    </div>
  );
}

function MemoryGame({ onSolve }: { onSolve: () => void }) {
  const emojis = ['🏔️', '🌊', '🏛️', '🎭', '🗽', '🎪'];
  const [cards] = useState(() => {
    const pairs = [...emojis, ...emojis];
    return pairs.sort(() => Math.random() - 0.5);
  });
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [checking, setChecking] = useState(false);

  const handleFlip = (i: number) => {
    if (checking || flipped.includes(i) || matched.includes(i)) return;
    const next = [...flipped, i];
    setFlipped(next);

    if (next.length === 2) {
      setChecking(true);
      if (cards[next[0]] === cards[next[1]]) {
        const newMatched = [...matched, next[0], next[1]];
        setMatched(newMatched);
        setFlipped([]);
        setChecking(false);
        if (newMatched.length === cards.length) {
          setTimeout(onSolve, 500);
        }
      } else {
        setTimeout(() => {
          setFlipped([]);
          setChecking(false);
        }, 800);
      }
    }
  };

  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-3 font-bold">Match all pairs</p>
      <div className="grid grid-cols-4 gap-2 max-w-[280px] mx-auto">
        {cards.map((emoji, i) => {
          const isVisible = flipped.includes(i) || matched.includes(i);
          const isMatched = matched.includes(i);
          return (
            <button
              key={i}
              onClick={() => handleFlip(i)}
              className={`w-16 h-16 rounded-xl text-2xl flex items-center justify-center cursor-pointer transition-all border ${
                isMatched
                  ? 'bg-success/10 border-success/30'
                  : isVisible
                  ? 'bg-card border-accent/30'
                  : 'bg-surface border-border hover:border-text-muted'
              }`}
            >
              {isVisible ? emoji : '?'}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-text-dim mt-3">{matched.length / 2} / {emojis.length} pairs found</p>
    </div>
  );
}

function CipherGame({ answer, onSolve }: { answer: string; onSolve: () => void }) {
  const [guess, setGuess] = useState('');
  const [error, setError] = useState(false);
  const shift = 3;
  const encoded = answer
    .toUpperCase()
    .split('')
    .map((c) => {
      if (c >= 'A' && c <= 'Z') {
        return String.fromCharCode(((c.charCodeAt(0) - 65 + shift) % 26) + 65);
      }
      return c;
    })
    .join('');

  const check = () => {
    if (guess.trim().toLowerCase() === answer.toLowerCase()) {
      onSolve();
    } else {
      setError(true);
      setTimeout(() => setError(false), 1000);
    }
  };

  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-1 font-bold">Decode the cipher</p>
      <p className="text-xs text-text-muted mb-3">Each letter is shifted by {shift} positions</p>
      <p className="font-mono text-3xl text-accent tracking-[6px] mb-6 font-bold">{encoded}</p>
      <input
        className={`input-field text-center text-lg font-bold tracking-wider ${error ? 'animate-shake !border-danger' : ''}`}
        placeholder="Decoded answer..."
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && check()}
        autoFocus
      />
      <button onClick={check} className="btn-primary mt-2">Submit Answer</button>
    </div>
  );
}

function MinigamePlayer({ type, answer, onSolve }: { type: string; answer: string; onSolve: () => void }) {
  switch (type) {
    case 'unscramble':
      return <UnscrambleGame answer={answer} onSolve={onSolve} />;
    case 'memory':
      return <MemoryGame onSolve={onSolve} />;
    case 'cipher':
      return <CipherGame answer={answer} onSolve={onSolve} />;
    default:
      // Fallback: simple answer input
      return <UnscrambleGame answer={answer} onSolve={onSolve} />;
  }
}

// ── Main PlayerView ──────────────────────────────────────────────

export default function PlayerView({ raceId, teamId, onExit }: Props) {
  const [race, setRace] = useState<Race | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allProgress, setAllProgress] = useState<Progress[]>([]);
  const [tab, setTab] = useState<'race' | 'map' | 'board'>('race');
  const [proofText, setProofText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      const legIds = (l.data || []).map((x) => x.id);
      setCheckpoints(c.data.filter((cp) => legIds.includes(cp.leg_id)));
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

  // ── Derived State ────────────────────────────────────────────

  // All checkpoints in order (leg order → checkpoint order)
  const orderedCheckpoints = legs.flatMap((leg) =>
    checkpoints.filter((cp) => cp.leg_id === leg.id).sort((a, b) => a.order_num - b.order_num)
  );

  // Completed checkpoint IDs
  const completedIds = new Set(
    progress.filter((p) => p.status === 'complete').map((p) => p.checkpoint_id)
  );

  // Pending checkpoint IDs
  const pendingIds = new Set(
    progress.filter((p) => p.status === 'pending').map((p) => p.checkpoint_id)
  );

  // Rejected checkpoint IDs
  const rejectedIds = new Set(
    progress.filter((p) => p.status === 'rejected').map((p) => p.checkpoint_id)
  );

  // Current checkpoint = first one not completed
  const currentCheckpoint = orderedCheckpoints.find((cp) => !completedIds.has(cp.id));
  const currentLeg = currentCheckpoint ? legs.find((l) => l.id === currentCheckpoint.leg_id) : null;
  const currentLegIdx = currentLeg ? legs.indexOf(currentLeg) : -1;

  const totalCheckpoints = orderedCheckpoints.length;
  const completedCount = completedIds.size;
  const progressPct = totalCheckpoints > 0 ? (completedCount / totalCheckpoints) * 100 : 0;

  const isPending = currentCheckpoint ? pendingIds.has(currentCheckpoint.id) : false;
  const isRejected = currentCheckpoint ? rejectedIds.has(currentCheckpoint.id) : false;

  // ── Actions ──────────────────────────────────────────────────

  const submitProof = async (proof: string) => {
    if (!currentCheckpoint || submitting) return;
    setSubmitting(true);

    // Check if there's already a rejected entry — update it
    const existing = progress.find(
      (p) => p.checkpoint_id === currentCheckpoint.id && p.status === 'rejected'
    );

    if (existing) {
      await supabase
        .from('progress')
        .update({ proof, status: 'pending', submitted_at: new Date().toISOString(), reviewed_at: null })
        .eq('id', existing.id);
    } else {
      await supabase.from('progress').insert({
        team_id: teamId,
        checkpoint_id: currentCheckpoint.id,
        status: 'pending',
        proof,
      });
    }

    setProofText('');
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
    fetchAll();
  };

  const solveMinigame = async () => {
    if (!currentCheckpoint) return;
    // Minigames auto-complete (no approval needed)
    const existing = progress.find((p) => p.checkpoint_id === currentCheckpoint.id);
    if (existing) {
      await supabase
        .from('progress')
        .update({ status: 'complete', proof: 'minigame_solved', reviewed_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('progress').insert({
        team_id: teamId,
        checkpoint_id: currentCheckpoint.id,
        status: 'complete',
        proof: 'minigame_solved',
      });
    }
    fetchAll();
  };

  // ── Leaderboard ──────────────────────────────────────────────

  const leaderboard = allTeams
    .map((t) => {
      const teamProgress = allProgress.filter((p) => p.team_id === t.id && p.status === 'complete');
      return { ...t, completed: teamProgress.length };
    })
    .sort((a, b) => b.completed - a.completed);

  // ── Render ───────────────────────────────────────────────────

  if (!race || !team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-dim animate-pulse">Loading...</p>
      </div>
    );
  }

  const raceFinished = race.status === 'finished' || (!currentCheckpoint && completedCount > 0);

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center px-4 pt-4">
        <div>
          <p className="text-[10px] text-text-dim tracking-[3px] uppercase">{race.city || 'Race'}</p>
          <h1 className="font-display text-xl text-accent tracking-wider">{team.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`badge ${
              race.status === 'active'
                ? 'bg-success/20 text-success'
                : 'bg-text-muted/20 text-text-muted'
            }`}
          >
            {race.status === 'active' ? 'LIVE' : race.status === 'finished' ? 'END' : 'WAIT'}
          </span>
          <button onClick={onExit} className="btn-sm !py-1.5 !px-3 text-xs">
            Exit
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {race.status === 'active' && totalCheckpoints > 0 && (
        <div className="mx-4 mt-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-text-dim font-bold uppercase tracking-wide">
              Progress
            </span>
            <span className="text-[10px] text-text-muted font-mono">
              {completedCount}/{totalCheckpoints}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border mx-4 mt-2">
        {(['race', 'map', 'board'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tab ${tab === t ? 'tab-active' : 'tab-inactive'}`}
          >
            {t === 'board' ? 'Board' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {/* ── RACE TAB ── */}
        {tab === 'race' && (
          <div>
            {/* Waiting state */}
            {race.status === 'setup' && (
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                  <p className="text-5xl mb-4">⏳</p>
                  <h2 className="font-display text-2xl text-accent">WAITING TO START</h2>
                  <p className="text-text-dim text-sm mt-2">The host is setting things up.</p>
                </div>
              </div>
            )}

            {/* Finished state */}
            {race.status !== 'setup' && raceFinished && (
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center animate-fade-in">
                  <p className="text-5xl mb-4">🏆</p>
                  <h2 className="font-display text-3xl text-accent">RACE COMPLETE</h2>
                  <p className="text-text-dim text-sm mt-2">
                    You finished all {totalCheckpoints} checkpoints!
                  </p>
                  <p className="text-text-muted text-xs mt-1">
                    Time: {elapsed(race.started_at)}
                  </p>
                  <button onClick={() => setTab('board')} className="btn-primary mt-6 !w-auto">
                    View Leaderboard
                  </button>
                </div>
              </div>
            )}

            {/* Active race with no checkpoints set up */}
            {race.status === 'active' && totalCheckpoints === 0 && (
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                  <p className="text-5xl mb-4">🏃</p>
                  <h2 className="font-display text-2xl text-accent">RACE ON</h2>
                  <p className="text-text-dim text-sm mt-2">
                    Waiting for the host to set up checkpoints...
                  </p>
                </div>
              </div>
            )}

            {/* Active race with current checkpoint */}
            {race.status === 'active' && currentCheckpoint && !raceFinished && (
              <div className="animate-fade-in">
                {/* Current Leg Header */}
                {currentLeg && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-display shrink-0">
                        {currentLegIdx + 1}
                      </div>
                      <p className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold">
                        {currentLeg.name}
                      </p>
                    </div>
                    {/* Leg checkpoint dots */}
                    <div className="flex gap-1.5 ml-9">
                      {checkpoints
                        .filter((cp) => cp.leg_id === currentLeg.id)
                        .sort((a, b) => a.order_num - b.order_num)
                        .map((cp) => (
                          <div
                            key={cp.id}
                            className={`w-2.5 h-2.5 rounded-full transition-all ${
                              completedIds.has(cp.id)
                                ? 'bg-success'
                                : cp.id === currentCheckpoint.id
                                ? 'bg-accent animate-pulse'
                                : 'bg-border'
                            }`}
                          />
                        ))}
                    </div>
                  </div>
                )}

                {/* Checkpoint Card */}
                <div className={`card !p-0 overflow-hidden border ${TYPE_COLORS[currentCheckpoint.type].split(' ').pop()}`}>
                  {/* Type Header */}
                  <div className={`px-5 py-3 flex items-center gap-2 ${TYPE_COLORS[currentCheckpoint.type].split(' ').slice(0, 2).join(' ')}`}>
                    <span className="text-xl">{TYPE_ICONS[currentCheckpoint.type]}</span>
                    <span className="text-xs font-bold uppercase tracking-[2px]">
                      {TYPE_LABELS[currentCheckpoint.type]}
                    </span>
                  </div>

                  <div className="p-5">
                    {/* Checkpoint name */}
                    <h2 className="font-display text-2xl text-accent tracking-wider mb-2">
                      {currentCheckpoint.name}
                    </h2>

                    {/* Description */}
                    {currentCheckpoint.description && (
                      <p className="text-text-primary text-[15px] leading-relaxed mb-4">
                        {currentCheckpoint.description}
                      </p>
                    )}

                    {/* Clue */}
                    {currentCheckpoint.clue_text && (
                      <div className="bg-surface border border-border rounded-xl p-4 mb-4">
                        <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-1">
                          📍 Clue
                        </p>
                        <p className="text-text-primary text-sm italic">
                          {currentCheckpoint.clue_text}
                        </p>
                      </div>
                    )}

                    {/* ── Minigame ── */}
                    {currentCheckpoint.type === 'minigame' && !isPending && (
                      <MinigamePlayer
                        type={currentCheckpoint.mini_game_type}
                        answer={currentCheckpoint.answer}
                        onSolve={solveMinigame}
                      />
                    )}

                    {/* ── Challenge / Roadblock proof submission ── */}
                    {currentCheckpoint.type !== 'minigame' && !isPending && (
                      <div>
                        {isRejected && (
                          <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 mb-3 animate-fade-in">
                            <p className="text-danger text-sm font-semibold">
                              ✗ Submission rejected — try again!
                            </p>
                          </div>
                        )}
                        <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-2">
                          Submit proof
                        </p>
                        <textarea
                          className="input-field !mb-2 resize-none min-h-[80px]"
                          placeholder="Describe what you did or paste a photo link..."
                          value={proofText}
                          onChange={(e) => setProofText(e.target.value)}
                          rows={3}
                        />
                        <button
                          onClick={() => submitProof(proofText)}
                          disabled={!proofText.trim() || submitting}
                          className="btn-primary flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <span className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />
                              Submitting…
                            </>
                          ) : (
                            'Submit for Review'
                          )}
                        </button>
                      </div>
                    )}

                    {/* ── Pending approval state ── */}
                    {isPending && (
                      <div className="text-center py-6 animate-fade-in">
                        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
                          <span className="text-2xl animate-pulse">⏳</span>
                        </div>
                        <p className="font-display text-xl text-accent">AWAITING REVIEW</p>
                        <p className="text-text-dim text-sm mt-1">
                          The host is reviewing your submission...
                        </p>
                      </div>
                    )}

                    {submitted && (
                      <p className="text-success text-sm text-center mt-2 animate-fade-in font-semibold">
                        ✓ Submitted!
                      </p>
                    )}
                  </div>
                </div>

                {/* Completed checkpoints summary */}
                {completedCount > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-2">
                      Completed ({completedCount})
                    </p>
                    {orderedCheckpoints
                      .filter((cp) => completedIds.has(cp.id))
                      .map((cp) => (
                        <div
                          key={cp.id}
                          className="flex items-center gap-2 py-2 border-b border-border/50 last:border-none"
                        >
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
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <p className="text-4xl mb-3">🗺️</p>
              <p className="text-text-dim text-sm">Map coming soon</p>
            </div>
          </div>
        )}

        {/* ── BOARD TAB ── */}
        {tab === 'board' && (
          <div className="animate-fade-in">
            <h2 className="font-display text-xl text-accent tracking-wider mb-4">LEADERBOARD</h2>
            {leaderboard.length === 0 && (
              <p className="text-text-dim text-center py-8">No teams yet.</p>
            )}
            {leaderboard.map((t, i) => {
              const isMe = t.id === teamId;
              const pct =
                totalCheckpoints > 0 ? (t.completed / totalCheckpoints) * 100 : 0;
              return (
                <div
                  key={t.id}
                  className={`card flex items-center gap-3 ${isMe ? '!border-accent/30' : ''}`}
                >
                  {/* Rank */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-lg shrink-0 ${
                      i === 0
                        ? 'bg-accent/15 text-accent'
                        : i === 1
                        ? 'bg-text-dim/10 text-text-dim'
                        : i === 2
                        ? 'bg-accent-dim/10 text-accent-dim'
                        : 'bg-surface text-text-muted'
                    }`}
                  >
                    {i + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold text-sm truncate ${isMe ? 'text-accent' : ''}`}>
                        {t.name}
                      </p>
                      {isMe && (
                        <span className="text-[9px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-bold uppercase">
                          You
                        </span>
                      )}
                    </div>
                    {/* Mini progress bar */}
                    <div className="h-1 rounded-full bg-border overflow-hidden mt-1.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-sm font-mono text-text-dim shrink-0">
                    {t.completed}/{totalCheckpoints}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
