'use client';

import { useEffect, useRef, useState } from 'react';

interface TravelScreenProps {
  /** The clue text, so players can re-read it while walking. */
  clueText?: string | null;
  /** Revealed location name, if they already gave up on the clue. */
  revealedName?: string | null;
  destLat?: number | null;
  destLng?: number | null;
  isExplorer?: boolean;
  stopLabel?: string;
  onArrived: () => void;
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Deliberately vague — nudges without turning the clue into a GPS arrow. */
function proximityText(m: number) {
  if (m < 60) return { text: 'You should be able to see it', cls: 'text-success' };
  if (m < 150) return { text: 'Very close', cls: 'text-success' };
  if (m < 400) return { text: 'A couple of minutes away', cls: 'text-accent' };
  if (m < 1000) return { text: 'About a 10 minute walk', cls: 'text-accent' };
  if (m < 3000) return { text: 'Still a way off', cls: 'text-text-dim' };
  return { text: 'Not close — worth re-reading the clue', cls: 'text-danger' };
}

const FAR_THRESHOLD_M = 150;

export default function TravelScreen({
  clueText,
  revealedName,
  destLat,
  destLng,
  isExplorer,
  stopLabel,
  onArrived,
}: TravelScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [showClue, setShowClue] = useState(false);
  const [confirmFar, setConfirmFar] = useState(false);

  // Same CDN pattern GameMap uses
  useEffect(() => {
    if ((window as any).L) { setLeafletLoaded(true); return; }
    if (!document.querySelector('link[href*="leaflet"]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(l);
    }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => setLeafletLoaded(true);
    document.head.appendChild(s);
  }, []);

  // Watch the player's position
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoDenied(true);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => { setGeoDenied(false); setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => setGeoDenied(true),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Build the map once Leaflet is in
  useEffect(() => {
    if (!leafletLoaded || !containerRef.current || mapRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    const center: [number, number] = pos ? [pos.lat, pos.lng] : [40.7128, -74.006];
    mapRef.current = L.map(containerRef.current, { center, zoom: 16, zoomControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '', subdomains: 'abcd', maxZoom: 19,
    }).addTo(mapRef.current);

    // Destination pin — you know where you're going, the challenge is getting there.
    if (destLat != null && destLng != null) {
      const destIcon = L.divIcon({
        className: '',
        html: '<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#f5a623;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:13px">📍</span></div>',
        iconSize: [30, 30], iconAnchor: [15, 30],
      });
      destMarkerRef.current = L.marker([destLat, destLng], { icon: destIcon }).addTo(mapRef.current);
    }
    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, [leafletLoaded, pos, destLat, destLng]);

  // Keep the player dot centred. Destination is never pinned — that's the puzzle.
  useEffect(() => {
    if (!mapRef.current || !pos) return;
    const L = (window as any).L;
    if (!L) return;
    if (!markerRef.current) {
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#f5a623;border:3px solid #fff;box-shadow:0 0 0 6px rgba(245,166,35,.2),0 2px 8px rgba(245,166,35,.5)"></div>',
        iconSize: [16, 16], iconAnchor: [8, 8],
      });
      markerRef.current = L.marker([pos.lat, pos.lng], { icon }).addTo(mapRef.current);
    } else {
      markerRef.current.setLatLng([pos.lat, pos.lng]);
    }
    if (destLat != null && destLng != null) {
      mapRef.current.fitBounds(
        L.latLngBounds([[pos.lat, pos.lng], [destLat, destLng]]),
        { padding: [50, 50], maxZoom: 16 }
      );
    } else {
      mapRef.current.panTo([pos.lat, pos.lng], { animate: true });
    }
  }, [pos, destLat, destLng]);

  useEffect(() => () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } }, []);

  const meters =
    pos && destLat != null && destLng != null
      ? haversine(pos.lat, pos.lng, destLat, destLng)
      : null;
  const prox = meters !== null ? proximityText(meters) : null;
  const isFar = meters !== null && meters > FAR_THRESHOLD_M;

  return (
    <div className="card animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <span className="badge bg-accent/15 text-accent">🚶 On the move</span>
        {stopLabel && <span className="text-xs text-text-muted">{stopLabel}</span>}
      </div>

      {revealedName ? (
        <div className="bg-surface/60 border border-border/60 rounded-xl p-4 mb-3 text-center">
          <p className="text-[10px] text-text-dim uppercase tracking-[2px] font-bold mb-1">Head to</p>
          <p className="text-lg font-bold text-accent">{revealedName}</p>
        </div>
      ) : (
        <p className="text-sm text-text-dim leading-relaxed mb-3 text-center">
          {isExplorer ? 'Make your way there. No rush.' : 'Get there as fast as you can.'}
        </p>
      )}

      <div className="relative rounded-xl overflow-hidden border border-border mb-3">
        <div ref={containerRef} className="w-full" style={{ height: 300 }} />
        {!leafletLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-text-dim animate-pulse">Loading map…</p>
          </div>
        )}
      </div>

      <div className="text-center mb-4">
        {prox ? (
          <p className={`text-sm font-semibold ${prox.cls}`}>{prox.text}</p>
        ) : geoDenied ? (
          <p className="text-xs text-text-muted">
            Location is off — you can still mark yourself as arrived.
          </p>
        ) : (
          <p className="text-xs text-text-dim animate-pulse">Finding you…</p>
        )}
      </div>

      {confirmFar ? (
        <div className="animate-fade-in bg-surface/60 border border-border/60 rounded-xl p-4 mb-3">
          <p className="text-sm text-text-dim mb-3">
            Looks like you're still a fair distance away. Continue anyway?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmFar(false)}
              className="flex-1 py-2.5 rounded-xl border border-border bg-transparent text-text-dim text-sm font-semibold cursor-pointer"
            >
              Keep looking
            </button>
            <button onClick={onArrived} className="flex-1 btn-primary !mt-0">Continue</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { if (isFar) setConfirmFar(true); else onArrived(); }}
          className="btn-primary"
        >
          I'm here →
        </button>
      )}

      {clueText && (
        <div className="mt-3 text-center">
          {!showClue ? (
            <button
              onClick={() => setShowClue(true)}
              className="w-full py-3 text-sm text-text-muted hover:text-text-dim cursor-pointer bg-transparent border-none"
            >
              Re-read the clue →
            </button>
          ) : (
            <div className="animate-fade-in bg-surface/60 border border-border/60 rounded-xl p-4 mt-2">
              <p className="text-sm text-text-primary italic leading-relaxed">{clueText}</p>
              <button
                onClick={() => setShowClue(false)}
                className="w-full mt-3 py-2 text-xs text-text-muted cursor-pointer bg-transparent border-none"
              >
                Hide
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
