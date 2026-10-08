-- 건축물대장 원본 PDF 저장용 비공개 버킷 (사업소별 탭 "원본 PDF 보기" 버튼)
-- 경로 규칙: buildings/<site_key>/register.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('buildings', 'buildings', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = array['application/pdf'];

-- 예전 스키마(report-photos 버킷)의 정책이 남아 있으면 지금은 없는 my_branch()/profiles.branch_id를 참조해
-- 모든 storage 요청이 "schema mismatch ... my_branch" 오류로 실패한다. 먼저 지운다.
drop policy if exists "photos_obj_select" on storage.objects;
drop policy if exists "photos_obj_insert" on storage.objects;
drop policy if exists "photos_obj_delete" on storage.objects;

drop policy if exists "buildings read" on storage.objects;
drop policy if exists "buildings hq write" on storage.objects;
drop policy if exists "buildings hq update" on storage.objects;
drop policy if exists "buildings hq delete" on storage.objects;

-- 본사는 전부, 소장은 자기 사업소 폴더만 읽기
create policy "buildings read" on storage.objects for select to authenticated
  using (bucket_id = 'buildings' and (public.is_hq() or (storage.foldername(name))[1] = public.auth_site()));
-- 올리기·바꾸기·지우기는 본사만
create policy "buildings hq write" on storage.objects for insert to authenticated
  with check (bucket_id = 'buildings' and public.is_hq());
create policy "buildings hq update" on storage.objects for update to authenticated
  using (bucket_id = 'buildings' and public.is_hq()) with check (bucket_id = 'buildings' and public.is_hq());
create policy "buildings hq delete" on storage.objects for delete to authenticated
  using (bucket_id = 'buildings' and public.is_hq());
