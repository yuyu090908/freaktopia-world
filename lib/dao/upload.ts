/**
 * Upload validation: the declared type is never trusted. The file signature
 * (magic bytes) must be JPEG, PNG or WebP, the size must be under the limit and the
 * image dimensions must be readable and sane. SVG and anything scriptable is rejected.
 */
import { DAO_RULES } from "./meta";

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export function sniff(b: Uint8Array): ImageMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function dimensions(b: Uint8Array, mime: ImageMime): { width: number; height: number } | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    if (mime === "image/png") return { width: dv.getUint32(16), height: dv.getUint32(20) };
    if (mime === "image/webp") {
      const chunk = String.fromCharCode(...b.slice(12, 16));
      if (chunk === "VP8X") return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
      if (chunk === "VP8 ") return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
      if (chunk === "VP8L") {
        const bits = dv.getUint32(21, true);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      return null;
    }
    // JPEG: walk segments to the first SOFn marker.
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const len = dv.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
      i += 2 + len;
    }
    return null;
  } catch {
    return null;
  }
}

export type UploadError = "EMPTY_FILE" | "FILE_TOO_LARGE" | "UNSUPPORTED_TYPE" | "TYPE_MISMATCH" | "UNREADABLE_IMAGE" | "IMAGE_TOO_SMALL" | "IMAGE_TOO_LARGE";

export function validateImage(b: Uint8Array, declared: string, maxBytes: number = DAO_RULES.maxUploadBytes): { ok: true; mime: ImageMime; width: number; height: number } | { ok: false; code: UploadError } {
  if (!b.length) return { ok: false, code: "EMPTY_FILE" };
  if (b.length > maxBytes) return { ok: false, code: "FILE_TOO_LARGE" };
  const mime = sniff(b);
  if (!mime) return { ok: false, code: "UNSUPPORTED_TYPE" };
  if (declared && declared !== mime && !(declared === "image/jpg" && mime === "image/jpeg")) return { ok: false, code: "TYPE_MISMATCH" };
  const d = dimensions(b, mime);
  if (!d || !d.width || !d.height) return { ok: false, code: "UNREADABLE_IMAGE" };
  if (d.width < 320 || d.height < 200) return { ok: false, code: "IMAGE_TOO_SMALL" };
  if (d.width > 12_000 || d.height > 12_000) return { ok: false, code: "IMAGE_TOO_LARGE" };
  return { ok: true, mime, ...d };
}

export const UPLOAD_ERROR_TEXT: Record<UploadError, string> = {
  EMPTY_FILE: "The file is empty.",
  FILE_TOO_LARGE: `Files must be ${DAO_RULES.maxUploadBytes / 1024 / 1024} MB or smaller.`,
  UNSUPPORTED_TYPE: "Only JPEG, PNG or WebP photos are accepted.",
  TYPE_MISMATCH: "The file contents do not match its file type.",
  UNREADABLE_IMAGE: "The image could not be read.",
  IMAGE_TOO_SMALL: "Photos must be at least 320×200 px.",
  IMAGE_TOO_LARGE: "Photos must be at most 12000 px on each side.",
};
