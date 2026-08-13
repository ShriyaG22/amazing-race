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
};

// A real East Village loop. Coordinates are approximate to the block.
const DEMO_STOPS: DemoStop[] = [
  {
    name: 'Alamo (the Astor Place Cube)',
    neighbourhood: 'Astor Place',
    lat: 40.7300, lng: -73.9911,
    type: 'challenge',
    clueText: 'Where Lafayette meets Astor Place there is a large black steel _____ balanced on one corner. It has stood here since 1967, and unlike most public sculpture, people are expected to touch it.',
    puzzleAnswer: 'CUBE',
    puzzleType: 'unscramble',
    challenge: 'Get it spinning. It turns on a hidden central post — one person can do it, but it is easier with two. Photograph it mid-rotation.',
    funFact: 'Its real name is Alamo. It was meant to be temporary, installed for a six-month exhibition in 1967, and stayed because the neighbourhood refused to give it back.',
  },
  {
    name: "McSorley's Old Ale House",
    neighbourhood: 'East 7th Street',
    lat: 40.7286, lng: -73.9896,
    type: 'detour',
    clueText: 'A few blocks east, sawdust still covers the floor of one of the oldest bars in the city. The menu has exactly two choices: _____ or dark.',
    puzzleAnswer: 'LIGHT',
    puzzleType: 'cipher',
    challenge: 'Choose your detour: photograph the wishbones hanging above the bar, or find the pot-bellied stove and the chair beside it.',
    funFact: 'It refused to serve women until 1970, when a court ordered it to. The ladies\' bathroom was not added until 1986.',
  },
  {
    name: 'St. Mark\'s Church-in-the-Bowery',
    neighbourhood: 'East 10th Street',
    lat: 40.7295, lng: -73.9871,
    type: 'challenge',
    clueText: 'Head north to the corner of Second Avenue. In the yard of this church, beneath the stones, lies the last Dutch director-general of New Amsterdam — the man with the wooden leg.',
    challenge: 'Find the plaque marking Peter Stuyvesant\'s vault and photograph the date on it.',
    funFact: 'Stuyvesant has been buried here since 1672 — the church was built on his own farm, and the site has been in continuous religious use longer than almost anywhere else in the city.',
  },
  {
    name: 'Tompkins Square Park',
    neighbourhood: 'Alphabet City',
    lat: 40.7265, lng: -73.9815,
    type: 'pitstop',
    clueText: 'Walk east until the streets start being named after letters. Find the elm near the centre of the park — the one with a small plaque about chanting.',
    challenge: 'Leg complete. Find a bench, and stay a while.',
    funFact: 'In 1966 the first Hare Krishna ceremony outside India was held under that elm, with Allen Ginsberg among those chanting.',
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
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyWrong, setVerifyWrong] = useState(false);
  const [seen, setSeen] = useState<DemoStop[]>([]);
  const [shift] = useState(() => 2 + Math.floor(Math.random() * 8));
  const [scrambles] = useState(() =>
    DEMO_STOPS.map(s => (s.puzzleAnswer ? scramble(s.puzzleAnswer) : ''))
  );

  const stop = DEMO_STOPS[stopIdx];
  const isLast = stopIdx === DEMO_STOPS.length - 1;

  const reset = (next: number) => {
    setStopIdx(next); setPhase('clue'); setSolved(false);
    setGuess(''); setWrong(false); setVerifyInput(''); setVerifyWrong(false);
  };

  const checkPuzzle = () => {
    const clean = guess.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (clean === stop.puzzleAnswer) { setSolved(true); setWrong(false); }
    else { setWrong(true); setTimeout(() => setWrong(false), 900); }
  };

  const checkVerify = () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const answer = norm(stop.name);
    const input = norm(verifyInput);
    if (input.length >= 4 && (answer.includes(input) || input.includes(answer.slice(0, 6)))) {
      setPhase('travel'); setVerifyWrong(false);
    } else { setVerifyWrong(true); setTimeout(() => setVerifyWrong(false), 1200); }
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
            <h2 className="font-display text-2xl text-accent tracking-wider mb-2">A WALK THROUGH THE EAST VILLAGE</h2>
            <p className="text-sm text-text-dim leading-relaxed mb-4">
              This is a real four-stop route, played from wherever you are.
              You&apos;ll get a clue with a word missing, solve a puzzle to fill it in,
              work out where it points, and find out what happened there.
            </p>
            <p className="text-xs text-text-muted mb-5">Takes about two minutes.</p>
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
              I think I know where this is →
            </button>
          )}
        </div>
      )}

      {/* VERIFY */}
      {phase === 'verify' && (
        <div className="animate-fade-in card">
          <span className="badge bg-info/15 text-info mb-3 inline-block">📍 Verify location</span>
          <p className="text-sm text-text-dim mb-3">Where do you think you need to go?</p>
          <input
            className={`input-field ${verifyWrong ? 'animate-shake !border-danger' : ''}`}
            placeholder="Type the location…" value={verifyInput}
            onChange={e => setVerifyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && checkVerify()} />
          <button onClick={checkVerify} disabled={!verifyInput.trim()} className="btn-primary">Check →</button>
          <button onClick={() => setPhase('travel')}
            className="w-full mt-2 py-2 text-xs text-text-muted cursor-pointer bg-transparent border-none">
            Stuck? Show me on the map →
          </button>
          {verifyWrong && <p className="text-xs text-danger text-center mt-2">Not quite — try the name of the place.</p>}
        </div>
      )}

      {/* TRAVEL */}
      {phase === 'travel' && (
        <div className="animate-fade-in card">
          <span className="badge bg-accent/15 text-accent mb-3 inline-block">🚶 On the move</span>
          <DemoMap lat={stop.lat} lng={stop.lng} revealed />
          <p className="text-sm text-text-dim text-center mb-4">
            On the street you&apos;d walk here, and the app would track how close you are.
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
            <p className="text-sm text-text-dim mb-5">Four stops across the East Village, and four things you probably didn&apos;t know.</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface/60 border border-border/60 rounded-xl py-3">
                <p className="font-display text-2xl text-accent">{DEMO_STOPS.length}</p>
                <p className="text-[10px] text-text-dim uppercase tracking-[1px]">Stops</p>
              </div>
              <div className="bg-surface/60 border border-border/60 rounded-xl py-3">
                <p className="font-display text-2xl text-accent">1.1</p>
                <p className="text-[10px] text-text-dim uppercase tracking-[1px]">Miles</p>
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
