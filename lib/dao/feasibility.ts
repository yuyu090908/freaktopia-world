/**
 * Feasibility pre-check for proposals (mandatory before a stage design is adopted).
 * ADVISORY ONLY: real approval comes from the organizer, the venue manager and a
 * specialist contractor, recorded as sign-offs on the report.
 */
import { heightNeedM, powerDrawKw } from "./stage";
import type { ConceptSpec, FeasibilityCheckResult, FeasibilityReport, VenueSpec } from "./types";

export interface FeasibilityInput {
  venue: VenueSpec;
  spec?: ConceptSpec; // stage design, when the proposal has one
  estimatedCost: number;
  expectedAttendance: number;
  eventStartsAt: number;
  now: number;
  permits: { name: string; status: "granted" | "pending" | "not_applied" }[];
  suppliers: { item: string; confirmed: boolean }[];
  installDaysNeeded?: number;
}

export function runFeasibility(i: FeasibilityInput): FeasibilityReport {
  const v = i.venue;
  const s = i.spec;
  const out: FeasibilityCheckResult[] = [];
  const push = (r: FeasibilityCheckResult) => out.push(r);

  // Budget
  if (i.estimatedCost <= v.budgetUsd * 0.85) push({ item: "budget", status: "pass", reason: `Estimate ${Math.round(i.estimatedCost)} USD is within the ${v.budgetUsd} USD production budget.` });
  else if (i.estimatedCost <= v.budgetUsd) push({ item: "budget", status: "warn", reason: "Estimate uses more than 85% of the budget, leaving little contingency.", alternative: "Drop side LED columns or lasers to keep a 15% buffer." });
  else push({ item: "budget", status: "fail", reason: `Estimate exceeds the budget by ${Math.round(i.estimatedCost - v.budgetUsd)} USD.`, alternative: "Ask the designer for a budget version (fewer screens, smaller sculptures) or raise sponsor funding first." });

  // Capacity
  if (i.expectedAttendance <= v.capacity) push({ item: "capacity", status: "pass", reason: `${i.expectedAttendance} expected guests fit the licensed capacity of ${v.capacity}.` });
  else push({ item: "capacity", status: "fail", reason: `Expected attendance ${i.expectedAttendance} exceeds licensed capacity ${v.capacity}.`, alternative: "Cap ticket sales at the licensed capacity or add a second room." });
  if (s && s.layout === "wide" && v.stageWidthM < 8) out[out.length - 1] = { item: "capacity", status: "warn", reason: "A wide layout on a narrow stage reduces floor space and sight lines.", alternative: "Use the centre layout." };

  // Structural
  if (s) {
    const need = heightNeedM(s);
    if (v.ceilingHeightM && need > v.ceilingHeightM - 0.5) push({ item: "structural", status: "fail", reason: `Tallest element needs ~${need} m; ceiling is ${v.ceilingHeightM} m (0.5 m clearance required).`, alternative: "Reduce sculpture scale or use the wide layout instead of a tower." });
    else push({ item: "structural", status: "needs_human", reason: `Fits height (${need} m of ${v.ceilingHeightM || "open-air"} m). Rigging loads must be certified by a structural engineer.` });
  } else push({ item: "structural", status: "pass", reason: "No structural build in this proposal." });

  // Electrical
  if (s) {
    const kw = powerDrawKw(s);
    if (kw > v.powerKw) push({ item: "electrical", status: "fail", reason: `Production draws ~${kw} kW; venue supply is ${v.powerKw} kW.`, alternative: "Hire a generator with a licensed electrician or remove LED screens." });
    else if (kw > v.powerKw * 0.8) push({ item: "electrical", status: "warn", reason: `Production draws ~${kw} kW, over 80% of the ${v.powerKw} kW supply.`, alternative: "Split lighting and sound onto separate circuits." });
    else push({ item: "electrical", status: "pass", reason: `~${kw} kW of ${v.powerKw} kW available.` });
  } else push({ item: "electrical", status: "pass", reason: "No additional power needed." });

  // Fire
  const noHaze = v.safetyRestrictions.some((r) => /haze|smoke|スモーク/i.test(r));
  const noFlame = v.safetyRestrictions.some((r) => /flame|pyro|fire|火/i.test(r));
  if (s?.pyroFx && (noFlame || v.setting === "indoor")) push({ item: "fire", status: "fail", reason: "Flame/CO2 effects are not allowed at this venue.", alternative: "Replace with cold-spark-free LED flame effects." });
  else if (s && s.haze > 0 && noHaze) push({ item: "fire", status: "fail", reason: "Haze triggers the venue's smoke detection restriction.", alternative: "Remove haze; use beam-friendly low-fog only with venue sign-off." });
  else push({ item: "fire", status: "needs_human", reason: "Fire-retardant certificates for scenic materials must be checked by the venue." });

  // Exits
  if (s && s.layout === "wide" && v.stageWidthM >= v.capacity / 120) push({ item: "exits", status: "warn", reason: "A wide stage may narrow side exit routes.", alternative: "Keep 1.2 m clear on both sides of the stage." });
  else push({ item: "exits", status: "needs_human", reason: "Emergency exit routes must be confirmed against the venue's evacuation plan." });

  // Sound
  const limit = v.safetyRestrictions.map((r) => /(\d{2,3})\s*dB/i.exec(r)?.[1]).find(Boolean);
  push(limit ? { item: "sound", status: "warn", reason: `Venue sound limit ${limit} dB applies.`, alternative: "Add a limiter and an SPL monitor at front of house." } : { item: "sound", status: "pass", reason: "No sound restriction recorded." });

  // Permits
  const pending = i.permits.filter((p) => p.status !== "granted");
  push(pending.length ? { item: "permits", status: pending.some((p) => p.status === "not_applied") ? "fail" : "warn", reason: `${pending.map((p) => p.name).join(", ")} not granted yet.`, alternative: "Apply now; do not sell more tickets than the current permit allows." } : { item: "permits", status: "pass", reason: "All recorded permits granted." });

  // Suppliers
  const unconfirmed = i.suppliers.filter((x) => !x.confirmed);
  push(unconfirmed.length ? { item: "suppliers", status: "warn", reason: `Unconfirmed: ${unconfirmed.map((x) => x.item).join(", ")}.`, alternative: "Request written quotes and hold dates from two suppliers." } : { item: "suppliers", status: "pass", reason: "Suppliers confirmed." });

  // Schedule
  const daysLeft = (i.eventStartsAt - i.now) / 86_400_000;
  const need = i.installDaysNeeded ?? (s ? 2 + s.ledScreens * 0.5 + (s.alienCount ? 1 : 0) + (s.installation !== "none" ? 1 : 0) : 1) + 14; // incl. fabrication lead time
  if (daysLeft < need * 0.6) push({ item: "schedule", status: "fail", reason: `Only ${Math.max(0, Math.floor(daysLeft))} days left; ~${Math.ceil(need)} days of fabrication and install needed.`, alternative: "Use rental items only and drop custom sculptures." });
  else if (daysLeft < need) push({ item: "schedule", status: "warn", reason: `Tight: ${Math.floor(daysLeft)} days left for ~${Math.ceil(need)} days of work.`, alternative: "Lock the design this week." });
  else push({ item: "schedule", status: "pass", reason: `${Math.floor(daysLeft)} days until doors; ~${Math.ceil(need)} needed.` });

  const overall: FeasibilityReport["overall"] = out.some((c) => c.status === "fail") ? "not_feasible" : out.some((c) => c.status === "warn" || c.status === "needs_human") ? "conditional" : "feasible";
  return { at: i.now, checks: out, overall, advisoryOnly: true, signoffs: [] };
}
