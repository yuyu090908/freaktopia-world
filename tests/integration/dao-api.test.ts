import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { handleDao } from "@/lib/dao/api";
import { _resetDb, getDb } from "@/lib/dao/store";
import { buildSignInMessage } from "@/lib/dao/auth";

let ipSeq = 0;

/** A tiny cookie-jar client per simulated user. */
function client(ip = `10.9.0.${++ipSeq}`) {
  const jar = new Map<string, string>();
  const call = async (method: string, path: string, body?: unknown, extra: RequestInit = {}) => {
    const headers: Record<string, string> = { "x-forwarded-for": ip, cookie: [...jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ") };
    if (body !== undefined && !(body instanceof FormData)) headers["content-type"] = "application/json";
    const req = new Request(`http://localhost:3000/api/dao/${path}`, { method, headers, body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined, ...extra });
    const res = await handleDao(req, path.split("?")[0].split("/").filter(Boolean));
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      const v = decodeURIComponent(kv.slice(i + 1));
      if (v) jar.set(kv.slice(0, i), v);
      else jar.delete(kv.slice(0, i));
    }
    const json = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
    return { status: res.status, json: json as Record<string, any> };
  };
  const account = privateKeyToAccount(generatePrivateKey());
  const signIn = async () => {
    const n = await call("POST", "auth/nonce");
    const now = new Date();
    const message = buildSignInMessage({ domain: "localhost:3000", uri: "http://localhost:3000/dao", address: account.address, chainId: 31337, nonce: n.json.nonce, issuedAt: now.toISOString(), expirationTime: new Date(now.getTime() + 240_000).toISOString() });
    const signature = await account.signMessage({ message });
    return { res: await call("POST", "auth/verify", { message, signature, nonceToken: n.json.nonceToken }), message, signature, nonceToken: n.json.nonceToken };
  };
  const join = (eventId = "neon-slime-summit", amount = 150) => call("POST", `${eventId}/join`, { amount, chainId: 31337, stakingContract: getDb().daos.get(eventId)!.config.stakingContract });
  return { call, signIn, join, account, jar };
}

beforeEach(() => {
  _resetDb();
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.DAO_DATA_MODE;
});

describe("wallet sign-in", () => {
  it("verifies a real signature and rejects replay, wrong chain and tampering", async () => {
    const u = client();
    const first = await u.signIn();
    expect(first.res.status).toBe(200);
    expect(first.res.json.session.wallet).toBe(u.account.address);
    // Same nonce again → replay
    const replay = await u.call("POST", "auth/verify", { message: first.message, signature: first.signature, nonceToken: first.nonceToken });
    expect(replay.json.error.code).toBe("NONCE_REPLAYED");
    // Wrong chain id
    const n = await u.call("POST", "auth/nonce");
    const now = new Date();
    const msg = buildSignInMessage({ domain: "localhost:3000", uri: "http://localhost:3000", address: u.account.address, chainId: 1, nonce: n.json.nonce, issuedAt: now.toISOString(), expirationTime: new Date(now.getTime() + 60_000).toISOString() });
    const wrong = await u.call("POST", "auth/verify", { message: msg, signature: await u.account.signMessage({ message: msg }), nonceToken: n.json.nonceToken });
    expect(wrong.json.error.code).toBe("CHAIN_NOT_ALLOWED");
    // Signature from another key
    const n2 = await u.call("POST", "auth/nonce");
    const msg2 = buildSignInMessage({ domain: "localhost:3000", uri: "http://localhost:3000", address: u.account.address, chainId: 31337, nonce: n2.json.nonce, issuedAt: now.toISOString(), expirationTime: new Date(now.getTime() + 60_000).toISOString() });
    const other = privateKeyToAccount(generatePrivateKey());
    const forged = await u.call("POST", "auth/verify", { message: msg2, signature: await other.signMessage({ message: msg2 }), nonceToken: n2.json.nonceToken });
    expect(forged.json.error.code).toBe("BAD_SIGNATURE");
    // Domain mismatch
    const n3 = await u.call("POST", "auth/nonce");
    const msg3 = buildSignInMessage({ domain: "evil.example", uri: "https://evil.example", address: u.account.address, chainId: 31337, nonce: n3.json.nonce, issuedAt: now.toISOString(), expirationTime: new Date(now.getTime() + 60_000).toISOString() });
    expect((await u.call("POST", "auth/verify", { message: msg3, signature: await u.account.signMessage({ message: msg3 }), nonceToken: n3.json.nonceToken })).json.error.code).toBe("DOMAIN_MISMATCH");
  });

  it("a forged session cookie is ignored", async () => {
    const u = client();
    u.jar.set("fk_dao", "eyJ1aWQiOiJ1X29yZ19uZW9uIn0.bogus");
    const s = await u.call("GET", "session");
    expect(s.json.session).toBeNull();
  });
});

describe("membership and permissions", () => {
  it("wallet connection alone does not make a member; staking does", async () => {
    const u = client();
    await u.signIn();
    let home = await u.call("GET", "neon-slime-summit");
    expect(home.json.me.staked).toBe(false);
    const post = await u.call("POST", "neon-slime-summit/discussions", { title: "Hello DAO", body: "This is a long enough post body to pass validation.", category: "general" });
    expect(post.status).toBe(403);
    expect(post.json.error.code).toBe("STAKE_REQUIRED");
    expect((await u.join("neon-slime-summit", 10)).json.error.code).toBe("BELOW_MINIMUM_STAKE");
    const j = await u.join();
    expect(j.status).toBe(200);
    expect(j.json.demo).toBe(true);
    home = await u.call("GET", "neon-slime-summit");
    expect(home.json.me.staked).toBe(true);
    expect((await u.join()).json.error.code).toBe("ALREADY_STAKED");
  });

  it("validates chain id and contract when staking", async () => {
    const u = client();
    await u.signIn();
    expect((await u.call("POST", "neon-slime-summit/join", { amount: 200, chainId: 1, stakingContract: getDb().daos.get("neon-slime-summit")!.config.stakingContract })).json.error.code).toBe("CHAIN_ID_MISMATCH");
    expect((await u.call("POST", "neon-slime-summit/join", { amount: 200, chainId: 31337, stakingContract: "0x0000000000000000000000000000000000000001" })).json.error.code).toBe("CONTRACT_MISMATCH");
  });

  it("anonymous users read public threads only; private topics stay private on the API", async () => {
    const anon = client();
    const list = await anon.call("GET", "neon-slime-summit/discussions");
    expect(list.status).toBe(200);
    expect(list.json.discussions.every((d: { visibility: string }) => d.visibility === "public")).toBe(true);
    expect(list.json.restricted).toBeGreaterThan(0);
    const priv = getDb().discussions.find((d) => d.daoId === "dao_neon-slime-summit" && d.visibility === "private")!;
    expect((await anon.call("GET", `neon-slime-summit/discussions/${priv.id}`)).status).toBe(401);
    const member = client();
    await member.signIn();
    await member.join();
    const memList = await member.call("GET", "neon-slime-summit/discussions");
    expect(memList.json.discussions.some((d: { visibility: string }) => d.visibility === "members")).toBe(true);
    expect(memList.json.discussions.some((d: { visibility: string }) => d.visibility === "private")).toBe(false);
    expect((await member.call("GET", `neon-slime-summit/discussions/${priv.id}`)).status).toBe(403);
    const anonComment = await anon.call("POST", `neon-slime-summit/discussions/${priv.id}/comments`, { body: "hi" });
    expect(anonComment.status).toBe(404);
  });
});

describe("discussion, comments, reactions, moderation", () => {
  it("member creates a thread, replies, reacts; spam and duplicates earn no XP", async () => {
    const u = client();
    await u.signIn();
    await u.join();
    const t = await u.call("POST", "neon-slime-summit/discussions", { title: "Lasers on the balcony?", body: "Could we mount two laser fans on the balcony rail for the peak hour?", category: "lighting" });
    expect(t.status).toBe(201);
    expect(t.json.xp).toBe(10);
    const id = t.json.discussion.id;
    const c1 = await u.call("POST", `neon-slime-summit/discussions/${id}/comments`, { body: "Adding the rail drawing later today." });
    expect(c1.status).toBe(201);
    const reply = await u.call("POST", `neon-slime-summit/discussions/${id}/comments`, { body: "Adding the rail drawing later today.", parentId: c1.json.comment.id });
    expect(reply.json.xp).toBe(0); // duplicate content + cooldown
    const r = await u.call("POST", "neon-slime-summit/react", { targetType: "discussion", id, kind: "fire" });
    expect(r.json.on).toBe(true);
    const blocked = await u.call("POST", "neon-slime-summit/discussions", { title: "Free tokens", body: "Send me your seed phrase and I will double your stake instantly.", category: "general" });
    expect(blocked.json.error.code).toBe("CONTENT_BLOCKED");
    const priv = await u.call("POST", "neon-slime-summit/discussions", { title: "Secret plans", body: "Members should not be able to create private organizer topics.", category: "general", visibility: "private" });
    expect(priv.status).toBe(403);
    const thread = await u.call("GET", `neon-slime-summit/discussions/${id}`);
    expect(thread.json.comments).toHaveLength(2);
    expect(thread.json.comments[1].parentId).toBe(c1.json.comment.id);
  });

  it("reports from 3 members auto-hide; moderators can lock", async () => {
    const author = client();
    await author.signIn();
    await author.join();
    const t = await author.call("POST", "neon-slime-summit/discussions", { title: "Buy my merch", body: "Off-topic sales pitch that members will report for spam.", category: "general" });
    for (let i = 0; i < 3; i++) {
      const r = client();
      await r.signIn();
      await r.join();
      await r.call("POST", "neon-slime-summit/report", { targetType: "discussion", id: t.json.discussion.id, reason: "spam" });
    }
    const anon = client();
    expect((await anon.call("GET", `neon-slime-summit/discussions/${t.json.discussion.id}`)).status).toBe(404);
    // moderator (demo role) locks a thread
    const mod = client();
    await mod.signIn();
    await mod.join();
    expect((await mod.call("POST", "neon-slime-summit/moderate", { targetType: "discussion", id: t.json.discussion.id, action: "lock", reason: "spam" })).status).toBe(403);
    await mod.call("POST", "neon-slime-summit/demo-role", { roles: ["moderator"] });
    expect((await mod.call("POST", "neon-slime-summit/moderate", { targetType: "discussion", id: t.json.discussion.id, action: "lock", reason: "spam thread" })).status).toBe(200);
  });
});

describe("proposals and voting", () => {
  it("full lifecycle: create → review → voting (snapshot) → ballot → duplicate blocked → finalize", async () => {
    const author = client();
    await author.signIn();
    await author.join();
    const late = client();
    const p = await author.call("POST", "neon-slime-summit/proposals", { title: "Glow sticks at the door", description: "Hand out reusable glow sticks to the first 500 guests at the door.", category: "decoration", proposedChange: "Buy 500 reusable glow sticks.", estimatedCost: 750, method: "yes_no_abstain" });
    expect(p.status).toBe(201);
    expect(p.json.proposal.state).toBe("DISCUSSION");
    const pid = p.json.proposal.id;
    // author cannot skip the discussion period
    expect((await author.call("POST", `neon-slime-summit/proposals/${pid}/transition`, { to: "REVIEW" })).json.error.code).toBe("DISCUSSION_PERIOD_RUNNING");
    // organizer (demo role) fast-tracks to review and opens the vote
    const org = client();
    await org.signIn();
    await org.call("POST", "neon-slime-summit/demo-role", { roles: ["organizer"] });
    expect((await org.call("POST", `neon-slime-summit/proposals/${pid}/transition`, { to: "REVIEW" })).status).toBe(200);
    const open = await org.call("POST", `neon-slime-summit/proposals/${pid}/transition`, { to: "VOTING" });
    expect(open.json.proposal.state).toBe("VOTING");
    const vote = open.json.proposal.vote;
    expect(vote.snapshot.eligible).toBeGreaterThan(400);
    // author is in the snapshot and votes once
    const b1 = await author.call("POST", `neon-slime-summit/votes/${vote.id}/ballot`, { choice: ["yes"], proposalVersion: 1 });
    expect(b1.status).toBe(201);
    expect(b1.json.receipt.hash).toMatch(/^[0-9a-f]{64}$/);
    const b2 = await author.call("POST", `neon-slime-summit/votes/${vote.id}/ballot`, { choice: ["no"], proposalVersion: 1 });
    expect(b2.json.error.code).toBe("ALREADY_VOTED");
    // a member who stakes after the vote opened is not in the snapshot
    await late.signIn();
    await late.join();
    const b3 = await late.call("POST", `neon-slime-summit/votes/${vote.id}/ballot`, { choice: ["yes"], proposalVersion: 1 });
    expect(b3.json.error.code).toBe("NOT_IN_SNAPSHOT");
    // audit chain is valid
    const audit = await author.call("GET", `neon-slime-summit/votes/${vote.id}/audit`);
    expect(audit.json.chainValid).toBe(true);
    // after the end time the result is finalized by the engine (quorum not met → EXPIRED)
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 8 * 86_400_000);
    const after = await author.call("GET", `neon-slime-summit/proposals/${pid}`);
    expect(after.json.proposal.vote.status).toBe("closed");
    expect(after.json.proposal.state).toBe("EXPIRED");
    expect(after.json.proposal.vote.result.resultHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("only the vote engine can set APPROVED; feasibility + 3 sign-offs gate confirmation", async () => {
    const org = client();
    await org.signIn();
    await org.call("POST", "neon-slime-summit/demo-role", { roles: ["organizer"] });
    const prop = getDb().proposals.find((x) => x.daoId === "dao_neon-slime-summit" && x.state === "FEASIBILITY_CHECK")!;
    expect((await org.call("POST", `neon-slime-summit/proposals/${prop.id}/transition`, { to: "APPROVED" })).json.error.code).toBe("SYSTEM_ONLY");
    expect((await org.call("POST", `neon-slime-summit/proposals/${prop.id}/transition`, { to: "ORGANIZER_CONFIRMATION" })).json.error.code).toBe("SIGNOFFS_MISSING");
    const run = await org.call("POST", `neon-slime-summit/proposals/${prop.id}/feasibility`);
    expect(run.json.proposal.feasibility.advisoryOnly).toBe(true);
    expect(run.json.proposal.feasibility.checks).toHaveLength(10);
    if (run.json.proposal.feasibility.overall !== "not_feasible") {
      for (const role of ["organizer", "venue_manager", "specialist"]) await org.call("POST", `neon-slime-summit/proposals/${prop.id}/signoff`, { role });
      expect((await org.call("POST", `neon-slime-summit/proposals/${prop.id}/transition`, { to: "ORGANIZER_CONFIRMATION" })).status).toBe(200);
      const cancel = await org.call("POST", `neon-slime-summit/proposals/${prop.id}/transition`, { to: "CANCELLED", reason: "short" });
      expect(cancel.json.error.code).toBe("REASON_REQUIRED");
      const c2 = await org.call("POST", `neon-slime-summit/proposals/${prop.id}/transition`, { to: "CANCELLED", reason: "The roof noise permit was refused by the city council." });
      expect(c2.json.proposal.executionReport.status).toBe("cannot_execute");
    }
  });

  it("flagged duplicate accounts have their ballots held", async () => {
    const db = getDb();
    const flagged = db.members.find((m) => m.daoId === "dao_neon-slime-summit" && m.flagged)!;
    const vote = db.votes.find((v) => v.daoId === "dao_neon-slime-summit" && v.status === "open")!;
    const held = db.ballots.filter((b) => b.voteId === vote.id && b.uid === flagged.uid);
    expect(held.every((b) => b.held)).toBe(true);
  });
});

describe("uploads and AI stage designer", () => {
  const png = (w = 640, h = 400) => {
    const b = new Uint8Array(64);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(b.buffer).setUint32(16, w);
    new DataView(b.buffer).setUint32(20, h);
    return b;
  };

  it("rejects non-venue roles, fake types and oversize files; accepts a PNG", async () => {
    const u = client();
    await u.signIn();
    await u.join();
    const f = new FormData();
    f.append("purpose", "venue");
    f.append("file", new File([png()], "hall.png", { type: "image/png" }));
    expect((await u.call("POST", "neon-slime-summit/media", f)).status).toBe(403);
    await u.call("POST", "neon-slime-summit/demo-role", { roles: ["venue_owner"] });
    const bad = new FormData();
    bad.append("purpose", "venue");
    bad.append("file", new File([new TextEncoder().encode("<svg onload=alert(1)>")], "x.png", { type: "image/png" }));
    const rb = await u.call("POST", "neon-slime-summit/media", bad);
    expect(rb.status).toBe(422);
    expect(rb.json.error.code).toBe("UNSUPPORTED_TYPE");
    const good = new FormData();
    good.append("purpose", "venue");
    good.append("file", new File([png()], "hall.png", { type: "image/png" }));
    const rg = await u.call("POST", "neon-slime-summit/media", good);
    expect(rg.status).toBe(201);
    const mediaId = rg.json.files[0].id;
    // registering requires an attestation of rights
    expect((await u.call("POST", "neon-slime-summit/stage/photos", { mediaId, caption: "Main hall", stageZone: { x: 0.3, y: 0.4, w: 0.4, h: 0.3 }, ceilingY: 0.15, rightsBasis: "owner", attest: false })).status).toBe(400);
    const ph = await u.call("POST", "neon-slime-summit/stage/photos", { mediaId, caption: "Main hall", stageZone: { x: 0.3, y: 0.4, w: 0.4, h: 0.3 }, ceilingY: 0.15, rightsBasis: "owner", attest: true });
    expect(ph.json.photo.rights.status).toBe("self_attested");
    // members-only media is not visible anonymously
    const anon = client();
    expect((await anon.call("GET", `media/${mediaId}`)).status).toBe(401);
  });

  it("generates 3–5 concepts, edits from Japanese instructions, publishes to the gallery", async () => {
    const u = client();
    await u.signIn();
    await u.join();
    const stage = await u.call("GET", "neon-slime-summit/stage");
    const photoId = stage.json.photos[0].id;
    const proj = await u.call("POST", "neon-slime-summit/stage/projects", { venue: stage.json.venue, photoIds: [photoId], theme: "cyber_rave" });
    expect(proj.status).toBe(201);
    const gen = await u.call("POST", `neon-slime-summit/stage/projects/${proj.json.project.id}/generate`, { count: 5, photoId });
    expect(gen.json.concepts).toHaveLength(5);
    const c = gen.json.concepts[0];
    expect(c.current.estimate.basis).toBe("ai_reference_estimate");
    expect(c.current.prompt).toMatch(/KEEP UNCHANGED/);
    const ed = await u.call("POST", `neon-slime-summit/stage/concepts/${c.id}/edit`, { instruction: "ステージ中央の宇宙人をもっと大きくしたい。LEDスクリーンを左右に追加したい。紫と緑の照明に変更したい" });
    expect(ed.json.concept.versions).toHaveLength(2);
    expect(ed.json.concept.current.spec.ledSides).toBe(true);
    expect(ed.json.concept.current.spec.palette.slice(0, 2)).toEqual(["#A276E9", "#B6F05C"]);
    expect(ed.json.concept.current.spec.alienScale).toBeGreaterThan(c.current.spec.alienScale);
    const cheap = await u.call("POST", `neon-slime-summit/stage/concepts/${c.id}/edit`, { instruction: "予算を抑えたデザインにしたい" });
    expect(cheap.json.concept.current.estimate.high).toBeLessThan(ed.json.concept.current.estimate.high);
    const pub = await u.call("POST", `neon-slime-summit/stage/concepts/${c.id}/publish`);
    expect(pub.json.concept.published).toBe(true);
    const gallery = await client().call("GET", "neon-slime-summit/gallery");
    expect(gallery.json.concepts.some((x: { id: string }) => x.id === c.id)).toBe(true);
  });
});

describe("treasury", () => {
  it("staked principal can never pay costs; multi-approval; no funds move", async () => {
    const org = client();
    await org.signIn();
    await org.call("POST", "neon-slime-summit/demo-role", { roles: ["organizer"] });
    const t = await org.call("GET", "neon-slime-summit/treasury");
    expect(t.json.paymentsEnabled).toBe(false);
    const item = t.json.budget[0].id;
    expect((await org.call("POST", "neon-slime-summit/treasury/payments", { budgetItemId: item, amount: 500, payee: "Demo", memo: "Tape", fromAccount: "staking_escrow" })).json.error.code).toBe("STAKE_FUNDS_LOCKED");
    const big = await org.call("POST", "neon-slime-summit/treasury/payments", { budgetItemId: item, amount: 5000, payee: "Demo truss co", memo: "Truss rental", fromAccount: "event_budget" });
    expect(big.json.payment.requiredApprovals).toBe(2);
    expect((await org.call("POST", `neon-slime-summit/treasury/payments/${big.json.payment.id}/approve`)).json.error.code).toBe("SELF_APPROVAL");
    const treas = client();
    await treas.signIn();
    await treas.call("POST", "neon-slime-summit/demo-role", { roles: ["treasurer"] });
    expect((await treas.call("POST", `neon-slime-summit/treasury/payments/${big.json.payment.id}/approve`)).json.payment.status).toBe("pending");
    const org2 = client();
    await org2.signIn();
    await org2.call("POST", "neon-slime-summit/demo-role", { roles: ["organizer"] });
    const done = await org2.call("POST", `neon-slime-summit/treasury/payments/${big.json.payment.id}/approve`);
    expect(done.json.payment.status).toBe("approved");
    expect((await org2.call("POST", `neon-slime-summit/treasury/payments/${big.json.payment.id}/execute`)).json.error.code).toBe("EVIDENCE_REQUIRED");
  });
});

describe("settings, summaries and production mode", () => {
  it("settings are organizer-only and locked during open votes", async () => {
    const u = client();
    await u.signIn();
    expect((await u.call("PATCH", "neon-slime-summit/settings", { minimumStake: 5 })).status).toBe(403);
    await u.call("POST", "neon-slime-summit/demo-role", { roles: ["organizer"] });
    expect((await u.call("PATCH", "neon-slime-summit/settings", { minimumStake: 5 })).json.error.code).toBe("VOTE_IN_PROGRESS");
    expect((await u.call("PATCH", "neon-slime-summit/settings", { tokenContract: "0x123" })).status).toBe(400);
    expect((await u.call("PATCH", "neon-slime-summit/settings", { defaultQuorum: 0.3 })).json.config.defaultQuorum).toBe(0.3);
  });

  it("summaries feed ranking/map; activity log hash chain verifies", async () => {
    const s = await client().call("GET", "summary");
    expect(s.json.daos.length).toBeGreaterThanOrEqual(6);
    const neon = s.json.daos.find((d: { eventId: string }) => d.eventId === "neon-slime-summit");
    expect(neon.members).toBeGreaterThan(400);
    expect(neon.participationRate).toBeGreaterThan(0);
    const act = await client().call("GET", "neon-slime-summit/activity");
    expect(act.json.chainValid).toBe(true);
  });

  it("production mode never serves demo data", async () => {
    process.env.DAO_DATA_MODE = "production";
    const r = await client().call("GET", "neon-slime-summit");
    expect(r.status).toBe(503);
    expect(r.json.error.code).toBe("DATA_SOURCE_NOT_CONFIGURED");
  });
});
