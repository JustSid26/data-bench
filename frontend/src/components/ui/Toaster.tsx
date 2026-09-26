import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { Icon } from "../icons";
import { spring, tween } from "../../lib/motion";

type Tone = "info" | "good" | "warn" | "bad";

interface Toast {
  id: number;
  title: string;
  detail?: ReactNode;
  tone: Tone;
  action?: { label: string; run: () => void };
  duration: number;
}

type Push = (toast: Omit<Toast, "id" | "tone" | "duration"> & { tone?: Tone; duration?: number }) => void;

const ToastContext = createContext<Push | null>(null);

const TONE: Record<Tone, { icon: string; className: string }> = {
  info: { icon: "info", className: "text-accent-fg" },
  good: { icon: "ok", className: "text-good" },
  warn: { icon: "warn", className: "text-warn" },
  bad: { icon: "critical", className: "text-bad" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((toast) => toast.id !== id)), []);

  const push = useCallback<Push>((toast) => {
    const id = ++next.current;
    // newest on top, at most four so a burst of actions cannot bury the screen
    setToasts((all) => [{ tone: "info" as Tone, duration: 5000, ...toast, id }, ...all].slice(0, 4));
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ol
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </ol>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const close = useCallback(() => onDismiss(toast.id), [onDismiss, toast.id]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(close, toast.duration);
    return () => window.clearTimeout(timer);
  }, [paused, toast.duration, close]);

  const tone = TONE[toast.tone];
  return (
    <m.li
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: spring.soft }}
      exit={{ opacity: 0, x: 40, transition: tween.fast }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex items-start gap-3 rounded-card border border-line bg-card-raised px-3.5 py-3 shadow-lg"
    >
      <Icon name={tone.icon} className={`mt-[1px] size-4 shrink-0 ${tone.className}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{toast.title}</p>
        {toast.detail && <div className="mt-0.5 text-[12px] text-ink-muted">{toast.detail}</div>}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.run();
            close();
          }}
          className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-accent-fg transition-colors hover:bg-hover"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-md p-1 text-ink-faint transition-colors hover:bg-hover hover:text-ink"
      >
        <Icon name="close" className="size-3.5" />
      </button>
    </m.li>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
