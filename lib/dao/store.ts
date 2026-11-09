/**
 * DEMO DAO store: an in-memory database seeded with fictional sample DAOs.
 * It lives on the server (per instance) and is reset when the instance restarts.
 * Production must replace it with Postgres (db/migrations/0002_festival_dao.sql);
 * with DAO_DATA_MODE=production the API answers 503 instead of using this store.
 */
import { DJS, EVENTS, getEvent, getVenue } from "@/lib/data";
import { sha256, stableJson } from "./hash";
import { DEMO_CHAIN, DEMO_STAKING, DEMO_TOKEN } from "./meta";
import { PLATE_GEOMETRY, plateSvg, type PlateKind } from "./plates";
import { generateConceptSpecs, newVersion } from "./stage";
import { takeSnapshot, tally, castBallot } from "./voting";
import { runFeasibility } from "./feasibility";
import { newRequest } from "./treasury";
import type { XpEvent } from "./game";
import type { AccountSignals } from "./sybil";
import type {
  ActivityLog,
  BallotReceipt,
  BudgetItem,
  DaoComment,
  DaoMembership,
  DaoVote,
  Discussion,
  DiscussionCategory,
  EventDao,
  MediaObject,
  Milestone,
  ModerationLog,
  PaymentRequest,
  Proposal,
  ProposalState,
  ReactionKind,
  StageConcept,
  StageDesignProject,
  StakePosition,
  TreasuryAccount,
  VenuePhoto,
  VenueSpec,
  Visibility,
  VotingMethod,
  VoteOption,
} from "./types";

export interface DaoDb {
  daos: Map<string, EventDao>; // by eventId
  positions: StakePosition[];
  members: DaoMembership[];
  discussions: Discussion[];
  comments: DaoComment[];
  proposals: Proposal[];
  votes: DaoVote[];
  ballots: BallotReceipt[];
  media: Map<string, { meta: MediaObject; data: Uint8Array | string }>;
  photos: VenuePhoto[];
  projects: StageDesignProject[];
  concepts: StageConcept[];
  accounts: TreasuryAccount[];
  budget: BudgetItem[];
  payments: PaymentRequest[];
  milestones: Milestone[];
  activity: ActivityLog[];
  moderation: ModerationLog[];
  xp: XpEvent[];
  signals: Map<string, AccountSignals>;
  venues: Map<string, VenueSpec>; // by daoId
  permits: Map<string, { name: string; status: "granted" | "pending" | "not_applied" }[]>;
  suppliers: Map<string, { item: string; confirmed: boolean }[]>;
  seededAt: number;
  seq: number;
}

const DAY = 86_400_000;
const g = globalThis as unknown as { __fkDaoDb?: DaoDb };

export function getDb(): DaoDb {
  if (!g.__fkDaoDb) g.__fkDaoDb = seed(Date.now());
  return g.__fkDaoDb;
}

/** Test helper: reseed at a given time. */
export function _resetDb(now = Date.now()) {
  g.__fkDaoDb = seed(now);
  return g.__fkDaoDb;
}

export const nextId = (db: DaoDb, prefix: string) => `${prefix}_${(++db.seq).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export function logActivity(db: DaoDb, daoId: string, actorUid: string, action: string, target?: string, detail?: Record<string, unknown>, at = Date.now()) {
  const prev = [...db.activity].reverse().find((a) => a.daoId === daoId)?.hash ?? "genesis";
  const entry = { id: nextId(db, "act"), daoId, at, actorUid, action, target, detail, prevHash: prev };
  const hash = sha256(stableJson(entry));
  db.activity.push({ ...entry, hash });
}

export function verifyActivityChain(db: DaoDb, daoId: string) {
  let prev = "genesis";
  for (const a of db.activity.filter((x) => x.daoId === daoId)) {
    const { hash, ...rest } = a;
    if (a.prevHash !== prev || sha256(stableJson(rest)) !== hash) return false;
    prev = hash;
  }
  return true;
}

/* ---------------- seed ---------------- */

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HANDLE_A = ["slime", "ooze", "kaiju", "jelly", "spore", "neon", "bass", "void", "glitch", "fuzz", "orbit", "mutant", "tentacle", "acid", "laser", "goo", "comet", "noodle"];
const HANDLE_B = ["raver", "queen", "pilot", "witch", "drifter", "monk", "kid", "bot", "goblin", "surfer", "bloom", "ghost", "panda", "wizard", "moth", "cadet"];

interface DaoSeed {
  eventId: string;
  status: EventDao["status"];
  members: number;
  plate: PlateKind;
  theme: StageConcept["theme"];
  minStake: number;
  rich: boolean;
}

const SEEDS: DaoSeed[] = [
  { eventId: "neon-slime-summit", status: "active", members: 420, plate: "warehouse", theme: "alien_invasion", minStake: 100, rich: true },
  { eventId: "bassmutant-tokyo", status: "festival", members: 260, plate: "basement", theme: "neon_industrial", minStake: 80, rich: false },
  { eventId: "void-jelly-rave", status: "active", members: 140, plate: "arch", theme: "psychedelic_jungle", minStake: 50, rich: true },
  { eventId: "glass-noodle", status: "active", members: 110, plate: "factory", theme: "underground_warehouse", minStake: 50, rich: false },
  { eventId: "kimchi-cosmos", status: "building", members: 180, plate: "hall", theme: "cosmic_portal", minStake: 60, rich: false },
  { eventId: "mothership-motel", status: "forming", members: 36, plate: "yard", theme: "mutant_carnival", minStake: 40, rich: false },
];

export const DEMO_DAO_EVENT_IDS = SEEDS.map((s) => s.eventId);

function venueSpecFor(eventId: string, plate: PlateKind): VenueSpec {
  const ev = getEvent(eventId)!;
  const v = getVenue(ev.venueId)!;
  const outdoor = plate === "yard";
  return {
    venueId: v.id,
    name: v.name,
    location: `${v.city}, ${v.country}`,
    setting: outdoor ? "outdoor" : "indoor",
    capacity: v.capacity,
    stageWidthM: Math.round(6 + Math.sqrt(v.capacity) / 4),
    stageDepthM: Math.round(4 + Math.sqrt(v.capacity) / 8),
    ceilingHeightM: outdoor ? 0 : plate === "basement" ? 3.4 : plate === "arch" ? 6.5 : plate === "hall" ? 9 : 14,
    powerKw: Math.round(40 + v.capacity / 25),
    existingEquipment: v.amenities.filter((a) => ["Funktion-One", "Void Acoustics", "CDJ-3000", "Lasers", "LED Wall", "Technics 1200"].includes(a)),
    budgetUsd: Math.round(ev.goal * 0.22),
    safetyRestrictions: plate === "basement" ? ["No haze (smoke detectors)", "No open flame", "Sound limit 102 dB"] : plate === "arch" ? ["No open flame", "Sound limit 100 dB after 02:00"] : ["No open flame indoors"],
  };
}

function seed(now: number): DaoDb {
  const db: DaoDb = {
    daos: new Map(),
    positions: [],
    members: [],
    discussions: [],
    comments: [],
    proposals: [],
    votes: [],
    ballots: [],
    media: new Map(),
    photos: [],
    projects: [],
    concepts: [],
    accounts: [],
    budget: [],
    payments: [],
    milestones: [],
    activity: [],
    moderation: [],
    xp: [],
    signals: new Map(),
    venues: new Map(),
    permits: new Map(),
    suppliers: new Map(),
    seededAt: now,
    seq: 0,
  };
  for (const s of SEEDS) seedDao(db, s, now);
  return db;
}

function seedDao(db: DaoDb, s: DaoSeed, now: number) {
  const ev = getEvent(s.eventId)!;
  const rnd = prng([...s.eventId].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const daoId = `dao_${s.eventId}`;
  const short = s.eventId.split("-")[0];
  const organizer = `u_org_${short}`;
  const treasurer = `u_treas_${short}`;
  const moderator = `u_mod_${short}`;
  const created = now - 45 * DAY;
  const dao: EventDao = {
    id: daoId,
    eventId: s.eventId,
    status: s.status,
    createdAt: created,
    organizerUid: organizer,
    description: `Community DAO for ${ev.name}. Stakers shape the stage, lighting, lineup and after party; the organizer confirms what is feasible and safe.`,
    isDemo: true,
    config: {
      tokenContract: DEMO_TOKEN,
      stakingContract: DEMO_STAKING,
      chainId: DEMO_CHAIN.id,
      tokenSymbol: "FRK (demo)",
      minimumStake: s.minStake,
      lockDurationDays: 30,
      eligibilitySnapshotAt: now - 20 * DAY,
      votingStartAt: now - 2 * DAY,
      votingEndAt: now + 5 * DAY,
      unstakingRules: "Request unstaking at any time. Tokens unlock when the 30-day lock ends. Open votes keep the snapshot taken when they started.",
      defaultQuorum: 0.2,
      defaultThreshold: 0.5,
      discussionDays: 3,
      votingDays: 7,
    },
  };
  db.daos.set(s.eventId, dao);
  const venue = venueSpecFor(s.eventId, s.plate);
  db.venues.set(daoId, venue);
  db.permits.set(daoId, [
    { name: "Event licence", status: "granted" },
    { name: s.plate === "yard" ? "Outdoor amplified sound permit" : "Late-night entertainment permit", status: s.rich ? "pending" : "granted" },
  ]);
  db.suppliers.set(daoId, [
    { item: "LED screens", confirmed: true },
    { item: "Moving heads", confirmed: true },
    { item: "Sculpture fabrication", confirmed: false },
  ]);

  // Members + stake positions
  const staff: [string, string, DaoMembership["roles"]][] = [
    [organizer, `${short}_organizer`, ["member", "organizer"]],
    [treasurer, `${short}_treasurer`, ["member", "treasurer"]],
    [moderator, `${short}_mod`, ["member", "moderator"]],
  ];
  const addMember = (uid: string, handle: string, roles: DaoMembership["roles"], joinedAt: number, amount: number) => {
    db.members.push({ daoId, uid, handle, roles, joinedAt, xp: Math.floor(rnd() * 160), badges: joinedAt < created + 10 * DAY ? ["founder"] : [], isDemo: true });
    const wallet = `0x${sha256(uid).slice(0, 40)}` as `0x${string}`;
    db.positions.push({ id: `pos_${uid}_${short}`, daoId, uid, wallet, amount, stakedAt: joinedAt, lockedUntil: Math.max(joinedAt + 30 * DAY, now + 20 * DAY), status: "locked", source: "demo-ledger", txHash: `0xdemo${sha256(uid + daoId).slice(0, 58)}` });
    db.signals.set(uid, { uid, wallets: [wallet], deviceId: `dev_${sha256(uid).slice(0, 10)}`, ipHash: `ip_${Math.floor(rnd() * 5000)}`, joinedAt });
  };
  for (const [uid, handle, roles] of staff) addMember(uid, handle, roles, created + DAY, s.minStake * 10);
  for (let i = 0; i < s.members; i++) {
    const handle = `${HANDLE_A[Math.floor(rnd() * HANDLE_A.length)]}_${HANDLE_B[Math.floor(rnd() * HANDLE_B.length)]}${i}`;
    const joined = created + Math.floor(rnd() * 40 * DAY);
    addMember(`u_${short}_${i}`, handle, ["member"], Math.min(joined, now - 3 * DAY), Math.round(s.minStake * (1 + rnd() * 9)));
  }
  // Two accounts on one device → flagged as possible duplicate person.
  const flagged = db.members.filter((m) => m.daoId === daoId && m.uid.startsWith(`u_${short}_`)).slice(5, 7);
  for (const m of flagged) {
    m.flagged = { reason: "Several staking accounts from one device", cluster: `device:${short}dup`, at: now - 5 * DAY };
    db.signals.get(m.uid)!.deviceId = `dev_dup_${short}`;
  }
  const memberList = db.members.filter((m) => m.daoId === daoId);
  const handleOf = (uid: string) => memberList.find((m) => m.uid === uid)?.handle ?? uid;
  const pick = () => memberList[3 + Math.floor(rnd() * (memberList.length - 3))];

  // Venue plate (generated illustration, public).
  const svg = plateSvg(s.plate);
  const plateId = `media_plate_${short}`;
  db.media.set(plateId, { meta: { id: plateId, daoId, ownerUid: organizer, mime: "image/svg+xml", bytes: svg.length, width: 1600, height: 1000, visibility: "public", createdAt: created, sha256: sha256(svg), generated: true, label: "Illustrated venue plate (demo, not a photo)" }, data: svg });
  const geo = PLATE_GEOMETRY[s.plate];
  const photoId = `photo_${short}_1`;
  db.photos.push({ id: photoId, daoId, mediaId: plateId, caption: geo.caption, uploadedBy: organizer, uploadedAt: created + 2 * DAY, stageZone: geo.stageZone, ceilingY: geo.ceilingY, rights: { attestedBy: organizer, attestedAt: created + 2 * DAY, basis: "organizer_contract", status: "verified", verifiedBy: organizer } });

  // Stage design project + concepts
  const projectId = `proj_${short}_1`;
  const specs = generateConceptSpecs(s.theme, s.rich ? 4 : 3, s.eventId, venue);
  const conceptIds: string[] = [];
  specs.forEach((c, i) => {
    const creator = i === 0 ? memberList[0] : pick();
    const id = `concept_${short}_${i + 1}`;
    conceptIds.push(id);
    const v1 = newVersion(null, c.spec, venue, s.theme, creator.uid, created + (5 + i) * DAY);
    const versions = [v1];
    if (i === 1) {
      const v2 = newVersion(v1, { ...c.spec, ledSides: true, alienScale: Math.min(1.8, c.spec.alienScale * 1.3) }, venue, s.theme, pick().uid, created + (7 + i) * DAY, {
        instruction: "ステージ中央の宇宙人をもっと大きくしたい。LEDスクリーンを左右に追加したい",
        applied: ["Alien sculptures enlarged", "LED columns added left and right"],
      });
      versions.push(v2);
    }
    db.concepts.push({ id, projectId, daoId, name: c.name, theme: s.theme, creatorUid: creator.uid, creatorHandle: creator.handle, description: c.description, photoId, versions, published: true, createdAt: created + (5 + i) * DAY, isDemo: true });
  });
  db.projects.push({ id: projectId, daoId, createdBy: organizer, createdAt: created + 4 * DAY, venue, photoIds: [photoId], theme: s.theme, conceptIds });

  // Discussions
  const mkDiscussion = (d: Partial<Discussion> & { title: string; body: string; category: DiscussionCategory }, at: number, comments: string[], vis: Visibility = "public") => {
    const author = d.authorUid ? { uid: d.authorUid, handle: handleOf(d.authorUid) } : (() => { const m = pick(); return { uid: m.uid, handle: m.handle }; })();
    const id = nextId(db, "disc");
    const reactions: Partial<Record<ReactionKind, string[]>> = {
      fire: memberList.slice(10, 10 + Math.floor(rnd() * 30)).map((m) => m.uid),
      alien: memberList.slice(50, 50 + Math.floor(rnd() * 15)).map((m) => m.uid),
    };
    const disc: Discussion = { id, daoId, visibility: vis, pinned: false, locked: false, hidden: false, attachments: [], proposalIds: [], reports: [], commentCount: comments.length, createdAt: at, lastActivityAt: at + comments.length * 3600_000, reactions, authorUid: author.uid, authorHandle: author.handle, ...d };
    db.discussions.push(disc);
    let parent: string | null = null;
    comments.forEach((body, i) => {
      const m = pick();
      const cid = nextId(db, "cmt");
      db.comments.push({ id: cid, discussionId: id, parentId: i === 2 ? parent : null, authorUid: m.uid, authorHandle: m.handle, body, createdAt: at + (i + 1) * 3600_000, attachments: [], reactions: i === 0 ? { heart: memberList.slice(20, 26).map((x) => x.uid) } : {}, reports: [], hidden: false });
      if (i === 1) parent = cid;
    });
    return disc;
  };
  const welcome = mkDiscussion({ title: `Welcome to the ${ev.name} DAO: read this first`, body: `This is where stakers shape ${ev.name}. Post ideas in the right category, turn the good ones into proposals, and vote. Every vote is one account, one vote: stake size does not add weight. AI stage concepts are inspiration only; the organizer, the venue and certified contractors decide what is safe to build.`, category: "general", authorUid: organizer, pinned: true }, created + DAY, ["Hyped to be here!", "Is there a deadline for stage ideas?", "Design vote closes in a week, check the Votes tab."]);
  welcome.pinned = true;
  const stageThread = mkDiscussion({ title: "Main stage: which concept fits the hall best?", body: "The turbine hall has 14 m of headroom. I think the tower layouts would use it best, but the side walls are closer than they look in the photo.", category: "stage_design", conceptId: conceptIds[0] }, created + 8 * DAY, ["Concept 2 with side LEDs looks insane", "Worried the big alien blocks sight lines from the bar", "Agreed, maybe scale it down 20%?", "Budget is the real question, see the treasury."]);
  mkDiscussion({ title: "Lighting palette: purple + acid green or full RGB?", body: "Two-colour palettes look more like FREAKTOPIA on camera. Full RGB chases get messy with haze.", category: "lighting" }, created + 12 * DAY, ["Purple and green forever", "Some red for the peak hour drop?"]);
  mkDiscussion({ title: "Closing slot nominations", body: `Who should close the night? Nominate DJs from the DJ Arena and we will put the top picks to a vote.`, category: "dj_lineup", djId: DJS[0].id }, created + 14 * DAY, [`+1 for ${DJS[0].name}`, `${DJS[4].name} for a disco sunrise`, "Keep it techno please"]);
  mkDiscussion({ title: "Bar menu: slime noodles and alien sodas", body: "Proposing a vegan noodle stand and alcohol-free neon drinks. Water must stay free.", category: "food_drinks" }, created + 16 * DAY, ["Free water is non-negotiable", "Noodles at 6am would save lives"]);
  mkDiscussion({ title: "Budget breakdown draft v2", body: "Members-only draft of how the production budget splits between stage, lighting and crew. Numbers are estimates until quotes arrive.", category: "budget", authorUid: treasurer }, created + 18 * DAY, ["Crew line looks low", "Updated with the second LED quote"], "members");
  mkDiscussion({ title: "Venue walkthrough notes (organizers only)", body: "Load-in door is 3.2 m wide. Rigging points on beams 2 and 4 only. Fire marshal visit pending.", category: "venue_layout", authorUid: organizer }, created + 19 * DAY, ["Noted, will pass to the fabricator"], "private");
  mkDiscussion({ title: "Rooftop after party at sunrise?", body: "The rooftop could host an ambient after party. Needs a separate capacity check.", category: "after_party" }, created + 20 * DAY, ["Ambient at sunrise = yes", "Noise limits on the roof?"]);
  if (!s.rich) db.discussions = db.discussions.filter((d) => d.daoId !== daoId || d.category !== "food_drinks");

  // Proposals + votes
  const conceptOptions: VoteOption[] = conceptIds.slice(0, 3).map((cid, i) => ({ id: `opt_${i + 1}`, label: db.concepts.find((c) => c.id === cid)!.name, conceptId: cid }));
  const yesNo: VoteOption[] = [
    { id: "yes", label: "Yes" },
    { id: "no", label: "No" },
    { id: "abstain", label: "Abstain" },
  ];
  const mkProposal = (p: { title: string; category: DiscussionCategory; state: ProposalState; method: VotingMethod; options: VoteOption[]; cost: number; change: string; desc: string; at: number; author?: string; conceptIds?: string[] }) => {
    const author = p.author ?? pick().uid;
    const id = `prop_${short}_${db.proposals.filter((x) => x.daoId === daoId).length + 1}`;
    const prop: Proposal = {
      id,
      daoId,
      eventId: s.eventId,
      category: p.category,
      state: p.state,
      authorUid: author,
      authorHandle: handleOf(author),
      createdAt: p.at,
      method: p.method,
      discussionDays: 3,
      votingDays: 7,
      versions: [{ version: 1, title: p.title, description: p.desc, proposedChange: p.change, estimatedCost: p.cost, options: p.options, attachments: [], documents: [], createdAt: p.at, authorUid: author }],
      history: [{ from: "DRAFT", to: "DISCUSSION", at: p.at + 3600_000, actorUid: author }],
      conceptIds: p.conceptIds ?? [],
      isDemo: true,
    };
    const seq: ProposalState[] = ["REVIEW", "VOTING", "APPROVED", "FEASIBILITY_CHECK", "ORGANIZER_CONFIRMATION", "EXECUTION", "COMPLETED"];
    const target = ["REJECTED", "EXPIRED"].includes(p.state) ? "VOTING" : p.state === "CANCELLED" ? "FEASIBILITY_CHECK" : p.state;
    let t = p.at + 4 * DAY;
    for (const st of seq) {
      if (prop.state === "DISCUSSION" || prop.state === "DRAFT") break;
      prop.history.push({ from: prop.history.at(-1)!.to, to: st, at: t, actorUid: st === "APPROVED" ? "system" : organizer });
      t += DAY;
      if (st === target) break;
    }
    if (["REJECTED", "EXPIRED"].includes(p.state)) prop.history.push({ from: "VOTING", to: p.state, at: t, actorUid: "system" });
    if (p.state === "CANCELLED") prop.history.push({ from: "FEASIBILITY_CHECK", to: "CANCELLED", at: t, actorUid: organizer, reason: "Venue does not allow open flame indoors; the fire marshal rejected the pyro effects." });
    db.proposals.push(prop);
    const disc = mkDiscussion({ title: `Proposal: ${p.title}`, body: p.desc, category: p.category, proposalIds: [id], authorUid: author }, p.at, ["Supporting this", "Can we see the cost breakdown?"]);
    prop.discussionId = disc.id;
    return prop;
  };

  const openVote = (prop: Proposal, startAt: number, endAt: number, turnout: number, bias: number[]) => {
    const snap = takeSnapshot(daoId, db.positions, db.members, s.minStake, startAt, `snap_${prop.id}`);
    const vote: DaoVote = { id: `vote_${prop.id}`, daoId, proposalId: prop.id, proposalVersion: 1, method: prop.method, options: prop.versions[0].options, maxChoices: prop.method === "multiple" ? 2 : 1, startAt, endAt, quorum: 0.2, threshold: 0.5, snapshot: snap, status: "open" };
    db.votes.push(vote);
    prop.voteId = vote.id;
    const voters = snap.eligible.filter((u) => !u.startsWith("u_org") && !u.startsWith("u_treas") && !u.startsWith("u_mod")).slice(0, Math.floor(snap.eligible.length * turnout));
    voters.forEach((uid, i) => {
      const r = rnd();
      let acc = 0;
      const idx = bias.findIndex((b) => (acc += b) >= r);
      const choice = [vote.options[Math.max(0, idx)].id];
      const flaggedM = db.members.find((m) => m.uid === uid && m.daoId === daoId)?.flagged;
      const res = castBallot(vote, db.ballots, uid, choice, startAt + 60_000 * (i + 1), { flagged: !!flaggedM, id: `bal_${vote.id}_${i}` });
      if (res.ok) {
        db.ballots.push(res.receipt);
        db.xp.push({ uid, daoId, action: "vote", at: res.receipt.castAt, target: vote.id, xp: 15 });
      }
    });
    // Ballots are cast while the vote is open (historic votes too), then past votes are closed and tallied.
    if (endAt <= now) {
      vote.status = "closed";
      vote.result = tally(vote, db.ballots, endAt);
    }
    return vote;
  };

  // 1. Stage design vote (open)
  const p1 = mkProposal({ title: "Main stage design: choose the concept", category: "stage_design", state: "VOTING", method: "single", options: conceptOptions, cost: 0, change: "Adopt the winning AI concept as the creative brief for the main stage (subject to feasibility check).", desc: "Three concepts from the AI Stage Designer made it out of discussion. Pick the one the fabricator should develop. The budget range shown on each concept is an AI reference estimate, not a quote.", at: created + 10 * DAY, conceptIds: conceptIds.slice(0, 3) });
  p1.history.at(-1)!.at = now - 2 * DAY;
  openVote(p1, now - 2 * DAY, now + 5 * DAY, 0.46, [0.38, 0.42, 0.2]);
  for (const cid of conceptIds.slice(0, 3)) db.concepts.find((c) => c.id === cid)!.proposalId = p1.id;

  // 2. Lighting (review, organizer can open voting)
  mkProposal({ title: "Lighting palette: purple + acid green only", category: "lighting", state: "REVIEW", method: "yes_no_abstain", options: yesNo, cost: 1200, change: "Restrict all main-stage fixtures to #A276E9 and #B6F05C, with red only for the closing track.", desc: "A tight two-colour palette reads better on camera and matches the FREAKTOPIA look. Extra cost covers gel/LED programming time.", at: created + 22 * DAY });

  // 3. DJ nomination (discussion)
  const djOpts = DJS.filter((d) => !ev.lineup.includes(d.id)).slice(0, 3).map((d, i) => ({ id: `dj_${i + 1}`, label: d.name, djId: d.id }));
  mkProposal({ title: "Closing slot: community DJ pick", category: "dj_lineup", state: "DISCUSSION", method: "single", options: djOpts, cost: 2400, change: "Book the winning DJ for the closing slot (fee within the lineup budget).", desc: "Top three nominations from the DJ Arena thread. The organizer confirms availability before booking.", at: now - DAY });

  if (s.rich) {
    // 4. After party (feasibility check, sign-offs pending)
    const p4 = mkProposal({ title: "Sunrise ambient after party on the roof", category: "after_party", state: "FEASIBILITY_CHECK", method: "yes_no_abstain", options: yesNo, cost: 4200, change: "Open the rooftop from 06:00 to 10:00 for an ambient after party (300 guests).", desc: "Approved by the community. Needs capacity, noise and permit checks before the organizer confirms.", at: created + 6 * DAY });
    const v4 = openVote(p4, created + 10 * DAY, created + 17 * DAY, 0.4, [0.7, 0.2, 0.1]);
    p4.feasibility = runFeasibility({ venue: { ...venue, capacity: 600, setting: "outdoor", ceilingHeightM: 0 }, estimatedCost: 4200, expectedAttendance: 300, eventStartsAt: Date.parse(ev.startsAt), now: now - DAY, permits: db.permits.get(daoId)!, suppliers: [{ item: "Rooftop furniture", confirmed: true }] });
    p4.feasibility.signoffs.push({ role: "organizer", uid: organizer, at: now - DAY, note: "Looks good if the noise permit lands." });
    void v4;
    // 5. Completed
    const p5 = mkProposal({ title: "Free water + vegan noodle stand", category: "food_drinks", state: "COMPLETED", method: "yes_no_abstain", options: yesNo, cost: 900, change: "Add free water points and a vegan noodle stand by the chill-out room.", desc: "Health first, noodles second.", at: created + 3 * DAY });
    openVote(p5, created + 6 * DAY, created + 13 * DAY, 0.5, [0.85, 0.1, 0.05]);
    p5.executionReport = { at: created + 30 * DAY, byUid: organizer, status: "done", message: "Supplier booked, two water points added to the floor plan." };
    // 6. Rejected
    const p6 = mkProposal({ title: "Open a fourth room in the boiler house", category: "venue_layout", state: "REJECTED", method: "yes_no_abstain", options: yesNo, cost: 18000, change: "Add a fourth room for hardcore.", desc: "More rooms, more chaos.", at: created + 5 * DAY });
    openVote(p6, created + 9 * DAY, created + 16 * DAY, 0.45, [0.3, 0.62, 0.08]);
    // 7. Cancelled after feasibility (cannot execute, explained)
    const p7 = mkProposal({ title: "Flame cannons on the DJ booth", category: "stage_design", state: "CANCELLED", method: "yes_no_abstain", options: yesNo, cost: 9000, change: "Four flame cannons synced to the drop.", desc: "Fire = hype.", at: created + 2 * DAY });
    openVote(p7, created + 6 * DAY, created + 13 * DAY, 0.42, [0.66, 0.3, 0.04]);
    p7.feasibility = runFeasibility({ venue, spec: { ...db.concepts.find((c) => c.id === conceptIds[0])!.versions[0].spec, pyroFx: true }, estimatedCost: 9000, expectedAttendance: ev.capacity, eventStartsAt: Date.parse(ev.startsAt), now: created + 20 * DAY, permits: db.permits.get(daoId)!, suppliers: db.suppliers.get(daoId)! });
    p7.executionReport = { at: created + 21 * DAY, byUid: organizer, status: "cannot_execute", message: "We cannot execute this result: open flame is prohibited indoors at this venue and the fire marshal refused a waiver. Alternative proposed: LED flame effects (no fire), which will go to a new vote." };
  }

  // Treasury
  const staked = db.positions.filter((p) => p.daoId === daoId).reduce((a, p) => a + p.amount, 0);
  db.accounts.push(
    { id: `acc_${short}_escrow`, daoId, kind: "staking_escrow", label: "Staking escrow (principal, locked)", balance: staked, currency: "FRK (demo)", spendable: false },
    { id: `acc_${short}_budget`, daoId, kind: "event_budget", label: "Event production budget", balance: Math.round(ev.raised * 0.35), currency: "USD", spendable: true },
    { id: `acc_${short}_tickets`, daoId, kind: "ticket_revenue", label: "Ticket revenue (settled)", balance: Math.round(ev.raised * 0.2), currency: "USD", spendable: true },
    { id: `acc_${short}_sponsors`, daoId, kind: "sponsors", label: "Sponsor contributions", balance: Math.round(ev.goal * 0.05), currency: "USD", spendable: true },
  );
  const totalOps = Math.round(ev.raised * 0.35) + Math.round(ev.raised * 0.2) + Math.round(ev.goal * 0.05);
  const items: [DiscussionCategory, string, number][] = [
    ["stage_design", "Main stage build", 0.3],
    ["lighting", "Lighting & video rental", 0.25],
    ["dj_lineup", "Lineup fees", 0.2],
    ["after_party", "After party", 0.08],
    ["food_drinks", "Water & food", 0.04],
    ["budget", "Contingency", 0.08],
  ];
  for (const [cat, label, share] of items) db.budget.push({ id: `bud_${short}_${cat}`, daoId, category: cat, label, allocated: Math.round(totalOps * share) });
  const pay1 = newRequest({ id: `pay_${short}_1`, daoId, budgetItemId: `bud_${short}_lighting`, fromAccount: "event_budget", payee: "Demo LED Rentals Ltd. (fictional)", amount: 1800, memo: "LED wall deposit", requestedBy: treasurer, requestedAt: now - 9 * DAY, evidenceMediaIds: [plateId] });
  pay1.approvals.push({ uid: organizer, role: "organizer", at: now - 8 * DAY });
  pay1.status = "executed_demo";
  pay1.executedAt = now - 8 * DAY;
  const pay2 = newRequest({ id: `pay_${short}_2`, daoId, budgetItemId: `bud_${short}_stage_design`, fromAccount: "event_budget", payee: "Demo Sculpture Works (fictional)", amount: Math.min(6400, Math.round(totalOps * 0.2)), memo: "Alien sculpture fabrication, 50% upfront", requestedBy: organizer, requestedAt: now - 2 * DAY, evidenceMediaIds: [] });
  if (pay2.requiredRoles.includes("treasurer")) pay2.approvals.push({ uid: treasurer, role: "treasurer", at: now - DAY });
  db.payments.push(pay1, pay2);

  // Milestones
  const start = Date.parse(ev.startsAt);
  db.milestones.push(
    { id: `ms_${short}_1`, daoId, title: "Venue walkthrough & photos", due: created + 3 * DAY, status: "done" },
    { id: `ms_${short}_2`, daoId, title: "Stage design vote", due: now + 5 * DAY, status: s.status === "festival" || s.status === "building" ? "done" : "doing", proposalId: p1.id },
    { id: `ms_${short}_3`, daoId, title: "Feasibility sign-off (venue + contractors)", due: now + 10 * DAY, status: s.status === "festival" || s.status === "building" ? "done" : "todo" },
    { id: `ms_${short}_4`, daoId, title: "Fabrication & supplier bookings", due: Math.max(now + 14 * DAY, start - 14 * DAY), status: s.status === "festival" ? "done" : s.status === "building" ? "doing" : "todo" },
    { id: `ms_${short}_5`, daoId, title: "Load-in & build week", due: start - 2 * DAY, status: s.status === "festival" ? "done" : "todo" },
    { id: `ms_${short}_6`, daoId, title: "Doors open", due: start, status: s.status === "festival" ? "doing" : "todo" },
  );
  if (s.status === "building" || s.status === "festival") {
    // The design vote is already decided for these demo DAOs.
    const v = db.votes.find((x) => x.proposalId === p1.id)!;
    v.endAt = now - DAY;
    v.status = "closed";
    v.result = tally(v, db.ballots, v.endAt);
    p1.state = v.result.outcome === "APPROVED" ? (s.status === "festival" ? "COMPLETED" : "EXECUTION") : v.result.outcome;
    p1.history.push({ from: "VOTING", to: v.result.outcome, at: v.endAt, actorUid: "system" });
    if (v.result.outcome === "APPROVED") p1.history.push({ from: "APPROVED", to: p1.state, at: v.endAt + 3600_000, actorUid: organizer });
  }

  logActivity(db, daoId, organizer, "dao.created", s.eventId, { minimumStake: s.minStake }, created);
  logActivity(db, daoId, organizer, "venue.photo_registered", photoId, { rights: "organizer_contract" }, created + 2 * DAY);
  logActivity(db, daoId, "system", "vote.opened", `vote_${p1.id}`, { snapshot: db.votes.find((v) => v.proposalId === p1.id)?.snapshot.hash }, now - 2 * DAY);
}

export function allEvents() {
  return EVENTS;
}
