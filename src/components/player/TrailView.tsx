'use client';

import { useMemo } from 'react';

type Leg = { id: string; name: string; order_num: number; race_id?: string };

type Checkpoint = {
  id: string;
  leg_id: string;
  name: string;
  type: string; // challenge | roadblock | detour | pitstop | minigame
  order_num: number;
  fun_fact?: string | null;
  location_answer?: string | null;
  clue_type?: string | null;
};

type Progress = {
  id: string;
  team_id: string | null;
  checkpoint_id: string | null;
  status: string | null; // pending | complete | rejected
  proof?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
};

interface TrailViewProps {
  legs: Leg[];
  checkpoints: Checkpoint[];
  progress: Progress[];
  gameMode?: 'race' | 'explorer';
  /** races.started_at — used to derive elapsed time per checkpoint. */
  startedAt?: string | null;
  onClose: () => void;
}

const TYPE_STYLE: Record<string, { label: string; cls: string }> = {
  challenge: { label: 'Challenge', cls: 'border-sky-400/30 text-sky-200' },
  detour: { label: 'Detour', cls: 'border-fuchsia-400/30 text-fuchsia-200' },
  roadblock: { label: 'Roadblock', cls: 'border-amber-400/30 text-amber-200' },
  pitstop: { label: 'Pit stop', cls: 'border-emerald-400/40 text-emerald-200' },
  minigame: { label: 'Puzzle', cls: 'border-violet-400/30 text-violet-200' },
};

function fmtGap(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  if (m < 1) return `${s}s`;
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** proof is a text column — could be a URL, a data URI, or freeform text. */
function isImage(proof?: string | null) {
  if (!proof) return false;
  return /^data:image\//.test(proof) || /^https?:\/\/.+\.(png|jpe?g|webp|gif)/i.test(proof);
}

export default function TrailView({
  legs,
  checkpoints,
  progress,
  gameMode = 'explorer',
  startedAt,
  onClose,
}: TrailViewProps) {
  const cleared = useMemo(() => {
    const map = new Map<string, Progress>();
    progress
      .filter((p) => p.status === 'complete' && p.checkpoint_id)
      .forEach((p) => map.set(p.checkpoint_id as string, p));
    return map;
  }, [progress]);

  /** Elapsed per checkpoint = gap from race start, or from the previous submission. */
  const gaps = useMemo(() => {
    const done = progress
      .filter((p) => p.status === 'complete' && p.submitted_at && p.checkpoint_id)
      .sort(
        (a, b) =>
          new Date(a.submitted_at as string).getTime() -
          new Date(b.submitted_at as string).getTime()
      );
    const out = new Map<string, string>();
    let prev = startedAt ? new Date(startedAt).getTime() : null;
    done.forEach((p) => {
      const t = new Date(p.submitted_at as string).getTime();
      if (prev !== null) out.set(p.checkpoint_id as string, fmtGap(t - prev));
      prev = t;
    });
    return out;
  }, [progress, startedAt]);

  const totalElapsed = useMemo(() => {
    if (!startedAt) return null;
    const times = progress
      .filter((p) => p.status === 'complete' && p.submitted_at)
      .map((p) => new Date(p.submitted_at as string).getTime());
    if (!times.length) return null;
    return fmtGap(Math.max(...times) - new Date(startedAt).getTime());
  }, [progress, startedAt]);

  const orderedLegs = useMemo(
    () => [...legs].sort((a, b) => a.order_num - b.order_num),
    [legs]
  );

  const count = cleared.size;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your trail</h2>
          <p className="text-xs text-zinc-400">
            {count} stop{count === 1 ? '' : 's'} behind you
            {gameMode === 'race' && totalElapsed ? ` · ${totalElapsed}` : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-xl border border-white/10 px-3.5 py-2 text-sm text-zinc-300"
        >
          Close
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4">
        {count === 0 ? (
          <div className="mt-24 text-center">
            <p className="text-zinc-300">Nothing here yet.</p>
            <p className="mt-1 text-sm text-zinc-500">
              Clear your first stop and it'll show up here.
            </p>
          </div>
        ) : (
          orderedLegs.map((leg, li) => {
            const cps = checkpoints
              .filter((c) => c.leg_id === leg.id)
              .sort((a, b) => a.order_num - b.order_num);
            const doneCps = cps.filter((c) => cleared.has(c.id));
            if (!doneCps.length) return null;
            const legComplete = doneCps.length === cps.length;

            return (
              <section key={leg.id} className="mb-8">
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Leg {li + 1}
                  </span>
                  <h3 className="text-sm text-zinc-300">{leg.name}</h3>
                </div>

                <ol className="relative border-l border-white/10 pl-5">
                  {doneCps.map((cp) => {
                    const p = cleared.get(cp.id)!;
                    const t = TYPE_STYLE[(cp.type || '').toLowerCase()];
                    const gap = gaps.get(cp.id);
                    return (
                      <li key={cp.id} className="relative mb-5">
                        <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />
                        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-medium leading-snug">
                              {cp.location_answer || cp.name}
                            </p>
                            {t && (
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${t.cls}`}
                              >
                                {t.label}
                              </span>
                            )}
                          </div>

                          {gap && <p className="mt-1 text-xs text-zinc-500">{gap}</p>}

                          {isImage(p.proof) && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={p.proof as string}
                              alt=""
                              className="mt-3 h-40 w-full rounded-xl object-cover"
                            />
                          )}

                          {cp.fun_fact && (
                            <p className="mt-3 border-t border-white/5 pt-3 text-sm leading-relaxed text-zinc-400">
                              {cp.fun_fact}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {legComplete && (
                  <div className="mt-1 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
                    <span className="h-px flex-1 bg-emerald-400/20" />
                    Leg {li + 1} cleared
                    <span className="h-px flex-1 bg-emerald-400/20" />
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
