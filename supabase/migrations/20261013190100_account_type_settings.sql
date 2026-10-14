-- MOROTTO account-type settings and guarded account-type management.
alter table public.profiles add column if not exists account_type text not null default 'individual';

create table if not exists public.account_type_settings (
  account_type text primary key,
  label text not null,
  description text not null default '',
  enabled boolean not null default true,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);
alter table public.account_type_settings enable row level security;
drop policy if exists "Anyone can read enabled account types" on public.account_type_settings;
create policy "Anyone can read enabled account types" on public.account_type_settings for select to anon, authenticated using (enabled or exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='superadmin'));
drop policy if exists "Superadmins manage account type settings" on public.account_type_settings;
create policy "Superadmins manage account type settings" on public.account_type_settings for all to authenticated using (exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='superadmin')) with check (exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='superadmin'));

insert into public.account_type_settings(account_type,label,description,enabled,sort_order) values
('individual','Particulier','Favoris, annonces personnelles et messagerie.',true,10),
('dealer','Concessionnaire / vendeur','Vitrine, véhicules et modération.',true,20),
('rental_agency','Agence de location','Flotte, tarifs et demandes de réservation.',true,30),
('partner','Partenaire','Offres partenaires et visibilité professionnelle.',true,40),
('garage','Garage','Services, devis et entretien.',true,50),
('mechanic','Mécanicien','Profil professionnel et prestations.',true,60),
('service_provider','Prestataire de services','Entretien, diagnostic et rendez-vous.',true,70),
('insurance_agency','Agence d’assurance','Offres d’assurance et demandes de devis.',true,80),
('parts_seller','Vendeur de pièces','Catalogue, compatibilité et demandes de devis.',true,90)
on conflict(account_type) do update set label=excluded.label,description=excluded.description,sort_order=excluded.sort_order;

create or replace function public.admin_set_account_type(target_user uuid, next_type text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='superadmin') then
    raise exception 'Only a superadmin can change account types';
  end if;
  if not exists(select 1 from public.account_type_settings s where s.account_type=next_type) then
    raise exception 'Unknown account type';
  end if;
  update public.profiles set account_type=next_type where id=target_user;
  update auth.users set raw_user_meta_data=jsonb_set(coalesce(raw_user_meta_data,'{}'::jsonb),'{account_type}',to_jsonb(next_type),true) where id=target_user;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;
revoke all on function public.admin_set_account_type(uuid,text) from public;
grant execute on function public.admin_set_account_type(uuid,text) to authenticated;
