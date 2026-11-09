"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Hide the footer on full-screen app views (the world map). */
export function FooterGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path === "/world") return null;
  return <>{children}</>;
}
