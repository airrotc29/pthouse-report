# Supabase 연결 설계 (설계안 · 미연결)

소장 15명이 **각자 로그인해 월간보고 업로드와 일일보고 작성**을 하고, 본사는 전체를 보는 구조입니다.
아티팩트(claude.ai)는 외부 서버 호출이 막혀 있어, 연결 후에는 **GitHub Pages 주소**가 본 화면이 됩니다.

## 계정 정책
| 항목 | 내용 |
|---|---|
| 계정 단위 | 사업소당 1계정 (`sites.code` 가 아이디, 내부 이메일 `<코드>@pthouse.local`) |
| 초기 비밀번호 | **1234** |
| 첫 로그인 | `profiles.must_change_pw = true` → 비밀번호 변경 화면이 먼저 뜨고, 바꿔야 다음으로 진행 |
| 역할 | `manager`(소장, 자기 사업소만) / `hq`(본사, 전체) |
| 계정 생성 | 본사가 대시보드 또는 Edge Function 으로 생성 (`create-manager.sql` 참고). anon key 로는 불가 |

근거: 개인정보 보호법 제29조(안전조치의무), 개인정보의 안전성 확보조치 기준(개인정보보호위원회 고시) 제5조(접근 권한의 관리)·비밀번호 작성규칙.
`1234` 는 어디까지나 초기값이며 **변경 강제**가 전제입니다. 변경 시 최소 8자(영문·숫자 조합)를 앱에서 검사합니다.
소장 전화번호는 `profiles.phone` 에만 두고 본사와 본인만 읽습니다(RLS).

## 권한 (Row Level Security)
| 테이블 | 소장(manager) | 본사(hq) |
|---|---|---|
| sites | 읽기 | 읽기·쓰기 |
| profiles | 본인 행 읽기 | 전체 |
| reports | 자기 사업소 읽기·쓰기 | 전체 |
| dailies | 자기 사업소 읽기·쓰기 | 전체 |
| acks | 없음 | 전체 |

`public.auth_site()` 가 로그인 사용자의 사업소 키를 돌려주고, 정책이 `site_key = auth_site()` 로 막습니다.
앱 화면에서 가리는 것과 별개로 **DB 가 강제**하므로 소장이 다른 사업소 데이터를 쓸 수 없습니다.

## 화면 흐름
1. 로그인(아이디 · 비밀번호) → 2. `must_change_pw` 면 비밀번호 변경 → 3. 역할 분기
   - 소장 모드: 탭 = **일일보고 작성 · 월간보고 업로드 · 내 사업소 현황** (사업소 선택 고정)
   - 본사 모드: 지금 현황판 전체 + 사업소 목록에서 소장 계정 생성·초기화

## 데이터 매핑 (아티팩트 공유 저장소 → Supabase)
| 아티팩트 컬렉션 | 테이블 | 비고 |
|---|---|---|
| `sites/{key}` | `sites` | `code` 는 새로 부여 (영문·숫자 아이디) |
| `reports/{key}_{YYYY-MM}` | `reports` | 파싱 결과는 `data` jsonb 에 통째로 |
| `dailies/{key}_{YYYY-MM}.days[dd]` | `dailies` (사업소·일자당 1행) | `entry` jsonb = 일일보고 v2 항목 |
| `acks/{id}` | `acks` | |

앱의 `store` 는 메서드 이름이 같은 `adapter.js` 로 바꿔 끼웁니다(`makeSupabaseStore`). 일일보고 문서 묶음은 어댑터가 행 ↔ 문서로 변환하므로 화면 코드는 그대로입니다.

## 연결할 때 할 일 (체크리스트)
1. Supabase 프로젝트 생성 → SQL Editor 에서 `schema.sql` 실행
2. Authentication → Providers → Email: 가입 확인 메일 끔(Confirm email off), 가입 자체는 막음(Disable signup) — 계정은 본사가 만듦
3. 본사 계정 1개 생성 → `profiles` 에 `role='hq'` 로 등록
4. `app.html` 에 supabase-js 로드 + `SUPABASE_URL`, `SUPABASE_ANON_KEY` 설정, `store = makeSupabaseStore(...)`
5. 로그인 화면 · 비밀번호 변경 화면 · 소장 모드 탭 제한 추가
6. 아티팩트 데이터 이전: `reports` 7건, `sites` 15건 (스크립트로 일괄 insert)
7. 사업소 목록에서 15개 사업소의 `code` 지정 → 소장 계정 15개 생성(초기 1234)
8. 저장소 공개 여부: anon key 는 공개 전제이고 RLS 가 보호하므로 Pages 공개 운영 가능. 단 저장소를 비공개로 두려면 GitHub 유료 플랜 필요
