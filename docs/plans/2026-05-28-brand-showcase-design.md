# 브랜드 진열 Preview — 설계

- 날짜: 2026-05-28
- 브랜치: `feature/brand`
- 작성 방식: `superpowers:brainstorming` 대화로 합의

## 배경

샵바이는 "특정 브랜드 몇 개만 골라서 앱 메인에 전시" 기능을 제공하지 않는다. MD는 브랜드의 `extraInfo`(추가 설명) 필드에 `c_<순번>` / `ct_<순번>` 토큰을 직접 입력해 우회 노출 슬롯을 정의하고 있다.

본 익스텐션은:

1. 사이드패널 **브랜드** 탭에서 그 노출 슬롯을 MO 앱과 동일한 가로 카루셀로 미리 보여준다 (read-only).
2. 샵바이 어드민의 브랜드 수정 페이지 `extraInfo` 입력란 아래에 토큰 문법 가이드를 inject한다.

## 결정 사항 요약

| 항목 | 결정 |
|---|---|
| 토큰 형식 | `c_<n>` (prod) / `ct_<n>` (dev), `n`은 노출 슬롯 순번 (1부터) |
| 환경 결정 | 패널 상단 수동 토글, 기본 prod |
| 썸네일 소스 | `displayAreaContentUrl` 필드 |
| 기능 성격 | read-only preview (편집 없음) |
| 슬롯 개수 | 가변 — 입력된 만큼만 표시 |
| 카테고리 칸 | mock 참고용, 범위 외 |
| 카루셀 | MO 앱과 동일한 가로 슬라이드 |
| 가이드 위치 | 어드민 브랜드 수정 페이지의 `extraInfo` 입력란 아래 |

## 1. 아키텍처와 데이터 플로우

### 파일 추가/수정

```
lib/shopby/
  api/
    brands.ts                ← 기존 그대로 (BrandPicker 전용, /display/brands 색인)
    brands-showcase.ts       (신규) /brands/search + /display/brands/search-by-nos
    brands-showcase.test.ts
  brand-extra-info.ts        (신규) extraInfo 파싱 + 슬롯 정렬 (순수 함수)
  brand-extra-info.test.ts
  brand-extra-info-guide.ts  (신규) 어드민 가이드 inject 로직
  brand-extra-info-guide.test.ts
  selectors.ts               (수정) EXTRA_INFO_TEXTAREA_SELECTOR 추가

entrypoints/sidepanel/ui/
  BrandShowcase.tsx          (신규) 브랜드 탭 컨테이너
  BrandShowcase.test.tsx
  BrandShowcaseCarousel.tsx  (신규) 가로 카루셀 + chevron
  BrandShowcaseCard.tsx      (신규) 썸네일 + 이름 + 슬롯 배지
  EnvToggle.tsx              (신규) prod / dev 세그먼트

entrypoints/content.ts       (수정) startExtraInfoGuide(document) 호출 추가
entrypoints/sidepanel/App.tsx (수정) 'brand' 탭 placeholder → <BrandShowcase />
```

### `brands-showcase.ts` 함수

- `searchAllBrands()` — `/brands/search` 페이지네이션으로 전체 brandNo 수집
- `fetchDisplayBrandDetails(brandNos: number[])` — `/display/brands/search-by-nos` 청크(`BRAND_DETAIL_CHUNK_SIZE = 100`) 병렬 호출, `extraInfo`/`displayAreaContentUrl`/`name`/`brandNo` 포함된 상세 반환
- `fetchShowcaseBrands(): Promise<ShowcaseBrand[]>` — 위 둘을 묶은 진입점

### 사이드패널 플로우

1. 탭 진입 → `BrandShowcase` 마운트, `useRemoteList(fetchShowcaseBrands)` 트리거
2. `searchAllBrands` → brandNo 배열 → 청크 분할 → `fetchDisplayBrandDetails`
3. `parseBrandSlots(entries, env)` → `SlotAssignment[]` (슬롯 ASC)
4. 가로 카루셀 렌더 (썸네일 = `displayAreaContentUrl`, 이름 = `name`)
5. `EnvToggle` 변경 시 3번부터 즉시 재계산 (네트워크 재요청 없음)

## 2. extraInfo 파싱과 슬롯 정렬

### 토큰 추출 정규식

```
/(?:^|[\s,;])(c|ct)_(\d+)(?=$|[\s,;])/g
```

- 단어 경계로 `c_1` vs `c_10` 정확히 분리
- `accounting_c_1` 같은 다른 prefix와 우연 매칭 방지
- 콤마·공백·세미콜론 구분자 허용

### 환경별 필터링

- prod 토글 → `c_<n>` 만
- dev 토글 → `ct_<n>` 만
- 한 브랜드가 두 환경 토큰 동시 보유 가능 (각 환경에서 다른 슬롯에 등장)

### 결과 타입

```ts
type SlotAssignment = { slot: number; brand: ShowcaseBrand };
parseBrandSlots(brands: ShowcaseBrand[], env: 'prod' | 'dev'): SlotAssignment[]
// 슬롯 ASC, 한 브랜드가 c_1·c_3을 가지면 두 슬롯에 모두 등장
```

### 엣지 케이스

| 케이스 | 동작 |
|---|---|
| `c_0`, `c_-1` | 무시 (n ≥ 1만 유효) |
| 같은 브랜드 중복 토큰 `c_1 c_1` | 슬롯 1에 한 번만 |
| 동일 슬롯 충돌 (A: c_1, B: c_1) | 둘 다 등장 + 카드에 ⚠ 충돌 배지 |
| 매칭 토큰 0건 | 결과에서 제외 |
| extraInfo null/빈 문자열 | 결과에서 제외 |

## 3. 사이드패널 UI

### 레이아웃

```
┌─ Brand 탭 ───────────────────────────────────────┐
│ [Prod] [Dev]                          [↻ 새로고침] │
│                                                  │
│ 운영(prod) 환경에 노출 설정된 브랜드 (6)            │
│                                                  │
│ ‹ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ›                │
│   │🖼│ │🖼│ │🖼│ │🖼│ │🖼│ │🖼│                  │
│   └──┘ └──┘ └──┘ └──┘ └──┘ └──┘                  │
│   브1   브2   브3   브4   브5   브6               │
│   c_1   c_2   c_3   c_4   c_5   c_6              │
└──────────────────────────────────────────────────┘
```

### 카루셀 (CSS 우선)

- 컨테이너: `overflow-x: auto; scroll-snap-type: x mandatory;`
- 카드: `flex: 0 0 auto; scroll-snap-align: start;` 고정 width
- 좌우 첫/끝 카드는 padding으로 시각 여백
- 스크롤바: `scrollbar-width: thin` 또는 숨김. 트랙패드/터치는 자연 스와이프

### 좌/우 chevron 버튼

- 콘텐츠 폭 > 컨테이너 폭일 때만 표시 (`ResizeObserver`)
- 클릭 시 한 카드 폭만큼 `scrollBy({ left: ±cardWidth, behavior: 'smooth' })`
- 양 끝 도달 시 해당 방향 `disabled`
- `aria-label="이전/다음 브랜드"`

### 키보드

- 카루셀 영역 포커스 시 ←/→로 한 카드 단위 이동
- 카드 자체는 read-only `div` (포커스 불필요)

### 카드

- 썸네일 + 이름 + 슬롯 배지(+ 충돌 시 ⚠)
- 이미지 로드 실패 → mock과 같은 회색 placeholder
- `loading="lazy"`, 명시적 width/height
- 클릭 동작 없음

### 상태별 화면

| 상태 | 표시 |
|---|---|
| idle/loading | 스켈레톤 카드 (mock과 동일한 placeholder 톤) |
| error | 에러 메시지 + `[다시 시도]` → `reload()` |
| success, 슬롯 0건 | `"운영 환경 노출 설정된 브랜드가 없습니다. shopby 어드민에서 c_1, c_2… 를 입력해 주세요."` |
| success, 슬롯 있음 | 카루셀 |

### 접근성

- 카루셀 컨테이너 `role="list"`, 카드 `role="listitem"`
- 썸네일 `alt`는 브랜드명, 슬롯 배지 `aria-label="노출 슬롯 1"`
- `EnvToggle`은 `role="group"` + 두 개의 `button[aria-pressed]`

## 4. 어드민 도움말 inject

### 진입점

기존 `entrypoints/content.ts`의 `main()`에 자동 inject 루틴 추가 (메시지 응답 없이 페이지 관찰).

```ts
main() {
  onMessage(...);  // 기존 4개
  startExtraInfoGuide(document);  // 신규
}
```

### `lib/shopby/brand-extra-info-guide.ts`

- `EXTRA_INFO_TEXTAREA_SELECTOR` — `lib/shopby/selectors.ts`에 정찰 후 추가 (예: `textarea[name="extraInfo"]`, 실제 selector는 구현 단계 정찰로 확정)
- `startExtraInfoGuide(root)` — MutationObserver로 textarea 등장 감시 (SPA 라우팅·iframe 재렌더 대응)
- textarea 발견 시 `injectGuideBelow(textarea)`
- 멱등성: `data-goondori-guide="extra-info"` 속성으로 중복 방지

### 가이드 노드

```html
<aside data-goondori-guide="extra-info" class="goondori-guide">
  <p class="goondori-guide__title">군돌이 브랜드 노출 가이드</p>
  <ul>
    <li><code>c_&lt;순번&gt;</code> — 운영(prod) 환경 노출 슬롯 (예: <code>c_1</code>, <code>c_2</code>)</li>
    <li><code>ct_&lt;순번&gt;</code> — 개발(dev) 환경 노출 슬롯 (예: <code>ct_1</code>, <code>ct_2</code>)</li>
  </ul>
  <p>콤마·공백·세미콜론으로 구분. 두 환경 동시 지정 가능.</p>
  <p>익스텐션의 <strong>브랜드</strong> 탭에서 실제 노출 모습을 미리 볼 수 있어요.</p>
</aside>
```

### 스타일링

- 어드민 페이지 CSS와 격리 — 자체 클래스 + scoped CSS 또는 인라인 스타일
- 옅은 배경 (예: `#f4f6fb`) + 좌측 컬러 바, 샵바이 톤과 충돌 없도록

### 호스트 가드

기존 `isShopbyAdminHost` 그대로 사용. 도움말은 textarea selector가 매칭되는 페이지에서만 inject.

## 5. 에러 처리·캐싱·테스트

### 캐싱

- `useRemoteList` 패턴 그대로 — 탭 진입 시 1회 fetch, 새로고침 버튼으로 수동 재요청
- 메모리 캐시만, 사이드패널 라이프사이클 동안 유지
- 청크 호출은 `Promise.all` 병렬, brandNo 키로 머지하여 순서 보존

### 에러

| 단계 | 동작 |
|---|---|
| `/brands/search` 실패 | `error` 상태 + `[다시 시도]`, 한국어 메시지 |
| `/display/brands/search-by-nos` 청크 일부 실패 | 전체 실패로 취급 (부분 결과는 오해 소지) |
| 이미지 로드 실패 | 카드 단위 placeholder, 다른 카드 영향 없음 |
| extraInfo 비어있음/매칭 0건 | 에러 아님 — 안내 문구만 |

### 테스트 (Vitest)

- `brand-extra-info.test.ts` — 토큰 파싱 5가지 (단어 경계, 환경 분리, 다중 슬롯, 충돌, 정렬)
- `brands-showcase.test.ts` — `searchAllBrands` 페이지네이션 종료, `fetchDisplayBrandDetails` 청크 분할·재조립, 부분 실패 전파 (`client.test.ts` 기존 mock 패턴 재사용)
- `BrandShowcase.test.tsx` — 로딩/에러/빈/충돌 상태, prod↔dev 토글 시 재조회 없이 즉시 재계산, 다시 시도, chevron 양 끝 disabled
- `brand-extra-info-guide.test.ts` — JSDOM: textarea 등장 시 1회 inject, 멱등, textarea 제거 시 정리

### 범위 외 (YAGNI)

- 슬롯 편집 (어드민 직접 입력으로 충분)
- 환경 자동 감지 (수동 토글)
- 카루셀 페이지네이션 dot
- 카테고리 칸
- 카드 클릭 이동 (read-only)
