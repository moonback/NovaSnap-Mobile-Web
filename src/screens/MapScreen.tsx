import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Ghost, 
  Compass, 
  Flame, 
  Settings, 
  X, 
  Search, 
  Navigation, 
  Play, 
  MapPin, 
  Loader2 
} from 'lucide-react';
import { useFriends } from '../hooks/useFriends';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastProvider';

// Leaflet CDN links
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

interface Landmark {
  id: string;
  name: string;
  coords: [number, number]; // [lat, lng]
  emoji: string;
  description: string;
  storyImage: string;
  views: number;
}

const LANDMARKS: Landmark[] = [
  {
    id: 'eiffel',
    name: 'Tour Eiffel',
    coords: [48.8584, 2.2945],
    emoji: '🗼',
    description: 'La dame de fer brille de mille feux à Paris.',
    storyImage: '/eiffel_snap.png',
    views: 1240,
  },
  {
    id: 'louvre',
    name: 'Musée du Louvre',
    coords: [48.8606, 2.3376],
    emoji: '🎨',
    description: 'La pyramide de verre et ses trésors artistiques.',
    storyImage: '/louvre_snap.png',
    views: 890,
  },
  {
    id: 'notredame',
    name: 'Cathédrale Notre-Dame',
    coords: [48.8530, 2.3499],
    emoji: '⛪',
    description: 'Un chef-d\'œuvre d\'architecture historique gothique.',
    storyImage: '/notredame_snap.png',
    views: 520,
  },
];

export default function MapScreen() {
  const { friends, isLoading: friendsLoading } = useFriends();
  const { user } = useAppStore();
  const { toast } = useToast();

  const [mapLoaded, setMapLoaded] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(() => {
    return localStorage.getItem('snap_map_ghost_mode') === 'true';
  });
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [activeStory, setActiveStory] = useState<Landmark | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number]>([48.8566, 2.3522]); // Default: Paris Center
  const [coordsLoading, setCoordsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const friendMarkersRef = useRef<any[]>([]);
  const landmarkMarkersRef = useRef<any[]>([]);
  const heatmapLayerRef = useRef<any[]>([]);

  // 1. Dynamic GPS User Coordinates
  useEffect(() => {
    if (!navigator.geolocation) return;
    setCoordsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords([pos.coords.latitude, pos.coords.longitude]);
        setCoordsLoading(false);
      },
      (err) => {
        console.warn('Geolocation denied or unavailable, using default Paris.', err);
        setCoordsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  // 2. Load Leaflet Dynamically to bypass Vite/React 19 build conflicts
  useEffect(() => {
    let cssLink = document.getElementById('leaflet-css') as HTMLLinkElement;
    let jsScript = document.getElementById('leaflet-js') as HTMLScriptElement;

    const initializeMapState = () => {
      setMapLoaded(true);
    };

    if (!cssLink) {
      cssLink = document.createElement('link');
      cssLink.id = 'leaflet-css';
      cssLink.rel = 'stylesheet';
      cssLink.href = LEAFLET_CSS;
      document.head.appendChild(cssLink);
    }

    if (!jsScript) {
      jsScript = document.createElement('script');
      jsScript.id = 'leaflet-js';
      jsScript.src = LEAFLET_JS;
      jsScript.async = true;
      jsScript.onload = initializeMapState;
      document.body.appendChild(jsScript);
    } else {
      if ((window as any).L) {
        initializeMapState();
      } else {
        jsScript.onload = initializeMapState;
      }
    }

    return () => {
      // Keep CDN scripts for subsequent loads, but clean up active instances
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 3. Initialize Leaflet Map
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || mapInstanceRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Create Leaflet Map Center
    const map = L.map(mapContainerRef.current, {
      center: userCoords,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // CartoDB Dark Matter Tile Layer (Premium Night Theme)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
    }).addTo(map);

    // Custom CSS styles injection for Leaflet components
    const style = document.createElement('style');
    style.innerHTML = `
      .pulsing-blue-dot {
        width: 14px;
        height: 14px;
        background: #0084ff;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgba(0, 132, 255, 0.4), 0 0 20px rgba(0, 132, 255, 0.6);
        animation: pulseBlue 1.6s infinite alternate;
      }
      .pulsing-ghost-dot {
        width: 16px;
        height: 16px;
        background: #a855f7;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.4), 0 0 20px rgba(168, 85, 247, 0.6);
        animation: pulseGhost 1.6s infinite alternate;
      }
      .friend-avatar-marker {
        border: 2px solid #fffc00;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        background: #000;
      }
      .landmark-glowing-ring {
        width: 24px;
        height: 24px;
        background: rgba(255, 252, 0, 0.15);
        border: 2px solid #fffc00;
        border-radius: 50%;
        box-shadow: 0 0 0 6px rgba(255, 252, 0, 0.25), 0 0 24px rgba(255, 252, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        cursor: pointer;
        animation: pulseYellow 1.2s infinite alternate;
      }
      .heatmap-activity-zone {
        background: radial-gradient(circle, rgba(239, 68, 68, 0.6) 0%, rgba(249, 115, 22, 0.3) 45%, transparent 70%);
        border-radius: 50%;
        animation: pulseHeatmap 3s infinite;
      }
      @keyframes pulseBlue {
        0% { transform: scale(0.9); box-shadow: 0 0 0 0px rgba(0, 132, 255, 0.5); }
        100% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(0, 132, 255, 0); }
      }
      @keyframes pulseGhost {
        0% { transform: scale(0.9); box-shadow: 0 0 0 0px rgba(168, 85, 247, 0.5); }
        100% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(168, 85, 247, 0); }
      }
      @keyframes pulseYellow {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0px rgba(255, 252, 0, 0.4); }
        100% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(255, 252, 0, 0); }
      }
      @keyframes pulseHeatmap {
        0% { transform: scale(0.8); opacity: 0.5; }
        50% { transform: scale(1.2); opacity: 0.8; }
        100% { transform: scale(0.8); opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);

  }, [mapLoaded, userCoords]);

  // 4. Update elements on the map (User, Friends, Landmarks, Heatmap)
  useEffect(() => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // --- User Live Position ---
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
    }

    const userIcon = L.divIcon({
      className: isGhostMode ? 'pulsing-ghost-dot' : 'pulsing-blue-dot',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    userMarkerRef.current = L.marker(userCoords, { icon: userIcon }).addTo(map);

    // --- Active Heatmap Zones ---
    heatmapLayerRef.current.forEach((layer) => map.removeLayer(layer));
    heatmapLayerRef.current = [];

    if (showHeatmap) {
      // Add pulsing heatmap overlay circles around hotspots
      const hotCoords = [
        [48.8584, 2.2945], // Eiffel Tower
        [48.8606, 2.3376], // Louvre
        [48.8530, 2.3499], // Notre Dame
        [48.8566, 2.3522], // Center
      ];

      hotCoords.forEach((coords) => {
        const heatmapIcon = L.divIcon({
          className: 'heatmap-activity-zone',
          iconSize: [80, 80],
          iconAnchor: [40, 40],
        });
        const layer = L.marker(coords, { icon: heatmapIcon }).addTo(map);
        heatmapLayerRef.current.push(layer);
      });
    }

    // --- Friends Locations Simulation ---
    friendMarkersRef.current.forEach((m) => map.removeLayer(m));
    friendMarkersRef.current = [];

    if (!friendsLoading && friends.length > 0) {
      // Place friends randomly within a 2.5km radius of the user
      friends.forEach((friend, idx) => {
        const latOffset = (Math.sin(idx * 2.3) * 0.015);
        const lngOffset = (Math.cos(idx * 3.7) * 0.015);
        const fLat = userCoords[0] + latOffset;
        const fLng = userCoords[1] + lngOffset;

        const avatarMarkup = friend.user.avatar_url 
          ? `<img src="${friend.user.avatar_url}" style="width: 32px; height: 32px; border-radius: 50%;" />`
          : `<div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(to right, #eab308, #f97316); display: flex; align-items: center; justify-content: center; font-weight: bold; color: black; font-size: 10px;">${(friend.user.username || 'U').substring(0, 2).toUpperCase()}</div>`;

        const friendIcon = L.divIcon({
          className: 'friend-avatar-marker',
          html: avatarMarkup,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([fLat, fLng], { icon: friendIcon }).addTo(map);
        
        // Add elegant micro tooltip with friend name
        marker.bindTooltip(friend.user.username || 'Ami', {
          permanent: true,
          direction: 'bottom',
          offset: [0, 8],
          className: 'glass-dark text-white border-none shadow-[0_2px_8px_rgba(0,0,0,0.3)] rounded-lg text-[9px] font-black tracking-wide px-1.5 py-0.5'
        });

        friendMarkersRef.current.push(marker);
      });
    }

    // --- Public geolocated Stories (Landmarks) ---
    landmarkMarkersRef.current.forEach((m) => map.removeLayer(m));
    landmarkMarkersRef.current = [];

    LANDMARKS.forEach((landmark) => {
      const landmarkIcon = L.divIcon({
        className: 'landmark-glowing-ring',
        html: `<span>${landmark.emoji}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker(landmark.coords, { icon: landmarkIcon }).addTo(map);
      
      marker.on('click', () => {
        setActiveStory(landmark);
        setCurrentProgress(0);
      });

      landmarkMarkersRef.current.push(marker);
    });

  }, [mapLoaded, userCoords, isGhostMode, showHeatmap, friends, friendsLoading]);

  // 5. Autoplay & Progress Bars for City Public Stories
  useEffect(() => {
    if (!activeStory) return;

    setCurrentProgress(0);
    const interval = setInterval(() => {
      setCurrentProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setActiveStory(null);
          return 0;
        }
        return prev + 2; // Auto advances in 5 seconds
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeStory]);

  const handleCenterUser = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView(userCoords, 14, { animate: true, duration: 1.2 });
    toast('Recentré sur ma position live ! GPS actée.', 'success');
  };

  const toggleGhostMode = () => {
    const nextVal = !isGhostMode;
    setIsGhostMode(nextVal);
    localStorage.setItem('snap_map_ghost_mode', String(nextVal));
    toast(
      nextVal 
        ? '👻 Mode Fantôme activé ! Ta position est masquée sur la carte.' 
        : '🌍 Mode Fantôme désactivé ! Position partagée avec tes amis.',
      'info'
    );
  };

  const handleCenterOnFriend = (friendName: string, idx: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const latOffset = (Math.sin(idx * 2.3) * 0.015);
    const lngOffset = (Math.cos(idx * 3.7) * 0.015);
    const fLat = userCoords[0] + latOffset;
    const fLng = userCoords[1] + lngOffset;

    map.setView([fLat, fLng], 15, { animate: true, duration: 1.5 });
    toast(`Zoom sur ${friendName} 📍`, 'success');
  };

  const handleCenterOnLandmark = (landmark: Landmark) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setView(landmark.coords, 15, { animate: true, duration: 1.5 });
    toast(`Zoom sur ${landmark.name} 🎪`, 'success');
  };

  return (
    <div className="relative w-full h-full bg-[#0d0d12] text-white overflow-hidden flex flex-col">
      {/* 1. Map container node */}
      <div className="flex-1 w-full h-full relative z-0">
        <div ref={mapContainerRef} className="w-full h-full" style={{ background: '#0e0e13' }} />
        {!mapLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07070a] gap-3">
            <Loader2 className="animate-spin text-snap-yellow" size={32} />
            <p className="text-white/40 text-xs font-black tracking-widest uppercase">Chargement de Snap Map...</p>
          </div>
        )}
      </div>

      {/* 2. Top bar search & buttons */}
      <div className="absolute top-14 inset-x-0 px-4 flex items-center gap-2.5 z-10 pointer-events-none">
        <div className="flex-1 flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-full px-4 py-2.5 border border-white/8 pointer-events-auto shadow-lg">
          <Search size={16} className="text-white/40" />
          <input
            type="text"
            placeholder="Rechercher des amis, des lieux..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-white/35 font-semibold"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}>
              <X size={14} className="text-white/40" />
            </button>
          )}
        </div>
        
        <button
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/8 flex items-center justify-center text-white active:scale-95 transition-all pointer-events-auto shadow-lg"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* 3. Floating Quick controls */}
      <div className="absolute right-4 bottom-52 flex flex-col gap-3.5 z-10">
        {/* Ghost Mode Quick Button */}
        <button
          onClick={toggleGhostMode}
          className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all active:scale-90 shadow-lg ${
            isGhostMode 
              ? 'bg-purple-600/90 border-purple-400 text-white shadow-purple-500/20' 
              : 'bg-black/60 backdrop-blur-md border-white/10 text-white/80 hover:text-white'
          }`}
          title={isGhostMode ? 'Mode Fantôme actif (Position cachée)' : 'Partager ma position'}
        >
          <Ghost size={20} className={isGhostMode ? 'animate-bounce' : ''} />
        </button>

        {/* Heatmap Toggle Button */}
        <button
          onClick={() => {
            setShowHeatmap(!showHeatmap);
            toast(showHeatmap ? 'Heatmap désactivée' : 'Heatmap de chaleur des Snaps activée 🔥', 'info');
          }}
          className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all active:scale-90 shadow-lg ${
            showHeatmap 
              ? 'bg-orange-500/90 border-orange-400 text-white shadow-orange-500/20' 
              : 'bg-black/60 backdrop-blur-md border-white/10 text-white/80 hover:text-white'
          }`}
          title="Afficher la Heatmap d'activité"
        >
          <Flame size={20} className={showHeatmap ? 'animate-pulse' : ''} />
        </button>

        {/* Recenter GPS Position Button */}
        <button
          onClick={handleCenterUser}
          disabled={coordsLoading}
          className="w-11 h-11 rounded-full bg-snap-yellow border border-yellow-400 flex items-center justify-center text-black active:scale-90 transition-all shadow-lg disabled:opacity-50"
          title="Recentrer sur ma position live"
        >
          {coordsLoading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Navigation size={20} fill="black" />
          )}
        </button>
      </div>

      {/* 4. Bottom slide-up drawer for nearby friends & public stories */}
      <div className="absolute bottom-24 inset-x-4 z-10 flex flex-col gap-2 pointer-events-none">
        {isGhostMode && (
          <div className="self-center bg-purple-950/70 border border-purple-500/20 backdrop-blur-md text-[10px] text-purple-200 font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 pointer-events-auto shadow-lg animate-pulse mb-1">
            <Ghost size={12} />
            Mode Fantôme Activé — Position masquée
          </div>
        )}

        <motion.div layout className="bg-black/55 backdrop-blur-xl border border-white/10 rounded-[32px] p-4 pointer-events-auto shadow-2xl flex flex-col overflow-hidden">
          {/* Handle / Toggle */}
          <div 
            className="w-full flex items-center justify-center pt-1 pb-3 cursor-pointer"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          >
            <div className="w-12 h-1.5 bg-white/30 rounded-full" />
          </div>

          <AnimatePresence initial={false}>
            {isDrawerOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="flex flex-col gap-3.5"
              >
                {/* Friends title */}
                <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">Autour de moi</p>
            <span className="text-[10px] text-snap-yellow font-black">
              {friends.length} ami{friends.length > 1 ? 's' : ''} actif{friends.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Friends horizontal list */}
          <div className="flex gap-4 overflow-x-auto scroll-hide pb-0.5">
            {friendsLoading && (
              <div className="flex items-center justify-center w-full py-2">
                <Loader2 className="animate-spin text-white/20" size={16} />
              </div>
            )}
            
            {!friendsLoading && friends.length === 0 && (
              <div className="py-2 text-center w-full">
                <p className="text-[11px] text-white/30 font-medium">Ajoute des amis pour les voir sur la carte !</p>
              </div>
            )}

            {!friendsLoading && friends.map((friend, idx) => (
              <button
                key={friend.friendship_id}
                onClick={() => handleCenterOnFriend(friend.user.username || 'Ami', idx)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 rounded-full p-[2px] ring-2 ring-yellow-400 bg-black relative">
                  {friend.user.avatar_url ? (
                    <img src={friend.user.avatar_url} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-[10px]">
                      {(friend.user.username || 'U').substring(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full" />
                </div>
                <span className="text-[10px] font-bold text-white/70 truncate max-w-[56px]">
                  {friend.user.username}
                </span>
              </button>
            ))}
          </div>

          <div className="h-[1px] bg-white/5" />

          {/* Landmarks popular list */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">Stories géolocalisées</p>
            <span className="text-[10px] text-white/40 font-bold">Populaires</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {LANDMARKS.map((landmark) => (
              <button
                key={landmark.id}
                onClick={() => handleCenterOnLandmark(landmark)}
                className="bg-white/4 hover:bg-white/8 border border-white/5 rounded-2xl p-2.5 flex flex-col items-center gap-1.5 text-center transition-all active:scale-95"
              >
                <span className="text-xl">{landmark.emoji}</span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-black text-white truncate max-w-[80px]">{landmark.name}</span>
                  <span className="text-[8px] font-bold text-snap-yellow flex items-center gap-0.5 justify-center">
                    <Play size={7} fill="currentColor" /> {landmark.views} v.
                  </span>
                </div>
              </button>
            ))}
          </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* 5. Global Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex items-end justify-center p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="w-full bg-[#121218] border border-white/10 rounded-[32px] p-6 flex flex-col gap-5 max-h-[70vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black">Réglages de ma Carte</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Ghost Mode Configuration */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between bg-white/3 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <Ghost size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Mode Fantôme</p>
                      <p className="text-[9px] text-white/40 mt-0.5">Masquer complètement ta position en temps réel.</p>
                    </div>
                  </div>
                  <button
                    onClick={toggleGhostMode}
                    className={`w-12 h-6.5 rounded-full p-0.5 transition-colors relative ${
                      isGhostMode ? 'bg-purple-600' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-5.5 h-5.5 rounded-full bg-white transition-all shadow-md ${
                        isGhostMode ? 'translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Heatmap Configuration */}
                <div className="flex items-center justify-between bg-white/3 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                      <Flame size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Zones Actives (Heatmap)</p>
                      <p className="text-[9px] text-white/40 mt-0.5">Afficher les zones à forte concentration de stories.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    className={`w-12 h-6.5 rounded-full p-0.5 transition-colors relative ${
                      showHeatmap ? 'bg-orange-500' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-5.5 h-5.5 rounded-full bg-white transition-all shadow-md ${
                        showHeatmap ? 'translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
              
              <button
                onClick={() => setShowSettings(false)}
                className="w-full py-3.5 bg-snap-yellow text-black font-black text-xs rounded-2xl shadow-snap-sm active:scale-95 transition-all text-center mt-2"
              >
                Fermer et Appliquer
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Fully Integrated Segmented Map Story Player */}
      <AnimatePresence>
        {activeStory && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col">
            {/* Progress Bar */}
            <div className="absolute top-0 inset-x-0 pt-12 px-3 flex gap-1 z-10">
              <div className="h-[3px] flex-1 bg-white/25 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-100 ease-linear"
                  style={{ width: `${currentProgress}%` }}
                />
              </div>
            </div>

            {/* Story Header */}
            <div className="absolute top-16 inset-x-0 px-4 flex items-center justify-between z-30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-snap-yellow flex items-center justify-center font-black text-black text-lg">
                  {activeStory.emoji}
                </div>
                <div>
                  <p className="text-white font-black text-sm leading-tight">{activeStory.name} Snap</p>
                  <p className="text-white/50 text-[10px] font-bold">Story Publique Géolocalisée</p>
                </div>
              </div>
              <button
                onClick={() => setActiveStory(null)}
                className="w-9 h-9 rounded-full glass-dark flex items-center justify-center text-white active:scale-90 transition-transform"
              >
                <X size={20} />
              </button>
            </div>

            {/* Image content */}
            <div className="flex-1 w-full h-full flex items-center justify-center bg-zinc-950/20 relative">
              <img
                src={activeStory.storyImage}
                alt={activeStory.name}
                className="w-full h-full object-cover"
              />
              
              {/* Landmark description label */}
              <div className="absolute bottom-16 inset-x-6 p-4 glass-dark border border-white/10 rounded-3xl flex flex-col gap-1">
                <span className="text-[10px] text-snap-yellow font-black uppercase tracking-widest">
                  {activeStory.emoji} Infos Lieu
                </span>
                <p className="text-white text-xs font-bold leading-normal">{activeStory.description}</p>
                <span className="text-[9px] text-white/40 mt-1 font-semibold flex items-center gap-1">
                  <Play size={8} fill="currentColor" /> {activeStory.views} vues en direct
                </span>
              </div>
            </div>

            {/* Tap zones for manual dismiss */}
            <div 
              className="absolute inset-0 cursor-pointer"
              onClick={() => setActiveStory(null)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
