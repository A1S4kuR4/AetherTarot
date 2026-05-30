create table if not exists public.auth_email_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text,
  ip_hash text not null,
  status text not null check (status in ('success', 'failure')),
  error_code text,
  duration_ms integer not null default 0
);

create index if not exists auth_email_events_created_at_idx
  on public.auth_email_events (created_at desc);

create index if not exists auth_email_events_email_created_at_idx
  on public.auth_email_events (email, created_at desc);

alter table public.auth_email_events enable row level security;

create or replace function public.consume_auth_email_quota(
  p_email text,
  p_ip_hash text,
  p_email_hourly_limit integer,
  p_email_daily_limit integer,
  p_ip_hourly_limit integer,
  p_global_hourly_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_local_now timestamp := timezone('Asia/Shanghai', v_now);
  v_usage_day date := v_local_now::date;
  v_hour_start timestamptz := date_trunc('hour', v_local_now) at time zone 'Asia/Shanghai';
  v_day_start timestamptz := v_usage_day::timestamp at time zone 'Asia/Shanghai';
  v_hour_retry_after_seconds integer := greatest(
    1,
    ceil(extract(epoch from (((date_trunc('hour', v_local_now) + interval '1 hour') at time zone 'Asia/Shanghai') - v_now)))::integer
  );
  v_day_retry_after_seconds integer := greatest(
    1,
    ceil(extract(epoch from (((v_usage_day + 1)::timestamp at time zone 'Asia/Shanghai') - v_now)))::integer
  );
  v_email text := lower(trim(p_email));
  v_hour_bucket text := to_char(v_local_now, 'YYYY-MM-DD"T"HH24');
  v_email_hour_key text := 'auth_email_hourly:' || v_email || ':' || v_hour_bucket;
  v_email_day_key text := 'auth_email_daily:' || v_email || ':' || v_usage_day::text;
  v_ip_hour_key text := 'auth_email_ip_hourly:' || p_ip_hash || ':' || v_hour_bucket;
  v_global_hour_key text := 'auth_email_global_hourly:' || v_hour_bucket;
  v_count integer;
begin
  if v_email = '' then
    raise exception 'Auth email quota requires an email.';
  end if;

  if p_email_hourly_limit <= 0
    or p_email_daily_limit <= 0
    or p_ip_hourly_limit <= 0
    or p_global_hourly_limit <= 0
  then
    raise exception 'Auth email quota limits must be positive.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_email_hour_key));
  perform pg_advisory_xact_lock(hashtext(v_email_day_key));
  perform pg_advisory_xact_lock(hashtext(v_ip_hour_key));
  perform pg_advisory_xact_lock(hashtext(v_global_hour_key));

  select count_value into v_count
  from public.usage_counters
  where counter_key = v_email_hour_key;

  if coalesce(v_count, 0) >= p_email_hourly_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'email_hourly',
      'retry_after_seconds', v_hour_retry_after_seconds
    );
  end if;

  select count_value into v_count
  from public.usage_counters
  where counter_key = v_email_day_key;

  if coalesce(v_count, 0) >= p_email_daily_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'email_daily',
      'retry_after_seconds', v_day_retry_after_seconds
    );
  end if;

  select count_value into v_count
  from public.usage_counters
  where counter_key = v_ip_hour_key;

  if coalesce(v_count, 0) >= p_ip_hourly_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'ip_hourly',
      'retry_after_seconds', v_hour_retry_after_seconds
    );
  end if;

  select count_value into v_count
  from public.usage_counters
  where counter_key = v_global_hour_key;

  if coalesce(v_count, 0) >= p_global_hourly_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'global_hourly',
      'retry_after_seconds', v_hour_retry_after_seconds
    );
  end if;

  insert into public.usage_counters (
    counter_key,
    counter_type,
    window_start,
    count_value,
    cost_value_usd,
    updated_at
  )
  values
    (v_email_hour_key, 'auth_email_hourly', v_hour_start, 1, 0, v_now),
    (v_email_day_key, 'auth_email_daily', v_day_start, 1, 0, v_now),
    (v_ip_hour_key, 'auth_email_ip_hourly', v_hour_start, 1, 0, v_now),
    (v_global_hour_key, 'auth_email_global_hourly', v_hour_start, 1, 0, v_now)
  on conflict (counter_key) do update
  set
    count_value = public.usage_counters.count_value + 1,
    updated_at = excluded.updated_at;

  return jsonb_build_object('allowed', true);
end;
$$;

create or replace function public.cleanup_beta_ops_retention()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_usage_day date := timezone('Asia/Shanghai', v_now)::date;
  v_counter_cutoff timestamptz := (v_usage_day - 7)::timestamp at time zone 'Asia/Shanghai';
begin
  delete from public.auth_email_events
  where created_at < v_now - interval '30 days';

  delete from public.reading_events
  where created_at < v_now - interval '30 days';

  delete from public.encyclopedia_events
  where created_at < v_now - interval '30 days';

  delete from public.reading_feedback
  where created_at < v_now - interval '90 days';

  delete from public.llm_token_reservations
  where status = 'settled'
    and settled_at < v_now - interval '7 days';

  delete from public.llm_daily_token_usage
  where usage_day < v_usage_day - 7;

  delete from public.usage_counters
  where window_start < v_counter_cutoff;
end;
$$;

revoke all on function public.consume_auth_email_quota(text, text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_auth_email_quota(text, text, integer, integer, integer, integer) to service_role;
