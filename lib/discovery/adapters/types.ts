import type { SourceType, UnifiedEvent } from "../types";

export interface FetchWindow {
  /** Inclusive range of start times to fetch, ISO UTC. */
  from: string;
  to: string;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * One adapter per source. `enabled()` decides from server-side env only: a key alone is not enough when
 * the source's terms need explicit approval. Keys never reach the browser (no NEXT_PUBLIC_ prefix).
 */
export interface SourceAdapter {
  id: string;
  name: string;
  sourceType: SourceType;
  termsUrl: string;
  regions: () => string[];
  /** Env var names needed to switch the source on (names only, never values). */
  needs: string[];
  state: () => "connected" | "not_configured" | "unapproved";
  fetchEvents: (w: FetchWindow, fetcher: Fetcher) => Promise<unknown[]>;
  /** Raw source item → UnifiedEvent, or null when it fails validation. */
  normalize: (raw: unknown, syncedAt: string) => UnifiedEvent | null;
}

/** fetch with a timeout and a few retries on 429/5xx (exponential backoff). */
export async function fetchJson(fetcher: Fetcher, url: string, { timeoutMs = 10_000, retries = 2 } = {}): Promise<unknown> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetcher(url, { signal: ctl.signal, headers: { Accept: "application/json" }, cache: "no-store" });
      if (r.status === 429 || r.status >= 500) throw Object.assign(new Error(`HTTP ${r.status}`), { retry: true });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      const retry = (e as { retry?: boolean }).retry || (e as Error).name === "AbortError";
      if (!retry || attempt === retries) break;
      await new Promise((res) => setTimeout(res, 500 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Removes secrets from anything that might be logged or stored as an error message. */
export const redact = (s: string) => s.replace(/(apikey|app_id|api_key|key)=[^&\s]+/gi, "$1=***");
