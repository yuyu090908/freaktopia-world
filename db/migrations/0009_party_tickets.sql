-- FREAKTOPIA WORLD 9.1: free tickets with capacity + waitlist, party archive links, organizer-picked highlights.
-- Requires 0008_party_universe.sql. Additive and re-runnable: one new table, and the attendance status check
-- is widened to allow 'waitlist' (existing rows are all 'going' or 'cancelled' and stay valid).

create table if not exists ops_party_settings (
  event_id text primary key references ops_events(id) on delete cascade,
  data jsonb not null, version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table ops_party_settings enable row level security;

alter table ops_attendance drop constraint if exists ops_attendance_status_check;
alter table ops_attendance add constraint ops_attendance_status_check check (status in ('going', 'waitlist', 'cancelled'));
create index if not exists ops_attendance_waitlist on ops_attendance (event_id, created_at) where status = 'waitlist';
