-- Run this in Supabase SQL Editor AFTER abdel@morotto.com has signed up.
-- This grants the protected superadmin role only to the specified auth account.
insert into public.user_roles (user_id, role)
select id, 'superadmin'
from auth.users
where lower(email) = lower('abdel@morotto.com')
on conflict (user_id, role) do nothing;

-- Verify the role assignment:
select u.email, r.role
from auth.users as u
join public.user_roles as r on r.user_id = u.id
where lower(u.email) = lower('abdel@morotto.com');
