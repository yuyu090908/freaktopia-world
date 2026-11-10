import { randomUUID } from "node:crypto";
import { formatAlienPublicId, type AlienIdentity } from "@/lib/alien/catalog";
import { AuthError, DEFAULT_PRIVACY, type AuditEntry, type AuthProvider, laterStep, type AuthStore, type PrivacyRecord, type ProfileRecord, type TokenKind, type UserRecord, type WalletLink } from "./types";

interface Db {
  users: Map<string, UserRecord>;
  byEmail: Map<string, string>;
  profiles: Map<string, ProfileRecord>;
  privacy: Map<string, PrivacyRecord>;
  providers: Map<string, { userId: string; email: string | null }>; // `${provider}:${subject}`
  sessions: Map<string, { userId: string; expiresAt: Date }>;
  tokens: Map<string, { kind: TokenKind; userId: string; expiresAt: Date; used: boolean }>;
  aliens: Map<string, AlienIdentity>;
  wallets: Map<string, WalletLink>;
  audit: AuditEntry[];
  publicSeq: number;
}

const g = globalThis as unknown as { __fkAuthDb?: Db };

function db(): Db {
  g.__fkAuthDb ??= {
    users: new Map(), byEmail: new Map(), profiles: new Map(), privacy: new Map(), providers: new Map(),
    sessions: new Map(), tokens: new Map(), aliens: new Map(), wallets: new Map(), audit: [], publicSeq: 1000,
  };
  return g.__fkAuthDb;
}

/** Test helper: wipes the in-memory demo store. */
export function resetMemoryStore() {
  g.__fkAuthDb = undefined;
}

/**
 * DEMO store. Lives in the memory of one server instance: data resets on deploy/restart and is not shared
 * between serverless instances. Used only when DATABASE_URL is not set.
 */
export const memoryStore: AuthStore = {
  kind: "memory",
  async findUserByEmail(email) {
    const id = db().byEmail.get(email.toLowerCase());
    return id ? db().users.get(id) ?? null : null;
  },
  async findUserById(id) {
    return db().users.get(id) ?? null;
  },
  async createUser({ email, passwordHash, emailVerified, locale }) {
    const d = db();
    const e = email.toLowerCase();
    if (d.byEmail.has(e)) throw new AuthError("EMAIL_TAKEN");
    const u: UserRecord = { id: randomUUID(), email: e, emailVerified, passwordHash, createdAt: new Date().toISOString() };
    d.users.set(u.id, u);
    d.byEmail.set(e, u.id);
    d.profiles.set(u.id, { userId: u.id, displayName: null, username: null, country: null, locale, favoriteGenres: [], xp: 0, revealSeen: false, onboardingStep: "reveal" });
    d.privacy.set(u.id, { userId: u.id, ...DEFAULT_PRIVACY });
    return { ...u };
  },
  async setEmailVerified(userId) {
    const u = db().users.get(userId);
    if (u) u.emailVerified = true;
  },
  async setPassword(userId, hash) {
    const u = db().users.get(userId);
    if (u) u.passwordHash = hash;
  },
  async findUserByProvider(provider, subject) {
    const p = db().providers.get(`${provider}:${subject}`);
    return p ? db().users.get(p.userId) ?? null : null;
  },
  async linkProvider(userId, provider, subject, email) {
    const k = `${provider}:${subject}`;
    const cur = db().providers.get(k);
    if (cur && cur.userId !== userId) throw new AuthError("PROVIDER_TAKEN");
    if (!cur) db().providers.set(k, { userId, email });
  },
  async providersOf(userId) {
    return [...db().providers.entries()].filter(([, v]) => v.userId === userId).map(([k]) => k.split(":")[0] as AuthProvider);
  },
  async createSession(userId, tokenHash, expiresAt) {
    db().sessions.set(tokenHash, { userId, expiresAt });
  },
  async getSession(tokenHash) {
    const s = db().sessions.get(tokenHash);
    if (!s) return null;
    if (s.expiresAt.getTime() <= Date.now()) {
      db().sessions.delete(tokenHash);
      return null;
    }
    return { ...s };
  },
  async deleteSession(tokenHash) {
    db().sessions.delete(tokenHash);
  },
  async deleteUserSessions(userId) {
    for (const [k, v] of db().sessions) if (v.userId === userId) db().sessions.delete(k);
  },
  async createToken(kind, userId, tokenHash, expiresAt) {
    db().tokens.set(tokenHash, { kind, userId, expiresAt, used: false });
  },
  async consumeToken(kind, tokenHash) {
    const t = db().tokens.get(tokenHash);
    if (!t || t.kind !== kind || t.used || t.expiresAt.getTime() <= Date.now()) return null;
    t.used = true;
    return t.userId;
  },
  async invalidateTokens(kind, userId) {
    for (const t of db().tokens.values()) if (t.kind === kind && t.userId === userId) t.used = true;
  },
  async getProfile(userId) {
    const p = db().profiles.get(userId);
    return p ? { ...p, favoriteGenres: [...p.favoriteGenres] } : null;
  },
  async updateProfile(userId, patch) {
    const p = db().profiles.get(userId);
    if (!p) throw new AuthError("NOT_FOUND");
    if (patch.username) {
      const taken = [...db().profiles.values()].some((x) => x.userId !== userId && x.username?.toLowerCase() === patch.username!.toLowerCase());
      if (taken) throw new AuthError("USERNAME_TAKEN");
    }
    const { onboardingStep, revealSeen, ...rest } = patch;
    Object.assign(p, rest);
    let step = p.onboardingStep;
    if (revealSeen) step = laterStep(step, "name");
    if (onboardingStep) step = laterStep(step, onboardingStep);
    p.onboardingStep = step;
    p.revealSeen = step !== "reveal";
    return { ...p };
  },
  async getPrivacy(userId) {
    return { ...(db().privacy.get(userId) ?? { userId, ...DEFAULT_PRIVACY }) };
  },
  async updatePrivacy(userId, patch) {
    const cur = db().privacy.get(userId) ?? { userId, ...DEFAULT_PRIVACY };
    const next = { ...cur, ...patch, userId };
    db().privacy.set(userId, next);
    return { ...next };
  },
  async getAlien(userId) {
    const a = db().aliens.get(userId);
    return a ? { ...a } : null;
  },
  async findAlienByPublicId(publicId) {
    for (const a of db().aliens.values()) if (a.publicId === publicId) return { ...a };
    return null;
  },
  async insertAlienOnce(userId, { seed, traits, assetVersion }) {
    // Check-and-set runs without an await in between: atomic in one Node process (like a unique index).
    const existing = db().aliens.get(userId);
    if (existing) return { alien: { ...existing }, created: false };
    const a: AlienIdentity = { ...traits, userId, publicId: formatAlienPublicId(++db().publicSeq), seed, assetVersion, createdAt: new Date().toISOString() };
    db().aliens.set(userId, a);
    return { alien: { ...a }, created: true };
  },
  async updateAlienCosmetics(userId, patch) {
    const a = db().aliens.get(userId);
    if (!a) throw new AuthError("NO_ALIEN");
    if (patch.outfit !== undefined) a.outfit = patch.outfit;
    if (patch.outfitColor !== undefined) a.outfitColor = patch.outfitColor;
    if (patch.accessory !== undefined) a.accessory = patch.accessory;
    return { ...a };
  },
  async findWallet(address) {
    return db().wallets.get(address.toLowerCase()) ?? null;
  },
  async linkWallet(userId, address, chainId) {
    const a = address.toLowerCase();
    const cur = db().wallets.get(a);
    if (cur && cur.userId !== userId) throw new AuthError("WALLET_TAKEN");
    if (cur) return cur;
    const w: WalletLink = { userId, address: a, chainId, linkedAt: new Date().toISOString() };
    db().wallets.set(a, w);
    return w;
  },
  async walletsOf(userId) {
    return [...db().wallets.values()].filter((w) => w.userId === userId);
  },
  async audit(entry) {
    const d = db();
    d.audit.push({ ...entry, at: new Date().toISOString() });
    if (d.audit.length > 2000) d.audit.splice(0, d.audit.length - 2000);
  },
  async recentAudit(limit) {
    return db().audit.slice(-limit).reverse();
  },
};
