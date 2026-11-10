import { createHash } from "node:crypto";
import { Pool } from "pg";

/**
 * Cache for machine translations (db/migrations/0006: translation_cache). Only real provider results are stored,
 * and every cached result is still returned with its provider name so the UI labels it as machine translation.
 * Without DATABASE_URL the cache lives in this server instance's memory (bounded, lost on restart).
 */
export interface CachedTranslation {
  text: string;
  source: string | null;
  provider: string;
}

const MAX_MEMORY = 500;
const g = globalThis as unknown as { __fkTrCache?: Map<string, CachedTranslation>; __fkTrPool?: Pool };

export const translationKey = (provider: string, target: string, text: string) => createHash("sha256").update(`${provider}|${target}|${text}`).digest("hex");

function pool() {
  if (!process.env.DATABASE_URL) return null;
  g.__fkTrPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  return g.__fkTrPool;
}
const memory = () => (g.__fkTrCache ??= new Map());

export async function getCachedTranslation(provider: string, target: string, text: string): Promise<CachedTranslation | null> {
  const key = translationKey(provider, target, text);
  const hit = memory().get(key);
  if (hit) return hit;
  const p = pool();
  if (!p) return null;
  try {
    const r = (await p.query(`select translated, source_lang, provider from translation_cache where key = $1`, [key])).rows[0];
    if (!r) return null;
    const v = { text: String(r.translated), source: (r.source_lang as string) ?? null, provider: String(r.provider) };
    remember(key, v);
    return v;
  } catch {
    return null; // table missing (0006 not applied yet): behave as a cache miss
  }
}

function remember(key: string, v: CachedTranslation) {
  const m = memory();
  m.delete(key);
  m.set(key, v);
  if (m.size > MAX_MEMORY) m.delete(m.keys().next().value!);
}

export async function putCachedTranslation(provider: string, target: string, text: string, v: CachedTranslation) {
  const key = translationKey(provider, target, text);
  remember(key, v);
  const p = pool();
  if (!p) return;
  await p
    .query(`insert into translation_cache (key, provider, target_lang, source_lang, translated) values ($1, $2, $3, $4, $5) on conflict (key) do nothing`, [key, provider, target, v.source, v.text])
    .catch(() => undefined);
}
