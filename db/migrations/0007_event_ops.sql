-- FREAKTOPIA WORLD: event operations (planning, resource matching, recruiting, operations hub, budget, safety).
-- Requires 0005_identity_i18n.sql (users). Additive and safe to run more than once: no existing table is changed.
--
-- Each table keeps its keys as real columns (with foreign keys and indexes) and the record as jsonb (`data`),
-- read and written by lib/ops/store.ts. Access control is enforced per event in lib/ops/service.ts;
-- row-level security below is a second line of defence for any other database role.

create table if not exists ops_events (
  id text primary key, owner_id uuid not null references users(id) on delete restrict,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_events_owner on ops_events (owner_id);

create table if not exists ops_requirements (
  id text primary key, event_id text not null references ops_events(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_requirements_event on ops_requirements (event_id);

-- One work profile per account (DJ, staff, equipment owner, company…): roles are a list, nothing is duplicated.
create table if not exists ops_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists ops_organizations (
  id text primary key, owner_id uuid not null references users(id) on delete restrict,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists ops_listings (
  id text primary key, owner_id uuid not null references users(id) on delete cascade,
  organization_id text references ops_organizations(id) on delete set null,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_listings_owner on ops_listings (owner_id);
create index if not exists ops_listings_data on ops_listings using gin (data jsonb_path_ops);

create table if not exists ops_openings (
  id text primary key, event_id text not null references ops_events(id) on delete cascade,
  target_listing_id text references ops_listings(id) on delete set null,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_openings_event on ops_openings (event_id);
create index if not exists ops_openings_target on ops_openings (target_listing_id);

create table if not exists ops_applications (
  id text primary key, event_id text not null references ops_events(id) on delete cascade,
  opening_id text not null references ops_openings(id) on delete cascade,
  applicant_id uuid not null references users(id) on delete cascade,
  listing_id text references ops_listings(id) on delete set null,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_applications_event on ops_applications (event_id);
create index if not exists ops_applications_applicant on ops_applications (applicant_id);

-- Bookings hold listing capacity. Inserts are serialised per listing (advisory lock) and checked against
-- overlapping held/confirmed bookings, so the same gear or person can't be double booked.
create table if not exists ops_bookings (
  id text primary key, event_id text not null references ops_events(id) on delete cascade,
  listing_id text not null references ops_listings(id) on delete restrict,
  provider_id uuid not null references users(id) on delete restrict,
  start_at timestamptz, end_at timestamptz, quantity integer check (quantity is null or quantity > 0), status text,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_bookings_listing_time on ops_bookings (listing_id, start_at, end_at);
create index if not exists ops_bookings_event on ops_bookings (event_id);

-- Agreements keep their full change history inside `data.history` (append-only in code) and use optimistic versions.
create table if not exists ops_agreements (
  id text primary key, event_id text not null references ops_events(id) on delete cascade,
  booking_id text not null unique references ops_bookings(id) on delete restrict,
  organizer_id uuid not null references users(id), provider_id uuid not null references users(id),
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_agreements_provider on ops_agreements (provider_id);

create table if not exists ops_members (
  event_id text not null references ops_events(id) on delete cascade, user_id uuid not null references users(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists ops_members_user on ops_members (user_id);

create table if not exists ops_tasks (
  id text primary key, event_id text not null references ops_events(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_tasks_event on ops_tasks (event_id);

create table if not exists ops_messages (
  id text primary key, event_id text not null references ops_events(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_messages_event on ops_messages (event_id, created_at);

create table if not exists ops_documents (
  id text primary key, event_id text not null references ops_events(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_documents_event on ops_documents (event_id);

-- File contents (contracts, plans, photos). Served only through the API after a per-event permission check.
create table if not exists ops_blobs (
  id text primary key, event_id text references ops_events(id) on delete cascade,
  mime text not null, data bytea not null check (octet_length(data) <= 5242880), created_at timestamptz not null default now()
);

create table if not exists ops_schedule (
  id text primary key, event_id text not null references ops_events(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_schedule_event on ops_schedule (event_id);

create table if not exists ops_budget (
  event_id text not null references ops_events(id) on delete cascade, category text not null,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (event_id, category)
);

-- Recorded payments only: no payment provider is connected and no money moves through the platform.
create table if not exists ops_payments (
  id text primary key, event_id text not null references ops_events(id) on delete cascade,
  agreement_id text not null references ops_agreements(id) on delete restrict,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists ops_safety (
  event_id text not null references ops_events(id) on delete cascade, key text not null,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (event_id, key)
);

create table if not exists ops_incidents (
  id text primary key, event_id text not null references ops_events(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ops_incidents_event on ops_incidents (event_id);

create table if not exists ops_handovers (
  id text primary key, event_id text not null references ops_events(id) on delete cascade,
  booking_id text not null references ops_bookings(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Work reviews: only between the two sides of a real agreement, once per rater and agreement.
create table if not exists ops_reviews (
  id text primary key, event_id text not null references ops_events(id) on delete cascade,
  agreement_id text not null references ops_agreements(id) on delete cascade,
  rater_id uuid not null references users(id), ratee_id uuid not null references users(id),
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (agreement_id, rater_id), check (rater_id <> ratee_id)
);
create index if not exists ops_reviews_ratee on ops_reviews (ratee_id);

create table if not exists ops_notifications (
  id text primary key, user_id uuid not null references users(id) on delete cascade,
  event_id text references ops_events(id) on delete cascade, dedupe_key text,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists ops_notifications_user on ops_notifications (user_id, created_at);
-- The generic writer fills dedupe_key from data when it isn't passed as a column.
create or replace function ops_notifications_dedupe() returns trigger language plpgsql as $$
begin
  if new.dedupe_key is null then new.dedupe_key := new.data->>'dedupeKey'; end if;
  return new;
end $$;
drop trigger if exists ops_notifications_dedupe on ops_notifications;
create trigger ops_notifications_dedupe before insert or update on ops_notifications for each row execute function ops_notifications_dedupe();

-- Row-level security (second line of defence for other roles; the app server connects as the owner).
do $$
declare t text;
begin
  foreach t in array array['ops_events','ops_requirements','ops_openings','ops_applications','ops_bookings','ops_agreements','ops_members',
                           'ops_tasks','ops_messages','ops_documents','ops_blobs','ops_schedule','ops_budget','ops_payments','ops_safety',
                           'ops_incidents','ops_handovers','ops_reviews','ops_notifications','ops_profiles','ops_organizations','ops_listings'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
drop policy if exists ops_member_rows on ops_tasks;
create policy ops_member_rows on ops_tasks using (exists (select 1 from ops_members m where m.event_id = ops_tasks.event_id and m.user_id = nullif(current_setting('app.current_user_id', true), '')::uuid));
drop policy if exists ops_member_rows on ops_messages;
create policy ops_member_rows on ops_messages using (exists (select 1 from ops_members m where m.event_id = ops_messages.event_id and m.user_id = nullif(current_setting('app.current_user_id', true), '')::uuid));
drop policy if exists ops_own_notifications on ops_notifications;
create policy ops_own_notifications on ops_notifications using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists ops_public_listings on ops_listings;
create policy ops_public_listings on ops_listings for select using ((data->>'active')::boolean);
