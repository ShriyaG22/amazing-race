'use client';

import { useMemo } from 'react';

type Leg = { id: string; name: string; order_num: number };

type Checkpoint = {
  id: string;
  leg_id: string;
  name: string;
  type: string;
  order_num: number;
  fun_fact?: string | null;
  location_answer?: string | null;
};

type Progress = {
  id: string;
  team_id: string | null;
  checkpoint_id: string | null;
  status: string | null;
  proof?: string | null;
  submitted_at?: string | null;
};

interface TrailViewProps {
  legs: Leg[];
  checkpoints: Checkpoint[];
  progress: Progress[];
  completedIds: Set<string>;
  isExplorer?: boolean;
  startedAt?: string | null;
}

const TYPE_META: Record<string, { icon: string; label: string; cls: string }> = {
  challenge: { icon: '🏁', label: 'Challenge', cls: 'bg-accent/15 text-accent' },
  detour: { icon: '🔀', label: 'Detour', cls: 'bg-info/15 text-info' },
  roadblock: { icon: '🚧', label: 'Roadblock', cls: 'bg-danger/15 text-danger' },
  pitstop: { icon: '🏁', label: 'Pit Stop', cls: 'bg-success/15 text-success' },
  minigame: { icon: '🧩', label: 'Puzzle', cls: 'bg-purple/15 text-purple' },
};

function fmtGap(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  if (m < 1) return `${s}s`;
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** proof is a free text column — only render it when it's actually an image. */
function isImage(proof?: string | null) {
  if (!proof) return false;
  return /^data:image\//.test(proof) || /^https?:\/\/\S+\.(png|jpe?g|webp|gif)/i.test(proof);
}

export default function TrailView({
  legs,
  checkpoints,
  progress,
  completedIds,
  isExplorer,
  startedAt,
}: TrailViewProps) {
  const byCheckpoint = useMemo(() => {
    const map = new Map<string, Progress>();
    progress.forEach((p) => {
      if (p.checkpoint_id && (p.status === 'complete' || p.status === 'pending')) {
        map.set(p.checkpoint_id, p);
      }
    });
    return map;
  }, [progress]);

  /** No elapsed column in the schema — derive it from consecutive submitted_at values. */
  const gaps = useMemo(() => {
    const done = progress
      .filter((p) => p.submitted_at && p.checkpoint_id && completedIds.has(p.checkpoint_id))
      .sort(
        (a, b) =>
          new Date(a.submitted_at as string).getTime() -
          new Date(b.submitted_at as string).getTime()
      );
    const out = new Map<string, string>();
    let prev = startedAt ? new Date(startedAt).getTime() : null;
    done.forEach((p) => {
      const t = new Date(p.submitted_at as string).getTime();
      if (prev !== null && t >= prev) out.set(p.checkpoint_id as string, fmtGap(t - prev));
      prev = t;
    });
    return out;
  }, [progress, completedIds, startedAt]);

  const totalTime = useMemo(() => {
    if (!startedAt) return null;
    const times = progress
      .filter((p) => p.submitted_at && p.checkpoint_id && completedIds.has(p.checkpoint_id))
      .map((p) => new Date(p.submitted_at as string).getTime());
    if (!times.length) return null;
    return fmtGap(Math.max(...times) - new Date(startedAt).getTime());
  }, [progress, completedIds, startedAt]);

  const orderedLegs = useMemo(
    () => [...legs].sort((a, b) => a.order_num - b.order_num),
    [legs]
  );

  const doneCount = completedIds.size;

  if (doneCount === 0) {
    return (
      <div className="animate-fade-in flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <p className="text-4xl mb-3">🗺️</p>
          <h2 className="font-display text-xl text-accent tracking-wider mb-2">NOTHING HERE YET</h2>
          <p className="text-sm text-text-dim">
            Clear your first stop and it'll show up here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-xl text-accent tracking-wider">YOUR TRAIL</h2>
        <p className="text-xs text-text-muted font-mono">
          {doneCount} stop{doneCount === 1 ? '' : 's'}
          {!isExplorer && totalTime ? ` · ${totalTime}` : ''}
        </p>
      </div>

      {orderedLegs.map((leg, li) => {
        const cps = checkpoints
          .filter((c) => c.leg_id === leg.id)
          .sort((a, b) => a.order_num - b.order_num);
        const done = cps.filter((c) => completedIds.has(c.id));
        if (!done.length) return null;
        const legComplete = done.length === cps.length;

        return (
          <div key={leg.id} className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-display shrink-0">
                {li + 1}
              </div>
              <p className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold">
                {leg.name}
              </p>
            </div>

            <div className="relative pl-5 border-l border-border/50 ml-3">
              {done.map((cp) => {
                const p = byCheckpoint.get(cp.id);
                const meta = TYPE_META[(cp.type || '').toLowerCase()];
                const gap = gaps.get(cp.id);
                return (
                  <div key={cp.id} className="relative mb-4">
                    <span className="absolute -left-[27px] top-3 w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_8px_rgba(46,204,113,.6)]" />
                    <div className="card !mb-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="font-semibold text-sm text-text-primary leading-snug">
                          {cp.location_answer || cp.name}
                        </p>
                        {meta && (
                          <span className={`badge shrink-0 ${meta.cls}`}>
                            {meta.icon} {meta.label}
                          </span>
                        )}
                      </div>

                      {gap && <p className="text-[10px] text-text-muted font-mono mb-2">{gap}</p>}

                      {isImage(p?.proof) && (
                        <div className="rounded-xl overflow-hidden border border-border mb-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p!.proof as string}
                            alt=""
                            className="w-full max-h-[200px] object-cover"
                          />
                        </div>
                      )}

                      {cp.fun_fact && (
                        <div className="bg-surface/60 border border-border/60 rounded-xl p-3 mt-2">
                          <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-1">
                            💡 Did you know?
                          </p>
                          <p className="text-xs text-text-dim leading-relaxed">{cp.fun_fact}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {legComplete && (
              <div className="flex items-center gap-3 mt-1">
                <span className="h-px flex-1 bg-success/20" />
                <span className="text-[10px] text-success uppercase tracking-[2px] font-bold">
                  Leg {li + 1} complete
                </span>
                <span className="h-px flex-1 bg-success/20" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
