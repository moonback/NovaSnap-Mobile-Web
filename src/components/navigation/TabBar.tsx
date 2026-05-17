import React from 'react';
import { MessageCircle, Camera, Play, Compass, Images } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { useTheme } from '../../hooks/useTheme';

export default function TabBar() {
  const { currentView, setCurrentView, showMemories, setShowMemories } = useAppStore();
  const t = useTheme();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      {/* Gradient de fond */}
      <div
        className="absolute inset-0"
        style={{
          background: t.tabGradient,
        }}
      />

      {/* Barre de navigation */}
      <div className="relative pointer-events-auto flex items-end justify-between px-6 pb-8 pt-6">

        {/* ── Carte ── */}
        <button
          onClick={() => setCurrentView('map')}
          aria-label="Carte"
          className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
        >
          <div className="relative">
            <Compass
              size={27}
              strokeWidth={currentView === 'map' ? 2.5 : 1.8}
              className={`transition-all duration-200 ${
                currentView === 'map' ? t.tabActive : t.tabInactive
              }`}
              fill={currentView === 'map' ? 'rgba(255,255,255,0.12)' : 'none'}
            />
          </div>
          <span
            className={`text-[10px] font-bold tracking-wide transition-all duration-200 ${
                currentView === 'map' ? t.tabActive : t.tabInactive
            }`}
          >
            Carte
          </span>
          {currentView === 'map' && (
            <motion.span
              layoutId="tab-dot"
              className={`w-1 h-1 rounded-full ${t.tabDot}`}
            />
          )}
        </button>

        {/* ── Chat ── */}
        <button
          onClick={() => setCurrentView('chat')}
          aria-label="Chat"
          className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
        >
          <div className="relative">
            <MessageCircle
              size={27}
              strokeWidth={currentView === 'chat' ? 2.5 : 1.8}
              className={`transition-all duration-200 ${
                currentView === 'chat' ? t.tabActive : t.tabInactive
              }`}
              fill={currentView === 'chat' ? 'rgba(255,255,255,0.12)' : 'none'}
            />
          </div>
          <span
            className={`text-[10px] font-bold tracking-wide transition-all duration-200 ${
                currentView === 'chat' ? t.tabActive : t.tabInactive
            }`}
          >
            Chat
          </span>
          {currentView === 'chat' && (
            <motion.span
              layoutId="tab-dot"
              className={`w-1 h-1 rounded-full ${t.tabDot}`}
            />
          )}
        </button>

        {/* ── Caméra (centre, surélevé) ── */}
        <div className="flex flex-col items-center -mt-6">
          <motion.button
            onClick={() => setCurrentView('camera')}
            aria-label="Caméra"
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className={`relative w-[68px] h-[68px] rounded-full flex items-center justify-center transition-colors duration-200 ${
              currentView === 'camera'
                ? 'bg-snap-yellow'
                : 'bg-white'
            }`}
            style={{
              boxShadow:
                currentView === 'camera'
                  ? '0 0 0 4px rgba(255,252,0,0.25), 0 8px 24px rgba(255,252,0,0.35)'
                  : '0 0 0 4px rgba(255,255,255,0.15), 0 8px 20px rgba(0,0,0,0.5)',
            }}
          >
            <Camera
              size={30}
              strokeWidth={2}
              className="text-black"
            />
          </motion.button>
          <span
            className={`mt-2 text-[10px] font-bold tracking-wide transition-all duration-200 ${
              currentView === 'camera' ? 'text-snap-yellow' : t.tabInactive
            }`}
          >
            Caméra
          </span>
        </div>

        {/* ── Stories ── */}
        <button
          onClick={() => setCurrentView('stories')}
          aria-label="Stories"
          className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
        >
          <Play
            size={27}
            strokeWidth={currentView === 'stories' ? 2.5 : 1.8}
            className={`transition-all duration-200 ${
              currentView === 'stories' ? t.tabActive : t.tabInactive
            }`}
            fill={currentView === 'stories' ? 'rgba(255,255,255,0.12)' : 'none'}
          />
          <span
            className={`text-[10px] font-bold tracking-wide transition-all duration-200 ${
              currentView === 'stories' ? t.tabActive : t.tabInactive
            }`}
          >
            Stories
          </span>
          {currentView === 'stories' && (
            <motion.span
              layoutId="tab-dot"
              className={`w-1 h-1 rounded-full ${t.tabDot}`}
            />
          )}
        </button>

        {/* ── Memories ── */}
        <button
          onClick={() => setShowMemories(true)}
          aria-label="Memories"
          className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
        >
          <Images
            size={27}
            strokeWidth={showMemories ? 2.5 : 1.8}
            className={`transition-all duration-200 ${
              showMemories ? t.tabActive : t.tabInactive
            }`}
            fill={showMemories ? 'rgba(255,255,255,0.12)' : 'none'}
          />
          <span
            className={`text-[10px] font-bold tracking-wide transition-all duration-200 ${
              showMemories ? t.tabActive : t.tabInactive
            }`}
          >
            Memories
          </span>
          {showMemories && (
            <motion.span
              layoutId="tab-dot"
              className={`w-1 h-1 rounded-full ${t.tabDot}`}
            />
          )}
        </button>
      </div>
    </div>
  );
}
