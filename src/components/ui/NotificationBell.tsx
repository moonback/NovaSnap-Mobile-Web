import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, Check, MessageCircle, UserPlus, Play, Eye, Camera } from 'lucide-react';
import { useNotifications, useNotificationCount, usePushNotifications, updateAppBadge } from '../../hooks/usePushNotifications';
import { useAppStore } from '../../store/useAppStore';
import type { NotificationType } from '../../hooks/usePushNotifications';

// ── Icône par type ────────────────────────────────────────────
function NotifIcon({ type }: { type: NotificationType }) {
  const cls = 'shrink-0';
  switch (type) {
    case 'NEW_MESSAGE':    return <MessageCircle size={16} className={`text-snap-yellow ${cls}`} />;
    case 'SNAP_OPENED':    return <Eye size={16} className={`text-green-400 ${cls}`} />;
    case 'FRIEND_REQUEST': return <UserPlus size={16} className={`text-blue-400 ${cls}`} />;
    case 'FRIEND_ACCEPTED':return <Check size={16} className={`text-green-400 ${cls}`} />;
    case 'NEW_STORY':      return <Play size={16} className={`text-purple-400 ${cls}`} />;
    case 'SNAP_SCREENSHOT':return <Camera size={16} className={`text-red-400 ${cls}`} />;
    default:               return <Bell size={16} className={`text-white/50 ${cls}`} />;
  }
}

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
  const { data: notifications = [], markAllRead } = useNotifications();
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
    <div className="relative">
      {/* Bouton cloche */}
      <button
        onClick={handleOpen}
        className="relative w-10 h-10 rounded-full glass-dark flex items-center justify-center active:scale-90 transition-transform"
        aria-label="Notifications"
      >
        <Bell size={18} className={count > 0 ? 'text-snap-yellow' : 'text-white/60'} />
        {count > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center px-1 border border-black"
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
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="absolute top-full right-0 mt-2 w-80 max-h-[70vh] glass-dark rounded-2xl border border-white/10 overflow-hidden z-50 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <span className="font-black text-white text-sm">Notifications</span>
                <div className="flex items-center gap-2">
                  {count > 0 && (
                    <button
                      onClick={() => { markAllRead(); updateAppBadge(0); }}
                      className="text-[11px] text-white/40 hover:text-white/70 transition-colors font-medium"
                    >
                      Tout lire
                    </button>
                  )}
                  <button
                    onClick={subscribe}
                    className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors"
                    title="Activer les notifications push"
                  >
                    <BellOff size={13} className="text-white/50" />
                  </button>
                </div>
              </div>

              {/* Liste */}
              <div className="overflow-y-auto scroll-hide flex-1">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Bell size={28} className="text-white/15" />
                    <p className="text-white/30 text-sm">Aucune notification</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0 ${
                        !notif.is_read ? 'bg-white/[0.03]' : ''
                      }`}
                    >
                      {/* Icône */}
                      <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center shrink-0 mt-0.5">
                        <NotifIcon type={notif.type} />
                      </div>

                      {/* Contenu */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${notif.is_read ? 'text-white/60' : 'text-white font-semibold'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-white/35 mt-0.5 truncate">{notif.body}</p>
                        <p className="text-[10px] text-white/25 mt-1">{timeAgo(notif.created_at)}</p>
                      </div>

                      {/* Point non-lu */}
                      {!notif.is_read && (
                        <div className="w-2 h-2 rounded-full bg-snap-yellow shrink-0 mt-1.5" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
