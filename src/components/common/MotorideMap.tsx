import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Navigation, Crosshair, Compass, Mountain, Moon, LocateFixed, Plus, Minus } from 'lucide-react';
import { calculateHaversineDistanceKm } from '../../utils/distanceCalculator';

export type MapLayerType = 'google-street' | 'google-terrain' | 'voyager-dark';

interface MapLayerConfig {
  id: MapLayerType;
  label: string;
  shortLabel: string;
  tooltip: string;
  url: string;
  subdomains: string[];
  maxZoom: number;
}

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyB9pAU6h7_1zk9j7hEWdhcwmwQA80Ep0ZE';

const MAP_LAYERS: Record<MapLayerType, MapLayerConfig> = {
  'google-street': {
    id: 'google-street',
    label: 'Google Street',
    shortLabel: 'Street',
    tooltip: 'Google Maps Roadmaps & Street View (Default)',
    url: `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}${GOOGLE_MAPS_KEY ? `&key=${GOOGLE_MAPS_KEY}` : ''}`,
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
  },
  'google-terrain': {
    id: 'google-terrain',
    label: 'Google Terrain',
    shortLabel: 'Terrain',
    tooltip: 'Google Maps Topographic Terrain & Relief',
    url: `https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}${GOOGLE_MAPS_KEY ? `&key=${GOOGLE_MAPS_KEY}` : ''}`,
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
  },
  'voyager-dark': {
    id: 'voyager-dark',
    label: 'Voyager Dark',
    shortLabel: 'Voyager Dark',
    tooltip: 'Voyager Dark Night Carto Style',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
  },
};

export interface AvailableCaptainItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  heading?: number;
  rating?: number;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  distanceKm?: number;
  etaMinutes?: number;
  isNearest?: boolean;
}

interface MotorideMapProps {
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupAddress?: string;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  dropoffAddress?: string;
  pickupDistanceText?: string;
  dropoffDistanceText?: string;
  captainLat?: number | null;
  captainLng?: number | null;
  captainHeading?: number;
  captainAccuracy?: number | null;
  captainName?: string;
  isCaptainMode?: boolean;
  passengerLat?: number | null;
  passengerLng?: number | null;
  passengerHeading?: number | null;
  passengerAccuracy?: number | null;
  passengerName?: string;
  showPassengerOnly?: boolean;
  showLocationsABOnly?: boolean;
  bottomSheetPadding?: number;
  rideDistanceText?: string;
  totalDistanceKm?: number | null;
  rideType?: string | null;
  isLiveGpsActive?: boolean;
  onLocateMe?: () => void;
  onSetPickupToPassengerLocation?: (lat: number, lng: number) => void;
  interactive?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  initialLayer?: MapLayerType;
  onLayerChange?: (layer: MapLayerType) => void;
  showOverlayControls?: boolean;
  nearbyCaptains?: AvailableCaptainItem[];
  nearestCaptain?: AvailableCaptainItem | null;
  onSelectCaptain?: (captain: AvailableCaptainItem) => void;
  onFocusNearestCaptain?: () => void;
  activeRideStatus?: string | null;
  focusCoords?: { lat: number; lng: number; zoom?: number; timestamp: number } | null;
  onFocusCoordsProcessed?: () => void;
  zoomAction?: { type: 'in' | 'out'; timestamp: number } | null;
  onMapMoveStart?: () => void;
  onMapMoveEnd?: (lat: number, lng: number) => void;
  pickupMarkerType?: 'marker' | 'passenger';
  onPickupDragEnd?: (lat: number, lng: number) => void;
  dropoffMarkerType?: 'marker' | 'destination';
  onDropoffDragEnd?: (lat: number, lng: number) => void;
  hidePassengerIcon?: boolean;
}

export const MotorideMap: React.FC<MotorideMapProps> = ({
  pickupLat,
  pickupLng,
  pickupAddress,
  dropoffLat,
  dropoffLng,
  dropoffAddress,
  pickupDistanceText,
  dropoffDistanceText,
  captainLat,
  captainLng,
  captainHeading = 0,
  captainAccuracy,
  captainName = 'Captain (You)',
  isCaptainMode = false,
  passengerLat,
  passengerLng,
  passengerHeading = 0,
  passengerAccuracy,
  passengerName = 'You',
  showPassengerOnly = false,
  showLocationsABOnly = false,
  bottomSheetPadding,
  rideDistanceText,
  totalDistanceKm,
  rideType,
  isLiveGpsActive = false,
  onLocateMe,
  onSetPickupToPassengerLocation,
  interactive = true,
  onMapClick,
  className = 'w-full h-full',
  initialLayer = 'google-street',
  onLayerChange,
  showOverlayControls = false,
  nearbyCaptains = [],
  nearestCaptain = null,
  onSelectCaptain,
  onFocusNearestCaptain,
  activeRideStatus = null,
  focusCoords = null,
  onFocusCoordsProcessed,
  zoomAction = null,
  onMapMoveStart,
  onMapMoveEnd,
  pickupMarkerType = 'marker',
  onPickupDragEnd,
  dropoffMarkerType = 'marker',
  onDropoffDragEnd,
  hidePassengerIcon = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropoffMarkerRef = useRef<L.Marker | null>(null);
  const captainMarkerRef = useRef<L.Marker | null>(null);
  const captainAccuracyCircleRef = useRef<L.Circle | null>(null);
  const captainToTargetLineRef = useRef<L.Polyline | null>(null);
  const passengerMarkerRef = useRef<L.Marker | null>(null);
  const passengerAccuracyCircleRef = useRef<L.Circle | null>(null);
  const passengerToPickupLineRef = useRef<L.Polyline | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const polylineGlowRef = useRef<L.Polyline | null>(null);
  const routeDistanceMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const nearbyCaptainMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const hasInitiallyCenteredPassengerRef = useRef<boolean>(false);
  const hasInitiallyCenteredCaptainRef = useRef<boolean>(false);
  const lastFittedRouteKeyRef = useRef<string>('');
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [activeLayer, setActiveLayer] = useState<MapLayerType>(initialLayer);
  const [isFollowingPassenger, setIsFollowingPassenger] = useState<boolean>(true);
  const [isFollowingCaptain, setIsFollowingCaptain] = useState<boolean>(true);

  const handleSelectLayer = (layer: MapLayerType) => {
    setActiveLayer(layer);
    if (onLayerChange) {
      onLayerChange(layer);
    }
  };

  // Custom DivIcon for Passenger GPS Live Location using the uploaded passenger_icon.png
  const createPassengerIcon = (label: string = 'Where To ?', isPickupHere: boolean = false) =>
    L.divIcon({
      className: 'passenger-gps-live-marker',
      html: `
        <div style="position: relative; width: 72px; height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; user-select: none; pointer-events: auto; cursor: pointer;" title="Click 'Where To ?' to set Passenger Pickup Location A">
          <!-- Top Floating Capsule Badge: Where To ? -->
          <div class="passenger-where-to-pill" style="position: absolute; top: -16px; left: 50%; transform: translateX(-50%); background: #020617; color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 900; padding: 3px 10px; border-radius: 9999px; border: 1.5px solid #3b82f6; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,0.7), 0 0 10px rgba(59,130,246,0.35); pointer-events: auto; cursor: pointer; letter-spacing: 0.3px; z-index: 40; display: flex; align-items: center; gap: 5px;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #3b82f6; display: inline-block; box-shadow: 0 0 6px #60a5fa;"></span>
            <span style="color: #ffffff; font-weight: 800;">${label || 'Where To ?'}</span>
          </div>

          <!-- Circular Badge with Uploaded Passenger Icon -->
          <div style="position: relative; width: 44px; height: 44px; border-radius: 50%; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 0 0 2.5px #ffffff; z-index: 20; display: flex; align-items: center; justify-content: center; background: #1d3f84;">
            <img src="/passenger_icon.svg" alt="Passenger GPS" style="width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none;" />
          </div>

          <!-- Ground Contact Needle Tip / Pointer Arrow -->
          <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 9px; height: 9px; background: #1d3f84; border-right: 1.5px solid #ffffff; border-bottom: 1.5px solid #ffffff; z-index: 15;"></div>
        </div>
      `,
      iconSize: [72, 72],
      iconAnchor: [36, 64],
      popupAnchor: [0, -64],
    });

  // Helper to extract clean meaningful place name (hotels, hospitals, markets, societies, institutions) skipping raw plot/house numbers
  const extractCleanPlaceLabel = (raw: string): string => {
    if (!raw) return '';
    const cleaned = raw.replace(/^near\s+/i, '').trim();
    const segments = cleaned.split(',').map((s) => s.trim()).filter(Boolean);
    if (segments.length > 1) {
      const first = segments[0];
      const isHouseOrPlot =
        /^(p\d+|\d+|plot\s*\d+|sco\s*\d+|scf\s*\d+|booth\s*\d+|h\.?no\.?\s*\d+|house\s*no\.?\s*\d+|flat\s*no\.?\s*\d+)/i.test(first) ||
        (first.length <= 4 && !isNaN(Number(first)));
      if (isHouseOrPlot) {
        return segments[1];
      }
      return first;
    }
    return cleaned;
  };

  // Draggable Passenger Icon specifically for setting pickup location in modal map
  const createDraggablePassengerPickupIcon = (pickupLocationName?: string, distanceText?: string) => {
    const rawName = pickupLocationName && pickupLocationName.trim() ? pickupLocationName.trim().replace(/^near\s+/i, '') : '';
    const shortName = extractCleanPlaceLabel(rawName);
    const displayName = shortName ? (shortName.length > 24 ? `${shortName.slice(0, 22)}…` : shortName) : 'Set Pickup';

    return L.divIcon({
      className: 'custom-draggable-passenger-icon marker-pin-a',
      html: `
        <div style="position: relative; width: 84px; height: 90px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: grab; user-select: none; pointer-events: auto;" title="Drag passenger icon to adjust your pickup location">
          <!-- Top Floating Capsule Badge -->
          <div style="position: absolute; bottom: 84px; left: 50%; transform: translateX(-50%); padding: 3px 9px; border-radius: 9999px; background: #020617; color: #38bdf8; font-weight: 900; font-size: 11px; border: 1.5px solid #0284c7; box-shadow: 0 4px 18px rgba(0,0,0,0.8), 0 0 12px rgba(56,189,248,0.4); white-space: nowrap; letter-spacing: 0.3px; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; gap: 5px; z-index: 50; pointer-events: none;">
            <span style="background: #0284c7; color: #ffffff; width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; box-shadow: 0 0 8px rgba(56,189,248,0.7);">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="7" r="4"></circle>
                <path d="M5.5 21a8.38 8.38 0 0 1 13 0"></path>
              </svg>
            </span>
            <span style="color: #ffffff; font-weight: 800; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${displayName}
            </span>
            <span style="background: #0284c7; color: #ffffff; padding: 1px 5px; border-radius: 9999px; font-size: 9px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
              DRAG
            </span>
          </div>

          <!-- Base Ground Radar Glow -->
          <div style="position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); width: 28px; height: 10px; border-radius: 50%; background: rgba(56,189,248,0.35); box-shadow: 0 0 12px rgba(56,189,248,0.8); z-index: 5; pointer-events: none;"></div>

          <!-- Circular Passenger Avatar with Move Badge -->
          <div style="position: relative; width: 50px; height: 50px; border-radius: 50%; overflow: hidden; box-shadow: 0 6px 20px rgba(0,0,0,0.65), 0 0 0 3px #ffffff, 0 0 0 5px #0284c7; z-index: 20; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 35% 30%, #2563eb, #1d3f84); transition: transform 0.15s ease;">
            <img src="/passenger_icon.svg" alt="Passenger Pickup" style="width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none;" />
            <div style="position: absolute; bottom: 0px; right: 0px; background: #0284c7; border: 1.5px solid #ffffff; width: 17px; height: 17px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="5 9 2 12 5 15"></polyline>
                <polyline points="9 5 12 2 15 5"></polyline>
                <polyline points="15 19 12 22 9 19"></polyline>
                <polyline points="19 9 22 12 19 15"></polyline>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <line x1="12" y1="2" x2="12" y2="22"></line>
              </svg>
            </div>
          </div>

          <!-- Ground Contact Needle Tip -->
          <div style="position: relative; margin-top: -3px; width: 10px; height: 10px; background: #0284c7; border-right: 2px solid #ffffff; border-bottom: 2px solid #ffffff; transform: rotate(45deg); z-index: 15; box-shadow: 2px 2px 4px rgba(0,0,0,0.3);"></div>
        </div>
      `,
      iconSize: [84, 90],
      iconAnchor: [42, 88],
      popupAnchor: [0, -88],
    });
  };

  // Custom DivIcons for Location A and Location B
  const createPickupIcon = (pickupLocationName?: string, distanceText?: string, hideLabel: boolean = false) => {
    // Format clean distance badge e.g. "0m" or "2.1 km"
    let formattedDist = distanceText ? distanceText.trim() : '';
    if (formattedDist && !formattedDist.toLowerCase().endsWith('m') && !formattedDist.toLowerCase().endsWith('km')) {
      formattedDist = `${formattedDist} km`;
    }

    const rawName = pickupLocationName && pickupLocationName.trim() ? pickupLocationName.trim().replace(/^near\s+/i, '') : '';
    const isGenericPickup =
      !rawName ||
      rawName.toLowerCase().includes('my live gps') ||
      rawName.toLowerCase().includes('my pickup') ||
      rawName.toLowerCase().includes('standing here') ||
      rawName.toLowerCase().includes('current position') ||
      rawName.toLowerCase().includes('location a');

    const shouldShowLabel = !hideLabel || Boolean(distanceText);
    const shortName = isGenericPickup ? '' : extractCleanPlaceLabel(rawName);
    const displayName = shortName ? (shortName.length > 22 ? `${shortName.slice(0, 20)}…` : shortName) : 'Pickup (A)';

    return L.divIcon({
      className: 'custom-pin-icon marker-pin-a',
      html: `
        <div style="position: relative; width: 32px; height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer; user-select: none; pointer-events: auto;">
          ${shouldShowLabel ? `
            <div style="position: absolute; bottom: 74px; left: 50%; transform: translateX(-50%); padding: 3px 9px; border-radius: 9999px; background: #020617; color: #34d399; font-weight: 900; font-size: 11px; border: 1.5px solid #10b981; box-shadow: 0 4px 16px rgba(0,0,0,0.85); white-space: nowrap; letter-spacing: 0.3px; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; gap: 5px; z-index: 50; pointer-events: none;">
              <span style="display: flex; align-items: center; gap: 4px;">
                <span style="background: #10b981; color: #020617; width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900;">A</span>
                <span style="max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ffffff;">${displayName}</span>
              </span>
              ${formattedDist ? `<span style="background: #10b981; color: #020617; padding: 1px 6px; border-radius: 9999px; font-size: 10px; font-weight: 900; letter-spacing: 0.3px; box-shadow: 0 1px 4px rgba(16,185,129,0.4);">${formattedDist}</span>` : ''}
            </div>
          ` : ''}
          <div style="width: 28px; height: 70px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45)); pointer-events: none;">
            <img src="/marker_green.svg" alt="Pickup A" style="width: 28px; height: 70px; object-fit: contain; pointer-events: none; display: block;" />
          </div>
        </div>
      `,
      iconSize: [32, 72],
      iconAnchor: [16, 70],
      popupAnchor: [0, -70],
    });
  };

  const createDropoffIcon = (destinationName?: string, distanceText?: string) => {
    let formattedDist = distanceText ? distanceText.trim() : '';
    if (formattedDist && !formattedDist.toLowerCase().endsWith('m') && !formattedDist.toLowerCase().endsWith('km')) {
      formattedDist = `${formattedDist} km`;
    }

    const rawName = destinationName && destinationName.trim() ? destinationName.trim().replace(/^near\s+/i, '') : '';
    const shortName = extractCleanPlaceLabel(rawName);
    const displayName = shortName ? (shortName.length > 22 ? `${shortName.slice(0, 20)}…` : shortName) : 'Drop-off (B)';

    return L.divIcon({
      className: 'custom-pin-icon marker-pin-b',
      html: `
        <div style="position: relative; width: 32px; height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer; user-select: none; pointer-events: auto;">
          <div style="position: absolute; bottom: 74px; left: 50%; transform: translateX(-50%); padding: 3px 9px; border-radius: 9999px; background: #020617; color: #fb7185; font-weight: 900; font-size: 11px; border: 1.5px solid #f43f5e; box-shadow: 0 4px 16px rgba(0,0,0,0.85); white-space: nowrap; letter-spacing: 0.3px; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; gap: 5px; z-index: 50; pointer-events: none;">
            <span style="display: flex; align-items: center; gap: 4px;">
              <span style="background: #f43f5e; color: #ffffff; width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900;">B</span>
              <span style="max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ffffff;">${displayName}</span>
            </span>
            ${formattedDist ? `<span style="background: #f43f5e; color: #ffffff; padding: 1px 6px; border-radius: 9999px; font-size: 10px; font-weight: 900; letter-spacing: 0.3px; box-shadow: 0 1px 4px rgba(244,63,94,0.4);">${formattedDist}</span>` : ''}
          </div>
          <div style="width: 28px; height: 70px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45)); pointer-events: none;">
            <img src="/marker_red.svg" alt="Destination B" style="width: 28px; height: 70px; object-fit: contain; pointer-events: none; display: block;" />
          </div>
        </div>
      `,
      iconSize: [32, 72],
      iconAnchor: [16, 70],
      popupAnchor: [0, -70],
    });
  };

  // Draggable Destination / Dropoff Icon specifically for setting destination location in modal map
  const createDraggableDropoffIcon = (destinationName?: string, distanceText?: string) => {
    const rawName = destinationName && destinationName.trim() ? destinationName.trim().replace(/^near\s+/i, '') : '';
    const shortName = extractCleanPlaceLabel(rawName);
    const displayName = shortName ? (shortName.length > 24 ? `${shortName.slice(0, 22)}…` : shortName) : 'Drag Red Flag';

    return L.divIcon({
      className: 'custom-draggable-dropoff-icon marker-pin-b',
      html: `
        <div style="position: relative; width: 84px; height: 90px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: grab; user-select: none; pointer-events: auto;" title="Drag red flag to adjust your drop-off location">
          <!-- Top Floating Capsule Badge with Red Flag -->
          <div style="position: absolute; bottom: 84px; left: 50%; transform: translateX(-50%); padding: 3px 9px; border-radius: 9999px; background: #020617; color: #fca5a5; font-weight: 900; font-size: 11px; border: 1.5px solid #ef4444; box-shadow: 0 4px 18px rgba(0,0,0,0.8), 0 0 12px rgba(239,68,68,0.45); white-space: nowrap; letter-spacing: 0.3px; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; gap: 5px; z-index: 50; pointer-events: none;">
            <span style="font-size: 13px; line-height: 1; filter: drop-shadow(0 0 4px rgba(239,68,68,0.6));">
              🚩
            </span>
            <span style="color: #ffffff; font-weight: 800; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${displayName}
            </span>
            <span style="background: #ef4444; color: #ffffff; padding: 1px 5px; border-radius: 9999px; font-size: 9px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
              DRAG
            </span>
          </div>

          <!-- Base Ground Radar Glow in Crimson Red -->
          <div style="position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); width: 28px; height: 10px; border-radius: 50%; background: rgba(239,68,68,0.4); box-shadow: 0 0 14px rgba(239,68,68,0.85); z-index: 5; pointer-events: none;"></div>

          <!-- Circular Badge with Prominent Red Flag Vector Icon & Move Handle -->
          <div style="position: relative; width: 50px; height: 50px; border-radius: 50%; overflow: hidden; box-shadow: 0 6px 20px rgba(0,0,0,0.7), 0 0 0 3px #ffffff, 0 0 0 5px #ef4444; z-index: 20; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 35% 30%, #ef4444, #991b1b); transition: transform 0.15s ease;">
            <!-- Bold Red Flag Vector Graphic -->
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
              <!-- Flagpole -->
              <path d="M5 21V3" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" />
              <!-- Golden Finial Ball -->
              <circle cx="5" cy="2.5" r="1.6" fill="#fef08a" stroke="#ffffff" stroke-width="0.7" />
              <!-- Waving Red Flag Fabric -->
              <path d="M5 3.5H19C17.2 6.5 19.5 8.5 18 11.5H5V3.5Z" fill="#ffffff" stroke="#ffffff" stroke-width="0.8" />
              <path d="M5.8 4.4H17.8C16.3 7 18.2 8.3 16.9 10.6H5.8V4.4Z" fill="#dc2626" />
            </svg>

            <!-- Small 4-way drag handle badge in corner -->
            <div style="position: absolute; bottom: 0px; right: 0px; background: #ef4444; border: 1.5px solid #ffffff; width: 17px; height: 17px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="5 9 2 12 5 15"></polyline>
                <polyline points="9 5 12 2 15 5"></polyline>
                <polyline points="15 19 12 22 9 19"></polyline>
                <polyline points="19 9 22 12 19 15"></polyline>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <line x1="12" y1="2" x2="12" y2="22"></line>
              </svg>
            </div>
          </div>

          <!-- Ground Contact Needle Tip -->
          <div style="position: relative; margin-top: -3px; width: 10px; height: 10px; background: #ef4444; border-right: 2px solid #ffffff; border-bottom: 2px solid #ffffff; transform: rotate(45deg); z-index: 15; box-shadow: 2px 2px 4px rgba(0,0,0,0.3);"></div>
        </div>
      `,
      iconSize: [84, 90],
      iconAnchor: [42, 88],
      popupAnchor: [0, -88],
    });
  };

  const createCaptainIcon = (
    heading: number = 0,
    name: string = 'You • Captain',
    accuracy?: number | null,
    isSelf: boolean = true,
    isNearest: boolean = false,
    etaMinutes?: number,
    distanceKm?: number,
    activeStatus?: string | null
  ) => {
    const isArrivingPickup = activeStatus === 'captain_accepted';
    const isArrivedPickup = activeStatus === 'captain_arrived';
    const isGoingDropoff = activeStatus === 'trip_started';
    const isTripDone = activeStatus === 'trip_completed';

    const distText = distanceKm != null ? (distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`) : '';

    let borderColor = isCaptainMode ? '#0f172a' : isNearest ? '#10b981' : isSelf ? '#0f172a' : '#38bdf8';
    let glowShadow = isCaptainMode ? '0 4px 14px rgba(0, 0, 0, 0.4)' : isNearest ? '0 4px 16px rgba(16, 185, 129, 0.5)' : '0 4px 14px rgba(0, 0, 0, 0.4)';
    let statusPillHtml = '';

    if (isCaptainMode) {
      statusPillHtml = '';
    } else if (isArrivingPickup) {
      borderColor = '#10b981';
      glowShadow = '0 4px 18px rgba(16, 185, 129, 0.6)';
      // Do not show text on map in passenger dashboard Captain arriving to A
      statusPillHtml = '';
    } else if (isArrivedPickup) {
      borderColor = '#10b981';
      glowShadow = '0 4px 18px rgba(16, 185, 129, 0.6)';
      statusPillHtml = '';
    } else if (isGoingDropoff) {
      borderColor = '#38bdf8';
      glowShadow = '0 4px 18px rgba(56, 189, 248, 0.6)';
      // When "trip in progress" (trip_started) in passenger dashboard, hide "on trip to dropoff B 17km" text
      statusPillHtml = '';
    } else if (isTripDone) {
      borderColor = '#10b981';
      statusPillHtml = `
        <div style="display: flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 9999px; background: #020617; border: 2px solid #10b981; box-shadow: 0 8px 24px rgba(0,0,0,0.85); color: #ffffff; font-size: 11px; font-weight: 800; font-family: system-ui, -apple-system, sans-serif;">
          <span>🏁 Trip Completed at (B)</span>
        </div>
      `;
    } else {
      // Hide the text "nearest captain available" and captain available pill in passenger dashboard
      statusPillHtml = '';
    }

    const boxWidth = isArrivingPickup ? 200 : 210;

    return L.divIcon({
      className: isNearest ? 'nearest-captain-icon' : 'captain-car-icon',
      html: `
        <div style="position: relative; width: ${boxWidth}px; height: 106px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; user-select: none; pointer-events: auto; cursor: pointer;">
          <!-- Top Floating Pill Label with Highest Z-Index -->
          <div style="position: absolute; top: 0px; left: 50%; transform: translateX(-50%); white-space: nowrap; z-index: 50; pointer-events: auto;">
            ${statusPillHtml}
          </div>

          <!-- Rotating Navigation Arrowhead Marker (Uploaded Navigation Icon) -->
          <div style="position: relative; width: 48px; height: 48px; margin-bottom: 6px; transform: rotate(${heading}deg); transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); display: flex; align-items: center; justify-content: center; z-index: 20;">
            <!-- Heading notch pointer -->
            <div style="position: absolute; top: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-bottom: 10px solid ${borderColor}; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6)); z-index: 10;"></div>
            <!-- Circle core with Navigation Arrowhead -->
            <div style="width: 46px; height: 46px; border-radius: 50%; background: #ffffff; border: 3.5px solid ${borderColor}; display: flex; align-items: center; justify-content: center; box-shadow: ${glowShadow}, 0 0 0 2px rgba(0,0,0,0.7); overflow: hidden;">
              <svg viewBox="0 0 100 100" width="36" height="36" style="display: block;">
                <!-- Outer Black Ring -->
                <circle cx="50" cy="50" r="41" fill="#ffffff" stroke="#000000" stroke-width="11"/>
                <!-- Inner Navigation Arrowhead -->
                <path d="M 50,18 L 76,74 L 50,60 L 24,74 Z" fill="#000000" stroke="#000000" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
              </svg>
            </div>
          </div>
        </div>
      `,
      iconSize: [boxWidth, 106],
      iconAnchor: [boxWidth / 2, 80],
      popupAnchor: [0, -80],
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = isCaptainMode
      ? (captainLat || 30.704649)
      : (passengerLat || pickupLat || 30.704649);
    const initialLng = isCaptainMode
      ? (captainLng || 76.717873)
      : (passengerLng || pickupLng || 76.717873);

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      tapHold: false,
      trackResize: true,
      inertia: true,
      inertiaDeceleration: 2500,
      inertiaMaxSpeed: Infinity,
      easeLinearity: 0.2,
      worldCopyJump: false,
      bounceAtZoomLimits: false,
      maxBoundsViscosity: 0.0,
    });

    const initialConfig = MAP_LAYERS[activeLayer];
    const tiles = L.tileLayer(initialConfig.url, {
      maxZoom: initialConfig.maxZoom,
      subdomains: initialConfig.subdomains,
    }).addTo(map);
    tileLayerRef.current = tiles;

    if (interactive && onMapClick) {
      map.on('click', (e) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    // Stop following when user manually drags map
    map.on('dragstart', () => {
      setIsFollowingPassenger(false);
      setIsFollowingCaptain(false);
    });

    map.on('movestart', () => {
      if (onMapMoveStart) {
        onMapMoveStart();
      }
    });

    map.on('moveend', () => {
      if (interactive && onMapMoveEnd) {
        const center = map.getCenter();
        onMapMoveEnd(center.lat, center.lng);
      }
    });

    mapInstanceRef.current = map;
    setMapReady(true);

    // Trigger invalidateSize after initial layout render
    const timer1 = setTimeout(() => map.invalidateSize(), 150);
    const timer2 = setTimeout(() => map.invalidateSize(), 500);

    // Watch for size changes
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      try {
        map.remove();
      } catch (err) {
        console.warn('Leaflet cleanup warning:', err);
      }
      mapInstanceRef.current = null;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      passengerMarkerRef.current = null;
      passengerAccuracyCircleRef.current = null;
      passengerToPickupLineRef.current = null;
      captainMarkerRef.current = null;
      polylineRef.current = null;
      polylineGlowRef.current = null;
      lastFittedRouteKeyRef.current = '';
      setMapReady(false);
    };
  }, []);

  // Update Tile Layer when activeLayer changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const config = MAP_LAYERS[activeLayer];
    const newTiles = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      subdomains: config.subdomains,
    }).addTo(map);

    tileLayerRef.current = newTiles;
  }, [activeLayer]);

  // Update Markers, Passenger GPS, and Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds: L.LatLngExpression[] = [];

    const hasPickup = Boolean(pickupLat && pickupLng && pickupLat !== 0 && pickupLng !== 0);
    const hasDropoff = Boolean(dropoffLat && dropoffLng && dropoffLat !== 0 && dropoffLng !== 0);

    let displayDropoffLat = dropoffLat;
    let displayDropoffLng = dropoffLng;

    // Calculate walking distance between passenger standing location and pickup location A
    let distToPickupMeters: number | null = null;
    if (passengerLat && passengerLng && hasPickup && pickupLat && pickupLng) {
      const dLat = ((pickupLat - passengerLat) * Math.PI) / 180;
      const dLon = ((pickupLng - passengerLng) * Math.PI) / 180;
      const aVal =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((passengerLat * Math.PI) / 180) *
          Math.cos((pickupLat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      distToPickupMeters = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal)));
    }

    // Check if ride is currently active / booked
    const isRideBooked = Boolean(activeRideStatus);

    // Check if pickup is currently set to the passenger's exact position
    const isPickupAtPassenger = Boolean(
      hasPickup &&
      pickupLat &&
      pickupLng &&
      passengerLat &&
      passengerLng &&
      (distToPickupMeters !== null ? distToPickupMeters < 12 : false)
    );

    // Active pick and drop route search mode
    const isPickAndDropActive = Boolean(
      hasPickup &&
      hasDropoff &&
      pickupLat &&
      pickupLng &&
      dropoffLat &&
      dropoffLng
    );

    // 1. Passenger GPS Live Location Marker (Displayed only in passenger mode when no active ride is in progress)
    const isRideActiveNow = Boolean(
      activeRideStatus &&
      ['searching', 'captain_accepted', 'captain_arrived', 'trip_started', 'trip_completed'].includes(activeRideStatus)
    );
    const shouldShowPassengerGps = !isCaptainMode && !isRideActiveNow && !isRideBooked && Boolean(passengerLat && passengerLng);
    if (shouldShowPassengerGps && !hidePassengerIcon && passengerLat && passengerLng) {
      if (!isPickAndDropActive) {
        bounds.push([passengerLat, passengerLng]);
      }
      const labelText = 'Where To ?';
      const pIcon = createPassengerIcon(labelText, isPickupAtPassenger);

      const passengerPopupHtml = `
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 170px; color: #000000; padding: 2px;">
          <div style="font-weight: 900; color: #1d3f84; display: flex; align-items: center; gap: 6px; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
            <span>📍 Where To ?</span>
          </div>
          <div style="color: #0f172a; font-size: 11.5px; font-weight: 600;">
            ${passengerName || 'Passenger (Standing Here)'}
          </div>
          <div style="color: #2563eb; font-size: 11px; margin-top: 4px; font-weight: 700;">
            Click to set Pickup Location (A)
          </div>
        </div>
      `;

      if (!passengerMarkerRef.current || !map.hasLayer(passengerMarkerRef.current)) {
        if (passengerMarkerRef.current) {
          try {
            map.removeLayer(passengerMarkerRef.current);
          } catch {}
        }
        passengerMarkerRef.current = L.marker([passengerLat, passengerLng], {
          icon: pIcon,
          zIndexOffset: 1500,
        })
          .addTo(map)
          .bindPopup(passengerPopupHtml);
      } else {
        passengerMarkerRef.current.setLatLng([passengerLat, passengerLng]);
        passengerMarkerRef.current.setIcon(pIcon);
        passengerMarkerRef.current.setZIndexOffset(1500);
        passengerMarkerRef.current.setPopupContent(passengerPopupHtml);
      }

      // On click text "Where To ?" or passenger marker: Auto set Passenger Pickup Location A on booking form
      passengerMarkerRef.current.off('click');
      passengerMarkerRef.current.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (onSetPickupToPassengerLocation && passengerLat && passengerLng) {
          onSetPickupToPassengerLocation(passengerLat, passengerLng);
        }
      });

      // Clean up any previous accuracy circle
      if (passengerAccuracyCircleRef.current) {
        try {
          map.removeLayer(passengerAccuracyCircleRef.current);
          passengerAccuracyCircleRef.current = null;
        } catch {}
      }

      // Center map initially once on passenger location without vibrating camera animation
      if (!hasInitiallyCenteredPassengerRef.current) {
        hasInitiallyCenteredPassengerRef.current = true;
        map.setView([passengerLat, passengerLng], 16, {
          animate: false,
        });
      }
    } else {
      if (passengerMarkerRef.current) {
        map.removeLayer(passengerMarkerRef.current);
        passengerMarkerRef.current = null;
      }
      if (passengerAccuracyCircleRef.current) {
        map.removeLayer(passengerAccuracyCircleRef.current);
        passengerAccuracyCircleRef.current = null;
      }
    }

    // 2. Pickup Marker A (Rendered with the uploaded green pearl pushpin marker)
    const isPickupOverPassenger = Boolean(
      shouldShowPassengerGps && (isPickupAtPassenger || (distToPickupMeters !== null && distToPickupMeters < 30))
    );
    const shouldRenderPickupPin = Boolean(hasPickup && pickupLat && pickupLng && !isPickupOverPassenger);
    if (shouldRenderPickupPin && pickupLat && pickupLng) {
      bounds.push([pickupLat, pickupLng]);
      // Hide text "Pickup A" showing near "Where To ?"
      const isNearWhereTo = Boolean(
        isPickupAtPassenger ||
        (distToPickupMeters !== null && distToPickupMeters < 80)
      );
      const isPassengerPickupIcon = pickupMarkerType === 'passenger';
      const aIcon = isPassengerPickupIcon
        ? createDraggablePassengerPickupIcon(pickupAddress || undefined, pickupDistanceText)
        : createPickupIcon(pickupAddress || undefined, pickupDistanceText, isNearWhereTo);

      const pickupPopupHtml = isPassengerPickupIcon
        ? `
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 190px; color: #000000; padding: 2px;">
          <div style="font-weight: 900; color: #0284c7; display: flex; align-items: center; gap: 6px; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
            <img src="/passenger_icon.svg" alt="Pickup" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover; vertical-align: middle;" />
            <span>Passenger Pickup Location</span>
          </div>
          <div style="color: #0f172a; font-size: 12px; font-weight: 700;">
            ${pickupAddress || 'Selected Pickup Point'}
          </div>
          <div style="color: #0284c7; font-size: 11px; margin-top: 4px; font-weight: 700;">
            🖐️ Drag icon to adjust exact pickup spot
          </div>
        </div>
      `
        : `
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 180px; color: #000000; padding: 2px;">
          <div style="font-weight: 900; color: #059669; display: flex; align-items: center; gap: 6px; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
            <img src="/marker_green.svg" alt="A" style="width: 12px; height: 26px; object-fit: contain; vertical-align: middle;" />
            <span>Pickup (A)${pickupDistanceText ? ` • ${pickupDistanceText}` : ''}</span>
          </div>
          <div style="color: #0f172a; font-size: 12px; font-weight: 700;">
            ${pickupAddress || 'Selected Pickup Point'}
          </div>
          ${distToPickupMeters !== null && distToPickupMeters > 5 ? `<div style="color: #64748b; font-size: 11px; margin-top: 4px; font-weight: 500;">Passenger standing <b>${distToPickupMeters}m</b> away</div>` : ''}
        </div>
      `;

      const isDraggablePin = Boolean(interactive && (onMapClick || onPickupDragEnd));

      if (!pickupMarkerRef.current || !map.hasLayer(pickupMarkerRef.current)) {
        if (pickupMarkerRef.current) {
          try {
            map.removeLayer(pickupMarkerRef.current);
          } catch {}
        }
        pickupMarkerRef.current = L.marker([pickupLat, pickupLng], {
          icon: aIcon,
          zIndexOffset: isPassengerPickupIcon ? 3500 : 2000,
          draggable: isDraggablePin,
        })
          .addTo(map)
          .bindPopup(pickupPopupHtml);
        pickupMarkerRef.current.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (isPassengerPickupIcon && onSetPickupToPassengerLocation && pickupLat && pickupLng) {
            onSetPickupToPassengerLocation(pickupLat, pickupLng);
          }
        });
        pickupMarkerRef.current.on('dragend', (e: any) => {
          const latlng = e.target.getLatLng();
          if (onPickupDragEnd) {
            onPickupDragEnd(latlng.lat, latlng.lng);
          }
        });
      } else {
        pickupMarkerRef.current.setLatLng([pickupLat, pickupLng]);
        pickupMarkerRef.current.setIcon(aIcon);
        pickupMarkerRef.current.setPopupContent(pickupPopupHtml);
        pickupMarkerRef.current.off('click');
        pickupMarkerRef.current.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (isPassengerPickupIcon && onSetPickupToPassengerLocation && pickupLat && pickupLng) {
            onSetPickupToPassengerLocation(pickupLat, pickupLng);
          }
        });
        pickupMarkerRef.current.setZIndexOffset(isPassengerPickupIcon ? 3500 : 2000);
        if (pickupMarkerRef.current.dragging) {
          if (isDraggablePin) pickupMarkerRef.current.dragging.enable();
          else pickupMarkerRef.current.dragging.disable();
        }
        pickupMarkerRef.current.off('dragend');
        pickupMarkerRef.current.on('dragend', (e: any) => {
          const latlng = e.target.getLatLng();
          if (onPickupDragEnd) {
            onPickupDragEnd(latlng.lat, latlng.lng);
          }
        });
      }
    } else if (pickupMarkerRef.current) {
      try {
        map.removeLayer(pickupMarkerRef.current);
      } catch {}
      pickupMarkerRef.current = null;
    }

    // Walking guide dashed line connecting Passenger Standing Location to Pickup Location A (only before pick and drop search when standing separately)
    if (!isPickAndDropActive && !isRideBooked && hasPickup && !isPickupAtPassenger && distToPickupMeters !== null && distToPickupMeters >= 4 && distToPickupMeters <= 1500 && passengerLat && passengerLng && pickupLat && pickupLng) {
      if (!passengerToPickupLineRef.current || !map.hasLayer(passengerToPickupLineRef.current)) {
        if (passengerToPickupLineRef.current) {
          try {
            map.removeLayer(passengerToPickupLineRef.current);
          } catch {}
        }
        passengerToPickupLineRef.current = L.polyline([[passengerLat, passengerLng], [pickupLat, pickupLng]], {
          color: '#000000',
          weight: 2.5,
          dashArray: '4, 8',
          opacity: 0.75,
        }).addTo(map);
      } else {
        passengerToPickupLineRef.current.setLatLngs([[passengerLat, passengerLng], [pickupLat, pickupLng]]);
      }
    } else if (passengerToPickupLineRef.current) {
      map.removeLayer(passengerToPickupLineRef.current);
      passengerToPickupLineRef.current = null;
    }

    // 3. Dropoff Marker (Location B - Destination)
    if (hasDropoff && displayDropoffLat && displayDropoffLng) {
      bounds.push([displayDropoffLat, displayDropoffLng]);
      const isDestinationDropoffIcon = dropoffMarkerType === 'destination';
      const bIcon = isDestinationDropoffIcon
        ? createDraggableDropoffIcon(dropoffAddress || undefined, dropoffDistanceText)
        : createDropoffIcon(dropoffAddress || undefined, dropoffDistanceText);

      const dropoffPopupHtml = isDestinationDropoffIcon
        ? `
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 190px; color: #000000; padding: 2px;">
          <div style="font-weight: 900; color: #ef4444; display: flex; align-items: center; gap: 6px; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
            <span style="font-size: 15px;">🚩</span>
            <span>Drop-off Destination</span>
          </div>
          <div style="color: #0f172a; font-size: 12px; font-weight: 700;">
            ${dropoffAddress || 'Selected Destination'}
          </div>
          <div style="color: #ef4444; font-size: 11px; margin-top: 4px; font-weight: 700;">
            🖐️ Drag red flag to adjust exact drop-off spot
          </div>
        </div>
      `
        : `
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 180px; color: #000000; padding: 2px;">
          <div style="font-weight: 900; color: #e11d48; display: flex; align-items: center; gap: 6px; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
            <img src="/marker_red.svg" alt="B" style="width: 12px; height: 26px; object-fit: contain; vertical-align: middle;" />
            <span>Drop-off (B)${dropoffDistanceText ? ` • ${dropoffDistanceText}` : ''}</span>
          </div>
          <div style="color: #0f172a; font-size: 12px; font-weight: 700;">
            ${dropoffAddress || 'Selected Destination'}
          </div>
          ${rideDistanceText ? `<div style="color: #64748b; font-size: 11px; margin-top: 4px; font-weight: 500;">Trip distance: <b>${rideDistanceText}</b></div>` : ''}
        </div>
      `;

      const isDraggableDropoff = Boolean(interactive && (onMapClick || onDropoffDragEnd));

      if (!dropoffMarkerRef.current || !map.hasLayer(dropoffMarkerRef.current)) {
        if (dropoffMarkerRef.current) {
          try {
            map.removeLayer(dropoffMarkerRef.current);
          } catch {}
        }
        dropoffMarkerRef.current = L.marker([displayDropoffLat, displayDropoffLng], {
          icon: bIcon,
          zIndexOffset: isDestinationDropoffIcon ? 3500 : 2500,
          draggable: isDraggableDropoff,
        })
          .addTo(map)
          .bindPopup(dropoffPopupHtml);
        dropoffMarkerRef.current.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
        });
        dropoffMarkerRef.current.on('dragend', (e: any) => {
          const latlng = e.target.getLatLng();
          if (onDropoffDragEnd) {
            onDropoffDragEnd(latlng.lat, latlng.lng);
          }
        });
      } else {
        dropoffMarkerRef.current.setLatLng([displayDropoffLat, displayDropoffLng]);
        dropoffMarkerRef.current.setIcon(bIcon);
        dropoffMarkerRef.current.setZIndexOffset(isDestinationDropoffIcon ? 3500 : 2500);
        dropoffMarkerRef.current.setPopupContent(dropoffPopupHtml);
        if (dropoffMarkerRef.current.dragging) {
          if (isDraggableDropoff) dropoffMarkerRef.current.dragging.enable();
          else dropoffMarkerRef.current.dragging.disable();
        }
        dropoffMarkerRef.current.off('dragend');
        dropoffMarkerRef.current.on('dragend', (e: any) => {
          const latlng = e.target.getLatLng();
          if (onDropoffDragEnd) {
            onDropoffDragEnd(latlng.lat, latlng.lng);
          }
        });
      }
    } else if (dropoffMarkerRef.current) {
      map.removeLayer(dropoffMarkerRef.current);
      dropoffMarkerRef.current = null;
    }

    // 4. Captain Marker (Only shown if showPassengerOnly is false and coordinates provided)
    if (!showPassengerOnly && captainLat && captainLng) {
      if (!showLocationsABOnly) {
        bounds.push([captainLat, captainLng]);
      }

      let activeDistKm: number | undefined = undefined;
      if (activeRideStatus === 'captain_accepted' && pickupLat && pickupLng) {
        activeDistKm = calculateHaversineDistanceKm(captainLat, captainLng, pickupLat, pickupLng);
      } else if (activeRideStatus === 'trip_started' && dropoffLat && dropoffLng) {
        activeDistKm = calculateHaversineDistanceKm(captainLat, captainLng, dropoffLat, dropoffLng);
      }

      const cIcon = createCaptainIcon(
        captainHeading,
        captainName || (isCaptainMode ? 'You (Captain)' : 'Captain'),
        captainAccuracy,
        isCaptainMode,
        false,
        undefined,
        activeDistKm,
        activeRideStatus
      );

      if (!captainMarkerRef.current || !map.hasLayer(captainMarkerRef.current)) {
        if (captainMarkerRef.current) {
          try {
            map.removeLayer(captainMarkerRef.current);
          } catch {}
        }
        captainMarkerRef.current = L.marker([captainLat, captainLng], {
          icon: cIcon,
          zIndexOffset: 1400,
        })
          .addTo(map)
          .bindPopup(`
            <div style="padding: 4px; font-size: 12px; color: #0f172a; font-weight: 600;">
              <div style="font-weight: 800; font-size: 13px; color: #d97706;">🏍️ ${captainName || 'Captain Live Location'}</div>
              <div>Status: <b>${activeRideStatus === 'captain_accepted' ? 'Arriving to Pickup (A)' : activeRideStatus === 'trip_started' ? 'Going to Dropoff (B)' : 'Online & Live Tracking'}</b></div>
              ${activeDistKm != null ? `<div>Remaining: <b>${activeDistKm < 1 ? `${Math.round(activeDistKm * 1000)}m` : `${activeDistKm.toFixed(1)}km`}</b></div>` : ''}
              ${captainAccuracy ? `<div>GPS Accuracy: ±${Math.round(captainAccuracy)}m</div>` : ''}
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">GPS: ${captainLat.toFixed(5)}, ${captainLng.toFixed(5)}</div>
            </div>
          `);
      } else {
        captainMarkerRef.current.setLatLng([captainLat, captainLng]);
        captainMarkerRef.current.setIcon(cIcon);
      }

      // Accuracy circle around captain live position (disabled in captain mode)
      if (isCaptainMode) {
        if (captainAccuracyCircleRef.current) {
          try {
            map.removeLayer(captainAccuracyCircleRef.current);
            captainAccuracyCircleRef.current = null;
          } catch {}
        }
      } else {
        const capRadius = Math.max(12, Math.min(captainAccuracy || 20, 80));
        if (!captainAccuracyCircleRef.current || !map.hasLayer(captainAccuracyCircleRef.current)) {
          if (captainAccuracyCircleRef.current) {
            try {
              map.removeLayer(captainAccuracyCircleRef.current);
            } catch {}
          }
          captainAccuracyCircleRef.current = L.circle([captainLat, captainLng], {
            radius: capRadius,
            color: activeRideStatus === 'trip_started' ? '#0284c7' : '#0f172a',
            fillColor: activeRideStatus === 'trip_started' ? '#38bdf8' : '#0f172a',
            fillOpacity: 0.08,
            weight: 1.5,
            dashArray: '4, 4',
          }).addTo(map);
        } else {
          captainAccuracyCircleRef.current.setLatLng([captainLat, captainLng]);
          captainAccuracyCircleRef.current.setRadius(capRadius);
        }
      }
    } else {
      if (captainMarkerRef.current) {
        map.removeLayer(captainMarkerRef.current);
        captainMarkerRef.current = null;
      }
      if (captainAccuracyCircleRef.current) {
        map.removeLayer(captainAccuracyCircleRef.current);
        captainAccuracyCircleRef.current = null;
      }
    }

    // 4c. Active Ride Guidance Line:
    // (Removed previous animated/dashed polyline style in passenger app to show only simple dark blue route between mark A and B)
    if (captainToTargetLineRef.current) {
      try {
        map.removeLayer(captainToTargetLineRef.current);
      } catch {}
      captainToTargetLineRef.current = null;
    }

    // 4b. Nearby Available Captains (Always displayed on passenger map with nearest captain icon)
    if (!isCaptainMode && nearbyCaptains && nearbyCaptains.length > 0) {
      const activeIds = new Set(nearbyCaptains.map((c) => c.id));
      nearbyCaptainMarkersRef.current.forEach((marker, id) => {
        if (!activeIds.has(id)) {
          try {
            map.removeLayer(marker);
          } catch {}
          nearbyCaptainMarkersRef.current.delete(id);
        }
      });

      nearbyCaptains.forEach((cpt) => {
        // Skip if active single captain marker already placed at identical spot
        if (captainLat && captainLng && Math.abs(cpt.lat - captainLat) < 0.0001 && Math.abs(cpt.lng - captainLng) < 0.0001) {
          return;
        }

        const isNearest = Boolean(cpt.isNearest || (nearestCaptain && nearestCaptain.id === cpt.id));
        const cIcon = createCaptainIcon(
          cpt.heading || 0,
          cpt.name,
          null,
          false,
          isNearest,
          cpt.etaMinutes,
          cpt.distanceKm
        );

        let marker = nearbyCaptainMarkersRef.current.get(cpt.id);
        if (!marker || !map.hasLayer(marker)) {
          if (marker) {
            try {
              map.removeLayer(marker);
            } catch {}
          }
          marker = L.marker([cpt.lat, cpt.lng], {
            icon: cIcon,
            zIndexOffset: isNearest ? 4200 : 3600,
          }).addTo(map);

          nearbyCaptainMarkersRef.current.set(cpt.id, marker);
        } else {
          marker.setLatLng([cpt.lat, cpt.lng]);
          marker.setIcon(cIcon);
          marker.setZIndexOffset(isNearest ? 4200 : 3600);
        }

        const distLabel = cpt.distanceKm != null ? (cpt.distanceKm < 1 ? `${Math.round(cpt.distanceKm * 1000)}m` : `${cpt.distanceKm.toFixed(1)} km`) : 'Nearby';

        marker.bindPopup(`
          <div style="padding: 6px 8px; font-size: 12px; color: #0f172a; min-width: 185px; font-family: system-ui, -apple-system, sans-serif;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 800; font-size: 12px; color: ${isNearest ? '#059669' : '#d97706'};">
                ${isNearest ? '⭐ Nearest Available Captain' : '🏍️ Available Captain'}
              </span>
              <span style="background: #ecfdf5; color: #065f46; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 9999px;">ONLINE</span>
            </div>
            <div style="font-weight: 800; font-size: 13px; color: #0f172a;">${cpt.name}</div>
            <div style="color: #64748b; font-size: 11px; margin-top: 2px;">
              ${cpt.vehicleModel || 'Motoride Bike'} ${cpt.vehiclePlate ? `• <b>${cpt.vehiclePlate}</b>` : ''}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px; padding-top: 5px; border-top: 1px solid #e2e8f0; font-size: 11px;">
              <span style="color: #d97706; font-weight: 800;">★ ${cpt.rating ? cpt.rating.toFixed(1) : '4.9'}</span>
              <span style="color: #0f172a; font-weight: 700;">${distLabel} ${cpt.etaMinutes ? `(~${cpt.etaMinutes} min)` : ''}</span>
            </div>
          </div>
        `);

        if (onSelectCaptain) {
          marker.on('click', () => onSelectCaptain(cpt));
        }
      });
    } else if (nearbyCaptainMarkersRef.current.size > 0) {
      nearbyCaptainMarkersRef.current.forEach((marker) => {
        try {
          map.removeLayer(marker);
        } catch {}
      });
      nearbyCaptainMarkersRef.current.clear();
    }

    // 5. Simple Dark Blue Polyline Route (Connecting from pickup Location A to drop-off Location B)
    if (hasPickup && hasDropoff && pickupLat && pickupLng && displayDropoffLat && displayDropoffLng) {
      const latlngs: [number, number][] = [
        [pickupLat, pickupLng],
        [displayDropoffLat, displayDropoffLng],
      ];

      // Remove any previous glow / casing polyline
      if (polylineGlowRef.current) {
        try {
          map.removeLayer(polylineGlowRef.current);
        } catch {}
        polylineGlowRef.current = null;
      }

      // Draw simple dark blue polyline between Location A and B
      const routePolylineColor = '#002060'; // Simple Dark Blue

      if (!polylineRef.current || !map.hasLayer(polylineRef.current)) {
        if (polylineRef.current) {
          try {
            map.removeLayer(polylineRef.current);
          } catch {}
        }
        polylineRef.current = L.polyline(latlngs, {
          color: routePolylineColor,
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs(latlngs);
        polylineRef.current.setStyle({
          color: routePolylineColor,
          weight: 5,
          opacity: 0.95,
          dashArray: undefined,
          className: '',
        });
      }

      // Ensure no distance tooltip/tab is attached to the route polyline on map
      polylineRef.current.unbindTooltip();

      if (routeDistanceMarkerRef.current) {
        map.removeLayer(routeDistanceMarkerRef.current);
        routeDistanceMarkerRef.current = null;
      }
    } else {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
      if (polylineGlowRef.current) {
        map.removeLayer(polylineGlowRef.current);
        polylineGlowRef.current = null;
      }
      if (routeDistanceMarkerRef.current) {
        map.removeLayer(routeDistanceMarkerRef.current);
        routeDistanceMarkerRef.current = null;
      }
    }

    // Auto-fit bounds or center on position (Skip if focusCoords is explicitly provided)
    if (focusCoords && focusCoords.lat && focusCoords.lng) {
      return;
    }

    // ─── STABLE PASSENGER LOCATION LOCK DURING BOOKING SELECTION ───
    // If neither pickup nor drop-off are selected in the booking form yet, keep the map focused on passenger live location
    if (!isCaptainMode && !activeRideStatus && !hasPickup && !hasDropoff && passengerLat && passengerLng) {
      const currentRouteKey = `stable_passenger_${passengerLat.toFixed(4)}_${passengerLng.toFixed(4)}_${bottomSheetPadding}`;
      if (lastFittedRouteKeyRef.current !== currentRouteKey) {
        lastFittedRouteKeyRef.current = currentRouteKey;
        map.invalidateSize();
        const pad = bottomSheetPadding || 180;
        map.fitBounds(L.latLngBounds([[passengerLat, passengerLng], [passengerLat, passengerLng]]), {
          paddingBottomRight: [40, pad],
          paddingTopLeft: [70, 40],
          maxZoom: 16,
          animate: true,
        });
      }
      return;
    }

    if (showLocationsABOnly && hasPickup && hasDropoff && pickupLat && pickupLng && dropoffLat && dropoffLng) {
      const abBounds = L.latLngBounds([
        [pickupLat, pickupLng],
        [dropoffLat, dropoffLng],
      ]);
      map.invalidateSize();
      const bottomPad = bottomSheetPadding || 340;
      map.fitBounds(abBounds, {
        paddingTopLeft: [70, 40],
        paddingBottomRight: [40, bottomPad],
        maxZoom: 16,
        animate: true,
      });
    } else if (isCaptainMode && captainLat && captainLng) {
      if (!hasPickup && !hasDropoff) {
        // Standby/Browsing mode: focus on captain live GPS
        if (!hasInitiallyCenteredCaptainRef.current) {
          hasInitiallyCenteredCaptainRef.current = true;
          map.setView([captainLat, captainLng], 16, { animate: false });
        } else if (isFollowingCaptain) {
          map.panTo([captainLat, captainLng], { animate: true, duration: 0.4 });
        }
      } else {
        // Active ride or inspecting route in captain mode: fit route bounds to show Location A and B clearly
        if (hasPickup && hasDropoff && pickupLat && pickupLng && dropoffLat && dropoffLng) {
          const currentRouteKey = `captain_route_${pickupLat.toFixed(4)}_${pickupLng.toFixed(4)}_${dropoffLat.toFixed(4)}_${dropoffLng.toFixed(4)}_${bottomSheetPadding}`;
          if (lastFittedRouteKeyRef.current !== currentRouteKey) {
            lastFittedRouteKeyRef.current = currentRouteKey;
            const routeBounds = L.latLngBounds([
              [pickupLat, pickupLng],
              [dropoffLat, dropoffLng],
            ]);
            map.invalidateSize();
            const bottomPad = bottomSheetPadding !== undefined ? bottomSheetPadding : 30;
            map.fitBounds(routeBounds, {
              paddingTopLeft: [28, 36],
              paddingBottomRight: [52, Math.max(20, bottomPad)],
              maxZoom: 16,
              animate: false,
            });
          }
        } else if (bounds.length > 1) {
          map.invalidateSize();
          const bottomPad = bottomSheetPadding || 60;
          map.fitBounds(L.latLngBounds(bounds), {
            paddingTopLeft: [60, 40],
            paddingBottomRight: [40, bottomPad],
            maxZoom: 16,
            animate: false,
          });
        } else if (isFollowingCaptain) {
          map.panTo([captainLat, captainLng], { animate: true, duration: 0.4 });
        }
      }
    } else if (hasPickup && hasDropoff && pickupLat && pickupLng && dropoffLat && dropoffLng) {
      const currentRouteKey = `${pickupLat.toFixed(4)}_${pickupLng.toFixed(4)}_${dropoffLat.toFixed(4)}_${dropoffLng.toFixed(4)}_${activeRideStatus || ''}_${bottomSheetPadding}`;
      if (lastFittedRouteKeyRef.current !== currentRouteKey) {
        lastFittedRouteKeyRef.current = currentRouteKey;
        const routeBounds = L.latLngBounds([
          [pickupLat, pickupLng],
          [dropoffLat, dropoffLng],
        ]);
        if (captainLat && captainLng) {
          routeBounds.extend([captainLat, captainLng]);
        }
        if (shouldShowPassengerGps && passengerLat && passengerLng) {
          routeBounds.extend([passengerLat, passengerLng]);
        }
        map.invalidateSize();
        const bottomPad = bottomSheetPadding || 340;
        map.fitBounds(routeBounds, {
          paddingTopLeft: [70, 40],
          paddingBottomRight: [40, bottomPad],
          maxZoom: 16,
          animate: true,
        });
      }
    } else if (!isCaptainMode && hasPickup && !hasDropoff && pickupLat && pickupLng) {
      const pad = bottomSheetPadding || 280;
      map.invalidateSize();
      map.fitBounds(L.latLngBounds([[pickupLat, pickupLng], [pickupLat, pickupLng]]), {
        paddingBottomRight: [40, pad],
        paddingTopLeft: [70, 40],
        maxZoom: 16,
        animate: true,
      });
    } else if (!isCaptainMode && !hasPickup && hasDropoff && dropoffLat && dropoffLng) {
      const pad = bottomSheetPadding || 280;
      map.invalidateSize();
      map.fitBounds(L.latLngBounds([[dropoffLat, dropoffLng], [dropoffLat, dropoffLng]]), {
        paddingBottomRight: [40, pad],
        paddingTopLeft: [70, 40],
        maxZoom: 16,
        animate: true,
      });
    } else if (bounds.length > 1 && !isFollowingPassenger) {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(bounds), { padding: [60, 60], maxZoom: 16, animate: false });
    } else if (bounds.length >= 1 && !isFollowingPassenger) {
      map.setView(bounds[0], 15, { animate: false });
    } else if (passengerLat && passengerLng && !hasInitiallyCenteredPassengerRef.current) {
      hasInitiallyCenteredPassengerRef.current = true;
      const pad = bottomSheetPadding || 0;
      if (pad > 0) {
        map.fitBounds(L.latLngBounds([[passengerLat, passengerLng], [passengerLat, passengerLng]]), {
          paddingBottomRight: [40, pad],
          paddingTopLeft: [70, 40],
          maxZoom: 16,
          animate: false,
        });
      } else {
        map.setView([passengerLat, passengerLng], 16, { animate: false });
      }
    }
  }, [
    mapReady,
    pickupLat,
    pickupLng,
    pickupAddress,
    dropoffLat,
    dropoffLng,
    dropoffAddress,
    captainLat,
    captainLng,
    captainHeading,
    captainAccuracy,
    captainName,
    isCaptainMode,
    isFollowingCaptain,
    passengerLat,
    passengerLng,
    passengerAccuracy,
    passengerName,
    showPassengerOnly,
    showLocationsABOnly,
    isFollowingPassenger,
    onSetPickupToPassengerLocation,
    nearbyCaptains,
    nearestCaptain,
    onSelectCaptain,
    activeRideStatus,
    bottomSheetPadding,
  ]);

  // Smoothly pan & zoom to external focus coordinates when requested
  useEffect(() => {
    if (focusCoords && mapInstanceRef.current && focusCoords.lat && focusCoords.lng) {
      setIsFollowingCaptain(false);
      setIsFollowingPassenger(false);
      const targetZoom = focusCoords.zoom ?? 16;
      mapInstanceRef.current.flyTo([focusCoords.lat, focusCoords.lng], targetZoom, {
        animate: true,
        duration: 0.6,
      });
      if (onFocusCoordsProcessed) {
        onFocusCoordsProcessed();
      }
    }
  }, [focusCoords, onFocusCoordsProcessed]);

  // Handle external zoom in / zoom out actions
  useEffect(() => {
    if (zoomAction && mapInstanceRef.current) {
      if (zoomAction.type === 'in') {
        mapInstanceRef.current.zoomIn(1, { animate: true });
      } else if (zoomAction.type === 'out') {
        mapInstanceRef.current.zoomOut(1, { animate: true });
      }
    }
  }, [zoomAction]);

  // Center on Passenger or Captain Live Location with Navigator
  const handleNavigatorCenter = () => {
    if (!mapInstanceRef.current) return;
    if (isCaptainMode) {
      setIsFollowingCaptain(true);
      if (captainLat && captainLng) {
        mapInstanceRef.current.flyTo([captainLat, captainLng], 16, { animate: true, duration: 0.8 });
      }
    } else {
      setIsFollowingPassenger(true);
      const targetLat = passengerLat || pickupLat;
      const targetLng = passengerLng || pickupLng;
      if (targetLat && targetLng) {
        const pad = bottomSheetPadding || 0;
        if (pad > 0) {
          mapInstanceRef.current.fitBounds(
            L.latLngBounds([[targetLat, targetLng], [targetLat, targetLng]]),
            {
              paddingBottomRight: [40, pad],
              paddingTopLeft: [70, 40],
              maxZoom: 16,
              animate: true,
              duration: 0.8,
            }
          );
        } else {
          mapInstanceRef.current.flyTo([targetLat, targetLng], 16, { animate: true, duration: 0.8 });
        }
      }
    }
    if (onLocateMe) {
      onLocateMe();
    }
  };

  const handleFocusNearestCaptain = () => {
    if (!mapInstanceRef.current || !nearestCaptain) return;
    setIsFollowingPassenger(false);
    mapInstanceRef.current.flyTo([nearestCaptain.lat, nearestCaptain.lng], 16, {
      animate: true,
      duration: 0.9,
    });
    const marker = nearbyCaptainMarkersRef.current.get(nearestCaptain.id);
    if (marker) {
      setTimeout(() => {
        try {
          marker.openPopup();
        } catch {}
      }, 500);
    }
    if (onFocusNearestCaptain) {
      onFocusNearestCaptain();
    }
  };

  const handleLocateMe = () => {
    if (!mapInstanceRef.current) return;
    if (isCaptainMode) {
      setIsFollowingCaptain(true);
      const hasValidPickup = typeof pickupLat === 'number' && typeof pickupLng === 'number' && !isNaN(pickupLat) && !isNaN(pickupLng);
      const hasValidDropoff = typeof dropoffLat === 'number' && typeof dropoffLng === 'number' && !isNaN(dropoffLat) && !isNaN(dropoffLng);
      if (hasValidPickup && hasValidDropoff && pickupLat && pickupLng && dropoffLat && dropoffLng) {
        const routeBounds = L.latLngBounds([
          [pickupLat, pickupLng],
          [dropoffLat, dropoffLng],
        ]);
        if (captainLat && captainLng) {
          routeBounds.extend([captainLat, captainLng]);
        }
        mapInstanceRef.current.fitBounds(routeBounds, {
          paddingTopLeft: [28, 36],
          paddingBottomRight: [52, 25],
          maxZoom: 16,
          animate: true,
          duration: 0.8,
        });
      } else if (captainLat && captainLng) {
        mapInstanceRef.current.flyTo([captainLat, captainLng], 16, { animate: true, duration: 0.9 });
      }
    } else {
      setIsFollowingPassenger(true);
      const targetLat = passengerLat || pickupLat;
      const targetLng = passengerLng || pickupLng;
      if (targetLat && targetLng) {
        const pad = bottomSheetPadding || 0;
        if (pad > 0) {
          mapInstanceRef.current.fitBounds(
            L.latLngBounds([[targetLat, targetLng], [targetLat, targetLng]]),
            {
              paddingBottomRight: [40, pad],
              paddingTopLeft: [70, 40],
              maxZoom: 16,
              animate: true,
              duration: 0.9,
            }
          );
        } else {
          mapInstanceRef.current.flyTo([targetLat, targetLng], 16, { animate: true, duration: 0.9 });
        }
      }
    }
    if (onLocateMe) {
      onLocateMe();
    }
  };

  const handleCenter = () => {
    if (!mapInstanceRef.current) return;
    if (isCaptainMode && captainLat && captainLng) {
      setIsFollowingCaptain(true);
      mapInstanceRef.current.flyTo([captainLat, captainLng], 15, { animate: true, duration: 0.8 });
    } else {
      const targetLat = passengerLat || pickupLat || captainLat;
      const targetLng = passengerLng || pickupLng || captainLng;
      if (targetLat && targetLng) {
        const pad = bottomSheetPadding || 0;
        if (pad > 0) {
          mapInstanceRef.current.fitBounds(
            L.latLngBounds([[targetLat, targetLng], [targetLat, targetLng]]),
            {
              paddingBottomRight: [40, pad],
              paddingTopLeft: [70, 40],
              maxZoom: 16,
              animate: true,
              duration: 0.8,
            }
          );
        } else {
          mapInstanceRef.current.flyTo([targetLat, targetLng], 16, { animate: true, duration: 0.8 });
        }
      }
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn(1, { animate: true });
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut(1, { animate: true });
    }
  };

  return (
    <div
      style={{ touchAction: 'none', overscrollBehavior: 'none' }}
      className={`relative ${className} overflow-hidden transition-colors duration-300 ${
        activeLayer === 'voyager-dark' ? 'bg-slate-950' : 'bg-slate-100'
      }`}
    >
      <div ref={mapContainerRef} style={{ touchAction: 'none', overscrollBehavior: 'none' }} className="w-full h-full" />

      {/* Map Overlay Controls - Hidden by default */}
      {showOverlayControls && (
        <>
          {/* Right Center: Floating Zoom Controls */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[450] flex flex-col items-center gap-1.5 select-none pointer-events-auto">
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In (+)"
              aria-label="Zoom In"
              style={{ touchAction: 'manipulation' }}
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-white/95 hover:bg-white text-slate-900 border border-slate-300 shadow-xl backdrop-blur-md flex items-center justify-center active:scale-90 transition-all cursor-pointer font-black text-lg sm:text-xl hover:shadow-cyan-500/20 active:bg-slate-100"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900 stroke-[3]" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out (-)"
              aria-label="Zoom Out"
              style={{ touchAction: 'manipulation' }}
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-white/95 hover:bg-white text-slate-900 border border-slate-300 shadow-xl backdrop-blur-md flex items-center justify-center active:scale-90 transition-all cursor-pointer font-black text-lg sm:text-xl hover:shadow-cyan-500/20 active:bg-slate-100"
            >
              <Minus className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900 stroke-[3]" />
            </button>
            <button
              type="button"
              onClick={handleLocateMe}
              title="Recenter Map on Location / Route"
              aria-label="Recenter Map on Location / Route"
              style={{ touchAction: 'manipulation' }}
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-white/95 hover:bg-white text-slate-900 border border-slate-300 shadow-xl backdrop-blur-md flex items-center justify-center active:scale-90 transition-all cursor-pointer group active:bg-slate-100"
            >
              <LocateFixed className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 stroke-[2.5] group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
