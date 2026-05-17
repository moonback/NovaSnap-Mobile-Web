import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-emerald-400 shrink-0" />,
  error:   <AlertCircle  size={18} className="text-red-400 shrink-0" />,
  info:    <Info         size={18} className="text-cyan-400 shrink-0" />,
};

// ─── Border accent per type ───────────────────────────────────────────────────
const borders: Record<ToastType, string> = {
  success: 'border-emerald-500/40',
  error:   'border-red-500/40',
  info:    'border-cyan-500/40',
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-3), { id, type, message }]); // max 4 visible
    timers.current[id] = setTimeout(() => removeToast(id), 4500);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container — above everything, safe-area aware */}
      <div className="fixed top-4 inset-x-3 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`
              pointer-events-auto
              flex items-start gap-3 w-full
              px-4 py-3 rounded-2xl
              bg-[#111]/90 backdrop-blur-xl
              border ${borders[t.type]}
              shadow-[0_8px_32px_rgba(0,0,0,0.5)]
              animate-in slide-in-from-top-2 fade-in duration-300
            `}
            style={{ willChange: 'transform, opacity' }}
          >
            {icons[t.type]}
            <p className="flex-1 text-sm text-white/90 font-medium leading-snug">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="text-white/30 hover:text-white/70 transition-colors shrink-0 mt-[1px]"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
