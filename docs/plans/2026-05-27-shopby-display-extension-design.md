# 샵바이 진열·배너 관리 크롬 익스텐션 — 설계

- 작성일: 2026-05-27
- 상태: 설계 확정 (구현 전)
- 원본 스펙: [`shopby-display.md`](../../shopby-display.md)

## 1. 목적

MD가 샵바이(ShopBy) 스토어 홈의 **상품 진열**과 **배너**를 관리할 때, 어드민에서 직접
손으로 입력하던 작업을 크롬 익스텐션이 보조한다. 두 가지가 핵심이다.

1. **진열 ID 생성·검증 보조** — `c_1_p_t_병부장` 같은 구조화된 ID와 `단어#HEX` 색상 문구를
   폼으로 조립하고, 잘못된 형식을 입력 단계에서 잡는다.
2. **메인/띠 배너 등록을 쉽게 하는 관리 콘솔** — 배너 폼 작성을 돕고 어드민 필드에 채워준다.

사용자는 ID나 색상 문구를 **직접 타이핑하지 않는다.** 폼으로 만들고, 기존 값을 붙여넣으면
역파싱해 폼을 복원한다.

## 2. 확정된 제약·결정

| 항목 | 결정 |
| --- | --- |
| 프레임워크 | **WXT** (Vite 기반 웹 익스텐션 프레임워크) + React + TypeScript |
| 연동 방식 | 샵바이 어드민 페이지 **DOM 자동화** (content script) |
| UI 위치 | 크롬 **사이드 패널** |
| 자동화 강도 | **필드 채우기만, 최종 저장은 사람이 클릭** (운영 스토어 안전장치) |
| 영속 상태 | **브랜드 이름↔번호 매핑만** 로컬 저장 (초안/템플릿/팀공유는 v1 제외) |
| 브랜드 소스 | API 우선 → 어드민 브랜드 페이지 DOM 읽기 → 수동 입력 (3단 폴백) |
| 셀렉터 | 실제 어드민 HTML 제공받아 확정 (셀렉터 매핑 레이어로 격리) |

## 3. 아키텍처 & 프로젝트 구조

WXT 파일 기반 엔트리포인트로 3개 실행 컨텍스트를 둔다.

```text
goondori-shopby-extension/
├── wxt.config.ts              # manifest: side_panel, sidePanel 권한, host_permissions(샵바이 어드민)
├── entrypoints/
│   ├── sidepanel/             # 관리 콘솔 UI (React) — 사용자가 보는 메인 화면
│   │   ├── index.html
│   │   ├── App.tsx
│   │   └── ui/                # 진열 빌더, 배너 폼 컴포넌트
│   ├── content.ts             # 어드민 페이지에 주입 — DOM 읽기/채우기 실행자
│   └── background.ts          # 사이드패널 열기, 탭↔패널 메시지 중계
├── lib/
│   ├── display-id/            # ★ 핵심 도메인: ID 파싱·조립·검증 (순수 TS, DOM 무관)
│   ├── shopby/                # 셀렉터 매핑 + 페이지 어댑터 + 브랜드 소스 (HTML/API 받으면 확정)
│   ├── messaging.ts           # @webext-core/messaging 타입 정의
│   └── storage.ts             # storage.defineItem (브랜드 매핑)
└── tests/
```

### 핵심 분리 원칙

진열 ID·색상 규칙 같은 **도메인 로직(`lib/display-id`)은 DOM·브라우저 API와 완전히 분리된
순수 함수**로 둔다. 가장 테스트하기 쉽고, 샵바이 UI가 바뀌어도 영향받지 않는다. DOM에
의존하는 부분(`lib/shopby` 셀렉터)만 따로 격리해 변경에 대비한다.

### 역할 분담

- **사이드패널**: 모든 입력·검증·미리보기. 사용자는 여기서만 작업.
- **content script**: "이 필드에 이 값을 채워라" 명령을 받아 DOM 조작. **저장 버튼은 안 누름.**
- **background**: 툴바 아이콘 클릭 시 사이드패널 열기, 현재 어드민 탭과 패널 연결.

## 4. 도메인 모델

진열 타입에 따라 상세값이 달라지므로 **판별 유니온(discriminated union)** 으로 모델링한다.

```ts
type Env = 'c' | 'ct';                          // 운영 | 테스트
type Method = 'p' | 's';                        // 페이지네이션 | 스와이프
type UserTypeChar = '병' | '곰' | '가' | '지' | '부' | '장' | '팬';

type DisplaySpec =
  | { env: Env; order: number; method: Method; type: 't'; userTypes: UserTypeChar[] }
  | { env: Env; order: number; method: Method; type: 'b'; brandNo: string }
  | { env: Env; order: number; method: Method; type: 'n'; label: string };

// 순수 함수
buildDisplayId(spec: DisplaySpec): string                 // spec → "c_1_p_t_병부장"
parseDisplayId(id: string): Result<DisplaySpec, Issue[]>  // 역방향 + 검증
```

색상 규칙도 순수 함수로 둔다.

```ts
parseColorSpec("군인#008000, 꿀템#FFFF00"): Result<ColorRule[], Issue[]>
// + 진열명에 실제 존재하는 단어인지 교차검증 (문서 2-3 ⚠️ 규칙)
```

진열명 예약어 `{이름}` 치환은 미리보기에서만 처리한다(앱이 런타임 치환하므로 저장값에는 유지).

## 5. 사이드패널 컴포넌트

- **`DisplayBuilder`** — 환경 토글 / 순서 / 표시방법 라디오 / 타입 라디오 → 타입별 상세 입력
  (사용자유형 **칩 토글**, 브랜드 **검색-선택**, 일반 라벨). 하단에 **라이브 ID 미리보기 +
  검증 배지**. 기존 ID 붙여넣기 시 역파싱해 폼 복원.
- **`TitleEditor`** — 진열명 입력 + `{이름}` 치환 미리보기, 색상 매핑 칩, 실제 색이 칠해진
  결과 프리뷰.
- **`BannerForm`** — 탭(메인배너/띠배너). 띠배너의 `구좌명`은 자유입력이 아니라 **진열 ID
  선택/검증**으로 묶어 헷갈림 방지(문서 핵심 차이). 메인배너는 16:9/3:2 중 하나만 사용 규칙 반영.
- **`BrandMap`** — 이름↔번호 CRUD + "어드민에서 가져오기" 버튼.
- **`FillButton`** — "어드민에 채우기" → content script로 명령 전송.

## 6. 데이터 흐름

### (A) 채우기 플로우 — 사이드패널 → 어드민 페이지

```text
사용자: 폼 완성 → 검증 통과 → [어드민에 채우기]
  → sidepanel: sendMessage('fillDisplay', { fields })
  → background: 활성 샵바이 어드민 탭 찾아 content script로 중계
  → content: lib/shopby 어댑터가 셀렉터로 input/select 찾아
             값 주입 + 네이티브 input/change 이벤트 dispatch
  → content: 채운 필드 + 실패한 필드 목록을 응답으로 반환
  → sidepanel: "채움 5 · 실패 1 (위치 명시)" 리포트
```

저장 버튼은 누르지 않는다. 사용자가 페이지에서 직접 확인 후 저장.

> **이벤트 강제 발생**: 단순 `.value =` 만으로는 샵바이 프론트엔드 프레임워크(React/Vue 등)가
> 값 변경을 인식하지 못한다. `el.dispatchEvent(new Event('input', { bubbles: true }))` /
> `'change'` 를 함께 발생시킨다.

### (B) 역파싱 플로우 — 어드민 → 사이드패널 (수정 시)

기존 진열 수정 시 content script가 현재 페이지의 진열 ID/진열명 필드를 **읽어서** 패널로
보낸다 → `parseDisplayId`로 폼 자동 복원 → 일부만 고치고 다시 채움.

### (C) 브랜드 매핑 — 3단 폴백 소스 + 로컬 캐시

```ts
interface BrandSource { fetchBrands(): Promise<BrandEntry[]>; }   // { name, brandNo }
// 구현체: ShopbyApiBrandSource → AdminPageBrandSource(DOM) → (수동은 storage 직접)
// 폴백 체인: API 시도 → 실패/부재 시 페이지 스크랩 → 결과를 storage 캐시
const brandMap = storage.defineItem<BrandEntry[]>('local:brandMap', { fallback: [] });
```

**브랜드 매핑은 편의용 조회 레이어이지 필수 의존성이 아니다.** ID에 실제로 필요한 값은
브랜드 **번호**뿐이며, 이 번호는 항상 직접 입력 가능하다.

- 매핑이 비어 있어도 → 번호 직접 입력으로 ID 정상 생성 (아무것도 안 막힘).
- 매핑이 있으면 → 이름 검색 → 번호 자동 입력.
- 검색 결과 없음 → "매핑에 없음, 번호 직접 입력" 안내 + 그 자리에서 추가 가능.

실제 API 존재 여부는 **구현 1단계 정찰**에서 확인한다(브랜드 페이지 네트워크 탭에서 목록 XHR
탐색). 있으면 API 소스, 없으면 DOM 스크랩 소스. 어느 쪽이든 `BrandEntry[]`로 정규화.

### 메시징 계약

`lib/messaging.ts`에 타입으로 한 곳에 정의(`@webext-core/messaging`) → 패널·content·background가
같은 타입 공유.

## 7. 검증 & 에러 처리

### 입력 단계 검증 (도메인 레이어, DOM 가기 전)

- 진열 ID: 환경(`c`/`ct`), 순서(≥1 정수), 표시방법(`p`/`s`), 타입(`t`/`b`/`n`), 타입별 상세
  — 사용자유형은 7개 문자 외 차단, 브랜드는 숫자만, 일반은 자유.
- 색상 규칙: `단어#HEX` 형식 + HEX 유효성 + **진열명에 존재하는 단어인지** 교차검증 →
  없으면 "무시됨" **경고**(차단 아님).
- 결과는 `Result<T, Issue[]>`, 각 Issue는 `field` + `severity('error' | 'warn')` + 메시지.

### DOM 채우기 단계 — 부분 실패 위치 표기

채울 수 있는 건 채우되, **실패한 필드를 위치까지 짚어준다.** 부분 실패를 허용하고 넘어가는
게 아니라 드러내서 사람이 끝맺게 한다.

- 못 찾은/못 채운 필드 → 사이드패널 리포트에 **필드명 + 사유** 나열
  (예: `노출기간` — 셀렉터 미발견).
- 동시에 **페이지에서도 위치 표시** — 채운 필드는 잠깐 초록 하이라이트, 실패 지점은
  빨강 테두리/마커.
- 결과를 "완료"로 뭉뚱그리지 않고 항상 **"채움 N · 실패 M (위치 명시)"** 형태로.
- 샵바이 어드민 페이지가 아닌 곳에서 채우기 시도 → "샵바이 어드민 페이지에서 열어주세요" 안내.

## 8. 테스트 전략

### 도메인 로직 (`lib/display-id`) — 단위 테스트, 커버리지 집중 (80%+)

- `buildDisplayId` ↔ `parseDisplayId` 왕복(round-trip): spec → ID → spec 동일성.
- 문서 예시 4개(`c_1_p_t_병`, `c_2_p_t_병부장`, `c_3_p_n_베스트`, `ct_4_s_b_43215615`)를
  테이블 케이스로.
- 경계값: 순서 0/음수/소수, 잘못된 환경 접미사, 사용자유형 외 문자, 빈 브랜드 번호.
- 색상 규칙: 진열명에 없는 단어 → warn, 잘못된 HEX → error.

### 셀렉터 어댑터 (`lib/shopby`) — JSDOM 통합 테스트

- 제공받은 어드민 HTML 스냅샷을 픽스처로, 어댑터가 필드를 찾아 값+이벤트를 넣는지 검증.

### E2E (Playwright) — 핵심 흐름만 얇게

- 사이드패널 폼 작성 → 검증 배지 → 채우기 → (mock 어드민 페이지에서) 필드 채워짐 +
  실패 위치 표기 확인.
- 라이브 운영 어드민에는 E2E 미실행.

도구: **Vitest**(단위/통합) + **Playwright**(E2E). WXT는 Vitest 통합을 공식 지원.

## 9. 구현 순서 (제안)

1. **정찰 & 셋업** — WXT 프로젝트 스캐폴드, 어드민 HTML 스냅샷 확보, 브랜드 API 존재 확인.
2. **도메인 코어** — `lib/display-id` (build/parse/검증 + 색상 규칙) TDD로. 가장 가치 높고
   DOM 무관해 먼저 끝낼 수 있다.
3. **사이드패널 UI** — `DisplayBuilder` + `TitleEditor` (라이브 미리보기·검증 배지).
4. **셀렉터 어댑터 + 채우기** — `lib/shopby` + content script + 메시징, 부분 실패 위치 표기.
5. **브랜드 소스** — 3단 폴백 + `BrandMap` UI.
6. **배너 폼** — 메인/띠 배너, 띠배너 진열 ID 연결.
7. **E2E + 마감**.

## 10. v1 범위 밖 (YAGNI)

- 진열/배너 초안 저장, 재사용 템플릿
- 팀 간 공유(chrome.storage.sync / 외부 저장)
- 저장 버튼 자동 클릭 (완전 자동화)
- 현황 대시보드(전체 진열 조회·시각화)
