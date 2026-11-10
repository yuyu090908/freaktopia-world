import { Pool, type PoolClient } from "pg";
import type { AlienIdentity } from "@/lib/alien/catalog";
import type { Locale } from "@/i18n/config";
import { AuthError, DEFAULT_PRIVACY, laterStep, type AuthStore, type OnboardingStep, type PrivacyRecord, type ProfileRecord, type UserRecord } from "./types";

/** PostgreSQL store (db/migrations/0005_identity_i18n.sql). Selected when DATABASE_URL is set. */
export function createPgStore(connectionString: string): AuthStore {
  const pool = new Pool({ connectionString, max: 5 });
  const q = <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => pool.query(sql, args).then((r) => r.rows as T[]);
  const tx = async <T>(fn: (c: PoolClient) => Promise<T>) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      const r = await fn(c);
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  };
  const user = (r: Record<string, unknown> | undefined): UserRecord | null =>
    r ? { id: String(r.id), email: String(r.email), emailVerified: r.email_verified_at != null, passwordHash: (r.password_hash as string) ?? null, createdAt: new Date(r.created_at as string).toISOString() } : null;
  const alien = (r: Record<string, unknown> | undefined): AlienIdentity | null =>
    r
      ? ({
          userId: String(r.user_id), publicId: String(r.public_id), name: r.alien_name, family: r.alien_family, bodyColor: r.body_color, accentColor: r.accent_color,
          eyes: r.eye_variant, mouth: r.mouth_variant, pattern: r.pattern_variant, accessory: r.accessory_variant, outfit: r.outfit_variant,
          outfitColor: r.outfit_color, special: r.special_variant, seed: String(r.generation_seed), assetVersion: Number(r.asset_version),
          createdAt: new Date(r.created_at as string).toISOString(),
        } as AlienIdentity)
      : null;
  const isUnique = (e: unknown) => (e as { code?: string })?.code === "23505";
  // Onboarding lives in user_onboarding_progress (0006). A profile without a row (created before 0006 by an old
// deploy) falls back to the 8.0 reveal_seen flag, so nobody is sent back to the Reveal.
const PROFILE_SQL = `select p.*, coalesce(pr.locale, 'en') as locale,
    coalesce(o.step, case when p.reveal_seen then 'name' else 'reveal' end) as onboarding_step
  from user_profiles p left join user_preferences pr using (user_id) left join user_onboarding_progress o using (user_id) where p.user_id = $1`;
  const profile = (r: Record<string, unknown> | undefined): ProfileRecord | null =>
    r ? { userId: String(r.user_id), displayName: (r.display_name as string) ?? null, username: (r.username as string) ?? null, country: (r.country_code as string) ?? null, locale: r.locale as Locale, favoriteGenres: (r.favorite_genres as string[]) ?? [], xp: Number(r.xp), revealSeen: r.onboarding_step !== "reveal", onboardingStep: r.onboarding_step as OnboardingStep } : null;
  const privacy = (r: Record<string, unknown> | undefined, userId: string): PrivacyRecord =>
    r ? { userId, profile: r.profile as PrivacyRecord["profile"], avatar: r.avatar as PrivacyRecord["avatar"], activity: r.activity as PrivacyRecord["activity"], showCountry: Boolean(r.show_country), mapPresence: Boolean(r.map_presence), liveAvatar: Boolean(r.live_avatar) } : { userId, ...DEFAULT_PRIVACY };

  return {
    kind: "postgres",
    async findUserByEmail(email) {
      return user((await q(`select * from users where email = $1`, [email.toLowerCase()]))[0]);
    },
    async findUserById(id) {
      return user((await q(`select * from users where id = $1`, [id]))[0]);
    },
    async createUser({ email, passwordHash, emailVerified, locale }) {
      try {
        return await tx(async (c) => {
          const u = (await c.query(`insert into users (email, password_hash, email_verified_at) values ($1, $2, $3) returning *`, [email.toLowerCase(), passwordHash, emailVerified ? new Date() : null])).rows[0];
          await c.query(`insert into user_profiles (user_id) values ($1)`, [u.id]);
          await c.query(`insert into user_preferences (user_id, locale) values ($1, $2)`, [u.id, locale]);
          await c.query(`insert into user_privacy_settings (user_id) values ($1)`, [u.id]);
          await c.query(`insert into user_onboarding_progress (user_id) values ($1)`, [u.id]);
          return user(u)!;
        });
      } catch (e) {
        if (isUnique(e)) throw new AuthError("EMAIL_TAKEN");
        throw e;
      }
    },
    async setEmailVerified(userId) {
      await q(`update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1`, [userId]);
    },
    async setPassword(userId, hash) {
      await q(`update users set password_hash = $2 where id = $1`, [userId, hash]);
    },
    async findUserByProvider(provider, subject) {
      return user((await q(`select u.* from user_auth_providers p join users u on u.id = p.user_id where p.provider = $1 and p.subject = $2`, [provider, subject]))[0]);
    },
    async linkProvider(userId, provider, subject, email) {
      const rows = await q<{ user_id: string }>(
        `insert into user_auth_providers (provider, subject, user_id, email) values ($1, $2, $3, $4)
         on conflict (provider, subject) do update set email = excluded.email returning user_id`,
        [provider, subject, userId, email],
      ).catch((e) => {
        if (isUnique(e)) throw new AuthError("PROVIDER_TAKEN");
        throw e;
      });
      if (rows[0]?.user_id !== userId) throw new AuthError("PROVIDER_TAKEN");
    },
    async providersOf(userId) {
      return (await q<{ provider: "google" }>(`select provider from user_auth_providers where user_id = $1`, [userId])).map((r) => r.provider);
    },
    async createSession(userId, tokenHash, expiresAt) {
      await q(`insert into auth_sessions (token_hash, user_id, expires_at) values ($1, $2, $3)`, [tokenHash, userId, expiresAt]);
    },
    async getSession(tokenHash) {
      const r = (await q<{ user_id: string; expires_at: Date }>(`select user_id, expires_at from auth_sessions where token_hash = $1 and expires_at > now()`, [tokenHash]))[0];
      return r ? { userId: r.user_id, expiresAt: new Date(r.expires_at) } : null;
    },
    async deleteSession(tokenHash) {
      await q(`delete from auth_sessions where token_hash = $1`, [tokenHash]);
    },
    async deleteUserSessions(userId) {
      await q(`delete from auth_sessions where user_id = $1`, [userId]);
    },
    async createToken(kind, userId, tokenHash, expiresAt) {
      await q(`insert into auth_tokens (token_hash, kind, user_id, expires_at) values ($1, $2, $3, $4)`, [tokenHash, kind, userId, expiresAt]);
    },
    async consumeToken(kind, tokenHash) {
      const r = await q<{ user_id: string }>(`update auth_tokens set used_at = now() where token_hash = $1 and kind = $2 and used_at is null and expires_at > now() returning user_id`, [tokenHash, kind]);
      return r[0]?.user_id ?? null;
    },
    async invalidateTokens(kind, userId) {
      await q(`update auth_tokens set used_at = now() where user_id = $1 and kind = $2 and used_at is null`, [userId, kind]);
    },
    async getProfile(userId) {
      return profile((await q(PROFILE_SQL, [userId]))[0]);
    },
    async updateProfile(userId, patch) {
      const map: Record<string, string> = { displayName: "display_name", username: "username", country: "country_code", favoriteGenres: "favorite_genres", xp: "xp" };
      const sets: string[] = [];
      const args: unknown[] = [userId];
      for (const [k, col] of Object.entries(map)) {
        if (k in patch) {
          args.push((patch as Record<string, unknown>)[k]);
          sets.push(`${col} = $${args.length}`);
        }
      }
      try {
        if (sets.length) await q(`update user_profiles set ${sets.join(", ")}, updated_at = now() where user_id = $1`, args);
      } catch (e) {
        if (isUnique(e)) throw new AuthError("USERNAME_TAKEN");
        throw e;
      }
      let step: OnboardingStep | undefined = patch.onboardingStep;
      if (patch.revealSeen) step = step ? laterStep(step, "name") : "name";
      if (step) {
        // Forward-only, in SQL so two tabs cannot move each other backwards.
        await q(
          `insert into user_onboarding_progress (user_id, step) values ($1, $2)
           on conflict (user_id) do update set step = case
             when array_position(array['reveal','name','genres','done'], excluded.step) > array_position(array['reveal','name','genres','done'], user_onboarding_progress.step)
             then excluded.step else user_onboarding_progress.step end, updated_at = now()`,
          [userId, step],
        );
        await q(
          `update user_onboarding_progress set revealed_at = coalesce(revealed_at, case when step <> 'reveal' then now() end),
             named_at = coalesce(named_at, case when step in ('genres','done') then now() end),
             genres_at = coalesce(genres_at, case when step = 'done' then now() end),
             completed_at = coalesce(completed_at, case when step = 'done' then now() end) where user_id = $1`,
          [userId],
        );
        if (step !== "reveal") await q(`update user_profiles set reveal_seen = true where user_id = $1 and not reveal_seen`, [userId]);
      }
      if (patch.locale) await q(`insert into user_preferences (user_id, locale) values ($1, $2) on conflict (user_id) do update set locale = excluded.locale, updated_at = now()`, [userId, patch.locale]);
      const p = await this.getProfile(userId);
      if (!p) throw new AuthError("NOT_FOUND");
      return p;
    },
    async getPrivacy(userId) {
      return privacy((await q(`select * from user_privacy_settings where user_id = $1`, [userId]))[0], userId);
    },
    async updatePrivacy(userId, patch) {
      const next = { ...(await this.getPrivacy(userId)), ...patch };
      await q(
        `insert into user_privacy_settings (user_id, profile, avatar, activity, show_country, map_presence, live_avatar) values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (user_id) do update set profile = $2, avatar = $3, activity = $4, show_country = $5, map_presence = $6, live_avatar = $7, updated_at = now()`,
        [userId, next.profile, next.avatar, next.activity, next.showCountry, next.mapPresence, next.liveAvatar],
      );
      return next;
    },
    async getAlien(userId) {
      return alien((await q(`select * from user_alien_identities where user_id = $1`, [userId]))[0]);
    },
    async findAlienByPublicId(publicId) {
      return alien((await q(`select * from user_alien_identities where public_id = $1`, [publicId]))[0]);
    },
    async insertAlienOnce(userId, { seed, traits: t, assetVersion }) {
      // The primary key on user_id makes concurrent first logins (two tabs, a replayed OAuth callback) safe.
      const ins = await q(
        `insert into user_alien_identities (user_id, alien_name, alien_family, body_color, accent_color, eye_variant, mouth_variant, pattern_variant,
           accessory_variant, outfit_variant, outfit_color, special_variant, generation_seed, asset_version)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) on conflict (user_id) do nothing returning *`,
        [userId, t.name, t.family, t.bodyColor, t.accentColor, t.eyes, t.mouth, t.pattern, t.accessory, t.outfit, t.outfitColor, t.special, seed, assetVersion],
      );
      if (ins[0]) return { alien: alien(ins[0])!, created: true };
      return { alien: (await this.getAlien(userId))!, created: false };
    },
    async updateAlienCosmetics(userId, patch) {
      const r = await q(
        `update user_alien_identities set outfit_variant = coalesce($2, outfit_variant), outfit_color = coalesce($3, outfit_color),
           accessory_variant = coalesce($4, accessory_variant), updated_at = now() where user_id = $1 returning *`,
        [userId, patch.outfit ?? null, patch.outfitColor ?? null, patch.accessory ?? null],
      );
      if (!r[0]) throw new AuthError("NO_ALIEN");
      return alien(r[0])!;
    },
    async findWallet(address) {
      const r = (await q(`select * from user_wallet_links where address = $1`, [address.toLowerCase()]))[0];
      return r ? { userId: String(r.user_id), address: String(r.address), chainId: Number(r.chain_id), linkedAt: new Date(r.linked_at as string).toISOString() } : null;
    },
    async linkWallet(userId, address, chainId) {
      const a = address.toLowerCase();
      await q(`insert into user_wallet_links (address, chain_id, user_id) values ($1, $2, $3) on conflict (address) do nothing`, [a, chainId, userId]);
      const w = await this.findWallet(a);
      if (!w || w.userId !== userId) throw new AuthError("WALLET_TAKEN");
      return w;
    },
    async walletsOf(userId) {
      return (await q(`select * from user_wallet_links where user_id = $1 order by linked_at`, [userId])).map((r) => ({ userId, address: String(r.address), chainId: Number(r.chain_id), linkedAt: new Date(r.linked_at as string).toISOString() }));
    },
    async audit(e) {
      await q(`insert into auth_audit_log (event, user_id, ip, meta) values ($1, $2, $3, $4)`, [e.event, e.userId, e.ip, JSON.stringify(e.meta)]);
    },
    async recentAudit(limit) {
      return (await q(`select * from auth_audit_log order by id desc limit $1`, [limit])).map((r) => ({ at: new Date(r.at as string).toISOString(), event: String(r.event), userId: (r.user_id as string) ?? null, ip: (r.ip as string) ?? null, meta: r.meta as Record<string, unknown> }));
    },
  };
}
