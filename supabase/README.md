# Supabase 연결 (코드 준비 완료 · 설정값만 입력하면 동작)

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

## 연결 순서 (본사 담당자)
1. https://supabase.com 에서 프로젝트 생성 (무료, 리전 Northeast Asia 권장)
2. **SQL Editor → New query** 에 `schema.sql` 전체를 붙여 넣고 Run
3. 같은 방법으로 `migrate.sql` Run (사업소 15 · 월간보고 7 · 일일보고 1 · 확인 기록 1 이 들어감)
4. **Authentication → Providers → Email**: `Confirm email` 끔. **Authentication → Settings**: `Allow new users to sign up` 끔 (계정은 본사만 만듦)
5. **Authentication → Users → Add user → Create new user**
   - 본사: Email `hq@pthouse.local`, Password `1234`, `Auto Confirm User` 체크
   - 소장: Email `<아이디>@pthouse.local` (예 `garim@pthouse.local`), Password `1234`, Auto Confirm 체크
   - 아이디는 `migrate.sql` 에 넣어 둔 값(garim, namsan, dasan, unjeong, firstcity, pyeongtaek, heuros, site08~site15)이며, 업로드 탭 → 사업소 목록에서 바꿀 수 있음. 계정을 만들면 트리거가 사업소와 자동으로 연결함
6. **Project Settings → API** 의 `Project URL` 과 `anon public` 키를 `config.js` 에 입력 → 커밋·푸시 (또는 Claude 에게 전달)
7. https://airrotc29.github.io/pthouse-report/ 접속 → `hq` / `1234` 로그인 → 비밀번호 변경 → 전체 화면 확인
8. 소장에게 아이디와 초기 비밀번호 `1234` 전달. 첫 로그인 때 변경 화면이 뜸

## 동작 방식
- `index.html`(Pages)이 `supabase-js` 와 `config.js` 를 읽고, URL·키가 있으면 로그인 화면을 먼저 띄움. 비어 있으면 브라우저 저장 모드.
- 소장 모드: 탭 = 일일보고 · 업로드 · 사업소별. 사업소 선택은 자기 사업소로 고정, 다른 사업소 보고서 파일은 저장 거부. 작성자는 프로필 이름으로 미리 채움
- 본사 모드: 전체 현황판 + 업로드 탭 사업소 목록에서 **로그인 아이디(code)** 지정·변경
- 비밀번호 변경: 헤더의 "비밀번호" 버튼. 규칙 8자 이상 · 영문+숫자, 초기값 1234 로는 설정 불가
- 데이터 변경은 실시간 구독으로 다른 사용자 화면에 반영됨

## 아티팩트(claude.ai)와의 관계
아티팩트는 외부 서버 호출이 막혀 있어 Supabase 에 연결되지 않습니다. 연결 후에는 Pages 주소가 본 화면이고, 아티팩트에는 연결 전 데이터가 남습니다.
