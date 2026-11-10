"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alien } from "@/components/art/Alien";
import { Field, Input } from "@/components/forms/Fields";
import { btnClass } from "@/components/ui/primitives";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { api, useAuth, type Me, type MeAlien } from "@/lib/auth/client";
import { AlienTraitList, FamilyBadge } from "./AlienTraits";

type Phase = "egg" | "hatch" | "born";

/**
 * "YOUR ALIEN IS BORN!" — black screen, a glowing capsule wobbles, cracks, flashes and the alien pops out.
 * About 3 seconds, skippable, and instant under prefers-reduced-motion.
 */
export function AlienReveal({ me }: { me: Me & { alien: MeAlien } }) {
  const t = useTranslations("alien");
  const tc = useTranslations("common");
  const router = useRouter();
  const href = useLocalHref();
  const refresh = useAuth((s) => s.refresh);
  const [phase, setPhase] = useState<Phase>("egg");
  const [step, setStep] = useState<"reveal" | "name">("reveal");
  const [name, setName] = useState(me.profile.displayName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const alien = me.alien;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("born");
      return;
    }
    const a = setTimeout(() => setPhase("hatch"), 1300);
    const b = setTimeout(() => setPhase("born"), 2300);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  useEffect(() => {
    if (phase === "born") heading.current?.focus();
  }, [phase, step]);

  const markSeen = () => api("/api/me/profile", "PATCH", { revealSeen: true });
  const go = async (to: string) => {
    await markSeen();
    await refresh();
    router.push(href(to));
  };

  return (
    <div className="fk-reveal text-cream" role="dialog" aria-modal="true" aria-labelledby="reveal-title" data-testid="alien-reveal" data-phase={phase}>
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col items-center px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-[max(env(safe-area-inset-top),20px)]">
        <div className="flex w-full justify-end">
          {phase !== "born" && (
            <button type="button" onClick={() => setPhase("born")} className="min-h-11 rounded-full border-2 border-cream/30 px-4 text-sm font-extrabold uppercase" data-testid="reveal-skip">
              {t("skipAnimation")}
            </button>
          )}
        </div>

        {phase !== "born" ? (
          <div className={`relative mt-[12vh] flex flex-col items-center ${phase === "hatch" ? "fk-hatch" : ""}`} aria-live="polite">
            <span className="sr-only">{t("hatching")}</span>
            <div className="fk-egg-glow absolute -inset-16 rounded-full" style={{ background: `radial-gradient(circle, ${alien.look.body}88 0%, ${alien.look.accent}33 45%, transparent 70%)` }} aria-hidden />
            <svg viewBox="0 0 200 240" className="fk-egg relative h-[min(46vh,320px)] w-auto" aria-hidden>
              <defs>
                <radialGradient id="egg-g" cx="40%" cy="35%" r="70%">
                  <stop offset="0%" stopColor="#F5F2EA" />
                  <stop offset="55%" stopColor={alien.look.body} />
                  <stop offset="100%" stopColor="#1a1426" />
                </radialGradient>
              </defs>
              <path d="M100 12 C150 12 182 92 182 146 C182 198 146 228 100 228 C54 228 18 198 18 146 C18 92 50 12 100 12 Z" fill="url(#egg-g)" stroke="#080808" strokeWidth="7" />
              {[40, 72, 104, 136, 168].map((x, i) => <circle key={x} cx={x} cy={150 + (i % 2) * 22} r="7" fill={alien.look.accent} stroke="#080808" strokeWidth="3" />)}
              <ellipse cx="72" cy="70" rx="12" ry="24" transform="rotate(25 72 70)" fill="#fff" opacity=".55" />
              {phase === "hatch" && <path d="M28 120 L58 104 L76 126 L100 100 L122 128 L144 104 L172 122" fill="none" stroke="#080808" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />}
            </svg>
            {phase === "hatch" && <div className="fk-flash pointer-events-none fixed inset-0 bg-cream" aria-hidden />}
          </div>
        ) : step === "reveal" ? (
          <div className="flex w-full flex-col items-center text-center">
            <div className="relative mt-2">
              <div className="absolute -inset-10 rounded-full opacity-70 blur-2xl" style={{ background: `radial-gradient(circle, ${alien.look.body} 0%, transparent 65%)` }} aria-hidden />
              <div className="fk-born relative">
                <Alien look={alien.look} className="h-[min(34vh,260px)] w-auto" title={alien.name} bob />
              </div>
            </div>
            <h1 ref={heading} tabIndex={-1} id="reveal-title" className="fk-born-text mt-4 text-[clamp(30px,9vw,52px)] uppercase text-acid outline-none">
              {t("born")}
            </h1>
            <p className="fk-born-text mt-1 font-display text-lg uppercase">{t("welcome")}</p>
            <div className="fk-born-text mt-5 w-full rounded-[28px] border-2 border-line bg-[#0D121B] p-5 text-left">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold uppercase tracking-widest text-mute">{t("yourAlien")}</div>
                  <div className="truncate font-display text-2xl uppercase" data-testid="alien-name">{alien.name}</div>
                </div>
                <FamilyBadge family={alien.family} />
              </div>
              <p className="mt-2 text-sm text-mute">{t(`familyBlurb.${alien.family}`)}</p>
              <h2 className="mb-2 mt-4 font-sans text-xs font-extrabold uppercase tracking-widest text-mute">{t("traits")}</h2>
              <AlienTraitList alien={alien} />
              <p className="mt-3 text-xs text-mute">{t("noReroll")}</p>
            </div>
            <div className="mt-5 grid w-full gap-2 min-[420px]:grid-cols-3">
              <button type="button" className={btnClass("primary", "lg")} onClick={() => setStep("name")} data-testid="reveal-continue">{t("continue")}</button>
              <button type="button" className={btnClass("ghost", "lg")} onClick={() => go("/profile/alien")} data-testid="reveal-customize">{t("customize")}</button>
              <button type="button" className={btnClass("purple", "lg")} onClick={() => go("/world")} data-testid="reveal-enter">{t("enterWorld")}</button>
            </div>
          </div>
        ) : (
          <form
            noValidate
            className="mt-6 w-full"
            onSubmit={async (e) => {
              e.preventDefault();
              const v = name.trim();
              if (v.length < 1 || v.length > 32) return setError(t("displayNameHint"));
              setBusy(true);
              const r = await api("/api/me/profile", "PATCH", { displayName: v, revealSeen: true });
              setBusy(false);
              if (!r.ok) return setError(r.code);
              await refresh();
              router.push(href("/world"));
            }}
          >
            <div className="flex items-center gap-4">
              <Alien look={alien.look} className="size-24 shrink-0" />
              <div>
                <h1 ref={heading} tabIndex={-1} id="reveal-title" className="text-[28px] uppercase leading-none outline-none">{t("nameTitle")}</h1>
                <p className="mt-2 text-sm text-mute">{t("nameLead")}</p>
              </div>
            </div>
            <div className="mt-6">
              <Field id="displayName" label={t("displayName")} hint={t("displayNameHint")} error={error ?? undefined}>
                <Input id="displayName" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} autoComplete="nickname" placeholder={alien.name} aria-invalid={Boolean(error) || undefined} />
              </Field>
            </div>
            <button type="submit" disabled={busy} className={btnClass("primary", "lg", "mt-5 w-full")} data-testid="name-submit">
              {busy ? tc("saving") : t("enterWorld")}
            </button>
            <Link href={href("/profile/alien")} onClick={() => void markSeen()} className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-sm font-bold text-acid underline underline-offset-4">
              {t("customize")}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
