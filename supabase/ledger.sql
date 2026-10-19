-- 도급용역비·관리수수료 미수 장부 (본사 전용 "도급비 관리" 탭)
-- 엑셀을 파싱한 결과 전체를 id='main' 한 행에 jsonb 로 보관한다.
create table if not exists public.ledger (
  id          text primary key,
  data        jsonb not null,
  file_name   text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);
alter table public.ledger enable row level security;
drop policy if exists "ledger hq all" on public.ledger;
create policy "ledger hq all" on public.ledger for all to authenticated using (public.is_hq()) with check (public.is_hq());

-- ───── 사업소장에게 자기 사업소 도급비만 보여주기 ─────
-- 본사가 장부를 올리면 앱이 사업소별 요약(id = 'site:<사업소키>')을 함께 저장한다.
-- 소장은 자기 사업소 요약 행만 읽을 수 있고, 전체 장부(id = 'main')는 본사만 읽는다.
drop policy if exists "ledger hq all" on public.ledger;
drop policy if exists "ledger hq write" on public.ledger;
drop policy if exists "ledger read" on public.ledger;
create policy "ledger hq write" on public.ledger for all to authenticated using (public.is_hq()) with check (public.is_hq());
create policy "ledger read" on public.ledger for select to authenticated using (public.is_hq() or id = 'site:' || public.auth_site());
