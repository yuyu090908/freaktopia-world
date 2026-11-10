import type { Locale } from "@/i18n/config";
import type { AlienCosmeticsPatch, AlienIdentity, AlienTraits } from "@/lib/alien/catalog";

export type Visibility = "public" | "friends" | "private";

export interface UserRecord {
  id: string;
  email: string; // lower-cased
  emailVerified: boolean;
  passwordHash: string | null; // scrypt$… never plaintext; null for provider-only accounts
  createdAt: string;
}

export interface ProfileRecord {
  userId: string;
  displayName: string | null;
  username: string | null;
  country: string | null; // ISO 3166-1 alpha-2, optional
  locale: Locale;
  favoriteGenres: string[];
  xp: number;
  revealSeen: boolean;
}

export interface PrivacyRecord {
  userId: string;
  profile: Visibility; // who can see the profile page
  avatar: Visibility; // who can see the alien
  activity: Visibility; // followed events, DAO memberships, achievements
  showCountry: boolean;
  /** Show my alien at events I joined on the WORLD MAP. Off until the user turns it on. Never GPS. */
  mapPresence: boolean;
  /** Show my alien to other people at LIVE events (otherwise I'm counted, but not drawn). */
  liveAvatar: boolean;
}

export const DEFAULT_PRIVACY: Omit<PrivacyRecord, "userId"> = {
  profile: "friends",
  avatar: "public",
  activity: "private",
  showCountry: false,
  mapPresence: false,
  liveAvatar: true,
};

export type TokenKind = "verify" | "reset";
export type AuthProvider = "google";

export interface WalletLink {
  userId: string;
  address: string; // lower-cased 0x…
  chainId: number;
  linkedAt: string;
}

export interface AuditEntry {
  at: string;
  event: string;
  userId: string | null;
  ip: string | null;
  meta: Record<string, unknown>;
}

export interface AuthStore {
  readonly kind: "memory" | "postgres";
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  /** Creates a user, profile and privacy row together. Throws EMAIL_TAKEN if the email exists. */
  createUser(input: { email: string; passwordHash: string | null; emailVerified: boolean; locale: Locale }): Promise<UserRecord>;
  setEmailVerified(userId: string): Promise<void>;
  setPassword(userId: string, hash: string | null): Promise<void>;

  findUserByProvider(provider: AuthProvider, subject: string): Promise<UserRecord | null>;
  /** Idempotent: linking the same (provider, subject) to the same user twice is a no-op. Throws PROVIDER_TAKEN for another user. */
  linkProvider(userId: string, provider: AuthProvider, subject: string, email: string | null): Promise<void>;
  providersOf(userId: string): Promise<AuthProvider[]>;

  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  getSession(tokenHash: string): Promise<{ userId: string; expiresAt: Date } | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;

  createToken(kind: TokenKind, userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /** Single use: returns the user id and marks the token used, or null if unknown, used or expired. */
  consumeToken(kind: TokenKind, tokenHash: string): Promise<string | null>;
  invalidateTokens(kind: TokenKind, userId: string): Promise<void>;

  getProfile(userId: string): Promise<ProfileRecord | null>;
  updateProfile(userId: string, patch: Partial<Omit<ProfileRecord, "userId">>): Promise<ProfileRecord>;
  getPrivacy(userId: string): Promise<PrivacyRecord>;
  updatePrivacy(userId: string, patch: Partial<Omit<PrivacyRecord, "userId">>): Promise<PrivacyRecord>;

  getAlien(userId: string): Promise<AlienIdentity | null>;
  /** Inserts only if the user has none (unique user_id); always returns the stored alien. */
  insertAlienOnce(userId: string, alien: { seed: string; traits: AlienTraits; assetVersion: number }): Promise<{ alien: AlienIdentity; created: boolean }>;
  updateAlienCosmetics(userId: string, patch: AlienCosmeticsPatch): Promise<AlienIdentity>;

  findWallet(address: string): Promise<WalletLink | null>;
  /** Throws WALLET_TAKEN if the address belongs to another user. */
  linkWallet(userId: string, address: string, chainId: number): Promise<WalletLink>;
  walletsOf(userId: string): Promise<WalletLink[]>;

  audit(entry: Omit<AuditEntry, "at">): Promise<void>;
  recentAudit(limit: number): Promise<AuditEntry[]>;
}

export class AuthError extends Error {
  constructor(public code: string, message = code) {
    super(message);
  }
}
