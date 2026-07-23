-- Durable Reading runtime state: thread memory, server-owned initial snapshots,
-- request execution claims, and privacy-preserving traces.

alter table public.stored_readings
  add column if not exists thread_id text;

alter table public.reading_events
  add column if not exists agent_trace jsonb,
  add column if not exists agent_trace_schema_version integer;

create table if not exists public.reading_thread_memories (
  user_id uuid not null references public.app_users(id) on delete cascade,
  thread_id text not null,
  memory jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

create index if not exists reading_thread_memories_updated_at_idx
  on public.reading_thread_memories(updated_at);

alter table public.reading_thread_memories enable row level security;

drop policy if exists reading_thread_memories_service_role_all
  on public.reading_thread_memories;
create policy reading_thread_memories_service_role_all
  on public.reading_thread_memories
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.merge_reading_thread_memory(
  p_user_id uuid,
  p_thread_id text,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_existing jsonb := '{}'::jsonb;
  v_topics jsonb := '[]'::jsonb;
  v_cards jsonb := '[]'::jsonb;
  v_constraints jsonb := '[]'::jsonb;
  v_open_questions jsonb := '[]'::jsonb;
  v_memory jsonb;
  v_version integer := 1;
begin
  if p_user_id is null or length(trim(coalesce(p_thread_id, ''))) = 0 then
    raise exception 'Thread memory requires user and thread scope.';
  end if;

  insert into public.reading_thread_memories (
    user_id,
    thread_id,
    memory,
    version,
    created_at,
    updated_at
  )
  values (p_user_id, p_thread_id, '{}'::jsonb, 0, v_now, v_now)
  on conflict (user_id, thread_id) do nothing;

  select memory, version
  into v_existing, v_version
  from public.reading_thread_memories
  where user_id = p_user_id
    and thread_id = p_thread_id
  for update;

  select coalesce(jsonb_agg(value order by first_seen), '[]'::jsonb)
  into v_topics
  from (
    select value, min(ordinality) as first_seen
    from jsonb_array_elements_text(
      coalesce(v_existing -> 'topics', '[]'::jsonb)
      || coalesce(p_patch -> 'topics', '[]'::jsonb)
    ) with ordinality as items(value, ordinality)
    where length(trim(value)) > 0
    group by value
    order by min(ordinality) desc
    limit 12
  ) limited_topics;

  select coalesce(jsonb_agg(card order by first_seen), '[]'::jsonb)
  into v_cards
  from (
    select card, first_seen
    from (
      select distinct on (
        card ->> 'id',
        coalesce(card ->> 'orientation', 'unknown')
      )
        card,
        ordinality as first_seen
      from jsonb_array_elements(
        coalesce(v_existing -> 'cards', '[]'::jsonb)
        || coalesce(p_patch -> 'cards', '[]'::jsonb)
      ) with ordinality as items(card, ordinality)
      where length(trim(coalesce(card ->> 'id', ''))) > 0
      order by
        card ->> 'id',
        coalesce(card ->> 'orientation', 'unknown'),
        ordinality desc
    ) deduplicated_cards
    order by first_seen desc
    limit 20
  ) limited_cards;

  select coalesce(jsonb_agg(value order by first_seen), '[]'::jsonb)
  into v_constraints
  from (
    select value, min(ordinality) as first_seen
    from jsonb_array_elements_text(
      coalesce(v_existing -> 'stated_constraints', '[]'::jsonb)
      || coalesce(p_patch -> 'stated_constraints', '[]'::jsonb)
    ) with ordinality as items(value, ordinality)
    where length(trim(value)) > 0
    group by value
    order by min(ordinality) desc
    limit 8
  ) limited_constraints;

  v_open_questions := case
    when p_patch ? 'open_questions'
      then coalesce(p_patch -> 'open_questions', '[]'::jsonb)
    else coalesce(v_existing -> 'open_questions', '[]'::jsonb)
  end;

  v_memory := jsonb_strip_nulls(jsonb_build_object(
    'thread_id', p_thread_id,
    'summary', case
      when p_patch ? 'summary' then p_patch -> 'summary'
      else v_existing -> 'summary'
    end,
    'topics', v_topics,
    'cards', v_cards,
    'stated_constraints', v_constraints,
    'open_questions', v_open_questions,
    'last_advice_summary', case
      when p_patch ? 'last_advice_summary' then p_patch -> 'last_advice_summary'
      else v_existing -> 'last_advice_summary'
    end,
    'updated_at', to_jsonb(v_now)
  ));

  update public.reading_thread_memories
  set
    memory = v_memory,
    version = v_version + 1,
    updated_at = v_now
  where user_id = p_user_id
    and thread_id = p_thread_id;

  return jsonb_build_object(
    'memory', v_memory,
    'version', v_version + 1
  );
end;
$$;

revoke all on function public.merge_reading_thread_memory(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.merge_reading_thread_memory(uuid, text, jsonb)
  to service_role;

create table if not exists public.reading_initial_snapshots (
  id uuid primary key default gen_random_uuid(),
  subject_key text not null,
  initial_reading_id text not null,
  request_id uuid not null,
  question text not null,
  spread_id text not null,
  drawn_cards jsonb not null,
  profile jsonb not null,
  draw_source text not null,
  thread_id text,
  continuity_context text,
  initial_reading jsonb not null,
  follow_up_questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  claim_request_id uuid,
  claim_expires_at timestamptz,
  unique (subject_key, initial_reading_id)
);

create index if not exists reading_initial_snapshots_expires_at_idx
  on public.reading_initial_snapshots(expires_at);

alter table public.reading_initial_snapshots enable row level security;

drop policy if exists reading_initial_snapshots_service_role_all
  on public.reading_initial_snapshots;
create policy reading_initial_snapshots_service_role_all
  on public.reading_initial_snapshots
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.claim_reading_initial_snapshot(
  p_subject_key text,
  p_initial_reading_id text,
  p_request_id uuid,
  p_lease_seconds integer default 180
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_snapshot public.reading_initial_snapshots%rowtype;
begin
  select *
  into v_snapshot
  from public.reading_initial_snapshots
  where subject_key = p_subject_key
    and initial_reading_id = p_initial_reading_id
  for update;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  if v_snapshot.expires_at <= v_now then
    delete from public.reading_initial_snapshots where id = v_snapshot.id;
    return jsonb_build_object('status', 'expired');
  end if;

  if v_snapshot.claim_request_id is not null
    and v_snapshot.claim_request_id <> p_request_id
    and v_snapshot.claim_expires_at > v_now then
    return jsonb_build_object('status', 'busy');
  end if;

  update public.reading_initial_snapshots
  set
    claim_request_id = p_request_id,
    claim_expires_at = v_now + make_interval(secs => p_lease_seconds)
  where id = v_snapshot.id
  returning * into v_snapshot;

  return jsonb_build_object(
    'status', 'claimed',
    'snapshot', to_jsonb(v_snapshot)
  );
end;
$$;

create or replace function public.release_reading_initial_snapshot(
  p_subject_key text,
  p_initial_reading_id text,
  p_request_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.reading_initial_snapshots
  set claim_request_id = null, claim_expires_at = null
  where subject_key = p_subject_key
    and initial_reading_id = p_initial_reading_id
    and claim_request_id = p_request_id
  returning true;
$$;

create or replace function public.consume_reading_initial_snapshot(
  p_subject_key text,
  p_initial_reading_id text,
  p_request_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  delete from public.reading_initial_snapshots
  where subject_key = p_subject_key
    and initial_reading_id = p_initial_reading_id
    and claim_request_id = p_request_id
  returning true;
$$;

revoke all on function public.claim_reading_initial_snapshot(text, text, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.release_reading_initial_snapshot(text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.consume_reading_initial_snapshot(text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_reading_initial_snapshot(text, text, uuid, integer)
  to service_role;
grant execute on function public.release_reading_initial_snapshot(text, text, uuid)
  to service_role;
grant execute on function public.consume_reading_initial_snapshot(text, text, uuid)
  to service_role;

create table if not exists public.reading_request_executions (
  subject_key text not null,
  request_id uuid not null,
  payload_hash text not null,
  status text not null check (status in ('processing', 'succeeded')),
  lease_owner uuid not null,
  lease_expires_at timestamptz not null,
  response_status integer,
  response_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (subject_key, request_id)
);

create index if not exists reading_request_executions_expires_at_idx
  on public.reading_request_executions(expires_at);

alter table public.reading_request_executions enable row level security;

drop policy if exists reading_request_executions_service_role_all
  on public.reading_request_executions;
create policy reading_request_executions_service_role_all
  on public.reading_request_executions
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.claim_reading_request_execution(
  p_subject_key text,
  p_request_id uuid,
  p_payload_hash text,
  p_lease_owner uuid,
  p_lease_seconds integer default 180
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_expires_at timestamptz :=
    ((timezone('Asia/Shanghai', now())::date + 1)::timestamp
      at time zone 'Asia/Shanghai');
  v_execution public.reading_request_executions%rowtype;
begin
  perform pg_advisory_xact_lock(
    hashtext(p_subject_key || ':' || p_request_id::text)
  );

  select *
  into v_execution
  from public.reading_request_executions
  where subject_key = p_subject_key
    and request_id = p_request_id
  for update;

  if found and v_execution.payload_hash <> p_payload_hash then
    return jsonb_build_object('status', 'conflict');
  end if;

  if found
    and v_execution.status = 'succeeded'
    and v_execution.expires_at > v_now then
    return jsonb_build_object(
      'status', 'replay',
      'response_status', v_execution.response_status,
      'response_payload', v_execution.response_payload
    );
  end if;

  if found
    and v_execution.status = 'processing'
    and v_execution.lease_expires_at > v_now then
    return jsonb_build_object('status', 'wait');
  end if;

  insert into public.reading_request_executions (
    subject_key,
    request_id,
    payload_hash,
    status,
    lease_owner,
    lease_expires_at,
    created_at,
    updated_at,
    expires_at
  )
  values (
    p_subject_key,
    p_request_id,
    p_payload_hash,
    'processing',
    p_lease_owner,
    v_now + make_interval(secs => p_lease_seconds),
    v_now,
    v_now,
    v_expires_at
  )
  on conflict (subject_key, request_id) do update
  set
    payload_hash = excluded.payload_hash,
    status = 'processing',
    lease_owner = excluded.lease_owner,
    lease_expires_at = excluded.lease_expires_at,
    response_status = null,
    response_payload = null,
    updated_at = v_now,
    expires_at = excluded.expires_at;

  return jsonb_build_object('status', 'owner');
end;
$$;

create or replace function public.complete_reading_request_execution(
  p_subject_key text,
  p_request_id uuid,
  p_lease_owner uuid,
  p_response_status integer,
  p_response_payload jsonb
)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.reading_request_executions
  set
    status = 'succeeded',
    response_status = p_response_status,
    response_payload = p_response_payload,
    updated_at = now(),
    expires_at = (
      (timezone('Asia/Shanghai', now())::date + 1)::timestamp
        at time zone 'Asia/Shanghai'
    )
  where subject_key = p_subject_key
    and request_id = p_request_id
    and status = 'processing'
    and lease_owner = p_lease_owner
  returning true;
$$;

create or replace function public.release_reading_request_execution(
  p_subject_key text,
  p_request_id uuid,
  p_lease_owner uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  delete from public.reading_request_executions
  where subject_key = p_subject_key
    and request_id = p_request_id
    and status = 'processing'
    and lease_owner = p_lease_owner
  returning true;
$$;

revoke all on function public.claim_reading_request_execution(text, uuid, text, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.complete_reading_request_execution(text, uuid, uuid, integer, jsonb)
  from public, anon, authenticated;
revoke all on function public.release_reading_request_execution(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_reading_request_execution(text, uuid, text, uuid, integer)
  to service_role;
grant execute on function public.complete_reading_request_execution(text, uuid, uuid, integer, jsonb)
  to service_role;
grant execute on function public.release_reading_request_execution(text, uuid, uuid)
  to service_role;

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
