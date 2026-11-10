"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, Briefcase, CalendarDays, Package, Pencil, Plus, Star, Trash2, Users } from "lucide-react";
import { Field, Input, Select, Textarea, ToggleRow } from "@/components/forms/Fields";
import { Button, Chip, PageTitle } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { Section, SignInGate, StatusPill, fileToBase64, useMoney, useOps, useOpsPost, useWhen } from "@/components/ops/shared";
import { AgreementAction } from "@/app/events/manage/[id]/tabs/Resources";
import { CITIES } from "@/lib/ops/geo";
import { CREDENTIALS, SERVICE_KEYS } from "@/lib/ops/planner";
import { SCALE_LEVELS, type Agreement, type Application, type Listing, type ListingType, type Opening, type ProviderRole, type WorkProfile } from "@/lib/ops/types";

const ROLES: ProviderRole[] = ["attendee", "dj", "organizer", "staff", "equipment_owner", "company"];

interface ProfileData {
  profile: WorkProfile | null;
  listings: Listing[];
  trust: { reviews: { count: number; overall: number | null; punctuality: number | null; communication: number | null; delivery: number | null; quality: number | null }; completedJobs: number };
  work: { applications: (Application & { eventName?: string })[]; agreements: (Agreement & { eventName?: string })[] };
}
interface Opportunity {
  opening: Opening;
  event: { id: string; name: string; city: string; country: string; startAt: string; endAt: string; timezone: string; attendance: number; level: number; setting: string };
  requirements: { id: string; key: string; quantity: number; unit: string; credential: string | null }[];
  myApplication: Application | null;
}

export function WorkView() {
  const t = useTranslations("ops");
  return (
    <div className="mx-auto max-w-5xl pb-16 md:px-6">
      <PageTitle kicker={t("workKicker")} title={t("workTitle")} sub={t("workSub")} />
      <div className="px-4 md:px-0">
        <SignInGate returnTo="/profile/work">
          <Inner />
        </SignInGate>
      </div>
    </div>
  );
}

function Inner() {
  const t = useTranslations("ops");
  const href = useLocalHref();
  const { data, reload } = useOps<ProfileData>("/api/ops/profile");
  const opp = useOps<{ opportunities: Opportunity[] }>("/api/ops/opportunities");
  const reloadAll = async () => {
    await Promise.all([reload(), opp.reload()]);
  };
  if (!data) return <div className="h-64 animate-pulse rounded-3xl bg-surface" />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href={href("/events/manage")} className="inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-cream/30 px-4 text-sm font-extrabold uppercase">
          <Briefcase className="size-4" aria-hidden /> {t("manageTitle")}
        </Link>
      </div>
      <ProfileForm profile={data.profile} reload={reloadAll} />
      <Trust trust={data.trust} profile={data.profile} />
      <Listings listings={data.listings} reload={reloadAll} />
      <Opportunities items={opp.data?.opportunities ?? []} listings={data.listings} reload={reloadAll} />
      <MyWork work={data.work} reload={reloadAll} />
    </div>
  );
}

// ------------------------------------------------------------------ one shared profile with several roles

function ProfileForm({ profile, reload }: { profile: WorkProfile | null; reload: () => Promise<void> }) {
  const t = useTranslations("ops");
  const post = useOpsPost();
  const [open, setOpen] = useState(!profile);
  const [roles, setRoles] = useState<ProviderRole[]>(profile?.roles ?? ["attendee"]);
  const [displayName, setName] = useState(profile?.displayName === "—" ? "" : profile?.displayName ?? "");
  const [regions, setRegions] = useState<string[]>(profile?.regions ?? []);
  const [services, setServices] = useState<string[]>(profile?.services ?? []);
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [maxEventSize, setMax] = useState(profile?.maxEventSize ?? 0);
  const [pastWork, setPast] = useState((profile?.pastWork ?? []).join("\n"));
  const [creds, setCreds] = useState<string[]>(profile?.credentials.map((c) => c.key) ?? []);
  const toggle = <T,>(list: T[], set: (v: T[]) => void, k: T) => set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const save = async () => {
    const r = await post("profile", { roles, displayName: displayName.trim() || "—", regions, services, bio, maxEventSize, pastWork: pastWork.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20), credentials: creds }, t("saved"));
    if (r) {
      setOpen(false);
      await reload();
    }
  };
  return (
    <Section title={t("workProfile")} id="wp-h" action={profile && !open ? <Button size="sm" variant="ghost" onClick={() => setOpen(true)} data-testid="edit-work-profile"><Pencil className="size-4" aria-hidden /> {t("edit")}</Button> : undefined}>
      {!open && profile ? (
        <div className="space-y-2 text-sm" data-testid="work-profile">
          <div className="text-xl font-bold">{profile.displayName}</div>
          <div className="flex flex-wrap gap-1">{profile.roles.map((r) => <span key={r} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold">{t(`providerRole.${r}`)}</span>)}</div>
          {profile.bio && <p>{profile.bio}</p>}
          <p className="text-mute">{t("regionsLabel")}: {profile.regions.join(", ") || "—"}</p>
          <p className="text-mute">{t("servicesLabel")}: {profile.services.map((k) => t(`req.${k}`)).join(", ") || "—"}</p>
          {profile.maxEventSize > 0 && <p className="text-mute">{t("maxEventSize")}: {profile.maxEventSize}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-mute">{t("oneProfile")}</p>
          <div className="flex flex-wrap gap-2" data-testid="roles">{ROLES.map((r) => <Chip key={r} active={roles.includes(r)} onClick={() => toggle(roles, setRoles, r)} data-role={r}>{t(`providerRole.${r}`)}</Chip>)}</div>
          <Field id="wp-name" label={t("displayName")}><Input id="wp-name" value={displayName} maxLength={40} onChange={(e) => setName(e.target.value)} data-testid="wp-name" /></Field>
          <details className="rounded-2xl border-2 border-line p-3"><summary className="min-h-11 cursor-pointer content-center font-bold">{t("regionsLabel")} ({regions.length})</summary>
            <div className="mt-2 flex flex-wrap gap-2">{CITIES.map((c) => <Chip key={c.name} active={regions.includes(c.name)} onClick={() => toggle(regions, setRegions, c.name)} className="min-h-9 px-3 text-xs">{c.name}</Chip>)}</div>
          </details>
          <details className="rounded-2xl border-2 border-line p-3"><summary className="min-h-11 cursor-pointer content-center font-bold">{t("servicesLabel")} ({services.length})</summary>
            <div className="mt-2 flex flex-wrap gap-2">{SERVICE_KEYS.map((k) => <Chip key={k} active={services.includes(k)} onClick={() => toggle(services, setServices, k)} className="min-h-9 px-3 text-xs">{t(`req.${k}`)}</Chip>)}</div>
          </details>
          <Field id="wp-bio" label={t("bio")} optional><Textarea id="wp-bio" value={bio} maxLength={600} onChange={(e) => setBio(e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="wp-max" label={t("maxEventSize")} hint={t("selfDeclared")}><Input id="wp-max" type="number" min={0} value={maxEventSize} onChange={(e) => setMax(Math.max(0, Number(e.target.value) || 0))} /></Field>
            <Field id="wp-past" label={t("pastWork")} hint={t("onePerLine")} optional><Textarea id="wp-past" rows={3} value={pastWork} onChange={(e) => setPast(e.target.value)} /></Field>
          </div>
          <div>
            <div className="mb-1 text-sm font-bold">{t("credentials")}</div>
            <div className="flex flex-wrap gap-2">{CREDENTIALS.map((c) => <Chip key={c} active={creds.includes(c)} onClick={() => toggle(creds, setCreds, c)} className="min-h-9 px-3 text-xs">{t(`cred.${c}`)}</Chip>)}</div>
            <p className="mt-1 text-xs text-mute">{t("credentialsNote")}</p>
          </div>
          <Button onClick={() => void save()} data-testid="save-work-profile">{t("save")}</Button>
        </div>
      )}
    </Section>
  );
}

function Trust({ trust, profile }: { trust: ProfileData["trust"]; profile: WorkProfile | null }) {
  const t = useTranslations("ops");
  const v = (n: number | null) => (n == null ? "—" : n.toFixed(1));
  return (
    <Section title={t("trust")} id="trust-h">
      <p className="mb-3 text-xs text-mute">{t("trustSub")}</p>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-surface-2 p-3">
          <div className="flex items-center gap-1 font-bold"><Star className="size-4 text-acid" aria-hidden /> {v(trust.reviews.overall)} · {t("reviewCount", { count: trust.reviews.count })}</div>
          <ul className="mt-1 text-xs text-mute">
            {(["punctuality", "communication", "delivery", "quality"] as const).map((k) => <li key={k}>{t(`score.${k}`)}: {v(trust.reviews[k])}</li>)}
          </ul>
          <div className="mt-1 text-xs">{t("completedJobs", { count: trust.completedJobs })}</div>
        </div>
        <div className="rounded-2xl bg-surface-2 p-3 text-xs">
          <div className="mb-1 flex items-center gap-1 text-sm font-bold"><BadgeCheck className="size-4" aria-hidden /> {t("verification")}</div>
          <div>{t("identity")}: {t(`verif.${profile?.identity ?? "unverified"}`)}</div>
          <div>{t("business")}: {t(`verif.${profile?.business ?? "unverified"}`)}</div>
          {profile?.credentials.map((c) => <div key={c.key}>{t(`cred.${c.key}`)}: <span className={c.status === "verified" ? "text-acid" : "text-orange"}>{t(`verif.${c.status}`)}</span></div>)}
          <p className="mt-1 text-mute">{t("noKyc")}</p>
        </div>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ listings (gear, services, packages)

function Listings({ listings, reload }: { listings: Listing[]; reload: () => Promise<void> }) {
  const t = useTranslations("ops");
  const money = useMoney();
  const [edit, setEdit] = useState<Listing | "new" | null>(null);
  return (
    <Section title={t("listings")} id="ls-h" action={<Button size="sm" onClick={() => setEdit("new")} data-testid="new-listing"><Plus className="size-4" aria-hidden /> {t("newListing")}</Button>}>
      {listings.length === 0 && <p className="text-sm text-mute">{t("noListings")}</p>}
      <ul className="grid gap-2 sm:grid-cols-2" data-testid="my-listings">
        {listings.map((l) => (
          <li key={l.id} className="rounded-2xl bg-surface-2 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1 font-bold"><Package className="size-4" aria-hidden /> <span className="truncate">{l.title}</span></div>
                <div className="text-xs text-mute">{t(`listingType.${l.type}`)} · {l.city} · {money(l.priceUsd)} {l.active ? "" : `· ${t("inactive")}`}</div>
              </div>
              <button type="button" className="min-h-11 px-2 text-xs font-bold text-acid underline" onClick={() => setEdit(l)}>{t("edit")}</button>
            </div>
            <div className="mt-1 text-xs">{l.items.map((i) => `${t(`req.${i.key}`)} ×${i.quantity}${i.model ? ` (${i.model})` : ""}`).join(", ")}</div>
          </li>
        ))}
      </ul>
      {edit && <ListingSheet listing={edit === "new" ? null : edit} onClose={() => setEdit(null)} reload={reload} />}
    </Section>
  );
}

function ListingSheet({ listing, onClose, reload }: { listing: Listing | null; onClose: () => void; reload: () => Promise<void> }) {
  const t = useTranslations("ops");
  const post = useOpsPost();
  const [type, setType] = useState<ListingType>(listing?.type ?? "equipment");
  const [title, setTitle] = useState(listing?.title ?? "");
  const [city, setCity] = useState(listing?.city ?? "Tokyo");
  const [items, setItems] = useState(listing?.items ?? [{ key: "cdj", quantity: 1, model: "" }]);
  const [priceUsd, setPrice] = useState(listing?.priceUsd ?? 100);
  const [deposit, setDeposit] = useState(listing?.deposit ?? 0);
  const [insurance, setInsurance] = useState(listing?.insurance ?? "");
  const [damageTerms, setDamage] = useState(listing?.damageTerms ?? "");
  const [delivery, setDelivery] = useState(listing?.delivery ?? false);
  const [setup, setSetup] = useState(listing?.setup ?? false);
  const [operatorIncluded, setOperator] = useState(listing?.operatorIncluded ?? false);
  const [maxAudience, setMax] = useState(listing?.maxAudience ?? 200);
  const [from, setFrom] = useState(listing?.availability[0]?.from.slice(0, 10) ?? "");
  const [to, setTo] = useState(listing?.availability[0]?.to.slice(0, 10) ?? "");
  const [active, setActive] = useState(listing?.active ?? true);
  const save = async () => {
    const body = {
      type, title, city, items: items.filter((i) => i.quantity > 0), priceUsd, deposit, insurance, damageTerms, delivery, setup, operatorIncluded, maxAudience, active,
      availability: from && to ? [{ from: new Date(`${from}T00:00:00Z`).toISOString(), to: new Date(`${to}T23:59:59Z`).toISOString() }] : [],
    };
    if (await post(listing ? `listings/${listing.id}` : "listings", body, t("saved"))) {
      onClose();
      await reload();
    }
  };
  return (
    <BottomSheet open onClose={onClose} title={listing ? t("editListing") : t("newListing")} footer={<div className="flex justify-end"><Button disabled={title.trim().length < 2 || !items.length} onClick={() => void save()} data-testid="save-listing">{t("save")}</Button></div>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">{(["equipment", "person", "company", "package"] as ListingType[]).map((x) => <Chip key={x} active={type === x} onClick={() => setType(x)} className="min-h-9 px-3 text-xs" data-type={x}>{t(`listingType.${x}`)}</Chip>)}</div>
        <p className="text-xs text-mute">{t(`listingTypeHint.${type}`)}</p>
        <Field id="l-title" label={t("listingTitle")}><Input id="l-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} data-testid="listing-title" /></Field>
        <Field id="l-city" label={t("fCity")}><Select id="l-city" value={city} onChange={(e) => setCity(e.target.value)} data-testid="listing-city">{CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</Select></Field>
        <div className="space-y-2">
          <div className="text-sm font-bold">{t("whatYouProvide")}</div>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_72px_44px] gap-2 sm:grid-cols-[1fr_72px_1fr_44px]">
              <label className="sr-only" htmlFor={`li-k-${i}`}>{t("item")}</label>
              <Select id={`li-k-${i}`} value={it.key} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} data-testid={`item-key-${i}`}>{SERVICE_KEYS.map((k) => <option key={k} value={k}>{t(`req.${k}`)}</option>)}</Select>
              <label className="sr-only" htmlFor={`li-q-${i}`}>{t("quantity")}</label>
              <Input id={`li-q-${i}`} type="number" min={1} value={it.quantity} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))} data-testid={`item-qty-${i}`} />
              <label className="sr-only" htmlFor={`li-m-${i}`}>{t("model")}</label>
              <Input id={`li-m-${i}`} className="col-span-2 sm:col-span-1" placeholder={t("modelPlaceholder")} value={it.model} maxLength={80} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, model: e.target.value } : x)))} />
              <button type="button" aria-label={t("delete")} className="flex size-11 items-center justify-center rounded-full border border-line" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="size-4" aria-hidden /></button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setItems([...items, { key: "main_pa", quantity: 1, model: "" }])} data-testid="add-item"><Plus className="size-4" aria-hidden /> {t("addItem")}</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="l-price" label={t("pricePerDay")}><Input id="l-price" type="number" min={0} value={priceUsd} onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))} data-testid="listing-price" /></Field>
          <Field id="l-dep" label={t("deposit")}><Input id="l-dep" type="number" min={0} value={deposit} onChange={(e) => setDeposit(Math.max(0, Number(e.target.value) || 0))} /></Field>
          <Field id="l-max" label={t("maxAudience")}><Input id="l-max" type="number" min={1} value={maxAudience} onChange={(e) => setMax(Math.max(1, Number(e.target.value) || 1))} /></Field>
        </div>
        <ToggleRow checked={delivery} onChange={setDelivery} label={t("delivery")} />
        <ToggleRow checked={setup} onChange={setSetup} label={t("setupIncluded")} />
        <ToggleRow checked={operatorIncluded} onChange={setOperator} label={t("operatorIncluded")} />
        <Field id="l-ins" label={t("insurance")} optional><Input id="l-ins" value={insurance} maxLength={300} onChange={(e) => setInsurance(e.target.value)} /></Field>
        <Field id="l-dmg" label={t("damageTerms")} optional><Input id="l-dmg" value={damageTerms} maxLength={300} onChange={(e) => setDamage(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="l-from" label={t("availableFrom")} optional><Input id="l-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field id="l-to" label={t("availableTo")} optional><Input id="l-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <p className="text-xs text-mute">{t("availabilityHint")}</p>
        <ToggleRow checked={active} onChange={setActive} label={t("listingActive")} />
        <p className="text-xs text-mute">{t("photosNotYet")}</p>
      </div>
    </BottomSheet>
  );
}

// ------------------------------------------------------------------ opportunities (open calls, offers, quote requests)

function Opportunities({ items, listings, reload }: { items: Opportunity[]; listings: Listing[]; reload: () => Promise<void> }) {
  const t = useTranslations("ops");
  const when = useWhen();
  const money = useMoney();
  const [apply, setApply] = useState<Opportunity | null>(null);
  return (
    <Section title={t("opportunities")} id="opp-h">
      <p className="mb-3 text-xs text-mute">{t("opportunitiesSub")}</p>
      {items.length === 0 && <p className="text-sm text-mute">{t("noOpportunities")}</p>}
      <ul className="space-y-2" data-testid="opportunities">
        {items.map((o) => (
          <li key={o.opening.id} className="rounded-2xl bg-surface-2 p-3 text-sm" data-kind={o.opening.kind}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-extrabold uppercase">{t(`openingKind.${o.opening.kind}`)}</span>
              <span className="min-w-0 flex-1 font-bold">{o.event.name}</span>
              {o.myApplication && <StatusPill status={o.myApplication.status} label={t(`appStatus.${o.myApplication.status}`)} />}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-mute">
              <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden /> {when(o.event.startAt, o.event.timezone)}</span>
              <span>{o.event.city}</span>
              <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden /> {o.event.attendance} · L{o.event.level} {t(`level.${SCALE_LEVELS[o.event.level - 1].key}`)}</span>
              {o.opening.budgetUsd != null && <span>{t("budgetForThis")}: {money(o.opening.budgetUsd)}</span>}
            </div>
            <div className="mt-1">{o.requirements.map((r) => `${t(`req.${r.key}`)} ×${r.quantity}${r.credential ? ` (${t(`cred.${r.credential}`)})` : ""}`).join(" + ")}</div>
            {o.opening.message && <p className="mt-1 text-xs">{o.opening.message}</p>}
            {!o.myApplication && <Button size="sm" className="mt-2" onClick={() => setApply(o)} data-testid="apply">{o.opening.kind === "quote" ? t("sendQuote") : t("apply")}</Button>}
          </li>
        ))}
      </ul>
      {apply && <ApplySheet o={apply} listings={listings} onClose={() => setApply(null)} reload={reload} />}
    </Section>
  );
}

function ApplySheet({ o, listings, onClose, reload }: { o: Opportunity; listings: Listing[]; onClose: () => void; reload: () => Promise<void> }) {
  const t = useTranslations("ops");
  const post = useOpsPost();
  const fits = listings.filter((l) => l.active && o.requirements.some((r) => l.items.some((i) => i.key === r.key)) && (o.opening.kind === "open" || l.id === o.opening.targetListingId));
  const [listingId, setListing] = useState(fits[0]?.id ?? "");
  const [price, setPrice] = useState(fits[0]?.priceUsd ?? 0);
  const [message, setMessage] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const l = fits.find((x) => x.id === listingId);
    if (l) setPrice(l.priceUsd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);
  const send = async () => {
    setBusy(true);
    let quoteDocumentId: string | null = null;
    if (file) {
      const d = await post<{ document: { id: string } }>(`openings/${o.opening.id}/quote`, { name: file.name, mime: file.type || "application/pdf", data: await fileToBase64(file) });
      if (!d) return setBusy(false);
      quoteDocumentId = d.document.id;
    }
    const covered = o.requirements.filter((r) => fits.find((l) => l.id === listingId)?.items.some((i) => i.key === r.key)).map((r) => r.id);
    const r = await post(`openings/${o.opening.id}/apply`, { listingId, requirementIds: covered, priceUsd: price, message, portfolio, quoteDocumentId, availableFrom: o.event.startAt, availableTo: o.event.endAt }, t("applied"));
    setBusy(false);
    if (r) {
      onClose();
      await reload();
    }
  };
  return (
    <BottomSheet open onClose={onClose} title={o.opening.kind === "quote" ? t("sendQuote") : t("apply")} footer={<div className="flex justify-end"><Button disabled={!listingId || busy} onClick={() => void send()} data-testid="send-application">{t("send")}</Button></div>}>
      {fits.length === 0 ? (
        <p className="text-sm">{t("needListingFirst")}</p>
      ) : (
        <div className="space-y-3">
          <Field id="ap-l" label={t("useListing")}><Select id="ap-l" value={listingId} onChange={(e) => setListing(e.target.value)}>{fits.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</Select></Field>
          <Field id="ap-p" label={t("yourPrice")}><Input id="ap-p" type="number" min={0} value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))} data-testid="apply-price" /></Field>
          <Field id="ap-m" label={t("proposal")} optional><Textarea id="ap-m" value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} data-testid="apply-message" /></Field>
          <Field id="ap-pf" label={t("portfolio")} optional><Input id="ap-pf" value={portfolio} maxLength={2000} onChange={(e) => setPortfolio(e.target.value)} /></Field>
          <Field id="ap-f" label={t("quoteFile")} optional hint={t("quoteFileHint")}><input id="ap-f" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" className="block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        </div>
      )}
    </BottomSheet>
  );
}

// ------------------------------------------------------------------ my applications and agreements

function MyWork({ work, reload }: { work: ProfileData["work"]; reload: () => Promise<void> }) {
  const t = useTranslations("ops");
  const money = useMoney();
  const post = useOpsPost();
  const href = useLocalHref();
  const [act, setAct] = useState<{ ag: Agreement & { eventName?: string }; kind: "accept" | "cancel" | "change" | "review" } | null>(null);
  return (
    <Section title={t("myJobs")} id="jobs-h">
      {work.applications.length === 0 && work.agreements.length === 0 && <p className="text-sm text-mute">{t("noJobs")}</p>}
      <ul className="space-y-2" data-testid="my-agreements">
        {work.agreements.map((ag) => (
          <li key={ag.id} className="rounded-2xl bg-surface-2 p-3 text-sm" data-status={ag.status}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 font-bold">{ag.eventName}</span>
              <span className="tabular-nums">{money(ag.terms.amountUsd)}</span>
              <StatusPill status={ag.status} label={t(`agStatus.${ag.status}`)} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(ag.status === "proposed" || ag.status === "changed") && !ag.providerAcceptedAt && <Button size="sm" onClick={() => setAct({ ag, kind: "accept" })} data-testid="provider-accept">{t("acceptTerms")}</Button>}
              {!["cancelled", "completed"].includes(ag.status) && <Button size="sm" variant="ghost" onClick={() => setAct({ ag, kind: "change" })}>{t("changeTerms")}</Button>}
              {ag.status === "agreed" && <Link href={href(`/events/manage/${ag.eventId}?tab=operations`)} className="inline-flex min-h-11 items-center px-2 text-xs font-bold text-acid underline">{t("openTeamSpace")}</Link>}
              {ag.status === "completed" && <Button size="sm" variant="ghost" onClick={() => setAct({ ag, kind: "review" })}>{t("writeReview")}</Button>}
              {!["cancelled", "completed"].includes(ag.status) && <Button size="sm" variant="ghost" className="text-coral" onClick={() => setAct({ ag, kind: "cancel" })}>{t("cancelAgreement")}</Button>}
            </div>
          </li>
        ))}
        {work.applications.filter((a) => a.status !== "accepted").map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
            <span className="min-w-0 flex-1 font-bold">{a.eventName}</span>
            <span className="tabular-nums">{money(a.priceUsd)}</span>
            <StatusPill status={a.status} label={t(`appStatus.${a.status}`)} />
            {["submitted", "shortlisted"].includes(a.status) && <Button size="sm" variant="ghost" onClick={async () => { if (await post(`applications/${a.id}/withdraw`)) await reload(); }}>{t("withdraw")}</Button>}
          </li>
        ))}
      </ul>
      {act && <AgreementAction ag={act.ag} kind={act.kind} label={act.ag.eventName ?? "—"} onClose={() => setAct(null)} reload={reload} />}
    </Section>
  );
}
