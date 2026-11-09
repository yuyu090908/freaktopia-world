-- FREAKTOPIA WORLD 4.0 · WORLD RANKING
-- PostgreSQL 15+. Not applied anywhere yet: Phase 1 has no database.
-- Assumes the core tables from the backend plan exist:
--   users(id uuid pk), events(id text pk, status, starts_at, ends_at, timezone, ...),
--   tickets(id uuid pk, event_id, user_id, status, sold_at),
--   event_supporters(id, event_id, user_id, created_at, ip_hash, fraud_state),
--   event_attendance(id, event_id, ticket_id, user_id, scanned_at),
--   payments(id, event_id, user_id, amount_minor, currency, status, created_at)
-- All timestamps are timestamptz (UTC). Event-local times use events.timezone.

-- Dedup guarantees on the raw tables the engine reads.
create unique index if not exists event_supporters_user_event_uniq on event_supporters (event_id, user_id);
create unique index if not exists event_attendance_ticket_uniq on event_attendance (event_id, ticket_id);
create index if not exists event_supporters_event_created_idx on event_supporters (event_id, created_at) where fraud_state = 'clear';
create index if not exists tickets_event_status_idx on tickets (event_id, status, sold_at);
create index if not exists payments_event_status_idx on payments (event_id, status, created_at);

create table if not exists event_interests (
  event_id text not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists event_presence (
  event_id text not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  last_seen_at timestamptz not null,
  checked_out boolean not null default false,
  avatar_public boolean not null default false,
  primary key (event_id, user_id)
);
create index if not exists event_presence_fresh_idx on event_presence (event_id, last_seen_at) where not checked_out;

create table if not exists fx_rates (
  currency char(3) not null,
  usd_rate numeric(18, 8) not null,
  as_of timestamptz not null,
  source text not null,
  primary key (currency, as_of)
);

create table if not exists ranking_categories (
  id text primary key,                 -- popular | attended | trending | funded | live | dj_wanted | after_party | tickets | for_you
  label text not null,
  is_public boolean not null default true,
  sort_order int not null default 0
);

create table if not exists ranking_periods (
  id text primary key,                 -- 24h | 7d | 30d | all
  duration interval                    -- null = all time
);

create table if not exists ranking_config_versions (
  version text primary key,            -- e.g. rk-1.0.0
  config jsonb not null,               -- trending weights, smoothing, min sample, presence TTL
  created_at timestamptz not null default now()
);

-- Per-event metrics at a point in time (one row per event × period × snapshot).
create table if not exists event_metric_snapshots (
  id bigserial primary key,
  event_id text not null references events(id) on delete cascade,
  period_id text not null references ranking_periods(id),
  as_of timestamptz not null,
  calculation_version text not null references ranking_config_versions(version),
  supporters_count int not null,
  interested_count int not null,
  tickets_sold int not null,
  checked_in_count int not null,
  currently_present_count int not null,
  public_avatar_count int not null,
  new_supporters int not null,
  base_supporters int not null,
  growth_rate numeric(10, 4) not null,
  trending_score numeric(12, 4) not null,
  funding_usd numeric(14, 2) not null,
  funding_by_currency jsonb not null,  -- {"JPY": 6697879, "USD": 27594}
  fx_as_of timestamptz not null,       -- rates used for funding_usd
  excluded jsonb not null,             -- duplicate/flagged/invalid counts
  event_status text not null,
  unique (event_id, period_id, as_of, calculation_version)
);
create index if not exists event_metric_snapshots_lookup_idx on event_metric_snapshots (period_id, as_of desc);

-- Ranked positions (public rankings; FOR YOU is computed per request, never stored here).
create table if not exists event_ranking_snapshots (
  id bigserial primary key,
  category_id text not null references ranking_categories(id),
  period_id text not null references ranking_periods(id),
  as_of timestamptz not null,
  calculation_version text not null references ranking_config_versions(version),
  event_id text not null references events(id) on delete cascade,
  position int not null,
  score numeric(16, 4) not null,
  unique (category_id, period_id, as_of, event_id)
);
create index if not exists event_ranking_snapshots_board_idx on event_ranking_snapshots (category_id, period_id, as_of desc, position);

-- Daily history for charts ("past ranks").
create table if not exists event_ranking_history (
  event_id text not null references events(id) on delete cascade,
  category_id text not null references ranking_categories(id),
  day date not null,
  position int,
  score numeric(16, 4),
  primary key (event_id, category_id, day)
);

create table if not exists event_ranking_audit_logs (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_user_id uuid references users(id),
  action text not null,                -- recalculate | hold_account | release_account | exclude_ticket | override
  event_id text references events(id),
  detail jsonb not null default '{}'
);
create index if not exists event_ranking_audit_logs_event_idx on event_ranking_audit_logs (event_id, at desc);

create table if not exists user_event_follows (
  user_id uuid not null references users(id) on delete cascade,
  event_id text not null references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index if not exists user_event_follows_event_idx on user_event_follows (event_id);

create table if not exists user_ranking_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  personalize boolean not null default true,
  genres text[] not null default '{}',
  cities text[] not null default '{}',
  dj_ids text[] not null default '{}',
  interests text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists ranking_rewards (
  id text primary key,                 -- ranking_badge_top1, festival_achievement, ...
  kind text not null check (kind in ('ranking_badge','festival_achievement','avatar_cosmetic','featured_placement','community_trophy')),
  name text not null,
  criteria jsonb not null,             -- {"category":"popular","maxPosition":3}
  nft_optional boolean not null default false
);

create table if not exists user_ranking_rewards (
  user_id uuid not null references users(id) on delete cascade,
  reward_id text not null references ranking_rewards(id),
  event_id text references events(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, reward_id, event_id)
);

create table if not exists event_comparisons (
  id text primary key,                 -- short share id
  event_ids text[] not null check (array_length(event_ids, 1) between 2 and 3),
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table if not exists event_alert_subscriptions (
  user_id uuid not null references users(id) on delete cascade,
  event_id text not null references events(id) on delete cascade,
  alert_type text not null check (alert_type in ('top10','tickets_on_sale','tickets_low','dj_open','after_party','confirmed','cancelled')),
  channel text not null default 'in_app' check (channel in ('in_app','push','email')),
  consented_at timestamptz not null,
  primary key (user_id, event_id, alert_type, channel)
);

create table if not exists user_notifications (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  event_id text references events(id) on delete cascade,
  alert_type text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, event_id, alert_type)   -- one alert per milestone
);
create index if not exists user_notifications_unread_idx on user_notifications (user_id, created_at desc) where read_at is null;

insert into ranking_periods (id, duration) values ('24h', '24 hours'), ('7d', '7 days'), ('30d', '30 days'), ('all', null) on conflict do nothing;
insert into ranking_categories (id, label, is_public, sort_order) values
  ('popular','Most popular',true,1),('attended','Most attended',true,2),('trending','Trending',true,3),('funded','Most funded',true,4),
  ('live','Live now',true,5),('dj_wanted','DJ wanted',true,6),('after_party','After party',true,7),('tickets','Tickets sold',true,8),('for_you','For you',false,9)
on conflict do nothing;
