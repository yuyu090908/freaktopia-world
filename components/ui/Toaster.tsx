"use client";

import { useToast } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CheckCircle2, Sparkles, X, AlertTriangle, Bell } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+68px)] z-[80] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => {
        const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "level" ? Sparkles : t.tone === "error" ? AlertTriangle : Bell;
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border-2 border-ink px-4 py-3 text-ink shadow-[0_6px_0_0_#000] animate-[toast-in_200ms_ease-out]",
              t.tone === "level" ? "bg-purple" : t.tone === "error" ? "bg-coral" : t.tone === "success" ? "bg-acid" : "bg-cream",
            )}
          >
            <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="font-display text-base uppercase leading-tight">{t.title}</div>
              {t.body && <div className="mt-0.5 text-sm font-medium leading-snug">{t.body}</div>}
            </div>
            <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="-m-2 inline-flex size-11 items-center justify-center rounded-full">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
      <style>{`@keyframes toast-in{from{transform:translateY(-12px);opacity:0}to{transform:none;opacity:1}}`}</style>
    </div>
  );
}
