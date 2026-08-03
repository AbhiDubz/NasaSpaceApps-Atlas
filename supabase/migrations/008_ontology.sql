-- Ontology foundation — turn the entity index into a persistent object graph.
--
-- Evolves the existing `entities` / `entity_links` tables from 007 rather than
-- creating a parallel `objects` table, so api/_lib/entityStore.js and the RLS
-- policies already in place keep working.

-- Extension objects are referenced unqualified below so this migration works
-- whether the extensions were previously installed into `public` or the
-- `extensions` schema Supabase now prefers.
set search_path = public, extensions;

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── Objects ───────────────────────────────────────────────────────────────
-- Widen `kind` from the six analyst primitives to the full object model.

alter table public.entities
  drop constraint if exists entities_kind_check;

alter table public.entities
  add constraint entities_kind_check check (kind in (
    -- 007 primitives
    'place', 'actor', 'topic', 'asset', 'organization', 'vessel',
    -- object model
    'company', 'country', 'event', 'trade_flow', 'energy_asset',
    'news_item', 'economic_indicator', 'shipment'
  ));

alter table public.entities
  add column if not exists properties        jsonb default '{}',
  add column if not exists location          geography(Point, 4326),
  add column if not exists domain            text,
  add column if not exists confidence        double precision default 1.0,
  add column if not exists resolution_method text default 'exact',
  add column if not exists first_seen_at     timestamptz default now(),
  add column if not exists last_seen_at      timestamptz default now();

alter table public.entities
  drop constraint if exists entities_resolution_method_check;

alter table public.entities
  add constraint entities_resolution_method_check
  check (resolution_method in ('exact', 'alias', 'fuzzy', 'manual', 'new'));

-- Backfill `location` from the flat lat/lng columns carried over from 007.
update public.entities
   set location = st_setsrid(st_makepoint(lng, lat), 4326)::geography
 where location is null and lat is not null and lng is not null;

create index if not exists idx_entities_location
  on public.entities using gist (location);
create index if not exists idx_entities_label_trgm
  on public.entities using gin (label gin_trgm_ops);
create index if not exists idx_entities_domain
  on public.entities (domain) where domain is not null;
create index if not exists idx_entities_last_seen
  on public.entities (last_seen_at desc);

-- ── Links ─────────────────────────────────────────────────────────────────
-- 007 constrained link_type to analyst confidence (fact/hypothesis/correlation).
-- Semantic relations are the point of the ontology layer, so carry both.

alter table public.entity_links
  drop constraint if exists entity_links_link_type_check;

alter table public.entity_links
  add constraint entity_links_link_type_check check (link_type in (
    -- analyst confidence (007)
    'fact', 'hypothesis', 'correlation',
    -- semantic relations
    'headquartered_in', 'mentioned_in', 'involved_in', 'occurred_near',
    'measures', 'transporting', 'exports_to', 'located_in', 'operated_by'
  ));

-- 007 enforced link uniqueness with an expression index over
-- `coalesce(label, '')`. PostgREST cannot target an expression index for
-- upserts, so normalize the column and promote it to a real constraint —
-- same semantics, now usable for conflict resolution on batch writes.
update public.entity_links set label = '' where label is null;

alter table public.entity_links
  alter column label set default '',
  alter column label set not null;

drop index if exists idx_entity_links_unique;

alter table public.entity_links
  drop constraint if exists entity_links_unique_edge;

alter table public.entity_links
  add constraint entity_links_unique_edge
  unique (from_entity, to_entity, link_type, label);

-- ── Aliases ───────────────────────────────────────────────────────────────
-- 007 shipped an `aliases text[]` column that is never populated. Rows give us
-- per-alias provenance, trigram search, and a manual override channel.

create table if not exists public.entity_aliases (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid references public.entities(id) on delete cascade not null,
  alias      text not null,
  source     text,
  is_manual  boolean default false,
  created_at timestamptz default now(),
  unique (alias, source)
);

create index if not exists idx_entity_aliases_entity
  on public.entity_aliases (entity_id);
create index if not exists idx_entity_aliases_trgm
  on public.entity_aliases using gin (alias gin_trgm_ops);

alter table public.entity_aliases enable row level security;

drop policy if exists "Authenticated users can read entity aliases" on public.entity_aliases;
create policy "Authenticated users can read entity aliases"
  on public.entity_aliases for select
  using (auth.role() = 'authenticated' or auth.role() = 'service_role');

-- ── Writeback ─────────────────────────────────────────────────────────────

create table if not exists public.object_annotations (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid references public.entities(id) on delete cascade not null,
  user_id     uuid references auth.users on delete cascade not null,
  note        text,
  flag_status text check (flag_status in ('watching', 'escalated', 'resolved')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_object_annotations_entity
  on public.object_annotations (entity_id);
create index if not exists idx_object_annotations_user_flag
  on public.object_annotations (user_id, flag_status)
  where flag_status is not null;

alter table public.object_annotations enable row level security;

drop policy if exists "Users can read own annotations" on public.object_annotations;
create policy "Users can read own annotations"
  on public.object_annotations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own annotations" on public.object_annotations;
create policy "Users can insert own annotations"
  on public.object_annotations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own annotations" on public.object_annotations;
create policy "Users can update own annotations"
  on public.object_annotations for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own annotations" on public.object_annotations;
create policy "Users can delete own annotations"
  on public.object_annotations for delete
  using (auth.uid() = user_id);

-- ── Raw staging ───────────────────────────────────────────────────────────
-- One source-discriminated table rather than raw_<source> per feed. Holds the
-- untouched upstream response so transforms can be replayed and lineage from
-- an object back to its originating payload stays intact.

create table if not exists public.raw_ingest (
  id           uuid primary key default gen_random_uuid(),
  source_id    text not null,
  payload      jsonb not null,
  content_hash text,
  fetched_at   timestamptz default now(),
  processed_at timestamptz,
  error        text
);

create index if not exists idx_raw_ingest_source_fetched
  on public.raw_ingest (source_id, fetched_at desc);
-- Idempotency for pg_net's fire-and-forget retries: same payload, same tick.
create unique index if not exists idx_raw_ingest_source_hash
  on public.raw_ingest (source_id, content_hash)
  where content_hash is not null;

alter table public.raw_ingest enable row level security;
-- No client policies: raw payloads are service-role only.

-- ── Ingest run log ────────────────────────────────────────────────────────
-- pg_net does not retry or alert on failure, so every attempt records a row.
-- A missing or failed run is then a query, not a silence.

create table if not exists public.ingest_runs (
  id           uuid primary key default gen_random_uuid(),
  source_id    text not null,
  status       text not null check (status in ('ok', 'error', 'skipped')),
  event_count  int default 0,
  object_count int default 0,
  duration_ms  int,
  error        text,
  started_at   timestamptz default now()
);

create index if not exists idx_ingest_runs_source_started
  on public.ingest_runs (source_id, started_at desc);

alter table public.ingest_runs enable row level security;

drop policy if exists "Authenticated users can read ingest runs" on public.ingest_runs;
create policy "Authenticated users can read ingest runs"
  on public.ingest_runs for select
  using (auth.role() = 'authenticated' or auth.role() = 'service_role');
