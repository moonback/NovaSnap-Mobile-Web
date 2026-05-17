import React, { useState, useEffect } from 'react';
import { useStories } from '../hooks/useStories';
import { Loader2, X } from 'lucide-react';
import GeminiOrb from '../components/GeminiOrb';
import { useAppStore } from '../store/useAppStore';

export default function StoriesScreen() {
  const { data: stories, isLoading } = useStories();
  const { setCurrentView } = useAppStore();
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);

  // Auto-advance story
  useEffect(() => {
    if (activeStoryIndex !== null && stories && stories.length > 0) {
      const timer = setTimeout(() => {
        if (activeStoryIndex < stories.length - 1) {
          setActiveStoryIndex(activeStoryIndex + 1);
        } else {
          setActiveStoryIndex(null);
        }
      }, 5000); // 5 seconds per story
      return () => clearTimeout(timer);
    }
  }, [activeStoryIndex, stories]);

  return (
    <>
      <div className="w-full h-full bg-[#050505] text-white flex flex-col pt-12 px-4 overflow-y-auto pb-24 gap-6">
        {/* AI Section from design HTML */}
        <div className="glass rounded-3xl p-6 flex flex-col gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 neon-glow"></div>
            <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-tighter">Gemini Live AI</h3>
          </div>
          
          <GeminiOrb />

          <div className="p-4 glass-dark rounded-2xl border border-white/5">
            <p className="text-[11px] leading-relaxed text-white/60 italic">"Analyze my view and tell me what you see..." (Coming soon)</p>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold mb-4 mx-2">Stories</h1>
          <div className="flex gap-4 overflow-x-auto scroll-hide pb-2">
            {/* Add Story Button */}
            <div onClick={() => setCurrentView('camera')} className="flex-shrink-0 w-24 space-y-2 cursor-pointer">
              <div className="aspect-[9/16] bg-white/5 rounded-2xl relative overflow-hidden border border-white/20 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors">
                <span className="text-3xl font-light text-white/40">+</span>
              </div>
              <p className="text-xs text-center font-medium truncate text-white/60">Add Story</p>
            </div>

            {isLoading && (
              <div className="flex-shrink-0 w-24 aspect-[9/16] flex items-center justify-center">
                <Loader2 className="animate-spin text-white/40" />
              </div>
            )}

            {stories?.map((story, index) => (
               <div key={story.id} className="flex-shrink-0 w-24 space-y-2" onClick={() => setActiveStoryIndex(index)}>
                <div className="aspect-[9/16] rounded-2xl cursor-pointer relative overflow-hidden border-2 border-cyan-400 bg-black">
                  {story.media_type === 'IMAGE' ? (
                    <img src={story.media_url} className="w-full h-full object-cover" alt="Thumbnail" />
                  ) : (
                    <video src={story.media_url} muted playsInline className="w-full h-full object-cover" />
                  )}
                  {story.media_type === 'VIDEO' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-6 h-6 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white">
                        <span className="text-[10px]">▶</span>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-center font-medium truncate">{story.users?.username || 'User'}</p>
              </div>
            ))}

            {/* Placeholder for Stories if empty */}
            {!isLoading && stories?.length === 0 && (
              <>
                <div className="flex-shrink-0 w-24 space-y-2">
                  <div className="aspect-[9/16] bg-gradient-to-b from-purple-500 to-pink-500 rounded-2xl relative overflow-hidden border border-white/20">
                  </div>
                  <p className="text-xs text-center font-medium truncate">My Story (Demo)</p>
                </div>
                <div className="flex-shrink-0 w-24 space-y-2 opacity-60">
                  <div className="aspect-[9/16] bg-gray-800 rounded-2xl relative overflow-hidden border border-white/10">
                  </div>
                  <p className="text-xs text-center font-medium truncate">Lena K.</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Story Viewer */}
      {activeStoryIndex !== null && stories?.[activeStoryIndex] && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col">
          {/* Progress bar */}
          <div className="absolute top-4 inset-x-4 flex gap-1 z-10">
            {stories.map((_, idx) => (
              <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                {idx === activeStoryIndex ? (
                   <div className="h-full bg-white animate-[progress_5s_linear_forwards]" />
                ) : idx < activeStoryIndex ? (
                   <div className="h-full bg-white" />
                ) : null}
              </div>
            ))}
          </div>

          <div className="absolute top-8 right-4 z-10">
            <button onClick={() => setActiveStoryIndex(null)} className="p-2 bg-black/40 rounded-full text-white/80 hover:text-white">
              <X size={24} />
            </button>
          </div>

          {stories[activeStoryIndex].media_type === 'IMAGE' ? (
             <img src={stories[activeStoryIndex].media_url} className="w-full h-full object-cover" alt="Story" />
          ) : (
             <video src={stories[activeStoryIndex].media_url} autoPlay playsInline className="w-full h-full object-cover" />
          )}

          <div className="absolute bottom-12 inset-x-0 p-6 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent">
             <h2 className="text-white font-bold text-xl drop-shadow-md">{stories[activeStoryIndex].users?.username || 'User'}</h2>
             <p className="text-white/60 text-sm">{new Date(stories[activeStoryIndex].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>

          {/* Tap zones for navigation */}
          <div 
            className="absolute inset-y-0 left-0 w-1/3 z-20" 
            onClick={() => setActiveStoryIndex(activeStoryIndex > 0 ? activeStoryIndex - 1 : activeStoryIndex)}
          />
          <div 
            className="absolute inset-y-0 right-0 w-1/3 z-20" 
            onClick={() => setActiveStoryIndex(activeStoryIndex < stories.length - 1 ? activeStoryIndex + 1 : activeStoryIndex)}
          />
        </div>
      )}
    </>
  );
}

