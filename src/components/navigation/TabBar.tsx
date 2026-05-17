import React from 'react';
import { MessageCircle, Camera, Play, Compass, Images } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { useTheme } from '../../hooks/useTheme';

const tabs = [
  { key: 'map', label: 'Carte', Icon: Compass },
  { key: 'chat', label: 'Chat', Icon: MessageCircle },
  { key: 'stories', label: 'Stories', Icon: Play },
] as const;

export default function TabBar() {
  const { currentView, setCurrentView, showMemories, setShowMemories } = useAppStore();
  const t = useTheme();

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(18px,env(safe-area-inset-bottom))] pointer-events-none">
      <div className="absolute inset-x-0 bottom-0 h-44 app-bottom-fade" />

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative pointer-events-auto mx-auto max-w-[420px]"
      >
        <div className="glass-floating-nav rounded-[30px] px-4 py-3">
          <div className="flex items-center justify-between">
            {tabs.slice(0, 2).map(({ key, label, Icon }) => {
              const active = currentView === key;
              return (
                <button
                  key={key}
                  onClick={() => setCurrentView(key)}
                  aria-label={label}
                  className="relative flex min-w-[58px] flex-col items-center gap-1 py-1"
                >
                  {active && <motion.span layoutId="nav-pill" className="tab-pill" />}
                  <Icon size={22} className={active ? 'relative text-white' : 'relative text-white/45'} strokeWidth={active ? 2.4 : 1.9} />
                  <span className={active ? 'text-[10px] font-semibold text-white' : 'text-[10px] font-medium text-white/45'}>{label}</span>
                </button>
              );
            })}

            <motion.button
              onClick={() => setCurrentView('camera')}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 360, damping: 20 }}
              className="relative -mt-8 flex h-[72px] w-[72px] items-center justify-center rounded-full camera-fab"
              aria-label="Caméra"
            >
              <span className="camera-fab-inner" />
              <Camera size={30} strokeWidth={2.3} className="relative z-10 text-black" />
            </motion.button>

            <button
              onClick={() => setCurrentView('stories')}
              aria-label="Stories"
              className="relative flex min-w-[58px] flex-col items-center gap-1 py-1"
            >
              {currentView === 'stories' && <motion.span layoutId="nav-pill" className="tab-pill" />}
              <Play size={22} className={currentView === 'stories' ? 'relative text-white' : 'relative text-white/45'} strokeWidth={currentView === 'stories' ? 2.4 : 1.9} />
              <span className={currentView === 'stories' ? 'text-[10px] font-semibold text-white' : 'text-[10px] font-medium text-white/45'}>Stories</span>
            </button>

            <button
              onClick={() => setShowMemories(true)}
              aria-label="Memories"
              className="relative flex min-w-[58px] flex-col items-center gap-1 py-1"
            >
              {showMemories && <motion.span layoutId="nav-pill" className="tab-pill" />}
              <Images size={22} className={showMemories ? 'relative text-white' : 'relative text-white/45'} strokeWidth={showMemories ? 2.4 : 1.9} />
              <span className={showMemories ? 'text-[10px] font-semibold text-white' : 'text-[10px] font-medium text-white/45'}>Memories</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
