-- Add password_hash to beta_testers for credentials-based auth
alter table public.beta_testers
  add column if not exists password_hash text;

-- Update app_users CHECK constraint to allow 'credentials' provider
alter table public.app_users
  drop constraint if exists app_users_auth_provider_check;

alter table public.app_users
  add constraint app_users_auth_provider_check
  check (auth_provider in ('keycloak', 'credentials'));
