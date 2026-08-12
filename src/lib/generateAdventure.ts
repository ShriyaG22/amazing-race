/**
 * Generates an adventure one leg at a time.
 *
 * Generating everything in a single request exceeded the 60s serverless limit
 * once web search was involved, which surfaced as a 504 and a dead spinner.
 * Each leg is its own request, so nothing gets close to the limit — and progress
 * becomes real rather than a timer pretending.
 */

export type GenerateParams = Record<string, any>;

export type LegProgress = {
  legIndex: number;
  totalLegs: number;
  phase: 'searching' | 'writing' | 'saving';
};

type PriorLeg = {
  name: string;
  locations: string[];
  endLocation?: string;
  endLat?: number | null;
  endLng?: number | null;
};

const LEG_TIMEOUT_MS = 65000;

async function generateOneLeg(params: GenerateParams, legIndex: number, priorLegs: PriorLeg[]) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LEG_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ ...params, legIndex, priorLegs }),
    });
  } finally {
    clearTimeout(timeoutId);
  }

  // A timed-out or crashed function returns HTML, not JSON.
  const raw = await res.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      res.status === 504
        ? `Leg ${legIndex + 1} timed out. Try a shorter duration.`
        : `Server returned an unreadable response (${res.status}).`
    );
  }
  if (!res.ok || data.error) throw new Error(data.error || `Leg ${legIndex + 1} failed`);
  if (!data.legs?.length) throw new Error(`Leg ${legIndex + 1} came back empty`);

  return data;
}

function summarise(leg: any): PriorLeg {
  const cps = leg.checkpoints || [];
  const last = cps[cps.length - 1];
  return {
    name: leg.name || '',
    locations: cps.map((c: any) => c.locationAnswer || c.name).filter(Boolean),
    endLocation: last ? (last.locationAnswer || last.name) : undefined,
    endLat: last?.lat ?? null,
    endLng: last?.lng ?? null,
  };
}

/**
 * Runs the whole generation. `onProgress` fires as each leg starts, and
 * `onLeg` fires as each leg completes so callers can save incrementally.
 */
export async function generateAdventure(
  params: GenerateParams,
  onProgress: (p: LegProgress) => void,
  onLeg?: (leg: any, index: number) => Promise<void> | void
) {
  const priorLegs: PriorLeg[] = [];
  const allLegs: any[] = [];
  let totalLegs = 1;
  let downgradedPuzzles = 0;
  const geo = { missing: 0, outOfRange: 0, duplicated: 0, longestHopM: 0 };

  for (let i = 0; i < totalLegs; i++) {
    onProgress({ legIndex: i, totalLegs, phase: 'searching' });

    const data = await generateOneLeg(params, i, priorLegs);

    // The first response tells us how many legs this adventure actually has.
    if (i === 0 && typeof data._totalLegs === 'number') totalLegs = data._totalLegs;

    const leg = data.legs[0];
    allLegs.push(leg);
    priorLegs.push(summarise(leg));

    downgradedPuzzles += data._downgradedPuzzles || 0;
    if (data._geo) {
      geo.missing += data._geo.missing || 0;
      geo.outOfRange += data._geo.outOfRange || 0;
      geo.duplicated += data._geo.duplicated || 0;
      geo.longestHopM = Math.max(geo.longestHopM, data._geo.longestHopM || 0);
    }

    onProgress({ legIndex: i, totalLegs, phase: 'saving' });
    if (onLeg) await onLeg(leg, i);
  }

  return { legs: allLegs, totalLegs, downgradedPuzzles, geo };
}

/** Human-readable status line for a given progress event. */
export function progressLabel(p: LegProgress) {
  const n = p.legIndex + 1;
  if (p.phase === 'searching') {
    return p.legIndex === 0
      ? 'Scouting the city…'
      : `Planning leg ${n} of ${p.totalLegs}…`;
  }
  if (p.phase === 'saving') return `Saving leg ${n}…`;
  return `Writing leg ${n}…`;
}
