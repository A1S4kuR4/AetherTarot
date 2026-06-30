create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_provider text not null check (auth_provider in ('keycloak')),
  auth_subject text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_provider, auth_subject),
  unique (email)
);

create index if not exists app_users_email_idx
  on public.app_users (lower(email));

alter table public.app_users enable row level security;
