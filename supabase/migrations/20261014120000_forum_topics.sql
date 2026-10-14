create table if not exists public.forum_topics (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_label text,
  title text not null check (char_length(title) between 8 and 140),
  body text not null check (char_length(body) between 12 and 10000),
  category text not null default 'conseils' check (category in ('achat','mecanique','assurance','moto','conseils')),
  reply_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_label text,
  body text not null check (char_length(body) between 2 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists forum_topics_created_at_idx on public.forum_topics(created_at desc);
create index if not exists forum_topics_category_idx on public.forum_topics(category, created_at desc);
create index if not exists forum_replies_topic_idx on public.forum_replies(topic_id, created_at asc);
alter table public.forum_topics enable row level security;
alter table public.forum_replies enable row level security;
drop policy if exists "Forum topics are readable" on public.forum_topics;
create policy "Forum topics are readable" on public.forum_topics for select to anon, authenticated using (true);
drop policy if exists "Members create own forum topics" on public.forum_topics;
create policy "Members create own forum topics" on public.forum_topics for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists "Authors update own forum topics" on public.forum_topics;
create policy "Authors update own forum topics" on public.forum_topics for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
drop policy if exists "Forum replies are readable" on public.forum_replies;
create policy "Forum replies are readable" on public.forum_replies for select to anon, authenticated using (true);
drop policy if exists "Members create own forum replies" on public.forum_replies;
create policy "Members create own forum replies" on public.forum_replies for insert to authenticated with check (auth.uid() = author_id);
grant select on public.forum_topics, public.forum_replies to anon, authenticated;
grant insert, update on public.forum_topics to authenticated;
grant insert on public.forum_replies to authenticated;
