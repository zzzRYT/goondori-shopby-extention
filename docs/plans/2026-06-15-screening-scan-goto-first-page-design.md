# 심사 스캔 시작 시 1페이지부터 수집

날짜: 2026-06-15

## 문제

심사 스캔의 목록 수집기 `collectScreeningList`(`lib/shopby/screening/collect.ts`)는
**현재 그리드가 보여주는 페이지에서 시작**해 "다음 페이지" 방향으로만 순회한다.
어드민에서 3페이지를 보던 중 스캔하면 1~2페이지가 누락된다. 누락은 `count-mismatch`
(수집 행 수 ≠ 검색결과 총건수)로만 표면화될 뿐, 사용자가 의도한 "전체 심사"가 되지 않는다.

이미 브랜드 에디터 흐름(`brand-editor-open.ts`의 `findAcrossPages`)은 순회 전에
`gotoFirstPage`로 1페이지로 리셋하는 검증된 패턴을 가지고 있다. 심사 스캔에는 이 단계만 빠져 있다.

## 목표

스캔 시작 시 그리드를 **항상 1페이지로 리셋한 뒤** 1→2→…→끝까지 빠짐없이 수집한다.
(요구사항 해석 확정: "1페이지로 리셋 후 전체 수집")

## 접근 (옵션 1 — 로컬 헬퍼)

`collect.ts`에 로컬 `gotoFirstPage`를 추가한다. brand-editor의 패턴을 `collect.ts`의
타임아웃(`timeoutMs`/deadline) 모델에 맞춰 미러링한다.

- 공유 TUI 선택자 재사용: `BRAND_PAGINATION_SELECTOR`, `BRAND_PAGE_FIRST_SELECTOR`
- 이미 import된 `readSelectedPage` 재사용
- `collect.ts`가 자체적으로 가진 `waitForPageChange`(deadline 기반) 재사용

대안(채택 안 함):
- 옵션 2(brand-editor의 `gotoFirstPage` export 재사용): 옵션 타입이 brand-editor의
  `maxScrollSteps` 기반 대기에 묶여 collect의 `timeoutMs` 모델과 안 맞고, 심사 모듈이
  브랜드 모듈 내부에 의존하게 됨.
- 옵션 3(공유 페이지네이션 모듈 추출): 가장 DRY하지만 검증·테스트된
  `brand-editor-open.ts`를 건드려야 해 churn/리스크 대비 이득이 작음(YAGNI).

## 구현

수정 파일: `lib/shopby/screening/collect.ts` 한 곳.

1) import 추가:

```ts
import { BRAND_PAGINATION_SELECTOR, BRAND_PAGE_FIRST_SELECTOR } from '../selectors';
// readSelectedPage는 이미 '../brand-editor-open'에서 import 중
```

2) 로컬 헬퍼:

```ts
// 스캔 시작 시 현재 페이지가 어디든 1페이지로 되돌린다 — 1→끝까지 빠짐없이 수집하기 위함.
// 이미 1페이지면 first 컨트롤이 비활성(span)이라 셀렉터에서 빠져 no-op.
// best-effort: 전환 실패해도 스캔을 막지 않고 현재 위치에서 진행(기존 동작으로 graceful degrade).
async function gotoFirstPage(doc: Document, opts: Required<CollectOptions>): Promise<void> {
  const pager = doc.querySelector(BRAND_PAGINATION_SELECTOR);
  if (!pager) return;
  const first = pager.querySelector<HTMLElement>(BRAND_PAGE_FIRST_SELECTOR);
  if (!first || first.classList.contains('tui-is-disabled')) return;
  const before = readSelectedPage(pager);
  first.click();
  await waitForPageChange(doc, before, opts);
}
```

3) `collectScreeningList`에서 페이지 사이즈 전환 직후, 순회 루프 직전에 호출:

```ts
  await switchPageSizeTo200(doc, opts);
  await gotoFirstPage(doc, opts);   // ← 추가
  const totalCount = readTotalCount(doc);
```

### 설계 포인트

- **순서**: 페이지 사이즈 200 전환 시 보통 1페이지로 리로드되지만 항상 보장되진 않으므로
  `gotoFirstPage`로 명시적으로 확정한다.
- **`pagesVisited` 영향 없음**: `gotoFirstPage`는 위치만 옮기고 카운트는 기존 루프가 센다.
- **best-effort**: 전환 실패해도 throw하지 않는다.

## 테스트 (`lib/shopby/screening/collect.test.ts`)

기존 4개 테스트는 픽스처가 1페이지(`.tui-first` 비활성)라 그대로 통과한다.

추가:
1. **현재 2페이지여도 1페이지로 되돌린 뒤 수집한다** — 합성 그리드(선택페이지=2, first 활성).
   `.tui-first`에 click 핸들러를 붙여 SPA 재렌더(행 교체 + `tui-is-selected` 텍스트 2→1)를
   흉내내고, 수집 후 선택페이지가 1로 복귀했는지 + 1페이지 행이 수집됐는지 검증.
2. **이미 1페이지면 first 클릭 없음(no-op)** — `vi.spyOn`으로 first.click 미호출 검증.

회귀: `pnpm test`로 collect/run-scan/list-harvest 전체 green 확인.

## 영향 범위

- 동작 변경: 스캔이 항상 1페이지부터 전체를 수집 → `count-mismatch` 빈도 감소(정상).
- 위험: 낮음. 공유 선택자/기존 헬퍼 재사용, 1페이지 데이터셋에선 no-op, best-effort.
