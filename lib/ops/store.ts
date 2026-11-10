/**
 * Storage for event operations. Same pattern as the account store (lib/auth/store.ts):
 * PostgreSQL when DATABASE_URL is set (db/migrations/0007_event_ops.sql), otherwise an in-memory
 * DEMO store that resets on restart. No second database or auth system is introduced.
 *
 * Every table has real key columns (event_id, user/listing ids with foreign keys) plus the record as jsonb.
 * Two operations are atomic on both stores: booking capacity (no double booking) and notifications
 * (one per user and dedupe key).
 */
import { Pool, type PoolClient } from "pg";
import { OpsError, type Booking, type Notification } from "./types";

export type Table =
  | "events" | "requirements" | "profiles" | "organizations" | "listings" | "openings" | "applications" | "bookings"
  | "agreements" | "members" | "tasks" | "messages" | "documents" | "schedule" | "budget" | "payments"
  | "safety" | "incidents" | "handovers" | "reviews" | "notifications"
  // 9.0 PERSONAL PARTY UNIVERSE (db/migrations/0008_party_universe.sql)
  | "attendance" | "checkins" | "guests" | "event_reviews" | "media" | "follows" | "blocks" | "world_privacy" | "world_settings" | "party_audit";

type Row = Record<string, unknown>;
export type Where = Record<string, string | number | boolean | null>;

export interface OpsStore {
  kind: "memory" | "postgres";
  get<T>(table: Table, id: string): Promise<T | null>;
  list<T>(table: Table, where?: Where): Promise<T[]>;
  insert<T extends Row | object>(table: Table, row: T): Promise<T>;
  /** Replaces the record. With `expectedVersion` the write fails (409) if someone else changed it first. */
  put<T extends Row | object>(table: Table, row: T, expectedVersion?: number): Promise<T>;
  remove(table: Table, id: string): Promise<void>;
  /** Inserts the booking only if `check` passes against the current bookings of the same listing (serialised per listing). */
  bookAtomically(b: Booking, check: (existing: Booking[]) => void): Promise<Booking>;
  /** Stores the notification unless one with the same user + dedupeKey exists. Returns true if stored. */
  notifyOnce(n: Notification): Promise<boolean>;
  putBlob(id: string, eventId: string | null, mime: string, data: Buffer): Promise<void>;
  getBlob(id: string): Promise<{ mime: string; data: Buffer } | null>;
}

/** Composite keys: tables without their own id. */
const KEY: Partial<Record<Table, (r: Row) => string>> = {
  profiles: (r) => String(r.userId),
  members: (r) => `${r.eventId}:${r.userId}`,
  budget: (r) => `${r.eventId}:${r.category}`,
  safety: (r) => `${r.eventId}:${r.key}`,
  attendance: (r) => `${r.eventId}:${r.userId}`,
  guests: (r) => String(r.eventId),
  event_reviews: (r) => `${r.eventId}:${r.userId}`,
  follows: (r) => `${r.organizerId}:${r.userId}`,
  blocks: (r) => `${r.userId}:${r.organizerId}`,
  world_privacy: (r) => String(r.userId),
  world_settings: (r) => String(r.ownerId),
};
export const keyOf = (table: Table, r: Row) => (KEY[table] ? KEY[table]!(r) : String(r.id));
const clone = <T>(v: T): T => (v == null ? v : (JSON.parse(JSON.stringify(v)) as T));
const matches = (r: Row, w: Where = {}) => Object.entries(w).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));

// ------------------------------------------------------------------ memory (DEMO)

interface Mem {
  tables: Map<Table, Map<string, Row>>;
  blobs: Map<string, { mime: string; data: Buffer }>;
}
const g = globalThis as unknown as { __fkOpsMem?: Mem; __fkOpsStore?: OpsStore };
const mem = () => (g.__fkOpsMem ??= { tables: new Map(), blobs: new Map() });
const tbl = (t: Table) => {
  const m = mem().tables;
  if (!m.has(t)) m.set(t, new Map());
  return m.get(t)!;
};
export function resetOpsMemory() {
  g.__fkOpsMem = undefined;
}

export const memoryOpsStore: OpsStore = {
  kind: "memory",
  async get<T>(t: Table, id: string) {
    return clone((tbl(t).get(id) as T) ?? null);
  },
  async list<T>(t: Table, where?: Where) {
    return [...tbl(t).values()].filter((r) => matches(r, where)).map((r) => clone(r) as T);
  },
  async insert<T extends Row | object>(t: Table, row: T) {
    const k = keyOf(t, row as Row);
    if (tbl(t).has(k)) throw new OpsError(409, "DUPLICATE");
    tbl(t).set(k, clone(row as Row));
    return clone(row);
  },
  async put<T extends Row | object>(t: Table, row: T, expectedVersion?: number) {
    const k = keyOf(t, row as Row);
    const cur = tbl(t).get(k);
    if (expectedVersion != null && cur && Number(cur.version ?? 0) !== expectedVersion) throw new OpsError(409, "STALE_VERSION");
    tbl(t).set(k, clone(row as Row));
    return clone(row);
  },
  async remove(t: Table, id: string) {
    tbl(t).delete(id);
  },
  async bookAtomically(b, check) {
    // Synchronous between read and write: JavaScript runs this block without interleaving.
    const existing = [...tbl("bookings").values()].filter((r) => r.listingId === b.listingId) as unknown as Booking[];
    check(clone(existing));
    tbl("bookings").set(b.id, clone(b as unknown as Row));
    return clone(b);
  },
  async notifyOnce(n) {
    const dup = [...tbl("notifications").values()].some((r) => r.userId === n.userId && r.dedupeKey === n.dedupeKey);
    if (dup) return false;
    tbl("notifications").set(n.id, clone(n as unknown as Row));
    return true;
  },
  async putBlob(id, _eventId, mime, data) {
    mem().blobs.set(id, { mime, data: Buffer.from(data) });
  },
  async getBlob(id) {
    return mem().blobs.get(id) ?? null;
  },
};

// ------------------------------------------------------------------ PostgreSQL

/** Key columns per table (record field → column). Everything else lives in `data`. */
const COLS: Record<Table, Record<string, string>> = {
  events: { id: "id", ownerId: "owner_id" },
  requirements: { id: "id", eventId: "event_id" },
  profiles: { userId: "user_id" },
  organizations: { id: "id", ownerId: "owner_id" },
  listings: { id: "id", ownerId: "owner_id", organizationId: "organization_id" },
  openings: { id: "id", eventId: "event_id", targetListingId: "target_listing_id" },
  applications: { id: "id", eventId: "event_id", openingId: "opening_id", applicantId: "applicant_id", listingId: "listing_id" },
  bookings: { id: "id", eventId: "event_id", listingId: "listing_id", providerId: "provider_id", startAt: "start_at", endAt: "end_at", quantity: "quantity", status: "status" },
  agreements: { id: "id", eventId: "event_id", bookingId: "booking_id", organizerId: "organizer_id", providerId: "provider_id" },
  members: { eventId: "event_id", userId: "user_id" },
  tasks: { id: "id", eventId: "event_id" },
  messages: { id: "id", eventId: "event_id" },
  documents: { id: "id", eventId: "event_id" },
  schedule: { id: "id", eventId: "event_id" },
  budget: { eventId: "event_id", category: "category" },
  payments: { id: "id", eventId: "event_id", agreementId: "agreement_id" },
  safety: { eventId: "event_id", key: "key" },
  incidents: { id: "id", eventId: "event_id" },
  handovers: { id: "id", eventId: "event_id", bookingId: "booking_id" },
  reviews: { id: "id", eventId: "event_id", agreementId: "agreement_id", raterId: "rater_id", rateeId: "ratee_id" },
  notifications: { id: "id", userId: "user_id", eventId: "event_id" },
  attendance: { eventId: "event_id", userId: "user_id", status: "status" },
  checkins: { id: "id", eventId: "event_id", userId: "user_id" },
  guests: { eventId: "event_id" },
  event_reviews: { eventId: "event_id", userId: "user_id" },
  media: { id: "id", eventId: "event_id", uploaderId: "uploader_id" },
  follows: { organizerId: "organizer_id", userId: "user_id" },
  blocks: { userId: "user_id", organizerId: "organizer_id" },
  world_privacy: { userId: "user_id" },
  world_settings: { ownerId: "owner_id" },
  party_audit: { id: "id", eventId: "event_id", actorId: "actor_id" },
};
/** Primary-key fields of composite-key tables when they differ from all key columns (extra indexed columns). */
const KEY_FIELDS: Partial<Record<Table, string[]>> = { attendance: ["eventId", "userId"] };
const PK_FIELDS: Record<Table, string[]> = Object.fromEntries(
  (Object.keys(COLS) as Table[]).map((t) => [t, KEY[t] ? KEY_FIELDS[t] ?? Object.keys(COLS[t]) : ["id"]]),
) as Record<Table, string[]>;
const PK: Record<Table, string[]> = Object.fromEntries(
  (Object.keys(COLS) as Table[]).map((t) => [t, PK_FIELDS[t].map((f) => COLS[t][f])]),
) as Record<Table, string[]>;
const name = (t: Table) => `ops_${t}`;

export function createPgOpsStore(connectionString: string): OpsStore {
  const pool = new Pool({ connectionString, max: 5 });
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
  const fail = (e: unknown): never => {
    const code = (e as { code?: string })?.code;
    if (code === "23505") throw new OpsError(409, "DUPLICATE");
    if (code === "23503") throw new OpsError(400, "UNKNOWN_REFERENCE");
    throw e;
  };
  const colsOf = (t: Table, r: Row) => {
    const cols = Object.entries(COLS[t]);
    return { names: cols.map(([, c]) => c), values: cols.map(([f]) => (r[f] === undefined ? null : r[f])) };
  };
  const pkWhere = (t: Table, r: Row, offset = 0) => ({
    sql: PK[t].map((c, i) => `${c} = $${offset + i + 1}`).join(" and "),
    args: PK_FIELDS[t].map((f) => r[f]),
  });
  const idToRow = (t: Table, id: string): Row => {
    if (!KEY[t]) return { id };
    const parts = id.split(":");
    return Object.fromEntries(PK_FIELDS[t].map((f, i) => [f, i === PK_FIELDS[t].length - 1 ? parts.slice(i).join(":") : parts[i]]));
  };

  return {
    kind: "postgres",
    async get<T>(t: Table, id: string) {
      const w = pkWhere(t, idToRow(t, id));
      const r = await pool.query(`select data from ${name(t)} where ${w.sql}`, w.args);
      return (r.rows[0]?.data as T) ?? null;
    },
    async list<T>(t: Table, where: Where = {}) {
      // Key columns are used directly (indexed); other fields through jsonb containment (GIN index).
      const args: unknown[] = [];
      const conds: string[] = [];
      const json: Row = {};
      for (const [f, v] of Object.entries(where)) {
        const col = COLS[t][f];
        if (col && v !== null) {
          args.push(v);
          conds.push(`${col} = $${args.length}`);
        } else if (col) conds.push(`${col} is null`);
        else json[f] = v;
      }
      if (Object.keys(json).length) {
        args.push(JSON.stringify(json));
        conds.push(`data @> $${args.length}::jsonb`);
      }
      const r = await pool.query(`select data from ${name(t)}${conds.length ? ` where ${conds.join(" and ")}` : ""} order by created_at`, args);
      return r.rows.map((x) => x.data as T);
    },
    async insert<T extends Row | object>(t: Table, row: T) {
      const r = row as Row;
      const { names, values } = colsOf(t, r);
      try {
        await pool.query(
          `insert into ${name(t)} (${names.join(", ")}, data, version) values (${names.map((_, i) => `$${i + 1}`).join(", ")}, $${names.length + 1}::jsonb, $${names.length + 2})`,
          [...values, JSON.stringify(r), Number(r.version ?? 0)],
        );
      } catch (e) {
        fail(e);
      }
      return row;
    },
    async put<T extends Row | object>(t: Table, row: T, expectedVersion?: number) {
      const r = row as Row;
      const { names, values } = colsOf(t, r);
      const w = pkWhere(t, r, names.length + 2);
      try {
        if (expectedVersion != null) {
          const res = await pool.query(
            `update ${name(t)} set ${names.map((c, i) => `${c} = $${i + 1}`).join(", ")}, data = $${names.length + 1}::jsonb, version = $${names.length + 2}, updated_at = now()
             where ${w.sql} and version = $${names.length + 2 + w.args.length + 1}`,
            [...values, JSON.stringify(r), Number(r.version ?? 0), ...w.args, expectedVersion],
          );
          if (!res.rowCount) throw new OpsError(409, "STALE_VERSION");
          return row;
        }
        await pool.query(
          `insert into ${name(t)} (${names.join(", ")}, data, version) values (${names.map((_, i) => `$${i + 1}`).join(", ")}, $${names.length + 1}::jsonb, $${names.length + 2})
           on conflict (${PK[t].join(", ")}) do update set ${names.filter((c) => !PK[t].includes(c)).map((c) => `${c} = excluded.${c}`).concat(["data = excluded.data", "version = excluded.version", "updated_at = now()"]).join(", ")}`,
          [...values, JSON.stringify(r), Number(r.version ?? 0)],
        );
      } catch (e) {
        if (e instanceof OpsError) throw e;
        fail(e);
      }
      return row;
    },
    async remove(t: Table, id: string) {
      const w = pkWhere(t, idToRow(t, id));
      await pool.query(`delete from ${name(t)} where ${w.sql}`, w.args);
    },
    async bookAtomically(b, check) {
      return tx(async (c) => {
        // One booking decision per listing at a time, across all server instances.
        await c.query(`select pg_advisory_xact_lock(hashtext($1))`, [`ops-listing:${b.listingId}`]);
        const existing = (await c.query(`select data from ops_bookings where listing_id = $1`, [b.listingId])).rows.map((r) => r.data as Booking);
        check(existing);
        try {
          await c.query(
            `insert into ops_bookings (id, event_id, listing_id, provider_id, start_at, end_at, quantity, status, data, version) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 0)`,
            [b.id, b.eventId, b.listingId, b.providerId, b.startAt, b.endAt, b.quantity, b.status, JSON.stringify(b)],
          );
        } catch (e) {
          fail(e);
        }
        return b;
      });
    },
    async notifyOnce(n) {
      const r = await pool.query(
        `insert into ops_notifications (id, user_id, event_id, dedupe_key, data, version) values ($1, $2, $3, $4, $5::jsonb, 0) on conflict (user_id, dedupe_key) do nothing`,
        [n.id, n.userId, n.eventId, n.dedupeKey, JSON.stringify(n)],
      );
      return (r.rowCount ?? 0) > 0;
    },
    async putBlob(id, eventId, mime, data) {
      await pool.query(`insert into ops_blobs (id, event_id, mime, data) values ($1, $2, $3, $4) on conflict (id) do nothing`, [id, eventId, mime, data]);
    },
    async getBlob(id) {
      const r = (await pool.query(`select mime, data from ops_blobs where id = $1`, [id])).rows[0];
      return r ? { mime: String(r.mime), data: r.data as Buffer } : null;
    },
  };
}

export function getOpsStore(): OpsStore {
  if (g.__fkOpsStore) return g.__fkOpsStore;
  g.__fkOpsStore = process.env.DATABASE_URL ? createPgOpsStore(process.env.DATABASE_URL) : memoryOpsStore;
  return g.__fkOpsStore;
}
export function setOpsStore(s: OpsStore | undefined) {
  g.__fkOpsStore = s;
}
