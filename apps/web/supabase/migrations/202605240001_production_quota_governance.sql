create extension if not exists pgcrypto;
create extension if not exists pg_cron with schema extensions;

alter table public.encyclopedia_events
  drop column if exists query_text;

create table if not exists public.llm_daily_token_usage (
  usage_day date primary key,
  consumed_tokens bigint not null default 0 check (consumed_tokens >= 0),
  outstanding_reserved_tokens bigint not null default 0 check (outstanding_reserved_tokens >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.llm_token_reservations (
  id uuid primary key default gen_random_uuid(),
  usage_day date not null,
  source text not null check (source in ('reading', 'encyclopedia')),
  reserved_tokens integer not null check (reserved_tokens > 0),
  settled_tokens integer check (settled_tokens >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'settled')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists llm_token_reservations_usage_day_idx
  on public.llm_token_reservations (usage_day, status);

alter table public.llm_daily_token_usage enable row level security;
alter table public.llm_token_reservations enable row level security;

drop function if exists public.consume_reading_quota(
  text, uuid, text, integer, integer, integer, numeric, numeric
);
drop function if exists public.consume_encyclopedia_quota(
  text, uuid, text, integer, integer, integer, numeric, numeric
);

create or replace function public.consume_beta_feature_quota(
  p_feature text,
  p_user_id uuid,
  p_ip_hash text,
  p_user_daily_limit integer,
  p_ip_minute_limit integer
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
  v_day_start timestamptz := v_usage_day::timestamp at time zone 'Asia/Shanghai';
  v_minute_start timestamptz := date_trunc('minute', v_local_now) at time zone 'Asia/Shanghai';
  v_retry_after_seconds integer := greatest(
    1,
    ceil(extract(epoch from (((v_usage_day + 1)::timestamp at time zone 'Asia/Shanghai') - v_now)))::integer
  );
  v_user_key text;
  v_ip_minute_key text;
  v_count integer;
begin
  if p_feature not in ('reading', 'encyclopedia') then
    raise exception 'Unsupported quota feature: %', p_feature;
  end if;

  if p_user_daily_limit <= 0 or p_ip_minute_limit <= 0 then
    raise exception 'Quota limits must be positive.';
  end if;

  v_user_key := p_feature || '_user_daily:' || p_user_id::text || ':' || v_usage_day::text;
  v_ip_minute_key := 'llm_ip_minute:' || p_ip_hash || ':' || to_char(v_local_now, 'YYYY-MM-DD"T"HH24:MI');

  perform pg_advisory_xact_lock(hashtext(v_user_key));
  perform pg_advisory_xact_lock(hashtext(v_ip_minute_key));

  select count_value into v_count
  from public.usage_counters
  where counter_key = v_user_key;

  if coalesce(v_count, 0) >= p_user_daily_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'user_daily',
      'retry_after_seconds', v_retry_after_seconds
    );
  end if;

  select count_value into v_count
  from public.usage_counters
  where counter_key = v_ip_minute_key;

  if coalesce(v_count, 0) >= p_ip_minute_limit then
    return jsonb_build_object('allowed', false, 'reason', 'ip_minute', 'retry_after_seconds', 60);
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
    (v_user_key, p_feature || '_user_daily', v_day_start, 1, 0, v_now),
    (v_ip_minute_key, 'llm_ip_minute', v_minute_start, 1, 0, v_now)
  on conflict (counter_key) do update
  set
    count_value = public.usage_counters.count_value + 1,
    updated_at = excluded.updated_at;

  return jsonb_build_object('allowed', true);
end;
$$;

create or replace function public.consume_reading_quota(
  p_user_id uuid,
  p_ip_hash text,
  p_user_daily_limit integer,
  p_ip_minute_limit integer
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.consume_beta_feature_quota(
    'reading',
    p_user_id,
    p_ip_hash,
    p_user_daily_limit,
    p_ip_minute_limit
  );
$$;

create or replace function public.consume_encyclopedia_quota(
  p_user_id uuid,
  p_ip_hash text,
  p_user_daily_limit integer,
  p_ip_minute_limit integer
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.consume_beta_feature_quota(
    'encyclopedia',
    p_user_id,
    p_ip_hash,
    p_user_daily_limit,
    p_ip_minute_limit
  );
$$;

create or replace function public.reserve_daily_llm_tokens(
  p_source text,
  p_requested_tokens integer,
  p_daily_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_usage_day date := timezone('Asia/Shanghai', v_now)::date;
  v_retry_after_seconds integer := greatest(
    1,
    ceil(extract(epoch from (((timezone('Asia/Shanghai', v_now)::date + 1)::timestamp at time zone 'Asia/Shanghai') - v_now)))::integer
  );
  v_usage public.llm_daily_token_usage%rowtype;
  v_reservation_id uuid;
begin
  if p_source not in ('reading', 'encyclopedia') then
    raise exception 'Unsupported LLM token source: %', p_source;
  end if;

  if p_requested_tokens <= 0 or p_daily_limit <= 0 then
    raise exception 'Token limits must be positive.';
  end if;

  perform pg_advisory_xact_lock(hashtext('llm_daily_tokens:' || v_usage_day::text));

  insert into public.llm_daily_token_usage (usage_day)
  values (v_usage_day)
  on conflict (usage_day) do nothing;

  select * into v_usage
  from public.llm_daily_token_usage
  where usage_day = v_usage_day
  for update;

  if v_usage.consumed_tokens + v_usage.outstanding_reserved_tokens + p_requested_tokens > p_daily_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'llm_daily_tokens',
      'retry_after_seconds', v_retry_after_seconds,
      'consumed_tokens', v_usage.consumed_tokens,
      'outstanding_reserved_tokens', v_usage.outstanding_reserved_tokens
    );
  end if;

  insert into public.llm_token_reservations (usage_day, source, reserved_tokens)
  values (v_usage_day, p_source, p_requested_tokens)
  returning id into v_reservation_id;

  update public.llm_daily_token_usage
  set
    outstanding_reserved_tokens = outstanding_reserved_tokens + p_requested_tokens,
    updated_at = v_now
  where usage_day = v_usage_day;

  return jsonb_build_object(
    'allowed', true,
    'reservation_id', v_reservation_id,
    'reserved_tokens', p_requested_tokens,
    'usage_day', v_usage_day
  );
end;
$$;

create or replace function public.settle_daily_llm_tokens(
  p_reservation_id uuid,
  p_actual_tokens integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reservation public.llm_token_reservations%rowtype;
  v_settled_tokens integer := greatest(0, p_actual_tokens);
begin
  select * into v_reservation
  from public.llm_token_reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'LLM token reservation not found.';
  end if;

  if v_reservation.status = 'settled' then
    return jsonb_build_object('settled', true, 'already_settled', true);
  end if;

  update public.llm_daily_token_usage
  set
    consumed_tokens = consumed_tokens + v_settled_tokens,
    outstanding_reserved_tokens = greatest(0, outstanding_reserved_tokens - v_reservation.reserved_tokens),
    updated_at = v_now
  where usage_day = v_reservation.usage_day;

  update public.llm_token_reservations
  set
    status = 'settled',
    settled_tokens = v_settled_tokens,
    settled_at = v_now
  where id = p_reservation_id;

  return jsonb_build_object('settled', true, 'settled_tokens', v_settled_tokens);
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

revoke all on function public.consume_beta_feature_quota(text, uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.consume_reading_quota(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.consume_encyclopedia_quota(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.reserve_daily_llm_tokens(text, integer, integer) from public, anon, authenticated;
revoke all on function public.settle_daily_llm_tokens(uuid, integer) from public, anon, authenticated;
revoke all on function public.cleanup_beta_ops_retention() from public, anon, authenticated;

grant execute on function public.consume_reading_quota(uuid, text, integer, integer) to service_role;
grant execute on function public.consume_encyclopedia_quota(uuid, text, integer, integer) to service_role;
grant execute on function public.reserve_daily_llm_tokens(text, integer, integer) to service_role;
grant execute on function public.settle_daily_llm_tokens(uuid, integer) to service_role;
grant execute on function public.cleanup_beta_ops_retention() to service_role;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'aethertarot-retention-cleanup'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'aethertarot-retention-cleanup',
    '15 16 * * *',
    'select public.cleanup_beta_ops_retention();'
  );
end;
$$;
