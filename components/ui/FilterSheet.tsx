"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./primitives";

/**
 * Filters in a bottom sheet (modal on desktop). Changes are a draft until "Apply"; "Clear" resets the draft.
 * The apply button says how many results the draft would give.
 */
export function FilterSheet({ open, onClose, title, onApply, onClear, applyLabel, children }: { open: boolean; onClose: () => void; title: string; onApply: () => void; onClear: () => void; applyLabel: string; children: ReactNode }) {
  const tw = useTranslations("world");
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="mb-1 grid grid-cols-[auto_1fr] gap-2">
          <Button variant="secondary" onClick={onClear} data-testid="filter-clear">{tw("clearFilters")}</Button>
          <Button onClick={onApply} data-testid="filter-apply">{applyLabel}</Button>
        </div>
      }
    >
      <div className="space-y-6">{children}</div>
    </BottomSheet>
  );
}

/** One group inside a filter sheet. */
export function FilterGroup({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-[13px] font-extrabold uppercase tracking-wider text-mute">{title}</legend>
      {hint && <p className="mt-0.5 text-[12px] text-mute">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
