-- FREAKTOPIA WORLD: FREAK ID & LOYALTY (Phase 1). Requires 0008_party_universe.sql.
-- Additive and re-runnable; no existing table or row is changed.
--
-- The rank is NOT stored: it is computed from ops_attendance (verified check-ins) every time, so it cannot drift
-- from the door records. Only the admin-editable rules and audit exclusions need storage. Rule changes and
-- exclusions are written to ops_party_audit (action loyalty_*).

create table if not exists ops_loyalty_rules (
  id text primary key,                         -- a single row: 'current'
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table ops_loyalty_rules enable row level security;

create table if not exists ops_loyalty_exclusions (
  event_id text primary key references ops_events(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table ops_loyalty_exclusions enable row level security;

