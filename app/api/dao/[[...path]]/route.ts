import { NextResponse } from "next/server";
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, LOCALE_COOKIE, fromAcceptLanguage, splitLocalePath, toLocale } from "@/i18n/config";
import { loadMessages } from "@/i18n/messages";
import { handleDao } from "@/lib/dao/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path?: string[] }> };
type Coded = { code?: unknown; message?: unknown };

/** API routes skip the middleware: use the saved language, then the page's /{locale} prefix, then the browser. */
function requestLocale(req: Request) {
  const cookie = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`))?.[1];
  let fromPage: ReturnType<typeof toLocale> = null;
  try {
    const ref = req.headers.get("referer");
    if (ref) fromPage = splitLocalePath(new URL(ref).pathname).locale;
  } catch {}
  return toLocale(cookie) ?? fromPage ?? fromAcceptLanguage(req.headers.get("accept-language")) ?? DEFAULT_LOCALE;
}

/**
 * The DAO engine answers in English. Before the response leaves, swap the messages people actually read
 * (permission errors, the "why you can't post" reason, the one-account-one-vote notice) for the visitor's
 * language. Codes without a translation keep the original English message.
 */
async function localize(req: Request, res: Response): Promise<Response> {
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) return res;
  const body = (await res.clone().json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return res;
  const hasError = body.error && typeof body.error === "object";
  const hasDeny = body.deny && typeof body.deny === "object";
  const hasNotice = typeof body.onePersonOneVote === "string";
  if (!hasError && !hasDeny && !hasNotice) return res;

  const locale = requestLocale(req);
  // Untyped on purpose: the error codes come from the response, not from a fixed key list.
  const t = createTranslator({ locale, messages: (await loadMessages(locale)) as Record<string, never>, namespace: "dao.errors" as never }) as unknown as {
    (key: string): string;
    has(key: string): boolean;
  };
  const tr = (e: Coded) => {
    if (typeof e.code === "string" && t.has(e.code)) e.message = t(e.code);
  };
  if (hasError) tr(body.error as Coded);
  if (hasDeny) tr(body.deny as Coded);
  if (hasNotice) body.onePersonOneVote = t("ONE_PERSON_ONE_VOTE");

  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return NextResponse.json(body, { status: res.status, headers });
}

const run = async (req: Request, { params }: Ctx) => localize(req, await handleDao(req, (await params).path ?? []));

export const GET = run;
export const POST = run;
export const PATCH = run;
