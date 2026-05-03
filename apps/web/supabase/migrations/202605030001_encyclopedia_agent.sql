create table if not exists public.encyclopedia_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,
  email text,
  ip_hash text not null,
  provider text not null,
  query_text text,
  card_id text,
  source_count integer not null default 0,
  status text not null check (status in ('success', 'failure')),
  error_code text,
  duration_ms integer not null default 0,
  llm_duration_ms integer not null default 0,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0
);

create index if not exists encyclopedia_events_created_at_idx
  on public.encyclopedia_events (created_at desc);

create index if not exists encyclopedia_events_email_created_at_idx
  on public.encyclopedia_events (email, created_at desc);

alter table public.encyclopedia_events enable row level security;

create or replace function public.consume_encyclopedia_quota(
  p_email text,
  p_user_id uuid,
  p_ip_hash text,
  p_email_daily_limit integer,
  p_ip_minute_limit integer,
  p_ip_daily_limit integer,
  p_daily_cost_limit_usd numeric,
  p_cost_reservation_usd numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_day_start timestamptz := date_trunc('day', v_now);
  v_minute_start timestamptz := date_trunc('minute', v_now);
  v_email_key text := 'encyclopedia_email_daily:' || lower(p_email) || ':' || to_char(v_day_start, 'YYYY-MM-DD');
  v_ip_minute_key text := 'encyclopedia_ip_minute:' || p_ip_hash || ':' || to_char(v_minute_start, 'YYYY-MM-DD"T"HH24:MI');
  v_ip_day_key text := 'encyclopedia_ip_daily:' || p_ip_hash || ':' || to_char(v_day_start, 'YYYY-MM-DD');
  v_llm_day_key text := 'llm_daily:' || to_char(v_day_start, 'YYYY-MM-DD');
  v_count integer;
  v_cost numeric(12, 6);
begin
  perform pg_advisory_xact_lock(hashtext(v_email_key));
  perform pg_advisory_xact_lock(hashtext(v_ip_minute_key));
  perform pg_advisory_xact_lock(hashtext(v_ip_day_key));
  perform pg_advisory_xact_lock(hashtext(v_llm_day_key));

  select count_value into v_count
  from public.usage_counters
  where counter_key = v_email_key;

  if coalesce(v_count, 0) >= p_email_daily_limit then
    return jsonb_build_object('allowed', false, 'reason', 'email_daily', 'retry_after_seconds', 86400);
  end if;

  select count_value into v_count
  from public.usage_counters
  where counter_key = v_ip_minute_key;

  if coalesce(v_count, 0) >= p_ip_minute_limit then
    return jsonb_build_object('allowed', false, 'reason', 'ip_minute', 'retry_after_seconds', 60);
  end if;

  select count_value into v_count
  from public.usage_counters
  where counter_key = v_ip_day_key;

  if coalesce(v_count, 0) >= p_ip_daily_limit then
    return jsonb_build_object('allowed', false, 'reason', 'ip_daily', 'retry_after_seconds', 86400);
  end if;

  if p_cost_reservation_usd > 0 then
    select cost_value_usd into v_cost
    from public.usage_counters
    where counter_key = v_llm_day_key;

    if coalesce(v_cost, 0) + p_cost_reservation_usd > p_daily_cost_limit_usd then
      return jsonb_build_object('allowed', false, 'reason', 'llm_daily_cost', 'retry_after_seconds', 86400);
    end if;
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
    (v_email_key, 'encyclopedia_email_daily', v_day_start, 1, 0, v_now),
    (v_ip_minute_key, 'encyclopedia_ip_minute', v_minute_start, 1, 0, v_now),
    (v_ip_day_key, 'encyclopedia_ip_daily', v_day_start, 1, 0, v_now)
  on conflict (counter_key) do update
  set
    count_value = public.usage_counters.count_value + 1,
    updated_at = excluded.updated_at;

  if p_cost_reservation_usd > 0 then
    insert into public.usage_counters (
      counter_key,
      counter_type,
      window_start,
      count_value,
      cost_value_usd,
      updated_at
    )
    values (v_llm_day_key, 'llm_daily_cost', v_day_start, 0, p_cost_reservation_usd, v_now)
    on conflict (counter_key) do update
    set
      cost_value_usd = public.usage_counters.cost_value_usd + excluded.cost_value_usd,
      updated_at = excluded.updated_at;
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;
