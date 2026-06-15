-- Generate a 6-char uppercase join code
create or replace function public.gen_join_code()
returns text language sql volatile as $$
  select upper(substring(md5(random()::text) for 6));
$$;

-- Companies table
create table public.companies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  join_code text unique not null default public.gen_join_code(),
  created_at timestamptz default now()
);

-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('driver', 'admin')),
  company_id uuid references public.companies(id),
  created_at timestamptz default now()
);

-- Shipments table
create table public.shipments (
  id uuid default gen_random_uuid() primary key,
  driver_id uuid references public.profiles(id) on delete cascade not null,
  company_id uuid references public.companies(id) not null,
  cargo_description text not null,
  origin text not null,
  destination text not null,
  start_time timestamptz not null,
  end_time timestamptz,
  duration_minutes integer,
  notes text,
  created_at timestamptz default now()
);

-- Helper functions (SECURITY DEFINER bypasses RLS to avoid recursive policy
-- evaluation when a policy on `profiles` needs to read from `profiles`).
create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_company()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

-- Resolve a join code -> company id (callable before a driver has a profile).
create or replace function public.join_company_id(code text)
returns uuid language sql security definer set search_path = public stable as $$
  select id from public.companies where join_code = upper(code);
$$;

grant execute on function public.join_company_id(text) to anon, authenticated;

-- Row-level security
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.shipments enable row level security;

-- Companies: any authenticated user can read; anyone can create one at signup
create policy "companies_read" on public.companies
  for select using (auth.role() = 'authenticated');

create policy "companies_insert" on public.companies
  for insert with check (auth.role() = 'authenticated');

-- Profiles: users can read their own; admins can read all in their company
create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_admin_read" on public.profiles
  for select using (
    public.current_role() = 'admin'
    and company_id = public.current_company()
  );

create policy "profiles_self_insert" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);

-- Shipments: drivers can CRUD their own; admins can read all in their company
create policy "shipments_driver_all" on public.shipments
  for all using (driver_id = auth.uid());

create policy "shipments_admin_read" on public.shipments
  for select using (
    public.current_role() = 'admin'
    and company_id = public.current_company()
  );
