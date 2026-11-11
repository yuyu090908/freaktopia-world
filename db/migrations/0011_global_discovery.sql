-- FREAKTOPIA WORLD 11.0: GLOBAL FESTIVAL & DJ DISCOVERY. Requires 0007_event_ops.sql (same jsonb record pattern).
-- Additive and re-runnable; no existing table or row is changed.
--
-- discovery_sources : per-source admin settings and sync state (paused, refresh intervals, last sync, errors)
-- discovery_events  : the normalised cache of external events (UnifiedEvent as jsonb), refreshed by the sync
-- discovery_changes : detected changes (date, venue, lineup, status, tickets) for notifications and audit

create table if not exists ops_discovery_sources (
  id text primary key,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table ops_discovery_sources enable row level security;

create table if not exists ops_discovery_events (
  id text primary key,
  source_name text not null,
  starts_at_utc timestamptz not null,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_discovery_events_source on ops_discovery_events (source_name);
create index if not exists ops_discovery_events_start on ops_discovery_events (starts_at_utc);
alter table ops_discovery_events enable row level security;

create table if not exists ops_discovery_changes (
  id text primary key,
  event_id text not null,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_discovery_changes_event on ops_discovery_changes (event_id);
alter table ops_discovery_changes enable row level security;
