import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { ART } from "@/lib/art";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path d="M6 32 C3 18 10 5 20 5 C30 5 37 18 34 32 C33 37 29 37 28 33 C26 38 22 38 21 34 C19 38 14 38 13 34 C11 37 7 37 6 32 Z" fill="#B6F05C" stroke="#080808" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="15" cy="19" r="5.5" fill="#F5F2EA" stroke="#080808" strokeWidth="2" />
      <circle cx="16.5" cy="19.5" r="2.4" fill="#080808" />
      <circle cx="26" cy="17" r="3.8" fill="#F5F2EA" stroke="#080808" strokeWidth="2" />
      <circle cx="26.5" cy="17.5" r="1.7" fill="#080808" />
      <path d="M15 27 Q21 31 27 26" stroke="#080808" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className = "h-[34px] w-auto min-[360px]:h-[42px] sm:h-[48px]" }: { className?: string }) {
  const tu = useTranslations("ui");
  return (
    <Link href="/" className="flex min-h-11 shrink-0 items-center rounded-xl" aria-label={tu("freaktopiaWorldHome")}>
      <Image src={ART.logo} alt="" priority sizes="130px" className={className} />
    </Link>
  );
}
