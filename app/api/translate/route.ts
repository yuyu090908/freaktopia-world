import { z } from "zod";
import { LOCALES, LOCALE_META } from "@/i18n/config";
import { authConfig } from "@/lib/auth/config";
import { fail, limit, ok, readJson, sameOrigin } from "@/lib/auth/http";
import { clientKey } from "@/lib/ranking/guard";

export const dynamic = "force-dynamic";

/**
 * Machine translation of user content (event descriptions, DAO posts) on request.
 * Without DEEPL_API_KEY it answers 503 TRANSLATION_NOT_CONFIGURED and the UI keeps showing the original:
 * nothing is ever presented as translated unless a real API translated it.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "CSRF");
  if (authConfig().translation !== "connected") return fail(503, "TRANSLATION_NOT_CONFIGURED");
  const lim = limit("translate", clientKey(req), 30, 60_000);
  if (lim) return lim;
  const body = await readJson(req, 12_000);
  const p = z.object({ text: z.string().min(1).max(5000), target: z.enum(LOCALES) }).safeParse(body);
  if (!p.success) return fail(400, "INVALID_BODY");
  const target = p.data.target === "zh-CN" ? "ZH-HANS" : p.data.target === "pt" ? "PT-BR" : p.data.target.toUpperCase();
  const host = process.env.DEEPL_API_KEY!.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
  const res = await fetch(`https://${host}/v2/translate`, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: [p.data.text], target_lang: target }),
  });
  if (!res.ok) return fail(502, "TRANSLATION_FAILED");
  const j = (await res.json()) as { translations?: { text: string; detected_source_language: string }[] };
  const t = j.translations?.[0];
  if (!t) return fail(502, "TRANSLATION_FAILED");
  return ok({ text: t.text, source: t.detected_source_language, target: p.data.target, provider: "DeepL", targetName: LOCALE_META[p.data.target].native });
}
