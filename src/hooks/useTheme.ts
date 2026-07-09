import { useAppStore } from '../store/useAppStore';

/**
 * Hook utilitaire pour le thème.
 * Retourne des classes Tailwind conditionnelles selon le thème actif.
 */
export function useTheme() {
  const theme = useAppStore((s) => s.theme);
  const isLight = theme === 'light';

  return {
    theme,
    isLight,

    // ── Backgrounds ──────────────────────────────────────────
    /** Fond principal de l'écran */
    bg: isLight ? 'bg-[#f0f2f8]' : 'bg-black',
    /** Fond de surface (cards, inputs) */
    surface: isLight ? 'bg-black/5' : 'bg-white/5',
    /** Fond de surface hover */
    surfaceHover: isLight ? 'hover:bg-black/8' : 'hover:bg-white/8',
    /** Fond input */
    input: isLight ? 'bg-black/6' : 'bg-white/8',
    /** Fond modal / overlay */
    overlay: isLight ? 'bg-[#e8eaf2]' : 'bg-black',
    /** Fond settings */
    settings: isLight ? 'bg-[#e8eaf2]' : 'bg-[#0d0d0f]',

    // ── Borders ───────────────────────────────────────────────
    border: isLight ? 'border-black/10' : 'border-white/8',
    borderMuted: isLight ? 'border-black/6' : 'border-white/5',
    divider: isLight ? 'divide-black/6' : 'divide-white/5',

    // ── Text ─────────────────────────────────────────────────
    text: isLight ? 'text-[#0d0e1a]' : 'text-white',
    textMuted: isLight ? 'text-black/45' : 'text-white/40',
    textFaint: isLight ? 'text-black/30' : 'text-white/25',
    textSubtle: isLight ? 'text-black/55' : 'text-white/50',

    // ── Icon buttons ─────────────────────────────────────────
    iconBtn: isLight
      ? 'bg-black/8 hover:bg-black/12 text-[#0d0e1a]'
      : 'bg-white/10 hover:bg-white/15 text-white',

    // ── Ring offset (avatar) ──────────────────────────────────
    ringOffset: isLight ? 'ring-offset-[#f0f2f8]' : 'ring-offset-black',

    // ── Tab bar gradient ──────────────────────────────────────
    tabGradient: isLight
      ? 'linear-gradient(to top, rgba(240,242,248,1) 0%, rgba(240,242,248,0.85) 55%, transparent 100%)'
      : 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 55%, transparent 100%)',

    // ── Tab icons ─────────────────────────────────────────────
    tabActive: isLight ? 'text-[#0d0e1a]' : 'text-white',
    tabInactive: isLight ? 'text-black/35' : 'text-white/45',
    tabDot: isLight ? 'bg-[#0d0e1a]' : 'bg-white',

    // ── Skeleton ──────────────────────────────────────────────
    skeleton: isLight ? 'bg-black/8' : 'bg-white/10',

    // ── Placeholder text ──────────────────────────────────────
    /** Safe static Tailwind class for input placeholder colour */
    placeholder: isLight ? 'placeholder-black/30' : 'placeholder-white/25',
  };
}
