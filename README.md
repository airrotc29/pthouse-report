# 사업소 보고 현황판

사업소(관리사무소)에서 올라오는 **월간업무보고(엑셀)** 와 **일일업무보고**를 한 화면에 모아 보는 현황판입니다.
claude.ai 아티팩트로 게시되며, 이 저장소는 그 소스를 보관합니다.

- 아티팩트(공유 저장소 사용): https://claude.ai/artifact/P5qETfkT2M6BVLugFcPQk2
- GitHub Pages(단독 실행): https://airrotc29.github.io/pthouse-report/

> 두 주소는 화면이 같지만 **데이터 저장 위치가 다릅니다.** 아티팩트는 공유 저장소(db)에 저장되어 권한을 받은 사람끼리 같은 데이터를 보고, GitHub Pages 버전은 사용하는 브라우저에만 저장됩니다(화면 위 배지에 "이 브라우저에만 저장"으로 표시).

## 파일
| 파일 | 설명 |
|------|------|
| `app.html` | 화면·집계·내보내기 전체 (아티팩트에 게시하는 본문, 원본) |
| `index.html` | `app.html`을 `<!doctype html>`·메타로 감싼 GitHub Pages용 문서 (`tools_wrap.py`로 생성, 직접 수정하지 않음) |
| `tools_wrap.py` | `python3 tools_wrap.py app.html index.html` (supabase-js · config.js 로드 포함) |
| `config.js` | Supabase Project URL · anon key (GitHub Pages 전용 설정) |
| `supabase/` | `schema.sql`(테이블·권한·트리거) · `migrate.sql`(데이터 이전) · `README.md`(연결 순서) |
| `parser.js` | 월간보고 엑셀(.xlsx) → 구조화 레코드 파서 (SheetJS 필요) |

## 주요 기능
- **종합 현황**: 제출·체납·법정검사·선임 공란 KPI, 월별 추이, 오늘의 일일보고, 경영 주의사항(확인 처리·메모)
- **사업소별 / 항목 비교 / 일일보고 / 업로드**
- **일일보고 작성**: 9개 영역 구조화 서식(기본·시설 점검·공사·민원·체납 독촉·사고·입주 변동·지시 이행·예정/요청)

## 데이터
보고 데이터는 저장소에 두지 않고 아티팩트의 공유 저장소(db)에 저장합니다
(`reports`, `dailies`, `sites`, `acks` 컬렉션). 일일보고 항목(`dailies.days[dd]`, v2)은 Supabase 등 관계형 DB로 옮길 때 표 단위로 나누기 쉽게 필드별로 저장합니다.

## 갱신 방법
1. `app.html`을 수정합니다.
2. `python3 tools_wrap.py app.html index.html` 로 Pages용 문서를 다시 만듭니다.
3. 커밋·푸시하면 GitHub Pages가 자동 반영되고, 아티팩트는 `app.html`을 같은 URL로 다시 게시하면 주소가 유지됩니다.
