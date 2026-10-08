-- 화상회의 (Jitsi Meet 방 이름을 공유) : 본사가 열고, 대상 사업소 소장이 입장
create table if not exists public.meetings (
  id text primary key,
  room text not null,                       -- Jitsi 방 이름 (추측 불가 난수)
  title text not null,
  site_keys text[],                         -- null = 전체 사업소
  status text not null default 'live' check (status in ('live','ended')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
alter table public.meetings enable row level security;
drop policy if exists "meetings read" on public.meetings;
create policy "meetings read" on public.meetings for select to authenticated using (public.is_hq() or site_keys is null or public.auth_site() = any(site_keys));
drop policy if exists "meetings hq write" on public.meetings;
create policy "meetings hq write" on public.meetings for all to authenticated using (public.is_hq()) with check (public.is_hq());
create or replace function public.meetings_set_creator() returns trigger language plpgsql as $$
begin new.created_by := coalesce(new.created_by, auth.uid()); return new; end $$;
drop trigger if exists meetings_set_creator on public.meetings;
create trigger meetings_set_creator before insert on public.meetings for each row execute function public.meetings_set_creator();
do $$ begin
  alter publication supabase_realtime add table public.meetings;
exception when duplicate_object then null; end $$;
