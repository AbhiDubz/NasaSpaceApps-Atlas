-- Scheduled server-side ingestion: pg_cron drives pg_net against /api/ingest.
--
-- Both extensions ship on the Supabase free tier, so this replaces the browser
-- tab as the thing that keeps ATLAS collecting. No CI dependency, no new
-- service, no cost.
--
-- ─────────────────────────────────────────────────────────────────────────
-- ONE-TIME SETUP (run once per environment, values are project-specific):
--
--   select vault.create_secret('https://your-app.vercel.app', 'atlas_ingest_base_url');
--   select vault.create_secret('<same value as INGEST_SECRET env var>', 'atlas_ingest_secret');
--
-- Until both secrets exist every scheduled tick records a 'skipped' row in
-- ingest_runs rather than firing an unauthenticated request.
-- ─────────────────────────────────────────────────────────────────────────

set search_path = public, extensions;

create schema if not exists atlas;

/**
 * Fire one ingest request. pg_net is asynchronous: this returns a request id
 * immediately and the response lands in net._http_response. The endpoint logs
 * its own outcome to ingest_runs, which is the record we actually read.
 */
create or replace function atlas.trigger_ingest(p_source text)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_base   text;
  v_secret text;
begin
  select decrypted_secret into v_base
    from vault.decrypted_secrets where name = 'atlas_ingest_base_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'atlas_ingest_secret';

  if v_base is null or v_secret is null then
    insert into public.ingest_runs (source_id, status, error)
    values (p_source, 'skipped', 'atlas_ingest_base_url / atlas_ingest_secret not set in vault');
    return null;
  end if;

  return net.http_post(
    url := rtrim(v_base, '/') || '/api/ingest?source=' || p_source,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function atlas.trigger_ingest(text) from public, anon, authenticated;

-- Re-running this migration must not stack duplicate jobs.
do $$
declare
  job record;
begin
  for job in select jobname from cron.job where jobname like 'atlas-ingest-%' loop
    perform cron.unschedule(job.jobname);
  end loop;
end;
$$;

-- Cadence follows the tier each adapter declares. Minutes are staggered so a
-- single Vercel deployment is not hit by every source at once.
--
-- Tier A — 15 minutes (GDELT publishes a new export each quarter hour).
select cron.schedule('atlas-ingest-gdelt-cameo', '2,17,32,47 * * * *', $$select atlas.trigger_ingest('gdelt-cameo')$$);
select cron.schedule('atlas-ingest-usgs',        '4,19,34,49 * * * *', $$select atlas.trigger_ingest('usgs')$$);
select cron.schedule('atlas-ingest-gdacs',       '6,21,36,51 * * * *', $$select atlas.trigger_ingest('gdacs')$$);
select cron.schedule('atlas-ingest-eonet',       '8,23,38,53 * * * *', $$select atlas.trigger_ingest('eonet')$$);

-- Tier B — hourly.
select cron.schedule('atlas-ingest-firms',         '11 * * * *', $$select atlas.trigger_ingest('firms')$$);
select cron.schedule('atlas-ingest-noaa-nhc',      '13 * * * *', $$select atlas.trigger_ingest('noaa-nhc')$$);
select cron.schedule('atlas-ingest-celestrak-tle', '26 * * * *', $$select atlas.trigger_ingest('celestrak-tle')$$);

-- Tier C — every 6 hours.
select cron.schedule('atlas-ingest-acled', '41 */6 * * *', $$select atlas.trigger_ingest('acled')$$);

/**
 * Ingest health at a glance: last run per source and whether it is overdue.
 * pg_net never reports failure, so silence has to be visible as data.
 */
create or replace view public.ingest_health as
select
  j.jobname,
  replace(j.jobname, 'atlas-ingest-', '') as source_id,
  j.schedule,
  j.active,
  r.status       as last_status,
  r.started_at   as last_run_at,
  r.event_count  as last_event_count,
  r.object_count as last_object_count,
  r.error        as last_error
from cron.job j
left join lateral (
  select status, started_at, event_count, object_count, error
    from public.ingest_runs
   where source_id = replace(j.jobname, 'atlas-ingest-', '')
   order by started_at desc
   limit 1
) r on true
where j.jobname like 'atlas-ingest-%';
