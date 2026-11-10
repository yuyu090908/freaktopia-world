"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alien } from "@/components/art/Alien";
import { Field, Input } from "@/components/forms/Fields";
import { btnClass } from "@/components/ui/primitives";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { GENRES } from "@/lib/data";
import { cn } from "@/lib/utils";
import { api, useAuth, type Me, type MeAlien } from "@/lib/auth/client";
import type { OnboardingStep } from "@/lib/auth/types";
import { AlienTraitList, FamilyBadge } from "./AlienTraits";

type Phase = "capsule" | "open" | "born";
type Step = Exclude<OnboardingStep, "reveal"> | "reveal";

/** Big glowing capsule. Its two doors slide apart (phase "open") and the alien steps out. */
function Capsule({ alien, phase }: { alien: MeAlien; phase: Phase }) {
  const open = phase !== "capsule";
  return (
    <div className={cn("fk-capsule relative mx-auto aspect-[3/4] w-[min(66vw,280px)]", open && "is-open", phase === "born" && "is-born")} aria-hidden>
      <div className="fk-capsule-glow absolute -inset-[30%] rounded-full" style={{ background: `radial-gradient(circle, ${alien.look.body}aa 0%, #A276E955 38%, transparent 68%)` }} />
      {/* shell */}
      <div className="absolute inset-0 rounded-t-[999px] rounded-b-[48px] border-[6px] border-ink bg-[linear-gradient(160deg,#2b2340_0%,#171717_55%,#0b0b0b_100%)] shadow-[0_0_0_4px_#A276E9,0_0_40px_#A276E9aa,inset_0_0_30px_#000]" />
      {[14, 50, 86].map((x) => (
        <span key={x} className="fk-capsule-light absolute top-[3%] size-3 -translate-x-1/2 rounded-full border-2 border-ink" style={{ left: `${x}%`, background: x === 50 ? "#B6F05C" : "#FF625C" }} />
      ))}
      {/* interior: the alien waits behind the doors */}
      <div className="absolute inset-x-[12%] bottom-[12%] top-[12%] overflow-hidden rounded-t-[999px] rounded-b-[28px] border-4 border-ink bg-[radial-gradient(circle_at_50%_70%,#B6F05C55,#080808_70%)]">
        <div className="fk-capsule-beam absolute inset-x-[20%] -top-4 bottom-0 bg-[linear-gradient(180deg,#F5F2EAcc,transparent)] opacity-0" />
        <div className="fk-capsule-alien absolute inset-x-0 bottom-[4%] flex justify-center">
          <Alien look={alien.look} className="h-auto w-[86%]" />
        </div>
        <div className="fk-door-l absolute inset-y-0 left-0 w-1/2 border-r-2 border-ink bg-[repeating-linear-gradient(180deg,#A276E9_0_14px,#7d55c7_14px_18px)]">
          <span className="absolute right-2 top-1/2 h-10 w-2 -translate-y-1/2 rounded-full bg-acid shadow-[0_0_12px_#B6F05C]" />
        </div>
        <div className="fk-door-r absolute inset-y-0 right-0 w-1/2 border-l-2 border-ink bg-[repeating-linear-gradient(180deg,#A276E9_0_14px,#7d55c7_14px_18px)]">
          <span className="absolute left-2 top-1/2 h-10 w-2 -translate-y-1/2 rounded-full bg-acid shadow-[0_0_12px_#B6F05C]" />
        </div>
      </div>
      {/* base */}
      <div className="absolute -bottom-[4%] left-1/2 h-[8%] w-[110%] -translate-x-1/2 rounded-full border-[5px] border-ink bg-coral shadow-[0_0_24px_#FF625C99]" />
    </div>
  );
}

function Progress({ step }: { step: Step }) {
  const t = useTranslations("onboarding");
  const order: Step[] = ["reveal", "name", "genres"];
  const i = Math.max(0, order.indexOf(step));
  return (
    <ol className="flex items-center gap-2" aria-label={t("stepOf", { n: i + 1, total: 3 })} data-testid="onboarding-progress" data-step={step}>
      {order.map((s, k) => (
        <li key={s} className={cn("h-2 w-8 rounded-full", k <= i ? "bg-acid" : "bg-cream/20")} aria-current={k === i ? "step" : undefined} />
      ))}
    </ol>
  );
}

/**
 * FREAKTOPIA WORLD onboarding: Reveal → display name → favourite genres → ENTER WORLD.
 * The step is stored on the server (user_onboarding_progress), so closing the tab resumes at the same step on any
 * device, and the Reveal never plays again once it has been seen.
 * The capsule animation runs about 3 seconds, can be skipped, and is instant under prefers-reduced-motion.
 */
export function AlienReveal({ me }: { me: Me & { alien: MeAlien } }) {
  const t = useTranslations("alien");
  const to = useTranslations("onboarding");
  const tc = useTranslations("common");
  const router = useRouter();
  const href = useLocalHref();
  const refresh = useAuth((s) => s.refresh);
  const initial: Step = me.profile.onboardingStep ?? (me.profile.revealSeen ? "name" : "reveal");
  const [step, setStep] = useState<Step>(initial);
  const [phase, setPhase] = useState<Phase>(initial === "reveal" ? "capsule" : "born");
  const [name, setName] = useState(me.profile.displayName ?? "");
  const [genres, setGenres] = useState<string[]>(me.profile.favoriteGenres ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const alien = me.alien;

  useEffect(() => {
    if (step !== "reveal" || phase === "born") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("born");
      return;
    }
    const a = setTimeout(() => setPhase("open"), 1400);
    const b = setTimeout(() => setPhase("born"), 2700);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seeing the alien is what completes the reveal step: a reload after this point resumes at the name step.
  useEffect(() => {
    if (phase === "born" && step === "reveal") void api("/api/me/profile", "PATCH", { onboardingStep: "name" });
  }, [phase, step]);

  useEffect(() => {
    if (phase === "born") heading.current?.focus();
  }, [phase, step]);

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const r = await api("/api/me/profile", "PATCH", patch);
    setBusy(false);
    if (!r.ok) {
      setError(r.code);
      return false;
    }
    return true;
  };
  const leave = async (path: string) => {
    await refresh();
    router.push(href(path));
  };

  return (
    <div className="fk-reveal text-cream" role="dialog" aria-modal="true" aria-labelledby="reveal-title" data-testid="alien-reveal" data-phase={phase} data-step={step}>
      <div className="fk-stars pointer-events-none fixed inset-0" aria-hidden />
      <div className="relative mx-auto flex min-h-full w-full max-w-lg flex-col items-center px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-[max(env(safe-area-inset-top),20px)]">
        <div className="flex min-h-11 w-full items-center justify-between gap-3">
          {phase === "born" ? <Progress step={step} /> : <span />}
          {phase !== "born" && (
            <button type="button" onClick={() => setPhase("born")} className="min-h-11 rounded-full border-2 border-cream/30 px-4 text-sm font-extrabold uppercase" data-testid="reveal-skip">
              {t("skipAnimation")}
            </button>
          )}
        </div>

        {step === "reveal" && phase !== "born" ? (
          <div className="mt-[10vh] flex flex-col items-center" aria-live="polite">
            <span className="sr-only">{t("hatching")}</span>
            <Capsule alien={alien} phase={phase} />
            {phase === "open" && <div className="fk-flash pointer-events-none fixed inset-0 bg-cream" aria-hidden />}
          </div>
        ) : step === "reveal" ? (
          <div className="flex w-full flex-col items-center text-center">
            <div className="relative mt-2">
              <div className="absolute -inset-10 rounded-full opacity-70 blur-2xl" style={{ background: `radial-gradient(circle, ${alien.look.body} 0%, transparent 65%)` }} aria-hidden />
              <div className="fk-born relative">
                <Alien look={alien.look} className="h-[min(30vh,240px)] w-auto" title={alien.name} bob />
              </div>
            </div>
            <h1 ref={heading} tabIndex={-1} id="reveal-title" className="fk-born-text mt-4 text-[clamp(28px,8.5vw,52px)] uppercase leading-[1.05] text-acid outline-none [overflow-wrap:anywhere]">
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
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border-2 border-dashed border-purple/60 px-3 py-2">
                <span className="text-xs font-extrabold uppercase tracking-widest text-mute">{t("id")}</span>
                <span className="font-mono text-base font-bold text-acid" data-testid="alien-public-id">{alien.publicId}</span>
              </div>
              <p className="mt-2 text-sm text-mute">{t(`familyBlurb.${alien.family}`)}</p>
              <h2 className="mb-2 mt-4 font-sans text-xs font-extrabold uppercase tracking-widest text-mute">{t("traits")}</h2>
              <AlienTraitList alien={alien} />
              <p className="mt-3 text-xs text-mute">{t("noReroll")}</p>
            </div>
            <div className="mt-5 grid w-full gap-2 min-[420px]:grid-cols-3">
              <button type="button" className={btnClass("primary", "lg", "min-w-0 whitespace-normal")} onClick={() => setStep("name")} data-testid="reveal-continue">{t("continue")}</button>
              <button type="button" className={btnClass("ghost", "lg", "min-w-0 whitespace-normal")} onClick={() => leave("/profile/alien")} data-testid="reveal-customize">{t("customize")}</button>
              <button
                type="button"
                className={btnClass("purple", "lg", "min-w-0 whitespace-normal")}
                onClick={async () => (await save({ onboardingStep: "done" })) && leave("/world")}
                data-testid="reveal-enter"
              >
                {t("enterWorld")}
              </button>
            </div>
          </div>
        ) : step === "name" ? (
          <form
            noValidate
            className="mt-6 w-full"
            onSubmit={async (e) => {
              e.preventDefault();
              const v = name.trim();
              if (v.length < 1 || v.length > 32) return setError(t("displayNameHint"));
              if (await save({ displayName: v, onboardingStep: "genres" })) setStep("genres");
            }}
          >
            <div className="flex items-center gap-4">
              <Alien look={alien.look} className="size-24 shrink-0" />
              <div className="min-w-0">
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
              {busy ? tc("saving") : t("continue")}
            </button>
            <Link href={href("/profile/alien")} className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-sm font-bold text-acid underline underline-offset-4">
              {t("customize")}
            </Link>
          </form>
        ) : step === "genres" ? (
          <form
            noValidate
            className="mt-6 w-full"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await save({ favoriteGenres: genres, onboardingStep: "done" })) await leave("/world");
            }}
          >
            <h1 ref={heading} tabIndex={-1} id="reveal-title" className="text-[28px] uppercase leading-none outline-none">{to("genresTitle")}</h1>
            <p className="mt-2 text-sm text-mute">{to("genresLead")}</p>
            <fieldset className="mt-5">
              <legend className="sr-only">{to("genresTitle")}</legend>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => {
                  const on = genres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setGenres(on ? genres.filter((x) => x !== g) : [...genres, g].slice(0, 12))}
                      className={cn("min-h-11 rounded-full border-2 px-4 text-sm font-bold", on ? "border-acid bg-acid/15 text-acid" : "border-line")}
                      data-testid="genre-chip"
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {error && <p className="mt-3 text-sm font-bold text-coral" role="alert">{error}</p>}
            <button type="submit" disabled={busy} className={btnClass("primary", "lg", "mt-6 w-full")} data-testid="genres-submit">
              {busy ? tc("saving") : t("enterWorld")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => (await save({ onboardingStep: "done" })) && leave("/world")}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-sm font-bold text-mute underline underline-offset-4"
              data-testid="genres-skip"
            >
              {to("skip")}
            </button>
          </form>
        ) : (
          <div className="mt-[8vh] flex w-full flex-col items-center text-center" data-testid="onboarding-done">
            <Alien look={alien.look} className="h-[min(26vh,200px)] w-auto" title={alien.name} bob />
            <h1 ref={heading} tabIndex={-1} id="reveal-title" className="mt-4 text-[clamp(28px,8vw,44px)] uppercase text-acid outline-none">{to("allSetTitle")}</h1>
            <p className="mt-2 text-mute">{to("allSetLead")}</p>
            <p className="mt-2 font-mono text-sm text-cream/80">{alien.publicId}</p>
            <Link href={href("/world")} className={btnClass("primary", "lg", "mt-6 w-full")} data-testid="reveal-enter">{t("enterWorld")}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
