import type * as Svc from "@/lib/ops/service";

export type View = Awaited<ReturnType<typeof Svc.eventView>>;
export interface TabProps {
  v: View;
  reload: () => Promise<void>;
  eid: string;
}
export type Candidate = Awaited<ReturnType<typeof Svc.candidates>>["eligible"][number];
