-- FREAKTOPIA WORLD 6.0 · LIVE FESTIVAL EXPERIENCE
-- PostgreSQL 15+. NOT applied anywhere yet: the demo build keeps live data in memory
-- (lib/live/store.ts). LIVE_DATA_MODE=production without a database adapter returns
-- 503 DATA_SOURCE_NOT_CONFIGURED instead of silently serving demo data.
--
-- Assumes core tables: users(id uuid pk), events(id text pk), venues(id text pk).
-- All instants are timestamptz (UTC). Timetables keep the venue-local wall clock
-- (local_start/local_end + IANA time zone) next to the computed instants, so DST
-- changes and "after midnight" sets stay unambiguous.
--
-- Demo/production separation: every table carries is_demo. Child rows reference
-- (session_id, is_demo) as a composite key, so a demo row can never attach to a
-- production session or the other way round. Attendance views only read is_demo = false.

create extension if not exists pgcrypto;

create type live_status as enum ('scheduled', 'demo_live', 'live', 'ended', 'cancelled');
create type live_stream_provider as enum ('none', 'demo', 'mux', 'livekit');
create type live_zone as enum ('main', 'second', 'dancefloor', 'lounge', 'bar', 'food', 'entrance', 'portal', 'vip', 'community');
create type avatar_visibility as enum ('public', 'friends', 'hidden');
create type live_reaction_kind as enum ('fire', 'love', 'bass', 'alien', 'hands');
create type checkin_method as enum ('ticket_qr', 'organizer_scan', 'manual');
create type checkin_result as enum ('accepted', 'qr_malformed', 'signature_invalid', 'wrong_event', 'not_found', 'cancelled', 'already_used', 'not_entry_time', 'not_authorized');

-- ---------------------------------------------------------------- sessions & stages

create table live_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete restrict,
  status live_status not null default 'scheduled',
  venue_tz text not null,                       -- IANA, e.g. 'Asia/Tokyo'
  doors_open_at timestamptz not null,
  doors_close_at timestamptz not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (doors_close_at > doors_open_at),
  -- a demo session may never be marked as real LIVE
  check (not (is_demo and status = 'live')),
  unique (id, is_demo)
);
-- one production session per event; demo sessions are separate
create unique index live_sessions_event_prod on live_sessions(event_id) where not is_demo;

create table live_stages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  is_demo boolean not null,
  slug text not null,                           -- 'main' | 'second' | ...
  name text not null,
  zone live_zone not null,
  foreign key (session_id, is_demo) references live_sessions(id, is_demo) on delete cascade,
  unique (session_id, slug),
  unique (id, is_demo)
);

-- Rights must be recorded before a stream may be shown as LIVE or recorded.
create table live_streams (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null,
  is_demo boolean not null,
  provider live_stream_provider not null default 'none',
  playback_id text,                             -- public playback id / room name; NEVER an ingest key
  broadcast_consent_at timestamptz,             -- performer + organizer agreement
  broadcast_consent_by uuid references users(id),
  music_licence_ref text,                       -- collecting society / label licence reference
  territories text[] not null default '{}',     -- empty = none; '{*}' = worldwide
  recording_allowed boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  foreign key (stage_id, is_demo) references live_stages(id, is_demo) on delete cascade,
  check (provider <> 'demo' or is_demo),
  -- a started production stream needs a provider, playback id, consent and a licence
  check (is_demo or started_at is null or (provider in ('mux', 'livekit') and playback_id is not null and broadcast_consent_at is not null and music_licence_ref is not null))
);
create unique index live_streams_one_active on live_streams(stage_id) where ended_at is null;

create table live_stage_schedules (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null,
  is_demo boolean not null,
  dj_id text not null,
  local_date date not null,                     -- venue-local calendar date of the set start
  local_start time not null,
  local_end time not null,
  starts_at timestamptz not null,               -- computed with the session's venue_tz
  ends_at timestamptz not null,
  genre text,
  foreign key (stage_id, is_demo) references live_stages(id, is_demo) on delete cascade,
  check (ends_at > starts_at)
);
create index live_stage_schedules_stage_time on live_stage_schedules(stage_id, starts_at);
-- no overlapping sets on one stage
create extension if not exists btree_gist;
alter table live_stage_schedules add constraint live_stage_schedules_no_overlap
  exclude using gist (stage_id with =, tstzrange(starts_at, ends_at) with &&);

-- ---------------------------------------------------------------- participants & avatars

-- Online presence in the virtual venue. Never derived from GPS; never attendance.
create table live_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  is_demo boolean not null,
  user_id uuid references users(id),            -- null for anonymous viewers (signed device id)
  device_hash text not null,                    -- hashed anonymous id
  display_name text not null check (char_length(display_name) between 2 and 24),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  foreign key (session_id, is_demo) references live_sessions(id, is_demo) on delete cascade,
  unique (session_id, device_hash)
);
create index live_participants_active on live_participants(session_id, last_seen_at) where left_at is null;

-- Zone-level avatar state (synced per zone, not per-second positions).
create table live_avatar_states (
  participant_id uuid primary key references live_participants(id) on delete cascade,
  zone live_zone not null default 'entrance',
  visibility avatar_visibility not null default 'public',
  look jsonb not null,                          -- species, colors, outfit, accessory
  dance text not null default 'bounce' check (dance in ('bounce', 'wiggle', 'spin')),
  emote text not null default 'none' check (emote in ('none', 'wave', 'heart', 'fire', 'alien')),
  consent_at timestamptz not null,              -- explicit opt-in to appear on the map
  updated_at timestamptz not null default now()
);
create index live_avatar_states_zone on live_avatar_states(zone) where visibility <> 'hidden';

-- ---------------------------------------------------------------- chat, reactions, energy

create table live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  is_demo boolean not null,
  participant_id uuid references live_participants(id) on delete set null,
  badge text check (badge in ('dj', 'organizer', 'moderator')),
  body text not null check (char_length(body) between 1 and 280),
  reply_to uuid references live_chat_messages(id) on delete set null,
  hidden_at timestamptz,
  hidden_reason text,
  created_at timestamptz not null default now(),
  foreign key (session_id, is_demo) references live_sessions(id, is_demo) on delete cascade
);
create index live_chat_messages_session_time on live_chat_messages(session_id, created_at desc);

create table live_chat_reports (
  message_id uuid not null references live_chat_messages(id) on delete cascade,
  reporter_participant_id uuid not null references live_participants(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (message_id, reporter_participant_id)   -- one report per person per message
);

create table live_blocks (
  participant_id uuid not null references live_participants(id) on delete cascade,
  blocked_participant_id uuid not null references live_participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (participant_id, blocked_participant_id),
  check (participant_id <> blocked_participant_id)
);

-- Reactions are append-only. `counted` = passed the per-person rate limit and feeds energy.
create table live_reactions (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  is_demo boolean not null,
  participant_id uuid not null references live_participants(id) on delete cascade,
  kind live_reaction_kind not null,
  zone live_zone not null,
  counted boolean not null,
  created_at timestamptz not null default now(),
  foreign key (session_id, is_demo) references live_sessions(id, is_demo) on delete cascade
);
create index live_reactions_window on live_reactions(session_id, created_at) where counted;

-- Energy is a game metric; snapshots keep its inputs for audit and replay.
create table live_energy_snapshots (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  is_demo boolean not null,
  energy smallint not null check (energy between 0 and 100),
  active_participants integer not null check (active_participants >= 0),
  valid_reactions integer not null check (valid_reactions >= 0),
  quest_completions integer not null check (quest_completions >= 0),
  set_participants integer not null check (set_participants >= 0),
  formula_version text not null default 'energy-v1',
  taken_at timestamptz not null default now(),
  foreign key (session_id, is_demo) references live_sessions(id, is_demo) on delete cascade
);
create index live_energy_snapshots_session_time on live_energy_snapshots(session_id, taken_at desc);

-- ---------------------------------------------------------------- quests

create table live_quests (
  id text primary key,                          -- 'watch-set', 'onsite-checkin', ...
  title text not null,
  description text not null,
  kind text not null check (kind in ('online', 'onsite')),
  target integer not null check (target > 0),
  xp integer not null check (xp >= 0),
  badge text,
  reward text,
  active boolean not null default true
);

create table user_live_quest_progress (
  user_id uuid not null references users(id) on delete cascade,
  session_id uuid not null,
  is_demo boolean not null,
  quest_id text not null references live_quests(id),
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  -- on-site completions must point at the verified (non-demo) check-in that unlocked them
  checkin_id uuid,
  updated_at timestamptz not null default now(),
  primary key (user_id, session_id, quest_id),
  foreign key (session_id, is_demo) references live_sessions(id, is_demo) on delete cascade
);

-- ---------------------------------------------------------------- check-in

-- Every scan attempt is logged; only 'accepted' rows count, and a ticket is accepted once.
create table live_checkins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  is_demo boolean not null,
  ticket_id text not null,
  method checkin_method not null,
  result checkin_result not null,
  scanned_by uuid references users(id),         -- door staff for organizer_scan / manual
  user_id uuid references users(id),            -- ticket holder, when known
  created_at timestamptz not null default now(),
  foreign key (session_id, is_demo) references live_sessions(id, is_demo) on delete cascade,
  check (method = 'ticket_qr' or result <> 'accepted' or scanned_by is not null)
);
create unique index live_checkins_once on live_checkins(ticket_id, is_demo) where result = 'accepted';
create index live_checkins_session on live_checkins(session_id, created_at);

-- Verified exits, so "currently present" = accepted check-ins minus exits (never GPS).
create table live_checkouts (
  checkin_id uuid primary key references live_checkins(id) on delete cascade,
  scanned_by uuid references users(id),
  created_at timestamptz not null default now()
);

alter table user_live_quest_progress
  add constraint user_live_quest_progress_checkin_fk foreign key (checkin_id) references live_checkins(id);

-- Production attendance only (demo rows excluded by definition).
create view live_attendance as
select
  s.event_id,
  s.id as session_id,
  count(c.id) filter (where c.result = 'accepted') as unique_checked_in,
  count(c.id) filter (where c.result = 'accepted' and o.checkin_id is null) as currently_present
from live_sessions s
left join live_checkins c on c.session_id = s.id and not c.is_demo
left join live_checkouts o on o.checkin_id = c.id
where not s.is_demo
group by s.event_id, s.id;

-- ---------------------------------------------------------------- notifications & moderation

create table live_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  schedule_id uuid references live_stage_schedules(id) on delete cascade,
  kind text not null check (kind in ('set_reminder', 'set_started', 'event_live', 'after_party')),
  send_at timestamptz not null,
  sent_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, schedule_id, kind)
);
create index live_notifications_due on live_notifications(send_at) where sent_at is null;

-- Append-only moderation history.
create table live_moderation_logs (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  is_demo boolean not null,
  target_type text not null check (target_type in ('message', 'participant')),
  target_id uuid not null,
  action text not null check (action in ('auto_hide', 'auto_block', 'hide', 'unhide', 'mute', 'ban', 'warn')),
  reason text not null,
  actor_user_id uuid references users(id),      -- null = automated rule
  created_at timestamptz not null default now(),
  foreign key (session_id, is_demo) references live_sessions(id, is_demo) on delete cascade
);
create or replace function live_moderation_logs_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'live_moderation_logs is append-only';
end $$;
create trigger live_moderation_logs_no_update before update on live_moderation_logs for each row execute function live_moderation_logs_immutable();
create trigger live_moderation_logs_no_delete before delete on live_moderation_logs for each row execute function live_moderation_logs_immutable();

-- ---------------------------------------------------------------- permissions (row level security)

alter table live_chat_messages enable row level security;
alter table live_avatar_states enable row level security;
alter table live_checkins enable row level security;
-- The API connects as role `live_api` and sets app.user_id per request; door staff get `live_door`.
-- Policies (examples): viewers read non-hidden chat; only door staff insert check-ins.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'live_api') then create role live_api; end if;
  if not exists (select 1 from pg_roles where rolname = 'live_door') then create role live_door; end if;
end $$;
create policy chat_read on live_chat_messages for select to live_api using (hidden_at is null);
create policy chat_write on live_chat_messages for insert to live_api with check (hidden_at is null and badge is null);
create policy avatar_read on live_avatar_states for select to live_api using (visibility <> 'hidden');
create policy checkin_insert on live_checkins for insert to live_door with check (true);
create policy checkin_read on live_checkins for select to live_door using (true);
