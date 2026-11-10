import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Alien } from "@/components/art/Alien";
import { ButtonLink } from "./primitives";

export function LoadingSkeleton({ variant = "cards", className }: { variant?: "cards" | "page" | "list" | "map"; className?: string }) {
  const tu = useTranslations("ui");
  if (variant === "map") return <div className={cn("skeleton h-full w-full", className)} aria-label={tu("loadingMap")} role="status" />;
  if (variant === "list")
    return (
      <div className={cn("min-h-[100dvh] space-y-3 px-4", className)} role="status" aria-label={tu("loading")}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="skeleton size-16 rounded-2xl" />
            <div className="flex-1 space-y-2 py-1">
              <div className="skeleton h-4 w-2/3 rounded-full" />
              <div className="skeleton h-3 w-1/2 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  if (variant === "page")
    return (
      <div className={cn("min-h-[100dvh] space-y-4 px-4 pt-6", className)} role="status" aria-label={tu("loadingPage")}>
        <div className="skeleton h-10 w-3/4 rounded-xl" />
        <div className="skeleton h-4 w-1/2 rounded-full" />
        <div className="skeleton aspect-[5/3] w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
        </div>
      </div>
    );
  return (
    <div className={cn("rail", className)} role="status" aria-label={tu("loading")}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="w-[78vw] max-w-[320px] space-y-3">
          <div className="skeleton aspect-[5/3] rounded-3xl" />
          <div className="skeleton h-5 w-3/4 rounded-full" />
          <div className="skeleton h-3 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action, className }: { title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-3xl border-2 border-dashed border-line px-6 py-8 text-center", className)}>
      <Alien look={{ species: "jelly", body: "#55BCEB", accent: "#B6F05C", outfit: "none", outfitColor: "#000", accessory: "none" }} className="h-24 w-24" />
      <h3 className="mt-3 text-xl uppercase">{title}</h3>
      {body && <p className="mt-2 max-w-xs text-sm text-mute">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something wobbled", body = "This page slipped into another dimension.", retry }: { title?: string; body?: string; retry?: ReactNode }) {
  const tu = useTranslations("ui");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <Alien look={{ species: "fuzz", body: "#FF625C", accent: "#FFAD5B", outfit: "none", outfitColor: "#000", accessory: "antenna" }} className="h-32 w-32" />
      <h1 className="mt-4 text-4xl uppercase">{title}</h1>
      <p className="mt-3 text-mute">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {retry}
        <ButtonLink href="/" variant="secondary">
          {tu("backHome")}
        </ButtonLink>
      </div>
    </div>
  );
}
