/**
 * MP3 inspection without decoding. Runs in the browser (early check, step 2) and on the server on the stored
 * object (the check that counts, step 6). Pure TypeScript over byte arrays: no native code, no new dependency.
 *
 * What it checks: known executable/script/archive signatures (rejected), other audio containers (unsupported
 * for now), the ID3v2 tag, a run of consecutive valid MPEG-1/2/2.5 Layer III frames with the same stream
 * parameters (not just a lucky sync word), the Xing/Info/VBRI header for the real duration, and the end of the
 * file for truncation. It does not decode audio and is not an antivirus engine.
 */
import type { CodecInfo } from "./types";

export type Mp3Error = "EMPTY" | "DANGEROUS_FILE" | "UNSUPPORTED_FORMAT" | "NOT_MP3" | "CORRUPT" | "NEED_MORE";

export interface Mp3Head {
  ok: true;
  /** Byte offset of the first audio frame (after the ID3v2 tag). */
  audioStart: number;
  codec: CodecInfo;
  /** From the Xing/Info/VBRI header when present. */
  frames: number | null;
  streamBytes: number | null;
}

const BITRATES: Record<"1" | "2", number[]> = {
  "1": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1],
  "2": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1],
};
const RATES: Record<"1" | "2" | "2.5", number[]> = { "1": [44100, 48000, 32000], "2": [22050, 24000, 16000], "2.5": [11025, 12000, 8000] };

interface Frame { version: "1" | "2" | "2.5"; bitrate: number; sampleRate: number; channels: 1 | 2; length: number; padding: number }

export function parseFrame(b: Uint8Array, i: number): Frame | null {
  if (i + 4 > b.length) return null;
  if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null;
  const v = (b[i + 1] >> 3) & 3;
  const layer = (b[i + 1] >> 1) & 3;
  if (v === 1 || layer !== 1) return null; // reserved version, or not Layer III
  const version = v === 3 ? "1" : v === 2 ? "2" : "2.5";
  const bi = b[i + 2] >> 4;
  const si = (b[i + 2] >> 2) & 3;
  if (bi === 0 || bi === 15 || si === 3) return null; // free-format and bad values are not accepted
  const bitrate = BITRATES[version === "1" ? "1" : "2"][bi];
  const sampleRate = RATES[version][si];
  const padding = (b[i + 2] >> 1) & 1;
  const channels = ((b[i + 3] >> 6) & 3) === 3 ? 1 : 2;
  const length = Math.floor(((version === "1" ? 144 : 72) * bitrate * 1000) / sampleRate) + padding;
  if (length < 24) return null;
  return { version, bitrate, sampleRate, channels, length, padding };
}

const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

/** Executables, scripts, archives and documents disguised as audio. */
export function dangerousSignature(b: Uint8Array): string | null {
  const s = ascii(b, 0, Math.min(64, b.length));
  if (s.startsWith("MZ")) return "windows-executable";
  if (s.startsWith("\x7fELF")) return "elf-executable";
  if ([0xcafebabe, 0xcffaedfe, 0xcefaedfe, 0xfeedface, 0xfeedfacf].includes(u32(b, 0))) return "mach-o";
  if (s.startsWith("PK\x03\x04") || s.startsWith("PK\x05\x06")) return "zip";
  if (s.startsWith("Rar!") || s.startsWith("7z\xbc\xaf")) return "archive";
  if (s.startsWith("%PDF")) return "pdf";
  if (s.startsWith("#!")) return "script";
  if (s.startsWith("{\\rtf")) return "rtf";
  const t = s.trimStart().toLowerCase();
  if (t.startsWith("<?php") || t.startsWith("<html") || t.startsWith("<!doctype") || t.startsWith("<script") || t.startsWith("<svg") || t.startsWith("<?xml")) return "markup";
  return null;
}

/** Other audio/video containers: refused for now (MP3 only in this version), with a clear message. */
export function otherContainer(b: Uint8Array): string | null {
  const s = ascii(b, 0, Math.min(16, b.length));
  if (s.startsWith("RIFF") && ascii(b, 8, 4) === "WAVE") return "wav";
  if (s.startsWith("FORM") && ["AIFF", "AIFC"].includes(ascii(b, 8, 4))) return "aiff";
  if (s.startsWith("fLaC")) return "flac";
  if (s.startsWith("OggS")) return "ogg";
  if (ascii(b, 4, 4) === "ftyp") return "mp4";
  if (u32(b, 0) === 0x1a45dfa3) return "webm";
  return null;
}

/** Size of the ID3v2 tag at the start (0 if none). Syncsafe integer; footer flag adds 10 bytes. */
export function id3Size(b: Uint8Array) {
  if (b.length < 10 || ascii(b, 0, 3) !== "ID3") return 0;
  if ([6, 7, 8, 9].some((i) => b[i] & 0x80)) return -1;
  const size = (b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9];
  return 10 + size + (b[5] & 0x10 ? 10 : 0);
}

const RUN = 6; // consecutive frames with the same stream parameters

function frameRun(b: Uint8Array, at: number, need: number) {
  const first = parseFrame(b, at);
  if (!first) return null;
  let i = at;
  for (let n = 0; n < need; n++) {
    const f = parseFrame(b, i);
    if (!f || f.version !== first.version || f.sampleRate !== first.sampleRate) return null;
    i += f.length;
    if (i > b.length && n < need - 1) return null;
  }
  return first;
}

/**
 * Inspects the start of the file. `head` must contain at least the ID3 tag plus ~64 KB; if the tag is larger
 * than what was read the result is NEED_MORE with the offset to read from.
 */
export function inspectHead(head: Uint8Array, opts: { offset?: number } = {}): Mp3Head | { ok: false; error: Mp3Error; detail?: string; needFrom?: number } {
  if (head.length < 128) return { ok: false, error: "EMPTY" };
  if (!opts.offset) {
    const danger = dangerousSignature(head);
    if (danger) return { ok: false, error: "DANGEROUS_FILE", detail: danger };
    const other = otherContainer(head);
    if (other) return { ok: false, error: "UNSUPPORTED_FORMAT", detail: other };
  }
  const tag = opts.offset ? 0 : id3Size(head);
  if (tag < 0) return { ok: false, error: "CORRUPT", detail: "id3" };
  if (tag + 4096 > head.length && !opts.offset) return { ok: false, error: "NEED_MORE", needFrom: tag };
  // Search the first 64 KB after the tag for a run of valid frames (some encoders pad before the first frame).
  const limit = Math.min(head.length - 4, tag + 65_536);
  for (let i = tag; i < limit; i++) {
    if (head[i] !== 0xff) continue;
    const f = frameRun(head, i, RUN);
    if (!f) continue;
    const sideInfo = f.version === "1" ? (f.channels === 1 ? 17 : 32) : f.channels === 1 ? 9 : 17;
    const x = i + 4 + sideInfo;
    let frames: number | null = null;
    let streamBytes: number | null = null;
    let vbr = false;
    const tagName = ascii(head, x, 4);
    if (tagName === "Xing" || tagName === "Info") {
      const flags = u32(head, x + 4);
      let p = x + 8;
      if (flags & 1) { frames = u32(head, p); p += 4; }
      if (flags & 2) { streamBytes = u32(head, p); }
      vbr = tagName === "Xing";
    } else if (ascii(head, i + 36, 4) === "VBRI") {
      streamBytes = u32(head, i + 36 + 10);
      frames = u32(head, i + 36 + 14);
      vbr = true;
    }
    return {
      ok: true,
      audioStart: (opts.offset ?? 0) + i,
      codec: { mpegVersion: f.version, layer: 3, bitrateKbps: f.bitrate, sampleRate: f.sampleRate, channels: f.channels, vbr },
      frames: frames && frames > 0 ? frames : null,
      streamBytes: streamBytes && streamBytes > 0 ? streamBytes : null,
    };
  }
  return { ok: false, error: "NOT_MP3" };
}

/** Duration in seconds: exact from the frame count when present, otherwise from size and constant bitrate. */
export function durationOf(h: Mp3Head, totalBytes: number) {
  const spf = h.codec.mpegVersion === "1" ? 1152 : 576;
  if (h.frames) return (h.frames * spf) / h.codec.sampleRate;
  const audioBytes = Math.max(0, totalBytes - h.audioStart);
  return (audioBytes * 8) / (h.codec.bitrateKbps * 1000);
}

/**
 * The end of the file must still be MP3 frames (a cut-off upload or a file with junk appended fails here).
 * ID3v1 ("TAG", 128 bytes) and APEv2 footers at the end are allowed.
 */
export function tailLooksValid(tail: Uint8Array) {
  let end = tail.length;
  if (end >= 128 && ascii(tail, end - 128, 3) === "TAG") end -= 128;
  if (end >= 32 && ascii(tail, end - 32, 8) === "APETAGEX") {
    const size = tail[end - 20] | (tail[end - 19] << 8) | (tail[end - 18] << 16) | (tail[end - 17] << 24);
    end -= Math.min(end, size + 32);
  }
  const b = tail.subarray(0, end);
  for (let i = 0; i < b.length - 4; i++) {
    if (b[i] !== 0xff) continue;
    const f = frameRun(b, i, 3);
    if (!f) continue;
    // Walk to the end: the last frame must end at (or within one frame of) the end of the audio.
    let p = i;
    let last = f;
    for (;;) {
      const g = parseFrame(b, p);
      if (!g) break;
      last = g;
      p += g.length;
      if (p >= b.length) break;
    }
    return p >= b.length - last.length;
  }
  return false;
}

/** Full verdict from the head, the tail and the real size. */
export function verifyMp3(head: Uint8Array, tail: Uint8Array, totalBytes: number, limits: { maxSeconds: number }) {
  const h = inspectHead(head);
  if (!h.ok) return h;
  if (h.streamBytes && totalBytes < h.audioStart + h.streamBytes * 0.97) return { ok: false as const, error: "CORRUPT" as const, detail: "truncated" };
  if (!tailLooksValid(tail)) return { ok: false as const, error: "CORRUPT" as const, detail: "tail" };
  const durationSec = Math.round(durationOf(h, totalBytes));
  if (durationSec < 1) return { ok: false as const, error: "CORRUPT" as const, detail: "duration" };
  if (durationSec > limits.maxSeconds) return { ok: false as const, error: "TOO_LONG" as const, durationSec };
  return { ok: true as const, durationSec, codec: h.codec, audioStart: h.audioStart };
}
