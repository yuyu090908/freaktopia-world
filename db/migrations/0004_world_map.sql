-- FREAKTOPIA WORLD 7.0 · WORLD MAP
-- PostgreSQL 15+. NOT applied anywhere yet: the demo build composes the map from in-memory
-- demo data (lib/map/api.ts). MAP_DATA_MODE=production without a database adapter returns
-- 503 DATA_SOURCE_NOT_CONFIGURED instead of serving demo data.
--
-- Assumes core tables: users(id uuid pk), events(id text pk).
--
-- Rules kept in the schema:
--   * real coordinates only (WGS84 lat/lng ranges); unconfirmed venues use the city centre
--     with precision = 'city' and can be updated later
--   * the festival level is a visual game level: there is no capacity column here on purpose
--   * staking principal is never stored as funding: growth inputs keep them in separate columns
--   * thresholds are data (event_growth_levels), versioned, editable by admins only
--   * demo rows never mix with production rows (is_demo on every table, composite keys)

create extension if not exists pgcrypto;

create type map_location_precision as enum ('exact', 'venue_area', 'city');
create type map_status as enum ('planning', 'funding', 'confirmed', 'live', 'completed', 'cancelled');
create type landmark_type as enum ('monster_stage', 'psychedelic_tent', 'cosmic_portal', 'speaker_towers', 'alien_sculpture', 'neon_gate');

-- ---------------------------------------------------------------- locations

create table event_locations (
  event_id     text not null references events(id) on delete cascade,
  is_demo      boolean not null default false,
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  precision    map_location_precision not null,
  city         text not null,
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references users(id),
  primary key (event_id, is_demo)
);

-- ---------------------------------------------------------------- status

create table event_map_status (
  event_id   text not null,
  is_demo    boolean not null default false,
  status     map_status not null,
  reason     text,
  changed_at timestamptz not null default now(),
  changed_by uuid references users(id),
  primary key (event_id, is_demo),
  foreign key (event_id, is_demo) references event_locations(event_id, is_demo) on delete cascade,
  -- A cancellation always says why.
  constraint cancelled_needs_reason check (status <> 'cancelled' or coalesce(length(trim(reason)), 0) > 0),
  -- Demo events can only be shown as DEMO LIVE in the UI; 'live' needs a production row.
  constraint demo_never_live check (not (is_demo and status = 'live'))
);

-- ---------------------------------------------------------------- growth levels (admin-editable)

create table event_growth_levels (
  version        integer not null,
  level          smallint not null check (level between 1 and 5),
  name           text not null check (length(name) between 1 and 32),
  visual         text not null,
  min_supporters integer not null check (min_supporters >= 0),
  min_funding_usd numeric(14, 2) not null check (min_funding_usd >= 0),
  min_stakers    integer not null check (min_stakers >= 0),
  needs_venue_contract boolean not null default false,
  min_approvals  integer not null check (min_approvals >= 0),
  is_active      boolean not null default false,
  created_at     timestamptz not null default now(),
  created_by     uuid references users(id),
  primary key (version, level),
  constraint level1_is_free check (level <> 1 or (min_supporters = 0 and min_funding_usd = 0 and min_stakers = 0 and min_approvals = 0 and not needs_venue_contract))
);

-- Only one active version.
create unique index event_growth_levels_one_active on event_growth_levels (level) where is_active;

-- Thresholds may never go down from one level to the next within a version.
create function check_growth_monotonic() returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from event_growth_levels a join event_growth_levels b
      on a.version = b.version and b.level = a.level + 1
    where a.version = new.version and (
      b.min_supporters < a.min_supporters or b.min_funding_usd < a.min_funding_usd or
      b.min_stakers < a.min_stakers or b.min_approvals < a.min_approvals or
      (a.needs_venue_contract and not b.needs_venue_contract))
  ) then
    raise exception 'growth thresholds must not decrease by level (version %)', new.version;
  end if;
  return new;
end $$;

create constraint trigger event_growth_levels_monotonic after insert or update on event_growth_levels
  deferrable initially deferred for each row execute function check_growth_monotonic();

-- Every change of the rules is audited.
create table event_growth_level_audit (
  id         uuid primary key default gen_random_uuid(),
  version    integer not null,
  changed_by uuid not null references users(id),
  changed_at timestamptz not null default now(),
  diff       jsonb not null
);

-- ---------------------------------------------------------------- per-event visuals

create table event_map_visuals (
  event_id        text not null,
  is_demo         boolean not null default false,
  festival_level  smallint not null check (festival_level between 1 and 5),
  rules_version   integer not null,
  landmark_type   landmark_type not null,
  visual_theme    text not null default 'event' check (visual_theme in ('event', 'dao_approved')),
  -- Set only from a DAO stage design that won its vote and was confirmed (see 0002_festival_dao.sql).
  approved_concept_id text,
  palette         text[] not null check (array_length(palette, 1) = 3),
  -- Growth inputs, each separate. Staking principal is NOT funding.
  valid_supporters integer not null check (valid_supporters >= 0),
  staking_participants integer not null check (staking_participants >= 0),
  secured_funding_usd numeric(14, 2) not null check (secured_funding_usd >= 0),
  venue_contract  boolean not null default false,
  approved_prep_items integer not null default 0 check (approved_prep_items >= 0),
  updated_at      timestamptz not null default now(),
  primary key (event_id, is_demo),
  foreign key (event_id, is_demo) references event_locations(event_id, is_demo) on delete cascade,
  constraint dao_theme_needs_concept check ((visual_theme = 'dao_approved') = (approved_concept_id is not null))
);

-- Art assets for landmarks (sprite atlas entries, SVG sources) with licence info.
create table event_landmark_assets (
  id            text primary key,
  landmark_type landmark_type not null,
  level         smallint not null check (level between 1 and 5),
  status        map_status,
  format        text not null check (format in ('svg', 'webp', 'png', 'glb')),
  url           text not null,
  bytes         integer not null check (bytes > 0),
  licence       text not null,
  author        text not null,
  created_at    timestamptz not null default now(),
  unique (landmark_type, level, status, format)
);

-- ---------------------------------------------------------------- preferences

create table event_map_preferences (
  user_id        uuid primary key references users(id) on delete cascade,
  reduced_motion boolean not null default false,
  renderer       text not null default 'auto' check (renderer in ('auto', 'flat', 'lite', 'rich')),
  last_filters   jsonb not null default '{}'::jsonb,
  -- No location is ever stored: My Location is only used in the browser.
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- read model

create view world_map_events as
select l.event_id, l.lat, l.lng, l.precision, s.status, v.festival_level, v.landmark_type,
       v.visual_theme, v.palette, v.valid_supporters, v.staking_participants, v.secured_funding_usd,
       greatest(l.updated_at, s.changed_at, v.updated_at) as updated_at
from event_locations l
join event_map_status s using (event_id, is_demo)
join event_map_visuals v using (event_id, is_demo)
where not l.is_demo;

create index event_locations_geo on event_locations (lat, lng) where not is_demo;
create index event_map_status_status on event_map_status (status) where not is_demo;
