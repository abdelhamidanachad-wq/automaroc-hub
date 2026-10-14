create table if not exists public.demo_test_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  account_type text not null check (account_type in ('individual','dealer','garage','rental_agency','mechanic','parts_seller','partner','service_provider')),
  city text not null default 'Casablanca',
  purpose text not null,
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.demo_test_accounts
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists provisioned_at timestamptz;

alter table public.demo_test_accounts enable row level security;
revoke all on public.demo_test_accounts from anon, authenticated;
grant select on public.demo_test_accounts to authenticated;

drop policy if exists "Superadmins can read demo test account catalog" on public.demo_test_accounts;
create policy "Superadmins can read demo test account catalog"
on public.demo_test_accounts for select to authenticated
using (public.has_role('superadmin'));

insert into public.demo_test_accounts(email, display_name, account_type, city, purpose)
values
 ('demo.individual@morotto.ma','Yassine El Amrani','individual','Casablanca','Browse vehicles, save searches and try community features'),
 ('demo.seller@morotto.ma','Salma Auto Occasion','dealer','Casablanca','Create and manage vehicle listings'),
 ('demo.location@morotto.ma','Atlas Location Auto','rental_agency','Rabat','Test rental agency profile and rental workflows'),
 ('demo.garage@morotto.ma','Garage Atlas Services','garage','Casablanca','Test garage directory and provider profile'),
 ('demo.mechanic@morotto.ma','Mehdi Mécanique','mechanic','Marrakech','Test mechanic directory and service profile'),
 ('demo.parts@morotto.ma','Pièces Auto Medina','parts_seller','Tangier','Test spare-parts seller profile'),
 ('demo.partner@morotto.ma','MOROTTO Partenaire Démo','partner','Casablanca','Test partner/service-provider entry points')
on conflict (email) do update
set display_name=excluded.display_name, account_type=excluded.account_type, city=excluded.city, purpose=excluded.purpose;
