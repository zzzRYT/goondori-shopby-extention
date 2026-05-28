# 띠 배너 인라인 진열 선택기 — 사이드패널 배너 빌더 폐기

> 작성: 2026-05-28 · 대상: 사이드패널의 배너 관련 코드 전부 + 어드민 띠 배너 페이지 content script

## 1. 배경과 목표

**문제.** 띠 배너의 `accountName` input은 라벨이 "구좌명"이지만 실제로는
`ct_3_s_b_43215615` 같은 **진열 ID**가 들어가야 한다(`docs/recon.md` 81행).
MD가 이 ID를 외울 수 없어 가장 큰 페인이며, 사이드패널 배너 빌더의 다른 필드
(랜딩 URL · 노출 기간 · 사이즈)는 어드민에서 직접 입력해도 무리가 없다.

사이드패널 → 채우기 모델은 컨텍스트 스위치가 크고 한 번에 한 구좌만 처리한다.
어드민 페이지 안에서 input 옆에 직접 도우미를 두면 페인포인트만 정확히 해소된다.

**목표**

- 사이드패널의 배너 관련 UI · 로직 · 메시지 일괄 제거
- 띠 배너 어드민 페이지의 각 `accounts.{i}.accountName` input 옆에 "🔍 진열 선택"
  버튼을 인젝션해 클릭 시 진열 검색 팝오버로 ID를 채워주고, 입력된 ID에 대응하는
  진열명을 라벨로 옆에 표시(검증)
- 진열 빌더(진열 ID · 진열명 · 색상)와 색상 칩은 사이드패널 그대로 유지

**비목표**

- 메인 배너 자동화(전면 제외 — 가치 없음)
- 노출 기간 · 사용 여부 · 랜딩 URL 자동화
- 콘텐츠 추가 자동화
- 어드민 폼 양방향 동기화(읽기·구좌 순서 변경 등)

## 2. 아키텍처 개요

```
[현재]
사이드패널 BannerBuilder → "채우기" → background → content(fillBanner) → 어드민 input

[개편 후]
어드민 띠 배너 페이지 로딩
  → content script: AttachManager 시작
  → MutationObserver가 input[name$=".accountName"] 발견
  → 각 input 형제로 위젯 wrapper(shadow DOM) 인젝션
  → 사용자 버튼 클릭 → 팝오버 열림(SearchableSelect)
  → 진열 선택 → input.value = sectionId + input event dispatch
  → 진열명 라벨 표시
사이드패널: 진열 빌더 / 색상 칩만 유지(배너 탭 제거)
```

| 항목 | 결정 |
|---|---|
| 사이드패널 배너 빌더 | 완전 제거(메인·띠 모두) |
| 띠 배너 자동화 위치 | 어드민 페이지 인라인 (content script) |
| 도우미 트리거 | input 옆 버튼 + 클릭 시 팝오버 |
| 진열 데이터 출처 | 기존 `fetchSections` (Shop API) 재활용 |
| 부착 대상 | `input[name^="accounts."][name$=".accountName"]` |
| 일방향 채우기 메시지 | `fillBanner` 등 모두 제거 |
| 스타일 격리 | Shadow DOM + 내부 CSS |

## 3. 인라인 위젯 부착 메커니즘

**전제:** 어드민 헤드리스 배너 페이지는 `enterprise-remote.shopby.co.kr/appearance/custom/headless-banners/edit` iframe 내부 SPA. content script는 이미 해당 origin에 주입됨.

**셀렉터와 페이지 가드**

- 타겟 셀렉터: `input[name^="accounts."][name$=".accountName"]`
- 페이지 가드:
  - URL 매치: `/headless-banners/edit` 포함
  - 모드 가드: Phase 1 정찰 후 확정(헤더 텍스트 / 구좌 수 / 별도 라우트 중 하나).
    메인 배너에 같은 폼 구조가 섞여 있으면 부착 안 함.

**마운트 라이프사이클**

```
content script (enterprise-remote 매치)
  └ AttachManager 시작
      ├ MutationObserver: document.body 서브트리 감시
      ├ 매칭 input 발견 → WeakMap<HTMLInputElement, AnchorHandle>에 등록
      │   └ 형제로 <span class="ext-shopby-anchor"> 삽입
      │       └ attachShadow({mode: 'open'}) + createRoot + <SectionAnchor input={el} />
      └ input 제거 감지 → root.unmount() + WeakMap에서 제거
```

**값 채우기**

- 어드민이 React 기반이므로 `input.value = sectionId` 직접 할당만으로는 상태 반영 안 됨.
- React의 입력 setter를 거치도록:

```ts
const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
setter.call(input, sectionId);
input.dispatchEvent(new Event('input', { bubbles: true }));
```

- 이 패턴은 기존 채우기 유틸(`lib/dom/fill.ts` 추정)에 이미 있을 가능성 — Phase 3에서
  확인 후 재활용 or 신규 헬퍼 1개 추가.

**스타일 격리**

- Shadow DOM 사용 → 어드민 CSS 충돌 차단.
- 위젯 내부 스타일은 별도 CSS 모듈을 `<style>` 태그로 shadow root에 주입.
- 위젯이 어드민과 살짝 다른 톤으로 보이는 점은 **의도된 시각 시그널**(이 input은
  자유입력이 아니다)로 역이용.

**중복 부착 방지**

- `WeakMap<HTMLInputElement, { root: Root; anchor: HTMLElement }>`
- MutationObserver 콜백에서 이미 등록된 input은 스킵.

## 4. 위젯 UX와 데이터 흐름

**구성 (`<SectionAnchor input={el}>`)**

```
[ input value ]  [🔍 진열 선택]  → 진열명 라벨
                  ↑                  ↑
                  버튼                value 변경 감시
                  ↓
                  팝오버 (열림 시)
                  ┌──────────────────┐
                  │ 검색 ▢            │
                  │ ────────────     │
                  │ OO 매대   ct_…43 │
                  │ ×× 매대   ct_…21 │
                  │ △△ 매대   ct_…84 │
                  └──────────────────┘
```

**진열명 라벨(검증)**

- input value 변경 → 진열 목록에서 sectionId 매칭해 sectionName 표시.
- 일치 없음 → 경고 톤(예: `?` 표식 또는 빨간 점). MD가 잘못된 ID를 즉시 인지.
- 빈 값 → 라벨 숨김.

**진열 데이터 캐싱**

- 첫 위젯 마운트 시 `fetchSections` 1회 호출.
- content script 전역 캐시(singleton)에 저장 → 같은 페이지의 모든 위젯이 공유.
- 페이지 이탈 시 리셋(자연스러운 라이프사이클 — 매니저 dispose).
- v1에서는 수동 새로고침 옵션 생략.

**팝오버 동작**

- 버튼 클릭 → 팝오버 열림 + 검색 input 자동 포커스.
- 키보드: `Esc` 닫기, `↑/↓` 이동, `Enter` 선택.
- 항목 클릭/Enter → input 채우기 + dispatchEvent + 팝오버 닫힘.
- 외부 클릭 → 닫힘.
- 포지셔닝: anchor 기준 `position: absolute`. 화면 우측 잘림 시 좌측 정렬로 자동
  스왑(간단한 boundary check).

**컴포넌트 재활용**

- `SearchableSelect`는 검색 · 키보드 · 로딩/에러 상태가 이미 처리됨 → 그대로 사용.
- 다만 사이드패널 CSS에 묶여 있으므로 shadow DOM 안에서 동작하도록 CSS 분리(혹은
  내부 클래스 그대로 두고 위젯 CSS에서 동일 클래스 재정의).

**에러/엣지 케이스**

- `fetchSections` 실패 → 팝오버 안에 에러 메시지 + 재시도 버튼.
- 어드민 input이 disabled → 위젯 버튼도 disabled.
- 진열 목록 비어 있음 → "진열 없음" 메시지.
- 진열이 200+개라도 SearchableSelect 검색 필터로 충분 — 가상화는 v1 제외.

## 5. 파일 변경 명세

**신규**

| 파일 | 책임 |
|---|---|
| `entrypoints/content/banner-anchor/index.ts` | URL 가드, AttachManager 시작 |
| `entrypoints/content/banner-anchor/AttachManager.ts` | MutationObserver + WeakMap, 마운트/언마운트 |
| `entrypoints/content/banner-anchor/SectionAnchor.tsx` | 위젯 React 컴포넌트(버튼·팝오버·라벨) |
| `entrypoints/content/banner-anchor/sectionsCache.ts` | content script 전역 진열 캐시 |
| `entrypoints/content/banner-anchor/style.css` | shadow DOM 내부 스타일 |
| `entrypoints/content/banner-anchor/AttachManager.test.ts` | 부착/언부착·중복방지·재렌더 시뮬레이션 |
| `entrypoints/content/banner-anchor/SectionAnchor.test.tsx` | 버튼·팝오버·검색·선택·라벨·키보드 |

**수정**

| 파일 | 변경 |
|---|---|
| `entrypoints/content.ts` | banner-anchor 모듈 import + 시작; `onMessage('fillBanner', …)` 제거 |
| `entrypoints/background.ts` | `fillBanner` 라우팅 제거 |
| `lib/messaging.ts` | `fillBanner` 항목 제거 |
| 사이드패널 라우팅(`Tabs.tsx` 등) | "배너" 탭 제거 |
| `entrypoints/sidepanel/style.css` | 배너 빌더 전용 클래스 정리 |
| `wxt.config.ts` | content matches/permissions — 변동 없음 |

**삭제**

- `entrypoints/sidepanel/ui/BannerBuilder.tsx` + `.test.tsx`
- `lib/shopby/banner-radios.ts` + 테스트
- 사용 안 되는 배너 fixture(`tests/fixtures/admin-banner-*.html`)

`FillButton.tsx`는 진열 빌더에서 사용 중이므로 **유지**.

## 6. 실행 순서

**Phase 1 — 정찰 (코드 변경 0)**

띠 배너 페이지에서 두 가지 확인 후 `docs/recon.md` 업데이트:

1. 메인·띠가 같은 URL인지 다른 페이지인지.
2. 띠 모드 판별 시그널(헤더 텍스트 / 구좌 수 / 별도 라우트).

이 결과가 Phase 3 `index.ts`의 페이지 가드 조건을 결정.

**Phase 2 — 사이드패널 배너 제거 (순수 삭제)**

1. 라우팅에서 배너 탭 제거.
2. `BannerBuilder.tsx` + `.test.tsx` 삭제.
3. `lib/shopby/banner-radios.ts` + 테스트 삭제.
4. `lib/messaging.ts` — `fillBanner` 제거.
5. `entrypoints/background.ts` — `fillBanner` 핸들러 제거.
6. `entrypoints/content.ts` — `fillBanner` 핸들러 제거, 미사용 fixture 정리.
7. `pnpm tsc --noEmit` + `pnpm vitest run` 그린.

**Phase 3 — 인라인 위젯 (TDD)**

1. RED: `sectionsCache.test.ts` — 1회 페치, 다중 호출 시 캐시 공유.
2. GREEN: `sectionsCache.ts`.
3. RED: `SectionAnchor.test.tsx` — 버튼·팝오버·검색·선택·라벨·키보드.
4. GREEN: `SectionAnchor.tsx` (shadow DOM + SearchableSelect 재사용).
5. RED: `AttachManager.test.ts` — 마운트/언마운트·중복방지·input 제거 시 정리.
6. GREEN: `AttachManager.ts`.
7. `index.ts` — Phase 1 정찰 결과로 페이지 가드 작성.
8. `entrypoints/content.ts` — banner-anchor 시작.

**Phase 4 — 수동 검증**

| 시나리오 | 기대 |
|---|---|
| 띠 배너 페이지 진입 | 각 구좌의 `accountName` input 옆에 "🔍 진열 선택" 버튼 |
| 버튼 클릭 | 팝오버 열림, 검색·키보드 동작 |
| 진열 선택 | input에 ID 자동 입력 + 어드민 SPA 인지 + 저장 시 정상 반영 + 진열명 라벨 |
| 잘못된 ID 수동 입력 | 라벨 경고 톤 |
| 페이지 이동 후 복귀 | 위젯 중복 부착 없음 |
| 메인 배너 페이지(있다면) | 위젯 부착 안 됨 |
| 진열 빌더 / 색상 칩 | 기존대로 정상 동작 |

**검증 명령**

```bash
pnpm tsc --noEmit
pnpm vitest run
grep -rn 'fillBanner\|BannerBuilder\|banner-radios' lib entrypoints   # 빈 결과
```

## 7. 리스크 & 완화

| 리스크 | 완화 |
|---|---|
| 어드민 SPA가 input value 직접 할당 무시 | React-friendly setter + `input` 이벤트 dispatch |
| 메인 배너에도 위젯 부착(오탑재) | Phase 1 정찰로 정확한 페이지 가드 |
| Shadow DOM 안에서 SearchableSelect CSS 미적용 | 위젯 전용 CSS를 shadow root에 주입 + 시각 검증 |
| 진열 200+개일 때 팝오버 성능 | 검색 필터로 충분; 가상화는 v1 제외 |
| 어드민 input 제거/재생성 사이클이 잦을 때 깜빡임 | WeakMap + 디바운스된 부착 처리 |
| 진열 API 실패 | 팝오버 안 에러 + 재시도; 위젯은 유지(MD가 ID 직접 입력 가능) |
