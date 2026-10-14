-- Keep the privileged implementation outside the exposed API schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.admin_set_account_type(target_user uuid, next_type text)
returns void
language plpgsql
security definer
set search_path = public, auth, private
as $$
begin
  if (select auth.uid()) is null or not exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='superadmin') then
    raise exception 'Only a superadmin can change account types';
  end if;
  if not exists(select 1 from public.account_type_settings s where s.account_type=next_type) then
    raise exception 'Unknown account type';
  end if;
  update public.profiles set account_type=next_type where id=target_user;
  if not found then
    raise exception 'Profile not found';
  end if;
  update auth.users set raw_user_meta_data=jsonb_set(coalesce(raw_user_meta_data,'{}'::jsonb),'{account_type}',to_jsonb(next_type),true) where id=target_user;
end;
$$;
revoke all on function private.admin_set_account_type(uuid,text) from public, anon;
grant execute on function private.admin_set_account_type(uuid,text) to authenticated;

drop function if exists public.admin_set_account_type(uuid,text);
create function public.admin_set_account_type(target_user uuid, next_type text)
returns void
language sql
security invoker
set search_path = public, private
as $$
  select private.admin_set_account_type(target_user, next_type);
$$;
revoke all on function public.admin_set_account_type(uuid,text) from public, anon;
grant execute on function public.admin_set_account_type(uuid,text) to authenticated;

drop policy if exists "Users can send seller messages as themselves" on public.seller_messages;
create policy "Users can send seller messages as themselves" on public.seller_messages for insert to authenticated with check (sender_id=(select auth.uid()));
drop policy if exists "Senders and recipients can read seller messages" on public.seller_messages;
create policy "Senders and recipients can read seller messages" on public.seller_messages for select to authenticated using (sender_id=(select auth.uid()) or recipient_profile_id=(select auth.uid()));
drop policy if exists "Recipients can update message status" on public.seller_messages;
create policy "Recipients can update message status" on public.seller_messages for update to authenticated using (recipient_profile_id=(select auth.uid())) with check (recipient_profile_id=(select auth.uid()));

drop policy if exists "Users can request rentals for themselves" on public.rental_bookings;
create policy "Users can request rentals for themselves" on public.rental_bookings for insert to authenticated with check (requester_id=(select auth.uid()));
drop policy if exists "Requesters and assigned agencies can read bookings" on public.rental_bookings;
create policy "Requesters and assigned agencies can read bookings" on public.rental_bookings for select to authenticated using (requester_id=(select auth.uid()) or agency_id=(select auth.uid()));
drop policy if exists "Assigned agencies can update bookings" on public.rental_bookings;
create policy "Assigned agencies can update bookings" on public.rental_bookings for update to authenticated using (agency_id=(select auth.uid())) with check (agency_id=(select auth.uid()));

drop policy if exists "Anyone can read enabled account types" on public.account_type_settings;
create policy "Anyone can read enabled account types" on public.account_type_settings for select to anon, authenticated using (enabled or exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='superadmin'));
drop policy if exists "Superadmins manage account type settings" on public.account_type_settings;
create policy "Superadmins manage account type settings" on public.account_type_settings for all to authenticated using (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='superadmin')) with check (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='superadmin'));

drop policy if exists "Superadmins can review rental bookings" on public.rental_bookings;
create policy "Superadmins can review rental bookings" on public.rental_bookings for select to authenticated using (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='superadmin'));
drop policy if exists "Superadmins can update rental bookings" on public.rental_bookings;
create policy "Superadmins can update rental bookings" on public.rental_bookings for update to authenticated using (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='superadmin')) with check (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='superadmin'));
