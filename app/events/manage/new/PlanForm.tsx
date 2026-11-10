"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, Rocket, ShieldAlert } from "lucide-react";
import { Field, Input, Select, ToggleRow } from "@/components/forms/Fields";
import { Button, Chip, PageTitle } from "@/components/ui/primitives";
import { useLocalHref } from "@/components/i18n/LocaleContext";
import { SafetyNote, SignInGate, SuggestionBadge, useMoney, useOpsPost } from "@/components/ops/shared";
import { GENRES } from "@/lib/data";
import { CITIES } from "@/lib/ops/geo";
import { budgetSplit, CATALOG, CATALOG_BY_KEY, levelFor, OWNABLE_KEYS, quantities, SERVICE_KEYS, TEMPLATES, TEMPLATE_BY_ID } from "@/lib/ops/planner";
import { zonedToIso } from "@/lib/ops/time";
import { SCALE_LEVELS, type OpsEvent, type ReqCategory, type ScaleLevel, type Setting, type TemplateId } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

const CATS: ReqCategory[] = ["sound", "lighting_video", "dj", "venue", "staff", "safety"];
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export function PlanForm() {
  const t = useTranslations("ops");
  return (
    <div className="mx-auto max-w-6xl pb-16 md:px-6">
      <PageTitle kicker={t("manageKicker")} title={t("newTitle")} sub={t("newSub")} />
      <div className="px-4 md:px-0">
        <SignInGate returnTo="/events/manage/new">
          <Form />
        </SignInGate>
      </div>
    </div>
  );
}

function Form() {
  const t = useTranslations("ops");
  const router = useRouter();
  const href = useLocalHref();
  const post = useOpsPost();
  const money = useMoney();
  const [tpl, setTpl] = useState<TemplateId>("club_night");
  const [name, setName] = useState("");
  const [city, setCity] = useState("Bangkok");
  const [venueName, setVenue] = useState("");
  const [setting, setSetting] = useState<Setting>("indoor");
  const [date, setDate] = useState(inDays(45));
  const [time, setTime] = useState("22:00");
  const [hours, setHours] = useState(7);
  const [attendance, setAttendance] = useState(250);
  const [override, setOverride] = useState<ScaleLevel | null>(null);
  const [budget, setBudget] = useState(20000);
  const [genres, setGenres] = useState<string[]>(["Techno"]);
  const [djs, setDjs] = useState(true);
  const [ticketing, setTicketing] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [owned, setOwned] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const auto = levelFor(attendance);
  const level = override ?? auto;
  const pickTemplate = (id: TemplateId) => {
    const x = TEMPLATE_BY_ID.get(id)!;
    setTpl(id);
    setSetting(x.setting);
    setAttendance(x.attendance);
    setHours(x.hours);
    setOverride(null);
    setStreaming(id === "mega_festival" || id === "outdoor_festival");
    setBudget(Math.max(1500, Math.round((x.attendance * (x.attendance > 1000 ? 110 : 70)) / 500) * 500));
  };
  const toggle = (list: string[], set: (v: string[]) => void, k: string) => set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);

  const plan = useMemo(() => {
    const q = quantities({ attendance, setting, djs, streaming, ticketing, templateId: tpl, ownedEquipment: owned, venueFacilities: facilities, services, level });
    return CATALOG.filter((c) => (q[c.key] ?? 0) > 0).map((c) => ({ ...c, quantity: q[c.key], covered: owned.includes(c.key) ? "owner" : facilities.includes(c.key) ? "venue" : null }));
  }, [attendance, setting, djs, streaming, ticketing, tpl, owned, facilities, services, level]);
  const split = budgetSplit(budget, level, djs);
  const tz = CITIES.find((c) => c.name === city)?.tz ?? "UTC";

  const submit = async () => {
    setErr(null);
    if (name.trim().length < 2) return setErr(t("errName"));
    if (!date || !time || hours < 1) return setErr(t("errTimes"));
    setBusy(true);
    const startAt = zonedToIso(date, time, tz);
    const endAt = new Date(Date.parse(startAt) + hours * 3_600_000).toISOString();
    const res = await post<{ event: OpsEvent }>("events", {
      name: name.trim(), city, venueName: venueName.trim(), setting, startAt, endAt, genres, attendance, budgetUsd: budget, ticketing, djs, streaming,
      templateId: tpl, ownedEquipment: owned, venueFacilities: facilities, services, levelOverride: override,
    });
    setBusy(false);
    if (res) router.push(href(`/events/manage/${res.event.id}`));
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        <section aria-labelledby="tpl-h">
          <h2 id="tpl-h" className="mb-2 text-lg uppercase">{t("templates")}</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" data-testid="templates">
            {TEMPLATES.map((x) => (
              <Chip key={x.id} active={tpl === x.id} onClick={() => pickTemplate(x.id)} data-testid={`tpl-${x.id}`}>
                {t(`tpl.${x.id}`)}
              </Chip>
            ))}
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ev-name" label={t("fName")}>
            <Input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} data-testid="ev-name" />
          </Field>
          <Field id="ev-city" label={t("fCity")} hint={t("fCityHint")}>
            <Select id="ev-city" value={city} onChange={(e) => setCity(e.target.value)} data-testid="ev-city">
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} · {c.country}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="ev-venue" label={t("fVenue")} optional>
            <Input id="ev-venue" value={venueName} onChange={(e) => setVenue(e.target.value)} maxLength={80} />
          </Field>
          <div className="space-y-1.5">
            <span className="text-sm font-bold">{t("fSetting")}</span>
            <div className="flex flex-wrap gap-2">
              {(["indoor", "outdoor", "mixed"] as Setting[]).map((s) => (
                <Chip key={s} active={setting === s} onClick={() => setSetting(s)}>
                  {t(`setting.${s}`)}
                </Chip>
              ))}
            </div>
          </div>
          <Field id="ev-date" label={t("fDate")} hint={t("fDateHint", { tz })}>
            <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="ev-date" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="ev-time" label={t("fStart")}>
              <Input id="ev-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field id="ev-hours" label={t("fHours")}>
              <Input id="ev-hours" type="number" min={1} max={168} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
            </Field>
          </div>
          <Field id="ev-att" label={t("fAttendance")}>
            <Input id="ev-att" type="number" min={1} max={500000} value={attendance} onChange={(e) => setAttendance(Math.max(1, Number(e.target.value) || 1))} data-testid="ev-attendance" />
          </Field>
          <Field id="ev-level" label={t("fLevel")} hint={t("fLevelHint", { level: auto, name: t(`level.${SCALE_LEVELS[auto - 1].key}`) })}>
            <Select id="ev-level" value={override ?? ""} onChange={(e) => setOverride(e.target.value ? (Number(e.target.value) as ScaleLevel) : null)} data-testid="ev-level">
              <option value="">{t("levelAuto")}</option>
              {SCALE_LEVELS.map((l) => (
                <option key={l.level} value={l.level}>
                  L{l.level} · {t(`level.${l.key}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="ev-budget" label={t("fBudget")}>
            <Input id="ev-budget" type="number" min={0} step={100} value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} data-testid="ev-budget" />
          </Field>
        </div>

        <section aria-labelledby="g-h">
          <h2 id="g-h" className="mb-2 text-lg uppercase">{t("fGenres")}</h2>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <Chip key={g} active={genres.includes(g)} onClick={() => toggle(genres, setGenres, g)}>
                {g}
              </Chip>
            ))}
          </div>
        </section>

        <div className="grid gap-2 sm:grid-cols-3">
          <ToggleRow checked={djs} onChange={setDjs} label={t("fDjs")} />
          <ToggleRow checked={ticketing} onChange={setTicketing} label={t("fTicketing")} />
          <ToggleRow checked={streaming} onChange={setStreaming} label={t("fStreaming")} />
        </div>

        <KeyPicker title={t("fOwned")} hint={t("fOwnedHint")} keys={OWNABLE_KEYS} value={owned} onToggle={(k) => toggle(owned, setOwned, k)} testid="owned" />
        <KeyPicker title={t("fFacilities")} hint={t("fFacilitiesHint")} keys={OWNABLE_KEYS} value={facilities} onToggle={(k) => toggle(facilities, setFacilities, k)} testid="facilities" />
        <KeyPicker title={t("fServices")} hint={t("fServicesHint")} keys={SERVICE_KEYS.filter((k) => !plan.some((p) => p.key === k))} value={services} onToggle={(k) => toggle(services, setServices, k)} testid="services" />

        {err && <p role="alert" className="font-semibold text-coral">{err}</p>}
        <Button size="lg" onClick={() => void submit()} disabled={busy} data-testid="create-plan" className="w-full sm:w-auto">
          <Rocket className="size-5" aria-hidden /> {t("createPlan")}
        </Button>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-labelledby="preview-h">
        <div className="rounded-3xl border border-purple/40 bg-surface/90 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="preview-h" className="text-xl uppercase">{t("preview")}</h2>
            <SuggestionBadge />
          </div>
          <p className="mt-1 text-xs text-mute">{t("previewSub")}</p>
          <div className="mt-3 rounded-2xl bg-surface-2 p-3" data-testid="preview-level">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mute">{t("sizeLevel")}</div>
            <div className="font-display text-2xl text-acid">
              L{level} · {t(`level.${SCALE_LEVELS[level - 1].key}`)}
            </div>
            {override && <div className="text-xs text-orange">{t("levelOverridden", { auto })}</div>}
          </div>
          <ul className="mt-3 space-y-3 text-sm" data-testid="preview-list">
            {CATS.map((c) => {
              const rows = plan.filter((p) => p.category === c);
              if (!rows.length) return null;
              return (
                <li key={c}>
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-mute">{t(`cat.${c}`)}</div>
                  <ul className="mt-1 space-y-0.5">
                    {rows.map((r) => (
                      <li key={r.key} className={cn("flex items-center justify-between gap-2", r.covered && "text-mute line-through decoration-acid")} data-key={r.key}>
                        <span className="flex min-w-0 items-center gap-1">
                          {r.safetyCritical && <ShieldAlert className="size-3.5 shrink-0 text-coral" aria-label={t("safetyCritical")} />}
                          <span className="truncate">{t(`req.${r.key}`)}</span>
                        </span>
                        <span className="shrink-0 font-bold tabular-nums">{r.covered ? t(`covered.${r.covered}`) : `×${r.quantity}`}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          <SafetyNote className="mt-3">{t("safetyDisclaimer")}</SafetyNote>
        </div>
        <div className="rounded-3xl border border-line bg-surface/90 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg uppercase">{t("budgetSplit")}</h3>
            <SuggestionBadge />
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(split).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2">
                <span>{t(`budget.${k}`)}</span>
                <span className="font-bold tabular-nums">{money(v)}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function KeyPicker({ title, hint, keys, value, onToggle, testid }: { title: string; hint: string; keys: string[]; value: string[]; onToggle: (k: string) => void; testid: string }) {
  const t = useTranslations("ops");
  return (
    <details className="group rounded-2xl border-2 border-line bg-surface p-3" data-testid={testid}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-bold">
        <span>
          {title} {value.length > 0 && <span className="text-acid">({value.length})</span>}
        </span>
        <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <p className="mb-2 text-xs text-mute">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {keys.map((k) => (
          <Chip key={k} active={value.includes(k)} onClick={() => onToggle(k)} className="min-h-9 px-3 text-xs" data-key={k}>
            {t(`req.${k}`)}
            {CATALOG_BY_KEY.get(k)?.safetyCritical ? " ⚠" : ""}
          </Chip>
        ))}
      </div>
    </details>
  );
}
