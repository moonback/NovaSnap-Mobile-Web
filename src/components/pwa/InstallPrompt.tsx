import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share, PlusSquare, X } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

export default function InstallPrompt() {
  const { canInstall, installApp } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  // If we can install directly (Android / Chrome)
  if (canInstall && !dismissed) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 z-[998] mx-auto max-w-sm"
        >
          <div className="glass-card rounded-2xl p-4 flex flex-col gap-3 border border-snap-yellow/20 bg-black/80">
            <div className="flex gap-3">
              <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-snap-yellow to-yellow-500 flex items-center justify-center p-2 flex-shrink-0">
                <img src="/logo.png" alt="NovaSnap" className="w-full h-full object-contain" />
              </div>
              
              <div className="flex-1">
                <h4 className="font-bold text-sm text-white">Installer NovaSnap</h4>
                <p className="text-xs text-white/60 mt-0.5">Ajoute l'application sur ton écran d'accueil pour une expérience plus fluide.</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setDismissed(true)}
                className="flex-1 py-2 bg-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/20 transition-colors"
              >
                Plus tard
              </button>
              <button
                onClick={installApp}
                className="flex-1 py-2 bg-snap-yellow text-black font-black text-xs rounded-xl hover:bg-yellow-400 transition-colors shadow-[0_0_15px_rgba(255,252,0,0.3)]"
              >
                Installer
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
