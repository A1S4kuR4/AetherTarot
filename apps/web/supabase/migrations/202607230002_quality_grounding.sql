alter table public.reading_feedback
  add column if not exists replay_consent boolean not null default false,
  add column if not exists consent_version text null;

comment on column public.reading_feedback.replay_consent is
  'Explicit opt-in for anonymized local quality-evaluation replay export.';
comment on column public.reading_feedback.consent_version is
  'Version of the consent copy accepted by the user; null when not consented.';

update public.reading_feedback
set replay_consent = false,
    consent_version = null
where replay_consent is distinct from true;
