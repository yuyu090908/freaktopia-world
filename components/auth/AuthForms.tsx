"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, FlaskConical, Mail } from "lucide-react";
import { Field, Input } from "@/components/forms/Fields";
import { btnClass } from "@/components/ui/primitives";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { api, useAuth } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { Alien } from "@/components/art/Alien";
import { DJS } from "@/lib/data";

/**
 * Psychedelic FREAKTOPIA frame for the sign-up / login / reset / verify screens: swirling acid-coral-purple backdrop,
 * dancing aliens and a sticker title. The form itself sits on a solid surface card so it stays easy to read.
 */
export function AuthShell({ title, lead, children, footer }: { title: string; lead?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const crew = DJS.slice(0, 3).map((d) => d.look);
  return (
    <div className="fk-auth relative isolate overflow-hidden">
      <div className="fk-auth-swirl pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 pb-16 pt-6 md:grid-cols-[1fr_minmax(0,440px)] md:items-start md:gap-10 md:px-6 md:pt-12">
        <div className="relative md:sticky md:top-24" aria-hidden>
          <div className="flex items-end justify-center gap-1 md:justify-start">
            {crew.map((l, i) => (
              <div key={i} className={cn("fk-auth-alien", i === 1 ? "w-28 md:w-40" : "w-20 md:w-28")} style={{ animationDelay: `${i * 0.18}s` }}>
                <Alien look={l} className="h-auto w-full drop-shadow-[0_6px_0_#080808]" />
              </div>
            ))}
          </div>
          <div className="mt-3 hidden text-center md:block md:text-left">
            <span className="inline-block -rotate-2 rounded-xl border-[3px] border-ink bg-acid px-3 py-1 font-display text-2xl uppercase text-ink shadow-[4px_4px_0_#080808]">FREAKTOPIA</span>
            <span className="ml-2 inline-block rotate-2 rounded-xl border-[3px] border-ink bg-coral px-3 py-1 font-display text-2xl uppercase text-ink shadow-[4px_4px_0_#080808]">WORLD</span>
          </div>
        </div>
        <div className="rounded-[32px] border-[3px] border-ink bg-surface p-5 shadow-[6px_6px_0_#A276E9] sm:p-7">
          <h1 className="text-[clamp(28px,8vw,44px)] uppercase leading-[1.02] [overflow-wrap:anywhere]">{title}</h1>
          {lead && <p className="mt-3 text-[15px] text-cream/80">{lead}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-sm text-mute">{footer}</div>}
          <ConnectionStatus />
        </div>
      </div>
    </div>
  );
}

/** Shows which auth pieces are real and which are demo stand-ins. Never claims a connection that isn't there. */
export function ConnectionStatus() {
  const t = useTranslations("auth.status");
  const ta = useTranslations("auth");
  const cfg = useAuth((s) => s.config);
  if (!cfg) return null;
  const row = (label: string, value: string, demo: boolean) => (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <dt className="text-mute">{label}</dt>
      <dd className={cn("text-right font-bold", demo ? "text-orange" : "text-acid")}>{value}</dd>
    </div>
  );
  return (
    <section aria-label={t("title")} className="mt-8 rounded-2xl border border-line bg-surface px-4 py-3 text-xs" data-testid="auth-status">
      <h2 className="mb-1 flex items-center gap-1.5 font-sans text-xs font-extrabold uppercase tracking-wider text-mute"><FlaskConical className="size-3.5 text-orange" aria-hidden />{t("title")}</h2>
      <dl className="divide-y divide-line">
        {row(t("store"), cfg.store === "postgres" ? t("storePostgres") : t("storeMemory"), cfg.store !== "postgres")}
        {row(ta("email"), cfg.email === "connected" ? t("connected") : cfg.email === "demo-mailbox" ? t("emailDemo") : t("notConfigured"), cfg.email !== "connected")}
        {row(ta("google"), cfg.google === "connected" ? t("connected") : cfg.google === "demo-simulator" ? t("googleDemo") : t("notConfigured"), cfg.google !== "connected")}
      </dl>
    </section>
  );
}

function GoogleButton({ returnTo }: { returnTo: string }) {
  const t = useTranslations("auth");
  const cfg = useAuth((s) => s.config);
  const disabled = cfg?.google === "not-configured";
  return (
    <a
      href={disabled ? undefined : `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`}
      aria-disabled={disabled || undefined}
      data-testid="google-button"
      className={cn(btnClass("secondary", "lg", "w-full normal-case"), disabled && "pointer-events-none opacity-45")}
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2 3.5-5 3.5-8.7Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
      </svg>
      {t("continueWithGoogle")}
      {cfg?.google === "demo-simulator" && <span className="rounded-full bg-orange/25 px-2 py-0.5 text-[10px] tracking-widest text-ink">DEMO</span>}
    </a>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, invalid, describedBy }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; describedBy?: string }) {
  const t = useTranslations("auth");
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required maxLength={128} aria-invalid={invalid || undefined} aria-describedby={describedBy} className="pr-14" />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? t("hidePassword") : t("showPassword")} aria-pressed={show} className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-mute hover:text-cream">
        {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-mute">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function useErr() {
  const t = useTranslations("auth.errors");
  return (code: string | null) => (code ? (t.has(code) ? t(code) : t("generic")) : undefined);
}

function MailboxLink() {
  const t = useTranslations("auth");
  const href = useLocalHref();
  const cfg = useAuth((s) => s.config);
  if (cfg?.email !== "demo-mailbox") return null;
  return (
    <Link href={href("/auth/mailbox")} className={btnClass("ghost", "md", "mt-4 w-full")} data-testid="demo-mailbox-link">
      <Mail className="size-4" aria-hidden /> {t("demoMailbox")}
    </Link>
  );
}

function CheckEmail({ email }: { email: string }) {
  const t = useTranslations("auth");
  const [sent, setSent] = useState(false);
  return (
    <div className="rounded-3xl border-2 border-acid/60 bg-acid/10 p-5" role="status" data-testid="check-email">
      <h2 className="font-sans text-xl font-extrabold">{t("checkEmailTitle")}</h2>
      <p className="mt-2 text-[15px]">{t("checkEmailBody", { email })}</p>
      <button
        type="button"
        className="mt-3 text-sm font-bold text-acid underline underline-offset-4"
        onClick={async () => {
          await api("/api/auth/verify/resend", "POST", { email });
          setSent(true);
        }}
      >
        {t("resend")}
      </button>
      {sent && <p className="mt-2 text-sm text-mute">{t("resent")}</p>}
      <MailboxLink />
    </div>
  );
}

export function SignUpForm() {
  const t = useTranslations("auth");
  const err = useErr();
  const href = useLocalHref();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ field: "email" | "password" | "form"; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  if (done) return <CheckEmail email={done} />;

  return (
    <>
      <GoogleButton returnTo="/onboarding" />
      <Divider label={t("orEmail")} />
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError({ field: "email", code: "INVALID_EMAIL" });
          if (password.length < 10) return setError({ field: "password", code: "PASSWORD_SHORT" });
          setBusy(true);
          setError(null);
          const r = await api("/api/auth/signup", "POST", { email, password });
          setBusy(false);
          if (r.ok) setDone(email.trim().toLowerCase());
          else setError({ field: r.code === "INVALID_EMAIL" ? "email" : r.code.startsWith("PASSWORD") ? "password" : "form", code: r.code });
        }}
      >
        <Field id="email" label={t("email")} error={error?.field === "email" ? err(error.code) : undefined}>
          <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={error?.field === "email" || undefined} aria-describedby={error?.field === "email" ? "email-error" : undefined} />
        </Field>
        <Field id="password" label={t("password")} hint={t("passwordHint")} error={error?.field === "password" ? err(error.code) : undefined}>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" invalid={error?.field === "password"} describedBy={error?.field === "password" ? "password-error" : "password-hint"} />
        </Field>
        {error?.field === "form" && <p role="alert" className="text-sm font-semibold text-coral">{err(error.code)}</p>}
        <button type="submit" disabled={busy} className={btnClass("primary", "lg", "w-full")} data-testid="signup-submit">
          {busy ? "…" : t("signUp")}
        </button>
        <p className="text-xs text-mute">{t("agree")}</p>
      </form>
      <p className="mt-6 text-sm text-mute">
        {t("haveAccount")} <Link href={href("/login")} className="font-bold text-acid underline underline-offset-4">{t("signIn")}</Link>
      </p>
    </>
  );
}

export function SignInForm() {
  const t = useTranslations("auth");
  const err = useErr();
  const href = useLocalHref();
  const router = useRouter();
  const sp = useSearchParams();
  const refresh = useAuth((s) => s.refresh);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(sp.get("error"));
  const [busy, setBusy] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const returnTo = sp.get("returnTo") ?? "/";

  return (
    <>
      <GoogleButton returnTo={returnTo} />
      <Divider label={t("orEmail")} />
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(null);
          setUnverified(false);
          const r = await api<{ next: string }>("/api/auth/signin", "POST", { email, password, returnTo });
          if (r.ok) {
            await refresh();
            router.push(href(r.data.next));
            router.refresh();
            return;
          }
          setBusy(false);
          setError(r.code);
          if (r.code === "EMAIL_NOT_VERIFIED") setUnverified(true);
        }}
      >
        <Field id="email" label={t("email")}>
          <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error) || undefined} />
        </Field>
        <Field id="password" label={t("password")}>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" invalid={Boolean(error)} />
        </Field>
        {error && <p role="alert" className="text-sm font-semibold text-coral" data-testid="auth-error">{err(error)}</p>}
        {unverified && <CheckEmail email={email.trim().toLowerCase()} />}
        <button type="submit" disabled={busy} className={btnClass("primary", "lg", "w-full")} data-testid="signin-submit">
          {busy ? "…" : t("signIn")}
        </button>
        <Link href={href("/forgot-password")} className="inline-flex min-h-11 items-center text-sm font-bold text-acid underline underline-offset-4">{t("forgot")}</Link>
      </form>
      <p className="mt-4 text-sm text-mute">
        {t("noAccount")} <Link href={href("/signup")} className="font-bold text-acid underline underline-offset-4">{t("signUp")}</Link>
      </p>
    </>
  );
}

export function VerifyEmail() {
  const t = useTranslations("auth");
  const sp = useSearchParams();
  const router = useRouter();
  const href = useLocalHref();
  const refresh = useAuth((s) => s.refresh);
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  useEffect(() => {
    const token = sp.get("token");
    if (!token) return setState("failed");
    let cancelled = false;
    // POST (not GET) so link scanners in mail clients can't consume the token.
    api<{ next: string }>("/api/auth/verify", "POST", { token }).then(async (r) => {
      if (cancelled) return;
      if (!r.ok) return setState("failed");
      setState("done");
      await refresh();
      router.replace(href(r.data.next));
    });
    return () => {
      cancelled = true;
    };
  }, [sp, router, href, refresh]);
  return (
    <div role="status" aria-live="polite" data-testid="verify-state" data-state={state}>
      {state === "working" && <p className="text-lg">{t("verifyTitle")}</p>}
      {state === "done" && <p className="text-lg font-bold text-acid">{t("verifyDone")}</p>}
      {state === "failed" && (
        <div>
          <p className="text-lg font-bold text-coral">{t("verifyFailed")}</p>
          <Link href={href("/login")} className={btnClass("primary", "md", "mt-4")}>{t("verifyAgain")}</Link>
        </div>
      )}
    </div>
  );
}

export function ResetForms() {
  const t = useTranslations("auth");
  const err = useErr();
  const href = useLocalHref();
  const sp = useSearchParams();
  const token = sp.get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (token) {
    if (done)
      return (
        <div role="status" className="rounded-3xl border-2 border-acid/60 bg-acid/10 p-5" data-testid="reset-done">
          <p className="text-[15px] font-bold">{t("resetDone")}</p>
          <Link href={href("/login")} className={btnClass("primary", "md", "mt-4")}>{t("signIn")}</Link>
        </div>
      );
    return (
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password.length < 10) return setError("PASSWORD_SHORT");
          setBusy(true);
          const r = await api("/api/auth/reset/confirm", "POST", { token, password });
          setBusy(false);
          if (r.ok) setDone(true);
          else setError(r.code);
        }}
      >
        <h2 className="font-sans text-xl font-extrabold">{t("newPasswordTitle")}</h2>
        <Field id="password" label={t("newPassword")} hint={t("passwordHint")} error={err(error)}>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" invalid={Boolean(error)} describedBy={error ? "password-error" : "password-hint"} />
        </Field>
        <button type="submit" disabled={busy} className={btnClass("primary", "lg", "w-full")} data-testid="reset-confirm">{t("setPassword")}</button>
      </form>
    );
  }
  if (done) {
    return (
      <div role="status" className="rounded-3xl border-2 border-acid/60 bg-acid/10 p-5" data-testid="reset-sent">
        <p className="text-[15px]">{t("resetSent", { email })}</p>
        <MailboxLink />
      </div>
    );
  }
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("INVALID_EMAIL");
        setBusy(true);
        const r = await api("/api/auth/reset/request", "POST", { email });
        setBusy(false);
        if (r.ok) setDone(true);
        else setError(r.code);
      }}
    >
      <Field id="email" label={t("email")} error={err(error)}>
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error) || undefined} aria-describedby={error ? "email-error" : undefined} />
      </Field>
      <button type="submit" disabled={busy} className={btnClass("primary", "lg", "w-full")} data-testid="reset-request">{t("resetSend")}</button>
    </form>
  );
}

export function GoogleDemoForm() {
  const t = useTranslations("auth");
  const err = useErr();
  const router = useRouter();
  const href = useLocalHref();
  const sp = useSearchParams();
  const refresh = useAuth((s) => s.refresh);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await api<{ next: string }>("/api/auth/google/demo", "POST", { email, returnTo: sp.get("returnTo") ?? "/" });
        if (!r.ok) return setError(r.code);
        await refresh();
        router.push(href(r.data.next));
        router.refresh();
      }}
    >
      <p className="rounded-2xl border-2 border-orange/60 bg-orange/10 p-4 text-sm font-semibold text-orange" role="note">{t("googleDemoNote")}</p>
      <Field id="gemail" label={t("googleDemoEmail")} error={err(error)}>
        <Input id="gemail" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <button type="submit" className={btnClass("secondary", "lg", "w-full")} data-testid="google-demo-submit">{t("googleDemoContinue")}</button>
    </form>
  );
}
