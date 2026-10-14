create or replace function public.increment_forum_topic_reply_count()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.forum_topics set reply_count = reply_count + 1, updated_at = now() where id = new.topic_id;
  return new;
end;
$$;
drop trigger if exists forum_reply_count_increment on public.forum_replies;
create trigger forum_reply_count_increment after insert on public.forum_replies
for each row execute function public.increment_forum_topic_reply_count();
revoke all on function public.increment_forum_topic_reply_count() from public, anon, authenticated;