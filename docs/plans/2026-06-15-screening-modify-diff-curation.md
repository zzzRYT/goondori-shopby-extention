# 수정 심사 diff 큐레이션 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 수정 심사(변경 전/후) 상품을 스캔에 포함시켜 타임아웃을 없애고, 변경 내역(diff)을 규칙 평가 없이 무조건 노출하며, 결과 패널에서 등록/수정을 세그먼트 필터로 분리한다.

**Architecture:** 팝업 파서가 DOM 구조(`변경 전/후` 헤더 유무)로 등록/수정을 self-describing 판별한다. 수정은 변경 행만 diff로 뽑고(규칙 평가 없음), 등록은 기존 경로 유지. 결과 타입에 `kind`/`changes`를 더하고 UI에 세그먼트 필터를 추가한다. `collect.ts`·`rules.ts`는 손대지 않는다.

**Tech Stack:** TypeScript, WXT(브라우저 확장), React 19, Vitest + jsdom + Testing Library.

**설계 문서:** `docs/plans/2026-06-15-screening-modify-diff-curation-design.md`

**명령어:**
- 단일 파일 테스트: `pnpm vitest run <path>`
- 전체 테스트: `pnpm test:run`
- 타입체크: `pnpm compile`

---

## Task 1: 수정 팝업 픽스처 추가

테스트 자산. 이후 파서 테스트가 이 파일을 로드한다.

**Files:**
- Create: `tests/fixtures/admin-screening-popup-modify.html`

**Step 1: 픽스처 작성**

사용자가 제공한 실제 수정 팝업 HTML 기반. `판매정보`(가격 변경 2행) + `이미지정보`(이미지 변경 1행, 텍스트 빈 케이스) + `별도 승인거부 의견`(diff 아님 — 제외 검증용)을 담는다.

```html
<html lang="ko"><head><meta charset="utf-8"><title>shop by</title></head>
<body>
<div id="root"><div class="Layout_content-layout-container">
<header class="Layout_content-layout-header">상품심사</header>
<main><div class="Layout_content-bottom">
<div class="Tab_box product-screening_tabs">
<ul class="Tab_tabs"><li class="Tab_tab Tab_on">상품등록정보 심사</li><li class="Tab_tab">직전 상품심사 결과</li></ul>

<section class="Layout_section-layout"><div class="Layout_view-title__ZDIpZ">판매정보 </div>
<div class="Layout_content-body"><table class="TableV2_table-layout-container">
<tbody class="TableV2_table-layout-body">
<tr><th>항목</th><th>변경 전 등록정보</th><th>변경 후 등록정보</th><th>수정필요항목</th></tr>
<tr><td>즉시할인</td><td>15,000원</td><td>20,000원</td><td class="table_center"><label class="checkbox"><input type="checkbox" value=""></label></td></tr>
<tr><td>즉시할인가</td><td>24,900원</td><td>19,900원</td><td class="table_center"></td></tr>
</tbody></table></div></section>

<section class="Layout_section-layout"><div class="Layout_view-title__ZDIpZ">이미지정보 </div>
<div class="Layout_content-body"><table class="TableV2_table-layout-container">
<tbody class="TableV2_table-layout-body">
<tr><th>항목</th><th>변경 전 등록정보</th><th>변경 후 등록정보</th><th>수정필요항목</th></tr>
<tr><td>상품이미지</td><td><img src="//cdn/before.jpg"></td><td><img src="//cdn/after.jpg"></td><td class="table_center"><label class="checkbox"><input type="checkbox" value=""></label></td></tr>
</tbody></table></div></section>

<section class="Layout_section-layout"><div class="Layout_view-title__ZDIpZ">별도 승인거부 의견 </div>
<div class="Layout_content-body"><table class="TableV2_table-layout-container">
<tbody class="TableV2_table-layout-body">
<tr><td>수정필요</td><td colspan="1"><span class="textarea-field full"><textarea class="table_textarea" maxlength="500" placeholder="..."></textarea></span></td></tr>
</tbody></table></div></section>

</div></div></main>
<footer class="Layout_content-layout-footer"><div class="submit-btn-wrap">
<button class="btn red lg">판매승인</button><button class="btn gray lg">승인거부</button><button class="btn black lg">취소</button>
</div></footer>
</div></div>
</body></html>
```

**Step 2: 커밋**

```bash
git add tests/fixtures/admin-screening-popup-modify.html
git commit -m "test: 수정 심사 팝업 픽스처 추가"
```

---

## Task 2: 수정 파서 `parseScreeningChanges` + 타입

순수 함수 추가(기존 경로 무변경). 빌드 green 유지.

**Files:**
- Modify: `lib/shopby/screening/types.ts` (타입 추가)
- Modify: `lib/shopby/screening/popup-parser.ts` (`parseScreeningChanges` + helper)
- Test: `lib/shopby/screening/popup-parser.test.ts` (describe 블록 추가)

**Step 1: 타입 추가 (`types.ts` 끝에)**

```ts
// 수정 심사 팝업의 변경 1건. before/after는 텍스트 비교(이미지 변경은 '(이미지)' 플레이스홀더).
export type ScreeningChange = {
  section: string;
  label: string;
  before: string;
  after: string;
};

// 팝업 파싱 결과의 판별 유니온 — 팝업 구조가 종류를 self-describing 한다.
export type ParsedScreening =
  | { kind: 'register'; product: ParsedScreeningProduct }
  | { kind: 'modify'; changes: ScreeningChange[] };
```

**Step 2: 실패 테스트 작성 (`popup-parser.test.ts`에 describe 추가)**

파일 상단 import에 `parseScreeningChanges` 추가:
```ts
import { parseScreeningChanges, parseScreeningDocument, waitForScreeningParse } from './popup-parser';
```

```ts
describe('parseScreeningChanges (admin-screening-popup-modify.html 픽스처)', () => {
  it('변경 전/후 헤더 테이블의 행을 diff로 파싱한다', () => {
    const doc = loadFixture('admin-screening-popup-modify.html');

    const changes = parseScreeningChanges(doc);

    expect(changes).not.toBeNull();
    expect(changes).toContainEqual({ section: '판매정보', label: '즉시할인', before: '15,000원', after: '20,000원' });
    expect(changes).toContainEqual({ section: '판매정보', label: '즉시할인가', before: '24,900원', after: '19,900원' });
  });

  it('이미지 변경 행은 텍스트가 없어 (이미지) 플레이스홀더로 남긴다 (침묵 누락 금지)', () => {
    const doc = loadFixture('admin-screening-popup-modify.html');

    const changes = parseScreeningChanges(doc);

    expect(changes).toContainEqual({ section: '이미지정보', label: '상품이미지', before: '(이미지)', after: '(이미지)' });
  });

  it('별도 승인거부 의견(변경 전/후 헤더 없음) 행은 제외한다', () => {
    const doc = loadFixture('admin-screening-popup-modify.html');

    const changes = parseScreeningChanges(doc);

    expect(changes!.some((c) => c.label === '수정필요')).toBe(false);
  });

  it('등록 팝업(변경 전/후 헤더 없음)은 null', () => {
    const doc = loadFixture('admin-screening-popup.html');

    expect(parseScreeningChanges(doc)).toBeNull();
  });

  it('변경 전/후 헤더만 있고 데이터 행이 없으면 null (렌더 미완료)', () => {
    const html = `<html><body><div>
      <div class="Layout_view-title__x">판매정보</div>
      <table><tr><th>항목</th><th>변경 전 등록정보</th><th>변경 후 등록정보</th></tr></table>
    </div></body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    expect(parseScreeningChanges(doc)).toBeNull();
  });
});
```

**Step 3: 테스트 실패 확인**

Run: `pnpm vitest run lib/shopby/screening/popup-parser.test.ts`
Expected: FAIL — `parseScreeningChanges is not a function`

**Step 4: 구현 (`popup-parser.ts`)**

import에 `ScreeningChange` 추가:
```ts
import {
  SCREENING_SECTIONS,
  type ParsedScreeningProduct,
  type ScreeningChange,
  type ScreeningImages,
  type ScreeningPopupResult,
} from './types';
```

`parseScreeningDocument` 아래에 추가:
```ts
const CHANGE_HEADER_RE = /변경 전|변경 후/;

// 수정 심사 팝업: '변경 전/후' 헤더를 가진 섹션 테이블만 골라 행별 diff를 만든다.
// 그런 테이블이 하나도 없으면(등록 팝업이거나 렌더 전) null — 폴링이 계속된다.
export function parseScreeningChanges(doc: Document): ScreeningChange[] | null {
  const changes: ScreeningChange[] = [];

  for (const titleEl of doc.querySelectorAll(SECTION_TITLE_SELECTOR)) {
    const table = titleEl.parentElement?.querySelector('table');
    if (!table || !hasChangeHeader(table)) continue;

    const section = normalize(titleEl.textContent);
    for (const row of table.querySelectorAll('tr')) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) continue; // th 헤더 행/비-diff 행 스킵
      const label = normalize(cells[0].textContent);
      if (!label) continue;
      changes.push({ section, label, before: cellText(cells[1]), after: cellText(cells[2]) });
    }
  }

  return changes.length > 0 ? changes : null;
}

function hasChangeHeader(table: Element): boolean {
  for (const th of table.querySelectorAll('th')) {
    if (CHANGE_HEADER_RE.test(normalize(th.textContent))) return true;
  }
  return false;
}

// 텍스트가 비고 이미지가 있으면 '(이미지)' — 이미지 변경을 침묵 누락하지 않되,
// v1은 텍스트 비교라 어떤 이미지로 바뀌었는지까진 표현하지 않는다(알려진 한계).
function cellText(cell: Element): string {
  const text = normalize(cell.textContent);
  if (text) return text;
  return cell.querySelector('img') ? '(이미지)' : '';
}
```

**Step 5: 테스트 통과 확인**

Run: `pnpm vitest run lib/shopby/screening/popup-parser.test.ts`
Expected: PASS (기존 등록 테스트 포함 전부 green)

**Step 6: 커밋**

```bash
git add lib/shopby/screening/types.ts lib/shopby/screening/popup-parser.ts lib/shopby/screening/popup-parser.test.ts
git commit -m "feat: 수정 심사 팝업 diff 파서 추가"
```

---

## Task 3: 종류 판별 디스패처 + 결과 라우팅

타입 유니온 확장이 `run-scan`까지 닿으므로 빌드 일관성을 위해 한 태스크에서 처리한다.

**Files:**
- Modify: `lib/shopby/screening/types.ts` (`ScreeningPopupResult` 확장)
- Modify: `lib/shopby/screening/popup-parser.ts` (`parseScreening` 디스패처 + `waitForScreeningParse` 재배선)
- Modify: `lib/shopby/screening/run-scan.ts` (`ScreeningResult` 확장 + 라우팅)
- Test: `lib/shopby/screening/run-scan.test.ts`

**Step 1: 타입 확장 (`types.ts`)**

`ScreeningPopupResult`를 교체:
```ts
export type ScreeningPopupResult =
  | ({ status: 'ok' } & ParsedScreening)
  | { status: 'not-rendered' }
  | { status: 'login-redirect' };
```
(`{status:'ok'} & ParsedScreening` = `{status:'ok',kind:'register',product}` | `{status:'ok',kind:'modify',changes}`)

**Step 2: 디스패처 + waitForScreeningParse (`popup-parser.ts`)**

import에 `ParsedScreening` 추가. `parseScreeningChanges` 아래에 디스패처 추가:
```ts
// 종류 판별: 수정(변경 전/후) 우선 검사 후 등록. 둘 다 아니면 null(렌더 전).
export function parseScreening(doc: Document): ParsedScreening | null {
  const changes = parseScreeningChanges(doc);
  if (changes) return { kind: 'modify', changes };
  const product = parseScreeningDocument(doc);
  if (product) return { kind: 'register', product };
  return null;
}
```

`waitForScreeningParse` 루프 안의 파싱부 교체:
```ts
    const parsed = parseScreening(doc);
    if (parsed) return { status: 'ok', ...parsed };
```
(기존 `const product = parseScreeningDocument(doc); if (product) return { status: 'ok', product };` 대체)

**Step 3: 실패 테스트 작성 (`run-scan.test.ts`)**

import에 `ScreeningChange` 추가:
```ts
import type {
  CollectScreeningListResult,
  ParsedScreeningProduct,
  ScreeningChange,
  ScreeningPopupResult,
} from './types';
```

기존 `parsePopup` 페이크는 `{ status: 'ok', product: PRODUCT }`를 반환 — 타입상 `kind: 'register'`가 필요해진다. `makePorts`의 기본 `parsePopup`을 수정:
```ts
    parsePopup: vi.fn(async (): Promise<ScreeningPopupResult> => ({ status: 'ok', kind: 'register', product: PRODUCT })),
```
그리고 다른 테스트의 인라인 `{ status: 'ok', product: PRODUCT }`도 `kind: 'register'` 추가(동시성·취소 테스트 2곳).

새 describe 또는 it 추가:
```ts
const CHANGES: ScreeningChange[] = [
  { section: '판매정보', label: '즉시할인', before: '15,000원', after: '20,000원' },
];

it('수정 팝업은 규칙 평가 없이 changes를 채우고 violations는 빈다', async () => {
  const evaluated = vi.fn();
  const ports = makePorts({
    collectList: vi.fn(async () => list(['9'])),
    parsePopup: vi.fn(async (): Promise<ScreeningPopupResult> => ({ status: 'ok', kind: 'modify', changes: CHANGES })),
  });

  const summary = await runScan(ports, RULES);

  expect(summary.results[0].kind).toBe('modify');
  expect(summary.results[0].changes).toEqual(CHANGES);
  expect(summary.results[0].violations).toEqual([]);
});

it('등록·수정 혼합 목록을 한 스캔에서 종류별로 조립한다', async () => {
  let n = 0;
  const ports = makePorts({
    collectList: vi.fn(async () => list(['1', '2'])),
    parsePopup: vi.fn(async (): Promise<ScreeningPopupResult> => {
      n += 1;
      return n === 1
        ? { status: 'ok', kind: 'register', product: PRODUCT }
        : { status: 'ok', kind: 'modify', changes: CHANGES };
    }),
  });

  const summary = await runScan(ports, RULES);

  const kinds = summary.results.map((r) => r.kind).sort();
  expect(kinds).toEqual(['modify', 'register']);
  expect(summary.results.every((r) => r.status === 'ok')).toBe(true); // 수정이 타임아웃 failed로 빠지지 않음
});
```

**Step 4: 테스트 실패 확인**

Run: `pnpm vitest run lib/shopby/screening/run-scan.test.ts`
Expected: FAIL — `kind` 미존재(타입/런타임)

**Step 5: 구현 (`run-scan.ts`)**

import에 `ScreeningChange` 추가:
```ts
import type {
  CollectScreeningListResult,
  ScreeningChange,
  ScreeningPopupResult,
  ScreeningRow,
} from './types';
```

`ScreeningResult` 교체:
```ts
export type ScreeningResult = {
  productNo: string;
  productName: string;
  kind: 'register' | 'modify';
  status: 'ok' | 'failed';
  violations: Violation[]; // register 전용 (modify는 항상 [])
  changes: ScreeningChange[]; // modify 전용 (register는 항상 [])
  failReason?: string;
};
```

워커 내부 결과 조립부 교체(기존 `const result: ScreeningResult = outcome.status === 'ok' ? {...} : {...}` 자리):
```ts
      let result: ScreeningResult;
      if (outcome.status === 'not-rendered') {
        result = {
          productNo: row.productNo,
          productName: row.productName,
          kind: 'register',
          status: 'failed',
          violations: [],
          changes: [],
          failReason: '수집 실패(타임아웃)',
        };
      } else if (outcome.kind === 'register') {
        result = {
          productNo: row.productNo,
          productName: row.productName,
          kind: 'register',
          status: 'ok',
          violations: evaluate(outcome.product, rules),
          changes: [],
        };
      } else {
        result = {
          productNo: row.productNo,
          productName: row.productName,
          kind: 'modify',
          status: 'ok',
          violations: [],
          changes: outcome.changes,
        };
      }
```

`scanOne` 반환 타입은 그대로 둔다 — `Extract<ScreeningPopupResult, { status: 'ok' }>`가 두 ok 변형(register|modify)을 포함하므로 자동으로 맞는다.

**Step 6: 테스트 통과 + 타입체크**

Run: `pnpm vitest run lib/shopby/screening/run-scan.test.ts lib/shopby/screening/popup-parser.test.ts`
Expected: PASS
Run: `pnpm compile`
Expected: 에러 없음

**Step 7: 커밋**

```bash
git add lib/shopby/screening/types.ts lib/shopby/screening/popup-parser.ts lib/shopby/screening/run-scan.ts lib/shopby/screening/run-scan.test.ts
git commit -m "feat: 스캔에 수정 심사 라우팅 추가(타임아웃 해소)"
```

---

## Task 4: 결과 UI — 세그먼트 필터 + diff 카드

**Files:**
- Modify: `entrypoints/sidepanel/ui/ScreeningResults.tsx`
- Test: `entrypoints/sidepanel/ui/ScreeningResults.test.tsx`

**Step 1: 실패 테스트 작성 (`ScreeningResults.test.tsx`)**

기존 `RESULTS` 각 항목에 `kind: 'register', changes: []` 추가(타입 요구). 그리고 모디파이 항목을 가진 새 배열·테스트 추가:
```ts
const MODIFY: ScreeningResult = {
  productNo: '9',
  productName: '수정 상품',
  kind: 'modify',
  status: 'ok',
  violations: [],
  changes: [{ section: '판매정보', label: '즉시할인', before: '15,000원', after: '20,000원' }],
};

it('수정 항목은 위반만 보기가 켜져 있어도 항상 노출된다', () => {
  render(<ScreeningResults results={[...RESULTS, MODIFY]} onOpen={vi.fn()} />);
  expect(screen.getByText(/수정 상품/)).toBeInTheDocument(); // 기본 violationsOnly=true
});

it('수정 카드는 변경 전 → 변경 후 diff를 보여준다', () => {
  render(<ScreeningResults results={[MODIFY]} onOpen={vi.fn()} />);
  expect(screen.getByText(/즉시할인/)).toBeInTheDocument();
  expect(screen.getByText(/15,000원 → 20,000원/)).toBeInTheDocument();
});

it('세그먼트 수정을 고르면 등록 항목은 숨는다', async () => {
  render(<ScreeningResults results={[...RESULTS, MODIFY]} onOpen={vi.fn()} />);
  await userEvent.click(screen.getByRole('radio', { name: '수정' }));
  expect(screen.getByText(/수정 상품/)).toBeInTheDocument();
  expect(screen.queryByText(/위반 2건/)).not.toBeInTheDocument();
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm vitest run entrypoints/sidepanel/ui/ScreeningResults.test.tsx`
Expected: FAIL — radio 없음 / diff 미렌더

**Step 3: 구현 (`ScreeningResults.tsx` 전체 교체)**

```tsx
import { useMemo, useState } from 'react';
import type { ScreeningResult } from '../../../lib/shopby/screening/run-scan';

type Props = { results: ScreeningResult[]; onOpen: (productNo: string) => void };
type Segment = 'all' | 'register' | 'modify';

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'register', label: '등록' },
  { value: 'modify', label: '수정' },
];

export function ScreeningResults({ results, onOpen }: Props) {
  const [violationsOnly, setViolationsOnly] = useState(true);
  const [segment, setSegment] = useState<Segment>('all');

  const visible = useMemo(() => {
    let filtered = results;
    if (segment !== 'all') filtered = filtered.filter((r) => r.kind === segment);
    if (violationsOnly) {
      // 등록은 실패/위반만, 수정은 무조건 노출(이미 검증된 상품의 변경이라 항상 검수 대상)
      filtered = filtered.filter(
        (r) => r.kind === 'modify' || r.status === 'failed' || r.violations.length > 0,
      );
    }
    return [...filtered].sort(compareResults);
  }, [results, segment, violationsOnly]);

  if (results.length === 0) return null;

  const violationCount = results.filter((r) => r.kind === 'register' && r.violations.length > 0).length;
  const modifyCount = results.filter((r) => r.kind === 'modify').length;

  return (
    <div className="screening-results">
      <div className="screening-results__header">
        <p>
          등록 위반 <b>{violationCount}</b> · 수정 <b>{modifyCount}</b> · 전체 {results.length}건
        </p>
        <label>
          <input
            type="checkbox"
            checked={violationsOnly}
            onChange={(event) => setViolationsOnly(event.target.checked)}
          />
          위반만 보기
        </label>
      </div>

      <div className="screening-results__segments" role="radiogroup" aria-label="심사 종류">
        {SEGMENTS.map((s) => (
          <label key={s.value}>
            <input
              type="radio"
              name="screening-segment"
              checked={segment === s.value}
              onChange={() => setSegment(s.value)}
            />
            {s.label}
          </label>
        ))}
      </div>

      <ul className="screening-results__list">
        {visible.map((result) => (
          <li key={result.productNo}>
            <button
              type="button"
              className="screening-results__card"
              data-status={cardStatus(result)}
              onClick={() => onOpen(result.productNo)}
            >
              <span className="screening-results__title">
                {statusIcon(result)} {result.productNo} {result.productName}
                {result.kind === 'modify' && ` · 변경 ${result.changes.length}건`}
              </span>
              {result.status === 'failed' && (
                <span className="screening-results__fail">{result.failReason}</span>
              )}
              {result.violations.map((violation) => (
                <span key={violation.ruleId} className="screening-results__violation">
                  · {violation.label}: {violation.message}
                  {violation.actual && ` (현재: ${violation.actual})`}
                </span>
              ))}
              {result.changes.map((change) => (
                <span key={`${change.section}-${change.label}`} className="screening-results__change">
                  · {change.section} · {change.label}: {change.before} → {change.after}
                </span>
              ))}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 전체 보기에선 수정을 위로(검증된 상품의 변경을 먼저 띄움), 같은 종류면 건수 내림차순.
function compareResults(a: ScreeningResult, b: ScreeningResult): number {
  if (a.kind !== b.kind) return a.kind === 'modify' ? -1 : 1;
  const weight = (r: ScreeningResult) => (r.kind === 'modify' ? r.changes.length : r.violations.length);
  return weight(b) - weight(a);
}

function cardStatus(result: ScreeningResult): 'failed' | 'modify' | 'violation' | 'clean' {
  if (result.status === 'failed') return 'failed';
  if (result.kind === 'modify') return 'modify';
  return result.violations.length > 0 ? 'violation' : 'clean';
}

function statusIcon(result: ScreeningResult): string {
  if (result.status === 'failed') return '✖';
  if (result.kind === 'modify') return '✎';
  return result.violations.length > 0 ? '⚠' : '✅';
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm vitest run entrypoints/sidepanel/ui/ScreeningResults.test.tsx`
Expected: PASS (기존 4개 + 신규 3개)

**Step 5: 커밋**

```bash
git add entrypoints/sidepanel/ui/ScreeningResults.tsx entrypoints/sidepanel/ui/ScreeningResults.test.tsx
git commit -m "feat: 결과 패널에 등록/수정 세그먼트 필터와 diff 카드 추가"
```

---

## Task 5: 전체 회귀 + 타입체크

**Step 1: 전체 테스트**

Run: `pnpm test:run`
Expected: 전부 PASS (특히 collect/run-scan/popup-parser/ScreeningResults)

**Step 2: 타입체크**

Run: `pnpm compile`
Expected: 에러 없음

**Step 3: (선택) 수동 확인**

`pnpm dev`로 확장을 띄워 "수정 후 승인대기" 항목이 섞인 심사 목록에서 스캔 → 수정 카드가 타임아웃 없이 diff로 뜨고 세그먼트 필터가 동작하는지 확인.

**Step 4: 이상 없으면 작업 종료** — 추가 커밋 불필요(태스크별 커밋 완료).

---

## 주의사항

- **`collect.ts`·`list-harvest.ts`·`rules.ts`·`curation-rules.ts`·`popup-url.ts`는 건드리지 않는다.** 작업 트리에 이미 있는 `collect.ts`/`collect.test.ts` 변경은 **별개 작업**이므로 이 플랜의 커밋에 섞지 말 것(태스크별로 명시된 파일만 `git add`).
- 등록 경로 동작은 보존한다 — 기존 테스트가 회귀 가드.
- 이미지 변경은 `(이미지)` 플레이스홀더까지만(v1 텍스트 diff). 내용 비교는 후속.
