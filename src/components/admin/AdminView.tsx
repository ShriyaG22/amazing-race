'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { randomMiniGame } from '@/lib/utils';
import type { Race, Leg, Checkpoint, Team, Progress } from '@/lib/supabase';
import AIGenerator, { type GeneratedLeg } from './AIGenerator';
import LegsBuilder from './LegsBuilder';

type Props = { raceId: string; onExit: () => void };

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export default function AdminView({ raceId, onExit }: Props) {
  const [race, setRace] = useState<Race | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [tab, setTab] = useState<'legs' | 'map' | 'teams' | 'board' | 'review'>('legs');
  const [legsMode, setLegsMode] = useState<'build' | 'ai'>('build');
  const [city, setCity] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [startAddress, setStartAddress] = useState('');
  const [radiusKm, setRadiusKm] = useState(5);
  const [importing, setImporting] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const fetchAll = async () => {
    const [r, l, c, t, p] = await Promise.all([
      supabase.from('races').select().eq('id', raceId).single(),
      supabase.from('legs').select().eq('race_id', raceId).order('order_num'),
      supabase.from('checkpoints').select().order('order_num'),
      supabase.from('teams').select().eq('race_id', raceId),
      supabase.from('progress').select(),
    ]);
    if (r.data) {
      setRace(r.data);
      if (r.data.city && !city) setCity(r.data.city);
      if (r.data.difficulty) setDifficulty(r.data.difficulty);
      if (r.data.start_address) setStartAddress(r.data.start_address);
      if (r.data.radius_km) setRadiusKm(r.data.radius_km);
    }
    if (l.data) setLegs(l.data);
    if (c.data) {
      const legIds = (l.data || []).map(x => x.id);
      setCheckpoints(c.data.filter(cp => legIds.includes(cp.leg_id)));
    }
    if (t.data) setTeams(t.data);
    if (p.data) {
      const teamIds = (t.data || []).map(x => x.id);
      setProgress(p.data.filter(pr => teamIds.includes(pr.team_id)));
    }
  };

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 4000);
    return () => clearInterval(iv);
  }, [raceId]);

  // ── Mapbox ──────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'map' || !mapContainerRef.current || !MAPBOX_TOKEN) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Dynamically load Mapbox GL
    const loadMap = async () => {
      if (!(window as any).mapboxgl) {
        // Load CSS
        if (!document.querySelector('link[href*="mapbox-gl"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
          document.head.appendChild(link);
        }
        // Load JS
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }

      const mapboxgl = (window as any).mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const cpsWithCoords = checkpoints.filter(cp => cp.lat && cp.lng);
      const center: [number, number] = cpsWithCoords.length > 0
        ? [
            cpsWithCoords.reduce((s, c) => s + (c.lng || 0), 0) / cpsWithCoords.length,
            cpsWithCoords.reduce((s, c) => s + (c.lat || 0), 0) / cpsWithCoords.length,
          ]
        : [-74.006, 40.7128]; // Default NYC

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center,
        zoom: cpsWithCoords.length > 0 ? 13 : 11,
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add checkpoint markers
      cpsWithCoords.forEach((cp, i) => {
        const leg = legs.find(l => l.id === cp.leg_id);
        const legIdx = leg ? legs.indexOf(leg) : 0;
        const colors = ['#f5a623', '#e74c5e', '#9b59b6', '#2ecc71', '#3b82f6', '#00d2d3', '#f59e0b'];
        const color = colors[legIdx % colors.length];

        const el = document.createElement('div');
        el.style.cssText = `
          width: 28px; height: 28px; border-radius: 50%;
          background: ${color}; border: 3px solid #0a0a0f;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 800; color: #0a0a0f;
          cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        `;
        el.textContent = String(cp.order_num + 1);

        const typeIcon = cp.type === 'minigame' ? '🧩' : cp.type === 'roadblock' ? '🚧' : '🏁';

        new mapboxgl.Marker({ element: el })
          .setLngLat([cp.lng!, cp.lat!])
          .setPopup(
            new mapboxgl.Popup({ offset: 20, className: 'race-popup' })
              .setHTML(`
                <div style="font-family: 'DM Sans', sans-serif; padding: 4px;">
                  <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">
                    ${leg?.name || 'Leg'} · ${typeIcon} ${cp.type}
                  </div>
                  <div style="font-size:14px;font-weight:700;color:#fff;">${cp.name}</div>
                  ${cp.description ? `<div style="font-size:12px;color:#aaa;margin-top:4px;">${cp.description.slice(0, 80)}${cp.description.length > 80 ? '…' : ''}</div>` : ''}
                </div>
              `)
          )
          .addTo(map);
      });

      // Draw lines connecting checkpoints per leg
      map.on('load', () => {
        legs.forEach((leg, legIdx) => {
          const legCps = cpsWithCoords
            .filter(cp => cp.leg_id === leg.id)
            .sort((a, b) => a.order_num - b.order_num);

          if (legCps.length < 2) return;
          const colors = ['#f5a623', '#e74c5e', '#9b59b6', '#2ecc71', '#3b82f6', '#00d2d3'];
          const color = colors[legIdx % colors.length];

          map.addSource(`leg-${leg.id}`, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: legCps.map(cp => [cp.lng!, cp.lat!]),
              },
            },
          });

          map.addLayer({
            id: `leg-line-${leg.id}`,
            type: 'line',
            source: `leg-${leg.id}`,
            paint: {
              'line-color': color,
              'line-width': 2,
              'line-opacity': 0.5,
              'line-dasharray': [2, 2],
            },
          });
        });
      });

      mapRef.current = map;
    };

    loadMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [tab, checkpoints, legs]);

  // ── AI Generated Import ────────────────────────────────────
  const handleAIGenerated = async (generatedLegs: GeneratedLeg[]) => {
    setImporting(true);
    try {
      if (city.trim()) {
        await supabase.from('races').update({ city: city.trim() }).eq('id', raceId);
      }

      for (let i = 0; i < generatedLegs.length; i++) {
        const gl = generatedLegs[i];
        const { data: legData } = await supabase
          .from('legs')
          .insert({ race_id: raceId, name: gl.name, order_num: legs.length + i })
          .select()
          .single();

        if (legData && gl.checkpoints?.length) {
          const validMiniGames = ['sliding', 'wordsearch', 'simon'];
          const cpRows = gl.checkpoints.map((cp, j) => ({
            leg_id: legData.id,
            name: cp.name,
            type: cp.type,
            description: cp.description || '',
            clue_text: cp.clueText || '',
            requires_approval: cp.type !== 'minigame',
            order_num: j,
            answer: cp.answer || '',
            mini_game_type: cp.type === 'minigame'
              ? (cp.miniGameType && validMiniGames.includes(cp.miniGameType) ? cp.miniGameType : randomMiniGame())
              : '',
            lat: cp.lat || null,
            lng: cp.lng || null,
          }));
          await supabase.from('checkpoints').insert(cpRows);
        }
      }

      await fetchAll();
      setLegsMode('build');
    } catch (err) {
      console.error('Import error:', err);
    }
    setImporting(false);
  };

  const handleCityChange = async (newCity: string) => {
    setCity(newCity);
    if (newCity.trim()) {
      await supabase.from('races').update({ city: newCity.trim() }).eq('id', raceId);
    }
  };

  const handleDifficultyChange = async (d: string) => {
    setDifficulty(d);
    await supabase.from('races').update({ difficulty: d }).eq('id', raceId);
  };

  const handleStartAddressChange = async (a: string) => {
    setStartAddress(a);
    // Debounce: only save on blur or generate
    await supabase.from('races').update({ start_address: a }).eq('id', raceId);
  };

  const handleRadiusChange = async (r: number) => {
    setRadiusKm(r);
    await supabase.from('races').update({ radius_km: r }).eq('id', raceId);
  };

  const toggleAdminPlaying = async () => {
    const newVal = !race?.admin_playing;
    await supabase.from('races').update({ admin_playing: newVal }).eq('id', raceId);
    fetchAll();
  };

  const pendingCount = progress.filter(p => p.status === 'pending').length;

  if (!race) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-text-dim animate-pulse">Loading race...</p>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <p className="text-[11px] text-text-dim tracking-[3px] uppercase">Admin</p>
          <h1 className="font-display text-2xl text-accent tracking-wider">{race.name}</h1>
        </div>
        <button onClick={onExit} className="btn-sm">Exit</button>
      </div>

      {/* Join Code */}
      <div className="card flex items-center justify-between !p-4">
        <div>
          <p className="text-[11px] text-text-dim uppercase tracking-wide">Join Code</p>
          <p className="font-display text-3xl text-accent tracking-[4px]">{race.code}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-sm" onClick={() => navigator.clipboard?.writeText(race.code)}>
            Copy
          </button>
          {race.status === 'setup' && (
            <button className="btn-success" onClick={async () => {
              await supabase.from('races').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', raceId);
              fetchAll();
            }}>Start Race</button>
          )}
          {race.status === 'active' && (
            <button className="btn-danger" onClick={async () => {
              await supabase.from('races').update({ status: 'finished' }).eq('id', raceId);
              fetchAll();
            }}>End Race</button>
          )}
        </div>
      </div>

      {/* Status + Admin Playing Toggle */}
      <div className="flex gap-2 items-center mb-2">
        <span className={`badge ${race.status === 'setup' ? 'bg-info/20 text-info' : race.status === 'active' ? 'bg-success/20 text-success' : 'bg-text-muted/20 text-text-muted'}`}>
          {race.status === 'setup' ? 'Setting Up' : race.status === 'active' ? 'Race Active' : 'Finished'}
        </span>
        {race.city && <span className="badge bg-accent/10 text-accent">{race.city}</span>}
      </div>

      {/* Admin Playing Toggle */}
      <div className="card !p-3 flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold">Playing too?</p>
          <p className="text-[11px] text-text-dim">
            {race.admin_playing
              ? 'Players auto-advance. Review photos later.'
              : 'You review & approve each submission live.'}
          </p>
        </div>
        <button
          onClick={toggleAdminPlaying}
          className={`relative w-12 h-7 rounded-full transition-all cursor-pointer ${
            race.admin_playing ? 'bg-success' : 'bg-border'
          }`}
        >
          <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
            race.admin_playing ? 'left-[22px]' : 'left-0.5'
          }`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['legs', 'map', 'teams', 'board', 'review'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`tab ${tab === t ? 'tab-active' : 'tab-inactive'}`}>
            {t}{t === 'review' && pendingCount > 0 && (
              <span className="ml-1 bg-danger text-white rounded-full px-1.5 py-0.5 text-[10px]">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {tab === 'legs' && (
          <div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setLegsMode('build')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold tracking-wide border cursor-pointer transition-all ${
                  legsMode === 'build'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-transparent text-text-dim'
                }`}
              >
                🛠 Build
              </button>
              <button
                onClick={() => setLegsMode('ai')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold tracking-wide border cursor-pointer transition-all ${
                  legsMode === 'ai'
                    ? 'border-purple bg-purple/10 text-purple'
                    : 'border-border bg-transparent text-text-dim'
                }`}
              >
                ✦ AI Generate
              </button>
            </div>

            {importing && (
              <div className="card !bg-purple/5 !border-purple/20 text-center mb-4 animate-pulse">
                <p className="text-purple text-sm font-semibold">Importing AI-generated legs…</p>
              </div>
            )}

            {legsMode === 'ai' && (
              <AIGenerator
                city={city}
                difficulty={difficulty}
                startAddress={startAddress}
                radiusKm={radiusKm}
                onCityChange={handleCityChange}
                onDifficultyChange={handleDifficultyChange}
                onStartAddressChange={handleStartAddressChange}
                onRadiusChange={handleRadiusChange}
                onGenerated={handleAIGenerated}
              />
            )}

            {legsMode === 'build' && (
              <LegsBuilder raceId={raceId} legs={legs} checkpoints={checkpoints} onRefresh={fetchAll} />
            )}
          </div>
        )}

        {/* Map Tab */}
        {tab === 'map' && (
          <div>
            {!MAPBOX_TOKEN && (
              <div className="card !bg-danger/5 !border-danger/20 text-center mb-4">
                <p className="text-danger text-sm font-semibold">Add NEXT_PUBLIC_MAPBOX_TOKEN to Vercel env vars</p>
              </div>
            )}
            {MAPBOX_TOKEN && checkpoints.filter(cp => cp.lat && cp.lng).length === 0 && (
              <p className="text-text-dim text-center py-4 text-sm">No checkpoint coordinates yet. Use AI Generate to add locations.</p>
            )}
            <div ref={mapContainerRef} className="w-full rounded-xl overflow-hidden border border-border" style={{ height: 400 }} />
            {/* Legend */}
            {legs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {legs.map((leg, i) => {
                  const colors = ['#f5a623', '#e74c5e', '#9b59b6', '#2ecc71', '#3b82f6', '#00d2d3'];
                  return (
                    <div key={leg.id} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: colors[i % colors.length] }} />
                      <span className="text-[11px] text-text-dim">{leg.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'teams' && (
          <div>
            {teams.length === 0 && <p className="text-text-dim text-center py-8">No teams yet. Share the join code!</p>}
            {teams.map(t => (
              <div key={t.id} className="card flex justify-between items-center">
                <div>
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-xs text-text-dim">Joined {new Date(t.joined_at).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'board' && (
          <div>
            {teams.length === 0 && <p className="text-text-dim text-center py-8">No teams yet.</p>}
            {teams
              .map(t => {
                const teamProg = progress.filter(p => p.team_id === t.id && p.status === 'complete');
                return { ...t, completed: teamProg.length };
              })
              .sort((a, b) => b.completed - a.completed)
              .map((t, i) => (
                <div key={t.id} className="card flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-lg shrink-0 ${
                    i === 0 ? 'bg-accent/15 text-accent' : 'bg-surface text-text-muted'
                  }`}>{i + 1}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{t.name}</p>
                    <div className="h-1 rounded-full bg-border overflow-hidden mt-1">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all"
                        style={{ width: `${checkpoints.length > 0 ? (t.completed / checkpoints.length) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <p className="text-sm font-mono text-text-dim">{t.completed}/{checkpoints.length}</p>
                </div>
              ))}
          </div>
        )}

        {tab === 'review' && (
          <div>
            {/* Review mode info */}
            {race.admin_playing && (
              <div className="card !bg-success/5 !border-success/20 mb-4">
                <p className="text-success text-sm font-semibold">🎮 Play mode ON</p>
                <p className="text-text-dim text-xs mt-1">Players auto-advance after submitting. Review photos here at the end.</p>
              </div>
            )}

            {progress.filter(p => p.status === 'pending').length === 0 && progress.filter(p => p.status === 'complete').length === 0 && (
              <p className="text-text-dim text-center py-8">No submissions yet.</p>
            )}

            {/* Pending submissions */}
            {progress.filter(p => p.status === 'pending').length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] text-text-dim uppercase tracking-[2px] font-bold mb-2">
                  Pending ({progress.filter(p => p.status === 'pending').length})
                </p>
                {progress
                  .filter(p => p.status === 'pending')
                  .map(p => {
                    const cp = checkpoints.find(c => c.id === p.checkpoint_id);
                    const tm = teams.find(t => t.id === p.team_id);
                    return (
                      <div key={p.id} className="card animate-fade-in">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="badge bg-accent/10 text-accent">{tm?.name || 'Team'}</span>
                          <span className="text-text-muted text-xs">→</span>
                          <span className="text-sm font-semibold">{cp?.name || 'Checkpoint'}</span>
                        </div>
                        {cp && <p className="text-xs text-text-dim mb-2">{cp.description}</p>}
                        <div className="bg-surface border border-border rounded-xl p-3 mb-3">
                          <p className="text-[10px] text-text-dim uppercase tracking-wide font-bold mb-1">Proof</p>
                          {p.proof?.startsWith('data:image') ? (
                            <img src={p.proof} alt="Photo proof" className="w-full max-h-[200px] object-cover rounded-lg" />
                          ) : (
                            <p className="text-sm text-text-primary">{p.proof || '(empty)'}</p>
                          )}
                          <p className="text-[10px] text-text-muted mt-1">{new Date(p.submitted_at).toLocaleString()}</p>
                        </div>
                        {!race.admin_playing && (
                          <div className="flex gap-2">
                            <button className="btn-success flex-1" onClick={async () => {
                              await supabase.from('progress').update({ status: 'complete', reviewed_at: new Date().toISOString() }).eq('id', p.id);
                              fetchAll();
                            }}>✓ Approve</button>
                            <button className="btn-danger flex-1" onClick={async () => {
                              await supabase.from('progress').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', p.id);
                              fetchAll();
                            }}>✗ Reject</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Completed/reviewed submissions (for post-game review) */}
            {progress.filter(p => p.status === 'complete' && p.proof && p.proof !== 'minigame_solved').length > 0 && (
              <div>
                <p className="text-[11px] text-text-dim uppercase tracking-[2px] font-bold mb-2">
                  Completed ({progress.filter(p => p.status === 'complete' && p.proof && p.proof !== 'minigame_solved').length})
                </p>
                {progress
                  .filter(p => p.status === 'complete' && p.proof && p.proof !== 'minigame_solved')
                  .map(p => {
                    const cp = checkpoints.find(c => c.id === p.checkpoint_id);
                    const tm = teams.find(t => t.id === p.team_id);
                    return (
                      <div key={p.id} className="card !bg-success/3 !border-success/10">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-success text-xs">✓</span>
                          <span className="text-xs font-semibold text-text-dim">{tm?.name}</span>
                          <span className="text-text-muted text-xs">→</span>
                          <span className="text-xs text-text-dim">{cp?.name}</span>
                        </div>
                        {p.proof?.startsWith('data:image') ? (
                          <img src={p.proof} alt="Photo proof" className="w-full max-h-[160px] object-cover rounded-lg mt-1" />
                        ) : (
                          <p className="text-sm text-text-muted">{p.proof}</p>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
