alter table public.reading_events
  add column if not exists request_id uuid;

create unique index if not exists reading_events_subject_request_id_idx
  on public.reading_events (
    (coalesce(user_id::text, 'anonymous:' || ip_hash)),
    request_id
  )
  where request_id is not null
    and status = 'success';

create or replace function public.refund_reading_daily_quota(
  p_user_id uuid,
  p_ip_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_usage_day date := timezone('Asia/Shanghai', v_now)::date;
  v_subject_key text := coalesce(p_user_id::text, 'anonymous_ip:' || p_ip_hash);
  v_counter_key text := 'reading_user_daily:' || v_subject_key || ':' || v_usage_day::text;
  v_refunded boolean := false;
begin
  if p_ip_hash is null or length(trim(p_ip_hash)) = 0 then
    raise exception 'Reading quota refund requires an IP hash.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_counter_key));

  update public.usage_counters
  set
    count_value = count_value - 1,
    updated_at = v_now
  where counter_key = v_counter_key
    and count_value > 0;

  v_refunded := found;
  return jsonb_build_object('refunded', v_refunded);
end;
$$;

revoke all on function public.refund_reading_daily_quota(uuid, text)
  from public, anon, authenticated;
grant execute on function public.refund_reading_daily_quota(uuid, text)
  to service_role;
