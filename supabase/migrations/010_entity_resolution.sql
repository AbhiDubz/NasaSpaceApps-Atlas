-- Entity resolution v2 — the fuzzy leg of exact → alias → fuzzy → new.
--
-- Trigram similarity lives in SQL because that is where the GIN indexes are;
-- pulling candidate labels into the function and comparing them in JS would
-- mean a sequential scan of the whole object table on every ingest tick.

set search_path = public, extensions;

/**
 * Best trigram match for a label within one object kind, across both canonical
 * labels and recorded aliases. Returns at most one row, and nothing at all
 * below `p_threshold` — a weak match must read as "no match", not as a guess
 * the caller has to second-guess.
 */
create or replace function public.resolve_entity_fuzzy(
  p_label     text,
  p_kind      text,
  p_threshold double precision default 0.62
)
returns table (
  id                uuid,
  canonical_id      text,
  label             text,
  kind              text,
  iso               text,
  lat               double precision,
  lng               double precision,
  domain            text,
  confidence        double precision,
  resolution_method text,
  properties        jsonb,
  similarity        double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with candidates as (
    select e.id, similarity(e.label, p_label) as sim
      from public.entities e
     where e.kind = p_kind
       and e.label % p_label
    union all
    select a.entity_id as id, similarity(a.alias, p_label) as sim
      from public.entity_aliases a
      join public.entities e on e.id = a.entity_id
     where e.kind = p_kind
       and a.alias % p_label
  ),
  best as (
    select id, max(sim) as sim
      from candidates
     group by id
    having max(sim) >= p_threshold
     order by max(sim) desc
     limit 1
  )
  select e.id, e.canonical_id, e.label, e.kind, e.iso, e.lat, e.lng,
         e.domain, e.confidence, e.resolution_method, e.properties, b.sim
    from best b
    join public.entities e on e.id = b.id;
$$;

grant execute on function public.resolve_entity_fuzzy(text, text, double precision)
  to authenticated, service_role;

/**
 * Pin a label to an object permanently. Manual aliases outrank every automated
 * pass and are never overwritten by one.
 */
create or replace function public.set_manual_alias(p_entity_id uuid, p_alias text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  insert into public.entity_aliases (entity_id, alias, source, is_manual)
  values (p_entity_id, p_alias, 'manual', true)
  on conflict (alias, source) do update
    set entity_id = excluded.entity_id, is_manual = true;

  update public.entities
     set resolution_method = 'manual', confidence = 1.0
   where id = p_entity_id;
$$;

grant execute on function public.set_manual_alias(uuid, text) to authenticated, service_role;

-- Automated passes must not clobber a human decision, even if they resolve to
-- the same row by a different route.
create or replace function public.protect_manual_aliases()
returns trigger
language plpgsql
as $$
begin
  if old.is_manual and not new.is_manual then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_manual_aliases on public.entity_aliases;
create trigger trg_protect_manual_aliases
  before update on public.entity_aliases
  for each row execute function public.protect_manual_aliases();
