import { useTranslations } from "next-intl";
import { Users, Coins } from "lucide-react";
import { progressToNext, levelInfo } from "@/lib/levels";
import { compact, money } from "@/lib/utils";
import { Progress } from "@/components/ui/primitives";

export function EventProgress({ supporters, raised, goal, compactView = false }: { supporters: number; raised: number; goal: number; compactView?: boolean }) {
  const tu = useTranslations("events");
  const p = progressToNext(supporters, raised);
  const color = levelInfo(p.level).color;
  if (compactView) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <span className="inline-flex items-center gap-1 font-semibold"><Users className="size-3.5" aria-hidden />{tu("compactSupporters", { compact: compact(supporters) })}</span>
          <span className="font-semibold text-mute">{tu("roundFunded", { round: Math.round((raised / goal) * 100) })}</span>
        </div>
        <Progress value={raised / goal} color={color} label={tu("roundOfFundingGoal", { round: Math.round((raised / goal) * 100) })} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface-2 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mute"><Users className="size-3.5" aria-hidden />{tu("supporters")}</div>
          <div className="mt-1 font-display text-2xl">{supporters.toLocaleString("en-US")}</div>
        </div>
        <div className="rounded-2xl bg-surface-2 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mute"><Coins className="size-3.5" aria-hidden />{tu("secured")}</div>
          <div className="mt-1 font-display text-2xl">{money(raised)}</div>
          <div className="text-xs text-mute">{tu("ofMoneyGoal", { money: money(goal) })}</div>
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-sm font-semibold">
          <span>{tu("fundingGoal")}</span>
          <span>{Math.round((raised / goal) * 100)}%</span>
        </div>
        <Progress value={raised / goal} color={color} label={tu("fundingProgress")} />
      </div>
      {p.next ? (
        <div>
          <div className="mb-1.5 flex justify-between gap-2 text-sm font-semibold">
            <span>{tu("nextLvLevelName", { level: p.next.level, name: p.next.name })}</span>
            <span>{Math.round(p.pct * 100)}%</span>
          </div>
          <Progress value={p.pct} color={p.next.color} label={tu("progressToLevelLevel", { level: p.next.level })} />
          <p className="mt-2 text-xs text-mute">
            {tu("needsTolocalestringSupportersTolocal", { toLocaleString: p.next.supporters.toLocaleString("en-US"), toLocaleString2: Math.max(0, p.next.supporters - supporters).toLocaleString("en-US"), money: money(p.next.funding), money2: money(Math.max(0, p.next.funding - raised)) })}
          </p>
        </div>
      ) : (
        <p className="rounded-2xl bg-purple/20 p-3 text-sm font-semibold text-purple">{tu("maxLevelThisIsA")}</p>
      )}
    </div>
  );
}
