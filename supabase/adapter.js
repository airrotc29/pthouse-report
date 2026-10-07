/* Supabase 저장소 어댑터 (설계안 · 아직 연결되지 않음)
   app.html 의 `store` 객체와 같은 메서드 이름을 유지해, 연결 시 store 를 이 객체로 바꾸기만 하면 된다.
   사용: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
         const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
         const store = makeSupabaseStore(sb, { onData, state }); */
function makeSupabaseStore(sb, ctx) {
  const { state, onData } = ctx;
  const rowToReport = r => Object.assign({}, r.data, { id: r.id, siteKey: r.site_key, period: r.period, author: r.author, fileName: r.file_name, uploadedAt: r.uploaded_at });
  const rowsToDailies = rows => {            /* dailies 행 → 앱의 {id, siteKey, site, period, days:{dd:entry}} 문서 묶음 */
    const m = new Map();
    rows.forEach(r => { const period = r.date.slice(0, 7), dd = r.date.slice(8, 10), id = r.site_key + '_' + period;
      if (!m.has(id)) m.set(id, { id, siteKey: r.site_key, site: (state.siteList.find(s => s.id === r.site_key) || {}).name || r.site_key, period, days: {} });
      m.get(id).days[dd] = r.entry; });
    return Array.from(m.values());
  };
  async function loadAll() {
    const [s, r, d, a, p] = await Promise.all([
      sb.from('sites').select('*').eq('active', true), sb.from('reports').select('*'), sb.from('dailies').select('*'), sb.from('acks').select('*'),
      sb.from('profiles').select('id, role, site_key, name, must_change_pw').eq('id', (await sb.auth.getUser()).data.user.id).single(),
    ]);
    state.siteList = (s.data || []).map(x => ({ id: x.key, name: x.name, code: x.code }));
    state.reports = (r.data || []).map(rowToReport);
    state.dailies = rowsToDailies(d.data || []);
    state.acks = (a.data || []).map(x => ({ id: x.id, month: x.month, memo: x.memo, at: x.acked_at }));
    state.me = p.data;                       /* { role: 'hq'|'manager', site_key, must_change_pw } → 소장 모드/본사 모드 분기 */
    state.canWrite = true; state.loaded = true; onData();
  }
  return {
    async init() {
      state.mode = 'supabase';
      await loadAll();
      /* 실시간 반영: 변경이 생기면 다시 읽는다 (규모가 작아 단순 재조회로 충분) */
      sb.channel('all').on('postgres_changes', { event: '*', schema: 'public' }, () => loadAll()).subscribe();
    },
    async saveReport(rec) {
      const { warnings, ...data } = rec;
      const { error } = await sb.from('reports').upsert({ id: rec.id, site_key: rec.siteKey, period: rec.period, author: rec.author, file_name: rec.fileName, data, uploaded_at: new Date().toISOString() });
      if (error) throw error;
    },
    async deleteReport(id) { const { error } = await sb.from('reports').delete().eq('id', id); if (error) throw error; },
    async saveDaily(siteKey, site, date, entry) { const { error } = await sb.from('dailies').upsert({ site_key: siteKey, date, entry }); if (error) throw error; },
    async deleteDaily(siteKey, date) { const { error } = await sb.from('dailies').delete().match({ site_key: siteKey, date }); if (error) throw error; },
    async setSite(doc) { const { error } = await sb.from('sites').upsert({ key: doc.id, name: doc.name, code: doc.code || doc.id }); if (error) throw error; },
    async deleteSite(id) { const { error } = await sb.from('sites').update({ active: false }).eq('key', id); if (error) throw error; },
    async renameSite(oldKey, newName) { const { error } = await sb.from('sites').update({ name: newName }).eq('key', oldKey); if (error) throw error; }, /* 키는 유지 */
    async setAck(doc) { const { error } = await sb.from('acks').upsert({ id: doc.id, month: doc.month, memo: doc.memo }); if (error) throw error; },
    async clearAck(id) { const { error } = await sb.from('acks').delete().eq('id', id); if (error) throw error; },
    /* 인증 */
    async signIn(code, password) { const { data, error } = await sb.auth.signInWithPassword({ email: code.trim().toLowerCase() + '@pthouse.local', password }); if (error) throw error; return data; },
    async signOut() { await sb.auth.signOut(); },
    async changePassword(pw) { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; await sb.rpc('mark_pw_changed'); },
  };
}
