"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet on mobile, centred modal on tablet/desktop.
 * - Esc / backdrop / close button / drag-down on the handle closes it
 * - focus moves into the sheet and returns to the opener on close
 * - body scroll is locked while open
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  modal = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** false = no dimmed backdrop (used on the map so it stays visible). */
  modal?: boolean;
}) {
  const tu = useTranslations("ui");
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const prev = document.body.style.overflow;
    if (modal) document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      const el = panel.current?.querySelector<HTMLElement>("[data-autofocus], button, a, input, select, textarea");
      el?.focus({ preventScroll: true });
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current && modal) {
        const f = panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), a, input, select, textarea, [tabindex]:not([tabindex='-1'])");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      (opener.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, modal]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center" role="presentation">
      {modal && <button aria-label={tu("close")} tabIndex={-1} className="absolute inset-0 bg-black/70" onClick={onClose} />}
      <div
        ref={panel}
        role="dialog"
        aria-modal={modal}
        aria-labelledby={id}
        className={cn(
          "relative flex max-h-[88dvh] w-full flex-col rounded-t-[28px] border-2 border-b-0 border-line bg-surface shadow-[0_-20px_60px_rgba(0,0,0,0.6)]",
          "md:mb-0 md:max-w-lg md:rounded-[28px] md:border-b-2",
          "animate-[sheet-in_220ms_ease-out]",
          className,
        )}
        style={{ transform: drag ? `translateY(${drag}px)` : undefined, paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      >
        <div
          className="flex cursor-grab touch-none justify-center pb-1 pt-3 md:hidden"
          onPointerDown={(e) => {
            start.current = e.clientY;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current));
          }}
          onPointerUp={() => {
            if (drag > 90) onClose();
            setDrag(0);
            start.current = null;
          }}
          aria-hidden
        >
          <span className="h-1.5 w-12 rounded-full bg-cream/30" />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-1 md:pt-5">
          <h2 id={id} className="min-w-0 text-2xl uppercase">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={tu("close")} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 hover:bg-line">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pt-3">{footer}</div>}
      </div>
      <style>{`@keyframes sheet-in{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}`}</style>
    </div>,
    document.body,
  );
}
