"use client";

import { useMemo } from "react";
import { Alien } from "@/components/art/Alien";
import { BASE_ACCESSORIES, COLOR_KEYS, EYES, FAMILIES, MOUTHS, OUTFITS, PATTERNS, toLook } from "@/lib/alien/catalog";
import { useAuth } from "@/lib/auth/client";
import { rng } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** A stable stand-in alien for a pseudonymous DAO handle (demo members have no account alien). */
export function handleLook(handle: string) {
  const r = rng(`dao:${handle}`);
  const pick = <T,>(l: readonly T[]) => l[Math.floor(r() * l.length)];
  const body = pick(COLOR_KEYS);
  return toLook({ family: pick(FAMILIES), bodyColor: body, accentColor: pick(COLOR_KEYS.filter((c) => c !== body)), eyes: pick(EYES), mouth: pick(MOUTHS), pattern: pick(PATTERNS), accessory: pick(BASE_ACCESSORIES), outfit: pick(OUTFITS), outfitColor: pick(COLOR_KEYS), special: "none" });
}

/**
 * Avatar for a DAO member, proposal author or comment author. "Me" uses the signed-in account alien,
 * so the same alien shows up in LIVE, on the map and here. Purely visual: it never affects voting power.
 */
export function DaoAvatar({ handle, mine = false, size = 32, className }: { handle: string; mine?: boolean; size?: number; className?: string }) {
  const me = useAuth((s) => s.me);
  const look = useMemo(() => (mine && me?.alien ? me.alien.look : handleLook(handle)), [mine, me?.alien, handle]);
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-surface-2", mine ? "border-acid" : "border-line", className)} style={{ width: size, height: size }} aria-hidden data-testid={mine ? "dao-my-avatar" : undefined}>
      <Alien look={look} className="translate-y-[6%] scale-110" />
    </span>
  );
}
