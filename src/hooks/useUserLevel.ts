import { useMemo } from 'react';

// Système de niveaux basé sur le Snap Score
export interface UserLevel {
  level: number;
  rank: string;
  rankEmoji: string;
  currentScore: number;
  nextLevelScore: number;
  progress: number; // 0-100
  snapsToNextLevel: number;
  color: string;
  gradient: string;
}

const LEVEL_THRESHOLDS = [
  { level: 1, rank: 'Novice', emoji: '🌟', score: 0, color: '#94a3b8', gradient: 'from-slate-400 to-slate-600' },
  { level: 2, rank: 'Débutant', emoji: '⭐', score: 50, color: '#60a5fa', gradient: 'from-blue-400 to-blue-600' },
  { level: 3, rank: 'Amateur', emoji: '✨', score: 150, color: '#34d399', gradient: 'from-emerald-400 to-emerald-600' },
  { level: 4, rank: 'Confirmé', emoji: '💫', score: 300, color: '#a78bfa', gradient: 'from-violet-400 to-violet-600' },
  { level: 5, rank: 'Expert', emoji: '🔥', score: 500, color: '#f97316', gradient: 'from-orange-400 to-orange-600' },
  { level: 6, rank: 'Maître', emoji: '⚡', score: 800, color: '#eab308', gradient: 'from-yellow-400 to-yellow-600' },
  { level: 7, rank: 'Champion', emoji: '👑', score: 1200, color: '#f59e0b', gradient: 'from-amber-400 to-amber-600' },
  { level: 8, rank: 'Légende', emoji: '💎', score: 1800, color: '#06b6d4', gradient: 'from-cyan-400 to-cyan-600' },
  { level: 9, rank: 'Titan', emoji: '🚀', score: 2500, color: '#ec4899', gradient: 'from-pink-400 to-pink-600' },
  { level: 10, rank: 'Dieu Nova', emoji: '🌌', score: 5000, color: '#8b5cf6', gradient: 'from-purple-500 to-indigo-600' },
];

export function useUserLevel(snapScore: number | null): UserLevel {
  return useMemo(() => {
    const score = snapScore ?? 0;
    
    // Trouver le niveau actuel
    let currentLevelData = LEVEL_THRESHOLDS[0];
    let nextLevelData = LEVEL_THRESHOLDS[1];
    
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (score >= LEVEL_THRESHOLDS[i].score) {
        currentLevelData = LEVEL_THRESHOLDS[i];
        nextLevelData = LEVEL_THRESHOLDS[i + 1] || LEVEL_THRESHOLDS[i]; // Max level
        break;
      }
    }
    
    // Calculer la progression
    const scoreInCurrentLevel = score - currentLevelData.score;
    const scoreNeededForNextLevel = nextLevelData.score - currentLevelData.score;
    const progress = scoreNeededForNextLevel > 0 
      ? Math.min(100, (scoreInCurrentLevel / scoreNeededForNextLevel) * 100)
      : 100;
    
    const snapsToNextLevel = Math.max(0, nextLevelData.score - score);
    
    return {
      level: currentLevelData.level,
      rank: currentLevelData.rank,
      rankEmoji: currentLevelData.emoji,
      currentScore: score,
      nextLevelScore: nextLevelData.score,
      progress: Math.round(progress),
      snapsToNextLevel,
      color: currentLevelData.color,
      gradient: currentLevelData.gradient,
    };
  }, [snapScore]);
}

// Hook pour obtenir tous les niveaux (pour affichage de progression)
export function useAllLevels() {
  return LEVEL_THRESHOLDS;
}
