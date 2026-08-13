-- One-time cleanup for continuity values written before snapshot sanitization.
-- Prepared for a future controlled migration; this repository change does not
-- execute it against any environment.

update public.reading_initial_snapshots
set continuity_context = null
where continuity_context is not null;
