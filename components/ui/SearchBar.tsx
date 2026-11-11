"use client";

import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Search field: 52px tall, 16px text (no iOS zoom), clear button, Enter submits. */
export function SearchBar({ id, value, onChange, placeholder, onSubmit, className }: { id: string; value: string; onChange: (v: string) => void; placeholder: string; onSubmit?: () => void; className?: string }) {
  const t = useTranslations("events");
  return (
    <form
      role="search"
      className={cn("relative min-w-0 flex-1", className)}
      onSubmit={(e) => {
        e.preventDefault();
        (document.activeElement as HTMLElement)?.blur();
        onSubmit?.();
      }}
    >
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-mute" aria-hidden />
      <input
        id={id}
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[52px] w-full rounded-full border border-line bg-surface pl-12 pr-12 text-base outline-none placeholder:text-mute focus:border-acid"
      />
      {value && (
        <button type="button" aria-label={t("clearSearch")} onClick={() => onChange("")} className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full hover:bg-surface-2">
          <X className="size-4" />
        </button>
      )}
    </form>
  );
}
