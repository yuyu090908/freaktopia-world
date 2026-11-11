"use client";

import { useEffect } from "react";

/**
 * Asks before the tab is closed or reloaded while a form has unsaved input. Forms that keep a draft
 * (event create, venue listing) don't need it; their input survives a reload.
 */
export function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
}
