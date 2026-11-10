import { createHash, randomBytes } from "node:crypto";
import { ALIEN_ASSET_VERSION, traitsFromSeed, type AlienTraits } from "./catalog";

const sha256 = (s: string) => new Uint8Array(createHash("sha256").update(`freaktopia-alien:v${ALIEN_ASSET_VERSION}:${s}`).digest());

/** A new alien for a new user: 128-bit seed from the OS CSPRNG, traits derived from it. */
export function rollAlien(): { seed: string; traits: AlienTraits; assetVersion: number } {
  const seed = randomBytes(16).toString("hex");
  return { seed, traits: traitsFromSeed(seed, sha256), assetVersion: ALIEN_ASSET_VERSION };
}

export function traitsFor(seed: string) {
  return traitsFromSeed(seed, sha256);
}
