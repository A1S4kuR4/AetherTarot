alter table public.reading_feedback
  alter column user_id drop not null,
  alter column email drop not null;

create unique index if not exists reading_feedback_subject_reading_idx
  on public.reading_feedback (
    reading_id,
    (coalesce(user_id::text, 'anonymous_ip:' || ip_hash))
  );

create table if not exists public.growth_events (
  event_id uuid primary key,
  created_at timestamptz not null default now(),
  event_type text not null check (
    event_type in (
      'page_view',
      'reading_started',
      'reading_completed',
      'feedback_submitted'
    )
  ),
  session_id uuid not null,
  attribution_id uuid not null,
  flow_id uuid,
  reading_id text,
  user_id uuid,
  ip_hash text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_path text not null,
  referrer_host text,
  check (char_length(landing_path) <= 256),
  check (utm_source is null or char_length(utm_source) <= 120),
  check (utm_medium is null or char_length(utm_medium) <= 120),
  check (utm_campaign is null or char_length(utm_campaign) <= 120),
  check (utm_content is null or char_length(utm_content) <= 120),
  check (utm_term is null or char_length(utm_term) <= 120),
  check (referrer_host is null or char_length(referrer_host) <= 255),
  check (reading_id is null or char_length(reading_id) <= 128),
  check (event_type = 'page_view' or flow_id is not null),
  check (
    event_type not in ('reading_completed', 'feedback_submitted')
    or reading_id is not null
  )
);

create index if not exists growth_events_created_at_idx
  on public.growth_events (created_at desc);

create index if not exists growth_events_source_created_at_idx
  on public.growth_events (utm_source, created_at desc);

create unique index if not exists growth_events_page_view_session_idx
  on public.growth_events (session_id, event_type)
  where event_type = 'page_view';

create unique index if not exists growth_events_flow_event_idx
  on public.growth_events (flow_id, event_type)
  where flow_id is not null;

alter table public.growth_events enable row level security;

create or replace function public.consume_growth_event_quota(
  p_ip_hash text,
  p_ip_minute_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_minute_start timestamptz := date_trunc('minute', v_now);
  v_counter_key text :=
    'growth_event_ip_minute:' || p_ip_hash || ':' || to_char(v_now, 'YYYY-MM-DD"T"HH24:MI');
  v_count integer;
begin
  if p_ip_hash is null or length(trim(p_ip_hash)) = 0 then
    raise exception 'Growth event IP hash is required.';
  end if;

  if p_ip_minute_limit <= 0 then
    raise exception 'Growth event quota limit must be positive.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_counter_key));

  select count_value into v_count
  from public.usage_counters
  where counter_key = v_counter_key;

  if coalesce(v_count, 0) >= p_ip_minute_limit then
    return false;
  end if;

  insert into public.usage_counters (
    counter_key,
    counter_type,
    window_start,
    count_value,
    cost_value_usd,
    updated_at
  )
  values (
    v_counter_key,
    'growth_event_ip_minute',
    v_minute_start,
    1,
    0,
    v_now
  )
  on conflict (counter_key) do update
  set
    count_value = public.usage_counters.count_value + 1,
    updated_at = excluded.updated_at;

  return true;
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
  v_counter_cutoff timestamptz :=
    (v_usage_day - 7)::timestamp at time zone 'Asia/Shanghai';
begin
  delete from public.auth_email_events
  where created_at < v_now - interval '30 days';

  delete from public.reading_events
  where created_at < v_now - interval '30 days';

  delete from public.encyclopedia_events
  where created_at < v_now - interval '30 days';

  delete from public.reading_feedback
  where created_at < v_now - interval '90 days';

  delete from public.growth_events
  where created_at < v_now - interval '90 days';

  delete from public.stored_readings
  where created_at < v_now - interval '365 days';

  delete from public.reading_thread_memories
  where updated_at < v_now - interval '90 days';

  delete from public.reading_initial_snapshots
  where expires_at <= v_now;

  delete from public.reading_request_executions
  where expires_at <= v_now;

  delete from public.llm_token_reservations
  where status = 'settled'
    and settled_at < v_now - interval '7 days';

  delete from public.llm_daily_token_usage
  where usage_day < v_usage_day - 7;

  delete from public.usage_counters
  where window_start < v_counter_cutoff;
end;
$$;
