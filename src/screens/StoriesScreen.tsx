import React, { useState, useEffect } from 'react';
import { useStories } from '../hooks/useStories';
import { X, Plus, Zap, Trash2, Loader2, Eye } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/ToastProvider';
import { motion, AnimatePresence } from 'framer-motion';
import Skeleton from '../components/ui/Skeleton';
import GeminiOrb from '../components/GeminiOrb';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../hooks/useTheme';

type StoryViewer = {
  viewer_id: string;
  viewed_at: string;
  users: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export default function StoriesScreen() {
  const { data: stories, isLoading } = useStories();
  const { setCurrentView } = useAppStore();
  const t = useTheme();
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number>(0);
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});
  const [showAI, setShowAI] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [currentStoryViewers, setCurrentStoryViewers] = useState<StoryViewer[]>([]);
  const [storyViewCounts, setStoryViewCounts] = useState<Record<string, number>>({});

  const queryClient = useQueryClient();
  const { user } = useAppStore();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [storyToDeleteId, setStoryToDeleteId] = useState<string | null>(null);

  // Charger les compteurs de vues pour toutes les stories
  useEffect(() => {
    if (!stories || stories.length === 0) return;
    
    const loadViewCounts = async () => {
      try {
        const storyIds = stories.map(s => s.id);
        const { data, error } = await supabase
          .from('story_views')
          .select('story_id')
          .in('story_id', storyIds);
        
        if (error) throw error;
        
        // Compter les vues par story
        const counts: Record<string, number> = {};
        data?.forEach(view => {
          counts[view.story_id] = (counts[view.story_id] || 0) + 1;
        });
        setStoryViewCounts(counts);
      } catch (err) {
        console.error('[StoryViews] Error loading view counts:', err);
      }
    };
    
    loadViewCounts();
  }, [stories]);

  const totalStories = stories?.length ?? 0;
  const uniqueCreators = stories ? new Set(stories.map((story) => story.user_id)).size : 0;
  const hasStories = totalStories > 0;

  // Stories triées par popularité (nombre de vues) pour la section Découvrir
  const trendingStories = React.useMemo(() => {
    if (!stories) return [];
    const now = new Date().getTime();
    
    return [...stories]
      .filter(story => {
        const isExpired = new Date(story.expires_at).getTime() <= now;
        return !isExpired && !failedUrls[story.media_url];
      })
      .sort((a, b) => {
        // Tri par nombre de vues (décroissant)
        const viewsA = storyViewCounts[a.id] || 0;
        const viewsB = storyViewCounts[b.id] || 0;
        if (viewsB !== viewsA) return viewsB - viewsA;
        // Si égalité, trier par date (plus récent d'abord)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [stories, storyViewCounts, failedUrls]);

  // Grouper les stories par utilisateur chronologiquement (de la plus ancienne à la plus récente)
  const groupedStories = React.useMemo(() => {
    if (!stories) return [];
    const groups: Record<string, {
      user_id: string;
      username: string;
      avatar_url: string | null;
      stories: typeof stories;
    }> = {};

    const now = new Date().getTime();

    // Trier les stories par date croissante afin qu'elles défilent dans l'ordre chronologique de publication
    const sortedStories = [...stories].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (const story of sortedStories) {
      // Ignorer les stories expirées localement ou dont le média a échoué
      const isExpired = new Date(story.expires_at).getTime() <= now;
      if (isExpired || failedUrls[story.media_url]) {
        continue;
      }

      const userId = story.user_id;
      if (!groups[userId]) {
        groups[userId] = {
          user_id: userId,
          username: story.users?.username || 'User',
          avatar_url: story.users?.avatar_url || null,
          stories: [],
        };
      }
      groups[userId].stories.push(story);
    }

    // Trier les groupes par date de publication de leur story la plus récente (ordre décroissant)
    return Object.values(groups)
      .filter((g) => g.stories.length > 0)
      .sort((a, b) => {
        const latestA = new Date(a.stories[a.stories.length - 1].created_at).getTime();
        const latestB = new Date(b.stories[b.stories.length - 1].created_at).getTime();
        return latestB - latestA;
      });
  }, [stories, failedUrls]);

  const handleOpenStoryFromGrid = (storyId: string) => {
    const groupIdx = groupedStories.findIndex((g) => g.stories.some((s) => s.id === storyId));
    if (groupIdx !== -1) {
      const storyIdx = groupedStories[groupIdx].stories.findIndex((s) => s.id === storyId);
      setActiveGroupIndex(groupIdx);
      setActiveStoryIndex(storyIdx);
    }
  };

  const handleDeleteStory = async (storyId: string, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Évite que le clic ne passe à la story suivante
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId);

      if (error) throw error;

      toast('Story supprimée avec succès !', 'success');
      setStoryToDeleteId(null);
      setActiveGroupIndex(null);
      setActiveStoryIndex(0);
      queryClient.invalidateQueries({ queryKey: ['stories', user?.id] });
    } catch (err) {
      console.error(err);
      toast('Impossible de supprimer la story.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const loadStoryViewers = async (storyId: string) => {
    try {
      const { data, error } = await supabase
        .from('story_views')
        .select(`
          viewer_id,
          viewed_at,
          users:viewer_id (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('story_id', storyId)
        .order('viewed_at', { ascending: false });

      if (error) throw error;
      setCurrentStoryViewers(data || []);
      setShowViewers(true);
    } catch (err) {
      console.error('[StoryViewers] Error loading viewers:', err);
      toast('Impossible de charger les vues', 'error');
    }
  };

  useEffect(() => {
    if (activeGroupIndex !== null && groupedStories[activeGroupIndex]) {
      const group = groupedStories[activeGroupIndex];
      const currentStory = group.stories[activeStoryIndex];
      
      // Enregistrer la vue si ce n'est pas notre propre story
      if (currentStory && user && currentStory.user_id !== user.id) {
        supabase
          .from('story_views')
          .upsert({
            story_id: currentStory.id,
            viewer_id: user.id,
            viewed_at: new Date().toISOString(),
          }, { onConflict: 'story_id,viewer_id' })
          .then(({ error }) => {
            if (error) console.error('[StoryView] Error recording view:', error);
          });
      }
      
      const timer = setTimeout(() => {
        if (activeStoryIndex < group.stories.length - 1) {
          setActiveStoryIndex(activeStoryIndex + 1);
        } else if (activeGroupIndex < groupedStories.length - 1) {
          setActiveGroupIndex(activeGroupIndex + 1);
          setActiveStoryIndex(0);
        } else {
          setActiveGroupIndex(null);
          setActiveStoryIndex(0);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeGroupIndex, activeStoryIndex, groupedStories, user]);

  return (
    <div className={`relative w-full h-full flex flex-col overflow-hidden ${t.bg} ${t.text}`}>
        {/* ── Header — Snapchat style ── */}
        <div className="relative flex items-center justify-between px-4 pt-12 pb-3">
          {/* Left — add story */}
          <button
            onClick={() => setCurrentView('camera')}
            aria-label="Créer une story"
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: t.isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.1)' }}
          >
            <Plus size={18} />
          </button>

          {/* Center — title */}
          <h1 className="absolute left-1/2 -translate-x-1/2 text-[19px] font-black tracking-tight">Stories</h1>

          {/* Right — Nova AI toggle */}
          <button
            onClick={() => setShowAI(!showAI)}
            aria-label="Nova AI"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              showAI ? 'bg-snap-yellow text-black' : `${t.isLight ? 'bg-black/8' : 'bg-white/10'} ${t.textSubtle}`
            }`}
          >
            <Zap size={12} />
            AI
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-hide pb-28">
          {/* AI Section */}
          {showAI && (
            <div className={`mx-4 mb-5 rounded-3xl overflow-hidden border ${t.borderMuted} ${t.surface}`}>
              <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-snap-yellow animate-pulse" />
                <span className="text-xs font-bold text-snap-yellow uppercase tracking-wider">Gemini Live AI</span>
              </div>
              <GeminiOrb />
              <div className="px-4 pb-4">
                <p className={`text-[11px] italic text-center ${t.textFaint}`}>
                  "Analyse ma vue et dis-moi ce que tu vois..." (Bientôt disponible)
                </p>
              </div>
            </div>
          )}

          <div className="px-4 mb-5">
            <div className={`glass-card rounded-3xl p-4 border ${t.border}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold">Ton fil Stories</p>
                  <p className={`text-[11px] mt-1 ${t.textMuted}`}>Publie régulièrement pour augmenter ta visibilité.</p>
                </div>
                <button
                  onClick={() => setCurrentView('camera')}
                  className="px-4 py-2 rounded-full bg-snap-yellow text-black text-xs font-black shadow-snap-sm active:scale-95 transition-all"
                >
                  Créer
                </button>
              </div>
            </div>
          </div>

          {/* Stories row */}
          <div className="px-4 mb-6">
            <div className="flex gap-3 overflow-x-auto scroll-hide pb-1">
              {/* Add Story */}
              <button
                onClick={() => setCurrentView('camera')}
                className="flex-shrink-0 flex flex-col items-center gap-2"
              >
                <div className={`w-[72px] h-[72px] rounded-full ${t.surface} border-2 border-dashed ${t.borderMuted} flex items-center justify-center ${t.surfaceHover} transition-colors`}>
                  <Plus size={24} className={t.textFaint} />
                </div>
                <span className={`text-[11px] font-medium ${t.textFaint}`}>Ma story</span>
              </button>

              {isLoading && [...Array(4)].map((_, i) => (
                <div key={`sk-${i}`} className="flex-shrink-0 flex flex-col items-center gap-2">
                  <Skeleton className="w-[72px] h-[72px] rounded-full" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              ))}

              {groupedStories.map((group, groupIdx) => {
                const latestStory = group.stories[group.stories.length - 1];
                const isFailed = failedUrls[latestStory.media_url];
                const username = group.username;
                return (
                  <button
                    key={group.user_id}
                    onClick={() => {
                      setActiveGroupIndex(groupIdx);
                      setActiveStoryIndex(0);
                    }}
                    className="flex-shrink-0 flex flex-col items-center gap-2"
                  >
                    <div className="w-[72px] h-[72px] rounded-full p-[2px] story-ring">
                      <div className={`w-full h-full rounded-full overflow-hidden border-2 ${t.isLight ? 'bg-black border-black' : 'bg-black border-black'}`}>
                        {isFailed ? (
                          <div className={`w-full h-full flex items-center justify-center ${t.isLight ? 'bg-zinc-200' : 'bg-zinc-900'}`}>
                            <span className={`text-[9px] font-bold uppercase ${t.textFaint}`}>Exp.</span>
                          </div>
                        ) : latestStory.media_type === 'IMAGE' ? (
                          <img
                            src={latestStory.media_url}
                            className="w-full h-full object-cover"
                            alt={username}
                            onError={() => setFailedUrls((prev) => ({ ...prev, [latestStory.media_url]: true }))}
                          />
                        ) : (
                          <video
                            src={latestStory.media_url}
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                            onError={() => setFailedUrls((prev) => ({ ...prev, [latestStory.media_url]: true }))}
                          />
                        )}
                      </div>
                    </div>
                    <span className={`text-[11px] font-medium truncate max-w-[72px] ${t.textSubtle}`}>{username}</span>
                  </button>
                );
              })}

              {!isLoading && !hasStories && (
                <div className="flex items-center justify-center min-w-[200px] py-4">
                  <p className={`text-sm ${t.textFaint}`}>Aucune story active</p>
                </div>
              )}
            </div>
          </div>

          {/* Discover section */}
          <div className="px-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-sm font-bold uppercase tracking-wider ${t.textMuted}`}>Découvrir</h2>
              <span className={`text-[10px] uppercase tracking-wider ${t.textFaint}`}>Tendance</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {isLoading && [...Array(4)].map((_, i) => (
                <Skeleton key={`dsk-${i}`} className="aspect-[9/16] rounded-2xl" />
              ))}
              {trendingStories.map((story) => {
                const viewCount = storyViewCounts[story.id] || 0;
                return (
                  <button
                    key={`grid-${story.id}`}
                    onClick={() => handleOpenStoryFromGrid(story.id)}
                    className={`aspect-[9/16] rounded-2xl overflow-hidden relative bg-zinc-900 border ${t.border} hover:${t.borderMuted} transition-colors`}
                  >
                    {story.media_type === 'IMAGE' && (
                      <img src={story.media_url} className="w-full h-full object-cover" alt="" onError={() => setFailedUrls((prev) => ({ ...prev, [story.media_url]: true }))} />
                    )}
                    {story.media_type === 'VIDEO' && (
                      <video src={story.media_url} muted playsInline className="w-full h-full object-cover" onError={() => setFailedUrls((prev) => ({ ...prev, [story.media_url]: true }))} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    
                    {/* Badge de vues en haut à droite */}
                    {viewCount > 0 && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10">
                        <Eye size={10} className="text-white" />
                        <span className="text-[10px] font-black text-white">{viewCount}</span>
                      </div>
                    )}
                    
                    <div className="absolute bottom-2 left-2 right-2 text-left">
                      <p className={`text-xs font-bold truncate ${t.text}`}>{story.users?.username || 'User'}</p>
                      <p className={`text-[10px] ${t.textMuted}`}>{story.media_type === 'VIDEO' ? 'Vidéo' : 'Photo'}</p>
                    </div>
                  </button>
                );
              })}
              {!isLoading && !hasStories && (
                <div className="col-span-2 py-8 text-center">
                  <p className={`text-sm ${t.textFaint}`}>Poste ta première story depuis la caméra</p>
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

      {/* Fullscreen Story Viewer */}
      {activeGroupIndex !== null && groupedStories[activeGroupIndex] && (() => {
        const currentGroup = groupedStories[activeGroupIndex];
        const currentStory = currentGroup.stories[activeStoryIndex];
        if (!currentStory) return null;
        const isFailed = failedUrls[currentStory.media_url];
        const username = currentGroup.username;

        return (
          <div className={`absolute inset-0 z-50 flex flex-col ${t.isLight ? 'bg-[#e8eaf2]' : 'bg-black'}`}>
            {/* Progress bars */}
            <div className="absolute top-0 inset-x-0 pt-12 px-3 flex gap-1 z-10">
              {currentGroup.stories.map((_, idx) => (
                <div key={idx} className={`h-[3px] flex-1 rounded-full overflow-hidden ${t.isLight ? 'bg-black/15' : 'bg-white/25'}`}>
                  {idx === activeStoryIndex ? (
                    <div className={`h-full rounded-full animate-[progress_5s_linear_forwards] ${t.isLight ? 'bg-black' : 'bg-white'}`} />
                  ) : idx < activeStoryIndex ? (
                    <div className={`h-full rounded-full ${t.isLight ? 'bg-black' : 'bg-white'}`} />
                  ) : null}
                </div>
              ))}
            </div>

            {/* Story header */}
            <div className="absolute top-16 inset-x-0 px-4 flex items-center justify-between z-30 pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-snap-yellow">
                  {currentGroup.avatar_url ? (
                    <img src={currentGroup.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-xs">
                      {username.substring(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <p className={`font-bold text-sm leading-tight ${t.text}`}>{username}</p>
                  <p className={`text-xs ${t.textMuted}`}>
                    {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pointer-events-auto">
                {currentStory.user_id === user?.id && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); loadStoryViewers(currentStory.id); }}
                      className="w-9 h-9 rounded-full bg-snap-yellow/20 hover:bg-snap-yellow/35 border border-snap-yellow/30 flex items-center justify-center text-snap-yellow active:scale-90 transition-all pointer-events-auto"
                      title="Voir les vues"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setStoryToDeleteId(currentStory.id); }}
                      className="w-9 h-9 rounded-full bg-red-500/20 hover:bg-red-500/35 border border-red-500/30 flex items-center justify-center text-red-400 active:scale-90 transition-all pointer-events-auto"
                      title="Supprimer ma story"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveGroupIndex(null); }} 
                  className={`w-9 h-9 rounded-full glass-dark flex items-center justify-center pointer-events-auto ${t.text}`}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Media */}
            {isFailed ? (
              <div className={`w-full h-full flex flex-col items-center justify-center gap-3 ${t.isLight ? 'bg-zinc-200' : 'bg-zinc-950'}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${t.isLight ? 'bg-black/5 text-black/30' : 'bg-white/5 text-white/30'}`}>!</div>
                <p className={`font-bold ${t.text}`}>Story expirée</p>
                <p className={`text-xs ${t.textMuted}`}>Ce contenu n'est plus disponible</p>
              </div>
            ) : currentStory.media_type === 'IMAGE' ? (
              <img
                src={currentStory.media_url}
                className="w-full h-full object-contain bg-zinc-950/20 animate-fade-in"
                alt="Story"
                onError={() => setFailedUrls((prev) => ({ ...prev, [currentStory.media_url]: true }))}
              />
            ) : (
              <video
                src={currentStory.media_url}
                autoPlay
                playsInline
                className="w-full h-full object-contain bg-zinc-950/20"
                onError={() => setFailedUrls((prev) => ({ ...prev, [currentStory.media_url]: true }))}
              />
            )}

            {/* Tap zones */}
            <div
              className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer"
              onClick={() => {
                if (activeStoryIndex > 0) {
                  setActiveStoryIndex(activeStoryIndex - 1);
                } else if (activeGroupIndex > 0) {
                  setActiveGroupIndex(activeGroupIndex - 1);
                  setActiveStoryIndex(groupedStories[activeGroupIndex - 1].stories.length - 1);
                } else {
                  setActiveGroupIndex(null);
                }
              }}
            />
            <div
              className="absolute inset-y-0 right-0 w-1/3 z-20 cursor-pointer"
              onClick={() => {
                if (activeStoryIndex < currentGroup.stories.length - 1) {
                  setActiveStoryIndex(activeStoryIndex + 1);
                } else if (activeGroupIndex < groupedStories.length - 1) {
                  setActiveGroupIndex(activeGroupIndex + 1);
                  setActiveStoryIndex(0);
                } else {
                  setActiveGroupIndex(null);
                }
              }}
            />

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
              {storyToDeleteId !== null && (
                <div 
                  className={`absolute inset-0 z-50 backdrop-blur-md flex items-center justify-center p-6 pointer-events-auto ${t.isLight ? 'bg-black/50' : 'bg-black/70'}`}
                  onClick={(e) => { e.stopPropagation(); setStoryToDeleteId(null); }}
                >
                  <motion.div
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    className="w-full max-w-[290px] glass-dark rounded-[28px] border border-white/10 p-6 flex flex-col items-center gap-4 text-center pointer-events-auto shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-1">
                      <Trash2 size={20} />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <h3 className={`font-black text-base ${t.text}`}>Supprimer la story ?</h3>
                      <p className={`text-[11px] leading-normal px-2 ${t.textMuted}`}>
                        Es-tu sûr de vouloir supprimer cette story ? Cette action est irréversible.
                      </p>
                    </div>

                    <div className="flex gap-2 w-full mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setStoryToDeleteId(null); }}
                        className={`flex-1 py-3 rounded-2xl font-bold text-xs active:scale-95 transition-all ${t.surfaceHover} ${t.text}`}
                      >
                        Annuler
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteStory(storyToDeleteId, e); }}
                        disabled={isDeleting}
                        className="flex-1 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-2xl font-bold text-xs shadow-[0_4px_12px_rgba(239,68,68,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      >
                        {isDeleting ? (
                          <Loader2 className="animate-spin" size={13} />
                        ) : (
                          "Supprimer"
                        )}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Story Viewers Modal */}
            <AnimatePresence>
              {showViewers && (
                <div 
                  className={`absolute inset-0 z-50 backdrop-blur-md flex items-end pointer-events-auto ${t.isLight ? 'bg-black/50' : 'bg-black/70'}`}
                  onClick={(e) => { e.stopPropagation(); setShowViewers(false); }}
                >
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className={`w-full max-h-[70vh] rounded-t-[32px] border-t overflow-hidden pointer-events-auto ${t.surface} ${t.border}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b" style={{ borderColor: t.isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-2">
                        <Eye size={18} className="text-snap-yellow" />
                        <h3 className={`font-black text-base ${t.text}`}>Vues de la story</h3>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowViewers(false); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${t.surfaceHover}`}
                      >
                        <X size={16} className={t.textMuted} />
                      </button>
                    </div>

                    {/* Viewers List */}
                    <div className="overflow-y-auto scroll-hide max-h-[calc(70vh-80px)] px-5 py-3">
                      {currentStoryViewers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${t.isLight ? 'bg-black/5' : 'bg-white/5'}`}>
                            <Eye size={24} className={t.textFaint} />
                          </div>
                          <p className={`text-sm font-bold ${t.textMuted}`}>Aucune vue pour le moment</p>
                          <p className={`text-xs ${t.textFaint} text-center max-w-[240px]`}>
                            Les personnes qui verront ta story apparaîtront ici
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {currentStoryViewers.map((view) => {
                            const viewer = view.users;
                            const timeAgo = getTimeAgo(view.viewed_at);
                            return (
                              <div
                                key={view.viewer_id}
                                className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${t.surfaceHover}`}
                              >
                                <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-snap-yellow/30 shrink-0">
                                  {viewer?.avatar_url ? (
                                    <img src={viewer.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-sm">
                                      {(viewer?.username || 'U').substring(0, 1).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`font-bold text-sm truncate ${t.text}`}>
                                    {viewer?.display_name || viewer?.username || 'Utilisateur'}
                                  </p>
                                  <p className={`text-xs ${t.textMuted}`}>@{viewer?.username || 'user'}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={`text-[10px] font-bold ${t.textFaint}`}>{timeAgo}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        );
      })()}
    </div>
  );
}

// Helper function pour formater le temps écoulé
function getTimeAgo(timestamp: string): string {
  const now = new Date().getTime();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins}min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  return `Il y a ${diffDays}j`;
}
