import Link from "next/link";
import { LogoMark } from "./Logo";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/help", label: "Help" },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line px-4 pb-8 pt-10 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <div>
            <div className="font-display text-2xl leading-none">FREAKTOPIA WORLD</div>
            <div className="mt-1 text-sm text-mute">Discover. Support. Create. Rave.</div>
          </div>
        </div>
        <nav aria-label="Footer" className="mt-6">
          <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 md:flex md:flex-wrap md:gap-x-8">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex min-h-11 items-center font-semibold text-cream/85 hover:text-cream">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="ja mt-6 text-xs leading-relaxed text-mute">
          Phase 1 prototype. All events, DJs, venues, tickets and collectibles are fictional demo data. No payments, live streams, wallets or NFT minting are connected.
          <br />
          フェーズ1のプロトタイプです。掲載内容はすべてデモ用の架空データで、決済・配信・ウォレット・NFT発行は接続されていません。
        </p>
        <p className="mt-4 text-xs text-mute">© 2026 FREAKTOPIA WORLD. Original artwork.</p>
      </div>
    </footer>
  );
}
