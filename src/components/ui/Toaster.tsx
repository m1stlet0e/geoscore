"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: string; kind: ToastKind; title: string; description?: string };

type ToastContextValue = {
  show: (t: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe fallback during SSR or outside provider — log only
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((t: Omit<Toast, 'id'>) => {
    counter.current += 1;
    const id = `t${Date.now()}_${counter.current}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);

  // Expose a tiny global API so non-React code (server-action errors) can call it
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as unknown as { __geoscoreToast?: ToastContextValue }).__geoscoreToast = {
      show,
      success: (title, description) => show({ kind: 'success', title, description }),
      error: (title, description) => show({ kind: 'error', title, description }),
      info: (title, description) => show({ kind: 'info', title, description }),
    };
    return () => {
      delete (window as unknown as { __geoscoreToast?: ToastContextValue }).__geoscoreToast;
    };
  }, [show]);

  const value: ToastContextValue = {
    show,
    success: (title, description) => show({ kind: 'success', title, description }),
    error: (title, description) => show({ kind: 'error', title, description }),
    info: (title, description) => show({ kind: 'info', title, description }),
  };

  return (
    <ToastContext.Provider value={value}>
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end"
      >
        {toasts.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info;
          const tone =
            t.kind === 'success'
              ? 'border-emerald-500/30 bg-emerald-50 text-emerald-100'
              : t.kind === 'error'
                ? 'border-rose-500/30 bg-rose-50 text-rose-100'
                : 'border-indigo-500/30 bg-indigo-50 text-indigo-100';
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md animate-fade-up',
                tone
              )}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-neutral-900">{t.title}</div>
                {t.description ? (
                  <div className="mt-0.5 text-xs text-neutral-300/90">{t.description}</div>
                ) : null}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200/50 hover:text-neutral-800"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
