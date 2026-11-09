"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { MapPoint } from "@/components/map/WorldMap";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { LoadingSkeleton } from "@/components/ui/States";
import { EventLevelBadge } from "@/components/event/EventLevelBadge";
import { getEvent } from "@/lib/data";
import type { EventLevel } from "@/lib/types";
import { CATEGORY_META } from "@/lib/ranking/meta";
import type { RankingCategory } from "@/lib/ranking/types";

const WorldMap = dynamic(() => import("@/components/map/WorldMap"), { ssr: false, loading: () => <LoadingSkeleton variant="map" /> });

interface Pin {
  id: string;
  rank: number;
  name: string;
  city: string;
  lat: number;
  lng: number;
  approximate: boolean;
  status: string;
  level: EventLevel;
}

/** Map view of the current ranking (same query as the list, via /api/rankings/map). */
export function RankingMap({ apiQuery, category }: { apiQuery: string; category: RankingCategory }) {
  const [pins, setPins] = useState<Pin[] | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    setPins(null);
    setError(false);
    fetch(`/api/rankings/map?${apiQuery}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        setPins(d.pins);
        setFocus((f) => f + 1);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError(true);
      });
    return () => ctl.abort();
  }, [apiQuery]);

  const points: MapPoint[] = useMemo(
    () =>
      (pins ?? []).flatMap((p) => {
        const ev = getEvent(p.id);
        return ev ? [{ event: ev, level: p.level, label: `#${p.rank}`, approximate: p.approximate }] : [];
      }),
    [pins],
  );
  const sel = pins?.find((p) => p.id === selected);

  return (
    <div className="px-4 md:px-0">
      <div className="relative h-[62dvh] min-h-[380px] overflow-hidden rounded-[28px] border-2 border-blue/50 shadow-[0_0_30px_-10px_#55BCEB]">
        {error ? (
          <p className="p-6 text-sm text-mute">The map couldn’t load the ranking. Try refreshing.</p>
        ) : (
          <WorldMap points={points} selectedId={selected} onSelect={setSelected} focus={focus} />
        )}
        {pins && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink/85 px-3 py-1.5 text-[12px] font-bold">
            Top {pins.length} · {CATEGORY_META[category].label}
          </div>
        )}
      </div>
      <p className="ja mt-2 text-xs text-mute">ピンの数字は現在の順位です。会場未確定のイベントは都市単位の概略位置で表示しています。</p>
      <BottomSheet open={!!sel} onClose={() => setSelected(null)} title={sel ? `#${sel.rank} ${sel.name}` : ""} modal={false}>
        {sel && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-mute">
              <EventLevelBadge level={sel.level} />
              <span>{sel.city}</span>
              {sel.approximate && <span className="text-xs">（概略位置）</span>}
            </div>
            <Link href={`/events/${sel.id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-acid font-extrabold uppercase text-ink">
              View event <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
