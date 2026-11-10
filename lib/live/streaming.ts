/**
 * Streaming abstraction. A stage stream is only playable (and only labelled LIVE)
 * when a provider is configured AND the rights are confirmed.
 *
 * Provider comparison (for the production decision):
 * - Mux Live: RTMP/SRT ingest from the venue → HLS playback (8–20 s latency, ~3–5 s with
 *   low-latency HLS), adaptive bitrate, recordings as assets, signed playback for paid access.
 *   Best fit for "watch the DJ set" (one-to-many, many viewers, recordings on/off per set).
 * - LiveKit: WebRTC SFU, sub-second latency, rooms with publish/subscribe permissions.
 *   Best fit for interactive rooms (DJ talk-back, B2B remote sets); egress to HLS for scale.
 * Recommendation: Mux for stage playback + LiveKit (optional) for interactive rooms.
 * Both sit behind StreamProvider so the UI never depends on a vendor.
 */
import type { LiveStream, StreamProviderKind, StreamRights } from "./types";

export interface Playback {
  kind: "hls" | "webrtc" | "demo";
  url: string | null;
  /** Signed / tokenized playback (paid streams). */
  token?: string;
}

export interface StreamProvider {
  kind: StreamProviderKind;
  configured: boolean;
  playback(stream: LiveStream): Promise<Playback>;
}

class NotConfigured extends Error {
  code = "STREAM_PROVIDER_NOT_CONFIGURED";
}

const mux: StreamProvider = {
  kind: "mux",
  configured: !!process.env.MUX_TOKEN_ID && !!process.env.MUX_TOKEN_SECRET,
  async playback() {
    throw new NotConfigured("Mux playback is not implemented in this build.");
  },
};

const livekit: StreamProvider = {
  kind: "livekit",
  configured: !!process.env.LIVEKIT_URL && !!process.env.LIVEKIT_API_KEY && !!process.env.LIVEKIT_API_SECRET,
  async playback() {
    throw new NotConfigured("LiveKit playback is not implemented in this build.");
  },
};

const demo: StreamProvider = {
  kind: "demo",
  configured: true,
  async playback() {
    return { kind: "demo", url: null };
  },
};

export function providerFor(kind: StreamProviderKind): StreamProvider | null {
  if (kind === "mux") return mux;
  if (kind === "livekit") return livekit;
  if (kind === "demo") return demo;
  return null;
}

export const DEMO_RIGHTS: StreamRights = { broadcastConsent: false, musicLicensed: false, recordingAllowed: false, territories: [] };

/** A stream may be presented as a real LIVE stream only when all of these hold. */
export function isRealLive(s: LiveStream) {
  const p = providerFor(s.provider);
  return !!p && p.kind !== "demo" && p.configured && !!s.playbackId && s.rights.broadcastConsent && s.rights.musicLicensed;
}

export function configuredProvider(): StreamProviderKind {
  const pref = process.env.LIVE_STREAM_PROVIDER as StreamProviderKind | undefined;
  if (pref === "mux" && mux.configured) return "mux";
  if (pref === "livekit" && livekit.configured) return "livekit";
  return "demo";
}
