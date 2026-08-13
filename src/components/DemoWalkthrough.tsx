'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A clickable tour of one real route, playable from a desk.
 *
 * Most people arriving from a link will never walk anywhere — they'll give this
 * a minute on a laptop. This shows them the whole loop without GPS, a login,
 * or leaving the page. Entirely self-contained: no Supabase, no network calls.
 */

type DemoStop = {
  name: string;
  neighbourhood: string;
  lat: number;
  lng: number;
  type: 'challenge' | 'detour' | 'roadblock' | 'pitstop';
  clueText: string;          // contains _____ where the puzzle answer goes
  puzzleAnswer?: string;
  puzzleType?: 'unscramble' | 'cipher';
  challenge: string;
  funFact: string;
  /** Three plausible answers. The demo player has never been here, so typing
   *  the name is impossible — picking from options keeps the deduction beat
   *  without requiring local knowledge. */
  options: string[];
  /** How you'd actually get there from the previous stop. */
  travelNote?: string;
};

// A tour across the city rather than one neighbourhood — these are places
// someone who has never been to New York will still recognise.
const DEMO_STOPS: DemoStop[] = [
  {
    name: 'Grand Central Terminal',
    neighbourhood: 'Midtown East',
    lat: 40.7527, lng: -73.9772,
    type: 'challenge',
    clueText: 'Start where half a million people pass through every weekday. Look up in the main concourse: the whole _____ is painted with the constellations of the zodiac in gold — and every one of them is back to front.',
    puzzleAnswer: 'CEILING',
    puzzleType: 'unscramble',
    challenge: 'Find the Whispering Gallery on the level below, outside the Oyster Bar. Stand facing a corner of the tiled arch, have someone stand in the opposite corner, and speak into the wall. They will hear you clearly from thirty feet away.',
    funFact: 'When the ceiling was cleaned in the 1990s, restorers left one small dark rectangle near the crab untouched — it is decades of tar and nicotine, kept as a record of what the rest looked like.',
    options: ['Penn Station', 'Grand Central Terminal', 'Port Authority'],
  },
  {
    name: 'The New York Public Library',
    neighbourhood: 'Bryant Park',
    lat: 40.7532, lng: -73.9822,
    type: 'detour',
    clueText: 'Walk two blocks west along 42nd Street. Two marble _____ have guarded these steps since 1911. During the Depression the mayor named them for the qualities he thought New Yorkers would need to get through it.',
    puzzleAnswer: 'LIONS',
    puzzleType: 'cipher',
    challenge: 'Your detour: photograph both of them and work out which is which, or go inside and find the Rose Main Reading Room on the third floor.',
    funFact: 'Mayor Fiorello La Guardia named them Patience and Fortitude in the 1930s. Patience is the one on the south side, on your left as you face the building.',
    options: ['The Morgan Library', 'The New York Public Library', 'The Met'],
    travelNote: 'Two blocks west on 42nd Street — about five minutes on foot.',
  },
  {
    name: 'Bethesda Terrace',
    neighbourhood: 'Central Park',
    lat: 40.7740, lng: -73.9709,
    type: 'challenge',
    clueText: 'Head uptown into the park and find the terrace above the lake. At its centre a bronze _____ stands over the fountain, one hand raised over the water, commemorating a nineteenth-century aqueduct that finally gave the city clean water.',
    puzzleAnswer: 'ANGEL',
    puzzleType: 'unscramble',
    challenge: 'Go into the arcade underneath the terrace and look up. The ceiling is nearly sixteen thousand encaustic tiles made in Britain. Photograph the pattern where two arches meet.',
    funFact: 'Angel of the Waters was sculpted by Emma Stebbins in 1873 — the first major public art commission in New York City awarded to a woman. Her brother chaired the parks board at the time, which caused a certain amount of muttering.',
    options: ['Bethesda Terrace', 'Washington Square Park', 'Bryant Park'],
    travelNote: 'Take the B or D up to 72nd Street, then walk in from the west side. Around twenty minutes.',
  },
  {
    name: 'Brooklyn Bridge',
    neighbourhood: 'Lower Manhattan',
    lat: 40.7061, lng: -73.9969,
    type: 'roadblock',
    clueText: 'Come back downtown to where the walkway climbs above the traffic on wooden planks. When it opened in 1883 this was the longest suspension bridge in the world, and the first anywhere to be hung from steel _____ rather than iron.',
    puzzleAnswer: 'CABLES',
    puzzleType: 'cipher',
    challenge: 'One of you takes this alone. Walk to the first stone tower, find the plaque listing the people who built it, and bring back the name of the woman on it.',
    funFact: 'That woman is Emily Warren Roebling. When her husband was disabled by decompression sickness she taught herself engineering and ran the site for eleven years. She was the first person to cross when it opened, carrying a rooster for luck.',
    options: ['Manhattan Bridge', 'Williamsburg Bridge', 'Brooklyn Bridge'],
    travelNote: 'The 4, 5 or 6 downtown to Brooklyn Bridge–City Hall. About half an hour.',
  },
  {
    name: 'Battery Park',
    neighbourhood: 'The Battery',
    lat: 40.7033, lng: -74.0170,
    type: 'pitstop',
    clueText: 'Finish at the southern tip of the island, looking out across the harbour. From here you can see her raised _____ about a mile and a half offshore — the one she has held up since 1886.',
    puzzleAnswer: 'TORCH',
    puzzleType: 'unscramble',
    challenge: 'Leg complete. Find a bench facing the water and stay a while — you have earned it.',
    funFact: 'The torch you can see is not the original. The 1886 one leaked so badly after being modified that it was replaced in 1986, and now stands in the museum on Liberty Island.',
    travelNote: 'Walk south along the waterfront, about fifteen minutes.',
    options: ['Battery Park', 'Hudson Yards', 'Governors Island'],
  },
];

type Phase = 'intro' | 'clue' | 'verify' | 'travel' | 'challenge' | 'funfact' | 'done';

function scramble(word: string) {
  const a = word.split('');
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const out = a.join('');
  return out === word ? scramble(word) : out;
}

function caesar(word: string, shift: number) {
  return word.split('').map(c => String.fromCharCode(((c.charCodeAt(0) - 65 + shift) % 26) + 65)).join('');
}

function DemoMap({ lat, lng, revealed }: { lat: number; lng: number; revealed: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if ((window as any).L) { setLoaded(true); return; }
    if (!document.querySelector('link[href*="leaflet"]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(l);
    }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => setLoaded(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!loaded || !ref.current) return;
    const L = (window as any).L;
    if (map.current) { map.current.remove(); map.current = null; }
    map.current = L.map(ref.current, { center: [lat, lng], zoom: 16, zoomControl: false, scrollWheelZoom: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { attribution: '', subdomains: 'abcd', maxZoom: 19 }).addTo(map.current);
    if (revealed) {
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#f5a623;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:13px">📍</span></div>',
        iconSize: [30, 30], iconAnchor: [15, 30],
      });
      L.marker([lat, lng], { icon }).addTo(map.current);
    } else {
      L.circle([lat, lng], {
        radius: 250, color: '#f5a623', weight: 2, opacity: 0.7,
        fillColor: '#f5a623', fillOpacity: 0.12, dashArray: '6 6',
      }).addTo(map.current);
    }
    setTimeout(() => map.current?.invalidateSize(), 100);
    return () => { if (map.current) { map.current.remove(); map.current = null; } };
  }, [loaded, lat, lng, revealed]);

  return (
    <div className="rounded-xl overflow-hidden border border-border mb-3 relative">
      <div ref={ref} style={{ height: 240 }} />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-text-dim animate-pulse">Loading map…</p>
        </div>
      )}
    </div>
  );
}

export default function DemoWalkthrough({ onExit, onCreate }: { onExit: () => void; onCreate: () => void }) {
  const [stopIdx, setStopIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [solved, setSolved] = useState(false);
  const [guess, setGuess] = useState('');
  const [wrong, setWrong] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [seen, setSeen] = useState<DemoStop[]>([]);
  const [shift] = useState(() => 2 + Math.floor(Math.random() * 8));
  const [scrambles] = useState(() =>
    DEMO_STOPS.map(s => (s.puzzleAnswer ? scramble(s.puzzleAnswer) : ''))
  );

  const stop = DEMO_STOPS[stopIdx];
  const isLast = stopIdx === DEMO_STOPS.length - 1;

  const reset = (next: number) => {
    setStopIdx(next); setPhase('clue'); setSolved(false);
    setGuess(''); setWrong(false); setPicked(null);
  };

  const checkPuzzle = () => {
    const clean = guess.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (clean === stop.puzzleAnswer) { setSolved(true); setWrong(false); }
    else { setWrong(true); setTimeout(() => setWrong(false), 900); }
  };

  const clueParts = stop.clueText.split('_____');

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-16">
      {/* Demo banner */}
      <div className="flex items-center justify-between mb-4">
        <span className="badge bg-purple/15 text-purple">Demo — no walking required</span>
        <button onClick={onExit} className="text-xs text-text-muted cursor-pointer bg-transparent border-none">Exit</button>
      </div>

      {phase === 'intro' && (
        <div className="animate-fade-in">
          <div className="card text-center">
            <p className="text-4xl mb-3">🧭</p>
            <h2 className="font-display text-2xl text-accent tracking-wider mb-2">FIVE STOPS ACROSS NEW YORK</h2>
            <p className="text-sm text-text-dim leading-relaxed mb-4">
              Grand Central to the Battery, played from wherever you are.
              Each stop gives you a clue with a word missing. Solve the puzzle to fill it in,
              work out where it points, then find out what actually happened there.
            </p>
            <p className="text-xs text-text-muted mb-5">Takes about three minutes.</p>
            <button onClick={() => setPhase('clue')} className="btn-primary">Start the demo →</button>
          </div>
          <p className="text-[10px] text-text-muted text-center">
            On the street this uses your location. Here, everything is clickable.
          </p>
        </div>
      )}

      {phase !== 'intro' && phase !== 'done' && (
        <>
          {/* Progress */}
          <div className="flex items-center gap-1.5 mb-4">
            {DEMO_STOPS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                i < stopIdx ? 'bg-success' : i === stopIdx ? 'bg-accent' : 'bg-border'}`} />
            ))}
          </div>
          <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-3">
            Stop {stopIdx + 1} of {DEMO_STOPS.length} · {stop.neighbourhood}
          </p>
        </>
      )}

      {/* CLUE */}
      {phase === 'clue' && (
        <div className="animate-fade-in">
          <div className={`rounded-xl p-5 mb-3 border transition-all ${solved ? 'bg-success/10 border-success/20' : 'bg-surface/60 border-border/60'}`}>
            <p className="text-base text-text-primary italic leading-relaxed text-center">
              {clueParts[0]}
              {clueParts.length > 1 && (solved
                ? <span className="not-italic font-bold text-success tracking-wider"> {stop.puzzleAnswer} </span>
                : <span className="not-italic text-text-muted tracking-[3px]"> ????? </span>)}
              {clueParts[1]}
            </p>
          </div>

          {stop.puzzleAnswer && !solved && (
            <div className="card">
              <p className="text-xs text-text-dim text-center mb-3">Solve the puzzle to fill in the blank</p>
              {stop.puzzleType === 'unscramble' ? (
                <div className="text-center">
                  <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-3 font-bold">Unscramble</p>
                  <div className="flex justify-center gap-1.5 mb-4 flex-wrap">
                    {scrambles[stopIdx].split('').map((c, i) => (
                      <div key={i} className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-accent font-bold">{c}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-1 font-bold">Cipher</p>
                  <p className="text-xs text-text-muted mb-2">Every letter moved the same number of steps through the alphabet.</p>
                  <p className="font-mono text-2xl text-accent tracking-[6px] mb-4 font-bold">{caesar(stop.puzzleAnswer, shift)}</p>
                </div>
              )}
              <input
                className={`input-field text-center text-lg font-bold tracking-wider ${wrong ? 'animate-shake !border-danger' : ''}`}
                placeholder="Your answer…" value={guess}
                onChange={e => setGuess(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkPuzzle()} />
              <button onClick={checkPuzzle} disabled={!guess.trim()} className="btn-primary">Check →</button>
              <button onClick={() => setSolved(true)}
                className="w-full mt-2 py-2 text-xs text-text-muted cursor-pointer bg-transparent border-none">
                Skip the puzzle →
              </button>
            </div>
          )}

          {(solved || !stop.puzzleAnswer) && (
            <button onClick={() => setPhase('verify')} className="btn-primary animate-fade-in">
              Where does this point? →
            </button>
          )}
        </div>
      )}

      {/* VERIFY */}
      {phase === 'verify' && (
        <div className="animate-fade-in card">
          <span className="badge bg-info/15 text-info mb-3 inline-block">📍 Where does it point?</span>
          <p className="text-sm text-text-dim mb-4">
            On the street you&apos;d type this yourself. Here, take your pick.
          </p>
          <div className="flex flex-col gap-2">
            {stop.options.map(opt => {
              const isCorrect = opt === stop.name;
              const chosen = picked === opt;
              const showResult = picked !== null;
              return (
                <button
                  key={opt}
                  disabled={showResult}
                  onClick={() => {
                    setPicked(opt);
                    // Right or wrong, move on — this is a demo, not an exam.
                    setTimeout(() => setPhase('travel'), isCorrect ? 700 : 1400);
                  }}
                  className={`w-full px-4 py-3 rounded-xl border text-left text-sm font-semibold transition-all ${
                    showResult && isCorrect
                      ? 'border-success bg-success/10 text-success'
                      : chosen
                        ? 'border-danger bg-danger/10 text-danger'
                        : showResult
                          ? 'border-border bg-surface text-text-muted opacity-50'
                          : 'border-border bg-surface text-text-primary cursor-pointer hover:border-accent/40'}`}>
                  {opt}
                  {showResult && isCorrect && <span className="float-right">✓</span>}
                  {showResult && chosen && !isCorrect && <span className="float-right">✕</span>}
                </button>
              );
            })}
          </div>
          {picked && picked !== stop.name && (
            <p className="text-xs text-text-dim text-center mt-3 animate-fade-in">
              Close — it&apos;s {stop.name}. Heading there now.
            </p>
          )}
        </div>
      )}

      {/* TRAVEL */}
      {phase === 'travel' && (
        <div className="animate-fade-in card">
          <span className="badge bg-accent/15 text-accent mb-3 inline-block">🚶 On the move</span>
          <DemoMap lat={stop.lat} lng={stop.lng} revealed />
          {stop.travelNote && (
            <div className="bg-surface/60 border border-border/60 rounded-xl p-3 mb-3">
              <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-1">Getting there</p>
              <p className="text-sm text-text-dim leading-relaxed">{stop.travelNote}</p>
            </div>
          )}
          <p className="text-xs text-text-muted text-center mb-4">
            On the street the app tracks how close you are and unlocks the challenge when you arrive.
          </p>
          <button onClick={() => setPhase('challenge')} className="btn-primary">I&apos;m here →</button>
        </div>
      )}

      {/* CHALLENGE */}
      {phase === 'challenge' && (
        <div className="animate-fade-in card">
          <span className={`badge mb-3 inline-block ${
            stop.type === 'detour' ? 'bg-info/15 text-info' :
            stop.type === 'pitstop' ? 'bg-success/15 text-success' : 'bg-accent/15 text-accent'}`}>
            {stop.type === 'detour' ? '🔀 Detour' : stop.type === 'pitstop' ? '🏁 Pit stop' : '🏁 Challenge'}
          </span>
          <h3 className="font-bold text-lg text-text-primary mb-2">{stop.name}</h3>
          <p className="text-sm text-text-dim leading-relaxed mb-4">{stop.challenge}</p>
          <button onClick={() => { setSeen(s => [...s, stop]); setPhase('funfact'); }} className="btn-primary">
            Done →
          </button>
        </div>
      )}

      {/* FUN FACT */}
      {phase === 'funfact' && (
        <div className="animate-fade-in card">
          <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-2">💡 Did you know?</p>
          <p className="text-sm text-text-dim leading-relaxed mb-5">{stop.funFact}</p>
          <button
            onClick={() => isLast ? setPhase('done') : reset(stopIdx + 1)}
            className="btn-primary">
            {isLast ? 'See your trail →' : 'Next clue →'}
          </button>
        </div>
      )}

      {/* DONE */}
      {phase === 'done' && (
        <div className="animate-fade-in">
          <div className="card text-center">
            <p className="text-5xl mb-3">🏆</p>
            <h2 className="font-display text-2xl text-accent tracking-wider mb-1">ROUTE COMPLETE</h2>
            <p className="text-sm text-text-dim mb-5">Midtown to the harbour, and five things most New Yorkers don&apos;t know.</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface/60 border border-border/60 rounded-xl py-3">
                <p className="font-display text-2xl text-accent">{DEMO_STOPS.length}</p>
                <p className="text-[10px] text-text-dim uppercase tracking-[1px]">Stops</p>
              </div>
              <div className="bg-surface/60 border border-border/60 rounded-xl py-3">
                <p className="font-display text-2xl text-accent">4</p>
                <p className="text-[10px] text-text-dim uppercase tracking-[1px]">Neighbourhoods</p>
              </div>
              <div className="bg-surface/60 border border-border/60 rounded-xl py-3">
                <p className="font-display text-2xl text-accent">{DEMO_STOPS.length}</p>
                <p className="text-[10px] text-text-dim uppercase tracking-[1px]">Facts</p>
              </div>
            </div>
          </div>

          <div className="card">
            <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-3">Your trail</p>
            {DEMO_STOPS.map((s, i) => (
              <div key={s.name} className="relative pl-5 border-l border-border/50 ml-2 pb-4 last:pb-0">
                <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-success" />
                <p className="text-sm font-semibold text-text-primary">{s.name}</p>
                <p className="text-[11px] text-text-muted mb-1">{s.neighbourhood}</p>
                <p className="text-xs text-text-dim leading-relaxed">{s.funFact}</p>
              </div>
            ))}
          </div>

          <button onClick={onCreate} className="btn-primary">Build one for your city →</button>
          <button onClick={onExit} className="w-full mt-2 py-3 text-sm text-text-muted cursor-pointer bg-transparent border-none">
            Back to the start
          </button>
        </div>
      )}
    </div>
  );
}
