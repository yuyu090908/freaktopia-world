-- FREAKTOPIA WORLD 8.1: public Alien IDs, resumable onboarding, translation cache, row-level security.
-- Safe to run more than once. Requires 0005_identity_i18n.sql. Existing rows are kept and back-filled.

-- ---------------------------------------------------------------- public Alien ID (FREAK-00001284)
-- A display identifier only: never used for authentication. Internal user ids stay random UUIDs.
create sequence if not exists alien_public_seq start 1001;
alter table user_alien_identities add column if not exists public_id text;
update user_alien_identities set public_id = 'FREAK-' || lpad(nextval('alien_public_seq')::text, 8, '0') where public_id is null;
alter table user_alien_identities alter column public_id set default ('FREAK-' || lpad(nextval('alien_public_seq')::text, 8, '0'));
alter table user_alien_identities alter column public_id set not null;
create unique index if not exists user_alien_identities_public_id on user_alien_identities (public_id);

-- The public id is part of the permanent identity too.
create or replace function alien_base_is_permanent() returns trigger language plpgsql as $$
begin
  if (new.alien_family, new.body_color, new.accent_color, new.eye_variant, new.mouth_variant, new.pattern_variant,
      new.special_variant, new.generation_seed, new.alien_name, new.asset_version, new.public_id)
     is distinct from
     (old.alien_family, old.body_color, old.accent_color, old.eye_variant, old.mouth_variant, old.pattern_variant,
      old.special_variant, old.generation_seed, old.alien_name, old.asset_version, old.public_id) then
    raise exception 'alien base traits are permanent (user %)', old.user_id;
  end if;
  return new;
end $$;

-- The part catalogue under the name used in the 8.1 spec.
create or replace view alien_variants as select asset_version, part, variant from alien_asset_variants;

-- ---------------------------------------------------------------- onboarding progress (resumable)
create table if not exists user_onboarding_progress (
  user_id      uuid primary key references users(id) on delete cascade,
  step         text not null default 'reveal' check (step in ('reveal', 'name', 'genres', 'done')),
  revealed_at  timestamptz,
  named_at     timestamptz,
  genres_at    timestamptz,
  completed_at timestamptz,
  updated_at   timestamptz not null default now()
);
-- Back-fill: accounts that already saw the 8.0 reveal continue from the name step; nothing is overwritten.
insert into user_onboarding_progress (user_id, step, revealed_at)
select p.user_id, case when p.reveal_seen then 'name' else 'reveal' end, case when p.reveal_seen then now() end
from user_profiles p
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------- machine translation cache
-- Only filled when a translation provider is connected. Results are always labelled as machine translation.
create table if not exists translation_cache (
  key         char(64) primary key, -- sha256(provider | target | text)
  provider    text not null,
  target_lang text not null,
  source_lang text,
  translated  text not null,
  created_at  timestamptz not null default now()
);
create index if not exists translation_cache_created on translation_cache (created_at);

-- ---------------------------------------------------------------- row-level security
-- The app server connects as the table owner and checks ownership in code. RLS is a second line of defence
-- for any other role (for example a read-only analytics role or a client-facing API such as Supabase/PostgREST):
-- rows are visible and writable only when app.current_user_id matches. Auth tables are never exposed.
do $$
declare t text;
begin
  foreach t in array array['user_profiles', 'user_preferences', 'user_privacy_settings', 'user_alien_identities',
                           'user_alien_cosmetics', 'user_wallet_links', 'user_auth_providers', 'user_onboarding_progress']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format($p$create policy own_rows on %I using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
                    with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)$p$, t);
  end loop;
  foreach t in array array['auth_sessions', 'auth_tokens', 'auth_audit_log'] loop
    execute format('alter table %I enable row level security', t); -- no policy: other roles see nothing
  end loop;
end $$;
