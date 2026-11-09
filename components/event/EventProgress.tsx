import { Users, Coins } from "lucide-react";
import { progressToNext, levelInfo } from "@/lib/levels";
import { compact, money } from "@/lib/utils";
import { Progress } from "@/components/ui/primitives";

export function EventProgress({ supporters, raised, goal, compactView = false }: { supporters: number; raised: number; goal: number; compactView?: boolean }) {
  const p = progressToNext(supporters, raised);
  const color = levelInfo(p.level).color;
  if (compactView) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <span className="inline-flex items-center gap-1 font-semibold"><Users className="size-3.5" aria-hidden />{compact(supporters)} supporters</span>
          <span className="font-semibold text-mute">{Math.round((raised / goal) * 100)}% funded</span>
        </div>
        <Progress value={raised / goal} color={color} label={`${Math.round((raised / goal) * 100)}% of funding goal`} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface-2 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mute"><Users className="size-3.5" aria-hidden />Supporters</div>
          <div className="mt-1 font-display text-2xl">{supporters.toLocaleString("en-US")}</div>
        </div>
        <div className="rounded-2xl bg-surface-2 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mute"><Coins className="size-3.5" aria-hidden />Secured</div>
          <div className="mt-1 font-display text-2xl">{money(raised)}</div>
          <div className="text-xs text-mute">of {money(goal)} goal</div>
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-sm font-semibold">
          <span>Funding goal</span>
          <span>{Math.round((raised / goal) * 100)}%</span>
        </div>
        <Progress value={raised / goal} color={color} label="Funding progress" />
      </div>
      {p.next ? (
        <div>
          <div className="mb-1.5 flex justify-between gap-2 text-sm font-semibold">
            <span>Next: LV.{p.next.level} {p.next.name}</span>
            <span>{Math.round(p.pct * 100)}%</span>
          </div>
          <Progress value={p.pct} color={p.next.color} label={`Progress to level ${p.next.level}`} />
          <p className="mt-2 text-xs text-mute">
            Needs {p.next.supporters.toLocaleString("en-US")} supporters ({Math.max(0, p.next.supporters - supporters).toLocaleString("en-US")} to go) and {money(p.next.funding)} secured ({money(Math.max(0, p.next.funding - raised))} to go).
          </p>
        </div>
      ) : (
        <p className="rounded-2xl bg-purple/20 p-3 text-sm font-semibold text-purple">MAX LEVEL — this is a Mega Fest.</p>
      )}
    </div>
  );
}
