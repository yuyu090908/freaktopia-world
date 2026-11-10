/**
 * FESTIVAL DAO HTTP API (mounted at /api/dao/*).
 * Every permission is checked here on the server; the UI only mirrors the answers.
 * Demo mode uses the in-memory store; DAO_DATA_MODE=production answers 503 until a
 * Postgres repository, auth provider and audited staking contract are connected.
 */
import { userFromRequest } from "@/lib/auth/http";
import { authConfig } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getEvent, getDJ } from "@/lib/data";
import { clientKey, rateLimit } from "@/lib/ranking/guard";
import {
  cookieHeader,
  daoMode,
  decodeSession,
  DEVICE_COOKIE,
  encodeSession,
  issueNonce,
  readCookie,
  SESSION_COOKIE,
  uidForAddress,
  verifySignIn,
  allowedChainIds,
} from "./auth";
import { sha256 } from "./hash";
import { actorKinds, applyTransition, availableTransitions, canTransition } from "./lifecycle";
import { DAO_RULES, DEMO_CHAIN, DEMO_STAKING, DEMO_TOKEN } from "./meta";
import { ANON, can, canSee, canSeeDiscussion, canSeeMedia, denyReason, type Action, type Principal } from "./permissions";
import { badgesFor, gameLevel, xpFor, type XpAction } from "./game";
import { runFeasibility } from "./feasibility";
import { applyInstruction, buildPrompt, describe, generateConceptSpecs, newVersion } from "./stage";
import { approve, newRequest, paymentsEnabled, summarize, validateRequest } from "./treasury";
import { castBallot, liveCounts, tally, takeSnapshot, verifyChain } from "./voting";
import { detectSybils } from "./sybil";
import { validateImage, UPLOAD_ERROR_TEXT } from "./upload";
import { imageModelConfigured } from "./providers";
import { getDb, logActivity, nextId, verifyActivityChain, type DaoDb } from "./store";
import {
  DISCUSSION_CATEGORIES,
  REACTIONS,
  STAGE_THEMES,
  VOTING_METHODS,
  PROPOSAL_STATES,
  DAO_ROLES,
  type DaoMembership,
  type DaoSession,
  type DaoVote,
  type Discussion,
  type EventDao,
  type Proposal,
  type StageConcept,
  type DaoRole,
} from "./types";

/* ---------------- helpers ---------------- */

const NO_STORE = { "Cache-Control": "private, no-store" };

const ok = (data: unknown, status = 200, headers: Record<string, string> = {}) => NextResponse.json(data, { status, headers: { ...NO_STORE, ...headers } });
const fail = (status: number, code: string, message: string, extra?: Record<string, unknown>) => NextResponse.json({ error: { code, message, ...extra } }, { status, headers: NO_STORE });

const deny = (p: Principal, a: Action) => {
  const r = denyReason(p, a);
  return fail(p.uid ? 403 : 401, r.code, r.message);
};

const mediaUrl = (id: string) => `/api/dao/media/${id}`;

function limitWrite(req: Request, key: string, n = 30, ms = 60_000) {
  const wait = rateLimit(`dao:${key}:${clientKey(req)}`, n, ms);
  if (!wait) return null;
  const r = fail(429, "RATE_LIMITED", "Too many requests. Try again shortly.");
  r.headers.set("Retry-After", String(wait));
  return r;
}

async function body<T extends z.ZodType>(req: Request, schema: T): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, res: fail(400, "INVALID_JSON", "Body must be JSON.") };
  }
  const r = schema.safeParse(raw);
  if (!r.success) return { ok: false, res: fail(400, "INVALID_INPUT", "Some fields are invalid.", { issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }) };
  return { ok: true, data: r.data };
}

const BLOCKED = [/\bkill yourself\b/i, /\bkys\b/i, /\bn[i1]gg/i, /\bheil\b/i, /seed phrase/i, /private key/i];
function moderateText(text: string): string | null {
  if (BLOCKED.some((r) => r.test(text))) return "CONTENT_BLOCKED";
  if ((text.match(/https?:\/\//g) ?? []).length > 3) return "TOO_MANY_LINKS";
  return null;
}

/* ---------------- session / principal ---------------- */

function sessionOf(req: Request): DaoSession | null {
  return decodeSession(readCookie(req, SESSION_COOKIE));
}

function stakedNow(db: DaoDb, dao: EventDao, uid: string, now: number) {
  const total = db.positions.filter((p) => p.daoId === dao.id && p.uid === uid && p.status === "locked" && p.lockedUntil > now).reduce((a, p) => a + p.amount, 0);
  return total >= dao.config.minimumStake;
}

/** Re-creates demo stake positions carried in the signed session after an instance restart. */
function rehydrate(db: DaoDb, dao: EventDao, s: DaoSession, now: number) {
  const st = s.demoStakes?.[dao.id];
  if (!st || db.positions.some((p) => p.daoId === dao.id && p.uid === s.uid)) return;
  db.positions.push({ id: nextId(db, "pos"), daoId: dao.id, uid: s.uid, wallet: s.wallet, amount: st.amount, stakedAt: st.at, lockedUntil: st.at + dao.config.lockDurationDays * 86_400_000, status: "locked", source: "demo-ledger", txHash: st.tx });
  if (!db.members.some((m) => m.daoId === dao.id && m.uid === s.uid)) db.members.push({ daoId: dao.id, uid: s.uid, handle: handleFor(s.wallet), roles: ["member"], joinedAt: st.at, xp: 0, badges: [] });
  if (now < 0) void 0;
}

const handleFor = (wallet: string) => `alien_${wallet.slice(2, 8).toLowerCase()}`;

function principalFor(db: DaoDb, dao: EventDao, s: DaoSession | null, now = Date.now()): Principal {
  if (!s) return ANON;
  rehydrate(db, dao, s, now);
  const m = db.members.find((x) => x.daoId === dao.id && x.uid === s.uid) ?? null;
  const roles = new Set<DaoRole>(m?.roles ?? []);
  for (const r of s.demoRoles?.[dao.id] ?? []) roles.add(r);
  return { uid: s.uid, membership: m, staked: !!m && stakedNow(db, dao, s.uid, now), roles: [...roles] };
}

function ctx(req: Request, eventId: string) {
  const db = getDb();
  const dao = db.daos.get(eventId);
  const ev = getEvent(eventId);
  const session = sessionOf(req);
  return { db, dao, ev, session, p: dao ? principalFor(db, dao, session) : ANON };
}

/* ---------------- xp ---------------- */

function award(db: DaoDb, m: DaoMembership | null, action: XpAction, now: number, opts: { contentHash?: string; target?: string; length?: number } = {}) {
  if (!m) return 0;
  const r = xpFor(db.xp, m, action, now, opts);
  db.xp.push({ uid: m.uid, daoId: m.daoId, action, at: now, contentHash: opts.contentHash, target: opts.target, xp: r.xp });
  m.xp += r.xp;
  const dao = [...db.daos.values()].find((d) => d.id === m.daoId)!;
  const first = db.votes.filter((v) => v.daoId === m.daoId).sort((a, b) => a.startAt - b.startAt)[0]?.startAt ?? null;
  m.badges = badgesFor(m, db.xp, dao, first);
  return r.xp;
}

/* ---------------- views ---------------- */

function voteView(db: DaoDb, v: DaoVote, p: Principal, now: number) {
  maybeFinalize(db, v, now);
  const live = liveCounts(v, db.ballots);
  const mine = p.uid ? db.ballots.find((b) => b.voteId === v.id && b.uid === p.uid) : undefined;
  const showCounts = v.status === "closed" || !!mine || can(p, "transition_admin");
  return {
    id: v.id,
    proposalId: v.proposalId,
    proposalVersion: v.proposalVersion,
    method: v.method,
    options: v.options.map((o) => ({ ...o, concept: o.conceptId ? conceptView(db, db.concepts.find((c) => c.id === o.conceptId)!) : undefined, dj: o.djId ? getDJ(o.djId) : undefined })),
    maxChoices: v.maxChoices,
    startAt: v.startAt,
    endAt: v.endAt,
    quorum: v.quorum,
    threshold: v.threshold,
    status: v.status,
    snapshot: { takenAt: v.snapshot.takenAt, eligible: v.snapshot.eligible.length, minimumStake: v.snapshot.minimumStake, hash: v.snapshot.hash },
    participation: live.participation,
    ballots: live.ballots,
    counts: showCounts ? live.counts : null,
    result: v.result ?? null,
    me: p.uid
      ? {
          eligible: v.snapshot.eligible.includes(p.uid),
          ballot: mine ? { choice: mine.choice, castAt: mine.castAt, hash: mine.hash, held: mine.held } : null,
          reason: v.snapshot.eligible.includes(p.uid) ? null : p.staked ? "JOINED_AFTER_SNAPSHOT" : "NOT_STAKED",
        }
      : null,
  };
}

function maybeFinalize(db: DaoDb, v: DaoVote, now: number) {
  if (v.status === "open" && now >= v.endAt) {
    v.status = "closed";
    v.result = tally(v, db.ballots, v.endAt);
    const prop = db.proposals.find((x) => x.id === v.proposalId);
    if (prop && prop.state === "VOTING") {
      Object.assign(prop, applyTransition(prop, v.result.outcome, "system", v.endAt));
      logActivity(db, v.daoId, "system", "vote.finalized", v.id, { outcome: v.result.outcome, resultHash: v.result.resultHash }, now);
    }
  }
  if (v.status === "scheduled" && now >= v.startAt) v.status = "open";
}

function conceptView(db: DaoDb, c: StageConcept) {
  const photo = db.photos.find((p) => p.id === c.photoId);
  const cur = c.versions.at(-1)!;
  const prop = c.proposalId ? db.proposals.find((p) => p.id === c.proposalId) : undefined;
  const vote = prop?.voteId ? db.votes.find((v) => v.id === prop.voteId) : undefined;
  return {
    id: c.id,
    name: c.name,
    theme: c.theme,
    creatorHandle: c.creatorHandle,
    creatorUid: c.creatorUid,
    description: c.description,
    published: c.published,
    createdAt: c.createdAt,
    photo: photo ? { id: photo.id, url: mediaUrl(photo.mediaId), stageZone: photo.stageZone, ceilingY: photo.ceilingY, caption: photo.caption, generated: !!db.media.get(photo.mediaId)?.meta.generated } : null,
    current: cur,
    versions: c.versions.map((v) => ({ version: v.version, instruction: v.instruction, applied: v.applied, ignored: v.ignored, createdAt: v.createdAt, createdBy: v.createdBy, spec: v.spec, estimate: v.estimate, provider: v.provider })),
    comments: c.discussionId ? db.discussions.find((d) => d.id === c.discussionId)?.commentCount ?? 0 : db.discussions.filter((d) => d.conceptId === c.id).reduce((a, d) => a + d.commentCount, 0),
    discussionId: c.discussionId ?? db.discussions.find((d) => d.conceptId === c.id)?.id ?? null,
    proposal: prop ? { id: prop.id, state: prop.state, title: prop.versions.at(-1)!.title } : null,
    vote: vote ? { id: vote.id, status: vote.status, winner: vote.result?.winner ? vote.options.find((o) => o.id === vote.result!.winner)?.conceptId === c.id : null } : null,
    isDemo: !!c.isDemo,
  };
}

function discussionView(d: Discussion, p: Principal) {
  return {
    ...d,
    reports: undefined,
    reportCount: can(p, "moderate") ? d.reports.length : undefined,
    reactions: Object.fromEntries(REACTIONS.map((k) => [k, d.reactions[k]?.length ?? 0])),
    myReactions: p.uid ? REACTIONS.filter((k) => d.reactions[k]?.includes(p.uid!)) : [],
    attachments: d.attachments.map((id) => ({ id, url: mediaUrl(id) })),
  };
}

function proposalView(db: DaoDb, prop: Proposal, p: Principal, now: number) {
  const cur = prop.versions.at(-1)!;
  const vote = prop.voteId ? db.votes.find((v) => v.id === prop.voteId) : undefined;
  if (vote) maybeFinalize(db, vote, now);
  return {
    id: prop.id,
    eventId: prop.eventId,
    category: prop.category,
    state: prop.state,
    authorHandle: prop.authorHandle,
    authorUid: prop.authorUid,
    createdAt: prop.createdAt,
    method: prop.method,
    discussionDays: prop.discussionDays,
    votingDays: prop.votingDays,
    current: cur,
    versionCount: prop.versions.length,
    history: prop.history,
    discussionId: prop.discussionId ?? null,
    feasibility: prop.feasibility ?? null,
    executionReport: prop.executionReport ?? null,
    concepts: prop.conceptIds.map((id) => db.concepts.find((c) => c.id === id)).filter(Boolean).map((c) => conceptView(db, c!)),
    vote: vote ? voteView(db, vote, p, now) : null,
    isDemo: !!prop.isDemo,
  };
}

function membersOf(db: DaoDb, dao: EventDao) {
  return db.members.filter((m) => m.daoId === dao.id);
}

export function daoSummary(eventId: string, now = Date.now()) {
  const db = getDb();
  const dao = db.daos.get(eventId);
  if (!dao) return null;
  const members = membersOf(db, dao);
  const proposals = db.proposals.filter((p) => p.daoId === dao.id);
  const votes = db.votes.filter((v) => v.daoId === dao.id);
  for (const v of votes) maybeFinalize(db, v, now);
  const open = votes.filter((v) => v.status === "open");
  const closed = votes.filter((v) => v.status === "closed" && v.result);
  const participation = closed.length || open.length ? [...closed.map((v) => (v.result!.eligible ? v.result!.turnout / v.result!.eligible : 0)), ...open.map((v) => liveCounts(v, db.ballots).participation)] : [];
  const ev = getEvent(eventId)!;
  const photos = db.photos.filter((p) => p.daoId === dao.id);
  return {
    eventId,
    daoId: dao.id,
    status: dao.status,
    members: members.length,
    staked: db.positions.filter((p) => p.daoId === dao.id && p.status === "locked").reduce((a, p) => a + p.amount, 0),
    stakers: new Set(db.positions.filter((p) => p.daoId === dao.id && p.status === "locked").map((p) => p.uid)).size,
    tokenSymbol: dao.config.tokenSymbol,
    minimumStake: dao.config.minimumStake,
    activeProposals: proposals.filter((p) => ["DISCUSSION", "REVIEW", "VOTING", "FEASIBILITY_CHECK", "ORGANIZER_CONFIRMATION", "EXECUTION"].includes(p.state)).length,
    openVotes: open.length,
    participationRate: participation.length ? participation.reduce((a, b) => a + b, 0) / participation.length : 0,
    gameLevel: gameLevel(dao, photos, proposals, db.milestones.filter((m) => m.daoId === dao.id), ev.status),
    isDemo: dao.isDemo,
    /** Decisions the organizer confirmed (shown on tickets / event pages). Titles only, no member data. */
    confirmed: proposals
      .filter((x) => ["ORGANIZER_CONFIRMATION", "EXECUTION", "COMPLETED"].includes(x.state))
      .map((x) => ({ id: x.id, title: x.versions.at(-1)!.title, category: x.category, state: x.state }))
      .slice(0, 6),
    activeVote: open[0]
      ? (() => {
          const v = open.sort((a, b) => a.endAt - b.endAt)[0];
          const prop = db.proposals.find((x) => x.id === v.proposalId);
          return { id: v.id, proposalId: v.proposalId, title: prop?.versions.at(-1)?.title ?? "Vote", endAt: v.endAt, participation: liveCounts(v, db.ballots).participation };
        })()
      : null,
  };
}

export function allDaoSummaries(now = Date.now()) {
  return [...getDb().daos.keys()].map((id) => daoSummary(id, now)!).filter(Boolean);
}

/* ---------------- schemas ---------------- */

const zAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const zZone = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0.05).max(1), h: z.number().min(0.05).max(1) });
const zOptions = z.array(z.object({ label: z.string().trim().min(1).max(80), conceptId: z.string().max(80).optional(), djId: z.string().max(40).optional() })).max(8);
const zVenue = z.object({
  venueId: z.string().max(40).optional(),
  name: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(120),
  setting: z.enum(["indoor", "outdoor"]),
  capacity: z.number().int().min(20).max(200_000),
  stageWidthM: z.number().min(1).max(200),
  stageDepthM: z.number().min(1).max(200),
  ceilingHeightM: z.number().min(0).max(100),
  powerKw: z.number().min(1).max(10_000),
  existingEquipment: z.array(z.string().max(40)).max(30),
  budgetUsd: z.number().min(0).max(100_000_000),
  safetyRestrictions: z.array(z.string().max(120)).max(20),
});

/* ---------------- router ---------------- */

export async function handleDao(req: Request, segs: string[]): Promise<Response> {
  const method = req.method.toUpperCase();
  if (daoMode() === "production") {
    // No production repository yet: never fall back to demo data.
    return fail(503, "DATA_SOURCE_NOT_CONFIGURED", "The production DAO database, auth provider and audited staking contract are not connected yet.");
  }
  const now = Date.now();
  const [a, b, c, d, e] = segs;

  // ---- global ----
  if (!a && method === "GET") return ok({ mode: daoMode(), daos: allDaoSummaries(now).map((s) => ({ ...s, event: eventCard(s.eventId) })), chain: DEMO_CHAIN });
  if (a === "session" && method === "GET") {
    const s = sessionOf(req);
    const db = getDb();
    const memberships = s ? db.members.filter((m) => m.uid === s.uid).map((m) => ({ daoId: m.daoId, eventId: [...db.daos.values()].find((x) => x.id === m.daoId)?.eventId, xp: m.xp, badges: m.badges, handle: m.handle })) : [];
    return ok({ mode: daoMode(), chain: DEMO_CHAIN, allowedChainIds: allowedChainIds(), session: s ? { uid: s.uid, wallet: s.wallet, chainId: s.chainId } : null, memberships });
  }
  if (a === "auth") return auth(req, b, method, now);
  if (a === "media" && b && method === "GET") return serveMedia(req, b);
  if (a === "summary" && method === "GET") return ok({ daos: allDaoSummaries(now) }, 200, { "Cache-Control": "public, s-maxage=60" });
  if (a === "notifications" && method === "GET") return notifications(req, now);

  // ---- per event ----
  const eventId = a;
  const { db, dao, ev, session, p } = ctx(req, eventId);
  if (!ev) return fail(404, "EVENT_NOT_FOUND", "Unknown event.");
  if (b === "create" && method === "POST") return createDao(req, db, eventId, session, now);
  if (!dao) return fail(404, "DAO_NOT_FOUND", "This event has no DAO yet.", { canCreate: true });

  if (!b && method === "GET") return home(db, dao, p, now);
  if (b === "summary" && method === "GET") return ok(daoSummary(eventId, now));
  if (b === "join" && method === "POST") return join(req, db, dao, session, now);
  if (b === "unstake" && method === "POST") return unstake(db, dao, p, now);
  if (b === "demo-role" && method === "POST") return demoRole(req, dao, session);

  if (b === "discussions") {
    if (!c && method === "GET") return listDiscussions(req, db, dao, p);
    if (!c && method === "POST") return createDiscussion(req, db, dao, p, now);
    if (c && !d && method === "GET") return getDiscussion(db, dao, p, c);
    if (c && d === "comments" && method === "POST") return addComment(req, db, dao, p, c, now);
  }
  if (b === "react" && method === "POST") return react(req, db, dao, p);
  if (b === "report" && method === "POST") return report(req, db, dao, p, now);
  if (b === "moderate" && method === "POST") return moderate(req, db, dao, p, now);

  if (b === "proposals") {
    if (!c && method === "GET") return ok({ proposals: db.proposals.filter((x) => x.daoId === dao.id).sort((x, y) => y.createdAt - x.createdAt).map((x) => proposalView(db, x, p, now)), canCreate: can(p, "create_proposal") });
    if (!c && method === "POST") return createProposal(req, db, dao, p, now);
    const prop = c ? db.proposals.find((x) => x.id === c && x.daoId === dao.id) : undefined;
    if (c && !prop) return fail(404, "PROPOSAL_NOT_FOUND", "Unknown proposal.");
    if (prop && !d && method === "GET") {
      const actors = p.uid ? actorKinds(prop, p.uid, p.roles) : [];
      return ok({ proposal: proposalView(db, prop, p, now), transitions: availableTransitions(prop, actors).filter((t) => !["APPROVED", "REJECTED", "EXPIRED"].includes(t)), versions: prop.versions, canVote: can(p, "vote"), isStaff: can(p, "transition_admin"), isOrganizer: p.roles.includes("organizer") });
    }
    if (prop && d === "transition" && method === "POST") return transition(req, db, dao, p, prop, now);
    if (prop && d === "versions" && method === "POST") return addVersion(req, db, dao, p, prop, now);
    if (prop && d === "feasibility" && method === "POST") return feasibility(db, dao, p, prop, now);
    if (prop && d === "signoff" && method === "POST") return signoff(req, db, dao, p, prop, now);
    if (prop && d === "execution-report" && method === "POST") return executionReport(req, db, dao, p, prop, now);
  }

  if (b === "votes") {
    if (!c && method === "GET") {
      const votes = db.votes.filter((v) => v.daoId === dao.id).sort((x, y) => y.startAt - x.startAt);
      return ok({ votes: votes.map((v) => ({ ...voteView(db, v, p, now), proposal: (() => { const pr = db.proposals.find((x) => x.id === v.proposalId)!; return { id: pr.id, title: pr.versions[v.proposalVersion - 1]?.title ?? pr.versions.at(-1)!.title, state: pr.state, category: pr.category }; })() })), canVote: can(p, "vote") });
    }
    const vote = db.votes.find((v) => v.id === c && v.daoId === dao.id);
    if (!vote) return fail(404, "VOTE_NOT_FOUND", "Unknown vote.");
    if (d === "ballot" && method === "POST") return ballot(req, db, dao, p, vote, now);
    if (d === "audit" && method === "GET") {
      const receipts = db.ballots.filter((x) => x.voteId === vote.id);
      return ok({ voteId: vote.id, snapshot: { ...vote.snapshot, eligible: vote.snapshot.eligible.length, excluded: vote.snapshot.excluded.length }, receipts: receipts.map((r) => ({ voter: sha256(r.uid).slice(0, 12), choice: vote.status === "closed" ? r.choice : undefined, castAt: r.castAt, held: r.held, hash: r.hash, prevHash: r.prevHash })), chainValid: verifyChain(vote, db.ballots) === -1, result: vote.result ?? null });
    }
  }

  if (b === "media" && method === "POST") return upload(req, db, dao, p, now);

  if (b === "stage") {
    if (!c && method === "GET") return stageHome(db, dao, p);
    if (c === "photos" && !d && method === "POST") return addPhoto(req, db, dao, p, now);
    if (c === "photos" && d && e === "verify" && method === "POST") return verifyPhoto(db, dao, p, d, now);
    if (c === "projects" && !d && method === "POST") return createProject(req, db, dao, p, now);
    if (c === "projects" && d && e === "generate" && method === "POST") return generate(req, db, dao, p, d, now);
    if (c === "concepts" && d && e === "edit" && method === "POST") return editConcept(req, db, dao, p, d, now);
    if (c === "concepts" && d && e === "publish" && method === "POST") return publishConcept(db, dao, p, d, now);
  }
  if (b === "gallery" && method === "GET") return ok({ concepts: db.concepts.filter((x) => x.daoId === dao.id && x.published).sort((x, y) => y.createdAt - x.createdAt).map((x) => conceptView(db, x)) });

  if (b === "treasury") {
    if (!c && method === "GET") return treasury(db, dao, p);
    if (c === "payments" && !d && method === "POST") return requestPayment(req, db, dao, p, now);
    const pay = db.payments.find((x) => x.id === d && x.daoId === dao.id);
    if (c === "payments" && !pay) return fail(404, "PAYMENT_NOT_FOUND", "Unknown payment.");
    if (pay && e === "approve" && method === "POST") return approvePayment(db, dao, p, pay.id, now);
    if (pay && e === "execute" && method === "POST") return executePayment(db, dao, p, pay.id, now);
  }

  if (b === "roadmap" && method === "GET") return roadmap(db, dao, p);
  if (b === "roadmap" && c && method === "PATCH") return updateMilestone(req, db, dao, p, c, now);
  if (b === "members" && method === "GET") return members(req, db, dao, p);
  if (b === "settings" && method === "GET") return ok({ config: dao.config, status: dao.status, canEdit: can(p, "manage_settings"), demo: true, roles: p.roles, staked: p.staked });
  if (b === "settings" && method === "PATCH") return updateSettings(req, db, dao, p, now);
  if (b === "activity" && method === "GET") return ok({ chainValid: verifyActivityChain(db, dao.id), entries: db.activity.filter((x) => x.daoId === dao.id).slice(-80).reverse().map((x) => ({ ...x, actorUid: x.actorUid.startsWith("u_") ? sha256(x.actorUid).slice(0, 10) : x.actorUid })) });

  return fail(404, "NOT_FOUND", "Unknown DAO endpoint.");
}

function eventCard(eventId: string) {
  const e = getEvent(eventId)!;
  return { id: e.id, name: e.name, city: e.city, country: e.country, startsAt: e.startsAt, status: e.status, supporters: e.supporters, raised: e.raised, goal: e.goal, palette: e.palette, venueId: e.venueId, isDemo: e.isDemo };
}

/* ---------------- auth ---------------- */

async function auth(req: Request, step: string | undefined, method: string, now: number) {
  if (method !== "POST") return fail(405, "METHOD_NOT_ALLOWED", "Use POST.");
  const limited = limitWrite(req, "auth", 20, 60_000);
  if (limited) return limited;
  if (step === "nonce") {
    const n = issueNonce(now);
    const res = ok({ nonce: n.nonce, nonceToken: n.token, expiresAt: n.expiresAt, chainId: allowedChainIds()[0], domain: new URL(req.url).host });
    if (!readCookie(req, DEVICE_COOKIE)) res.headers.append("Set-Cookie", cookieHeader(DEVICE_COOKIE, `dev_${sha256(`${now}${Math.random()}`).slice(0, 16)}`, 365 * 86400));
    return res;
  }
  if (step === "verify") {
    const r = await body(req, z.object({ message: z.string().max(2000), signature: z.string().regex(/^0x[0-9a-fA-F]+$/), nonceToken: z.string().max(300) }));
    if (!r.ok) return r.res;
    const host = new URL(req.url).host;
    const v = await verifySignIn(r.data.message, r.data.signature as `0x${string}`, r.data.nonceToken, host, now);
    if (!v.ok) return fail(401, v.code, "Wallet signature could not be verified.");
    const prev = sessionOf(req);
    const uid = uidForAddress(v.address);
    const session: DaoSession = { uid, wallet: v.address, chainId: v.chainId, issuedAt: now, deviceId: readCookie(req, DEVICE_COOKIE) ?? "unknown", demoRoles: prev?.uid === uid ? prev.demoRoles : undefined, demoStakes: prev?.uid === uid ? prev.demoStakes : undefined };
    const res = ok({ session: { uid, wallet: v.address, chainId: v.chainId } });
    res.headers.append("Set-Cookie", cookieHeader(SESSION_COOKIE, encodeSession(session), DAO_RULES.sessionTtlMs / 1000));
    return res;
  }
  if (step === "logout") {
    const res = ok({ ok: true });
    res.headers.append("Set-Cookie", cookieHeader(SESSION_COOKIE, "", 0));
    return res;
  }
  return fail(404, "NOT_FOUND", "Unknown auth step.");
}

function withSession(res: NextResponse, s: DaoSession) {
  res.headers.append("Set-Cookie", cookieHeader(SESSION_COOKIE, encodeSession(s), DAO_RULES.sessionTtlMs / 1000));
  return res;
}

/* ---------------- membership ---------------- */

async function join(req: Request, db: DaoDb, dao: EventDao, s: DaoSession | null, now: number) {
  if (!s) return fail(401, "WALLET_REQUIRED", "Connect a wallet and sign in first.");
  const limited = limitWrite(req, `join:${s.uid}`, 10);
  if (limited) return limited;
  const r = await body(req, z.object({ amount: z.number().positive().max(1_000_000), chainId: z.number().int(), stakingContract: zAddress }));
  if (!r.ok) return r.res;
  if (r.data.chainId !== dao.config.chainId) return fail(400, "CHAIN_ID_MISMATCH", "Wrong network for this DAO.");
  if (r.data.stakingContract.toLowerCase() !== dao.config.stakingContract.toLowerCase()) return fail(400, "CONTRACT_MISMATCH", "Staking contract does not match this DAO.");
  if (r.data.amount < dao.config.minimumStake) return fail(400, "BELOW_MINIMUM_STAKE", `Minimum stake is ${dao.config.minimumStake} ${dao.config.tokenSymbol}.`);
  if (db.positions.some((p) => p.daoId === dao.id && p.uid === s.uid && p.status === "locked")) return fail(409, "ALREADY_STAKED", "You already have a locked stake in this DAO.");
  // A wallet can only belong to one account.
  const owner = [...db.signals.values()].find((x) => x.wallets.some((w) => w.toLowerCase() === s.wallet.toLowerCase()) && x.uid !== s.uid);
  if (owner) return fail(409, "WALLET_LINKED_TO_OTHER_ACCOUNT", "This wallet already belongs to another account.");
  const tx = `0xdemo${sha256(`${s.uid}${dao.id}${now}`).slice(0, 58)}`;
  db.positions.push({ id: nextId(db, "pos"), daoId: dao.id, uid: s.uid, wallet: s.wallet, amount: r.data.amount, stakedAt: now, lockedUntil: now + dao.config.lockDurationDays * 86_400_000, status: "locked", source: "demo-ledger", txHash: tx });
  let m = db.members.find((x) => x.daoId === dao.id && x.uid === s.uid);
  if (!m) {
    m = { daoId: dao.id, uid: s.uid, handle: handleFor(s.wallet), roles: ["member"], joinedAt: now, xp: 0, badges: dao.status === "forming" ? ["founder"] : [] };
    db.members.push(m);
  }
  db.signals.set(s.uid, { uid: s.uid, wallets: [s.wallet], deviceId: s.deviceId, ipHash: sha256(clientKey(req)).slice(0, 12), joinedAt: now });
  const daoUids = new Set(db.members.filter((x) => x.daoId === dao.id).map((x) => x.uid));
  const flag = detectSybils([...db.signals.values()].filter((x) => daoUids.has(x.uid))).find((f) => f.uid === s.uid);
  if (flag) m.flagged = { reason: flag.reason, cluster: flag.cluster, at: now };
  logActivity(db, dao.id, s.uid, "member.staked", dao.id, { amount: r.data.amount, tx, source: "demo-ledger", flagged: !!flag }, now);
  const next: DaoSession = { ...s, demoStakes: { ...(s.demoStakes ?? {}), [dao.id]: { amount: r.data.amount, at: now, tx } } };
  return withSession(ok({ ok: true, txHash: tx, lockedUntil: now + dao.config.lockDurationDays * 86_400_000, flagged: m.flagged ?? null, demo: true }), next);
}

function unstake(db: DaoDb, dao: EventDao, p: Principal, now: number) {
  if (!p.uid) return deny(p, "post");
  const pos = db.positions.filter((x) => x.daoId === dao.id && x.uid === p.uid && x.status === "locked");
  if (!pos.length) return fail(404, "NO_STAKE", "No locked stake to release.");
  for (const x of pos) x.status = "unlocking";
  logActivity(db, dao.id, p.uid, "member.unstake_requested", dao.id, { unlockAt: Math.max(...pos.map((x) => x.lockedUntil)) }, now);
  return ok({ ok: true, unlockAt: Math.max(...pos.map((x) => x.lockedUntil)), note: "Votes already open keep their snapshot. New posts and votes need a locked stake." });
}

async function demoRole(req: Request, dao: EventDao, s: DaoSession | null) {
  if (!s) return fail(401, "WALLET_REQUIRED", "Connect a wallet first.");
  const r = await body(req, z.object({ roles: z.array(z.enum(DAO_ROLES)).max(5) }));
  if (!r.ok) return r.res;
  const roles = r.data.roles.filter((x) => x !== "member");
  const next: DaoSession = { ...s, demoRoles: { ...(s.demoRoles ?? {}), [dao.id]: roles } };
  logActivity(getDb(), dao.id, s.uid, "demo.role_view", dao.id, { roles });
  return withSession(ok({ ok: true, roles, demo: true }), next);
}

async function createDao(req: Request, db: DaoDb, eventId: string, s: DaoSession | null, now: number) {
  if (!s) return fail(401, "WALLET_REQUIRED", "Connect a wallet first.");
  if (db.daos.has(eventId)) return fail(409, "DAO_EXISTS", "This event already has a DAO.");
  const ev = getEvent(eventId)!;
  if (ev.status === "ended") return fail(409, "EVENT_ENDED", "Completed events cannot start a DAO.");
  const r = await body(req, z.object({ minimumStake: z.number().min(1).max(100_000), lockDurationDays: z.number().int().min(7).max(365) }));
  if (!r.ok) return r.res;
  const daoId = `dao_${eventId}`;
  db.daos.set(eventId, {
    id: daoId,
    eventId,
    status: "forming",
    createdAt: now,
    organizerUid: s.uid,
    description: `Community DAO for ${ev.name}.`,
    isDemo: true,
    config: { tokenContract: DEMO_TOKEN, stakingContract: DEMO_STAKING, chainId: DEMO_CHAIN.id, tokenSymbol: "FRK (demo)", minimumStake: r.data.minimumStake, lockDurationDays: r.data.lockDurationDays, eligibilitySnapshotAt: now, votingStartAt: now + 3 * 86_400_000, votingEndAt: now + 10 * 86_400_000, unstakingRules: `Tokens unlock ${r.data.lockDurationDays} days after staking. Open votes keep their snapshot.`, defaultQuorum: 0.2, defaultThreshold: 0.5, discussionDays: 3, votingDays: 7 },
  });
  db.members.push({ daoId, uid: s.uid, handle: handleFor(s.wallet), roles: ["member", "organizer"], joinedAt: now, xp: 0, badges: ["founder"] });
  db.accounts.push({ id: nextId(db, "acc"), daoId, kind: "staking_escrow", label: "Staking escrow (principal, locked)", balance: 0, currency: "FRK (demo)", spendable: false }, { id: nextId(db, "acc"), daoId, kind: "event_budget", label: "Event production budget", balance: 0, currency: "USD", spendable: true });
  logActivity(db, daoId, s.uid, "dao.created", eventId, { minimumStake: r.data.minimumStake }, now);
  return ok({ ok: true, daoId }, 201);
}

/* ---------------- home ---------------- */

function home(db: DaoDb, dao: EventDao, p: Principal, now: number) {
  const summary = daoSummary(dao.eventId, now)!;
  const votes = db.votes.filter((v) => v.daoId === dao.id).map((v) => voteView(db, v, p, now));
  const openVotes = votes.filter((v) => v.status === "open").map((v) => ({ ...v, proposal: (() => { const pr = db.proposals.find((x) => x.id === v.proposalId)!; return { id: pr.id, title: pr.versions.at(-1)!.title, category: pr.category }; })() }));
  const discussions = db.discussions.filter((d) => d.daoId === dao.id && canSeeDiscussion(p, d)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastActivityAt - a.lastActivityAt).slice(0, 5).map((d) => discussionView(d, p));
  const concepts = db.concepts.filter((c) => c.daoId === dao.id && c.published).sort((a, b) => b.versions.at(-1)!.createdAt - a.versions.at(-1)!.createdAt).slice(0, 6).map((c) => conceptView(db, c));
  const milestones = db.milestones.filter((m) => m.daoId === dao.id);
  const m = p.membership;
  const next: { key: string; label: string; href: string }[] = [];
  if (!p.uid) next.push({ key: "connect", label: "Connect a demo wallet to join", href: "#join" });
  else if (!p.staked) next.push({ key: "stake", label: `Stake ${dao.config.minimumStake} ${dao.config.tokenSymbol} to join`, href: "#join" });
  else {
    const toVote = openVotes.find((v) => v.me?.eligible && !v.me.ballot);
    if (toVote) next.push({ key: "vote", label: `Vote: ${toVote.proposal.title}`, href: `/dao/${dao.eventId}/votes#${toVote.id}` });
    if (openVotes.some((v) => v.me && !v.me.eligible)) next.push({ key: "snapshot", label: "You joined after the open vote's snapshot: join the discussion for the next vote", href: `/dao/${dao.eventId}/discussion` });
    next.push({ key: "design", label: "Remix a stage concept in the AI Stage Designer", href: `/dao/${dao.eventId}/stage-designer` });
    next.push({ key: "propose", label: "Turn an idea into a proposal", href: `/dao/${dao.eventId}/proposals?new=1` });
  }
  const proposals = db.proposals.filter((x) => x.daoId === dao.id);
  return ok({
    mode: daoMode(),
    dao: { id: dao.id, eventId: dao.eventId, status: dao.status, description: dao.description, config: dao.config, isDemo: dao.isDemo, createdAt: dao.createdAt },
    event: eventCard(dao.eventId),
    summary,
    openVotes,
    discussions,
    concepts,
    progress: { done: milestones.filter((x) => x.status === "done").length, total: milestones.length, next: milestones.find((x) => x.status !== "done") ?? null },
    reviewQueue: can(p, "transition_admin") ? proposals.filter((x) => x.state === "REVIEW").map((x) => ({ id: x.id, title: x.versions.at(-1)!.title })) : [],
    me: p.uid
      ? {
          uid: p.uid,
          member: !!m,
          staked: p.staked,
          roles: p.roles,
          handle: m?.handle ?? null,
          xp: m?.xp ?? 0,
          badges: m?.badges ?? [],
          flagged: m?.flagged ? { reason: m.flagged.reason } : null,
          position: db.positions.filter((x) => x.daoId === dao.id && x.uid === p.uid).map((x) => ({ amount: x.amount, status: x.status, lockedUntil: x.lockedUntil, txHash: x.txHash, source: x.source })),
          can: { post: can(p, "post"), vote: can(p, "vote"), propose: can(p, "create_proposal"), moderate: can(p, "moderate"), organize: p.roles.includes("organizer") },
        }
      : null,
    next,
  });
}

/* ---------------- discussions ---------------- */

function listDiscussions(req: Request, db: DaoDb, dao: EventDao, p: Principal) {
  const u = new URL(req.url);
  const cat = u.searchParams.get("category");
  const q = (u.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 80);
  let list = db.discussions.filter((d) => d.daoId === dao.id && canSeeDiscussion(p, d));
  if (cat && (DISCUSSION_CATEGORIES as readonly string[]).includes(cat)) list = list.filter((d) => d.category === cat);
  if (q) {
    const hit = new Set(db.comments.filter((x) => x.body.toLowerCase().includes(q) && !x.hidden).map((x) => x.discussionId));
    list = list.filter((d) => d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q) || hit.has(d.id));
  }
  list.sort((x, y) => Number(y.pinned) - Number(x.pinned) || y.lastActivityAt - x.lastActivityAt);
  const hiddenPrivate = db.discussions.filter((d) => d.daoId === dao.id && !canSee(p, d.visibility)).length;
  return ok({ discussions: list.map((d) => discussionView(d, p)), canPost: can(p, "post"), canModerate: can(p, "moderate"), restricted: hiddenPrivate, deny: can(p, "post") ? null : denyReason(p, "post") });
}

async function createDiscussion(req: Request, db: DaoDb, dao: EventDao, p: Principal, now: number) {
  if (!can(p, "post")) return deny(p, "post");
  const limited = limitWrite(req, `post:${p.uid}`, 6, 60_000);
  if (limited) return limited;
  const r = await body(req, z.object({ title: z.string().trim().min(6).max(120), body: z.string().trim().min(DAO_RULES.minPostChars).max(5000), category: z.enum(DISCUSSION_CATEGORIES), visibility: z.enum(["public", "members", "private"]).default("public"), attachments: z.array(z.string().max(80)).max(4).default([]), proposalIds: z.array(z.string().max(80)).max(3).default([]), conceptId: z.string().max(80).optional(), djId: z.string().max(40).optional() }));
  if (!r.ok) return r.res;
  if (r.data.visibility === "private" && !can(p, "read_private")) return fail(403, "FORBIDDEN", "Only organizers and moderators can start private topics.");
  const bad = moderateText(`${r.data.title}\n${r.data.body}`);
  if (bad) return fail(422, bad, bad === "CONTENT_BLOCKED" ? "This post breaks the community rules." : "Too many links.");
  for (const id of r.data.attachments) {
    const m = db.media.get(id);
    if (!m || m.meta.daoId !== dao.id || m.meta.ownerUid !== p.uid) return fail(400, "INVALID_ATTACHMENT", "Attach only images you uploaded to this DAO.");
  }
  const m = p.membership!;
  const d: Discussion = { id: nextId(db, "disc"), daoId: dao.id, category: r.data.category, title: r.data.title, body: r.data.body, authorUid: p.uid!, authorHandle: m.handle, createdAt: now, lastActivityAt: now, visibility: r.data.visibility, pinned: false, locked: false, hidden: false, attachments: r.data.attachments, proposalIds: r.data.proposalIds.filter((id) => db.proposals.some((x) => x.id === id && x.daoId === dao.id)), reactions: {}, reports: [], commentCount: 0, conceptId: r.data.conceptId, djId: r.data.djId && getDJ(r.data.djId) ? r.data.djId : undefined };
  db.discussions.push(d);
  const xp = award(db, m, "discussion", now, { contentHash: sha256(d.body.toLowerCase().replace(/\s+/g, " ")), length: d.body.length });
  logActivity(db, dao.id, p.uid!, "discussion.created", d.id, { category: d.category, visibility: d.visibility }, now);
  return ok({ discussion: discussionView(d, p), xp }, 201);
}

function getDiscussion(db: DaoDb, dao: EventDao, p: Principal, id: string) {
  const d = db.discussions.find((x) => x.id === id && x.daoId === dao.id);
  if (!d) return fail(404, "DISCUSSION_NOT_FOUND", "Unknown thread.");
  if (!canSeeDiscussion(p, d)) return d.visibility === "public" ? fail(404, "DISCUSSION_NOT_FOUND", "Unknown thread.") : deny(p, d.visibility === "members" ? "read_members" : "read_private");
  const staff = can(p, "moderate");
  const comments = db.comments
    .filter((c) => c.discussionId === d.id && (!c.hidden || staff || c.authorUid === p.uid))
    .map((c) => ({ ...c, reports: undefined, reportCount: staff ? c.reports.length : undefined, reactions: Object.fromEntries(REACTIONS.map((k) => [k, c.reactions[k]?.length ?? 0])), myReactions: p.uid ? REACTIONS.filter((k) => c.reactions[k]?.includes(p.uid!)) : [], attachments: c.attachments.map((a) => ({ id: a, url: mediaUrl(a) })) }));
  const proposals = d.proposalIds.map((pid) => db.proposals.find((x) => x.id === pid)).filter(Boolean).map((x) => ({ id: x!.id, title: x!.versions.at(-1)!.title, state: x!.state }));
  const concept = d.conceptId ? db.concepts.find((c) => c.id === d.conceptId) : undefined;
  return ok({ discussion: discussionView(d, p), comments, proposals, concept: concept ? conceptView(db, concept) : null, dj: d.djId ? getDJ(d.djId) : null, canComment: can(p, "comment") && !d.locked, canModerate: staff, deny: can(p, "comment") ? null : denyReason(p, "comment") });
}

async function addComment(req: Request, db: DaoDb, dao: EventDao, p: Principal, id: string, now: number) {
  const d = db.discussions.find((x) => x.id === id && x.daoId === dao.id);
  if (!d || !canSeeDiscussion(p, d)) return fail(404, "DISCUSSION_NOT_FOUND", "Unknown thread.");
  if (!can(p, "comment")) return deny(p, "comment");
  if (d.locked) return fail(423, "THREAD_LOCKED", "A moderator locked this thread.");
  const limited = limitWrite(req, `cmt:${p.uid}`, 12, 60_000);
  if (limited) return limited;
  const r = await body(req, z.object({ body: z.string().trim().min(DAO_RULES.minCommentChars).max(3000), parentId: z.string().max(80).nullable().default(null), attachments: z.array(z.string().max(80)).max(2).default([]) }));
  if (!r.ok) return r.res;
  const bad = moderateText(r.data.body);
  if (bad) return fail(422, bad, "This comment breaks the community rules.");
  if (r.data.parentId && !db.comments.some((c) => c.id === r.data.parentId && c.discussionId === d.id)) return fail(400, "INVALID_PARENT", "Reply target not found.");
  for (const a of r.data.attachments) {
    const m = db.media.get(a);
    if (!m || m.meta.daoId !== dao.id || m.meta.ownerUid !== p.uid) return fail(400, "INVALID_ATTACHMENT", "Attach only images you uploaded to this DAO.");
  }
  const c = { id: nextId(db, "cmt"), discussionId: d.id, parentId: r.data.parentId, authorUid: p.uid!, authorHandle: p.membership!.handle, body: r.data.body, createdAt: now, attachments: r.data.attachments, reactions: {}, reports: [], hidden: false };
  db.comments.push(c);
  d.commentCount++;
  d.lastActivityAt = now;
  const xp = award(db, p.membership, "comment", now, { contentHash: sha256(c.body.toLowerCase().replace(/\s+/g, " ")), length: c.body.length });
  logActivity(db, dao.id, p.uid!, "comment.created", d.id, { comment: c.id, replyTo: c.parentId, notify: d.authorUid }, now);
  return ok({ comment: { ...c, reactions: {}, myReactions: [], attachments: c.attachments.map((x) => ({ id: x, url: mediaUrl(x) })) }, xp }, 201);
}

async function react(req: Request, db: DaoDb, dao: EventDao, p: Principal) {
  if (!can(p, "react")) return deny(p, "react");
  const r = await body(req, z.object({ targetType: z.enum(["discussion", "comment"]), id: z.string().max(80), kind: z.enum(REACTIONS) }));
  if (!r.ok) return r.res;
  const t = r.data.targetType === "discussion" ? db.discussions.find((x) => x.id === r.data.id && x.daoId === dao.id) : db.comments.find((x) => x.id === r.data.id && db.discussions.some((d) => d.id === x.discussionId && d.daoId === dao.id));
  if (!t) return fail(404, "NOT_FOUND", "Nothing to react to.");
  const disc = "discussionId" in t ? db.discussions.find((d) => d.id === t.discussionId)! : (t as Discussion);
  if (!canSeeDiscussion(p, disc)) return fail(404, "NOT_FOUND", "Nothing to react to.");
  const list = t.reactions[r.data.kind] ?? [];
  const on = !list.includes(p.uid!);
  t.reactions[r.data.kind] = on ? [...list, p.uid!] : list.filter((u) => u !== p.uid);
  return ok({ on, count: t.reactions[r.data.kind]!.length });
}

async function report(req: Request, db: DaoDb, dao: EventDao, p: Principal, now: number) {
  if (!can(p, "report")) return deny(p, "report");
  const limited = limitWrite(req, `report:${p.uid}`, 10, 600_000);
  if (limited) return limited;
  const r = await body(req, z.object({ targetType: z.enum(["discussion", "comment"]), id: z.string().max(80), reason: z.enum(["spam", "harassment", "scam", "off_topic", "unsafe", "other"]) }));
  if (!r.ok) return r.res;
  const t = r.data.targetType === "discussion" ? db.discussions.find((x) => x.id === r.data.id && x.daoId === dao.id) : db.comments.find((x) => x.id === r.data.id);
  if (!t) return fail(404, "NOT_FOUND", "Nothing to report.");
  if (t.reports.some((x) => x.uid === p.uid)) return fail(409, "ALREADY_REPORTED", "You already reported this.");
  t.reports.push({ uid: p.uid!, reason: r.data.reason, at: now });
  // Only reports from distinct staked members count towards auto-hide.
  const weighty = t.reports.filter((x) => db.members.some((m) => m.uid === x.uid && m.daoId === dao.id && !m.flagged)).length;
  if (weighty >= DAO_RULES.autoHideReports && !t.hidden) {
    t.hidden = true;
    db.moderation.push({ id: nextId(db, "mod"), daoId: dao.id, at: now, moderatorUid: "system", action: "auto_hide", target: t.id, reason: `${weighty} member reports` });
  }
  logActivity(db, dao.id, p.uid!, "content.reported", t.id, { reason: r.data.reason }, now);
  return ok({ ok: true, hidden: t.hidden });
}

async function moderate(req: Request, db: DaoDb, dao: EventDao, p: Principal, now: number) {
  if (!can(p, "moderate")) return deny(p, "moderate");
  const r = await body(req, z.object({ targetType: z.enum(["discussion", "comment", "member"]), id: z.string().max(80), action: z.enum(["hide", "unhide", "pin", "unpin", "lock", "unlock", "suspend", "clear_flag"]), reason: z.string().trim().min(4).max(300) }));
  if (!r.ok) return r.res;
  const { targetType, id, action, reason } = r.data;
  if (targetType === "member") {
    const m = db.members.find((x) => x.daoId === dao.id && x.uid === id);
    if (!m) return fail(404, "NOT_FOUND", "Unknown member.");
    if (action === "suspend") m.suspendedUntil = now + 7 * 86_400_000;
    else if (action === "clear_flag") {
      m.flagged = undefined;
      for (const b of db.ballots.filter((x) => x.uid === id)) {
        const v = db.votes.find((x) => x.id === b.voteId && x.daoId === dao.id);
        if (v && v.status === "open") b.held = false;
      }
    } else return fail(400, "INVALID_ACTION", "Not a member action.");
  } else {
    const t = targetType === "discussion" ? db.discussions.find((x) => x.id === id && x.daoId === dao.id) : db.comments.find((x) => x.id === id);
    if (!t) return fail(404, "NOT_FOUND", "Nothing to moderate.");
    if (action === "hide" || action === "unhide") t.hidden = action === "hide";
    else if ("pinned" in t && (action === "pin" || action === "unpin")) t.pinned = action === "pin";
    else if ("locked" in t && (action === "lock" || action === "unlock")) t.locked = action === "lock";
    else return fail(400, "INVALID_ACTION", "Action does not apply to this target.");
  }
  db.moderation.push({ id: nextId(db, "mod"), daoId: dao.id, at: now, moderatorUid: p.uid!, action, target: id, reason });
  logActivity(db, dao.id, p.uid!, `moderation.${action}`, id, { reason }, now);
  return ok({ ok: true });
}

/* ---------------- proposals ---------------- */

async function createProposal(req: Request, db: DaoDb, dao: EventDao, p: Principal, now: number) {
  if (!can(p, "create_proposal")) return deny(p, "create_proposal");
  const limited = limitWrite(req, `prop:${p.uid}`, 4, 600_000);
  if (limited) return limited;
  const r = await body(
    req,
    z.object({
      title: z.string().trim().min(6).max(120),
      description: z.string().trim().min(20).max(6000),
      category: z.enum(DISCUSSION_CATEGORIES),
      proposedChange: z.string().trim().min(10).max(2000),
      estimatedCost: z.number().min(0).max(10_000_000),
      method: z.enum(VOTING_METHODS).default("yes_no_abstain"),
      options: zOptions.default([]),
      attachments: z.array(z.string().max(80)).max(6).default([]),
      documents: z.array(z.object({ name: z.string().trim().min(1).max(120), url: z.string().url().max(500).optional(), mediaId: z.string().max(80).optional() })).max(5).default([]),
      conceptIds: z.array(z.string().max(80)).max(5).default([]),
      discussionDays: z.number().int().min(1).max(14).default(3),
      votingDays: z.number().int().min(1).max(14).default(7),
      submit: z.boolean().default(true),
    }),
  );
  if (!r.ok) return r.res;
  const x = r.data;
  const bad = moderateText(`${x.title}\n${x.description}\n${x.proposedChange}`);
  if (bad) return fail(422, bad, "This proposal breaks the community rules.");
  const concepts = x.conceptIds.filter((id) => db.concepts.some((c) => c.id === id && c.daoId === dao.id && c.published));
  let options = x.options;
  if (x.method === "yes_no_abstain") options = [{ label: "Yes" }, { label: "No" }, { label: "Abstain" }];
  else if (!options.length && concepts.length) options = concepts.map((id) => ({ label: db.concepts.find((c) => c.id === id)!.name, conceptId: id }));
  if (x.method !== "yes_no_abstain" && options.length < 2) return fail(400, "NEEDS_TWO_OPTIONS", "Add at least two voting options.");
  const opts = options.map((o, i) => ({ id: x.method === "yes_no_abstain" ? ["yes", "no", "abstain"][i] : `opt_${i + 1}`, label: o.label, conceptId: o.conceptId && concepts.includes(o.conceptId) ? o.conceptId : undefined, djId: o.djId && getDJ(o.djId) ? o.djId : undefined }));
  const id = nextId(db, "prop");
  const prop: Proposal = {
    id,
    daoId: dao.id,
    eventId: dao.eventId,
    category: x.category,
    state: "DRAFT",
    authorUid: p.uid!,
    authorHandle: p.membership!.handle,
    createdAt: now,
    method: x.method,
    discussionDays: x.discussionDays,
    votingDays: x.votingDays,
    versions: [{ version: 1, title: x.title, description: x.description, proposedChange: x.proposedChange, estimatedCost: x.estimatedCost, options: opts, attachments: x.attachments, documents: x.documents, createdAt: now, authorUid: p.uid! }],
    history: [],
    conceptIds: concepts,
  };
  if (x.submit) Object.assign(prop, applyTransition(prop, "DISCUSSION", p.uid!, now));
  const disc: Discussion = { id: nextId(db, "disc"), daoId: dao.id, category: x.category, title: `Proposal: ${x.title}`, body: x.description, authorUid: p.uid!, authorHandle: p.membership!.handle, createdAt: now, lastActivityAt: now, visibility: "public", pinned: false, locked: false, hidden: false, attachments: [], proposalIds: [id], reactions: {}, reports: [], commentCount: 0, conceptId: concepts[0] };
  db.discussions.push(disc);
  prop.discussionId = disc.id;
  db.proposals.push(prop);
  const xp = award(db, p.membership, "proposal", now, { contentHash: sha256(x.title.toLowerCase()), target: id });
  logActivity(db, dao.id, p.uid!, "proposal.created", id, { state: prop.state, category: x.category }, now);
  return ok({ proposal: proposalView(db, prop, p, now), xp }, 201);
}

async function transition(req: Request, db: DaoDb, dao: EventDao, p: Principal, prop: Proposal, now: number) {
  if (!p.uid) return deny(p, "transition_admin");
  const r = await body(req, z.object({ to: z.enum(PROPOSAL_STATES), reason: z.string().trim().max(1000).optional() }));
  if (!r.ok) return r.res;
  const { to, reason } = r.data;
  if (["APPROVED", "REJECTED", "EXPIRED"].includes(to)) return fail(403, "SYSTEM_ONLY", "Vote results are set by the vote engine only.");
  const actors = actorKinds(prop, p.uid, p.roles);
  if (prop.authorUid === p.uid && !p.staked && !can(p, "transition_admin")) return deny(p, "create_proposal");
  const check = canTransition(prop, to, actors, now, reason);
  if (!check.ok) return fail(check.code === "FORBIDDEN_TRANSITION" ? 403 : 409, check.code!, transitionMessage(check.code!));
  if (to === "VOTING") {
    const open = db.votes.find((v) => v.proposalId === prop.id && v.status === "open");
    if (open) return fail(409, "VOTE_ALREADY_OPEN", "This proposal already has an open vote.");
    const cur = prop.versions.at(-1)!;
    const snap = takeSnapshot(dao.id, db.positions, db.members, dao.config.minimumStake, now, nextId(db, "snap"));
    const vote: DaoVote = { id: nextId(db, "vote"), daoId: dao.id, proposalId: prop.id, proposalVersion: cur.version, method: prop.method, options: cur.options, maxChoices: prop.method === "multiple" ? Math.min(3, cur.options.length - 1) : 1, startAt: now, endAt: now + prop.votingDays * 86_400_000, quorum: dao.config.defaultQuorum, threshold: dao.config.defaultThreshold, snapshot: snap, status: "open" };
    db.votes.push(vote);
    prop.voteId = vote.id;
    logActivity(db, dao.id, p.uid, "vote.opened", vote.id, { snapshot: snap.hash, eligible: snap.eligible.length, version: cur.version }, now);
  }
  Object.assign(prop, applyTransition(prop, to, p.uid, now, reason));
  if (to === "CANCELLED" && ["APPROVED", "FEASIBILITY_CHECK", "ORGANIZER_CONFIRMATION", "EXECUTION"].includes(prop.history.at(-1)!.from)) {
    // Approved by the community but not executed: report publicly why.
    prop.executionReport = { at: now, byUid: p.uid, status: "cannot_execute", message: reason! };
    const d = prop.discussionId ? db.discussions.find((x) => x.id === prop.discussionId) : undefined;
    if (d) {
      db.comments.push({ id: nextId(db, "cmt"), discussionId: d.id, parentId: null, authorUid: p.uid, authorHandle: p.membership?.handle ?? "organizer", body: `ORGANIZER REPORT: this approved proposal will not be executed. Reason: ${reason}`, createdAt: now, attachments: [], reactions: {}, reports: [], hidden: false });
      d.commentCount++;
      d.pinned = true;
    }
  }
  if (to === "EXECUTION") {
    prop.executionReport = { at: now, byUid: p.uid, status: "executing", message: reason || "Organizer confirmed the plan. Execution started." };
    db.milestones.push({ id: nextId(db, "ms"), daoId: dao.id, title: `Execute: ${prop.versions.at(-1)!.title}`, due: now + 14 * 86_400_000, status: "doing", proposalId: prop.id });
  }
  if (to === "COMPLETED") prop.executionReport = { at: now, byUid: p.uid, status: "done", message: reason || "Done." };
  logActivity(db, dao.id, p.uid, "proposal.transition", prop.id, { from: prop.history.at(-1)!.from, to, reason }, now);
  return ok({ proposal: proposalView(db, prop, p, now) });
}

function transitionMessage(code: string) {
  return (
    {
      INVALID_TRANSITION: "That step is not possible from the current state.",
      FORBIDDEN_TRANSITION: "Your role cannot make this change.",
      REASON_REQUIRED: "Give a reason of at least 10 characters.",
      DISCUSSION_PERIOD_RUNNING: "The discussion period has not ended yet.",
      NEEDS_TWO_OPTIONS: "A vote needs at least two options.",
      FEASIBILITY_NOT_RUN: "Run the feasibility check first.",
      NOT_FEASIBLE: "The feasibility check failed. Revise the proposal or cancel it with a reason.",
      SIGNOFFS_MISSING: "Organizer, venue manager and specialist sign-offs are all required.",
    } as Record<string, string>
  )[code] ?? "Not allowed.";
}

async function addVersion(req: Request, db: DaoDb, dao: EventDao, p: Principal, prop: Proposal, now: number) {
  if (prop.authorUid !== p.uid || !p.staked) return fail(403, "FORBIDDEN", "Only the author (with a locked stake) can revise a proposal.");
  if (!["DRAFT", "DISCUSSION", "RE_REVIEW"].includes(prop.state)) return fail(409, "LOCKED_VERSION", "Proposals cannot change after review starts.");
  const r = await body(req, z.object({ description: z.string().trim().min(20).max(6000), proposedChange: z.string().trim().min(10).max(2000), estimatedCost: z.number().min(0).max(10_000_000), note: z.string().trim().max(300).optional() }));
  if (!r.ok) return r.res;
  const prev = prop.versions.at(-1)!;
  prop.versions.push({ ...prev, ...r.data, version: prev.version + 1, createdAt: now, authorUid: p.uid! });
  logActivity(db, dao.id, p.uid!, "proposal.revised", prop.id, { version: prev.version + 1 }, now);
  return ok({ proposal: proposalView(db, prop, p, now) });
}

function feasibility(db: DaoDb, dao: EventDao, p: Principal, prop: Proposal, now: number) {
  if (!can(p, "feasibility")) return deny(p, "feasibility");
  if (prop.state !== "FEASIBILITY_CHECK") return fail(409, "WRONG_STATE", "Feasibility runs during the feasibility check stage.");
  const vote = prop.voteId ? db.votes.find((v) => v.id === prop.voteId) : undefined;
  const winnerConcept = vote?.result?.winner ? vote.options.find((o) => o.id === vote.result!.winner)?.conceptId : prop.conceptIds[0];
  const concept = winnerConcept ? db.concepts.find((c) => c.id === winnerConcept) : undefined;
  const ev = getEvent(dao.eventId)!;
  const cur = prop.versions.at(-1)!;
  const spec = concept?.versions.at(-1)!.spec;
  const est = concept ? concept.versions.at(-1)!.estimate.high : cur.estimatedCost;
  prop.feasibility = { ...runFeasibility({ venue: db.venues.get(dao.id)!, spec, estimatedCost: Math.max(est, cur.estimatedCost), expectedAttendance: ev.capacity, eventStartsAt: Date.parse(ev.startsAt), now, permits: db.permits.get(dao.id) ?? [], suppliers: db.suppliers.get(dao.id) ?? [] }), signoffs: [] };
  logActivity(db, dao.id, p.uid!, "feasibility.run", prop.id, { overall: prop.feasibility.overall }, now);
  return ok({ proposal: proposalView(db, prop, p, now) });
}

async function signoff(req: Request, db: DaoDb, dao: EventDao, p: Principal, prop: Proposal, now: number) {
  if (!can(p, "feasibility")) return deny(p, "feasibility");
  if (!prop.feasibility || prop.state !== "FEASIBILITY_CHECK") return fail(409, "FEASIBILITY_NOT_RUN", "Run the feasibility check first.");
  if (prop.feasibility.overall === "not_feasible") return fail(409, "NOT_FEASIBLE", "Cannot sign off a design that failed the check.");
  const r = await body(req, z.object({ role: z.enum(["organizer", "venue_manager", "specialist"]), note: z.string().trim().max(300).optional() }));
  if (!r.ok) return r.res;
  if (prop.feasibility.signoffs.some((s) => s.role === r.data.role)) return fail(409, "ALREADY_SIGNED", "This role already signed off.");
  // In the demo the organizer records the venue manager / specialist sign-off on their behalf, clearly marked.
  prop.feasibility.signoffs.push({ role: r.data.role, uid: p.uid!, at: now, note: r.data.note, demoStandIn: r.data.role !== "organizer" });
  logActivity(db, dao.id, p.uid!, "feasibility.signoff", prop.id, { role: r.data.role, demoStandIn: r.data.role !== "organizer" }, now);
  return ok({ proposal: proposalView(db, prop, p, now) });
}

async function executionReport(req: Request, db: DaoDb, dao: EventDao, p: Principal, prop: Proposal, now: number) {
  if (!p.roles.includes("organizer")) return deny(p, "manage_settings");
  const r = await body(req, z.object({ message: z.string().trim().min(10).max(2000) }));
  if (!r.ok) return r.res;
  prop.executionReport = { at: now, byUid: p.uid!, status: prop.state === "COMPLETED" ? "done" : "executing", message: r.data.message };
  logActivity(db, dao.id, p.uid!, "proposal.execution_report", prop.id, {}, now);
  return ok({ proposal: proposalView(db, prop, p, now) });
}

/* ---------------- votes ---------------- */

async function ballot(req: Request, db: DaoDb, dao: EventDao, p: Principal, vote: DaoVote, now: number) {
  if (!can(p, "vote")) return deny(p, "vote");
  // 8.0 accounts: an account whose email isn't confirmed never votes. With a real database (production
  // mode) a confirmed account is required. Voting weight still comes only from the staking snapshot:
  // the alien, its cosmetics and the profile never change it.
  const account = await userFromRequest(req);
  if (account && !account.emailVerified) return fail(403, "EMAIL_NOT_VERIFIED", "Confirm your email to vote.");
  if (!account && authConfig().mode === "production") return fail(401, "SIGN_IN_REQUIRED", "Sign in with a confirmed account to vote.");
  const limited = limitWrite(req, `ballot:${p.uid}`, 20);
  if (limited) return limited;
  const r = await body(req, z.object({ choice: z.array(z.string().max(40)).min(1).max(8), proposalVersion: z.number().int().positive() }));
  if (!r.ok) return r.res;
  maybeFinalize(db, vote, now);
  if (r.data.proposalVersion !== vote.proposalVersion) return fail(409, "STALE_VERSION", "The proposal version changed. Reload before voting.");
  const res = castBallot(vote, db.ballots, p.uid!, r.data.choice, now, { flagged: !!p.membership?.flagged, id: nextId(db, "bal") });
  if (!res.ok) {
    const map: Record<string, [number, string]> = {
      VOTE_NOT_OPEN: [409, "Voting has not started."],
      VOTE_CLOSED: [409, "Voting has ended."],
      NOT_IN_SNAPSHOT: [403, "You were not eligible when this vote's snapshot was taken."],
      ALREADY_VOTED: [409, "You already voted. Ballots are final."],
      INVALID_CHOICE: [400, "Choose a valid option."],
    };
    return fail(map[res.code][0], res.code, map[res.code][1]);
  }
  db.ballots.push(res.receipt);
  const xp = award(db, p.membership, "vote", now, { target: vote.id });
  logActivity(db, dao.id, p.uid!, "vote.ballot_cast", vote.id, { receipt: res.receipt.hash, held: res.receipt.held }, now);
  return ok({ receipt: { id: res.receipt.id, hash: res.receipt.hash, castAt: res.receipt.castAt, choice: res.receipt.choice, held: res.receipt.held }, vote: voteView(db, vote, p, now), xp }, 201);
}

/* ---------------- media ---------------- */

async function upload(req: Request, db: DaoDb, dao: EventDao, p: Principal, now: number) {
  if (!p.uid) return deny(p, "post");
  const limited = limitWrite(req, `upload:${p.uid}`, 20, 600_000);
  if (limited) return limited;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "INVALID_FORM", "Send multipart/form-data.");
  }
  const purpose = String(form.get("purpose") ?? "attachment");
  if (purpose === "venue" ? !can(p, "upload_venue_photo") : !can(p, "post")) return deny(p, purpose === "venue" ? "upload_venue_photo" : "post");
  const files = form.getAll("file").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (!files.length) return fail(400, "NO_FILE", "Attach at least one file.");
  if (files.length > DAO_RULES.maxPhotosPerUpload) return fail(400, "TOO_MANY_FILES", `Upload at most ${DAO_RULES.maxPhotosPerUpload} files at once.`);
  const visibility = purpose === "venue" ? (String(form.get("visibility") ?? "members") === "public" ? "public" : "members") : "members";
  const out: { id: string; url: string; width: number; height: number; bytes: number }[] = [];
  const errors: { name: string; code: string; message: string }[] = [];
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const v = validateImage(bytes, f.type, purpose === "venue" ? DAO_RULES.maxUploadBytes : DAO_RULES.maxAttachmentBytes);
    if (!v.ok) {
      errors.push({ name: f.name.slice(0, 80), code: v.code, message: UPLOAD_ERROR_TEXT[v.code] });
      continue;
    }
    const id = nextId(db, "media");
    db.media.set(id, { meta: { id, daoId: dao.id, ownerUid: p.uid, mime: v.mime, bytes: bytes.length, width: v.width, height: v.height, visibility, createdAt: now, sha256: sha256(bytes) }, data: bytes });
    out.push({ id, url: mediaUrl(id), width: v.width, height: v.height, bytes: bytes.length });
  }
  if (out.length) logActivity(db, dao.id, p.uid, "media.uploaded", out.map((o) => o.id).join(","), { purpose, count: out.length }, now);
  if (!out.length) return fail(422, errors[0].code, errors.map((e) => `${e.name}: ${e.message}`).join(" "), { errors });
  return ok({ files: out, errors, storage: "demo-memory" }, 201);
}

function serveMedia(req: Request, id: string) {
  const db = getDb();
  const m = db.media.get(id);
  if (!m) return fail(404, "NOT_FOUND", "No such file.");
  const dao = [...db.daos.values()].find((d) => d.id === m.meta.daoId);
  const p = dao ? principalFor(db, dao, sessionOf(req)) : ANON;
  if (!canSeeMedia(p, m.meta)) return fail(p.uid ? 403 : 401, "FORBIDDEN", "You cannot view this file.");
  const data = typeof m.data === "string" ? new TextEncoder().encode(m.data) : m.data;
  return new Response(data as unknown as BodyInit, {
    headers: {
      "Content-Type": m.meta.mime,
      "Cache-Control": m.meta.visibility === "public" ? "public, max-age=3600" : "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

/* ---------------- stage designer ---------------- */

function stageHome(db: DaoDb, dao: EventDao, p: Principal) {
  const photos = db.photos.filter((x) => x.daoId === dao.id && (canSeeMedia(p, db.media.get(x.mediaId)!.meta)));
  return ok({
    venue: db.venues.get(dao.id),
    photos: photos.map((x) => ({ ...x, url: mediaUrl(x.mediaId), generated: !!db.media.get(x.mediaId)?.meta.generated })),
    projects: db.projects.filter((x) => x.daoId === dao.id).map((x) => ({ ...x, concepts: x.conceptIds.map((id) => db.concepts.find((c) => c.id === id)).filter((c) => c && (c.published || c.creatorUid === p.uid)).map((c) => conceptView(db, c!)) })),
    provider: imageModelConfigured() ? "image-model" : "demo-compositor",
    can: { upload: can(p, "upload_venue_photo"), generate: can(p, "generate_concept"), edit: can(p, "edit_concept"), publish: can(p, "publish_concept"), verify: can(p, "verify_venue_rights") },
    deny: can(p, "generate_concept") ? null : denyReason(p, "generate_concept"),
  });
}

async function addPhoto(req: Request, db: DaoDb, dao: EventDao, p: Principal, now: number) {
  if (!can(p, "upload_venue_photo")) return deny(p, "upload_venue_photo");
  const r = await body(req, z.object({ mediaId: z.string().max(80), caption: z.string().trim().min(3).max(160), stageZone: zZone, ceilingY: z.number().min(0).max(0.9), rightsBasis: z.enum(["owner", "licensed", "organizer_contract"]), attest: z.literal(true) }));
  if (!r.ok) return r.res;
  const m = db.media.get(r.data.mediaId);
  if (!m || m.meta.daoId !== dao.id || m.meta.ownerUid !== p.uid) return fail(400, "INVALID_MEDIA", "Upload the photo to this DAO first.");
  if (db.photos.some((x) => x.mediaId === r.data.mediaId)) return fail(409, "ALREADY_REGISTERED", "Photo already registered.");
  const zone = r.data.stageZone;
  if (zone.x + zone.w > 1.001 || zone.y + zone.h > 1.001) return fail(400, "ZONE_OUT_OF_BOUNDS", "Stage zone must be inside the photo.");
  const photo = { id: nextId(db, "photo"), daoId: dao.id, mediaId: r.data.mediaId, caption: r.data.caption, uploadedBy: p.uid!, uploadedAt: now, stageZone: zone, ceilingY: r.data.ceilingY, rights: { attestedBy: p.uid!, attestedAt: now, basis: r.data.rightsBasis, status: "self_attested" as const } };
  db.photos.push(photo);
  logActivity(db, dao.id, p.uid!, "venue.photo_registered", photo.id, { rights: r.data.rightsBasis, status: "self_attested" }, now);
  return ok({ photo: { ...photo, url: mediaUrl(photo.mediaId) } }, 201);
}

function verifyPhoto(db: DaoDb, dao: EventDao, p: Principal, id: string, now: number) {
  if (!can(p, "verify_venue_rights")) return deny(p, "verify_venue_rights");
  const ph = db.photos.find((x) => x.id === id && x.daoId === dao.id);
  if (!ph) return fail(404, "NOT_FOUND", "Unknown photo.");
  ph.rights = { ...ph.rights, status: "verified", verifiedBy: p.uid! };
  logActivity(db, dao.id, p.uid!, "venue.rights_verified", id, {}, now);
  return ok({ photo: ph });
}

async function createProject(req: Request, db: DaoDb, dao: EventDao, p: Principal, now: number) {
  if (!can(p, "generate_concept")) return deny(p, "generate_concept");
  const r = await body(req, z.object({ venue: zVenue, photoIds: z.array(z.string().max(80)).min(1).max(8), theme: z.enum(STAGE_THEMES), customTheme: z.string().trim().max(200).optional() }));
  if (!r.ok) return r.res;
  if (r.data.theme === "custom" && !(r.data.customTheme && r.data.customTheme.length >= 3)) return fail(400, "CUSTOM_THEME_REQUIRED", "Describe the custom theme.");
  const photos = r.data.photoIds.map((id) => db.photos.find((x) => x.id === id && x.daoId === dao.id));
  if (photos.some((x) => !x)) return fail(400, "INVALID_PHOTO", "Choose registered venue photos.");
  if (photos.some((x) => x!.rights.status === "rejected")) return fail(403, "RIGHTS_REJECTED", "A photo's usage rights were rejected.");
  const proj = { id: nextId(db, "proj"), daoId: dao.id, createdBy: p.uid!, createdAt: now, venue: r.data.venue, photoIds: r.data.photoIds, theme: r.data.theme, customTheme: r.data.customTheme, conceptIds: [] as string[] };
  db.projects.push(proj);
  logActivity(db, dao.id, p.uid!, "stage.project_created", proj.id, { theme: proj.theme }, now);
  return ok({ project: proj }, 201);
}

async function generate(req: Request, db: DaoDb, dao: EventDao, p: Principal, projectId: string, now: number) {
  if (!can(p, "generate_concept")) return deny(p, "generate_concept");
  const proj = db.projects.find((x) => x.id === projectId && x.daoId === dao.id);
  if (!proj) return fail(404, "NOT_FOUND", "Unknown project.");
  const limited = limitWrite(req, `gen:${p.uid}`, 10, 600_000);
  if (limited) return limited;
  const r = await body(req, z.object({ count: z.number().int().min(3).max(5).default(4), photoId: z.string().max(80) }));
  if (!r.ok) return r.res;
  if (!proj.photoIds.includes(r.data.photoId)) return fail(400, "INVALID_PHOTO", "Pick one of the project's photos.");
  if (imageModelConfigured()) return fail(501, "IMAGE_MODEL_NOT_IMPLEMENTED", "The image-model adapter is configured but not implemented in this build.");
  const specs = generateConceptSpecs(proj.theme, r.data.count, `${proj.id}:${r.data.photoId}:${now}`, proj.venue);
  const handle = p.membership?.handle ?? "organizer";
  const created = specs.map((s, i) => {
    const c: StageConcept = { id: nextId(db, "concept"), projectId: proj.id, daoId: dao.id, name: s.name, theme: proj.theme, creatorUid: p.uid!, creatorHandle: handle, description: proj.customTheme ? `${proj.customTheme}: ${s.description}` : s.description, photoId: r.data.photoId, versions: [{ ...newVersion(null, s.spec, proj.venue, proj.theme, p.uid!, now + i), prompt: buildPrompt(proj.theme, s.spec, proj.venue, proj.customTheme) }], published: false, createdAt: now + i };
    db.concepts.push(c);
    proj.conceptIds.push(c.id);
    return c;
  });
  logActivity(db, dao.id, p.uid!, "stage.concepts_generated", proj.id, { count: created.length, provider: "demo-compositor" }, now);
  return ok({ concepts: created.map((c) => conceptView(db, c)), provider: "demo-compositor" }, 201);
}

async function editConcept(req: Request, db: DaoDb, dao: EventDao, p: Principal, id: string, now: number) {
  const c = db.concepts.find((x) => x.id === id && x.daoId === dao.id);
  if (!c || (!c.published && c.creatorUid !== p.uid)) return fail(404, "NOT_FOUND", "Unknown concept.");
  if (!(can(p, "edit_concept") || (c.creatorUid === p.uid && can(p, "generate_concept")))) return deny(p, "edit_concept");
  const limited = limitWrite(req, `edit:${p.uid}`, 20, 600_000);
  if (limited) return limited;
  const r = await body(req, z.object({ instruction: z.string().trim().min(3).max(500).optional(), revertTo: z.number().int().positive().optional() }));
  if (!r.ok) return r.res;
  const venue = db.projects.find((x) => x.id === c.projectId)?.venue ?? db.venues.get(dao.id)!;
  const prev = c.versions.at(-1)!;
  let v;
  if (r.data.revertTo) {
    const old = c.versions.find((x) => x.version === r.data.revertTo);
    if (!old) return fail(404, "VERSION_NOT_FOUND", "Unknown version.");
    v = newVersion(prev, old.spec, venue, c.theme, p.uid!, now, { instruction: `Restore version ${old.version}`, applied: [`Restored v${old.version}`] });
  } else if (r.data.instruction) {
    const bad = moderateText(r.data.instruction);
    if (bad) return fail(422, bad, "This instruction breaks the community rules.");
    const res = applyInstruction(prev.spec, r.data.instruction);
    if (!res.applied.length) return fail(422, "INSTRUCTION_NOT_UNDERSTOOD", "The editor could not map this request to a change. Try e.g. “make the alien bigger” or “add LED screens left and right”.", { ignored: res.ignored });
    v = newVersion(prev, res.spec, venue, c.theme, p.uid!, now, { instruction: r.data.instruction, applied: res.applied, ignored: res.ignored });
  } else return fail(400, "INVALID_INPUT", "Send an instruction or a version to restore.");
  c.versions.push(v);
  c.description = describe(c.theme, v.spec);
  award(db, p.membership, "edit", now, { contentHash: sha256((r.data.instruction ?? "").toLowerCase()) });
  logActivity(db, dao.id, p.uid!, "stage.concept_edited", c.id, { version: v.version, base: prev.version }, now);
  return ok({ concept: conceptView(db, c) });
}

function publishConcept(db: DaoDb, dao: EventDao, p: Principal, id: string, now: number) {
  const c = db.concepts.find((x) => x.id === id && x.daoId === dao.id);
  if (!c) return fail(404, "NOT_FOUND", "Unknown concept.");
  if (c.creatorUid !== p.uid) return fail(403, "FORBIDDEN", "Only the creator can publish this concept.");
  if (!can(p, "publish_concept")) return deny(p, "publish_concept");
  if (c.published) return fail(409, "ALREADY_PUBLISHED", "Already in the gallery.");
  c.published = true;
  const d: Discussion = { id: nextId(db, "disc"), daoId: dao.id, category: "stage_design", title: `Stage concept: ${c.name}`, body: `${c.description}\n\nAI CONCEPT / NOT A CONSTRUCTION PLAN. Budget shown is an AI reference estimate.`, authorUid: p.uid!, authorHandle: c.creatorHandle, createdAt: now, lastActivityAt: now, visibility: "public", pinned: false, locked: false, hidden: false, attachments: [], proposalIds: [], reactions: {}, reports: [], commentCount: 0, conceptId: c.id };
  db.discussions.push(d);
  c.discussionId = d.id;
  const xp = award(db, p.membership, "concept", now, { target: c.id });
  logActivity(db, dao.id, p.uid!, "stage.concept_published", c.id, {}, now);
  return ok({ concept: conceptView(db, c), xp });
}

/* ---------------- treasury ---------------- */

function treasury(db: DaoDb, dao: EventDao, p: Principal) {
  const accounts = db.accounts.filter((x) => x.daoId === dao.id);
  const items = db.budget.filter((x) => x.daoId === dao.id);
  const payments = db.payments.filter((x) => x.daoId === dao.id);
  const membersView = can(p, "read_members");
  return ok({
    summary: summarize(accounts, items, payments),
    accounts,
    budget: items.map((b) => ({ ...b, committed: payments.filter((x) => x.budgetItemId === b.id && x.status !== "rejected").reduce((a, x) => a + x.amount, 0) })),
    payments: membersView ? payments.map((x) => ({ ...x, evidence: x.evidenceMediaIds.map((m) => ({ id: m, url: mediaUrl(m) })) })) : null,
    paymentsEnabled: paymentsEnabled(),
    tiers: DAO_RULES.approvalTiers.map((t) => ({ below: Number.isFinite(t.below) ? t.below : null, approvals: t.approvals, roles: t.roles })),
    can: { request: can(p, "request_payment"), approve: can(p, "approve_payment") },
    roles: p.roles,
  });
}

async function requestPayment(req: Request, db: DaoDb, dao: EventDao, p: Principal, now: number) {
  if (!can(p, "request_payment")) return deny(p, "request_payment");
  const r = await body(req, z.object({ budgetItemId: z.string().max(80), amount: z.number().positive().max(10_000_000), payee: z.string().trim().min(2).max(120), memo: z.string().trim().min(3).max(300), fromAccount: z.enum(["staking_escrow", "event_budget", "ticket_revenue", "sponsors"]), evidenceMediaIds: z.array(z.string().max(80)).max(5).default([]) }));
  if (!r.ok) return r.res;
  const accounts = db.accounts.filter((x) => x.daoId === dao.id);
  const err = validateRequest(r.data.amount, r.data.fromAccount, r.data.budgetItemId, accounts, db.budget.filter((x) => x.daoId === dao.id), db.payments.filter((x) => x.daoId === dao.id));
  if (err) return fail(err === "STAKE_FUNDS_LOCKED" ? 403 : 409, err, { STAKE_FUNDS_LOCKED: "Staked tokens are member principal and can never pay event costs.", UNKNOWN_BUDGET_ITEM: "Unknown budget line.", OVER_BUDGET_ITEM: "This would exceed the budget line.", INSUFFICIENT_FUNDS: "Not enough uncommitted operating funds.", INVALID_AMOUNT: "Invalid amount." }[err]);
  for (const m of r.data.evidenceMediaIds) if (db.media.get(m)?.meta.daoId !== dao.id) return fail(400, "INVALID_EVIDENCE", "Evidence must be uploaded to this DAO.");
  const pay = newRequest({ id: nextId(db, "pay"), daoId: dao.id, budgetItemId: r.data.budgetItemId, fromAccount: r.data.fromAccount, payee: r.data.payee, amount: r.data.amount, memo: r.data.memo, requestedBy: p.uid!, requestedAt: now, evidenceMediaIds: r.data.evidenceMediaIds });
  db.payments.push(pay);
  logActivity(db, dao.id, p.uid!, "treasury.payment_requested", pay.id, { amount: pay.amount, approvals: pay.requiredApprovals }, now);
  return ok({ payment: pay }, 201);
}

function approvePayment(db: DaoDb, dao: EventDao, p: Principal, id: string, now: number) {
  if (!can(p, "approve_payment")) return deny(p, "approve_payment");
  const i = db.payments.findIndex((x) => x.id === id);
  const r = approve(db.payments[i], p.uid!, p.roles, now);
  if (!r.ok) return fail(409, r.code, { NOT_PENDING: "Payment is not pending.", SELF_APPROVAL: "Requesters cannot approve their own payment.", ALREADY_APPROVED: "You already approved.", ROLE_NOT_REQUIRED: "Your role is not one of the required approvers.", ROLE_ALREADY_COVERED: "Another person with your role already approved." }[r.code]);
  db.payments[i] = r.payment;
  logActivity(db, dao.id, p.uid!, "treasury.payment_approved", id, { approvals: r.payment.approvals.length, of: r.payment.requiredApprovals }, now);
  return ok({ payment: r.payment });
}

function executePayment(db: DaoDb, dao: EventDao, p: Principal, id: string, now: number) {
  if (!p.roles.includes("organizer") && !p.roles.includes("treasurer")) return deny(p, "request_payment");
  const pay = db.payments.find((x) => x.id === id)!;
  if (pay.status !== "approved") return fail(409, "NOT_APPROVED", "All required approvals are needed first.");
  if (!pay.evidenceMediaIds.length) return fail(409, "EVIDENCE_REQUIRED", "Attach an invoice or quote before paying.");
  if (paymentsEnabled()) return fail(501, "PAYMENT_RAIL_NOT_IMPLEMENTED", "No payment rail is implemented in this build.");
  pay.status = "executed_demo";
  pay.executedAt = now;
  logActivity(db, dao.id, p.uid!, "treasury.payment_recorded_demo", id, { amount: pay.amount, fundsMoved: false }, now);
  return ok({ payment: pay, fundsMoved: false, note: "Demo: recorded only. No money or tokens moved." });
}

/* ---------------- roadmap / members / settings ---------------- */

/** Stage design the DAO approved (vote won and the proposal moved on), or null. Used by the world map landmark. */
export function approvedStageDesign(eventId: string) {
  const db = getDb();
  const dao = db.daos.get(eventId);
  if (!dao) return null;
  const c = winningConcept(db, dao);
  if (!c) return null;
  const spec = c.versions.at(-1)!.spec;
  return { conceptId: c.id, name: c.name, theme: c.theme, palette: spec.palette, booth: spec.booth, installation: spec.installation, lasers: spec.lasers };
}

function winningConcept(db: DaoDb, dao: EventDao) {
  return db.proposals
    .filter((x) => x.daoId === dao.id && x.conceptIds.length && ["APPROVED", "FEASIBILITY_CHECK", "ORGANIZER_CONFIRMATION", "EXECUTION", "COMPLETED"].includes(x.state))
    .map((x) => {
      const v = x.voteId ? db.votes.find((y) => y.id === x.voteId) : undefined;
      const cid = v?.result?.winner ? v.options.find((o) => o.id === v.result!.winner)?.conceptId : undefined;
      return cid ? db.concepts.find((c) => c.id === cid) : undefined;
    })
    .find(Boolean);
}

function roadmap(db: DaoDb, dao: EventDao, p: Principal) {
  const ev = getEvent(dao.eventId)!;
  const proposals = db.proposals.filter((x) => x.daoId === dao.id);
  const photos = db.photos.filter((x) => x.daoId === dao.id);
  const milestones = db.milestones.filter((x) => x.daoId === dao.id).sort((a, b) => a.due - b.due);
  const level = gameLevel(dao, photos, proposals, milestones, ev.status);
  const winner = proposals
    .filter((x) => x.conceptIds.length && ["APPROVED", "FEASIBILITY_CHECK", "ORGANIZER_CONFIRMATION", "EXECUTION", "COMPLETED"].includes(x.state))
    .map((x) => {
      const v = x.voteId ? db.votes.find((y) => y.id === x.voteId) : undefined;
      const cid = v?.result?.winner ? v.options.find((o) => o.id === v.result!.winner)?.conceptId : undefined;
      return cid ? db.concepts.find((c) => c.id === cid) : undefined;
    })
    .find(Boolean);
  const leading = (() => {
    const v = db.votes.find((x) => x.daoId === dao.id && x.status === "open" && x.options.some((o) => o.conceptId));
    if (!v) return undefined;
    const lc = liveCounts(v, db.ballots).counts;
    const top = Object.entries(lc).sort((a, b) => b[1] - a[1])[0]?.[0];
    const cid = v.options.find((o) => o.id === top)?.conceptId;
    return cid ? db.concepts.find((c) => c.id === cid) : undefined;
  })();
  const xpTop = membersOf(db, dao).sort((a, b) => b.xp - a.xp).slice(0, 5).map((m) => ({ handle: m.handle, xp: m.xp, badges: m.badges }));
  return ok({ level, milestones, event: eventCard(dao.eventId), stageConcept: winner ? conceptView(db, winner) : null, leadingConcept: !winner && leading ? conceptView(db, leading) : null, leaderboard: xpTop, canEdit: p.roles.includes("organizer") });
}

async function updateMilestone(req: Request, db: DaoDb, dao: EventDao, p: Principal, id: string, now: number) {
  if (!p.roles.includes("organizer")) return deny(p, "manage_settings");
  const ms = db.milestones.find((x) => x.id === id && x.daoId === dao.id);
  if (!ms) return fail(404, "NOT_FOUND", "Unknown milestone.");
  const r = await body(req, z.object({ status: z.enum(["todo", "doing", "done", "blocked"]), note: z.string().trim().max(300).optional() }));
  if (!r.ok) return r.res;
  ms.status = r.data.status;
  ms.note = r.data.note;
  logActivity(db, dao.id, p.uid!, "roadmap.milestone", id, { status: ms.status }, now);
  return ok({ milestone: ms });
}

function members(req: Request, db: DaoDb, dao: EventDao, p: Principal) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").toLowerCase().slice(0, 40);
  const page = Math.max(1, Number(u.searchParams.get("page") ?? 1) || 1);
  const staff = can(p, "moderate");
  let list = membersOf(db, dao);
  if (q) list = list.filter((m) => m.handle.toLowerCase().includes(q));
  list = [...list].sort((a, b) => Number(b.roles.length > 1) - Number(a.roles.length > 1) || b.xp - a.xp);
  const size = 40;
  return ok({
    total: list.length,
    page,
    pageSize: size,
    flaggedCount: staff ? membersOf(db, dao).filter((m) => m.flagged).length : undefined,
    members: list.slice((page - 1) * size, page * size).map((m) => ({ uid: staff ? m.uid : undefined, handle: m.handle, roles: m.roles, joinedAt: m.joinedAt, xp: m.xp, badges: m.badges, flagged: staff && m.flagged ? m.flagged.reason : undefined, isMe: m.uid === p.uid })),
    canModerate: staff,
    onePersonOneVote: "Votes are one per account. Wallets never add weight. Accounts sharing a device, funding source or a burst of sign-ups are flagged and their ballots held for review. Without identity verification this cannot guarantee one human = one vote.",
  });
}

async function updateSettings(req: Request, db: DaoDb, dao: EventDao, p: Principal, now: number) {
  if (!can(p, "manage_settings")) return deny(p, "manage_settings");
  const r = await body(
    req,
    z.object({
      tokenContract: zAddress.optional(),
      stakingContract: zAddress.optional(),
      chainId: z.number().int().positive().optional(),
      minimumStake: z.number().min(1).max(1_000_000).optional(),
      lockDurationDays: z.number().int().min(7).max(365).optional(),
      votingStartAt: z.number().int().optional(),
      votingEndAt: z.number().int().optional(),
      unstakingRules: z.string().trim().min(10).max(500).optional(),
      defaultQuorum: z.number().min(0.05).max(1).optional(),
      defaultThreshold: z.number().min(0.5).max(1).optional(),
      discussionDays: z.number().int().min(1).max(14).optional(),
      votingDays: z.number().int().min(1).max(14).optional(),
    }),
  );
  if (!r.ok) return r.res;
  const x = r.data;
  if (x.chainId !== undefined && !allowedChainIds().includes(x.chainId)) return fail(400, "CHAIN_NOT_ALLOWED", "Chain id is not on the allowlist.");
  if (x.votingStartAt && x.votingEndAt && x.votingEndAt <= x.votingStartAt) return fail(400, "INVALID_WINDOW", "Voting must end after it starts.");
  const openVotes = db.votes.some((v) => v.daoId === dao.id && v.status === "open");
  if (openVotes && (x.minimumStake !== undefined || x.chainId !== undefined || x.stakingContract !== undefined)) return fail(409, "VOTE_IN_PROGRESS", "Eligibility settings cannot change while a vote is open. Open votes keep their snapshot.");
  const before = { ...dao.config };
  dao.config = { ...dao.config, ...(x as Partial<typeof dao.config>) };
  logActivity(db, dao.id, p.uid!, "settings.updated", dao.id, { changed: Object.keys(x).filter((k) => (before as unknown as Record<string, unknown>)[k] !== (x as Record<string, unknown>)[k]) }, now);
  return ok({ config: dao.config });
}

/* ---------------- notifications ---------------- */

function notifications(req: Request, now: number) {
  const s = sessionOf(req);
  if (!s) return ok({ items: [], signedIn: false });
  const db = getDb();
  const mine = db.members.filter((m) => m.uid === s.uid);
  const items: { id: string; at: number; title: string; body: string; href: string }[] = [];
  for (const m of mine) {
    const dao = [...db.daos.values()].find((d) => d.id === m.daoId)!;
    const ev = getEvent(dao.eventId)!;
    for (const a of db.activity.filter((x) => x.daoId === dao.id && x.at >= m.joinedAt - 86_400_000 && now - x.at < 30 * 86_400_000)) {
      if (a.action === "vote.opened") items.push({ id: a.id, at: a.at, title: `${ev.name}: new DAO vote`, body: "A proposal moved to voting.", href: `/dao/${dao.eventId}/votes` });
      if (a.action === "comment.created" && a.detail?.notify === s.uid && a.actorUid !== s.uid) items.push({ id: a.id, at: a.at, title: `${ev.name}: new reply`, body: "Someone replied to your thread.", href: `/dao/${dao.eventId}/discussion?thread=${a.target}` });
      if (a.action === "proposal.transition" && db.proposals.find((x) => x.id === a.target)?.authorUid === s.uid) items.push({ id: a.id, at: a.at, title: `${ev.name}: your proposal moved`, body: `Now ${String(a.detail?.to ?? "")}.`, href: `/dao/${dao.eventId}/proposals/${a.target}` });
      if (a.action === "vote.finalized") items.push({ id: a.id, at: a.at, title: `${ev.name}: vote result`, body: `Outcome: ${String(a.detail?.outcome ?? "")}.`, href: `/dao/${dao.eventId}/votes` });
    }
  }
  return ok({ items: items.sort((a, b) => b.at - a.at).slice(0, 30), signedIn: true });
}
