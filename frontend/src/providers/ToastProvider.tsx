/**
 * Toast notification provider and renderer.
 *
 * Reads from the notifications Zustand store and renders all
 * active toasts in a fixed portal at the bottom-right of the
 * viewport. Toasts auto-dismiss after their configured duration.
 *
 * Uses Framer Motion for entrance/exit animations. The AnimatePresence
 * component enables exit animations when toasts are removed from the
 * store.
 */

"use client";

import { useNotificationsStore } from "@/stores/notifications.store";
import { AnimatePresence, motion } from "framer-motion";
import { toastVariants } from "@/animations/presets";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Toast } from "@/stores/notifications.store";

const variantStyles = {
  success: {
    container: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950",
    icon: "text-emerald-600 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  error: {
    container: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950",
    icon: "text-red-600 dark:text-red-400",
    Icon: XCircle,
  },
  warning: {
    container: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
    icon: "text-amber-600 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  info: {
    container: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950",
    icon: "text-blue-600 dark:text-blue-400",
    Icon: Info,
  },
  loading: {
    container: "border-border bg-background",
    icon: "text-muted-foreground",
    Icon: Loader2,
  },
} as const;

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useNotificationsStore();
  const styles = variantStyles[toast.variant];
  const IconComponent = styles.Icon;
  const isLoading = toast.variant === "loading";

  return (
    <motion.div
      layout
      variants={toastVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg",
        styles.container,
      )}
      role="alert"
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
    >
      <IconComponent
        className={cn("mt-0.5 h-4 w-4 shrink-0", styles.icon, isLoading && "animate-spin")}
        aria-hidden="true"
      />
      <div className="flex-1 space-y-0.5">
        <p className="text-sm font-medium text-foreground">{toast.title}</p>
        {toast.description && (
          <p className="text-sm text-muted-foreground">{toast.description}</p>
        )}
      </div>
      {!isLoading && (
        <button
          onClick={() => removeToast(toast.id)}
          className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts } = useNotificationsStore();

  return (
    <>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
