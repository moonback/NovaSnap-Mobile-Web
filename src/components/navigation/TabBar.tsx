import React from 'react';
import { Camera as CameraIcon, MessageCircle, PlaySquare } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export default function TabBar() {
  const { currentView, setCurrentView } = useAppStore();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[100px] bg-black/30 backdrop-blur-2xl flex items-center justify-around px-8 pb-6 pt-4 z-40 border-t border-white/5">
      <button 
        onClick={() => setCurrentView('chat')}
        className={`flex flex-col items-center p-3 rounded-2xl transition-all duration-300 relative ${
          currentView === 'chat' 
            ? 'text-cyan-400 scale-110 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)] bg-cyan-400/10' 
            : 'text-white/40 hover:text-white/70 hover:bg-white/5'
        }`}
      >
        <MessageCircle size={28} strokeWidth={currentView === 'chat' ? 2.5 : 2} />
        {currentView === 'chat' && <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />}
      </button>

      <button 
        onClick={() => setCurrentView('camera')}
        className={`flex flex-col items-center p-4 rounded-full transition-all duration-300 relative -top-3 shadow-xl ${
          currentView === 'camera' 
            ? 'text-cyan-400 bg-cyan-500/20 border-2 border-cyan-400 scale-110 drop-shadow-[0_0_16px_rgba(34,211,238,0.7)]' 
            : 'text-white/60 bg-white/5 border border-white/10 hover:text-white hover:bg-white/10'
        }`}
      >
        <CameraIcon size={34} strokeWidth={currentView === 'camera' ? 2.5 : 2} />
      </button>

      <button 
        onClick={() => setCurrentView('stories')}
        className={`flex flex-col items-center p-3 rounded-2xl transition-all duration-300 relative ${
          currentView === 'stories' 
            ? 'text-cyan-400 scale-110 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)] bg-cyan-400/10' 
            : 'text-white/40 hover:text-white/70 hover:bg-white/5'
        }`}
      >
        <PlaySquare size={28} strokeWidth={currentView === 'stories' ? 2.5 : 2} />
        {currentView === 'stories' && <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />}
      </button>
    </div>
  );
}
