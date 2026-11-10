"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Bot, CheckCircle2, ShieldAlert } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, btnClass } from "@/components/ui/primitives";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { api, useAuth } from "@/lib/auth/client";
import { toast } from "@/lib/store";
import { cn } from "@/lib/utils";

/** GET JSON from /api/ops/… with a reload function. */
export function useOps<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<{ code: string; status: number } | null>(null);
  const [loading, setLoading] = useState(!!url);
  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setData(j as T);
        setError(null);
      } else setError({ code: j?.error?.code ?? "generic", status: r.status });
    } catch {
      setError({ code: "generic", status: 0 });
    }
    setLoading(false);
  }, [url]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, reload: load };
}

/** Translated message for an API error code. */
export function useOpsError() {
  const t = useTranslations("ops");
  return useCallback((code: string) => (t.has(`err.${code}`) ? t(`err.${code}`) : t("err.generic")), [t]);
}

/** POST to the ops API, toast the error, return data or null. */
export function useOpsPost() {
  const msg = useOpsError();
  return useCallback(
    async <T = Record<string, unknown>,>(path: string, body: unknown = {}, success?: string): Promise<T | null> => {
      const r = await api<T>(`/api/ops/${path}`, "POST", body);
      if (!r.ok) {
        toast({ title: msg(r.code), tone: "error" });
        return null;
      }
      if (success) toast({ title: success, tone: "success" });
      return r.data;
    },
    [msg],
  );
}

export function useMoney() {
  const f = useFormatter();
  return useCallback((n: number | null | undefined) => (n == null ? "—" : f.number(n, { style: "currency", currency: "USD", maximumFractionDigits: 0 })), [f]);
}

export function useWhen() {
  const f = useFormatter();
  return useCallback(
    (iso: string | null | undefined, tz?: string, withTime = true) =>
      iso ? f.dateTime(new Date(iso), { dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}), ...(tz ? { timeZone: tz } : {}) }) : "—",
    [f],
  );
}

/** Rule-based suggestion (no AI model connected) vs. confirmed fact. Always shown next to planner output. */
export function SuggestionBadge({ className }: { className?: string }) {
  const t = useTranslations("ops");
  return (
    <span title={t("suggestionHint")} className={cn("inline-flex items-center gap-1 rounded-full border border-purple/60 bg-purple/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-purple", className)}>
      <Bot className="size-3" aria-hidden />
      {t("suggestion")}
    </span>
  );
}

export function ConfirmedBadge({ className, label }: { className?: string; label?: string }) {
  const t = useTranslations("ops");
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-acid/60 bg-acid/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-acid", className)}>
      <CheckCircle2 className="size-3" aria-hidden />
      {label ?? t("confirmed")}
    </span>
  );
}

export function SafetyNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="note" className={cn("flex gap-3 rounded-2xl border border-coral/50 bg-coral/10 p-3 text-sm text-cream", className)}>
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Explicit confirmation for contracts, bookings, payments and safety approvals: the person must tick the box
 * that states what will happen before the button is enabled.
 */
export function ConfirmSheet({ open, onClose, title, statement, children, confirmLabel, onConfirm, busy }: { open: boolean; onClose: () => void; title: string; statement: string; children?: ReactNode; confirmLabel: string; onConfirm: () => void | Promise<void>; busy?: boolean }) {
  const t = useTranslations("ops");
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!open) setChecked(false);
  }, [open]);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={!checked || busy} onClick={() => void onConfirm()} data-testid="confirm-action">
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {children}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-line bg-surface p-3 text-sm">
          <input type="checkbox" className="mt-1 size-5 accent-[#B6F05C]" checked={checked} onChange={(e) => setChecked(e.target.checked)} data-testid="confirm-check" />
          <span>{statement}</span>
        </label>
      </div>
    </BottomSheet>
  );
}

/** Ops features need a verified account (existing sign-in). */
export function SignInGate({ children, returnTo }: { children: ReactNode; returnTo: string }) {
  const t = useTranslations("ops");
  const href = useLocalHref();
  const status = useAuth((s) => s.status);
  const verified = useAuth((s) => s.me?.user.emailVerified ?? false);
  if (status === "loading") return <div className="h-40 animate-pulse rounded-3xl bg-surface" aria-busy="true" />;
  if (status === "signedOut")
    return (
      <div className="rounded-3xl border-2 border-dashed border-line p-6 text-center">
        <h2 className="text-2xl uppercase">{t("signInTitle")}</h2>
        <p className="mt-2 text-sm text-mute">{t("signInBody")}</p>
        <Link href={href(`/login?returnTo=${encodeURIComponent(returnTo)}`)} className={btnClass("primary", "md", "mt-4")}>
          {t("signIn")}
        </Link>
      </div>
    );
  if (!verified)
    return (
      <div className="rounded-3xl border-2 border-dashed border-orange/50 p-6 text-center">
        <h2 className="text-2xl uppercase">{t("verifyTitle")}</h2>
        <p className="mt-2 text-sm text-mute">{t("verifyBody")}</p>
      </div>
    );
  return <>{children}</>;
}

export function Section({ title, action, children, id, className }: { title: string; action?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("rounded-3xl border border-line bg-surface/80 p-4 md:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-xl uppercase md:text-2xl">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export const STATUS_COLOR: Record<string, string> = {
  needed: "#FF625C", recruiting: "#FFAD5B", proposed: "#55BCEB", booked: "#B6F05C", covered: "#B6F05C", not_needed: "#5a5a5a",
  open: "#FFAD5B", filled: "#B6F05C", closed: "#5a5a5a", submitted: "#55BCEB", shortlisted: "#A276E9", accepted: "#B6F05C", rejected: "#5a5a5a", withdrawn: "#5a5a5a", declined: "#5a5a5a",
  held: "#FFAD5B", confirmed: "#B6F05C", cancelled: "#FF625C", completed: "#A276E9", agreed: "#B6F05C", changed: "#FFAD5B",
  todo: "#5a5a5a", doing: "#55BCEB", done: "#B6F05C", in_progress: "#55BCEB", resolved: "#B6F05C",
  low: "#55BCEB", medium: "#FFAD5B", high: "#FF625C", critical: "#FF625C", warning: "#FFAD5B",
};

export function StatusPill({ status, label }: { status: string; label: string }) {
  const c = STATUS_COLOR[status] ?? "#5a5a5a";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider" style={{ borderColor: c, color: c }}>
      <span className="size-1.5 rounded-full" style={{ background: c }} aria-hidden />
      {label}
    </span>
  );
}

/** Reads a File as base64 for the JSON upload endpoints (max 5 MB, checked on the server too). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
