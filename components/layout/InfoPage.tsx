import type { ReactNode } from "react";
import { PageTitle } from "@/components/ui/primitives";

export function InfoPage({ kicker, title, sub, children }: { kicker: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl md:px-6">
      <PageTitle kicker={kicker} title={title} sub={sub} />
      <div className="space-y-6 px-4 text-[15px] leading-relaxed text-cream/90 md:px-0 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:uppercase [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
    </div>
  );
}
