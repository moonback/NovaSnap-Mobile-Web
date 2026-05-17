import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trash2,
  Download,
  Edit3,
  Check,
  ChevronLeft,
  ChevronRight,
  Image,
  Video,
  Camera,
  MessageCircle,
  Play,
  Loader2,
  BookOpen,
  Search,
  Grid3X3,
  LayoutList,
} from 'lucide-react';
import { useMemories, useDeleteMemory, useUpdateMemoryCaption } from '../hooks/useMemories';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastProvider';
import Skeleton from '../components/ui/Skeleton';
import type { MemoryRow, MemorySource } from '../lib/types';

// ── Helpers ───────────────────────────────────────────────────

const SOURCE_LABELS: Record<MemorySource, { label: string; icon: React.ReactNode; color: string }> = {
  camera: { label: 'Caméra', icon: <Camera size={11} />, color: 'text-snap-yellow' },
  story: { label: 'Story', icon: <Play size={11} />, color: 'text-orange-400' },
  chat: { label: 'Chat', icon: <MessageCircle size={11} />, color: 'text-cyan-400' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function groupByDate(memories: MemoryRow[]): { label: string; items: MemoryRow[] }[] {
  const groups: Record<string, MemoryRow[]> = {};
  for (const m of memories) {
    const key = formatDate(m.created_at);
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

// ── Sub-components ────────────────────────────────────────────

const MediaThumbnail: React.FC<{
  memory: MemoryRow;
  onClick: () => void;
  layout: 'grid' | 'list';
  selectionMode?: boolean;
  selected?: boolean;
}> = ({
  memory,
  onClick,
  layout,
  selectionMode,
  selected,
}) => {
  const [failed, setFailed] = useState(false);
  const src = memory.media_url;
  const isVideo = memory.media_type === 'VIDEO';
  const sourceInfo = SOURCE_LABELS[memory.source];

  if (layout === 'list') {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-3 w-full p-3 rounded-2xl bg-white/4 border hover:bg-white/7 active:scale-[0.98] transition-all text-left ${selectionMode && selected ? 'border-snap-yellow bg-snap-yellow/10' : 'border-white/8'}`}
      >
        {selectionMode && (
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${selected ? 'bg-snap-yellow border-snap-yellow text-black' : 'border-white/50 bg-black/20'}`}>
            {selected && <Check size={12} />}
          </div>
        )}
        {/* Thumbnail */}
        <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-900 border border-white/10">
          {!failed && isVideo ? (
            <video src={src} muted playsInline className="w-full h-full object-cover" onError={() => setFailed(true)} />
          ) : !failed ? (
            <img src={src} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20">
              <Image size={20} />
            </div>
          )}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                <Play size={10} className="text-white ml-0.5" fill="white" />
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold truncate">
            {memory.caption || (isVideo ? 'Vidéo' : 'Photo')}
          </p>
          <p className="text-white/40 text-xs mt-0.5">{formatTime(memory.created_at)}</p>
          <div className={`flex items-center gap-1 mt-1 ${sourceInfo.color}`}>
            {sourceInfo.icon}
            <span className="text-[10px] font-bold">{sourceInfo.label}</span>
          </div>
        </div>

        <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`relative aspect-square rounded-xl overflow-hidden bg-zinc-900 border hover:border-white/20 active:scale-95 transition-all ${selectionMode && selected ? 'border-snap-yellow scale-95 ring-2 ring-snap-yellow ring-offset-2 ring-offset-black' : 'border-white/8'}`}
    >
      {!failed && isVideo ? (
        <video src={src} muted playsInline className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : !failed ? (
        <img src={src} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/20">
          <Image size={24} />
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

      {/* Video badge */}
      {isVideo && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
          <Play size={9} className="text-white ml-0.5" fill="white" />
        </div>
      )}

      {/* Source badge */}
      <div className={`absolute bottom-1.5 left-1.5 flex items-center gap-0.5 ${sourceInfo.color} drop-shadow-md`}>
        {sourceInfo.icon}
      </div>

      {/* Selection badge */}
      {selectionMode && (
        <div className="absolute top-1.5 left-1.5 z-10">
           <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm ${selected ? 'bg-snap-yellow border-snap-yellow text-black' : 'border-white/50 bg-black/40'}`}>
              {selected && <Check size={12} />}
           </div>
        </div>
      )}
    </button>
  );
}

// ── Lightbox ──────────────────────────────────────────────────

function Lightbox({
  memories,
  initialIndex,
  onClose,
}: {
  memories: MemoryRow[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [failed, setFailed] = useState(false);

  const { toast } = useToast();
  const deleteMemory = useDeleteMemory();
  const updateCaption = useUpdateMemoryCaption();

  const memory = memories[index];
  if (!memory) return null;

  const isVideo = memory.media_type === 'VIDEO';
  const sourceInfo = SOURCE_LABELS[memory.source];
  const canGoLeft = index > 0;
  const canGoRight = index < memories.length - 1;

  const handleDelete = async () => {
    try {
      await deleteMemory.mutateAsync({ memoryId: memory.id, storagePath: memory.media_url });
      toast('Souvenir supprimé.', 'success');
      if (memories.length <= 1) {
        onClose();
      } else {
        setIndex((prev) => Math.min(prev, memories.length - 2));
        setShowDeleteConfirm(false);
      }
    } catch {
      toast('Impossible de supprimer ce souvenir.', 'error');
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = memory.media_url;
    link.download = isVideo ? 'novasnap-memory.webm' : 'novasnap-memory.jpg';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Téléchargement lancé !', 'success');
  };

  const handleSaveCaption = async () => {
    try {
      await updateCaption.mutateAsync({ memoryId: memory.id, caption: captionDraft });
      toast('Légende mise à jour !', 'success');
      setEditingCaption(false);
    } catch {
      toast('Impossible de mettre à jour la légende.', 'error');
    }
  };

  const openEdit = () => {
    setCaptionDraft(memory.caption ?? '');
    setEditingCaption(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[60] bg-black flex flex-col"
    >
      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-10 px-4 pt-12 pb-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full glass-dark flex items-center justify-center text-white"
        >
          <X size={18} />
        </button>

        <div className="text-center">
          <p className="text-white text-xs font-bold">{formatDate(memory.created_at)}</p>
          <p className="text-white/40 text-[10px]">{formatTime(memory.created_at)}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="w-9 h-9 rounded-full glass-dark flex items-center justify-center text-white"
          >
            <Download size={16} />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Media */}
      <motion.div 
        className="flex-1 flex items-center justify-center bg-zinc-950/30 overflow-hidden"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.9}
        onDragEnd={(e, info) => {
          if (info.offset.y > 100 || info.offset.y < -100) onClose();
        }}
      >
        {failed ? (
          <div className="flex flex-col items-center gap-3 text-white/30">
            <Image size={40} />
            <p className="text-sm">Média indisponible</p>
          </div>
        ) : isVideo ? (
          <video
            key={memory.id}
            src={memory.media_url}
            autoPlay
            loop
            playsInline
            controls
            className="max-w-full max-h-full object-contain pointer-events-none"
            onError={() => setFailed(true)}
          />
        ) : (
          <img
            key={memory.id}
            src={memory.media_url}
            alt={memory.caption ?? ''}
            className="max-w-full max-h-full object-contain pointer-events-none"
            onError={() => setFailed(true)}
          />
        )}
      </motion.div>

      {/* Left / Right navigation */}
      {canGoLeft && (
        <button
          onClick={() => { setIndex((i) => i - 1); setFailed(false); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass-dark flex items-center justify-center text-white z-10"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      {canGoRight && (
        <button
          onClick={() => { setIndex((i) => i + 1); setFailed(false); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass-dark flex items-center justify-center text-white z-10"
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* Bottom info + caption */}
      <div className="absolute bottom-0 inset-x-0 px-4 pb-10 pt-6 bg-gradient-to-t from-black/90 to-transparent">
        {/* Source badge */}
        <div className={`flex items-center gap-1.5 mb-2 ${sourceInfo.color}`}>
          {sourceInfo.icon}
          <span className="text-[11px] font-bold uppercase tracking-wider">{sourceInfo.label}</span>
        </div>

        {/* Caption */}
        {editingCaption ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value)}
              maxLength={120}
              placeholder="Ajouter une légende..."
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-snap-yellow/50"
            />
            <button
              onClick={handleSaveCaption}
              disabled={updateCaption.isPending}
              className="w-9 h-9 rounded-xl bg-snap-yellow flex items-center justify-center text-black"
            >
              {updateCaption.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button
              onClick={() => setEditingCaption(false)}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={openEdit}
            className="flex items-center gap-2 text-left group"
          >
            <p className="text-white/70 text-sm flex-1">
              {memory.caption || <span className="text-white/30 italic">Ajouter une légende...</span>}
            </p>
            <Edit3 size={13} className="text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0" />
          </button>
        )}

        {/* Counter */}
        <p className="text-white/25 text-[10px] mt-2 text-right">
          {index + 1} / {memories.length}
        </p>
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div
            className="absolute inset-0 z-20 bg-black/70 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="w-full max-w-[290px] glass-dark rounded-[28px] border border-white/10 p-6 flex flex-col items-center gap-4 text-center shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-white font-black text-base">Supprimer ce souvenir ?</h3>
                <p className="text-white/40 text-[11px] mt-1.5 leading-normal px-2">
                  Cette action est irréversible. Le média sera définitivement supprimé.
                </p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 bg-white/10 text-white rounded-2xl font-bold text-xs active:scale-95 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMemory.isPending}
                  className="flex-1 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-2xl font-bold text-xs shadow-[0_4px_12px_rgba(239,68,68,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {deleteMemory.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Supprimer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Screen ───────────────────────────────────────────────

type FilterType = 'all' | 'IMAGE' | 'VIDEO';

export default function MemoriesScreen() {
  const { setShowMemories } = useAppStore();
  const { data: memories, isLoading } = useMemories();

  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  // Multi-selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingMany, setIsDeletingMany] = useState(false);
  const deleteMemory = useDeleteMemory();
  const { toast } = useToast();

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeletingMany(true);
    try {
      const toDelete = filtered.filter(m => selectedIds.has(m.id));
      await Promise.all(toDelete.map(m => deleteMemory.mutateAsync({ memoryId: m.id, storagePath: m.media_url })));
      toast(`${selectedIds.size} souvenir(s) supprimé(s).`, 'success');
      setSelectionMode(false);
      setSelectedIds(new Set());
    } catch {
      toast('Erreur lors de la suppression multiple.', 'error');
    } finally {
      setIsDeletingMany(false);
    }
  };

  // Filtered + searched memories
  const filtered = useMemo(() => {
    if (!memories) return [];
    let result = memories;
    if (filter !== 'all') result = result.filter((m) => m.media_type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.caption?.toLowerCase().includes(q) ||
          m.source.toLowerCase().includes(q) ||
          formatDate(m.created_at).toLowerCase().includes(q)
      );
    }
    return result;
  }, [memories, filter, search]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const flashbackMemory = useMemo(() => {
    if (!memories || memories.length === 0) return null;
    const candidates = memories.filter(m => m.media_type === 'IMAGE');
    if (candidates.length > 0) return candidates[candidates.length - 1]; // oldest image
    return memories[memories.length - 1];
  }, [memories]);

  const totalCount = memories?.length ?? 0;
  const imageCount = memories?.filter((m) => m.media_type === 'IMAGE').length ?? 0;
  const videoCount = memories?.filter((m) => m.media_type === 'VIDEO').length ?? 0;

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-5 pt-14 pb-3">
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => setShowMemories(false)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="text-center">
            <h1 className="text-lg font-black tracking-tight">Mes Souvenirs</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedIds(new Set());
              }}
              className={`px-3 h-9 rounded-full flex items-center justify-center transition-colors text-xs font-bold ${
                selectionMode ? 'bg-snap-yellow text-black shadow-snap-sm' : 'bg-white/10 text-white hover:bg-white/15'
              }`}
            >
              {selectionMode ? 'Annuler' : 'Sélect.'}
            </button>
            <button
              onClick={() => setShowSearch((s) => !s)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                showSearch ? 'bg-snap-yellow text-black' : 'bg-white/10 text-white hover:bg-white/15'
              }`}
            >
              <Search size={16} />
            </button>
            <button
              onClick={() => setLayout((l) => (l === 'grid' ? 'list' : 'grid'))}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
            >
              {layout === 'grid' ? <LayoutList size={16} /> : <Grid3X3 size={16} />}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mt-3"
            >
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par légende, source, date..."
                className="w-full bg-white/8 border border-white/10 rounded-xl h-10 px-4 text-white text-sm placeholder-white/30 focus:outline-none focus:border-snap-yellow/40 transition-all"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Stats strip ── */}
      <div className="flex-shrink-0 px-5 mb-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/5 border border-white/8 rounded-2xl py-3 flex flex-col items-center gap-0.5">
            <span className="text-lg font-black text-snap-yellow">{isLoading ? '—' : totalCount}</span>
            <span className="text-[9px] text-white/40 uppercase tracking-wider font-bold">Total</span>
          </div>
          <div className="bg-white/5 border border-white/8 rounded-2xl py-3 flex flex-col items-center gap-0.5">
            <span className="text-lg font-black text-white">{isLoading ? '—' : imageCount}</span>
            <span className="text-[9px] text-white/40 uppercase tracking-wider font-bold">Photos</span>
          </div>
          <div className="bg-white/5 border border-white/8 rounded-2xl py-3 flex flex-col items-center gap-0.5">
            <span className="text-lg font-black text-white">{isLoading ? '—' : videoCount}</span>
            <span className="text-[9px] text-white/40 uppercase tracking-wider font-bold">Vidéos</span>
          </div>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex-shrink-0 px-5 mb-4">
        <div className="flex gap-2">
          {(['all', 'IMAGE', 'VIDEO'] as FilterType[]).map((f) => {
            const labels: Record<FilterType, string> = { all: 'Tout', IMAGE: 'Photos', VIDEO: 'Vidéos' };
            const icons: Record<FilterType, React.ReactNode> = {
              all: <BookOpen size={12} />,
              IMAGE: <Image size={12} />,
              VIDEO: <Video size={12} />,
            };
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  active
                    ? 'bg-snap-yellow text-black shadow-snap-sm'
                    : 'bg-white/8 text-white/60 border border-white/10'
                }`}
              >
                {icons[f]}
                {labels[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto scroll-hide px-5 pb-10">
        {isLoading ? (
          <div className={layout === 'grid' ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2'}>
            {[...Array(9)].map((_, i) =>
              layout === 'grid' ? (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ) : (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              )
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <BookOpen size={32} className="text-white/20" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-base">
                {search || filter !== 'all' ? 'Aucun résultat' : 'Aucun souvenir'}
              </p>
              <p className="text-white/35 text-sm mt-1 max-w-[220px] leading-relaxed">
                {search || filter !== 'all'
                  ? 'Essaie un autre filtre ou terme de recherche.'
                  : 'Sauvegarde tes snaps depuis la caméra pour les retrouver ici.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Flashback Banner */}
            {!search && filter === 'all' && flashbackMemory && (
              <div 
                className={`relative h-48 rounded-2xl overflow-hidden cursor-pointer group mb-2 active:scale-[0.98] transition-all border ${selectionMode && selectedIds.has(flashbackMemory.id) ? 'border-snap-yellow ring-2 ring-snap-yellow ring-offset-2 ring-offset-black scale-95' : 'border-white/10'}`}
                onClick={() => {
                   if (selectionMode) toggleSelection(flashbackMemory.id);
                   else setLightboxIndex(filtered.indexOf(flashbackMemory));
                }}
              >
                {flashbackMemory.media_type === 'IMAGE' ? (
                  <img src={flashbackMemory.media_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <video src={flashbackMemory.media_url} className="w-full h-full object-cover" muted playsInline />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                
                <div className="absolute top-3 left-3 px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full border border-white/20 shadow-lg">
                  <span className="text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen size={12} className="text-snap-yellow" /> Souvenir
                  </span>
                </div>
                
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-white text-base font-black truncate">{flashbackMemory.caption || 'Ce jour-là...'}</p>
                  <p className="text-white/60 text-[11px] mt-0.5 uppercase tracking-wider font-bold">{formatDate(flashbackMemory.created_at)}</p>
                </div>

                {selectionMode && (
                  <div className="absolute top-3 right-3 z-10">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shadow-lg ${selectedIds.has(flashbackMemory.id) ? 'bg-snap-yellow border-snap-yellow text-black' : 'border-white/50 bg-black/40'}`}>
                        {selectedIds.has(flashbackMemory.id) && <Check size={14} />}
                    </div>
                  </div>
                )}
              </div>
            )}

            {groups.map((group) => (
              <div key={group.label}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/40">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-white/8" />
                  <span className="text-[10px] text-white/25">{group.items.length}</span>
                </div>

                {/* Items */}
                {layout === 'grid' ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {group.items.map((memory) => {
                      const globalIdx = filtered.indexOf(memory);
                      return (
                        <MediaThumbnail
                          key={memory.id}
                          memory={memory}
                          layout="grid"
                          selectionMode={selectionMode}
                          selected={selectedIds.has(memory.id)}
                          onClick={() => {
                            if (selectionMode) toggleSelection(memory.id);
                            else setLightboxIndex(globalIdx);
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {group.items.map((memory) => {
                      const globalIdx = filtered.indexOf(memory);
                      return (
                        <MediaThumbnail
                          key={memory.id}
                          memory={memory}
                          layout="list"
                          selectionMode={selectionMode}
                          selected={selectedIds.has(memory.id)}
                          onClick={() => {
                            if (selectionMode) toggleSelection(memory.id);
                            else setLightboxIndex(globalIdx);
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Selection Bottom Bar ── */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent flex justify-center z-40"
          >
            <div className="flex items-center gap-4 bg-zinc-900 border border-white/10 p-2 rounded-full shadow-2xl">
              <span className="text-white text-xs font-bold px-3">
                {selectedIds.size} sélectionné(s)
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || isDeletingMany}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500/20 text-red-400 font-bold text-sm rounded-full active:scale-95 transition-all disabled:opacity-50"
              >
                {isDeletingMany ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Supprimer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            memories={filtered}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
