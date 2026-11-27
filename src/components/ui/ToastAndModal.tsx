import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import {
  emitAskAiForError,
  emitEntryError,
  getCurrentPageContext,
} from '../../services/assistantBus.ts';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  message?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (title: string, message?: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (title: string, message?: string, tone: ToastTone = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, title, message, tone }]);
      if (tone === 'error') {
        emitEntryError({
          id: String(id),
          title,
          message: message || title,
          pageContext: getCurrentPageContext(),
          timestamp: Date.now(),
        });
      }
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, tone === 'error' ? 7500 : 4200);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 shadow-lg text-slate-900 dark:text-slate-100 transition-all duration-150"
          >
            {t.tone === 'success' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            {t.tone === 'error' && (
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            {t.tone === 'info' && (
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.message && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {t.message}
                </p>
              )}
              {t.tone === 'error' && (
                <button
                  type="button"
                  onClick={() => {
                    emitAskAiForError({
                      id: String(t.id),
                      title: t.title,
                      message: t.message || t.title,
                      pageContext: getCurrentPageContext(),
                      timestamp: Date.now(),
                    });
                    setToasts((prev) => prev.filter((x) => x.id !== t.id));
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1E3A8A] text-white text-[11px] font-semibold hover:bg-blue-900 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  Ask AI to Fix
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              destructive ? 'text-red-600' : 'text-amber-600'
            }`}
          />
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5">
              {description}
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg text-white whitespace-nowrap ${
              destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[var(--sc-primary)] hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-12">
    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-4">
      {icon}
    </div>
    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
      {title}
    </h3>
    <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mt-1">
      {description}
    </p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 rounded mt-4" />
        </div>
      ))}
    </div>
    <div className="h-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
  </div>
);

export const FriendlyErrorView: React.FC<{
  status?: number;
  title?: string;
  message: string;
  onRetry?: () => void;
}> = ({ status, title, message, onRetry }) => {
  const heading =
    title ||
    (status === 403
      ? 'Access Restricted'
      : status === 404
        ? 'Record Not Found'
        : 'Unable to Load Data');

  return (
    <div className="flex flex-col items-center justify-center text-center rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 px-6 py-12">
      <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {heading}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mt-1">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--sc-primary)] text-white hover:opacity-90"
        >
          Try Again
        </button>
      )}
    </div>
  );
};
