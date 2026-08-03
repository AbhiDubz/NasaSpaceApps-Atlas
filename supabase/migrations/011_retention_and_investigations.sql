-- Retention + investigation persistence.
--
-- Events-as-objects dominate row count. Keep a 30-day sliding window and prune
-- nightly. Investigations leave localStorage and live in Postgres so canvas
-- state survives browsers and devices.

set search_path = public, extensions;

create schema if not exists atlas;

-- Keep PostGIS `location` in sync with the flat lat/lng columns the app writes.
create or replace function public.sync_entity_location()
returns trigger
language plpgsql
as $$
begin
  if new.lat is not null and new.lng is not null then
    new.location := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_entity_location on public.entities;
create trigger trg_sync_entity_location
  before insert or update of lat, lng on public.entities
  for each row execute function public.sync_entity_location();

-- ── Investigation documents ───────────────────────────────────────────────

create table if not exists public.investigations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces(id) on delete cascade not null unique,
  user_id       uuid references auth.users on delete cascade not null,
  document      jsonb not null,
  revision      int not null default 1,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_investigations_user
  on public.investigations (user_id);

-- One annotation per user+object so the Inspector upsert is a clean update.
create unique index if not exists idx_object_annotations_user_entity
  on public.object_annotations (user_id, entity_id);

alter table public.investigations enable row level security;

drop policy if exists "Users can read own investigations" on public.investigations;
create policy "Users can read own investigations"
  on public.investigations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own investigations" on public.investigations;
create policy "Users can insert own investigations"
  on public.investigations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own investigations" on public.investigations;
create policy "Users can update own investigations"
  on public.investigations for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own investigations" on public.investigations;
create policy "Users can delete own investigations"
  on public.investigations for delete
  using (auth.uid() = user_id);

-- ── Object retention ──────────────────────────────────────────────────────
-- Durable kinds (countries, actors, vessels, indicators, seeded aliases) are
-- kept. Ephemeral event / news_item rows older than 30 days are pruned.

create or replace function atlas.prune_ephemeral_objects(p_days int default 30)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  deleted int;
begin
  delete from public.entities
   where kind in ('event', 'news_item')
     and coalesce(last_seen_at, updated_at, created_at) < now() - make_interval(days => p_days)
     and resolution_method is distinct from 'manual';

  get diagnostics deleted = row_count;

  -- Raw staging is lineage, not a warehouse — keep two weeks.
  delete from public.raw_ingest
   where fetched_at < now() - interval '14 days';

  -- Run log stays long enough to diagnose missed ticks.
  delete from public.ingest_runs
   where started_at < now() - interval '30 days';

  return deleted;
end;
$$;

revoke all on function atlas.prune_ephemeral_objects(int) from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('atlas-prune-objects');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'atlas-prune-objects',
  '17 3 * * *',
  $$select atlas.prune_ephemeral_objects(30)$$
);
