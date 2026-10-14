-- MOROTTO marketplace expansion: private seller messages and rental booking requests.
create table if not exists public.seller_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_profile_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default 'Demande via MOROTTO',
  body text not null check (char_length(body) between 1 and 5000),
  status text not null default 'sent' check (status in ('sent','read','archived')),
  created_at timestamptz not null default now(),
  constraint seller_message_not_self check (sender_id <> recipient_profile_id)
);
create index if not exists seller_messages_sender_created_idx on public.seller_messages(sender_id, created_at desc);
create index if not exists seller_messages_recipient_created_idx on public.seller_messages(recipient_profile_id, created_at desc);
alter table public.seller_messages enable row level security;
drop policy if exists "Users can send seller messages as themselves" on public.seller_messages;
create policy "Users can send seller messages as themselves" on public.seller_messages for insert to authenticated with check (sender_id = auth.uid());
drop policy if exists "Senders and recipients can read seller messages" on public.seller_messages;
create policy "Senders and recipients can read seller messages" on public.seller_messages for select to authenticated using (sender_id = auth.uid() or recipient_profile_id = auth.uid());
drop policy if exists "Recipients can update message status" on public.seller_messages;
create policy "Recipients can update message status" on public.seller_messages for update to authenticated using (recipient_profile_id = auth.uid()) with check (recipient_profile_id = auth.uid());

create table if not exists public.rental_bookings (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  agency_id uuid references auth.users(id) on delete set null,
  city text not null,
  category text not null check (category in ('Cars','Motos','Scooters','Trucks')),
  pickup_date date not null,
  return_date date not null,
  contact_name text not null check (char_length(contact_name) between 1 and 120),
  contact_phone text not null check (char_length(contact_phone) between 5 and 40),
  notes text not null default '' check (char_length(notes) <= 2000),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  constraint rental_booking_dates_valid check (return_date > pickup_date)
);
create index if not exists rental_bookings_requester_created_idx on public.rental_bookings(requester_id, created_at desc);
create index if not exists rental_bookings_agency_created_idx on public.rental_bookings(agency_id, created_at desc);
alter table public.rental_bookings enable row level security;
drop policy if exists "Users can request rentals for themselves" on public.rental_bookings;
create policy "Users can request rentals for themselves" on public.rental_bookings for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists "Requesters and assigned agencies can read bookings" on public.rental_bookings;
create policy "Requesters and assigned agencies can read bookings" on public.rental_bookings for select to authenticated using (requester_id = auth.uid() or agency_id = auth.uid());
drop policy if exists "Assigned agencies can update bookings" on public.rental_bookings;
create policy "Assigned agencies can update bookings" on public.rental_bookings for update to authenticated using (agency_id = auth.uid()) with check (agency_id = auth.uid());

 grant select, insert, update on public.seller_messages to authenticated;
 grant select, insert, update on public.rental_bookings to authenticated;
