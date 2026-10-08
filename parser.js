/* 월간업무보고 xlsx → 구조화 레코드 (SheetJS 전역 XLSX 필요)
   사업소마다 양식이 조금씩 다르므로 셀 주소가 아니라 라벨(띄어쓰기 무시)을 기준으로 읽는다. */
(function (global) {
  'use strict';

  function s(v) { return v == null ? '' : String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function sq(v) { return s(v).replace(/\s+/g, ''); }
  function num(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    const m = String(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function serialToYMD(v) {
    if (typeof v === 'number' && v > 20000 && v < 80000 && global.XLSX && XLSX.SSF) {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return d.y + '-' + pad2(d.m) + '-' + pad2(d.d);
    }
    return '';
  }
  /* "2026.12.31" / "2026. 9. 1" / "26.05.07" / "22. 6. 14" / 엑셀 날짜 일련번호 → YYYY-MM-DD, 그 외는 원문 */
  function toDateStr(v) {
    if (v == null || v === '') return '';
    const sd = serialToYMD(v); if (sd) return sd;
    const t = s(v);
    let m = t.match(/(\d{4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/);
    if (m) return m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]);
    m = t.match(/^(\d{2})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/);
    if (m) return '20' + m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]);
    m = t.match(/(\d{4})\s*[.\-\/년]\s*(\d{1,2})/);
    if (m) return m[1] + '-' + pad2(+m[2]);
    return t;
  }
  function toPeriod(v) {
    if (v == null || v === '') return '';
    const sd = serialToYMD(v); if (sd) return sd.slice(0, 7);
    const t = s(v);
    let m = t.match(/(\d{4})\s*[.\-\/년]\s*(\d{1,2})/);
    if (m) return m[1] + '-' + pad2(+m[2]);
    m = t.match(/^(\d{2})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*\d{1,2}/);
    if (m) return '20' + m[1] + '-' + pad2(+m[2]);
    return '';
  }
  function normalizeSite(name) { return s(name).replace(/[\s,，.·、]+$/g, ''); }
  /* "하 재 원" → "하재원" (한글 이름 사이 공백 제거), "조성일 주임"은 유지 */
  function personName(v) {
    const t = s(v);
    return /^[가-힣](\s[가-힣]){1,3}$/.test(t) ? t.replace(/\s/g, '') : t;
  }
  function label(v) { return sq(v); }
  function siteKey(name) {
    const n = normalizeSite(name).replace(/\s+/g, '');
    let h = 7;
    for (const ch of n) h = (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0;
    return 's' + h.toString(36);
  }

  function gridOf(ws) {
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    return rows.map(r => r.map(v => (typeof v === 'string' ? v.replace(/ /g, ' ').trim() : v)));
  }
  function cell(grid, r, c) { const row = grid[r]; return row ? (row[c] == null ? null : row[c]) : null; }
  function find(grid, re, fromRow) {
    for (let r = fromRow || 0; r < grid.length; r++) {
      const row = grid[r] || [];
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (typeof v === 'string' && re.test(sq(v))) return { r, c };
      }
    }
    return null;
  }
  function colIn(grid, r, re) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (typeof v === 'string' && re.test(sq(v))) return c;
    }
    return -1;
  }
  function rightOf(grid, pos, span) {
    if (!pos) return null;
    const row = grid[pos.r] || [];
    const end = Math.min(row.length, pos.c + 1 + (span || 14));
    for (let c = pos.c + 1; c < end; c++) if (row[c] != null && s(row[c]) !== '') return row[c];
    return null;
  }
  function below(grid, pos, span) {
    if (!pos) return null;
    const end = Math.min(grid.length, pos.r + 1 + (span || 2));
    for (let r = pos.r + 1; r < end; r++) { const v = cell(grid, r, pos.c); if (v != null && s(v) !== '') return v; }
    return null;
  }
  function firstText(grid, r, fromCol) {
    const row = grid[r] || [];
    for (let c = fromCol || 0; c < row.length; c++) if (row[c] != null && s(row[c]) !== '') return row[c];
    return null;
  }
  function lines(v) {
    return (v == null ? '' : String(v)).split(/\r?\n/).map(x => x.replace(/ /g, ' ').trim()).filter(x => x && !/^[*○•\-ㆍ]+$/.test(x));
  }
  function has(grid, re) { return !!find(grid, re); }

  /* ---------- 시트 분류 (내용 기준) ---------- */
  function classify(grid) {
    if (has(grid, /^미납합계$/) && has(grid, /^부과년월$/)) return 'unpaid';
    if (has(grid, /^선임자$/) || has(grid, /^총세대수$/) || has(grid, /^완료여부$/)) return 'status';
    if (has(grid, /^업무명$/) || has(grid, /^업무내용$/)) return 'report';
    return '';
  }

  /* ---------- 월간업무보고 시트 ---------- */
  function parseReportSheet(grid) {
    const out = { site: '', author: '', periodText: '', tasks: [], instructions: [], notes: [], plans: [] };
    out.site = s(rightOf(grid, find(grid, /^건물명$/)));
    out.author = s(rightOf(grid, find(grid, /^성명$/)));
    out.periodText = s(rightOf(grid, find(grid, /^(작성기간|작성일자|보고기간|작성일)/)));

    const nameH = find(grid, /^업무명$/);
    const contC = nameH ? colIn(grid, nameH.r, /^업무내용$/) : -1;
    const instrPos = find(grid, /^직원업무지시사항$/);
    const notePos = find(grid, /^특이사항$/);
    const planPos = find(grid, /^예정사항$/);
    const stops = [instrPos, notePos, planPos].filter(Boolean).map(p => p.r);
    if (nameH && contC >= 0) {
      const endRow = stops.length ? Math.min(...stops.filter(r => r > nameH.r)) : grid.length;
      let cur = null;
      for (let r = nameH.r + 1; r < endRow; r++) {
        const cat = lines(cell(grid, r, nameH.c)).join(' ');
        const content = lines(cell(grid, r, contC));
        if (cat) {
          cur = { category: cat.replace(/^\s*\d+[.)]\s*/, ''), items: [] };
          out.tasks.push(cur);
        }
        if (content.length) {
          if (!cur) { cur = { category: '주요업무', items: [] }; out.tasks.push(cur); }
          cur.items.push(...content);
        }
      }
      out.tasks = out.tasks.filter(t => t.items.length || t.category);
    }
    function collect(pos, limit) {
      if (!pos) return [];
      const later = stops.filter(r => r > pos.r);
      const endRow = Math.min(later.length ? Math.min(...later) : grid.length, pos.r + 1 + (limit || 12));
      const acc = [];
      for (let r = pos.r + 1; r < endRow; r++) acc.push(...lines(firstText(grid, r, pos.c)));
      return acc;
    }
    out.instructions = collect(instrPos);
    out.notes = collect(notePos);
    out.plans = collect(planPos);
    return out;
  }

  /* ---------- 건물주요현황 시트 ---------- */
  function parseStatusSheet(grid) {
    const out = {
      site: '', author: '', periodText: '',
      arrears: { units: null, arrearsUnits: null, prevBalance: null, monthChange: null, total: null, action: '' },
      managers: [], managerGap: '', inspections: [], certs: [], complaints: '', etc: [], staffing: null,
    };
    out.site = s(rightOf(grid, find(grid, /^건물명$/)));
    out.author = s(rightOf(grid, find(grid, /^성명$/)));
    out.periodText = s(rightOf(grid, find(grid, /^(작성기간|작성일자|보고기간|작성일)/)));

    const a = out.arrears;
    a.units = num(below(grid, find(grid, /^총세대수$/)));
    a.arrearsUnits = num(below(grid, find(grid, /^체납(세대|호실|세대수)$/)));
    a.prevBalance = num(below(grid, find(grid, /^전월체납잔액$/)));
    a.monthChange = num(below(grid, find(grid, /^당월발생금액$/)));
    a.total = num(below(grid, find(grid, /^총금액$/)));
    a.action = lines(rightOf(grid, find(grid, /^대처방안$/))).join(' ');

    const mp = find(grid, /^선임자$/);
    if (mp) {
      const hr = mp.r - 1;
      const dp = find(grid, /^선임일$/, mp.r);
      const dr = dp ? dp.r : mp.r + 1;
      const row = grid[hr] || [];
      for (let c = mp.c + 1; c < row.length; c++) {
        const item = s(row[c]);
        if (!item) continue;
        out.managers.push({ item: label(item), name: personName(cell(grid, mp.r, c)), date: toDateStr(cell(grid, dr, c)) });
      }
    }
    out.managerGap = s(rightOf(grid, find(grid, /^미선임시대처방안$/)));

    const ip = find(grid, /^(기안일|검사일|검사일자|점검일)$/);
    if (ip) {
      const hr = ip.r - 1;
      const dp = find(grid, /^완료여부$/, ip.r);
      const dr = dp ? dp.r : ip.r + 1;
      const row = grid[hr] || [];
      for (let c = ip.c + 1; c < row.length; c++) {
        const item = s(row[c]);
        if (!item) continue;
        out.inspections.push({ item: label(item), due: toDateStr(cell(grid, ip.r, c)), done: s(cell(grid, dr, c)).replace(/^완\s*료/, '완료') });
      }
    }

    const cp = find(grid, /^자격(증)?종류$/);
    /* 근무인원 표: 구분 | 소장 | 전기과장 | 미화 | 관리원 | 경리담당 | 계  /  근무인원 | 결원 */
    const wp = find(grid, /^근무인원$/);
    if (wp) {
      let hr = -1; for (let r = wp.r - 1; r >= Math.max(0, wp.r - 3); r--) { if (/^구분$/.test(sq(cell(grid, r, wp.c))) || grid[r] && grid[r].some((v, c) => c > wp.c && /^(소장|관리소장|계)$/.test(sq(v)))) { hr = r; break; } }
      if (hr < 0) hr = wp.r - 1;
      let vr = -1; for (let r = wp.r + 1; r < Math.min(grid.length, wp.r + 3); r++) { if (/^결원$/.test(sq(cell(grid, r, wp.c)))) { vr = r; break; } }
      const roles = []; let total = null, vacTotal = null;
      for (let c = wp.c + 1; c < (grid[hr] || []).length + 6; c++) {
        const h = s(cell(grid, hr, c)); if (!h) continue;
        const cnt = num(cell(grid, wp.r, c)), vac = vr >= 0 ? num(cell(grid, vr, c)) : null;
        if (/^(계|합계|총계)$/.test(sq(h))) { total = cnt; vacTotal = vac; break; }
        roles.push({ role: h, count: cnt == null ? 0 : cnt, vacancy: vac == null ? 0 : vac });
      }
      if (roles.length) {
        if (total == null) total = roles.reduce((a, x) => a + x.count, 0);
        if (vacTotal == null) vacTotal = roles.reduce((a, x) => a + x.vacancy, 0);
        out.staffing = { roles, total, vacancy: vacTotal };
      }
    }
    const complaintPos = find(grid, /^주요민원처리현황$/);
    const etcPos = find(grid, /^기타사항$/);
    if (cp) {
      const nc = colIn(grid, cp.r, /^성명$/);
      const ec = colIn(grid, cp.r, /^기타$/);
      const dc = colIn(grid, cp.r, /^취득(년월|일|일자)$/);
      const ic = colIn(grid, cp.r, /^발급기관$/);
      const stops = [complaintPos, etcPos].filter(Boolean).map(p => p.r).filter(r => r > cp.r);
      const endRow = Math.min(stops.length ? Math.min(...stops) : grid.length, cp.r + 12);
      for (let r = cp.r + 1; r < endRow; r++) {
        const name = nc >= 0 ? personName(cell(grid, r, nc)) : '';
        const certs = s(cell(grid, r, cp.c));
        if (!name && !certs) continue;
        out.certs.push({
          name, certs: certs.replace(/\s*,\s*/g, ', ').replace(/,\s*$/, ''),
          date: dc >= 0 ? toDateStr(cell(grid, r, dc)) : '',
          issuer: ic >= 0 ? s(cell(grid, r, ic)) : '',
          etc: ec >= 0 ? s(cell(grid, r, ec)) : '',
        });
      }
    }
    out.complaints = lines(rightOf(grid, complaintPos)).join(' ');
    if (etcPos) {
      const v = rightOf(grid, etcPos);
      out.etc = lines(v);
      for (let r = etcPos.r + 1; r < Math.min(grid.length, etcPos.r + 4); r++) {
        const t = firstText(grid, r, etcPos.c);
        if (t && !/^\*/.test(s(t))) out.etc.push(...lines(t));
      }
    }
    return out;
  }

  /* ---------- 미납대장 시트 ---------- */
  function parseUnpaidSheet(grid) {
    const out = { rows: [], summary: null, asOf: '' };
    const asOf = find(grid, /^기준결산일/);
    if (asOf) out.asOf = toDateStr(cell(grid, asOf.r, asOf.c));
    const tp = find(grid, /^미납합계$/);
    if (!tp) return out;
    const hr = tp.r;
    const dongC = colIn(grid, hr, /^동$/);
    const unitC = colIn(grid, hr, /^호$/);
    const monthC = colIn(grid, hr, /^부과년월$/);
    const typeC = colIn(grid, hr, /^구분$/);
    const chargeC = colIn(grid, hr, /^부과액$/);
    const lateC = colIn(grid, hr, /^연체료$/);
    const lateSumC = colIn(grid, hr, /^연체료계$/);
    const noteC = colIn(grid, hr, /^비고$/);
    const autoC = colIn(grid, hr, /^자동이체$/);
    const lateCol = lateSumC >= 0 ? lateSumC : lateC;
    let lastUnit = '', lastDong = '';
    for (let r = hr + 1; r < grid.length; r++) {
      const label = sq(firstText(grid, r));
      const unitRaw = unitC >= 0 ? s(cell(grid, r, unitC)) : '';
      if (/^호계$/.test(sq(unitRaw))) {
        /* 호계(세대 소계) 행에 적힌 비고는 바로 위 세대의 비고로 붙인다 */
        const n = noteC >= 0 ? s(cell(grid, r, noteC)) : '';
        if (n && out.rows.length) { const last = out.rows[out.rows.length - 1]; last.note = (last.note ? last.note + ' ' : '') + n; }
        continue;
      }
      if (/^(동계|합계|총계)$/.test(label) || /^(동계|합계|총계)$/.test(sq(unitRaw))) {
        out.summary = {
          units: num(cell(grid, r, unitC)),
          count: num(cell(grid, r, monthC)),
          charge: num(cell(grid, r, chargeC)),
          late: num(cell(grid, r, lateCol)),
          total: num(cell(grid, r, tp.c)),
        };
        if (/^(합계|총계)$/.test(label)) break;
        continue;
      }
      const month = toPeriod(cell(grid, r, monthC));
      if (!month) continue;
      if (dongC >= 0 && s(cell(grid, r, dongC))) lastDong = s(cell(grid, r, dongC));
      if (unitRaw) lastUnit = unitRaw;
      out.rows.push({
        dong: lastDong, unit: lastUnit, month,
        type: typeC >= 0 ? s(cell(grid, r, typeC)) : '',
        charge: num(cell(grid, r, chargeC)) || 0,
        late: num(cell(grid, r, lateCol)) || 0,
        total: num(cell(grid, r, tp.c)) || 0,
        note: noteC >= 0 ? s(cell(grid, r, noteC)) : '',
        autopay: autoC >= 0 ? s(cell(grid, r, autoC)) : '',
      });
    }
    if (!out.summary && out.rows.length) {
      const units = new Set(out.rows.map(x => x.dong + '-' + x.unit));
      out.summary = {
        units: units.size, count: out.rows.length,
        charge: out.rows.reduce((a, x) => a + x.charge, 0),
        late: out.rows.reduce((a, x) => a + x.late, 0),
        total: out.rows.reduce((a, x) => a + x.total, 0),
      };
    }
    return out;
  }

  /* ---------- 워크북 → 레코드 ---------- */
  function parseWorkbook(wb, fileName) {
    const warnings = [];
    const grids = wb.SheetNames.map(n => ({ name: n, grid: gridOf(wb.Sheets[n]) }));
    const byKind = {};
    for (const g of grids) {
      const k = classify(g.grid);
      if (k && !byKind[k]) byKind[k] = g;
    }
    const rep = byKind.report ? parseReportSheet(byKind.report.grid) : null;
    const st = byKind.status ? parseStatusSheet(byKind.status.grid) : null;
    const un = byKind.unpaid ? parseUnpaidSheet(byKind.unpaid.grid) : null;
    if (!rep) warnings.push('월간업무보고 시트(업무명/업무내용 표)를 찾지 못했습니다.');
    if (!st) warnings.push('건물주요현황 시트를 찾지 못했습니다.');
    if (!un) warnings.push('미납내용 시트가 없어 세대별 미납 내역은 비어 있습니다.');

    const site = normalizeSite((st && st.site) || (rep && rep.site) || '');
    const periodText = (rep && rep.periodText) || (st && st.periodText) || '';
    let period = toPeriod(periodText);
    if (!period && st && st.periodText) period = toPeriod(st.periodText);
    if (!period && fileName) period = toPeriod(fileName);
    if (!site) warnings.push('건물명(사업소명)을 읽지 못했습니다. 아래에서 직접 입력하세요.');
    if (!period) warnings.push('보고 월을 읽지 못했습니다. 아래에서 직접 선택하세요.');
    if (st && st.arrears.total == null && !(un && un.summary && un.summary.total != null)) warnings.push('체납 총금액을 읽지 못했습니다.');
    if (un && !un.rows.length) warnings.push('미납대장에서 세대별 내역을 읽지 못했습니다.');

    const arrears = st ? st.arrears : { units: null, arrearsUnits: null, prevBalance: null, monthChange: null, total: null, action: '' };
    if (un && un.summary) {
      if (arrears.total == null && un.summary.total != null) arrears.total = un.summary.total;
      if (arrears.arrearsUnits == null && un.summary.units != null) arrears.arrearsUnits = un.summary.units;
    }

    const rec = {
      site, siteKey: site ? siteKey(site) : '', period, periodText,
      author: personName((rep && rep.author) || (st && st.author) || ''),
      fileName: fileName || '',
      sheets: { report: byKind.report ? byKind.report.name : '', status: byKind.status ? byKind.status.name : '', unpaid: byKind.unpaid ? byKind.unpaid.name : '' },
      tasks: rep ? rep.tasks : [],
      instructions: rep ? rep.instructions : [],
      notes: rep ? rep.notes : [],
      plans: rep ? rep.plans : [],
      arrears,
      managers: st ? st.managers : [],
      managerGap: st ? st.managerGap : '',
      inspections: st ? st.inspections : [],
      certs: st ? st.certs : [],
      staffing: st ? st.staffing : null,
      complaints: st ? st.complaints : '',
      etc: st ? st.etc : [],
      unpaid: un ? un.rows : [],
      unpaidSummary: un ? un.summary : null,
      unpaidAsOf: un ? un.asOf : '',
      warnings,
    };
    rec.id = rec.siteKey && rec.period ? rec.siteKey + '_' + rec.period : '';
    return rec;
  }

  async function parseFile(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    return parseWorkbook(wb, file.name);
  }

  global.ReportParser = { parseWorkbook, parseFile, siteKey, normalizeSite, toPeriod, toDateStr, num };
})(window);
