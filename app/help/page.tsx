import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/layout/InfoPage";

export async function generateMetadata(): Promise<Metadata> {
  const tu = await getTranslations("seo");
  return { title: tu("helpTitle"), description: tu("helpDescription") };
}

const QA = [
  ["qaSupport", "/events"],
  ["qaLevels", "/how-it-works"],
  ["qaTickets", "/tickets"],
  ["qaAlien", "/profile/alien"],
  ["qaData", "/profile"],
  ["qaVenue", "/venues/new"],
] as const;

export default function Page() {
  const tu = useTranslations("pages");
  return (
    <InfoPage kicker={tu("help")} title={tu("helpCenter")} sub={tu("text8")}>
      <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
        {QA.map(([k, href]) => (
          <details key={k} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold [&::-webkit-details-marker]:hidden">{tu(`${k}Q`)}<span className="text-xl transition-transform group-open:rotate-45" aria-hidden>+</span></summary>
            <div className="px-4 pb-4 text-sm">{tu(`${k}A`)} <Link href={href} className="font-bold text-acid">{tu("go")}</Link></div>
          </details>
        ))}
      </div>
    </InfoPage>
  );
}
