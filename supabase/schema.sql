-- MarCo database setup. Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- Safe to run more than once.
--
-- Each company (brand) is stored as one JSON document holding its facts, audits,
-- answers, findings, actions and drafts, in exactly the shapes defined in lib/types.ts.
-- A small index table finds the right company from an audit, action or issue id.

create table if not exists public.marco_brands (
  brand_id   text primary key,
  data       jsonb not null,
  version    integer not null default 1,          -- optimistic locking: concurrent saves never overwrite each other
  updated_at timestamptz not null default now()
);

create table if not exists public.marco_index (
  key      text primary key,                     -- e.g. "audit:<id>", "action:<id>", "issue:<id>", "sample"
  brand_id text not null references public.marco_brands (brand_id) on delete cascade
);

create index if not exists marco_index_brand_id on public.marco_index (brand_id);

-- Row level security ON with no policies: the public (anon) key can read or write nothing.
-- Only MarCo's server, using the secret key, can access these tables.
alter table public.marco_brands enable row level security;
alter table public.marco_index  enable row level security;

-- Give MarCo's server role (used by the secret key) access to these two tables only.
-- Newer Supabase projects don't grant this automatically for tables made in the SQL editor.
grant select, insert, update, delete on public.marco_brands to service_role;
grant select, insert, update, delete on public.marco_index  to service_role;
