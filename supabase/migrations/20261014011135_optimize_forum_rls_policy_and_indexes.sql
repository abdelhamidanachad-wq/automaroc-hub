create index if not exists knowledge_base_author_id_idx on public.knowledge_base(author_id);

-- Use a composite topic/time index and remove the redundant topic-only index.
drop index if exists public.forum_replies_topic_idx;

drop policy if exists "Members create own forum topics" on public.forum_topics;
create policy "Members create own forum topics"
on public.forum_topics for insert to authenticated
with check ((select auth.uid()) = author_id);

drop policy if exists "Authors update own forum topics" on public.forum_topics;
create policy "Authors update own forum topics"
on public.forum_topics for update to authenticated
using ((select auth.uid()) = author_id)
with check ((select auth.uid()) = author_id);

drop policy if exists "Members create own forum replies" on public.forum_replies;
create policy "Members create own forum replies"
on public.forum_replies for insert to authenticated
with check ((select auth.uid()) = author_id);
