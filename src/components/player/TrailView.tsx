'use client';

import { useMemo } from 'react';

/** Loose shapes on purpose — adapts to whatever PlayerView already holds. */
type AnyCheckpoint = {
  id: string;
  type?: string;
  location_name?: string;
  name?: string;
  fun_fact?: string;
  order?: number;
  order_index?: number;
};

type AnyLeg = {
  id: string;
  title?: string;
  name?: string;
  order?: number;
  order_index?: number;
  checkpoints?: AnyCheckpoint[];
};

type AnyProgress = {
  checkpoint_id: string;
  completed_at?: string | null;
  elapsed_seconds?: number | null;
  photo_url?: string | null;
  skipped?: boolean;
};

interface TrailViewProps {
  legs: AnyLeg[];
  progress: AnyProgress[];
  mode?: 'race' | 'explore';
  /** Total elapsed seconds, shown in race mode. */
  totalElapsed?: number | null;
  penaltySeconds?: number | null;
  onClose: () => void;
}

function fmt(sec?: number | null) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m < 60) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

const TYPE_STYLE: Record<string, { label: string; cls: string }> = {
  challenge: { label: 'Challenge', cls: 'border-sky-400/30 text-sky-200' },
  detour: { label: 'Detour', cls: 'border-fuchsia-400/30 text-fuchsia-200' },
  roadblock: { label: 'Roadblock', cls: 'border-amber-400/30 text-amber-200' },
  pit_stop: { label: 'Pit stop', cls: 'border-emerald-400/40 text-emerald-200' },
  pitstop: { label: 'Pit stop', cls: 'border-emerald-400/40 text-emerald-200' },
};

export default function TrailView({
  legs,
  progress,
  mode = 'explore',
  totalElapsed,
  penaltySeconds,
  onClose,
}: TrailViewProps) {
  const done = useMemo(() => {
    const map = new Map<string, AnyProgress>();
    progress.forEach((p) => {
      if (p.completed_at || p.skipped) map.set(p.checkpoint_id, p);
    });
    return map;
  }, [progress]);

  const orderedLegs = useMemo(
    () =>
      [...legs].sort(
        (a, b) => (a.order ?? a.order_index ?? 0) - (b.order ?? b.order_index ?? 0)
      ),
    [legs]
  );

  const completedCount = done.size;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your trail</h2>
          <p className="text-xs text-zinc-400">
            {completedCount} stop{completedCount === 1 ? '' : 's'} behind you
            {mode === 'race' && totalElapsed != null ? ` · ${fmt(totalElapsed)}` : ''}
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
        {completedCount === 0 ? (
          <div className="mt-24 text-center">
            <p className="text-zinc-300">Nothing here yet.</p>
            <p className="mt-1 text-sm text-zinc-500">
              Clear your first stop and it'll show up here.
            </p>
          </div>
        ) : (
          orderedLegs.map((leg, li) => {
            const cps = [...(leg.checkpoints ?? [])].sort(
              (a, b) => (a.order ?? a.order_index ?? 0) - (b.order ?? b.order_index ?? 0)
            );
            const cleared = cps.filter((c) => done.has(c.id));
            if (cleared.length === 0) return null;
            const legComplete = cleared.length === cps.length;

            return (
              <section key={leg.id} className="mb-8">
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Leg {li + 1}
                  </span>
                  <h3 className="text-sm text-zinc-300">{leg.title ?? leg.name ?? ''}</h3>
                </div>

                <ol className="relative border-l border-white/10 pl-5">
                  {cleared.map((cp) => {
                    const p = done.get(cp.id)!;
                    const t = TYPE_STYLE[(cp.type ?? '').toLowerCase()];
                    return (
                      <li key={cp.id} className="relative mb-5">
                        <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />
                        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-medium leading-snug">
                              {cp.location_name ?? cp.name ?? 'Checkpoint'}
                            </p>
                            {t && (
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${t.cls}`}
                              >
                                {t.label}
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                            {fmt(p.elapsed_seconds) && <span>{fmt(p.elapsed_seconds)}</span>}
                            {p.skipped && <span className="text-amber-300/80">Skipped</span>}
                          </div>

                          {p.photo_url && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={p.photo_url}
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

        {mode === 'race' && penaltySeconds ? (
          <p className="pb-6 text-center text-xs text-amber-300/70">
            Penalties applied: {fmt(penaltySeconds)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
