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
 * - opening and closing slide (about 220 ms; instant with reduced motion)
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  modal = true,
  headerStart,
  tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** false = no dimmed backdrop (used on the map so it stays visible). */
  modal?: boolean;
  /** Shown before the title (for example a logo mark). */
  headerStart?: ReactNode;
  /** "cosmic": the darker control-panel look used by the main menu. */
  tone?: "default" | "cosmic";
}) {
  const tu = useTranslations("ui");
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Stay on screen for the closing slide, then unmount. While closing it is inert and hidden from assistive tech.
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setShown(true);
      setClosing(false);
      return;
    }
    setClosing(true);
    const t = setTimeout(() => {
      setShown(false);
      setClosing(false);
    }, 200);
    return () => clearTimeout(t);
  }, [open]);

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

  if (!mounted || !(open || shown)) return null;
  const out = closing && !open;

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[70] flex items-end justify-center md:items-center", out && "pointer-events-none")}
      role="presentation"
      aria-hidden={out || undefined}
      {...(out ? { inert: true } : {})}
    >
      {modal && (
        <button
          aria-label={tu("close")}
          tabIndex={-1}
          className={cn("absolute inset-0 bg-black/70", out ? "animate-[sheet-fade-out_200ms_ease-in_forwards]" : "animate-[sheet-fade-in_200ms_ease-out]")}
          onClick={onClose}
        />
      )}
      <div
        ref={panel}
        role="dialog"
        aria-modal={modal}
        aria-labelledby={id}
        className={cn(
          "relative flex max-h-[88dvh] w-full flex-col rounded-t-[28px] border-2 border-b-0",
          tone === "cosmic" ? "border-[#383044] bg-[#120F19] shadow-[0_-24px_70px_rgba(0,0,0,0.75),0_-2px_28px_-6px_rgba(195,161,255,0.35)]" : "border-line bg-surface shadow-[0_-20px_60px_rgba(0,0,0,0.6)]",
          "md:mb-0 md:max-w-lg md:rounded-[28px] md:border-b-2",
          out ? "animate-[sheet-out_200ms_ease-in_forwards]" : "animate-[sheet-in_220ms_ease-out]",
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
          <div className="flex min-w-0 items-center gap-2.5">
            {headerStart}
            <h2 id={id} className="min-w-0 text-2xl uppercase">
              {title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label={tu("close")} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 hover:bg-line">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pt-3">{footer}</div>}
      </div>
      <style>{`@keyframes sheet-in{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}@keyframes sheet-out{from{transform:none;opacity:1}to{transform:translateY(40px);opacity:0}}@keyframes sheet-fade-in{from{opacity:0}to{opacity:1}}@keyframes sheet-fade-out{from{opacity:1}to{opacity:0}}`}</style>
    </div>,
    document.body,
  );
}
