import { memoryStore } from "./memory";
import { createPgStore } from "./pg";
import type { AuthStore } from "./types";

const g = globalThis as unknown as { __fkAuthStore?: AuthStore };

export function getStore(): AuthStore {
  if (g.__fkAuthStore) return g.__fkAuthStore;
  g.__fkAuthStore = process.env.DATABASE_URL ? createPgStore(process.env.DATABASE_URL) : memoryStore;
  return g.__fkAuthStore;
}

/** Tests: swap the store (e.g. a Postgres store against a scratch database). */
export function setStore(s: AuthStore | undefined) {
  g.__fkAuthStore = s;
}
