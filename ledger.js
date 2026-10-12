/* 도급용역비·관리수수료 장부(xlsx) → 구조화 데이터 (SheetJS 전역 XLSX 필요)
   시트: 총괄표(누적 미수채권) · 연도별합계 · YYYY.MM / YYYYMM (월별 현황) · YYYY년도 (연도 누계)
   열 위치가 아니라 머리글 라벨을 기준으로 읽는다 (2026.09 시트처럼 '선인출' 열이 끼어도 동작). */
(function (global) {
  'use strict';
  const s = v => v == null ? '' : String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  const sq = v => s(v).replace(/\s+/g, '');
  const num = v => { if (typeof v === 'number') return isFinite(v) ? v : null; if (v == null || v === '') return null; const t = String(v).replace(/,/g, '').trim(); return /^-?\d+(\.\d+)?$/.test(t) ? +t : null; };
  const toDate = v => {
    if (v == null || v === '') return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
    const m = String(v).match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/); return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : '';
  };
  const CK = { '도급용역비(누계)': 's', '부가세': 'v', '기업이윤': 'p', '합계': 't', '선인출': 'a', '인출금액': 'd', '미인출잔액': 'u', '회수율': 'r' };
  const FK = { '관리수수료(누계)': 's', '부가세': 'v', '합계': 't', '선인출': 'a', '인출금액': 'd', '미인출잔액': 'u', '회수율': 'r' };
  const rnd = n => n == null ? null : Math.round(n);

  /* 현장 표 시트 하나 */
  function parseSiteSheet(grid) {
    let hr = -1; for (let r = 0; r < Math.min(grid.length, 30); r++) if ((grid[r] || []).some(c => sq(c) === '건물명')) { hr = r; break; }
    if (hr < 0) return null;
    const head = grid[hr] || [], sub = grid[hr + 1] || [];
    const colOf = lab => head.findIndex(c => sq(c) === lab);
    const nameC = colOf('건물명'), seqC = colOf('순번'), cStart = head.findIndex(c => sq(c) === '도급용역비'), fStart = head.findIndex(c => sq(c) === '관리수수료'), advC = colOf('선인출잔액');
    if (nameC < 0 || cStart < 0) return null;
    const fEnd = advC > fStart ? advC : Math.max(sub.length, head.length);
    const cMap = {}, fMap = {};
    for (let c = cStart; c < (fStart > cStart ? fStart : sub.length); c++) { const k = CK[sq(sub[c])]; if (k && cMap[k] == null) cMap[k] = c; }
    if (fStart >= 0) for (let c = fStart; c < fEnd; c++) { const k = FK[sq(sub[c])]; if (k && fMap[k] == null) fMap[k] = c; }
    const pick = (row, map) => { const o = {}; Object.keys(map).forEach(k => { const v = num(row[map[k]]); if (v != null) o[k] = k === 'r' ? Math.round(v * 10000) / 10000 : rnd(v); }); return o; };
    const rows = []; let total = null;
    for (let r = hr + 2; r < grid.length; r++) {
      const row = grid[r] || [], nm = s(row[nameC]), sqv = seqC >= 0 ? sq(row[seqC]) : '';
      if (/^합계/.test(sqv) || /^합계/.test(sq(nm))) { total = { c: pick(row, cMap), f: pick(row, fMap) }; break; }
      if (!nm) continue;
      const o = { n: nm, c: pick(row, cMap), f: pick(row, fMap) }; const seq = num(row[seqC]); if (seq != null) o.q = seq;
      if (advC >= 0) { const a = num(row[advC]); if (a) o.adv = rnd(a); }
      rows.push(o);
    }
    let updated = ''; for (let r = 0; r < Math.min(grid.length, hr); r++) { const row = grid[r] || []; const i = row.findIndex(c => sq(c) === '업데이트'); if (i >= 0) { for (let c = i + 1; c < row.length; c++) { const d = toDate(row[c]); if (d) { updated = d; break; } } } }
    return { rows, total, updated };
  }

  /* 연도별합계 시트: 연도 합계 + 연도별 월별 현황 */
  function parseSummary(grid) {
    const years = {}, monthly = {};
    for (let r = 0; r < grid.length; r++) {
      const a = s((grid[r] || [])[0]);
      if (!a.startsWith('▶')) continue;
      const hdr = grid[r + 1] || [];
      const rowsOf = fn => { for (let k = r + 2; k < grid.length; k++) { const row = grid[k] || [], lab = sq(row[0]); if (!lab || s(row[0]).startsWith('▶')) break; fn(lab, row); } };
      if (/연도별/.test(a)) {
        const cols = {}; hdr.forEach((c, i) => { const m = s(c).match(/(\d{4})년도/); if (m) cols[i] = m[1]; });
        rowsOf((lab, row) => { const key = lab === '도급용역비' ? 'contract' : lab === '관리수수료' ? 'fee' : lab === '합계' ? 'total' : lab === '전년대비' ? 'yoy' : ''; if (!key) return; Object.keys(cols).forEach(i => { const v = num(row[i]); if (v != null) (years[cols[i]] = years[cols[i]] || {})[key] = key === 'yoy' ? Math.round(v * 10000) / 10000 : rnd(v); }); });
      } else {
        const ym = a.match(/(\d{4})년\s*월별/); if (!ym) continue;
        const cols = {}; hdr.forEach((c, i) => { const m = s(c).match(/^(\d{1,2})월$/); if (m) cols[i] = +m[1]; });
        rowsOf((lab, row) => { const key = lab === '현장개수' ? 'sites' : lab === '도급용역비' ? 'contract' : lab === '관리수수료' ? 'fee' : lab === '합계' ? 'total' : lab === '전년대비' ? 'yoy' : lab === '전월대비' ? 'mom' : ''; if (!key) return; Object.keys(cols).forEach(i => { const v = num(row[i]); if (v != null) { const m = ((monthly[ym[1]] = monthly[ym[1]] || {})[cols[i]] = monthly[ym[1]][cols[i]] || {}); m[key] = (key === 'yoy' || key === 'mom') ? Math.round(v * 10000) / 10000 : rnd(v); } }); });
      }
    }
    return { years, monthly };
  }

  /* sheets: { 시트이름: 2차원 배열 } */
  function parseLedgerGrids(sheets) {
    const out = { v: 1, summary: null, months: {}, yearSheets: {}, cumulative: null, updated: '', sheets: Object.keys(sheets) };
    Object.keys(sheets).forEach(name => {
      const nm = name.replace(/\s+/g, ''), grid = sheets[name] || [];
      let m;
      if (nm === '총괄표') { const p = parseSiteSheet(grid); if (p) { out.cumulative = p; if (p.updated) out.updated = p.updated; } }
      else if (nm === '연도별합계') out.summary = parseSummary(grid);
      else if ((m = nm.match(/^(\d{4})\.?(\d{2})$/))) { const p = parseSiteSheet(grid); if (p) out.months[m[1] + '-' + m[2]] = p; }
      else if ((m = nm.match(/^(\d{4})년도$/))) { const p = parseSiteSheet(grid); if (p) out.yearSheets[m[1]] = p; }
    });
    out.latest = Object.keys(out.months).sort().pop() || '';
    return out;
  }

  function parseLedgerBuffer(buf) {
    const wb = XLSX.read(buf, { type: 'array', cellDates: false }), sheets = {};
    wb.SheetNames.forEach(n => { sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: true }); });
    const r = parseLedgerGrids(sheets);
    if (!r.cumulative && !Object.keys(r.months).length) throw new Error('도급용역비 장부 양식을 찾지 못했습니다 (총괄표 또는 월별 시트가 필요합니다)');
    return r;
  }
  global.parseLedgerGrids = parseLedgerGrids; global.parseLedgerBuffer = parseLedgerBuffer;
  if (typeof module !== 'undefined') module.exports = { parseLedgerGrids, parseLedgerBuffer };
})(typeof window !== 'undefined' ? window : globalThis);
