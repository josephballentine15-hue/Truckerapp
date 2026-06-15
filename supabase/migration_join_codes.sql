-- Migration: add company join codes
-- Run this in the Supabase SQL Editor after the initial schema.

-- 1. Function to generate a 6-char uppercase code
create or replace function public.gen_join_code()
returns text language sql volatile as $$
  select upper(substring(md5(random()::text) for 6));
$$;

-- 2. Add the join_code column (nullable first so we can backfill)
alter table public.companies add column if not exists join_code text unique;

-- 3. Backfill any existing companies
update public.companies set join_code = public.gen_join_code() where join_code is null;

-- 4. Default + not-null for future inserts
alter table public.companies alter column join_code set default public.gen_join_code();
alter table public.companies alter column join_code set not null;

-- 5. Public RPC so a driver can resolve a code -> company id BEFORE creating
--    their account, without exposing the whole companies table to anon.
create or replace function public.join_company_id(code text)
returns uuid language sql security definer set search_path = public stable as $$
  select id from public.companies where join_code = upper(code);
$$;

grant execute on function public.join_company_id(text) to anon, authenticated;
