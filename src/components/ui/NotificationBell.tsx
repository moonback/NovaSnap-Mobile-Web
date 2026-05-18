import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, Check, MessageCircle, UserPlus, Play, Eye, Camera, CheckCheck, Trash2 } from 'lucide-react';
import { useNotifications, useNotificationCount, usePushNotifications, updateAppBadge } from '../../hooks/usePushNotifications';
import { useAppStore } from '../../store/useAppStore';
import type { NotificationType } from '../../hooks/usePushNotifications';

// ── Configuration des types de notifications ───────────────────
const NOTIF_CONFIG: Record<NotificationType | 'DEFAULT', { icon: React.ElementType, color: string, bg: string }> = {
  NEW_MESSAGE:     { icon: MessageCircle, color: 'text-white',      bg: 'bg-white/10' },
  SNAP_OPENED:     { icon: Eye,           color: 'text-snap-yellow',bg: 'bg-snap-yellow/10' },
  FRIEND_REQUEST:  { icon: UserPlus,      color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  FRIEND_ACCEPTED: { icon: Check,         color: 'text-green-400',  bg: 'bg-green-400/10' },
  NEW_STORY:       { icon: Play,          color: 'text-purple-400', bg: 'bg-purple-400/10' },
  SNAP_SCREENSHOT: { icon: Camera,        color: 'text-red-400',    bg: 'bg-red-400/10' },
  DEFAULT:         { icon: Bell,          color: 'text-white/50',   bg: 'bg-white/5' },
};

// ── Formater la date relative ─────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'À l\'instant';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

// ── Composant principal ───────────────────────────────────────
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = useNotificationCount();
  const { data: notifications = [], markAllRead, clearRead } = useNotifications();
  const { subscribe } = usePushNotifications();
  const { setCurrentView, setDirectChatId, setShowFriends } = useAppStore();

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open && count > 0) {
      markAllRead();
      updateAppBadge(0);
    }
  };

  const handleNotifClick = (notif: ReturnType<typeof useNotifications>['data'][number]) => {
    setOpen(false);
    const data = notif.data as Record<string, string>;
    switch (notif.type) {
      case 'NEW_MESSAGE':
        if (data.conversation_id) setDirectChatId(data.conversation_id);
        setCurrentView('chat');
        break;
      case 'SNAP_OPENED':
        setCurrentView('chat');
        break;
      case 'FRIEND_REQUEST':
      case 'FRIEND_ACCEPTED':
        setShowFriends(true);
        break;
      case 'NEW_STORY':
        setCurrentView('stories');
        break;
    }
  };

  return (
    <div className="relative z-50">
      {/* Bouton cloche */}
      <button
        onClick={handleOpen}
        className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${open ? 'bg-white/10 scale-105' : 'glass-dark hover:bg-white/10 active:scale-95'}`}
        aria-label="Notifications"
      >
        <Bell size={20} strokeWidth={2.5} className={count > 0 ? 'text-snap-yellow' : 'text-white/80'} />
        {count > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-0 right-0 min-w-[20px] h-[20px] rounded-full bg-snap-yellow text-black text-[11px] font-black flex items-center justify-center px-1 border-2 border-black shadow-sm"
          >
            {count > 99 ? '99+' : count}
          </motion.span>
        )}
      </button>

      {/* Panneau de notifications */}
      <AnimatePresence>
        {open && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute top-full right-0 mt-3 w-[90vw] max-w-[360px] max-h-[75vh] rounded-3xl border border-white/10 shadow-2xl overflow-hidden z-50 flex flex-col"
              style={{
                background: 'rgba(25, 25, 25, 0.65)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02]">
                <span className="font-extrabold text-white text-lg tracking-tight">Notifications</span>
                <div className="flex items-center gap-2">
                  {notifications.some(n => n.is_read) && (
                    <button
                      onClick={() => clearRead()}
                      className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors font-medium px-2 py-1 rounded-full hover:bg-white/5"
                      title="Effacer les lues"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {count > 0 && (
                    <button
                      onClick={() => { markAllRead(); updateAppBadge(0); }}
                      className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors font-medium px-2 py-1 rounded-full hover:bg-white/5"
                    >
                      <CheckCheck size={14} />
                      Tout lire
                    </button>
                  )}
                  <button
                    onClick={subscribe}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                    title="Activer les notifications push"
                  >
                    <BellOff size={15} className="text-white/70" />
                  </button>
                </div>
              </div>

              {/* Liste */}
              <div className="overflow-y-auto scroll-hide flex-1">
                {notifications.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-16 gap-4"
                  >
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                      <Bell size={32} className="text-white/20" />
                    </div>
                    <p className="text-white/40 text-sm font-medium">Vous êtes à jour !</p>
                  </motion.div>
                ) : (
                  <div className="flex flex-col">
                    {notifications.map((notif, index) => {
                      const config = NOTIF_CONFIG[notif.type as NotificationType] || NOTIF_CONFIG.DEFAULT;
                      const Icon = config.icon;
                      
                      return (
                        <motion.button
                          key={notif.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          onClick={() => handleNotifClick(notif)}
                          className={`group relative w-full flex items-start gap-4 px-5 py-4 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0 ${
                            !notif.is_read ? 'bg-white/[0.04]' : ''
                          }`}
                        >
                          {/* Icône */}
                          <div className={`w-11 h-11 rounded-full ${config.bg} flex items-center justify-center shrink-0 mt-0.5 border border-white/5`}>
                            <Icon size={20} className={config.color} strokeWidth={2.5} />
                          </div>

                          {/* Contenu */}
                          <div className="flex-1 min-w-0 pt-0.5 pr-2">
                            <p className={`text-[15px] leading-tight ${notif.is_read ? 'text-white/80' : 'text-white font-bold'}`}>
                              {notif.title}
                            </p>
                            <p className={`text-[13px] mt-1 line-clamp-2 ${notif.is_read ? 'text-white/40' : 'text-white/60'}`}>
                              {notif.body}
                            </p>
                            <p className="text-[11px] font-medium text-white/30 mt-1.5 uppercase tracking-wider">
                              {timeAgo(notif.created_at)}
                            </p>
                          </div>

                          {/* Point non-lu */}
                          {!notif.is_read && (
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-snap-yellow shadow-[0_0_8px_rgba(255,252,0,0.4)] shrink-0" />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
