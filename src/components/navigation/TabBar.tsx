import React from 'react';
import { Camera as CameraIcon, MessageCircle, PlaySquare } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export default function TabBar() {
  const { currentView, setCurrentView } = useAppStore();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[100px] bg-black/40 backdrop-blur-xl flex items-center justify-around px-8 pb-6 pt-4 z-50 border-t border-white/5">
      <button 
        onClick={() => setCurrentView('chat')}
        className={`flex flex-col items-center p-2 transition-all duration-300 ${currentView === 'chat' ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-white/40 hover:text-white/70'}`}
      >
        <MessageCircle size={28} strokeWidth={currentView === 'chat' ? 2.5 : 2} />
      </button>

      <button 
        onClick={() => setCurrentView('camera')}
        className={`flex flex-col items-center p-2 transition-all duration-300 ${currentView === 'camera' ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-white/40 hover:text-white/70'}`}
      >
        <CameraIcon size={32} strokeWidth={currentView === 'camera' ? 2.5 : 2} />
      </button>

      <button 
        onClick={() => setCurrentView('stories')}
        className={`flex flex-col items-center p-2 transition-all duration-300 ${currentView === 'stories' ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-white/40 hover:text-white/70'}`}
      >
        <PlaySquare size={28} strokeWidth={currentView === 'stories' ? 2.5 : 2} />
      </button>
    </div>
  );
}
