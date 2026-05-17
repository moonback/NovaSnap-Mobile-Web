import React, { useEffect, useState } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { supabase } from './lib/supabase';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePushNotifications, useNotificationCount, updateAppBadge } from './hooks/usePushNotifications';
import CameraView from './components/camera/CameraView';
import ChatScreen from './screens/ChatScreen';
import StoriesScreen from './screens/StoriesScreen';
import MapScreen from './screens/MapScreen';
import TabBar from './components/navigation/TabBar';
import AuthScreen from './screens/AuthScreen';
import ProfileScreen from './screens/ProfileScreen';
import FriendsScreen from './screens/FriendsScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import MemoriesScreen from './screens/MemoriesScreen';


type ViewKey = 'chat' | 'camera' | 'stories' | 'map';

type Dimensions = {
  width: number;
  height: number;
  isDesktop: boolean;
};


const VIEWS = ['map', 'chat', 'camera', 'stories'] as const;

const isViewKey = (value: string): value is ViewKey =>
  (VIEWS as readonly string[]).includes(value);

const getInitialDimensions = (): Dimensions => {
  if (typeof window === 'undefined') {
    return { width: 390, height: 844, isDesktop: false };
  }

  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const isDesktop = viewportWidth >= 768;

  return {
    width: Math.round(isDesktop ? Math.min(430, viewportWidth) : viewportWidth),
    height: Math.round(isDesktop ? Math.min(932, viewportHeight) : viewportHeight),
    isDesktop,
  };
};

// ── Heartbeat de présence ─────────────────────────────────────
function HeartbeatProvider() {
  useOnlineStatus();
  return null;
}

// ── Gestion des notifications push + badge + navigation SW ───
function NotificationProvider() {
  const { setCurrentView, setDirectChatId, setShowFriends } = useAppStore();
  const { subscribe } = usePushNotifications();
  const { data: unreadCount = 0 } = useNotificationCount();

  // Mettre à jour le badge PWA quand le compteur change
  useEffect(() => {
    updateAppBadge(unreadCount);
  }, [unreadCount]);

  // Demander la permission push au premier chargement (après 3s pour ne pas être intrusif)
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      const timer = setTimeout(() => subscribe(), 3000);
      return () => clearTimeout(timer);
    }
  }, [subscribe]);

  // Écouter les navigations depuis le service worker (clic sur notification)
  useEffect(() => {
    const handleSwNavigate = (e: Event) => {
      const { view, url } = (e as CustomEvent<{ view: string; url: string }>).detail;
      const urlParams = new URLSearchParams(new URL(url, window.location.origin).search);

      switch (view) {
        case 'chat': {
          const convId = urlParams.get('conversation');
          if (convId) setDirectChatId(convId);
          setCurrentView('chat');
          break;
        }
        case 'stories':
          setCurrentView('stories');
          break;
        case 'friends':
          setShowFriends(true);
          break;
        case 'camera':
          setCurrentView('camera');
          break;
      }
    };

    window.addEventListener('sw-navigate', handleSwNavigate);
    return () => window.removeEventListener('sw-navigate', handleSwNavigate);
  }, [setCurrentView, setDirectChatId, setShowFriends]);

  return null;
}

export default function App() {
  const {
    currentView,
    setCurrentView,
    session,
    setSession,
    setUser,
    showProfile,
    showFriends,
    viewingProfileUserId,
    showMemories,
    isEditingSnap,
  } = useAppStore();
  const controls = useAnimation();
  const [isInitializing, setIsInitializing] = useState(true);

  // NOUVEAU: Gestion des dimensions réactives pour le conteneur centré
  const [dimensions, setDimensions] = useState<Dimensions>(getInitialDimensions);

  useEffect(() => {
    let rafId = 0;

    const updateDimensions = () => {
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const isDesktop = viewportWidth >= 768;
      const width = Math.round(isDesktop ? Math.min(430, viewportWidth) : viewportWidth);
      const height = Math.round(isDesktop ? Math.min(932, viewportHeight) : viewportHeight);

      setDimensions((prev) => {
        if (prev.width === width && prev.height === height && prev.isDesktop === isDesktop) {
          return prev;
        }

        return { width, height, isDesktop };
      });
    };

    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateDimensions);
    };

    const visualViewport = window.visualViewport;

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    visualViewport?.addEventListener('resize', handleResize);
    updateDimensions();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  const resolvedIndex = isViewKey(currentView) ? VIEWS.indexOf(currentView) : -1;
  const currentIndex = resolvedIndex >= 0 ? resolvedIndex : 0;

  useEffect(() => {
    if (resolvedIndex < 0) {
      setCurrentView('chat');
    }
  }, [resolvedIndex, setCurrentView]);

  useEffect(() => {
    const checkAndCreateProfile = async (
      u: { id: string; user_metadata?: Record<string, unknown> } | null
    ) => {
      if (!u) return;
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('id')
          .eq('id', u.id)
          .maybeSingle();
        if (!profile) {
          const metadata = u.user_metadata ?? {};
          const username =
            typeof metadata.username === 'string'
              ? metadata.username
              : `user_${u.id.substring(0, 8)}`;
          const display_name =
            typeof metadata.display_name === 'string'
              ? metadata.display_name
              : username;
          const avatar_url =
            typeof metadata.avatar_url === 'string'
              ? metadata.avatar_url
              : `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`;
          await supabase
            .from('users')
            .insert({ id: u.id, username, display_name, avatar_url });
        }
      } catch (err) {
        console.error('Error creating/checking profile:', err);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) checkAndCreateProfile(session.user);
      setTimeout(() => setIsInitializing(false), 2000);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) checkAndCreateProfile(session.user);
    });

    return () => subscription.unsubscribe();
  }, [setSession, setUser]);

  // NOUVEAU: Animation de transition basée sur la largeur calculée du conteneur
  useEffect(() => {
    if (session) {
      controls.start(
        { x: -currentIndex * dimensions.width },
        { type: 'spring', stiffness: 300, damping: 28, mass: 0.9 }
      );
    }
  }, [currentIndex, controls, session, dimensions.width]);

  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center overflow-hidden font-sans z-[9999]">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute -top-32 -left-32 w-[120vw] h-[120vw] max-w-[600px] max-h-[600px] rounded-full opacity-20 blur-[80px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #FFFC00 0%, transparent 70%)' }}
        />

        <div className="flex flex-col items-center z-10">
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-[#FFFC00] to-[#eab308] flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(255,252,0,0.4)]"
          >
            <svg viewBox="0 0 100 100" className="w-14 h-14" fill="none">
              <path
                d="M50 10C28 10 10 28 10 50c0 8 2.5 15.5 6.8 21.6L10 90l18.4-6.8C34.5 87.5 42 90 50 90c22 0 40-18 40-40S72 10 50 10z"
                fill="black"
              />
              <circle cx="35" cy="50" r="5" fill="white" />
              <circle cx="50" cy="50" r="5" fill="white" />
              <circle cx="65" cy="50" r="5" fill="white" />
            </svg>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70"
          >
            NovaSnap
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="absolute bottom-16 flex flex-col items-center gap-3"
          >
            <Loader2 className="animate-spin text-snap-yellow" size={24} />
            <p className="text-white/40 text-[10px] font-bold tracking-widest uppercase">Lancement</p>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <div className="fixed inset-0 screen-shell flex items-center justify-center overflow-hidden font-sans">
      {/* NOUVEAU : Arrière-plan premium pour grand écran (effet de lumière néon jaune) */}
      {dimensions.isDesktop && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-snap-yellow/5 rounded-full blur-[160px]" />
          <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px]" />

          {/* Logo en arrière-plan */}
          <div className="absolute top-10 left-12 flex items-center gap-3 opacity-20 select-none">
            <div className="w-10 h-10 rounded-[12px] bg-snap-yellow flex items-center justify-center shadow-snap">
              <svg viewBox="0 0 100 100" className="w-6 h-6" fill="none">
                <path d="M50 10C28 10 10 28 10 50c0 8 2.5 15.5 6.8 21.6L10 90l18.4-6.8C34.5 87.5 42 90 50 90c22 0 40-18 40-40S72 10 50 10z" fill="black" />
              </svg>
            </div>
            <span className="text-white font-black tracking-wider text-xl">NovaSnap</span>
          </div>
        </div>
      )}

      {/* Heartbeat actif dès que l'utilisateur est connecté */}
      {session && <HeartbeatProvider />}
      {session && <NotificationProvider />}

      {/* NOUVEAU: Conteneur de style mockup iPhone sur Desktop */}
      <div
        className="relative overflow-hidden transition-all duration-300 z-10"
        style={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: dimensions.isDesktop ? '40px' : '0px',
          border: dimensions.isDesktop ? '8px solid #1c1c24' : 'none',
          boxShadow: dimensions.isDesktop
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(255, 252, 0, 0.05)'
            : 'none',
          background: 'linear-gradient(180deg, #070910 0%, #05070d 100%)',
        }}
      >
        {/* NOUVEAU: Dynamic Island factice sur Desktop pour accentuer le look premium */}
        {dimensions.isDesktop && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-center border border-white/5 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-zinc-900 ml-auto mr-4" />
          </div>
        )}

        <motion.div
          className="flex h-full touch-pan-y"
          style={{ width: dimensions.width * VIEWS.length }}
          initial={{ x: -currentIndex * dimensions.width }}
          animate={controls}
          drag="x"
          dragConstraints={{ left: -dimensions.width * (VIEWS.length - 1), right: 0 }}
          dragElastic={0.22}
          onDragEnd={(_e, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);
            if (swipe < -swipeConfidenceThreshold && currentIndex < VIEWS.length - 1) {
              const nextView = VIEWS[currentIndex + 1];
              setCurrentView(nextView);
            } else if (swipe > swipeConfidenceThreshold && currentIndex > 0) {
              const previousView = VIEWS[currentIndex - 1];
              setCurrentView(previousView);
            } else {
              controls.start({ x: -currentIndex * dimensions.width });
            }
          }}
        >
          {/* Map */}
          <div className="h-full flex-shrink-0 screen-shell" style={{ width: dimensions.width }}>
            {Math.abs(currentIndex - 0) <= 1 && <MapScreen />}
          </div>
          {/* Chat */}
          <div className="h-full flex-shrink-0 screen-shell" style={{ width: dimensions.width }}>
            <ChatScreen />
          </div>
          {/* Camera */}
          <div className="h-full flex-shrink-0 screen-shell" style={{ width: dimensions.width }}>
            {Math.abs(currentIndex - 2) <= 1 && (
              <CameraView isActive={currentView === 'camera'} />
            )}
          </div>
          {/* Stories */}
          <div className="h-full flex-shrink-0 screen-shell" style={{ width: dimensions.width }}>
            {Math.abs(currentIndex - 3) <= 1 && <StoriesScreen />}
          </div>
        </motion.div>

        {!isEditingSnap && <TabBar />}

        <AnimatePresence>
          {showProfile && <ProfileScreen key="profile" />}
        </AnimatePresence>

        <AnimatePresence>
          {showFriends && <FriendsScreen key="friends" />}
        </AnimatePresence>

        <AnimatePresence>
          {viewingProfileUserId && <UserProfileScreen key="user-profile" />}
        </AnimatePresence>

        <AnimatePresence>
          {showMemories && <MemoriesScreen key="memories" />}
        </AnimatePresence>
      </div>
    </div>
  );
}

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;
