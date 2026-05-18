import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DownloadCloud, X } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

export default function UpdatePrompt() {
  const { isUpdateAvailable, updateApp } = usePWA();
  const [dismissed, setDismissed] = React.useState(false);

  if (!isUpdateAvailable || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-24 left-4 right-4 z-[999] mx-auto max-w-sm"
      >
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 border border-snap-yellow/20 shadow-[0_8px_30px_rgba(255,252,0,0.15)] bg-black/80">
          <div className="w-10 h-10 rounded-xl bg-snap-yellow flex items-center justify-center text-black flex-shrink-0">
            <DownloadCloud size={20} />
          </div>
          
          <div className="flex-1">
            <h4 className="font-bold text-sm text-white">Mise à jour disponible</h4>
            <p className="text-xs text-white/60">Une nouvelle version de NovaSnap est prête.</p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={updateApp}
              className="px-4 py-1.5 bg-snap-yellow text-black font-black text-xs rounded-full hover:bg-yellow-400 transition-colors"
            >
              Mettre à jour
            </button>
          </div>
          
          <button 
            onClick={() => setDismissed(true)}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
