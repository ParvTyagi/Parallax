-- Run once in the Supabase SQL Editor.
create table if not exists public.private_submissions (
  id uuid primary key,
  subtask_id text not null,
  worker text not null,
  content text not null,
  content_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.private_submissions enable row level security;
revoke all on table public.private_submissions from anon, authenticated;
grant usage on schema public to service_role;
grant all on table public.private_submissions to service_role;
