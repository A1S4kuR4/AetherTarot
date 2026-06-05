-- Restrict app_users.auth_provider to 'credentials' only (remove 'keycloak')

-- Convert any residual keycloak rows to credentials before tightening the constraint
update public.app_users
  set auth_provider = 'credentials',
      updated_at = now()
  where auth_provider = 'keycloak';

alter table public.app_users
  drop constraint if exists app_users_auth_provider_check;

alter table public.app_users
  add constraint app_users_auth_provider_check
  check (auth_provider in ('credentials'));
