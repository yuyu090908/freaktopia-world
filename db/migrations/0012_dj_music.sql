-- FREAKTOPIA WORLD 12.0: DJ ARENA 2.0 (music, playlists, booking requests, availability, claims).
-- Requires 0005 (users), 0007 (ops_*), 0008 (ops_party_audit, ops_blocks). Additive and re-runnable:
-- no existing row is changed or removed.
--
-- Reused, not duplicated: accounts = users, work profile/listing = ops_profiles/ops_listings, applications =
-- ops_applications (data.trackIds), messages = ops_messages (a booking thread sets booking_id instead of event_id),
-- notifications = ops_notifications, blocks = ops_blocks, audit = ops_party_audit, small files = ops_blobs.
-- Audio files live in object storage (S3-compatible), never in the database: only their keys are stored here.

-- Booking threads reuse the event message table: event_id becomes optional and booking_id is added.
alter table ops_messages alter column event_id drop not null;
alter table ops_messages add column if not exists booking_id text;
create index if not exists ops_messages_booking on ops_messages (booking_id, created_at) where booking_id is not null;
do $$ begin
  alter table ops_messages add constraint ops_messages_thread check (event_id is not null or booking_id is not null);
exception when duplicate_object then null; end $$;

create table if not exists ops_dj_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  slug text not null unique,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists ops_audio_tracks (
  id text primary key,
  owner_id uuid not null references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_audio_tracks_owner on ops_audio_tracks (owner_id);
create index if not exists ops_audio_tracks_pub on ops_audio_tracks ((data->>'publicationStatus'));

create table if not exists ops_playlists (
  id text primary key,
  owner_id uuid not null references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_playlists_owner on ops_playlists (owner_id);

create table if not exists ops_playlist_items (
  id text primary key,
  playlist_id text not null references ops_playlists(id) on delete cascade,
  track_id text not null references ops_audio_tracks(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (playlist_id, track_id)
);
create index if not exists ops_playlist_items_playlist on ops_playlist_items (playlist_id);
create index if not exists ops_playlist_items_track on ops_playlist_items (track_id);

-- One like / one save per account and track: the primary key makes double counting impossible.
create table if not exists ops_track_likes (
  track_id text not null references ops_audio_tracks(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  owner_id uuid not null references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (track_id, user_id)
);
create index if not exists ops_track_likes_user on ops_track_likes (user_id);
create index if not exists ops_track_likes_owner on ops_track_likes (owner_id);

create table if not exists ops_saved_tracks (
  track_id text not null references ops_audio_tracks(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  owner_id uuid not null references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (track_id, user_id)
);
create index if not exists ops_saved_tracks_user on ops_saved_tracks (user_id);
create index if not exists ops_saved_tracks_owner on ops_saved_tracks (owner_id);

-- Every play attempt with its verdict (qualified or why not). Anonymous listeners are a salted hash, never an IP.
create table if not exists ops_track_plays (
  id text primary key,
  track_id text not null,
  owner_id uuid not null references users(id) on delete cascade,
  listener_key text not null,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_track_plays_track on ops_track_plays (track_id, created_at);
create index if not exists ops_track_plays_owner on ops_track_plays (owner_id, created_at);
create index if not exists ops_track_plays_listener on ops_track_plays (listener_key, created_at);

create table if not exists ops_dj_availability (
  dj_id uuid not null references users(id) on delete cascade,
  day text not null,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (dj_id, day)
);

create table if not exists ops_dj_booking_requests (
  id text primary key,
  dj_id uuid not null references users(id) on delete cascade,
  requester_id uuid not null references users(id) on delete cascade,
  status text not null,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_dj_booking_requests_dj on ops_dj_booking_requests (dj_id, status);
create index if not exists ops_dj_booking_requests_requester on ops_dj_booking_requests (requester_id);

create table if not exists ops_booking_offers (
  id text primary key,
  booking_id text not null references ops_dj_booking_requests(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_booking_offers_booking on ops_booking_offers (booking_id);

create table if not exists ops_copyright_claims (
  id text primary key,
  track_id text not null,
  owner_id uuid not null references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_copyright_claims_track on ops_copyright_claims (track_id);
create index if not exists ops_copyright_claims_owner on ops_copyright_claims (owner_id);

create table if not exists ops_music_reports (
  id text primary key,
  reporter_id uuid not null references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists ops_music_settings (
  id text primary key,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Metadata of small files kept in ops_blobs (cover art, profile pictures, licence documents, booking attachments).
create table if not exists ops_music_images (
  id text primary key,
  owner_id uuid not null references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_music_images_owner on ops_music_images (owner_id);

-- Row-level security (second line of defence for other roles; the app server connects as the owner).
do $$
declare t text;
begin
  foreach t in array array['ops_dj_profiles','ops_audio_tracks','ops_playlists','ops_playlist_items','ops_track_likes','ops_saved_tracks','ops_track_plays',
                           'ops_dj_availability','ops_dj_booking_requests','ops_booking_offers','ops_copyright_claims','ops_music_reports','ops_music_settings','ops_music_images']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
