-- Superadmin-only review and status updates for rental booking requests.
drop policy if exists "Superadmins can review rental bookings" on public.rental_bookings;
create policy "Superadmins can review rental bookings" on public.rental_bookings for select to authenticated using (exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='superadmin'));
drop policy if exists "Superadmins can update rental bookings" on public.rental_bookings;
create policy "Superadmins can update rental bookings" on public.rental_bookings for update to authenticated using (exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='superadmin')) with check (exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='superadmin'));
