import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { useTheme } from '../../hooks/useTheme';

// Snapchat-faithful SVG icons — refined stroke weights
const MapIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M9 3L3 6.5V21L9 17.5L15 21L21 17.5V3L15 6.5L9 3Z"
      stroke="currentColor"
      strokeWidth={active ? 2.4 : 1.8}
      strokeLinejoin="round"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.12 : 0}
    />
    <line x1="9" y1="3" x2="9" y2="17.5" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} />
    <line x1="15" y1="6.5" x2="15" y2="21" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} />
  </svg>
);

const ChatIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M21 15C21 15.53 20.79 16.04 20.41 16.41C20.04 16.79 19.53 17 19 17H7L3 21V5C3 4.47 3.21 3.96 3.59 3.59C3.96 3.21 4.47 3 5 3H19C19.53 3 20.04 3.21 20.41 3.59C20.79 3.96 21 4.47 21 5V15Z"
      stroke="currentColor"
      strokeWidth={active ? 2.4 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.15 : 0}
    />
  </svg>
);

const StoriesIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Outer ring */}
    <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}
      fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.1 : 0} />
    {/* Play triangle */}
    <polygon points="10,8.5 16,12 10,15.5"
      fill="currentColor" strokeWidth="0" />
  </svg>
);

const MemoriesIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}
      fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
    <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}
      fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
    <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}
      fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
    <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}
      fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
  </svg>
);

type Tab = {
  id: 'map' | 'chat' | 'camera' | 'stories' | 'memories';
  label: string;
  icon: React.ComponentType<{ active: boolean }>;
};

const TABS: Tab[] = [
  { id: 'map', label: 'Carte', icon: MapIcon },
  { id: 'chat', label: 'Chat', icon: ChatIcon },
  { id: 'camera', label: 'Caméra', icon: StoriesIcon }, // placeholder — camera handled separately
  { id: 'stories', label: 'Stories', icon: StoriesIcon },
  { id: 'memories', label: 'Souvenirs', icon: MemoriesIcon },
];

export default function TabBar() {
  const { currentView, setCurrentView } = useAppStore();
  const t = useTheme();

  const isLight = t.isLight;
  const iconColor = isLight ? '#1a1a1a' : '#ffffff';
  const iconInactiveOpacity = 0.38;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 pointer-events-none">
      {/* Gradient blur overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isLight
            ? 'linear-gradient(to top, rgba(248,249,250,1) 0%, rgba(248,249,250,0.95) 55%, transparent 100%)'
            : 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 55%, transparent 100%)',
        }}
      />

      <div className="relative pointer-events-auto flex items-end justify-around px-3 pb-8 pt-3">

        {/* ── Map ── */}
        <TabButton
          id="map"
          label="Carte"
          active={currentView === 'map'}
          iconColor={iconColor}
          inactiveOpacity={iconInactiveOpacity}
          onClick={() => setCurrentView('map')}
        >
          <MapIcon active={currentView === 'map'} />
        </TabButton>

        {/* ── Chat ── */}
        <TabButton
          id="chat"
          label="Chat"
          active={currentView === 'chat'}
          iconColor={iconColor}
          inactiveOpacity={iconInactiveOpacity}
          onClick={() => setCurrentView('chat')}
        >
          <ChatIcon active={currentView === 'chat'} />
        </TabButton>

        {/* ── Camera (center hero — Snapchat style) ── */}
        <div className="flex flex-col items-center -mt-5 pb-0.5 relative">
          <motion.button
            onClick={() => setCurrentView('camera')}
            aria-label="Caméra"
            whileTap={{ scale: 0.86 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="relative w-[62px] h-[62px] rounded-full flex items-center justify-center"
            style={{
              background: currentView === 'camera'
                ? '#FFFC00'
                : '#ffffff',
              boxShadow: currentView === 'camera'
                ? '0 0 0 3px rgba(255,252,0,0.5), 0 8px 24px rgba(255,252,0,0.35)'
                : '0 0 0 3px rgba(255,255,255,0.2), 0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            {/* Active pulse ring */}
            {currentView === 'camera' && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: '2px solid rgba(255,252,0,0.5)' }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {/* Camera SVG */}
            <svg width="27" height="27" viewBox="0 0 24 24" fill="none">
              <path
                d="M23 19C23 19.53 22.79 20.04 22.41 20.41C22.04 20.79 21.53 21 21 21H3C2.47 21 1.96 20.79 1.59 20.41C1.21 20.04 1 19.53 1 19V8C1 7.47 1.21 6.96 1.59 6.59C1.96 6.21 2.47 6 3 6H7L9 3H15L17 6H21C21.53 6 22.04 6.21 22.41 6.59C22.79 6.96 23 7.47 23 8V19Z"
                fill="black"
                stroke="black"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="4" fill="white" />
              <circle cx="12" cy="13" r="2.2" fill="black" opacity="0.15" />
            </svg>
          </motion.button>

          {/* Camera label */}
          <AnimatePresence>
            {currentView === 'camera' && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="mt-1.5 text-[10px] font-black tracking-wide"
                style={{ color: iconColor }}
              >
                Caméra
              </motion.span>
            )}
            {currentView !== 'camera' && (
              <span className="mt-1.5 w-0 h-[14px]" />
            )}
          </AnimatePresence>
        </div>

        {/* ── Stories ── */}
        <TabButton
          id="stories"
          label="Stories"
          active={currentView === 'stories'}
          iconColor={iconColor}
          inactiveOpacity={iconInactiveOpacity}
          onClick={() => setCurrentView('stories')}
        >
          <StoriesIcon active={currentView === 'stories'} />
        </TabButton>

        {/* ── Memories ── */}
        <TabButton
          id="memories"
          label="Souvenirs"
          active={currentView === 'memories'}
          iconColor={iconColor}
          inactiveOpacity={iconInactiveOpacity}
          onClick={() => setCurrentView('memories')}
        >
          <MemoriesIcon active={currentView === 'memories'} />
        </TabButton>

      </div>
    </div>
  );
}

/* ── Reusable tab button ─────────────────────────────────────── */
type TabButtonProps = {
  id: string;
  label: string;
  active: boolean;
  iconColor: string;
  inactiveOpacity: number;
  onClick: () => void;
  children: React.ReactNode;
};

function TabButton({ id, label, active, iconColor, inactiveOpacity, onClick, children }: TabButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      aria-label={label}
      whileTap={{ scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className="flex flex-col items-center gap-[2px] min-w-[48px] relative"
      style={{ color: iconColor, opacity: active ? 1 : inactiveOpacity }}
    >
      {/* Icon container with subtle active bg */}
      <div className="relative flex items-center justify-center w-10 h-10">
        {active && (
          <motion.div
            layoutId="tab-active-bg"
            className="absolute inset-0 rounded-full"
            style={{ background: 'rgba(255,252,0,0.12)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          />
        )}
        {children}
      </div>

      {/* Label */}
      <AnimatePresence mode="wait">
        {active ? (
          <motion.span
            key={`label-${id}`}
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.12 }}
            className="text-[10px] font-black tracking-wide leading-none"
            style={{ color: iconColor }}
          >
            {label}
          </motion.span>
        ) : (
          <span key={`empty-${id}`} className="h-[12px]" />
        )}
      </AnimatePresence>

      {/* Yellow dot indicator */}
      {active && (
        <motion.span
          layoutId="snap-tab-dot"
          className="w-1 h-1 rounded-full mt-px"
          style={{ backgroundColor: '#FFFC00' }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        />
      )}
    </motion.button>
  );
}
