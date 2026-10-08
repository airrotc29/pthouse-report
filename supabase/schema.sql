-- 사업소 보고 현황판 · Supabase 스키마 (설계안, v1)
-- 실행 순서: Supabase SQL Editor에서 이 파일 전체를 한 번에 실행
-- 계정 정책: 사업소당 1계정, 아이디 = 사업소 코드 (이메일 별칭 <코드>@pthouse.local),
--            초기 비밀번호 123456 (Supabase 최소 6자 제약), 첫 로그인 시 변경 강제 (profiles.must_change_pw)

-- ───────────────────────── 1. 테이블 ─────────────────────────
create table if not exists public.sites (
  key        text primary key,                 -- ReportParser.siteKey(이름) 와 동일한 해시 (앱과 호환)
  code       text unique not null,             -- 로그인 아이디 (예: garim01) · 영문/숫자
  name       text not null,
  units      int,                              -- 총 세대수 (최근 보고서 값으로 갱신)
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  role           text not null check (role in ('hq', 'manager')),
  site_key       text references public.sites(key) on delete set null,  -- manager 는 필수, hq 는 null
  name           text,                         -- 소장 성명
  phone          text,                         -- 소장 연락처 (개인정보 · hq 만 열람)
  must_change_pw boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.reports (
  id          text primary key,                -- <site_key>_<YYYY-MM> (앱의 문서 id 그대로)
  site_key    text not null references public.sites(key) on delete cascade,
  period      text not null check (period ~ '^\d{4}-\d{2}$'),
  author      text,
  file_name   text,
  file_path   text,                            -- storage: reports/<site_key>/<period>.xlsx (선택)
  data        jsonb not null,                  -- 파싱 결과 전체 (tasks, arrears, managers, inspections, certs, unpaid …)
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now(),
  unique (site_key, period)
);

create table if not exists public.dailies (
  site_key   text not null references public.sites(key) on delete cascade,
  date       date not null,
  entry      jsonb not null,                   -- 일일보고 v2 항목 (checks, complaintsDetail, incidents, …)
  urgent     boolean generated always as ((entry->>'urgent')::boolean) stored,
  author_id  uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (site_key, date)
);

create table if not exists public.acks (
  id       text primary key,                   -- 경영 주의사항 식별자 (issuesFor 가 만드는 id)
  month    text,
  memo     text,
  acked_by uuid references auth.users(id),
  acked_at timestamptz not null default now()
);

create index if not exists reports_period_idx on public.reports (period);
create index if not exists dailies_date_idx   on public.dailies (date);
create index if not exists dailies_urgent_idx on public.dailies (date) where urgent;

-- ───────────────────────── 2. 권한 헬퍼 ─────────────────────────
create or replace function public.auth_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.auth_site() returns text
language sql stable security definer set search_path = public as
$$ select site_key from public.profiles where id = auth.uid() $$;

create or replace function public.is_hq() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.auth_role() = 'hq', false) $$;

-- 비밀번호를 바꾼 뒤 앱이 호출 (본인 행만 갱신)
create or replace function public.mark_pw_changed() returns void
language sql security definer set search_path = public as
$$ update public.profiles set must_change_pw = false where id = auth.uid() $$;

-- ───────────────────────── 3. RLS ─────────────────────────
alter table public.sites    enable row level security;
alter table public.profiles enable row level security;
alter table public.reports  enable row level security;
alter table public.dailies  enable row level security;
alter table public.acks     enable row level security;

-- sites: 로그인한 모두 열람, 변경은 본사만
create policy sites_read   on public.sites for select to authenticated using (true);
create policy sites_write  on public.sites for all    to authenticated using (public.is_hq()) with check (public.is_hq());

-- profiles: 본인 행 또는 본사. (전화번호는 본사와 본인만 보임)
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_hq());
create policy profiles_hq   on public.profiles for all    to authenticated using (public.is_hq()) with check (public.is_hq());

-- reports / dailies: 본사는 전체, 소장은 자기 사업소만 (읽기·쓰기 모두)
create policy reports_rw on public.reports for all to authenticated
  using (public.is_hq() or site_key = public.auth_site())
  with check (public.is_hq() or site_key = public.auth_site());

create policy dailies_rw on public.dailies for all to authenticated
  using (public.is_hq() or site_key = public.auth_site())
  with check (public.is_hq() or site_key = public.auth_site());

-- acks: 본사 전용
create policy acks_hq on public.acks for all to authenticated using (public.is_hq()) with check (public.is_hq());

-- ───────────────────────── 4. 갱신 트리거 ─────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists dailies_touch on public.dailies;
create trigger dailies_touch before update on public.dailies for each row execute function public.touch_updated_at();

-- 보고서가 들어오면 사업소 총세대수 갱신
create or replace function public.sync_site_units() returns trigger
language plpgsql as $$
begin
  update public.sites set units = nullif(new.data->'arrears'->>'units','')::int where key = new.site_key
    and (new.data->'arrears'->>'units') is not null;
  return new;
end $$;
drop trigger if exists reports_sync_units on public.reports;
create trigger reports_sync_units after insert or update on public.reports for each row execute function public.sync_site_units();

-- ───────────────────────── 5. (선택) 원본 엑셀 보관 버킷 ─────────────────────────
-- Storage > New bucket: reports (private). 정책:
--   select/insert/update: bucket_id = 'reports' and (public.is_hq() or (storage.foldername(name))[1] = public.auth_site())

-- ───────────────────────── 6. 계정 생성 시 profiles 자동 연결 ─────────────────────────
-- Authentication → Users → Add user 로 <코드>@pthouse.local 계정을 만들면 sites.code 와 맞춰 소장 프로필이 생긴다.
-- hq@pthouse.local 은 본사(hq). 코드가 sites 에 없으면 생성이 거부된다.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare c text; k text;
begin
  c := lower(split_part(new.email, '@', 1));
  if c = 'hq' or c like 'hq%' then
    insert into public.profiles (id, role, must_change_pw) values (new.id, 'hq', true) on conflict (id) do nothing;
  else
    select key into k from public.sites where code = c;
    if k is null then raise exception '사업소 코드 "%" 가 sites 에 없습니다. 업로드 탭 → 사업소 목록에서 아이디를 먼저 지정하세요.', c; end if;
    insert into public.profiles (id, role, site_key, must_change_pw) values (new.id, 'manager', k, true) on conflict (id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ───────────────────────── 7. 실시간 반영 ─────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.sites, public.reports, public.dailies, public.acks;
exception when duplicate_object then null; end $$;
