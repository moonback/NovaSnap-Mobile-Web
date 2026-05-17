import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

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
    // Ne pas supprimer si le message est sauvegardé manuellement
    if (!isSaved) {
      try {
        await supabase.from('messages').delete().eq('id', messageId);
      } catch (err) {
        console.error('Failed to delete ephemeral media message', err);
      }
    }
  };

  // Message sauvegardé : afficher directement le média (pas de tap-to-view)
  if (isSaved) {
    return (
      <div className="relative rounded-lg overflow-hidden max-w-[240px]">
        {mediaType === 'IMAGE' ? (
          <img src={mediaUrl} className="w-full rounded-lg" alt="Snap enregistré" />
        ) : (
          <video src={mediaUrl} controls playsInline className="w-full rounded-lg" />
        )}
        <span className="absolute bottom-1 right-1 text-[9px] text-white/60 bg-black/40 px-1 rounded font-mono">
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
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center cursor-grab active:cursor-grabbing"
          >
            {/* Controls */}
            <div className="absolute top-6 right-6 z-10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full glass border border-white/20 flex items-center justify-center font-bold text-xl text-white">
                {timeLeft}
              </div>
              <button
                onClick={handleExpire}
                className="w-12 h-12 rounded-full glass border border-white/20 flex items-center justify-center text-white cursor-pointer pointer-events-auto"
              >
                <X size={24} />
              </button>
            </div>

            {/* Media */}
            <div className="w-full h-full pointer-events-none">
              {mediaType === 'IMAGE' ? (
                <img
                  src={mediaUrl}
                  className="w-full h-full object-cover"
                  alt="Snap"
                />
              ) : (
                <video
                  src={mediaUrl}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
