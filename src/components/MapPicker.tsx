'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  lat: number | null;
  lng: number | null;
  radiusMiles: number;
  onLocationChange: (lat: number, lng: number, address: string) => void;
  city: string;
};

export default function MapPicker({ lat, lng, radiusMiles, onLocationChange, city }: Props) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [searching, setSearching] = useState(false);

  // Load Leaflet from CDN
  useEffect(() => {
    if ((window as any).L) { setLoaded(true); return; }

    // CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Geocode city name to center map
  useEffect(() => {
    if (!loaded || !city || !containerRef.current) return;
    if (lat && lng) return; // Already have coordinates

    setSearching(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`)
      .then(r => r.json())
      .then(data => {
        if (data.length > 0) {
          const centerLat = parseFloat(data[0].lat);
          const centerLng = parseFloat(data[0].lon);
          initMap(centerLat, centerLng);
        }
        setSearching(false);
      })
      .catch(() => setSearching(false));
  }, [loaded, city]);

  // Init or update map when lat/lng are set
  useEffect(() => {
    if (!loaded || !containerRef.current) return;
    if (lat && lng) initMap(lat, lng);
  }, [loaded, lat, lng]);

  // Update circle when radius changes
  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.setRadius(radiusMiles * 1609.34);
  }, [radiusMiles]);

  const initMap = (centerLat: number, centerLng: number) => {
    const L = (window as any).L;
    if (!L || !containerRef.current) return;

    // Remove existing map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      center: [centerLat, centerLng],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Add marker if we have coordinates
    if (lat && lng) {
      addMarkerAndCircle(map, L, lat, lng);
    }

    // Click to set starting point
    map.on('click', (e: any) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      addMarkerAndCircle(map, L, clickLat, clickLng);

      // Reverse geocode to get address
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${clickLat}&lon=${clickLng}`)
        .then(r => r.json())
        .then(data => {
          const name = data.display_name?.split(',').slice(0, 2).join(',') || `${clickLat.toFixed(4)}, ${clickLng.toFixed(4)}`;
          onLocationChange(clickLat, clickLng, name);
        })
        .catch(() => {
          onLocationChange(clickLat, clickLng, `${clickLat.toFixed(4)}, ${clickLng.toFixed(4)}`);
        });
    });

    mapRef.current = map;

    // Fix map rendering after mount
    setTimeout(() => map.invalidateSize(), 100);
  };

  const addMarkerAndCircle = (map: any, L: any, markerLat: number, markerLng: number) => {
    // Remove existing
    if (markerRef.current) map.removeLayer(markerRef.current);
    if (circleRef.current) map.removeLayer(circleRef.current);

    // Custom marker icon
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:24px;height:24px;border-radius:50%;background:#f5a623;border:3px solid #0a0a0f;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    markerRef.current = L.marker([markerLat, markerLng], { icon, draggable: true }).addTo(map);

    // Radius circle
    circleRef.current = L.circle([markerLat, markerLng], {
      radius: radiusMiles * 1609.34,
      color: '#f5a623',
      fillColor: '#f5a623',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '6, 4',
    }).addTo(map);

    // Drag to reposition
    markerRef.current.on('dragend', (e: any) => {
      const pos = e.target.getLatLng();
      circleRef.current.setLatLng(pos);

      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`)
        .then(r => r.json())
        .then(data => {
          const name = data.display_name?.split(',').slice(0, 2).join(',') || `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
          onLocationChange(pos.lat, pos.lng, name);
        })
        .catch(() => {
          onLocationChange(pos.lat, pos.lng, `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`);
        });
    });

    // Fit map to circle
    map.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] });
  };

  return (
    <div className="mb-4">
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-border"
        style={{ height: 220 }}
      />
      {searching && <p className="text-[10px] text-text-muted text-center mt-1 animate-pulse">Finding city...</p>}
      {!searching && loaded && (
        <p className="text-[10px] text-text-muted text-center mt-1">
          {lat && lng ? '📍 Drag pin or tap to move starting point' : '👆 Tap the map to set your starting point'}
        </p>
      )}
    </div>
  );
}
