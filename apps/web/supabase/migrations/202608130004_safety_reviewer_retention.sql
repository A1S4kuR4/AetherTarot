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

  delete from public.safety_reviewer_token_reservations
  where status = 'settled'
    and settled_at < v_now - interval '7 days';

  delete from public.safety_reviewer_daily_token_usage
  where usage_day < v_usage_day - 7;

  delete from public.safety_reviewer_subject_minute_usage
  where window_started_at < v_counter_cutoff;

  delete from public.usage_counters
  where window_start < v_counter_cutoff;
end;
$$;

revoke all on function public.cleanup_beta_ops_retention() from public, anon, authenticated;
grant execute on function public.cleanup_beta_ops_retention() to service_role;
