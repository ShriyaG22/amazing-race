'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { cacheGameData, getCachedGameData, queueProgress, addLocalProgress, getLocalProgress, syncQueue, isOnline, onConnectionChange, getQueueLength } from '@/lib/offline';
import type { Race, Team, Leg, Checkpoint, Progress } from '@/lib/supabase';
import TravelScreen from './TravelScreen';
import TrailView from './TrailView';

type Props = { raceId: string; teamId: string; onExit: () => void };

const elapsed = (start: string) => {
  const diff = Date.now() - new Date(start).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// ══════════════════════════════════════════════════════════════
// MINIGAMES
// ══════════════════════════════════════════════════════════════

// 🧩 SLIDING PUZZLE — rearrange tiles to spell the hint word
function SlidingPuzzle({ answer, onSolve }: { answer: string; onSolve: () => void }) {
  const size = 3; const total = size * size;
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
  const cleanAnswer = answer.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 8);
  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-1 font-bold">Sliding Puzzle</p>
      <p className="text-xs text-text-muted mb-4">Slide the tiles into order, 1 to {total - 1}</p>
      <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {tiles.map((tile, idx) => (
          <button key={idx} onClick={() => move(idx)} disabled={tile === 0}
            className={`w-[68px] h-[68px] rounded-xl font-display text-2xl font-bold flex items-center justify-center transition-all cursor-pointer ${tile === 0 ? 'bg-transparent border border-dashed border-border' : solved ? 'bg-success/20 text-success border border-success/30' : canMove(idx) ? 'bg-card border border-accent/30 text-accent hover:bg-accent/10' : 'bg-card border border-border text-text-primary'}`}>
            {tile > 0 ? tile : ''}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-muted mt-3">{moves} moves</p>
      {solved
        ? <p className="text-success font-bold mt-2 animate-fade-in">Solved! The hint word is: {cleanAnswer}</p>
        : <p className="text-[10px] text-text-muted mt-1">Solve it to unlock the hint word</p>}
      {!solved && moves >= 25 && (
        <div className="animate-fade-in bg-surface/60 border border-border/60 rounded-xl p-4 mt-3">
          <p className="text-xs text-text-dim mb-1">Taking a while? The hint word is:</p>
          <p className="text-lg font-bold text-accent mb-3">{cleanAnswer}</p>
          <button onClick={onSolve} className="btn-primary">Got it — continue →</button>
        </div>
      )}
    </div>
  );
}

// 🔤 WORD SEARCH — click and drag to find the hidden word
function WordSearchGame({ answer, onSolve }: { answer: string; onSolve: () => void }) {
  const word = answer.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 8);
  const gridSize = Math.max(7, Math.min(8, word.length + 2));
  const [{ grid, wordCells }] = useState(() => {
    const g: string[][] = Array.from({ length: gridSize }, () => Array.from({ length: gridSize }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]));
    // Place word: pick random direction
    const dirs = [[0,1],[1,0],[1,1]]; // horizontal, vertical, diagonal
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const maxR = gridSize - word.length * dir[0]; const maxC = gridSize - word.length * dir[1];
    const startR = Math.floor(Math.random() * Math.max(1, maxR)); const startC = Math.floor(Math.random() * Math.max(1, maxC));
    const cells = new Set<string>();
    for (let i = 0; i < word.length; i++) {
      const rr = startR + i * dir[0], cc = startC + i * dir[1];
      g[rr][cc] = word[i];
      cells.add(`${rr},${cc}`);
    }
    return { grid: g, wordCells: cells };
  });
  const [dragStart, setDragStart] = useState<{r:number,c:number}|null>(null);
  const [dragEnd, setDragEnd] = useState<{r:number,c:number}|null>(null);
  const [found, setFound] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const getHighlighted = () => {
    if (!dragStart || !dragEnd) return new Set<string>();
    const dr = Math.sign(dragEnd.r - dragStart.r); const dc = Math.sign(dragEnd.c - dragStart.c);
    const len = Math.max(Math.abs(dragEnd.r - dragStart.r), Math.abs(dragEnd.c - dragStart.c)) + 1;
    // Only allow straight lines
    if (dragEnd.r !== dragStart.r && dragEnd.c !== dragStart.c && Math.abs(dragEnd.r - dragStart.r) !== Math.abs(dragEnd.c - dragStart.c)) return new Set<string>();
    const cells = new Set<string>();
    for (let i = 0; i < len; i++) cells.add(`${dragStart.r + i * dr},${dragStart.c + i * dc}`);
    return cells;
  };

  const handleRelease = () => {
    if (!dragStart || !dragEnd) { setDragStart(null); setDragEnd(null); return; }
    // A single tap isn't an attempt — people tap the grid while reading.
    if (dragStart.r === dragEnd.r && dragStart.c === dragEnd.c) { setDragStart(null); setDragEnd(null); return; }
    const highlighted = getHighlighted();
    const selectedWord = Array.from(highlighted).sort().map(k => { const [r,c] = k.split(',').map(Number); return grid[r][c]; }).join('');
    // Check both directions
    const reversed = selectedWord.split('').reverse().join('');
    if (selectedWord === word || reversed === word) { setFound(true); setTimeout(onSolve, 800); }
    else { setWrong(true); setAttempts(a => a + 1); setTimeout(() => { setWrong(false); setDragStart(null); setDragEnd(null); }, 600); }
  };

  const highlighted = getHighlighted();
  const hintLen = word.length;

  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-1 font-bold">Word Search</p>
      <p className="text-xs text-text-muted mb-3">Find the hidden {hintLen}-letter word. Click and drag to select.</p>
      <div className="inline-grid gap-px select-none touch-none" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)`, maxWidth: '100%' }}
        onMouseUp={handleRelease} onTouchEnd={handleRelease}>
        {grid.map((row, r) => row.map((letter, c) => {
          const key = `${r},${c}`; const isHl = highlighted.has(key) || (revealed && wordCells.has(key));
          return (
            <div key={key}
              onMouseDown={() => { if (!found) { setDragStart({r,c}); setDragEnd({r,c}); } }}
              onMouseEnter={() => { if (dragStart && !found) setDragEnd({r,c}); }}
              onTouchStart={() => { if (!found) { setDragStart({r,c}); setDragEnd({r,c}); } }}
              onTouchMove={(e) => {
                if (!dragStart || found) return;
                e.preventDefault(); // stop the page scrolling while dragging
                const touch = e.touches[0]; const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (el) { const d = el.getAttribute('data-pos'); if (d) { const [rr,cc] = d.split(',').map(Number); setDragEnd({r:rr,c:cc}); } }
              }}
              data-pos={`${r},${c}`}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded flex items-center justify-center text-xs font-bold cursor-pointer transition-all ${
                (found || revealed) && isHl ? 'bg-success/25 text-success' : wrong && isHl ? 'bg-danger/25 text-danger' : isHl ? 'bg-accent/25 text-accent' : 'bg-surface/60 text-text-dim hover:bg-card'}`}>
              {letter}
            </div>
          );
        }))}
      </div>
      {found && <p className="text-success font-bold mt-3 animate-fade-in">Found: {word}</p>}
      {revealed && !found && (
        <div className="animate-fade-in bg-surface/60 border border-border/60 rounded-xl p-4 mt-3">
          <p className="text-xs text-text-dim mb-1">It was here — the word is:</p>
          <p className="text-lg font-bold text-accent mb-3">{word}</p>
          <button onClick={onSolve} className="btn-primary">Got it — continue →</button>
        </div>
      )}
      {!found && !revealed && attempts >= 2 && (
        <button onClick={() => setRevealed(true)} className="w-full mt-3 py-2 text-xs text-text-muted hover:text-text-dim cursor-pointer bg-transparent border-none">
          Can't find it? Show me →
        </button>
      )}
    </div>
  );
}

// 🔐 CIPHER — decode the shifted text
function CipherGame({ answer, onSolve }: { answer: string; onSolve: () => void }) {
  const [guess, setGuess] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const shift = 3;
  // Use only the first word if answer is multi-word, max 8 chars
  const cleanAnswer = answer.toUpperCase().replace(/[^A-Z]/g, ' ').trim().split(/\s+/)[0].substring(0, 8);
  const encoded = cleanAnswer.split('').map(c => {
    if (c >= 'A' && c <= 'Z') return String.fromCharCode(((c.charCodeAt(0) - 65 + shift) % 26) + 65);
    return c;
  }).join('');

  const check = () => {
    if (guess.trim().toUpperCase().replace(/[^A-Z]/g, '') === cleanAnswer) { onSolve(); }
    else { 
      setError(true); 
      setAttempts(a => a + 1);
      setTimeout(() => setError(false), 1000); 
    }
  };

  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-1 font-bold">Cipher</p>
      <p className="text-xs text-text-muted mb-2">Every letter was pushed 3 forward. Shift them back.</p>
      <p className="font-mono text-2xl text-accent tracking-[6px] mb-2 font-bold">{encoded}</p>
      <p className="text-[10px] text-text-muted mb-1">To decode: D→A, E→B, F→C ...</p>
      <p className="text-[10px] text-text-muted mb-4">You're looking for a single hint word, not the place name</p>
      {attempts >= 2 && <p className="text-xs text-accent mb-2">Hint: The answer starts with "{cleanAnswer[0]}"</p>}
      <input className={`input-field text-center text-lg font-bold tracking-wider ${error ? 'animate-shake !border-danger' : ''}`}
        placeholder="Decoded word..." value={guess} onChange={e => setGuess(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && check()} autoFocus />
      <button onClick={check} disabled={!guess.trim()} className="btn-primary mt-1">Decode →</button>
      {attempts >= 3 && (
        <div className="animate-fade-in bg-surface/60 border border-border/60 rounded-xl p-4 mt-3">
          <p className="text-xs text-text-dim mb-1">The answer is:</p>
          <p className="text-lg font-bold text-accent mb-3">{cleanAnswer}</p>
          <button onClick={onSolve} className="btn-primary">Got it — continue →</button>
        </div>
      )}
    </div>
  );
}

// 🔀 UNSCRAMBLE — rearrange jumbled letters
function UnscrambleGame({ answer, onSolve }: { answer: string; onSolve: () => void }) {
  const [guess, setGuess] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const cleanAnswer = answer.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 8);
  const [scrambled] = useState(() => {
    let s = cleanAnswer.split('');
    for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
    if (s.join('') === cleanAnswer && s.length > 1) { [s[0], s[1]] = [s[1], s[0]]; }
    return s.join('');
  });

  const check = () => {
    if (guess.trim().toUpperCase().replace(/[^A-Z]/g, '') === cleanAnswer) { onSolve(); }
    else { setError(true); setAttempts(a => a + 1); setTimeout(() => setError(false), 1000); }
  };

  return (
    <div className="text-center">
      <p className="text-[11px] text-text-dim uppercase tracking-[2px] mb-1 font-bold">Unscramble</p>
      <p className="text-xs text-text-muted mb-1">Rearrange these {cleanAnswer.length} letters into one word</p>
      <p className="text-[10px] text-text-muted mb-3">It's a hint word, not the place name</p>
      <div className="flex justify-center gap-1.5 mb-4 flex-wrap">
        {scrambled.split('').map((l, i) => (
          <div key={i} className="w-9 h-11 rounded-lg bg-card border border-border flex items-center justify-center font-display text-xl text-accent">{l}</div>
        ))}
      </div>
      {attempts >= 2 && <p className="text-xs text-accent mb-2">Hint: Starts with "{cleanAnswer[0]}"</p>}
      <input className={`input-field text-center text-lg font-bold tracking-wider ${error ? 'animate-shake !border-danger' : ''}`}
        placeholder="Your answer..." value={guess} onChange={e => setGuess(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && check()} autoFocus />
      <button onClick={check} disabled={!guess.trim()} className="btn-primary mt-1">Check →</button>
      {attempts >= 3 && (
        <div className="animate-fade-in bg-surface/60 border border-border/60 rounded-xl p-4 mt-3">
          <p className="text-xs text-text-dim mb-1">The answer is:</p>
          <p className="text-lg font-bold text-accent mb-3">{cleanAnswer}</p>
          <button onClick={onSolve} className="btn-primary">Got it — continue →</button>
        </div>
      )}
    </div>
  );
}

// MINIGAME ROUTER
function MinigamePlayer({ type, answer, emojiClue, onSolve }: { type: string; answer: string; emojiClue?: string; onSolve: () => void }) {
  // Every puzzle needs a usable single word. If the generator gave us something
  // unusable (blank, a number, a whole place name), no puzzle is winnable — so
  // skip straight past rather than trapping the player.
  const usable = (answer || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (usable.length < 4 || usable.length > 12) {
    return (
      <div className="text-center bg-surface/60 border border-border/60 rounded-xl p-5">
        <p className="text-sm text-text-dim mb-1">No puzzle on this one.</p>
        <p className="text-xs text-text-muted mb-4">Go by the written clue above.</p>
        <button onClick={onSolve} className="btn-primary">Continue →</button>
      </div>
    );
  }

  switch (type) {
    case 'sliding': return <SlidingPuzzle answer={usable} onSolve={onSolve} />;
    case 'wordsearch': return <WordSearchGame answer={usable} onSolve={onSolve} />;
    case 'cipher': return <CipherGame answer={usable} onSolve={onSolve} />;
    case 'unscramble': return <UnscrambleGame answer={usable} onSolve={onSolve} />;
    // Emoji riddles were pulled for being too hard to guess reliably.
    case 'emoji': return <UnscrambleGame answer={usable} onSolve={onSolve} />;
    default: return <UnscrambleGame answer={usable} onSolve={onSolve} />;
  }
}

// ══════════════════════════════════════════════════════════════
// IN-GAME MAP
// ══════════════════════════════════════════════════════════════
function GameMap({ checkpoints, completedIds, currentCpId, mapContainerRef, mapInstanceRef }: {
  checkpoints: Checkpoint[]; completedIds: Set<string>; currentCpId: string | null;
  mapContainerRef: React.RefObject<HTMLDivElement>; mapInstanceRef: React.MutableRefObject<any>;
}) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const markersRef = useRef<any[]>([]); const linesRef = useRef<any[]>([]);

  useEffect(() => {
    if ((window as any).L) { setLeafletLoaded(true); return; }
    if (!document.querySelector('link[href*="leaflet"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l); }
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = () => setLeafletLoaded(true); document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L; if (!L) return;
    const visibleCps = checkpoints.filter(cp => (cp.lat && cp.lng) && (completedIds.has(cp.id) || cp.id === currentCpId));
    if (!mapInstanceRef.current) {
      const center: [number, number] = visibleCps.length > 0 ? [visibleCps.reduce((s, c) => s + (c.lat || 0), 0) / visibleCps.length, visibleCps.reduce((s, c) => s + (c.lng || 0), 0) / visibleCps.length] : [40.7128, -74.006];
      mapInstanceRef.current = L.map(mapContainerRef.current, { center, zoom: 14, zoomControl: false });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '', subdomains: 'abcd', maxZoom: 19 }).addTo(mapInstanceRef.current);
      L.control.zoom({ position: 'topright' }).addTo(mapInstanceRef.current);
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);
    }
    const map = mapInstanceRef.current;
    markersRef.current.forEach(m => map.removeLayer(m)); linesRef.current.forEach(l => map.removeLayer(l));
    markersRef.current = []; linesRef.current = [];
    const completedCoords: [number, number][] = [];
    visibleCps.forEach(cp => {
      const done = completedIds.has(cp.id); const curr = cp.id === currentCpId; const pit = cp.type === 'pitstop';
      const color = done ? '#2ecc71' : '#f5a623';
      const icon = L.divIcon({ className: '', html: `<div style="width:${pit?30:24}px;height:${pit?30:24}px;border-radius:50%;background:${done?'#2ecc71':'#f5a623'};border:3px solid #fff;box-shadow:0 2px 8px ${color}66${curr?', 0 0 0 6px '+color+'33':''};display:flex;align-items:center;justify-content:center;font-size:${pit?13:10}px;color:#000;font-weight:800;">${done?'✓':pit?'🏁':'?'}</div>`, iconSize: [pit?30:24, pit?30:24], iconAnchor: [pit?15:12, pit?15:12] });
      const m = L.marker([cp.lat!, cp.lng!], { icon }).addTo(map);
      m.bindPopup(`<div style="font-family:'DM Sans',sans-serif"><b>${cp.name}</b><br><span style="color:#888">${done?'✓ Done':'📍 Current'}</span></div>`);
      markersRef.current.push(m);
      if (done && cp.lat && cp.lng) completedCoords.push([cp.lat, cp.lng]);
    });
    if (completedCoords.length >= 2) { const l = L.polyline(completedCoords, { color: '#2ecc71', weight: 2.5, opacity: 0.5, dashArray: '6,6' }).addTo(map); linesRef.current.push(l); }
    const cur = checkpoints.find(cp => cp.id === currentCpId);
    if (completedCoords.length > 0 && cur?.lat && cur?.lng) { const l = L.polyline([completedCoords[completedCoords.length-1], [cur.lat, cur.lng]], { color: '#f5a623', weight: 2, opacity: 0.4, dashArray: '4,8' }).addTo(map); linesRef.current.push(l); }
    if (visibleCps.length > 0) map.fitBounds(L.latLngBounds(visibleCps.map(cp => [cp.lat!, cp.lng!])), { padding: [40, 40], maxZoom: 15 });
  }, [leafletLoaded, checkpoints, completedIds, currentCpId]);

  useEffect(() => { return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } }; }, []);
  return (<div><div ref={mapContainerRef} className="w-full rounded-xl overflow-hidden border border-border" style={{ height: 350 }} /></div>);
}

// ══════════════════════════════════════════════════════════════
type Phase = 'welcome' | 'clue' | 'verify' | 'travel' | 'detour-choice' | 'roadblock-commit' | 'challenge' | 'funfact' | 'pitstop';

export default function PlayerView({ raceId, teamId, onExit }: Props) {
  const [race, setRace] = useState<Race | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allProgress, setAllProgress] = useState<Progress[]>([]);
  const [tab, setTab] = useState<'adventure' | 'map' | 'board' | 'trail'>('adventure');
  const [locationRevealed, setLocationRevealed] = useState(false);
  const [phase, setPhase] = useState<Phase>('welcome');
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyError, setVerifyError] = useState(false);
  const [selectedDetour, setSelectedDetour] = useState<'a' | 'b' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showGiveUp, setShowGiveUp] = useState(false);
  const [clueSolved, setClueSolved] = useState(false);
  const [online, setOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const fetchAll = async () => {
    if (!isOnline()) {
      // Use cached data when offline
      const cached = getCachedGameData(raceId);
      if (cached) {
        if (cached.race) setRace(cached.race);
        if (cached.legs) setLegs(cached.legs);
        if (cached.checkpoints) setCheckpoints(cached.checkpoints);
      }
      return;
    }

    try {
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

      // Cache for offline use
      cacheGameData(raceId);
    } catch {
      // Network error — use cache
      const cached = getCachedGameData(raceId);
      if (cached) {
        if (cached.race) setRace(cached.race);
        if (cached.legs) setLegs(cached.legs);
        if (cached.checkpoints) setCheckpoints(cached.checkpoints);
      }
    }
  };

  // Online/offline detection + auto-sync
  useEffect(() => {
    setOnline(isOnline());
    setPendingSync(getQueueLength());

    const cleanup = onConnectionChange(async (isNowOnline) => {
      setOnline(isNowOnline);
      if (isNowOnline) {
        const result = await syncQueue();
        setPendingSync(getQueueLength());
        if (result.synced > 0) fetchAll(); // Refresh after sync
      }
    });

    return cleanup;
  }, []);

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, isOnline() ? 4000 : 30000); return () => clearInterval(iv); }, [raceId, teamId, online]);

  const orderedCps = legs.flatMap(leg => checkpoints.filter(cp => cp.leg_id === leg.id).sort((a, b) => a.order_num - b.order_num));
  
  // Merge server progress with local progress
  const localCompleted = getLocalProgress(teamId);
  const completedIds = new Set([
    ...progress.filter(p => p.status === 'complete' || (race?.admin_playing && p.status === 'pending')).map(p => p.checkpoint_id),
    ...localCompleted,
  ]);
  
  const activeCp = orderedCps.find(cp => !completedIds.has(cp.id));
  const currentLeg = activeCp ? legs.find(l => l.id === activeCp.leg_id) : null;
  const currentLegIdx = currentLeg ? legs.indexOf(currentLeg) : -1;
  const totalCps = orderedCps.length;
  const doneCount = completedIds.size;
  const progressPct = totalCps > 0 ? (doneCount / totalCps) * 100 : 0;
  const raceFinished = race?.status === 'finished' || (!activeCp && doneCount > 0 && doneCount >= totalCps);
  const isExplorer = race?.game_mode === 'explorer';
  const requirePhoto = race?.require_photo ?? true;

  useEffect(() => {
    if (activeCp) { setPhase(doneCount === 0 ? 'welcome' : 'clue'); setVerifyInput(''); setVerifyError(false); setSelectedDetour(null); setClueSolved(false); setShowGiveUp(false); setPhotoPreview(null); setLocationRevealed(false); }
  }, [activeCp?.id]);

  const completeCheckpoint = async (proof: string = 'completed'): Promise<void> => {
    if (!activeCp || submitting) return;
    setSubmitting(true);
    
    const status = race?.admin_playing ? 'pending' : 'complete';
    
    // Always save locally first
    addLocalProgress(teamId, activeCp.id);
    
    if (isOnline()) {
      try {
        await supabase.from('progress').insert({ team_id: teamId, checkpoint_id: activeCp.id, status, proof });
      } catch {
        // Failed to sync — queue it
        queueProgress(teamId, activeCp.id, status, proof);
        setPendingSync(getQueueLength());
      }
    } else {
      // Offline — queue for later sync
      queueProgress(teamId, activeCp.id, status, proof);
      setPendingSync(getQueueLength());
    }
    
    setSubmitting(false);
    fetchAll();
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => setPhotoPreview(reader.result as string); reader.readAsDataURL(file);
  };

  // Strip punctuation, collapse whitespace — "Kalustyan's" and "kalustyans" should match.
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'at', 'in', 'on', 'and', 'st', 'street', 'ave', 'avenue', 'rd', 'road', 'park', 'nyc', 'new', 'york']);

  const answerMatches = (rawInput: string, rawAnswer: string) => {
    const input = normalize(rawInput);
    const answer = normalize(rawAnswer);
    if (!input || !answer) return false;
    if (input === answer) return true;

    const squash = (s: string) => s.replace(/\s/g, '');
    if (squash(input) === squash(answer)) return true;
    if (squash(answer).includes(squash(input)) && squash(input).length >= 4) return true;
    if (squash(input).includes(squash(answer))) return true;

    // Token overlap — "230 fifth ave rooftop" still clears "230 Fifth".
    const meaningful = (s: string) => s.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w));
    const aTokens = meaningful(answer);
    const iTokens = meaningful(input);
    if (!aTokens.length || !iTokens.length) return false;
    const hits = aTokens.filter(a => iTokens.some(i => i === a || (a.length >= 5 && i.length >= 4 && (i.includes(a) || a.includes(i)))));
    return hits.length / aTokens.length >= 0.5;
  };

  const handleVerify = () => {
    if (!activeCp) return;
    const answer = activeCp.location_answer || activeCp.name || '';
    const input = verifyInput;
    if (!input.trim()) return;
    if (answerMatches(input, answer)) {
      setVerifyError(false);
      setPhase('travel');
    } else { setVerifyError(true); setTimeout(() => setVerifyError(false), 2000); }
  };

  // Recap numbers for the completion screen.
  const summaryStats = (() => {
    const doneCps = orderedCps.filter(cp => completedIds.has(cp.id));
    const stops = doneCps.length;
    const facts = doneCps.filter(cp => (cp.fun_fact || '').trim().length > 0).length;
    const legsDone = legs.filter(l => {
      const inLeg = checkpoints.filter(c => c.leg_id === l.id);
      return inLeg.length > 0 && inLeg.every(c => completedIds.has(c.id));
    }).length;
    const photos = progress.filter(p =>
      p.checkpoint_id && completedIds.has(p.checkpoint_id) && typeof p.proof === 'string' && p.proof.startsWith('data:image/')
    ).length;
    const city = race?.city ? ` across ${race.city}` : '';
    const blurb = isExplorer
      ? `You covered ${stops} stop${stops === 1 ? '' : 's'}${city} and picked up ${facts} bit${facts === 1 ? '' : 's'} of local history along the way.`
      : `${stops} checkpoint${stops === 1 ? '' : 's'} cleared${city}. Not bad at all.`;
    return { stops, facts, legsDone, photos, blurb };
  })();

  // Where you land once you've actually arrived at the location.
  const arriveAtCheckpoint = () => {
    if (!activeCp) return;
    if (activeCp.type === 'detour') setPhase('detour-choice');
    else if (activeCp.type === 'roadblock') setPhase('roadblock-commit');
    else if (activeCp.type === 'pitstop') setPhase('pitstop');
    else setPhase('challenge');
  };

  if (!race || !team) return <div className="min-h-screen flex items-center justify-center"><p className="text-text-dim animate-pulse">Loading...</p></div>;

  const tabs = isExplorer
    ? [{ id: 'adventure', label: 'Adventure' }, { id: 'map', label: 'Map' }, { id: 'trail', label: 'Trail' }]
    : [{ id: 'adventure', label: 'Race' }, { id: 'map', label: 'Map' }, { id: 'trail', label: 'Trail' }, { id: 'board', label: 'Board' }];

  return (
    <div className="max-w-lg mx-auto">
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

      {totalCps > 0 && (
        <div className="mx-4 mt-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-text-dim font-bold uppercase tracking-wide">Progress</span>
            <span className="text-[10px] text-text-muted font-mono">{doneCount}/{totalCps}</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all duration-700" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      <div className="flex border-b border-border mx-4 mt-2">
        {tabs.map(t => (<button key={t.id} onClick={() => setTab(t.id as any)} className={`tab ${tab === t.id ? 'tab-active' : 'tab-inactive'}`}>{t.label}</button>))}
      </div>

      {/* Offline banner */}
      {!online && (
        <div className="mx-4 mt-2 bg-accent/10 border border-accent/20 rounded-lg px-3 py-2 flex items-center gap-2 animate-fade-in">
          <span className="text-sm">📡</span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-accent">You're offline</p>
            <p className="text-[10px] text-text-dim">Game continues — progress will sync when you reconnect.</p>
          </div>
        </div>
      )}

      {/* Pending sync indicator */}
      {online && pendingSync > 0 && (
        <div className="mx-4 mt-2 bg-info/10 border border-info/20 rounded-lg px-3 py-2 flex items-center gap-2 animate-fade-in">
          <span className="w-3 h-3 border-2 border-info/30 border-t-info rounded-full animate-spin" />
          <p className="text-xs text-info">Syncing {pendingSync} update{pendingSync > 1 ? 's' : ''}...</p>
        </div>
      )}

      <div className="px-4 py-4">
        {tab === 'adventure' && (
          <div>
            {race.status === 'setup' && <div className="flex items-center justify-center min-h-[50vh]"><div className="text-center"><p className="text-5xl mb-4">⏳</p><h2 className="font-display text-2xl text-accent">WAITING TO START</h2></div></div>}

            {raceFinished && (
              <div className="animate-fade-in">
                <div className="card text-center">
                  <p className="text-5xl mb-3">🏆</p>
                  <h2 className="font-display text-3xl text-accent tracking-wider mb-1">{isExplorer ? 'ADVENTURE COMPLETE' : 'RACE COMPLETE'}</h2>
                  <p className="text-sm text-text-dim mb-5">{summaryStats.blurb}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-surface/60 border border-border/60 rounded-xl py-3">
                      <p className="font-display text-2xl text-accent">{summaryStats.stops}</p>
                      <p className="text-[10px] text-text-dim uppercase tracking-[1px]">Stops</p>
                    </div>
                    <div className="bg-surface/60 border border-border/60 rounded-xl py-3">
                      <p className="font-display text-2xl text-accent">{summaryStats.legsDone}</p>
                      <p className="text-[10px] text-text-dim uppercase tracking-[1px]">Legs</p>
                    </div>
                    <div className="bg-surface/60 border border-border/60 rounded-xl py-3">
                      <p className="font-display text-2xl text-accent">{summaryStats.photos || summaryStats.facts}</p>
                      <p className="text-[10px] text-text-dim uppercase tracking-[1px]">{summaryStats.photos ? 'Photos' : 'Facts'}</p>
                    </div>
                  </div>
                  {race.started_at && (
                    <p className="text-xs text-text-muted font-mono mt-3">Total time: {elapsed(race.started_at)}</p>
                  )}
                </div>

                <div className="card">
                  <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-3">Everywhere you went</p>
                  {orderedCps.filter(cp => completedIds.has(cp.id)).map((cp, i) => (
                    <div key={cp.id} className="flex items-baseline gap-2 py-1.5 border-b border-border/30 last:border-none">
                      <span className="text-[10px] text-text-muted font-mono w-5 shrink-0">{i + 1}</span>
                      <span className="text-sm text-text-primary flex-1">{cp.location_answer || cp.name}</span>
                      <span className="text-xs">{cp.type === 'pitstop' ? '🏁' : cp.type === 'detour' ? '🔀' : cp.type === 'roadblock' ? '🚧' : '📍'}</span>
                    </div>
                  ))}
                </div>

                <button onClick={() => setTab('trail')} className="btn-primary">Relive the whole trail →</button>
              </div>
            )}

            {race.status === 'active' && activeCp && !raceFinished && (
              <div className="animate-fade-in">
                {currentLeg && <div className="mb-4"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-display shrink-0">{currentLegIdx + 1}</div><p className="text-[11px] text-text-dim tracking-[2px] uppercase font-bold">{currentLeg.name}</p></div></div>}

                {/* WELCOME */}
                {phase === 'welcome' && (
                  <div className="card text-center animate-fade-in">
                    <p className="text-4xl mb-3">🧭</p>
                    <h2 className="font-display text-2xl text-accent tracking-wider mb-2">{isExplorer ? 'YOUR ADVENTURE BEGINS' : 'GO!'}</h2>
                    <p className="text-sm text-text-dim leading-relaxed mb-6">{isExplorer ? 'Follow clues, discover hidden gems, and learn the stories behind each stop. No rush — enjoy the journey.' : 'Decode clues, race to locations, complete challenges. The clock is ticking!'}</p>
                    <button onClick={() => setPhase('clue')} className="btn-primary">First clue →</button>
                  </div>
                )}

                {/* CLUE */}
                {phase === 'clue' && (
                  <div className="card animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="badge bg-purple/15 text-purple">{activeCp.clue_type === 'text' ? '📜 Clue' : '🧩 Puzzle Clue'}</span>
                      <span className="text-xs text-text-muted">Stop {orderedCps.indexOf(activeCp) + 1}/{totalCps}</span>
                    </div>

                    {activeCp.clue_type === 'text' && (
                      <div className="bg-surface/60 border border-border/60 rounded-xl p-5 mb-4">
                        <p className="text-base text-text-primary italic leading-relaxed text-center">{activeCp.clue_text || 'Head to the next checkpoint...'}</p>
                      </div>
                    )}

                    {activeCp.clue_type !== 'text' && !clueSolved && (
                      <div className="mb-4">
                        {/* Verbal hint to give context alongside the puzzle */}
                        {activeCp.clue_text && (
                          <div className="bg-surface/60 border border-border/60 rounded-xl p-4 mb-3">
                            <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-1">💡 Hint</p>
                            <p className="text-sm text-text-muted italic leading-relaxed">{activeCp.clue_text}</p>
                          </div>
                        )}
                        <p className="text-xs text-text-dim text-center mb-3">Solve the puzzle to confirm your answer</p>
                        <MinigamePlayer type={activeCp.clue_type} answer={activeCp.answer || 'WANDR'} emojiClue={activeCp.emoji_clue} onSolve={() => setClueSolved(true)} />
                        <button onClick={() => setClueSolved(true)} className="w-full mt-3 py-2 text-xs text-text-muted hover:text-text-dim cursor-pointer bg-transparent border-none">
                          Skip the puzzle →
                        </button>
                      </div>
                    )}

                    {activeCp.clue_type !== 'text' && clueSolved && (
                      <div className="bg-success/10 border border-success/20 rounded-xl p-4 mb-4 text-center animate-fade-in">
                        <p className="text-success font-bold mb-1">Puzzle solved!</p>
                        <p className="text-sm text-text-dim">Your hint: <span className="text-accent font-bold tracking-wider">{(activeCp.answer || '').toUpperCase()}</span></p>
                        {activeCp.clue_text && <p className="text-xs text-text-muted mt-2 italic">{activeCp.clue_text}</p>}
                      </div>
                    )}

                    {(activeCp.clue_type === 'text' || clueSolved) && (
                      <button onClick={() => setPhase('verify')} className="btn-primary mt-3">I know where to go! →</button>
                    )}
                    <div className="mt-3 text-center">
                      {!showGiveUp ? <button onClick={() => setShowGiveUp(true)} className="w-full py-3 text-sm text-text-muted hover:text-text-dim cursor-pointer bg-transparent border-none">Stuck? Show answer →</button>
                      : <div className="animate-fade-in bg-surface/60 border border-border/60 rounded-xl p-4 mt-2">
                          <p className="text-xs text-text-dim mb-1">The answer is:</p>
                          <p className="text-lg font-bold text-accent mb-3">{activeCp.location_answer || activeCp.name}</p>
                          <button onClick={() => { setShowGiveUp(false); setLocationRevealed(true); setPhase('travel'); }} className="btn-primary">Head there →</button>
                        </div>}
                    </div>
                  </div>
                )}

                {/* VERIFY */}
                {phase === 'verify' && (
                  <div className="card animate-fade-in">
                    <span className="badge bg-info/15 text-info mb-3">📍 Verify Location</span>
                    <p className="text-sm text-text-dim mb-4">Where do you think you need to go?</p>
                    <input className={`input-field text-center text-lg font-semibold ${verifyError ? 'animate-shake !border-danger' : ''}`}
                      placeholder="Type the location..." value={verifyInput} onChange={e => setVerifyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerify()} autoFocus />
                    {verifyError && <p className="text-danger text-xs text-center mb-2">Not quite — try again!</p>}
                    <button onClick={handleVerify} disabled={!verifyInput.trim()} className="btn-primary">Check →</button>
                    <div className="mt-3 text-center">
                      {!showGiveUp ? <button onClick={() => setShowGiveUp(true)} className="w-full py-3 text-sm text-text-muted hover:text-text-dim cursor-pointer bg-transparent border-none">Stuck? Reveal location →</button>
                      : <div className="animate-fade-in bg-surface/60 border border-border/60 rounded-xl p-4 mt-2">
                          <p className="text-xs text-text-dim mb-1">The answer is:</p>
                          <p className="text-lg font-bold text-accent mb-3">{activeCp.location_answer || activeCp.name}</p>
                          <button onClick={() => { setShowGiveUp(false); setLocationRevealed(true); setPhase('travel'); }} className="btn-primary">Continue →</button>
                        </div>}
                    </div>
                  </div>
                )}

                {/* TRAVEL */}
                {phase === 'travel' && (
                  <TravelScreen
                    clueText={activeCp.clue_text}
                    revealedName={locationRevealed ? (activeCp.location_answer || activeCp.name) : null}
                    destLat={activeCp.lat}
                    destLng={activeCp.lng}
                    isExplorer={isExplorer}
                    stopLabel={`Stop ${orderedCps.indexOf(activeCp) + 1}/${totalCps}`}
                    onArrived={arriveAtCheckpoint}
                  />
                )}

                {/* DETOUR CHOICE */}
                {phase === 'detour-choice' && (
                  <div className="card animate-fade-in">
                    <span className="badge bg-info/15 text-info mb-3">🔀 Detour</span>
                    <p className="text-sm text-text-dim mb-4">Choose your challenge:</p>
                    <button onClick={() => setSelectedDetour('a')} className={`w-full p-4 rounded-xl border text-left cursor-pointer transition-all mb-2 ${selectedDetour === 'a' ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
                      <p className="font-bold text-sm">{activeCp.detour_option_a_title || 'Option A'}</p>
                      <p className="text-xs text-text-dim mt-1">{activeCp.detour_option_a_desc}</p>
                    </button>
                    <div className="text-center text-text-muted text-xs font-bold my-1">— OR —</div>
                    <button onClick={() => setSelectedDetour('b')} className={`w-full p-4 rounded-xl border text-left cursor-pointer transition-all ${selectedDetour === 'b' ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
                      <p className="font-bold text-sm">{activeCp.detour_option_b_title || 'Option B'}</p>
                      <p className="text-xs text-text-dim mt-1">{activeCp.detour_option_b_desc}</p>
                    </button>
                    <button onClick={() => setPhase('challenge')} disabled={!selectedDetour} className="btn-primary mt-4">Go! →</button>
                  </div>
                )}

                {/* ROADBLOCK */}
                {phase === 'roadblock-commit' && (
                  <div className="card animate-fade-in text-center">
                    <span className="badge bg-danger/15 text-danger mb-3">🚧 Roadblock</span>
                    <p className="text-sm text-text-dim mb-2">One person must take this on solo.</p>
                    <div className="bg-surface/60 border border-danger/20 rounded-xl p-5 mb-4">
                      <p className="text-lg text-text-primary italic font-semibold">"{activeCp.roadblock_hint || 'Who\'s feeling brave?'}"</p>
                    </div>
                    <button onClick={() => setPhase('challenge')} className="btn-primary">I'll do it! →</button>
                  </div>
                )}

                {/* CHALLENGE */}
                {phase === 'challenge' && (
                  <div className="card animate-fade-in">
                    <span className={`badge mb-3 ${activeCp.type === 'detour' ? 'bg-info/15 text-info' : activeCp.type === 'roadblock' ? 'bg-danger/15 text-danger' : 'bg-accent/15 text-accent'}`}>
                      {activeCp.type === 'detour' ? '🔀 ' + (selectedDetour === 'a' ? activeCp.detour_option_a_title : activeCp.detour_option_b_title) : activeCp.type === 'roadblock' ? '🚧 Roadblock' : '🏁 Challenge'}
                    </span>
                    <h3 className="font-display text-xl text-accent tracking-wider mb-2">{activeCp.name}</h3>
                    <p className="text-sm text-text-primary leading-relaxed mb-4">
                      {activeCp.type === 'detour' ? (selectedDetour === 'a' ? activeCp.detour_option_a_desc : activeCp.detour_option_b_desc) : activeCp.description}
                    </p>

                    {requirePhoto ? (
                      <div>
                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                        {!photoPreview ? (
                          <button onClick={() => fileInputRef.current?.click()} className="w-full py-6 rounded-xl border-2 border-dashed border-border hover:border-accent/40 bg-surface/50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all mb-3">
                            <span className="text-3xl">📸</span><span className="text-sm font-semibold text-text-dim">Take a Photo</span>
                          </button>
                        ) : (
                          <div className="mb-3 animate-fade-in">
                            <div className="relative rounded-xl overflow-hidden border border-border">
                              <img src={photoPreview} alt="Proof" className="w-full max-h-[200px] object-cover" />
                              <button onClick={() => { setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-bg/80 border border-border text-text-dim flex items-center justify-center text-xs cursor-pointer">✕</button>
                            </div>
                          </div>
                        )}
                        <button onClick={() => { completeCheckpoint(photoPreview || 'photo'); setPhase('funfact'); }} disabled={!photoPreview || submitting} className="btn-primary">{submitting ? 'Submitting…' : 'Submit →'}</button>
                      </div>
                    ) : (
                      <div>
                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                        {photoPreview && (
                          <div className="mb-3 animate-fade-in">
                            <div className="relative rounded-xl overflow-hidden border border-border">
                              <img src={photoPreview} alt="Proof" className="w-full max-h-[200px] object-cover" />
                              <button onClick={() => { setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-bg/80 border border-border text-text-dim flex items-center justify-center text-xs cursor-pointer">✕</button>
                            </div>
                          </div>
                        )}
                        <button onClick={() => { completeCheckpoint(photoPreview || 'done'); setPhase('funfact'); }} disabled={submitting} className="btn-primary">{submitting ? 'Submitting…' : 'Done ✓'}</button>
                        {!photoPreview && (
                          <button onClick={() => fileInputRef.current?.click()} className="w-full mt-2 py-2 rounded-xl border border-border bg-transparent text-text-dim text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer hover:border-accent/30 transition-all">
                            📸 Add a photo <span className="text-text-muted text-xs">(optional)</span>
                          </button>
                        )}
                      </div>
                    )}
                    <div className="mt-3 text-center"><button onClick={async () => { await completeCheckpoint('passed'); setPhase('funfact'); }} className="w-full py-3 text-sm text-text-muted hover:text-text-dim cursor-pointer bg-transparent border-none">Skip this challenge →</button></div>
                  </div>
                )}

                {/* FUN FACT */}
                {phase === 'funfact' && (
                  <div className="card animate-fade-in text-center">
                    <p className="text-3xl mb-2">💡</p>
                    <h3 className="font-display text-lg text-accent tracking-wider mb-3">DID YOU KNOW?</h3>
                    <p className="text-sm text-text-dim leading-relaxed mb-6">{activeCp.fun_fact || `${activeCp.name} has a fascinating history.`}</p>
                    <button onClick={fetchAll} className="btn-primary">Next →</button>
                  </div>
                )}

                {/* PIT STOP */}
                {phase === 'pitstop' && (
                  <div className="card animate-fade-in text-center">
                    <p className="text-5xl mb-3">🏁</p>
                    <h3 className="font-display text-2xl text-success tracking-wider mb-1">PIT STOP!</h3>
                    <h4 className="font-display text-lg text-accent mb-2">{activeCp.name}</h4>
                    <p className="text-sm text-text-dim leading-relaxed mb-2">{activeCp.description || 'Rest and enjoy!'}</p>
                    {activeCp.fun_fact && <div className="bg-surface/60 border border-border/60 rounded-xl p-4 mb-4 mt-2"><p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-1">💡 About this place</p><p className="text-xs text-text-dim leading-relaxed">{activeCp.fun_fact}</p></div>}
                    <p className="text-xs text-success font-bold mb-4">Leg {currentLegIdx + 1} Complete!</p>
                    <button onClick={() => completeCheckpoint('pitstop_reached')} disabled={submitting} className="btn-primary !bg-gradient-to-br !from-success !to-success/70">
                      {submitting ? 'Saving…' : orderedCps.indexOf(activeCp) === totalCps - 1 ? 'Finish! 🏆' : 'Next leg →'}
                    </button>
                  </div>
                )}

                {doneCount > 0 && phase !== 'welcome' && (
                  <div className="mt-6 text-center">
                    <button onClick={() => setTab('trail')} className="w-full py-3 text-sm text-text-muted hover:text-text-dim cursor-pointer bg-transparent border-none">
                      View your trail ({doneCount}) →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'map' && <GameMap checkpoints={orderedCps} completedIds={completedIds} currentCpId={activeCp?.id || null} mapContainerRef={mapContainerRef} mapInstanceRef={mapInstanceRef} />}

        {tab === 'trail' && (
          <TrailView
            legs={legs}
            checkpoints={checkpoints}
            progress={progress}
            completedIds={completedIds}
            isExplorer={isExplorer}
            startedAt={race.started_at}
          />
        )}

        {tab === 'board' && !isExplorer && (
          <div className="animate-fade-in">
            <h2 className="font-display text-xl text-accent tracking-wider mb-4">LEADERBOARD</h2>
            {allTeams.map((t, i) => {
              const tp = allProgress.filter(p => p.team_id === t.id && (p.status === 'complete' || (race?.admin_playing && p.status === 'pending')));
              const isMe = t.id === teamId;
              return (
                <div key={t.id} className={`card flex items-center gap-3 ${isMe ? '!border-accent/30' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-lg shrink-0 ${i === 0 ? 'bg-accent/15 text-accent' : 'bg-surface text-text-muted'}`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${isMe ? 'text-accent' : ''}`}>{t.name} {isMe && <span className="text-[9px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-bold">You</span>}</p>
                    <div className="h-1 rounded-full bg-border overflow-hidden mt-1"><div className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all" style={{ width: `${totalCps > 0 ? (tp.length / totalCps) * 100 : 0}%` }} /></div>
                  </div>
                  <p className="text-sm font-mono text-text-dim">{tp.length}/{totalCps}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
