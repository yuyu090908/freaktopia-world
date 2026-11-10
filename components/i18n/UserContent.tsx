"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { useAuth } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

/**
 * User-written content (event descriptions, DAO posts) is always shown as written.
 * "See translation" asks /api/translate; the result is labelled as machine translation with a way back.
 * Without a connected translation API nothing is translated, and the reader is told so.
 */
export function UserContent({ text, sourceLang = "en", className, as: Tag = "p" }: { text: string; sourceLang?: string; className?: string; as?: "p" | "div" }) {
  const t = useTranslations("translation");
  const locale = useLocale();
  const cfg = useAuth((s) => s.config);
  const [state, setState] = useState<{ kind: "original" } | { kind: "loading" } | { kind: "translated"; text: string; provider: string } | { kind: "unavailable" } | { kind: "failed" }>({ kind: "original" });
  const sameLanguage = locale.split("-")[0] === sourceLang.split("-")[0];

  const translate = async () => {
    if (cfg?.translation !== "connected") return setState({ kind: "unavailable" });
    setState({ kind: "loading" });
    const r = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, target: locale }) }).catch(() => null);
    if (!r) return setState({ kind: "failed" });
    if (r.status === 503) return setState({ kind: "unavailable" });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.text) return setState({ kind: "failed" });
    setState({ kind: "translated", text: j.text, provider: j.provider });
  };

  const translated = state.kind === "translated";
  return (
    <div className={cn("space-y-1.5", className)} data-testid="user-content" data-state={state.kind}>
      <Tag lang={translated ? locale : sourceLang} className="whitespace-pre-wrap break-words">{translated ? state.text : text}</Tag>
      {!sameLanguage && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-mute">
          {translated ? (
            <>
              <span className="inline-flex items-center gap-1"><Languages className="size-3.5" aria-hidden />{t("machine", { provider: state.provider })}</span>
              <button type="button" onClick={() => setState({ kind: "original" })} className="min-h-11 font-bold text-acid underline underline-offset-4">{t("seeOriginal")}</button>
            </>
          ) : (
            <button type="button" onClick={translate} disabled={state.kind === "loading"} className="inline-flex min-h-11 items-center gap-1 font-bold text-acid underline underline-offset-4" data-testid="see-translation">
              <Languages className="size-3.5" aria-hidden />
              {t("seeTranslation")}
            </button>
          )}
          {state.kind === "unavailable" && <span role="status" data-testid="translation-unavailable">{t("notConfigured")}</span>}
          {state.kind === "failed" && <span role="status">{t("failed")}</span>}
        </div>
      )}
    </div>
  );
}
