/**
 * Ranking query <-> URL search params. Shared by the API (validation) and
 * the page (state sync), so a shared link restores the exact same ranking.
 */
import { z } from "zod";
import { GENRES } from "@/lib/data";
import type { Genre } from "@/lib/types";
import { RANKING_CONFIG } from "./config";
import { RANKING_CATEGORIES, RANKING_PERIODS, STATUS_FILTERS, type RankingQuery } from "./types";

const bool = z.enum(["1", "true", "0", "false"]).transform((v) => v === "1" || v === "true");
const list = z.string().max(2000).transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50));

export const rankingQuerySchema = z.object({
  category: z.enum(RANKING_CATEGORIES).default("popular"),
  period: z.enum(RANKING_PERIODS).default("all"),
  q: z.string().trim().max(80).optional(),
  country: z.string().trim().max(60).optional(),
  city: z.string().trim().max(60).optional(),
  genre: z.enum(GENRES as [Genre, ...Genre[]]).optional(),
  status: z.enum(STATUS_FILTERS).optional(),
  price: z.enum(["free", "paid"]).optional(),
  level: z.coerce.number().int().min(1).max(5).optional(),
  dj: bool.optional(),
  ap: bool.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(RANKING_CONFIG.pageSizeMax).default(RANKING_CONFIG.pageSizeDefault),
  // personalization (FOR YOU only)
  pg: list.optional(),
  pc: list.optional(),
  pd: list.optional(),
  pf: list.optional(),
});

export type ParsedQuery = z.infer<typeof rankingQuerySchema>;

export function parseRankingQuery(params: URLSearchParams): { ok: true; query: RankingQuery } | { ok: false; issues: { path: string; message: string }[] } {
  const raw: Record<string, string> = {};
  for (const [k, v] of params) if (v !== "") raw[k] = v;
  const r = rankingQuerySchema.safeParse(raw);
  if (!r.success) return { ok: false, issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
  const d = r.data;
  const query: RankingQuery = {
    category: d.category,
    period: d.period,
    q: d.q || undefined,
    country: d.country,
    city: d.city,
    genre: d.genre,
    status: d.status,
    price: d.price,
    level: d.level as RankingQuery["level"],
    djRecruiting: d.dj || undefined,
    afterParty: d.ap || undefined,
    page: d.page,
    pageSize: d.pageSize,
  };
  if (d.category === "for_you") {
    query.personalization = {
      genres: (d.pg ?? []).filter((g): g is Genre => (GENRES as string[]).includes(g)),
      cities: d.pc ?? [],
      djIds: d.pd ?? [],
      followedEventIds: d.pf ?? [],
    };
  }
  return { ok: true, query };
}

/** Public filter state kept in the page URL (no paging / personal data). */
export interface UrlState {
  category: RankingQuery["category"];
  period: RankingQuery["period"];
  q?: string;
  country?: string;
  city?: string;
  genre?: Genre;
  status?: RankingQuery["status"];
  price?: RankingQuery["price"];
  level?: number;
  dj?: boolean;
  ap?: boolean;
  view?: "list" | "map";
}

export function readUrlState(params: URLSearchParams): UrlState {
  const p = parseRankingQuery(params);
  const fallback = parseRankingQuery(new URLSearchParams());
  const q = p.ok ? p.query : fallback.ok ? fallback.query : ({ category: "popular", period: "all", page: 1, pageSize: 20 } as RankingQuery);
  return {
    category: q.category,
    period: q.period,
    q: q.q,
    country: q.country,
    city: q.city,
    genre: q.genre,
    status: q.status,
    price: q.price,
    level: q.level,
    dj: q.djRecruiting,
    ap: q.afterParty,
    view: params.get("view") === "map" ? "map" : "list",
  };
}

export function toSearchParams(s: UrlState) {
  const p = new URLSearchParams();
  if (s.category !== "popular") p.set("category", s.category);
  if (s.period !== "all") p.set("period", s.period);
  if (s.q) p.set("q", s.q);
  if (s.country) p.set("country", s.country);
  if (s.city) p.set("city", s.city);
  if (s.genre) p.set("genre", s.genre);
  if (s.status) p.set("status", s.status);
  if (s.price) p.set("price", s.price);
  if (s.level) p.set("level", String(s.level));
  if (s.dj) p.set("dj", "1");
  if (s.ap) p.set("ap", "1");
  if (s.view === "map") p.set("view", "map");
  return p;
}

export const activeFilterCount = (s: UrlState) =>
  [s.country, s.city, s.genre, s.status, s.price, s.level, s.dj, s.ap].filter(Boolean).length + (s.period !== "all" ? 1 : 0);
