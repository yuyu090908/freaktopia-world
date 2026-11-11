"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Chip } from "@/components/ui/primitives";
import { Section } from "@/components/ops/shared";
import { useMusic, useMusicPost } from "@/components/music/shared";
import { appNow } from "@/lib/clock";
import type { DayStatus, DjAvailability } from "@/lib/music/types";
import { cn } from "@/lib/utils";

const COLORS: Record<DayStatus, string> = { available: "#B6F05C", tentative: "#FFAD5B", booked: "#A276E9", unavailable: "#FF625C", private: "#5a5a5a" };
const BRUSHES: (DayStatus | "clear")[] = ["available", "tentative", "unavailable", "private", "clear"];

/**
 * The DJ's own calendar. Others only ever see "available", "tentative" or "not available" for a day:
 * never notes, never why, and PRIVATE looks like any other unavailable day.
 */
export function CalendarPanel() {
  const t = useTranslations("music");
  const post = useMusicPost();
  const { data, reload } = useMusic<{ days: DjAvailability[] }>("/api/music/me/availability");
  const [offset, setOffset] = useState(0);
  const [brush, setBrush] = useState<DayStatus | "clear">("available");
  const [pending, setPending] = useState<Record<string, DayStatus | "clear">>({});
  const now = new Date(appNow());
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const days = useMemo(() => {
    const out: string[] = [];
    for (let d = new Date(month); d.getUTCMonth() === month.getUTCMonth(); d = new Date(d.getTime() + 86_400_000)) out.push(d.toISOString().slice(0, 10));
    return out;
  }, [month]);
  const byDay = new Map((data?.days ?? []).map((d) => [d.day, d]));
  const statusOf = (day: string) => (pending[day] !== undefined ? (pending[day] === "clear" ? null : pending[day]) : byDay.get(day)?.status ?? null);
  const lead = (month.getUTCDay() + 6) % 7; // Monday first
  const save = async () => {
    const list = Object.entries(pending).map(([day, status]) => ({ day, status }));
    if (!list.length) return;
    if (await post("availability", { days: list }, { success: t("calendarSaved") })) {
      setPending({});
      reload();
    }
  };
  const label = month.toLocaleDateString(undefined, { year: "numeric", month: "long", timeZone: "UTC" });
  return (
    <Section title={t("calendarTitle")} id="cal-h">
      <p className="mb-3 text-sm text-mute">{t("calendarSub")}</p>
      <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t("brush")}>
        {BRUSHES.map((b) => (
          <Chip key={b} active={brush === b} onClick={() => setBrush(b)} role="radio" aria-checked={brush === b} data-testid={`brush-${b}`}>
            {b !== "clear" && <span className="mr-1 inline-block size-2.5 rounded-full" style={{ background: COLORS[b] }} aria-hidden />}
            {t(`day.${b}`)}
          </Chip>
        ))}
      </div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="inline-flex size-11 items-center justify-center" aria-label={t("prevMonth")} disabled={offset <= 0} onClick={() => setOffset((o) => Math.max(0, o - 1))}><ChevronLeft className="size-5" aria-hidden /></button>
        <b>{label}</b>
        <button type="button" className="inline-flex size-11 items-center justify-center" aria-label={t("nextMonth")} disabled={offset >= 11} onClick={() => setOffset((o) => Math.min(11, o + 1))}><ChevronRight className="size-5" aria-hidden /></button>
      </div>
      <div className="grid grid-cols-7 gap-1" data-testid="calendar">
        {Array.from({ length: lead }).map((_, i) => <span key={`l${i}`} />)}
        {days.map((day) => {
          const s = statusOf(day);
          const booked = byDay.get(day)?.status === "booked";
          const past = day < now.toISOString().slice(0, 10);
          return (
            <button
              key={day}
              type="button"
              disabled={past || booked}
              onClick={() => setPending((p) => ({ ...p, [day]: brush }))}
              className={cn("flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl border text-sm font-bold disabled:opacity-50", pending[day] !== undefined ? "border-cream" : "border-line")}
              style={s ? { background: `${COLORS[s]}33`, borderColor: COLORS[s] } : undefined}
              aria-label={`${day}: ${s ? t(`day.${s}`) : t("day.unset")}`}
              data-day={day}
              data-status={s ?? "unset"}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <Button onClick={() => void save()} disabled={!Object.keys(pending).length} data-testid="calendar-save">{t("save")}</Button>
      </div>
    </Section>
  );
}
