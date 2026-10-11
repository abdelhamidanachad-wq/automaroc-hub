-- Social providers commonly populate full_name/name instead of display_name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_type text;
  chosen_name text;
begin
  chosen_type := coalesce(new.raw_user_meta_data ->> 'account_type', 'individual');
  if chosen_type not in ('individual','dealer','garage','rental_agency') then chosen_type := 'individual'; end if;
  chosen_name := coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name');
  insert into public.profiles (id, display_name, account_type)
  values (new.id, left(chosen_name, 80), chosen_type)
  on conflict (id) do nothing;
  return new;
end;
$$;
