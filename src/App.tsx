import React, { useEffect, useState } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { useAppStore } from './store/useAppStore';
import { supabase } from './lib/supabase';
import CameraView from './components/camera/CameraView';
import ChatScreen from './screens/ChatScreen';
import StoriesScreen from './screens/StoriesScreen';
import TabBar from './components/navigation/TabBar';
import AuthScreen from './screens/AuthScreen';
import ProfileScreen from './screens/ProfileScreen';

export default function App() {
  const { currentView, setCurrentView, session, setSession, setUser, showProfile } = useAppStore();
  const controls = useAnimation();
  const [isInitializing, setIsInitializing] = useState(true);

  // Index mapping
  const views = ['chat', 'camera', 'stories'];
  const currentIndex = views.indexOf(currentView);

  useEffect(() => {
    const checkAndCreateProfile = async (u: { id: string; user_metadata?: Record<string, unknown> } | null) => {
      if (!u) return;
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('id')
          .eq('id', u.id)
          .maybeSingle();

        if (!profile) {
          const metadata = u.user_metadata ?? {};
          const username = typeof metadata.username === 'string' ? metadata.username : `user_${u.id.substring(0, 8)}`;
          const display_name = typeof metadata.display_name === 'string' ? metadata.display_name : username;
          const avatar_url = typeof metadata.avatar_url === 'string'
            ? metadata.avatar_url
            : `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`;

          await supabase.from('users').insert({
            id: u.id,
            username,
            display_name,
            avatar_url,
          });
        }
      } catch (err) {
        console.error("Error creating/checking profile:", err);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAndCreateProfile(session.user);
      }
      setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAndCreateProfile(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession, setUser]);

  useEffect(() => {
    if (session) {
      controls.start({ x: `${-currentIndex * 100}vw` }, { type: "spring", stiffness: 300, damping: 30 });
    }
  }, [currentIndex, controls, session]);

  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-400 to-purple-500 p-[2px] animate-pulse">
          <div className="w-full h-full bg-black rounded-2xl flex items-center justify-center">
             <span className="text-xl font-black italic text-transparent bg-clip-text bg-gradient-to-tr from-cyan-400 to-purple-500">N</span>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <div className="fixed inset-0 bg-[#050505] overflow-hidden font-sans">
      <motion.div 
        className="flex w-[300vw] h-full touch-pan-y"
        animate={controls}
        drag="x"
        dragConstraints={{ left: -window.innerWidth * 2, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(e, { offset, velocity }) => {
          const swipe = swipePower(offset.x, velocity.x);
          if (swipe < -swipeConfidenceThreshold && currentIndex < 2) {
            setCurrentView(views[currentIndex + 1] as "chat" | "camera" | "stories");
          } else if (swipe > swipeConfidenceThreshold && currentIndex > 0) {
            setCurrentView(views[currentIndex - 1] as "chat" | "camera" | "stories");
          } else {
            controls.start({ x: `${-currentIndex * 100}vw` });
          }
        }}
      >
        <div className="w-[100vw] h-full flex-shrink-0">
          <ChatScreen />
        </div>
        <div className="w-[100vw] h-full flex-shrink-0 relative bg-[#050505]">
          {Math.abs(currentIndex - 1) <= 1 && <CameraView />}
        </div>
        <div className="w-[100vw] h-full flex-shrink-0 bg-[#050505]">
          {Math.abs(currentIndex - 2) <= 1 && <StoriesScreen />}
        </div>
      </motion.div>
      <TabBar />

      <AnimatePresence>
        {showProfile && <ProfileScreen />}
      </AnimatePresence>
    </div>
  );
}

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};
