import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { durationOf, id3Size, inspectHead, verifyMp3 } from "@/lib/music/mp3";
import { canDownload, canPlay, conflictsFor, isExpired, judgePlay, nextStatus, publicDay, qualifyingSeconds, rankDjs, rightsProblems, trendingScore, type DjSignals } from "@/lib/music/rules";
import { presignV4 } from "@/lib/music/storage";
import type { AudioTrack, RightsInfo } from "@/lib/music/types";

const fx = (n: string) => new Uint8Array(readFileSync(`tests/fixtures/audio/${n}`));
const verify = (b: Uint8Array, maxSeconds = 3600) => verifyMp3(b.subarray(0, 524_288), b.subarray(Math.max(0, b.length - 65_536)), b.length, { maxSeconds });

describe("MP3 verification (real files)", () => {
  it.each([["tone-6s-cbr.mp3", 6], ["tone-8s-vbr.mp3", 8], ["tone-12s-id3.mp3", 12]])("accepts %s with the right duration", (name, secs) => {
    const v = verify(fx(name));
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(Math.abs(v.durationSec - secs)).toBeLessThanOrEqual(1);
      expect(v.codec.sampleRate).toBeGreaterThan(0);
    }
  });

  it("skips an ID3v2 tag to find the audio", () => {
    const b = fx("tone-12s-id3.mp3");
    expect(id3Size(b)).toBeGreaterThan(0);
    const h = inspectHead(b);
    expect(h.ok).toBe(true);
    if (h.ok) expect(Math.round(durationOf(h, b.length))).toBeGreaterThanOrEqual(11);
  });

  it("rejects programs and archives as dangerous", () => {
    const exe = new Uint8Array(4096); exe.set([0x4d, 0x5a, 0x90, 0x00]); // "MZ" PE header
    const zip = new Uint8Array(4096); zip.set([0x50, 0x4b, 0x03, 0x04]);
    const elf = new Uint8Array(4096); elf.set([0x7f, 0x45, 0x4c, 0x46]);
    for (const b of [exe, zip, elf]) expect(verify(b)).toMatchObject({ ok: false, error: "DANGEROUS_FILE" });
  });

  it("rejects other audio containers renamed to .mp3", () => {
    const wav = new Uint8Array(4096); wav.set(new TextEncoder().encode("RIFF\0\0\0\0WAVEfmt "));
    const flac = new Uint8Array(4096); flac.set(new TextEncoder().encode("fLaC"));
    for (const b of [wav, flac]) expect(verify(b)).toMatchObject({ ok: false, error: "UNSUPPORTED_FORMAT" });
  });

  it("rejects random bytes and HTML as not MP3", () => {
    const junk = new Uint8Array(65_536).map((_, i) => (i * 7919) % 251);
    expect(verify(junk).ok).toBe(false);
    expect(verify(new TextEncoder().encode("<!doctype html><html>".padEnd(8000, " "))).ok).toBe(false);
  });

  it("rejects a truncated file and an empty file", () => {
    const b = fx("tone-8s-vbr.mp3");
    const cut = b.subarray(0, Math.floor(b.length * 0.6));
    expect(verify(cut)).toMatchObject({ ok: false, error: "CORRUPT" });
    expect(verify(new Uint8Array(0)).ok).toBe(false);
  });

  it("enforces the maximum duration", () => {
    expect(verify(fx("tone-12s-id3.mp3"), 5)).toMatchObject({ ok: false, error: "TOO_LONG" });
  });
});

describe("S3 SigV4 presign", () => {
  it("matches the AWS documentation test vector", () => {
    const url = presignV4({
      method: "GET", host: "examplebucket.s3.amazonaws.com", path: "/test.txt", region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", expiresSec: 86400, now: new Date("2013-05-24T00:00:00Z"),
    });
    expect(url).toContain("X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  });

  it("signs content-type and length for uploads so the object can't be swapped", () => {
    const url = presignV4({ method: "PUT", host: "h", path: "/b/k.mp3", region: "auto", accessKeyId: "a", secretAccessKey: "s", expiresSec: 900, headers: { "content-type": "audio/mpeg", "content-length": "123" } });
    expect(decodeURIComponent(url)).toContain("X-Amz-SignedHeaders=content-length;content-type;host");
    expect(url).toContain("X-Amz-Expires=900");
  });
});

const rights = (over: Partial<RightsInfo> = {}): RightsInfo => ({
  allOriginal: true, usesThirdParty: false, licensor: "", licenseRef: "", territories: "", licenseEnds: null, allowStreaming: true, allowDownload: false, documentId: null, statement: "All mine, made at home.", ...over,
} as RightsInfo);
const track = (over: Partial<AudioTrack> = {}): AudioTrack => ({
  id: "t1", ownerId: "owner", title: "T", type: "original_track", processingStatus: "ready", publicationStatus: "published", visibility: "public",
  rightsStatus: "staff_reviewed", rights: rights(), downloadable: false, ...over,
} as AudioTrack);

describe("track access", () => {
  it("private tracks are visible only to the owner (and staff)", () => {
    const t = track({ visibility: "private", publicationStatus: "private" });
    expect(canPlay(t, { id: "owner" })).toBe(true);
    expect(canPlay(t, { id: "someone" })).toBe(false);
    expect(canPlay(t, { id: null })).toBe(false);
    expect(canPlay(t, { id: "x", admin: true })).toBe(true);
  });

  it("audition tracks only for reviewers of an event the track was attached to", () => {
    const t = track({ visibility: "audition" });
    expect(canPlay(t, { id: "reviewer", auditionForTrack: true })).toBe(true);
    expect(canPlay(t, { id: "reviewer" })).toBe(false);
    expect(canPlay(t, { id: null })).toBe(false);
  });

  it("never plays unreviewed, removed or unprocessed tracks to others", () => {
    for (const over of [{ rightsStatus: "unverified" }, { rightsStatus: "pending_review", publicationStatus: "pending_review" }, { publicationStatus: "removed" }, { processingStatus: "processing" }] as Partial<AudioTrack>[])
      expect(canPlay(track(over), { id: "someone" })).toBe(false);
  });

  it("downloads are off unless switched on and the rights allow it", () => {
    expect(canDownload(track(), { id: "someone" })).toBe(false);
    expect(canDownload(track({ downloadable: true }), { id: "someone" })).toBe(false);
    expect(canDownload(track({ downloadable: true, rights: rights({ allowDownload: true }) }), { id: "someone" })).toBe(true);
  });

  it("third-party types require rights details; a checkbox alone is not enough", () => {
    expect(rightsProblems("original_track", rights())).toEqual([]);
    expect(rightsProblems("dj_set", rights())).toEqual(expect.arrayContaining(["typeNeedsThirdParty", "licensor", "licenseRef", "territories"]));
    expect(rightsProblems("remix", rights({ allOriginal: false, usesThirdParty: true, licensor: "Label", licenseRef: "C-1", territories: "Worldwide" }))).toEqual([]);
    expect(rightsProblems("original_track", rights({ statement: "" }))).toContain("statement");
  });
});

describe("play counting", () => {
  const ok = { durationSec: 600, playedSeconds: 45, elapsedSeconds: 50, isOwner: false, userAgent: "Mozilla/5.0 Safari", recentQualified: false, startsLastHour: 1 };
  it("counts only after the minimum listening time", () => {
    expect(qualifyingSeconds(600)).toBe(30);
    expect(qualifyingSeconds(20)).toBe(10);
    expect(judgePlay(ok)).toEqual({ qualified: true, reason: null });
    expect(judgePlay({ ...ok, playedSeconds: 5 }).reason).toBe("short");
  });
  it("excludes owners, bots, repeats, bursts and impossible timing", () => {
    expect(judgePlay({ ...ok, isOwner: true }).reason).toBe("owner");
    expect(judgePlay({ ...ok, userAgent: "Googlebot/2.1" }).reason).toBe("bot");
    expect(judgePlay({ ...ok, userAgent: null }).reason).toBe("bot");
    expect(judgePlay({ ...ok, recentQualified: true }).reason).toBe("repeat");
    expect(judgePlay({ ...ok, startsLastHour: 61 }).reason).toBe("rate");
    expect(judgePlay({ ...ok, playedSeconds: 300, elapsedSeconds: 40 }).reason).toBe("clock");
  });
});

describe("booking state machine", () => {
  const b = (status: string, over = {}) => ({ status, kind: "booking", termsVersion: 1, djAcceptedVersion: null, ...over }) as Parameters<typeof nextStatus>[0];
  it("ACCEPTED is not CONFIRMED: only the organizer confirms, and only the accepted terms", () => {
    expect(nextStatus(b("viewed"), "accept", "dj")).toBe("accepted");
    expect(nextStatus(b("viewed"), "accept", "requester")).toBeNull();
    expect(nextStatus(b("accepted", { djAcceptedVersion: 1 }), "confirm", "dj")).toBeNull();
    expect(nextStatus(b("accepted", { djAcceptedVersion: 1 }), "confirm", "requester")).toBe("confirmed");
    expect(nextStatus(b("accepted", { termsVersion: 2, djAcceptedVersion: 1 }), "confirm", "requester")).toBeNull();
    expect(nextStatus(b("sent"), "confirm", "requester")).toBeNull();
  });
  it("counters go back to negotiating; closed requests can't move", () => {
    expect(nextStatus(b("accepted"), "counter", "requester")).toBe("negotiating");
    expect(nextStatus(b("sent"), "decline", "dj")).toBe("declined");
    expect(nextStatus(b("declined"), "accept", "dj")).toBeNull();
    expect(nextStatus(b("sent", { kind: "inquiry" }), "accept", "dj")).toBeNull();
  });
  it("open requests expire after their answer-by date", () => {
    expect(isExpired({ status: "sent", respondBy: "2020-01-01T00:00:00Z" })).toBe(true);
    expect(isExpired({ status: "confirmed", respondBy: "2020-01-01T00:00:00Z" })).toBe(false);
  });
});

describe("calendar", () => {
  const terms = (start: string, end: string) => ({ performanceStart: start, performanceEnd: end }) as never;
  it("detects blocked days and confirmed bookings, including the buffer", () => {
    const days = [{ djId: "d", day: "2026-12-05", status: "unavailable", note: "", bookingId: null }] as never[];
    expect(conflictsFor("2026-12-05T20:00:00Z", "2026-12-06T02:00:00Z", 0, days, []).map((c) => c.kind)).toContain("unavailable");
    const bookings = [{ id: "b1", status: "confirmed", terms: terms("2026-12-10T20:00:00Z", "2026-12-11T02:00:00Z") }] as never[];
    expect(conflictsFor("2026-12-11T22:00:00Z", "2026-12-12T03:00:00Z", 0, [], bookings)).toHaveLength(0);
    expect(conflictsFor("2026-12-11T22:00:00Z", "2026-12-12T03:00:00Z", 24, [], bookings).some((c) => c.bookingId === "b1")).toBe(true);
    expect(conflictsFor("2026-12-10T21:00:00Z", "2026-12-11T01:00:00Z", 0, [], bookings, "b1")).toHaveLength(0);
  });
  it("never reveals private days or why a day is blocked", () => {
    expect(publicDay({ day: "2026-12-01", status: "private" })).toEqual({ day: "2026-12-01", status: "unavailable" });
    expect(publicDay({ day: "2026-12-01", status: "booked" })).toEqual({ day: "2026-12-01", status: "unavailable" });
    expect(publicDay({ day: "2026-12-01", status: "available" })?.status).toBe("available");
  });
});

describe("rankings", () => {
  const s = (id: string, over: Partial<DjSignals> = {}): DjSignals => ({ djId: id, listeners30: 0, plays30: 0, likes30: 0, saves30: 0, bookings30: 0, listenersPrev30: 0, firstPublishedAt: "2025-01-01T00:00:00Z", ...over } as DjSignals);
  it("orders by measured activity only and drops DJs with none", () => {
    const r = rankDjs([s("a", { likes30: 3 }), s("b", { likes30: 9 }), s("c")], "liked");
    expect(r.map((x) => x.djId)).toEqual(["b", "a"]);
  });
  it("trending weights listeners and bookings over raw plays", () => {
    expect(trendingScore(s("x", { plays30: 400 }))).toBeLessThan(trendingScore(s("y", { listeners30: 20, bookings30: 1 })));
  });
});
