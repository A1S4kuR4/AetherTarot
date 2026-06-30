-- Harden stored_readings idempotency for account-level reading replay.

with ranked_stored_readings as (
  select
    id,
    row_number() over (
      partition by user_id, reading_id
      order by created_at desc, id desc
    ) as duplicate_rank
  from public.stored_readings
)
delete from public.stored_readings stored_readings
using ranked_stored_readings
where stored_readings.id = ranked_stored_readings.id
  and ranked_stored_readings.duplicate_rank > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stored_readings_user_id_reading_id_key'
  ) then
    alter table public.stored_readings
      add constraint stored_readings_user_id_reading_id_key unique (user_id, reading_id);
  end if;
end $$;
