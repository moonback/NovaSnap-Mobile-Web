import React from 'react';
import { MessageCircle, Camera, PlaySquare } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export default function TabBar() {
  const { currentView, setCurrentView } = useAppStore();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-end justify-around safe-bottom"
      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 70%, transparent 100%)' }}
    >
      <div className="flex items-center justify-around w-full pb-3 pt-2 px-4">
        {/* Chat */}
        <button
          onClick={() => setCurrentView('chat')}
          aria-label="Chat"
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-200 ${
            currentView === 'chat' ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
        >
          <MessageCircle
            size={26}
            strokeWidth={currentView === 'chat' ? 2.5 : 2}
            className={currentView === 'chat' ? 'text-white' : 'text-white'}
            fill={currentView === 'chat' ? 'rgba(255,255,255,0.15)' : 'none'}
          />
          {currentView === 'chat' && (
            <span className="w-1 h-1 rounded-full bg-white" />
          )}
        </button>

        {/* Camera — centre, elevated */}
        <button
          onClick={() => setCurrentView('camera')}
          aria-label="Camera"
          className={`relative -top-2 flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200 ${
            currentView === 'camera'
              ? 'bg-snap-yellow shadow-snap scale-105'
              : 'bg-white/90 hover:bg-white'
          }`}
        >
          <Camera
            size={28}
            strokeWidth={2}
            className={currentView === 'camera' ? 'text-black' : 'text-black'}
          />
        </button>

        {/* Stories */}
        <button
          onClick={() => setCurrentView('stories')}
          aria-label="Stories"
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-200 ${
            currentView === 'stories' ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
        >
          <PlaySquare
            size={26}
            strokeWidth={currentView === 'stories' ? 2.5 : 2}
            className="text-white"
            fill={currentView === 'stories' ? 'rgba(255,255,255,0.15)' : 'none'}
          />
          {currentView === 'stories' && (
            <span className="w-1 h-1 rounded-full bg-white" />
          )}
        </button>
      </div>
    </div>
  );
}
