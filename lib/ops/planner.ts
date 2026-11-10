/**
 * Event planner: turns an event description into requirements, a first budget split, task and schedule templates.
 *
 * This is a rule-based engine (deterministic, explainable, testable). No AI model is connected in this build;
 * the UI calls it the "auto planner" and labels every output as a suggestion. Quantities are rough planning
 * guides only: anything safety-relevant (power, rigging, barriers, security headcount, medics, evacuation)
 * is flagged so a qualified professional or the local authority must confirm the final spec.
 */
import type { Area, BudgetCategory, OpsEvent, ReqCategory, ReqKind, Requirement, ScaleLevel, ScheduleKind, Setting, TemplateId } from "./types";
import { SCALE_LEVELS } from "./types";

export interface CatalogEntry {
  key: string;
  category: ReqCategory;
  kind: ReqKind;
  unit: Requirement["unit"];
  safetyCritical?: boolean;
  credential?: string;
  area: Area;
  budget: BudgetCategory;
}

const E = (key: string, category: ReqCategory, kind: ReqKind, unit: Requirement["unit"], area: Area, budget: BudgetCategory, extra: Partial<CatalogEntry> = {}): CatalogEntry => ({ key, category, kind, unit, area, budget, ...extra });

/** Every requirement the planner knows. Keys are stable ids, translated as ops.req.<key>. */
export const CATALOG: CatalogEntry[] = [
  // sound
  E("main_pa", "sound", "equipment", "set", "sound", "sound"),
  E("subwoofers", "sound", "equipment", "unit", "sound", "sound"),
  E("monitor_speakers", "sound", "equipment", "unit", "sound", "sound"),
  E("digital_mixer", "sound", "equipment", "unit", "sound", "sound"),
  E("mics_di", "sound", "equipment", "set", "sound", "sound"),
  E("audio_cabling", "sound", "equipment", "set", "sound", "sound"),
  E("sound_engineer", "sound", "crew", "person", "sound", "sound"),
  E("system_engineer", "sound", "crew", "person", "sound", "sound"),
  // lighting and video
  E("stage_lighting", "lighting_video", "equipment", "set", "lighting", "lighting_video"),
  E("moving_lights", "lighting_video", "equipment", "unit", "lighting", "lighting_video"),
  E("led_screen", "lighting_video", "equipment", "unit", "lighting", "lighting_video"),
  E("lighting_controller", "lighting_video", "equipment", "unit", "lighting", "lighting_video"),
  E("lighting_operator", "lighting_video", "crew", "person", "lighting", "lighting_video"),
  E("vj_video", "lighting_video", "crew", "person", "lighting", "lighting_video"),
  E("streaming_crew", "lighting_video", "service", "person", "lighting", "lighting_video"),
  E("photographer", "lighting_video", "service", "person", "operations", "marketing"),
  // DJ
  E("cdj", "dj", "equipment", "unit", "dj", "sound"),
  E("dj_mixer", "dj", "equipment", "unit", "dj", "sound"),
  E("dj_monitors", "dj", "equipment", "unit", "dj", "sound"),
  E("dj_booth", "dj", "equipment", "unit", "dj", "decor_facilities"),
  E("backup_dj_gear", "dj", "equipment", "set", "dj", "sound"),
  E("dj_performer", "dj", "crew", "person", "dj", "artists"),
  // venue and facilities
  E("venue_hire", "venue", "service", "item", "operations", "venue"),
  E("stage", "venue", "equipment", "unit", "operations", "decor_facilities", { safetyCritical: true, credential: "rigging_cert" }),
  E("truss", "venue", "equipment", "set", "operations", "decor_facilities", { safetyCritical: true, credential: "rigging_cert" }),
  E("power_generator", "venue", "equipment", "unit", "operations", "decor_facilities", { safetyCritical: true, credential: "electrician_license" }),
  E("barricades", "venue", "equipment", "unit", "safety", "staff_security", { safetyCritical: true }),
  E("tents", "venue", "equipment", "unit", "operations", "decor_facilities", { safetyCritical: true }),
  E("decoration", "venue", "service", "set", "operations", "decor_facilities"),
  E("toilets", "venue", "equipment", "unit", "operations", "decor_facilities"),
  E("waste", "venue", "service", "set", "operations", "decor_facilities"),
  E("signage", "venue", "equipment", "set", "operations", "decor_facilities"),
  E("catering", "venue", "service", "set", "operations", "decor_facilities"),
  // staff
  E("event_director", "staff", "crew", "person", "operations", "staff_security"),
  E("stage_manager", "staff", "crew", "person", "operations", "staff_security"),
  E("security_staff", "staff", "crew", "person", "safety", "staff_security", { safetyCritical: true, credential: "security_license" }),
  E("reception_staff", "staff", "crew", "person", "operations", "staff_security"),
  E("cleaning_staff", "staff", "crew", "person", "operations", "staff_security"),
  E("medic", "staff", "crew", "person", "safety", "staff_security", { safetyCritical: true, credential: "first_aid" }),
  E("load_crew", "staff", "crew", "person", "operations", "staff_security"),
  // safety and permits
  E("venue_permit", "safety", "permit", "item", "safety", "safety_permits", { safetyCritical: true }),
  E("event_noise_permit", "safety", "permit", "item", "safety", "safety_permits", { safetyCritical: true }),
  E("fire_evacuation_plan", "safety", "permit", "item", "safety", "safety_permits", { safetyCritical: true }),
  E("weather_plan", "safety", "permit", "item", "safety", "safety_permits", { safetyCritical: true }),
  E("liability_insurance", "safety", "permit", "item", "safety", "safety_permits", { safetyCritical: true }),
  E("emergency_contacts_plan", "safety", "permit", "item", "safety", "safety_permits", { safetyCritical: true }),
];
export const CATALOG_BY_KEY = new Map(CATALOG.map((c) => [c.key, c]));
export const REQ_KEYS = CATALOG.map((c) => c.key);
/** Gear an organizer can already own or a venue can have installed. */
export const OWNABLE_KEYS = CATALOG.filter((c) => c.kind === "equipment").map((c) => c.key);
export const SERVICE_KEYS = CATALOG.filter((c) => c.kind !== "permit").map((c) => c.key);
export const CREDENTIALS = ["security_license", "electrician_license", "rigging_cert", "first_aid"] as const;

// ------------------------------------------------------------------ size

export function levelFor(attendance: number): ScaleLevel {
  const n = Math.max(0, Math.floor(attendance));
  return SCALE_LEVELS.find((l) => n <= l.max)!.level;
}

// ------------------------------------------------------------------ templates

export interface Template {
  id: TemplateId;
  setting: Setting;
  attendance: number;
  hours: number;
  /** Extra requirement keys this kind of event always needs. */
  extra: string[];
}
export const TEMPLATES: Template[] = [
  { id: "private_party", setting: "indoor", attendance: 25, hours: 5, extra: [] },
  { id: "club_night", setting: "indoor", attendance: 250, hours: 7, extra: ["signage"] },
  { id: "rooftop_party", setting: "outdoor", attendance: 120, hours: 6, extra: ["weather_plan", "venue_permit"] },
  { id: "beach_party", setting: "outdoor", attendance: 400, hours: 8, extra: ["weather_plan", "tents", "waste"] },
  { id: "warehouse_rave", setting: "indoor", attendance: 800, hours: 10, extra: ["fire_evacuation_plan", "power_generator"] },
  { id: "outdoor_festival", setting: "outdoor", attendance: 2000, hours: 12, extra: ["weather_plan", "barricades"] },
  { id: "mega_festival", setting: "outdoor", attendance: 10000, hours: 14, extra: ["weather_plan", "barricades", "led_screen"] },
];
export const TEMPLATE_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

// ------------------------------------------------------------------ requirement rules

type PlanInput = Pick<OpsEvent, "attendance" | "setting" | "djs" | "streaming" | "ticketing" | "templateId" | "ownedEquipment" | "venueFacilities" | "services"> & { level: ScaleLevel };

const up = (n: number) => Math.ceil(n);

/** Quantity per requirement key, 0 = not needed. Pure function of the event description. */
export function quantities(e: PlanInput): Record<string, number> {
  const A = Math.max(1, e.attendance);
  const L = e.level;
  const out = e.setting !== "indoor";
  const stages = L >= 6 ? 3 : L >= 5 ? 2 : 1;
  const q: Record<string, number> = {
    main_pa: L === 1 ? 1 : Math.max(1, up(A / 1000)),
    subwoofers: L <= 2 ? 2 : Math.min(48, Math.max(4, up(A / 150))),
    monitor_speakers: L >= 2 ? 2 + (L >= 4 ? 2 : 0) * stages : 0,
    digital_mixer: L >= 2 ? stages : 0,
    mics_di: L >= 3 ? stages : 0,
    audio_cabling: L >= 2 ? stages : 0,
    sound_engineer: L >= 2 ? stages : 0,
    system_engineer: L >= 4 ? 1 : 0,
    stage_lighting: 1,
    moving_lights: L >= 3 ? [0, 0, 0, 4, 8, 12, 24][L] : 0,
    led_screen: L >= 6 ? 3 : L >= 4 ? 1 : 0,
    lighting_controller: L >= 3 ? stages : 0,
    lighting_operator: L >= 3 ? stages : 0,
    vj_video: L >= 4 || e.streaming ? 1 : 0,
    streaming_crew: e.streaming ? (L >= 5 ? 2 : 1) : 0,
    photographer: L >= 5 ? 2 : L >= 3 ? 1 : 0,
    cdj: e.djs ? 2 * stages : 0,
    dj_mixer: e.djs ? stages : 0,
    dj_monitors: e.djs ? 2 * stages : 0,
    dj_booth: e.djs ? stages : 0,
    backup_dj_gear: e.djs && L >= 3 ? 1 : 0,
    dj_performer: e.djs ? [0, 1, 2, 3, 5, 8, 15][L] : 0,
    venue_hire: 1,
    stage: L >= 3 || (out && L >= 2) ? stages : 0,
    truss: L >= 4 || (out && L >= 3) ? stages : 0,
    power_generator: out && L >= 2 ? Math.max(1, up(A / 2000)) : L >= 5 ? 1 : 0,
    barricades: L >= 4 ? up(A / 250) : 0,
    tents: out ? (L <= 2 ? 1 : L === 3 ? 2 : up(A / 500)) : 0,
    decoration: 1,
    // Rough planning guide only; sanitary requirements are set by local rules.
    toilets: out ? Math.max(1, up(A / 75)) : 0,
    waste: L >= 3 || out ? 1 : 0,
    signage: L >= 3 ? 1 : 0,
    catering: L >= 5 ? 1 : 0,
    event_director: L >= 4 ? 1 : 0,
    stage_manager: L >= 3 ? stages : 0,
    // Rough planning guide only; the security plan and headcount must be set with the security provider / authority.
    security_staff: L === 1 ? 0 : L === 2 ? (out ? 2 : 1) : Math.max(2, up(A / (out ? 75 : 100))),
    reception_staff: e.ticketing && L >= 2 ? Math.max(1, up(A / 250)) : 0,
    cleaning_staff: L >= 3 ? Math.max(1, up(A / 500)) : 0,
    medic: L >= 3 ? Math.max(1, up(A / 1000)) : 0,
    load_crew: L >= 3 ? 2 + L : 0,
    venue_permit: L >= 2 || out ? 1 : 0,
    event_noise_permit: out || L >= 4 ? 1 : 0,
    fire_evacuation_plan: L >= 3 ? 1 : 0,
    weather_plan: out ? 1 : 0,
    liability_insurance: L >= 2 ? 1 : 0,
    emergency_contacts_plan: 1,
  };
  const tpl = TEMPLATE_BY_ID.get(e.templateId);
  for (const k of [...(tpl?.extra ?? []), ...e.services]) if (CATALOG_BY_KEY.has(k)) q[k] = Math.max(q[k] ?? 0, 1);
  return q;
}

/** The full requirement list for an event (new ids). Owned gear and venue facilities are marked covered. */
export function planRequirements(e: OpsEvent & { level: ScaleLevel }, newId: () => string): Requirement[] {
  const q = quantities(e);
  const tplExtra = new Set(TEMPLATE_BY_ID.get(e.templateId)?.extra ?? []);
  const asked = new Set(e.services);
  const out: Requirement[] = [];
  for (const c of CATALOG) {
    const n = q[c.key] ?? 0;
    if (n <= 0) continue;
    const coveredBy = e.ownedEquipment.includes(c.key) ? "owner" : e.venueFacilities.includes(c.key) ? "venue" : null;
    out.push({
      id: newId(),
      eventId: e.id,
      key: c.key,
      category: c.category,
      kind: c.kind,
      quantity: n,
      unit: c.unit,
      safetyCritical: Boolean(c.safetyCritical),
      credential: c.credential ?? null,
      source: asked.has(c.key) ? "organizer" : tplExtra.has(c.key) ? "template" : "planner",
      status: coveredBy ? "covered" : "needed",
      coveredBy,
      note: "",
      expertConfirmation: null,
    });
  }
  return out;
}

// ------------------------------------------------------------------ budget split

export const BUDGET_CATEGORIES: BudgetCategory[] = ["venue", "sound", "lighting_video", "artists", "staff_security", "decor_facilities", "marketing", "safety_permits", "contingency"];

/**
 * First split of the total budget (percent). The base matches the example split
 * (venue 20, sound 16, lighting 12, artists 16, staff 12, decor 8, marketing 6, contingency 10);
 * larger events move part of the contingency into permits and safety, which never drops below 5 %.
 */
export function budgetSplit(totalUsd: number, level: ScaleLevel, djs: boolean): Record<BudgetCategory, number> {
  const pct: Record<BudgetCategory, number> = { venue: 20, sound: 16, lighting_video: 12, artists: 16, staff_security: 12, decor_facilities: 8, marketing: 6, safety_permits: 0, contingency: 10 };
  pct.safety_permits = [0, 1, 1, 2, 3, 4, 5][level];
  pct.contingency = Math.max(5, pct.contingency - pct.safety_permits);
  if (!djs) {
    pct.sound += 6;
    pct.lighting_video += 4;
    pct.venue += 6;
    pct.artists = 0;
  }
  const sum = Object.values(pct).reduce((a, b) => a + b, 0);
  const out = {} as Record<BudgetCategory, number>;
  let used = 0;
  BUDGET_CATEGORIES.forEach((c, i) => {
    const v = i === BUDGET_CATEGORIES.length - 1 ? Math.max(0, Math.round(totalUsd) - used) : Math.round((totalUsd * pct[c]) / sum);
    out[c] = v;
    used += v;
  });
  return out;
}

// ------------------------------------------------------------------ tasks and schedule templates

export interface TaskTemplate {
  key: string;
  area: Area;
  daysBefore: number;
  when: (e: PlanInput) => boolean;
  requirementKey?: string;
}
export const TASK_TEMPLATES: TaskTemplate[] = [
  { key: "book_venue", area: "operations", daysBefore: 60, when: () => true, requirementKey: "venue_hire" },
  { key: "venue_layout", area: "operations", daysBefore: 30, when: (e) => e.level >= 2 },
  { key: "confirm_sound", area: "sound", daysBefore: 30, when: () => true, requirementKey: "main_pa" },
  { key: "confirm_lighting", area: "lighting", daysBefore: 30, when: (e) => e.level >= 2, requirementKey: "stage_lighting" },
  { key: "dj_contracts", area: "dj", daysBefore: 21, when: (e) => e.djs, requirementKey: "dj_performer" },
  { key: "ticket_setup", area: "operations", daysBefore: 45, when: (e) => e.ticketing },
  { key: "promo_plan", area: "operations", daysBefore: 30, when: (e) => e.level >= 2 },
  { key: "power_check", area: "operations", daysBefore: 7, when: (e) => e.setting !== "indoor" || e.level >= 4, requirementKey: "power_generator" },
  { key: "safety_plan", area: "safety", daysBefore: 30, when: (e) => e.level >= 3, requirementKey: "fire_evacuation_plan" },
  { key: "permits", area: "safety", daysBefore: 45, when: (e) => e.level >= 2 || e.setting !== "indoor", requirementKey: "venue_permit" },
  { key: "insurance", area: "safety", daysBefore: 14, when: (e) => e.level >= 2, requirementKey: "liability_insurance" },
  { key: "emergency_contacts", area: "safety", daysBefore: 7, when: () => true, requirementKey: "emergency_contacts_plan" },
  { key: "weather_watch", area: "safety", daysBefore: 2, when: (e) => e.setting !== "indoor", requirementKey: "weather_plan" },
  { key: "lighting_test", area: "lighting", daysBefore: 1, when: (e) => e.level >= 3 },
  { key: "staff_briefing", area: "general", daysBefore: 1, when: (e) => e.level >= 3 },
  { key: "stream_test", area: "lighting", daysBefore: 2, when: (e) => e.streaming, requirementKey: "streaming_crew" },
];

export function scheduleTemplate(e: Pick<OpsEvent, "startAt" | "endAt"> & { level: ScaleLevel }): { kind: ScheduleKind; startAt: string; endAt: string }[] {
  const s = Date.parse(e.startAt);
  const end = Date.parse(e.endAt);
  const h = 3_600_000;
  const loadIn = e.level >= 4 ? 24 * h : e.level >= 2 ? 8 * h : 3 * h;
  const iso = (t: number) => new Date(t).toISOString();
  return [
    { kind: "load_in", startAt: iso(s - loadIn), endAt: iso(s - loadIn + 2 * h) },
    { kind: "setup", startAt: iso(s - loadIn + 2 * h), endAt: iso(s - 3 * h) },
    { kind: "soundcheck", startAt: iso(s - 3 * h), endAt: iso(s - 1.5 * h) },
    { kind: "rehearsal", startAt: iso(s - 1.5 * h), endAt: iso(s - 0.5 * h) },
    { kind: "doors", startAt: iso(s), endAt: iso(s) },
    { kind: "show_start", startAt: iso(s + 0.5 * h), endAt: iso(s + 0.5 * h) },
    { kind: "show_end", startAt: iso(end), endAt: iso(end) },
    { kind: "load_out", startAt: iso(end + 0.5 * h), endAt: iso(end + (e.level >= 4 ? 8 : 3) * h) },
  ];
}
