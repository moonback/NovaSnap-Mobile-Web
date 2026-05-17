import React, { useEffect, useState } from 'react';
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

  const views = ['chat', 'camera', 'stories'];
  const currentIndex = views.indexOf(currentView);

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

  useEffect(() => {
    if (session) {
      controls.start(
        { x: `${-currentIndex * 100}vw` },
        { type: 'spring', stiffness: 300, damping: 30 }
      );
    }
  }, [currentIndex, controls, session]);

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
    <div className="fixed inset-0 bg-black overflow-hidden font-sans">
      {/* Heartbeat actif dès que l'utilisateur est connecté */}
      {session && <HeartbeatProvider />}
      {session && <NotificationProvider />}

      <motion.div
        className="flex w-[300vw] h-full touch-pan-y"
        animate={controls}
        drag="x"
        dragConstraints={{ left: -window.innerWidth * 2, right: 0 }}
        dragElastic={0.15}
        onDragEnd={(_e, { offset, velocity }) => {
          const swipe = swipePower(offset.x, velocity.x);
          if (swipe < -swipeConfidenceThreshold && currentIndex < 2) {
            setCurrentView(views[currentIndex + 1] as 'chat' | 'camera' | 'stories');
          } else if (swipe > swipeConfidenceThreshold && currentIndex > 0) {
            setCurrentView(views[currentIndex - 1] as 'chat' | 'camera' | 'stories');
          } else {
            controls.start({ x: `${-currentIndex * 100}vw` });
          }
        }}
      >
        {/* Chat */}
        <div className="w-[100vw] h-full flex-shrink-0 bg-black">
          <ChatScreen />
        </div>
        {/* Camera */}
        <div className="w-[100vw] h-full flex-shrink-0 bg-black">
          {Math.abs(currentIndex - 1) <= 1 && (
            <CameraView isActive={currentView === 'camera'} />
          )}
        </div>
        {/* Stories */}
        <div className="w-[100vw] h-full flex-shrink-0 bg-black">
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
  );
}

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;
