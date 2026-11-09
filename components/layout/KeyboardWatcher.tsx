"use client";

import { useEffect } from "react";
import { useHydrated } from "@/lib/store";

/**
 * Flags <html data-kb="open"> while the on-screen keyboard is visible so the
 * fixed bottom nav steps aside and focused inputs stay in view. Also triggers
 * the one-time rehydration of persisted demo state.
 */
export function KeyboardWatcher() {
  useHydrated();
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const open = window.innerHeight - vv.height > 150;
      document.documentElement.dataset.kb = open ? "open" : "closed";
    };
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t.matches("input, textarea, select")) setTimeout(() => t.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
    };
    vv.addEventListener("resize", update);
    document.addEventListener("focusin", onFocus);
    return () => {
      vv.removeEventListener("resize", update);
      document.removeEventListener("focusin", onFocus);
    };
  }, []);
  return null;
}
