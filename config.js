/* Supabase 연결 설정 (GitHub Pages 전용). 값을 채우면 로그인 화면이 켜지고 데이터가 Supabase 에 저장됩니다.
   비워 두면 이 브라우저에만 저장하는 기존 방식으로 동작합니다. anon key 는 공개용 키입니다(RLS 로 보호). */
window.PTH_CONFIG = {
  supabaseUrl: '',      // 예: https://abcdefghijklmnop.supabase.co
  supabaseAnonKey: '',  // Project Settings → API → anon public
};
