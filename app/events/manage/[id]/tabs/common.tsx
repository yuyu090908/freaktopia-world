"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { View } from "../ctx";

/** Text for a detected conflict, with requirement / check keys translated. */
export function useConflictText() {
  const t = useTranslations("ops");
  return useCallback(
    (c: View["conflicts"][number]) => {
      const values: Record<string, string | number> = { ...c.values };
      if (typeof values.role === "string") values.role = t(`req.${values.role}`);
      if (typeof values.check === "string") values.check = t(`safety.${values.check}`);
      return t(`conflict.${c.kind}`, values as Record<string, string>);
    },
    [t],
  );
}

/** Member display name by user id. */
export function useMemberName(v: View) {
  const t = useTranslations("ops");
  return useCallback((uid: string | null | undefined) => (uid ? v.members.find((m) => m.userId === uid)?.displayName ?? t("formerMember") : t("unassigned")), [v.members, t]);
}

export const reqLabel = (t: ReturnType<typeof useTranslations>, v: View, reqId: string | null | undefined) => {
  const r = v.requirements.find((x) => x.id === reqId);
  return r ? t(`req.${r.key}`) : "—";
};
