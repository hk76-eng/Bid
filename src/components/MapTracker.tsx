import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Locate, 
  Eye, 
  Crosshair, 
  Radio, 
  Compass, 
  RefreshCw, 
  Layers, 
  Map as MapIcon,
  Search,
  MapPin,
  AlertCircle,
  Check,
  X,
  Navigation,
  Loader2,
  MousePointer
} from 'lucide-react';
import { GPSPoint, RideLocationHistoryItem, GPSSignalStatus } from '../types';
import { getApiUrl } from '../utils/apiUrl';

interface MapTrackerProps {
  currentLocation: GPSPoint | null;
  routeLocations: RideLocationHistoryItem[];
  isRideActive?: boolean;
  startLocation?: { latitude: number; longitude: number } | null;
  isRealDeviceGps?: boolean;
  gpsAccuracy?: number | null;
  gpsStatus?: GPSSignalStatus;
  endLocation?: { latitude: number; longitude: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
  onRequestGPS?: () => void;
  onSetLocation?: (lat: number, lng: number, address?: string) => void;
  showReceiptModal?: boolean;
  isGpsWindowOpen?: boolean;
  onToggleGpsWindow?: (open?: boolean) => void;
  className?: string;
}

export const MapTracker: React.FC<MapTrackerProps> = ({
  currentLocation,
  routeLocations,
  isRideActive = true,
  startLocation,
  endLocation,
  onMapClick,
  onRequestGPS,
  onSetLocation,
  showReceiptModal,
  className,
  gpsStatus,
}) => {
  if (showReceiptModal) {
    return null;
  }

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const bikeMarkerRef = useRef<L.Marker | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const [mapLayerType, setMapLayerType] = useState<'google-streets' | 'google-satellite' | 'google-terrain' | 'carto-dark'>('google-streets');
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);
  const [isAutoFollowing, setIsAutoFollowing] = useState<boolean>(true);
  const isAutoFollowingRef = useRef<boolean>(true);
  const autoResumeTimerRef = useRef<any>(null);
  const hasInitialCenteredRef = useRef<boolean>(false);
  const currentLocationRef = useRef<GPSPoint | null>(currentLocation);
  currentLocationRef.current = currentLocation;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  // Search & Geocoding States
  const [resolvedAddress, setResolvedAddress] = useState<string>('');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);
  const [showSearchBox, setShowSearchBox] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{ place_id: number; display_name: string; lat: string; lon: string }>>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [allowClickToPin, setAllowClickToPin] = useState<boolean>(false);
  const allowClickToPinRef = useRef<boolean>(false);
  allowClickToPinRef.current = allowClickToPin;

  // Reverse geocode whenever location coordinates change
  useEffect(() => {
    if (!currentLocation?.latitude || !currentLocation?.longitude) return;
    const lat = currentLocation.latitude;
    const lng = currentLocation.longitude;

    const timer = setTimeout(async () => {
      setIsReverseGeocoding(true);
      try {
        const res = await fetch(getApiUrl(`/api/motoride/geocode/reverse?lat=${lat}&lng=${lng}`));
        if (res.ok) {
          const text = await res.text();
          if (text && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
            const data = JSON.parse(text);
            if (data.address) {
              setResolvedAddress(data.address);
            }
          }
        }
      } catch {}
      finally {
        setIsReverseGeocoding(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  // Handle location search query
  const handleSearchPlaces = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(getApiUrl(`/api/motoride/geocode/search?q=${encodeURIComponent(searchQuery.trim())}`));
      if (res.ok) {
        const text = await res.text();
        if (text && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
          const data = JSON.parse(text);
          if (data.results && Array.isArray(data.results)) {
            setSearchResults(data.results.map((r: any) => ({
              lat: String(r.lat),
              lon: String(r.lng),
              display_name: r.name,
            })));
          }
        }
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPlace = (item: { lat: string; lon: string; display_name: string }) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      if (onSetLocation) {
        onSetLocation(lat, lng, item.display_name);
      }
      setResolvedAddress(item.display_name.split(',').slice(0, 3).join(','));
      setShowSearchBox(false);
      setSearchQuery('');
      setSearchResults([]);
      isAutoFollowingRef.current = true;
      setIsAutoFollowing(true);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([lat, lng], 17, { animate: true });
      }
    }
  };

  const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyB9pAU6h7_1zk9j7hEWdhcwmwQA80Ep0ZE';

  const TILE_CONFIGS: Record<string, { url: string; subdomains?: string; maxZoom: number; label: string }> = {
    'google-streets': {
      url: `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}${GOOGLE_MAPS_KEY ? `&key=${GOOGLE_MAPS_KEY}` : ''}`,
      maxZoom: 20,
      label: 'Google Streets',
    },
    'google-satellite': {
      url: `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}${GOOGLE_MAPS_KEY ? `&key=${GOOGLE_MAPS_KEY}` : ''}`,
      maxZoom: 20,
      label: 'Google Satellite',
    },
    'google-terrain': {
      url: `https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}${GOOGLE_MAPS_KEY ? `&key=${GOOGLE_MAPS_KEY}` : ''}`,
      maxZoom: 20,
      label: 'Google Terrain',
    },
    'carto-dark': {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      subdomains: 'abcd',
      maxZoom: 19,
      label: 'Carto Voyager',
    },
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Clear any previous leaflet instance id on container to prevent "Map container is already initialized"
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    const initialLat = currentLocation?.latitude || startLocation?.latitude || 12.971598;
    const initialLng = currentLocation?.longitude || startLocation?.longitude || 77.594562;

    let map: L.Map | null = null;
    try {
      map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
      });

      // Default to Google Maps Roadmap/Streets
      const initialConfig = TILE_CONFIGS[mapLayerType] || TILE_CONFIGS['google-streets'];
      const tileLayer = L.tileLayer(initialConfig.url, {
        maxZoom: initialConfig.maxZoom,
        subdomains: initialConfig.subdomains || 'abc',
      }).addTo(map);
      activeTileLayerRef.current = tileLayer;

      // Zoom control in bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Map Click Listener (only adjusts pin if click-to-pin is enabled)
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (allowClickToPinRef.current && onMapClickRef.current) {
          onMapClickRef.current(e.latlng.lat, e.latlng.lng);
        }
      });

      // When user drags map manually, pause auto-follow, then auto-resume after 4 seconds of idle
      map.on('dragstart', () => {
        isAutoFollowingRef.current = false;
        setIsAutoFollowing(false);
        if (autoResumeTimerRef.current) {
          clearTimeout(autoResumeTimerRef.current);
        }
        autoResumeTimerRef.current = setTimeout(() => {
          isAutoFollowingRef.current = true;
          setIsAutoFollowing(true);
          const currentPos = currentLocationRef.current;
          if (currentPos && mapInstanceRef.current) {
            mapInstanceRef.current.panTo([currentPos.latitude, currentPos.longitude], { animate: true, duration: 0.5 });
          }
        }, 4000);
      });

      // Create Polyline for route trail
      const polyline = L.polyline([], {
        color: '#00059F', // Requested deep indigo blue
        weight: 4.5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      polylineRef.current = polyline;
      mapInstanceRef.current = map;
    } catch (err) {
      console.warn('Map initialization error caught:', err);
    }

    // Watch container size changes and invalidate map size smoothly
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      try {
        resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            try {
              mapInstanceRef.current.invalidateSize();
              if (isAutoFollowingRef.current && currentLocationRef.current) {
                mapInstanceRef.current.panTo([currentLocationRef.current.latitude, currentLocationRef.current.longitude], { animate: false });
              }
            } catch {}
          }
        });
        resizeObserver.observe(mapContainerRef.current);
      } catch (err) {
        console.warn('ResizeObserver setup error:', err);
      }
    }

    return () => {
      if (autoResumeTimerRef.current) {
        clearTimeout(autoResumeTimerRef.current);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Map cleanup error:', e);
        }
        mapInstanceRef.current = null;
        bikeMarkerRef.current = null;
        startMarkerRef.current = null;
        endMarkerRef.current = null;
        accuracyCircleRef.current = null;
        polylineRef.current = null;
        activeTileLayerRef.current = null;
      }
    };
  }, []);

  // Switch Map Tile Layer dynamically
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const config = TILE_CONFIGS[mapLayerType] || TILE_CONFIGS['google-streets'];
    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current);
    }
    const newTileLayer = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      subdomains: config.subdomains || 'abc',
    }).addTo(map);
    activeTileLayerRef.current = newTileLayer;
  }, [mapLayerType]);

  // Update Route Polyline & Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      // 1. Update Polyline coordinates
      const latLngs = routeLocations.map((p) => [p.latitude, p.longitude] as [number, number]);
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(latLngs);
      }

      // 2. Start / Origin Marker (Only show if ride is active and vehicle has moved away from start)
      const startLat = startLocation?.latitude || (routeLocations.length > 0 ? routeLocations[0].latitude : null);
      const startLng = startLocation?.longitude || (routeLocations.length > 0 ? routeLocations[0].longitude : null);

      let hasMovedFromStart = false;
      if (startLat && startLng && currentLocation) {
        const deltaLat = Math.abs(currentLocation.latitude - startLat);
        const deltaLng = Math.abs(currentLocation.longitude - startLng);
        hasMovedFromStart = (deltaLat + deltaLng) > 0.00025; // > ~25m displacement
      }

      // 2. Start Marker A (Rendered with uploaded green pushpin marker)
      if (isRideActive && hasMovedFromStart && startLat && startLng) {
        if (!startMarkerRef.current) {
          const startIcon = L.divIcon({
            className: 'custom-origin-marker',
            html: `
              <div style="position: relative; width: 28px; height: 70px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45));">
                <img src="/marker_green.svg" alt="Pickup Point" style="width: 28px; height: 70px; object-fit: contain; pointer-events: none;" />
              </div>
            `,
            iconSize: [28, 70],
            iconAnchor: [14, 70],
          });
          startMarkerRef.current = L.marker([startLat, startLng], { icon: startIcon }).addTo(map);
        } else {
          startMarkerRef.current.setLatLng([startLat, startLng]);
        }
      } else if (startMarkerRef.current && (!isRideActive || !hasMovedFromStart)) {
        startMarkerRef.current.remove();
        startMarkerRef.current = null;
      }

      // 3. End Marker (for completed rides)
      if (endLocation?.latitude && endLocation?.longitude) {
        if (!endMarkerRef.current) {
          const endIcon = L.divIcon({
            className: 'custom-end-marker',
            html: `
              <div style="position: relative; width: 28px; height: 70px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45));">
                <img src="/marker_red.svg" alt="Dropoff Point" style="width: 28px; height: 70px; object-fit: contain; pointer-events: none;" />
              </div>
            `,
            iconSize: [28, 70],
            iconAnchor: [14, 70],
          });
          endMarkerRef.current = L.marker([endLocation.latitude, endLocation.longitude], { icon: endIcon }).addTo(map);
        } else {
          endMarkerRef.current.setLatLng([endLocation.latitude, endLocation.longitude]);
        }
      } else if (endMarkerRef.current) {
        endMarkerRef.current.remove();
        endMarkerRef.current = null;
      }

      // 4. Current Live Position Marker - ALWAYS visible with uploaded passenger icon and rotating heading indicator
      const activeLat = currentLocation?.latitude ?? startLocation?.latitude ?? 12.971598;
      const activeLng = currentLocation?.longitude ?? startLocation?.longitude ?? 77.594562;
      const heading = currentLocation?.heading || 0;
      const accuracy = currentLocation?.accuracy || 10;

      const liveLocationIcon = L.divIcon({
        className: 'custom-live-location-passenger-marker',
        html: `
          <div style="position: relative; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; pointer-events: auto;">
            <!-- Radar Pulse Waves -->
            <div style="position: absolute; width: 52px; height: 52px; border-radius: 50%; background-color: rgba(29, 63, 132, 0.28); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; width: 42px; height: 42px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.2); animation: pulse 1.6s ease-in-out infinite;"></div>
            
            <!-- Rotating Heading Navigator Arrow Wrapper -->
            <div style="position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center; transform: rotate(${heading || 0}deg); transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none;">
              <!-- Directional Navigator Pointer Arrow -->
              <div style="margin-top: -7px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.65));">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#1d3f84" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 19 21 12 17 5 21 12 2" />
                </svg>
              </div>
            </div>

            <!-- Central Badge: Uploaded Passenger Icon -->
            <div style="position: relative; width: 36px; height: 36px; border-radius: 50%; background: #1d3f84; border: 2.5px solid #ffffff; box-shadow: 0 4px 14px rgba(29, 63, 132, 0.65), 0 0 0 2px rgba(59, 130, 246, 0.35); overflow: hidden; display: flex; align-items: center; justify-content: center;">
              <img src="/passenger_icon.svg" alt="Passenger Live Location" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
            </div>
          </div>
        `,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });

      if (!bikeMarkerRef.current) {
        bikeMarkerRef.current = L.marker([activeLat, activeLng], { icon: liveLocationIcon, zIndexOffset: 1000 }).addTo(map);
      } else {
        bikeMarkerRef.current.setLatLng([activeLat, activeLng]);
        bikeMarkerRef.current.setIcon(liveLocationIcon);
      }

      // Accuracy Circle
      if (accuracy) {
        if (!accuracyCircleRef.current) {
          accuracyCircleRef.current = L.circle([activeLat, activeLng], {
            radius: Math.min(accuracy, 100),
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.1,
            weight: 1,
          }).addTo(map);
        } else {
          accuracyCircleRef.current.setLatLng([activeLat, activeLng]);
          accuracyCircleRef.current.setRadius(Math.min(accuracy, 100));
        }
      }

      // Camera Centering & Live Tracking: always follow live position
      if (!hasInitialCenteredRef.current) {
        hasInitialCenteredRef.current = true;
        map.setView([activeLat, activeLng], 17);
      } else if (isAutoFollowingRef.current) {
        const currentCenter = map.getCenter();
        const dist = Math.hypot(currentCenter.lat - activeLat, currentCenter.lng - activeLng);
        if (dist > 0.05) {
          map.setView([activeLat, activeLng], 17, { animate: true });
        } else {
          map.panTo([activeLat, activeLng], { animate: true, duration: 0.4 });
        }
      }
    } catch (err) {
      console.warn('Leaflet update error:', err);
    }
  }, [currentLocation, routeLocations, isRideActive, startLocation, endLocation]);

  const handleCenterMap = () => {
    if (!mapInstanceRef.current) return;
    isAutoFollowingRef.current = true;
    setIsAutoFollowing(true);
    if (autoResumeTimerRef.current) {
      clearTimeout(autoResumeTimerRef.current);
    }
    const targetLat = currentLocation?.latitude ?? startLocation?.latitude ?? 12.971598;
    const targetLng = currentLocation?.longitude ?? startLocation?.longitude ?? 77.594562;
    mapInstanceRef.current.setView([targetLat, targetLng], 17, { animate: true });
  };

  const handleFitRoute = () => {
    if (!mapInstanceRef.current || routeLocations.length === 0) return;
    const bounds = L.latLngBounds(routeLocations.map((p) => [p.latitude, p.longitude]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], animate: true });
  };

  return (
    <div className={`relative w-full h-full overflow-hidden bg-slate-950 ${className || ''}`}>
      {/* Map Container Element */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Location & Search Control Bar */}
      <div className="absolute top-4 left-4 z-[400] max-w-[calc(100vw-110px)] sm:max-w-md">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md p-1.5 flex items-center gap-1.5 transition-all">
          {showSearchBox ? (
            <form onSubmit={handleSearchPlaces} className="flex items-center gap-1.5 w-full min-w-[260px] sm:min-w-[320px]">
              <Search className="w-4 h-4 text-slate-400 ml-2 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length >= 3) {
                    handleSearchPlaces();
                  }
                }}
                placeholder="Search city, area or street..."
                className="bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none flex-1 py-1.5"
              />
              {isSearching && <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSearchBox(false);
                  setSearchResults([]);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                title="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <>
              {gpsStatus?.quality === 'DENIED' ? (
                <div className="flex items-center gap-2 px-2 py-1 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-medium">GPS Blocked</span>
                  {onRequestGPS && (
                    <button
                      type="button"
                      onClick={onRequestGPS}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] px-2.5 py-1 rounded-lg transition-all active:scale-95 cursor-pointer ml-1"
                    >
                      Allow Access
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2.5 py-1 text-xs text-slate-200">
                  <div className="relative flex items-center justify-center shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute opacity-75"></span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 relative"></span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-100 truncate max-w-[150px] sm:max-w-[220px]">
                        {resolvedAddress || (isReverseGeocoding ? 'Detecting area...' : `${currentLocation?.latitude ? currentLocation.latitude.toFixed(4) : '...' }, ${currentLocation?.longitude ? currentLocation.longitude.toFixed(4) : '...' }`)}
                      </span>
                      {currentLocation?.accuracy && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30 font-mono shrink-0">
                          ±{Math.round(currentLocation.accuracy)}m
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Search Toggle Button */}
              <button
                type="button"
                onClick={() => setShowSearchBox(true)}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                title="Search City or Street"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Pinpoint Mode Toggle */}
              <button
                type="button"
                onClick={() => setAllowClickToPin(!allowClickToPin)}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  allowClickToPin
                    ? 'bg-amber-500/30 text-amber-300 ring-1 ring-amber-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={allowClickToPin ? 'Tap map to adjust pin (Enabled)' : 'Enable tap map to adjust pin'}
              >
                <MousePointer className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchBox && searchResults.length > 0 && (
          <div className="mt-1.5 bg-slate-900/98 border border-slate-700/90 rounded-2xl shadow-2xl p-1.5 backdrop-blur-lg flex flex-col gap-1 max-h-60 overflow-y-auto">
            {searchResults.map((item) => (
              <button
                key={item.place_id}
                type="button"
                onClick={() => handleSelectPlace(item)}
                className="text-left px-3 py-2 rounded-xl hover:bg-slate-800 text-xs text-slate-200 transition-colors flex items-start gap-2 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span className="line-clamp-2 leading-relaxed">{item.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sleek Icon-Only Map Overlay Controls */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2.5">
        {/* Re-Center & Lock on Live GPS Button */}
        <button
          id="btn-center-map"
          type="button"
          onClick={handleCenterMap}
          className={`p-3 rounded-2xl border shadow-2xl backdrop-blur-md transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
            isAutoFollowing
              ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/60 ring-2 ring-emerald-500/40 shadow-emerald-500/20'
              : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-700/80 hover:text-white'
          }`}
          title={isAutoFollowing ? 'Live GPS Auto-Follow Locked' : 'Click to Lock on Live GPS'}
        >
          <Locate className={`w-5 h-5 ${isAutoFollowing ? 'text-emerald-400' : 'text-slate-300'}`} />
        </button>

        {/* Map Layer Switcher (Icon-only palette) */}
        <div className="relative">
          <button
            id="btn-switch-map-layer"
            type="button"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-slate-700/80 shadow-2xl backdrop-blur-md transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Switch Map Layer"
          >
            <Layers className="w-5 h-5" />
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 top-14 z-[500] bg-slate-900/95 border border-slate-700/90 rounded-2xl shadow-2xl p-1.5 backdrop-blur-md flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setMapLayerType('google-streets');
                  setShowLayerMenu(false);
                }}
                className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                  mapLayerType === 'google-streets'
                    ? 'bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Streets"
              >
                <MapIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapLayerType('google-satellite');
                  setShowLayerMenu(false);
                }}
                className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                  mapLayerType === 'google-satellite'
                    ? 'bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Satellite"
              >
                <Radio className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapLayerType('google-terrain');
                  setShowLayerMenu(false);
                }}
                className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                  mapLayerType === 'google-terrain'
                    ? 'bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Terrain"
              >
                <Compass className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapLayerType('carto-dark');
                  setShowLayerMenu(false);
                }}
                className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                  mapLayerType === 'carto-dark'
                    ? 'bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Dark"
              >
                <Crosshair className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* GPS Fix / Refresh Signal Button */}
        {onRequestGPS && (
          <button
            id="btn-refresh-gps"
            type="button"
            onClick={onRequestGPS}
            className="p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-teal-400 border border-slate-700/80 shadow-2xl backdrop-blur-md transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Refresh GPS"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}

        {/* Fit Trail Button */}
        {routeLocations.length > 1 && (
          <button
            id="btn-fit-route"
            type="button"
            onClick={handleFitRoute}
            className="p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-slate-700/80 shadow-2xl backdrop-blur-md transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Fit Trail"
          >
            <Eye className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
