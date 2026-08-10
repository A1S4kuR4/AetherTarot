create or replace function public.consume_reading_phase_subject_quota(
  p_subject_key text,
  p_ip_hash text,
  p_subject_daily_limit integer,
  p_ip_minute_limit integer,
  p_charge_daily_quota boolean
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
  v_daily_key text := 'reading_user_daily:' || p_subject_key || ':' || v_usage_day::text;
  v_ip_minute_key text := 'llm_ip_minute:' || p_ip_hash || ':' || to_char(v_local_now, 'YYYY-MM-DD"T"HH24:MI');
  v_count integer;
begin
  if p_subject_key is null or length(trim(p_subject_key)) = 0 then
    raise exception 'Reading quota subject key is required.';
  end if;

  if p_ip_hash is null or length(trim(p_ip_hash)) = 0 then
    raise exception 'Reading quota IP hash is required.';
  end if;

  if p_subject_daily_limit <= 0 or p_ip_minute_limit <= 0 then
    raise exception 'Reading quota limits must be positive.';
  end if;

  if p_charge_daily_quota is null then
    raise exception 'Reading phase quota charge flag is required.';
  end if;

  if p_charge_daily_quota then
    perform pg_advisory_xact_lock(hashtext(v_daily_key));

    select count_value into v_count
    from public.usage_counters
    where counter_key = v_daily_key;

    if coalesce(v_count, 0) >= p_subject_daily_limit then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'user_daily',
        'retry_after_seconds', v_retry_after_seconds
      );
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_ip_minute_key));

  select count_value into v_count
  from public.usage_counters
  where counter_key = v_ip_minute_key;

  if coalesce(v_count, 0) >= p_ip_minute_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'ip_minute',
      'retry_after_seconds', 60
    );
  end if;

  insert into public.usage_counters (
    counter_key,
    counter_type,
    window_start,
    count_value,
    cost_value_usd,
    updated_at
  ) values (
    v_ip_minute_key,
    'llm_ip_minute',
    v_minute_start,
    1,
    0,
    v_now
  )
  on conflict (counter_key) do update
  set
    count_value = public.usage_counters.count_value + 1,
    updated_at = excluded.updated_at;

  if p_charge_daily_quota then
    insert into public.usage_counters (
      counter_key,
      counter_type,
      window_start,
      count_value,
      cost_value_usd,
      updated_at
    ) values (
      v_daily_key,
      'reading_user_daily',
      v_day_start,
      1,
      0,
      v_now
    )
    on conflict (counter_key) do update
    set
      count_value = public.usage_counters.count_value + 1,
      updated_at = excluded.updated_at;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'daily_quota_charged', p_charge_daily_quota
  );
end;
$$;

create or replace function public.consume_reading_phase_quota(
  p_user_id uuid,
  p_ip_hash text,
  p_user_daily_limit integer,
  p_ip_minute_limit integer,
  p_charge_daily_quota boolean
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.consume_reading_phase_subject_quota(
    p_user_id::text,
    p_ip_hash,
    p_user_daily_limit,
    p_ip_minute_limit,
    p_charge_daily_quota
  );
$$;

create or replace function public.consume_anonymous_reading_phase_quota(
  p_ip_hash text,
  p_anonymous_daily_limit integer,
  p_ip_minute_limit integer,
  p_charge_daily_quota boolean
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.consume_reading_phase_subject_quota(
    'anonymous_ip:' || p_ip_hash,
    p_ip_hash,
    p_anonymous_daily_limit,
    p_ip_minute_limit,
    p_charge_daily_quota
  );
$$;

revoke all on function public.consume_reading_phase_subject_quota(text, text, integer, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.consume_reading_phase_quota(uuid, text, integer, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.consume_anonymous_reading_phase_quota(text, integer, integer, boolean)
  from public, anon, authenticated;

grant execute on function public.consume_reading_phase_subject_quota(text, text, integer, integer, boolean)
  to service_role;
grant execute on function public.consume_reading_phase_quota(uuid, text, integer, integer, boolean)
  to service_role;
grant execute on function public.consume_anonymous_reading_phase_quota(text, integer, integer, boolean)
  to service_role;
