import React, { useState, useEffect } from 'react';
import { Camera, Play, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface EphemeralMediaProps {
  messageId: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  isMe: boolean;
}

export default function EphemeralMedia({ messageId, mediaUrl, mediaType, isMe }: EphemeralMediaProps) {
  const [viewState, setViewState] = useState<'HIDDEN' | 'VIEWING' | 'EXPIRED'>('HIDDEN');
  const [timeLeft, setTimeLeft] = useState(10); // 10 seconds to view

  useEffect(() => {
    let timer: any;
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
    try {
        await supabase.from('messages').delete().eq('id', messageId);
    } catch (err) {
        console.error("Failed to delete ephemeral message", err);
    }
  };

  if (viewState === 'EXPIRED') {
    return (
      <div className="flex items-center gap-2 p-2 px-3 rounded-lg bg-transparent text-white/50 border border-white/10">
        <div className="w-4 h-4 rounded-sm border border-white/50"></div>
        <span className="text-sm font-medium italic">Opened</span>
      </div>
    );
  }

  return (
    <>
      <div 
        onClick={() => setViewState('VIEWING')}
        className={`flex items-center gap-2 p-3 font-semibold rounded-lg cursor-pointer transition-colors ${
          mediaType === 'IMAGE' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-purple-500 hover:bg-purple-600 text-white'
        }`}
      >
        <div className={`w-4 h-4 rounded-sm ${mediaType === 'IMAGE' ? 'bg-red-300' : 'bg-purple-300'}`}></div>
        <span>Tap to View</span>
      </div>

      <AnimatePresence>
        {viewState === 'VIEWING' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: 100 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.8}
            onDragEnd={(e, info) => {
              if (info.offset.y > 150) {
                handleExpire();
              }
            }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center cursor-grab active:cursor-grabbing"
          >
            <div className="absolute top-6 right-6 z-10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full glass border border-white/20 flex items-center justify-center font-bold text-xl text-white">
                {timeLeft}
              </div>
              <button onClick={handleExpire} className="w-12 h-12 rounded-full glass border border-white/20 flex items-center justify-center text-white cursor-pointer pointer-events-auto">
                <X size={24} />
              </button>
            </div>
            
            <div className="w-full h-full pointer-events-none">
              {mediaType === 'IMAGE' ? (
                <img src={mediaUrl} className="w-full h-full object-cover" alt="Snap" />
              ) : (
                <video src={mediaUrl} autoPlay playsInline className="w-full h-full object-cover" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
