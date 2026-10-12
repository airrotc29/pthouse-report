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
