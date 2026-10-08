-- 대표(본사) → 소장 지시사항. 대상 사업소마다 1행 (group_id 로 같은 지시를 묶음)
create table if not exists public.directives (
  id text primary key,
  group_id text not null,
  site_key text not null references public.sites(key) on delete cascade,
  title text not null,
  body text not null default '',
  due date,
  priority text not null default 'normal' check (priority in ('normal','urgent')),
  status text not null default 'open' check (status in ('open','done')),
  reply text not null default '',
  done_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists directives_site_idx on public.directives(site_key, status);
alter table public.directives enable row level security;
drop policy if exists "directives read" on public.directives;
create policy "directives read" on public.directives for select using (public.is_hq() or site_key = public.auth_site());
drop policy if exists "directives hq write" on public.directives;
create policy "directives hq write" on public.directives for all using (public.is_hq()) with check (public.is_hq());
drop policy if exists "directives mgr update" on public.directives;
create policy "directives mgr update" on public.directives for update using (site_key = public.auth_site()) with check (site_key = public.auth_site());

-- 소장은 상태·조치내용만 바꿀 수 있다 (제목·내용·기한·대상은 본사만)
create or replace function public.directives_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_hq() then
    new.title := old.title; new.body := old.body; new.due := old.due; new.priority := old.priority;
    new.site_key := old.site_key; new.group_id := old.group_id; new.created_by := old.created_by; new.created_at := old.created_at;
  end if;
  if new.status = 'done' and old.status is distinct from 'done' then new.done_at := now(); end if;
  if new.status = 'open' then new.done_at := null; end if;
  return new;
end $$;
drop trigger if exists directives_guard on public.directives;
create trigger directives_guard before update on public.directives for each row execute function public.directives_guard();

create or replace function public.directives_set_creator() returns trigger language plpgsql as $$
begin new.created_by := coalesce(new.created_by, auth.uid()); return new; end $$;
drop trigger if exists directives_set_creator on public.directives;
create trigger directives_set_creator before insert on public.directives for each row execute function public.directives_set_creator();

do $$ begin
  alter publication supabase_realtime add table public.directives;
exception when duplicate_object then null; end $$;
