import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';

interface EphemeralMediaProps {
  messageId: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  isMe: boolean;
  /** Si true, le message est sauvegardé manuellement — pas de suppression après visionnage */
  isSaved?: boolean;
}

export default function EphemeralMedia({
  messageId,
  mediaUrl,
  mediaType,
  isMe,
  isSaved = false,
}: EphemeralMediaProps) {
  const [viewState, setViewState] = useState<'HIDDEN' | 'VIEWING' | 'EXPIRED'>('HIDDEN');
  const [timeLeft, setTimeLeft] = useState(10);
  const t = useTheme();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (viewState === 'VIEWING') {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleExpire();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [viewState]);

  const handleExpire = async () => {
    setViewState('EXPIRED');
    // Ne pas supprimer si le message est sauvegardé manuellement ou si c'est notre propre message (l'autre utilisateur doit pouvoir le voir)
    if (!isSaved && !isMe) {
      try {
        await supabase.from('messages').delete().eq('id', messageId);
      } catch (err) {
        console.error('Failed to delete ephemeral media message', err);
      }
    }
  };

  // Si c'est le média de l'utilisateur connecté, on l'affiche directement inline (plus convivial et évite l'expiration accidentelle)
  if (isMe) {
    return (
      <div className="relative rounded-2xl overflow-hidden max-w-[200px] border border-white/10 shadow-md">
        {mediaType === 'IMAGE' ? (
          <img src={mediaUrl} className="w-full rounded-2xl" alt="Snap envoyé" />
        ) : (
          <video src={mediaUrl} controls playsInline className="w-full rounded-2xl animate-fade-in" />
        )}
        <span className={`absolute bottom-2 right-2 text-[9px] text-white/70 px-2 py-0.5 rounded-full font-semibold ${t.isLight ? 'bg-black/40' : 'bg-black/60'}`}>
          Envoyé
        </span>
      </div>
    );
  }

  // Message sauvegardé : afficher directement le média (pas de tap-to-view)
  if (isSaved) {
    return (
      <div className="relative rounded-2xl overflow-hidden max-w-[200px] border border-white/10 shadow-md">
        {mediaType === 'IMAGE' ? (
          <img src={mediaUrl} className="w-full rounded-2xl" alt="Snap enregistré" />
        ) : (
          <video src={mediaUrl} controls playsInline className="w-full rounded-2xl animate-fade-in" />
        )}
        <span className={`absolute bottom-2 right-2 text-[9px] text-white/70 px-2 py-0.5 rounded-full font-semibold ${t.isLight ? 'bg-black/40' : 'bg-black/60'}`}>
          Enregistré
        </span>
      </div>
    );
  }

  if (viewState === 'EXPIRED') {
    return (
      <div className="flex items-center gap-2 p-2 px-3 rounded-lg bg-transparent text-white/50 border border-white/10">
        <div className="w-4 h-4 rounded-sm border border-white/50" />
        <span className="text-sm font-medium italic">Ouvert</span>
      </div>
    );
  }

  return (
    <>
      {/* Tap-to-view button */}
      <div
        onClick={() => setViewState('VIEWING')}
        className={`flex items-center gap-2 p-3 font-semibold rounded-lg cursor-pointer transition-colors ${
          mediaType === 'IMAGE'
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-purple-500 hover:bg-purple-600 text-white'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-sm ${
            mediaType === 'IMAGE' ? 'bg-red-300' : 'bg-purple-300'
          }`}
        />
        <span>Appuyer pour voir</span>
      </div>

      {/* Fullscreen viewer */}
      <AnimatePresence>
        {viewState === 'VIEWING' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: 100 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.8}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 150) handleExpire();
            }}
            className={`absolute inset-0 z-[100] flex flex-col items-center justify-center cursor-grab active:cursor-grabbing ${t.isLight ? 'bg-[#e8eaf2]' : 'bg-black'}`}
          >
            {/* Controls */}
            <div className="absolute top-12 right-4 z-10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full glass-dark border border-white/10 flex items-center justify-center font-black text-sm text-white">
                {timeLeft}
              </div>
              <button
                onClick={handleExpire}
                className="w-9 h-9 rounded-full glass-dark border border-white/10 flex items-center justify-center text-white cursor-pointer pointer-events-auto active:scale-90 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Media */}
            <div className="w-full h-full pointer-events-none flex items-center justify-center bg-zinc-950/20">
              {mediaType === 'IMAGE' ? (
                <img
                  src={mediaUrl}
                  className="w-full h-full object-contain"
                  alt="Snap"
                />
              ) : (
                <video
                  src={mediaUrl}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
