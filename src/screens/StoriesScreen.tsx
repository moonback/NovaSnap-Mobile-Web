import React, { useState, useEffect } from 'react';
import { useStories } from '../hooks/useStories';
import { X, Plus, Zap } from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import GeminiOrb from '../components/GeminiOrb';
import { useAppStore } from '../store/useAppStore';

export default function StoriesScreen() {
  const { data: stories, isLoading } = useStories();
  const { setCurrentView } = useAppStore();
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});
  const [showAI, setShowAI] = useState(false);

  useEffect(() => {
    if (activeStoryIndex !== null && stories && stories.length > 0) {
      const timer = setTimeout(() => {
        if (activeStoryIndex < stories.length - 1) {
          setActiveStoryIndex(activeStoryIndex + 1);
        } else {
          setActiveStoryIndex(null);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeStoryIndex, stories]);

  return (
    <>
      <div className="w-full h-full bg-black text-white flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-14 pb-4">
          <h1 className="text-xl font-black tracking-tight">Stories</h1>
          <button
            onClick={() => setShowAI(!showAI)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              showAI ? 'bg-snap-yellow text-black shadow-snap-sm' : 'bg-white/10 text-white/70'
            }`}
          >
            <Zap size={13} />
            Nova AI
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-hide pb-28">
          {/* AI Section */}
          {showAI && (
            <div className="mx-4 mb-5 rounded-3xl overflow-hidden border border-white/8 bg-white/3">
              <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-snap-yellow animate-pulse" />
                <span className="text-xs font-bold text-snap-yellow uppercase tracking-wider">Gemini Live AI</span>
              </div>
              <GeminiOrb />
              <div className="px-4 pb-4">
                <p className="text-[11px] text-white/40 italic text-center">
                  "Analyse ma vue et dis-moi ce que tu vois..." (Bientôt disponible)
                </p>
              </div>
            </div>
          )}

          {/* Stories row */}
          <div className="px-4 mb-6">
            <div className="flex gap-3 overflow-x-auto scroll-hide pb-1">
              {/* Add Story */}
              <button
                onClick={() => setCurrentView('camera')}
                className="flex-shrink-0 flex flex-col items-center gap-2"
              >
                <div className="w-[72px] h-[72px] rounded-full bg-white/8 border-2 border-dashed border-white/20 flex items-center justify-center hover:bg-white/12 transition-colors">
                  <Plus size={24} className="text-white/50" />
                </div>
                <span className="text-[11px] text-white/50 font-medium">Ma story</span>
              </button>

              {isLoading && [...Array(4)].map((_, i) => (
                <div key={`sk-${i}`} className="flex-shrink-0 flex flex-col items-center gap-2">
                  <Skeleton className="w-[72px] h-[72px] rounded-full" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              ))}

              {stories?.map((story, index) => {
                const isFailed = failedUrls[story.media_url];
                const username = story.users?.username || 'User';
                return (
                  <button
                    key={story.id}
                    onClick={() => setActiveStoryIndex(index)}
                    className="flex-shrink-0 flex flex-col items-center gap-2"
                  >
                    <div className="w-[72px] h-[72px] rounded-full p-[2px] story-ring">
                      <div className="w-full h-full rounded-full overflow-hidden bg-black border-2 border-black">
                        {isFailed ? (
                          <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                            <span className="text-[9px] text-white/30 font-bold uppercase">Exp.</span>
                          </div>
                        ) : story.media_type === 'IMAGE' ? (
                          <img
                            src={story.media_url}
                            className="w-full h-full object-cover"
                            alt={username}
                            onError={() => setFailedUrls((prev) => ({ ...prev, [story.media_url]: true }))}
                          />
                        ) : (
                          <video
                            src={story.media_url}
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                            onError={() => setFailedUrls((prev) => ({ ...prev, [story.media_url]: true }))}
                          />
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-white/70 font-medium truncate max-w-[72px]">{username}</span>
                  </button>
                );
              })}

              {!isLoading && stories?.length === 0 && (
                <div className="flex items-center justify-center min-w-[200px] py-4">
                  <p className="text-sm text-white/30">Aucune story active</p>
                </div>
              )}
            </div>
          </div>

          {/* Discover section */}
          <div className="px-4">
            <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-3">Découvrir</h2>
            <div className="grid grid-cols-2 gap-2">
              {isLoading && [...Array(4)].map((_, i) => (
                <Skeleton key={`dsk-${i}`} className="aspect-[9/16] rounded-2xl" />
              ))}
              {stories?.map((story, index) => {
                const isFailed = failedUrls[story.media_url];
                return (
                  <button
                    key={`grid-${story.id}`}
                    onClick={() => setActiveStoryIndex(index)}
                    className="aspect-[9/16] rounded-2xl overflow-hidden relative bg-zinc-900"
                  >
                    {!isFailed && story.media_type === 'IMAGE' && (
                      <img src={story.media_url} className="w-full h-full object-cover" alt="" onError={() => setFailedUrls((prev) => ({ ...prev, [story.media_url]: true }))} />
                    )}
                    {!isFailed && story.media_type === 'VIDEO' && (
                      <video src={story.media_url} muted playsInline className="w-full h-full object-cover" onError={() => setFailedUrls((prev) => ({ ...prev, [story.media_url]: true }))} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-white text-xs font-bold truncate">{story.users?.username || 'User'}</p>
                    </div>
                  </button>
                );
              })}
              {!isLoading && stories?.length === 0 && (
                <div className="col-span-2 py-8 text-center">
                  <p className="text-white/30 text-sm">Poste ta première story depuis la caméra</p>
                  <button
                    onClick={() => setCurrentView('camera')}
                    className="mt-3 px-5 py-2.5 bg-snap-yellow text-black font-black rounded-full text-sm shadow-snap-sm active:scale-95 transition-all"
                  >
                    Ouvrir la caméra
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Story Viewer */}
      {activeStoryIndex !== null && stories?.[activeStoryIndex] && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col">
          {/* Progress bars */}
          <div className="absolute top-0 inset-x-0 pt-12 px-3 flex gap-1 z-10">
            {stories.map((_, idx) => (
              <div key={idx} className="h-[3px] flex-1 bg-white/25 rounded-full overflow-hidden">
                {idx === activeStoryIndex ? (
                  <div className="h-full bg-white rounded-full animate-[progress_5s_linear_forwards]" />
                ) : idx < activeStoryIndex ? (
                  <div className="h-full bg-white rounded-full" />
                ) : null}
              </div>
            ))}
          </div>

          {/* Story header */}
          <div className="absolute top-16 inset-x-0 px-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-snap-yellow">
                {stories[activeStoryIndex].users?.avatar_url ? (
                  <img src={stories[activeStoryIndex].users!.avatar_url!} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-xs">
                    {(stories[activeStoryIndex].users?.username || 'U').substring(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">{stories[activeStoryIndex].users?.username || 'User'}</p>
                <p className="text-white/50 text-xs">{new Date(stories[activeStoryIndex].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
            <button onClick={() => setActiveStoryIndex(null)} className="w-9 h-9 rounded-full glass-dark flex items-center justify-center text-white">
              <X size={20} />
            </button>
          </div>

          {/* Media */}
          {failedUrls[stories[activeStoryIndex].media_url] ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-zinc-950">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/30 text-2xl font-bold">!</div>
              <p className="text-white font-bold">Story expirée</p>
              <p className="text-white/40 text-xs">Ce contenu n'est plus disponible</p>
            </div>
          ) : stories[activeStoryIndex].media_type === 'IMAGE' ? (
            <img
              src={stories[activeStoryIndex].media_url}
              className="w-full h-full object-cover"
              alt="Story"
              onError={() => setFailedUrls((prev) => ({ ...prev, [stories[activeStoryIndex].media_url]: true }))}
            />
          ) : (
            <video
              src={stories[activeStoryIndex].media_url}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              onError={() => setFailedUrls((prev) => ({ ...prev, [stories[activeStoryIndex].media_url]: true }))}
            />
          )}

          {/* Tap zones */}
          <div className="absolute inset-y-0 left-0 w-1/3 z-20" onClick={() => setActiveStoryIndex(activeStoryIndex > 0 ? activeStoryIndex - 1 : activeStoryIndex)} />
          <div className="absolute inset-y-0 right-0 w-1/3 z-20" onClick={() => setActiveStoryIndex(activeStoryIndex < stories.length - 1 ? activeStoryIndex + 1 : activeStoryIndex)} />
        </div>
      )}
    </>
  );
}
