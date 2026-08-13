create table if not exists public.safety_reviewer_daily_token_usage (
  usage_day date primary key,
  consumed_tokens bigint not null default 0 check (consumed_tokens >= 0),
  outstanding_reserved_tokens bigint not null default 0 check (outstanding_reserved_tokens >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.safety_reviewer_token_reservations (
  id uuid primary key default gen_random_uuid(),
  usage_day date not null,
  source text not null check (source in ('safety_input', 'safety_output')),
  reserved_tokens integer not null check (reserved_tokens > 0),
  settled_tokens integer check (settled_tokens >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'settled')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists safety_reviewer_token_reservations_usage_day_idx
  on public.safety_reviewer_token_reservations (usage_day, status);

alter table public.safety_reviewer_daily_token_usage enable row level security;
alter table public.safety_reviewer_token_reservations enable row level security;

create or replace function public.reserve_daily_safety_reviewer_tokens(
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
  v_usage public.safety_reviewer_daily_token_usage%rowtype;
  v_reservation_id uuid;
begin
  if p_source not in ('safety_input', 'safety_output') then
    raise exception 'Unsupported Safety Reviewer token source: %', p_source;
  end if;
  if p_requested_tokens <= 0 or p_daily_limit <= 0 then
    raise exception 'Token limits must be positive.';
  end if;

  perform pg_advisory_xact_lock(hashtext('safety_reviewer_daily_tokens:' || v_usage_day::text));
  insert into public.safety_reviewer_daily_token_usage (usage_day)
  values (v_usage_day)
  on conflict (usage_day) do nothing;
  select * into v_usage
  from public.safety_reviewer_daily_token_usage
  where usage_day = v_usage_day
  for update;

  if v_usage.consumed_tokens + v_usage.outstanding_reserved_tokens + p_requested_tokens > p_daily_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'safety_reviewer_daily_tokens',
      'retry_after_seconds', v_retry_after_seconds
    );
  end if;

  insert into public.safety_reviewer_token_reservations (usage_day, source, reserved_tokens)
  values (v_usage_day, p_source, p_requested_tokens)
  returning id into v_reservation_id;
  update public.safety_reviewer_daily_token_usage
  set outstanding_reserved_tokens = outstanding_reserved_tokens + p_requested_tokens,
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

create or replace function public.settle_daily_safety_reviewer_tokens(
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
  v_reservation public.safety_reviewer_token_reservations%rowtype;
  v_settled_tokens integer;
begin
  select * into v_reservation
  from public.safety_reviewer_token_reservations
  where id = p_reservation_id
  for update;
  if not found then
    raise exception 'Unknown Safety Reviewer token reservation.';
  end if;
  if v_reservation.status = 'settled' then
    return jsonb_build_object('settled', true, 'idempotent', true);
  end if;

  v_settled_tokens := greatest(0, least(p_actual_tokens, v_reservation.reserved_tokens));
  update public.safety_reviewer_token_reservations
  set settled_tokens = v_settled_tokens,
      status = 'settled',
      settled_at = v_now
  where id = p_reservation_id;
  update public.safety_reviewer_daily_token_usage
  set outstanding_reserved_tokens = greatest(0, outstanding_reserved_tokens - v_reservation.reserved_tokens),
      consumed_tokens = consumed_tokens + v_settled_tokens,
      updated_at = v_now
  where usage_day = v_reservation.usage_day;

  return jsonb_build_object('settled', true, 'actual_tokens', v_settled_tokens);
end;
$$;

revoke all on table public.safety_reviewer_daily_token_usage from public, anon, authenticated;
revoke all on table public.safety_reviewer_token_reservations from public, anon, authenticated;
revoke all on function public.reserve_daily_safety_reviewer_tokens(text, integer, integer) from public, anon, authenticated;
revoke all on function public.settle_daily_safety_reviewer_tokens(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_daily_safety_reviewer_tokens(text, integer, integer) to service_role;
grant execute on function public.settle_daily_safety_reviewer_tokens(uuid, integer) to service_role;
