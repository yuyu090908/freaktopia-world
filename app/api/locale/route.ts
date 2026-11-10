import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import { currentUser, fail, ok, readJson, sameOrigin, setLocaleCookie } from "@/lib/auth/http";
import { getStore } from "@/lib/auth/store";

export const dynamic = "force-dynamic";

/** Saves the language: cookie for everyone, and the profile when signed in. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "CSRF");
  const body = await readJson(req);
  const l = z.enum(LOCALES).safeParse(body?.locale);
  if (!l.success) return fail(400, "INVALID_LOCALE");
  const user = await currentUser();
  if (user) await getStore().updateProfile(user.id, { locale: l.data });
  const res = ok({ locale: l.data, savedToProfile: Boolean(user) });
  setLocaleCookie(res, l.data);
  return res;
}
