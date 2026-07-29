'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type Props = {
  lat: number | null;
  lng: number | null;
  radiusMiles: number;
  onLocationChange: (lat: number, lng: number, address: string) => void;
  onRadiusChange: (miles: number) => void;
  city: string;
};

export default function MapPicker({ lat, lng, radiusMiles, onLocationChange, onRadiusChange, city }: Props) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeout = useRef<any>(null);
  const initializedCity = useRef('');

  // Load Leaflet
  useEffect(() => {
    if ((window as any).L) { setLoaded(true); return; }
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Center map on city
  useEffect(() => {
    if (!loaded || !city || !containerRef.current) return;
    if (initializedCity.current === city) return;
    initializedCity.current = city;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`)
      .then(r => r.json())
      .then(data => {
        if (data.length > 0) {
          initMap(parseFloat(data[0].lat), parseFloat(data[0].lon));
        }
      })
      .catch(() => {});
  }, [loaded, city]);

  // Init map with existing coords
  useEffect(() => {
    if (!loaded || !containerRef.current) return;
    if (lat && lng && !mapRef.current) initMap(lat, lng);
  }, [loaded, lat, lng]);

  // Update circle radius
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radiusMiles * 1609.34);
      if (mapRef.current) mapRef.current.fitBounds(circleRef.current.getBounds(), { padding: [30, 30] });
    }
  }, [radiusMiles]);

  // Autocomplete search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (query.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }

    searchTimeout.current = setTimeout(() => {
      const searchArea = city ? `&q=${encodeURIComponent(query + ', ' + city)}` : `&q=${encodeURIComponent(query)}`;
      fetch(`https://nominatim.openstreetmap.org/search?format=json${searchArea}&limit=5&addressdetails=1`)
        .then(r => r.json())
        .then(data => {
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
        })
        .catch(() => {});
    }, 300);
  }, [city]);

  const selectSuggestion = (item: any) => {
    const sLat = parseFloat(item.lat);
    const sLng = parseFloat(item.lon);
    const name = item.display_name.split(',').slice(0, 2).join(',').trim();

    setSearchQuery(name);
    setSuggestions([]);
    setShowSuggestions(false);

    onLocationChange(sLat, sLng, name);

    if (mapRef.current) {
      const L = (window as any).L;
      addMarkerAndCircle(mapRef.current, L, sLat, sLng);
    } else {
      initMap(sLat, sLng);
    }
  };

  const initMap = (centerLat: number, centerLng: number) => {
    const L = (window as any).L;
    if (!L || !containerRef.current) return;

    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const map = L.map(containerRef.current, {
      center: [centerLat, centerLng],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    if (lat && lng) addMarkerAndCircle(map, L, lat, lng);

    map.on('click', (e: any) => {
      const { lat: cLat, lng: cLng } = e.latlng;
      addMarkerAndCircle(map, L, cLat, cLng);
      reverseGeocode(cLat, cLng);
    });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
  };

  const reverseGeocode = (gLat: number, gLng: number) => {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${gLat}&lon=${gLng}`)
      .then(r => r.json())
      .then(data => {
        const name = data.display_name?.split(',').slice(0, 2).join(',').trim() || `${gLat.toFixed(4)}, ${gLng.toFixed(4)}`;
        setSearchQuery(name);
        onLocationChange(gLat, gLng, name);
      })
      .catch(() => onLocationChange(gLat, gLng, `${gLat.toFixed(4)}, ${gLng.toFixed(4)}`));
  };

  const addMarkerAndCircle = (map: any, L: any, mLat: number, mLng: number) => {
    if (markerRef.current) map.removeLayer(markerRef.current);
    if (circleRef.current) map.removeLayer(circleRef.current);

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:32px;height:32px;border-radius:50%;
        background:radial-gradient(circle at 30% 30%, #ff6b6b, #e74c5e);
        border:3px solid #fff;
        box-shadow:0 2px 12px rgba(231,76,94,0.5), 0 0 0 4px rgba(231,76,94,0.2);
      "></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    markerRef.current = L.marker([mLat, mLng], { icon, draggable: true }).addTo(map);

    circleRef.current = L.circle([mLat, mLng], {
      radius: radiusMiles * 1609.34,
      color: '#f5a623',
      fillColor: '#f5a623',
      fillOpacity: 0.06,
      weight: 1.5,
      dashArray: '6, 4',
    }).addTo(map);

    markerRef.current.on('dragend', (e: any) => {
      const pos = e.target.getLatLng();
      circleRef.current.setLatLng(pos);
      reverseGeocode(pos.lat, pos.lng);
    });

    map.fitBounds(circleRef.current.getBounds(), { padding: [30, 30] });
  };

  return (
    <div className="mb-4">
      {/* Search input with autocomplete */}
      <div className="relative mb-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">🔍</span>
          <input
            className="input-field !mb-0 !pl-9 !pr-3 !text-sm"
            placeholder="Search for a starting point..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 300)}
            onKeyDown={e => {
              if (e.key === 'Enter' && suggestions.length > 0) {
                e.preventDefault();
                selectSuggestion(suggestions[0]);
              } else if (e.key === 'Enter' && searchQuery.length >= 3) {
                e.preventDefault();
                // Force search on Enter
                const searchArea = city ? `&q=${encodeURIComponent(searchQuery + ', ' + city)}` : `&q=${encodeURIComponent(searchQuery)}`;
                fetch(`https://nominatim.openstreetmap.org/search?format=json${searchArea}&limit=5&addressdetails=1`)
                  .then(r => r.json())
                  .then(data => {
                    if (data.length > 0) selectSuggestion(data[0]);
                  }).catch(() => {});
              }
            }}
          />
        </div>
        {showSuggestions && (
          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl overflow-hidden shadow-lg max-h-[180px] overflow-y-auto">
            {suggestions.map((s, i) => (
              <button key={i} onMouseDown={() => selectSuggestion(s)}
                className="w-full px-3 py-2.5 text-left hover:bg-surface transition-colors cursor-pointer border-b border-border/50 last:border-none">
                <p className="text-sm text-text-primary truncate">{s.display_name?.split(',').slice(0, 2).join(',')}</p>
                <p className="text-[10px] text-text-muted truncate">{s.display_name?.split(',').slice(2, 5).join(',')}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map container */}
      <div className="relative">
        <div
          ref={containerRef}
          className="w-full rounded-xl overflow-hidden border border-border"
          style={{ height: 240 }}
        />

        {/* Radius slider overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-gradient-to-t from-bg/90 via-bg/60 to-transparent px-4 pt-6 pb-3 rounded-b-xl">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold shrink-0">Radius</span>
            <input
              type="range" min="0.5" max="15" step="0.5"
              value={radiusMiles}
              onChange={e => onRadiusChange(parseFloat(e.target.value))}
              className="flex-1 h-1 rounded-full appearance-none bg-white/10 cursor-pointer"
            />
            <span className="text-sm font-bold text-accent min-w-[55px] text-right">{radiusMiles.toFixed(1)} mi</span>
          </div>
        </div>

        {/* Tap hint */}
        {!lat && !lng && loaded && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] px-3 py-1.5 bg-bg/80 backdrop-blur rounded-full border border-border/50">
            <p className="text-[10px] text-text-dim">👆 Tap map or search to set starting point</p>
          </div>
        )}
      </div>
    </div>
  );
}
