/**
 * Ticket QR check-in (server-only). A QR is `FKT1.<eventId>.<ticketId>.<sig>` where
 * sig = HMAC(secret, "FKT1|eventId|ticketId"). Verification is per event, rejects
 * re-use and cancelled tickets, and checks the entry window.
 * Demo check-ins are stored with demo=true and never count as production attendance.
 */
import { hmac, safeEqual } from "@/lib/dao/hash";
import type { CheckinError, CheckinRecord } from "./types";

export interface TicketRow {
  id: string;
  eventId: string;
  holder: string;
  kind: "main" | "afterparty" | "allnight" | "vip";
  status: "valid" | "cancelled" | "refunded";
  demo: boolean;
}

export const qrFor = (secret: string, eventId: string, ticketId: string) => `FKT1.${eventId}.${ticketId}.${hmac(secret, `FKT1|${eventId}|${ticketId}`).slice(0, 22)}`;

export function parseQr(qr: string): { eventId: string; ticketId: string; sig: string } | null {
  const m = /^FKT1\.([a-z0-9-]{2,60})\.([A-Za-z0-9_-]{4,60})\.([A-Za-z0-9_-]{22})$/.exec(qr.trim());
  return m ? { eventId: m[1], ticketId: m[2], sig: m[3] } : null;
}

export function verifyCheckin(
  input: { qr: string; eventId: string; now: number; entryOpensAt: number; entryClosesAt: number; method: CheckinRecord["method"]; by: string; demo: boolean },
  secret: string,
  tickets: Map<string, TicketRow>,
  checkins: CheckinRecord[],
): { ok: true; record: CheckinRecord; ticket: TicketRow } | { ok: false; code: CheckinError } {
  const q = parseQr(input.qr);
  if (!q) return { ok: false, code: "QR_MALFORMED" };
  const expect = hmac(secret, `FKT1|${q.eventId}|${q.ticketId}`).slice(0, 22);
  if (!safeEqual(expect, q.sig)) return { ok: false, code: "QR_SIGNATURE_INVALID" };
  if (q.eventId !== input.eventId) return { ok: false, code: "WRONG_EVENT" };
  const t = tickets.get(q.ticketId);
  if (!t || t.eventId !== input.eventId) return { ok: false, code: "TICKET_NOT_FOUND" };
  if (t.status !== "valid") return { ok: false, code: "TICKET_CANCELLED" };
  if (checkins.some((c) => c.ticketId === t.id && c.eventId === input.eventId)) return { ok: false, code: "TICKET_ALREADY_USED" };
  if (input.now < input.entryOpensAt || input.now > input.entryClosesAt) return { ok: false, code: "NOT_ENTRY_TIME" };
  return { ok: true, ticket: t, record: { ticketId: t.id, eventId: input.eventId, at: input.now, method: input.method, by: input.by, demo: input.demo || t.demo } };
}

export const CHECKIN_ERROR_TEXT: Record<CheckinError, string> = {
  QR_MALFORMED: "This is not a FREAKTOPIA ticket code.",
  QR_SIGNATURE_INVALID: "The code was altered or forged.",
  WRONG_EVENT: "This ticket is for a different event.",
  TICKET_NOT_FOUND: "No ticket with this code exists for this event.",
  TICKET_CANCELLED: "This ticket was cancelled or refunded.",
  TICKET_ALREADY_USED: "This ticket was already used to enter.",
  NOT_ENTRY_TIME: "Entry is not open for this event right now.",
  NOT_AUTHORIZED: "Only door staff can scan or verify guests.",
};

/** Attendance figures, never mixed: sold ≠ checked in ≠ present ≠ online. */
export function attendance(tickets: TicketRow[], checkins: CheckinRecord[], exits: { ticketId: string; at: number }[], eventId: string, includeDemo: boolean) {
  const sold = tickets.filter((t) => t.eventId === eventId && t.status === "valid" && (includeDemo || !t.demo)).length;
  const ins = checkins.filter((c) => c.eventId === eventId && (includeDemo || !c.demo));
  const unique = new Set(ins.map((c) => c.ticketId));
  const left = new Set(exits.filter((x) => unique.has(x.ticketId)).map((x) => x.ticketId));
  return { ticketsSold: sold, checkedIn: unique.size, currentlyPresent: unique.size - left.size, presenceTracked: exits.length > 0 };
}
