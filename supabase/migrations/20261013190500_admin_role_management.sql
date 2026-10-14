create or replace function private.admin_set_user_moderator(target_user uuid, enable_moderator boolean)
returns void
language plpgsql
security definer
set search_path = public, auth, private
as $$
begin
  if (select auth.uid()) is null or not exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='superadmin') then
    raise exception 'Only a superadmin can manage moderator roles';
  end if;
  if target_user is null or target_user=(select auth.uid()) then
    raise exception 'Choose another user account';
  end if;
  if not exists(select 1 from auth.users u where u.id=target_user) then
    raise exception 'User not found';
  end if;
  if enable_moderator then
    insert into public.user_roles(user_id,role) values(target_user,'moderator') on conflict(user_id,role) do nothing;
  else
    delete from public.user_roles where user_id=target_user and role='moderator';
  end if;
end;
$$;
revoke all on function private.admin_set_user_moderator(uuid,boolean) from public, anon;
grant execute on function private.admin_set_user_moderator(uuid,boolean) to authenticated;

create or replace function public.admin_set_user_moderator(target_user uuid, enable_moderator boolean)
returns void
language sql
security invoker
set search_path = public, private
as $$
  select private.admin_set_user_moderator(target_user, enable_moderator);
$$;
revoke all on function public.admin_set_user_moderator(uuid,boolean) from public, anon;
grant execute on function public.admin_set_user_moderator(uuid,boolean) to authenticated;
