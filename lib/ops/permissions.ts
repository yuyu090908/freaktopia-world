/**
 * Who may do what inside one event. Every API handler goes through `can`; the UI asks the same function
 * only to decide what to show. People who aren't members of an event get 404 for everything in it.
 *
 *   owner    – everything, including manager roles, safety approvals and contracts
 *   manager  – everything except changing the owner or managers
 *   lead     – their area: tasks, schedule, files; reads requirements and readiness (no money)
 *   staff    – team chat (general + own area), own tasks, schedule, team files, incident reports
 *   vendor   – like staff, plus their own bookings, agreements and equipment handovers
 */
import type { Area, DocAudience, EventMember, MemberRole } from "./types";

export type OpsAction =
  | "read_event" | "edit_event" | "delete_event" | "manage_members" | "manage_managers"
  | "read_requirements" | "edit_requirements" | "recruit" | "read_applications" | "decide_applications"
  | "read_budget" | "edit_budget" | "record_payment" | "sign_agreement"
  | "approve_safety" | "confirm_expert" | "report_incident" | "manage_incidents"
  | "edit_schedule" | "read_all_threads" | "manage_all_tasks" | "upload_documents" | "record_handover";

const ALL: Record<MemberRole, OpsAction[]> = {
  owner: ["read_event", "edit_event", "delete_event", "manage_members", "manage_managers", "read_requirements", "edit_requirements", "recruit", "read_applications", "decide_applications", "read_budget", "edit_budget", "record_payment", "sign_agreement", "approve_safety", "confirm_expert", "report_incident", "manage_incidents", "edit_schedule", "read_all_threads", "manage_all_tasks", "upload_documents", "record_handover"],
  manager: ["read_event", "edit_event", "manage_members", "read_requirements", "edit_requirements", "recruit", "read_applications", "decide_applications", "read_budget", "edit_budget", "record_payment", "sign_agreement", "approve_safety", "confirm_expert", "report_incident", "manage_incidents", "edit_schedule", "read_all_threads", "manage_all_tasks", "upload_documents", "record_handover"],
  lead: ["read_event", "read_requirements", "report_incident", "edit_schedule", "read_all_threads", "upload_documents", "record_handover"],
  staff: ["read_event", "report_incident", "upload_documents"],
  vendor: ["read_event", "report_incident", "upload_documents", "record_handover"],
};

export function can(m: Pick<EventMember, "role"> | null, action: OpsAction) {
  return !!m && ALL[m.role].includes(action);
}

export function canReadThread(m: Pick<EventMember, "role" | "area"> | null, thread: Area) {
  if (!m) return false;
  if (can(m, "read_all_threads")) return true;
  return thread === "general" || thread === m.area;
}

export function canEditTask(m: Pick<EventMember, "role" | "area" | "userId"> | null, task: { area: Area; assigneeId: string | null }) {
  if (!m) return false;
  if (can(m, "manage_all_tasks")) return true;
  if (m.role === "lead" && task.area === m.area) return true;
  return task.assigneeId === m.userId; // staff and vendors: status of their own tasks only
}

export function canOpenDocument(m: Pick<EventMember, "role"> | null, audience: DocAudience) {
  if (!m) return false;
  if (audience === "team") return true;
  if (audience === "leads") return ["owner", "manager", "lead"].includes(m.role);
  return ["owner", "manager"].includes(m.role);
}

export const ROLE_ORDER: MemberRole[] = ["owner", "manager", "lead", "staff", "vendor"];
