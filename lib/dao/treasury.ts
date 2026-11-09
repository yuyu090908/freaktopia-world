/**
 * DAO treasury rules.
 * - Staking principal sits in a separate escrow account and is never spendable.
 * - Payments need approvals by distinct people with the required roles; the tier
 *   depends on the amount. The requester never counts as an approver.
 * - Real transfers (incl. USDT) stay disabled until legal review and a security audit
 *   are complete: DAO_PAYMENTS_ENABLED must be "true" AND a payment rail configured.
 */
import { DAO_RULES } from "./meta";
import type { BudgetItem, DaoRole, PaymentRequest, TreasuryAccount } from "./types";

export function tierFor(amount: number) {
  return DAO_RULES.approvalTiers.find((t) => amount < t.below)!;
}

export function summarize(accounts: TreasuryAccount[], items: BudgetItem[], payments: PaymentRequest[]) {
  const sum = (k: TreasuryAccount["kind"]) => accounts.filter((a) => a.kind === k).reduce((s, a) => s + a.balance, 0);
  const spent = payments.filter((p) => p.status === "executed_demo").reduce((s, p) => s + p.amount, 0);
  const approved = payments.filter((p) => p.status === "approved").reduce((s, p) => s + p.amount, 0);
  const pending = payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const eventBudget = sum("event_budget");
  const ticket = sum("ticket_revenue");
  const sponsor = sum("sponsors");
  const operating = eventBudget + ticket + sponsor;
  return {
    stakedTokens: sum("staking_escrow"),
    eventBudget,
    ticketRevenue: ticket,
    sponsorContributions: sponsor,
    allocated: items.reduce((s, b) => s + b.allocated, 0),
    approvedExpenses: spent + approved,
    pendingPayments: pending,
    remaining: operating - spent - approved,
  };
}

export type PaymentError = "STAKE_FUNDS_LOCKED" | "UNKNOWN_BUDGET_ITEM" | "OVER_BUDGET_ITEM" | "INSUFFICIENT_FUNDS" | "INVALID_AMOUNT";

export function validateRequest(
  amount: number,
  from: TreasuryAccount["kind"],
  budgetItemId: string,
  accounts: TreasuryAccount[],
  items: BudgetItem[],
  payments: PaymentRequest[],
): PaymentError | null {
  if (!(amount > 0) || !Number.isFinite(amount)) return "INVALID_AMOUNT";
  if (from === "staking_escrow" || !accounts.find((a) => a.kind === from)?.spendable) return "STAKE_FUNDS_LOCKED";
  const item = items.find((b) => b.id === budgetItemId);
  if (!item) return "UNKNOWN_BUDGET_ITEM";
  const committed = payments.filter((p) => p.budgetItemId === budgetItemId && p.status !== "rejected").reduce((s, p) => s + p.amount, 0);
  if (committed + amount > item.allocated) return "OVER_BUDGET_ITEM";
  const s = summarize(accounts, items, payments);
  if (amount > s.remaining - s.pendingPayments) return "INSUFFICIENT_FUNDS";
  return null;
}

export function newRequest(base: Omit<PaymentRequest, "requiredApprovals" | "requiredRoles" | "approvals" | "status">): PaymentRequest {
  const t = tierFor(base.amount);
  return { ...base, requiredApprovals: t.approvals, requiredRoles: [...t.roles], approvals: [], status: "pending" };
}

export type ApproveError = "NOT_PENDING" | "SELF_APPROVAL" | "ALREADY_APPROVED" | "ROLE_NOT_REQUIRED" | "ROLE_ALREADY_COVERED";

export function approve(p: PaymentRequest, uid: string, roles: DaoRole[], now: number): { ok: true; payment: PaymentRequest } | { ok: false; code: ApproveError } {
  if (p.status !== "pending") return { ok: false, code: "NOT_PENDING" };
  if (p.requestedBy === uid) return { ok: false, code: "SELF_APPROVAL" };
  if (p.approvals.some((a) => a.uid === uid)) return { ok: false, code: "ALREADY_APPROVED" };
  const covered = new Set(p.approvals.map((a) => a.role));
  const role = p.requiredRoles.find((r) => roles.includes(r) && !covered.has(r));
  if (!role) return { ok: false, code: p.requiredRoles.some((r) => roles.includes(r)) ? "ROLE_ALREADY_COVERED" : "ROLE_NOT_REQUIRED" };
  const approvals = [...p.approvals, { uid, role, at: now }];
  return { ok: true, payment: { ...p, approvals, status: approvals.length >= p.requiredApprovals ? "approved" : "pending" } };
}

export function paymentsEnabled() {
  return process.env.DAO_PAYMENTS_ENABLED === "true" && !!process.env.DAO_PAYMENT_RAIL;
}
