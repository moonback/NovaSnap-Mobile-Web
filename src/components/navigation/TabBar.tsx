import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { useTheme } from '../../hooks/useTheme';

// Snapchat-faithful SVG icons
const MapIcon = ({ active }: { active: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M9 3L3 6.5V21L9 17.5L15 21L21 17.5V3L15 6.5L9 3Z"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.6}
      strokeLinejoin="round"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.15 : 0}
    />
    <line x1="9" y1="3" x2="9" y2="17.5" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} />
    <line x1="15" y1="6.5" x2="15" y2="21" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} />
  </svg>
);

const ChatIcon = ({ active }: { active: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.18 : 0}
    />
  </svg>
);

const StoriesIcon = ({ active }: { active: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
    <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round" />
  </svg>
);

const MemoriesIcon = ({ active }: { active: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0} />
    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0} />
    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0} />
    <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0} />
  </svg>
);

type Tab = {
  id: 'map' | 'chat' | 'camera' | 'stories' | 'memories';
  label: string;
  icon: React.ComponentType<{ active: boolean }>;
};

const TABS: Tab[] = [
  { id: 'map',      label: 'Carte',      icon: MapIcon },
  { id: 'chat',     label: 'Chat',       icon: ChatIcon },
  { id: 'camera',   label: 'Caméra',     icon: StoriesIcon }, // placeholder — camera handled separately
  { id: 'stories',  label: 'Stories',    icon: StoriesIcon },
  { id: 'memories', label: 'Souvenirs',  icon: MemoriesIcon },
];

export default function TabBar() {
  const { currentView, setCurrentView } = useAppStore();
  const t = useTheme();

  const isLight = t.isLight;
  const iconColor = isLight ? '#0d0e1a' : '#ffffff';
  const iconInactiveOpacity = 0.42;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 pointer-events-none snap-tab-bar">
      <div className="relative pointer-events-auto flex items-end justify-around px-2 pb-7 pt-3">

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

        {/* ── Camera (centre — héros Snapchat) ── */}
        <div className="flex flex-col items-center -mt-4 pb-0.5">
          <motion.button
            onClick={() => setCurrentView('camera')}
            aria-label="Caméra"
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="relative w-[64px] h-[64px] rounded-full flex items-center justify-center"
            style={{
              background: currentView === 'camera' ? '#FFFC00' : '#ffffff',
              boxShadow: currentView === 'camera'
                ? '0 0 0 3.5px rgba(255,252,0,0.3), 0 6px 20px rgba(255,252,0,0.4)'
                : '0 0 0 3.5px rgba(255,255,255,0.18), 0 6px 20px rgba(0,0,0,0.55)',
            }}
          >
            {/* Camera SVG — Snapchat ghost shape */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 3H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z"
                fill="black"
                stroke="black"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="4" fill="white" />
            </svg>
          </motion.button>
          <AnimatePresence>
            {currentView === 'camera' && (
              <motion.span
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                className="mt-1.5 w-1.5 h-1.5 rounded-full bg-snap-yellow"
              />
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
    <button
      onClick={onClick}
      aria-label={label}
      className="flex flex-col items-center gap-[3px] active:scale-90 transition-transform min-w-[44px]"
      style={{ color: iconColor, opacity: active ? 1 : inactiveOpacity }}
    >
      <div className="relative">
        {children}
      </div>

      {/* Label — only shown when active */}
      <AnimatePresence mode="wait">
        {active && (
          <motion.span
            key={`label-${id}`}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="text-[10px] font-black tracking-wide"
            style={{ color: iconColor }}
          >
            {label}
          </motion.span>
        )}
        {!active && (
          <motion.span
            key={`dot-${id}`}
            initial={false}
            className="w-0 h-[10px]"
          />
        )}
      </AnimatePresence>

      {/* Yellow active dot */}
      {active && (
        <motion.span
          layoutId="snap-tab-dot"
          className="w-1 h-1 rounded-full bg-snap-yellow"
        />
      )}
    </button>
  );
}
