"use client";

import { useTranslations } from "next-intl";
import { Section } from "@/components/ops/shared";
import { useMusic } from "@/components/music/shared";

interface Res {
  totals: { plays: number; plays30: number; listeners: number; listeners30: number; likes: number; saves: number; playlistAdds: number; bookingRequests: number; inquiries: number; confirmed: number };
  excluded: Record<string, number>;
  tracks: { id: string; title: string; plays: number; listeners: number; likes: number; saves: number; playlistAdds: number }[];
}

/** Only measured numbers. Profile views are not counted, so they are not shown as a number. */
export function AnalyticsPanel() {
  const t = useTranslations("music");
  const { data } = useMusic<Res>("/api/music/me/analytics");
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-surface" aria-busy="true" />;
  const tiles: [string, number | string][] = [
    [t("aPlays"), data.totals.plays], [t("aPlays30"), data.totals.plays30], [t("aListeners"), data.totals.listeners], [t("aListeners30"), data.totals.listeners30],
    [t("aLikes"), data.totals.likes], [t("aSaves"), data.totals.saves], [t("aPlaylistAdds"), data.totals.playlistAdds], [t("aRequests"), data.totals.bookingRequests],
    [t("aInquiries"), data.totals.inquiries], [t("aConfirmed"), data.totals.confirmed], [t("aProfileViews"), t("notMeasured")],
  ];
  const excluded = Object.entries(data.excluded);
  return (
    <div className="space-y-4">
      <Section title={t("analyticsTitle")} id="an-h">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="analytics-tiles">
          {tiles.map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-surface-2 p-3">
              <div className="text-xs font-bold uppercase text-mute">{k}</div>
              <div className="font-display text-2xl tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-mute" data-testid="play-definition">{t("playDefinition")}</p>
        {excluded.length > 0 && (
          <p className="mt-1 text-xs text-mute" data-testid="excluded-plays">
            {t("excludedPlays")} {excluded.map(([k, n]) => `${t(`reject.${k}`)}: ${n}`).join(" · ")}
          </p>
        )}
      </Section>
      <Section title={t("perTrack")} id="pt-h">
        {data.tracks.length === 0 ? (
          <p className="text-sm text-mute">{t("noTracksYet")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-[11px] uppercase text-mute"><tr><th className="py-1">{t("fTitle")}</th><th>{t("aPlays")}</th><th>{t("aListeners")}</th><th>{t("aLikes")}</th><th>{t("aSaves")}</th><th>{t("aPlaylistAdds")}</th></tr></thead>
              <tbody>
                {data.tracks.map((r) => (
                  <tr key={r.id} className="border-t border-line"><td className="py-2 pr-2 font-bold">{r.title}</td><td className="tabular-nums">{r.plays}</td><td className="tabular-nums">{r.listeners}</td><td className="tabular-nums">{r.likes}</td><td className="tabular-nums">{r.saves}</td><td className="tabular-nums">{r.playlistAdds}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
