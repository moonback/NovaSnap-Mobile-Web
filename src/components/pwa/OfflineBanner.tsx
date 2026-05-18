import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

export default function OfflineBanner() {
  const { isOffline } = usePWA();

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-[env(safe-area-inset-top,0px)] left-0 right-0 z-[9999] flex justify-center pointer-events-none"
        >
          <div className="mt-2 mx-4 bg-red-500/90 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg shadow-red-500/20 border border-red-500/50 pointer-events-auto">
            <WifiOff size={14} className="animate-pulse" />
            <span className="text-xs font-bold tracking-wide">Hors connexion</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
