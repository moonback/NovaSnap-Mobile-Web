import React, { useEffect, useMemo, useState } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { useAppStore } from './store/useAppStore';
import { supabase } from './lib/supabase';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePushNotifications, useNotificationCount, updateAppBadge } from './hooks/usePushNotifications';
import CameraView from './components/camera/CameraView';
import ChatScreen from './screens/ChatScreen';
import StoriesScreen from './screens/StoriesScreen';
import TabBar from './components/navigation/TabBar';
import AuthScreen from './screens/AuthScreen';
import ProfileScreen from './screens/ProfileScreen';
import FriendsScreen from './screens/FriendsScreen';
import UserProfileScreen from './screens/UserProfileScreen';


type ViewKey = 'chat' | 'camera' | 'stories';

type Dimensions = {
  width: number;
  height: number;
  isDesktop: boolean;
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
  } = useAppStore();
  const controls = useAnimation();
  const [isInitializing, setIsInitializing] = useState(true);
  
  // NOUVEAU: Gestion des dimensions réactives pour le conteneur centré
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: typeof window !== 'undefined' ? window.innerWidth : 390,
    height: typeof window !== 'undefined' ? window.innerHeight : 844,
    isDesktop: false
  });

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

  const views = useMemo(() => ['chat', 'camera', 'stories'] as const, []);
  const resolvedIndex = views.indexOf(currentView as ViewKey);
  const currentIndex = resolvedIndex >= 0 ? resolvedIndex : 0;

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
      setIsInitializing(false);
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
        { type: 'spring', stiffness: 350, damping: 32 }
      );
    }
  }, [currentIndex, controls, session, dimensions.width]);

  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-[22px] bg-snap-yellow flex items-center justify-center shadow-snap animate-pulse">
            <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none">
              <path
                d="M50 10C28 10 10 28 10 50c0 8 2.5 15.5 6.8 21.6L10 90l18.4-6.8C34.5 87.5 42 90 50 90c22 0 40-18 40-40S72 10 50 10z"
                fill="black"
              />
              <circle cx="35" cy="50" r="5" fill="white" />
              <circle cx="50" cy="50" r="5" fill="white" />
              <circle cx="65" cy="50" r="5" fill="white" />
            </svg>
          </div>
          <p className="text-white/30 text-sm font-medium">NovaSnap</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <div className="fixed inset-0 bg-[#07070a] flex items-center justify-center overflow-hidden font-sans">
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
          background: '#000',
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
          style={{ width: dimensions.width * 3 }}
          animate={controls}
          drag="x"
          dragConstraints={{ left: -dimensions.width * 2, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_e, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);
            if (swipe < -swipeConfidenceThreshold && currentIndex < 2) {
              setCurrentView(views[currentIndex + 1]);
            } else if (swipe > swipeConfidenceThreshold && currentIndex > 0) {
              setCurrentView(views[currentIndex - 1]);
            } else {
              controls.start({ x: -currentIndex * dimensions.width });
            }
          }}
        >
          {/* Chat */}
          <div className="h-full flex-shrink-0 bg-black" style={{ width: dimensions.width }}>
            <ChatScreen />
          </div>
          {/* Camera */}
          <div className="h-full flex-shrink-0 bg-black" style={{ width: dimensions.width }}>
            {Math.abs(currentIndex - 1) <= 1 && (
              <CameraView isActive={currentView === 'camera'} />
            )}
          </div>
          {/* Stories */}
          <div className="h-full flex-shrink-0 bg-black" style={{ width: dimensions.width }}>
            {Math.abs(currentIndex - 2) <= 1 && <StoriesScreen />}
          </div>
        </motion.div>

        <TabBar />

        <AnimatePresence>
          {showProfile && <ProfileScreen key="profile" />}
        </AnimatePresence>

        <AnimatePresence>
          {showFriends && <FriendsScreen key="friends" />}
        </AnimatePresence>

        <AnimatePresence>
          {viewingProfileUserId && <UserProfileScreen key="user-profile" />}
        </AnimatePresence>
      </div>
    </div>
  );
}

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;
