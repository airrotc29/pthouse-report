-- 본사 ↔ 사업소장 채팅방 (사업소마다 방 1개)
-- 본사는 모든 방을 보고 쓸 수 있고, 소장은 자기 사업소 방만 보고 쓸 수 있다.
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  site_key    text not null references public.sites(key) on delete cascade,
  sender_role text not null check (sender_role in ('hq', 'manager')),
  sender_name text,
  sender_id   uuid default auth.uid() references auth.users(id) on delete set null,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_site_idx on public.chat_messages (site_key, created_at);
alter table public.chat_messages enable row level security;

drop policy if exists "chat read" on public.chat_messages;
drop policy if exists "chat send" on public.chat_messages;
drop policy if exists "chat hq delete" on public.chat_messages;
create policy "chat read" on public.chat_messages for select to authenticated
  using (public.is_hq() or site_key = public.auth_site());
create policy "chat send" on public.chat_messages for insert to authenticated
  with check (sender_id = auth.uid() and ((public.is_hq() and sender_role = 'hq') or (site_key = public.auth_site() and sender_role = 'manager')));
create policy "chat hq delete" on public.chat_messages for delete to authenticated using (public.is_hq());

-- 실시간 반영 (이미 등록돼 있으면 무시)
do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- 사진 보내기 (채팅에 사진 한 장 첨부, 앱에서 줄인 JPEG 를 data URL 로 보관)
alter table public.chat_messages add column if not exists photo text check (photo is null or char_length(photo) <= 400000);
