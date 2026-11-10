import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import { COLOR_KEYS, OUTFITS, toLook, validateCosmetics } from "@/lib/alien/catalog";
import { me } from "@/lib/auth/me";
import { authConfig } from "@/lib/auth/config";
import { currentUser, fail, ok, readJson, sameOrigin, limit } from "@/lib/auth/http";
import { getStore } from "@/lib/auth/store";
import { AuthError } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ path?: string[] }> };

const zVis = z.enum(["public", "friends", "private"]);
const zProfile = z
  .object({
    displayName: z.string().trim().min(1).max(32).regex(/^[^<>\u0000-\u001f]+$/u),
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/),
    country: z.string().regex(/^[A-Z]{2}$/).nullable(),
    favoriteGenres: z.array(z.string().max(32)).max(12),
    revealSeen: z.literal(true),
    onboardingStep: z.enum(["name", "genres", "done"]), // forward only; "reveal" cannot be requested
  })
  .partial()
  .strict();
const zPrivacy = z.object({ profile: zVis, avatar: zVis, activity: zVis, showCountry: z.boolean(), mapPresence: z.boolean(), liveAvatar: z.boolean() }).partial().strict();
const zAlien = z.object({ outfit: z.enum(OUTFITS as [string, ...string[]]), outfitColor: z.enum(COLOR_KEYS as [string, ...string[]]), accessory: z.string().max(20) }).partial().strict();

export async function GET(_req: Request, { params }: Params) {
  const path = (await params).path?.join("/") ?? "";
  if (path !== "") return fail(404, "NOT_FOUND");
  const config = authConfig();
  const user = await currentUser();
  if (!user) return ok({ signedIn: false, config });
  return ok({ signedIn: true, config, ...(await me(user.id)) });
}

export async function PATCH(req: Request, { params }: Params) {
  const path = (await params).path?.join("/") ?? "";
  if (!sameOrigin(req)) return fail(403, "CSRF");
  const user = await currentUser();
  if (!user) return fail(401, "SIGN_IN_REQUIRED");
  const lim = limit("me", user.id, 60, 60_000);
  if (lim) return lim;
  const body = await readJson(req);
  if (!body) return fail(400, "INVALID_BODY");
  const store = getStore();
  const audit = (event: string, meta: Record<string, unknown>) => store.audit({ event, userId: user.id, ip: null, meta }).catch(() => undefined);
  try {
    if (path === "profile") {
      const p = zProfile.safeParse(body);
      if (!p.success) return fail(400, "INVALID_PROFILE", { field: p.error.issues[0]?.path.join(".") });
      const profile = await store.updateProfile(user.id, p.data);
      await audit("profile.update", { fields: Object.keys(p.data) });
      return ok({ profile });
    }
    if (path === "privacy") {
      const p = zPrivacy.safeParse(body);
      if (!p.success) return fail(400, "INVALID_PRIVACY");
      const privacy = await store.updatePrivacy(user.id, p.data);
      await audit("privacy.update", p.data);
      return ok({ privacy });
    }
    if (path === "locale") {
      const l = z.enum(LOCALES).safeParse(body.locale);
      if (!l.success) return fail(400, "INVALID_LOCALE");
      const profile = await store.updateProfile(user.id, { locale: l.data });
      return ok({ locale: profile.locale });
    }
    if (path === "alien") {
      // Outfit, outfit colour and accessory only. Family, colours, face and pattern are permanent: no reroll.
      const forbidden = Object.keys(body).filter((k) => !["outfit", "outfitColor", "accessory"].includes(k));
      if (forbidden.length) return fail(400, "ALIEN_BASE_IS_PERMANENT", { fields: forbidden });
      const p = zAlien.safeParse(body);
      if (!p.success) return fail(400, "INVALID_COSMETIC");
      const bad = validateCosmetics(p.data as never, []);
      if (bad) return fail(400, "COSMETIC_NOT_OWNED", { field: bad });
      const alien = await store.updateAlienCosmetics(user.id, p.data as never);
      await audit("alien.cosmetics", p.data);
      return ok({ alien: { ...alien, seed: undefined, look: toLook(alien) } });
    }
  } catch (e) {
    if (e instanceof AuthError) return fail(e.code === "USERNAME_TAKEN" ? 409 : 400, e.code);
    throw e;
  }
  return fail(404, "NOT_FOUND");
}

