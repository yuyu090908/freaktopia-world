"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, Wallet } from "lucide-react";
import { Field, Input, Select, ToggleRow } from "@/components/forms/Fields";
import { btnClass } from "@/components/ui/primitives";
import { ConnectionStatus } from "@/components/auth/AuthForms";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { LOCALE_META } from "@/i18n/config";
import { api, useAuth } from "@/lib/auth/client";
import type { PrivacyRecord, Visibility } from "@/lib/auth/types";
import { GENRES } from "@/lib/data";
import { toast, useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

const COUNTRIES = ["JP", "KR", "CN", "TW", "TH", "VN", "ID", "PH", "IN", "US", "BR", "MX", "AR", "GB", "FR", "DE", "ES", "IT", "NL", "RU", "UA", "PL", "ZA", "NG", "AU"];

export function AccountSettings() {
  const t = useTranslations("profile");
  const tp = useTranslations("profile.privacy");
  const tauth = useTranslations("auth");
  const ta = useTranslations("alien");
  const tc = useTranslations("common");
  const href = useLocalHref();
  const router = useRouter();
  const { status, me, refresh } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [walletMsg, setWalletMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.profile.displayName ?? "");
    setUsername(me.profile.username ?? "");
    setCountry(me.profile.country ?? "");
    setGenres(me.profile.favoriteGenres);
  }, [me]);

  if (status === "loading") return <p role="status" className="text-mute">{tc("loading")}</p>;
  if (!me) {
    return (
      <div>
        <p className="text-mute">{t("notSignedIn")}</p>
        <Link href={href("/auth/signin?returnTo=/profile/settings")} className={btnClass("primary", "md", "mt-4")}>{tauth("signIn")}</Link>
      </div>
    );
  }

  const regionName = (code: string) => {
    try {
      return new Intl.DisplayNames([LOCALE_META[me.profile.locale].intl], { type: "region" }).of(code) ?? code;
    } catch {
      return code;
    }
  };

  const setPrivacy = async (patch: Partial<Omit<PrivacyRecord, "userId">>) => {
    const r = await api("/api/me/privacy", "PATCH", patch);
    if (r.ok) {
      await refresh();
      toast({ title: tc("saved"), tone: "success" });
    } else toast({ title: tauth("errors.generic"), tone: "error" });
  };

  const vis = (key: "profile" | "avatar" | "activity", label: string, hint?: string) => (
    <fieldset className="rounded-2xl border-2 border-line bg-surface p-4">
      <legend className="sr-only">{label}</legend>
      <div className="font-bold">{label}</div>
      {hint && <div className="text-xs text-mute">{hint}</div>}
      <div className="mt-3 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={label}>
        {(["public", "friends", "private"] as Visibility[]).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={me.privacy[key] === v} onClick={() => setPrivacy({ [key]: v })} data-testid={`privacy-${key}-${v}`} className={cn("min-h-11 rounded-xl border-2 px-2 text-sm font-bold leading-tight", me.privacy[key] === v ? "border-acid bg-acid/15 text-acid" : "border-line")}>
            {tp(v)}
          </button>
        ))}
      </div>
    </fieldset>
  );

  const linkWallet = async () => {
    const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) return setWalletMsg(tauth("walletNone"));
    try {
      const [address] = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const n = await fetch("/api/auth/wallet/nonce").then((r) => r.json());
      const signature = await eth.request({ method: "personal_sign", params: [n.message, address] });
      const r = await api("/api/auth/wallet/link", "POST", { address, signature });
      if (r.ok) {
        await refresh();
        setWalletMsg(tauth("walletLinked"));
      } else setWalletMsg(tauth.has(`errors.${r.code}`) ? tauth(`errors.${r.code}`) : tauth("errors.generic"));
    } catch {
      setWalletMsg(tauth("errors.generic"));
    }
  };

  return (
    <div className="space-y-10">
      {!me.user.emailVerified && <p className="rounded-2xl border-2 border-orange/60 bg-orange/10 p-4 text-sm font-semibold text-orange" role="note">{tauth("unverifiedBanner")}</p>}

      <section aria-labelledby="s-profile">
        <h2 id="s-profile" className="text-2xl uppercase">{t("editProfile")}</h2>
        <form
          noValidate
          className="mt-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            setBusy(true);
            const patch: Record<string, unknown> = { country: country || null, favoriteGenres: genres };
            if (displayName.trim()) patch.displayName = displayName.trim();
            if (username.trim()) patch.username = username.trim().toLowerCase();
            const r = await api("/api/me/profile", "PATCH", patch);
            setBusy(false);
            if (!r.ok) return setErr(r.code === "USERNAME_TAKEN" ? tauth("errors.USERNAME_TAKEN") : String(r.data.field ?? r.code));
            await refresh();
            useDemo.getState().updateProfile({ favoriteGenres: genres as never });
            toast({ title: tc("saved"), tone: "success" });
          }}
        >
          <Field id="dn" label={ta("displayName")} hint={ta("displayNameHint")}>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={32} autoComplete="nickname" />
          </Field>
          <Field id="un" label={ta("username")} hint={ta("usernameHint")} optional error={err ?? undefined}>
            <Input id="un" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} autoCapitalize="none" autoComplete="username" />
          </Field>
          <Field id="ct" label={t("country")} optional>
            <Select id="ct" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">{t("countryNone")}</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{regionName(c)}</option>)}
            </Select>
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">{t("favoriteGenres")}</legend>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const on = genres.includes(g);
                return (
                  <button key={g} type="button" aria-pressed={on} onClick={() => setGenres(on ? genres.filter((x) => x !== g) : [...genres, g].slice(0, 12))} className={cn("min-h-11 rounded-full border-2 px-4 text-sm font-bold", on ? "border-acid bg-acid/15 text-acid" : "border-line")}>
                    {g}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <button type="submit" disabled={busy} className={btnClass("primary", "md")} data-testid="profile-save">{busy ? tc("saving") : tc("save")}</button>
        </form>
      </section>

      <section aria-labelledby="s-privacy" data-testid="privacy-settings">
        <h2 id="s-privacy" className="text-2xl uppercase">{tp("title")}</h2>
        <p className="mt-1 text-sm text-mute">{tp("lead")}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {vis("profile", tp("profile"))}
          {vis("avatar", tp("avatar"))}
          {vis("activity", tp("activity"), tp("activityHint"))}
        </div>
        <div className="mt-3 space-y-2">
          <ToggleRow checked={me.privacy.showCountry} onChange={(v) => setPrivacy({ showCountry: v })} label={tp("showCountry")} />
          <span data-testid="toggle-map-presence" className="block"><ToggleRow checked={me.privacy.mapPresence} onChange={(v) => setPrivacy({ mapPresence: v })} label={tp("mapPresence")} sub={tp("mapPresenceHint")} /></span>
          <span data-testid="toggle-live-avatar" className="block"><ToggleRow checked={me.privacy.liveAvatar} onChange={(v) => setPrivacy({ liveAvatar: v })} label={tp("liveAvatar")} sub={tp("liveAvatarHint")} /></span>
        </div>
      </section>

      <section aria-labelledby="s-signin">
        <h2 id="s-signin" className="text-2xl uppercase">{tauth("providers")}</h2>
        <p className="mt-1 text-sm text-mute">{tauth("signedInAs", { email: me.user.email })}</p>
        <ul className="mt-3 divide-y divide-line rounded-2xl border-2 border-line bg-surface">
          <li className="flex min-h-14 items-center justify-between px-4"><span>{tauth("emailPassword")}</span><b className={me.user.hasPassword ? "text-acid" : "text-mute"}>{me.user.hasPassword ? tc("on") : tc("off")}</b></li>
          <li className="flex min-h-14 items-center justify-between px-4"><span>{tauth("google")}</span><b className={me.providers.includes("google") ? "text-acid" : "text-mute"}>{me.providers.includes("google") ? tc("on") : tc("off")}</b></li>
          <li className="px-4 py-3">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <span>{tauth("wallet")}</span>
              {me.wallets.length ? <code className="truncate text-xs text-acid">{me.wallets.map((w) => `${w.address.slice(0, 6)}…${w.address.slice(-4)}`).join(", ")}</code> : <button type="button" onClick={linkWallet} className={btnClass("ghost", "sm")}><Wallet className="size-4" aria-hidden />{tauth("linkWallet")}</button>}
            </div>
            <p className="mt-1 text-xs text-mute">{tauth("walletNote")}</p>
            {walletMsg && <p role="status" className="mt-1 text-sm font-semibold">{walletMsg}</p>}
          </li>
        </ul>
        <button
          type="button"
          data-testid="signout"
          className={btnClass("coral", "md", "mt-5")}
          onClick={async () => {
            await api("/api/auth/signout", "POST");
            await refresh();
            toast({ title: tauth("signedOut"), tone: "success" });
            router.push(href("/"));
            router.refresh();
          }}
        >
          <LogOut className="size-4" aria-hidden /> {tauth("signOut")}
        </button>
      </section>
      <ConnectionStatus />
    </div>
  );
}
