-- stored_readings: persist reading history per user

create table if not exists public.stored_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  reading_id text not null,
  created_at timestamptz not null default now(),
  spread_id text not null,
  draw_source text,
  drawn_cards jsonb not null default '[]'::jsonb,
  reading jsonb not null,
  user_notes text
);

create index if not exists idx_stored_readings_user_id
  on public.stored_readings(user_id);

create index if not exists idx_stored_readings_reading_id
  on public.stored_readings(reading_id);

alter table public.stored_readings enable row level security;

-- RLS: service_role only (no direct browser access)
create policy stored_readings_service_role_all
  on public.stored_readings
  for all
  to service_role
  using (true)
  with check (true);

-- Add 1-year retention to cleanup function
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

  delete from public.stored_readings
  where created_at < v_now - interval '365 days';

  delete from public.llm_token_reservations
  where status = 'settled'
    and settled_at < v_now - interval '7 days';

  delete from public.llm_daily_token_usage
  where usage_day < v_usage_day - 7;

  delete from public.usage_counters
  where window_start < v_counter_cutoff;
end;
$$;
