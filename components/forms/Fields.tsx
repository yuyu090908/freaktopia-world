"use client";

import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-2xl border-2 border-line bg-ink px-4 text-base text-cream outline-none placeholder:text-mute/70 focus:border-acid aria-[invalid=true]:border-coral";

export function Field({ label, hint, error, children, id, optional }: { label: string; hint?: string; error?: string; children: ReactNode; id: string; optional?: boolean }) {
  const t = useTranslations("common");
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-bold">
        <span>{label}</span>
        {optional && <span className="text-xs font-semibold text-mute">{t("optional")}</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="ja text-xs text-mute">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(base, "min-h-13 h-[52px]", className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} rows={4} className={cn(base, "py-3", className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={cn(base, "h-[52px] appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23F5F2EA%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:20px] bg-[right_14px_center] bg-no-repeat pr-11", className)} {...p} />;
});

export function StepProgress({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  return (
    <div className="px-4 md:px-0">
      <div className="flex items-center justify-between text-sm font-bold">
        <span>
          Step {step + 1} <span className="text-mute">/ {total}</span>
        </span>
        <span className="text-acid">{labels[step]}</span>
      </div>
      <div className="mt-2 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${total}: ${labels[step]}`}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={cn("h-2 flex-1 rounded-full transition-colors", i <= step ? "bg-acid" : "bg-line")} />
        ))}
      </div>
    </div>
  );
}

export function ToggleRow({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border-2 border-line bg-surface px-4 py-2 text-left">
      <span className="min-w-0">
        <span className="block font-bold">{label}</span>
        {sub && <span className="ja block text-xs text-mute">{sub}</span>}
      </span>
      <span className={cn("relative h-8 w-14 shrink-0 rounded-full border-2 border-ink transition-colors", checked ? "bg-acid" : "bg-line")}>
        <span className={cn("absolute top-0.5 size-6 rounded-full bg-cream shadow transition-transform", checked ? "translate-x-[26px]" : "translate-x-0.5")} />
      </span>
    </button>
  );
}
