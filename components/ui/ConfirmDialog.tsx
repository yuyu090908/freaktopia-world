"use client";

import type { ReactNode } from "react";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./primitives";

/** Confirmation before an action that can't be undone: cancel (secondary) and confirm (destructive or primary). */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel, onConfirm, onCancel, destructive = true }: { open: boolean; title: string; children: ReactNode; confirmLabel: string; cancelLabel: string; onConfirm: () => void; onCancel: () => void; destructive?: boolean }) {
  return (
    <BottomSheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <div className="mb-1 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={destructive ? "destructive" : "primary"} onClick={onConfirm} data-testid="confirm-action">{confirmLabel}</Button>
        </div>
      }
    >
      <div className="text-sm">{children}</div>
    </BottomSheet>
  );
}
