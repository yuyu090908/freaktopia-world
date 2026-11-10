import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleLive } from "@/lib/live/api";
import { _resetLiveDb, getLiveDb } from "@/lib/live/store";
import { DEFAULT_LOOK } from "@/lib/store";

let ipSeq = 0;
const EV = "bassmutant-tokyo";

function client(ip = `10.8.0.${++ipSeq}`) {
  const jar = new Map<string, string>();
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const h: Record<string, string> = { "x-forwarded-for": ip, cookie: [...jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; "), ...headers };
    if (body !== undefined) h["content-type"] = "application/json";
    const req = new Request(`http://localhost:3000/api/live/${path}`, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
    const res = await handleLive(req, path.split("?")[0].split("/").filter(Boolean));
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      jar.set(kv.slice(0, i), decodeURIComponent(kv.slice(i + 1)));
    }
    return { status: res.status, json: (await res.json()) as Record<string, any> };
  };
  const join = (zone = "dancefloor", visibility = "public") => call("POST", `${EV}/presence`, { name: "test_alien", look: DEFAULT_LOOK, zone, visibility, dance: "spin" });
  return { call, join, jar };
}

beforeEach(() => _resetLiveDb());
afterEach(() => {
  delete process.env.LIVE_DATA_MODE;
});

describe("live discovery & detail", () => {
  it("never shows the demo event as real LIVE", async () => {
    const r = await client().call("GET", "");
    expect(r.status).toBe(200);
    expect(r.json.realLiveCount).toBe(0);
    expect(r.json.featured).toBeNull();
    const ev = r.json.events.find((e: any) => e.id === EV);
    expect(ev.status).toBe("demo_live");
    expect(r.json.events.some((e: any) => e.status === "live")).toBe(false);
    expect(ev.attendance).toHaveProperty("onlineViewers");
    expect(ev.attendance).toHaveProperty("checkedIn");
  });
  it("detail has sets in venue tz, streams with rights and separate attendance", async () => {
    const r = await client().call("GET", EV);
    expect(r.json.tz).toBe("Asia/Tokyo");
    expect(r.json.clock.demo).toBe(true);
    expect(r.json.sets.length).toBeGreaterThan(2);
    expect(r.json.streams.every((s: any) => s.live === false && s.rights.musicLicensed === false)).toBe(true);
    expect(Object.keys(r.json.attendance)).toEqual(expect.arrayContaining(["ticketsSold", "checkedIn", "currentlyPresent", "onlineViewers", "publicAvatars"]));
    expect((await client().call("GET", "nope")).status).toBe(404);
  });
  it("returns 503 in production mode instead of demo data", async () => {
    process.env.LIVE_DATA_MODE = "production";
    const r = await client().call("GET", "");
    expect(r.status).toBe(503);
    expect(r.json.error.code).toBe("DATA_SOURCE_NOT_CONFIGURED");
  });
  it("upcoming events have no room", async () => {
    const r = await client().call("GET", "void-jelly-rave/room");
    expect(r.json.live).toBe(false);
  });
});

describe("live room", () => {
  it("joins, moves zones and emits zone events; visibility controls who sees the avatar", async () => {
    const a = client();
    const b = client();
    expect((await a.join("dancefloor", "public")).status).toBe(200);
    const seen = await b.call("GET", `${EV}/room?zone=dancefloor`);
    expect(seen.json.avatars.some((x: any) => x.name === "test_alien")).toBe(true);
    const since = seen.json.seq;
    await a.join("lounge", "hidden");
    const after = await b.call("GET", `${EV}/room?zone=lounge&since=${since}`);
    expect(after.json.avatars.some((x: any) => x.name === "test_alien")).toBe(false);
    expect(after.json.events.some((e: any) => e.type === "avatar_zone_changed" && e.to === "lounge")).toBe(true);
    // the own avatar is not listed among others
    const mine = await a.call("GET", `${EV}/room?zone=lounge`);
    expect(mine.json.you.zone).toBe("lounge");
    expect(mine.json.avatars.some((x: any) => x.name === "test_alien")).toBe(false);
    await a.call("POST", `${EV}/leave`);
    expect(getLiveDb().rooms.get(EV)!.participants.size).toBe(24);
  });
  it("validates presence input", async () => {
    const r = await client().call("POST", `${EV}/presence`, { name: "x", look: DEFAULT_LOOK, zone: "moon", visibility: "public" });
    expect(r.status).toBe(400);
  });
  it("chat: send, reply, duplicate block, moderation, report hides at 3, block hides author", async () => {
    const a = client();
    const s = await a.call("POST", `${EV}/chat`, { body: "hello aliens", name: "alpha", look: DEFAULT_LOOK });
    expect(s.status).toBe(201);
    const id = s.json.message.id;
    expect((await a.call("POST", `${EV}/chat`, { body: "hello aliens", name: "alpha", look: DEFAULT_LOOK })).json.error.code).toBe("DUPLICATE_MESSAGE");
    expect((await a.call("POST", `${EV}/chat`, { body: "send me usdt now", name: "alpha", look: DEFAULT_LOOK })).status).toBe(422);
    const b = client();
    const rep = await b.call("POST", `${EV}/chat`, { body: "hi alpha", name: "beta", look: DEFAULT_LOOK, replyTo: id });
    expect(rep.json.message.replyTo).toBe(id);
    expect((await a.call("POST", `${EV}/chat/${id}/report`)).json.error.code).toBe("OWN_MESSAGE");
    for (let i = 0; i < 3; i++) await client().call("POST", `${EV}/chat/${id}/report`);
    const room = await b.call("GET", `${EV}/room`);
    const hidden = room.json.chat.find((m: any) => m.id === id);
    expect(hidden.hidden).toBe(true);
    expect(hidden.body).toBe("");
    const authorId = rep.json.message.authorId;
    expect((await a.call("POST", `${EV}/block`, { userId: authorId })).status).toBe(200);
    const view = await a.call("GET", `${EV}/room`);
    expect(view.json.chat.some((m: any) => m.authorId === authorId)).toBe(false);
  });
  it("reactions: only 6 a minute count toward energy for one person", async () => {
    const a = client();
    const res = [];
    for (let i = 0; i < 10; i++) res.push((await a.call("POST", `${EV}/reactions`, { kind: "fire", zone: "dancefloor" })).json.counted);
    expect(res.filter(Boolean)).toHaveLength(6);
    const room = await a.call("GET", `${EV}/room`);
    expect(room.json.energy).toBeGreaterThanOrEqual(0);
    expect(room.json.energy).toBeLessThanOrEqual(100);
    expect(room.json.reactions.fire).toBeLessThanOrEqual(12);
  });
  it("on-site quest needs a real check-in; demo check-in doesn't count", async () => {
    const a = client();
    expect((await a.call("POST", `${EV}/quests`, { questId: "visit-main" })).status).toBe(200);
    expect((await a.call("POST", `${EV}/quests`, { questId: "onsite-checkin" })).status).toBe(403);
    const t = await a.call("POST", `${EV}/demo-ticket`);
    await a.call("POST", `${EV}/checkin`, { qr: t.json.qr });
    expect((await a.call("POST", `${EV}/quests`, { questId: "onsite-checkin" })).json.error.code).toBe("ONSITE_REQUIRED");
  });
});

describe("live check-in", () => {
  it("demo ticket: accepted once, reuse and cancelled rejected, staff methods need a staff token", async () => {
    const a = client();
    const t = await a.call("POST", `${EV}/demo-ticket`);
    expect(t.status).toBe(201);
    expect((await a.call("POST", `${EV}/checkin`, { qr: t.json.qr, method: "organizer_scan" })).json.error.code).toBe("NOT_AUTHORIZED");
    const ok = await a.call("POST", `${EV}/checkin`, { qr: t.json.qr });
    expect(ok.status).toBe(200);
    expect(ok.json.demo).toBe(true);
    expect((await a.call("POST", `${EV}/checkin`, { qr: t.json.qr })).json.error.code).toBe("TICKET_ALREADY_USED");
    const c = await a.call("POST", `${EV}/demo-ticket?sample=cancelled`);
    expect((await a.call("POST", `${EV}/checkin`, { qr: c.json.qr })).json.error.code).toBe("TICKET_CANCELLED");
    expect((await a.call("POST", `${EV}/checkin`, { qr: t.json.qr.slice(0, -2) + "xx" })).json.error.code).toBe("QR_SIGNATURE_INVALID");
    expect(getLiveDb().checkins.every((x) => x.demo)).toBe(true);
    // demo tickets only for the demo live event
    expect((await a.call("POST", "void-jelly-rave/demo-ticket")).status).toBe(409);
  });
  it("rankings keep viewers and on-site separate and show period/asOf", async () => {
    const r = await client().call("GET", `${EV}/rankings`);
    for (const k of ["event", "checkedIn", "community", "trending", "liveViewers"]) {
      expect(r.json[k]).toHaveProperty("period");
      expect(r.json[k]).toHaveProperty("asOf");
    }
  });
});
