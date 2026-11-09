import type { ReactNode } from "react";
import { DaoProvider } from "@/components/dao/DaoContext";
import { DaoShell } from "@/components/dao/DaoShell";
import { EVENTS } from "@/lib/data";

export function generateStaticParams() {
  return EVENTS.map((e) => ({ eventId: e.id }));
}

export default async function DaoLayout({ children, params }: { children: ReactNode; params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return (
    <DaoProvider eventId={eventId}>
      <DaoShell>{children}</DaoShell>
    </DaoProvider>
  );
}
