'use client';

import { useEffect, useRef, useState } from 'react';

type LatLng = { lat: number; lng: number };

interface TravelScreenProps {
  clue: string;
  /** Destination coords. If omitted, the distance readout is hidden and arrival is honor-system. */
  destination?: LatLng | null;
  /** 'race' shows the penalty warning on hints. 'explore' keeps hints free. */
  mode?: 'race' | 'explore';
  /** Optional nudge revealed when the player taps "Stuck?". */
  hint?: string | null;
  legLabel?: string;
  stepLabel?: string;
  /** Called when the player confirms arrival. */
  onArrived: () => void;
  /** Optional: fires the first time a hint is revealed (log a penalty here). */
  onHintUsed?: () => void;
}

const FAR_THRESHOLD_M = 150;

function haversine(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Deliberately fuzzy — hints at proximity without turning the clue into a GPS arrow. */
function fuzzyDistance(m: number) {
  if (m < 60) return { text: 'You should be able to see it', tone: 'text-emerald-300' };
  if (m < 150) return { text: 'Very close', tone: 'text-emerald-300' };
  if (m < 400) return { text: 'A couple of minutes away', tone: 'text-amber-200' };
  if (m < 1000) return { text: 'About a 10 minute walk', tone: 'text-amber-200' };
  if (m < 3000) return { text: 'Still a way off', tone: 'text-zinc-300' };
  return { text: 'Not close — check the clue again', tone: 'text-rose-300' };
}

export default function TravelScreen({
  clue,
  destination,
  mode = 'explore',
  hint,
  legLabel,
  stepLabel,
  onArrived,
  onHintUsed,
}: TravelScreenProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [pos, setPos] = useState<LatLng | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [clueOpen, setClueOpen] = useState(true);
  const [hintOpen, setHintOpen] = useState(false);
  const [confirmFar, setConfirmFar] = useState(false);

  // Watch position
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Location is unavailable on this device.');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGeoError(null);
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => setGeoError('Location is off. You can still mark yourself as arrived.'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Leaflet map, player-centred, no destination pin (that's still the puzzle)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default as any;
      if (cancelled || !mapRef.current || mapObj.current) return;

      const start = pos ?? { lat: 40.7128, lng: -74.006 };
      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
      }).setView([start.lat, start.lng], 16);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: '',
        html:
          '<div style="width:18px;height:18px;border-radius:9999px;background:#34d399;box-shadow:0 0 0 6px rgba(52,211,153,.25),0 0 18px rgba(52,211,153,.9)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      markerRef.current = L.marker([start.lat, start.lng], { icon }).addTo(map);
      mapObj.current = map;
      setTimeout(() => map.invalidateSize(), 60);
    })();
    return () => {
      cancelled = true;
    };
  }, [pos]);

  // Keep the player centred as they move
  useEffect(() => {
    if (!pos || !mapObj.current || !markerRef.current) return;
    markerRef.current.setLatLng([pos.lat, pos.lng]);
    mapObj.current.panTo([pos.lat, pos.lng], { animate: true });
  }, [pos]);

  const meters = pos && destination ? haversine(pos, destination) : null;
  const proximity = meters !== null ? fuzzyDistance(meters) : null;
  const isFar = meters !== null && meters > FAR_THRESHOLD_M;

  function handleArrive() {
    if (isFar && !confirmFar) {
      setConfirmFar(true);
      return;
    }
    onArrived();
  }

  function revealHint() {
    if (!hintOpen && onHintUsed) onHintUsed();
    setHintOpen(true);
  }

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Map */}
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* Fog of war — only the ground around the player reads clearly */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(9,9,11,0) 12%, rgba(9,9,11,.55) 34%, rgba(9,9,11,.92) 62%, #09090b 82%)',
        }}
      />

      {/* Top: collapsible clue */}
      <div className="relative z-20 px-4 pt-[env(safe-area-inset-top)]">
        <div className="mt-3 rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur">
          <button
            onClick={() => setClueOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
              {legLabel ? `${legLabel} · ` : ''}
              {stepLabel ?? 'Route info'}
            </span>
            <span className="text-xs text-zinc-400">{clueOpen ? 'Hide' : 'Read clue'}</span>
          </button>
          {clueOpen && (
            <p className="px-4 pb-4 text-[15px] leading-relaxed text-zinc-100">{clue}</p>
          )}
        </div>

        {hintOpen && hint && (
          <div className="mt-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {hint}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Bottom: status + actions */}
      <div className="relative z-20 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="mb-3 text-center">
          {proximity ? (
            <p className={`text-sm font-medium ${proximity.tone}`}>{proximity.text}</p>
          ) : (
            <p className="text-sm text-zinc-400">
              {geoError ?? 'Finding you…'}
            </p>
          )}
        </div>

        {confirmFar ? (
          <div className="mb-3 rounded-2xl border border-amber-400/25 bg-zinc-900/90 p-4 backdrop-blur">
            <p className="text-sm text-zinc-200">
              You look like you're still some distance from the spot. Continue anyway?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setConfirmFar(false)}
                className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300"
              >
                Keep looking
              </button>
              <button
                onClick={onArrived}
                className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        <button
          onClick={handleArrive}
          className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-semibold tracking-wide text-zinc-950 transition active:scale-[.99]"
        >
          I'm here
        </button>

        {hint && !hintOpen && (
          <button
            onClick={revealHint}
            className="mt-2 w-full rounded-2xl border border-white/10 py-3 text-sm text-zinc-300"
          >
            Stuck? Get a hint
            {mode === 'race' && (
              <span className="ml-1 text-zinc-500">· costs you time</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
