-- FREAKTOPIA WORLD 9.0: PERSONAL PARTY UNIVERSE (attendance, check-ins, reviews, media, follows, privacy).
-- Requires 0005_identity_i18n.sql (users) and 0007_event_ops.sql (ops_events, ops_blobs). Additive and re-runnable:
-- no existing table or row is changed.
--
-- Reused, not duplicated: events = ops_events, accounts/aliens = users + user_aliens, files = ops_blobs,
-- notifications = ops_notifications. Organizer worlds, milestones and community statistics are computed from
-- ops_attendance on read (recomputable; no stored counters that could drift or be inflated).
-- Same layout as 0007: key columns + the record as jsonb, read and written by lib/ops/store.ts.

-- One row per (event, account): re-entry or a second scan can never create a second attendance.
create table if not exists ops_attendance (
  event_id text not null references ops_events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null check (status in ('going', 'cancelled')),
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists ops_attendance_user on ops_attendance (user_id);
-- Pass codes are unique per event.
create unique index if not exists ops_attendance_pass on ops_attendance (event_id, (data->>'passCode'));
create index if not exists ops_attendance_data on ops_attendance using gin (data jsonb_path_ops);

-- Every door scan attempt, including duplicates and rejections (audit + anomaly detection).
create table if not exists ops_checkins (
  id text primary key,
  event_id text not null references ops_events(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_checkins_event on ops_checkins (event_id, created_at);

-- Guests without a confirmable account check-in: kept apart from account attendance.
create table if not exists ops_guests (
  event_id text primary key references ops_events(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Event reviews: one per attendee and event (the 0007 ops_reviews table is for work agreements).
create table if not exists ops_event_reviews (
  event_id text not null references ops_events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists ops_event_reviews_user on ops_event_reviews (user_id);

-- Photos and short videos (bytes in ops_blobs). Official uploads and attendee posts are told apart by data->>'kind'.
create table if not exists ops_media (
  id text primary key,
  event_id text not null references ops_events(id) on delete cascade,
  uploader_id uuid not null references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_media_event on ops_media (event_id);

create table if not exists ops_follows (
  organizer_id uuid not null references users(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (organizer_id, user_id), check (organizer_id <> user_id)
);
create index if not exists ops_follows_user on ops_follows (user_id);

create table if not exists ops_blocks (
  user_id uuid not null references users(id) on delete cascade,
  organizer_id uuid not null references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (user_id, organizer_id)
);

-- The attendee's own choice (off by default): appear by name/alien in organizers' worlds, show party history.
create table if not exists ops_world_privacy (
  user_id uuid primary key references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Which events the organizer shows in their world.
create table if not exists ops_world_settings (
  owner_id uuid primary key references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Who changed attendance, guests or visibility, and why.
create table if not exists ops_party_audit (
  id text primary key,
  event_id text references ops_events(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_party_audit_event on ops_party_audit (event_id, created_at);

-- Row-level security (second line of defence for other roles; the app server connects as the owner).
do $$
declare t text;
begin
  foreach t in array array['ops_attendance','ops_checkins','ops_guests','ops_event_reviews','ops_media','ops_follows','ops_blocks',
                           'ops_world_privacy','ops_world_settings','ops_party_audit'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
drop policy if exists ops_own_attendance on ops_attendance;
create policy ops_own_attendance on ops_attendance using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists ops_own_privacy on ops_world_privacy;
create policy ops_own_privacy on ops_world_privacy using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists ops_own_follows on ops_follows;
create policy ops_own_follows on ops_follows using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
