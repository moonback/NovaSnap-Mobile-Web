import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Ghost, 
  Flame, 
  Settings, 
  X, 
  Search, 
  Navigation, 
  Play,
  Loader2,
  Layers,
  Users,
  ImageOff,
} from 'lucide-react';
import { useFriends } from '../hooks/useFriends';
import { useFriendLocations } from '../hooks/useFriendLocations';
import { useStories } from '../hooks/useStories';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastProvider';
import type { StoryRow } from '../lib/types';

// Leaflet CDN links
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

export default function MapScreen() {
  const { friends, isLoading: friendsLoading } = useFriends();
  const { user } = useAppStore();
  const { toast } = useToast();
  const { data: allStories = [], isLoading: storiesLoading } = useStories();

  const [mapLoaded, setMapLoaded] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(() => {
    return localStorage.getItem('novasnap_settings_ghost_mode') === 'true';
  });
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [activeStory, setActiveStory] = useState<StoryRow | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number]>([48.8566, 2.3522]); // Default: Paris Center
  const { data: friendLocations = [] } = useFriendLocations(
    userCoords[0], userCoords[1],
  );
  const [coordsLoading, setCoordsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite'>('dark');
  const [showFriendsOnMap, setShowFriendsOnMap] = useState(true);

  // Stories grouped by author (one entry per user, most recent story first)
  const storyAuthors = useMemo(() => {
    const map = new Map<string, StoryRow>();
    for (const story of allStories) {
      if (!map.has(story.user_id)) {
        map.set(story.user_id, story);
      }
    }
    return Array.from(map.values());
  }, [allStories]);

  // Stories for the active author (for sequential playback)
  const [activeAuthorId, setActiveAuthorId] = useState<string | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  const authorStories = useMemo(() => {
    if (!activeAuthorId) return [];
    return allStories.filter(s => s.user_id === activeAuthorId);
  }, [allStories, activeAuthorId]);

  const openAuthorStories = (authorId: string) => {
    const stories = allStories.filter(s => s.user_id === authorId);
    if (stories.length === 0) return;
    setActiveAuthorId(authorId);
    setActiveStoryIndex(0);
    setActiveStory(stories[0]);
    setCurrentProgress(0);
  };

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

  // 3.5 Dynamic Tile Layer
  const tileLayerRef = useRef<any>(null);
  useEffect(() => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const url = mapStyle === 'dark' 
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    tileLayerRef.current = L.tileLayer(url, { maxZoom: 20 }).addTo(map);
  }, [mapStyle, mapLoaded]);

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

    // --- Active Heatmap Zones (based on real friend positions) ---
    heatmapLayerRef.current.forEach((layer) => map.removeLayer(layer));
    heatmapLayerRef.current = [];

    if (showHeatmap && friendLocations.length > 0) {
      friendLocations.forEach((friend) => {
        const heatmapIcon = L.divIcon({
          className: 'heatmap-activity-zone',
          iconSize: [80, 80],
          iconAnchor: [40, 40],
        });
        const layer = L.marker([friend.lat, friend.lng], { icon: heatmapIcon }).addTo(map);
        heatmapLayerRef.current.push(layer);
      });
    }

    friendMarkersRef.current.forEach(m => map.removeLayer(m));
    friendMarkersRef.current = [];

    if (showFriendsOnMap && !isGhostMode) {
      friendLocations.forEach(friend => {
        const html = friend.avatar_url
          ? `
<img src="${friend.avatar_url}" style="width: 32px; height: 32px; border-radius: 50%;" />
`
          : `
<div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(to right, #eab308, #f97316); display: flex; align-items: center; justify-content: center; font-weight: bold; color: black; font-size: 10px;">
  ${(friend.username || 'U').substring(0, 2).toUpperCase()}
</div>
`;

        const icon = L.divIcon({
          className:  'friend-avatar-marker',
          html,
          iconSize:   [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([friend.lat, friend.lng], { icon }).addTo(map);
        marker.bindTooltip(friend.username || 'Friend', {
          permanent:  true,
          direction:  'bottom',
          offset:     [0, 8],
          className:  'glass-dark text-white text-[9px] font-black',
        });
        friendMarkersRef.current.push(marker);
      });
    }

    // --- Stories markers (one per author, positioned near user for now) ---
    // Note: stories table has no lat/lng columns yet — markers are placed
    // near the user's position with a small offset per author index.
    landmarkMarkersRef.current.forEach((m) => map.removeLayer(m));
    landmarkMarkersRef.current = [];

    storyAuthors.forEach((story, index) => {
      const username = story.users?.username || 'User';
      const avatarUrl = story.users?.avatar_url;

      // Spread markers in a small circle around the user position
      const angle = (index / Math.max(storyAuthors.length, 1)) * 2 * Math.PI;
      const offsetLat = 0.003 * Math.cos(angle);
      const offsetLng = 0.003 * Math.sin(angle);
      const markerCoords: [number, number] = [
        userCoords[0] + offsetLat,
        userCoords[1] + offsetLng,
      ];

      const html = avatarUrl
        ? `<img src="${avatarUrl}" style="width:28px;height:28px;border-radius:50%;border:2px solid #fffc00;" />`
        : `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#eab308,#f97316);display:flex;align-items:center;justify-content:center;font-weight:900;color:black;font-size:11px;border:2px solid #fffc00;">${username.substring(0,1).toUpperCase()}</div>`;

      const storyIcon = L.divIcon({
        className: 'landmark-glowing-ring',
        html,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(markerCoords, { icon: storyIcon }).addTo(map);
      marker.on('click', () => {
        openAuthorStories(story.user_id);
      });
      landmarkMarkersRef.current.push(marker);
    });

  }, [mapLoaded, userCoords, isGhostMode, showHeatmap, friendLocations, showFriendsOnMap, storyAuthors]);

  // 5. Autoplay & Progress Bars for Stories
  useEffect(() => {
    if (!activeStory) return;

    setCurrentProgress(0);
    const interval = setInterval(() => {
      setCurrentProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // Advance to next story of same author, or close
          const nextIndex = activeStoryIndex + 1;
          if (nextIndex < authorStories.length) {
            setActiveStoryIndex(nextIndex);
            setActiveStory(authorStories[nextIndex]);
          } else {
            setActiveStory(null);
            setActiveAuthorId(null);
            setActiveStoryIndex(0);
          }
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
    localStorage.setItem('novasnap_settings_ghost_mode', String(nextVal));
    toast(
      nextVal 
        ? '👻 Mode Fantôme activé ! Ta position est masquée sur la carte.' 
        : '🌍 Mode Fantôme désactivé ! Position partagée avec tes amis.',
      'info'
    );
  };

  const handleCenterOnFriend = (friendId: string, friendName: string) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const location = friendLocations.find((f) => f.user_id === friendId);
    if (!location) {
      toast(`${friendName} n'a pas de position récente.`, 'info');
      return;
    }

    map.setView([location.lat, location.lng], 15, { animate: true, duration: 1.5 });
    toast(`Zoom sur ${friendName} 📍`, 'success');
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

        {/* Autour de moi Toggle Button */}
        <button
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all active:scale-90 shadow-lg ${
            isDrawerOpen 
              ? 'bg-blue-500/90 border-blue-400 text-white shadow-blue-500/20' 
              : 'bg-black/60 backdrop-blur-md border-white/10 text-white/80 hover:text-white'
          }`}
          title="Autour de moi"
        >
          <Users size={20} className={isDrawerOpen ? 'scale-110' : ''} />
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

        <AnimatePresence>
          {isDrawerOpen && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-black/55 backdrop-blur-xl border border-white/10 rounded-[32px] p-4 pointer-events-auto shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header with close button */}
              <div className="flex items-center justify-between pb-3">
                <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">Autour de moi</p>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-snap-yellow font-black">
                    {friendLocations.length} ami{friendLocations.length > 1 ? 's' : ''} visible{friendLocations.length > 1 ? 's' : ''}
                  </span>
                  <button 
                    onClick={() => setIsDrawerOpen(false)}
                    className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3.5">
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

            {!friendsLoading && friends.map((friend) => (
              <button
                key={friend.friendship_id}
                onClick={() => handleCenterOnFriend(friend.user.id, friend.user.username || 'Ami')}
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

          {/* Real Stories list */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">Stories actives</p>
            <span className="text-[10px] text-white/40 font-bold">{storyAuthors.length} en ligne</span>
          </div>

          {storiesLoading && (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="animate-spin text-white/20" size={16} />
            </div>
          )}

          {!storiesLoading && storyAuthors.length === 0 && (
            <p className="text-[11px] text-white/30 font-medium text-center py-2">
              Aucune story active pour le moment.
            </p>
          )}

          {!storiesLoading && storyAuthors.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {storyAuthors.map((story) => {
                const username = story.users?.username || 'User';
                const avatarUrl = story.users?.avatar_url;
                return (
                  <button
                    key={story.user_id}
                    onClick={() => openAuthorStories(story.user_id)}
                    className="bg-white/4 hover:bg-white/8 border border-white/5 rounded-2xl p-2.5 flex flex-col items-center gap-1.5 text-center transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-full ring-2 ring-snap-yellow overflow-hidden bg-black flex-shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} className="w-full h-full object-cover" alt={username} />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-sm">
                          {username.substring(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-black text-white truncate max-w-[80px]">{username}</span>
                    <span className="text-[8px] font-bold text-snap-yellow flex items-center gap-0.5 justify-center">
                      <Play size={7} fill="currentColor" /> Story
                    </span>
                  </button>
                );
              })}
            </div>
          )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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

                {/* Map Style Configuration */}
                <div className="flex items-center justify-between bg-white/3 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <Layers size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Style de Carte</p>
                      <p className="text-[9px] text-white/40 mt-0.5">{mapStyle === 'dark' ? 'Sombre (Mode Nuit)' : 'Vue Satellite'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMapStyle(prev => prev === 'dark' ? 'satellite' : 'dark')}
                    className="px-3 py-1.5 rounded-full bg-white/10 text-[10px] font-bold active:scale-95 transition-transform"
                  >
                    Changer
                  </button>
                </div>

                {/* Show Friends Configuration */}
                <div className="flex items-center justify-between bg-white/3 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
                      <Users size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Afficher les Amis</p>
                      <p className="text-[9px] text-white/40 mt-0.5">Voir la position de tes amis sur la carte.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowFriendsOnMap(!showFriendsOnMap)}
                    className={`w-12 h-6.5 rounded-full p-0.5 transition-colors relative ${
                      showFriendsOnMap ? 'bg-green-500' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-5.5 h-5.5 rounded-full bg-white transition-all shadow-md ${
                        showFriendsOnMap ? 'translate-x-5.5' : 'translate-x-0'
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

      {/* 6. Story Player */}
      <AnimatePresence>
        {activeStory && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col">
            {/* Progress Bars (one per story of this author) */}
            <div className="absolute top-0 inset-x-0 pt-12 px-3 flex gap-1 z-10">
              {authorStories.map((s, i) => (
                <div key={s.id} className="h-[3px] flex-1 bg-white/25 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-100 ease-linear"
                    style={{
                      width: i < activeStoryIndex ? '100%' : i === activeStoryIndex ? `${currentProgress}%` : '0%',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Story Header */}
            <div className="absolute top-16 inset-x-0 px-4 flex items-center justify-between z-30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-snap-yellow flex items-center justify-center">
                  {activeStory.users?.avatar_url ? (
                    <img src={activeStory.users.avatar_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="font-black text-black text-sm">
                      {(activeStory.users?.username || 'U').substring(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-white font-black text-sm leading-tight">
                    {activeStory.users?.username || 'Utilisateur'}
                  </p>
                  <p className="text-white/50 text-[10px] font-bold">
                    Story · {activeStoryIndex + 1}/{authorStories.length}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveStory(null);
                  setActiveAuthorId(null);
                  setActiveStoryIndex(0);
                }}
                className="w-9 h-9 rounded-full glass-dark flex items-center justify-center text-white active:scale-90 transition-transform"
              >
                <X size={20} />
              </button>
            </div>

            {/* Media content */}
            <div className="flex-1 w-full h-full flex items-center justify-center bg-zinc-950 relative">
              {activeStory.media_type === 'VIDEO' ? (
                <video
                  key={activeStory.id}
                  src={activeStory.media_url}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : activeStory.media_url ? (
                <img
                  src={activeStory.media_url}
                  alt="Story"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-white/30">
                  <ImageOff size={40} />
                  <p className="text-xs font-bold">Média indisponible</p>
                </div>
              )}
            </div>

            {/* Tap zones for prev/next */}
            <div className="absolute inset-0 flex">
              <div
                className="flex-1 cursor-pointer"
                onClick={() => {
                  if (activeStoryIndex > 0) {
                    const prev = activeStoryIndex - 1;
                    setActiveStoryIndex(prev);
                    setActiveStory(authorStories[prev]);
                    setCurrentProgress(0);
                  }
                }}
              />
              <div
                className="flex-1 cursor-pointer"
                onClick={() => {
                  const next = activeStoryIndex + 1;
                  if (next < authorStories.length) {
                    setActiveStoryIndex(next);
                    setActiveStory(authorStories[next]);
                    setCurrentProgress(0);
                  } else {
                    setActiveStory(null);
                    setActiveAuthorId(null);
                    setActiveStoryIndex(0);
                  }
                }}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
