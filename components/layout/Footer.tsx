import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ART } from "@/lib/art";

const LINKS = [
  { href: "/about", key: "about" },
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/contact", key: "contact" },
  { href: "/terms", key: "terms" },
  { href: "/privacy", key: "privacy" },
  { href: "/help", key: "help" },
] as const;

export function Footer() {
  const t = useTranslations("footer");
  const tn = useTranslations("nav.pages");
  const tm = useTranslations("meta");
  return (
    <footer className="mt-16 border-t border-purple/30 bg-ink/70 px-4 pb-8 pt-10 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <Image src={ART.logo} alt="FREAKTOPIA WORLD" sizes="160px" className="h-14 w-auto" />
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-acid">{tm("tagline")}</div>
        </div>
        <nav aria-label={t("label")} className="mt-6">
          <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 md:flex md:flex-wrap md:gap-x-8">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex min-h-11 items-center font-semibold text-cream/85 hover:text-cream">
                  {tn(l.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-6 text-xs leading-relaxed text-mute">{t("disclaimer")}</p>
        <p className="mt-4 text-xs text-mute">{t("copyright")}</p>
      </div>
    </footer>
  );
}
