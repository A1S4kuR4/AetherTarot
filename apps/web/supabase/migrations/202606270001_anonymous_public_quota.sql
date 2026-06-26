create or replace function public.consume_beta_feature_subject_quota(
  p_feature text,
  p_subject_key text,
  p_ip_hash text,
  p_subject_daily_limit integer,
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
  v_subject_key text;
  v_ip_minute_key text;
  v_count integer;
begin
  if p_feature not in ('reading', 'encyclopedia') then
    raise exception 'Unsupported quota feature: %', p_feature;
  end if;

  if p_subject_key is null or length(trim(p_subject_key)) = 0 then
    raise exception 'Quota subject key is required.';
  end if;

  if p_subject_daily_limit <= 0 or p_ip_minute_limit <= 0 then
    raise exception 'Quota limits must be positive.';
  end if;

  v_subject_key := p_feature || '_user_daily:' || p_subject_key || ':' || v_usage_day::text;
  v_ip_minute_key := 'llm_ip_minute:' || p_ip_hash || ':' || to_char(v_local_now, 'YYYY-MM-DD"T"HH24:MI');

  perform pg_advisory_xact_lock(hashtext(v_subject_key));
  perform pg_advisory_xact_lock(hashtext(v_ip_minute_key));

  select count_value into v_count
  from public.usage_counters
  where counter_key = v_subject_key;

  if coalesce(v_count, 0) >= p_subject_daily_limit then
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
    (v_subject_key, p_feature || '_user_daily', v_day_start, 1, 0, v_now),
    (v_ip_minute_key, 'llm_ip_minute', v_minute_start, 1, 0, v_now)
  on conflict (counter_key) do update
  set
    count_value = public.usage_counters.count_value + 1,
    updated_at = excluded.updated_at;

  return jsonb_build_object('allowed', true);
end;
$$;

create or replace function public.consume_beta_feature_quota(
  p_feature text,
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
  select public.consume_beta_feature_subject_quota(
    p_feature,
    p_user_id::text,
    p_ip_hash,
    p_user_daily_limit,
    p_ip_minute_limit
  );
$$;

create or replace function public.consume_anonymous_reading_quota(
  p_ip_hash text,
  p_anonymous_daily_limit integer,
  p_ip_minute_limit integer
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.consume_beta_feature_subject_quota(
    'reading',
    'anonymous_ip:' || p_ip_hash,
    p_ip_hash,
    p_anonymous_daily_limit,
    p_ip_minute_limit
  );
$$;

create or replace function public.consume_anonymous_encyclopedia_quota(
  p_ip_hash text,
  p_anonymous_daily_limit integer,
  p_ip_minute_limit integer
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.consume_beta_feature_subject_quota(
    'encyclopedia',
    'anonymous_ip:' || p_ip_hash,
    p_ip_hash,
    p_anonymous_daily_limit,
    p_ip_minute_limit
  );
$$;

revoke all on function public.consume_beta_feature_subject_quota(text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.consume_beta_feature_quota(text, uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.consume_anonymous_reading_quota(text, integer, integer) from public, anon, authenticated;
revoke all on function public.consume_anonymous_encyclopedia_quota(text, integer, integer) from public, anon, authenticated;

grant execute on function public.consume_beta_feature_subject_quota(text, text, text, integer, integer) to service_role;
grant execute on function public.consume_beta_feature_quota(text, uuid, text, integer, integer) to service_role;
grant execute on function public.consume_anonymous_reading_quota(text, integer, integer) to service_role;
grant execute on function public.consume_anonymous_encyclopedia_quota(text, integer, integer) to service_role;
