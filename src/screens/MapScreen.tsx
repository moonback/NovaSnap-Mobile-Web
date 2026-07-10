import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ghost, Flame, Settings, X, Search, Navigation, Play, Loader2,
  Layers, Users, ImageOff, ZoomIn, ZoomOut, ChevronDown, MapPin,
  Send, Heart, Reply, Eye, Clock,
} from 'lucide-react';
import { useFriends } from '../hooks/useFriends';
import { useFriendLocations } from '../hooks/useFriendLocations';
import { useStories } from '../hooks/useStories';
import { useCurrentUserProfile } from '../hooks/useCurrentUserProfile';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastProvider';
import type { StoryRow } from '../lib/types';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

// ─── tiny helpers ────────────────────────────────────────────────────────────
const distanceLabel = (m: number) =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'À l\'instant';
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  return `Il y a ${Math.floor(h / 24)} j`;
};

// ─── Friend pop-up card ───────────────────────────────────────────────────────
interface FriendPopupProps {
  friend: { user_id: string; username: string; avatar_url: string | null; distance_m: number; updated_at: string };
  onClose: () => void;
  onCenter: () => void;
  onChat: () => void;
}
const FriendPopup: React.FC<FriendPopupProps> = ({ friend, onClose, onCenter, onChat }) => (
  <motion.div
    initial={{ opacity: 0, y: 12, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 12, scale: 0.95 }}
    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-56 z-50"
  >
    <div className="bg-[#111116]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 shadow-2xl flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-snap-yellow">
            {friend.avatar_url
              ? <img src={friend.avatar_url} className="w-full h-full object-cover" alt={friend.username} />
              : <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-sm">{(friend.username||'U')[0].toUpperCase()}</div>}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-[#111116] rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-sm truncate">{friend.username}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <MapPin size={10} className="text-snap-yellow flex-shrink-0" />
            <span className="text-[10px] text-white/50 font-bold">{distanceLabel(friend.distance_m)}</span>
            <span className="text-white/20">·</span>
            <Clock size={10} className="text-white/40 flex-shrink-0" />
            <span className="text-[10px] text-white/50 font-bold">{timeAgo(friend.updated_at)}</span>
          </div>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white flex-shrink-0" aria-label="Fermer">
          <X size={12} />
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={onCenter} className="flex-1 py-2 rounded-2xl bg-white/8 text-white/80 text-[11px] font-black flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
          <Navigation size={11} /> Centrer
        </button>
        <button onClick={onChat} className="flex-1 py-2 rounded-2xl bg-snap-yellow text-black text-[11px] font-black flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
          <Send size={11} /> Message
        </button>
      </div>
    </div>
    {/* caret */}
    <div className="w-3 h-3 bg-[#111116]/95 border-r border-b border-white/10 rotate-45 mx-auto -mt-1.5 rounded-sm" />
  </motion.div>
);

// ─── Story Player ─────────────────────────────────────────────────────────────
interface StoryPlayerProps {
  stories: StoryRow[];
  startIndex: number;
  onClose: () => void;
}
const StoryPlayer: React.FC<StoryPlayerProps> = ({ stories, startIndex, onClose }) => {
  const [idx, setIdx]         = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused]   = useState(false);
  const [liked, setLiked]     = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const story = stories[idx];

  useEffect(() => { setProgress(0); setLiked(false); setShowReply(false); }, [idx]);

  useEffect(() => {
    if (!story || paused) return;
    const iv = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(iv);
          if (idx + 1 < stories.length) { setIdx(i => i + 1); }
          else { onClose(); }
          return 0;
        }
        return p + 2;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [story, paused, idx]);

  if (!story) return null;

  const username  = story.users?.username  || 'Utilisateur';
  const avatarUrl = story.users?.avatar_url;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-black flex flex-col select-none"
    >
      {/* Progress bars */}
      <div className="absolute top-0 inset-x-0 pt-11 px-3 flex gap-1 z-20 pointer-events-none">
        {stories.map((s, i) => (
          <div key={s.id} className="h-[3px] flex-1 bg-white/25 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              style={{ width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%' }}
              transition={{ duration: 0.1, ease: 'linear' }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-14 inset-x-0 px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-snap-yellow">
            {avatarUrl
              ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" />
              : <div className="w-full h-full bg-snap-yellow flex items-center justify-center font-black text-black text-sm">{username[0].toUpperCase()}</div>}
          </div>
          <div>
            <p className="text-white font-black text-sm leading-tight">{username}</p>
            <p className="text-white/50 text-[10px] font-bold">{idx + 1}/{stories.length} · {timeAgo(story.created_at)}</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Fermer la story" className="w-9 h-9 rounded-full glass-dark flex items-center justify-center text-white active:scale-90 transition-transform">
          <X size={20} />
        </button>
      </div>

      {/* Media — hold to pause */}
      <div
        className="flex-1 w-full flex items-center justify-center bg-zinc-950 relative overflow-hidden"
        onPointerDown={() => { holdTimer.current = setTimeout(() => setPaused(true), 150); }}
        onPointerUp={() => { clearTimeout(holdTimer.current); setPaused(false); }}
        onPointerLeave={() => { clearTimeout(holdTimer.current); setPaused(false); }}
      >
        {story.media_type === 'VIDEO'
          ? <video key={story.id} src={story.media_url} autoPlay muted playsInline className="w-full h-full object-cover" />
          : story.media_url
            ? <img src={story.media_url} alt="Story" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
            : <div className="flex flex-col items-center gap-3 text-white/30"><ImageOff size={40} /><p className="text-xs font-bold">Média indisponible</p></div>}
        {paused && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center"><div className="flex gap-1.5"><div className="w-1.5 h-6 bg-white rounded-full" /><div className="w-1.5 h-6 bg-white rounded-full" /></div></div>
          </div>
        )}
      </div>

      {/* Tap zones prev / next */}
      <div className="absolute inset-0 flex z-10 pointer-events-none">
        <div className="flex-1 pointer-events-auto" onClick={() => { if (idx > 0) { setIdx(idx - 1); setProgress(0); } }} />
        <div className="flex-1 pointer-events-auto" onClick={() => { if (idx + 1 < stories.length) { setIdx(idx + 1); setProgress(0); } else onClose(); }} />
      </div>

      {/* Bottom actions */}
      <div className="absolute bottom-0 inset-x-0 px-4 pb-10 z-20 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {showReply && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 pointer-events-auto">
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={`Répondre à ${username}…`}
                className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2.5 text-white text-xs placeholder-white/40 outline-none"
                autoFocus
              />
              <button className="w-10 h-10 rounded-full bg-snap-yellow flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform" aria-label="Envoyer">
                <Send size={16} className="text-black" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center justify-between pointer-events-auto">
          <button onClick={() => setShowReply(v => !v)} className="flex items-center gap-2 py-2.5 px-4 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs font-bold active:scale-95 transition-transform">
            <Reply size={14} /> Répondre
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => setLiked(v => !v)} aria-label="J'aime" className="active:scale-90 transition-transform">
              <Heart size={24} className={liked ? 'fill-red-500 text-red-500' : 'text-white'} />
            </button>
            <button aria-label="Partager" className="active:scale-90 transition-transform">
              <Send size={22} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Settings Sheet ────────────────────────────────────────────────────────────
interface SettingsSheetProps {
  onClose: () => void;
  isGhostMode: boolean;       onToggleGhost: () => void;
  showHeatmap: boolean;       onToggleHeatmap: () => void;
  showFriendsOnMap: boolean;  onToggleFriends: () => void;
  mapStyle: 'dark' | 'satellite'; onChangeStyle: (s: 'dark' | 'satellite') => void;
}
const SettingsSheet: React.FC<SettingsSheetProps> = ({
  onClose, isGhostMode, onToggleGhost, showHeatmap, onToggleHeatmap,
  showFriendsOnMap, onToggleFriends, mapStyle, onChangeStyle,
}) => {
  const ToggleRow = ({ icon, label, desc, active, onToggle, color }: {
    icon: React.ReactNode; label: string; desc: string;
    active: boolean; onToggle: () => void; color: string;
  }) => (
    <div className="flex items-center justify-between bg-white/[0.04] border border-white/[0.06] rounded-2xl p-3.5">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>{icon}</div>
        <div><p className="text-xs font-bold text-white">{label}</p><p className="text-[9px] text-white/40 mt-0.5">{desc}</p></div>
      </div>
      <button
        onClick={onToggle}
        aria-label={`${active ? 'Désactiver' : 'Activer'} ${label}`}
        className={`w-11 h-6 rounded-full p-0.5 transition-colors relative flex-shrink-0 ${active ? 'bg-snap-yellow' : 'bg-white/15'}`}
      >
        <motion.div layout className={`w-5 h-5 rounded-full bg-black shadow transition-all ${active ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-end justify-center p-4 pb-28" onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="w-full bg-[#0e0e14] border border-white/10 rounded-[32px] p-5 flex flex-col gap-4 max-h-[72vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white">Réglages Carte</h3>
          <button onClick={onClose} aria-label="Fermer" className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition-transform">
            <X size={16} />
          </button>
        </div>

        <ToggleRow icon={<Ghost size={18} className="text-purple-400" />} label="Mode Fantôme"
          desc="Ta position est invisible pour tes amis."
          active={isGhostMode} onToggle={onToggleGhost} color="bg-purple-600/15 border border-purple-500/20" />

        <ToggleRow icon={<Flame size={18} className="text-orange-400" />} label="Zones Actives"
          desc="Heatmap des zones à forte activité."
          active={showHeatmap} onToggle={onToggleHeatmap} color="bg-orange-500/15 border border-orange-500/20" />

        <ToggleRow icon={<Users size={18} className="text-green-400" />} label="Afficher les Amis"
          desc="Voir tes amis en temps réel sur la carte."
          active={showFriendsOnMap} onToggle={onToggleFriends} color="bg-green-500/15 border border-green-500/20" />

        {/* Map style pill selector */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-3.5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0"><Layers size={18} className="text-blue-400" /></div>
            <div><p className="text-xs font-bold text-white">Style de Carte</p><p className="text-[9px] text-white/40 mt-0.5">Choisir l'apparence de la carte</p></div>
          </div>
          <div className="flex gap-2">
            {(['dark', 'satellite'] as const).map(s => (
              <button key={s} onClick={() => onChangeStyle(s)}
                className={`flex-1 py-2 rounded-full text-[11px] font-black transition-all active:scale-95 ${mapStyle === s ? 'bg-snap-yellow text-black' : 'bg-white/10 text-white/60'}`}>
                {s === 'dark' ? '🌑 Sombre' : '🛰 Satellite'}
              </button>
            ))}
          </div>
        </div>

        <button onClick={onClose} className="w-full py-3.5 bg-snap-yellow text-black font-black text-xs rounded-2xl shadow-snap-sm active:scale-95 transition-all">
          Appliquer et fermer
        </button>
      </motion.div>
    </div>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MapScreen() {
  const { friends, isLoading: friendsLoading }  = useFriends();
  const { user, setCurrentView, setDirectChatId } = useAppStore();
  const { data: currentProfile }                = useCurrentUserProfile();
  const { toast }                               = useToast();
  const { data: allStories = [], isLoading: storiesLoading } = useStories();
  const { setShowProfile } = useAppStore();

  // ── Map state ──
  const [mapLoaded, setMapLoaded]   = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(() => localStorage.getItem('novasnap_settings_ghost_mode') === 'true');
  const [showHeatmap, setShowHeatmap] = useState(() => localStorage.getItem('novasnap_map_show_heatmap') !== 'false');
  const [mapStyle, setMapStyle]     = useState<'dark' | 'satellite'>(() => (localStorage.getItem('novasnap_map_style') as 'dark' | 'satellite') || 'dark');
  const [showFriendsOnMap, setShowFriendsOnMap] = useState(() => localStorage.getItem('novasnap_map_show_friends') !== 'false');

  // ── User coords ──
  const [userCoords, setUserCoords]     = useState<[number, number]>([48.8566, 2.3522]);
  const [coordsLoading, setCoordsLoading] = useState(false);
  const { data: friendLocations = [] }  = useFriendLocations(userCoords[0], userCoords[1]);

  // ── Search ──
  const [searchQuery, setSearchQuery]     = useState('');
  const [debounced, setDebounced]         = useState('');
  const [placeResults, setPlaceResults]   = useState<any[]>([]);
  const [isSearching, setIsSearching]     = useState(false);

  // ── UI panels ──
  const [showSettings, setShowSettings]   = useState(false);
  const [isDrawerOpen, setIsDrawerOpen]   = useState(false);

  // ── Story viewer ──
  const [activeAuthorId, setActiveAuthorId]   = useState<string | null>(null);
  const [storyStartIndex, setStoryStartIndex] = useState(0);

  // ── Friend pop-up ──
  const [activeFriendPopup, setActiveFriendPopup] = useState<string | null>(null);

  // ── Refs ──
  const mapContainerRef   = useRef<HTMLDivElement>(null);
  const mapInstanceRef    = useRef<any>(null);
  const userMarkerRef     = useRef<any>(null);
  const friendMarkersRef  = useRef<Map<string, any>>(new Map());
  const storyMarkersRef   = useRef<any[]>([]);
  const heatmapLayerRef   = useRef<any[]>([]);
  const tileLayerRef      = useRef<any>(null);

  // ── Derived data ──
  const storyAuthors = useMemo(() => {
    const map = new Map<string, StoryRow>();
    for (const s of allStories) if (!map.has(s.user_id)) map.set(s.user_id, s);
    return Array.from(map.values());
  }, [allStories]);

  const authorStories = useMemo(() =>
    activeAuthorId ? allStories.filter(s => s.user_id === activeAuthorId) : [],
    [allStories, activeAuthorId]);

  const filteredFriends = useMemo(() =>
    searchQuery ? friendLocations.filter(f => f.username?.toLowerCase().includes(searchQuery.toLowerCase())) : [],
    [searchQuery, friendLocations]);

  // ─── Effects ──────────────────────────────────────────────────────────────

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchQuery), 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Nominatim place search
  useEffect(() => {
    if (!debounced || debounced.length < 2) { setPlaceResults([]); return; }
    let live = true;
    setIsSearching(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debounced)}&limit=5`)
      .then(r => r.json())
      .then(d => { if (live) setPlaceResults(d); })
      .catch(console.error)
      .finally(() => { if (live) setIsSearching(false); });
    return () => { live = false; };
  }, [debounced]);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    setCoordsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setUserCoords([pos.coords.latitude, pos.coords.longitude]); setCoordsLoading(false); },
      err => { console.warn('GPS:', err); setCoordsLoading(false); },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  // Load Leaflet CDN
  useEffect(() => {
    let css = document.getElementById('leaflet-css') as HTMLLinkElement;
    let js  = document.getElementById('leaflet-js') as HTMLScriptElement;
    const init = () => setMapLoaded(true);
    if (!css) { css = document.createElement('link'); css.id='leaflet-css'; css.rel='stylesheet'; css.href=LEAFLET_CSS; document.head.appendChild(css); }
    if (!js)  { js = document.createElement('script'); js.id='leaflet-js'; js.src=LEAFLET_JS; js.async=true; js.onload=init; document.body.appendChild(js); }
    else       { (window as any).L ? init() : (js.onload = init); }
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, []);

  // Inject custom CSS once
  useEffect(() => {
    if (!mapLoaded) return;
    const id = 'novasnap-map-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.innerHTML = `
      .ns-dot-blue{width:14px;height:14px;background:#0084ff;border:2px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(0,132,255,.35);animation:nsPulseBlue 1.8s infinite}
      .ns-dot-ghost{width:16px;height:16px;background:#a855f7;border:2px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(168,85,247,.35);animation:nsPulseGhost 1.8s infinite}
      .ns-friend-marker{border-radius:50%;overflow:hidden;border:2.5px solid #FFC0CB;box-shadow:0 4px 14px rgba(0,0,0,.5)}
      .ns-story-ring{border-radius:50%;overflow:visible;display:flex;align-items:center;justify-content:center;cursor:pointer}
      .ns-story-ring-inner{border-radius:50%;overflow:hidden;border:2.5px solid #FFFC00;box-shadow:0 0 0 4px rgba(255,252,0,.3),0 0 18px rgba(255,252,0,.5);animation:nsGlowY 2s infinite alternate}
      .ns-heat{background:transparent;border:none;pointer-events:none}
      .ns-heat-inner{width:100%;height:100%;background:radial-gradient(circle,rgba(255,30,0,.9) 0%,rgba(255,180,0,.7) 15%,rgba(30,215,96,.4) 35%,rgba(29,155,240,.15) 60%,transparent 85%);border-radius:50%;filter:blur(14px);mix-blend-mode:screen;animation:nsHeat 3s infinite alternate ease-in-out}
      .leaflet-tooltip.ns-tooltip{background:rgba(0,0,0,.75)!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:999px!important;color:#fff!important;font-size:9px!important;font-weight:900!important;padding:2px 8px!important;white-space:nowrap!important;box-shadow:none!important}
      .leaflet-tooltip.ns-tooltip::before{display:none!important}
      @keyframes nsPulseBlue{0%{box-shadow:0 0 0 0 rgba(0,132,255,.6)}70%{box-shadow:0 0 0 10px rgba(0,132,255,0)}100%{box-shadow:0 0 0 0 rgba(0,132,255,0)}}
      @keyframes nsPulseGhost{0%{box-shadow:0 0 0 0 rgba(168,85,247,.6)}70%{box-shadow:0 0 0 10px rgba(168,85,247,0)}100%{box-shadow:0 0 0 0 rgba(168,85,247,0)}}
      @keyframes nsGlowY{0%{box-shadow:0 0 0 4px rgba(255,252,0,.3),0 0 12px rgba(255,252,0,.4)}100%{box-shadow:0 0 0 8px rgba(255,252,0,.1),0 0 28px rgba(255,252,0,.7)}}
      @keyframes nsHeat{0%{transform:scale(.82);opacity:.5}100%{transform:scale(1.18);opacity:1}}
    `;
    document.head.appendChild(style);
  }, [mapLoaded]);

  // Init map
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    mapInstanceRef.current = L.map(mapContainerRef.current, { center: userCoords, zoom: 13, zoomControl: false, attributionControl: false });
  }, [mapLoaded]);

  // Tile layer
  useEffect(() => {
    const L = (window as any).L; const map = mapInstanceRef.current;
    if (!L || !map) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const url = mapStyle === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    tileLayerRef.current = L.tileLayer(url, { maxZoom: 20 }).addTo(map);
  }, [mapStyle, mapLoaded]);

  // Update map markers
  useEffect(() => {
    const L = (window as any).L; const map = mapInstanceRef.current;
    if (!L || !map) return;

    // User dot
    if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);
    userMarkerRef.current = L.marker(userCoords, {
      icon: L.divIcon({ className: isGhostMode ? 'ns-dot-ghost' : 'ns-dot-blue', iconSize: [16,16], iconAnchor: [8,8] })
    }).addTo(map);

    // Heatmap
    heatmapLayerRef.current.forEach(l => map.removeLayer(l));
    heatmapLayerRef.current = [];
    if (showHeatmap) {
      const R = 6371000, toRad = (d: number) => d * Math.PI / 180;
      const distM = (a: [number,number], b: [number,number]) => {
        const dLat = toRad(b[0]-a[0]), dLng = toRad(b[1]-a[1]);
        const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
      };
      const pts: {lat:number;lng:number;w:number}[] = [];
      friendLocations.forEach(f => {
        const nearby = friendLocations.filter(g => g.user_id !== f.user_id && distM([f.lat,f.lng],[g.lat,g.lng]) < 500).length;
        pts.push({ lat: f.lat, lng: f.lng, w: 1 + nearby });
      });
      storyAuthors.forEach((s, i) => {
        const lat = typeof s.latitude === 'number' ? s.latitude : userCoords[0] + 0.002*Math.cos((i/Math.max(storyAuthors.length,1))*2*Math.PI);
        const lng = typeof s.longitude === 'number' ? s.longitude : userCoords[1] + 0.002*Math.sin((i/Math.max(storyAuthors.length,1))*2*Math.PI);
        pts.push({ lat, lng, w: 0.6 });
      });
      if (!isGhostMode) pts.push({ lat: userCoords[0], lng: userCoords[1], w: 1.5 });
      pts.forEach(({ lat, lng, w }) => {
        const sz = Math.round(120 + w * 60);
        const op = Math.min(0.3 + w * 0.14, 0.8);
        const icon = L.divIcon({ className: 'ns-heat', html: `<div class="ns-heat-inner" style="opacity:${op};width:${sz}px;height:${sz}px;"></div>`, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2] });
        heatmapLayerRef.current.push(L.marker([lat,lng],{icon}).addTo(map));
      });
    }

    // Friend markers
    friendMarkersRef.current.forEach(m => map.removeLayer(m));
    friendMarkersRef.current = new Map();
    if (showFriendsOnMap && !isGhostMode) {
      friendLocations.forEach(friend => {
        const html = friend.avatar_url
          ? `<img src="${friend.avatar_url}" style="width:34px;height:34px;border-radius:50%;" />`
          : `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#eab308,#f97316);display:flex;align-items:center;justify-content:center;font-weight:900;color:black;font-size:11px;">${(friend.username||'U')[0].toUpperCase()}</div>`;
        const icon = L.divIcon({ className: 'ns-friend-marker', html, iconSize:[38,38], iconAnchor:[19,19] });
        const marker = L.marker([friend.lat, friend.lng], { icon }).addTo(map);
        marker.bindTooltip(friend.username||'Ami', { permanent: true, direction: 'bottom', offset:[0,10], className: 'ns-tooltip' });
        marker.on('click', () => setActiveFriendPopup(friend.user_id));
        friendMarkersRef.current.set(friend.user_id, marker);
      });
    }

    // Story markers
    storyMarkersRef.current.forEach(m => map.removeLayer(m));
    storyMarkersRef.current = [];
    storyAuthors.forEach((story, i) => {
      const username  = story.users?.username  || 'User';
      const avatarUrl = story.users?.avatar_url;
      const lat = typeof story.latitude  === 'number' ? story.latitude  : userCoords[0] + 0.003*Math.cos((i/Math.max(storyAuthors.length,1))*2*Math.PI);
      const lng = typeof story.longitude === 'number' ? story.longitude : userCoords[1] + 0.003*Math.sin((i/Math.max(storyAuthors.length,1))*2*Math.PI);
      const inner = avatarUrl
        ? `<img src="${avatarUrl}" style="width:28px;height:28px;border-radius:50%;display:block;" />`
        : `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#FFFC00,#f97316);display:flex;align-items:center;justify-content:center;font-weight:900;color:black;font-size:12px;">${username[0].toUpperCase()}</div>`;
      const icon = L.divIcon({ className: 'ns-story-ring', html: `<div class="ns-story-ring-inner">${inner}</div>`, iconSize:[32,32], iconAnchor:[16,16] });
      const marker = L.marker([lat,lng], { icon, zIndexOffset: 100 }).addTo(map);
      marker.on('click', () => { setActiveAuthorId(story.user_id); setStoryStartIndex(0); });
      storyMarkersRef.current.push(marker);
    });

  }, [mapLoaded, userCoords, isGhostMode, showHeatmap, friendLocations, showFriendsOnMap, storyAuthors]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleCenter = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView(userCoords, 14, { animate: true, duration: 1.2 });
    toast('Recentré sur ta position GPS 📍', 'success');
  }, [userCoords, toast]);

  const handleZoom = useCallback((dir: 1 | -1) => {
    if (!mapInstanceRef.current) return;
    const z = mapInstanceRef.current.getZoom();
    mapInstanceRef.current.setZoom(z + dir, { animate: true });
  }, []);

  const handleCenterFriend = useCallback((userId: string, name: string) => {
    const loc = friendLocations.find(f => f.user_id === userId);
    if (!loc) { toast(`${name} n'a pas de position récente.`, 'info'); return; }
    mapInstanceRef.current?.setView([loc.lat, loc.lng], 16, { animate: true, duration: 1.4 });
  }, [friendLocations, toast]);

  const handleChatFriend = useCallback((userId: string) => {
    setDirectChatId(userId);
    setCurrentView('chat');
  }, [setDirectChatId, setCurrentView]);

  const toggleGhostMode = () => {
    const next = !isGhostMode;
    setIsGhostMode(next);
    localStorage.setItem('novasnap_settings_ghost_mode', String(next));
    toast(next ? '👻 Mode Fantôme activé — position masquée' : '🌍 Position partagée avec tes amis', 'info');
  };
  const toggleHeatmap = () => {
    const next = !showHeatmap;
    setShowHeatmap(next);
    localStorage.setItem('novasnap_map_show_heatmap', String(next));
    toast(next ? 'Heatmap activée 🔥' : 'Heatmap désactivée', 'info');
  };
  const toggleFriends = () => {
    const next = !showFriendsOnMap;
    setShowFriendsOnMap(next);
    localStorage.setItem('novasnap_map_show_friends', String(next));
    toast(next ? 'Amis visibles sur la carte' : 'Amis masqués', 'info');
  };
  const changeStyle = (s: 'dark' | 'satellite') => {
    setMapStyle(s);
    localStorage.setItem('novasnap_map_style', s);
    toast(`Carte : ${s === 'dark' ? 'Mode Sombre 🌑' : 'Vue Satellite 🛰'}`, 'success');
  };

  const activeFriend = activeFriendPopup ? friendLocations.find(f => f.user_id === activeFriendPopup) : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full bg-[#0d0d12] text-white overflow-hidden flex flex-col">

      {/* Map container */}
      <div className="flex-1 w-full h-full relative z-0">
        <div ref={mapContainerRef} className="w-full h-full" style={{ background: '#0e0e13' }} />
        {!mapLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07070a] gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-snap-yellow/10 flex items-center justify-center">
                <Loader2 className="animate-spin text-snap-yellow" size={28} />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-snap-yellow/20 animate-ping" />
            </div>
            <p className="text-white/40 text-[11px] font-black tracking-widest uppercase">Chargement de la carte…</p>
          </div>
        )}
      </div>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="absolute top-14 inset-x-4 flex flex-col gap-2 z-30 pointer-events-none">
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <button
            onClick={() => setShowProfile(true)}
            aria-label="Voir mon profil"
            className="w-10 h-10 rounded-full border border-white/15 overflow-hidden active:scale-90 transition-transform pointer-events-auto shadow-lg flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#FFC0CB 0%,#ff9500 100%)' }}
          >
            {currentProfile?.avatar_url
              ? <img src={currentProfile.avatar_url} className="w-full h-full object-cover" alt="Profil" />
              : <span className="w-full h-full flex items-center justify-center text-black font-black text-xs">{(currentProfile?.username || user?.email || 'U')[0].toUpperCase()}</span>}
          </button>

          {/* Search */}
          <div className="flex-1 flex items-center gap-2 bg-black/65 backdrop-blur-xl rounded-full px-4 py-2.5 border border-white/8 pointer-events-auto shadow-lg">
            <Search size={14} className="text-white/40 flex-shrink-0" />
            <input
              type="text"
              placeholder="Amis, lieux, adresses…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-white/35 font-semibold"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} aria-label="Effacer la recherche">
                <X size={13} className="text-white/40" />
              </button>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Paramètres de la carte"
            className="w-10 h-10 rounded-full bg-black/65 backdrop-blur-xl border border-white/8 flex items-center justify-center text-white active:scale-90 transition-all pointer-events-auto shadow-lg flex-shrink-0"
          >
            <Settings size={17} />
          </button>
        </div>

        {/* Search dropdown */}
        <AnimatePresence>
          {searchQuery && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="w-full bg-black/85 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-2xl flex flex-col gap-0.5 pointer-events-auto max-h-[40vh] overflow-y-auto"
            >
              {/* Friends results */}
              {filteredFriends.length > 0 && (
                <>
                  <p className="text-[9px] font-black text-white/35 uppercase tracking-widest px-2 pt-1 pb-1">Amis</p>
                  {filteredFriends.map(f => (
                    <button key={f.user_id} onClick={() => { handleCenterFriend(f.user_id, f.username||'Ami'); setSearchQuery(''); }}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/8 active:bg-white/15 transition-colors text-left">
                      <div className="w-8 h-8 rounded-full bg-snap-yellow overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" alt="" /> : <span className="text-black font-black text-xs">{(f.username||'U')[0].toUpperCase()}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{f.username}</p>
                        <p className="text-[10px] text-white/40">{distanceLabel(f.distance_m)} · {timeAgo(f.updated_at)}</p>
                      </div>
                      <Navigation size={13} className="text-white/30 flex-shrink-0" />
                    </button>
                  ))}
                </>
              )}

              {/* Place results */}
              {debounced.length >= 2 && (
                <>
                  <p className="text-[9px] font-black text-white/35 uppercase tracking-widest px-2 pt-2 pb-1 flex items-center justify-between">
                    Lieux {isSearching && <Loader2 size={9} className="animate-spin text-white/40" />}
                  </p>
                  {placeResults.map((place, i) => (
                    <button key={i} onClick={() => {
                      mapInstanceRef.current?.setView([parseFloat(place.lat), parseFloat(place.lon)], 15, { animate: true, duration: 1.4 });
                      toast(`📍 ${place.name || place.display_name.split(',')[0]}`, 'success');
                      setSearchQuery('');
                    }} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/8 active:bg-white/15 transition-colors text-left">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0"><Navigation size={13} /></div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-bold text-white truncate">{place.name || place.display_name.split(',')[0]}</span>
                        <span className="text-[10px] text-white/40 truncate">{place.display_name}</span>
                      </div>
                    </button>
                  ))}
                  {!isSearching && placeResults.length === 0 && (
                    <p className="text-xs text-white/30 italic px-2 py-2.5 text-center">Aucun lieu trouvé pour « {debounced} »</p>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Right FABs ────────────────────────────────────────────────────── */}
      <div className="absolute right-4 bottom-52 flex flex-col gap-3 z-20">
        {/* Ghost mode */}
        <button onClick={toggleGhostMode} aria-label={isGhostMode ? 'Désactiver mode fantôme' : 'Activer mode fantôme'}
          className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all active:scale-90 shadow-xl ${isGhostMode ? 'bg-purple-600 border-purple-400 shadow-purple-600/30' : 'bg-black/65 backdrop-blur-xl border-white/10 text-white/70'}`}>
          <Ghost size={19} className={isGhostMode ? 'text-white' : ''} />
        </button>
        {/* Heatmap */}
        <button onClick={toggleHeatmap} aria-label="Activer/désactiver la heatmap"
          className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all active:scale-90 shadow-xl ${showHeatmap ? 'bg-orange-500 border-orange-400 shadow-orange-500/30' : 'bg-black/65 backdrop-blur-xl border-white/10 text-white/70'}`}>
          <Flame size={19} className={showHeatmap ? 'text-white' : ''} />
        </button>
        {/* Friends drawer */}
        <button onClick={() => setIsDrawerOpen(v => !v)} aria-label="Autour de moi"
          className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all active:scale-90 shadow-xl ${isDrawerOpen ? 'bg-blue-500 border-blue-400 shadow-blue-500/30' : 'bg-black/65 backdrop-blur-xl border-white/10 text-white/70'}`}>
          <Users size={19} className={isDrawerOpen ? 'text-white' : ''} />
        </button>
        {/* Zoom in */}
        <button onClick={() => handleZoom(1)} aria-label="Zoom avant"
          className="w-11 h-11 rounded-full bg-black/65 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/70 active:scale-90 transition-all shadow-lg">
          <ZoomIn size={18} />
        </button>
        {/* Zoom out */}
        <button onClick={() => handleZoom(-1)} aria-label="Zoom arrière"
          className="w-11 h-11 rounded-full bg-black/65 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/70 active:scale-90 transition-all shadow-lg">
          <ZoomOut size={18} />
        </button>
        {/* Recenter */}
        <button onClick={handleCenter} disabled={coordsLoading} aria-label="Recentrer sur ma position"
          className="w-11 h-11 rounded-full bg-snap-yellow border border-yellow-300 flex items-center justify-center text-black active:scale-90 transition-all shadow-lg shadow-yellow-400/20 disabled:opacity-50">
          {coordsLoading ? <Loader2 className="animate-spin" size={19} /> : <Navigation size={19} fill="black" />}
        </button>
      </div>

      {/* ── Ghost mode banner ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isGhostMode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-[calc(6rem+16px)] left-1/2 -translate-x-1/2 z-20"
          >
            <div className="bg-purple-950/80 border border-purple-500/25 backdrop-blur-xl text-[10px] text-purple-200 font-black px-4 py-2 rounded-full flex items-center gap-2 shadow-lg whitespace-nowrap">
              <Ghost size={11} className="animate-pulse" /> Mode Fantôme Activé — Position masquée
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Friend popup ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeFriend && (
          <div className="absolute inset-0 z-30 pointer-events-none">
            <div className="absolute left-1/2 bottom-[calc(6rem+80px)] -translate-x-1/2 pointer-events-auto">
              <FriendPopup
                friend={activeFriend}
                onClose={() => setActiveFriendPopup(null)}
                onCenter={() => { handleCenterFriend(activeFriend.user_id, activeFriend.username); setActiveFriendPopup(null); }}
                onChat={() => { handleChatFriend(activeFriend.user_id); setActiveFriendPopup(null); }}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Bottom drawer — Autour de moi ─────────────────────────────────── */}
      <div className="absolute bottom-24 inset-x-3 z-20 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {isDrawerOpen && (
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[28px] p-4 pointer-events-auto shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">Autour de moi</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-snap-yellow">
                    {friendLocations.length} ami{friendLocations.length !== 1 ? 's' : ''} visible{friendLocations.length !== 1 ? 's' : ''}
                  </span>
                  <button onClick={() => setIsDrawerOpen(false)} aria-label="Fermer" className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Friends row */}
              <div className="flex gap-3.5 overflow-x-auto scroll-hide pb-1">
                {friendsLoading && <div className="w-full flex items-center justify-center py-3"><Loader2 className="animate-spin text-white/20" size={16} /></div>}
                {!friendsLoading && friends.length === 0 && (
                  <div className="w-full text-center py-3 px-2">
                    <Users size={22} className="text-white/15 mx-auto mb-1.5" />
                    <p className="text-[10px] text-white/30 font-medium">Ajoute des amis pour les voir ici !</p>
                  </div>
                )}
                {!friendsLoading && friends.map(friend => (
                  <button key={friend.friendship_id} onClick={() => handleCenterFriend(friend.user.id, friend.user.username || 'Ami')}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0 active:scale-95 transition-transform">
                    <div className="w-12 h-12 rounded-full p-[2px] ring-2 ring-yellow-400 bg-black relative">
                      {friend.user.avatar_url
                        ? <img src={friend.user.avatar_url} className="w-full h-full rounded-full object-cover" alt={friend.user.username||''} />
                        : <div className="w-full h-full rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-[10px]">{(friend.user.username||'U')[0].toUpperCase()}</div>}
                      {friendLocations.some(f => f.user_id === friend.user.id) && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-black rounded-full" />
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-white/60 truncate max-w-[52px]">{friend.user.username}</span>
                  </button>
                ))}
              </div>

              <div className="h-px bg-white/6 my-3" />

              {/* Stories section */}
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                  <Eye size={11} /> Stories actives
                </p>
                <span className="text-[10px] text-white/35 font-bold">{storyAuthors.length} en ligne</span>
              </div>

              {storiesLoading && <div className="flex items-center justify-center py-4"><Loader2 className="animate-spin text-white/20" size={16} /></div>}

              {!storiesLoading && storyAuthors.length === 0 && (
                <div className="text-center py-4">
                  <ImageOff size={22} className="text-white/15 mx-auto mb-1.5" />
                  <p className="text-[10px] text-white/30 font-medium">Aucune story active pour le moment</p>
                </div>
              )}

              {!storiesLoading && storyAuthors.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {storyAuthors.map(story => {
                    const username = story.users?.username || 'User';
                    const avatarUrl = story.users?.avatar_url;
                    const count = allStories.filter(s => s.user_id === story.user_id).length;
                    return (
                      <button key={story.user_id} onClick={() => { setActiveAuthorId(story.user_id); setStoryStartIndex(0); }}
                        className="bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] rounded-2xl p-2.5 flex flex-col items-center gap-1.5 text-center transition-all active:scale-95">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full story-ring overflow-hidden bg-black flex-shrink-0">
                            {avatarUrl
                              ? <img src={avatarUrl} className="w-full h-full object-cover" alt={username} />
                              : <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-sm">{username[0].toUpperCase()}</div>}
                          </div>
                          {count > 1 && (
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-snap-yellow text-black text-[8px] font-black rounded-full flex items-center justify-center">{count}</span>
                          )}
                        </div>
                        <span className="text-[10px] font-black text-white truncate w-full">{username}</span>
                        <span className="text-[8px] font-bold text-snap-yellow flex items-center gap-0.5"><Play size={7} fill="currentColor" /> Story</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Settings Sheet ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <SettingsSheet
            onClose={() => setShowSettings(false)}
            isGhostMode={isGhostMode}       onToggleGhost={toggleGhostMode}
            showHeatmap={showHeatmap}       onToggleHeatmap={toggleHeatmap}
            showFriendsOnMap={showFriendsOnMap} onToggleFriends={toggleFriends}
            mapStyle={mapStyle}             onChangeStyle={changeStyle}
          />
        )}
      </AnimatePresence>

      {/* ── Story Player ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeAuthorId && authorStories.length > 0 && (
          <StoryPlayer
            stories={authorStories}
            startIndex={storyStartIndex}
            onClose={() => { setActiveAuthorId(null); setStoryStartIndex(0); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
