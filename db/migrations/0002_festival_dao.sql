-- FREAKTOPIA WORLD 5.0 · FESTIVAL DAO × AI STAGE DESIGN × COMMUNITY GOVERNANCE
-- PostgreSQL 15+. NOT applied anywhere yet: the demo build keeps DAO data in memory
-- (lib/dao/store.ts). Setting DAO_DATA_MODE=production without a database adapter
-- returns 503 DATA_SOURCE_NOT_CONFIGURED instead of silently using demo data.
--
-- Assumes core tables from earlier migrations: users(id uuid pk), events(id text pk), venues(id text pk).
-- All timestamps are timestamptz (UTC). Money is stored in minor units (bigint) with a currency.
-- Token amounts are numeric(78,0) base units (fits uint256).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- DAO core

create type dao_status as enum ('forming', 'active', 'building', 'festival', 'archived');
create type dao_role as enum ('member', 'moderator', 'organizer', 'treasurer', 'venue_owner');

create table event_daos (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique references events(id) on delete restrict,
  status dao_status not null default 'forming',
  description text not null default '',
  organizer_user_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dao_configs (
  dao_id uuid primary key references event_daos(id) on delete cascade,
  chain_id integer not null,
  token_contract char(42) not null check (token_contract ~ '^0x[0-9a-fA-F]{40}$'),
  staking_contract char(42) not null check (staking_contract ~ '^0x[0-9a-fA-F]{40}$'),
  -- Production requires an independent audit of the staking contract before any stake is accepted.
  staking_audit_url text,
  staking_audited_at timestamptz,
  token_symbol text not null,
  minimum_stake numeric(78,0) not null check (minimum_stake > 0),
  lock_duration_days integer not null check (lock_duration_days between 7 and 365),
  eligibility_snapshot_at timestamptz not null,
  voting_start_at timestamptz,
  voting_end_at timestamptz,
  unstaking_rules text not null,
  default_quorum numeric(4,3) not null check (default_quorum between 0.05 and 1),
  default_threshold numeric(4,3) not null check (default_threshold between 0.5 and 1),
  discussion_days integer not null check (discussion_days between 1 and 14),
  voting_days integer not null check (voting_days between 1 and 14),
  updated_at timestamptz not null default now(),
  check (voting_end_at is null or voting_start_at is null or voting_end_at > voting_start_at)
);

-- One wallet belongs to one account (globally), proven by a signed sign-in message.
create table user_wallets (
  address char(42) primary key check (address ~ '^0x[0-9a-fA-F]{40}$'),
  user_id uuid not null references users(id) on delete cascade,
  chain_id integer not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index user_wallets_user_idx on user_wallets (user_id);

-- Sign-in nonces: single use, short lived (replay protection).
create table auth_nonces (
  nonce text primary key,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create table dao_memberships (
  dao_id uuid not null references event_daos(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  handle text not null,
  joined_at timestamptz not null default now(),
  suspended_until timestamptz,
  flagged_reason text,
  flagged_cluster text,
  flagged_at timestamptz,
  primary key (dao_id, user_id),
  unique (dao_id, handle)
);

create table dao_role_assignments (
  dao_id uuid not null references event_daos(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role dao_role not null,
  granted_by uuid not null references users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (dao_id, user_id, role)
);

create type stake_status as enum ('locked', 'unlocking', 'withdrawn');

-- Mirror of on-chain stake positions, written only by the chain indexer (never by a signature alone).
create table stake_positions (
  id uuid primary key default gen_random_uuid(),
  dao_id uuid not null references event_daos(id) on delete cascade,
  user_id uuid not null references users(id),
  wallet char(42) not null references user_wallets(address),
  amount numeric(78,0) not null check (amount > 0),
  tx_hash char(66) not null unique,
  block_number bigint not null,
  staked_at timestamptz not null,
  locked_until timestamptz not null,
  status stake_status not null default 'locked',
  updated_at timestamptz not null default now()
);
create index stake_positions_dao_user_idx on stake_positions (dao_id, user_id, status);

-- Sybil signals (hashed; raw IPs / device ids are never stored).
create table sybil_signals (
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('device', 'ip', 'funding_source', 'wallet')),
  value_hash char(64) not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, kind, value_hash)
);
create index sybil_signals_value_idx on sybil_signals (kind, value_hash);

-- ---------------------------------------------------------------- discussion

create type dao_visibility as enum ('public', 'members', 'private');

create table media_objects (
  id uuid primary key default gen_random_uuid(),
  dao_id uuid references event_daos(id) on delete cascade,
  owner_user_id uuid not null references users(id),
  purpose text not null check (purpose in ('venue', 'attachment', 'evidence', 'concept_render')),
  storage_key text not null unique,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes integer not null check (bytes > 0 and bytes <= 8388608),
  width integer not null check (width >= 320),
  height integer not null check (height >= 200),
  sha256 char(64) not null,
  visibility dao_visibility not null default 'members',
  scanned_at timestamptz,
  created_at timestamptz not null default now()
);

create table dao_discussions (
  id uuid primary key default gen_random_uuid(),
  dao_id uuid not null references event_daos(id) on delete cascade,
  category text not null,
  title text not null check (char_length(title) between 6 and 120),
  body text not null check (char_length(body) between 20 and 5000),
  author_user_id uuid not null references users(id),
  visibility dao_visibility not null default 'public',
  pinned boolean not null default false,
  locked boolean not null default false,
  hidden boolean not null default false,
  concept_id uuid,
  dj_id text,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index dao_discussions_feed_idx on dao_discussions (dao_id, pinned desc, last_activity_at desc) where not hidden;

create table dao_comments (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references dao_discussions(id) on delete cascade,
  parent_id uuid references dao_comments(id) on delete cascade,
  author_user_id uuid not null references users(id),
  body text not null check (char_length(body) between 1 and 3000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index dao_comments_thread_idx on dao_comments (discussion_id, created_at);

create table dao_reactions (
  target_kind text not null check (target_kind in ('discussion', 'comment')),
  target_id uuid not null,
  user_id uuid not null references users(id) on delete cascade,
  reaction text not null check (reaction in ('fire', 'alien', 'heart', 'think', 'nope')),
  created_at timestamptz not null default now(),
  primary key (target_kind, target_id, user_id, reaction)
);

create table dao_reports (
  target_kind text not null check (target_kind in ('discussion', 'comment')),
  target_id uuid not null,
  reporter_user_id uuid not null references users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (target_kind, target_id, reporter_user_id)
);

create table dao_attachments (
  discussion_id uuid not null references dao_discussions(id) on delete cascade,
  media_id uuid not null references media_objects(id) on delete restrict,
  primary key (discussion_id, media_id)
);

-- ---------------------------------------------------------------- proposals & votes

create type proposal_state as enum (
  'DRAFT', 'DISCUSSION', 'REVIEW', 'VOTING', 'APPROVED', 'REJECTED', 'FEASIBILITY_CHECK',
  'ORGANIZER_CONFIRMATION', 'EXECUTION', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'RE_REVIEW'
);
create type voting_method as enum ('single', 'yes_no_abstain', 'multiple', 'ranked');

create table dao_proposals (
  id uuid primary key default gen_random_uuid(),
  dao_id uuid not null references event_daos(id) on delete cascade,
  author_user_id uuid not null references users(id),
  category text not null,
  state proposal_state not null default 'DRAFT',
  method voting_method not null,
  discussion_days integer not null,
  voting_days integer not null,
  discussion_id uuid references dao_discussions(id),
  current_version integer not null default 1,
  execution_status text check (execution_status in ('executing', 'done', 'cannot_execute')),
  execution_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dao_proposals_state_idx on dao_proposals (dao_id, state);

create table dao_proposal_versions (
  proposal_id uuid not null references dao_proposals(id) on delete cascade,
  version integer not null,
  title text not null,
  description text not null,
  proposed_change text not null,
  estimated_cost_minor bigint not null default 0,
  currency char(3) not null default 'USD',
  options jsonb not null default '[]',
  documents jsonb not null default '[]',
  author_user_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  primary key (proposal_id, version)
);

create table dao_proposal_concepts (
  proposal_id uuid not null references dao_proposals(id) on delete cascade,
  concept_id uuid not null,
  primary key (proposal_id, concept_id)
);

-- Immutable lifecycle history (append only).
create table dao_proposal_transitions (
  id bigserial primary key,
  proposal_id uuid not null references dao_proposals(id) on delete cascade,
  from_state proposal_state not null,
  to_state proposal_state not null,
  actor text not null, -- user uuid or 'system'
  reason text,
  at timestamptz not null default now()
);

create table dao_eligibility_snapshots (
  id uuid primary key default gen_random_uuid(),
  dao_id uuid not null references event_daos(id) on delete cascade,
  taken_at timestamptz not null,
  minimum_stake numeric(78,0) not null,
  block_number bigint,
  eligible_count integer not null,
  hash char(64) not null
);

create table dao_snapshot_members (
  snapshot_id uuid not null references dao_eligibility_snapshots(id) on delete cascade,
  user_id uuid not null references users(id),
  primary key (snapshot_id, user_id)
);

create type vote_status as enum ('scheduled', 'open', 'closed');

create table dao_votes (
  id uuid primary key default gen_random_uuid(),
  dao_id uuid not null references event_daos(id) on delete cascade,
  proposal_id uuid not null unique references dao_proposals(id) on delete cascade,
  proposal_version integer not null,
  method voting_method not null,
  options jsonb not null,
  max_choices integer not null default 1,
  snapshot_id uuid not null references dao_eligibility_snapshots(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  quorum numeric(4,3) not null,
  threshold numeric(4,3) not null,
  status vote_status not null default 'scheduled',
  result jsonb,
  result_hash char(64),
  finalized_at timestamptz,
  check (end_at > start_at)
);

-- One ballot per account per vote. Weight is always 1 (stake never adds weight).
create table dao_ballots (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references dao_votes(id) on delete restrict,
  user_id uuid not null references users(id),
  choice jsonb not null,
  cast_at timestamptz not null default now(),
  held boolean not null default false, -- flagged accounts: counted only after review
  prev_hash char(64) not null,
  hash char(64) not null unique,
  unique (vote_id, user_id)
);

-- Ballots and transitions are append only.
create or replace function dao_forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'append-only table %', tg_table_name;
end $$;
-- The only allowed ballot update is releasing a held ballot after review.
create trigger dao_ballots_no_update before update on dao_ballots for each row
  when (old.held = new.held or old.choice is distinct from new.choice or old.hash <> new.hash) execute function dao_forbid_mutation();
create trigger dao_ballots_no_delete before delete on dao_ballots for each row execute function dao_forbid_mutation();
create trigger dao_transitions_no_update before update or delete on dao_proposal_transitions for each row execute function dao_forbid_mutation();

-- ---------------------------------------------------------------- AI stage design

create table venue_photos (
  id uuid primary key default gen_random_uuid(),
  dao_id uuid not null references event_daos(id) on delete cascade,
  venue_id text references venues(id),
  media_id uuid not null references media_objects(id),
  caption text not null,
  stage_zone jsonb not null, -- {x,y,w,h} 0..1
  ceiling_y numeric(4,3) not null,
  rights_status text not null check (rights_status in ('pending', 'verified', 'rejected')),
  rights_attested_by uuid not null references users(id),
  rights_attested_at timestamptz not null,
  rights_verified_by uuid references users(id),
  rights_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table stage_design_projects (
  id uuid primary key default gen_random_uuid(),
  dao_id uuid not null references event_daos(id) on delete cascade,
  photo_id uuid not null references venue_photos(id),
  theme text not null,
  venue_spec jsonb not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table stage_concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references stage_design_projects(id) on delete cascade,
  dao_id uuid not null references event_daos(id) on delete cascade,
  name text not null,
  theme text not null,
  creator_user_id uuid not null references users(id),
  description text not null,
  published boolean not null default false,
  discussion_id uuid references dao_discussions(id),
  created_at timestamptz not null default now()
);

create table stage_concept_versions (
  concept_id uuid not null references stage_concepts(id) on delete cascade,
  version integer not null,
  spec jsonb not null,
  instruction text,
  applied jsonb not null default '[]',
  ignored jsonb not null default '[]',
  provider text not null check (provider in ('demo-compositor', 'image-model')),
  prompt text not null,
  render_media_id uuid references media_objects(id),
  estimate_low_minor bigint not null,
  estimate_high_minor bigint not null,
  estimate_lines jsonb not null,
  estimate_basis text not null default 'ai_reference_estimate',
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  primary key (concept_id, version)
);

-- ---------------------------------------------------------------- feasibility (advisory)

create table feasibility_reports (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references dao_proposals(id) on delete cascade,
  overall text not null check (overall in ('feasible', 'conditional', 'not_feasible')),
  items jsonb not null, -- 10 items: status, note, alternative
  advisory_only boolean not null default true check (advisory_only),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table feasibility_signoffs (
  report_id uuid not null references feasibility_reports(id) on delete cascade,
  role text not null check (role in ('organizer', 'venue_manager', 'specialist')),
  user_id uuid not null references users(id),
  note text,
  signed_at timestamptz not null default now(),
  primary key (report_id, role)
);

-- ---------------------------------------------------------------- treasury

create type treasury_kind as enum ('staking_escrow', 'event_budget', 'ticket_revenue', 'sponsors');

create table treasury_accounts (
  id uuid primary key default gen_random_uuid(),
  dao_id uuid not null references event_daos(id) on delete cascade,
  kind treasury_kind not null,
  label text not null,
  currency text not null,
  balance_minor numeric(78,0) not null default 0,
  -- Staking escrow is member principal: never spendable.
  spendable boolean not null generated always as (kind <> 'staking_escrow') stored,
  unique (dao_id, kind)
);

create table budget_items (
  id uuid primary key default gen_random_uuid(),
  dao_id uuid not null references event_daos(id) on delete cascade,
  category text not null,
  label text not null,
  allocated_minor bigint not null check (allocated_minor >= 0),
  proposal_id uuid references dao_proposals(id)
);

create type payment_status as enum ('pending', 'approved', 'executed', 'rejected');

create table payment_requests (
  id uuid primary key default gen_random_uuid(),
  dao_id uuid not null references event_daos(id) on delete cascade,
  budget_item_id uuid not null references budget_items(id),
  from_kind treasury_kind not null check (from_kind <> 'staking_escrow'),
  payee text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'USD',
  memo text not null,
  requested_by uuid not null references users(id),
  requested_at timestamptz not null default now(),
  required_approvals integer not null check (required_approvals between 1 and 5),
  required_roles dao_role[] not null,
  status payment_status not null default 'pending',
  rail_reference text, -- set only by the (not yet implemented) payment rail
  executed_at timestamptz
);

create table payment_approvals (
  payment_id uuid not null references payment_requests(id) on delete cascade,
  user_id uuid not null references users(id),
  role dao_role not null,
  approved_at timestamptz not null default now(),
  primary key (payment_id, user_id),
  unique (payment_id, role)
);

create table payment_evidence (
  payment_id uuid not null references payment_requests(id) on delete cascade,
  media_id uuid not null references media_objects(id),
  primary key (payment_id, media_id)
);

-- Requesters can never approve their own payment.
create or replace function payment_no_self_approval() returns trigger language plpgsql as $$
begin
  if exists (select 1 from payment_requests p where p.id = new.payment_id and p.requested_by = new.user_id) then
    raise exception 'SELF_APPROVAL';
  end if;
  return new;
end $$;
create trigger payment_approvals_no_self before insert on payment_approvals for each row execute function payment_no_self_approval();

-- ---------------------------------------------------------------- roadmap & game

create table dao_milestones (
  id uuid primary key default gen_random_uuid(),
  dao_id uuid not null references event_daos(id) on delete cascade,
  title text not null,
  due timestamptz not null,
  status text not null check (status in ('todo', 'doing', 'done', 'blocked')),
  proposal_id uuid references dao_proposals(id),
  note text
);

create table dao_xp_events (
  id bigserial primary key,
  dao_id uuid not null references event_daos(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  action text not null,
  target text,
  content_hash char(64),
  xp integer not null check (xp >= 0),
  at timestamptz not null default now()
);
create unique index dao_xp_once_per_target on dao_xp_events (dao_id, user_id, action, target) where target is not null;
create index dao_xp_daily_idx on dao_xp_events (dao_id, user_id, at);

create table dao_badges (
  dao_id uuid not null references event_daos(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  badge text not null check (badge in ('community', 'designer', 'voter', 'founder', 'cosmetic_antenna')),
  awarded_at timestamptz not null default now(),
  primary key (dao_id, user_id, badge)
);

-- ---------------------------------------------------------------- audit

-- Hash-chained activity log per DAO (append only).
create table dao_activity_log (
  id bigserial primary key,
  dao_id uuid not null references event_daos(id) on delete cascade,
  actor text not null,
  action text not null,
  target text not null,
  detail jsonb,
  at timestamptz not null default now(),
  prev_hash char(64) not null,
  hash char(64) not null unique
);
create index dao_activity_dao_idx on dao_activity_log (dao_id, id);
create trigger dao_activity_no_update before update or delete on dao_activity_log for each row execute function dao_forbid_mutation();

create table dao_moderation_log (
  id bigserial primary key,
  dao_id uuid not null references event_daos(id) on delete cascade,
  moderator_user_id uuid not null references users(id),
  target_kind text not null,
  target_id uuid not null,
  action text not null check (action in ('hide', 'unhide', 'lock', 'unlock', 'pin', 'unpin', 'suspend', 'unsuspend', 'clear_flag')),
  reason text not null,
  at timestamptz not null default now()
);
