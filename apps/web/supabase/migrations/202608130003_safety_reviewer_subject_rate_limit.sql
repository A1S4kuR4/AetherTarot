create table if not exists public.safety_reviewer_subject_minute_usage (
  subject_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (subject_key, window_started_at),
  check (length(subject_key) = 64)
);

alter table public.safety_reviewer_subject_minute_usage enable row level security;

create or replace function public.consume_safety_reviewer_subject_quota(
  p_subject_key text,
  p_limit_per_minute integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_started_at timestamptz := date_trunc('minute', v_now);
  v_count integer;
begin
  if length(p_subject_key) <> 64 or p_subject_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Safety Reviewer subject key must be a SHA-256 hex digest.';
  end if;
  if p_limit_per_minute <= 0 then
    raise exception 'Safety Reviewer per-subject rate limit must be positive.';
  end if;

  perform pg_advisory_xact_lock(hashtext('safety_reviewer_subject:' || p_subject_key || ':' || v_window_started_at::text));
  insert into public.safety_reviewer_subject_minute_usage (subject_key, window_started_at, request_count)
  values (p_subject_key, v_window_started_at, 1)
  on conflict (subject_key, window_started_at)
  do update set request_count = public.safety_reviewer_subject_minute_usage.request_count + 1
  returning request_count into v_count;

  if v_count > p_limit_per_minute then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'safety_reviewer_subject_rate_limit',
      'retry_after_seconds', greatest(1, ceil(extract(epoch from ((v_window_started_at + interval '1 minute') - v_now)))::integer)
    );
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

revoke all on table public.safety_reviewer_subject_minute_usage from public, anon, authenticated;
revoke all on function public.consume_safety_reviewer_subject_quota(text, integer) from public, anon, authenticated;
grant execute on function public.consume_safety_reviewer_subject_quota(text, integer) to service_role;
