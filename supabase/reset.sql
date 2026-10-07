-- 초기화: 이 앱이 만드는 표·함수만 지운다 (새 프로젝트에서 schema.sql 이 중간에 실패했거나 표를 미리 만들어 둔 경우)
-- 실행 순서: reset.sql → schema.sql → migrate.sql
drop table if exists public.acks, public.dailies, public.reports, public.profiles, public.sites cascade;
drop function if exists public.handle_new_user(), public.sync_site_units(), public.touch_updated_at(),
  public.mark_pw_changed(), public.is_hq(), public.auth_site(), public.auth_role() cascade;
