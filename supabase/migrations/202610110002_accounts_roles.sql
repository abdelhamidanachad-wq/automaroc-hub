-- MOROTTO account roles, automatic profiles, and admin moderation.
-- Safe to run after the initial schema migration. Never grant roles from client-side metadata.

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('superadmin','moderator')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = required_role
  );
$$;
revoke all on function public.has_role(text) from public;
grant execute on function public.has_role(text) to authenticated;

drop policy if exists "Users can read their own roles" on public.user_roles;
create policy "Users can read their own roles" on public.user_roles
for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_type text;
begin
  chosen_type := coalesce(new.raw_user_meta_data ->> 'account_type', 'individual');
  if chosen_type not in ('individual','dealer','garage','rental_agency') then
    chosen_type := 'individual';
  end if;
  insert into public.profiles (id, display_name, account_type)
  values (new.id, left(new.raw_user_meta_data ->> 'display_name', 80), chosen_type)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_morotto on auth.users;
create trigger on_auth_user_created_morotto
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop policy if exists "Superadmins can view all profiles" on public.profiles;
create policy "Superadmins can view all profiles" on public.profiles
for select to authenticated using ((select public.has_role('superadmin')));

drop policy if exists "Superadmins can view all listings" on public.listings;
create policy "Superadmins can view all listings" on public.listings
for select to authenticated using ((select public.has_role('superadmin')));

drop policy if exists "Superadmins can moderate listings" on public.listings;
create policy "Superadmins can moderate listings" on public.listings
for update to authenticated
using ((select public.has_role('superadmin')))
with check ((select public.has_role('superadmin')));

-- Bootstrap only the named owner, and only if that auth account already exists.
-- If the account is created later, run this statement again in the Supabase SQL Editor:
insert into public.user_roles (user_id, role)
select id, 'superadmin'
from auth.users
where lower(email) = lower('abdel@morotto.com')
on conflict (user_id, role) do nothing;
