import React from 'react';
import { motion } from 'framer-motion';
import { useOnlineStatus, formatLastSeen } from '../../hooks/useOnlineStatus';

// ── Types ─────────────────────────────────────────────────────
type OnlineIndicatorProps = {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
};

// ── Composant principal ───────────────────────────────────────
export const OnlineIndicator: React.FC<OnlineIndicatorProps> = ({
  userId,
  size = 'md',
  showText = false,
  className = '',
}) => {
  const { isOnline, lastSeenAt, canView, isLoading } = useOnlineStatus(userId);

  // Si l'utilisateur n'a pas autorisé la visibilité, ne rien afficher
  if (!canView || isLoading) return null;

  // Tailles du point
  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  // Affichage du point uniquement
  if (!showText) {
    return isOnline ? (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`${dotSizes[size]} rounded-full bg-green-500 ring-2 ring-black ${className}`}
      >
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-full h-full rounded-full bg-green-400"
        />
      </motion.div>
    ) : null;
  }

  // Affichage avec texte
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isOnline ? (
        <>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`${dotSizes[size]} rounded-full bg-green-500 ring-2 ring-black shrink-0`}
          >
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-full h-full rounded-full bg-green-400"
            />
          </motion.div>
          <span className="text-xs text-green-400 font-semibold">En ligne</span>
        </>
      ) : (
        <span className="text-xs text-white/40 font-medium">
          {formatLastSeen(lastSeenAt)}
        </span>
      )}
    </div>
  );
};

// ── Composant pour afficher sur un avatar ────────────────────
type AvatarOnlineBadgeProps = {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  position?: 'top-right' | 'bottom-right';
};

export const AvatarOnlineBadge: React.FC<AvatarOnlineBadgeProps> = ({
  userId,
  size = 'md',
  position = 'bottom-right',
}) => {
  const { isOnline, canView, isLoading } = useOnlineStatus(userId);

  if (!canView || isLoading || !isOnline) return null;

  const dotSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const positions = {
    'top-right': 'top-0 right-0',
    'bottom-right': 'bottom-0 right-0',
  };

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`absolute ${positions[position]} ${dotSizes[size]} rounded-full bg-green-500 ring-2 ring-black`}
    >
      <motion.div
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-full h-full rounded-full bg-green-400"
      />
    </motion.div>
  );
};
