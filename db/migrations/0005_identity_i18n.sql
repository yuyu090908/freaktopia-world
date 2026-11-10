-- FREAKTOPIA WORLD 8.0 · ACCOUNTS, ALIEN IDENTITY, LANGUAGE
-- PostgreSQL 15+. Used by lib/auth/pg.ts when DATABASE_URL is set; without it the app runs the in-memory DEMO store.
--
-- Rules kept in the schema:
--   * passwords are scrypt hashes, never plaintext (password_hash format check)
--   * one alien per user, forever: user_alien_identities.user_id is the primary key (no reroll)
--   * one (provider, subject) and one wallet address belong to at most one user: no duplicate accounts
--   * session and one-time tokens are stored as SHA-256 hashes only
--   * privacy defaults expose as little as possible; no location column anywhere
--   * the alien never affects voting power: nothing here is referenced by DAO weight logic

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- users (core table, extended)

create table if not exists users (id uuid primary key default gen_random_uuid());
alter table users add column if not exists email text;
alter table users add column if not exists email_verified_at timestamptz;
alter table users add column if not exists password_hash text;
alter table users add column if not exists created_at timestamptz not null default now();
alter table users add column if not exists disabled_at timestamptz;
alter table users drop constraint if exists users_email_lowercase;
alter table users add constraint users_email_lowercase check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
alter table users drop constraint if exists users_password_hashed;
alter table users add constraint users_password_hashed check (password_hash is null or password_hash like 'scrypt$%');
create unique index if not exists users_email_unique on users (email) where email is not null;

-- ---------------------------------------------------------------- profile, preferences, privacy

create table user_profiles (
  user_id         uuid primary key references users(id) on delete cascade,
  display_name    text check (display_name is null or length(display_name) between 1 and 32),
  username        text check (username is null or username ~ '^[a-z0-9_]{3,20}$'),
  country_code    char(2) check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  favorite_genres text[] not null default '{}',
  xp              integer not null default 0 check (xp >= 0),
  reveal_seen     boolean not null default false,
  updated_at      timestamptz not null default now()
);
create unique index user_profiles_username_unique on user_profiles (username) where username is not null;

create table user_preferences (
  user_id        uuid primary key references users(id) on delete cascade,
  locale         text not null default 'en' check (locale in ('en','ja','ko','zh-CN','ru','th','es','pt','fr','de','vi','id')),
  reduced_motion boolean not null default false,
  updated_at     timestamptz not null default now()
);

create type visibility as enum ('public', 'friends', 'private');

create table user_privacy_settings (
  user_id      uuid primary key references users(id) on delete cascade,
  profile      visibility not null default 'friends',
  avatar       visibility not null default 'public',
  activity     visibility not null default 'private',
  show_country boolean not null default false,
  map_presence boolean not null default false, -- alien at joined events on the WORLD MAP; opt-in, never GPS
  live_avatar  boolean not null default true,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- auth

create table user_auth_providers (
  provider   text not null check (provider in ('google')),
  subject    text not null,
  user_id    uuid not null references users(id) on delete cascade,
  email      text,
  linked_at  timestamptz not null default now(),
  primary key (provider, subject),
  unique (user_id, provider)
);

create table user_wallet_links (
  address   text primary key check (address ~ '^0x[0-9a-f]{40}$'), -- lower-case
  chain_id  integer not null,
  user_id   uuid not null references users(id) on delete cascade,
  linked_at timestamptz not null default now()
);
create index user_wallet_links_user on user_wallet_links (user_id);

create table auth_sessions (
  token_hash char(64) primary key, -- sha256 hex of the cookie token
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index auth_sessions_user on auth_sessions (user_id);

create table auth_tokens (
  token_hash char(64) primary key,
  kind       text not null check (kind in ('verify', 'reset')),
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index auth_tokens_user on auth_tokens (user_id, kind);

create table auth_audit_log (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  event   text not null,
  user_id uuid references users(id) on delete set null,
  ip      text,
  meta    jsonb not null default '{}'::jsonb
);
create index auth_audit_log_user on auth_audit_log (user_id, at desc);

-- ---------------------------------------------------------------- alien identity

create table alien_families (
  id        text primary key check (id in ('slime', 'fuzz', 'mutant', 'jelly')),
  name      text not null,
  is_active boolean not null default true
);
insert into alien_families (id, name) values ('slime', 'SLIME'), ('fuzz', 'FUZZ'), ('mutant', 'MUTANT'), ('jelly', 'JELLY');

-- Every selectable part (eyes, mouth, pattern…) per asset version. Art is original SVG in the repo.
create table alien_asset_variants (
  asset_version integer not null,
  part          text not null check (part in ('body_color', 'eye', 'mouth', 'pattern', 'accessory', 'outfit', 'special')),
  variant       text not null,
  is_random     boolean not null default true, -- false: earned only, never rolled
  licence       text not null default 'original, FREAKTOPIA WORLD',
  primary key (asset_version, part, variant)
);

create table user_alien_identities (
  user_id           uuid primary key references users(id) on delete cascade, -- 1:1, enforced
  alien_name        text not null,
  alien_family      text not null references alien_families(id),
  body_color        text not null,
  accent_color      text not null,
  eye_variant       text not null,
  mouth_variant     text not null,
  pattern_variant   text not null,
  accessory_variant text not null,
  outfit_variant    text not null,
  outfit_color      text not null,
  special_variant   text not null,
  generation_seed   char(32) not null unique, -- 128-bit CSPRNG seed, hex
  asset_version     integer not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Base parts can never change after birth (no reroll). Only accessory, outfit and outfit colour may.
create function alien_base_is_permanent() returns trigger language plpgsql as $$
begin
  if (new.alien_family, new.body_color, new.accent_color, new.eye_variant, new.mouth_variant, new.pattern_variant,
      new.special_variant, new.generation_seed, new.alien_name, new.asset_version)
     is distinct from
     (old.alien_family, old.body_color, old.accent_color, old.eye_variant, old.mouth_variant, old.pattern_variant,
      old.special_variant, old.generation_seed, old.alien_name, old.asset_version) then
    raise exception 'alien base traits are permanent (user %)', old.user_id;
  end if;
  return new;
end $$;
create trigger user_alien_identities_permanent before update on user_alien_identities
  for each row execute function alien_base_is_permanent();

create table alien_cosmetics (
  id          text primary key,
  part        text not null check (part in ('accessory', 'outfit')),
  variant     text not null,
  name        text not null,
  source      text not null check (source in ('achievement', 'dao', 'nft', 'event')),
  -- Cosmetic only: no column here can grant votes, funding or ranking weight.
  created_at  timestamptz not null default now()
);

create table user_alien_cosmetics (
  user_id     uuid not null references users(id) on delete cascade,
  cosmetic_id text not null references alien_cosmetics(id),
  granted_at  timestamptz not null default now(),
  primary key (user_id, cosmetic_id)
);
