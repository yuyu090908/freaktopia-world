import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/layout/InfoPage";

export const metadata: Metadata = { title: "Help", description: "Answers to common questions about the FREAKTOPIA prototype." };

const QA = [
  ["How do I support an event?", "Open any event and tap SUPPORT EVENT. Choose a cheer or a demo pledge. No money is taken.", "/events"],
  ["How do levels work?", "Supporters and funding level an event from LV.1 to LV.5. Use the simulator on an event page to preview level-ups.", "/how-it-works"],
  ["Are tickets real?", "No. Demo checkout creates a sample ticket in your browser that is not valid for entry.", "/tickets"],
  ["How do I change my alien?", "Go to the Avatar page, pick a character, outfit and accessory, then Save.", "/avatar"],
  ["Where is my data?", "In your browser only. Reset it from Profile → Settings.", "/profile"],
  ["Can I list my venue?", "Yes — five steps with photos, price, equipment and dates.", "/venues/new"],
] as const;

export default function Page() {
  return (
    <InfoPage kicker="Help" title="Help center" sub="よくある質問">
      <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
        {QA.map(([q, a, href]) => (
          <details key={q} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold [&::-webkit-details-marker]:hidden">{q}<span className="text-xl transition-transform group-open:rotate-45" aria-hidden>+</span></summary>
            <div className="px-4 pb-4 text-sm">{a} <Link href={href} className="font-bold text-acid">Go →</Link></div>
          </details>
        ))}
      </div>
    </InfoPage>
  );
}
